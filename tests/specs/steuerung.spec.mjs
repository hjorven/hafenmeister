// Grundbedienung: Pause, Karte verschieben, zoomen, Uebersicht, Antippen.
// Auf Touch-Geraeten mit echten Finger-Gesten, am PC mit Maus.
import { test, expect, cameraState, stageCenter, touchGesture, lerpFrames, isTouchProject } from '../helpers.mjs';

async function press(page, selector, testInfo) {
  const btn = page.locator(selector);
  if (isTouchProject(testInfo)) await btn.tap();
  else await btn.click();
}

test('Pause hält die Spielzeit an und Weiter läuft weiter', async ({ game }, testInfo) => {
  const { page } = game;
  await press(page, '#btn-pause', testInfo);
  expect(await page.evaluate(() => window.hafenmeister.paused)).toBe(true);
  await expect(page.locator('#btn-pause')).toHaveText(/Weiter/);

  const t0 = await page.evaluate(() => window.hafenmeister.time);
  await page.waitForTimeout(400);
  const t1 = await page.evaluate(() => window.hafenmeister.time);
  expect(t1, 'Spielzeit laeuft trotz Pause').toBe(t0);

  await press(page, '#btn-pause', testInfo);
  expect(await page.evaluate(() => window.hafenmeister.paused)).toBe(false);
  await expect(page.locator('#btn-pause')).toHaveText(/Pause/);
  await page.waitForFunction((t) => window.hafenmeister.time > t, t1);
});

test('Karte verschieben und mit Übersicht zurück', async ({ game }, testInfo) => {
  const { page } = game;
  const before = await cameraState(page);
  const c = await stageCenter(page);
  const to = { x: c.x - 120, y: c.y - 60 };

  if (isTouchProject(testInfo)) {
    await touchGesture(page, lerpFrames([c], [to]));
  } else {
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 12 });
    await page.mouse.up();
  }
  const moved = await cameraState(page);
  const dist = Math.hypot(moved.x - before.x, moved.z - before.z);
  expect(dist, 'Ziehen verschiebt die Karte nicht').toBeGreaterThan(1);

  await press(page, '#btn-overview', testInfo);
  const back = await cameraState(page);
  // Erwartet: genau die Startansicht, die camera.reset() berechnet
  const home = await page.evaluate(() => {
    const c = window.hafenmeister.camera;
    c.reset();
    return { x: c.target.x, z: c.target.z, width: c.viewWidth };
  });
  expect(Math.hypot(moved.x - home.x, moved.z - home.z), 'Testaufbau: Karte war nicht verschoben').toBeGreaterThan(1);
  expect(back.x, 'Uebersicht fuehrt nicht zur Startansicht').toBeCloseTo(home.x, 2);
  expect(back.z, 'Uebersicht fuehrt nicht zur Startansicht').toBeCloseTo(home.z, 2);
  expect(back.width, 'Uebersicht fuehrt nicht zur Startansicht').toBeCloseTo(home.width, 2);
});

test('Zoomen (Mausrad oder zwei Finger)', async ({ game }, testInfo) => {
  const { page } = game;
  // Erst etwas herauszoomen, damit Hineinzoomen sicher Spielraum hat
  await page.evaluate(() => window.hafenmeister.camera.zoomAt(0.5));
  const before = await cameraState(page);
  const c = await stageCenter(page);

  if (isTouchProject(testInfo)) {
    const spread = Math.min(c.x, 160) - 20;
    await touchGesture(page, lerpFrames(
      [{ x: c.x - 30, y: c.y }, { x: c.x + 30, y: c.y }],
      [{ x: c.x - spread, y: c.y }, { x: c.x + spread, y: c.y }],
    ));
  } else {
    await page.mouse.move(c.x, c.y);
    for (let i = 0; i < 4; i++) {
      await page.mouse.wheel(0, -200);
      await page.waitForTimeout(30);
    }
  }
  const after = await cameraState(page);
  expect(after.width, 'Hineinzoomen verkleinert den Ausschnitt nicht').toBeLessThan(before.width * 0.9);
});

test('Antippen der Karte meldet einen Punkt im Wasser oder an Land', async ({ game }, testInfo) => {
  const { page } = game;
  await page.evaluate(() => {
    window.__taps = [];
    window.hafenmeister.on('tap', (e) => window.__taps.push({ x: e.x, y: e.y, hasWorld: !!e.world }));
  });
  const c = await stageCenter(page);
  if (isTouchProject(testInfo)) await page.touchscreen.tap(c.x, c.y);
  else await page.mouse.click(c.x, c.y);

  await page.waitForFunction(() => window.__taps.length > 0, null, { timeout: 3000 });
  const taps = await page.evaluate(() => window.__taps);
  expect(taps[0].hasWorld, 'Tipp hat keinen Weltpunkt').toBe(true);
});
