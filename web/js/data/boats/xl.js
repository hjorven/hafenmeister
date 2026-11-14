// Schiffe der Größe XL: Daten ohne Grafik.
//
// Konvention für alle Bootsgrößen (abgestimmt mit S, M und L):
//   1 Einheit = 1 m, Y nach oben, Bug zeigt nach +X,
//   Ursprung = Wasserlinie mittschiffs.
//   length = Länge über alles inklusive Bugspriet, beam = größte Breite des Rumpfs
//   (inklusive Radkästen und Seitenschwertern; Rahen von Brigg und Kogge ragen wie
//   bei echten Rahseglern seitlich darüber hinaus), draft = Tiefgang,
//   airDraft = höchster Punkt über der Wasserlinie (Mast, Radar).
//   crew = [min, max] Menschen an Bord, die an Land gehen (docs/plan.md, Abschnitt 11a).
//
// Quelle der Arten: docs/hafen-und-schiffe.md, Abschnitt 4, Größe XL.
// Abweichung: XL3-5 ist ein Hafenschlepper statt des Seenotrettungskreuzers.
// Die Seenotrettungskreuzer gehören laut docs/plan.md jetzt zur Größe XXL
// (web/js/data/boats/xxl.js). Der Schlepper hilft dort den Großschiffen beim Anlegen.
//
// Abweichung: Das Plattbodenschiff (XL1-5) hat 1,2 m Tiefgang statt der im
// Dokument genannten mindestens 2,2 m, weil echte Plattbodenschiffe mit
// aufgeholtem Seitenschwert nur gut 1 m Tiefgang haben. Der Bereich von XL1
// beginnt deshalb bei 1,2 m.

/** Liegeplatz für XL-Schiffe. Werte wie in docs/hafen-und-schiffe.md, Abschnitt 2. */
export const BERTHS = {
  kai: { name: 'Kai', length: 40, beam: 8, depth: 5.0, fromStage: 5 },
};

/** Sicherheitsabstand unter dem Kiel, Regel aus docs/hafen-und-schiffe.md. */
export const KEEL_CLEARANCE = 0.3;

// Gästeprofil je Art (Roadmap P19): wishes, feeFactor (mal Grundpreis XL), arrivalWeight (unter den XL-Booten).
export const TYPES = [
  {
    id: 'XL1',
    wishes: ['wc', 'dusche', 'essen'], feeFactor: 0.8, arrivalWeight: 2,
    name: 'Traditionssegler',
    fromStage: 5,
    length: [20, 40],
    beam: [5.5, 8],
    draft: [1.2, 3.5],
    propulsion: 'sail',
    role: 'guest',
    crew: [8, 40],
    note: 'Bringt Zuschauer an die Promenade, solange er im Hafen liegt.',
  },
  {
    id: 'XL2',
    wishes: ['dusche', 'essen', 'strom', 'diesel'], feeFactor: 1.5, arrivalWeight: 1,
    name: 'Großyacht',
    fromStage: 5,
    length: [20, 35],
    beam: [5.5, 7.5],
    draft: [2.0, 3.5],
    propulsion: 'mixed',
    role: 'guest',
    crew: [6, 16],
    note: 'Zahlt viel und will alle Wünsche erfüllt haben.',
  },
  {
    id: 'XL3',
    wishes: ['strom', 'diesel'], feeFactor: 1.0, arrivalWeight: 1,
    name: 'Fahrgast- und Arbeitsschiff',
    fromStage: 5,
    length: [20, 35],
    beam: [6, 8],
    draft: [1.3, 2.5],
    propulsion: 'motor',
    role: 'mixed',
    crew: [6, 40],
    note: 'Ausflugsschiff, Raddampfer und Fähre bringen Tagesgäste. Tonnenleger und Schlepper sind Sondergäste: zahlen wenig, heben den Ruf.',
  },
];

// Farbpaletten: Werte aus dem Flat-Vector-Stil (skripte/konzeptbilder/styles_a.py, FL).
// Schlüssel: hull (Rumpf), boot (Wasserpass), stripe (Zierstreifen oder Schanzkleid),
// deck, house (Aufbau), trim (Dach, Kanten), glass (Fenster), sail, spar (Masten, Rahen),
// accent (Signalfarbe, Kran, Schornsteinband).
export const COLORS = {
  white: 0xfff8ea, offwhite: 0xf3ede0, cream: 0xf5ecd6, navy: 0x2e4868, dark: 0x2e3c4e,
  black: 0x2a2f38, red: 0xee6454, darkred: 0xb44a3c, green: 0x509e80, darkgreen: 0x2f5e4c,
  yellow: 0xfad060, blue: 0x487ac0, lightblue: 0x8cc4dc, grey: 0x9aa8b4, darkgrey: 0x5c6878,
  wood: 0xe4b880, darkwood: 0xa8744c, teak: 0xd8a870, tan: 0xd89a68, rust: 0xb8603c,
  glass: 0x3e5e7a, mast: 0x606e80, orange: 0xf08a3c, sand: 0xf0e2c0, navygrey: 0x7c8a98,
};

const P = COLORS;

/** Palette mit Standardwerten, o überschreibt einzelne Farben. */
export const pal = (o) => ({
  hull: P.white, boot: P.darkred, stripe: P.navy, deck: P.wood, house: P.white,
  trim: P.navy, glass: P.glass, sail: P.cream, spar: P.mast, accent: P.red, ...o,
});

export const MODELS = [
  // ---------------------------------------------------------------- XL1 Traditionssegler
  {
    id: 'XL1-1', typeId: 'XL1', name: 'Gaffelschoner', fromStage: 5,
    length: 36, beam: 6.8, draft: 2.8, airDraft: 28, mooring: 'kai',
    propulsion: 'sail', role: 'guest',
    crew: [10, 30],
    shape: 'zwei Masten, der hintere höher, langer Bugspriet',
    parts: { hull: 'klipper-spiegel', deck: 'glattdeck-niedriges-deckshaus', rig: 'schoner', extras: ['bugspriet', 'klüver', 'stagfock', 'beiboot-davits'] },
    palettes: [
      pal({ hull: P.black, stripe: P.white, boot: P.darkred, deck: P.teak, house: P.darkwood, trim: P.darkwood, spar: P.darkwood }),
      pal({ hull: P.darkgreen, stripe: P.yellow, boot: P.darkred, deck: P.teak, house: P.white, trim: P.darkwood, spar: P.darkwood }),
      pal({ hull: P.white, stripe: P.navy, boot: P.navy, deck: P.teak, house: P.darkwood, trim: P.darkwood, spar: P.darkwood, sail: P.tan }),
    ],
  },
  {
    id: 'XL1-2', typeId: 'XL1', name: 'Brigg', fromStage: 5,
    length: 38, beam: 7.6, draft: 3.3, airDraft: 30, mooring: 'kai',
    propulsion: 'sail', role: 'guest',
    crew: [16, 40],
    shape: 'zwei Masten mit Rahen quer zum Schiff, viele Wanten',
    parts: { hull: 'senkrecht-spiegel-hoch', deck: 'glattdeck-kajütkappe', rig: 'brigg', extras: ['bugspriet', 'stückpforten', 'besan-gaffel', 'viele-wanten'] },
    palettes: [
      pal({ hull: P.black, stripe: P.white, boot: P.darkred, deck: P.teak, house: P.darkwood, trim: P.darkwood, spar: P.darkwood }),
      pal({ hull: P.navy, stripe: P.yellow, boot: P.darkred, deck: P.teak, house: P.darkwood, trim: P.darkwood, spar: P.darkwood }),
      pal({ hull: P.darkwood, stripe: P.black, boot: P.black, deck: P.teak, house: P.darkwood, trim: P.black, spar: P.darkwood, sail: P.sand }),
    ],
  },
  {
    id: 'XL1-3', typeId: 'XL1', name: 'Haikutter', fromStage: 5,
    length: 25, beam: 6.2, draft: 2.5, airDraft: 21, mooring: 'kai',
    propulsion: 'sail', role: 'guest',
    crew: [8, 20],
    shape: 'gedrungener ehemaliger Fischkutter, zwei Masten, farbiges Schanzkleid',
    parts: { hull: 'senkrecht-kanu-voll', deck: 'glattdeck-ruderhaus', rig: 'gaffelketsch', extras: ['bugspriet', 'schanzkleid-farbig', 'ruderhaus', 'fischkisten'] },
    palettes: [
      pal({ hull: P.white, stripe: P.green, boot: P.black, deck: P.wood, house: P.darkwood, trim: P.green, spar: P.darkwood, sail: P.tan }),
      pal({ hull: P.black, stripe: P.blue, boot: P.darkred, deck: P.wood, house: P.white, trim: P.blue, spar: P.darkwood, sail: P.rust }),
      pal({ hull: P.white, stripe: P.red, boot: P.black, deck: P.wood, house: P.darkwood, trim: P.red, spar: P.darkwood, sail: P.cream }),
    ],
  },
  {
    id: 'XL1-4', typeId: 'XL1', name: 'Kogge', fromStage: 5,
    length: 26, beam: 7.6, draft: 2.3, airDraft: 24, mooring: 'kai',
    propulsion: 'sail', role: 'guest',
    crew: [10, 30],
    shape: 'bauchiger Rumpf, ein Mast mit einem Rahsegel, Kastell am Heck',
    parts: { hull: 'gerade-steven-bauchig-klinker', deck: 'achterkastell', rig: 'rahsegel-einmaster', extras: ['achterkastell', 'heckruder', 'mars-korb', 'wimpel'] },
    palettes: [
      pal({ hull: P.darkwood, stripe: P.wood, boot: P.black, deck: P.wood, house: P.darkwood, trim: P.wood, spar: P.darkwood, sail: P.cream, accent: P.red }),
      pal({ hull: P.darkwood, stripe: P.red, boot: P.black, deck: P.wood, house: P.darkwood, trim: P.red, spar: P.darkwood, sail: P.cream, accent: P.red }),
      pal({ hull: P.rust, stripe: P.wood, boot: P.black, deck: P.wood, house: P.darkwood, trim: P.wood, spar: P.darkwood, sail: P.sand, accent: P.blue }),
    ],
  },
  {
    id: 'XL1-5', typeId: 'XL1', name: 'Plattbodenschiff', fromStage: 5,
    length: 23, beam: 7.4, draft: 1.2, airDraft: 21, mooring: 'kai',
    propulsion: 'sail', role: 'guest',
    crew: [8, 24],
    shape: 'flacher breiter Rumpf, runder Bug, Seitenschwerter',
    parts: { hull: 'rund-rund-flach', deck: 'roef-achtern', rig: 'gaffel-kurz', extras: ['seitenschwerter', 'helmholz', 'blattruder'] },
    palettes: [
      pal({ hull: P.black, stripe: P.wood, boot: P.black, deck: P.wood, house: P.darkgreen, trim: P.wood, spar: P.wood, sail: P.rust }),
      pal({ hull: P.darkgreen, stripe: P.wood, boot: P.black, deck: P.wood, house: P.darkgreen, trim: P.wood, spar: P.wood, sail: P.tan }),
      pal({ hull: P.navy, stripe: P.yellow, boot: P.black, deck: P.wood, house: P.white, trim: P.yellow, spar: P.wood, sail: P.cream }),
    ],
  },

  // ---------------------------------------------------------------- XL2 Großyacht
  {
    id: 'XL2-1', typeId: 'XL2', name: 'Moderne Motoryacht', fromStage: 5,
    length: 32, beam: 7.2, draft: 2.1, airDraft: 12.5, mooring: 'kai',
    propulsion: 'motor', role: 'guest',
    crew: [8, 16],
    shape: 'drei Decks, Radardom, Beiboot-Garage im Heck',
    parts: { hull: 'spitz-spiegel-breit', deck: 'drei-decks', rig: 'keins', extras: ['radardom', 'radar', 'beiboot-garage', 'badeplattform', 'fensterband-rumpf'] },
    palettes: [
      pal({ hull: P.white, stripe: P.glass, boot: P.navy, deck: P.teak, house: P.white, trim: P.dark }),
      pal({ hull: P.navy, stripe: P.glass, boot: P.dark, deck: P.teak, house: P.white, trim: P.dark }),
      pal({ hull: P.navygrey, stripe: P.glass, boot: P.dark, deck: P.teak, house: P.offwhite, trim: P.dark }),
    ],
  },
  {
    id: 'XL2-2', typeId: 'XL2', name: 'Große Segelyacht', fromStage: 5,
    length: 34, beam: 7.4, draft: 3.5, airDraft: 44, mooring: 'kai',
    propulsion: 'sail', role: 'guest',
    crew: [6, 12],
    shape: 'ein sehr hoher Mast, glattes Deck, flacher Aufbau',
    parts: { hull: 'spitz-spiegel-lang', deck: 'glattdeck-flacher-aufbau', rig: 'slup-hoch', extras: ['rollfock', 'baumpersenning', 'zwei-steuerräder'] },
    palettes: [
      pal({ hull: P.navy, stripe: P.white, boot: P.white, deck: P.teak, house: P.white, trim: P.navy, spar: P.white, sail: P.white }),
      pal({ hull: P.white, stripe: P.navy, boot: P.navy, deck: P.teak, house: P.white, trim: P.navy, spar: P.mast, sail: P.white }),
      pal({ hull: P.darkgrey, stripe: P.white, boot: P.black, deck: P.teak, house: P.darkgrey, trim: P.black, spar: P.black, sail: P.cream }),
    ],
  },
  {
    id: 'XL2-3', typeId: 'XL2', name: 'Explorer-Yacht', fromStage: 5,
    length: 30, beam: 7.4, draft: 2.4, airDraft: 12.5, mooring: 'kai',
    propulsion: 'motor', role: 'guest',
    crew: [8, 14],
    shape: 'hoher Bug, Kran, Beiboote an Deck',
    parts: { hull: 'senkrecht-spiegel-hoher-bug', deck: 'aufbau-vorn-arbeitsdeck-achtern', rig: 'radarmast', extras: ['kran', 'beiboot', 'beiboot', 'radar'] },
    palettes: [
      pal({ hull: P.darkgrey, stripe: P.orange, boot: P.black, deck: P.grey, house: P.white, trim: P.darkgrey, accent: P.orange }),
      pal({ hull: P.navy, stripe: P.white, boot: P.black, deck: P.grey, house: P.white, trim: P.navy, accent: P.yellow }),
      pal({ hull: P.white, stripe: P.darkgrey, boot: P.darkred, deck: P.grey, house: P.white, trim: P.darkgrey, accent: P.red }),
    ],
  },
  {
    id: 'XL2-4', typeId: 'XL2', name: 'Klassische Motoryacht', fromStage: 5,
    length: 28, beam: 5.6, draft: 2.2, airDraft: 12, mooring: 'kai',
    propulsion: 'motor', role: 'guest',
    crew: [6, 10],
    shape: 'Klipperbug, Schornstein, langes Teakdeck mit Sonnensegel',
    parts: { hull: 'klipper-rund-schlank', deck: 'holzaufbau-lang', rig: 'flaggenmast', extras: ['schornstein', 'sonnensegel', 'beiboot-davits'] },
    palettes: [
      pal({ hull: P.white, stripe: P.darkwood, boot: P.darkred, deck: P.teak, house: P.darkwood, trim: P.white, accent: P.yellow }),
      pal({ hull: P.darkgreen, stripe: P.wood, boot: P.darkred, deck: P.teak, house: P.darkwood, trim: P.white, accent: P.cream }),
      pal({ hull: P.navy, stripe: P.white, boot: P.darkred, deck: P.teak, house: P.white, trim: P.darkwood, accent: P.red }),
    ],
  },
  {
    id: 'XL2-5', typeId: 'XL2', name: 'Maxi-Racer', fromStage: 5,
    length: 30, beam: 6.2, draft: 3.5, airDraft: 41, mooring: 'kai',
    propulsion: 'sail', role: 'guest',
    crew: [10, 16],
    shape: 'riesiges Rigg, offenes Heck, zwei Steuerräder, kaum Aufbau',
    parts: { hull: 'senkrecht-offen-flach', deck: 'glattdeck', rig: 'slup-karbon', extras: ['zwei-steuerräder', 'bugspriet-kurz', 'offenes-heck'] },
    palettes: [
      pal({ hull: P.white, stripe: P.red, boot: P.dark, deck: P.grey, house: P.dark, trim: P.red, spar: P.black, sail: P.dark }),
      pal({ hull: P.dark, stripe: P.yellow, boot: P.black, deck: P.grey, house: P.black, trim: P.yellow, spar: P.black, sail: P.dark }),
      pal({ hull: P.red, stripe: P.white, boot: P.dark, deck: P.grey, house: P.dark, trim: P.white, spar: P.black, sail: P.white }),
    ],
  },

  // ---------------------------------------------------------------- XL3 Fahrgast- und Arbeitsschiff
  {
    id: 'XL3-1', typeId: 'XL3', name: 'Ausflugsschiff', fromStage: 5,
    length: 32, beam: 7.2, draft: 1.6, airDraft: 11, mooring: 'kai',
    propulsion: 'motor', role: 'passenger',
    crew: [20, 40],
    shape: 'Sonnendeck mit Bänken, großer Salon',
    parts: { hull: 'spitz-rund-voll', deck: 'salon-sonnendeck', rig: 'flaggenmast', extras: ['bänke', 'reling', 'steuerhaus-oben', 'rettungsringe'] },
    palettes: [
      pal({ hull: P.white, stripe: P.blue, boot: P.darkred, deck: P.wood, house: P.white, trim: P.blue, accent: P.red }),
      pal({ hull: P.navy, stripe: P.white, boot: P.darkred, deck: P.wood, house: P.white, trim: P.navy, accent: P.yellow }),
      pal({ hull: P.white, stripe: P.green, boot: P.darkred, deck: P.wood, house: P.white, trim: P.green, accent: P.red }),
    ],
  },
  {
    id: 'XL3-2', typeId: 'XL3', name: 'Seitenraddampfer', fromStage: 5,
    length: 33, beam: 8, draft: 1.3, airDraft: 11, mooring: 'kai',
    propulsion: 'motor', role: 'passenger',
    crew: [20, 40],
    shape: 'Schaufelradkästen an beiden Seiten, hoher Schornstein',
    parts: { hull: 'spitz-rund-schlank', deck: 'salon-promenadendeck', rig: 'flaggenmast', extras: ['radkästen', 'schaufelräder', 'schornstein-hoch', 'steuerhaus-oben'] },
    palettes: [
      pal({ hull: P.black, stripe: P.white, boot: P.darkred, deck: P.wood, house: P.white, trim: P.darkred, accent: P.red }),
      pal({ hull: P.white, stripe: P.darkgreen, boot: P.darkred, deck: P.wood, house: P.white, trim: P.darkgreen, accent: P.yellow }),
      pal({ hull: P.navy, stripe: P.white, boot: P.darkred, deck: P.wood, house: P.cream, trim: P.navy, accent: P.red }),
    ],
  },
  {
    id: 'XL3-3', typeId: 'XL3', name: 'Personenfähre', fromStage: 5,
    length: 28, beam: 7.8, draft: 1.8, airDraft: 10.5, mooring: 'kai',
    propulsion: 'motor', role: 'passenger',
    crew: [10, 40],
    shape: 'vorn und hinten gleich, Rampe, offenes Fahrraddeck',
    parts: { hull: 'doppelend-stumpf', deck: 'fahrraddeck-brücke', rig: 'keins', extras: ['rampe', 'rampe', 'fahrräder', 'brücke-mittig', 'fahrgastraum-seitlich'] },
    palettes: [
      pal({ hull: P.blue, stripe: P.white, boot: P.darkred, deck: P.grey, house: P.white, trim: P.blue, accent: P.yellow }),
      pal({ hull: P.red, stripe: P.white, boot: P.dark, deck: P.grey, house: P.white, trim: P.red, accent: P.yellow }),
      pal({ hull: P.darkgreen, stripe: P.white, boot: P.dark, deck: P.grey, house: P.white, trim: P.darkgreen, accent: P.yellow }),
    ],
  },
  {
    id: 'XL3-4', typeId: 'XL3', name: 'Tonnenleger', fromStage: 5,
    length: 33, beam: 7.8, draft: 2.5, airDraft: 11.5, mooring: 'kai',
    propulsion: 'motor', role: 'special',
    crew: [6, 10],
    shape: 'großes freies Arbeitsdeck, Kran, Tonnen an Deck',
    parts: { hull: 'senkrecht-spiegel-arbeit', deck: 'aufbau-vorn-arbeitsdeck', rig: 'radarmast', extras: ['kran-gross', 'tonnen', 'radar', 'schanzkleid'] },
    palettes: [
      pal({ hull: P.black, stripe: P.white, boot: P.darkred, deck: P.darkgrey, house: P.white, trim: P.black, accent: P.yellow }),
      pal({ hull: P.navy, stripe: P.white, boot: P.darkred, deck: P.darkgrey, house: P.white, trim: P.navy, accent: P.orange }),
      pal({ hull: P.darkgrey, stripe: P.red, boot: P.darkred, deck: P.darkgrey, house: P.white, trim: P.darkgrey, accent: P.red }),
    ],
  },
  {
    id: 'XL3-5', typeId: 'XL3', name: 'Hafenschlepper', fromStage: 5,
    length: 26, beam: 7.6, draft: 2.5, airDraft: 11, mooring: 'kai',
    propulsion: 'motor', role: 'special',
    crew: [6, 8],
    shape: 'hoher Bug, Steuerhaus mit Rundumsicht, Schleppwinde und Schleppbogen achtern, umlaufender Gummifender',
    parts: { hull: 'spitz-rund-schlepper', deck: 'aufbau-mittig-steuerhaus', rig: 'signalmast', extras: ['gummifender', 'schleppwinde', 'schleppbogen', 'schornstein', 'radar'] },
    palettes: [
      pal({ hull: P.red, stripe: P.black, boot: P.black, deck: P.darkgrey, house: P.white, trim: P.black, accent: P.yellow }),
      pal({ hull: P.black, stripe: P.white, boot: P.darkred, deck: P.darkgrey, house: P.white, trim: P.black, accent: P.red }),
      pal({ hull: P.navy, stripe: P.yellow, boot: P.darkred, deck: P.darkgrey, house: P.cream, trim: P.navy, accent: P.yellow }),
    ],
  },
];

/** Modell über seine id finden, zum Beispiel "XL2-3". */
export function getModel(id) {
  return MODELS.find((m) => m.id === id) || null;
}

/** Passt das Modell an einen Liegeplatz? Regel aus docs/hafen-und-schiffe.md, Abschnitt 2. */
export function fitsBerth(model, berth) {
  return model.length <= berth.length && model.beam <= berth.beam && model.draft + KEEL_CLEARANCE <= berth.depth;
}
