// Hafenmeister: Services und Sonderanlagen.
// Reine Daten, kein Three.js. Regeln dazu in js/services/rules.js, 3D in js/render/services.js.
//
// Nicht enthalten (gehoeren zu den Spielregeln, js/sim.js): die 5 Wuensche WC, Dusche, Kiosk/Restaurant,
// Strom, Tankstelle sowie Hafenbuero und Stege.
//
// Alle Zahlen (Kosten, Hafenstufe, Mindestruf, Voraussetzungen, Wirkung) stehen in js/data/economy.js
// unter ECONOMY.services. Hier stehen nur Namen, Texte und Lage. SERVICES unten fügt beides zusammen.
//
// Felder je Service hier
//   id, name, kurz         Kennung, Anzeigename, eine Zeile für die Baukarte
//   gruppe                 freizeit | an-land | handwerk | sicherheit | grosse-schiffe
//   lage                   { x, y, dreh } in Planeinheiten wie js/data/harbor.js (1 Einheit = 0,62 m,
//                          x nach Osten, y nach Norden), dreh in Grad gegen den Uhrzeigersinn.
//   radius                 Antippen: Umkreis um lage in Metern
//   stufen[]               je Ausbaustufe name, optional besuchText (Text zum regelmäßigen Besuch)
//
// Felder je Service in ECONOMY.services
//   abStufe                ab welcher Ausbaustufe des Hafens (1 bis 6) die erste Stufe baubar ist
//   stufen[]               Ausbaustufen in derselben Reihenfolge wie hier, jede mit
//     kosten               Baukosten in Euro
//     abStufe              optional, spätere Hafenstufe für diese Ausbaustufe
//     braucht              optional, [{ id, stufe }] andere Services, die vorher stehen müssen
//     ruf                  optional, Mindestruf (0 bis 5)
//     wirkung              siehe unten
//
// wirkung (alles optional, gilt fuer genau diese Stufe, nicht aufsummiert)
//   proTag                 feste Einnahme pro Tag in Euro
//   wetter                 Faktor fuer proTag je Wetter, z. B. { regen: 0.5, sturm: 0 }
//   kunden                 { anteil, preis, nur } Anteil der Boote des Tages, die zahlen, Preis je Kunde,
//                          nur = Filter { antrieb: 'segel'|'motor', klasse: ['S','M'] }
//   synergie               [{ id, faktor }] Kundeneinnahmen x faktor, wenn der andere Service steht
//   ruf                    frueher Bonus auf jede Bewertung; seit P19 wuenschen sich Gaeste Angebote
//                          (economy.js angebotWunsch), der Wert zaehlt nicht mehr fuer die Note
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
//                          text kommt aus besuchText der Stufe hier.

import { ECONOMY } from './economy.js';

export const RUF_BONUS_MAX = 0.75;
export const STURMSCHUTZ_MAX = 0.8;

export const GRUPPEN = {
  'freizeit': 'Freizeit',
  'an-land': 'Angebote an Land',
  'handwerk': 'Handwerk und Technik',
  'sicherheit': 'Sicherheit',
  'grosse-schiffe': 'Große Schiffe',
};

const TEXTE = [
  // ------------------------------------------------------------------ Stufe 1 und 2: am See
  {
    id: 'bootsverleih', name: 'Bootsverleih', gruppe: 'freizeit',
    kurz: 'Badegäste mieten Boote. Bringt bei Sonne jeden Tag etwas Geld.',
    lage: { x: -126, y: -22, dreh: 0 }, radius: 9,
    stufen: [
      { name: 'Ruderboote am Strand' },
      { name: 'Tretboote und Kanus' },
      { name: 'SUP- und Jollenverleih' },
    ],
  },
  {
    id: 'slip', name: 'Slipanlage', gruppe: 'handwerk',
    kurz: 'Rampe ins Wasser. Trailerboote kommen über Land, ganz ohne Liegeplatz.',
    lage: { x: -127, y: -6, dreh: 0 }, radius: 7,
    stufen: [
      { name: 'Slipanlage' },
      { name: 'Slip mit Trailerparkplatz' },
    ],
  },
  {
    id: 'raeucherei', name: 'Räucherei', gruppe: 'freizeit',
    kurz: 'Fischbrötchen am Steg. Gäste, die Räucherfisch wollen, sind zufrieden.',
    lage: { x: -228, y: -21, dreh: 0 }, radius: 7,
    stufen: [
      { name: 'Räucherkate' },
      { name: 'Räucherei mit Fischladen' },
    ],
  },

  {
    id: 'fischhalle', name: 'Fischhalle', gruppe: 'freizeit',
    kurz: 'Frischer Fang am Fischereikai. Fischerboote bringen Besucher an Kiosk und Restaurant.',
    lage: { x: -30, y: 210, dreh: 180 }, radius: 10,
    stufen: [
      { name: 'Fischhalle' },
      { name: 'Fischhalle mit Fischmarkt' },
    ],
  },

  // ------------------------------------------------------------------ Angebote an Land (docs/echter-hafen.md, C11)
  // Jedes Angebot hat seine Tageszeit: Die Menschen im Hafen gehen dann hin (js/data/people.js, ZIELE),
  // das Modell zeigt, ob offen ist (Klappe, Schirme, Fahrräder im Ständer, Feuer).
  {
    id: 'baecker', name: 'Bäcker', gruppe: 'an-land',
    kurz: 'Frische Brötchen am Morgen. Die Crews holen sie, die Gäste bewerten besser.',
    lage: { x: -56, y: -22, dreh: 0 }, radius: 6,
    stufen: [
      { name: 'Brötchenservice' },
      { name: 'Hafenbäcker' },
    ],
  },
  {
    id: 'hafencafe', name: 'Hafencafé', gruppe: 'an-land',
    kurz: 'Kaffee und Kuchen am Nachmittag, mit Blick aufs Wasser.',
    lage: { x: -24, y: -14, dreh: 0 }, radius: 8,
    stufen: [
      { name: 'Hafencafé' },
      { name: 'Café mit Terrasse' },
    ],
  },
  {
    id: 'grillplatz', name: 'Grillplatz', gruppe: 'an-land',
    kurz: 'Grill und Bänke am Strand. Abends sitzen die Crews zusammen. Bringt kein Geld, aber Gäste wünschen ihn sich.',
    lage: { x: -163, y: -7, dreh: 0 }, radius: 7,
    stufen: [
      { name: 'Grillplatz' },
    ],
  },
  {
    id: 'fahrradverleih', name: 'Fahrradverleih', gruppe: 'an-land',
    kurz: 'Räder für Landausflüge. Tagsüber ist der Ständer leer.',
    lage: { x: -18, y: -32, dreh: 0 }, radius: 6,
    stufen: [
      { name: 'Fahrradverleih' },
    ],
  },
  {
    id: 'eisdiele', name: 'Eisdiele', gruppe: 'an-land',
    kurz: 'Eis am Nachmittag. Bei Sonne ist richtig was los.',
    lage: { x: 96, y: -12, dreh: 0 }, radius: 6,
    stufen: [
      { name: 'Eisdiele' },
    ],
  },

  // ------------------------------------------------------------------ Stufe 3: Durchstich
  {
    id: 'segelclub', name: 'Segelclub', gruppe: 'freizeit',
    kurz: 'Vereinsheim mit Jollen. Mehr Jollen kommen, Regatten werden möglich.',
    lage: { x: -196, y: -44, dreh: 0 }, radius: 11,
    stufen: [
      { name: 'Segelclub' },
      { name: 'Segelschule' },
      { name: 'Regattaverein' },
    ],
  },
  {
    id: 'mastenkran', name: 'Mastenkran', gruppe: 'handwerk',
    kurz: 'Masten stellen und legen. Segelboote aus dem Binnenland kommen dazu.',
    lage: { x: 70, y: -2, dreh: 0 }, radius: 6,
    stufen: [
      { name: 'Mastenkran' },
    ],
  },
  {
    id: 'ausruester', name: 'Bootsausrüster', gruppe: 'handwerk',
    kurz: 'Laden für Fender, Seekarten und Ersatzteile.',
    lage: { x: 84, y: -34, dreh: 0 }, radius: 7,
    stufen: [
      { name: 'Bootsausrüster' },
      { name: 'Yachtausrüster mit Motorenwerkstatt' },
    ],
  },

  // ------------------------------------------------------------------ Stufe 4: Marina
  {
    id: 'travellift', name: 'Travellift und Werft', gruppe: 'handwerk',
    kurz: 'Reparaturaufträge, auch außerhalb der Saison. Die große Einnahmequelle der Marina.',
    lage: { x: 156, y: -6, dreh: 0 }, radius: 16,
    stufen: [
      { name: 'Bootsschuppen mit Werkstatt' },
      { name: 'Travellift' },
      { name: 'Werfthalle mit Slipwagen' },
    ],
  },
  {
    id: 'winterlager', name: 'Winterlager', gruppe: 'handwerk',
    kurz: 'Boote überwintern an Land. Bringt im Winter gutes Geld.',
    lage: { x: 182, y: -56, dreh: 0 }, radius: 16,
    stufen: [
      { name: 'Freilager mit Böcken' },
      { name: 'Winterlagerhalle' },
    ],
  },
  {
    id: 'segelmacher', name: 'Segelmacher', gruppe: 'handwerk',
    kurz: 'Näht und flickt Segel. Segelyachten zahlen mehr Hafengeld.',
    lage: { x: 122, y: -52, dreh: 0 }, radius: 8,
    stufen: [
      { name: 'Segelmacherei' },
      { name: 'Segelloft' },
    ],
  },
  {
    id: 'seenotretter', name: 'Seenotretter-Station', gruppe: 'sicherheit',
    kurz: 'Ein Rettungsboot an der Ostmole. Weniger Sturmschäden, mehr Vertrauen.',
    // Station am eigenen Boot: Stufe 1 am Dienststeg an der Ostmole (harbor.js dienste), der Kreuzer
    // liegt an SK01 an der Westmole, dafuer zieht die Station an die Wurzel der Westmole.
    lage: { x: 224, y: 211, dreh: 0 }, radius: 10,
    stufen: [
      { name: 'Seenotrettungsboot' },
      { name: 'Seenotrettungskreuzer', lage: { x: 6, y: 206, dreh: 0 }, besuchText: 'Tag der Seenotretter: Besichtigung und Vorführung' },
    ],
  },

  // ------------------------------------------------------------------ Stufe 5 und 6: Kuestenmarina und Seehafen
  {
    id: 'fahrgastanleger', name: 'Fahrgastanleger', gruppe: 'grosse-schiffe',
    kurz: 'Ausflugsschiffe fahren täglich raus. Bringt Gäste und Kleingeld.',
    lage: { x: 32, y: 216, dreh: 0 }, radius: 10,
    stufen: [
      { name: 'Fahrgastanleger', besuchText: 'Ausflugsfahrt zu den Seehunden' },
      { name: 'Ausflugsflotte', besuchText: 'Ausflugsfahrten zu Seehunden und Leuchtturm' },
    ],
  },
  {
    id: 'museumshafen', name: 'Museumshafen', gruppe: 'grosse-schiffe',
    kurz: 'Kaimauer für Traditionssegler vor alten Speichern. Hafenfeste werden größer.',
    lage: { x: 132, y: 212, dreh: 0 }, radius: 12,
    stufen: [
      { name: 'Museumshafen' },
      { name: 'Museumshafen mit Speicher' },
      // Stufe 6 (Jorven 2026-11-12): alle paar Wochen laufen mehrere Grosssegler gemeinsam ein und ankern
      // zwei Tage vor der Grossschiffpier (Schiffe: js/render/services-besuch.js)
      { name: 'Windjammertreffen', besuchText: 'Windjammertreffen: Traditionssegler laufen ein' },
    ],
  },
  {
    id: 'barkasse', name: 'Barkasse', gruppe: 'grosse-schiffe',
    kurz: 'Hafenrundfahrten: zweimal am Tag fährt die Barkasse mit Gästen durch den Binnenhafen und den Außenhafen.',
    // Bude am Ostufer des Sees, oestlich von Travellift und Werfthalle
    lage: { x: 216, y: -6, dreh: 0 }, radius: 8,
    stufen: [
      { name: 'Barkasse' },
    ],
  },
  {
    id: 'kreuzfahrtterminal', name: 'Kreuzfahrtterminal', gruppe: 'grosse-schiffe',
    kurz: 'Terminal an der Großschiffpier. Einmal pro Woche legt ein Kreuzfahrtschiff an.',
    // Terminal an der Wurzel der Kreuzfahrtpier (harbor.js Stufe 6, Steg P bei x -150, Nord-Sued), Busse an der Nehrungsstrasse
    lage: { x: -150, y: 212, dreh: 0 }, radius: 18,
    stufen: [
      { name: 'Kreuzfahrtpier', besuchText: 'Kreuzfahrtschiff legt an' },
      { name: 'Kreuzfahrtterminal', besuchText: 'Kreuzfahrtschiff legt an' },
    ],
  },
  {
    id: 'marineanleger', name: 'Marineanleger', gruppe: 'sicherheit',
    kurz: 'Liegeplatz für Marineschiffe. Flottenbesuche bringen Zuschauer.',
    // Eingezaeunter Stuetzpunkt an der Wurzel der eigenen Marinepier (Steg MA bei x -310), Tor zur Nehrungsstrasse
    lage: { x: -316, y: 210, dreh: 0 }, radius: 18,
    stufen: [
      { name: 'Marineanleger', besuchText: 'Flottenbesuch: Marineschiffe machen fest' },
      { name: 'Marinestützpunkt', besuchText: 'Flottenbesuch mit Tag der offenen Tür' },
    ],
  },
];

/**
 * Texte und Zahlen zusammenfügen: Die Zahl der Ausbaustufen und alle Werte kommen aus zahlen
 * (ECONOMY.services), Namen und Texte von hier. Ein Service ohne Zahlen fehlt im Spiel.
 */
export function mitZahlen(texte, zahlen) {
  return texte.filter((s) => zahlen?.[s.id]).map((s) => {
    const z = zahlen[s.id];
    return {
      ...s,
      abStufe: z.abStufe,
      stufen: z.stufen.map((st, i) => {
        const t = s.stufen[i] ?? { name: `${s.name} ${i + 1}` };
        const { besuchText, ...rest } = t;
        const wirkung = { ...(st.wirkung ?? {}) };
        if (wirkung.besuch) wirkung.besuch = { ...wirkung.besuch, text: besuchText ?? wirkung.besuch.text ?? '' };
        return { ...rest, ...st, wirkung };
      }),
    };
  });
}

export const SERVICE_TEXTE = TEXTE;
export const SERVICES = mitZahlen(TEXTE, ECONOMY.services);

export const SERVICE_BY_ID = Object.fromEntries(SERVICES.map((s) => [s.id, s]));

// Besuchsarten, die fuer das Abschlussziel von Stufe 6 als "Besuch eines grossen Schiffs" zaehlen
// (economy.js ziel.grossschiffBesuche). Die einzige Liste: bridge.js zaehlt damit state.bigVisits.
// Windjammertreffen und Ausflugsfahrt zaehlen bewusst nicht (Absprache Balancing 2026-11-12).
// Der Tag der offenen Tuer gehoert seit Roadmap P04 zum Flottenbesuch des Marinestuetzpunkts.
export const GROSSSCHIFF_BESUCHE = ['kreuzfahrt', 'flottenbesuch'];

export default SERVICES;
