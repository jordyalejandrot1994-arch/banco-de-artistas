/* service-worker.js
   Caché simple y estrategia mixta:
   - Recursos "core" (index, CSS, JS, icons) => cache-first
   - API (sheetdb.io) => network-first (intentar en vivo y fallback a cache si falla)
   - Soporta skipWaiting / clients.claim para actualizaciones controladas
*/

const SW_VERSION = 'ba-sw-v1';
const CORE_CACHE = `${SW_VERSION}-core`;
const RUNTIME_CACHE = `${SW_VERSION}-runtime`;
const API_DOMAIN = 'sheetdb.io'; // dominio de tu API

// Lista inicial de recursos a cachear (ajusta si tus nombres cambian)
const CORE_ASSETS = [
  './',
  './index.html',
  './style-v2.css',
  './style.css',
  './app-clean.js',
  './manifest.json',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

// Instalación: cache core assets
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CORE_CACHE).then((cache) => {
      return cache.addAll(CORE_ASSETS.map(u => new Request(u, {cache: 'reload'})));
    })
  );
});

// Activación: limpiar caches antiguos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k !== CORE_CACHE && k !== RUNTIME_CACHE)
        .map(k => caches.delete(k)));
      // Control immediate clients after activation
      await self.clients.claim();
    })()
  );
});

// Fetch: estrategia mixta
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // No interceptar devtools, chrome-extension, data:, etc.
  if (req.method !== 'GET') return;

  // API requests (network-first, fallback to cache)
  if (url.hostname.includes(API_DOMAIN)) {
    event.respondWith(networkFirst(req));
    return;
  }

  // Core assets: cache-first
  if (CORE_ASSETS.some(asset => sameOriginPath(url, asset))) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // For others: runtime cache with network-first fallback-to-cache
  event.respondWith(networkFirstThenCache(req));
});

// Helper: cache-first strategy
async function cacheFirst(request) {
  const cache = await caches.open(CORE_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    // optionally cache runtime responses
    const runtime = await caches.open(RUNTIME_CACHE);
    runtime.put(request, response.clone());
    return response;
  } catch (e) {
    return cached || new Response('Offline', {status: 503, statusText: 'Offline'});
  }
}

// Helper: network-first for runtime/api
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    // cache successful responses
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, response.clone());
    return response;
  } catch (e) {
    const cache = await caches.open(RUNTIME_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    // fallback to core cache (index.html) or generic offline message
    const core = await caches.open(CORE_CACHE);
    const fallback = await core.match('./index.html');
    return fallback || new Response('Offline', {status: 503, statusText: 'Offline'});
  }
}

// network-first but also put in runtime cache
async function networkFirstThenCache(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, response.clone());
    return response;
  } catch (e) {
    const cache = await caches.open(RUNTIME_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    const core = await caches.open(CORE_CACHE);
    const fallback = await core.match('./index.html');
    return fallback || new Response('Offline', {status: 503});
  }
}

// Utility: compare request path ignoring origin
function sameOriginPath(urlObj, assetPath) {
  try {
    // normalize both
    const asset = new URL(assetPath, self.location).pathname;
    return urlObj.pathname === asset;
  } catch (e) {
    return false;
  }
}

// Listen to messages (for skipWaiting)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
