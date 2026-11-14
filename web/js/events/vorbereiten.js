// Ereignisse zum Vorbereiten (Roadmap P24, Detailpunkte G1, G2, G6).
//
// Sturm (ab Stufe 3): Stirnplätze an den Stegköpfen und der Kai liegen offen zur See
// (economy.js platzarten offen). Wer dort beim Sturm liegt, bewertet schlechter (Wirkung
// satisfaction.outer, gemindert durch die Seenotretter). Am Tag vor dem Sturm kann man den Hafen
// "sturmklar machen": Gäste von offenen Plätzen werden nach innen verholt, die offenen Plätze
// bleiben bis nach dem Sturm für Gäste gesperrt.
//
// Regatta (ab Stufe 3 mit Segelclub): Nach der Ankündigung kann man Plätze für die Regatta
// freihalten. Bis zum Start bleiben sie leer, während der Regatta nehmen sie nur Segelboote.
// Jedes Segelboot auf einem freigehaltenen Platz zahlt einmal Startgeld (Tagesabschluss:
// Sonstiges, "regatta").
//
// Am Abend des letzten Ereignistags kommt das Ergebnis als Meldung (Meldungs-Ordnung, Vorrang
// 'ereignis'). Zahlen in data/economy.js unter ereignisse.regatta.vorbereiten.
//
// Der Stand liegt in state.modules.vorbereitung und wird mit dem Spielstand gespeichert.
// Die Regeln sind reine Funktionen (state, ctx, plan) und laufen auch in Node (tests/vorbereiten.test.mjs).
// plan ist das angekündigte oder laufende Ereignis: { id, startDay, endDay }.
import * as sim from '../sim.js';
import { ECONOMY } from '../data/economy.js';

export const REGATTA = ECONOMY.ereignisse.regatta?.vorbereiten ?? { plaetze: {}, startgeld: {} };

/** Eigener Stand im Spielstand */
export function vState(state) {
  if (!state.modules || typeof state.modules !== 'object') state.modules = {};
  const v = (state.modules.vorbereitung ||= {});
  return v;
}

const offen = (ctx, berthId) => !!ctx.berthById[berthId]?.exposed;
const istSegler = (ctx, boat) => !!ctx.typeById[boat?.typeId]?.sail;

/** Gäste, die gerade an offenen Plätzen liegen (auch die auf Tagestörn). */
export function draussen(state, ctx) {
  return sim.mooredBoats(state).filter((b) => !b.stationed && offen(ctx, b.berthId));
}

/** Gibt es in dieser Stufe überhaupt offene Plätze? */
export function hatOffenePlaetze(state, ctx) {
  return sim.availableBerths(state, ctx).some((b) => b.exposed);
}

/** Bester freier Platz innen für einen Gast oder null */
export function innenZiel(state, ctx, boatId) {
  return sim.fittingBerths(state, ctx, boatId).find((id) => !offen(ctx, id)) ?? null;
}

function verhole(state, ctx, boat, to, events) {
  const from = boat.berthId;
  delete state.berths[from];
  state.berths[to] = boat.id;
  boat.berthId = to;
  boat.snug = sim.isSnug(state, ctx, boat, ctx.berthById[to]);
  events.push({ type: 'relocated', boatId: boat.id, from, to, guest: true, grund: 'sturm' });
}

/**
 * Hafen sturmklar machen: offene Plätze sperren, Gäste von dort nach innen verholen.
 * Gäste auf Tagestörn bleiben auf ihrem Platz (ihre Box ist für die Rückkehr reserviert).
 * Gibt { ok, verholt, bleiben, events } zurück.
 */
export function sturmklar(state, ctx, plan) {
  if (!plan || plan.id !== 'sturm') return { ok: false, verholt: 0, bleiben: 0, events: [] };
  const v = vState(state);
  const s = (v.sturm = { ...(v.sturm || {}), startDay: plan.startDay, endDay: plan.endDay, klar: true });
  const events = [];
  let verholt = 0;
  let bleiben = 0;
  // Größere Boote zuerst: für sie gibt es innen am wenigsten Plätze
  const liste = draussen(state, ctx).sort((a, b) => (b.length * b.beam) - (a.length * a.beam));
  for (const boat of liste) {
    const to = boat.trip?.away ? null : innenZiel(state, ctx, boat.id);
    if (to) { verhole(state, ctx, boat, to, events); verholt++; } else bleiben++;
  }
  s.verholt = (s.verholt || 0) + verholt;
  events.push({ type: 'sturmklar', verholt, bleiben, day: state.day });
  return { ok: true, verholt, bleiben, events };
}

/** Sturmklar wieder aufheben (offene Plätze für Gäste frei). */
export function sturmklarAufheben(state) {
  const v = vState(state);
  if (v.sturm) v.sturm.klar = false;
  return { ok: true, events: [{ type: 'sturmklar', aufgehoben: true, day: state.day }] };
}

/** Wie viele Plätze die Regatta in dieser Stufe freihalten darf */
export const regattaAnzahl = (stage) => REGATTA.plaetze?.[stage] ?? REGATTA.plaetze?.[Math.max(...Object.keys(REGATTA.plaetze ?? {}).map(Number).filter((s) => s <= stage), 0)] ?? 0;

/** Freie Gastplätze, an die ein Segelboot dieser Stufe passt (der knappste zuerst). */
export function regattaKandidaten(state, ctx) {
  const typen = ctx.types.filter((t) => t.sail && !t.stationed && (t.minStage ?? 1) <= state.stage && (REGATTA.startgeld?.[t.size] ?? 0) > 0);
  const proben = typen.map((t) => ({ size: t.size, length: t.length[0], beam: t.beam[0], draft: t.draft[0], stationed: false, typeId: t.id, wishes: [], nights: 1 }));
  const v = vState(state);
  const schon = new Set(v.regatta?.plaetze ?? []);
  return sim.availableBerths(state, ctx)
    .filter((b) => !b.exposed && !b.reserved && !schon.has(b.id) && sim.isFree(state, b.id))
    .filter((b) => proben.some((p) => sim.fits(p, b, ctx.rules, state.stage) && !sim.hookWhyNotFit(state, ctx, p, b)))
    .sort((a, b) => (a.maxLength * a.maxBeam) - (b.maxLength * b.maxBeam) || String(a.id).localeCompare(String(b.id)))
    .map((b) => b.id);
}

/** Plätze für die Regatta freihalten. Gibt { ok, plaetze, events } zurück. */
export function regattaFreihalten(state, ctx, plan) {
  if (!plan || plan.id !== 'regatta') return { ok: false, plaetze: [], events: [] };
  const v = vState(state);
  const n = regattaAnzahl(state.stage);
  const alt = v.regatta?.startDay === plan.startDay ? v.regatta : null;
  const haben = alt?.plaetze ?? [];
  const neu = regattaKandidaten(state, ctx).slice(0, Math.max(0, n - haben.length));
  v.regatta = { startDay: plan.startDay, endDay: plan.endDay, plaetze: [...haben, ...neu], bezahlt: alt?.bezahlt ?? {}, startgeld: alt?.startgeld ?? 0, teilnehmer: alt?.teilnehmer ?? 0 };
  return { ok: v.regatta.plaetze.length > 0, plaetze: v.regatta.plaetze, events: [{ type: 'regattaPlaetze', plaetze: v.regatta.plaetze, day: state.day }] };
}

export function regattaFreigeben(state) {
  const v = vState(state);
  const plaetze = v.regatta?.plaetze ?? [];
  if (v.regatta) v.regatta.plaetze = [];
  return { ok: true, events: [{ type: 'regattaPlaetze', plaetze: [], frei: plaetze, day: state.day }] };
}

// ---------------------------------------------------------------- Hooks der Spielregeln

/** Passregel: gesperrte offene Plätze beim Sturm, freigehaltene Plätze vor und bei der Regatta */
export function fitHook({ state, boat, berth, ctx }) {
  if (boat.stationed) return null;
  const v = state.modules?.vorbereitung;
  if (!v) return null;
  if (v.sturm?.klar && berth.exposed && state.day <= v.sturm.endDay) return 'sturm';
  const r = v.regatta;
  if (r?.plaetze?.includes(berth.id) && state.day <= r.endDay) {
    if (state.day < r.startDay) return 'regatta';
    // während der Regatta: nur Segelboote (das Grün-Rot-Schild fragt mit einer Probe ohne Bootsart: frei)
    if (boat.probe) return null;
    if (!istSegler(ctx, boat)) return 'regatta';
  }
  return null;
}

/**
 * Abends: Startgeld der Regatta, Ergebnis am letzten Ereignistag.
 * plan(): { id, startDay, endDay } des laufenden Ereignisses oder null; schutz(): satisfaction.outer heute.
 */
export function abendHook({ state, ctx, events, addIncome }, { laufend = () => null, outer = () => 0 } = {}) {
  const v = state.modules?.vorbereitung;
  const day = state.day;
  const r = v?.regatta;
  if (r && day >= r.startDay && day <= r.endDay) {
    for (const id of r.plaetze) {
      const boat = state.boats[state.berths[id]];
      if (!boat || boat.stationed || !istSegler(ctx, boat) || r.bezahlt[boat.id]) continue;
      const geld = REGATTA.startgeld?.[boat.size] ?? 0;
      r.bezahlt[boat.id] = geld;
      if (geld > 0) {
        addIncome(geld, 'sonstiges', 'regatta');
        r.startgeld += geld;
      }
      r.teilnehmer += 1;
    }
  }
  const ev = laufend();
  if (!ev || day !== ev.endDay) return;
  if (ev.id === 'regatta') {
    const vorbereitet = !!(r && r.startDay === ev.startDay && r.plaetze.length);
    events.push({ type: 'ereignisErgebnis', art: 'regatta', day, vorbereitet, plaetze: vorbereitet ? r.plaetze.length : 0, teilnehmer: vorbereitet ? r.teilnehmer : 0, startgeld: vorbereitet ? r.startgeld : 0 });
  }
  if (ev.id === 'sturm') {
    const s = v?.sturm && v.sturm.startDay === ev.startDay ? v.sturm : null;
    events.push({ type: 'ereignisErgebnis', art: 'sturm', day, vorbereitet: !!s?.klar, verholt: s?.verholt ?? 0, draussen: s?.draussen ?? 0, innen: s?.innen ?? 0, anker: Math.max(0, -outer()) });
  }
}

/**
 * Nachts: vor dem Sturmtag zählen, wer draußen liegt (diese Gäste trifft der Sturm am Morgen).
 * Nach dem Ereignis den Stand aufräumen.
 */
export function nachtHook({ state, ctx }, { geplant = () => null } = {}) {
  const v = state.modules?.vorbereitung;
  const p = geplant();
  if (p?.id === 'sturm' && p.startDay === state.day + 1) {
    const vv = vState(state);
    if (!vv.sturm || vv.sturm.startDay !== p.startDay) vv.sturm = { startDay: p.startDay, endDay: p.endDay, klar: false, verholt: 0 };
    const gaeste = sim.mooredBoats(state).filter((b) => !b.stationed);
    vv.sturm.draussen = gaeste.filter((b) => offen(ctx, b.berthId)).length;
    vv.sturm.innen = gaeste.length - vv.sturm.draussen;
  }
  if (!v) return;
  if (v.sturm && state.day >= v.sturm.endDay) delete v.sturm;
  if (v.regatta && state.day >= v.regatta.endDay) delete v.regatta;
}

/** Hooks in einen Regel-Kontext hängen (Browser über game.sim.addHook, Tests über sim.addHook). */
export function haengeEin(addHook, { laufend, geplant, outer } = {}) {
  const ab = [
    addHook('fit', fitHook),
    addHook('evening', (a) => abendHook(a, { laufend, outer })),
    addHook('night', (a) => nachtHook(a, { geplant })),
  ];
  return () => ab.forEach((f) => f());
}

// ---------------------------------------------------------------- Texte

const plural = (n, eins, viele) => `${n} ${n === 1 ? eins : viele}`;
const euro = (n) => `${Math.round(n).toLocaleString('de-DE')} €`;

/** Text des Ergebnisses am Abend: { titel, text, symbol } */
export function ergebnisText(e) {
  if (e.art === 'regatta') {
    if (!e.vorbereitet) {
      return { symbol: 'regatta', titel: 'Regatta vorbei', text: 'Die Segler sind zufrieden gesegelt. Nächstes Mal Plätze freihalten: jedes Regattaboot darauf zahlt Startgeld.' };
    }
    return {
      symbol: 'regatta',
      titel: 'Regatta vorbei',
      text: e.teilnehmer > 0
        ? `${plural(e.teilnehmer, 'Regattaboot lag', 'Regattaboote lagen')} auf deinen ${e.plaetze} freigehaltenen Plätzen. Startgeld: ${euro(e.startgeld)}.`
        : `Deine ${e.plaetze} freigehaltenen Plätze blieben leer. Die Segler fanden schon anderswo Platz.`,
    };
  }
  const titel = 'Sturm überstanden';
  if (e.draussen > 0) {
    const folge = e.anker > 0 ? 'bewerten schlechter' : 'blieben gelassen: die Seenotretter hielten Wache';
    const vorher = e.verholt > 0 ? `${plural(e.verholt, 'Gast lag', 'Gäste lagen')} sicher innen. ` : '';
    return { symbol: 'sturm', titel, text: `${vorher}${plural(e.draussen, 'Gast lag', 'Gäste lagen')} an offenen Plätzen und ${folge}.` };
  }
  if (e.verholt > 0) return { symbol: 'sturm', titel, text: `Alle Gäste lagen geschützt innen. ${plural(e.verholt, 'Boot', 'Boote')} hast du rechtzeitig verholt.` };
  return { symbol: 'sturm', titel, text: 'Kein Gast lag an offenen Plätzen. Der Hafen hat den Sturm gut überstanden.' };
}
