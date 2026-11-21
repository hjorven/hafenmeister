// Zusammenspiel 3 (P85): Bildrate je Wetter und Tageszeit. Setzt das Wetter direkt ('weather' wie
// events/events.js es sendet) und zählt die Bilder über 6 s bei Tempo 1. Im Container rechnet die
// Grafik in Software (SwiftShader): Die Zahlen sagen wenig über echte Handys, der Vergleich zwischen den
// Lagen aber schon (docs/zeitraffer.md).
// Server vorher: bash tools/build-pages.sh && (cd tests && node server.mjs 4180)
//   node tools/zusammenspiel/bildrate.cjs [gerät] [stufe] [gelaende]
const { browser, open } = require('../verdeckung/helfer.cjs');
const [,, GER = 'handy', STUFE = '6', GEL = '2'] = process.argv;
const LAGEN = {
  'klar, Mittag': { wx: { sun: 0.9, wind: 0.2 } },
  'Regen': { wx: { sun: 0.2, rain: 1, wind: 0.5 } },
  'Nebel': { wx: { sun: 0.3, fog: 1, wind: 0.1, event: 'nebel' } },
  'Sturm': { wx: { sun: 0.1, rain: 0.8, wind: 1, event: 'sturm' } },
  'Schnee (Winter)': { wx: { sun: 0.4, snow: 1, wind: 0.3 } },
  'Abend': { wx: { sun: 0.8, wind: 0.2 }, uhrzeit: 19.5 },
  'Nacht': { wx: { sun: 0.8, wind: 0.2 }, uhrzeit: 23 },
};
(async () => {
  const b = await browser();
  console.log(`| Lage | Bilder je Sekunde (${GER}, Stufe ${STUFE}, Küste ${GEL}) |`);
  console.log('|---|---|');
  for (const [name, l] of Object.entries(LAGEN)) {
    const q = `?stufe=${STUFE}${STUFE === '6' ? '&services=alle' : ''}&gelaende=${GEL}&seed=1${l.uhrzeit ? `&uhrzeit=${l.uhrzeit}` : ''}`;
    const o = await open(b, GER, q, 1);
    const p = o.page;
    await p.addStyleTag({ content: '#dauer-hinweis{display:none!important}' });
    await p.evaluate((wx) => { const g = window.hafenmeister; g.einstieg?.beenden?.(); g.speed = 1; g.emit('weather', wx); }, l.wx);
    await p.waitForTimeout(3000);
    const fps = await p.evaluate(() => new Promise((ok) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 6000) requestAnimationFrame(f); else ok(n / ((performance.now() - t0) / 1000)); }; requestAnimationFrame(f); }));
    console.log(`| ${name} | ${fps.toFixed(1)} |`);
    if (o.log.length) console.log(`|   Fehler | ${o.log.slice(0, 2).join(' ')} |`);
    await o.ctx.close();
  }
  await b.close();
})();
