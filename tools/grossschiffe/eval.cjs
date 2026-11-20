// Hilfsskript: node tools/grossschiffe/eval.cjs "<query>" "<js-ausdruck>"
const path = require('node:path');
const z = require('../zeitraffer/lauf.cjs');
(async () => {
  const { chromium } = z.ladePlaywright();
  const { s, url } = await z.serve(path.resolve(__dirname, '..', '..', 'web'));
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' })).newPage();
  p.on('console', (m) => { if (m.type() === 'log') console.log('LOG', m.text()); });
  await p.goto(url + process.argv[2]);
  await p.waitForFunction(() => window.hafenmeister?.besuchsFahrten && window.hafenmeister?.fahrwasser?.karte, null, { timeout: 120000 });
  await p.waitForTimeout(500);
  console.log(JSON.stringify(await p.evaluate(process.argv[3]), null, 0));
  await b.close(); s.close();
})();
