// Spielstand: Anlegen, Zufall mit Seed, Prüfen und Umbauen beim Laden.
// Kennt weder Three.js noch das DOM. Der Spielstand ist reines JSON.

import { RULES } from './data/rules.js';

export const SAVE_VERSION = 1;

/**
 * Legt einen neuen Spielstand an.
 * @param {object} [opts]
 * @param {number} [opts.seed] Startwert für den Zufall. Gleicher Seed, gleiche Spieleingaben, gleiches Spiel.
 * @param {object} [opts.rules] Regeln, Standard ist RULES.
 */
export function createState({ seed, rules = RULES } = {}) {
  const s = (seed ?? Math.floor(Math.random() * 2 ** 32)) >>> 0;
  const rep = rules.reputation;
  return {
    version: SAVE_VERSION,
    seed: s,
    rng: s,
    harborName: '', // Name des Hafens, setzt der Speicherplatz (save/plaetze.js)
    day: 1,
    phase: 'day', // 'day' oder 'evening'
    clock: 0, // Sekunden seit Tagesbeginn, Abend beginnt bei rules.dayLength
    stage: 1,
    region: 'ostsee', // 'ostsee', 'daenemark', 'schweden', 'nordsee'
    money: 0,
    guests: 0, // abgereiste Gäste insgesamt
    stageGuests: 0, // abgereiste Gäste in der aktuellen Ausbaustufe
    ratings: Array(rep.startSamples).fill(rep.start), // letzte Bewertungen, neueste hinten
    facilities: Object.fromEntries(Object.keys(rules.facilities).map((k) => [k, 0])),
    office: 0,
    buildings: {}, // Bauprojekte und Anlagen mit Stufe, zum Beispiel { 'steg-d': 1, mole: 2 }
    berths: {}, // Liegeplatz-ID -> Boot-ID oder null (nur belegte Plätze stehen hier)
    boats: {}, // Boot-ID -> Boot, alle Boote, die da sind (wartend oder liegend)
    leaving: {}, // Liegeplatz-ID -> { boatId, elapsed }: Boot legt gerade ab, Box noch belegt
    queue: [], // Boot-IDs an der Einfahrt, älteste zuerst
    upcoming: [], // heute noch erwartete Boote, sortiert nach arriveAt
    scheduledDay: 0, // für welchen Tag die Ankünfte schon ausgewürfelt sind
    nextId: 1,
    modules: {}, // Spielstände anderer Module (Ereignisse, Services ...), je Modul ein JSON-Objekt
    logbook: {}, // Bootsart -> Modell-IDs, die schon angelegt haben
    stats: {
      dayIncome: 0,
      bestDayIncome: 0,
      totalIncome: 0,
      turnedAway: 0,
      turnedAwayToday: 0,
    },
  };
}

export { random, randomInt, randomRange, randomWeighted, randomPick } from './random.js';

// ---------------------------------------------------------------------------
// Speichern und Laden

/** Spielstand als JSON-Text. */
export function serialize(state) {
  return JSON.stringify(state);
}

/** Liest einen JSON-Text, prüft ihn und hebt ältere Versionen an. Wirft bei kaputten Daten einen Fehler. */
export function deserialize(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Spielstand ist kein gültiges JSON');
  }
  return validate(migrate(data));
}

function migrate(data) {
  if (!data || typeof data !== 'object') throw new Error('Spielstand ist leer');
  if (typeof data.version !== 'number') throw new Error('Spielstand hat keine Version');
  if (data.version > SAVE_VERSION) throw new Error('Spielstand stammt aus einer neueren Spielversion');
  // Hier kommen später Schritte von Version n zu n+1 hinzu.
  return data;
}

function validate(data) {
  const fresh = createState({ seed: 0 });
  // Felder, ohne die nichts geht. Alle anderen fehlenden Felder werden mit Startwerten ergänzt.
  for (const key of ['day', 'stage', 'money', 'boats', 'berths', 'ratings']) {
    if (!(key in data)) throw new Error(`Spielstand unvollständig: ${key} fehlt`);
  }
  for (const key of Object.keys(fresh)) {
    if (!(key in data)) data[key] = fresh[key];
    if (typeof data[key] !== typeof fresh[key] && fresh[key] !== null) {
      throw new Error(`Spielstand fehlerhaft: ${key} hat den falschen Typ`);
    }
  }
  if (!Array.isArray(data.ratings) || !Array.isArray(data.queue) || !Array.isArray(data.upcoming)) {
    throw new Error('Spielstand fehlerhaft: Listen beschädigt');
  }
  if (!Number.isFinite(data.money) || !Number.isFinite(data.day)) {
    throw new Error('Spielstand fehlerhaft: Zahlen beschädigt');
  }
  tiefPruefen(data);
  return data;
}

const istObjekt = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const zahlIn = (v, min, max) => Number.isFinite(v) && v >= min && v <= max;

/**
 * Prüft verschachtelte Daten (roadmap C03), bevor ein Stand übernommen wird. Falsche Typen und
 * unmögliche Zahlen werfen einen Fehler; lose Verweise (Platz zeigt auf ein Boot, das es nicht gibt)
 * werden entfernt, damit ein leicht beschädigter Stand trotzdem lädt.
 */
function tiefPruefen(data) {
  const fehler = (was) => { throw new Error(`Spielstand fehlerhaft: ${was}`); };
  for (const key of ['boats', 'berths', 'buildings', 'facilities', 'modules', 'leaving', 'logbook', 'stats']) {
    if (!istObjekt(data[key])) fehler(`${key} ist kein Objekt`);
  }
  if (!Number.isInteger(data.day) || !zahlIn(data.day, 1, 1e6)) fehler('Tag');
  if (!Number.isInteger(data.stage) || !zahlIn(data.stage, 1, 20)) fehler('Stufe');
  if (!zahlIn(data.money, -1e12, 1e12)) fehler('Geld');
  if (!zahlIn(data.clock, 0, 1e7)) fehler('Uhrzeit');
  if (!Number.isFinite(data.seed) || !Number.isFinite(data.rng)) fehler('Zufall');
  if (data.ratings.length > 10000 || !data.ratings.every((r) => zahlIn(r, 0, 5))) fehler('Bewertungen');
  // Tag jeder Bewertung (Ruf über die letzten Tage, P19); fehlt in älteren Spielständen
  if (data.ratingDays != null && (!Array.isArray(data.ratingDays) || data.ratingDays.length > data.ratings.length
    || !data.ratingDays.every((t) => Number.isInteger(t) && t >= 0))) fehler('Tage der Bewertungen');
  const boote = Object.entries(data.boats);
  if (boote.length > 5000) fehler('zu viele Boote');
  let hoechste = 0;
  for (const [key, b] of boote) {
    if (!istObjekt(b) || !Number.isFinite(b.id) || String(b.id) !== key) fehler(`Boot ${key}`);
    if (typeof b.status !== 'string') fehler(`Boot ${key} ohne Zustand`);
    for (const f of ['length', 'beam', 'draft']) if (f in b && !zahlIn(b[f], 0, 1000)) fehler(`Boot ${key}: ${f}`);
    if (b.berthId != null && typeof b.berthId !== 'string') fehler(`Boot ${key}: Platz`);
    hoechste = Math.max(hoechste, b.id);
  }
  if (!Number.isInteger(data.nextId) || data.nextId <= hoechste) data.nextId = Math.floor(hoechste) + 1;
  for (const [platz, id] of Object.entries(data.berths)) {
    if (!data.boats[id]) delete data.berths[platz];
  }
  data.queue = data.queue.filter((id) => data.boats[id]);
  data.upcoming = data.upcoming.filter((u) => u !== null && (typeof u === 'object' || data.boats[u]));
  data.harborName = String(data.harborName ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').slice(0, 32);
}

// Speichern im Browser, Speicherplätze, Export und Import: web/js/save/ (ein Speicherweg,
// docs/speichern.md). Der frühere Rückfall unter 'hafenmeister.save' mit Kurztext "HM1:"
// wird von save/plaetze.js beim ersten Start übernommen, "HM1:"-Texte liest save/storage.js.

// ---------------------------------------------------------------------------
// Start im Browser: main.js ruft init(game) auf. Die Anbindung liegt in bridge.js,
// damit diese Datei ohne Browser testbar bleibt.

export async function init(game) {
  const { initBridge } = await import('./bridge.js');
  return initBridge(game);
}
