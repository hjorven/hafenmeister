// Spielregeln ohne Grafik: Ankunft, Passregel, Zuweisung, Kasse, Ruf, Ausbau.
// Kennt weder Three.js noch das DOM. Alle Funktionen ändern den übergebenen Spielstand
// und geben Ereignisse zurück, auf die Grafik, Ton und Oberfläche reagieren.
// Schnittstelle und Datenformate: docs/spielregeln.md

import { RULES, rulesFromEconomy } from './data/rules.js';
import { random, randomInt, randomRange, randomWeighted, randomPick } from './random.js';
import { liegeGeometrie, platzGrenzen, nachbarFrei } from './data/liegelage.js';
import { FLOTTILLEN_ARTEN, FLOTTILLEN_NAMEN } from './data/flottillen.js';

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
    // Für die Liegelage (data/liegelage.js): Boote längsseits, die Platz vom Nachbarn brauchen
    harbor: harbor ?? null,
    types,
    typeById: Object.fromEntries(types.map((t) => [t.id, t])),
    berths: list,
    // Päckchenplätze (P27) stehen nur hier, nicht in berths: Listen, Schilder und Auslastung kennen sie nicht
    berthById: Object.fromEntries([...list, ...raftBerths(list, r)].map((b) => [b.id, b])),
    hooks: { modifiers: [], arrival: [], arrivals: [], evening: [], night: [], fit: [], stageUp: [], tick: [], rating: [], walk: [], score: [], relocate: [], berthHas: [] },
  };
}

/**
 * Erweiterung einhängen. Namen:
 *   modifiers  fn(state, ctx) -> Teil von DEFAULT_MODIFIERS, wird jeden Tag und bei jeder Ankunft gelesen
 *   rating     fn({ ctx, boat }) -> Anker, die zur Platzart (comfort) einer Bewertung dazukommen
 *              (zum Beispiel ein im Winter überholter Steg, features/winter.js)
 *   berthHas   fn({ state, ctx, berth, prop }) -> true, wenn ein Modul dem Platz diese Eigenschaft gibt
 *              (zum Beispiel 'water' an einem Steg mit Wasserhähnen, features/nachruesten.js, P31)
 *   walk       fn({ state, ctx, berth, wish }) -> Meter vom Platz zum nächsten Gebäude, das den
 *              Wunsch erfüllt, oder null (unbekannt). Weiter als rules.walk.far zählt der Wunsch nur
 *              zum Anteil rules.walk.share (P19 B9, features/wege.js kennt die Gebäude im Bild)
 *   arrival    fn({ state, ctx, boat }) darf das neue Boot ändern (zum Beispiel Wünsche)
 *   arrivals   fn({ state, ctx, list }) morgens, nachdem die Ankunftszeiten des Tages verteilt sind
 *              (darf Zeiten zwischen Booten tauschen, zum Beispiel gegen Wiederholung, Bootsgeschichten)
 *   evening    fn({ state, ctx, boats, addIncome, events }) am Abend nach dem Hafengeld
 *   night      fn({ state, ctx, events }) nach der Abreise, vor dem neuen Tag
 *   tick       fn({ state, ctx, events }) jede Spielsekunde tagsüber (zum Beispiel ein Dauerlieger,
 *              der am Nachmittag früher zurückkommt)
 *   score      fn({ state, ctx, boat, berth }) -> Zahl, kommt zur Platzwahl dazu (höher = lieber), zum Beispiel
 *              freigehaltene Regattaplätze für Segler (events/vorbereiten.js)
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
      ...grenzenVon(harbor, p),
      ...kind,
      ...steg,
      ...(requires[p.id] ? { requires: requires[p.id] } : p.requires ? { requires: p.requires } : {}),
      ...(p.ohne ? { ohne: [...p.ohne] } : {}),
      ...(p.doppel ? { doppel: [...p.doppel] } : {}),
    };
  });
}

// Kürzere Höchstlänge je Stufe, wo ein längeres Boot an Steg, Pfahl oder festes Gerät stoßen würde
// (data/liegelage.js platzGrenzen; zum Beispiel die letzte Box vor einem Stegkopf).
function grenzenVon(harbor, p) {
  const out = {};
  for (const s of p.stufen ?? []) {
    let g;
    try { g = platzGrenzen(harbor, s).get(p.id); } catch { g = null; }
    if (g && g.laenge < p.maxLaenge) out[s] = g.laenge;
  }
  return Object.keys(out).length ? { maxLengthAt: out } : {};
}

/** Höchstlänge eines Platzes in einer Stufe (maxLengthAt kürzt, wo ein Steg im Weg ist). */
export function berthMaxLength(berth, stage = 99) {
  const at = berth.maxLengthAt;
  if (!at) return berth.maxLength;
  if (at[stage] != null) return Math.min(berth.maxLength, at[stage]);
  // ohne bekannte Stufe (Tests, Werkzeuge) die strengste Grenze
  if (stage === 99) return Math.min(berth.maxLength, ...Object.values(at));
  return berth.maxLength;
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
  // Jahreszeit (P20, G5) wirkt wie ein Modifikator vor allen anderen
  const jz = seasonEffect(state, ctx);
  for (const fn of [() => jz, ...ctx.hooks.modifiers]) {
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

// boat: wer bewertet; echte Stammgäste (boat.stamm, features/stammgaeste.js) zählen rules.regular.reputationWeight-fach (P25 C8)
function pushRating(state, ctx, value, boat = null) {
  const { window, min, max } = ctx.rules.reputation;
  // Tage von hinten ausrichten: ältere Bewertungen ohne Tag behalten keinen
  const tage = (state.ratingDays ||= []);
  if (tage.length > state.ratings.length) tage.splice(0, tage.length - state.ratings.length);
  const mal = boat?.stamm ? Math.max(1, Math.round(ctx.rules.regular?.reputationWeight ?? 1)) : 1;
  for (let i = 0; i < mal; i++) {
    state.ratings.push(Math.min(max, Math.max(min, value)));
    tage.push(state.day);
  }
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
  // ohne: Platz entfällt, solange einer dieser Umbauten steht (zwei Boxen als Doppelbox, P59)
  return inStage && (!berth.requires || !!state.buildings[berth.requires]) && !berth.ohne?.some((k) => state.buildings[k]);
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
  if (boat.length > berthMaxLength(berth, stage)) return 'length';
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
    if (building && state.facilities[building] > 0) return true;
  }
  for (const fn of ctx.hooks.berthHas || []) if (fn({ state, ctx, berth, prop })) return true;
  return false;
}

/** Zusätzliche Passregeln aus dem Hook 'fit'. Gibt den ersten Grund zurück oder null. */
export function hookWhyNotFit(state, ctx, boat, berth) {
  // Für ein angemeldetes Boot frei gehalten (Anmeldung per Funk, P28): nur dieses Boot passt
  const r = reservedFor(state, berth.id);
  if (r && r.id !== boat.id) return 'funk';
  // Päckchen (P27): Ein Boot außen im Päckchen liegt im Anfahrweg dieses Platzes (die Ansicht weiß es)
  if (!berth.raft && ctx.berthBlocked?.(berth.id, state)) return 'paeckchen';
  if (!boat.probe && !nachbarPasst(state, ctx, boat, berth)) return 'nachbar';
  for (const fn of ctx.hooks.fit || []) {
    const why = fn({ state, ctx, boat, berth });
    if (why) return why;
  }
  return null;
}

// Längsseits am selben Steg (Kai, Yachtsteg): Ein Boot, das länger ist als sein Abschnitt, braucht Platz
// vom Nachbarn. Es passt nur, wenn das Boot dort (oder das, das gerade ablegt) nicht im Weg ist.
function nachbarPasst(state, ctx, boat, berth) {
  if (!ctx.harbor || !(boat.length > 0) || berth.kind === 'box' || berth.kind === 'finger') return true;
  let geo;
  try { geo = liegeGeometrie(ctx.harbor, state.stage); } catch { return true; }
  const g = geo.get(berth.id);
  if (!g?.nachbarn?.length) return true;
  const belegt = new Map();
  for (const nid of g.nachbarn) {
    const id = state.berths[nid] ?? state.leaving?.[nid]?.boatId;
    const o = id != null && id !== boat.id ? state.boats[id] : null;
    if (o && o.length > 0) belegt.set(nid, { length: o.length, beam: o.beam });
  }
  return !belegt.size || nachbarFrei(geo, berth.id, { length: boat.length, beam: boat.beam }, belegt);
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
  return wishHits * 1000 + (berth.comfort || 0) * 100 - slack + hookScore(state, ctx, boat, berth);
}

/** Zusätzliche Vorliebe für einen Platz aus den Hooks 'score' (0 ohne Hooks) */
function hookScore(state, ctx, boat, berth) {
  let n = flotillaScore(state, ctx, boat, berth);
  for (const fn of ctx.hooks.score ?? []) n += fn({ state, ctx, boat, berth }) || 0;
  return n;
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

// rnd: eigene Zahlenfolge (Flottillen, ohne Spielzufall); ohne Angabe der Spielzufall
function rollWishes(state, ctx, type, rnd = null) {
  const zufall = rnd ?? (() => random(state));
  const { rules } = ctx;
  if (type.noWishes) return [];
  // Wünsche der Stufe, die diese Bootsart haben kann (type.wishes aus data/boats, Roadmap P19 B7)
  const eigene = Array.isArray(type.wishes) ? type.wishes : null;
  const pool = (rules.wishes[state.stage] || []).filter(
    (w) => (type.motor || !rules.motorOnlyWishes.includes(w)) && (!rules.wishSizes?.[w] || rules.wishSizes[w].includes(type.size))
      && (!eigene || eigene.includes(w)),
  );
  const [lo, hi] = rules.wishCountBySize?.[type.size] || rules.wishCount[state.stage] || [0, 0];
  const n = Math.min(pool.length, rnd ? lo + Math.floor(zufall() * (hi - lo + 1)) : randomInt(state, lo, hi));
  const left = [...pool];
  const out = [];
  for (let i = 0; i < n; i++) out.push(left.splice(Math.floor(zufall() * left.length), 1)[0]);
  // Dazu manchmal ein Wunsch an ein Angebot an Land (rules.offerWishes, P19 C3)
  const angebote = offerWishPool(state, ctx, type);
  if (angebote.length && zufall() < (rules.offerWishShare?.[state.stage] ?? 0)) {
    out.push(angebote[Math.floor(zufall() * angebote.length)]);
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

/**
 * Größenmischung nach Plätzen (A10, ECONOMY.platzMix): Faktor je Größe, wie gut der Hafen gerade Platz
 * für diese Größe hat. Gezählt werden gebaute Plätze, an die die kleinste Bootsart der Größe passt,
 * verglichen mit dem Bedarf (Ankünfte am Tag × Anteil × mittlere Nächte, mal extra[Größe] für Zuschläge
 * wie Ruf oder Winterarbeiten). Höchstens 1.
 */
export function sizeBerthFactors(state, ctx, types = eligibleTypes(state, ctx), extra = {}) {
  const pm = ctx.rules.sizeByBerths;
  const out = {};
  if (!pm) return out;
  const mix = ctx.rules.sizeMix[state.stage] || {};
  const n = ctx.rules.arrivalsPerDay[state.stage] || 0;
  const plaetze = availableBerths(state, ctx).filter((b) => !b.reserved);
  for (const [size, w] of Object.entries(mix)) {
    const proben = types.filter((t) => t.size === size).map(smallestOf);
    if (!proben.length) continue;
    const probe = proben.reduce((a, b) => (b.length < a.length ? b : a));
    const anzahl = plaetze.filter((b) => fits(probe, b, ctx.rules, state.stage)).length;
    const [nMin, nMax] = range(ctx.rules.nightsBySize?.[size] ?? ctx.rules.nights);
    // Kurzhalter belegen eine Box nur einen Tagesanteil (docs/bootsgeschichten.md 3.2)
    const sh = ctx.rules.shortStay;
    const kurz = sh && (!sh.sizes || sh.sizes.includes(size)) ? sh.share?.[state.stage] ?? 0 : 0;
    const naechte = (1 - kurz) * (nMin + nMax) / 2 + (kurz ? kurz * (sh.stay[0] + sh.stay[1]) / 2 : 0);
    const bedarf = n * w * (extra[size] ?? 1) * naechte;
    out[size] = bedarf > 0 ? Math.max(pm.mindestens, Math.min(1, (anzahl * pm.auslastung) / bedarf)) : 1;
  }
  return out;
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
  // Nur so viele Boote einer Größe, wie der Hafen Plätze für sie hat (A10)
  const platz = sizeBerthFactors(state, ctx, types, Object.fromEntries(Object.keys(mix).map((k) => [k, (mods.sizeFactor[k] ?? 1) * (gross[k] ?? 1)])));
  for (const [size, w] of Object.entries(mix)) {
    if (types.some((t) => t.size === size)) sizeWeights[size] = w * (mods.sizeFactor[size] ?? 1) * (gross[size] ?? 1) * (platz[size] ?? 1);
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
  if (boat) rollShortStay(state, ctx, boat);
  if (boat) dropStayWishes(ctx, boat);
  for (const fn of ctx.hooks.arrival) fn({ state, ctx, boat });
  return boat;
}

/**
 * Wünsche nur für längere Aufenthalte (rules.wishMinNights, P31: Waschmaschine ab 3 Nächten): Wer kürzer
 * bleibt, verliert den Wunsch wieder. Ändert nur boat.wishes, verbraucht keinen Zufall.
 */
export function dropStayWishes(ctx, boat) {
  const min = ctx.rules.wishMinNights;
  if (!min || !boat?.wishes?.length) return;
  boat.wishes = boat.wishes.filter((w) => !(min[w] > 0) || (boat.nights || 0) >= min[w]);
}

/**
 * Kurzhalt (docs/bootsgeschichten.md 3.2): Ein Teil der Boote legt nur kurz an und am selben Tag
 * wieder ab. boat.nights = 0, boat.stay = Liegezeit als Tagesanteil. Module (Bootsgeschichten) können
 * das im Hook 'arrival' überschreiben. Würfelt nur, wenn rules.shortStay gesetzt ist.
 */
function rollShortStay(state, ctx, boat) {
  const sh = ctx.rules.shortStay;
  if (!sh || boat.special || boat.stationed) return;
  if (sh.sizes && !sh.sizes.includes(boat.size)) return;
  const share = sh.share?.[state.stage] ?? 0;
  if (!(share > 0) || random(state) >= share) return;
  boat.nights = 0;
  boat.stay = Math.round((sh.stay[0] + random(state) * (sh.stay[1] - sh.stay[0])) * 1000) / 1000;
}

/** Ab dieser Spielzeit fährt kein Kurzhalter mehr ein (Tagesanteil 'spaetestens'). */
export function shortStayCutoff(ctx) {
  return ctx.rules.dayLength * (ctx.rules.shortStay?.latest ?? 0.97);
}

/**
 * Die Ansicht meldet: Kurzhalter ist sichtbar fest. Erst jetzt läuft seine Liegezeit, mindestens
 * shortStay.minVisible (Tagesanteil), damit man ihn liegen sieht und die Münze einsammeln kann.
 */
export function shortStayDocked(state, ctx, boatId) {
  const boat = state.boats[boatId];
  if (!boat || !boat.wartetFest || boat.status !== 'moored' || !isShortStay(boat)) return false;
  const { dayLength, eveningLength } = ctx.rules;
  const sh = ctx.rules.shortStay || {};
  delete boat.wartetFest;
  const min = (sh.minVisible ?? 0.06) * dayLength;
  const want = state.clock + Math.max(min, (boat.stay ?? 0.2) * dayLength);
  const latest = state.phase === 'day' ? Math.max(shortStayCutoff(ctx), state.clock + min) : dayLength + eveningLength - 2;
  boat.leaveClock = Math.round(Math.max(state.clock + 5, Math.min(want, latest)) * 10) / 10;
  return true;
}

/**
 * Kurzhalter, die erst nach 'spätestens' ankämen, tauschen die Ankunftszeit mit einem früheren
 * Übernachter (die Zeiten selbst bleiben, also keine Wellen). Ohne Tauschpartner kommen sie heute nicht.
 */
function lateShortStays(state, ctx, list) {
  if (!ctx.rules.shortStay) return;
  const cut = shortStayCutoff(ctx) - (ctx.rules.shortStay.stay?.[0] ?? 0.1) * ctx.rules.dayLength;
  const spaet = list.filter((b) => isShortStay(b) && b.arriveAt > cut);
  if (!spaet.length) return;
  // Flottillen (P32) tauschen nicht: ihr Konvoi bleibt zusammen
  const frueh = list.filter((b) => !isShortStay(b) && b.arriveAt <= cut && !b.funk && !b.flotte && !b.stationed).sort((a, b) => b.arriveAt - a.arriveAt);
  for (const b of spaet) {
    const t = frueh.shift();
    if (t) [b.arriveAt, t.arriveAt] = [t.arriveAt, b.arriveAt];
    else list.splice(list.indexOf(b), 1);
  }
  list.sort((a, b) => a.arriveAt - b.arriveAt);
}

/** Ist das Boot ein Kurzhalter (legt am selben Tag wieder ab)? */
export function isShortStay(boat) {
  return !!boat && !boat.stationed && boat.nights === 0;
}

/** Erwartete Ankünfte pro Tag bei aktuellem Ruf und aktuellen Modifikatoren. */
export function arrivalRate(state, ctx, mods = modifiers(state, ctx)) {
  const base = ctx.rules.arrivalsPerDay[state.stage] || 0;
  return base * reputationFactor(reputation(state), ctx.rules) * mods.arrivalFactor;
}

/** Jahreszeit eines Tages: 'fruehling', 'sommer', 'herbst' oder 'winter' (rules.seasonParts, P20 G5). */
export function seasonPart(state, ctx) {
  const s = season(state, ctx);
  if (s.winter) return 'winter';
  return ctx.rules.seasonParts?.find((p) => s.day >= p.from && s.day <= p.to)?.id ?? 'sommer';
}

/** Wirkung der Jahreszeit auf die Ankünfte (rules.seasonEffects), als Modifikator oder null. */
export function seasonEffect(state, ctx) {
  const e = ctx.rules.seasonEffects?.[seasonPart(state, ctx)];
  if (!e) return null;
  const { wind, ...mods } = e;
  return mods;
}

/** Jahreslauf: Jahr (ab 1), Tag in der Saison (ab 1) und ob gerade Winter ist. */
export function season(state, ctx) {
  const { seasonDays, winterDays } = ctx.rules;
  const len = seasonDays + winterDays;
  const i = (state.day - 1) % len;
  return { year: Math.floor((state.day - 1) / len) + 1, day: i + 1, winter: i >= seasonDays };
}

/**
 * Fest vergebene Plätze (Fischer) bekommen ihr Boot, sobald es den Platz gibt. Welcher Kutter: zuerst
 * einer, der noch nicht im Logbuch steht (in der Reihenfolge der Bootsdaten), sonst der erste, der passt.
 * So kommen über die Stufen und Jahre alle Fischkutter einmal in den Hafen.
 */
function fillReservedBerths(state, ctx, events) {
  for (const berth of availableBerths(state, ctx)) {
    if (!berth.reserved || !isFree(state, berth.id)) continue;
    const type = ctx.types.find((t) => t.stationed && t.kind === berth.kind && t.minStage <= state.stage);
    if (!type) continue;
    const seen = state.logbook?.[type.id] || [];
    const models = (type.models || []).filter((m) => (m.fromStage ?? 1) <= state.stage);
    const order = [...models.filter((m) => !seen.includes(m.id)), ...models.filter((m) => seen.includes(m.id))];
    let r = { ok: false, events: [] };
    for (const m of order) { r = stationBoat(state, ctx, type.id, berth.id, m.id); if (r.ok) break; }
    if (!r.ok) r = stationBoat(state, ctx, type.id, berth.id);
    if (r.ok) events.push(...r.events);
  }
}

/** Neue Saison: Die Fischer wechseln (andere Kutter kommen), danach füllt fillReservedBerths die Plätze neu. */
function rotateStationed(state, ctx, events) {
  for (const boat of Object.values(state.boats)) {
    if (!boat?.stationed || !ctx.berthById[boat.berthId]?.reserved) continue;
    const type = ctx.typeById[boat.typeId];
    if (!type || !(type.models || []).some((m) => m.id !== boat.modelId && (m.fromStage ?? 1) <= state.stage)) continue;
    events.push(...unstationBoat(state, ctx, boat.id).events);
  }
}

/**
 * Ein Schiff wurde gesehen, ohne über moor() anzulegen (Besuch eines großen Schiffs an seinem Anleger,
 * vorbeifahrendes Großschiff, Seenotkreuzer an der Station). Trägt es ins Logbuch ein wie beim Anlegen.
 */
export function logbookSighting(state, ctx, typeId, modelId = null) {
  if (!ctx.typeById[typeId]) return [];
  if (modelId && !ctx.typeById[typeId].models?.some((m) => m.id === modelId)) return [];
  const seen = (state.logbook[typeId] ||= []);
  const key = modelId ?? typeId;
  if (seen.includes(key)) return [];
  seen.push(key);
  return [{ type: 'logbookNew', typeId, modelId, gesichtet: true }];
}

function startDay(state, ctx, events) {
  {
    const sea0 = season(state, ctx);
    if (sea0.day === 1 && sea0.year > 1) rotateStationed(state, ctx, events);
  }
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
  // Winter: keine Gäste. Wer über Nacht an einer Boje gewartet hat (rules.queue.overnight), fährt weiter,
  // sonst fährt er mitten im Winter in eine Box (Feature-Test 14.11., Pulk am Kartenrand).
  if (sea.winter) for (const id of [...state.queue]) if (state.boats[id]) turnAway(state, ctx, state.boats[id], events, 'winter');
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
  // Flottille (P32): ersetzt so viele Boote des Tages, wie sie Boote hat (nie mehr als ins Fenster passen)
  const flotte = state.day > 1 ? planFlotilla(state, ctx, mods, sea.winter) : null;
  const normal = flotte ? Math.max(0, Math.min(n, maxN - flotte.length) - flotte.length) : n;
  for (let i = 0; i < normal; i++) {
    const boat = rollBoat(state, ctx, mods);
    if (!boat) break;
    boat.id = state.nextId++;
    list.push(boat);
  }
  if (flotte) {
    for (const b of flotte) b.id = state.nextId++;
    for (const b of flotte) b.flotte.id = flotte[0].id;
    // Module sehen die Boote der Flottille wie jedes neue Boot (Bootsname, Geschichte ...); was die
    // Gruppe ausmacht (Art, Maße, Wünsche, Nächte), bleibt danach gleich
    for (const b of flotte) {
      const fest = { typeId: b.typeId, modelId: b.modelId, name: b.name, size: b.size, kind: b.kind, length: b.length, beam: b.beam, draft: b.draft, motor: b.motor, wishes: [...b.wishes], nights: b.nights, flotte: b.flotte };
      for (const fn of ctx.hooks.arrival) fn({ state, ctx, boat: b });
      Object.assign(b, fest);
      for (const k of ['stay', 'arrivalWish', 'tripPlan', 'stammId', 'story']) delete b[k];
      if (b.besuche > 1) b.besuche = 1;
    }
  }
  // Die Flottille nimmt im Tageslauf einen Platz ein (ihr erstes Boot); die übrigen folgen nach den
  // Modulen im Konvoi, alle Späteren rücken um die Länge des Konvois nach hinten (expandFlotilla)
  const konvoi = flotte ? (flotte.length - 1) * ctx.rules.flotilla.gap : 0;
  const end = from + window - konvoi;
  sortByArrivalWish(state, ctx, list);
  if (flotte) list.splice(Math.min(list.length, Math.round(list.length * (ctx.rules.flotilla.from + hash01(state, 22) * (ctx.rules.flotilla.to - ctx.rules.flotilla.from)))), 0, flotte[0]);
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
    if (flotte) expandFlotilla(state, ctx, list, flotte);
  }
  // Erst späte Kurzhalter tauschen, dann die Module (Geschichten entzerren die Tagesabschnitte auf den
  // endgültigen Zeiten); ein zweiter Durchgang fängt Kurzhalter, die ein Modul spät gelegt hat.
  lateShortStays(state, ctx, list);
  for (const fn of ctx.hooks.arrivals) fn({ state, ctx, list });
  lateShortStays(state, ctx, list);
  // Flottille: alle bleiben gleich lange (die längste Nacht zählt, zum Beispiel wegen eines Dienstes)
  if (flotte) {
    const nights = Math.max(1, ...flotte.map((b) => b.nights || 1));
    for (const b of flotte) { b.nights = nights; delete b.stay; }
  }
  // Herkunft in der Reihenfolge der Ankunft, damit zwei Boote hintereinander nie aus derselben Ecke kommen
  list.forEach((boat, i) => { boat.origin = boatOrigin(state, state.day * 7 + i); });
  // Eine Flottille kommt aus derselben Richtung (Konvoi)
  const spitze = list.find((b) => b.flotte);
  if (spitze) for (const b of list) if (b.flotte) b.origin = spitze.origin;
  state.upcoming = list;
  state.scheduledDay = state.day;
  events.push({ type: 'dayStart', day: state.day, stage: state.stage, expected: list.length, winter: sea.winter, year: sea.year });
  if (!sea.winter) announce(state, ctx, events);
}

/**
 * Tagesrhythmus nach Anlass (docs/bootsgeschichten.md 3.3): Die Zeitpunkte würfelt placeArrivals
 * gleichmäßig unregelmäßig, die Reihenfolge der Boote folgt ihrem Wunschzeitpunkt. Kurzhalter kommen
 * eher vormittags und mittags, Übernachter eher nachmittags. boat.arrivalWish ([von, bis] als
 * Tagesanteil) kann ein Modul im Hook 'arrival' setzen (Bootsgeschichten). Nur mit rules.shortStay.
 */
function sortByArrivalWish(state, ctx, list) {
  const sh = ctx.rules.shortStay;
  if (!sh || list.length < 2) return;
  const key = new Map();
  for (const b of list) {
    const w = b.arrivalWish ?? (isShortStay(b) ? sh.arriveShort ?? [0.05, 0.6] : sh.arriveNight ?? [0.3, 1]);
    key.set(b, w[0] + random(state) * (w[1] - w[0]));
  }
  list.sort((a, b) => key.get(a) - key.get(b));
}

/**
 * Herkunft eines Boots als Zahl von 0 bis unter 1 (Stelle entlang des Revierrands, die Ansicht
 * legt fest, wo das liegt). Aufeinanderfolgende Boote kommen aus deutlich verschiedenen Richtungen
 * (goldener Schnitt), je Spiel anders (Seed). Verbraucht keinen Zufall, damit Spielstände gleich bleiben.
 */
export function boatOrigin(state, n) {
  const x = n * 0.6180339887498949 + ((state.seed >>> 0) % 9973) / 9973;
  return (Math.round((x - Math.floor(x)) * 1000) % 1000) / 1000;
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
  const pool = state.upcoming.filter((b) => !b.stationed && !b.flotte && b.arriveAt >= ab);
  // Eine Flottille (P32) meldet sich immer an, als Gruppe
  announceFlotilla(state, ctx, events);
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
// Flottillen (P32, docs/flottillen.md)
//
// An manchen Tagen (rules.flotilla.share je Stufe) kommen drei bis fünf Boote einer Art zusammen
// (Feld group der Bootsdaten): ein Segelverein, eine Charterflotte, ein Klassikertreffen. Sie fahren im
// Konvoi ein (rules.flotilla.gap Sekunden Abstand, gleiche Herkunft) und wollen am selben Steg liegen.
// Liegen alle an einem Steg, gibt jede Crew rules.flotilla.together Anker mehr; wird die Gruppe aufgeteilt
// oder ein Boot weggeschickt, rules.flotilla.apart weniger. Die Flottille ersetzt Boote des Tages (es kommen
// nicht mehr Gäste), Art, Größe, Modelle und Maße kommen aus Seed und Tag (verbraucht keinen Spielzufall).
// Jedes Boot trägt boat.flotte = { id, name, n, nr, art, palette } (id = Boot-id des ersten Boots), daraus
// ergibt sich alles andere; der Spielstand braucht kein eigenes Feld.

const FLOTTE_SCORE = 5000;   // Vorliebe für den Steg der Gruppe, mehr als jeder Platz-Wunsch (1000 je Wunsch)

/** Steg eines Platzes: Feld jetty, sonst die Buchstaben vor der Nummer ('C12' -> 'C'). */
export function jettyOf(berth) {
  if (!berth) return null;
  return berth.jetty ?? String(berth.raft ?? berth.id).match(/^[A-Za-z]+/)?.[0] ?? String(berth.id);
}

/** Folge fester Zahlen aus Seed, Tag und Salz (wie hash01, verbraucht keinen Spielzufall). */
function hashFolge(state, salt) {
  let i = 0;
  return () => hash01(state, salt + 131 * i++);
}

/** Bootsarten, die heute als Flottille kommen können (group bis mindestens 3, Texte in data/flottillen.js). */
export function flotillaTypes(state, ctx, mods = modifiers(state, ctx)) {
  return eligibleTypes(state, ctx, mods).filter((t) => FLOTTILLEN_ARTEN[t.id] && range(t.group ?? 1)[1] >= 3 && !t.special);
}

/** Wie viele gebaute Plätze je Steg ein Boot dieser Maße nehmen kann (frei oder belegt). */
function jettyCapacity(state, ctx, probe) {
  const out = new Map();
  for (const b of availableBerths(state, ctx)) {
    if (b.reserved || !fits(probe, b, ctx.rules, state.stage)) continue;
    const j = jettyOf(b);
    out.set(j, (out.get(j) || 0) + 1);
  }
  return out;
}

/** Morgens: Flottille des Tages auswürfeln (oder null). Boote ohne id, sortiert nach Platz im Konvoi. */
function planFlotilla(state, ctx, mods, winter) {
  const f = ctx.rules.flotilla;
  if (!f || winter || state.stage < f.fromStage) return null;
  const stufen = Object.keys(f.share).map(Number);
  const share = f.share[state.stage] ?? f.share[Math.max(...stufen)] ?? 0;
  if (!(hash01(state, 21) < share)) return null;
  const rnd = hashFolge(state, 300);
  const mix = ctx.rules.sizeMix[state.stage] || {};
  let types = flotillaTypes(state, ctx, mods).filter((t) => (mix[t.size] ?? 0) > 0);
  const zahl = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
  const masz = (lo, hi) => Math.round((lo + rnd() * (hi - lo)) * 10) / 10;
  while (types.length) {
    const gewicht = types.map((t) => (t.weight || 1) * (mix[t.size] ?? 0));
    let r = rnd() * gewicht.reduce((a, b) => a + b, 0);
    let i = 0;
    while (i < types.length - 1 && (r -= gewicht[i]) >= 0) i++;
    const type = types[i];
    types = types.filter((t) => t !== type);
    const [gMin, gMax] = range(type.group);
    // Mittleres Boot der Art: an so viele Plätze eines Stegs muss die Gruppe passen
    const probe = { size: type.size, length: (type.length[0] + type.length[1]) / 2, beam: (type.beam[0] + type.beam[1]) / 2, draft: (type.draft[0] + type.draft[1]) / 2 };
    const platz = Math.max(0, ...jettyCapacity(state, ctx, probe).values());
    const n = Math.min(zahl(gMin, gMax), platz);
    if (n < Math.max(3, gMin)) continue;
    const art = FLOTTILLEN_ARTEN[type.id];
    const selten = new Set(ctx.rules.reputationDraw?.rare ?? []);
    const models = type.models.filter((m) => (m.minStage ?? type.minStage) <= state.stage && !selten.has(m.id));
    const fest = art.gleichesModell && models.length ? models[Math.floor(rnd() * models.length)] : null;
    const [nMin, nMax] = range(type.nights ?? ctx.rules.nightsBySize?.[type.size] ?? ctx.rules.nights);
    const nights = Math.max(1, zahl(nMin, nMax));
    const wishes = rollWishes(state, ctx, type, rnd);
    const name = FLOTTILLEN_NAMEN[Math.floor(hash01(state, 23) * FLOTTILLEN_NAMEN.length)];
    const palette = Math.floor(hash01(state, 24) * 4);
    const boote = [];
    for (let k = 0; k < n; k++) {
      let boat = null;
      for (let versuch = 0; versuch < 8; versuch++) {
        const model = fest ?? (models.length ? models[Math.floor(rnd() * models.length)] : null);
        const dim = (key) => (model && model[key] != null ? model[key] : masz(...type[key]));
        boat = makeBoat({
          typeId: type.id, modelId: model ? model.id : null, name: model ? model.name : type.name,
          size: type.size, kind: type.kind, length: dim('length'), beam: dim('beam'), draft: dim('draft'),
          motor: type.motor, special: false, dayVisitors: type.dayVisitors, wishes: [...wishes], nights,
          flotte: { id: null, name, n, nr: k, art: type.id, palette },
        });
        if (couldEverFit(state, ctx, boat)) break;
        boat = null;
      }
      if (boat) { dropStayWishes(ctx, boat); boote.push(boat); }
    }
    if (boote.length < 3) continue;
    for (const b of boote) b.flotte.n = boote.length;
    return boote;
  }
  return null;
}

/**
 * Nach dem Verteilen der Ankunftszeiten: Hinter dem ersten Boot der Flottille kommen die übrigen im
 * Konvoi (rules.flotilla.gap), alle Boote danach rücken um die Länge des Konvois nach hinten (so bleibt
 * zu allen anderen der Mindestabstand). Module, die danach Zeiten tauschen, lassen Flottillen aus.
 */
function expandFlotilla(state, ctx, list, flotte) {
  const f = ctx.rules.flotilla;
  const spitze = flotte[0];
  if (!list.includes(spitze)) return;
  const t0 = spitze.arriveAt;
  const konvoi = (flotte.length - 1) * f.gap;
  for (const b of list) if (b !== spitze && b.arriveAt > t0) b.arriveAt = Math.round((b.arriveAt + konvoi) * 10) / 10;
  flotte.forEach((b, i) => {
    b.arriveAt = Math.round((t0 + i * f.gap) * 10) / 10;
    if (i > 0) list.push(b);
  });
  list.sort((a, b) => a.arriveAt - b.arriveAt || (a.flotte?.nr ?? 0) - (b.flotte?.nr ?? 0));
}

/** Alle Boote einer Flottille, die heute erwartet werden oder da sind (wartend oder liegend). */
export function flotillaMembers(state, flotteId) {
  const out = (state.upcoming || []).filter((b) => b?.flotte?.id === flotteId);
  for (const b of Object.values(state.boats || {})) if (b?.flotte?.id === flotteId) out.push(b);
  return out.sort((a, b) => a.flotte.nr - b.flotte.nr);
}

/** Flottillen des Tages (Ids der Gruppen, die erwartet werden oder da sind). */
export function flotillaIds(state) {
  const ids = new Set();
  for (const b of state.upcoming || []) if (b?.flotte) ids.add(b.flotte.id);
  for (const b of Object.values(state.boats || {})) if (b?.flotte) ids.add(b.flotte.id);
  return [...ids];
}

/**
 * Lage einer Flottille: wie viele da sind, liegen, warten, an welchen Stegen.
 * together: true (alle n liegen an einem Steg), false (aufgeteilt oder ein Boot weggeschickt),
 * null (noch offen, nicht alle liegen).
 */
export function flotillaState(state, ctx, flotteId) {
  const alle = flotillaMembers(state, flotteId);
  if (!alle.length) return null;
  const ref = alle[0].flotte;
  const stege = {};
  let liegen = 0, warten = 0, erwartet = 0;
  for (const b of alle) {
    if (b.status === 'moored') {
      liegen++;
      const j = jettyOf(ctx.berthById[b.berthId]);
      stege[j] = (stege[j] || 0) + 1;
    } else if (b.status === 'waiting') warten++;
    else erwartet++;
  }
  const zerrissen = alle.some((b) => b.flotte.zerrissen);
  const namen = Object.keys(stege);
  const together = zerrissen || namen.length > 1 ? false : liegen === ref.n ? true : null;
  return { id: flotteId, name: ref.name, art: ref.art, n: ref.n, da: alle.length, liegen, warten, erwartet, stege, steg: namen.length === 1 ? namen[0] : null, together, zerrissen };
}

/** Ein Boot der Flottille fährt ohne Platz: die Gruppe ist auseinander (die anderen merken es sich). */
function breakFlotilla(state, boat, events) {
  if (!boat?.flotte) return;
  const rest = flotillaMembers(state, boat.flotte.id).filter((b) => b !== boat && b.id !== boat.id);
  for (const b of rest) b.flotte.zerrissen = true;
  if (rest.length && !boat.flotte.gemeldet) {
    for (const b of rest) b.flotte.gemeldet = true;
    events.push({ type: 'flotillaSplit', flotte: boat.flotte.id, name: boat.flotte.name, boatId: boat.id, zerrissen: true, stege: {} });
  }
}

/** Nachts vor der Abreise: jede Crew einer Flottille merkt sich, ob die Gruppe zusammen liegt. */
function rateFlotillas(state, ctx) {
  for (const id of flotillaIds(state)) {
    const st = flotillaState(state, ctx, id);
    if (!st) continue;
    // Noch nicht alle da oder fest: wer jetzt liegt, liegt nicht mit der ganzen Gruppe zusammen.
    // Sind die übrigen schon abgereist (Päckchen: höchstens eine Nacht), bleibt die Wertung von vorher.
    const wert = st.together ?? (st.warten + st.erwartet > 0 ? false : null);
    if (wert == null) continue;
    for (const b of flotillaMembers(state, id)) if (b.status === 'moored') b.flotte.zusammen = wert;
  }
}

/** Freie Plätze je Steg, die dieses Boot jetzt nehmen könnte (ohne Platzwahl, keine Rekursion). */
// klasse: nur Plätze der Größenklasse des Boots zählen (Stege, die für diese Boote gebaut sind)
function freeByJetty(state, ctx, boat, klasse = false) {
  const out = new Map();
  for (const b of availableBerths(state, ctx)) {
    if (klasse && b.size !== boat.size) continue;
    if (!isFree(state, b.id) || !fits(boat, b, ctx.rules, state.stage) || hookWhyNotFit(state, ctx, boat, b)) continue;
    const j = jettyOf(b);
    out.set(j, (out.get(j) || 0) + 1);
  }
  return out;
}

/**
 * Stege, an denen ein Boot der Flottille liegen möchte: der Steg, an dem schon andere aus der Gruppe
 * liegen (bei mehreren der mit den meisten); liegt noch keins, alle Stege mit genug freien Plätzen für
 * alle, die noch keinen haben (sonst der mit den meisten). Leere Menge, wenn nichts passt; null ohne Flottille.
 */
export function flotillaTargets(state, ctx, boat) {
  if (!boat?.flotte) return null;
  const alle = flotillaMembers(state, boat.flotte.id);
  const key = `${boat.id}|${state.day}|${state.clock}|${state.stage}|${Object.keys(state.berths).length}|${alle.map((b) => `${b.status}${b.berthId ?? ''}${b.funk?.platz ?? ''}`).join(',')}`;
  const cache = ctx.flotteCache ?? (ctx.flotteCache = new Map());
  if (cache.has(key)) return cache.get(key);
  const stege = new Map();
  for (const b of alle) {
    if (b === boat || b.id === boat.id || b.status !== 'moored') continue;
    const j = jettyOf(ctx.berthById[b.berthId]);
    stege.set(j, (stege.get(j) || 0) + 1);
  }
  let out;
  if (stege.size) {
    const best = Math.max(...stege.values());
    out = new Set([...stege].filter(([, n]) => n === best).map(([j]) => j));
  } else {
    const offen = alle.filter((b) => b.status !== 'moored' || b.id === boat.id).length;
    // Am liebsten an einem Steg ihrer Größe (Kajütboote an den M-Steg, nicht in die großen Boxen)
    const passend = freeByJetty(state, ctx, boat, true);
    const frei = freeByJetty(state, ctx, boat);
    const genugPassend = [...passend].filter(([, n]) => n >= offen).map(([j]) => j);
    const genug = genugPassend.length ? genugPassend : [...frei].filter(([, n]) => n >= offen).map(([j]) => j);
    const best = Math.max(0, ...frei.values());
    out = new Set(genug.length ? genug : best > 0 ? [...frei].filter(([, n]) => n === best).map(([j]) => j) : []);
  }
  if (cache.size > 200) cache.clear();
  cache.set(key, out);
  return out;
}

/** Vorliebe bei der Platzwahl (Selbst-Einfahren, Vorschlag des Büros): Steg der Gruppe zuerst. */
function flotillaScore(state, ctx, boat, berth) {
  if (!boat?.flotte || !ctx.rules.flotilla) return 0;
  const ziel = flotillaTargets(state, ctx, boat);
  return ziel?.has(jettyOf(berth)) ? FLOTTE_SCORE : 0;
}

/** Erwartete Wertung, wenn dieses Boot an diesen Platz kommt (für das Schild beim Einrasten). */
function flotillaExpect(state, ctx, boat, berth) {
  const st = flotillaState(state, ctx, boat.flotte.id);
  if (!st) return null;
  const j = jettyOf(berth);
  let andere = 0, fremd = 0;
  for (const b of flotillaMembers(state, boat.flotte.id)) {
    if (b.id === boat.id || b.status !== 'moored') continue;
    if (jettyOf(ctx.berthById[b.berthId]) === j) andere++;
    else fremd++;
  }
  return { zusammen: !st.zerrissen && fremd === 0, steg: j, dort: andere, woanders: fremd, n: st.n, name: st.name };
}

/** Flottille per Funk angemeldet (alle Boote haben boat.funk). */
function announceFlotilla(state, ctx, events) {
  const boote = state.upcoming.filter((b) => b.flotte && !b.funk && !b.stationed);
  if (!boote.length) return;
  for (const b of boote) b.funk = { platz: null };
  events.push({ type: 'announced', boatIds: boote.map((b) => b.id), flotte: boote[0].flotte.id });
}

/**
 * Stege, an denen man der angemeldeten Flottille alle Boxen frei halten kann, der beste zuerst:
 * [{ jetty, plaetze: { bootId: platzId } }]. Die eigenen Reservierungen der Gruppe zählen dabei nicht.
 */
export function flotillaReservable(state, ctx, flotteId) {
  const boote = flotillaMembers(state, flotteId).filter((b) => b.funk && (b.status === 'expected' || b.status === 'waiting'));
  if (!boote.length) return [];
  const alt = boote.map((b) => b.funk.platz);
  for (const b of boote) b.funk.platz = null;
  try {
    // Größte zuerst, damit die kleinen nicht die großen Boxen nehmen
    const order = [...boote].sort((a, b) => b.length - a.length || b.beam - a.beam || a.flotte.nr - b.flotte.nr);
    const frei = new Map(order.map((b) => [b.id, reservableBerths(state, ctx, b.id)]));
    const stege = new Set(availableBerths(state, ctx).map(jettyOf));
    const out = [];
    for (const j of stege) {
      const plaetze = {};
      const vergeben = new Set();
      let wert = 0;
      let ok = true;
      for (const b of order) {
        const p = frei.get(b.id).find((id) => !vergeben.has(id) && jettyOf(ctx.berthById[id]) === j);
        if (!p) { ok = false; break; }
        plaetze[b.id] = p;
        vergeben.add(p);
        wert += berthScore(state, ctx, b, ctx.berthById[p]);
      }
      if (ok) out.push({ jetty: j, plaetze, wert });
    }
    return out.sort((a, b) => b.wert - a.wert || String(a.jetty).localeCompare(String(b.jetty))).map(({ jetty, plaetze }) => ({ jetty, plaetze }));
  } finally {
    boote.forEach((b, i) => { b.funk.platz = alt[i]; });
  }
}

/** Der ganzen Flottille Boxen an einem Steg frei halten (ohne jetty: am besten Steg). */
export function reserveFlotilla(state, ctx, flotteId, jetty = null) {
  const events = [];
  const wahl = flotillaReservable(state, ctx, flotteId);
  const o = jetty != null ? wahl.find((w) => w.jetty === jetty) : wahl[0];
  if (!o) return { ok: false, reason: jetty != null ? 'notReservable' : 'noFreeBerth', events };
  for (const b of flotillaMembers(state, flotteId)) {
    const ziel = o.plaetze[b.id];
    if (!ziel || !b.funk) continue;
    if (b.funk.platz === ziel) continue;
    if (b.funk.platz) events.push({ type: 'reservationReleased', boatId: b.id, berthId: b.funk.platz, reason: 'moved' });
    b.funk.platz = ziel;
    events.push({ type: 'reserved', boatId: b.id, berthId: ziel, flotte: flotteId });
  }
  events.push({ type: 'flotillaReserved', flotte: flotteId, jetty: o.jetty, berthIds: Object.values(o.plaetze) });
  return { ok: true, jetty: o.jetty, berthIds: Object.values(o.plaetze), events };
}

/** Frei gehaltene Boxen der ganzen Flottille wieder freigeben. */
export function releaseFlotilla(state, ctx, flotteId) {
  const events = [];
  for (const b of flotillaMembers(state, flotteId)) {
    if (b.funk?.platz && (b.status === 'expected' || b.status === 'waiting')) dropReservation(b, events, 'released');
  }
  return { ok: events.length > 0, events };
}

/**
 * Nach dem Festmachen oder Umlegen eines Boots der Flottille: liegen alle zusammen, 'flotillaComplete';
 * ist die Gruppe zum ersten Mal aufgeteilt, einmal 'flotillaSplit' (für Oberfläche und Logbuch).
 */
function flotillaMoored(state, ctx, boat, events) {
  if (!boat?.flotte) return;
  const st = flotillaState(state, ctx, boat.flotte.id);
  if (!st) return;
  if (st.together === true) {
    events.push({ type: 'flotillaComplete', flotte: st.id, name: st.name, n: st.n, jetty: st.steg, boatId: boat.id });
  } else if (st.together === false && !boat.flotte.gemeldet) {
    for (const b of flotillaMembers(state, st.id)) b.flotte.gemeldet = true;
    events.push({ type: 'flotillaSplit', flotte: st.id, name: st.name, boatId: boat.id, stege: { ...st.stege }, zerrissen: st.zerrissen });
  }
}

// ---------------------------------------------------------------------------
// Päckchen (P27, F1): Ist keine passende Box frei, darf ein Boot längsseits an ein liegendes Boot,
// das mindestens gleich groß ist. Der Platz außen heißt wie der innere mit RAFT ('B27+'). Er steht in
// ctx.berthById, aber nicht in ctx.berths (Listen, Schilder und Auslastung zählen ihn nicht).

export const RAFT = '+';
const SIZE_RANK = { S: 1, M: 2, L: 3, XL: 4, XXL: 5 };

/** Ist das ein Päckchenplatz (außen an einem anderen Boot)? */
export function isRaftBerth(berthId) {
  return typeof berthId === 'string' && berthId.endsWith(RAFT);
}

/** Der innere Platz zu einem Päckchenplatz ('B27+' -> 'B27'), sonst null. */
export function raftInner(berthId) {
  return isRaftBerth(berthId) ? berthId.slice(0, -RAFT.length) : null;
}

/** Päckchenplätze zu allen Plätzen der Arten aus rules.raft.kinds (außen, ohne Strom und Komfort). */
function raftBerths(list, rules) {
  const k = rules.raft;
  if (!k?.kinds?.length) return [];
  return list.filter((b) => k.kinds.includes(b.kind) && !b.reserved).map((b) => ({
    id: b.id + RAFT,
    raft: b.id,
    kind: 'paeckchen',
    jetty: b.jetty,
    size: b.size,
    stages: b.stages ? [...b.stages] : undefined,
    stage: b.stage,
    // Länge und Tiefe wie innen (das Boot liegt weiter draußen, also nicht flacher); die Breite
    // begrenzt der Platz nicht, darüber entscheidet die Ansicht (ctx.raftFits: Fahrwasser frei)
    maxLength: b.maxLength,
    maxBeam: 99,
    depth: b.depth,
    comfort: 0,
    power: false,
    exposed: !!b.exposed,
    reserved: false,
    ...(b.requires ? { requires: b.requires } : {}),
    ...(b.ohne ? { ohne: [...b.ohne] } : {}),
  }));
}

/** Boot-id außen an diesem Platz (inneren Platz angeben) oder null. */
export function raftOuter(state, innerBerthId) {
  return state.berths[innerBerthId + RAFT] ?? null;
}

/** Hält ein Boot außen (liegend oder gerade ablegend) das innere Boot an diesem Platz fest? */
export function raftBlocked(state, innerBerthId) {
  if (innerBerthId == null) return false;
  return state.berths[innerBerthId + RAFT] != null || !!state.leaving?.[innerBerthId + RAFT];
}

/**
 * Warum kann dieses wartende Boot nicht an diesen Päckchenplatz? null = es kann.
 * 'raftOff' (keine Päckchen in dieser Stufe), 'boxFree' (eine passende Box ist frei),
 * 'noInner' (innen liegt niemand), 'innerBusy' (innen: fest vergeben, Kurzhalter, Tagestörn, legt ab),
 * 'occupied', 'bigger' (Gast größer als das Boot innen), 'draft', 'fairway' (die Ansicht sieht das Boot
 * außen im Fahrwasser oder an Land), 'funk' und Gründe aus dem Hook 'fit'.
 */
export function raftWhyNot(state, ctx, boat, berthId) {
  const k = ctx.rules.raft;
  const berth = ctx.berthById[berthId];
  if (!k || !berth?.raft || state.stage < k.from) return 'raftOff';
  if (!boat || boat.stationed) return 'raftOff';
  if (!berthAvailable(state, berth)) return 'noBerth';
  if (fittingBerths(state, ctx, boat.id).length) return 'boxFree';
  const innerId = state.berths[berth.raft];
  const inner = state.boats[innerId];
  if (!inner || inner.status !== 'moored' || inner.berthId !== berth.raft) return 'noInner';
  if (inner.stationed || isShortStay(inner) || inner.trip || inner.paeckchen || state.leaving?.[berth.raft]) return 'innerBusy';
  if (!isFree(state, berthId)) return 'occupied';
  if ((SIZE_RANK[boat.size] ?? 9) > (SIZE_RANK[inner.size] ?? 0) || boat.length > inner.length + (k.slack ?? 0) + 1e-9) return 'bigger';
  const why = whyNotFit(boat, berth, ctx.rules, state.stage);
  if (why) return why;
  const hook = hookWhyNotFit(state, ctx, boat, berth);
  if (hook) return hook;
  if (ctx.raftFits && !ctx.raftFits(berth.raft, boat, inner, state)) return 'fairway';
  return null;
}

/** Päckchenplätze, an die dieses wartende Boot jetzt darf (nur wenn keine passende Box frei ist). */
export function raftTargets(state, ctx, boatId) {
  const boat = state.boats[boatId];
  const k = ctx.rules.raft;
  if (!k || !boat || boat.status !== 'waiting' || state.stage < k.from) return [];
  if (fittingBerths(state, ctx, boatId).length) return [];
  const out = [];
  for (const b of availableBerths(state, ctx)) {
    const id = b.id + RAFT;
    if (!ctx.berthById[id] || !state.berths[b.id]) continue;
    if (!raftWhyNot(state, ctx, boat, id)) out.push(id);
  }
  return out;
}

/** Abzug in Ankern fürs Päckchen (beide Crews, rules.raft.rating). */
export function raftPenalty(ctx, boat) {
  return boat?.paeckchen || boat?.paeckchenInnen ? ctx.rules.raft?.rating ?? 0 : 0;
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
  // Päckchen (P27): außen höchstens rules.raft.maxNights Nächte, beide Crews merken es sich
  const inner = raftInner(berthId);
  if (inner) {
    boat.paeckchen = inner;
    if (boat.nights > 0) boat.nights = Math.min(boat.nights, ctx.rules.raft?.maxNights ?? 1);
    const innen = state.boats[state.berths[inner]];
    if (innen) innen.paeckchenInnen = true;
    ev.paeckchen = inner;
    if (innen) ev.innen = innen.id;
  }
  if (hand) ev.hand = true;
  if (boat.snug) ev.passgenau = true;
  if (boat.flotte) ev.flotte = boat.flotte.id;
  events.push(ev);
  const seen = (state.logbook[boat.typeId] ||= []);
  const key = boat.modelId ?? boat.typeId;
  if (!seen.includes(key)) {
    seen.push(key);
    events.push({ type: 'logbookNew', typeId: boat.typeId, modelId: boat.modelId, boatId: boat.id });
  }
  // Kurzhalt: Ablegezeit ab jetzt, spätestens kurz vor Abend (wer abends noch einfährt, bleibt kurz)
  if (isShortStay(boat)) {
    const { dayLength, eveningLength } = ctx.rules;
    const sh = ctx.rules.shortStay || {};
    const want = state.clock + (boat.stay ?? 0.2) * dayLength;
    const latest = state.phase === 'day' ? dayLength * (sh.latest ?? 0.97) : dayLength + eveningLength - 2;
    boat.leaveClock = Math.round(Math.max(state.clock + 5, Math.min(want, latest)) * 10) / 10;
    boat.moorDay = state.day;
    // Mit 3D-Ansicht läuft die Uhr erst, wenn das Boot sichtbar fest ist (shortStayDocked); die Anfahrt
    // von Boje oder Ankerfeld kann länger dauern als der ganze Halt
    if (ctx.ansichtMeldetFest?.()) { boat.wartetFest = true; boat.mooredClock = state.clock; }
  }
  // Wie im echten Hafen: Das Liegegeld für die kommende Nacht wird gleich nach dem Anlegen fällig.
  if (!boat.stationed) chargeFee(state, ctx, boat, modifiers(state, ctx), events);
  if (kept) events.push(kept);
  flotillaMoored(state, ctx, boat, events);
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
  const why = berth.raft ? raftWhyNot(state, ctx, boat, berthId) : whyNotFit(boat, berth, ctx.rules, state.stage) || hookWhyNotFit(state, ctx, boat, berth);
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
  // Flottille (P32): gold leuchten die Plätze am Steg, an dem die Gruppe zusammen liegen kann
  const ziel = ctx.rules.flotilla ? flotillaTargets(state, ctx, boat) : null;
  if (ziel) return fittingBerths(state, ctx, boatId).filter((id) => ziel.has(jettyOf(ctx.berthById[id])));
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
  // Päckchen (P27): außen nur der Anteil rules.raft.fee, beide Crews geben weniger Anker
  const raft = !!berth?.raft;
  const night = nightlyFee(state, ctx, boat, met.length, mods.priceFactor * (raft ? ctx.rules.raft?.fee ?? 1 : 1));
  // Kurzhalter zahlen das Tagesliegegeld (Anteil vom Nachtpreis), wie chargeFee
  const fee = isShortStay(boat) ? Math.max(1, Math.round(night * (ctx.rules.shortStay?.fee ?? 0.5))) : night;
  const snug = !!berth && isSnug(state, ctx, boat, berth);
  const probe = { ...boat, wishesMet: boat.wishesMet + weight, wishesTotal: boat.wishesTotal + boat.wishes.length, berthId: berth?.id ?? null, snug, byHand: true, paeckchen: raft ? berth.raft : boat.status === 'moored' && berth ? null : boat.paeckchen };
  // Liegt das Boot schon (Umlegen, P33): Liegegeld bleibt, das Umlegen zählt für die Crew
  const relocate = boat.status === 'moored' && !!berth;
  let malus = 0;
  if (relocate) {
    probe.umgelegt = (boat.umgelegt || 0) + 1;
    malus = Math.round((relocatePenalty(ctx, probe) - relocatePenalty(ctx, boat)) * 100) / 100;
  }
  // Flottille (P32): zusammen mit der Gruppe oder getrennt
  const flotte = boat.flotte && berth && ctx.rules.flotilla ? flotillaExpect(state, ctx, boat, berth) : null;
  if (flotte) probe.flotte = { ...boat.flotte, zusammen: flotte.zusammen };
  const anchors = rateBoat(ctx, probe, mods.ratingBonus);
  const out = { fee, wishesMet: met, wishes: [...boat.wishes], anchors, snug, comfort: (berth?.comfort || 0) > 0, far, full };
  if (berth && boat.lieblingsplatz != null && berth.id === boat.lieblingsplatz) out.lieblingsplatz = true;   // P25
  if (flotte) out.flotte = { ...flotte, wert: flotte.zusammen ? ctx.rules.flotilla.together : -ctx.rules.flotilla.apart };
  if (raft) Object.assign(out, { paeckchen: berth.raft, malus: raftPenalty(ctx, probe) });
  if (relocate) Object.assign(out, { relocate: true, malus, mal: probe.umgelegt });
  return out;
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
    // Für eine Flottille schlägt das Büro trotzdem vor (Steg der Gruppe), weist aber nicht selbst zu
    const sonder = fitting.length ? officeSpecialCase(state, ctx, id, fitting) : null;
    if (!fitting.length || (sonder && sonder !== 'flottille')) continue;
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
  // Flottille (P32): die Gruppe soll zusammen liegen, das entscheidet der Spieler (mit frei gehaltener Box nicht)
  if (sp.flotilla && boat.flotte && !boat.funk?.platz && ctx.rules.flotilla) return 'flottille';
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
    .map((b) => ({ b, d: dist(b), w: berthWishHits(state, ctx, boat, b), h: hookScore(state, ctx, boat, b) }))
    // Die Crew sucht sich den Platz, der ihre Wünsche erfüllt; unter gleich guten den nächsten.
    // Vorher zählt die Vorliebe aus den Hooks (zum Beispiel freigehaltene Regattaplätze für Segler).
    .sort((x, y) => y.h - x.h || y.w - x.w || (x.d ?? Infinity) - (y.d ?? Infinity) || String(x.b.id).localeCompare(String(y.b.id), 'de', { numeric: true }));
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
  // Andrang: mehr Wartende als die halben Bojen. Mit Ansicht zaehlen nur Boote, die an der Boje
  // liegen; wer noch anfaehrt, macht die Bojen nicht voll (sonst fuhren ab Stufe 4 die
  // ersten Boote im Revier immer direkt in eine Box und keines lag je sichtbar an der Boje, P87).
  const ansicht = ctx.ansichtMeldetBoje?.();
  const wartend = ansicht ? state.queue.filter((id) => state.boats[id]?.atBuoy).length : state.queue.length;
  const rush = wartend > waitSpotCount(state, ctx) / 2;
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
    // Mit 3D-Ansicht zaehlt "im Revier" erst, wenn das Boot von See her in der Karte ist (die Anfahrt
    // dauert dort Minuten, 'boot:im-revier'); sonst fuehre es schon weit draussen "selbst ein".
    const revier = ctx.ansichtMeldetBoje?.() ? b.revierSeit ?? null : b.waitingSince;
    // Andrang mit Ansicht: im Revier etwas laenger Zeit fuer den Spieler (queue.rushViewFactor x after),
    // damit man ein ankommendes Boot noch antippen und lenken kann
    const rushAfter = ctx.ansichtMeldetBoje?.() ? after * (ctx.rules.queue.rushViewFactor ?? 1) : after;
    const bojeAb = b.atBuoy ? b.atBuoySince : Infinity;
    const revierAb = rush && revier != null ? revier + rushAfter - after : Infinity;
    const since = Math.min(bojeAb, revierAb);
    if (!Number.isFinite(since) || state.clock - since < after) continue;
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
    // Bootsgeschichten können Anteil und Zeiten je Boot vorgeben (boat.tripPlan, zum Beispiel Angler früh
    // raus); Regattaboote fahren auch am letzten Tag vor der Abreise (minNights 1)
    const p = boat.tripPlan || t;
    if (boat.stationed || boat.nights < (p.minNights ?? 2) || boat.special || boat.paeckchen) continue;
    if (random(state) >= (p.chance ?? t.chance)) continue;
    const at = (range) => Math.round((range[0] + random(state) * (range[1] - range[0])) * ctx.rules.dayLength);
    boat.trip = { out: at(p.out ?? t.out), back: at(p.back ?? t.back), away: false };
    if (p.regatta) boat.trip.regatta = true;
  }
}

function tripStep(state, ctx, events) {
  for (const boat of mooredBoats(state)) {
    const t = boat.trip;
    if (!t) continue;
    if (!t.away && !t.done && state.clock >= t.out && state.clock < t.back) {
      // Päckchen (P27): Wer außen liegt oder gerade ablegt, muss erst weg sein
      if (raftBlocked(state, boat.berthId)) continue;
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
  breakFlotilla(state, boat, events);
  state.queue = state.queue.filter((id) => id !== boat.id);
  delete state.boats[boat.id];
  // Winterbeginn: Wer über Nacht an der Boje lag, fährt ins Winterlager. Das zählt nicht als weggefahren.
  // Kurzhalter, die abends nicht mehr dran waren ('spaet'), brauchten den Halt nicht mehr.
  if (why !== 'winter' && why !== 'spaet') {
    state.stats.turnedAway++;
    state.stats.turnedAwayToday++;
    const weg = heute(state).weggefahren;
    weg[why] = (weg[why] || 0) + 1;
  }
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
  if (why === 'queueFull' || why === 'rebuild' || why === 'winter' || why === 'spaet' || !couldEverFit(state, ctx, boat)) return false;
  const ta = ctx.rules.turnAway;
  const rated = random(state) < ta.chance;
  if (rated) pushRating(state, ctx, ta.rating, boat);
  return rated;
}

/** Zahl der Warteplätze (Bojen und Ankerfeld) vor dem Hafen in der aktuellen Stufe. */
export function waitSpotCount(state, ctx) {
  const spots = ctx.rules.queue.spots;
  return spots[state.stage] ?? spots[Math.max(...Object.keys(spots).map(Number))] ?? 0;
}

/** Kleinste freie Nummer eines Warteplatzes (0 = erste Boje) oder null, wenn alle belegt sind. */
export function freeWaitSpot(state, ctx) {
  const n = waitSpotCount(state, ctx);
  let wartend = waitingBoats(state);
  // Mit Ansicht belegt nur, wer im Revier oder an der Boje ist. Wer noch draussen auf See anfaehrt,
  // haelt keine Boje frei (sonst waren ab Stufe 4 alle Bojen von Anfahrenden "belegt", fast kein Boot
  // lag je sichtbar an einer Boje, und Neue fuhren direkt in eine Box oder drehten ab). Anfahrende
  // hoechstens so viele, wie es Bojen gibt; die Ansicht legt ein Boot auf eine belegte Boje auf die
  // naechste freie oder ins Ankerfeld.
  if (ctx.ansichtMeldetBoje?.()) {
    if (wartend.length >= 2 * n) return null;
    wartend = wartend.filter((b) => b.atBuoy || b.revierSeit != null);
  }
  const used = new Set(wartend.map((b) => b.waitSpot));
  for (let i = 0; i < n; i++) if (!used.has(i)) return i;
  return null;
}

function arrive(state, ctx, boat, events) {
  state.boats[boat.id] = boat;
  let spot = freeWaitSpot(state, ctx);
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
  // Flottille (P32): Sind alle Bojen belegt, gehen die Boote der Gruppe trotzdem vor Anker (die Ansicht
  // legt sie auf die nächste freie Boje oder ins Ankerfeld); eine Flottille dreht nicht einzeln ab
  if (spot == null && boat.flotte && ctx.rules.flotilla) spot = state.queue.length % Math.max(1, waitSpotCount(state, ctx));
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

/** Die 3D-Ansicht meldet: das wartende Boot ist von See her im Revier (in der Karte). */
export function markInHarbor(state, ctx, boatId) {
  const boat = state.boats[boatId];
  if (!boat || boat.status !== 'waiting' || boat.revierSeit != null) return { ok: false, events: [] };
  boat.revierSeit = state.clock;
  return { ok: true, events: [] };
}

// spot: an welcher Boje das Boot wirklich liegt (Nummer), null = im Ankerfeld; undefined = unbekannt.
// Die Ansicht legt ein Boot auf die naechste freie Boje oder ins Ankerfeld, wenn seine Boje noch
// belegt ist. Ohne diese Rueckmeldung trugen zwei wartende Boote dieselbe Bojennummer (Schichttest).
export function markAtBuoy(state, ctx, boatId, spot) {
  const boat = state.boats[boatId];
  if (!boat || boat.status !== 'waiting') return { ok: false, events: [] };
  if (spot === null) boat.waitSpot = null;
  else if (Number.isInteger(spot) && spot >= 0 && spot < waitSpotCount(state, ctx)) {
    const besetzt = waitingBoats(state).some((o) => o !== boat && o.atBuoy && o.waitSpot === spot);
    if (!besetzt) boat.waitSpot = spot;
  }
  if (boat.atBuoy) return { ok: false, events: [] };
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
  breakFlotilla(state, boat, pre);
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
  // Kurzhalter, die noch an der Boje warten, brauchen den Halt nicht mehr und fahren weiter (ohne Bewertung)
  for (const id of [...state.queue]) if (isShortStay(state.boats[id])) turnAway(state, ctx, state.boats[id], events, 'spaet');

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
  // Päckchen (P27): außen zahlt nur den Anteil rules.raft.fee
  if (isRaftBerth(boat.berthId) && ctx.rules.raft) mods = { ...mods, priceFactor: (mods.priceFactor ?? 1) * ctx.rules.raft.fee };
  const metList = checkWishes(state, ctx, boat, mods);
  boat.feeDay = state.day;
  if (boat.paidThrough != null && state.day <= boat.paidThrough) return; // schon im Voraus bezahlt
  if (isShortStay(boat)) {
    // Tagesliegegeld: Anteil vom Nachtpreis, mindestens 1
    const share = ctx.rules.shortStay?.fee ?? 0.5;
    const full = nightlyFee(state, ctx, boat, metList.length, mods.priceFactor);
    const base = nightlyFee(state, ctx, boat, 0, mods.priceFactor);
    const fee = Math.max(1, Math.round(full * share));
    const baseFee = Math.min(fee, Math.max(1, Math.round(base * share)));
    boat.paidThrough = state.day;
    boat.pendingFee += fee;
    boat.paid = false;
    events.push({ type: 'feeReady', boatId: boat.id, amount: fee, base: baseFee, bonus: fee - baseFee, nights: 0, kurz: true, wishesMet: metList });
    const autoSizes0 = ctx.rules.office.autoCollectSizes;
    if (state.office >= ctx.rules.office.autoCollect && (!autoSizes0 || autoSizes0.includes(boat.size))) events.push(...collect(state, ctx, boat.id).events);
    return;
  }
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
/** Abzug in Ankern, weil die Crew öfter umgelegt wurde, als sie hinnimmt (P33, rules.relocate). */
export function relocatePenalty(ctx, boat) {
  const r = ctx.rules.relocate;
  if (!r || !boat) return 0;
  return Math.max(0, (boat.umgelegt || 0) - (r.free ?? 1)) * (r.rating || 0);
}

/**
 * Kann dieses liegende Boot gerade umgelegt werden (P33)? Nur Gäste, die sichtbar in ihrer Box
 * liegen: nicht auf Tagestörn, keine Dauerlieger, Fischer oder Retter (deren Plätze verwalten
 * eigene Module).
 */
export function canRelocate(state, boatId) {
  const boat = state.boats[boatId];
  return !!boat && boat.status === 'moored' && !boat.stationed && !boat.trip?.away && boat.berthId != null && !raftBlocked(state, boat.berthId);
}

/** Freie Boxen, in die ein liegender Gast umgelegt werden kann (die beste zuerst, ohne seine eigene). */
export function relocateTargets(state, ctx, boatId) {
  if (!canRelocate(state, boatId)) return [];
  const own = state.boats[boatId].berthId;
  return fittingBerths(state, ctx, boatId).filter((id) => id !== own);
}

/**
 * Liegenden Gast in eine andere freie Box umlegen (verholen, P33, F4). Er behält Nächte und
 * Rechnung: Bezahltes Liegegeld bleibt, offenes bleibt offen. Wünsche an den Platz (Strom) gelten
 * ab dem nächsten Morgen für die neue Box. Passgenau gilt neu. Jedes Umlegen zählt für die Crew
 * (boat.umgelegt); ab dem zweiten Mal sinkt ihre Bewertung (rules.relocate).
 * opts.grund: 'hand' (Spieler zieht), 'dauer' (Dauerlieger kommt zurück), 'umbau' (Stufenausbau)
 * opts.zaehlt: false = zählt nicht (zum Beispiel Sturm: das Verholen schützt die Crew)
 * @returns {{ ok: boolean, reason?: string, events: object[] }}
 */
export function relocateGuest(state, ctx, boatId, berthId, { grund = 'hand', zaehlt = true, unterwegs = false } = {}) {
  const events = [];
  const boat = state.boats[boatId];
  if (!boat || boat.status !== 'moored' || boat.berthId == null) return { ok: false, reason: 'notMoored', events };
  if (boat.stationed) return { ok: false, reason: 'stationed', events };
  if (boat.trip?.away && !unterwegs) return { ok: false, reason: 'away', events };
  if (berthId === boat.berthId) return { ok: false, reason: 'same', events };
  if (raftBlocked(state, boat.berthId)) return { ok: false, reason: 'raftOuter', events };
  const berth = ctx.berthById[berthId];
  if (!berth || !berthAvailable(state, berth) || berth.raft) return { ok: false, reason: 'noBerth', events };
  if (!isFree(state, berthId)) return { ok: false, reason: 'occupied', events };
  const why = whyNotFit(boat, berth, ctx.rules, state.stage) || hookWhyNotFit(state, ctx, boat, berth);
  if (why) return { ok: false, reason: why, events };
  const from = boat.berthId;
  if (state.berths[from] === boat.id) delete state.berths[from];
  state.berths[berthId] = boat.id;
  boat.berthId = berthId;
  boat.snug = isSnug(state, ctx, boat, berth);
  // Aus dem Päckchen in eine Box verholt (P27): der Abzug der äußeren Crew entfällt
  const ausPaeckchen = isRaftBerth(from);
  if (ausPaeckchen) boat.paeckchen = null;
  const vorher = relocatePenalty(ctx, boat);
  if (zaehlt && !ausPaeckchen) boat.umgelegt = (boat.umgelegt || 0) + 1;
  const malus = Math.round((relocatePenalty(ctx, boat) - vorher) * 100) / 100;
  const ev = { type: 'relocated', boatId: boat.id, from, to: berthId, guest: true, grund, mal: boat.umgelegt || 0 };
  if (malus > 0) ev.malus = malus;
  if (boat.snug) ev.passgenau = true;
  if (ausPaeckchen) ev.ausPaeckchen = raftInner(from);
  events.push(ev);
  flotillaMoored(state, ctx, boat, events);
  for (const fn of ctx.hooks.relocate || []) fn({ state, ctx, boat, from, to: berthId, grund, events });
  return { ok: true, events };
}

/**
 * Wind (P34, features/wind.js setzt die Felder am Boot): boat.windLage 'offen' (bei Starkwind unruhig
 * gelegen) oder 'geschuetzt' (ruhig gelegen), boat.windRuecken (großes Boot musste mit Rückenwind
 * anlegen). Anker dazu, negativ = weniger (rules.wind).
 */
export function windRating(ctx, boat) {
  const w = ctx.rules.wind;
  if (!w || !boat) return 0;
  let n = 0;
  if (boat.windLage === 'offen') n -= w.exposed || 0;
  else if (boat.windLage === 'geschuetzt') n += w.sheltered || 0;
  if (boat.windRuecken) n -= w.tailwind || 0;
  return n;
}

/**
 * Preisstufe (P35, features/preisstufe-regeln.js setzt boat.preisstufe bei der Ankunft): faire Preise loben
 * die Gäste (rating), wer viel zahlt, erwartet viel (demand mal Anteil der unerfüllten Wünsche).
 */
export function priceRating(ctx, boat) {
  const l = ctx.rules.priceLevels?.levels?.[boat?.preisstufe];
  if (!l) return 0;
  let n = l.rating || 0;
  if (l.demand && boat.wishesTotal > 0) n -= l.demand * Math.max(0, 1 - (boat.wishesMet || 0) / boat.wishesTotal);
  return Math.round(n * 100) / 100;
}

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
  // Flottille (P32): alle an einem Steg oder aufgeteilt
  const flotte = boat.flotte?.zusammen === true ? r.flotilla?.together ?? 0 : boat.flotte?.zusammen === false ? -(r.flotilla?.apart ?? 0) : 0;
  const penalty = boat.penalty || 0;
  const moved = relocatePenalty(ctx, boat);                   // zu oft umgelegt (P33)
  const raft = raftPenalty(ctx, boat);                        // im Päckchen gelegen (P27)
  // Stammgast wieder an seinem Lieblingsplatz (P25, plan 9a "Ruf am alten Platz")
  const stammPlatz = boat.lieblingsplatz != null && boat.berthId === boat.lieblingsplatz ? r.regular?.favouriteBonus ?? 0 : 0;
  const wind = windRating(ctx, boat);                         // Windlage bei Starkwind (P34)
  const jugend = boat.jugend ? r.youth?.rating ?? 0 : 0;      // dem Jugendtraining zugesehen (P39)
  const preis = priceRating(ctx, boat);                       // Preisstufe (P35)
  const raw = base + comfort + special + snug + byHand + funk + flotte + stammPlatz + jugend + ratingBonus - penalty - moved - raft + wind + preis;
  const value = Math.round(Math.min(r.rating.max, Math.max(r.rating.min, raw)) * 10) / 10;
  return {
    value, base, comfort, special, snug, byHand, funk, flotte, stammPlatz, jugend, bonus: ratingBonus, penalty, moved, umgelegt: boat.umgelegt || 0, paeckchen: raft,
    wind, windLage: boat.windLage ?? null, windRuecken: !!boat.windRuecken,
    preis, preisstufe: boat.preisstufe ?? null,
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
  for (const k of ['bootsname', 'heimathafen', 'stammId', 'besuche', 'stamm', 'lieblingsplatz']) if (boat[k] != null) g[k] = boat[k];
  return g;
}

/**
 * Gast reist ab: Bewertung, Gast zählt, Box wird frei, sobald das Boot heraus ist. leaveAt = Spieluhr
 * (des nächsten Tages), zu der abgelegt wird; 0 = sofort. kurz: Kurzhalter am selben Tag.
 */
function departBoat(state, ctx, boat, mods, events, leaveAt, kurz) {
  const parts = ratingParts(ctx, boat, mods.ratingBonus);
  const rating = parts.value;
  pushRating(state, ctx, rating, boat);
  const h = heute(state);
  h.abgereist++;
  if (kurz) h.kurzhalt = (h.kurzhalt || 0) + 1;
  h.bewertungen.push(rating);
  state.guests++;
  state.stageGuests = (state.stageGuests || 0) + 1;
  delete state.berths[boat.berthId];
  delete state.boats[boat.id];
  startLeaving(state, boat.id, boat.berthId, leaveAt);
  const ev = { type: 'departed', boatId: boat.id, berthId: boat.berthId, typeId: boat.typeId, rating, leaveAt, parts, guest: guestInfo(boat), day: state.day };
  if (kurz) ev.kurz = true;
  events.push(ev);
}

/**
 * Kurzhalter legen ab, sobald ihre Zeit um ist (nicht während eines Ausflugs). Münzen, die noch über
 * dem Boot liegen, landen wie nachts in der Kasse des Vertrauens (Anteil des Rundgangs).
 */
function shortStayStep(state, ctx, events) {
  let mods = null;
  // Nach 'spätestens' fährt kein Kurzhalter mehr ein: wer noch an der Boje wartet, fährt weiter (ohne Bewertung)
  if (state.phase === 'day' && state.clock >= shortStayCutoff(ctx)) {
    for (const id of [...state.queue]) if (isShortStay(state.boats[id])) turnAway(state, ctx, state.boats[id], events, 'spaet');
  }
  for (const boat of mooredBoats(state)) {
    if (!isShortStay(boat) || boat.leaveClock == null || state.clock < boat.leaveClock || boat.trip?.away) continue;
    // noch nicht sichtbar fest: warten (Notfall: nach einem Viertel Tag geht es trotzdem los)
    if (boat.wartetFest && state.clock < (boat.mooredClock ?? 0) + ctx.rules.dayLength * 0.25 + (boat.stay ?? 0.2) * ctx.rules.dayLength) continue;
    if (boat.pendingFee > 0) {
      const r = collectOnRound(state, ctx, boat.id, { night: true });
      events.push(...r.events);
      const amount = r.events[0]?.amount || 0;
      if (amount > 0) events.push({ type: 'honestyBox', amount, boatId: boat.id, kurz: true });
    }
    mods ||= modifiers(state, ctx);
    departBoat(state, ctx, boat, mods, events, 0, true);
  }
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
  // Flottillen (P32): Liegt die Gruppe zusammen? Vor der Abreise, solange alle noch da sind
  rateFlotillas(state, ctx);
  // Abreise (Kurzhalter, die noch liegen, legen spätestens jetzt ab)
  // Päckchen (P27): Reist das innere Boot ab, muss das äußere vorher weg (es reist mit ab)
  const innenFort = new Set();
  for (const boat of mooredBoats(state)) {
    if (!boat.stationed && !isRaftBerth(boat.berthId) && raftOuter(state, boat.berthId) != null && (isShortStay(boat) || boat.nights <= 1)) innenFort.add(boat.berthId);
  }
  for (const boat of mooredBoats(state)) {
    if (boat.stationed) continue;
    if (isShortStay(boat)) { departBoat(state, ctx, boat, mods, events, 0, true); continue; }
    boat.nights -= 1;
    if (boat.nights > 0 && !(isRaftBerth(boat.berthId) && innenFort.has(raftInner(boat.berthId)))) continue;
    // Abgerechnet wird nachts, abgelegt am nächsten Vormittag zu einer eigenen Zeit je Boot
    const w = ctx.rules.departWindow;
    const leaveAt = w ? Math.round((w[0] + random(state) * (w[1] - w[0])) * ctx.rules.dayLength * 10) / 10 : 0;
    departBoat(state, ctx, boat, mods, events, leaveAt, false);
  }
  raftDepartOrder(state, ctx);
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

/**
 * Päckchen (P27): Legen innen und außen am selben Morgen ab, legt das äußere zuerst ab und das
 * innere frühestens rules.raft.gap Sekunden danach (die Ansicht wartet zusätzlich, bis außen frei ist).
 */
function raftDepartOrder(state, ctx) {
  const gap = ctx.rules.raft?.gap ?? 20;
  for (const [id, l] of Object.entries(state.leaving || {})) {
    if (!isRaftBerth(id)) continue;
    const innen = state.leaving[raftInner(id)];
    if (!innen || innen.off) continue;
    if (l.off || l.at <= 0) { innen.at = Math.max(innen.at, gap); continue; }
    if (innen.at < l.at + gap) innen.at = Math.round((l.at + gap) * 10) / 10;
  }
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
    // Mit 3D-Ansicht meldet sie die Boje ('boot:an-boje'), die Anfahrt von See dauert dort Minuten:
    // die Geduld laeuft erst ab sichtbarer Boje. Ohne Ansicht (Tests, Balancing) gilt approachMax.
    const anfahrt = ctx.ansichtMeldetBoje?.() ? (queue.approachMaxView ?? queue.approachMax) : queue.approachMax;
    if (!b.atBuoy && state.clock - b.waitingSince >= (anfahrt ?? 0)) {
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
      shortStayStep(state, ctx, events);
      for (const fn of ctx.hooks.tick) fn({ state, ctx, events });
      if (state.clock >= dayLength) {
        for (const b of state.upcoming) dropReservation(b, events, 'evening');
        state.upcoming = []; // wer heute nicht mehr eingelaufen ist, kommt nicht
        startEvening(state, ctx, events);
      }
    } else if (state.clock >= dayLength + eveningLength) {
      night(state, ctx, events);
    } else {
      // Abends läuft keine Geduld ab, aber wer noch an der Boje liegt, kann weiter einfahren
      if (queue.overnight) queueStep(state, ctx, events, false);
      shortStayStep(state, ctx, events);
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
  // Doppelboxen (P59) sind ein Umbau, keine fehlenden Plätze; zusammengelegte Einzelboxen auch nicht
  const open = ctx.berths.filter((b) => (b.stages ? b.stages.includes(state.stage) : b.stage <= state.stage) && !berthAvailable(state, b)
    && !b.doppel && !b.ohne?.some((k) => state.buildings[k])).length;
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
 * gone = Plätze, die wegfallen, guests = Gäste, die dann abreisen (kein passender Platz frei),
 * moving = Gäste, die in eine andere Box umgelegt werden (P33), fixed = feste Boote, die umziehen.
 * Rechnet den Ausbau an einer Kopie des Spielstands durch, damit Vorschau und Ausbau übereinstimmen.
 */
export function stageUpPreview(state, ctx) {
  const next = state.stage + 1;
  const inStage = (b, st) => (b.stages ? b.stages.includes(st) : b.stage <= st);
  const gone = ctx.berths.filter((b) => berthAvailable(state, b) && !inStage(b, next)).map((b) => b.id);
  const fixed = gone.map((id) => state.boats[state.berths[id]]).filter((b) => b?.stationed).map((b) => b.id);
  const copy = JSON.parse(JSON.stringify(state));
  copy.stage = next;
  // Ohne Hooks der Module: die Vorschau ändert nichts außerhalb der Kopie
  const quiet = { ...ctx, hooks: { ...ctx.hooks, stageUp: [], relocate: [] } };
  const events = [];
  clearVanishedBerths(copy, quiet, state.stage, events);
  return {
    gone,
    moving: events.filter((e) => e.type === 'relocated' && e.guest).map((e) => e.boatId),
    guests: events.filter((e) => e.type === 'departed' && e.reason === 'rebuild').map((e) => e.boatId),
    fixed,
  };
}

/**
 * Beim Stufenausbau werden manche Stege umgebaut, ihre alten Plätze gibt es dann nicht mehr
 * (zum Beispiel B01, B02 und der T-Kopf an Steg B ab Stufe 3). Damit dort kein Boot im Leeren liegt:
 * - Gäste legen in eine freie passende Box um (P33, 'relocated' mit grund 'umbau'). Ist keine frei,
 *   reisen sie ab, bevor gebaut wird: abgerechnet, bewertet und gezählt wie bei jeder Abreise,
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
  // Fest liegende Boote zuerst: Gäste können notfalls abreisen, Dauerlieger und Fischer nicht.
  // Danach die äußeren Boote im Päckchen (P27): Sie verholen in eine Box oder reisen ab, bevor das
  // innere Boot umgelegt werden kann.
  const rang = (b) => (b.stationed ? 0 : isRaftBerth(b.berthId) ? 1 : 2);
  const order = mooredBoats(state).sort((a, b) => rang(a) - rang(b));
  const mussWeg = (boat) => {
    const berth = ctx.berthById[boat.berthId];
    // Platz bleibt, passt aber nicht mehr (zum Beispiel flacher nach dem Umbau)
    return goneSet.has(boat.berthId) || !!(berth && fits(boat, berth, ctx.rules, from) && !fits(boat, berth, ctx.rules, state.stage));
  };
  for (const boat of order) {
    let weg = mussWeg(boat);
    // Außen im Päckchen: muss mit weg, wenn das innere Boot weg muss oder fehlt
    if (!weg && isRaftBerth(boat.berthId)) {
      const innen = state.boats[state.berths[raftInner(boat.berthId)]];
      weg = !innen || goneSet.has(raftInner(boat.berthId)) || mussWeg(innen);
    }
    if (!weg) continue;
    const old = boat.berthId;
    if (!boat.stationed) {
      // Der Hafenmeister legt den Gast um (P33): gleiche Nächte, gleiche Rechnung, neue Box.
      // Das zählt für die Crew wie jedes Umlegen.
      const to = findGuestBerth(boat);
      if (to) {
        const r = relocateGuest(state, ctx, boat.id, to, { grund: 'umbau', unterwegs: true });
        if (r.ok) { events.push(...r.events); continue; }
      }
      // kein Platz frei: reist ab, abgerechnet, bewertet und gezählt wie bei jeder Abreise
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
  // Päckchen (P27): äußere Boote zuletzt, sie brauchen ihr inneres Boot noch an seinem Platz
  const innenDa = (berth) => !berth?.raft || state.boats[state.berths[berth.raft]]?.berthId === berth.raft;
  const order = mooredBoats(state).sort((a, b) => Number(isRaftBerth(a.berthId)) - Number(isRaftBerth(b.berthId)));
  for (const boat of order) {
    if (boat.stationed) continue;
    const berth = ctx.berthById[boat.berthId];
    if (exists(berth) && fits(boat, berth, ctx.rules, state.stage) && innenDa(berth)) continue;
    const old = boat.berthId;
    if (state.berths[old] === boat.id) delete state.berths[old];
    const to = availableBerths(state, ctx)
      .filter((b) => isFree(state, b.id) && fits(boat, b, ctx.rules, state.stage) && !hookWhyNotFit(state, ctx, boat, b))
      .sort((a, b) => (a.maxLength * a.maxBeam) - (b.maxLength * b.maxBeam) || String(a.id).localeCompare(String(b.id)))[0]?.id ?? null;
    if (to) {
      boat.berthId = to;
      state.berths[to] = boat.id;
      if (isRaftBerth(old)) boat.paeckchen = null;
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
