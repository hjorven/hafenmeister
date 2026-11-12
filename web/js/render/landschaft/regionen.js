// Optik der beiden Reviere (Spieldaten und Regeln: web/js/data/regions.js, docs/regionen.md).
// Beide Reviere nutzen dieselbe Hafenlage (Festland, Binnensee, Nehrung, offene See),
// damit Stege, Liegeplätze und Gebäude überall an derselben Stelle passen.
//
// Farben sind sRGB-Hexwerte im Flat-Vector-Stil (Pastell, wenig Sättigung).

export const REGIONEN = {
  ostsee: {
    name: 'Ostsee',
    beschreibung: 'Binnensee hinter einer Nehrung mit Dünen und Salzwiesen, Kiefern, Birken und Buchen, Schärenfelsen am Rand.',
    gelaende: { strandBreite: 13, duenenHoehe: 3.2, huegel: 1.8, felsen: 4.5 },
    farben: {
      sand: '#f7e4b6', gras: '#b8dca8', duene: '#efdcaa', duenengras: '#cedeaa', fels: '#c2bcb4',
      pflaster: '#eeeae0', steinschuettung: '#a4b4c0', mole: '#aebfcb', deich: '#a8d49a', deichkrone: '#b8dca8',
      salzwiese: '#c4d8a4', watt: '#d6ccae', weg: '#e8e2d2',
    },
    wasser: {
      // flach -> tief, Grenzen bei 1, 2, 3, 4 m
      see: ['#c4e6de', '#9ed8d8', '#84cbd0', '#70bec8', '#62b4c2'],
      binnen: ['#cce8d4', '#aedac8', '#94ccbe', '#7ebeb6', '#6cb2b0'],
      schaum: '#ffffff',
      striche: '#ffffff',
    },
    // kiefer: Anteil Nadelbäume, birke: Anteil heller Stämme bei Laubbäumen
    pflanzen: { kiefer: 0.55, birke: 0.35, dichte: 1.0, duenengras: 1.0, schilf: 1.0, findlinge: 0.35 },
    baumfarben: ['#4f9a78', '#5aa580', '#468e70', '#6cb08a'],
    laubfarben: ['#78b878', '#8cc282', '#6aa86e', '#9cc884'],
  },
  nordsee: {
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
    },
    wasser: {
      see: ['#d4e2cc', '#b6d4c6', '#9cc4bc', '#86b4b0', '#74a6a6'],
      binnen: ['#cfe4d0', '#b0d6c4', '#96c8ba', '#82bab0', '#72aca8'],
      schaum: '#fbfaf2',
      striche: '#f6f8f2',
    },
    // Windschiefer Weißdorn und Pappeln statt Wald
    pflanzen: { kiefer: 0, birke: 0, pappel: 0.4, windschief: true, dichte: 0.35, duenengras: 1.6, schilf: 1.2, findlinge: 0.1 },
    baumfarben: ['#5a9a7a'],
    laubfarben: ['#7eb47a', '#8cbc80', '#94b878'],
  },
};

export const REGION_STANDARD = 'ostsee';

export function region(name) {
  return REGIONEN[name] || REGIONEN[REGION_STANDARD];
}
