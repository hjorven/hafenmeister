// Texte der seltenen Besucher (Paket P40, Roadmap F16, docs/besucher.md). Zahlen stehen in
// data/economy.js (besucher), Modelle in data/boats/besucher.js. Kein Three.js, keine Oberfläche.
//
//   titel      Name im Logbuch und in Meldungen
//   artikel    "die" / "der" für Sätze ("Die Königsyacht läuft ein")
//   namen      Schiffsnamen, einer je Besuch (fest aus Seed und Tag)
//   heimat     Heimathäfen (leer: keiner genannt)
//   kommt      Satz der Ankündigung am Morgen
//   platz      warum der Ehrenplatz (Satz in der Ankündigung und im Steckbrief)
//   fest       Satz, wenn es am Ehrenplatz liegt
//   anderswo   Satz, wenn es woanders liegt
//   chronik    Zeile im Logbuch (Hafenchronik), {name} wird ersetzt
//   hinweis    Schattenriss im Logbuch: wann und wo es kommt

export const SCHIFF_TEXTE = {
  weltumsegler: {
    titel: 'Weltumsegler', artikel: 'der',
    namen: ['Albatros', 'Passatwind', 'Fernweh', 'Sturmvogel', 'Kap Hoorn', 'Südkreuz', 'Wanderer', 'Seeschwalbe'],
    heimat: ['Auckland', 'Kapstadt', 'Hobart', 'Halifax', 'Valparaíso', 'Falmouth'],
    kommt: 'Nach drei Jahren rund um die Welt ist das Ziel fast erreicht.',
    platz: 'Die Crew ist müde und möchte längsseits am Stegkopf liegen, wo alle das Schiff sehen.',
    fest: 'Am Stegkopf erzählt die Crew von Kap Hoorn und der Südsee.',
    anderswo: 'Die Crew hätte gern am Stegkopf gelegen.',
    chronik: 'Der Weltumsegler „{name}“ hat bei uns festgemacht.',
    hinweis: 'Kommt ab Stufe 2, selten. Möchte längsseits am Stegkopf liegen.',
  },
  museumsschiff: {
    titel: 'Museumsdampfer', artikel: 'der',
    namen: ['Seebär', 'Hertha', 'Kehrwieder', 'Greif', 'Frieda', 'Nordlicht'],
    heimat: ['Museumshafen'],
    kommt: 'Ein Dampfer von 1908 macht seine Sommerreise, mit Kohlen und Pfeife.',
    platz: 'Besucher sollen an Bord kommen: Er möchte längsseits am Stegkopf liegen.',
    fest: 'Am Stegkopf pfeift der Dampfer, Besucher kommen an Bord.',
    anderswo: 'Der Kapitän hätte das Schiff gern am Stegkopf gezeigt.',
    chronik: 'Der Museumsdampfer „{name}“ war zu Gast, Besucher kamen an Bord.',
    hinweis: 'Kommt ab Stufe 3, selten. Möchte längsseits am Stegkopf liegen.',
  },
  forschungsschiff: {
    titel: 'Forschungskutter', artikel: 'der',
    namen: ['Meereskunde', 'Seegras', 'Ostseeauge', 'Littorale', 'Tiefenblick'],
    heimat: ['Kiel', 'Rostock', 'Greifswald'],
    kommt: 'Forscher zählen Seegras und Heringe vor unserer Küste.',
    platz: 'Die Geräte brauchen Strom: Er möchte längsseits am Stegkopf liegen, mit Strom und Netz.',
    fest: 'Am Stegkopf laden die Forscher ihre Proben aus.',
    anderswo: 'Die Forscher hätten gern am Stegkopf gelegen.',
    chronik: 'Der Forschungskutter „{name}“ war zum Messen bei uns.',
    hinweis: 'Kommt ab Stufe 4, selten. Möchte längsseits am Stegkopf liegen, mit Strom.',
  },
  koenigsyacht: {
    titel: 'Königsyacht', artikel: 'die',
    namen: ['Nordstern', 'Krone des Nordens', 'Sommerresidenz'],
    heimat: [],
    kommt: 'Die königliche Familie ist auf Sommerreise und besucht unseren Hafen.',
    platz: 'Sie möchte am Kai liegen, mit Strom und Wasser, und die Gäste wollen gut essen.',
    fest: 'Am Kai wehen die Standarten, der ganze Ort kommt schauen.',
    anderswo: 'Am Kai hätte die Königsyacht besser gelegen.',
    chronik: 'Die Königsyacht „{name}“ lag bei uns, der ganze Ort kam schauen.',
    hinweis: 'Kommt ab Stufe 5, selten. Möchte am Kai liegen.',
  },
};

export const TIER_TEXTE = {
  schwaene: {
    titel: 'Schwanenfamilie', artikel: 'die',
    kommt: 'Eine Schwanenfamilie schwimmt durch den Hafen.',
    chronik: 'Eine Schwanenfamilie schwamm durch den Hafen.',
    hinweis: 'Im Frühling und Sommer, an manchen Tagen.',
  },
  schweinswal: {
    titel: 'Schweinswal', artikel: 'der',
    kommt: 'Ein Schweinswal taucht vor der Einfahrt auf.',
    chronik: 'Vor der Einfahrt tauchte ein Schweinswal auf.',
    hinweis: 'Ab Stufe 3, wenn der Hafen zur See offen ist. Selten.',
  },
};

// Hafentiere (Paket P51, Roadmap F38, docs/hafentiere.md): wohnen im Hafen und sind jeden Tag da,
// man muss sie nur finden (heranzoomen). Grafik und Verhalten: render/hafentiere.js.
//   stufe   ab welcher Ausbaustufe es da ist
export const HAFENTIER_TEXTE = {
  katze: {
    titel: 'Hafenkatze', artikel: 'die', stufe: 1,
    kommt: 'Wohnt am Hafenbüro, schaut morgens bei den Booten vorbei und schläft mittags in der Sonne. Nachts leuchten ihre Augen.',
    chronik: 'Im Hafen entdeckt: die Hafenkatze. Sie wohnt am Hafenbüro.',
    hinweis: 'Wohnt am Hafenbüro. Heranzoomen, sie ist klein.',
  },
  hund: {
    titel: 'Hafenhund', artikel: 'der', stufe: 2,
    kommt: 'Begrüßt jedes Boot, das festmacht, und geht abends mit dem Hafenmeister über die Stege.',
    chronik: 'Im Hafen entdeckt: der Hafenhund. Er begrüßt jedes Boot.',
    hinweis: 'Ab Stufe 2. Ist dort, wo gerade ein Boot festmacht.',
  },
  reiher: {
    titel: 'Graureiher', artikel: 'der', stufe: 1,
    kommt: 'Steht reglos im flachen Wasser am Ufer und fischt. Kommt ein Boot zu nah, fliegt er auf.',
    chronik: 'Im Hafen entdeckt: ein Graureiher, er fischt am Ufer.',
    hinweis: 'Tagsüber im flachen Wasser am Ufer. Fliegt auf, wenn Boote zu nah kommen.',
  },
};
export const HAFENTIERE = Object.keys(HAFENTIER_TEXTE);

/** Reihenfolge im Logbuch: erst die Schiffe nach Stufe, dann die Tiere. Nur seltene Besucher (Fotoalbum). */
export const MOTIVE = ['weltumsegler', 'museumsschiff', 'forschungsschiff', 'koenigsyacht', 'schwaene', 'schweinswal'];
/** Alle Fotomotive mit Eintrag im Spielstand (seltene Besucher und Hafentiere). */
export const ALLE_MOTIVE = [...MOTIVE, ...HAFENTIERE];

export const istTier = (art) => art in TIER_TEXTE;
export const istHafentier = (art) => art in HAFENTIER_TEXTE;
export const texteVon = (art) => SCHIFF_TEXTE[art] ?? TIER_TEXTE[art] ?? HAFENTIER_TEXTE[art] ?? null;
