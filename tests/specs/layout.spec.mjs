// Passt die Oberflaeche auf das Geraet? Nichts ragt heraus, Knoepfe sind gross genug.
import { test, expect, isTouchProject } from '../helpers.mjs';

const BUTTONS = ['#btn-pause', '#btn-overview', '#btn-build'];
const MIN_TOUCH = 40;   // base.css setzt --tap: 44px, etwas Spielraum fuer Rahmen

test('Seite scrollt nicht und die Spielfläche füllt den Bildschirm', async ({ game }) => {
  const { page } = game;
  const m = await page.evaluate(() => {
    const se = document.scrollingElement;
    const stage = document.getElementById('stage').getBoundingClientRect();
    return {
      vw: innerWidth, vh: innerHeight,
      sw: se.scrollWidth, sh: se.scrollHeight,
      stageW: stage.width, stageH: stage.height,
    };
  });
  expect(m.sw, 'Seite ist breiter als der Bildschirm').toBeLessThanOrEqual(m.vw);
  expect(m.sh, 'Seite ist hoeher als der Bildschirm').toBeLessThanOrEqual(m.vh);
  expect(m.stageW).toBeGreaterThanOrEqual(m.vw - 1);
  expect(m.stageH).toBeGreaterThanOrEqual(m.vh - 1);
});

test('Knöpfe sind sichtbar, liegen im Bild und sind groß genug', async ({ game }, testInfo) => {
  const { page } = game;
  const vp = page.viewportSize();
  for (const sel of BUTTONS) {
    const btn = page.locator(sel);
    await expect(btn, `${sel} nicht sichtbar`).toBeVisible();
    const box = await btn.boundingBox();
    expect(box.x, `${sel} ragt links heraus`).toBeGreaterThanOrEqual(0);
    expect(box.y, `${sel} ragt oben heraus`).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, `${sel} ragt rechts heraus`).toBeLessThanOrEqual(vp.width + 0.5);
    expect(box.y + box.height, `${sel} ragt unten heraus`).toBeLessThanOrEqual(vp.height + 0.5);
    if (isTouchProject(testInfo)) {
      expect(box.width, `${sel} zu schmal zum Antippen`).toBeGreaterThanOrEqual(MIN_TOUCH);
      expect(box.height, `${sel} zu niedrig zum Antippen`).toBeGreaterThanOrEqual(MIN_TOUCH);
    }
  }
});

test('Obere und untere Leiste überdecken sich nicht', async ({ game }) => {
  const { page } = game;
  const top = await page.locator('#hud-top').boundingBox();
  const bottom = await page.locator('#hud-bottom').boundingBox();
  test.skip(!top || !bottom, 'Leisten nicht vorhanden');
  expect(top.y + top.height, 'Leisten ueberlappen').toBeLessThanOrEqual(bottom.y + 0.5);
});

test('Richtige Geräte-Weiche (Media Queries aus base.css)', async ({ game }, testInfo) => {
  const { page } = game;
  const q = await page.evaluate(() => ({
    pc: matchMedia('(min-width: 1024px) and (pointer: fine)').matches,
    tablet: matchMedia('(min-width: 600px) and (min-height: 500px) and (pointer: coarse)').matches,
  }));
  const name = testInfo.project.name;
  const expected = name.startsWith('pc') ? 'pc' : name.startsWith('tablet') ? 'tablet' : 'handy';
  const actual = q.pc ? 'pc' : q.tablet ? 'tablet' : 'handy';
  expect(actual, 'Media Query trifft nicht das erwartete Geraet').toBe(expected);
});
