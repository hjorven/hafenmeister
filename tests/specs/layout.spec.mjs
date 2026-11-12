// Passt die Oberflaeche auf das Geraet? Nichts ragt heraus, Knoepfe sind gross genug.
import { test, expect, isTouchProject } from '../helpers.mjs';

const BUTTONS = ['#btn-pause', '#btn-overview', '#btn-build'];
const MIN_TOUCH = 40;        // base.css setzt --tap: 44px, etwas Spielraum fuer Rahmen
const MIN_TOUCH_FLACH = 36;  // Handy quer (unter 500 px hoch): ui-phone.css nimmt bewusst 36 px

// Bekannte Fehler auf main, die ein anderer Thread gerade behebt. Der Test laeuft trotzdem und
// muss scheitern (test.fail). Wird der Fehler behoben, wird der Test rot mit "expected to fail":
// dann den Eintrag hier im selben PR loeschen.
const BEKANNT = {
  'tablet': 'Tablet hochkant: obere Leiste zu voll, Pause liegt rechts ausserhalb, Sonne verdeckt "Tag" (web/css/ui-tablet.css)',
};

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
  const bekannt = BEKANNT[testInfo.project.name];
  test.fail(!!bekannt, bekannt);
  const { page } = game;
  const vp = page.viewportSize();
  const minTouch = vp.height < 500 ? MIN_TOUCH_FLACH : MIN_TOUCH;
  for (const sel of BUTTONS) {
    const btn = page.locator(sel);
    await expect(btn, `${sel} nicht sichtbar`).toBeVisible();
    const box = await btn.boundingBox();
    expect(box.x, `${sel} ragt links heraus`).toBeGreaterThanOrEqual(0);
    expect(box.y, `${sel} ragt oben heraus`).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, `${sel} ragt rechts heraus`).toBeLessThanOrEqual(vp.width + 0.5);
    expect(box.y + box.height, `${sel} ragt unten heraus`).toBeLessThanOrEqual(vp.height + 0.5);
    if (isTouchProject(testInfo)) {
      expect(box.width, `${sel} zu schmal zum Antippen`).toBeGreaterThanOrEqual(minTouch);
      expect(box.height, `${sel} zu niedrig zum Antippen`).toBeGreaterThanOrEqual(minTouch);
    }
  }
});

test('Obere und untere Leiste überdecken sich nicht', async ({ game }) => {
  const { page } = game;
  const top = await page.locator('#hud-top').boundingBox();
  const bottom = await page.locator('#hud-bottom').boundingBox();
  test.skip(!top || !bottom, 'Leisten nicht vorhanden');
  const overlapX = Math.min(top.x + top.width, bottom.x + bottom.width) - Math.max(top.x, bottom.x);
  const overlapY = Math.min(top.y + top.height, bottom.y + bottom.height) - Math.max(top.y, bottom.y);
  expect(overlapX > 0.5 && overlapY > 0.5, 'Leisten ueberlappen').toBe(false);
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
