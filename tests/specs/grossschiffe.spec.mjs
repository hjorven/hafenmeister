// Großschiffwege (Paket P84, render/boat-view.js grosserSeeweg, render/services-besuch.js pose):
// Kreuzfahrtschiff, Korvette, Minenjagdboot, Traditionssegler und Ausflugsschiff fahren ein und aus,
// genau wie im Spiel (game.besuchsPosen), und kein Rumpfpunkt liegt dabei auf Land. Dazu verschwindet
// jedes Schiff erst außerhalb des Spielbereichs, nicht mitten im Bild.
// Fund vor P84 (Härtetest 15.11.): Das 180 m Kreuzfahrtschiff streifte im Seegatt des Boddens das Ufer,
// auf 9 von 15 Küsten berührte ein Schiff Land. Alle 15 Küsten mit mehreren Seeds prüft
// `node tools/grossschiffe/pruefen.cjs` (rund 10 min); hier die engsten Küsten.
import { test, expect } from '../helpers.mjs';

const KUESTEN = [[4, 1], [4, 3], [7, 3], [11, 2], [12, 1], [14, 1]];

function rumpfPruefen() {
  const G = window.hafenmeister;
  const wasser = (x, z) => G.landschaft.istWasser(x, z);
  const funde = [];
  const r = G.gelaende.spielRect();
  for (const f of G.besuchsPosen(0.1)) {
    let schlimmst = null;
    for (const q of f.posen) {
      const fx = Math.cos(q.kurs), fz = -Math.sin(q.kurs);
      const L = f.l * 0.9, B = f.b * 0.9, nl = Math.ceil(L / 4), nb = Math.max(1, Math.ceil(B / 4));
      let land = 0;
      for (let i = 0; i <= nl; i++) for (let j = 0; j <= nb; j++) {
        const u = (i / nl - 0.5) * L, v = (j / nb - 0.5) * B;
        if (!wasser(q.x + fx * u - fz * v, q.z + fz * u + fx * v)) land++;
      }
      if (land && (!schlimmst || land > schlimmst.land)) schlimmst = { land, x: Math.round(q.x), z: Math.round(q.z), art: q.art };
    }
    if (schlimmst) funde.push(`${f.modell} ${schlimmst.art}: ${schlimmst.land} Rumpfpunkte auf Land bei ${schlimmst.x}/${schlimmst.z}`);
    const e = f.weg[f.weg.length - 1];
    if (e.x > r.minX && e.x < r.maxX && e.z > r.minZ && e.z < r.maxZ) funde.push(`${f.modell}: Weg endet im Spielbereich bei ${Math.round(e.x)}/${Math.round(e.z)}`);
  }
  return funde;
}

for (const [k, seed] of KUESTEN) {
  test(`Großschiffe berühren auf Küste ${k} (Seed ${seed}) kein Land`, async ({ page, problems }, testInfo) => {
    test.skip(testInfo.project.name !== 'pc', 'Wege ohne Bedienung, ein Gerät reicht');
    test.setTimeout(150_000);
    void problems;
    await page.goto(`./?stufe=6&services=alle&gelaende=${k}&seed=${seed}`);
    await page.waitForFunction(() => window.hafenmeister?.besuchsPosen && window.hafenmeister?.fahrwasser?.karte
      && window.hafenmeister?.landschaft?.istWasser && window.hafenmeister.time > 0.1, null, { timeout: 60_000 });
    await page.evaluate(() => window.hafenmeister.setPaused?.(true));
    const funde = await page.evaluate(rumpfPruefen);
    expect(funde, `Küste ${k}, Seed ${seed}`).toEqual([]);
  });
}
