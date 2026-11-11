// Service Worker für Hafenmeister.
// Liegt im Wurzelordner des Spiels (web/), damit er für alle Seiten darunter gilt,
// auch unter https://hjorven.github.io/hafenmeister/.
//
// Strategie:
// - Eigene Dateien: zuerst Netz, damit nach einem Update nie alter und neuer
//   Code gemischt wird. Ohne Netz kommt die letzte Kopie aus dem Cache.
// - Bibliotheken vom CDN mit fester Version (z.B. three@0.187.0): zuerst Cache,
//   sie ändern sich nie.
// - Alles andere (z.B. Supabase) wird nicht angefasst.
//
// Bei Änderungen an dieser Datei VERSION erhöhen.

const VERSION = 'v1';
const CACHE = `hafenmeister-${VERSION}`;

// Grundausstattung, damit das Spiel nach dem ersten Besuch offline startet.
// Pfade relativ zum Ordner von sw.js. Fehlende Dateien werden übersprungen.
const PRECACHE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

const CDN_HOSTS = ['cdn.jsdelivr.net', 'unpkg.com', 'cdnjs.cloudflare.com'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(PRECACHE.map(async (path) => {
      try {
        const res = await fetch(new Request(path, { cache: 'reload' }));
        if (res.ok) await cache.put(path, res);
      } catch { /* offline oder fehlt: später beim Spielen */ }
    }));
    // Beim allerersten Besuch sofort aktiv werden, bei Updates warten,
    // bis das Spiel es erlaubt (Nachricht 'aktivieren').
    if (!self.registration.active) await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((k) => k.startsWith('hafenmeister-') && k !== CACHE)
      .map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.typ === 'aktivieren') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (!url.pathname.startsWith(new URL('./', self.location).pathname)) return;
    event.respondWith(networkFirst(event, req));
    return;
  }
  if (CDN_HOSTS.includes(url.hostname) && /@\d+\.\d+\.\d+/.test(url.pathname)) {
    event.respondWith(cacheFirst(req));
  }
});

async function networkFirst(event, req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok && res.type === 'basic') event.waitUntil(cache.put(req, res.clone()));
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') {
      const start = await cache.match('./') || await cache.match('index.html');
      if (start) return start;
    }
    throw err;
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') await cache.put(req, res.clone());
  return res;
}
