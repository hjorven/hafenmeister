// Signalflaggen und Hafenwissen (P49, docs/signalflaggen.md): Gäste setzen Flaggen für ihre Wünsche,
// erfüllte holen sie ein, das Hafenwissen sammelt sich im Logbuch (Reiter "Wissen").
import { test, expect, ohneEinstieg } from '../helpers.mjs';

test('Signalflaggen wehen, ein Bau holt sie ein, das Lexikon zeigt sie', async ({ game }) => {
  test.setTimeout(150_000);
  const { page } = game;
  await page.goto('./?stufe=3&testtempo=40');
  await page.waitForFunction(() => !!window.hafenmeister?.sim?.state && !!window.hafenmeister.signalflaggen && !!window.hafenmeister.hafenwissen, null, { timeout: 45_000, polling: 100 });
  await ohneEinstieg(page);
  // Gäste kommen und setzen ihre Flaggen
  await expect.poll(() => page.evaluate(() => window.hafenmeister.signalflaggen.anzahl()), { timeout: 60_000 }).toBeGreaterThan(2);
  const stand = await page.evaluate(() => {
    const h = window.hafenmeister;
    const out = { falsch: [] };
    for (const b of Object.values(h.sim.state.boats)) {
      const soll = h.signalflaggen.soll(b.id);
      if (b.stationed && soll.length) out.falsch.push(`Fischer ${b.id} mit Flagge`);
      if (soll.length > 3) out.falsch.push(`${b.id}: ${soll.length} Flaggen`);
    }
    out.gesammelt = h.hafenwissen.fortschritt().gesehen;
    return out;
  });
  expect(stand.falsch).toEqual([]);
  expect(stand.gesammelt).toBeGreaterThan(1);

  // WLAN bauen (Stufe 3 beginnt ohne): Wer an der Box WLAN vermisst, holt K ein
  await expect.poll(() => page.evaluate(() => {
    const h = window.hafenmeister;
    return Object.values(h.sim.state.boats).filter((b) => b.status === 'moored' && h.signalflaggen.soll(b.id).includes('K')).length;
  }), { timeout: 90_000 }).toBeGreaterThan(0);
  const nach = await page.evaluate(async () => {
    const h = window.hafenmeister;
    h.setPaused(true);
    h.sim.state.money += 100000;
    const r = h.sim.upgradeFacility('wlan');
    const kap = h.sim.auslastung().wlan?.kapazitaet ?? 0;
    const wollen = Object.values(h.sim.state.boats).filter((b) => b.status === 'moored' && !b.stationed && b.wishes.includes('wlan')).length;
    const mitW = Object.values(h.sim.state.boats).filter((b) => b.status === 'moored' && h.signalflaggen.soll(b.id).includes('K')).length;
    return { ok: !!r?.ok, kap, wollen, mitW };
  });
  expect(nach.ok).toBe(true);
  if (nach.kap >= nach.wollen) expect(nach.mitW).toBe(0);

  // Lexikon im Logbuch
  // Ob schon ein Boot den Blauen Peter gesetzt hat, hängt vom Takt ab; darum hier sicher sammeln.
  // Ein noch fehlender Eintrag zeigt nur den Hinweis (???), nicht den Namen.
  await page.evaluate(() => {
    const hw = window.hafenmeister.hafenwissen;
    hw.sammeln('flagge-P');
    hw.oeffnen('flagge-P');
  });
  const panel = page.locator('#hm-logbuch');
  await expect(panel).toBeVisible();
  await expect(panel.locator('#hm-lb-tab-wissen')).toHaveAttribute('aria-selected', 'true');
  await expect(panel).toContainText('Papa');
  await panel.locator('.hm-lb-zurueck').click();
  await expect(panel.locator('.hm-hw-raster .hm-lb-karte')).toHaveCount(36);
  await page.keyboard.press('Escape');
});
