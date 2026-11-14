// Ereignisse im Spiel: verbindet den Planer (scheduler.js) mit dem Spielobjekt.
// Wird von main.js geladen (Eintrag './events/events.js' in MODULES).
//
// Eingänge (von der Sim und vom Bauen):
//   game.emit('day:start', { day, stage })   neuer Spieltag
//   game.emit('stufe', 1..6)                 neue Ausbaustufe (auch 'stage'), sonst game.state.stufe
//   game.emit('build', { id, level })        Bauwerk gebaut oder ausgebaut (z. B. 'mole', 'seenotretter')
//   game.emit('phase', 'tag' | 'abend')      Tageszeit (alternativ body[data-phase])
// Ausgänge:
//   game.emit('event:announce', { event, day, startDay, endDay })
//   game.emit('event:start', { event, day, endDay })
//   game.emit('event:end', { event, day })
//   game.emit('sturm', { tag })                     am Sturmtag (Seenotretter rücken aus)
//   game.emit('weather', { wind, fog, rain, snow, sun, event, part, wetter })   bei jedem Tageswechsel
//   game.emit('wetter', { bewoelkung, wind })   dasselbe im Format von render/landscape.js
//   game.emit('season', { year, seasonDay, winterDay, part, winter })  wenn die Jahreszeit wechselt
// Abfrage:
//   game.events.modifiers()  Wirkung heute für die Spielregeln
//   game.events.season(day)  Jahreslauf: 30 Tage Saison, 3 Tage Winter
//   game.events.forecast(n), game.events.weather(day), game.events.current, game.events.planned
//   game.events.save(), game.events.load(daten)
//
// Mit den Spielregeln (sim.js) folgt das Modul game.state.day und game.state.phase; der eigene
// Stand liegt in game.state.modules.events und wird mit dem Spielstand gespeichert.
// Ohne Spielregeln zählt eine Ersatzuhr die Tage (120 s pro Tag, letzte 30 s Abend).
import { createScheduler } from './scheduler.js';
import { initEffects } from './effects.js';
import { initBanner } from './banner.js';
import { initVorbereiten } from './vorbereiten-ui.js';

const DAY_SECONDS = 120;
const EVENING_SECONDS = 30;

function loadCss() {
  if (document.querySelector('link[data-hm="events"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.dataset.hm = 'events';
  link.href = new URL('../../css/events.css', import.meta.url).href;
  document.head.appendChild(link);
}

export function init(game) {
  const seed = (game.state?.seed ?? Math.floor(Math.random() * 2 ** 31)) >>> 0;
  const scheduler = createScheduler({ seed });

  let stage = game.state?.stufe ?? game.state?.stage ?? 1;
  const buildings = { ...(game.state?.buildings ?? {}) };
  let external = false;     // true, sobald die Sim 'day:start' sendet
  let today = 0;
  let phase = document.body.dataset.phase ?? 'tag';
  let lastPart = null;

  // Bauwerke aus drei Quellen: 'build'-Ereignisse, game.state.buildings und das Services-Modul
  function readBuildings() {
    const fromState = game.state?.buildings;
    const out = fromState && typeof fromState === 'object' ? { ...buildings, ...fromState } : { ...buildings };
    let fx = null;
    try { fx = game.services?.effekte?.(); } catch { fx = null; }
    if (fx) {
      const frei = fx.freischalten ?? [];
      if (frei.includes?.('regatta')) out.segelclub = Math.max(out.segelclub ?? 0, 1);
      if (typeof fx.sturmschutz === 'number') out.seenotretterSchutz = fx.sturmschutz;
    }
    return out;
  }

  // Faktoren aus dem Services-Modul verstärken Regatta und Hafenfest (z. B. Segelclub, Segelmacher)
  function serviceBoost(mods) {
    const id = scheduler.current?.id;
    let f = 1;
    try {
      const fx = game.services?.effekte?.();
      if (id === 'regatta' && typeof fx?.regatta === 'number') f = fx.regatta;
      if (id === 'hafenfest' && typeof fx?.hafenfest === 'number') f = fx.hafenfest;
    } catch { f = 1; }
    if (f !== 1 && f > 0) {
      mods.visitorFactor *= f;
      mods.serviceIncomeFactor *= f;
    }
    return mods;
  }

  function newDay(day) {
    if (!(day > today)) return;
    today = day;
    const changes = scheduler.advanceTo(day, { stage, buildings: readBuildings() });
    for (const c of changes) {
      if (c.type === 'announce') game.emit('event:announce', { event: c.event, day: c.day, startDay: c.startDay, endDay: c.endDay });
      if (c.type === 'start') {
        game.emit('event:start', { event: c.event, day: c.day, endDay: c.endDay });
        // Seenotretter laufen aus (Services-Modul und Animationen hören darauf)
        if (c.event.id === 'sturm') game.emit('sturm', { tag: c.day });
      }
      if (c.type === 'end') {
        game.emit('event:end', { event: c.event, day: c.day });
      }
    }
    store();
    emitWeather(scheduler.weather(day));
    const season = scheduler.season(day);
    if (season.part !== lastPart) { lastPart = season.part; game.emit('season', season); }
  }

  // 'weather' für Effekte und Ton, dazu 'wetter' im Format des Landschaftsmoduls
  function emitWeather(wx) {
    // wetter: Kurzform für den Ton (audio.js kennt 'ruhig', 'wind', 'sturm')
    const wind = wx.wind ?? 0.2;
    wx = { ...wx, wetter: wx.event === 'sturm' || wind >= 0.8 ? 'sturm' : wind >= 0.5 ? 'wind' : 'ruhig' };
    game.emit('weather', wx);
    const bewoelkung = Math.min(1, Math.max(0, 1 - (wx.sun ?? 0.7) + (wx.rain ?? 0) * 0.3 + (wx.fog ?? 0) * 0.3 + (wx.snow ?? 0) * 0.2));
    game.emit('wetter', { bewoelkung, wind: wx.wind ?? 0.2 });
  }

  function setPhase(p) {
    if (p === phase) return;
    phase = p;
    game.emit('event:phase', { phase, event: scheduler.current?.event ?? null });
  }

  // Spielregeln vorhanden? Dann gilt deren Tag. sim.js zählt state.day nachts hoch und fragt
  // morgens modifiers() ab, bevor es 'day:start' sendet; deshalb hier selbst nachziehen.
  const simDay = () => (typeof game.state?.day === 'number' ? game.state.day : null);
  function syncSim() {
    const d = simDay();
    if (d === null) return false;
    external = true;
    const s = game.state.stage ?? game.state.stufe;
    if (typeof s === 'number' && s !== stage) { stage = s; scheduler.setStage(s); }
    if (d > today) newDay(d);
    return true;
  }

  // Eigenen Stand in den Spielstand legen (sim.js speichert game.state nachts)
  function store() {
    const st = game.state;
    if (!st || typeof st !== 'object') return;
    if (!st.modules || typeof st.modules !== 'object') st.modules = {};
    st.modules.events = scheduler.save();
  }

  // Stand aus dem Spielstand übernehmen (nach dem Start und nach dem Laden eines Spielstands)
  function restore() {
    const saved = game.state?.modules?.events;
    if (saved && typeof saved === 'object') game.events.load(saved);
    else if (typeof game.state?.seed === 'number') {
      scheduler.load({ seed: game.state.seed >>> 0, rng: game.state.seed >>> 0, day: 0, current: null, planned: null, nextDue: {}, count: {}, lastEndDay: null });
      today = 0;
    }
    syncSim();
    store();
  }

  game.events = {
    scheduler,
    modifiers: () => {
      syncSim();
      scheduler.advanceTo(today, { stage, buildings: readBuildings() });   // Schutzbauten aktuell halten
      return serviceBoost(scheduler.modifiers());
    },
    weather: (day) => scheduler.weather(day),
    forecast: (n) => scheduler.forecast(n),
    season: (day) => scheduler.season(day),
    get current() { return scheduler.current; },
    get planned() { return scheduler.planned; },
    get phase() { return phase; },
    save: () => scheduler.save(),
    load(data) {
      scheduler.load(data);
      today = scheduler.day;
      lastPart = null;
      emitWeather(scheduler.weather(today || 1));
      const season = scheduler.season(today || 1);
      lastPart = season.part;
      game.emit('season', season);
      game.emit('event:loaded', { current: scheduler.current, planned: scheduler.planned });
    },
  };

  game.on('day:start', (d) => {
    external = true;
    const s = d?.stufe ?? d?.stage;
    if (typeof s === 'number') stage = s;
    const day = typeof d === 'number' ? d : d?.day;
    if (typeof day === 'number') newDay(day);
  });
  const onStage = (d) => {
    const s = typeof d === 'number' ? d : (d?.stufe ?? d?.stage);
    if (typeof s === 'number') { stage = s; scheduler.setStage(s); }
  };
  game.on('stufe', onStage);   // Name laut docs/grundgeruest.md
  game.on('stage', onStage);
  game.on('build', (d) => {
    if (d?.id) { buildings[d.id] = d.level ?? 1; scheduler.setBuilding(d.id, buildings[d.id]); }
  });
  game.on('phase', (p) => setPhase(typeof p === 'string' ? p : p?.phase));
  new MutationObserver(() => { if (document.body.dataset.phase) setPhase(document.body.dataset.phase); })
    .observe(document.body, { attributes: true, attributeFilter: ['data-phase'] });

  // Tag und Tageszeit: von den Spielregeln, sonst Ersatzuhr.
  // Die Spielregeln legen game.state asynchron an und ersetzen es beim Laden; ein neuer
  // Spielstand wird deshalb hier im Takt erkannt und übernommen.
  let knownState = null;
  game.onTick(() => {
    if (game.state && game.state !== knownState) { knownState = game.state; restore(); }
    if (syncSim()) {
      setPhase(game.state.phase === 'evening' ? 'abend' : 'tag');
      return;
    }
    if (external) return;
    const t = game.time;
    newDay(Math.floor(t / DAY_SECONDS) + 1);
    setPhase(t % DAY_SECONDS >= DAY_SECONDS - EVENING_SECONDS ? 'abend' : 'tag');
  });

  loadCss();
  initEffects(game);
  initBanner(game);
  // Sturm und Regatta vorbereiten (P24), sobald die Spielregeln stehen
  initVorbereiten(game).catch(() => { /* ohne Spielregeln nichts vorzubereiten */ });

  // Spielstand laden (auch nach Import), erster Tag sofort, damit Wetter und Wetterbericht stehen
  game.on('ready', () => { if (!external && today === 0 && !game.state) newDay(1); });
}
