// Zonen des Geländes für die Wegsuche der Boote: was ist Steg, Liegeplatz, Bojen- und Ankerfeld,
// Hafenbecken, Durchfahrt, Binnenwasser und offene See, und wo kommen Boote von See auf die Karte.
// Reines JS ohne Three.js, damit Fahrwege, Spielregeln und Tests es nutzen können.
// Beschreibung: docs/landschaft.md, Abschnitt "Zonen und Seezugänge".
//
// Planeinheiten wie web/js/data/harbor.js (1 = 0,62 m, x Osten, y Norden). Welt: x = px * 0,62, z = -py * 0,62.
import { punkt, warteplaetze, PLAN_M, AUSSEN } from './gelaende.js';
import { festePunkte } from './karte.js';
import { region as regionNach } from './regionen.js';
import { natur } from './formen.js';
import { HAFEN } from '../../data/harbor.js';

/**
 * Zonen im Raster. Die Reihenfolge ist auch der Vorrang: Steg schlägt Liegeplatz, Liegeplatz schlägt Bojen usw.
 *   LAND        Land und Strand
 *   FLACH       Wasser unter 1 m (Sandbank, Ufersaum): nicht befahren
 *   STEG        Planken eines Stegs oder Kais samt Sicherheitsabstand: nie befahren
 *   LIEGEPLATZ  Box an einem Steg: nur das Boot, das dort anlegt
 *   BOJEN       Schwoikreis einer Warteboje: nur anlegen, nicht hindurchfahren
 *   ANKER       Ankerfeld: nur zum Ankern hinein, Durchfahrt meiden
 *   DURCHFAHRT  Engpass zwischen Becken und See: einspurig, Vorrang beachten
 *   BECKEN      Hafenwasser hinter der Durchfahrt (Gassen zwischen den Stegen, Wendeplatz)
 *   BINNEN      anderes geschütztes Wasser (Bodden, Lagune, Fluss), nicht mit dem Becken verbunden gedacht
 *   SEE         offene See und ihr Ufersaum
 */
export const ZONE = { LAND: 0, FLACH: 1, STEG: 2, LIEGEPLATZ: 3, BOJEN: 4, ANKER: 5, DURCHFAHRT: 6, BECKEN: 7, BINNEN: 8, SEE: 9 };
export const ZONE_NAME = ['land', 'flach', 'steg', 'liegeplatz', 'bojen', 'anker', 'durchfahrt', 'becken', 'binnen', 'see'];
/** Sicherheitsabstand um Stegplanken in Metern (Pfähle, Fender, Leinen). */
export const STEG_ABSTAND_M = 1.5;
/** Abstand um eine Warteboje über den Schwoikreis hinaus in Metern. */
export const BOJEN_ABSTAND_M = 2;
/** So weit reicht das Hafenwasser höchstens von der Innenseite der Einfahrt (Planeinheiten, 260 m). */
export const BECKEN_WEITE = 420;

const regionVon = (r) => (typeof r === 'string' || r == null ? regionNach(r || 'ostsee') : r);
const stufeVon = (s) => Math.max(1, Math.min(6, Math.round(s || 1)));

function abstandStrecke(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

/** Ausdehnung des Zonenrasters in Planeinheiten: Kernbereich, nach Norden bis hinter Reede und Seepiers der Stufe 6. */
// (Zahlen statt KERN aus gelaende.js: dieses Modul wird im Importkreis teils vor gelaende.js ausgewertet)
export const RASTER = { x0: -420, x1: 430, y0: -200, y1: 640 };

/**
 * Raster der Zonen über den Kernbereich (Hafen, Revier, Anfahrt).
 * @param {number} stufe
 * @param {string|object} [region]
 * @param {object} [o]  hafen (Standard HAFEN, zum Aufrufzeitpunkt gelesen, also mit dem aktuellen Stegbild),
 *                      warteplaetze (Standard warteplaetze(stufe); { bojen, ankerbereiche } mit px, py, radius),
 *                      schritt (Planeinheiten, Standard 2 = 1,24 m)
 * @returns {{ stufe, x0, y0, nx, ny, schritt, schrittM, zone: Uint8Array, tiefe: Float32Array,
 *             bei(x, z): number, name(x, z): string, flaecheM2: number[] }}
 * Zelle (i, j) hat die Mitte px = x0 + i * schritt, py = y0 + j * schritt.
 */
export function zonenRaster(stufe, region, o = {}) {
  stufe = stufeVon(stufe);
  const reg = regionVon(region), hafen = o.hafen ?? HAFEN, schritt = o.schritt ?? 2;
  const x0 = RASTER.x0, y0 = RASTER.y0;
  const nx = Math.floor((RASTER.x1 - x0) / schritt) + 1, ny = Math.floor((RASTER.y1 - y0) / schritt) + 1, n = nx * ny;
  const zone = new Uint8Array(n), tiefe = new Float32Array(n);
  const N = natur();
  const f = festePunkte(stufe);
  const e = f.engpass;
  // 1. Land, flaches Wasser, Durchfahrt; alles andere Wasser vorläufig BINNEN
  // Höhe an jeder zweiten Zelle aus der Landschaft, dazwischen gemittelt (viermal weniger Rechenzeit)
  const hoehe = new Float32Array(n);
  for (let j = 0; j < ny; j += 2) for (let i = 0; i < nx; i += 2) hoehe[j * nx + i] = punkt(x0 + i * schritt, y0 + j * schritt, stufe, reg).h;
  for (let j = 0; j < ny; j += 2) for (let i = 1; i < nx; i += 2) hoehe[j * nx + i] = i + 1 < nx ? (hoehe[j * nx + i - 1] + hoehe[j * nx + i + 1]) / 2 : hoehe[j * nx + i - 1];
  for (let j = 1; j < ny; j += 2) for (let i = 0; i < nx; i++) hoehe[j * nx + i] = j + 1 < ny ? (hoehe[(j - 1) * nx + i] + hoehe[(j + 1) * nx + i]) / 2 : hoehe[(j - 1) * nx + i];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const px = x0 + i * schritt, py = y0 + j * schritt, k = j * nx + i;
    const h = hoehe[k];
    tiefe[k] = h < 0 ? -h : 0;
    if (h >= 0) zone[k] = ZONE.LAND;
    else if (h > -1) zone[k] = ZONE.FLACH;
    else if (px >= e.x0 && px <= e.x1 && py >= e.y0 && py <= e.y1) zone[k] = ZONE.DURCHFAHRT;
    else zone[k] = ZONE.BINNEN;
  }
  // 2. Becken: Wasser, das von der Innenseite der Einfahrt aus erreichbar ist, ohne die Durchfahrt zu queren,
  //    höchstens BECKEN_WEITE weit (bei offenen Küsten ohne Molen endet das Hafenwasser dort) und nie seewärts
  //    der Durchfahrt
  const kBei = (px, py) => {
    const i = Math.round((px - x0) / schritt), j = Math.round((py - y0) / schritt);
    return i < 0 || j < 0 || i >= nx || j >= ny ? -1 : j * nx + i;
  };
  {
    let start = kBei(f.einfahrt.innen[0], f.einfahrt.innen[1]);
    // liegt der Innenpunkt nicht im freien Wasser, das nächste freie Wasser in der Nähe nehmen
    if (start < 0 || zone[start] !== ZONE.BINNEN) {
      start = -1;
      for (let r = 1; r <= 30 && start < 0; r++) for (let a = 0; a < 16 && start < 0; a++) {
        const k = kBei(f.einfahrt.innen[0] + r * 3 * Math.cos(a * Math.PI / 8), f.einfahrt.innen[1] - Math.abs(r * 3 * Math.sin(a * Math.PI / 8)));
        if (k >= 0 && zone[k] === ZONE.BINNEN) start = k;
      }
    }
    if (start >= 0) {
      const stapel = [start];
      zone[start] = ZONE.BECKEN;
      while (stapel.length) {
        const k = stapel.pop(), i = k % nx, j = (k - i) / nx;
        for (const q of [i > 0 ? k - 1 : -1, i < nx - 1 ? k + 1 : -1, j > 0 ? k - nx : -1, j < ny - 1 ? k + nx : -1]) {
          if (q < 0 || zone[q] !== ZONE.BINNEN) continue;
          const qi = q % nx, qx = x0 + qi * schritt, qy = y0 + ((q - qi) / nx) * schritt;
          if (qy > e.y1 + 10 || Math.hypot(qx - f.einfahrt.innen[0], qy - f.einfahrt.innen[1]) > BECKEN_WEITE) continue;
          zone[q] = ZONE.BECKEN;
          stapel.push(q);
        }
      }
    }
  }
  // 3. Offene See: Wasser bis 70 Planeinheiten (43 m) vor der offenen See, soweit es nicht Becken ist
  for (let j = 0; j < ny; j += 2) for (let i = 0; i < nx; i += 2) {
    const k = j * nx + i;
    const see = N.probe(x0 + i * schritt, y0 + j * schritt).offenAbstand < 70;
    if (!see) continue;
    for (const q of [k, i + 1 < nx ? k + 1 : -1, j + 1 < ny ? k + nx : -1, i + 1 < nx && j + 1 < ny ? k + nx + 1 : -1]) {
      if (q >= 0 && zone[q] === ZONE.BINNEN) zone[q] = ZONE.SEE;
    }
  }
  // 4. Ankerfelder und Bojen (nur auf Wasser), dann Liegeplätze und Stege (immer, auch über flachem Wasser)
  const male = (ax0, ay0, ax1, ay1, test, code, nurWasser) => {
    const i0 = Math.max(0, Math.floor((ax0 - x0) / schritt)), i1 = Math.min(nx - 1, Math.ceil((ax1 - x0) / schritt));
    const j0 = Math.max(0, Math.floor((ay0 - y0) / schritt)), j1 = Math.min(ny - 1, Math.ceil((ay1 - y0) / schritt));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = j * nx + i;
      if (zone[k] === ZONE.LAND || zone[k] === ZONE.STEG) continue;
      if (nurWasser && zone[k] < ZONE.ANKER) continue;
      if (test(x0 + i * schritt, y0 + j * schritt)) zone[k] = code;
    }
  };
  const w = o.warteplaetze ?? warteplaetze(stufe);
  for (const a of w.ankerbereiche ?? []) male(a.px - a.radius, a.py - a.radius, a.px + a.radius, a.py + a.radius, (px, py) => Math.hypot(px - a.px, py - a.py) <= a.radius, ZONE.ANKER, true);
  for (const b of w.bojen ?? []) {
    const r = (6 + BOJEN_ABSTAND_M) / PLAN_M;
    male(b.px - r, b.py - r, b.px + r, b.py + r, (px, py) => Math.hypot(px - b.px, py - b.py) <= r, ZONE.BOJEN, true);
  }
  const st = hafen.stufen?.[stufe] ?? hafen.stufen?.[String(stufe)];
  for (const p of hafen.plaetze ?? []) {
    const lage = p.lage?.[stufe] ?? p.lage?.[String(stufe)];
    if (!lage) continue;
    const [cx, cy, grad] = lage, a = (grad * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
    const hl = p.laenge / 2, hb = p.breite / 2, r = Math.hypot(hl, hb);
    male(cx - r, cy - r, cx + r, cy + r, (px, py) => {
      const dx = px - cx, dy = py - cy;
      return Math.abs(dx * ca + dy * sa) <= hl && Math.abs(-dx * sa + dy * ca) <= hb;
    }, ZONE.LIEGEPLATZ, false);
  }
  for (const l of st?.stege ?? []) {
    const halb = Math.max(1.2 / PLAN_M, l.breite ?? 2) / 2 + STEG_ABSTAND_M / PLAN_M;
    for (let q = 0; q < l.punkte.length - 1; q++) {
      const [ax, ay] = l.punkte[q], [bx, by] = l.punkte[q + 1];
      male(Math.min(ax, bx) - halb, Math.min(ay, by) - halb, Math.max(ax, bx) + halb, Math.max(ay, by) + halb,
        (px, py) => abstandStrecke(px, py, ax, ay, bx, by) <= halb, ZONE.STEG, false);
    }
  }
  const flaecheM2 = new Array(ZONE_NAME.length).fill(0), zM2 = (schritt * PLAN_M) ** 2;
  for (let k = 0; k < n; k++) flaecheM2[zone[k]] += zM2;
  const bei = (x, z) => {
    const k = kBei(x / PLAN_M, -z / PLAN_M);
    if (k >= 0) return zone[k];
    // außerhalb des Kernbereichs: nur Land oder See, billig aus der Naturkarte
    return N.probe(x / PLAN_M, -z / PLAN_M).L > 0 ? ZONE.LAND : ZONE.SEE;
  };
  return { stufe, x0, y0, nx, ny, schritt, schrittM: schritt * PLAN_M, zone, tiefe, flaecheM2, bei, name: (x, z) => ZONE_NAME[bei(x, z)] };
}

/** Wie weit die Seezugänge außerhalb des Außenrings liegen (Planeinheiten): dort sieht sie keine Zoomstufe. */
export const ZUGANG_RAND = 60;
const GROB = 20;   // Rasterweite der groben Seekarte in Planeinheiten (12,4 m)

/**
 * Seezugänge: Punkte auf See außerhalb des Außenrings, von denen Boote auf die Karte kommen und wohin sie
 * abfahren, mit einem groben Weg über Wasser bis vor die Einfahrt. Rund um die Karte verteilt; es bleiben
 * nur Punkte, die über tiefes Wasser mit der Einfahrt verbunden sind (nie über Land).
 * @param {number} stufe
 * @param {string|object} [region]
 * @param {object} [o]  tiefeM (Standard 2,5: so tief muss der Weg überall sein), abstand (Planeinheiten zwischen
 *                      zwei Zugängen am Rand, Standard 200)
 * @returns {Array<{ id, richtung: 'N'|'NO'|'O'|'SO'|'S'|'SW'|'W'|'NW', grad, x, z, px, py, laengeM, tiefeM,
 *                   umweg: boolean (Weg über 1,5-mal so lang wie die Luftlinie, also um Land herum),
 *                   aufKarte: boolean (nur bei ganz geschlossenem Revier: Zugang liegt im Binnenwasser auf der Karte),
 *                   weg: Array<{x, z}> }>}  weg[0] ist der Zugang, das letzte Element liegt vor der Einfahrt
 *                   (festePunkte(stufe).einfahrt.aussen). Sortiert nach Weglänge, kürzeste zuerst.
 */
export function seezugaenge(stufe, region, o = {}) {
  // Flache Reviere (Bodden, Watt): gibt es in der gewünschten Tiefe keinen Weg zur See, die nächste flachere
  // Stufe nehmen. Jeder Zugang nennt in tiefeM, wie tief sein Weg mindestens ist.
  const wunsch = o.tiefeM ?? 2.5;
  for (const t of [wunsch, 1.5, 1.0].filter((v, i) => i === 0 || v < wunsch)) {
    const liste = seezugaengeBei(stufe, region, { ...o, tiefeM: t });
    if (liste.length) return liste;
  }
  // Ganz geschlossenes Revier (ein Bodden ohne Seegatt): Boote kommen dann von den fernsten Ecken des
  // Binnenwassers, also von anderen Häfen am selben Wasser. Diese Zugänge liegen auf der Karte (aufKarte: true).
  return seezugaengeBei(stufe, region, { ...o, tiefeM: 1.0, binnen: true });
}

function seezugaengeBei(stufe, region, o) {
  stufe = stufeVon(stufe);
  const reg = regionVon(region), tiefeM = o.tiefeM, abstand = o.abstand ?? 200;
  const gx0 = AUSSEN.x0 - ZUGANG_RAND - GROB, gy0 = AUSSEN.y0 - ZUGANG_RAND - GROB;
  const nx = Math.ceil((AUSSEN.x1 + ZUGANG_RAND + GROB - gx0) / GROB) + 1, ny = Math.ceil((AUSSEN.y1 + ZUGANG_RAND + GROB - gy0) / GROB) + 1, n = nx * ny;
  const innen = (px, py) => px > AUSSEN.x0 && px < AUSSEN.x1 && py > AUSSEN.y0 && py < AUSSEN.y1;
  // tief genug? außerhalb des Außenrings ist überall tiefes Meer
  // Dünne Landstreifen (Nehrung, Haken, Mole) fallen durch ein 12-m-Raster: fern vom Hafen zählt deshalb auch
  // der Abstand zum Ufer aus der Naturkarte, am Hafen (Molen, Kai, Piers) wird jede Zelle fünfmal feiner geprüft.
  const N = natur();
  const e = festePunkte(stufe).engpass;
  const amHafen = (px, py) => px > -460 && px < 520 && py > -260 && py < 680;
  const tief = new Uint8Array(n);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const px = gx0 + i * GROB, py = gy0 + j * GROB, k = j * nx + i;
    if (!innen(px, py)) { tief[k] = 1; continue; }
    // nicht durch das Hafenbecken und die Durchfahrt hindurch: Zugänge kommen von der Seeseite
    if (px > e.x0 - GROB && px < e.x1 + GROB && py >= e.y0 - GROB / 2 && py <= e.y1 + GROB / 2) continue;
    const hafen = amHafen(px, py), q = hafen ? null : N.probe(px, py);
    if (q && q.d > -GROB) continue;
    const mitte = -punkt(px, py, stufe, reg).h;
    if (mitte < tiefeM) continue;
    // weit draußen in klar tiefem Wasser, fern von jeder Sandbank, gibt es zwischen den Rasterpunkten nichts Flaches
    if (q && q.d < -80 && q.plate < -30 && mitte >= tiefeM + 1.5) { tief[k] = 1; continue; }
    if (hafen) {
      let ok = true;
      for (let b = -2; b <= 2 && ok; b++) for (let a = -2; a <= 2 && ok; a++) {
        if ((a || b) && -punkt(px + a * GROB / 4, py + b * GROB / 4, stufe, reg).h < Math.min(tiefeM, 1.5)) ok = false;
      }
      if (!ok) continue;
    } else {
      // Sandbänke und Platen zwischen den Rasterpunkten
      let ok = true;
      for (let b = -1; b <= 1 && ok; b++) for (let a = -1; a <= 1 && ok; a++) {
        if ((a || b) && -punkt(px + a * GROB / 3, py + b * GROB / 3, stufe, reg).h < Math.min(tiefeM, 1.5)) ok = false;
      }
      if (!ok) continue;
    }
    tief[k] = 1;
  }
  // befahrbar: die Zelle und ihre acht Nachbarn sind tief (gut 12 m Abstand zu Land und Flachem)
  const frei = new Uint8Array(n);
  for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const k = j * nx + i;
    frei[k] = tief[k] && tief[k - 1] && tief[k + 1] && tief[k - nx] && tief[k + nx] && tief[k - nx - 1] && tief[k - nx + 1] && tief[k + nx - 1] && tief[k + nx + 1] ? 1 : 0;
  }
  // Ziel: vor der Einfahrt; liegt die Zelle nicht frei, die nächste freie in der Nähe
  const ziel = festePunkte(stufe).einfahrt.aussen;
  const kBei = (px, py) => Math.round((py - gy0) / GROB) * nx + Math.round((px - gx0) / GROB);
  let k0 = kBei(ziel[0], ziel[1]);
  if (!frei[k0]) {
    let best = -1, bd = Infinity;
    for (let dj = -6; dj <= 6; dj++) for (let di = -6; di <= 6; di++) {
      const k = k0 + dj * nx + di;
      if (k >= 0 && k < n && frei[k] && di * di + dj * dj < bd) { bd = di * di + dj * dj; best = k; }
    }
    // nur "tief" genügt notfalls auch (enge Einfahrt): dann ist das Ziel selbst der Anfang
    if (best < 0) { if (!tief[k0]) return []; frei[k0] = 1; } else k0 = best;
  }
  // Abstandsfeld ab dem Ziel (Dijkstra über acht Nachbarn, kleine Halde)
  const dist = new Float64Array(n).fill(Infinity), von = new Int32Array(n).fill(-1);
  const halde = [];
  const rein = (k, d) => {
    halde.push([d, k]);
    let i = halde.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (halde[p][0] <= halde[i][0]) break; [halde[p], halde[i]] = [halde[i], halde[p]]; i = p; }
  };
  const raus = () => {
    const top = halde[0], last = halde.pop();
    if (halde.length) {
      halde[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < halde.length && halde[l][0] < halde[m][0]) m = l;
        if (r < halde.length && halde[r][0] < halde[m][0]) m = r;
        if (m === i) break;
        [halde[m], halde[i]] = [halde[i], halde[m]]; i = m;
      }
    }
    return top;
  };
  dist[k0] = 0;
  rein(k0, 0);
  const nachbarn = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]];
  while (halde.length) {
    const [d, k] = raus();
    if (d > dist[k]) continue;
    const i = k % nx, j = (k - i) / nx;
    for (const [di, dj, c] of nachbarn) {
      const a = i + di, b = j + dj;
      if (a < 0 || b < 0 || a >= nx || b >= ny) continue;
      const q = b * nx + a;
      if (!frei[q] || d + c >= dist[q]) continue;
      dist[q] = d + c; von[q] = k;
      rein(q, d + c);
    }
  }
  // Kandidaten rund um den Außenring, ZUGANG_RAND weiter draußen
  const rx0 = AUSSEN.x0 - ZUGANG_RAND, rx1 = AUSSEN.x1 + ZUGANG_RAND, ry0 = AUSSEN.y0 - ZUGANG_RAND, ry1 = AUSSEN.y1 + ZUGANG_RAND;
  const kandidaten = [];
  const reihe = (ax, ay, bx, by) => {
    const lang = Math.hypot(bx - ax, by - ay), anz = Math.max(1, Math.round(lang / abstand));
    for (let q = 0; q < anz; q++) kandidaten.push([ax + (bx - ax) * (q + 0.5) / anz, ay + (by - ay) * (q + 0.5) / anz]);
  };
  reihe(rx0, ry1, rx1, ry1); reihe(rx1, ry1, rx1, ry0); reihe(rx1, ry0, rx0, ry0); reihe(rx0, ry0, rx0, ry1);
  const RICHTUNG = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
  if (o.binnen) {
    // je Himmelsrichtung die am weitesten entfernte erreichbare Stelle, mindestens 250 m Weg
    kandidaten.length = 0;
    const fern = new Array(8).fill(-1);
    for (let k = 0; k < n; k++) {
      if (!Number.isFinite(dist[k]) || dist[k] * GROB * PLAN_M < 250) continue;
      const i = k % nx, j = (k - i) / nx;
      const g = (Math.atan2(gx0 + i * GROB - ziel[0], gy0 + j * GROB - ziel[1]) * 180 / Math.PI + 360) % 360;
      const r = Math.round(g / 45) % 8;
      if (fern[r] < 0 || dist[k] > dist[fern[r]]) fern[r] = k;
    }
    for (const k of fern) if (k >= 0) { const i = k % nx, j = (k - i) / nx; kandidaten.push([gx0 + i * GROB, gy0 + j * GROB]); }
  }
  const sicht = (a, b) => {
    // gerade Strecke zwischen zwei Rasterzellen ganz über freies Wasser?
    const ai = a % nx, aj = (a - ai) / nx, bi = b % nx, bj = (b - bi) / nx;
    const schritte = Math.max(Math.abs(bi - ai), Math.abs(bj - aj)) * 2;
    for (let s = 1; s < schritte; s++) {
      // beide Zellen links und rechts der Linie müssen frei sein
      const fi = ai + (bi - ai) * s / schritte, fj = aj + (bj - aj) * s / schritte;
      if (!frei[Math.floor(fj) * nx + Math.floor(fi)] || !frei[Math.ceil(fj) * nx + Math.ceil(fi)]
        || !frei[Math.floor(fj) * nx + Math.ceil(fi)] || !frei[Math.ceil(fj) * nx + Math.floor(fi)]) return false;
    }
    return true;
  };
  const out = [];
  for (const [px, py] of kandidaten) {
    const k = kBei(px, py);
    if (!Number.isFinite(dist[k])) continue;
    // Weg zurückverfolgen und begradigen (nur Knicke behalten, zwischen denen freie Sicht ist)
    const zellen = [];
    for (let q = k; q >= 0; q = von[q]) zellen.push(q);
    const knicke = [zellen[0]];
    let a = 0;
    while (a < zellen.length - 1) {
      let b = zellen.length - 1;
      while (b > a + 1 && !sicht(zellen[a], zellen[b])) b--;
      knicke.push(zellen[b]);
      a = b;
    }
    const weg = knicke.map((q) => { const i = q % nx, j = (q - i) / nx; return { x: +((gx0 + i * GROB) * PLAN_M).toFixed(1), z: +(-(gy0 + j * GROB) * PLAN_M).toFixed(1) }; });
    weg[0] = { x: +(px * PLAN_M).toFixed(1), z: +(-py * PLAN_M).toFixed(1) };
    let laengeM = 0;
    for (let q = 1; q < weg.length; q++) laengeM += Math.hypot(weg[q].x - weg[q - 1].x, weg[q].z - weg[q - 1].z);
    // Himmelsrichtung vom Hafen aus gesehen (0 Grad = Norden, im Uhrzeigersinn)
    const grad = (Math.atan2(px - ziel[0], py - ziel[1]) * 180 / Math.PI + 360) % 360;
    const luftM = Math.hypot(px - ziel[0], py - ziel[1]) * PLAN_M;
    out.push({
      richtung: RICHTUNG[Math.round(grad / 45) % 8], grad: Math.round(grad), x: weg[0].x, z: weg[0].z, px: Math.round(px), py: Math.round(py),
      laengeM: Math.round(laengeM), tiefeM, umweg: laengeM > luftM * 1.5, aufKarte: !!o.binnen, weg,
    });
  }
  out.sort((p, q) => p.laengeM - q.laengeM);
  const zaehler = {};
  for (const z of out) { zaehler[z.richtung] = (zaehler[z.richtung] ?? 0) + 1; z.id = `see-${z.richtung.toLowerCase()}-${zaehler[z.richtung]}`; }
  return out;
}
