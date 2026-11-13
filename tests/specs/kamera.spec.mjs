// Kamera-Gesten, die leicht kaputtgehen (docs/kamera.md):
// 1. Schnelles Neigen mit zwei Fingern (die Entscheidung Neigen oder Zoomen wartet auf beide Finger)
// 2. Boot an der Leine, zweiter Finger dazu: Leine bricht ab, beide Finger neigen die Karte
// 3. Tippen beendet den Ueberblicksflug beim Laden
import { test, expect, isTouchProject, stageCenter, lerpFrames, ohneEinstieg } from '../helpers.mjs';

// Die Gestenlogik ist auf allen Geräten dieselbe: Fingertests nur am Handy, der Überblick am Handy
// und am PC. So bleibt der CI-Lauf im Zeitlimit (Tablet rendert dort nur wenige Bilder je Sekunde).
const nurHandy = (testInfo) => test.skip(testInfo.project.name !== 'handy', 'Gestenlogik wird am Handy geprüft');

const kamera = (page) => page.evaluate(() => {
  const c = window.hafenmeister.camera;
  return { x: c.target.x, z: c.target.z, w: c.viewWidth, pitch: c.pitchGrad };
});

// Finger per Chrome DevTools Protocol: jeder Eintrag in frames ist eine Liste von Fingern { id, x, y }.
// Kommt ein Finger dazu, sendet Chrome dafuer ein eigenes pointerdown.
async function finger(page, frames, pause = 16) {
  const cdp = await page.context().newCDPSession(page);
  let vorher = 0;
  for (const f of frames) {
    const type = f.length > vorher ? 'touchStart' : 'touchMove';
    await cdp.send('Input.dispatchTouchEvent', {
      type, touchPoints: f.map((p) => ({ x: p.x, y: p.y, id: p.id, radiusX: 4, radiusY: 4, force: 1 })),
    });
    vorher = f.length;
    await page.waitForTimeout(pause);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

test('Schnelles Wischen mit zwei Fingern neigt', async ({ game }, testInfo) => {
  nurHandy(testInfo);
  const { page } = game;
  await ohneEinstieg(page);
  await page.evaluate(() => window.hafenmeister.camera.zoomAt(2));
  const c = await stageCenter(page);
  const vorher = await kamera(page);
  // Nur drei Schritte fuer 90 px: etwa 30 px je Bild, wie ein schneller Wisch
  const frames = lerpFrames(
    [{ x: c.x - 40, y: c.y + 45 }, { x: c.x + 40, y: c.y + 45 }],
    [{ x: c.x - 40, y: c.y - 45 }, { x: c.x + 40, y: c.y - 45 }], 3,
  ).map((f) => f.map((p, id) => ({ ...p, id })));
  await finger(page, frames);
  await page.waitForTimeout(400);
  const nachher = await kamera(page);
  expect(nachher.pitch, 'schnelles Wischen mit zwei Fingern neigt nicht').toBeLessThan(vorher.pitch - 5);
  expect(Math.abs(nachher.w - vorher.w) / vorher.w, 'schnelles Neigen zoomt').toBeLessThan(0.05);
});

// Spielzeit vorspulen, bis ein Boot wartet, dann das 3D-Boot an einen freien Punkt der Karte holen
async function wartendesBoot(page) {
  const hatSim = await page.waitForFunction(() => !!window.hafenmeister.sim, null, { timeout: 15_000 }).then(() => true, () => false);
  if (!hatSim) return null;
  const id = await page.evaluate(() => {
    const g = window.hafenmeister;
    window.__anBoje = new Set();
    g.on('boot:an-boje', (d) => window.__anBoje.add(String(d?.id).replace(/^b/, '')));
    g.sim.newGame(42);
    for (let i = 0; i < 3000 && !g.sim.waitingBoats().length; i++) g.sim.fastForward(1);
    const b = g.sim.waitingBoats()[0];
    if (!b) return null;
    g.sim.holdBoat?.(b.id, true);
    g.speed = 6;
    return b.id;
  });
  if (id == null || !(await page.evaluate(() => !!window.hafenmeister.boatsVisible))) return null;
  await expect.poll(() => page.evaluate((id) => window.__anBoje.has(String(id).replace(/^b/, '')), id),
    { timeout: 40_000 }).toBe(true);
  await page.evaluate(() => { window.hafenmeister.speed = 1; window.hafenmeister.setPaused(true); });
  const frei = await stageCenter(page);
  return page.evaluate(({ id, frei }) => {
    const g = window.hafenmeister;
    const cam = g.camera;
    let obj = null;
    g.scene.traverse((o) => {
      const pk = o.userData?.pick;
      if (!obj && pk?.type === 'boat' && String(pk.id).replace(/^b/, '') === String(id)) obj = o;
    });
    const auf = () => {
      const v = obj.getWorldPosition(new g.THREE.Vector3()).project(cam.camera);
      return { x: (v.x + 1) / 2 * cam.screenW, y: (1 - v.y) / 2 * cam.screenH };
    };
    const p = auf();
    cam.panBy(frei.x - p.x, frei.y - p.y);
    cam.update(0);
    return { ...auf(), id };
  }, { id, frei });
}

test('Leine mit zweitem Finger abbrechen: dann neigen beide Finger', async ({ game }, testInfo) => {
  nurHandy(testInfo);
  test.setTimeout(90_000);
  const { page } = game;
  await ohneEinstieg(page);
  const boot = await wartendesBoot(page);
  test.skip(!boot, 'kein wartendes Boot in 3D');
  await page.evaluate(() => {
    window.__leine = [];
    window.hafenmeister.on('ui:tow-end', (d) => window.__leine.push(d));
  });
  const vorher = await kamera(page);
  const a0 = { id: 0, x: Math.round(boot.x), y: Math.round(boot.y) };
  const a1 = { id: 0, x: a0.x, y: a0.y - 24 };             // Leine ein Stueck ziehen
  const b1 = { id: 1, x: a0.x + 80, y: a1.y };              // zweiter Finger daneben
  const hoch = lerpFrames([a1, b1], [{ x: a1.x, y: a1.y - 90 }, { x: b1.x, y: b1.y - 90 }], 8)
    .map((f) => f.map((p, id) => ({ ...p, id })));
  await finger(page, [[a0], [a1], [a1, b1], ...hoch]);
  await page.waitForTimeout(400);
  const nachher = await kamera(page);
  const weg = Math.hypot(nachher.x - vorher.x, nachher.z - vorher.z);
  expect(weg, `Karte verschiebt sich um ${weg.toFixed(1)} m statt zu neigen`).toBeLessThan(6);
  expect(nachher.pitch, 'zwei Finger nach abgebrochener Leine neigen nicht').toBeLessThan(vorher.pitch - 5);
  const leine = await page.evaluate(() => window.__leine);
  expect(leine.every((d) => d.platz == null), 'abgebrochene Leine weist trotzdem einen Platz zu').toBe(true);
  const wartet = await page.evaluate((id) => window.hafenmeister.sim.waitingBoats().some((b) => b.id === id), boot.id);
  expect(wartet, 'Boot wartet nach dem Abbruch nicht mehr').toBe(true);
});

test('Tippen beendet den Überblicksflug beim Laden', async ({ page, problems }, testInfo) => {
  test.skip(!['handy', 'pc'].includes(testInfo.project.name), 'Überblick wird am Handy und am PC geprüft');
  void problems;   // richtet Three.js aus node_modules und die Fehlersammlung ein
  await page.goto('./?ueberblick=1&ueberblickhalten=60');
  await page.waitForFunction(() => document.getElementById('boot')?.classList.contains('done'), null, { timeout: 30_000 });
  await page.waitForFunction(() => document.body.classList.contains('hm-ueberblick'), null, { timeout: 15_000 })
    .catch(() => test.skip(true, 'kein Ueberblicksflug in dieser Fassung'));
  await page.evaluate(() => {
    window.__ende = null;
    window.hafenmeister.on('ueberblick:ende', (d) => { window.__ende = d; });
  });
  const ueber = await kamera(page);
  const p = await stageCenter(page);
  if (isTouchProject(testInfo)) await page.touchscreen.tap(p.x, p.y);
  else await page.mouse.click(p.x, p.y);
  await expect(page.locator('body'), 'Tippen beendet den Ueberblick nicht').not.toHaveClass(/hm-ueberblick/, { timeout: 2000 });
  expect(await page.evaluate(() => window.__ende), 'ueberblick:ende fehlt').toEqual({ abgebrochen: true });
  // Kurzer Tipp heisst "weiter": gleich die Startansicht
  const home = await page.evaluate(() => {
    const c = window.hafenmeister.camera;
    const jetzt = { x: c.target.x, z: c.target.z, w: c.viewWidth };
    c.reset();
    return { jetzt, home: { x: c.target.x, z: c.target.z, w: c.viewWidth } };
  });
  expect(home.jetzt.w, 'nach dem Tippen bleibt der weite Ueberblick').toBeLessThan(ueber.w);
  expect(Math.abs(home.jetzt.w - home.home.w), 'nach dem Tippen nicht in der Startansicht').toBeLessThan(home.home.w * 0.02);
});
