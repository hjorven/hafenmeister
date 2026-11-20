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
  // Stege, Pier, Molen und Liegeplätze aus der Fahrwasserkarte (sperre), ohne die Liegewannen der
  // Großschiffe selbst (GROSSE_GAESTE, dort liegen sie ja)
  const k = G.fahrwasser.karte;
  // Liegewannen (data/verkehr.js GROSSE_GAESTE): die eigene zählt nicht, eine fremde ist ein Fund
  // (dort liegt gerade vielleicht ein anderes Großschiff, z. B. die Traditionssegler vor Anker)
  const GG = [['kreuzfahrtschiff', -146, -98, 234, 527], ['marine', -336, -284, 224, 372], ['xl', -202, -188, 270, 474]].map(([w, x0, x1, y0, y1]) => ({ w, x0: x0 * 0.62 - 2, x1: x1 * 0.62 + 2, z0: -y1 * 0.62 - 2, z1: -y0 * 0.62 + 2 }));
  const wem = (m) => (m === 'korvette' || m === 'minenjagdboot' ? 'marine' : m.startsWith('xl') ? 'xl' : m);
  let modellJetzt = '';
  const steg = (x, z) => {
    const r = GG.find((q) => x > q.x0 && x < q.x1 && z > q.z0 && z < q.z1);
    if (r) return r.w !== wem(modellJetzt) ? 'Wanne ' + r.w : '';
    const i = Math.floor((x - k.x0) / k.zelle), j = Math.floor((z - k.z0) / k.zelle);
    if (!(i >= 0 && j >= 0 && i < k.nx && j < k.nz && k.sperre[j * k.nx + i])) return '';
    // welches Hindernis: nächstes Platzrechteck oder Steglinie
    const H = G.boatView?.hindernisse?.() ?? { rechtecke: [], linien: [] };
    let best = 'Steg', bd = 1e9;
    for (const q of H.rechtecke) { const rx = x - q.x, rz = z - q.z, hx = Math.cos(q.h), hz = -Math.sin(q.h); const d = Math.hypot(Math.max(0, Math.abs(rx * hx + rz * hz) - q.l / 2), Math.max(0, Math.abs(-rx * hz + rz * hx) - q.b / 2)); if (d < bd) { bd = d; best = 'Platz ' + q.id; } }
    for (const l of H.linien) for (let n = 1; n < l.punkte.length; n++) { const a = l.punkte[n - 1], b = l.punkte[n], dx = b.x - a.x, dz = b.z - a.z, ll = dx * dx + dz * dz || 1; const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / ll)); const d = Math.hypot(x - a.x - t * dx, z - a.z - t * dz) - l.breite / 2; if (d < bd) { bd = d; best = 'Steg ' + (l.steg ?? 'Mole'); } }
    return best;
  };
  const wp = G.landscape?.warteplaetze ?? {};
  const bojen = [...(wp.bojen ?? []), ...(wp.ankerplaetze ?? [])].map((b) => ({ x: b.x, z: b.z }));
  const STEG = window.__stegFunde ||= [];
  for (const f of fahrten) {
    let schlimmst = null, stegMax = null, bojeMax = null;
    modellJetzt = f.modell;
    // Der eigene Liegeplatz (Rumpf am Ende der Einfahrt, 4 m Rand) zählt nicht als Steg-Berührung
    const lp = f.posen.filter((q) => q.art === 'rein').at(-1);
    const eigen = (x, z) => {
      if (!lp) return false;
      const dx = x - lp.x, dz = z - lp.z, fx = Math.cos(lp.kurs), fz = -Math.sin(lp.kurs);
      return Math.abs(dx * fx + dz * fz) < f.l / 2 + 4 && Math.abs(-dx * fz + dz * fx) < f.b / 2 + 4;
    };
    for (const q of f.posen) {
      const pts = rumpf(q, q.kurs, f.l, f.b);
      const land = pts.filter((r) => !wasser(r.x, r.z)).length;
      if (land && (!schlimmst || land > schlimmst.land)) schlimmst = { art: q.art, land, von: pts.length, x: Math.round(q.x), z: Math.round(q.z), kurs: Math.round(q.kurs * 180 / Math.PI) };
      const was = pts.map((r) => (wasser(r.x, r.z) && !eigen(r.x, r.z) ? steg(r.x, r.z) : '')).filter(Boolean);
      const st = was.length;
      if (st && (!stegMax || st > stegMax.n)) stegMax = { n: st, x: Math.round(q.x), z: Math.round(q.z), art: q.art, was: [...new Set(was)].join(', ') };
      const bj = bojen.filter((b) => pts.some((r) => Math.hypot(r.x - b.x, r.z - b.z) < 4)).length;
      if (bj && (!bojeMax || bj > bojeMax.n)) bojeMax = { n: bj, x: Math.round(q.x), z: Math.round(q.z), art: q.art };
    }
    if (stegMax) STEG.push(`${f.modell} ${stegMax.art}: ${stegMax.n} Rumpfpunkte auf ${stegMax.was} bei ${stegMax.x}/${stegMax.z}${f.verholt ? " (verholt, " + f.verholt + ")" : ""}`);
    if (bojeMax) STEG.push(`${f.modell} ${bojeMax.art}: über ${bojeMax.n} Boje/Ankerplatz bei ${bojeMax.x}/${bojeMax.z}`);
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
  return { anzahl: fahrten.length, funde, steg: window.__stegFunde ?? [], bilder: window.__bilder ?? [] };
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
      await page.waitForTimeout(Number(opt("warten", 3000)));
      if (opt('bilder')) await page.evaluate((r) => { window.__bild = true; window.__bildR = r; }, Number(opt('bildR', 500)));
      const erg = await page.evaluate(FAHREN);
      for (const b of erg.bilder) { fs.mkdirSync(opt('bilder'), { recursive: true }); fs.writeFileSync(path.join(opt('bilder'), `k${k}-s${seed}-${b.name.replace(/:/g, '')}.png`), Buffer.from(b.url.split(',')[1], 'base64')); }
      for (const f of erg.funde) alle.push({ kueste: k, seed, ...f });
      const z = erg.funde.length ? erg.funde.map((f) => `${f.modell} ${f.art} ${f.land}/${f.von} bei ${f.x}/${f.z}`).join('; ') : 'frei';
      console.log(`Küste ${String(k).padStart(2)} Seed ${seed}: ${erg.anzahl} Schiffe, ${z}${fehler.length ? ' FEHLER ' + fehler[0] : ''}`);
      for (const t of erg.steg) console.log('   Hinweis ' + t);
      await ctx.close();
    }
  } finally {
    await browser.close(); s.close();
  }
  if (opt('json')) fs.writeFileSync(opt('json'), JSON.stringify(alle, null, 1));
  console.log(alle.length ? `${alle.length} Funde.` : '0 Funde.');
  process.exitCode = alle.length ? 1 : 0;
})();
