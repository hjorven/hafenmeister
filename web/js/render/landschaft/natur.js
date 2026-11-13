// Hafenmeister: die natürliche Landschaft rund um den Hafen, je Spiel anders.
//
// Zehn Küstentypen (TYPEN), jeder mit eigener Abwandlung je Spielstand (seed). Ein Typ legt fest,
// wie Küste, Inseln, Nehrungen, Flüsse und Buchten liegen; der Zufall verschiebt, biegt und verteilt.
// Daraus entsteht eine "Landigkeit" L (Planeinheiten, ungefähr Abstand zur Uferlinie): L > 0 Land,
// L < 0 Wasser. Höhen, Tiefen und Oberflächen rechnet gelaende.js daraus.
//
// Fest in jedem Typ (PFLICHT), damit Stege, Liegeplätze, Bojen und Anlagen überall passen:
//   - der Uferstreifen, an dem die Stege hängen (x -210..70, Ufer wie suedufer),
//   - Wasser vor den Stegen der Stufen 1 und 2 (x -170..95 bis y 175),
//   - offenes Wasser nördlich der Einfahrt (x -400..460, y 245..540: Reede, Ankerfelder, Piers),
//   - eine natürliche Zufahrt von dort zum Hafen (Stufe 1 und 2, ab Stufe 3 gibt es den Durchstich),
//   - Land für Ort, Straße und Dorf südlich des Hafens (y < -30, |x| < 420).
// Alles andere ist frei: der Hafenausbau (gelaende.js) baggert und schüttet in höheren Stufen nach.
//
// Reines JavaScript ohne Three.js, damit Tests und Werkzeuge es in Node nutzen können.

export const PLAN_M = 0.62;
/** Ganze Welt in Planeinheiten (etwa 1,6 x 1,3 km). */
export const WELT = { x0: -1300, x1: 1300, y0: -800, y1: 1300 };
/** Fein gerechnetes Gelände und Tiefentextur (Planeinheiten); außerhalb nur der grobe Außenring. */
export const BEREICH = { x0: -900, x1: 900, y0: -560, y1: 900 };

// ------------------------------------------------------------------ Hilfen

function hash2(ix, iy, seed) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function rauschen(x, y, seed) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
export function fbm(x, y, seed) {
  return 0.5 * rauschen(x, y, seed) + 0.27 * rauschen(x * 2.03, y * 2.03, seed + 7)
    + 0.15 * rauschen(x * 4.1, y * 4.1, seed + 13) + 0.08 * rauschen(x * 8.3, y * 8.3, seed + 29);
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

/** Zufall mit Startwert (mulberry32). */
function zufall(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const _flach = new WeakMap();
function flach(pts) {
  let f = _flach.get(pts);
  if (!f) {
    // je Strecke: ax, ay, dx, dy, 1/Länge², minX, maxX, minY, maxY
    f = new Float64Array(Math.max(0, pts.length - 1) * 9);
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1], o = i * 9;
      f[o] = ax; f[o + 1] = ay; f[o + 2] = bx - ax; f[o + 3] = by - ay;
      f[o + 4] = 1 / (((bx - ax) ** 2 + (by - ay) ** 2) || 1);
      f[o + 5] = Math.min(ax, bx); f[o + 6] = Math.max(ax, bx); f[o + 7] = Math.min(ay, by); f[o + 8] = Math.max(ay, by);
    }
    _flach.set(pts, f);
  }
  return f;
}
function abstandLinie(px, py, pts) {
  const f = flach(pts);
  let best2 = Infinity, best = Infinity;
  for (let o = 0; o < f.length; o += 9) {
    // Untergrenze über den Rahmen der Strecke: weit weg, also gar nicht erst genau rechnen
    const ux = px < f[o + 5] ? f[o + 5] - px : px > f[o + 6] ? px - f[o + 6] : 0;
    if (ux >= best) continue;
    const uy = py < f[o + 7] ? f[o + 7] - py : py > f[o + 8] ? py - f[o + 8] : 0;
    if (uy >= best) continue;
    const qx = px - f[o], qy = py - f[o + 1];
    let t = (qx * f[o + 2] + qy * f[o + 3]) * f[o + 4];
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const ex = qx - t * f[o + 2], ey = qy - t * f[o + 3], d2 = ex * ex + ey * ey;
    if (d2 < best2) { best2 = d2; best = Math.sqrt(d2); }
  }
  return best;
}

/** Weiche Kurve durch Stützpunkte [[x, y], ...] (x aufsteigend): y bei x. */
function kurve(pts) {
  return (x) => {
    if (x <= pts[0][0]) return pts[0][1];
    const n = pts.length;
    if (x >= pts[n - 1][0]) return pts[n - 1][1];
    let i = 0;
    while (pts[i + 1][0] < x) i++;
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
    const t = (x - p1[0]) / (p2[0] - p1[0]);
    const m1 = (p2[1] - p0[1]) / (p2[0] - p0[0] || 1) * (p2[0] - p1[0]);
    const m2 = (p3[1] - p1[1]) / (p3[0] - p1[0] || 1) * (p2[0] - p1[0]);
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * p1[1] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2[1] + (t3 - t2) * m2;
  };
}

/** Linie mit Zickzack nach Rauschen: aus wenigen Punkten viele, leicht gewunden. */
function gewunden(pts, schritt, amp, seed) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const len = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.round(len / schritt));
    const nx = -(by - ay) / (len || 1), ny = (bx - ax) / (len || 1);
    for (let k = 0; k < n; k++) {
      const t = k / n, s = (i + t) * 3.1;
      const w = (rauschen(s, 0.5, seed) - 0.5) * 2 * amp * Math.sin(Math.PI * Math.min(1, (i + t) / 0.5, (pts.length - 1 - i - t) / 0.5));
      out.push([lerp(ax, bx, t) + nx * w, lerp(ay, by, t) + ny * w]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

// ------------------------------------------------------------------ Feste Bereiche

const kuesteAlt = (x) => 5 * Math.sin(x / 70) + 3 * Math.sin(x / 31 + 1);
/** Uferlinie am Stegstreifen (wie das alte Südufer, an dem harbor.js und die Stegbilder hängen). */
export const stegUfer = (x) => kuesteAlt(x);
export const STEGSTREIFEN = { x0: -150, x1: -20 };
/** Wasser östlich der Stege für die Runde der Vorbeifahrer (data/verkehr.js SEE_RUNDE) in Stufe 1 und 2. */
export const RUNDE12 = { x0: 32, x1: 342, y0: 84, y1: 174 };
export const SEE_NORD = { x0: -440, x1: 480, y0: 245, y1: 820 };

/**
 * Was der Hafen von der Natur wirklich braucht (Spielkoordinaten), sonst ist die Küste frei.
 * Ab Stufe 3 baggert und schüttet gelaende.js nach (Becken, Kaifläche, Außenhafen).
 *   wasser: Stege und Liegeplätze aller Stegbilder der Stufen 1 und 2, Wartebojen, Ankerfelder,
 *           Uferstrecke der kleinen Boote (data/verkehr.js UFER) und die Runde (SEE_RUNDE).
 *   land:   Gebäude und Dienste (render/buildings.js PLAN, data/services.js), soweit sie nicht in der
 *           Kaifläche ab Stufe 3 liegen, dazu Landstraße (y -88) und die Zugänge zu den Stegen.
 * tests/gelaendeform.test.mjs prüft, dass alle Stegbilder und Lagen hineinpassen.
 */
export const BEDARF = {
  wasser: {
    kaesten: [
      { x0: -152, x1: -16, y0: 6, y1: 100, rund: 22 },   // Stege, Liegeplätze und Bojen Stufe 1 und 2
      { x0: -90, x1: 68, y0: 6, y1: 30, rund: 10 },      // Uferstrecke
      RUNDE12,
    ],
    kreise: [[-25, 102, 56], [42, 130, 62]],              // Ankerfelder Stufe 1 und 2
  },
  land: {
    kreise: [
      // Gebäude (buildings.js PLAN) der Stufen 1 und 2 und alle außerhalb der Kaifläche
      [-95, -28, 14], [-72, -26, 14], [-118, -36, 12], [-36, -27, 12], [-157, -22, 12],
      [-150, -46, 14], [-168, -40, 14], [-140, -62, 14], [-96, -62, 14], [-232, -40, 14], [-250, -56, 14], [-270, -36, 14],
      [-14, -8, 10],
      // Dienste (services.js) der Stufen 1 und 2 und alle außerhalb der Kaifläche
      [-126, -22, 12], [-127, -9, 8], [-228, -21, 12], [-56, -22, 10], [-24, -14, 12], [-163, -9, 10], [-196, -44, 16], [216, -10, 14],
    ],
    linien: [
      { punkte: [[-300, -88], [250, -88]], halb: 10 },     // Landstraße
      { punkte: [[-105, -88], [-105, -10]], halb: 5 },     // Zugang A
      { punkte: [[-55, -88], [-55, -10]], halb: 5 },       // Zugang B
    ],
  },
};
/** Kaifläche ab Stufe 3 (gelaende.js schüttet sie auf, wo die Natur Wasser hat). */
export const KAIFLAECHE = { x0: -150, x1: 202, y0: -92, y1: 6 };

/** Weiches Maximum und Minimum (k = Breite des Übergangs), damit Pflichtbereiche nicht eckig wirken. */
function smax(a, b, k) { const h = clamp(0.5 + 0.5 * (a - b) / k, 0, 1); return lerp(b, a, h) + k * h * (1 - h); }
function smin(a, b, k) { return -smax(-a, -b, k); }
/** Abstand zu einem Rechteck mit abgerundeten Ecken (negativ innen). */
function kasten(px, py, x0, x1, y0, y1, rund) {
  const qx = Math.abs(px - (x0 + x1) / 2) - (x1 - x0) / 2 + rund, qy = Math.abs(py - (y0 + y1) / 2) - (y1 - y0) / 2 + rund;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rund;
}

/** Pflicht-Werte: Land erzwingen (max) und Wasser erzwingen (min) auf eine Landigkeit L. */
function pflicht(px, py, L, route, seed) {
  const zack = 14 * (fbm(px / 40, py / 40, seed + 91) - 0.5);
  // Land für Gebäude, Dienste, Straße und Zugänge (weicher Rand, damit es nicht nach Kreisen aussieht)
  const welle = 10 * (fbm(px / 60, py / 60, seed + 93) - 0.5);
  L = smax(L, landBedarf(px, py) + welle, 24);
  // Uferstreifen an den Stegwurzeln: Land bis zum Ufer, an den Enden weich in die freie Küste übergehend
  const inStreifen = Math.min(px - STEGSTREIFEN.x0, STEGSTREIFEN.x1 - px);
  if (inStreifen > -40 && py < 40 && py > -60) {
    const k = smooth(-40, 0, inStreifen) * smooth(40, 14, py) * smooth(-60, -30, py);
    L = lerp(L, stegUfer(px) - py, k);
  }
  // Wasser für Stege, Bojen, Ankerfelder, Uferstrecke und Runde
  L = smin(L, wasserBedarf(px, py) + zack * 0.5, 24);
  // offenes Wasser vor der Einfahrt
  L = smin(L, kasten(px, py, SEE_NORD.x0, SEE_NORD.x1, SEE_NORD.y0, SEE_NORD.y1, 110) + zack, 50);
  // natürliche Zufahrt
  if (route) L = smin(L, abstandLinie(px, py, route.punkte) - route.halb, 20);
  return L;
}

/** Wie weit (px, py) im Pflicht-Land liegt (positiv innen, Planeinheiten). */
function landBedarf(px, py) {
  let best = -Infinity;
  for (const [x, y, r] of BEDARF.land.kreise) {
    const dx = px - x, dy = py - y;
    if (Math.abs(dx) > r + 60 || Math.abs(dy) > r + 60) continue;
    best = Math.max(best, r - Math.sqrt(dx * dx + dy * dy));
  }
  for (const l of BEDARF.land.linien) best = Math.max(best, l.halb - abstandLinie(px, py, l.punkte));
  return best;
}
/** Abstand zum Pflicht-Wasser (negativ innen). */
export function wasserBedarf(px, py) {
  let best = Infinity;
  for (const k of BEDARF.wasser.kaesten) best = Math.min(best, kasten(px, py, k.x0, k.x1, k.y0, k.y1, k.rund ?? 30));
  for (const [x, y, r] of BEDARF.wasser.kreise) best = Math.min(best, Math.hypot(px - x, py - y) - r);
  return best;
}

// ------------------------------------------------------------------ Bausteine
// kueste: Kurve, südlich davon Land. insel/bucht: Ellipse mit rauem Rand. band: Landstreifen
// entlang einer Linie (Nehrung, Haken). kanal: Wasserlauf entlang einer Linie (Fluss, Priel, Sund).

function ellipse(px, py, b) {
  const c = Math.cos(b.dreh || 0), s = Math.sin(b.dreh || 0);
  const dx = (px - b.x) * c + (py - b.y) * s, dy = -(px - b.x) * s + (py - b.y) * c;
  const e = Math.sqrt((dx / b.rx) ** 2 + (dy / b.ry) ** 2);
  const rau = 1 + (b.rau ?? 0.25) * (fbm(px / (b.korn ?? 18), py / (b.korn ?? 18), b.seed ?? 5) - 0.5) * 2;
  return (1 - e * rau) * Math.min(b.rx, b.ry);
}

// ------------------------------------------------------------------ Die zehn Küstentypen

/** Hilfe: Zufallszahl zwischen a und b. */
const zw = (r, a, b) => a + (b - a) * r();
const vz = (r) => (r() < 0.5 ? -1 : 1);

// Jeder Typ beschreibt die Natur in eigenen Koordinaten ("Naturkarte", See grob im Norden) und sagt,
// wo darin der Hafen liegt: hafen = { x, y, dreh } (dreh in Bogenmaß, 0 = Hafen schaut nach Norden).
// bauen() sucht von dort aus das echte Ufer und legt die Spielkoordinaten (Hafen bei 0,0, See vorne)
// so in die Naturkarte, dass der Hafen dort sitzt. Der Hafen wandert also durch die Landschaft.

/** Küstenlinie aus zufälligen Stützpunkten alle schritt Einheiten. */
function freieKueste(r, { von = -2600, bis = 2600, schritt = 320, amp = 140, y = 0 } = {}) {
  const pts = [];
  for (let x = von; x <= bis; x += schritt) pts.push([x, y + zw(r, -amp, amp)]);
  return pts;
}

function nehrung(r) {
  // Lagune hinter einer gewundenen Nehrung mit Dünen, zwei oder drei Seegatten, Salzwiesen am Lagunenufer
  const kueste = freieKueste(r, { amp: 120 });
  const yN = zw(r, 720, 820);
  const npts = [];
  for (let x = -2600; x <= 2600; x += 400) npts.push([x, yN + zw(r, -90, 90) + 0.00004 * x * x]);
  const gates = [zw(r, -500, 500)];
  gates.push(gates[0] + vz(r) * zw(r, 700, 1100));
  if (r() < 0.6) gates.push(-gates[1] * zw(r, 0.8, 1.2));
  const kn = kurve(npts);
  return {
    kueste, rauheit: 12,
    baender: [{ punkte: gewunden(npts, 60, 22, 41), halb: zw(r, 20, 28), duene: 1 }],
    buchten: [
      ...gates.map((x) => ({ x, y: kn(x), rx: zw(r, 28, 44), ry: 48, rau: 0.15 })),
      ...Array.from({ length: 3 }, () => ({ x: zw(r, -1500, 1500), y: zw(r, -60, 40), rx: zw(r, 120, 260), ry: zw(r, 80, 160), rau: 0.3, korn: 30 })),
    ],
    inseln: Array.from({ length: Math.floor(zw(r, 2, 6)) }, () => ({ x: zw(r, -1500, 1500), y: zw(r, 200, 520), rx: zw(r, 20, 60), ry: zw(r, 12, 30), art: 'schilf', dreh: zw(r, -0.5, 0.5) })),
    hafen: { x: zw(r, -700, 700), y: 0, dreh: zw(r, -0.45, 0.45) },
    // Am Hafen: die Nehrung liegt gut 130 m vor den Stegen quer vor der Lagune, das Seegatt ist die Zufahrt
    nah: (q) => {
      const y = zw(q, 214, 222), pts = [];
      // nach Westen sinkt sie zum Festland ab (Liegewanne der Großschiffe ab Stufe 6 bleibt frei)
      const ny = (x) => y - 0.00005 * x * x - 0.25 * Math.max(0, -150 - x);
      for (let x = -1000; x <= 1000; x += 100) pts.push([x, ny(x) + zw(q, -10, 10)]);
      const tor = zw(q, 380, 620);
      return {
        baender: [{ punkte: gewunden(pts, 40, 8, 43), halb: zw(q, 17, 21), duene: 1 }],
        buchten: [{ x: tor, y: ny(tor), rx: zw(q, 26, 36), ry: 46, rau: 0.15 }],
        inseln: Array.from({ length: 3 }, () => ({ x: vz(q) * zw(q, 220, 520), y: zw(q, 120, 170), rx: zw(q, 18, 36), ry: zw(q, 8, 16), art: 'schilf', dreh: zw(q, -0.4, 0.4) })),
        leuchttuerme: [[tor + 90, ny(tor + 90)]],
      };
    },
    stil: { marsch: 0.7 },
    leuchttuerme: gates.slice(0, 2).map((x) => [x + 80, kn(x + 80)]),
  };
}

function offeneBucht(r) {
  // weite Bucht zwischen zwei bewaldeten Landzungen mit Steilufer, Felsen vor den Spitzen
  const tw = zw(r, 700, 950), to = zw(r, 700, 950), tief = zw(r, 700, 950);
  const kueste = [[-2600, zw(r, 600, 900)], [-tw - 300, zw(r, 900, 1200)], [-tw, tief + zw(r, -60, 60)], [-tw + 200, zw(r, 250, 400)], [-tw * 0.4, zw(r, -40, 60)], [0, 0],
    [to * 0.4, zw(r, -40, 60)], [to - 200, zw(r, 250, 400)], [to, tief + zw(r, -60, 60)], [to + 300, zw(r, 900, 1200)], [2600, zw(r, 600, 900)]];
  return {
    kueste, rauheit: 18,
    inseln: [
      { x: -tw + zw(r, -40, 80), y: tief + zw(r, 120, 200), rx: zw(r, 20, 34), ry: zw(r, 14, 24), art: 'fels' },
      { x: to + zw(r, -60, 60), y: tief + zw(r, 140, 240), rx: zw(r, 30, 60), ry: zw(r, 20, 34), art: 'wald' },
      { x: zw(r, -400, 400), y: tief * zw(r, 0.75, 0.9), rx: zw(r, 10, 18), ry: zw(r, 8, 12), art: 'fels' },
    ],
    hafen: { x: zw(r, -350, 350), y: 0, dreh: zw(r, -0.5, 0.5) },
    // Am Hafen: zwei bewaldete Landzungen links und rechts, Felsen vor den Spitzen
    nah: (q) => {
      const w = zw(q, 200, 260), o = zw(q, 400, 440);
      const zunge = (x0, x1, y1, halb) => gewunden([[x0, -60], [lerp(x0, x1, 0.6), y1 * 0.6], [x1, y1]], 40, 14, 45 + x0);
      return {
        baender: [
          { punkte: zunge(-w - 260, -w, zw(q, 200, 260)), halb: zw(q, 46, 62), duene: 0 },
          { punkte: zunge(o + 260, o, zw(q, 210, 270)), halb: zw(q, 40, 56), duene: 0 },
        ],
        inseln: [
          { x: -w + zw(q, 10, 40), y: zw(q, 270, 300), rx: zw(q, 8, 14), ry: zw(q, 6, 10), art: 'fels' },
          { x: o - zw(q, 10, 40), y: zw(q, 280, 310), rx: zw(q, 8, 14), ry: zw(q, 6, 10), art: 'fels' },
          { x: -w - 120, y: 60, rx: 120, ry: 110, art: 'wald', rau: 0.2 },
          { x: o + 140, y: 70, rx: 130, ry: 110, art: 'wald', rau: 0.2 },
        ],
      };
    },
    stil: { steil: zw(r, 9, 14), wald: 0.5 },
    leuchttuerme: [[-tw + 40, tief], [to - 40, tief]],
  };
}

function flussmuendung(r) {
  // Ein Fluss kommt in Schleifen aus dem Land und weitet sich zur Mündung; der Hafen liegt am Rand des Trichters
  const kueste = freieKueste(r, { amp: 90 });
  const fluss = gewunden([[zw(r, -500, 500), -2600], [zw(r, -400, 400), -1600], [zw(r, -300, 300), -900], [zw(r, -120, 120), -300], [0, 200]], 45, 110, 77);
  const seite = vz(r);
  return {
    kueste, rauheit: 9,
    kanaele: [{ punkte: fluss, halb: zw(r, 26, 36) }, { punkte: gewunden([[seite * -60, -200], [seite * -500, -500], [seite * -900, -560]], 40, 40, 79), halb: 10 }],
    buchten: [{ x: 0, y: 40, rx: zw(r, 380, 520), ry: zw(r, 260, 360), rau: 0.25, korn: 40 }],
    inseln: Array.from({ length: Math.floor(zw(r, 4, 8)) }, () => ({ x: zw(r, -300, 300), y: zw(r, -60, 260), rx: zw(r, 16, 40), ry: zw(r, 8, 18), dreh: zw(r, -0.8, 0.8), art: 'schilf', rau: 0.35 })),
    platen: [{ x: zw(r, -300, 300), y: zw(r, 700, 900), rx: zw(r, 160, 260), ry: zw(r, 16, 28), dreh: zw(r, -0.2, 0.2) }],
    // Hafen an einer Seite des Trichters, schräg zur Flussmitte gedreht
    hafen: { x: seite * zw(r, 260, 380), y: -60, dreh: -seite * zw(r, 0.35, 0.7) },
    // Am Hafen: der Fluss kommt gleich neben dem Ort aus dem Land, Schilfinseln in der Mündung, Sandbank davor
    nah: (q) => {
      const fx = q() < 0.5 ? -zw(q, 350, 390) : zw(q, 300, 330);
      const lauf = gewunden([[fx + zw(q, -160, 160), -900], [fx + zw(q, -80, 80), -450], [fx + zw(q, -30, 30), -150], [fx, 20], [fx * 1.05, 120]], 30, 40, 81);
      return {
        kanaele: [{ punkte: lauf, halb: zw(q, 22, 30) }],
        buchten: [{ x: fx, y: 90, rx: zw(q, 70, 100), ry: zw(q, 70, 90), rau: 0.25, korn: 24 }],
        inseln: Array.from({ length: 3 }, () => ({ x: fx + zw(q, -50, 50), y: zw(q, 60, 140), rx: zw(q, 14, 26), ry: zw(q, 6, 12), dreh: zw(q, -0.8, 0.8), art: 'schilf', rau: 0.35 })),
        platen: [{ x: fx * 0.6, y: zw(q, 205, 225), rx: zw(q, 120, 180), ry: zw(q, 12, 18), dreh: zw(q, -0.15, 0.15) }],
      };
    },
    stil: { marsch: 1 },
    leuchttuerme: [[seite * -420, 220]],
  };
}

function bodden(r) {
  // Der Hafen liegt in einem verzweigten Boddenwasser: Wieken, Halbinseln und Inseln; ein schmaler Durchlass zur See
  const kueste = freieKueste(r, { y: 1500, amp: 150 });
  const teile = [{ x: 0, y: 380, rx: zw(r, 480, 600), ry: zw(r, 300, 380), rau: 0.3, korn: 50 }];
  for (let i = 0; i < 6; i++) {
    const a = zw(r, -Math.PI, Math.PI), d = zw(r, 450, 900);
    teile.push({ x: Math.cos(a) * d * 1.3, y: 380 + Math.sin(a) * d * 0.8, rx: zw(r, 160, 360), ry: zw(r, 100, 240), dreh: zw(r, -1, 1), rau: 0.35, korn: 40 });
  }
  const inseln = [];
  for (let i = 0; i < 60 && inseln.length < 10; i++) {
    const t = teile[Math.floor(r() * teile.length)];
    const x = t.x + zw(r, -0.6, 0.6) * t.rx, y = t.y + zw(r, -0.6, 0.6) * t.ry;
    if (Math.abs(x) < 460 && y < 600) continue;
    const rx = zw(r, 30, 110);
    inseln.push({ x, y, rx, ry: rx * zw(r, 0.4, 0.8), dreh: zw(r, -1, 1), art: r() < 0.4 ? 'wald' : r() < 0.6 ? 'schilf' : 'wiese', rau: 0.35, korn: 22 });
  }
  const gx = zw(r, -800, 800);
  return {
    kueste, rauheit: 20,
    buchten: teile,
    kanaele: [{ punkte: gewunden([[0, 500], [gx * 0.5, 1000], [gx, 1700]], 60, 60, 83), halb: zw(r, 50, 80) }],
    inseln,
    hafen: { x: zw(r, -120, 120), y: 80, dreh: zw(r, -0.4, 0.4) },
    // Am Hafen: flaches Boddenwasser mit Halbinseln und kleinen Inseln, Schilf an den Ufern
    nah: (q) => {
      const s = vz(q);
      return {
        baender: [{ punkte: gewunden([[s * -800, zw(q, 40, 90)], [s * -480, zw(q, 110, 150)], [s * -250, zw(q, 150, 190)]], 30, 16, 85), halb: zw(q, 36, 50), duene: 0 }],
        inseln: [
          { x: s * zw(q, 180, 260), y: zw(q, 34, 52), rx: zw(q, 40, 70), ry: zw(q, 14, 22), art: 'schilf', rau: 0.35, korn: 16 },
          { x: s * -zw(q, 330, 480), y: zw(q, 215, 235), rx: zw(q, 50, 90), ry: zw(q, 18, 26), art: 'wiese', rau: 0.3, korn: 18 },
          { x: s * zw(q, 420, 560), y: zw(q, 210, 235), rx: zw(q, 60, 100), ry: zw(q, 20, 28), art: 'wald', rau: 0.3, korn: 18 },
          { x: s * -zw(q, 220, 300), y: zw(q, -20, 20), rx: 40, ry: 30, art: 'schilf', rau: 0.4, korn: 12 },
        ],
      };
    },
    stil: { marsch: 0.8 },
    leuchttuerme: [[gx * 0.5 + 90, 1000]],
  };
}

function schaeren(r) {
  // felsige, zerklüftete Küste mit Dutzenden kleiner Felsinseln
  const kueste = freieKueste(r, { amp: 200, schritt: 260 });
  const inseln = [];
  for (let i = 0; i < 200 && inseln.length < 45; i++) {
    const x = zw(r, -1700, 1700), y = zw(r, 80, 1700);
    const rx = zw(r, 8, 60), ry = rx * zw(r, 0.5, 0.9);
    if (inseln.some((o) => Math.hypot(o.x - x, o.y - y) < o.rx + rx + 14)) continue;
    inseln.push({ x, y, rx, ry, dreh: zw(r, -1.5, 1.5), art: r() < 0.7 ? 'fels' : 'wald', rau: 0.45, korn: 12 });
  }
  return {
    kueste, rauheit: 34, rauKorn: 22,
    inseln,
    buchten: Array.from({ length: 6 }, () => ({ x: zw(r, -1600, 1600), y: zw(r, -120, 0), rx: zw(r, 60, 140), ry: zw(r, 90, 220), dreh: zw(r, -0.5, 0.5), rau: 0.4, korn: 20 })),
    hafen: { x: zw(r, -500, 500), y: 0, dreh: zw(r, -0.6, 0.6) },
    // Am Hafen: Felsinseln und Klippen überall, wo kein Boot fahren muss
    nah: (q) => {
      const inseln = [];
      const frei = [[-620, -180, 0, 240], [80, 330, 20, 70], [-600, 600, 190, 240], [360, 640, 0, 240]];
      for (let i = 0; i < 120 && inseln.length < 26; i++) {
        const [a, b, c, d] = frei[i % frei.length];
        const x = zw(q, a, b), y = zw(q, c, d), rx = zw(q, 6, 26);
        if (inseln.some((o) => Math.hypot(o.x - x, o.y - y) < o.rx + rx + 10)) continue;
        inseln.push({ x, y, rx, ry: rx * zw(q, 0.5, 0.9), dreh: zw(q, -1.5, 1.5), art: q() < 0.75 ? 'fels' : 'wald', rau: 0.45, korn: 9 });
      }
      return { inseln };
    },
    stil: { felsufer: 26, steil: 5, wald: 0.6 },
    leuchttuerme: [],
    leuchtturmInsel: true,
  };
}

function steilkueste(r) {
  // fast gerade Küste mit hohem Steilufer und Findlingen, ein Bachtal, der Hafen in einer kleinen Bucht
  const kueste = freieKueste(r, { amp: 50, schritt: 400 });
  const bachX = zw(r, 300, 700) * vz(r);
  return {
    kueste, rauheit: 10,
    kanaele: [{ punkte: gewunden([[bachX, 30], [bachX + zw(r, -100, 100), -400], [bachX + zw(r, -200, 200), -1200], [bachX, -2600]], 40, 50, 61), halb: zw(r, 6, 10), tal: 60 }],
    inseln: Array.from({ length: 16 }, () => ({ x: zw(r, -1500, 1500), y: zw(r, 30, 200), rx: zw(r, 4, 10), ry: zw(r, 3, 8), art: 'fels', rau: 0.3 })),
    hafen: { x: zw(r, -400, 400), y: 0, dreh: zw(r, -0.3, 0.3) },
    // Am Hafen: kleine Bucht zwischen zwei hohen Kliffs, ein Bachtal kommt gleich daneben herunter
    nah: (q) => {
      const s = vz(q);
      const bx = s * zw(q, 260, 320);
      return {
        baender: [
          { punkte: [[-1000, -40], [-520, 10], [-280, zw(q, 50, 80)], [-210, zw(q, 30, 50)]], halb: 80, duene: 0 },
          { punkte: [[1000, -40], [620, 0], [360, zw(q, 30, 50)], [150, zw(q, 10, 24)]], halb: 60, duene: 0 },
        ],
        kanaele: [{ punkte: gewunden([[bx, 40], [bx + zw(q, -40, 40), -200], [bx + zw(q, -80, 80), -600]], 30, 30, 63), halb: zw(q, 5, 8), tal: 50 }],
        inseln: Array.from({ length: 8 }, () => ({ x: vz(q) * zw(q, 200, 600), y: zw(q, 120, 230), rx: zw(q, 4, 9), ry: zw(q, 3, 7), art: 'fels', rau: 0.3 })),
      };
    },
    stil: { steil: zw(r, 16, 24) },
    leuchttuerme: [[-bachX * 0.7, 40]],
  };
}

function watt(r) {
  // flache Küste mit weitem Watt, Prielen und Halligen mit Warft, Deich und Marsch dahinter
  const kueste = freieKueste(r, { amp: 80, schritt: 500 });
  const halligen = [];
  for (let i = 0; i < 40 && halligen.length < 6; i++) {
    const x = zw(r, -1700, 1700), y = zw(r, 500, 1500);
    if (halligen.some((o) => Math.hypot(o.x - x, o.y - y) < 320)) continue;
    halligen.push({ x, y, rx: zw(r, 60, 120), ry: zw(r, 40, 70), dreh: zw(r, -0.5, 0.5), art: 'hallig', rau: 0.2, korn: 26 });
  }
  return {
    kueste, rauheit: 6,
    inseln: halligen,
    kanaele: Array.from({ length: 4 }, (_, i) => ({ punkte: gewunden([[zw(r, -1500, 1500), zw(r, 30, 120)], [zw(r, -1400, 1400), zw(r, 500, 800)], [zw(r, -1600, 1600), 2000]], 70, 80, 90 + i), halb: zw(r, 14, 26) })),
    hafen: { x: zw(r, -600, 600), y: 0, dreh: zw(r, -0.4, 0.4) },
    // Am Hafen: eine Hallig mit Warft in Sichtweite, ein Priel schlängelt sich zur Einfahrt
    nah: (q) => {
      const s = vz(q);
      return {
        inseln: [{ x: s * zw(q, 380, 520), y: zw(q, 200, 230), rx: zw(q, 70, 100), ry: zw(q, 40, 55), dreh: zw(q, -0.3, 0.3), art: 'hallig', rau: 0.2, korn: 26 }],
        kanaele: [{ punkte: gewunden([[-s * 300, 30], [-s * 260, 120], [-s * 120, 200], [60, 240]], 30, 30, 92), halb: zw(q, 10, 16) }],
      };
    },
    stil: { watt: zw(r, 220, 360), marsch: 1, deich: true },
    leuchttuerme: halligen.length ? [[halligen[0].x, halligen[0].y]] : [],
  };
}

function foerde(r) {
  // lange, gewundene Förde mit bewaldeten Hängen; der Hafen liegt an ihrem inneren Ende
  const kueste = freieKueste(r, { y: 2200, amp: 100 });
  const mitte = gewunden([[0, -40], [zw(r, -200, 200), 500], [zw(r, -500, 500), 1100], [zw(r, -500, 500), 1700], [zw(r, -300, 300), 2400]], 60, 60, 87);
  const nebenX = vz(r);
  return {
    kueste, rauheit: 16,
    kanaele: [
      { punkte: mitte, halb: zw(r, 300, 380) },
      { punkte: gewunden([[mitte[8][0], mitte[8][1]], [mitte[8][0] + nebenX * 500, mitte[8][1] - 100], [mitte[8][0] + nebenX * 800, mitte[8][1] - 300]], 50, 40, 89), halb: zw(r, 50, 90) },
    ],
    inseln: [{ x: mitte[14][0] + zw(r, -120, 120), y: mitte[14][1], rx: zw(r, 30, 60), ry: zw(r, 18, 34), art: 'wald', dreh: 0.4 }],
    hafen: { x: 0, y: -40, dreh: zw(r, -0.25, 0.25) },
    // Am Hafen: die Förde ist schmal, bewaldete Hänge rücken links und rechts dicht heran
    nah: (q) => {
      const w = zw(q, 190, 230), o = zw(q, 380, 420);
      return {
        baender: [
          { punkte: gewunden([[-w - 200, -40], [-w - 30, 120], [-w - zw(q, 0, 60), 400], [-w - zw(q, 40, 140), 900]], 40, 20, 88), halb: zw(q, 40, 60), duene: 0 },
          { punkte: gewunden([[o + 200, -40], [o + 20, 120], [o + zw(q, 0, 80), 400], [o + zw(q, 40, 160), 900]], 40, 20, 89), halb: zw(q, 40, 60), duene: 0 },
        ],
      };
    },
    stil: { steil: zw(r, 8, 12), wald: 1 },
    leuchttuerme: [[mitte[mitte.length - 4][0] + 300, mitte[mitte.length - 4][1]]],
  };
}

function haken(r) {
  // großer Strandhaken: eine Nehrung wächst von einer Seite um die Bucht herum und biegt am Ende landwärts
  const s = vz(r);
  const kueste = freieKueste(r, { amp: 100 });
  const yH = zw(r, 760, 900), sx = zw(r, 700, 950);
  const pts = gewunden([[-2600 * s, zw(r, 100, 200)], [-1500 * s, yH - 150], [-600 * s, yH], [200 * s, yH + zw(r, -30, 30)], [(sx - 120) * s, yH - 20], [sx * s, yH - 220], [(sx - 60) * s, yH - 420]], 60, 16, 47);
  return {
    kueste, rauheit: 10,
    baender: [{ punkte: pts, halb: zw(r, 24, 34), duene: 1.2 }],
    inseln: [{ x: (sx - 80) * s, y: yH - 380, rx: 50, ry: 80, art: 'sand', rau: 0.3 }],
    hafen: { x: zw(r, -300, 300), y: 0, dreh: s * zw(r, 0, 0.5) },
    // Am Hafen: der Haken kommt von der Seite um die Bucht und endet vor der Einfahrt mit einem Leuchtturm
    nah: (q) => {
      const s = vz(q);
      const ende = s < 0 ? zw(q, 60, 120) : zw(q, 250, 290);
      const pts = s < 0
        ? [[-1000, 0], [-640, 120], [-300, zw(q, 205, 222)], [ende - 70, 222], [ende, 196], [ende - 20, 172]]
        : [[1000, 0], [700, 150], [460, zw(q, 210, 225)], [ende + 70, 224], [ende, 200], [ende + 20, 176]];
      return {
        baender: [{ punkte: gewunden(pts, 30, 8, 49), halb: zw(q, 18, 24), duene: 1.2 }],
        leuchttuerme: [[ende, 200]],
      };
    },
    stil: { marsch: 0.5 },
    leuchttuerme: [[sx * s, yH - 220]],
  };
}

function inselhafen(r) {
  // Der Hafen liegt auf einer Insel; über einen Sund sieht man das Festland, daneben eine kleinere Nachbarinsel
  // Die Insel ist so klein, dass man vom Hafen aus über den Sund das Festland sieht
  const ry = zw(r, 190, 230), rx = zw(r, 420, 520);
  const kueste = freieKueste(r, { y: -ry * 2 - zw(r, 110, 170), amp: 60 });
  const nx = vz(r) * zw(r, 1100, 1400);
  return {
    kueste, rauheit: 14,
    inseln: [
      { x: 0, y: -ry, rx, ry, rau: 0.25, korn: 60, art: 'land' },
      { x: nx, y: zw(r, -400, 200), rx: zw(r, 200, 320), ry: zw(r, 130, 200), dreh: zw(r, -0.6, 0.6), art: 'wald', rau: 0.3, korn: 30 },
      { x: -nx * 0.6, y: zw(r, 500, 800), rx: zw(r, 30, 60), ry: zw(r, 20, 40), art: 'fels' },
    ],
    hafen: { x: zw(r, -60, 60), y: 0, dreh: zw(r, -0.5, 0.5) },
    stil: { steil: 5 },
    leuchttuerme: [[rx * 0.85 * (nx > 0 ? 1 : -1), -ry * 0.6]],
  };
}

export const TYPEN = [
  { nr: 1, name: 'Nehrung', idee: 'Lagune hinter einer gewundenen Nehrung mit Dünen, Seegatten und Salzwiesen.', bau: nehrung },
  { nr: 2, name: 'Offene Bucht', idee: 'Weite Bucht zwischen zwei bewaldeten Landzungen mit Steilufer, Felsen vor den Spitzen.', bau: offeneBucht },
  { nr: 3, name: 'Flussmündung', idee: 'Ein Fluss kommt in Schleifen aus dem Land und weitet sich zur Mündung, Schilfinseln, Sandbank davor.', bau: flussmuendung },
  { nr: 4, name: 'Bodden', idee: 'Verzweigtes Boddenwasser mit Wieken, Halbinseln und Inseln, ein schmaler Durchlass zur See.', bau: bodden },
  { nr: 5, name: 'Schären', idee: 'Felsige, zerklüftete Küste mit Dutzenden kleiner Felsinseln.', bau: schaeren },
  { nr: 6, name: 'Steilküste', idee: 'Fast gerade Küste mit hohem Steilufer, Findlingen und einem Bachtal.', bau: steilkueste },
  { nr: 7, name: 'Watt', idee: 'Flache Küste mit weitem Watt, Prielen und Halligen mit Warft, Deich und Marsch.', bau: watt },
  { nr: 8, name: 'Förde', idee: 'Lange, gewundene Förde mit bewaldeten Hängen, der Hafen an ihrem inneren Ende.', bau: foerde },
  { nr: 9, name: 'Strandhaken', idee: 'Eine Nehrung wächst um die Bucht herum und endet in einem Haken mit Leuchtturm.', bau: haken },
  { nr: 10, name: 'Inselhafen', idee: 'Der Hafen liegt auf einer Insel, über einen Sund sieht man das Festland.', bau: inselhafen },
];

// ------------------------------------------------------------------ Aufbau und Abfrage

const S = 5;   // Rasterweite in Planeinheiten (3,1 m); dazwischen wird weich interpoliert

/** Schneller Vorab-Test: liegt (X, Y) weit genug außerhalb des Rahmens, dass der Baustein nichts ändert? */
const weitWeg = (X, Y, bb) => X < bb[0] || X > bb[2] || Y < bb[1] || Y > bb[3];
function rahmenLinie(pts, rand) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return [x0 - rand, y0 - rand, x1 + rand, y1 + rand];
}
const rahmenEllipse = (e, f = 1.6, rand = 20) => { const r = Math.max(e.rx, e.ry) * f + rand; return [e.x - r, e.y - r, e.x + r, e.y + r]; };

/**
 * Baut die Landschaft für Typ nr und Spielstand-Zufall seed.
 * Alle Abfragen nehmen Spielkoordinaten (Hafen bei 0,0, See vorne in +y).
 * Rückgabe: { nr, seed, name, idee, landig(px, py), probe(px, py), nachNatur, vonNatur, leuchttuerme, inseln, stil }
 */
export function bauen(nr, seed = 1) {
  const typ = TYPEN.find((t) => t.nr === nr) || TYPEN[0];
  const r = zufall((seed * 7919 + nr * 104729) >>> 0);
  const p = typ.bau(r);
  const ufer = kurve(p.kueste);
  const rau = p.rauheit ?? 10, korn = p.rauKorn ?? 40;
  const bseed = (seed * 31 + nr) % 9973;
  const baender = (p.baender || []).map((b) => ({ ...b, bb: rahmenLinie(b.punkte, b.halb + 44) }));
  const buchten = (p.buchten || []).map((b, k) => ({ ...b, seed: bseed + 11 + k, bb: rahmenEllipse(b) }));
  const inseln = (p.inseln || []).map((i, k) => ({ ...i, seed: bseed + k, bb: rahmenEllipse(i) }));
  const kanaele = (p.kanaele || []).map((k) => ({ ...k, bb: rahmenLinie(k.punkte, k.halb + (k.tal || 0) + 64) }));
  const platen = (p.platen || []).map((q) => ({ ...q, rau: 0.4, korn: 16, seed: bseed + 17, bb: rahmenEllipse(q) }));
  const stil = p.stil || {};

  /** Landigkeit in Naturkoordinaten */
  function roh(X, Y) {
    let L = ufer(X) - Y + rau * (fbm(X / korn, Y / korn, bseed) - 0.5) * 2;
    for (const b of baender) {
      if (weitWeg(X, Y, b.bb)) continue;
      const d = b.halb - abstandLinie(X, Y, b.punkte);
      if (d > -40) L = Math.max(L, d + 3 * (fbm(X / 20, Y / 20, bseed + 3) - 0.5));
    }
    for (const b of buchten) if (!weitWeg(X, Y, b.bb)) L = Math.min(L, -ellipse(X, Y, b));
    for (const k of kanaele) {
      if (weitWeg(X, Y, k.bb)) continue;
      const d = abstandLinie(X, Y, k.punkte) - k.halb;
      if (d < 60) L = Math.min(L, d + 4 * (fbm(X / 15, Y / 15, bseed + 5) - 0.5));
    }
    for (const i of inseln) if (!weitWeg(X, Y, i.bb)) L = Math.max(L, ellipse(X, Y, i));
    return L;
  }

  // Hafen in die Natur legen: vom Ankerpunkt entlang der Hafenrichtung das Ufer suchen
  const d0 = p.hafen?.dreh || 0, c = Math.cos(d0), s = Math.sin(d0);
  let ax = p.hafen?.x || 0, ay = p.hafen?.y || 0;
  {
    let best = null;
    for (let t = -500; t <= 500; t += 4) {
      const X = ax - s * t, Y = ay + c * t;
      if (roh(X + s * 4, Y - c * 4) >= 0 && roh(X, Y) < 0 && (best === null || Math.abs(t) < Math.abs(best))) best = t;
    }
    if (best !== null) { ax -= s * best; ay += c * best; }
  }
  const nachNatur = (px, py) => [ax + px * c - py * s, ay + px * s + py * c];
  const vonNatur = (X, Y) => { const dx = X - ax, dy = Y - ay; return [dx * c + dy * s, -dx * s + dy * c]; };

  // Was man vom Hafen aus sieht: Bausteine des Typs in Spielkoordinaten (gleich hinter den Pflichtbereichen),
  // in die Naturkarte gedreht. So erkennt man den Küstentyp schon in der Startansicht.
  const leuchtNah = [];
  if (p.nah) {
    const nah = p.nah(r);
    const T = (pts) => pts.map(([x, y]) => nachNatur(x, y));
    const E = (e) => { const [X, Y] = nachNatur(e.x, e.y); return { ...e, x: X, y: Y, dreh: (e.dreh || 0) + d0 }; };
    for (const b of nah.baender || []) { const punkte = T(b.punkte); baender.push({ ...b, punkte, bb: rahmenLinie(punkte, b.halb + 44) }); }
    (nah.buchten || []).forEach((b, k) => { const e = E(b); buchten.push({ ...e, seed: bseed + 41 + k, bb: rahmenEllipse(e) }); });
    (nah.inseln || []).forEach((b, k) => { const e = E(b); inseln.push({ ...e, seed: bseed + 61 + k, bb: rahmenEllipse(e) }); });
    for (const k of nah.kanaele || []) { const punkte = T(k.punkte); kanaele.push({ ...k, punkte, bb: rahmenLinie(punkte, k.halb + (k.tal || 0) + 64) }); }
    for (const q of nah.platen || []) { const e = E(q); platen.push({ ...e, rau: 0.4, korn: 16, seed: bseed + 19, bb: rahmenEllipse(e) }); }
    for (const [x, y] of nah.leuchttuerme || []) leuchtNah.push([x, y]);
  }

  // natürliche Zufahrt in Spielkoordinaten: vom Hafen durch das Seegatt (x 178) ins offene Wasser vor der Einfahrt
  const route = { punkte: [[40, 140], [150, 172], [178, 200], [178, 262]], halb: 24 };

  // Raster in Spielkoordinaten: Landigkeit der Natur und Masken für Düne, Fels, Hallig, Wald, Platen, Wasserläufe
  const x0 = WELT.x0, y0 = WELT.y0;
  const nx = Math.ceil((WELT.x1 - x0) / S) + 1, ny = Math.ceil((WELT.y1 - y0) / S) + 1;
  const n = nx * ny;
  const gRoh = new Float32Array(n), gDuene = new Float32Array(n), gFels = new Float32Array(n), gHallig = new Float32Array(n);
  const gWald = new Float32Array(n), gPlate = new Float32Array(n), gKanal = new Float32Array(n);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i;
    const [X, Y] = nachNatur(x0 + i * S, y0 + j * S);
    gRoh[k] = roh(X, Y);
    let duene = 0, fels = 0, hallig = 0, wald = 0, plate = -40, kanal = 0;
    for (const b of baender) {
      if (weitWeg(X, Y, b.bb)) continue;
      const d = abstandLinie(X, Y, b.punkte);
      if (d < b.halb + 4) duene = Math.max(duene, (b.duene ?? 1) * Math.max(0, 1 - d / b.halb));
    }
    for (const q of inseln) {
      if (weitWeg(X, Y, q.bb)) continue;
      const e = ellipse(X, Y, q);
      if (e > -12) {
        if (q.art === 'fels') fels = 1;
        if (q.art === 'hallig') hallig = Math.max(hallig, smooth(0, Math.min(q.rx, q.ry) * 0.6, e));
        if (q.art === 'wald') wald = Math.max(wald, 0.8);
        if (q.art === 'schilf') wald = Math.min(wald, 0);
      }
    }
    for (const q of platen) if (!weitWeg(X, Y, q.bb)) plate = Math.max(plate, ellipse(X, Y, q));
    for (const q of kanaele) {
      if (weitWeg(X, Y, q.bb)) continue;
      const d = abstandLinie(X, Y, q.punkte);
      if (d < q.halb + (q.tal || 0) + 6) kanal = Math.max(kanal, 1 - smooth(q.halb, q.halb + (q.tal || 0) + 6, d));
    }
    gDuene[k] = duene; gFels[k] = fels; gHallig[k] = hallig; gWald[k] = wald; gPlate[k] = plate; gKanal[k] = kanal;
  }
  const lies = (f, px, py) => {
    const fx = clamp((px - x0) / S, 0, nx - 1.001), fy = clamp((py - y0) / S, 0, ny - 1.001);
    const i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j, k = j * nx + i;
    return f[k] * (1 - u) * (1 - v) + f[k + 1] * u * (1 - v) + f[k + nx] * (1 - u) * v + f[k + nx + 1] * u * v;
  };
  // Pflichtbereiche exakt, Natur aus dem Raster
  const landig = (px, py) => pflicht(px, py, lies(gRoh, px, py), route, bseed);

  // Abstand zum Ufer (an Land und im Wasser) und zur offenen See
  const nass = new Uint8Array(n);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) nass[j * nx + i] = landig(x0 + i * S, y0 + j * S) < 0 ? 1 : 0;
  const dL = chamfer(nass, nx, ny, 1), dW = chamfer(nass, nx, ny, 0);
  // offene See: breites Wasser (über 50 Einheiten vom Ufer) am Kartenrand, und zwar das Gebiet, das in der
  // Naturkarte am weitesten "draußen" (Norden) liegt; Lagunen und Bodden hinter schmalen Durchlässen zählen nicht
  const breit = new Uint8Array(n);
  for (let k = 0; k < n; k++) breit[k] = nass[k] && dW[k] * S > 50 ? 1 : 0;
  const gruppe = new Int32Array(n).fill(-1);
  let beste = -1, besteGroesse = 0, gid = 0;
  for (let k0 = 0; k0 < n; k0++) {
    if (!breit[k0] || gruppe[k0] >= 0) continue;
    const i0 = k0 % nx, j0 = (k0 - i0) / nx;
    if (i0 !== 0 && j0 !== 0 && i0 !== nx - 1 && j0 !== ny - 1) continue;
    const stapel = [k0]; gruppe[k0] = gid; let groesse = -Infinity;
    while (stapel.length) {
      const k = stapel.pop(), i = k % nx, j = (k - i) / nx;
      groesse = Math.max(groesse, ay + (x0 + i * S) * s + (y0 + j * S) * c);   // Naturkoordinate Y
      if (i > 0 && breit[k - 1] && gruppe[k - 1] < 0) { gruppe[k - 1] = gid; stapel.push(k - 1); }
      if (i < nx - 1 && breit[k + 1] && gruppe[k + 1] < 0) { gruppe[k + 1] = gid; stapel.push(k + 1); }
      if (j > 0 && breit[k - nx] && gruppe[k - nx] < 0) { gruppe[k - nx] = gid; stapel.push(k - nx); }
      if (j < ny - 1 && breit[k + nx] && gruppe[k + nx] < 0) { gruppe[k + nx] = gid; stapel.push(k + nx); }
    }
    if (groesse > besteGroesse) { beste = gid; besteGroesse = groesse; }
    gid++;
  }
  const nichtOffen = new Uint8Array(n);
  for (let k = 0; k < n; k++) nichtOffen[k] = gruppe[k] === beste && beste >= 0 ? 0 : 1;
  const dOffen = chamfer(nichtOffen, nx, ny, 0);   // Abstand zur offenen See in Rasterzellen (0 dort)

  /**
   * Natur an einem Punkt (Spielkoordinaten).
   * L Landigkeit (> 0 Land), d Abstand zum Ufer in Planeinheiten (+ Land, - Wasser), offenAbstand zur offenen See
   * (0 dort, an Land Infinity), Masken 0..1: duene, fels, hallig, wald, kanal; plate > 0 auf einer Sandplate.
   */
  function probe(px, py) {
    const L = landig(px, py);
    const dRaster = L >= 0 ? lies(dL, px, py) * S : -lies(dW, px, py) * S;
    const d = Math.abs(L) < 8 ? L : (Math.sign(L) === Math.sign(dRaster) && Math.abs(dRaster) > 8 ? dRaster : L >= 0 ? Math.max(8, Math.min(L, dRaster || L)) : Math.min(-8, Math.max(L, dRaster || L)));
    let fels = lies(gFels, px, py);
    if (stil.felsufer && L >= 0 && d < stil.felsufer) fels = Math.max(fels, 1 - d / stil.felsufer);
    return {
      L, d, offenAbstand: lies(dOffen, px, py) * S,
      duene: lies(gDuene, px, py), fels, hallig: lies(gHallig, px, py), wald: Math.max(stil.wald || 0, lies(gWald, px, py)),
      plate: lies(gPlate, px, py), kanal: lies(gKanal, px, py), stil,
    };
  }

  // Leuchttürme: aus dem Typ, bei Schären auf der größten Felsinsel nahe der Einfahrt
  let lt = [...leuchtNah, ...(p.leuchttuerme || []).map(([X, Y]) => vonNatur(X, Y))];
  if (p.leuchtturmInsel) {
    const kand = inseln.map((i) => ({ i, l: vonNatur(i.x, i.y) })).filter((o) => o.l[1] > 260 && Math.abs(o.l[0]) < 900 && o.i.rx > 25);
    kand.sort((a, b) => Math.hypot(a.l[0], a.l[1] - 400) - Math.hypot(b.l[0], b.l[1] - 400));
    if (kand[0]) lt = [kand[0].l];
  }

  // Leuchttürme stehen auf festem Land in der Karte; sonst das nächste Land in der Nähe, sonst keiner
  lt = lt.map(([x, y]) => {
    // gut 9 m vom Ufer, damit Turm und Sockel sicher auf festem Grund stehen (nicht auf Salzwiese am Wasser)
    // In Marschland nicht auf die Salzwiese am Ufer (die ist kaum höher als das Wasser), auf Dünen schon
    const fest = (qx, qy) => landig(qx, qy) > 15 && (!stil.marsch || probe(qx, qy).d > 56 || probe(qx, qy).duene > 0.3);
    if (fest(x, y)) return [x, y];
    for (let r = 6; r <= 240; r += 6) {
      for (let a = 0; a < 16; a++) {
        const qx = x + r * Math.cos(a * Math.PI / 8), qy = y + r * Math.sin(a * Math.PI / 8);
        if (fest(qx, qy)) return [qx, qy];
      }
    }
    return null;
  }).filter((q) => q && q[0] > WELT.x0 + 60 && q[0] < WELT.x1 - 60 && q[1] > -60 && q[1] < WELT.y1 - 60
    && !(q[0] > -220 && q[0] < 240 && q[1] < 300));   // nicht im Hafen

  return {
    nr: typ.nr, seed, name: typ.name, idee: typ.idee,
    landig, probe, route, nachNatur, vonNatur, anker: [ax, ay], dreh: d0,
    leuchttuerme: lt.map(([x, y]) => [Math.round(x), Math.round(y)]),
    inseln: inseln.map(({ x, y, rx, ry, art }) => { const [lx, ly] = vonNatur(x, y); return { x: lx, y: ly, rx, ry, art }; }),
    stil,
  };
}

/**
 * Eine Stelle am Strand nahe (px, py) für Strandkörbe und Seebrücke: knapp über der Wasserlinie, nicht im
 * Hafen (samt Becken, Durchstich und Außenhafen späterer Stufen) und nicht an der Liegewanne der Großschiffe. seebruecke: davor nach Norden mindestens laenge
 * Planeinheiten freies Wasser. meiden: schon vergebene Stellen [[x, y], ...], mindestens 50 Einheiten Abstand.
 * Gibt [x, y] oder null zurück.
 */
export function strandStelle(N, px, py, { seebruecke = false, laenge = 72, meiden = [] } = {}) {
  const L = N.landig;
  const frei = (x, y) => !(x > -200 && x < 270 && y > -110 && y < 250) && !(x > -380 && x < 40 && y > 190 && y < 270)
    && !(y > 236 && x > -460 && x < 500) && meiden.every(([mx, my]) => Math.hypot(mx - x, my - y) > 50);
  const passt = (x, y) => {
    const l = L(x, y);
    if (l < 2 || l > 9 || !frei(x, y)) return false;
    if (L(x, y + 14) > -1 && L(x + 14, y) > -1 && L(x - 14, y) > -1) return false;   // Wasser muss nah sein
    if (!seebruecke) return true;
    for (let t = 10; t <= laenge; t += 8) if (L(x, y + t) > -3) return false;
    return L(x, y - 10) > 4;
  };
  if (passt(px, py)) return [px, py];
  for (let r = 8; r <= 700; r += 8) {
    const n = Math.max(12, Math.round(r / 6));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const x = px + r * Math.cos(a), y = py + r * Math.sin(a);
      if (passt(x, y)) return [x, y];
    }
  }
  return null;
}

/** Chamfer-Abstand (Rasterzellen) zu den Zellen mit maske[k] !== ziel... genauer: zu Zellen mit maske[k] === quelle. */
function chamfer(maske, nx, ny, quelle) {
  const d = new Float32Array(nx * ny);
  for (let k = 0; k < d.length; k++) d[k] = maske[k] === quelle ? 0 : 1e9;
  for (let pass = 0; pass < 2; pass++) {
    const r = pass ? -1 : 1;
    for (let jj = 0; jj < ny; jj++) for (let ii = 0; ii < nx; ii++) {
      const i = pass ? nx - 1 - ii : ii, j = pass ? ny - 1 - jj : jj, k = j * nx + i;
      let v = d[k];
      if (v === 0) continue;
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
  return d;
}
