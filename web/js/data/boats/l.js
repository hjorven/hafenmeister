// Schiffe der Größe L (9 bis 14 m): 4 Arten mit je 5 Modellen.
// Reine Spieldaten ohne Three.js, damit sim.js und Balancing-Skripte sie nutzen können.
// Quelle der Arten und Formen: docs/hafen-und-schiffe.md, Abschnitt 4.
//
// Konvention für alle Größen (abgestimmt mit S, M und XL):
// - Maße in Metern. length, beam, draft sind die Spielwerte für die Passregel.
// - airDraft: Höhe über der Wasserlinie bis zur Mast- oder Aufbauspitze.
// - mooring: "box" = Box L, Fingerplatz L oder Stirnplatz; "stirn" = nur Stirnplatz.
// - parts: Baukastenteile aus Abschnitt 5, das Rendermodul baut daraus das Modell.
// - palettes: Farbvarianten, Index 0 ist der Standard.
// - crew: [min, max] Menschen an Bord (docs/plan.md 11a, L: 2 bis 8). Steht an der Art,
//   einzelne Modelle können es überschreiben. crewOf(model) liefert den gültigen Wert.

export const SIZE = 'L';

export const TYPES = [
  {
    id: 'L1', name: 'Fahrtenyacht', fromStage: 3,
    length: [9.5, 14], beam: [3.2, 4.3], draft: [1.6, 2.1],
    crew: [2, 6],
    mooring: 'box',
    note: 'Kielyacht, braucht das ausgebaggerte Becken.',
  },
  {
    id: 'L2', name: 'Mehrrumpfboot', fromStage: 4,
    length: [10, 13], beam: [6, 7.5], draft: [1.0, 1.3],
    crew: [2, 8],
    mooring: 'stirn',
    note: 'Passt nur an einen Stirnplatz.',
  },
  {
    id: 'L3', name: 'Motoryacht', fromStage: 3,
    length: [10, 14], beam: [3.6, 4.5], draft: [0.9, 1.3],
    crew: [2, 6],
    mooring: 'box',
    note: '',
  },
  {
    id: 'L4', name: 'Arbeits- und Behördenboot', fromStage: 4,
    length: [10, 14], beam: [3.5, 4.5], draft: [1.0, 1.6],
    crew: [2, 8],
    mooring: 'box',
    note: 'Sondergäste: zahlen wenig, heben aber den Ruf. Die Barkasse bringt Tagesgäste.',
  },
];

// Farben im Flat-Vector-Stil (aus skripte/konzeptbilder/styles_a.py, Palette FL).
export const COLORS = {
  white: '#fff8ea', offwhite: '#f2ece0', navy: '#2e4868', red: '#ee6454', yellow: '#fad060',
  green: '#509e80', dark: '#2e3c4e', black: '#2e3440', blue: '#487ac0', teak: '#e8be86',
  grey: '#b8c2cc', steel: '#8e9aa8', policeBlue: '#6e86a0', signal: '#f07a3c',
  varnish: '#c98a4e', mahogany: '#a5603a', cream: '#f6e6c4', sand: '#e4d2aa', bordeaux: '#9c3c46',
};
const C = COLORS;

// Palette: hull = Rumpf, trim = Zierstreifen oben am Rumpf, deck = Deck,
// canvas = Persenning, Sprayhood, Bimini, house = Aufbau, roof = Dach.
const pal = (hull, trim, deck, canvas, house = C.white, roof = house) => ({ hull, trim, deck, canvas, house, roof });

export const MODELS = [
  // ---------------------------------------------------------------- L1 Fahrtenyacht
  {
    id: 'L1-1', typeId: 'L1', name: 'Moderne Serienyacht', fromStage: 3,
    length: 12.0, beam: 4.0, draft: 1.9, airDraft: 17.5, mooring: 'box',
    shape: 'breites Heck mit zwei Steuerrädern und Badeplattform, Sprayhood, Bimini',
    parts: { hull: 'modern-breit', deck: 'kajuetaufbau-flach', rig: 'slup', extras: ['sprayhood', 'bimini', 'zwei-steuerraeder', 'badeplattform', 'reling'] },
    palettes: [pal(C.white, C.navy, C.offwhite, C.blue), pal(C.white, C.grey, C.teak, C.dark), pal(C.navy, C.white, C.offwhite, C.sand)],
  },
  {
    id: 'L1-2', typeId: 'L1', name: 'Decksalonyacht', fromStage: 3,
    length: 12.5, beam: 4.1, draft: 1.9, airDraft: 18.0, mooring: 'box',
    shape: 'hoher Aufbau mit großen Fenstern rundum',
    parts: { hull: 'fahrten', deck: 'decksalon', rig: 'slup', extras: ['sprayhood', 'steuerrad', 'reling'] },
    palettes: [pal(C.white, C.blue, C.teak, C.blue), pal(C.offwhite, C.green, C.teak, C.green), pal(C.dark, C.white, C.teak, C.sand)],
  },
  {
    id: 'L1-3', typeId: 'L1', name: 'Mittelcockpit-Yacht', fromStage: 3,
    length: 13.0, beam: 4.2, draft: 2.0, airDraft: 18.0, mooring: 'box',
    shape: 'Cockpit in der Mitte, Achterkajüte dahinter, feste Windschutzscheibe',
    parts: { hull: 'fahrten-ueberhang', deck: 'mittelcockpit-achterkajuete', rig: 'slup', extras: ['windschutzscheibe', 'bimini', 'steuerrad', 'reling'] },
    palettes: [pal(C.white, C.red, C.teak, C.navy), pal(C.cream, C.navy, C.teak, C.navy), pal(C.green, C.white, C.teak, C.sand)],
  },
  {
    id: 'L1-4', typeId: 'L1', name: 'Regattayacht', fromStage: 3,
    length: 11.5, beam: 3.8, draft: 2.1, airDraft: 18.5, mooring: 'box',
    shape: 'flach, sehr breites offenes Heck, schwarzer Mast, Bugspriet, keine Sprayhood',
    parts: { hull: 'regatta-flach', deck: 'glattdeck', rig: 'slup-carbon', extras: ['bugspriet', 'zwei-steuerraeder'] },
    palettes: [pal(C.white, C.black, C.grey, C.black), pal(C.red, C.white, C.grey, C.black), pal(C.yellow, C.black, C.grey, C.black)],
  },
  {
    id: 'L1-5', typeId: 'L1', name: 'Langfahrt-Ketsch', fromStage: 3,
    length: 13.5, beam: 4.2, draft: 2.0, airDraft: 17.0, mooring: 'box',
    shape: 'zwei Masten, Geräteträger mit Solarpanel und Windgenerator, Beiboot am Heck',
    parts: { hull: 'langfahrt', deck: 'kajuetaufbau-lang', rig: 'ketsch', extras: ['geraetetraeger', 'solarpanel', 'windgenerator', 'beiboot-davits', 'sprayhood', 'steuerrad', 'reling'] },
    palettes: [pal(C.navy, C.yellow, C.teak, C.sand), pal(C.white, C.bordeaux, C.teak, C.bordeaux), pal(C.green, C.cream, C.teak, C.sand)],
  },

  // ---------------------------------------------------------------- L2 Mehrrumpfboot
  {
    id: 'L2-1', typeId: 'L2', name: 'Fahrtenkatamaran', fromStage: 4,
    length: 12.0, beam: 6.8, draft: 1.2, airDraft: 19.0, mooring: 'stirn',
    shape: 'zwei Rümpfe, breiter Salon dazwischen, Netz vorn',
    parts: { hull: 'katamaran', deck: 'salon-bruecke', rig: 'slup', extras: ['netz', 'hardtop'] },
    palettes: [pal(C.white, C.grey, C.offwhite, C.grey), pal(C.white, C.blue, C.offwhite, C.blue), pal(C.offwhite, C.dark, C.teak, C.dark)],
  },
  {
    id: 'L2-2', typeId: 'L2', name: 'Katamaran mit Flybridge', fromStage: 4,
    length: 13.0, beam: 7.3, draft: 1.3, airDraft: 20.0, mooring: 'stirn',
    shape: 'zusätzlicher Steuerstand auf dem Dach',
    parts: { hull: 'katamaran', deck: 'salon-flybridge', rig: 'slup', extras: ['netz', 'flybridge', 'bimini', 'steuerrad'] },
    palettes: [pal(C.white, C.navy, C.offwhite, C.navy), pal(C.white, C.red, C.offwhite, C.sand), pal(C.grey, C.white, C.offwhite, C.dark)],
  },
  {
    id: 'L2-3', typeId: 'L2', name: 'Motorkatamaran', fromStage: 4,
    length: 12.5, beam: 6.2, draft: 1.0, airDraft: 6.3, mooring: 'stirn',
    shape: 'kein Mast, hoher Aufbau über die ganze Breite',
    parts: { hull: 'katamaran-motor', deck: 'aufbau-volle-breite', rig: 'keins', extras: ['hardtop', 'radar', 'steuerrad'] },
    palettes: [pal(C.white, C.dark, C.offwhite, C.dark), pal(C.grey, C.white, C.offwhite, C.dark), pal(C.navy, C.white, C.teak, C.sand)],
  },
  {
    id: 'L2-4', typeId: 'L2', name: 'Trimaran', fromStage: 4,
    length: 12.5, beam: 7.5, draft: 1.1, airDraft: 18.0, mooring: 'stirn',
    shape: 'schlanker Mittelrumpf, zwei Ausleger an Trägern, viel Netzfläche',
    parts: { hull: 'trimaran', deck: 'kajuetaufbau-flach', rig: 'slup', extras: ['ausleger', 'netz', 'steuerrad'] },
    palettes: [pal(C.white, C.yellow, C.grey, C.dark), pal(C.yellow, C.dark, C.grey, C.dark), pal(C.white, C.green, C.grey, C.green)],
  },
  {
    id: 'L2-5', typeId: 'L2', name: 'Regatta-Katamaran', fromStage: 4,
    length: 10.5, beam: 6.0, draft: 1.0, airDraft: 19.0, mooring: 'stirn',
    shape: 'nur Rümpfe, Träger und Netz, sehr hoher Mast',
    parts: { hull: 'katamaran-schlank', deck: 'keins', rig: 'slup-carbon-hoch', extras: ['traeger', 'netz'] },
    palettes: [pal(C.white, C.black, C.grey, C.black), pal(C.red, C.black, C.grey, C.black), pal(C.blue, C.white, C.grey, C.black)],
  },

  // ---------------------------------------------------------------- L3 Motoryacht
  {
    id: 'L3-1', typeId: 'L3', name: 'Flybridge-Yacht', fromStage: 3,
    length: 13.5, beam: 4.3, draft: 1.1, airDraft: 6.2, mooring: 'box',
    shape: 'zweites Steuerdeck oben, Radarbügel',
    parts: { hull: 'gleiter-hoch', deck: 'salon-flybridge', rig: 'keins', extras: ['flybridge', 'radarbuegel', 'badeplattform', 'reling'] },
    palettes: [pal(C.white, C.dark, C.offwhite, C.dark), pal(C.white, C.navy, C.teak, C.navy), pal(C.dark, C.white, C.teak, C.sand)],
  },
  {
    id: 'L3-2', typeId: 'L3', name: 'Trawleryacht', fromStage: 3,
    length: 12.5, beam: 4.3, draft: 1.3, airDraft: 7.2, mooring: 'box',
    shape: 'hoher Bug, Steuerhaus mit senkrechten Scheiben, kleiner Mast mit Ladebaum',
    parts: { hull: 'verdraenger-hochbug', deck: 'steuerhaus-erhoeht', rig: 'signalmast-ladebaum', extras: ['beiboot-dach', 'reling'] },
    palettes: [pal(C.green, C.white, C.teak, C.green), pal(C.navy, C.white, C.teak, C.navy), pal(C.bordeaux, C.cream, C.teak, C.bordeaux, C.cream)],
  },
  {
    id: 'L3-3', typeId: 'L3', name: 'Sportcruiser', fromStage: 3,
    length: 13.0, beam: 3.9, draft: 1.0, airDraft: 3.7, mooring: 'box',
    shape: 'flach und lang, Hardtop mit Schiebedach, Sonnenliege am Heck',
    parts: { hull: 'gleiter-flach', deck: 'hardtop-schiebedach', rig: 'keins', extras: ['windschutzscheibe', 'sonnenliege', 'badeplattform'] },
    palettes: [pal(C.white, C.dark, C.teak, C.cream), pal(C.grey, C.white, C.teak, C.cream), pal(C.white, C.red, C.teak, C.cream)],
  },
  {
    id: 'L3-4', typeId: 'L3', name: 'Klassische Holzmotoryacht', fromStage: 3,
    length: 11.0, beam: 3.6, draft: 1.1, airDraft: 4.3, mooring: 'box',
    shape: 'senkrechter Steven, Kanuheck, lackierter Aufbau',
    parts: { hull: 'kanuheck-senkrecht', deck: 'deckshaus-lackiert', rig: 'flaggenmast', extras: ['flaggenstock', 'reling'] },
    palettes: [pal(C.white, C.mahogany, C.teak, C.cream, C.varnish, C.white), pal(C.mahogany, C.cream, C.teak, C.cream, C.varnish, C.white), pal(C.navy, C.cream, C.teak, C.cream, C.varnish, C.white)],
  },
  {
    id: 'L3-5', typeId: 'L3', name: 'Stahlyacht mit Achterkajüte', fromStage: 3,
    length: 11.5, beam: 3.8, draft: 1.2, airDraft: 4.6, mooring: 'box',
    shape: 'runde Formen, offener Steuerstand unter einem Verdeck, zwei Kajüten',
    parts: { hull: 'verdraenger-rund', deck: 'zwei-kajueten-verdeck', rig: 'signalmast', extras: ['verdeck', 'scheuerleiste', 'reling'] },
    palettes: [pal(C.navy, C.white, C.teak, C.blue), pal(C.dark, C.cream, C.teak, C.sand), pal(C.green, C.white, C.teak, C.green)],
  },

  // ---------------------------------------------------------------- L4 Arbeits- und Behördenboot
  {
    id: 'L4-1', typeId: 'L4', name: 'Seenotrettungsboot', fromStage: 4,
    length: 10.5, beam: 3.8, draft: 1.0, airDraft: 5.8, mooring: 'box',
    crew: [2, 4],
    shape: 'geschlossenes Steuerhaus, Signalfarben, umlaufende Scheuerleiste',
    special: 'station', role: 'seenotretter',
    parts: { hull: 'rettungsboot', deck: 'steuerhaus-geschlossen', rig: 'radarmast', extras: ['scheuerleiste', 'radar', 'blaulicht', 'rettungsinsel'] },
    palettes: [pal(C.signal, C.white, C.grey, C.signal, C.white, C.signal), pal(C.white, C.signal, C.grey, C.signal, C.signal, C.white), pal(C.signal, C.dark, C.grey, C.signal, C.white, C.white)],
  },
  {
    id: 'L4-2', typeId: 'L4', name: 'Polizeiboot', fromStage: 4,
    length: 13.0, beam: 4.2, draft: 1.3, airDraft: 6.8, mooring: 'box',
    crew: [2, 4],
    shape: 'graublauer Rumpf, Radarmast, Schlauchboot an Deck',
    special: 'sondergast', role: 'polizei',
    parts: { hull: 'behoerde', deck: 'steuerhaus-geschlossen', rig: 'radarmast', extras: ['radar', 'blaulicht', 'schlauchboot-deck', 'reling'] },
    palettes: [pal(C.policeBlue, C.blue, C.grey, C.dark, C.white, C.grey), pal(C.policeBlue, C.white, C.grey, C.dark, C.white, C.blue), pal(C.dark, C.blue, C.grey, C.dark, C.white, C.grey)],
  },
  {
    id: 'L4-3', typeId: 'L4', name: 'Arbeitsboot', fromStage: 4,
    length: 11.0, beam: 4.3, draft: 1.5, airDraft: 5.6, mooring: 'box',
    crew: [2, 3],
    shape: 'gedrungener Rumpf, Schleppbock, Reifen als Fender',
    special: 'sondergast', role: 'arbeit',
    parts: { hull: 'arbeit-gedrungen', deck: 'steuerhaus-vorn', rig: 'signalmast', extras: ['schleppbock', 'reifenfender', 'poller'] },
    palettes: [pal(C.dark, C.yellow, C.steel, C.dark, C.yellow, C.white), pal(C.bordeaux, C.white, C.steel, C.dark, C.white, C.bordeaux), pal(C.green, C.yellow, C.steel, C.dark, C.white, C.yellow)],
  },
  {
    id: 'L4-4', typeId: 'L4', name: 'Großer Fischkutter', fromStage: 4,
    length: 14.0, beam: 4.5, draft: 1.6, airDraft: 8.0, mooring: 'box',
    crew: [3, 5],
    shape: 'Netztrommel am Heck, Ladebaum, hohes Steuerhaus',
    special: 'sondergast', role: 'fischer',
    parts: { hull: 'kutter', deck: 'steuerhaus-hoch', rig: 'mast-ladebaum', extras: ['netztrommel', 'fischkisten', 'reling'] },
    palettes: [pal(C.navy, C.white, C.steel, C.green, C.white, C.red), pal(C.green, C.white, C.steel, C.navy, C.white, C.red), pal(C.red, C.white, C.steel, C.green, C.white, C.navy)],
  },
  {
    id: 'L4-5', typeId: 'L4', name: 'Hafenbarkasse', fromStage: 4,
    length: 14.0, beam: 4.0, draft: 1.0, airDraft: 3.4, mooring: 'box',
    crew: [2, 8],
    shape: 'langer niedriger Aufbau mit Fensterreihe, Bänke für Rundfahrten',
    special: 'tagesgaeste', role: 'rundfahrt',
    parts: { hull: 'barkasse', deck: 'aufbau-lang-niedrig', rig: 'flaggenstock', extras: ['fensterreihe', 'baenke', 'flaggenstock'] },
    palettes: [pal(C.black, C.red, C.teak, C.dark, C.white, C.grey), pal(C.navy, C.white, C.teak, C.dark, C.cream, C.white), pal(C.bordeaux, C.cream, C.teak, C.dark, C.white, C.grey)],
  },
];

export const MODEL_BY_ID = Object.fromEntries(MODELS.map((m) => [m.id, m]));

// Passregel aus docs/hafen-und-schiffe.md, Abschnitt 2:
// nicht länger und nicht breiter als der Platz, Wassertiefe mindestens 0,3 m größer als der Tiefgang.
// berth = { length, beam, depth, kind } mit kind z. B. "boxL", "fingerL", "stirn".
export function fits(model, berth) {
  if (model.mooring === 'stirn' && berth.kind !== 'stirn') return false;
  return model.length <= berth.length && model.beam <= berth.beam && berth.depth >= model.draft + 0.3;
}

// Menschen an Bord: Wert des Modells, sonst der Art.
export function crewOf(model) {
  return model.crew ?? TYPES.find((t) => t.id === model.typeId).crew;
}
