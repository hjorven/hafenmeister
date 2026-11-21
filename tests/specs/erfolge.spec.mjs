// Erfolge (web/js/features/erfolge.js, docs/erfolge.md): ein neuer Erfolg meldet sich rechts oben, steht in
// der Chronik und im Reiter "Erfolge" des Logbuchs und stellt sein Ding im Hafen auf.
import { test, expect, ohneEinstieg } from '../helpers.mjs';

test('Erfolge: Meldung, Reiter im Logbuch, Chronik und Dinge im Hafen', async ({ game }) => {
  test.setTimeout(240_000);
  const { page } = game;
  await page.waitForFunction(() => !!window.hafenmeister.sim?.state && !!window.hafenmeister.erfolge, null, { timeout: 30_000, polling: 100 });
  await ohneEinstieg(page);
  await page.evaluate(() => {
    try { localStorage.setItem('hm-tagesabschluss-auto', 'aus'); } catch {}
    window.hafenmeister.tagesziele?.waehle?.(0);
  });
  // Neues Spiel: noch nichts erreicht
  expect(await page.evaluate(() => window.hafenmeister.erfolge.erreicht('erste-leine'))).toBe(false);
  // Ein Boot legt an: "Erste Leine fest"
  await page.evaluate(() => {
    const s = window.hafenmeister.sim;
    for (let n = 0; n < 600 && !s.state.stats.heute?.angelegt; n++) {
      s.fastForward(2);
      for (const b of s.waitingBoats?.() ?? []) { try { s.autoEnter(b.id); } catch {} }
    }
  });
  await expect.poll(() => page.evaluate(() => window.hafenmeister.erfolge.erreicht('erste-leine')), { timeout: 30_000 }).toBe(true);
  const meldung = page.locator('#hm-ef-meldung .hm-ef-meldung');
  await expect(meldung).toBeVisible({ timeout: 30_000 });
  await expect(meldung).toContainText('Erste Leine fest');
  // Zeiger auf die Meldung: dann bleibt sie stehen, solange der Test prüft (unter Last dauert das länger
  // als die 4,2 s, die sie sonst steht). Signal: die Meldung hält (Zeiger darüber).
  await meldung.hover({ force: true });   // force: nicht auf das Ende des Hereinschiebens warten
  await expect.poll(() => page.evaluate(() => window.hafenmeister.erfolge.meldungHaelt?.() ?? false), { timeout: 5_000 }).toBe(true);
  // steht im gemeinsamen Meldeplatz (ui/meldungen.js)
  expect(await page.evaluate(() => window.hafenmeister.meldungen?.imPlatz?.(document.getElementById('hm-ef-meldung')) ?? true)).toBe(true);
  // Die Meldung verdeckt keine Knöpfe (nach dem Hereinschieben gemessen)
  await page.waitForTimeout(400);
  const box = await meldung.boundingBox();
  for (const sel of ['#btn-menu', '#btn-build', '#btn-pause', '#money']) {
    const k = await page.locator(sel).boundingBox().catch(() => null);
    if (!k || !box) continue;
    const ueber = box.x < k.x + k.width && box.x + box.width > k.x && box.y < k.y + k.height && box.y + box.height > k.y;
    expect(ueber, `Meldung über ${sel}`).toBe(false);
  }
  // Chronik des Tages
  const chronik = await page.evaluate(() => {
    const s = window.hafenmeister.sim.state;
    return JSON.stringify([...(s.modules.logbuch?.offen ?? []), ...(s.modules.logbuch?.chronik ?? []).flatMap((z) => z.merk ?? [])]);
  });
  expect(chronik).toContain('Erfolg: Erste Leine fest');

  // Antippen öffnet den Reiter "Erfolge"
  await meldung.click();
  const fenster = page.locator('#hm-logbuch');
  await expect(fenster).toBeVisible();
  await expect(fenster.locator('#hm-lb-tab-erfolge')).toHaveAttribute('aria-selected', 'true');
  await expect(fenster.locator('.hm-ef-karte.da')).toHaveCount(1);
  await expect(fenster.locator('.hm-ef-karte.neu')).toHaveCount(1);
  await expect(fenster.locator('.hm-ef-karte.da')).toContainText('Erste Leine fest');
  const alle = await page.evaluate(() => window.hafenmeister.erfolge.ansicht().flatMap((g) => g.erfolge).length);
  await expect(fenster.locator('.hm-ef-karte')).toHaveCount(alle);
  await expect(fenster.locator('.hm-lb-stand-text b')).toHaveText(`1 von ${alle}`);
  // Offene Erfolge zeigen ihren Fortschritt
  await expect(fenster.locator('.hm-ef-karte[data-erfolg="massarbeit"] .hm-ef-fortschritt')).toBeVisible();
  // Reiterwechsel und zurück, Schließen mit Esc
  await fenster.locator('#hm-lb-tab-chronik').click();
  await expect(fenster.locator('#hm-lb-tab-chronik')).toHaveAttribute('aria-selected', 'true');
  await fenster.locator('#hm-lb-tab-erfolge').click();
  await expect(fenster.locator('.hm-ef-karte.neu')).toHaveCount(0);   // angesehen, wie im Logbuch
  await page.keyboard.press('Escape');
  await expect(fenster).toBeHidden();
  // nach dem Ansehen nicht mehr neu
  expect(await page.evaluate(() => window.hafenmeister.sim.state.modules.erfolge.neu.length)).toBe(0);

  // Ding im Hafen: der Erfolgsmast steht mit einem Wimpel
  await expect.poll(() => page.evaluate(() => {
    const g = window.hafenmeister;
    const mast = g.scene.getObjectByName('deko-erfolg-mast');
    return !!mast?.visible && !!g.zielDeko?.lage('erfolg-mast');
  }), { timeout: 15_000 }).toBe(true);

  // Speichern und Laden: bleibt erreicht, keine zweite Meldung
  const nachLaden = await page.evaluate(async () => {
    const g = window.hafenmeister;
    const json = JSON.stringify(g.sim.state);
    g.emit('spielstand-geladen', JSON.parse(json));
    await new Promise((r) => setTimeout(r, 300));
    return { erreicht: g.erfolge.erreicht('erste-leine'), meldung: !!document.querySelector('#hm-ef-meldung .hm-ef-meldung') };
  });
  expect(nachLaden.erreicht).toBe(true);
  expect(nachLaden.meldung).toBe(false);
});

test('Erfolge: alter Spielstand in Stufe 4 trägt Stufenschilder still nach', async ({ game }) => {
  const { page } = game;
  await page.waitForFunction(() => !!window.hafenmeister.sim?.state && !!window.hafenmeister.erfolge, null, { timeout: 30_000, polling: 100 });
  await ohneEinstieg(page);
  const r = await page.evaluate(async () => {
    const g = window.hafenmeister;
    const s = JSON.parse(JSON.stringify(g.sim.state));
    s.stage = 4;
    delete s.modules.erfolge;
    const meldungen = [];
    g.on('erfolg:neu', (e) => meldungen.push(e.id));
    g.emit('spielstand-geladen', s);
    await new Promise((r) => setTimeout(r, 300));
    const m = g.sim.state.modules.erfolge;
    return { meldungen, schilder: ['stufe-2', 'stufe-3', 'stufe-4'].map((id) => !!m?.erreicht[id]?.nach), dinge: g.erfolge.dinge() };
  });
  expect(r.meldungen).toEqual([]);
  expect(r.schilder).toEqual([true, true, true]);
  expect(r.dinge.schilder).toEqual([2, 3, 4]);
});
