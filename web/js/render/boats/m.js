// 3D-Modelle der Größe M im Flat-Vector-Stil (Three.js).
//
// Schnittstelle (gleich für S, M, L, XL):
//   buildBoat(model, { palette = 0, sails = false, id })  -> THREE.Group (id = Boot-id aus sim.js für game.pick)
//   setSails(group, on)                                 Segel setzen (true) oder bergen (false)
//   init(game)                                          meldet die M-Boote unter game.boatTypes.M an
//
// Konvention: 1 Einheit = 1 m, Y oben, Bug +X, Steuerbord +Z, Ursprung Wasserlinie mittschiffs.
// Im Hafen: group.rotation.y = richtung des Liegeplatzes (Grad in rad).
//
// Alle festen Teile sind pro Farbe zu einem Mesh zusammengefasst (Kind "body"), damit auch
// 90+ Boote auf dem Handy flüssig laufen. Takelage und Reling sind eine LineSegments.
// Bewegliche Teile sind eigene, benannte Kinder für web/js/render/boat-anim.js:
//   boom-main, boom-mizzen   Baum, Drehpunkt am Mast (schwenkt nach Lee)
//     sail-main, sail-mizzen   Großsegel als Kind des Baums, Ursprung am Fuß (Bergen = y stauchen)
//     cover-main, cover-mizzen Persenning auf dem Baum (sichtbar, wenn die Segel geborgen sind)
//   sail-jib                 Vorsegel, Ursprung am Hals, userData.furl = 'x' (Rollfock)
//   sail-top                 Toppsegel (Gaffelkutter)
//   fender                   Fender beider Seiten (nur beim Anlegen und Liegen sichtbar)
//   flag                     Wimpel oder Heckflagge, Ursprung am Stock (flattert)
//   radar                    Radarbalken, Ursprung auf der Drehachse
//   cleat-bow, cleat-stern   leere Punkte für die Festmacher
// Schaukeln, Krängen und Fahrt macht boat-anim.js für alle Größen gleich, nicht dieses Modul.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MODELS, TYPES } from '../../data/boats/m.js';

// ------------------------------------------------------------------ Materialien

const materialCache = new Map();

function material(color, { transparent = false, opacity = 1 } = {}) {
  const key = `${color}|${opacity}`;
  let m = materialCache.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({
      color,
      flatShading: true,
      side: THREE.DoubleSide,
      transparent,
      opacity,
    });
    materialCache.set(key, m);
  }
  return m;
}

const lineMaterial = new THREE.LineBasicMaterial({ color: '#3d4450' });

// ------------------------------------------------------------------ Geometrie-Sammler

// Sammelt Dreiecke und fertige Geometrien pro Farbe und baut daraus am Ende je Farbe ein Mesh.
class Parts {
  constructor() {
    this.tris = new Map(); // Farbe -> number[] (x,y,z je Ecke)
    this.geoms = new Map(); // Farbe -> BufferGeometry[]
    this.lines = []; // number[] Paare von Punkten
  }

  tri(color, a, b, c) {
    let arr = this.tris.get(color);
    if (!arr) this.tris.set(color, (arr = []));
    arr.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  }

  quad(color, a, b, c, d) {
    this.tri(color, a, b, c);
    this.tri(color, a, c, d);
  }

  // Vieleck als Fächer um den Schwerpunkt (für Spiegel, Deckel, Segel)
  poly(color, pts) {
    if (pts.length < 3) return;
    const c = [0, 0, 0];
    for (const p of pts) { c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; }
    c[0] /= pts.length; c[1] /= pts.length; c[2] /= pts.length;
    for (let i = 0; i < pts.length; i++) this.tri(color, c, pts[i], pts[(i + 1) % pts.length]);
  }

  geom(color, g) {
    let ng = g.index ? g.toNonIndexed() : g;
    for (const name of Object.keys(ng.attributes)) {
      if (name !== 'position') ng.deleteAttribute(name);
    }
    let arr = this.geoms.get(color);
    if (!arr) this.geoms.set(color, (arr = []));
    arr.push(ng);
  }

  line(a, b) {
    this.lines.push(a[0], a[1], a[2], b[0], b[1], b[2]);
  }

  // Quader, zentriert in (x,y,z), optional um Y gedreht
  box(color, x, y, z, lx, ly, lz, rotY = 0) {
    const g = new THREE.BoxGeometry(lx, ly, lz);
    if (rotY) g.rotateY(rotY);
    g.translate(x, y, z);
    this.geom(color, g);
  }

  // Zylinder von Punkt a nach Punkt b
  rod(color, a, b, r, seg = 5) {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const len = va.distanceTo(vb);
    if (len < 1e-4) return;
    const g = new THREE.CylinderGeometry(r, r, len, seg, 1, false);
    const dir = vb.clone().sub(va).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    g.applyQuaternion(q);
    const mid = va.add(vb).multiplyScalar(0.5);
    g.translate(mid.x, mid.y, mid.z);
    this.geom(color, g);
  }

  // Liegender Zylinder entlang X (Pontons, Reusen, Kisten mit runden Enden)
  cylX(color, x, y, z, r, len, seg = 7) {
    const g = new THREE.CylinderGeometry(r, r, len, seg, 1, false);
    g.rotateZ(Math.PI / 2);
    g.translate(x, y, z);
    this.geom(color, g);
  }

  toObject3D(name) {
    const group = new THREE.Group();
    group.name = name;
    const colors = new Set([...this.tris.keys(), ...this.geoms.keys()]);
    for (const color of colors) {
      const list = [...(this.geoms.get(color) ?? [])];
      const t = this.tris.get(color);
      if (t && t.length) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(t, 3));
        list.push(g);
      }
      if (!list.length) continue;
      const merged = list.length === 1 ? list[0] : mergeGeometries(list, false);
      merged.computeVertexNormals();
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, material(color));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    if (this.lines.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.lines, 3));
      const ls = new THREE.LineSegments(g, lineMaterial);
      ls.name = 'rigging';
      group.add(ls);
    }
    return group;
  }
}

// ------------------------------------------------------------------ Rumpf

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (t) => Math.max(0, Math.min(1, t));

// Halbe Breite (Anteil 0..1) entlang der Länge, t = 0 Heck, t = 1 Bug
function planform(t, h) {
  const sw = h.sternWidth ?? 0.7;
  const bw = h.bowWidth ?? 0;
  const midA = 0.32;
  const midB = 0.52;
  if (t < midA) {
    const u = t / midA;
    const e = h.sternFullness ?? 0.6;
    return sw + (1 - sw) * Math.pow(Math.sin((u * Math.PI) / 2), e);
  }
  if (t <= midB) return 1;
  const u = (t - midB) / (1 - midB);
  const e = h.fullness ?? 1;
  return bw + (1 - bw) * Math.pow(Math.cos((u * Math.PI) / 2), e);
}

const BOTTOM = { flach: 0.82, v: 0.45, rund: 0.6 };

// Berechnet Spanten (Querschnitte) des Rumpfes
function hullStations(h, L, B) {
  const N = 18;
  const st = [];
  const bowOver = (h.bowOver ?? 0.06) * L;
  const sternOver = (h.sternOver ?? 0.02) * L;
  const xb = L / 2 - bowOver;
  const xs = -L / 2 + sternOver;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = -L / 2 + t * L;
    const w = (B / 2) * planform(t, h);
    const ub = Math.max(0, (t - 0.5) / 0.5);
    const us = Math.max(0, (0.5 - t) / 0.5);
    const yd = h.freeboard + (h.sheerBow ?? 0.15) * ub * ub + (h.sheerStern ?? 0.04) * us * us;
    let yk;
    if (x > xb + 1e-6) yk = lerp(0, yd * 0.55, (x - xb) / bowOver);
    else if (x < xs - 1e-6) yk = lerp(0, yd * 0.45, (xs - x) / sternOver);
    else {
      const tc = (x - (xs + xb) / 2) / ((xb - xs) / 2);
      yk = -h.depth * (1 - Math.pow(Math.min(1, Math.abs(tc)), h.keelPow ?? 4));
    }
    // offenes Heck (Sportboot): Rumpf endet senkrecht
    if (h.openStern && i === 0) yk = Math.min(yk, -h.depth * 0.5);
    st.push({ x, w, yd, yk });
  }
  return st;
}

// Profilpunkte einer Rumpfseite von Deckskante bis Kiel, z >= 0 (Steuerbord)
function sectionProfile(s, h) {
  const { w, yd, yk } = s;
  const m = yk < 0 ? yd / (yd - yk) : 0.5;
  const ym = lerp(yd, yk, m);
  const yb = lerp(yd, yk, m + (1 - m) * 0.65);
  const flare = h.flare ?? 0.96;
  const bf = BOTTOM[h.bottom] ?? 0.6;
  const top = [[w, yd]];
  if (h.build === 'klinker') {
    // Plankengänge: jede Planke steht unten etwas über
    const planks = 4;
    for (let k = 1; k < planks; k++) {
      const f = k / planks;
      const y = lerp(yd, ym, f);
      const ww = lerp(w, w * flare, f);
      top.push([ww + 0.035 * Math.min(1, w * 3), y + 0.012]);
      top.push([ww, y]);
    }
  }
  top.push([w * flare, ym]);
  const under = [[w * bf, yb], [0, yk]];
  return { top, under };
}

function buildHull(p, h, L, B, pal) {
  const st = hullStations(h, L, B);
  const profs = st.map((s) => sectionProfile(s, h));
  const hullC = pal.hull;
  const underC = pal.under;
  const deckC = pal.deck;

  for (let i = 0; i < st.length - 1; i++) {
    const a = st[i], b = st[i + 1];
    const pa = profs[i], pb = profs[i + 1];
    const ra = [...pa.top, ...pa.under];
    const rb = [...pb.top, ...pb.under];
    const nTop = pa.top.length;
    for (let j = 0; j < ra.length - 1; j++) {
      const color = j < nTop - 1 ? hullC : underC;
      for (const sgn of [1, -1]) {
        p.quad(color,
          [a.x, ra[j][1], sgn * ra[j][0]],
          [b.x, rb[j][1], sgn * rb[j][0]],
          [b.x, rb[j + 1][1], sgn * rb[j + 1][0]],
          [a.x, ra[j + 1][1], sgn * ra[j + 1][0]]);
      }
    }
    // Deck
    if (!h.open) {
      p.quad(deckC, [a.x, a.yd, a.w], [b.x, b.yd, b.w], [b.x, b.yd, -b.w], [a.x, a.yd, -a.w]);
    }
  }

  // Spiegel (Heck) und stumpfer Bug als Deckel
  const cap = (i, color) => {
    const s = st[i];
    if (s.w < 0.03) return;
    const pr = profs[i];
    const ring = [...pr.top, ...pr.under];
    const pts = [];
    for (const q of ring) pts.push([s.x, q[1], q[0]]);
    for (let k = ring.length - 2; k >= 0; k--) pts.push([s.x, ring[k][1], -ring[k][0]]);
    p.poly(color, pts);
  };
  cap(0, hullC);
  cap(st.length - 1, hullC);

  // Offener Rumpf: Innenboden und Dollbord
  if (h.open) {
    for (let i = 0; i < st.length - 1; i++) {
      const a = st[i], b = st[i + 1];
      const fa = a.yd * 0.25, fb = b.yd * 0.25;
      p.quad(deckC, [a.x, fa, a.w * 0.85], [b.x, fb, b.w * 0.85], [b.x, fb, -b.w * 0.85], [a.x, fa, -a.w * 0.85]);
      for (const sgn of [1, -1]) {
        // Innenwand
        p.quad(pal.accent, [a.x, a.yd, sgn * a.w * 0.97], [b.x, b.yd, sgn * b.w * 0.97], [b.x, fb, sgn * b.w * 0.85], [a.x, fa, sgn * a.w * 0.85]);
        // Dollbord als Leiste
        p.quad(pal.trim, [a.x, a.yd + 0.04, sgn * a.w * 1.01], [b.x, b.yd + 0.04, sgn * b.w * 1.01], [b.x, b.yd - 0.03, sgn * b.w * 1.01], [a.x, a.yd - 0.03, sgn * a.w * 1.01]);
      }
    }
  }

  // Schanzkleid (Fischkutter)
  if (h.bulwark) {
    const hb = h.bulwark;
    for (let i = 0; i < st.length - 1; i++) {
      const a = st[i], b = st[i + 1];
      for (const sgn of [1, -1]) {
        p.quad(hullC, [a.x, a.yd, sgn * a.w], [b.x, b.yd, sgn * b.w], [b.x, b.yd + hb, sgn * b.w], [a.x, a.yd + hb, sgn * a.w]);
        p.quad(pal.trim, [a.x, a.yd + hb, sgn * a.w * 1.01], [b.x, b.yd + hb, sgn * b.w * 1.01], [b.x, b.yd + hb - 0.06, sgn * b.w * 1.01], [a.x, a.yd + hb - 0.06, sgn * a.w * 1.01]);
      }
    }
    const s0 = st[0];
    if (s0.w > 0.03) p.quad(hullC, [s0.x, s0.yd, s0.w], [s0.x, s0.yd, -s0.w], [s0.x, s0.yd + hb, -s0.w], [s0.x, s0.yd + hb, s0.w]);
  }

  // Kiel
  const dmax = h.draftModel;
  if (h.keel === 'flosse' && dmax > h.depth + 0.1) {
    const kx = 0.02 * L, kl = 0.12 * L;
    const y0 = -h.depth * 0.9;
    p.quad(underC, [kx - kl / 2, y0, 0.06], [kx + kl / 2, y0, 0.06], [kx + kl * 0.25, -dmax, 0.04], [kx - kl * 0.45, -dmax, 0.04]);
    p.quad(underC, [kx - kl / 2, y0, -0.06], [kx + kl / 2, y0, -0.06], [kx + kl * 0.25, -dmax, -0.04], [kx - kl * 0.45, -dmax, -0.04]);
    p.box(underC, kx - kl * 0.1, -dmax + 0.08, 0, kl * 0.9, 0.16, 0.22);
  } else if (h.keel === 'lang' && dmax > h.depth + 0.05) {
    const x0 = -0.32 * L, x1 = 0.22 * L;
    const pts = [];
    for (const [x, y] of [[x0, -h.depth * 0.6], [x1, -h.depth * 0.6], [x1 - 0.1 * L, -dmax], [x0 + 0.04 * L, -dmax]]) pts.push([x, y]);
    for (const sgn of [1, -1]) {
      p.quad(underC, [pts[0][0], pts[0][1], sgn * 0.08], [pts[1][0], pts[1][1], sgn * 0.08], [pts[2][0], pts[2][1], sgn * 0.06], [pts[3][0], pts[3][1], sgn * 0.06]);
    }
    p.quad(underC, [pts[3][0], pts[3][1], 0.06], [pts[2][0], pts[2][1], 0.06], [pts[2][0], pts[2][1], -0.06], [pts[3][0], pts[3][1], -0.06]);
  }

  // Ruder
  if (h.rudder === 'angehaengt') {
    const s0 = st[0];
    const x = s0.x - 0.04;
    const y1 = s0.yd + 0.05;
    const y0 = Math.min(-h.depth * 0.8, -Math.min(dmax, 1.0) * 0.8);
    p.quad(pal.accent, [x, y1, 0.03], [x - 0.35, y1 - 0.2, 0.03], [x - 0.45, y0, 0.03], [x, y0, 0.03]);
    p.quad(pal.accent, [x, y1, -0.03], [x - 0.35, y1 - 0.2, -0.03], [x - 0.45, y0, -0.03], [x, y0, -0.03]);
    p.rod(pal.accent, [x - 0.1, y1, 0], [x + 0.9, y1 + 0.18, 0], 0.025); // Pinne
  } else if (h.rudder === 'spaten') {
    const x = -0.36 * L;
    p.box(underC, x, -h.depth - 0.35, 0, 0.35, 0.7, 0.05);
  }

  return st;
}

// Interpolierte Deckshöhe und halbe Breite an Stelle x
function deckAt(st, x) {
  if (x <= st[0].x) return { y: st[0].yd, w: st[0].w };
  for (let i = 0; i < st.length - 1; i++) {
    const a = st[i], b = st[i + 1];
    if (x <= b.x) {
      const t = (x - a.x) / (b.x - a.x);
      return { y: lerp(a.yd, b.yd, t), w: lerp(a.w, b.w, t) };
    }
  }
  const l = st[st.length - 1];
  return { y: l.yd, w: l.w };
}

// ------------------------------------------------------------------ Pontons (Hausboot)

function buildPontoons(p, h, L, B, pal) {
  const r = 0.42;
  const zc = B / 2 - r;
  const yc = -h.depth + r;
  for (const z of [zc, -zc]) {
    p.cylX(pal.hull, 0, yc, z, r, L * 0.92, 8);
    // spitze Enden
    const g = new THREE.ConeGeometry(r, 0.7, 8);
    g.rotateZ(-Math.PI / 2);
    g.translate(L * 0.46 + 0.35, yc, z);
    p.geom(pal.hull, g);
  }
  // Plattform
  const yp = h.freeboard;
  p.box(pal.deck, 0, yp - 0.08, 0, L, 0.16, B);
  p.box(pal.trim, 0, yp - 0.22, 0, L * 0.96, 0.12, B * 0.96);
  // Stützen
  for (const x of [-L * 0.35, 0, L * 0.35]) for (const z of [zc, -zc]) p.box(pal.trim, x, (yc + yp) / 2, z, 0.12, yp - yc, 0.12);
  const st = [];
  for (let i = 0; i <= 18; i++) {
    const x = -L / 2 + (i / 18) * L;
    st.push({ x, w: B / 2, yd: yp, yk: -h.depth });
  }
  return st;
}

// ------------------------------------------------------------------ Aufbauten

// Kajüte, Steuerhaus, Hardtop: Prisma mit eingezogenen Seiten und geneigter Front
function cabinPoint(c, st, L, s, pRel, side, grow = 0) {
  const x0 = c.x0 * L, x1 = c.x1 * L;
  const xa = x0 + (c.rakeAft ?? 0) * L * s;
  const xf = x1 - (c.rakeFore ?? 0) * L * s;
  const x = lerp(xa, xf, pRel) + (pRel >= 1 ? grow : pRel <= 0 ? -grow : 0);
  const baseY = c._baseY;
  const hwBase = c.hw * c._B;
  const hwS = hwBase - (c.inset ?? 0) * s * c._B;
  const hw = lerp(hwS, hwS * (1 - (c.taper ?? 0)), pRel) + grow;
  return [x, baseY + c.h * s, side * hw];
}

function buildCabin(p, c, st, L, B, pal) {
  c._B = B;
  const x0 = c.x0 * L, x1 = c.x1 * L;
  let base = -Infinity;
  for (let k = 0; k <= 4; k++) base = Math.max(base, deckAt(st, lerp(x0, x1, k / 4)).y);
  c._baseY = base - 0.03;
  const color = c.color ? pal[c.color] : pal.cabin;
  const P = (s, pr, side, g) => cabinPoint(c, st, L, s, pr, side, g);

  // Seiten, Front, Rückwand
  p.quad(color, P(0, 0, 1), P(0, 1, 1), P(1, 1, 1), P(1, 0, 1));
  p.quad(color, P(0, 0, -1), P(0, 1, -1), P(1, 1, -1), P(1, 0, -1));
  p.quad(color, P(0, 1, 1), P(0, 1, -1), P(1, 1, -1), P(1, 1, 1));
  p.quad(color, P(0, 0, 1), P(0, 0, -1), P(1, 0, -1), P(1, 0, 1));
  // Dach
  const roofC = c.roof === 'trim' ? pal.trim : c.roof === 'deck' ? pal.deck : color;
  p.quad(roofC, P(1, 0, 1), P(1, 1, 1), P(1, 1, -1), P(1, 0, -1));

  // Fenster
  const w = c.windows;
  if (w) {
    const g = 0.015;
    if (w.kind === 'band') {
      const a = w.from, b = w.to;
      for (const side of [1, -1]) p.quad(pal.fenster ?? '#2c3a4f', P(a, 0.06, side, g), P(a, 0.94, side, g), P(b, 0.94, side, g), P(b, 0.06, side, g));
      // Frontscheibe und Heckfenster
      p.quad('#2c3a4f', P(a, 1, 0.9, g), P(a, 1, -0.9, g), P(b, 1, -0.9, g), P(b, 1, 0.9, g));
      p.quad('#2c3a4f', P(a, 0, 0.7, g), P(a, 0, -0.7, g), P(b, 0, -0.7, g), P(b, 0, 0.7, g));
    } else if (w.kind === 'luken') {
      const n = w.count ?? 2;
      for (let k = 0; k < n; k++) {
        const pa = (k + 0.25) / n, pb = (k + 0.75) / n;
        for (const side of [1, -1]) p.quad('#2c3a4f', P(w.from, pa, side, g), P(w.from, pb, side, g), P(w.to, pb, side, g), P(w.to, pa, side, g));
      }
    }
  }

  // Tür (Hausboot)
  if (c.door) {
    p.quad(pal.trim, P(0.05, 0, 0.25, 0.015), P(0.05, 0, -0.25, 0.015), P(0.85, 0, -0.25, 0.015), P(0.85, 0, 0.25, 0.015));
    p.quad(pal.trim, P(0.05, 1, 0.25, 0.015), P(0.05, 1, -0.25, 0.015), P(0.85, 1, -0.25, 0.015), P(0.85, 1, 0.25, 0.015));
  }

  // Hardtop: Dach steht über, dünne Platte
  if (c.hardtop) {
    const top = c._baseY + c.h;
    const xa = x0 - 0.06 * L, xf = x1 - (c.rakeFore ?? 0) * L + 0.02 * L;
    const hw = (c.hw - (c.inset ?? 0)) * B + 0.05;
    p.box(pal.cabin, (xa + xf) / 2, top + 0.04, 0, xf - xa, 0.08, hw * 2);
    // Stützen hinten
    for (const z of [hw - 0.08, -hw + 0.08]) p.rod(pal.trim, [xa + 0.08, top, z], [xa + 0.08, c._baseY, z], 0.035);
  }
  return { top: c._baseY + c.h, x0, x1 };
}

// ------------------------------------------------------------------ Rigg

const MAST_COLORS = { alu: '#c9ccd0', holz: '#b07d4f', schwarz: '#2b2d31' };

function buildRig(p, named, r, st, L, pal) {
  if (!r || r.kind === 'keins') return null;
  const mastC = MAST_COLORS[r.mast] ?? MAST_COLORS.alu;
  const sailC = r.sailColor ?? '#fbfaf6';
  const bow = st[st.length - 1];
  const stern = st[0];
  const masts = [{ x: r.mastX * L, h: r.height, main: true, tag: 'main' }];
  if (r.kind === 'zweimast') masts.push({ x: r.mast2X * L, h: r.height2, main: false, tag: 'mizzen' });
  const gaff = r.kind === 'gaffel' || r.gaff;

  // Bugspriet bestimmt, wo das Vorstag endet
  let tackX = bow.x;
  let tackY = bow.yd;
  if (r._bowsprit) {
    tackX = bow.x + r._bowsprit;
    tackY = bow.yd + 0.15;
  }

  let topY = 0;
  masts.forEach((m, idx) => {
    const d = deckAt(st, m.x);
    const y0 = d.y;
    const yTop = m.h; // Mastspitze über Wasser
    topY = Math.max(topY, yTop);
    p.rod(mastC, [m.x, y0 - 0.02, 0], [m.x, yTop, 0], 0.06, 6);
    if (r.topmast && m.main) p.rod(mastC, [m.x, yTop - 0.4, 0], [m.x, yTop + r.topmast, 0], 0.035, 5);

    // Wanten und Stage
    const wd = deckAt(st, m.x - 0.25);
    p.line([m.x, yTop * 0.97, 0], [m.x - 0.25, wd.y, wd.w * 0.95]);
    p.line([m.x, yTop * 0.97, 0], [m.x - 0.25, wd.y, -wd.w * 0.95]);
    if (idx === 0) {
      p.line([m.x, yTop * (gaff ? 0.92 : 0.97), 0], [tackX, tackY, 0]); // Vorstag
      if (!gaff) p.line([m.x, yTop, 0], [stern.x + 0.05, stern.yd + 0.05, 0]); // Achterstag
    }

    // Baum als eigene Gruppe, Drehpunkt am Mast (Animation schwenkt sie nach Lee).
    // Großsegel und Persenning hängen am Baum und schwenken mit.
    const boomLen = (m.main ? r.boom : r.boom * 0.85) * L;
    const by = y0 + (r.boomY ?? 0.9);
    const pivot = [m.x, by, 0];
    const boom = new Parts();
    const boomEnd = [m.x - boomLen, by + 0.15, 0];
    boom.rod(mastC, pivot, boomEnd, 0.045, 5);

    // Persenning (geborgenes Großsegel) auf dem Baum, bei Gaffel liegt die Gaffel obenauf
    const cover = new Parts();
    const coverLen = boomLen * 0.92;
    const cg = new THREE.CylinderGeometry(0.11, 0.17, coverLen, 6);
    cg.rotateZ(Math.PI / 2 + Math.atan2(0.15, boomLen));
    cg.translate(m.x - coverLen / 2 - 0.05, by + 0.2, 0);
    cover.geom(pal.cover, cg);
    if (gaff) cover.rod(mastC, [m.x, by + 0.35, 0], [m.x - coverLen * 0.85, by + 0.42, 0], 0.035);

    // Gesetztes Großsegel, Ursprung am Fuß (auf dem Baum), damit Stauchen in y das Segel birgt
    const main = new Parts();
    const mainTop = gaff ? y0 + (yTop - y0) * 0.78 : yTop * 0.96;
    if (gaff) {
      const peak = [m.x - boomLen * 0.7, yTop + 0.2, 0];
      main.rod(mastC, [m.x, mainTop, 0], peak, 0.03);
      main.poly(sailC, [[m.x - 0.05, by + 0.05, 0], [m.x - 0.05, mainTop, 0], peak, [boomEnd[0] + 0.1, boomEnd[1] + 0.05, 0]]);
      if (r.topmast && m.main) {
        const top = new Parts();
        top.poly(sailC, [[m.x - 0.05, mainTop + 0.4, 0], [m.x - 0.05, yTop + r.topmast * 0.95, 0], [peak[0] + 0.2, peak[1] - 0.15, 0]]);
        named.push({ parts: top, name: 'sail-top', origin: [m.x, mainTop + 0.4, 0] });
      }
    } else {
      main.poly(sailC, [[m.x - 0.05, by + 0.05, 0], [m.x - 0.05, mainTop, 0], [boomEnd[0] + 0.1, boomEnd[1] + 0.05, 0]]);
    }
    named.push({
      parts: boom, name: `boom-${m.tag}`, origin: pivot,
      children: [
        { parts: cover, name: `cover-${m.tag}`, origin: pivot },
        { parts: main, name: `sail-${m.tag}`, origin: pivot },
      ],
    });

    // Vorsegel nur vor dem vorderen Mast, Ursprung am Hals (vorn unten)
    if (idx === 0) {
      const jib = new Parts();
      const jh = gaff ? yTop * 0.88 : yTop * (r.jib ?? 0.82);
      const clew = [m.x - 0.15 * L * (r.jib ?? 0.82), y0 + 0.5, 0];
      jib.poly(sailC, [[tackX - 0.05, tackY + 0.05, 0], [m.x + 0.05, jh, 0], clew]);
      named.push({ parts: jib, name: 'sail-jib', origin: [tackX, tackY, 0], furl: 'x' });
    }
  });

  return { topY: topY + (r.topmast ?? 0) };
}

// ------------------------------------------------------------------ Anbauten

function buildExtras(p, named, extras, st, L, B, pal, info) {
  const fenders = new Parts();
  const bow = st[st.length - 1];
  const stern = st[0];
  const mid = deckAt(st, 0);
  const dark = '#3a3f47';
  const metal = '#c9ccd0';

  for (const e of extras ?? []) {
    switch (e.kind) {
      case 'zierstreifen': {
        const offs = e.double ? [0.12, 0.22] : [0.14];
        for (const off of offs) {
          for (let i = 0; i < st.length - 1; i++) {
            const a = st[i], b = st[i + 1];
            for (const sgn of [1, -1]) {
              const ya = a.yd - off, yb = b.yd - off;
              p.quad(pal.trim, [a.x, ya, sgn * (a.w * 0.995 + 0.006)], [b.x, yb, sgn * (b.w * 0.995 + 0.006)], [b.x, yb - 0.05, sgn * (b.w * 0.99 + 0.006)], [a.x, ya - 0.05, sgn * (a.w * 0.99 + 0.006)]);
            }
          }
        }
        break;
      }
      case 'scheuerleiste': {
        const t = e.thick ? 0.12 : 0.06;
        const o = e.thick ? 0.07 : 0.03;
        for (let i = 0; i < st.length - 1; i++) {
          const a = st[i], b = st[i + 1];
          for (const sgn of [1, -1]) {
            p.quad(e.thick ? pal.trim : pal.accent,
              [a.x, a.yd + 0.01, sgn * (a.w + o)], [b.x, b.yd + 0.01, sgn * (b.w + o)],
              [b.x, b.yd - t, sgn * (b.w + o)], [a.x, a.yd - t, sgn * (a.w + o)]);
            p.quad(e.thick ? pal.trim : pal.accent,
              [a.x, a.yd + 0.01, sgn * a.w], [b.x, b.yd + 0.01, sgn * b.w],
              [b.x, b.yd + 0.01, sgn * (b.w + o)], [a.x, a.yd + 0.01, sgn * (a.w + o)]);
          }
        }
        break;
      }
      case 'fender': {
        const n = e.count ?? 2;
        for (let k = 0; k < n; k++) {
          const x = lerp(-0.25, 0.15, n === 1 ? 0.5 : k / (n - 1)) * L;
          const d = deckAt(st, x);
          for (const sgn of [1, -1]) fenders.rod('#f4f1ea', [x, d.y - 0.25, sgn * (d.w + 0.1)], [x, d.y - 0.65, sgn * (d.w + 0.1)], 0.1, 6);
        }
        break;
      }
      case 'reifenfender': {
        const n = e.count ?? 3;
        for (let k = 0; k < n; k++) {
          const x = lerp(-0.3, 0.25, n === 1 ? 0.5 : k / (n - 1)) * L;
          const d = deckAt(st, x);
          const g = new THREE.TorusGeometry(0.22, 0.08, 4, 8);
          g.translate(x, d.y - 0.3, d.w + 0.08);
          p.geom('#26282c', g);
          const g2 = g.clone();
          g2.translate(0, 0, -2 * (d.w + 0.08));
          p.geom('#26282c', g2);
        }
        break;
      }
      case 'aussenborder': {
        const xs = stern.x;
        const zs = e.twin ? [0.35, -0.35] : [0];
        for (const z of zs) {
          if (e.inboard) {
            // Z-Antrieb unter der Badeplattform: nur der Fuß ist zu sehen
            p.box(dark, xs - 0.25, -0.3, z, 0.25, 0.5, 0.1);
          } else {
            p.box(dark, xs - 0.22, stern.yd + 0.15, z, 0.45, 0.45, 0.35);
            p.box(dark, xs - 0.18, stern.yd - 0.4, z, 0.14, 0.9, 0.1);
          }
        }
        break;
      }
      case 'badeplattform': {
        const w = stern.w * 0.95;
        p.box(pal.accent, stern.x - 0.35, 0.22, 0, 0.7, 0.07, w * 2);
        p.box(pal.hull, stern.x - 0.33, 0.12, 0, 0.66, 0.12, w * 2);
        p.rod(metal, [stern.x - 0.6, 0.25, w * 0.6], [stern.x - 0.6, -0.3, w * 0.6], 0.02); // Badeleiter
        break;
      }
      case 'bugkorb': {
        const x0 = bow.x - 0.6;
        const d = deckAt(st, x0);
        const h = 0.6;
        const tip = [bow.x - 0.05, bow.yd + h, 0];
        p.line([x0, d.y + h, d.w * 0.9], tip);
        p.line([x0, d.y + h, -d.w * 0.9], tip);
        p.line([x0, d.y, d.w * 0.9], [x0, d.y + h, d.w * 0.9]);
        p.line([x0, d.y, -d.w * 0.9], [x0, d.y + h, -d.w * 0.9]);
        p.line([bow.x - 0.05, bow.yd, 0], tip);
        break;
      }
      case 'heckkorb': {
        const h = 0.6;
        const x0 = stern.x + 0.5;
        const d = deckAt(st, x0);
        p.line([stern.x + 0.05, stern.yd + h, stern.w * 0.85], [stern.x + 0.05, stern.yd + h, -stern.w * 0.85]);
        for (const s of [1, -1]) {
          p.line([stern.x + 0.05, stern.yd, s * stern.w * 0.85], [stern.x + 0.05, stern.yd + h, s * stern.w * 0.85]);
          p.line([stern.x + 0.05, stern.yd + h, s * stern.w * 0.85], [x0, d.y + h, s * d.w * 0.9]);
        }
        break;
      }
      case 'reling': {
        const h = e.low ? 0.3 : e.full ? 0.9 : 0.6;
        const yOff = (e.platform ? 0 : 0);
        let i0 = 1, i1 = st.length - 2;
        if (e.fore) i0 = Math.floor(st.length * 0.5);
        const step = 2;
        for (const sgn of [1, -1]) {
          let prev = null;
          for (let i = i0; i <= i1; i += step) {
            const s = st[i];
            const top = [s.x, s.yd + h + yOff, sgn * s.w * 0.95];
            p.line([s.x, s.yd + yOff, sgn * s.w * 0.95], top);
            if (prev) p.line(prev, top);
            if (prev && e.full) p.line([prev[0], prev[1] - h / 2, prev[2]], [top[0], top[1] - h / 2, top[2]]);
            prev = top;
          }
        }
        if (e.full || e.platform) {
          // auch quer am Heck
          const s = st[i0];
          p.line([s.x, s.yd + h, s.w * 0.95], [s.x, s.yd + h, -s.w * 0.95]);
        }
        break;
      }
      case 'gennakerbaum': {
        p.rod('#2b2d31', [bow.x - 0.5, bow.yd + 0.05, 0], [bow.x + 1.3, bow.yd + 0.12, 0], 0.035);
        break;
      }
      case 'bugspriet': {
        const len = e.length ?? 1.8;
        p.rod('#b07d4f', [bow.x - 0.8, bow.yd + 0.08, 0], [bow.x + len, bow.yd + 0.18, 0], 0.05);
        p.line([bow.x + len, bow.yd + 0.18, 0], [bow.x + 0.02, 0.1, 0]); // Wasserstag
        break;
      }
      case 'seitenschwerter': {
        for (const sgn of [1, -1]) {
          const x = 0.0;
          const d = deckAt(st, x);
          p.quad(pal.accent, [x - 0.35, d.y + 0.05, sgn * (d.w + 0.04)], [x + 0.25, d.y + 0.05, sgn * (d.w + 0.04)], [x + 0.05, d.y - 0.75, sgn * (d.w + 0.04)], [x - 0.3, d.y - 0.75, sgn * (d.w + 0.04)]);
        }
        break;
      }
      case 'amas': {
        // angeklappte Schwimmer: liegen dicht am Mittelrumpf, Träger nach oben geklappt
        const amaL = L * 0.72;
        const zr = B / 2 - 0.2;
        for (const sgn of [1, -1]) {
          const z = sgn * zr;
          p.cylX(pal.hull, 0.02 * L, 0.15, z, 0.2, amaL * 0.82, 6);
          const g1 = new THREE.ConeGeometry(0.2, amaL * 0.18, 6);
          g1.rotateZ(-Math.PI / 2);
          g1.translate(0.02 * L + amaL * 0.5, 0.15, z);
          p.geom(pal.hull, g1);
          p.box(pal.trim, 0.02 * L, 0.37, z, amaL * 0.8, 0.04, 0.2);
          for (const x of [-0.12 * L, 0.18 * L]) {
            const d = deckAt(st, x);
            p.rod(pal.deck, [x, d.y + 0.05, sgn * d.w * 0.8], [x, 0.4, z], 0.07, 5);
          }
        }
        // Netz zwischen den Trägern
        break;
      }
      case 'mast_klein': {
        const x = (e.x ?? 0) * L;
        const d = deckAt(st, x);
        const h = e.height ?? 2.6;
        const base = info.cabinTopAt(x) ?? d.y;
        p.rod(metal, [x, base, 0], [x, base + h * 0.5, 0], 0.035);
        p.box(metal, x, base + h * 0.42, 0, 0.06, 0.04, 0.7); // Saling
        p.rod(metal, [x, base + h * 0.3, 0], [x, base + h * 0.3 + 0.08, 0], 0.03);
        const radar = new Parts();
        radar.box(dark, x - 0.1, base + h * 0.3 + 0.1, 0, 0.18, 0.06, 0.7); // Radarbalken
        named.push({ parts: radar, name: 'radar', origin: [x, base + h * 0.3 + 0.1, 0] });
        info.flagAt = [x, base + h * 0.5];
        break;
      }
      case 'antenne': {
        const x = (e.x ?? 0) * L;
        const base = info.cabinTopAt(x) ?? deckAt(st, x).y;
        p.rod(metal, [x, base, 0.2], [x - 0.1, base + 1.0, 0.2], 0.015, 4);
        info.flagAt = [x, base + 0.6];
        break;
      }
      case 'windschutz': {
        const x = (e.x ?? 0) * L;
        const d = deckAt(st, x);
        for (const sgn of [1, -1]) {
          p.quad('#9fb7c4', [x, d.y, 0], [x, d.y, sgn * d.w * 0.95], [x - 0.25, d.y + 0.45, sgn * d.w * 0.9], [x - 0.2, d.y + 0.5, 0]);
        }
        break;
      }
      case 'verdeck': {
        const x0 = e.x0 * L, x1 = e.x1 * L - 0.2;
        const d0 = deckAt(st, x0), d1 = deckAt(st, x1);
        const h = 1.25;
        const w0 = d0.w * 0.92, w1 = d1.w * 0.88;
        // Persenning als flaches Dach mit schrägen Enden
        const a0 = [x0, d0.y + h * 0.8, w0], a1 = [x1, d1.y + h, w1];
        const b0 = [x0, d0.y + h * 0.8, -w0], b1 = [x1, d1.y + h, -w1];
        p.quad(pal.cover, a0, a1, b1, b0);
        p.quad(pal.cover, a0, b0, [x0 - 0.2, d0.y + 0.3, -w0], [x0 - 0.2, d0.y + 0.3, w0]);
        for (const z of [w0, -w0]) p.line([x0 - 0.2, d0.y + 0.3, z], [x0 - 0.2, d0.y, z]);
        for (const sgn of [1, -1]) {
          p.line([x0, d0.y + h * 0.8, sgn * w0], [x0, d0.y, sgn * w0]);
          p.line([x1, d1.y + h, sgn * w1], [x1, d1.y, sgn * w1]);
        }
        break;
      }
      case 'dachterrasse': {
        const c = info.cabins[0];
        if (!c) break;
        const y = c.top;
        p.box(pal.deck, (c.x0 + c.x1) / 2, y + 0.03, 0, c.x1 - c.x0 + 0.1, 0.06, B * 0.88);
        // Geländer
        const hx = (c.x1 - c.x0) / 2 + 0.03, hz = B * 0.44;
        const cx = (c.x0 + c.x1) / 2;
        const corners = [[cx - hx, hz], [cx + hx, hz], [cx + hx, -hz], [cx - hx, -hz]];
        for (let k = 0; k < 4; k++) {
          const a = corners[k], b = corners[(k + 1) % 4];
          p.line([a[0], y + 0.9, a[1]], [b[0], y + 0.9, b[1]]);
          p.line([a[0], y, a[1]], [a[0], y + 0.9, a[1]]);
        }
        // Sonnenschirm und Liegen
        p.rod(dark, [cx + hx * 0.4, y, 0.4], [cx + hx * 0.4, y + 1.7, 0.4], 0.03);
        const g = new THREE.ConeGeometry(1.0, 0.35, 8);
        g.translate(cx + hx * 0.4, y + 1.75, 0.4);
        p.geom(pal.cover, g);
        p.box(pal.accent, cx - hx * 0.4, y + 0.15, -0.5, 1.6, 0.12, 0.55);
        p.box(pal.accent, cx - hx * 0.4, y + 0.15, 0.6, 1.6, 0.12, 0.55);
        // Treppe am Heck
        p.quad(pal.trim, [c.x0 - 0.05, y, -hz + 0.1], [c.x0 - 0.05, y, -hz + 0.6], [c.x0 - 0.9, mid.y, -hz + 0.6], [c.x0 - 0.9, mid.y, -hz + 0.1]);
        info.iconBase = y + 1.9;
        break;
      }
      case 'pflanzen': {
        for (const [x, z] of [[0.36 * L, B * 0.3], [0.36 * L, -B * 0.3], [-0.36 * L, B * 0.32]]) {
          p.box(pal.trim, x, mid.y + 0.15, z, 0.35, 0.3, 0.35);
          const g = new THREE.IcosahedronGeometry(0.28, 0);
          g.translate(x, mid.y + 0.48, z);
          p.geom('#5f9e63', g);
        }
        break;
      }
      case 'duchten': {
        const n = e.count ?? 2;
        for (let k = 0; k < n; k++) {
          const x = lerp(-0.2, 0.2, n === 1 ? 0.5 : k / (n - 1)) * L;
          const d = deckAt(st, x);
          p.box(pal.accent, x, d.y - 0.15, 0, 0.25, 0.05, d.w * 1.9);
        }
        break;
      }
      case 'netzkisten': {
        const n = e.count ?? 2;
        for (let k = 0; k < n; k++) {
          const x = lerp(-0.3, 0.25, n === 1 ? 0.5 : k / (n - 1)) * L;
          const d = deckAt(st, x);
          const y = info.floorAt(x);
          p.box('#c99a6b', x, y + 0.2, (k % 2 ? 1 : -1) * d.w * 0.35, 0.6, 0.4, 0.5);
          p.box('#c86b4c', x, y + 0.42, (k % 2 ? 1 : -1) * d.w * 0.35, 0.5, 0.06, 0.4); // Netz
        }
        break;
      }
      case 'fischkoerbe': {
        const n = e.count ?? 3;
        for (let k = 0; k < n; k++) {
          const x = lerp(-0.35, -0.15, n === 1 ? 0.5 : k / (n - 1)) * L;
          const d = deckAt(st, x);
          const y = info.floorAt(x);
          const g = new THREE.CylinderGeometry(0.2, 0.15, 0.3, 7);
          g.translate(x, y + 0.15, (k - 1) * d.w * 0.4);
          p.geom('#b8925c', g);
        }
        break;
      }
      case 'stangen': {
        const n = e.count ?? 6;
        for (let k = 0; k < n; k++) {
          const z = (k / (n - 1) - 0.5) * B * 0.6;
          const y = info.floorAt(0) + 0.35 + (k % 2) * 0.06;
          p.rod('#b07d4f', [-0.25 * L, y, z], [0.5 * L + 0.8, y + 0.25, z * 0.6], 0.03, 4);
        }
        // Stützen
        for (const x of [-0.25 * L, 0.2 * L]) p.box('#b07d4f', x, info.floorAt(x) + 0.2, 0, 0.08, 0.4, B * 0.7);
        break;
      }
      case 'reusen': {
        const n = e.count ?? 3;
        for (let k = 0; k < n; k++) {
          const x = lerp(-0.15, 0.2, n === 1 ? 0.5 : k / (n - 1)) * L;
          const y = info.floorAt(x);
          const z = (k % 2 ? 0.3 : -0.3) * B * 0.5;
          // Reuse: Ringe und kegeliges Netz
          const g = new THREE.ConeGeometry(0.32, 1.4, 7, 1, true);
          g.rotateZ(Math.PI / 2);
          g.translate(x, y + 0.32, z);
          p.geom('#3c5a4f', g);
          for (let r = 0; r < 3; r++) {
            const t = new THREE.TorusGeometry(0.3 - r * 0.07, 0.025, 3, 10);
            t.rotateY(Math.PI / 2);
            t.translate(x - 0.6 + r * 0.45, y + 0.32, z);
            p.geom('#d9c27a', t);
          }
        }
        break;
      }
      case 'netzholer': {
        const x = bow.x - 0.9;
        const d = deckAt(st, x);
        const y = d.y + (info.bulwark ?? 0);
        p.box(dark, x, y + 0.1, d.w * 0.6, 0.3, 0.5, 0.3);
        const g = new THREE.CylinderGeometry(0.25, 0.25, 0.12, 10);
        g.rotateX(Math.PI / 2);
        g.translate(x, y + 0.45, d.w * 0.6 + 0.12);
        p.geom('#e0604c', g);
        p.rod(metal, [x, y + 0.45, d.w * 0.6], [x + 0.3, y + 0.5, d.w + 0.15], 0.03); // Ausleger
        break;
      }
      case 'bojen': {
        const n = e.count ?? 3;
        const flagColors = ['#e0604c', '#f2c14e', '#2e3f5c'];
        for (let k = 0; k < n; k++) {
          const x = lerp(-0.1, 0.15, n === 1 ? 0.5 : k / (n - 1)) * L;
          const d = deckAt(st, x);
          const y = d.y;
          const z = -d.w * 0.6;
          p.cylX('#f2c14e', x, y + 0.15, z + (k - 1) * 0.12, 0.13, 0.35, 6);
          // Bojenstange mit Fähnchen, schräg an Deck gelehnt
          const top = [x - 0.6, y + 2.4, z * 0.5];
          p.rod('#b07d4f', [x + 0.2, y + 0.05, z + (k - 1) * 0.12], top, 0.025, 4);
          p.poly(flagColors[k % 3], [top, [top[0], top[1] - 0.35, top[2]], [top[0] - 0.45, top[1] - 0.17, top[2]]]);
        }
        break;
      }
      case 'baenke': {
        for (const sgn of [1, -1]) {
          for (let i = 2; i < st.length - 4; i += 1) {
            const a = st[i], b = st[i + 1];
            if (info.insideCabin((a.x + b.x) / 2)) continue;
            p.quad(pal.accent, [a.x, a.yd + 0.4, sgn * a.w * 0.82], [b.x, b.yd + 0.4, sgn * b.w * 0.82], [b.x, b.yd + 0.4, sgn * b.w * 0.6], [a.x, a.yd + 0.4, sgn * a.w * 0.6]);
          }
        }
        break;
      }
      case 'angelruten': {
        const n = e.count ?? 8;
        for (let k = 0; k < n; k++) {
          const sgn = k % 2 ? 1 : -1;
          const x = lerp(-0.45, 0.35, Math.floor(k / 2) / Math.max(1, Math.floor((n - 1) / 2))) * L;
          if (info.insideCabin(x)) continue;
          const d = deckAt(st, x);
          const base = [x, d.y + 0.9, sgn * d.w * 0.95];
          const tip = [x - 0.6, d.y + 3.0, sgn * (d.w + 1.1)];
          p.line(base, tip);
          p.line([base[0], base[1] - 0.5, base[2]], base);
        }
        break;
      }
      case 'tresen': {
        // Verkaufstresen an der Steuerbordseite, mit Klappe nach außen
        const x0 = -0.35 * L, x1 = -0.05 * L;
        const d = deckAt(st, (x0 + x1) / 2);
        const y = d.y + (info.bulwark ?? 0);
        p.box('#f4f1ea', (x0 + x1) / 2, y + 0.05, d.w * 0.92, x1 - x0, 0.1, 0.5);
        p.box(pal.trim, (x0 + x1) / 2, y - 0.35, d.w * 0.75, x1 - x0, 0.8, 0.1);
        // Fisch in Eis (Farbtupfer)
        for (let k = 0; k < 4; k++) p.box(k % 2 ? '#c3d4dc' : '#e9a07a', x0 + 0.3 + k * 0.5, y + 0.14, d.w * 0.92, 0.38, 0.06, 0.3);
        info.counter = { x: (x0 + x1) / 2, y, z: d.w };
        break;
      }
      case 'markise': {
        const c = info.counter;
        if (!c) break;
        const len = 0.3 * L;
        const y = c.y + 1.4;
        const stripes = 6;
        for (let k = 0; k < stripes; k++) {
          const xa = c.x - len / 2 + (k / stripes) * len;
          const xb = c.x - len / 2 + ((k + 1) / stripes) * len;
          p.quad(k % 2 ? '#f4f1ea' : pal.cover, [xa, y, c.z * 0.5], [xb, y, c.z * 0.5], [xb, y - 0.3, c.z + 0.6], [xa, y - 0.3, c.z + 0.6]);
        }
        for (const x of [c.x - len / 2, c.x + len / 2]) p.line([x, c.y, c.z * 0.5], [x, y, c.z * 0.5]);
        break;
      }
      case 'schild': {
        const c = info.counter;
        const x = c ? c.x : 0;
        const y = (c ? c.y : mid.y) + 1.75;
        const z = c ? c.z * 0.5 : 0;
        p.box(pal.accent, x, y, z, 1.6, 0.4, 0.05);
        p.box('#2e3f5c', x, y, z + 0.03, 1.2, 0.1, 0.02); // Schriftzug als Balken
        p.rod('#3a3f47', [x - 0.6, y - 0.2, z], [x - 0.6, y - 1.1, z], 0.025);
        p.rod('#3a3f47', [x + 0.6, y - 0.2, z], [x + 0.6, y - 1.1, z], 0.025);
        info.iconBase = Math.max(info.iconBase ?? 0, y + 0.3);
        break;
      }
      case 'kuehlkisten': {
        const n = e.count ?? 3;
        for (let k = 0; k < n; k++) {
          const x = lerp(-0.42, -0.2, n === 1 ? 0.5 : k / (n - 1)) * L;
          const d = deckAt(st, x);
          p.box(k % 2 ? '#4f7cac' : '#f4f1ea', x, d.y + 0.2, -d.w * 0.45, 0.6, 0.4, 0.45);
          p.box('#d9d7d0', x, d.y + 0.42, -d.w * 0.45, 0.62, 0.05, 0.47);
        }
        break;
      }
      default:
        break;
    }
  }

  if (fenders.tris.size || fenders.geoms.size) named.push({ parts: fenders, name: 'fender', origin: [0, 0, 0] });

  // Wimpel am Masttopp oder am kleinen Mast, sonst Flagge am Heckstock
  const f = info.flagAt;
  const fx = f ? f[0] : stern.x + 0.1;
  const fy0 = f ? f[1] : stern.yd + (info.bulwark ?? 0);
  if (!f) p.rod('#b07d4f', [fx, fy0, 0], [fx, fy0 + 1.0, 0], 0.02, 4);
  const top = f ? fy0 : fy0 + 1.0;
  const flag = new Parts();
  if (f) flag.poly('#e0604c', [[fx, top, 0], [fx, top - 0.12, 0], [fx - 0.7, top - 0.06, 0]]);
  else flag.poly('#e0604c', [[fx, top, 0], [fx, top - 0.35, 0], [fx - 0.55, top - 0.35, 0], [fx - 0.55, top, 0]]);
  named.push({ parts: flag, name: 'flag', origin: [fx, top, 0] });
  info.iconBase = Math.max(info.iconBase ?? 0, top);

  // Klampen für die Festmacher (leere Punkte, die Animation spannt dort die Leinen)
  const bowCleat = deckAt(st, bow.x - 0.35);
  named.push({ empty: true, name: 'cleat-bow', origin: [bow.x - 0.35, bowCleat.y + (info.bulwark ?? 0) + 0.05, 0] });
  named.push({ empty: true, name: 'cleat-stern', origin: [stern.x + 0.25, stern.yd + (info.bulwark ?? 0) + 0.05, 0] });
}

// ------------------------------------------------------------------ öffentliche Schnittstelle

// Baut aus einem benannten Teil ein Object3D, dessen Ursprung im Drehpunkt liegt.
function namedObject(entry, parentOrigin = [0, 0, 0]) {
  const [ox, oy, oz] = entry.origin;
  const obj = entry.empty ? new THREE.Object3D() : entry.parts.toObject3D(entry.name);
  obj.name = entry.name;
  if (!entry.empty) {
    obj.traverse((o) => { if (o.geometry) o.geometry.translate(-ox, -oy, -oz); });
  }
  obj.position.set(ox - parentOrigin[0], oy - parentOrigin[1], oz - parentOrigin[2]);
  if (entry.furl) obj.userData.furl = entry.furl;
  for (const c of entry.children ?? []) obj.add(namedObject(c, entry.origin));
  return obj;
}

const KIND = { M1: 'sail', M2: 'sail', M3: 'motor', M4: 'motor' };

/**
 * Baut ein M-Boot als THREE.Group.
 * @param {object|string} model  Eintrag aus MODELS oder Kennung wie "M2-5"
 * @param {{palette?: number, sails?: boolean|'up'|'down', id?: string}} opts
 *   id: Kennung des Bootes in sim.js (z. B. 'b17'), damit game.pick es findet
 */
export function buildBoat(model, { palette = 0, sails = false, id = null } = {}) {
  if (typeof model === 'string') model = MODELS.find((m) => m.id === model);
  if (!model) throw new Error('Unbekanntes M-Modell');
  const look = model.look;
  const n = model.palettes.length;
  const pal = model.palettes[((palette % n) + n) % n];
  const L = model.length;
  const h = { ...look.hull, draftModel: model.draft };
  const hullBeam = model.beam * (h.beamScale ?? 1);

  const body = new Parts();
  const named = [];

  const st = h.kind === 'pontons' ? buildPontoons(body, h, L, model.beam, pal) : buildHull(body, h, L, hullBeam, pal);

  // Cockpit: abgesetzter Boden mit Süllrand
  if (look.cockpit && h.kind !== 'pontons') {
    const c = look.cockpit;
    const x0 = Math.max(c.x0 * L, st[0].x + 0.05);
    const x1 = c.x1 * L;
    const steps = 4;
    for (let k = 0; k < steps; k++) {
      const xa = lerp(x0, x1, k / steps), xb = lerp(x0, x1, (k + 1) / steps);
      const da = deckAt(st, xa), db = deckAt(st, xb);
      const wa = Math.min(c.hw * hullBeam, da.w * 0.8), wb = Math.min(c.hw * hullBeam, db.w * 0.8);
      body.quad(pal.accent, [xa, da.y + 0.012, wa], [xb, db.y + 0.012, wb], [xb, db.y + 0.012, -wb], [xa, da.y + 0.012, -wa]);
      for (const sgn of [1, -1]) body.quad(pal.cabin, [xa, da.y, sgn * wa], [xb, db.y, sgn * wb], [xb, db.y + 0.12, sgn * wb], [xa, da.y + 0.12, sgn * wa]);
    }
  }

  const cabinBeam = h.kind === 'pontons' ? model.beam : hullBeam;
  const cabins = (look.cabins ?? []).map((c) => buildCabin(body, { ...c }, st, L, cabinBeam, pal));

  const info = {
    cabins,
    bulwark: h.bulwark ?? 0,
    insideCabin: (x) => cabins.some((c) => x > c.x0 - 0.1 && x < c.x1 + 0.1),
    cabinTopAt: (x) => {
      const c = cabins.find((cc) => x >= cc.x0 && x <= cc.x1);
      return c ? c.top : null;
    },
    floorAt: (x) => (h.open ? deckAt(st, x).y * 0.25 : deckAt(st, x).y),
    flagAt: null,
    iconBase: 0,
  };

  const rigLook = { ...look.rig };
  const bs = (look.extras ?? []).find((e) => e.kind === 'bugspriet');
  if (bs) rigLook._bowsprit = bs.length ?? 1.8;
  const rig = buildRig(body, named, rigLook, st, L, pal);
  if (rig) info.flagAt = [rigLook.mastX * L, look.rig.height];

  buildExtras(body, named, look.extras, st, L, model.beam, pal, info);

  const group = new THREE.Group();
  group.name = model.id;
  group.add(body.toObject3D('body'));
  for (const e of named) group.add(namedObject(e));

  const maxCabin = cabins.reduce((m, c) => Math.max(m, c.top), 0);
  const maxDeck = st.reduce((m, s) => Math.max(m, s.yd), 0);
  const iconHeight = Math.max(rig ? rig.topY : 0, maxCabin, info.iconBase, maxDeck) + 0.8;

  group.userData = {
    id: model.id,
    modelId: model.id,
    size: 'M',
    length: model.length,
    beam: model.beam,
    draft: model.draft,
    airDraft: model.airDraft,
    iconHeight,
    mooring: model.mooring,
    hasSails: !!rig,
    pick: { type: 'boat', id: id ?? model.id },
    boat: { size: 'M', length: model.length, beam: model.beam, draft: model.draft, kind: KIND[model.typeId] ?? 'motor' },
    anim: {
      sails: [],
      booms: [],
      covers: [],
    },
  };
  group.traverse((o) => {
    if (o === group) return;
    if (o.name.startsWith('sail')) group.userData.anim.sails.push(o);
    else if (o.name.startsWith('boom')) group.userData.anim.booms.push(o);
    else if (o.name.startsWith('cover')) group.userData.anim.covers.push(o);
    else if (o.name === 'flag') group.userData.anim.flag = o;
    else if (o.name === 'radar') group.userData.anim.radar = o;
    else if (o.name === 'fender') group.userData.anim.fender = o;
  });

  setSails(group, sails === true || sails === 'up');
  return group;
}

/** Segel sofort setzen (true) oder bergen (false). Motorboote ignorieren das.
 *  Für den sanften Übergang sorgt boat-anim.js über die Namen sail-* und cover-*. */
export function setSails(group, on) {
  const a = group.userData.anim;
  if (!a) return;
  for (const s of a.sails) { s.visible = !!on; s.scale.set(1, 1, 1); }
  for (const c of a.covers) c.visible = !on;
  group.userData.sailsUp = !!on;
}

/** Wird von main.js beim Start aufgerufen: meldet die M-Boote an. */
export function init(game) {
  game.boatTypes = game.boatTypes ?? {};
  game.boatTypes.M = { size: 'M', TYPES, MODELS, buildBoat, setSails };
  game.emit?.('boats:registered', { size: 'M' });
}

export { MODELS, TYPES };
