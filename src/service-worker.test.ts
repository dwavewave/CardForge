import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";

const source = readFileSync(
  new URL("../scripts/service-worker.js", import.meta.url),
  "utf8",
);
const scope = "https://cardforge.example/studio/";
const shell = scope + "index.html";
const script = scope + "sw.js";
const bundle = scope + "assets/studio.js";
const legacyCache = `cardforge:${scope}:legacy`;
const currentCache = `cardforge:${scope}:test-build`;

const html = () =>
  new Response('<div id="root"></div>', {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
const redirected = () =>
  Object.defineProperty(html(), "redirected", { value: true });

function worker() {
  const handlers: Record<string, (event: object) => void> = {};
  const fetch = vi.fn(async (request: Request): Promise<Response> =>
    request.url === shell ? html() : new Response("/* studio */"),
  );
  const cache = { put: vi.fn() };
  const caches = {
    open: vi.fn(async () => cache),
    keys: vi.fn(async () => [
      legacyCache,
      currentCache,
      "cardforge:https://other.example/:release",
      "other-cache",
    ]),
    match:
      vi.fn<
        (
          _key: string,
          _options: CacheQueryOptions,
        ) => Promise<Response | undefined>
      >(),
    delete: vi.fn(async () => true),
  };
  const clients = { claim: vi.fn(async () => {}) };
  runInNewContext(source, {
    BUILD_ID: "test-build",
    PRECACHE: ["index.html", "assets/studio.js"],
    self: {
      registration: { scope },
      clients,
      addEventListener: (name: string, handler: (event: object) => void) => {
        handlers[name] = handler;
      },
    },
    caches,
    fetch,
    URL,
    Request,
    Response,
  });
  function lifecycle(name: "install" | "activate") {
    let work!: Promise<void>;
    handlers[name]({
      waitUntil: (promise: Promise<void>) => {
        work = promise;
      },
    });
    return work;
  }
  function request(url: string, mode = "navigate", method = "GET") {
    let work: Promise<Response> | undefined;
    handlers.fetch({
      request: { url, mode, method },
      respondWith: (promise: Promise<Response>) => {
        work = promise;
      },
    });
    return work;
  }
  return { lifecycle, request, fetch, cache, caches, clients };
}

it("installs a direct HTML shell and fetches every build asset with redirects disabled", async () => {
  const sw = worker();
  await sw.lifecycle("install");
  expect(
    sw.fetch.mock.calls.map(([request]) => [
      request.url,
      request.redirect,
      request.mode,
      request.cache,
    ]),
  ).toEqual([
    [shell, "error", "same-origin", "reload"],
    [bundle, "error", "same-origin", "reload"],
  ]);
  expect(sw.cache.put).toHaveBeenCalledWith(
    shell,
    expect.objectContaining({ redirected: false, status: 200 }),
  );
  expect(sw.caches.delete).not.toHaveBeenCalled();
});

it("rejects a followed redirect and leaves the legacy cache available for the active worker", async () => {
  const sw = worker();
  sw.fetch.mockResolvedValueOnce(redirected());
  await expect(sw.lifecycle("install")).rejects.toThrow(/direct HTML/);
  expect(sw.caches.open).not.toHaveBeenCalled();
  expect(sw.caches.delete).not.toHaveBeenCalled();
});

it("discards only the incomplete new cache when an asset request fails", async () => {
  const sw = worker();
  sw.fetch
    .mockResolvedValueOnce(html())
    .mockRejectedValueOnce(new TypeError("redirect"));
  await expect(sw.lifecycle("install")).rejects.toThrow("redirect");
  expect(sw.caches.delete.mock.calls).toEqual([[currentCache]]);
  expect(sw.cache.put).not.toHaveBeenCalled();
});

it("rejects the SPA fallback when a precached asset is missing", async () => {
  const sw = worker();
  sw.fetch.mockResolvedValue(html());
  await expect(sw.lifecycle("install")).rejects.toThrow(
    /Invalid CardForge asset/,
  );
  expect(sw.cache.put).not.toHaveBeenCalled();
  expect(sw.caches.delete.mock.calls).toEqual([[currentCache]]);
});

it("serves a single offline shell for scoped navigations and serves static files from their own cache keys", async () => {
  const sw = worker();
  const response = html();
  const js = new Response("/* studio */");
  sw.caches.match.mockImplementation(async (key) =>
    key === shell ? response : js,
  );
  for (const path of ["", "index.html", "collections/quest/?installed=1"]) {
    expect(await sw.request(scope + path)).toBe(response);
  }
  expect(await sw.request(shell, "cors")).toBe(response);
  expect(await sw.request(bundle, "cors")).toBe(js);
  expect(await sw.request(bundle)).toBe(js);
  expect(sw.caches.match).toHaveBeenCalledWith(shell, {
    cacheName: currentCache,
    ignoreVary: true,
  });
  expect(sw.caches.match).toHaveBeenCalledWith(bundle, {
    cacheName: currentCache,
    ignoreVary: true,
  });
  expect(sw.request(script)).toBeUndefined();
  expect(sw.request("https://cardforge.example/outside/")).toBeUndefined();
  expect(sw.request("https://other.example/studio/")).toBeUndefined();
  expect(sw.request(scope, "navigate", "POST")).toBeUndefined();
  expect(sw.fetch).not.toHaveBeenCalled();
});

it("never returns a poisoned cache entry or redirects on a navigation cache miss", async () => {
  const sw = worker();
  sw.caches.match.mockResolvedValue(redirected());
  const clean = html();
  sw.fetch
    .mockResolvedValueOnce(clean)
    .mockRejectedValueOnce(new TypeError("redirect"));
  expect(await sw.request(scope + "some/route")).toBe(clean);
  expect(sw.fetch.mock.calls[0][0]).toMatchObject({
    url: shell,
    redirect: "error",
  });
  const unavailable = await sw.request(scope);
  expect(unavailable).toMatchObject({ status: 503, redirected: false });
  expect(sw.cache.put).not.toHaveBeenCalled();
});

it("removes old caches for this scope only after activation", async () => {
  const sw = worker();
  await sw.lifecycle("activate");
  expect(sw.caches.delete.mock.calls).toEqual([[legacyCache]]);
  expect(sw.clients.claim).toHaveBeenCalledOnce();
});
