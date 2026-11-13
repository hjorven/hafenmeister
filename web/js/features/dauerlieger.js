// Dauerlieger: Plätze, die für die ganze Saison an ein festes Boot vermietet sind.
// Beschreibung in docs/neue-features.md, Abschnitt 3. Zahlen in ECONOMY.dauerlieger (economy.js).
//
// Die Entscheidung: Ein Dauerplatz bringt die Saisonpacht sofort und sicher, auch bei Sturm
// (rules.dauer.vorauskasse, Pacht je Saisontag = anteilGastpreis des Gastpreises). Dafür liegt dort
// kein Gast: keine Bewertung, kein Ruf, kein Gast fürs Stufenziel. Höchstens hoechstAnteil
// (ein Viertel) der Plätze. Gekündigt wird zum Saisonende, nicht mittendrin.
//
// - Ab Stufe 2 fragen Bewerber an (Einheimische mit eigenem Boot, höchstens bewerberMax offen, jeder
//   wartet bewerberTage). Der Spieler wählt eine freie Box und gibt sie einem passenden Bewerber.
//   Ein Stammgast ab dem 5. Besuch fragt selbst an und kann seinen Platz als Dauerlieger behalten.
// - Kündigen: zum Saisonende kostenlos, sofort gegen Rückzahlung der Pacht für die restlichen Tage
//   plus kuendigungsZuschlag (Anteil der Saisonpacht).
// - An vielen Tagen segelt das Boot morgens raus und kommt abends zurück (nur Bild, der Platz bleibt belegt).
// - Manchmal geht es für 1 bis 3 Tage auf Törn. Dann ist das Schild grün und der Platz frei für Gäste,
//   die rechtzeitig wieder abreisen. Bei Sturm und im Winter bleibt das Boot im Hafen.
// - Ein Teil der Törns endet schon am Nachmittag des letzten Tages (frueherZurueck). Liegt dann noch
//   ein Gast auf dem Platz, wartet der Dauerlieger vor dem Hafen, bis der Spieler den Gast umlegt
//   (umlege). Geschieht das bis zum Abend nicht, kündigt der Dauerlieger zum Saisonende.
// - Saisonwechsel: Am ersten Saisontag zahlen alle Dauerlieger die neue Saison im Voraus.
//   Wer gekündigt hat, verlässt den Hafen am ersten Wintertag.
//
// Die Logik (alles außer init) läuft ohne Browser und ist in tests/dauerlieger.test.mjs getestet.
// Spielstand: state.modules.dauer = { plaetze: { platzId: Platz } }, Platz:
//   bootId, boot     Boot-id; das Boot-Objekt, solange es draußen ist (dann nicht in state.boats)
//   rueckNacht       Tag, in dessen Nacht das Boot zurückkommt (null = Boot ist da)
//   frueherUm        Anteil des Tages, zu dem es am Tag rueckNacht schon zurückkommt (oder null)
//   wartet, gastId   Boot ist früher zurück und wartet vor dem Hafen, weil Gast gastId noch im Platz liegt
//   tagestoern       heute eine Runde draußen
//   jahr, pacht      Saison (Jahr), für die bezahlt ist, und der Betrag
//   kuendigung       null | 'spieler' | 'lieger' (verlässt den Hafen zum Saisonende)
// state.modules.dauer.bewerber = [{ id, artId, modellId, name, size, sail, bootsname, bisTag }]
//
// Ereignisse (über game.sim.dispatch, also als sim:<type>): dauerNeu, dauerAufgehoben, dauerAuslaufen,
// dauerEinlaufen, dauerPacht, dauerWartet, dauerUmgelegt, dauerKuendigung. Dazu für Grafik und Ton:
//   dauer:auslaufen { id, platzId, tage }            (tage 0 = nur Tagestörn)
//   dauer:einlaufen { id, platzId }                  legt an (wartet, bis die Box frei ist)
//   dauer:einlaufen { id, platzId, warten: true, info }  kommt zurück und kreist vor dem Hafen
//   boot-zugewiesen { id, platz }                    umgelegter Gast fährt in seine neue Box

import * as sim from '../sim.js';
import { regelnBereit } from './regeln-bereit.js';
import { random, randomInt } from '../random.js';
import { STAMM } from './stammgaeste.js';
import { BOOTSNAMEN } from '../data/bootsnamen.js';
import { pixelBild } from '../ui/pixel-symbole.js';
import { ECONOMY } from '../data/economy.js';

// Zahlen aus data/economy.js (ECONOMY.dauerlieger); die Werte hier gelten nur, wo dort etwas fehlt.
// Im Spiel kommen sie über rulesFromEconomy in ctx.rules.dauer (regeln(ctx)).
export const DAUER = {
  abStufe: 2,
  anteilGastpreis: 0.5,
  vorauskasse: true,
  hoechstAnteil: 0.25,
  tagestoernChance: 0.4,   // Wahrscheinlichkeit pro Tag für eine Runde draußen (morgens raus, abends zurück)
  toernChance: 0.12,       // Wahrscheinlichkeit pro Tag für einen Törn über mehrere Tage
  toernTage: [1, 3],
  frueherZurueck: 0.35,
  zurueckUm: [0.45, 0.62],
  bewerberMax: 3,
  bewerberChance: 0.35,
  bewerberStart: 2,
  bewerberTage: 10,
  kuendigungsZuschlag: 0.2,
  ...ECONOMY.dauerlieger,
};

/** Einstellungen: Grundwerte, überschrieben von ctx.rules.dauer (economy.js). */
export function regeln(ctx) {
  return { ...DAUER, ...(ctx?.rules?.dauer || {}) };
}

/** Von außen gesetzt (init): Ist an diesem Tag Sturm? Ohne Browser nie. */
export const UMWELT = { sturm: (_tag) => false };

export function dauerState(state) {
  state.modules ||= {};
  state.modules.dauer ||= { plaetze: {} };
  state.modules.dauer.bewerber ||= [];
  return state.modules.dauer;
}

export function istDauerplatz(state, platzId) {
  return !!dauerState(state).plaetze[platzId];
}

// ---------------------------------------------------------------------------
// Obergrenze und Pacht

/** Plätze, die zählen: alle Plätze der Stufe außer fest vergebenen (Fischer). */
export function gastPlaetze(state, ctx) {
  return sim.availableBerths(state, ctx).filter((b) => !b.reserved);
}

/** Wie viele Dauerplätze gerade erlaubt sind (höchstens ein Viertel der Plätze). */
export function hoechstZahl(state, ctx) {
  return Math.floor(gastPlaetze(state, ctx).length * regeln(ctx).hoechstAnteil);
}

export function anzahl(state) {
  return Object.keys(dauerState(state).plaetze).length;
}

/**
 * Für welche Saison und wie viele Saisontage wird jetzt bezahlt?
 * In der Saison: der Rest ab heute (heute zählt mit). Im Winter: die ganze nächste Saison.
 */
export function pachtZeitraum(state, ctx) {
  const sea = sim.season(state, ctx);
  const { seasonDays } = ctx.rules;
  if (sea.winter) return { jahr: sea.year + 1, tage: seasonDays, ganz: true };
  return { jahr: sea.year, tage: Math.max(1, seasonDays - sea.day + 1), ganz: sea.day === 1 };
}

/** Pacht je Saisontag für ein Boot (oder eine Probe mit typeId und size). */
export function pachtJeTag(state, ctx, boot) {
  return Math.max(1, Math.round(sim.nightlyFee(state, ctx, boot, 0) * regeln(ctx).anteilGastpreis));
}

/** Tage bis zum Saisonende (ab morgen), im Winter 0. */
export function tageBisSaisonende(state, ctx) {
  const sea = sim.season(state, ctx);
  return sea.winter ? 0 : ctx.rules.seasonDays - sea.day;
}

// Zufall, der den Spielverlauf nicht verändert: fest je Spiel, Platz und Saison
function hash01(...teile) {
  let h = 2166136261 >>> 0;
  for (const c of teile.join('|')) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  h ^= h >>> 15; h = Math.imul(h, 2246822507) >>> 0; h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/** Bootsarten, die als Dauerlieger an diesen Platz passen (kleinste Maße der Art). */
export function passendeArten(state, ctx, platzId) {
  const berth = ctx.berthById[platzId];
  if (!berth) return [];
  return ctx.types.filter((t) => {
    if (t.stationed || t.special || t.unlock || t.dayVisitors || t.minStage > state.stage) return false;
    const m = t.models?.[0];
    const probe = {
      size: t.size, stationed: true,
      length: m?.length ?? t.length[0], beam: m?.beam ?? t.beam[0], draft: m?.draft ?? t.draft[0],
    };
    return sim.fits(probe, berth, ctx.rules, state.stage);
  });
}

/** Bootsart als Probe mit kleinsten Maßen (für die Passregel). */
function probeVon(t, modell) {
  return {
    size: t.size, stationed: true,
    length: modell?.length ?? t.models?.[0]?.length ?? t.length[0],
    beam: modell?.beam ?? t.models?.[0]?.beam ?? t.beam[0],
    draft: modell?.draft ?? t.models?.[0]?.draft ?? t.draft[0],
  };
}

/** Passt der Bewerber an diesen Platz? */
export function bewerberPasst(state, ctx, bewerber, platzId) {
  const berth = ctx.berthById[platzId];
  const t = ctx.typeById[bewerber.artId];
  if (!berth || !t) return false;
  const modell = t.models?.find((m) => m.id === bewerber.modellId) ?? null;
  return sim.fits(probeVon(t, modell), berth, ctx.rules, state.stage);
}

/** Pacht eines Bewerbers: je Tag, Tage, Summe (für die Saison, die jetzt bezahlt würde). */
export function bewerberPacht(state, ctx, bewerber) {
  const jeTag = pachtJeTag(state, ctx, { typeId: bewerber.artId, size: bewerber.size });
  const { tage } = pachtZeitraum(state, ctx);
  return { jeTag, tage, summe: jeTag * tage };
}

/** Offene Bewerber, die an diesen Platz passen (in der Reihenfolge ihrer Anfrage). */
export function passendeBewerber(state, ctx, platzId) {
  return dauerState(state).bewerber.filter((b) => bewerberPasst(state, ctx, b, platzId));
}

/**
 * Bewerber, denen der Spieler diesen Platz jetzt wirklich geben kann. Leer, wenn der Platz gerade
 * nicht vermietbar ist (belegt, reserviert, Obergrenze voll ...): rechnet wie machDauerplatz, den Grund
 * nennt kannDauerplatz(state, ctx, platzId).reason.
 */
export function bewerberFuer(state, ctx, platzId) {
  return kannDauerplatz(state, ctx, platzId).ok ? passendeBewerber(state, ctx, platzId) : [];
}

/**
 * Neuer Bewerber: ein Einheimischer mit eigenem Boot, das an mindestens eine Gastbox passt.
 * Am liebsten ein Segelboot. Gibt den Bewerber zurück oder null.
 */
export function neuerBewerber(state, ctx) {
  const d = dauerState(state);
  const R = regeln(ctx);
  const plaetze = gastPlaetze(state, ctx).map((b) => b.id);
  const passt = (t, ids, m) => ids.some((id) => sim.fits(probeVon(t, m), ctx.berthById[id], ctx.rules, state.stage));
  const alle = ctx.types.filter((t) => !t.stationed && !t.special && !t.unlock && !t.dayVisitors && t.minStage <= state.stage
    && passt(t, plaetze));
  if (!alle.length) return null;
  // Meist fragt jemand an, dessen Boot in eine gerade freie Box passt (sonst kann der Spieler nichts tun)
  const frei = plaetze.filter((id) => sim.isFree(state, id) && !d.plaetze[id]);
  const fuerFreie = alle.filter((t) => passt(t, frei));
  const arten = fuerFreie.length && random(state) < R.passtFreieBox ? fuerFreie : alle;
  const zielPlaetze = arten === fuerFreie ? frei : plaetze;
  const segler = arten.filter((t) => t.sail);
  const pool = segler.length && random(state) < R.seglerAnteil ? segler : arten;
  const art = pool[Math.floor(random(state) * pool.length)];
  const modelle = (art.models || []).filter((m) => (m.minStage ?? art.minStage) <= state.stage && passt(art, zielPlaetze, m));
  const modell = modelle.length ? modelle[Math.floor(random(state) * modelle.length)] : null;
  d.naechsterBewerber = (d.naechsterBewerber ?? 0) + 1;
  const b = {
    id: d.naechsterBewerber, artId: art.id, modellId: modell?.id ?? null, name: modell?.name ?? art.name,
    size: art.size, sail: !!art.sail, bootsname: null, bisTag: state.day + R.bewerberTage,
  };
  benenne(state, b);
  d.bewerber.push(b);
  return b;
}

/** Bewerber auffrischen: Abgelaufene gehen, neue kommen (nicht im Winter). Gibt Ereignisse zurück. */
function bewerberRunde(state, ctx, tag, events) {
  const d = dauerState(state);
  const R = regeln(ctx);
  d.bewerber = d.bewerber.filter((b) => b.bisTag >= tag);
  if (state.stage < R.abStufe || sim.season({ day: tag }, ctx).winter) return;
  if (d.bewerber.length < R.bewerberMax && random(state) < R.bewerberChance) {
    const b = neuerBewerber(state, ctx);
    if (b) events.push({ type: 'dauerBewerber', bewerberId: b.id, name: b.name, bootsname: b.bootsname });
  }
}

/** Kann dieser Platz jetzt Dauerplatz werden? { ok, reason } */
export function kannDauerplatz(state, ctx, platzId) {
  const berth = ctx.berthById[platzId];
  if (!berth || !sim.berthAvailable(state, berth)) return { ok: false, reason: 'noBerth' };
  if (state.stage < regeln(ctx).abStufe) return { ok: false, reason: 'stage' };
  if (istDauerplatz(state, platzId)) return { ok: false, reason: 'schon' };
  if (berth.reserved) return { ok: false, reason: 'reserved' };
  if (!sim.isFree(state, platzId)) return { ok: false, reason: 'occupied' };
  if (anzahl(state) >= hoechstZahl(state, ctx)) return { ok: false, reason: 'voll' };
  if (!passendeBewerber(state, ctx, platzId).length) return { ok: false, reason: 'keinBewerber' };
  return { ok: true };
}

/**
 * Gibt einem Dauerlieger einen Namen am Heck, wie ihn Gastboote auch haben (stammgaeste.js).
 * Heimathafen ist dieser Hafen, darum keiner. Möglichst ein Name, den gerade kein anderes Boot trägt.
 */
export function benenne(state, boot) {
  if (!boot || boot.bootsname) return;
  const vergeben = new Set(Object.values(state.boats).map((b) => b.bootsname).filter(Boolean));
  for (const p of Object.values(dauerState(state).plaetze)) if (p.boot?.bootsname) vergeben.add(p.boot.bootsname);
  for (const b of dauerState(state).bewerber) if (b.bootsname) vergeben.add(b.bootsname);
  const frei = BOOTSNAMEN.filter((n) => !vergeben.has(n));
  const liste = frei.length ? frei : BOOTSNAMEN;
  boot.bootsname = liste[Math.floor(random(state) * liste.length)];
}

function neuerPlatz(bootId) {
  return { bootId, rueckNacht: null, boot: null, tagestoern: false, frueherUm: null, wartet: false, gastId: null, jahr: null, pacht: 0, kuendigung: null };
}

/** Saisonpacht im Voraus kassieren (bei Vorauskasse). Gibt das Ereignis zurück oder null. */
function kassierePacht(state, ctx, platzId, boot) {
  const p = dauerState(state).plaetze[platzId];
  const { jahr, tage } = pachtZeitraum(state, ctx);
  p.jahr = jahr;
  if (!regeln(ctx).vorauskasse) { p.pacht = 0; return null; }
  const summe = pachtJeTag(state, ctx, boot) * tage;
  p.pacht = summe;
  sim.addIncome(state, summe, 'pacht', 'saison');
  return { type: 'dauerPacht', berthId: platzId, boatId: boot.id, amount: summe, tage, jahr };
}

/**
 * Gibt den Platz einem Bewerber (bewerberId, sonst dem ersten passenden). Die Saisonpacht kommt sofort.
 */
export function machDauerplatz(state, ctx, platzId, bewerberId = null) {
  const k = kannDauerplatz(state, ctx, platzId);
  if (!k.ok) return { ok: false, reason: k.reason, events: [] };
  const passend = bewerberFuer(state, ctx, platzId);
  const a = bewerberId == null ? passend[0] : passend.find((b) => b.id === bewerberId);
  if (!a) return { ok: false, reason: 'keinBewerber', events: [] };
  let r = sim.stationBoat(state, ctx, a.artId, platzId, a.modellId);
  if (!r.ok && a.modellId) r = sim.stationBoat(state, ctx, a.artId, platzId, null);
  if (!r.ok) return { ok: false, reason: r.reason, events: [] };
  const d = dauerState(state);
  d.bewerber = d.bewerber.filter((b) => b !== a);
  const boot = state.boats[r.boatId];
  boot.dauer = true;
  if (a.bootsname) boot.bootsname = a.bootsname;
  else benenne(state, boot);
  dauerState(state).plaetze[platzId] = neuerPlatz(r.boatId);
  const events = [...r.events, { type: 'dauerNeu', boatId: r.boatId, berthId: platzId }];
  const pacht = kassierePacht(state, ctx, platzId, boot);
  if (pacht) events.push(pacht);
  return { ok: true, boatId: r.boatId, events };
}

/**
 * Stammgast ab dem 5. Besuch, der gerade hier liegt, als Dauerlieger behalten.
 * Er bleibt an seinem Platz und zahlt ab jetzt die Saisonpacht.
 */
export function kannBehalten(state, ctx, platzId) {
  const boot = state.boats[state.berths[platzId]];
  if (!boot || boot.stationed || boot.status !== 'moored' || boot.trip?.away) return false;
  if (state.stage < regeln(ctx).abStufe || istDauerplatz(state, platzId)) return false;
  if (anzahl(state) >= hoechstZahl(state, ctx)) return false;
  return (boot.besuche ?? 0) >= STAMM.dauerAbBesuch;
}

/** Steht ein Stammgast hier, der Dauerlieger werden könnte, nur ist kein Dauerplatz mehr frei? */
export function behaltenVoll(state, ctx, platzId) {
  const boot = state.boats[state.berths[platzId]];
  return !!boot && !boot.stationed && boot.status === 'moored' && state.stage >= regeln(ctx).abStufe
    && !istDauerplatz(state, platzId) && (boot.besuche ?? 0) >= STAMM.dauerAbBesuch
    && anzahl(state) >= hoechstZahl(state, ctx);
}

export function behalte(state, ctx, platzId) {
  if (!kannBehalten(state, ctx, platzId)) return { ok: false, events: [] };
  const boot = state.boats[state.berths[platzId]];
  Object.assign(boot, { stationed: true, dauer: true, nights: null, wishes: [], pendingFee: boot.pendingFee || 0 });
  dauerState(state).plaetze[platzId] = neuerPlatz(boot.id);
  const events = [{ type: 'dauerNeu', boatId: boot.id, berthId: platzId, stammgast: true }];
  const pacht = kassierePacht(state, ctx, platzId, boot);
  if (pacht) events.push(pacht);
  return { ok: true, boatId: boot.id, events };
}

/** Zum Saisonende kündigen (an = true) oder die Kündigung zurücknehmen. */
export function kuendige(state, platzId, an = true) {
  const p = dauerState(state).plaetze[platzId];
  if (!p || p.kuendigung === 'lieger') return { ok: false, events: [] };
  p.kuendigung = an ? 'spieler' : null;
  return { ok: true, events: [{ type: 'dauerKuendigung', berthId: platzId, boatId: p.bootId, von: an ? 'spieler' : null }] };
}

/**
 * Sofort kündigen kostet: Die Pacht der restlichen Saisontage geht zurück, dazu ein Zuschlag
 * (kuendigungsZuschlag der Saisonpacht). Im Winter und ohne Vorauskasse nur der Zuschlag auf
 * die Pacht einer ganzen Saison. Gibt { rest, zuschlag, summe }.
 */
export function sofortKosten(state, ctx, platzId) {
  const p = dauerState(state).plaetze[platzId];
  if (!p) return null;
  const R = regeln(ctx);
  const boot = p.boot || state.boats[p.bootId];
  const jeTag = boot ? pachtJeTag(state, ctx, boot) : 0;
  const sea = sim.season(state, ctx);
  const bezahltDieseSaison = R.vorauskasse && !sea.winter && p.jahr === sea.year;
  const bezahltNaechste = R.vorauskasse && sea.winter && p.jahr === sea.year + 1;
  // heute zählt noch als bezahlter Tag, zurück gehen die Tage ab morgen
  const rest = bezahltDieseSaison ? Math.min(p.pacht, jeTag * tageBisSaisonende(state, ctx)) : bezahltNaechste ? p.pacht : 0;
  const zuschlag = Math.round(jeTag * ctx.rules.seasonDays * R.kuendigungsZuschlag);
  return { rest, zuschlag, summe: rest + zuschlag };
}

/** Sofort kündigen: kostet sofortKosten(), das Boot verlässt den Hafen gleich. */
export function kuendigeSofort(state, ctx, platzId) {
  const k = sofortKosten(state, ctx, platzId);
  if (!k) return { ok: false, reason: 'keinPlatz', events: [] };
  if (dauerState(state).plaetze[platzId].wartet) return { ok: false, reason: 'wartet', events: [] };
  if (state.money < k.summe) return { ok: false, reason: 'money', events: [] };
  if (k.summe > 0 && !sim.spend(state, k.summe, 'pacht')) return { ok: false, reason: 'money', events: [] };
  const r = hebeAuf(state, ctx, platzId);
  return { ok: true, kosten: k.summe, events: [{ type: 'dauerAbfindung', berthId: platzId, amount: k.summe }, ...r.events] };
}

/** Dauerplatz wieder zum Gastplatz machen. Das Boot verlässt den Hafen (Saisonende, Spielstand). */
export function hebeAuf(state, ctx, platzId) {
  const d = dauerState(state);
  const p = d.plaetze[platzId];
  if (!p) return { ok: false, events: [] };
  const events = [];
  if (p.boot) {
    // Boot ist draußen: es kommt einfach nicht zurück
  } else if (state.boats[p.bootId]) {
    events.push(...sim.unstationBoat(state, ctx, p.bootId).events);
  }
  delete d.plaetze[platzId];
  events.push({ type: 'dauerAufgehoben', boatId: p.bootId, berthId: platzId, grund: p.kuendigung });
  return { ok: true, events };
}

/** Ist das Boot gerade auf mehrtägigem Törn? Dann bis zu welcher Nacht? */
export function draussenBis(state, platzId) {
  const p = dauerState(state).plaetze[platzId];
  return p && p.boot ? p.rueckNacht : null;
}

/**
 * Zusätzliche Passregel (Hook 'fit'): Ein Gast darf auf einen Dauerplatz, dessen Boot auf Törn ist,
 * wenn er spätestens in der Nacht abreist, in der das Boot zurückkommt.
 * Ein Gast, der heute (Tag D) kommt und n Nächte bleibt, reist in der Nacht von Tag D + n - 1 ab.
 */
export function fitHook({ state, boat, berth }) {
  const p = dauerState(state).plaetze[berth.id];
  if (!p || boat.stationed) return null;
  if (!p.boot || p.wartet) return 'dauer';   // Boot liegt da oder wartet schon vor dem Hafen
  const abreiseNacht = state.day + (boat.nights ?? 1) - 1;
  return abreiseNacht <= p.rueckNacht ? null : 'dauerZurueck';
}

/** Boot vom Törn zurück an seinen Platz legen (Platz muss frei sein). */
function legeAn(state, platzId, p, events) {
  const boot = p.boot;
  boot.status = 'moored';
  boot.berthId = platzId;
  state.boats[boot.id] = boot;
  state.berths[platzId] = boot.id;
  Object.assign(p, { boot: null, rueckNacht: null, frueherUm: null, wartet: false, gastId: null });
  events.push({ type: 'dauerEinlaufen', boatId: boot.id, berthId: platzId, tagestoern: false });
}

/**
 * Tagsüber (Hook 'tick'): Ein Boot, das früher zurückkommt, ist am Nachmittag da. Ist sein Platz frei,
 * legt es an. Sonst wartet es vor dem Hafen, bis der Gast umgelegt ist.
 */
export function tickHook({ state, ctx, events }) {
  // Sobald Dauerplätze möglich sind, fragen gleich die ersten Bewerber an
  const d = dauerState(state);
  if (!d.bewerberGestartet && state.stage >= regeln(ctx).abStufe && !sim.season(state, ctx).winter) {
    d.bewerberGestartet = true;
    for (let i = 0; i < regeln(ctx).bewerberStart; i++) {
      const b = neuerBewerber(state, ctx);
      if (b) events.push({ type: 'dauerBewerber', bewerberId: b.id, name: b.name, bootsname: b.bootsname, start: true });
    }
  }
  for (const [platzId, p] of Object.entries(dauerState(state).plaetze)) {
    if (!p.boot || p.frueherUm == null || state.day < p.rueckNacht) continue;
    if (!p.wartet && state.clock < p.frueherUm * ctx.rules.dayLength) continue;
    if (sim.isFree(state, platzId)) { legeAn(state, platzId, p, events); continue; }
    if (p.wartet) continue;
    p.wartet = true;
    p.gastId = state.berths[platzId] ?? state.leaving?.[platzId]?.boatId ?? null;
    events.push({ type: 'dauerWartet', boatId: p.bootId, berthId: platzId, gastId: p.gastId });
  }
}

/** Freie Plätze, auf die der Gast umgelegt werden kann (der beste zuerst). */
export function umlegeZiele(state, ctx, gastId) {
  const gast = state.boats[gastId];
  if (!gast || gast.stationed || gast.status !== 'moored') return [];
  return sim.fittingBerths(state, ctx, gastId).filter((id) => id !== gast.berthId);
}

/** Welcher Dauerplatz wartet auf diesen Gast? (Platz-id oder null) */
export function wartetAuf(state, gastId) {
  for (const [platzId, p] of Object.entries(dauerState(state).plaetze)) {
    if (p.wartet && String(p.gastId) === String(gastId) && state.berths[platzId] === state.boats[gastId]?.id) return platzId;
  }
  return null;
}

/**
 * Gast vom Dauerplatz auf einen freien Platz umlegen. Der Dauerlieger legt gleich danach an.
 * Der Gast hat für die Nacht schon bezahlt; er nimmt seinen neuen Platz mit Komfort und Strom so,
 * wie er ist.
 */
export function umlege(state, ctx, gastId, zielId) {
  const gast = state.boats[gastId];
  const platzId = wartetAuf(state, gastId);
  if (!gast || !platzId) return { ok: false, reason: 'keinGrund', events: [] };
  if (!umlegeZiele(state, ctx, gastId).includes(zielId)) {
    const berth = ctx.berthById[zielId];
    const reason = !berth || !sim.berthAvailable(state, berth) ? 'noBerth'
      : !sim.isFree(state, zielId) ? 'occupied'
        : sim.whyNotFit(gast, berth, ctx.rules, state.stage) || sim.hookWhyNotFit(state, ctx, gast, berth) || 'occupied';
    return { ok: false, reason, events: [] };
  }
  delete state.berths[platzId];
  state.berths[zielId] = gast.id;
  gast.berthId = zielId;
  const p = dauerState(state).plaetze[platzId];
  const events = [{ type: 'dauerUmgelegt', boatId: gast.id, from: platzId, berthId: zielId, unterwegs: !!gast.trip?.away, dauerId: p.bootId }];
  legeAn(state, platzId, p, events);
  return { ok: true, events };
}

/** Abends: Wer heute nur eine Runde draußen war, ist zurück; wer noch wartet, ist verärgert (Hook 'evening'). */
export function abendHook({ state, events }) {
  for (const [platzId, p] of Object.entries(dauerState(state).plaetze)) {
    if (p.tagestoern) {
      p.tagestoern = false;
      events.push({ type: 'dauerEinlaufen', boatId: p.bootId, berthId: platzId, tagestoern: true });
    }
    if (p.wartet && p.kuendigung !== 'lieger') {
      p.kuendigung = 'lieger';
      events.push({ type: 'dauerKuendigung', berthId: platzId, boatId: p.bootId, von: 'lieger' });
    }
  }
}

/**
 * Nachts (Hook 'night', nach der Abreise der Gäste): Saisonwechsel, Törn-Boote kommen zurück,
 * andere brechen auf. Was hier als Auslaufen gemeldet wird, sieht man am nächsten Morgen.
 */
export function nachtHook({ state, ctx, events }) {
  const d = dauerState(state);
  const R = regeln(ctx);
  const heute = sim.season(state, ctx);
  const morgen = sim.season({ day: state.day + 1 }, ctx);

  // Saisonende: Gekündigte verlassen den Hafen am ersten Wintertag
  if (morgen.winter && !heute.winter) {
    for (const [platzId, p] of Object.entries(d.plaetze)) {
      if (p.kuendigung) events.push(...hebeAuf(state, ctx, platzId).events);
    }
  }
  // Neue Saison: alle zahlen im Voraus
  if (!morgen.winter && morgen.day === 1 && R.vorauskasse) {
    let summe = 0, n = 0;
    for (const [platzId, p] of Object.entries(d.plaetze)) {
      if (p.kuendigung || (p.jahr ?? 0) >= morgen.year) continue;
      const boot = p.boot || state.boats[p.bootId];
      if (!boot) continue;
      const betrag = pachtJeTag(state, ctx, boot) * ctx.rules.seasonDays;
      Object.assign(p, { jahr: morgen.year, pacht: betrag });
      sim.addIncome(state, betrag, 'pacht', 'saison');
      summe += betrag; n++;
    }
    if (n) events.push({ type: 'dauerPacht', amount: summe, anzahl: n, jahr: morgen.year, saison: true });
  }

  bewerberRunde(state, ctx, state.day + 1, events);

  const ruhig = !morgen.winter && !UMWELT.sturm(state.day + 1);
  for (const [platzId, p] of Object.entries(d.plaetze)) {
    if (p.boot) {
      if (p.rueckNacht > state.day) continue;
      // Ein Gast, der noch bleibt, hält den Platz: dann eine Nacht später. Ein Gast, der heute Nacht
      // abgerechnet wurde und erst morgens ablegen wollte (state.leaving), legt sofort ab (sim.js tick).
      if (state.berths[platzId] != null) { p.rueckNacht = state.day + 1; p.frueherUm = null; continue; }
      legeAn(state, platzId, p, events);
      continue;
    }
    const boot = state.boats[p.bootId];
    if (!boot) { delete d.plaetze[platzId]; continue; }   // Spielstand passt nicht mehr, Platz freigeben
    if (!ruhig) continue;                                  // bei Sturm und im Winter bleibt das Boot im Hafen
    const wurf = random(state);
    if (wurf < R.toernChance) {
      const tage = randomInt(state, R.toernTage[0], R.toernTage[1]);
      delete state.berths[platzId];
      delete state.boats[boot.id];
      boot.status = 'away';
      p.boot = boot;
      p.rueckNacht = state.day + tage;   // weg an den Tagen day+1 .. day+tage, zurück in deren letzter Nacht
      // Manche kommen schon am Nachmittag des letzten Tages
      p.frueherUm = random(state) < R.frueherZurueck
        ? R.zurueckUm[0] + random(state) * (R.zurueckUm[1] - R.zurueckUm[0]) : null;
      events.push({ type: 'dauerAuslaufen', boatId: boot.id, berthId: platzId, tage });
    } else if (wurf < R.toernChance + R.tagestoernChance) {
      p.tagestoern = true;
      events.push({ type: 'dauerAuslaufen', boatId: boot.id, berthId: platzId, tage: 0 });
    }
  }
}

/**
 * Stufenausbau (Hook 'stageUp'): Fällt ein Dauerplatz weg, zieht er mit seinem Boot um.
 * Liegt das Boot im Hafen, haben die Regeln es schon umgelegt (moves); ist es auf Törn, bekommt es
 * hier einen neuen freien Platz, an den es zurückkommt. Gibt es keinen, endet der Dauerplatz.
 */
export function stufenHook({ state, gone, moves, findBerth, events }) {
  const d = dauerState(state);
  for (const alt of gone) {
    const p = d.plaetze[alt];
    if (!p) continue;
    delete d.plaetze[alt];
    const umzug = moves.find((m) => m.from === alt && m.boatId === p.bootId);
    const neu = umzug?.to ?? (p.boot ? findBerth(p.boot) : null);
    if (neu && !d.plaetze[neu]) {
      d.plaetze[neu] = p;
      events.push({ type: 'dauerUmzug', boatId: p.bootId, from: alt, berthId: neu });
    } else {
      events.push({ type: 'dauerAufgehoben', boatId: p.bootId, berthId: alt, grund: 'umbau' });
    }
  }
}

/** Ältere Spielstände: Dauerplätze ohne Vertrag gelten für die laufende Saison als bezahlt. */
export function ergaenzeAlteStaende(state, ctx) {
  for (const p of Object.values(dauerState(state).plaetze)) {
    for (const [k, v] of Object.entries(neuerPlatz(p.bootId))) if (p[k] === undefined) p[k] = v;
    if (p.jahr == null) p.jahr = pachtZeitraum(state, ctx).jahr;
  }
}

/** Hooks in einen Regel-Kontext hängen (Browser über game.sim.addHook, Tests über sim.addHook). */
export function haengeEin(addHook) {
  const ab = [addHook('fit', fitHook), addHook('evening', abendHook), addHook('night', nachtHook), addHook('tick', tickHook), addHook('stageUp', stufenHook)];
  return () => ab.forEach((f) => f());
}

// ---------------------------------------------------------------------------
// Im Browser: Infokarte beim Antippen eines Platzes oder eines Gastes, der umgelegt werden muss.
// Die Grün-Rot-Schilder an den Plätzen zeichnet features/platzschilder.js.

const euro = (n) => `${Math.round(n).toLocaleString('de-DE')} €`;
const GRUND = {
  length: 'Das Boot ist zu lang für diesen Platz.',
  beam: 'Das Boot ist zu breit für diesen Platz.',
  draft: 'Hier ist das Wasser zu flach für dieses Boot.',
  size: 'Dieser Platz ist für andere Schiffsgrößen.',
  reserved: 'Dieser Platz ist fest vergeben.',
  occupied: 'Der Platz ist schon belegt.',
  dauer: 'Das ist ein Dauerplatz.',
  dauerZurueck: 'Der Dauerlieger dieses Platzes kommt vorher zurück.',
};

export async function init(game) {
  await regelnBereit(game);
  const api = game.sim;
  haengeEin(api.addHook);
  // Bei Sturm bleiben Dauerlieger im Hafen (Wetter aus events/events.js)
  UMWELT.sturm = (tag) => game.events?.weather?.(tag)?.event === 'sturm';
  const R = () => regeln(api.ctx);
  // Ältere Spielstände: Dauerlieger ohne Namen und ohne Vertrag
  const alteErgaenzen = () => {
    ergaenzeAlteStaende(api.state, api.ctx);
    for (const p of Object.values(dauerState(api.state).plaetze)) benenne(api.state, p.boot || api.state.boats[p.bootId]);
  };
  alteErgaenzen();

  const bootsname = (b) => (b?.bootsname ? `„${b.bootsname}“` : b?.name ?? 'Boot');
  const info = (b, platz) => ({ id: b.id, groesse: b.size, art: b.typeId, modell: b.modelId, palette: b.id % 4, name: b.name, platz, zustand: 'kommt', bezahlt: true, offen: 0 });

  // Hinweis oben im Pixel-Rahmen wie das Ereignisschild (events/banner.js), aber eigenes Element.
  // Wartet ein Dauerlieger, bleibt der Hinweis stehen, bis alle umgelegt sind (oder der Abend kommt).
  // Andere Meldungen stehen in einer Schlange und kommen nacheinander.
  const host = document.getElementById('game') ?? document.body;
  const hinweis = document.createElement('div');
  hinweis.id = 'dauer-hinweis';
  hinweis.className = 'hm-px';
  hinweis.setAttribute('role', 'status');
  hinweis.setAttribute('aria-live', 'polite');
  hinweis.hidden = true;
  host.appendChild(hinweis);
  const stil = document.createElement('style');
  stil.textContent = `
    #dauer-hinweis { position: absolute; left: 50%; transform: translateX(-50%); z-index: 25;
      top: calc(var(--hm-oben, env(safe-area-inset-top, 0px)) + var(--hm-knopf, 44px) + 8px);
      width: min(420px, calc(100% - 32px)); display: flex; gap: 10px; align-items: flex-start;
      padding: 10px 12px; color: var(--hm-tinte, #283648); cursor: pointer; line-height: 1.35; }
    #dauer-hinweis:not(.hm-px) { background: #fffcf6; border: 2px solid #283648; }
    #dauer-hinweis[hidden], body.card-open #dauer-hinweis, #dauer-hinweis.zurueck { display: none; }
    #dauer-hinweis img, #dauer-hinweis svg { flex: none; width: 24px; height: 24px; image-rendering: pixelated; }
    #dauer-hinweis strong { display: block; font-weight: 600; }
    #dauer-hinweis span { display: block; font-size: max(13px, 0.875rem); }
    #card .dauer-liste { flex-direction: column; align-items: stretch; }
    .hm-neu #card .dauer-liste .hud-btn, #card .dauer-liste .hud-btn { flex: 0 0 auto; min-height: 44px; text-align: left; white-space: normal; }
  `;
  document.head.appendChild(stil);
  let hinweisTimer = 0;
  let hinweisArt = null;          // 'wartet' oder null
  const schlange = [];
  function fuelle(symbol, titel, text) {
    hinweis.replaceChildren();
    try { const b = pixelBild(symbol, 24); if (b) hinweis.append(b); } catch { /* ohne Symbol */ }
    const body = document.createElement('div');
    const t = document.createElement('strong');
    t.textContent = titel;
    const p = document.createElement('span');
    p.textContent = text;
    body.append(t, p);
    hinweis.append(body);
    hinweis.hidden = false;
    platziereHinweis();
  }
  // Der Hinweis liegt nicht über der linken Spalte, dem Funk oder dem Ereignisschild:
  // oben in der Lücke dazwischen (PC, Querformat), sonst darunter (Handy hochkant).
  // (nicht offsetParent: das ist bei position: fixed immer null, etwa bei der Kartenwahl der Tagesziele)
  const sichtbar = (e) => {
    if (!e || e.hidden || e.closest('[hidden]') || getComputedStyle(e).visibility === 'hidden') return false;
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  // Offene Karten und Fenster: solange steht der Hinweis zurück (ausgeblendet, seine Zeit läuft nicht ab)
  const FENSTER = '.hm-ta, .tz-wahl, #hm-feier, #hm-menue, #hm-einstellungen, .hm-ziel-panel, #weather-panel';
  const fensterOffen = () => document.body.classList.contains('card-open') || [...document.querySelectorAll(FENSTER)].some(sichtbar);
  function platziereHinweis() {
    if (hinweis.hidden) return;
    hinweis.classList.toggle('zurueck', fensterOffen());
    if (hinweis.classList.contains('zurueck')) return;
    const h = host.getBoundingClientRect();
    const rand = 8;
    const kopf = document.getElementById('hud-top');
    let oben = (sichtbar(kopf) ? kopf.getBoundingClientRect().bottom - h.top : 56) + rand;
    const ev = document.getElementById('event-banner');
    if (sichtbar(ev)) oben = Math.max(oben, ev.getBoundingClientRect().bottom - h.top + rand);
    const rechteck = (e, tipp = false) => {
      const r = e.getBoundingClientRect();
      return { l: r.left - h.left, r: r.right - h.left, o: r.top - h.top, u: r.bottom - h.top, tipp };
    };
    const hinder = [
      ...[...document.querySelectorAll('#hm-seite > *, #hm-seite > * > *, #hm-funk')].filter(sichtbar).map((e) => rechteck(e)),
      // Tipps (Einstieg, "Als Nächstes" beim Bauen): möglichst frei lassen
      ...[...document.querySelectorAll('.hm-tipp, #bau-tipp')].filter(sichtbar).map((e) => rechteck(e, true)),
    ];
    const breit = Math.min(420, h.width - 32);
    const hoehe = 120;
    const imBand = hinder.filter((r) => r.o < oben + hoehe && r.u > oben);
    const mitte = h.width / 2;
    const L = Math.max(0, ...imBand.filter((r) => (r.l + r.r) / 2 < mitte).map((r) => r.r));
    const R = Math.min(h.width, ...imBand.filter((r) => (r.l + r.r) / 2 >= mitte).map((r) => r.l));
    const luecke = R - L - 2 * rand;
    const setze = (links, w, top) => Object.assign(hinweis.style, { left: `${Math.round(links)}px`, width: `${Math.round(w)}px`, transform: 'none', top: `${Math.round(top)}px` });
    // Unten nie über Zeit, Kassieren oder Bauen
    const grenze = (links, w) => Math.min(h.height, ...[...document.querySelectorAll('#hm-zeit, #btn-collect, #btn-build')].filter(sichtbar)
      .map((e) => rechteck(e)).filter((r) => r.r > links && r.l < links + w).map((r) => r.o - rand));
    const passt = (top, links, w) => top + hinweis.offsetHeight <= grenze(links, w);
    if (luecke >= Math.min(260, breit)) {
      // Oben in der Lücke zwischen linker Spalte und Funk (PC, Querformat)
      const w = Math.min(breit, luecke);
      setze(L + rand + (luecke - w) / 2, w, oben);
      return;
    }
    // Handy hochkant: unter der linken Spalte, möglichst nicht über einem Tipp
    const w = breit;
    const links = (h.width - w) / 2;
    const unter = (liste) => Math.max(oben, ...liste.filter((r) => r.l < links + w && r.r > links).map((r) => r.u + rand));
    const untenAlles = unter(hinder);
    const untenSpalte = unter(hinder.filter((r) => !r.tipp));
    setze(links, w, untenAlles);
    if (passt(untenAlles, links, w)) return;
    const ueberTipp = hinder.some((r) => r.tipp && r.l < links + w && r.r > links && r.o < untenSpalte + hinweis.offsetHeight && r.u > untenSpalte);
    // Ein wartender Dauerlieger hat eine Frist bis zum Abend: dann notfalls über den Einstiegstipp oder
    // eine aufgeklappte Tafel, aber nie über Spalte und Knöpfe. Andere Hinweise warten, bis Platz ist.
    if (passt(untenSpalte, links, w) && (!ueberTipp || hinweisArt === 'wartet')) { setze(links, w, untenSpalte); return; }
    if (hinweisArt === 'wartet') { setze(links, w, Math.max(rand, grenze(links, w) - hinweis.offsetHeight)); return; }
    hinweis.classList.add('zurueck');
  }
  setInterval(platziereHinweis, 1000);
  window.addEventListener('resize', platziereHinweis);
  // Solange eine Karte offen ist, ist der Hinweis ausgeblendet und seine Zeit läuft nicht ab
  function weiter() {
    if (fensterOffen() || hinweis.classList.contains('zurueck')) { hinweisTimer = setTimeout(weiter, 1000); return; }
    naechster();
  }
  function naechster() {
    clearTimeout(hinweisTimer);
    if (wartende().length) { zeigeWartende(); return; }
    hinweisArt = null;
    const m = schlange.shift();
    if (!m) { hinweis.hidden = true; return; }
    fuelle(m.symbol, m.titel, m.text);
    hinweisTimer = setTimeout(weiter, m.sekunden * 1000);
  }
  function zeigeHinweis(titel, text, sekunden = 7, symbol = 'hinweis') {
    // gleiche Meldung nicht doppelt in die Schlange
    if (schlange.some((m) => m.titel === titel && m.text === text)) return;
    schlange.push({ titel, text, sekunden, symbol });
    if (schlange.length > 4) schlange.shift();
    if (hinweis.hidden) naechster();
  }
  const wartende = () => Object.entries(dauerState(api.state).plaetze)
    .filter(([, p]) => p.wartet && api.state.boats[p.gastId]).map(([platzId, p]) => ({ platzId, p }));
  function zeigeWartende() {
    const w = wartende();
    if (!w.length) { if (hinweisArt === 'wartet') naechster(); return; }
    clearTimeout(hinweisTimer);
    hinweisArt = 'wartet';
    const erster = w[0];
    if (w.length === 1) {
      fuelle('warnung', `${bootsname(erster.p.boot)} ist früher zurück`,
        `Auf Platz ${erster.platzId} liegt noch ${bootsname(api.state.boats[erster.p.gastId])}. Hier tippen und den Gast bis heute Abend umlegen, sonst kündigt der Dauerlieger zum Saisonende.`);
    } else {
      fuelle('warnung', `${w.length} Dauerlieger sind früher zurück`,
        `Gäste liegen noch auf ${w.map((x) => x.platzId).join(', ')}. Hier tippen und einen nach dem anderen bis heute Abend umlegen.`);
    }
  }
  /** Kamera zum Platz fliegen lassen (wenn die Kamera das kann). */
  function zeigePlatz(platzId) {
    const pl = game.stege?.platz?.(platzId);
    const x = pl?.x ?? pl?.mesh?.position?.x, z = pl?.z ?? pl?.mesh?.position?.z;
    if (x != null && z != null) game.camera?.flyTo?.(x, z);
  }
  hinweis.addEventListener('click', () => {
    const w = wartende();
    if (w.length) {
      // Antippen öffnet die Karte des (ersten) Gastes, der umgelegt werden muss, und zeigt seinen Platz
      zeigePlatz(w[0].platzId);
      gastKarte(w[0].p.gastId);
      return;
    }
    naechster();
  });
  // Ein wartender Dauerlieger ist nach dem Laden wieder vor dem Hafen zu sehen (nach dem Abgleich der Ansicht)
  function wartendeZeigen() {
    for (const [platzId, p] of Object.entries(dauerState(api.state).plaetze)) {
      if (p.wartet && p.boot) game.emit('dauer:einlaufen', { id: p.boot.id, platzId, warten: true, info: info(p.boot, platzId) });
    }
    zeigeWartende();
  }
  // init wartet auf die Regeln (regelnBereit), 'ready' kann also schon vorbei sein: einmal nach dem Start zeigen
  let gestartet = false;
  const nachStart = () => { if (gestartet) return; gestartet = true; setTimeout(wartendeZeigen, 600); };
  game.on('ready', nachStart);
  if (document.getElementById('boot')?.classList.contains('done') || game.boatAnim) nachStart();

  // Deutsche Ereignisse für Grafik und Ton, Hinweise für den Spieler
  game.on('sim:dauerAuslaufen', (e) => game.emit('dauer:auslaufen', { id: e.boatId, platzId: e.berthId, tage: e.tage }));
  // Nach dem Umlegen fährt der Dauerlieger erst herein, wenn der Gast in seiner neuen Box fest ist.
  // So kreuzen sich die beiden Boote nicht in der engen Gasse vor den Boxen.
  const nachGast = new Map();   // Gast-id -> { id, platzId, zeit }
  game.on('sim:dauerEinlaufen', (e) => {
    for (const w of nachGast.values()) if (w.id === e.boatId) return;
    game.emit('dauer:einlaufen', { id: e.boatId, platzId: e.berthId });
  });
  const lassEin = (gastId) => {
    const w = nachGast.get(gastId);
    if (!w) return;
    nachGast.delete(gastId);
    clearTimeout(w.zeit);
    game.emit('dauer:einlaufen', { id: w.id, platzId: w.platzId });
  };
  game.on('boat:moored', (d = {}) => { if (nachGast.has(d.id)) lassEin(d.id); });
  game.on('sim:dauerWartet', (e) => {
    const p = dauerState(api.state).plaetze[e.berthId];
    const boot = p?.boot;
    if (boot) game.emit('dauer:einlaufen', { id: boot.id, platzId: e.berthId, warten: true, info: info(boot, e.berthId) });
    // Beim Vorspulen bliebe kaum Zeit zum Umlegen: Tempo zurück auf normal
    if ((game.speed ?? 1) > 1) game.oberflaeche?.tempo?.(1) ?? (game.speed = 1);
    zeigeWartende();
    game.emit('hinweis', { art: 'dauer-wartet', platz: e.berthId });
  });
  game.on('sim:dauerUmgelegt', (e) => {
    setTimeout(zeigeWartende, 0);
    if (!e.unterwegs) {
      // Rückfall: Ohne Meldung der 3D-Ansicht fährt der Dauerlieger nach 20 Sekunden herein
      nachGast.set(e.boatId, { id: e.dauerId, platzId: e.from, zeit: setTimeout(() => lassEin(e.boatId), 20000) });
      game.emit('boot-zugewiesen', { id: e.boatId, platz: e.berthId });
    }
    game.emit('sim:berthState', { plaetze: sim.berthStates(api.state, api.ctx) });
  });
  game.on('sim:dauerPacht', (e) => {
    if (e.saison) zeigeHinweis('Neue Saison: Pacht bezahlt', `${e.anzahl} ${e.anzahl === 1 ? 'Dauerlieger zahlt' : 'Dauerlieger zahlen'} ${euro(e.amount)} im Voraus.`, 7, 'muenze');
  });
  game.on('sim:dauerBewerber', (e) => {
    if (sim.season(api.state, api.ctx).winter) return;
    const name = e.bootsname ? `„${e.bootsname}“ (${e.name})` : e.name;
    zeigeHinweis(e.start ? 'Anfragen für Dauerplätze' : 'Neue Anfrage für einen Dauerplatz',
      e.start ? 'Einheimische fragen nach festen Plätzen. Tippe auf eine freie Box, um sie als Dauerplatz zu vermieten.'
        : `${name} sucht einen festen Platz. Tippe auf eine freie Box, um sie zu vermieten.`, e.start ? 10 : 6);
  });
  game.on('sim:dauerKuendigung', (e) => {
    if (e.von !== 'lieger') return;
    hinweisArt = null;
    zeigeHinweis('Dauerlieger verärgert', `Der Gast auf Platz ${e.berthId} wurde nicht umgelegt. Der Dauerlieger kündigt zum Saisonende.`, 9, 'warnung');
    setTimeout(zeigeWartende, 0);
  });
  game.on('sim:dauerAufgehoben', (e) => {
    if (e.grund === 'umbau') zeigeHinweis('Umbau', `Für den Dauerlieger von Platz ${e.berthId} war beim Ausbau kein passender Platz frei. Er verlässt den Hafen.`);
    else if (e.grund) zeigeHinweis('Saisonende', `Der Dauerlieger von Platz ${e.berthId} verlässt den Hafen. Der Platz ist wieder ein Gastplatz.`);
  });

  const card = document.getElementById('card');
  let offen = null;      // { art: 'platz' | 'gast', id }
  let umlegen = null;    // Gast-id, solange der Spieler einen neuen Platz wählt

  function el(tag, attrs = {}, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'onclick') n.addEventListener('click', v);
      else if (k === 'class') n.className = v;
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) n.append(c);
    return n;
  }
  const knopf = (text, fn, klasse = '', titel = null) => el('button', { type: 'button', class: `hud-btn ${klasse}`.trim(), title: titel, onclick: fn }, text);
  const kopf = (titel, unter) => el('div', { class: 'hm-karte-kopf' },
    el('div', {}, el('h2', {}, titel), unter ? el('p', { class: 'card-boatname' }, unter) : null),
    el('button', { type: 'button', class: 'hm-zu', 'aria-label': 'Schließen', title: 'Schließen', onclick: schliessen }, 'Schließen'));
  const fakten = (...li) => el('ul', { class: 'hm-fakten', 'aria-label': 'Eckdaten' }, ...li.filter(Boolean).map((t) => el('li', {}, t)));

  let leuchtet = false;
  function leuchten(ids, farbe = '#2a9d8f') { leuchtet = ids.length > 0; game.stege?.highlight?.(ids, farbe); }

  function schliessen() {
    umlegen = null;
    if (leuchtet) leuchten([]);
    if (!offen) return;
    offen = null;
    card.hidden = true;
    card.replaceChildren();
    document.body.classList.remove('card-open');
  }
  function zeige(teile) {
    card.replaceChildren(...teile.filter(Boolean));
    card.hidden = false;
    document.body.classList.add('card-open');
  }
  // Warum etwas nicht ging, in Worten (statt still nichts zu tun)
  const GRUND_VERMIETEN = {
    occupied: () => 'Der Platz ist gerade belegt.',
    reserved: () => 'Dieser Platz ist für Fischer oder Dienste reserviert.',
    noBerth: () => 'Diesen Platz gibt es in dieser Ausbaustufe nicht.',
    stage: () => `Dauerplätze gibt es ab Ausbaustufe ${R().abStufe}.`,
    keinBewerber: () => 'Dieser Bewerber passt nicht mehr an den Platz.',
    money: () => 'Dafür reicht das Geld gerade nicht.',
  };
  const grundText = (reason) => (GRUND_VERMIETEN[reason] ?? (() => 'Das geht gerade nicht.'))();
  function aktion(r) {
    api.dispatch(r.events ?? []);
    // Bei voller Obergrenze erklärt die Karte das selbst, sonst steht der Grund oben
    const text = r.ok === false && r.reason !== 'voll' ? grundText(r.reason) : '';
    // Zeigt die Platzkarte nichts mehr (zum Beispiel jetzt belegt), kommt der Grund als Hinweis oben
    if (offen?.art === 'platz' && !platzKarte(offen.id, text) && text) zeigeHinweis('Das ging nicht', text, 6, 'warnung');
  }
  const zahl = () => `Dauerplätze: ${anzahl(api.state)} von ${hoechstZahl(api.state, api.ctx)}`;
  const saisonende = () => {
    const t = tageBisSaisonende(api.state, api.ctx);
    if (sim.season(api.state, api.ctx).winter) return 'Winter';
    return t > 0 ? `Saisonende in ${t} ${t === 1 ? 'Tag' : 'Tagen'}` : 'Saisonende heute';
  };

  // Karte für einen Platz: Dauerplatz ansehen und kündigen, freien Platz vermieten, Stammgast behalten
  function platzKarte(platzId, hinweisText = '') {
    const st = api.state;
    const p = dauerState(st).plaetze[platzId];
    const k = kannDauerplatz(st, api.ctx, platzId);
    const behalten = !p && kannBehalten(st, api.ctx, platzId);
    // Volle Obergrenze: erklären statt still nichts tun (freier Platz oder Stammgast ab 5. Besuch)
    const voll = !p && ((k.reason === 'voll') || behaltenVoll(st, api.ctx, platzId));
    const niemand = !p && k.reason === 'keinBewerber';
    if (!p && !k.ok && !behalten && !voll && !niemand) { schliessen(); return false; }
    umlegen = null;
    leuchten([platzId], '#ffd23f');   // die angetippte Box
    offen = { art: 'platz', id: platzId };
    const vor = R().vorauskasse;
    const teile = [];
    if (p) {
      const boot = p.boot || st.boats[p.bootId];
      teile.push(kopf(`Dauerplatz ${platzId}`, `${bootsname(boot)} · Dauerlieger`));
      teile.push(fakten(
        boot ? `Größe ${boot.size}` : null,
        vor ? `Pacht ${euro(p.pacht)} bezahlt` : `${euro(pachtJeTag(st, api.ctx, boot))} je Abend`,
        saisonende(),
        zahl(),
      ));
      if (p.wartet) teile.push(el('p', { class: 'card-note' }, `Früher zurück und wartet vor dem Hafen. Lege den Gast ${bootsname(st.boats[p.gastId])} auf einen anderen Platz um.`));
      else if (p.boot) teile.push(el('p', { class: 'card-hint' }, `Grün: auf Törn, zurück an Tag ${p.rueckNacht + 1}. Gäste, die vorher abreisen, dürfen hier liegen. Manche Dauerlieger kommen früher.`));
      else teile.push(el('p', { class: 'card-hint' }, 'Rot: Das Boot liegt hier. Die Pacht ist sicher, auch bei Sturm. Gäste und Ruf bringt der Platz nicht.'));
      if (p.kuendigung === 'lieger') teile.push(el('p', { class: 'card-note' }, 'Der Dauerlieger hat gekündigt und verlässt den Hafen zum Saisonende.'));
      else if (p.kuendigung === 'spieler') teile.push(el('p', { class: 'card-note' }, 'Gekündigt: Zum Saisonende wird der Platz wieder ein Gastplatz.'));
      const aktionen = [];
      if (p.wartet && st.boats[p.gastId]) aktionen.push(knopf('Gast umlegen', () => { gastKarte(p.gastId); }, 'hm-primaer'));
      if (p.kuendigung === 'spieler') aktionen.push(knopf('Kündigung zurücknehmen', () => aktion(kuendige(st, platzId, false))));
      else if (!p.kuendigung) aktionen.push(knopf('Zum Saisonende kündigen', () => aktion(kuendige(st, platzId, true))));
      if (!p.wartet) {
        const kosten = sofortKosten(st, api.ctx, platzId);
        const b = knopf(`Sofort kündigen (−${euro(kosten.summe)})`, () => aktion(kuendigeSofort(st, api.ctx, platzId)), 'hm-gefahr',
          kosten.rest ? `Pacht der restlichen Tage zurück (${euro(kosten.rest)}) und ${euro(kosten.zuschlag)} Entschädigung` : `${euro(kosten.zuschlag)} Entschädigung`);
        b.disabled = st.money < kosten.summe;
        aktionen.push(b);
      }
      teile.push(el('div', { class: 'card-actions' }, ...aktionen));
    } else if (behalten) {
      const boot = st.boats[st.berths[platzId]];
      const { tage } = pachtZeitraum(st, api.ctx);
      const summe = pachtJeTag(st, api.ctx, boot) * tage;
      teile.push(kopf(`Platz ${platzId}`, `${bootsname(boot)} ist zum ${boot.besuche}. Mal hier und fragt nach einem Dauerplatz`));
      teile.push(fakten(`Größe ${boot.size}`, vor ? `Saisonpacht ${euro(summe)}` : `${euro(pachtJeTag(st, api.ctx, boot))} je Abend`, saisonende(), zahl()));
      teile.push(el('p', { class: 'card-hint' }, vor
        ? `Als Dauerlieger bleibt das Boot hier und zahlt sofort ${euro(summe)} für ${tage} Saisontage, danach jede Saison neu. Der Platz bringt dann keine Gäste und keinen Ruf mehr.`
        : `Als Dauerlieger bleibt das Boot hier und zahlt jeden Abend. Der Platz bringt dann keine Gäste und keinen Ruf mehr.`));
      teile.push(el('div', { class: 'card-actions' }, knopf(vor ? `Als Dauerlieger behalten (+${euro(summe)})` : 'Als Dauerlieger behalten', () => aktion(behalte(st, api.ctx, platzId)), 'hm-primaer')));
    } else if (voll) {
      teile.push(kopf(`Platz ${platzId}`, 'Gastplatz'));
      teile.push(fakten(zahl()));
      teile.push(el('p', { class: 'card-hint' }, `Höchstens ${Math.round(R().hoechstAnteil * 100)} Prozent der Plätze dürfen Dauerplätze sein. Mit jedem neuen Steg kommen weitere dazu, oder du kündigst einen Dauerplatz zum Saisonende.`));
    } else if (niemand) {
      const alle = dauerState(st).bewerber;
      teile.push(kopf(`Platz ${platzId}`, 'Gastplatz, frei'));
      teile.push(fakten(zahl(), `${alle.length} ${alle.length === 1 ? 'Bewerber' : 'Bewerber'}`));
      teile.push(el('p', { class: 'card-hint' }, alle.length
        ? `Kein Bewerber hat ein Boot, das in diese Box passt (${alle.map((b) => `${b.name}, Größe ${b.size}`).join('; ')}). Neue Anfragen kommen in den nächsten Tagen.`
        : 'Gerade fragt niemand nach einem Dauerplatz. Neue Anfragen kommen in den nächsten Tagen.'));
    } else {
      const liste = bewerberFuer(st, api.ctx, platzId);
      teile.push(kopf(`Platz ${platzId}`, 'Gastplatz, frei'));
      teile.push(fakten(zahl(), saisonende()));
      teile.push(el('p', { class: 'card-hint' }, vor
        ? 'Als Dauerplatz vermieten: Die Pacht für den Rest der Saison kommt sofort, danach jede Saison neu. Sicher, auch bei Sturm. Dafür keine Gäste und kein Ruf von diesem Platz.'
        : 'Als Dauerplatz vermieten: Pacht jeden Abend, sicher auch bei Sturm. Dafür keine Gäste und kein Ruf von diesem Platz.'));
      const zeilen = liste.map((b) => {
        const pa = bewerberPacht(st, api.ctx, b);
        const titel = `${b.bootsname ? `„${b.bootsname}“, ` : ''}${b.name}, Größe ${b.size}`;
        return knopf(vor ? `${titel} · +${euro(pa.summe)}` : `${titel} · ${euro(pa.jeTag)} je Abend`,
          () => aktion(machDauerplatz(st, api.ctx, platzId, b.id)), 'hm-primaer dauer-bewerber',
          `Wartet noch ${Math.max(0, b.bisTag - st.day)} Tage auf eine Antwort`);
      });
      teile.push(el('div', { class: 'card-actions dauer-liste' }, ...zeilen));
    }
    if (hinweisText) teile.splice(1, 0, el('p', { class: 'card-note' }, hinweisText));
    zeige(teile);
    return true;
  }

  // Karte für einen Gast, der vom Dauerplatz umgelegt werden muss
  function gastKarte(gastId, note = '') {
    const st = api.state;
    const gast = st.boats[gastId];
    const platzId = wartetAuf(st, gastId);
    if (!gast || !platzId) { schliessen(); return false; }
    offen = { art: 'gast', id: gastId };
    umlegen = gastId;
    const ziele = umlegeZiele(st, api.ctx, gastId);
    leuchten(ziele);
    const dauerBoot = dauerState(st).plaetze[platzId].boot;
    zeige([
      kopf(gast.name, `${bootsname(gast)} liegt auf Dauerplatz ${platzId}`),
      fakten(`Größe ${gast.size}`, `${gast.nights} ${gast.nights === 1 ? 'Nacht' : 'Nächte'}`),
      el('p', { class: 'card-hint' }, ziele.length
        ? `${bootsname(dauerBoot)} ist früher zurück. Tippe auf einen leuchtenden Platz, dort legt der Gast neu an.`
        : `${bootsname(dauerBoot)} ist früher zurück, aber gerade passt kein freier Platz. Mach einen Platz frei, sonst kündigt der Dauerlieger heute Abend.`),
      note ? el('p', { class: 'card-note', role: 'status' }, note) : null,
      el('div', { class: 'card-actions' }, knopf('Abbrechen', schliessen)),
    ]);
    return true;
  }

  game.on('tap', ({ pick } = {}) => {
    if (!pick) return;
    // Umlegen: neuen Platz wählen
    if (umlegen != null && pick.type === 'berth') {
      const r = umlege(api.state, api.ctx, umlegen, String(pick.id));
      if (r.ok) { api.dispatch(r.events); schliessen(); }
      else gastKarte(umlegen, GRUND[r.reason] ?? 'Dort geht es nicht.');
      return;
    }
    if (pick.type === 'boat') {
      const id = Number(String(pick.id).replace(/^b/, ''));
      if (wartetAuf(api.state, id)) { gastKarte(id); return; }
      if (offen && api.selected == null) schliessen();
      return;
    }
    if (pick.type !== 'berth') { if (offen && pick.type) schliessen(); return; }
    // Ist ein Boot ausgewählt, weist bridge.js zu; dann keine Platzkarte
    if (api.selected != null) return;
    platzKarte(String(pick.id));
  });
  game.on('sim:change', () => {
    if (offen?.art === 'platz') platzKarte(offen.id);
    else if (offen?.art === 'gast' && !wartetAuf(api.state, offen.id)) schliessen();
  });
  game.on('sim:select', ({ boatId }) => { if (boatId != null) { umlegen = null; offen = null; leuchtet = false; } });
  game.on('ui:cancel', schliessen);
  game.on('spielstand-geladen', () => { alteErgaenzen(); schliessen(); schlange.length = 0; hinweisArt = null; hinweis.hidden = true; setTimeout(wartendeZeigen, 300); });

  game.dauerlieger = {
    machDauerplatz: (id) => api.dispatch(machDauerplatz(api.state, api.ctx, id).events),
    kuendige: (id, an = true) => api.dispatch(kuendige(api.state, id, an).events),
    umlege: (gastId, zielId) => { const r = umlege(api.state, api.ctx, gastId, zielId); api.dispatch(r.events); return r; },
    hebeAuf: (id) => api.dispatch(hebeAuf(api.state, api.ctx, id).events),
    karte: platzKarte,
    gastKarte,
  };
}
