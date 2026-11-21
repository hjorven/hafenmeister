#!/usr/bin/env node
// Schichttest: spielt das Spiel Schicht für Schicht von Grund auf über die echte Oberfläche.
// Schicht 1 ist der nackte Kern, jede weitere Schicht nimmt eine Funktion dazu und prüft danach
// alle bisherigen Schichten noch einmal im selben Spiel (Wechselwirkungen). Anleitung: docs/schichttest.md
//
// Aufruf (im Hauptordner des Repos, einmal vorher: cd tests && npm ci && cd ..):
//   node tools/schichttest/lauf.cjs --geraet pc --bis 1 --out /tmp/schichttest
//
// Optionen (alle optional):
//   --geraet pc|handy|handyquer|tablet|tabletquer   Gerät (Standard pc)
//   --bis n         letzte Schicht (Standard: alle)
//   --nur a,b       nur diese Schichten (Nummern), ohne die Wiederholung der früheren
//   --wieder k      nach jeder Schicht nur den Kern (1 bis 7) und die k letzten Schichten wiederholen
//                   (Standard: alle; ab etwa 20 Schichten dauert ein Lauf sonst über zwei Stunden)
//   --seed s / --gelaende n / --stegbild n   Ausgangslage (werden an die Adresse gehängt)
//   --web web       Ordner mit dem Spiel (Standard web/ im Repo); für lange Läufe eine Kopie nehmen
//   --out dir       Ausgabeordner: bilder/, ergebnis-<gerät>.json, bericht-<gerät>.md

const fs = require('fs');
const path = require('path');
const http = require('http');
const { HILFEN, spieler } = require('./spieler.cjs');
const SCHICHTEN = [...require('./schichten.cjs').SCHICHTEN, ...require('./ausbau.cjs').SCHICHTEN, ...require('./ausbau2.cjs').SCHICHTEN];

const REPO = path.resolve(__dirname, '..', '..');
const argv = process.argv.slice(2);
const opt = (name, dflt) => { const i = argv.indexOf('--' + name); return i >= 0 ? argv[i + 1] : dflt; };
const GERAET = opt('geraet', 'pc');
const BIS = Number(opt('bis', SCHICHTEN.length));
const WIEDER = opt('wieder') != null ? Number(opt('wieder')) : Infinity;
const NUR = opt('nur') ? opt('nur').split(',').map(Number) : null;
const WEB = path.resolve(opt('web', path.join(REPO, 'web')));
const OUT = path.resolve(opt('out', path.join(require('os').tmpdir(), 'schichttest')));
const EXTRA = ['seed', 'gelaende', 'stegbild'].filter((k) => opt(k) != null).map((k) => `${k}=${opt(k)}`);

function ladePlaywright() {
  for (const p of [path.join(REPO, 'tests', 'node_modules', '@playwright', 'test'), 'playwright', '@playwright/test']) {
    try { return require(p); } catch { /* nächster */ }
  }
  throw new Error('Playwright fehlt: cd tests && npm ci');
}
const { chromium, devices } = ladePlaywright();

const GERAETE = {
  pc: { viewport: { width: 1440, height: 900 } },
  handy: { ...devices['Pixel 7'] },
  handyquer: { ...devices['Pixel 7 landscape'] },
  tablet: { ...devices['Galaxy Tab S4'] },
  tabletquer: { ...devices['Galaxy Tab S4 landscape'] },
};
if (!GERAETE[GERAET]) throw new Error(`Unbekanntes Gerät ${GERAET}, möglich: ${Object.keys(GERAETE).join(', ')}`);

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.txt': 'text/plain' };
function serve(root) {
  return new Promise((res) => {
    const s = http.createServer((q, r) => {
      let p = decodeURIComponent(q.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const f = path.join(root, p);
      if (!f.startsWith(root)) { r.writeHead(403); r.end(); return; }
      fs.readFile(f, (e, d) => {
        if (e) { r.writeHead(404); r.end(); return; }
        r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
        r.end(d);
      });
    }).listen(0, () => res({ s, url: `http://localhost:${s.address().port}/` }));
  });
}

(async () => {
  fs.mkdirSync(path.join(OUT, 'bilder'), { recursive: true });
  const { s, url } = await serve(WEB);
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const geraet = GERAETE[GERAET];
  const touch = !!geraet.hasTouch;
  const ctx = await browser.newContext({ ...geraet, deviceScaleFactor: 1, serviceWorkers: 'block', locale: 'de-DE' });
  const page = await ctx.newPage();

  const R = { geraet: GERAET, start: new Date().toISOString(), commit: null, adresse: null, ausgangslage: null,
    schichten: [], punkte: [], funde: [], fehler: [], bilder: [] };
  try { R.commit = fs.readFileSync(path.join(WEB, 'version.txt'), 'utf8').trim(); } catch { /* lokal */ }
  try { R.commit ||= require('child_process').execSync('git rev-parse --short HEAD', { cwd: REPO }).toString().trim(); } catch { /* egal */ }

  let aktuell = 'Start';
  page.on('console', (m) => { if (m.type() === 'error') R.fehler.push({ schicht: aktuell, text: m.text().slice(0, 400) }); });
  page.on('pageerror', (e) => R.fehler.push({ schicht: aktuell, text: 'Skriptfehler: ' + String(e.message).slice(0, 400),
    stack: String(e.stack || '').split('\n').slice(1, 4).map((z) => z.trim().replace(/https?:\/\/localhost:\d+\//, '')).join(' < ') }));
  page.on('response', (r) => { if (r.status() >= 400) R.fehler.push({ schicht: aktuell, text: `HTTP ${r.status()} ${r.url().replace(url, '')}` }); });

  let bildNr = 0;
  const t = {
    page, url, touch, geraet: GERAET, R, extra: EXTRA,
    sp: spieler(page, touch),
    adresse: (q = []) => url + (q.concat(EXTRA).length ? '?' + q.concat(EXTRA).join('&') : ''),
    async hilfen() { await page.evaluate(`(${HILFEN})()`); },
    G: (fn, arg) => page.evaluate(fn, arg),
    warte: (ms) => page.waitForTimeout(ms),
    // Prüfpunkt festhalten. ok=false ist ein Fund (mit Bild).
    async punkt(name, ok, detail = '', { bild = !ok, schwere = 'B' } = {}) {
      const p = { schicht: aktuell, name, ok: !!ok, detail: String(detail ?? '') };
      if (bild) p.bild = await t.bild(`${aktuell}-${name}`.replace(/[^a-z0-9äöüß]+/gi, '-').toLowerCase().slice(0, 70));
      R.punkte.push(p);
      if (!ok) R.funde.push({ ...p, schwere });
      console.log(`  ${ok ? 'ok  ' : 'FUND'} ${name}${detail ? ': ' + p.detail : ''}`);
      return !!ok;
    },
    async hinweis(name, detail, { bild = true } = {}) {
      const p = { schicht: aktuell, name, ok: true, hinweis: true, detail: String(detail ?? '') };
      if (bild) p.bild = await t.bild(`${aktuell}-${name}`.replace(/[^a-z0-9äöüß]+/gi, '-').toLowerCase().slice(0, 70));
      R.punkte.push(p);
      console.log(`  info ${name}: ${p.detail}`);
    },
    async bild(name) {
      bildNr++;
      const datei = `bilder/${GERAET}-${String(bildNr).padStart(3, '0')}-${name}.jpg`;
      try { await page.screenshot({ path: path.join(OUT, datei), type: 'jpeg', quality: 70, timeout: 60_000 }); } catch (e) { return null; }
      R.bilder.push(datei);
      return datei;
    },
    // Auf Spielzeit warten (Sekunden Spielzeit), höchstens maxMs Echtzeit
    async spielzeit(sek, maxMs = 120_000) {
      const t0 = await page.evaluate(() => window.hafenmeister.time);
      await page.waitForFunction((z) => window.hafenmeister.time >= z, t0 + sek, { timeout: maxMs, polling: 100 }).catch(() => {});
    },
    // Warten, bis fn(arg) im Browser wahr ist; liefert true/false statt zu werfen
    async bis(fn, arg, maxMs = 60_000) {
      return page.waitForFunction(fn, arg, { timeout: maxMs, polling: 150 }).then(() => true, () => false);
    },
    async kameraRuhig() { await t.bis(() => window.__st.kameraRuhig(), null, 10_000); await t.warte(150); },
  };

  const laufListe = SCHICHTEN.filter((x) => (NUR ? NUR.includes(x.nr) : x.nr <= BIS));
  const zustand = {};   // geteilt zwischen den Schichten (z. B. welches Boot schon liegt)
  const t0 = Date.now();
  for (const schicht of laufListe) {
    aktuell = `S${schicht.nr}`;
    console.log(`Schicht ${schicht.nr}: ${schicht.name}`);
    const vorher = { punkte: R.punkte.length, funde: R.funde.length, fehler: R.fehler.length };
    const ts = Date.now();
    try {
      await schicht.neu(t, zustand);
      // Alle bisherigen Schichten noch einmal (Wechselwirkungen), außer bei --nur
      if (!NUR) {
        const frueher = laufListe.filter((x) => x.nr < schicht.nr && x.wieder);
        const spaeter = frueher.filter((x) => x.nr > 7).slice(-WIEDER);
        for (const alt of frueher.filter((x) => x.nr <= 7 || spaeter.includes(x))) {
          aktuell = `S${schicht.nr}/S${alt.nr}`;
          console.log(` wieder Schicht ${alt.nr}: ${alt.name}`);
          await alt.wieder(t, zustand);
        }
      }
    } catch (e) {
      R.funde.push({ schicht: aktuell, name: 'Testlauf abgebrochen', ok: false, detail: String(e.message).split('\n').filter((z) => z.trim()).slice(0, 6).join(' | ').slice(0, 600), schwere: 'A', bild: await t.bild(`${aktuell.replace(/\//g, "-")}-abbruch`) });
      console.log(`  ABBRUCH ${e.message.split('\n')[0]}`);
    }
    aktuell = `S${schicht.nr}`;
    R.schichten.push({ nr: schicht.nr, name: schicht.name, paket: schicht.paket, sekunden: Math.round((Date.now() - ts) / 1000),
      punkte: R.punkte.length - vorher.punkte, funde: R.funde.length - vorher.funde, fehler: R.fehler.length - vorher.fehler });
    if (R.funde.slice(vorher.funde).some((f) => f.schwere === 'A')) { console.log('  Schicht nicht stabil, Lauf endet hier.'); break; }
  }
  if (t.sp.rueckfaelle) await t.hinweis('Knopf mit Rückfall gedrückt', `${t.sp.rueckfaelle}x reagierte ein ruhiger, sichtbarer Knopf nicht auf Playwright; Tippen in die Mitte half`, { bild: false });
  if (t.sp.nachgefasst) await t.hinweis('Knopf erst beim zweiten Versuch gedrückt', `${t.sp.nachgefasst}x war ein Knopf kurz verdeckt (Übergang) und ging nach 0,8 s`, { bild: false });
  R.dauerMin = +((Date.now() - t0) / 60000).toFixed(1);
  await t.sp.ende();
  fs.writeFileSync(path.join(OUT, `ergebnis-${GERAET}.json`), JSON.stringify(R, null, 1));
  fs.writeFileSync(path.join(OUT, `bericht-${GERAET}.md`), require('./bericht.cjs').bericht(R));
  console.log(`${GERAET}: ${R.schichten.length} Schichten, ${R.punkte.length} Prüfpunkte, ${R.funde.length} Funde, ${R.fehler.length} Konsolenfehler, ${R.dauerMin} min`);
  await browser.close(); s.close();
})().catch((e) => { console.error(e); process.exit(1); });
