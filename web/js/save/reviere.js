// Reviere freischalten (Roadmap P57 Teil 5, docs/nordsee.md): Die Nordsee wird frei, sobald ein Hafen an der
// Ostsee die Stufe nordsee.start.abStufe erreicht. Das gilt für das ganze Gerät, nicht je Spielstand: Der
// beste Stand an der Ostsee (Stufe und Ruf) steht unter 'hafenmeister.reviere' und bleibt, auch wenn der
// Hafen später gelöscht wird. Zusätzlich zählen die Einträge im Verzeichnis der Plätze (info.stufe, info.region),
// damit ein Spielstand aus der Zeit vor Teil 5 die Nordsee sofort freischaltet.
//
// Startgeld an der Nordsee aus dem Ruf des besten Ostsee-Hafens (nordsee.start): je Anker geldJeAnker Euro,
// auf volle Hundert gerundet, zwischen geldMin und geldMax.
//
// Ohne Browser nutzbar (tests/reviere.test.mjs): Speicher und Verzeichnis kommen als Argumente.
import { ECONOMY } from '../data/economy.js';

export const KEY_REVIERE = 'hafenmeister.reviere';
const START = ECONOMY.nordsee?.start ?? { abStufe: 5, geldJeAnker: 300, geldMin: 600, geldMax: 1500 };

const zahl = (v, w = 0) => (Number.isFinite(v) ? v : w);

/** Gespeicherter bester Stand je Revier: { ostsee: { stufe, ruf } }. */
export function lesen(speicher) {
  try {
    const t = speicher?.getItem(KEY_REVIERE);
    const v = t ? JSON.parse(t) : null;
    if (!v || typeof v !== 'object') return {};
    const o = v.ostsee && typeof v.ostsee === 'object' ? v.ostsee : null;
    return o ? { ostsee: { stufe: Math.max(0, Math.min(20, Math.floor(zahl(o.stufe)))), ruf: Math.max(0, Math.min(5, zahl(o.ruf))) } } : {};
  } catch { return {}; }
}

/**
 * Stand eines Ostsee-Hafens merken (nur besser, nie schlechter). state: Spielzustand, ruf: Anker 0 bis 5.
 * Gibt true zurück, wenn die Nordsee dadurch gerade frei geworden ist.
 */
export function merken(speicher, state, ruf, verzeichnis = null) {
  if (!state || state.testmodus || (state.region ?? 'ostsee') !== 'ostsee') return false;
  const vorher = nordseeFrei(speicher, verzeichnis);
  const alt = lesen(speicher).ostsee ?? { stufe: 0, ruf: 0 };
  const neu = { stufe: Math.max(alt.stufe, zahl(state.stage, 1)), ruf: Math.max(alt.ruf, Math.round(zahl(ruf) * 100) / 100) };
  if (neu.stufe === alt.stufe && neu.ruf === alt.ruf) return false;
  try { speicher?.setItem(KEY_REVIERE, JSON.stringify({ ostsee: neu })); } catch { /* Speicher voll: Verzeichnis zählt weiter */ }
  return !vorher && nordseeFrei(speicher, verzeichnis);
}

/** Beste Stufe an der Ostsee aus Merkzettel und Verzeichnis der Plätze. */
export function besteOstseeStufe(speicher, verzeichnis = null) {
  let s = lesen(speicher).ostsee?.stufe ?? 0;
  for (const p of verzeichnis?.plaetze ?? []) {
    if ((p?.info?.region ?? 'ostsee') === 'ostsee' && !p.probeVon) s = Math.max(s, zahl(p.info?.stufe));
  }
  return s;
}

export const abStufe = () => START.abStufe;

/** Ist die Nordsee frei? */
export function nordseeFrei(speicher, verzeichnis = null) {
  return besteOstseeStufe(speicher, verzeichnis) >= START.abStufe;
}

/** Startgeld eines neuen Nordsee-Hafens aus dem Ruf (Anker) des besten Ostsee-Hafens. */
export function startgeld(ruf) {
  const g = Math.round((zahl(ruf) * START.geldJeAnker) / 100) * 100;
  return Math.max(START.geldMin, Math.min(START.geldMax, g));
}

/** Startgeld aus dem gemerkten Ruf. */
export function startgeldGemerkt(speicher) {
  return startgeld(lesen(speicher).ostsee?.ruf ?? 0);
}
