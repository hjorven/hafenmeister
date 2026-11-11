// Ereignisse im Hafen: nur Daten, keine Logik. Die Logik steht in js/events/scheduler.js.
//
// Leitlinien (cozy, kein Scheitern):
// - Jedes Ereignis wird einen Tag vorher angekündigt, damit man sich vorbereiten kann.
// - Kein Ereignis kostet Geld oder zerstört etwas. Schlechtes Wetter bremst nur,
//   gute Ereignisse belohnen, wer vorbereitet ist.
// - Höchstens ein Ereignis gleichzeitig, danach mindestens ein ruhiger Tag.
// - Nebel und Sommertag sind kleine Wetterereignisse ab Stufe 1, damit schon der Anfang
//   Abwechslung hat. Sturm, Regatta und Hafenfest folgen dem Plan, Abschnitt 7.
//   Kreuzfahrtschiffe, Marinebesuche und Ausflugsfahrten plant das Services-Modul als
//   regelmäßige Besuche (game.services), deshalb gibt es hier keinen eigenen Kreuzfahrttag.
//
// Felder:
//   stage       ab dieser Ausbaustufe möglich
//   every       mittlerer Abstand in Tagen (Zufall streut um +-30 %)
//   duration    Länge in Tagen
//   weight      Vorrang, wenn mehrere fällig sind (größer gewinnt)
//   requires    optional: Bauwerk, das vorhanden sein muss (z. B. 'segelclub')
//   season      Saisontage [von, bis], an denen das Ereignis liegen darf (1 bis 30)
//   announceDays  optional: so viele Tage vorher ankündigen (Standard 1)
//   weather     Wetter für Landschaft, Ton und Effekte: wind, fog, rain, snow, sun je 0 bis 1
//   mods        Wirkung auf die Spielregeln, siehe DEFAULT_MODS
//   protect     optional: Bauwerk, das schlechte Folgen mindert, mit Faktor je Ausbaustufe
//   evening     optional: Abendeffekt (z. B. 'feuerwerk')
//   title, teaser, text   Texte für die Ankündigung (kurz, ohne Story)

// Standardwerte, wenn nichts los ist. Die Sim liest diese Felder, alle sind optional.
export const DEFAULT_MODS = Object.freeze({
  arrivalFactor: 1,          // Boote pro Tag mal Faktor
  seaArrivals: true,         // false: niemand läuft von See ein (nur Boote aus dem See)
  extraNights: 0,            // Boote im Hafen bleiben so viele Nächte länger
  sizeFactor: Object.freeze({ S: 1, M: 1, L: 1, XL: 1 }),  // Gewicht je Bootsgröße bei der Ankunft
  kindFactor: Object.freeze({}),     // Gewicht je Bootsart, z. B. { segelyacht: 3 }
  visitorFactor: 1,          // Tagesbesucher an Land (Kiosk, Imbiss, Restaurant)
  serviceIncomeFactor: 1,    // Einnahmen aus Versorgung
  priceFactor: 1,            // Hafengeld mal Faktor
  satisfaction: Object.freeze({ outer: 0, all: 0 }),  // Anker Zufriedenheit dazu (negativ = weniger)
  winter: false,             // true in den Wintertagen (Boote im Winterlager)
  ratingBonus: 0,            // Anker dazu auf jede Bewertung an diesem Tag (sim.js: rateBoat)
});

export const EVENTS = [
  {
    id: 'nebel',
    title: 'Nebel',
    teaser: 'Morgen Nebel über dem Wasser',
    text: 'Es laufen weniger Boote ein. Wer schon da ist, bleibt gern eine Nacht länger.',
    stage: 1,
    every: 13,
    duration: 1,
    weight: 1,
    season: [1, 30],
    weather: { wind: 0.1, fog: 1, rain: 0, sun: 0.2 },
    mods: { arrivalFactor: 0.7, extraNights: 1 },
  },
  {
    id: 'sommertag',
    title: 'Sommertag',
    teaser: 'Morgen wird es heiß',
    text: 'Viele kleine Boote und Badegäste. Der Kiosk hat gut zu tun.',
    stage: 1,
    every: 11,
    duration: 1,
    weight: 1,
    season: [7, 24],
    weather: { wind: 0.2, fog: 0, rain: 0, sun: 1 },
    mods: { arrivalFactor: 1.25, sizeFactor: { S: 2, M: 1.2 }, visitorFactor: 1.5, serviceIncomeFactor: 1.3 },
  },
  {
    id: 'sturm',
    title: 'Sturm',
    teaser: 'Morgen zieht ein Sturm auf',
    text: 'Von See läuft niemand ein, Gäste im Hafen bleiben eine Nacht länger. Die Seenotretter halten Wache.',
    stage: 3,
    every: 12,
    duration: 1,
    weight: 4,
    season: [3, 30],
    weather: { wind: 1, fog: 0.2, rain: 1, sun: 0 },
    mods: { seaArrivals: false, extraNights: 1, satisfaction: { outer: -1 } },
    // Seenotretter-Station mindert die Folgen: ohne voll, Station halb, ausgebaut keine
    protect: { building: 'seenotretter', factor: [1, 0.5, 0] },
  },
  {
    id: 'regatta',
    title: 'Regatta',
    teaser: 'Übermorgen beginnt die Regatta',
    text: 'Zwei Tage lang doppelt so viele Segelboote. Plätze freihalten lohnt sich.',
    stage: 3,
    requires: 'segelclub',
    every: 14,
    duration: 2,
    weight: 5,
    announceDays: 2,
    season: [6, 26],
    weather: { wind: 0.6, fog: 0, rain: 0, sun: 0.8 },
    mods: {
      arrivalFactor: 1.6,
      // Schlüssel: kind der Bootsarten (web/js/data/boat-catalog.js)
      kindFactor: { jolle: 3, segelyacht: 3, mehrrumpf: 2 },
      visitorFactor: 1.5,
      serviceIncomeFactor: 1.3,
      ratingBonus: 0.25,
    },
  },
  {
    id: 'hafenfest',
    title: 'Hafenfest',
    teaser: 'Morgen ist Hafenfest',
    text: 'Traditionssegler laufen ein, viele Tagesgäste an Land. Abends Feuerwerk.',
    stage: 4,
    every: 20,
    duration: 1,
    weight: 4,
    season: [10, 24],
    weather: { wind: 0.3, fog: 0, rain: 0, sun: 0.9 },
    mods: {
      // Traditionssegler (XL) kommen erst ab Stufe 5, vorher nur mehr Boote und Besucher
      arrivalFactor: 1.3,
      kindFactor: { traditionssegler: 6 },
      sizeFactor: { XL: 2 },
      visitorFactor: 2,
      serviceIncomeFactor: 1.5,
      ratingBonus: 0.25,
    },
    evening: 'feuerwerk',
  },
];

// Jahreslauf (Plan Abschnitt 7): 30 Tage Saison, danach 3 Tage Winter.
// In der Saison: Tag 1 bis 8 Frühling, 9 bis 22 Sommer, 23 bis 30 Herbst.
// Im Winter gibt es keine Ereignisse, die Boote stehen im Winterlager.
export const YEAR = {
  seasonDays: 30,
  winterDays: 3,
  parts: [
    { id: 'fruehling', from: 1, to: 8 },
    { id: 'sommer', from: 9, to: 22 },
    { id: 'herbst', from: 23, to: 30 },
  ],
  winterMods: { winter: true, arrivalFactor: 0.15, visitorFactor: 0.3, serviceIncomeFactor: 0.5 },
  winterWeather: { wind: 0.3, fog: 0.2, rain: 0, snow: 1, sun: 0.3 },
};

// Abstände und Zufall
export const SCHEDULE = {
  minGapDays: 2,       // ruhige Tage zwischen zwei Ereignissen
  firstDay: 3,         // vor diesem Tag passiert nichts (Ankommen im Spiel)
  jitter: 0.3,         // Streuung des Abstands, +-30 %
};
