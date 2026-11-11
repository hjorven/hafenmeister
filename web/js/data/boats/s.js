// Schiffe der Größe S (bis 6 m): 5 Arten mit je 5 Modellen.
// Quelle: docs/hafen-und-schiffe.md, Abschnitt 4. Alle Maße in Metern, Richtwerte fürs Spiel.
//
// Konvention für alle Bootsgrößen (abgestimmt mit M, L, XL):
//   1 Einheit = 1 m, Y nach oben, Bug zeigt nach +X, Ursprung = Wasserlinie mittschiffs.
//   Positionen in `parts` sind Bruchteile der Länge: x = -0.5 (Heck) bis +0.5 (Bug).
//   Farben sind Namen aus der Palette in web/js/render/boats/s.js.
//
// Diese Datei kennt kein Three.js, damit sim.js und Balancing-Skripte sie laden können.

export const SIZE = 'S';

// Hafengeld: Grundpreis S (10 € pro Nacht, docs/plan.md) mal feeFactor.
export const TYPES = [
  {
    id: 'S1', crew: [1, 3], name: 'Ruderboot', fromStage: 1,
    length: [3, 4.5], beam: [1.2, 1.5], draft: [0.2, 0.2],
    propulsion: 'riemen', feeFactor: 0.8, nights: [1, 2], group: [1, 1],
    wishes: ['wc', 'essen'], arrivalWeight: 3,
    // Kommt in Stufe 1 auch durch den flachen Graben von der Ostsee.
    canUseDitch: true,
  },
  {
    id: 'S2', crew: [1, 3], name: 'Paddel- und Tretboot', fromStage: 1,
    length: [2.5, 5.2], beam: [0.6, 1.8], draft: [0.1, 0.1],
    propulsion: 'paddel', feeFactor: 0.5, nights: [1, 1], group: [1, 3],
    wishes: ['wc', 'essen'], arrivalWeight: 3,
    note: 'zahlen wenig und bleiben meist nur eine Nacht, kommen aber oft zu mehreren',
  },
  {
    id: 'S3', crew: [1, 3], name: 'Beiboot und Schlauchboot', fromStage: 1,
    length: [2.3, 5], beam: [1.3, 2.0], draft: [0.2, 0.4],
    propulsion: 'gemischt', feeFactor: 0.8, nights: [1, 2], group: [1, 1],
    wishes: ['wc', 'dusche', 'essen'], arrivalWeight: 2,
  },
  {
    id: 'S4', crew: [1, 2], name: 'Segeljolle', fromStage: 2,
    length: [2.3, 5.5], beam: [1.1, 2.0], draft: [0.1, 0.3],
    propulsion: 'segel', feeFactor: 1.0, nights: [1, 3], group: [1, 2],
    wishes: ['wc', 'dusche', 'essen'], arrivalWeight: 3,
    note: 'Tiefgang mit aufgeholtem Schwert',
  },
  {
    id: 'S5', crew: [1, 3], name: 'Offenes Motorboot', fromStage: 2,
    length: [4, 6], beam: [1.7, 2.4], draft: [0.3, 0.5],
    propulsion: 'motor', feeFactor: 1.2, nights: [1, 3], group: [1, 1],
    wishes: ['wc', 'dusche', 'essen', 'diesel'], arrivalWeight: 2,
  },
];

// crew: [min, max] Menschen an Bord, je Art; einzelne Modelle können es überschreiben (crewOf).

// Häufige Farbsätze. Schlüssel: hull (Rumpf außen), trim (Zierstreifen, Scheuerleiste),
// deck (Deck, Duchten), inside (Innenraum, Boden), accent (Anbauten), canvas (Stoff, Polster).
const P = (hull, trim, deck, inside, accent, canvas) => ({ hull, trim, deck, inside, accent, canvas });

export const MODELS = [
  // ---------------------------------------------------------------- S1 Ruderboot
  {
    id: 'S1-1', typeId: 'S1', name: 'Holzruderboot', fromStage: 1, priority: 1,
    length: 4.0, beam: 1.4, draft: 0.2, airDraft: 0.6, mooring: 'box',
    shape: 'geklinkert mit sichtbaren Plankengängen, Spiegelheck, zwei Duchten, Riemen liegen im Boot',
    parts: {
      hull: { bow: 'pointed', stern: 'transom', build: 'clinker', bottom: 'round', freeboard: 0.42, sheerBow: 0.14, sheerStern: 0.06, depth: 0.2 },
      deck: { type: 'open', floor: 0.08 },
      rig: null,
      extras: [
        { part: 'thwart', x: 0.12 }, { part: 'thwart', x: -0.18 },
        { part: 'sternSeat', x: -0.4 },
        { part: 'oars', mode: 'inboard' },
        { part: 'rowlocks', x: -0.02 },
      ],
    },
    palettes: [
      P('wood', 'woodDark', 'woodLight', 'woodLight', 'woodDark', 'sand'),
      P('white', 'green', 'woodLight', 'sand', 'woodDark', 'sand'),
      P('blue', 'white', 'woodLight', 'sand', 'woodDark', 'sand'),
    ],
  },
  {
    id: 'S1-2', typeId: 'S1', name: 'Kunststoff-Ruderboot', fromStage: 1, priority: 1,
    length: 3.6, beam: 1.5, draft: 0.2, airDraft: 0.6, mooring: 'box',
    shape: 'glatter breiter Rumpf, runder Bug, drei Sitzbänke',
    parts: {
      hull: { bow: 'round', stern: 'transom', build: 'smooth', bottom: 'round', freeboard: 0.4, sheerBow: 0.08, sheerStern: 0.03, depth: 0.2 },
      deck: { type: 'open', floor: 0.08 },
      rig: null,
      extras: [
        { part: 'bench', x: 0.25 }, { part: 'bench', x: 0.0 }, { part: 'bench', x: -0.33 },
        { part: 'oars', mode: 'rowing' },
        { part: 'rowlocks', x: 0.0 },
        { part: 'rubStrake' },
      ],
    },
    palettes: [
      P('white', 'red', 'white', 'sand', 'woodDark', 'sand'),
      P('green', 'white', 'white', 'sand', 'woodDark', 'sand'),
      P('yellow', 'navy', 'white', 'sand', 'woodDark', 'sand'),
    ],
  },
  {
    id: 'S1-3', typeId: 'S1', name: 'Angelkahn aus Alu', fromStage: 1, priority: 2,
    length: 4.2, beam: 1.45, draft: 0.2, airDraft: 1.4, mooring: 'box',
    shape: 'kantiger Kastenrumpf, flacher Boden, Rutenhalter und Kescher',
    parts: {
      hull: { bow: 'blunt', stern: 'transom', build: 'chine', bottom: 'flat', freeboard: 0.38, sheerBow: 0.06, sheerStern: 0, depth: 0.15 },
      deck: { type: 'open', floor: 0.06 },
      rig: null,
      extras: [
        { part: 'bench', x: 0.2 }, { part: 'bench', x: -0.1 }, { part: 'bench', x: -0.38 },
        { part: 'rodHolders', x: -0.25, count: 3 },
        { part: 'landingNet', x: 0.05 },
        { part: 'outboard', size: 0.5 },
        { part: 'box', x: 0.0, z: 0.3, size: [0.35, 0.22, 0.25], color: 'accent' },
      ],
    },
    palettes: [
      P('alu', 'aluDark', 'aluDark', 'alu', 'green', 'sand'),
      P('alu', 'green', 'aluDark', 'alu', 'red', 'sand'),
      P('olive', 'aluDark', 'aluDark', 'alu', 'navy', 'sand'),
    ],
  },
  {
    id: 'S1-4', typeId: 'S1', name: 'Flachkahn', fromStage: 1, priority: 2,
    length: 4.5, beam: 1.3, draft: 0.2, airDraft: 0.5, mooring: 'box',
    shape: 'von oben fast rechteckig, beide Enden stumpf, wird gestakt',
    parts: {
      hull: { bow: 'box', stern: 'box', build: 'chine', bottom: 'flat', freeboard: 0.32, sheerBow: 0.12, sheerStern: 0.12, depth: 0.12 },
      deck: { type: 'open', floor: 0.06 },
      rig: null,
      extras: [
        { part: 'thwart', x: 0.3 }, { part: 'thwart', x: -0.3 },
        { part: 'punt', mode: 'inboard' },
      ],
    },
    palettes: [
      P('greenDark', 'woodDark', 'woodLight', 'woodLight', 'woodDark', 'sand'),
      P('woodDark', 'woodDark', 'woodLight', 'woodLight', 'woodDark', 'sand'),
      P('navy', 'woodDark', 'woodLight', 'woodLight', 'woodDark', 'sand'),
    ],
  },
  {
    id: 'S1-5', typeId: 'S1', name: 'Leihboot mit Sonnendach', fromStage: 1, priority: 3,
    length: 3.8, beam: 1.5, draft: 0.2, airDraft: 1.7, mooring: 'box',
    shape: 'Stoffdach auf vier Stützen, Nummer am Bug',
    parts: {
      hull: { bow: 'round', stern: 'transom', build: 'smooth', bottom: 'round', freeboard: 0.42, sheerBow: 0.08, sheerStern: 0.03, depth: 0.2 },
      deck: { type: 'open', floor: 0.08 },
      rig: null,
      extras: [
        { part: 'bench', x: 0.22 }, { part: 'bench', x: -0.05 }, { part: 'bench', x: -0.33 },
        { part: 'oars', mode: 'rowing' },
        { part: 'rowlocks', x: -0.05 },
        { part: 'canopy', from: -0.4, to: 0.3, height: 1.25, stripes: 7 },
        { part: 'bowNumber' },
        { part: 'rubStrake' },
      ],
    },
    palettes: [
      P('white', 'blue', 'white', 'sand', 'woodDark', 'blue'),
      P('white', 'red', 'white', 'sand', 'woodDark', 'red'),
      P('yellow', 'green', 'white', 'sand', 'woodDark', 'green'),
    ],
  },

  // ---------------------------------------------------------------- S2 Paddel- und Tretboot
  {
    id: 'S2-1', typeId: 'S2', name: 'Kanadier', fromStage: 1, priority: 1, crew: [1, 2],
    length: 4.8, beam: 0.9, draft: 0.1, airDraft: 0.6, mooring: 'box',
    shape: 'offen, beide Enden spitz und hochgezogen, zwei Sitze',
    parts: {
      hull: { bow: 'pointed', stern: 'pointed', build: 'smooth', bottom: 'round', freeboard: 0.34, sheerBow: 0.2, sheerStern: 0.2, depth: 0.12 },
      deck: { type: 'open', floor: 0.05 },
      rig: null,
      extras: [
        { part: 'canoeSeat', x: 0.3 }, { part: 'canoeSeat', x: -0.34 },
        { part: 'thwart', x: 0.0, thin: true },
        { part: 'paddle', x: 0.3, side: 1, blades: 1 },
        { part: 'paddle', x: -0.34, side: -1, blades: 1 },
      ],
    },
    palettes: [
      P('red', 'woodDark', 'woodLight', 'sand', 'woodDark', 'sand'),
      P('green', 'woodDark', 'woodLight', 'sand', 'woodDark', 'sand'),
      P('woodLight', 'woodDark', 'woodLight', 'woodLight', 'woodDark', 'sand'),
    ],
  },
  {
    id: 'S2-2', typeId: 'S2', name: 'Seekajak', fromStage: 1, priority: 2, crew: [1, 1],
    length: 5.2, beam: 0.6, draft: 0.1, airDraft: 0.5, mooring: 'box',
    shape: 'sehr lang und schmal, geschlossenes Deck mit einer Luke',
    parts: {
      hull: { bow: 'pointed', stern: 'pointed', build: 'smooth', bottom: 'v', freeboard: 0.22, sheerBow: 0.08, sheerStern: 0.04, depth: 0.1, crown: 0.06 },
      deck: { type: 'closed' },
      rig: null,
      extras: [
        { part: 'hatch', x: -0.05, length: 0.8, width: 0.42 },
        { part: 'hatch', x: 0.3, length: 0.28, width: 0.24, flat: true },
        { part: 'hatch', x: -0.33, length: 0.32, width: 0.26, flat: true },
        { part: 'deckLines', from: 0.12, to: 0.42 },
        { part: 'paddle', x: 0.1, side: 0, blades: 2 },
      ],
    },
    palettes: [
      P('yellow', 'navy', 'yellow', 'navy', 'navy', 'navy'),
      P('orange', 'navy', 'white', 'navy', 'navy', 'navy'),
      P('red', 'navy', 'white', 'navy', 'navy', 'navy'),
    ],
  },
  {
    id: 'S2-3', typeId: 'S2', name: 'Zweierkajak', fromStage: 1, priority: 3, crew: [2, 2],
    length: 5.0, beam: 0.75, draft: 0.1, airDraft: 0.5, mooring: 'box',
    shape: 'zwei Sitzluken hintereinander, Steuerblatt am Heck',
    parts: {
      hull: { bow: 'pointed', stern: 'pointed', build: 'smooth', bottom: 'v', freeboard: 0.24, sheerBow: 0.06, sheerStern: 0.03, depth: 0.1, crown: 0.06 },
      deck: { type: 'closed' },
      rig: null,
      extras: [
        { part: 'hatch', x: 0.12, length: 0.7, width: 0.42 },
        { part: 'hatch', x: -0.17, length: 0.7, width: 0.42 },
        { part: 'kayakRudder' },
        { part: 'paddle', x: 0.12, side: 0, blades: 2 },
        { part: 'paddle', x: -0.17, side: 0, blades: 2 },
      ],
    },
    palettes: [
      P('green', 'navy', 'white', 'navy', 'navy', 'navy'),
      P('blue', 'navy', 'white', 'navy', 'navy', 'navy'),
      P('orange', 'navy', 'orange', 'navy', 'navy', 'navy'),
    ],
  },
  {
    id: 'S2-4', typeId: 'S2', name: 'Tretboot', fromStage: 1, priority: 1,
    length: 2.6, beam: 1.6, draft: 0.1, airDraft: 1.0, mooring: 'box',
    shape: 'zwei Schwimmer, Sitzbank dazwischen, Schaufelrad hinten',
    parts: {
      hull: { form: 'twin', floatBeam: 0.42, bow: 'round', stern: 'transom', build: 'smooth', bottom: 'round', freeboard: 0.28, sheerBow: 0.1, sheerStern: 0.02, depth: 0.12 },
      deck: { type: 'closed' },
      rig: null,
      extras: [
        { part: 'pedalDeck', from: -0.35, to: 0.32 },
        { part: 'pedalSeats', x: -0.1, seats: 2 },
        { part: 'paddleWheel', x: -0.38, radius: 0.32 },
        { part: 'pedalRudder' },
      ],
    },
    palettes: [
      P('white', 'blue', 'blue', 'white', 'blue', 'blue'),
      P('yellow', 'blue', 'white', 'white', 'blue', 'blue'),
      P('white', 'red', 'red', 'white', 'red', 'red'),
    ],
  },
  {
    id: 'S2-5', typeId: 'S2', name: 'Tretboot mit Rutsche', fromStage: 1, priority: 2,
    length: 3.2, beam: 1.8, draft: 0.1, airDraft: 1.6, mooring: 'box',
    shape: 'breiter, vier Sitze, Rutsche am Heck',
    parts: {
      hull: { form: 'twin', floatBeam: 0.5, bow: 'round', stern: 'transom', build: 'smooth', bottom: 'round', freeboard: 0.3, sheerBow: 0.1, sheerStern: 0.02, depth: 0.12 },
      deck: { type: 'closed' },
      rig: null,
      extras: [
        { part: 'pedalDeck', from: -0.44, to: 0.34 },
        { part: 'pedalSeats', x: 0.14, seats: 2 },
        { part: 'pedalSeats', x: -0.12, seats: 2 },
        { part: 'slide', x: -0.36 },
        { part: 'paddleWheel', x: -0.06, radius: 0.26, hidden: true },
      ],
    },
    palettes: [
      P('white', 'yellow', 'blue', 'white', 'yellow', 'blue'),
      P('white', 'red', 'green', 'white', 'red', 'green'),
      P('blue', 'yellow', 'white', 'white', 'yellow', 'white'),
    ],
  },

  // ---------------------------------------------------------------- S3 Beiboot und Schlauchboot
  {
    id: 'S3-1', typeId: 'S3', name: 'Schlauchboot mit Paddeln', fromStage: 1, priority: 1,
    length: 2.4, beam: 1.3, draft: 0.2, airDraft: 0.5, mooring: 'box',
    shape: 'zwei Wülste, weicher Boden, sehr klein',
    parts: {
      hull: { form: 'inflatable', tube: 0.17, bow: 'round', stern: 'transom', build: 'smooth', bottom: 'flat', freeboard: 0.12, sheerBow: 0.05, sheerStern: 0, depth: 0.06, tubeTail: 0.15 },
      deck: { type: 'open', floor: 0.06 },
      rig: null,
      extras: [
        { part: 'tubeSeat', x: 0.0 },
        { part: 'paddle', x: 0.05, side: 1, blades: 1, inboard: true },
        { part: 'paddle', x: -0.1, side: -1, blades: 1, inboard: true },
        { part: 'grabLine' },
      ],
    },
    palettes: [
      P('tubeGrey', 'navy', 'tubeGrey', 'navy', 'navy', 'sand'),
      P('orange', 'navy', 'orange', 'navy', 'navy', 'sand'),
      P('yellow', 'navy', 'yellow', 'navy', 'navy', 'sand'),
    ],
  },
  {
    id: 'S3-2', typeId: 'S3', name: 'Schlauchboot mit Außenborder', fromStage: 1, priority: 2,
    length: 3.2, beam: 1.5, draft: 0.25, airDraft: 0.9, mooring: 'box',
    shape: 'Holzspiegel am Heck, Motor, Tank im Boot',
    parts: {
      hull: { form: 'inflatable', tube: 0.2, bow: 'round', stern: 'transom', build: 'smooth', bottom: 'flat', freeboard: 0.14, sheerBow: 0.06, sheerStern: 0, depth: 0.08, tubeTail: 0.2 },
      deck: { type: 'open', floor: 0.06 },
      rig: null,
      extras: [
        { part: 'woodTransom' },
        { part: 'tubeSeat', x: 0.05 },
        { part: 'outboard', size: 0.6 },
        { part: 'fuelTank', x: -0.3, z: 0.2 },
        { part: 'grabLine' },
      ],
    },
    palettes: [
      P('tubeGrey', 'navy', 'tubeGrey', 'navy', 'navy', 'sand'),
      P('red', 'navy', 'red', 'navy', 'navy', 'sand'),
      P('navy', 'tubeGrey', 'navy', 'tubeGrey', 'white', 'sand'),
    ],
  },
  {
    id: 'S3-3', typeId: 'S3', name: 'Festrumpf-Schlauchboot', fromStage: 1, priority: 1,
    length: 4.8, beam: 2.0, draft: 0.4, airDraft: 1.9, mooring: 'box',
    shape: 'fester V-Rumpf mit Wülsten, Steuerstand, Geräteträger',
    parts: {
      hull: { form: 'rib', tube: 0.24, bow: 'pointed', stern: 'transom', build: 'smooth', bottom: 'v', freeboard: 0.2, sheerBow: 0.1, sheerStern: 0, depth: 0.32, tubeTail: 0.2 },
      deck: { type: 'open', floor: 0.12 },
      rig: null,
      extras: [
        { part: 'console', x: 0.0, width: 0.6, height: 0.85, screen: true },
        { part: 'jockeySeat', x: -0.18 },
        { part: 'aFrame', x: -0.4, height: 1.8 },
        { part: 'outboard', size: 1.0 },
        { part: 'bowLocker', x: 0.32 },
      ],
    },
    palettes: [
      P('white', 'orange', 'tubeGrey', 'tubeGrey', 'navy', 'orange'),
      P('navy', 'tubeGrey', 'tubeGrey', 'tubeGrey', 'white', 'tubeGrey'),
      P('white', 'tubeGrey', 'tubeGrey', 'tubeGrey', 'navy', 'red'),
    ],
  },
  {
    id: 'S3-4', typeId: 'S3', name: 'Festes Beiboot', fromStage: 1, priority: 2,
    length: 2.6, beam: 1.35, draft: 0.2, airDraft: 0.6, mooring: 'box',
    shape: 'kurzer Kunststoffrumpf, stumpfer Bug, eine Ducht',
    parts: {
      hull: { bow: 'pram', stern: 'transom', build: 'smooth', bottom: 'round', freeboard: 0.38, sheerBow: 0.06, sheerStern: 0.02, depth: 0.15 },
      deck: { type: 'open', floor: 0.08 },
      rig: null,
      extras: [
        { part: 'thwart', x: 0.0 },
        { part: 'sternSeat', x: -0.38 },
        { part: 'oars', mode: 'inboard', short: true },
        { part: 'rowlocks', x: 0.0 },
        { part: 'rubStrake', color: 'tubeGrey' },
      ],
    },
    palettes: [
      P('white', 'navy', 'woodLight', 'white', 'woodDark', 'sand'),
      P('blue', 'white', 'woodLight', 'white', 'woodDark', 'sand'),
      P('red', 'white', 'woodLight', 'white', 'woodDark', 'sand'),
    ],
  },
  {
    id: 'S3-5', typeId: 'S3', name: 'Faltbares Beiboot', fromStage: 1, priority: 3,
    length: 2.8, beam: 1.3, draft: 0.2, airDraft: 0.5, mooring: 'box',
    shape: 'flache kantige Seitenwände, sehr schmal',
    parts: {
      hull: { bow: 'pointed', stern: 'transom', build: 'chine', bottom: 'flat', freeboard: 0.3, sheerBow: 0.08, sheerStern: 0, depth: 0.08, narrow: 0.82, plain: true },
      deck: { type: 'open', floor: 0.05 },
      rig: null,
      extras: [
        { part: 'thwart', x: 0.05, thin: true },
        { part: 'hinges' },
        { part: 'oars', mode: 'inboard', short: true },
      ],
    },
    palettes: [
      P('tubeGrey', 'navy', 'tubeGrey', 'sand', 'navy', 'sand'),
      P('white', 'blue', 'white', 'sand', 'blue', 'sand'),
      P('green', 'navy', 'green', 'sand', 'navy', 'sand'),
    ],
  },

  // ---------------------------------------------------------------- S4 Segeljolle
  {
    id: 'S4-1', typeId: 'S4', name: 'Kinderjolle', fromStage: 2, priority: 1, crew: [1, 1],
    length: 2.3, beam: 1.13, draft: 0.1, airDraft: 2.6, mooring: 'box',
    shape: 'stumpfer Prahmbug, sehr kurz und breit, ein Sprietsegel',
    parts: {
      hull: { bow: 'pram', stern: 'transom', build: 'chine', bottom: 'flat', freeboard: 0.34, sheerBow: 0.05, sheerStern: 0, depth: 0.1 },
      deck: { type: 'open', floor: 0.06 },
      rig: { type: 'sprit', mast: 0.28, height: 2.3, boom: 0.82 },
      extras: [
        { part: 'thwart', x: 0.28 },
        { part: 'buoyancyBags' },
        { part: 'tillerRudder' },
        { part: 'centerboardCase', x: 0.05 },
      ],
    },
    palettes: [
      P('white', 'blue', 'white', 'white', 'woodDark', 'sail'),
      P('white', 'red', 'white', 'white', 'woodDark', 'sail'),
      P('yellow', 'navy', 'white', 'white', 'woodDark', 'sail'),
    ],
  },
  {
    id: 'S4-2', typeId: 'S4', name: 'Einhandjolle', fromStage: 2, priority: 1, crew: [1, 1],
    length: 4.2, beam: 1.4, draft: 0.2, airDraft: 6.3, mooring: 'box',
    shape: 'flacher schmaler Rumpf, ein Mast ganz vorn ohne Wanten, kein Vorsegel',
    parts: {
      hull: { bow: 'pointed', stern: 'transom', build: 'smooth', bottom: 'flat', freeboard: 0.28, sheerBow: 0.05, sheerStern: 0, depth: 0.1, crown: 0.03 },
      deck: { type: 'partial', from: -0.45, to: -0.05, width: 0.5, floor: 0.14 },
      rig: { type: 'cat', mast: 0.26, height: 6.0, boom: 0.66 },
      extras: [
        { part: 'tillerRudder' },
        { part: 'mainsheet', x: -0.35 },
      ],
    },
    palettes: [
      P('white', 'navy', 'white', 'white', 'navy', 'sail'),
      P('white', 'red', 'white', 'white', 'navy', 'sail'),
      P('blue', 'white', 'white', 'white', 'navy', 'sail'),
    ],
  },
  {
    id: 'S4-3', typeId: 'S4', name: 'Zweimannjolle', fromStage: 2, priority: 2,
    length: 4.7, beam: 1.7, draft: 0.2, airDraft: 6.6, mooring: 'box',
    shape: 'Fock und Großsegel, Trapezdrähte, Spinnakerbaum an Deck, offenes Heck',
    parts: {
      hull: { bow: 'pointed', stern: 'transom', build: 'smooth', bottom: 'flat', freeboard: 0.32, sheerBow: 0.06, sheerStern: 0, depth: 0.1, crown: 0.03 },
      deck: { type: 'partial', from: -0.5, to: 0.1, width: 0.72, floor: 0.12, openStern: true },
      rig: { type: 'sloop', mast: 0.12, height: 6.3, boom: 0.5, jib: true, trapeze: true },
      extras: [
        { part: 'spinnakerPole', x: 0.2 },
        { part: 'tillerRudder' },
        { part: 'hikingStraps' },
        { part: 'centerboardCase', x: 0.0 },
      ],
    },
    palettes: [
      P('white', 'blue', 'white', 'white', 'navy', 'sail'),
      P('red', 'white', 'white', 'white', 'navy', 'sail'),
      P('navy', 'white', 'white', 'white', 'red', 'sail'),
    ],
  },
  {
    id: 'S4-4', typeId: 'S4', name: 'Wanderjolle', fromStage: 2, priority: 2,
    length: 5.5, beam: 2.0, draft: 0.3, airDraft: 7.2, mooring: 'box',
    shape: 'breit und hochbordig, Persenning als Zelt über dem Baum, Außenborder am Heck',
    parts: {
      hull: { bow: 'pointed', stern: 'transom', build: 'smooth', bottom: 'round', freeboard: 0.55, sheerBow: 0.1, sheerStern: 0.02, depth: 0.15 },
      deck: { type: 'partial', from: -0.44, to: 0.12, width: 0.72, floor: 0.22 },
      rig: { type: 'sloop', mast: 0.18, height: 6.8, boom: 0.56, jib: true },
      extras: [
        { part: 'tent', from: -0.42, to: 0.14, onlyWhen: 'down' },
        { part: 'outboard', size: 0.55, bracket: true },
        { part: 'tillerRudder' },
        { part: 'rubStrake' },
        { part: 'centerboardCase', x: -0.02 },
      ],
    },
    palettes: [
      P('white', 'blue', 'woodLight', 'white', 'navy', 'tentGreen'),
      P('cream', 'red', 'woodLight', 'white', 'navy', 'navy'),
      P('blue', 'white', 'woodLight', 'white', 'navy', 'sand'),
    ],
  },
  {
    id: 'S4-5', typeId: 'S4', name: 'Holzjolle', fromStage: 2, priority: 3,
    length: 4.5, beam: 1.6, draft: 0.25, airDraft: 5.2, mooring: 'box',
    shape: 'geklinkerter Rumpf, Gaffelsegel, lackiertes Deck, kurzer Bugspriet',
    parts: {
      hull: { bow: 'pointed', stern: 'transom', build: 'clinker', bottom: 'round', freeboard: 0.4, sheerBow: 0.12, sheerStern: 0.04, depth: 0.15 },
      deck: { type: 'partial', from: -0.42, to: 0.1, width: 0.7, floor: 0.12 },
      rig: { type: 'gaff', mast: 0.2, height: 4.6, boom: 0.6, bowsprit: 0.6, jib: true },
      extras: [
        { part: 'deckPlanks', from: 0.1, to: 0.5 },
        { part: 'tillerRudder' },
        { part: 'thwart', x: -0.1 },
        { part: 'centerboardCase', x: -0.05 },
      ],
    },
    palettes: [
      P('wood', 'woodDark', 'mahogany', 'woodLight', 'woodDark', 'sailTan'),
      P('white', 'woodDark', 'mahogany', 'woodLight', 'woodDark', 'sailTan'),
      P('greenDark', 'woodLight', 'mahogany', 'woodLight', 'woodDark', 'sail'),
    ],
  },

  // ---------------------------------------------------------------- S5 Offenes Motorboot
  {
    id: 'S5-1', typeId: 'S5', name: 'Konsolenboot', fromStage: 2, priority: 1,
    length: 5.2, beam: 2.1, draft: 0.35, airDraft: 1.6, mooring: 'box',
    shape: 'Steuerstand in der Mitte, rundum begehbar',
    parts: {
      hull: { bow: 'pointed', stern: 'transom', build: 'smooth', bottom: 'v', freeboard: 0.6, sheerBow: 0.12, sheerStern: 0, depth: 0.3 },
      deck: { type: 'open', floor: 0.2, wall: 0.1 },
      rig: null,
      extras: [
        { part: 'console', x: -0.02, width: 0.7, height: 0.9, screen: true },
        { part: 'leaningPost', x: -0.2 },
        { part: 'bowRail' },
        { part: 'outboard', size: 1.0 },
        { part: 'cleats' },
      ],
    },
    palettes: [
      P('white', 'blue', 'white', 'sand', 'navy', 'navy'),
      P('sky', 'white', 'white', 'sand', 'navy', 'white'),
      P('white', 'red', 'white', 'sand', 'navy', 'red'),
    ],
  },
  {
    id: 'S5-2', typeId: 'S5', name: 'Bowrider', fromStage: 2, priority: 1,
    length: 5.6, beam: 2.3, draft: 0.4, airDraft: 1.5, mooring: 'box',
    shape: 'Sitze im offenen Bug, Windschutzscheibe mit Durchgang',
    parts: {
      hull: { bow: 'pointed', stern: 'transom', build: 'smooth', bottom: 'v', freeboard: 0.62, sheerBow: 0.1, sheerStern: 0, depth: 0.32, stripe: true },
      deck: { type: 'open', floor: 0.22, wall: 0.12 },
      rig: null,
      extras: [
        { part: 'bowSeats', from: 0.18 },
        { part: 'windshield', x: 0.08, walkthrough: true, height: 0.38 },
        { part: 'dashConsoles', x: 0.02 },
        { part: 'seats', x: -0.08, count: 2 },
        { part: 'sternBench', x: -0.38 },
        { part: 'outboard', size: 1.1 },
        { part: 'cleats' },
      ],
    },
    palettes: [
      P('white', 'red', 'white', 'cream', 'navy', 'cream'),
      P('white', 'navy', 'white', 'cream', 'navy', 'cream'),
      P('navy', 'white', 'white', 'cream', 'white', 'cream'),
    ],
  },
  {
    id: 'S5-3', typeId: 'S5', name: 'Runabout aus Mahagoni', fromStage: 2, priority: 2,
    length: 5.8, beam: 1.9, draft: 0.35, airDraft: 1.1, mooring: 'box',
    shape: 'langes lackiertes Vordeck, zwei Cockpits, Chrombeschläge',
    parts: {
      hull: { bow: 'pointed', stern: 'round', build: 'smooth', bottom: 'v', freeboard: 0.55, sheerBow: 0.06, sheerStern: 0, depth: 0.25, crown: 0.05 },
      deck: { type: 'closed' },
      rig: null,
      extras: [
        { part: 'deckPlanks', from: -0.5, to: 0.5, dense: true },
        { part: 'cockpit', x: 0.0, length: 0.15, seats: 1 },
        { part: 'cockpit', x: -0.22, length: 0.15, seats: 1 },
        { part: 'windshield', x: 0.1, height: 0.22, chrome: true },
        { part: 'chromeFittings' },
        { part: 'flagStaff' },
        { part: 'inboardProp' },
      ],
    },
    palettes: [
      P('mahogany', 'chrome', 'mahogany', 'cream', 'chrome', 'cream'),
      P('mahogany', 'chrome', 'mahogany', 'red', 'chrome', 'red'),
      P('white', 'chrome', 'mahogany', 'blue', 'chrome', 'blue'),
    ],
  },
  {
    id: 'S5-4', typeId: 'S5', name: 'Tuckerboot', fromStage: 2, priority: 2,
    length: 4.5, beam: 1.8, draft: 0.5, airDraft: 1.8, mooring: 'box',
    shape: 'kleiner Verdränger, rundes Heck, Sonnendach auf Stützen',
    parts: {
      hull: { bow: 'pointed', stern: 'round', build: 'smooth', bottom: 'round', freeboard: 0.55, sheerBow: 0.1, sheerStern: 0.04, depth: 0.35 },
      deck: { type: 'open', floor: 0.18 },
      rig: null,
      extras: [
        { part: 'benches', from: -0.38, to: 0.15 },
        { part: 'engineBox', x: -0.05 },
        { part: 'canopy', from: -0.36, to: 0.18, height: 1.15, flat: true },
        { part: 'tillerRudder', motor: true },
        { part: 'inboardProp' },
        { part: 'rubStrake' },
      ],
    },
    palettes: [
      P('cream', 'woodDark', 'woodLight', 'woodLight', 'woodDark', 'navy'),
      P('green', 'cream', 'woodLight', 'woodLight', 'woodDark', 'cream'),
      P('blue', 'cream', 'woodLight', 'woodLight', 'woodDark', 'cream'),
    ],
  },
  {
    id: 'S5-5', typeId: 'S5', name: 'Angelboot mit Steuerhaus', fromStage: 2, priority: 3,
    length: 5.5, beam: 2.2, draft: 0.45, airDraft: 2.2, mooring: 'box',
    shape: 'kleines Steuerhaus vorn, offenes Arbeitsdeck achtern',
    parts: {
      hull: { bow: 'pointed', stern: 'transom', build: 'smooth', bottom: 'v', freeboard: 0.65, sheerBow: 0.16, sheerStern: 0, depth: 0.32 },
      deck: { type: 'partial', from: -0.46, to: 0.32, width: 0.8, floor: 0.22 },
      rig: null,
      extras: [
        { part: 'wheelhouse', x: 0.12, length: 0.24, height: 1.1 },
        { part: 'rodHolders', x: -0.38, count: 4 },
        { part: 'outboard', size: 0.9 },
        { part: 'bowRail' },
        { part: 'box', x: -0.25, z: 0, size: [0.5, 0.3, 0.4], color: 'white' },
      ],
    },
    palettes: [
      P('white', 'navy', 'white', 'sand', 'navy', 'navy'),
      P('red', 'white', 'white', 'sand', 'navy', 'white'),
      P('white', 'green', 'white', 'sand', 'green', 'green'),
    ],
  },
];

// ---------------------------------------------------------------- Hilfen ohne Three.js

const byId = new Map(MODELS.map((m) => [m.id, m]));

export function getModel(id) {
  return byId.get(id) ?? null;
}

export function getType(id) {
  return TYPES.find((t) => t.id === id) ?? null;
}

// Menschen an Bord (docs/plan.md, Abschnitt 11a): Modellwert, sonst Wert der Art
export function crewOf(model) {
  return model.crew ?? getType(model.typeId)?.crew ?? [1, 3];
}

export function modelsOfType(typeId) {
  return MODELS.filter((m) => m.typeId === typeId);
}

// Modelle, die in einer Ausbaustufe einlaufen können. `maxPriority` begrenzt auf die
// zuerst gebauten Modelle (1 = je Art zwei Modelle laut Bauplan, 3 = alle).
export function modelsForStage(stage, maxPriority = 3) {
  return MODELS.filter((m) => m.fromStage <= stage && m.priority <= maxPriority);
}

// Passregel aus docs/hafen-und-schiffe.md: nicht länger, nicht breiter, und
// Wassertiefe mindestens 0,3 m größer als der Tiefgang.
export function fitsBerth(model, berth) {
  return model.length <= berth.length && model.beam <= berth.beam && berth.depth >= model.draft + 0.3;
}
