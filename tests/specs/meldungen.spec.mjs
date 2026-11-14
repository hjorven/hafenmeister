// Meldungs-Ordnung (web/js/ui/meldungen.js): Tipp, Dauerplatz-Meldung, Morgen-Zettel, Kartenwahl, Tagesabschluss
// und Feier stehen nie gleichzeitig. Hier: Ein Tipp steht, dann kommt der Tagesabschluss. Der Tipp tritt zurück,
// solange Zettel oder Kartenwahl stehen, und kommt danach wieder.
import { test, expect } from '../helpers.mjs';

const MELDUNGEN = ['.hm-tipp', '#dauer-hinweis', '#hm-ta-zettel', '.hm-tafel > ul.tz-wahl', '#hm-tagesabschluss', '#hm-feier'];

const sichtbare = (page) => page.evaluate((liste) => liste.filter((sel) => [...document.querySelectorAll(sel)].some((e) => {
  if (e.hidden || e.closest('[hidden]')) return false;
  const c = getComputedStyle(e);
  if (c.display === 'none' || c.visibility === 'hidden') return false;
  const r = e.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
})), MELDUNGEN);

test('Meldungen: höchstens eine zugleich, der Tipp wartet auf Zettel und Kartenwahl', async ({ game }) => {
  test.setTimeout(90_000);
  const { page } = game;
  await page.waitForFunction(() => !!window.hafenmeister.sim?.state && !!window.hafenmeister.meldungen && !!window.hafenmeister.tagesabschluss, null, { timeout: 15_000 });
  await page.evaluate(() => {
    try { localStorage.setItem('hm-tagesabschluss-auto', 'aus'); } catch {}
    const g = window.hafenmeister;
    g.sim.newGame(42);
    g.einstieg.beenden();
    // Kartenwahl des ersten Tages erledigen, sonst wartet der Tipp (richtig) auf sie
    g.tagesziele?.waehle?.(0);
    g.emit('stammgast:neu', { boatId: 1 });
  });
  await expect.poll(() => page.evaluate(() => [document.querySelector('.hm-tipp').hidden ? 'verborgen' : 'sichtbar', JSON.stringify(window.hafenmeister.meldungen.stand()), window.hafenmeister.einstieg.schritt()].join(' ')), { timeout: 8000 }).toMatch(/^sichtbar/);

  // Bis zum nächsten Morgen vorspulen: der Zettel kommt, der Tipp tritt zurück
  for (let i = 0; i < 60; i++) {
    const tag = await page.evaluate(() => { const g = window.hafenmeister; g.sim.fastForward(5); return g.sim.state.day; });
    if (tag > 1) break;
  }
  await expect(page.locator('#hm-ta-zettel')).toBeVisible();
  // Einige Sekunden beobachten: nie zwei Meldungen zugleich
  for (let i = 0; i < 30; i++) {
    const s = await sichtbare(page);
    const st = s.length > 1 ? await page.evaluate(() => JSON.stringify([window.hafenmeister.meldungen.stand(), window.hafenmeister.einstieg.schritt()])) : '';
    expect(s.length, `gleichzeitig: ${s.join(', ')} ${st}`).toBeLessThanOrEqual(1);
    await page.waitForTimeout(250);
  }
  // Der Tipp ist nicht verloren: Er steht noch an und kommt, sobald nichts anderes mehr steht
  expect(await page.evaluate(() => window.hafenmeister.einstieg.schritt())).toBe('hinweis:stammgast');
  await page.evaluate(() => { window.hafenmeister.tagesabschluss.schliesse(); window.hafenmeister.tagesziele?.waehle?.(0); });
  await expect.poll(() => sichtbare(page), { timeout: 10_000 }).toEqual(['.hm-tipp']);
});
