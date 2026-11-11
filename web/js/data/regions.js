// Hafenmeister: die vier Reviere (Hafenregionen) als Spieldaten.
// Beschreibung der Felder und der Spielidee: docs/regionen.md
// Farben sind Hex-Strings fuer Three.js. Schiffsarten wie im Katalog (S1 bis XL3), XXL mit Namen.
// Neue Felder nur anhaengen. Aendert sich die Bedeutung eines Feldes, REVIER_FORMAT hochzaehlen.

export const REVIER_FORMAT = 1;

export const REVIER_REIHENFOLGE = ['ostsee', 'daenemark', 'schweden', 'nordsee'];

export const REVIERE = {
  ostsee: {
    id: 'ostsee',
    name: 'Deutsche Ostsee',
    hafenname: 'Dünenhafen',
    vorbilder: ['Burgtiefe (Fehmarn)', 'Kühlungsborn', 'Heiligenhafen'],
    freischalten: { start: true },
    karte: 'nehrung',
    kueste: { typ: 'nehrung', text: 'Binnensee hinter einer Nehrung mit Dünen und Strand, dahinter die offene Ostsee' },
    farben: {
      wasserTief: '#62b4c2', wasserFlach: '#9ccfc0', strand: '#f7e4b6', wiese: '#b8dca8',
      fels: '#a9a39a', himmel: '#8fd0dc', dunst: '#cfe8ec',
    },
    licht: {
      tag: { himmel: '#ffffff', boden: '#88aabb', sonne: '#fff4e0', staerke: 1.4, dunst: 900 },
      abend: { himmel: '#ffd2a8', boden: '#4a5a7a', sonne: '#ff9a5c', staerke: 0.8, dunst: 600 },
    },
    bauweise: {
      waende: ['#fbf7ef', '#f4ede0', '#b5533c'],
      daecher: ['#a8443a', '#8f7a55', '#5b5f66'],
      dachformen: ['satteldach', 'reetdach', 'walmdach'],
      holz: '#e2b67e', akzent: '#3f7fb5', fensterAbend: '#ffd77a', fahne: ['#000000', '#dd0000', '#ffce00'],
      typisch: ['Bäderarchitektur mit weißen Balkonen', 'Backstein mit roten Ziegeln', 'Fischerkate mit Reetdach'],
    },
    natur: {
      baeume: ['kiefer', 'birke'],
      pflanzen: ['strandhafer', 'kartoffelrose'],
      tiere: ['moewe', 'schwan'],
      deko: ['strandkorb-blau', 'strandkorb-gruen', 'duenenzaun', 'rettungsring'],
    },
    wasser: { wellen: 0.3, farbeSchaum: '#ffffff', tide: null },
    wetter: { windMittel: 3, sturm: 0.03, nebel: 0.03, regen: 0.12 },
    schiffe: {
      haeufigkeit: { S1: 1.3, S2: 1.5, S4: 1.2, S5: 1.2, M2: 0.8, XL1: 0.8 },
      abStufe: {},
    },
    spiel: { hafengeld: 1.0, ankuenfte: 1.0, naechte: [1, 3], abendAnteil: 0.25, startgeld: 500 },
    platzarten: [],
    dienste: ['strandkorbvermietung', 'eisdiele', 'fischbroetchen'],
    bauprojekte: ['durchstich', 'seebruecke'],
    ereignisse: ['segelwoche', 'hafenfest', 'sommergewitter', 'kreuzfahrttag'],
    musik: { stimmung: 'sonnig, leicht', instrumente: ['akustikgitarre', 'glockenspiel', 'ukulele'], geraeusche: ['moewen', 'brandung-leise', 'fallen-klappern'] },
  },

  daenemark: {
    id: 'daenemark',
    name: 'Dänemark',
    hafenname: 'Fjordhafen',
    vorbilder: ['Svendborg', 'Faaborg', 'Marstal (Ærø)', 'Mariager'],
    freischalten: { nach: 'ostsee', stufe: 5 },
    karte: 'nehrung',
    kueste: { typ: 'fjord', text: 'schmaler Fjord mit grünen Hängen und Buchenwald, Lehmkliffs, Steinmolen, kleine Inseln vor der Mündung' },
    farben: {
      wasserTief: '#4fa3b4', wasserFlach: '#a6d8c8', strand: '#f3e2b8', wiese: '#a9d39a',
      fels: '#b7ad9c', himmel: '#9fd2e0', dunst: '#d9ecee',
    },
    licht: {
      tag: { himmel: '#ffffff', boden: '#8aae9e', sonne: '#fff6e6', staerke: 1.35, dunst: 850 },
      abend: { himmel: '#ffc9b0', boden: '#4b5876', sonne: '#ff8f6a', staerke: 0.75, dunst: 550 },
    },
    bauweise: {
      waende: ['#f2c94c', '#e3a857', '#f7f3ea', '#e9b6a6'],
      daecher: ['#b2473a', '#8f7a55', '#3a3a3a'],
      dachformen: ['satteldach', 'reetdach', 'krueppelwalm'],
      holz: '#2e2a28', akzent: '#c8102e', fensterAbend: '#ffd98a', fahne: ['#c8102e', '#ffffff'],
      typisch: ['gelbes Fachwerk mit schwarzen Balken', 'rote Dachziegel', 'schwarz geteerte Bootsschuppen'],
    },
    natur: {
      baeume: ['buche', 'weide', 'holunder'],
      pflanzen: ['heckenrose', 'mohn'],
      tiere: ['schwan', 'moewe', 'kuh-fern'],
      deko: ['findling', 'fahrrad', 'fahnenmast', 'holzbank'],
    },
    wasser: { wellen: 0.25, farbeSchaum: '#ffffff', tide: null },
    wetter: { windMittel: 4, sturm: 0.04, nebel: 0.05, regen: 0.15 },
    schiffe: {
      haeufigkeit: { S4: 1.3, M1: 1.4, M2: 1.8, L1: 1.4, S5: 0.7, L3: 0.6, XL1: 2.0, XL2: 0.5 },
      abStufe: { XL1: 4 },
    },
    spiel: { hafengeld: 0.85, ankuenfte: 1.25, naechte: [1, 1], abendAnteil: 0.25, startgeld: 800 },
    platzarten: [],
    dienste: ['wuerstchenbude', 'fahrradverleih', 'raeucherei', 'inselfaehre'],
    bauprojekte: ['steinmole', 'faehranleger'],
    ereignisse: ['holzbootfestival', 'mittsommerfeuer', 'hafenfest', 'kreuzfahrttag'],
    musik: { stimmung: 'gemütlich, hyggelig', instrumente: ['akkordeon', 'geige', 'klavier'], geraeusche: ['moewen', 'fahnenleine', 'fahrradklingel'] },
  },

  schweden: {
    id: 'schweden',
    name: 'Schwedische Schären',
    hafenname: 'Felsenhafen',
    vorbilder: ['Smögen', 'Marstrand', 'Sandhamn'],
    freischalten: { nach: 'daenemark', stufe: 5 },
    karte: 'nehrung',
    kueste: { typ: 'schaeren', text: 'glatt geschliffener rosa-grauer Granit, Kiefern in Felsspalten, tiefes Wasser bis an den Fels' },
    farben: {
      wasserTief: '#3f8fb0', wasserFlach: '#6fb3c4', strand: '#e8d6b0', wiese: '#8fc08a',
      fels: '#b9a39b', himmel: '#86c6e0', dunst: '#d3e6ef',
    },
    licht: {
      tag: { himmel: '#ffffff', boden: '#7c9aa8', sonne: '#fff8ea', staerke: 1.45, dunst: 1100 },
      abend: { himmel: '#ffd9a0', boden: '#55607e', sonne: '#ffb25c', staerke: 0.95, dunst: 800 },
    },
    bauweise: {
      waende: ['#8e2b22', '#a33a2c', '#f4f1ea', '#e8c65a'],
      daecher: ['#3b3b3f', '#8e2b22', '#4f5a4a'],
      dachformen: ['satteldach', 'pultdach'],
      holz: '#c79a6b', akzent: '#006aa7', fensterAbend: '#ffe3a0', fahne: ['#006aa7', '#fecc02'],
      typisch: ['falunrote Holzhäuser mit weißen Ecken', 'Bootshäuser auf Pfählen', 'Stege direkt am Fels'],
    },
    natur: {
      baeume: ['kiefer', 'birke', 'wacholder'],
      pflanzen: ['moos', 'heidekraut', 'grasnelke'],
      tiere: ['moewe', 'eiderente', 'seeadler-fern'],
      deko: ['felsring', 'mittsommerbaum', 'ruderboot-kieloben', 'briefkasten-gelb'],
    },
    wasser: { wellen: 0.35, farbeSchaum: '#f4fbff', tide: null },
    wetter: { windMittel: 4, sturm: 0.04, nebel: 0.08, regen: 0.12 },
    schiffe: {
      haeufigkeit: { S1: 1.2, S3: 1.3, M1: 1.2, L1: 1.5, L3: 1.2, S2: 0.6, M4: 0.7 },
      abStufe: { L1: 2, L3: 2 },
    },
    spiel: { hafengeld: 1.1, ankuenfte: 0.9, naechte: [1, 4], abendAnteil: 0.35, startgeld: 1000 },
    platzarten: ['fels', 'boje'],
    dienste: ['saunafloss', 'raeucherei', 'pontontankstelle'],
    bauprojekte: ['felssprengung', 'bojenfeld'],
    ereignisse: ['mittsommerfest', 'schaerenregatta', 'morgennebel', 'kreuzfahrttag'],
    musik: { stimmung: 'weit, ruhig, golden', instrumente: ['nyckelharpa', 'harfe', 'klarinette'], geraeusche: ['moewen', 'wellen-am-fels', 'kiefernwind'] },
  },

  nordsee: {
    id: 'nordsee',
    name: 'Nordsee',
    hafenname: 'Sielhafen',
    vorbilder: ['Neuharlingersiel', 'Greetsiel', 'Büsum'],
    freischalten: { nach: 'schweden', stufe: 5 },
    karte: 'nehrung',
    kueste: { typ: 'deich-watt', text: 'grüner Deich mit Schafen, Salzwiesen, Watt mit Prielen, der Hafen liegt hinter dem Siel' },
    farben: {
      wasserTief: '#6f9faa', wasserFlach: '#93b8b6', strand: '#ead9ad', wiese: '#9cc47f',
      fels: '#8f8a82', watt: '#a89f86', himmel: '#a7c8d4', dunst: '#dde6e6',
    },
    licht: {
      tag: { himmel: '#f4f8fa', boden: '#8d9c9c', sonne: '#fff2dc', staerke: 1.25, dunst: 650 },
      abend: { himmel: '#f2c4a8', boden: '#4a5466', sonne: '#ff8a5a', staerke: 0.7, dunst: 450 },
    },
    bauweise: {
      waende: ['#9b4a35', '#7f3a2c', '#f2efe8'],
      daecher: ['#a8443a', '#3e4047', '#8f7a55'],
      dachformen: ['satteldach', 'reetdach', 'giebelfront'],
      holz: '#d7b98a', akzent: '#c8393b', fensterAbend: '#ffd27a', fahne: ['#000000', '#dd0000', '#ffce00'],
      typisch: ['dunkelroter Klinker', 'Giebelhäuser am Hafen', 'rot-weißer Leuchtturm', 'Siel mit Tor im Deich'],
    },
    natur: {
      baeume: ['weissdorn-windschief', 'pappel'],
      pflanzen: ['strandflieder', 'queller', 'salzwiese'],
      tiere: ['schaf', 'austernfischer', 'seehund-fern'],
      deko: ['leuchtturm', 'pegel', 'krabbenkorb', 'kutternetz', 'deichtor'],
    },
    wasser: {
      wellen: 0.45,
      farbeSchaum: '#f1f0e8',
      // Tidenhub in Metern, Periode in Spieltagen (1 Spieltag = 2 Minuten), Spring-Nipp-Zyklus in Spieltagen
      tide: { hub: 2.8, periodeTage: 1.035, springNippTage: 15, springFaktor: 0.2, phase: 0 },
    },
    wetter: { windMittel: 5, sturm: 0.07, nebel: 0.1, regen: 0.18 },
    schiffe: {
      haeufigkeit: { M4: 2.0, L4: 1.6, M3: 1.2, L2: 0.4, L1: 0.7, XL3: 1.5, 'Seenotrettungskreuzer': 1.5 },
      abStufe: { M4: 1, L4: 3 },
    },
    spiel: { hafengeld: 1.15, ankuenfte: 0.9, naechte: [1, 3], abendAnteil: 0.25, startgeld: 1200 },
    platzarten: ['trockenfallen'],
    dienste: ['fischbroetchen', 'krabbenverkauf', 'wattfuehrung', 'inselfaehre'],
    bauprojekte: ['schleuse', 'deichtor'],
    ereignisse: ['sturmflut', 'kutterkorso', 'krabbenfest', 'kreuzfahrttag'],
    musik: { stimmung: 'rau, weit, warm', instrumente: ['akkordeon', 'tinwhistle', 'kontrabass'], geraeusche: ['austernfischer', 'wind', 'kutterdiesel', 'wattknistern'] },
  },
};
