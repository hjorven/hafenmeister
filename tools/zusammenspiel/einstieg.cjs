// Zusammenspiel Oberfläche (P85 Teil 2): ein frisches Spiel ohne Testadresse, Einstieg Schritt für Schritt
// spielen und je Schritt ein Bild machen. Prüft dabei Verdeckung von Zeit, Bauen und Status durch die Blase.
// Server vorher: bash tools/build-pages.sh && (cd tests && node server.mjs 4180)
// Aufruf: node tools/zusammenspiel/einstieg.cjs <ordner> [geraet]
const { browser, open } = require('../verdeckung/helfer.cjs');
const fs = require('fs');
const OUT = process.argv[2] || 'einstieg';
const GER = process.argv[3] || 'handy';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const b = await browser();
  const { page, log } = await open(b, GER, '?seed=7', 2);
  const gesehen = new Set();
  const t0 = Date.now();
  // Schritte treiben: wartendes Boot einfahren lassen, Münzen kassieren, Bauen öffnen und schließen
  while (Date.now() - t0 < 240000) {
    const s = await page.evaluate(() => {
      const g = window.hafenmeister;
      const tipp = [...document.querySelectorAll('.hm-tipp')].find((e) => !e.hidden && e.checkVisibility());
      const r = tipp?.getBoundingClientRect();
      // was liegt unter der Blase?
      const unter = [];
      if (r) for (const id of ['hm-zeit', 'btn-build', 'btn-collect', 'money', 'rep', 'btn-menu']) {
        const e = document.getElementById(id); if (!e || !e.checkVisibility()) continue;
        const q = e.getBoundingClientRect();
        if (q.left < r.right && q.right > r.left && q.top < r.bottom && q.bottom > r.top) unter.push(id);
      }
      return { schritt: g.einstieg.schritt(), text: tipp?.textContent.trim().slice(0, 140) ?? '', unter, wartend: g.sim.waitingBoats().length };
    });
    const key = `${s.schritt}|${s.text.slice(0, 40)}`;
    if (s.text && !gesehen.has(key)) {
      gesehen.add(key);
      const n = String(gesehen.size).padStart(2, '0');
      await page.screenshot({ path: `${OUT}/${GER}-einstieg-${n}.png` });
      console.log(`${n} Schritt ${s.schritt}: ${s.text}${s.unter.length ? `  [Blase überdeckt: ${s.unter.join(', ')}]` : ''}`);
    }
    if (s.schritt === null && gesehen.size > 2) break;
    await page.evaluate(() => {
      const g = window.hafenmeister;
      const w = g.sim.waitingBoats()[0];
      if (w && g.einstieg.schritt() >= 1) g.sim.autoEnter(w.id);
      document.querySelector('.hm-tipp .weiter')?.click();
      const c = document.getElementById('btn-collect'); if (c?.checkVisibility()) c.click();
      for (const m of g.sim.state.boats ?? []) if (m.pendingFee > 0) g.sim.collect(m.id);
    }).catch(() => {});
    if (s.text.includes('Bauen')) { await page.evaluate(() => { document.getElementById('btn-build')?.click(); }); await page.waitForTimeout(800); await page.evaluate(() => { document.querySelector('.bau-zu, #card .hm-zu')?.click(); }); }
    await page.waitForTimeout(1500);
  }
  if (log.length) console.log(log.slice(0, 5).join('\n'));
  await b.close();
})();
