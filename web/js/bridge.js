// Verbindet die Spielregeln (sim.js, state.js) mit dem Spielobjekt `game` aus dem Grundgerüst.
// Wird von state.js beim Start geladen (main.js ruft init(game) aus state.js auf).
// Schnittstelle für andere Module: docs/spielregeln.md

import * as sim from './sim.js';
import { createState, deserialize } from './state.js';
import { HAFEN, platzInWelt } from './data/harbor.js';
import { BOAT_CATALOG } from './data/boat-catalog.js';
import { ECONOMY } from './data/economy.js';
import { GROSSSCHIFF_BESUCHE } from './data/services.js';

const BOAT_FILES = ['./data/boats/s.js', './data/boats/m.js', './data/boats/l.js', './data/boats/xl.js', './data/boats/xxl.js'];

/** Bootsarten aus einem Datenmodul herausholen, egal ob als default, Liste oder Objekt mit Liste exportiert. */
export function typesFromModule(mod) {
  // Format der Schiffs-Threads: TYPES (Arten) und MODELS (Modelle mit typeId), Größe steckt in der id (M1, XL2)
  if (Array.isArray(mod.TYPES)) {
    const models = Array.isArray(mod.MODELS) ? mod.MODELS : [];
    return mod.TYPES.map((t) => ({
      ...t,
      size: t.size ?? String(t.id).match(/^[A-Z]+/)?.[0],
      models: t.models ?? models.filter((m) => m.typeId === t.id),
    }));
  }
  const out = [];
  const looksLikeType = (o) => o && typeof o === 'object' && o.id && (o.size || o.groesse || o.klasse);
  const visit = (v, depth = 0) => {
    if (depth > 2 || !v) return;
    if (Array.isArray(v)) v.forEach((x) => (looksLikeType(x) ? out.push(x) : visit(x, depth + 1)));
    else if (looksLikeType(v)) out.push(v);
    else if (typeof v === 'object') Object.values(v).forEach((x) => visit(x, depth + 1));
  };
  visit(mod.default ?? Object.values(mod));
  return out;
}

/** Ersatzkatalog mit den Daten der Schiffs-Threads mischen; gleiche id: die Datei gewinnt, fehlende Felder kommen aus dem Katalog. */
export function mergeTypes(catalog, loaded) {
  const byId = new Map(catalog.map((t) => [t.id, t]));
  for (const t of loaded) byId.set(t.id, { ...(byId.get(t.id) || {}), ...t });
  return [...byId.values()];
}

async function loadBoatTypes() {
  const results = await Promise.allSettled(BOAT_FILES.map((f) => import(f)));
  const loaded = results.filter((r) => r.status === 'fulfilled').flatMap((r) => typesFromModule(r.value));
  return mergeTypes(BOAT_CATALOG, loaded);
}

/** Deutsche Namen, die andere Module erwarten (docs/grundgeruest.md), als Verweise auf die Felder der Regeln. */
function addAliases(state) {
  const alias = (name, key) =>
    Object.defineProperty(state, name, {
      get: () => state[key],
      set: (v) => (state[key] = v),
      enumerable: false,
      configurable: true,
    });
  alias('stufe', 'stage');
  alias('geld', 'money');
  alias('tag', 'day');
  return state;
}

function boatIdOf(v) {
  if (v == null) return null;
  if (typeof v === 'object') return boatIdOf(v.boatId ?? v.boat ?? v.id);
  const n = Number(String(v).replace(/^b/, ''));
  return Number.isFinite(n) ? n : null;
}

function berthIdOf(v) {
  if (v == null) return null;
  if (typeof v === 'object') return berthIdOf(v.berthId ?? v.berth ?? (v.type === 'berth' ? v.id : null));
  return String(v);
}

export async function initBridge(game) {
  const boatTypes = await loadBoatTypes();
  // Zahlen aus dem Balancing (economy.js), was dort fehlt, aus rules.js
  const ctx = sim.createContext({ boatTypes, harbor: HAFEN, rules: sim.rulesFromEconomy(ECONOMY) });
  let state = null;
  let selected = null; // ausgewähltes wartendes Boot

  // Entfernung von der Warteboje eines Boots zu einem Liegeplatz (Weltkoordinaten), damit sich
  // Gäste beim Selbst-Einfahren die nächste freie Box suchen. Ohne Landschaft: Reihenfolge am Steg.
  const platzById = Object.fromEntries(HAFEN.plaetze.map((p) => [p.id, p]));
  ctx.berthDistance = (boat, berth, st) => {
    const boje = game.landscape?.warteplaetze?.bojen?.[boat.waitSpot ?? 0];
    const p = platzById[berth.id];
    if (!boje || !p) return null;
    const w = platzInWelt(p, st.stage);
    return w ? Math.hypot(w.x - boje.x, w.z - boje.z) : null;
  };

  // Modifikatoren der Module Ereignisse und Services abfragen, falls es sie gibt
  sim.addHook(ctx, 'modifiers', () => game.events?.modifiers?.());
  sim.addHook(ctx, 'modifiers', () => game.services?.effekte?.());

  function setState(next) {
    state = addAliases(next);
    if (!state.region) state.region = HAFEN.region || 'ostsee';
    if (!state.modules) state.modules = {};
    sim.settleWaiting(state);
    game.state = state;
    selected = null;
  }

  function persist() {
    if (state.testmodus) return; // Testmodus ?stufe=n lässt den echten Spielstand in Ruhe
    game.spielstand?.speichern?.(state); // ein Speicherweg: web/js/save/ (docs/speichern.md)
  }

  function announce() {
    game.emit('stufe', state.stage);
    game.emit('region', state.region);
    emitPhase();
    game.emit('sim:berthState', { plaetze: sim.berthStates(state, ctx) });
    game.emit('sim:change', { reason: 'load' });
  }

  function emitPhase() {
    const phase = state.phase === 'evening' ? 'abend' : 'tag';
    if (typeof document !== 'undefined') document.body.dataset.phase = phase;
    game.emit('phase', phase);
  }

  // Kurzbeschreibung eines Boots für Grafik und Figuren
  function bootInfo(b) {
    return {
      id: b.id, groesse: b.size, art: b.typeId, modell: b.modelId, palette: b.id % 4, name: b.name, herkunft: b.origin ?? null,
      platz: b.berthId, boje: b.waitSpot, zustand: b.status === 'moored' ? 'liegt' : b.status === 'waiting' ? 'wartet' : 'kommt',
      bezahlt: b.status === 'moored' ? (b.stationed ? true : b.paid !== false && !(b.pendingFee > 0)) : false, offen: b.pendingFee || 0,
    };
  }

  // Nach diesen Ereignissen kann sich das Grün-Rot-Schild eines Platzes geändert haben
  const BERTH_EVENTS = new Set(['relocated', 'moored', 'departed', 'castOff', 'berthFreed', 'tripOut', 'tripBack', 'built', 'stageUp', 'stationed', 'unstationed', 'dayStart']);
  let berthsChanged = false;

  function dispatch(events) {
    if (!events || !events.length) return;
    for (const e of events) {
      game.emit(`sim:${e.type}`, e);
      // Deutsche Ereignisse für Grafik und Figuren (docs/spielregeln.md)
      if (e.type === 'arrived' && state.boats[e.boatId]) game.emit('boot-kommt', bootInfo(state.boats[e.boatId]));
      if (e.type === 'moored' && state.boats[e.boatId]) {
        const info = bootInfo(state.boats[e.boatId]);
        game.emit('boot-zugewiesen', { id: info.id, platz: info.platz });
        game.emit('boot:angelegt', info);
      }
      // Abreisende Gäste legen erst am Vormittag ab ('castOff'), abgerechnet sind sie schon nachts ('departed')
      const gone = e.type === 'departed' ? !(e.leaveAt > 0) : e.type === 'castOff' || e.type === 'turnedAway' || e.type === 'dismissed' || e.type === 'unstationed';
      if (gone) {
        game.emit('boot-faehrt', { id: e.boatId, platz: e.berthId ?? null });
        game.emit('boot:ablegen', { id: e.boatId });
      }
      // Stufenausbau: ein fest liegendes Boot zieht auf einen neuen Platz um
      if (e.type === 'relocated') game.emit('boot-zugewiesen', { id: e.boatId, platz: e.to, umzug: true });
      // Stufenausbau mit weniger Bojen: ein wartendes Boot verholt an eine andere Boje
      if (e.type === 'waitSpotChanged') game.emit('boot:boje', { id: e.boatId, boje: e.waitSpot });
      // Tagestörn eines Gastes: gleiche Ereignisse wie die Runde der Dauerlieger
      if (e.type === 'tripOut') game.emit('dauer:auslaufen', { id: e.boatId, platzId: e.berthId, tage: 0, gast: true });
      if (e.type === 'tripBack') game.emit('dauer:einlaufen', { id: e.boatId, platzId: e.berthId, gast: true });
      if (BERTH_EVENTS.has(e.type)) berthsChanged = true;
      switch (e.type) {
        case 'dayStart':
          game.emit('day:start', { day: e.day, stage: e.stage, winter: e.winter });
          emitPhase();
          break;
        case 'evening':
          emitPhase();
          game.emit('tag:ende', {
            tag: state.day,
            stufe: state.stage,
            ruf: sim.reputation(state),
            boote: sim.mooredBoats(state).map((b) => ({
              id: b.id, art: b.typeId, kind: b.kind, klasse: b.size, antrieb: b.motor ? 'motor' : ctx.typeById[b.typeId]?.sail ? 'segel' : 'ruder',
            })),
          });
          break;
        case 'dayEnd':
          persist();
          break;
        case 'stageUp':
          game.emit('stage', { stage: e.stage });
          game.emit('stufe', e.stage);
          break;
        case 'built':
          game.emit('build', { id: e.id, level: e.level });
          break;
        default:
      }
    }
    if (berthsChanged) {
      berthsChanged = false;
      game.emit('sim:berthState', { plaetze: sim.berthStates(state, ctx) });
    }
    game.emit('sim:change', { events });
  }

  // Aktionen für Oberfläche und Eingabe. Jede gibt das Ergebnis der Regel zurück und meldet Ereignisse.
  const run = (fn) => (...args) => {
    const r = fn(...args);
    const events = Array.isArray(r) ? r : r?.events;
    dispatch(events);
    return r;
  };

  const api = {
    get ctx() { return ctx; },
    get state() { return state; },
    get selected() { return selected; },
    select(boatId) {
      const id = boatIdOf(boatId);
      // Ein ausgewähltes Boot fährt nicht von selbst ein, solange der Spieler es lenkt
      if (selected != null) sim.holdBoat(state, selected, false);
      selected = state.boats[id]?.status === 'waiting' ? id : null;
      if (selected != null) sim.holdBoat(state, selected, true);
      const berths = selected ? sim.fittingBerths(state, ctx, selected) : [];
      game.emit('sim:select', { boatId: selected, berths });
      return berths;
    },
    assign: run((boatId, berthId) => {
      const r = sim.assign(state, ctx, boatIdOf(boatId), berthIdOf(berthId));
      if (r.ok) selected = null;
      else game.emit('sim:assignFailed', { boatId: boatIdOf(boatId), berthId: berthIdOf(berthId), reason: r.reason });
      return r;
    }),
    autoAssign: run(() => sim.autoAssign(state, ctx)),
    autoEnter: run((boatId) => sim.autoEnter(state, ctx, boatIdOf(boatId))),
    // Vorspulen: Spielzeit springt vor, höchstens bis zum nächsten Wechsel (Abend oder Morgen),
    // damit niemand Münzen oder Boote verpasst. Dauerhaft schneller: game.speed.
    fastForward(seconds) {
      const r = ctx.rules;
      const end = state.phase === 'day' ? r.dayLength : r.dayLength + r.eveningLength;
      dispatch(sim.tick(state, ctx, Math.max(0, Math.min(seconds, end - state.clock))));
    },
    dismiss: run((boatId) => {
      const id = boatIdOf(boatId);
      if (selected === id) selected = null;
      return sim.dismiss(state, ctx, id);
    }),
    // Münze vom Spieler selbst eingestrichen (Tippen, Strich): zählt für Tagesziele, große Boote geben Trinkgeld
    collect: run((boatId) => sim.collect(state, ctx, boatIdOf(boatId), { hand: true })),
    collectAll: run((force = true) => sim.collectAll(state, ctx, force)),
    upgradeFacility: run((key) => sim.upgradeFacility(state, ctx, key)),
    upgradeOffice: run(() => sim.upgradeOffice(state, ctx)),
    build: run((id, cost, level) => sim.build(state, id, cost, level)),
    buildJettyProject: run((id) => sim.buildJettyProject(state, ctx, id)),
    openJettyProjects: () => sim.openJettyProjects(state, ctx),
    advanceStage: run((opts) => sim.advanceStage(state, ctx, opts)),
    stationBoat: run((typeId, berthId, modelId) => sim.stationBoat(state, ctx, typeId, berthId, modelId)),
    // zweck und quelle ordnen Beträge im Tagesabschluss ein (sim.QUELLEN, docs/tagesabschluss.md)
    spend: (amount, zweck = 'bau') => {
      const ok = sim.spend(state, amount, zweck);
      if (ok) game.emit('sim:change', { reason: 'spend' });
      return ok;
    },
    addIncome: (amount, quelle = 'sonstiges', detail = null) => {
      sim.addIncome(state, amount, quelle, detail);
      game.emit('sim:change', { reason: 'income' });
    },
    setRegion(region) {
      state.region = region;
      game.emit('region', region);
    },
    newGame(seed) {
      setState(testStufe >= 1 ? sim.applyTestStage(createState({ seed, rules: ctx.rules }), ctx, testStufe) : createState({ seed }));
      announce();
    },
    addHook: (name, fn) => sim.addHook(ctx, name, fn),
    // Ereignisse anderer Module so melden wie die der Regeln (sim:<type>, sim:change)
    dispatch: (events) => dispatch(events),
    addService: (key, def) => sim.addService(ctx, key, def),
    // Lesen
    reputation: () => sim.reputation(state),
    fittingBerths: (boatId) => sim.fittingBerths(state, ctx, boatIdOf(boatId)),
    // Hafenbüro: Grund, warum die Automatik dieses Boot dem Spieler lässt, oder null
    sonderfall: (boatId) => {
      const b = state.boats[boatIdOf(boatId)];
      // Ab den Vorschlägen des Büros (Stufe 3); mit Leitstelle nur in Klassen, die sie zuweist
      if (!b || state.office < (ctx.rules.office.propose ?? Infinity)) return null;
      if (sim.officeAutomatic(state, ctx) && !sim.officeAutoFor(state, ctx, b.size)) return null;
      return sim.officeSpecialCase(state, ctx, b.id);
    },
    // Vorschlag des Büros (Platz-id) für ein wartendes Boot oder null
    vorschlag: (boatId) => sim.officeProposal(state, ctx, boatIdOf(boatId)),
    // Welche Platz-Wünsche des Boots (Strom ...) diese Box erfüllt
    platzWuensche: (boatId, berthId) => {
      const b = state.boats[boatIdOf(boatId)];
      const p = ctx.berthById[berthIdOf(berthId)];
      if (!b || !p) return [];
      return b.wishes.filter((w) => ctx.rules.berthWishes[w] && sim.berthHas(state, ctx, p, ctx.rules.berthWishes[w]));
    },
    // Automatik des Büros je Größenklasse
    bueroAutomatik: (size) => sim.officeAutoFor(state, ctx, size),
    setBueroAutomatik: run((size, on) => sim.setOfficeAuto(state, size, on)),
    whyNotFit: (boatId, berthId) => {
      const b = state.boats[boatIdOf(boatId)];
      const p = ctx.berthById[berthIdOf(berthId)];
      return b && p ? sim.whyNotFit(b, p, ctx.rules, state.stage) : 'unknown';
    },
    availableBerths: () => sim.availableBerths(state, ctx),
    waitingBoats: () => sim.waitingBoats(state),
    waitSpotCount: () => sim.waitSpotCount(state, ctx),
    mooredBoats: () => sim.mooredBoats(state),
    preview: () => sim.preview(state, ctx),
    season: () => sim.season(state, ctx),
    canAdvanceStage: () => sim.canAdvanceStage(state, ctx),
    facilityUpgrade: (key) => sim.facilityUpgrade(state, ctx, key),
    modifiers: () => sim.modifiers(state, ctx),
    // Deutsche Namen für die Gesten-Module
    // Alle Boote, die gerade da sind (wartend oder liegend), zum Aufbauen nach dem Laden
    get boote() { return Object.values(state.boats).filter((b) => b.status !== 'expected').map(bootInfo); },
    // Anteil des Tages von 0 (Morgen) bis 1 (Nacht), für die Sonne im Tagesbalken
    // Restliche Geduld eines wartenden Boots in Sekunden (für eine Anzeige an der Boje)
    geduld: (boatId) => sim.patienceLeft(state, ctx, boatIdOf(boatId)),
    // Läuft die Geduld gerade? (abends, auf der Anfahrt und vor dem Morgen nach einer Nacht an der Boje nicht)
    geduldLaeuft: (boatId) => sim.patienceRunning(state, ctx, boatIdOf(boatId)),
    // Ruht die Geduld? Abends und nach einer Nacht an der Boje bis zum Vormittag (nicht während der Anfahrt am Tag)
    geduldRuht: (boatId) => {
      const b = state.boats[boatIdOf(boatId)];
      if (!b || b.status !== 'waiting') return false;
      return state.phase !== 'day' || (!!b.atBuoy && !sim.patienceRunning(state, ctx, b.id));
    },
    // Versorgung heute: { wc: { versorgt, kapazitaet }, ... } für gebaute Versorgung (Auslastung am Gebäude)
    auslastung: () => sim.facilityLoad(state, ctx),
    /** Anteil, den der Hafenmeister für liegengebliebene Münzen abliefert (0,8 = vier Fünftel). */
    rundgangAnteil: () => sim.roundShare(ctx),
    tagesAnteil: () => Math.min(1, state.clock / (ctx.rules.dayLength + ctx.rules.eveningLength)),
    wartet: (boatId) => state.boats[boatIdOf(boatId)]?.status === 'waiting',
    // Grün-Rot-Schild: 'frei' | 'belegt' | 'ausflug' | 'reserviert' | 'aus'
    platzZustand: (berthId) => sim.berthState(state, ctx, berthIdOf(berthId)),
    platzZustaende: () => sim.berthStates(state, ctx),
    aufAusflug: (boatId) => !!state.boats[boatIdOf(boatId)]?.trip?.away,
    regionGoal: () => sim.regionGoal(state, ctx),
    stageUpPreview: () => sim.stageUpPreview(state, ctx),
    holdBoat: (boatId, held = true) => sim.holdBoat(state, boatIdOf(boatId), held),
    // Hat das Boot sein Liegegeld für die kommende Nacht bezahlt? (Bändchen am Bug, Hafenmeister-Rundgang)
    istBezahlt: (boatId) => {
      const id = boatIdOf(boatId);
      const b = state.boats[id];
      // Abgerechnete Gäste (nachts) liegen bis zum Ablegen am Vormittag noch in der Box: bezahlt
      if (!b) return Object.values(state.leaving || {}).some((l) => String(l.boatId) === String(id));
      return b.status === 'moored' && (b.stationed || (b.paid !== false && !(b.pendingFee > 0)));
    },
    passendePlaetze: (boatId) => sim.fittingBerths(state, ctx, boatIdOf(boatId)),
    // Zuweisen als Entscheidung (P10): Plätze, die einen Platz-Wunsch erfüllen (leuchten gold),
    // und was ein Platz bringt: { fee, wishesMet, wishes, anchors, snug } (ohne Platz: Grundwert)
    wunschPlaetze: (boatId) => sim.wishBerths(state, ctx, boatIdOf(boatId)),
    platzWert: (boatId, berthId = null) => sim.berthValue(state, ctx, boatIdOf(boatId), berthId == null ? null : berthIdOf(berthId)),
    // Auszeichnung des Hafens (P19 C5): { level, name, up, down, best, next, days, hold }
    auszeichnung: () => sim.award(state, ctx.rules),
  };
  game.sim = api;

  // Spielstand des aktiven Speicherplatzes (game.spielstand, web/js/save/), sonst neu
  function loadSaved() {
    try {
      const r = game.spielstand?.laden?.();
      if (r?.game) return pruefen(deserialize(JSON.stringify(r.game)));
    } catch (err) {
      console.warn('Spielstand nicht lesbar, neues Spiel', err);
    }
    return null;
  }
  // Alte Stände: Gäste in Boxen, die es nicht mehr gibt oder die zu flach sind, legen um (sim.repairBerths)
  function pruefen(st) {
    const changes = sim.repairBerths(st, ctx);
    if (changes.length) console.info('Spielstand geprüft, Boote umgelegt:', changes);
    return st;
  }
  // Testmodus ?stufe=n: frischer Spielstand dieser Stufe (alles bis dahin gebaut), der echte
  // gespeicherte Spielstand wird weder geladen noch überschrieben. Ohne Parameter wie gehabt.
  const testStufe = typeof location !== 'undefined' ? Number(new URLSearchParams(location.search).get('stufe')) : 0;
  const testState = () => sim.applyTestStage(createState({ rules: ctx.rules }), ctx, testStufe);
  if (testStufe >= 1) setState(testState());
  else setState(loadSaved() ?? createState());

  game.on('spielstand-geladen', (next) => {
    try {
      setState(pruefen(deserialize(JSON.stringify(next))));
      announce();
    } catch (err) {
      console.error('Geladener Spielstand passt nicht zu den Regeln', err);
    }
  });

  // Absichten aus den Eingabe-Modulen
  game.on('tap', ({ pick } = {}) => {
    if (!pick) return;
    if (pick.type === 'boat') {
      const id = boatIdOf(pick.id);
      const boat = state.boats[id];
      if (boat?.pendingFee > 0) api.collect(id);
      else if (boat?.status === 'waiting') api.select(id);
    } else if (pick.type === 'coin') {
      api.collect(pick.id);
    } else if (pick.type === 'berth' && selected != null) {
      api.assign(selected, pick.id);
    }
  });
  // 3D-Ansicht meldet: Boot ist an der Warteboje fest, ab jetzt zählt seine Geduld
  game.on('boot:an-boje', (d = {}) => {
    const id = boatIdOf(d.id ?? d.boot ?? d);
    if (id != null) dispatch(sim.markAtBuoy(state, ctx, id).events);
  });
  // 3D-Ansicht meldet: abreisendes Boot ist aus der Box heraus, der Platz ist wieder frei
  game.on('boot:aus-box', (d = {}) => {
    const boatId = boatIdOf(d.id ?? d.boot ?? null);
    const berthId = d.platz ?? null;
    if (boatId == null && berthId == null) return;
    dispatch(sim.berthCleared(state, ctx, { boatId, berthId }).events);
  });
  // 3D-Ansicht meldet: abreisendes Boot liegt noch in der Box (Box bleibt belegt, Rückfallzeit neu)
  game.on('boot:noch-in-box', (d = {}) => {
    const boatId = boatIdOf(d.id ?? d.boot ?? null);
    if (boatId != null) sim.holdLeaving(state, boatId);
  });
  game.on('ui:cancel', () => api.select(null));
  // Münzen einstreichen: mit { coin } nur diese Münze (coin = Boot-id), sonst alle (Hafenhorn)
  // Kassierstrich (ui/gesten.js): combo zählt die Münzen im Zug, am Ende 'ui:strich-ende'.
  // Ab rules.strokeTip.from Münzen gibt es Trinkgeld auf die eingestrichene Summe (sim:strokeTip).
  let strich = { n: 0, sum: 0 };
  game.on('ui:collect', (d = {}) => {
    const id = boatIdOf(d?.coin ?? d?.boat ?? null);
    if (id == null) { api.collectAll(true); return; }
    if (!(d.combo > 1)) strich = { n: 0, sum: 0 };
    const r = api.collect(id);
    // Trinkgeld auf das Liegegeld, nicht auf Zuschläge des Hafenbüros (tip, extras)
    const c = r?.events?.find((e) => e.type === 'collected');
    const amount = c ? c.amount - (c.tip || 0) - (c.extras || 0) : 0;
    if (r?.ok && d.combo) { strich.n++; strich.sum += amount; }
  });
  game.on('ui:strich-ende', () => {
    const s = strich;
    strich = { n: 0, sum: 0 };
    if (s.n > 0) dispatch(sim.strokeTip(state, ctx, s.n, s.sum).events);
  });
  game.on('ui:auto-einfahren', (d = {}) => {
    const id = boatIdOf(d.boot ?? d.boat ?? d.boatId) ?? selected;
    if (id != null) api.autoEnter(id);
  });
  game.on('ui:tow', (d = {}) => {
    const id = boatIdOf(d.boot ?? d.boat ?? d.boatId ?? d.pick ?? d);
    if (id != null && state.boats[id]?.status === 'waiting' && selected !== id) api.select(id);
  });
  game.on('ui:tow-end', (d = {}) => {
    const boatId = boatIdOf(d.boot ?? d.boat ?? d.boatId) ?? selected;
    const berthId = berthIdOf(d.platz ?? d.berth ?? d.berthId ?? (d.pick?.type === 'berth' ? d.pick.id : null) ?? d.target);
    if (boatId != null && berthId) api.assign(boatId, berthId);
  });
  // Besuche großer Schiffe zählen für das Abschlussziel der Region (Liste in data/services.js,
  // auch der Tag der offenen Tür des Marinestützpunkts zählt). Einziger Zähler: state.bigVisits.
  game.on('services:besuch', (b = {}) => {
    if (GROSSSCHIFF_BESUCHE.includes(b.art)) dispatch(sim.addBigVisit(state, ctx));
  });
  // Hafenmeister-Rundgang am Abend (render/people.js): Wer noch nicht bezahlt hat, zahlt jetzt (vier Fünftel kommen an)
  game.on('hafenmeister:halt', (d = {}) => {
    const id = boatIdOf(d.boot ?? d.id);
    if (id != null) dispatch(sim.collectOnRound(state, ctx, id).events);
  });
  // Abrechnung des Services-Moduls am Tagesende
  game.on('services:abrechnung', (a = {}) => {
    const sum = Number(a.summe) || 0;
    // Je Anlage einzeln buchen, damit der Tagesabschluss die Services aufschlüsseln kann
    const posten = Array.isArray(a.einnahmen) ? a.einnahmen.filter((e) => Number(e?.betrag) > 0) : [];
    const teil = posten.reduce((x, e) => x + Number(e.betrag), 0);
    if (sum > 0 && teil === sum) {
      for (const e of posten) sim.addIncome(state, Number(e.betrag), 'services', String(e.id));
      game.emit('sim:change', { reason: 'income' });
    } else if (sum > 0) api.addIncome(sum, 'services');
    else if (sum < 0) api.spend(Math.min(state.money, -sum), 'services');
  });

  // Bericht des laufenden Tages (Einnahmen je Quelle bis jetzt) und die letzten Tage
  api.tagesbericht = () => sim.tagesbericht(state, ctx);
  api.verlauf = () => [...(state.stats.verlauf || [])];

  game.onTick((dt) => dispatch(sim.tick(state, ctx, dt)));
  game.on('ready', announce);
  announce();
  return api;
}
