// Wie viele Menschen ein Boot mitbringt (docs/plan.md, Abschnitt 11a). Ohne Three.js, testbar.
// Gehoert dem Thread "Menschen im Hafen herumlaufen lassen".
import * as P from '../data/people.js';
import * as S from '../data/boats/s.js';
import * as M from '../data/boats/m.js';
import * as L from '../data/boats/l.js';
import * as XL from '../data/boats/xl.js';

const BOOTSDATEN = { s: S, m: M, l: L, xl: XL };

// Menschen an Bord fuer ein Boot: aus den Schiffsdaten (crew: [min, max]) oder der Standardtabelle.
export function crewFuer({ groesse, art, modell } = {}) {
  const g = String(groesse ?? 'm').toLowerCase();
  const d = BOOTSDATEN[g];
  let crew = null;
  if (d) {
    const mod = d.MODELS?.find((m) => m.id === modell);
    if (mod) crew = d.crewOf ? d.crewOf(mod) : mod.crew;
    if (!crew) {
      const typeId = mod?.typeId ?? art;
      crew = d.TYPES?.find((t) => t.id === typeId)?.crew ?? null;
    }
  }
  return crew ?? P.CREW_STANDARD[g] ?? P.CREW_STANDARD.m;
}

// Wie viele Figuren fuer n Menschen (grosse Schiffe gebuendelt)
export function figurenFuer(n) {
  if (n <= P.EINZELN_BIS) return n;
  return P.EINZELN_BIS + Math.ceil((n - P.EINZELN_BIS) / P.BUENDEL);
}
