// Schiffe der Größe XXL: Daten ohne Grafik. Ab Stufe 6 "Seehafen" (docs/plan.md, Abschnitt 4 und 5).
//
// Konvention wie bei allen Größen: 1 Einheit = 1 m, Y nach oben, Bug nach +X,
// Ursprung = Wasserlinie mittschiffs. length = Länge über alles inklusive Bugspriet,
// beam = größte Breite (beim Kreuzfahrtschiff mit Brückennocken, beim Segelschulschiff
// ohne die Rahen, die wie beim echten Schiff seitlich überstehen), draft = Tiefgang, airDraft = höchster Punkt über Wasser.
//
// crew = [min, max] Menschen an Bord (docs/plan.md, Abschnitt 11a).
//
// XXL-Schiffe zahlen kein Liegegeld pro Nacht. Kreuzfahrtschiffe bringen Tagesgäste,
// Marineschiffe heben den Ruf und ziehen Zuschauer an, Seenotrettungskreuzer werden
// stationiert und laufen bei Sturm aus (kein Gast).

import { COLORS as P, pal } from './xl.js';

export const KEEL_CLEARANCE = 0.3;

/**
 * Liegeplätze für XXL. Vorschlag, Lage und Bau übernimmt der Thread
 * "Services und Sonderanlagen einbauen" (Kreuzfahrtterminal, Marineanleger, Seenotretter-Station).
 */
export const BERTHS = {
  pier: { name: 'Pier am Kreuzfahrtterminal', length: 200, beam: 30, depth: 8.5, fromStage: 6 },
  marine: { name: 'Marineanleger', length: 100, beam: 16, depth: 6.0, fromStage: 6 },
  station: { name: 'Liegeplatz der Seenotretter-Station', length: 50, beam: 12, depth: 4.0, fromStage: 6 },
};

export const TYPES = [
  {
    id: 'XXL1',
    name: 'Kreuzfahrtschiff',
    fromStage: 6,
    length: [100, 180],
    beam: [11, 29],
    draft: [1.6, 7.2],
    propulsion: 'motor',
    role: 'passenger',
    mooring: 'pier',
    // Felder für die Spielregeln (web/js/sim.js)
    size: 'XXL', kind: 'kreuzfahrt', unlock: 'kreuzfahrt', fromSea: true, motor: true,
    noWishes: true, dayVisitors: 400, nights: [1, 1], weight: 1, crew: [80, 200],
    note: 'Kommt angekündigt für einen Tag, bringt viele Tagesgäste in Kiosk, Restaurant und Läden.',
  },
  {
    id: 'XXL2',
    name: 'Marineschiff',
    fromStage: 6,
    length: [50, 90],
    beam: [9, 13],
    draft: [2.8, 5.0],
    propulsion: 'motor',
    role: 'special',
    mooring: 'marine',
    size: 'XXL', kind: 'marine', unlock: 'marine', fromSea: true, motor: true, special: true,
    noWishes: true, dayVisitors: 120, nights: [1, 2], weight: 1, crew: [20, 60],
    note: 'Hafenbesuch zu Festtagen, hebt den Ruf stark, zieht Zuschauer an.',
  },
  {
    id: 'XXL3',
    name: 'Seenotrettungskreuzer',
    fromStage: 6,
    length: [20, 46],
    beam: [5, 11],
    draft: [1.5, 2.8],
    propulsion: 'motor',
    role: 'station',
    mooring: 'station',
    // Stationiert: liegt fest an einem reservierten Platz der Art 'seenotretter', kommt nicht als Gast
    size: 'XXL', kind: 'seenotretter', unlock: 'seenotkreuzer', stationed: true, motor: true, special: true,
    noWishes: true, weight: 1, crew: [4, 10],
    note: 'Wird stationiert, läuft bei Sturm aus und kommt zurück. Kein Gast, zahlt nichts.',
  },
];

export const MODELS = [
  // ---------------------------------------------------------------- XXL1 Kreuzfahrtschiff
  {
    id: 'XXL1-1', typeId: 'XXL1', name: 'Expeditionsschiff', fromStage: 6,
    length: 110, beam: 18, draft: 5.2, airDraft: 30, mooring: 'pier',
    propulsion: 'motor', role: 'passenger',
    crew: [80, 140],
    shape: 'hoher Bug, gestaffelte Decks, Zodiacs auf dem Achterdeck',
    parts: { hull: 'spitz-spiegel-gross', deck: 'decks-gestaffelt', rig: 'radarmast', extras: ['schornstein-breit', 'zodiacs', 'radar'] },
    palettes: [
      pal({ hull: P.dark, stripe: P.white, boot: P.darkred, deck: P.teak, house: P.white, trim: P.dark, accent: P.orange }),
      pal({ hull: P.red, stripe: P.white, boot: P.dark, deck: P.teak, house: P.white, trim: P.dark, accent: P.yellow }),
      pal({ hull: P.navy, stripe: P.white, boot: P.darkred, deck: P.teak, house: P.white, trim: P.navy, accent: P.red }),
    ],
  },
  {
    id: 'XXL1-2', typeId: 'XXL1', name: 'Flusskreuzer-Format', fromStage: 6,
    length: 110, beam: 11.4, draft: 1.6, airDraft: 12.5, mooring: 'pier',
    propulsion: 'motor', role: 'passenger',
    crew: [80, 160],
    shape: 'sehr lang, schmal und niedrig, zwei Fensterbänder, Sonnendeck mit Sonnensegeln, Panoramarestaurant vorn',
    parts: { hull: 'spitz-rund-flach', deck: 'zwei-decks-sonnendeck', rig: 'keins', extras: ['sonnensegel', 'pool', 'liegen', 'steuerhaus-oben', 'radar'] },
    palettes: [
      pal({ hull: P.navy, stripe: P.white, boot: P.darkred, deck: P.teak, house: P.white, trim: P.navy, accent: P.white }),
      pal({ hull: P.white, stripe: P.blue, boot: P.darkred, deck: P.teak, house: P.white, trim: P.blue, accent: P.blue }),
      pal({ hull: P.darkgreen, stripe: P.white, boot: P.darkred, deck: P.teak, house: P.white, trim: P.darkgreen, accent: P.cream }),
    ],
  },
  {
    id: 'XXL1-3', typeId: 'XXL1', name: 'Mittleres Kreuzfahrtschiff', fromStage: 6,
    length: 180, beam: 29, draft: 7.2, airDraft: 47, mooring: 'pier',
    propulsion: 'motor', role: 'passenger',
    crew: [120, 200],
    shape: 'viele Decks mit Fensterbändern, Pooldeck, Rettungsboote, großer Schornstein, Brückennocken',
    parts: { hull: 'spitz-spiegel-kreuzfahrt', deck: 'decks-hoch', rig: 'radarmast', extras: ['schornstein-gross', 'pooldeck', 'rettungsboote', 'radar'] },
    palettes: [
      pal({ hull: P.navy, stripe: P.white, boot: P.darkred, deck: P.lightblue, house: P.white, trim: P.navy, accent: P.yellow }),
      pal({ hull: P.white, stripe: P.blue, boot: P.darkred, deck: P.lightblue, house: P.white, trim: P.blue, accent: P.blue }),
      pal({ hull: P.dark, stripe: P.white, boot: P.darkred, deck: P.lightblue, house: P.white, trim: P.dark, accent: P.red }),
    ],
  },

  // ---------------------------------------------------------------- XXL2 Marineschiff
  {
    id: 'XXL2-1', typeId: 'XXL2', name: 'Minenjagdboot', fromStage: 6,
    length: 55, beam: 9.2, draft: 2.8, airDraft: 18.5, mooring: 'marine',
    propulsion: 'motor', role: 'special',
    crew: [20, 40],
    shape: 'langes freies Achterdeck mit Kabeltrommel, Aufbau mittig, Gittermast',
    parts: { hull: 'spitz-spiegel-marine-klein', deck: 'aufbau-mittig', rig: 'gittermast', extras: ['geschütz-klein', 'kabeltrommel', 'radar', 'schornstein'] },
    palettes: [
      pal({ hull: P.grey, stripe: P.grey, boot: P.dark, deck: P.darkgrey, house: P.grey, trim: P.darkgrey, accent: P.white }),
      pal({ hull: P.navygrey, stripe: P.navygrey, boot: P.dark, deck: P.darkgrey, house: P.navygrey, trim: P.dark, accent: P.white }),
      pal({ hull: 0xb4bcc4, stripe: 0xb4bcc4, boot: P.dark, deck: P.darkgrey, house: 0xb4bcc4, trim: P.darkgrey, accent: P.white }),
    ],
  },
  {
    id: 'XXL2-2', typeId: 'XXL2', name: 'Korvette', fromStage: 6,
    length: 90, beam: 13, draft: 4.0, airDraft: 29.5, mooring: 'marine',
    propulsion: 'motor', role: 'special',
    crew: [30, 60],
    shape: 'schräge glatte Flächen, Geschütz vorn, Hubschrauberdeck achtern, Mast in Pyramidenform',
    parts: { hull: 'spitz-spiegel-marine', deck: 'aufbau-facettiert', rig: 'pyramidenmast', extras: ['geschütz', 'hubschrauberdeck', 'radar', 'beiboote-seitlich'] },
    palettes: [
      pal({ hull: P.grey, stripe: P.grey, boot: P.dark, deck: P.darkgrey, house: P.grey, trim: P.darkgrey, accent: P.white }),
      pal({ hull: P.navygrey, stripe: P.navygrey, boot: P.dark, deck: P.darkgrey, house: P.navygrey, trim: P.dark, accent: P.white }),
      pal({ hull: 0xb4bcc4, stripe: 0xb4bcc4, boot: P.dark, deck: P.darkgrey, house: 0xb4bcc4, trim: P.darkgrey, accent: P.white }),
    ],
  },
  {
    id: 'XXL2-3', typeId: 'XXL2', name: 'Segelschulschiff', fromStage: 6,
    length: 90, beam: 12, draft: 5.0, airDraft: 50.5, mooring: 'marine',
    propulsion: 'sail', role: 'special',
    crew: [40, 60],
    shape: 'Bark: zwei Rahmasten und ein Besan mit Gaffel, langer Klüverbaum, weißer Rumpf, Beiboote in Davits',
    parts: { hull: 'spitz-spiegel-bark', deck: 'back-poop-kartenhaus', rig: 'bark', extras: ['klüverbaum', 'galionsfigur', 'marse', 'beiboote-davits'] },
    palettes: [
      pal({ hull: P.white, stripe: P.yellow, boot: P.darkred, deck: P.teak, house: P.white, trim: P.darkwood, spar: P.darkwood, sail: P.white, accent: P.yellow }),
      pal({ hull: P.black, stripe: P.white, boot: P.darkred, deck: P.teak, house: P.white, trim: P.darkwood, spar: P.darkwood, sail: P.cream, accent: P.white }),
      pal({ hull: P.navy, stripe: P.white, boot: P.darkred, deck: P.teak, house: P.white, trim: P.darkwood, spar: P.darkwood, sail: P.white, accent: P.red }),
    ],
  },

  // ---------------------------------------------------------------- XXL3 Seenotrettungskreuzer
  {
    id: 'XXL3-1', typeId: 'XXL3', name: 'Seenotrettungskreuzer 20-m-Klasse', fromStage: 6,
    length: 20, beam: 5.2, draft: 1.5, airDraft: 11, mooring: 'station',
    propulsion: 'motor', role: 'station',
    crew: [4, 6],
    shape: 'erhöhtes Steuerhaus, Gittermast, Tochterboot in der Heckwanne',
    parts: { hull: 'spitz-spiegel-rettung', deck: 'steuerhaus-erhöht', rig: 'gittermast', extras: ['tochterboot', 'heckwanne', 'radar'] },
    palettes: [
      pal({ hull: P.red, stripe: P.white, boot: P.dark, deck: P.grey, house: P.white, trim: P.red, accent: P.orange }),
      pal({ hull: P.white, stripe: P.red, boot: P.dark, deck: P.grey, house: P.white, trim: P.red, accent: P.orange }),
      pal({ hull: P.orange, stripe: P.white, boot: P.dark, deck: P.grey, house: P.white, trim: P.dark, accent: P.red }),
    ],
  },
  {
    id: 'XXL3-2', typeId: 'XXL3', name: 'Seenotrettungskreuzer 28-m-Klasse', fromStage: 6,
    length: 28, beam: 6.6, draft: 1.9, airDraft: 14, mooring: 'station',
    propulsion: 'motor', role: 'station',
    crew: [4, 8],
    shape: 'hoher Mast, Tochterboot in einer Wanne am Heck, Suchscheinwerfer',
    parts: { hull: 'spitz-spiegel-rettung', deck: 'steuerhaus-erhöht', rig: 'gittermast', extras: ['tochterboot', 'heckwanne', 'radar', 'suchscheinwerfer'] },
    palettes: [
      pal({ hull: P.red, stripe: P.white, boot: P.dark, deck: P.grey, house: P.white, trim: P.red, accent: P.orange }),
      pal({ hull: P.white, stripe: P.red, boot: P.dark, deck: P.grey, house: P.white, trim: P.red, accent: P.orange }),
      pal({ hull: P.orange, stripe: P.white, boot: P.dark, deck: P.grey, house: P.white, trim: P.dark, accent: P.red }),
    ],
  },
  {
    id: 'XXL3-3', typeId: 'XXL3', name: 'Seenotrettungskreuzer 46-m-Klasse', fromStage: 6,
    length: 46, beam: 10.8, draft: 2.8, airDraft: 19, mooring: 'station',
    propulsion: 'motor', role: 'station',
    crew: [6, 10],
    shape: 'großes Steuerhaus mit Rundumsicht, hoher Mast, Tochterboot in der Heckwanne, Löschmonitor',
    parts: { hull: 'spitz-spiegel-rettung-gross', deck: 'steuerhaus-zweistöckig', rig: 'gittermast', extras: ['tochterboot', 'heckwanne', 'radar', 'suchscheinwerfer', 'löschmonitor'] },
    palettes: [
      pal({ hull: P.red, stripe: P.white, boot: P.dark, deck: P.grey, house: P.white, trim: P.red, accent: P.orange }),
      pal({ hull: P.white, stripe: P.red, boot: P.dark, deck: P.grey, house: P.white, trim: P.red, accent: P.orange }),
      pal({ hull: P.orange, stripe: P.white, boot: P.dark, deck: P.grey, house: P.white, trim: P.dark, accent: P.red }),
    ],
  },
];

/** Modell über seine id finden, zum Beispiel "XXL2-2". */
export function getModel(id) {
  return MODELS.find((m) => m.id === id) || null;
}

/** Passt das Modell an einen Liegeplatz? Regel aus docs/hafen-und-schiffe.md, Abschnitt 2. */
export function fitsBerth(model, berth) {
  return model.length <= berth.length && model.beam <= berth.beam && model.draft + KEEL_CLEARANCE <= berth.depth;
}
