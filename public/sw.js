const CACHE_NAME = 'ksa-outpost-86-shell-v13';
const APP_SHELL = [
  './', './index.html', './manifest.webmanifest', './favicon.svg',
  './assets/audio/outpost-ambience.ogg', './assets/audio/suit-breathing.ogg',
  './assets/audio/boot-regolith-step.ogg', './assets/audio/radio-chirp.ogg',
  './assets/audio/system-warning.ogg', './assets/audio/mission-success.ogg',
  './assets/audio/ui-soft-click.ogg', './assets/crew/ksa-astronaut-crew.svg'
  // Heavy terrain and optional world assets are fetched only when needed.
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith('ksa-outpost-86-shell-') && key !== CACHE_NAME)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never cache account, save, or real-time API responses.
  if (url.pathname.includes('/api/')) return;

  const isNavigation = request.mode === 'navigate' || url.pathname.endsWith('/index.html');
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    if (isNavigation) {
      // Network-first HTML prevents Android from being trapped on an old UI
      // after a new release. The cached shell remains the offline fallback.
      try {
        const fresh = await fetch(request, { cache: 'no-cache' });
        if (fresh.ok) await cache.put('./index.html', fresh.clone());
        return fresh;
      } catch {
        return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
      }
    }

    const cached = await cache.match(request);
    if (cached) return cached;

    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') await cache.put(request, response.clone());
      return response;
    } catch {
      return Response.error();
    }
  })());
});
