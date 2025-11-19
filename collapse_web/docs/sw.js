// Bump cache version to force a new cache after major deploys.
// If you need faster invalidation in the future, update this to v3, v4, etc.
const CACHE_NAME = "collapse-companion-v2";
const APP_BASE = "/cvttweb/";
const APP_SHELL = [
  APP_BASE,
  `${APP_BASE}index.html`,
  `${APP_BASE}manifest.webmanifest`
];

self.addEventListener("install", (event) => {
  // Activate this service worker immediately on install so new assets are used on next reload
  // Note: skipWaiting should be used carefully; this will take over existing pages.
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
});

self.addEventListener("activate", (event) => {
  // Ensure this service worker starts controlling uncontrolled clients as soon as it activates
  // so the new cached assets (index + new bundles) serve right away.
  clients.claim();
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => (key !== CACHE_NAME ? caches.delete(key) : null)))
    )
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(`${APP_BASE}index.html`));
    })
  );
});
