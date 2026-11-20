// Bootsgeschichten, reine Regeln ohne DOM (docs/bootsgeschichten.md, Abschnitt 4).
// Jedes neue Boot bekommt im Hook 'arrival' einen Anlass aus data/geschichten.js; der Anlass bestimmt
// Ankunftsfenster, bei Kurzhaltern die Liegezeit, manchmal einen sicheren Wunsch und den Tagestörn.
// Nach dem Verteilen der Ankunftszeiten (Hook 'arrivals') tauscht das Modul Zeiten, damit dieselbe
// Geschichte an einem Tag nicht zweimal im selben Tagesabschnitt vorkommt.
//
// Zufall nur über den Spielzufall (random.js). Stand unter state.modules.geschichten:
//   { tage: { id: letzterTag }, heute: { tag, zahl: { id: n } }, kombis: [schlüssel], gesehen: { id: tag } }
//
// installiere(ctx, sim, { umfeld }) hängt beide Hooks ein. umfeld() liefert { ereignis, wetter: [...] }
// (ohne Ereignismodul: {}). Gebaute Angebote und Bauwerke liest das Modul selbst aus dem Spielstand.
import { GESCHICHTEN, HAEFEN, CREW, ERSATZ } from '../data/geschichten.js';
import { random } from '../random.js';

export const BY_ID = Object.fromEntries(GESCHICHTEN.map((g) => [g.id, g]));

/** Stand des Moduls im Spielstand (legt ihn bei Bedarf an). */
export function stand(state) {
  state.modules ||= {};
  const s = (state.modules.geschichten ||= {});
  s.tage ||= {};
  s.kombis ||= [];
  s.gesehen ||= {};
  if (!s.heute || s.heute.tag !== state.day) s.heute = { tag: state.day, zahl: {} };
  return s;
}

/** Tagesabschnitt (0 früh bis 4 abends) zu einem Tagesanteil. */
export function abschnitt(anteil, grenzen = [0.2, 0.44, 0.6, 0.92]) {
  let i = 0;
  while (i < grenzen.length && anteil >= grenzen[i]) i++;
  return i;
}

/** Wetter eines Tages (Objekt aus events/scheduler.js weather()) als Schlagworte. */
export function wetterWorte(w) {
  if (!w) return [];
  const out = [];
  if ((w.rain ?? 0) >= 0.3) out.push('regen');
  if ((w.wind ?? 0) >= 0.8) out.push('sturm');
  if ((w.fog ?? 0) >= 0.5) out.push('nebel');
  if ((w.sun ?? 0) >= 0.75 && !(w.rain > 0)) out.push('sonne');
  return out;
}

/** Ist das, was die Geschichte braucht, im Hafen gebaut? */
export function gebaut(state, mods, braucht) {
  if (!braucht) return true;
  if (braucht.service) return !!mods?.offers?.[braucht.service];
  if (braucht.bauwerk) return (state.facilities?.[braucht.bauwerk] || 0) > 0;
  return true;
}

const ART_NACH_NAECHTEN = (n) => (n === 0 ? 'kurz' : n === 1 ? 'nacht' : 'mehr');

/** Passt die Geschichte zu Boot, Stufe, Wetter und Hafen? (ohne Gewicht) */
export function passt(g, { state, ctx, boat, mods, umfeld = {} }) {
  if (g.abStufe > state.stage) return false;
  if (g.groessen && !g.groessen.includes(boat.size)) return false;
  if (g.arten && !g.arten.includes(boat.kind)) return false;
  if (g.segel && boat.motor) return false;
  if (g.motor && !boat.motor) return false;
  if (!gebaut(state, mods, g.braucht)) return false;
  const wetter = umfeld.wetter || [];
  if (g.wetter && !wetter.includes(g.wetter)) return false;
  if (g.ereignis && g.ereignis !== umfeld.ereignis) return false;
  if (g.vorabend && g.vorabend !== umfeld.morgen) return false;
  // Mit 'besonders' gewählte Nächte prüft waehle(); sonst muss die Art zur Aufenthaltsdauer passen
  if (g.art !== 'besonders' && g.art !== ART_NACH_NAECHTEN(boat.nights)) return false;
  // Ein Wunsch, den die Geschichte sicher hat, muss in dieser Stufe möglich sein
  if (g.wunsch && !wunschMoeglich(state, ctx, boat, g.wunsch)) return false;
  // Am See (Stufe 1 und 2) keine Geschichten, die ein Meer brauchen (Regeln über abStufe)
  void ctx;
  return true;
}

function wunschMoeglich(state, ctx, boat, w) {
  const r = ctx.rules;
  if (r.offerWishes?.[w]) {
    const o = r.offerWishes[w];
    return o.minStage <= state.stage && (!o.sizes || o.sizes.includes(boat.size)) && (!o.sailOnly || !boat.motor);
  }
  if (!(r.wishes?.[state.stage] || []).includes(w)) return false;
  if (r.motorOnlyWishes?.includes(w) && !boat.motor) return false;
  if (r.wishSizes?.[w] && !r.wishSizes[w].includes(boat.size)) return false;
  return true;
}

function zahl(state, a, b) {
  return a + random(state) * (b - a);
}

function ziehe(state, liste) {
  return liste[Math.floor(random(state) * liste.length)];
}

/** Gewichtete Wahl aus [{ g, w }]. */
function gewichtet(state, eintraege) {
  const summe = eintraege.reduce((a, e) => a + e.w, 0);
  if (!(summe > 0)) return null;
  let r = random(state) * summe;
  for (const e of eintraege) { r -= e.w; if (r <= 0) return e.g; }
  return eintraege.at(-1).g;
}

/** Ziele je nach Stufe und Region. */
export function haefen(state) {
  if (state.stage <= 2) return HAEFEN.see;
  return HAEFEN[state.region] ?? HAEFEN.ostsee;
}

/**
 * Wählt eine Geschichte für ein neues Boot und setzt die Felder am Boot:
 * boat.story = { id, nach, crew, detail }, boat.arrivalWish, bei Kurzhalt boat.stay,
 * bei besonderen Tagen boat.nights, sicherer Wunsch in boat.wishes, boat.tripPlan.
 * @returns {string|null} id der Geschichte
 */
export function waehle({ state, ctx, boat, mods, umfeld = {}, nurText = false }) {
  const zahlen = ctx.rules.stories;
  if (!zahlen || !boat || boat.stationed || boat.special || boat.size === 'XXL') return null;
  const st = stand(state);
  const info = { state, ctx, boat, mods, umfeld };
  const gewicht = (g) => {
    let w = zahlen.anlaesse?.[g.id]?.g ?? 1;
    const n = st.heute.zahl[g.id] || 0;
    if (n) w *= (zahlen.heuteSchon ?? 0.15) ** n;
    const zuletzt = st.tage[g.id];
    if (zuletzt != null && state.day - zuletzt < (zahlen.wiederholTage ?? 3) && zuletzt !== state.day) w *= zahlen.neulich ?? 0.35;
    return w;
  };
  let g = null;
  // Besondere Tage: ein Teil der Boote kommt wegen des Ereignisses oder des Wetters
  // nurText: Boot ist schon da (Nachtrag), Aufenthalt und Wünsche bleiben, nur Alltagsgeschichten
  const besondere = nurText ? [] : GESCHICHTEN.filter((x) => x.art === 'besonders' && passt(x, info));
  if (besondere.length) {
    // Je öfter die Anlässe des Tages schon vorkamen, desto seltener kommt noch einer (sonst hätte an
    // einem Regentag fast jedes zweite Boot denselben Satz)
    const frisch = besondere.reduce((a, x) => a + (zahlen.anlaesse?.[x.id]?.g ?? 1), 0);
    const jetzt = besondere.reduce((a, x) => a + gewicht(x), 0);
    if (random(state) < (zahlen.besonders ?? 0.4) * Math.min(1, jetzt / (frisch || 1))) {
      g = gewichtet(state, besondere.map((x) => ({ g: x, w: gewicht(x) })));
    }
  }
  if (!g) {
    const alltag = GESCHICHTEN.filter((x) => x.art !== 'besonders' && passt(x, info));
    g = gewichtet(state, alltag.map((x) => ({ g: x, w: gewicht(x) }))) ?? BY_ID[ERSATZ[ART_NACH_NAECHTEN(boat.nights)]];
  }
  if (!g) return null;
  const z = zahlen.anlaesse?.[g.id] || {};
  if (nurText) return merke(state, st, zahlen, g, boat);
  // Nächte an besonderen Tagen
  if (g.art === 'besonders' && z.naechte) {
    const n = Math.round(zahl(state, z.naechte[0], z.naechte[1]));
    if (n === 0 && !(ctx.rules.shortStay?.sizes || ['S', 'M', 'L']).includes(boat.size)) {
      // Große Schiffe bleiben mindestens eine Nacht
    } else boat.nights = n;
  }
  if (boat.nights === 0) {
    const b = z.bleibt ?? ctx.rules.shortStay?.stay ?? [0.12, 0.3];
    boat.stay = Math.round(zahl(state, b[0], b[1]) * 1000) / 1000;
  } else delete boat.stay;
  if (z.kommt) boat.arrivalWish = [...z.kommt];
  // Regattaboote fahren nur an Regattatagen hinaus (Hook 'night' setzt den Plan je Tag), die übrigen jeden Tag
  if (z.toern && !g.regatta) boat.tripPlan = { chance: z.toern.anteil, out: z.toern.raus, back: z.toern.zurueck };
  if (g.wunsch && !boat.wishes.includes(g.wunsch) && wunschMoeglich(state, ctx, boat, g.wunsch)) boat.wishes = [...boat.wishes, g.wunsch];
  return merke(state, st, zahlen, g, boat);
}

/** Varianten würfeln (Ziel, Crew, Detail) und merken. Dieselbe Kombination kommt nie zweimal (merkliste). */
function merke(state, st, zahlen, g, boat) {
  const h = haefen(state);
  const crews = CREW.filter((c) => c.groessen.includes(boat.size));
  let story = null;
  for (let versuch = 0; versuch < 12; versuch++) {
    const s = {
      id: g.id,
      nach: ziehe(state, h.nach),
      crew: crews.length ? ziehe(state, crews).id : null,
      detail: g.details ? Math.floor(random(state) * g.details.length) : null,
    };
    story = s;
    if (!st.kombis.includes(kombiSchluessel(s))) break;
  }
  st.kombis.push(kombiSchluessel(story));
  const max = zahlen.merkliste ?? 400;
  if (st.kombis.length > max) st.kombis.splice(0, st.kombis.length - max);
  st.heute.zahl[g.id] = (st.heute.zahl[g.id] || 0) + 1;
  st.tage[g.id] = state.day;
  boat.story = story;
  return g.id;
}

/**
 * Boote, die schon unterwegs, an der Boje oder im Hafen sind, aber noch keine Geschichte haben (Start
 * eines Spiels vor dem Einhängen, alte Spielstände): Boote, die heute noch kommen, bekommen eine
 * vollständige Geschichte, alle anderen nur eine passende Zeile, ohne Aufenthalt oder Wünsche zu ändern.
 */
export function nachtragen({ state, ctx, mods, umfeld = {} }) {
  let n = 0;
  for (const b of state.upcoming || []) if (!b.story && waehle({ state, ctx, boat: b, mods, umfeld })) n++;
  for (const b of Object.values(state.boats || {})) if (b && !b.story && waehle({ state, ctx, boat: b, mods, umfeld, nurText: true })) n++;
  return n;
}

/** Kurzer Schlüssel einer Kombination für die Merkliste. */
export function kombiSchluessel(s) {
  return `${s.id}|${s.nach}|${s.crew}|${s.detail ?? ''}`;
}

/**
 * Nach dem Verteilen der Ankunftszeiten: Kommt dieselbe Geschichte zweimal im selben Tagesabschnitt,
 * tauscht das zweite Boot seine Zeit mit dem nächsten Boot einer anderen Geschichte aus einem anderen
 * Abschnitt, in dem die Geschichte noch nicht vorkommt. Die Zeiten selbst bleiben dieselben (keine
 * Wellen, kein Fließband), nur die Reihenfolge der Boote ändert sich.
 */
export function zeitenEntzerren({ state, ctx, list }) {
  const grenzen = ctx.rules.stories?.abschnitte;
  if (!grenzen || list.length < 3) return 0;
  const tag = ctx.rules.dayLength || 1;
  const abs = (b) => abschnitt(b.arriveAt / tag, grenzen);
  const erster = state.day === 1 && ctx.rules.firstArrivalAt != null ? list[0] : null;
  // Kurzhalter nicht hinter die Zeit legen, ab der sie nicht mehr einfahren (wie lateShortStays in sim.js)
  const sh = ctx.rules.shortStay;
  const spaet = sh ? tag * (sh.latest ?? 0.97) - (sh.stay?.[0] ?? 0.1) * tag : Infinity;
  const kurz = (b) => !!b && !b.stationed && b.nights === 0;
  let getauscht = 0;
  for (let runde = 0; runde < 3; runde++) {
    let geaendert = false;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (!b.story || b === erster) continue;
      const a = abs(b);
      const doppelt = list.some((x, j) => j < i && x.story?.id === b.story.id && abs(x) === a);
      if (!doppelt) continue;
      // nächster Tauschpartner: andere Geschichte, anderer Abschnitt, dort keine gleiche Geschichte
      let best = -1, bestD = Infinity;
      for (let j = 0; j < list.length; j++) {
        const x = list[j];
        if (j === i || x === erster || x.story?.id === b.story.id) continue;
        if ((kurz(b) && x.arriveAt > spaet) || (kurz(x) && b.arriveAt > spaet)) continue;
        const ax = abs(x);
        if (ax === a) continue;
        if (list.some((y) => y !== b && y.story?.id === b.story.id && abs(y) === ax)) continue;
        // der Partner darf in b's Abschnitt nicht selbst doppelt werden
        if (x.story && list.some((y) => y !== x && y.story?.id === x.story.id && abs(y) === a)) continue;
        const d = Math.abs(x.arriveAt - b.arriveAt);
        if (d < bestD) { bestD = d; best = j; }
      }
      if (best < 0) continue;
      const x = list[best];
      [b.arriveAt, x.arriveAt] = [x.arriveAt, b.arriveAt];
      getauscht++;
      geaendert = true;
    }
    list.sort((p, q) => p.arriveAt - q.arriveAt);
    if (!geaendert) break;
  }
  return getauscht;
}

/** Text für die Bootskarte: "Nur kurz aufs WC, dann weiter nach Schleimünde. Zu zweit an Bord." */
export function text(boat) {
  const s = boat?.story;
  const g = s ? BY_ID[s.id] : null;
  if (!g) return null;
  const crew = CREW.find((c) => c.id === s.crew);
  const satzNr = Math.abs(hashText(`${boat.id}|${s.nach}`)) % g.texte.length;
  const detail = g.details && s.detail != null ? g.details[s.detail] : '';
  const satz = g.texte[satzNr].replaceAll('{nach}', s.nach).replaceAll('{detail}', detail);
  return crew ? `${satz} ${crew.text}` : satz;
}

function hashText(t) {
  let h = 0;
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0;
  return h;
}

/**
 * Hängt die Regeln an einen Kontext der Spielregeln. sim: das Modul web/js/sim.js (für modifiers),
 * umfeld: () => ({ ereignis, wetter }) für Ereignistage und Wetter.
 */
export function installiere(ctx, sim, { umfeld = () => ({}) } = {}) {
  // umfeld(state, tag) -> { ereignis, wetter }; dazu morgen = Ereignis des nächsten Tages
  const lies = (state, tag = state.day) => {
    try {
      const u = umfeld(state, tag) || {};
      const m = umfeld(state, tag + 1) || {};
      return { ...u, morgen: m.ereignis ?? null };
    } catch { return {}; }
  };
  const ab1 = sim.addHook(ctx, 'arrival', ({ state, ctx: c, boat }) => {
    if (!boat) return;
    waehle({ state, ctx: c, boat, mods: sim.modifiers(state, c), umfeld: lies(state) });
  });
  const ab2 = sim.addHook(ctx, 'arrivals', zeitenEntzerren);
  // Nachts: Regattaboote bekommen für einen Regattatag morgen ihren Ausflug zur Bahn
  const ab3 = sim.addHook(ctx, 'night', ({ state, ctx: c }) => regattaPlanen(state, c, lies(state).morgen));
  return () => { ab1(); ab2(); ab3(); };
}

/**
 * Regattaboote (Geschichte mit regatta: true) fahren am Regattatag morgens zur Bahn und kommen am
 * Nachmittag zurück (boat.tripPlan mit regatta: true). An anderen Tagen bleiben sie im Hafen.
 * morgen: Ereignis des nächsten Tages. @returns {number} Zahl der Boote, die morgen starten
 */
export function regattaPlanen(state, ctx, morgen) {
  let n = 0;
  for (const b of Object.values(state.boats || {})) {
    if (!b || b.status !== 'moored' || !BY_ID[b.story?.id]?.regatta) continue;
    // b.nights ist in dieser Nacht schon heruntergezählt: 0 = reist ab, 1 = bleibt noch eine Nacht
    const z = ctx.rules.stories?.anlaesse?.[b.story.id]?.toern;
    if (morgen === 'regatta' && z && (b.nights ?? 0) >= 1) {
      b.tripPlan = { chance: 1, out: z.raus, back: z.zurueck, regatta: true, minNights: 1 };
      n++;
    } else if (b.tripPlan?.regatta) delete b.tripPlan;
  }
  return n;
}

/** Erstmals gesehen (beim Anlegen): trägt die Geschichte ins Logbuch ein. @returns {boolean} neu */
export function gesehen(state, boat) {
  const id = boat?.story?.id;
  if (!id) return false;
  const st = stand(state);
  if (st.gesehen[id]) return false;
  st.gesehen[id] = state.day;
  return true;
}
