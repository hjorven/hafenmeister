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
    tagSekunden: 270,       // Tag, Boote laufen ein (etwa 4,5 min, docs/bootsgeschichten.md)
    abendSekunden: 30,      // Abend, Kassieren
    saisonTage: 16,         // danach Winter
    winterTage: 2,          // keine Gäste
    // Saisontage je Jahreszeit [von, bis]
    jahreszeiten: { fruehling: [1, 4], sommer: [5, 12], herbst: [13, 16] },
    // Jahreszeiten spürbar (P20, G5): Ankünfte und Bootsmischung je Jahreszeit, wie Modifikatoren
    // (arrivalFactor mal, sizeFactor/kindFactor je Größe oder Bootsart mal). Im Mittel über die Saison
    // etwa 1, damit der Aufstieg gleich lang bleibt. wind: Zuschlag auf das Alltagswetter (0 bis 1).
    // Frühling ruhig (wenige Boote, kaum Jollen), Sommer Hochsaison (volle Stege, viele kleine Boote),
    // Herbst Wind und die letzten Fahrtensegler (mehr Segelyachten, weniger Jollen und kleine Boote).
    jahreszeitWirkung: {
      fruehling: { arrivalFactor: 0.8, kindFactor: { jolle: 0.6 }, wind: 0.15 },
      sommer:    { arrivalFactor: 1.2, sizeFactor: { S: 1.25 }, wind: 0 },
      herbst:    { arrivalFactor: 0.9, sizeFactor: { S: 0.8 }, kindFactor: { segelyacht: 1.5, jolle: 0.5 }, wind: 0.3 },
    },
    erstesBootNach: 3,      // Sekunden: am ersten Tag eines neuen Spiels kommt gleich ein Boot
    // Tagesrhythmus wie im echten Hafen, als Anteile des Tages (0 = Morgen, 1 = Abend):
    // vormittags legen die Gäste ab, neue kommen den ganzen Tag, die meisten am Nachmittag.
    // Keine Wellen und kein Fließband: zwischen zwei Ankünften liegen zufällig ankunftAbstand bis
    // ankunftAbstandMax Sekunden, kurze häufiger als lange, über das ganze Fenster verteilt. Es kommen
    // nie mehr Boote, als mit ankunftDichte im Mittel ins Fenster passen (81 s / 4 s = 20), auch nicht
    // an Regattatagen.
    ankunftVon: 0.05,      // etwa 7:15, damit nach dem ersten Boot kein Loch entsteht
    ankunftAbstand: 3,      // Sekunden Mindestabstand zwischen zwei Ankünften (kleiner, wenn der Tag sonst nicht reicht)
    ankunftAbstandMax: 12,  // Sekunden, längster gewürfelter Abstand (bei wenigen Booten wird gestreckt; 12 für den 270-s-Tag)
    ankunftDichte: 4,       // Sekunden je Boot im Mittel an den vollsten Tagen
    ankunftBis: 0.95,       // etwa 19:30
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
    andrangImBildFaktor: 2.5, // bei Andrang mit 3D-Ansicht: so viel länger im Revier, bevor das Boot ohne Boje selbst einfährt
    ueberNacht: true,         // wer abends noch wartet, bleibt über Nacht an der Boje (ohne Bewertung)
    anfahrtMax: 35,           // ohne 3D-Ansicht (Tests, Balancing) gilt ein Boot danach als an der Boje
    anfahrtMaxAnsicht: 150,   // mit Ansicht meldet sie die Boje selbst; das hier ist die Notbremse (Seeweg in Marschfahrt: Stufe 6 p90 rund 100 s). Muss unter tagSekunden liegen, sonst greift sie nie: der Morgen setzt die Anfahrt zurück
    ausBoxMax: 20,            // ein abreisendes Boot gibt seine Box spätestens nach so vielen Sekunden frei
    vorschau: 3,              // so viele kommende Boote zeigt die Vorschau
    bojengeld: 0.2,           // Anteil des Grundpreises, den ein Boot für die Nacht an der Boje zahlt
  },

  // Passgenau zuweisen (Review A6): Box höchstens ein Fünftel größer als die kleinste Box, an die
  // das Boot passt, bringt einen Viertelanker mehr. Gilt nur, wenn es verschieden große Boxen gibt.
  passgenau: { hoechstensGroesser: 0.2, ruf: 0.25 },

  // Liegende Boote umlegen (P33, F4): Das erste Umlegen nimmt eine Crew hin, ab dem zweiten Mal
  // kostet jedes weitere ruf Anker in ihrer Bewertung. Liegegeld bleibt, wie es bezahlt ist.
  umlegen: { freiMal: 1, ruf: 0.5 },

  // Päckchen (P27, F1): Ist für ein wartendes Boot keine passende Box frei, darf der Spieler es
  // längsseits an ein liegendes Boot legen, das mindestens gleich groß ist (gleiche oder größere
  // Klasse, höchstens laengeMehr Meter kürzer als das Gastboot), nur an Plätzen der platzarten
  // (längsseits am Stegkopf, Kai, Yachtsteg) ab abStufe. Das äußere Boot zahlt den Anteil liegegeld,
  // bleibt höchstens naechteHoechstens Nächte und gibt wie das innere Boot ruf Anker weniger.
  // Wird das äußere in eine Box verholt, entfällt sein Abzug.
  paeckchen: { abStufe: 2, platzarten: ['stirn', 'kai'], liegegeld: 0.5, ruf: 0.5, naechteHoechstens: 1, laengeMehr: 0.5 },

  // Tagestörn: Gäste mit 2 oder mehr Nächten fahren mit dieser Wahrscheinlichkeit tagsüber
  // hinaus und kommen in dieselbe Box zurück (Box bleibt reserviert, Liegegeld zählt weiter).
  // raus und zurueck sind Anteile des Tages.
  tagestoern: { anteil: 0.35, raus: [0.12, 0.3], zurueck: [0.6, 0.85] },

  // Kurzhalt (docs/bootsgeschichten.md 3.2): Boote, die nur kurz anlegen (WC, Brötchen, Tanken, Eis)
  // und am selben Tag wieder ablegen. anteil je Stufe, bleibt = Liegezeit als Tagesanteil [min, max],
  // preis = Tagesliegegeld als Anteil vom Nachtpreis, spaetestens = Tagesanteil, ab dem keiner mehr
  // einfährt und zu dem alle weg sind, sichtbar = Mindestliegezeit ab dem sichtbaren Festmachen.
  // Ein Kurzhalter zählt beim Ablegen als Gast und bewertet wie ein Übernachter.
  kurzhalt: {
    anteil: { 1: 0.45, 2: 0.4, 3: 0.4, 4: 0.38, 5: 0.35, 6: 0.35 },
    bleibt: [0.12, 0.5],
    preis: 0.4,
    spaetestens: 0.97,
    sichtbar: 0.06,
    klassen: ['S', 'M', 'L'],
  },

  // Bootsgeschichten (docs/bootsgeschichten.md 4): Zahlen je Anlass, Texte und Bedingungen in
  // data/geschichten.js. Ob ein Boot kurz, eine oder mehrere Nächte bleibt, entscheiden weiter
  // kurzhalt und klassen; die Geschichte wählt nur unter den passenden Anlässen.
  //   g        Gewicht beim Würfeln
  //   kommt    bevorzugtes Ankunftsfenster [von, bis] als Tagesanteil (0 = 6:30, 1 = 19:00)
  //   bleibt   nur Kurzhalt: Liegezeit als Tagesanteil [min, max] (statt kurzhalt.bleibt)
  //   naechte  nur besondere Tage: Nächte [min, max], 0 = Kurzhalt (überschreibt die Klasse)
  //   toern    Anteil der Tage mit Tagestörn (statt tagestoern.anteil), raus/zurueck als Tagesanteile
  // wiederholTage: so lange zählt eine Geschichte als "neulich", abschnitte: Grenzen der
  // Tagesabschnitte früh | vormittags | mittags | nachmittags | abends, merkliste: so viele
  // Kombinationen (Geschichte, Herkunft, Crew, Detail) merkt sich das Spiel, keine kommt doppelt.
  // besonders: Anteil der Boote an Ereignis- und Wettertagen, die einen Anlass des Tages haben.
  geschichten: {
    wiederholTage: 3,
    abschnitte: [0.2, 0.44, 0.6, 0.92],
    merkliste: 400,
    besonders: 0.45,
    neulich: 0.35,          // Gewichtsfaktor für Geschichten der letzten wiederholTage Tage
    heuteSchon: 0.15,       // Gewichtsfaktor je Mal, das die Geschichte heute schon vorkam
    anlaesse: {
      wc:             { g: 8, kommt: [0.05, 0.85], bleibt: [0.12, 0.16] },
      broetchen:      { g: 6, kommt: [0.02, 0.3],  bleibt: [0.12, 0.16] },
      eis:            { g: 6, kommt: [0.35, 0.8],  bleibt: [0.15, 0.25] },
      badepause:      { g: 5, kommt: [0.3, 0.75],  bleibt: [0.2, 0.4] },
      ruderrast:      { g: 5, kommt: [0.1, 0.8],   bleibt: [0.12, 0.2] },
      kaffee:         { g: 5, kommt: [0.25, 0.75], bleibt: [0.15, 0.25] },
      mittag:         { g: 6, kommt: [0.3, 0.5],   bleibt: [0.2, 0.3] },
      proviant:       { g: 5, kommt: [0.1, 0.6],   bleibt: [0.15, 0.3] },
      fischbroetchen: { g: 5, kommt: [0.3, 0.7],   bleibt: [0.12, 0.2] },
      wasser:         { g: 3, kommt: [0.1, 0.7],   bleibt: [0.12, 0.15] },
      aussteigen:     { g: 3, kommt: [0.15, 0.6],  bleibt: [0.12, 0.2] },
      zusteigen:      { g: 3, kommt: [0.15, 0.6],  bleibt: [0.2, 0.35] },
      schauer:        { g: 8, kommt: [0.1, 0.8],   bleibt: [0.15, 0.3] },
      stempel:        { g: 3, kommt: [0.2, 0.7],   bleibt: [0.12, 0.18] },
      gassi:          { g: 3, kommt: [0.1, 0.8],   bleibt: [0.12, 0.2] },
      wetterbericht:  { g: 3, kommt: [0.05, 0.4],  bleibt: [0.12, 0.2] },
      tanken:         { g: 6, kommt: [0.1, 0.8],   bleibt: [0.12, 0.15] },
      ersatzteil:     { g: 4, kommt: [0.15, 0.6],  bleibt: [0.15, 0.3] },
      absaugen:       { g: 2, kommt: [0.1, 0.8],   bleibt: [0.12, 0.15] },
      strandgang:     { g: 5, kommt: [0.3, 0.55],  bleibt: [0.35, 0.5] },
      radausflug:     { g: 4, kommt: [0.1, 0.35],  bleibt: [0.4, 0.5] },
      einkauf:        { g: 4, kommt: [0.15, 0.7],  bleibt: [0.15, 0.3] },
      etappe:         { g: 8, kommt: [0.45, 0.95] },
      spaet:          { g: 4, kommt: [0.8, 1] },
      abendessen:     { g: 5, kommt: [0.55, 0.85] },
      grillabend:     { g: 4, kommt: [0.5, 0.85] },
      feierabend:     { g: 4, kommt: [0.75, 1] },
      vereinsfahrt:   { g: 3, kommt: [0.5, 0.8] },
      ueberfuehrung:  { g: 2, kommt: [0.6, 1] },
      duschen:        { g: 5, kommt: [0.45, 0.9] },
      charterstart:   { g: 3, kommt: [0.5, 0.85] },
      abwettern:      { g: 6, kommt: [0.3, 0.8] },
      seetage:        { g: 6, kommt: [0.3, 0.9] },
      urlaub:         { g: 8, kommt: [0.4, 0.9], toern: { anteil: 0.5, raus: [0.12, 0.3], zurueck: [0.6, 0.85] } },
      ortbesuch:      { g: 5, kommt: [0.35, 0.85] },
      crewwechsel:    { g: 3, kommt: [0.3, 0.8] },
      charterwechsel: { g: 3, kommt: [0.4, 0.8] },
      reparatur:      { g: 3, kommt: [0.2, 0.8] },
      mastlegen:      { g: 2, kommt: [0.2, 0.7] },
      segelmacher:    { g: 2, kommt: [0.2, 0.7] },
      werft:          { g: 2, kommt: [0.2, 0.6] },
      wetterfenster:  { g: 3, kommt: [0.4, 0.9] },
      langfahrt:      { g: 3, kommt: [0.4, 0.95] },
      angeln:         { g: 4, kommt: [0.4, 0.9], toern: { anteil: 0.9, raus: [0.01, 0.06], zurueck: [0.35, 0.5] } },
      radbasis:       { g: 3, kommt: [0.4, 0.9] },
      voegel:         { g: 2, kommt: [0.4, 0.9], toern: { anteil: 0.7, raus: [0.02, 0.1], zurueck: [0.3, 0.45] } },
      ausbildung:     { g: 3, kommt: [0.4, 0.8], toern: { anteil: 0.9, raus: [0.1, 0.2], zurueck: [0.6, 0.75] } },
      familientage:   { g: 6, kommt: [0.4, 0.85] },
      tagesfahrt:     { g: 6, kommt: [0.15, 0.4] },
      restaurantbesuch: { g: 4, kommt: [0.4, 0.6], bleibt: [0.3, 0.45] },
      klassiker:      { g: 3, kommt: [0.4, 0.85] },
      schutz:         { g: 10, kommt: [0.05, 0.5], naechte: [1, 2] },
      sturmschaden:   { g: 4, kommt: [0.3, 0.8], naechte: [2, 3] },
      kneipentag:     { g: 6, kommt: [0.2, 0.8], naechte: [1, 2] },
      nebelrein:      { g: 8, kommt: [0.3, 0.9] },
      badegaeste:     { g: 10, kommt: [0.3, 0.7], naechte: [0, 0], bleibt: [0.2, 0.4] },
      // Regatta: am Vorabend kommen, am Regattatag raus (toern), abends zurück, noch eine Nacht
      regattateilnehmer: { g: 12, kommt: [0.45, 0.95], naechte: [2, 3], toern: { anteil: 1, raus: [0.03, 0.16], zurueck: [0.6, 0.82] } },
      regattabegleit: { g: 2, kommt: [0.5, 0.9], naechte: [2, 2], toern: { anteil: 1, raus: [0.03, 0.06], zurueck: [0.75, 0.82] } },
      regattazuschauer: { g: 3, kommt: [0.35, 0.6], naechte: [0, 0], bleibt: [0.15, 0.3] },
      abendsonne:     { g: 6, kommt: [0.6, 0.95], naechte: [1, 1] },
      festbesuch:     { g: 10, kommt: [0.3, 0.8], naechte: [1, 1] },
      mittsommerfeuer: { g: 10, kommt: [0.6, 0.95], naechte: [1, 1] },
      fischmarkt:     { g: 10, kommt: [0.15, 0.6], naechte: [0, 0], bleibt: [0.15, 0.3] },
      holztreffen:    { g: 10, kommt: [0.3, 0.8], naechte: [1, 2] },
      hansegast:      { g: 10, kommt: [0.3, 0.8], naechte: [1, 3] },
    },
  },

  // ---------------------------------------------------------------- Gäste
  klassen: {
    //      Grundpreis pro Nacht, Nächte [min, max]. Ob ein Boot Motor- oder Segelboot ist, steht im
    //      Bootskatalog (data/boats). Gäste bleiben eher länger (Urlaubstörn), dafür kommen weniger
    //      am Tag: so bleibt der Hafen voll, ohne dass Boote im Sekundentakt einlaufen.
    //      proMeter (B10): wie in echten Häfen zahlt ein Gast je angefangenem Meter Bootslänge;
    //      der Satz steigt mit der Größe. Im Schnitt der Klasse ergibt das etwa den Grundpreis.
    //      Der Grundpreis gilt für Boote ohne Länge und für Schätzungen (Tagesziele).
    S:   { grundpreis: 11,  proMeter: 2.5, naechte: [1, 3] },
    M:   { grundpreis: 22,  proMeter: 2.7, naechte: [2, 4] },
    L:   { grundpreis: 45,  proMeter: 3.7, naechte: [2, 5] },
    XL:  { grundpreis: 120, proMeter: 4.2, naechte: [1, 3] },
    XXL: { grundpreis: 0,   naechte: [1, 1] },  // kein Liegegeld, Einnahmen je Besuch (services)
  },
  // Größenmischung nach Plätzen (A10): Boote einer Größe kommen seltener, wenn der Hafen für sie
  // wenige Plätze hat (wer vorher funkt, hört "für 12 m sind wir voll"). Faktor je Größe:
  // Plätze, an die die kleinste Bootsart der Größe passt, mal auslastung, geteilt durch den Bedarf
  // (Ankünfte am Tag mal Anteil mal mittlere Nächte); höchstens 1, mindestens `mindestens`.
  platzMix: { auslastung: 1.0, mindestens: 0.3 },
  wunschBonus: 0.25,          // Hafengeld = proMeter * Länge (aufgerundet) * (1 + wunschBonus * erfüllte Wünsche)

  // Kassieren (P12). Liegegeld wird beim Anlegen fällig. vorausNaechte: Gäste zahlen bis zu so viele
  // geplante Nächte auf einmal (eine Münze je Aufenthalt, 1 = jede Nacht einzeln). Was der Spieler nicht selbst einstreicht, holt
  // abends der Hafenmeister auf seinem Rundgang (oder nachts): in die Kasse kommt rundgangAnteil.
  // strichTrinkgeld: ab abMuenzen Münzen in einem Kassierstrich je Münze ab der Grenze jeMuenze
  // Trinkgeld auf die eingestrichene Summe, höchstens hoechstens.
  kassieren: {
    rundgangAnteil: 0.8,
    vorausNaechte: 7,
    strichTrinkgeld: { abMuenzen: 3, jeMuenze: 0.04, hoechstens: 0.2 },
  },
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

  // Wünsche an Angebote (P19 C3): Statt eines Ruf-Aufschlags auf jede Bewertung wünschen sich manche
  // Gäste ein Angebot an Land. Erfüllt, sobald der Service gebaut ist (irgendeine Stufe), sonst fehlt
  // er wie eine Dusche. anteil: so viele Boote haben je Stufe einen solchen Wunsch zusätzlich.
  // Je Wunsch: Service, ab Stufe (gewünscht wird es erst, wenn man es bauen kann), Klassen, nurSegel.
  angebotWunsch: {
    anteil: { 1: 0.1, 2: 0.2, 3: 0.35, 4: 0.45, 5: 0.5, 6: 0.5 },
    wuensche: {
      broetchen:   { service: 'baecker',        abStufe: 1, klassen: ['S', 'M', 'L', 'XL'] },
      cafe:        { service: 'hafencafe',      abStufe: 2, klassen: ['S', 'M', 'L', 'XL'] },
      grill:       { service: 'grillplatz',     abStufe: 2, klassen: ['S', 'M', 'L'] },
      fisch:       { service: 'raeucherei',     abStufe: 2, klassen: ['M', 'L', 'XL'] },
      segelclub:   { service: 'segelclub',      abStufe: 3, klassen: ['S', 'M', 'L'], nurSegel: true },
      rad:         { service: 'fahrradverleih', abStufe: 3, klassen: ['M', 'L', 'XL'] },
      ausruester:  { service: 'ausruester',     abStufe: 3, klassen: ['M', 'L', 'XL'] },
      kran:        { service: 'mastenkran',     abStufe: 3, klassen: ['M', 'L'], nurSegel: true },
      eis:         { service: 'eisdiele',       abStufe: 4, klassen: ['S', 'M', 'L'] },
      werft:       { service: 'travellift',     abStufe: 4, klassen: ['L', 'XL'] },
      segelmacher: { service: 'segelmacher',    abStufe: 4, klassen: ['M', 'L', 'XL'], nurSegel: true },
    },
  },

  // Platzarten: Strom und Zufriedenheit. Stege ohne Strom bekommen ihn über bauwerke.strom.
  platzarten: {
    box:     { strom: false },
    finger:  { strom: true, rufBonus: 0.5 },   // halber Anker extra
    stirn:   { strom: false, offen: true },   // Stirnplatz am Stegkopf: liegt zur See hin offen
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
    // Ruf = Schnitt aller Bewertungen der letzten tage Tage (heute mitgezählt), mindestens aber der
    // letzten mindestens Bewertungen (P19 C2: ein schlechter Tag ist gleich zu spüren, ein guter auch).
    // hoechstens: so viele Bewertungen hebt der Spielstand auf.
    tage: 2,
    mindestens: 10,
    hoechstens: 400,
    sondergastBonus: 1,       // Sondergäste (Marine, Behörden, Traditionssegler) geben so viel extra
    // Note aus den Wünschen: keiner erfüllt = keiner, alle erfüllt = alle, dazwischen linear.
    // keiner nicht unter abgewiesen.wertung: wer einen Platz bekam, ist nicht unzufriedener als
    // wer weggeschickt wurde (Befund P10). alle = 4,5: die volle Note gibt es erst mit gutem Platz
    // (Fingersteg, passgenau, von Hand eingewiesen), P19 C4. Gäste ohne Wünsche geben ohneWunsch.
    ohneWunsch: 4.5,
    wunschNote: { keiner: 2.5, alle: 4.5 },
    // Ankünfte = Grundzahl * (0.75 + 0.125 * (Ruf - 1)): 1 Anker 0.75x, 3 Anker 1x, 5 Anker 1.25x
    ankunftBasis: 0.75,
    ankunftJeAnker: 0.125,
    abgewiesen: { chance: 0.25, wertung: 2.5 },  // wer keinen Platz bekommt, drückt den Ruf leicht
    // Ein guter Ruf lockt andere Gäste (P19 C6): ab grosseAb Sternen kommen große Boote häufiger
    // (Faktor je Klasse), ab seltenAb kommen auch die seltenen Modelle (Liebhaberstücke).
    lockt: {
      grosseAb: 4, grosse: { L: 1.3, XL: 1.4 },
      seltenAb: 4.5,
      selten: ['S4-5', 'S5-3', 'M1-5', 'M2-5', 'M3-5', 'L1-5', 'L2-5', 'L3-4', 'XL1-4', 'XL2-4', 'XL2-5'],
    },
    // Wege (P19 B9): Liegt ein Gast weiter als weit Meter (Luftlinie Box bis Tür) vom nächsten
    // Gebäude, das einen dieser Wünsche erfüllt, zählt der Wunsch für die Note nur zum anteil.
    // Liegegeld und Wunschbonus bleiben voll. Das Sanitärgebäude (WC Stufe 3) hat auch Duschen.
    wege: { weit: 120, anteil: 0.5, wuensche: ['wc', 'dusche'] },
    // Auszeichnung (P19 C5): Liegt der Ruf an tage Abenden in Folge (Saison) mindestens bei ab,
    // bekommt der Hafen die Auszeichnung; liegt er tage Abende in Folge unter ab - halten, geht sie
    // eine Stufe zurück. Wimpel am Hafenmeisterhaus, Name im Gästebuch.
    auszeichnung: {
      tage: 2,
      halten: 0.2,
      stufen: [
        { ab: 3.8, name: 'Gastlicher Hafen' },
        { ab: 4.2, name: 'Empfohlener Hafen' },
        { ab: 4.6, name: 'Ausgezeichneter Hafen' },
      ],
    },
  },

  fischer: { pachtProTag: 15 },   // feste Pacht je Abend, nur für Fischer und andere fest vergebene Plätze

  // Dauerlieger (features/dauerlieger.js, docs/neue-features.md Abschnitt 3): ein Platz wird für die
  // ganze Saison vermietet. Sichere Einnahme, auch bei Sturm, dafür kein Gast, kein Ruf und keine
  // Gäste fürs Stufenziel.
  dauerlieger: {
    abStufe: 2,
    anteilGastpreis: 0.5,      // Pacht je Saisontag = Anteil des Gastpreises (ohne Wunschbonus)
    vorauskasse: true,         // true: Saisonpacht im Voraus (Rest der Saison, dann jede Saison neu);
                               // false: jeden Abend anteilGastpreis des Gastpreises
    hoechstAnteil: 0.25,       // höchstens ein Viertel der Plätze (fest vergebene zählen nicht)
    tagestoernChance: 0.4,     // je Tag: morgens raus, abends zurück
    toernChance: 0.12,         // je Tag: Törn über mehrere Tage, Platz frei für Gäste
    toernTage: [1, 2],
    frueherZurueck: 0.35,      // Anteil der Törns, von denen das Boot schon am Nachmittag des letzten Tages zurückkommt
    zurueckUm: [0.45, 0.62],   // dann zu diesem Anteil des Tages; liegt dort noch ein Gast, muss er umgelegt werden
    bewerberStart: 2,          // so viele Einheimische fragen gleich an, sobald Dauerplätze möglich sind
    bewerberMax: 3,            // höchstens so viele offene Anfragen
    bewerberChance: 0.35,      // je Nacht in der Saison: neue Anfrage
    bewerberTage: 5,           // so lange wartet ein Bewerber auf eine Box
    passtFreieBox: 0.85,       // Anteil der Bewerber, deren Boot in eine gerade freie Gastbox passt
    seglerAnteil: 0.7,         // Anteil Segler unter den Bewerbern (wenn möglich)
    kuendigungsZuschlag: 0.2,  // sofort kündigen: Pacht der restlichen Tage zurück plus dieser Anteil der Saisonpacht
  },
  // Stammgäste (features/stammgaeste.js): Anteil der neuen Boote, die Wiederkehrer sind; ab so vielen
  // Ankern merkt sich ein Gast den Hafen und kann wiederkommen; Stammgast ist er erst ab dem Besuch
  // stammAbBesuch (Zusammenspiel K2: sonst wird fast jeder Gast sofort Stammgast); Länge der Liste
  // (Stammgäste gehen vor, dann die zuletzt zufriedenen Gäste); ab diesem Besuch als Dauerlieger zu
  // behalten; namenGedaechtnis: so viele zuletzt vergebene Bootsnamen kommen möglichst nicht gleich wieder
  stammgaeste: { chance: 0.15, abBewertung: 4, stammAbBesuch: 2, maxListe: 40, dauerAbBesuch: 5, namenGedaechtnis: 30 },
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
      kassieren:   { anteil: 0.3, maxAnteil: 0.8, verlaufTage: 3, ohneVerlauf: 0.5, untergrenze: 0.25 },   // Geld nach den echten Liegegeld-Einnahmen der letzten Tage
    },
    grossAb: { 3: 'L', 5: 'XL' },                 // "ein großes Schiff einweisen": Klasse ab Stufe
    halberAnker: 0.5,                             // so viel besser bewerten alle Gäste, die gerade liegen
    gutschein: { prozent: 10, hoechstens: 15 },
    woche: { tage: 4, geld: 12, gaeste: 0.6, zufrieden: 0.35, segler: 0.2, liegegeld: 0.7 },   // Anteil der Woche (4 lange Tage): nicht in zwei Tagen zu schaffen
  },
  // Erfolge (features/erfolge-daten.js, docs/erfolge.md): Schwellen. Listen haben zwei oder drei Stufen
  // (Wimpel, dann Pokal). ausgebuchtAb: so viele Gastboxen muss der Hafen mindestens haben, damit
  // "alle belegt" zählt (am alten Steg mit 4 Boxen wäre es sonst geschenkt). lob: so viele Tage in Folge
  // gibt jeder abreisende Gast mindestens lobAb Anker. fuenfAnkerAb: Abreisen an dem Abend mit 5 Ankern.
  erfolge: {
    passgenau: 25, ausgebuchtAb: 12, tagesziele: 10, wochenziele: 1,
    gaeste: [100, 1000], stammgaeste: [1, 25], fuenfAnkerAb: 2, ruf: 4.5, lob: 7, lobAb: 4,
    tag: [1000, 10000], gesamt: [100000, 1000000], logbuch: [10, 30, 60], traditionssegler: 2, sturm: 1,
  },
  // Besucher an Land (Fahrgastschiff, Kreuzfahrt) geben abends je Stufe von Kiosk/Restaurant so viel aus
  besucher: { ausgabeJeKioskStufe: 2 },


  // ---------------------------------------------------------------- Ausbaustufen
  // ankuenfte: Boote pro Saisontag bei Ruf 3. mix: Anteil je Klasse.
  // ziel: was man in dieser Stufe erreichen muss, um das Bauprojekt der nächsten Stufe zu
  // kaufen (gaeste = abgereiste Gäste in dieser Stufe, ruf = Mindestruf).
  // ausbau: das große Bauprojekt, das zur nächsten Stufe führt, mit den Plätzen, die es selbst
  // bringt. bautage: Nächte Bauzeit, zugleich Zahl der Bauabschnitte (höchstens drei, ui/bauen.js):
  // jeder Abschnitt wird einzeln bezahlt und ist am nächsten Morgen fertig; 0 = sofort fertig. Ersatz für umgebaute Plätze steckt im jeweiligen Stegprojekt (siehe unten).
  stufen: [
    { stufe: 1, name: 'Bootssteg am See', ankuenfte: 8, mix: { S: 1 },
      ziel: { gaeste: 20, ruf: 2.5 },
      ausbau: { id: 'dorfhafen', name: 'Dorfhafen am See', kosten: 140, bautage: 0,
        plaetze: ['F01'] } },
    { stufe: 2, name: 'Dorfhafen am See', ankuenfte: 18, mix: { S: 0.45, M: 0.55 },
      ziel: { gaeste: 90, ruf: 3.0 },
      // nameOffen: Name auf Küsten, an denen der Hafen schon am offenen Wasser liegt (keine Nehrung am
      // Engpass, data/kuestennamen.js). Dort baut das Projekt Molen und Wellenbrecher statt eines Durchstichs.
      ausbau: { id: 'durchstich', name: 'Durchstich zur Ostsee', nameOffen: 'Molen und Wellenbrecher', kosten: 2200, bautage: 2,
        plaetze: ['B23', 'B24', 'B25', 'B26', 'F02'] } },
    { stufe: 3, name: 'Durchstich zur Ostsee', nameOffen: 'Hafen hinter der Mole', ankuenfte: 25, mix: { S: 0.32, M: 0.40, L: 0.28 },
      ziel: { gaeste: 340, ruf: 3.5 },
      ausbau: { id: 'marina', name: 'Schwimmsteg D', kosten: 9000, bautage: 2,
        plaetze: ['D01', 'D02', 'D03', 'D04', 'D05', 'D06'] } },
    { stufe: 4, name: 'Marina', ankuenfte: 29, mix: { S: 0.24, M: 0.34, L: 0.42 },
      ziel: { gaeste: 530, ruf: 3.8 },
      ausbau: { id: 'aussenhafen', name: 'Außenhafen mit Kai', kosten: 19000, bautage: 3,
        plaetze: ['K01', 'FK01', 'FK02'] } },
    { stufe: 5, name: 'Küstenmarina', ankuenfte: 31, mix: { S: 0.20, M: 0.33, L: 0.41, XL: 0.06 },
      ziel: { gaeste: 740, ruf: 4.2 },
      // Die Pier bringt die Plätze der Großschiffe: Kreuzfahrtpier, Marineanleger, Liegeplatz des
      // Seenotrettungskreuzers. Sie sind fest vergeben, Gastboote legen dort nicht an.
      ausbau: { id: 'grossschiffpier', name: 'Pier für Großschiffe', kosten: 31500, bautage: 4,
        plaetze: ['P01', 'MA01', 'MA02', 'SK01'] } },
    // Stufe 6: Großschiffe (XXL) zahlen kein Liegegeld, sie kommen als Besuche über die Services
    // kreuzfahrtterminal, marineanleger und seenotretter und bringen Geld je Besuch.
    // Keine eigene Zahl für Tagesgäste (Entscheidung Jorven, 11.11.2026).
    { stufe: 6, name: 'Seehafen', ankuenfte: 31, mix: { S: 0.18, M: 0.32, L: 0.42, XL: 0.08 },
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
  // Startwerte eines neuen Spiels (P17): der alte Steg gratis, kein Startgeld. Das erste Bauwerk
  // (Toilettenhäuschen) schenkt der Einstieg beim ersten Öffnen von Bauen (Ü15, docs/bauen.md).
  start: { plaetze: ['A03', 'A04', 'A05', 'A06'], geld: 0 },
  stegprojekte: [
    { id: 'a-haken',      stufe: 1, name: 'Haken an Steg A',          kosten: 80,
      plaetze: ['A01', 'A02', 'A12', 'A13'] },
    { id: 'a-knick',      stufe: 2, name: 'Steg A verlängern',        kosten: 220,
      plaetze: ['A07', 'A08', 'A09', 'A10', 'A11'] },
    { id: 'b-steg',       stufe: 2, name: 'Steg B',                   kosten: 200,
      plaetze: ['B01', 'B02', 'B03', 'B04', 'B05', 'B06', 'B07', 'B08', 'B19', 'B20'] },
    { id: 'b-lang',       stufe: 2, name: 'Steg B verlängern',        kosten: 630,
      plaetze: ['B09', 'B10', 'B11', 'B12', 'B13', 'B14', 'B15', 'B16', 'B21', 'B22'] },
    { id: 'b-tkopf',      stufe: 2, name: 'T-Kopf an Steg B',         kosten: 270,
      plaetze: ['B17', 'B18', 'B27', 'B28', 'B35', 'B36'] },
    { id: 'a-ausbau',     stufe: 3, name: 'Steg A ausbauen',          kosten: 990,
      plaetze: ['A14', 'A15', 'A16', 'A17', 'A18', 'A19'] },
    { id: 'c-steg',       stufe: 3, name: 'Hauptsteg C',              kosten: 2200,
      plaetze: ['C01', 'C02', 'C03', 'C04', 'C05', 'C06'] },
    { id: 'c-lang',       stufe: 3, name: 'Hauptsteg C verlängern',   kosten: 3200,
      plaetze: ['C07', 'C08', 'C09', 'C10', 'C11', 'C12', 'C15'] },
    { id: 'c-tkopf',      stufe: 3, name: 'T-Kopf an Steg C',         kosten: 1500,
      plaetze: ['C13', 'C14', 'C23', 'C24'] },
    { id: 'c-knick',      stufe: 4, name: 'Hauptsteg C mit Knick',    kosten: 5400,
      plaetze: ['C16', 'C17', 'C18', 'C19', 'C20', 'C21', 'C22'] },
    { id: 'c-stich',      stufe: 4, name: 'Stichsteg an C',           kosten: 2700,
      plaetze: ['CS01', 'CS02', 'CS03', 'CS04'] },
    { id: 'd-lang',       stufe: 4, name: 'Schwimmsteg D verlängern', kosten: 4700,
      plaetze: ['D07', 'D08', 'D09', 'D10'] },
    { id: 'd-stirn',      stufe: 4, name: 'Stirnplatz an D',          kosten: 1800,
      plaetze: ['D11', 'D19'] },
    { id: 'kai-lang',     stufe: 5, name: 'Kai verlängern',           kosten: 15000,
      plaetze: ['K02', 'K03'] },
    { id: 'd-gabel',      stufe: 5, name: 'Gabelung an Steg D',       kosten: 11000,
      plaetze: ['D12', 'D13', 'D14', 'D15', 'D16', 'D17', 'D18'] },
    { id: 'b-neu',        stufe: 5, name: 'Steg B verlängern',        kosten: 4000,
      plaetze: ['B29', 'B30', 'B31', 'B32', 'B33', 'B34'] },
    // P59, D9: Yachtsteg im tiefen Wasser vor der Westmole, zwei Plätze längsseits für große Yachten
    // und Traditionssegler (XL). Mehr XL-Plätze bringen mehr XL-Gäste (A10).
    { id: 'yachtsteg',    stufe: 6, name: 'Yachtsteg',                kosten: 13500,
      plaetze: ['Y01', 'Y02'] },
  ],

  // ---------------------------------------------------------------- Versorgung
  // Jedes Bauwerk hat Stufen. versorgt = so viele Boote bekommen pro Abend den Wunsch erfüllt.
  bauwerke: {
    wc: { name: 'Toilette', stufen: [
      { name: 'Toilettenhäuschen',     abStufe: 1, kosten: 35,    versorgt: 12 },
      { name: 'WC-Haus',               abStufe: 2, kosten: 200,   versorgt: 40 },
      { name: 'Sanitärgebäude',        abStufe: 3, kosten: 1500,  versorgt: 90 },
      { name: 'Großes Sanitärgebäude', abStufe: 4, kosten: 4700,  versorgt: 200 },
    ] },
    dusche: { name: 'Dusche', stufen: [
      { name: 'Kaltwasserdusche',          abStufe: 2, kosten: 110,  versorgt: 20 },
      { name: 'Duschhaus mit Warmwasser',  abStufe: 2, kosten: 400,  versorgt: 44 },
      { name: 'Großes Duschhaus',          abStufe: 3, kosten: 2200, versorgt: 90 },
      { name: 'Duschhaus mit Sauna',       abStufe: 4, kosten: 6300, versorgt: 200 },
    ] },
    essen: { name: 'Gastronomie', stufen: [
      { name: 'Kiosk',                 abStufe: 2, kosten: 220,   versorgt: 24 },
      { name: 'Imbiss',                abStufe: 3, kosten: 1600,  versorgt: 70 },
      { name: 'Hafenrestaurant',       abStufe: 4, kosten: 5400,  versorgt: 140 },
      { name: 'Restaurant mit Terrasse', abStufe: 5, kosten: 11000, versorgt: 200 },
    ] },
    diesel: { name: 'Tankstelle', stufen: [
      { name: 'Zapfsäule',      abStufe: 4, kosten: 2700, versorgt: 30 },
      { name: 'Bootstankstelle', abStufe: 5, kosten: 6100, versorgt: 80 },
    ] },
    // Strom an den Holzstegen A und B (C, D, Kai haben ihn von Anfang an)
    strom: { name: 'Stromsäulen', stufen: [
      { name: 'Stromsäulen an Steg B', abStufe: 3, kosten: 1100, stege: ['B'] },
    ] },
  },

  // ---------------------------------------------------------------- Stege umbauen (P59)
  // Doppelbox: zwei Heckpfahl-Boxen nebeneinander werden eine breite Box (data/doppelboxen.js,
  // features/umbauen.js, docs/stege-umbauen.md). Nur für Klassen, deren breitere Boote sonst keine Box
  // finden: In die Doppelbox der Klasse L passen Mehrrumpfboote (L2, bis 7,5 m breit, ab Stufe 4).
  // kosten: Umbau zur Doppelbox, rueckbau: zurück zu zwei Boxen. Beide Boxen müssen dabei frei sein.
  doppelbox: { klassen: ['L'], abStufe: 4, kosten: 990, rueckbau: 220, maxBreite: 8 },

  // ---------------------------------------------------------------- Stege nachrüsten (P30)
  // Logik in web/js/features/nachruesten.js, Beschreibung in docs/nachruesten.md. Je Steg einmal.
  // kosten = grund + jePlatz[Klasse] für jeden betroffenen Gastplatz, der am Steg gerade liegt (auf 10 €
  // gerundet); Boxen späterer Ausbaustufen bekommen es gleich mit. anker: so viel besser bewerten Gäste
  // an diesem Steg. nurArt: nur Plätze dieser Platzart (Fingerstege nur an Heckpfahl-Boxen).
  nachruesten: {
    // Wie ein Schwimmsteg mit Fingern (platzarten.finger.rufBonus)
    finger: { name: 'Fingerstege', abStufe: 3, grund: 400, jePlatz: { S: 90, M: 140, L: 200 }, anker: 0.5, nurArt: 'box' },
    licht:  { name: 'Steglaternen', abStufe: 2, grund: 150, jePlatz: { S: 20, M: 25, L: 30, XL: 40 }, anker: 0.2 },
  },

  // ---------------------------------------------------------------- Kassieren
  // ---------------------------------------------------------------- Hafenbüro
  // Komfort, keine Einnahmen. Logik bei den Spielregeln (sim.js).
  // allesKassieren: Knopf "Alles kassieren". sofortKassieren: Liegegeld kommt beim Anlegen von
  // selbst in die Kasse. automatik: wartende Boote bekommen sofort die Box mit den meisten
  // erfüllten Wünschen (ohne Hafenbüro fahren sie nach warten.selbstEinfahrenNach Sekunden in
  // irgendeine passende freie Box).
  hafenbuero: { stufen: [
    { name: 'Hafenmeister mit Funk', abStufe: 2, kosten: 270,  schaltetFrei: ['allesKassieren', 'vorschau', 'anmeldung'] },
    { name: 'Kassenautomat',         abStufe: 2, kosten: 810, schaltetFrei: ['sofortKassieren'], klassen: ['S', 'M'] },
    { name: 'Hafenbüro',             abStufe: 3, kosten: 1700, schaltetFrei: ['vorschlag', 'nebenkosten'] },
    { name: 'Hafenleitstelle',       abStufe: 4, kosten: 4300, schaltetFrei: ['automatik'] },
  ],
  // Große Boote (L, XL, XXL) zahlen persönlich: Holt der Spieler ihre Münze selbst ab (Tippen oder
  // Strich), gibt es anteil des Liegegelds als Trinkgeld. Der Kassenautomat nimmt nur S und M.
  trinkgeld: { klassen: ['L', 'XL', 'XXL'], anteil: 0.15 },
  // Ab dem Hafenbüro (Stufe 3) rechnet das Büro Strom, Wasser und Duschen ab: Auf jedes
  // kassierte Liegegeld kommt anteil obendrauf (von Hand und vom Automaten, nicht beim Rundgang).
  nebenkosten: { anteil: 0.1 },
  // Bewertung: Gäste, die der Spieler selbst einweist (Ziehen, Ring, "Einfahren lassen",
  // Vorschlag annehmen), geben so viele Anker mehr. Selbst eingefahrene und vom Büro
  // zugewiesene nicht.
  vonHandBonus: 0.25,
  // Sonderfälle (plan.md Abschnitt 3): Die Automatik weist sie nicht zu, sie bleiben beim Spieler
  // und tragen über dem Boot eine orange Raute. Nach selbstEinfahrenNach Sekunden an der Boje suchen
  // sie sich doch selbst eine Box (knappste, ohne Wünsche). Ohne Hafenbüro gilt für alle
  // warten.selbstEinfahrenNach.
  sonderfaelle: {
    arten: ['mehrrumpf'],        // Mehrrumpfboote
    klassen: ['XL', 'XXL'],      // große Schiffe
    // weitere Fälle: 'sondergast' (Traditionssegler, Behördenboote, sondergast in den Bootsdaten)
    // und 'einzigerPlatz' (nur noch genau eine passende freie Box)
    // 'flottille': Boote einer Flottille (P32) ohne frei gehaltene Box, die Gruppe soll zusammen liegen
    auch: ['sondergast', 'einzigerPlatz', 'flottille'],
    selbstEinfahrenNach: 25,
  } },

  // ---------------------------------------------------------------- Anmeldung per Funk (P28)
  // Ab "Hafenmeister mit Funk" (schaltetFrei 'anmeldung') melden sich morgens ein bis zwei der
  // heute erwarteten Gäste per Funk an. Wer ihnen eine Box frei hält, bekommt beim Einlaufen einen
  // Bonus. Die frei gehaltene Box ist bis dahin für andere Boote gesperrt (das ist der Preis).
  //   fruehestens  nur Boote, die frühestens bei diesem Anteil des Tages kommen (0,35 = etwa 12:00),
  //                damit Zeit zum Entscheiden bleibt
  //   zweiAnteil   so oft melden sich zwei Boote statt einem
  //   bonusAnteil  Bonus beim Einlaufen in die frei gehaltene Box, Anteil des Liegegelds einer Nacht
  //   ruf          so viele Anker mehr in der Bewertung des Gastes
  funkAnmeldung: { fruehestens: 0.35, zweiAnteil: 0.4, bonusAnteil: 0.5, ruf: 0.25 },

  // ---------------------------------------------------------------- Flottillen (P32, docs/flottillen.md)
  // Drei bis fünf Boote einer Art (Feld group in den Bootsdaten) kommen zusammen im Konvoi und wollen am
  // selben Steg liegen. Liegen alle an einem Steg, gibt jede Crew zusammen Anker mehr, wird die Gruppe
  // aufgeteilt (oder ein Boot weggeschickt), getrennt Anker weniger. Die Flottille ersetzt Boote des Tages,
  // es kommen nicht mehr Gäste. Auswahl aus Seed und Tag, verbraucht keinen Spielzufall.
  //   anteil      Anteil der Tage mit einer Flottille je Hafenstufe (ab abStufe)
  //   fruehestens, spaetestens  Ankunft des ersten Boots als Tagesanteil
  //   abstand     Sekunden Spielzeit zwischen zwei Booten im Konvoi
  flottillen: {
    abStufe: 3,
    anteil: { 3: 0.15, 4: 0.2, 5: 0.22, 6: 0.25 },
    fruehestens: 0.35, spaetestens: 0.75,
    abstand: 2.5,
    zusammen: 0.5,
    getrennt: 0.5,
  },

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
      { kosten: 70, wirkung: { proTag: 8, wetter: { regen: 0.3, sturm: 0 } } },
      // Tretboote und Kanus
      { kosten: 400, abStufe: 2, wirkung: { proTag: 25, wetter: { regen: 0.3, sturm: 0 }, ruf: 0.03 } },
      // SUP- und Jollenverleih
      { kosten: 1200, abStufe: 3, wirkung: { proTag: 95, wetter: { regen: 0.25, sturm: 0 }, ruf: 0.06, gaeste: { S: 1.05 } } },
    ] },
    slip: { abStufe: 2, stufen: [   // Slipanlage
      // Slipanlage
      // P23: Trailerboote kommen über Land, gehen am Slip ins Wasser, kein Liegeplatz (Slipgebühr je Boot)
      { kosten: 320, wirkung: { trailer: { anzahl: 4, preis: 8, wetter: { regen: 0.4, sturm: 0 } } } },
      // Slip mit Trailerparkplatz
      { kosten: 720, abStufe: 3, wirkung: { trailer: { anzahl: 7, preis: 12, wetter: { regen: 0.4, sturm: 0 } } } },
    ] },
    raeucherei: { abStufe: 2, stufen: [   // Räucherei
      // Räucherkate
      // P23: verdient an den Crews im Hafen, abends kommen Leute aus dem Ort dazu
      { kosten: 540, wirkung: { kunden: { anteil: 0.25, preis: 5 }, abendgaeste: { anzahl: 4, preis: 4, wetter: { regen: 0.5, sturm: 0 } }, ruf: 0.05 } },
      // Räucherei mit Fischladen
      { kosten: 3600, abStufe: 4, wirkung: { kunden: { anteil: 0.3, preis: 6 }, abendgaeste: { anzahl: 10, preis: 5, wetter: { regen: 0.5, sturm: 0 } }, tagesgaeste: 12, ruf: 0.08 } },
    ] },
    fischhalle: { abStufe: 5, stufen: [   // Fischhalle
      // Fischhalle
      { kosten: 6100, braucht: [{ id: 'raeucherei', stufe: 1 }], wirkung: { proTag: 60, kunden: { anteil: 0.3, preis: 5 }, tagesgaeste: 20, ruf: 0.08, besucherFuerVersorgung: 40 } },
      // Fischhalle mit Fischmarkt
      { kosten: 7200, wirkung: { proTag: 260, kunden: { anteil: 0.4, preis: 6 }, tagesgaeste: 25, ruf: 0.12, besucherFuerVersorgung: 90 } },
    ] },
    baecker: { abStufe: 1, stufen: [   // Bäcker
      // Brötchenservice
      { kosten: 35, wirkung: { kunden: { anteil: 0.3, preis: 3 }, ruf: 0.03 } },
      // Hafenbäcker
      { kosten: 1400, abStufe: 3, wirkung: { kunden: { anteil: 0.6, preis: 4 }, tagesgaeste: 6, ruf: 0.06 } },
    ] },
    hafencafe: { abStufe: 2, stufen: [   // Hafencafé
      // Hafencafé
      // P23 F5: nur noch nach Auslastung (Crews im Hafen), bei Regen sitzen die Leute drinnen
      { kosten: 360, wirkung: { kunden: { anteil: 0.5, preis: 5, wetter: { regen: 0.7, sturm: 0.4 } }, tagesgaeste: 12, ruf: 0.03 } },
      // Café mit Terrasse
      { kosten: 2200, abStufe: 3, wirkung: { kunden: { anteil: 0.75, preis: 5, wetter: { regen: 0.6, sturm: 0.3 } }, tagesgaeste: 15, ruf: 0.06 } },
    ] },
    grillplatz: { abStufe: 2, stufen: [   // Grillplatz
      // Grillplatz
      { kosten: 180, wirkung: { ruf: 0.05 } },
    ] },
    fahrradverleih: { abStufe: 3, stufen: [   // Fahrradverleih
      // Fahrradverleih
      // P23: Crews leihen Räder; manche hängen für eine Radtour eine Nacht an (dienst)
      { kosten: 900, wirkung: { kunden: { anteil: 0.12, preis: 8, wetter: { regen: 0.3, sturm: 0 } }, dienst: { anteil: 0.18, nur: { klasse: ['S', 'M', 'L'], naechteMax: 2 }, naechte: 1, preis: 30, wetter: { regen: 0.3, sturm: 0 } }, tagesgaeste: 8 } },
    ] },
    eisdiele: { abStufe: 4, stufen: [   // Eisdiele
      // Eisdiele
      // P23: steht auf dem Platz des Cafés (Entweder-oder), stark bei Sonne, kleine Familienboote kommen gern
      { kosten: 2200, wirkung: { kunden: { anteil: 1.1, preis: 3.5, wetter: { regen: 0.2, sturm: 0 } }, tagesgaeste: 20, gaeste: { S: 1.1 }, ruf: 0.03 } },
    ] },
    segelclub: { abStufe: 3, stufen: [   // Segelclub
      // Segelclub
      { kosten: 2200, wirkung: { proTag: 20, ruf: 0.08, gaeste: { S: 1.2 }, freischalten: ['regatta'] } },
      // Segelschule
      { kosten: 6500, abStufe: 4, wirkung: { proTag: 120, wetter: { regen: 0.6, sturm: 0 }, ruf: 0.12, gaeste: { S: 1.3, M: 1.05 }, freischalten: ['regatta'] } },
      // Regattaverein
      { kosten: 6800, abStufe: 4, ruf: 3.8, wirkung: { proTag: 150, wetter: { regen: 0.6, sturm: 0 }, ruf: 0.16, gaeste: { S: 1.15, M: 1.1, L: 1.05 }, freischalten: ['regatta'], regatta: 1.3 } },
    ] },
    mastenkran: { abStufe: 3, stufen: [   // Mastenkran
      // Mastenkran
      // P23: Segler lassen den Mast legen und bleiben dafür eine Nacht länger (dienst)
      { kosten: 1800, wirkung: { dienst: { anteil: 0.3, nur: { antrieb: 'segel', klasse: ['M', 'L'] }, naechte: 1, preis: 45 }, gaeste: { M: 1.2 },
        // P20 H5: an den Krantagen (erster und letzter Saisontag) stellt bzw. legt jeder segelnde Dauerlieger den Mast
        dauerlieger: { krantage: true, preis: 45, nur: { antrieb: 'segel' } } } },
    ] },
    ausruester: { abStufe: 3, stufen: [   // Bootsausrüster
      // Bootsausrüster
      { kosten: 2000, wirkung: { kunden: { anteil: 0.25, preis: 8 } } },
      // Yachtausrüster mit Motorenwerkstatt
      { kosten: 4000, abStufe: 4, wirkung: { kunden: { anteil: 0.25, preis: 24 }, synergie: [{ id: 'travellift', faktor: 1.15 }], ruf: 0.04 } },
    ] },
    travellift: { abStufe: 4, stufen: [   // Travellift und Werft
      // Bootsschuppen mit Werkstatt
      // P23: Boote mit Schaden kommen zur Reparatur und bleiben, bis sie fertig sind (dienst)
      { kosten: 5600, braucht: [{ id: 'mastenkran', stufe: 1 }], wirkung: { dienst: { anteil: 0.12, nur: { klasse: ['M', 'L', 'XL'] }, naechte: 1, preis: 220 }, winter: { proTag: 400 }, proTag: 40,
        // P20 H5: Dauerlieger lassen ihr Boot hier aus dem Wasser holen (letzter Saisontag) und einsetzen (erster)
        dauerlieger: { krantage: true, preis: 60 } } },
      // Travellift
      { kosten: 6300, wirkung: { dienst: { anteil: 0.15, nur: { klasse: ['M', 'L', 'XL'] }, naechte: 1, preis: 300 }, gaeste: { L: 1.1 }, winter: { proTag: 600 }, dauerlieger: { krantage: true, preis: 60 } } },
      // Werfthalle mit Slipwagen
      // Werfthalle oder Winterlagerhalle (Entweder-oder, data/services.js WAHLPLAETZE)
      { kosten: 11500, ruf: 3.8, wirkung: { dienst: { anteil: 0.2, nur: { klasse: ['M', 'L', 'XL'] }, naechte: 2, preis: 450 }, gaeste: { L: 1.12 }, ruf: 0.08, winter: { proTag: 1100 }, dauerlieger: { krantage: true, preis: 70 } } },
    ] },
    winterlager: { abStufe: 4, stufen: [   // Winterlager
      // Freilager mit Böcken
      { kosten: 4500, braucht: [{ id: 'travellift', stufe: 2 }], wirkung: { winter: { proTag: 900 },
        // P20 H5: je Dauerlieger im eigenen Winterlager und Wintertag
        dauerlieger: { winter: 50 } } },
      // Winterlagerhalle
      { kosten: 12000, abStufe: 5, wirkung: { winter: { proTag: 2200 }, ruf: 0.06, gaeste: { L: 1.05 }, dauerlieger: { winter: 80 } } },
    ] },
    segelmacher: { abStufe: 4, stufen: [   // Segelmacher
      // Segelmacherei
      { kosten: 3400, braucht: [{ id: 'segelclub', stufe: 1 }], wirkung: { kunden: { anteil: 0.07, preis: 90, nur: { antrieb: 'segel' } }, hafengeld: { segel: 1.15 }, synergie: [{ id: 'mastenkran', faktor: 1.2 }],
        // P20 H5: segelnde Dauerlieger bringen regelmäßig Segel (Anteil je Tag und Dauerlieger im Hafen)
        dauerlieger: { anteil: 0.1, preis: 90, nur: { antrieb: 'segel' } } } },
      // Segelloft
      { kosten: 5000, abStufe: 5, wirkung: { kunden: { anteil: 0.1, preis: 120, nur: { antrieb: 'segel' } }, hafengeld: { segel: 1.2 }, synergie: [{ id: 'mastenkran', faktor: 1.2 }, { id: 'segelclub', faktor: 1.1 }], ruf: 0.05,
        dauerlieger: { anteil: 0.12, preis: 120, nur: { antrieb: 'segel' } } } },
    ] },
    seenotretter: { abStufe: 4, stufen: [   // Seenotretter-Station
      // Seenotrettungsboot
      { kosten: 3600, wirkung: { sturmschutz: 0.5, ruf: 0.15 } },
      // Seenotrettungskreuzer
      { kosten: 9000, abStufe: 6, wirkung: { sturmschutz: 0.8, ruf: 0.25, freischalten: ['seenotkreuzer'], besuch: { art: 'tag-der-seenotretter', alleTage: 15, ersterNach: 3, dauer: 1, einnahme: 900, gaeste: 600, ruf: 0.02 } } },
    ] },
    fahrgastanleger: { abStufe: 5, stufen: [   // Fahrgastanleger
      // Fahrgastanleger
      { kosten: 9400, wirkung: { freischalten: ['fahrgastschiff'], wetter: { regen: 0.6, sturm: 0 }, besuch: { art: 'ausflugsfahrt', alleTage: 1, ersterNach: 1, dauer: 1, einnahme: 160, gaeste: 60 }, proTag: 150 } },
      // Ausflugsflotte
      { kosten: 11500, ruf: 4, wirkung: { freischalten: ['fahrgastschiff'], wetter: { regen: 0.6, sturm: 0 }, ruf: 0.05, besuch: { art: 'ausflugsfahrt', alleTage: 1, ersterNach: 1, dauer: 1, einnahme: 360, gaeste: 140 } } },
    ] },
    museumshafen: { abStufe: 5, stufen: [   // Museumshafen
      // Museumshafen
      { kosten: 9900, ruf: 4, wirkung: { proTag: 80, freischalten: ['traditionssegler'], ruf: 0.12, gaeste: { XL: 1.5 } } },
      // Museumshafen mit Speicher
      { kosten: 13500, ruf: 4.2, wirkung: { proTag: 160, freischalten: ['traditionssegler'], ruf: 0.18, gaeste: { XL: 1.5 }, hafenfest: 1.5 } },
      // Windjammertreffen (Stufe 6). Stufen addieren sich nicht: proTag 160 aus Stufe 2 plus 120 für das Treffen
      { kosten: 15500, abStufe: 6, wirkung: { proTag: 280, freischalten: ['traditionssegler'], ruf: 0.18, gaeste: { XL: 1.6 }, hafenfest: 1.5, besuch: { art: 'windjammer', alleTage: 6, ersterNach: 2, dauer: 2, einnahme: 5000, gaeste: 1800, ruf: 0.03 } } },
    ] },
    barkasse: { abStufe: 6, stufen: [   // Barkasse
      // Barkasse
      { kosten: 4000, braucht: [{ id: 'fahrgastanleger', stufe: 1 }], wirkung: { proTag: 220, wetter: { regen: 0.5, sturm: 0 }, ruf: 0.03 } },
    ] },
    kreuzfahrtterminal: { abStufe: 6, stufen: [   // Kreuzfahrtterminal
      // Kreuzfahrtpier
      { kosten: 27000, ruf: 4, braucht: [{ id: 'fahrgastanleger', stufe: 1 }], wirkung: { freischalten: ['kreuzfahrtschiff'], besuch: { art: 'kreuzfahrt', alleTage: 4, ersterNach: 2, dauer: 1, einnahme: 6500, gaeste: 1500 } } },
      // Kreuzfahrtterminal
      { kosten: 54000, ruf: 4.5, wirkung: { freischalten: ['kreuzfahrtschiff'], ruf: 0.1, besuch: { art: 'kreuzfahrt', alleTage: 2, ersterNach: 1, dauer: 1, einnahme: 9500, gaeste: 2600 } } },
    ] },
    marineanleger: { abStufe: 6, stufen: [   // Marineanleger
      // Marineanleger
      { kosten: 22500, ruf: 4, braucht: [{ id: 'seenotretter', stufe: 1 }], wirkung: { freischalten: ['marine'], sturmschutz: 0.1, besuch: { art: 'flottenbesuch', alleTage: 5, ersterNach: 2, dauer: 2, einnahme: 3600, gaeste: 500, ruf: 0.02 } } },
      // Marinestützpunkt
      { kosten: 45000, ruf: 4.6, wirkung: { proTag: 450, freischalten: ['marine'], sturmschutz: 0.2, ruf: 0.08, besuch: { art: 'flottenbesuch', alleTage: 3, ersterNach: 2, dauer: 2, einnahme: 4200, gaeste: 2200, ruf: 0.03 } } },
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
    ablauf: { ruhigeTage: 1, ersterTag: 2, streuung: 0.3 },
    nebel:     { abStufe: 1, alleTage: 9, dauer: 1, vorrang: 1, saison: [1, 16],
                 wirkung: { arrivalFactor: 0.7, extraNights: 1 } },
    sommertag: { abStufe: 1, alleTage: 8, dauer: 1, vorrang: 2, saison: [3, 14],
                 wirkung: { arrivalFactor: 1.25, sizeFactor: { S: 2, M: 1.2 }, visitorFactor: 1.5, serviceIncomeFactor: 1.3 } },
    sturm:     { abStufe: 3, alleTage: 8, dauer: 1, vorrang: 4, saison: [2, 16],
                 wirkung: { seaArrivals: false, extraNights: 1, satisfaction: { outer: -1 } },
                 schutz: { durch: 'seenotretter', faktor: [1, 0.5, 0] } },
    regatta:   { abStufe: 3, braucht: 'segelclub', alleTage: 9, dauer: 1, vorrang: 5, ankuendigen: 2, saison: [2, 16],
                 // kindFactor: Schlüssel sind die Bootsarten (kind) aus data/boat-catalog.js
                 wirkung: { arrivalFactor: 1.6, kindFactor: { jolle: 3, segelyacht: 3, mehrrumpf: 2 },
                   visitorFactor: 1.5, serviceIncomeFactor: 1.3, ratingBonus: 0.25 },
                 // Vorbereiten (events/vorbereiten.js): so viele Plätze je Stufe für Segler freihalten,
                 // jedes Segelboot darauf zahlt einmal Startgeld je Klasse (Klassen ohne Betrag nehmen nicht teil)
                 vorbereiten: { plaetze: { 3: 3, 4: 4, 5: 5, 6: 6 }, startgeld: { S: 8, M: 15, L: 25 } } },
    hafenfest: { abStufe: 4, alleTage: 11, dauer: 1, vorrang: 4, saison: [5, 13],
                 // Traditionssegler (XL) kommen erst ab Stufe 5, vorher nur mehr Boote und Besucher
                 wirkung: { arrivalFactor: 1.3, kindFactor: { traditionssegler: 6 }, sizeFactor: { XL: 2 },
                   visitorFactor: 2, serviceIncomeFactor: 1.5, ratingBonus: 0.25 } },
    // ---- Neue Ereignisse (P24, F17) und Bindung an Bauten (G7) ----------------------------------
    // menschen: mehr Spaziergänger (ort) und Badegäste (strand) im Bild (render/people.js), abends: wer bleibt.
    // bauten: gebaute Services machen das Ereignis größer. Je Bau und Ereignistag abends Geld (proTag je
    // Ausbaustufe des Baus), dazu optional mehr Wirkung (wirkung wird zur Wirkung des Ereignisses gemischt).
    // Ohne den Bau nennt die Ankündigung, was er bringen würde (events/vorbereiten.js baubonus).
    // Mittsommer: die hellste Nacht des Jahres, einmal je Saison um den Saisontag 7 (Saisonmitte)
    // amTag: fester Saisontag, die anderen Ereignisse halten davor und danach Abstand
    mittsommer: { abStufe: 2, amTag: 7, alleTage: 18, dauer: 1, vorrang: 6, saison: [7, 7],
                  wirkung: { arrivalFactor: 1.15, visitorFactor: 1.6, serviceIncomeFactor: 1.3, extraNights: 1 },
                  menschen: { ort: 1.5, strand: 2, abends: { ort: 1.6, strand: 3 } },
                  bauten: { grillplatz: { proTag: [60], text: 'Mittsommerfeuer am Grillplatz' },
                            eisdiele: { proTag: [40, 70], text: 'Eis bis in die Nacht' } } },
    // Heringstage: Frühjahrsfang, nur mit Räucherei (sie ist der Grund für das Fest)
    heringstage: { abStufe: 2, braucht: 'raeucherei', amTag: 3, alleTage: 18, dauer: 1, vorrang: 5, saison: [3, 3],
                   wirkung: { visitorFactor: 1.5, serviceIncomeFactor: 1.2, kindFactor: { M4: 2 } },
                   menschen: { ort: 1.6 },
                   bauten: { raeucherei: { proTag: [70, 140], text: 'Räucherei: Heringsbrötchen' },
                             fischhalle: { proTag: [120, 200], text: 'Fischhalle: Heringsmarkt' } } },
    // Holzboot-Treffen: Klassiker aus Holz und Ruderboote, mit Museumshafen auch Traditionssegler
    holzboote: { abStufe: 3, alleTage: 11, dauer: 1, vorrang: 5, saison: [3, 15],
                 wirkung: { arrivalFactor: 1.2, kindFactor: { M2: 5, S1: 2 }, visitorFactor: 1.3, ratingBonus: 0.15 },
                 menschen: { ort: 1.3 },
                 bauten: { museumshafen: { proTag: [150, 250], text: 'Museumshafen: Holzboote ansehen',
                                           wirkung: { kindFactor: { traditionssegler: 3 }, visitorFactor: 1.3 } },
                           slip: { proTag: [30, 50], text: 'Slipanlage: Holzboote zu Wasser' },
                           segelmacher: { proTag: [60, 90], text: 'Segelmacher: alte Segel flicken' } } },
    // Hanse-Woche (G9): selten und groß, zehn Tage vorher angekündigt, einmal im Jahr ab Stufe 5.
    // Plant sich neben den anderen Ereignissen (ab fünf Tagen Ankündigung: eigener Platz im Planer), die halten Abstand.
    // vorbereiten: so viele große Plätze (für L und XL) bis zum Start freihalten; jedes große Schiff
    // darauf zahlt einmal Festgeld je Klasse.
    hansewoche: { abStufe: 5, alleTage: 18, dauer: 2, vorrang: 9, ankuendigen: 5, saison: [11, 15],
                  wirkung: { arrivalFactor: 1.5, kindFactor: { traditionssegler: 6, M2: 2 }, sizeFactor: { XL: 2, L: 1.3 },
                    visitorFactor: 2.2, serviceIncomeFactor: 1.6, ratingBonus: 0.3 },
                  menschen: { ort: 2, strand: 1.4, abends: { ort: 1.6 } },
                  bauten: { museumshafen: { proTag: [300, 500], text: 'Museumshafen: Hanse-Markt am Kai' },
                            hafencafe: { proTag: [80, 120], text: 'Hafencafé: Festgäste' } },
                  vorbereiten: { plaetze: { 5: 3, 6: 4 }, festgeld: { L: 40, XL: 90 } } },
    // Nachspiel (G3): nach dem letzten Ereignistag wirkt etwas nach (tage, wirkung). Wer vorbereitet war
    // (Sturmklar, Plätze freigehalten), bekommt zusätzlich wirkungVorbereitet. Steht im Wetterbericht.
    nachspiel: {
      sturm:      { tage: 1, wirkung: { arrivalFactor: 1.4 },
                    wirkungVorbereitet: { ratingBonus: 0.15 } },
      regatta:    { tage: 1, wirkung: { kindFactor: { jolle: 1.5, segelyacht: 1.5 } },
                    wirkungVorbereitet: { ratingBonus: 0.1 } },
      hafenfest:  { tage: 2, wirkung: { arrivalFactor: 1.15, visitorFactor: 1.3 } },
      hansewoche: { tage: 2, wirkung: { arrivalFactor: 1.2, visitorFactor: 1.4, kindFactor: { traditionssegler: 2 } },
                    wirkungVorbereitet: { ratingBonus: 0.1 } },
    },
    // Wintertage: Boote im Winterlager, kaum Gäste
    winter:    { wirkung: { winter: true, arrivalFactor: 0.15, visitorFactor: 0.3, serviceIncomeFactor: 0.5 } },
  },

  // ---------------------------------------------------------------- Winterarbeiten (P20)
  // Am ersten Wintertag liegen drei Aufträge zur Wahl, jeder wirkt die ganze nächste Saison
  // (werbung nur im Frühling). kosten je Ausbaustufe 1 bis 6. Logik in web/js/features/winter.js,
  // Beschreibung in docs/winter.md.
  winterarbeiten: {
    // Einen Steg überholen: Gäste an diesem Steg bewerten um bonus Anker besser
    steg:     { kosten: [25, 100, 290, 720, 1400, 2300], bonus: 0.3 },
    // Frühjahrswerbung in Segelvereinen: im Frühling (Saisontag 1 bis bisTag) kommen mehr Boote
    werbung:  { kosten: [20, 80, 220, 580, 1200, 1900], faktor: 1.25, bisTag: 4 },
    // Sanitär winterfest machen: Gäste mit Wunsch Toilette oder Dusche bewerten um bonus Anker besser
    sanitaer: { kosten: [20, 70, 200, 500, 990, 1600], bonus: 0.2, wuensche: ['wc', 'dusche'] },
    // Hafenbecken ausbaggern: große Boote kommen öfter (Faktor je Klasse), ab Stufe 3
    baggern:  { abStufe: 3, kosten: [0, 0, 400, 990, 1900, 3100], faktor: 1.25, klassen: ['L', 'XL'] },
  },

  // ---------------------------------------------------------------- Endlosspiel (P16)
  // Nach dem Abschluss der Region geht das Spiel weiter: jede Saison neue Saisonziele.
  // Logik in web/js/features/aufstieg.js, Beschreibung in docs/aufstieg.md.
  // Gemessen mit tools/balance.mjs --verlauf (geschickter Spieler, Stufe 6 voll ausgebaut):
  // etwa 30 Gäste und 10.000 € am Tag (P17: 16-Tage-Saison, Kosten x0,45), Ruf nahe 5, 7 bis 9 Besuche großer Schiffe je Saison.
  // start = Ziel der ersten Saison, jeSaison = Zuwachs je weitere Saison, max = Obergrenze.
  // Beginnt das Endlosspiel mitten in der Saison, gelten die Zählziele anteilig für die
  // restlichen Tage; sind es weniger als mindestTage, beginnen die Ziele mit der nächsten Saison.
  endlos: {
    mindestTage: 4,
    ziele: {
      gaeste:       { start: 450,    jeSaison: 30,    max: 650 },
      ruf:          { start: 4.4,    jeSaison: 0.05,  max: 4.8 },
      grossschiffe: { start: 5,      jeSaison: 1,     max: 9 },
      einnahmen:    { start: 150000, jeSaison: 10000, max: 230000 },   // in ungeraden Saisons
      xl:           { start: 40,     jeSaison: 5,     max: 80 },       // in geraden Saisons
    },
    belohnung: { jeZiel: 2300, alleZiele: 4500 },
    // Rang nach gesammelten Sternen (ein Stern je erreichtem Saisonziel)
    raenge: [
      { sterne: 0,  titel: 'Hafenmeister' },
      { sterne: 4,  titel: 'Leitender Hafenmeister' },
      { sterne: 10, titel: 'Hafenkapitän' },
      { sterne: 18, titel: 'Hafendirektor' },
      { sterne: 28, titel: 'Ehrenhafenmeister' },
    ],
  },
};

export default ECONOMY;
