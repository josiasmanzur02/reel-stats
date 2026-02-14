const CACHE_NAME = "fishcatch-cache-v1";
const OFFLINE_URL = "/index.html";
const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/catch-form.html",
  "/gallery.html",
  "/catch.html",
  "/map.html",
  "/backup.html",
  "/manifest.webmanifest",
  "/assets/css/styles.css",
  "/assets/js/utils.js",
  "/assets/js/ui.js",
  "/assets/js/db.js",
  "/assets/js/photo.js",
  "/assets/js/dashboard.js",
  "/assets/js/form.js",
  "/assets/js/gallery.js",
  "/assets/js/detail.js",
  "/assets/js/map.js",
  "/assets/js/backup.js",
  "/assets/js/sw-register.js",
  "/assets/icons/icon-192.png",
  "/assets/icons/icon-512.png",
  "/assets/icons/apple-touch-icon.png",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet-src.esm.js",
  "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  "https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Pre-cache app shell + CDN libs (opaque cached with no-cors).
      return cache.addAll(PRECACHE_URLS.map((url) => new Request(url, { mode: url.startsWith("http") ? "no-cors" : "cors" })));
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).catch(() => {
            return caches.match(OFFLINE_URL);
          })
      )
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
