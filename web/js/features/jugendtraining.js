// Jugendtraining am Segelclub (Paket P39, Roadmap F13, docs/jugendtraining.md).
//
// Mit Segelclub und Slipanlage trainiert die Jugend des Vereins an festen Tagen (jeden 4. Saisontag): Die
// Kinder rollen ihre Optimisten (ab der Segelschule auch Jollen) über den Slip ins Wasser, das Trainerboot
// holt sie dort ab, und die ganze Gruppe segelt in einer Reihe aus dem Hafen, trainiert draußen an drei
// Bojen und kommt wieder herein. Das Trainerboot braucht für den Tag eine Box: Der Spieler gibt sie ihm
// (Meldung im Meldeplatz, Box antippen) und kann sie als feste Trainerbox merken, dann liegt es an den
// nächsten Trainingstagen von selbst dort, solange die Box frei ist. Die Gruppe braucht freies Fahrwasser:
// Solange sie in der Einfahrt ist, fahren wartende Boote nicht selbst ein (render/jugend-bild.js).
// Kommt die Gruppe zurück, zahlt der Verein für die Box, und jeder Gast, der dann im Hafen liegt, bewertet
// mit rules.youth.rating Anker mehr ("Jugendtraining zugesehen"). Bei Sturm, Starkwind oder Regatta fällt
// das Training aus. Ohne Box fällt es auch aus, kostet aber nichts.
//
// Die Regeln laufen ohne Browser (tests/jugendtraining.test.mjs). Kein Zufall: Trainingstage stehen fest.
// Spielstand: state.modules.jugend = { stammbox, trainings, ausgefallen, heute: { tag, phase, platz, auto,
//   grund, gruppe, seit } }, am Gast boat.jugend = true.
// Phasen: 'angekuendigt' (Box fehlt), 'bereit' (Box frei gehalten, Trainerboot liegt dort), 'draussen'
// (Gruppe unterwegs), 'zurueck' (fertig), 'ausgefallen' (grund: 'wind', 'sturm', 'regatta', 'keineBox',
// 'abgesagt').
//
// Schnittstelle im Browser: game.jugendtraining = { heute(), plaetze(), zuweisen(platz, { merken }),
//   absagen(), auslaufen(), zurueck(), stammbox(), vergessen(), naechsterTag(), gruppe(), ausloesen() }.
// Ereignis der Regeln: 'sim:jugend' { phase, ... }.

import * as sim from '../sim.js';
import { ECONOMY } from '../data/economy.js';
import { regelnBereit } from './regeln-bereit.js';

export const JT = ECONOMY.jugendtraining ?? null;
export const TRAINER_ID = 'jugend-trainer';

/** Das Trainerboot als Boot der Spielregeln (für Passregel und Box). */
export function trainerBoot() {
  const t = JT?.trainerboot ?? { laenge: 4.8, breite: 2, tiefgang: 0.4 };
  return {
    id: TRAINER_ID, typeId: 'S3', modelId: t.modell ?? 'S3-3', name: 'Trainerboot', size: 'S', kind: 'schlauchboot',
    length: t.laenge, beam: t.breite, draft: t.tiefgang, motor: true, special: false, stationed: false, wishes: [],
  };
}

export function jState(state) {
  state.modules ||= {};
  const s = (state.modules.jugend ||= { stammbox: null, trainings: 0, ausgefallen: 0, heute: null });
  s.stammbox ??= null;
  s.trainings ??= 0;
  s.ausgefallen ??= 0;
  s.heute ??= null;
  return s;
}

/** Gebaute Stufe eines Services im Spielstand (Services-Modul: state.modules.services.gebaut). */
export function serviceStufe(state, id) {
  return Number(state.modules?.services?.gebaut?.[id]) || 0;
}

/** Sind Segelclub und Slip gebaut? */
export function gebaut(state) {
  if (!JT) return false;
  return Object.entries(JT.braucht ?? {}).every(([id, n]) => serviceStufe(state, id) >= n);
}

/** Gruppe nach Ausbau des Segelclubs: { optis, jollen, beitrag, eltern } */
export function gruppeFuer(state) {
  const liste = JT?.gruppe ?? [];
  const n = Math.max(1, Math.min(liste.length, serviceStufe(state, 'segelclub') || 1));
  return { ...liste[n - 1] };
}

/** Ist dieser Saisontag ein Trainingstag (nur der Kalender, ohne Bauten und Wetter)? */
export function istTrainingstag(saisonTag) {
  if (!JT || !(saisonTag >= JT.ersterTag)) return false;
  return (saisonTag - JT.ersterTag) % JT.alle === 0;
}

/** Nächster Spieltag mit Training ab tag (einschließlich), nur Kalender; null im Winter ohne Saison danach. */
export function naechsterTag(state, ctx, ab = state.day) {
  const { seasonDays, winterDays } = ctx.rules;
  for (let d = ab; d < ab + seasonDays + winterDays + 1; d++) {
    const s = sim.season({ day: d }, ctx);
    if (!s.winter && istTrainingstag(s.day)) return d;
  }
  return null;
}

/**
 * Plant den heutigen Tag (einmal je Tag, beim ersten Takt). wetter: { sturm, stark, regatta } für heute
 * oder null (unbekannt: dann segeln sie). Gibt heute zurück oder null, wenn heute kein Trainingstag ist.
 */
export function planen(state, ctx, wetter = null, { erzwingen = false } = {}) {
  const s = jState(state);
  if (s.heute && s.heute.tag !== state.day) s.heute = null;
  if (s.heute || !JT) return s.heute;
  if (!gebaut(state)) return null;
  const sz = sim.season(state, ctx);
  if (!erzwingen && (sz.winter || !istTrainingstag(sz.day))) return null;
  const heute = { tag: state.day, phase: 'angekuendigt', platz: null, auto: false, grund: null, gruppe: gruppeFuer(state), seit: null };
  s.heute = heute;
  const grund = wetter?.sturm ? 'sturm' : wetter?.regatta ? 'regatta' : wetter?.stark ? 'wind' : null;
  if (grund && !erzwingen) {
    heute.phase = 'ausgefallen';
    heute.grund = grund;
    return heute;
  }
  // Feste Trainerbox: liegt das Trainerboot von selbst dort, wenn sie frei ist
  if (s.stammbox && plaetze(state, ctx).includes(s.stammbox)) {
    heute.platz = s.stammbox;
    heute.phase = 'bereit';
    heute.auto = true;
  }
  return heute;
}

/** Freie Boxen, in die das Trainerboot passt, die knappsten zuerst (große Boxen bleiben für Gäste). */
export function plaetze(state, ctx) {
  const h = jState(state).heute;
  const b = trainerBoot();
  return sim.availableBerths(state, ctx)
    .filter((p) => (p.id === h?.platz || sim.isFree(state, p.id)) && !sim.isRaftBerth(p.id) && p.kind !== 'buoy' && p.art !== 'boje'
      && sim.fits(b, p, ctx.rules, state.stage) && !sim.hookWhyNotFit(state, ctx, b, p))
    .map((p) => ({ id: p.id, wert: sim.berthMaxLength(p, state.stage) - (p.comfort || 0) * 0.5 }))
    .sort((a, c) => a.wert - c.wert || (a.id < c.id ? -1 : 1))
    .map((x) => x.id);
}

/** Box für das Trainerboot geben (vor dem Auslaufen). merken: als feste Trainerbox für die nächsten Male. */
export function zuweisen(state, ctx, platz, { merken = false } = {}) {
  const events = [];
  const s = jState(state);
  const h = s.heute;
  if (!h || (h.phase !== 'angekuendigt' && h.phase !== 'bereit')) return { ok: false, reason: 'keinTraining', events };
  platz = String(platz);
  if (!plaetze(state, ctx).includes(platz)) return { ok: false, reason: 'passtNicht', events };
  const vorher = h.platz;
  h.platz = platz;
  h.phase = 'bereit';
  h.auto = false;
  if (merken) s.stammbox = platz;
  events.push({ type: 'jugend', phase: 'bereit', berthId: platz, vorher, merken: !!merken });
  return { ok: true, events };
}

/** Die feste Trainerbox merken oder vergessen (null). */
export function stammboxSetzen(state, platz) {
  jState(state).stammbox = platz == null ? null : String(platz);
}

/** Der Spieler sagt das Training heute ab (kein Abzug, die Box wird frei). */
export function absagen(state) {
  const events = [];
  const s = jState(state);
  const h = s.heute;
  if (!h || (h.phase !== 'angekuendigt' && h.phase !== 'bereit')) return { ok: false, events };
  const platz = h.platz;
  h.phase = 'ausgefallen';
  h.grund = 'abgesagt';
  h.platz = null;
  s.ausgefallen++;
  events.push({ type: 'jugend', phase: 'ausgefallen', grund: 'abgesagt', berthId: platz });
  return { ok: true, events };
}

/** Die Gruppe ist im Wasser und läuft aus (das Bild meldet das; ohne Bild der Takt zur Beginnzeit). */
export function auslaufen(state) {
  const h = jState(state).heute;
  if (!h || h.phase !== 'bereit') return { ok: false, events: [] };
  h.phase = 'draussen';
  h.seit = state.clock;
  return { ok: true, events: [{ type: 'jugend', phase: 'draussen', berthId: h.platz, gruppe: { ...h.gruppe } }] };
}

/**
 * Die Gruppe ist zurück: Der Verein zahlt für die Box, jeder Gast im Hafen hat zugesehen
 * (boat.jugend: rules.youth.rating Anker mehr bei der Abreise).
 */
export function zurueck(state, ctx) {
  const s = jState(state);
  const h = s.heute;
  if (!h || h.phase !== 'draussen') return { ok: false, events: [] };
  h.phase = 'zurueck';
  s.trainings++;
  const beitrag = Math.max(0, Math.round(h.gruppe?.beitrag ?? 0));
  if (beitrag > 0) sim.addIncome(state, beitrag, 'services', 'segelclub');
  let zuschauer = 0;
  for (const b of sim.mooredBoats(state)) {
    if (b.stationed || b.jugend) continue;
    b.jugend = true;
    zuschauer++;
  }
  return { ok: true, events: [{ type: 'jugend', phase: 'zurueck', berthId: h.platz, beitrag, zuschauer, anker: ctx.rules.youth?.rating ?? 0 }] };
}

/** Hook 'fit': die Box des Trainerboots gehört ihm, solange heute trainiert wird. */
export function passHook({ state, boat, berth }) {
  const h = state.modules?.jugend?.heute;
  if (!h || h.tag !== state.day || !h.platz || h.platz !== berth.id || boat.id === TRAINER_ID) return null;
  if (h.phase !== 'bereit' && h.phase !== 'draussen' && h.phase !== 'zurueck') return null;
  return 'jugendtraining';
}

/**
 * Hook 'tick' (tagsüber). opts: { ansicht, wetter } (ansicht: das Bild führt die Gruppe und meldet
 * Auslaufen und Zurückkommen; die Regeln greifen nur als Notbremse).
 */
export function tickHook(state, ctx, events, { ansicht = false, wetter = null } = {}) {
  if (!JT) return;
  const s = jState(state);
  if (!s.heute || s.heute.tag !== state.day) {
    const h = planen(state, ctx, wetter);
    if (h) events.push({ type: 'jugend', phase: h.phase, grund: h.grund, berthId: h.platz, auto: h.auto, neu: true });
  }
  const h = s.heute;
  if (!h || h.tag !== state.day || state.phase !== 'day') return;
  const L = ctx.rules.dayLength;
  const beginn = beginnZeit(h, ctx);
  if (h.phase === 'angekuendigt' && state.clock >= beginn) {
    h.phase = 'ausgefallen';
    h.grund = 'keineBox';
    s.ausgefallen++;
    events.push({ type: 'jugend', phase: 'ausgefallen', grund: 'keineBox' });
    return;
  }
  // Ohne Bild läuft die Gruppe zur Beginnzeit aus, mit Bild spätestens etwas danach (Notbremse)
  if (h.phase === 'bereit' && state.clock >= beginn + (ansicht ? 0.12 * L : 0)) events.push(...auslaufen(state).events);
  if (h.phase === 'draussen') {
    const ende = beginn + (ansicht ? JT.notfall : JT.dauer) * L;
    if (state.clock >= ende) events.push(...zurueck(state, ctx).events);
  }
}

/** Spieluhr, zu der die Gruppe ins Wasser geht (zum Ausprobieren auch früher: heute.beginnBei). */
export function beginnZeit(h, ctx) {
  return h?.beginnBei ?? (JT?.beginn ?? 0.3) * ctx.rules.dayLength;
}

/** Hook 'evening': wer noch draußen ist, kommt zurück; ohne Box fällt es aus. */
export function abendHook(state, ctx, events) {
  const s = jState(state);
  const h = s.heute;
  if (!h || h.tag !== state.day) return;
  if (h.phase === 'draussen') events.push(...zurueck(state, ctx).events);
  else if (h.phase === 'angekuendigt' || h.phase === 'bereit') {
    h.phase = 'ausgefallen';
    h.grund = h.platz ? 'spaet' : 'keineBox';
    s.ausgefallen++;
    events.push({ type: 'jugend', phase: 'ausgefallen', grund: h.grund });
  }
}

/** Hook 'stageUp': gibt es die Box nicht mehr, braucht das Trainerboot eine neue (vor dem Auslaufen). */
export function stufeHook({ state, gone, events }) {
  const s = state.modules?.jugend;
  if (!s) return;
  if (s.stammbox && gone?.includes?.(s.stammbox)) s.stammbox = null;
  const h = s.heute;
  if (!h || !h.platz || !gone?.includes?.(h.platz)) return;
  const vorher = h.platz;
  h.platz = null;
  if (h.phase === 'bereit') {
    h.phase = 'angekuendigt';
    h.auto = false;
    events.push({ type: 'jugend', phase: 'angekuendigt', vorher, neu: true });
  }
}

/** Alle Regel-Hooks einhängen (Tests und Spiel). opts: { ansicht(), wetter(state) } als Funktionen. */
export function haengeEin(addHook, opts = {}) {
  const o = (state) => ({ ansicht: !!opts.ansicht?.(), wetter: opts.wetter?.(state) ?? null });
  return [
    addHook('tick', ({ state, ctx, events }) => tickHook(state, ctx, events, o(state))),
    addHook('evening', ({ state, ctx, events }) => abendHook(state, ctx, events)),
    addHook('fit', passHook),
    addHook('stageUp', stufeHook),
  ];
}

/** Text zum Grund eines Ausfalls. */
export const AUSFALL = {
  sturm: 'Sturm: Das Jugendtraining fällt heute aus.',
  wind: 'Zu viel Wind für die Optis: Das Jugendtraining fällt heute aus.',
  regatta: 'Heute ist Regatta, der Club hat kein Training.',
  keineBox: 'Das Trainerboot hatte keine Box: Das Training ist ausgefallen.',
  abgesagt: 'Das Jugendtraining ist für heute abgesagt.',
  spaet: 'Das Jugendtraining ist ausgefallen.',
};

// ------------------------------------------------------------------ Browser

export async function init(game) {
  if (!JT) return;
  await regelnBereit(game);
  const api = game.sim;
  const st = () => api.state;
  // Wetter des Tages aus den Ereignissen und dem Wind (P34)
  const wetter = (state) => {
    let wx = null;
    try { wx = game.events?.weather?.(state.day) ?? null; } catch { wx = null; }
    const ev = wx?.event ?? game.events?.current?.id ?? null;
    const strong = api.ctx?.rules?.wind?.strong;
    const wind = wx?.wind ?? game.wind?.heute?.wind;
    return { sturm: ev === 'sturm', regatta: ev === 'regatta', stark: strong != null && wind != null && wind >= strong };
  };
  haengeEin(api.addHook, { ansicht: () => !!game.boatsVisible && !!game.jugendBild?.aktiv, wetter });

  const lauf = (r) => { if (r?.events?.length) api.dispatch(r.events); return r; };
  game.jugendtraining = {
    heute: () => {
      const h = st()?.modules?.jugend?.heute;
      return h && h.tag === st().day ? h : null;
    },
    plaetze: () => plaetze(st(), api.ctx),
    zuweisen: (platz, o = {}) => lauf(zuweisen(st(), api.ctx, platz, o)),
    absagen: () => lauf(absagen(st())),
    auslaufen: () => lauf(auslaufen(st())),
    zurueck: () => lauf(zurueck(st(), api.ctx)),
    stammbox: () => jState(st()).stammbox,
    merken: (platz) => stammboxSetzen(st(), platz),
    vergessen: () => stammboxSetzen(st(), null),
    naechsterTag: () => naechsterTag(st(), api.ctx, st().day + 1),
    gebaut: () => gebaut(st()),
    gruppe: () => gruppeFuer(st()),
    zahlen: () => ({ trainings: jState(st()).trainings, ausgefallen: jState(st()).ausgefallen }),
    // Zum Ausprobieren und für Tests: heute ein Training ansetzen (?jugend=jetzt), Beginn in wenigen Sekunden
    ausloesen: ({ beginnIn = 6 } = {}) => {
      const s = jState(st());
      if (s.heute?.tag === st().day && s.heute.phase !== 'ausgefallen' && s.heute.phase !== 'zurueck') return s.heute;
      s.heute = null;
      const h = planen(st(), api.ctx, null, { erzwingen: true });
      if (h) {
        h.beginnBei = st().clock + beginnIn;
        api.dispatch([{ type: 'jugend', phase: h.phase, berthId: h.platz, auto: h.auto, neu: true }]);
      }
      return h;
    },
  };

  // Ansicht und Meldung (je eine Datei, keine eigene MODULES-Zeile)
  try {
    const [bild, meldung] = await Promise.all([import('../render/jugend-bild.js'), import('../ui/jugend-meldung.js')]);
    bild.initJugendBild(game);
    meldung.initJugendMeldung(game);
  } catch (err) {
    console.error('Jugendtraining: Ansicht oder Meldung nicht geladen', err);
  }

  // Logbuch: eine Zeile in der Chronik des Tages
  game.on('sim:jugend', (e) => {
    if (e.phase === 'zurueck') {
      const g = game.jugendtraining.heute()?.gruppe ?? gruppeFuer(st());
      const was = g.jollen ? `${g.optis} Optis und ${g.jollen} Jollen` : `${g.optis} Optis`;
      game.logbuch?.merken?.({ a: 'text', art: 'jugend', text: `Jugendtraining: ${was} waren draußen` });
    }
  });

  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
  if (q?.get('jugend') === 'jetzt') {
    const start = Date.now();
    const t = setInterval(() => {
      const bereit = st()?.phase === 'day' && game.jugendBild?.aktiv && game.boatsVisible;
      if (bereit && Date.now() - start > 2500) { clearInterval(t); game.jugendtraining.ausloesen(); }
      else if (Date.now() - start > 30000) clearInterval(t);
    }, 250);
  }
}

export default init;
