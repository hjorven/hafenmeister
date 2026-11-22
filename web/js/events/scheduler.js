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
//   { type: 'nachspiel', event, day, endDay }     Nachspiel nach dem letzten Ereignistag (G3)
//
// Eigene Feste (P38, def.selbst, Hafenfest): planen sich nicht selbst. Der Spieler setzt sie an:
//   s.eigenFrei(startDay, { heute, vorlauf })  null oder Grund ('saison', 'vorlauf', 'ereignis', 'fest', 'gross')
//   s.ansetzen(id, startDay, { extra, evening, menschen, teile })   eigener Platz im Planer wie ein großes
//                     Ereignis; extra: Wirkung, die zur Wirkung des Ereignisses dazukommt; evening: Abendeffekt
//                     (statt def.evening); menschen: Leute an Land (statt def.menschen). Alles steht in current.
//   s.absetzen()      angesetztes Fest streichen (nur vor dem Start)
//   s.eigen           angesetztes Fest { id, startDay, endDay, extra, evening, teile, event } oder null
// Die anderen Ereignisse halten Abstand zum eigenen Fest.
//
// Große Ereignisse (def.gross, z. B. Hanse-Woche) haben einen eigenen Platz im Planer: Sie werden lange
// vorher angekündigt, die kleinen laufen bis kurz davor weiter und halten Abstand (minGapDays).
import { EVENTS, DEFAULT_MODS, SCHEDULE, YEAR } from '../data/events.js';
import { random } from '../random.js';
import { windRichtung } from '../world/wind.js';

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
    gross: null,         // großes Ereignis, lange vorher angekündigt: { id, startDay, endDay, announcedDay }
    nachspiel: null,     // { id, startDay, endDay }
    eigen: null,         // vom Spieler angesetztes Fest (P38): { id, startDay, endDay, extra, evening, teile }
    lastEndDay: -Infinity,
    count: {},           // id -> wie oft schon
  };

  const announceDays = (def) => def.announceDays ?? 1;
  const rand = (a, b) => a + (b - a) * nextRandom(st);
  const interval = (def) => Math.max(2, Math.round(def.every * rand(1 - schedule.jitter, 1 + schedule.jitter)));
  // Einmal im Jahr (alleTage so lang wie ein Jahr oder länger): frühestens in der nächsten Saison wieder,
  // ohne Streuung, damit kein Jahr ausfällt. Sonst Abstand mit Streuung.
  function naechsteFaelligkeit(def, startDay) {
    const len = year.seasonDays + year.winterDays;
    if (def.every >= len) return startDay + len - Math.round(len * 0.2);
    return startDay + interval(def);
  }

  function unlock(day) {
    for (const def of defs) {
      if (def.stage <= st.stage && st.nextDue[def.id] === undefined) {
        // Das erste Mal kommt ein neues Ereignis bald, damit man es kennenlernt.
        // Feste Tage (Mittsommer) gleich ab dem nächsten passenden Saisontag
        st.nextDue[def.id] = def.amTag ? day + 1 : Math.max(day + 1, schedule.firstDay) + Math.round(def.every * rand(0.3, 0.7));
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

  // Passt ein Ereignis [s, e] neben das angekündigte große Ereignis (mit Abstand)?
  const abstand = (s, e, a, b) => e + schedule.minGapDays < a || s > b + schedule.minGapDays;
  function nebenGross(s, e) {
    const g = st.gross;
    return !g || abstand(s, e, g.startDay, g.endDay);
  }
  // Passt ein Ereignis [s, e] neben das eigene Fest des Spielers (P38)?
  function nebenEigen(s, e) {
    const f = st.eigen;
    return !f || abstand(s, e, f.startDay, f.endDay);
  }
  // Ereignisse mit festem Saisontag (def.amTag, Mittsommer): an diesem Tag kommen sie sicher,
  // die anderen halten Abstand. Liefert den Tag (absolut), an dem das feste Ereignis als Nächstes läge.
  const festeDefs = defs.filter((d) => d.amTag);
  function festerTag(def, ab) {
    const len = year.seasonDays + year.winterDays;
    const jahrStart = Math.floor((Math.max(1, ab) - 1) / len) * len;
    for (const j of [0, len]) {
      const d = jahrStart + j + def.amTag;
      if (d >= ab) return d;
    }
    return Infinity;
  }
  function nebenFesten(s, e, day) {
    for (const def of festeDefs) {
      if (def.stage > st.stage || (def.requires && !((st.buildings?.[def.requires] ?? 0) > 0))) continue;
      if ((st.nextDue[def.id] ?? Infinity) > festerTag(def, day)) continue;   // dieses Jahr schon gewesen
      const f = festerTag(def, day + 1);
      if (!abstand(s, e, f, f + def.duration - 1)) return false;
    }
    return true;
  }

  // Bestes fälliges Ereignis einer Art (klein oder groß) für Ankündigung heute
  function waehle(day, gross, busyUntil) {
    let best = null;
    for (const def of defs) {
      if (!!def.gross !== gross) continue;
      if (def.selbst) continue;              // eigenes Fest: setzt der Spieler an (P38)
      if (def.stage > st.stage) continue;
      if (def.requires && !((st.buildings?.[def.requires] ?? 0) > 0)) continue;
      const startDay = day + announceDays(def);
      if (!fitsSeason(def, startDay)) continue;
      if (startDay < schedule.firstDay) continue;
      if (startDay <= busyUntil + schedule.minGapDays) continue;
      if (!gross && !nebenGross(startDay, startDay + def.duration - 1)) continue;
      if (!nebenEigen(startDay, startDay + def.duration - 1)) continue;
      const due = st.nextDue[def.id];
      if (due === undefined || startDay < due) continue;
      if (def.amTag) {
        // Festes Datum: nur genau an seinem Saisontag, dann vor allen anderen
        if (seasonOf(startDay, year).seasonDay !== def.amTag) continue;
        return { def, startDay, score: Infinity };
      }
      if (!nebenFesten(startDay, startDay + def.duration - 1, day)) continue;
      // Wer am längsten überfällig ist, kommt zuerst; das Gewicht entscheidet bei Gleichstand.
      const score = (startDay - due) + def.weight * 0.5 + nextRandom(st) * 0.1;
      if (!best || score > best.score) best = { def, startDay, score };
    }
    return best;
  }

  function tryPlanGross(day) {
    if (st.gross || (st.current && byId.get(st.current.id)?.gross)) return null;
    const busyUntil = Math.max(st.current ? st.current.endDay : -Infinity, st.planned ? st.planned.endDay : -Infinity, st.lastEndDay);
    const best = waehle(day, true, busyUntil);
    if (!best) return null;
    const { def, startDay } = best;
    st.gross = { id: def.id, startDay, endDay: startDay + def.duration - 1, announcedDay: day };
    st.nextDue[def.id] = naechsteFaelligkeit(def, startDay);
    return { type: 'announce', event: def, day, startDay, endDay: st.gross.endDay };
  }

  function tryPlan(day) {
    if (st.planned) return null;
    const busyUntil = st.current ? st.current.endDay : st.lastEndDay;
    const best = waehle(day, false, busyUntil);
    if (!best) return null;
    const { def, startDay } = best;
    st.planned = { id: def.id, startDay, endDay: startDay + def.duration - 1, announcedDay: day };
    st.nextDue[def.id] = naechsteFaelligkeit(def, startDay);
    // Andere Ereignisse rücken nicht direkt dahinter: kurze Ruhe nach jedem Ereignis.
    return { type: 'announce', event: def, day, startDay, endDay: st.planned.endDay };
  }

  function step(day) {
    const changes = [];
    unlock(day);
    if (st.nachspiel && day > st.nachspiel.endDay) st.nachspiel = null;
    if (st.current && day > st.current.endDay) {
      const def = byId.get(st.current.id);
      changes.push({ type: 'end', event: def, day });
      st.lastEndDay = st.current.endDay;
      st.current = null;
      // Nachspiel (G3): wirkt ab heute, solange kein neues Ereignis läuft
      if (def?.nachspiel?.tage > 0 && !seasonOf(day, year).winter) {
        st.nachspiel = { id: def.id, startDay: day, endDay: day + def.nachspiel.tage - 1 };
        changes.push({ type: 'nachspiel', event: def, day, endDay: st.nachspiel.endDay });
      }
    }
    if (!st.current && st.gross && day >= st.gross.startDay) {
      const def = byId.get(st.gross.id);
      st.current = { id: def.id, startDay: st.gross.startDay, endDay: st.gross.endDay };
      st.gross = null;
      st.nachspiel = null;
      st.count[def.id] = (st.count[def.id] ?? 0) + 1;
      changes.push({ type: 'start', event: def, day, endDay: st.current.endDay });
    }
    if (!st.current && st.eigen && day >= st.eigen.startDay) {
      const f = st.eigen;
      const def = byId.get(f.id);
      st.eigen = null;
      if (def && day <= f.endDay) {
        st.current = { id: def.id, startDay: f.startDay, endDay: f.endDay, eigen: true, extra: f.extra ?? null, evening: f.evening ?? null,
          menschen: f.menschen ?? null, teile: f.teile ?? [] };
        st.nachspiel = null;
        st.count[def.id] = (st.count[def.id] ?? 0) + 1;
        changes.push({ type: 'start', event: def, day, endDay: st.current.endDay, eigen: true });
      }
    }
    if (!st.current && st.planned && day >= st.planned.startDay) {
      const def = byId.get(st.planned.id);
      st.current = { id: def.id, startDay: st.planned.startDay, endDay: st.planned.endDay };
      st.planned = null;
      st.nachspiel = null;
      st.count[def.id] = (st.count[def.id] ?? 0) + 1;
      changes.push({ type: 'start', event: def, day, endDay: st.current.endDay });
    }
    const gross = tryPlanGross(day);
    if (gross) changes.push(gross);
    const ann = tryPlan(day);
    if (ann) changes.push(ann);
    st.day = day;
    return changes;
  }

  const api = {
    get day() { return st.day; },
    get current() { return st.current ? { ...st.current, event: byId.get(st.current.id) } : null; },
    get planned() { return st.planned ? { ...st.planned, event: byId.get(st.planned.id) } : null; },
    /** Angekündigtes großes Ereignis (Hanse-Woche) oder null */
    get gross() { return st.gross ? { ...st.gross, event: byId.get(st.gross.id) } : null; },
    /** Vom Spieler angesetztes Fest (P38), solange es noch nicht begonnen hat, oder null */
    get eigen() { return st.eigen ? { ...st.eigen, teile: [...(st.eigen.teile ?? [])], event: byId.get(st.eigen.id) } : null; },
    /** Nachspiel heute (G3) oder null: { id, startDay, endDay, event } */
    get nachspiel() {
      const n = st.nachspiel;
      return n && !st.current && st.day >= n.startDay && st.day <= n.endDay ? { ...n, event: byId.get(n.id) } : null;
    },

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

    // ---- Eigenes Fest (P38) ------------------------------------------------------------------
    /**
     * Kann an startDay ein eigenes Fest (def id, Standard 'hafenfest') beginnen? null = ja, sonst der Grund:
     * 'saison' (nicht in der Saison oder außerhalb des Fensters), 'vorlauf' (zu kurzfristig),
     * 'ereignis' (zu nah an einem angekündigten oder laufenden Ereignis), 'fest' (fester Festtag wie
     * Mittsommer), 'gross' (die Hanse-Woche kann in diesen Tagen noch kommen), 'gesetzt' (schon ein Fest angesetzt).
     */
    eigenFrei(startDay, { id = 'hafenfest', heute = st.day, vorlauf = 2, ohneEigenes = false } = {}) {
      const def = byId.get(id);
      if (!def) return 'saison';
      if (st.eigen && !ohneEigenes) return 'gesetzt';
      const s = startDay, e = startDay + def.duration - 1;
      if (!fitsSeason(def, s)) return 'saison';
      if (s < heute + vorlauf) return 'vorlauf';
      // Gleiches Jahr wie heute: ein Fest nur in der laufenden Saison ansetzen
      if (seasonOf(s, year).year !== seasonOf(Math.max(1, heute), year).year) return 'saison';
      for (const x of [st.current, st.planned, st.gross]) {
        if (x && !abstand(s, e, x.startDay, x.endDay)) return 'ereignis';
      }
      // Feste Tage (Mittsommer, Heringstage), die dieses Jahr noch kommen
      for (const d of festeDefs) {
        if (d.stage > st.stage || (d.requires && !((st.buildings?.[d.requires] ?? 0) > 0))) continue;
        const f = festerTag(d, Math.max(1, heute));
        if (seasonOf(f, year).year !== seasonOf(s, year).year) continue;
        if ((st.nextDue[d.id] ?? -Infinity) > f) continue;   // dieses Jahr schon gewesen
        if (st.current?.id === d.id && f <= st.current.endDay) continue;
        if (!abstand(s, e, f, f + d.duration - 1)) return 'fest';
      }
      // Große Ereignisse einmal im Jahr (Hanse-Woche), die dieses Jahr noch kommen können: ihr Fenster freilassen
      const len = year.seasonDays + year.winterDays;
      const jahrStart = Math.floor((Math.max(1, heute) - 1) / len) * len;
      for (const d of defs) {
        if (!d.gross || d.selbst || d.stage > st.stage) continue;
        if (d.requires && !((st.buildings?.[d.requires] ?? 0) > 0)) continue;
        if (st.gross?.id === d.id || st.current?.id === d.id) continue;   // steht schon fest, siehe oben
        const due = st.nextDue[d.id];
        const [von, bis] = d.season ?? [1, year.seasonDays];
        if (due !== undefined && due > jahrStart + bis) continue;          // dieses Jahr nicht mehr
        const a = Math.max(jahrStart + von, heute + (d.announceDays ?? 1));
        const b = jahrStart + bis + d.duration - 1;
        if (a > jahrStart + bis) continue;
        if (!abstand(s, e, a, b)) return 'gross';
      }
      return null;
    },
    /** Eigenes Fest ansetzen (Prüfung mit eigenFrei vorher). Gibt true zurück, wenn es steht. */
    ansetzen(id, startDay, { extra = null, evening = null, menschen = null, teile = [], vorlauf = 0 } = {}) {
      const def = byId.get(id);
      if (!def || api.eigenFrei(startDay, { id, vorlauf })) return false;
      st.eigen = { id, startDay, endDay: startDay + def.duration - 1, announcedDay: st.day,
        extra: extra ? JSON.parse(JSON.stringify(extra)) : null, evening,
        menschen: menschen ? JSON.parse(JSON.stringify(menschen)) : null, teile: [...teile] };
      return true;
    },
    /** Angesetztes Fest streichen (nur solange es noch nicht begonnen hat). */
    absetzen() {
      if (!st.eigen) return false;
      st.eigen = null;
      return true;
    },
    setBuilding(id, level) { st.buildings = { ...st.buildings, [id]: level }; },

    // Wirkung heute. Schlechte Folgen werden durch Schutzbauten gemindert.
    season: (day = st.day) => seasonOf(day, year),

    // vorbereitet(id): war man auf das Ereignis vorbereitet? (Nachspiel mit Bonus, events/vorbereiten.js)
    // extra: weitere Wirkung des laufenden Ereignisses (Bauten, G7), wird dazugemischt
    modifiers({ vorbereitet = () => false, extra = null } = {}) {
      if (seasonOf(st.day || 1, year).winter) return mergeMods(DEFAULT_MODS, year.winterMods);
      if (!st.current) {
        const n = api.nachspiel;
        if (!n?.event?.nachspiel) return mergeMods(DEFAULT_MODS, null);
        let m = mergeMods(DEFAULT_MODS, n.event.nachspiel.mods);
        if (n.event.nachspiel.modsVorbereitet && vorbereitet(n.id)) m = mergeMods(m, n.event.nachspiel.modsVorbereitet);
        return m;
      }
      const def = byId.get(st.current.id);
      let m = mergeMods(DEFAULT_MODS, def.mods, protection(def));
      // Eigenes Fest (P38): was der Spieler dazugebucht hat (Schmuck, Musik, Markt, Feuerwerk)
      if (st.current.extra) m = mergeMods(m, st.current.extra);
      return extra ? mergeMods(m, extra) : m;
    },

    // Wetter eines Tages: Ereigniswetter oder ruhiges Alltagswetter.
    weather(day = st.day) {
      const id = eventOn(day);
      const season = seasonOf(day || 1, year);
      // Windrichtung (P34): aus Seed und Tag, Wetterlagen über mehrere Tage, Sturm aus West bis Nordwest
      const richtung = windRichtung(st.seed, day || 1, year.windRichtung ?? {}, id);
      if (id) return { snow: 0, ...byId.get(id).weather, event: id, part: season.part, richtung };
      if (season.winter) return { ...year.winterWeather, event: null, part: 'winter', richtung };
      const r = hashDay(st.seed, day);
      // Frühling und Herbst etwas windiger und trüber als der Sommer, der Herbst am windigsten (P20 G5)
      const rough = season.part === 'sommer' ? 0 : 0.15;
      const wind = year.wind?.[season.part] ?? rough;
      return { wind: Math.min(1, 0.15 + wind + r * 0.35), fog: 0, rain: r > 0.85 ? 0.4 : 0, snow: 0, sun: 0.5 + (1 - r) * 0.5 - rough, event: null, part: season.part, richtung };
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
      if (st.gross && !byId.has(st.gross.id)) st.gross = null;
      if (st.nachspiel && !byId.has(st.nachspiel.id)) st.nachspiel = null;
      if (st.eigen && !byId.has(st.eigen.id)) st.eigen = null;
      st.eigen ??= null;
      st.gross ??= null;
      st.nachspiel ??= null;
    },
  };

  function eventOn(day) {
    if (st.current && day >= st.current.startDay && day <= st.current.endDay) return st.current.id;
    if (st.planned && day >= st.planned.startDay && day <= st.planned.endDay) return st.planned.id;
    if (st.gross && day >= st.gross.startDay && day <= st.gross.endDay) return st.gross.id;
    if (st.eigen && day >= st.eigen.startDay && day <= st.eigen.endDay) return st.eigen.id;
    return null;
  }

  return api;
}
