// Seltene Besucher (Paket P40, docs/besucher.md): Anmeldung per Funk mit Ehrenplatz, Meldung am
// Ehrenplatz, Foto im Fotomodus, Reiter "Besucher" im Logbuch, Erfolg "Hoher Besuch".
import { test, expect, ohneEinstieg, kameraRuhig } from '../helpers.mjs';

const ueberlappt = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

test('Seltene Besucher: Königsyacht am Ehrenplatz, Foto ins Logbuch', async ({ game }) => {
  test.setTimeout(240_000);
  const { page } = game;
  await page.goto('./?stufe=5&besucher=koenigsyacht');
  await page.waitForFunction(() => !!window.hafenmeister?.sim?.state && !!window.hafenmeister.besucher, null, { timeout: 45_000, polling: 100 });
  await ohneEinstieg(page);
  await page.evaluate(() => {
    try { localStorage.setItem('hm-tagesabschluss-auto', 'aus'); } catch {}
    window.hafenmeister.tagesziele?.waehle?.(0);
  });
  // ?besucher=koenigsyacht: das nächste Boot wird zur Königsyacht und meldet sich an
  await expect.poll(() => page.evaluate(() => window.hafenmeister.besucher.heute()?.art ?? null), { timeout: 30_000 }).toBe('koenigsyacht');
  const meldung = page.locator('#hm-besucher');
  await expect(meldung).toBeVisible({ timeout: 30_000 });
  await expect(meldung).toContainText('Königsyacht');
  expect(await page.evaluate(() => window.hafenmeister.meldungen?.imPlatz?.(document.getElementById('hm-besucher')) ?? true)).toBe(true);
  const kasten = await meldung.boundingBox();
  for (const sel of ['#btn-menu', '#btn-build', '#btn-pause', '#money']) {
    const k = await page.locator(sel).boundingBox().catch(() => null);
    if (k && kasten) expect(ueberlappt(kasten, k), `Meldung über ${sel}`).toBe(false);
  }
  // Ehrenplatz freihalten: am Kai (angehalten, sonst ist die Yacht schon da, bevor der Test liest)
  await page.locator('#btn-pause').click();
  await expect.poll(() => page.evaluate(() => !!window.hafenmeister.paused)).toBe(true);
  const halten = meldung.locator('.hm-primaer');
  await expect(halten).toContainText('freihalten');
  await halten.click();
  const platz = await page.evaluate(() => {
    const g = window.hafenmeister;
    const h = g.besucher.heute();
    const b = g.sim.state.upcoming.find((x) => x.id === h.boatId) ?? g.sim.state.boats[h.boatId];
    return b?.funk?.platz ?? null;
  });
  expect(platz).toMatch(/^K/);
  await expect(meldung).toContainText(`Ehrenplatz ${platz}`);
  await page.locator('#btn-pause').click();

  // Vorspulen, bis sie am Ehrenplatz liegt
  await page.evaluate(() => {
    const g = window.hafenmeister;
    for (let n = 0; n < 300 && g.besucher.heute()?.phase !== 'fest'; n++) g.sim.fastForward(1);
  });
  const heute = await page.evaluate(() => window.hafenmeister.besucher.heute());
  expect(heute.phase).toBe('fest');
  expect(heute.platz).toBe(platz);
  expect(heute.ehrenplatz).toBe(true);
  await expect(meldung).toContainText('liegt am Ehrenplatz', { timeout: 30_000 });
  // Chronik und Erfolg
  await expect.poll(() => page.evaluate(() => JSON.stringify(window.hafenmeister.sim.state.modules.logbuch?.offen ?? [])), { timeout: 10_000 }).toContain('Königsyacht');

  // "Foto": Fotomodus, Kamera fliegt hin, der goldene Knopf bringt das Bild ins Logbuch
  await meldung.locator('.hm-primaer').click();
  await expect(page.locator('body')).toHaveClass(/foto/);
  // Die Yacht fährt noch an ihren Platz: der Knopf führt die Kamera, bis sie groß genug im Bild ist
  const knopf = page.locator('.hm-bs-foto');
  await expect(knopf).toBeVisible();
  await expect.poll(async () => {
    await kameraRuhig(page).catch(() => {});
    const ok = await page.evaluate(() => window.hafenmeister.besucher.imBild('koenigsyacht')?.ok ?? false);
    if (!ok) await page.evaluate(() => window.hafenmeister.besucher.fotografiere());
    return ok;
  }, { timeout: 60_000, intervals: [500] }).toBe(true);
  await expect(knopf).toHaveClass(/bereit/);
  // Auf schmalen Bildschirmen steht die kurze Aufschrift, die Leiste bleibt in einer Zeile im Bild
  const leiste = await page.locator('.hm-foto-leiste').boundingBox();
  expect(leiste.x).toBeGreaterThanOrEqual(0);
  expect(leiste.x + leiste.width).toBeLessThanOrEqual(page.viewportSize().width + 1);
  await knopf.click();
  await expect.poll(() => page.evaluate(() => (window.hafenmeister.sim.state.modules.besucher.fotos.koenigsyacht?.bild ?? '').slice(0, 11)), { timeout: 10_000 }).toBe('data:image/');
  await expect(knopf).toHaveClass(/fertig/);
  await page.keyboard.press('Escape');
  await expect(page.locator('body')).not.toHaveClass(/(^|\s)foto(\s|$)/);

  // Logbuch, Reiter "Besucher": Foto der Königsyacht, die anderen als Schattenriss
  await page.evaluate(() => window.hafenmeister.logbuch.oeffnen('besucher'));
  const fenster = page.locator('#hm-logbuch');
  await expect(fenster).toBeVisible();
  await expect(fenster.locator('#hm-lb-tab-besucher')).toHaveAttribute('aria-selected', 'true');
  // Sechs seltene Besucher und drei Hafentiere (P51)
  await expect(fenster.locator('.hm-bs-karte')).toHaveCount(9);
  const karte = fenster.locator('.hm-bs-karte[data-besucher="koenigsyacht"]');
  await expect(karte).toHaveClass(/foto/);
  await expect(karte).toContainText('Königsyacht');
  const selten = ':not([data-besucher="katze"]):not([data-besucher="hund"]):not([data-besucher="reiher"])';
  await expect(fenster.locator(`.hm-bs-karte.fehlt${selten}`)).toHaveCount(5);
  await karte.click();
  await expect(fenster.locator('.hm-bs-steckbrief')).toContainText('Lag am Ehrenplatz');
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.hafenmeister.erfolge?.erreicht?.('hoher-besuch') ?? true), { timeout: 10_000 }).toBe(true);
  expect(game.problems).toEqual([]);
});

test('Seltene Besucher: Schwanenfamilie schwimmt durchs Bild und lässt sich fotografieren', async ({ game }) => {
  test.setTimeout(120_000);
  const { page } = game;
  await page.goto('./?besucher=schwaene');
  await page.waitForFunction(() => !!window.hafenmeister?.sim?.state && !!window.hafenmeister.besucher, null, { timeout: 45_000, polling: 100 });
  await ohneEinstieg(page);
  await expect.poll(() => page.evaluate(() => window.hafenmeister.besucherTiere?.aktiv?.() ?? []), { timeout: 30_000 }).toContain('schwaene');
  // Die Schwäne schwimmen im Wasser, nie an Land
  const imWasser = await page.evaluate(() => {
    const g = window.hafenmeister;
    const t = g.besucherTiere._tiere.get('schwaene');
    return t.tiere.every((s) => (g.landscape?.istWasser ? g.landscape.istWasser(s.obj.position.x, s.obj.position.z) : true));
  });
  expect(imWasser).toBe(true);
  await expect(page.locator('#hm-besucher')).toContainText('Schwanenfamilie', { timeout: 30_000 });
  await page.locator('#hm-besucher .hm-primaer').click();
  await expect(page.locator('body')).toHaveClass(/foto/);
  await expect.poll(async () => {
    await kameraRuhig(page).catch(() => {});
    const ok = await page.evaluate(() => window.hafenmeister.besucher.imBild('schwaene')?.ok ?? false);
    if (!ok) await page.evaluate(() => window.hafenmeister.besucher.fotografiere());
    return ok;
  }, { timeout: 45_000, intervals: [500] }).toBe(true);
  await page.locator('.hm-bs-foto').click();
  await expect.poll(() => page.evaluate(() => !!window.hafenmeister.sim.state.modules.besucher.fotos.schwaene), { timeout: 10_000 }).toBe(true);
  expect(game.problems).toEqual([]);
});
