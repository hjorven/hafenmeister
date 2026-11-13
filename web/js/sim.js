// Spielregeln ohne Grafik: Ankunft, Passregel, Zuweisung, Kasse, Ruf, Ausbau.
// Kennt weder Three.js noch das DOM. Alle Funktionen ändern den übergebenen Spielstand
// und geben Ereignisse zurück, auf die Grafik, Ton und Oberfläche reagieren.
// Schnittstelle und Datenformate: docs/spielregeln.md

import { RULES, rulesFromEconomy } from './data/rules.js';
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
    hooks: { modifiers: [], arrival: [], evening: [], night: [], fit: [], stageUp: [], tick: [] },
  };
}

/**
 * Erweiterung einhängen. Namen:
 *   modifiers  fn(state, ctx) -> Teil von DEFAULT_MODIFIERS, wird jeden Tag und bei jeder Ankunft gelesen
 *   arrival    fn({ state, ctx, boat }) darf das neue Boot ändern (zum Beispiel Wünsche)
 *   evening    fn({ state, ctx, boats, addIncome, events }) am Abend nach dem Hafengeld
 *   night      fn({ state, ctx, events }) nach der Abreise, vor dem neuen Tag
 *   tick       fn({ state, ctx, events }) jede Spielsekunde tagsüber (zum Beispiel ein Dauerlieger,
 *              der am Nachmittag früher zurückkommt)
 *   fit        fn({ state, ctx, boat, berth }) -> Grund (Text) oder null; zusätzliche Passregel
 *              für freie Plätze (zum Beispiel Dauerplätze, deren Boot gerade draußen ist)
 *   stageUp    fn({ state, ctx, from, to, gone, moves, findBerth, events }) nach einem Stufenausbau:
 *              gone = Plätze, die es in der neuen Stufe nicht mehr gibt, moves = umgezogene feste
 *              Boote [{ boatId, from, to }], findBerth(boot) sucht einen freien passenden Platz
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
  return !state.berths[berthId] && !state.leaving?.[berthId];
}

/**
 * Ein abreisendes Boot hält seine Box, bis es wirklich heraus ist. Die 3D-Ansicht meldet das mit
 * 'boot:aus-box'; meldet niemand etwas, wird die Box nach rules.leaveMax Sekunden frei.
 */
function startLeaving(state, boatId, berthId, at = 0) {
  if (berthId == null) return;
  if (!state.leaving) state.leaving = {};
  // at: Spieluhr des neuen Tages, zu der das Boot ablegt (gestaffelte Abreise am Vormittag).
  // Bis dahin liegt es noch in der Box (off: false), danach läuft die Rückfallzeit.
  state.leaving[berthId] = { boatId, elapsed: 0, at, off: !(at > 0) };
}

/** Box freigeben, sobald das abreisende Boot heraus ist (per Boot-id oder Platz-id). */
export function berthCleared(state, ctx, { boatId = null, berthId = null } = {}) {
  const events = [];
  for (const [id, l] of Object.entries(state.leaving || {})) {
    if (id === berthId || (boatId != null && String(l.boatId) === String(boatId))) {
      delete state.leaving[id];
      events.push({ type: 'berthFreed', berthId: id, boatId: l.boatId });
    }
  }
  return { ok: events.length > 0, events };
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

/** Zusätzliche Passregeln aus dem Hook 'fit'. Gibt den ersten Grund zurück oder null. */
export function hookWhyNotFit(state, ctx, boat, berth) {
  for (const fn of ctx.hooks.fit || []) {
    const why = fn({ state, ctx, boat, berth });
    if (why) return why;
  }
  return null;
}

/** Wie viele Wünsche des Boots dieser Platz selbst erfüllt (Strom, ruhige Lage und so weiter). */
export function berthWishHits(state, ctx, boat, berth) {
  const bw = ctx.rules.berthWishes;
  return (boat.wishes || []).filter((w) => bw[w] && berthHas(state, ctx, berth, bw[w])).length;
}

function berthScore(state, ctx, boat, berth) {
  // Höher ist besser: erfüllte Platz-Wünsche zuerst, dann Komfort, dann möglichst knapper Platz,
  // damit große Plätze für große Boote frei bleiben.
  const wishHits = berthWishHits(state, ctx, boat, berth);
  const slack = berth.maxLength * berth.maxBeam - boat.length * boat.beam;
  return wishHits * 1000 + (berth.comfort || 0) * 100 - slack;
}

/** Freie Plätze, an die das Boot passt, der beste zuerst. Diese Plätze leuchten beim Antippen auf. */
export function fittingBerths(state, ctx, boatId) {
  const boat = state.boats[boatId];
  if (!boat) return [];
  return availableBerths(state, ctx)
    .filter((b) => isFree(state, b.id) && fits(boat, b, ctx.rules, state.stage) && !hookWhyNotFit(state, ctx, boat, b))
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
    wishes: [], nights: 1, status: 'expected', arriveAt: 0, waitingSince: null, waitSpot: null, atBuoy: false, atBuoySince: null, berthId: null,
    wishesMet: 0, wishesTotal: 0, pendingFee: 0, paid: false, feeDay: null, penalty: 0,
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
  // Morgenrunde: Die Versorgung zählt neu, wer noch bleibt, zahlt die nächste Nacht.
  state.served = {};
  for (const boat of mooredBoats(state)) {
    if (!boat.stationed) chargeFee(state, ctx, boat, mods, events);
  }
  planTrips(state, ctx, mods, sea.winter);
  const rate = sea.winter ? 0 : arrivalRate(state, ctx, mods);
  // Ankünfte wie im echten Hafen eher nachmittags: zwischen arrivalFrom und arrivalWindow
  // (Anteile des Tages), am häufigsten um arrivalPeak.
  const from = ctx.rules.dayLength * (ctx.rules.arrivalFrom ?? 0);
  const window = ctx.rules.dayLength * ctx.rules.arrivalWindow - from;
  // Nie mehr Boote, als mit dem Mindestabstand in das Fenster passen (auch an Regatta- und Festtagen):
  // keine Wellen, wer nicht mehr passt, kommt an diesem Tag nicht.
  const maxN = ctx.rules.arrivalMinGap > 0 ? Math.max(1, Math.floor(window / ctx.rules.arrivalMinGap)) : Infinity;
  const n = Math.min(maxN, Math.floor(rate) + (random(state) < rate - Math.floor(rate) ? 1 : 0));
  const peak = ctx.rules.arrivalPeak != null ? ctx.rules.dayLength * ctx.rules.arrivalPeak - from : null;
  const list = [];
  for (let i = 0; i < n; i++) {
    const boat = rollBoat(state, ctx, mods);
    if (!boat) break;
    boat.id = state.nextId++;
    const u = random(state);
    // Dreiecksverteilung mit Spitze bei arrivalPeak, sonst gleichmäßig
    let t = u * window;
    if (peak != null && peak > 0 && peak < window) {
      t = u < peak / window ? Math.sqrt(u * window * peak) : window - Math.sqrt((1 - u) * window * (window - peak));
    }
    boat.arriveAt = Math.round((from + t) * 10) / 10;
    list.push(boat);
  }
  list.sort((a, b) => a.arriveAt - b.arriveAt || a.id - b.id);
  spreadArrivals(list, from, from + window, ctx.rules.arrivalMinGap);
  // Erster Tag eines neuen Spiels: Das erste Boot kommt gleich, damit niemand auf leeres Wasser schaut.
  const first = ctx.rules.firstArrivalAt;
  if (state.day === 1 && first != null) {
    if (!list.length && !sea.winter) {
      const boat = rollBoat(state, ctx, mods);
      if (boat) { boat.id = state.nextId++; list.push(boat); }
    }
    if (list.length) list[0].arriveAt = Math.min(list[0].arriveAt ?? first, first);
    // Ruhiger Start: Die übrigen Boote des ersten Tags rücken gleichmäßig in die Zeit ab calm (fünf
    // Mindestabstände nach dem ersten Boot), damit man das erste in Ruhe zuweisen kann und danach
    // keine Gruppe auf einmal kommt.
    const calm = (list[0]?.arriveAt ?? first) + 5 * (ctx.rules.arrivalMinGap || 0);
    const end = from + window;
    if (calm < end) {
      for (let i = 1; i < list.length; i++) {
        const t = list[i].arriveAt;
        list[i].arriveAt = Math.round((calm + (Math.max(t, from) - from) * (end - calm) / (end - from)) * 10) / 10;
      }
      spreadArrivals(list.slice(1), calm, end, ctx.rules.arrivalMinGap);
    }
  }
  // Herkunft in der Reihenfolge der Ankunft, damit zwei Boote hintereinander nie aus derselben Ecke kommen
  list.forEach((boat, i) => { boat.origin = boatOrigin(state, state.day * 7 + i); });
  state.upcoming = list;
  state.scheduledDay = state.day;
  events.push({ type: 'dayStart', day: state.day, stage: state.stage, expected: list.length, winter: sea.winter, year: sea.year });
}

/**
 * Herkunft eines Boots als Zahl von 0 bis unter 1 (Stelle entlang des Revierrands, die Ansicht
 * legt fest, wo das liegt). Aufeinanderfolgende Boote kommen aus deutlich verschiedenen Richtungen
 * (goldener Schnitt), je Spiel anders (Seed). Verbraucht keinen Zufall, damit Spielstände gleich bleiben.
 */
export function boatOrigin(state, n) {
  const x = n * 0.6180339887498949 + ((state.seed >>> 0) % 9973) / 9973;
  return Math.round((x - Math.floor(x)) * 1000) / 1000;
}

/**
 * Zieht sortierte Ankunftszeiten auseinander, damit Boote nicht im Pulk erscheinen: zwischen zwei
 * Ankünften liegen mindestens minGap Sekunden. Passen nicht alle mit diesem Abstand ins Fenster,
 * wird der Abstand so weit verkleinert, dass sie sich gleichmäßig verteilen.
 */
export function spreadArrivals(list, from, to, minGap) {
  if (!(minGap > 0) || list.length < 2) return list;
  const gap = Math.min(minGap, (to - from) / list.length);
  for (let i = 1; i < list.length; i++) list[i].arriveAt = Math.max(list[i].arriveAt, list[i - 1].arriveAt + gap);
  // Was hinten über das Fenster hinausragt, rückt von hinten nach vorn auf
  let limit = to;
  for (let i = list.length - 1; i >= 0 && list[i].arriveAt > limit; i--) {
    list[i].arriveAt = limit;
    limit -= gap;
  }
  for (const b of list) b.arriveAt = Math.round(b.arriveAt * 10) / 10;
  return list;
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
  if (!boat.stationed) heute(state).angelegt++;
  events.push({ type: 'moored', boatId: boat.id, berthId });
  const seen = (state.logbook[boat.typeId] ||= []);
  const key = boat.modelId ?? boat.typeId;
  if (!seen.includes(key)) {
    seen.push(key);
    events.push({ type: 'logbookNew', typeId: boat.typeId, modelId: boat.modelId });
  }
  // Wie im echten Hafen: Das Liegegeld für die kommende Nacht wird gleich nach dem Anlegen fällig.
  if (!boat.stationed) chargeFee(state, ctx, boat, modifiers(state, ctx), events);
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
  const why = whyNotFit(boat, berth, ctx.rules, state.stage) || hookWhyNotFit(state, ctx, boat, berth);
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
 * Die Box, die sich ein Gast selbst sucht: unter den freien Boxen, in die er passt, die mit den
 * meisten erfüllten Platz-Wünschen (zum Beispiel Strom), bei Gleichstand die nächste, auch wenn
 * sie zu groß für ihn ist. Den Hafen gut zu belegen (kleine Boote in kleine Boxen, Komfort)
 * lohnt sich deshalb weiter von Hand oder mit dem Hafenbüro. "Nächste" misst
 * ctx.berthDistance(boat, berth, state) (die Brücke rechnet von der Warteboje zur Box); ohne
 * diese Angabe gilt die Reihenfolge am Steg (A01, A02, ...).
 */
export function selfBerth(state, ctx, boatId) {
  const boat = state.boats[boatId];
  if (!boat) return null;
  const dist = (b) => {
    const d = ctx.berthDistance?.(boat, b, state);
    return Number.isFinite(d) ? d : null;
  };
  const list = availableBerths(state, ctx)
    .filter((b) => isFree(state, b.id) && fits(boat, b, ctx.rules, state.stage) && !hookWhyNotFit(state, ctx, boat, b))
    .map((b) => ({ b, d: dist(b), w: berthWishHits(state, ctx, boat, b) }))
    // Die Crew sucht sich den Platz, der ihre Wünsche erfüllt; unter gleich guten den nächsten
    .sort((x, y) => y.w - x.w || (x.d ?? Infinity) - (y.d ?? Infinity) || String(x.b.id).localeCompare(String(y.b.id), 'de', { numeric: true }));
  return list[0]?.b.id ?? null;
}

/**
 * Wartende Boote fahren von selbst ein: Wer seit queue.selfEnterAfter Sekunden im Revier ist und
 * nicht vom Spieler gehalten wird (boat.held, zum Beispiel ausgewählt oder im Schlepp), nimmt
 * die nächste passende freie Box. Passt keine, wartet das Boot weiter.
 */
export function selfEnter(state, ctx) {
  const events = [];
  const after = ctx.rules.queue.selfEnterAfter;
  if (after == null) return events;
  const rush = state.queue.length > waitSpotCount(state, ctx) / 2;
  for (const id of [...state.queue]) {
    const b = state.boats[id];
    if (!b || b.held) continue;
    // Ruhiger Betrieb: Das Boot liegt erst kurz an der Boje, Zeit für den Spieler, es zu lenken.
    // Andrang (mehr als die Hälfte der Bojen vergeben): Die Zeit zählt schon ab Ankunft im Revier,
    // das Boot hält von der Anfahrt aus direkt auf die Box zu und gibt seine Boje frei.
    const since = b.atBuoy ? Math.min(b.atBuoySince, rush ? b.waitingSince : b.atBuoySince) : rush ? b.waitingSince : null;
    if (since == null || state.clock - since < after) continue;
    const best = selfBerth(state, ctx, id);
    if (best) {
      b.selfEntered = true;
      moor(state, ctx, b, best, events);
      events.push({ type: 'selfEntered', boatId: id, berthId: best });
      // Nacheinander einfahren: pro Sekunde höchstens ein Boot, damit sie sich nicht in die Quere kommen
      if (ctx.rules.queue.selfEnterOneByOne !== false) break;
    }
  }
  return events;
}

/** Spieler hält ein wartendes Boot fest (ausgewählt, im Schlepp): es fährt nicht von selbst ein. */
export function holdBoat(state, boatId, held = true) {
  const b = state.boats[boatId];
  if (b && b.status === 'waiting') b.held = !!held;
}

// ---------------------------------------------------------------------------
// Tagestörn: Gäste mit mehreren Nächten fahren tagsüber hinaus, die Box bleibt reserviert

function planTrips(state, ctx, mods, winter) {
  const t = ctx.rules.trips;
  for (const boat of mooredBoats(state)) if (boat.trip) boat.trip = null;
  if (!t || winter || mods.seaArrivals === false) return;
  for (const boat of mooredBoats(state)) {
    if (boat.stationed || boat.nights < 2 || boat.special) continue;
    if (random(state) >= t.chance) continue;
    const at = (range) => Math.round((range[0] + random(state) * (range[1] - range[0])) * ctx.rules.dayLength);
    boat.trip = { out: at(t.out), back: at(t.back), away: false };
  }
}

function tripStep(state, ctx, events) {
  for (const boat of mooredBoats(state)) {
    const t = boat.trip;
    if (!t) continue;
    if (!t.away && !t.done && state.clock >= t.out && state.clock < t.back) {
      t.away = true;
      events.push({ type: 'tripOut', boatId: boat.id, berthId: boat.berthId });
    } else if (t.away && state.clock >= t.back) endTrip(boat, events);
  }
}

function endTrip(boat, events) {
  if (!boat.trip?.away) return;
  boat.trip.away = false;
  boat.trip.done = true;
  events.push({ type: 'tripBack', boatId: boat.id, berthId: boat.berthId });
}

/**
 * Zustand eines Liegeplatzes für das Grün-Rot-Schild:
 * 'frei' (grün), 'belegt', 'ausflug' (Gast auf Tagestörn, Box reserviert), 'reserviert'
 * (fest vergeben, legt gerade ab oder von einem Modul gesperrt), 'aus' (in dieser Stufe nicht da).
 */
export function berthState(state, ctx, berthId) {
  const berth = ctx.berthById[berthId];
  if (!berth || !berthAvailable(state, berth)) return 'aus';
  const boat = state.boats[state.berths[berthId]];
  if (boat) return boat.trip?.away ? 'ausflug' : 'belegt';
  if (state.leaving?.[berthId]) return 'belegt';
  if (berth.reserved) return 'reserviert';
  if (hookWhyNotFit(state, ctx, { stationed: false, nights: 1, wishes: [], probe: true }, berth)) return 'reserviert';
  return 'frei';
}

/** Zustände aller Plätze der aktuellen Stufe: { A01: 'frei', ... } */
export function berthStates(state, ctx) {
  return Object.fromEntries(availableBerths(state, ctx).map((b) => [b.id, berthState(state, ctx, b.id)]));
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
  const weg = heute(state).weggefahren;
  weg[why] = (weg[why] || 0) + 1;
  const ta = ctx.rules.turnAway;
  // Sind alle Wartebojen belegt, dreht ein Boot ab, ohne gewartet zu haben: keine Bewertung.
  const rated = why !== 'queueFull' && why !== 'rebuild' && random(state) < ta.chance;
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
    // Alle Bojen belegt: Wer eine passende freie Box sieht, hält direkt darauf zu statt abzudrehen
    const direct = ctx.rules.queue.selfEnterAfter != null ? selfBerth(state, ctx, boat.id) : null;
    if (direct == null) {
      turnAway(state, ctx, boat, events, 'queueFull');
      return;
    }
    boat.status = 'waiting';
    boat.waitSpot = state.queue.length % Math.max(1, waitSpotCount(state, ctx));
    boat.waitingSince = state.clock;
    boat.atBuoy = false;
    boat.atBuoySince = null;
    boat.selfEntered = true;
    events.push({ type: 'arrived', boatId: boat.id, waitSpot: boat.waitSpot, direct: true });
    moor(state, ctx, boat, direct, events);
    events.push({ type: 'selfEntered', boatId: boat.id, berthId: direct, direct: true });
    return;
  }
  boat.status = 'waiting';
  boat.waitSpot = spot;
  boat.waitingSince = state.clock; // Beginn der Anfahrt zur Boje
  boat.atBuoy = false;
  boat.atBuoySince = null;
  state.queue.push(boat.id);
  events.push({ type: 'arrived', boatId: boat.id, waitSpot: spot });
  if (state.office >= ctx.rules.office.autoAssign) {
    const best = fittingBerths(state, ctx, boat.id)[0];
    if (best) moor(state, ctx, boat, best, events);
  }
}

/**
 * Boot ist an der Warteboje fest (meldet die 3D-Ansicht). Erst ab jetzt zählt seine Geduld.
 * Zuweisen geht schon während der Anfahrt.
 */
// Nach dem Laden eines Spielstands liegen alle wartenden Boote sofort an ihrer Boje.
// Die Geduld zählt dann ab dem Ladezeitpunkt, falls das Boot noch auf der Anfahrt war.
export function settleWaiting(state) {
  for (const b of Object.values(state.boats || {})) {
    if (b.status === 'waiting' && !b.atBuoy) { b.atBuoy = true; b.atBuoySince = state.clock; }
    if (b.held) b.held = false; // nach dem Laden ist nichts ausgewählt
  }
  // Abreisende Boote zeigt die 3D-Ansicht nach dem Laden nicht mehr, ihre Boxen sind frei.
  state.leaving = {};
}

export function markAtBuoy(state, ctx, boatId) {
  const boat = state.boats[boatId];
  if (!boat || boat.status !== 'waiting' || boat.atBuoy) return { ok: false, events: [] };
  boat.atBuoy = true;
  boat.atBuoySince = state.clock;
  return { ok: true, events: [{ type: 'atBuoy', boatId }] };
}

/** Sekunden, die ein wartendes Boot noch an der Boje bleibt (während der Anfahrt die volle Geduld). */
export function patienceLeft(state, ctx, boatId) {
  const b = state.boats[boatId];
  if (!b || b.status !== 'waiting') return 0;
  if (!b.atBuoy) return ctx.rules.queue.patience;
  return Math.max(0, ctx.rules.queue.patience - (state.clock - b.atBuoySince));
}

/** Ein wartendes Boot wegschicken (Spieler tippt "Abweisen"). Gilt nicht als schlechte Bewertung. */
export function dismiss(state, ctx, boatId) {
  const boat = state.boats[boatId];
  if (!boat || boat.status !== 'waiting') return { ok: false, events: [] };
  state.queue = state.queue.filter((id) => id !== boatId);
  delete state.boats[boatId];
  const weg = heute(state).weggefahren;
  weg.weggeschickt = (weg.weggeschickt || 0) + 1;
  return { ok: true, events: [{ type: 'dismissed', boatId }] };
}

// ---------------------------------------------------------------------------
// Hafengeld (fällig beim Anlegen und jeden Morgen) und Abend

/** Hafengeld für eine Nacht bei n erfüllten Wünschen. */
export function nightlyFee(state, ctx, boat, wishesMet, priceFactor = 1) {
  const type = ctx.typeById[boat.typeId];
  const base = type?.fee ?? ctx.rules.baseFee[boat.size] ?? 0;
  return Math.round(base * (1 + ctx.rules.wishBonus * wishesMet) * priceFactor);
}

/** Wie viele Boote ein Service pro Tag versorgen kann. */
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

/**
 * Geld gutschreiben (auch für andere Module, zum Beispiel Services).
 * quelle ordnet den Betrag im Tagesabschluss ein (QUELLEN), detail unterteilt sie weiter
 * (zum Beispiel die Anlage bei 'services' oder 'rundgang' beim Liegegeld).
 */
export function addIncome(state, amount, quelle = 'sonstiges', detail = null) {
  if (!(amount > 0)) return;
  state.money += amount;
  state.stats.dayIncome += amount;
  state.stats.totalIncome += amount;
  const h = heute(state);
  h.einnahmen[quelle] = (h.einnahmen[quelle] || 0) + amount;
  if (detail) {
    const d = (h.details[quelle] ||= {});
    d[detail] = (d[detail] || 0) + amount;
  }
}

// ---------------------------------------------------------------------------
// Tagesabschluss: was der Tag gebracht hat, je Quelle (docs/tagesabschluss.md)

/** Einnahmequellen in der Reihenfolge des Tagesabschlusses. */
export const QUELLEN = ['liegegeld', 'pacht', 'gastro', 'services', 'tagesziele', 'sonstiges'];
/** So viele Tage hebt der Spielstand auf (für den Verlauf und den besten Tag). */
export const VERLAUF_TAGE = 30;

function neuerTag(state) {
  return {
    tag: state.day, einnahmen: {}, details: {}, ausgaben: {},
    angelegt: 0, abgereist: 0, bewertungen: [], weggefahren: {}, rufStart: Math.round(reputation(state) * 100) / 100,
  };
}

/** Laufende Buchführung des heutigen Tages (wird nachts zum Bericht). */
export function heute(state) {
  const s = state.stats;
  if (!s.heute || s.heute.tag !== state.day) s.heute = neuerTag(state);
  return s.heute;
}

/**
 * Bericht des Tages bauen: Einnahmen je Quelle, Ausgaben, Boote, Bewertungen, Tagesziele, Ruf und bester Tag.
 * Wird nachts mit dem Ereignis 'dayEnd' geliefert und in state.stats.verlauf aufgehoben.
 */
export function tagesbericht(state, ctx) {
  const h = heute(state);
  const s = state.stats;
  const summe = Object.values(h.einnahmen).reduce((a, b) => a + b, 0);
  const ausgaben = Object.values(h.ausgaben).reduce((a, b) => a + b, 0);
  const ziele = state.modules?.ziele;
  const zielListe = ziele && ziele.tag === state.day ? ziele.liste || [] : [];
  const b = h.bewertungen;
  const vorher = s.besterTag || (s.bestDayIncome > 0 ? { tag: null, summe: s.bestDayIncome } : null);
  return {
    tag: state.day,
    stufe: state.stage,
    einnahmen: { ...h.einnahmen },
    details: JSON.parse(JSON.stringify(h.details)),
    summe,
    ausgaben: { ...h.ausgaben },
    ausgabenSumme: ausgaben,
    angelegt: h.angelegt,
    abgereist: h.abgereist,
    bewertung: b.length ? Math.round((b.reduce((x, y) => x + y, 0) / b.length) * 10) / 10 : null,
    weggefahren: { ...h.weggefahren },
    weggefahrenSumme: Object.values(h.weggefahren).reduce((x, y) => x + y, 0),
    ziele: { erledigt: zielListe.filter((z) => z.erledigt).length, gesamt: zielListe.length },
    ruf: { vorher: h.rufStart, nachher: Math.round(reputation(state) * 100) / 100 },
    rekord: summe > 0 && (!vorher || summe > vorher.summe),
    besterTag: vorher,
    liegend: mooredBoats(state).filter((x) => !x.stationed).length,
    plaetze: ctx ? availableBerths(state, ctx).length : null,
  };
}

function startEvening(state, ctx, events) {
  state.phase = 'evening';
  const mods = modifiers(state, ctx);
  // Wer noch wartet, fährt weiter
  // (außer sie dürfen über Nacht an der Boje bleiben und morgens weitermachen)
  if (!ctx.rules.queue.overnight) {
    for (const id of [...state.queue]) turnAway(state, ctx, state.boats[id], events, 'evening');
  }

  let visitors = 0;
  for (const boat of mooredBoats(state)) {
    endTrip(boat, events); // spätestens abends sind alle Ausflügler zurück
    visitors += boat.dayVisitors || 0;
    if (boat.stationed) {
      // Fischer und andere fest vergebene Plätze: feste Pacht je Abend (rules.stationedFee).
      // Dauerlieger: Anteil ihres Gastpreises, mit Vorauskasse (rules.dauer.vorauskasse) gar nichts
      // am Abend, weil die Saisonpacht schon bezahlt ist (features/dauerlieger.js).
      const share = Math.round(nightlyFee(state, ctx, boat, 0) * ctx.rules.stationedFeeShare);
      const fee = boat.dauer ? (ctx.rules.dauer?.vorauskasse ? 0 : share) : ctx.rules.stationedFee ?? share;
      if (fee > 0) {
        addIncome(state, fee, 'pacht');
        events.push({ type: 'stationedFee', boatId: boat.id, amount: fee });
      }
    }
  }
  visitors = Math.round(visitors * mods.visitorFactor);
  if (visitors > 0) {
    const amount = Math.round(visitors * ctx.rules.visitorSpend * (state.facilities.essen || 0) * mods.serviceIncomeFactor);
    if (amount > 0) {
      addIncome(state, amount, 'gastro');
      events.push({ type: 'visitorIncome', visitors, amount });
    }
  }
  const boats = mooredBoats(state);
  for (const fn of ctx.hooks.evening) fn({ state, ctx, boats, events, addIncome: (a, quelle, detail) => addIncome(state, a, quelle, detail) });
  events.push({ type: 'evening', day: state.day });
}

/**
 * Liegegeld für die kommende Nacht fällig stellen: beim Anlegen und für Bleibende jeden Morgen.
 * Dabei wird geprüft, welche Wünsche der Hafen heute erfüllt (Versorgung reicht je Tag für
 * eine feste Zahl Boote, state.served zählt mit). Das Boot gilt als unbezahlt (boat.paid = false),
 * bis kassiert ist. Mit Hafenbüro Stufe 2 kassiert das Büro sofort selbst.
 */
function chargeFee(state, ctx, boat, mods, events) {
  if (boat.feeDay === state.day) return; // heute schon abgerechnet
  const berth = ctx.berthById[boat.berthId];
  const served = (state.served ||= {});
  const metList = [];
  for (const w of boat.wishes) {
    const prop = ctx.rules.berthWishes[w];
    let ok;
    if (prop) ok = berthHas(state, ctx, berth, prop);
    else {
      ok = (served[w] || 0) < facilityCapacity(state, ctx, w);
      if (ok) served[w] = (served[w] || 0) + 1;
    }
    if (ok) metList.push(w);
  }
  boat.wishesMet += metList.length;
  boat.wishesTotal += boat.wishes.length;
  const fee = nightlyFee(state, ctx, boat, metList.length, mods.priceFactor);
  boat.pendingFee += fee;
  boat.feeDay = state.day;
  boat.paid = false;
  events.push({ type: 'feeReady', boatId: boat.id, amount: fee, wishesMet: metList });
  if (state.office >= ctx.rules.office.autoCollect) events.push(...collect(state, ctx, boat.id).events);
}

/** Münze über einem Boot antippen. */
export function collect(state, ctx, boatId) {
  const boat = state.boats[boatId];
  if (!boat || boat.pendingFee <= 0) return { ok: false, events: [] };
  const amount = boat.pendingFee;
  boat.pendingFee = 0;
  boat.paid = true;
  addIncome(state, amount, 'liegegeld', 'kassiert');
  return { ok: true, events: [{ type: 'collected', boatId, amount }] };
}

/**
 * Hafenmeister-Rundgang am Abend: Wer seine Münze liegen ließ, zahlt dem Hafenmeister nur den
 * Anteil rules.uncollectedShare. Ohne Rundgang (keine Figuren) passiert dasselbe in der Nacht.
 */
export function collectOnRound(state, ctx, boatId) {
  const boat = state.boats[boatId];
  if (!boat || boat.pendingFee <= 0) return { ok: false, events: [] };
  const amount = Math.round(boat.pendingFee * ctx.rules.uncollectedShare);
  boat.pendingFee = 0;
  boat.paid = true;
  addIncome(state, amount, 'liegegeld', 'rundgang');
  return { ok: true, events: [{ type: 'collected', boatId, amount, round: true }] };
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
      boat.paid = true;
    }
  }
  if (honesty > 0) {
    addIncome(state, honesty, 'liegegeld', 'nacht');
    events.push({ type: 'honestyBox', amount: honesty });
  }
  // Abreise
  for (const boat of mooredBoats(state)) {
    if (boat.stationed) continue;
    boat.nights -= 1;
    if (boat.nights > 0) continue;
    const rating = rateBoat(ctx, boat, mods.ratingBonus);
    pushRating(state, ctx, rating);
    heute(state).abgereist++;
    heute(state).bewertungen.push(rating);
    state.guests++;
    state.stageGuests = (state.stageGuests || 0) + 1;
    delete state.berths[boat.berthId];
    delete state.boats[boat.id];
    // Abgerechnet wird nachts, abgelegt am nächsten Vormittag zu einer eigenen Zeit je Boot
    const w = ctx.rules.departWindow;
    const leaveAt = w ? Math.round((w[0] + random(state) * (w[1] - w[0])) * ctx.rules.dayLength * 10) / 10 : 0;
    startLeaving(state, boat.id, boat.berthId, leaveAt);
    events.push({ type: 'departed', boatId: boat.id, berthId: boat.berthId, typeId: boat.typeId, rating, leaveAt });
  }
  for (const fn of ctx.hooks.night) fn({ state, ctx, events });
  const s = state.stats;
  const bericht = tagesbericht(state, ctx);
  events.push({ type: 'dayEnd', day: state.day, income: s.dayIncome, turnedAway: s.turnedAwayToday, bericht });
  s.bestDayIncome = Math.max(s.bestDayIncome, s.dayIncome);
  if (bericht.rekord) s.besterTag = { tag: bericht.tag, summe: bericht.summe };
  s.verlauf = [...(s.verlauf || []), bericht].slice(-VERLAUF_TAGE);
  s.heute = null;
  s.dayIncome = 0;
  s.turnedAwayToday = 0;

  state.day++;
  state.phase = 'day';
  state.clock = 0;
  // Wer über Nacht an der Boje lag, macht morgens mit frischer Geduld weiter
  for (const id of state.queue) {
    const b = state.boats[id];
    if (!b) continue;
    b.waitingSince = 0;
    if (b.atBuoy) b.atBuoySince = 0;
    b.overnight = (b.overnight || 0) + 1;
  }
  startDay(state, ctx, events);
  if (canAdvanceStage(state, ctx).ok) events.push({ type: 'stageReady', stage: state.stage + 1 });
}

// ---------------------------------------------------------------------------
// Zeit

/** Wartende Boote: Ankunft an der Boje, Geduld (nur tagsüber), Einfahren von selbst oder durchs Hafenbüro. */
function queueStep(state, ctx, events, countPatience) {
  const { queue } = ctx.rules;
  for (const id of [...state.queue]) {
    const b = state.boats[id];
    // Alte Spielstände kennen atBuoy nicht: dann gilt die Wartezeit ab Ankunft
    if (b.atBuoy === undefined) {
      b.atBuoy = true;
      b.atBuoySince = b.waitingSince;
    }
    if (!b.atBuoy && state.clock - b.waitingSince >= (queue.approachMax ?? 0)) {
      events.push(...markAtBuoy(state, ctx, id).events);
    }
    if (countPatience && b.atBuoy && state.clock - b.atBuoySince > queue.patience) turnAway(state, ctx, b, events, 'patience');
  }
  // Hafenbüro mit Automatik: wartende Boote bekommen ihren Platz, sobald einer frei wird
  if (state.queue.length && state.office >= ctx.rules.office.autoAssign) events.push(...autoAssign(state, ctx));
  // Wie im echten Hafen: Wer kurz an der Boje gewartet hat, sucht sich selbst eine freie Box
  else if (state.queue.length) events.push(...selfEnter(state, ctx));
}

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
    for (const [berthId, l] of Object.entries(state.leaving || {})) {
      if (l.off === false) {
        // Abreise am Vormittag: erst zur geplanten Zeit ablegen (oder sofort, falls die Box schon neu vergeben ist)
        if (state.clock < l.at && !state.berths[berthId]) continue;
        l.off = true;
        events.push({ type: 'castOff', boatId: l.boatId, berthId });
      }
      l.elapsed += step;
      if (l.elapsed >= (ctx.rules.leaveMax ?? 0)) events.push(...berthCleared(state, ctx, { berthId }).events);
    }
    if (state.phase === 'day') {
      while (state.upcoming.length && state.upcoming[0].arriveAt <= state.clock) {
        arrive(state, ctx, state.upcoming.shift(), events);
      }
      queueStep(state, ctx, events, true);
      tripStep(state, ctx, events);
      for (const fn of ctx.hooks.tick) fn({ state, ctx, events });
      if (state.clock >= dayLength) {
        state.upcoming = []; // wer heute nicht mehr eingelaufen ist, kommt nicht
        startEvening(state, ctx, events);
      }
    } else if (state.clock >= dayLength + eveningLength) {
      night(state, ctx, events);
    } else if (queue.overnight) {
      // Abends läuft keine Geduld ab, aber wer noch an der Boje liegt, kann weiter einfahren
      queueStep(state, ctx, events, false);
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
export function spend(state, amount, zweck = 'bau') {
  if (!(amount >= 0) || state.money < amount) return false;
  state.money -= amount;
  if (amount > 0) {
    const a = heute(state).ausgaben;
    a[zweck] = (a[zweck] || 0) + amount;
  }
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

/**
 * Abschlussziel der Region in der letzten Stufe: Besuche großer Schiffe (zählt state.bigVisits),
 * Ruf und alle Plätze gebaut. Vorher { active: false }.
 */
export function regionGoal(state, ctx) {
  const goal = ctx.rules.regionGoal;
  if (!goal || state.stage < ctx.rules.maxStage) return { active: false, ok: false, missing: ['stage'] };
  const rep = reputation(state);
  const visits = state.bigVisits || 0;
  const open = ctx.berths.filter((b) => (b.stages ? b.stages.includes(state.stage) : b.stage <= state.stage) && !berthAvailable(state, b)).length;
  const missing = [];
  if (visits < (goal.bigVisits || 0)) missing.push('bigVisits');
  if (rep < (goal.reputation || 0)) missing.push('reputation');
  if (goal.allBerths && open > 0) missing.push('berths');
  return { active: true, ok: missing.length === 0, missing, goal, visits, reputation: rep, openBerths: open, done: !!state.regionDone };
}

/** Besuch eines großen Schiffs zählen (Services-Modul). Meldet einmal 'regionDone', wenn das Ziel steht. */
export function addBigVisit(state, ctx, n = 1) {
  if (state.stage < ctx.rules.maxStage) return [];
  state.bigVisits = (state.bigVisits || 0) + n;
  return checkRegionGoal(state, ctx);
}

function checkRegionGoal(state, ctx) {
  if (state.regionDone || !regionGoal(state, ctx).ok) return [];
  state.regionDone = true;
  return [{ type: 'regionDone', region: state.region, day: state.day }];
}

/**
 * Bringt einen frischen Spielstand auf eine Ausbaustufe, zum Ausprobieren mit ?stufe=n:
 * alle Ausbauten bis dahin und alle Stegprojekte der Stufe sind gebaut, dazu die Versorgung
 * der früheren Stufen, passendes Startgeld, ein guter Ruf und die Gästezahl der früheren Stufen. Markiert den Stand als
 * Testmodus (state.testmodus), damit er den echten Spielstand nicht überschreibt.
 */
export function applyTestStage(state, ctx, stage) {
  const r = ctx.rules;
  const n = Math.max(1, Math.min(r.maxStage, Math.floor(Number(stage)) || 1));
  state.stage = n;
  state.testmodus = true;
  let guests = 0;
  for (let k = 1; k < n; k++) {
    const g = r.stageGoals[k];
    if (g?.project) state.buildings[g.project] = 1;
    guests += g?.guests || 0;
  }
  for (const p of r.jettyProjects || []) if (p.stage <= n) state.buildings[p.id] = 1;
  // Versorgung wie bei einem Spieler, der so weit gekommen ist: alles, was es schon in den
  // früheren Stufen gab (in Stufe 1 nichts), damit der Ruf nicht gleich abstürzt.
  for (const [key, f] of Object.entries(r.facilities)) {
    const levels = Object.keys(f.cost || {}).map(Number).filter((lvl) => (f.fromStage?.[lvl] ?? 1) < n);
    if (levels.length) state.facilities[key] = Math.max(...levels);
  }
  state.guests = guests;
  state.stageGuests = 0;
  state.ratings = Array(r.reputation.window).fill(4);
  const next = r.stageGoals[n];
  const facilityCosts = Object.values(r.facilities).flatMap((f) => Object.entries(f.cost || {}).filter(([lvl]) => (f.fromStage?.[lvl] ?? 1) <= n).map(([, c]) => c));
  state.money = Math.max(500, Math.round((next?.cost || 0) * 0.5), Math.max(0, ...facilityCosts));
  return state;
}

export function advanceStage(state, ctx) {
  const check = canAdvanceStage(state, ctx);
  if (!check.ok) return { ok: false, missing: check.missing };
  spend(state, check.goal.cost, 'ausbau');
  if (check.goal.project) state.buildings[check.goal.project] = 1;
  const from = state.stage;
  state.stage++;
  state.stageGuests = 0;
  const events = [{ type: 'stageUp', stage: state.stage }];
  clearVanishedBerths(state, ctx, from, events);
  return { ok: true, events };
}

/**
 * Was der nächste Stufenausbau für liegende Boote bedeutet (Hinweis im Baumenü):
 * gone = Plätze, die wegfallen, guests = Gäste, die dann abreisen, fixed = feste Boote, die umziehen.
 */
export function stageUpPreview(state, ctx) {
  const next = state.stage + 1;
  const inStage = (b, st) => (b.stages ? b.stages.includes(st) : b.stage <= st);
  const gone = ctx.berths.filter((b) => berthAvailable(state, b) && !inStage(b, next)).map((b) => b.id);
  const boats = gone.map((id) => state.boats[state.berths[id]]).filter(Boolean);
  // Boote, deren Box bleibt, aber in der nächsten Stufe nicht mehr passt (flacher): sie legen um
  const moving = mooredBoats(state)
    .filter((b) => !gone.includes(b.berthId) && ctx.berthById[b.berthId] && fits(b, ctx.berthById[b.berthId], ctx.rules, state.stage) && !fits(b, ctx.berthById[b.berthId], ctx.rules, next))
    .map((b) => b.id);
  return {
    gone,
    moving,
    guests: boats.filter((b) => !b.stationed).map((b) => b.id),
    fixed: boats.filter((b) => b.stationed).map((b) => b.id),
  };
}

/**
 * Beim Stufenausbau werden manche Stege umgebaut, ihre alten Plätze gibt es dann nicht mehr
 * (zum Beispiel B01, B02 und der T-Kopf an Steg B ab Stufe 3). Damit dort kein Boot im Leeren liegt:
 * - Gäste reisen ab, bevor gebaut wird: abgerechnet, bewertet und gezählt wie bei jeder Abreise,
 *   offenes Liegegeld wird noch kassiert, sie legen sofort ab.
 * - Fest liegende Boote (Dauerlieger, Seenotretter, Fischer) ziehen auf einen freien passenden Platz
 *   um ('relocated'). Findet sich keiner, verlassen sie den Hafen ('unstationed').
 * Module mit eigenem Zustand je Platz (Dauerplätze) ziehen über den Hook 'stageUp' mit um.
 */
function clearVanishedBerths(state, ctx, from, events) {
  const exists = (b) => (b.stages ? b.stages.includes(state.stage) : b.stage <= state.stage);
  const gone = ctx.berths.filter((b) => (b.stages ? b.stages.includes(from) : b.stage <= from) && !exists(b)).map((b) => b.id);
  const goneSet = new Set(gone);
  const mods = modifiers(state, ctx);
  // like: der alte Platz. War er fest vergeben (Fischer, Retter), kommt nur ein Platz derselben Art in Frage.
  const findBerth = (boat, like = null) => {
    const slack = (b) => b.maxLength * b.maxBeam - boat.length * boat.beam;
    const probe = { ...boat, stationed: true };
    const list = availableBerths(state, ctx)
      .filter((b) => isFree(state, b.id) && fits(probe, b, ctx.rules, state.stage))
      .filter((b) => (like?.reserved ? b.reserved && b.kind === like.kind : !b.reserved))
      .sort((a, b) => slack(a) - slack(b) || String(a.id).localeCompare(String(b.id)));
    return list[0]?.id ?? null;
  };
  // Freier Platz für einen Gast, dessen Box es noch gibt, die aber nach dem Umbau nicht mehr passt
  const findGuestBerth = (boat) => availableBerths(state, ctx)
    .filter((b) => isFree(state, b.id) && fits(boat, b, ctx.rules, state.stage) && !hookWhyNotFit(state, ctx, boat, b))
    .sort((a, b) => (a.maxLength * a.maxBeam) - (b.maxLength * b.maxBeam) || String(a.id).localeCompare(String(b.id)))[0]?.id ?? null;
  const moves = [];
  for (const boat of mooredBoats(state)) {
    const berth = ctx.berthById[boat.berthId];
    const vanished = goneSet.has(boat.berthId);
    // Platz bleibt, passt aber nicht mehr (zum Beispiel flacher nach dem Umbau)
    const unfit = !vanished && berth && fits(boat, berth, ctx.rules, from) && !fits(boat, berth, ctx.rules, state.stage);
    if (!vanished && !unfit) continue;
    const old = boat.berthId;
    if (!boat.stationed && unfit) {
      delete state.berths[old];
      const to = findGuestBerth(boat);
      if (to) {
        // Der Hafenmeister bittet den Gast umzulegen: gleiche Nächte, gleiche Rechnung, neue Box
        boat.berthId = to;
        state.berths[to] = boat.id;
        events.push({ type: 'relocated', boatId: boat.id, from: old, to, guest: true });
        continue;
      }
      state.berths[old] = boat.id; // kein Platz frei: reist ab wie bei einem Platz, der wegfällt
    }
    if (!boat.stationed) {
      if (boat.pendingFee > 0) events.push(...collect(state, ctx, boat.id).events);
      endTrip(boat, events);
      const rating = rateBoat(ctx, boat, mods.ratingBonus);
      pushRating(state, ctx, rating);
      state.guests++;
      state.stageGuests = (state.stageGuests || 0) + 1;
      delete state.berths[old];
      delete state.boats[boat.id];
      events.push({ type: 'departed', boatId: boat.id, berthId: old, typeId: boat.typeId, rating, leaveAt: 0, reason: 'rebuild' });
      continue;
    }
    delete state.berths[old];
    const to = findBerth(boat, ctx.berthById[old]);
    if (to) {
      boat.berthId = to;
      state.berths[to] = boat.id;
      moves.push({ boatId: boat.id, from: old, to });
      events.push({ type: 'relocated', boatId: boat.id, from: old, to });
    } else {
      delete state.boats[boat.id];
      events.push({ type: 'unstationed', boatId: boat.id, berthId: old, reason: 'rebuild' });
    }
  }
  for (const id of gone) if (state.leaving?.[id]) delete state.leaving[id];
  settleWaitSpots(state, ctx, events);
  for (const fn of ctx.hooks.stageUp) fn({ state, ctx, from, to: state.stage, gone, moves, findBerth, events });
}

/**
 * Prüfung beim Laden eines Spielstands (save/, bridge.js): Liegt ein Gast in einer Box, die es in
 * der aktuellen Stufe nicht gibt oder die für ihn zu flach, zu kurz oder zu schmal ist (alter Stand
 * aus einer Zeit mit anderen Tiefen, Stegbildern oder Regeln), legt er in eine freie passende Box um.
 * Findet sich keine, reist er ohne Rechnung und ohne Bewertung ab (er hätte nie dort liegen dürfen).
 * Fest liegende Boote (Dauerlieger, Fischer, Retter) bleiben unberührt, ihre Plätze verwalten die Module.
 * Gibt die Liste der Änderungen zurück: [{ boatId, from, to }] (to = null: abgereist).
 */
export function repairBerths(state, ctx) {
  const changes = [];
  const exists = (b) => b && berthAvailable(state, b);
  for (const boat of mooredBoats(state)) {
    if (boat.stationed) continue;
    const berth = ctx.berthById[boat.berthId];
    if (exists(berth) && fits(boat, berth, ctx.rules, state.stage)) continue;
    const old = boat.berthId;
    if (state.berths[old] === boat.id) delete state.berths[old];
    const to = availableBerths(state, ctx)
      .filter((b) => isFree(state, b.id) && fits(boat, b, ctx.rules, state.stage) && !hookWhyNotFit(state, ctx, boat, b))
      .sort((a, b) => (a.maxLength * a.maxBeam) - (b.maxLength * b.maxBeam) || String(a.id).localeCompare(String(b.id)))[0]?.id ?? null;
    if (to) {
      boat.berthId = to;
      state.berths[to] = boat.id;
    } else {
      delete state.boats[boat.id];
    }
    changes.push({ boatId: boat.id, from: old, to });
  }
  // Einträge in berths, die auf kein liegendes Boot mehr zeigen
  for (const [id, boatId] of Object.entries(state.berths)) {
    const b = state.boats[boatId];
    if (!b || b.berthId !== id) delete state.berths[id];
  }
  return changes;
}

/**
 * Hat die neue Stufe weniger Wartebojen, liegen Boote mit zu hoher Bojennummer an einer Boje, die es
 * nicht mehr gibt. Sie verholen an die kleinste freie Boje ('waitSpotChanged'). Ist keine frei, fahren
 * sie in eine passende freie Box oder, wenn es auch die nicht gibt, ohne Bewertung weiter.
 */
function settleWaitSpots(state, ctx, events) {
  const count = waitSpotCount(state, ctx);
  for (const boat of waitingBoats(state)) {
    if (boat.waitSpot < count) continue;
    const from = boat.waitSpot;
    boat.waitSpot = null;
    const spot = freeWaitSpot(state, ctx);
    if (spot != null) {
      boat.waitSpot = spot;
      events.push({ type: 'waitSpotChanged', boatId: boat.id, from, waitSpot: spot });
      continue;
    }
    boat.waitSpot = from;
    const berth = selfBerth(state, ctx, boat.id);
    if (berth != null) {
      boat.selfEntered = true;
      moor(state, ctx, boat, berth, events);
      events.push({ type: 'selfEntered', boatId: boat.id, berthId: berth, direct: true });
    } else {
      turnAway(state, ctx, boat, events, 'rebuild');
    }
  }
}

// ---------------------------------------------------------------------------
// Zahlen aus data/economy.js (Balancing-Thread) in das Format der Regeln bringen

// Regeln aus den Spielzahlen: data/rules.js (rulesFromEconomy), hier weitergereicht.
export { rulesFromEconomy };

/** Stegprojekte, die in der aktuellen Stufe gebaut werden können und noch fehlen. */
export function openJettyProjects(state, ctx) {
  return (ctx.rules.jettyProjects || []).filter((p) => p.stage <= state.stage && !state.buildings[p.id] && projectHasBerths(state, ctx, p.id));
}

/**
 * Hat ein Projekt in der aktuellen Stufe mindestens einen Liegeplatz? Manche Stege werden beim Ausbau
 * umgebaut, ihre alten Plätze gibt es dann nicht mehr (z. B. T-Kopf an Steg B nur in Stufe 2).
 * Projekte ohne zugeordnete Plätze (reine Bauprojekte) gelten als sinnvoll.
 */
export function projectHasBerths(state, ctx, id) {
  const own = ctx.berths.filter((b) => b.requires === id);
  if (!own.length) return true;
  return own.some((b) => (b.stages ? b.stages.includes(state.stage) : b.stage <= state.stage));
}

/** Stegprojekt bauen (Kosten aus den Regeln). */
export function buildJettyProject(state, ctx, id) {
  const p = (ctx.rules.jettyProjects || []).find((x) => x.id === id);
  if (!p) return { ok: false, reason: 'unknown', events: [] };
  if (p.stage > state.stage) return { ok: false, reason: 'stage', events: [] };
  if (!projectHasBerths(state, ctx, id)) return { ok: false, reason: 'noBerths', events: [] };
  const r = build(state, id, p.cost);
  return { ...r, events: r.events || [] };
}
