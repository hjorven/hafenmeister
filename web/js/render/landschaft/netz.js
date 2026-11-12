// Vereinfachtes Geländenetz: große, ebene Flächen gleicher Farbe werden zu wenigen Dreiecken
// zusammengefasst, Ufer, Dünen und Hügel bleiben fein. Reines JS ohne Three.js, damit es testbar ist.
//
// Vorgehen: Das Raster wird in Blöcke von bis zu 2^n Zellen geteilt (Quadtree). Ein Block bleibt
// ganz, wenn alle Punkte dieselbe Geländeart haben und höchstens `toleranz` Meter von der
// bilinearen Fläche durch seine Ecken abweichen. Jeder Block wird als Fächer über alle benutzten
// Randpunkte gezeichnet, also auch über die Ecken feinerer Nachbarn. So entstehen keine Risse
// (keine T-Kreuzungen) zwischen groben und feinen Blöcken.

/**
 * @param {Float32Array} H Höhen je Rasterpunkt ((nx+1)*(ny+1)), NaN = auslassen
 * @param {Array<string>} T Geländeart je Rasterpunkt
 * @param {number} nx Zellen in x
 * @param {number} ny Zellen in y
 * @param {{ unten: number, maxBlock?: number, toleranz: (i: number, j: number, groesse: number) => number }} o
 *   unten: Zellen, deren Punkte alle tiefer liegen, entfallen (Wasser deckt sie ab).
 * @returns {number[]} Dreiecke als Rasterpunkt-Indizes, je drei, von oben gegen den Uhrzeigersinn in (i, j)
 */
export function vereinfacheRaster(H, T, nx, ny, { unten, maxBlock = 16, toleranz }) {
  const W = nx + 1;
  const id = (i, j) => j * W + i;
  const blaetter = [];   // [i0, j0, w, h]

  function pruefe(i0, j0, w, h) {
    let leer = true, nan = false, typ = null, gleich = true, max = -Infinity;
    for (let j = j0; j <= j0 + h; j++) {
      for (let i = i0; i <= i0 + w; i++) {
        const v = H[id(i, j)];
        if (Number.isNaN(v)) { nan = true; continue; }
        if (v > max) max = v;
        const t = T[id(i, j)];
        if (typ === null) typ = t; else if (t !== typ) gleich = false;
      }
    }
    if (max >= unten) leer = false;
    return { leer, nan, gleich };
  }

  function eben(i0, j0, w, h, tol) {
    const a = H[id(i0, j0)], b = H[id(i0 + w, j0)], c = H[id(i0, j0 + h)], d = H[id(i0 + w, j0 + h)];
    for (let j = j0; j <= j0 + h; j++) {
      const v = (j - j0) / h;
      for (let i = i0; i <= i0 + w; i++) {
        const u = (i - i0) / w;
        const soll = a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
        if (Math.abs(H[id(i, j)] - soll) > tol) return false;
      }
    }
    return true;
  }

  function teile(i0, j0, s) {
    const w = Math.min(s, nx - i0), h = Math.min(s, ny - j0);
    if (w <= 0 || h <= 0) return;
    if (w === 1 && h === 1) {
      // Einzelne Zelle: wie früher, ausgelassen bei NaN oder ganz unter Wasser
      const k = [H[id(i0, j0)], H[id(i0 + 1, j0)], H[id(i0, j0 + 1)], H[id(i0 + 1, j0 + 1)]];
      if (k.some(Number.isNaN) || Math.max(...k) < unten) return;
      blaetter.push([i0, j0, 1, 1]);
      return;
    }
    const p = pruefe(i0, j0, w, h);
    if (p.leer && !p.nan) return;
    if (w >= 2 && h >= 2 && !p.nan && !p.leer && p.gleich && eben(i0, j0, w, h, toleranz(i0 + w / 2, j0 + h / 2, Math.max(w, h)))) {
      blaetter.push([i0, j0, w, h]);
      return;
    }
    const halb = s / 2;
    teile(i0, j0, halb); teile(i0 + halb, j0, halb);
    teile(i0, j0 + halb, halb); teile(i0 + halb, j0 + halb, halb);
  }

  for (let j = 0; j < ny; j += maxBlock) for (let i = 0; i < nx; i += maxBlock) teile(i, j, maxBlock);

  // Benutzte Punkte: Ecken aller Blöcke
  const benutzt = new Uint8Array(W * (ny + 1));
  for (const [i0, j0, w, h] of blaetter) {
    benutzt[id(i0, j0)] = benutzt[id(i0 + w, j0)] = benutzt[id(i0, j0 + h)] = benutzt[id(i0 + w, j0 + h)] = 1;
  }

  const dreiecke = [];
  for (const [i0, j0, w, h] of blaetter) {
    const a = id(i0, j0), b = id(i0 + w, j0), c = id(i0, j0 + h), d = id(i0 + w, j0 + h);
    if (w === 1 && h === 1) {
      // Diagonale so wählen, dass Kanten an Ufern sauberer werden (wie bisher)
      if (Math.abs(H[a] - H[d]) < Math.abs(H[b] - H[c])) dreiecke.push(a, b, d, a, d, c);
      else dreiecke.push(a, b, c, b, d, c);
      continue;
    }
    // Rand gegen den Uhrzeigersinn: unten, rechts, oben, links
    const rand = [];
    for (let i = i0; i < i0 + w; i++) if (benutzt[id(i, j0)]) rand.push(id(i, j0));
    for (let j = j0; j < j0 + h; j++) if (benutzt[id(i0 + w, j)]) rand.push(id(i0 + w, j));
    for (let i = i0 + w; i > i0; i--) if (benutzt[id(i, j0 + h)]) rand.push(id(i, j0 + h));
    for (let j = j0 + h; j > j0; j--) if (benutzt[id(i0, j)]) rand.push(id(i0, j));
    if (rand.length === 4) { dreiecke.push(a, b, d, a, d, c); continue; }
    // Fächer um den Mittelpunkt (Blöcke sind mindestens 2 x 2 Zellen, die Mitte liegt also innen)
    const mitte = id(i0 + (w >> 1), j0 + (h >> 1));
    for (let k = 0; k < rand.length; k++) dreiecke.push(mitte, rand[k], rand[(k + 1) % rand.length]);
  }
  return dreiecke;
}
