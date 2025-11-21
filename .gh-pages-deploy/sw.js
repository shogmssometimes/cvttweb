// Bump cache version to force a new cache after major deploys.
// If you need faster invalidation in the future, update this to v3, v4, etc.
// Bump cache version to force a new cache after major deploys.
// If you need faster invalidation in the future, update this to v3, v4, etc.
const CACHE_NAME = "collapse-companion-v3";
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
  // Prefer network for HTML documents (index) so updates are discovered quickly.
  const url = new URL(event.request.url);

  if (event.request.destination === 'document' || url.pathname === `${APP_BASE}` || url.pathname === `${APP_BASE}index.html`) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // put a clone into the cache for offline fallback
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(`${APP_BASE}index.html`))
    );
    return;
  }

  // Otherwise use cache-first strategy for static assets to improve offline reliability
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
