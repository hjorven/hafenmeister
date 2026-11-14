// P61: Das Spiel startet ohne fremden Server (Three.js liegt in web/vendor/) und nach dem ersten
// Besuch auch ganz ohne Netz. Der Service Worker legt dafuer alle Dateien aus offline-liste.json
// in den Cache. Die Fixture sperrt ausserdem jedes CDN (helpers.mjs), das gilt fuer alle Tests.
import fs from 'node:fs';
import path from 'node:path';
import { test, expect, WEB } from '../helpers.mjs';

// Ein Handy und der PC reichen: Service Worker und Cache sind nicht vom Layout abhaengig
test.skip(({ projekt }) => !['handy', 'pc'].includes(projekt), 'nur Handy und PC');
test.use({ serviceWorkers: 'allow' });

const SITE = path.resolve(WEB, '..', '_site');

// Wartet, bis der Service Worker alle Dateien vorab geladen hat, und gibt den Stand zurueck
async function warteAufVorrat(page) {
  const lesen = () => page.evaluate(async () => {
    for (const name of await caches.keys()) {
      if (!name.startsWith('hafenmeister-')) continue;
      const hit = await (await caches.open(name)).match('__offline-stand');
      if (hit) return { cache: name, stand: await hit.text() };
    }
    return null;
  });
  await expect.poll(lesen, { message: 'Service Worker hat den Offline-Vorrat nicht angelegt', timeout: 45_000, intervals: [500] })
    .not.toBeNull();
  return lesen();
}

async function spielLaeuft(page) {
  await page.waitForFunction(() => {
    const boot = document.getElementById('boot');
    return boot && (boot.classList.contains('done') || boot.classList.contains('error'));
  }, null, { timeout: 45_000, polling: 100 });
  await expect(page.locator('#boot'), 'Startmeldung zeigt einen Fehler').not.toHaveClass(/error/);
  const t0 = await page.evaluate(() => window.hafenmeister?.time ?? 0);
  await page.waitForFunction((t) => window.hafenmeister && window.hafenmeister.time > t + 0.1, t0,
    { timeout: 30_000, polling: 100 });
  const info = await page.evaluate(() => ({
    webgl: !!window.hafenmeister?.renderer?.getContext(),
    szene: window.hafenmeister?.scene?.children.length ?? 0,
    three: window.hafenmeister?.THREE?.REVISION ?? null,
  }));
  expect(info.webgl, 'kein WebGL-Kontext').toBe(true);
  expect(info.szene, 'Szene ist leer').toBeGreaterThan(0);
  expect(info.three, 'Three.js nicht geladen').toBeTruthy();
  await expect(page.locator('#money')).toBeVisible();
}

test('Three.js kommt aus dem Spiel selbst, nicht von einem CDN', async ({ game }) => {
  const { page } = game;
  const quellen = await page.evaluate(() => performance.getEntriesByType('resource')
    .map((e) => e.name).filter((n) => /three/.test(n)));
  expect(quellen.length, 'keine Three.js-Datei geladen').toBeGreaterThan(0);
  for (const q of quellen) expect(new URL(q).host, q).toBe(new URL(page.url()).host);
});

test('Nach dem ersten Besuch startet das Spiel ohne Netz', async ({ game, context }) => {
  const { page } = game;
  const liste = JSON.parse(fs.readFileSync(path.join(SITE, 'offline-liste.json'), 'utf8'));
  const vorrat = await warteAufVorrat(page);
  expect(vorrat.stand, 'Stand im Cache passt nicht zur offline-liste.json').toBe(liste.stand);

  // Jede Datei der Liste liegt im Cache
  const fehlt = await page.evaluate(async ({ cache, dateien }) => {
    const c = await caches.open(cache);
    const out = [];
    for (const rel of dateien) if (!(await c.match(rel))) out.push(rel);
    return out;
  }, { cache: vorrat.cache, dateien: liste.dateien });
  expect(fehlt, 'Dateien fehlen im Offline-Vorrat').toEqual([]);
  expect(liste.dateien.some((d) => d.startsWith('vendor/three-')), 'Three.js fehlt in der Liste').toBe(true);

  // Netz weg, neu laden: das Spiel muss komplett aus dem Cache starten
  await context.setOffline(true);
  await page.reload();
  await spielLaeuft(page);

  // Auch ein frischer Aufruf mit anderen Parametern (z.B. Lesezeichen auf eine Stufe)
  await page.goto('./?stufe=3');
  await spielLaeuft(page);
  expect(await page.evaluate(() => navigator.onLine)).toBe(false);
  await context.setOffline(false);
});

test('Ein zweiter Start ohne Aenderung laedt nichts neu', async ({ game }) => {
  const { page } = game;
  await warteAufVorrat(page);
  await page.reload();
  // Das Spiel schickt 'vorladen' erst 3 s nach dem Laden, der Zuhoerer steht also rechtzeitig
  const m = await page.evaluate(() => new Promise((ok) => {
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data?.typ?.startsWith('offline-')) ok(e.data);
    });
  }));
  expect(m.typ).toBe('offline-bereit');
  expect(m.geladen, 'unveraenderter Stand wurde trotzdem neu geladen').toBe(0);
  await spielLaeuft(page);
});
