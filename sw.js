/* Blueprint — service worker
   Strategy: install-time precache of the static shell, then cache-first for
   precached assets (offline play) and network-first for everything else with
   cache fallback. Bump CACHE_NAME whenever shipping new assets so clients pull
   the fresh shell on the next load.
*/
const CACHE_NAME = 'blueprint-v0.9.3-1';
const PRECACHE = [
  './',
  './index.html',
  './style.css',
  './game.js',
  './sim-worker.js',
  './manifest.json',
  './icon.svg',
  './og-image.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Only handle same-origin requests — let cross-origin go to network directly
  if (url.origin !== self.location.origin) return;

  // Cache-first for precached shell assets (offline play).
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        // Kick off a background refresh so updates land on the next load.
        fetch(req).then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          }
        }).catch(() => {});
        return cached;
      }
      return fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
