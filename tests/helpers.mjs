// Gemeinsame Hilfen fuer alle Tests: Spiel oeffnen, Fehler sammeln, Touch-Gesten, Bild auswerten.
import { test as base, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const WEB = path.resolve(HERE, '..', 'web');

// Die optionalen Module aus web/js/main.js (Liste MODULES). Fehlende Dateien sind erlaubt,
// vorhandene muessen fehlerfrei laden.
export function optionalModules() {
  const src = fs.readFileSync(path.join(WEB, 'js', 'main.js'), 'utf8');
  const block = src.match(/const MODULES\s*=\s*\[([\s\S]*?)\]/);
  if (!block) return [];
  return [...block[1].matchAll(/['"](\.\/[^'"]+)['"]/g)].map((m) => {
    const rel = 'js/' + m[1].slice(2);
    return { rel, exists: fs.existsSync(path.join(WEB, rel)) };
  });
}

// Three.js kommt im Spiel vom CDN. In den Tests liefern wir dieselbe Version aus node_modules,
// damit die Tests nicht am Netz haengen. Andere Versionen gehen weiter ans echte CDN.
const THREE_DIR = path.join(HERE, 'node_modules', 'three');
const THREE_VERSION = JSON.parse(fs.readFileSync(path.join(THREE_DIR, 'package.json'), 'utf8')).version;

async function routeThree(page) {
  await page.route(/^https:\/\/cdn\.jsdelivr\.net\/npm\/three@([^/]+)\/(.+)$/, async (route) => {
    const [, version, file] = route.request().url().match(/three@([^/]+)\/([^?#]+)/);
    const local = path.join(THREE_DIR, file);
    if (version !== THREE_VERSION || !local.startsWith(THREE_DIR) || !fs.existsSync(local)) {
      return route.continue();
    }
    return route.fulfill({
      status: 200,
      contentType: 'text/javascript; charset=utf-8',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: fs.readFileSync(local),
    });
  });
}

// Fixture: jede Seite sammelt Fehler. Am Ende jedes Tests muss die Liste leer sein.
export const test = base.extend({
  problems: async ({ page }, use) => {
    const problems = [];
    const modules = optionalModules();
    const missing = modules.filter((m) => !m.exists).map((m) => m.rel);
    const present = modules.filter((m) => m.exists).map((m) => m.rel);
    const allowed404 = (url) => missing.some((rel) => new URL(url).pathname.endsWith('/' + rel));

    page.on('pageerror', (err) => problems.push(`Skriptfehler: ${err.message}`));
    page.on('console', (msg) => {
      const text = msg.text();
      if (msg.type() === 'error') {
        // 404-Meldungen werten wir unten genauer ueber die Antworten aus
        if (/Failed to load resource/.test(text)) return;
        problems.push(`Konsole (error): ${text}`);
      }
      // main.js meldet nicht ladbare Module nur als info. Fuer vorhandene Dateien ist das ein Fehler.
      if (/Modul noch nicht vorhanden oder fehlerhaft/.test(text)) {
        const hit = present.find((rel) => text.includes(rel.slice(3)));
        if (hit) problems.push(`Modul web/${hit} ist vorhanden, laedt aber nicht: ${text}`);
      }
    });
    page.on('response', (res) => {
      if (res.status() >= 400 && !allowed404(res.url())) {
        problems.push(`HTTP ${res.status()}: ${res.url()}`);
      }
    });
    page.on('requestfailed', (req) => {
      if (allowed404(req.url())) return;   // fehlendes optionales Modul: Chrome bricht nach 404 ab
      problems.push(`Anfrage fehlgeschlagen: ${req.url()} (${req.failure()?.errorText})`);
    });

    await routeThree(page);
    await use(problems);
    expect(problems, 'Fehler beim Laden oder Spielen').toEqual([]);
  },

  // Spiel geoeffnet und fertig geladen
  game: async ({ page, problems }, use) => {
    await page.goto('./');
    await page.waitForFunction(() => {
      const boot = document.getElementById('boot');
      return boot && (boot.classList.contains('done') || boot.classList.contains('error'));
    }, null, { timeout: 45_000, polling: 100 });
    await expect(page.locator('#boot'), 'Startmeldung zeigt einen Fehler').not.toHaveClass(/error/);
    await page.waitForFunction(() => window.hafenmeister && window.hafenmeister.time > 0.1, null, { timeout: 30_000, polling: 100 });
    await use({ page, problems });
  },
});

export { expect };

// Kamera-Zustand aus dem Spiel lesen
export function cameraState(page) {
  return page.evaluate(() => {
    const c = window.hafenmeister.camera;
    return { x: c.target.x, z: c.target.z, width: c.viewWidth };
  });
}

// Freier Punkt auf der Spielflaeche, moeglichst nah an der Bildschirmmitte, an dem keine
// Leiste oder Karte liegt (elementFromPoint trifft #stage). Klappt mit jedem Layout.
// Mit { leer: true } zusaetzlich nur Punkte, an denen nichts Antippbares liegt (game.pick ist null).
export async function stageCenter(page, { leer = false } = {}) {
  return page.evaluate((leer) => {
    const g = window.hafenmeister;
    const stage = document.getElementById('stage');
    const cx = innerWidth / 2, cy = innerHeight / 2;
    let best = null;
    for (let gy = 0.1; gy <= 0.9; gy += 0.05) {
      for (let gx = 0.1; gx <= 0.9; gx += 0.05) {
        const x = Math.round(innerWidth * gx), y = Math.round(innerHeight * gy);
        // Ringsum 60 px Platz, damit Gesten nicht in eine Leiste laufen
        const free = [[0, 0], [-60, 0], [60, 0], [0, -60], [0, 60]]
          .every(([dx, dy]) => document.elementFromPoint(x + dx, y + dy) === stage);
        if (!free) continue;
        if (leer && typeof g?.pick === 'function' && g.pick(x, y, { tolerance: 40 })) continue;
        const d = Math.hypot(x - cx, y - cy);
        if (!best || d < best.d) best = { x, y, d };
      }
    }
    if (!best) throw new Error('Kein freier Punkt auf der Spielflaeche gefunden');
    return { x: best.x, y: best.y };
  }, leer);
}

// Echte Touch-Gesten ueber das Chrome DevTools Protocol (ein oder zwei Finger)
export async function touchGesture(page, frames) {
  const cdp = await page.context().newCDPSession(page);
  const send = (type, points) => cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: points.map((p, id) => ({ x: p.x, y: p.y, id, radiusX: 4, radiusY: 4, force: 1 })),
  });
  await send('touchStart', frames[0]);
  for (const f of frames.slice(1)) {
    await send('touchMove', f);
    await page.waitForTimeout(16);
  }
  await send('touchEnd', []);
  await cdp.detach();
}

export function lerpFrames(from, to, steps = 12) {
  return Array.from({ length: steps + 1 }, (_, i) => from.map((p, k) => ({
    x: Math.round(p.x + (to[k].x - p.x) * (i / steps)),
    y: Math.round(p.y + (to[k].y - p.y) * (i / steps)),
  })));
}

// Bildschirmfoto auswerten: wie viele verschiedene Farben, wie viel ist schwarz
export function imageStats(buffer) {
  const png = PNG.sync.read(buffer);
  const colors = new Set();
  let dark = 0;
  const n = png.width * png.height;
  for (let i = 0; i < png.data.length; i += 4) {
    const r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
    if (r + g + b < 30) dark++;
    colors.add(((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3));
  }
  return { colors: colors.size, darkShare: dark / n, width: png.width, height: png.height };
}

export function isTouchProject(testInfo) {
  return !!testInfo.project.use.hasTouch;
}

// Einstieg (web/js/features/einstieg.js) beenden: seine Hinweiskarten erscheinen zeitversetzt
// und koennen sonst mitten in einer Test-Geste ueber der Stelle liegen, an der gezogen wird.
// Nur fuer Tests der Grundbedienung; der Einstieg selbst wird hier nicht geprueft.
export async function ohneEinstieg(page) {
  const vorhanden = optionalModules().some((m) => m.rel === 'js/features/einstieg.js' && m.exists);
  if (!vorhanden) return;
  await page.waitForFunction(() => !!window.hafenmeister.einstieg, null, { timeout: 30_000, polling: 100 });
  await page.evaluate(() => window.hafenmeister.einstieg.beenden());
  // Ein Bild warten, damit Karte und Ring wirklich weg sind
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

// Warten, bis die Kamera stillsteht: kein Schwung nach dem Wischen, keine Kamerafahrt (flyTo),
// kein Nachdrehen oder Nachneigen. Danach noch zwei Bilder, damit Leisten-Animationen durch sind.
export async function kameraRuhig(page, timeout = 10_000) {
  await page.waitForFunction(() => {
    const c = window.hafenmeister.camera;
    const s = c._schwung || {};
    return !c._fly && (c._yawTarget ?? null) === null && (c._pitchTarget ?? null) === null &&
      !s.x && !s.y && !s.yaw && !s.pitch;
  }, null, { timeout, polling: 50 });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}
