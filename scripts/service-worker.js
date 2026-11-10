const scope = new URL(self.registration.scope);
const prefix = `cardforge:${scope.href}:`;
const cacheName = prefix + BUILD_ID;
const shellURL = new URL("index.html", scope).href;
const workerURL = new URL("sw.js", scope).href;
const urls = new Set(PRECACHE.map((path) => new URL(path, scope).href));

function precacheRequest(url) {
  return new Request(url, {
    mode: "same-origin",
    redirect: "error",
    cache: "reload",
  });
}

function isDirect(response) {
  return (
    response?.ok && !response.redirected && response.type !== "opaqueredirect"
  );
}

function isHTML(response) {
  return /^text\/html\b/i.test(response.headers.get("Content-Type") ?? "");
}

function isShell(response) {
  return isDirect(response) && response.status === 200 && isHTML(response);
}

function isAsset(response) {
  return isDirect(response) && !isHTML(response);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      // Keep the active release if the host redirects or deploys an incomplete build.
      const shell = await fetch(precacheRequest(shellURL));
      if (!isShell(shell))
        throw new Error("CardForge needs a direct HTML app shell.");
      const cache = await caches.open(cacheName);
      try {
        const assets = [...urls].filter((url) => url !== shellURL);
        const results = await Promise.allSettled(
          assets.map(async (url) => {
            const asset = await fetch(precacheRequest(url));
            // An asset-only SPA host can return index.html for a missing bundle.
            if (!isAsset(asset))
              throw new Error(`Invalid CardForge asset: ${url}`);
            await cache.put(url, asset);
          }),
        );
        // Wait for all writes before cleaning up a failed install.
        const failure = results.find((result) => result.status === "rejected");
        if (failure) throw failure.reason;
        await cache.put(shellURL, shell);
      } catch (error) {
        await caches.delete(cacheName);
        throw error;
      }
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Activation waits for old documents to close. Their bundles remain available
      // until then, and cleanup is limited to this app's shell caches for this scope.
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(prefix) && key !== cacheName)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

async function navigationResponse() {
  const cached = await caches.match(shellURL, { cacheName, ignoreVary: true });
  if (isShell(cached)) return cached;
  try {
    const shell = await fetch(precacheRequest(shellURL));
    if (isShell(shell)) return shell;
  } catch {
    // No usable shell, for example after storage eviction while offline.
  }
  return new Response(
    "CardForge could not load. Reconnect and reopen the app.",
    {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    },
  );
}

async function assetResponse(request) {
  const cached = await caches.match(request.url, {
    cacheName,
    ignoreVary: true,
  });
  if (isAsset(cached)) return cached;
  const asset = await fetch(request, { redirect: "error" });
  return isAsset(asset) ? asset : Response.error();
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname))
    return;

  // Preserve the address bar URL, but always load the same shell for SPA routes.
  url.search = "";
  url.hash = "";
  if (
    url.href === shellURL ||
    (request.mode === "navigate" &&
      url.href !== workerURL &&
      !urls.has(url.href))
  ) {
    event.respondWith(navigationResponse());
  } else if (urls.has(request.url)) {
    event.respondWith(assetResponse(request));
  }
});
