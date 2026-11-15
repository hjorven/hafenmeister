// Großschiffwege an allen Küsten (Paket P84): Fährt jedes Besuchsschiff der Services (Kreuzfahrtschiff,
// Korvette, Minenjagdboot, Traditionssegler, Ausflugsschiff) im Spiel auf jeder Küste und mehreren Seeds
// einmal ein und aus, genau mit dem Kurs, den render/services-besuch.js fährt (Drehen mit Verzögerung),
// und prüft den ganzen Rumpf gegen Land (istWasser wie der Härtetest) und gegen zu flaches Wasser.
//
// Aufruf im Repo-Ordner:
//   node tools/grossschiffe/pruefen.cjs [--kuesten 1-15] [--seeds 1,2,3] [--stufe 6] [--json DATEI]
// Ende "0 Funde." heißt: kein Rumpfpunkt auf Land.
const path = require('node:path');
const fs = require('node:fs');
const { serve, ladePlaywrightOhneLauf } = (() => {
  // lauf.cjs exportiert serve, startet beim require aber keinen Lauf
  const z = require('../zeitraffer/lauf.cjs');
  return { serve: z.serve, ladePlaywrightOhneLauf: () => z.ladePlaywright?.() ?? require('playwright') };
})();

const REPO = path.resolve(__dirname, '..', '..');
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const liste = (s) => s.split(',').flatMap((t) => { const [a, b] = t.split('-').map(Number); return b ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : [a]; });
const KUESTEN = liste(opt('kuesten', '1-15'));
const SEEDS = liste(opt('seeds', '1,2,3'));
const STUFE = Number(opt('stufe', 6));

// Läuft im Browser: alle Fahrten abfahren und den Rumpf prüfen
const FAHREN = () => {
  const G = window.hafenmeister;
  const wasser = (x, z) => (G.landschaft?.istWasser ? G.landschaft.istWasser(x, z) : true);
  const tiefe = (x, z) => G.landscape?.tiefeBei?.(x, z) ?? 99;
  // Rumpf als Rechteck (Länge x Breite) bei 90 %, Punkte alle rund 4 m
  const rumpf = (p, kurs, l, b) => {
    const fx = Math.cos(kurs), fz = -Math.sin(kurs), sx = -fz, sz = fx;
    const L = l * 0.9, B = b * 0.9, nl = Math.max(2, Math.ceil(L / 4)), nb = Math.max(1, Math.ceil(B / 4)), out = [];
    for (let i = 0; i <= nl; i++) for (let j = 0; j <= nb; j++) {
      const u = (i / nl - 0.5) * L, v = (j / nb - 0.5) * B;
      out.push({ x: p.x + fx * u + sx * v, z: p.z + fz * u + sz * v });
    }
    return out;
  };
  const funde = [];
  const fahrten = G.besuchsPosen(0.1);
  for (const f of fahrten) {
    let schlimmst = null;
    for (const q of f.posen) {
      const pts = rumpf(q, q.kurs, f.l, f.b);
      const land = pts.filter((r) => !wasser(r.x, r.z)).length;
      if (land && (!schlimmst || land > schlimmst.land)) schlimmst = { art: q.art, land, von: pts.length, x: Math.round(q.x), z: Math.round(q.z), kurs: Math.round(q.kurs * 180 / Math.PI) };
    }
    // Wo verschwindet das Schiff? Endpunkt des Wegs nach See muss ausserhalb des Spielbereichs liegen
    const e = f.weg[f.weg.length - 1], r = G.gelaende.spielRect();
    const imSpiel = e.x > r.minX && e.x < r.maxX && e.z > r.minZ && e.z < r.maxZ;
    if (imSpiel) funde.push({ id: f.id, modell: f.modell, art: 'endet im Spielbereich', land: 0, von: 0, x: Math.round(e.x), z: Math.round(e.z) });
    if (schlimmst) funde.push({ id: f.id, modell: f.modell, l: Math.round(f.l), b: Math.round(f.b), ...schlimmst });
    if (schlimmst && window.__bild) {
      // Bild: Land grau, Wasser blau, tief dunkel; Weg rot, Rumpf an der schlimmsten Stelle gelb
      const c = document.createElement('canvas'); const R = window.__bildR ?? 500, S = R / 250; c.width = c.height = 2 * R / S;
      const g = c.getContext('2d');
      for (let i = 0; i < c.width; i++) for (let j = 0; j < c.height; j++) {
        const x = schlimmst.x - R + i * S, z = schlimmst.z - R + j * S;
        g.fillStyle = !wasser(x, z) ? '#887' : tiefe(x, z) > 6 ? '#136' : tiefe(x, z) > 3 ? '#259' : '#7ad';
        g.fillRect(i, j, 1, 1);
      }
      const P = (p) => [(p.x - schlimmst.x + R) / S, (p.z - schlimmst.z + R) / S];
      for (const [w, col] of [[f.weg, '#f00'], [f.ankunft, '#f0f']]) { g.strokeStyle = col; g.beginPath(); w.forEach((p, i) => g[i ? 'lineTo' : 'moveTo'](...P(p))); g.stroke(); w.forEach((p) => { g.fillStyle = col; g.fillRect(P(p)[0] - 1, P(p)[1] - 1, 3, 3); }); }
      g.fillStyle = '#ff0'; for (const q of rumpf({ x: schlimmst.x, z: schlimmst.z }, schlimmst.kurs * Math.PI / 180, f.l, f.b)) g.fillRect(...P(q), 1.5, 1.5);
      const k = G.fahrwasser.karte; g.strokeStyle = '#0f0'; g.strokeRect(...P({ x: k.x0, z: k.z0 }), (k.x1 - k.x0) / S, (k.z1 - k.z0) / S);
      (window.__bilder ||= []).push({ name: f.modell + '-' + schlimmst.art, url: c.toDataURL() });
    }
  }
  return { anzahl: fahrten.length, funde, bilder: window.__bilder ?? [] };
};

(async () => {
  const { chromium } = ladePlaywrightOhneLauf();
  const { s, url } = await serve(path.join(REPO, 'web'));
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const alle = [];
  try {
    for (const k of KUESTEN) for (const seed of SEEDS) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
      const page = await ctx.newPage();
      const fehler = [];
      page.on('pageerror', (e) => fehler.push(String(e.message)));
      await page.goto(`${url}?stufe=${STUFE}&services=alle&gelaende=${k}&seed=${seed}&testtempo=0.001`);
      await page.waitForFunction(() => window.hafenmeister?.besuchsPosen && window.hafenmeister?.fahrwasser?.karte && window.hafenmeister?.landschaft?.istWasser, null, { timeout: 120000 });
      await page.waitForTimeout(500);
      if (opt('bilder')) await page.evaluate((r) => { window.__bild = true; window.__bildR = r; }, Number(opt('bildR', 500)));
      const erg = await page.evaluate(FAHREN);
      for (const b of erg.bilder) { fs.mkdirSync(opt('bilder'), { recursive: true }); fs.writeFileSync(path.join(opt('bilder'), `k${k}-s${seed}-${b.name.replace(/:/g, '')}.png`), Buffer.from(b.url.split(',')[1], 'base64')); }
      for (const f of erg.funde) alle.push({ kueste: k, seed, ...f });
      const z = erg.funde.length ? erg.funde.map((f) => `${f.modell} ${f.art} ${f.land}/${f.von} bei ${f.x}/${f.z}`).join('; ') : 'frei';
      console.log(`Küste ${String(k).padStart(2)} Seed ${seed}: ${erg.anzahl} Schiffe, ${z}${fehler.length ? ' FEHLER ' + fehler[0] : ''}`);
      await ctx.close();
    }
  } finally {
    await browser.close(); s.close();
  }
  if (opt('json')) fs.writeFileSync(opt('json'), JSON.stringify(alle, null, 1));
  console.log(alle.length ? `${alle.length} Funde.` : '0 Funde.');
  process.exitCode = alle.length ? 1 : 0;
})();
