// Logbuch und Hafenchronik (web/js/ui/logbuch.js, docs/logbuch.md): öffnet über das Menü, zeigt Bilder
// aus den 3D-Modellen und Schattenrisse, Steckbrief, Chronik; neue Modelle melden sich rechts oben.
import { test, expect, ohneEinstieg } from '../helpers.mjs';

test('Logbuch: Boote mit Bild, Steckbrief, Chronik und Meldung', async ({ game }) => {
  test.setTimeout(150_000);
  const { page } = game;
  await page.waitForFunction(() => !!window.hafenmeister.sim?.state && !!window.hafenmeister.logbuch, null, { timeout: 30_000, polling: 100 });
  await ohneEinstieg(page);
  await page.evaluate(() => {
    try { localStorage.setItem('hm-tagesabschluss-auto', 'aus'); } catch {}
    window.hafenmeister.tagesziele?.waehle?.(0);
  });
  // Einen Tag spielen: Boote legen an und kommen ins Logbuch
  await page.evaluate(() => {
    const s = window.hafenmeister.sim;
    const tag = s.state.day;
    for (let n = 0; s.state.day === tag && n < 800; n++) {
      s.fastForward(2);
      for (const b of s.waitingBoats?.() ?? []) { try { s.autoEnter(b.id); } catch {} }
    }
  });
  const stand = await page.evaluate(() => window.hafenmeister.logbuch.fortschritt());
  expect(stand.gesehen).toBeGreaterThan(0);
  expect(stand.gesamt).toBeGreaterThan(stand.gesehen);
  // Die Meldung "neu im Logbuch" steht oder hat gestanden (Meldungs-Ordnung)
  await expect.poll(() => page.evaluate(() => document.querySelector('#hm-lb-meldung .hm-lb-meldung') !== null || document.getElementById('btn-logbuch')?.textContent.includes('neu')), { timeout: 15_000 }).toBe(true);

  // Öffnen über das Menü
  await page.evaluate(() => window.hafenmeister.tagesabschluss?.schliesse?.());
  await page.locator('#btn-menu').click();
  await page.locator('#btn-logbuch').click();
  const fenster = page.locator('#hm-logbuch');
  await expect(fenster).toBeVisible();
  await expect(fenster.locator('.hm-lb-stand-text b')).toHaveText(`${stand.gesehen} von ${stand.gesamt}`);
  // Bilder: gesehene farbig, fehlende als Schattenriss, alle bekommen ein Bild
  await expect.poll(() => page.evaluate(() => {
    const img = [...document.querySelectorAll('#hm-logbuch .hm-lb-bild')];
    return img.length > 0 && img.every((i) => i.src.startsWith('data:image/png'));
  }), { timeout: 20_000 }).toBe(true);
  // Steckbrief einer gesehenen Karte
  await fenster.locator('.hm-lb-karte:not(.fehlt)').first().click();
  await expect(fenster.locator('.hm-lb-steckbrief h3')).not.toBeEmpty();
  await expect(fenster.locator('.hm-lb-erst')).toContainText('Zuerst am Tag 1');
  await fenster.locator('.hm-lb-zurueck').click();
  // Chronik: Tag 1 steht drin
  await fenster.locator('#hm-lb-tab-chronik').click();
  await expect(fenster.locator('.hm-lb-tage li').first()).toContainText('Tag 1');
  // Fenster passt ins Bild und schließt
  const r = await fenster.boundingBox();
  const vp = page.viewportSize();
  expect(r.x).toBeGreaterThanOrEqual(0);
  expect(r.x + r.width).toBeLessThanOrEqual(vp.width + 1);
  expect(r.y + r.height).toBeLessThanOrEqual(vp.height + 1);
  await page.screenshot({ path: `bildschirmfotos/logbuch-${test.info().project.name}.png` });
  await fenster.locator('.hm-lb-zu').click();
  await expect(fenster).toBeHidden();
});
