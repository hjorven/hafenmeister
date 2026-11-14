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
    hooks: { modifiers: [], arrival: [], evening: [], night: [], fit: [], stageUp: [], tick: [], rating: [], walk: [] },
  };
}

/**
 * Erweiterung einhängen. Namen:
 *   modifiers  fn(state, ctx) -> Teil von DEFAULT_MODIFIERS, wird jeden Tag und bei jeder Ankunft gelesen
 *   rating     fn({ ctx, boat }) -> Anker, die zur Platzart (comfort) einer Bewertung dazukommen
 *              (zum Beispiel ein im Winter überholter Steg, features/winter.js)
 *   walk       fn({ state, ctx, berth, wish }) -> Meter vom Platz zum nächsten Gebäude, das den
 *              Wunsch erfüllt, oder null (unbekannt). Weiter als rules.walk.far zählt der Wunsch nur
 *              zum Anteil rules.walk.share (P19 B9, features/wege.js kennt die Gebäude im Bild)
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
    // Gästeprofil aus data/boats (Roadmap P19): arrivalWeight geht vor dem alten weight
    weight: t.arrivalWeight ?? t.weight ?? 1,
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
  offers: {}, // { baecker: 1 } gebaute Angebote an Land mit Stufe: erfüllen Wünsche (rules.offerWishes)
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
    Object.assign(m.offers, p.offers || {});
  }
  return m;
}

// ---------------------------------------------------------------------------
// Ruf

/**
 * Bewertungen, aus denen der Ruf besteht (Roadmap P19 C2): alle der letzten rules.reputation.days Tage
 * (heute mitgezählt), mindestens aber die letzten minCount. state.ratingDays hält den Tag jeder
 * Bewertung, von hinten ausgerichtet; ältere Spielstände ohne Tage zählen nur zum Auffüllen.
 */
export function reputationRatings(state, rules = RULES) {
  const r = state.ratings || [];
  const tage = state.ratingDays || [];
  const { days = 0, minCount = r.length } = rules.reputation || {};
  if (!days) return r.slice(-minCount);
  const versatz = r.length - tage.length;
  const ab = (state.day ?? 1) - days + 1;
  let von = r.length;
  while (von > 0) {
    const tag = von - 1 >= versatz ? tage[von - 1 - versatz] : null;
    if (r.length - von >= minCount && !(tag != null && tag >= ab)) break;
    von--;
  }
  return r.slice(von);
}

/** Ruf als Zahl von 1 bis 5 (Schnitt der Bewertungen aus reputationRatings). */
export function reputation(state, rules = RULES) {
  const r = reputationRatings(state, rules);
  return r.length ? r.reduce((a, b) => a + b, 0) / r.length : 3;
}

function pushRating(state, ctx, value) {
  const { window, min, max } = ctx.rules.reputation;
  // Tage von hinten ausrichten: ältere Bewertungen ohne Tag behalten keinen
  const tage = (state.ratingDays ||= []);
  if (tage.length > state.ratings.length) tage.splice(0, tage.length - state.ratings.length);
  state.ratings.push(Math.min(max, Math.max(min, value)));
  tage.push(state.day);
  while (state.ratings.length > window) state.ratings.shift();
  while (tage.length > state.ratings.length) tage.shift();
}

/**
 * Auszeichnung des Hafens (P19 C5): { level, name, up, down, best, next } mit level 0 = keine.
 * up/down zählen die Abende in Folge über der nächsten bzw. unter der gehaltenen Stufe.
 */
export function award(state, rules = RULES) {
  const a = rules.award;
  const z = state.award || {};
  const level = a ? Math.min(z.level || 0, a.levels.length) : 0;
  return {
    level,
    name: level ? a.levels[level - 1].name : null,
    up: z.up || 0,
    down: z.down || 0,
    best: Math.max(z.best || 0, level),
    next: a && level < a.levels.length ? { level: level + 1, ...a.levels[level] } : null,
    days: a?.days ?? 0,
    hold: level ? a.levels[level - 1].from - (a.hold || 0) : null,
  };
}

/** Abends: Auszeichnung nach dem Ruf fortschreiben (nur in der Saison). */
export function updateAward(state, ctx, events) {
  const a = ctx.rules.award;
  if (!a || season(state, ctx).winter) return;
  const z = (state.award ||= { level: 0, up: 0, down: 0, best: 0 });
  const rep = Math.round(reputation(state, ctx.rules) * 100) / 100;
  const next = a.levels[z.level];
  const cur = z.level ? a.levels[z.level - 1] : null;
  z.up = next && rep >= next.from ? (z.up || 0) + 1 : 0;
  z.down = cur && rep < cur.from - (a.hold || 0) ? (z.down || 0) + 1 : 0;
  if (next && z.up >= a.days) {
    z.level++;
    z.up = 0;
    z.down = 0;
    const neu = z.level > (z.best || 0);
    z.best = Math.max(z.best || 0, z.level);
    events.push({ type: 'awardUp', level: z.level, name: next.name, first: neu, reputation: rep });
  } else if (cur && z.down >= a.days) {
    z.level--;
    z.down = 0;
    z.up = 0;
    events.push({ type: 'awardDown', level: z.level, name: z.level ? a.levels[z.level - 1].name : null, lost: cur.name, reputation: rep });
  }
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

/**
 * Die 3D-Ansicht meldet: das abreisende Boot liegt noch sichtbar in seiner Box (wartet auf den
 * Ablegetakt, auf seine Leute oder auf ein Nachbarboot). Die Rückfallzeit beginnt dann von vorn,
 * die Box bleibt belegt, bis 'boot:aus-box' kommt. Ohne Ansicht (Tests, Balancing) meldet niemand.
 */
export function holdLeaving(state, boatId) {
  let ok = false;
  for (const l of Object.values(state.leaving || {})) {
    // hoechstens 5 Minuten Spielzeit: haengt die Ansicht, wird die Box trotzdem frei
    if (String(l.boatId) === String(boatId) && l.off && (l.total ?? 0) < 300) { l.elapsed = 0; ok = true; }
  }
  return ok;
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
  // Für ein angemeldetes Boot frei gehalten (Anmeldung per Funk, P28): nur dieses Boot passt
  const r = reservedFor(state, berth.id);
  if (r && r.id !== boat.id) return 'funk';
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
  // Wünsche der Stufe, die diese Bootsart haben kann (type.wishes aus data/boats, Roadmap P19 B7)
  const eigene = Array.isArray(type.wishes) ? type.wishes : null;
  const pool = (rules.wishes[state.stage] || []).filter(
    (w) => (type.motor || !rules.motorOnlyWishes.includes(w)) && (!rules.wishSizes?.[w] || rules.wishSizes[w].includes(type.size))
      && (!eigene || eigene.includes(w)),
  );
  const [lo, hi] = rules.wishCountBySize?.[type.size] || rules.wishCount[state.stage] || [0, 0];
  const n = Math.min(pool.length, randomInt(state, lo, hi));
  const left = [...pool];
  const out = [];
  for (let i = 0; i < n; i++) out.push(left.splice(Math.floor(random(state) * left.length), 1)[0]);
  // Dazu manchmal ein Wunsch an ein Angebot an Land (rules.offerWishes, P19 C3)
  const angebote = offerWishPool(state, ctx, type);
  if (angebote.length && random(state) < (rules.offerWishShare?.[state.stage] ?? 0)) {
    out.push(angebote[Math.floor(random(state) * angebote.length)]);
  }
  return out;
}

/** Wünsche an Angebote, die diese Bootsart in dieser Stufe haben kann. */
export function offerWishPool(state, ctx, type) {
  const o = ctx.rules.offerWishes || {};
  return Object.keys(o).filter((k) => o[k].minStage <= state.stage && (!o[k].sizes || o[k].sizes.includes(type.size))
    && (!o[k].sailOnly || type.sail));
}

/** Ist ein Wunsch an ein Angebot erfüllt? Der Service muss gebaut sein (mods.offers aus den Services). */
export function offerWishMet(ctx, wish, mods) {
  const o = ctx.rules.offerWishes?.[wish];
  return !!o && !!mods?.offers?.[o.service];
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
  // Guter Ruf lockt große Boote und seltene Modelle (rules.reputationDraw, P19 C6)
  const draw = ctx.rules.reputationDraw;
  const rep = draw ? reputation(state, ctx.rules) : 0;
  const gross = draw && rep >= draw.bigFrom ? draw.big : {};
  const selten = draw ? new Set(draw.rare) : new Set();
  const seltenErlaubt = draw && rep >= draw.rareFrom;
  const sizeWeights = {};
  for (const [size, w] of Object.entries(mix)) {
    if (types.some((t) => t.size === size)) sizeWeights[size] = w * (mods.sizeFactor[size] ?? 1) * (gross[size] ?? 1);
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
    const models = type.models.filter((m) => (m.minStage ?? type.minStage) <= state.stage && (seltenErlaubt || !selten.has(m.id)));
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
  // Ankünfte über den ganzen Tag: zwischen arrivalFrom und arrivalWindow (Anteile des Tages).
  const from = ctx.rules.dayLength * (ctx.rules.arrivalFrom ?? 0);
  const window = ctx.rules.dayLength * ctx.rules.arrivalWindow - from;
  // Nie mehr Boote, als mit dem dichtesten mittleren Abstand in das Fenster passen (auch an Regatta- und
  // Festtagen): keine Wellen und kein Fließband, wer nicht mehr passt, kommt an diesem Tag nicht.
  const dense = ctx.rules.arrivalDenseGap || ctx.rules.arrivalMinGap || 0;
  const maxN = dense > 0 ? Math.max(1, Math.floor(window / dense)) : Infinity;
  const n = Math.min(maxN, Math.floor(rate) + (random(state) < rate - Math.floor(rate) ? 1 : 0));
  const list = [];
  for (let i = 0; i < n; i++) {
    const boat = rollBoat(state, ctx, mods);
    if (!boat) break;
    boat.id = state.nextId++;
    list.push(boat);
  }
  const end = from + window;
  // Erster Tag eines neuen Spiels: Das erste Boot kommt gleich, damit niemand auf leeres Wasser schaut.
  const first = ctx.rules.firstArrivalAt;
  if (state.day === 1 && first != null) {
    if (!list.length && !sea.winter) {
      const boat = rollBoat(state, ctx, mods);
      if (boat) { boat.id = state.nextId++; list.push(boat); }
    }
    if (list.length) list[0].arriveAt = first;
    // Ruhiger Start: Die übrigen Boote des ersten Tags kommen frühestens fünf Mindestabstände nach dem
    // ersten, damit man das erste in Ruhe zuweisen kann.
    const calm = first + 5 * (ctx.rules.arrivalMinGap || 0);
    placeArrivals(list.slice(1), Math.min(calm, end), end, ctx.rules, () => random(state));
  } else {
    placeArrivals(list, from, end, ctx.rules, () => random(state));
  }
  // Herkunft in der Reihenfolge der Ankunft, damit zwei Boote hintereinander nie aus derselben Ecke kommen
  list.forEach((boat, i) => { boat.origin = boatOrigin(state, state.day * 7 + i); });
  state.upcoming = list;
  state.scheduledDay = state.day;
  events.push({ type: 'dayStart', day: state.day, stage: state.stage, expected: list.length, winter: sea.winter, year: sea.year });
  if (!sea.winter) announce(state, ctx, events);
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
 * Verteilt Ankünfte unregelmäßig über das ganze Fenster [from, to]: kein Pulk, kein Fließband, kein
 * langes Loch am Anfang. Jeder Abstand wird zwischen arrivalMinGap und arrivalMaxGap gewürfelt, dazu
 * ein Vorlauf vor dem ersten und ein Rest nach dem letzten Boot. Ist die Summe länger als das Fenster,
 * schrumpft nur der Teil über dem Mindestabstand; ist sie kürzer (wenige Boote), wird alles gestreckt,
 * damit die Boote über den ganzen Tag kommen. Passen nicht alle mit dem Mindestabstand hinein, kommen
 * sie gleichmäßig mit kleinerem Abstand. rnd liefert Zahlen von 0 bis unter 1 (Spielzufall).
 */
export function placeArrivals(list, from, to, rules, rnd) {
  const n = list.length;
  if (!n) return list;
  const span = Math.max(0, to - from);
  const min = rules.arrivalMinGap || 0;
  const max = Math.max(min, rules.arrivalMaxGap ?? min);
  const zug = () => { const u = rnd(); return u * u; };
  // Teile: Vorlauf, n - 1 Abstände, Rest. Vorlauf und Rest haben keinen Mindestabstand.
  const slack = [zug() * max];
  for (let i = 1; i < n; i++) slack.push(zug() * (max - min));
  slack.push(zug() * max);
  const fest = (n - 1) * min;
  const summe = fest + slack.reduce((a, b) => a + b, 0);
  let gaps;
  if (fest > span) {
    const g = span / n;
    gaps = [g / 2, ...Array(n - 1).fill(g)];
  } else if (summe > span) {
    const k = (span - fest) / (summe - fest || 1);
    gaps = slack.slice(0, n).map((x, i) => (i ? min : 0) + x * k);
  } else {
    const k = span / (summe || 1);
    gaps = slack.slice(0, n).map((x, i) => ((i ? min : 0) + x) * k);
  }
  let t = from;
  for (let i = 0; i < n; i++) {
    t += gaps[i];
    list[i].arriveAt = Math.round(Math.min(t, to) * 10) / 10;
  }
  return list;
}

/** Die nächsten Boote, die heute noch kommen (für die Vorschau). */
export function preview(state, ctx) {
  return state.upcoming.slice(0, ctx.rules.previewCount);
}

// ---------------------------------------------------------------------------
// Anmeldung per Funk (P28, docs/funk-anmeldung.md)
//
// Ab der Bürostufe mit 'anmeldung' melden sich morgens ein bis zwei der heute erwarteten Boote
// per Funk an (boat.funk = { platz: null }). Der Spieler kann ihnen eine passende Box frei halten
// (reserveBerth): Bis das Boot da ist, passt kein anderes Boot hinein (hookWhyNotFit, Grund 'funk'),
// das Schild am Platz steht auf rot. Kommt das Boot, fährt es ohne Halt an der Boje direkt hinein
// und zahlt einen Bonus (rules.funk.bonusShare des Liegegelds einer Nacht ohne Wünsche) und gibt
// rules.funk.rating Anker mehr. Legt der Spieler es woanders hin, verfällt die Reservierung ohne Bonus.
// Die Auswahl verbraucht keinen Spielzufall (Hash aus Seed und Tag), damit Spielstände und das
// Balancing gleich bleiben.

/** Feste Zahl von 0 bis unter 1 aus Seed, Tag und Salz (verbraucht keinen Zufall). */
function hash01(state, salt) {
  let h = (state.seed >>> 0) ^ Math.imul(state.day + 1, 0x9e3779b1) ^ Math.imul(salt + 7, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Ist die Anmeldung per Funk freigeschaltet (Bürostufe) und gibt es die Regel? */
export function announcementsOpen(state, ctx) {
  return !!ctx.rules.funk && state.office >= (ctx.rules.office?.announce ?? Infinity);
}

/** Morgens: ein bis zwei der heute erwarteten Boote melden sich an (nur Gäste, die nicht zu früh kommen). */
function announce(state, ctx, events) {
  if (!announcementsOpen(state, ctx)) return;
  const f = ctx.rules.funk;
  const ab = (f.leadShare ?? 0) * ctx.rules.dayLength;
  const pool = state.upcoming.filter((b) => !b.stationed && b.arriveAt >= ab);
  if (!pool.length) return;
  const n = Math.min(pool.length, hash01(state, 1) < (f.twoShare ?? 0) ? 2 : 1);
  const ids = [];
  for (let i = 0; i < n; i++) {
    const rest = pool.filter((b) => !b.funk);
    const b = rest[Math.floor(hash01(state, 2 + i) * rest.length)];
    b.funk = { platz: null };
    ids.push(b.id);
  }
  events.push({ type: 'announced', boatIds: ids });
}

/** Angemeldete Boote des Tages, die noch nicht liegen (erwartet oder an der Boje), nach Ankunft sortiert. */
export function announcedBoats(state) {
  const out = state.upcoming.filter((b) => b.funk);
  for (const id of state.queue) if (state.boats[id]?.funk) out.push(state.boats[id]);
  return out.sort((a, b) => a.arriveAt - b.arriveAt);
}

/** Welches angemeldete Boot hat diese Box frei gehalten bekommen? (oder null) */
export function reservedFor(state, berthId) {
  for (const b of state.upcoming || []) if (b.funk?.platz === berthId) return b;
  for (const id of state.queue || []) {
    const b = state.boats[id];
    if (b?.status === 'waiting' && b.funk?.platz === berthId) return b;
  }
  return null;
}

function announcedBoat(state, boatId) {
  const id = Number(boatId);
  const b = state.upcoming.find((x) => x.id === id) ?? state.boats[id];
  if (!b || !b.funk || (b.status !== 'expected' && b.status !== 'waiting')) return null;
  return b;
}

/**
 * Boxen, die man einem angemeldeten Boot frei halten kann, die beste zuerst (Wünsche, Komfort, knapp):
 * frei oder gerade beim Ablegen (der Gast reist heute ab), das Boot passt, kein anderes Boot hat sie.
 */
export function reservableBerths(state, ctx, boatId) {
  const boat = announcedBoat(state, boatId);
  if (!boat) return [];
  return availableBerths(state, ctx)
    .filter((b) => !state.berths[b.id] && fits(boat, b, ctx.rules, state.stage) && !hookWhyNotFit(state, ctx, boat, b))
    .sort((a, b) => berthScore(state, ctx, boat, b) - berthScore(state, ctx, boat, a))
    .map((b) => b.id);
}

/** Box für ein angemeldetes Boot frei halten. Ohne berthId die beste. */
export function reserveBerth(state, ctx, boatId, berthId = null) {
  const events = [];
  const boat = announcedBoat(state, boatId);
  if (!boat) return { ok: false, reason: 'notAnnounced', events };
  if (boat.funk.platz && boat.funk.platz === berthId) return { ok: true, berthId, events };
  const alt = boat.funk.platz;
  boat.funk.platz = null;                       // die eigene alte Box zählt beim Suchen nicht
  const frei = reservableBerths(state, ctx, boat.id);
  const ziel = berthId ?? frei[0];
  if (!ziel || !frei.includes(ziel)) {
    boat.funk.platz = alt;
    return { ok: false, reason: berthId ? 'notReservable' : 'noFreeBerth', events };
  }
  boat.funk.platz = ziel;
  if (alt) events.push({ type: 'reservationReleased', boatId: boat.id, berthId: alt, reason: 'moved' });
  events.push({ type: 'reserved', boatId: boat.id, berthId: ziel });
  return { ok: true, berthId: ziel, events };
}

/** Frei gehaltene Box wieder freigeben (der Spieler braucht sie doch). Ohne Folgen für die Bewertung. */
export function releaseBerth(state, ctx, boatId) {
  const events = [];
  const boat = announcedBoat(state, boatId);
  if (!boat?.funk?.platz) return { ok: false, events };
  dropReservation(boat, events, 'released');
  return { ok: true, events };
}

function dropReservation(boat, events, reason) {
  if (!boat?.funk?.platz) return;
  events.push({ type: 'reservationReleased', boatId: boat.id, berthId: boat.funk.platz, reason });
  boat.funk.platz = null;
}

/** Nach einem Stufenausbau: Reservierungen auf Plätzen, die es nicht mehr gibt, fallen weg. */
function dropVanishedReservations(state, ctx, events) {
  for (const b of announcedBoats(state)) {
    const berth = ctx.berthById[b.funk.platz];
    if (b.funk.platz && (!berth || !berthAvailable(state, berth) || !fits(b, berth, ctx.rules, state.stage))) dropReservation(b, events, 'rebuild');
  }
}

/** Frei gehaltene Box des Boots, wenn sie jetzt frei ist und es hineinpasst, sonst null. */
function reservedBerthReady(state, ctx, boat) {
  const id = boat?.funk?.platz;
  if (!id) return null;
  const berth = ctx.berthById[id];
  if (!berth || !berthAvailable(state, berth) || !isFree(state, id)) return null;
  if (whyNotFit(boat, berth, ctx.rules, state.stage) || hookWhyNotFit(state, ctx, boat, berth)) return null;
  return id;
}

/** Wartet das Boot an der Boje auf seine frei gehaltene Box (die gerade noch abgelegt wird)? */
function waitsForReservation(state, ctx, boat) {
  const id = boat?.funk?.platz;
  if (!id) return false;
  const berth = ctx.berthById[id];
  return !!berth && berthAvailable(state, berth);
}

/** Bonus, wenn das Boot in seine frei gehaltene Box einläuft (Anteil des Liegegelds einer Nacht ohne Wünsche). */
export function reservationBonus(state, ctx, boat) {
  return boat ? Math.round(nightlyFee(state, ctx, boat, 0) * (ctx.rules.funk?.bonusShare ?? 0)) : 0;
}

/** Beim Anlegen: eigene Box -> Bonus, andere Box -> Reservierung verfällt. Gibt das Bonus-Ereignis zurück. */
function keepReservation(state, ctx, boat, berthId, events) {
  if (!boat.funk) return null;
  if (!boat.funk.platz) return null;
  if (boat.funk.platz !== berthId) { dropReservation(boat, events, 'elsewhere'); return null; }
  boat.funk.kept = true;
  const amount = reservationBonus(state, ctx, boat);
  addIncome(state, amount, 'liegegeld', 'funk');
  boat.funk.bonus = amount;
  return { type: 'reservationKept', boatId: boat.id, berthId, amount };
}

// ---------------------------------------------------------------------------
// Zuweisen

// hand: Der Spieler hat die Box selbst gewählt (Ziehen, Antippen). Tagesziele zählen nur solche Boote.
function moor(state, ctx, boat, berthId, events, hand = false) {
  state.queue = state.queue.filter((id) => id !== boat.id);
  const kept = keepReservation(state, ctx, boat, berthId, events);
  boat.status = 'moored';
  boat.berthId = berthId;
  boat.waitingSince = null;
  boat.waitSpot = null;
  boat.snug = !boat.stationed && isSnug(state, ctx, boat, ctx.berthById[berthId]);
  state.berths[berthId] = boat.id;
  if (!boat.stationed) heute(state).angelegt++;
  const ev = { type: 'moored', boatId: boat.id, berthId };
  if (hand) ev.hand = true;
  if (boat.snug) ev.passgenau = true;
  events.push(ev);
  const seen = (state.logbook[boat.typeId] ||= []);
  const key = boat.modelId ?? boat.typeId;
  if (!seen.includes(key)) {
    seen.push(key);
    events.push({ type: 'logbookNew', typeId: boat.typeId, modelId: boat.modelId, boatId: boat.id });
  }
  // Wie im echten Hafen: Das Liegegeld für die kommende Nacht wird gleich nach dem Anlegen fällig.
  if (!boat.stationed) chargeFee(state, ctx, boat, modifiers(state, ctx), events);
  if (kept) events.push(kept);
}

/**
 * Weist einem wartenden Boot einen Platz zu. Ohne Angabe gilt das als Handlung des Spielers
 * ('moored' mit hand: true); "Einfahren lassen" übergibt { hand: false }.
 * @returns {{ ok: boolean, reason?: string, events: object[] }}
 */
export function assign(state, ctx, boatId, berthId, { hand = true } = {}) {
  const events = [];
  const boat = state.boats[boatId];
  const berth = ctx.berthById[berthId];
  if (!boat || boat.status !== 'waiting') return { ok: false, reason: 'notWaiting', events };
  if (!berth || !berthAvailable(state, berth)) return { ok: false, reason: 'noBerth', events };
  if (!isFree(state, berthId)) return { ok: false, reason: 'occupied', events };
  const why = whyNotFit(boat, berth, ctx.rules, state.stage) || hookWhyNotFit(state, ctx, boat, berth);
  if (why) return { ok: false, reason: why, events };
  // Vom Spieler eingewiesen, auch über "Einfahren lassen" (Bewertungsbonus rules.handAssignBonus);
  // Tagesziele zählen nur hand (selbst gewählte Box)
  boat.byHand = true;
  moor(state, ctx, boat, berthId, events, hand);
  return { ok: true, events };
}

/**
 * Passgenau (Review A6): Die Box ist höchstens rules.snug.share (ein Fünftel) länger als das
 * Boot selbst, wie beim Tagesziel "passgenau einweisen". Zählt nur, wenn es im Hafen auch
 * passende Boxen gibt, die zu groß wären, sonst gibt es nichts zu entscheiden. So ist nicht jede
 * Box der kleinsten Klasse passgenau: Ein 6,5-m-Boot in der 9-m-Box ist es nicht, ein 8,5-m-Boot schon.
 */
export function isSnug(state, ctx, boat, berth) {
  const snug = ctx.rules.snug;
  if (!snug || !berth || !boat || !(boat.length > 0)) return false;
  const limit = boat.length * (1 + snug.share) + 1e-9;
  if (berth.maxLength > limit) return false;
  return availableBerths(state, ctx).some((b) => !b.reserved && b.maxLength > limit && fits(boat, b, ctx.rules, state.stage));
}

/** Platz-Wünsche (zum Beispiel Strom), die dieser Platz für das Boot erfüllt. */
export function berthWishesMet(state, ctx, boat, berth) {
  const bw = ctx.rules.berthWishes || {};
  return boat.wishes.filter((w) => bw[w] && berthHas(state, ctx, berth, bw[w]));
}

/**
 * Freie passende Plätze, die mindestens einen Platz-Wunsch des Boots erfüllen (leuchten beim
 * Zuweisen gold).
 */
export function wishBerths(state, ctx, boatId) {
  const boat = state.boats[boatId];
  if (!boat) return [];
  return fittingBerths(state, ctx, boatId).filter((id) => berthWishesMet(state, ctx, boat, ctx.berthById[id]).length > 0);
}

/**
 * Was ein Platz für ein Boot bringt (Review A3, Bed P2): Liegegeld der ersten Nacht mit
 * Wunschbonus, die erwartete Bewertung in Ankern, ob er passgenau ist und welche Wünsche er
 * erfüllt. Versorgungswünsche (WC, Dusche, Essen, Diesel) zählen, solange heute noch Kapazität frei ist.
 * Ohne berthId: der Mittelwert über die freien passenden Plätze ist nicht gemeint, sondern der
 * Wert ohne Platz-Wünsche (für die Bootskarte "zahlt etwa").
 */
export function berthValue(state, ctx, boatId, berthId = null) {
  const boat = state.boats[boatId];
  if (!boat) return null;
  const berth = berthId != null ? ctx.berthById[berthId] : null;
  const bw = ctx.rules.berthWishes || {};
  const served = state.served || {};
  const met = [];
  const far = [];
  const full = [];
  let weight = 0;
  const mods = modifiers(state, ctx);
  for (const w of boat.wishes) {
    let ok = false;
    if (bw[w]) ok = !!berth && berthHas(state, ctx, berth, bw[w]);
    else if (ctx.rules.offerWishes?.[w]) ok = offerWishMet(ctx, w, mods);
    else {
      ok = (served[w] || 0) < facilityCapacity(state, ctx, w);
      if (!ok && facilityCapacity(state, ctx, w) > 0) full.push(w); // gebaut, aber heute voll
    }
    if (!ok) continue;
    met.push(w);
    const weg = walkShare(state, ctx, berth, w);
    weight += weg.share;
    if (weg.far) far.push(w);
  }
  const fee = nightlyFee(state, ctx, boat, met.length, mods.priceFactor);
  const snug = !!berth && isSnug(state, ctx, boat, berth);
  const probe = { ...boat, wishesMet: boat.wishesMet + weight, wishesTotal: boat.wishesTotal + boat.wishes.length, berthId: berth?.id ?? null, snug, byHand: true };
  const anchors = rateBoat(ctx, probe, mods.ratingBonus);
  return { fee, wishesMet: met, wishes: [...boat.wishes], anchors, snug, comfort: (berth?.comfort || 0) > 0, far, full };
}

/**
 * "Einfahren lassen": Ohne Hafenbüro nimmt das Boot dieselbe Box, die es sich selbst suchen
 * würde (selfBerth, ohne Wünsche). Ab der Bürostufe mit 'vorschlag' nimmt es den Vorschlag des
 * Büros (beste Box mit den meisten erfüllten Wünschen).
 */
export function autoEnter(state, ctx, boatId) {
  const boat = state.boats[boatId];
  if (!boat || boat.status !== 'waiting') return { ok: false, reason: 'notWaiting', events: [] };
  const best = state.office >= (ctx.rules.office.propose ?? 0)
    ? officeProposal(state, ctx, boatId) ?? fittingBerths(state, ctx, boatId)[0]
    : selfBerth(state, ctx, boatId);
  if (!best) return { ok: false, reason: 'noFreeBerth', events: [] };
  return assign(state, ctx, boatId, best, { hand: false });
}

/**
 * Vorschläge des Hafenbüros für alle Wartenden (ab der Bürostufe mit 'vorschlag'): Wer zuerst
 * kam, bekommt die beste freie Box; jede Box wird nur einmal vorgeschlagen. Für Sonderfälle macht
 * das Büro keinen Vorschlag und hält ihnen auch keine Box frei. Liefert { bootId: platzId }.
 */
export function officeProposals(state, ctx) {
  const out = {};
  if (state.office < (ctx.rules.office.propose ?? Infinity)) return out;
  const vergeben = new Set();
  for (const id of state.queue) {
    const boat = state.boats[id];
    if (!boat || boat.status !== 'waiting' || waitsForReservation(state, ctx, boat)) continue;
    const fitting = fittingBerths(state, ctx, id);
    if (!fitting.length || officeSpecialCase(state, ctx, id, fitting)) continue;
    const frei = fitting.find((p) => !vergeben.has(p));
    if (!frei) continue;
    out[id] = frei;
    vergeben.add(frei);
  }
  return out;
}

/** Vorschlag des Hafenbüros für ein wartendes Boot (officeProposals) oder null. */
export function officeProposal(state, ctx, boatId) {
  return officeProposals(state, ctx)[boatId] ?? null;
}

/** Automatik des Hafenbüros für eine Größenklasse an oder aus (state.officeAuto, Standard an). */
export function setOfficeAuto(state, size, on) {
  state.officeAuto = { ...(state.officeAuto || {}), [size]: !!on };
  return { ok: true, events: [{ type: 'officeAuto', size, on: !!on }] };
}

/**
 * Muss der Spieler Boote dieser Klasse selbst zuweisen (sonst fahren sie selbst ein)? Sonderfälle
 * (officeSpecialCase) bleiben immer beim Spieler. Für Tagesziele und Hinweise.
 */
export function handAssignFor(state, ctx, size) {
  return !officeAutoFor(state, ctx, size);
}

/** Muss der Spieler das Liegegeld von Booten dieser Klasse selbst einstreichen? */
export function handCollectFor(state, ctx, size) {
  const o = ctx.rules.office;
  return !(state.office >= o.autoCollect && (!o.autoCollectSizes || o.autoCollectSizes.includes(size)));
}

/** Weist das Büro Boote dieser Größenklasse selbst zu? */
export function officeAutoFor(state, ctx, size) {
  return officeAutomatic(state, ctx) && state.officeAuto?.[size] !== false;
}

/**
 * Sonderfall fürs Hafenbüro (plan.md Abschnitt 3): Die Automatik lässt diese Boote dem Spieler.
 * Liefert den Grund oder null: 'mehrrumpf' | 'gross' | 'sondergast' | 'einzigerPlatz'.
 * Welche Fälle zählen, steht in ECONOMY.hafenbuero.sonderfaelle (rules.office.special).
 */
export function officeSpecialCase(state, ctx, boatId, fitting = null) {
  const sp = ctx.rules.office?.special;
  const boat = state.boats[boatId];
  if (!sp || !boat || boat.stationed) return null;
  if (sp.kinds?.includes(boat.kind)) return 'mehrrumpf';
  if (sp.sizes?.includes(boat.size)) return 'gross';
  if (sp.specialGuests && boat.special) return 'sondergast';
  // Nur noch eine passende Box: jedes Mal neu bewertet. Ist sie belegt, gibt es nichts zu
  // entscheiden; werden mehr frei, ist das Boot wieder ein Standardfall für die Leitstelle.
  // Warten mehrere Boote auf dieselbe Box, gibt die Leitstelle sie dem, der am längsten wartet
  // (Entscheidung 13.11.: keine leere Box, während Boote warten).
  const f = sp.onlyBerth ? (fitting ?? fittingBerths(state, ctx, boatId)) : null;
  if (f?.length === 1 && wartendeAufBox(state, ctx, f[0], boatId) === 0) return 'einzigerPlatz';
  return null;
}

/** Wie viele andere wartende Boote passen in diese Box? */
function wartendeAufBox(state, ctx, berthId, ausser) {
  let n = 0;
  for (const id of state.queue) {
    if (id === ausser || state.boats[id]?.status !== 'waiting') continue;
    if (fittingBerths(state, ctx, id).includes(berthId)) n++;
  }
  return n;
}

/** Hat das Hafenbüro die Automatik (Stufe mit 'automatik')? */
export function officeAutomatic(state, ctx) {
  return state.office >= ctx.rules.office.autoAssign;
}

/**
 * Weist wartenden Booten den besten freien Platz zu. Das Hafenbüro (standardOnly) lässt dabei
 * Sonderfälle aus; ohne Option (Hafen schauen, Tests) bekommt jedes Boot seinen Platz.
 */
export function autoAssign(state, ctx, { standardOnly = false } = {}) {
  const events = [];
  for (const id of [...state.queue]) {
    if (waitsForReservation(state, ctx, state.boats[id])) continue;
    const fitting = fittingBerths(state, ctx, id);
    if (!fitting.length) continue;
    if (standardOnly) {
      const b = state.boats[id];
      if (state.officeAuto?.[b.size] === false) continue;
      const why = officeSpecialCase(state, ctx, id, fitting);
      if (why) continue;
    }
    moor(state, ctx, state.boats[id], fitting[0], events);
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
  const office = officeAutomatic(state, ctx);
  // Wer über Nacht an der Boje lag, wird morgens zuerst bedient
  const order = [...state.queue].sort((a, b) => (state.boats[b]?.overnight || 0) - (state.boats[a]?.overnight || 0));
  for (const id of order) {
    const b = state.boats[id];
    if (!b || b.held || waitsForReservation(state, ctx, b)) continue;
    // Mit Hafenbüro wartet ein Sonderfall länger auf den Spieler (ohne Andrang-Abkürzung)
    if (office && state.officeAuto?.[b.size] !== false && officeSpecialCase(state, ctx, id)) {
      const wait = ctx.rules.office.special?.selfEnterAfter;
      if (wait == null || !b.atBuoy || state.clock - b.atBuoySince < wait) continue;
      const best = selfBerth(state, ctx, id);
      if (best) {
        b.selfEntered = true;
        moor(state, ctx, b, best, events);
        events.push({ type: 'selfEntered', boatId: id, berthId: best });
        if (ctx.rules.queue.selfEnterOneByOne !== false) break;
      }
      continue;
    }
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
  dropReservation(boat, events, why);
  state.queue = state.queue.filter((id) => id !== boat.id);
  delete state.boats[boat.id];
  state.stats.turnedAway++;
  state.stats.turnedAwayToday++;
  const weg = heute(state).weggefahren;
  weg[why] = (weg[why] || 0) + 1;
  const rated = turnAwayRating(state, ctx, boat, why);
  events.push({ type: 'turnedAway', boatId: boat.id, reason: why, rated, ...(rated ? { rating: ctx.rules.turnAway.rating, guest: guestInfo(boat), day: state.day } : {}) });
}

/**
 * Folge für einen Gast, der ohne Platz wieder fährt. Wegfahren aus Ungeduld und Abweisen von Hand
 * haben dieselbe Folge (Review Ü13, A8): mit der Wahrscheinlichkeit rules.turnAway.chance eine
 * schlechte Bewertung. Keine Bewertung gibt es, wenn das Boot gar nicht gewartet hat (alle Bojen
 * belegt) oder wenn es an keinen Platz des Hafens passt (dafür kann der Hafenmeister nichts).
 * @returns {boolean} ob eine Bewertung abgegeben wurde
 */
function turnAwayRating(state, ctx, boat, why) {
  if (why === 'queueFull' || why === 'rebuild' || !couldEverFit(state, ctx, boat)) return false;
  const ta = ctx.rules.turnAway;
  const rated = random(state) < ta.chance;
  if (rated) pushRating(state, ctx, ta.rating);
  return rated;
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
  // Angemeldet und Box frei gehalten (P28): Das Boot fährt ohne Halt an der Boje in seine Box
  const res = reservedBerthReady(state, ctx, boat);
  if (res) {
    boat.status = 'waiting';
    boat.waitSpot = spot ?? state.queue.length % Math.max(1, waitSpotCount(state, ctx));
    boat.waitingSince = state.clock;
    boat.atBuoy = false;
    boat.atBuoySince = null;
    events.push({ type: 'arrived', boatId: boat.id, waitSpot: boat.waitSpot, direct: true, reserved: res });
    moor(state, ctx, boat, res, events);
    return;
  }
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
  if (officeAutoFor(state, ctx, boat.size) && !waitsForReservation(state, ctx, boat)) {
    const fitting = fittingBerths(state, ctx, boat.id);
    const why = fitting.length ? officeSpecialCase(state, ctx, boat.id, fitting) : null;
    if (why) {
      events.push({ type: 'officeSpecial', boatId: boat.id, reason: why });
    }
    // Wartet schon jemand auf die einzige Box, bekommt der sie (autoAssign in Reihenfolge)
    else if (fitting.length > 1 || (fitting.length === 1 && !wartendeAufBox(state, ctx, fitting[0], boat.id))) moor(state, ctx, boat, fitting[0], events);
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

/**
 * Sekunden, die ein wartendes Boot noch an der Boje bleibt (während der Anfahrt die volle Geduld).
 * Abends läuft keine Geduld ab (queueStep): Dann steht der Wert so, wie er bei Tagesende war.
 */
export function patienceLeft(state, ctx, boatId) {
  const b = state.boats[boatId];
  if (!b || b.status !== 'waiting') return 0;
  if (!b.atBuoy) return ctx.rules.queue.patience;
  const clock = state.phase === 'day' ? state.clock : Math.min(state.clock, ctx.rules.dayLength);
  return Math.max(0, Math.min(ctx.rules.queue.patience, ctx.rules.queue.patience - (clock - patienceFrom(state, ctx, b))));
}

/** Läuft die Geduld dieses wartenden Boots gerade? (nicht abends, nicht auf der Anfahrt, nicht vor dem Morgen nach einer Nacht an der Boje) */
export function patienceRunning(state, ctx, boatId) {
  const b = state.boats[boatId];
  if (!b || b.status !== 'waiting' || !b.atBuoy || state.phase !== 'day') return false;
  return state.clock >= patienceFrom(state, ctx, b);
}

/**
 * Ab wann die Geduld eines Boots an der Boje zählt. Wer über Nacht gewartet hat, weiß, dass
 * morgens Gäste abreisen: Seine Geduld beginnt erst, wenn die Abreisezeit vorbei ist und die
 * letzten Boote ihre Box freigegeben haben (departWindow, leaveMax). Bis dahin bekommt es
 * frei werdende Boxen zuerst (selfEnter, autoAssign).
 */
export function patienceFrom(state, ctx, b) {
  const since = b.atBuoySince ?? 0;
  if (!b.overnight) return since;
  const r = ctx.rules;
  const morning = Math.round((r.departWindow?.[1] ?? 0) * r.dayLength + (r.leaveMax ?? 0));
  return Math.max(since, morning);
}

/**
 * Ein wartendes Boot wegschicken (Spieler tippt "Abweisen"). Gleiche Folge wie Wegfahren aus
 * Ungeduld (turnAwayRating), damit Abweisen kein Schlupfloch ist. In stats.turnedAway zählt nur,
 * wer von selbst weiterfährt.
 */
export function dismiss(state, ctx, boatId) {
  const boat = state.boats[boatId];
  if (!boat || boat.status !== 'waiting') return { ok: false, events: [] };
  const pre = [];
  dropReservation(boat, pre, 'dismissed');
  state.queue = state.queue.filter((id) => id !== boatId);
  delete state.boats[boatId];
  const weg = heute(state).weggefahren;
  weg.weggeschickt = (weg.weggeschickt || 0) + 1;
  const rated = turnAwayRating(state, ctx, boat, 'dismissed');
  return { ok: true, events: [...pre, { type: 'dismissed', boatId, rated, ...(rated ? { rating: ctx.rules.turnAway.rating, guest: guestInfo(boat), day: state.day } : {}) }] };
}

// ---------------------------------------------------------------------------
// Hafengeld (fällig beim Anlegen und jeden Morgen) und Abend

/**
 * Grundpreis einer Nacht ohne Wünsche: je angefangenem Meter Bootslänge (B10, ECONOMY.klassen.proMeter),
 * sonst der feste Grundpreis der Klasse, beides mal feeFactor der Bootsart (P19). Bootsarten mit eigenem
 * Preis (fee) zahlen den.
 */
export function baseNightlyFee(ctx, boat) {
  const type = ctx.typeById[boat.typeId];
  if (type?.fee != null) return type.fee;
  // feeFactor der Bootsart (P19, data/boats): Aufschlag oder Nachlass, etwa für Mehrrumpfboote
  const faktor = type?.feeFactor ?? 1;
  const proMeter = ctx.rules.feePerMeter?.[boat.size];
  if (proMeter && boat.length > 0) return proMeter * Math.ceil(boat.length - 1e-9) * faktor;
  return (ctx.rules.baseFee[boat.size] ?? 0) * faktor;
}

/** Hafengeld für eine Nacht bei n erfüllten Wünschen. */
export function nightlyFee(state, ctx, boat, wishesMet, priceFactor = 1) {
  const base = baseNightlyFee(ctx, boat);
  return Math.round(base * (1 + ctx.rules.wishBonus * wishesMet) * priceFactor);
}

/** Wie viele Boote ein Service pro Tag versorgen kann. */
export function facilityCapacity(state, ctx, key) {
  const f = ctx.rules.facilities[key];
  return f ? f.levels[state.facilities[key] || 0] || 0 : 0;
}

/**
 * Auslastung der Versorgung heute: je gebauter Versorgung (Kapazität > 0) wie viele Boote heute schon
 * versorgt wurden und wie viele es höchstens werden können. Zählt neu an jedem Morgen (state.served).
 */
export function facilityLoad(state, ctx) {
  const out = {};
  for (const key of Object.keys(ctx.rules.facilities || {})) {
    const kapazitaet = facilityCapacity(state, ctx, key);
    if (kapazitaet > 0) out[key] = { versorgt: state.served?.[key] || 0, kapazitaet };
  }
  return out;
}

/**
 * Wie weit ein Platz vom nächsten Gebäude für einen Wunsch entfernt ist (Meter, Hook 'walk') und
 * wie viel der erfüllte Wunsch dann für die Note zählt (P19 B9). Ohne Hook oder für Wünsche
 * außerhalb von rules.walk.wishes: { far: false, share: 1 }.
 */
export function walkShare(state, ctx, berth, wish) {
  const w = ctx.rules.walk;
  if (!w || !berth || !w.wishes.includes(wish) || !ctx.hooks.walk?.length) return { far: false, share: 1, meters: null };
  let meters = null;
  for (const fn of ctx.hooks.walk) {
    try {
      const d = fn({ state, ctx, berth, wish });
      if (Number.isFinite(d)) meters = meters == null ? d : Math.min(meters, d);
    } catch (err) { console.error('Fehler im Wege-Hook', err); }
  }
  const far = meters != null && meters > w.far;
  return { far, share: far ? w.share : 1, meters };
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
export const QUELLEN = ['liegegeld', 'pacht', 'gastro', 'services', 'tagesziele', 'saisonziele', 'sonstiges'];
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
  // Geschenke (das erste Bauwerk, ui/bauen.js) stehen unter "Sonstiges", zählen aber nicht als verdient
  const geschenkt = h.details?.sonstiges?.startgeschenk || 0;
  const summe = Object.values(h.einnahmen).reduce((a, b) => a + b, 0) - geschenkt;
  const ausgaben = Object.values(h.ausgaben).reduce((a, b) => a + b, 0);
  const ziele = state.modules?.ziele;
  // Tagesziele (features/tagesziele.js, Version 2): die gewählte Karte des Tages
  const gewaehltesZiel = ziele && ziele.tag === state.day && ziele.gewaehlt != null ? ziele.karten?.[ziele.gewaehlt] : null;
  const zielListe = gewaehltesZiel ? [gewaehltesZiel] : [];
  const b = h.bewertungen;
  const vorher = s.besterTag || (s.bestDayIncome > 0 ? { tag: null, summe: s.bestDayIncome } : null);
  return {
    tag: state.day,
    stufe: state.stage,
    einnahmen: { ...h.einnahmen },
    details: JSON.parse(JSON.stringify(h.details)),
    summe,
    geschenkt,
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
  updateAward(state, ctx, events);
  const boats = mooredBoats(state);
  for (const fn of ctx.hooks.evening) fn({ state, ctx, boats, events, addIncome: (a, quelle, detail) => addIncome(state, a, quelle, detail) });
  events.push({ type: 'evening', day: state.day });
}

/**
 * Wünsche eines liegenden Bootes für heute prüfen (beim Anlegen und an jedem Morgen). Die Versorgung
 * reicht je Tag für eine feste Zahl Boote, state.served zählt mit. Zählt für die Bewertung.
 */
function checkWishes(state, ctx, boat, mods = modifiers(state, ctx)) {
  const berth = ctx.berthById[boat.berthId];
  const served = (state.served ||= {});
  const metList = [];
  let weight = 0;
  for (const w of boat.wishes) {
    const prop = ctx.rules.berthWishes[w];
    let ok;
    if (prop) ok = berthHas(state, ctx, berth, prop);
    else if (ctx.rules.offerWishes?.[w]) ok = offerWishMet(ctx, w, mods);
    else {
      ok = (served[w] || 0) < facilityCapacity(state, ctx, w);
      if (ok) served[w] = (served[w] || 0) + 1;
    }
    if (ok) {
      metList.push(w);
      // Weiter Weg (B9): zählt für die Note nur zum Anteil, das Liegegeld bleibt voll
      const weg = walkShare(state, ctx, berth, w);
      weight += weg.share;
      if (weg.far) (boat.far ||= {})[w] = (boat.far[w] || 0) + 1;
    } else (boat.missed ||= {})[w] = (boat.missed[w] || 0) + 1; // für Gästebuch und Bewertung (ratingParts)
  }
  boat.wishesMet += weight;
  boat.wishesTotal += boat.wishes.length;
  return metList;
}

/**
 * Liegegeld fällig stellen: beim Anlegen und für Bleibende jeden Morgen. Mit rules.prepay (Zahl) zahlt
 * ein Gast beim Anlegen bis zu so viele geplante Nächte auf einmal (boat.paidThrough = letzter bezahlter Tag);
 * an den Morgen danach werden nur noch die Wünsche geprüft. Bleibt er länger (Sturm), wird jede
 * weitere Nacht wieder einzeln fällig. Das Boot gilt als unbezahlt (boat.paid = false), bis
 * kassiert ist. Mit dem Kassenautomaten kassiert das Büro sofort selbst.
 * feeReady trägt amount, base (Grundpreis aller Nächte), bonus (Wunschbonus), nights.
 */
function chargeFee(state, ctx, boat, mods, events) {
  if (boat.feeDay === state.day) return; // heute schon abgerechnet
  const metList = checkWishes(state, ctx, boat, mods);
  boat.feeDay = state.day;
  if (boat.paidThrough != null && state.day <= boat.paidThrough) return; // schon im Voraus bezahlt
  const nights = boat.paidThrough == null ? Math.max(1, Math.min(ctx.rules.prepay || 1, boat.nights || 1)) : 1;
  const perNight = nightlyFee(state, ctx, boat, metList.length, mods.priceFactor);
  const basePerNight = Math.min(perNight, nightlyFee(state, ctx, boat, 0, mods.priceFactor));
  const fee = perNight * nights;
  boat.paidThrough = state.day + nights - 1;
  boat.pendingFee += fee;
  boat.paid = false;
  events.push({ type: 'feeReady', boatId: boat.id, amount: fee, base: basePerNight * nights, bonus: (perNight - basePerNight) * nights, nights, wishesMet: metList });
  const autoSizes = ctx.rules.office.autoCollectSizes;
  if (state.office >= ctx.rules.office.autoCollect && (!autoSizes || autoSizes.includes(boat.size))) events.push(...collect(state, ctx, boat.id).events);
}

/**
 * Münze über einem Boot einstreichen. Mit { hand: true } holt der Spieler sie selbst ab (Tippen,
 * Strich): Große Boote (rules.tip.sizes) geben dann Trinkgeld (rules.tip.share des Betrags).
 * Ab der Bürostufe mit 'nebenkosten' (rules.office.extras) rechnet das Büro Strom, Wasser und
 * Duschen ab: rules.officeExtrasShare des Liegegelds kommt dazu (Ereignis collected mit extras).
 */
export function collect(state, ctx, boatId, { hand = false } = {}) {
  const boat = state.boats[boatId];
  if (!boat || boat.pendingFee <= 0) return { ok: false, events: [] };
  const t = ctx.rules.tip;
  const tip = hand && t?.sizes?.includes(boat.size) ? Math.round(boat.pendingFee * t.share) : 0;
  const extras = state.office >= (ctx.rules.office.extras ?? Infinity) ? Math.round(boat.pendingFee * (ctx.rules.officeExtrasShare || 0)) : 0;
  const amount = boat.pendingFee + tip + extras;
  boat.pendingFee = 0;
  boat.paid = true;
  addIncome(state, amount - tip - extras, 'liegegeld', 'kassiert');
  addIncome(state, tip, 'liegegeld', 'trinkgeld');
  addIncome(state, extras, 'liegegeld', 'nebenkosten');
  const ev = { type: 'collected', boatId, amount };
  if (hand) ev.hand = true;
  if (tip) ev.tip = tip;
  if (extras) ev.extras = extras;
  return { ok: true, events: [ev] };
}

/** Anteil, den der Hafenmeister für liegengebliebene Münzen abliefert (Rundgang und Nacht). */
export function roundShare(ctx) {
  return ctx.rules.roundShare ?? ctx.rules.uncollectedShare;
}

/**
 * Hafenmeister-Rundgang am Abend: Wer seine Münze liegen ließ, zahlt dem Hafenmeister. Er ist ein
 * Helfer, kein Ersatz: in die Kasse kommt nur der Anteil rules.roundShare (vier Fünftel).
 * Ohne Rundgang (keine Figuren, oder er kam nicht mehr vorbei) passiert dasselbe in der Nacht.
 * collected trägt full (was die Münze wert war) und round: true.
 */
export function collectOnRound(state, ctx, boatId, { night = false } = {}) {
  const boat = state.boats[boatId];
  if (!boat || boat.pendingFee <= 0) return { ok: false, events: [] };
  const full = boat.pendingFee;
  const amount = Math.round(full * roundShare(ctx));
  boat.pendingFee = 0;
  boat.paid = true;
  addIncome(state, amount, 'liegegeld', night ? 'nacht' : 'rundgang');
  const ev = { type: 'collected', boatId, amount, full, round: true };
  if (night) ev.night = true;
  return { ok: true, events: [ev] };
}

/**
 * Trinkgeld für einen langen Kassierstrich: ab rules.strokeTip.from Münzen in einem Zug gibt es
 * je weitere Münze den Anteil perCoin auf die eingestrichene Summe, höchstens max.
 * coins: Zahl der Münzen, sum: ihr Wert zusammen.
 */
export function strokeTip(state, ctx, coins, sum) {
  const t = ctx.rules.strokeTip;
  if (!t || coins < t.from || !(sum > 0)) return { ok: false, amount: 0, events: [] };
  const share = Math.min(t.max, t.perCoin * (coins - t.from + 1));
  const amount = Math.max(1, Math.round(sum * share));
  addIncome(state, amount, 'liegegeld', 'strichtrinkgeld');
  return { ok: true, amount, events: [{ type: 'strokeTip', amount, coins, share }] };
}

/** Alles kassieren. Ohne Hafenbüro nur mit force (Automatik, Tests). */
export function collectAll(state, ctx, force = false) {
  if (!force && state.office < ctx.rules.office.collectAllButton) return [];
  const events = [];
  for (const boat of mooredBoats(state)) events.push(...collect(state, ctx, boat.id).events);
  return events;
}

/**
 * Bestandteile einer Bewertung, damit Gästebuch und Oberfläche sie erklären können:
 * base (aus den Wünschen), comfort (Platzart), special (Sondergast), bonus (Services, Ereignisse),
 * penalty (Abzug, zum Beispiel ungeschützter Platz bei Sturm), missed ({ wunsch: Nächte ohne }),
 * value (Ergebnis wie rateBoat).
 */
export function ratingParts(ctx, boat, ratingBonus = 0) {
  const r = ctx.rules;
  const lo = r.rating.noneMet ?? r.rating.min;
  const hi = r.rating.allMet ?? r.rating.max;
  const base = !boat.wishesTotal ? r.rating.noWishes : lo + ((hi - lo) * boat.wishesMet) / boat.wishesTotal;
  const berth = ctx.berthById[boat.berthId];
  let pflege = 0;
  for (const fn of ctx.hooks?.rating || []) {
    try { pflege += Number(fn({ ctx, boat })) || 0; } catch (err) { console.error('Fehler in Bewertungs-Hook', err); }
  }
  const comfort = (berth?.comfort || 0) * r.comfortBonus + pflege;
  const special = boat.special ? r.specialGuestRatingBonus : 0;
  const snug = boat.snug && r.snug ? r.snug.rating : 0;     // Päckchen/eng liegen
  const byHand = boat.byHand ? r.handAssignBonus ?? 0 : 0;  // von Hand zugewiesen (P10)
  const funk = boat.funk?.kept ? r.funk?.rating ?? 0 : 0;   // angemeldet, Box frei gehalten (P28)
  const penalty = boat.penalty || 0;
  const raw = base + comfort + special + snug + byHand + funk + ratingBonus - penalty;
  const value = Math.round(Math.min(r.rating.max, Math.max(r.rating.min, raw)) * 10) / 10;
  return {
    value, base, comfort, special, snug, byHand, funk, bonus: ratingBonus, penalty,
    wishes: [...(boat.wishes || [])], wishesMet: boat.wishesMet || 0, wishesTotal: boat.wishesTotal || 0, missed: { ...(boat.missed || {}) },
    far: { ...(boat.far || {}) },
  };
}

/** Bewertung eines abreisenden Gastes (1 bis 5). */
export function rateBoat(ctx, boat, ratingBonus = 0) {
  return ratingParts(ctx, boat, ratingBonus).value;
}

/** Kurzbeschreibung eines Gastes für Bewertungsereignisse (Gästebuch). */
function guestInfo(boat) {
  const g = { typeId: boat.typeId, modelId: boat.modelId, name: boat.name, size: boat.size, kind: boat.kind };
  for (const k of ['bootsname', 'heimathafen', 'stammId', 'besuche']) if (boat[k] != null) g[k] = boat[k];
  return g;
}

function night(state, ctx, events) {
  const mods = modifiers(state, ctx);
  // Liegengebliebene Münzen (der Rundgang kam nicht mehr vorbei): der Hafenmeister holt sie
  // nachts, mit demselben Anteil wie beim Rundgang
  let honesty = 0;
  for (const boat of mooredBoats(state)) {
    if (boat.pendingFee > 0) {
      const r = collectOnRound(state, ctx, boat.id, { night: true });
      honesty += r.events[0]?.amount || 0;
      events.push(...r.events);
    }
  }
  if (honesty > 0) events.push({ type: 'honestyBox', amount: honesty });
  // Bojengeld (Review A9): Wer über Nacht an der Warteboje bleibt, zahlt einen kleinen Betrag
  const buoyShare = ctx.rules.queue.buoyFee ?? 0;
  if (buoyShare > 0 && state.queue.length) {
    let buoy = 0;
    const perBoat = {};
    for (const id of state.queue) {
      const b = state.boats[id];
      if (!b) continue;
      perBoat[id] = Math.round(nightlyFee(state, ctx, b, 0) * buoyShare);
      buoy += perBoat[id];
    }
    if (buoy > 0) {
      addIncome(state, buoy, 'liegegeld', 'boje');
      events.push({ type: 'buoyFee', amount: buoy, boats: state.queue.length, perBoat });
    }
  }
  // Abreise
  for (const boat of mooredBoats(state)) {
    if (boat.stationed) continue;
    boat.nights -= 1;
    if (boat.nights > 0) continue;
    const parts = ratingParts(ctx, boat, mods.ratingBonus);
    const rating = parts.value;
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
    events.push({ type: 'departed', boatId: boat.id, berthId: boat.berthId, typeId: boat.typeId, rating, leaveAt, parts, guest: guestInfo(boat), day: state.day });
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
  state.queue.sort((a, b) => (state.boats[b]?.overnight || 0) - (state.boats[a]?.overnight || 0));
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
    // Wer eine frei gehaltene Box hat, wartet auf sie (sie wird gerade noch abgelegt) und fährt nicht weg
    if (countPatience && b.atBuoy && state.clock - patienceFrom(state, ctx, b) > queue.patience && !waitsForReservation(state, ctx, b)) turnAway(state, ctx, b, events, 'patience');
  }
  // Angemeldete Boote an der Boje: in die frei gehaltene Box, sobald sie frei ist (P28)
  for (const id of [...state.queue]) {
    const b = state.boats[id];
    const res = b && !b.held ? reservedBerthReady(state, ctx, b) : null;
    if (res) moor(state, ctx, b, res, events);
  }
  // Hafenbüro mit Automatik: wartende Standardfälle bekommen ihren Platz, sobald einer frei wird.
  // Sonderfälle bleiben beim Spieler und fahren erst nach office.special.selfEnterAfter selbst ein.
  if (state.queue.length && officeAutomatic(state, ctx)) events.push(...autoAssign(state, ctx, { standardOnly: true }));
  // Wie im echten Hafen: Wer kurz an der Boje gewartet hat, sucht sich selbst eine freie Box
  if (state.queue.length) events.push(...selfEnter(state, ctx));
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
      l.total = (l.total ?? 0) + step;
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
        for (const b of state.upcoming) dropReservation(b, events, 'evening');
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
  // Die Ereignisse des Tagesbeginns (fest liegende Boote, Logbuch) gehören dazu
  const start = state.scheduledDay !== state.day ? tick(state, ctx, 0) : [];
  const left = ctx.rules.dayLength + ctx.rules.eveningLength - state.clock;
  return [...start, ...tick(state, ctx, left)];
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
  state.ratings = Array(r.reputation.minCount ?? r.reputation.window).fill(4);
  state.ratingDays = [];
  const next = r.stageGoals[n];
  const facilityCosts = Object.values(r.facilities).flatMap((f) => Object.entries(f.cost || {}).filter(([lvl]) => (f.fromStage?.[lvl] ?? 1) <= n).map(([, c]) => c));
  state.money = Math.max(500, Math.round((next?.cost || 0) * 0.5), Math.max(0, ...facilityCosts));
  return state;
}

export function advanceStage(state, ctx, opts = {}) {
  // prepaid: Ausbau in Bauabschnitten (ui/bauen.js, Roadmap P18) ist schon abschnittsweise bezahlt
  // und begonnen; der letzte Abschnitt schliesst ihn ab, ohne Ziel und Kasse erneut zu pruefen.
  const goal = ctx.rules.stageGoals[state.stage];
  if (opts.prepaid) {
    if (!goal || state.stage >= ctx.rules.maxStage) return { ok: false, missing: ['max'] };
  } else {
    const check = canAdvanceStage(state, ctx);
    if (!check.ok) return { ok: false, missing: check.missing };
    spend(state, goal.cost, 'ausbau');
  }
  if (goal.project) state.buildings[goal.project] = 1;
  const from = state.stage;
  state.stage++;
  state.stageGuests = 0;
  const events = [{ type: 'stageUp', stage: state.stage }];
  clearVanishedBerths(state, ctx, from, events);
  dropVanishedReservations(state, ctx, events);
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
        // umgelegt: passgenau gilt für die neue Box (P10)
        boat.snug = isSnug(state, ctx, boat, ctx.berthById[to]);
        events.push({ type: 'relocated', boatId: boat.id, from: old, to, guest: true });
        continue;
      }
      state.berths[old] = boat.id; // kein Platz frei: reist ab wie bei einem Platz, der wegfällt
    }
    if (!boat.stationed) {
      if (boat.pendingFee > 0) events.push(...collect(state, ctx, boat.id).events);
      endTrip(boat, events);
      const parts = ratingParts(ctx, boat, mods.ratingBonus);
      const rating = parts.value;
      pushRating(state, ctx, rating);
      state.guests++;
      state.stageGuests = (state.stageGuests || 0) + 1;
      delete state.berths[old];
      delete state.boats[boat.id];
      events.push({ type: 'departed', boatId: boat.id, berthId: old, typeId: boat.typeId, rating, leaveAt: 0, reason: 'rebuild', parts, guest: guestInfo(boat), day: state.day });
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
