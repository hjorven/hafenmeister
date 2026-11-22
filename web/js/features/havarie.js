// Havaristen einschleppen (Paket P37, Roadmap F11, docs/havarie.md).
//
// An manchen Tagen treibt ein Boot mit Schaden vor der Einfahrt: Motorschaden, Ruderbruch, Leine in der
// Schraube oder Mastbruch. Der Spieler gibt ihm eine freie Box (Meldung im Meldeplatz, Box antippen), und ein
// Helfer schleppt es hinein: in Stufe 2 und 3 ein Fischer, danach das Arbeitsboot, mit Seenotretter-Station
// deren Rettungsboot (schneller). Das Boot zahlt Liegegeld und Schlepplohn, bewertet mit einem Anker mehr und
// steht gleich als Stammgast auf der Liste. Ist eine Werft gebaut, bleibt es zur Reparatur länger (Dienst der
// Werft, render/services.js zahlt ihn am Abend). Tut der Spieler nichts oder lehnt ab, holt ein fremder Helfer
// den Havaristen in einen anderen Hafen: kein Abzug, nur die Gelegenheit ist weg.
//
// Die Regeln laufen ohne Browser (tests/havarie.test.mjs). Zufall aus Seed und Tag, kein Spielzufall:
// Zeitraffer und Rechnung bleiben gleich. Spielstand: state.modules.havarie = { letzter, gerettet, verpasst,
// heute: { tag, at, phase, boot, grund, platz, helfer, seit, ort } }, am Boot boat.havarie = { grund, helfer }.
// Phasen: 'geplant' (kommt heute um at), 'treibt' (vor der Einfahrt, Meldung steht), 'zugewiesen' (Box frei
// gehalten, Helfer unterwegs), 'fest' (liegt in der Box, ist ein Gast der Spielregeln), 'weg' (verpasst).
//
// Schnittstelle im Browser: game.havarie = { heute(), zuweisen(platz), ablehnen(grund), festmachen(),
//   plaetze(), helfer(), grundText(), ausloesen() }. Ereignis der Regeln: 'sim:havarie' { phase, ... }.

import * as sim from '../sim.js';
import { ECONOMY } from '../data/economy.js';
import { heimathaefen } from '../data/bootsnamen.js';
import { freierName, stammState } from './stammgaeste.js';
import { regelnBereit } from './regeln-bereit.js';

export const HAV = ECONOMY.havarie;

/** Schäden, die ein Boot haben kann. Motorboote: Motor, Schraube; Segelboote dazu Ruder und Mast. */
export const GRUENDE = {
  motor: { text: 'Motorschaden', satz: 'hat Motorschaden' },
  schraube: { text: 'Leine in der Schraube', satz: 'hat eine Leine in der Schraube' },
  ruder: { text: 'Ruderbruch', satz: 'hat das Ruder gebrochen' },
  mast: { text: 'Mastbruch', satz: 'hat den Mast verloren' },
};

/** Helfer, die schleppen. modell: Bootsmodell aus data/boats (Seenotretter: das Boot der Station). */
export const HELFER = {
  fischer: { name: 'Fischer', modell: 'M4-2', klasse: 'm', satz: 'Ein Fischer nimmt ihn auf den Haken' },
  arbeitsboot: { name: 'Arbeitsboot', modell: 'L4-3', klasse: 'l', satz: 'Das Arbeitsboot schleppt ihn herein' },
  seenotretter: { name: 'Seenotretter', modell: null, klasse: null, satz: 'Das Rettungsboot der Station schleppt ihn herein' },
};

const ARTEN_OHNE = new Set(['beiboot', 'jolle', 'paddelboot', 'ruderboot']);

export function havState(state) {
  state.modules ||= {};
  const s = (state.modules.havarie ||= { letzter: null, gerettet: 0, verpasst: 0, heute: null });
  s.gerettet ??= 0;
  s.verpasst ??= 0;
  return s;
}

// Fester Zufall aus Seed, Tag und Salz (mulberry32), verbraucht den Spielzufall nicht
export function zufall(seed, tag, salz = 37) {
  let a = ((seed >>> 0) ^ Math.imul(tag + 1, 0x9e3779b1) ^ Math.imul(salz + 11, 0x85ebca6b)) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Bootsarten, die heute als Havarist kommen können: Segel- und Motorboote S bis L, keine Sondergäste. */
export function havarieArten(state, ctx) {
  return sim.eligibleTypes(state, ctx).filter((t) => ['S', 'M', 'L'].includes(t.size) && (t.sail || t.motor)
    && !t.special && !t.stationed && !t.unlock && !t.dayVisitors && !ARTEN_OHNE.has(t.kind));
}

/** Das Boot des Havaristen würfeln (mit eigenem Zufall r). Gibt null zurück, wenn keines in den Hafen passt. */
export function bootFuer(state, ctx, r) {
  const arten = havarieArten(state, ctx);
  if (!arten.length) return null;
  for (let versuch = 0; versuch < 6; versuch++) {
    const summe = arten.reduce((a, t) => a + (t.weight || 1), 0);
    let x = r() * summe;
    let typ = arten[arten.length - 1];
    for (const t of arten) { x -= t.weight || 1; if (x <= 0) { typ = t; break; } }
    const modelle = (typ.models ?? []).filter((m) => (m.minStage ?? typ.minStage) <= state.stage);
    const modell = modelle.length ? modelle[Math.floor(r() * modelle.length)] : null;
    const mass = (k) => (modell?.[k] != null ? modell[k] : typ[k][0] + r() * (typ[k][1] - typ[k][0]));
    const boot = {
      typeId: typ.id, modelId: modell?.id ?? null, name: modell?.name ?? typ.name, size: typ.size, kind: typ.kind,
      length: Math.round(mass('length') * 10) / 10, beam: Math.round(mass('beam') * 10) / 10, draft: Math.round(mass('draft') * 10) / 10,
      motor: !!typ.motor, special: false, dayVisitors: 0, stationed: false,
      wishes: sim.rollWishes(state, ctx, typ, r), nights: 1,
    };
    if (sim.couldEverFit(state, ctx, boot)) {
      const gruende = typ.sail ? ['motor', 'ruder', 'mast', 'schraube'] : ['motor', 'schraube'];
      return { boot, grund: gruende[Math.floor(r() * gruende.length)] };
    }
  }
  return null;
}

/**
 * Morgens (Hook 'arrivals'): Kommt heute ein Havarist? Nie am ersten Tag, nie im Winter, ab HAV.abStufe,
 * höchstens einer je Tag und HAV.pause Tage Abstand. Der Rest von gestern wird aufgeräumt.
 */
export function planen(state, ctx, { erzwingen = false } = {}) {
  const s = havState(state);
  if (s.heute && s.heute.tag !== state.day) {
    if (s.heute.phase === 'treibt' || s.heute.phase === 'zugewiesen') s.verpasst++;
    s.heute = null;
  }
  if (s.heute || !HAV) return null;
  if (!erzwingen) {
    if (state.stage < HAV.abStufe || state.day <= 1) return null;
    if (sim.season(state, ctx).winter) return null;
    if (s.letzter != null && state.day - s.letzter < HAV.pause) return null;
  }
  const r = zufall(state.seed ?? 1, state.day, erzwingen ? 38 + (s.gerettet + s.verpasst) : 37);
  if (!erzwingen && r() >= (HAV.anteil[state.stage] ?? 0)) return null;
  const wahl = bootFuer(state, ctx, r);
  if (!wahl) return null;
  const { dayLength } = ctx.rules;
  const boot = wahl.boot;
  boot.id = state.nextId++;
  boot.bootsname = freierName(state, r(), boot);
  const haefen = heimathaefen(state.region, boot.size);
  boot.heimathafen = haefen[Math.floor(r() * haefen.length)] ?? null;
  boot.besuche = 1;
  const at = erzwingen ? state.clock : Math.round(dayLength * (HAV.fruehestens + r() * (HAV.spaetestens - HAV.fruehestens)));
  s.heute = { tag: state.day, at, phase: 'geplant', boot, grund: wahl.grund, platz: null, helfer: null, seit: null, ort: null };
  s.letzter = state.day;
  return s.heute;
}

/** Freie Boxen, in die der Havarist passt, die beste zuerst (erfüllte Platz-Wünsche, dann knapp). */
export function plaetze(state, ctx) {
  const h = havState(state).heute;
  if (!h || (h.phase !== 'treibt' && h.phase !== 'zugewiesen')) return [];
  const b = h.boot;
  return sim.availableBerths(state, ctx)
    .filter((p) => sim.isFree(state, p.id) && !sim.isRaftBerth(p.id) && sim.fits(b, p, ctx.rules, state.stage)
      && !sim.hookWhyNotFit(state, ctx, b, p))
    .map((p) => ({ p, wert: sim.berthWishHits(state, ctx, b, p) * 100 - sim.berthMaxLength(p, state.stage) + (p.comfort || 0) * 5 }))
    .sort((a, c) => c.wert - a.wert || (a.p.id < c.p.id ? -1 : 1))
    .map((x) => x.p.id);
}

/** Box zuweisen: der Helfer fährt los, die Box ist für den Havaristen frei gehalten (Hook 'fit'). */
export function zuweisen(state, ctx, platz, helfer = null) {
  const events = [];
  const h = havState(state).heute;
  if (!h || (h.phase !== 'treibt' && h.phase !== 'zugewiesen')) return { ok: false, reason: 'keinHavarist', events };
  if (!plaetze(state, ctx).includes(platz)) return { ok: false, reason: 'passtNicht', events };
  const vorher = h.platz;
  h.platz = platz;
  if (h.phase === 'treibt') {
    h.phase = 'zugewiesen';
    h.seit = state.clock;
    h.helfer = helfer ?? h.helfer ?? helferFuer(state);
  }
  events.push({ type: 'havarie', phase: 'zugewiesen', boatId: h.boot.id, berthId: platz, vorher, helfer: h.helfer });
  return { ok: true, events };
}

/** Helfer ohne Ansicht: Fischer bis Stufe 3, danach das Arbeitsboot (die Ansicht kennt die Seenotretter-Station). */
export function helferFuer(state, seenotretter = false) {
  if (seenotretter) return 'seenotretter';
  return state.stage <= 3 ? 'fischer' : 'arbeitsboot';
}

/** Ablehnen oder Frist verstrichen: ein fremder Helfer holt ihn, kein Abzug. */
export function ablehnen(state, grund = 'abgelehnt') {
  const events = [];
  const s = havState(state);
  const h = s.heute;
  if (!h || (h.phase !== 'treibt' && h.phase !== 'geplant')) return { ok: false, events };
  const sichtbar = h.phase === 'treibt';
  h.phase = 'weg';
  h.grundWeg = grund;
  if (sichtbar) s.verpasst++;
  events.push({ type: 'havarie', phase: 'weg', boatId: h.boot.id, grund, sichtbar });
  return { ok: true, events };
}

/**
 * Der Havarist ist in seiner Box (die Ansicht meldet das, ohne Ansicht gleich nach dem Zuweisen):
 * er wird ein Gast der Spielregeln, zahlt Liegegeld und Schlepplohn, steht als Stammgast auf der Liste,
 * mit Werft bleibt er zur Reparatur. Ist die Box doch belegt, nimmt er die beste andere freie.
 */
export function einschleppen(state, ctx, { werft = null } = {}) {
  const events = [];
  const s = havState(state);
  const h = s.heute;
  if (!h || h.phase !== 'zugewiesen') return { ok: false, events };
  const liste = plaetze(state, ctx);
  const platz = liste.includes(h.platz) ? h.platz : liste[0];
  if (!platz) {
    h.phase = 'weg';
    h.grundWeg = 'voll';
    s.verpasst++;
    events.push({ type: 'havarie', phase: 'weg', boatId: h.boot.id, grund: 'voll', sichtbar: true });
    return { ok: false, events };
  }
  const boot = {
    id: h.boot.id, typeId: null, modelId: null, name: '', size: 'S', kind: null,
    length: 0, beam: 0, draft: 0, motor: false, special: false, dayVisitors: 0, stationed: false,
    wishes: [], nights: 1, status: 'waiting', arriveAt: state.clock, waitingSince: state.clock, waitSpot: null,
    atBuoy: true, atBuoySince: state.clock, berthId: null, wishesMet: 0, wishesTotal: 0, pendingFee: 0, paid: false, feeDay: null, penalty: 0,
    ...structuredClone(h.boot),
    havarie: { grund: h.grund, helfer: h.helfer },
  };
  // Werft (P23, Dienst 'travellift'): Reparatur, bleibt so viele Nächte länger und zahlt am Abend
  if (werft && werft.naechte > 0) {
    boot.nights += werft.naechte;
    boot.dienste = { ...(boot.dienste ?? {}), travellift: 'offen' };
  }
  // Stammgast (F11): gleich auf der Liste, zählt beim Ruf doppelt; bewertet er schlecht, merkt er sich das
  const st = stammState(state);
  const eintrag = {
    stammId: st.naechsteId++, bootsname: boot.bootsname, heimathafen: boot.heimathafen, typeId: boot.typeId, modelId: boot.modelId,
    name: boot.name, size: boot.size, kind: boot.kind, motor: !!boot.motor, length: boot.length, beam: boot.beam, draft: boot.draft,
    wishes: [...boot.wishes], besuche: 1, zuletzt: state.day, stamm: true, lieblingsplatz: platz, havarie: true,
  };
  st.liste.push(eintrag);
  boot.stammId = eintrag.stammId;
  boot.stamm = true;
  state.boats[boot.id] = boot;
  const r = sim.assign(state, ctx, boot.id, platz, { hand: true });
  if (!r.ok) {
    delete state.boats[boot.id];
    st.liste = st.liste.filter((g) => g !== eintrag);
    st.naechsteId--;
    h.phase = 'weg';
    h.grundWeg = 'voll';
    s.verpasst++;
    events.push({ type: 'havarie', phase: 'weg', boatId: h.boot.id, grund: 'voll', sichtbar: true });
    return { ok: false, events };
  }
  events.push(...r.events);
  h.phase = 'fest';
  h.platz = platz;
  s.gerettet++;
  const lohn = HAV.schlepplohn?.[boot.size] ?? 0;
  if (lohn > 0) sim.addIncome(state, lohn, 'sonstiges', 'havarie');
  events.push({ type: 'stammgastNeu', stammId: eintrag.stammId, bootsname: eintrag.bootsname, havarie: true });
  events.push({ type: 'havarie', phase: 'fest', boatId: boot.id, berthId: platz, lohn, werft: !!boot.dienste?.travellift, helfer: h.helfer, grund: h.grund });
  return { ok: true, events };
}

/** Hook 'fit': die zugewiesene Box gehört dem Havaristen, bis er drin ist. */
export function passHook({ state, boat, berth }) {
  const h = state.modules?.havarie?.heute;
  if (!h || h.phase !== 'zugewiesen' || h.platz !== berth.id || boat.id === h.boot.id) return null;
  return 'havarie';
}

/**
 * Hook 'tick' (tagsüber): zur Zeit at taucht er auf. Ohne Ansicht wird gleich eingeschleppt; mit Ansicht
 * meldet sie das Festmachen, nach notfall Sekunden Spielzeit geht es auch ohne Meldung.
 */
export function tickHook(state, ctx, events, { ansicht = false, werft = null, notfall = 360 } = {}) {
  const h = havState(state).heute;
  if (!h || h.tag !== state.day) return;
  if (h.phase === 'geplant' && state.phase === 'day' && state.clock >= h.at) {
    h.phase = 'treibt';
    events.push({ type: 'havarie', phase: 'treibt', boatId: h.boot.id, grund: h.grund });
  }
  if (h.phase === 'zugewiesen' && (!ansicht || state.clock - (h.seit ?? state.clock) > notfall)) {
    events.push(...einschleppen(state, ctx, { werft }).events);
  }
}

/** Hook 'evening': wer noch treibt, holt ein fremder Helfer; ein laufender Schlepp ist sofort fertig. */
export function abendHook(state, ctx, events, { werft = null } = {}) {
  const h = havState(state).heute;
  if (!h) return;
  if (h.phase === 'zugewiesen') events.push(...einschleppen(state, ctx, { werft }).events);
  else if (h.phase === 'treibt' || h.phase === 'geplant') events.push(...ablehnen(state, 'abend').events);
}

/** Hook 'stageUp': gibt es die zugewiesene Box nicht mehr, treibt er wieder (der Spieler wählt neu). */
export function stufeHook({ state, gone, events }) {
  const h = state.modules?.havarie?.heute;
  if (!h || h.phase !== 'zugewiesen' || !gone?.includes?.(h.platz)) return;
  h.phase = 'treibt';
  h.platz = null;
  events.push({ type: 'havarie', phase: 'treibt', boatId: h.boot.id, grund: h.grund, neu: true });
}

/** Alle Regel-Hooks einhängen (Tests und Spiel). opts: { ansicht(), werft(), seenot() } als Funktionen. */
export function haengeEin(addHook, opts = {}) {
  const o = () => ({ ansicht: !!opts.ansicht?.(), werft: opts.werft?.() ?? null });
  return [
    addHook('arrivals', ({ state, ctx }) => { planen(state, ctx); }),
    addHook('tick', ({ state, ctx, events }) => tickHook(state, ctx, events, o())),
    addHook('evening', ({ state, ctx, events }) => abendHook(state, ctx, events, o())),
    addHook('fit', passHook),
    addHook('stageUp', stufeHook),
  ];
}

export function grundText(grund) {
  return GRUENDE[grund]?.text ?? 'Schaden';
}

// ------------------------------------------------------------------ Browser

export async function init(game) {
  await regelnBereit(game);
  const api = game.sim;
  // Werft: Reparatur nach der aktiven Stufe der Werft (Dienst 'travellift' aus economy.services)
  const werft = () => {
    const n = game.services?.stufeVon?.('travellift') ?? 0;
    if (!(n > 0)) return null;
    const d = ECONOMY.services?.travellift?.stufen?.[n - 1]?.wirkung?.dienst;
    return d ? { naechte: d.naechte ?? 1, preis: d.preis ?? 0 } : null;
  };
  const seenot = () => (game.services?.stufeVon?.('seenotretter') ?? 0) > 0;
  haengeEin(api.addHook, { ansicht: () => !!game.boatsVisible && !!game.havarieBild, werft });

  const st = () => api.state;
  const lauf = (r) => { if (r?.events?.length) api.dispatch(r.events); return r; };
  game.havarie = {
    heute: () => {
      const h = st()?.modules?.havarie?.heute;
      return h && h.tag === st().day ? h : null;
    },
    plaetze: () => plaetze(st(), api.ctx),
    helfer: () => helferFuer(st(), seenot()),
    zuweisen: (platz) => lauf(zuweisen(st(), api.ctx, String(platz), helferFuer(st(), seenot()))),
    ablehnen: (grund = 'abgelehnt') => lauf(ablehnen(st(), grund)),
    festmachen: () => lauf(einschleppen(st(), api.ctx, { werft: werft() })),
    werft,
    grundText,
    zahlen: () => ({ gerettet: havState(st()).gerettet, verpasst: havState(st()).verpasst }),
    // Zum Ausprobieren und für Tests: jetzt sofort einen Havaristen schicken (?havarie=jetzt)
    ausloesen: () => {
      const s = havState(st());
      if (s.heute?.tag === st().day && s.heute.phase !== 'weg' && s.heute.phase !== 'fest') return s.heute;
      s.heute = null;
      const h = planen(st(), api.ctx, { erzwingen: true });
      if (h) { const ev = []; tickHook(st(), api.ctx, ev, { ansicht: true }); api.dispatch(ev); }
      return h;
    },
  };

  // Ansicht und Meldung (je eine Datei, keine eigene MODULES-Zeile)
  try {
    const [bild, meldung] = await Promise.all([import('../render/havarie-bild.js'), import('../ui/havarie-meldung.js')]);
    bild.initHavarieBild(game);
    meldung.initHavarieMeldung(game);
  } catch (err) {
    console.error('Havarie: Ansicht oder Meldung nicht geladen', err);
  }

  // Logbuch: eine Zeile in der Chronik des Tages
  game.on('sim:havarie', (e) => {
    const h = game.havarie.heute() ?? st()?.modules?.havarie?.heute;
    const name = h?.boot?.bootsname ? `„${h.boot.bootsname}“` : 'Ein Havarist';
    if (e.phase === 'fest') game.logbuch?.merken?.({ a: 'text', art: 'havarie', text: `Havarist ${name} eingeschleppt (${grundText(e.grund)})` });
    if (e.phase === 'weg' && e.sichtbar) game.logbuch?.merken?.({ a: 'text', art: 'havarie', text: `Havarist ${name} in einen anderen Hafen geschleppt` });
  });

  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
  if (q?.get('havarie') === 'jetzt') {
    // Warten, bis der Tag läuft und das Bild steht (Module laden nacheinander, der Überblick fliegt erst)
    const start = Date.now();
    const t = setInterval(() => {
      const bereit = st()?.phase === 'day' && game.havarieBild && game.boatsVisible;
      if (bereit && Date.now() - start > 2500) { clearInterval(t); game.havarie.ausloesen(); }
      else if (Date.now() - start > 30000) clearInterval(t);
    }, 250);
  }
}

export default init;
