const CACHE_NAME = 'ksa-outpost-86-shell-v9';
const APP_SHELL = [
  './', './index.html', './manifest.webmanifest', './favicon.svg',
  './assets/audio/outpost-ambience.ogg', './assets/audio/suit-breathing.ogg',
  './assets/audio/boot-regolith-step.ogg', './assets/audio/radio-chirp.ogg',
  './assets/audio/system-warning.ogg', './assets/audio/mission-success.ogg',
  './assets/audio/ui-soft-click.ogg', './assets/crew/ksa-astronaut-crew.svg'
  // Large planetary textures are deliberately not precached. They are
  // downloaded and cached on demand when the player enters that world.
];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('ksa-outpost-86-shell-') && key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    } catch {
      if (request.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
      return Response.error();
    }
  })());
});
