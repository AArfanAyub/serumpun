/* Serumpun service worker - hand written, no build plugin, no telemetry.
 *
 * Strategy:
 *   - same-origin app shell / bundled crop + sample data : cache-first with background refresh
 *   - cross-origin keyless data APIs (allowlisted in src/config/endpoints.ts) : network-first,
 *     falling back to the last successful cached response when the network is unavailable
 *   - the app never depends on this file: bundled sample payloads in src/data/sample/
 *     already make a first-run, zero-network session fully functional.
 */
const VERSION = 'serumpun-shell-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/favicon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) =>
        Promise.allSettled(SHELL.map((path) => cache.add(new Request(path, { cache: 'reload' }))))
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  const isSameOrigin = url.origin === self.location.origin;

  if (isSameOrigin) {
    event.respondWith(
      caches.open(VERSION).then(async (cache) => {
        const hit = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            if (response && response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => null);
        if (hit) return hit;
        const fresh = await network;
        if (fresh) return fresh;
        const fallback = await cache.match(new Request('./index.html'));
        return fallback || new Response('Offline', { status: 503, statusText: 'Offline' });
      })
    );
    return;
  }

  event.respondWith(
    caches.open(VERSION).then(async (cache) => {
      try {
        const response = await fetch(request);
        if (response && response.ok && response.type === 'basic') {
          cache.put(request, response.clone());
        }
        return response;
      } catch {
        const cached = await cache.match(request);
        if (cached) return cached;
        return new Response('', { status: 503, statusText: 'Data source unavailable' });
      }
    })
  );
});
