// Preisstufe am Hafenbüro (Roadmap P35, F6): Regeln ohne DOM und ohne Three.js, laufen auch in Node
// (tests/preisstufe.test.mjs, tools/balance.mjs). Beschreibung: docs/preisstufe.md
//
// Ab "Hafenmeister mit Funk" legt der Spieler einmal je Saison die Preisliste fest: günstig, normal oder
// gehoben. Im Winter gilt die Wahl für die kommende Saison. Am Tag der Wahl darf er noch umentscheiden
// (verklickt, anders überlegt), danach erst wieder in der nächsten Saison oder nach dem nächsten Ausbau
// (neue Hafenstufe, neue Preisliste).
//
// Wirkung (Zahlen in ECONOMY.preisstufe, Regeln in data/rules.js als rules.priceLevels):
//   - Liegegeld mal liegegeld (Modifikator priceFactor, wirkt sofort auf jedes neue Liegegeld)
//   - Ankünfte mal ankuenfte, Bootsklassen mal klassen (ab dem nächsten Morgen, der Tag ist dann verteilt)
//   - Bewertung: ruf Anker, bei gehoben dazu anspruch mal Anteil der unerfüllten Wünsche (sim.priceRating)
// Jedes Boot merkt sich bei der Ankunft die Preisstufe (boat.preisstufe), nach der es bezahlt und bewertet.
// Wird die Stufe gewechselt, gilt die neue für alle, die noch nicht fest liegen; wer liegt, hat schon bezahlt.
//
// Stand: state.modules.preisstufe = { stufe, jahr, tag, ausbau, verlauf: [{ jahr, tag, stufe }], gesehen }.
import * as sim from '../sim.js';
import { ECONOMY } from '../data/economy.js';
import { seasonOf } from '../events/scheduler.js';
import { YEAR } from '../data/events.js';

export const PS = ECONOMY.preisstufe ?? null;
export const STUFEN = Object.keys(PS?.stufen ?? {});
export const START = PS?.start ?? 'normal';

/** Namen und kurze Texte (ohne Zahlen, die stehen in economy.js) */
export const TEXTE = {
  guenstig: { name: 'Günstig', kurz: 'mehr Gäste, faire Preise', text: 'Mehr Boote, vor allem kleine. Gäste loben die Preise.' },
  normal: { name: 'Normal', kurz: 'übliche Hafenpreise', text: 'Die üblichen Preise an der Küste.' },
  gehoben: { name: 'Gehoben', kurz: 'mehr Geld, hohe Ansprüche', text: 'Mehr Liegegeld, mehr große Yachten. Wer viel zahlt, erwartet, dass alles da ist.' },
};

const MAX_VERLAUF = 40;

/** Eigener Stand im Spielstand */
export function pState(state) {
  if (!state.modules || typeof state.modules !== 'object') state.modules = {};
  const m = (state.modules.preisstufe ||= {});
  if (!STUFEN.includes(m.stufe)) m.stufe = START;
  m.jahr ??= null;          // Saison, für die zuletzt gewählt wurde
  m.tag ??= null;           // Spieltag der Wahl (an dem Tag darf noch umentschieden werden)
  m.ausbau ??= null;        // Hafenstufe bei der Wahl (nach einem Ausbau darf neu gewählt werden)
  if (!Array.isArray(m.verlauf)) m.verlauf = [];
  m.gesehen ??= null;       // Saison, in der die Oberfläche zuletzt gefragt hat
  m.gesehenAusbau ??= null; // Hafenstufe, nach deren Ausbau die Oberfläche zuletzt gefragt hat
  return m;
}

/** Saison, für die eine Wahl heute gilt: in der Saison diese, im Winter die kommende */
export function saisonJahr(day) {
  const s = seasonOf(Math.max(1, day ?? 1), YEAR);
  return s.winter ? s.year + 1 : s.year;
}

/** Aktuelle Stufe (ohne Spielstand: Start) */
export const stufe = (state) => (state?.modules?.preisstufe && STUFEN.includes(state.modules.preisstufe.stufe) ? state.modules.preisstufe.stufe : START);

/** Ist die Preistafel schon frei (Hafenbüro gekauft)? */
export function frei(state, ctx) {
  const ab = ctx?.rules?.priceLevels?.fromOffice ?? PS?.abBuero ?? 1;
  return !!ctx?.rules?.priceLevels && (state?.office ?? 0) >= ab;
}

/**
 * Darf jetzt gewählt werden? { ok, grund?, jahr, heuteNoch }
 *   grund 'buero'  Hafenbüro fehlt noch
 *         'saison' in dieser Saison schon entschieden (wieder ab Saison jahr + 1 oder nach dem nächsten Ausbau)
 * ausbau: frei, weil seit der letzten Wahl ausgebaut wurde
 * heuteNoch: heute gewählt, umentscheiden geht bis zum Ende des Tages
 */
export function darfWaehlen(state, ctx) {
  const jahr = saisonJahr(state.day);
  if (!frei(state, ctx)) return { ok: false, grund: 'buero', jahr, heuteNoch: false };
  const m = pState(state);
  const heuteNoch = m.jahr === jahr && m.tag === state.day;
  const ausbau = m.jahr === jahr && !heuteNoch && m.ausbau != null && (state.stage ?? 1) > m.ausbau;
  if (m.jahr === jahr && !heuteNoch && !ausbau) return { ok: false, grund: 'saison', jahr, heuteNoch: false, ausbau: false };
  return { ok: true, jahr, heuteNoch, ausbau };
}

/**
 * Preisstufe wählen. Gibt { ok, reason?, events } zurück; events für game.sim.dispatch
 * ({ type: 'preisstufe', stufe, vorher, jahr, day } wird zu 'sim:preisstufe').
 */
export function waehle(state, ctx, neu) {
  if (!STUFEN.includes(neu)) return { ok: false, reason: 'unbekannt', events: [] };
  const d = darfWaehlen(state, ctx);
  if (!d.ok) return { ok: false, reason: d.grund, events: [] };
  const m = pState(state);
  const vorher = m.stufe;
  // Erste Wahl der Saison oder Umentscheiden am selben Tag
  if (d.heuteNoch && m.verlauf.length && m.verlauf[m.verlauf.length - 1].jahr === d.jahr && m.verlauf[m.verlauf.length - 1].tag === state.day) {
    m.verlauf[m.verlauf.length - 1].stufe = neu;
  } else {
    m.verlauf.push({ jahr: d.jahr, tag: state.day, stufe: neu });
    while (m.verlauf.length > MAX_VERLAUF) m.verlauf.shift();
  }
  m.stufe = neu;
  m.jahr = d.jahr;
  m.tag = state.day;
  m.ausbau = state.stage ?? 1;
  // Wer noch nicht fest liegt, zahlt und bewertet nach der neuen Preisliste
  let umgestellt = 0;
  for (const b of Object.values(state.boats || {})) {
    if (b.stationed || (b.status !== 'expected' && b.status !== 'waiting')) continue;
    b.preisstufe = neu;
    umgestellt++;
  }
  return { ok: true, events: [{ type: 'preisstufe', stufe: neu, vorher, jahr: d.jahr, day: state.day, umgestellt }] };
}

/** Wirkung als Modifikator (Hook 'modifiers'); normal oder ohne Büro: nichts */
export function modifikator(state, ctx) {
  const l = ctx?.rules?.priceLevels?.levels?.[stufe(state)];
  if (!l || !frei(state, ctx)) return null;
  const m = {};
  if (l.fee !== 1) m.priceFactor = l.fee;
  if (l.arrivals !== 1) m.arrivalFactor = l.arrivals;
  if (Object.keys(l.sizes || {}).length) m.sizeFactor = { ...l.sizes };
  return Object.keys(m).length ? m : null;
}

/** Hook 'arrival': das neue Boot merkt sich die Preisliste (Dauerlieger zahlen Pacht, keine Preisstufe) */
export function ankunft(state, ctx, boat) {
  if (!boat || boat.stationed || !frei(state, ctx)) return;
  const s = stufe(state);
  if (s !== START) boat.preisstufe = s;
  else delete boat.preisstufe;
}

/** Regeln einhängen (im Spiel über game.sim.addHook, in Node über sim.addHook(ctx, ...)) */
export function haengeEin(addHook) {
  const ab = [
    addHook('modifiers', (state, ctx) => modifikator(state, ctx)),
    addHook('arrival', ({ state, ctx, boat }) => ankunft(state, ctx, boat)),
  ];
  return () => ab.forEach((f) => f());
}

/**
 * Faustregel für die Spieler-Bots (tools/balance.mjs, tools/zeitraffer/lauf.cjs) und als Tipp in docs/preisstufe.md:
 * Fehlt Ruf, günstig (bessere Noten). Ab der Küstenmarina gehoben: für den Seehafen (alle Plätze, Großschiffe)
 * wird gespart. Davor günstig, solange für den Ausbau Gäste fehlen, sonst gehoben.
 */
export function klugeWahl(state, ctx) {
  const max = ctx.rules.maxStage ?? 6;
  if ((state.stage ?? 1) >= max) return 'gehoben';
  const c = sim.canAdvanceStage(state, ctx);
  if (c.missing.includes('reputation')) return 'guenstig';
  // Vor dem Seehafen sparen: ab der vorletzten Stufe gehoben (der Seehafen braucht viel Geld)
  if ((state.stage ?? 1) >= max - 1) return 'gehoben';
  return c.missing.includes('guests') ? 'guenstig' : 'gehoben';
}

/**
 * Für die Preistafel: Beispielpreise einer Nacht ohne Wünsche je Stufe für ein Boot (oder null),
 * { guenstig: 18, normal: 22, gehoben: 29 }.
 */
export function beispielPreise(ctx, grundpreis) {
  const out = {};
  for (const id of STUFEN) out[id] = Math.round(grundpreis * (ctx?.rules?.priceLevels?.levels?.[id]?.fee ?? 1));
  return out;
}

/** Wirkung einer Stufe in Worten, mit Zahlen aus den Regeln: ['Liegegeld −20 %', 'mehr Boote +15 %', ...] */
export function wirkungText(ctx, id) {
  const l = ctx?.rules?.priceLevels?.levels?.[id];
  if (!l) return [];
  const pz = (f) => `${f > 1 ? '+' : '−'}${Math.round(Math.abs(f - 1) * 100)} %`;
  const anker = (n) => `${n > 0 ? '+' : '−'}${String(Math.abs(n)).replace('.', ',')}`;
  const t = [];
  if (l.fee !== 1) t.push(`Liegegeld ${pz(l.fee)}`);
  if (l.arrivals !== 1) t.push(`Boote ${pz(l.arrivals)}`);
  const gross = Object.entries(l.sizes || {}).filter(([, f]) => f > 1).map(([k]) => k);
  const klein = Object.entries(l.sizes || {}).filter(([, f]) => f < 1).map(([k]) => k);
  if (gross.length) t.push(`mehr ${gross.map(groesse).join(' und ')}`);
  if (klein.length) t.push(`weniger ${klein.map(groesse).join(' und ')}`);
  if (l.rating) t.push(`Bewertung ${anker(l.rating)} Anker`);
  if (l.demand > 0) t.push(`fehlt etwas, bis zu ${anker(-l.demand)} Anker mehr Abzug`);
  else if (l.demand < 0) t.push(`fehlt etwas, sehen Gäste es eher nach (bis zu ${anker(-l.demand)} Anker)`);
  if (!t.length) t.push('keine Zu- oder Abschläge');
  return t;
}

const groesse = (k) => ({ S: 'kleine Boote', M: 'mittlere Boote', L: 'große Yachten', XL: 'große Schiffe', XXL: 'Großschiffe' }[k] ?? k);
