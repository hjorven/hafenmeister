// Bildwasser: Was der Spieler an einer Stelle sieht, Wasser oder Land, aus dem gezeichneten Geländenetz
// (terrain.js: Raster von 2 bis 3 m, flache Flächen zusammengefasst, Zellen ganz unter Wasser fehlen,
// darüber liegt die Wasserfläche auf Pegelhöhe).
//
// Warum: game.landschaft.istWasser rechnet die Geländeformel an jeder Stelle genau aus. Das Netz trifft
// sie nur an seinen Ecken. Am Ufer weichen beide darum um bis zu eine Rasterzelle ab, und schmale
// Sandbänke oder Rinnen unter einer Rasterzelle Breite stehen in der Rechnung, aber nicht im Bild
// (Messung: tools/zeitraffer/wasserbild.cjs, docs/zeitraffer.md "Bild und istWasser").
// Prüfungen wie "Boot über Land" oder "Mensch im Wasser" zählen deshalb nur, wo Rechnung UND Bild
// dasselbe sagen. So entstehen keine Fehlalarme am Rasterrand, echte Funde bleiben.
//
// Nutzung (Playwright): await page.addInitScript(BILDWASSER) vor dem ersten goto. Danach gibt es im
// Spiel window.__bildWasser(x, z) -> true | false | null (null: Gelände noch nicht gebaut). Das Netz
// wird beim ersten Aufruf und nach jedem Neubau des Geländes (Stufe, Küste) neu einsortiert.

/* global window, performance */
const BILDWASSER = () => {
  const U = 0.62;
  // nur der Bereich, in dem geprüft wird: Hafen, Durchstich, Pflicht-See vor der Einfahrt (Plan x -420..460, y -60..620)
  const F = 4, BX0 = -420 * U, BZ0 = -620 * U, NB = Math.ceil(900 * U / F) + 1;
  let schluessel = '', faecher = null;
  const netze = () => {
    const G = window.hafenmeister; if (!G?.scene) return [];
    const out = [];
    G.scene.traverse((o) => { if (o.isMesh && /^gelaende-(innen|rand|aussen)$/.test(o.name)) out.push(o); });
    return out;
  };
  const einsortieren = (liste) => {
    const T = window.hafenmeister.THREE; const m0 = new Map();
    for (const m of liste) {
      m.updateMatrixWorld();
      const pos = m.geometry.attributes.position, idx = m.geometry.index;
      const n = idx ? idx.count : pos.count;
      const v = (k) => new T.Vector3().fromBufferAttribute(pos, idx ? idx.getX(k) : k).applyMatrix4(m.matrixWorld);
      for (let k = 0; k < n; k += 3) {
        const a = v(k), b = v(k + 1), c = v(k + 2);
        const i0 = Math.floor((Math.min(a.x, b.x, c.x) - BX0) / F), i1 = Math.floor((Math.max(a.x, b.x, c.x) - BX0) / F);
        const j0 = Math.floor((Math.min(a.z, b.z, c.z) - BZ0) / F), j1 = Math.floor((Math.max(a.z, b.z, c.z) - BZ0) / F);
        if (i1 < 0 || j1 < 0 || i0 >= NB || j0 >= NB) continue;
        for (let j = Math.max(0, j0); j <= Math.min(NB - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(NB - 1, i1); i++) {
          const key = j * NB + i; let l = m0.get(key); if (!l) m0.set(key, (l = []));
          l.push([a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z]);
        }
      }
    }
    return m0;
  };
  /** Höhe des gezeichneten Netzes an (x, z) in Metern, null wo kein Netz liegt (dort ist nur Wasser). */
  const hoehe = (x, z) => {
    const l = faecher.get(Math.floor((z - BZ0) / F) * NB + Math.floor((x - BX0) / F));
    if (!l) return null;
    for (const [ax, ay, az, bx, by, bz, cx, cy, cz] of l) {
      const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      if (Math.abs(d) < 1e-9) continue;
      const w1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d;
      const w2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d;
      const w3 = 1 - w1 - w2;
      if (w1 >= -1e-6 && w2 >= -1e-6 && w3 >= -1e-6) return w1 * ay + w2 * by + w3 * cy;
    }
    return null;
  };
  // Szene höchstens alle 0,5 s nach einem neuen Netz absuchen (Prüfungen fragen tausende Punkte je Probe)
  let zuletzt = -1e9;
  const pruefe = () => {
    const jetzt = performance.now();
    if (faecher && jetzt - zuletzt < 500) return true;
    zuletzt = jetzt;
    const liste = netze(); if (!liste.length) { faecher = null; schluessel = ''; return false; }
    const k = liste.map((m) => m.geometry.uuid).join();
    if (k !== schluessel) { faecher = einsortieren(liste); schluessel = k; }
    return true;
  };
  window.__bildHoehe = (x, z) => (pruefe() ? hoehe(x, z) : null);
  window.__bildWasser = (x, z) => {
    if (!pruefe()) return null;
    const h = hoehe(x, z);
    return h == null ? true : h < (window.hafenmeister.landschaft?.pegel ?? 0);
  };
};

module.exports = { BILDWASSER };
