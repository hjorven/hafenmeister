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
import { gelaendeform, natur, beiFormwechsel } from './formen.js';
import { SEE_NORD, WELT, BEREICH, KAIFLAECHE, wasserBedarf, stegUfer } from './natur.js';
import { anlagenFlaechen } from '../../data/anlagen-flaechen.js';
import { region as regionNach } from './regionen.js';
import { SEE_RUNDE } from '../../data/verkehr.js';

export const PLAN_M = 0.62;

/** Bereich, für den das Gelände fein berechnet wird (Planeinheiten). */
// Fein gerechnetes Gelände und Tiefentextur. Breit genug, dass der Übergang zum groben Außenring
// auch bei größter Kamerabreite am Ost- und Westrand nicht als harte Kante zu sehen ist.
export { BEREICH } from './natur.js';
/** Kernbereich für dichte Bepflanzung (wie vor der Verbreiterung, damit nicht mehr Bäume gezeichnet werden). */
/** Außenring bis zum Kartenrand (äußeres Geländenetz, grobe Tiefentextur). */
export const AUSSEN = { x0: -1600, x1: 1600, y0: -1600, y1: 1400 };
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

/**
 * Abstand in Metern zum nächsten Wasser der offenen See (nicht Lagune, Bodden, Fluss oder Hafenbecken),
 * aus der Landschaft der Form (natur.js). 0 auf offener See.
 */
export function seeAbstandM(px, py) {
  return natur().probe(px, py).offenAbstand * PLAN_M;
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

/** Molen je Stufe als Linienzüge in Planeinheiten, mit Breite. Ab Stufe 3 dazu Wellenbrecher (wellenbrecher). */
export function molen(stufe) {
  const fest = stufe >= 5 ? [
    { name: 'Westmole', punkte: [[-2, 224], [-10, 282], [18, 312], [96, 320]], breite: 9 },
    { name: 'Ostmole', punkte: [[210, 222], [220, 280], [196, 306]], breite: 9 },
  ] : stufe >= 3 ? [
    { name: 'Westmole', punkte: [[146, 222], [142, 274]], breite: 8 },
    { name: 'Ostmole', punkte: [[210, 222], [216, 268]], breite: 8 },
  ] : [];
  return [...fest, ...wellenbrecher(stufe)];
}

/**
 * Wellenbrecher ab Stufe 3: Steinwälle, die den Hafen nach See hin schützen, dort wo die Natur es nicht tut.
 * Sie laufen von den Molenwurzeln nach Westen und Osten, bis sie auf Land treffen oder weit genug sind.
 * Liegt dort schon Land (Nehrung, Landzunge), gibt es keinen Wellenbrecher.
 */
export function wellenbrecher(stufe) {
  if (stufe < 3) return [];
  const N = natur();
  const out = [];
  const wasser = (x, y) => N.landig(x, y) < 1;
  // Von der Molenwurzel nach außen: über Wasser ein Wall, auf Land (Insel, Landzunge) Pause, danach weiter
  const zug = (name, start, richtung, ende, y) => {
    let teil = [start, [start[0] + richtung * 10, y], [start[0] + richtung * 10, y]], x = start[0] + richtung * 10, nr = 1;
    const fertig = () => {
      if (teil && teil.length >= 2 && Math.abs(teil[teil.length - 1][0] - teil[0][0]) >= 24) out.push({ name: nr > 1 ? `${name} ${nr}` : name, punkte: teil, breite: 11 });
      if (teil) nr++;
      teil = null;
    };
    while (richtung < 0 ? x > ende : x < ende) {
      x += richtung * 8;
      if (wasser(x, y)) {
        if (!teil) teil = [[x - richtung * 4, y]];
        if (teil.length < 2) teil.push([x, y]); else teil[teil.length - 1] = [x, y];
      } else if (teil) {
        teil[teil.length - 1] = [x - richtung * 2, y];
        fertig();
      }
    }
    fertig();
  };
  if (stufe >= 5) zug('Wellenbrecher West', [-2, 224], -1, stufe >= 6 ? -400 : -260, 212);
  else zug('Wellenbrecher West', [146, 222], -1, -250, 212);
  zug('Wellenbrecher Ost', [210, 222], 1, 300, 212);
  return out;
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
beiFormwechsel(() => { _molen.clear(); });
function molenCache(stufe) {
  if (!_molen.has(stufe)) _molen.set(stufe, molen(stufe));
  return _molen.get(stufe);
}

/**
 * Buhnen an offenen Sandstränden nahe am Hafen, etwa alle 50 m (80 Planeinheiten).
 * Je Buhne ein Linienzug in Planeinheiten vom Strand ins Wasser (nach Norden, wo die See ist).
 */
export function buhnen(stufe) {
  const N = natur();
  const out = [];
  for (let x = -380; x <= 400; x += 80) {
    if (x > 110 && x < 245) continue;                       // Engpass und Einfahrt
    if (stufe >= 5 && x > -40 && x < 245) continue;         // Außenhafen
    if (x > -230 && x < 110) continue;                      // Stege
    // Strand von Norden her suchen: erstes Land unter offener See
    for (let y = 520; y > 0; y -= 4) {
      if (N.landig(x, y) < 0) continue;
      const p = N.probe(x, y + 6);
      if (p.L < 0 && p.offenAbstand < 10 && N.probe(x, y - 20).L > 0) out.push([[x, y - 5], [x + 2, y + 25]]);
      break;
    }
  }
  return out;
}

/**
 * Pricken (Reisigbesen auf Stangen) an beiden Rändern der Rinne durch das Seegatt, nur Stufe 1 und 2.
 * Liegen knapp innerhalb des Rinnenrands, wo das Wasser noch etwa 0,8 m tief ist.
 */
export function pricken(stufe) {
  if (stufe >= 3) return [];
  const N = natur();
  const out = [];
  for (let py = 160; py <= 250; py += 15) {
    const nehrung = py > 180 && py < 230;
    const hw = nehrung ? seegattHalb(py) : SEEGATT_RINNE.halb + 4;
    for (const s of [-1, 1]) {
      const px = seegattAchse(py) + s * hw * 0.82;
      // Pricken nur, wo das Wasser flach ist (in tiefem, offenem Wasser braucht die Rinne keine Markierung)
      const q = N.probe(px, py);
      if (q.L < 0 && q.d > -36 && !(q.offenAbstand < 1 && q.d < -30)) out.push([px, py]);
    }
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
// y1: nördlich der Pflicht-See (SEE_NORD) gehört das Land wieder der Natur, sonst bliebe dort ein kahler Streifen
export const HAFENFLAECHE = { x0: -165, x1: 215, y0: -92, y1: 600 };

/**
 * Ufer je Küstentyp (natur.js stil.ufer) an Land in den ersten Metern hinter der Wasserlinie.
 * Keine großen Höhen am Hafen: dort stehen Gebäude, Slip und Stegwurzeln.
 */
function uferArt(art, px, py, h, typ, d, hafenAb) {
  const n = fbm(px / 9, py / 9, 131);
  const amHafen = 1 - smooth(0, 30, hafenAb);   // 1 auf der Hafenfläche
  const slip = px > SLIP.x0 - 3 && px < SLIP.x1 + 3 && d < 14;
  if (slip) return { h, typ };
  switch (art) {
    case 'fels':
      // Granitbuckel bis ans Wasser
      if (d < 8 + 7 * n) return { h: Math.max(h, 0.25) + (1.3 - 0.8 * amHafen) * smooth(0.3, 0.8, n) * smooth(0, 3, d), typ: 'fels' };
      break;
    case 'steine':
      if (d < 4 + 5 * n) return { h, typ: n > 0.5 ? 'fels' : 'sand' };
      break;
    case 'kliff':
      // schmaler Steinstrand, dahinter eine Abbruchkante (am Hafen niedrig)
      if (d < 3) return { h, typ: n > 0.55 ? 'fels' : 'sand' };
      if (d < 12 + 4 * n) return { h: h + (0.7 + 2.2 * (1 - amHafen)) * smooth(3, 12, d), typ: 'kliff' };
      break;
    case 'schilf':
      if (d < 5 + 5 * n) return { h: Math.min(h, 0.3), typ: 'schilfrand' };
      break;
    case 'salzwiese':
      if (d < 9 + 9 * n) return { h: Math.min(h, 0.22 + d * 0.01), typ: 'salzwiese' };
      break;
    case 'watt':
      if (d < 10 + 8 * n) return { h: Math.min(h, 0.25 + d * 0.01), typ: 'salzwiese' };
      break;
    case 'wald':
      // Wald bis fast ans Wasser, nur ein schmaler Kiesstreifen
      if (d < 2.5) return { h, typ: 'sand' };
      if ((typ === 'gras' || typ === 'sand') && amHafen < 0.5) return { h: h + 0.6 * smooth(2, 14, d), typ: 'waldboden' };
      if (d < 9 + 5 * n && (typ === 'gras' || typ === 'sand')) return { h, typ: 'waldboden' };   // am Hafen: dunkler Saum statt Strand
      break;
    case 'sand':
      if (d < 11 + 7 * n && typ === 'gras') return { h, typ: 'sand' };
      break;
  }
  return { h, typ };
}

/** Abstand außerhalb der Hafenfläche in Planeinheiten (0 oder negativ = innerhalb). */
export function hafenAbstand(px, py, stufe = 6) {
  // Stufe 1 und 2 bebauen nur den Westteil (Steg A und B); östlich davon reicht die Natur bis an den Ort
  const x1 = stufe <= 2 ? HAFENFLAECHE_KLEIN_X1 : HAFENFLAECHE.x1;
  return Math.max(HAFENFLAECHE.x0 - px, px - x1, HAFENFLAECHE.y0 - py, py - HAFENFLAECHE.y1);
}
const HAFENFLAECHE_KLEIN_X1 = 0;

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

/**
 * Wie baggern, gräbt aber auch Land ab: Der Hafen wächst ins Gelände. Wo vorher Land war,
 * entsteht innen eine steile, befestigte Kante (Steinschüttung) statt eines langen Hangs.
 */
function graben(h, px, py, poly, tiefe, rand = 10, kante = 7) {
  if (h < 0) return baggern(h, px, py, poly, tiefe, rand);
  const d = polyAbstand(px, py, poly);
  if (d >= 0) return h;
  return Math.min(h, -tiefe * smooth(0, kante, -d) - 0.3);
}

/** Abstand zu einem achsparallelen Rechteck { x0, x1, y0, y1 } (negativ innen). */
function kastenAbstand(px, py, k) {
  const dx = Math.max(k.x0 - px, px - k.x1), dy = Math.max(k.y0 - py, py - k.y1);
  return dx > 0 && dy > 0 ? Math.hypot(dx, dy) : Math.max(dx, dy);
}

/** Abstand zur Pflicht-See vor der Einfahrt samt Seeweg in die offene See (negativ darin). */
function seeAbstand(px, py, N) {
  const k = kastenAbstand(px, py, SEE_NORD);
  return N.seeweg ? Math.min(k, abstandZuLinie(px, py, N.seeweg.punkte) - N.seeweg.halb) : k;
}

/**
 * Fahrrinne von der Reede in die offene See: der kürzeste Weg über Wasser bis hinter den Außenring, möglichst
 * in der Mitte des Wassers. punkt() baggert sie auf 4,6 m aus. So hat jede Küste einen Seeweg, auch flache
 * Bodden und das Watt; in ohnehin tiefem Wasser ändert sie nichts. Hängt nur von der Küste ab, nicht von der Stufe.
 * @returns {{ punkte: number[][], halb: number, tiefe: number, bb: number[] } | null}  Planeinheiten
 */
export function fahrrinne() {
  const N = natur();
  if (_rinne.N !== N) { _rinne.N = N; _rinne.weg = sucheFahrrinne(N, 25) ?? sucheFahrrinne(N, 10); }
  return _rinne.weg;
}
const _rinne = { N: null, weg: null };
function sucheFahrrinne(N, uferAbstand) {
  const G = 20, gx0 = AUSSEN.x0 - 2 * G, gy0 = AUSSEN.y0 - 2 * G;
  const nx = Math.ceil((AUSSEN.x1 - AUSSEN.x0) / G) + 5, ny = Math.ceil((AUSSEN.y1 - AUSSEN.y0) / G) + 5, n = nx * ny;
  const draussen = (px, py) => px <= AUSSEN.x0 || px >= AUSSEN.x1 || py <= AUSSEN.y0 || py >= AUSSEN.y1;
  // Kosten je Zelle: 0 = gesperrt (Land, Ufersaum, Hafen), sonst 1 in freiem Wasser bis 3 nah am Ufer
  const kosten = new Float32Array(n);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const px = gx0 + i * G, py = gy0 + j * G;
    if (draussen(px, py)) { kosten[j * nx + i] = 1; continue; }
    if (px > -440 && px < 450 && py > -220 && py < 250) continue;   // nicht durch den Hafen
    const q = N.probe(px, py);
    if (q.L < 0 && q.d < -uferAbstand) kosten[j * nx + i] = 1 + 2 * smooth(-90, -uferAbstand, q.d);
  }
  const start = Math.round((SEE_NORD.y1 - 80 - gy0) / G) * nx + Math.round(((SEE_NORD.x0 + SEE_NORD.x1) / 2 - gx0) / G);
  kosten[start] = kosten[start] || 1;
  const dist = new Float64Array(n).fill(Infinity), von = new Int32Array(n).fill(-1), fertig = new Uint8Array(n);
  dist[start] = 0;
  const offen = [start];
  let ziel = -1;
  while (offen.length) {
    // kleinste Entfernung zuerst (die Liste bleibt kurz: nur der Rand der Suche)
    let b = 0;
    for (let q = 1; q < offen.length; q++) if (dist[offen[q]] < dist[offen[b]]) b = q;
    const k = offen[b];
    offen[b] = offen[offen.length - 1]; offen.pop();
    if (fertig[k]) continue;
    fertig[k] = 1;
    const i = k % nx, j = (k - i) / nx;
    if (draussen(gx0 + i * G, gy0 + j * G)) { ziel = k; break; }
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const a = i + di, c = j + dj;
      if (a < 0 || c < 0 || a >= nx || c >= ny) continue;
      const q = c * nx + a;
      if (!kosten[q] || fertig[q]) continue;
      const d = dist[k] + (di && dj ? 1.4142 : 1) * (kosten[k] + kosten[q]) / 2;
      if (d < dist[q]) { dist[q] = d; von[q] = k; offen.push(q); }
    }
  }
  if (ziel < 0) return null;
  const zellen = [];
  for (let q = ziel; q >= 0; q = von[q]) zellen.push(q);
  zellen.reverse();
  // begradigen: nur Knicke behalten, zwischen denen die gerade Linie über freies Wasser führt
  const sicht = (p, q) => {
    const pi = p % nx, pj = (p - pi) / nx, qi = q % nx, qj = (q - qi) / nx;
    const m = Math.max(Math.abs(qi - pi), Math.abs(qj - pj)) * 2;
    for (let t = 1; t < m; t++) {
      const fi = pi + (qi - pi) * t / m, fj = pj + (qj - pj) * t / m;
      if (!kosten[Math.floor(fj) * nx + Math.floor(fi)] || !kosten[Math.ceil(fj) * nx + Math.ceil(fi)]
        || !kosten[Math.floor(fj) * nx + Math.ceil(fi)] || !kosten[Math.ceil(fj) * nx + Math.floor(fi)]) return false;
    }
    return true;
  };
  const knicke = [zellen[0]];
  for (let a = 0; a < zellen.length - 1;) {
    let b = zellen.length - 1;
    while (b > a + 1 && !sicht(zellen[a], zellen[b])) b--;
    knicke.push(zellen[b]);
    a = b;
  }
  const punkte = knicke.map((k) => { const i = k % nx; return [gx0 + i * G, gy0 + ((k - i) / nx) * G]; });
  const halb = 45;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of punkte) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return { punkte, halb, tiefe: 4.6, bb: [x0 - halb, y0 - halb, x1 + halb, y1 + halb] };
}

/** Abstand zum Pflichtwasser der Landschaft (vor den Stegen, Zufahrt, vor der Einfahrt), negativ darin. */
function pflichtAbstand(px, py, N) {
  return Math.min(wasserBedarf(px, py), seeAbstand(px, py, N), abstandZuLinie(px, py, N.route.punkte) - N.route.halb);
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
const BECKEN3 = [[-12, 0], [150, 0], [204, 120], [210, 176], [146, 176], [112, 128], [40, 112], [-12, 96]];
const BECKEN4 = [[-22, 0], [202, 0], [212, 96], [210, 176], [146, 176], [118, 174], [20, 178], [-22, 168]];
const BECKEN4_WEST = [[-84, 0], [-22, 0], [-22, 124], [-84, 112]];
const RINNE34 = [[152, 232], [204, 232], [240, 360], [180, 360]];
const AUSSENHAFEN = [[0, 226], [206, 226], [214, 280], [192, 302], [96, 320], [18, 312], [-8, 282]];
const RINNE5 = [[112, 304], [194, 300], [216, 360], [136, 360]];
// Hafenbecken: überall zwischen den Stegen mindestens so tief, dass die größte Klasse der Stufe
// von der Rinne bis vor jede Box kommt (Stufe 1-2: M 1,7 m, ab Stufe 3: L 2,4 m, jeweils mit Reserve).
const HAFENBECKEN12 = [[-160, 14], [60, 14], [60, 150], [-160, 150]];
const HAFENBECKEN3 = [[-150, 0], [208, 0], [214, 100], [204, 172], [60, 180], [-80, 168], [-150, 120]];
// Stufe 6: Liegeplatz der Barkasse östlich der Kaifläche (services.js barkasse, Wege in besuchswege.js)
const BARKASSE6 = [[200, 0], [252, 0], [252, 150], [226, 178], [200, 178]];
// Stufe 1 und 2: natürliche Rinne im See vor und hinter dem Seegatt (Mittellinie, halbe Breite)
const SEEGATT_RINNE = { y0: 110, y1: 300, halb: 14 };
// Stufe 6: Liegewanne an der Grossschiffspier westlich der Westmole (wie skripte/konzeptbilder/hafen_von_oben.py)
const PIERWANNE6 = [[-365, 228], [20, 228], [20, 520], [-365, 520]];   // Marinepier und Kreuzfahrtpier, nach Norden auslaufend (Abstimmung Thread Anlagen)

// ------------------------------------------------------------------ Geländeformen (formen.js, natur.js)

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
  const N = F.natur;
  const q = N.probe(px, py);
  const ln = seeNord(px), ms = meerSued(px);   // nur noch Maße für Seegatt und Durchstich
  const seeOffen = q.L < 0 ? 1 - smooth(0, 60, q.offenAbstand) : 0;
  const see = seeOffen;
  const hafenAb = hafenAbstand(px, py, stufe);
  // Ab Stufe 3 wird die Kaifläche aufgeschüttet, auch wo die Natur dort eine Bucht hatte
  const kai = stufe >= 3 && px >= KAIFLAECHE.x0 && px <= KAIFLAECHE.x1 && py <= Math.min(KAIFLAECHE.y1, stegUfer(px)) && py > KAIFLAECHE.y0;
  let h, typ;

  if (q.L >= 0 || kai) {
    // ---------------- Land
    const d = Math.max(0, q.d);
    // offene Küsten haben breite Sandstrände, Lagunen und Flüsse schmale
    const offenNah = 1 - smooth(20, 90, q.offenAbstand);
    const sandBreite = (g.strandBreite + 4 * Math.sin(px / 23)) * (0.55 + 0.75 * offenNah);
    if (kai) {
      h = 1.2; typ = 'pflaster';
      if (py < -13) typ = 'gras';
    } else {
      h = d < sandBreite ? 0.12 + d * 0.045 : 0.12 + sandBreite * 0.045 + Math.min(d - sandBreite, 8) * 0.06;
      typ = d < sandBreite ? 'sand' : 'gras';
    }
    // Hügel im Hinterland, nicht auf der Hafenfläche; weit im Land höher und weiter geschwungen
    const land = smooth(10, 40, d) * smooth(0, 30, hafenAb);
    if (g.huegel) h += g.huegel * land * fbm(px / 140, py / 110, 3);
    if (!g.deich) h += 5 * land * smooth(60, 420, d) * fbm(px / 320, py / 280, 23);   // Marsch an der Nordsee bleibt flach
    if (g.felsen) {
      const r = fbm(px / 45, py / 45, 9);
      const f = g.felsen * land * smooth(0.58, 0.9, r) * smooth(200, 340, Math.abs(px - 20));
      h += f;
      if (f > 2.2) typ = 'fels';
    }
    const st = q.stil;
    if (st.steil) {
      // Steilufer: gleich hinter dem schmalen Strand steigt das Land steil an, nicht am Hafen
      const kd = smooth(sandBreite * 0.6, sandBreite * 0.6 + 7, d), kh = smooth(25, 90, hafenAb);
      if (kd * kh > 0) {
        h += st.steil * kd * kh * (0.75 + 0.5 * fbm(px / 60, py / 60, 41)) * (0.4 + 0.6 * offenNah);
        if (kd > 0.08 && kd < 0.85 && kh > 0.6) typ = 'fels';
      }
    }
    if (q.duene > 0.05 && hafenAb > 0) {
      // Dünen auf Nehrungen und Haken: Profil quer zur Linie, wellig
      const welle = 0.6 + 0.4 * fbm(px / 30, py / 12, 17);
      const hd = 0.25 + q.duene * g.duenenHoehe * welle * smooth(0, 20, hafenAb);
      if (hd > h) h = hd;
      typ = d < 4 ? 'sand' : q.duene < 0.3 ? 'sand' : q.duene < 0.6 ? 'duenengras' : 'duene';
    }
    if (q.fels > 0.4 && hafenAb > 10) {
      h += 2.5 * q.fels * (0.5 + fbm(px / 18, py / 18, 37)) * smooth(0, 6, d);
      if (d > 2) typ = 'fels';
    }
    if (q.hallig > 0) {
      // Hallig: flache Salzwiese, in der Mitte eine Warft
      h = Math.min(h, 0.7) + 2.2 * smooth(0.6, 0.85, q.hallig);
      typ = q.hallig > 0.6 ? 'gras' : 'salzwiese';
    }
    if (st.marsch && hafenAb > 20 && d < 50 && typ !== 'fels' && q.duene < 0.05) {
      const m = fbm(px / 40, py / 40, 63);
      if (m > 0.62 - 0.12 * st.marsch) { typ = 'salzwiese'; h = Math.min(h, 0.2 + d * 0.01); }
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
    const seeM = q.offenAbstand * PLAN_M;
    ({ h, typ } = vielfalt.land(px, py, h, typ, d, {
      stufe, region, uferAbstandM: d * PLAN_M, hafenAbstand: hafenAb, offeneSee: seeM < d * PLAN_M + 1, seeAbstandM: seeM,
      form: F.nr, formSteilufer: !!st.steil, insel: false,
    }));
    // Ufer je Küstentyp, auch direkt an den Stegen: so erkennt man den Typ schon in der Startansicht
    if (st.ufer && !kai && typ !== 'pflaster' && q.duene < 0.05) ({ h, typ } = uferArt(st.ufer, px, py, h, typ, d, hafenAb));
    // Straße und Wege (Promenade ist schon Pflaster)
    if (py < 0 && py > -100) {
      for (const w of wegeCache(stufe)) {
        if (w.typ === 'promenade') continue;
        if (abstandZuLinie(px, py, w.punkte) < w.breite / 2) {
          typ = 'weg';
          h = Math.min(h, (stufe >= 3 && px >= -150 && px <= 202 ? 1.2 : h));
          break;
        }
      }
    }
  } else {
    // ---------------- Wasser: Lagune, Bodden, Fluss, Förde oder offene See
    const dw = Math.max(0, -q.d);
    const tiefMax = (2.5 + 2.5 * seeOffen - 0.4 * q.kanal * (1 - seeOffen)) * (q.stil.tiefe ?? 1);
    h = -Math.max(0.2, tiefMax * (1 - Math.exp(-dw / (26 + 16 * seeOffen))) + 0.5 * wob);
    if (g.gezeiten) h -= g.gezeiten * smooth(0, 8, dw);
    typ = 'wasser';
    // Sandplaten vor Mündungen
    if (q.plate > -6) {
      const hp = -0.35 + 0.07 * q.plate + 0.15 * fbm(px / 14, py / 14, 71);
      if (hp > h) { h = hp; typ = hp >= 0 ? 'sand' : 'wasser'; }
    }
    // Watt: Nordsee vor offenen Küsten, Typ Watt überall; Platen fallen bei Niedrigwasser trocken, dazwischen Priele
    const wattBreite = Math.max((g.wattBreite || 0) * seeOffen, q.stil.watt || 0) * (0.6 + 0.8 * fbm(px / 90, py / 90, 3));
    if (wattBreite > 4 && dw < wattBreite + 6) {
      // weiche, große Platen: auch das grobe Netz am Kartenrand kann sie ohne Zacken zeigen
      const n = fbm(px / 70, py / 34, 51);
      const w = 0.12 - 1.1 * smooth(0.46, 0.62, n) - 1.3 * smooth(wattBreite - 10, wattBreite + 4, dw) - 1.6 * q.kanal;
      // Hafen, Zufahrt, Reede und alles, was der Ausbau ausbaggert, bleiben frei
      // Watt-Küste: die Platen reichen bis nah an die Stege
      const wattRand = q.stil.ufer === 'watt' ? 26 : 90;
      let frei = smooth(0, wattRand, pflichtAbstand(px, py, N) + (wattRand / 1.5) * (fbm(px / 80, py / 80, 57) - 0.5));
      if (stufe >= 5) frei = Math.min(frei, smooth(0, 24, Math.min(polyAbstand(px, py, AUSSENHAFEN), polyAbstand(px, py, RINNE5))));
      if (stufe >= 6) frei = Math.min(frei, smooth(0, 40, polyAbstand(px, py, PIERWANNE6)));
      if (frei > 0) { h = Math.max(h, h + (w - h) * frei); typ = 'watt'; }
    }
    // Schilfufer: flacher Saum vor dem Land, in dem das Schilf steht
    if (q.stil.ufer === 'schilf' && dw < 7 && pflichtAbstand(px, py, N) > 4) h = Math.max(h, -0.25 - 0.06 * dw);
    // Mindesttiefe vor der Einfahrt (Reede, Ankerfelder) und in der Zufahrt
    const reede = smooth(0, -50, seeAbstand(px, py, N));
    if (reede > 0) h = Math.min(h, h + (-4.6 - (g.gezeiten || 0) - h) * reede);
    // Fahrrinne in die offene See: ausgebaggert, wo das Wasser von Natur aus flacher ist
    const R = fahrrinne();
    if (R && px > R.bb[0] && px < R.bb[2] && py > R.bb[1] && py < R.bb[3]) {
      const k = smooth(R.halb, R.halb - 10, abstandZuLinie(px, py, R.punkte));
      if (k > 0) { const soll = -R.tiefe - (g.gezeiten || 0); if (soll < h) h += (soll - h) * k; }
    }
    if (typ !== 'watt' || h < -0.6) typ = h >= 0 ? typ : 'wasser';
  }

  // ---------------- Bauprojekte, die Wasser und Land verändern
  if (stufe <= 2 && h < 0 && py < 160) h = baggern(h, px, py, HAFENBECKEN12, 1.9, 8);
  if (stufe >= 3) {
    const vorher = h;
    if (py > 6 || h < 0 || (py > stegUfer(px) && px >= -150 && px <= 208)) {
      h = graben(h, px, py, HAFENBECKEN3, 2.6, 30);
      h = graben(h, px, py, stufe >= 4 ? BECKEN4 : BECKEN3, 3.5 + 0.4 * wob, 14);
      if (stufe >= 4) h = graben(h, px, py, BECKEN4_WEST, 2.6, 12);
      if (stufe < 5) h = graben(h, px, py, RINNE34, 4.4, 6);
    }
    if (vorher >= 0 && h < 0) typ = 'wasser';
    // Durchstich: gerade Kaimauern, innen zum Becken hin abgeschrägte Ecken (8 Planeinheiten)
    const halb = (DURCHSTICH[1] - DURCHSTICH[0]) / 2;
    const dx = Math.abs(px - ENGPASS_X);
    const fase = Math.max(0, ln + 8 - py);
    // Zur Beckenseite läuft die Rinne als runde Zunge aus (Höhenlinien sind Bögen), statt mit einer Kante quer zur Fahrt zu enden
    const zunge = smooth(ln - 50, ln, py + 50 - 50 * Math.min(1, dx / (halb + 24)) ** 2 - 38);
    const ziel = DURCHSTICH_TIEFE + (g.gezeiten || 0);
    if (py > ln - 12 && py < 236 && dx < halb + fase) {
      const tief = -ziel + 0.4 * smooth(halb - 6, halb + fase, dx);
      if (h > tief) h = tief;
      typ = 'wasser';
    } else if (py > ln - 50 && py <= ln - 12 && dx < halb + 24 && h < 0 && h > -ziel) {
      h += (-ziel - h) * zunge;
    } else if (py > ln - 4 && py < 226 && dx < halb + fase + 4 && h > -0.5) {
      h = 1.0; typ = 'steinschuettung';
    }
    if (stufe >= 5) {
      const v5 = h;
      if (py > 229) h = graben(h, px, py, AUSSENHAFEN, 5.0, 6);
      h = graben(h, px, py, RINNE5, 4.6, 6);
      if (v5 >= 0 && h < 0) typ = 'wasser';
      // Kai zwischen Hafenbecken und Außenhafen (trägt Seenotretter und Museumshafen)
      if (px > -4 && px <= 150.5 && py > 196 && py <= 229) { h = 1.3; typ = 'pflaster'; }
    }
    if (stufe >= 6) {
      const v6 = h;
      h = graben(h, px, py, PIERWANNE6, 8.5, 40, 2);
      if (py > 6) h = graben(h, px, py, BARKASSE6, 2.4, 10);
      if (v6 >= 0 && h < 0) typ = 'wasser';
    }
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
    // so breit wie gezeichnet: Steinschüttung an den Seiten (bis 0,6 Breite) und runder Kopf (bis 0,95 Breite)
    const kopf = m.punkte[m.punkte.length - 1];
    if (abstandZuLinie(px, py, m.punkte) < m.breite * 0.6 || Math.hypot(px - kopf[0], py - kopf[1]) < m.breite * 0.95) { h = 1.4; typ = 'mole'; }
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
  // Rand der Karte: Land läuft in den letzten rund 300 Einheiten mit unruhiger Küste ins Meer aus, damit es
  // nirgends an der geraden Kante des Außenrings abgeschnitten endet (man sieht flach und gedreht bis dorthin)
  const zumRand = Math.min(px - AUSSEN.x0, AUSSEN.x1 - px, py - AUSSEN.y0, AUSSEN.y1 - py);
  if (zumRand < 420) {
    let k = 1 - smooth(60, 300, zumRand + 120 * (fbm(px / 150, py / 150, 71) - 0.5));
    // Leuchttürme im Randbereich behalten ihre Landzunge
    for (const [lx, ly] of F.leuchttuerme || []) k *= smooth(50, 140, Math.hypot(px - lx, py - ly));
    if (k > 0) {
      const ziel = -5;
      const vorher = h;
      h = h + (ziel - h) * k * k * (3 - 2 * k);
      if (vorher >= 0 && h < 0) return { h, typ: 'wasser', see: 1 };
      if (h < 0) return { h, typ, see: Math.max(see, k) };
      if (h < 0.6 && typ !== 'sand') typ = 'sand';
    }
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

// Stegfeld der Stufen 1 und 2 (Liegeplätze und Stegpunkte über alle Stegbilder, Planeinheiten)
const STEGFELD = { 1: { x0: -138.5, x1: -94.4, y0: -11.2, y1: 49.6 }, 2: { x0: -143.8, x1: -30.4, y0: -11.2, y1: 73.5 } };
const _warte = new Map();
beiFormwechsel(() => _warte.clear());

/**
 * Stufe 1 und 2: Wartebojen als kompakter Block seitlich neben dem Stegfeld (nicht quer davor), das
 * Ankerfeld noch weiter außen auf derselben Seite. Vor den Stegen bleibt so der Weg von der Einfahrt
 * zu den Boxen frei, und wer ablegt, fährt nicht durch wartende Boote. Seite und Lage hängen vom
 * Gelände ab (Seed): genommen wird die Seite, auf der der Block am nächsten am Stegfeld in tiefem
 * Wasser liegt. Passt nirgends, bleibt die alte Reihe vor den Stegen (dort ist sicher Wasser).
 */
function seitenLage(stufe, region) {
  const key = `${stufe}|${region?.name ?? region?.id ?? ''}`;
  if (_warte.has(key)) return _warte.get(key);
  const box = STEGFELD[stufe];
  const ebbe = region?.gelaende?.gezeiten || 0;
  const tief = (px, py, rM) => warteplatzTiefe({ px, py, schwoikreisM: rM }, stufe, region) - ebbe;
  const abstand = 18;
  // Korridor von der Stegfront zur Durchfahrt (natur.route ist je Form die sichere Wasserstraße
  // vom Binnensee zum Seegatt). Bojen und Ankerfeld bleiben davon weg, der Weg bleibt frei.
  const route = gelaendeform().natur?.route;
  const korridor = [[(box.x0 + box.x1) / 2, box.y1 + 8], ...(route?.punkte ?? [[40, 140], [150, 172], [178, 200]])];
  const halb = route?.halb ?? 24;
  const abKorridor = (px, py) => {
    let d = Infinity;
    for (let i = 1; i < korridor.length; i++) {
      const [ax, ay] = korridor[i - 1], [bx, by] = korridor[i];
      const dx = bx - ax, dy = by - ay;
      const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1);
      d = Math.min(d, Math.hypot(px - ax - t * dx, py - ay - t * dy));
    }
    return d;
  };
  const formen = stufe === 1 ? [[1, 3], [2, 2], [3, 1]] : [[2, 3], [3, 2], [1, 6]];
  let best = null;
  // Bojenblock: erst streng (nicht vor die Stegfront), sonst etwas weiter hinaus
  for (const [vorne, rand] of [[6, 14], [30, 6]]) {
    for (const s of [1, -1]) for (const [spalten, zeilen] of formen) {
      const kante = s > 0 ? box.x1 : box.x0;
      outer: for (const dx of [0, 10, 20, 32, 46]) {
        for (const y0 of [14, 22, 30, 40, 52, 66]) {
          const lagen = [];
          for (let r = 0; r < zeilen; r++) for (let c = 0; c < spalten; c++) {
            lagen.push([kante + s * (34 + dx + c * abstand), y0 + r * abstand]);
          }
          if (lagen.some(([px, py]) => py > box.y1 + vorne || abKorridor(px, py) < halb + rand)) continue;
          if (!lagen.every(([px, py]) => tief(px, py, SCHWOIKREIS_M.M) >= 2)) continue;
          const k = dx + (y0 - 14) * 0.5 + (spalten - 1) * 6;
          if (!best || k < best.k) best = { k, lagen, seite: s > 0 ? 'ost' : 'west' };
          break outer;
        }
      }
    }
    if (best) break;
  }
  // Ankerfeld: nahe beim Bojenblock (sonst nahe bei den Stegen), nicht im Korridor, nicht auf den
  // Bojen, nicht an den Stegen; lieber kleiner als im Weg
  const mitte = best
    ? best.lagen.reduce((m, [px, py]) => [m[0] + px / best.lagen.length, m[1] + py / best.lagen.length], [0, 0])
    : [(box.x0 + box.x1) / 2, box.y1];
  const R0 = stufe === 1 ? 44 : 50;
  const uferAb = Math.max(box.x1, ...(best?.lagen ?? []).map(([px]) => px));
  const kand = [];
  for (const f of [1, 0.8, 0.65]) {
    const R = Math.round(R0 * f);
    for (let px = -280; px <= 220; px += 12) for (let py = 0; py <= 220; py += 12) {
      if (abKorridor(px, py) < R + halb + 6) continue;
      // Uferstreifen (y 18, data/verkehr.js UFER): der Paddler braucht östlich der Stege und Bojen
      // gut 20 Einheiten bis zum Ankerfeld (uferStrecke endet davor), sonst liegt das Feld weiter draußen
      if (py - R < 34 && px - R - 10 < uferAb + 46 && px + R + 10 > box.x0) continue;
      // Runde der Freizeitboote auf dem See (data/verkehr.js SEE_RUNDE) bleibt frei
      const sr = SEE_RUNDE[stufe];
      if (sr && Math.hypot(Math.max(sr.cx - sr.rx - px, 0, px - sr.cx - sr.rx), Math.max(sr.cy - sr.ry - py, 0, py - sr.cy - sr.ry)) < R + 14) continue;
      if (best?.lagen.some(([bx, by]) => Math.hypot(bx - px, by - py) < R + 14)) continue;
      const ex = Math.max(box.x0 - px, 0, px - box.x1), ey = Math.max(box.y0 - py, 0, py - box.y1);
      if (Math.hypot(ex, ey) < R + 24) continue;
      kand.push({ px, py, radius: R, k: Math.hypot(px - mitte[0], py - mitte[1]) + (R0 - R) * 12 });
    }
  }
  kand.sort((p, q) => p.k - q.k);
  let anker = null;
  for (const c of kand) {
    let ok = tief(c.px, c.py, 0) >= 2.2;
    for (let k = 0; ok && k < 12; k++) {
      const w = k / 12 * Math.PI * 2;
      ok = tief(c.px + c.radius * 0.8 * Math.cos(w), c.py + c.radius * 0.8 * Math.sin(w), 0) >= 1.8
        && tief(c.px + c.radius * 0.45 * Math.cos(w + 0.26), c.py + c.radius * 0.45 * Math.sin(w + 0.26), 0) >= 1.8;
    }
    if (!ok) continue;
    // genug Ankerplätze in tiefem Wasser (Raster wie unten in warteplaetze)
    const abstand = SCHWOIKREIS_M.M * 2 / PLAN_M, rr = c.radius - abstand * 0.45;
    let n = 0;
    for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) {
      const dx = (i + (j & 1 ? 0.5 : 0)) * abstand, dy = j * abstand * 0.866;
      if (Math.hypot(dx, dy) <= rr && tief(c.px + dx, c.py + dy, SCHWOIKREIS_M.M) >= 1.6) n++;
    }
    if (!anker || n > anker.n) anker = { px: c.px, py: c.py, radius: c.radius, n };
    if (n >= 12) break;
  }
  // zu wenig Plätze (flaches Revier, etwa Nordsee bei Niedrigwasser): alter Ankerkreis, dort ist sicher Wasser
  if (anker && anker.n < 8) anker = null;
  if (anker) delete anker.n;
  if (best || anker) best = { ...(best ?? {}), anker };
  _warte.set(key, best);
  return best;
}

/**
 * @param {number} stufe
 * @param {object} [region] Eintrag aus regionen.js (für die Tiefe an den Warteplätzen; ohne: Ostsee)
 */
export function warteplaetze(stufe, region) {
  region = typeof region === 'string' ? regionNach(region) : (region ?? regionNach('ostsee'));
  const bojen = [], ankerbereiche = [];
  const reihe = (id, x0, y0, dx, dy, n, groesse) => {
    for (let i = 0; i < n; i++) bojen.push({ id: `${id}${i + 1}`, px: x0 + dx * i, py: y0 + dy * i, groesse });
  };
  if (stufe <= 2) {
    // Nahe vor Steg A, damit die wartenden Boote in der Startansicht zu sehen sind.
    // Boote liegen mit dem Bug an der Boje, nach Osten bleibt gut 4 m Platz.
    const seite = seitenLage(stufe, region);
    // Rückfall (kein Platz neben den Stegen): Reihe vor den Stegen, dort ist nach natur.js sicher Wasser
    const lagen = seite?.lagen ?? (stufe === 1
      ? [[-100, 56], [-86, 53], [-72, 50]]
      : [[-112, 86], [-94, 90], [-76, 88], [-58, 92], [-40, 89], [-22, 92]]);
    lagen.forEach(([px, py], i) => bojen.push({ id: `see-${i + 1}`, px, py, groesse: 'M' }));
    // Ankerfeld außen neben den Bojen; Rückfall: Ankerkreis aus natur.js (BEDARF.wasser.kreise)
    ankerbereiche.push(seite?.anker
      ? { id: 'see-anker', ...seite.anker, groesse: 'M' }
      : stufe === 1
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
        // jeder Ankerplatz in tiefem Wasser (Schwoikreis), auch bei Niedrigwasser
        const tiefOk = stufe > 2 || warteplatzTiefe({ px, py, schwoikreisM: SCHWOIKREIS_M[b.groesse] }, stufe, region) - (region.gelaende?.gezeiten || 0) >= 1.6;
        if (Math.hypot(dx, dy) <= r && frei && tiefOk) liste.push([px, py]);
      }
    }
    if (!liste.length) liste.push([b.px, b.py]);
    liste.sort((p, q) => Math.hypot(p[0] - einfahrt[0], p[1] - einfahrt[1]) - Math.hypot(q[0] - einfahrt[0], q[1] - einfahrt[1]));
    liste.forEach(([px, py], i) => ankerplaetze.push({ id: `${b.id}-${i + 1}`, bereich: b.id, px, py, groesse: b.groesse, schwoikreisM: SCHWOIKREIS_M[b.groesse] }));
  }
  return { bojen: bojen.map(welt), ankerbereiche: ankerbereiche.map(welt), ankerplaetze: ankerplaetze.map(welt) };
}

/**
 * Geringste Wassertiefe (m) an einem Warteplatz: Mitte und rundum im Schwoikreis (Bojen 6 m).
 * Ein Boot dreht sich dort mit dem Wind, deshalb zählt der ganze Kreis und nicht nur die Mitte.
 */
export function warteplatzTiefe(o, stufe, region) {
  const r = (o.schwoikreisM ?? 6) / PLAN_M;
  let min = -punkt(o.px, o.py, stufe, region).h;
  for (let k = 0; k < 12; k++) {
    const w = k / 12 * Math.PI * 2;
    min = Math.min(min, -punkt(o.px + r * Math.cos(w), o.py + r * Math.sin(w), stufe, region).h);
  }
  return min;
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
