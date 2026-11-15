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
// Hanse-Woche (ab Stufe 5, G9): zehn Tage vorher angekündigt. Ebenso Plätze freihalten, hier große
// (für L und XL); jedes große Schiff darauf zahlt einmal Festgeld (Sonstiges, "hansewoche").
//
// Bauten (G7): Gebaute Services machen ein Ereignis größer (economy.js ereignisse.<id>.bauten). An jedem
// Ereignistag bringt jeder passende Bau abends Geld (Tagesabschluss: Services, beim Bau).
//
// Nachspiel (G3): Wer vorbereitet war (sturmklar, Plätze freigehalten), bekommt nach dem Ereignis einen
// Bonus (scheduler.js modifiers, vorbereitet). Gemerkt in nachspiel[id] bis zum Ende des Nachspiels.
//
// Am Abend des letzten Ereignistags kommt das Ergebnis als Meldung (Meldungs-Ordnung, Vorrang
// 'ereignis'). Zahlen in data/economy.js unter ereignisse.regatta.vorbereiten und hansewoche.vorbereiten.
//
// Der Stand liegt in state.modules.vorbereitung und wird mit dem Spielstand gespeichert.
// Die Regeln sind reine Funktionen (state, ctx, plan) und laufen auch in Node (tests/vorbereiten.test.mjs).
// plan ist das angekündigte oder laufende Ereignis: { id, startDay, endDay }.
import * as sim from '../sim.js';
import { ECONOMY } from '../data/economy.js';

export const REGATTA = ECONOMY.ereignisse.regatta?.vorbereiten ?? { plaetze: {}, startgeld: {} };
export const HANSE = ECONOMY.ereignisse.hansewoche?.vorbereiten ?? { plaetze: {}, festgeld: {} };
/** Bauten je Ereignis (G7): { id: { proTag: [je Ausbaustufe], text, wirkung? } } */
export const BAUTEN = Object.fromEntries(Object.entries(ECONOMY.ereignisse).filter(([, z]) => z?.bauten).map(([id, z]) => [id, z.bauten]));

/** Eigener Stand im Spielstand */
export function vState(state) {
  if (!state.modules || typeof state.modules !== 'object') state.modules = {};
  const v = (state.modules.vorbereitung ||= {});
  return v;
}

const offen = (ctx, berthId) => !!ctx.berthById[berthId]?.exposed;
const istSegler = (ctx, boat) => !!ctx.typeById[boat?.typeId]?.sail;
const GROSS = new Set(['L', 'XL']);

// Plätze freihalten: Regatta (Segelboote, Startgeld) und Hanse-Woche (große Schiffe, Festgeld).
// typ(t): darf dieser Bootstyp auf den Platz; geld: Betrag je Größe.
export const FREIHALTEN = {
  regatta: { cfg: REGATTA, geld: REGATTA.startgeld ?? {}, typ: (t) => !!t?.sail, quelle: 'regatta' },
  hansewoche: { cfg: HANSE, geld: HANSE.festgeld ?? {}, typ: (t) => GROSS.has(t?.size), quelle: 'hansewoche' },
};
const darfAufPlatz = (art, ctx, boat) => FREIHALTEN[art].typ(ctx.typeById[boat?.typeId] ?? boat);

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
  if (sim.isRaftBerth(from)) boat.paeckchen = null;   // aus dem Päckchen in eine Box (P27)
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
  // Größere Boote zuerst: für sie gibt es innen am wenigsten Plätze. Boote außen im Päckchen (P27)
  // vor allen anderen, denn das innere kann erst weg, wenn das äußere fort ist.
  const aussen = (b) => Number(sim.isRaftBerth(b.berthId));
  const liste = draussen(state, ctx).sort((a, b) => aussen(b) - aussen(a) || (b.length * b.beam) - (a.length * a.beam));
  for (const boat of liste) {
    const to = boat.trip?.away || sim.raftBlocked(state, boat.berthId) ? null : innenZiel(state, ctx, boat.id);
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

/** Wie viele Plätze ein Ereignis (regatta, hansewoche) in dieser Stufe freihalten darf */
export function freihaltenAnzahl(art, stage) {
  const p = FREIHALTEN[art]?.cfg?.plaetze ?? {};
  if (p[stage] != null) return p[stage];
  const bis = Object.keys(p).map(Number).filter((x) => x <= stage);
  return bis.length ? p[Math.max(...bis)] : 0;
}
export const regattaAnzahl = (stage) => freihaltenAnzahl('regatta', stage);

/** Freie Gastplätze, an die ein passendes Boot dieser Stufe passt (der knappste zuerst). */
export function freihaltenKandidaten(art, state, ctx) {
  const f = FREIHALTEN[art];
  const typen = ctx.types.filter((t) => f.typ(t) && !t.stationed && !t.special && (t.minStage ?? 1) <= state.stage && (f.geld?.[t.size] ?? 0) > 0);
  const proben = typen.map((t) => ({ size: t.size, length: t.length[0], beam: t.beam[0], draft: t.draft[0], stationed: false, typeId: t.id, wishes: [], nights: 1 }));
  const v = vState(state);
  const schon = new Set(Object.keys(FREIHALTEN).flatMap((k) => v[k]?.plaetze ?? []));
  // Große Plätze für die Hanse-Woche: die größten zuerst, sonst die knappsten
  const ordnung = art === 'hansewoche' ? -1 : 1;
  return sim.availableBerths(state, ctx)
    .filter((b) => !b.exposed && !b.reserved && !schon.has(b.id) && sim.isFree(state, b.id))
    .filter((b) => proben.some((p) => sim.fits(p, b, ctx.rules, state.stage) && !sim.hookWhyNotFit(state, ctx, p, b)))
    .sort((a, b) => ordnung * ((a.maxLength * a.maxBeam) - (b.maxLength * b.maxBeam)) || String(a.id).localeCompare(String(b.id)))
    .map((b) => b.id);
}
export const regattaKandidaten = (state, ctx) => freihaltenKandidaten('regatta', state, ctx);

/** Plätze für ein Ereignis freihalten. Gibt { ok, plaetze, events } zurück. */
export function freihalten(art, state, ctx, plan) {
  if (!plan || plan.id !== art || !FREIHALTEN[art]) return { ok: false, plaetze: [], events: [] };
  const v = vState(state);
  const n = freihaltenAnzahl(art, state.stage);
  const alt = v[art]?.startDay === plan.startDay ? v[art] : null;
  const haben = alt?.plaetze ?? [];
  const neu = freihaltenKandidaten(art, state, ctx).slice(0, Math.max(0, n - haben.length));
  v[art] = { startDay: plan.startDay, endDay: plan.endDay, plaetze: [...haben, ...neu], bezahlt: alt?.bezahlt ?? {}, startgeld: alt?.startgeld ?? 0, teilnehmer: alt?.teilnehmer ?? 0 };
  return { ok: v[art].plaetze.length > 0, plaetze: v[art].plaetze, events: [{ type: 'regattaPlaetze', art, plaetze: v[art].plaetze, day: state.day }] };
}
export const regattaFreihalten = (state, ctx, plan) => freihalten('regatta', state, ctx, plan);

export function freigeben(art, state) {
  const v = vState(state);
  const plaetze = v[art]?.plaetze ?? [];
  if (v[art]) v[art].plaetze = [];
  return { ok: true, events: [{ type: 'regattaPlaetze', art, plaetze: [], frei: plaetze, day: state.day }] };
}
export const regattaFreigeben = (state) => freigeben('regatta', state);

/** Geld, das ein Bau an einem Tag dieses Ereignisses bringt (0, wenn nicht gebaut) */
export function bauGeld(eventId, bauId, stufe) {
  const b = BAUTEN[eventId]?.[bauId];
  if (!b || !(stufe > 0)) return 0;
  return b.proTag[Math.min(stufe, b.proTag.length) - 1] ?? 0;
}

// ---------------------------------------------------------------- Hooks der Spielregeln

/** Passregel: gesperrte offene Plätze beim Sturm, freigehaltene Plätze vor und bei Regatta und Hanse-Woche */
export function fitHook({ state, boat, berth, ctx }) {
  if (boat.stationed) return null;
  const v = state.modules?.vorbereitung;
  if (!v) return null;
  if (v.sturm?.klar && berth.exposed && state.day <= v.sturm.endDay) return 'sturm';
  for (const art of Object.keys(FREIHALTEN)) {
    const r = v[art];
    if (!r?.plaetze?.includes(berth.id) || state.day > r.endDay) continue;
    if (state.day < r.startDay) return art;
    // während des Ereignisses: nur passende Boote (das Grün-Rot-Schild fragt mit einer Probe ohne Bootsart: frei)
    if (boat.probe) return null;
    if (!darfAufPlatz(art, ctx, boat)) return art;
  }
  return null;
}

/**
 * Platzwahl: Während der Regatta (Hanse-Woche) fahren passende Boote bevorzugt auf die freigehaltenen
 * Plätze, vor allen anderen Wünschen (sonst nähmen sie erst andere freie Plätze und das Freihalten brächte nichts).
 */
export function scoreHook({ state, ctx, boat, berth }) {
  const v = state.modules?.vorbereitung;
  if (!v || boat.stationed) return 0;
  for (const art of Object.keys(FREIHALTEN)) {
    const r = v[art];
    if (r?.plaetze?.includes(berth.id) && state.day >= r.startDay && state.day <= r.endDay && darfAufPlatz(art, ctx, boat)) return 5000;
  }
  return 0;
}

/**
 * Abends: Startgeld der Regatta, Festgeld der Hanse-Woche, Geld der Bauten (G7), Ergebnis am letzten Ereignistag.
 * laufend(): { id, startDay, endDay } des laufenden Ereignisses oder null; outer(): satisfaction.outer heute;
 * bauStufe(id): Ausbaustufe eines Services (0 = nicht gebaut).
 */
export function abendHook({ state, ctx, events, addIncome }, { laufend = () => null, outer = () => 0, bauStufe = () => 0 } = {}) {
  const v = state.modules?.vorbereitung;
  const day = state.day;
  for (const art of Object.keys(FREIHALTEN)) {
    const r = v?.[art];
    if (!r || day < r.startDay || day > r.endDay) continue;
    const f = FREIHALTEN[art];
    for (const id of r.plaetze) {
      const boat = state.boats[state.berths[id]];
      if (!boat || boat.stationed || !darfAufPlatz(art, ctx, boat) || r.bezahlt[boat.id] != null) continue;
      const geld = f.geld?.[boat.size] ?? 0;
      r.bezahlt[boat.id] = geld;
      if (geld > 0) {
        addIncome(geld, 'sonstiges', f.quelle);
        r.startgeld += geld;
      }
      r.teilnehmer += 1;
    }
  }
  const ev = laufend();
  if (!ev) return;
  // Bauten (G7): jeder gebaute passende Service bringt an jedem Ereignistag Geld
  const vv = vState(state);
  if (BAUTEN[ev.id]) {
    if (!vv.bau || vv.bau.id !== ev.id || vv.bau.startDay !== ev.startDay) vv.bau = { id: ev.id, startDay: ev.startDay, endDay: ev.endDay, summe: {} };
    for (const bauId of Object.keys(BAUTEN[ev.id])) {
      const geld = bauGeld(ev.id, bauId, bauStufe(bauId));
      if (geld > 0) {
        addIncome(geld, 'services', bauId);
        vv.bau.summe[bauId] = (vv.bau.summe[bauId] ?? 0) + geld;
      }
    }
  }
  if (day !== ev.endDay) return;
  const bau = vv.bau?.id === ev.id && vv.bau.startDay === ev.startDay ? { ...vv.bau.summe } : {};
  const fehlt = Object.keys(BAUTEN[ev.id] ?? {}).filter((id) => !(bauStufe(id) > 0));
  // Nachspiel mit Bonus, wenn man vorbereitet war (scheduler.js modifiers)
  const merke = (ok) => { if (ok) { vv.nachspiel ??= {}; vv.nachspiel[ev.id] = day; } };
  for (const art of Object.keys(FREIHALTEN)) {
    if (ev.id !== art) continue;
    const r = v?.[art];
    const vorbereitet = !!(r && r.startDay === ev.startDay && r.plaetze.length);
    merke(vorbereitet);
    events.push({ type: 'ereignisErgebnis', art, day, vorbereitet, plaetze: vorbereitet ? r.plaetze.length : 0, teilnehmer: vorbereitet ? r.teilnehmer : 0, startgeld: vorbereitet ? r.startgeld : 0, bau, fehlt });
    return;
  }
  if (ev.id === 'sturm') {
    const s = v?.sturm && v.sturm.startDay === ev.startDay ? v.sturm : null;
    merke(!!s?.klar);
    events.push({ type: 'ereignisErgebnis', art: 'sturm', day, vorbereitet: !!s?.klar, verholt: s?.verholt ?? 0, draussen: s?.draussen ?? 0, innen: s?.innen ?? 0, anker: Math.max(0, -outer()) });
    return;
  }
  // Andere Ereignisse mit Bauten: Ergebnis mit dem, was die Bauten gebracht haben, und was fehlt
  if (BAUTEN[ev.id]) events.push({ type: 'ereignisErgebnis', art: ev.id, day, bau, fehlt });
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
  for (const art of Object.keys(FREIHALTEN)) if (v[art] && state.day >= v[art].endDay) delete v[art];
  if (v.bau && state.day >= (v.bau.endDay ?? v.bau.startDay)) delete v.bau;
  // Bonus im Nachspiel gilt höchstens drei Tage nach dem Ereignis
  for (const [id, tag] of Object.entries(v.nachspiel ?? {})) if (state.day >= tag + 3) delete v.nachspiel[id];
}

/** Hooks in einen Regel-Kontext hängen (Browser über game.sim.addHook, Tests über sim.addHook). */
export function haengeEin(addHook, { laufend, geplant, outer, bauStufe } = {}) {
  const ab = [
    addHook('fit', fitHook),
    addHook('score', scoreHook),
    addHook('evening', (a) => abendHook(a, { laufend, outer, bauStufe })),
    addHook('night', (a) => nachtHook(a, { geplant })),
  ];
  return () => ab.forEach((f) => f());
}

// ---------------------------------------------------------------- Texte

const plural = (n, eins, viele) => `${n} ${n === 1 ? eins : viele}`;
const euro = (n) => `${Math.round(n).toLocaleString('de-DE')} €`;

const NAMEN = {
  sturm: 'Sturm', regatta: 'Regatta', hansewoche: 'Hanse-Woche', mittsommer: 'Mittsommer',
  heringstage: 'Heringstage', holzboote: 'Holzboot-Treffen', hafenfest: 'Hafenfest',
};
const SYMBOL = { regatta: 'regatta', hansewoche: 'kogge', mittsommer: 'feuer', heringstage: 'fisch', holzboote: 'holzboot', hafenfest: 'fest' };

/** Was die Bauten gebracht haben, als kurzer Satz (oder '') */
export function bauSatz(eventId, bau = {}, fehlt = [], name = (id) => id) {
  const teile = Object.entries(bau).filter(([, g]) => g > 0).sort((a, b) => b[1] - a[1]).map(([id, g]) => `${name(id)} ${euro(g)}`);
  if (teile.length) return `Deine Bauten brachten ${teile.slice(0, 3).join(', ')}.`;
  if (fehlt.length) return `Mit ${name(fehlt[0])} wäre mehr los gewesen.`;
  return '';
}

/** Text des Ergebnisses am Abend: { titel, text, symbol }. name(id): Name eines Services. */
export function ergebnisText(e, name = (id) => id) {
  const bau = bauSatz(e.art, e.bau, e.fehlt, name);
  const mit = (t) => [t, bau].filter(Boolean).join(' ');
  if (e.art === 'regatta' || e.art === 'hansewoche') {
    const titel = `${NAMEN[e.art]} vorbei`;
    const boot = e.art === 'regatta' ? ['Regattaboot lag', 'Regattaboote lagen'] : ['großes Schiff lag', 'große Schiffe lagen'];
    const geld = e.art === 'regatta' ? 'Startgeld' : 'Festgeld';
    if (!e.vorbereitet) {
      // Mit Bauten reicht deren Satz (die Karte bleibt kurz), sonst der Tipp zum Freihalten
      if (bau) return { symbol: SYMBOL[e.art], titel, text: bau };
      return { symbol: SYMBOL[e.art], titel, text: (e.art === 'regatta'
        ? 'Die Segler sind zufrieden gesegelt. Nächstes Mal Plätze freihalten: jedes Regattaboot darauf zahlt Startgeld.'
        : 'Ein großes Fest. Nächstes Mal Plätze freihalten: jedes große Schiff darauf zahlt Festgeld.') };
    }
    return {
      symbol: SYMBOL[e.art],
      titel,
      text: mit(e.teilnehmer > 0
        ? `${plural(e.teilnehmer, boot[0], boot[1])} auf deinen ${e.plaetze} freigehaltenen Plätzen. ${geld}: ${euro(e.startgeld)}.`
        : `Deine ${e.plaetze} freigehaltenen Plätze blieben leer. Die Schiffe fanden schon anderswo Platz.`),
    };
  }
  if (e.art !== 'sturm') {
    return { symbol: SYMBOL[e.art] ?? 'fest', titel: `${NAMEN[e.art] ?? 'Ereignis'} vorbei`, text: bau || 'Ein schöner Tag im Hafen.' };
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
