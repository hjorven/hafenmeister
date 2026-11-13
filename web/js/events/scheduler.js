// Ereignis-Planer: reine Logik ohne Three.js und ohne DOM, läuft auch in Node (Tests, Balancing).
//
//   const s = createScheduler({ seed: 42 });
//   const changes = s.advanceTo(day, { stage, buildings });   // einmal pro neuem Tag
//   s.modifiers()      // Wirkung heute auf die Spielregeln (immer vollständig, siehe DEFAULT_MODS)
//   s.weather(day)     // Wetter für Landschaft und Ton
//   s.forecast(3)      // Wetterbericht für die nächsten Tage
//   s.save() / s.load(daten)
//
// advanceTo liefert die Änderungen dieses Tages in Reihenfolge:
//   { type: 'end', event, day }
//   { type: 'start', event, day, endDay }
//   { type: 'announce', event, day, startDay, endDay }
import { EVENTS, DEFAULT_MODS, SCHEDULE, YEAR } from '../data/events.js';
import { random } from '../random.js';

// Jahreslauf: aus der Tagesnummer (ab 1) Jahr, Saisontag und Jahreszeit berechnen.
export function seasonOf(day, year = YEAR) {
  const len = year.seasonDays + year.winterDays;
  const d = Math.max(1, Math.floor(day));
  const inYear = (d - 1) % len;              // 0 .. len-1
  const yearNo = Math.floor((d - 1) / len) + 1;
  if (inYear >= year.seasonDays) {
    return { year: yearNo, seasonDay: null, winterDay: inYear - year.seasonDays + 1, part: 'winter', winter: true };
  }
  const seasonDay = inYear + 1;
  const part = year.parts.find((p) => seasonDay >= p.from && seasonDay <= p.to)?.id ?? 'sommer';
  return { year: yearNo, seasonDay, winterDay: null, part, winter: false };
}

// Zufall mit Zustand als Zahl (st.rng), damit der Spielstand ihn speichern kann: gemeinsamer Zufall aus random.js.
const nextRandom = random;

// Fester Zufallswert je Tag (für das Alltagswetter), ändert den Zustand nicht.
function hashDay(seed, day) {
  let h = (seed ^ Math.imul(day + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function mergeMods(base, extra, scale = 1) {
  const out = {
    ...base,
    sizeFactor: { ...base.sizeFactor },
    kindFactor: { ...base.kindFactor },
    satisfaction: { ...base.satisfaction },
  };
  if (!extra) return out;
  for (const [k, v] of Object.entries(extra)) {
    if (k === 'sizeFactor' || k === 'kindFactor') {
      for (const [kk, vv] of Object.entries(v)) out[k][kk] = (out[k][kk] ?? 1) * vv;
    } else if (k === 'satisfaction') {
      for (const [kk, vv] of Object.entries(v)) out.satisfaction[kk] = (out.satisfaction[kk] ?? 0) + vv * scale;
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function createScheduler({ seed = 1, defs = EVENTS, schedule = SCHEDULE, year = YEAR } = {}) {
  const byId = new Map(defs.map((d) => [d.id, d]));

  let st = {
    seed: seed >>> 0,
    rng: seed >>> 0,
    day: 0,              // zuletzt verarbeiteter Tag
    stage: 1,
    buildings: {},
    nextDue: {},         // id -> frühester Starttag
    current: null,       // { id, startDay, endDay }
    planned: null,       // { id, startDay, endDay, announcedDay }
    lastEndDay: -Infinity,
    count: {},           // id -> wie oft schon
  };

  const announceDays = (def) => def.announceDays ?? 1;
  const rand = (a, b) => a + (b - a) * nextRandom(st);
  const interval = (def) => Math.max(2, Math.round(def.every * rand(1 - schedule.jitter, 1 + schedule.jitter)));

  function unlock(day) {
    for (const def of defs) {
      if (def.stage <= st.stage && st.nextDue[def.id] === undefined) {
        // Das erste Mal kommt ein neues Ereignis bald, damit man es kennenlernt.
        st.nextDue[def.id] = Math.max(day + 1, schedule.firstDay) + Math.round(def.every * rand(0.3, 0.7));
      }
    }
  }

  // Alle Tage des Ereignisses liegen in der Saison und im erlaubten Fenster.
  function fitsSeason(def, startDay) {
    const [from, to] = def.season ?? [1, year.seasonDays];
    for (let d = startDay; d < startDay + def.duration; d++) {
      const s = seasonOf(d, year);
      if (s.winter || s.seasonDay < from || s.seasonDay > to) return false;
    }
    return true;
  }

  function protection(def) {
    if (!def.protect) return 1;
    // Stufenloser Schutz aus dem Services-Modul (0 = kein Schutz, 1 = voll), sonst Bauwerksstufe
    const direct = st.buildings?.[def.protect.building + 'Schutz'];
    if (typeof direct === 'number') return Math.max(0, Math.min(1, 1 - direct));
    const lvl = Math.max(0, Math.floor(st.buildings?.[def.protect.building] ?? 0));
    const f = def.protect.factor;
    return f[Math.min(lvl, f.length - 1)];
  }

  function tryPlan(day) {
    if (st.planned) return null;
    const busyUntil = st.current ? st.current.endDay : st.lastEndDay;
    let best = null;
    for (const def of defs) {
      if (def.stage > st.stage) continue;
      if (def.requires && !((st.buildings?.[def.requires] ?? 0) > 0)) continue;
      const startDay = day + announceDays(def);
      if (!fitsSeason(def, startDay)) continue;
      if (startDay < schedule.firstDay) continue;
      if (startDay <= busyUntil + schedule.minGapDays) continue;
      const due = st.nextDue[def.id];
      if (due === undefined || startDay < due) continue;
      // Wer am längsten überfällig ist, kommt zuerst; das Gewicht entscheidet bei Gleichstand.
      const score = (startDay - due) + def.weight * 0.5 + nextRandom(st) * 0.1;
      if (!best || score > best.score) best = { def, startDay, score };
    }
    if (!best) return null;
    const { def, startDay } = best;
    st.planned = { id: def.id, startDay, endDay: startDay + def.duration - 1, announcedDay: day };
    st.nextDue[def.id] = startDay + interval(def);
    // Andere Ereignisse rücken nicht direkt dahinter: kurze Ruhe nach jedem Ereignis.
    return { type: 'announce', event: def, day, startDay, endDay: st.planned.endDay };
  }

  function step(day) {
    const changes = [];
    unlock(day);
    if (st.current && day > st.current.endDay) {
      const def = byId.get(st.current.id);
      changes.push({ type: 'end', event: def, day });
      st.lastEndDay = st.current.endDay;
      st.current = null;
    }
    if (st.planned && day >= st.planned.startDay) {
      const def = byId.get(st.planned.id);
      st.current = { id: def.id, startDay: st.planned.startDay, endDay: st.planned.endDay };
      st.planned = null;
      st.count[def.id] = (st.count[def.id] ?? 0) + 1;
      changes.push({ type: 'start', event: def, day, endDay: st.current.endDay });
    }
    const ann = tryPlan(day);
    if (ann) changes.push(ann);
    st.day = day;
    return changes;
  }

  const api = {
    get day() { return st.day; },
    get current() { return st.current ? { ...st.current, event: byId.get(st.current.id) } : null; },
    get planned() { return st.planned ? { ...st.planned, event: byId.get(st.planned.id) } : null; },

    // Bis zu diesem Tag weiterrechnen (übersprungene Tage werden nachgeholt).
    advanceTo(day, { stage, buildings } = {}) {
      if (stage !== undefined) st.stage = stage;
      if (buildings !== undefined) st.buildings = { ...buildings };
      const changes = [];
      // Große Sprünge (z. B. alter Spielstand) nicht Tag für Tag nachspielen
      if (day - st.day > 60) st.day = day - 1;
      for (let d = st.day + 1; d <= day; d++) changes.push(...step(d));
      return changes;
    },

    setStage(stage) { st.stage = stage; unlock(st.day); },
    setBuilding(id, level) { st.buildings = { ...st.buildings, [id]: level }; },

    // Wirkung heute. Schlechte Folgen werden durch Schutzbauten gemindert.
    season: (day = st.day) => seasonOf(day, year),

    modifiers() {
      if (seasonOf(st.day || 1, year).winter) return mergeMods(DEFAULT_MODS, year.winterMods);
      if (!st.current) return mergeMods(DEFAULT_MODS, null);
      const def = byId.get(st.current.id);
      return mergeMods(DEFAULT_MODS, def.mods, protection(def));
    },

    // Wetter eines Tages: Ereigniswetter oder ruhiges Alltagswetter.
    weather(day = st.day) {
      const id = eventOn(day);
      const season = seasonOf(day || 1, year);
      if (id) return { snow: 0, ...byId.get(id).weather, event: id, part: season.part };
      if (season.winter) return { ...year.winterWeather, event: null, part: 'winter' };
      const r = hashDay(st.seed, day);
      // Frühling und Herbst etwas windiger und trüber als der Sommer
      const rough = season.part === 'sommer' ? 0 : 0.15;
      return { wind: 0.15 + rough + r * 0.35, fog: 0, rain: r > 0.85 ? 0.4 : 0, snow: 0, sun: 0.5 + (1 - r) * 0.5 - rough, event: null, part: season.part };
    },

    // Wetterbericht: heute und die nächsten n Tage. Nur angekündigte Ereignisse erscheinen.
    forecast(n = 3) {
      const out = [];
      for (let d = st.day; d <= st.day + n; d++) {
        const id = eventOn(d);
        out.push({ day: d, event: id ? byId.get(id) : null, weather: api.weather(d), season: seasonOf(d || 1, year) });
      }
      return out;
    },

    save() { return JSON.parse(JSON.stringify({ ...st, lastEndDay: Number.isFinite(st.lastEndDay) ? st.lastEndDay : null })); },
    load(data) {
      if (!data || typeof data !== 'object') return;
      st = {
        ...st,
        ...data,
        lastEndDay: data.lastEndDay ?? -Infinity,
        nextDue: { ...(data.nextDue ?? {}) },
        count: { ...(data.count ?? {}) },
      };
      // Unbekannte Ereignisse aus alten Spielständen verwerfen
      if (st.current && !byId.has(st.current.id)) st.current = null;
      if (st.planned && !byId.has(st.planned.id)) st.planned = null;
    },
  };

  function eventOn(day) {
    if (st.current && day >= st.current.startDay && day <= st.current.endDay) return st.current.id;
    if (st.planned && day >= st.planned.startDay && day <= st.planned.endDay) return st.planned.id;
    return null;
  }

  return api;
}
