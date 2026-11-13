// Tagesabschluss (docs/tagesabschluss.md): Zettel und Karte am Tagesende.
// Prüft: kein "null" im Text, der Zettel und die geöffnete Karte verdecken keine Bedienung
// (Statusleiste, linke Spalte, Zeit, Kassieren, Bauen, Knöpfe oben rechts).
import { test, expect, isTouchProject } from '../helpers.mjs';

const BEDIENUNG = ['.hm-status', '.hm-werkzeuge', '#weather-chip', '.hm-tafel > button', '#hm-ziel > *', '#hm-zeit', '#btn-collect', '#btn-build'];

async function ueberdeckt(page, sel) {
  return page.evaluate(([sel, liste]) => {
    const z = document.querySelector(sel).getBoundingClientRect();
    const hits = [];
    for (const s of liste) for (const x of document.querySelectorAll(s)) {
      if (x.offsetParent === null) continue;
      const r = x.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (Math.min(z.right, r.right) - Math.max(z.left, r.left) > 1 && Math.min(z.bottom, r.bottom) - Math.max(z.top, r.top) > 1) hits.push(`${s} ${[r.left, r.top, r.right, r.bottom].map(Math.round).join(',')}`);
    }
    return hits;
  }, [sel, BEDIENUNG]);
}

test('Tagesabschluss: Zettel ohne "null", Karte verdeckt keine Bedienung', async ({ game }, testInfo) => {
  test.setTimeout(90_000);
  const { page } = game;
  await page.waitForFunction(() => !!window.hafenmeister.sim?.state && !!window.hafenmeister.tagesabschluss, null, { timeout: 15_000 });
  // Ohne automatische Karte: dann kommt auf jedem Gerät der Zettel
  await page.evaluate(() => {
    try { localStorage.setItem('hm-tagesabschluss-auto', 'aus'); } catch {}
    const g = window.hafenmeister;
    g.sim.newGame(42);
    g.einstieg?.beenden?.();
  });
  for (let i = 0; i < 60; i++) {
    const tag = await page.evaluate(() => {
      const g = window.hafenmeister;
      g.einstieg?.beenden?.();
      g.sim.fastForward(5);
      return g.sim.state.day;
    });
    if (tag > 1) break;
  }
  const zettel = page.locator('#hm-ta-zettel');
  await expect(zettel).toBeVisible();
  const text = await zettel.innerText();
  expect(text).not.toContain('null');
  expect(text).not.toContain('undefined');
  expect(text).toMatch(/\+ [\d.]+ €/);
  // Schilder erscheinen teils ein Bild später; Zettel und Karte messen dann neu
  await expect.poll(() => ueberdeckt(page, '#hm-ta-zettel'), { message: 'Zettel verdeckt', timeout: 3000 }).toEqual([]);

  // Der Zettel bleibt nur 5 s (Echtzeit). Unter Last kann er vor dem Antippen schon weg sein;
  // dann öffnet der Test die Karte über die Schnittstelle, geprüft wird sie trotzdem.
  try {
    if (isTouchProject(testInfo)) await zettel.tap({ timeout: 2000 }); else await zettel.click({ timeout: 2000 });
  } catch {
    await page.evaluate(() => window.hafenmeister.tagesabschluss.zeige());
  }
  const karte = page.locator('#hm-tagesabschluss');
  await expect(karte).toBeVisible();
  expect(await karte.innerText()).not.toMatch(/\bnull\b|undefined/);
  // Schalter "Abends zeigen" wird nicht abgeschnitten (iPhone quer: Fuß nur etwa 200 px breit)
  const schalter = karte.locator('.hm-ta-auto span');
  expect(await schalter.evaluate((e) => e.scrollWidth - e.clientWidth)).toBeLessThanOrEqual(0);
  await expect.poll(() => ueberdeckt(page, '#hm-tagesabschluss'), { message: 'Karte verdeckt', timeout: 3000 }).toEqual([]);
  const weiter = karte.locator('.hm-ta-weiter');
  await expect(weiter).toBeInViewport({ ratio: 1 });
  if (isTouchProject(testInfo)) await weiter.tap(); else await weiter.click();
  await expect(karte).toBeHidden();
});
