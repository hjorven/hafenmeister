// Schiffe der Größe M (6 bis 9 m): vier Arten mit je fünf Modellen.
// Quelle: docs/hafen-und-schiffe.md, Abschnitt 4. Alle Maße in Metern.
//
// Gemeinsame Konvention aller Bootsmodule (S, M, L, XL):
// 1 Einheit = 1 m, Y nach oben, Bug zeigt nach +X, Ursprung = Wasserlinie mittschiffs.
//
// Felder je Modell
//   id, typeId, name, fromStage   Kennung, Art, Anzeigename, ab welcher Hafenstufe
//   length, beam, draft            Länge über alles, Breite, Tiefgang (für die Platzregel)
//   airDraft                       Höhe über Wasser (Mastspitze oder Dach)
//   mooring                        "box" (Box M, Stichsteg, Stirnplatz) oder "fischer" (Fischersteg/Fischereikai)
//   look                           Bauplan für das 3D-Modell (Rumpf, Aufbau, Rigg, Anbauten), x-Werte als Anteil der Länge
//   palettes                       Farbvarianten, gleiche Form, andere Farben

// Grundfarben im Flat-Vector-Stil (aus docs/stile/bilder/02-flat-vector-max.png abgeleitet)
const C = {
  weiss: '#f4f1ea',
  creme: '#ece4d2',
  hellgrau: '#d9d7d0',
  grau: '#9aa0a6',
  dunkelgrau: '#4a5059',
  marine: '#2e3f5c',
  blau: '#4f7cac',
  hellblau: '#9cc3d5',
  rot: '#e0604c',
  dunkelrot: '#9c3b36',
  gruen: '#4e9a6b',
  dunkelgruen: '#2f5d47',
  gelb: '#f2c14e',
  orange: '#e98a3c',
  holz: '#c99a6b',
  teak: '#d8b48a',
  mahagoni: '#8a4b2f',
  teer: '#2b2a2a',
  lohbraun: '#9a5a3a',
  antifouling: '#3b4a63',
  antifoulingRot: '#8e3a35',
  fenster: '#2c3a4f',
  persenningBlau: '#3d6a8e',
  persenningGruen: '#3f7a5c',
  persenningRot: '#b04a3c',
  persenningSand: '#c8b58e',
};

export const TYPES = [
  { id: 'M1', name: 'Kleinkreuzer', fromStage: 2, length: [6, 8.5], beam: [2.2, 2.8], draft: [0.3, 1.4] },
  { id: 'M2', name: 'Klassiker aus Holz', fromStage: 3, length: [7, 9], beam: [2.0, 2.8], draft: [1.1, 1.5] },
  { id: 'M3', name: 'Kajütmotorboot', fromStage: 2, length: [6.5, 9], beam: [2.5, 3.2], draft: [0.6, 0.9] },
  { id: 'M4', name: 'Fischerboot', fromStage: 2, length: [6, 9], beam: [2.4, 3.2], draft: [0.6, 1.0] },
];

export const MODELS = [
  // ---------------------------------------------------------------- M1 Kleinkreuzer
  {
    id: 'M1-1', typeId: 'M1', name: 'Jollenkreuzer', fromStage: 2,
    length: 6.6, beam: 2.5, draft: 0.3, airDraft: 9.0, mooring: 'box',
    form: 'sehr flach und breit, Schwert statt Kiel, langer niedriger Aufbau',
    look: {
      hull: { bowWidth: 0, sternWidth: 0.78, fullness: 0.8, freeboard: 0.5, sheerBow: 0.12, depth: 0.25, bottom: 'flach', bowOver: 0.1, sternOver: 0.02, keelPow: 3, keel: 'keiner', rudder: 'angehaengt' },
      cabins: [{ x0: -0.12, x1: 0.28, hw: 0.32, h: 0.38, inset: 0.05, rakeAft: 0.02, rakeFore: 0.12, taper: 0.25, windows: { kind: 'band', from: 0.35, to: 0.75 } }],
      cockpit: { x0: -0.47, x1: -0.13, hw: 0.36 },
      rig: { kind: 'slup', mastX: 0.08, height: 8.4, boom: 0.42, boomY: 0.9, mast: 'alu' },
      extras: [{ kind: 'zierstreifen' }, { kind: 'fender', count: 2 }],
    },
    palettes: [
      { hull: C.weiss, deck: C.creme, cabin: C.weiss, trim: C.blau, cover: C.persenningBlau, under: C.antifouling, accent: C.holz },
      { hull: C.hellblau, deck: C.creme, cabin: C.weiss, trim: C.marine, cover: C.persenningSand, under: C.antifouling, accent: C.holz },
    ],
  },
  {
    id: 'M1-2', typeId: 'M1', name: 'Kleinkreuzer mit Hubkiel', fromStage: 2,
    length: 6.5, beam: 2.45, draft: 0.4, airDraft: 9.2, mooring: 'box',
    form: 'hoher Aufbau, Kiel hochgekurbelt, Außenborder am Heck',
    look: {
      hull: { bowWidth: 0, sternWidth: 0.82, fullness: 0.9, freeboard: 0.7, sheerBow: 0.14, depth: 0.35, bottom: 'v', bowOver: 0.06, sternOver: 0.01, keelPow: 4, keel: 'keiner', rudder: 'angehaengt' },
      cabins: [{ x0: -0.15, x1: 0.26, hw: 0.34, h: 0.62, inset: 0.07, rakeAft: 0.03, rakeFore: 0.1, taper: 0.2, windows: { kind: 'band', from: 0.4, to: 0.72 } }],
      cockpit: { x0: -0.48, x1: -0.16, hw: 0.36 },
      rig: { kind: 'slup', mastX: 0.06, height: 8.2, boom: 0.4, boomY: 1.0, mast: 'alu' },
      extras: [{ kind: 'aussenborder' }, { kind: 'bugkorb' }, { kind: 'zierstreifen' }, { kind: 'fender', count: 2 }],
    },
    palettes: [
      { hull: C.weiss, deck: C.hellgrau, cabin: C.weiss, trim: C.rot, cover: C.persenningRot, under: C.antifoulingRot, accent: C.dunkelgrau },
      { hull: C.weiss, deck: C.hellgrau, cabin: C.creme, trim: C.gruen, cover: C.persenningGruen, under: C.antifouling, accent: C.dunkelgrau },
    ],
  },
  {
    id: 'M1-3', typeId: 'M1', name: 'Kajütkreuzer der 70er', fromStage: 3,
    length: 7.6, beam: 2.6, draft: 1.3, airDraft: 10.5, mooring: 'box',
    form: 'kantiger Aufbau, kleine Fenster, Bugkorb, fester Kiel',
    look: {
      hull: { bowWidth: 0, sternWidth: 0.6, fullness: 1.0, freeboard: 0.8, sheerBow: 0.18, sheerStern: 0.08, depth: 0.45, bottom: 'rund', bowOver: 0.12, sternOver: 0.08, keelPow: 3, keel: 'flosse', rudder: 'spaten' },
      cabins: [{ x0: -0.14, x1: 0.24, hw: 0.33, h: 0.5, inset: 0.02, rakeAft: 0.0, rakeFore: 0.05, taper: 0.3, windows: { kind: 'luken', count: 3, from: 0.4, to: 0.7 } }],
      cockpit: { x0: -0.42, x1: -0.15, hw: 0.32 },
      rig: { kind: 'slup', mastX: 0.06, height: 9.6, boom: 0.4, boomY: 1.0, mast: 'alu' },
      extras: [{ kind: 'bugkorb' }, { kind: 'heckkorb' }, { kind: 'reling' }, { kind: 'zierstreifen' }, { kind: 'fender', count: 2 }],
    },
    palettes: [
      { hull: C.creme, deck: C.hellgrau, cabin: C.creme, trim: C.mahagoni, cover: C.persenningSand, under: C.antifoulingRot, accent: C.teak },
      { hull: C.orange, deck: C.creme, cabin: C.creme, trim: C.weiss, cover: C.persenningBlau, under: C.antifouling, accent: C.teak },
      { hull: C.weiss, deck: C.creme, cabin: C.weiss, trim: C.dunkelgruen, cover: C.persenningGruen, under: C.antifouling, accent: C.teak },
    ],
  },
  {
    id: 'M1-4', typeId: 'M1', name: 'Sportkielboot', fromStage: 3,
    length: 8.0, beam: 2.5, draft: 1.4, airDraft: 11.0, mooring: 'box',
    form: 'flaches Deck ohne Aufbau, offenes Heck, ausfahrbarer Gennakerbaum',
    look: {
      hull: { bowWidth: 0, sternWidth: 0.9, fullness: 0.7, freeboard: 0.55, sheerBow: 0.06, depth: 0.3, bottom: 'v', bowOver: 0.02, sternOver: 0.0, keelPow: 6, keel: 'flosse', rudder: 'spaten', openStern: true },
      cabins: [],
      cockpit: { x0: -0.5, x1: 0.05, hw: 0.36 },
      rig: { kind: 'slup', mastX: 0.12, height: 10.4, boom: 0.42, boomY: 0.8, mast: 'schwarz', jib: 0.75 },
      extras: [{ kind: 'gennakerbaum' }, { kind: 'zierstreifen' }],
    },
    palettes: [
      { hull: C.marine, deck: C.hellgrau, cabin: C.weiss, trim: C.weiss, cover: C.dunkelgrau, under: C.dunkelgrau, accent: C.grau },
      { hull: C.weiss, deck: C.hellgrau, cabin: C.weiss, trim: C.rot, cover: C.dunkelgrau, under: C.dunkelgrau, accent: C.grau },
    ],
  },
  {
    id: 'M1-5', typeId: 'M1', name: 'Kleiner Trimaran', fromStage: 3,
    length: 7.4, beam: 2.6, draft: 0.3, airDraft: 10.0, mooring: 'box',
    form: 'drei Rümpfe, Ausleger angeklappt (passt so in eine Box M, ausgeklappt 5,6 m breit)',
    look: {
      hull: { bowWidth: 0, sternWidth: 0.6, fullness: 0.9, freeboard: 0.7, sheerBow: 0.08, depth: 0.45, bottom: 'v', bowOver: 0.03, sternOver: 0.0, keelPow: 4, keel: 'keiner', rudder: 'spaten', beamScale: 0.5 },
      cabins: [{ x0: -0.12, x1: 0.2, hw: 0.4, h: 0.42, inset: 0.06, rakeAft: 0.02, rakeFore: 0.1, taper: 0.3, windows: { kind: 'band', from: 0.4, to: 0.75 } }],
      cockpit: { x0: -0.45, x1: -0.13, hw: 0.42 },
      rig: { kind: 'slup', mastX: 0.06, height: 9.2, boom: 0.42, boomY: 1.0, mast: 'alu' },
      extras: [{ kind: 'amas', folded: true }, { kind: 'zierstreifen' }],
    },
    palettes: [
      { hull: C.weiss, deck: C.hellgrau, cabin: C.weiss, trim: C.gelb, cover: C.persenningBlau, under: C.antifouling, accent: C.dunkelgrau },
      { hull: C.gelb, deck: C.hellgrau, cabin: C.weiss, trim: C.marine, cover: C.dunkelgrau, under: C.antifouling, accent: C.dunkelgrau },
    ],
  },

  // ---------------------------------------------------------------- M2 Klassiker aus Holz
  {
    id: 'M2-1', typeId: 'M2', name: 'Folkeboot-Art', fromStage: 3,
    length: 7.6, beam: 2.2, draft: 1.2, airDraft: 9.8, mooring: 'box',
    form: 'geklinkerter Langkieler, niedriger Aufbau, schräges Heck mit angehängtem Ruder',
    look: {
      hull: { bowWidth: 0, sternWidth: 0.35, fullness: 1.1, freeboard: 0.6, sheerBow: 0.22, sheerStern: 0.12, depth: 0.5, bottom: 'rund', bowOver: 0.13, sternOver: 0.1, keelPow: 2.5, keel: 'lang', rudder: 'angehaengt', build: 'klinker' },
      cabins: [{ x0: -0.08, x1: 0.2, hw: 0.3, h: 0.32, inset: 0.04, rakeAft: 0.01, rakeFore: 0.06, taper: 0.35, windows: { kind: 'luken', count: 2, from: 0.35, to: 0.7 }, color: 'accent' }],
      cockpit: { x0: -0.4, x1: -0.09, hw: 0.3 },
      rig: { kind: 'slup', mastX: 0.08, height: 9.2, boom: 0.38, boomY: 0.75, mast: 'holz' },
      extras: [{ kind: 'scheuerleiste' }],
    },
    palettes: [
      { hull: C.weiss, deck: C.teak, cabin: C.holz, trim: C.holz, cover: C.persenningSand, under: C.antifoulingRot, accent: C.holz },
      { hull: C.marine, deck: C.teak, cabin: C.holz, trim: C.holz, cover: C.creme, under: C.antifoulingRot, accent: C.holz },
      { hull: C.holz, deck: C.creme, cabin: C.mahagoni, trim: C.mahagoni, cover: C.persenningGruen, under: C.antifouling, accent: C.mahagoni },
    ],
  },
  {
    id: 'M2-2', typeId: 'M2', name: 'Spitzgatter', fromStage: 3,
    length: 8.0, beam: 2.6, draft: 1.3, airDraft: 10.2, mooring: 'box',
    form: 'Bug und Heck spitz, fülliger Rumpf, angehängtes Ruder',
    look: {
      hull: { bowWidth: 0, sternWidth: 0, sternFullness: 0.7, fullness: 0.75, freeboard: 0.75, sheerBow: 0.2, sheerStern: 0.16, depth: 0.55, bottom: 'rund', bowOver: 0.07, sternOver: 0.05, keelPow: 2.5, keel: 'lang', rudder: 'angehaengt' },
      cabins: [{ x0: -0.12, x1: 0.2, hw: 0.32, h: 0.42, inset: 0.05, rakeAft: 0.01, rakeFore: 0.05, taper: 0.3, windows: { kind: 'luken', count: 3, from: 0.4, to: 0.7 }, color: 'accent' }],
      cockpit: { x0: -0.36, x1: -0.13, hw: 0.28 },
      rig: { kind: 'slup', mastX: 0.06, height: 9.6, boom: 0.4, boomY: 0.9, mast: 'holz' },
      extras: [{ kind: 'scheuerleiste' }, { kind: 'bugkorb' }, { kind: 'fender', count: 2 }],
    },
    palettes: [
      { hull: C.weiss, deck: C.teak, cabin: C.holz, trim: C.holz, cover: C.persenningBlau, under: C.antifoulingRot, accent: C.holz },
      { hull: C.dunkelgruen, deck: C.teak, cabin: C.holz, trim: C.holz, cover: C.persenningSand, under: C.antifoulingRot, accent: C.holz },
    ],
  },
  {
    id: 'M2-3', typeId: 'M2', name: 'Schärenkreuzer', fromStage: 3,
    length: 9.0, beam: 2.0, draft: 1.4, airDraft: 13.0, mooring: 'box',
    form: 'sehr lang und schmal, niedriges Freibord, lange Überhänge vorn und achtern',
    look: {
      hull: { bowWidth: 0, sternWidth: 0.4, fullness: 1.3, freeboard: 0.42, sheerBow: 0.14, sheerStern: 0.06, depth: 0.32, bottom: 'rund', bowOver: 0.2, sternOver: 0.17, keelPow: 2, keel: 'flosse', rudder: 'spaten' },
      cabins: [{ x0: -0.06, x1: 0.16, hw: 0.26, h: 0.26, inset: 0.04, rakeAft: 0.01, rakeFore: 0.06, taper: 0.4, windows: { kind: 'luken', count: 2, from: 0.35, to: 0.7 }, color: 'accent' }],
      cockpit: { x0: -0.3, x1: -0.07, hw: 0.28 },
      rig: { kind: 'slup', mastX: 0.04, height: 12.4, boom: 0.4, boomY: 0.7, mast: 'holz', jib: 0.7 },
      extras: [{ kind: 'scheuerleiste' }],
    },
    palettes: [
      { hull: C.mahagoni, deck: C.teak, cabin: C.mahagoni, trim: C.teak, cover: C.creme, under: C.antifouling, accent: C.mahagoni },
      { hull: C.weiss, deck: C.teak, cabin: C.holz, trim: C.holz, cover: C.creme, under: C.antifouling, accent: C.holz },
    ],
  },
  {
    id: 'M2-4', typeId: 'M2', name: 'Zeesboot', fromStage: 3,
    length: 8.5, beam: 2.8, draft: 1.1, airDraft: 9.0, mooring: 'box',
    form: 'breiter dunkler Rumpf, zwei Masten, braune Segel',
    look: {
      hull: { bowWidth: 0, sternWidth: 0.55, fullness: 0.6, freeboard: 0.7, sheerBow: 0.25, sheerStern: 0.15, depth: 0.4, bottom: 'flach', bowOver: 0.03, sternOver: 0.02, keelPow: 5, keel: 'keiner', rudder: 'angehaengt', build: 'klinker' },
      cabins: [{ x0: -0.05, x1: 0.15, hw: 0.28, h: 0.35, inset: 0.03, rakeAft: 0.0, rakeFore: 0.0, taper: 0.1, windows: { kind: 'luken', count: 1, from: 0.4, to: 0.7 }, color: 'accent' }],
      cockpit: { x0: -0.42, x1: -0.06, hw: 0.36 },
      rig: { kind: 'zweimast', mastX: 0.3, height: 8.2, mast2X: -0.08, height2: 6.6, boom: 0.3, boomY: 0.9, mast: 'holz', gaff: true, sailColor: C.lohbraun },
      extras: [{ kind: 'bugspriet', length: 1.6 }, { kind: 'seitenschwerter' }, { kind: 'scheuerleiste' }],
    },
    palettes: [
      { hull: C.teer, deck: C.holz, cabin: C.holz, trim: C.rot, cover: C.lohbraun, under: C.teer, accent: C.holz },
      { hull: C.teer, deck: C.holz, cabin: C.holz, trim: C.weiss, cover: C.lohbraun, under: C.teer, accent: C.mahagoni },
    ],
  },
  {
    id: 'M2-5', typeId: 'M2', name: 'Gaffelkutter', fromStage: 3,
    length: 8.8, beam: 2.7, draft: 1.5, airDraft: 11.5, mooring: 'box',
    form: 'senkrechter Steven, langer Bugspriet, Gaffelgroß mit Toppsegel',
    look: {
      hull: { bowWidth: 0, sternWidth: 0.5, fullness: 0.85, freeboard: 0.75, sheerBow: 0.2, sheerStern: 0.1, depth: 0.6, bottom: 'rund', bowOver: 0.0, sternOver: 0.07, keelPow: 8, keel: 'lang', rudder: 'angehaengt' },
      cabins: [{ x0: -0.1, x1: 0.12, hw: 0.28, h: 0.38, inset: 0.03, rakeAft: 0.0, rakeFore: 0.02, taper: 0.15, windows: { kind: 'luken', count: 2, from: 0.4, to: 0.7 }, color: 'accent' }],
      cockpit: { x0: -0.38, x1: -0.11, hw: 0.3 },
      rig: { kind: 'gaffel', mastX: 0.16, height: 9.0, boom: 0.55, boomY: 0.9, mast: 'holz', topmast: 2.2 },
      extras: [{ kind: 'bugspriet', length: 2.4 }, { kind: 'scheuerleiste' }, { kind: 'reling', low: true }],
    },
    palettes: [
      { hull: C.weiss, deck: C.teak, cabin: C.holz, trim: C.dunkelgruen, cover: C.persenningSand, under: C.antifoulingRot, accent: C.holz },
      { hull: C.dunkelgruen, deck: C.teak, cabin: C.holz, trim: C.gelb, cover: C.persenningSand, under: C.antifoulingRot, accent: C.holz },
      { hull: C.marine, deck: C.teak, cabin: C.holz, trim: C.gelb, cover: C.creme, under: C.antifoulingRot, accent: C.holz },
    ],
  },

  // ---------------------------------------------------------------- M3 Kajütmotorboot
  {
    id: 'M3-1', typeId: 'M3', name: 'Verdränger aus Stahl', fromStage: 2,
    length: 8.5, beam: 3.0, draft: 0.9, airDraft: 3.2, mooring: 'box',
    form: 'runder Bug, Steuerhaus mittig, Achterkajüte, dicke Scheuerleiste',
    look: {
      hull: { bowWidth: 0.08, sternWidth: 0.55, fullness: 0.55, sternFullness: 0.7, freeboard: 0.9, sheerBow: 0.18, sheerStern: 0.05, depth: 0.55, bottom: 'rund', bowOver: 0.04, sternOver: 0.03, keelPow: 3, keel: 'lang', rudder: 'spaten' },
      cabins: [
        { x0: -0.04, x1: 0.2, hw: 0.4, h: 1.25, inset: 0.05, rakeAft: 0.0, rakeFore: 0.05, taper: 0.1, windows: { kind: 'band', from: 0.5, to: 0.85 }, roof: 'trim' },
        { x0: -0.42, x1: -0.05, hw: 0.42, h: 0.75, inset: 0.04, rakeAft: 0.02, rakeFore: 0.0, taper: 0.0, windows: { kind: 'luken', count: 3, from: 0.4, to: 0.7 } },
        { x0: 0.2, x1: 0.36, hw: 0.33, h: 0.35, inset: 0.05, rakeAft: 0.0, rakeFore: 0.04, taper: 0.4 },
      ],
      rig: { kind: 'keins' },
      extras: [{ kind: 'scheuerleiste', thick: true }, { kind: 'reling' }, { kind: 'mast_klein', x: 0.04 }, { kind: 'fender', count: 3 }],
    },
    palettes: [
      { hull: C.marine, deck: C.hellgrau, cabin: C.weiss, trim: C.dunkelgrau, cover: C.persenningBlau, under: C.antifoulingRot, accent: C.holz },
      { hull: C.dunkelgruen, deck: C.hellgrau, cabin: C.creme, trim: C.dunkelgrau, cover: C.persenningGruen, under: C.antifoulingRot, accent: C.holz },
      { hull: C.dunkelrot, deck: C.hellgrau, cabin: C.weiss, trim: C.dunkelgrau, cover: C.persenningSand, under: C.antifouling, accent: C.holz },
    ],
  },
  {
    id: 'M3-2', typeId: 'M3', name: 'Gleiter mit Hardtop', fromStage: 2,
    length: 8.0, beam: 2.8, draft: 0.7, airDraft: 2.9, mooring: 'box',
    form: 'flach und keilförmig, große Frontscheibe, Badeplattform',
    look: {
      hull: { bowWidth: 0, sternWidth: 0.95, fullness: 1.4, freeboard: 0.85, sheerBow: 0.2, depth: 0.45, bottom: 'v', bowOver: 0.1, sternOver: 0.0, keelPow: 8, keel: 'keiner', rudder: 'keiner' },
      cabins: [
        { x0: -0.05, x1: 0.3, hw: 0.36, h: 0.35, inset: 0.04, rakeAft: 0.0, rakeFore: 0.15, taper: 0.45 },
        { x0: -0.12, x1: 0.1, hw: 0.42, h: 1.05, inset: 0.06, rakeAft: 0.0, rakeFore: 0.12, taper: 0.1, windows: { kind: 'band', from: 0.3, to: 0.95 }, hardtop: true },
      ],
      cockpit: { x0: -0.48, x1: -0.12, hw: 0.4 },
      rig: { kind: 'keins' },
      extras: [{ kind: 'badeplattform' }, { kind: 'zierstreifen', double: true }, { kind: 'antenne', x: -0.02 }, { kind: 'aussenborder', twin: true, inboard: true }],
    },
    palettes: [
      { hull: C.weiss, deck: C.hellgrau, cabin: C.weiss, trim: C.marine, cover: C.persenningBlau, under: C.antifouling, accent: C.teak },
      { hull: C.weiss, deck: C.hellgrau, cabin: C.weiss, trim: C.rot, cover: C.dunkelgrau, under: C.antifouling, accent: C.teak },
      { hull: C.dunkelgrau, deck: C.hellgrau, cabin: C.weiss, trim: C.weiss, cover: C.dunkelgrau, under: C.antifouling, accent: C.teak },
    ],
  },
  {
    id: 'M3-3', typeId: 'M3', name: 'Nordisches Pilothausboot', fromStage: 2,
    length: 7.5, beam: 2.6, draft: 0.7, airDraft: 3.0, mooring: 'box',
    form: 'Steuerhaus weit vorn mit nach vorn geneigter Scheibe, offenes Achterdeck',
    look: {
      hull: { bowWidth: 0, sternWidth: 0.85, fullness: 1.0, freeboard: 0.9, sheerBow: 0.25, depth: 0.45, bottom: 'v', bowOver: 0.03, sternOver: 0.0, keelPow: 6, keel: 'keiner', rudder: 'keiner' },
      cabins: [{ x0: -0.02, x1: 0.26, hw: 0.4, h: 1.35, inset: 0.03, rakeAft: 0.0, rakeFore: -0.06, taper: 0.15, windows: { kind: 'band', from: 0.5, to: 0.9 }, roof: 'trim' }],
      cockpit: { x0: -0.49, x1: -0.03, hw: 0.42 },
      rig: { kind: 'keins' },
      extras: [{ kind: 'aussenborder' }, { kind: 'reling', fore: true }, { kind: 'antenne', x: 0.08 }, { kind: 'scheuerleiste' }],
    },
    palettes: [
      { hull: C.weiss, deck: C.hellgrau, cabin: C.weiss, trim: C.marine, cover: C.persenningBlau, under: C.antifouling, accent: C.grau },
      { hull: C.rot, deck: C.hellgrau, cabin: C.weiss, trim: C.dunkelgrau, cover: C.dunkelgrau, under: C.antifouling, accent: C.grau },
      { hull: C.hellgrau, deck: C.grau, cabin: C.weiss, trim: C.gelb, cover: C.dunkelgrau, under: C.antifouling, accent: C.grau },
    ],
  },
  {
    id: 'M3-4', typeId: 'M3', name: 'Weekender', fromStage: 2,
    length: 7.0, beam: 2.5, draft: 0.6, airDraft: 2.4, mooring: 'box',
    form: 'offenes Cockpit unter einem Stoffverdeck, kleine Schlupfkajüte im Bug',
    look: {
      hull: { bowWidth: 0, sternWidth: 0.88, fullness: 1.2, freeboard: 0.75, sheerBow: 0.18, depth: 0.4, bottom: 'v', bowOver: 0.08, sternOver: 0.0, keelPow: 6, keel: 'keiner', rudder: 'keiner' },
      cabins: [{ x0: 0.06, x1: 0.34, hw: 0.36, h: 0.32, inset: 0.05, rakeAft: 0.0, rakeFore: 0.18, taper: 0.5, windows: { kind: 'luken', count: 1, from: 0.35, to: 0.7 } }],
      cockpit: { x0: -0.48, x1: 0.05, hw: 0.41 },
      rig: { kind: 'keins' },
      extras: [{ kind: 'windschutz', x: 0.05 }, { kind: 'verdeck', x0: -0.3, x1: 0.05 }, { kind: 'aussenborder' }, { kind: 'zierstreifen' }, { kind: 'bugkorb' }],
    },
    palettes: [
      { hull: C.weiss, deck: C.hellgrau, cabin: C.weiss, trim: C.blau, cover: C.persenningBlau, under: C.antifouling, accent: C.teak },
      { hull: C.creme, deck: C.hellgrau, cabin: C.creme, trim: C.dunkelgruen, cover: C.persenningGruen, under: C.antifouling, accent: C.teak },
      { hull: C.weiss, deck: C.hellgrau, cabin: C.weiss, trim: C.rot, cover: C.persenningSand, under: C.antifoulingRot, accent: C.teak },
    ],
  },
  {
    id: 'M3-5', typeId: 'M3', name: 'Hausboot auf Pontons', fromStage: 2,
    length: 9.0, beam: 3.2, draft: 0.6, airDraft: 3.6, mooring: 'box',
    form: 'kastenförmiger Aufbau, Dachterrasse, zwei Schwimmer',
    look: {
      hull: { kind: 'pontons', freeboard: 0.55, depth: 0.45 },
      cabins: [{ x0: -0.3, x1: 0.3, hw: 0.44, h: 1.9, inset: 0.0, rakeAft: 0.0, rakeFore: 0.0, taper: 0.0, windows: { kind: 'luken', count: 4, from: 0.35, to: 0.75 }, roof: 'deck', door: true }],
      rig: { kind: 'keins' },
      extras: [{ kind: 'dachterrasse' }, { kind: 'reling', platform: true }, { kind: 'aussenborder' }, { kind: 'pflanzen' }],
    },
    palettes: [
      { hull: C.grau, deck: C.holz, cabin: C.hellblau, trim: C.weiss, cover: C.persenningRot, under: C.grau, accent: C.weiss },
      { hull: C.grau, deck: C.holz, cabin: C.gelb, trim: C.weiss, cover: C.persenningBlau, under: C.grau, accent: C.weiss },
      { hull: C.grau, deck: C.holz, cabin: C.weiss, trim: C.dunkelgruen, cover: C.persenningGruen, under: C.grau, accent: C.holz },
    ],
  },

  // ---------------------------------------------------------------- M4 Fischerboot
  {
    id: 'M4-1', typeId: 'M4', name: 'Offenes Strandboot', fromStage: 2,
    length: 6.4, beam: 2.6, draft: 0.6, airDraft: 1.6, mooring: 'fischer',
    form: 'breit, geklinkert, Netzkisten und Fischkörbe an Deck',
    look: {
      hull: { bowWidth: 0, sternWidth: 0.55, fullness: 0.6, freeboard: 0.75, sheerBow: 0.25, sheerStern: 0.15, depth: 0.4, bottom: 'flach', bowOver: 0.04, sternOver: 0.02, keelPow: 3, keel: 'keiner', rudder: 'angehaengt', build: 'klinker', open: true },
      cabins: [],
      rig: { kind: 'keins' },
      extras: [{ kind: 'duchten', count: 2 }, { kind: 'netzkisten', count: 3 }, { kind: 'fischkoerbe', count: 3 }, { kind: 'aussenborder' }],
    },
    palettes: [
      { hull: C.weiss, deck: C.holz, cabin: C.holz, trim: C.blau, cover: C.persenningSand, under: C.teer, accent: C.holz },
      { hull: C.blau, deck: C.holz, cabin: C.holz, trim: C.weiss, cover: C.persenningSand, under: C.teer, accent: C.holz },
      { hull: C.gruen, deck: C.holz, cabin: C.holz, trim: C.weiss, cover: C.persenningSand, under: C.teer, accent: C.holz },
    ],
  },
  {
    id: 'M4-2', typeId: 'M4', name: 'Reusenboot', fromStage: 2,
    length: 7.4, beam: 2.6, draft: 0.6, airDraft: 2.6, mooring: 'fischer',
    form: 'flach, offene Ladefläche, Stangen und Reusen',
    look: {
      hull: { bowWidth: 0.25, sternWidth: 0.8, fullness: 0.7, freeboard: 0.55, sheerBow: 0.15, depth: 0.35, bottom: 'flach', bowOver: 0.06, sternOver: 0.0, keelPow: 5, keel: 'keiner', rudder: 'keiner', build: 'kantig', open: true },
      cabins: [{ x0: -0.46, x1: -0.3, hw: 0.3, h: 1.0, inset: 0.03, rakeAft: 0.0, rakeFore: 0.04, taper: 0.0, windows: { kind: 'band', from: 0.55, to: 0.85 }, roof: 'trim' }],
      rig: { kind: 'keins' },
      extras: [{ kind: 'stangen', count: 6 }, { kind: 'reusen', count: 3 }, { kind: 'aussenborder' }],
    },
    palettes: [
      { hull: C.grau, deck: C.hellgrau, cabin: C.weiss, trim: C.dunkelgrau, cover: C.persenningSand, under: C.teer, accent: C.holz },
      { hull: C.dunkelgruen, deck: C.hellgrau, cabin: C.weiss, trim: C.dunkelgrau, cover: C.persenningSand, under: C.teer, accent: C.holz },
    ],
  },
  {
    id: 'M4-3', typeId: 'M4', name: 'Stellnetzkutter', fromStage: 3,
    length: 8.5, beam: 3.0, draft: 1.0, airDraft: 4.2, mooring: 'fischer',
    form: 'Steuerhaus achtern, Netzholer am Bug, Fähnchenbojen',
    look: {
      hull: { bowWidth: 0, sternWidth: 0.6, fullness: 0.6, freeboard: 0.95, sheerBow: 0.3, sheerStern: 0.1, depth: 0.6, bottom: 'rund', bowOver: 0.02, sternOver: 0.02, keelPow: 4, keel: 'lang', rudder: 'angehaengt', bulwark: 0.35 },
      cabins: [{ x0: -0.42, x1: -0.16, hw: 0.36, h: 1.4, inset: 0.02, rakeAft: 0.0, rakeFore: 0.03, taper: 0.0, windows: { kind: 'band', from: 0.55, to: 0.85 }, roof: 'trim' }],
      rig: { kind: 'keins' },
      extras: [{ kind: 'mast_klein', x: -0.2, height: 3.0 }, { kind: 'netzholer' }, { kind: 'bojen', count: 3 }, { kind: 'netzkisten', count: 2 }, { kind: 'reifenfender', count: 4 }],
    },
    palettes: [
      { hull: C.blau, deck: C.hellgrau, cabin: C.weiss, trim: C.rot, cover: C.persenningSand, under: C.antifoulingRot, accent: C.gelb },
      { hull: C.dunkelgruen, deck: C.hellgrau, cabin: C.weiss, trim: C.rot, cover: C.persenningSand, under: C.antifoulingRot, accent: C.gelb },
      { hull: C.rot, deck: C.hellgrau, cabin: C.weiss, trim: C.marine, cover: C.persenningSand, under: C.antifouling, accent: C.gelb },
    ],
  },
  {
    id: 'M4-4', typeId: 'M4', name: 'Angelkutter für Gäste', fromStage: 3,
    length: 9.0, beam: 3.2, draft: 1.0, airDraft: 4.0, mooring: 'fischer',
    form: 'Reling rundum, Sitzbänke, viele Angelruten',
    look: {
      hull: { bowWidth: 0, sternWidth: 0.75, fullness: 0.7, freeboard: 0.95, sheerBow: 0.3, sheerStern: 0.05, depth: 0.55, bottom: 'rund', bowOver: 0.03, sternOver: 0.0, keelPow: 4, keel: 'lang', rudder: 'spaten' },
      cabins: [{ x0: 0.0, x1: 0.24, hw: 0.36, h: 1.45, inset: 0.03, rakeAft: 0.0, rakeFore: 0.05, taper: 0.1, windows: { kind: 'band', from: 0.55, to: 0.88 }, roof: 'trim' }],
      rig: { kind: 'keins' },
      extras: [{ kind: 'reling', full: true }, { kind: 'baenke' }, { kind: 'angelruten', count: 10 }, { kind: 'mast_klein', x: 0.1, height: 3.2 }, { kind: 'scheuerleiste' }, { kind: 'reifenfender', count: 3 }],
    },
    palettes: [
      { hull: C.weiss, deck: C.hellgrau, cabin: C.weiss, trim: C.blau, cover: C.persenningBlau, under: C.antifoulingRot, accent: C.gelb },
      { hull: C.gelb, deck: C.hellgrau, cabin: C.weiss, trim: C.marine, cover: C.persenningBlau, under: C.antifouling, accent: C.rot },
    ],
  },
  {
    id: 'M4-5', typeId: 'M4', name: 'Kutter mit Fischverkauf', fromStage: 3,
    length: 8.8, beam: 3.1, draft: 0.9, airDraft: 4.0, mooring: 'fischer',
    form: 'Verkaufstresen an der Reling, Schild, Kühlkisten',
    look: {
      hull: { bowWidth: 0, sternWidth: 0.65, fullness: 0.65, freeboard: 0.95, sheerBow: 0.3, sheerStern: 0.1, depth: 0.55, bottom: 'rund', bowOver: 0.02, sternOver: 0.02, keelPow: 4, keel: 'lang', rudder: 'angehaengt', bulwark: 0.3 },
      cabins: [{ x0: 0.02, x1: 0.24, hw: 0.36, h: 1.4, inset: 0.02, rakeAft: 0.0, rakeFore: 0.03, taper: 0.1, windows: { kind: 'band', from: 0.55, to: 0.85 }, roof: 'trim' }],
      rig: { kind: 'keins' },
      extras: [{ kind: 'tresen' }, { kind: 'schild' }, { kind: 'kuehlkisten', count: 4 }, { kind: 'markise' }, { kind: 'mast_klein', x: 0.12, height: 3.0 }, { kind: 'reifenfender', count: 3 }],
    },
    palettes: [
      { hull: C.blau, deck: C.hellgrau, cabin: C.weiss, trim: C.rot, cover: C.persenningRot, under: C.antifoulingRot, accent: C.gelb },
      { hull: C.dunkelrot, deck: C.hellgrau, cabin: C.weiss, trim: C.weiss, cover: C.persenningBlau, under: C.antifouling, accent: C.gelb },
    ],
  },
];

/** Modell per Kennung, zum Beispiel getModel('M2-5'). */
export function getModel(id) {
  return MODELS.find((m) => m.id === id) ?? null;
}
