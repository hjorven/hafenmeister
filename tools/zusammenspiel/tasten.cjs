// Zusammenspiel Oberfläche (P85 Teil 2): jede Taste aus der PC-Tastenhilfe (ui/input-pc.js, HELP)
// einmal drücken und prüfen, ob passiert, was dort steht.
// Server vorher: bash tools/build-pages.sh && (cd tests && node server.mjs 4180)
// Aufruf: node tools/zusammenspiel/tasten.cjs
const { browser, open } = require('../verdeckung/helfer.cjs');

const lage = () => {
  const g = window.hafenmeister; const c = g.camera;
  const sicht = (id) => { const e = document.getElementById(id); return !!e && !e.hidden && e.checkVisibility(); };
  return {
    speed: g.speed, paused: !!g.paused, bauen: document.body.classList.contains('building'),
    foto: document.body.classList.contains('foto'), stumm: !!g.audio?.muted,
    gaestebuch: sicht('hm-gaestebuch'), logbuch: sicht('hm-logbuch'), statistik: sicht('hm-statistik'),
    spielstand: !!document.querySelector('.hm-save-backdrop:not([hidden]), #hm-spielstand:not([hidden])'),
    hilfe: [...document.querySelectorAll('[role=dialog], .pc-help, #pc-help')].some((e) => !e.hidden && e.checkVisibility() && /Maus und Tastatur/.test(e.textContent)),
    cam: JSON.stringify([c.yaw ?? c.rotation ?? c.azimuth, c.pitch ?? c.tilt ?? c.polar, c.viewWidth, c.target?.x ?? c.x, c.target?.z ?? c.z].map((v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v))),
    gewaehlt: g.sim?.selected ?? null,
    wartend: (g.sim?.waitingBoats?.() ?? []).map((b) => b.id).join(','),
  };
};

const TASTEN = [
  ['F', 'speed'], ['F', 'speed'], ['G', 'speed'], ['G', 'speed'], ['Space', 'paused'], ['Space', 'paused'],
  ['B', 'bauen'], ['Escape', 'bauen'], ['N', 'gaestebuch'], ['Escape', 'gaestebuch'], ['J', 'logbuch'], ['Escape', 'logbuch'],
  ['T', 'statistik'], ['Escape', 'statistik'], ['M', 'stumm'], ['M', 'stumm'], ['P', 'foto'], ['P', 'foto'],
  ['L', 'spielstand'], ['Escape', 'spielstand'], ['Shift+?', 'hilfe'], ['Escape', 'hilfe'], ['F1', 'hilfe'], ['F1', 'hilfe'],
  ['Q', 'cam'], ['E', 'cam'], ['R', 'cam'], ['V', 'cam'], ['PageUp', 'cam'], ['PageDown', 'cam'],
  ['+', 'cam'], ['-', 'cam'], ['W', 'cam', 400], ['ArrowLeft', 'cam', 400], ['0', 'cam'], ['D', 'cam', 400], ['Home', 'cam'],
  ['1', 'gewaehlt'], ['Tab', 'gewaehlt'], ['Enter', 'wartend'],
];

(async () => {
  const b = await browser();
  const { page, log } = await open(b, 'pc', '?stufe=3&seed=7');
  await page.addStyleTag({ content: '#dauer-hinweis{display:none!important}' });
  // auf ein wartendes Boot warten, damit 1, Tab und Enter etwas zu tun haben
  await page.evaluate(async () => { const g = window.hafenmeister; g.speed = 8;
    for (let i = 0; i < 300 && !g.sim.waitingBoats().length; i++) await new Promise((r) => setTimeout(r, 100)); g.speed = 1; });
  await page.mouse.move(720, 450);
  let fehl = 0;
  for (const [taste, feld, halten] of TASTEN) {
    const v = await page.evaluate(lage);
    // Q/E usw. brauchen den Fokus auf der Seite, nicht in einem Knopf
    await page.evaluate(() => document.activeElement?.blur?.());
    if (halten) { await page.keyboard.down(taste); await page.waitForTimeout(halten); await page.keyboard.up(taste); }
    else await page.keyboard.press(taste);
    await page.waitForTimeout(1500);
    const n = await page.evaluate(lage);
    const ok = JSON.stringify(v[feld]) !== JSON.stringify(n[feld]);
    if (!ok) fehl++;
    console.log(`${ok ? 'ok    ' : 'FEHLT '} ${taste.padEnd(10)} ${feld}: ${JSON.stringify(v[feld])} -> ${JSON.stringify(n[feld])}`);
  }
  if (log.length) console.log(log.slice(0, 5).join('\n'));
  console.log(`${TASTEN.length - fehl} von ${TASTEN.length} Tasten wirken.`);
  await b.close();
})();
