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
  await page.waitForFunction(() => !!window.hafenmeister.sim?.state && !!window.hafenmeister.tagesabschluss, null, { timeout: 30_000, polling: 100 });
  // Ohne automatische Karte: dann kommt auf jedem Gerät der Zettel
  await page.evaluate(() => {
    try { localStorage.setItem('hm-tagesabschluss-auto', 'aus'); } catch {}
    const g = window.hafenmeister;
    g.sim.newGame(42);
    g.einstieg?.beenden?.();
  });
  // Der Zettel steht nur 5 s Echtzeit, seine Uhr zählt aber höchstens 0,25 s je Bild, also mindestens
  // 20 Bilder. Unter Last (viele Browser mit Software-Grafik) vergingen zwischen zwei Testbefehlen
  // mehr als 5 s und der Zettel war schon weg. Daher prüft der Browser ihn selbst, im selben Aufruf
  // in dem er erscheint, und höchstens 12 Bilder später: das liegt sicher in seiner Standzeit.
  let befund = null;
  for (let i = 0; i < 60 && !befund; i++) {
    befund = await page.evaluate(([liste]) => {
      const g = window.hafenmeister;
      g.einstieg?.beenden?.();
      g.sim.fastForward(5);
      // Der Zettel kommt schon zu Beginn des Abends ('sim:dayEnd'), nicht erst mit dem neuen Tag
      const z = document.querySelector('#hm-ta-zettel');
      if (z.hidden && g.sim.state.day <= 1) return null;
      const decken = () => {
        const a = z.getBoundingClientRect();
        const hits = [];
        for (const s of liste) for (const x of document.querySelectorAll(s)) {
          if (x.offsetParent === null) continue;
          const r = x.getBoundingClientRect();
          if (!r.width || !r.height) continue;
          if (Math.min(a.right, r.right) - Math.max(a.left, r.left) > 1 && Math.min(a.bottom, r.bottom) - Math.max(a.top, r.top) > 1) hits.push(`${s} ${[r.left, r.top, r.right, r.bottom].map(Math.round).join(',')}`);
        }
        return hits;
      };
      const sichtbar = () => !z.hidden && getComputedStyle(z).display !== 'none' && z.getBoundingClientRect().width > 0;
      // Schilder erscheinen teils ein Bild später; der Zettel misst dann neu
      return new Promise((fertig) => {
        let n = 0;
        const bild = () => {
          n++;
          const hits = sichtbar() ? decken() : null;
          if ((hits && !hits.length) || n >= 12) fertig({ sichtbar: sichtbar(), text: z.innerText, hits, bilder: n });
          else requestAnimationFrame(bild);
        };
        requestAnimationFrame(bild);
      });
    }, [BEDIENUNG]);
  }
  expect(befund, 'kein Tagesende nach 60 x 5 Spielsekunden').not.toBeNull();
  expect(befund.sichtbar, `Zettel nicht sichtbar (${befund.bilder} Bilder nach dem Tagesende)`).toBe(true);
  expect(befund.text).not.toContain('null');
  expect(befund.text).not.toContain('undefined');
  expect(befund.text).toMatch(/\+ [\d.]+ €/);
  expect(befund.hits, 'Zettel verdeckt').toEqual([]);
  const zettel = page.locator('#hm-ta-zettel');

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
  await expect.poll(() => ueberdeckt(page, '#hm-tagesabschluss'), { message: 'Karte verdeckt', timeout: 10_000 }).toEqual([]);
  const weiter = karte.locator('.hm-ta-weiter');
  await expect(weiter).toBeInViewport({ ratio: 1 });
  if (isTouchProject(testInfo)) await weiter.tap(); else await weiter.click();
  await expect(karte).toBeHidden();
});
