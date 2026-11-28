// Nordsee mit Ebbe und Flut (Roadmap P57, K2): Regeln ohne DOM und ohne Three.js, laufen auch in Node
// (tests/gezeiten.test.mjs, tools/balance.mjs --revier nordsee). Beschreibung: docs/nordsee.md
//
// Nur in einem Nordsee-Hafen (state.region 'nordsee'). Zahlen in ECONOMY.nordsee.
//
// - Wasserstand: Meter über Seekartennull (mittleres Niedrigwasser), aus der Uhrzeit im Spiel. Hochwasser
//   kommt jeden Tag rund 50 Minuten später, Spring- und Nipptide wechseln im Lauf einer Saison.
// - Zufahrt: Priel durchs Watt, ab Stufe 3 Fahrrinne und Schleuse. Ein Boot kommt nur hindurch, wenn
//   zufahrt + Wasserstand >= Tiefgang + Wasser unter dem Kiel (0,3 m). Sonst:
//     ankommend: Hook 'fit' sagt 'tide', das Boot wartet an der Boje (Geduld läuft nicht, Hook 'tick'),
//                sind alle Bojen belegt, ankert es (Hook 'hold');
//     abreisend: Hook 'departAt' verschiebt das Ablegen, bis genug Wasser da ist;
//     Tagestörn: wird ins Tidenfenster gelegt oder fällt aus (Hook 'arrivals').
// - Skipper planen: Die meisten Boote, deren Ankunft bei zu wenig Wasser läge, tauschen ihre Ankunftszeit mit
//   einem Boot, das dann hindurch kann (Hook 'arrivals'). Der Tageslauf bleibt so gleich dicht.
// - Revierfaktoren (Hook 'modifiers'): Hafengeld, Ankünfte, Bootsarten.
// - Trockenfallplätze (K4): Das Bojenfeld liegt an der Nordsee auf einer Plate im Watt (Grund nordsee.
//   trockenfallen.platte unter dem mittleren Wasser). Nur Bootsarten ohne tiefen Kiel (Grund 'kiel'), hin und
//   weg nur, wenn über der Plate genug Wasser steht (Grund 'platte', Ablegen im Fenster). Kutter und Motorboote
//   bewerten die Plate besser (Hook 'rating', boat.trocken).
// - Schleuse (Ausbau zu Stufe 3 an Küsten mit Durchstich): Das Tor öffnet im Takt (nordsee.schleuse).
//   Ankommende warten an der Boje auf die nächste Schleusung (Grund 'schleuse', Hook 'hold'), Ablegen und
//   Tagestörns werden auf die Schleusung gelegt (kommtDurch).
import * as sim from '../sim.js';
import { ECONOMY } from '../data/economy.js';
import { uhrzeitAusUhr } from '../render/landschaft/zeit.js';
import { engpassArt } from '../data/kuestennamen.js';

export const NORDSEE = ECONOMY.nordsee ?? null;
const G = NORDSEE?.gezeiten ?? null;
const TF = NORDSEE?.trockenfallen ?? null;
const SL = NORDSEE?.schleuse ?? null;

/** Hat dieser Hafen Ebbe und Flut? */
export function hatTide(state) {
  return !!G && state?.region === 'nordsee';
}

const tagLaenge = (ctx) => ctx?.rules?.dayLength ?? ECONOMY.zeit.tagSekunden;
const abendLaenge = (ctx) => ctx?.rules?.eveningLength ?? ECONOMY.zeit.abendSekunden;
const unterKiel = (ctx) => ctx?.rules?.underKeelClearance ?? ECONOMY.passregel?.wasserUnterKiel ?? 0.3;

/** Stunden seit dem Morgen des ersten Spieltags (Tag 1, 0:00), zur Spieluhr clock des Tages tag. */
export function stunden(ctx, tag, clock) {
  return (Math.max(1, tag) - 1) * 24 + uhrzeitAusUhr(Math.max(0, clock), tagLaenge(ctx), abendLaenge(ctx));
}

/** Wasserstand in Metern über Seekartennull zu einer Stunde (stunden()). */
export function wasserstandBei(h, g = G) {
  if (!g) return 0;
  const spring = 1 + g.springFaktor * Math.cos((2 * Math.PI * (h / 24)) / g.springNippTage);
  return g.hub / 2 + (g.hub / 2) * spring * Math.cos((2 * Math.PI * (h - g.hochwasserTag1)) / g.periodeStunden);
}

/** Uhr des Spiels ohne die verlängerte Nacht des Spätankömmlings (P53). */
const uhr = (state) => sim.displayClock(state);

/** Wasserstand jetzt (ohne Tide 0). */
export function wasserstand(state, ctx, clock = uhr(state), tag = state.day) {
  return hatTide(state) ? wasserstandBei(stunden(ctx, tag, clock)) : 0;
}

/** Steigt das Wasser gerade? */
export function steigt(state, ctx, clock = uhr(state), tag = state.day) {
  const h = stunden(ctx, tag, clock);
  return wasserstandBei(h + 0.05) > wasserstandBei(h);
}

/** Tiefe der Zufahrt bei Niedrigwasser in der aktuellen Stufe (Meter). */
export function zufahrtTiefe(state) {
  const z = NORDSEE?.zufahrt ?? {};
  const st = state?.stage ?? 1;
  for (let s = st; s >= 1; s--) if (z[s] != null) return z[s];
  return 0;
}

/** Wasser, das ein Boot braucht: Tiefgang plus Wasser unter dem Kiel. */
export function braucht(ctx, boat) {
  return (Number(boat?.draft) || 0) + unterKiel(ctx);
}

/** Wasserstand, ab dem dieses Boot durch die Zufahrt kommt (Meter über Seekartennull). */
export function abWasserstand(state, ctx, boat) {
  return braucht(ctx, boat) - zufahrtTiefe(state);
}

/** Größter Tiefgang, der jetzt (oder zur Uhr clock) durch die Zufahrt kommt (Meter). Ohne Tide unbegrenzt. */
export function tiefgangMoeglich(state, ctx, clock = uhr(state), tag = state.day) {
  if (!hatTide(state)) return Infinity;
  return Math.max(0, zufahrtTiefe(state) + wasserstand(state, ctx, clock, tag) - unterKiel(ctx));
}

/** Kommt dieses Boot jetzt (oder zur Uhr clock des Tages tag) durch die Zufahrt? Ohne Tide immer. */
export function zufahrtOffen(state, ctx, boat, clock = uhr(state), tag = state.day) {
  if (!hatTide(state) || !(boat?.draft > 0)) return true;
  return zufahrtTiefe(state) + wasserstand(state, ctx, clock, tag) >= braucht(ctx, boat) - 1e-9;
}

/** Liegeplatz auf der Plate im Watt (Bojenfeld an der Nordsee)? */
export function istTrocken(state, berth) {
  return !!TF && hatTide(state) && berth?.kind === 'boje';
}

/** Höhe der Plate über Seekartennull (Meter). */
export function plattenHoehe() {
  return TF && G ? G.hub / 2 - TF.platte : 0;
}

/** Darf diese Bootsart auf der Plate trockenfallen (kein tiefer Kiel)? */
export function darfTrocken(boat) {
  return !TF || (TF.arten ?? []).includes(boat?.kind);
}

/** Steht über der Plate genug Wasser für dieses Boot (andere Plätze: immer)? */
export function platzOffen(state, ctx, boat, berth, clock = uhr(state), tag = state.day) {
  if (!istTrocken(state, berth) || !(boat?.draft > 0)) return true;
  return wasserstand(state, ctx, clock, tag) - plattenHoehe() >= braucht(ctx, boat) - 1e-9;
}

/** Hat dieser Hafen eine Schleuse (Nordsee, ab Stufe 3, Küste mit Durchstich)? */
export function hatSchleuse(state) {
  return !!SL && hatTide(state) && (state.stage ?? 1) >= (SL.abStufe ?? 3) && engpassArt() === 'durchstich';
}

/** Steht das Schleusentor zur Spieluhr clock offen? Ohne Schleuse immer. */
export function schleuseOffen(state, clock = uhr(state)) {
  if (!hatSchleuse(state)) return true;
  const t = ((clock % SL.takt) + SL.takt) % SL.takt;
  return t < SL.offen;
}

/** Nächste Spieluhr ab clock, zu der das Tor offen ist. */
export function naechsteSchleusung(state, clock = uhr(state)) {
  if (schleuseOffen(state, clock)) return clock;
  return Math.ceil(clock / SL.takt) * SL.takt;
}

/** Kommt das Boot jetzt hinaus oder herein: Zufahrt, Schleuse und (liegt es auf der Plate) Wasser darüber. */
export function kommtDurch(state, ctx, boat, clock = uhr(state), tag = state.day) {
  if (!zufahrtOffen(state, ctx, boat, clock, tag)) return false;
  if (!ausgenommen(boat) && !schleuseOffen(state, clock)) return false;
  const berth = boat?.berthId != null ? ctx?.berthById?.[boat.berthId] : null;
  return platzOffen(state, ctx, boat, berth, clock, tag);
}

/** Boote, für die die Zufahrt nicht gilt: liegen fest, sind Probe, oder ein Modul führt sie selbst. */
function ausgenommen(boat) {
  return !boat || boat.probe || boat.stationed || boat.havarie || boat.jugend || boat.besucher || boat.size === 'XXL';
}

/**
 * Erste Spieluhr ab `ab` (Sekunden des Tages tag), zu der das Boot durchkommt (kommtDurch), in Schritten
 * von einer Sekunde bis `bis`. null, wenn sie bis dahin zu bleibt.
 */
export function naechstesFenster(state, ctx, boat, ab = uhr(state), bis = tagLaenge(ctx) + abendLaenge(ctx), tag = state.day) {
  if (kommtDurch(state, ctx, boat, ab, tag)) return ab;
  for (let t = Math.ceil(ab); t <= bis; t++) if (kommtDurch(state, ctx, boat, t, tag)) return t;
  return null;
}

/** Bis wann (Spieluhr) die Zufahrt ab `ab` offen bleibt (höchstens bis). */
export function fensterEnde(state, ctx, boat, ab, bis = tagLaenge(ctx) + abendLaenge(ctx), tag = state.day) {
  for (let t = Math.ceil(ab); t <= bis; t++) if (!kommtDurch(state, ctx, boat, t, tag)) return t;
  return bis;
}

/**
 * Hoch- und Niedrigwasser eines Tages zwischen Morgen und Ende des Abends: [{ art: 'hw'|'nw', clock, hoehe }].
 * Für die Anzeige (Tidenkalender) und die Tests.
 */
export function scheitel(state, ctx, tag = state.day) {
  const out = [];
  if (!hatTide(state)) return out;
  const ende = tagLaenge(ctx) + abendLaenge(ctx);
  let vor = wasserstand(state, ctx, 0, tag), jetzt = wasserstand(state, ctx, 0.5, tag);
  for (let t = 1; t <= ende; t += 0.5) {
    const nach = wasserstand(state, ctx, t, tag);
    if (jetzt >= vor && jetzt > nach) out.push({ art: 'hw', clock: t - 0.5, hoehe: jetzt });
    if (jetzt <= vor && jetzt < nach) out.push({ art: 'nw', clock: t - 0.5, hoehe: jetzt });
    vor = jetzt; jetzt = nach;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Hooks

/**
 * Hook 'fit': Ankommende Boote laufen nur ein, wenn genug Wasser in der Zufahrt ist. Auf die Plate im Watt
 * nur Boote ohne tiefen Kiel ('kiel') und nur bei genug Wasser darüber ('platte', auch beim Umlegen).
 */
export function fitTide({ state, ctx, boat, berth }) {
  // Grund 'schleuse': das Tor ist gerade zu, die nächste Schleusung kommt gleich
  if (!hatTide(state) || ausgenommen(boat)) return null;
  if (istTrocken(state, berth)) {
    if (!darfTrocken(boat)) return 'kiel';
    if (!platzOffen(state, ctx, boat, berth)) return 'platte';
  }
  if (boat.status === 'moored') return null;
  if (!zufahrtOffen(state, ctx, boat)) return 'tide';
  return schleuseOffen(state) ? null : 'schleuse';
}

/** Hook 'hold': Dieses ankommende Boot (oder ein Dauerlieger auf dem Rückweg) wartet auf die Flut. */
export function wartetAufFlut({ state, ctx, boat }) {
  // Dauerlieger (stationed) auf Törn draußen (status 'away') kommen auch nur bei genug Wasser zurück
  const draussen = boat?.stationed && boat.status === 'away' && !boat.havarie && boat.size !== 'XXL';
  if (!hatTide(state) || (ausgenommen(boat) && !draussen) || boat.status === 'moored') return false;
  return !zufahrtOffen(state, ctx, boat) || !schleuseOffen(state);
}

/**
 * Hook 'tick': Wer an der Boje auf die Flut wartet, verliert keine Geduld (sie beginnt neu, sobald die Zufahrt
 * offen ist) und ist als wartend markiert (boat.flut = Spieluhr, ab der es einlaufen kann, für Karte und Anzeige).
 */
export function flutTick({ state, ctx }) {
  if (!hatTide(state)) return;
  // Auf der Plate gelegen (für die Bewertung, Hook 'rating')
  if (TF) for (const [bid, id] of Object.entries(state.berths)) {
    const b = state.boats[id];
    if (b && !b.trocken && istTrocken(state, ctx.berthById[bid])) b.trocken = true;
  }
  for (const id of state.queue) {
    const b = state.boats[id];
    if (!b || ausgenommen(b)) continue;
    if (zufahrtOffen(state, ctx, b)) {
      if (b.flut != null) delete b.flut;
      continue;
    }
    const ab = naechstesFenster(state, ctx, b);
    b.flut = ab ?? -1;
    if (b.atBuoy && b.atBuoySince != null) b.atBuoySince = Math.max(b.atBuoySince, state.clock);
  }
}

/**
 * Hook 'departAt': Ablegen erst, wenn das Boot durch die Zufahrt kommt. Liegt das nächste Fenster nach dem
 * Tag, legt es zum höchsten Wasser des Tages ab (spätestens kurz vor Abend), damit keine Box über Nacht hängt.
 */
export function ablegenBeiFlut({ state, ctx, boat, at, tag }) {
  if (!hatTide(state) || ausgenommen(boat)) return at;
  // kommtDurch prüft Zufahrt und Plate (liegt das Boot im Watt, braucht es dort genug Wasser)
  const spaet = tagLaenge(ctx) * 0.95;
  const t = naechstesFenster(state, ctx, boat, Math.max(0, at), spaet, tag);
  if (t != null) return t;
  // Kein Fenster bis zum Abend: zum höchsten Wasser zwischen at und spaet
  let best = at, hoch = -Infinity;
  for (let c = Math.ceil(at); c <= spaet; c++) {
    const w = wasserstand(state, ctx, c, tag);
    if (w > hoch) { hoch = w; best = c; }
  }
  return best;
}

/** Kleiner Zufall je Boot und Tag ohne den Zufallsstrom des Spiels (keine Verschiebung in der Ostsee). */
function zufall01(state, a, b) {
  let h = ((state.seed ?? 1) >>> 0) ^ Math.imul((state.day ?? 1) + 13, 0x9e3779b1) ^ Math.imul((Number(a) || 0) + 101, 0x85ebca6b) ^ Math.imul(b + 7, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * Hook 'arrivals': Skipper planen mit dem Tidenkalender. Ein Boot, das bei zu wenig Wasser ankäme, tauscht
 * (mit Anteil planen) seine Ankunft mit einem Boot, das dann hindurch kann und dessen Zeit im eigenen
 * Fenster liegt. Tagestörns liegen danach im Tidenfenster oder fallen aus.
 */
export function planeAnkuenfte({ state, ctx, list }) {
  if (!hatTide(state)) return;
  const planen = NORDSEE.planen ?? 0;
  const offen = (b, t) => ausgenommen(b) || zufahrtOffen(state, ctx, b, t);
  const frei = (b) => !b.flotte && b.spaet !== state.day && !ausgenommen(b);
  // Das erste Boot des ersten Tages bleibt, wo es ist (es kommt gleich, damit niemand auf leeres Wasser schaut)
  const fest = state.day === 1 && list.length ? list[0] : null;
  for (const b of list) {
    if (b === fest || !frei(b) || offen(b, b.arriveAt)) continue;
    if (zufall01(state, b.id, 1) >= planen) continue;
    let tausch = null, abstand = Infinity;
    for (const x of list) {
      if (x === b || x === fest || !frei(x)) continue;
      if (!offen(b, x.arriveAt) || !offen(x, b.arriveAt)) continue;
      const d = Math.abs(x.arriveAt - b.arriveAt);
      if (d < abstand) { abstand = d; tausch = x; }
    }
    if (tausch) [b.arriveAt, tausch.arriveAt] = [tausch.arriveAt, b.arriveAt];
  }
  list.sort((p, q) => p.arriveAt - q.arriveAt);
  // Tagestörns (planTrips lief vorher): hinaus und zurück im Tidenfenster, sonst bleibt das Boot heute im Hafen
  for (const boat of Object.values(state.boats)) {
    const t = boat.trip;
    if (!t || t.away || boat.status !== 'moored' || ausgenommen(boat)) continue;
    if (kommtDurch(state, ctx, boat, t.out) && kommtDurch(state, ctx, boat, t.back)) continue;
    const raus = naechstesFenster(state, ctx, boat, t.out, tagLaenge(ctx) * 0.6);
    const ende = raus != null ? fensterEnde(state, ctx, boat, raus, tagLaenge(ctx) * 0.95) : null;
    // mindestens ein Viertel Tag draußen, zurück im selben oder im nächsten Fenster
    const min = tagLaenge(ctx) * 0.25;
    let zurueck = null;
    if (raus != null) {
      const ab = Math.max(t.back, raus + min);
      zurueck = ab <= ende ? ab : naechstesFenster(state, ctx, boat, ab, tagLaenge(ctx) * 0.95);
    }
    if (raus == null || zurueck == null) boat.trip = null;
    else { t.out = raus; t.back = zurueck; t.tide = true; }
  }
}

/** Hook 'modifiers': Revierfaktoren der Nordsee. */
export function revierFaktoren(state) {
  if (!hatTide(state)) return null;
  return {
    priceFactor: NORDSEE.hafengeld ?? 1,
    arrivalFactor: NORDSEE.ankuenfte ?? 1,
    kindFactor: { ...(NORDSEE.arten ?? {}) },
  };
}

/** Hook 'rating': Kutter (und Motorboote) liegen gern auf der Plate, wie zu Hause. */
export function bonusTrocken(boat) {
  return boat?.trocken ? TF?.bonus?.[boat.kind] ?? 0 : 0;
}

/**
 * Hooks in einen Regel-Kontext hängen (Browser über api.addHook, Werkzeuge über sim.addHook).
 * zustand() liefert den Spielstand (die Modifikatoren bekommen ihn als erstes Argument).
 * Als Letztes einhängen: 'arrivals' muss nach den Bootsgeschichten laufen, die Zeiten tauschen.
 */
export function haengeEin(addHook) {
  if (!NORDSEE) return () => {};
  const ab = [
    addHook('fit', fitTide),
    addHook('hold', wartetAufFlut),
    addHook('tick', flutTick),
    addHook('departAt', ablegenBeiFlut),
    addHook('arrivals', planeAnkuenfte),
    addHook('modifiers', (state) => revierFaktoren(state)),
    addHook('rating', ({ boat }) => bonusTrocken(boat)),
  ];
  return () => ab.forEach((f) => f?.());
}
