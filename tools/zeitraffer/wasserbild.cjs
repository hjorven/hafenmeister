#!/usr/bin/env node
// Wasserbild: vergleicht, was das Spiel für Wasser hält (game.landschaft.istWasser, rechnet die
// Geländeformel punkt() an jeder Stelle genau aus), mit dem, was der Spieler sieht (das gezeichnete
// Geländenetz aus terrain.js, ein Raster mit 2 bis 3 m Abstand, über dem die Wasserfläche liegt).
// Zeitraffer und Härtetest melden "Boot über Land" nach istWasser; weichen beide ab, sind das
// Fehlalarme oder übersehene Funde. Messlatte-Hinweis: "am Durchstich zeigt das Bild Wasser, istWasser
// sagt Land" (Roadmap P87).
//
// Aufruf (im Hauptordner, einmal vorher: cd tests && npm ci && cd ..):
//   node tools/zeitraffer/wasserbild.cjs [--kuesten 1-15] [--stufen 3-6] [--seed n] [--schritt 1] [--web web]
//
// Ausgabe je Küste und Stufe: Anteil der Proben, an denen beide uneins sind, getrennt nach
// "Bild Wasser, istWasser Land" und umgekehrt, für den Durchstich und den ganzen Hafenbereich,
// und die größte Abweichung in Metern Abstand zur nächsten Probe, in der beide einig sind.
// Exit-Code 1, wenn eine Stelle mit mehr als --grenze Metern (Standard 3, etwa eine Rasterzelle des Netzes) Abstand zur Uferlinie
// strittig ist: nahe am Ufer ist Abweichung durch das Raster normal, weiter weg ist es ein Fehler.

const path = require('path');
const { serve, ladePlaywright } = require('./lauf.cjs');
const { BILDWASSER } = require('./bildwasser.cjs');

const REPO = path.resolve(__dirname, '..', '..');
const argv = process.argv.slice(2);
const opt = (name, dflt) => { const i = argv.indexOf('--' + name); return i >= 0 ? argv[i + 1] : dflt; };
const bereich = (s) => { const [a, b] = String(s).split('-').map(Number); return Array.from({ length: (b ?? a) - a + 1 }, (_, i) => a + i); };
const KUESTEN = bereich(opt('kuesten', '1-15'));
const STUFEN = bereich(opt('stufen', '3-6'));
const SEED = opt('seed', null);
const SCHRITT = Number(opt('schritt', 1));
const GRENZE = Number(opt('grenze', 3));
const WEB = path.resolve(opt('web', path.join(REPO, 'web')));

// Im Browser: Proben über Hafenbereich und Durchstich. Meter in Weltkoordinaten (x Ost, z = -Plan-y).
const MISS = ({ schritt: schritt0, grenze }) => {
  const L = window.hafenmeister.landschaft;
  if (window.__bildWasser?.(0, 0) == null) return { fehler: 'kein Geländenetz gefunden' };
  const bild = window.__bildWasser;
  const U = 0.62;
  const flaechen = {
    durchstich: { x0: 140 * U, x1: 216 * U, z0: -240 * U, z1: -176 * U },
    hafen: { x0: -170 * U, x1: 230 * U, z0: -320 * U, z1: 60 * U },
    // Pflicht-See vor der Einfahrt (natur.js SEE_NORD), dort fahren alle Boote ein und aus; grober
    see: { x0: -400 * U, x1: 440 * U, z0: -600 * U, z1: -245 * U, schritt: 3 },
  };
  const out = {};
  for (const [name, f] of Object.entries(flaechen)) {
    const schritt = Math.max(f.schritt ?? 0, schritt0);
    const nx = Math.ceil((f.x1 - f.x0) / schritt) + 1, nz = Math.ceil((f.z1 - f.z0) / schritt) + 1;
    const A = new Uint8Array(nx * nz), B = new Uint8Array(nx * nz);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const x = f.x0 + i * schritt, z = f.z0 + j * schritt;
      A[j * nx + i] = L.istWasser(x, z) ? 1 : 0;
      B[j * nx + i] = bild(x, z) ? 1 : 0;
    }
    // Abstand jeder strittigen Probe zur gezeichneten Uferlinie: in 16 Richtungen nach außen suchen, bis
    // das Bild die andere Seite zeigt. Nahe am Ufer ist Abweichung durch das Raster normal.
    const r = { n: nx * nz, bildWasserRechnungLand: 0, bildLandRechnungWasser: 0, weit: [], max: 0 };
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i; if (A[k] === B[k]) continue;
      if (B[k]) r.bildWasserRechnungLand++; else r.bildLandRechnungWasser++;
      const x = f.x0 + i * schritt, z = f.z0 + j * schritt;
      let d = Infinity;
      for (let s = 0.25; s <= 20 && d === Infinity; s += 0.25) {
        for (let w = 0; w < 16; w++) if (bild(x + s * Math.cos(w * Math.PI / 8), z + s * Math.sin(w * Math.PI / 8)) !== !!B[k]) { d = s; break; }
      }
      if (d > r.max) r.max = d;
      if (d > grenze) r.weit.push({ x: +x.toFixed(1), z: +z.toFixed(1), d: d === Infinity ? '>20' : d, bild: B[k] ? 'Wasser' : 'Land' });
    }
    r.weit = r.weit.slice(0, 8).concat(r.weit.length > 8 ? [{ weitere: r.weit.length - 8 }] : []);
    out[name] = r;
  }
  return out;
};

(async () => {
  const { chromium } = ladePlaywright();
  const { s, url } = await serve(WEB);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await page.addInitScript(BILDWASSER);
  let schlecht = 0;
  console.log('| Küste | Stufe | Fläche | Proben | Bild Wasser, Rechnung Land | Bild Land, Rechnung Wasser | größter Abstand zum Ufer (m) |');
  console.log('|---|---|---|---|---|---|---|');
  for (const g of KUESTEN) for (const st of STUFEN) {
    const seed = SEED ?? g * 13 + 1;
    await page.goto(`${url}?stufe=${st}&gelaende=${g}&seed=${seed}&testtempo=0.001`);
    await page.waitForFunction(() => window.hafenmeister?.landschaft?.istWasser && window.hafenmeister.scene?.getObjectByName('gelaende-innen'), null, { timeout: 60_000 });
    const r = await page.evaluate(MISS, { schritt: SCHRITT, grenze: GRENZE });
    if (r.fehler) { console.log(`| ${g} | ${st} | - | ${r.fehler} |`); schlecht++; continue; }
    for (const [name, x] of Object.entries(r)) {
      const pz = (n) => `${n} (${(100 * n / x.n).toFixed(2)} %)`;
      console.log(`| ${g} | ${st} | ${name} | ${x.n} | ${pz(x.bildWasserRechnungLand)} | ${pz(x.bildLandRechnungWasser)} | ${x.max === Infinity ? '>6' : x.max.toFixed(1)} |`);
      if (x.max > GRENZE) { schlecht++; console.log(`  weit vom Ufer strittig: ${JSON.stringify(x.weit)}`); }
    }
  }
  await browser.close(); s.close();
  console.log(schlecht ? `\n${schlecht} Flächen mit Abweichung weiter als ${GRENZE} m vom gezeichneten Ufer.` : '\nBild und istWasser stimmen überall bis auf den Rasterrand überein.');
  process.exit(schlecht ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
