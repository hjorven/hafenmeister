// Naturecke am Schilf (Roadmap P52, F39): Regeln ohne Browser. Beschreibung: docs/naturecke.md.
//
// Neben dem Hafen wächst ein Schilfgürtel (Lage: render/landschaft/naturecke-lage.js). Ab Ausbaustufe
// ECONOMY.naturecke.abStufe entscheidet der Spieler einmal und endgültig:
// - schützen: Bohlenweg mit Beobachtungshütte. Wer einen Abend im Hafen lag (Frösche, Rohrsänger,
//   Haubentaucher), bewertet um schuetzen.anker besser (Gästebuch: "Abend am Schilf").
// - bebauen: Ufer aufschütten, Park- und Trailerplatz. Jeden Abend in der Saison bringt er
//   bebauen.grund[Stufe] plus bebauen.jeGast je Gastboot im Hafen (Tagesabschluss: Sonstiges, Parkplatz).
// Wer sich nicht entscheidet, behält das Schilf ohne Wirkung. Rückgängig gibt es nicht (Regel F39).
//
// Spielstand: state.modules.naturecke = { wahl: 'schutz' | 'bebaut' | null, tag, lage? (Zwischenspeicher
// der Lage im Browser, features/naturecke.js) }. Am Gast: boat.natur = true (lag einen Abend am Schilf).
// Tests: tests/naturecke.test.mjs.

import * as sim from '../sim.js';
import { ECONOMY } from '../data/economy.js';

export const REGELN = ECONOMY.naturecke ?? null;
export const WAHLEN = ['schutz', 'bebaut'];
// Eintrag im Baumenü je Wahl: id des Angebots -> Wahl im Spielstand
export const ANGEBOT = { schuetzen: 'schutz', bebauen: 'bebaut' };

export function nState(state) {
  state.modules ||= {};
  const n = (state.modules.naturecke ||= { wahl: null, tag: null });
  if (!WAHLEN.includes(n.wahl)) n.wahl = null;
  n.tag ??= null;
  return n;
}

/** Was aus dem Schilf geworden ist: 'schutz', 'bebaut' oder null (noch offen). */
export function wahl(state) {
  const w = state?.modules?.naturecke?.wahl;
  return WAHLEN.includes(w) ? w : null;
}

/** Ab wann sich der Spieler entscheiden kann. */
export function offenAb(state) {
  return state && REGELN ? (state.stage ?? 1) >= (REGELN.abStufe ?? 2) : false;
}

/**
 * Die beiden Angebote im Baumenü, solange noch nichts entschieden ist: [{ id, wahl, kosten, gesperrt }].
 * hatLage: Hat die Küste einen Schilfgürtel (naturLage)? Ohne gibt es nichts. In der Stufe davor stehen
 * sie gesperrt da ("ab Ausbaustufe 2").
 */
export function angebote(state, hatLage = true) {
  if (!REGELN || !state || !hatLage || wahl(state)) return [];
  const ab = REGELN.abStufe ?? 2;
  if ((state.stage ?? 1) < ab - 1) return [];
  const gesperrt = (state.stage ?? 1) < ab ? `ab Ausbaustufe ${ab}` : null;
  return Object.entries(ANGEBOT).map(([id, w]) => ({ id, wahl: w, kosten: REGELN[id]?.kosten ?? 0, gesperrt }));
}

/**
 * Entscheiden: id 'schuetzen' oder 'bebauen'. bezahle(kosten) bucht die Ausgabe.
 * Gibt { ok, grund?, wahl?, kosten?, events } zurück; grund 'schon', 'unbekannt', 'stufe', 'geld'.
 */
export function entscheiden(state, id, bezahle = (k) => sim.spend(state, k, 'bau'), hatLage = true) {
  if (wahl(state)) return { ok: false, grund: 'schon', events: [] };
  const a = angebote(state, hatLage).find((x) => x.id === id);
  if (!a) return { ok: false, grund: 'unbekannt', events: [] };
  if (a.gesperrt) return { ok: false, grund: 'stufe', events: [] };
  if (state.money < a.kosten || !bezahle(a.kosten)) return { ok: false, grund: 'geld', events: [] };
  const n = nState(state);
  n.wahl = a.wahl;
  n.tag = state.day;
  return { ok: true, wahl: a.wahl, kosten: a.kosten, events: [{ type: 'naturecke', wahl: a.wahl, kosten: a.kosten }] };
}

/** Einnahme des Parkplatzes an einem Abend (0 ohne Parkplatz). gaeste: Gastboote im Hafen. */
export function parkplatzEinnahme(state, gaeste) {
  if (wahl(state) !== 'bebaut' || !REGELN?.bebauen) return 0;
  const b = REGELN.bebauen;
  const st = Math.max(0, Math.min((b.grund?.length ?? 1) - 1, state.stage ?? 1));
  return Math.round((b.grund?.[st] ?? 0) + (b.jeGast ?? 0) * Math.max(0, gaeste));
}

/** Hook 'evening': Parkplatz kassiert, Gäste erleben den Abend am Schilf. */
export function abendHook({ state, ctx, boats, events, addIncome }) {
  const w = wahl(state);
  if (!w || sim.season(state, ctx).winter) return;
  const gaeste = (boats ?? sim.mooredBoats(state)).filter((b) => !b.stationed && !b.trip?.away);
  if (w === 'schutz') {
    for (const b of gaeste) b.natur = true;
    return;
  }
  const betrag = parkplatzEinnahme(state, gaeste.length);
  if (betrag > 0) {
    addIncome(betrag, 'sonstiges', 'parkplatz');
    events?.push({ type: 'parkplatz', amount: betrag, gaeste: gaeste.length });
  }
}

/** Anker, die ein Gast mehr gibt (Hook 'rating'): einen Abend am geschützten Schilf erlebt. */
export function ankerBonus(state, boat) {
  return boat?.natur && wahl(state) === 'schutz' ? REGELN?.schuetzen?.anker ?? 0 : 0;
}

/** Hooks in einen Regel-Kontext hängen (Browser über game.sim.addHook, Werkzeuge über sim.addHook). */
export function haengeEin(addHook, getState) {
  if (!REGELN) return () => {};
  const ab = [
    addHook('evening', (a) => abendHook({ ...a, state: getState() ?? a.state })),
    addHook('rating', ({ boat }) => { const s = getState(); return s ? ankerBonus(s, boat) : 0; }),
  ];
  return () => ab.forEach((f) => f?.());
}
