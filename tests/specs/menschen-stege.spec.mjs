// Menschen laufen nur über gebaute Stege (docs/menschen-wege.md): Das Wegenetz der Fußgänger
// (people/netz.js) nimmt nur, was laut game.stege.gebaut() wirklich steht. Bauplätze, noch nicht
// gekaufte Stegprojekte und Stegteile hinter dem letzten gebauten Platz betritt niemand.
// Geprüft: alle Stufen 1 bis 6 ohne gekaufte Stegprojekte, nach dem Kauf eines Projekts,
// nach Speichern und Laden, im Einstieg, auf mehreren Küsten und Stegbildern.
import { test, expect } from '../helpers.mjs';

async function bereit(page) {
  await page.waitForFunction(() => {
    const g = window.hafenmeister;
    return !!g?.sim?.state && !!g.people?.netz && !!g.stege?.gebaut?.();
  }, null, { timeout: 60_000 });
}

// Wartet, bis das Wegenetz aus dem aktuellen Stand der Stege gebaut ist
async function netzAktuell(page) {
  await page.waitForFunction(() => {
    const g = window.hafenmeister;
    const gb = g.stege.gebaut();
    return gb.stufe === g.sim.state.stage && g.people.netz?.stufe === gb.stufe && g.people.netzStand() === gb.sig;
  }, null, { timeout: 30_000 });
}

// Zählt Netzknoten, Plätze und Figuren auf Stegteilen, die nicht gebaut sind
function lage(page) {
  return page.evaluate(async () => {
    const g = window.hafenmeister;
    const { HAFEN } = await import(new URL('js/data/harbor.js', document.baseURI).href);
    const U = HAFEN.einheiten?.meterProEinheit ?? 0.62;
    const gb = g.stege.gebaut();
    const netz = g.people.netz;
    const st = HAFEN.stufen[String(gb.stufe)] ?? HAFEN.stufen['5'];
    const dSeg = (x, y, ax, ay, bx, by) => {
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2));
      return Math.hypot(x - ax - t * dx, y - ay - t * dy);
    };
    const dLin = (x, y, pts) => {
      let d = Infinity;
      for (let i = 1; i < pts.length; i++) d = Math.min(d, dSeg(x, y, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]));
      return d;
    };
    const alle = st.stege.filter((l) => l.steg);
    // Auf einem Steg der Stufe, aber fern von allem Gebauten und nicht an Land
    const ungebaut = (x, y) => alle.some((l) => dLin(x, y, l.punkte) < 1.2)
      && gb.stege.every((l) => dLin(x, y, l.punkte) > 2.2) && !netz.frei(x, y);
    const laenge = (ls) => ls.reduce((s, l) => s + l.punkte.reduce((a, p, i) => a + (i ? Math.hypot(p[0] - l.punkte[i - 1][0], p[1] - l.punkte[i - 1][1]) : 0), 0), 0);
    const figuren = g.people._agenten.filter((a) => a.zustand !== 'entfernt');
    const offen = g.sim.openJettyProjects().map((p) => p.id);
    return {
      stufe: gb.stufe,
      offen,
      fehlendeLaenge: Math.round(laenge(alle) - laenge(gb.stege.filter((l) => l.steg))),
      knoten: netz.nodes.filter((n) => ['holz', 'schwimmsteg', 'kai', 'pier'].includes(n.art) && ungebaut(n.x, n.y)).length,
      plaetzeUngebaut: [...netz.plaetze.keys()].filter((id) => !gb.plaetze.has(id)),
      plaetzeImNetz: netz.plaetze.size,
      figuren: figuren.length,
      figurenUngebaut: figuren.filter((a) => ungebaut(a.x / U, -a.z / U)).map((a) => `${Math.round(a.x / U)},${Math.round(-a.z / U)}`),
    };
  });
}

function sauber(l, wo) {
  expect(l.knoten, `${wo}: Wegknoten auf ungebauten Stegen`).toBe(0);
  expect(l.plaetzeUngebaut, `${wo}: ungebaute Plätze im Wegenetz`).toEqual([]);
  expect(l.figurenUngebaut, `${wo}: Menschen auf ungebauten Stegen`).toEqual([]);
}

async function neuesSpiel(page) {
  await page.evaluate(() => {
    const g = window.hafenmeister;
    g.sim.newGame(42);
    g.einstieg?.beenden?.();
    if (g.paused) g.setPaused(false);
  });
  await netzAktuell(page);
}

// Nächste Stufe ohne ein einziges Stegprojekt (wie ein Spieler, der nur den Ausbau bezahlt)
async function stufeHoch(page) {
  await page.evaluate(() => {
    const g = window.hafenmeister;
    g.sim.advanceStage({ prepaid: true });
    document.querySelector('.hm-feier-weiter')?.click();
    g.einstieg?.beenden?.();
    if (g.paused) g.setPaused(false);
  });
  await netzAktuell(page);
}

async function durchAlleStufen(page, wo) {
  await neuesSpiel(page);
  let mitBauplatz = 0;
  for (let stufe = 1; stufe <= 6; stufe++) {
    if (stufe > 1) await stufeHoch(page);
    // Kurz laufen lassen, damit Figuren unterwegs sind
    await page.evaluate(() => { window.hafenmeister.speed = 8; });
    await page.waitForTimeout(1500);
    const l = await lage(page);
    expect(l.stufe).toBe(stufe);
    sauber(l, `${wo} Stufe ${stufe}`);
    if (l.fehlendeLaenge > 5) mitBauplatz++;
  }
  // Der Test muss etwas prüfen: ohne Stegprojekte fehlt in mehreren Stufen ein Stück Steg
  expect(mitBauplatz, `${wo}: Stufen mit ungebauten Stegen`).toBeGreaterThanOrEqual(3);
}

test('Menschen: Wegenetz nur auf gebauten Stegen, Stufe 1 bis 6, Kauf und Laden', async ({ game }) => {
  test.setTimeout(240_000);
  const { page } = game;
  await bereit(page);
  await durchAlleStufen(page, 'Standardküste');

  // Ein Stegprojekt kaufen: seine Plätze und sein Steg gehören danach zum Netz
  const kauf = await page.evaluate(() => {
    const g = window.hafenmeister;
    const pr = g.sim.openJettyProjects()[0];
    g.sim.state.money = pr.cost + 100;
    const vorher = g.people.netz.plaetze.size;
    const r = g.sim.buildJettyProject(pr.id);
    return { id: pr.id, ok: r?.ok, vorher, plaetze: g.sim.ctx.rules.berthProjects[pr.id] };
  });
  expect(kauf.ok, `Stegprojekt ${kauf.id} gebaut`).toBe(true);
  await netzAktuell(page);
  const nach = await lage(page);
  sauber(nach, `nach Kauf ${kauf.id}`);
  expect(nach.plaetzeImNetz, `Plätze von ${kauf.id} im Wegenetz`).toBeGreaterThan(kauf.vorher);
  expect(nach.offen).not.toContain(kauf.id);

  // Speichern und neu laden: derselbe Stand, wieder nur Gebautes
  await page.evaluate(() => { const g = window.hafenmeister; g.spielstand.speichern(g.sim.state); });
  await page.reload();
  await bereit(page);
  await page.evaluate(() => window.hafenmeister.einstieg?.beenden?.());
  await netzAktuell(page);
  const geladen = await lage(page);
  expect(geladen.stufe).toBe(6);
  expect(geladen.offen).toEqual(nach.offen);
  expect(geladen.plaetzeImNetz).toBe(nach.plaetzeImNetz);
  sauber(geladen, 'nach Laden');
});

test('Menschen: im Einstieg nur auf dem gebauten Steg', async ({ page, problems }) => {
  test.setTimeout(120_000);
  await page.goto('./?einstieg=1');
  await bereit(page);
  await netzAktuell(page);
  await page.evaluate(() => { window.hafenmeister.speed = 8; });
  await page.waitForTimeout(3000);
  const l = await lage(page);
  expect(l.stufe).toBe(1);
  sauber(l, 'Einstieg');
  expect(problems).toEqual([]);
});

// Weitere Küsten und Stegbilder: nur am PC (die Lage der Stege hängt nicht vom Gerät ab)
for (const [gelaende, seed, stegbild] of [[4, 3, 5], [8, 5, 12]]) {
  test(`Menschen: nur gebaute Stege, Küste ${gelaende}, Stegbild ${stegbild}`, async ({ page, problems, projekt }) => {
    test.skip(projekt !== 'pc', 'nur am PC');
    test.setTimeout(240_000);
    await page.goto(`./?gelaende=${gelaende}&seed=${seed}&stegbild=${stegbild}`);
    await bereit(page);
    await durchAlleStufen(page, `Küste ${gelaende} Stegbild ${stegbild}`);
    expect(problems).toEqual([]);
  });
}
