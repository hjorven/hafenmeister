// Prueft im laufenden Spiel jede Bootsfahrt gegen Land, Stege und andere Boote.
//
//   node tools/fahrwasser-pruefen.cjs [--stufen 1-6] [--stegbilder 0-12 oder 0,7,12] [--sekunden 40] [--geraet pc|handy] [--gelaende 1-10] [--bilder ordner]
//
// Startet das Spiel mit ?stufe=n&stegbild=m (Testmodus: alles der Stufe gebaut), stellt Tempo 8x ein,
// laesst wartende Boote laufend selbst einfahren und kassiert. In jedem Bild prueft es alle sichtbaren Boote:
//   land   ein Punkt des Rumpfs (90 %) liegt auf Land oder flacher als 5 cm
//   steg   ein Punkt des Rumpfs liegt auf den Planken eines Stegs
//   boot   zwei Ruempfe (90 %) ueberlappen
//   durchlass  ein Boot faehrt im Notfall-Durchlass (nach langem Stillstand ohne Verkehrsregeln)
// Gezaehlt wird jedes Ereignis einmal (Beginn), mit Beispiel. Ende: Tabelle, Exit-Code 1 bei Fehlern.
// Braucht Playwright (tests/node_modules) und three (tests/node_modules/three), beides ueber
//   cd tests && npm ci
const path = require('path');
const fs = require('fs');
const http = require('http');
const { createRequire } = require('module');
const req = createRequire(path.join(__dirname, '../tests/package.json'));
let pw;
try { pw = req('@playwright/test'); } catch { pw = require('playwright'); }
const { chromium, devices } = pw;

const ROOT = path.resolve(__dirname, '../web');
const THREE = path.resolve(__dirname, '../tests/node_modules/three');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
// '1-6', '0,7,12' oder gemischt '0-2,7'
const bereich = (s) => s.split(',').flatMap((t) => { const [a, b] = t.split('-').map(Number); return Array.from({ length: (b ?? a) - a + 1 }, (_, i) => a + i); });
const STUFEN = bereich(arg('stufen', '1-6'));
const STEGBILDER = bereich(arg('stegbilder', '0'));
const SEKUNDEN = Number(arg('sekunden', '40'));
const GERAET = arg('geraet', 'pc');
const GELAENDE = arg('gelaende', '') ? bereich(arg('gelaende', '')) : [null];   // Geländeformen 1 bis 10 (?gelaende=N)
const BILDER = arg('bilder', '');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

function serve() {
  return new Promise((res) => {
    const s = http.createServer((q, r) => {
      let p = decodeURIComponent(q.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const f = path.join(ROOT, p);
      fs.readFile(f, (e, d) => {
        if (e) { r.writeHead(404); r.end(); return; }
        r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
        r.end(d);
      });
    }).listen(0, () => res({ s, url: `http://localhost:${s.address().port}/` }));
  });
}

// Laeuft im Browser: haengt sich an game.onTick und sammelt Verstoesse
function pruefer() {
  const G = window.hafenmeister;
  const U = 0.62;
  const st = String(G.state?.stage ?? 1);
  const H = G.stegeDaten ?? null;
  const out = { land: 0, steg: 0, boot: 0, vorbei: 0, durchlass: 0, arten: {}, beispiele: [], bilder: 0, maxBoote: 0, proben: 0 };
  const laufend = new Map();
  const segAb = (px, pz, ax, az, bx, bz) => {
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1)));
    return Math.hypot(px - ax - t * dx, pz - az - t * dz);
  };
  const ecken = (p, L, B, k) => {
    const fx = Math.cos(p.h), fz = -Math.sin(p.h), px = -fz, pz = fx, l = (L * k) / 2, w = (B * k) / 2;
    const pts = [];
    for (const [i, j] of [[1, 1], [1, -1], [-1, -1], [-1, 1], [1, 0], [-1, 0], [0, 1], [0, -1], [0, 0], [0.5, 1], [0.5, -1], [-0.5, 1], [-0.5, -1]]) pts.push([p.x + fx * l * i + px * w * j, p.z + fz * l * i + pz * w * j]);
    return pts;
  };
  const sat = (A, B) => {
    for (const P of [A, B]) for (let i = 0; i < 4; i++) {
      const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % 4];
      const nx = y2 - y1, ny = x1 - x2;
      let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
      for (const [x, y] of A) { const d = x * nx + y * ny; a0 = Math.min(a0, d); a1 = Math.max(a1, d); }
      for (const [x, y] of B) { const d = x * nx + y * ny; b0 = Math.min(b0, d); b1 = Math.max(b1, d); }
      if (a1 < b0 || b1 < a0) return false;
    }
    return true;
  };
  return import('./js/data/harbor.js').then(({ HAFEN }) => {
    const linien = (HAFEN.stufen[st]?.stege ?? []).filter((l) => l.bauart !== 'kai').map((l) => ({ halb: Math.max(1.2, l.breite * U) / 2, p: l.punkte.map(([x, y]) => [x * U, -y * U]) }));
    const melde = (art, key, info) => {
      const jetzt = G.time;
      const alt = laufend.get(key);
      laufend.set(key, jetzt);
      if (alt !== undefined && jetzt - alt < 1.5) return;     // laeuft noch
      out[art]++;
      const sorte = art + ' ' + (info.groessen ?? info.size ?? '') + ' ' + (info.zustand ?? '');
      out.arten[sorte] = (out.arten[sorte] ?? 0) + 1;
      if (out.beispiele.length < 40) out.beispiele.push({ art, t: +jetzt.toFixed(1), ...info });
    };
    G.onTick(() => {
      const boote = [...G.boatAnim.boats].filter((b) => b.model.visible !== false && b.model.parent);
      out.proben++;
      out.maxBoote = Math.max(out.maxBoote, boote.length);
      const daten = boote.map((b) => ({ b, p: b.pose(), L: b.info.length, B: b.info.beam ?? b.info.length * 0.33 }));
      for (const d of daten) {
        const { b, p, L, B } = d;
        if (b.ghost > 0) melde('durchlass', 'g' + b.id, { id: b.id, size: b.info.size, zustand: b.state, x: +p.x.toFixed(1), z: +p.z.toFixed(1) });
        // nur Boote im Kartenbereich des Gelaendes (ausserhalb ist offenes Wasser)
        const pts = ecken(p, L, B, 0.9);
        let land = false, steg = false;
        for (const [x, z] of pts) {
          if (!land && G.landscape?.tiefeBei && G.landscape.tiefeBei(x, z) < 0.05) land = true;
          if (!steg) for (const l of linien) {
            for (let i = 1; i < l.p.length; i++) if (segAb(x, z, l.p[i - 1][0], l.p[i - 1][1], l.p[i][0], l.p[i][1]) < l.halb) { steg = true; break; }
            if (steg) break;
          }
        }
        const info = { id: b.id, size: b.info.size, zustand: b.state, platz: b.berth?.id ?? null, x: +p.x.toFixed(1), z: +p.z.toFixed(1) };
        if (land) melde('land', 'l' + b.id, info);
        if (steg) melde('steg', 's' + b.id, info);
        d.ecken = pts.slice(0, 4);
      }
      for (let i = 0; i < daten.length; i++) for (let j = i + 1; j < daten.length; j++) {
        const a = daten[i], c = daten[j];
        if (Math.hypot(a.p.x - c.p.x, a.p.z - c.p.z) > (a.L + c.L) / 2) continue;
        if (!sat(a.ecken, c.ecken)) continue;
        const k = a.b.id < c.b.id ? `b${a.b.id}-${c.b.id}` : `b${c.b.id}-${a.b.id}`;
        const art = typeof a.b.id === 'string' && typeof c.b.id === 'string' ? 'vorbei' : 'boot';
        melde(art, k, { a: a.b.id, b: c.b.id, groessen: a.b.info.size + c.b.info.size, zustand: a.b.state + '/' + c.b.state, x: +((a.p.x + c.p.x) / 2).toFixed(1), z: +((a.p.z + c.p.z) / 2).toFixed(1) });
      }
    });
    window.__fahrwasserPruefung = out;
    return true;
  });
}

(async () => {
  const { s, url } = await serve();
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const geraete = { pc: { viewport: { width: 1440, height: 900 } }, handy: { ...devices['Pixel 7'] } };
  const ergebnis = [];
  let fehler = 0;
  for (const gf of GELAENDE) for (const sb of STEGBILDER) {
    for (const st of STUFEN) {
      const ctx = await browser.newContext({ ...geraete[GERAET], deviceScaleFactor: 1, serviceWorkers: 'block' });
      const page = await ctx.newPage();
      const log = [];
      page.on('pageerror', (e) => log.push(e.message));
      await page.route('https://cdn.jsdelivr.net/npm/three@0.187.0/**', (route) => {
        const rel = route.request().url().split('three@0.187.0/')[1];
        route.fulfill({ path: path.join(THREE, rel), contentType: 'text/javascript' });
      });
      await page.goto(`${url}?stufe=${st}&stegbild=${sb}${gf ? `&gelaende=${gf}` : ''}`);
      await page.waitForFunction(() => window.hafenmeister?.sim && window.hafenmeister?.boatView && window.hafenmeister?.fahrwasser, null, { timeout: 30000 });
      await page.waitForTimeout(1500);
      await page.evaluate(pruefer);
      await page.evaluate(() => { const G = window.hafenmeister; G.speed = 8; G.paused = false; });
      const t0 = Date.now();
      let n = 0;
      while (Date.now() - t0 < SEKUNDEN * 1000) {
        await page.waitForTimeout(1500);
        await page.evaluate((n) => {
          const G = window.hafenmeister;
          // Wartende fahren selbst ein, abends wird kassiert, damit der Hafen voll wird und sich leert
          for (const w of G.sim.waitingBoats?.() ?? []) if ((n + w.id) % 2 === 0) G.sim.autoEnter?.(w.id);
          G.sim.collectAll?.(true);
        }, n++);
      }
      const r = await page.evaluate(() => window.__fahrwasserPruefung);
      const summe = r.land + r.steg + r.boot;
      fehler += summe;
      const zeile = { ...(gf ? { gelaende: gf } : {}), stegbild: sb, stufe: st, proben: r.proben, maxBoote: r.maxBoote, land: r.land, steg: r.steg, boot: r.boot, vorbei: r.vorbei, durchlass: r.durchlass, fehler: log.length };
      ergebnis.push({ ...zeile, beispiele: r.beispiele });
      console.log(JSON.stringify(zeile));
      console.log('   ', JSON.stringify(Object.entries(r.arten).sort((a, b) => b[1] - a[1]).slice(0, 12)));
      for (const b of r.beispiele.filter((q) => q.art !== 'vorbei').slice(0, Number(process.env.BEISPIELE ?? 6))) console.log('   ', JSON.stringify(b));
      for (const l of log.slice(0, 3)) console.log('    Seitenfehler:', l);
      if (BILDER && summe && r.beispiele.length) {
        const b = r.beispiele.find((q) => q.art !== 'durchlass') ?? r.beispiele[0];
        await page.evaluate(({ x, z }) => { const G = window.hafenmeister; G.speed = 0; G.camera?.flyTo?.(x, z); }, b);
        await page.waitForTimeout(1500);
        fs.mkdirSync(BILDER, { recursive: true });
        await page.screenshot({ path: path.join(BILDER, `fahrwasser-sb${sb}-s${st}-${GERAET}.png`) });
      }
      await ctx.close();
    }
  }
  if (BILDER) fs.writeFileSync(path.join(BILDER, `fahrwasser-${GERAET}.json`), JSON.stringify(ergebnis, null, 1));
  await browser.close();
  s.close();
  console.log(fehler ? `Fahrwasser: ${fehler} Verstoesse.` : 'Fahrwasser: keine Verstoesse.');
  process.exit(fehler ? 1 : 0);
})();
