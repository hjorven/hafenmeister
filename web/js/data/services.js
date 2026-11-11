// Hafenmeister: Services und Sonderanlagen.
// Reine Daten, kein Three.js. Regeln dazu in js/services/rules.js, 3D in js/render/services.js.
//
// Nicht enthalten (gehoeren zu den Spielregeln, js/sim.js): die 5 Wuensche WC, Dusche, Kiosk/Restaurant,
// Strom, Tankstelle sowie Hafenbuero und Stege.
//
// Felder je Service
//   id, name, kurz         Kennung, Anzeigename, eine Zeile fuer die Baukarte
//   gruppe                 freizeit | handwerk | sicherheit | grosse-schiffe
//   abStufe                ab welcher Ausbaustufe des Hafens (1 bis 6, plan.md Abschnitt 4) die erste Stufe baubar ist
//   lage                   { x, y, dreh } in Planeinheiten wie js/data/harbor.js (1 Einheit = 0,62 m,
//                          x nach Osten, y nach Norden), dreh in Grad gegen den Uhrzeigersinn.
//                          Eine Stufe kann eine eigene lage haben (die Raeucherei zieht um).
//   radius                 Antippen: Umkreis um lage in Metern
//   stufen[]               Ausbaustufen des Service, jede mit
//     name, kosten         Anzeigename, Baukosten in Euro
//     abStufe              optional, spaetere Hafenstufe fuer diese Ausbaustufe
//     braucht              optional, [{ id, stufe }] andere Services, die vorher stehen muessen
//     ruf                  optional, Mindestruf (0 bis 5)
//     wirkung              siehe unten
//
// wirkung (alles optional, gilt fuer genau diese Stufe, nicht aufsummiert)
//   proTag                 feste Einnahme pro Tag in Euro
//   wetter                 Faktor fuer proTag je Wetter, z. B. { regen: 0.5, sturm: 0 }
//   kunden                 { anteil, preis, nur } Anteil der Boote des Tages, die zahlen, Preis je Kunde,
//                          nur = Filter { antrieb: 'segel'|'motor', klasse: ['S','M'] }
//   synergie               [{ id, faktor }] Kundeneinnahmen x faktor, wenn der andere Service steht
//   ruf                    Bonus auf den Ruf (alle Services zusammen hoechstens RUF_BONUS_MAX)
//   gaeste                 { S: 1.1 } mehr ankommende Boote je Klasse (Faktoren werden multipliziert)
//   sturmschutz            0 bis 1, Anteil der Sturmschaeden, der verhindert wird (zusammen hoechstens 0.8)
//   regatta                Faktor fuer Einnahmen bei Regatten (Thread Ereignisse)
//   freischalten           Schiffsarten, die erst damit kommen, z. B. 'traditionssegler'
//   winter                 { proTag } Einnahme pro Wintertag (Jahreslauf, plan.md Abschnitt 7)
//   hafengeld              { segel: 1.1 } Faktor aufs Hafengeld je Antrieb (wendet sim.js an)
//   hafenfest              Faktor fuer Einnahmen beim Hafenfest (Thread Ereignisse)
//   besucherFuerVersorgung zusaetzliche Tagesbesucher fuer Kiosk und Restaurant (wendet sim.js an)
//   besuch                 { art, alleTage, ersterNach, dauer, einnahme, gaeste, ruf, text }
//                          regelmaessiger Besuch mit Vorfreude: Die Oberflaeche kann "kommt in 3 Tagen" zeigen.
//
// Preise sind Startwerte fuers Balancing (Thread "Balancing fuer 94 Liegeplaetze").

export const RUF_BONUS_MAX = 0.75;
export const STURMSCHUTZ_MAX = 0.8;

export const GRUPPEN = {
  'freizeit': 'Freizeit',
  'handwerk': 'Handwerk und Technik',
  'sicherheit': 'Sicherheit',
  'grosse-schiffe': 'Große Schiffe',
};

export const SERVICES = [
  // ------------------------------------------------------------------ Stufe 1 und 2: am See
  {
    id: 'bootsverleih', name: 'Bootsverleih', gruppe: 'freizeit', abStufe: 1,
    kurz: 'Badegäste mieten Boote. Bringt bei Sonne jeden Tag etwas Geld.',
    lage: { x: -126, y: -22, dreh: 0 }, radius: 9,
    stufen: [
      { name: 'Ruderboote am Strand', kosten: 120,
        wirkung: { proTag: 14, wetter: { regen: 0.3, sturm: 0 } } },
      { name: 'Tretboote und Kanus', kosten: 650, abStufe: 2,
        wirkung: { proTag: 42, wetter: { regen: 0.3, sturm: 0 }, ruf: 0.03 } },
      { name: 'SUP- und Jollenverleih', kosten: 2600, abStufe: 3,
        wirkung: { proTag: 95, wetter: { regen: 0.25, sturm: 0 }, ruf: 0.06, gaeste: { S: 1.05 } } },
    ],
  },
  {
    id: 'slip', name: 'Slipanlage', gruppe: 'handwerk', abStufe: 2,
    kurz: 'Rampe ins Wasser. Trailerboote kommen über Land, ganz ohne Liegeplatz.',
    lage: { x: -127, y: -6, dreh: 0 }, radius: 7,
    stufen: [
      { name: 'Slipanlage', kosten: 400,
        wirkung: { proTag: 24, wetter: { regen: 0.4, sturm: 0 }, kunden: { anteil: 0.1, preis: 6, nur: { klasse: ['S', 'M'] } } } },
      { name: 'Slip mit Trailerparkplatz', kosten: 1600, abStufe: 3,
        wirkung: { proTag: 60, wetter: { regen: 0.4, sturm: 0 }, kunden: { anteil: 0.12, preis: 10, nur: { klasse: ['S', 'M'] } }, gaeste: { S: 1.05 } } },
    ],
  },
  {
    id: 'raeucherei', name: 'Räucherei', gruppe: 'freizeit', abStufe: 2,
    kurz: 'Fischbrötchen am Steg. Gäste mögen das, der Ruf steigt.',
    lage: { x: -176, y: -26, dreh: 0 }, radius: 7,
    stufen: [
      { name: 'Räucherkate', kosten: 700,
        wirkung: { proTag: 25, kunden: { anteil: 0.3, preis: 4 }, ruf: 0.05 } },
      { name: 'Räucherei mit Fischladen', kosten: 2200, abStufe: 3,
        wirkung: { proTag: 60, kunden: { anteil: 0.35, preis: 5 }, ruf: 0.08 } },
    ],
  },

  {
    id: 'fischhalle', name: 'Fischhalle', gruppe: 'freizeit', abStufe: 5,
    kurz: 'Frischer Fang am Fischereikai. Fischerboote bringen Besucher an Kiosk und Restaurant.',
    lage: { x: -30, y: 204, dreh: 180 }, radius: 10,
    stufen: [
      { name: 'Fischhalle', kosten: 7000, braucht: [{ id: 'raeucherei', stufe: 1 }],
        wirkung: { proTag: 120, kunden: { anteil: 0.3, preis: 5 }, ruf: 0.08, besucherFuerVersorgung: 40 } },
      { name: 'Fischhalle mit Fischmarkt', kosten: 16000,
        wirkung: { proTag: 260, kunden: { anteil: 0.4, preis: 6 }, ruf: 0.12, besucherFuerVersorgung: 90 } },
    ],
  },

  // ------------------------------------------------------------------ Stufe 3: Durchstich
  {
    id: 'segelclub', name: 'Segelclub', gruppe: 'freizeit', abStufe: 3,
    kurz: 'Vereinsheim mit Jollen. Mehr Jollen kommen, Regatten werden möglich.',
    lage: { x: -196, y: -44, dreh: 0 }, radius: 11,
    stufen: [
      { name: 'Segelclub', kosten: 2400,
        wirkung: { proTag: 20, ruf: 0.08, gaeste: { S: 1.1 }, freischalten: ['regatta'] } },
      { name: 'Segelschule', kosten: 6000, abStufe: 4,
        wirkung: { proTag: 120, wetter: { regen: 0.6, sturm: 0 }, ruf: 0.12, gaeste: { S: 1.15, M: 1.05 }, freischalten: ['regatta'] } },
      { name: 'Regattaverein', kosten: 15000, abStufe: 4, ruf: 3.8,
        wirkung: { proTag: 150, wetter: { regen: 0.6, sturm: 0 }, ruf: 0.16, gaeste: { S: 1.15, M: 1.1, L: 1.05 }, freischalten: ['regatta'], regatta: 1.3 } },
    ],
  },
  {
    id: 'mastenkran', name: 'Mastenkran', gruppe: 'handwerk', abStufe: 3,
    kurz: 'Masten stellen und legen. Segelboote aus dem Binnenland kommen dazu.',
    lage: { x: 70, y: -2, dreh: 0 }, radius: 6,
    stufen: [
      { name: 'Mastenkran', kosten: 1800,
        wirkung: { kunden: { anteil: 0.08, preis: 35, nur: { antrieb: 'segel' } }, gaeste: { M: 1.1 } } },
    ],
  },
  {
    id: 'ausruester', name: 'Bootsausrüster', gruppe: 'handwerk', abStufe: 3,
    kurz: 'Laden für Fender, Seekarten und Ersatzteile.',
    lage: { x: 84, y: -34, dreh: 0 }, radius: 7,
    stufen: [
      { name: 'Bootsausrüster', kosten: 3000,
        wirkung: { kunden: { anteil: 0.2, preis: 15 } } },
      { name: 'Yachtausrüster mit Motorenwerkstatt', kosten: 9000, abStufe: 4,
        wirkung: { kunden: { anteil: 0.25, preis: 24 }, synergie: [{ id: 'travellift', faktor: 1.15 }], ruf: 0.04 } },
    ],
  },

  // ------------------------------------------------------------------ Stufe 4: Marina
  {
    id: 'travellift', name: 'Travellift und Werft', gruppe: 'handwerk', abStufe: 4,
    kurz: 'Reparaturaufträge, auch außerhalb der Saison. Die große Einnahmequelle der Marina.',
    lage: { x: 156, y: -6, dreh: 0 }, radius: 16,
    stufen: [
      { name: 'Bootsschuppen mit Werkstatt', kosten: 6000, braucht: [{ id: 'mastenkran', stufe: 1 }],
        wirkung: { kunden: { anteil: 0.06, preis: 120 }, winter: { proTag: 250 } } },
      { name: 'Travellift', kosten: 14000,
        wirkung: { kunden: { anteil: 0.08, preis: 170 }, gaeste: { L: 1.1 }, winter: { proTag: 600 } } },
      { name: 'Werfthalle mit Slipwagen', kosten: 26000, ruf: 3.8,
        wirkung: { kunden: { anteil: 0.1, preis: 190 }, gaeste: { L: 1.12 }, ruf: 0.08, winter: { proTag: 1100 } } },
    ],
  },
  {
    id: 'winterlager', name: 'Winterlager', gruppe: 'handwerk', abStufe: 4,
    kurz: 'Boote überwintern an Land. Bringt im Winter gutes Geld.',
    lage: { x: 182, y: -56, dreh: 0 }, radius: 16,
    stufen: [
      { name: 'Freilager mit Böcken', kosten: 5000, braucht: [{ id: 'travellift', stufe: 2 }],
        wirkung: { winter: { proTag: 900 } } },
      { name: 'Winterlagerhalle', kosten: 22000,
        wirkung: { winter: { proTag: 2400 }, ruf: 0.06, gaeste: { L: 1.05 } } },
    ],
  },
  {
    id: 'segelmacher', name: 'Segelmacher', gruppe: 'handwerk', abStufe: 4,
    kurz: 'Näht und flickt Segel. Segelyachten zahlen mehr Hafengeld.',
    lage: { x: 122, y: -52, dreh: 0 }, radius: 8,
    stufen: [
      { name: 'Segelmacherei', kosten: 4000, braucht: [{ id: 'segelclub', stufe: 1 }],
        wirkung: { kunden: { anteil: 0.07, preis: 90, nur: { antrieb: 'segel' } }, hafengeld: { segel: 1.1 },
          synergie: [{ id: 'mastenkran', faktor: 1.2 }] } },
      { name: 'Segelloft', kosten: 11000, abStufe: 5,
        wirkung: { kunden: { anteil: 0.1, preis: 120, nur: { antrieb: 'segel' } }, hafengeld: { segel: 1.2 },
          synergie: [{ id: 'mastenkran', faktor: 1.2 }, { id: 'segelclub', faktor: 1.1 }], ruf: 0.05 } },
    ],
  },
  {
    id: 'seenotretter', name: 'Seenotretter-Station', gruppe: 'sicherheit', abStufe: 4,
    kurz: 'Ein Rettungsboot in der Kanalmündung. Weniger Sturmschäden, mehr Vertrauen.',
    lage: { x: 200, y: 211, dreh: 0 }, radius: 16,
    stufen: [
      { name: 'Seenotrettungsboot', kosten: 5000,
        wirkung: { sturmschutz: 0.3, ruf: 0.15 } },
      { name: 'Seenotrettungskreuzer', kosten: 20000, abStufe: 6,
        wirkung: { sturmschutz: 0.55, ruf: 0.25, freischalten: ['seenotkreuzer'],
          besuch: { art: 'tag-der-seenotretter', alleTage: 28, ersterNach: 5, dauer: 1, einnahme: 900, gaeste: 600, ruf: 0.02,
            text: 'Tag der Seenotretter: Besichtigung und Vorführung' } } },
    ],
  },

  // ------------------------------------------------------------------ Stufe 5 und 6: Kuestenmarina und Seehafen
  {
    id: 'fahrgastanleger', name: 'Fahrgastanleger', gruppe: 'grosse-schiffe', abStufe: 5,
    kurz: 'Ausflugsschiffe fahren täglich raus. Bringt Gäste und Kleingeld.',
    lage: { x: 13, y: 216, dreh: 0 }, radius: 10,
    stufen: [
      { name: 'Fahrgastanleger', kosten: 12000,
        wirkung: { freischalten: ['fahrgastschiff'], wetter: { regen: 0.6, sturm: 0 },
          besuch: { art: 'ausflugsfahrt', alleTage: 1, ersterNach: 1, dauer: 1, einnahme: 160, gaeste: 60,
            text: 'Ausflugsfahrt zu den Seehunden' } } },
      { name: 'Ausflugsflotte', kosten: 26000, ruf: 4.0,
        wirkung: { freischalten: ['fahrgastschiff'], wetter: { regen: 0.6, sturm: 0 }, ruf: 0.05,
          besuch: { art: 'ausflugsfahrt', alleTage: 1, ersterNach: 1, dauer: 1, einnahme: 360, gaeste: 140,
            text: 'Ausflugsfahrten zu Seehunden und Leuchtturm' } } },
    ],
  },
  {
    id: 'museumshafen', name: 'Museumshafen', gruppe: 'grosse-schiffe', abStufe: 5,
    kurz: 'Kaimauer für Traditionssegler vor alten Speichern. Hafenfeste werden größer.',
    lage: { x: 132, y: 212, dreh: 0 }, radius: 12,
    stufen: [
      { name: 'Museumshafen', kosten: 18000, ruf: 4.0,
        wirkung: { proTag: 80, freischalten: ['traditionssegler'], ruf: 0.12, gaeste: { XL: 1.2 } } },
      { name: 'Museumshafen mit Speicher', kosten: 30000, ruf: 4.2,
        wirkung: { proTag: 160, freischalten: ['traditionssegler'], ruf: 0.18, gaeste: { XL: 1.3 }, hafenfest: 1.5 } },
    ],
  },
  {
    id: 'kreuzfahrtterminal', name: 'Kreuzfahrtterminal', gruppe: 'grosse-schiffe', abStufe: 6,
    kurz: 'Pier vor der Ostmole. Einmal pro Woche legt ein Kreuzfahrtschiff an.',
    lage: { x: 268, y: 206, dreh: 0 }, radius: 24,
    stufen: [
      { name: 'Kreuzfahrtpier', kosten: 60000, ruf: 4.0, braucht: [{ id: 'fahrgastanleger', stufe: 1 }],
        wirkung: { freischalten: ['kreuzfahrtschiff'],
          besuch: { art: 'kreuzfahrt', alleTage: 7, ersterNach: 3, dauer: 1, einnahme: 6500, gaeste: 1500,
            text: 'Kreuzfahrtschiff legt an' } } },
      { name: 'Kreuzfahrtterminal', kosten: 120000, ruf: 4.5,
        wirkung: { freischalten: ['kreuzfahrtschiff'], ruf: 0.1,
          besuch: { art: 'kreuzfahrt', alleTage: 4, ersterNach: 2, dauer: 1, einnahme: 9500, gaeste: 2600,
            text: 'Kreuzfahrtschiff legt an' } } },
    ],
  },
  {
    id: 'marineanleger', name: 'Marineanleger', gruppe: 'sicherheit', abStufe: 6,
    kurz: 'Liegeplatz für Marineschiffe. Flottenbesuche bringen Zuschauer.',
    lage: { x: -215, y: 206, dreh: 0 }, radius: 24,
    stufen: [
      { name: 'Marineanleger', kosten: 50000, ruf: 4.0, braucht: [{ id: 'seenotretter', stufe: 1 }],
        wirkung: { freischalten: ['marine'], sturmschutz: 0.1,
          besuch: { art: 'flottenbesuch', alleTage: 10, ersterNach: 4, dauer: 2, einnahme: 3600, gaeste: 500, ruf: 0.02,
            text: 'Flottenbesuch: Marineschiffe machen fest' } } },
      { name: 'Marinestützpunkt', kosten: 100000, ruf: 4.6,
        wirkung: { proTag: 450, freischalten: ['marine'], sturmschutz: 0.2, ruf: 0.08,
          besuch: { art: 'offene-tuer', alleTage: 14, ersterNach: 6, dauer: 1, einnahme: 2800, gaeste: 2200, ruf: 0.03,
            text: 'Tag der offenen Tür am Stützpunkt' } } },
    ],
  },
];

export const SERVICE_BY_ID = Object.fromEntries(SERVICES.map((s) => [s.id, s]));

export default SERVICES;
