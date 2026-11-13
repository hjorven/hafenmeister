// Geländeformen: jedes Spiel bekommt eine von zehn Grundformen der Küste rund um den Hafen.
// Die Formen sind frei nach Landschaften an Ost- und Nordsee gebaut (Nehrung, Lotseninsel, Sandbank,
// Bodden, Inselkette, offene Küste, Förde, Watt, Dünenspitze, Doppelinsel), aber fürs Spiel geformt:
// breite Durchfahrten, freies Wasser zum Ankern, gut lesbare Einfahrt. Keine Form bildet einen echten Ort ab.
// Beschreibung: docs/landschaft.md, Abschnitt "Geländeformen".
//
// Fest in jeder Form (damit Liegeplätze, Stegbilder, Bauen und Spielstände passen):
//   Festlandufer und Becken am Hafen (x -165..215), Engpass bei x 178 mit Molen und Fahrwasser,
//   westliche Nehrung x -372..-85 als Land, offenes Wasser im Norden, Wartebojen und Ankerfelder.
// Je Form verschieden: Nehrung östlich des Engpasses, Breite und Dünen der Nehrung, Inseln im Binnensee,
//   Leuchttürme, Riffe und Watt vor dem Strand, Steilufer, Öffnung des Binnensees nach Osten.
//
// Eine Form entfernen: ihren Eintrag aus FORMEN löschen. Spielstände mit dieser Nummer bekommen Form 1.
//
// Welche Form gilt (erste passende Regel, wie bei den Stegbildern):
//   1. URL ?gelaende=N (1 bis 10). Nur zum Ansehen, wird nicht gespeichert.
//   2. Spielstand mit modules.gelaende.nr.
//   3. Eigener Eintrag 'hafenmeister.gelaende' im Browser, der zum Spielstand gehört.
//   4. Spielstand von vor den Formen: Form 1.
//   5. Automatischer Test (navigator.webdriver) oder Node: Form 1.
//   6. Neues Spiel: eine Form zufällig, wird gemerkt.

/** Feldbeschreibung (alle Längen in Planeinheiten, 1 = 0,62 m):
 *  duenen        Faktor auf die Dünenhöhe der Region
 *  breiteSee     Nehrung östlich des Engpasses zur See hin breiter (+) oder schmaler (-)
 *  ostEnde       die Nehrung endet bei dieser x; östlich davon ostArt
 *  ostArt        'offen' (Wasser wie Binnensee), 'sandbank' (Sandbank knapp unter und über Wasser)
 *  luecken       [{ x0, x1, tiefe }] flache Durchlässe durch die Nehrung östlich des Engpasses (machen Inseln)
 *  hakenOst      die Nehrung biegt am Ostende als Haken in den Binnensee
 *  seeOstOffen   der Binnensee schließt sich im Osten nicht (Bodden zieht sich bis an den Kartenrand)
 *  seeWest       ab hier (x) schließt sich der Binnensee im Westen (Standard -235, kleiner = See reicht weiter)
 *  seeOst        ab hier (x) schließt sich der Binnensee im Osten (Standard 345); nie innerhalb x -165..215
 *  seeInseln     [{ x, y, rx, ry, art: 'wald'|'wiese'|'schilf' }] Inseln im Binnensee (außerhalb des Hafens)
 *  leuchttuerme  [[x, y]] Leuchttürme an Land (auf Inseln, Nehrungsspitzen)
 *  riff          { x0, x1, y, breite, tiefe } Sandriff vor dem Seestrand (nicht im Fahrwasser)
 *  watt          Breite des Watts vor dem Seestrand (fällt bei Niedrigwasser trocken), Priel am Engpass bleibt frei
 *  seeAussen     [{ x, y, rx, ry, art: 'insel'|'sandplate'|'fels' }] vor der Küste in der offenen See; ab Stufe 5 im Ausbaubereich weggebaggert
 *  steilufer     Höhe des Steilufers am Festland außerhalb des Hafens (Meter)
 */
export const FORMEN = [
  { nr: 1, name: 'Nehrung', idee: 'Lange Nehrung mit Dünen und Salzwiesen, natürliches Seegatt in der Mitte, weiter Binnensee.' },
  { nr: 2, name: 'Lotseninsel', idee: 'Östlich des Engpasses trennt ein flacher Priel eine Insel mit Leuchtturm ab, im Osten ragt eine Schilfhalbinsel in den See.',
    luecken: [{ x0: 236, x1: 266, tiefe: 1.0 }], leuchttuerme: [[284, 205]], duenen: 0.8, seeOst: 300,
    seeInseln: [{ x: 300, y: 40, rx: 34, ry: 46, art: 'schilf' }] },
  { nr: 3, name: 'Sandbank', idee: 'Hinter einer langen Sandbank: im Osten nur noch Sand knapp über dem Wasser, Riff vor dem Weststrand, Wald statt See im Westen.',
    ostEnde: 238, ostArt: 'sandbank', leuchttuerme: [[126, 212]], seeWest: -185, riff: { x0: -380, x1: 110, y: 246, breite: 8, tiefe: 0.7 },
    seeAussen: [{ x: -230, y: 262, rx: 64, ry: 9, art: 'sandplate' }, { x: -86, y: 270, rx: 36, ry: 7, art: 'sandplate' }, { x: 330, y: 258, rx: 40, ry: 8, art: 'sandplate' }] },
  { nr: 4, name: 'Bodden', idee: 'Weites, flaches Boddenwasser: die Nehrung endet im Osten, dort liegen Inseln mit Schilf und Wald.',
    ostEnde: 300, ostArt: 'offen', seeOstOffen: true, duenen: 0.7, seeWest: -260,
    seeInseln: [{ x: 300, y: 90, rx: 34, ry: 20, art: 'wald' }, { x: 372, y: 150, rx: 22, ry: 14, art: 'schilf' }, { x: 366, y: 40, rx: 26, ry: 18, art: 'wiese' },
      { x: -236, y: 138, rx: 34, ry: 16, art: 'schilf' }] },
  { nr: 5, name: 'Inselkette', idee: 'Die Nehrung zerfällt östlich des Engpasses in kleine Inseln, im See setzt sich die Kette fort, hohe Dünen im Westen.',
    luecken: [{ x0: 240, x1: 262, tiefe: 0.9 }, { x0: 300, x1: 318, tiefe: 0.8 }, { x0: 358, x1: 378, tiefe: 0.9 }], duenen: 1.3, leuchttuerme: [[338, 206]],
    seeInseln: [{ x: 262, y: 120, rx: 16, ry: 11, art: 'wiese' }, { x: 300, y: 82, rx: 20, ry: 13, art: 'wald' }, { x: 334, y: 40, rx: 15, ry: 10, art: 'schilf' }] },
  { nr: 6, name: 'Offene Küste', idee: 'Niedrige, schmale Nehrung, die im Osten als Haken in den See biegt. Vor der Küste eine kleine Insel mit Leuchtturm.',
    duenen: 0.4, breiteSee: -6, ostEnde: 352, ostArt: 'offen', hakenOst: true, seeOst: 320,
    seeAussen: [{ x: 336, y: 268, rx: 20, ry: 13, art: 'insel' }], leuchttuerme: [[336, 270]] },
  { nr: 7, name: 'Steilküste', idee: 'Hohe, steile Ufer mit Felsbändern rahmen ein kleines, tief eingeschnittenes Hafenbecken ein.',
    steilufer: 12, duenen: 1.1, seeWest: -195, seeOst: 250,
    seeAussen: [{ x: 352, y: 262, rx: 17, ry: 11, art: 'fels' }, { x: 300, y: 250, rx: 7, ry: 6, art: 'fels' }, { x: 384, y: 276, rx: 9, ry: 7, art: 'fels' }] },
  { nr: 8, name: 'Watt', idee: 'Breites Watt vor dem Strand, das bei Ebbe trockenfällt; nur der Priel vor der Einfahrt bleibt tief. Salzwiesen im Osten.',
    watt: 30, duenen: 0.9, leuchttuerme: [[330, 212]], seeOst: 330 },
  { nr: 9, name: 'Dünenspitze', idee: 'Hohe Wanderdünen, die Nehrung endet im Osten mit einer Spitze und Leuchtturm, vom Festland ragt eine Waldhalbinsel in den See.',
    duenen: 1.8, breiteSee: 8, ostEnde: 372, ostArt: 'offen', hakenOst: true, leuchttuerme: [[352, 214]],
    seeInseln: [{ x: 310, y: 30, rx: 44, ry: 56, art: 'wald' }] },
  { nr: 10, name: 'Doppelinsel', idee: 'Im See westlich des Hafens liegt eine bewaldete Insel, östlich des Engpasses eine zweite Insel mit Leuchtturm.',
    luecken: [{ x0: 262, x1: 290, tiefe: 1.0 }], leuchttuerme: [[312, 207]], seeWest: -270,
    seeInseln: [{ x: -262, y: 112, rx: 46, ry: 24, art: 'wald' }] },
];

const KEY = 'hafenmeister.gelaende';
const SAVE_KEYS = ['hafenmeister.spielstand', 'hafenmeister.save'];
const nachNr = new Map(FORMEN.map((f) => [f.nr, f]));
const gueltig = (nr) => Number.isInteger(nr) && nachNr.has(nr);

let aktiv = { nr: 1, quelle: 'standard' };
let form = nachNr.get(1);

/** Die Form, die gerade gilt (Eintrag aus FORMEN). */
export function gelaendeform() { return form; }

/** Setzt die Form direkt (Tests, Vorschau, Werkzeuge). Unbekannte Nummern geben Form 1. */
export function formSetzen(nr) {
  form = nachNr.get(nr) ?? nachNr.get(1);
  aktiv = { nr: form.nr, quelle: 'gesetzt' };
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
    const nr = spiel?.modules?.gelaende?.nr;
    return { seed: spiel?.seed ?? null, nr: Number.isInteger(nr) ? nr : null };
  }
  return null;
}

/** Entscheidet, welche Form gilt. Rückgabe { nr, quelle }. */
export function formWaehlen({ url = globalThis.location?.search ?? '', s = speicher(), zufall = Math.random, webdriver = globalThis.navigator?.webdriver === true } = {}) {
  const p = new URLSearchParams(url).get('gelaende');
  if (p !== null && gueltig(Number(p))) return { nr: Number(p), quelle: 'url' };
  const stand = gespeichert(s);
  if (stand && gueltig(stand.nr)) return { nr: stand.nr, quelle: 'spielstand' };
  const eigen = lies(s, KEY);
  if (eigen && gueltig(eigen.nr) && (!stand || eigen.seed == null || eigen.seed === stand.seed)) return { nr: eigen.nr, quelle: 'browser' };
  if (stand) return { nr: 1, quelle: 'alter-spielstand' };
  if (webdriver) return { nr: 1, quelle: 'test' };
  const nr = FORMEN[Math.floor(zufall() * FORMEN.length)].nr;
  try { s?.setItem(KEY, JSON.stringify({ nr, seed: null })); } catch { /* privat: nur für diese Sitzung */ }
  return { nr, quelle: 'neu' };
}

// Beim Laden im Browser gleich wählen, damit das Gelände schon beim ersten Bau stimmt.
// Ohne Browserseite (Node, Tests, Werkzeuge) bleibt Form 1.
try {
  if (typeof document !== 'undefined') {
    aktiv = formWaehlen();
    form = nachNr.get(aktiv.nr) ?? nachNr.get(1);
  }
} catch { /* Form 1 */ }

/** Modul für js/main.js (MODULES): Nummer im Spielstand festhalten, game.gelaende bereitstellen. */
/**
 * Ausschnitt, der den Charakter der Form zeigt: Hafen, Einfahrt und alle Landmarken der Form
 * (Leuchttürme, Inseln im See und vor der Küste). Weltmeter wie die Kamera: { minX, maxX, minZ, maxZ }.
 * Gedacht für einen kurzen Überblick beim Spielstart, bevor die Kamera zum Hafen fährt.
 */
export function blickRect(f = gelaendeform()) {
  const U = 0.62;
  let x0 = -170, x1 = 240, y0 = -20, y1 = 290;          // Hafen, Becken, Einfahrt mit Molen
  const nimm = (x, y, rx = 12, ry = 12) => { x0 = Math.min(x0, x - rx); x1 = Math.max(x1, x + rx); y0 = Math.min(y0, y - ry); y1 = Math.max(y1, y + ry); };
  for (const [x, y] of f.leuchttuerme || []) nimm(x, y, 16, 16);
  for (const i of [...(f.seeInseln || []), ...(f.seeAussen || [])]) nimm(i.x, i.y, Math.min(i.rx, 20) + 8, Math.min(i.ry, 20) + 8);
  return { minX: x0 * U, maxX: x1 * U, minZ: -y1 * U, maxZ: -y0 * U };
}

export function init(game) {
  const merken = () => {
    const st = game.state;
    if (!st || aktiv.quelle === 'url') return;
    st.modules = st.modules ?? {};
    st.modules.gelaende = { nr: form.nr };
    try { speicher()?.setItem(KEY, JSON.stringify({ nr: form.nr, seed: st.seed ?? null })); } catch { /* egal */ }
  };
  merken();
  game.on?.('ready', merken);
  game.on?.('spielstand-geladen', (neu) => {
    const nr = neu?.modules?.gelaende?.nr;
    if (aktiv.quelle === 'url' || !gueltig(nr) || nr === form.nr) { merken(); return; }
    // Andere Form: Küsten und Inseln liegen woanders, also mit dem neuen Stand neu starten
    try { speicher()?.setItem(KEY, JSON.stringify({ nr, seed: neu.seed ?? null })); } catch { /* egal */ }
    try { game.spielstand?.speichern?.(neu); } catch { /* egal */ }
    globalThis.location?.reload?.();
  });
  game.gelaende = {
    aktuell: () => ({ ...form, quelle: aktiv.quelle }), anzahl: FORMEN.length, formen: FORMEN.map(({ nr, name, idee }) => ({ nr, name, idee })),
    blickRect: () => blickRect(form),
  };
}
