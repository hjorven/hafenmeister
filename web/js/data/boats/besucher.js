// Seltene Besucher (Paket P40, Roadmap F16, docs/besucher.md): besondere Schiffe, die nur als
// seltener Besuch kommen (features/besucher-regeln.js), nie im normalen Ankunftswürfel.
// Reine Spieldaten ohne Three.js. Grafik: web/js/render/boats/besucher.js.
//
// Die Arten tragen unlock: 'besucher'. Diese Freischaltung meldet kein Modul, darum würfelt sim.js sie
// nie aus (eligibleTypes); das Besucher-Modul verwandelt morgens eines der erwarteten Boote in das
// Schiff. besucher: true hält sie aus dem Reiter "Boote" des Logbuchs (sie stehen im Reiter "Besucher").
// Maße wie bei den anderen Größen: 1 Einheit = 1 m, length inklusive Bugspriet, crew = [min, max].

export const TYPES = [
  {
    id: 'L5', name: 'Seltener Besuch', size: 'L', fromStage: 2, kind: 'besucher', unlock: 'besucher', besucher: true,
    wishes: [], feeFactor: 1.3, arrivalWeight: 0,
    length: [11.5, 14], beam: [3.6, 4.4], draft: [1.2, 1.8],
    crew: [2, 8], mooring: 'box', fromSea: true,
    note: 'Weltumsegler, Museumsschiff und Forschungskutter: kommen nur als seltener Besuch.',
  },
  {
    id: 'XL4', name: 'Hoher Besuch', size: 'XL', fromStage: 5, kind: 'besucher', unlock: 'besucher', besucher: true,
    wishes: [], feeFactor: 3, arrivalWeight: 0,
    length: [36, 38], beam: [7, 7.6], draft: [2.8, 3.2],
    crew: [16, 30], mooring: 'kai', fromSea: true,
    note: 'Die Königsyacht: kommt nur als seltener Besuch, liegt am Kai.',
  },
];

const pal = (o) => ({ ...o });

export const MODELS = [
  {
    id: 'L5-1', typeId: 'L5', name: 'Weltumsegler-Kutter', fromStage: 2, besucher: 'weltumsegler',
    length: 11.8, beam: 3.7, draft: 1.6, airDraft: 15.5, mooring: 'box', crew: [2, 2],
    shape: 'Stahlkutter mit zwei Vorsegeln, Windfahne am Heck, Solarbügel, Flaggenleine mit Gastlandflaggen',
    palettes: [pal({ hull: '#2f5e4c', trim: '#f6e6c4', deck: '#c98a4e', canvas: '#9c3c46', house: '#f6e6c4', roof: '#2f5e4c' })],
  },
  {
    id: 'L5-2', typeId: 'L5', name: 'Museumsdampfer', fromStage: 3, besucher: 'museumsschiff',
    length: 13.8, beam: 3.6, draft: 1.2, airDraft: 6.5, mooring: 'box', crew: [3, 6],
    shape: 'Dampfbarkasse mit schwarzem Rumpf, hohem Schornstein mit rotem Band und Sonnendach',
    palettes: [pal({ hull: '#2a2f38', trim: '#c9a227', deck: '#d8a870', canvas: '#f6e6c4', house: '#a5603a', roof: '#f3ede0' })],
  },
  {
    id: 'L5-3', typeId: 'L5', name: 'Forschungskutter', fromStage: 4, besucher: 'forschungsschiff',
    length: 13.9, beam: 4.4, draft: 1.5, airDraft: 8.5, mooring: 'box', crew: [4, 8],
    shape: 'weißer Rumpf mit blauem Streifen, hohes Steuerhaus mit Antennen, orangefarbener A-Rahmen am Heck',
    palettes: [pal({ hull: '#fff8ea', trim: '#2f6db3', deck: '#9aa8b4', canvas: '#f08a3c', house: '#fff8ea', roof: '#2f6db3' })],
  },
  {
    id: 'XL4-1', typeId: 'XL4', name: 'Königsyacht', fromStage: 5, besucher: 'koenigsyacht',
    length: 37.5, beam: 7.2, draft: 3.0, airDraft: 19, mooring: 'kai', crew: [18, 28],
    shape: 'klassische Dampfyacht: dunkelblauer Rumpf mit Goldstreifen, Klipperbug, cremefarbene Aufbauten, gelber Schornstein, zwei Masten mit Standarte',
    palettes: [pal({ hull: '#1f3354', boot: '#8a2f2f', stripe: '#d9b44a', deck: '#d8a870', house: '#f5ecd6', trim: '#d9b44a', glass: '#3e5e7a', sail: '#f5ecd6', spar: '#a8744c', accent: '#f2c14e' })],
  },
];

export const MODEL_BY_ID = Object.fromEntries(MODELS.map((m) => [m.id, m]));

/** Modell eines Besuchers (Schlüssel wie in ECONOMY.besucher.schiffe). */
export const MODELL_VON = Object.fromEntries(MODELS.map((m) => [m.besucher, m]));
