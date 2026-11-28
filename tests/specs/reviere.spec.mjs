// Nordsee freischalten und gründen (P57 Teil 5, docs/nordsee.md): Seekarte im Fenster "Neues Spiel", gesperrte
// Nordsee sagt, ab wann sie frei ist; mit einem Ostsee-Hafen auf Stufe 5 wird sie wählbar, der neue Hafen liegt
// an der Nordsee (Tide aktiv) und hat Startgeld aus dem Ruf.
import { test, expect, isTouchProject } from '../helpers.mjs';

async function press(locator, testInfo) {
  if (isTouchProject(testInfo)) await locator.tap();
  else await locator.click();
}

async function bereit(page) {
  await page.waitForFunction(() => !!window.hafenmeister?.sim?.state && !!window.hafenmeister.spielstand, null, { timeout: 30_000, polling: 100 });
  await page.evaluate(() => window.hafenmeister.einstieg?.beenden?.());
}

test('Seekarte: Nordsee erst gesperrt, ab Ostsee-Stufe 5 wählbar, neuer Hafen liegt an der Nordsee', async ({ game }, testInfo) => {
  test.skip(testInfo.project.name !== 'pc' && testInfo.project.name !== 'handy', 'reicht auf PC und Handy');
  test.setTimeout(120_000);
  const { page } = game;
  await bereit(page);

  await page.evaluate(() => window.hafenmeister.spielstand.neuesSpiel());
  const nordsee = page.locator('.hm-sp-revier[data-revier=nordsee]');
  await expect(nordsee).toHaveAttribute('aria-label', /gesperrt/);
  await press(nordsee, testInfo);
  await expect(page.locator('#hm-neu-revier-info')).toContainText('Stufe 5');
  await expect(nordsee).toHaveAttribute('aria-checked', 'false');
  await page.keyboard.press('Escape');

  // Ein Ostsee-Hafen hat Stufe 5 erreicht (Merkzettel wie nach dem Speichern)
  await page.evaluate(() => localStorage.setItem('hafenmeister.reviere', JSON.stringify({ ostsee: { stufe: 5, ruf: 4.2 } })));
  await page.evaluate(() => window.hafenmeister.spielstand.neuesSpiel());
  await press(nordsee, testInfo);
  await expect(nordsee).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('#hm-neu-revier-info')).toContainText('1.300');
  // Küsten der Nordsee: Zufall plus fünf (P57 Teil 6)
  await expect(page.locator('#hm-neu-kuesten [data-gelaende]')).toHaveCount(6);
  await expect(page.locator('#hm-neu-kuesten [data-gelaende="5"]')).toHaveCount(0);
  await page.locator('#hm-neu-name').fill('Wattsiel');
  const los = page.locator('#hm-neu-los');
  await los.scrollIntoViewIfNeeded();
  await Promise.all([page.waitForEvent('load'), press(los, testInfo)]);
  await bereit(page);
  await page.waitForFunction(() => !!window.hafenmeister.gezeiten?.aktiv?.(), null, { timeout: 15_000 });
  const st = await page.evaluate(() => ({
    name: window.hafenmeister.sim.state.harborName, region: window.hafenmeister.sim.state.region,
    geld: window.hafenmeister.sim.state.money, revier: document.body.dataset.revier,
  }));
  expect(st).toEqual({ name: 'Wattsiel', region: 'nordsee', geld: 1300, revier: 'nordsee' });

  // Liste der Spielstände nennt das Revier
  await page.evaluate(() => window.hafenmeister.spielstand.oeffnen());
  await expect(page.locator('.hm-sp')).toContainText('Nordsee · Stufe 1');
});
