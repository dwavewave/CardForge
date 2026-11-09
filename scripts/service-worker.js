const prefix = `cardforge:${self.registration.scope}:`;
const cacheName = prefix + BUILD_ID;
const urls = new Set(
  PRECACHE.map((path) => new URL(path, self.registration.scope).href),
);
const index = new URL("index.html", self.registration.scope).href;
const start = new URL(self.registration.scope);

self.addEventListener("install", (event) => {
  // If a release is incomplete, the existing worker and its cache stay active.
  event.waitUntil(
    caches.open(cacheName).then((cache) => cache.addAll([...urls])),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
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

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  const navigation =
    request.mode === "navigate" &&
    url.origin === start.origin &&
    (url.pathname === start.pathname ||
      url.pathname === new URL(index).pathname);
  if (!navigation && !urls.has(url.href)) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(cacheName);
      // These are immutable same-origin build files. Match the precache URL
      // even when the browser adds an Origin header for a module or font.
      const cached = await cache.match(navigation ? index : url.href, {
        ignoreVary: true,
      });
      return cached || fetch(request);
    })(),
  );
});
