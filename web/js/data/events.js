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
//   stage, every, duration, weight, requires, season, announceDays, mods, protect { building, factor },
//   amTag (fester Saisontag), gross (eigener Platz im Planer, lange vorher angekündigt), menschen, bauten,
//   nachspiel { tage, mods, modsVorbereitet, title, text }

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
    text: 'Von See läuft niemand ein, Gäste bleiben eine Nacht länger. Wer offen am Stegkopf liegt, bewertet schlechter.',
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
  // Neue Ereignisse (P24, F17). Was ein gebauter Service dazu beiträgt, steht in economy.js (bauten).
  {
    id: 'mittsommer',
    title: 'Mittsommer',
    teaser: 'Morgen ist Mittsommer',
    text: 'Die hellste Nacht des Jahres. Viele Gäste am Strand, Crews bleiben eine Nacht länger.',
    weather: { wind: 0.15, fog: 0, rain: 0, sun: 1 },
    evening: 'mittsommerfeuer',
  },
  {
    id: 'heringstage',
    title: 'Heringstage',
    teaser: 'Morgen beginnen die Heringstage',
    text: 'Zwei Tage Frühjahrsfang. Viele Besucher kommen für Räucherfisch an den Hafen.',
    weather: { wind: 0.35, fog: 0.1, rain: 0, sun: 0.6 },
  },
  {
    id: 'holzboote',
    title: 'Holzboot-Treffen',
    teaser: 'Morgen kommen die Holzboote',
    text: 'Zwei Tage lang Klassiker aus Holz und Ruderboote. Gäste bewerten etwas besser.',
    weather: { wind: 0.3, fog: 0, rain: 0, sun: 0.85 },
  },
  {
    id: 'hansewoche',
    title: 'Hanse-Woche',
    teaser: 'In zehn Tagen beginnt die Hanse-Woche',
    text: 'Vier Tage Fest: Traditionssegler, große Schiffe und viele Besucher. Abends Feuerwerk.',
    weather: { wind: 0.35, fog: 0, rain: 0, sun: 0.9 },
    evening: 'feuerwerk',
  },
];

// Nachspiel (G3): kurze Texte für die Tage nach einem Ereignis (Zahlen in ECONOMY.ereignisse.nachspiel)
export const NACHSPIEL_TEXTE = {
  sturm: { title: 'Nach dem Sturm', text: 'Wer draußen gewartet hat, läuft heute ein.' },
  regatta: { title: 'Nach der Regatta', text: 'Nachzügler der Regatta suchen heute einen Platz.' },
  hafenfest: { title: 'Nach dem Hafenfest', text: 'Das Fest hat sich herumgesprochen: mehr Besucher.' },
  hansewoche: { title: 'Nach der Hanse-Woche', text: 'Noch zwei Tage mehr Besucher und Traditionssegler.' },
};

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
    // Lange vorher angekündigt (fünf Tage und mehr): eigener Platz im Planer (scheduler.js, Hanse-Woche)
    if ((z.ankuendigen ?? 1) >= 5) def.gross = true;
    if (z.amTag) def.amTag = z.amTag;
    if (z.menschen) def.menschen = z.menschen;
    if (z.bauten) def.bauten = z.bauten;
    const n = zahlen.nachspiel?.[t.id];
    if (n) def.nachspiel = { tage: n.tage, mods: n.wirkung ?? {}, modsVorbereitet: n.wirkungVorbereitet ?? null, ...(NACHSPIEL_TEXTE[t.id] ?? {}) };
    return def;
  });
}

export const EVENT_TEXTE = TEXTE;
export const EVENTS = mitZahlen(TEXTE, E);
