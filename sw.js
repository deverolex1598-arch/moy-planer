const CACHE = "soft-planner-v10";
const FILES = ["./", "index.html", "style.css", "app.js", "cycle.js", "auth.js", "seed.json", "manifest.webmanifest", "icon.svg"];
const FRESH_FILES = new Set(["/", "/index.html", "/style.css", "/app.js", "/cycle.js", "/auth.js", "/seed.json"]);

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(FILES.map(async file => {
      try {
        const response = await fetch(file, { cache: "reload" });
        if (response.ok) await cache.put(file, response);
      } catch (error) {
        console.warn("Planner asset could not be cached:", file, error);
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith("soft-planner-") && key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const isFreshFile = FRESH_FILES.has(url.pathname);
    if (isFreshFile) {
      try {
        const response = await fetch(event.request, { cache: "no-store" });
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy)).catch(() => {});
        }
        return response;
      } catch (error) {
        return (await caches.match(event.request)) || (event.request.mode === "navigate" ? (await caches.match("./index.html")) : Response.error());
      }
    }

    const cached = await caches.match(event.request);
    if (cached) return cached;
    try {
      const response = await fetch(event.request);
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy)).catch(() => {});
      }
      return response;
    } catch (error) {
      if (event.request.mode === "navigate") {
        return (await caches.match("./index.html")) || Response.error();
      }
      return Response.error();
    }
  })());
});
