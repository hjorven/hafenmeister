// Winterpause (docs/winter.md): Karte am ersten Wintertag, Winterarbeit beauftragen, Winter überspringen,
// Gruß zum Saisonbeginn. Auf allen Geräten: Knöpfe erreichbar, nichts verdeckt die Zeitsteuerung.
import { test, expect, isTouchProject } from '../helpers.mjs';

async function press(locator, testInfo) {
  if (isTouchProject(testInfo)) await locator.tap();
  else await locator.click();
}

test('Winterpause: Bilanz, Winterarbeit, Winter überspringen', async ({ game }, testInfo) => {
  test.setTimeout(90_000);
  const { page } = game;
  await page.waitForFunction(() => !!window.hafenmeister.sim && !!window.hafenmeister.winter?.angebote, null, { timeout: 15_000 });
  // Letzter Saisontag, Abend und Nacht vorspulen: erster Wintertag
  await page.evaluate(() => {
    const g = window.hafenmeister;
    g.einstieg?.beenden?.();
    g.tagesabschluss?.schliesse?.();
    try { localStorage.setItem('hm-tagesabschluss-auto', '0'); } catch { /* egal */ }
    const st = g.sim.state;
    st.money = 2000;
    st.facilities.wc = 1;
    st.day = g.sim.ctx.rules.seasonDays;
    for (let i = 0; i < 4 && st.day <= g.sim.ctx.rules.seasonDays; i++) g.sim.fastForward(1e6);
  });
  // Tagesabschluss (falls er kommt) geht vor, danach die Winterpause
  await page.evaluate(() => window.hafenmeister.tagesabschluss?.schliesse?.());
  const karte = page.locator('#hm-winter');
  await expect(karte).toBeVisible({ timeout: 15_000 });
  await expect(karte).toContainText('Winterpause');
  await expect(karte).toContainText('Winterarbeiten');
  await expect(page.locator('#hm-winter [data-auftrag]')).toHaveCount(3);

  const vorher = await page.evaluate(() => window.hafenmeister.sim.state.money);
  const knopf = page.locator('#hm-winter [data-auftrag="werbung"] button');
  await knopf.scrollIntoViewIfNeeded();
  await press(knopf, testInfo);
  await expect(knopf).toHaveText('Beauftragt');
  const nachher = await page.evaluate(() => window.hafenmeister.sim.state.money);
  expect(vorher - nachher).toBeGreaterThan(0);

  // Karte schließen, links über "Winterpause" wieder öffnen
  await press(page.locator('#hm-winter .hm-knopf', { hasText: 'Hafen ansehen' }), testInfo);
  await expect(karte).toBeHidden();
  await press(page.locator('.hm-winter-knopf'), testInfo);
  await expect(karte).toBeVisible();

  // Zeitsteuerung bleibt frei
  const zeit = await page.locator('#hm-zeit').boundingBox();
  const k = await karte.boundingBox();
  if (zeit && k) expect(k.y + k.height <= zeit.y + 1 || k.x >= zeit.x + zeit.width - 1, 'Winterkarte verdeckt die Zeitsteuerung').toBe(true);

  const ueber = page.locator('#hm-winter .hm-knopf', { hasText: 'Winter überspringen' });
  await ueber.scrollIntoViewIfNeeded();
  await press(ueber, testInfo);
  const r = await page.evaluate(() => { const g = window.hafenmeister; return { winter: g.sim.ctx && g.events?.season?.(g.sim.state.day)?.winter, tag: g.sim.state.day }; });
  expect(r.tag).toBe(await page.evaluate(() => { const c = window.hafenmeister.sim.ctx.rules; return c.seasonDays + c.winterDays + 1; }));
  // Die Kartenwahl der Tagesziele geht vor (Meldungs-Ordnung), danach kommt der Gruß zum Saisonbeginn
  const nehmen = page.locator('.hm-tafel > ul.tz-wahl .tz-nehmen').first();
  if (await nehmen.isVisible().catch(() => false)) await press(nehmen, testInfo);
  await expect(karte).toBeVisible({ timeout: 10_000 });
  await expect(karte).toContainText('Frühjahrswerbung');
  await expect(page.locator('.hm-winter-knopf')).toBeHidden();
});
