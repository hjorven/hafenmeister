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

// Menschen, die nicht mit Booten kommen (Jorven, 12.11.2026: der Hafen soll belebter sein).
// Je Ausbaustufe (Index = Stufe) im Sommer am Tag. ort = Spaziergaenger aus dem Ort auf Uferweg,
// Promenade und Stegen; strand = Badegaeste auf der Nehrung und am Seeufer.
export const SPAZIERGAENGER = {
  ort:    [0, 10, 14, 18, 24, 28, 28],
  strand: [0, 14, 18, 24, 30, 34, 34],
};
// Faktoren je Jahreszeit (aus game.emit('season', { part })), abends und bei Regen
export const JAHRESZEIT = {
  ort:    { fruehling: 0.85, sommer: 1, herbst: 0.7, winter: 0.3 },
  strand: { fruehling: 0.5, sommer: 1, herbst: 0.4, winter: 0.08 },
};
export const ABENDS = { ort: 0.45, strand: 0.2 };
export const REGEN = 0.4;
// Leute aus dem Ort halten sich bevorzugt bis etwa so weit (Planeinheiten) um die Stege auf.
export const NAEHE = 110;

// Wer wohin am liebsten geht: Faktor auf das Gewicht in ZIELE, fehlt er, gilt 1
// (bei den Badegaesten 0.2: sie bleiben meist am Strand).
export const VORLIEBE = {
  crew:   { strand: 0.6, baden: 0.6 },
  ort:    { strand: 1.2, baden: 0.8, aussicht: 2.5 },
  strand: { strand: 8, baden: 6, strandkoerbe: 4, seebruecke: 3, kiosk: 2, aussicht: 1 },
};

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
  strand:       { gewicht: 2, dauer: [30, 90], drinnen: false, sitzen: true },   // im Sand sitzen
  baden:        { gewicht: 1, dauer: [20, 60], drinnen: false, nurBadewetter: true },
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
