// Wo Strandkörbe und Seebrücke stehen. Die Küste ist je Spiel anders (natur.js), darum hängt nichts an festen
// Koordinaten: strandStelle sucht von der Wunschlage aus die nächste passende Stelle, ebenen, trockenen Sand für
// die Körbe, für die Seebrücke Sandufer mit freiem Wasser auf ganzer Länge. Wo die Küste keinen Strand hat
// (Fels, Kliff, Schilf, Wald), fehlen sie. Ohne three.js, damit auch Fahrwasser, Menschen und Tests fragen können.
import { natur } from './formen.js';
import { strandStelle } from './natur.js';
import { punkt, PLAN_M } from './gelaende.js';
import { REGIONEN } from './regionen.js';
import { GROSSE_GAESTE } from '../../data/verkehr.js';

/** Wunschlagen in Planeinheiten: fest oder je Stufe (gilt ab dieser Stufe). */
export const STRAND_PLAN = {
  seebruecke: { ab: 3, p: { 3: [-170, 216], 6: [-262, 214] }, laenge: 44 },
  'koerbe-1': { ab: 2, p: { 2: [-210, 214], 6: [-224, 210] } },
  'koerbe-2': { ab: 3, p: { 3: [-120, 218], 6: [-84, 212] } },
  'koerbe-3': { ab: 3, p: [228, 218] },
  'koerbe-4': { ab: 1, p: [-14, -8] },
};

/** Länge der Seebrücke in Planeinheiten (Steg samt Kopf). */
export const SEEBRUECKE_LAENGE = (44 + 3.2) / PLAN_M;

function wunsch(p, stufe) {
  if (Array.isArray(p)) return p;
  let best = null;
  for (const [s, v] of Object.entries(p)) if (Number(s) <= stufe) best = v;
  return best ?? Object.values(p)[0];
}

const OHNE_STRAND = new Set(['fels', 'kliff', 'wald']);
let _lagen = null, _lagenN = null;

/**
 * Lagen aller Strandsachen in einer Stufe: { id: [x, y, dreh] | null }. dreh in Bogenmaß um die Hochachse,
 * 0 = Seebrücke zeigt nach Norden; die Richtung in Planeinheiten ist (-sin(dreh), cos(dreh)).
 */
export function strandLagen(stufe, region = 'ostsee') {
  let N;
  try { N = natur(); } catch { return {}; }
  if (!N?.landig) return {};
  if (_lagenN !== N) { _lagen = new Map(); _lagenN = N; }
  const key = `${stufe}|${region}`;
  // Fels-, Kliff- und Waldküsten haben keinen Badestrand, auch wenn irgendwo ein Fleck Sand liegt
  if (OHNE_STRAND.has(N.stil?.ufer)) return {};
  if (!_lagen.has(key)) {
    const reg = REGIONEN[region] ?? REGIONEN.ostsee;
    const boden = (x, y) => punkt(x, y, stufe, reg);
    const vergeben = [], out = {};
    // Seebrücke zuerst: Sie braucht freies Wasser davor, Körbe finden leichter Platz
    // Erst die Stelle des größten Ausbaus versuchen: Was dort stehen bleiben kann, zieht beim Ausbau nicht um
    const spaeter = stufe < 6 ? strandLagen(6, region) : {};
    for (const [id, e] of Object.entries(STRAND_PLAN)) {
      const opt = { seebruecke: id === 'seebruecke', weit: id === 'seebruecke' ? 600 : 420, laenge: (e.laenge ?? 44) / PLAN_M + 14, meiden: vergeben, boden, stufe,
        sperren: stufe >= 6 ? GROSSE_GAESTE.map((g) => g.rechteck).filter(Boolean) : [] };
      const [x, y] = wunsch(e.p, stufe);
      const s = (spaeter[id] && strandStelle(N, spaeter[id][0], spaeter[id][1], { ...opt, weit: 0, zuerst: spaeter[id][2] })) || strandStelle(N, x, y, opt);
      out[id] = s;
      if (s) vergeben.push(s);
    }
    _lagen.set(key, out);
  }
  return _lagen.get(key);
}

/** Seebrücke als Strecke in Planeinheiten, { fuss: [x, y], kopf: [x, y], breite } oder null (ab Stufe 3). */
export function seebrueckeStrecke(stufe, region = 'ostsee') {
  if (stufe < STRAND_PLAN.seebruecke.ab) return null;
  const s = strandLagen(stufe, region).seebruecke;
  if (!s) return null;
  const [x, y, w] = s;
  return { fuss: [x, y], kopf: [x - Math.sin(w) * SEEBRUECKE_LAENGE, y + Math.cos(w) * SEEBRUECKE_LAENGE], breite: 14 };
}
