const CACHE_NAME = "reel-stats-shell-v2";
const RUNTIME_CACHE = "reel-stats-runtime-v2";
const OFFLINE_URL = "/index.html";

const APP_SHELL = [
  "/",
  "/index.html",
  "/trips.html",
  "/trip-form.html",
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
  "/assets/js/weather.js",
  "/assets/js/dashboard.js",
  "/assets/js/trips.js",
  "/assets/js/trip-form.js",
  "/assets/js/form.js",
  "/assets/js/gallery.js",
  "/assets/js/detail.js",
  "/assets/js/map.js",
  "/assets/js/backup.js",
  "/assets/js/sw-register.js",
  "/assets/icons/icon-192.png",
  "/assets/icons/icon-512.png",
  "/assets/icons/apple-touch-icon.png",
  "/assets/vendor/leaflet/leaflet.css",
  "/assets/vendor/leaflet/leaflet.js",
  "/assets/vendor/leaflet/images/marker-icon.png",
  "/assets/vendor/leaflet/images/marker-icon-2x.png",
  "/assets/vendor/leaflet/images/marker-shadow.png"
];

const isRuntimeUrl = (url) =>
  url.hostname.includes("tile.openstreetmap.org") ||
  url.hostname.includes("api.open-meteo.com") ||
  url.hostname.includes("archive-api.open-meteo.com");

const cacheResponse = async (cacheName, request, response) => {
  if (!response || (!response.ok && response.type !== "opaque")) return response;
  const cache = await caches.open(cacheName);
  cache.put(request, response.clone());
  return response;
};

const fetchAndCache = async (cacheName, request) => {
  const response = await fetch(request);
  return cacheResponse(cacheName, request, response);
};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => ![CACHE_NAME, RUNTIME_CACHE].includes(key))
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetchAndCache(CACHE_NAME, event.request).catch(async () => {
        const cached = await caches.match(event.request);
        return cached || caches.match(OFFLINE_URL);
      })
    );
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetchAndCache(CACHE_NAME, event.request).catch(() => Response.error());
      })
    );
    return;
  }

  if (isRuntimeUrl(url)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const networkPromise = fetchAndCache(RUNTIME_CACHE, event.request).catch(() => cached);
        return cached || networkPromise;
      })
    );
  }
});
