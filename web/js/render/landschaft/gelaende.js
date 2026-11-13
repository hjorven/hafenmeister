// Gelände des Hafens als reine Rechenfunktionen, ohne Three.js.
//
// Die Form folgt den Zeichnungen in docs/hafen (skripte/konzeptbilder/hafen_von_oben.py):
// von Süden nach Norden Festland, Binnensee, Nehrung, offene See.
// Intern wird in Planeinheiten gerechnet (1 Planeinheit = 0,62 m, y zeigt nach Norden),
// nach außen gibt das Modul Meter in Weltkoordinaten zurück:
//   x = Osten, z = Süden (Norden ist -z), y = oben, Wasserspiegel bei y = 0.
//
// Weil das Modul kein Three.js kennt, kann auch die Spiellogik es nutzen,
// zum Beispiel für die Regel "Wassertiefe mindestens 0,3 m größer als der Tiefgang".

import * as vielfalt from './vielfalt.js';
import { gelaendeform } from './formen.js';
import { anlagenFlaechen } from '../../data/anlagen-flaechen.js';

export const PLAN_M = 0.62;

/** Bereich, für den das Gelände fein berechnet wird (Planeinheiten). */
// Fein gerechnetes Gelände und Tiefentextur. Breit genug, dass der Übergang zum groben Außenring
// auch bei größter Kamerabreite am Ost- und Westrand nicht als harte Kante zu sehen ist.
export const BEREICH = { x0: -640, x1: 660, y0: -200, y1: 640 };
/** Kernbereich für dichte Bepflanzung (wie vor der Verbreiterung, damit nicht mehr Bäume gezeichnet werden). */
export const KERN = { x0: -420, x1: 430, y0: -200, y1: 470 };

/** Planeinheiten -> Weltmeter. */
export function ausPlan(px, py) {
  return { x: px * PLAN_M, z: -py * PLAN_M };
}

/** Weltmeter -> Planeinheiten. */
export function inPlan(x, z) {
  return { px: x / PLAN_M, py: -z / PLAN_M };
}

// ------------------------------------------------------------------ Rauschen

function hash2(ix, iy, seed) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** Wertrauschen 0..1, weich interpoliert. */
export function rauschen(x, y, seed = 1) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function fbm(x, y, seed) {
  return 0.55 * rauschen(x, y, seed) + 0.3 * rauschen(x * 2.03, y * 2.03, seed + 7) + 0.15 * rauschen(x * 4.1, y * 4.1, seed + 13);
}

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ------------------------------------------------------------------ Uferlinien (aus hafen_von_oben.py)

const kueste = (x) => 5 * Math.sin(x / 70) + 3 * Math.sin(x / 31 + 1);
/** Südufer des Sees (Festland). Im Westen und Osten schließt sich der See. */
export const suedufer = (x) => kueste(x) + 0.02 * Math.max(0, -235 - x) ** 2 + 0.02 * Math.max(0, x - 345) ** 2;
/** Nordufer des Sees (Innenseite der Nehrung). */
export const seeNord = (x) => 186 + 4 * Math.sin(x / 55 + 2) + 2.5 * Math.sin(x / 23);
/** Strand der Nehrung zur offenen See. */
export const meerSued = (x) => 224 + 4 * Math.sin(x / 80 + 1) + 2 * Math.sin(x / 27);

// ------------------------------------------------------------------ Abstand zur offenen See

let _seeRaster = null;
/**
 * Abstand in Metern zum nächsten Wasser der offenen See (nicht Binnensee), stetig, aus einem Raster
 * mit 4 Planeinheiten, das nur die Grundform kennt (ohne Molen und Engpass). 0 auf offener See.
 */
export function seeAbstandM(px, py) {
  if (!_seeRaster) {
    const S = 4, x0 = BEREICH.x0 - 40, y0 = BEREICH.y0 - 40;
    const nx = Math.ceil((BEREICH.x1 + 40 - x0) / S) + 1, ny = Math.ceil((BEREICH.y1 + 40 - y0) / S) + 1;
    const d = new Float32Array(nx * ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const x = x0 + i * S, y = y0 + j * S;
      d[j * nx + i] = y > meerSued(x) && y > suedufer(x) ? 0 : 1e9;
    }
    for (let pass = 0; pass < 2; pass++) {
      const r = pass ? -1 : 1;
      for (let jj = 0; jj < ny; jj++) for (let ii = 0; ii < nx; ii++) {
        const i = pass ? nx - 1 - ii : ii, j = pass ? ny - 1 - jj : jj, k = j * nx + i;
        let v = d[k];
        const a = i - r, b = j - r;
        if (a >= 0 && a < nx) v = Math.min(v, d[k - r] + 1);
        if (b >= 0 && b < ny) {
          v = Math.min(v, d[k - r * nx] + 1);
          if (a >= 0 && a < nx) v = Math.min(v, d[k - r * nx - r] + 1.4142);
          if (i + r >= 0 && i + r < nx) v = Math.min(v, d[k - r * nx + r] + 1.4142);
        }
        d[k] = v;
      }
    }
    _seeRaster = { S, x0, y0, nx, ny, d };
  }
  const { S, x0, y0, nx, ny, d } = _seeRaster;
  const fx = clamp((px - x0) / S, 0, nx - 1.001), fy = clamp((py - y0) / S, 0, ny - 1.001);
  const i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j, k = j * nx + i;
  const w = d[k] * (1 - u) * (1 - v) + d[k + 1] * u * (1 - v) + d[k + nx] * (1 - u) * v + d[k + nx + 1] * u * v;
  return w * S * PLAN_M;
}

/**
 * Engpass durch die Nehrung. Achse bei x 178 (Planeinheiten).
 * Stufe 1 und 2: natürliches Seegatt mit Sandhaken (seegattHalb, seegattAchse).
 * Ab Stufe 3: gerader Durchstich mit Kaimauern, x von bis (56 Planeinheiten = 35 m breit).
 */
export const ENGPASS_X = 178;
export const DURCHSTICH = [150, 206];
export const DURCHSTICH_TIEFE = 4.0;
/** Seegatt Stufe 1 und 2: Mitte der Rinne (leichte S-Kurve, wie ein natürliches Tief). */
export const seegattAchse = (py) => ENGPASS_X + 5 * Math.sin(clamp((py - 150) / 120, 0, 1) * Math.PI * 2) * 0.6;
/** Halbe Breite des Seegatts in Planeinheiten: schmal in der Mitte der Nehrung, trichterförmig an beiden Enden. */
export const seegattHalb = (py) => Math.min(34, 20 + 0.03 * (py - 205) ** 2);
export const SEEGATT_TIEFE = 2.2;

/** Molen je Stufe als Linienzüge in Planeinheiten, mit Breite. */
export function molen(stufe) {
  if (stufe >= 5) {
    return [
      { name: 'Westmole', punkte: [[-2, 224], [-10, 282], [18, 312], [96, 320]], breite: 9 },
      { name: 'Ostmole', punkte: [[210, 222], [220, 280], [196, 306]], breite: 9 },
    ];
  }
  if (stufe >= 3) {
    return [
      { name: 'Westmole', punkte: [[146, 222], [142, 274]], breite: 8 },
      { name: 'Ostmole', punkte: [[210, 222], [216, 268]], breite: 8 },
    ];
  }
  return [];
}

const _wege = new Map();
function wegeCache(stufe) {
  if (!_wege.has(stufe)) _wege.set(stufe, wegePlan(stufe));
  return _wege.get(stufe);
}

const _flaechen = new Map();
function flaechenCache(stufe) {
  if (!_flaechen.has(stufe)) {
    let liste = [];
    try { liste = anlagenFlaechen(stufe) || []; } catch { liste = []; }
    _flaechen.set(stufe, liste.filter((f) => f?.poly?.length >= 3).map((f) => {
      const xs = f.poly.map((q) => q[0]), ys = f.poly.map((q) => q[1]);
      return { ...f, bb: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
    }));
  }
  return _flaechen.get(stufe);
}

/**
 * Nehrungsstraße ab Stufe 6: vom Westland auf die Nehrung und auf der Seeseite des Binnensees nach Osten
 * bis zum Kai des Außenhafens. Die Anlagen (Marine, Kreuzfahrt, Fischhalle) stehen nördlich davon.
 */
export function strasseNehrung() {
  return { id: 'nehrungsstrasse', typ: 'strasse', punkte: [[-330, -88], [-366, -40], [-378, 100], [-370, 182], [-350, 192], [0, 192]], breite: 7 };
}

const _molen = new Map();
function molenCache(stufe) {
  if (!_molen.has(stufe)) _molen.set(stufe, molen(stufe));
  return _molen.get(stufe);
}

/**
 * Buhnen am Seestrand der Nehrung, etwa alle 50 m (80 Planeinheiten).
 * Je Buhne ein Linienzug in Planeinheiten vom Strand ins Wasser.
 */
export function buhnen(stufe) {
  const out = [];
  for (let x = -380; x <= 400; x += 80) {
    if (x > 110 && x < 245) continue;                       // Engpass und Einfahrt
    if (stufe >= 5 && x > -40 && x < 245) continue;         // Außenhafen
    const y0 = meerSued(x) - 5;
    out.push([[x, y0], [x + 2, y0 + 30]]);
  }
  return out;
}

/**
 * Pricken (Reisigbesen auf Stangen) an beiden Rändern der Rinne durch das Seegatt, nur Stufe 1 und 2.
 * Liegen knapp innerhalb des Rinnenrands, wo das Wasser noch etwa 0,8 m tief ist.
 */
export function pricken(stufe) {
  if (stufe >= 3) return [];
  const out = [];
  for (let py = 160; py <= 250; py += 15) {
    const nehrung = py > 180 && py < 230;
    const hw = nehrung ? seegattHalb(py) : SEEGATT_RINNE.halb + 4;
    for (const s of [-1, 1]) out.push([seegattAchse(py) + s * hw * 0.82, py]);
  }
  return out;
}

/**
 * Wege an Land in Planeinheiten: Straße hinter dem Hafen, Zugänge zum Ufer, Promenade.
 * Die Landschaft zeichnet sie als helle Wege; wegeNetz() gibt sie in Metern heraus.
 */
export function wegePlan(stufe) {
  const w = [{ id: 'strasse', typ: 'strasse', punkte: [[-330, -88], [340, -88]], breite: 9 }];
  if (stufe <= 2) {
    w.push({ id: 'zugang-a', typ: 'weg', punkte: [[-105, -88], [-104, -40], [-105, suedufer(-105) - 3]], breite: 3 });
    if (stufe === 2) w.push({ id: 'zugang-b', typ: 'weg', punkte: [[-55, -88], [-55, suedufer(-55) - 3]], breite: 3 });
  } else {
    w.push({ id: 'promenade', typ: 'promenade', punkte: [[-150, -3], [202, -3]], breite: 19 });
    for (const x of [-120, 20, 160]) w.push({ id: `zugang-${x}`, typ: 'weg', punkte: [[x, -88], [x, -13]], breite: 3.5 });
  }
  if (stufe >= 5) w.push({ id: 'kai-aussenhafen', typ: 'promenade', punkte: [[2, 222], [150, 222]], breite: 13 });
  if (stufe >= 6) w.push(strasseNehrung());
  return w;
}

/** Slipanlage am Südufer, x von bis (Planeinheiten). */
export const SLIP = { x0: -131, x1: -123 };

/** Bereich hinter dem Ufer, den der Hafen bebaut. Dort bleibt das Gelände eben und baumfrei. */
export const HAFENFLAECHE = { x0: -165, x1: 215, y0: -92 };

/** Abstand außerhalb der Hafenfläche in Planeinheiten (0 oder negativ = innerhalb). */
export function hafenAbstand(px, py) {
  return Math.max(HAFENFLAECHE.x0 - px, px - HAFENFLAECHE.x1, HAFENFLAECHE.y0 - py);
}

function inPoly(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Vorzeichenbehafteter Abstand zu einem Polygon: negativ innen, positiv außen. */
function polyAbstand(px, py, poly) {
  let d = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[j], [bx, by] = poly[i];
    const dx = bx - ax, dy = by - ay;
    const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1);
    d = Math.min(d, Math.hypot(px - ax - t * dx, py - ay - t * dy));
  }
  return inPoly(px, py, poly) ? -d : d;
}

/** Baggert weich aus: Ziel-Tiefe innen, sanfte Böschung über `rand` Planeinheiten nach außen. */
function baggern(h, px, py, poly, tiefe, rand = 10) {
  if (h >= 0) return h;
  const k = smooth(rand, 0, polyAbstand(px, py, poly));
  return k > 0 ? Math.min(h, h + (-tiefe - h) * k) : h;
}

function abstandZuLinie(px, py, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const dx = bx - ax, dy = by - ay;
    const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1);
    best = Math.min(best, Math.hypot(px - ax - t * dx, py - ay - t * dy));
  }
  return best;
}

// Becken: zum Durchstich hin so breit wie der Durchstich, damit kein Engpass hinter dem Engpass entsteht.
const BECKEN3 = [[-12, 6], [150, 6], [204, 120], [210, 176], [146, 176], [112, 128], [40, 112], [-12, 96]];
const BECKEN4 = [[-22, 6], [202, 6], [212, 96], [210, 176], [146, 176], [118, 150], [20, 152], [-22, 120]];
const BECKEN4_WEST = [[-84, 6], [-22, 6], [-22, 124], [-84, 112]];
const RINNE34 = [[152, 232], [204, 232], [240, 360], [180, 360]];
const AUSSENHAFEN = [[0, 226], [206, 226], [214, 280], [192, 302], [96, 320], [18, 312], [-8, 282]];
const RINNE5 = [[112, 304], [194, 300], [216, 360], [136, 360]];
// Hafenbecken: überall zwischen den Stegen mindestens so tief, dass die größte Klasse der Stufe
// von der Rinne bis vor jede Box kommt (Stufe 1-2: M 1,7 m, ab Stufe 3: L 2,4 m, jeweils mit Reserve).
const HAFENBECKEN12 = [[-160, 14], [60, 14], [60, 150], [-160, 150]];
const HAFENBECKEN3 = [[-150, 9], [208, 9], [214, 100], [204, 172], [60, 180], [-80, 168], [-150, 120]];
// Stufe 1 und 2: natürliche Rinne im See vor und hinter dem Seegatt (Mittellinie, halbe Breite)
const SEEGATT_RINNE = { y0: 110, y1: 300, halb: 14 };
// Stufe 6: Liegewanne an der Grossschiffspier westlich der Westmole (wie skripte/konzeptbilder/hafen_von_oben.py)
const PIERWANNE6 = [[-365, 228], [20, 228], [20, 520], [-365, 520]];   // Marinepier und Kreuzfahrtpier, nach Norden auslaufend (Abstimmung Thread Anlagen)

// ------------------------------------------------------------------ Geländeformen (formen.js)

/** Endet die Nehrung der Form hier (östlich von ostEnde), und liegt der Punkt nicht im Haken? */
function nehrungWeg(F, px, py, ln) {
  if (F.ostEnde == null || px <= F.ostEnde) return false;
  return !(F.hakenOst && haken(F, px, py, ln) > 0);
}

/** Haken am Ostende: 0 außerhalb, bis 1 in der Mitte. Biegt vom Nehrungsende nach Süden in den See. */
function haken(F, px, py, ln) {
  const cx = F.ostEnde + 4, cy = ln - 6;
  const e = ((px - cx) / 16) ** 2 + ((py - cy) / 28) ** 2;
  return e < 1 ? 1 - e : 0;
}

function nehrungsErsatz(F, px, py, ln, ms, wob, g) {
  const k = smooth(F.ostEnde, F.ostEnde + 14, px);   // weicher Übergang am Nehrungsende
  if (F.ostArt === 'sandbank') {
    // Sandbank: meist knapp unter Wasser, einzelne Sandflächen darüber
    const b = fbm(px / 26, py / 9, 71);
    const h = 0.6 - k * 0.6 - 0.9 * (1 - b) + 0.2 * Math.sin(Math.PI * clamp((py - ln) / (ms - ln), 0, 1));
    return { h, typ: h >= 0 ? 'sand' : 'wasser' };
  }
  // offen: Boddenwasser, flach am Rand, zur Mitte bis gut 2 m
  const tief = 0.4 + 1.8 * k;
  return { h: Math.min(-0.3, -tief - 0.3 * wob), typ: 'wasser' };
}

/** Inseln im Binnensee und der Haken: Land mit Sandrand, rundherum flaches Wasser. */
function seeInsel(F, px, py, h, typ, stufe, region) {
  if (F.hakenOst && F.ostEnde != null && px > F.ostEnde - 20) {
    const k = haken(F, px, py, seeNord(px));
    if (k > 0) {
      const hh = 0.15 + k * 1.6;
      return { h: Math.max(h, hh), typ: k < 0.35 ? 'sand' : 'duenengras' };
    }
  }
  for (const i of F.seeInseln || []) {
    const dx = (px - i.x) / i.rx, dy = (py - i.y) / i.ry;
    const e = Math.sqrt(dx * dx + dy * dy) * (0.9 + 0.2 * rauschen(px / 12, py / 12, 81));
    if (e < 1) {
      const innen = 1 - e;
      let hh = 0.15 + innen * (i.art === 'wald' ? 3.0 : i.art === 'schilf' ? 0.5 : 1.4);
      let t = e > 0.8 ? 'sand' : i.art === 'schilf' ? 'salzwiese' : 'gras';
      ({ h: hh, typ: t } = vielfalt.land(px, py, hh, t, innen * Math.min(i.rx, i.ry), {
        stufe, region, uferAbstandM: innen * Math.min(i.rx, i.ry) * PLAN_M, hafenAbstand: hafenAbstand(px, py), offeneSee: false,
        seeAbstandM: seeAbstandM(px, py), form: F.nr, formSteilufer: false, insel: true,
      }));
      return { h: hh, typ: t };
    }
    if (e < 1.5 && h < 0) h = Math.max(h, -0.2 - (e - 1) * 3.0);   // flacher Rand um die Insel
  }
  return { h, typ };
}

/** Leuchttürme der Form in Planeinheiten (auf Land, vom Gelände getragen). */
export function leuchttuerme() {
  return (gelaendeform().leuchttuerme || []).map(([x, y]) => [x, y]);
}

// ------------------------------------------------------------------ Punktabfrage

/**
 * Gelände an einem Punkt in Planeinheiten.
 * Rückgabe: h = Höhe in Metern (negativ = Wassertiefe), typ = Oberfläche, see = 0 Binnensee bis 1 offene See.
 * @param {number} px
 * @param {number} py
 * @param {number} stufe 1..6
 * @param {object} region Eintrag aus regionen.js (gelaende-Teil)
 */
export function punkt(px, py, stufe, region) {
  const g = region.gelaende;
  const wob = rauschen(px / 80, py / 60, 12) - 0.5;
  const ausgebaut = stufe >= 3 && px >= -150 && px <= 202;
  const F = gelaendeform();
  const ln = seeNord(px);
  // Die Form darf den Binnensee verkleinern, aber das Festland nie über die Nehrung hinaus in die See schieben
  const uferForm = kueste(px) + 0.02 * Math.max(0, (F.seeWest ?? -235) - px) ** 2
    + (F.seeOstOffen ? 0.05 * Math.max(0, px - 395) ** 2 : 0.02 * Math.max(0, px - (F.seeOst ?? 345)) ** 2);
  const ufer = ausgebaut ? 6 : Math.min(uferForm, Math.max(suedufer(px), ln + 2));
  const ms = meerSued(px) + (F.breiteSee || 0) * smooth(228, 262, px);   // nur östlich des Engpasses (westlich liegen Außenhafen und Piers)
  const see = clamp((py - (ln + ms) / 2) / 8 + 0.5, 0, 1);
  let h, typ;

  if (py <= ufer) {
    // ---------------- Festland
    const d = ufer - py;
    const sandBreite = g.strandBreite + 4 * Math.sin(px / 23);
    if (ausgebaut && py > -92) {
      h = 1.2; typ = 'pflaster';
      if (py < -13) typ = 'gras';
    } else {
      h = d < sandBreite ? 0.12 + d * 0.045 : 0.12 + sandBreite * 0.045 + Math.min(d - sandBreite, 8) * 0.06;
      typ = d < sandBreite ? 'sand' : 'gras';
    }
    // Hügel und Felsen im Hinterland, nicht auf der Hafenfläche
    const land = smooth(10, 40, d) * smooth(0, 30, hafenAbstand(px, py));
    if (g.huegel) h += g.huegel * land * fbm(px / 140, py / 110, 3);
    if (g.felsen) {
      // Schärenfelsen nur am Rand der Karte, weit weg vom Hafen
      const r = fbm(px / 45, py / 45, 9);
      const f = g.felsen * land * smooth(0.58, 0.9, r) * smooth(200, 340, Math.abs(px - 20));
      h += f;
      if (f > 2.2) typ = 'fels';
    }
    if (F.steilufer) {
      // Steilufer der Förde: gleich hinter dem schmalen Strand steigt das Land steil an, nicht am Hafen
      const kd = smooth(sandBreite * 0.6, sandBreite * 0.6 + 7, d), kh = smooth(25, 70, hafenAbstand(px, py));
      if (kd * kh > 0) {
        h += F.steilufer * kd * kh * (0.75 + 0.5 * fbm(px / 60, py / 60, 41));
        if (kd > 0.08 && kd < 0.85 && kh > 0.6) typ = 'fels';
      }
    }
    if (g.deich) {
      // Grüner Deich hinter der Straße, dahinter flacher Polder
      const dy = py - g.deich.y;
      const k = Math.max(0, 1 - Math.abs(dy) / g.deich.breite);
      const deich = g.deich.hoehe * Math.min(1, k * 1.8);
      if (deich > h) { h = deich; typ = k > 0.85 ? 'deichkrone' : 'deich'; }
      if (dy < -g.deich.breite) h = Math.min(h, 0.9);
    }
    // Abwechslung an Land (Thread "Gelände abwechslungsreicher gestalten")
    ({ h, typ } = vielfalt.land(px, py, h, typ, d, {
      stufe, region, uferAbstandM: d * PLAN_M, hafenAbstand: hafenAbstand(px, py), offeneSee: seeAbstandM(px, py) < d * PLAN_M, seeAbstandM: seeAbstandM(px, py),
      form: F.nr, formSteilufer: !!F.steilufer, insel: false,
    }));
    // Straße und Wege (Promenade ist schon Pflaster)
    if (py < 0 && py > -100) {
      for (const w of wegeCache(stufe)) {
        if (w.typ === 'promenade') continue;
        if (abstandZuLinie(px, py, w.punkte) < w.breite / 2) {
          typ = 'weg';
          h = Math.min(h, (ausgebaut ? 1.2 : h));
          break;
        }
      }
    }
  } else if (py < ln) {
    // ---------------- Binnensee
    const dist = Math.min(py - ufer, ln - py);
    h = -Math.max(0.2, 2.5 * (1 - Math.exp(-Math.max(0, dist) / 26)) + 0.5 * wob);
    // Reviere mit Gezeiten: Hafenbecken ist ausgebaggert, damit es bei Ebbe nicht trockenfällt
    if (g.gezeiten) h -= g.gezeiten * smooth(0, 8, dist);
    typ = 'wasser';
    ({ h, typ } = seeInsel(F, px, py, h, typ, stufe, region));
  } else if (py < ms && !nehrungWeg(F, px, py, ln)) {
    // ---------------- Nehrung
    const t = (py - ln) / (ms - ln);
    const profil = Math.pow(Math.sin(Math.PI * clamp(t, 0, 1)), 0.7);
    {
      const welle = 0.6 + 0.4 * fbm(px / 30, py / 12, 17);
      h = 0.25 + profil * g.duenenHoehe * (F.duenen ?? 1) * welle;
      typ = t < 0.08 || t > 0.86 ? 'sand' : t < 0.45 ? 'duenengras' : 'duene';
      // Flache Durchlässe der Form (machen aus der Nehrung Inseln), mit Sandrand
      for (const l of F.luecken || []) {
        const dl = Math.max(l.x0 - px, px - l.x1);
        if (dl < 0) { const k = smooth(0, 6, -dl); h = Math.min(h, 0.1 - (l.tiefe + 0.1) * k); typ = h < 0 ? 'wasser' : 'sand'; }
        else if (dl < 10) { h = Math.min(h, 0.15 + dl * 0.08); typ = 'sand'; }
      }
      if (h >= 0) typ = vielfalt.nehrung(px, py, h, typ, { stufe, region, uferAbstandM: Math.min(py - ln, ms - py) * PLAN_M, hafenAbstand: hafenAbstand(px, py), offeneSee: t > 0.5, seeAbstandM: (ms - py) * PLAN_M, form: F.nr, formSteilufer: false, insel: false });
      // Salzwiesen und kleine Lagunen auf der Seeseite des Binnensees (wie am Graswarder)
      const lag = fbm(px / 22, py / 9, 31);
      const frei = (px < 100 || px > 255) && !(stufe >= 5 && px > -30 && px < 200);
      if (frei && h >= 0 && t < 0.5 && lag > 0.56) {
        typ = 'salzwiese';
        h = Math.min(h, 0.15 + (0.7 - lag) * 2);
        if (t > 0.1 && t < 0.4 && lag > 0.69) { h = -0.7; typ = 'wasser'; }
      }
    }
  } else if (py < ms) {
    // ---------------- Wo die Form keine Nehrung hat: Boddenwasser oder Sandbank, am Ende ein Haken
    ({ h, typ } = nehrungsErsatz(F, px, py, ln, ms, wob, g));
  } else {
    // ---------------- Offene See
    const dist = py - ms;
    // Watt vor der Küste, aber ein tiefer Priel vor der Einfahrt und der Reede (um x = 230)
    const watt = Math.max((g.wattBreite || 0) * smooth(95, 135, Math.abs(px - 230)), (F.watt || 0) * smooth(36, 70, Math.abs(px - ENGPASS_X)));
    h = -Math.max(0.2, 5 * (1 - Math.exp(-Math.max(0, dist - watt) / 42)) + 0.6 * wob + (watt ? 0.25 : 0));
    if (watt > 4 && dist < watt + 6) {
      // Watt (Nordsee oder Form 8): Platen fallen bei Niedrigwasser trocken, dazwischen Priele
      // Sandplaten liegen knapp über Wasser, Priele klar darunter: kein flacher Dauersaum, der überall schäumt
      const n = fbm(px / 22, py / 9, 51);
      const w = 0.12 - 1.1 * smooth(0.5, 0.58, n) - 1.3 * smooth(watt - 10, watt + 4, dist);
      // ab Stufe 5 ist das Watt vor dem Außenhafen weggebaggert, ab Stufe 6 auch in der Liegewanne
      let frei = 1;
      if (stufe >= 5) frei = smooth(0, 24, Math.min(polyAbstand(px, py, AUSSENHAFEN), polyAbstand(px, py, RINNE5)));
      if (stufe >= 6) frei = Math.min(frei, smooth(0, 40, polyAbstand(px, py, PIERWANNE6)));
      if (watt > 4 && frei > 0) { h = Math.max(h, h + (w - h) * frei); typ = 'watt'; }
    }
    if (F.riff && px > F.riff.x0 && px < F.riff.x1) {
      const k = 1 - smooth(0, F.riff.breite, Math.abs(py - F.riff.y)) ;
      if (k > 0) h = Math.max(h, -(F.riff.tiefe + 0.3 * fbm(px / 20, py / 8, 61)) * (2 - k) / 1);
    }
    // Der Priel vor der Einfahrt ist auch bei Ebbe befahrbar
    if (g.gezeiten) h -= g.gezeiten * (1 - smooth(70, 110, Math.abs(px - 230))) * smooth(0, 25, dist);
    if (typ !== 'watt' || h < -0.6) typ = 'wasser';
  }

  // ---------------- Bauprojekte, die Wasser und Land verändern
  if (stufe <= 2 && h < 0 && py < 160) h = baggern(h, px, py, HAFENBECKEN12, 1.9, 8);
  if (stufe >= 3) {
    if (h < 0) {
      h = baggern(h, px, py, HAFENBECKEN3, 2.6, 30);
      h = baggern(h, px, py, stufe >= 4 ? BECKEN4 : BECKEN3, 3.5 + 0.4 * wob, 14);
      if (stufe >= 4) h = baggern(h, px, py, BECKEN4_WEST, 2.6, 12);
      if (stufe < 5) h = baggern(h, px, py, RINNE34, 4.4, 6);
    }
    // Durchstich: gerade Kaimauern, innen zum Becken hin abgeschrägte Ecken (8 Planeinheiten)
    const halb = (DURCHSTICH[1] - DURCHSTICH[0]) / 2;
    const dx = Math.abs(px - ENGPASS_X);
    const fase = Math.max(0, ln + 8 - py);
    // Zur Beckenseite läuft die Rinne als runde Zunge aus (Höhenlinien sind Bögen), statt mit einer Kante quer zur Fahrt zu enden
    const zunge = smooth(ln - 50, ln, py + 34 * (dx / (halb + 10)) ** 2);
    const ziel = DURCHSTICH_TIEFE + (g.gezeiten || 0);
    if (py > ln - 12 && py < 236 && dx < halb + fase) {
      const tief = -ziel + 0.4 * smooth(halb - 6, halb + fase, dx);
      if (h > tief) h = h >= 0 || py > ln ? tief : h + (tief - h) * zunge;
      typ = 'wasser';
    } else if (py > ln - 50 && py <= ln - 12 && h < 0 && h > -ziel) {
      h += (-ziel - h) * zunge;
    } else if (py > ln - 4 && py < 226 && dx < halb + fase + 4 && h > -0.5) {
      h = 1.0; typ = 'steinschuettung';
    }
    if (stufe >= 5) {
      if (py > 229) h = baggern(h, px, py, AUSSENHAFEN, 5.0, 6);
      h = baggern(h, px, py, RINNE5, 4.6, 6);
      if (px > 2 && px < 150 && py > 214 && py <= 229) { h = 1.3; typ = 'pflaster'; }
    }
    if (stufe >= 6) h = baggern(h, px, py, PIERWANNE6, 8.5, 40);
  } else if (py > SEEGATT_RINNE.y0 && py < SEEGATT_RINNE.y1) {
    // Natürliches Seegatt durch die Nehrung: Rinne mit flachen Rändern, an den Enden Sandhaken.
    // Vor und hinter der Nehrung läuft die Rinne trichterförmig aus und geht in See und Binnensee über.
    const d = Math.abs(px - seegattAchse(py));
    const zone = py < ln - 6 ? ln - 6 - py : py > ms + 6 ? py - ms - 6 : 0;
    const hw = SEEGATT_RINNE.halb + (seegattHalb(clamp(py, ln - 6, ms + 6)) - SEEGATT_RINNE.halb) * (1 - smooth(0, 30, zone));
    // an beiden Enden läuft die Rinne weich aus, statt mit einer Kante zu enden
    const enden = smooth(SEEGATT_RINNE.y0, SEEGATT_RINNE.y0 + 40, py) * (1 - smooth(SEEGATT_RINNE.y1 - 30, SEEGATT_RINNE.y1, py));
    if (d < hw) {
      const tief = -(0.25 + (SEEGATT_TIEFE - 0.25 + 0.15 * wob) * enden * Math.sqrt(1 - (d / hw) ** 2) + (g.gezeiten || 0) * enden * smooth(hw, hw * 0.7, d));
      if (tief < h) { h = tief; typ = 'wasser'; }
    } else if (zone === 0 && d < hw + 14 && h >= 0) {
      h = Math.min(h, 0.12 + (d - hw) * 0.07);
      typ = 'sand';
    }
  }
  for (const m of molenCache(stufe)) {
    if (abstandZuLinie(px, py, m.punkte) < m.breite / 2) { h = 1.4; typ = 'mole'; }
  }
  if (stufe >= 2 && px > SLIP.x0 && px < SLIP.x1) {
    // Slipanlage: Rampe vom Land bis 0,6 m unter Wasser, ab Stufe 3 durch die Kaimauer hindurch
    const y0 = stufe >= 3 ? -13 : suedufer(-128) - 10;
    const y1 = stufe >= 3 ? 16 : suedufer(-128) + 9;
    if (py > y0 && py < y1) {
      const oben = stufe >= 3 ? 1.2 : 0.6;
      h = oben - ((py - y0) / (y1 - y0)) * (oben + 0.6);
      typ = 'pflaster';
    }
  }
  // Planierte Flächen für Anlagen (data/anlagen-flaechen.js) und Straßen außerhalb des Festlands
  for (const f of flaechenCache(stufe)) {
    if (px < f.bb[0] || px > f.bb[2] || py < f.bb[1] || py > f.bb[3]) continue;
    if (inPoly(px, py, f.poly)) { h = f.hoehe ?? 1.2; typ = f.typ ?? 'pflaster'; }
  }
  if (stufe >= 6 && px < 4 && (h >= 0 || py > 150)) {
    const w = strasseNehrung();
    if (abstandZuLinie(px, py, w.punkte) < w.breite / 2) {
      typ = 'weg';
      if (py > 150) h = Math.max(0.6, Math.min(h, 1.0));   // auf der Nehrung eben, am Seeufer aufgeschüttet
    }
  }
  // Reviere mit Gezeiten: Bauwerke und Hinterland liegen höher, der flache Strand nicht
  const basis = g.landPlus || 0;
  if (basis) {
    if (typ === 'pflaster' || typ === 'mole' || typ === 'steinschuettung') h += basis;
    else if (h > 0) h += basis * smooth(0.1, 1.0, h);
  }
  return { h, typ, see };
}

/**
 * Erzeugt Abfragefunktionen in Weltmetern für eine Stufe und Region.
 * hoeheBei: Bodenhöhe in Metern (unter Wasser negativ).
 * tiefeBei: Wassertiefe in Metern (0 an Land).
 */
export function gelaendeAbfrage(stufe, region) {
  const p = (x, z) => punkt(x / PLAN_M, -z / PLAN_M, stufe, region);
  return {
    hoeheBei: (x, z) => p(x, z).h,
    tiefeBei: (x, z) => Math.max(0, -p(x, z).h),
    istWasser: (x, z) => p(x, z).h < 0,
    punkt: p,
  };
}

// ------------------------------------------------------------------ Warteplätze vor dem Hafen

/**
 * Wo ankommende Boote warten, bis der Spieler ihnen einen Platz gibt (Planeinheiten).
 * Stufe 1 und 2: im Binnensee vor den Stegen, weil es noch keine Zufahrt von See gibt.
 * Ab Stufe 3: draußen vor der Einfahrt, östlich der Fahrrinne, wie auf echten Revieren.
 * Ab Stufe 5 zusätzlich eine Reede für große Schiffe weiter draußen.
 * bojen: feste Warteboje je Boot. ankerbereiche: Kreis, in dem frei geankert wird.
 * groesse: größte Bootsgröße, die dort warten kann.
 */
/** Halber Abstand zwischen ankernden Booten in Metern (Boot schwoit um den Anker), je größter Bootsklasse. */
export const SCHWOIKREIS_M = { S: 5, M: 6, L: 7.5, XL: 16 };

export function warteplaetze(stufe) {
  const bojen = [], ankerbereiche = [];
  const reihe = (id, x0, y0, dx, dy, n, groesse) => {
    for (let i = 0; i < n; i++) bojen.push({ id: `${id}${i + 1}`, px: x0 + dx * i, py: y0 + dy * i, groesse });
  };
  if (stufe <= 2) {
    // Nahe vor Steg A, damit die wartenden Boote in der Startansicht zu sehen sind.
    // Boote liegen mit dem Bug an der Boje, nach Osten bleibt gut 4 m Platz.
    const lagen = stufe === 1
      ? [[-100, 56], [-86, 53], [-72, 50]]
      : [[-112, 86], [-94, 90], [-76, 88], [-58, 92], [-40, 89], [-22, 92]];
    lagen.forEach(([px, py], i) => bojen.push({ id: `see-${i + 1}`, px, py, groesse: 'M' }));
    // Ankerfeld im See östlich der Bojen, abseits des Wegs vom Graben zu den Stegen
    ankerbereiche.push(stufe === 1
      ? { id: 'see-anker', px: -25, py: 102, radius: 44, groesse: 'M' }
      : { id: 'see-anker', px: 42, py: 130, radius: 50, groesse: 'M' });
  } else if (stufe <= 4) {
    reihe('reede-', 240, 266, 14, 9, stufe === 3 ? 5 : 7, 'L');
    ankerbereiche.push({ id: 'reede-anker', px: 355, py: 392, radius: 62, groesse: 'L' });
  } else {
    reihe('reede-', 246, 304, 14, 9, 8, 'L');
    ankerbereiche.push({ id: 'reede-anker', px: 360, py: 440, radius: 60, groesse: 'L' });
    ankerbereiche.push({ id: 'reede-gross', px: 30, py: 440, radius: 85, groesse: 'XL' });
  }
  const welt = (o) => ({ ...o, x: o.px * PLAN_M, z: -o.py * PLAN_M, ...(o.radius ? { radiusM: o.radius * PLAN_M } : {}) });
  // Feste Ankerplätze im Ankerfeld: Sechseck-Raster mit Abstand nach Schwoikreis der größten Bootsklasse,
  // sortiert nach Nähe zur Einfahrt, damit zuerst die nahen Plätze belegt werden.
  const ankerplaetze = [];
  const einfahrt = stufe <= 2 ? [-80, 60] : [ENGPASS_X, 262];
  for (const b of ankerbereiche) {
    const abstand = SCHWOIKREIS_M[b.groesse] * 2 / PLAN_M;
    const r = b.radius - abstand * 0.45;
    const liste = [];
    for (let j = -Math.ceil(r / abstand) - 1; j <= Math.ceil(r / abstand) + 1; j++) {
      const dy = j * abstand * 0.866;
      for (let i = -Math.ceil(r / abstand) - 1; i <= Math.ceil(r / abstand) + 1; i++) {
        const dx = (i + (j & 1 ? 0.5 : 0)) * abstand;
        const px = b.px + dx, py = b.py + dy;
        // nicht auf Wartebojen und nicht in der Fahrrinne
        const frei = bojen.every((o) => Math.hypot(o.px - px, o.py - py) > abstand * 0.8)
          && polyAbstand(px, py, stufe >= 5 ? RINNE5 : RINNE34) > abstand * 0.6;
        if (Math.hypot(dx, dy) <= r && frei) liste.push([px, py]);
      }
    }
    if (!liste.length) liste.push([b.px, b.py]);
    liste.sort((p, q) => Math.hypot(p[0] - einfahrt[0], p[1] - einfahrt[1]) - Math.hypot(q[0] - einfahrt[0], q[1] - einfahrt[1]));
    liste.forEach(([px, py], i) => ankerplaetze.push({ id: `${b.id}-${i + 1}`, bereich: b.id, px, py, groesse: b.groesse, schwoikreisM: SCHWOIKREIS_M[b.groesse] }));
  }
  return { bojen: bojen.map(welt), ankerbereiche: ankerbereiche.map(welt), ankerplaetze: ankerplaetze.map(welt) };
}

/**
 * Begehbare Wege in Weltmetern für Menschen und Fahrzeuge: Straße, Zugänge, Promenade, Kai, Molenwege.
 * Stege kommen nicht von hier, sondern aus web/js/data/harbor.js.
 * Jeder Weg: { id, typ, breite (m), punkte: [{x, y, z}] } mit y = Bodenhöhe.
 */
export function wegeNetz(stufe, region) {
  const plus = region.gelaende.landPlus || 0;
  const alle = wegePlan(stufe).map((w) => ({ ...w }));
  for (const m of molen(stufe)) alle.push({ id: `mole-${m.name.toLowerCase()}`, typ: 'mole', punkte: m.punkte, breite: m.breite * 0.36, hoehe: 1.45 + plus });
  return alle.map((w) => ({
    id: w.id,
    typ: w.typ,
    breite: +(w.breite * PLAN_M).toFixed(2),
    punkte: w.punkte.map(([px, py]) => {
      const h = w.hoehe ?? Math.max(0, punkt(px, py, stufe, region).h);
      return { x: +(px * PLAN_M).toFixed(2), y: +h.toFixed(2), z: +(-py * PLAN_M).toFixed(2) };
    }),
  }));
}
