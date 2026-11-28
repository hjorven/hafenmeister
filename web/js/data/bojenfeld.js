// Bojenfeld (Roadmap P36, F10): billige Muringbojen im See für kleine Boote.
// Beschreibung: docs/bojenfeld.md. Zahlen: ECONOMY.bojenfeld.
//
// bojenfeldAnlegen(hafen) hängt die Liegeplätze BF01 ... an hafen.plaetze an (Art 'boje', Steg 'BF').
// Jeder Bauabschnitt (ECONOMY.bojenfeld.abschnitte) ist ein eigenes Bauprojekt (requires 'bojenfeld-1',
// 'bojenfeld-2'). Die Lage hängt vom Gelände ab (Küste, Seed, Stegbild) und steht erst fest, wenn die
// Landschaft geladen ist: render/landschaft/bojenfeld-lage.js meldet sich mit bojenfeldQuelle(f) an,
// p.lage und p.stufen fragen dann f() (zwischengespeichert). Ohne Lage (Spielregeln in Node, oder an dieser
// Küste ist für den Abschnitt kein Platz) sind p.lage und p.stufen leer: dann gibt es die Boje nicht im Bild.
// Die Regeln (sim.berthsFromHarbor) nehmen p.stufenRegel; features/bojenfeld.js sperrt Bojen ohne Lage.
//
// Läuft am Ende von stegbildSetzen (data/stegbild.js), wie die Doppelboxen.

import { ECONOMY } from './economy.js';

const R = ECONOMY.bojenfeld ?? null;
const ABSCHNITTE = R?.abschnitte ?? [];

/** Feste Angaben: ids, Anzahl, Bojen je Abschnitt, Projekt-ids. */
export const BOJENFELD = (() => {
  const abschnitte = ABSCHNITTE.map((a) => a.bojen);
  const anzahl = abschnitte.reduce((s, n) => s + n, 0);
  const ids = Array.from({ length: anzahl }, (_, i) => `BF${String(i + 1).padStart(2, '0')}`);
  const projekte = ABSCHNITTE.map((_, i) => `bojenfeld-${i + 1}`);
  const projektVon = {};
  let k = 0;
  ABSCHNITTE.forEach((a, i) => { for (let j = 0; j < a.bojen; j++) projektVon[ids[k++]] = projekte[i]; });
  return { anzahl, abschnitte, ids, projekte, projektVon };
})();

let quelle = null;
/** f() -> [[px, py], ...] Lage der Bojen in Planeinheiten (render/landschaft/bojenfeld-lage.js). */
export function bojenfeldQuelle(f) { quelle = f; }

/** Lage aller Bojen in Planeinheiten oder [] (keine Landschaft, kein Platz an dieser Küste). */
export function bojenLagen() {
  try { return quelle?.() ?? []; } catch { return []; }
}

export const istBoje = (p) => p?.art === 'boje';

/** Liegeplätze des Bojenfelds an hafen.plaetze anhängen (vorherige werden ersetzt). */
export function bojenfeldAnlegen(hafen) {
  hafen.plaetze = hafen.plaetze.filter((p) => p.art !== 'boje');
  if (!R) return [];
  const stufen = [];
  for (let s = R.abStufe ?? 2; s <= 6; s++) if (hafen.stufen?.[String(s)]) stufen.push(s);
  const neu = BOJENFELD.ids.map((id, i) => {
    const tiefe = Object.fromEntries(stufen.map((s) => [String(s), R.tiefe]));
    const p = {
      id, steg: 'BF', klasse: R.klasse ?? 'M', art: 'boje',
      laenge: R.maxLaenge / (hafen.einheiten?.meterProEinheit ?? 0.62), breite: R.maxBreite / (hafen.einheiten?.meterProEinheit ?? 0.62),
      maxLaenge: R.maxLaenge, maxBreite: R.maxBreite,
      // stufenRegel: wann es den Platz nach den Spielregeln gibt (fest); stufen (unten): nur mit Lage im Bild
      stufenRegel: [...stufen], tiefe,
      requires: BOJENFELD.projektVon[id],
      nr: i,
    };
    // Lage je Stufe aus dem Gelände (gleich in allen Stufen); ohne Lage gibt es den Platz nicht im Bild
    Object.defineProperty(p, 'stufen', {
      enumerable: true,
      configurable: true,
      get() { return bojenLagen()[i] ? [...stufen] : []; },
    });
    Object.defineProperty(p, 'lage', {
      enumerable: true,
      configurable: true,
      get() {
        const q = bojenLagen()[i];
        if (!q) return {};
        return Object.fromEntries(stufen.map((s) => [String(s), [q[0], q[1], 90]]));
      },
    });
    return p;
  });
  hafen.plaetze.push(...neu);
  return neu;
}
