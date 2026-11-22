// Fotoaufträge und Postkarten (Paket P43, docs/fotoauftraege.md): Auftrag im Meldeplatz, Zettel und Knopf im
// Fotomodus, Postkarte mit Honorar, Reiter "Postkarten" im Logbuch. Zu früh am Tag: Knopf nicht gold, Zettel sagt warum.
import { test, expect, ohneEinstieg } from '../helpers.mjs';

// Rund 40 s je Test: Handy und PC reichen (wie grosse-ankunft.spec.mjs)
test.skip(({ projekt }) => projekt.startsWith('tablet'), 'Handy und PC reichen, CI-Zeit');

const ueberlappt = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

async function starte(page) {
  await page.addInitScript(() => { try { localStorage.setItem('hm-tagesabschluss-auto', 'aus'); } catch {} });
  await page.goto('./?stufe=2');
  await page.waitForFunction(() => !!window.hafenmeister?.sim?.state && !!window.hafenmeister.fotoauftraege && !!window.hafenmeister.logbuch,
    null, { timeout: 45_000, polling: 100 });
  await ohneEinstieg(page);
  await page.evaluate(() => window.hafenmeister.tagesziele?.waehle?.(0));
}

/** Spieluhr auf diese Stunde vorspulen (Tag 6:30 bis 19:00, danach Abend). */
async function uhr(page, stunde) {
  await page.evaluate((h) => {
    const g = window.hafenmeister;
    const L = g.sim.ctx.rules.dayLength;
    const ziel = h <= 19 ? ((h - 6.5) / 12.5) * L : L + ((h - 19) / 3) * 0.85 * g.sim.ctx.rules.eveningLength;
    const rest = ziel - g.sim.state.clock;
    if (rest > 0) g.sim.fastForward(rest);
  }, stunde);
}

test('Sonnenuntergang: Auftrag, goldener Knopf im Fotomodus, Postkarte mit Honorar im Logbuch', async ({ game }) => {
  test.setTimeout(120_000);
  const { page } = game;
  await starte(page);
  const a = await page.evaluate(() => window.hafenmeister.fotoauftraege.setze('abendrot'));
  expect(a.motiv).toBe('abendrot');
  // Meldung im Meldeplatz, nie über Zeit, Kassieren oder Bauen
  const meldung = page.locator('#hm-fotoauftrag');
  await expect(meldung).toBeVisible({ timeout: 30_000 });
  await expect(meldung).toContainText('Sonnenuntergang');
  const kasten = await meldung.boundingBox();
  for (const sel of ['#btn-menu', '#btn-build', '#btn-pause', '#money', '#hm-zeit']) {
    const k = await page.locator(sel).boundingBox().catch(() => null);
    if (k && kasten) expect(ueberlappt(kasten, k), `Meldung über ${sel}`).toBe(false);
  }
  // Abend vorspulen; die Boote, die in den Regeln schon liegen, sofort an ihre Plätze legen wie beim Laden
  // (vorgespult fahren sie sonst noch, und auf langsamen CI-Rechnern dauert das Hinfahren Minuten)
  await uhr(page, 19.3);
  await page.evaluate(() => window.hafenmeister.emit('sim:change', { reason: 'load' }));
  await expect.poll(() => page.evaluate(() => window.hafenmeister.boatView.boote.filter((b) => b.anim.moored && b.anim.berth?.kind !== 'buoy').length),
    { timeout: 15_000 }).toBeGreaterThanOrEqual(4);
  await page.locator('#btn-pause').click();
  await page.evaluate(() => window.hafenmeister.foto.an());
  const knopf = page.locator('.hm-fa-foto');
  const zettel = page.locator('#hm-fa-zettel');
  await expect(zettel).toBeVisible();
  await expect(zettel).toContainText('Sonnenuntergang');
  // Bild passt (mindestens drei Boote): Knopf gold
  await expect.poll(() => page.evaluate(() => window.hafenmeister.fotoauftraege.pruefeBild('abendrot')), { timeout: 15_000 })
    .toEqual({ ok: true });
  await expect(knopf).toHaveClass(/bereit/);
  // Zettel und Leiste im Bild, ohne sich zu überdecken
  const vp = page.viewportSize();
  const z = await zettel.boundingBox();
  const l = await page.locator('.hm-foto-leiste').boundingBox();
  for (const k of [z, l]) {
    expect(k.x).toBeGreaterThanOrEqual(0);
    expect(k.x + k.width).toBeLessThanOrEqual(vp.width + 0.5);
    expect(k.y + k.height).toBeLessThanOrEqual(vp.height + 0.5);
  }
  expect(ueberlappt(z, l)).toBe(false);
  const vorher = await page.evaluate(() => window.hafenmeister.sim.state.money);
  await knopf.click();
  await expect(page.locator('.hm-fa-pop')).toBeVisible();
  const nachher = await page.evaluate(() => window.hafenmeister.sim.state.money);
  expect(nachher - vorher).toBe(a.honorar);
  expect(await page.evaluate(() => window.hafenmeister.fotoauftraege.offen().length)).toBe(0);
  // Tagesabschluss: eigene Zeile unter Sonstiges
  expect(await page.evaluate(() => window.hafenmeister.sim.state.stats.heute?.details?.sonstiges?.postkarte ?? 0)).toBe(a.honorar);
  // Logbuch: Reiter "Postkarten" mit der neuen Karte
  await page.evaluate(() => { window.hafenmeister.foto.aus(); window.hafenmeister.logbuch.oeffnen('postkarten'); });
  const karte = page.locator('[data-postkarte="abendrot"]');
  await expect(karte).toBeVisible();
  await expect(karte).toHaveClass(/neu/);
  expect(await karte.locator('img').getAttribute('src')).toMatch(/^data:image\/jpeg/);
  await karte.click();
  await expect(page.locator('.hm-fa-sichern')).toBeVisible();
  await expect(page.locator('.hm-fa-gross .hm-fa-gruss')).toContainText('Grüße aus');
});

test('Zu früh am Tag: Knopf nicht gold, Zettel nennt die Uhrzeit; nichts wird gebucht', async ({ game }) => {
  test.setTimeout(90_000);
  const { page } = game;
  await starte(page);
  await uhr(page, 12);
  await page.evaluate(() => window.hafenmeister.fotoauftraege.setze('morgen'));
  await page.locator('#btn-pause').click();
  await page.evaluate(() => window.hafenmeister.foto.an());
  const zettel = page.locator('#hm-fa-zettel');
  await expect(zettel).toContainText('Uhrzeit');
  await expect(zettel).toContainText('8:30');
  const knopf = page.locator('.hm-fa-foto');
  await expect(knopf).toBeVisible();
  await expect(knopf).not.toHaveClass(/bereit/);
  const vorher = await page.evaluate(() => window.hafenmeister.sim.state.money);
  await knopf.click();
  expect(await page.evaluate(() => window.hafenmeister.sim.state.money)).toBe(vorher);
  expect(await page.evaluate(() => window.hafenmeister.fotoauftraege.offen().map((a) => a.motiv))).toEqual(['morgen']);
  // Fotomodus aus: Zettel weg
  await page.evaluate(() => window.hafenmeister.foto.aus());
  await expect(zettel).toBeHidden();
});
