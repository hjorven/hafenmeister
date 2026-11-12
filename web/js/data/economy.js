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
    winterTage: 3,          // keine Gäste, Bauprojekte doppelt so schnell
    winterBautempo: 2,
    // Tagesrhythmus wie im echten Hafen, als Anteile des Tages (0 = Morgen, 1 = Abend):
    // vormittags legen die Gäste ab, ab Mittag kommen die neuen, die meisten am Nachmittag.
    ankunftVon: 0.2,        // etwa 9:30, damit die Boote über den Tag verteilt kommen statt im Pulk
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
  },

  // Tagestörn: Gäste mit 2 oder mehr Nächten fahren mit dieser Wahrscheinlichkeit tagsüber
  // hinaus und kommen in dieselbe Box zurück (Box bleibt reserviert, Liegegeld zählt weiter).
  // raus und zurueck sind Anteile des Tages.
  tagestoern: { anteil: 0.35, raus: [0.12, 0.3], zurueck: [0.6, 0.85] },

  // ---------------------------------------------------------------- Gäste
  klassen: {
    //      Grundpreis pro Nacht, Nächte [min, max], Anteil Motorboote (nur die wünschen Diesel),
    //      Anteil Segelboote (Segelmacher, Regatta)
    S:   { grundpreis: 10,  naechte: [1, 2], motor: 0.35, segel: 0.40 },
    M:   { grundpreis: 22,  naechte: [1, 3], motor: 0.40, segel: 0.55 },
    L:   { grundpreis: 45,  naechte: [1, 3], motor: 0.40, segel: 0.55 },
    XL:  { grundpreis: 120, naechte: [1, 2], motor: 0.50, segel: 0.40 },
    XXL: { grundpreis: 0,   naechte: [1, 1], motor: 1.00, segel: 0.00 },  // kein Liegegeld, Einnahmen je Besuch (services)
  },
  wunschBonus: 0.25,          // Hafengeld = Grundpreis * (1 + wunschBonus * erfüllte Wünsche)

  // Sonderfälle innerhalb einer Klasse (Anteil an den Ankünften dieser Klasse)
  sonderboote: {
    mehrrumpf: { klasse: 'L', abStufe: 4, anteil: 0.12, braucht: 'stirn' },
    behoerde:  { klasse: 'L', abStufe: 4, anteil: 0.05, preisFaktor: 0.5, rufBonus: 1 },
  },

  wuensche: {
    //      ab Stufe, welche Klassen ihn haben können, Bauwerk, das ihn erfüllt
    wc:     { abStufe: 1, klassen: ['S', 'M', 'L', 'XL'], durch: 'wc' },
    dusche: { abStufe: 2, klassen: ['S', 'M', 'L', 'XL'], durch: 'dusche' },
    essen:  { abStufe: 2, klassen: ['S', 'M', 'L', 'XL'], durch: 'essen' },
    strom:  { abStufe: 3, klassen: ['M', 'L', 'XL'], durch: 'platz' },   // Platz mit Strom
    diesel: { abStufe: 4, klassen: ['S', 'M', 'L', 'XL'], durch: 'diesel', nurMotor: true },
  },
  // Wie viele Wünsche ein Boot hat: [min, max] je Klasse (gekappt auf verfügbare Wünsche)
  wunschAnzahl: { S: [0, 2], M: [1, 2], L: [1, 3], XL: [2, 3] },

  // Platzarten: Strom und Zufriedenheit. Stege ohne Strom bekommen ihn über bauwerke.strom.
  platzarten: {
    box:     { strom: false },
    finger:  { strom: true, rufBonus: 0.5 },   // halber Anker extra
    stirn:   { strom: false },
    kai:     { strom: true },
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
    fenster: 20,              // Schnitt der letzten 20 Bewertungen
    ohneWunsch: 4,
    // Ankünfte = Grundzahl * (0.5 + 0.25 * (Ruf - 1)): 1 Anker 0.5x, 3 Anker 1x, 5 Anker 1.5x
    ankunftBasis: 0.5,
    ankunftJeAnker: 0.25,
    abgewiesen: { chance: 0.25, wertung: 2.5 },  // wer keinen Platz bekommt, drückt den Ruf leicht
  },

  fischer: { pachtProTag: 15 },


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
    { stufe: 2, name: 'Dorfhafen am See', ankuenfte: 13, mix: { S: 0.45, M: 0.55 },
      ziel: { gaeste: 140, ruf: 3.0 },
      ausbau: { id: 'durchstich', name: 'Durchstich zur Ostsee', kosten: 5000, bautage: 2,
        plaetze: ['B23', 'B24', 'B25', 'B26', 'F02'] } },
    { stufe: 3, name: 'Durchstich zur Ostsee', ankuenfte: 22, mix: { S: 0.32, M: 0.40, L: 0.28 },
      ziel: { gaeste: 480, ruf: 3.5 },
      ausbau: { id: 'marina', name: 'Schwimmsteg D', kosten: 20000, bautage: 2,
        plaetze: ['D01', 'D02', 'D03', 'D04', 'D05', 'D06'] } },
    { stufe: 4, name: 'Marina', ankuenfte: 30, mix: { S: 0.24, M: 0.34, L: 0.42 },
      ziel: { gaeste: 800, ruf: 3.8 },
      ausbau: { id: 'aussenhafen', name: 'Außenhafen mit Kai', kosten: 42000, bautage: 3,
        plaetze: ['K01', 'FK01', 'FK02'] } },
    { stufe: 5, name: 'Küstenmarina', ankuenfte: 32, mix: { S: 0.20, M: 0.33, L: 0.41, XL: 0.06 },
      ziel: { gaeste: 1200, ruf: 4.2 },
      // Die Pier bringt die Plätze der Großschiffe: Kreuzfahrtpier, Marineanleger, Liegeplatz des
      // Seenotrettungskreuzers. Sie sind fest vergeben, Gastboote legen dort nicht an.
      ausbau: { id: 'grossschiffpier', name: 'Pier für Großschiffe', kosten: 70000, bautage: 4,
        plaetze: ['P01', 'MA01', 'MA02', 'SK01'] } },
    // Stufe 6: Großschiffe (XXL) zahlen kein Liegegeld, sie kommen als Besuche über die Services
    // kreuzfahrtterminal, marineanleger und seenotretter und bringen Geld je Besuch.
    // Keine eigene Zahl für Tagesgäste (Entscheidung Jorven, 11.11.2026).
    { stufe: 6, name: 'Seehafen', ankuenfte: 32, mix: { S: 0.18, M: 0.32, L: 0.42, XL: 0.08 },
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
  services: {
    // Angebote an Land (docs/echter-hafen.md, C11): bezahlt sich in rund 25 bis 45 Spieltagen
    baecker: { abStufe: 1, stufen: [
      { name: 'Brötchenservice', kosten: 80, wirkung: { kunden: { anteil: 0.3, preis: 3 }, ruf: 0.03 } },
      { name: 'Hafenbäcker', kosten: 3200, abStufe: 3, wirkung: { proTag: 30, kunden: { anteil: 0.4, preis: 3 }, ruf: 0.06 } },
    ] },
    hafencafe: { abStufe: 2, stufen: [
      { name: 'Hafencafé', kosten: 800, wirkung: { proTag: 18, wetter: { regen: 0.5, sturm: 0.3 }, kunden: { anteil: 0.2, preis: 4 }, ruf: 0.03 } },
      { name: 'Café mit Terrasse', kosten: 4800, abStufe: 3, wirkung: { proTag: 70, wetter: { regen: 0.4, sturm: 0.2 }, kunden: { anteil: 0.3, preis: 5 }, ruf: 0.06 } },
    ] },
    grillplatz: { abStufe: 2, stufen: [
      { name: 'Grillplatz', kosten: 400, wirkung: { ruf: 0.05 } },
    ] },
    fahrradverleih: { abStufe: 3, stufen: [
      { name: 'Fahrradverleih', kosten: 2000, wirkung: { proTag: 25, wetter: { regen: 0.3, sturm: 0 }, kunden: { anteil: 0.15, preis: 8 } } },
    ] },
    eisdiele: { abStufe: 4, stufen: [
      { name: 'Eisdiele', kosten: 5000, wirkung: { proTag: 90, wetter: { regen: 0.2, sturm: 0 }, kunden: { anteil: 0.25, preis: 3 }, ruf: 0.03 } },
    ] },
    bootsverleih: { abStufe: 1, stufen: [
      { name: 'Bootsverleih',            kosten: 150,  wirkung: { proTag: 8 } },
      { name: 'Bootsverleih mit Kanus',  kosten: 900,  abStufe: 2, wirkung: { proTag: 25 } },
    ] },
    raeucherei: { abStufe: 2, stufen: [
      { name: 'Räucherkate',             kosten: 1200, wirkung: { proTag: 20, kunden: { anteil: 0.15, preis: 4 } } },
      { name: 'Fischräucherei',          kosten: 8000, abStufe: 4, wirkung: { proTag: 60, kunden: { anteil: 0.2, preis: 6 } } },
    ] },
    slip: { abStufe: 2, stufen: [
      { name: 'Slip',                    kosten: 700,  wirkung: { gaeste: { S: 1.1 }, proTag: 16 } },
    ] },
    mastenkran: { abStufe: 3, stufen: [
      { name: 'Mastenkran',              kosten: 4000, wirkung: { gaeste: { M: 1.2 } } },
    ] },
    segelclub: { abStufe: 3, stufen: [
      { name: 'Segelclub',               kosten: 5000, wirkung: { gaeste: { S: 1.2 }, regatta: true } },
      { name: 'Segelclub mit Jugendabteilung', kosten: 14500, abStufe: 4, wirkung: { gaeste: { S: 1.3, M: 1.05 }, regatta: true } },
    ] },
    ausruester: { abStufe: 3, stufen: [
      { name: 'Bootsausrüster',          kosten: 4500, wirkung: { kunden: { anteil: 0.25, preis: 8 } } },
    ] },
    seenotretter: { abStufe: 4, stufen: [
      { name: 'Seenotretter-Station',    kosten: 8000, wirkung: { sturmschutz: true } },
    ] },
    travellift: { abStufe: 4, stufen: [
      { name: 'Travellift und Werft',    kosten: 12500, wirkung: { proTag: 40, winter: { proTag: 400 } } },
    ] },
    winterlager: { abStufe: 4, stufen: [
      { name: 'Winterlager',             kosten: 10000,  wirkung: { winter: { proTag: 900 } } },
      { name: 'Große Winterhalle',       kosten: 27000, abStufe: 5, wirkung: { winter: { proTag: 2200 } } },
    ] },
    segelmacher: { abStufe: 4, stufen: [
      { name: 'Segelmacher',             kosten: 7500, wirkung: { hafengeld: { segel: 1.15 } } },
    ] },
    fischhalle: { abStufe: 5, stufen: [
      { name: 'Fischhalle',              kosten: 13500, wirkung: { proTag: 60 } },
    ] },
    museumshafen: { abStufe: 5, stufen: [
      { name: 'Museumshafen',            kosten: 22000, wirkung: { gaeste: { XL: 1.5 }, proTag: 80 } },
      { name: 'Museumshafen mit Speicher', kosten: 30000, wirkung: { gaeste: { XL: 1.5 }, proTag: 160 } },
      // Stufe 6. Stufen addieren sich nicht: proTag 160 aus Stufe 2 plus 120 fuer das Treffen
      { name: 'Windjammertreffen',       kosten: 26000, abStufe: 6, wirkung: { gaeste: { XL: 1.6 }, proTag: 280,
        besuch: { art: 'windjammer', alleTage: 12, ersterNach: 4, dauer: 2, einnahme: 5000, gaeste: 1800, ruf: 0.03,
          text: 'Windjammertreffen: Traditionssegler laufen ein' } } },
    ] },
    barkasse: { abStufe: 6, stufen: [
      { name: 'Barkasse',                kosten: 9000, wirkung: { proTag: 220, wetter: { regen: 0.5, sturm: 0 }, ruf: 0.03 } },
    ] },
    fahrgastanleger: { abStufe: 5, stufen: [
      { name: 'Fahrgastanleger',         kosten: 21000, wirkung: { proTag: 150 } },
    ] },
  },

  // ---------------------------------------------------------------- Ereignisse
  // Vorschlag aus dem Balancing; die Logik gehört dem Ereignis-Thread.
  // alleTage = mittlerer Abstand in Saisontagen (zufällig +-30 %), angekündigt 1 Tag vorher.
  ereignisse: {
    // ankunftFaktor: von See läuft niemand ein, nur Boote aus dem See (vor allem S) kommen
    sturm:         { abStufe: 3, alleTage: 10, ankunftFaktor: { S: 0.6, M: 0.1, L: 0.1, XL: 0 }, extraNacht: 1,
                     rufMalus: 0.5, rufMalusMitSeenotretter: 0 },
    regatta:       { abStufe: 3, braucht: 'segelclub', alleTage: 12, dauer: 2,
                     ankunftFaktorSegel: 2 },
    hafenfest:     { abStufe: 4, alleTage: 15, dauer: 1, einnahme: 1500,
                     extraXL: 2 },
  },
};

export default ECONOMY;
