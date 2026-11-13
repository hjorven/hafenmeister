// Hafenmeister: welches Stegbild (Variante der Stege A, B, C, CS, D) dieses Spiel hat.
// Beschreibung: docs/stegbilder.md. Die Varianten selbst stehen in data/stegbilder.js (erzeugt).
//
// harbor.js ruft stegbildAnwenden(HAFEN) direkt nach dem Anlegen von HAFEN auf. Damit sehen alle
// Module, die HAFEN importieren, schon die Stege dieses Spiels, ohne selbst etwas zu tun.
//
// Welche Variante gilt (erste passende Regel):
//   1. URL ?stegbild=N   (0 = Grundbild aus harbor.js, 1 bis 12 = Variante). Nur zum Testen, wird nicht gespeichert.
//   2. Spielstand mit modules.stegbild.nr (auch aus einer importierten Datei).
//   3. Eigener Eintrag 'hafenmeister.stegbild' im Browser, der zum Spielstand gehoert.
//   4. Spielstand ohne Stegbild (angefangen, bevor es Stegbilder gab): Grundbild, damit nichts umzieht.
//   5. Automatischer Test (navigator.webdriver): Grundbild, damit Tests immer dasselbe Bild sehen.
//   6. Neues Spiel: eine Variante zufaellig, wird gemerkt.
//
// init(game) traegt die Nummer in game.state.modules.stegbild ein, damit sie mit dem Spielstand
// gespeichert und exportiert wird. Kommt ein Spielstand mit anderem Stegbild herein (Import), wird
// die Seite neu geladen, weil die Stege dann anders liegen.
import { STEGBILDER } from './stegbilder.js';

const KEY = 'hafenmeister.stegbild';
const SAVE_KEYS = ['hafenmeister.spielstand', 'hafenmeister.save'];

let aktiv = { nr: 0, quelle: 'grundbild' };

function speicher() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

function lies(s, key) {
  try { const t = s?.getItem(key); return t ? JSON.parse(t) : null; } catch { return null; }
}

/** Spielstand (roh) aus dem Browser: { seed, nr } oder null, wenn keiner da ist. */
function gespeichert(s) {
  for (const key of SAVE_KEYS) {
    const roh = lies(s, key);
    if (!roh) continue;
    const spiel = roh.spiel ?? roh.game ?? roh;
    const nr = spiel?.modules?.stegbild?.nr;
    return { seed: spiel?.seed ?? null, nr: Number.isInteger(nr) ? nr : null };
  }
  return null;
}

const gueltig = (nr) => Number.isInteger(nr) && nr >= 0 && nr <= STEGBILDER.varianten.length;

/** Entscheidet, welches Stegbild gilt. Rueckgabe { nr, quelle }. */
export function stegbildWaehlen({ url = globalThis.location?.search ?? '', s = speicher(), zufall = Math.random, webdriver = globalThis.navigator?.webdriver === true } = {}) {
  const p = new URLSearchParams(url).get('stegbild');
  if (p !== null && gueltig(Number(p))) return { nr: Number(p), quelle: 'url' };
  const stand = gespeichert(s);
  if (stand && gueltig(stand.nr)) return { nr: stand.nr, quelle: 'spielstand' };
  const eigen = lies(s, KEY);
  if (eigen && gueltig(eigen.nr)) {
    // gehoert der Eintrag zu diesem Spielstand (oder zu einem Spiel, das noch nicht gespeichert ist)?
    if (!stand || eigen.seed == null || eigen.seed === stand.seed) return { nr: eigen.nr, quelle: 'browser' };
  }
  if (stand) return { nr: 0, quelle: 'alter-spielstand' };
  if (webdriver) return { nr: 0, quelle: 'test' };
  const n = STEGBILDER.varianten.length;
  const nr = n ? 1 + Math.floor(zufall() * n) : 0;
  try { s?.setItem(KEY, JSON.stringify({ nr, seed: null })); } catch { /* privat: dann eben nur fuer diese Sitzung */ }
  return { nr, quelle: 'neu' };
}

/**
 * Setzt Stegbild nr in ein HAFEN-Objekt (aendert es an Ort und Stelle). nr 0 laesst alles, wie es ist.
 * Stufen ueber der hoechsten Stufe der Variante (Stufe 6) uebernehmen deren Stege und Lagen.
 */
export function stegbildSetzen(hafen, nr) {
  const v = STEGBILDER.varianten[nr - 1];
  hafen.stegbild = { nr: v ? nr : 0, stege: v ? [...STEGBILDER.stege] : [] };
  if (!v) return hafen;
  const variiert = new Set(STEGBILDER.stege);
  const vStufen = Object.keys(v.stufen).map(Number);
  const hoechste = Math.max(...vStufen);
  for (const key of Object.keys(hafen.stufen)) {
    const n = Number(key);
    const vs = v.stufen[String(Math.min(n, hoechste))];
    if (!vs) continue;
    const st = hafen.stufen[key];
    const rest = st.stege.filter((l) => !variiert.has(l.steg));
    st.stege = [...vs.stege.map((l) => ({ ...l, punkte: l.punkte.map((q) => [...q]) })), ...rest];
  }
  for (const p of hafen.plaetze) {
    if (!variiert.has(p.steg)) continue;
    for (const key of Object.keys(p.lage)) {
      const n = Number(key);
      const vs = v.stufen[String(Math.min(n, hoechste))];
      const l = vs?.lage[p.id];
      if (l) p.lage[key] = [...l];
      const t = vs?.tiefe[p.id];
      if (t !== undefined) p.tiefe[key] = t;
    }
  }
  return hafen;
}

/** Wird von harbor.js aufgerufen. */
export function stegbildAnwenden(hafen) {
  try {
    // Ohne Browserseite (Node, Tests, Werkzeuge) immer das Grundbild, auch wenn es localStorage gibt
    aktiv = typeof document === 'undefined' ? { nr: 0, quelle: 'ohne-browser' } : stegbildWaehlen();
  } catch {
    aktiv = { nr: 0, quelle: 'fehler' };
  }
  stegbildSetzen(hafen, aktiv.nr);
  return aktiv;
}

/** Welches Stegbild gerade gilt. */
export function aktuellesStegbild() { return { ...aktiv }; }

/** Modul fuer js/main.js (MODULES): Nummer im Spielstand festhalten. */
export function init(game) {
  const merken = () => {
    const st = game.state;
    if (!st) return;
    st.modules = st.modules ?? {};
    if (aktiv.quelle === 'url') return;              // Testansicht nicht in den Spielstand schreiben
    st.modules.stegbild = { nr: aktiv.nr };
    const s = speicher();
    try { s?.setItem(KEY, JSON.stringify({ nr: aktiv.nr, seed: st.seed ?? null })); } catch { /* egal */ }
  };
  merken();
  game.on?.('ready', merken);
  // Der Spielstand entsteht erst nach 'ready' (js/bridge.js); jeder neue Stand meldet zuerst 'stufe'
  game.on?.('stufe', merken);
  game.on?.('spielstand-geladen', (neu) => {
    const nr = neu?.modules?.stegbild?.nr;
    if (aktiv.quelle === 'url' || !gueltig(nr) || nr === aktiv.nr) { merken(); return; }
    // Anderes Stegbild: die Stege liegen dann woanders, also mit dem neuen Stand neu starten
    try { speicher()?.setItem(KEY, JSON.stringify({ nr, seed: neu.seed ?? null })); } catch { /* egal */ }
    try { game.spielstand?.speichern?.(neu); } catch { /* egal */ }
    globalThis.location?.reload?.();
  });
  game.stegbild = { aktuell: aktuellesStegbild, anzahl: STEGBILDER.varianten.length };
}
