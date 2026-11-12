// Stammgäste: Boote mit Namen am Heck und Heimathafen, die wiederkommen, wenn es ihnen gefallen hat.
// Beschreibung in docs/neue-features.md, Abschnitt 4. Keine Figuren, keine Texte, nur Boote.
//
// - Jedes ankommende Gastboot bekommt einen Namen (boat.bootsname) und einen Heimathafen.
// - Wer bei der Abreise mit 4 oder mehr Ankern bewertet, wird Stammgast (höchstens 40, die ältesten fallen raus).
// - Ein neues Boot ist mit 15 Prozent Wahrscheinlichkeit ein Stammgast: gleiche Art, gleiches Modell,
//   gleicher Name, gleiche Wünsche wie beim letzten Mal. boat.stammId und boat.besuche (Nummer dieses Besuchs).
// - Ab dem 5. Besuch kann man einen liegenden Stammgast als Dauerlieger behalten (dauerlieger.js).
//
// Spielstand: state.modules.stamm = { naechsteId, liste: [{ stammId, bootsname, heimathafen, typeId, modelId,
//   name, size, kind, motor, length, beam, draft, wishes, besuche, zuletzt }], abend: { bootId: schnappschuss } }
//
// Die Logik läuft ohne Browser (tests/stammgaeste.test.mjs).

import * as sim from '../sim.js';
import { regelnBereit } from './regeln-bereit.js';
import { random } from '../random.js';
import { BOOTSNAMEN, heimathaefen } from '../data/bootsnamen.js';

export const STAMM = {
  chance: 0.15,       // Anteil der neuen Boote, die Stammgäste sind (wenn es welche gibt)
  abBewertung: 4,     // ab so vielen Ankern kommt ein Gast wieder
  maxListe: 40,
  dauerAbBesuch: 5,   // ab diesem Besuch als Dauerlieger behalten
};

export function stammState(state) {
  state.modules ||= {};
  state.modules.stamm ||= { naechsteId: 1, liste: [], abend: {} };
  return state.modules.stamm;
}

const pick = (state, list) => list[Math.floor(random(state) * list.length)];

function anwesend(state) {
  const ids = new Set();
  for (const b of Object.values(state.boats)) if (b.stammId) ids.add(b.stammId);
  for (const b of state.upcoming || []) if (b.stammId) ids.add(b.stammId);
  return ids;
}

/** Hook 'arrival': Namen vergeben, manchmal einen Stammgast schicken. */
export function ankunftHook({ state, ctx, boat }) {
  if (boat.stationed) return;
  const s = stammState(state);
  if (s.liste.length && random(state) < STAMM.chance) {
    const da = anwesend(state);
    const mods = sim.modifiers(state, ctx);
    const erlaubt = new Set(sim.eligibleTypes(state, ctx, mods).map((t) => t.id));
    const kandidaten = s.liste.filter((g) => !da.has(g.stammId) && erlaubt.has(g.typeId));
    if (kandidaten.length) {
      const g = pick(state, kandidaten);
      const vorher = { ...boat };
      Object.assign(boat, {
        typeId: g.typeId, modelId: g.modelId, name: g.name, size: g.size, kind: g.kind, motor: g.motor,
        length: g.length, beam: g.beam, draft: g.draft, wishes: [...g.wishes],
        bootsname: g.bootsname, heimathafen: g.heimathafen, stammId: g.stammId, besuche: g.besuche + 1,
      });
      if (sim.couldEverFit(state, ctx, boat)) return;
      // Passt nicht mehr (zum Beispiel andere Stufe): normales Boot bleiben
      Object.keys(boat).forEach((k) => { if (!(k in vorher)) delete boat[k]; });
      Object.assign(boat, vorher);
    }
  }
  boat.bootsname = pick(state, BOOTSNAMEN);
  boat.heimathafen = pick(state, heimathaefen(state.region, boat.size));
  boat.besuche = 1;
}

/** Hook 'evening': Wer liegt, wird vorgemerkt, damit die Abreise nachts bekannt ist (sim löscht das Boot vorher). */
export function abendHook({ state, boats }) {
  const s = stammState(state);
  s.abend = {};
  for (const b of boats) {
    if (b.stationed || !b.bootsname) continue;
    s.abend[b.id] = {
      stammId: b.stammId ?? null, bootsname: b.bootsname, heimathafen: b.heimathafen, typeId: b.typeId,
      modelId: b.modelId, name: b.name, size: b.size, kind: b.kind, motor: !!b.motor,
      length: b.length, beam: b.beam, draft: b.draft, wishes: [...b.wishes], besuche: b.besuche ?? 1,
    };
  }
}

/** Hook 'night': Zufriedene Gäste werden Stammgäste oder zählen einen Besuch mehr. */
export function nachtHook({ state, events }) {
  const s = stammState(state);
  for (const e of events) {
    if (e.type !== 'departed') continue;
    const snap = s.abend[e.boatId];
    if (!snap) continue;
    const alt = snap.stammId ? s.liste.find((g) => g.stammId === snap.stammId) : null;
    if (alt) {
      alt.besuche = snap.besuche;
      alt.zuletzt = state.day;
      if (e.rating < STAMM.abBewertung) alt.verstimmt = (alt.verstimmt || 0) + 1;
      if (alt.verstimmt >= 2) s.liste = s.liste.filter((g) => g !== alt);   // zweimal unzufrieden: kommt nicht mehr
      continue;
    }
    if (e.rating < STAMM.abBewertung) continue;
    const neu = { ...snap, stammId: s.naechsteId++, besuche: 1, zuletzt: state.day };
    s.liste.push(neu);
    events.push({ type: 'stammgastNeu', stammId: neu.stammId, bootsname: neu.bootsname });
  }
  s.abend = {};
  if (s.liste.length > STAMM.maxListe) {
    s.liste.sort((a, b) => b.zuletzt - a.zuletzt);
    s.liste.length = STAMM.maxListe;
  }
}

export function haengeEin(addHook) {
  const ab = [addHook('arrival', ankunftHook), addHook('evening', abendHook), addHook('night', nachtHook)];
  return () => ab.forEach((f) => f());
}

/** Kann dieses liegende Boot als Dauerlieger bleiben? */
export function kannBleiben(state, boat) {
  return !!boat && boat.status === 'moored' && !boat.stationed && (boat.besuche ?? 0) >= STAMM.dauerAbBesuch
    && state.stage >= 2;
}

/** Text für Karten und Leiste, zum Beispiel „Möwe aus Kappeln · Stammgast, 3. Besuch“. */
export function beschreibung(boat) {
  if (!boat?.bootsname) return '';
  const name = `„${boat.bootsname}“`;
  const teil = boat.heimathafen ? `${name} aus ${boat.heimathafen}` : name;
  if (boat.dauer) return `${teil} · Dauerlieger`;
  return boat.besuche > 1 ? `${teil} · Stammgast, ${boat.besuche}. Besuch` : teil;
}

export async function init(game) {
  await regelnBereit(game);
  haengeEin(game.sim.addHook);
  game.on('sim:stammgastNeu', (e) => game.emit('stammgast:neu', e));
  game.stammgaeste = { liste: () => stammState(game.sim.state).liste, beschreibung, kannBleiben: (b) => kannBleiben(game.sim.state, b) };
}
