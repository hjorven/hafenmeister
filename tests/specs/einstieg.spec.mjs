// Einstieg, Hinweise beim ersten Mal und Hilfe (docs/einstieg.md, Roadmap P03: J6 bis J8, O7).
// Prüft, dass jedes Ziel, auf das ein Hinweiskreis zeigt, im Spiel existiert und sichtbar ist,
// dass die Texte nichts Gelöschtes nennen und dass Hilfe und „Einstieg wiederholen“ funktionieren.
import { test, expect, isTouchProject } from '../helpers.mjs';

async function press(locator, testInfo) {
  if (isTouchProject(testInfo)) await locator.tap();
  else await locator.click();
}

const bereit = (page) => page.waitForFunction(() => !!window.hafenmeister.sim && !!window.hafenmeister.einstieg && !!window.hafenmeister.hilfe, null, { timeout: 15_000 });

test('Einstieg: jedes Hinweisziel existiert, keine Texte zu Gelöschtem', async ({ game }, testInfo) => {
  const { page } = game;
  await bereit(page);
  // Ziele der Schritte 4 bis 6 und des Stufen-Hinweises (Schritte 1 bis 3 zeigen auf Bojen, Boote, Münzen in 3D)
  await expect(page.locator('#btn-build'), 'Ziel von „Hafen ausbauen“').toBeVisible();
  await expect(page.locator('.hm-tempo-knopf[data-tempo="tempo2"]'), 'Ziel von „Der Tag läuft“').toBeVisible();
  const quer = await page.evaluate(() => matchMedia('(max-height: 499px) and (orientation: landscape)').matches);
  // Handy quer: die Seitenleiste tritt hinter die Blase zurück, Schritt 6 entfällt dort (einstieg.js, ohneZiele)
  if (!quer) await expect(page.locator('.hm-tafel > button'), 'Ziel von „Tagesziele“').toBeVisible();
  // Bojen für Schritt 1
  expect(await page.evaluate(() => (window.hafenmeister.landscape?.warteplaetze?.bojen ?? []).length)).toBeGreaterThan(0);

  const texte = await page.evaluate(async () => {
    const e = await import('./js/features/einstieg.js');
    const h = await import('./js/features/hilfe.js');
    return [...Object.values(e.TEXTE), ...Object.values(e.HINWEISE), ...h.KARTEN]
      .flatMap((t) => [t.titel, t.text, t.kurz].filter(Boolean));
  });
  for (const t of texte) {
    expect(t, 'Die Sonne ist kein Bedienelement mehr').not.toMatch(/Sonne/);
    expect(t, 'Die alte Warteleiste gibt es nicht mehr').not.toMatch(/Leiste/);
  }
  // Genannte Knöpfe gibt es wirklich
  await expect(page.locator('#btn-build')).toContainText('Bauen');
  // Bilder der Hilfe stammen aus ui/pixel-symbole.js
  const fehlend = await page.evaluate(async () => {
    const { PIXEL } = await import('./js/ui/pixel-symbole.js');
    const { KARTEN } = await import('./js/features/hilfe.js');
    return KARTEN.map((k) => k.bild).filter((b) => !PIXEL[b]);
  });
  expect(fehlend).toEqual([]);
  void testInfo;
});

test('Hilfe im Menü: sechs Bilder, Einstieg wiederholen', async ({ game }, testInfo) => {
  const { page } = game;
  await bereit(page);
  await page.evaluate(() => window.hafenmeister.einstieg.beenden());
  expect(await page.evaluate(() => window.hafenmeister.einstieg.schritt())).toBe(null);

  await press(page.locator('#btn-menu'), testInfo);
  const knopf = page.locator('#hm-menue #btn-hilfe');
  await expect(knopf).toBeVisible();
  await press(knopf, testInfo);
  const tafel = page.locator('#hm-hilfe');
  await expect(tafel).toBeVisible();
  await expect(tafel.locator('li')).toHaveCount(6);
  await expect(tafel.locator('li svg.hm-pixelbild')).toHaveCount(6);
  // Die Tafel passt ins Bild
  const box = await tafel.boundingBox();
  const vp = page.viewportSize();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);

  await press(tafel.getByRole('button', { name: 'Einstieg wiederholen' }), testInfo);
  await expect(tafel).toBeHidden();
  // Unter Last kommt der Klick spaet an: grosszuegig warten, unabhaengig vom Bildtakt pruefen
  await page.waitForFunction(() => window.hafenmeister.einstieg.schritt() !== null, null, { timeout: 20_000, polling: 100 });
  expect(await page.evaluate(() => window.hafenmeister.sim.state.modules.einstieg.fertig)).toBe(false);
});

test('Hinweis beim ersten Mal: erscheint einmal, „Verstanden“ schließt ihn', async ({ game }, testInfo) => {
  const { page } = game;
  await bereit(page);
  await page.evaluate(() => window.hafenmeister.einstieg.beenden());
  await page.evaluate(() => window.hafenmeister.emit('sim:turnedAway', { boatId: 999, reason: 'patience', rated: false }));
  const tipp = page.locator('.hm-tipp');
  await expect(tipp).toBeVisible({ timeout: 30_000 });
  await expect(tipp).toContainText('weitergefahren');
  await press(tipp.getByRole('button', { name: 'Verstanden' }), testInfo);
  await expect(tipp).toBeHidden();
  // Ein zweites Mal kommt er nicht
  await page.evaluate(() => window.hafenmeister.emit('sim:turnedAway', { boatId: 998, reason: 'patience', rated: false }));
  await page.waitForTimeout(1000);
  await expect(tipp).toBeHidden();
  expect(await page.evaluate(() => window.hafenmeister.sim.state.modules.einstieg.hinweise)).toContain('geduld');
});
