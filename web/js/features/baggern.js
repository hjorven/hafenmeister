// Baggern (Roadmap P29, F7): einen Steg ausbaggern, damit Boote mit mehr Tiefgang dort liegen können.
// Beschreibung: docs/baggern.md.
//
// Im Baumenü (Reiter "Stege") steht je Steg, an dem das Wasser für manche Boote der Stufe zu flach ist,
// "<Steg> ausbaggern". Danach sind seine Gastplätze mindestens ECONOMY.baggern.ziel[Klasse] tief (Plätze,
// die später an diesem Steg dazukommen, gleich mit). Angeboten wird nur, wo danach wirklich eine Bootsart
// passt, die es vorher nicht tat (Regel "nichts, was nichts tut"). Der Preis richtet sich danach, wie viele
// Meter jeder Platz tiefer wird: Die inneren Boxen am Ufer sind am flachsten und kosten am meisten.
//
// Spielstand: state.buildings['bagger:B'] = 1 (wie Stegprojekte; Rückgängig im Baumenü deckt es mit ab).
// Die Passregel liest die Tiefe über sim.syncDredge (berth.gebaggert). Boote, die weiterfahren mussten,
// obwohl an einem ausgebaggerten Steg ein Platz frei gewesen wäre (Ereignis turnedAway mit zuFlach), zählt
// state.modules.baggern.flach = { B: { n, seit } } für Baumenü und "Als Nächstes".
// Die Logik (alles außer init) läuft ohne Browser und ist in tests/baggern.test.mjs getestet.
// Schnittstelle: game.baggern = { angebote(), kaufen(steg), geist(steg), flach(steg), pegel(), kartenSatz(boot) }
// Ereignisse: baggern:fertig { steg, kosten, plaetze }, baggern:pegel { m }, sim:aufGrund { boatId, berthId, steg, pegel, baggernHilft }

import * as sim from '../sim.js';
import { ECONOMY } from '../data/economy.js';
import { HAFEN } from '../data/harbor.js';
import { regelnBereit } from './regeln-bereit.js';

export const REGELN = ECONOMY.baggern ?? null;
export const KEY = (steg) => `${sim.DREDGE_PREFIX}${steg}`;
export const stegName = (id) => HAFEN.stege?.[id] ?? `Steg ${id}`;

export function hat(state, steg) {
  return !!state?.buildings?.[KEY(steg)];
}

export function baggerState(state) {
  state.modules ||= {};
  const b = (state.modules.baggern ||= {});
  b.flach ||= {};
  return b;
}

/** Gastplätze des Stegs in der aktuellen Stufe, die beim Baggern tiefer werden: [{ berth, vorher, nachher }] */
export function betroffen(state, ctx, steg) {
  const out = [];
  for (const b of ctx.berths) {
    if (b.jetty !== steg || !sim.berthAvailable(state, b)) continue;
    const ziel = sim.dredgeTarget(ctx.rules, b);
    const vorher = sim.naturalDepth(b, state.stage);
    if (ziel > vorher + 1e-9) out.push({ berth: b, vorher, nachher: ziel });
  }
  return out;
}

// Modelle aller Bootsarten, die in dieser Stufe kommen können (Maße der Modelle, sonst die Spanne der Art)
function probenDerStufe(state, ctx) {
  const mods = sim.modifiers(state, ctx);
  const out = [];
  for (const t of ctx.types) {
    if (t.stationed || t.special || t.minStage > state.stage) continue;
    if (t.unlock && !mods.unlock?.[t.unlock]) continue;
    if (t.fromSea && !mods.seaArrivals) continue;
    const modelle = (t.models ?? []).filter((m) => (m.minStage ?? t.minStage) <= state.stage);
    const masse = modelle.length
      ? modelle.map((m) => ({ name: m.name ?? t.name, length: m.length ?? t.length[0], beam: m.beam ?? t.beam[0], draft: m.draft ?? t.draft[0] }))
      : [{ name: t.name, length: t.length[0], beam: t.beam[0], draft: t.draft[1] }];
    for (const m of masse) out.push({ ...m, typ: t.name, typeId: t.id, size: t.size, stationed: false, probe: true });
  }
  return out;
}

/**
 * Bootsarten, die nach dem Baggern an Plätze passen, an denen das Wasser vorher zu flach für sie war:
 * [{ typeId, typ, draft, plaetze: [ids] }]
 */
export function neuePassende(state, ctx, plaetze) {
  const je = new Map();
  for (const p of probenDerStufe(state, ctx)) {
    for (const { berth, nachher } of plaetze) {
      if (sim.whyNotFit(p, { ...berth, gebaggert: 0 }, ctx.rules, state.stage) !== 'draft') continue;
      if (sim.whyNotFit(p, { ...berth, gebaggert: nachher }, ctx.rules, state.stage)) continue;
      const e = je.get(p.typeId) ?? { typeId: p.typeId, typ: p.typ, draft: 0, plaetze: [] };
      e.draft = Math.max(e.draft, p.draft);
      if (!e.plaetze.includes(berth.id)) e.plaetze.push(berth.id);
      je.set(p.typeId, e);
    }
  }
  return [...je.values()].sort((a, b) => b.draft - a.draft);
}

/** Preis: grund + jeMeter[Klasse] je Meter, den ein Platz tiefer wird, auf 10 € gerundet. */
export function preis(plaetze, regeln = REGELN) {
  const summe = (regeln?.grund ?? 0) + plaetze.reduce((s, p) => s + (p.nachher - p.vorher) * (regeln?.jeMeter?.[p.berth.size] ?? 0), 0);
  return Math.round(summe / 10) * 10;
}

/** Ab welcher späteren Stufe der Stufenausbau diese Plätze ohnehin so tief macht (oder null). */
export function spaeterTief(state, ctx, plaetze) {
  for (let s = state.stage + 1; s <= (ctx.rules.maxStage ?? 6); s++) {
    const alle = plaetze.every(({ berth, nachher }) => {
      const da = berth.stages ? berth.stages.includes(s) : berth.stage <= s;
      return da && sim.naturalDepth(berth, s) + 1e-9 >= nachher;
    });
    if (alle) return s;
  }
  return null;
}

/**
 * Was sich gerade ausbaggern lässt, je Steg ein Angebot:
 * { steg, name, kosten, plaetze: [ids], neu: [{ typeId, typ, draft, plaetze }], tiefe, bisTiefgang, spaeter, flach,
 *   zuFlach (Plätze, an denen eine Bootsart der Stufe vorher nicht lag), alle (Gastplätze des Stegs) }
 */
export function angebote(state, ctx) {
  if (!REGELN || state.stage < (REGELN.abStufe ?? 1)) return [];
  const stege = [...new Set(ctx.berths.map((b) => b.jetty).filter(Boolean))];
  const out = [];
  for (const steg of stege) {
    if (hat(state, steg)) continue;
    const plaetze = betroffen(state, ctx, steg);
    if (!plaetze.length) continue;
    const neu = neuePassende(state, ctx, plaetze);
    if (!neu.length) continue;
    const tiefe = Math.min(...plaetze.map((p) => p.nachher));
    const zuFlach = new Set(neu.flatMap((t) => t.plaetze));
    const alle = ctx.berths.filter((b) => b.jetty === steg && !b.reserved && sim.berthAvailable(state, b)).length;
    out.push({
      zuFlach: zuFlach.size, alle,
      steg, name: `${stegName(steg)} ausbaggern`, kosten: preis(plaetze),
      plaetze: plaetze.map((p) => p.berth.id), neu, tiefe,
      bisTiefgang: Math.round((tiefe - (ctx.rules.underKeelClearance ?? 0)) * 10) / 10,
      spaeter: spaeterTief(state, ctx, plaetze),
      flach: flachZahl(state, steg),
    });
  }
  return out;
}

/** Wie viele Boote seit dem letzten Baggern weiterfuhren, die an diesem Steg Platz gehabt hätten. */
export function flachZahl(state, steg) {
  return state?.modules?.baggern?.flach?.[steg]?.n ?? 0;
}

/** Ereignis turnedAway mit zuFlach: mitzählen (je Steg, seit dem ersten Mal). */
export function merken(state, zuFlach) {
  if (!zuFlach?.length) return;
  const f = baggerState(state).flach;
  for (const steg of zuFlach) {
    if (hat(state, steg)) continue;
    const e = (f[steg] ||= { n: 0, seit: state.day });
    e.n++;
  }
}

/**
 * Steg ausbaggern. bezahle(kosten) bucht die Ausgabe (Browser: game.sim.spend(kosten, 'bau')).
 * Gibt { ok, grund?, angebot?, events } zurück: grund 'schon', 'unbekannt', 'geld'.
 */
export function kaufen(state, ctx, steg, bezahle = (k) => sim.spend(state, k, 'bau')) {
  if (hat(state, steg)) return { ok: false, grund: 'schon', events: [] };
  const a = angebote(state, ctx).find((x) => x.steg === steg);
  if (!a) return { ok: false, grund: 'unbekannt', events: [] };
  if (state.money < a.kosten || !bezahle(a.kosten)) return { ok: false, grund: 'geld', events: [] };
  state.buildings[KEY(steg)] = 1;
  delete baggerState(state).flach[steg];
  sim.syncDredge(state, ctx);
  return { ok: true, angebot: a, events: [{ type: 'built', id: KEY(steg), level: 1, cost: a.kosten }] };
}

// ---------------------------------------------------------------------------
// Niedrigwasser (P29): Starker Wind aus West drückt das Wasser aus der westlichen Ostsee, der Pegel fällt.
// An solchen Tagen passt ein Boot nur, wo auch heute 0,3 m Wasser unter dem Kiel bleiben (Hook 'fit',
// Grund 'niedrigwasser'), und wer schon knapp liegt, sitzt mit dem Kiel im Schlick (boat.aufGrund,
// Bewertung minus anker). Ein ausgebaggerter Steg hat genug Reserve. Zahlen: ECONOMY.baggern.niedrigwasser.

export const NW = REGELN?.niedrigwasser ?? null;
const RICHTUNG_GRAD = { ost: 0, nordost: 45, nord: 90, nordwest: 135, west: 180, suedwest: 225, sued: 270, suedost: 315 };
const winkel = (a, b) => Math.abs((((a - b) % 360) + 540) % 360 - 180);

/** Wasserstand eines Tages aus seinem Wetter { wind, richtung, event, part } in Metern (0 oder negativ). */
export function wasserstand(wx, cfg = NW) {
  if (!cfg || !wx || typeof wx !== 'object' || wx.part === 'winter' || !Number.isFinite(wx.richtung)) return 0;
  const ausWest = (cfg.richtungen ?? []).some((r) => RICHTUNG_GRAD[r] != null && winkel(wx.richtung, RICHTUNG_GRAD[r]) <= 22.5);
  if (!ausWest) return 0;
  const wind = wx.event === 'sturm' ? 1 : Number(wx.wind) || 0;
  if (wind < cfg.ab) return 0;
  const [lo, hi] = cfg.tiefe;
  const m = lo + (hi - lo) * Math.min(1, (wind - cfg.ab) / Math.max(0.01, 1 - cfg.ab));
  return -Math.round(m * 20) / 20;
}

/** Pegel heute (gespeichert, damit Laden mitten am Tag denselben Stand hat). */
export function pegelHeute(state) {
  const p = state?.modules?.baggern?.pegel;
  return p && p.tag === state.day ? p.m : 0;
}

/** Wetter des Tages da: Pegel merken und in den Regel-Kontext tragen. Gibt den Pegel zurück. */
export function setzePegel(state, ctx, wx) {
  if (!state) return 0;
  const st = state.stage ?? 1;
  const m = st >= (NW?.abStufe ?? 99) && st <= (NW?.bisStufe ?? 99) ? wasserstand(wx) : 0;
  baggerState(state).pegel = { tag: state.day, m };
  if (ctx) ctx.waterLevel = m;
  return m;
}

// Wetterquelle für den Pegel (Browser: game.events.weather, Werkzeuge: der Ereignisplan). Fehlt der Pegel
// des Tages noch (Tageswechsel vor der Wettermeldung, frisch geladen), rechnen die Hooks ihn selbst aus.
let wetterVon = null;
function sorge(state, ctx) {
  if (wetterVon && state && state.modules?.baggern?.pegel?.tag !== state.day) {
    let wx = null;
    try { wx = wetterVon(state.day); } catch { wx = null; }
    if (wx) setzePegel(state, ctx, wx);
  }
  return pegelHeute(state);
}

/** Hook 'fit': Bei Niedrigwasser passt ein Boot nur, wo auch heute genug Wasser unter dem Kiel bleibt. */
export function fitHeute({ state, ctx, boat, berth }) {
  const m = sorge(state, ctx);
  if (!(m < 0) || !boat || boat.stationed || !(boat.draft > 0)) return null;
  const tiefe = sim.berthDepth(berth, state.stage) + m;
  return boat.draft + (ctx.rules.underKeelClearance ?? 0) > tiefe + 1e-9 ? 'niedrigwasser' : null;
}

/** Hook 'tick': liegende Gäste, deren Kiel heute den Grund berührt. Zählt für das Baumenü mit. */
export function grundTick({ state, ctx, events }) {
  const m = sorge(state, ctx);
  ctx.waterLevel = m;
  if (!(m < 0)) return;
  for (const b of Object.values(state.boats)) {
    if (b.status !== 'moored' || b.stationed || !b.berthId || b.trip?.away || b.aufGrund === state.day) continue;
    const berth = ctx.berthById[b.berthId];
    if (!berth || berth.raft) continue;
    if (!(b.draft > sim.berthDepth(berth, state.stage) + m + 1e-9)) continue;
    b.aufGrund = state.day;
    // Hätte Baggern geholfen? Dann zählt es wie ein Boot, das zu wenig Wasser hatte
    const t = sim.dredgeTarget(ctx.rules, berth);
    const hilft = t > 0 && !hat(state, berth.jetty) && b.draft <= t + m + 1e-9;
    if (hilft) merken(state, [berth.jetty]);
    events?.push({ type: 'aufGrund', boatId: b.id, berthId: berth.id, steg: berth.jetty, pegel: m, baggernHilft: hilft });
  }
}

/** Hook 'rating': Wer mit dem Kiel im Schlick lag, bewertet schlechter. */
export function ankerMalus(boat) {
  return boat?.aufGrund ? -(NW?.anker ?? 0) : 0;
}

/** Satz für die Bootskarte: liegt heute mit dem Kiel im Schlick, und ob Baggern hilft. */
export function kartenSatz(state, b) {
  if (!b || !state || b.aufGrund == null) return null;
  const anker = (NW?.anker ?? 0).toLocaleString('de-DE');
  if (b.aufGrund === state.day) return `Niedrigwasser: Der Kiel sitzt im Schlick. Die Crew ist unruhig (−${anker} Anker).`;
  return `Lag bei Niedrigwasser mit dem Kiel im Schlick (−${anker} Anker).`;
}

/** Hooks in einen Regel-Kontext hängen (Browser über api.addHook, Werkzeuge über sim.addHook). */
export function haengeEin(addHook, wetter = null) {
  if (!NW) return () => {};
  wetterVon = wetter;
  const ab = [
    addHook('fit', fitHeute),
    addHook('tick', grundTick),
    addHook('rating', ({ boat }) => ankerMalus(boat)),
  ];
  return () => ab.forEach((f) => f?.());
}

// ---------------------------------------------------------------------------
// Im Browser: Geisterbild, dunkleres Wasser über ausgebaggerten Plätzen, Bagger bei der Arbeit

const FARBE = { tief: '#123a66', geist: '#2a6fd1', rand: '#ffffff', ponton: '#5b5f66', deck: '#8a6d3b', kabine: '#e0b12c', arm: '#d39a1c', dach: '#3c3f45', schlamm: '#6b5a3a', schute: '#40464f' };

export async function init(game) {
  const schnittstelle = game.baggern = { angebote: () => [], kaufen: () => ({ ok: false }), geist: () => null, flach: () => 0 };
  const api = await regelnBereit(game);
  const st = () => api.state;
  const ctx = () => api.ctx;
  const sync = () => { if (st()) sim.syncDredge(st(), ctx()); };
  sync();

  for (const ev of ['sim:turnedAway', 'sim:dismissed']) game.on(ev, (e) => { if (e?.zuFlach && st()) merken(st(), e.zuFlach); });
  // Zum Ausprobieren: ?niedrigwasser=jetzt macht den heutigen Tag zu einem Tag mit starkem Westwind-Niedrigwasser
  const erzwungen = typeof location !== 'undefined' && new URLSearchParams(location.search).has('niedrigwasser') ? (st()?.day ?? 1) : null;
  const STARK_WEST = { wind: 1, richtung: 180, event: null, part: 'sommer' };
  const wetter = (tag) => (tag === erzwungen ? STARK_WEST : game.events?.weather?.(tag) ?? null);
  haengeEin(api.addHook, wetter);
  // Pegel aus dem Wetter des Tages (events/events.js meldet es bei jedem Tageswechsel und beim Laden)
  let gesagt = null;
  const melde = (wx) => {
    if (!st() || !wx || typeof wx !== 'object') return;
    if (st().day === erzwungen) wx = STARK_WEST;
    const m = setzePegel(st(), ctx(), wx);
    game.emit('baggern:pegel', { m });
    if (m < 0 && gesagt !== st().day && st().phase !== 'night') {
      gesagt = st().day;
      const cm = Math.round(-m * 100);
      game.banner?.zeige?.('welle', `Niedrigwasser: ${cm} cm unter Mittel`,
        'Westwind drückt das Wasser hinaus. Boote mit viel Tiefgang passen nur an tiefe Plätze.', 8);
    }
  };
  game.on('weather', melde);
  if (erzwungen != null) setTimeout(() => melde(STARK_WEST), 1500);

  const THREE = game.THREE;
  const U = HAFEN.einheiten?.meterProEinheit ?? 0.62;
  let root = null, geistMat = null, randMat = null, tiefMat = null;
  if (THREE && game.scene) {
    root = new THREE.Group();
    root.name = 'baggern';
    game.scene.add(root);
    geistMat = new THREE.MeshBasicMaterial({ color: FARBE.geist, transparent: true, opacity: 0.45, depthWrite: false });
    randMat = new THREE.LineBasicMaterial({ color: FARBE.rand });
    // depthWrite mit LessDepth: wo sich zwei Plätze überlappen, wird nicht doppelt abgedunkelt
    tiefMat = new THREE.MeshBasicMaterial({ color: FARBE.tief, transparent: true, opacity: 0.2, depthWrite: true, depthFunc: THREE.LessDepth, polygonOffset: true, polygonOffsetFactor: -1 });
  }

  // Fläche eines Platzes auf dem Wasser (aus den Hafendaten der aktuellen Stufe)
  function flaeche(id, mat, hoehe, rand = false, gross = 1) {
    const p = HAFEN.plaetze.find((q) => q.id === id);
    const l = p?.lage?.[String(st()?.stage)];
    if (!l) return null;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(p.laenge * U * gross, p.breite * U * gross), mat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = (l[2] * Math.PI) / 180;
    m.position.set(l[0] * U, hoehe, -l[1] * U);
    m.renderOrder = 11;
    if (rand) m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), randMat));
    return m;
  }

  // Geisterbild für die Vorschau: die Plätze, die tiefer werden, blau mit weißem Rand
  function geist(steg) {
    if (!THREE || !st()) return null;
    const g = new THREE.Group();
    for (const { berth } of betroffen(st(), ctx(), steg)) {
      const m = flaeche(berth.id, geistMat, 0.12, true, 0.96);
      if (m) g.add(m);
    }
    return g.children.length ? g : null;
  }

  // Dauerhaft: etwas dunkleres Wasser über den ausgebaggerten Plätzen (wie die dunkle Rinne im Luftbild)
  const tiefGruppe = root ? new THREE.Group() : null;
  if (tiefGruppe) { tiefGruppe.name = 'baggern-tief'; root.add(tiefGruppe); }
  function zeichneTief() {
    if (!tiefGruppe || !st()) return;
    for (const c of [...tiefGruppe.children]) { tiefGruppe.remove(c); c.geometry?.dispose?.(); }
    const stege = new Set(sim.dredgedJetties(st()));
    if (!stege.size) return;
    for (const b of ctx().berths) {
      if (!stege.has(b.jetty) || !sim.berthAvailable(st(), b) || !(b.gebaggert > 0)) continue;
      // Nur wo das Baggern wirklich etwas tiefer gemacht hat
      if (sim.naturalDepth(b, st().stage) + 1e-9 >= b.gebaggert) continue;
      const m = flaeche(b.id, tiefMat, 0.06, false, 1.04);
      if (m) tiefGruppe.add(m);
    }
  }
  // Neu zeichnen, wenn sich die ausgebaggerten Stege ändern (Bauen, Rückgängig, Laden) oder die Stege neu stehen
  let gezeichnet = null, fuer = null;
  const vielleicht = () => {
    if (!st()) return;
    sync();
    const k = `${sim.dredgedJetties(st()).join(',')}|${st().stage}`;
    if (k !== gezeichnet || fuer !== st()) { gezeichnet = k; fuer = st(); zeichneTief(); }
  };
  for (const ev of ['sim:change', 'build']) game.on(ev, vielleicht);
  game.on('stege', () => { sync(); zeichneTief(); });
  zeichneTief();

  // Niedrigwasser: aufgewirbelter Schlick um Boote, deren Kiel heute den Grund berührt
  const schlickGruppe = root ? new THREE.Group() : null;
  const schlickMat = THREE ? new THREE.MeshBasicMaterial({ color: FARBE.schlamm, transparent: true, opacity: 0.6, depthWrite: false }) : null;
  if (schlickGruppe) { schlickGruppe.name = 'baggern-schlick'; root.add(schlickGruppe); }
  function zeichneSchlick() {
    if (!schlickGruppe || !st()) return;
    for (const c of [...schlickGruppe.children]) { schlickGruppe.remove(c); c.traverse((o) => o.geometry?.dispose?.()); }
    if (!(pegelHeute(st()) < 0)) return;
    for (const b of Object.values(st().boats)) {
      if (b.aufGrund !== st().day || b.status !== 'moored' || !b.berthId) continue;
      // Wo das Boot wirklich liegt (Bootsansicht), sonst die Mitte des Platzes
      const a = game.boatView?.boot?.(b.id);
      const p = game.stege?.platz?.(b.berthId);
      const lage = a && Number.isFinite(a.x) && Number.isFinite(a.z) ? { x: a.x, z: a.z, h: a.heading ?? 0 }
        : p ? { x: p.x, z: p.z, h: THREE.MathUtils.degToRad(p.richtung) } : null;
      if (!lage) continue;
      const g = new THREE.Group();
      g.position.set(lage.x, 0.09, lage.z);
      g.rotation.y = lage.h;
      // Braune Wolke etwas größer als der Rumpf: der Rand schaut rundum hervor
      const m = new THREE.Mesh(new THREE.CircleGeometry(1, 24), schlickMat);
      m.rotation.x = -Math.PI / 2;
      m.scale.set(Math.max(2.5, (b.length ?? 8) * 0.68 + 0.8), Math.max(1.6, (b.beam ?? 3) * 0.75 + 0.9), 1);
      m.renderOrder = 12;
      g.add(m);
      schlickGruppe.add(g);
    }
  }
  for (const ev of ['sim:aufGrund', 'sim:castOff', 'sim:dayStart', 'sim:departed', 'baggern:pegel', 'stege']) game.on(ev, zeichneSchlick);

  // Bagger bei der Arbeit: Stelzenponton mit Bagger und Schute neben dem Steg, Schaufel taucht ein, brauner
  // Schlamm breitet sich aus, nach ein paar Sekunden zieht der Bagger ab. Echte Zeit, weil das Baumenü die
  // Spielzeit anhält.
  let arbeit = null;
  function bagger(steg, ids) {
    if (!THREE || !root) return;
    if (arbeit) { root.remove(arbeit.g); arbeit = null; }
    // In der flachsten freien Box arbeiten; liegt überall jemand, vor der flachsten Box im Wasser
    const tiefe = (id) => { const b = ctx().berthById[id]; return b ? sim.naturalDepth(b, st().stage) : 9; };
    const sortiert = [...ids].sort((a, b) => tiefe(a) - tiefe(b));
    const freiId = sortiert.find((id) => sim.isFree(st(), id) && game.stege?.platz?.(id));
    const p = game.stege?.platz?.(freiId ?? sortiert[0]);
    if (!p) return;
    const rad = THREE.MathUtils.degToRad(p.richtung);
    const bug = new THREE.Vector3(Math.cos(rad), 0, -Math.sin(rad));
    const pos = new THREE.Vector3(p.x, 0, p.z).addScaledVector(bug, freiId ? -1 : -(p.laenge ?? 8) * 0.9);
    const mat = (c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
    const g = new THREE.Group();
    g.position.copy(pos);
    g.rotation.y = rad;
    const ponton = new THREE.Mesh(new THREE.BoxGeometry(7, 0.9, 4), mat(FARBE.ponton));
    ponton.position.y = 0.2;
    g.add(ponton);
    for (const [x, z] of [[-3, -1.7], [-3, 1.7], [3, 0]]) {
      const stelze = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 6, 6), mat(FARBE.dach));
      stelze.position.set(x, 1.5, z);
      g.add(stelze);
    }
    const kabine = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 1.8), mat(FARBE.kabine));
    kabine.position.set(-0.8, 1.45, 0);
    g.add(kabine);
    const dach = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.15, 2), mat(FARBE.dach));
    dach.position.set(-0.8, 2.3, 0);
    g.add(dach);
    // Ausleger und Stiel drehen sich um ein Gelenk an der Kabine
    const gelenk = new THREE.Group();
    gelenk.position.set(0.3, 1.6, 0);
    g.add(gelenk);
    const ausleger = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.35, 0.35), mat(FARBE.arm));
    ausleger.position.x = 2.1;
    gelenk.add(ausleger);
    const knie = new THREE.Group();
    knie.position.x = 4.2;
    gelenk.add(knie);
    const stiel = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3, 0.3), mat(FARBE.arm));
    stiel.position.y = -1.5;
    knie.add(stiel);
    const schaufel = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.9), mat(FARBE.dach));
    schaufel.position.y = -3.1;
    knie.add(schaufel);
    // Schute für den Aushub, hinter dem Ponton (in der Gasse, nicht in der Nachbarbox)
    const schute = new THREE.Mesh(new THREE.BoxGeometry(5, 0.7, 2.6), mat(FARBE.schute));
    schute.position.set(-6.4, 0.1, 0);
    g.add(schute);
    const aushub = new THREE.Mesh(new THREE.BoxGeometry(4, 0.3, 2), mat(FARBE.schlamm));
    aushub.position.set(-6.4, 0.45, 0);
    aushub.scale.y = 0.01;
    g.add(aushub);
    // Schlammwolken im Wasser
    const wolken = [];
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(new THREE.CircleGeometry(1, 20), new THREE.MeshBasicMaterial({ color: FARBE.schlamm, transparent: true, opacity: 0, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(4.4, 0.08, 0);
      m.renderOrder = 12;
      g.add(m);
      wolken.push(m);
    }
    root.add(g);
    const t0 = performance.now();
    const DAUER = 7000;
    arbeit = { g };
    const eigene = arbeit;
    let platsch = 0;
    const schritt = (jetzt) => {
      if (arbeit !== eigene) return;
      const t = (jetzt - t0) / 1000;
      const zyklus = (t % 2.2) / 2.2;   // ein Hub: senken, graben, heben, zur Schute schwenken
      const senk = Math.sin(zyklus * Math.PI);
      gelenk.rotation.z = 0.35 - senk * 0.75;
      knie.rotation.z = -0.4 + senk * 0.5;
      gelenk.rotation.y = zyklus > 0.6 ? Math.sin((zyklus - 0.6) / 0.4 * Math.PI) * 2.6 : 0;   // zur Schute schwenken und zurück
      if (zyklus > 0.45 && zyklus < 0.5 && t - platsch > 1) { platsch = t; game.audio?.sfx?.('platsch'); }
      aushub.scale.y = Math.min(1, t / (DAUER / 1000));
      wolken.forEach((w, i) => {
        const a = ((t + i * 0.7) % 2.1) / 2.1;
        w.scale.setScalar(0.6 + a * 4);
        w.material.opacity = 0.35 * (1 - a);
      });
      // Ein- und Ausblenden: der Ponton hebt sich aus dem Wasser und sinkt am Ende weg
      const ein = Math.min(1, t / 0.6), aus = Math.max(0, Math.min(1, (DAUER / 1000 - t) / 0.8));
      g.position.y = -2 * (1 - Math.min(ein, aus));
      if (jetzt - t0 < DAUER) requestAnimationFrame(schritt);
      else { root.remove(g); g.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); }); arbeit = null; }
    };
    requestAnimationFrame(schritt);
  }

  function machen(steg) {
    const r = kaufen(st(), ctx(), steg, (k) => api.spend(k, 'bau'));
    if (r.ok) {
      game.emit('build', { id: KEY(steg), level: 1 });
      game.emit('sim:change', { reason: 'baggern' });
      game.emit('baggern:fertig', { steg, kosten: r.angebot.kosten, plaetze: r.angebot.plaetze });
      bagger(steg, r.angebot.plaetze);
    }
    return { ...r, geldFehlt: r.grund === 'geld' };
  }

  Object.assign(schnittstelle, {
    angebote: () => (st() ? angebote(st(), ctx()) : []),
    kaufen: machen,
    geist,
    flach: (steg) => flachZahl(st(), steg),
    pegel: () => pegelHeute(st()),
    kartenSatz: (b) => kartenSatz(st(), b),
  });
}

export default init;
