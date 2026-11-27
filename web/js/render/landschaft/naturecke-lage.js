// Naturecke am Schilf (Roadmap P52, F39): wo der Schilfgürtel neben dem Hafen steht. Beschreibung: docs/naturecke.md.
//
// naturLage(region) sucht je Küste, Seed, Revier und Stegbild eine flache Uferstelle nahe den Stegen, an der in
// jeder Ausbaustufe 1 bis 6 Schilf wachsen kann:
// - Wasser zwischen 3 cm und 1,3 m tief (Schilf steht im flachen Saum vor dem Land), Land gleich dahinter,
// - außerhalb der Hafenfläche (dort baut der Hafen bis Stufe 6), nicht in der Einfahrt oder im Außenhafen,
// - weit genug weg von Stegen, Liegeplätzen, Diensten, Molen, Wartebojen, Ankerfeld, Pricken, Bojenfeld,
//   Seebrücke, Strandkörben, dem Weg zum Seegatt, der Runde der Freizeitboote und dem Uferstreifen des Paddlers,
// - an Land nicht auf einem Bauplatz der Angebote (Räucherei, Segelclub ...).
// Unter den Stellen, an denen genug Schilf Platz hat, gewinnt die, die den Stegen am nächsten liegt.
//
// Ergebnis (Planeinheiten) oder null ohne Platz:
// { mitte: [px, py], ufer: [px, py] (Land, wo der Bohlenweg beginnt), richtung: [nx, ny] (vom Ufer ins Wasser),
//   schilf: [[px, py, tiefe], ...], flaeche: { mitte, achse, laenge, breite } (Rechteck für den Parkplatz,
//   achse = Richtung entlang des Ufers), weg: [[px, py], [px, py]] (Bohlenweg vom Ufer zur Beobachtungshütte) }
// Ohne three.js, damit Tests, Hafentiere und Jugendtraining fragen können.

import { punkt, hafenAbstand, warteplaetze, molen, pricken, PLAN_M, SCHWIMMWELLENBRECHER } from './gelaende.js';
import { gelaendeform, beiFormwechsel, spielRect } from './formen.js';
import { region as regionNach } from './regionen.js';
import { strandLagen, seebrueckeStrecke } from './strand.js';
import { bojenfeldLage } from './bojenfeld-lage.js';
import { freiAbstand } from './vielfalt.js';
import { SEE_RUNDE, UFER } from '../../data/verkehr.js';
import { HAFEN } from '../../data/harbor.js';
import { SERVICES } from '../../data/services.js';

export const STUFEN = [1, 2, 3, 4, 5, 6];
// Maße in Planeinheiten (1 = 0,62 m)
export const MASS = {
  raster: 2.5,          // Abstand der Prüfpunkte im Schilf
  radius: 27,           // Schilf um die Mitte (rund 17 m)
  minPunkte: 55,        // so viele Schilfpunkte mindestens (rund 210 m²)
  tiefe: [0.03, 1.3],   // Wassertiefe in Metern, in der Schilf wächst
  uferNah: 10,          // Land höchstens so weit von der Mitte
  suche: { x0: -420, x1: 430, y0: -80, y1: 195, schritt: 6 },   // südlich von y -80: Landstraße, Häuserzeile, Dorf
  hafenAbstand: 8,      // außerhalb der Hafenfläche (Stufe 6)
};
// Abstände zu allem, was schon da ist (Planeinheiten); zweite und dritte Zeile, wenn sonst nichts passt
const ABSTAENDE = [
  { steg: 14, platz: 12, korridor: 12, boje: 24, anker: 16, prick: 12, ufer: 14, runde: 14, bojenfeld: 26, strand: 16, service: 8 },
  { steg: 10, platz: 9, korridor: 8, boje: 18, anker: 10, prick: 8, ufer: 10, runde: 10, bojenfeld: 20, strand: 12, service: 5 },
];

const _cache = new Map();
beiFormwechsel(() => _cache.clear());

function abstandStrecke(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
function abstandLinie(px, py, punkte) {
  if (punkte.length === 1) return Math.hypot(px - punkte[0][0], py - punkte[0][1]);
  let d = Infinity;
  for (let i = 1; i < punkte.length; i++) d = Math.min(d, abstandStrecke(px, py, punkte[i - 1], punkte[i]));
  return d;
}


// Strandsachen (strand.js) je Stufe kosten einmal rund 0,2 s. Stufe 1 liegt auf allen 15 Küsten (Seeds 1, 2)
// wie 2, 3 oder 6, Stufe 5 wie 4 (gemessen 22.11.); darum nur diese vier.
const STRAND_STUFEN = [2, 3, 4, 6];

/** Alles, wovon das Schilf Abstand hält (für Tests offen gelegt). a: Zeile aus ABSTAENDE. */
export function hindernisse(region, a = ABSTAENDE[0]) {
  return bisZumEnde(hindernisseSchritte(region, a));
}
function* hindernisseSchritte(region, a) {
  const reg = typeof region === 'string' ? regionNach(region) : (region ?? regionNach('ostsee'));
  const linien = [];   // { punkte, rand }
  const kreise = [];   // [px, py, r]
  for (const s of STUFEN) {
    yield;
    const st = HAFEN.stufen[String(s)];
    for (const l of st?.stege ?? []) linien.push({ punkte: l.punkte, rand: (l.breite ?? 3) / 2 + a.steg });
    for (const d of st?.dienste ?? []) kreise.push([d.x, d.y, Math.max(d.laenge ?? 0, d.breite ?? 0) / 2 + a.steg]);
    if (s >= 3) for (const m of molen(s)) linien.push({ punkte: m.punkte, rand: m.breite / 2 + a.steg });
    const w = warteplaetze(s, reg);
    for (const b of w.bojen) kreise.push([b.px, b.py, a.boje]);
    for (const k of w.ankerbereiche) kreise.push([k.px, k.py, k.radius + a.anker]);
    for (const [x, y] of pricken(s)) kreise.push([x, y, a.prick]);
    if (!STRAND_STUFEN.includes(s)) continue;
    yield;
    const sb = seebrueckeStrecke(s, reg.id ?? 'ostsee');
    if (sb) linien.push({ punkte: [sb.fuss, sb.kopf], rand: sb.breite / 2 + a.strand });
    for (const [id, l] of Object.entries(strandLagen(s, reg.id ?? 'ostsee'))) if (l && id !== 'seebruecke') kreise.push([l[0], l[1], a.strand]);
  }
  yield;
  linien.push({ punkte: SCHWIMMWELLENBRECHER.punkte, rand: SCHWIMMWELLENBRECHER.breite / 2 + a.steg });
  const gesehen = new Set();
  for (const p of HAFEN.plaetze) {
    if (p.art === 'boje') continue;
    for (const s of STUFEN) {
      const l = p.lage?.[String(s)];
      if (!l) continue;
      const key = `${l[0]}|${l[1]}|${l[2]}|${p.laenge}`;
      if (gesehen.has(key)) continue;
      gesehen.add(key);
      const w = (l[2] * Math.PI) / 180, hl = (p.laenge ?? 10) / 2;
      const ux = Math.cos(w) * hl, uy = Math.sin(w) * hl;
      linien.push({ punkte: [[l[0] - ux, l[1] - uy], [l[0] + ux, l[1] + uy]], rand: (p.breite ?? 5) / 2 + a.platz });
    }
  }
  // Weg der Boote von der Stegfront zum Seegatt und von dort in die offene See
  const N = gelaendeform().natur;
  const route = N?.route;
  const rp = route?.punkte ?? [[40, 140], [150, 172], [178, 200]];
  linien.push({ punkte: rp, rand: (route?.halb ?? 24) + a.korridor });
  for (const s of STUFEN) {
    const pts = (HAFEN.stufen[String(s)]?.stege ?? []).flatMap((l) => l.punkte).filter(([, y]) => y < 190);
    if (!pts.length) continue;
    const xs = pts.map(([x]) => x), ys = pts.map(([, y]) => y);
    linien.push({ punkte: [[(Math.min(...xs) + Math.max(...xs)) / 2, Math.max(...ys) + 8], rp[0]], rand: (route?.halb ?? 24) + a.korridor });
  }
  if (N?.seeweg) linien.push({ punkte: N.seeweg.punkte, rand: N.seeweg.halb + a.korridor });
  // Freizeitboote und Paddler der Stufen 1 und 2
  for (const u of Object.values(UFER)) linien.push({ punkte: [[u.x0 - 10, u.y], [u.x1 + 10, u.y]], rand: a.ufer });
  const runden = Object.values(SEE_RUNDE);
  // Einfahrt ab Stufe 3 (Durchstich oder Molen)
  kreise.push([178, 215, 70]);
  // Bojenfeld (P36): beide Abschnitte
  for (const [x, y] of bojenfeldLage(reg)) kreise.push([x, y, a.bojenfeld]);
  // Bauplätze der Angebote an Land
  const dienstKreise = [];
  for (const s of SERVICES) {
    for (const l of [s.lage, ...(s.stufen ?? []).map((x) => x.lage)].filter(Boolean)) dienstKreise.push([l.x, l.y, (s.radius ?? 8) + a.service]);
  }
  for (const l of linien) {
    const xs = l.punkte.map(([x]) => x), ys = l.punkte.map(([, y]) => y);
    l.bb = [Math.min(...xs) - l.rand, Math.max(...xs) + l.rand, Math.min(...ys) - l.rand, Math.max(...ys) + l.rand];
  }
  yield;
  return { reg, linien, kreise, runden, dienstKreise, a };
}

/** Steht nichts im Weg (ohne Tiefe)? */
export function frei(px, py, h) {
  if (py < MASS.suche.y0 || hafenAbstand(px, py, 6) < MASS.hafenAbstand) return false;
  for (const l of h.linien) {
    if (px < l.bb[0] || px > l.bb[1] || py < l.bb[2] || py > l.bb[3]) continue;
    if (abstandLinie(px, py, l.punkte) < l.rand) return false;
  }
  for (const [x, y, r] of h.kreise) if (Math.hypot(px - x, py - y) < r) return false;
  for (const [x, y, r] of h.dienstKreise) if (Math.hypot(px - x, py - y) < r) return false;
  for (const sr of h.runden) {
    const dx = Math.max(sr.cx - sr.rx - px, 0, px - sr.cx - sr.rx), dy = Math.max(sr.cy - sr.ry - py, 0, py - sr.cy - sr.ry);
    if (Math.hypot(dx, dy) < h.a.runde) return false;
  }
  return true;
}

/** Ein Punkt an Land: frei von Anlagen, Höfen und Leuchttürmen der Landschaft (vielfalt.js) in jeder Stufe. */
function landFrei(px, py) {
  for (const s of STUFEN) if (freiAbstand(px, py, s) < 3) return false;
  return true;
}

/** Wassertiefe in Metern (negativ = Land) in jeder Stufe: die kleinste und die größte. */
// Tiefe je Stufe, zwischengespeichert (punkt() ist teuer). Reihenfolge 1, 6, 3: dort ändert sich am meisten.
const REIHE = [1, 6, 3, 2, 4, 5];
let _tiefe = new Map(), _tiefeFuer = null;
function tiefeIn(px, py, s, reg) {
  const fk = `${gelaendeform().nr}|${gelaendeform().seed}|${reg?.id}`;
  if (fk !== _tiefeFuer) { _tiefe = new Map(); _tiefeFuer = fk; }
  const k = `${s}|${px.toFixed(1)}|${py.toFixed(1)}`;
  let t = _tiefe.get(k);
  if (t === undefined) {
    t = -punkt(px, py, s, reg).h;
    if (_tiefe.size > 300000) _tiefe.clear();
    _tiefe.set(k, t);
  }
  return t;
}
/** Kleinste Wassertiefe über alle Stufen (für die Liste der Schilfpunkte). */
function tiefsteFlach(px, py, reg) {
  return Math.min(...REIHE.map((s) => tiefeIn(px, py, s, reg)));
}
const schilfTauglich = (px, py, reg) => REIHE.every((s) => {
  const t = tiefeIn(px, py, s, reg);
  return t >= MASS.tiefe[0] && t <= MASS.tiefe[1];
});
const landImmer = (px, py, reg) => REIHE.every((s) => tiefeIn(px, py, s, reg) < -0.05);

// Mitte der Stege der Stufe 2 (dort schaut die Kamera am Anfang hin)
function stegMitte() {
  const pts = (HAFEN.stufen['2']?.stege ?? []).flatMap((l) => l.punkte);
  if (!pts.length) return [-60, 60];
  return [pts.reduce((s, [x]) => s + x, 0) / pts.length, pts.reduce((s, [, y]) => s + y, 0) / pts.length];
}

/** Schilf, Ufer und Flächen um eine Mitte; null, wenn es dort nicht reicht. */
function* anlage(cx, cy, h) {
  const reg = h.reg;
  const R = MASS.radius, r = MASS.raster;
  // Richtung zum Land: Mittel der Richtungen, in denen nahe Land liegt
  let lx = 0, ly = 0, n = 0, ufer = null, uferD = Infinity;
  for (let k = 0; k < 24; k++) {
    const w = (k / 24) * Math.PI * 2;
    for (let d = 2; d <= MASS.uferNah; d += 2) {
      const px = cx + Math.cos(w) * d, py = cy + Math.sin(w) * d;
      if (!landImmer(px, py, reg)) continue;
      lx += Math.cos(w); ly += Math.sin(w); n++;
      if (d < uferD) { uferD = d; ufer = [px, py]; }
      break;
    }
  }
  if (!n || Math.hypot(lx, ly) < 0.3 * n) return null;   // Land rundum (Graben) oder nur ein Krümel
  const nl = Math.hypot(lx, ly);
  const zumLand = [lx / nl, ly / nl];
  const richtung = [-zumLand[0], -zumLand[1]];
  // Uferpunkt genau gegenüber dem Wasser: auf der Linie von der Mitte zum Land
  for (let d = 1; d <= MASS.uferNah + 4; d += 1) {
    const px = cx + zumLand[0] * d, py = cy + zumLand[1] * d;
    if (landImmer(px, py, reg)) { ufer = [px + zumLand[0] * 3, py + zumLand[1] * 3]; break; }
  }
  if (!ufer || !frei(ufer[0], ufer[1], h) || !landFrei(ufer[0], ufer[1])) return null;
  const schilf = [];
  yield;
  for (let i = -R; i <= R; i += r) for (let j = -R; j <= R; j += r) {
    if (j === -R) yield;
    if (i * i + j * j > R * R) continue;
    const px = cx + i, py = cy + j;
    if (!frei(px, py, h) || !schilfTauglich(px, py, reg)) continue;
    schilf.push([Math.round(px * 10) / 10, Math.round(py * 10) / 10, Math.round(tiefsteFlach(px, py, reg) * 100) / 100]);
  }
  if (schilf.length < MASS.minPunkte) return null;
  // Rechteck entlang des Ufers über das ganze Schilf (für den Parkplatz)
  const achse = [-richtung[1], richtung[0]];
  let u0 = Infinity, u1 = -Infinity, v1 = -Infinity;
  for (const [px, py] of schilf) {
    const u = (px - ufer[0]) * achse[0] + (py - ufer[1]) * achse[1];
    const v = (px - ufer[0]) * richtung[0] + (py - ufer[1]) * richtung[1];
    u0 = Math.min(u0, u); u1 = Math.max(u1, u); v1 = Math.max(v1, v);
  }
  // Parkplatz: vom Ufer bis an den Rand des Schilfs, höchstens 46 x 26 Planeinheiten (rund 28 x 16 m)
  const laenge = Math.min(46, u1 - u0 + 4), breite = Math.max(14, Math.min(26, v1 + 2));
  const um = (u0 + u1) / 2;
  const fm = [ufer[0] + achse[0] * um + richtung[0] * (breite / 2 - 3), ufer[1] + achse[1] * um + richtung[1] * (breite / 2 - 3)];
  // Ecken und Kanten des Parkplatzes müssen ebenso frei sein
  for (let a = -0.5; a <= 0.5; a += 0.25) for (const b of [-0.5, 0, 0.5]) {
    const px = fm[0] + achse[0] * a * laenge + richtung[0] * b * breite, py = fm[1] + achse[1] * a * laenge + richtung[1] * b * breite;
    if (!frei(px, py, h)) return null;
    if (landImmer(px, py, h.reg) && !landFrei(px, py)) return null;
  }
  // Bohlenweg: vom Ufer ins Schilf, bis kurz vor dessen äußeren Rand (dort die Hütte)
  const raus = Math.max(8, Math.min(v1 - 3, 26));
  const weg = [ufer, [ufer[0] + richtung[0] * raus, ufer[1] + richtung[1] * raus]];
  return { mitte: [cx, cy], ufer, richtung, schilf,
    flaeche: { mitte: fm, achse, laenge, breite }, weg };
}

/** Generator bis zum Ende laufen lassen, Ergebnis zurück. */
function bisZumEnde(gen) {
  for (;;) { const r = gen.next(); if (r.done) return r.value; }
}

const schluesselVon = (reg) => { const f = gelaendeform(); return `${f.nr}|${f.seed}|${reg?.id ?? reg?.name ?? ''}|${HAFEN.stegbild?.nr ?? 0}`; };
const regionAus = (region) => (typeof region === 'string' ? regionNach(region) : (region ?? regionNach('ostsee')));

function* sucheSchritte(reg) {
  const f = gelaendeform();
  const [mx, my] = stegMitte();
  const S = MASS.suche;
  for (const a of ABSTAENDE) {
    const h = yield* hindernisseSchritte(reg, a);
    // Kandidaten: flaches Wasser mit Land in der Nähe, nach Abstand zu den Stegen.
    // Die Mitte liegt im Spielbereich: Dort kann die Kamera hinschauen (main.js hält den Blickpunkt in spielRect)
    const sr = spielRect(f);
    const x0 = Math.max(S.x0, sr.minX / PLAN_M + 8), x1 = Math.min(S.x1, sr.maxX / PLAN_M - 8);
    const y0 = Math.max(S.y0, -sr.maxZ / PLAN_M + 8), y1 = Math.min(S.y1, -sr.minZ / PLAN_M - 8);
    const kand = [];
    for (let px = x0; px <= x1; px += S.schritt) for (let py = y0; py <= y1; py += S.schritt) {
      if (hafenAbstand(px, py, 6) < MASS.hafenAbstand + 4) continue;
      kand.push([Math.hypot(px - mx, py - my), px, py]);
    }
    kand.sort((p, q) => p[0] - q[0]);
    let n = 0;
    for (const [, px, py] of kand) {
      if ((++n & 15) === 0) yield;
      if (!schilfTauglich(px, py, reg) || !frei(px, py, h)) continue;
      const e = yield* anlage(px, py, h);
      if (e) return e;
    }
  }
  return null;
}

/**
 * Lage der Naturecke in Planeinheiten (siehe oben) oder null, wenn die Küste keinen Platz hat.
 * Rechnet am Stück (Tests, Werkzeuge); im Spiel lieber naturLageSpaeter.
 * @param {object|string} [region] Eintrag aus regionen.js oder id (ohne: Ostsee)
 */
export function naturLage(region) {
  const reg = regionAus(region);
  const key = schluesselVon(reg);
  if (_cache.has(key)) return _cache.get(key);
  const out = bisZumEnde(sucheSchritte(reg));
  _cache.set(key, out);
  return out;
}

/** Schon gerechnet? Dann die Lage (oder null für "kein Platz"), sonst undefined. */
export function naturLageFertig(region) {
  const key = schluesselVon(regionAus(region));
  return _cache.has(key) ? _cache.get(key) : undefined;
}

/**
 * Wie naturLage, aber in kleinen Stücken (je budgetMs, dann ein Bild Pause), damit das Spiel nicht hängt.
 * Gibt ein Promise auf die Lage zurück. Ändert sich unterdessen Küste oder Stegbild, rechnet es neu.
 */
export function naturLageSpaeter(region, { budgetMs = 8, warte = (f) => setTimeout(f, 0) } = {}) {
  const reg = regionAus(region);
  const key = schluesselVon(reg);
  if (_cache.has(key)) return Promise.resolve(_cache.get(key));
  return new Promise((fertig) => {
    const gen = sucheSchritte(reg);
    const schritt = () => {
      if (schluesselVon(reg) !== key) { fertig(naturLageSpaeter(region, { budgetMs, warte })); return; }
      const t0 = Date.now();
      for (;;) {
        const r = gen.next();
        if (r.done) { _cache.set(key, r.value); fertig(r.value); return; }
        if (Date.now() - t0 >= budgetMs) break;
      }
      warte(schritt);
    };
    warte(schritt);
  });
}

/** Ein Planpunkt in Weltmetern. */
export const inWelt = ([px, py]) => ({ x: px * PLAN_M, z: -py * PLAN_M });

/** Liegt ein Punkt (Weltmeter) im Schilf der Naturecke (mit Rand in Metern)? Für Tiere, Boote, Training. */
export function imSchilf(lage, x, z, randM = 0) {
  if (!lage) return false;
  const px = x / PLAN_M, py = -z / PLAN_M, r = MASS.raster / 2 + randM / PLAN_M;
  const [cx, cy] = lage.mitte;
  if (Math.hypot(px - cx, py - cy) > MASS.radius + r + 1) return false;
  return lage.schilf.some(([sx, sy]) => Math.abs(sx - px) <= r && Math.abs(sy - py) <= r);
}
