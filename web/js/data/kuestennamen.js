// Namen, die von der Küste abhängen (P85 Teil 3, docs/zusammenspiel.md, Abschnitt "Ausbauten je Küste").
//
// Der Ausbau zu Stufe 3 heißt "Durchstich zur Ostsee", weil der Hafen auf der ersten Karte (Küste 1, Nehrung)
// hinter einer Nehrung liegt. Auf den meisten der 15 Küsten liegt der Hafen aber schon am offenen Wasser:
// Dort sticht der Ausbau nichts durch, er baut Molen und Wellenbrecher vor den Hafen. Die Wirkung im Spiel
// ist dieselbe (Einfahrt 4 m tief für L-Yachten, mehr Plätze, nächste Stufe), nur Name und Bild stimmen dann.
// Welche Art gilt, rechnet render/landschaft/formen.js (engpassArt) aus der Landschaft und meldet es hier an;
// ohne Landschaft (Node, Regeltests) gilt die Nehrung wie bisher.
import { ECONOMY } from './economy.js';

let quelle = () => 'durchstich';

/** formen.js: Funktion, die 'durchstich' (Nehrung am Engpass) oder 'einfahrt' (offenes Wasser) liefert. */
export function engpassQuelle(f) { quelle = f; }

/** 'durchstich' oder 'einfahrt' für die aktuelle Küste. */
export function engpassArt() {
  try { return quelle() === 'einfahrt' ? 'einfahrt' : 'durchstich'; } catch { return 'durchstich'; }
}

const offen = () => engpassArt() === 'einfahrt';

/** Name der Ausbaustufe n, passend zur Küste. */
export function stufenName(n) {
  const s = (ECONOMY.stufen || []).find((x) => x.stufe === n);
  return (offen() && s?.nameOffen) || s?.name || `Stufe ${n}`;
}

/** Name des großen Bauprojekts, das aus Stufe s (Eintrag aus ECONOMY.stufen) herausführt. */
export function ausbauName(s) {
  return (offen() && s?.ausbau?.nameOffen) || s?.ausbau?.name || null;
}
