// Spielregeln ohne Grafik: Ankunft, Passregel, Zuweisung, Kasse, Ruf, Ausbau.
// Kennt weder Three.js noch das DOM. Alle Funktionen ändern den übergebenen Spielstand
// und geben Ereignisse zurück, auf die Grafik, Ton und Oberfläche reagieren.
// Schnittstelle und Datenformate: docs/spielregeln.md

import { RULES } from './data/rules.js';
import { random, randomInt, randomRange, randomWeighted, randomPick } from './random.js';

// ---------------------------------------------------------------------------
// Kontext: Daten einlesen und nachschlagbar machen

/**
 * Bündelt Bootsarten, Liegeplätze, Regeln und Erweiterungen. Wird einmal beim Start gebaut.
 * @param {{ boatTypes?: object[], berths?: object[], harbor?: object, rules?: object }} data
 *   berths: Liegeplätze im Format der Regeln, oder harbor: das Objekt HAFEN aus data/harbor.js
 */
export function createContext({ boatTypes = [], berths, harbor, rules = RULES } = {}) {
  const r = structuredClone(rules);
  const types = boatTypes.map(normalizeType);
  const list = (berths ?? (harbor ? berthsFromHarbor(harbor, r) : [])).map(normalizeBerth);
  return {
    rules: r,
    types,
    typeById: Object.fromEntries(types.map((t) => [t.id, t])),
    berths: list,
    berthById: Object.fromEntries(list.map((b) => [b.id, b])),
    hooks: { modifiers: [], arrival: [], evening: [], night: [] },
  };
}

/**
 * Erweiterung einhängen. Namen:
 *   modifiers  fn(state, ctx) -> Teil von DEFAULT_MODIFIERS, wird jeden Tag und bei jeder Ankunft gelesen
 *   arrival    fn({ state, ctx, boat }) darf das neue Boot ändern (zum Beispiel Wünsche)
 *   evening    fn({ state, ctx, boats, addIncome, events }) am Abend nach dem Hafengeld
 *   night      fn({ state, ctx, events }) nach der Abreise, vor dem neuen Tag
 * Gibt eine Funktion zum Aushängen zurück.
 */
export function addHook(ctx, name, fn) {
  if (!ctx.hooks[name]) throw new Error(`Unbekannter Hook: ${name}`);
  ctx.hooks[name].push(fn);
  return () => {
    const i = ctx.hooks[name].indexOf(fn);
    if (i >= 0) ctx.hooks[name].splice(i, 1);
  };
}

/**
 * Neuer Service, dessen Wunsch Boote äußern können (für das Services-Modul).
 * def: { levels: {1: kapazität}, cost: {1: euro}, fromStage: {1: stufe}, wishFromStage?: stufe, berthProp?: 'water' }
 * Mit berthProp wird der Wunsch vom Liegeplatz erfüllt statt von einem Gebäude.
 */
export function addService(ctx, key, def) {
  const r = ctx.rules;
  if (def.berthProp) r.berthWishes[key] = def.berthProp;
  else r.facilities[key] = { levels: def.levels, cost: def.cost, fromStage: def.fromStage };
  if (def.wishFromStage) {
    for (const stage of Object.keys(r.wishes)) {
      if (Number(stage) >= def.wishFromStage && !r.wishes[stage].includes(key)) r.wishes[stage].push(key);
    }
  }
}

// Deutsche Feldnamen der Datendateien werden auf die englischen der Regeln abgebildet
const TYPE_ALIASES = {
  groesse: 'size', klasse: 'size', laenge: 'length', breite: 'beam', tiefgang: 'draft',
  abStufe: 'minStage', fromStage: 'minStage', modelle: 'models', gewicht: 'weight', preis: 'fee', naechte: 'nights',
  art: 'kind', tagesgaeste: 'dayVisitors', sondergast: 'special', stationiert: 'stationed',
  vonSee: 'fromSea', freischaltung: 'unlock',
};

function dealias(obj) {
  const out = { ...obj };
  for (const [de, en] of Object.entries(TYPE_ALIASES)) if (de in obj && !(en in obj)) out[en] = obj[de];
  if (obj.antrieb && !('motor' in obj)) out.motor = obj.antrieb === 'motor';
  return out;
}

function range(v) {
  if (Array.isArray(v)) return [v[0], v[1] ?? v[0]];
  return [v, v];
}

function normalizeType(raw) {
  const t = dealias(raw);
  if (!t.id || !t.size) throw new Error(`Bootsart ohne id oder size: ${JSON.stringify(raw)}`);
  const minStage = t.minStage ?? 1;
  return {
    weight: 1,
    motor: false,
    special: false,
    dayVisitors: 0,
    stationed: false,
    noWishes: false,
    kind: null,
    unlock: null, // Boot kommt nur, wenn ein Modul diese Freischaltung meldet (zum Beispiel 'kreuzfahrt')
    fromSea: minStage >= 3, // kommt über die Ostsee, bei Sturm nicht
    ...t,
    minStage,
    length: range(t.length),
    beam: range(t.beam),
    draft: range(t.draft),
    models: (t.models ?? []).map(dealias),
  };
}

function normalizeBerth(b) {
  return { comfort: 0, power: false, exposed: false, reserved: false, stage: 1, ...b };
}

/**
 * Liegeplätze aus data/harbor.js (HAFEN.plaetze) in das Format der Regeln bringen.
 * Strom, Komfort, Sturmlage und Sperren hängen an der Platzart (rules.berthKinds).
 * Bauprojekte, die Plätze freischalten: rules.berthProjects = { projektId: ['D01', ...] }.
 */
export function berthsFromHarbor(harbor, rules = RULES) {
  const requires = {};
  for (const [project, ids] of Object.entries(rules.berthProjects || {})) for (const id of ids) requires[id] = project;
  return harbor.plaetze.map((p) => {
    const kind = rules.berthKinds[p.art] || {};
    const steg = rules.berthJetties?.[p.steg] || {};
    const depth = Object.fromEntries(Object.entries(p.tiefe).map(([k, v]) => [Number(k), v]));
    return {
      id: p.id,
      kind: p.art,
      jetty: p.steg,
      size: p.klasse,
      stages: [...p.stufen],
      stage: Math.min(...p.stufen),
      maxLength: p.maxLaenge,
      maxBeam: p.maxBreite,
      depth,
      ...kind,
      ...steg,
      ...(requires[p.id] ? { requires: requires[p.id] } : {}),
    };
  });
}

// ---------------------------------------------------------------------------
// Modifikatoren (Ereignisse, Services und andere Module)

export const DEFAULT_MODIFIERS = Object.freeze({
  arrivalFactor: 1, // mehr oder weniger Boote
  seaArrivals: true, // false: niemand kommt über die Ostsee (Sturm)
  extraNights: 0, // zu Tagesbeginn bleiben alle liegenden Boote so viele Nächte länger
  sizeFactor: {}, // { L: 2 } doppelt so viele L-Boote
  kindFactor: {}, // { segelyacht: 3 } nach type.kind oder type.id
  visitorFactor: 1, // Tagesgäste
  serviceIncomeFactor: 1, // Einnahmen der Tagesgäste
  priceFactor: 1, // Hafengeld
  satisfaction: { outer: 0, all: 0 }, // zu Tagesbeginn: Zufriedenheit an ungeschützten Plätzen und überall
  ratingBonus: 0, // wird bei jeder Abreise auf die Bewertung addiert
  unlock: {}, // { kreuzfahrt: true } schaltet Bootsarten mit type.unlock frei
});

/** Alle Modifikatoren zusammengerechnet: Faktoren werden multipliziert, Zahlen addiert. */
export function modifiers(state, ctx) {
  const m = structuredClone({ ...DEFAULT_MODIFIERS, satisfaction: { ...DEFAULT_MODIFIERS.satisfaction } });
  for (const fn of ctx.hooks.modifiers) {
    let p;
    try {
      p = fn(state, ctx);
    } catch (err) {
      console.error('Fehler in Modifikator', err);
      continue;
    }
    if (!p) continue;
    for (const k of ['arrivalFactor', 'visitorFactor', 'serviceIncomeFactor', 'priceFactor']) if (p[k] != null) m[k] *= p[k];
    for (const k of ['extraNights', 'ratingBonus']) if (p[k] != null) m[k] += p[k];
    if (p.seaArrivals === false) m.seaArrivals = false;
    for (const k of ['sizeFactor', 'kindFactor']) {
      for (const [key, f] of Object.entries(p[k] || {})) m[k][key] = (m[k][key] ?? 1) * f;
    }
    if (p.satisfaction) {
      m.satisfaction.outer += p.satisfaction.outer || 0;
      m.satisfaction.all += p.satisfaction.all || 0;
    }
    Object.assign(m.unlock, p.unlock || {});
  }
  return m;
}

// ---------------------------------------------------------------------------
// Ruf

/** Ruf als Zahl von 1 bis 5 (Schnitt der letzten Bewertungen). */
export function reputation(state) {
  const r = state.ratings;
  return r.length ? r.reduce((a, b) => a + b, 0) / r.length : 3;
}

function pushRating(state, ctx, value) {
  const { window, min, max } = ctx.rules.reputation;
  state.ratings.push(Math.min(max, Math.max(min, value)));
  while (state.ratings.length > window) state.ratings.shift();
}

/** Faktor für die Zahl der Ankünfte: Ruf 1 ergibt 0,5, Ruf 3 ergibt 1, Ruf 5 ergibt 1,5. */
export function reputationFactor(rep, rules = RULES) {
  const lo = rules.arrivalFactorAtRep[1];
  const hi = rules.arrivalFactorAtRep[5];
  return lo + ((hi - lo) * (rep - 1)) / 4;
}

// ---------------------------------------------------------------------------
// Liegeplätze und Passregel

/** Wassertiefe eines Platzes in einer Ausbaustufe (Baggern macht Plätze tiefer). */
export function berthDepth(berth, stage) {
  if (typeof berth.depth === 'number') return berth.depth;
  if (!berth.depth) return 0;
  if (berth.depth[stage] != null) return berth.depth[stage];
  // Nächste bekannte Stufe darunter
  const known = Object.keys(berth.depth).map(Number).filter((s) => s <= stage).sort((a, b) => b - a);
  return known.length ? berth.depth[known[0]] : 0;
}

/** Ist der Liegeplatz im aktuellen Hafen vorhanden? */
export function berthAvailable(state, berth) {
  const inStage = berth.stages ? berth.stages.includes(state.stage) : berth.stage <= state.stage;
  return inStage && (!berth.requires || !!state.buildings[berth.requires]);
}

/** Alle Liegeplätze des aktuellen Hafens. */
export function availableBerths(state, ctx) {
  return ctx.berths.filter((b) => berthAvailable(state, b));
}

/**
 * Die Passregel: Ein Boot passt an einen Platz, wenn es nicht länger und nicht breiter ist als der Platz
 * und die Wassertiefe mindestens 0,3 m größer ist als sein Tiefgang. Fest vergebene Plätze und
 * Plätze nur für bestimmte Größen sind für andere Boote gesperrt.
 * Gibt null zurück, wenn es passt, sonst den Grund: 'reserved', 'size', 'length', 'beam', 'draft'.
 * @param {number} [stage] Ausbaustufe für die Wassertiefe, ohne Angabe die höchste bekannte
 */
export function whyNotFit(boat, berth, rules = RULES, stage = 99) {
  if (berth.reserved && !boat.stationed) return 'reserved';
  if (berth.sizes && !berth.sizes.includes(boat.size)) return 'size';
  if (boat.length > berth.maxLength) return 'length';
  if (boat.beam > berth.maxBeam) return 'beam';
  // Kleine Rundung, damit 1.7 + 0.3 nicht an 2.0 scheitert
  if (boat.draft + rules.underKeelClearance > berthDepth(berth, stage) + 1e-9) return 'draft';
  return null;
}

export function fits(boat, berth, rules = RULES, stage = 99) {
  return whyNotFit(boat, berth, rules, stage) === null;
}

export function isFree(state, berthId) {
  return !state.berths[berthId];
}

/** Hat der Platz diese Eigenschaft (zum Beispiel 'power')? Strom kann auch über ein Bauwerk kommen. */
export function berthHas(state, ctx, berth, prop) {
  if (!berth) return false;
  if (berth[prop]) return true;
  if (prop === 'power') {
    const building = ctx.rules.jettyPowerBuildings?.[berth.jetty];
    return !!(building && state.facilities[building] > 0);
  }
  return false;
}

function berthScore(state, ctx, boat, berth) {
  // Höher ist besser: erfüllte Platz-Wünsche zuerst, dann Komfort, dann möglichst knapper Platz,
  // damit große Plätze für große Boote frei bleiben.
  const bw = ctx.rules.berthWishes;
  const wishHits = boat.wishes.filter((w) => bw[w] && berthHas(state, ctx, berth, bw[w])).length;
  const slack = berth.maxLength * berth.maxBeam - boat.length * boat.beam;
  return wishHits * 1000 + (berth.comfort || 0) * 100 - slack;
}

/** Freie Plätze, an die das Boot passt, der beste zuerst. Diese Plätze leuchten beim Antippen auf. */
export function fittingBerths(state, ctx, boatId) {
  const boat = state.boats[boatId];
  if (!boat) return [];
  return availableBerths(state, ctx)
    .filter((b) => isFree(state, b.id) && fits(boat, b, ctx.rules, state.stage))
    .sort((a, b) => berthScore(state, ctx, boat, b) - berthScore(state, ctx, boat, a))
    .map((b) => b.id);
}

/** Passt das Boot an irgendeinen Platz des aktuellen Hafens, frei oder belegt? */
export function couldEverFit(state, ctx, boat) {
  return availableBerths(state, ctx).some((b) => fits(boat, b, ctx.rules, state.stage));
}

// ---------------------------------------------------------------------------
// Boote erzeugen

function smallestOf(type) {
  return { size: type.size, length: type.length[0], beam: type.beam[0], draft: type.draft[0], stationed: false };
}

/** Bootsarten, die heute kommen können: Stufe erreicht, freigeschaltet, passen in den Hafen. */
export function eligibleTypes(state, ctx, mods = modifiers(state, ctx)) {
  return ctx.types.filter(
    (t) =>
      !t.stationed &&
      t.minStage <= state.stage &&
      (!t.unlock || mods.unlock[t.unlock]) &&
      (mods.seaArrivals || !t.fromSea) &&
      couldEverFit(state, ctx, smallestOf(t)),
  );
}

function rollWishes(state, ctx, type) {
  const { rules } = ctx;
  if (type.noWishes) return [];
  const pool = (rules.wishes[state.stage] || []).filter(
    (w) => (type.motor || !rules.motorOnlyWishes.includes(w)) && (!rules.wishSizes?.[w] || rules.wishSizes[w].includes(type.size)),
  );
  const [lo, hi] = rules.wishCountBySize?.[type.size] || rules.wishCount[state.stage] || [0, 0];
  const n = Math.min(pool.length, randomInt(state, lo, hi));
  const left = [...pool];
  const out = [];
  for (let i = 0; i < n; i++) out.push(left.splice(Math.floor(random(state) * left.length), 1)[0]);
  return out;
}

function makeBoat(fields) {
  return {
    id: 0, typeId: null, modelId: null, name: '', size: 'S', kind: null,
    length: 0, beam: 0, draft: 0, motor: false, special: false, dayVisitors: 0, stationed: false,
    wishes: [], nights: 1, status: 'expected', arriveAt: 0, waitingSince: null, waitSpot: null, berthId: null,
    wishesMet: 0, wishesTotal: 0, pendingFee: 0, penalty: 0,
    ...fields,
  };
}

/** Würfelt ein Boot für die aktuelle Ausbaustufe aus. Gibt null zurück, wenn keine Bootsart passt. */
export function rollBoat(state, ctx, mods = modifiers(state, ctx)) {
  const types = eligibleTypes(state, ctx, mods);
  if (!types.length) return null;
  const mix = ctx.rules.sizeMix[state.stage] || {};
  const sizeWeights = {};
  for (const [size, w] of Object.entries(mix)) {
    if (types.some((t) => t.size === size)) sizeWeights[size] = w * (mods.sizeFactor[size] ?? 1);
  }
  let boat = null;
  // Bis zu 8 Versuche, Maße zu würfeln, die an einen Platz des Hafens passen
  for (let attempt = 0; attempt < 8; attempt++) {
    const size = randomWeighted(state, sizeWeights) ?? randomPick(state, types).size;
    const ofSize = types.filter((t) => t.size === size);
    const typeWeights = Object.fromEntries(
      ofSize.map((t) => [t.id, t.weight * (mods.kindFactor[t.kind] ?? 1) * (mods.kindFactor[t.id] ?? 1)]),
    );
    const type = ctx.typeById[randomWeighted(state, typeWeights) ?? ofSize[0].id];
    const models = type.models.filter((m) => (m.minStage ?? type.minStage) <= state.stage);
    const model = models.length ? randomPick(state, models) : null;
    const dim = (key) => (model && model[key] != null ? model[key] : randomRange(state, ...type[key]));
    const [nMin, nMax] = range(type.nights ?? ctx.rules.nightsBySize?.[type.size] ?? ctx.rules.nights);
    boat = makeBoat({
      typeId: type.id,
      modelId: model ? model.id : null,
      name: model ? model.name : type.name,
      size: type.size,
      kind: type.kind,
      length: dim('length'),
      beam: dim('beam'),
      draft: dim('draft'),
      motor: type.motor,
      special: type.special,
      dayVisitors: type.dayVisitors,
      wishes: rollWishes(state, ctx, type),
      nights: randomInt(state, nMin, nMax),
    });
    if (couldEverFit(state, ctx, boat)) break;
  }
  for (const fn of ctx.hooks.arrival) fn({ state, ctx, boat });
  return boat;
}

/** Erwartete Ankünfte pro Tag bei aktuellem Ruf und aktuellen Modifikatoren. */
export function arrivalRate(state, ctx, mods = modifiers(state, ctx)) {
  const base = ctx.rules.arrivalsPerDay[state.stage] || 0;
  return base * reputationFactor(reputation(state), ctx.rules) * mods.arrivalFactor;
}

/** Jahreslauf: Jahr (ab 1), Tag in der Saison (ab 1) und ob gerade Winter ist. */
export function season(state, ctx) {
  const { seasonDays, winterDays } = ctx.rules;
  const len = seasonDays + winterDays;
  const i = (state.day - 1) % len;
  return { year: Math.floor((state.day - 1) / len) + 1, day: i + 1, winter: i >= seasonDays };
}

/** Fest vergebene Plätze (Fischer) bekommen ihr Boot, sobald es den Platz gibt. */
function fillReservedBerths(state, ctx, events) {
  for (const berth of availableBerths(state, ctx)) {
    if (!berth.reserved || !isFree(state, berth.id)) continue;
    const type = ctx.types.find((t) => t.stationed && t.kind === berth.kind && t.minStage <= state.stage);
    if (!type) continue;
    const r = stationBoat(state, ctx, type.id, berth.id);
    if (r.ok) events.push(...r.events);
  }
}

function startDay(state, ctx, events) {
  fillReservedBerths(state, ctx, events);
  const mods = modifiers(state, ctx);
  const sea = season(state, ctx);
  // Modifikatoren für Boote, die schon liegen (zum Beispiel Sturm)
  for (const boat of mooredBoats(state)) {
    if (boat.stationed) continue;
    if (mods.extraNights) boat.nights += mods.extraNights;
    let delta = mods.satisfaction.all;
    if (ctx.berthById[boat.berthId]?.exposed) delta += mods.satisfaction.outer;
    if (delta) boat.penalty -= delta;
  }
  const rate = sea.winter ? 0 : arrivalRate(state, ctx, mods);
  const n = Math.floor(rate) + (random(state) < rate - Math.floor(rate) ? 1 : 0);
  const window = ctx.rules.dayLength * ctx.rules.arrivalWindow;
  const list = [];
  for (let i = 0; i < n; i++) {
    const boat = rollBoat(state, ctx, mods);
    if (!boat) break;
    boat.id = state.nextId++;
    boat.arriveAt = Math.round(random(state) * window * 10) / 10;
    list.push(boat);
  }
  list.sort((a, b) => a.arriveAt - b.arriveAt || a.id - b.id);
  state.upcoming = list;
  state.scheduledDay = state.day;
  events.push({ type: 'dayStart', day: state.day, stage: state.stage, expected: list.length, winter: sea.winter, year: sea.year });
}

/** Die nächsten Boote, die heute noch kommen (für die Vorschau). */
export function preview(state, ctx) {
  return state.upcoming.slice(0, ctx.rules.previewCount);
}

// ---------------------------------------------------------------------------
// Zuweisen

function moor(state, ctx, boat, berthId, events) {
  state.queue = state.queue.filter((id) => id !== boat.id);
  boat.status = 'moored';
  boat.berthId = berthId;
  boat.waitingSince = null;
  boat.waitSpot = null;
  state.berths[berthId] = boat.id;
  events.push({ type: 'moored', boatId: boat.id, berthId });
  const seen = (state.logbook[boat.typeId] ||= []);
  const key = boat.modelId ?? boat.typeId;
  if (!seen.includes(key)) {
    seen.push(key);
    events.push({ type: 'logbookNew', typeId: boat.typeId, modelId: boat.modelId });
  }
}

/**
 * Weist einem wartenden Boot einen Platz zu.
 * @returns {{ ok: boolean, reason?: string, events: object[] }}
 */
export function assign(state, ctx, boatId, berthId) {
  const events = [];
  const boat = state.boats[boatId];
  const berth = ctx.berthById[berthId];
  if (!boat || boat.status !== 'waiting') return { ok: false, reason: 'notWaiting', events };
  if (!berth || !berthAvailable(state, berth)) return { ok: false, reason: 'noBerth', events };
  if (!isFree(state, berthId)) return { ok: false, reason: 'occupied', events };
  const why = whyNotFit(boat, berth, ctx.rules, state.stage);
  if (why) return { ok: false, reason: why, events };
  moor(state, ctx, boat, berthId, events);
  return { ok: true, events };
}

/** "Automatisch einfahren": ein wartendes Boot nimmt den besten freien Platz. */
export function autoEnter(state, ctx, boatId) {
  const boat = state.boats[boatId];
  if (!boat || boat.status !== 'waiting') return { ok: false, reason: 'notWaiting', events: [] };
  const best = fittingBerths(state, ctx, boatId)[0];
  if (!best) return { ok: false, reason: 'noFreeBerth', events: [] };
  return assign(state, ctx, boatId, best);
}

/** Weist allen wartenden Booten den besten freien Platz zu (Hafenbüro Stufe 3). */
export function autoAssign(state, ctx) {
  const events = [];
  for (const id of [...state.queue]) {
    const best = fittingBerths(state, ctx, id)[0];
    if (best) moor(state, ctx, state.boats[id], best, events);
  }
  return events;
}

/**
 * Fest stationierte Einheit (Seenotretter, Polizei, Fischer) an einen Platz legen.
 * Sie reist nicht ab, hat keine Wünsche und zahlt jede Nacht eine feste Pacht.
 */
export function stationBoat(state, ctx, typeId, berthId, modelId = null) {
  const type = ctx.typeById[typeId];
  const berth = ctx.berthById[berthId];
  if (!type || !berth) return { ok: false, reason: 'unknown', events: [] };
  if (!berthAvailable(state, berth)) return { ok: false, reason: 'noBerth', events: [] };
  if (!isFree(state, berthId)) return { ok: false, reason: 'occupied', events: [] };
  const model = type.models.find((m) => m.id === modelId) || type.models[0] || null;
  const pick = (k) => (model && model[k] != null ? model[k] : type[k][0]);
  const boat = makeBoat({
    typeId,
    modelId: model ? model.id : null,
    name: model ? model.name : type.name,
    size: type.size,
    kind: type.kind,
    length: pick('length'),
    beam: pick('beam'),
    draft: pick('draft'),
    motor: type.motor,
    special: type.special,
    dayVisitors: type.dayVisitors,
    stationed: true,
    nights: null,
    status: 'waiting',
  });
  const why = whyNotFit(boat, berth, ctx.rules, state.stage);
  if (why) return { ok: false, reason: why, events: [] };
  boat.id = state.nextId++;
  state.boats[boat.id] = boat;
  const events = [];
  moor(state, ctx, boat, berthId, events);
  events.push({ type: 'stationed', boatId: boat.id, berthId });
  return { ok: true, boatId: boat.id, events };
}

/** Stationierte Einheit wieder abziehen. */
export function unstationBoat(state, ctx, boatId) {
  const boat = state.boats[boatId];
  if (!boat || !boat.stationed) return { ok: false, events: [] };
  delete state.berths[boat.berthId];
  delete state.boats[boatId];
  return { ok: true, events: [{ type: 'unstationed', boatId, berthId: boat.berthId }] };
}

// ---------------------------------------------------------------------------
// Ankunft und Warten

function turnAway(state, ctx, boat, events, why) {
  state.queue = state.queue.filter((id) => id !== boat.id);
  delete state.boats[boat.id];
  state.stats.turnedAway++;
  state.stats.turnedAwayToday++;
  const ta = ctx.rules.turnAway;
  const rated = random(state) < ta.chance;
  if (rated) pushRating(state, ctx, ta.rating);
  events.push({ type: 'turnedAway', boatId: boat.id, reason: why, rated });
}

/** Zahl der Warteplätze (Bojen und Ankerfeld) vor dem Hafen in der aktuellen Stufe. */
export function waitSpotCount(state, ctx) {
  const spots = ctx.rules.queue.spots;
  return spots[state.stage] ?? spots[Math.max(...Object.keys(spots).map(Number))] ?? 0;
}

/** Kleinste freie Nummer eines Warteplatzes (0 = erste Boje) oder null, wenn alle belegt sind. */
export function freeWaitSpot(state, ctx) {
  const used = new Set(waitingBoats(state).map((b) => b.waitSpot));
  for (let i = 0; i < waitSpotCount(state, ctx); i++) if (!used.has(i)) return i;
  return null;
}

function arrive(state, ctx, boat, events) {
  state.boats[boat.id] = boat;
  const spot = freeWaitSpot(state, ctx);
  if (spot == null) {
    turnAway(state, ctx, boat, events, 'queueFull');
    return;
  }
  boat.status = 'waiting';
  boat.waitSpot = spot;
  boat.waitingSince = state.clock;
  state.queue.push(boat.id);
  events.push({ type: 'arrived', boatId: boat.id, waitSpot: spot });
  if (state.office >= ctx.rules.office.autoAssign) {
    const best = fittingBerths(state, ctx, boat.id)[0];
    if (best) moor(state, ctx, boat, best, events);
  }
}

/** Ein wartendes Boot wegschicken (Spieler tippt "Abweisen"). Gilt nicht als schlechte Bewertung. */
export function dismiss(state, ctx, boatId) {
  const boat = state.boats[boatId];
  if (!boat || boat.status !== 'waiting') return { ok: false, events: [] };
  state.queue = state.queue.filter((id) => id !== boatId);
  delete state.boats[boatId];
  return { ok: true, events: [{ type: 'dismissed', boatId }] };
}

// ---------------------------------------------------------------------------
// Abend: Wünsche prüfen, Hafengeld

/** Hafengeld für eine Nacht bei n erfüllten Wünschen. */
export function nightlyFee(state, ctx, boat, wishesMet, priceFactor = 1) {
  const type = ctx.typeById[boat.typeId];
  const base = type?.fee ?? ctx.rules.baseFee[boat.size] ?? 0;
  return Math.round(base * (1 + ctx.rules.wishBonus * wishesMet) * priceFactor);
}

/** Wie viele Boote ein Service heute Abend versorgen kann. */
export function facilityCapacity(state, ctx, key) {
  const f = ctx.rules.facilities[key];
  return f ? f.levels[state.facilities[key] || 0] || 0 : 0;
}

/** Liegende Boote, nach Ankunft sortiert. */
export function mooredBoats(state) {
  return Object.values(state.boats)
    .filter((b) => b.status === 'moored')
    .sort((a, b) => a.id - b.id);
}

/** Wartende Boote in der Reihenfolge der Warteschlange. */
export function waitingBoats(state) {
  return state.queue.map((id) => state.boats[id]).filter(Boolean);
}

/** Geld gutschreiben (auch für andere Module, zum Beispiel Services). */
export function addIncome(state, amount) {
  if (!(amount > 0)) return;
  state.money += amount;
  state.stats.dayIncome += amount;
  state.stats.totalIncome += amount;
}

function startEvening(state, ctx, events) {
  state.phase = 'evening';
  const mods = modifiers(state, ctx);
  // Wer noch wartet, fährt weiter
  for (const id of [...state.queue]) turnAway(state, ctx, state.boats[id], events, 'evening');

  const left = {};
  for (const k of Object.keys(ctx.rules.facilities)) left[k] = facilityCapacity(state, ctx, k);
  let visitors = 0;
  for (const boat of mooredBoats(state)) {
    const berth = ctx.berthById[boat.berthId];
    visitors += boat.dayVisitors || 0;
    if (boat.stationed) {
      const fee = ctx.rules.stationedFee ?? Math.round(nightlyFee(state, ctx, boat, 0) * ctx.rules.stationedFeeShare);
      addIncome(state, fee);
      events.push({ type: 'stationedFee', boatId: boat.id, amount: fee });
      continue;
    }
    const metList = [];
    for (const w of boat.wishes) {
      const prop = ctx.rules.berthWishes[w];
      let ok;
      if (prop) ok = berthHas(state, ctx, berth, prop);
      else {
        ok = (left[w] || 0) > 0;
        if (ok) left[w]--;
      }
      if (ok) metList.push(w);
    }
    boat.wishesMet += metList.length;
    boat.wishesTotal += boat.wishes.length;
    const fee = nightlyFee(state, ctx, boat, metList.length, mods.priceFactor);
    boat.pendingFee += fee;
    events.push({ type: 'feeReady', boatId: boat.id, amount: fee, wishesMet: metList });
  }
  visitors = Math.round(visitors * mods.visitorFactor);
  if (visitors > 0) {
    const amount = Math.round(visitors * ctx.rules.visitorSpend * (state.facilities.essen || 0) * mods.serviceIncomeFactor);
    if (amount > 0) {
      addIncome(state, amount);
      events.push({ type: 'visitorIncome', visitors, amount });
    }
  }
  const boats = mooredBoats(state);
  for (const fn of ctx.hooks.evening) fn({ state, ctx, boats, events, addIncome: (a) => addIncome(state, a) });
  events.push({ type: 'evening', day: state.day });
  if (state.office >= ctx.rules.office.autoCollect) events.push(...collectAll(state, ctx, true));
}

/** Münze über einem Boot antippen. */
export function collect(state, ctx, boatId) {
  const boat = state.boats[boatId];
  if (!boat || boat.pendingFee <= 0) return { ok: false, events: [] };
  const amount = boat.pendingFee;
  boat.pendingFee = 0;
  addIncome(state, amount);
  return { ok: true, events: [{ type: 'collected', boatId, amount }] };
}

/** Alles kassieren. Ohne Hafenbüro nur mit force (Automatik, Tests). */
export function collectAll(state, ctx, force = false) {
  if (!force && state.office < ctx.rules.office.collectAllButton) return [];
  const events = [];
  for (const boat of mooredBoats(state)) events.push(...collect(state, ctx, boat.id).events);
  return events;
}

/** Bewertung eines abreisenden Gastes (1 bis 5). */
export function rateBoat(ctx, boat, ratingBonus = 0) {
  const r = ctx.rules;
  let value = boat.wishesTotal === 0 ? r.rating.noWishes : 1 + (4 * boat.wishesMet) / boat.wishesTotal;
  const berth = ctx.berthById[boat.berthId];
  value += (berth?.comfort || 0) * r.comfortBonus;
  if (boat.special) value += r.specialGuestRatingBonus;
  value += ratingBonus - boat.penalty;
  return Math.round(Math.min(r.rating.max, Math.max(r.rating.min, value)) * 10) / 10;
}

function night(state, ctx, events) {
  const mods = modifiers(state, ctx);
  // Liegengebliebene Münzen: ein Teil landet trotzdem in der Kasse
  let honesty = 0;
  for (const boat of mooredBoats(state)) {
    if (boat.pendingFee > 0) {
      honesty += Math.round(boat.pendingFee * ctx.rules.uncollectedShare);
      boat.pendingFee = 0;
    }
  }
  if (honesty > 0) {
    addIncome(state, honesty);
    events.push({ type: 'honestyBox', amount: honesty });
  }
  // Abreise
  for (const boat of mooredBoats(state)) {
    if (boat.stationed) continue;
    boat.nights -= 1;
    if (boat.nights > 0) continue;
    const rating = rateBoat(ctx, boat, mods.ratingBonus);
    pushRating(state, ctx, rating);
    state.guests++;
    state.stageGuests = (state.stageGuests || 0) + 1;
    delete state.berths[boat.berthId];
    delete state.boats[boat.id];
    events.push({ type: 'departed', boatId: boat.id, berthId: boat.berthId, typeId: boat.typeId, rating });
  }
  for (const fn of ctx.hooks.night) fn({ state, ctx, events });
  const s = state.stats;
  events.push({ type: 'dayEnd', day: state.day, income: s.dayIncome, turnedAway: s.turnedAwayToday });
  s.bestDayIncome = Math.max(s.bestDayIncome, s.dayIncome);
  s.dayIncome = 0;
  s.turnedAwayToday = 0;

  state.day++;
  state.phase = 'day';
  state.clock = 0;
  startDay(state, ctx, events);
  if (canAdvanceStage(state, ctx).ok) events.push({ type: 'stageReady', stage: state.stage + 1 });
}

// ---------------------------------------------------------------------------
// Zeit

/**
 * Lässt dt Sekunden Spielzeit vergehen. Vorspulen ist einfach ein größeres dt.
 * Große Sprünge werden in Schritten von höchstens 1 s gerechnet, damit nichts übersprungen wird.
 * @returns {object[]} Ereignisse in zeitlicher Reihenfolge
 */
export function tick(state, ctx, dt) {
  const events = [];
  if (state.scheduledDay !== state.day) startDay(state, ctx, events);
  const { dayLength, eveningLength, queue } = ctx.rules;
  let rest = Math.max(0, dt);
  while (rest > 0) {
    const step = Math.min(rest, 1);
    rest -= step;
    state.clock += step;
    if (state.phase === 'day') {
      while (state.upcoming.length && state.upcoming[0].arriveAt <= state.clock) {
        arrive(state, ctx, state.upcoming.shift(), events);
      }
      for (const id of [...state.queue]) {
        const b = state.boats[id];
        if (state.clock - b.waitingSince > queue.patience) turnAway(state, ctx, b, events, 'patience');
      }
      if (state.clock >= dayLength) {
        state.upcoming = []; // wer heute nicht mehr eingelaufen ist, kommt nicht
        startEvening(state, ctx, events);
      }
    } else if (state.clock >= dayLength + eveningLength) {
      night(state, ctx, events);
    }
  }
  return events;
}

/** Spult bis zum nächsten Morgen vor (für Simulationen und Balancing). */
export function runDay(state, ctx) {
  if (state.scheduledDay !== state.day) tick(state, ctx, 0);
  const left = ctx.rules.dayLength + ctx.rules.eveningLength - state.clock;
  return tick(state, ctx, left);
}

// ---------------------------------------------------------------------------
// Kasse und Ausbau

/** Bezahlt einen Betrag, wenn genug Geld da ist. */
export function spend(state, amount) {
  if (!(amount >= 0) || state.money < amount) return false;
  state.money -= amount;
  return true;
}

/**
 * Bauprojekt oder Anlage bezahlen und eintragen, zum Beispiel build(state, 'steg-d', 4000) oder
 * build(state, 'mole', 9000, 3). Schaltet Plätze mit requires frei. Stufe 1 ist der erste Ausbau.
 */
export function build(state, projectId, cost, level = 1) {
  const current = state.buildings[projectId] || 0;
  if (current >= level) return { ok: false, reason: 'built' };
  if (!spend(state, cost)) return { ok: false, reason: 'money' };
  state.buildings[projectId] = level;
  return { ok: true, events: [{ type: 'built', id: projectId, level, cost }] };
}

/** Nächste Stufe eines Services (Toilette, Dusche ...) und ob sie gerade gekauft werden kann. */
export function facilityUpgrade(state, ctx, key) {
  const f = ctx.rules.facilities[key];
  if (!f) return null;
  const next = (state.facilities[key] || 0) + 1;
  if (f.cost[next] == null) return { key, level: next, available: false, reason: 'max' };
  const cost = f.cost[next];
  if (state.stage < f.fromStage[next]) return { key, level: next, cost, available: false, reason: 'stage' };
  if (state.money < cost) return { key, level: next, cost, available: false, reason: 'money' };
  return { key, level: next, cost, available: true };
}

export function upgradeFacility(state, ctx, key) {
  const u = facilityUpgrade(state, ctx, key);
  if (!u || !u.available) return { ok: false, reason: u ? u.reason : 'unknown' };
  spend(state, u.cost);
  state.facilities[key] = u.level;
  return { ok: true, events: [{ type: 'built', id: key, level: u.level, cost: u.cost }] };
}

export function upgradeOffice(state, ctx) {
  const o = ctx.rules.office;
  const next = state.office + 1;
  if (!o.cost[next]) return { ok: false, reason: 'max' };
  if (state.stage < o.fromStage[next]) return { ok: false, reason: 'stage' };
  if (!spend(state, o.cost[next])) return { ok: false, reason: 'money' };
  state.office = next;
  return { ok: true, events: [{ type: 'built', id: 'office', level: next, cost: o.cost[next] }] };
}

/** Ziel für die nächste Ausbaustufe und was noch fehlt ('guests', 'reputation', 'money' oder 'max'). */
export function canAdvanceStage(state, ctx) {
  const goal = ctx.rules.stageGoals[state.stage];
  if (!goal || state.stage >= ctx.rules.maxStage) return { ok: false, missing: ['max'] };
  const rep = reputation(state);
  const guests = goal.perStage ? state.stageGuests || 0 : state.guests;
  const missing = [];
  if (guests < goal.guests) missing.push('guests');
  if (rep < goal.reputation) missing.push('reputation');
  if (state.money < goal.cost) missing.push('money');
  return { ok: missing.length === 0, missing, goal, guests, reputation: rep };
}

export function advanceStage(state, ctx) {
  const check = canAdvanceStage(state, ctx);
  if (!check.ok) return { ok: false, missing: check.missing };
  spend(state, check.goal.cost);
  if (check.goal.project) state.buildings[check.goal.project] = 1;
  state.stage++;
  state.stageGuests = 0;
  return { ok: true, events: [{ type: 'stageUp', stage: state.stage }] };
}

// ---------------------------------------------------------------------------
// Zahlen aus data/economy.js (Balancing-Thread) in das Format der Regeln bringen

/**
 * Baut aus ECONOMY die Regeln. Was ECONOMY nicht festlegt, kommt aus base (data/rules.js).
 * Liegeplätze werden über Projekte freigeschaltet: start.plaetze sind sofort da, jedes
 * Stegprojekt und jeder Stufenausbau schaltet seine Plätze frei.
 */
export function rulesFromEconomy(E, base = RULES) {
  const r = structuredClone(base);
  const z = E.zeit || {};
  if (z.tagSekunden) r.dayLength = z.tagSekunden;
  if (z.abendSekunden) r.eveningLength = z.abendSekunden;
  if (z.saisonTage) r.seasonDays = z.saisonTage;
  if (z.winterTage != null) r.winterDays = z.winterTage;

  if (E.klassen) {
    r.baseFee = {};
    r.nightsBySize = {};
    for (const [size, k] of Object.entries(E.klassen)) {
      r.baseFee[size] = k.grundpreis;
      if (k.naechte) r.nightsBySize[size] = k.naechte;
    }
  }
  if (E.wunschBonus != null) r.wishBonus = E.wunschBonus;

  if (E.wuensche) {
    const stages = (E.stufen || []).map((s) => s.stufe);
    r.wishes = {};
    r.wishSizes = {};
    r.motorOnlyWishes = [];
    for (const st of stages) {
      r.wishes[st] = Object.entries(E.wuensche).filter(([, w]) => w.abStufe <= st).map(([k]) => k);
    }
    for (const [k, w] of Object.entries(E.wuensche)) {
      if (w.klassen) r.wishSizes[k] = w.klassen;
      if (w.nurMotor) r.motorOnlyWishes.push(k);
    }
  }
  if (E.wunschAnzahl) r.wishCountBySize = E.wunschAnzahl;

  if (E.platzarten) {
    r.berthKinds = {};
    for (const [kind, p] of Object.entries(E.platzarten)) {
      const k = {};
      if (p.strom) k.power = true;
      if (p.rufBonus) k.comfort = p.rufBonus / (r.comfortBonus || 0.5);
      if (p.gast === false) k.reserved = true;
      if (kind === 'kai') Object.assign(k, { sizes: ['XL'], exposed: true });
      r.berthKinds[kind] = k;
    }
  }
  if (E.stromAnSteg) r.berthJetties = Object.fromEntries(Object.keys(E.stromAnSteg).filter((k) => E.stromAnSteg[k]).map((k) => [k, { power: true }]));
  // Strom an weiteren Stegen über ein Bauwerk (zum Beispiel Stromsäulen an Steg B)
  r.jettyPowerBuildings = {};
  for (const st of E.bauwerke?.strom?.stufen || []) for (const steg of st.stege || []) r.jettyPowerBuildings[steg] = 'strom';

  if (E.ruf) {
    const f = E.ruf;
    r.reputation = { ...r.reputation, start: f.start ?? r.reputation.start, window: f.fenster ?? r.reputation.window };
    if (f.ohneWunsch != null) r.rating.noWishes = f.ohneWunsch;
    if (f.ankunftBasis != null) r.arrivalFactorAtRep = { 1: f.ankunftBasis, 5: f.ankunftBasis + 4 * f.ankunftJeAnker };
    if (f.abgewiesen) r.turnAway = { chance: f.abgewiesen.chance, rating: f.abgewiesen.wertung };
  }

  if (E.stufen) {
    r.arrivalsPerDay = {};
    r.sizeMix = {};
    r.stageGoals = {};
    r.wishCount = r.wishCount || {};
    for (const s of E.stufen) {
      r.arrivalsPerDay[s.stufe] = s.ankuenfte;
      r.sizeMix[s.stufe] = s.mix;
      if (s.ausbau) {
        r.stageGoals[s.stufe] = { guests: s.ziel.gaeste, reputation: s.ziel.ruf, cost: s.ausbau.kosten, project: s.ausbau.id, name: s.ausbau.name, perStage: true };
      }
    }
    r.maxStage = Math.max(...E.stufen.map((s) => s.stufe));
  }

  // Liegeplätze und Projekte
  if (E.start || E.stegprojekte) {
    r.startBerths = [...(E.start?.plaetze || [])];
    r.berthProjects = {};
    r.jettyProjects = [];
    for (const p of E.stegprojekte || []) {
      r.berthProjects[p.id] = [...p.plaetze];
      r.jettyProjects.push({ id: p.id, name: p.name, stage: p.stufe, cost: p.kosten });
    }
    for (const s of E.stufen || []) if (s.ausbau) r.berthProjects[s.ausbau.id] = [...(s.ausbau.plaetze || [])];
  }

  if (E.bauwerke) {
    r.facilities = {};
    r.facilityNames = {};
    for (const [key, b] of Object.entries(E.bauwerke)) {
      if (key === 'strom') {
        r.facilities.strom = { levels: {}, cost: {}, fromStage: {}, names: {} };
      }
      const f = r.facilities[key] || { levels: {}, cost: {}, fromStage: {}, names: {} };
      b.stufen.forEach((st, i) => {
        f.levels[i + 1] = st.versorgt ?? 0;
        f.cost[i + 1] = st.kosten;
        f.fromStage[i + 1] = st.abStufe;
        f.names[i + 1] = st.name;
      });
      r.facilities[key] = f;
      r.facilityNames[key] = b.name;
    }
  }

  if (E.fischer?.pachtProTag != null) r.stationedFee = E.fischer.pachtProTag;

  if (E.hafenbuero) {
    const o = { ...r.office, cost: {}, fromStage: {}, names: {} };
    E.hafenbuero.stufen.forEach((st, i) => {
      o.cost[i + 1] = st.kosten;
      o.fromStage[i + 1] = st.abStufe;
      o.names[i + 1] = st.name;
      if (st.schaltetFrei?.includes('allesKassieren')) o.collectAllButton = i + 1;
      if (st.schaltetFrei?.includes('automatik')) {
        o.autoAssign = i + 1;
        o.autoCollect = i + 1;
      }
    });
    r.office = o;
  }
  return r;
}

/** Stegprojekte, die in der aktuellen Stufe gebaut werden können und noch fehlen. */
export function openJettyProjects(state, ctx) {
  return (ctx.rules.jettyProjects || []).filter((p) => p.stage <= state.stage && !state.buildings[p.id]);
}

/** Stegprojekt bauen (Kosten aus den Regeln). */
export function buildJettyProject(state, ctx, id) {
  const p = (ctx.rules.jettyProjects || []).find((x) => x.id === id);
  if (!p) return { ok: false, reason: 'unknown', events: [] };
  if (p.stage > state.stage) return { ok: false, reason: 'stage', events: [] };
  const r = build(state, id, p.cost);
  return { ...r, events: r.events || [] };
}
