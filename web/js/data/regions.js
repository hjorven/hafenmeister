// Hafenmeister: die zwei Reviere Ostsee und Nordsee (Hafenregionen) als Spieldaten.
// Beschreibung der Felder und der Spielidee: docs/regionen.md
// Farben sind Hex-Strings fuer Three.js. Schiffsarten wie im Katalog (S1 bis XL3), XXL mit Namen.
// Gebaeude und Stimmung sind in beiden Revieren ein Mix aus deutschen, daenischen und schwedischen
// Haefen (Entscheidung Jorven, 11.11.2026, docs/plan.md Abschnitt 9).
// Neue Felder nur anhaengen. Aendert sich die Bedeutung eines Feldes, REVIER_FORMAT hochzaehlen.

// 2 (P57): wasser.tide ist nur noch true/null, die Zahlen stehen in ECONOMY.nordsee
// 3 (P57 Teil 6): kuesten neu; spiel und schiffe entfernt (die Zahlen stehen in ECONOMY.nordsee: Revierfaktoren,
//   Bootsarten, Startgeld), freischalten.stufe steht in ECONOMY.nordsee.start.
// Das Spiel liest: id, name, hafenname, freischalten, kuesten, farben, licht, wasser. Die übrigen Felder
// (vorbilder, karte, kueste, bauweise, natur, wetter, platzarten, dienste, bauprojekte, ereignisse, musik)
// beschreiben das Revier für Ideen und Modelle, das Spiel liest sie nicht (docs/regionen.md).
export const REVIER_FORMAT = 3;

export const REVIER_REIHENFOLGE = ['ostsee', 'nordsee'];

export const REVIERE = {
  ostsee: {
    id: 'ostsee',
    name: 'Deutsche Ostsee',
    hafenname: 'Dünenhafen',
    vorbilder: ['Burgtiefe (Fehmarn)', 'Heiligenhafen', 'Marstal (Ærø)', 'Svendborg', 'Smögen', 'Sandhamn'],
    freischalten: { start: true },
    karte: 'nehrung',
    kueste: { typ: 'nehrung', text: 'Binnensee hinter einer Nehrung mit Dünen und Strand, Schärenfelsen am Rand, dahinter die offene Ostsee' },
    farben: {
      wasserTief: '#62b4c2', wasserFlach: '#9ccfc0', strand: '#f7e4b6', wiese: '#b8dca8',
      fels: '#a9a39a', himmel: '#8fd0dc', dunst: '#cfe8ec',
    },
    licht: {
      tag: { himmel: '#ffffff', boden: '#88aabb', sonne: '#fff4e0', staerke: 1.4, dunst: 900 },
      abend: { himmel: '#ffd2a8', boden: '#4a5a7a', sonne: '#ff9a5c', staerke: 0.8, dunst: 600 },
    },
    bauweise: {
      // weiss (Baeder), Backstein (DE), gelb und ocker (DK), falunrot (SE)
      waende: ['#fbf7ef', '#b5533c', '#f2c94c', '#e3a857', '#8e2b22'],
      daecher: ['#a8443a', '#8f7a55', '#3b3b3f'],
      dachformen: ['satteldach', 'reetdach', 'walmdach', 'krueppelwalm'],
      holz: '#e2b67e', akzent: '#3f7fb5', fensterAbend: '#ffd77a', fahne: ['#ffffff', '#3f7fb5'],
      typisch: ['Bäderarchitektur mit weißen Balkonen', 'Backstein mit roten Ziegeln', 'Fischerkate mit Reetdach',
        'gelbes Fachwerk mit schwarzen Balken', 'falunrote Holzhäuser mit weißen Ecken', 'Bootsschuppen in Reihe an einer Holzpromenade'],
    },
    natur: {
      baeume: ['kiefer', 'birke', 'buche'],
      pflanzen: ['strandhafer', 'kartoffelrose', 'heckenrose', 'heidekraut'],
      tiere: ['moewe', 'schwan', 'eiderente'],
      deko: ['strandkorb-blau', 'strandkorb-gruen', 'duenenzaun', 'rettungsring', 'findling', 'fahrrad', 'fahnenmast', 'mittsommerbaum'],
    },
    wasser: { wellen: 0.3, farbeSchaum: '#ffffff', tide: null },
    wetter: { windMittel: 3, sturm: 0.03, nebel: 0.03, regen: 0.12 },
    // Küstentypen (render/landschaft/natur.js), aus denen ein neuer Hafen hier wählt: alle
    kuesten: null,
    platzarten: ['fels', 'boje'],
    dienste: ['strandkorbvermietung', 'eisdiele', 'fischbroetchen', 'raeucherei', 'fahrradverleih', 'saunafloss'],
    bauprojekte: ['durchstich', 'seebruecke', 'bojenfeld'],
    ereignisse: ['segelwoche', 'hafenfest', 'holzbootfestival', 'mittsommerfest', 'sommergewitter', 'kreuzfahrttag'],
    musik: { stimmung: 'sonnig, leicht, gemütlich', instrumente: ['akustikgitarre', 'akkordeon', 'glockenspiel', 'geige'], geraeusche: ['moewen', 'brandung-leise', 'fallen-klappern', 'fahnenleine'] },
  },

  nordsee: {
    id: 'nordsee',
    name: 'Nordsee',
    hafenname: 'Sielhafen',
    vorbilder: ['Neuharlingersiel', 'Greetsiel', 'Büsum'],
    // Stufe und Startgeld: ECONOMY.nordsee.start (save/reviere.js)
    freischalten: { nach: 'ostsee' },
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
      // Ebbe und Flut: die Zahlen stehen in ECONOMY.nordsee.gezeiten (data/economy.js), die Rechnung in
      // features/gezeiten-regeln.js (P57, docs/nordsee.md)
      tide: true,
    },
    wetter: { windMittel: 5, sturm: 0.07, nebel: 0.1, regen: 0.18 },
    // Küstentypen der Nordsee (P57 Teil 6): Watt mit Halligen, Flussmündung (Sielhafen an Ems, Weser, Elbe),
    // Nehrung (Barriereinseln wie die Ostfriesischen Inseln), Inselhafen, Strandhaken (wie der Ellenbogen auf Sylt).
    // Schären, Förde, Bodden, Steilküste und die echten Karten 11 bis 15 gibt es nur an der Ostsee.
    kuesten: [7, 3, 1, 10, 9],
    platzarten: ['trockenfallen'],
    dienste: ['fischbroetchen', 'krabbenverkauf', 'wattfuehrung', 'inselfaehre'],
    bauprojekte: ['schleuse', 'deichtor'],
    ereignisse: ['sturmflut', 'kutterkorso', 'krabbenfest', 'kreuzfahrttag'],
    musik: { stimmung: 'rau, weit, warm', instrumente: ['akkordeon', 'tinwhistle', 'kontrabass'], geraeusche: ['austernfischer', 'wind', 'kutterdiesel', 'wattknistern'] },
  },
};
