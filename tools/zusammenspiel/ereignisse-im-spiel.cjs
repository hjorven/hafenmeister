// Zusammenspiel 3 (P85): jedes Ereignis einmal im laufenden Spiel ankündigen, vorbereiten (wo es eine
// Karte gibt) und starten. Je Ereignis zwei Bilder (angekündigt, läuft), Wirkung auf die Regeln
// (game.events.modifiers()) und Fehler in der Konsole.
// Server vorher: bash tools/build-pages.sh && (cd tests && node server.mjs 4180)
//   node tools/zusammenspiel/ereignisse-im-spiel.cjs <ordner> [gerät] [gelaende]
const { browser, open } = require('../verdeckung/helfer.cjs');
const fs = require('fs');
const [,, OUT = 'ereignisse', GER = 'pc', GEL = '2'] = process.argv;
const IDS = ['nebel', 'sommertag', 'sturm', 'regatta', 'hafenfest', 'mittsommer', 'heringstage', 'holzboote', 'hansewoche'];
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await browser();
  const ergebnis = [];
  for (const id of IDS) {
    const o = await open(b, GER, `?stufe=6&services=alle&gelaende=${GEL}&seed=1`, 1);
    const p = o.page;
    await p.waitForFunction(() => !!window.hafenmeister?.sim && !!window.hafenmeister.events, null, { timeout: 20000 });
    await p.addStyleTag({ content: '#dauer-hinweis{display:none!important}' });
    const vor = await p.evaluate((id) => {
      const g = window.hafenmeister;
      g.einstieg?.beenden?.();
      g.speed = 0;
      const d = g.sim.state.day;
      const lang = id === 'hansewoche' ? 2 : 1;
      g.events.load({ ...g.events.save(), planned: { id, startDay: d + 1, endDay: d + lang, announcedDay: d }, current: null });
      g.emit('event:announce', { event: g.events.planned.event, day: d, startDay: d + 1, endDay: d + lang });
      return { d };
    }, id);
    await p.evaluate(() => document.querySelector('ul.tz-wahl button')?.click());
    await p.waitForTimeout(1500);
    const karte = await p.evaluate(() => { const k = document.getElementById('ev-vorbereiten'); return k && !k.hidden && k.getBoundingClientRect().width > 0 ? k.textContent.trim().slice(0, 200) : null; });
    await p.screenshot({ path: `${OUT}/${GER}-${id}-1-angekuendigt.jpg`, quality: 70 });
    let vorbereitet = null;
    if (karte) {
      const knopf = p.locator('#ev-vorbereiten button').filter({ hasNotText: /Schließen|Später|×/ }).first();
      if (await knopf.count()) { vorbereitet = (await knopf.textContent()).trim(); await knopf.click().catch(() => {}); await p.waitForTimeout(800); }
    }
    const lauf = await p.evaluate(({ id, d }) => {
      const g = window.hafenmeister;
      const lang = id === 'hansewoche' ? 2 : 1;
      g.events.load({ ...g.events.save(), planned: null, current: { id, startDay: d, endDay: d + lang - 1 } });
      g.emit('event:start', { event: g.events.current?.event ?? { id }, day: d, endDay: d + lang - 1 });
      if (id === 'sturm') g.emit('sturm', { tag: d });
      g.speed = 1;
      const m = g.events.modifiers();
      const anders = {};
      for (const [k, v] of Object.entries(m)) if (v && typeof v === 'object' ? Object.keys(v).length : (v !== 1 && v !== 0 && v !== false && v != null)) anders[k] = v;
      return { aktuell: g.events.current?.id ?? null, wirkung: anders };
    }, { id, d: vor.d });
    await p.waitForTimeout(4000);
    const banner = await p.evaluate(() => [...document.querySelectorAll('[class*="banner"], #ev-banner, .ev-banner')].filter((e) => e.getBoundingClientRect().width > 0).map((e) => e.textContent.trim().slice(0, 120)));
    await p.screenshot({ path: `${OUT}/${GER}-${id}-2-laeuft.jpg`, quality: 70 });
    ergebnis.push({ id, karte, vorbereitet, ...lauf, banner, fehler: o.log });
    process.stderr.write(`${id}: karte=${!!karte} vorbereitet=${vorbereitet} aktuell=${lauf.aktuell} fehler=${o.log.length}\n`);
    await o.ctx.close();
  }
  fs.writeFileSync(`${OUT}/${GER}-ergebnis.json`, JSON.stringify(ergebnis, null, 1));
  await b.close();
})();
