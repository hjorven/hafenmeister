// Hafenname und eigene Flagge (P44, docs/hafenflagge.md): Fenster aus dem Menü, präparierter Name bleibt Text
// (Audit C05), Flagge und Name überstehen Neuladen, Neues Spiel übernimmt die gebaute Flagge.
import { test, expect, isTouchProject } from '../helpers.mjs';

async function press(locator, testInfo) {
  if (isTouchProject(testInfo)) await locator.tap();
  else await locator.click();
}

async function bereit(page) {
  await page.waitForFunction(() => !!window.hafenmeister?.sim?.state && !!window.hafenmeister.hafenflagge && !!window.hafenmeister.hafenflaggeBild, null, { timeout: 30_000, polling: 100 });
  await page.evaluate(() => window.hafenmeister.einstieg?.beenden?.());
}

test('Name und Flagge: präparierter Name bleibt Text, Flagge wird gespeichert', async ({ game }, testInfo) => {
  test.setTimeout(120_000);
  const { page } = game;
  await bereit(page);

  // Über das Menü öffnen
  await press(page.locator('#btn-menu'), testInfo);
  const zeile = page.locator('#hm-menue #btn-hafenflagge');
  await expect(zeile).toBeVisible();
  await press(zeile, testInfo);
  const fenster = page.locator('#hm-hafenflagge');
  await expect(fenster).toBeVisible();
  await expect(page.locator('#hm-fl-ok')).toBeDisabled();

  // Fenster passt auf den Bildschirm
  const r = await fenster.boundingBox();
  const vp = page.viewportSize();
  expect(r.x).toBeGreaterThanOrEqual(0);
  expect(r.x + r.width).toBeLessThanOrEqual(vp.width + 1);
  expect(r.y + r.height).toBeLessThanOrEqual(vp.height + 1);

  // Präparierter Name (vorher zählen, wie viele Bilder und Skripte die Seite selbst hat)
  // Bilder, die das Spiel selbst als data:-Bild zeigt (z. B. Meldung "Neu im Hafenwissen"), kommen und gehen; sie zählen nicht.
  const FREMD = 'script, img:not([src^="data:"])';
  const vorher = await page.evaluate((sel) => document.querySelectorAll(sel).length, FREMD);
  const boese = '<img src=x onerror="window.__xss=1">Haff<script>window.__xss=2</script>';
  await page.locator('#hm-hafen-name').fill(boese);
  await expect(page.locator('.hm-fl-name-rest')).toContainText('Wird gespeichert als');

  // Flagge: Nordisches Kreuz, Farbe 1 Gelb, Zeichen Anker
  await press(page.locator('#hm-hafenflagge [data-muster="kreuz"]'), testInfo);
  await press(page.locator('#hm-hafenflagge [data-reiter="farbe0"]'), testInfo);
  await press(page.locator('#hm-hafenflagge [data-farbe="gelb"]'), testInfo);
  await press(page.locator('#hm-hafenflagge [data-reiter="zeichen"]'), testInfo);
  await press(page.locator('#hm-hafenflagge [data-zeichen="anker"]'), testInfo);
  const ok = page.locator('#hm-fl-ok');
  await expect(ok).toBeEnabled();
  await ok.scrollIntoViewIfNeeded();
  await press(ok, testInfo);
  await expect(fenster).toBeHidden();

  const nach = await page.evaluate((sel) => ({
    name: window.hafenmeister.sim.state.harborName,
    flagge: window.hafenmeister.sim.state.flagge,
    titel: document.title,
    xss: window.__xss ?? null,
    bilder: document.querySelectorAll('img[src="x"]').length,
    alle: document.querySelectorAll(sel).length,
    mast: window.hafenmeister.hafenflaggeBild.mast.visible,
  }), FREMD);
  expect(nach.xss).toBeNull();
  expect(nach.bilder).toBe(0);
  expect(nach.alle).toBe(vorher);
  expect(nach.name).not.toMatch(/[<>"]/);
  expect(nach.name).toContain('Haff');
  expect([...nach.name].length).toBeLessThanOrEqual(32);
  expect(nach.titel).toContain(nach.name);
  expect(nach.flagge).toMatchObject({ muster: 'kreuz', zeichen: 'anker' });
  expect(nach.flagge.farben[0]).toBe('gelb');
  expect(nach.mast).toBe(true);

  // Name steht auch in der Liste der Spielstände als Text
  const platz = await page.evaluate(() => window.hafenmeister.spielstand.platz()?.name);
  expect(platz).toBe(nach.name);

  // Neu laden: Name und Flagge bleiben
  await page.evaluate(() => window.hafenmeister.spielstand.speichern());
  await page.reload();
  await bereit(page);
  const geladen = await page.evaluate(() => ({ name: window.hafenmeister.sim.state.harborName, flagge: window.hafenmeister.sim.state.flagge }));
  expect(geladen).toEqual({ name: nach.name, flagge: nach.flagge });

  // Antippen von Mast oder Schild öffnet das Fenster wieder, Esc schließt
  await page.evaluate(() => window.hafenmeister.emit('tap', { pick: { type: 'building', id: 'hafenflagge' } }));
  await expect(fenster).toBeVisible();
  await expect(page.locator('#hm-hafen-name')).toHaveValue(nach.name);
  await page.keyboard.press('Escape');
  await expect(fenster).toBeHidden();
});

test('Neues Spiel: gebaute Flagge kommt mit in den neuen Hafen', async ({ game }, testInfo) => {
  test.skip(testInfo.project.name !== 'pc' && testInfo.project.name !== 'handy', 'reicht auf PC und Handy');
  test.setTimeout(120_000);
  const { page } = game;
  await bereit(page);
  await page.evaluate(() => window.hafenmeister.spielstand.neuesSpiel());
  const neu = page.locator('.hm-sp');
  await expect(neu).toContainText('Flagge');
  await page.locator('#hm-neu-name').fill('Flaggenhafen');
  await press(page.locator('.hm-sp [data-muster="drei"]'), testInfo);
  await press(page.locator('.hm-sp [data-reiter="farbe1"]'), testInfo);
  await press(page.locator('.hm-sp [data-farbe="weiss"]'), testInfo);
  const los = page.locator('#hm-neu-los');
  await los.scrollIntoViewIfNeeded();
  await Promise.all([page.waitForEvent('load'), press(los, testInfo)]);
  await bereit(page);
  const st = await page.evaluate(() => ({ name: window.hafenmeister.sim.state.harborName, flagge: window.hafenmeister.sim.state.flagge }));
  expect(st.name).toBe('Flaggenhafen');
  expect(st.flagge.muster).toBe('drei');
  expect(st.flagge.farben[1]).toBe('weiss');
});
