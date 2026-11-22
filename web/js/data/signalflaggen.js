// Signalflaggen (Roadmap P49, F33, docs/signalflaggen.md): die Buchstabenflaggen des Internationalen
// Signalbuchs als Pixelbilder, dazu der Hafen-Code des Spiels: Welche Flagge ein Gast für welchen Wunsch
// unter der Saling setzt. Ohne Browser nutzbar (Tests: tests/signalflaggen.test.mjs).
//
// Jede Flagge ist ein Raster BREITE x HOEHE aus Farbbuchstaben (FARBEN). Gezeichnet wird sie von
// render/signalflaggen.js (Tuch am Boot) und features/hafenwissen.js (Lexikon im Logbuch, Karte).
// '.' ist durchsichtig (Schwalbenschwanz von A und B).

export const BREITE = 15;
export const HOEHE = 10;

export const FARBEN = {
  R: '#c8202f',   // rot
  B: '#1f4fa0',   // blau
  Y: '#f2c014',   // gelb
  W: '#f6f3ea',   // weiß
  K: '#1c1c22',   // schwarz
};

// Farbe je Pixel: f(x, y) mit x 0..BREITE-1 (Liek am Mast bei x = 0), y 0..HOEHE-1 (oben 0)
const W_ = BREITE, H_ = HOEHE;
const mx = (W_ - 1) / 2, my = (H_ - 1) / 2;
const nx = (x) => (x + 0.5) / W_;   // 0..1 von Liek nach Flugende
const ny = (y) => (y + 0.5) / H_;   // 0..1 von oben nach unten
const schwalbe = (x, y) => nx(x) > 0.72 && Math.abs(ny(y) - 0.5) < (nx(x) - 0.72) * 1.8;

const MUSTER = {
  A: (x, y) => (schwalbe(x, y) ? '.' : nx(x) < 0.5 ? 'W' : 'B'),
  B: (x, y) => (schwalbe(x, y) ? '.' : 'R'),
  C: (x, y) => 'BWRWB'[Math.min(4, Math.floor(ny(y) * 5))],
  D: (x, y) => (ny(y) < 0.2 || ny(y) > 0.8 ? 'Y' : 'B'),
  E: (x, y) => (ny(y) < 0.5 ? 'B' : 'R'),
  F: (x, y) => (Math.abs(x - mx) / (W_ / 2) + Math.abs(y - my) / (H_ / 2) < 0.95 ? 'R' : 'W'),
  G: (x, y) => (Math.floor(nx(x) * 6) % 2 ? 'B' : 'Y'),
  H: (x, y) => (nx(x) < 0.5 ? 'W' : 'R'),
  I: (x, y) => (Math.hypot((x - mx) / (H_ * 0.3), (y - my) / (H_ * 0.3)) < 1 ? 'K' : 'Y'),
  J: (x, y) => (ny(y) < 0.3 || ny(y) > 0.7 ? 'B' : 'W'),
  K: (x, y) => (nx(x) < 0.5 ? 'Y' : 'B'),
  L: (x, y) => ((nx(x) < 0.5) === (ny(y) < 0.5) ? 'Y' : 'K'),
  M: (x, y) => (Math.abs(nx(x) - ny(y)) < 0.13 || Math.abs(nx(x) - (1 - ny(y))) < 0.13 ? 'W' : 'B'),
  N: (x, y) => ((Math.floor(nx(x) * 4) + Math.floor(ny(y) * 4)) % 2 ? 'W' : 'B'),
  O: (x, y) => (nx(x) > ny(y) ? 'R' : 'Y'),
  P: (x, y) => (Math.abs(nx(x) - 0.5) < 0.2 && Math.abs(ny(y) - 0.5) < 0.2 ? 'W' : 'B'),
  Q: () => 'Y',
  R: (x, y) => (Math.abs(x - mx) < 1.5 || Math.abs(y - my) < 1 ? 'Y' : 'R'),
  S: (x, y) => (Math.abs(nx(x) - 0.5) < 0.2 && Math.abs(ny(y) - 0.5) < 0.2 ? 'B' : 'W'),
  T: (x, y) => 'RWB'[Math.min(2, Math.floor(nx(x) * 3))],
  U: (x, y) => ((nx(x) < 0.5) === (ny(y) < 0.5) ? 'R' : 'W'),
  V: (x, y) => (Math.abs(nx(x) - ny(y)) < 0.12 || Math.abs(nx(x) - (1 - ny(y))) < 0.12 ? 'R' : 'W'),
  W: (x, y) => {
    const r = Math.min(nx(x), 1 - nx(x), ny(y), 1 - ny(y));
    return r < 0.17 ? 'B' : r < 0.34 ? 'W' : 'R';
  },
  X: (x, y) => (Math.abs(x - mx) < 1.5 || Math.abs(y - my) < 1 ? 'B' : 'W'),
  Y: (x, y) => ('YR'[Math.floor((x + y) / 2.5) % 2]),
  Z: (x, y) => {
    const dx = nx(x) - 0.5, dy = ny(y) - 0.5;
    if (Math.abs(dy) > Math.abs(dx)) return dy < 0 ? 'Y' : 'R';
    return dx < 0 ? 'K' : 'B';
  },
};

/** Raster einer Flagge: Liste von HOEHE Zeilen mit je BREITE Farbbuchstaben. */
export function flaggenRaster(buchstabe) {
  const f = MUSTER[buchstabe];
  if (!f) return null;
  const zeilen = [];
  for (let y = 0; y < H_; y++) {
    let z = '';
    for (let x = 0; x < W_; x++) z += f(x, y);
    zeilen.push(z);
  }
  return zeilen;
}

// Buchstabiertafel (Seefunk) und Bedeutung als Einzelflagge im Internationalen Signalbuch
export const SIGNALBUCH = {
  A: { name: 'Alfa', echt: 'Ich habe Taucher unten. Halten Sie sich frei und fahren Sie langsam.' },
  B: { name: 'Bravo', echt: 'Ich lade, lösche oder befördere gefährliche Güter, zum Beispiel Treibstoff.' },
  C: { name: 'Charlie', echt: 'Ja.' },
  D: { name: 'Delta', echt: 'Halten Sie sich frei von mir, ich bin manövrierbehindert.' },
  E: { name: 'Echo', echt: 'Ich ändere meinen Kurs nach Steuerbord.' },
  F: { name: 'Foxtrot', echt: 'Ich bin manövrierunfähig, nehmen Sie Verbindung mit mir auf.' },
  G: { name: 'Golf', echt: 'Ich brauche einen Lotsen. Auf Fischern: Ich hole Netze ein.' },
  H: { name: 'Hotel', echt: 'Ich habe einen Lotsen an Bord.' },
  I: { name: 'India', echt: 'Ich ändere meinen Kurs nach Backbord.' },
  J: { name: 'Juliett', echt: 'Ich habe Feuer an Bord und gefährliche Ladung, halten Sie sich frei.' },
  K: { name: 'Kilo', echt: 'Ich möchte mit Ihnen Verbindung aufnehmen.' },
  L: { name: 'Lima', echt: 'Stoppen Sie Ihr Schiff sofort.' },
  M: { name: 'Mike', echt: 'Meine Maschine ist gestoppt, ich mache keine Fahrt durchs Wasser.' },
  O: { name: 'Oscar', echt: 'Mensch über Bord!' },
  P: { name: 'Papa', echt: 'Im Hafen: Alle an Bord, das Schiff läuft gleich aus. Seeleute nennen sie den Blauen Peter.' },
  Q: { name: 'Quebec', echt: 'Mein Schiff ist gesund, ich bitte um freie Verkehrserlaubnis.' },
  R: { name: 'Romeo', echt: 'Als einzelne Flagge ohne eigene Bedeutung, in Signalen ein Buchstabe.' },
  S: { name: 'Sierra', echt: 'Meine Maschine geht rückwärts.' },
  T: { name: 'Tango', echt: 'Halten Sie sich frei von mir, ich fische im Gespann.' },
  V: { name: 'Victor', echt: 'Ich benötige Hilfe.' },
  W: { name: 'Whiskey', echt: 'Ich benötige ärztliche Hilfe.' },
  Y: { name: 'Yankee', echt: 'Mein Anker schleppt.' },
  Z: { name: 'Zulu', echt: 'Ich benötige einen Schlepper.' },
};

// Hafen-Code: welche Flagge ein Gast für einen Wunsch setzt, mit Merkhilfe. Jeder Wunsch des Spiels
// (ECONOMY.wuensche, ECONOMY.angebotWunsch, Ehrenplatz der seltenen Besucher) hat genau eine Flagge,
// keine Flagge steht für zwei Wünsche. P ist die echte Flagge vor dem Auslaufen.
export const WUNSCH_FLAGGE = {
  wc:          { flagge: 'W', merk: 'W wie WC' },
  dusche:      { flagge: 'D', merk: 'D wie Dusche' },
  essen:       { flagge: 'E', merk: 'E wie Essen' },
  wasser:      { flagge: 'Q', merk: 'Q wie Quelle: frisches Wasser für den Tank' },
  strom:       { flagge: 'S', merk: 'S wie Strom' },
  wlan:        { flagge: 'K', merk: 'Echt heißt Kilo: „Ich möchte Verbindung aufnehmen“' },
  diesel:      { flagge: 'B', merk: 'Echt heißt Bravo: Treibstoff an Bord' },
  waesche:     { flagge: 'L', merk: 'L wie Leine: die Wäscheleine' },
  absaugen:    { flagge: 'T', merk: 'T wie Tank: der Fäkalientank muss leer' },
  ehrenplatz:  { flagge: 'R', merk: 'R wie roter Teppich' },
  broetchen:   { flagge: 'O', merk: 'O wie ofenfrisch' },
  cafe:        { flagge: 'C', merk: 'C wie Café' },
  grill:       { flagge: 'G', merk: 'G wie Grill' },
  fisch:       { flagge: 'F', merk: 'F wie Fisch' },
  segelclub:   { flagge: 'J', merk: 'J wie Jollen: Klönschnack im Segelclub' },
  rad:         { flagge: 'Z', merk: 'Z wie Zweirad' },
  ausruester:  { flagge: 'A', merk: 'A wie Ausrüster' },
  kran:        { flagge: 'M', merk: 'M wie Mast: der Mast soll gelegt werden' },
  eis:         { flagge: 'I', merk: 'I wie „Ich will Eis“' },
  werft:       { flagge: 'V', merk: 'Echt heißt Victor: „Ich benötige Hilfe“' },
  segelmacher: { flagge: 'Y', merk: 'Y wie Yachtsegel: das Segel ist eingerissen' },
  barkasse:    { flagge: 'H', merk: 'H wie Hafenrundfahrt' },
};

/** Flagge vor dem Auslaufen (Blauer Peter). */
export const AUSLAUFEN = 'P';

/** Buchstabe der Flagge für einen Wunsch, sonst null. */
export function flaggeFuer(wunsch) {
  return Object.prototype.hasOwnProperty.call(WUNSCH_FLAGGE, wunsch) ? WUNSCH_FLAGGE[wunsch].flagge : null;
}

/** Wunsch zu einer Flagge, sonst null (P: null). */
export function wunschVon(buchstabe) {
  for (const [w, d] of Object.entries(WUNSCH_FLAGGE)) if (d.flagge === buchstabe) return w;
  return null;
}

/** Alle Flaggen, die im Spiel vorkommen, in der Reihenfolge des Alphabets. */
export const FLAGGEN_IM_SPIEL = [...new Set([...Object.values(WUNSCH_FLAGGE).map((d) => d.flagge), AUSLAUFEN])].sort();

/** SVG einer Flagge (für Lexikon und Karte), mit dunklem Rand wie die Pixel-Symbole. */
export function flaggenSvg(buchstabe) {
  const r = flaggenRaster(buchstabe);
  if (!r) return '';
  let s = '';
  r.forEach((zeile, y) => {
    // gleiche Farben einer Zeile zusammenfassen
    let x0 = 0;
    for (let x = 1; x <= zeile.length; x++) {
      if (x < zeile.length && zeile[x] === zeile[x0]) continue;
      const c = zeile[x0];
      if (c !== '.') s += `<rect x="${x0 + 1}" y="${y + 1}" width="${x - x0}" height="1" fill="${FARBEN[c]}"/>`;
      x0 = x;
    }
  });
  // Rand: um jede sichtbare Zelle, die an Leere grenzt
  let rand = '';
  const leer = (x, y) => x < 0 || y < 0 || x >= BREITE || y >= HOEHE || r[y][x] === '.';
  for (let y = -1; y <= HOEHE; y++) {
    for (let x = -1; x <= BREITE; x++) {
      if (!leer(x, y)) continue;
      const nachbar = !leer(x - 1, y) || !leer(x + 1, y) || !leer(x, y - 1) || !leer(x, y + 1);
      if (nachbar) rand += `<rect x="${x + 1}" y="${y + 1}" width="1" height="1" fill="#24364a"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${BREITE + 2}" height="${HOEHE + 2}" viewBox="0 0 ${BREITE + 2} ${HOEHE + 2}" shape-rendering="crispEdges">${rand}${s}</svg>`;
}
