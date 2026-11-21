// Stammgäste: Boote mit Namen am Heck und Heimathafen, die wiederkommen, wenn es ihnen gefallen hat.
// Beschreibung in docs/neue-features.md, Abschnitt 4. Keine Figuren, keine Texte, nur Boote.
//
// - Jedes ankommende Gastboot bekommt einen Namen (boat.bootsname) und einen Heimathafen.
// - Wer bei der Abreise mit 4 oder mehr Ankern bewertet, merkt sich den Hafen (Liste, höchstens 40) und kann
//   wiederkommen. Stammgast ist er erst, wenn er wiederkommt und wieder zufrieden abreist (ab dem 2. Besuch,
//   STAMM.stammAbBesuch). Beim Kürzen der Liste bleiben Stammgäste vor den übrigen, sonst die zuletzt dagewesenen.
// - Ein neues Boot ist mit 15 Prozent Wahrscheinlichkeit ein Stammgast: gleiche Art, gleiches Modell,
//   gleicher Name, gleiche Wünsche wie beim letzten Mal. boat.stammId und boat.besuche (Nummer dieses Besuchs).
// - Ab dem 5. Besuch kann man einen liegenden Stammgast als Dauerlieger behalten (dauerlieger.js).
//
// Spielstand: state.modules.stamm = { naechsteId, liste: [{ stammId, bootsname, heimathafen, typeId, modelId,
//   name, size, kind, motor, length, beam, draft, wishes, besuche, zuletzt }], abend: { bootId: schnappschuss },
//   zuletztNamen: [die zuletzt vergebenen Namen], heute: { tag, namen: [heute vergeben] } }
// Namen sind im Hafen eindeutig (freierName); Stammgäste mit einem gerade vergebenen Namen kommen dann nicht.
//
// Die Logik läuft ohne Browser (tests/stammgaeste.test.mjs).

import * as sim from '../sim.js';
import { regelnBereit } from './regeln-bereit.js';
import { random } from '../random.js';
import { BOOTSNAMEN, heimathaefen } from '../data/bootsnamen.js';
import { ECONOMY } from '../data/economy.js';
import { WUNSCH_TEXTE } from '../data/wuensche-texte.js';

// Zahlen in data/economy.js (ECONOMY.stammgaeste)
export const STAMM = ECONOMY.stammgaeste;

export function stammState(state) {
  state.modules ||= {};
  state.modules.stamm ||= { naechsteId: 1, liste: [], abend: {} };
  return state.modules.stamm;
}

const pick = (state, list) => list[Math.floor(random(state) * list.length)];

// Namen, die gerade im Hafen oder auf dem Weg dorthin sind (ohne das Boot selbst). Dazu die heute
// vergebenen: Die Boote eines Tages werden zusammen gewürfelt und stehen erst danach in state.upcoming.
function namenImHafen(state, ausser) {
  const n = new Set(heuteVergeben(state));
  for (const b of [...Object.values(state.boats || {}), ...(state.upcoming || [])]) {
    if (b && b !== ausser && b.bootsname) n.add(b.bootsname);
  }
  return n;
}

function heuteVergeben(state) {
  const s = stammState(state);
  if (s.heute?.tag !== state.day) s.heute = { tag: state.day, namen: [] };
  return s.heute.namen;
}

const ZUSATZ = ['II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

/**
 * Ein Name, den gerade kein anderes Boot trägt. Vorrang: auch nicht unter den zuletzt vergebenen
 * Namen und nicht der eines Stammgasts; reicht die Liste nicht (Stufe 6), nur nicht im Hafen;
 * sind alle vergeben, mit Zusatz („Möwe II“). wuerfel liefert eine Zahl in [0, 1).
 */
export function freierName(state, wuerfel, ausser = null) {
  const s = stammState(state);
  const belegt = namenImHafen(state, ausser);
  const auch = new Set([...(s.zuletztNamen || []), ...s.liste.map((g) => g.bootsname)]);
  let frei = BOOTSNAMEN.filter((n) => !belegt.has(n) && !auch.has(n));
  if (!frei.length) frei = BOOTSNAMEN.filter((n) => !belegt.has(n));
  if (!frei.length) {
    for (const z of ZUSATZ) {
      frei = BOOTSNAMEN.map((n) => `${n} ${z}`).filter((n) => !belegt.has(n));
      if (frei.length) break;
    }
  }
  const name = frei.length ? frei[Math.floor(wuerfel * frei.length)] : BOOTSNAMEN[Math.floor(wuerfel * BOOTSNAMEN.length)];
  heuteVergeben(state).push(name);
  s.zuletztNamen = [...(s.zuletztNamen || []).filter((n) => n !== name), name].slice(-STAMM.namenGedaechtnis);
  return name;
}

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
  // ohneStamm: gerade wird ein neuer Gast gewürfelt (Freunde eines Stammgasts, features/gaestepost.js).
  // Boote einer Flottille (P32) bekommen nur Namen: Art, Maße und Wünsche gehören der Gruppe.
  if (s.liste.length && !s.ohneStamm && !boat.flotte && random(state) < STAMM.chance) {
    const da = anwesend(state);
    const mods = sim.modifiers(state, ctx);
    const erlaubt = new Set(sim.eligibleTypes(state, ctx, mods).map((t) => t.id));
    const namen = namenImHafen(state, boat);
    const kandidaten = s.liste.filter((g) => !da.has(g.stammId) && erlaubt.has(g.typeId) && !namen.has(g.bootsname));
    if (kandidaten.length && alsStammgast(state, ctx, boat, pick(state, kandidaten))) return;
  }
  boat.bootsname = freierName(state, random(state), boat);
  boat.heimathafen = pick(state, heimathaefen(state.region, boat.size));
  boat.besuche = 1;
}

/**
 * Das gewürfelte Boot wird zum Stammgast g von der Liste: gleiche Art, gleiches Modell, gleicher Name,
 * gleiche Wünsche (P25: dazu Lieblingsplatz, Stammstatus, wächst mit). Passt er nicht mehr in den Hafen
 * (andere Stufe), bleibt das Boot, wie es war. Gibt true zurück, wenn er kommt. Auch für die Gästepost
 * (ui/gaestepost.js: angekündigter Besuch).
 */
export function alsStammgast(state, ctx, boat, g) {
  heuteVergeben(state).push(g.bootsname);
  const vorher = { ...boat };
  const typ = ctx.typeById[g.typeId];
  Object.assign(boat, {
    typeId: g.typeId, modelId: g.modelId, name: g.name, size: g.size, kind: g.kind, motor: g.motor,
    length: g.length, beam: g.beam, draft: g.draft, wishes: [...(g.wishes || [])],
    // Sonderrolle und Tagesbesucher gehören zur Art, nicht zum gewürfelten Boot
    special: !!typ?.special, dayVisitors: typ?.dayVisitors ?? 0,
    bootsname: g.bootsname, heimathafen: g.heimathafen, stammId: g.stammId, besuche: (g.besuche ?? 1) + 1,
  });
  // P25: echter Stammgast (zählt beim Ruf doppelt), Lieblingsplatz, wächst mit
  if (istStamm(g)) boat.stamm = true;
  if (g.lieblingsplatz != null) boat.lieblingsplatz = g.lieblingsplatz;
  if (typ && sim.couldEverFit(state, ctx, boat)) {
    wachsen(state, ctx, boat);
    return true;
  }
  // Passt nicht mehr (zum Beispiel andere Stufe): normales Boot bleiben
  Object.keys(boat).forEach((k) => { if (!(k in vorher)) delete boat[k]; });
  Object.assign(boat, vorher);
  const h = heuteVergeben(state);
  h.splice(h.lastIndexOf(g.bootsname), 1);
  return false;
}

/** Ist dieser Stammgast gerade im Hafen oder heute unterwegs dorthin? */
export function istDa(state, stammId) {
  return anwesend(state).has(stammId);
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
      // Box, in der er liegt (P25: Lieblingsplatz); Päckchen zählen nicht
      platz: b.berthId != null && !sim.isRaftBerth(b.berthId) ? b.berthId : null,
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
      // Boot und Wünsche wie bei diesem Besuch (P25 H8: Stammgäste wachsen mit)
      for (const k of BOOT_FELDER) if (snap[k] !== undefined) alt[k] = Array.isArray(snap[k]) ? [...snap[k]] : snap[k];
      if (e.rating < STAMM.abBewertung) alt.verstimmt = (alt.verstimmt || 0) + 1;
      if (alt.verstimmt >= 2) { s.liste = s.liste.filter((g) => g !== alt); continue; }   // zweimal unzufrieden: kommt nicht mehr
      if (e.rating >= STAMM.abBewertung && snap.platz) alt.lieblingsplatz = snap.platz;   // zufrieden: diese Box merkt er sich
      // Wiedergekommen und zufrieden: jetzt ein echter Stammgast (einmal je Boot)
      if (e.rating >= STAMM.abBewertung && !alt.stamm && alt.besuche >= stammAb()) {
        alt.stamm = true;
        events.push({ type: 'stammgastNeu', stammId: alt.stammId, bootsname: alt.bootsname });
      }
      continue;
    }
    if (e.rating < STAMM.abBewertung) continue;
    const { platz, ...rest } = snap;
    s.liste.push({ ...rest, stammId: s.naechsteId++, besuche: 1, zuletzt: state.day, stamm: false, lieblingsplatz: platz ?? null });
  }
  s.abend = {};
  if (s.liste.length > STAMM.maxListe) {
    s.liste.sort((a, b) => istStamm(b) - istStamm(a) || b.zuletzt - a.zuletzt);
    s.liste.length = STAMM.maxListe;
  }
}

const stammAb = () => STAMM.stammAbBesuch ?? 2;
const BOOT_FELDER = ['typeId', 'modelId', 'name', 'size', 'kind', 'motor', 'length', 'beam', 'draft', 'wishes'];
const GROESSEN = ['S', 'M', 'L', 'XL', 'XXL'];

/**
 * P25 H8: Ein wiederkehrender Stammgast wächst mit. Ab dem Besuch wachsen.abBesuch kommt er mit der
 * Wahrscheinlichkeit wachsen.chance mit dem nächstgrößeren Modell seiner Art (oder der nächsten Größe
 * derselben Bootsart, falls sie in dieser Stufe kommt und in den Hafen passt), sonst mit einem Wunsch mehr.
 * Merkt sich das in boat.gewachsen ({ art: 'boot', vorher } oder { art: 'wunsch', wunsch }).
 */
export function wachsen(state, ctx, boat) {
  const w = STAMM.wachsen;
  if (!w || (boat.besuche ?? 1) < w.abBesuch || random(state) >= w.chance) return null;
  const mods = sim.modifiers(state, ctx);
  const erlaubt = sim.eligibleTypes(state, ctx, mods);
  const typ = ctx.typeById[boat.typeId];
  const modellOk = (t, m) => (m.minStage ?? t.minStage) <= state.stage;
  const probe = (t, m) => ({ ...boat, size: t.size, length: m?.length ?? t.length?.[0], beam: m?.beam ?? t.beam?.[0], draft: m?.draft ?? t.draft?.[0] });
  // 1. größeres Modell derselben Art
  const kandidaten = [];
  if (typ && erlaubt.includes(typ)) {
    for (const m of typ.models || []) if (modellOk(typ, m) && m.length > boat.length + 0.3) kandidaten.push([typ, m]);
  }
  // 2. sonst die nächste Größe derselben Bootsart
  if (!kandidaten.length && typ) {
    const naechste = GROESSEN[GROESSEN.indexOf(typ.size) + 1];
    for (const t of erlaubt) {
      if (t.size !== naechste || t.kind !== typ.kind || t.special) continue;
      for (const m of t.models || []) if (modellOk(t, m)) kandidaten.push([t, m]);
    }
  }
  kandidaten.sort((a, b) => a[1].length - b[1].length);
  for (const [t, m] of kandidaten) {
    const neu = probe(t, m);
    if (!sim.couldEverFit(state, ctx, neu)) continue;
    const vorher = boat.name;
    Object.assign(boat, {
      typeId: t.id, modelId: m.id, name: m.name ?? t.name, size: t.size, kind: t.kind, motor: t.motor,
      length: neu.length, beam: neu.beam, draft: neu.draft, special: !!t.special, dayVisitors: t.dayVisitors ?? 0,
    });
    // Wünsche, die die neue Art nicht haben kann, fallen weg
    const r = ctx.rules;
    boat.wishes = boat.wishes.filter((x) => (t.motor || !(r.motorOnlyWishes || []).includes(x)) && (!r.wishSizes?.[x] || r.wishSizes[x].includes(t.size)));
    boat.gewachsen = { art: 'boot', vorher };
    return boat.gewachsen;
  }
  // 3. sonst ein Wunsch mehr
  if (!typ || typ.noWishes || boat.wishes.length >= (w.maxWuensche ?? 4)) return null;
  const r = ctx.rules;
  const eigene = Array.isArray(typ.wishes) ? typ.wishes : null;
  const pool = [
    ...(r.wishes[state.stage] || []).filter((x) => (typ.motor || !(r.motorOnlyWishes || []).includes(x))
      && (!r.wishSizes?.[x] || r.wishSizes[x].includes(typ.size)) && (!eigene || eigene.includes(x))),
    ...sim.offerWishPool(state, ctx, typ),
  ].filter((x) => !boat.wishes.includes(x));
  if (!pool.length) return null;
  const wunsch = pool[Math.floor(random(state) * pool.length)];
  boat.wishes = [...boat.wishes, wunsch];
  boat.gewachsen = { art: 'wunsch', wunsch };
  return boat.gewachsen;
}

/**
 * Hook 'score' (P25 H6): Der Lieblingsplatz zählt bei der Platzwahl (Büro-Vorschlag, Einfahren lassen)
 * etwas mehr als Komfort und knappe Box, aber weniger als ein erfüllter Platz-Wunsch.
 */
export function platzHook({ boat, berth }) {
  return boat?.lieblingsplatz != null && berth?.id === boat.lieblingsplatz ? STAMM.platzVorliebe ?? 0 : 0;
}

/** Zahl der Treuewimpel (P25 H7): einer je wimpelJe Besuche. */
export function treuewimpel(boat) {
  const je = STAMM.wimpelJe ?? 5;
  return boat?.stammId && !boat.dauer ? Math.floor((boat.besuche ?? 1) / je) : 0;
}

/** Ist der Eintrag ein echter Stammgast (wiedergekommen)? Ältere Spielstände ohne Merker zählen nach Besuchen. */
export function istStamm(g) {
  return !!g && (g.stamm ?? (g.besuche ?? 1) >= stammAb());
}

/** Zahl der echten Stammgäste (Erfolge, Statistik). */
export function stammZahl(state) {
  const l = state?.modules?.stamm?.liste;
  return Array.isArray(l) ? l.filter(istStamm).length : 0;
}

export function haengeEin(addHook) {
  const ab = [addHook('arrival', ankunftHook), addHook('evening', abendHook), addHook('night', nachtHook), addHook('score', platzHook)];
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
  if (!(boat.besuche > 1)) return teil;
  // Stammgast erst nach dem zweiten zufriedenen Besuch (PR 361); davor nur „kommt wieder“
  return boat.stamm ? `${teil} · Stammgast, ${boat.besuche}. Besuch` : `${teil} · kommt wieder, ${boat.besuche}. Besuch`;
}

/**
 * Zeilen für die Bootskarte (P25): Lieblingsplatz und was beim Stammgast neu ist.
 * [{ art: 'platz'|'gewachsen', text }]; leer bei normalen Gästen.
 */
export function hinweise(state, ctx, boat) {
  const out = [];
  if (boat?.freundVon) out.push({ art: 'post', text: `Freunde der „${boat.freundVon.bootsname}“, die von deinem Hafen erzählt hat` });
  if (!boat?.stammId) return out;
  const id = boat.lieblingsplatz;
  const berth = id != null ? ctx.berthById[id] : null;
  if (berth && sim.berthAvailable(state, berth) && sim.fits(boat, berth, ctx.rules, state.stage)) {
    const liegt = boat.status === 'moored' && boat.berthId === id;
    const frei = sim.isFree(state, id) && !sim.hookWhyNotFit(state, ctx, boat, berth);
    const bonus = String(ctx.rules.regular?.favouriteBonus ?? 0).replace('.', ',');
    out.push({
      art: 'platz', platz: id, frei: liegt || frei,
      text: liegt ? `Liegt an seinem Lieblingsplatz, Box ${id} (+${bonus} Anker)`
        : frei ? `Lieblingsplatz: Box ${id} ist frei (+${bonus} Anker)` : `Lieblingsplatz: Box ${id} ist belegt`,
    });
  }
  if (boat.angekuendigt) out.push({ art: 'post', text: 'Hat sich mit einer Karte angekündigt' });
  const g = boat.gewachsen;
  if (g?.art === 'boot') out.push({ art: 'gewachsen', text: `Kommt diesmal mit größerem Boot (vorher ${g.vorher})` });
  else if (g?.art === 'wunsch') out.push({ art: 'gewachsen', text: `Wünscht sich diesmal auch ${WUNSCH_TEXTE[g.wunsch]?.mit ?? g.wunsch}` });
  return out;
}


/**
 * Gäste ohne Namen nachtragen: Boote, die vor dem Einhängen der Hooks gewürfelt wurden (erster Tag
 * nach dem Laden, Testmodus ?stufe=n) oder aus älteren Spielständen stammen. Fester Zufall aus der
 * Boots-id, damit der Würfel der Spielregeln unberührt bleibt. Gibt die Zahl der benannten Boote zurück.
 */
export function namenNachtragen(state) {
  let n = 0;
  const wahl = (list, id, salz) => {
    let h = 2166136261 ^ salz;
    for (const c of String(id)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    return list[Math.abs(h) % list.length];
  };
  for (const b of [...Object.values(state.boats || {}), ...(state.upcoming || [])]) {
    if (!b || b.stationed || b.bootsname) continue;
    const h = BOOTSNAMEN.indexOf(wahl(BOOTSNAMEN, b.id, 1));
    b.bootsname = freierName(state, h / BOOTSNAMEN.length, b);
    b.heimathafen = wahl(heimathaefen(state.region, b.size), b.id, 2);
    b.besuche ??= 1;
    n++;
  }
  return n;
}

export async function init(game) {
  await regelnBereit(game);
  haengeEin(game.sim.addHook);
  namenNachtragen(game.sim.state);
  game.on('sim:change', (d) => { if ((d?.reason === 'load' || d?.reason === 'new') && game.sim.state) namenNachtragen(game.sim.state); });
  game.on('sim:stammgastNeu', (e) => game.emit('stammgast:neu', e));
  game.stammgaeste = {
    liste: () => stammState(game.sim.state).liste, beschreibung, kannBleiben: (b) => kannBleiben(game.sim.state, b),
    hinweise: (b) => hinweise(game.sim.state, game.sim.ctx, b), treuewimpel,
  };
}
