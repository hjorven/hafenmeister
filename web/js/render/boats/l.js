// 3D-Modelle der Schiffe der Größe L im Flat-Vector-Stil.
//
// Konvention (gleich für S, M, L und XL):
// - 1 Einheit = 1 m, Y zeigt nach oben, der Bug zeigt nach +X.
// - Ursprung = Wasserlinie mittschiffs.
// - buildBoat(model, { palette = 0, sails = false }) gibt eine THREE.Group zurück.
// - Alle festen Teile sind pro Farbe zu einem Mesh zusammengefasst (wenige Draw Calls
//   auch bei 90 Booten auf dem Handy), die Takelage ist eine LineSegments.
// - Bewegliche Teile bleiben einzeln: Untergruppen "sailsSet" und "sailsFurled",
//   dazu Radar, Windgenerator und Blaulicht in group.userData.anim.
// - group.userData = { id, modelId, length, beam, draft, airDraft, iconHeight, anim }.
// - setSails(group, on) setzt oder birgt die Segel. Schaukeln, Anlegen, Leinen macht das
//   gemeinsame Animationsmodul über die Namen: sail-main, sail-jib (furl 'x'), sail-mizzen,
//   boom, boom-mizzen (Drehpunkt am Mast), cover-..., fender, flag, radar, cleat-bow, cleat-stern.
// - tickBoat(group, time) dreht Windgenerator und lässt Blaulichter blinken (init hängt das an game.onTick).
// - init(game) meldet die L-Boote unter game.boatTypes.L an.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MODEL_BY_ID, COLORS, TYPES, MODELS } from '../../data/boats/l.js';

const FIX = {
  white: COLORS.white, glass: '#3e5e7a', mast: '#9aa6b4', carbon: '#2e3440', steel: '#b8c2cc',
  rubber: '#2e3440', teak: COLORS.teak, net: '#55606c', solar: '#2e4868', antifouling: '#3a4656',
  cushion: '#f6eedd', orange: COLORS.signal, blueLight: '#4aa0ff', wood: '#b07446', line: '#5a6272',
  sail: '#fbf7ee', drum: '#4f8a6e', box: '#e8eef2', grey: '#9aa6b2',
};

// ------------------------------------------------------------------ Materialien (geteilt)
const MATS = new Map();
function mat(color, opts = {}) {
  const key = color + (opts.side ? ':d' : '') + (opts.emissive ? ':e' : '');
  if (!MATS.has(key)) {
    MATS.set(key, new THREE.MeshLambertMaterial({
      color, flatShading: true,
      side: opts.side ? THREE.DoubleSide : THREE.FrontSide,
      emissive: opts.emissive ? color : 0x000000,
      emissiveIntensity: opts.emissive ? 0.6 : 0,
    }));
  }
  return MATS.get(key);
}
const LINE_MAT = new THREE.LineBasicMaterial({ color: FIX.line });

// ------------------------------------------------------------------ Hilfen
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const lerp = (a, b, t) => a + (b - a) * t;
const UP = V(0, 1, 0);

// Sammelt Geometrie pro Farbe und fasst sie am Ende zusammen.
class Kit {
  constructor() {
    this.geo = new Map();   // Farbe -> BufferGeometry[]
    this.raw = new Map();   // Farbe -> number[] (lose Dreiecke)
    this.lines = [];        // Punkte für LineSegments, paarweise
    this.matrix = null;     // optionale Zusatztransformation (für Unterbaugruppen)
    this.groups = [];       // eigenständige Objekte (Baum, Radar, Flagge ...)
    this.covers = [];       // Kits für Persenning und Rollfock ("cover-...")
  }
  add(color, g, m) {
    g = g.index ? g.toNonIndexed() : g;
    if (g.attributes.uv) g.deleteAttribute('uv');
    if (m) g.applyMatrix4(m);
    if (this.matrix) g.applyMatrix4(this.matrix);
    if (!this.geo.has(color)) this.geo.set(color, []);
    this.geo.get(color).push(g);
  }
  // Dreieck mit Richtungsprüfung: Die Normale soll von "inside" weg zeigen.
  tri(color, a, b, c, inside) {
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    if (n.lengthSq() < 1e-8) return;
    if (inside) {
      const ctr = V((a.x + b.x + c.x) / 3, (a.y + b.y + c.y) / 3, (a.z + b.z + c.z) / 3);
      const ref = typeof inside === 'function' ? inside(ctr) : inside;
      if (n.dot(ctr.clone().sub(ref)) < 0) [b, c] = [c, b];
    }
    if (!this.raw.has(color)) this.raw.set(color, []);
    const arr = this.raw.get(color);
    for (const p of [a, b, c]) {
      const q = this.matrix ? p.clone().applyMatrix4(this.matrix) : p;
      arr.push(q.x, q.y, q.z);
    }
  }
  quad(color, a, b, c, d, inside) { this.tri(color, a, b, c, inside); this.tri(color, a, c, d, inside); }
  line(a, b) {
    const p = this.matrix ? a.clone().applyMatrix4(this.matrix) : a;
    const q = this.matrix ? b.clone().applyMatrix4(this.matrix) : b;
    this.lines.push(p, q);
  }
  polyline(pts) { for (let i = 0; i < pts.length - 1; i++) this.line(pts[i], pts[i + 1]); }
  // Unterbaugruppe mit eigener Lage, z. B. ein quer hängendes Beiboot.
  with(m, fn) {
    const prev = this.matrix;
    this.matrix = prev ? prev.clone().multiply(m) : m;
    fn();
    this.matrix = prev;
  }
  build(target, name) {
    for (const [color, arr] of this.raw) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      g.computeVertexNormals();
      if (!this.geo.has(color)) this.geo.set(color, []);
      this.geo.get(color).push(g);
    }
    for (const [color, list] of this.geo) {
      const merged = list.length === 1 ? list[0] : mergeGeometries(list, false);
      const mesh = new THREE.Mesh(merged, mat(color));
      if (name) mesh.name = name;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      target.add(mesh);
    }
    if (this.lines.length) {
      const g = new THREE.BufferGeometry().setFromPoints(this.lines);
      const ls = new THREE.LineSegments(g, LINE_MAT);
      ls.name = name ? name + '-lines' : 'rigging';
      target.add(ls);
    }
  }
}

function tf(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz));
  m.setPosition(x, y, z);
  return m;
}

// Quader mit Mittelpunkt (x, y, z).
function box(k, c, sx, sy, sz, x, y, z, r = {}) {
  k.add(c, new THREE.BoxGeometry(sx, sy, sz), tf(x, y, z, r.rx, r.ry, r.rz));
}
// Zylinder entlang Y mit Mittelpunkt (x, y, z).
function cyl(k, c, r1, r2, h, x, y, z, r = {}, seg = 8) {
  k.add(c, new THREE.CylinderGeometry(r1, r2, h, seg), tf(x, y, z, r.rx, r.ry, r.rz));
}
// Stange zwischen zwei Punkten.
function rod(k, c, a, b, r = 0.04, seg = 6) {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length();
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  const q = new THREE.Quaternion().setFromUnitVectors(UP, d.normalize());
  const m = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, V(1, 1, 1));
  k.add(c, g, m);
}
// Körper aus vier Punkten unten und vier oben (Reihenfolge im Kreis).
function hexa(k, c, p) {
  const ctr = p.reduce((s, v) => s.add(v), V(0, 0, 0)).multiplyScalar(1 / 8);
  const [a, b, cc, d, e, f, g, h] = p;
  k.quad(c, a, b, cc, d, ctr); k.quad(c, e, f, g, h, ctr);
  k.quad(c, a, b, f, e, ctr); k.quad(c, b, cc, g, f, ctr);
  k.quad(c, cc, d, h, g, ctr); k.quad(c, d, a, e, h, ctr);
}

// Aufbau: unten von x0 (achtern) bis x1 (vorn) mit halber Breite wb auf Höhe y0,
// oben von xt0 bis xt1 mit halber Breite wt auf Höhe y1. Schräge Seiten und Fronten.
// Steht der Aufbau auf einem Einzelrumpf, wird er vorn schmaler, damit er nicht über die Bordwand ragt.
function cabin(k, c, o) {
  const q = { xt0: o.x0, xt1: o.x1, wt: o.wb, ...o };
  q.wbf = q.wb; q.wtf = q.wt;
  const h = !q.z && !q.free && k.hulls && k.hulls.find((x) => Math.abs(x.z0) < 0.01);
  if (h) {
    const lim = (x) => Math.max(0.3, h.wAt(x) - 0.15);
    q.wb = Math.min(q.wb, lim(q.x0));
    q.wbf = Math.min(q.wb, lim(q.x1));
    q.wt = Math.min(q.wt, q.wb);
    q.wtf = Math.min(q.wt, q.wt * q.wbf / Math.max(0.01, q.wb), lim(q.xt1));
  }
  const p = [
    V(q.x0, q.y0, -q.wb), V(q.x1, q.y0, -q.wbf), V(q.x1, q.y0, q.wbf), V(q.x0, q.y0, q.wb),
    V(q.xt0, q.y1, -q.wt), V(q.xt1, q.y1, -q.wtf), V(q.xt1, q.y1, q.wtf), V(q.xt0, q.y1, q.wt),
  ];
  if (q.z) p.forEach((v) => { v.z += q.z; });
  hexa(k, c, p);
  return q;
}
// Querschnitt eines Aufbaus auf Höhe y.
function cabAt(q, y) {
  const f = (y - q.y0) / (q.y1 - q.y0);
  return { xb: lerp(q.x0, q.xt0, f), xf: lerp(q.x1, q.xt1, f), w: lerp(q.wb, q.wt, f), wf: lerp(q.wbf ?? q.wb, q.wtf ?? q.wt, f) };
}
// Fensterband auf einem Aufbau. mode: "side" (nur Seiten, von xa bis xb),
// "wrap" (rundum), "front" (nur Front), "back" (nur Rückwand).
function glass(k, q, y0, y1, mode = 'side', xa, xb, color = FIX.glass) {
  const e = 0.025;
  const zc = q.z || 0;
  // Halbe Breite des Aufbaus an Stelle x im Schnitt s
  const wx = (s, x) => lerp(s.w, s.wf, Math.min(1, Math.max(0, (x - s.xb) / ((s.xf - s.xb) || 1))));
  const corners = (s) => {
    let x0, x1, d;
    if (mode === 'side') { x0 = xa; x1 = xb; d = e; }
    else if (mode === 'wrap') { x0 = s.xb - e; x1 = s.xf + e; d = e; }
    else if (mode === 'front') { x0 = s.xf - 0.4; x1 = s.xf + e; d = -0.12; }
    else { x0 = s.xb - e; x1 = s.xb + 0.4; d = -0.12; }
    return { x0, x1, w0: wx(s, x0) + d, w1: wx(s, x1) + d };
  };
  const a = corners(cabAt(q, y0)), b = corners(cabAt(q, y1));
  hexa(k, color, [
    V(a.x0, y0, zc - a.w0), V(a.x1, y0, zc - a.w1), V(a.x1, y0, zc + a.w1), V(a.x0, y0, zc + a.w0),
    V(b.x0, y1, zc - b.w0), V(b.x1, y1, zc - b.w1), V(b.x1, y1, zc + b.w1), V(b.x0, y1, zc + b.w0),
  ]);
}
// Reihe einzelner Fenster an beiden Seiten.
function windowRow(k, q, y0, y1, xa, xb, n, gapFrac = 0.3) {
  const step = (xb - xa) / n;
  for (let i = 0; i < n; i++) {
    const s = xa + i * step + step * gapFrac / 2;
    glass(k, q, y0, y1, 'side', s, s + step * (1 - gapFrac));
  }
}

// ------------------------------------------------------------------ Rumpf
// Gelofteter Rumpf aus Spanten. Bänder: Zierstreifen, Rumpf, Unterwasser.
// Gibt Hilfsfunktionen zurück: yAt(x) Deckshöhe, wAt(x) halbe Breite am Deck.
function hull(k, o) {
  const L = o.L, B = o.B;
  const fb = o.fb ?? 1.1, sheer = o.sheer ?? 0.25, sheerAft = o.sheerAft ?? 0.05, depth = o.depth ?? 0.5;
  const sternW = o.sternW ?? 0.8, bowRake = o.bowRake ?? 0.03, sternRake = o.sternRake ?? 0.02;
  const tMax = o.tMax ?? 0.45, bowP = o.bowP ?? 1.6, wlIn = o.wlIn ?? 0.88, stripe = o.stripe ?? 0.22;
  const x0 = o.x ?? 0, z0 = o.z ?? 0, N = o.N ?? 18;
  const cHull = o.hull, cTrim = o.trim ?? o.hull, cDeck = o.deck, cBottom = o.bottom ?? FIX.antifouling;

  const st = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    let w;
    if (t <= tMax) { const u = t / tMax; w = sternW + (1 - sternW) * (1 - (1 - u) * (1 - u)); }
    else { const u = (t - tMax) / (1 - tMax); w = 1 - Math.pow(u, bowP); }
    w = Math.max(0, w) * B / 2;
    const yd = fb + sheer * t * t + sheerAft * (1 - t) * (1 - t);
    const xd = x0 - L / 2 + t * L;
    const xw = x0 - L / 2 + (sternRake + t * (1 - sternRake - bowRake)) * L;
    st.push({ t, w, yd, xd, xw });
  }
  const pts = (s, side) => {
    const P0 = V(s.xd, s.yd, z0 + side * s.w);
    const P2 = V(s.xw, 0, z0 + side * s.w * wlIn);
    const P1 = P0.clone().lerp(P2, stripe);
    const P3 = V(s.xw, -depth, z0);
    return [P0, P1, P2, P3];
  };
  const bands = [cTrim, cHull, cBottom];
  for (let i = 0; i < N; i++) {
    const s0 = st[i], s1 = st[i + 1];
    for (const side of [-1, 1]) {
      const A = pts(s0, side), Bp = pts(s1, side);
      for (let j = 0; j < 3; j++) {
        // Bezugspunkt auf der Mittelebene neben dem Dreieck: Normale zeigt nach außen.
        k.quad(bands[j], A[j], A[j + 1], Bp[j + 1], Bp[j], (c) => V(c.x, c.y, z0));
      }
    }
    const pa = pts(s0, -1)[0], sa = pts(s0, 1)[0], pb = pts(s1, -1)[0], sb = pts(s1, 1)[0];
    const below = V((pa.x + pb.x) / 2, -5, z0);
    k.quad(cDeck, pa, sa, sb, pb, below);
  }
  // Spiegel (Heckwand)
  const s = st[0];
  if (s.w > 0.05) {
    const P = pts(s, -1), S = pts(s, 1);
    const ring = [P[0], P[1], P[2], P[3], S[2], S[1], S[0]];
    const ctr = ring.reduce((a, v) => a.add(v), V(0, 0, 0)).multiplyScalar(1 / ring.length);
    const inside = ctr.clone().add(V(1, 0, 0));
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      k.tri(i < 1 || i >= 5 ? cTrim : cHull, ctr, a, b, inside);
    }
  }
  const interp = (x, key) => {
    if (x <= st[0].xd) return st[0][key];
    for (let i = 0; i < N; i++) {
      if (x <= st[i + 1].xd) {
        const f = (x - st[i].xd) / (st[i + 1].xd - st[i].xd);
        return lerp(st[i][key], st[i + 1][key], f);
      }
    }
    return st[N][key];
  };
  const info = {
    L, B, x0, z0, fb,
    bowX: x0 + L / 2, sternX: x0 - L / 2,
    yAt: (x) => interp(x, 'yd'),
    wAt: (x) => interp(x, 'w'),
    bow: () => V(x0 + L / 2, st[N].yd, z0),
    stern: () => V(x0 - L / 2, st[0].yd, z0),
  };
  if (!k.matrix && k.hulls) k.hulls.push(info);
  return info;
}

// Kleines Beiboot (Schlauchboot) mit Lage-Matrix.
function dinghy(k, m, color = FIX.grey) {
  k.with(m, () => {
    hull(k, { L: 2.7, B: 1.4, fb: 0.42, sheer: 0.12, depth: 0.12, sternW: 0.8, tMax: 0.35, bowP: 1.4, bowRake: 0.12, hull: color, trim: color, deck: '#dfe5ea', bottom: color, N: 8, stripe: 0.5 });
    box(k, FIX.rubber, 0.3, 0.35, 0.3, -1.45, 0.45, 0);
  });
}

// ------------------------------------------------------------------ Ausrüstung
function reling(k, h, xa, xb, height = 0.6, step = 1.4, inset = 0.1) {
  for (const side of [-1, 1]) {
    const tops = [];
    const n = Math.max(2, Math.round((xb - xa) / step));
    for (let i = 0; i <= n; i++) {
      const x = lerp(xa, xb, i / n);
      const z = h.z0 + side * Math.max(0.05, h.wAt(x) - inset);
      const y = h.yAt(x);
      rod(k, FIX.steel, V(x, y, z), V(x, y + height, z), 0.025, 4);
      tops.push(V(x, y + height, z));
    }
    k.polyline(tops);
    k.polyline(tops.map((p) => p.clone().add(V(0, -height / 2, 0))));
  }
}
function wheel(k, x, y, z, r = 0.45, color = FIX.steel) {
  k.add(color, new THREE.TorusGeometry(r, 0.035, 4, 12), tf(x, y + r + 0.15, z, 0, Math.PI / 2, 0));
  rod(k, color, V(x - 0.15, y, z), V(x, y + r + 0.15, z), 0.06);
}
function bimini(k, color, xa, xb, y, w, posts = true) {
  box(k, color, xb - xa, 0.06, 2 * w, (xa + xb) / 2, y, 0);
  if (posts) for (const z of [-w, w]) {
    rod(k, FIX.steel, V(xa, y - 1.5, z), V(xa, y, z), 0.025, 4);
    rod(k, FIX.steel, V(xb, y - 1.5, z * 0.95), V(xb, y, z), 0.025, 4);
  }
}
function sprayhood(k, color, xBack, y, w, len = 1.0, h = 0.7) {
  const q = cabin(k, color, { x0: xBack, x1: xBack + len, xt0: xBack, xt1: xBack + len * 0.35, y0: y, y1: y + h, wb: w, wt: w * 0.92 });
  glass(k, q, y + h * 0.35, y + h * 0.8, 'front');
}
function fenderRow(k, h, xa, xb, n, color = FIX.white, sides = [-1, 1]) {
  k = k.fenders || k;
  for (let i = 0; i < n; i++) {
    const x = lerp(xa, xb, n === 1 ? 0.5 : i / (n - 1));
    for (const side of sides) {
      const z = h.z0 + side * (h.wAt(x) + 0.12);
      cyl(k, color, 0.11, 0.11, 0.55, x, h.yAt(x) - 0.55, z, {}, 6);
    }
  }
}
function tires(k, h, xa, xb, n) {
  for (let i = 0; i < n; i++) {
    const x = lerp(xa, xb, i / (n - 1));
    for (const side of [-1, 1]) {
      const z = h.z0 + side * (h.wAt(x) * 0.97 + 0.1);
      k.add(FIX.rubber, new THREE.TorusGeometry(0.28, 0.1, 4, 8), tf(x, h.yAt(x) - 0.45, z));
    }
  }
}
// Dicke Scheuerleiste entlang der Deckskante.
function strake(k, h, color = FIX.rubber, r = 0.09, drop = 0.12, n = 16) {
  for (const side of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const x = lerp(h.sternX + 0.01, h.bowX - 0.05, i / n);
      pts.push(V(x, h.yAt(x) - drop, h.z0 + side * (h.wAt(x) + 0.02)));
    }
    for (let i = 0; i < n; i++) rod(k, color, pts[i], pts[i + 1], r, 5);
  }
  const sx = h.sternX + 0.01, sw = h.wAt(sx);
  if (sw > 0.2) rod(k, color, V(sx - 0.02, h.yAt(sx) - drop, -sw), V(sx - 0.02, h.yAt(sx) - drop, sw), r, 5);
}
function radarArch(k, color, x, y, w, h = 1.4) {
  for (const s of [-1, 1]) rod(k, color, V(x + 0.6, y, s * w), V(x, y + h, s * w * 0.85), 0.09, 5);
  box(k, color, 0.5, 0.14, 2 * w * 0.85 + 0.2, x, y + h, 0);
}

// Mast mit Baum, Persenning, Rollfock und Stagen. Gibt Daten für gesetzte Segel zurück.
function mastRig(k, h, o) {
  const x = o.x, top = o.top, base = o.base ?? h.yAt(x);
  const z0 = h.z0;
  const mc = o.mastColor ?? FIX.mast;
  rod(k, mc, V(x, base, z0), V(x, top, z0), o.r ?? 0.09, 6);
  // Saling
  const spY = lerp(base, top, 0.55);
  const spW = Math.min(h.wAt(x) * 0.8, 1.1);
  box(k, mc, 0.08, 0.05, 2 * spW, x, spY, z0);
  // Wanten
  for (const s of [-1, 1]) {
    const dz = o.shroudZ ?? h.wAt(x - 0.4) - 0.05;
    const foot = V(x - 0.4, o.shroudY ?? h.yAt(x - 0.4), z0 + s * dz);
    k.polyline([foot, V(x, spY, z0 + s * spW), V(x, top - 0.3, z0)]);
  }
  // Vorstag
  const tack = o.tack ?? h.bow().add(V(-0.25, 0, 0));
  const head = V(x, top - (o.fractional ? (top - base) * 0.12 : 0.2), z0);
  if (o.bridle) for (const b of o.bridle) k.line(head, b); else k.line(tack, head);
  // Achterstag
  if (o.backstay !== false) {
    const sb = o.backstayFoot ?? h.stern().add(V(0.25, 0, 0));
    k.line(V(x, top, z0), sb);
  }
  const boomY = o.boomY ?? base + 1.4;
  const boomLen = o.boom ?? 4.5;
  const name = o.name ?? 'main';
  let boom = null;
  if (boomLen > 0) {
    // Gruppe mit Drehpunkt am Mast: Baum, Persenning und Großsegel schwenken gemeinsam.
    boom = new THREE.Group();
    boom.name = name === 'main' ? 'boom' : 'boom-' + name;
    boom.position.set(x, boomY, z0);
    const bk = new Kit();
    rod(bk, mc, V(0, 0, 0), V(-boomLen, 0.15, 0), 0.06, 5);
    bk.build(boom, boom.name + '-spar');
    const ck = new Kit();
    box(ck, o.canvas, boomLen * 0.85, 0.32, 0.28, -boomLen * 0.45, 0.2, 0);
    ck.build(boom, 'cover-' + name);
    k.groups.push(boom);
  }
  const tackPt = o.bridle ? V(o.bridle[0].x, o.bridle[0].y, z0) : tack;
  if (!o.noJib) {
    const jk = new Kit();
    rod(jk, o.canvas, tackPt.clone().lerp(head, 0.05), tackPt.clone().lerp(head, 0.9), 0.06, 5);
    k.covers.push(jk);
  }
  return { x, top, base, boomY, boomLen, boom, tack: tackPt, head, z0, noJib: !!o.noJib, name };
}

// Segel als dünne Dreiecke. Großsegel: Kind des Baums, Ursprung am Hals (Fuß am Mast),
// wird zum Bergen auf y gestaucht. Vorsegel: Ursprung am Vorstag-Fuß, lokale y-Achse
// entlang des Vorstags, wird zum Einrollen auf x gestaucht (userData.furl = 'x').
const SAIL_SCALE_OFF = 0.001;
function sailMesh(pts, name) {
  const g = new THREE.BufferGeometry().setFromPoints(pts);
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, mat(FIX.sail, { side: true }));
  mesh.name = name;
  mesh.castShadow = true;
  return mesh;
}
function addSails(body, r) {
  const out = [];
  if (r.boom) {
    const head = r.top - 0.4 - r.boomY;
    const main = sailMesh([V(0.05, 0.1, 0), V(0.05, head, 0), V(-r.boomLen * 0.97, 0.25, 0)], r.name === 'main' ? 'sail-main' : 'sail-' + r.name);
    main.userData.furl = 'y';
    r.boom.add(main);
    out.push(main);
  }
  if (!r.noJib) {
    const tack = r.tack.clone().add(V(0, 0.3, 0));
    const headP = r.head.clone().add(V(0, -0.5, 0));
    const clewW = V(r.x - Math.min(2.2, Math.max(1.2, r.boomLen * 0.45)), r.base + 0.6, r.z0 + 0.05);
    const ey = headP.clone().sub(tack);
    const len = ey.length();
    ey.normalize();
    const c = clewW.clone().sub(tack);
    const ex = c.clone().sub(ey.clone().multiplyScalar(c.dot(ey))).normalize();
    const ez = new THREE.Vector3().crossVectors(ex, ey);
    const jib = sailMesh([V(0, 0, 0), V(0, len, 0), V(c.dot(ex), c.dot(ey), 0)], 'sail-jib');
    jib.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(ex, ey, ez));
    jib.position.copy(tack);
    jib.userData.furl = 'x';
    body.add(jib);
    out.push(jib);
  }
  return out;
}

// ------------------------------------------------------------------ Modelle
const B = {};

// L1-1 Moderne Serienyacht
B['L1-1'] = (k, m, p) => {
  const h = hull(k, { L: 12, B: 4.0, fb: 1.15, sheer: 0.22, sternW: 0.9, bowRake: 0.01, sternRake: 0, tMax: 0.5, bowP: 1.5, depth: 0.6, hull: p.hull, trim: p.trim, deck: p.deck });
  const d = h.yAt(0);
  const q = cabin(k, p.house, { x0: -1.8, x1: 3.4, xt0: -1.6, xt1: 2.5, y0: d - 0.05, y1: d + 0.5, wb: 1.4, wt: 1.2 });
  glass(k, q, d + 0.15, d + 0.38, 'side', -0.9, 2.5);
  glass(k, q, d + 0.15, d + 0.38, 'front');
  box(k, FIX.teak, 3.6, 0.06, 2.8, -4.0, h.yAt(-4) + 0.02, 0);
  sprayhood(k, p.canvas, -2.6, h.yAt(-2) + 0.0, 1.1, 1.0, 0.75);
  wheel(k, -4.9, h.yAt(-4.9), -0.9);
  wheel(k, -4.9, h.yAt(-4.9), 0.9);
  bimini(k, p.canvas, -4.3, -2.4, d + 1.9, 1.3);
  box(k, FIX.teak, 0.7, 0.1, 3.0, -6.25, 0.4, 0);
  reling(k, h, -5.6, 5.2);
  const r = mastRig(k, h, { x: 1.0, base: d + 0.5, top: 17.5, boom: 4.8, boomY: d + 2.3, canvas: p.canvas });
  return { rigs: [r] };
};

// L1-2 Decksalonyacht
B['L1-2'] = (k, m, p) => {
  const h = hull(k, { L: 12.5, B: 4.1, fb: 1.2, sheer: 0.28, sternW: 0.78, bowRake: 0.02, sternRake: 0.02, tMax: 0.48, bowP: 1.6, depth: 0.6, hull: p.hull, trim: p.trim, deck: p.deck });
  const d = h.yAt(0);
  const q = cabin(k, p.house, { x0: -2.6, x1: 2.8, xt0: -2.2, xt1: 1.4, y0: d - 0.05, y1: d + 1.05, wb: 1.5, wt: 1.3 });
  glass(k, q, d + 0.45, d + 0.88, 'wrap');
  cabin(k, p.house, { x0: 2.8, x1: 4.4, xt0: 2.6, xt1: 3.9, y0: d, y1: d + 0.35, wb: 1.2, wt: 1.0 });
  box(k, FIX.teak, 3.0, 0.06, 2.6, -4.4, h.yAt(-4.4) + 0.02, 0);
  sprayhood(k, p.canvas, -3.2, d - 0.05, 1.05, 0.7, 0.65);
  wheel(k, -5.0, h.yAt(-5), 0, 0.5);
  reling(k, h, -5.9, 5.4);
  const r = mastRig(k, h, { x: 1.5, base: d + 1.05, top: 18, boom: 4.6, boomY: d + 2.3, canvas: p.canvas });
  return { rigs: [r] };
};

// L1-3 Mittelcockpit-Yacht
B['L1-3'] = (k, m, p) => {
  const h = hull(k, { L: 13, B: 4.2, fb: 1.2, sheer: 0.32, sternW: 0.68, bowRake: 0.05, sternRake: 0.04, tMax: 0.45, bowP: 1.7, depth: 0.6, hull: p.hull, trim: p.trim, deck: p.deck });
  const d = h.yAt(0);
  const fq = cabin(k, p.house, { x0: 1.0, x1: 4.2, xt0: 1.1, xt1: 3.5, y0: d - 0.05, y1: d + 0.5, wb: 1.35, wt: 1.15 });
  windowRow(k, fq, d + 0.18, d + 0.36, 1.4, 3.6, 3);
  // Feste Windschutzscheibe vor dem Cockpit
  const ws = cabin(k, p.house, { x0: 0.6, x1: 1.0, xt0: 0.6, xt1: 0.75, y0: d + 0.45, y1: d + 1.15, wb: 1.4, wt: 1.3 });
  glass(k, ws, d + 0.6, d + 1.05, 'front');
  box(k, FIX.teak, 2.4, 0.06, 2.6, -0.6, d + 0.02, 0);
  wheel(k, -1.2, d, 0, 0.45);
  // Achterkajüte
  const aq = cabin(k, p.house, { x0: -5.6, x1: -1.8, xt0: -5.3, xt1: -2.0, y0: h.yAt(-4) - 0.05, y1: h.yAt(-4) + 0.75, wb: 1.6, wt: 1.45 });
  windowRow(k, aq, h.yAt(-4) + 0.3, h.yAt(-4) + 0.52, -5.0, -2.4, 3, 0.5);
  bimini(k, p.canvas, -1.8, 0.6, d + 1.95, 1.4);
  reling(k, h, -6.1, 5.6);
  const r = mastRig(k, h, { x: 1.6, base: d + 0.5, top: 18, boom: 3.6, boomY: d + 2.4, canvas: p.canvas });
  return { rigs: [r] };
};

// L1-4 Regattayacht
B['L1-4'] = (k, m, p) => {
  const h = hull(k, { L: 11.5, B: 3.8, fb: 0.85, sheer: 0.1, sheerAft: 0, sternW: 0.96, bowRake: 0, sternRake: 0, tMax: 0.55, bowP: 1.3, depth: 0.55, stripe: 0.12, hull: p.hull, trim: p.trim, deck: p.deck });
  const d = h.yAt(0);
  const q = cabin(k, p.deck, { x0: 0.2, x1: 2.6, xt0: 0.4, xt1: 2.2, y0: d - 0.05, y1: d + 0.28, wb: 1.0, wt: 0.85 });
  glass(k, q, d + 0.1, d + 0.22, 'side', 0.8, 1.9);
  wheel(k, -4.4, h.yAt(-4.4), -1.05, 0.6, FIX.carbon);
  wheel(k, -4.4, h.yAt(-4.4), 1.05, 0.6, FIX.carbon);
  // Bugspriet
  rod(k, FIX.carbon, V(h.bowX - 0.8, h.yAt(h.bowX) + 0.05, 0), V(h.bowX + 1.4, h.yAt(h.bowX) + 0.05, 0), 0.06, 5);
  const r = mastRig(k, h, { x: 1.2, base: d, top: 18.5, boom: 5.0, boomY: d + 1.0, canvas: p.canvas, mastColor: FIX.carbon, r: 0.1, backstay: false, fractional: true });
  return { rigs: [r] };
};

// L1-5 Langfahrt-Ketsch
B['L1-5'] = (k, m, p) => {
  const h = hull(k, { L: 13.5, B: 4.2, fb: 1.25, sheer: 0.4, sternW: 0.55, bowRake: 0.08, sternRake: 0.05, tMax: 0.45, bowP: 1.8, depth: 0.6, hull: p.hull, trim: p.trim, deck: p.deck });
  const d = h.yAt(0);
  const q = cabin(k, FIX.teak, { x0: -1.8, x1: 3.6, xt0: -1.6, xt1: 3.2, y0: d - 0.05, y1: d + 0.55, wb: 1.35, wt: 1.25 });
  windowRow(k, q, d + 0.22, d + 0.4, -1.2, 3.0, 5, 0.55);
  box(k, p.house, 5.0, 0.08, 2.4, 0.8, d + 0.58, 0);
  sprayhood(k, p.canvas, -2.6, d - 0.05, 1.1, 0.9, 0.75);
  wheel(k, -4.6, h.yAt(-4.6), 0, 0.5);
  reling(k, h, -6.2, 5.6);
  // Geräteträger mit Solarpanel und Windgenerator
  const sx = h.sternX + 0.3, sy = h.yAt(sx);
  for (const s of [-1, 1]) rod(k, FIX.steel, V(sx + 0.4, sy, s * 0.9), V(sx - 0.2, sy + 2.2, s * 0.9), 0.05, 5);
  box(k, FIX.solar, 1.2, 0.05, 2.0, sx - 0.4, sy + 2.25, 0);
  box(k, FIX.steel, 1.4, 0.04, 2.1, sx - 0.4, sy + 2.2, 0);
  rod(k, FIX.steel, V(sx - 0.1, sy + 2.2, 0.9), V(sx - 0.1, sy + 3.4, 0.9), 0.04, 5);
  // Davits mit Beiboot quer am Heck
  for (const s of [-1, 1]) rod(k, FIX.steel, V(sx + 0.1, sy + 0.9, s * 1.0), V(sx - 1.0, sy + 1.3, s * 1.0), 0.04, 5);
  dinghy(k, tf(sx - 1.0, sy + 0.55, 0, 0, Math.PI / 2, 0));
  const r1 = mastRig(k, h, { x: 1.6, base: d + 0.55, top: 17, boom: 4.2, boomY: d + 2.1, canvas: p.canvas, backstay: false });
  const r2 = mastRig(k, h, { name: 'mizzen', x: -3.6, top: 11, boom: 2.6, boomY: h.yAt(-3.6) + 2.2, canvas: p.canvas, noJib: true, backstay: true, tack: V(1.6, 10.5, 0) });
  k.line(V(-3.6, 10.8, 0), V(1.6, 13.5, 0));
  const anim = { spin: [] };
  // Windrad: eigenes Objekt, damit es sich drehen kann
  const wg = new THREE.Group();
  wg.position.set(sx - 0.1, sy + 3.45, 0.9);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.35, 6).rotateZ(Math.PI / 2), mat(FIX.white));
  wg.add(hub);
  const blades = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.6, 0.08).translate(0, 0.3, 0), mat(FIX.white));
    b.rotation.x = (i * Math.PI * 2) / 3;
    blades.add(b);
  }
  blades.position.x = 0.2;
  wg.add(blades);
  anim.spin.push({ obj: blades, axis: 'x', speed: 9 });
  wg.name = 'windgen';
  return { rigs: [r1, r2], extra: [wg], anim };
};

// ---------- L2 Mehrrumpfboot
function catHulls(k, p, o) {
  const hs = [-1, 1].map((s) => hull(k, { L: o.L, B: o.bh, z: s * o.zc, fb: o.fb, sheer: o.sheer ?? 0.15, sheerAft: 0, sternW: o.sternW ?? 0.7, bowRake: o.bowRake ?? 0, sternRake: 0, tMax: o.tMax ?? 0.5, bowP: o.bowP ?? 1.2, depth: o.depth ?? 0.5, wlIn: 0.8, stripe: o.stripe ?? 0.25, hull: p.hull, trim: p.trim, deck: p.deck, N: 14 }));
  return hs;
}
function bridge(k, c, xa, xb, y0, y1, w) {
  box(k, c, xb - xa, y1 - y0, 2 * w, (xa + xb) / 2, (y0 + y1) / 2, 0);
}

B['L2-1'] = (k, m, p) => {
  const [hp, hs] = catHulls(k, p, { L: 12, bh: 1.5, zc: 2.65, fb: 1.35 });
  bridge(k, p.house, -5.6, 2.2, 0.95, 1.4, 2.6);
  box(k, FIX.teak, 2.9, 0.05, 4.6, -4.1, 1.42, 0);
  const q = cabin(k, p.house, { x0: -2.6, x1: 2.1, xt0: -2.3, xt1: 0.9, y0: 1.4, y1: 3.0, wb: 2.55, wt: 2.35 });
  glass(k, q, 1.95, 2.65, 'wrap');
  box(k, p.house, 3.2, 0.1, 4.8, -3.9, 3.0, 0);
  for (const z of [-2.2, 2.2]) rod(k, FIX.steel, V(-5.4, 1.4, z), V(-5.4, 2.95, z), 0.04, 4);
  rod(k, p.house, V(5.0, 1.4, -2.65), V(5.0, 1.4, 2.65), 0.1, 6);
  box(k, FIX.net, 2.8, 0.03, 4.0, 3.6, 1.35, 0);
  wheel(k, -2.9, 3.0, 2.0, 0.4);
  const r = mastRig(k, hp, { x: 1.3, base: 3.0, top: 19, boom: 5.0, boomY: 4.0, canvas: p.canvas, shroudZ: 2.55, shroudY: 1.45, tack: V(5.0, 1.45, 0), backstay: false });
  return { rigs: [r] };
};

B['L2-2'] = (k, m, p) => {
  const [hp] = catHulls(k, p, { L: 13, bh: 1.6, zc: 2.85, fb: 1.4 });
  bridge(k, p.house, -6.0, 2.4, 1.0, 1.45, 2.8);
  box(k, FIX.teak, 3.0, 0.05, 5.0, -4.4, 1.47, 0);
  const q = cabin(k, p.house, { x0: -2.9, x1: 2.3, xt0: -2.6, xt1: 1.1, y0: 1.45, y1: 3.05, wb: 2.75, wt: 2.55 });
  glass(k, q, 2.0, 2.7, 'wrap');
  box(k, p.house, 3.4, 0.1, 5.2, -4.3, 3.05, 0);
  for (const z of [-2.4, 2.4]) rod(k, FIX.steel, V(-5.9, 1.45, z), V(-5.9, 3.0, z), 0.04, 4);
  // Flybridge
  cabin(k, p.house, { x0: -2.6, x1: -0.2, xt0: -2.4, xt1: -0.4, y0: 3.05, y1: 3.65, wb: 1.4, wt: 1.3 });
  box(k, FIX.cushion, 1.2, 0.2, 2.2, -3.4, 3.2, 0);
  wheel(k, -1.0, 3.65, -0.6, 0.35);
  bimini(k, p.canvas, -3.6, -0.6, 5.3, 1.4);
  rod(k, p.house, V(5.4, 1.45, -2.85), V(5.4, 1.45, 2.85), 0.1, 6);
  box(k, FIX.net, 3.0, 0.03, 4.4, 3.9, 1.4, 0);
  const r = mastRig(k, hp, { x: 1.6, base: 3.05, top: 20, boom: 5.0, boomY: 5.7, canvas: p.canvas, shroudZ: 2.75, shroudY: 1.5, tack: V(5.4, 1.5, 0), backstay: false });
  return { rigs: [r] };
};

B['L2-3'] = (k, m, p) => {
  catHulls(k, p, { L: 12.5, bh: 1.4, zc: 2.4, fb: 1.45, sheer: 0.3, bowP: 1.4, sternW: 0.85 });
  bridge(k, p.house, -5.8, 3.4, 1.0, 1.5, 2.45);
  box(k, FIX.teak, 2.6, 0.05, 4.2, -4.6, 1.52, 0);
  const q = cabin(k, p.house, { x0: -3.2, x1: 3.4, xt0: -2.9, xt1: 1.8, y0: 1.5, y1: 3.25, wb: 3.05, wt: 2.9 });
  glass(k, q, 2.05, 2.95, 'wrap');
  box(k, p.house, 2.8, 0.1, 5.4, -4.4, 3.25, 0);
  for (const z of [-2.6, 2.6]) rod(k, FIX.steel, V(-5.7, 1.5, z), V(-5.7, 3.2, z), 0.04, 4);
  // Flybridge mit Hardtop und Radar
  cabin(k, p.house, { x0: -1.2, x1: 0.8, xt0: -1.0, xt1: 0.5, y0: 3.25, y1: 3.8, wb: 1.5, wt: 1.4 });
  box(k, FIX.cushion, 1.4, 0.2, 2.4, -2.2, 3.4, 0);
  wheel(k, 0.1, 3.8, 0.7, 0.32);
  const top = cabin(k, p.house, { x0: -3.0, x1: 0.8, xt0: -2.9, xt1: 0.6, y0: 5.4, y1: 5.55, wb: 1.7, wt: 1.65 });
  for (const s of [-1, 1]) {
    rod(k, p.house, V(0.6, 3.8, s * 1.4), V(0.3, 5.4, s * 1.55), 0.07, 5);
    rod(k, p.house, V(-2.8, 3.3, s * 1.5), V(-2.8, 5.4, s * 1.55), 0.05, 5);
  }
  glass(k, top, 3.9, 5.3, 'front', 0, 0, FIX.glass);
  const radar = radarDome(-1.0, 5.55, 0);
  return { rigs: [], extra: [radar.obj], anim: { spin: [radar.spin] } };
};

B['L2-4'] = (k, m, p) => {
  const hm = hull(k, { L: 12.5, B: 2.6, fb: 1.15, sheer: 0.2, sternW: 0.6, bowRake: 0.01, sternRake: 0, tMax: 0.5, bowP: 1.3, depth: 0.55, hull: p.hull, trim: p.trim, deck: p.deck, N: 16 });
  for (const s of [-1, 1]) hull(k, { L: 10, B: 0.85, x: 0.4, z: s * 3.3, fb: 0.95, sheer: 0.2, sheerAft: 0, sternW: 0.3, bowRake: 0, sternRake: 0, tMax: 0.55, bowP: 1.2, depth: 0.3, wlIn: 0.75, hull: p.hull, trim: p.trim, deck: p.deck, N: 12 });
  for (const xb of [2.0, -2.6]) for (const s of [-1, 1]) {
    rod(k, p.hull, V(xb, hm.yAt(xb) - 0.1, s * 1.1), V(xb, 1.75, s * 2.2), 0.13, 6);
    rod(k, p.hull, V(xb, 1.75, s * 2.2), V(xb + 0.1, 1.0, s * 3.3), 0.13, 6);
  }
  for (const s of [-1, 1]) box(k, FIX.net, 4.4, 0.03, 1.9, -0.3, 1.2, s * 2.25);
  const d = hm.yAt(0);
  const q = cabin(k, p.house, { x0: -1.6, x1: 2.6, xt0: -1.4, xt1: 1.6, y0: d - 0.05, y1: d + 0.55, wb: 1.05, wt: 0.9 });
  glass(k, q, d + 0.2, d + 0.42, 'side', -0.9, 1.6);
  glass(k, q, d + 0.2, d + 0.42, 'front');
  wheel(k, -4.2, hm.yAt(-4.2), 0, 0.45);
  const r = mastRig(k, hm, { x: 1.9, base: d + 0.55, top: 18, boom: 5.0, boomY: d + 1.9, canvas: p.canvas, shroudZ: 3.3, shroudY: 1.0, backstay: false });
  return { rigs: [r] };
};

B['L2-5'] = (k, m, p) => {
  const [hp] = catHulls(k, p, { L: 10.5, bh: 0.8, zc: 2.6, fb: 0.95, sheer: 0.25, sternW: 0.3, tMax: 0.6, bowP: 1.1, depth: 0.35, stripe: 0.15 });
  for (const xb of [1.0, -3.0]) box(k, p.trim, 0.3, 0.25, 5.4, xb, 1.0, 0);
  box(k, FIX.net, 4.0, 0.03, 4.4, -1.0, 0.95, 0);
  rod(k, FIX.carbon, V(1.0, 0.85, 0), V(1.0, -0.2, 0), 0.04, 4);
  const bow = hp.bow();
  const r = mastRig(k, hp, { x: 1.0, base: 1.12, top: 19, boom: 4.4, boomY: 2.0, canvas: p.canvas, mastColor: FIX.carbon, r: 0.11, shroudZ: 2.6, shroudY: 1.0, backstay: false, bridle: [V(bow.x - 0.3, bow.y, -2.6), V(bow.x - 0.3, bow.y, 2.6)], noJib: false });
  return { rigs: [r] };
};

// ---------- L3 Motoryacht
function radarDome(x, y, z) {
  const g = new THREE.Group();
  g.name = 'radar-mount';
  g.position.set(x, y, z);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.25, 6).translate(0, 0.12, 0), mat(FIX.white));
  const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.18, 8).translate(0, 0.33, 0), mat(FIX.white));
  const mark = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.08).translate(0.1, 0.44, 0), mat(FIX.grey));
  dome.add(mark);
  dome.name = 'radar';
  g.add(base, dome);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { obj: g, spin: { obj: dome, axis: 'y', speed: 2.2 } };
}
function radarBar(x, y, z, len = 1.4) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, len), mat(FIX.white));
  bar.position.y = 0.2;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 6).translate(0, 0.08, 0), mat(FIX.grey));
  const spin = new THREE.Group();
  spin.name = 'radar';
  spin.add(bar);
  g.add(post, spin);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { obj: g, spin: { obj: spin, axis: 'y', speed: 2.6 } };
}
// Flagge, Ursprung an der Stange, weht nach achtern (-x).
function flag(x, y, w, hgt, color = COLORS.red) {
  const g = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, 0.02).translate(-w / 2, 0, 0), mat(color));
  g.position.set(x, y, 0);
  g.name = 'flag';
  g.castShadow = true;
  return g;
}

function blueLights(pts) {
  const g = new THREE.Group();
  g.name = 'beacons';
  const on = mat(FIX.blueLight, { emissive: true });
  const meshes = pts.map((p) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.16, 6), on);
    mesh.position.copy(p);
    mesh.name = 'beacon-blue';
    g.add(mesh);
    return mesh;
  });
  return { obj: g, blink: meshes };
}

B['L3-1'] = (k, m, p) => {
  const h = hull(k, { L: 13.5, B: 4.3, fb: 1.55, sheer: 0.45, sternW: 0.92, bowRake: 0.05, sternRake: 0, tMax: 0.5, bowP: 1.7, depth: 0.5, stripe: 0.18, hull: p.hull, trim: p.trim, deck: p.deck });
  const d = h.yAt(0);
  const q = cabin(k, p.house, { x0: -4.2, x1: 3.2, xt0: -4.0, xt1: 1.4, y0: d - 0.05, y1: d + 1.35, wb: 1.9, wt: 1.75 });
  glass(k, q, d + 0.45, d + 1.1, 'side', -3.4, 1.2);
  glass(k, q, d + 0.55, d + 1.15, 'front');
  glass(k, q, d + 0.2, d + 1.15, 'back');
  // Überstand der Flybridge über dem Achtercockpit
  box(k, p.house, 2.0, 0.12, 3.6, -5.1, d + 1.32, 0);
  for (const s of [-1, 1]) rod(k, FIX.steel, V(-6.0, h.yAt(-6), s * 1.6), V(-6.0, d + 1.3, s * 1.6), 0.04, 4);
  const fy = d + 1.35;
  cabin(k, p.house, { x0: 0.0, x1: 1.4, xt0: 0.1, xt1: 0.9, y0: fy, y1: fy + 0.6, wb: 1.5, wt: 1.4 });
  const ws = cabin(k, FIX.glass, { x0: 0.9, x1: 1.2, xt0: 0.7, xt1: 0.8, y0: fy + 0.55, y1: fy + 0.9, wb: 1.45, wt: 1.4 });
  wheel(k, -0.3, fy, -0.6, 0.3);
  box(k, FIX.cushion, 1.0, 0.25, 2.6, -2.0, fy + 0.15, 0);
  box(k, FIX.cushion, 1.6, 0.25, 0.5, -3.6, fy + 0.15, 1.3);
  reling(k, { ...h, yAt: () => fy, wAt: () => 1.85 }, -5.9, -0.2, 0.7, 1.5, 0.05);
  radarArch(k, p.house, -1.4, fy, 1.5, 1.4);
  const radar = radarDome(-1.4, fy + 1.47, 0);
  box(k, FIX.teak, 0.9, 0.1, 3.8, -7.1, 0.35, 0);
  reling(k, h, 2.0, 6.2, 0.55, 1.2);
  return { rigs: [], extra: [radar.obj], anim: { spin: [radar.spin] } };
};

B['L3-2'] = (k, m, p) => {
  const h = hull(k, { L: 12.5, B: 4.3, fb: 1.45, sheer: 0.75, sheerAft: 0.1, sternW: 0.82, bowRake: 0.03, sternRake: 0.01, tMax: 0.45, bowP: 1.9, depth: 0.7, stripe: 0.2, hull: p.hull, trim: p.trim, deck: p.deck });
  const d = h.yAt(0);
  const q = cabin(k, p.house, { x0: -3.8, x1: 2.4, xt0: -3.7, xt1: 2.3, y0: d - 0.1, y1: d + 1.2, wb: 1.72, wt: 1.68 });
  windowRow(k, q, d + 0.5, d + 1.0, -3.4, 0.4, 3, 0.25);
  const ph = cabin(k, p.house, { x0: 0.4, x1: 2.4, xt0: 0.45, xt1: 2.35, y0: d + 1.2, y1: d + 2.1, wb: 1.6, wt: 1.56 });
  glass(k, ph, d + 1.45, d + 1.95, 'wrap');
  box(k, p.roof, 2.4, 0.12, 3.6, 1.4, d + 2.16, 0);
  box(k, p.roof, 6.6, 0.1, 3.7, -0.7, d + 1.23, 0);
  reling(k, { ...h, yAt: () => d + 1.25, wAt: () => 1.75 }, -3.8, 0.2, 0.6, 1.4, 0.05);
  // Signalmast mit Ladebaum
  rod(k, FIX.white, V(-0.3, d + 1.25, 0), V(-0.3, 7.2, 0), 0.07, 6);
  box(k, FIX.white, 0.1, 0.06, 1.2, -0.3, 6.2, 0);
  rod(k, FIX.white, V(-0.3, d + 1.6, 0), V(-3.0, d + 2.6, 0), 0.05, 5);
  k.line(V(-0.3, 6.6, 0), V(-3.0, d + 2.6, 0));
  dinghy(k, tf(-2.4, d + 1.35, 0, 0, 0, 0), FIX.white);
  reling(k, h, -6.0, 5.8, 0.75, 1.3);
  fenderRow(k, h, -4, 2, 3);
  return { rigs: [] };
};

B['L3-3'] = (k, m, p) => {
  const h = hull(k, { L: 13, B: 3.9, fb: 1.05, sheer: 0.28, sternW: 0.9, bowRake: 0.07, sternRake: 0, tMax: 0.55, bowP: 1.4, depth: 0.45, stripe: 0.3, hull: p.hull, trim: p.trim, deck: p.deck });
  const d = h.yAt(0);
  cabin(k, p.house, { x0: 0.6, x1: 5.0, xt0: 0.8, xt1: 4.2, y0: d - 0.05, y1: d + 0.32, wb: 1.6, wt: 1.3 });
  const ws = cabin(k, FIX.glass, { x0: 0.0, x1: 0.9, xt0: -0.5, xt1: -0.2, y0: d + 0.25, y1: d + 1.05, wb: 1.75, wt: 1.6 });
  // Hardtop mit Schiebedach
  for (const s of [-1, 1]) {
    rod(k, p.house, V(-0.3, d + 1.0, s * 1.55), V(-0.6, d + 1.65, s * 1.5), 0.08, 5);
    rod(k, p.house, V(-3.0, d, s * 1.6), V(-2.8, d + 1.65, s * 1.5), 0.07, 5);
  }
  box(k, p.house, 0.9, 0.08, 3.1, -0.9, d + 1.7, 0);
  box(k, FIX.glass, 1.1, 0.04, 2.2, -1.9, d + 1.68, 0);
  box(k, p.house, 0.6, 0.08, 3.1, -2.75, d + 1.7, 0);
  for (const s of [-1, 1]) box(k, p.house, 1.1, 0.08, 0.45, -1.9, d + 1.7, s * 1.33);
  box(k, FIX.cushion, 2.2, 0.35, 1.6, -1.8, d + 0.17, 1.0);
  box(k, FIX.cushion, 2.0, 0.28, 3.2, -5.2, d + 0.16, 0);
  box(k, p.canvas, 1.0, 0.12, 3.2, -4.0, d + 0.36, 0, { rz: -0.35 });
  box(k, FIX.teak, 1.0, 0.1, 3.6, -6.9, 0.32, 0);
  return { rigs: [] };
};

B['L3-4'] = (k, m, p) => {
  const h = hull(k, { L: 11, B: 3.6, fb: 1.2, sheer: 0.4, sheerAft: 0.12, sternW: 0.0, bowRake: 0.0, sternRake: 0.07, tMax: 0.48, bowP: 1.6, depth: 0.6, stripe: 0.12, hull: p.hull, trim: p.trim, deck: p.deck, N: 22 });
  const d = h.yAt(0);
  const q = cabin(k, p.house, { x0: -2.2, x1: 2.4, xt0: -2.1, xt1: 2.2, y0: d - 0.05, y1: d + 1.0, wb: 1.3, wt: 1.25 });
  windowRow(k, q, d + 0.45, d + 0.82, -1.9, 1.9, 6, 0.3);
  glass(k, q, d + 0.45, d + 0.85, 'front');
  box(k, p.roof, 4.9, 0.08, 2.8, 0.1, d + 1.02, 0);
  cabin(k, p.house, { x0: 2.4, x1: 3.8, xt0: 2.4, xt1: 3.6, y0: d, y1: d + 0.4, wb: 1.05, wt: 1.0 });
  rod(k, p.house, V(1.9, d + 1.05, 0), V(1.9, d + 3.0, 0), 0.04, 5);
  rod(k, FIX.wood, V(h.sternX + 0.7, h.yAt(h.sternX + 0.7), 0), V(h.sternX + 0.3, h.yAt(h.sternX) + 1.5, 0), 0.03, 4);
  k.groups.push(flag(h.sternX + 0.3, h.yAt(h.sternX) + 1.32, 0.5, 0.32));
  reling(k, h, -5.0, 4.8, 0.5, 1.3);
  return { rigs: [] };
};

B['L3-5'] = (k, m, p) => {
  const h = hull(k, { L: 11.5, B: 3.8, fb: 1.25, sheer: 0.35, sheerAft: 0.1, sternW: 0.6, bowRake: 0.03, sternRake: 0.04, tMax: 0.45, bowP: 2.0, depth: 0.6, stripe: 0.18, hull: p.hull, trim: p.trim, deck: p.deck });
  strake(k, h);
  const d = h.yAt(0);
  const fq = cabin(k, p.house, { x0: 0.9, x1: 3.8, xt0: 1.0, xt1: 3.3, y0: d - 0.05, y1: d + 0.6, wb: 1.4, wt: 1.25 });
  windowRow(k, fq, d + 0.25, d + 0.45, 1.3, 3.2, 3, 0.55);
  // Verdeck über dem offenen Steuerstand
  const vq = cabin(k, p.canvas, { x0: -1.6, x1: 0.9, xt0: -1.5, xt1: 0.3, y0: d + 0.4, y1: d + 1.75, wb: 1.55, wt: 1.35 });
  glass(k, vq, d + 0.9, d + 1.5, 'front');
  glass(k, vq, d + 1.0, d + 1.45, 'side', -1.1, 0.0);
  box(k, p.house, 2.5, 0.42, 3.1, -0.35, d + 0.2, 0);
  const aq = cabin(k, p.house, { x0: -5.1, x1: -1.6, xt0: -4.9, xt1: -1.7, y0: h.yAt(-3.5) - 0.05, y1: h.yAt(-3.5) + 0.85, wb: 1.6, wt: 1.45 });
  windowRow(k, aq, h.yAt(-3.5) + 0.35, h.yAt(-3.5) + 0.58, -4.6, -2.0, 3, 0.55);
  reling(k, { ...h, yAt: () => h.yAt(-3.5) + 0.85, wAt: () => 1.45 }, -4.9, -1.8, 0.5, 1.0, 0.05);
  rod(k, FIX.white, V(-0.8, d + 1.75, 0), V(-0.8, 4.6, 0), 0.05, 5);
  box(k, FIX.white, 0.08, 0.05, 0.8, -0.8, 4.2, 0);
  reling(k, h, 0.5, 5.0, 0.55, 1.2);
  fenderRow(k, h, -3, 2, 3);
  return { rigs: [] };
};

// ---------- L4 Arbeits- und Behördenboot
B['L4-1'] = (k, m, p) => {
  const h = hull(k, { L: 10.5, B: 3.8, fb: 1.35, sheer: 0.45, sheerAft: 0.05, sternW: 0.85, bowRake: 0.03, sternRake: 0, tMax: 0.48, bowP: 1.8, depth: 0.6, stripe: 0.15, hull: p.hull, trim: p.trim, deck: p.deck });
  strake(k, h, FIX.rubber, 0.13, 0.15);
  k.noFenders = true;
  const d = h.yAt(0);
  const q = cabin(k, p.house, { x0: -1.8, x1: 2.4, xt0: -1.6, xt1: 1.7, y0: d - 0.05, y1: d + 1.55, wb: 1.6, wt: 1.45 });
  glass(k, q, d + 0.85, d + 1.35, 'wrap');
  box(k, p.roof, 3.6, 0.14, 3.1, 0.05, d + 1.6, 0);
  // Rettungsinsel und Mast
  cyl(k, FIX.white, 0.3, 0.3, 0.9, -1.0, d + 1.9, 0.7, { rx: Math.PI / 2 }, 8);
  rod(k, FIX.white, V(0.6, d + 1.65, 0), V(0.6, 5.3, 0), 0.06, 6);
  box(k, FIX.white, 0.08, 0.06, 1.0, 0.6, 4.8, 0);
  // Schleppbügel am Heck
  for (const s of [-1, 1]) rod(k, FIX.steel, V(-4.6, h.yAt(-4.6), s * 1.3), V(-4.3, h.yAt(-4.6) + 1.4, s * 0.9), 0.06, 5);
  rod(k, FIX.steel, V(-4.3, h.yAt(-4.6) + 1.4, -0.9), V(-4.3, h.yAt(-4.6) + 1.4, 0.9), 0.06, 5);
  reling(k, h, 2.5, 4.8, 0.6, 1.0);
  const radar = radarBar(0.6, 5.3, 0, 1.2);
  const bl = blueLights([V(0.6, d + 1.78, -1.1), V(0.6, d + 1.78, 1.1)]);
  return { rigs: [], extra: [radar.obj, bl.obj], anim: { spin: [radar.spin], blink: bl.blink } };
};

B['L4-2'] = (k, m, p) => {
  const h = hull(k, { L: 13, B: 4.2, fb: 1.45, sheer: 0.45, sternW: 0.9, bowRake: 0.04, sternRake: 0, tMax: 0.5, bowP: 1.7, depth: 0.6, stripe: 0.25, hull: p.hull, trim: p.trim, deck: p.deck });
  strake(k, h, FIX.rubber, 0.08, 0.1);
  const d = h.yAt(0);
  const q = cabin(k, p.house, { x0: -1.6, x1: 2.8, xt0: -1.4, xt1: 2.0, y0: d - 0.05, y1: d + 1.6, wb: 1.75, wt: 1.55 });
  glass(k, q, d + 0.85, d + 1.4, 'wrap');
  box(k, p.roof, 3.6, 0.12, 3.3, 0.3, d + 1.65, 0);
  box(k, p.trim, 4.4, 0.18, 0.02, 0.6, d + 0.5, 1.68, { rz: 0.0 });
  // Radarmast als Rahmen
  for (const s of [-1, 1]) rod(k, FIX.white, V(-0.6, d + 1.7, s * 0.9), V(-0.2, d + 3.7, s * 0.5), 0.07, 5);
  box(k, FIX.white, 0.4, 0.14, 1.3, -0.2, d + 3.75, 0);
  rod(k, FIX.white, V(-0.2, d + 3.8, 0), V(-0.2, 6.8, 0), 0.04, 5);
  // Schlauchboot auf dem Achterdeck
  dinghy(k, tf(-4.3, h.yAt(-4.3) + 0.25, 0, 0, 0, 0), COLORS.dark);
  box(k, FIX.steel, 0.12, 0.25, 1.4, -5.0, h.yAt(-5) + 0.1, 0);
  box(k, FIX.steel, 0.12, 0.25, 1.4, -3.6, h.yAt(-3.6) + 0.1, 0);
  reling(k, h, -6.0, 5.6, 0.7, 1.3);
  const radar = radarBar(-0.2, d + 3.82, 0, 1.6);
  const bl = blueLights([V(-0.2, d + 3.9, -0.6), V(-0.2, d + 3.9, 0.6)]);
  return { rigs: [], extra: [radar.obj, bl.obj], anim: { spin: [radar.spin], blink: bl.blink } };
};

B['L4-3'] = (k, m, p) => {
  const h = hull(k, { L: 11, B: 4.3, fb: 1.3, sheer: 0.35, sheerAft: 0.0, sternW: 0.92, bowRake: 0.02, sternRake: 0, tMax: 0.6, bowP: 1.3, depth: 0.9, stripe: 0.15, hull: p.hull, trim: p.trim, deck: p.deck });
  const d = h.yAt(0);
  const q = cabin(k, p.house, { x0: 0.6, x1: 3.0, xt0: 0.65, xt1: 2.95, y0: d - 0.05, y1: d + 1.8, wb: 1.35, wt: 1.3 });
  glass(k, q, d + 1.05, d + 1.6, 'wrap');
  box(k, p.roof, 2.8, 0.12, 3.0, 1.8, d + 1.85, 0);
  rod(k, FIX.white, V(1.8, d + 1.9, 0), V(1.8, 5.6, 0), 0.05, 5);
  box(k, FIX.white, 0.08, 0.05, 0.9, 1.8, 4.9, 0);
  // Schleppbock und Poller
  const sx = -2.4, sy = h.yAt(sx);
  for (const s of [-1, 1]) rod(k, p.trim, V(sx, sy, s * 1.1), V(sx, sy + 1.7, s * 1.1), 0.1, 6);
  rod(k, p.trim, V(sx, sy + 1.7, -1.2), V(sx, sy + 1.7, 1.2), 0.1, 6);
  for (const x of [-4.6, 3.8]) cyl(k, FIX.rubber, 0.13, 0.15, 0.4, x, h.yAt(x) + 0.2, 0, {}, 6);
  tires(k, h, -4.8, 4.0, 6);
  k.noFenders = true;
  // Schanzkleid
  for (const s of [-1, 1]) for (let x = -5.2; x < 4.5; x += 1.2) {
    const x2 = Math.min(x + 1.2, 4.6);
    const a = V(x, h.yAt(x), s * (h.wAt(x) - 0.04)), b = V(x2, h.yAt(x2), s * (h.wAt(x2) - 0.04));
    k.quad(p.hull, a, b, b.clone().add(V(0, 0.45, 0)), a.clone().add(V(0, 0.45, 0)), V((x + x2) / 2, a.y, 0));
  }
  return { rigs: [] };
};

B['L4-4'] = (k, m, p) => {
  const h = hull(k, { L: 14, B: 4.5, fb: 1.45, sheer: 0.75, sheerAft: 0.1, sternW: 0.75, bowRake: 0.04, sternRake: 0.02, tMax: 0.45, bowP: 1.8, depth: 0.9, stripe: 0.12, hull: p.hull, trim: p.trim, deck: p.deck, bottom: COLORS.red });
  const d = h.yAt(1);
  const q = cabin(k, p.house, { x0: 0.0, x1: 2.6, xt0: 0.1, xt1: 2.5, y0: d - 0.05, y1: d + 2.3, wb: 1.35, wt: 1.3 });
  glass(k, q, d + 1.55, d + 2.05, 'wrap');
  box(k, p.roof, 2.9, 0.14, 3.0, 1.3, d + 2.35, 0);
  // Vormast und Hauptmast mit Ladebaum
  rod(k, p.house, V(4.6, h.yAt(4.6), 0), V(4.6, 7.0, 0), 0.07, 6);
  rod(k, p.house, V(-0.6, h.yAt(-0.6), 0), V(-0.6, 8.0, 0), 0.08, 6);
  rod(k, p.house, V(-0.6, h.yAt(-0.6) + 1.2, 0), V(-4.4, h.yAt(-4.4) + 3.6, 0), 0.06, 5);
  k.line(V(-0.6, 7.4, 0), V(-4.4, h.yAt(-4.4) + 3.6, 0));
  k.line(V(-0.6, 8.0, 0), V(4.6, 7.0, 0));
  // Netztrommel am Heck mit Galgen
  const tx = -5.9, ty = h.yAt(tx) + 0.85;
  cyl(k, FIX.drum, 0.45, 0.45, 2.2, tx, ty, 0, { rx: Math.PI / 2 }, 10);
  for (const z of [-1.15, 1.15]) cyl(k, p.roof, 0.75, 0.75, 0.08, tx, ty, z, { rx: Math.PI / 2 }, 10);
  for (const s of [-1, 1]) rod(k, FIX.steel, V(tx + 0.4, h.yAt(tx), s * 1.3), V(tx, ty, s * 1.3), 0.08, 5);
  // Fischkisten
  for (let i = 0; i < 4; i++) box(k, FIX.box, 0.6, 0.3, 0.45, -2.2 - (i % 2) * 0.65, h.yAt(-2.2) + 0.15 + Math.floor(i / 2) * 0.3, 0.9);
  box(k, '#7fb6d6', 0.6, 0.3, 0.45, -3.6, h.yAt(-3.6) + 0.15, -0.9);
  reling(k, h, 3.0, 6.4, 0.75, 1.1);
  return { rigs: [] };
};

B['L4-5'] = (k, m, p) => {
  const h = hull(k, { L: 14, B: 4.0, fb: 0.85, sheer: 0.3, sheerAft: 0.05, sternW: 0.6, bowRake: 0.03, sternRake: 0.03, tMax: 0.5, bowP: 1.6, depth: 0.5, stripe: 0.12, hull: p.hull, trim: p.trim, deck: p.deck });
  const d = h.yAt(0);
  const q = cabin(k, p.house, { x0: -3.6, x1: 4.4, xt0: -3.4, xt1: 4.0, y0: d - 0.05, y1: d + 1.3, wb: 1.75, wt: 1.68 });
  windowRow(k, q, d + 0.55, d + 1.1, -3.2, 3.6, 9, 0.18);
  glass(k, q, d + 0.6, d + 1.1, 'front');
  box(k, p.roof, 8.6, 0.1, 3.7, 0.4, d + 1.35, 0);
  // Offenes Achterdeck mit Bänken
  for (const s of [-1, 1]) box(k, FIX.wood, 2.4, 0.35, 0.45, -4.9, h.yAt(-4.9) + 0.18, s * 1.25);
  box(k, FIX.wood, 0.45, 0.35, 1.8, -6.2, h.yAt(-6.2) + 0.18, 0);
  // Flaggenstock
  rod(k, FIX.wood, V(h.sternX + 0.4, h.yAt(h.sternX + 0.4), 0), V(h.sternX + 0.2, h.yAt(h.sternX) + 1.6, 0), 0.03, 4);
  k.groups.push(flag(h.sternX + 0.2, h.yAt(h.sternX) + 1.42, 0.55, 0.35));
  reling(k, h, -6.6, -3.7, 0.7, 0.9);
  fenderRow(k, h, -5, 4, 4, FIX.rubber);
  return { rigs: [] };
};

// ------------------------------------------------------------------ Öffentliche Schnittstelle
export const BUILDERS = B;

const KIND = { L1: 'sail', L2: 'sail', L3: 'motor', L4: 'motor' };

// Baut ein Modell. model: Eintrag aus MODELS oder seine id ("L1-3").
// opts.palette: Farbvariante, opts.sails: true = Segel gesetzt, opts.id: id aus sim.js (für game.pick).
export function buildBoat(model, { palette = 0, sails = false, id = null } = {}) {
  const m = typeof model === 'string' ? MODEL_BY_ID[model] : model;
  if (!m || !B[m.id]) throw new Error('Unbekanntes L-Modell: ' + (m && m.id));
  const p = m.palettes[((palette % m.palettes.length) + m.palettes.length) % m.palettes.length];
  const k = new Kit();
  k.hulls = [];
  k.fenders = new Kit();
  const res = B[m.id](k, m, p) || {};

  // Fender an die Außenseiten der Rümpfe, falls das Modell keine eigenen hat.
  if (!k.noFenders && !k.fenders.raw.size && !k.fenders.geo.size) {
    const main = k.hulls.filter((h) => Math.abs(h.z0) < 0.01);
    const outer = k.hulls.filter((h) => Math.abs(h.z0) >= 0.01);
    if (outer.length) {
      for (const h of outer) fenderRow(k.fenders, h, h.x0 - h.L * 0.25, h.x0 + h.L * 0.1, 2, FIX.white, [Math.sign(h.z0)]);
    } else if (main.length) {
      const h = main[0];
      fenderRow(k.fenders, h, h.x0 - h.L * 0.3, h.x0 + h.L * 0.12, 3);
    }
  }

  const group = new THREE.Group();
  group.name = 'boat-' + m.id;
  const body = new THREE.Group();
  body.name = 'hull';
  group.add(body);
  k.build(body, 'hull');

  const fenders = new THREE.Group();
  fenders.name = 'fenders';
  k.fenders.build(fenders, 'fender');
  body.add(fenders);

  const covers = [];
  k.covers.forEach((ck) => {
    const g = new THREE.Group();
    g.name = 'cover-jib';
    ck.build(g, 'cover-jib');
    body.add(g);
    covers.push(g);
  });
  for (const g of k.groups) body.add(g);
  for (const o of res.extra || []) body.add(o);

  const sailMeshes = [];
  for (const r of res.rigs || []) sailMeshes.push(...addSails(body, r));

  // Klampen für die Festmacher
  const h0 = k.hulls.find((h) => Math.abs(h.z0) < 0.01) || k.hulls[0];
  const bowCleat = new THREE.Object3D();
  bowCleat.name = 'cleat-bow';
  const sternCleat = new THREE.Object3D();
  sternCleat.name = 'cleat-stern';
  if (h0) {
    const bx = h0.bowX - Math.min(0.8, h0.L * 0.07), sx = h0.sternX + 0.4;
    bowCleat.position.set(bx, h0.yAt(bx) + 0.05, 0);
    sternCleat.position.set(sx, h0.yAt(sx) + 0.05, 0);
  }
  body.add(bowCleat, sternCleat);

  const bb = new THREE.Box3().setFromObject(body);
  const iconHeight = Math.min(bb.max.y, m.airDraft > 8 ? 4.5 : m.airDraft) + 0.8;
  const anim = {
    spin: (res.anim && res.anim.spin) || [],
    blink: (res.anim && res.anim.blink) || [],
    hasSails: sailMeshes.length > 0,
    phase: hashPhase(m.id + ':' + palette),
  };
  group.userData = {
    id: m.id, modelId: m.id, size: 'L', length: m.length, beam: m.beam, draft: m.draft,
    airDraft: m.airDraft, mooring: m.mooring, iconHeight, anim,
    boat: { size: 'L', length: m.length, beam: m.beam, draft: m.draft, kind: m.id === 'L2-3' ? 'motor' : KIND[m.typeId] },
  };
  if (id != null) group.userData.pick = { type: 'boat', id };
  setSails(group, sails === true || sails === 'up');
  if (anim.spin.length || anim.blink.length) LIVE.add(new WeakRef(group));
  return group;
}

// Segel setzen (on = true) oder bergen. Gestaucht wird wie im Animationsmodul:
// Großsegel auf y, Vorsegel auf x (userData.furl), Persenning nur bei geborgenen Segeln.
export function setSails(group, on) {
  group.traverse((o) => {
    if (o.name.startsWith('sail-')) {
      const ax = o.userData.furl || 'y';
      o.scale.set(1, 1, 1);
      if (!on) o.scale[ax] = SAIL_SCALE_OFF;
    } else if (o.name.startsWith('cover-') && !o.isMesh) {
      o.visible = !on;
    } else if (o.name.startsWith('cover-') && o.parent && o.parent.name.startsWith('boom')) {
      o.visible = !on;
    }
  });
  group.userData.sailsUp = !!on && !!(group.userData.anim && group.userData.anim.hasSails);
}

// Kleine Eigenbewegungen, die nur L-Modelle haben: Windgenerator, Blaulicht.
// Schaukeln, Radar, Flaggen und Segel macht das gemeinsame Animationsmodul.
// standalone = true dreht auch das Radar (für die Vorschauseite ohne Animationsmodul).
export function tickBoat(group, time, standalone = false) {
  const a = group.userData.anim;
  if (!a) return;
  for (const s of a.spin) {
    if (s.obj.name === 'radar' && !standalone) continue;
    s.obj.rotation[s.axis] = time * s.speed + a.phase;
  }
  for (let i = 0; i < a.blink.length; i++) a.blink[i].visible = Math.floor(time * 3 + i * 0.5) % 2 === 0;
}

const LIVE = new Set();

// Einhängen ins Spiel (main.js ruft init(game) auf).
export function init(game) {
  // Gleiche Anmeldung wie bei den M-Booten: game.boatTypes.<Größe>
  game.boatTypes = game.boatTypes ?? {};
  game.boatTypes.L = { size: 'L', TYPES, MODELS, buildBoat, setSails };
  game.emit?.('boats:registered', { size: 'L' });
  let t = 0;
  game.onTick((dt) => {
    t += dt;
    for (const ref of LIVE) {
      const g = ref.deref();
      if (!g) { LIVE.delete(ref); continue; }
      if (g.parent) tickBoat(g, t);
    }
  });
}

export { MODELS, TYPES };

function hashPhase(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return ((h >>> 0) % 1000) / 1000 * Math.PI * 2;
}
