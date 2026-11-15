// Wo ein Boot an seinem Liegeplatz genau liegt (Liegeplätze passgenau, Härtetest 15.11.2026).
//
// harbor.js zeichnet jeden Platz für ein typisches Boot seiner Klasse. Echte Boote sind oft länger oder
// breiter (Box L ist 12,4 m lang, Boote bis 14 m; ein Stirnplatz ist für 2,6 m Breite gezeichnet, ein
// Katamaran ist 7,5 m breit). Damit ein Boot nie im Steg, auf dem Nachbarn oder an Land liegt:
//
//   Box und Finger: Bug mit 0,3 m Luft vor dem stegseitigen Ende der Box. Ein längeres Boot ragt achtern
//     über die Heckpfähle hinaus (wie im echten Hafen), nie vorn in den Steg.
//   Längsseits (Stirnplatz, Kai, Fischer, Pier, Yachtsteg): Bordwand mit Fender (0,3 m) an der Stegkante,
//     an Kai und Pier (die Linie dort ist nur ungefähr die Kante) wie das gezeichnete Boot. Ein breites
//     Boot liegt weiter draußen. Entlang des Stegs hat jeder Platz seinen Abschnitt: bis zur Mitte zum
//     Nachbarn am selben Steg, an einem freien Stegende (Stegkopf, nicht Kai, Pier oder Wurzel am Ufer)
//     bis 4 m darüber hinaus. Darin liegt das Boot so nah an der gezeichneten Mitte wie möglich.
//     Ist ein Boot länger als sein Abschnitt (nur an Kai und Yachtsteg möglich), nimmt es Platz vom
//     Nachbarn: Es liegt dann so nah an der Mitte, wie die Steglinie erlaubt, und die Spielregeln lassen
//     es nur zu, wenn das Boot am Nachbarplatz nicht im Weg ist (nachbarFrei).
//   Was trotz allem an einen festen Teil stößt (die letzte Box vor einem Stegkopf, die Seebrücke), wird
//     über platzGrenze für zu große Boote gesperrt: Die Passregel (sim.js whyNotFit) nimmt dann die
//     Länge, die wirklich passt.
//
// Reine Daten und Rechnung ohne three.js: Spielregeln (sim.js), Bootsanimation (render/boat-anim.js
// finalPose) und Prüfung (tools/liegeplaetze/pruefen.mjs, tests/liegeplaetze.test.mjs) rechnen dasselbe.
// Alle Lagen in Planeinheiten (x Osten, y Norden), Maße der Boote in Metern.
//
//   liegeGeometrie(hafen, stufe)              Map platzId -> Geometrie, zwischengespeichert
//   liegeVersatz(geo, laengeM, breiteM)       { a, q, eigen } Versatz der Bootsmitte: a entlang der
//                                             Bugrichtung, q nach links; eigen: im eigenen Abschnitt
//   liegeRumpf(geo, laengeM, breiteM)         Rumpf als Rechteck (vier Ecken)
//   stegTeile(hafen, stufe)                   Stege, Heckpfähle, Dienstplätze, festes Gerät als Polygone
//   platzGrenzen(hafen, stufe, plaetze)       Map platzId -> { laenge } größte Länge ohne Anstoßen
//   nachbarFrei(geoMap, id, boot, belegt)     stößt ein Boot an id an die Boote, die an belegt liegen?

export const U = 0.62;            // Meter je Planeinheit (wie harbor.js und main.js)
export const LUFT_M = 0.3;        // Fender zwischen Bordwand und Steg, Bug und Steg
export const ABSTAND_M = 1.0;     // zwischen zwei Booten längsseits am selben Steg
export const UEBERHANG_M = 4;     // so weit darf ein Längsseitslieger über ein freies Stegende ragen
export const PFAHL_M = 0.15;
export const WURZEL_M = 5;        // so weit liegt die Wurzel eines Stegs, der vom Ufer kommt, über Land      // Halbmesser eines Heckpfahls (render/stege.js dalbeGeo, abgerundet)

const RAD = Math.PI / 180;
export const BOX_ARTEN = new Set(['box', 'finger']);

const cache = new WeakMap();
const lageIn = (p, stufe) => p.lage?.[stufe] ?? p.lage?.[String(stufe)] ?? null;

// ------------------------------------------------------------------------------- kleine Geometrie
/** Rechteck als Polygon: Mitte c, Längsachse u (Einheitsvektor), halbe Länge hl, halbe Breite hb. */
export function rechteck(c, u, hl, hb) {
  const n = [-u[1], u[0]];
  return [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([s, t]) => [c[0] + u[0] * hl * s + n[0] * hb * t, c[1] + u[1] * hl * s + n[1] * hb * t]);
}

/** Rechteck um die Strecke a-b, halbe Breite hb, an beiden Enden um verl verlängert. */
export function strecke(a, b, hb, verl = 0) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-6;
  const u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
  return rechteck([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], u, L / 2 + verl, hb);
}

export function kreis(c, r, n = 8) {
  const p = [];
  for (let i = 0; i < n; i++) p.push([c[0] + Math.cos((i / n) * 2 * Math.PI) * r, c[1] + Math.sin((i / n) * 2 * Math.PI) * r]);
  return p;
}

function projiziere(poly, ax) {
  let lo = Infinity, hi = -Infinity;
  for (const p of poly) { const v = p[0] * ax[0] + p[1] * ax[1]; if (v < lo) lo = v; if (v > hi) hi = v; }
  return [lo, hi];
}

/** Schneiden sich zwei konvexe Polygone? (Trennachsen, Berühren zählt nicht) */
export function schneiden(a, b) {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      const ax = [-(q[1] - p[1]), q[0] - p[0]];
      const [a0, a1] = projiziere(a, ax), [b0, b1] = projiziere(b, ax);
      if (a1 <= b0 + 1e-9 || b1 <= a0 + 1e-9) return false;
    }
  }
  return true;
}

// Nächster Punkt auf den Steglinien
function naechstesSegment(linien, x, y) {
  let best = null;
  for (const l of linien) {
    const pts = l.punkte ?? [];
    for (let i = 0; i + 1 < pts.length; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-9;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2));
      const cx = ax + dx * t, cy = ay + dy * t, d = Math.hypot(x - cx, y - cy);
      if (!best || d < best.d) best = { d, cx, cy, a: [ax, ay], b: [bx, by], i, linie: l };
    }
  }
  return best;
}

function abstandZurLinie(pts, x, y) {
  return naechstesSegment([{ punkte: pts }], x, y)?.d ?? Infinity;
}

// Ist ein Endpunkt einer Steglinie frei (Wasser rundherum)? Angebunden ist er am Ufer (Wurzel: erster
// Punkt, außer bei einem Stegkopf) oder wo eine andere Linie desselben Stegs ansetzt.
function endeFrei(linie, linien, i) {
  const p = linie.punkte[i];
  const andere = linien.filter((m) => m !== linie && m.steg === linie.steg);
  if (andere.some((m) => abstandZurLinie(m.punkte, p[0], p[1]) < 2)) return false;
  if (i > 0) return true;
  // Erster Punkt: frei nur bei einem Stegkopf (eine andere Linie desselben Stegs endet in seiner Mitte)
  return andere.some((m) => m.punkte.some((q) => abstandZurLinie(linie.punkte, q[0], q[1]) < 2));
}

// Beginnt die Linie an einer anderen Linie desselben Stegs (Abzweig) statt am Ufer?
function andererStegAm(linie, linien) {
  const p = linie.punkte[0];
  return linien.some((m) => m !== linie && m.steg === linie.steg && abstandZurLinie(m.punkte, p[0], p[1]) < 2);
}

// ------------------------------------------------------------------------------- Geometrie je Platz
/**
 * Geometrie aller Plätze einer Stufe. Je Platz:
 *   { id, art, steg, c: [x, y], u: Bugrichtung, n: links davon, laenge, breite,
 *     box: true                     bei Box und Finger, sonst
 *     seite: +1 | -1                Steg links (+1) oder rechts (-1) vom Boot
 *     innen                         Abstand Platzmitte bis Bordwand auf der Stegseite
 *     lo, hi                        eigener Abschnitt entlang u (relativ zur Platzmitte)
 *     linieLo, linieHi              ganze Steglinie entlang u, mit Überhang an freien Enden
 *     nachbarn: [ids] }
 * Zwischengespeichert je hafen-Objekt, Stegbild und Stufe.
 */
export function liegeGeometrie(hafen, stufe) {
  const key = `${hafen?.stegbild?.nr ?? 0}|${stufe}|${hafen?.plaetze?.length ?? 0}`;
  let m = cache.get(hafen);
  if (!m) { m = new Map(); cache.set(hafen, m); }
  if (m.has(key)) return m.get(key);
  const st = hafen?.stufen?.[stufe] ?? hafen?.stufen?.[String(stufe)];
  const linien = st?.stege ?? [];
  const luft = LUFT_M / U;
  const out = new Map();
  for (const p of hafen?.plaetze ?? []) {
    const l = lageIn(p, stufe);
    if (!l) continue;
    const u = [Math.cos(l[2] * RAD), Math.sin(l[2] * RAD)];
    const g = { id: p.id, art: p.art, steg: p.steg, c: [l[0], l[1]], u, n: [-u[1], u[0]], laenge: p.laenge, breite: p.breite,
      doppel: p.doppel ?? null, ohne: p.ohne ?? null, requires: p.requires ?? null };
    out.set(p.id, g);
    if (BOX_ARTEN.has(p.art)) { g.box = true; continue; }
    // Ohne eigene Steglinie (Seenotretter an der Mole, Dienste): wie gezeichnet, kein Versatz
    const eigene = linien.filter((s) => s.steg === p.steg);
    const s = naechstesSegment(eigene, l[0], l[1]);
    if (!s) { g.wieGezeichnet = true; g.nachbarn = []; continue; }
    const wx = s.cx - l[0], wy = s.cy - l[1];
    g.seite = wx * g.n[0] + wy * g.n[1] >= 0 ? 1 : -1;
    const fest = s.linie.bauart === 'kai' || s.linie.bauart === 'pier';
    const kante = Math.abs(wx * g.n[0] + wy * g.n[1]) - (s.linie.breite ?? 0) / 2;
    // Holz- und Schwimmstege: Fender an der Kante. Kai und Pier: wie gezeichnet (die Kaikante der
    // Zeichnung liegt nicht überall genau an der Mauer), aber nie näher als der Fender.
    g.innen = fest ? Math.min(p.breite / 2, kante - luft) : kante - luft;
    // Steglinie entlang u (das Segment, an dem das Boot liegt), freie Enden mit Überhang
    const ea = (s.a[0] - l[0]) * u[0] + (s.a[1] - l[1]) * u[1];
    const eb = (s.b[0] - l[0]) * u[0] + (s.b[1] - l[1]) * u[1];
    // Freies Ende: bis UEBERHANG_M darüber hinaus. Kai und Pier enden an Mauer oder Mole: 1 m Abstand.
    // Wurzel am Ufer (erster Punkt, kein Stegkopf): sie liegt bis WURZEL_M weit an Land.
    const n = s.linie.punkte.length;
    const ende = (i) => {
      if (fest) return -1 / U;
      if (endeFrei(s.linie, linien, i)) return UEBERHANG_M / U;
      return i === 0 && !andererStegAm(s.linie, linien) ? -WURZEL_M / U : 0;
    };
    const freiA = s.i === 0 ? ende(0) : 0;
    const freiB = s.i + 2 === n ? ende(n - 1) : 0;
    g.linieLo = ea < eb ? ea - freiA : eb - freiB;
    g.linieHi = ea < eb ? eb + freiB : ea + freiA;
    g.linie = s.linie;
    g.lo = g.linieLo; g.hi = g.linieHi;
  }
  // Nachbarn längsseits an derselben Steglinie und Seite: eigener Abschnitt bis zur Mitte zwischen den Booten
  const halbAbstand = ABSTAND_M / U / 2;
  for (const g of out.values()) {
    if (g.box || g.wieGezeichnet) continue;
    g.nachbarn = [];
    for (const h of out.values()) {
      if (h === g || h.box || h.wieGezeichnet || h.linie !== g.linie || h.seite !== g.seite) continue;
      if (Math.abs(g.u[0] * h.u[0] + g.u[1] * h.u[1]) < 0.94) continue;           // nicht parallel
      const a = (h.c[0] - g.c[0]) * g.u[0] + (h.c[1] - g.c[1]) * g.u[1];
      if (Math.abs(a) < 1e-6) continue;
      g.nachbarn.push(h.id);
      // Grenze: Mitte zwischen den gezeichneten Enden (überlappen sie, die Mitte zwischen den Mitten)
      const meinEnde = g.laenge / 2, seinEnde = Math.abs(a) - h.laenge / 2;
      const grenze = seinEnde > meinEnde ? (meinEnde + seinEnde) / 2 : Math.abs(a) / 2;
      if (a > 0) g.hi = Math.min(g.hi, grenze - halbAbstand);
      else g.lo = Math.max(g.lo, -grenze + halbAbstand);
    }
  }
  m.set(key, out);
  return out;
}

/**
 * Versatz der Bootsmitte gegenüber der Platzmitte (Planeinheiten): a entlang der Bugrichtung, q nach links.
 * eigen = false: das Boot ist länger als sein Abschnitt und braucht Platz vom Nachbarn (nachbarFrei).
 */
export function liegeVersatz(geo, laengeM, breiteM) {
  if (!geo || geo.wieGezeichnet) return { a: 0, q: 0, eigen: true };
  const L = laengeM / U, B = breiteM / U, luft = LUFT_M / U;
  // Bug mit Luft vor dem stegseitigen Ende der Box; längere Boote ragen achtern hinaus
  if (geo.box) return { a: geo.laenge / 2 - L / 2 - luft, q: 0, eigen: true };
  const q = geo.seite * (geo.innen - B / 2);
  const naheMitte = (lo, hi) => Math.min(Math.max(0, lo + L / 2), hi - L / 2);
  if (L <= geo.hi - geo.lo + 1e-9) return { a: naheMitte(geo.lo, geo.hi), q, eigen: true };
  if (L <= geo.linieHi - geo.linieLo + 1e-9) return { a: naheMitte(geo.linieLo, geo.linieHi), q, eigen: false };
  return { a: (geo.linieLo + geo.linieHi) / 2, q, eigen: false };
}

/** Rumpf als Rechteck (vier Ecken, Planeinheiten), so wie das Boot am Platz liegt. */
export function liegeRumpf(geo, laengeM, breiteM, rand = 0) {
  const v = liegeVersatz(geo, laengeM, breiteM);
  const c = [geo.c[0] + geo.u[0] * v.a + geo.n[0] * v.q, geo.c[1] + geo.u[1] * v.a + geo.n[1] * v.q];
  return rechteck(c, geo.u, laengeM / U / 2 + rand, breiteM / U / 2 + rand);
}

// ------------------------------------------------------------------------------- feste Teile
// Festes Gerät im Wasser je Stufe (wie tools/stegbilder/pruefen.mjs festeHindernisse, nur Gegenstände)
function festesGeraet(stufe) {
  const rand = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const h = [];
  if (stufe >= 2) h.push({ name: 'Slip', poly: rand(-131, -16, -123, 24) });
  if (stufe >= 3) h.push({ name: 'Mastenkran', poly: rand(62, 4, 78, 22) });
  if (stufe >= 4) h.push({ name: 'Travellift', poly: rand(143, 4, 169, 31) });
  return h;
}

/**
 * Stege, Heckpfähle, Dienstplätze und festes Gerät einer Stufe: [{ name, poly, platz? }].
 * Kaikanten fehlen (dahinter ist Land, das prüft der Landtest der Werkzeuge).
 */
export function stegTeile(hafen, stufe) {
  const st = hafen?.stufen?.[stufe] ?? hafen?.stufen?.[String(stufe)];
  const teile = [];
  for (const l of st?.stege ?? []) {
    if (!(l.breite > 0)) continue;
    // wie render/stege.js segment(): Länge plus eine viertel Breite an jedem Ende
    for (let i = 0; i + 1 < l.punkte.length; i++) teile.push({ name: `Steg ${l.steg ?? l.bauart}`, poly: strecke(l.punkte[i], l.punkte[i + 1], l.breite / 2, l.breite / 4) });
  }
  for (const d of st?.dienste ?? []) {
    const u = [Math.cos((d.richtung ?? 0) * RAD), Math.sin((d.richtung ?? 0) * RAD)];
    teile.push({ name: `Dienstplatz ${d.art}`, poly: rechteck([d.x, d.y], u, d.laenge / 2, d.breite / 2) });
  }
  // Heckpfähle (render/stege.js: 0,3 m vor dem seeseitigen Ende der Box, links und rechts)
  for (const g of liegeGeometrie(hafen, stufe).values()) {
    if (g.art !== 'box') continue;
    for (const s of [0.5, -0.5]) {
      const k = g.laenge / 2 - 0.3 / U;
      teile.push({ name: `Heckpfahl ${g.id}`, platz: g.id, poly: kreis([g.c[0] - g.u[0] * k + g.n[0] * g.breite * s, g.c[1] - g.u[1] * k + g.n[1] * g.breite * s], PFAHL_M / U) });
    }
  }
  for (const f of festesGeraet(stufe)) teile.push(f);
  return teile;
}

/** Gibt es die Plätze a und b in einem Spiel gleichzeitig? (Doppelbox und ihre Einzelboxen nie) */
export function zugleich(a, b) {
  if (!a || !b) return true;
  const ka = a.requires?.startsWith?.('doppel:') ? a.requires : null;
  const kb = b.requires?.startsWith?.('doppel:') ? b.requires : null;
  if (ka && b.ohne?.includes(ka)) return false;
  if (kb && a.ohne?.includes(kb)) return false;
  return true;
}

function teilImWeg(geo, t) {
  if (t.platz === geo.id) return false;
  // Heckpfähle einer Box, die es neben diesem Platz nicht gibt (Doppelbox gegen ihre Einzelboxen)
  if (t.platz && (geo.doppel?.includes(t.platz) || (t.doppel && t.doppel.includes(geo.id)))) return false;
  return true;
}

/**
 * Größte Länge (Meter) je Platz einer Stufe, mit der das Boot an keinen Steg, Pfahl, Dienstplatz und kein
 * festes Gerät stößt: Map platzId -> { laenge }. Nur Plätze mit einer Grenze unter maxLaenge stehen drin.
 * Gerechnet mit der größten erlaubten Breite des Platzes (maxBreite), Schritte von 0,25 m.
 */
export function platzGrenzen(hafen, stufe) {
  const key = `grenzen|${hafen?.stegbild?.nr ?? 0}|${stufe}|${hafen?.plaetze?.length ?? 0}`;
  let m = cache.get(hafen);
  if (!m) { m = new Map(); cache.set(hafen, m); }
  if (m.has(key)) return m.get(key);
  const geo = liegeGeometrie(hafen, stufe);
  const plaetze = new Map((hafen?.plaetze ?? []).map((p) => [p.id, p]));
  const teile = stegTeile(hafen, stufe).map((t) => ({ ...t, doppel: t.platz ? plaetze.get(t.platz)?.doppel : null }));
  const out = new Map();
  for (const g of geo.values()) {
    const p = plaetze.get(g.id);
    if (!p?.maxLaenge || !p?.maxBreite) continue;
    const imWeg = teile.filter((t) => teilImWeg(g, t) && zugleich(p, plaetze.get(t.platz)));
    const frei = (L) => { const r = liegeRumpf(g, L, p.maxBreite); return !imWeg.some((t) => schneiden(r, t.poly)); };
    if (frei(p.maxLaenge)) continue;
    let L = p.maxLaenge;
    while (L > 0 && !frei(L)) L -= 0.25;
    out.set(g.id, { laenge: Math.max(0, L) });
  }
  m.set(key, out);
  return out;
}

/**
 * Stößt ein Boot { length, beam } (Meter) am Platz id an die Boote an den belegten Plätzen?
 * belegt: Map platzId -> { length, beam }. Nur wenn eins der Boote länger als sein Abschnitt ist, kann
 * das passieren; sonst ist die Antwort immer true.
 */
export function nachbarFrei(geoMap, id, boot, belegt) {
  const g = geoMap?.get(id);
  if (!g || g.box) return true;
  const ich = liegeVersatz(g, boot.length, boot.beam);
  const r = liegeRumpf(g, boot.length, boot.beam, ABSTAND_M / U / 2 - 1e-6);
  for (const nid of g.nachbarn ?? []) {
    const o = belegt.get(nid);
    if (!o) continue;
    const h = geoMap.get(nid);
    if (ich.eigen && liegeVersatz(h, o.length, o.beam).eigen) continue;      // beide im eigenen Abschnitt
    if (schneiden(r, liegeRumpf(h, o.length, o.beam, ABSTAND_M / U / 2 - 1e-6))) return false;
  }
  return true;
}
