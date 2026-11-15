// Statistik und Saisonbilanz (Roadmap P41: F19, F20), Logik ohne Browser. Beschreibung: docs/statistik.md.
//
// Quellen:
// - state.stats.verlauf: Tagesberichte der letzten 30 Tage (sim.tagesbericht), Einnahmen je Quelle.
// - state.modules.statistik.nacht: Belegung jeder Nacht, mitgeschrieben im Hook 'night' (nach der Abreise
//   der Gäste, vor dem Tageswechsel). Ältere Spielstände ohne diese Liste schätzen die Belegung aus dem
//   Tagesbericht (liegend + abgereist durch alle Plätze), das ist als geschaetzt markiert.
// - state.modules.statistik.saisons: Bilanz jeder Saison, gemerkt in der Nacht des letzten Saisontags.
//   Der Verlauf hält nur 30 Tage; so bleibt die Bilanz auch am zweiten und dritten Wintertag vollständig
//   und die Saisons davor stehen zum Vergleich bereit.
//
// Spielstand: state.modules.statistik = { nacht: [{ tag, gaeste, dauer, plaetze }], saisons: [Bilanz] }
// Keine neue SAVE_VERSION: fehlt der Eintrag, wird er leer angelegt.

import * as sim from '../sim.js';

export const NACHT_MAX = 30;      // so lang wie state.stats.verlauf
export const SAISONS_MAX = 20;    // ältere Saisons fallen weg (Spielstand bleibt klein)
export const VOLL_AB = 0.95;      // Nacht gilt als voll

/** Feste Reihenfolge und Namen der Einnahmequellen (wie im Tagesabschluss). */
export const QUELLEN = ['liegegeld', 'pacht', 'gastro', 'services', 'tagesziele', 'saisonziele', 'sonstiges'];
export const QUELLE_NAME = {
  liegegeld: 'Liegegeld',
  pacht: 'Pacht',
  gastro: 'Gastronomie',
  services: 'Services',
  tagesziele: 'Tagesziele',
  saisonziele: 'Saisonziele',
  sonstiges: 'Sonstiges',
};

const istObjekt = (x) => x != null && typeof x === 'object' && !Array.isArray(x);
const zahl = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);

export function statistikState(state) {
  state.modules ||= {};
  const s = state.modules.statistik;
  if (!istObjekt(s)) state.modules.statistik = { nacht: [], saisons: [] };
  const m = state.modules.statistik;
  if (!Array.isArray(m.nacht)) m.nacht = [];
  if (!Array.isArray(m.saisons)) m.saisons = [];
  return m;
}

/** Saison eines beliebigen Tages (wie sim.season, aber für eine Tagesnummer). */
export function saisonVon(tag, rules) {
  const { seasonDays, winterDays = 0 } = rules;
  const len = seasonDays + winterDays;
  const i = (tag - 1) % len;
  return { jahr: Math.floor((tag - 1) / len) + 1, tag: i + 1, winter: i >= seasonDays };
}

/** Belegung jetzt: Gastboote, Dauerlieger und Plätze ohne die fest vergebenen (Fischer, Dienste). */
export function belegungJetzt(state, ctx, abgereist = 0) {
  const plaetze = sim.availableBerths(state, ctx).filter((b) => !b.reserved).length;
  let gaeste = 0;
  let dauer = 0;
  for (const b of sim.mooredBoats(state)) {
    if (!b.stationed) gaeste++;
    else if (b.dauer) dauer++;
  }
  return { gaeste: gaeste + abgereist, dauer, plaetze };
}

/**
 * Hook 'night': Belegung dieser Nacht merken. Die Gäste, die heute abgereist sind, lagen die Nacht noch
 * da (sie legen erst am Vormittag ab) und zählen mit. Am letzten Saisontag wird die Saison gemerkt.
 */
export function nachtMerken(state, ctx) {
  const m = statistikState(state);
  const abgereist = state.stats?.heute?.tag === state.day ? zahl(state.stats.heute.abgereist) : 0;
  const b = belegungJetzt(state, ctx, abgereist);
  m.nacht = m.nacht.filter((n) => istObjekt(n) && n.tag !== state.day && n.tag > state.day - NACHT_MAX);
  m.nacht.push({ tag: state.day, ...b });
  const sea = sim.season(state, ctx);
  if (!sea.winter && sea.day === ctx.rules.seasonDays) saisonMerken(state, ctx, sim.tagesbericht(state, ctx));
}

/** Belegung eines Tages: aus der Nacht-Liste, sonst geschätzt aus dem Tagesbericht. */
export function belegungTag(state, bericht) {
  const n = statistikState(state).nacht.find((x) => x?.tag === bericht?.tag);
  if (n && n.plaetze > 0) {
    const belegt = Math.min(n.plaetze, zahl(n.gaeste) + zahl(n.dauer));
    return { gaeste: zahl(n.gaeste), dauer: zahl(n.dauer), plaetze: n.plaetze, anteil: belegt / n.plaetze, geschaetzt: false };
  }
  const plaetze = zahl(bericht?.plaetze);
  if (!plaetze) return null;
  const gaeste = zahl(bericht.liegend) + zahl(bericht.abgereist);
  return { gaeste, dauer: 0, plaetze, anteil: Math.min(1, gaeste / plaetze), geschaetzt: true };
}

/** Einnahmen eines Tagesberichts je Quelle, ohne Geschenke (wie die Tagessumme). */
export function quellenTag(bericht) {
  const q = {};
  for (const [k, v] of Object.entries(bericht?.einnahmen || {})) {
    const n = zahl(v) - (k === 'sonstiges' ? zahl(bericht.geschenkt) : 0);
    if (n > 0) q[k] = n;
  }
  return q;
}

/**
 * Die letzten Tage für die Statistik, ältester zuerst. Mit heute (laufender Tagesbericht) kommt der
 * laufende Tag als letzter dazu (laufend: true, Belegung von jetzt).
 */
export function tage(state, ctx, { heute = null, anzahl = NACHT_MAX } = {}) {
  const liste = (state.stats?.verlauf || []).filter((b) => istObjekt(b) && Number.isInteger(b.tag)).slice(-anzahl);
  const aus = liste.map((b) => tagEintrag(state, ctx, b));
  if (heute && Number.isInteger(heute.tag) && !liste.some((b) => b.tag === heute.tag)) {
    const e = tagEintrag(state, ctx, heute);
    const jetzt = belegungJetzt(state, ctx);
    e.belegung = jetzt.plaetze ? { ...jetzt, anteil: Math.min(1, (jetzt.gaeste + jetzt.dauer) / jetzt.plaetze), geschaetzt: false } : null;
    e.laufend = true;
    aus.push(e);
    while (aus.length > anzahl) aus.shift();
  }
  return aus;
}

function tagEintrag(state, ctx, b) {
  const s = saisonVon(b.tag, ctx.rules);
  const quellen = quellenTag(b);
  return {
    tag: b.tag,
    jahr: s.jahr,
    saisonTag: s.tag,
    winter: s.winter,
    summe: Object.values(quellen).reduce((a, x) => a + x, 0),
    quellen,
    ausgaben: zahl(b.ausgabenSumme),
    angelegt: zahl(b.angelegt),
    abgereist: zahl(b.abgereist),
    bewertung: b.bewertung ?? null,
    weggefahren: zahl(b.weggefahrenSumme),
    belegung: belegungTag(state, b),
    laufend: false,
  };
}

/** Summe je Quelle über mehrere Tage: [{ id, name, summe, anteil }], größte zuerst, nur was etwas brachte. */
export function quellenSumme(liste) {
  const sum = {};
  for (const t of liste) for (const [k, v] of Object.entries(t.quellen || {})) sum[k] = (sum[k] || 0) + v;
  const gesamt = Object.values(sum).reduce((a, x) => a + x, 0);
  return Object.entries(sum)
    .filter(([, v]) => v > 0)
    .map(([id, v]) => ({ id, name: QUELLE_NAME[id] ?? id, summe: v, anteil: gesamt ? v / gesamt : 0 }))
    .sort((a, b) => b.summe - a.summe || QUELLEN.indexOf(a.id) - QUELLEN.indexOf(b.id));
}

/** Kennzahlen über die Tage: Summe, Schnitt je Saisontag, bester Tag, Belegung im Schnitt, volle Nächte. */
export function zusammenfassung(liste) {
  const fertig = liste.filter((t) => !t.laufend);
  const saison = fertig.filter((t) => !t.winter);
  const summe = liste.reduce((a, t) => a + t.summe, 0);
  let best = null;
  for (const t of fertig) if (t.summe > 0 && (!best || t.summe > best.summe)) best = { tag: t.tag, summe: t.summe };
  const mitBelegung = saison.filter((t) => t.belegung);
  const belegung = mitBelegung.length ? mitBelegung.reduce((a, t) => a + t.belegung.anteil, 0) / mitBelegung.length : null;
  return {
    tage: fertig.length,
    summe,
    schnitt: saison.length ? Math.round(saison.reduce((a, t) => a + t.summe, 0) / saison.length) : 0,
    besterTag: best,
    belegung,
    geschaetzt: mitBelegung.some((t) => t.belegung.geschaetzt),
    volleNaechte: mitBelegung.filter((t) => t.belegung.anteil >= VOLL_AB).length,
    weggefahren: fertig.reduce((a, t) => a + t.weggefahren, 0),
    angelegt: fertig.reduce((a, t) => a + t.angelegt, 0),
    winterTage: fertig.filter((t) => t.winter).length,
  };
}

/**
 * Bilanz einer Saison aus dem Verlauf (plus optional dem laufenden Tagesbericht, der noch nicht im
 * Verlauf steht). Form wie bisher in features/winter.js, dazu quellen, belegung und stufe.
 */
export function saisonRechnen(state, ctx, jahr, extra = null) {
  const { seasonDays, winterDays = 0 } = ctx.rules;
  const von = (jahr - 1) * (seasonDays + winterDays) + 1;
  const bis = von + seasonDays - 1;
  const quelle = [...(state.stats?.verlauf || [])];
  if (extra && !quelle.some((t) => t?.tag === extra.tag)) quelle.push(extra);
  const tageListe = quelle.filter((t) => istObjekt(t) && t.tag >= von && t.tag <= bis).sort((a, b) => a.tag - b.tag);
  const sum = (f) => tageListe.reduce((a, t) => a + (Number(f(t)) || 0), 0);
  const abgereist = sum((t) => t.abgereist);
  const bewertet = sum((t) => (t.bewertung != null ? t.bewertung * t.abgereist : 0));
  let best = null;
  for (const t of tageListe) if ((t.summe || 0) > 0 && (!best || t.summe > best.summe)) best = { tag: t.tag - von + 1, summe: t.summe };
  const quellen = {};
  for (const t of tageListe) for (const [k, v] of Object.entries(quellenTag(t))) quellen[k] = (quellen[k] || 0) + v;
  const bel = tageListe.map((t) => belegungTag(state, t)).filter(Boolean);
  return {
    jahr,
    tage: tageListe.length,
    stufe: tageListe.length ? tageListe[tageListe.length - 1].stufe ?? null : null,
    einnahmen: sum((t) => t.summe),
    quellen,
    ausgaben: sum((t) => t.ausgabenSumme),
    angelegt: sum((t) => t.angelegt),
    abgereist,
    bewertung: abgereist ? Math.round((bewertet / abgereist) * 10) / 10 : null,
    weggefahren: sum((t) => t.weggefahrenSumme),
    ruf: tageListe.length ? { vorher: tageListe[0].ruf?.vorher ?? null, nachher: tageListe[tageListe.length - 1].ruf?.nachher ?? null } : null,
    besterTag: best,
    belegung: bel.length ? Math.round((bel.reduce((a, b) => a + b.anteil, 0) / bel.length) * 1000) / 1000 : null,
    volleNaechte: bel.filter((b) => b.anteil >= VOLL_AB).length,
  };
}

/** Saison merken (überschreibt eine frühere Fassung derselben Saison). */
export function saisonMerken(state, ctx, extra = null, jahr = sim.season(state, ctx).year) {
  const m = statistikState(state);
  const b = saisonRechnen(state, ctx, jahr, extra);
  if (!b.tage) return null;
  m.saisons = m.saisons.filter((x) => istObjekt(x) && x.jahr !== jahr);
  m.saisons.push(b);
  m.saisons.sort((a, b2) => a.jahr - b2.jahr);
  while (m.saisons.length > SAISONS_MAX) m.saisons.shift();
  return b;
}

/**
 * Bilanz einer Saison: gemerkt, sonst aus dem Verlauf gerechnet. Ohne Jahr die gerade zu Ende gegangene
 * (im Winter) oder die laufende Saison.
 */
export function saison(state, ctx, jahr = sim.season(state, ctx).year) {
  const gemerkt = statistikState(state).saisons.find((x) => x?.jahr === jahr);
  const gerechnet = saisonRechnen(state, ctx, jahr);
  // Gemerkt ist vollständig; gerechnet kann mehr Tage haben, wenn die Saison noch läuft
  return gemerkt && gemerkt.tage >= gerechnet.tage ? { ...gemerkt } : gerechnet;
}

/** Gemerkte Saisons, neueste zuerst. */
export function saisons(state) {
  return [...statistikState(state).saisons].filter(istObjekt).sort((a, b) => b.jahr - a.jahr);
}

/** Veränderung zur Saison davor in Prozent (gerundet), null ohne Vergleich. */
export function vergleich(jetzt, vorher) {
  if (!vorher || !(vorher > 0) || jetzt == null) return null;
  return Math.round(((jetzt - vorher) / vorher) * 100);
}

/** Hooks in einen Regel-Kontext hängen (Browser über game.sim.addHook, Tests über sim.addHook). */
export function haengeEin(addHook) {
  return addHook('night', ({ state, ctx }) => nachtMerken(state, ctx));
}
