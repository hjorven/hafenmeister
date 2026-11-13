// Geländeformen: jedes Spiel bekommt einen von zehn Küstentypen (natur.js) und dazu einen eigenen
// Zufallswert (seed). Typ und Seed zusammen ergeben die ganze Landschaft rund um den Hafen: Küste, Buchten,
// Inseln, Nehrungen, Flüsse, Felsen, Watt und wo darin der Hafen liegt. Gleicher Typ, anderer Seed: andere Küste.
// Die Typen sind frei nach Landschaften an Ost- und Nordsee gebaut, keine bildet einen echten Ort ab.
// Beschreibung: docs/landschaft.md, Abschnitt "Geländeformen".
//
// Fest in jedem Typ (natur.js, PFLICHT): Uferstreifen der Stege, Wasser vor den Stegen, Zufahrt durch das
// Seegatt bei x 178, offenes Wasser vor der Einfahrt, Land für den Ort hinter dem Hafen.
//
// Welche Form gilt (erste passende Regel, wie bei den Stegbildern):
//   1. URL ?gelaende=N (1 bis 10) und ?seed=S. Nur zum Ansehen, wird nicht gespeichert.
//   2. Spielstand mit modules.gelaende.nr (und .seed).
//   3. Eigener Eintrag 'hafenmeister.gelaende' im Browser, der zum Spielstand gehört.
//   4. Spielstand von vor den Formen: Form 1, Seed 1.
//   5. Automatischer Test (navigator.webdriver) oder Node: Form 1, Seed 1.
//   6. Neues Spiel: Typ und Seed zufällig, werden gemerkt.

import { TYPEN, bauen, WELT, BEREICH } from './natur.js';

export const FORMEN = TYPEN.map(({ nr, name, idee }) => ({ nr, name, idee }));
/** Höchster Seed, den das Spiel auswürfelt (jeder ganzzahlige Seed ab 1 ist gültig). */
export const SEED_MAX = 99999;

const KEY = 'hafenmeister.gelaende';
const SAVE_KEYS = ['hafenmeister.spielstand', 'hafenmeister.save'];
const nachNr = new Map(FORMEN.map((f) => [f.nr, f]));
const gueltig = (nr) => Number.isInteger(nr) && nachNr.has(nr);

const seedGueltig = (s) => Number.isInteger(s) && s >= 1;

let aktiv = { nr: 1, seed: 1, quelle: 'standard' };
let form = null;
const _natur = new Map();

/** Landschaft für Typ und Seed (einmal gebaut, dann gemerkt; die letzten vier bleiben). */
function naturFuer(nr, seed) {
  const k = `${nr}:${seed}`;
  if (!_natur.has(k)) {
    if (_natur.size >= 4) _natur.delete(_natur.keys().next().value);
    _natur.set(k, bauen(nr, seed));
  }
  return _natur.get(k);
}

function formBauen(nr, seed) {
  const f = nachNr.get(nr) ?? nachNr.get(1);
  const s = seedGueltig(seed) ? seed : 1;
  let n = null;
  const nat = () => (n ??= naturFuer(f.nr, s));
  return {
    ...f, seed: s,
    get natur() { return nat(); },
    get leuchttuerme() { return nat().leuchttuerme; },
    get inseln() { return nat().inseln; },
  };
}
form = formBauen(1, 1);

/** Die Form, die gerade gilt: { nr, name, idee, seed, natur, leuchttuerme, inseln }. */
export function gelaendeform() { return form; }

/** Die Landschaft der gültigen Form (natur.js, bauen). */
export function natur() { return form.natur; }

/** Setzt Form und Seed direkt (Tests, Vorschau, Werkzeuge). Unbekannte Nummern geben Form 1. */
export function formSetzen(nr, seed = 1) {
  form = formBauen(nr, seed);
  aktiv = { nr: form.nr, seed: form.seed, quelle: 'gesetzt' };
  for (const f of beiWechsel) f(form);
  return form;
}
const beiWechsel = [];
/** f(form) nach jedem formSetzen (gelaende.js leert damit seine Zwischenspeicher). */
export function beiFormwechsel(f) { beiWechsel.push(f); }

function speicher() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}
function lies(s, key) {
  try { const t = s?.getItem(key); return t ? JSON.parse(t) : null; } catch { return null; }
}
function gespeichert(s) {
  for (const key of SAVE_KEYS) {
    const roh = lies(s, key);
    if (!roh) continue;
    const spiel = roh.spiel ?? roh.game ?? roh;
    const nr = spiel?.modules?.gelaende?.nr, gs = spiel?.modules?.gelaende?.seed;
    return { seed: spiel?.seed ?? null, nr: Number.isInteger(nr) ? nr : null, gseed: seedGueltig(gs) ? gs : 1 };
  }
  return null;
}

// Punkte, die in jeder Landschaft tiefes Wasser sein müssen (Zufahrt, Bojen, Ankerfelder, Reede, Runde)
const PRUEFPUNKTE = [[-80, 60], [-25, 102], [42, 130], [178, 200], [178, 262], [240, 266], [355, 392], [30, 440], [270, 150]];

/** Hält die Landschaft für Typ nr und Seed die Pflichtbereiche ein? (Die Tests prüfen gründlicher.) */
export function seedTauglich(nr, seed) {
  const N = naturFuer(nr, seed);
  return PRUEFPUNKTE.every(([x, y]) => N.landig(x, y) < -3) && N.landig(0, -60) > 5;
}

/** Neuer Seed für ein neues Spiel. Mit nr: so lange der nächste, bis die Landschaft taugt (höchstens 20 Versuche). */
export function neuerSeed(zufall = Math.random, nr = null) {
  let seed = 1 + Math.floor(zufall() * SEED_MAX);
  if (gueltig(nr)) for (let i = 0; i < 20 && !seedTauglich(nr, seed); i++) seed = (seed % SEED_MAX) + 1;
  return seed;
}

/** Entscheidet, welche Form gilt. Rückgabe { nr, seed, quelle }. */
export function formWaehlen({ url = globalThis.location?.search ?? '', s = speicher(), zufall = Math.random, webdriver = globalThis.navigator?.webdriver === true } = {}) {
  const q = new URLSearchParams(url);
  const p = q.get('gelaende'), ps = Number(q.get('seed'));
  if (p !== null && gueltig(Number(p))) return { nr: Number(p), seed: seedGueltig(ps) ? ps : 1, quelle: 'url' };
  const stand = gespeichert(s);
  if (stand && gueltig(stand.nr)) return { nr: stand.nr, seed: stand.gseed, quelle: 'spielstand' };
  const eigen = lies(s, KEY);
  if (eigen && gueltig(eigen.nr) && (!stand || eigen.seed == null || eigen.seed === stand.seed)) return { nr: eigen.nr, seed: seedGueltig(eigen.gseed) ? eigen.gseed : 1, quelle: 'browser' };
  if (stand) return { nr: 1, seed: 1, quelle: 'alter-spielstand' };
  if (webdriver) return { nr: 1, seed: 1, quelle: 'test' };
  const nr = FORMEN[Math.floor(zufall() * FORMEN.length)].nr, gseed = neuerSeed(zufall, nr);
  try { s?.setItem(KEY, JSON.stringify({ nr, gseed, seed: null })); } catch { /* privat: nur für diese Sitzung */ }
  return { nr, seed: gseed, quelle: 'neu' };
}

// Beim Laden im Browser gleich wählen, damit das Gelände schon beim ersten Bau stimmt.
// Ohne Browserseite (Node, Tests, Werkzeuge) bleibt Form 1.
try {
  if (typeof document !== 'undefined') {
    aktiv = formWaehlen();
    form = formBauen(aktiv.nr, aktiv.seed);
  }
} catch { /* Form 1 */ }

/**
 * Ausschnitt, der den Charakter der Form zeigt: Hafen, Einfahrt und alle Landmarken der Form
 * (Leuchttürme, Inseln im See und vor der Küste). Weltmeter wie die Kamera: { minX, maxX, minZ, maxZ }.
 * Gedacht für einen kurzen Überblick beim Spielstart, bevor die Kamera zum Hafen fährt.
 * maxBreiteM: höchste Breite des Rahmens; unter 250 m (Handy hochkant) nur Einfahrt und die nächsten Landmarken.
 */
export function blickRect(f = gelaendeform(), { maxBreiteM = 420 } = {}) {
  const U = 0.62;
  // Kern: Hafen, Becken und Einfahrt mit Molen; bei schmalem Rahmen nur der Ostteil mit der Einfahrt
  const schmal = maxBreiteM < 250;
  let x0 = schmal ? 20 : -170, x1 = 240, y0 = -20, y1 = 290;
  const marken = [
    ...(f.leuchttuerme || []).map(([x, y]) => [x, y, 16, 16]),
    ...(f.inseln || []).filter((i) => i.y > 0 && Math.max(i.rx, i.ry) < 200).map((i) => [i.x, i.y, Math.min(i.rx, 20) + 8, Math.min(i.ry, 20) + 8]),
  ].sort((p, q) => Math.hypot(p[0] - 178, p[1] - 200) - Math.hypot(q[0] - 178, q[1] - 200));
  // Landmarken von der Einfahrt aus nach Nähe dazunehmen, solange der Rahmen nicht zu breit wird
  for (const [x, y, rx, ry] of marken) {
    const nx0 = Math.min(x0, x - rx), nx1 = Math.max(x1, x + rx);
    if ((nx1 - nx0) * U > maxBreiteM) continue;
    x0 = nx0; x1 = nx1; y0 = Math.min(y0, y - ry); y1 = Math.max(y1, y + ry);
  }
  return { minX: x0 * U, maxX: x1 * U, minZ: -y1 * U, maxZ: -y0 * U };
}

/** Außenring des Geländes (grob gerechnet) in Planeinheiten, wie terrain.js. */
export const AUSSEN = { x0: -1600, x1: 1600, y0: -1600, y1: 1400 };
const rechteckM = (r) => ({ minX: r.x0 * 0.62, maxX: r.x1 * 0.62, minZ: -r.y1 * 0.62, maxZ: -r.y0 * 0.62 });

/** Spielbereich in Weltmetern: Hafen, Einfahrt, Leuchttürme und nahe Inseln, nie über die Landschaft hinaus. */
export function spielRect(f = gelaendeform()) {
  let x0 = -240, x1 = 480, y0 = -160, y1 = 560;
  for (const [x, y] of f.leuchttuerme || []) { x0 = Math.min(x0, x - 30); x1 = Math.max(x1, x + 30); y0 = Math.min(y0, y - 30); y1 = Math.max(y1, y + 30); }
  for (const i of f.inseln || []) {
    if (Math.hypot(i.x, i.y - 200) > 900 || Math.max(i.rx, i.ry) > 200) continue;
    x0 = Math.min(x0, i.x - 30); x1 = Math.max(x1, i.x + 30); y0 = Math.min(y0, i.y - 30); y1 = Math.max(y1, i.y + 30);
  }
  return rechteckM({ x0: Math.max(x0, WELT.x0), x1: Math.min(x1, WELT.x1), y0: Math.max(y0, WELT.y0), y1: Math.min(y1, WELT.y1) });
}

/** Modul für js/main.js (MODULES): Nummer im Spielstand festhalten, game.gelaende bereitstellen. */
export function init(game) {
  const merken = () => {
    const st = game.state;
    if (!st || aktiv.quelle === 'url') return;
    st.modules = st.modules ?? {};
    st.modules.gelaende = { nr: form.nr, seed: form.seed };
    try { speicher()?.setItem(KEY, JSON.stringify({ nr: form.nr, gseed: form.seed, seed: st.seed ?? null })); } catch { /* egal */ }
  };
  merken();
  game.on?.('ready', merken);
  game.on?.('spielstand-geladen', (neu) => {
    const nr = neu?.modules?.gelaende?.nr, gseed = seedGueltig(neu?.modules?.gelaende?.seed) ? neu.modules.gelaende.seed : 1;
    if (aktiv.quelle === 'url' || !gueltig(nr) || (nr === form.nr && gseed === form.seed)) { merken(); return; }
    // Andere Form: Küsten und Inseln liegen woanders, also mit dem neuen Stand neu starten
    try { speicher()?.setItem(KEY, JSON.stringify({ nr, gseed, seed: neu.seed ?? null })); } catch { /* egal */ }
    try { game.spielstand?.speichern?.(neu); } catch { /* egal */ }
    globalThis.location?.reload?.();
  });
  game.gelaende = {
    aktuell: () => ({ nr: form.nr, name: form.name, idee: form.idee, seed: form.seed, dreh: form.natur.dreh, leuchttuerme: form.leuchttuerme, quelle: aktiv.quelle }),
    weltRect: () => rechteckM(WELT),
    feinRect: () => rechteckM(BEREICH),
    aussenRect: () => rechteckM(AUSSEN),
    spielRect: () => spielRect(form),
    anzahl: FORMEN.length, formen: FORMEN.map(({ nr, name, idee }) => ({ nr, name, idee })),
    blickRect: (opt) => blickRect(form, opt),
  };
}
