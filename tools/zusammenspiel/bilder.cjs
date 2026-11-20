// Zusammenspiel Oberfläche (P85 Teil 2): je Gerät dieselben sieben Lagen als Bild, für docs/zusammenspiel.md.
// Server vorher: bash tools/build-pages.sh && (cd tests && node server.mjs 4180)
// Aufruf: node tools/zusammenspiel/bilder.cjs <ordner> [geraete]
const { browser, open, verdeckt, GERAETE } = require('../verdeckung/helfer.cjs');
const fs = require('fs');
const OUT = process.argv[2] || 'bilder';
const GER = (process.argv[3] || Object.keys(GERAETE).join(',')).split(',');
fs.mkdirSync(OUT, { recursive: true });
const LAGEN = {
  grund: [],
  menue: ["document.getElementById('btn-menu').click()"],
  bauen: ["document.getElementById('btn-build').click()"],
  logbuch: ['window.hafenmeister.logbuch.oeffnen()'],
  hilfe: ['window.hafenmeister.hilfe.oeffnen()'],
  einstellungen: ["document.getElementById('btn-menu').click()", "document.getElementById('btn-einstellungen').click()"],
  tagesziel: ['window.hafenmeister.tagesziele.oeffnen()'],
};
(async () => {
  const b = await browser();
  const zeilen = [];
  for (const ger of GER) {
    for (const [name, schritte] of Object.entries(LAGEN)) {
      const o = await open(b, ger, '?stufe=3&seed=7', 2);
      await o.page.evaluate(() => { window.hafenmeister.speed = 0; });
      await o.page.addStyleTag({ content: '#dauer-hinweis{display:none!important}' });
      for (const s of schritte) { await o.page.evaluate(s); await o.page.waitForTimeout(500); }
      await o.page.waitForTimeout(700);
      const m = await verdeckt(o.page);
      await o.page.screenshot({ path: `${OUT}/${ger}-${name}.png` });
      zeilen.push(`${ger}\t${name}\t${m.prozent}`);
      process.stderr.write(`${ger} ${name} ${m.prozent} %\n`);
      await o.ctx.close();
    }
  }
  fs.writeFileSync(`${OUT}/verdeckung.tsv`, zeilen.join('\n') + '\n');
  await b.close();
})();
