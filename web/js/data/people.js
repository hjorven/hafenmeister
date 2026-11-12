// Menschen im Hafen (docs/plan.md, Abschnitt 11a): alle Zahlen an einer Stelle.
// Gehoert dem Thread "Menschen im Hafen herumlaufen lassen". Keine Namen, keine Gesichter.

// Menschen an Bord je Groesse, falls die Schiffsdaten kein crew: [min, max] liefern.
export const CREW_STANDARD = {
  s: [1, 3],
  m: [2, 5],
  l: [2, 8],
  xl: [6, 40],
  xxl: [20, 60],
};

// Darstellung: bis zu so vielen Menschen je Boot laeuft jede Person einzeln. Darueber steht
// eine Figur fuer BUENDEL Menschen (Kreuzfahrtschiff, Marine).
export const EINZELN_BIS = 12;
export const BUENDEL = 5;

// Hoechstzahl Figuren gleichzeitig (eine InstancedMesh), plan.md: etwa 300.
export const MAX_FIGUREN = 300;

// Spaziergaenger aus dem Ort und Badegaeste je Ausbaustufe (Index = Stufe), tagsueber.
// Abends ist es die Haelfte.
export const SPAZIERGAENGER = [0, 5, 9, 14, 20, 26, 26];

// Gehgeschwindigkeit in m/s (Spielzeit), je Person zufaellig im Bereich.
export const TEMPO = [1.0, 1.5];

// Wie lange jemand an einem Ziel bleibt, in Sekunden Spielzeit: [min, max].
// drinnen = Figur verschwindet im Gebaeude, sonst steht oder sitzt sie dort.
export const ZIELE = {
  toilette:     { gewicht: 3, dauer: [6, 14],  drinnen: true },
  dusche:       { gewicht: 3, dauer: [14, 28], drinnen: true },
  sanitaer:     { gewicht: 4, dauer: [12, 26], drinnen: true },
  kiosk:        { gewicht: 5, dauer: [8, 18],  drinnen: false },
  restaurant:   { gewicht: 5, dauer: [30, 70], drinnen: true },
  hafenmeister: { gewicht: 2, dauer: [6, 14],  drinnen: true },
  hafenbuero:   { gewicht: 2, dauer: [8, 16],  drinnen: true },
  speicher:     { gewicht: 3, dauer: [16, 34], drinnen: true },
  strandkoerbe: { gewicht: 4, dauer: [25, 60], drinnen: false },
  seebruecke:   { gewicht: 4, dauer: [10, 24], drinnen: false },
  aussicht:     { gewicht: 3, dauer: [8, 20],  drinnen: false },   // Stegkopf, Molenkopf
};

// Wer von seinem Boot kommt: Anteil, der nach einem Ziel erst wieder an Bord geht.
export const ZURUECK_AN_BORD = 0.35;
// Pause an Bord, bevor es wieder an Land geht (Sekunden Spielzeit)
export const AN_BORD_PAUSE = [20, 60];
// Abends bleiben so viele noch an Land (im Restaurant), der Rest geht an Bord.
export const ABENDS_AN_LAND = 0.2;
// Hoechstens so lange wartet ein ablegendes Boot auf seine Leute (Sekunden Spielzeit).
export const WARTEN_MAX = 20;

// Farben: Oberteile, Hosen, Haut. Nordisch bunt, Flat-Stil.
export const FARBEN = {
  oberteil: ['#e0604c', '#2e3f5c', '#f2c14e', '#4f7cac', '#f4f1ea', '#4e9a6b', '#e98a3c', '#9cc3d5', '#b04a3c', '#d9d7d0'],
  hose: ['#2e3f5c', '#4a5059', '#c8b58e', '#3b4a63', '#2b2a2a'],
  haut: ['#f1d2b6', '#e6bc98', '#c99a6b', '#8a5a3c', '#f5dcc8'],
};
