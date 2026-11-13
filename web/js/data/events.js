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
// Alle Zahlen (Stufe, Abstand, Dauer, Vorrang, Saison, Wirkung, Schutz, Ablauf, Winter) stehen in
// js/data/economy.js unter ECONOMY.ereignisse, die Länge von Saison und Winter unter ECONOMY.zeit.
// Hier stehen nur Texte, Wetterbild und Abendeffekt. EVENTS, YEAR und SCHEDULE fügen beides zusammen.
//
// Felder hier:
//   weather     Wetter für Landschaft, Ton und Effekte: wind, fog, rain, snow, sun je 0 bis 1
//   evening     optional: Abendeffekt (z. B. 'feuerwerk')
//   title, teaser, text   Texte für die Ankündigung (kurz, ohne Story)
//
// Felder in EVENTS (für events/scheduler.js):
//   stage, every, duration, weight, requires, season, announceDays, mods, protect { building, factor }

// Standardwerte, wenn nichts los ist. Die Sim liest diese Felder, alle sind optional.
import { ECONOMY } from './economy.js';

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

const TEXTE = [
  {
    id: 'nebel',
    title: 'Nebel',
    teaser: 'Morgen Nebel über dem Wasser',
    text: 'Es laufen weniger Boote ein. Wer schon da ist, bleibt gern eine Nacht länger.',
    weather: { wind: 0.1, fog: 1, rain: 0, sun: 0.2 },
  },
  {
    id: 'sommertag',
    title: 'Sommertag',
    teaser: 'Morgen wird es heiß',
    text: 'Viele kleine Boote und Badegäste. Der Kiosk hat gut zu tun.',
    weather: { wind: 0.2, fog: 0, rain: 0, sun: 1 },
  },
  {
    id: 'sturm',
    title: 'Sturm',
    teaser: 'Morgen zieht ein Sturm auf',
    text: 'Von See läuft niemand ein, Gäste im Hafen bleiben eine Nacht länger. Die Seenotretter halten Wache.',
    weather: { wind: 1, fog: 0.2, rain: 1, sun: 0 },
  },
  {
    id: 'regatta',
    title: 'Regatta',
    teaser: 'Übermorgen beginnt die Regatta',
    text: 'Zwei Tage lang doppelt so viele Segelboote. Plätze freihalten lohnt sich.',
    weather: { wind: 0.6, fog: 0, rain: 0, sun: 0.8 },
  },
  {
    id: 'hafenfest',
    title: 'Hafenfest',
    teaser: 'Morgen ist Hafenfest',
    text: 'Traditionssegler laufen ein, viele Tagesgäste an Land. Abends Feuerwerk.',
    weather: { wind: 0.3, fog: 0, rain: 0, sun: 0.9 },
    evening: 'feuerwerk',
  },
];

// Jahreslauf: Saison und Winter aus ECONOMY.zeit. Im Winter gibt es keine Ereignisse,
// die Boote stehen im Winterlager.
const Z = ECONOMY.zeit;
const E = ECONOMY.ereignisse;

export const YEAR = {
  seasonDays: Z.saisonTage,
  winterDays: Z.winterTage,
  parts: Object.entries(Z.jahreszeiten).map(([id, [from, to]]) => ({ id, from, to })),
  winterMods: E.winter.wirkung,
  winterWeather: { wind: 0.3, fog: 0.2, rain: 0, snow: 1, sun: 0.3 },
};

// Abstände und Zufall
export const SCHEDULE = {
  minGapDays: E.ablauf.ruhigeTage,   // ruhige Tage zwischen zwei Ereignissen
  firstDay: E.ablauf.ersterTag,      // vor diesem Tag passiert nichts (Ankommen im Spiel)
  jitter: E.ablauf.streuung,         // Streuung des Abstands
};

/** Texte und Zahlen zusammenfügen. Ein Ereignis ohne Zahlen in ECONOMY.ereignisse kommt nicht vor. */
export function mitZahlen(texte, zahlen) {
  return texte.filter((t) => zahlen?.[t.id]).map((t) => {
    const z = zahlen[t.id];
    const def = {
      ...t,
      stage: z.abStufe,
      every: z.alleTage,
      duration: z.dauer,
      weight: z.vorrang ?? 1,
      season: z.saison,
      mods: z.wirkung ?? {},
    };
    if (z.braucht) def.requires = z.braucht;
    if (z.ankuendigen != null) def.announceDays = z.ankuendigen;
    if (z.schutz) def.protect = { building: z.schutz.durch, factor: z.schutz.faktor };
    return def;
  });
}

export const EVENT_TEXTE = TEXTE;
export const EVENTS = mitZahlen(TEXTE, E);
