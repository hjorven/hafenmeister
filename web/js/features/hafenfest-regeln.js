// Eigenes Hafenfest (Roadmap P38, F12): Regeln ohne DOM und ohne Three.js, laufen auch in Node
// (tests/hafenfest.test.mjs, tools/balance.mjs).
//
// Einmal je Saison setzt der Spieler ab Stufe 3 ein Hafenfest an: Er wählt einen Tag (frühestens
// übermorgen, nicht neben anderen Ereignissen) und was dazugehört (Schmuck, Musik, Marktstände,
// Feuerwerk). Die Vorbereitung kostet beim Ansetzen Geld. Am Festtag kommen viel mehr Boote und
// Besucher, der Hafen wird voll. Abends kommt die Bilanz.
//
// Das Fest selbst ist das Ereignis 'hafenfest' im Ereignisplaner (events/scheduler.js, eigener Platz
// s.eigen): Ankündigung, Wetter, Wetterbericht, Wirkung auf die Spielregeln, Nachspiel und Abstand zu den
// anderen Ereignissen kommen von dort. Dieses Modul rechnet Kosten und Wirkung der Teile, bucht das
// Geld und merkt sich je Saison, ob schon gefeiert wurde (state.modules.hafenfest).
//
// Päckchen (P27): Am Festtag liegen Boote gern im Päckchen. Wer am Festabend im Päckchen liegt, bekommt
// den Abzug dafür zurück (Hook rating), so wie es in echten Häfen bei Festen üblich ist.
//
// Zahlen: ECONOMY.ereignisse.hafenfest (eigen.kosten, eigen.teile, eigen.vorlauf, eigen.erstattung).
import * as sim from '../sim.js';
import { ECONOMY } from '../data/economy.js';
import { seasonOf } from '../events/scheduler.js';
import { YEAR } from '../data/events.js';

export const FEST = ECONOMY.ereignisse.hafenfest ?? null;
export const EIGEN = FEST?.eigen ?? null;
export const TEILE = Object.keys(EIGEN?.teile ?? {});
export const AB_STUFE = FEST?.abStufe ?? 3;
export const VORLAUF = EIGEN?.vorlauf ?? 2;

/** Namen und kurze Texte der Teile (ohne Zahlen, die stehen in economy.js) */
export const TEIL_TEXTE = {
  schmuck: { name: 'Schmuck', text: 'Wimpelketten über den Stegen. Gäste bewerten besser.' },
  musik: { name: 'Musik', text: 'Kapelle auf einer Bühne am Hafen. Viel mehr Besucher.' },
  markt: { name: 'Marktstände', text: 'Stände am Hafen zahlen Standgeld, Versorgung verdient mehr.' },
  feuerwerk: { name: 'Feuerwerk', text: 'Abends Feuerwerk. Crews bleiben eine Nacht länger.' },
};

/** Warum ein Tag nicht geht (Gründe aus scheduler.eigenFrei) */
export const GRUND_TEXTE = {
  saison: 'außerhalb der Festzeit',
  vorlauf: 'zu kurzfristig',
  ereignis: 'zu nah an einem anderen Ereignis',
  fest: 'zu nah an einem festen Fest',
  gross: 'freihalten für die Hanse-Woche',
  gesetzt: 'schon ein Fest angesetzt',
  vorbei: 'schon vorbei',
};

const ABENDE = 4;          // so viele normale Abende zählen für den Vergleich in der Bilanz
const stufeIdx = (stufe) => Math.max(0, Math.min(5, Math.round(stufe || 1) - 1));
const betrag = (liste, stufe) => Math.max(0, Math.round(liste?.[stufeIdx(stufe)] ?? 0));

/** Eigener Stand im Spielstand */
export function fState(state) {
  if (!state.modules || typeof state.modules !== 'object') state.modules = {};
  const f = (state.modules.hafenfest ||= {});
  f.jahr ??= null;          // Jahr, in dem das Fest dieser Saison angesetzt wurde (oder gefeiert)
  f.tag ??= null;           // Spieltag des angesetzten Fests
  f.teile ??= [];
  f.kosten ??= 0;           // bezahlt fürs angesetzte Fest
  f.gefeiert ??= 0;         // wie viele eigene Feste schon
  f.letztes ??= null;       // Bilanz des letzten Fests
  f.gesehen ??= null;       // Jahr, in dem der Hinweis zum Ansetzen kam (Oberfläche)
  f.abende ??= [];          // Boote im Hafen an den letzten normalen Abenden (Vergleich in der Bilanz)
  return f;
}

/** Teile in fester Reihenfolge, nur bekannte */
export const ordne = (teile) => TEILE.filter((t) => (teile ?? []).includes(t));

/** Was die Vorbereitung kostet: { grund, teile: { id: betrag }, summe } */
export function kosten(stufe, teile = []) {
  const grund = betrag(EIGEN?.kosten, stufe);
  const je = {};
  for (const t of ordne(teile)) je[t] = betrag(EIGEN.teile[t].kosten, stufe);
  return { grund, teile: je, summe: grund + Object.values(je).reduce((a, b) => a + b, 0) };
}

/** Kosten eines einzelnen Teils in dieser Stufe */
export const teilKosten = (stufe, teil) => betrag(EIGEN?.teile?.[teil]?.kosten, stufe);
/** Standgeld der Marktstände abends */
export const standgeld = (stufe) => betrag(EIGEN?.teile?.markt?.standgeld, stufe);

/**
 * Zusätzliche Wirkung der Teile zur Grundwirkung des Fests (ECONOMY.ereignisse.hafenfest.wirkung), so
 * aufbereitet, wie scheduler.mergeMods sie dazumischt: Zahlen ersetzen (darum schon mit der Grundwirkung
 * verrechnet: Faktoren mal, ratingBonus und extraNights plus), kindFactor und sizeFactor multiplizieren.
 */
export function wirkung(teile = [], basis = FEST?.wirkung ?? {}) {
  const out = {};
  const plus = new Set(['ratingBonus', 'extraNights']);
  for (const t of ordne(teile)) {
    for (const [k, v] of Object.entries(EIGEN.teile[t].wirkung ?? {})) {
      if (k === 'kindFactor' || k === 'sizeFactor') {
        out[k] ??= {};
        for (const [kk, vv] of Object.entries(v)) out[k][kk] = (out[k][kk] ?? 1) * vv;
      } else if (typeof v === 'number') {
        const alt = out[k] ?? basis[k] ?? (plus.has(k) ? 0 : 1);
        out[k] = plus.has(k) ? alt + v : alt * v;
      }
    }
  }
  return Object.keys(out).length ? out : null;
}

/** Leute an Land am Festtag: Grundwert des Fests, mit Musik mehr (render/people.js liest current.menschen) */
export function menschen(teile = []) {
  const m = JSON.parse(JSON.stringify(FEST?.menschen ?? {}));
  const f = ordne(teile).reduce((a, t) => a * (EIGEN.teile[t].menschen ?? 1), 1);
  if (f !== 1) {
    for (const k of Object.keys(m)) if (typeof m[k] === 'number') m[k] *= f;
    if (m.abends) for (const k of Object.keys(m.abends)) m.abends[k] *= f;
    m.ort ??= f;
  }
  return Object.keys(m).length ? m : null;
}

/** Abendeffekt: Feuerwerk nur, wenn gebucht */
export const abendEffekt = (teile = []) => (ordne(teile).includes('feuerwerk') ? 'feuerwerk' : null);

const jahrVon = (tag) => seasonOf(Math.max(1, tag), YEAR).year;

/**
 * Stand für die Oberfläche: { frei, grund, jahr, angesetzt: { tag, teile, kosten } | null, laeuft, gefeiert }
 * frei: man kann jetzt ein Fest ansetzen. grund (wenn nicht): 'stufe', 'winter', 'gefeiert', 'angesetzt', 'spaet'.
 */
export function stand(state, sched) {
  const f = fState(state);
  const heute = Math.max(1, state.day ?? 1);
  const s = seasonOf(heute, YEAR);
  const jahr = s.year;
  const eigen = sched?.eigen?.id === 'hafenfest' ? sched.eigen : null;
  const cur = sched?.current;
  const laeuft = !!(cur?.eigen && cur.id === 'hafenfest');
  const angesetzt = eigen ? { tag: eigen.startDay, teile: ordne(eigen.teile), kosten: f.jahr === jahrVon(eigen.startDay) ? f.kosten : 0 } : null;
  let grund = null;
  if ((state.stage ?? 1) < AB_STUFE) grund = 'stufe';
  else if (s.winter) grund = 'winter';
  else if (angesetzt || laeuft) grund = 'angesetzt';
  else if (f.jahr === jahr) grund = 'gefeiert';
  else if (!festTage(state, sched).some((t) => t.frei)) grund = 'spaet';
  return { frei: !grund, grund, jahr, angesetzt, laeuft, gefeiert: f.gefeiert, letztes: f.letztes };
}

/**
 * Alle Saisontage dieses Jahres im erlaubten Fenster: [{ tag, saisonTag, frei, grund }].
 * grund ist ein Schlüssel aus GRUND_TEXTE. Bereits angesetztes Fest zählt nicht als Hindernis (zum Umplanen).
 */
export function festTage(state, sched) {
  const heute = Math.max(1, state.day ?? 1);
  const s = seasonOf(heute, YEAR);
  if (s.winter) return [];
  const [von, bis] = FEST?.saison ?? [1, YEAR.seasonDays];
  const jahrStart = heute - s.seasonDay;     // Tag vor Saisontag 1
  const out = [];
  for (let sd = von; sd <= bis; sd++) {
    const tag = jahrStart + sd;
    let grund = tag < heute ? 'vorbei' : sched?.eigenFrei?.(tag, { id: 'hafenfest', heute, vorlauf: VORLAUF, ohneEigenes: true }) ?? null;
    out.push({ tag, saisonTag: sd, frei: !grund, grund });
  }
  return out;
}

/**
 * Fest ansetzen: prüft Stufe, Saison, Tag und Geld, bucht die Vorbereitung (Ausgaben 'fest') und legt
 * das Fest in den Planer. Gibt { ok, grund, kosten } zurück; grund: 'stufe', 'winter', 'gefeiert',
 * 'angesetzt', 'tag', 'geld' oder ein Grund aus GRUND_TEXTE.
 */
export function ansetzen(state, sched, tag, teile = []) {
  const f = fState(state);
  const st = stand(state, sched);
  if (!st.frei && st.grund !== 'spaet') return { ok: false, grund: st.grund };
  const t = festTage(state, sched).find((x) => x.tag === tag);
  if (!t) return { ok: false, grund: 'tag' };
  if (!t.frei) return { ok: false, grund: t.grund };
  const liste = ordne(teile);
  const k = kosten(state.stage, liste);
  if ((state.money ?? 0) < k.summe) return { ok: false, grund: 'geld', kosten: k };
  if (!sched.ansetzen('hafenfest', tag, { extra: wirkung(liste), evening: abendEffekt(liste), menschen: menschen(liste), teile: liste })) {
    return { ok: false, grund: 'tag' };
  }
  sim.spend(state, k.summe, 'fest');
  Object.assign(f, { jahr: jahrVon(tag), tag, teile: liste, kosten: k.summe });
  return { ok: true, kosten: k, events: [{ type: 'hafenfestAngesetzt', tag, teile: liste, kosten: k.summe }] };
}

/** Wie viel man beim Absagen zurückbekommt */
export const erstattung = (state) => Math.round((fState(state).kosten || 0) * (EIGEN?.erstattung ?? 0.5));

/**
 * Angesetztes Fest absagen (bis zum Vorabend, also solange es nicht heute ist). Ein Teil der Kosten kommt
 * zurück (Einnahmen: Sonstiges). Danach kann man in dieser Saison neu ansetzen.
 */
export function absagen(state, sched) {
  const f = fState(state);
  const e = sched?.eigen;
  if (!e || e.id !== 'hafenfest') return { ok: false, grund: 'keins' };
  if (e.startDay <= (state.day ?? 1)) return { ok: false, grund: 'heute' };
  const zurueck = erstattung(state);
  sched.absetzen();
  if (zurueck > 0) sim.addIncome(state, zurueck, 'sonstiges', 'festAbgesagt');
  Object.assign(f, { jahr: null, tag: null, teile: [], kosten: 0 });
  return { ok: true, zurueck, events: [{ type: 'hafenfestAbgesagt', zurueck }] };
}

/** Läuft heute das eigene Hafenfest? (current aus dem Planer) */
export const heuteFest = (cur, tag) => !!(cur && cur.id === 'hafenfest' && cur.eigen && tag >= cur.startDay && tag <= cur.endDay);

/**
 * Hooks in die Spielregeln (sim.addHook):
 * - evening: am Festabend Standgeld der Marktstände, Päckchen-Gäste merken, Bilanz (Ereignis
 *   'hafenfestErgebnis'); am Abend davor 'hafenfestVorabend' (der Hafen wird geschmückt).
 * - rating: Päckchen am Festabend ohne Abzug.
 * plan() liefert den Planer (events/scheduler.js) oder null.
 */
export function haengeEin(addHook, { plan }) {
  addHook('evening', ({ state, ctx, boats, events, addIncome }) => {
    const sched = plan?.();
    if (!sched) return;
    const f = fState(state);
    const cur = sched.current;
    if (heuteFest(cur, state.day)) {
      const teile = ordne(cur.teile);
      let stand = 0;
      if (teile.includes('markt')) {
        stand = standgeld(state.stage);
        if (stand > 0) addIncome(stand, 'sonstiges', 'hafenfest');
      }
      // Päckchen am Festabend: kein Abzug (siehe rating)
      let paeckchen = 0;
      for (const b of boats ?? sim.mooredBoats(state)) {
        if (b.paeckchen || b.paeckchenInnen) { b.festPaeckchen = true; if (b.paeckchen) paeckchen++; }
      }
      if (state.day === cur.endDay) {
        const h = sim.heute(state);
        const einnahmen = Object.values(h.einnahmen ?? {}).reduce((a, x) => a + (x || 0), 0);
        const besucher = (events ?? []).filter((e) => e.type === 'visitorIncome').reduce((a, e) => a + (e.visitors || 0), 0);
        const alle = ctx ? sim.availableBerths(state, ctx) : [];
        const plaetze = alle.length;
        const belegt = alle.filter((b) => state.berths?.[b.id]).length;
        const sonst = f.abende.length ? Math.round(f.abende.reduce((a, x) => a + x, 0) / f.abende.length) : null;
        const ergebnis = {
          tag: state.day, teile, boote: (boats ?? []).length, sonst, besucher, einnahmen, standgeld: stand,
          kosten: f.tag === cur.startDay ? f.kosten : 0, paeckchen, voll: plaetze > 0 ? Math.min(1, belegt / plaetze) : 0,
        };
        f.gefeiert += 1;
        f.letztes = ergebnis;
        f.tag = null;
        events?.push({ type: 'hafenfestErgebnis', ...ergebnis });
      }
    } else {
      // Normale Abende merken (ohne Ereignis): so viele Boote liegen sonst im Hafen
      if (!cur) f.abende = [...f.abende, (boats ?? []).length].slice(-ABENDE);
      if (sched.eigen?.id === 'hafenfest' && sched.eigen.startDay === state.day + 1) {
        events?.push({ type: 'hafenfestVorabend', tag: sched.eigen.startDay, teile: ordne(sched.eigen.teile) });
      }
    }
  });
  addHook('rating', ({ ctx, boat }) => (boat?.festPaeckchen ? sim.raftPenalty(ctx, boat) : 0));
}
