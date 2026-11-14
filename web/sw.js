// Service Worker für Hafenmeister.
// Liegt im Wurzelordner des Spiels (web/), damit er für alle Seiten darunter gilt,
// auch unter https://hjorven.github.io/hafenmeister/.
//
// Strategie:
// - Eigene Dateien: zuerst Netz, damit nach einem Update nie alter und neuer
//   Code gemischt wird. Ohne Netz kommt die letzte Kopie aus dem Cache.
// - Vorab laden (P61): Nach jedem Start schickt das Spiel 'vorladen'. Der Worker holt
//   offline-liste.json (entsteht beim Deploy, tools/offline-liste.mjs) und legt alle
//   Spieldateien in den Cache, Three.js eingeschlossen (liegt in vendor/). Danach startet
//   das Spiel komplett ohne Netz. Geladen wird nur, wenn sich der Stand der Liste geändert hat.
// - Bibliotheken von einem CDN mit fester Version: zuerst Cache, sie ändern sich nie.
//   Das Spiel selbst lädt nichts mehr von einem CDN, nur Nebenseiten könnten es noch.
// - Alles andere (z.B. Supabase) wird nicht angefasst.
//
// Bei Änderungen an dieser Datei VERSION erhöhen.

const VERSION = 'v2';
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
  if (event.data && event.data.typ === 'vorladen') event.waitUntil(vorladen());
});

// ---------------------------------------------------------------------------
// Alle Spieldateien vorab laden

const STAND_KEY = '__offline-stand';
let vorladenLaeuft = null;

function vorladen() {
  vorladenLaeuft ||= ladeListe().finally(() => { vorladenLaeuft = null; });
  return vorladenLaeuft;
}

async function ladeListe() {
  let liste;
  try {
    // 'no-cache': immer beim Server nachfragen, ob es einen neuen Stand gibt
    const res = await fetch(new Request('offline-liste.json', { cache: 'no-cache' }));
    if (!res.ok) return melde({ typ: 'offline-fehlt' });   // z.B. lokal ohne Deploy-Schritt
    liste = await res.json();
  } catch {
    return;   // offline: der letzte vollständige Stand bleibt im Cache
  }
  if (!liste || !Array.isArray(liste.dateien) || !liste.stand) return;

  const cache = await caches.open(CACHE);
  const alt = await cache.match(STAND_KEY);
  if (alt && (await alt.text()) === liste.stand) {
    return melde({ typ: 'offline-bereit', stand: liste.stand, geladen: 0 });
  }

  // Höchstens sechs Anfragen gleichzeitig, damit das Spiel beim Start nicht ausgebremst wird
  const offen = [...liste.dateien];
  let fehler = 0, geladen = 0;
  const arbeiter = async () => {
    while (offen.length) {
      const rel = offen.shift();
      try {
        const res = await fetch(new Request(rel, { cache: 'no-cache' }));
        if (res.ok) { await cache.put(rel, res); geladen++; } else fehler++;
      } catch { fehler++; }
    }
  };
  await Promise.all(Array.from({ length: 6 }, arbeiter));
  if (fehler === 0) {
    await cache.put(STAND_KEY, new Response(liste.stand));
    if (liste.dateien.includes('index.html')) {
      // Die Startseite auch unter './' ablegen (so kommt sie beim Öffnen ohne index.html)
      const start = await cache.match('index.html');
      if (start) await cache.put('./', start.clone());
    }
    return melde({ typ: 'offline-bereit', stand: liste.stand, geladen });
  }
  return melde({ typ: 'offline-unvollstaendig', stand: liste.stand, geladen, fehler });
}

async function melde(nachricht) {
  const fenster = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const f of fenster) f.postMessage(nachricht);
}

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
