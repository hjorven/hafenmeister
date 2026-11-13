// Tagesziele: morgens drei Karten (leicht, mittel, schwer), der Spieler nimmt eine. Dazu ein Wochenziel.
// Beschreibung in docs/neue-features.md, Abschnitt 6. Zahlen in data/economy.js (ECONOMY.tagesziele).
//
// - Es zählen nur eigene Handlungen: Boote, die der Spieler selbst an einen Platz gelegt hat
//   ('moored' mit hand: true), und Münzen, die er selbst eingestrichen hat ('collected' mit hand: true).
//   Selbst eingefahrene Boote, das Hafenbüro, der Kassenautomat und der Rundgang zählen nicht.
// - Ziele, die gerade nicht machbar sind (zum Beispiel Zuweisen, wenn die Automatik alles übernimmt),
//   werden gar nicht erst angeboten. Was abends nicht geschafft ist, verfällt still.
// - Belohnungen gemischt: Geld, ein halber Anker von allen Gästen im Hafen, ein seltener Gast am
//   nächsten Tag, ein Gutschein auf den nächsten Bau, ein Deko-Stück für den Hafen (features/ziel-deko.js).
// - Wochenziel über sieben Saisontage, ruht im Winter.
// - Die Logik (ohne init) läuft ohne Browser (tests/tagesziele.test.mjs).
//
// Spielstand: state.modules.ziele = { version: 2, tag, karten: [ziel], gewaehlt, frisch: [bootId],
//   hand: { bootId: tag }, woche, gutschein, gast, deko: [dekoId], geschafft }
//   ziel = { art, schwere, soll, ist, erledigt, belohnung, extra }
// Ereignisse: 'ziel:gewaehlt' { art, text }, 'ziel:erreicht' { art, text, belohnung, belohnungText },
//   'wochenziel:erreicht' { art, text, geld, deko }, 'ziel:seltenerGast' { boatId, name },
//   'ziel:gutschein' { betrag }, 'ziel:deko' { id, name }.

import * as sim from '../sim.js';
import { random, randomRange } from '../random.js';
import { ECONOMY } from '../data/economy.js';
import { heimathaefen } from '../data/bootsnamen.js';
import { regelnBereit } from './regeln-bereit.js';

export const ZAHLEN = ECONOMY.tagesziele;
export const SCHWEREN = ['leicht', 'mittel', 'schwer'];
const SCHWERE_NAME = { leicht: 'Leicht', mittel: 'Mittel', schwer: 'Schwer' };
const WUNSCH_NAME = { wc: 'WC', dusche: 'Dusche', essen: 'Essen', strom: 'Strom', diesel: 'Diesel' };

/** Deko-Stücke für den Hafen, in der Reihenfolge, in der sie verdient werden. */
export const DEKO = [
  { id: 'kuebel', name: 'Blumenkübel' },
  { id: 'bank', name: 'Bank am Wasser' },
  { id: 'laterne', name: 'Hafenlaterne' },
  { id: 'rettungsring', name: 'Rettungsring' },
  { id: 'anker', name: 'Alter Anker' },
  { id: 'fischkisten', name: 'Fischkisten' },
  { id: 'tonne', name: 'Alte Tonne' },
  { id: 'wimpel', name: 'Wimpelmast' },
];

const runde5 = (x) => Math.max(5, Math.round(x / 5) * 5);
const runde10 = (x) => Math.max(10, Math.round(x / 10) * 10);
const istSegler = (ctx, typeId) => !!ctx.typeById[typeId]?.sail;
const geldFuer = (state) => ZAHLEN.geld[state.stage] ?? ZAHLEN.geld[1];
const Z = ZAHLEN.ziele;
const W = ZAHLEN.woche;
const GROESSE_RANG = { S: 1, M: 2, L: 3, XL: 4, XXL: 5 };

/** Wert für eine Stufe aus { ab Stufe: Wert }: der Eintrag der höchsten erreichten Stufe. */
function stufenWert(tabelle, stufe) {
  let wert = null;
  for (const [ab, w] of Object.entries(tabelle)) if (stufe >= Number(ab)) wert = w;
  return wert;
}

/** Mittlere Nächte einer Bootsklasse (alle Nächte zahlen, beim Anlegen oder jeden Morgen). */
function naechte(ctx, size) {
  const n = ctx.rules.nightsBySize?.[size] ?? ctx.rules.nights ?? 1;
  return Array.isArray(n) ? (n[0] + n[1]) / 2 : n;
}

/** Menge für eine Schwere: Grundmenge mal Faktor, mindestens min, höchstens cap. */
function menge(basis, schwere, cap, min = 1) {
  const f = ZAHLEN.schwere[schwere].soll;
  return Math.max(min, Math.min(Math.round(basis * f), Math.max(min, Math.floor(cap))));
}

export function zielState(state) {
  state.modules ||= {};
  let z = state.modules.ziele;
  // Alte Spielstände (drei feste Ziele in z.liste) starten mit neuen Karten
  if (!z || z.version !== 2) {
    z = state.modules.ziele = {
      version: 2, tag: 0, karten: [], gewaehlt: null, frisch: [], hand: {}, woche: null,
      gutschein: null, gast: null, deko: [], geschafft: 0,
    };
  }
  return z;
}

/** Das gewählte Tagesziel oder null. */
export function gewaehlt(state) {
  const z = zielState(state);
  return z.gewaehlt != null ? z.karten[z.gewaehlt] ?? null : null;
}

// ---------------------------------------------------------------------------
// Was der Spieler heute selbst tun kann

/** Muss der Spieler Boote dieser Klasse selbst zuweisen? (Hafenbüro kann es übernehmen) */
function handZuweisen(state, ctx, size) {
  if (typeof sim.handAssignFor === 'function') return !!sim.handAssignFor(state, ctx, size);
  return state.office < (ctx.rules.office?.autoAssign ?? Infinity);
}

/** Streicht der Spieler das Liegegeld dieser Klasse selbst ein? (Kassenautomat kann es übernehmen) */
function handKassieren(state, ctx, size) {
  if (typeof sim.handCollectFor === 'function') return !!sim.handCollectFor(state, ctx, size);
  return state.office < (ctx.rules.office?.autoCollect ?? Infinity);
}

/** Was heute möglich ist, als Grundlage für Ziele (ohne Browser testbar). */
export function lage(state, ctx) {
  const mix = ctx.rules.sizeMix[state.stage] || { S: 1 };
  const summe = Object.values(mix).reduce((a, b) => a + b, 0) || 1;
  const rate = sim.arrivalRate(state, ctx);
  let anteilZuweisen = 0;
  let geld = 0;
  for (const [g, w] of Object.entries(mix)) {
    if (handZuweisen(state, ctx, g)) anteilZuweisen += w / summe;
    if (handKassieren(state, ctx, g)) geld += (w / summe) * (ctx.rules.baseFee?.[g] || 0) * naechte(ctx, g);
  }
  const arten = sim.eligibleTypes(state, ctx);
  const plaetze = sim.availableBerths(state, ctx);
  const strom = plaetze.some((b) => sim.berthHas(state, ctx, b, 'power'));
  const pool = ctx.rules.wishes?.[state.stage] || [];
  const wuensche = pool.filter((w) => {
    const prop = ctx.rules.berthWishes?.[w];
    if (prop) return plaetze.some((b) => sim.berthHas(state, ctx, b, prop));
    return sim.facilityCapacity(state, ctx, w) > 0;
  });
  const gross = stufenWert(ZAHLEN.grossAb, state.stage);
  return {
    boote: rate * anteilZuweisen,
    zuweisen: anteilZuweisen > 0 && rate > 0,
    kassieren: geld > 0 && rate > 0,
    geld: rate * geld,
    segler: arten.some((t) => t.sail && handZuweisen(state, ctx, t.size)),
    strom,
    wuensche,
    pool,
    // Alle Wünsche der Stufe erfüllbar: dann kann jeder Gast 4 Anker oder mehr geben
    allesVersorgt: wuensche.length === pool.length,
    gross: gross && arten.some((t) => t.size === gross) && handZuweisen(state, ctx, gross) ? gross : null,
    stamm: (state.modules?.stamm?.liste?.length ?? 0) > 0,
    wenigePlaetze: plaetze.length <= Z.letzter.bisPlaetze,
  };
}

// ---------------------------------------------------------------------------
// Vorlagen der Tagesziele

// zaehlt({ e, boot, ziel, state, ctx, z }) liefert, um wie viel das Ziel wächst.
export const VORLAGEN = {
  einweisen: {
    schweren: ['leicht', 'mittel', 'schwer'],
    machbar: (h) => h.zuweisen && h.boote >= Z.einweisen.abBooten,
    soll: (h, s) => menge(Math.max(Z.einweisen.min, h.boote * Z.einweisen.basisAnteil), s, h.boote * Z.einweisen.maxAnteil, Z.einweisen.min),
    zaehlt: ({ e }) => (e.type === 'moored' && e.hand ? 1 : 0),
    text: (z) => `${z.soll} Boote von Hand einweisen`,
  },
  passgenau: {
    abStufe: 2,
    schweren: ['leicht', 'mittel', 'schwer'],
    machbar: (h) => h.zuweisen && h.boote >= Z.passgenau.abBooten,
    soll: (h, s) => menge(Z.passgenau.basis, s, h.boote * Z.passgenau.maxAnteil),
    zaehlt: ({ e, boot, ctx }) => (e.type === 'moored' && e.hand && passgenau(ctx, boot, e) ? 1 : 0),
    text: (z) => (z.soll === 1 ? 'Ein Boot passgenau einweisen' : `${z.soll} Boote passgenau einweisen`),
    hinweis: 'Die Box ist höchstens ein Fünftel länger als das Boot.',
  },
  wunsch: {
    schweren: ['leicht', 'mittel', 'schwer'],
    machbar: (h) => h.zuweisen && h.wuensche.length > 0 && h.boote >= Z.wunsch.abBooten,
    extra: (h, s, state) => {
      const w = h.wuensche[Math.floor(random(state) * h.wuensche.length)];
      return { wunsch: w, segler: s === 'schwer' && h.segler && w !== 'diesel' };
    },
    soll: (h, s) => menge(Z.wunsch.basis, s, h.boote * Z.wunsch.maxAnteil),
    zaehlt: ({ e, boot, ziel, z, ctx }) => {
      if (e.type !== 'feeReady' || !boot || !z.frisch.includes(boot.id)) return 0;
      if (ziel.extra.segler && !istSegler(ctx, boot.typeId)) return 0;
      const met = Array.isArray(e.wishesMet) ? e.wishesMet : [];
      return met.includes(ziel.extra.wunsch) ? 1 : 0;
    },
    text: (z) => {
      const wer = z.extra.segler ? (z.soll === 1 ? 'Einen Segler' : `${z.soll} Segler`) : z.soll === 1 ? 'Einen Gast' : `${z.soll} Gäste`;
      return `${wer} mit Wunsch ${WUNSCH_NAME[z.extra.wunsch] ?? z.extra.wunsch} versorgen`;
    },
    hinweis: 'Von Hand an einen Platz legen, an dem der Wunsch erfüllt wird.',
  },
  seglerStrom: {
    schweren: ['mittel', 'schwer'],
    machbar: (h) => h.zuweisen && h.segler && h.strom && h.boote >= Z.seglerStrom.abBooten,
    soll: (h, s) => menge(Z.seglerStrom.basis, s, h.boote * Z.seglerStrom.maxAnteil),
    zaehlt: ({ e, boot, ctx, state }) => {
      if (e.type !== 'moored' || !e.hand || !boot || !istSegler(ctx, boot.typeId)) return 0;
      const berth = ctx.berthById[e.berthId];
      return berth && sim.berthHas(state, ctx, berth, 'power') ? 1 : 0;
    },
    text: (z) => `${z.soll} Segelboote an Plätze mit Strom legen`,
  },
  rundum: {
    abStufe: 2,
    schweren: ['mittel', 'schwer'],
    machbar: (h) => h.zuweisen && h.wuensche.length >= Z.rundum.mindestWuensche && h.boote >= Z.rundum.abBooten,
    soll: (h, s) => (s === 'schwer' ? 2 : 1),
    zaehlt: ({ e, boot, z }) => {
      if (e.type !== 'feeReady' || !boot || !z.frisch.includes(boot.id)) return 0;
      const met = Array.isArray(e.wishesMet) ? e.wishesMet.length : e.wishesMet;
      return boot.wishes.length >= Z.rundum.mindestWuensche && met === boot.wishes.length ? 1 : 0;
    },
    text: (z) => (z.soll === 1 ? 'Einem Gast alle Wünsche erfüllen' : `${z.soll} Gästen alle Wünsche erfüllen`),
    hinweis: 'Gäste mit mindestens zwei Wünschen, von Hand eingewiesen.',
  },
  gross: {
    abStufe: 3,
    schweren: ['mittel', 'schwer'],
    machbar: (h) => !!h.gross,
    extra: (h) => ({ groesse: h.gross }),
    soll: (h, s) => (s === 'schwer' ? 2 : 1),
    zaehlt: ({ e, boot, ziel }) => (e.type === 'moored' && e.hand && boot?.size === ziel.extra.groesse ? 1 : 0),
    text: (z) => (z.soll === 1 ? `Ein ${z.extra.groesse}-Schiff einweisen` : `${z.soll} ${z.extra.groesse}-Schiffe einweisen`),
  },
  stammgast: {
    schweren: ['leicht', 'mittel'],
    machbar: (h) => h.zuweisen && h.stamm,
    soll: () => 1,
    zaehlt: ({ e, boot }) => (e.type === 'moored' && e.hand && (boot?.besuche ?? 1) > 1 ? 1 : 0),
    text: () => 'Einen Stammgast von Hand einweisen',
  },
  letzter: {
    schweren: ['schwer'],
    machbar: (h) => h.zuweisen && h.wenigePlaetze,
    soll: () => 1,
    zaehlt: ({ e, state, ctx }) => {
      if (e.type !== 'moored' || !e.hand) return 0;
      const frei = sim.availableBerths(state, ctx).filter((b) => sim.isFree(state, b.id) && !b.reserved);
      return frei.length ? 0 : 1;
    },
    text: () => 'Den letzten freien Platz selbst belegen',
  },
  kassieren: {
    schweren: ['leicht', 'mittel', 'schwer'],
    machbar: (h) => h.kassieren && h.geld >= 5,
    soll: (h, s) => Math.min(runde5(h.geld * Z.kassieren.anteil * ZAHLEN.schwere[s].soll), runde5(h.geld * Z.kassieren.maxAnteil)),
    zaehlt: ({ e }) => (e.type === 'collected' && e.hand ? e.amount || 0 : 0),
    text: (z) => `${z.soll} € Liegegeld selbst einstreichen`,
    hinweis: 'Münzen antippen oder mit einem Strich einsammeln.',
  },
};

/** Box höchstens ein Fünftel länger als das Boot (P10 liefert e.passgenau, sonst selbst rechnen). */
export function passgenau(ctx, boot, e) {
  if (e.passgenau != null) return !!e.passgenau;
  const berth = ctx.berthById[e.berthId];
  return !!(boot && berth && berth.maxLength <= boot.length * Z.passgenau.spielraum);
}

// ---------------------------------------------------------------------------
// Vorlagen der Wochenziele

export const WOCHE = {
  gaeste: {
    machbar: (h) => h.zuweisen && h.boote >= Z.einweisen.abBooten,
    soll: (h) => runde5(h.boote * W.tage * W.gaeste),
    zaehlt: ({ e }) => (e.type === 'moored' && e.hand ? 1 : 0),
    text: (w) => `${w.soll} Gäste von Hand einweisen`,
  },
  zufrieden: {
    machbar: (h) => h.zuweisen && h.allesVersorgt && h.boote >= Z.einweisen.abBooten,
    soll: (h) => runde5(h.boote * W.tage * W.zufrieden),
    zaehlt: ({ e, z }) => (e.type === 'departed' && z.hand[e.boatId] != null && e.rating >= 4 ? 1 : 0),
    text: (w) => `${w.soll} Gäste mit 4 Ankern verabschieden`,
  },
  segler: {
    abStufe: 2,
    machbar: (h) => h.zuweisen && h.segler && h.allesVersorgt && h.boote >= Z.seglerStrom.abBooten,
    soll: (h) => runde5(h.boote * W.tage * W.segler),
    zaehlt: ({ e, z, ctx }) => (e.type === 'departed' && z.hand[e.boatId] != null && e.rating >= 4 && istSegler(ctx, e.typeId) ? 1 : 0),
    text: (w) => `${w.soll} zufriedene Segler verabschieden`,
  },
  geld: {
    machbar: (h) => h.kassieren && h.geld >= 5,
    soll: (h) => runde10(h.geld * W.tage * W.liegegeld),
    zaehlt: ({ e }) => (e.type === 'collected' && e.hand ? e.amount || 0 : 0),
    text: (w) => `${w.soll} € Liegegeld selbst einstreichen`,
  },
};

/** Kurzer Text für Karte und Tafel. */
export function text(ziel) {
  const v = VORLAGEN[ziel.art] ?? WOCHE[ziel.art];
  return v ? v.text(ziel) : ziel.art;
}

export function hinweis(ziel) {
  return VORLAGEN[ziel.art]?.hinweis ?? '';
}

export function wocheText(w) {
  return WOCHE[w.art] ? WOCHE[w.art].text(w) : w.art;
}

// ---------------------------------------------------------------------------
// Belohnungen

/** Bootsarten, die als seltener Gast kommen können: die seltensten, die heute in den Hafen passen. */
export function selteneArten(state, ctx) {
  const mix = ctx.rules.sizeMix[state.stage] || {};
  const arten = sim.eligibleTypes(state, ctx).filter((t) => !t.noWishes && !t.role && t.special !== 'sondergast' && t.size !== 'S');
  // Nur aus den zwei größten Klassen, die heute kommen können, dort die seltensten
  const raenge = [...new Set(arten.map((t) => GROESSE_RANG[t.size] ?? 0))].sort((a, b) => b - a).slice(0, 2);
  return arten
    .filter((t) => raenge.includes(GROESSE_RANG[t.size] ?? 0))
    .map((t) => ({ t, w: (t.weight ?? 1) * (mix[t.size] ?? 0) }))
    .sort((a, b) => (!!b.t.special) - (!!a.t.special) || a.w - b.w || String(a.t.id).localeCompare(String(b.t.id)))
    .slice(0, 3)
    .map((x) => x.t);
}

function belohnungFuer(state, ctx, schwere, z, schonVergeben) {
  const geld = geldFuer(state);
  const g = { art: 'geld', wert: Math.round(geld * ZAHLEN.schwere[schwere].geld) };
  if (schwere === 'leicht') return g;
  const moeglich = [g];
  if (schwere === 'mittel') {
    moeglich.push({ art: 'anker', wert: ZAHLEN.halberAnker });
    if (!z.gutschein && !schonVergeben.has('gutschein')) {
      moeglich.push({ art: 'gutschein', prozent: ZAHLEN.gutschein.prozent, hoechstens: geld * ZAHLEN.gutschein.hoechstens });
    }
  } else {
    const selten = selteneArten(state, ctx);
    if (selten.length && !z.gast && !schonVergeben.has('gast')) {
      const t = selten[Math.floor(random(state) * selten.length)];
      moeglich.push({ art: 'gast', typeId: t.id, name: t.name });
    }
    const deko = DEKO.find((d) => !z.deko.includes(d.id) && d.id !== z.woche?.deko);
    if (deko && !schonVergeben.has('deko')) moeglich.push({ art: 'deko', id: deko.id, name: deko.name });
    moeglich.push({ art: 'anker', wert: ZAHLEN.halberAnker });
  }
  return moeglich[Math.floor(random(state) * moeglich.length)];
}

export function belohnungText(b) {
  if (!b) return '';
  switch (b.art) {
    case 'geld': return `${b.wert} €`;
    case 'anker': return 'Halber Anker von allen Gästen im Hafen';
    case 'gutschein': return `Gutschein: ${b.prozent} % zurück beim nächsten Bau`;
    case 'gast': return `Seltener Gast morgen: ${b.name}`;
    case 'deko': return `Für den Hafen: ${b.name}`;
    default: return '';
  }
}

/**
 * Belohnung gutschreiben. Gibt den Geldbetrag zurück, den der Aufrufer bucht (sim.addIncome).
 * Alles andere ändert den Spielstand direkt.
 */
export function gibBelohnung(state, ctx, b) {
  const z = zielState(state);
  switch (b?.art) {
    case 'geld': return b.wert;
    case 'anker':
      // Wie Strafpunkte, nur andersherum: jeder liegende Gast bewertet bei der Abreise besser
      for (const boot of sim.mooredBoats(state)) if (!boot.stationed) boot.penalty = (boot.penalty || 0) - b.wert;
      return 0;
    case 'gutschein':
      z.gutschein = { prozent: b.prozent, hoechstens: b.hoechstens };
      return 0;
    case 'gast':
      z.gast = { typeId: b.typeId, name: b.name, ab: state.day + 1 };
      return 0;
    case 'deko':
      if (!z.deko.includes(b.id)) z.deko.push(b.id);
      return 0;
    default: return 0;
  }
}

/** Gutschein beim nächsten Bau einlösen. Gibt den Betrag zurück, den es zurückgibt (0 ohne Gutschein). */
export function loeseGutschein(state, kosten) {
  const z = zielState(state);
  if (!z.gutschein || !(kosten > 0)) return 0;
  const betrag = Math.min(z.gutschein.hoechstens, Math.round((kosten * z.gutschein.prozent) / 100));
  z.gutschein = null;
  return betrag;
}

/**
 * Hook 'arrival': Am Tag nach der Belohnung wird ein ankommendes Boot zum seltenen Gast.
 * Stammgäste bleiben, wer sie sind; dann ist das nächste Boot dran.
 */
export function seltenerGastHook({ state, ctx, boat }) {
  const z = zielState(state);
  if (!z.gast || state.day < z.gast.ab || boat.stationed || boat.stammId) return;
  if (!machSelten(state, ctx, boat, z.gast.typeId)) {
    // Passt heute nicht (anderer Hafen, andere Stufe): eine andere seltene Art versuchen
    const andere = selteneArten(state, ctx).find((t) => machSelten(state, ctx, boat, t.id));
    if (!andere) return;
  }
  z.gast = null;
}

function machSelten(state, ctx, boat, typeId) {
  const type = ctx.typeById[typeId];
  if (!type || type.minStage > state.stage) return false;
  const modelle = (type.models || []).filter((m) => (m.minStage ?? type.minStage) <= state.stage);
  for (let versuch = 0; versuch < 8; versuch++) {
    const model = modelle.length ? modelle[Math.floor(random(state) * modelle.length)] : null;
    const mass = (k) => (model && model[k] != null ? model[k] : Array.isArray(type[k]) ? randomRange(state, ...type[k]) : boat[k]);
    const neu = { size: type.size, length: mass('length'), beam: mass('beam'), draft: mass('draft'), stationed: false };
    if (!sim.couldEverFit(state, ctx, neu)) continue;
    const r = ctx.rules;
    const wuensche = type.noWishes ? [] : boat.wishes.filter(
      (w) => (type.motor || !(r.motorOnlyWishes || []).includes(w)) && (!r.wishSizes?.[w] || r.wishSizes[w].includes(type.size)),
    );
    Object.assign(boat, neu, {
      typeId: type.id, modelId: model ? model.id : null, name: model ? model.name : type.name, kind: type.kind,
      motor: type.motor, special: type.special, dayVisitors: type.dayVisitors, wishes: wuensche, selten: true,
    });
    if (boat.bootsname) {
      const haefen = heimathaefen(state.region, type.size);
      if (haefen?.length) boat.heimathafen = haefen[Math.floor(random(state) * haefen.length)];
    }
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Karten, Wahl, Woche

/** Drei Karten für den aktuellen Tag (leicht, mittel, schwer). Im Winter keine. */
export function neueKarten(state, ctx) {
  const z = zielState(state);
  z.tag = state.day;
  z.karten = [];
  z.gewaehlt = null;
  z.frisch = [];
  if (sim.season(state, ctx).winter) return z.karten;
  const h = lage(state, ctx);
  const benutzt = new Set();
  const vergeben = new Set();
  for (const schwere of SCHWEREN) {
    const passend = Object.entries(VORLAGEN)
      .filter(([, v]) => (v.abStufe ?? 1) <= state.stage && v.schweren.includes(schwere) && v.machbar(h))
      .map(([k]) => k);
    if (!passend.length) continue;
    const frei = passend.filter((k) => !benutzt.has(k));
    const auswahl = frei.length ? frei : passend;
    const art = auswahl[Math.floor(random(state) * auswahl.length)];
    benutzt.add(art);
    const v = VORLAGEN[art];
    const ziel = { art, schwere, soll: 0, ist: 0, erledigt: false };
    if (v.extra) ziel.extra = v.extra(h, schwere, state);
    ziel.soll = v.soll(h, schwere);
    ziel.belohnung = belohnungFuer(state, ctx, schwere, z, vergeben);
    vergeben.add(ziel.belohnung.art);
    z.karten.push(ziel);
  }
  return z.karten;
}

/** Spieler nimmt eine Karte. Nur einmal am Tag. */
export function waehle(state, index) {
  const z = zielState(state);
  if (z.gewaehlt != null || !z.karten[index]) return false;
  z.gewaehlt = index;
  return true;
}

export function neueWoche(state, ctx) {
  const z = zielState(state);
  z.woche = null;
  if (sim.season(state, ctx).winter) return null;
  const h = lage(state, ctx);
  const arten = Object.entries(WOCHE).filter(([, v]) => (v.abStufe ?? 1) <= state.stage && v.machbar(h)).map(([k]) => k);
  if (!arten.length) return null;
  const art = arten[Math.floor(random(state) * arten.length)];
  const deko = DEKO.find((d) => !z.deko.includes(d.id));
  z.woche = {
    art, soll: WOCHE[art].soll(h), ist: 0, erledigt: false, tage: ZAHLEN.woche.tage,
    geld: geldFuer(state) * ZAHLEN.woche.geld, deko: deko ? deko.id : null,
  };
  return z.woche;
}

/**
 * Neuer Tag: Tageskarten neu, Wochenziel weiterzählen (nur Saisontage). Gibt true zurück,
 * wenn sich etwas geändert hat.
 */
export function tageswechsel(state, ctx) {
  const z = zielState(state);
  if (z.tag === state.day) return false;
  const vorherSaison = z.tag > 0 && z.tag < state.day && !sim.season({ ...state, day: z.tag }, ctx).winter;
  if (z.woche && vorherSaison) z.woche.tage -= Math.min(state.day - z.tag, z.woche.tage);
  if (z.woche && z.woche.tage <= 0) z.woche = null;
  // Abgereiste Boote aus der Liste der von Hand eingewiesenen nehmen
  for (const id of Object.keys(z.hand)) if (!state.boats[id]) delete z.hand[id];
  neueKarten(state, ctx);
  if (!z.woche) neueWoche(state, ctx);
  return true;
}

/**
 * Ein Ereignis der Regeln auswerten (die Objekte aus sim.js, z. B. { type: 'moored', boatId, berthId, hand }).
 * Gibt zurück, was gerade erreicht wurde: { tag: ziel | null, woche: woche | null }.
 * Die Belohnung bucht der Aufrufer (gibBelohnung).
 */
export function werteAus(state, ctx, e) {
  const z = zielState(state);
  const boot = e.boatId != null ? state.boats[e.boatId] : null;
  if (e.type === 'moored' && e.hand) {
    z.hand[e.boatId] = state.day;
    if (!z.frisch.includes(e.boatId)) z.frisch.push(e.boatId);
  }
  const info = { e, boot, state, ctx, z };
  const out = { tag: null, woche: null };
  const ziel = z.tag === state.day ? gewaehlt(state) : null;
  if (ziel && !ziel.erledigt) {
    const plus = VORLAGEN[ziel.art]?.zaehlt({ ...info, ziel }) || 0;
    if (plus) {
      ziel.ist = Math.min(ziel.soll, ziel.ist + plus);
      if (ziel.ist >= ziel.soll) { ziel.erledigt = true; z.geschafft = (z.geschafft || 0) + 1; out.tag = ziel; }
    }
  }
  const w = z.woche;
  if (w && !w.erledigt && !sim.season(state, ctx).winter) {
    const plus = WOCHE[w.art]?.zaehlt({ ...info, ziel: w }) || 0;
    if (plus) {
      w.ist = Math.min(w.soll, w.ist + plus);
      if (w.ist >= w.soll) { w.erledigt = true; out.woche = w; }
    }
  }
  // Die Münze beim Anlegen gehört zum frisch eingewiesenen Boot, danach zählt es nicht mehr als frisch
  if (e.type === 'feeReady' && boot) z.frisch = z.frisch.filter((id) => id !== boot.id);
  if (e.type === 'departed') delete z.hand[e.boatId];
  return out;
}

/** Wochenziel gutschreiben: Geld zurückgeben, Deko eintragen. */
export function gibWochenBelohnung(state, w) {
  const z = zielState(state);
  // Schon auf anderem Weg verdient (alter Spielstand): das nächste freie Stück
  if (w.deko && z.deko.includes(w.deko)) w.deko = DEKO.find((d) => !z.deko.includes(d.id))?.id ?? null;
  if (w.deko) z.deko.push(w.deko);
  return w.geld || 0;
}

// ---------------------------------------------------------------------------
// Im Browser: Knopf "Tagesziel" links unter dem Wetter, aufklappbar mit Karten und Wochenziel.
// Die Pixel-Oberfläche (ui/oberflaeche.js) stellt .hm-tafel in die linke Spalte und gibt
// Knopf und Liste ihren Rahmen; hier nur der Inhalt.

const CSS = `
.hm-tafel { position: absolute; left: calc(12px + env(safe-area-inset-left, 0px)); z-index: 5;
  top: var(--hm-tafel-top, 64px); font: 600 14px system-ui, sans-serif; color: #283648; }
.hm-tafel > button { min-height: 44px; padding: 0 14px; border: 0; border-radius: 22px; cursor: pointer;
  background: rgba(255,252,246,.92); color: #283648; font: inherit; box-shadow: 0 2px 8px rgba(0,0,0,.12); }
.hm-tafel ul { list-style: none; margin: 6px 0 0; padding: 8px 12px; border-radius: 12px; max-width: 300px;
  background: rgba(255,252,246,.95); box-shadow: 0 2px 8px rgba(0,0,0,.12); }
.hm-tafel li { padding: 4px 0; }
.hm-tafel .tz-kopf { font-weight: 600; }
.hm-tafel .tz-klein { display: block; font-weight: 400; font-size: max(13px, .86em); opacity: .75; margin-top: 2px; }
.hm-tafel .tz-karte { display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; align-items: center; }
.hm-tafel .tz-schwere { grid-column: 1 / -1; font-size: max(12px, .8em); letter-spacing: .04em; text-transform: uppercase; opacity: .7; }
.hm-tafel .tz-schwere.schwer { color: #b3472f; opacity: 1; }
.hm-tafel .tz-schwere.mittel { color: #8a6a12; opacity: 1; }
.hm-tafel .tz-text { font-weight: 600; }
.hm-tafel .tz-lohn { grid-column: 1; font-weight: 400; font-size: .9em; color: #2d6f80; }
.hm-tafel .tz-nehmen { grid-column: 2; grid-row: 2 / span 2; min-height: 40px; min-width: 76px; padding: 0 10px; cursor: pointer; font: inherit; }
.hm-tafel .tz-woche-kurz { margin: 0; }
.hm-tafel .tz-woche-kurz .tz-stand { float: right; margin-left: 8px; font-variant-numeric: tabular-nums; }
.hm-tafel .tz-ziel .tz-stand { float: right; font-variant-numeric: tabular-nums; opacity: .8; margin-left: 8px; }
.hm-tafel li.erledigt .tz-text { color: #3f8f55; }
.hm-tafel .tz-balken { height: 6px; margin-top: 4px; background: rgba(36,54,74,.12); }
.hm-tafel .tz-balken > i { display: block; height: 100%; background: #f2c14e; }
.hm-tafel li.erledigt .tz-balken > i { background: #3f8f55; }
.hm-tafel .tz-notiz { margin: 4px 0 0; padding: 6px 10px; max-width: 280px; background: #f2c14e; color: #283648;
  font-weight: 600; font-size: .92em; pointer-events: none; }
.hm-tafel.jubel > button { animation: hm-tafel-jubel .8s ease-out; }
@keyframes hm-tafel-jubel { 0% { transform: scale(1); } 30% { transform: scale(1.15); background: #f2c14e; } 100% { transform: scale(1); } }
.hm-neu #hm-seite .hm-tafel .tz-nehmen { width: auto; margin: 0; min-height: 40px; padding: 2px 8px; font-size: var(--hm-schrift); }
.hm-neu #hm-seite .hm-tafel li.tz-karte { padding: 3px 0; gap: 0 8px; }
.hm-neu #hm-seite .hm-tafel li.tz-klein { padding: 3px 0; margin: 0; }
.hm-neu .hm-tafel .tz-notiz { border-image-source: var(--rahmen-gold); background: none; padding: 6px 10px; }
.hm-neu .hm-tafel .tz-balken { height: calc(var(--hm-px, 2px) * 3); background: var(--hm-mulde); box-shadow: inset 0 0 0 var(--hm-px, 2px) rgba(36,54,74,.3); }
.hm-neu .hm-tafel .tz-balken > i { background: var(--hm-gold); }
.hm-neu .hm-tafel li.erledigt .tz-balken > i, .hm-neu .hm-tafel li.erledigt .tz-text { background: none; color: var(--hm-meer); }
.hm-neu .hm-tafel li.erledigt .tz-balken > i { background: var(--hm-meer); }
.hm-neu .hm-tafel .tz-notiz { font-family: var(--hm-pixel); }
.hm-neu .hm-tafel > button.tz-neu { border-image-source: var(--rahmen-gold); }
@media (prefers-reduced-motion: reduce) { .hm-tafel.jubel > button { animation: none; } }
body.hm.foto .hm-tafel { display: none; }
/* Abends hat der Tagesabschluss Vorrang: die Tafel tritt zurück, bis er zu ist */
body.ta-offen .hm-tafel { visibility: hidden; }
/* Handy: Kopfzeile weg (der Einstieg erklärt sie), Ausbau-Schild tritt zurück, solange die Wahl offen ist */
@media (max-width: 599px), (max-height: 499px) {
  .hm-neu #hm-seite .hm-tafel > ul.tz-wahl > li.tz-kopf-kurz { display: none; }
  .hm-neu #hm-seite:has(.hm-tafel > ul.tz-wahl:not([hidden])) > #hm-ziel { display: none !important; }
}
/* Handy quer: Kartenwahl als Blatt rechts neben der linken Spalte, drei Karten nebeneinander,
   die Zeitsteuerung unten links bleibt frei und sichtbar */
@media (max-height: 499px) and (orientation: landscape) {
  .hm-neu #hm-seite .hm-tafel > ul.tz-wahl {
    position: fixed; z-index: 16; width: auto; max-width: 640px;
    left: calc(var(--hm-links) + min(280px, 40vw) + 8px);
    right: calc(var(--hm-rand) + var(--hm-safe-right));
    top: calc(var(--hm-oben) + var(--hm-knopf) + 8px);
    max-height: calc(100dvh - var(--hm-oben) - var(--hm-knopf) - var(--hm-bauen) - var(--hm-safe-bottom) - 28px);
    display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0 10px; align-content: start;
  }
  .hm-neu #hm-seite .hm-tafel > ul.tz-wahl > li.tz-klein { grid-column: 1 / -1; }
  .hm-neu #hm-seite .hm-tafel > ul.tz-wahl > li.tz-kopf-kurz { display: none; }
  .hm-neu #hm-seite .hm-tafel > ul.tz-wahl > li.tz-karte { grid-template-columns: 1fr; grid-template-rows: auto 1fr auto auto; border-top: 0; }
  .hm-neu #hm-seite .hm-tafel > ul.tz-wahl .tz-nehmen { grid-column: 1; grid-row: auto; width: 100%; margin-top: 4px; min-height: 36px; }
  .hm-neu #hm-seite .hm-tafel > ul.tz-wahl { padding-block: 4px 6px; }
  .hm-neu:has(#hm-seite .hm-tafel > ul.tz-wahl:not([hidden])) #hm-zeit { visibility: visible; }
}
`;

function el(tag, attrs = {}, ...kinder) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kinder) if (k != null) n.append(k);
  return n;
}

function balken(ist, soll) {
  const b = el('div', { class: 'tz-balken', 'aria-hidden': 'true' });
  const i = document.createElement('i');
  i.style.width = `${Math.round(Math.min(1, soll ? ist / soll : 0) * 100)}%`;
  b.append(i);
  return b;
}

const stand = (z) => (z.art === 'kassieren' || z.art === 'geld' ? `${z.ist}/${z.soll} €` : `${z.ist}/${z.soll}`);

export async function init(game) {
  const api = await regelnBereit(game);
  const st = () => api.state;
  api.addHook('arrival', seltenerGastHook);

  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const tafel = el('div', { class: 'hm-tafel' });
  const knopf = el('button', { type: 'button', 'aria-expanded': 'false' });
  const liste = el('ul', { hidden: true });
  const notiz = el('p', { class: 'tz-notiz hm-px', role: 'status', hidden: true });
  tafel.append(knopf, liste, notiz);
  (document.getElementById('game') || document.body).appendChild(tafel);

  // Ohne Pixel-Oberfläche: unter die obere Leiste und unter den Wetter-Knopf
  function lageAlt() {
    if (tafel.parentNode?.id === 'hm-seite') return;
    let unten = document.getElementById('hud-top')?.getBoundingClientRect().bottom ?? 56;
    const wetter = document.getElementById('weather-chip');
    if (wetter && !wetter.hidden) {
      const r = wetter.getBoundingClientRect();
      if (r.width && r.left < 320 && r.top < unten + 60) unten = Math.max(unten, r.bottom);
    }
    tafel.style.setProperty('--hm-tafel-top', `${Math.round(unten + 8)}px`);
  }
  game.on('resize', lageAlt);
  window.addEventListener('resize', lageAlt);
  lageAlt();
  setTimeout(lageAlt, 500);

  // Tagesabschluss (P15) offen? Dann wartet die Kartenwahl, bis er zu ist.
  const abschlussOffen = () => document.body.classList.contains('ta-offen') || !!game.tagesabschluss?.beschaeftigt?.();
  function auf(offen) {
    if (offen && abschlussOffen()) game.tagesabschluss?.schliesse?.();
    liste.hidden = !offen;
    knopf.setAttribute('aria-expanded', String(offen));
    if (offen) zeichne();
    passeHoehe();
  }
  // Die offene Tafel endet über Zeitsteuerung, Kassieren und Bauen, statt sie zu verdecken
  function passeHoehe() {
    if (liste.hidden) return;
    liste.style.maxHeight = '';
    const r = liste.getBoundingClientRect();
    if (!r.width) return;
    let unten = window.innerHeight - 8;
    for (const id of ['hm-zeit', 'btn-collect', 'btn-build']) {
      const n = document.getElementById(id);
      const q = n?.getBoundingClientRect();
      if (!q || !q.width || n.hidden || getComputedStyle(n).visibility === 'hidden') continue;
      if (q.right <= r.left || q.left >= r.right || q.top <= r.top) continue;
      unten = Math.min(unten, q.top - 8);
    }
    liste.style.maxHeight = `${Math.max(120, Math.floor(unten - r.top))}px`;
  }
  window.addEventListener('resize', () => requestAnimationFrame(passeHoehe));
  knopf.addEventListener('click', () => auf(liste.hidden));
  // Antippen der Karte klappt die Tafel wieder zu, damit sie keine Bojen verdeckt
  game.on('tap', () => auf(false));

  let notizTimer = 0;
  let aufgeschoben = null;
  function melde(textInhalt) {
    if (abschlussOffen()) { aufgeschoben = textInhalt; return; }
    notiz.textContent = textInhalt;
    notiz.hidden = false;
    clearTimeout(notizTimer);
    notizTimer = setTimeout(() => { notiz.hidden = true; }, 4500);
  }
  function jubel() {
    tafel.classList.remove('jubel'); void tafel.offsetWidth; tafel.classList.add('jubel');
    if (navigator.vibrate) navigator.vibrate([20, 40, 20]);
  }

  function karteLi(ziel, i) {
    const li = el('li', { class: 'tz-karte' },
      el('span', { class: `tz-schwere ${ziel.schwere}`, text: SCHWERE_NAME[ziel.schwere] }),
      el('span', { class: 'tz-text', text: text(ziel) }),
      el('span', { class: 'tz-lohn', text: belohnungText(ziel.belohnung) }),
      el('button', {
        type: 'button', class: 'tz-nehmen hm-knopf hm-primaer', 'aria-label': `Nehmen: ${text(ziel)}`,
        onclick: (ev) => { ev.stopPropagation(); nimm(i); },
      }, 'Nehmen'),
    );
    return li;
  }

  function zeichne() {
    const z = zielState(st());
    const ziel = gewaehlt(st());
    const winter = sim.season(st(), api.ctx).winter;
    const etwas = z.karten.length || z.woche;
    // Kein totes Element: ohne Karten und ohne Wochenziel keine Tafel
    tafel.hidden = !etwas;
    if (!etwas) return;

    if (!ziel && z.karten.length) {
      knopf.textContent = 'Tagesziel wählen';
      knopf.classList.add('tz-neu');
      knopf.setAttribute('aria-label', 'Tagesziel wählen: drei Karten liegen bereit');
    } else if (ziel) {
      knopf.classList.remove('tz-neu');
      knopf.textContent = ziel.erledigt ? 'Tagesziel geschafft' : `Tagesziel ${stand(ziel)}`;
      knopf.setAttribute('aria-label', `${text(ziel)}: ${ziel.erledigt ? 'geschafft' : `${ziel.ist} von ${ziel.soll}`}`);
    } else {
      knopf.classList.remove('tz-neu');
      const w = z.woche;
      knopf.textContent = winter ? 'Wochenziel ruht' : `Wochenziel ${stand(w)}`;
      knopf.setAttribute('aria-label', `Wochenziel: ${wocheText(w)}, ${w.ist} von ${w.soll}`);
    }
    if (liste.hidden) return;

    const zeilen = [];
    const waehlen = !ziel && z.karten.length > 0;
    if (waehlen) {
      // Kompakt, damit am Handy alles ohne Scrollen passt: Kopf, Wochenziel in einer Zeile, drei Karten
      zeilen.push(el('li', { class: 'tz-klein tz-kopf-kurz', text: 'Nimm ein Ziel. Es zählt nur, was du selbst tust.' }));
      if (z.woche) {
        zeilen.push(el('li', { class: 'tz-klein tz-woche-kurz' },
          el('span', { class: 'tz-stand', text: stand(z.woche) }), `Woche: ${wocheText(z.woche)}`));
      }
      z.karten.forEach((k, i) => zeilen.push(karteLi(k, i)));
      liste.classList.add('tz-wahl');
      liste.replaceChildren(...zeilen);
      passeHoehe();
      return;
    }
    liste.classList.remove('tz-wahl');
    if (ziel) {
      const h = hinweis(ziel);
      zeilen.push(el('li', { class: `tz-ziel${ziel.erledigt ? ' erledigt' : ''}` },
        el('span', { class: 'tz-stand', text: ziel.erledigt ? 'geschafft' : stand(ziel) }),
        el('span', { class: 'tz-text', text: text(ziel) }),
        el('span', { class: 'tz-klein', text: `${SCHWERE_NAME[ziel.schwere]}. Belohnung: ${belohnungText(ziel.belohnung)}` }),
        h ? el('span', { class: 'tz-klein', text: h }) : null,
        balken(ziel.ist, ziel.soll)));
    }
    if (z.woche) {
      const w = z.woche;
      const deko = w.deko ? DEKO.find((d) => d.id === w.deko) : null;
      const rest = winter ? 'ruht im Winter' : w.erledigt ? 'geschafft' : w.tage === 1 ? 'letzter Tag' : `noch ${w.tage} Tage`;
      zeilen.push(el('li', { class: `tz-ziel tz-woche${w.erledigt ? ' erledigt' : ''}` },
        el('span', { class: 'tz-stand', text: stand(w) }),
        el('span', { class: 'tz-text', text: `Wochenziel: ${wocheText(w)}` }),
        el('span', { class: 'tz-klein', text: `${rest}. Belohnung: ${w.geld} €${deko ? ` und ${deko.name}` : ''}` }),
        balken(w.ist, w.soll)));
    }
    const extras = [];
    if (z.gutschein) extras.push(`Gutschein: ${z.gutschein.prozent} % zurück beim nächsten Bau (bis ${z.gutschein.hoechstens} €)`);
    if (z.gast) extras.push(`Seltener Gast unterwegs: ${z.gast.name}`);
    if (z.deko.length) extras.push(`Deko im Hafen: ${z.deko.length} von ${DEKO.length}`);
    if (extras.length) zeilen.push(el('li', { class: 'tz-klein' }, ...extras.map((t) => el('span', { class: 'tz-klein', text: t }))));
    liste.replaceChildren(...zeilen);
    passeHoehe();
  }

  function nimm(i) {
    if (!waehle(st(), i)) return;
    const ziel = gewaehlt(st());
    game.emit('sound', 'auswahl');
    game.emit('ziel:gewaehlt', { art: ziel.art, text: text(ziel), schwere: ziel.schwere });
    zeichne();
    game.emit('sim:change', { reason: 'ziel' });
  }

  function belohne(ziel) {
    const b = ziel.belohnung;
    const geld = gibBelohnung(st(), api.ctx, b);
    if (geld > 0) api.addIncome(geld, 'tagesziele');
    if (b.art === 'deko') game.emit('ziel:deko', { id: b.id, name: b.name });
    game.emit('sound', 'fertig');
    game.emit('ziel:erreicht', { art: ziel.art, text: text(ziel), belohnung: b, belohnungText: belohnungText(b) });
    melde(`Tagesziel geschafft: ${belohnungText(b)}`);
    jubel();
  }

  function belohneWoche(w) {
    const geld = gibWochenBelohnung(st(), w);
    if (geld > 0) api.addIncome(geld, 'tagesziele', 'woche');
    const deko = w.deko ? DEKO.find((d) => d.id === w.deko) : null;
    if (deko) game.emit('ziel:deko', { id: deko.id, name: deko.name });
    game.emit('sound', 'stufe');
    game.emit('wochenziel:erreicht', { art: w.art, text: wocheText(w), geld: w.geld, deko: w.deko });
    melde(`Wochenziel geschafft: ${w.geld} €${deko ? ` und ${deko.name}` : ''}`);
    jubel();
  }

  // Morgens: erst der Tagesabschluss, dann die Kartenwahl (einmal pro Tag von selbst)
  let wahlWartet = false;
  function morgenWahl() {
    wahlWartet = false;
    if (gewaehlt(st()) || !zielState(st()).karten.length) return;
    const b = document.body.classList;
    const besetzt = b.contains('card-open') || b.contains('foto') || game.bauen?.offen
      || document.querySelector('.hm-tipp:not([hidden])') || game.einstieg?.schritt?.();
    if (besetzt) { zeichne(); jubel(); return; }
    auf(true);
    jubel();
  }
  function nachAbschluss() {
    if (aufgeschoben) { const t = aufgeschoben; aufgeschoben = null; melde(t); }
    if (wahlWartet) morgenWahl();
  }
  game.on('tagesabschluss:fertig', nachAbschluss);
  game.on('tagesabschluss:zu', () => setTimeout(() => { if (!abschlussOffen()) nachAbschluss(); }, 0));

  function pruefeTag() {
    if (tageswechsel(st(), api.ctx)) zeichne();
  }
  let wahlTag = 0;
  function neuerMorgen() {
    pruefeTag();
    const z = zielState(st());
    if (wahlTag === st().day || z.tag !== st().day || !z.karten.length || gewaehlt(st())) return;
    wahlTag = st().day;
    wahlWartet = true;
    if (!abschlussOffen()) morgenWahl();
  }

  for (const typ of ['moored', 'feeReady', 'collected', 'departed']) {
    game.on(`sim:${typ}`, (e) => {
      pruefeTag();
      const r = werteAus(st(), api.ctx, e);
      if (r.tag) belohne(r.tag);
      if (r.woche) belohneWoche(r.woche);
      if (r.tag || r.woche || gewaehlt(st()) || zielState(st()).woche) zeichne();
    });
  }
  // Seltener Gast läuft ein
  game.on('sim:arrived', (e) => {
    const b = st().boats[e.boatId];
    if (!b?.selten) return;
    melde(`Seltener Gast läuft ein: ${b.name}`);
    game.emit('ziel:seltenerGast', { boatId: b.id, name: b.name });
    zeichne();
  });
  // Gutschein beim nächsten Bau (Stege, Versorgung, Hafenbüro, Services)
  function gebaut(kosten) {
    const betrag = loeseGutschein(st(), kosten);
    if (!betrag) return;
    api.addIncome(betrag, 'tagesziele', 'gutschein');
    game.emit('ziel:gutschein', { betrag });
    melde(`Gutschein eingelöst: ${betrag} € zurück`);
    zeichne();
  }
  game.on('sim:built', (e) => gebaut(e?.cost));
  game.on('services:gebaut', (e) => gebaut(e?.kosten));

  game.on('sim:dayStart', neuerMorgen);
  game.on('spielstand-geladen', () => { pruefeTag(); zeichne(); });
  game.on('sim:change', (e) => { if (e?.reason !== 'ziel') { pruefeTag(); zeichne(); } });
  pruefeTag();
  zeichne();

  game.tagesziele = {
    zustand: () => zielState(st()),
    karten: () => zielState(st()).karten,
    gewaehlt: () => gewaehlt(st()),
    woche: () => zielState(st()).woche,
    waehle: nimm,
    oeffnen: () => auf(true),
    text, wocheText, belohnungText,
    // Alte Schnittstelle: die gewählte Karte als Liste (für Anzeigen, die drei Ziele erwarten)
    liste: () => (gewaehlt(st()) ? [gewaehlt(st())] : []),
  };

  // Deko-Stücke im Hafen (eigenes Modul mit Three.js, hier nur nachgeladen)
  import('./ziel-deko.js').then((m) => m.init(game)).catch((err) => console.error('Deko für Tagesziele', err));
}
