// Optik der beiden Reviere (Spieldaten und Regeln: web/js/data/regions.js, docs/regionen.md).
// Beide Reviere nutzen dieselbe Hafenlage (Festland, Binnensee, Nehrung, offene See),
// damit Stege, Liegeplätze und Gebäude überall an derselben Stelle passen.
//
// Farben sind sRGB-Hexwerte im Flat-Vector-Stil (Pastell, wenig Sättigung).

export const REGIONEN = {
  ostsee: {
    id: 'ostsee',
    name: 'Ostsee',
    beschreibung: 'Binnensee hinter einer Nehrung mit Dünen und Salzwiesen, Hügelland mit Feldern, Knicks, Buchen- und Kiefernwald, Steilufer und Dorf.',
    // Keine Schärenfelsen: an der deutschen Ostsee gibt es Steilufer und Findlinge (vielfalt.js)
    gelaende: { strandBreite: 13, duenenHoehe: 3.2, huegel: 1.8, felsen: 0 },
    farben: {
      sand: '#f7e4b6', gras: '#b8dca8', duene: '#efdcaa', duenengras: '#cedeaa', fels: '#c2bcb4',
      pflaster: '#eeeae0', steinschuettung: '#a4b4c0', mole: '#aebfcb', deich: '#a8d49a', deichkrone: '#b8dca8',
      salzwiese: '#c4d8a4', watt: '#d6ccae', weg: '#e8e2d2',
      // Abwechslung an Land (vielfalt.js)
      waldboden: '#8fc196', dorf: '#bddca9', heide: '#c9b6c4', kliff: '#d8b48c', feldweg: '#e2d4b6', schilfrand: '#a9cc96',
      raps: '#f0de6e', korn: '#e9d79a', acker: '#cdb594', weide: '#a8d69a', wiese: '#c2e2a6',
    },
    wasser: {
      // flach -> tief, Grenzen bei 1, 2, 3, 4 m
      see: ['#c4e6de', '#9ed8d8', '#84cbd0', '#70bec8', '#62b4c2'],
      binnen: ['#cce8d4', '#aedac8', '#94ccbe', '#7ebeb6', '#6cb2b0'],
      schaum: '#ffffff',
      striche: '#ffffff',
    },
    // kiefer: Anteil Nadelbäume, birke: Anteil heller Stämme bei Laubbäumen
    pflanzen: { kiefer: 0.55, birke: 0.35, dichte: 1.0, duenengras: 1.0, schilf: 1.0, findlinge: 0.35, knicks: 1.0, dorf: 1.0 },
    baumfarben: ['#4f9a78', '#5aa580', '#468e70', '#6cb08a'],
    laubfarben: ['#78b878', '#8cc282', '#6aa86e', '#9cc884'],
  },
  nordsee: {
    id: 'nordsee',
    name: 'Nordsee',
    beschreibung: 'Grüner Deich, hohe Dünen, Salzwiesen, weites Watt mit Priel vor der Einfahrt, graueres Wasser und Gezeiten.',
    gelaende: {
      strandBreite: 20, duenenHoehe: 5.5, huegel: 0, felsen: 0,
      wattBreite: 60, deich: { y: -110, breite: 16, hoehe: 5.0 },
      landPlus: 1.8,     // Bauwerke und Hinterland liegen höher, damit die Flut sie nicht erreicht
      gezeiten: 1.8,     // größter Ausschlag des Pegels in Metern
    },
    farben: {
      sand: '#f2e2bc', gras: '#b4d6a0', duene: '#ecdcb0', duenengras: '#c6d6a0', fels: '#a0acb4',
      pflaster: '#ece8e0', steinschuettung: '#9eacb6', mole: '#a8b6c0', deich: '#a6d092', deichkrone: '#bcdca8',
      salzwiese: '#bed4a0', watt: '#c2b598', weg: '#e4dfd2',
      waldboden: '#94c29a', dorf: '#b8d8a4', heide: '#c4b4bc', kliff: '#cdb08e', feldweg: '#ded2b8', schilfrand: '#a6c894',
      raps: '#eedc78', korn: '#e4d49e', acker: '#c8b49a', weide: '#a6d294', wiese: '#bcdca2',
    },
    wasser: {
      see: ['#d4e2cc', '#b6d4c6', '#9cc4bc', '#86b4b0', '#74a6a6'],
      binnen: ['#cfe4d0', '#b0d6c4', '#96c8ba', '#82bab0', '#72aca8'],
      schaum: '#fbfaf2',
      striche: '#f6f8f2',
    },
    // Windschiefer Weißdorn und Pappeln statt Wald
    pflanzen: { kiefer: 0, birke: 0, pappel: 0.4, windschief: true, dichte: 0.35, duenengras: 1.6, schilf: 1.2, findlinge: 0.1, knicks: 0.35, dorf: 1.0 },
    baumfarben: ['#5a9a7a'],
    laubfarben: ['#7eb47a', '#8cbc80', '#94b878'],
  },
};

export const REGION_STANDARD = 'ostsee';

export function region(name) {
  return REGIONEN[name] || REGIONEN[REGION_STANDARD];
}
