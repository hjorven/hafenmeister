// Grundbedienung: Pause, Karte verschieben, zoomen, Uebersicht, Antippen.
// Auf Touch-Geraeten mit echten Finger-Gesten, am PC mit Maus.
import { test, expect, cameraState, stageCenter, touchGesture, lerpFrames, isTouchProject, ohneEinstieg, kameraRuhig } from '../helpers.mjs';

async function press(page, selector, testInfo) {
  const btn = page.locator(selector);
  if (isTouchProject(testInfo)) await btn.tap();
  else await btn.click();
}

// Hinweiskarten des Einstiegs koennen sonst ueber der Stelle liegen, an der die Tests ziehen
test.beforeEach(async ({ game }) => { await ohneEinstieg(game.page); });

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
  await kameraRuhig(page);
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
  await kameraRuhig(page);   // Wischen hat Schwung: erst messen, wenn die Karte ausgeglitten ist
  const moved = await cameraState(page);
  const dist = Math.hypot(moved.x - before.x, moved.z - before.z);
  expect(dist, 'Ziehen verschiebt die Karte nicht').toBeGreaterThan(1);

  // "Uebersicht" muss genau zur Startansicht fuehren, die camera.reset() gerade berechnet.
  // Die Startansicht selbst kann sich kurz nach dem Laden noch aendern (Module legen Bauplaetze an,
  // Leisten bewegen sich). Darum: Knopf druecken, Ruhe abwarten, mit reset() vergleichen; weicht die
  // Startansicht inzwischen ab, noch einmal (hoechstens 5 Versuche). Ein Knopf, der nie zur
  // Startansicht fuehrt, faellt damit weiterhin durch.
  const tol = 0.05;   // Meter, Rundung der Kamerafahrt
  let back, home;
  for (let versuch = 0; versuch < 5; versuch++) {
    await press(page, '#btn-overview', testInfo);
    await kameraRuhig(page);
    back = await cameraState(page);
    home = await page.evaluate(() => {
      const cam = window.hafenmeister.camera;
      cam.reset();
      return { x: cam.target.x, z: cam.target.z, width: cam.viewWidth };
    });
    if (Math.abs(back.x - home.x) < tol && Math.abs(back.z - home.z) < tol && Math.abs(back.width - home.width) < tol) break;
    await page.waitForTimeout(300);
  }
  expect(Math.hypot(moved.x - home.x, moved.z - home.z), 'Testaufbau: Karte war nicht verschoben').toBeGreaterThan(1);
  expect(Math.abs(back.x - home.x), 'Uebersicht fuehrt nicht zur Startansicht (x)').toBeLessThan(tol);
  expect(Math.abs(back.z - home.z), 'Uebersicht fuehrt nicht zur Startansicht (z)').toBeLessThan(tol);
  expect(Math.abs(back.width - home.width), 'Uebersicht fuehrt nicht zur Startansicht (Breite)').toBeLessThan(tol);
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
  const c = await stageCenter(page, { leer: true });
  if (isTouchProject(testInfo)) await page.touchscreen.tap(c.x, c.y);
  else await page.mouse.click(c.x, c.y);

  await page.waitForFunction(() => window.__taps.length > 0, null, { timeout: 3000 });
  const taps = await page.evaluate(() => window.__taps);
  expect(taps[0].hasWorld, 'Tipp hat keinen Weltpunkt').toBe(true);
});

test('Kamera neigen (zwei Finger hoch oder rechte Maustaste) und Kompass richtet aus', async ({ game }, testInfo) => {
  const { page } = game;
  const pitch = () => page.evaluate(() => window.hafenmeister.camera.pitchGrad);
  await page.evaluate(() => window.hafenmeister.camera.zoomAt(2));
  const before = await pitch();
  const c = await stageCenter(page);
  if (isTouchProject(testInfo)) {
    // Finger nebeneinander, gemeinsam nach oben: flacher
    await touchGesture(page, lerpFrames(
      [{ x: c.x - 40, y: c.y + 40 }, { x: c.x + 40, y: c.y + 40 }],
      [{ x: c.x - 40, y: c.y - 40 }, { x: c.x + 40, y: c.y - 40 }],
    ));
  } else {
    await page.mouse.move(c.x, c.y + 40);
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(c.x, c.y - 40, { steps: 12 });
    await page.mouse.up({ button: 'right' });
  }
  await page.waitForTimeout(500);
  const flat = await pitch();
  expect(flat, 'Neigen macht die Kamera nicht flacher').toBeLessThan(before - 5);
  const kompass = page.locator('#btn-kompass');
  await expect(kompass).toBeVisible();
  if (isTouchProject(testInfo)) await kompass.tap(); else await kompass.click();
  await page.waitForFunction(() => Math.abs(window.hafenmeister.camera.pitchGrad - 50) < 1);
});
