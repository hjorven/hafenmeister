// Hafentiere (Paket P51, docs/hafentiere.md): Katze, Hund und Reiher im Spiel, Antippen, Aufscheuchen,
// Foto ins Logbuch, Regen und Stufe 1 ohne Hund.
import { test, expect, ohneEinstieg } from '../helpers.mjs';

test.skip(({ projekt }) => projekt !== 'handy' && projekt !== 'pc', 'Hafentiere werden am Handy und am PC geprüft');

async function laden(page, query) {
  await page.goto(`./${query}`);
  await page.waitForFunction(() => !!window.hafenmeister?.sim?.state && !!window.hafenmeister.hafentiere && !!window.hafenmeister.besucher, null, { timeout: 45_000, polling: 100 });
  await ohneEinstieg(page);
  await page.evaluate(() => { try { localStorage.setItem('hm-tagesabschluss-auto', 'aus'); } catch {} window.hafenmeister.tagesziele?.waehle?.(0); });
  // Das Wetter des ersten Tages ist zufällig; bei Regen wären Katze und Hund im Haus
  await page.evaluate(() => window.hafenmeister.emit('weather', { rain: 0, snow: 0, wind: 0.3 }));
}
const tier = (page, art) => page.evaluate((a) => window.hafenmeister.hafentiere.tier(a), art);
/** Kamera nah an ein Tier (Bildbreite in Metern) */
async function kameraZu(page, art, breite = 24) {
  await page.evaluate(([a, w]) => {
    const g = window.hafenmeister;
    const t = g.hafentiere.tier(a);
    const c = g.camera;
    c.target.x = t.x; c.target.z = t.z; c.viewWidth = w; c._apply?.();
  }, [art, breite]);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

test('Hafentiere: alle drei da, an Land oder im flachen Wasser, Antippen, Reiher fliegt vor Booten auf', async ({ game }) => {
  test.setTimeout(150_000);
  const { page } = game;
  await laden(page, '?stufe=3');
  for (const art of ['katze', 'hund', 'reiher']) {
    await expect.poll(async () => (await tier(page, art))?.sichtbar, { timeout: 30_000, message: `${art} sichtbar` }).toBe(true);
  }
  // Katze und Hund nie im Wasser (auf Stegen liegt der Boden über dem Wasser)
  await page.evaluate(() => { window.hafenmeister.speed = 8; });
  for (let i = 0; i < 6; i++) {
    const lage = await page.evaluate(() => {
      const g = window.hafenmeister;
      return ['katze', 'hund'].map((a) => { const t = g.hafentiere.tier(a); return { a, nass: t.sichtbar && g.landscape.istWasser(t.x, t.z) && t.y < 0.3 }; });
    });
    for (const l of lage) expect(l.nass, `${l.a} steht im Wasser`).toBe(false);
    await page.waitForTimeout(700);
  }
  await page.evaluate(() => { window.hafenmeister.speed = 1; });

  // Antippen: Katze (Pause, damit sie stillhält)
  await page.locator('#btn-pause').click();
  await expect.poll(() => page.evaluate(() => !!window.hafenmeister.paused)).toBe(true);
  await page.evaluate(() => { window.__tipps = []; window.hafenmeister.on('hafentiere:tipp', (e) => window.__tipps.push(e.art)); });
  await kameraZu(page, 'katze');
  const punkt = await page.evaluate(() => {
    const g = window.hafenmeister, t = g.hafentiere.tier('katze');
    const v = new g.THREE.Vector3(t.x, t.y + 0.35, t.z).project(g.camera.camera);
    const r = g.canvas.getBoundingClientRect();
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
  });
  await page.mouse.click(punkt.x, punkt.y);
  await expect.poll(() => page.evaluate(() => window.__tipps)).toContain('katze');
  await page.locator('#btn-pause').click();

  // Reiher: ein Boot kommt nah, er fliegt auf und landet woanders im flachen Wasser oder auf der Mole
  const boot = await page.evaluate(() => {
    const b = (window.hafenmeister.boatView?.boote ?? []).find((x) => x.anim?.model ?? x.anim?.group);
    const p = (b?.anim.model ?? b?.anim.group)?.position;
    return p ? { x: p.x, z: p.z } : null;
  });
  if (boot) {
    const vorher = (await tier(page, 'reiher')).aufgeflogen;
    await page.evaluate((b) => {
      const r = window.hafenmeister.hafentiere._tiere.reiher;
      r.x = b.x + 3; r.z = b.z + 3; r.zustand = 'steht'; r.pruef = 0;
    }, boot);
    await expect.poll(async () => (await tier(page, 'reiher')).aufgeflogen, { timeout: 10_000 }).toBeGreaterThan(vorher);
  }
});

test('Hafentiere: Foto im Fotomodus ins Logbuch, Erfolg zählt', async ({ game }) => {
  test.setTimeout(120_000);
  const { page } = game;
  await laden(page, '?stufe=3');
  await expect.poll(async () => (await tier(page, 'katze'))?.sichtbar, { timeout: 30_000 }).toBe(true);
  await page.evaluate(() => window.hafenmeister.foto.an());
  const knopf = page.locator('.hm-bs-foto');
  await expect(knopf).toBeVisible({ timeout: 10_000 });
  // Suchen: Kamera fliegt zu einem Hafentier, das stillhält; dann wird der Knopf gold
  if (!(await knopf.evaluate((k) => k.classList.contains('bereit')))) await knopf.click();
  await expect(knopf).toHaveClass(/bereit/, { timeout: 15_000 });
  await knopf.click();
  await expect.poll(() => page.evaluate(() => window.hafenmeister.besucher.fortschritt().hafentierFotos + window.hafenmeister.besucher.fortschritt().fotos), { timeout: 5_000 }).toBeGreaterThan(0);
  await page.evaluate(() => window.hafenmeister.foto.aus?.());
  await page.evaluate(() => window.hafenmeister.logbuch.oeffnen('besucher'));
  const karten = page.locator('.hm-bs-karte.foto');
  await expect(karten.first()).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.hm-lb-art h3').first()).toContainText('Hafentiere');
});

test('Hafentiere: Stufe 1 ohne Hund, bei Regen gehen Katze und Hund ins Haus', async ({ game }) => {
  test.setTimeout(150_000);
  const { page } = game;
  await laden(page, '?stufe=1');
  await expect.poll(async () => (await tier(page, 'katze'))?.sichtbar, { timeout: 30_000 }).toBe(true);
  expect((await tier(page, 'hund')).sichtbar).toBe(false);
  await laden(page, '?stufe=2');
  await expect.poll(async () => (await tier(page, 'hund'))?.sichtbar, { timeout: 30_000 }).toBe(true);
  await page.evaluate(() => { const g = window.hafenmeister; g.emit('weather', { rain: 1, wind: 0.3 }); g.speed = 8; });
  await expect.poll(async () => [(await tier(page, 'katze')).sichtbar, (await tier(page, 'hund')).sichtbar], { timeout: 60_000 }).toEqual([false, false]);
  await page.evaluate(() => window.hafenmeister.emit('weather', { rain: 0, wind: 0.3 }));
  await expect.poll(async () => [(await tier(page, 'katze')).sichtbar, (await tier(page, 'hund')).sichtbar], { timeout: 30_000 }).toEqual([true, true]);
});
