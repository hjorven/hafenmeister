// Hafenmeister: alle Spielzahlen (Wirtschaft, Fortschritt, Bauwerke, Services, Ereignisse).
//
// Reines Datenmodul ohne Logik. web/js/sim.js und die Services lesen nur von hier, damit
// das Balancing an einer Stelle passiert. Gehört dem Balancing-Thread, siehe
// docs/balancing.md. Prüfen und durchspielen:
//   node tools/balance.mjs --pruefen
//   node tools/balance.mjs
//
// Einheiten: Geld in Euro, Zeit in Spieltagen (1 Spieltag = 120 s bei 1x), Ruf in Ankern 1..5.
// Platz-ids stammen aus web/js/data/harbor.js (erzeugt, nicht von Hand ändern).

export const ECONOMY = {
  format: 1,

  // ---------------------------------------------------------------- Zeit
  zeit: {
    tagSekunden: 90,        // Tag, Boote laufen ein
    abendSekunden: 30,      // Abend, Kassieren
    saisonTage: 30,         // danach Winter
    winterTage: 3,          // keine Gäste
    winterBautempo: 2,      // noch ungenutzt, wie stufen[].ausbau.bautage: Paket P18 nutzt oder löscht beides
    // Saisontage je Jahreszeit [von, bis]
    jahreszeiten: { fruehling: [1, 8], sommer: [9, 22], herbst: [23, 30] },
    erstesBootNach: 3,      // Sekunden: am ersten Tag eines neuen Spiels kommt gleich ein Boot
    // Tagesrhythmus wie im echten Hafen, als Anteile des Tages (0 = Morgen, 1 = Abend):
    // vormittags legen die Gäste ab, neue kommen den ganzen Tag, die meisten am Nachmittag.
    // Keine Wellen: zwischen zwei Ankünften liegen immer mindestens ankunftAbstand Sekunden. Es kommen
    // nie mehr Boote, als so ins Fenster passen (81 s / 3 s = 27), auch nicht an Regattatagen.
    ankunftVon: 0.05,      // etwa 7:15, damit nach dem ersten Boot kein Loch entsteht
    ankunftAbstand: 3,      // Sekunden Mindestabstand zwischen zwei Ankünften (kleiner, wenn der Tag sonst nicht reicht)
    ankunftBis: 0.95,       // etwa 19:30
    ankunftSpitze: 0.62,    // Schwerpunkt am Nachmittag (etwa 15:30), breit verteilt
    abreiseVon: 0.07,       // etwa 7:30
    abreiseBis: 0.3,        // etwa 11:00
  },

  // Warten vor dem Hafen (Wartebojen). geduld = Sekunden an der Boje, bis ein Boot weiterfährt.
  // plaetze = Warteplätze je Stufe; nicht mehr, als die Landschaft Bojen zeichnet
  // (render/landschaft/gelaende.js warteplaetze: Stufe 1 drei, Stufe 2 sechs, Stufe 3 fünf,
  // Stufe 4 sieben, ab Stufe 5 acht).
  // Ohne Hafenbüro fährt ein Boot nach selbstEinfahrenNach Sekunden in eine passende freie Box,
  // mit Hafenbüro sofort in die mit den meisten erfüllten Wünschen.
  warten: {
    geduld: 30,
    plaetze: { 1: 3, 2: 6, 3: 5, 4: 7, 5: 8, 6: 8 },
    selbstEinfahrenNach: 8,   // Sekunden zum Selbstlenken, dann sucht sich das Boot selbst eine freie Box
    ueberNacht: true,         // wer abends noch wartet, bleibt über Nacht an der Boje (ohne Bewertung)
    anfahrtMax: 35,           // meldet die 3D-Ansicht nichts, gilt ein Boot danach als an der Boje
    ausBoxMax: 20,            // ein abreisendes Boot gibt seine Box spätestens nach so vielen Sekunden frei
    vorschau: 3,              // so viele kommende Boote zeigt die Vorschau
    bojengeld: 0.2,           // Anteil des Grundpreises, den ein Boot für die Nacht an der Boje zahlt
  },

  // Passgenau zuweisen (Review A6): Box höchstens ein Fünftel größer als die kleinste Box, an die
  // das Boot passt, bringt einen Viertelanker mehr. Gilt nur, wenn es verschieden große Boxen gibt.
  passgenau: { hoechstensGroesser: 0.2, ruf: 0.25 },

  // Tagestörn: Gäste mit 2 oder mehr Nächten fahren mit dieser Wahrscheinlichkeit tagsüber
  // hinaus und kommen in dieselbe Box zurück (Box bleibt reserviert, Liegegeld zählt weiter).
  // raus und zurueck sind Anteile des Tages.
  tagestoern: { anteil: 0.35, raus: [0.12, 0.3], zurueck: [0.6, 0.85] },

  // ---------------------------------------------------------------- Gäste
  klassen: {
    //      Grundpreis pro Nacht, Nächte [min, max]. Ob ein Boot Motor- oder Segelboot ist, steht im
    //      Bootskatalog (data/boats). Gäste bleiben eher länger (Urlaubstörn), dafür kommen weniger
    //      am Tag: so bleibt der Hafen voll, ohne dass Boote im Sekundentakt einlaufen.
    S:   { grundpreis: 10,  naechte: [1, 3] },
    M:   { grundpreis: 22,  naechte: [2, 4] },
    L:   { grundpreis: 45,  naechte: [2, 5] },
    XL:  { grundpreis: 120, naechte: [1, 3] },
    XXL: { grundpreis: 0,   naechte: [1, 1] },  // kein Liegegeld, Einnahmen je Besuch (services)
  },
  wunschBonus: 0.25,          // Hafengeld = Grundpreis * (1 + wunschBonus * erfüllte Wünsche)

  // Nicht kassierte Münzen: dieser Anteil landet nachts trotzdem in der Kasse (Kasse des Vertrauens,
  // abends sammelt der Hafenmeister-Rundgang ihn ein)
  kassieren: { nachtsAnteil: 0.5 },
  // Passregel: so viel Wasser muss unter dem Kiel bleiben (Meter)
  passregel: { wasserUnterKiel: 0.3 },

  wuensche: {
    //      ab Stufe, welche Klassen ihn haben können, Bauwerk, das ihn erfüllt
    wc:     { abStufe: 1, klassen: ['S', 'M', 'L', 'XL'], durch: 'wc' },
    dusche: { abStufe: 2, klassen: ['S', 'M', 'L', 'XL'], durch: 'dusche' },
    essen:  { abStufe: 2, klassen: ['S', 'M', 'L', 'XL'], durch: 'essen' },
    strom:  { abStufe: 3, klassen: ['M', 'L', 'XL'], durch: 'platz' },   // Platz mit Strom
    diesel: { abStufe: 4, klassen: ['S', 'M', 'L', 'XL'], durch: 'diesel', nurMotor: true },
  },
  // Wie viele Wünsche ein Boot hat: [min, max] je Klasse (gekappt auf verfügbare Wünsche)
  wunschAnzahl: { S: [0, 2], M: [1, 2], L: [1, 3], XL: [2, 3], XXL: [0, 0] },

  // Platzarten: Strom und Zufriedenheit. Stege ohne Strom bekommen ihn über bauwerke.strom.
  platzarten: {
    box:     { strom: false },
    finger:  { strom: true, rufBonus: 0.5 },   // halber Anker extra
    stirn:   { strom: false },
    kai:     { strom: true, nurKlassen: ['XL'], offen: true },   // offen: Sturm trifft ihn
    fischer: { gast: false },                  // fest vergeben, bringt Pacht
    // Stufe 6, Klasse XXL: fest vergeben, Besuche über services (kreuzfahrtterminal,
    // marineanleger, seenotretter), kein Liegegeld
    pier:         { gast: false },
    marine:       { gast: false },
    seenotretter: { gast: false },
  },
  stromAnSteg: { C: true, CS: true, D: true, K: true },  // A und B erst mit bauwerke.strom

  ruf: {
    start: 3,
    startBewertungen: 5,      // so viele Bewertungen mit start liegen zum Spielbeginn vor
    fenster: 20,              // Schnitt der letzten 20 Bewertungen
    sondergastBonus: 1,       // Sondergäste (Marine, Behörden, Traditionssegler) geben so viel extra
    ohneWunsch: 4,
    // Ankünfte = Grundzahl * (0.75 + 0.125 * (Ruf - 1)): 1 Anker 0.75x, 3 Anker 1x, 5 Anker 1.25x
    ankunftBasis: 0.75,
    ankunftJeAnker: 0.125,
    abgewiesen: { chance: 0.25, wertung: 2.5 },  // wer keinen Platz bekommt, drückt den Ruf leicht
  },

  fischer: { pachtProTag: 15 },
  // Dauerlieger (features/dauerlieger.js): Pacht je Abend als Anteil des Gastpreises (Paket P01),
  // ab welcher Stufe, wie oft sie hinausfahren (je Tag), Törn über mehrere Tage [min, max]
  dauerlieger: { anteilGastpreis: 0.5, abStufe: 2, tagestoernChance: 0.4, toernChance: 0.12, toernTage: [1, 3] },
  // Stammgäste (features/stammgaeste.js): Anteil der neuen Boote, die Stammgäste sind; ab so vielen
  // Ankern kommt ein Gast wieder; Länge der Liste; ab diesem Besuch als Dauerlieger zu behalten
  stammgaeste: { chance: 0.15, abBewertung: 4, maxListe: 40, dauerAbBesuch: 5 },
  // Tagesziele (features/tagesziele.js, docs/neue-features.md Abschnitt 6). Morgens drei Karten
  // (leicht, mittel, schwer), der Spieler nimmt eine; es zählen nur eigene Handlungen.
  // geld: Belohnung eines leichten Ziels je Ausbaustufe. schwere: soll = Grundmenge mal Faktor,
  // geld = geld[stufe] mal Faktor. ziele: Grundmenge (basis oder basisAnteil der Boote, die der
  // Spieler heute selbst einweist), Obergrenze maxAnteil dieser Boote, angeboten ab abBooten am Tag.
  // kassieren: Anteil des Liegegelds, das der Spieler heute selbst einstreichen kann (mit allen Nächten).
  // wochenziele: Anteil von sieben Tagen Booten bzw. Liegegeld. gutschein.hoechstens mal geld[stufe].
  tagesziele: {
    geld: { 1: 10, 2: 25, 3: 50, 4: 80, 5: 120, 6: 150 },
    schwere: {
      leicht: { soll: 1, geld: 1 },
      mittel: { soll: 1.6, geld: 2 },
      schwer: { soll: 2.4, geld: 3.5 },
    },
    ziele: {
      einweisen:   { basisAnteil: 0.35, min: 2, maxAnteil: 0.85, abBooten: 1.5 },
      passgenau:   { basis: 1.3, maxAnteil: 0.5, abBooten: 2, spielraum: 1.2 },   // Box höchstens 20 % länger
      wunsch:      { basis: 1.4, maxAnteil: 0.5, abBooten: 1.5 },
      seglerStrom: { basis: 1.6, maxAnteil: 0.4, abBooten: 3 },
      rundum:      { abBooten: 2, mindestWuensche: 2 },
      letzter:     { bisPlaetze: 12 },
      kassieren:   { anteil: 0.3, maxAnteil: 0.8 },
    },
    grossAb: { 3: 'L', 5: 'XL' },                 // "ein großes Schiff einweisen": Klasse ab Stufe
    halberAnker: 0.5,                             // so viel besser bewerten alle Gäste, die gerade liegen
    gutschein: { prozent: 10, hoechstens: 15 },
    woche: { tage: 7, geld: 12, gaeste: 0.25, zufrieden: 0.15, segler: 0.1, liegegeld: 0.55 },
  },
  // Besucher an Land (Fahrgastschiff, Kreuzfahrt) geben abends je Stufe von Kiosk/Restaurant so viel aus
  besucher: { ausgabeJeKioskStufe: 2 },


  // ---------------------------------------------------------------- Ausbaustufen
  // ankuenfte: Boote pro Saisontag bei Ruf 3. mix: Anteil je Klasse.
  // ziel: was man in dieser Stufe erreichen muss, um das Bauprojekt der nächsten Stufe zu
  // kaufen (gaeste = abgereiste Gäste in dieser Stufe, ruf = Mindestruf).
  // ausbau: das große Bauprojekt, das zur nächsten Stufe führt, mit den Plätzen, die es selbst
  // bringt. Ersatz für umgebaute Plätze steckt im jeweiligen Stegprojekt (siehe unten).
  stufen: [
    { stufe: 1, name: 'Bootssteg am See', ankuenfte: 4, mix: { S: 1 },
      ziel: { gaeste: 20, ruf: 2.5 },
      ausbau: { id: 'dorfhafen', name: 'Dorfhafen am See', kosten: 400, bautage: 0,
        plaetze: ['F01'] } },
    { stufe: 2, name: 'Dorfhafen am See', ankuenfte: 11, mix: { S: 0.45, M: 0.55 },
      ziel: { gaeste: 120, ruf: 3.0 },
      ausbau: { id: 'durchstich', name: 'Durchstich zur Ostsee', kosten: 5000, bautage: 2,
        plaetze: ['B23', 'B24', 'B25', 'B26', 'F02'] } },
    { stufe: 3, name: 'Durchstich zur Ostsee', ankuenfte: 16, mix: { S: 0.32, M: 0.40, L: 0.28 },
      ziel: { gaeste: 360, ruf: 3.5 },
      ausbau: { id: 'marina', name: 'Schwimmsteg D', kosten: 20000, bautage: 2,
        plaetze: ['D01', 'D02', 'D03', 'D04', 'D05', 'D06'] } },
    { stufe: 4, name: 'Marina', ankuenfte: 18, mix: { S: 0.24, M: 0.34, L: 0.42 },
      ziel: { gaeste: 560, ruf: 3.8 },
      ausbau: { id: 'aussenhafen', name: 'Außenhafen mit Kai', kosten: 42000, bautage: 3,
        plaetze: ['K01', 'FK01', 'FK02'] } },
    { stufe: 5, name: 'Küstenmarina', ankuenfte: 20, mix: { S: 0.20, M: 0.33, L: 0.41, XL: 0.06 },
      ziel: { gaeste: 840, ruf: 4.2 },
      // Die Pier bringt die Plätze der Großschiffe: Kreuzfahrtpier, Marineanleger, Liegeplatz des
      // Seenotrettungskreuzers. Sie sind fest vergeben, Gastboote legen dort nicht an.
      ausbau: { id: 'grossschiffpier', name: 'Pier für Großschiffe', kosten: 70000, bautage: 4,
        plaetze: ['P01', 'MA01', 'MA02', 'SK01'] } },
    // Stufe 6: Großschiffe (XXL) zahlen kein Liegegeld, sie kommen als Besuche über die Services
    // kreuzfahrtterminal, marineanleger und seenotretter und bringen Geld je Besuch.
    // Keine eigene Zahl für Tagesgäste (Entscheidung Jorven, 11.11.2026).
    { stufe: 6, name: 'Seehafen', ankuenfte: 20, mix: { S: 0.18, M: 0.32, L: 0.42, XL: 0.08 },
      // Abschluss der Region: so viele Besuche großer Schiffe (Kreuzfahrtschiff, Flottenbesuch)
      // in Stufe 6, dieser Ruf und alle Plätze gebaut. Alles davon sieht der Spieler im Hafen.
      ziel: { grossschiffBesuche: 6, ruf: 4.5, allePlaetze: true },
      ausbau: null },
  ],

  // ---------------------------------------------------------------- Stegausbauten
  // Jeder Liegeplatz gehört genau einem Projekt (Start, Ausbau einer Stufe oder einem Projekt
  // hier). Gekaufte Plätze bleiben erhalten: Baut eine spätere Stufe einen Steg um, gehören die
  // Ersatzplätze zum selben Projekt (zum Beispiel b-steg: B01, B02 in Stufe 2, ab Stufe 3 B19,
  // B20). Ein Projekt hat deshalb in jeder Stufe mindestens so viele Plätze wie beim Kauf.
  // tools/balance.mjs --pruefen prüft das gegen harbor.js.
  start: { plaetze: ['A03', 'A04', 'A05', 'A06'] },   // der alte Steg, gratis
  stegprojekte: [
    { id: 'a-haken',      stufe: 1, name: 'Haken an Steg A',          kosten: 180,
      plaetze: ['A01', 'A02', 'A12', 'A13'] },
    { id: 'a-knick',      stufe: 2, name: 'Steg A verlängern',        kosten: 500,
      plaetze: ['A07', 'A08', 'A09', 'A10', 'A11'] },
    { id: 'b-steg',       stufe: 2, name: 'Steg B',                   kosten: 700,
      plaetze: ['B01', 'B02', 'B03', 'B04', 'B05', 'B06', 'B07', 'B08', 'B19', 'B20'] },
    { id: 'b-lang',       stufe: 2, name: 'Steg B verlängern',        kosten: 1400,
      plaetze: ['B09', 'B10', 'B11', 'B12', 'B13', 'B14', 'B15', 'B16', 'B21', 'B22'] },
    { id: 'b-tkopf',      stufe: 2, name: 'T-Kopf an Steg B',         kosten: 600,
      plaetze: ['B17', 'B18', 'B27', 'B28', 'B35', 'B36'] },
    { id: 'a-ausbau',     stufe: 3, name: 'Steg A ausbauen',          kosten: 2200,
      plaetze: ['A14', 'A15', 'A16', 'A17', 'A18', 'A19'] },
    { id: 'c-steg',       stufe: 3, name: 'Hauptsteg C',              kosten: 5000,
      plaetze: ['C01', 'C02', 'C03', 'C04', 'C05', 'C06'] },
    { id: 'c-lang',       stufe: 3, name: 'Hauptsteg C verlängern',   kosten: 7000,
      plaetze: ['C07', 'C08', 'C09', 'C10', 'C11', 'C12', 'C15'] },
    { id: 'c-tkopf',      stufe: 3, name: 'T-Kopf an Steg C',         kosten: 3300,
      plaetze: ['C13', 'C14', 'C23', 'C24'] },
    { id: 'c-knick',      stufe: 4, name: 'Hauptsteg C mit Knick',    kosten: 12000,
      plaetze: ['C16', 'C17', 'C18', 'C19', 'C20', 'C21', 'C22'] },
    { id: 'c-stich',      stufe: 4, name: 'Stichsteg an C',           kosten: 6000,
      plaetze: ['CS01', 'CS02', 'CS03', 'CS04'] },
    { id: 'd-lang',       stufe: 4, name: 'Schwimmsteg D verlängern', kosten: 10500,
      plaetze: ['D07', 'D08', 'D09', 'D10'] },
    { id: 'd-stirn',      stufe: 4, name: 'Stirnplatz an D',          kosten: 4000,
      plaetze: ['D11', 'D19'] },
    { id: 'kai-lang',     stufe: 5, name: 'Kai verlängern',           kosten: 33000,
      plaetze: ['K02', 'K03'] },
    { id: 'd-gabel',      stufe: 5, name: 'Gabelung an Steg D',       kosten: 24000,
      plaetze: ['D12', 'D13', 'D14', 'D15', 'D16', 'D17', 'D18'] },
    { id: 'b-neu',        stufe: 5, name: 'Steg B verlängern',        kosten: 9000,
      plaetze: ['B29', 'B30', 'B31', 'B32', 'B33', 'B34'] },
  ],

  // ---------------------------------------------------------------- Versorgung
  // Jedes Bauwerk hat Stufen. versorgt = so viele Boote bekommen pro Abend den Wunsch erfüllt.
  bauwerke: {
    wc: { name: 'Toilette', stufen: [
      { name: 'Toilettenhäuschen',     abStufe: 1, kosten: 80,    versorgt: 6 },
      { name: 'WC-Haus',               abStufe: 2, kosten: 450,   versorgt: 20 },
      { name: 'Sanitärgebäude',        abStufe: 3, kosten: 3300,  versorgt: 45 },
      { name: 'Großes Sanitärgebäude', abStufe: 4, kosten: 10500,  versorgt: 100 },
    ] },
    dusche: { name: 'Dusche', stufen: [
      { name: 'Kaltwasserdusche',          abStufe: 2, kosten: 250,  versorgt: 10 },
      { name: 'Duschhaus mit Warmwasser',  abStufe: 2, kosten: 900,  versorgt: 22 },
      { name: 'Großes Duschhaus',          abStufe: 3, kosten: 5000, versorgt: 45 },
      { name: 'Duschhaus mit Sauna',       abStufe: 4, kosten: 14000, versorgt: 100 },
    ] },
    essen: { name: 'Gastronomie', stufen: [
      { name: 'Kiosk',                 abStufe: 2, kosten: 500,   versorgt: 12 },
      { name: 'Imbiss',                abStufe: 3, kosten: 3600,  versorgt: 35 },
      { name: 'Hafenrestaurant',       abStufe: 4, kosten: 12000,  versorgt: 70 },
      { name: 'Restaurant mit Terrasse', abStufe: 5, kosten: 24000, versorgt: 100 },
    ] },
    diesel: { name: 'Tankstelle', stufen: [
      { name: 'Zapfsäule',      abStufe: 4, kosten: 6000, versorgt: 15 },
      { name: 'Bootstankstelle', abStufe: 5, kosten: 13500, versorgt: 40 },
    ] },
    // Strom an den Holzstegen A und B (C, D, Kai haben ihn von Anfang an)
    strom: { name: 'Stromsäulen', stufen: [
      { name: 'Stromsäulen an Steg B', abStufe: 3, kosten: 2400, stege: ['B'] },
    ] },
  },

  // ---------------------------------------------------------------- Hafenbüro
  // Komfort, keine Einnahmen. Logik bei den Spielregeln (sim.js).
  // allesKassieren: Knopf "Alles kassieren". sofortKassieren: Liegegeld kommt beim Anlegen von
  // selbst in die Kasse. automatik: wartende Boote bekommen sofort die Box mit den meisten
  // erfüllten Wünschen (ohne Hafenbüro fahren sie nach warten.selbstEinfahrenNach Sekunden in
  // irgendeine passende freie Box).
  hafenbuero: { stufen: [
    { name: 'Hafenmeister',  abStufe: 2, kosten: 600,  schaltetFrei: ['allesKassieren'] },
    { name: 'Kassenautomat', abStufe: 2, kosten: 1800, schaltetFrei: ['sofortKassieren'] },
    { name: 'Hafenbüro',     abStufe: 3, kosten: 3800, schaltetFrei: ['automatik'] },
  ] },

  // ---------------------------------------------------------------- Services
  // Format abgestimmt mit dem Services-Thread (web/js/data/services.js hat Startwerte, was
  // hier steht, überschreibt sie). services[id] = { abStufe, stufen: [ { name, kosten,
  // abStufe?, wirkung } ] }. Felder in wirkung (alle optional):
  //   proTag                 € pro Saisontag
  //   winter: { proTag }     € pro Wintertag
  //   gaeste: { S, M, ... }  Faktor auf die Ankünfte dieser Klasse
  //   kunden: { anteil, preis }  Anteil der Gastboote, die abends zusätzlich preis € zahlen
  //   hafengeld: { segel }   Faktor auf das Hafengeld von Segelbooten
  //   besuch: { alleTage, ersterNach, dauer, einnahme, gaeste, ruf }  wiederkehrender Besuch
  //                          (gaeste = Tagesgäste, ruf = Anzahl 5-Anker-Bewertungen)
  //   sturmschutz, regatta, hafenfest   schaltet frei bzw. wirkt bei Ereignissen
  // Kein Service hat laufende Kosten (plan.md, Leitlinien: keine laufenden Kosten), unterhalt
  // ist deshalb immer 0.
  // Services und Sonderanlagen: alle Zahlen hier, Namen, Texte und Lage in data/services.js.
  // Je Service: abStufe (ab welcher Hafenstufe baubar) und die Ausbaustufen in Reihenfolge, je Stufe
  // kosten, optional abStufe, ruf (Mindestruf), braucht ([{ id, stufe }]) und wirkung (Felder siehe
  // data/services.js). sturmschutz ist ein Anteil 0 bis 1.
  services: {
    bootsverleih: { abStufe: 1, stufen: [   // Bootsverleih
      // Ruderboote am Strand
      { kosten: 150, wirkung: { proTag: 8, wetter: { regen: 0.3, sturm: 0 } } },
      // Tretboote und Kanus
      { kosten: 900, abStufe: 2, wirkung: { proTag: 25, wetter: { regen: 0.3, sturm: 0 }, ruf: 0.03 } },
      // SUP- und Jollenverleih
      { kosten: 2600, abStufe: 3, wirkung: { proTag: 95, wetter: { regen: 0.25, sturm: 0 }, ruf: 0.06, gaeste: { S: 1.05 } } },
    ] },
    slip: { abStufe: 2, stufen: [   // Slipanlage
      // Slipanlage
      { kosten: 700, wirkung: { proTag: 16, wetter: { regen: 0.4, sturm: 0 }, kunden: { anteil: 0.1, preis: 6, nur: { klasse: ['S', 'M'] } }, gaeste: { S: 1.1 } } },
      // Slip mit Trailerparkplatz
      { kosten: 1600, abStufe: 3, wirkung: { proTag: 60, wetter: { regen: 0.4, sturm: 0 }, kunden: { anteil: 0.12, preis: 10, nur: { klasse: ['S', 'M'] } }, gaeste: { S: 1.05 } } },
    ] },
    raeucherei: { abStufe: 2, stufen: [   // Räucherei
      // Räucherkate
      { kosten: 1200, wirkung: { proTag: 20, kunden: { anteil: 0.15, preis: 4 }, ruf: 0.05 } },
      // Räucherei mit Fischladen
      { kosten: 8000, abStufe: 4, wirkung: { proTag: 60, kunden: { anteil: 0.2, preis: 6 }, ruf: 0.08 } },
    ] },
    fischhalle: { abStufe: 5, stufen: [   // Fischhalle
      // Fischhalle
      { kosten: 13500, braucht: [{ id: 'raeucherei', stufe: 1 }], wirkung: { proTag: 60, kunden: { anteil: 0.3, preis: 5 }, ruf: 0.08, besucherFuerVersorgung: 40 } },
      // Fischhalle mit Fischmarkt
      { kosten: 16000, wirkung: { proTag: 260, kunden: { anteil: 0.4, preis: 6 }, ruf: 0.12, besucherFuerVersorgung: 90 } },
    ] },
    baecker: { abStufe: 1, stufen: [   // Bäcker
      // Brötchenservice
      { kosten: 80, wirkung: { kunden: { anteil: 0.3, preis: 3 }, ruf: 0.03 } },
      // Hafenbäcker
      { kosten: 3200, abStufe: 3, wirkung: { proTag: 30, kunden: { anteil: 0.4, preis: 3 }, ruf: 0.06 } },
    ] },
    hafencafe: { abStufe: 2, stufen: [   // Hafencafé
      // Hafencafé
      { kosten: 800, wirkung: { proTag: 18, wetter: { regen: 0.5, sturm: 0.3 }, kunden: { anteil: 0.2, preis: 4 }, ruf: 0.03 } },
      // Café mit Terrasse
      { kosten: 4800, abStufe: 3, wirkung: { proTag: 70, wetter: { regen: 0.4, sturm: 0.2 }, kunden: { anteil: 0.3, preis: 5 }, ruf: 0.06 } },
    ] },
    grillplatz: { abStufe: 2, stufen: [   // Grillplatz
      // Grillplatz
      { kosten: 400, wirkung: { ruf: 0.05 } },
    ] },
    fahrradverleih: { abStufe: 3, stufen: [   // Fahrradverleih
      // Fahrradverleih
      { kosten: 2000, wirkung: { proTag: 25, wetter: { regen: 0.3, sturm: 0 }, kunden: { anteil: 0.15, preis: 8 } } },
    ] },
    eisdiele: { abStufe: 4, stufen: [   // Eisdiele
      // Eisdiele
      { kosten: 5000, wirkung: { proTag: 90, wetter: { regen: 0.2, sturm: 0 }, kunden: { anteil: 0.25, preis: 3 }, ruf: 0.03 } },
    ] },
    segelclub: { abStufe: 3, stufen: [   // Segelclub
      // Segelclub
      { kosten: 5000, wirkung: { proTag: 20, ruf: 0.08, gaeste: { S: 1.2 }, freischalten: ['regatta'] } },
      // Segelschule
      { kosten: 14500, abStufe: 4, wirkung: { proTag: 120, wetter: { regen: 0.6, sturm: 0 }, ruf: 0.12, gaeste: { S: 1.3, M: 1.05 }, freischalten: ['regatta'] } },
      // Regattaverein
      { kosten: 15000, abStufe: 4, ruf: 3.8, wirkung: { proTag: 150, wetter: { regen: 0.6, sturm: 0 }, ruf: 0.16, gaeste: { S: 1.15, M: 1.1, L: 1.05 }, freischalten: ['regatta'], regatta: 1.3 } },
    ] },
    mastenkran: { abStufe: 3, stufen: [   // Mastenkran
      // Mastenkran
      { kosten: 4000, wirkung: { kunden: { anteil: 0.08, preis: 35, nur: { antrieb: 'segel' } }, gaeste: { M: 1.2 } } },
    ] },
    ausruester: { abStufe: 3, stufen: [   // Bootsausrüster
      // Bootsausrüster
      { kosten: 4500, wirkung: { kunden: { anteil: 0.25, preis: 8 } } },
      // Yachtausrüster mit Motorenwerkstatt
      { kosten: 9000, abStufe: 4, wirkung: { kunden: { anteil: 0.25, preis: 24 }, synergie: [{ id: 'travellift', faktor: 1.15 }], ruf: 0.04 } },
    ] },
    travellift: { abStufe: 4, stufen: [   // Travellift und Werft
      // Bootsschuppen mit Werkstatt
      { kosten: 12500, braucht: [{ id: 'mastenkran', stufe: 1 }], wirkung: { kunden: { anteil: 0.06, preis: 120 }, winter: { proTag: 400 }, proTag: 40 } },
      // Travellift
      { kosten: 14000, wirkung: { kunden: { anteil: 0.08, preis: 170 }, gaeste: { L: 1.1 }, winter: { proTag: 600 } } },
      // Werfthalle mit Slipwagen
      { kosten: 26000, ruf: 3.8, wirkung: { kunden: { anteil: 0.1, preis: 190 }, gaeste: { L: 1.12 }, ruf: 0.08, winter: { proTag: 1100 } } },
    ] },
    winterlager: { abStufe: 4, stufen: [   // Winterlager
      // Freilager mit Böcken
      { kosten: 10000, braucht: [{ id: 'travellift', stufe: 2 }], wirkung: { winter: { proTag: 900 } } },
      // Winterlagerhalle
      { kosten: 27000, abStufe: 5, wirkung: { winter: { proTag: 2200 }, ruf: 0.06, gaeste: { L: 1.05 } } },
    ] },
    segelmacher: { abStufe: 4, stufen: [   // Segelmacher
      // Segelmacherei
      { kosten: 7500, braucht: [{ id: 'segelclub', stufe: 1 }], wirkung: { kunden: { anteil: 0.07, preis: 90, nur: { antrieb: 'segel' } }, hafengeld: { segel: 1.15 }, synergie: [{ id: 'mastenkran', faktor: 1.2 }] } },
      // Segelloft
      { kosten: 11000, abStufe: 5, wirkung: { kunden: { anteil: 0.1, preis: 120, nur: { antrieb: 'segel' } }, hafengeld: { segel: 1.2 }, synergie: [{ id: 'mastenkran', faktor: 1.2 }, { id: 'segelclub', faktor: 1.1 }], ruf: 0.05 } },
    ] },
    seenotretter: { abStufe: 4, stufen: [   // Seenotretter-Station
      // Seenotrettungsboot
      { kosten: 8000, wirkung: { sturmschutz: 0.5, ruf: 0.15 } },
      // Seenotrettungskreuzer
      { kosten: 20000, abStufe: 6, wirkung: { sturmschutz: 0.8, ruf: 0.25, freischalten: ['seenotkreuzer'], besuch: { art: 'tag-der-seenotretter', alleTage: 28, ersterNach: 5, dauer: 1, einnahme: 900, gaeste: 600, ruf: 0.02 } } },
    ] },
    fahrgastanleger: { abStufe: 5, stufen: [   // Fahrgastanleger
      // Fahrgastanleger
      { kosten: 21000, wirkung: { freischalten: ['fahrgastschiff'], wetter: { regen: 0.6, sturm: 0 }, besuch: { art: 'ausflugsfahrt', alleTage: 1, ersterNach: 1, dauer: 1, einnahme: 160, gaeste: 60 }, proTag: 150 } },
      // Ausflugsflotte
      { kosten: 26000, ruf: 4, wirkung: { freischalten: ['fahrgastschiff'], wetter: { regen: 0.6, sturm: 0 }, ruf: 0.05, besuch: { art: 'ausflugsfahrt', alleTage: 1, ersterNach: 1, dauer: 1, einnahme: 360, gaeste: 140 } } },
    ] },
    museumshafen: { abStufe: 5, stufen: [   // Museumshafen
      // Museumshafen
      { kosten: 22000, ruf: 4, wirkung: { proTag: 80, freischalten: ['traditionssegler'], ruf: 0.12, gaeste: { XL: 1.5 } } },
      // Museumshafen mit Speicher
      { kosten: 30000, ruf: 4.2, wirkung: { proTag: 160, freischalten: ['traditionssegler'], ruf: 0.18, gaeste: { XL: 1.5 }, hafenfest: 1.5 } },
      // Windjammertreffen (Stufe 6). Stufen addieren sich nicht: proTag 160 aus Stufe 2 plus 120 für das Treffen
      { kosten: 34000, abStufe: 6, wirkung: { proTag: 280, freischalten: ['traditionssegler'], ruf: 0.18, gaeste: { XL: 1.6 }, hafenfest: 1.5, besuch: { art: 'windjammer', alleTage: 12, ersterNach: 4, dauer: 2, einnahme: 5000, gaeste: 1800, ruf: 0.03 } } },
    ] },
    barkasse: { abStufe: 6, stufen: [   // Barkasse
      // Barkasse
      { kosten: 9000, braucht: [{ id: 'fahrgastanleger', stufe: 1 }], wirkung: { proTag: 220, wetter: { regen: 0.5, sturm: 0 }, ruf: 0.03 } },
    ] },
    kreuzfahrtterminal: { abStufe: 6, stufen: [   // Kreuzfahrtterminal
      // Kreuzfahrtpier
      { kosten: 60000, ruf: 4, braucht: [{ id: 'fahrgastanleger', stufe: 1 }], wirkung: { freischalten: ['kreuzfahrtschiff'], besuch: { art: 'kreuzfahrt', alleTage: 7, ersterNach: 3, dauer: 1, einnahme: 6500, gaeste: 1500 } } },
      // Kreuzfahrtterminal
      { kosten: 120000, ruf: 4.5, wirkung: { freischalten: ['kreuzfahrtschiff'], ruf: 0.1, besuch: { art: 'kreuzfahrt', alleTage: 4, ersterNach: 2, dauer: 1, einnahme: 9500, gaeste: 2600 } } },
    ] },
    marineanleger: { abStufe: 6, stufen: [   // Marineanleger
      // Marineanleger
      { kosten: 50000, ruf: 4, braucht: [{ id: 'seenotretter', stufe: 1 }], wirkung: { freischalten: ['marine'], sturmschutz: 0.1, besuch: { art: 'flottenbesuch', alleTage: 10, ersterNach: 4, dauer: 2, einnahme: 3600, gaeste: 500, ruf: 0.02 } } },
      // Marinestützpunkt
      { kosten: 100000, ruf: 4.6, wirkung: { proTag: 450, freischalten: ['marine'], sturmschutz: 0.2, ruf: 0.08, besuch: { art: 'flottenbesuch', alleTage: 6, ersterNach: 3, dauer: 2, einnahme: 4200, gaeste: 2200, ruf: 0.03 } } },
    ] },
  },


  // ---------------------------------------------------------------- Ereignisse
  // Alle Zahlen der Ereignisse (Texte und Wetterbild in data/events.js, Logik in events/scheduler.js).
  //   abStufe     ab dieser Ausbaustufe möglich
  //   alleTage    mittlerer Abstand in Tagen (Zufall streut um +- ablauf.streuung)
  //   dauer       Länge in Tagen
  //   vorrang     wenn mehrere fällig sind, gewinnt der größere Wert
  //   braucht     optional: Service, der gebaut sein muss
  //   saison      Saisontage [von, bis], an denen das Ereignis liegen darf
  //   ankuendigen Tage vorher angekündigt (Standard 1)
  //   wirkung     auf die Spielregeln, Felder wie DEFAULT_MODS in data/events.js
  //   schutz      Service, der die schlechten Folgen mindert: faktor je Ausbaustufe (1 = volle Folgen).
  //               Gibt es den stufenlosen Sturmschutz der Services (services.*.wirkung.sturmschutz),
  //               gilt der: Folgen = 1 - Sturmschutz.
  ereignisse: {
    ablauf: { ruhigeTage: 2, ersterTag: 3, streuung: 0.3 },
    nebel:     { abStufe: 1, alleTage: 13, dauer: 1, vorrang: 1, saison: [1, 30],
                 wirkung: { arrivalFactor: 0.7, extraNights: 1 } },
    sommertag: { abStufe: 1, alleTage: 11, dauer: 1, vorrang: 1, saison: [7, 24],
                 wirkung: { arrivalFactor: 1.25, sizeFactor: { S: 2, M: 1.2 }, visitorFactor: 1.5, serviceIncomeFactor: 1.3 } },
    sturm:     { abStufe: 3, alleTage: 12, dauer: 1, vorrang: 4, saison: [3, 30],
                 wirkung: { seaArrivals: false, extraNights: 1, satisfaction: { outer: -1 } },
                 schutz: { durch: 'seenotretter', faktor: [1, 0.5, 0] } },
    regatta:   { abStufe: 3, braucht: 'segelclub', alleTage: 14, dauer: 2, vorrang: 5, ankuendigen: 2, saison: [6, 26],
                 // kindFactor: Schlüssel sind die Bootsarten (kind) aus data/boat-catalog.js
                 wirkung: { arrivalFactor: 1.6, kindFactor: { jolle: 3, segelyacht: 3, mehrrumpf: 2 },
                   visitorFactor: 1.5, serviceIncomeFactor: 1.3, ratingBonus: 0.25 } },
    hafenfest: { abStufe: 4, alleTage: 20, dauer: 1, vorrang: 4, saison: [10, 24],
                 // Traditionssegler (XL) kommen erst ab Stufe 5, vorher nur mehr Boote und Besucher
                 wirkung: { arrivalFactor: 1.3, kindFactor: { traditionssegler: 6 }, sizeFactor: { XL: 2 },
                   visitorFactor: 2, serviceIncomeFactor: 1.5, ratingBonus: 0.25 } },
    // Wintertage: Boote im Winterlager, kaum Gäste
    winter:    { wirkung: { winter: true, arrivalFactor: 0.15, visitorFactor: 0.3, serviceIncomeFactor: 0.5 } },
  },

};

export default ECONOMY;
