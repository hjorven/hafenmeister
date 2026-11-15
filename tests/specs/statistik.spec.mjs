// Statistik (docs/statistik.md, P41): Karte aus dem Menü und aus dem Tagesabschluss, Säulen antippen,
// kein "null" im Text, Bedienknöpfe bleiben frei, Esc schließt.
import { test, expect, isTouchProject } from '../helpers.mjs';

const FREI = ['.hm-status', '.hm-werkzeuge', '#hm-zeit', '#btn-collect', '#btn-build'];

async function press(locator, testInfo) {
  if (isTouchProject(testInfo)) await locator.tap();
  else await locator.click();
}

test('Statistik: 30 Tage nach Quelle, Belegung, Tag wählen, Bedienung frei', async ({ game }, testInfo) => {
  test.setTimeout(90_000);
  const { page } = game;
  await page.waitForFunction(() => !!window.hafenmeister.sim?.state && !!window.hafenmeister.statistik?.bereit, null, { timeout: 30_000, polling: 100 });
  await page.evaluate(() => {
    const g = window.hafenmeister;
    g.einstieg?.beenden?.();
    try { localStorage.setItem('hm-tagesabschluss-auto', 'aus'); } catch { /* egal */ }
    for (let i = 0; i < 4 * 8; i++) g.sim.fastForward(1e6);
    g.tagesabschluss?.schliesse?.();
  });
  // Über das Menü öffnen
  await press(page.locator('#btn-menu'), testInfo);
  const zeile = page.locator('#hm-menue #btn-statistik');
  await expect(zeile).toBeVisible();
  await press(zeile, testInfo);
  const karte = page.locator('#hm-statistik');
  await expect(karte).toBeVisible();
  await expect(karte).toContainText('Einnahmen nach Quelle');
  await expect(karte).toContainText('Belegung der Liegeplätze');
  await expect(karte).toContainText('Liegegeld');
  expect(await karte.innerText()).not.toMatch(/null|undefined|NaN/);
  const tage = await page.evaluate(() => window.hafenmeister.sim.state.stats.verlauf.length);
  await expect(page.locator('#hm-statistik .hm-st-geld .hm-st-saeule')).toHaveCount(tage + 1);
  await expect(page.locator('#hm-statistik .hm-st-belegung .hm-st-saeule')).toHaveCount(tage + 1);

  // Bedienung bleibt frei
  const hits = await page.evaluate((liste) => {
    const z = document.querySelector('#hm-statistik').getBoundingClientRect();
    const out = [];
    for (const s of liste) for (const x of document.querySelectorAll(s)) {
      if (x.offsetParent === null) continue;
      const r = x.getBoundingClientRect();
      if (r.width && Math.min(z.right, r.right) - Math.max(z.left, r.left) > 1 && Math.min(z.bottom, r.bottom) - Math.max(z.top, r.top) > 1) out.push(s);
    }
    return out;
  }, FREI);
  expect(hits, 'Statistik verdeckt Bedienung').toEqual([]);

  // Säule eines abgeschlossenen Tages wählen: Tag steht unten, Knopf zum Tagesabschluss
  const saeule = page.locator('#hm-statistik .hm-st-geld .hm-st-saeule').nth(2);
  const tag = await saeule.getAttribute('data-tag');
  await saeule.scrollIntoViewIfNeeded();
  await press(saeule, testInfo);
  await expect(page.locator('#hm-statistik .hm-st-tag-kopf')).toContainText(`Tag ${tag}`);
  const zumTag = page.locator('#hm-statistik .hm-st-zum-tag');
  await zumTag.scrollIntoViewIfNeeded();
  await press(zumTag, testInfo);
  await expect(karte).toBeHidden();
  await expect(page.locator('#hm-tagesabschluss')).toBeVisible();
  await expect(page.locator('#hm-tagesabschluss')).toHaveAttribute('data-tag', tag);

  // Aus dem Tagesabschluss zurück: Säulen öffnen die Statistik mit diesem Tag
  const balken = page.locator('#hm-tagesabschluss .hm-ta-zur-statistik');
  if (await balken.isVisible().catch(() => false)) {
    await press(balken, testInfo);
    await expect(karte).toBeVisible();
    await expect(page.locator('#hm-tagesabschluss')).toBeHidden();
    await expect(page.locator('#hm-statistik .hm-st-tag-kopf')).toContainText(`Tag ${tag}`);
  } else {
    await page.evaluate(() => { window.hafenmeister.tagesabschluss.schliesse(); window.hafenmeister.statistik.oeffnen(); });
    await expect(karte).toBeVisible();
  }
  if (!isTouchProject(testInfo)) {
    await page.keyboard.press('Escape');
    await expect(karte).toBeHidden();
    await page.keyboard.press('t');
    await expect(karte).toBeVisible();
  }
  await page.evaluate(() => window.hafenmeister.statistik.schliessen());
  await expect(karte).toBeHidden();
});
