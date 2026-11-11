// Gemeinsamer Baukasten für die Schiffe der Größen XL und XXL im Flat-Vector-Stil.
// Wird von web/js/render/boats/xl.js und xxl.js importiert, nicht von main.js geladen.
//
// Konvention (abgestimmt mit S, M, L und dem Animations-Thread):
//   1 Einheit = 1 m, Y nach oben, Bug zeigt nach lokal +X, Steuerbord = +Z,
//   Ursprung = Wasserlinie mittschiffs.
//
// Ein Modell ist eine THREE.Group. Feste Teile sind pro Farbe zu einem Mesh
// zusammengefasst (wenige Draw Calls, wichtig für Handys). Benannte Teile für
// Animationen bleiben eigene Objekte:
//   sail-1, sail-2 ...   gesetzte Segel, Ursprung am Fuß (Rahsegel: an der Rah, userData.furl = 'up')
//   sailsSet             Gruppe aller gesetzten Segel
//   sailsFurled          geborgene Segel und Persenninge
//   radar                dreht sich
//   crane                schwenkt
//   paddlewheel          dreht sich bei Fahrt um die Querachse
//   flag-stern           Flagge am Heck, Ursprung am Flaggenstock
//   fender               Fender beider Seiten, standardmäßig unsichtbar
//   smoke                Rauch über dem Schornstein, standardmäßig unsichtbar
//   cleat-bow, cleat-stern  leere Object3D, an denen die Festmacher beginnen

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ------------------------------------------------------------------ Materialien

const materials = new Map();
function material(color) {
  let m = materials.get(color);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color, flatShading: true, side: THREE.DoubleSide });
    materials.set(color, m);
  }
  return m;
}
const lineMaterials = new Map();
function lineMaterial(color) {
  let m = lineMaterials.get(color);
  if (!m) {
    m = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.75 });
    lineMaterials.set(color, m);
  }
  return m;
}

const RIG_COLOR = 0x4a5260;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ------------------------------------------------------------------ Baukasten

/** Sammelt Flächen pro Farbe und Takelage-Linien, baut am Ende eine Gruppe. */
export class Kit {
  constructor() {
    this.byColor = new Map();
    this.lines = [];
    this.bodyTop = 0; // höchster Punkt ohne Masten, für iconHeight
  }

  add(color, geo, { body = true } = {}) {
    let g = geo.index ? geo.toNonIndexed() : geo;
    for (const name of Object.keys(g.attributes)) if (name !== 'position') g.deleteAttribute(name);
    g.computeVertexNormals();
    if (body) {
      g.computeBoundingBox();
      this.bodyTop = Math.max(this.bodyTop, g.boundingBox.max.y);
    }
    if (!this.byColor.has(color)) this.byColor.set(color, []);
    this.byColor.get(color).push(g);
    return g;
  }

  /** Quader. y ist die Unterkante. ry dreht um die Hochachse. */
  box(c, sx, sy, sz, x, y, z, { ry = 0, body = true } = {}) {
    const g = new THREE.BoxGeometry(sx, sy, sz);
    g.translate(0, sy / 2, 0);
    if (ry) g.rotateY(ry);
    g.translate(x, y, z);
    return this.add(c, g, { body });
  }

  /** Senkrechter Zylinder oder Kegelstumpf. y ist die Unterkante. */
  cyl(c, rTop, rBot, h, x, y, z, { seg = 8, body = true } = {}) {
    const g = new THREE.CylinderGeometry(rTop, rBot, h, seg);
    g.translate(x, y + h / 2, z);
    return this.add(c, g, { body });
  }

  /** Rundholz zwischen zwei Punkten (Bugspriet, Rah, Kranausleger). */
  spar(c, a, b, r = 0.15, { seg = 5, body = false } = {}) {
    const A = V(...a), B = V(...b);
    const len = A.distanceTo(B);
    const g = new THREE.CylinderGeometry(r, r, len, seg);
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), B.clone().sub(A).normalize());
    g.applyQuaternion(q);
    g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
    return this.add(c, g, { body });
  }

  /** Ebenes Vieleck aus Punkten [x,y,z], als Fächer trianguliert (Segel, Rampen). */
  poly(c, pts, { body = false } = {}) {
    const pos = [];
    for (let i = 1; i < pts.length - 1; i++) pos.push(...pts[0], ...pts[i], ...pts[i + 1]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    return this.add(c, g, { body });
  }

  /** Seitenprofil (Punkte [x,y]) quer zum Schiff extrudiert, Breite w um z. */
  profile(c, pts, w, z = 0, { body = true } = {}) {
    const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false });
    g.translate(0, 0, z - w / 2);
    return this.add(c, g, { body });
  }

  /** Grundriss (Punkte [x,z]) senkrecht extrudiert, von y bis y + h. */
  slab(c, pts, y, h, { body = true } = {}) {
    const s = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
    const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    g.translate(0, y, 0);
    return this.add(c, g, { body });
  }

  sphere(c, r, x, y, z, { half = false, body = true } = {}) {
    const g = new THREE.SphereGeometry(r, 8, half ? 3 : 6, 0, Math.PI * 2, 0, half ? Math.PI / 2 : Math.PI);
    g.translate(x, y, z);
    return this.add(c, g, { body });
  }

  line(a, b) {
    this.lines.push(...a, ...b);
  }

  /** Aufbau mit Fensterband an beiden Seiten und vorn. */
  house(c, glass, sx, sy, sz, x, y, z, { band = 0.38, at = 0.42, front = true, back = false } = {}) {
    this.box(c, sx, sy, sz, x, y, z);
    const h = sy * band, wy = y + sy * at;
    this.box(glass, sx * 0.86, h, sz + 0.06, x, wy, z);
    if (front) this.box(glass, 0.06, h, sz * 0.8, x + sx / 2 + 0.01, wy, z);
    if (back) this.box(glass, 0.06, h, sz * 0.8, x - sx / 2 - 0.01, wy, z);
  }

  /** Reling als dünne Leiste auf Stützen entlang eines Grundrisses. */
  rail(c, pts, y, h = 1.0, { closed = false, posts = 4 } = {}) {
    const n = closed ? pts.length : pts.length - 1;
    for (let i = 0; i < n; i++) {
      const [x1, z1] = pts[i], [x2, z2] = pts[(i + 1) % pts.length];
      this.spar(c, [x1, y + h, z1], [x2, y + h, z2], 0.05, { seg: 3, body: false });
      const len = Math.hypot(x2 - x1, z2 - z1);
      const k = Math.max(1, Math.round(len / posts));
      for (let j = 0; j < k; j++) {
        const t = j / k;
        this.spar(c, [x1 + (x2 - x1) * t, y, z1 + (z2 - z1) * t], [x1 + (x2 - x1) * t, y + h, z1 + (z2 - z1) * t], 0.04, { seg: 3 });
      }
    }
  }

  toGroup(name) {
    const group = new THREE.Group();
    if (name) group.name = name;
    for (const [color, geos] of this.byColor) {
      const mesh = new THREE.Mesh(geos.length > 1 ? mergeGeometries(geos) : geos[0], material(color));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    if (this.lines.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.lines, 3));
      group.add(new THREE.LineSegments(g, lineMaterial(RIG_COLOR)));
    }
    return group;
  }
}

// ------------------------------------------------------------------ Rumpf

/**
 * Rumpf aus Spanten. Gibt Hilfsfunktionen zurück, um Aufbauten aufs Deck zu setzen.
 * s: { L, B, fb, x0, depth, bow, bowLen, stern, sternLen, transom, overBow, overStern,
 *      sheerBow, sheerStern, bottom, bootH, stripeH, klinker, flatDeck }
 */
export function hull(kit, s, p) {
  const o = {
    x0: 0, depth: 0.6, bow: 'spitz', bowLen: 0.35, stern: 'spiegel', sternLen: 0.22, transom: 0.8,
    overBow: 0, overStern: 0, sheerBow: 0.6, sheerStern: 0.2, bottom: 0.6, bootH: 0.3, stripeH: 0,
    klinker: 0, deckDrop: 0, ...s,
  };
  const { L, B, x0 } = o;
  const ease = (u) => 1 - (1 - u) * (1 - u);
  const round = (u) => Math.sqrt(Math.max(0, 1 - (1 - u) * (1 - u)));
  const clamp = (v) => Math.min(1, Math.max(0, v));

  const bowF = (t) => {
    const u = clamp((1 - t) / o.bowLen);
    if (o.bow === 'rund') return round(u);
    if (o.bow === 'stumpf') return 0.5 + 0.5 * round(u);
    return ease(u);
  };
  const sternF = (t) => {
    const v = clamp(t / o.sternLen);
    if (o.stern === 'rund') return 0.25 + 0.75 * round(v);
    if (o.stern === 'spitz') return ease(v);
    if (o.stern === 'stumpf') return 0.5 + 0.5 * round(v);
    return o.transom + (1 - o.transom) * ease(v); // spiegel und offen
  };
  const hw = (t) => (B / 2) * bowF(t) * sternF(t);
  const top = (t) => o.fb + o.sheerBow * Math.max(0, (t - 0.5) / 0.5) ** 2 + o.sheerStern * Math.max(0, (0.5 - t) / 0.5) ** 2;
  const xTop = (t) => x0 - L / 2 + t * L;
  const xBot = (t) => x0 - L / 2 + o.overStern + t * (L - o.overStern - o.overBow);
  const yBot = -o.depth;

  const N = 22;
  const ts = [];
  for (let i = 0; i <= N; i++) ts.push((1 - Math.cos((Math.PI * i) / N)) / 2);

  // Höhenstufen mit Farben: Wasserpass, Rumpf (ggf. geklinkert), Zierstreifen
  const levels = (t) => {
    const T = top(t);
    const ys = [yBot, Math.min(o.bootH, T - 0.1)];
    const cs = [p.boot];
    const hullTop = o.stripeH ? T - o.stripeH : T;
    const n = Math.max(1, o.klinker);
    for (let k = 1; k <= n; k++) {
      ys.push(ys[1] + ((hullTop - ys[1]) * k) / n);
      cs.push(o.klinker && k % 2 === 0 ? shade(p.hull, 0.86) : p.hull);
    }
    if (o.stripeH) { ys.push(T); cs.push(p.stripe); }
    return { ys, cs };
  };
  const point = (t, y, side) => {
    const T = top(t);
    const f = (y - yBot) / (T - yBot);
    const x = xBot(t) + (xTop(t) - xBot(t)) * f;
    const w = hw(t) * (o.bottom + (1 - o.bottom) * Math.pow(f, 0.6));
    return [x, y, side * w];
  };

  const quads = new Map();
  const quad = (c, a, b, cc, d) => {
    if (!quads.has(c)) quads.set(c, []);
    quads.get(c).push(...a, ...b, ...cc, ...a, ...cc, ...d);
  };

  for (let i = 0; i < N; i++) {
    const t1 = ts[i], t2 = ts[i + 1];
    const l1 = levels(t1), l2 = levels(t2);
    for (let k = 0; k < l1.ys.length - 1; k++) {
      for (const side of [1, -1]) {
        quad(l1.cs[k], point(t1, l1.ys[k], side), point(t2, l2.ys[k], side), point(t2, l2.ys[k + 1], side), point(t1, l1.ys[k + 1], side));
      }
    }
    // Boden
    quad(p.boot, point(t1, yBot, 1), point(t2, yBot, 1), point(t2, yBot, -1), point(t1, yBot, -1));
    // Deck
    const d1 = top(t1) - o.deckDrop, d2 = top(t2) - o.deckDrop;
    const a = point(t1, top(t1), 1), b = point(t2, top(t2), 1);
    quad(p.deck, [a[0], d1, a[2] * 0.97], [b[0], d2, b[2] * 0.97], [b[0], d2, -b[2] * 0.97], [a[0], d1, -a[2] * 0.97]);
  }
  // Spiegel achtern und stumpfer Bug vorn
  for (const t of [0, 1]) {
    if (hw(t) < 0.05) continue;
    const l = levels(t);
    for (let k = 0; k < l.ys.length - 1; k++) {
      const c = t === 0 && o.stern === 'offen' && k === l.ys.length - 2 ? p.deck : l.cs[k];
      quad(c, point(t, l.ys[k], 1), point(t, l.ys[k + 1], 1), point(t, l.ys[k + 1], -1), point(t, l.ys[k], -1));
    }
  }
  for (const [c, pos] of quads) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    kit.add(c, g);
  }

  const tOf = (x) => clamp((x - (x0 - L / 2)) / L);
  const info = {
    L, B, x0,
    bowX: x0 + L / 2,
    sternX: x0 - L / 2,
    /** Deckhöhe an Position x */
    deckY: (x) => top(tOf(x)) - o.deckDrop,
    /** halbe Breite des Decks an Position x */
    halfW: (x) => hw(tOf(x)) * 0.97,
    /** Grundriss des Decks zwischen xa und xb, eingerückt um inset */
    outline: (xa, xb, inset = 0, n = 10) => {
      const port = [], stb = [];
      for (let i = 0; i <= n; i++) {
        const x = xa + ((xb - xa) * i) / n;
        const w = Math.max(0.05, hw(tOf(x)) * 0.97 - inset);
        port.push([x, w]);
        stb.push([x, -w]);
      }
      return [...port, ...stb.reverse()];
    },
  };
  if (!kit.hullInfo) kit.hullInfo = info;
  return info;
}

export function shade(color, f) {
  const c = new THREE.Color(color);
  c.multiplyScalar(f);
  return c.getHex();
}

// ------------------------------------------------------------------ Takelage

/** Wanten von der Mastspitze zu beiden Seiten. */
export function shrouds(kit, h, x, top, count = 2, spread = 1.2) {
  for (let i = 0; i < count; i++) {
    const xs = x - i * spread;
    const w = h.halfW(xs);
    const y = h.deckY(xs);
    kit.line([x, top, 0], [xs, y, w]);
    kit.line([x, top, 0], [xs, y, -w]);
  }
}

/**
 * Gaffelsegel: Mast bei x, Baum nach achtern.
 * r: { x, deck, foot, throat, peak, boom, gaff }
 */
export function gaffSail(k, h, p, r) {
  const y0 = r.deck + r.foot;
  k.fixed.spar(p.spar, [r.x, y0, 0], [r.x - r.boom, y0 + 0.4, 0], 0.14);
  const peakX = r.x - r.gaff;
  k.sail(p.sail, [[r.x, y0 + 0.2, 0], [r.x - r.boom + 0.3, y0 + 0.6, 0], [peakX, r.deck + r.peak, 0], [r.x, r.deck + r.throat, 0]], {
    extra: (kit, dy) => kit.spar(p.spar, [r.x, r.deck + r.throat - dy, 0], [peakX, r.deck + r.peak - dy, 0], 0.11),
  });
  k.furled.spar(p.sail, [r.x - 0.2, y0 + 0.5, 0], [r.x - r.boom * 0.95, y0 + 0.8, 0], 0.32, { seg: 6 });
  k.furled.spar(p.spar, [r.x - 0.2, y0 + 0.95, 0], [r.x - r.gaff * 0.95, y0 + 1.1, 0], 0.1);
}

/** Dreieckiges Vorsegel zwischen Masttopp und einem Punkt vorn. */
export function headsail(k, p, mast, tack, clewBack = 0.55) {
  const [mx, my] = mast, [tx, ty] = tack;
  const clew = [tx + (mx - tx) * clewBack, ty + 0.6, 0];
  k.sail(p.sail, [[tx, ty, 0], [mx + (tx - mx) * 0.06, my - (my - ty) * 0.06, 0], clew]);
  k.fixed.line([mx, my, 0], [tx, ty, 0]);
}

/** Mast mit Rahen. yards: [{ y, w }] von unten nach oben. */
export function squareRig(k, p, x, deck, height, yards, { r = 0.3 } = {}) {
  k.fixed.cyl(p.spar, r * 0.5, r, height, x, deck, 0, { seg: 6, body: false });
  yards.forEach((yd, i) => {
    k.fixed.spar(p.spar, [x + 0.3, deck + yd.y, -yd.w / 2], [x + 0.3, deck + yd.y, yd.w / 2], 0.13);
    k.furled.spar(p.sail, [x + 0.45, deck + yd.y + 0.15, -yd.w * 0.45], [x + 0.45, deck + yd.y + 0.15, yd.w * 0.45], 0.28, { seg: 5 });
    const below = i === 0 ? { y: yd.y * 0.42, w: yd.w * 1.05 } : yards[i - 1];
    const sy = i === 0 ? deck + below.y : deck + below.y + 0.3;
    k.sail(p.sail, [
      [x + 0.6, deck + yd.y, -yd.w / 2], [x + 0.6, deck + yd.y, yd.w / 2],
      [x + 1.0, sy, below.w / 2], [x + 1.0, sy, -below.w / 2],
    ], { furl: 'up' });
  });
}

/** Mast mit Wanten. */
export function mast(k, h, p, x, height, { r = 0.24, shroudCount = 2, spread = 1.0, at = 0.82 } = {}) {
  const d = h.deckY(x);
  k.fixed.cyl(p.spar, r * 0.55, r, height, x, d, 0, { seg: 6, body: false });
  shrouds(k.fixed, h, x, d + height * at, shroudCount, spread);
  return d;
}

// ------------------------------------------------------------------ Kleinteile

export function dinghy(kit, x, y, z, len, p, { color = 0xfff8ea, rot = 0 } = {}) {
  const w = len * 0.42;
  const pts = [[len / 2, 0], [len * 0.25, w / 2], [-len / 2, w / 2 * 0.85], [-len / 2, -w / 2 * 0.85], [len * 0.25, -w / 2]];
  const r = pts.map(([a, b]) => [a * Math.cos(rot) - b * Math.sin(rot) + x, a * Math.sin(rot) + b * Math.cos(rot) + z]);
  kit.slab(color, r, y, len * 0.18);
  kit.slab(p.deck, r.map(([a, b]) => [x + (a - x) * 0.8, z + (b - z) * 0.8]), y + len * 0.1, len * 0.09);
}

/** Drehender Radarbalken. Wird direkt als bewegliches Teil eingetragen. */
export function radar(k, p, x, y, len = 2.4) {
  const g = new Kit();
  g.box(0xfff8ea, len, 0.18, 0.3, 0, 0, 0);
  g.cyl(p.trim, 0.12, 0.12, 0.25, 0, -0.25, 0, { seg: 6 });
  const grp = g.toGroup('radar');
  grp.position.set(x, y + 0.25, 0);
  k.addMoving(grp, { name: 'radar', type: 'spin', speed: 2.6 });
}

export function buoyTonne(kit, x, y, z, color, cone) {
  kit.cyl(color, 0.7, 0.7, 1.2, x, y, z, { seg: 8 });
  if (cone) kit.cyl(color, 0.02, 0.6, 1.0, x, y + 1.2, z, { seg: 8 });
  else kit.cyl(color, 0.6, 0.6, 0.7, x, y + 1.2, z, { seg: 8 });
  kit.box(0x2a2f38, 0.3, 0.6, 0.3, x, y - 0.3, z);
}

/** Schornstein, seitlich gesehen trapezförmig. Legt Rauch über der Öffnung an. */
export function funnel(k, p, x, y, h, rx, rz, { band = true, top = 0x2a2f38, color = p.accent, rake = 0 } = {}) {
  const kit = k.fixed;
  kit.profile(color, [[x - rx, y], [x + rx, y], [x + rx - rake, y + h], [x - rx - rake, y + h]], rz * 2, 0);
  kit.profile(top, [[x - rx - rake * 0.9, y + h * 0.85], [x + rx - rake * 0.9, y + h * 0.85], [x + rx - rake, y + h], [x - rx - rake, y + h]], rz * 2 + 0.06, 0);
  if (band) kit.profile(0xfff8ea, [[x - rx - rake * 0.55, y + h * 0.5], [x + rx - rake * 0.55, y + h * 0.5], [x + rx - rake * 0.68, y + h * 0.63], [x - rx - rake * 0.68, y + h * 0.63]], rz * 2 + 0.06, 0);
  const s = new Kit();
  const r = Math.min(rx, rz);
  s.sphere(0xd8dde2, r * 0.9, 0, r, 0, { body: false });
  s.sphere(0xe4e8ec, r * 1.2, -r * 1.6, r * 2.4, 0, { body: false });
  s.sphere(0xeef0f2, r * 1.5, -r * 3.6, r * 4.2, 0, { body: false });
  const sg = s.toGroup('smoke');
  sg.position.set(x - rake, y + h, 0);
  sg.visible = false;
  k.addPart(sg);
}

export function latticeMast(kit, p, x, y, h, w = 1.0, color = 0xfff8ea) {
  for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    kit.spar(color, [x + dx * w / 2, y, dz * w / 2], [x + dx * w / 6, y + h, dz * w / 6], 0.07, { seg: 3 });
  }
  for (let i = 1; i < 5; i++) {
    const f = i / 5, s = w / 2 - (w / 2 - w / 6) * f;
    kit.spar(color, [x - s, y + h * f, -s], [x + s, y + h * f, s], 0.05, { seg: 3 });
    kit.spar(color, [x - s, y + h * f, s], [x + s, y + h * f, -s], 0.05, { seg: 3 });
  }
}

/** Fensterreihe (Bullaugen oder Balkone) auf beiden Rumpfseiten. */
export function windowRow(kit, h, color, xa, xb, y, size, gap, { inset = 0.02, height = size } = {}) {
  for (let x = xa; x <= xb; x += size + gap) {
    const z = h.halfW(x + size / 2) + inset;
    kit.box(color, size, height, 0.06, x + size / 2, y, z);
    kit.box(color, size, height, 0.06, x + size / 2, y, -z);
  }
}

/** Schaufelrad (bewegliches Teil) mit Radkasten an einer Seite. */
export function paddleWheel(k, p, x, z, s, wr) {
  const g = new THREE.CylinderGeometry(wr + 0.3, wr + 0.3, 1.1, 12, 1, false, -Math.PI / 2, Math.PI);
  g.rotateX(Math.PI / 2);
  g.translate(x, 0.6, z);
  k.fixed.add(p.house, g);
  const cap = new THREE.CircleGeometry(wr + 0.3, 12, 0, Math.PI);
  cap.translate(x, 0.6, z + s * 0.56);
  k.fixed.add(p.accent, cap);
  const wheel = new Kit();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const b = new THREE.BoxGeometry(0.25, wr * 0.95, 0.8);
    b.translate(0, -wr * 0.475, 0);
    b.rotateZ(a);
    wheel.add(p.trim, b);
  }
  const wg = wheel.toGroup('paddlewheel');
  wg.position.set(x, 0.6, z);
  k.addMoving(wg, { name: 'paddlewheel', type: 'roll' });
}

// ------------------------------------------------------------------ Teile für die Animation

function addStandardParts(k, root, model, p) {
  const h = k.fixed.hullInfo;
  if (!h) return;
  const scale = Math.max(1, model.length / 25);
  // Poller, an denen die Festmacher beginnen
  for (const [name, x] of [['cleat-bow', h.bowX - h.L * 0.08], ['cleat-stern', h.sternX + h.L * 0.05]]) {
    const o = new THREE.Object3D();
    o.name = name;
    o.position.set(x, h.deckY(x) + 0.2, 0);
    root.add(o);
  }
  // Fender an beiden Seiten, standardmäßig eingeholt
  const fk = new Kit();
  const n = Math.min(8, Math.max(3, Math.round(h.L / 7)));
  for (let i = 0; i < n; i++) {
    const x = h.sternX + h.L * (0.18 + (0.62 * i) / (n - 1));
    for (const s of [1, -1]) fk.cyl(0x2e4868, 0.22 * scale, 0.22 * scale, 0.9 * scale, x, h.deckY(x) - 1.1 * scale, s * (h.halfW(x) + 0.22 * scale), { seg: 6, body: false });
  }
  const fg = fk.toGroup('fender');
  fg.visible = false;
  root.add(fg);
  // Flagge am Heck, weht innerhalb der Schiffslänge
  const fw = 1.3 * scale, fh = 0.8 * scale;
  const sx = h.sternX + 0.3 + fw;
  const sy = h.deckY(sx);
  k.fixed.spar(p.trim, [sx, sy, 0], [sx, sy + 2.2 * scale, 0], 0.05 * scale, { seg: 3 });
  const flag = new Kit();
  flag.poly(0xee6454, [[0, 0, 0], [-fw, 0, 0], [-fw, -fh / 3, 0], [0, -fh / 3, 0]]);
  flag.poly(0xfff8ea, [[0, -fh / 3, 0], [-fw, -fh / 3, 0], [-fw, -fh, 0], [0, -fh, 0]]);
  const flg = flag.toGroup('flag-stern');
  flg.position.set(sx, sy + 2.2 * scale, 0);
  root.add(flg);
}

// ------------------------------------------------------------------ Schnittstelle

/**
 * Erzeugt buildBoat, setSails und animateBoat für eine Größe.
 * builders: { [modelId]: (k, palette) => void }
 */
export function makeBoatApi(size, builders, kindOf) {
  function buildBoat(model, { palette = 0, sails = false, id = null } = {}) {
    const build = builders[model.id];
    if (!build) throw new Error(`Unbekanntes ${size}-Modell: ${model.id}`);
    const p = model.palettes[((palette % model.palettes.length) + model.palettes.length) % model.palettes.length];
    const root = new THREE.Group();
    root.name = model.id;
    const set = new THREE.Group();
    set.name = 'sailsSet';
    let sailNo = 0;
    const k = {
      fixed: new Kit(),
      furled: new Kit(),
      moving: [],
      addMoving(group, anim) { this.moving.push({ group, anim }); },
      addPart(group) { root.add(group); },
      /** Gesetztes Segel als eigene Gruppe, Ursprung am Fuß (furl 'down') oder an der Rah (furl 'up'). */
      sail(color, pts, { furl = 'down', extra } = {}) {
        const ys = pts.map((q) => q[1]);
        const y0 = furl === 'up' ? Math.max(...ys) : Math.min(...ys);
        const sk = new Kit();
        sk.poly(color, pts.map(([x, y, z]) => [x, y - y0, z]));
        if (extra) extra(sk, y0);
        const g = sk.toGroup(`sail-${++sailNo}`);
        g.position.y = y0;
        g.userData.furl = furl;
        set.add(g);
      },
    };
    build(k, p);

    root.add(k.fixed.toGroup('hull'));
    root.add(set);
    root.add(k.furled.toGroup('sailsFurled'));
    const anim = [];
    for (const { group, anim: a } of k.moving) {
      root.add(group);
      // Nur Zahlen und Namen in userData, damit group.clone() funktioniert
      anim.push({ ...a, index: root.children.length - 1, base: group.rotation.y });
    }
    addStandardParts(k, root, model, p);

    const kind = kindOf(model);
    root.userData = {
      id: model.id,
      modelId: model.id,
      length: model.length,
      beam: model.beam,
      draft: model.draft,
      airDraft: model.airDraft,
      iconHeight: Math.round((k.fixed.bodyTop + 2.5) * 10) / 10,
      anim,
      hasSails: set.children.length > 0,
      boat: { size, length: model.length, beam: model.beam, draft: model.draft, kind },
    };
    if (id != null) root.userData.pick = { type: 'boat', id };
    setSails(root, sails === true || sails === 'up');
    return root;
  }
  return { buildBoat, setSails, animateBoat };
}

/** Segel setzen (true) oder bergen (false). Bei Schiffen ohne Segel ohne Wirkung. */
export function setSails(group, on) {
  const s = group.getObjectByName('sailsSet');
  const f = group.getObjectByName('sailsFurled');
  if (s) s.visible = !!on;
  if (f) f.visible = !on;
  group.userData.sailsUp = !!on;
}

/**
 * Bewegt die beweglichen Teile: Radar dreht, Kran schwenkt, Schaufelräder drehen bei Fahrt,
 * Rauch steigt bei Fahrt. Schaukeln, Einlaufen und Anlegen macht web/js/render/boat-anim.js.
 * @param {THREE.Group} group
 * @param {number} time  Zeit in Sekunden
 * @param {{speed?: number}} state  speed in m/s
 */
export function animateBoat(group, time, state = {}) {
  const speed = Math.abs(state.speed || 0);
  for (const a of group.userData.anim || []) {
    const o = group.children[a.index];
    if (!o) continue;
    if (a.type === 'spin') o.rotation.y = time * a.speed;
    else if (a.type === 'swing') o.rotation.y = a.base + Math.sin(time * a.speed) * a.amount;
    else if (a.type === 'roll') {
      // Winkel aufsummieren, damit ein Wechsel der Fahrt keinen Sprung macht
      const ud = o.userData;
      const dt = ud.lastTime == null ? 0 : Math.max(0, Math.min(0.2, time - ud.lastTime));
      ud.lastTime = time;
      ud.angle = (ud.angle || 0) - dt * Math.min(2.5, speed * 0.8);
      o.rotation.z = ud.angle;
    }
  }
  for (const smoke of group.children) {
    if (smoke.name !== 'smoke') continue;
    smoke.visible = speed > 0.2;
    if (smoke.visible) smoke.scale.setScalar(0.85 + ((time * 0.6) % 1) * 0.5);
  }
}
