// Havarist einschleppen (P37, docs/havarie.md): Notruf im Meldeplatz, Box geben, Helfer kommt,
// Festmachen macht ihn zum Gast und Stammgast. Die Meldung liegt nie über Zeit, Kassieren oder Bauen.
import { test, expect } from '../helpers.mjs';

const ueberlappt = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

test('Havarist: Notruf, Box geben, einschleppen', async ({ game }) => {
  test.setTimeout(90_000);
  const { page } = game;
  await page.waitForFunction(() => !!window.hafenmeister?.havarie && !!window.hafenmeister.havarieBild?.havarist, null, { timeout: 30_000 });
  await page.evaluate(async () => {
    const g = window.hafenmeister;
    const sim = await import('./js/sim.js');
    g.einstieg?.beenden?.();
    sim.applyTestStage(g.sim.state, g.sim.ctx, 3);
    g.emit('stufe', 3);
    g.havarie.ausloesen();
  });
  const meldung = page.locator('#hm-havarie');
  await expect(meldung).toBeVisible({ timeout: 15_000 });
  await expect(meldung).toContainText('treibt vor der Einfahrt');
  await expect(meldung.locator('.hm-primaer')).toContainText('Box');

  // Liegt nicht über den Bedienelementen
  const m = await meldung.boundingBox();
  const mr = { left: m.x, top: m.y, right: m.x + m.width, bottom: m.y + m.height };
  for (const sel of ['#hm-zeit', '#btn-build', '#btn-collect']) {
    const el = page.locator(sel);
    if (!(await el.isVisible().catch(() => false))) continue;
    const b = await el.boundingBox();
    expect(ueberlappt(mr, { left: b.x, top: b.y, right: b.x + b.width, bottom: b.y + b.height }), `Meldung über ${sel}`).toBeFalsy();
  }

  // Das Bild steht: Havarist im Wasser
  expect(await page.evaluate(() => !!window.hafenmeister.havarieBild.havarist())).toBeTruthy();

  await meldung.locator('.hm-primaer').click();
  const nach = await page.evaluate(() => {
    const g = window.hafenmeister;
    const h = g.havarie.heute();
    return { phase: h?.phase, platz: h?.platz, zustand: g.sim.platzZustand?.(h?.platz) };
  });
  expect(nach.phase).toBe('zugewiesen');
  expect(nach.platz).toBeTruthy();
  await expect(meldung).toContainText(`Box ${nach.platz} ist frei gehalten`);
  await expect.poll(() => page.evaluate(() => !!window.hafenmeister.havarieBild.helfer()), { timeout: 10_000 }).toBeTruthy();

  // Festmachen (das Bild ruft es am Ende des Schlepps; hier direkt, damit der Test kurz bleibt)
  const fest = await page.evaluate(() => {
    const g = window.hafenmeister;
    const h = g.havarie.heute();
    g.havarie.festmachen();
    const b = g.sim.state.boats[h.boot.id];
    return { phase: g.havarie.heute()?.phase, status: b?.status, berth: b?.berthId, stamm: !!b?.stamm, gerettet: g.havarie.zahlen().gerettet };
  });
  expect(fest).toEqual({ phase: 'fest', status: 'moored', berth: nach.platz, stamm: true, gerettet: 1 });
  await expect.poll(() => page.evaluate(() => !window.hafenmeister.havarieBild.havarist()), { timeout: 5_000 }).toBeTruthy();
});

test('Havarist: Ablehnen kostet nichts', async ({ game }) => {
  test.setTimeout(60_000);
  const { page } = game;
  await page.waitForFunction(() => !!window.hafenmeister?.havarie && !!window.hafenmeister.havarieBild?.havarist, null, { timeout: 30_000 });
  const vorher = await page.evaluate(async () => {
    const g = window.hafenmeister;
    const sim = await import('./js/sim.js');
    g.einstieg?.beenden?.();
    sim.applyTestStage(g.sim.state, g.sim.ctx, 2);
    g.emit('stufe', 2);
    g.havarie.ausloesen();
    return g.sim.state.money;
  });
  const meldung = page.locator('#hm-havarie');
  await expect(meldung).toBeVisible({ timeout: 15_000 });
  await meldung.getByRole('button', { name: 'Ablehnen' }).click();
  await expect(meldung).toBeHidden();
  const r = await page.evaluate(() => ({ phase: window.hafenmeister.havarie.heute()?.phase, geld: window.hafenmeister.sim.state.money }));
  expect(r.phase).toBe('weg');
  expect(r.geld).toBeGreaterThanOrEqual(vorher);
});
