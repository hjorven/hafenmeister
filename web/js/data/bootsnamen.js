// Namen am Heck und Heimathäfen für Gastboote (Stammgäste, docs/neue-features.md Abschnitt 4).
// Typische Bootsnamen an Ost- und Nordsee, keine Personen. Heimathäfen sind echte Häfen.
// HEIMATHAEFEN ist die alte Gesamtliste; neue Boote nutzen heimathaefen(region, groesse) weiter unten.

export const BOOTSNAMEN = [
  'Möwe', 'Seeschwalbe', 'Kormoran', 'Austernfischer', 'Eiderente', 'Lachmöwe', 'Kiebitz', 'Strandläufer',
  'Butt', 'Hering', 'Dorsch', 'Sprotte', 'Seestern', 'Qualle', 'Krabbe', 'Muschel',
  'Brise', 'Nordwind', 'Ostwind', 'Westwind', 'Flaute', 'Kabbelwasser', 'Dünung', 'Gischt',
  'Leuchtfeuer', 'Seezeichen', 'Tonne 7', 'Kompass', 'Sextant', 'Logge', 'Lot', 'Klabautermann',
  'Hafenkind', 'Fernweh', 'Heimweh', 'Freiheit', 'Sorgenfrei', 'Feierabend', 'Sommerwind', 'Abendrot',
  'Morgenrot', 'Mittsommer', 'Polarstern', 'Nordlicht', 'Sternschnuppe', 'Mondschein', 'Sonnenschein', 'Regenbogen',
  'Bernstein', 'Kieselstein', 'Strandgut', 'Treibholz', 'Düne', 'Nehrung', 'Bodden', 'Förde',
  'Schäre', 'Holm', 'Sandbank', 'Priel', 'Watt', 'Hallig', 'Fischkutter', 'Seebär',
  'Kleiner Bär', 'Albatros', 'Pinguin', 'Seehund', 'Schweinswal', 'Kegelrobbe', 'Delfin', 'Lotse',
  'Matrose', 'Moses', 'Smutje', 'Ankerplatz', 'Achterwind', 'Halbwind', 'Raumschots', 'Hart am Wind',
  'Wellenreiter', 'Wogenspiel', 'Seemannsgarn', 'Labskaus', 'Rumtopf', 'Grog', 'Fischbrötchen', 'Pottwal',
];

export const HEIMATHAEFEN = [
  // Deutsche Ostsee
  'Flensburg', 'Kappeln', 'Eckernförde', 'Kiel', 'Laboe', 'Heiligenhafen', 'Fehmarn', 'Neustadt',
  'Travemünde', 'Wismar', 'Kühlungsborn', 'Warnemünde', 'Stralsund', 'Greifswald', 'Lauterbach', 'Ueckermünde',
  // Dänemark
  'Sønderborg', 'Ærøskøbing', 'Marstal', 'Svendborg', 'Faaborg', 'Bagenkop', 'Kerteminde', 'Helsingør',
  // Schweden
  'Ystad', 'Simrishamn', 'Karlskrona', 'Kalmar', 'Visby', 'Mönsterås',
  // Nordsee
  'Husum', 'Büsum', 'Cuxhaven', 'Helgoland', 'Norderney', 'Borkum', 'Wilhelmshaven', 'Hooksiel', 'Esbjerg', 'Den Helder',
];

// Woher ein Boot kommt, hängt von seiner Größe ab: Kleine Boote kommen aus der Nähe, große auch von weit her.
// Der eigene Hafen liegt an der Ostsee bei Fehmarn (Vorbild Burgtiefe, docs/vorbilder.md),
// an der Nordsee an der nordfriesischen Küste.
export const HEIMAT_NACH_REGION = {
  ostsee: {
    nah: ['Heiligenhafen', 'Burgstaaken', 'Orth', 'Großenbrode', 'Lemkenhafen', 'Grömitz', 'Dahme', 'Neustadt'],
    mittel: ['Kiel', 'Laboe', 'Eckernförde', 'Kappeln', 'Flensburg', 'Travemünde', 'Wismar', 'Kühlungsborn',
      'Warnemünde', 'Bagenkop', 'Marstal', 'Ærøskøbing', 'Rødbyhavn'],
    fern: ['Stralsund', 'Greifswald', 'Lauterbach', 'Ueckermünde', 'Sønderborg', 'Svendborg', 'Faaborg',
      'Kerteminde', 'Helsingør', 'Ystad', 'Simrishamn', 'Karlskrona', 'Kalmar', 'Visby', 'Mönsterås'],
  },
  nordsee: {
    nah: ['Husum', 'Tönning', 'Büsum', 'Friedrichskoog', 'Nordstrand', 'Pellworm', 'Wyk auf Föhr'],
    mittel: ['Cuxhaven', 'Helgoland', 'Wittdün', 'Hörnum', 'List', 'Brunsbüttel', 'Wilhelmshaven', 'Hooksiel', 'Norderney'],
    fern: ['Borkum', 'Esbjerg', 'Hvide Sande', 'Den Helder', 'Kiel', 'Flensburg'],
  },
};

// Welche Ringe eine Größe nutzt: S nur aus der Nähe, XL von überall
const RINGE = { S: ['nah'], M: ['nah', 'mittel'], L: ['mittel', 'fern'], XL: ['mittel', 'fern'] };

/** Heimathäfen, die zu Region und Bootsgröße passen. */
export function heimathaefen(region, groesse) {
  const r = HEIMAT_NACH_REGION[region] || HEIMAT_NACH_REGION.ostsee;
  return (RINGE[groesse] || RINGE.M).flatMap((ring) => r[ring]);
}
