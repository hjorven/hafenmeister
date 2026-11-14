// Verdeckung messen (docs/ui/verdeckung.md). Server vorher: bash tools/build-pages.sh && (cd tests && node server.mjs 4180)
// Aufruf: node tools/verdeckung/messen.cjs <ordner> [geraete] [szenarien]
// Misst je Gerät und Menü den verdeckten Anteil der Spielfläche.
// node messen.cjs <ausgabeordner> [geraete,kommagetrennt] [szenarien]
const { browser, open, verdeckt, GERAETE } = require('./helfer.cjs');
const fs = require('fs');
const OUT = process.argv[2] || 'vorher';
const GER = (process.argv[3] || Object.keys(GERAETE).join(',')).split(',');
const NUR = process.argv[4] ? process.argv[4].split(',') : null;
fs.mkdirSync(OUT, { recursive: true });

const klick = (sel) => `document.querySelector('${sel}')?.click()`;
const boot = `(async () => { const g = window.hafenmeister; g.speed = 8;
  for (let i = 0; i < 300 && !g.sim.waitingBoats().length; i++) await new Promise(r => setTimeout(r, 100));
  g.speed = 0; const b = g.sim.waitingBoats()[0]; if (b) g.sim.select(b.id); })()`;
const S = {
  'grund': [],
  'dauer-hinweis': ['HINWEIS'],
  'tagesziel-wahl': ['window.hafenmeister.tagesziele.oeffnen()'],
  'tagesziel-laufend': ['window.hafenmeister.tagesziele.waehle(0)', klick('.hm-tafel > button')],
  'stufenziel': [klick('#hm-ziel > button')],
  'wetter': [klick('#weather-chip')],
  'menue': [klick('#btn-menu')],
  'einstellungen': [klick('#btn-menu'), klick('#btn-einstellungen')],
  'spielstand': [klick('#btn-menu'), klick('#btn-save')],
  'hilfe': ['window.hafenmeister.hilfe.oeffnen()'],
  'tastenhilfe': [klick('#btn-menu'), klick('#btn-help')],
  'gaestebuch': ['window.hafenmeister.gaestebuch.oeffnen()'],
  'tagesabschluss': ['window.hafenmeister.tagesabschluss.zeige()'],
  'bauen': ['window.hafenmeister.bauen.oeffnen()'],
  'bootskarte': [boot],
  'aufstieg': ['window.hafenmeister.aufstieg.zeigeStufe(4)'],
  'winter': ['window.hafenmeister.winter.oeffnen()'],
  'kombi-wahl+boot': [boot, 'window.hafenmeister.tagesziele.oeffnen()'],
  'kombi-ziel+boot': ['window.hafenmeister.tagesziele.waehle(0)', klick('.hm-tafel > button'), boot],
  'kombi-stufe+boot': [boot, klick('#hm-ziel > button')],
  'kombi-bauen+ziel': ['window.hafenmeister.tagesziele.waehle(0)', klick('.hm-tafel > button'), 'window.hafenmeister.bauen.oeffnen()'],
};
const QUERY = '?stufe=3&seed=7';
(async () => {
  const b = await browser();
  const erg = {};
  await Promise.all(GER.map(async (ger) => {
    erg[ger] = {};
    for (const [name, schritte] of Object.entries(S)) {
      if (NUR && !NUR.includes(name)) continue;
      let o;
      try {
        o = await open(b, ger, QUERY);
        const { page } = o;
        await page.evaluate(() => { window.hafenmeister.speed = 0; });
        if (!schritte.includes('HINWEIS')) await page.addStyleTag({ content: '#dauer-hinweis{display:none!important}' });
        for (const s of schritte) { if (s !== 'HINWEIS') { await page.evaluate(s); await page.waitForTimeout(350); } }
        await page.waitForTimeout(500);
        const m = await verdeckt(page);
        erg[ger][name] = m;
        await page.screenshot({ path: `${OUT}/${ger}-${name}.png` });
        if (o.log.length) erg[ger][name].log = o.log.slice(0, 5);
        process.stderr.write(`${ger} ${name} ${m.prozent}\n`);
      } catch (e) { erg[ger][name] = { fehler: String(e).slice(0, 200) }; process.stderr.write(`${ger} ${name} FEHLER ${e}\n`); }
      finally { await o?.ctx.close(); }
    }
  }));
  fs.writeFileSync(`${OUT}/messung.json`, JSON.stringify(erg, null, 1));
  await b.close();
})();
