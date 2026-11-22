// Seltene Besucher, Regeln ohne Browser (Paket P40, Roadmap F16, docs/besucher.md).
//
// Schiffe: An manchen Tagen ab Stufe 2 wird morgens eines der erwarteten Boote zu einem besonderen
// Schiff (Weltumsegler, Museumsdampfer, Forschungskutter, Königsyacht). Es meldet sich per Funk an
// (boat.funk, Box freihalten geht wie bei P28), läuft wie jedes Boot von See ein und wünscht sich einen
// Ehrenplatz: längsseits am Stegkopf (Stirnplatz) oder am Kai. Der Ehrenplatz ist ein Platz-Wunsch der
// Spielregeln (rules.berthWishes.ehrenplatz), darum leuchten diese Plätze beim Zuweisen gold, das Büro
// und das Selbst-Einfahren nehmen sie zuerst, und die Bewertung zählt ihn wie jeden Wunsch. Liegt das
// Schiff am Ehrenplatz, kommen abends Schaulustige und kaufen ein (Geld, Quelle sonstiges).
// Tiere: Schwanenfamilie (ab Stufe 1) und Schweinswal (ab Stufe 3) schwimmen an manchen Tagen eine Weile
// durchs Bild. Sie ändern nichts an den Regeln; das Bild (render/besucher-tiere.js) zeigt sie.
// Alle sechs sind Fotomotive für das Logbuch (features/besucher.js, Fotomodus).
//
// Zufall aus Seed und Tag (kein Spielzufall): Zeitraffer und Rechnung bleiben gleich.
// Spielstand state.modules.besucher = {
//   letzter: Tag des letzten Schiffs, heute: { tag, art, boatId, name, phase, platz?, ehrenplatz? } | null,
//   gesehen: { [art]: { tag, stufe, mal, ehrenplatz? } }, fotos: { [art]: { tag, bild? } },
//   tiere: { tag, liste: [{ art, at, dauer }] }, neu: [art] (im Logbuch noch nicht angesehen) }
// Phasen eines Schiffs: 'angemeldet' (kommt heute), 'wartet' (an der Boje), 'fest', 'abgereist', 'verpasst'.

import * as sim from '../sim.js';
import { ECONOMY } from '../data/economy.js';
import { MODELL_VON } from '../data/boats/besucher.js';
import { SCHIFF_TEXTE, TIER_TEXTE, MOTIVE, istTier } from '../data/besucher.js';

export const BES = ECONOMY.besucher;
export const EHRENPLATZ = 'ehrenplatz';
export const PLATZ_EIGENSCHAFT = 'ehrenplatz';
const istObjekt = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export function besState(state) {
  state.modules ||= {};
  let s = state.modules.besucher;
  if (!istObjekt(s)) s = state.modules.besucher = {};
  if (!istObjekt(s.gesehen)) s.gesehen = {};
  if (!istObjekt(s.fotos)) s.fotos = {};
  if (!istObjekt(s.tiere) || !Array.isArray(s.tiere.liste)) s.tiere = { tag: null, liste: [] };
  if (!Array.isArray(s.neu)) s.neu = [];
  if (s.heute !== null && !istObjekt(s.heute)) s.heute = null;
  s.heute ??= null;
  s.letzter ??= null;
  return s;
}

/** Unsinn aus einem geladenen Spielstand entfernen (fremde Arten, kaputte Einträge, zu große Bilder). */
export function saeubern(state) {
  const s = besState(state);
  for (const k of Object.keys(s.gesehen)) {
    const e = s.gesehen[k];
    if (!MOTIVE.includes(k) || !istObjekt(e)) { delete s.gesehen[k]; continue; }
    s.gesehen[k] = { tag: Number.isInteger(e.tag) ? e.tag : null, stufe: Number.isInteger(e.stufe) ? e.stufe : null, mal: Number.isInteger(e.mal) && e.mal > 0 ? e.mal : 1, ...(e.ehrenplatz ? { ehrenplatz: true } : {}) };
  }
  for (const k of Object.keys(s.fotos)) {
    const f = s.fotos[k];
    if (!MOTIVE.includes(k) || !istObjekt(f)) { delete s.fotos[k]; continue; }
    const bild = typeof f.bild === 'string' && f.bild.startsWith('data:image/') && f.bild.length < 60000 ? f.bild : null;
    s.fotos[k] = { tag: Number.isInteger(f.tag) ? f.tag : null, ...(bild ? { bild } : {}) };
  }
  s.neu = [...new Set(s.neu.filter((a) => MOTIVE.includes(a)))];
  s.tiere.liste = s.tiere.liste.filter((t) => istObjekt(t) && TIER_TEXTE[t.art] && Number.isFinite(t.at) && Number.isFinite(t.dauer));
  if (s.heute && (!SCHIFF_TEXTE[s.heute.art] || !Number.isInteger(s.heute.tag))) s.heute = null;
  return s;
}

// Fester Zufall aus Seed, Tag und Salz (mulberry32), verbraucht den Spielzufall nicht
export function zufall(seed, tag, salz = 40) {
  let a = ((seed >>> 0) ^ Math.imul(tag + 1, 0x9e3779b1) ^ Math.imul(salz + 13, 0x85ebca6b)) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ist dieser Platz ein Ehrenplatz? Längsseits am Stegkopf (Stirnplatz) oder am Kai. */
export function istEhrenplatz(berth) {
  return !!berth && (berth.kind === 'stirn' || berth.kind === 'kai');
}

/** Hook 'berthHas': Ehrenplätze haben die Eigenschaft 'ehrenplatz' (erfüllt den Wunsch). */
export function berthHasHook({ berth, prop }) {
  return prop === PLATZ_EIGENSCHAFT && istEhrenplatz(berth);
}

/** Boot eines Besuchers mit den Maßen seines Modells (ohne id, ohne Wünsche). */
function bootDaten(ctx, art) {
  const m = MODELL_VON[art];
  const typ = m ? ctx.typeById[m.typeId] : null;
  if (!m || !typ) return null;
  return {
    typeId: typ.id, modelId: m.id, name: m.name, size: typ.size, kind: typ.kind ?? 'besucher',
    length: m.length, beam: m.beam, draft: m.draft, motor: true, special: false, stationed: false,
  };
}

/** Schiffe, die heute kommen können: Stufe erreicht und mindestens ein Platz im Hafen passt (frei oder belegt). */
export function moeglicheSchiffe(state, ctx) {
  return Object.entries(BES.schiffe)
    .filter(([art, d]) => d.abStufe <= state.stage && SCHIFF_TEXTE[art])
    .filter(([art]) => {
      const b = bootDaten(ctx, art);
      return b && sim.couldEverFit(state, ctx, b);
    })
    .map(([art]) => art);
}

/** Gibt es in dieser Stufe einen Ehrenplatz, an den das Schiff passt? */
export function ehrenplatzMoeglich(state, ctx, art) {
  const b = bootDaten(ctx, art);
  return !!b && sim.availableBerths(state, ctx).some((p) => istEhrenplatz(p) && sim.fits(b, p, ctx.rules, state.stage));
}

/** Wünsche eines Schiffs in dieser Stufe: der Ehrenplatz immer, die anderen nur, wenn die Stufe sie kennt. */
export function wuenscheFuer(state, ctx, art) {
  const d = BES.schiffe[art];
  const typ = ctx.typeById[MODELL_VON[art]?.typeId];
  const r = ctx.rules;
  const stufe = new Set(r.wishes?.[state.stage] || []);
  return (d?.wuensche || []).filter((w) => w === EHRENPLATZ || (stufe.has(w)
    && (!r.wishSizes?.[w] || r.wishSizes[w].includes(typ?.size))
    && (!(r.wishMinNights?.[w] > 0) || d.naechte >= r.wishMinNights[w])));
}

/**
 * Verwandelt ein erwartetes Boot in das Schiff art. Gibt false zurück (und lässt das Boot, wie es war),
 * wenn das Schiff nicht in den Hafen passt. r: eigener Zufall für Name und Heimathafen.
 */
export function verwandle(state, ctx, boat, art, r) {
  const daten = bootDaten(ctx, art);
  const d = BES.schiffe[art];
  const t = SCHIFF_TEXTE[art];
  if (!daten || !d || !t || !sim.couldEverFit(state, ctx, daten)) return false;
  // Was andere Module dem Boot mitgegeben haben (Geschichte, Kurzhalt, Stammgast, Tagestörn), gehört zum alten Boot
  for (const k of ['story', 'stay', 'arrivalWish', 'tripPlan', 'stammId', 'stamm', 'lieblingsplatz', 'selten', 'gewachsen', 'paeckchen', 'dienste']) delete boat[k];
  const namen = t.namen;
  Object.assign(boat, daten, {
    wishes: wuenscheFuer(state, ctx, art),
    nights: d.naechte,
    dayVisitors: d.tagesgaeste || 0,
    bootsname: namen[Math.floor(r() * namen.length)],
    heimathafen: t.heimat.length ? t.heimat[Math.floor(r() * t.heimat.length)] : null,
    besuche: 1,
    besucher: art,
    // Meldet sich per Funk an: Box freihalten wie bei jeder Anmeldung (P28), auch ohne Funkgerät im Büro
    funk: { platz: null },
  });
  return true;
}

/** Welches Schiff kommt? Noch nie gesehene öfter (BES.neuGewicht). */
function waehleArt(s, arten, r) {
  const gew = arten.map((a) => (BES.schiffe[a].gewicht ?? 1) * (s.gesehen[a] ? 1 : BES.neuGewicht));
  const summe = gew.reduce((x, y) => x + y, 0);
  let x = r() * summe;
  for (let i = 0; i < arten.length; i++) { x -= gew[i]; if (x <= 0) return arten[i]; }
  return arten[arten.length - 1];
}

/** Welches erwartete Boot wird zum Schiff? Eines im Ankunftsfenster (BES.ankunft), keine Flottille, kein Stammgast. */
function waehleBoot(state, ctx, list, r) {
  const L = ctx.rules.dayLength;
  const ok = list.filter((b) => !b.stationed && !b.flotte && !b.stammId && !b.funk && !b.besucher && !b.selten && !b.havarie && !b.freundVon);
  if (!ok.length) return null;
  const [von, bis] = BES.ankunft;
  const im = ok.filter((b) => b.arriveAt >= von * L && b.arriveAt <= bis * L);
  if (im.length) return im[Math.floor(r() * im.length)];
  // Sonst das Boot, das der Mitte des Fensters am nächsten kommt
  const mitte = ((von + bis) / 2) * L;
  return [...ok].sort((a, b) => Math.abs(a.arriveAt - mitte) - Math.abs(b.arriveAt - mitte))[0];
}

/** Liegt gerade ein Besucher im Hafen oder ist heute einer unterwegs? */
export function besucherDa(state) {
  for (const b of Object.values(state.boats || {})) if (b?.besucher) return b;
  for (const b of state.upcoming || []) if (b?.besucher) return b;
  return null;
}

/**
 * Morgens (Hook 'arrivals'): Kommt heute ein Schiff? Nie am ersten Tag, nie im Winter, ab der Stufe des
 * Schiffs, BES.pause Tage Abstand, nie zwei zugleich. erzwingen: { art } für Tests und ?besucher=...
 */
export function planen(state, ctx, list, { erzwingen = null } = {}) {
  const s = besState(state);
  aufraeumen(state, ctx, s);
  if (s.heute?.tag === state.day && !erzwingen) return null;
  if (!erzwingen) {
    if (state.day <= 1 || sim.season(state, ctx).winter) return null;
    if (s.letzter != null && state.day - s.letzter < BES.pause) return null;
    if (besucherDa(state)) return null;
  }
  const r = zufall(state.seed ?? 1, state.day, erzwingen ? 41 + Object.keys(s.gesehen).length : 40);
  if (!erzwingen && r() >= (BES.anteil[state.stage] ?? 0)) return null;
  let arten = moeglicheSchiffe(state, ctx);
  if (erzwingen?.art) arten = arten.includes(erzwingen.art) ? [erzwingen.art] : [];
  if (!arten.length) return null;
  const boot = waehleBoot(state, ctx, list, r);
  if (!boot) return null;
  // Erst die gewählte Art, dann die anderen (passt eine nicht, zum Beispiel zu tief)
  const erste = waehleArt(s, arten, r);
  for (const art of [erste, ...arten.filter((a) => a !== erste)]) {
    if (!verwandle(state, ctx, boot, art, r)) continue;
    s.heute = { tag: state.day, art, boatId: boot.id, name: boot.bootsname, phase: 'angemeldet', at: boot.arriveAt };
    s.letzter = state.day;
    return s.heute;
  }
  return null;
}

/**
 * Neuer Tag: Liegt das Schiff von gestern noch, bleibt der Eintrag (mehrere Nächte), sonst ist er erledigt.
 * Schaut auf das Boot selbst, nicht auf die Ereignisse: ohne Oberfläche (Zeitraffer) wertet keiner sie aus.
 */
function aufraeumen(state, ctx, s) {
  const h = s.heute;
  if (!h || h.tag === state.day) return;
  const b = state.boats[h.boatId];
  if (b?.besucher && b.status === 'moored') {
    if (h.phase !== 'fest') Object.assign(h, { phase: 'fest', platz: b.berthId, ehrenplatz: istEhrenplatz(ctx.berthById[b.berthId]) });
    return;
  }
  s.heute = null;
}

/** Tiere des Tages (gleicher Hook): höchstens eines je Art, zu einer festen Uhrzeit, für eine Weile. */
export function tierePlanen(state, ctx, { erzwingen = null } = {}) {
  const s = besState(state);
  if (s.tiere.tag === state.day && !erzwingen) return s.tiere.liste;
  s.tiere = { tag: state.day, liste: erzwingen ? s.tiere.liste.filter((t) => s.tiere.tag === state.day && t.art !== erzwingen) : [] };
  const sea = sim.season(state, ctx);
  const L = ctx.rules.dayLength;
  for (const [art, d] of Object.entries(BES.tiere)) {
    if (erzwingen && art !== erzwingen) continue;
    const r = zufall(state.seed ?? 1, state.day, art === 'schwaene' ? 51 : 52);
    const kommt = erzwingen === art || (!sea.winter && d.abStufe <= state.stage && state.day > 1
      && sea.day >= d.saison[0] && sea.day <= d.saison[1] && r() < d.anteil);
    if (!kommt) continue;
    const at = erzwingen === art ? (state.clock || 0) + 2 : Math.round(L * (d.zeit[0] + r() * (d.zeit[1] - d.zeit[0])));
    s.tiere.liste.push({ art, at, dauer: d.dauer, seed: Math.floor(r() * 1e6) });
  }
  return s.tiere.liste;
}

/** Hook 'arrivals': Schiff und Tiere des Tages. */
export function ankunftsHook({ state, ctx, list }) {
  planen(state, ctx, list);
  tierePlanen(state, ctx);
}

/** Hook 'evening': Liegt das Schiff am Ehrenplatz, kaufen die Schaulustigen ein. */
export function abendHook({ state, ctx, boats, events, addIncome }) {
  const s = besState(state);
  const b = boats.find((x) => x?.besucher && x.status === 'moored');
  if (!b) return;
  const berth = ctx.berthById[b.berthId];
  if (!istEhrenplatz(berth)) return;
  const geld = zuschauerGeld(state, b.besucher);
  if (geld > 0) addIncome(geld, 'sonstiges', 'besucher');
  events.push({ type: 'besucherZuschauer', boatId: b.id, art: b.besucher, berthId: b.berthId, geld });
  // Auch ohne Oberfläche festhalten (Erfolg "Hoher Besuch" im Zeitraffer)
  if (!s.gesehen[b.besucher]) sehen(state, s, b.besucher);
  s.gesehen[b.besucher].ehrenplatz = true;
  if (s.heute?.boatId === b.id) Object.assign(s.heute, { phase: 'fest', platz: b.berthId, ehrenplatz: true, zuschauer: (s.heute.zuschauer || 0) + geld });
}

/** Geld der Schaulustigen an einem Abend. */
export function zuschauerGeld(state, art) {
  const z = BES.zuschauer;
  return Math.round((z.geld[Math.max(0, Math.min(z.geld.length - 1, (state.stage || 1) - 1))] || 0) * (z.faktor?.[art] ?? 1));
}

/** Rating-Hook: nichts extra. Der Ehrenplatz zählt als Wunsch (siehe oben). */

/**
 * Alle Hooks einhängen. addHook(name, fn) wie game.sim.addHook, addService(key, def) wie game.sim.addService
 * (meldet den Platz-Wunsch Ehrenplatz an). Gibt eine Funktion zum Aushängen der Hooks zurück.
 */
export function haengeEin(addHook, addService = null) {
  addService?.(EHRENPLATZ, { berthProp: PLATZ_EIGENSCHAFT });
  const ab = [addHook('berthHas', berthHasHook), addHook('arrivals', ankunftsHook), addHook('evening', abendHook)];
  return () => ab.forEach((f) => f?.());
}

/**
 * Ereignisse der Spielregeln auswerten: Phase des Schiffs, gesehen, Ehrenplatz. Gibt eigene Ereignisse
 * zurück: { type: 'besucher', phase, art, boatId, ehrenplatz?, neu? }.
 */
export function verarbeite(state, ctx, events) {
  const s = besState(state);
  const out = [];
  const h = s.heute;
  for (const e of events || []) {
    if (!e || e.boatId == null) continue;
    const b = state.boats[e.boatId];
    const art = b?.besucher ?? (h && h.boatId === e.boatId ? h.art : null);
    if (!art) continue;
    const heute = h && h.boatId === e.boatId ? h : null;
    if (e.type === 'arrived') {
      const neu = sehen(state, s, art);
      if (heute && heute.phase === 'angemeldet') heute.phase = 'wartet';
      out.push({ type: 'besucher', phase: 'wartet', art, boatId: e.boatId, neu });
    } else if (e.type === 'moored') {
      const ehren = istEhrenplatz(ctx.berthById[e.berthId]);
      if (heute) Object.assign(heute, { phase: 'fest', platz: e.berthId, ehrenplatz: ehren });
      if (ehren) s.gesehen[art].ehrenplatz = true;
      out.push({ type: 'besucher', phase: 'fest', art, boatId: e.boatId, berthId: e.berthId, ehrenplatz: ehren });
    } else if (e.type === 'departed') {
      if (heute) heute.phase = 'abgereist';
      out.push({ type: 'besucher', phase: 'abgereist', art, boatId: e.boatId, rating: e.rating });
    } else if (e.type === 'turnedAway' || e.type === 'dismissed') {
      if (heute) heute.phase = 'verpasst';
      out.push({ type: 'besucher', phase: 'verpasst', art, boatId: e.boatId, grund: e.reason ?? e.type });
    }
  }
  return out;
}

/** Ein Motiv gesehen (Schiff eingelaufen, Tier im Bild). Gibt true zurück, wenn es zum ersten Mal ist. */
export function sehen(state, s, art) {
  const g = s.gesehen[art];
  if (g) { g.mal = (g.mal || 1) + 1; return false; }
  s.gesehen[art] = { tag: state.day, stufe: state.stage, mal: 1 };
  if (!s.neu.includes(art)) s.neu.push(art);
  return true;
}

/** Tier gesehen (einmal je Tag zählen). */
export function tierGesehen(state, art) {
  const s = besState(state);
  const t = s.tiere.liste.find((x) => x.art === art);
  if (t?.gesehen) return false;
  if (t) t.gesehen = true;
  return sehen(state, s, art);
}

/** Foto ins Logbuch. bild: kleines JPEG als data-URL (oder null). Gibt true zurück, wenn es das erste Foto ist. */
export function fotoMerken(state, art, bild = null) {
  const s = besState(state);
  if (!MOTIVE.includes(art)) return false;
  if (!s.gesehen[art]) sehen(state, s, art);
  const erstes = !s.fotos[art];
  const ok = typeof bild === 'string' && bild.startsWith('data:image/') && bild.length < 60000;
  s.fotos[art] = { tag: state.day, ...(ok ? { bild } : s.fotos[art]?.bild ? { bild: s.fotos[art].bild } : {}) };
  if (!s.neu.includes(art)) s.neu.push(art);
  return erstes;
}

/**
 * Zum Ausprobieren (?besucher=art): Das nächste erwartete Boot wird jetzt zum Schiff und läuft gleich ein.
 * Gibt den Eintrag heute zurück oder null (kein Boot mehr erwartet, Schiff passt nicht, Winter).
 */
export function ausloesen(state, ctx, art = null) {
  if (state.phase !== 'day' || !state.upcoming?.length) return null;
  const s = besState(state);
  if (besucherDa(state)) return null;
  const alt = s.heute;
  s.heute = null;
  const arten = art ? [art] : moeglicheSchiffe(state, ctx);
  const h = arten.length ? planen(state, ctx, state.upcoming, { erzwingen: { art: arten[0] } }) : null;
  if (!h) { s.heute = alt; return null; }
  const b = state.upcoming.find((x) => x.id === h.boatId);
  b.arriveAt = state.clock + 3;
  h.at = b.arriveAt;
  state.upcoming.sort((a, c) => a.arriveAt - c.arriveAt);
  return h;
}

/** Fortschritt für Logbuch und Erfolge. */
export function fortschritt(state) {
  const s = besState(state);
  const schiffe = Object.keys(BES.schiffe);
  return {
    gesehen: MOTIVE.filter((a) => s.gesehen[a]).length,
    fotos: MOTIVE.filter((a) => s.fotos[a]).length,
    gesamt: MOTIVE.length,
    schiffe: schiffe.filter((a) => s.gesehen[a]).length,
    schiffeGesamt: schiffe.length,
    ehrenplatz: schiffe.filter((a) => s.gesehen[a]?.ehrenplatz).length,
    tierFotos: MOTIVE.filter((a) => istTier(a) && s.fotos[a]).length,
  };
}
