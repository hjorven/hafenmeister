// 3D-Modelle der Schiffe der Größe S im Flat-Stil (Three.js, MeshLambertMaterial mit flatShading).
// Daten: web/js/data/boats/s.js. Abgestimmt mit M, L, XL und dem Animations-Modul:
//
//   1 Einheit = 1 m, Y oben, Bug zeigt nach lokal +X, Steuerbord = +Z,
//   Ursprung = Wasserlinie mittschiffs. rotation.y = richtung aus harbor.js (in rad).
//
// Schnittstelle
//   buildBoat(modelOrId, { palette = 0, sails = false, number, id }) -> THREE.Group
//                                 id: Boot-id aus sim.js, setzt userData.pick = { type: 'boat', id }
//   setSails(group, on)           Segel setzen (true) oder bergen (false)
//   animateBoat(group, time, state = { speed, moored, sway })
//                                 nur die Teile dieses Moduls (Riemen, Paddel, Rad, Motor kippen,
//                                 Kielwasser). Schaukeln und Wege macht web/js/render/boat-anim.js.
//   init(game)                    meldet die Größe S in game.boatTypes.s an
//
// Benannte Teile für das Animations-Modul (child.name):
//   'sail-main', 'sail-jib'       Ursprung am Fuß des Segels, Stauchen auf y birgt es
//   'boom'                        Gruppe mit Drehpunkt am Mast (enthält 'sail-main')
//   'sailsSet', 'sailsFurled'     Untergruppen gesetzt / geborgen (setSails schaltet sie)
//   'cover...'                    Persenning, Segelkleid
//   'fender-...'                  Fender, nur beim Anlegen und Liegen sichtbar
//   'flag'                        flattert
//   'prop'                        Schraube des Außenborders, dreht sich um x
//   'paddle-wheel'                Schaufelrad des Tretboots, dreht sich um seine lokale x-Achse
//   'oar-port', 'oar-stbd'        Riemen im Ruderschlag (Drehpunkt an der Dolle)
//   'oars-stowed'                 Riemen, die im Boot liegen
//   'outboard'                    Außenborder, Drehpunkt am Spiegel, kippt um z
//   'cleat-bow', 'cleat-stern'    leere Object3D, an denen die Festmacher beginnen
//   'wake'                        Heckwelle, Deckkraft nach Fahrt
//
// Alles Unbewegliche wird pro Material zu einem Mesh zusammengefasst (wenige Draw Calls auf dem Handy),
// die Takelage ist ein einziges LineSegments.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MODELS, TYPES, getModel, getType, SIZE } from '../../data/boats/s.js';

// ---------------------------------------------------------------- Farben und Materialien

export const COLORS = {
  white: '#f3efe6', cream: '#efe3c8', sand: '#e6d3a8',
  wood: '#c98b52', woodLight: '#ddb27c', woodDark: '#8a5a35', mahogany: '#8e3f22',
  red: '#e0584a', orange: '#ef8a3a', yellow: '#f2c14e',
  green: '#4f9a72', greenDark: '#2f6b55', olive: '#7d8a5a', tentGreen: '#6f8f6a',
  blue: '#4a86b8', sky: '#8fc3df', navy: '#2f3e57',
  alu: '#b9c2c9', aluDark: '#8e979f', tubeGrey: '#6c7680', chrome: '#d6dde3',
  sail: '#fbf8f1', sailTan: '#c4865a', glass: '#9ccbe0', rope: '#3b3f45', black: '#2b2d31',
};

const matCache = new Map();

function material(hex, shade = 0) {
  const key = `${hex}|${shade}`;
  let m = matCache.get(key);
  if (!m) {
    const c = new THREE.Color(hex);
    if (shade) c.offsetHSL(0, 0, -shade);
    m = new THREE.MeshLambertMaterial({ color: c, flatShading: true, side: THREE.DoubleSide });
    m.name = `boat-s:${key}`;
    matCache.set(key, m);
  }
  return m;
}

const glassMat = new THREE.MeshLambertMaterial({ color: COLORS.glass, transparent: true, opacity: 0.55, flatShading: true, side: THREE.DoubleSide });
glassMat.name = 'boat-s:glass';
const lineMat = new THREE.LineBasicMaterial({ color: COLORS.rope });
lineMat.name = 'boat-s:rigging';

// ---------------------------------------------------------------- kleine Geometrie-Helfer

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

function boxGeo(sx, sy, sz, x, y, z, rot) {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  if (rot) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rot[0] || 0, rot[1] || 0, rot[2] || 0)));
  g.translate(x, y, z);
  return g;
}

// Zylinder zwischen zwei Punkten
function rodGeo(a, b, r, seg = 6, r2 = r) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(r2, r, len, seg, 1);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize()));
  g.translate(a.x, a.y, a.z);
  return g;
}

// Dreiecke aus Punktlisten
function trisGeo(tris) {
  const pos = new Float32Array(tris.length * 9);
  tris.forEach((t, i) => t.forEach((p, j) => { pos[i * 9 + j * 3] = p.x; pos[i * 9 + j * 3 + 1] = p.y; pos[i * 9 + j * 3 + 2] = p.z; }));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return g;
}

// Ein Teilstück zum späteren Zusammenfassen: Geometrie und Material
class Bucket {
  constructor() { this.items = []; }
  add(geo, mat) { this.items.push({ geo, mat }); }
  // fasst alles pro Material zusammen und hängt es an `parent`
  flush(parent, { shadow = true } = {}) {
    const byMat = new Map();
    for (const { geo, mat } of this.items) {
      let g = geo.index ? geo.toNonIndexed() : geo;
      for (const name of Object.keys(g.attributes)) if (name !== 'position') g.deleteAttribute(name);
      if (!byMat.has(mat)) byMat.set(mat, []);
      byMat.get(mat).push(g);
    }
    for (const [mat, geos] of byMat) {
      const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
      merged.computeVertexNormals();
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = shadow && !mat.transparent;
      mesh.receiveShadow = true;
      parent.add(mesh);
    }
    this.items = [];
  }
}

// ---------------------------------------------------------------- Rumpf

const N = 22; // Spanten je Seite

// Verlauf der halben Breite (0..1) über t (0 = Heck, 1 = Bug)
const BOW = {
  pointed: { start: 0.42, f: (u) => 1 - Math.pow(u, 1.9) },
  round: { start: 0.6, f: (u) => Math.sqrt(Math.max(0, 1 - u * u)) },
  blunt: { start: 0.55, f: (u) => 1 - 0.62 * Math.pow(u, 1.5) },
  pram: { start: 0.5, f: (u) => 1 - 0.36 * Math.pow(u, 1.6) },
  box: { start: 0.82, f: (u) => 1 - 0.14 * u * u },
};
const STERN = {
  transom: { start: 0.35, f: (u) => 1 - 0.24 * u * u },
  pointed: { start: 0.42, f: (u) => 1 - Math.pow(u, 1.9) },
  round: { start: 0.3, f: (u) => Math.sqrt(Math.max(0, 1 - 0.97 * u * u)) },
  box: { start: 0.18, f: (u) => 1 - 0.14 * u * u },
};
// Wie weit die unteren Linien an den Enden zurückweichen (Neigung des Stevens), Anteil der Länge
const RAKE_BOW = { pointed: 0.07, round: 0.05, blunt: 0.07, pram: 0.1, box: 0.11 };
const RAKE_STERN = { transom: 0.02, pointed: 0.06, round: 0.05, box: 0.11 };

function makeHullShape(L, B, h) {
  const bow = BOW[h.bow] ?? BOW.pointed;
  const stern = STERN[h.stern] ?? STERN.transom;
  const W = B / 2;
  const hwT = (t) => {
    let f = 1;
    if (t > bow.start) f = bow.f((t - bow.start) / (1 - bow.start));
    else if (t < stern.start) f = stern.f((stern.start - t) / stern.start);
    return Math.max(0.004, W * f);
  };
  const fb = h.freeboard;
  const sheerT = (t) => fb
    + (h.sheerBow || 0) * Math.pow(Math.max(0, (t - 0.5) / 0.5), 2)
    + (h.sheerStern || 0) * Math.pow(Math.max(0, (0.5 - t) / 0.5), 2);
  const ts = [];
  for (let i = 0; i <= N; i++) ts.push(0.5 - 0.5 * Math.cos(Math.PI * i / N));
  const rakeB = (RAKE_BOW[h.bow] ?? 0.06) * L;
  const rakeS = (RAKE_STERN[h.stern] ?? 0.03) * L;
  const xT = (t) => -L / 2 + t * L;
  const tX = (x) => Math.min(1, Math.max(0, x / L + 0.5));
  return {
    L, B, fb, ts, hwT, sheerT, xT, tX, rakeB, rakeS,
    hw: (x) => hwT(tX(x)),
    sheer: (x) => sheerT(tX(x)),
  };
}

// Ring aus 2(N+1) Punkten: Steuerbord vom Heck zum Bug, dann Backbord zurück
function ring(S, { y, w, shrink = 0, tFrom = 0, tTo = 1, xIn = 0 }) {
  const pts = [];
  const side = [];
  for (const t0 of S.ts) {
    const t = tFrom + (tTo - tFrom) * t0;
    const x = THREE.MathUtils.lerp(-S.L / 2 + S.rakeS * shrink + xIn, S.L / 2 - S.rakeB * shrink - xIn, t);
    const tt = S.tX(x);
    side.push([x, typeof y === 'function' ? y(tt) : y, Math.max(0.003, w(tt))]);
  }
  for (const [x, yy, ww] of side) pts.push(V(x, yy, ww));
  for (let i = side.length - 1; i >= 0; i--) pts.push(V(side[i][0], side[i][1], -side[i][2]));
  return pts;
}

function loft(a, b) {
  const tris = [];
  const n = a.length;
  for (let j = 0; j < n; j++) {
    const k = (j + 1) % n;
    tris.push([a[j], a[k], b[k]], [a[j], b[k], b[j]]);
  }
  return trisGeo(tris);
}

function cap(r) {
  const contour = r.map((p) => new THREE.Vector2(p.x, p.z));
  const idx = THREE.ShapeUtils.triangulateShape(contour, []);
  return trisGeo(idx.map(([a, b, c]) => [r[a], r[b], r[c]]));
}

function offsetRing(r, dz, dy = 0, dx = 0) {
  return r.map((p) => V(p.x + Math.sign(p.x) * 0 + dx, p.y + dy, p.z + Math.sign(p.z || 1) * dz));
}

// Baut den Rumpf in den Bucket. Gibt die Form zurück (für die Anbauten).
function buildMonoHull(bucket, L, B, h, deck, col, zOff = 0) {
  const S = makeHullShape(L, B * (h.narrow || 1), h);
  const hull = material(col.hull);
  const hullShade = material(col.hull, 0.06);
  const trim = material(col.trim);
  const deckM = material(col.deck);
  const inside = material(col.inside);
  const rings = [];
  const segMats = [];
  const gun = ring(S, { y: S.sheerT, w: S.hwT });
  rings.push(gun);

  const yChine = h.build === 'chine' ? 0.03 : 0.0;
  const chineW = h.build === 'chine' ? 0.97 : 0.9;
  const lowW = { round: 0.5, v: 0.14, flat: h.build === 'chine' ? 0.86 : 0.75 }[h.bottom] ?? 0.5;

  if (h.stripe) {
    rings.push(ring(S, { y: (t) => S.sheerT(t) - 0.08, w: (t) => S.hwT(t) * 0.995, shrink: 0.08 }));
    segMats.push(hull);
    rings.push(ring(S, { y: (t) => S.sheerT(t) - 0.17, w: (t) => S.hwT(t) * 0.985, shrink: 0.16 }));
    segMats.push(trim);
  }
  if (h.build === 'clinker') {
    const n = 4;
    const lap = 0.018;
    for (let j = 1; j < n; j++) {
      const s = j / n;
      const yy = (t) => THREE.MathUtils.lerp(S.sheerT(t), yChine, s);
      const ww = (t) => S.hwT(t) * THREE.MathUtils.lerp(1, chineW, Math.pow(s, 1.4));
      rings.push(ring(S, { y: yy, w: (t) => ww(t) + lap, shrink: s * 0.6 }));
      segMats.push(j % 2 ? hull : hullShade);
      rings.push(ring(S, { y: (t) => yy(t) - 0.004, w: ww, shrink: s * 0.6 }));
      segMats.push(trim);
    }
    rings.push(ring(S, { y: yChine, w: (t) => S.hwT(t) * chineW, shrink: 0.6 }));
    segMats.push(n % 2 ? hull : hullShade);
  } else {
    rings.push(ring(S, { y: yChine, w: (t) => S.hwT(t) * chineW, shrink: 0.6 }));
    segMats.push(h.stripe ? hull : hull);
  }
  if (h.bottom === 'round') {
    rings.push(ring(S, { y: -h.depth * 0.6, w: (t) => S.hwT(t) * 0.78, shrink: 0.85 }));
    segMats.push(hullShade);
  }
  rings.push(ring(S, { y: -h.depth, w: (t) => S.hwT(t) * lowW, shrink: 1 }));
  segMats.push(hullShade);

  for (let i = 0; i < rings.length - 1; i++) bucket.add(shift(loft(rings[i], rings[i + 1]), zOff), segMats[i]);
  bucket.add(shift(cap(rings[rings.length - 1]), zOff), hullShade);

  // Deck oder Innenraum
  const wall = deck.wall ?? 0.035;
  const floorY = deck.floor ?? 0.08;
  S.floorY = floorY;
  S.wall = wall;
  if (deck.type === 'closed') {
    const crown = h.crown ?? 0.02;
    const mid = ring(S, { y: (t) => S.sheerT(t) + crown, w: (t) => S.hwT(t) * 0.18, xIn: 0.02 });
    bucket.add(shift(loft(gun, mid), zOff), deckM);
    bucket.add(shift(cap(mid), zOff), deckM);
    S.deckY = (x) => S.sheer(x) + crown;
    S.open = null;
  } else {
    let tFrom = 0, tTo = 1, wf = 1, rimMat = trim;
    if (deck.type === 'partial') {
      tFrom = deck.from + 0.5; tTo = deck.to + 0.5; wf = deck.width ?? 0.7; rimMat = deckM;
    }
    const xIn = deck.type === 'partial' ? 0 : wall * 1.5;
    const innerW = (t) => Math.min(S.hwT(t) - wall, S.hwT(t) * wf);
    const rim = ring(S, { y: S.sheerT, w: innerW, tFrom, tTo, xIn });
    const floor = ring(S, { y: floorY, w: (t) => innerW(t) * 0.86, tFrom, tTo, xIn: xIn + 0.04 });
    bucket.add(shift(loft(gun, rim), zOff), rimMat);
    bucket.add(shift(loft(rim, floor), zOff), material(col.inside, 0.05));
    bucket.add(shift(cap(floor), zOff), inside);
    S.deckY = (x) => S.sheer(x);
    S.open = { xFrom: tFrom * L - L / 2, xTo: tTo * L - L / 2, wf };
  }
  S.inW = (x) => Math.max(0.05, Math.min(S.hw(x) - wall, S.hw(x) * (S.open ? S.open.wf : 1)));
  S.zOff = zOff;
  return S;
}

function shift(g, z) { if (z) g.translate(0, 0, z); return g; }

// Schlauch entlang des Rumpfumrisses (Schlauchboot, RIB)
function buildTubes(bucket, S, r, y0, tail, colKey, sheerBow) {
  const pts = [];
  const side = [];
  for (let i = 0; i <= 16; i++) {
    const t = 0.03 + 0.97 * i / 16;
    const x = -S.L / 2 + t * S.L;
    const w = Math.max(0, S.hwT(t) - r * 0.2);
    const y = y0 + sheerBow * Math.pow(Math.max(0, (t - 0.5) / 0.5), 2);
    side.push([x, y, w]);
  }
  pts.push(V(-S.L / 2 - tail, y0, side[0][2]));
  for (const [x, y, w] of side) if (w > r * 0.6) pts.push(V(x, y, w));
  const tip = side[side.length - 1];
  pts.push(V(tip[0] - r * 0.4, tip[1], 0));
  for (let i = side.length - 1; i >= 0; i--) if (side[i][2] > r * 0.6) pts.push(V(side[i][0], side[i][1], -side[i][2]));
  pts.push(V(-S.L / 2 - tail, y0, -side[0][2]));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const tube = new THREE.TubeGeometry(curve, 48, r, 7, false);
  const mat = material(colKey);
  bucket.add(tube, mat);
  for (const p of [pts[0], pts[pts.length - 1]]) {
    const end = new THREE.SphereGeometry(r, 7, 4);
    end.translate(p.x, p.y, p.z);
    bucket.add(end, material(colKey, 0.04));
  }
  // Scheuerband unten am Schlauch
  const band = new THREE.TubeGeometry(curve, 48, r * 0.35, 5, false);
  band.translate(0, -r * 0.75, 0);
  bucket.add(band, material(COLORS.navy));
  return { curve, pts };
}

// ---------------------------------------------------------------- Anbauten

// Jeder Eintrag: (ctx, params) => void. ctx enthält Form, Farben und Ablagen.
const PARTS = {
  thwart(c, p) {
    const x = p.x * c.L;
    const w = c.S.inW(x) * 2 + 0.02;
    const y = c.S.deckY(x) - (p.thin ? 0.1 : 0.16);
    c.add(boxGeo(p.thin ? 0.08 : 0.22, 0.035, w, x, y, 0), c.col.deck);
  },
  sternSeat(c, p) {
    const x = p.x * c.L;
    const w = c.S.inW(x) * 2;
    const y = c.S.deckY(x) - 0.16;
    c.add(boxGeo(0.4, 0.035, w, x, y, 0), c.col.deck);
  },
  bench(c, p) {
    const x = p.x * c.L;
    const w = c.S.inW(x) * 2 + 0.02;
    const y = c.S.deckY(x) - 0.14;
    c.add(boxGeo(0.28, 0.05, w, x, y, 0), c.col.deck);
    c.add(boxGeo(0.26, y - c.S.floorY, w * 0.92, x, (y + c.S.floorY) / 2 - 0.02, 0), c.col.inside, 0.03);
  },
  canoeSeat(c, p) {
    const x = p.x * c.L;
    const w = c.S.inW(x) * 2 + 0.02;
    c.add(boxGeo(0.26, 0.03, w, x, c.S.deckY(x) - 0.12, 0), c.col.deck);
  },
  rowlocks(c, p) {
    const x = p.x * c.L;
    const w = c.S.hw(x);
    for (const s of [1, -1]) c.add(boxGeo(0.05, 0.08, 0.05, x, c.S.deckY(x) + 0.04, s * (w - 0.02)), COLORS.aluDark);
  },
  oars(c, p) {
    const len = p.short ? Math.min(1.8, c.L * 0.62) : Math.min(2.6, Math.max(2.0, c.L * 0.6));
    // im Boot liegend
    const stowed = new THREE.Group();
    stowed.name = 'oars-stowed';
    const b = new Bucket();
    const y = c.S.deckY(0) - 0.1;
    for (const s of [1, -1]) {
      const z = s * c.S.inW(0) * 0.55;
      oarGeo(b, V(-len / 2, y, z), V(len / 2, y, z * 0.9), c.col);
    }
    b.flush(stowed);
    c.anim.add(stowed);
    // ausgebracht zum Rudern, unsichtbar bis zur Fahrt
    const rl = c.model.parts.extras.find((e) => e.part === 'rowlocks');
    const xr = (rl ? rl.x : 0) * c.L;
    const yr = c.S.deckY(xr) + 0.08;
    for (const s of [1, -1]) {
      const pivot = new THREE.Group();
      pivot.name = s > 0 ? 'oar-stbd' : 'oar-port';
      pivot.position.set(xr, yr, s * (c.S.hw(xr) - 0.02));
      const ob = new Bucket();
      const inner = 0.28 * len;
      // Riemen quer zum Boot, Blatt im Wasser
      oarGeo(ob, V(0, 0.05, -s * inner), V(-0.15, -yr + 0.02, s * (len - inner)), c.col);
      ob.flush(pivot);
      pivot.visible = false;
      c.anim.add(pivot);
    }
  },
  punt(c) {
    const y = c.S.deckY(0) - 0.08;
    c.add(rodGeo(V(-c.L * 0.55, y, 0.25), V(c.L * 0.5, y, 0.18), 0.022), c.col.accent);
  },
  rodHolders(c, p) {
    const x = p.x * c.L;
    for (let i = 0; i < p.count; i++) {
      const s = i % 2 ? -1 : 1;
      const xi = x + (Math.floor(i / 2) - 0.5) * 0.25;
      const z = s * (c.S.hw(xi) - 0.06);
      const y = c.S.deckY(xi);
      c.add(rodGeo(V(xi, y - 0.15, z), V(xi - 0.05, y + 0.08, z + s * 0.02), 0.022), COLORS.aluDark);
      const a = V(xi - 0.05, y + 0.08, z + s * 0.02);
      const tip = V(xi - 0.9, y + 1.25, z + s * 0.35);
      c.add(rodGeo(a, tip, 0.012, 4, 0.005), COLORS.black);
      c.lines.push(tip, V(tip.x - 0.1, -0.02, tip.z + s * 0.2));
    }
  },
  landingNet(c, p) {
    const x = p.x * c.L;
    const y = c.S.floorY + 0.05;
    c.add(rodGeo(V(x - 0.8, y, -0.25), V(x + 0.2, y, -0.2), 0.016), c.col.accent);
    const hoop = new THREE.TorusGeometry(0.22, 0.014, 4, 12);
    hoop.rotateX(Math.PI / 2);
    hoop.translate(x + 0.42, y, -0.19);
    c.add(hoop, c.col.accent);
    const net = new THREE.CircleGeometry(0.21, 10);
    net.rotateX(-Math.PI / 2);
    net.translate(x + 0.42, y - 0.005, -0.19);
    c.add(net, COLORS.rope);
  },
  outboard(c, p) {
    const s = p.size;
    const xs = -c.L / 2 - (p.bracket ? 0.18 : 0.02);
    const yt = c.S.sheer(-c.L / 2) - 0.02;
    const pivot = new THREE.Group();
    pivot.name = 'outboard';
    pivot.position.set(xs, yt, 0);
    const b = new Bucket();
    const cowl = c.col.accent === 'chrome' ? COLORS.navy : COLORS[c.col.accentKey] || c.col.accent;
    b.add(boxGeo(0.34 * s, 0.32 * s, 0.24 * s, -0.12 * s, 0.2 * s, 0), material(cowl));
    b.add(boxGeo(0.3 * s, 0.06 * s, 0.22 * s, -0.12 * s, 0.37 * s, 0), material(cowl, 0.08));
    b.add(boxGeo(0.12 * s, 0.1 * s, 0.14 * s, -0.08 * s, 0.0, 0), material(COLORS.black));
    b.add(boxGeo(0.1 * s, yt + 0.42 * s, 0.07 * s, -0.12 * s, -(yt + 0.42 * s) / 2 + 0.03, 0), material(COLORS.black));
    b.add(boxGeo(0.26 * s, 0.02, 0.2 * s, -0.14 * s, -yt - 0.18 * s, 0), material(COLORS.black));
    b.add(rodGeo(V(-0.06 * s, 0.14 * s, 0), V(0.3 * s, 0.16 * s, 0), 0.018 * Math.max(1, s), 5), material(COLORS.black));
    if (p.bracket) b.add(boxGeo(0.2, 0.06, 0.3, 0.09, -0.02, 0), material(COLORS.aluDark));
    b.flush(pivot);
    const prop = new THREE.Group();
    prop.name = 'prop';
    prop.position.set(-0.08 * s, -yt - 0.3 * s, 0);
    const pb = new Bucket();
    for (let i = 0; i < 3; i++) pb.add(boxGeo(0.02, 0.16 * s, 0.05 * s, 0, 0.08 * s, 0, [i * 2.09, 0, 0]), material(COLORS.black));
    pb.flush(prop);
    pivot.add(prop);
    c.anim.add(pivot);
  },
  box(c, p) {
    const x = p.x * c.L;
    const [sx, sy, sz] = p.size;
    c.add(boxGeo(sx, sy, sz, x, c.S.floorY + sy / 2, p.z || 0), c.colKey(p.color));
  },
  canopy(c, p) {
    const x1 = p.from * c.L, x2 = p.to * c.L;
    const top = p.height;
    const posts = [];
    for (const x of [x1 + 0.08, x2 - 0.08]) for (const s of [1, -1]) {
      const z = s * (c.S.hw(x) - 0.06);
      posts.push([x, z]);
      c.add(rodGeo(V(x, c.S.deckY(x) - 0.05, z), V(x, top, z * 0.96), 0.02), COLORS.chrome);
    }
    const wz = Math.max(c.S.hw(x1), c.S.hw(x2)) + 0.05;
    const len = x2 - x1 + 0.3;
    const xm = (x1 + x2) / 2;
    if (p.flat) {
      c.add(boxGeo(len, 0.05, wz * 2, xm, top + 0.02, 0), c.col.canvas);
      c.add(boxGeo(len, 0.1, 0.02, xm, top - 0.04, wz), c.col.canvas, 0.08);
      c.add(boxGeo(len, 0.1, 0.02, xm, top - 0.04, -wz), c.col.canvas, 0.08);
      return;
    }
    // gestreiftes Stoffdach mit leichtem Giebel
    const n = p.stripes || 6;
    for (let i = 0; i < n; i++) {
      const xa = xm - len / 2 + (i + 0.5) * len / n;
      const colr = i % 2 ? COLORS.white : c.col.canvas;
      for (const s of [1, -1]) {
        c.add(boxGeo(len / n, 0.03, wz, xa, top + 0.08, s * wz / 2, [s * 0.16, 0, 0]), colr);
        // Volant am Rand
        c.add(boxGeo(len / n, 0.12, 0.02, xa, top - 0.02, s * (wz - 0.01)), colr, 0.04);
      }
    }
  },
  bowNumber(c, p) {
    if (typeof document === 'undefined') return;
    const num = String(c.opts.number ?? (1 + (hash(c.model.id) % 9)));
    const tex = numberTexture(num);
    const x = c.L / 2 - 0.45;
    for (const s of [1, -1]) {
      const plane = new THREE.PlaneGeometry(0.34, 0.22);
      const z = s * (c.S.hw(x) + 0.006);
      const m = new THREE.Mesh(plane, new THREE.MeshLambertMaterial({ map: tex, transparent: true }));
      m.position.set(x, c.S.sheer(x) - 0.17, z);
      m.rotation.y = s > 0 ? 0 : Math.PI;
      m.rotation.x = 0;
      // Rumpf zieht am Bug ein, Schild dreht sich mit
      m.rotation.y += -s * Math.atan2(c.S.hw(x + 0.1) - c.S.hw(x - 0.1), 0.2) * 0.8;
      c.anim.add(m);
    }
  },
  rubStrake(c, p) {
    const S = c.S;
    const colr = p.color ? (COLORS[p.color] || p.color) : c.col.trim;
    const a = ring(S, { y: (t) => S.sheerT(t) - 0.03, w: S.hwT });
    const b = ring(S, { y: (t) => S.sheerT(t) - 0.03, w: (t) => S.hwT(t) + 0.03 });
    const cc = ring(S, { y: (t) => S.sheerT(t) - 0.08, w: (t) => S.hwT(t) + 0.03 });
    const d = ring(S, { y: (t) => S.sheerT(t) - 0.08, w: S.hwT });
    c.add(loft(a, b), colr); c.add(loft(b, cc), colr, 0.05); c.add(loft(cc, d), colr, 0.1);
  },
  hatch(c, p) {
    const x = p.x * c.L;
    const y = c.S.deckY(x);
    if (p.flat) {
      const g = new THREE.CylinderGeometry(0.5, 0.5, 0.03, 12);
      g.scale(p.length, 1, p.width);
      g.translate(x, y + 0.01, 0);
      c.add(g, c.col.trim);
      return;
    }
    const rim = new THREE.CylinderGeometry(0.5, 0.5, 0.05, 14);
    rim.scale(p.length, 1, p.width);
    rim.translate(x, y + 0.015, 0);
    c.add(rim, c.col.trim, 0.1);
    const hole = new THREE.CylinderGeometry(0.5, 0.5, 0.01, 14);
    hole.scale(p.length - 0.06, 1, p.width - 0.06);
    hole.translate(x, y + 0.045, 0);
    c.add(hole, COLORS.black);
  },
  deckLines(c, p) {
    const x1 = p.from * c.L, x2 = p.to * c.L;
    const n = 3;
    for (let i = 0; i <= n; i++) {
      const xa = x1 + (x2 - x1) * i / n;
      const w = c.S.hw(xa) * 0.85;
      const y = c.S.deckY(xa) + 0.01;
      c.lines.push(V(xa, y, w), V(xa, y, -w));
      if (i < n) {
        const xb = x1 + (x2 - x1) * (i + 1) / n;
        const wb = c.S.hw(xb) * 0.85;
        const yb = c.S.deckY(xb) + 0.01;
        c.lines.push(V(xa, y, w), V(xb, yb, -wb), V(xa, y, -w), V(xb, yb, wb));
      }
    }
  },
  paddle(c, p) {
    const x = p.x * c.L;
    const len = p.blades === 2 ? 2.2 : 1.4;
    // abgelegt: auf dem Deck oder im Boot
    const b = new Bucket();
    const y = c.S.open && !p.inboardDeck ? c.S.floorY + 0.04 : c.S.deckY(x) + 0.03;
    const z = p.blades === 2 ? c.S.hw(x) * 0.5 : p.side * c.S.inW(x) * 0.5;
    paddleGeo(b, V(x - len / 2, y, z), V(x + len / 2, y, z * 0.9), p.blades, c.col);
    const stowed = new THREE.Group();
    stowed.name = 'paddle-stowed';
    b.flush(stowed);
    c.anim.add(stowed);
    // in Fahrt: gehalten, Schlag macht das Animations-Modul oder animateBoat
    const held = new THREE.Group();
    held.name = p.blades === 2 ? 'kayak-paddle' : (p.side > 0 ? 'canoe-paddle-stbd' : 'canoe-paddle-port');
    held.position.set(x + 0.15, c.S.deckY(x) + 0.35, 0);
    const hb = new Bucket();
    if (p.blades === 2) paddleGeo(hb, V(0, 0, -len / 2), V(0, 0, len / 2), 2, c.col);
    else paddleGeo(hb, V(0, 0.45, p.side * 0.15), V(0, -0.9, p.side * 0.45), 1, c.col);
    hb.flush(held);
    held.visible = false;
    held.userData.side = p.side;
    c.anim.add(held);
  },
  kayakRudder(c) {
    const x = -c.L / 2 + 0.02;
    c.add(boxGeo(0.18, 0.28, 0.02, x - 0.06, c.S.deckY(x) - 0.12, 0), c.col.trim);
  },
  pedalDeck(c, p) {
    const x1 = p.from * c.L, x2 = p.to * c.L;
    const w = c.B - 0.2;
    const y = c.hull.freeboard + 0.02;
    c.add(boxGeo(x2 - x1, 0.05, w, (x1 + x2) / 2, y, 0), c.col.deck);
    // Fußwanne mit Pedalen
    const xf = x2 - 0.35;
    c.add(boxGeo(0.4, 0.04, w * 0.7, xf, y + 0.03, 0), c.col.inside, 0.08);
    for (const s of [0.25, -0.25]) c.add(boxGeo(0.12, 0.06, 0.08, xf + 0.05, y + 0.1, s * w * 0.5), COLORS.black);
  },
  pedalSeats(c, p) {
    const x = p.x * c.L;
    const y = c.hull.freeboard + 0.05;
    const w = c.B - 0.3;
    const per = w / p.seats;
    for (let i = 0; i < p.seats; i++) {
      const z = -w / 2 + per * (i + 0.5);
      c.add(boxGeo(0.42, 0.12, per - 0.08, x, y + 0.08, z), c.col.canvas);
      c.add(boxGeo(0.08, 0.45, per - 0.08, x - 0.24, y + 0.32, z, [0, 0, 0.18]), c.col.canvas, 0.06);
    }
  },
  paddleWheel(c, p) {
    const x = p.x * c.L;
    const y0 = c.hull.freeboard + 0.02;
    const r = p.radius;
    const housingTop = y0 + r * 0.55;
    // Radkasten
    c.add(boxGeo(r * 2.2, r * 0.9, 0.5, x, housingTop - r * 0.45 + 0.05, 0), c.col.trim);
    if (p.hidden) return;
    const wheel = new THREE.Group();
    wheel.name = 'paddle-wheel';
    wheel.position.set(x, y0 - r * 0.25, 0);
    wheel.rotation.y = Math.PI / 2; // lokale x-Achse liegt quer zum Boot
    const b = new Bucket();
    const hub = new THREE.CylinderGeometry(0.06, 0.06, 0.4, 6);
    hub.rotateZ(Math.PI / 2);
    b.add(hub, material(COLORS.aluDark));
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      b.add(boxGeo(0.38, 0.03, r * 0.9, 0, 0, 0, [a, 0, 0]).translate(0, Math.sin(a) * r * 0.55, Math.cos(a) * r * 0.55), material(c.col.trim, 0.1));
    }
    b.flush(wheel);
    c.anim.add(wheel);
  },
  pedalRudder(c) {
    const x = -c.L / 2 - 0.05;
    c.add(boxGeo(0.25, 0.4, 0.03, x, 0.05, 0), c.col.trim);
    c.add(rodGeo(V(x + 0.1, 0.25, 0), V(x + 0.55, c.hull.freeboard + 0.45, 0), 0.015), COLORS.black);
  },
  slide(c, p) {
    const x = p.x * c.L;
    const y0 = c.hull.freeboard + 0.05;
    const top = y0 + 1.15;
    // Leiter und Plattform
    for (const s of [1, -1]) c.add(rodGeo(V(x + 0.35, y0, s * 0.25), V(x + 0.15, top, s * 0.25), 0.025), COLORS.chrome);
    for (let i = 1; i < 4; i++) {
      const f = i / 4;
      c.add(rodGeo(V(x + 0.35 - 0.2 * f, y0 + f * 1.15, 0.25), V(x + 0.35 - 0.2 * f, y0 + f * 1.15, -0.25), 0.018), COLORS.chrome);
    }
    c.add(boxGeo(0.35, 0.06, 0.6, x + 0.05, top, 0), c.col.accent);
    // Rutschbahn aus Segmenten mit Krümmung ins Wasser
    const segs = 6;
    let prev = V(x - 0.1, top, 0);
    for (let i = 1; i <= segs; i++) {
      const f = i / segs;
      const px = x - 0.1 - f * 1.25;
      const py = top - (1 - Math.pow(1 - f, 1.6)) * (top - 0.15);
      const cur = V(px, py, 0);
      const mid = prev.clone().add(cur).multiplyScalar(0.5);
      const ang = Math.atan2(cur.y - prev.y, cur.x - prev.x);
      const segLen = prev.distanceTo(cur) + 0.02;
      c.add(boxGeo(segLen, 0.04, 0.5, mid.x, mid.y, 0, [0, 0, ang]), c.col.accent);
      for (const s of [1, -1]) c.add(boxGeo(segLen, 0.1, 0.04, mid.x, mid.y + 0.05, s * 0.27, [0, 0, ang]), c.col.accent, 0.1);
      prev = cur;
    }
  },
  tubeSeat(c, p) {
    const x = p.x * c.L;
    c.add(boxGeo(0.24, 0.04, c.B - 0.2, x, c.tubeY, 0), COLORS.woodLight);
  },
  grabLine(c) {
    if (!c.tubes) return;
    const pts = c.tubes.curve.getPoints(30);
    for (let i = 1; i < pts.length - 1; i += 2) {
      const a = pts[i].clone(), b = pts[i + 1].clone();
      const out = (q) => q.add(V(0, c.hull.tube * 0.6, Math.sign(q.z) * c.hull.tube * 0.6));
      c.lines.push(out(a), out(b));
    }
  },
  woodTransom(c) {
    const x = -c.L / 2 + 0.03;
    c.add(boxGeo(0.05, 0.36, c.S.hw(x) * 2, x, c.tubeY - 0.04, 0), COLORS.woodLight);
  },
  fuelTank(c, p) {
    const x = p.x * c.L;
    c.add(boxGeo(0.4, 0.22, 0.28, x, c.S.floorY + 0.11, p.z), COLORS.red);
    c.add(rodGeo(V(x + 0.12, c.S.floorY + 0.22, p.z), V(x + 0.12, c.S.floorY + 0.27, p.z), 0.03), COLORS.black);
  },
  console(c, p) {
    const x = p.x * c.L;
    const h = p.height;
    const f = c.S.floorY;
    c.add(boxGeo(0.55, h, p.width, x, f + h / 2, 0), c.col.deck);
    c.add(boxGeo(0.35, 0.04, p.width * 0.9, x - 0.06, f + h + 0.04, 0, [0, 0, -0.35]), COLORS.black);
    c.add(torusAt(V(x - 0.3, f + h - 0.08, 0), 0.15, [0, Math.PI / 2, 0.5]), COLORS.black);
    if (p.screen) c.add(boxGeo(0.03, 0.3, p.width, x + 0.18, f + h + 0.12, 0, [0, 0, 0.35]), null, 0, glassMat);
  },
  jockeySeat(c, p) {
    const x = p.x * c.L;
    const f = c.S.floorY;
    c.add(boxGeo(0.12, 0.45, 0.12, x, f + 0.22, 0), COLORS.aluDark);
    c.add(boxGeo(0.55, 0.16, 0.36, x, f + 0.52, 0), c.col.canvas);
  },
  aFrame(c, p) {
    const x = p.x * c.L;
    const f = c.S.floorY;
    const w = c.S.inW(x) * 0.9;
    const top = p.height;
    c.add(rodGeo(V(x, f, w), V(x, top, w * 0.6), 0.03), COLORS.chrome);
    c.add(rodGeo(V(x, f, -w), V(x, top, -w * 0.6), 0.03), COLORS.chrome);
    c.add(rodGeo(V(x, top, w * 0.6), V(x, top, -w * 0.6), 0.03), COLORS.chrome);
    c.add(boxGeo(0.08, 0.12, 0.08, x, top + 0.08, 0), COLORS.white);
    c.lines.push(V(x, top, 0.3), V(x - 0.1, top + 1.0, 0.3));
  },
  bowLocker(c, p) {
    const x = p.x * c.L;
    const f = c.S.floorY;
    const w = c.S.inW(x) * 1.4;
    c.add(boxGeo(0.7, 0.35, w, x, f + 0.17, 0), c.col.deck);
    c.add(boxGeo(0.66, 0.08, w * 0.94, x, f + 0.38, 0), c.col.canvas);
  },
  buoyancyBags(c) {
    for (const s of [1, -1]) c.add(boxGeo(0.5, 0.2, 0.12, -0.05, c.S.floorY + 0.12, s * (c.S.inW(0) - 0.08)), COLORS.white, 0.04);
    c.add(boxGeo(0.25, 0.2, c.S.inW(c.L / 2 - 0.2) * 1.6, c.L / 2 - 0.2, c.S.floorY + 0.12, 0), COLORS.white, 0.04);
  },
  tillerRudder(c, p) {
    const x = -c.L / 2 - 0.05;
    const y = c.S.sheer(-c.L / 2);
    if (p.motor) c.add(boxGeo(0.28, 0.4, 0.03, x + 0.02, -0.18, 0), COLORS.black);
    else c.add(boxGeo(0.3, y + 0.5, 0.03, x - 0.08, (y - 0.5) / 2, 0), c.col.trim);
    if (!p.motor) c.add(rodGeo(V(x, y + 0.04, 0), V(x + 0.9, y + 0.12, 0), 0.02), COLORS.woodLight);
  },
  centerboardCase(c, p) {
    const x = p.x * c.L;
    c.add(boxGeo(0.8, 0.22, 0.07, x, c.S.floorY + 0.11, 0), c.col.deck, 0.04);
  },
  mainsheet(c, p) {
    const x = p.x * c.L;
    c.add(boxGeo(0.08, 0.1, 0.08, x, c.S.floorY + 0.05, 0), COLORS.black);
  },
  spinnakerPole(c, p) {
    const x = p.x * c.L;
    const y = c.S.deckY(x) + 0.03;
    c.add(rodGeo(V(x - 0.6, y, 0.12), V(x + 1.0, y, 0.12), 0.02), COLORS.alu);
  },
  hikingStraps(c) {
    for (const s of [0.18, -0.18]) c.add(boxGeo(1.2, 0.02, 0.05, -c.L * 0.2, c.S.floorY + 0.03, s), COLORS.navy);
  },
  tent() {
    // wird im Rigg gebaut (Persenning hängt am Baum)
  },
  deckPlanks(c, p) {
    const x1 = Math.max(p.from * c.L, -c.L / 2 + 0.05), x2 = Math.min(p.to * c.L, c.L / 2 - 0.05);
    const steps = 10;
    const n = p.dense ? 7 : 5;
    for (let k = 0; k < steps; k++) {
      const xa = x1 + (x2 - x1) * k / steps, xb = x1 + (x2 - x1) * (k + 1) / steps;
      for (let i = 1; i < n; i++) {
        const fz = -1 + 2 * i / n;
        const za = fz * c.S.hw(xa) * 0.88, zb = fz * c.S.hw(xb) * 0.88;
        if (c.S.open && xa < c.S.open.xTo && xb > c.S.open.xFrom && Math.abs(za) < c.S.inW(xa) + 0.02) continue;
        const ya = deckSurfaceY(c, xa, za) + 0.004, yb = deckSurfaceY(c, xb, zb) + 0.004;
        const a = V(xa, ya, za), b = V(xb, yb, zb);
        const g = rodGeo(a, b, 0.006, 3);
        c.add(g, COLORS.cream, 0.05);
      }
    }
  },
  cockpit(c, p) {
    const x = p.x * c.L;
    const len = p.length * c.L;
    const w = c.S.hw(x) * 1.45;
    const y = c.S.deckY(x);
    c.add(boxGeo(len + 0.08, 0.04, w + 0.08, x, y + 0.01, 0), c.col.trim);
    c.add(boxGeo(len, 0.04, w, x, y + 0.025, 0), c.col.canvas);
    // Sitzbank mit Lehne
    c.add(boxGeo(0.12, 0.22, w, x - len / 2 + 0.06, y + 0.12, 0, [0, 0, 0.2]), c.col.canvas, 0.08);
  },
  windshield(c, p) {
    const x = p.x * c.L;
    const y = c.S.deckY(x);
    const w = c.S.hw(x) * 2 - 0.12;
    const h = p.height;
    if (p.walkthrough) {
      const half = (w - 0.5) / 2;
      for (const s of [1, -1]) {
        const z = s * (0.25 + half / 2);
        c.add(boxGeo(0.03, h, half, x, y + h / 2, z, [0, 0, 0.45]), null, 0, glassMat);
        c.add(boxGeo(0.05, 0.03, half, x - Math.sin(0.45) * h / 2, y + h, z), COLORS.chrome);
      }
    } else {
      c.add(boxGeo(0.03, h, w, x, y + h / 2, 0, [0, 0, 0.5]), null, 0, glassMat);
      c.add(boxGeo(0.05, 0.03, w, x - Math.sin(0.5) * h / 2, y + h, 0), p.chrome ? COLORS.chrome : COLORS.black);
      if (p.chrome) for (const s of [1, -1]) c.add(rodGeo(V(x + 0.05, y, s * w / 2), V(x - Math.sin(0.5) * h / 2, y + h, s * w / 2), 0.015), COLORS.chrome);
    }
  },
  dashConsoles(c, p) {
    const x = p.x * c.L;
    const f = c.S.floorY;
    const y = c.S.deckY(x);
    for (const s of [1, -1]) {
      c.add(boxGeo(0.4, y - f + 0.02, 0.6, x - 0.1, (y + f) / 2, s * 0.5), c.col.deck);
    }
    c.add(torusAt(V(x - 0.32, y - 0.06, 0.5), 0.15, [0, Math.PI / 2, 0.5]), COLORS.black);
  },
  seats(c, p) {
    const x = p.x * c.L;
    const f = c.S.floorY;
    for (const s of [1, -1]) {
      c.add(boxGeo(0.45, 0.14, 0.45, x, f + 0.4, s * 0.5), c.col.canvas);
      c.add(boxGeo(0.1, 0.42, 0.45, x - 0.26, f + 0.6, s * 0.5, [0, 0, 0.15]), c.col.canvas, 0.06);
      c.add(boxGeo(0.12, 0.33, 0.12, x, f + 0.17, s * 0.5), COLORS.aluDark);
    }
  },
  sternBench(c, p) {
    const x = p.x * c.L;
    const f = c.S.floorY;
    const w = c.S.inW(x) * 2;
    c.add(boxGeo(0.45, 0.32, w, x, f + 0.16, 0), c.col.canvas);
    c.add(boxGeo(0.12, 0.3, w, x - 0.25, f + 0.42, 0), c.col.canvas, 0.06);
  },
  bowSeats(c, p) {
    const x1 = p.from * c.L, x2 = c.L / 2 - 0.4;
    const f = c.S.floorY;
    for (const s of [1, -1]) {
      const xm = (x1 + x2) / 2;
      const z = s * (c.S.inW(xm) - 0.2);
      c.add(boxGeo(x2 - x1, 0.32, 0.38, xm, f + 0.16, z, [0, s * 0.18, 0]), c.col.canvas);
    }
    c.add(boxGeo(0.35, 0.32, c.S.inW(x2) * 1.6, x2 + 0.05, f + 0.16, 0), c.col.canvas);
  },
  benches(c, p) {
    const x1 = p.from * c.L, x2 = p.to * c.L;
    const f = c.S.floorY;
    const xm = (x1 + x2) / 2;
    for (const s of [1, -1]) c.add(boxGeo(x2 - x1, 0.05, 0.3, xm, f + 0.38, s * (c.S.inW(xm) - 0.17)), c.col.deck);
    c.add(boxGeo(0.3, 0.05, c.S.inW(x1) * 2, x1 + 0.1, f + 0.38, 0), c.col.deck);
  },
  engineBox(c, p) {
    const x = p.x * c.L;
    const f = c.S.floorY;
    c.add(boxGeo(0.6, 0.4, 0.5, x, f + 0.2, 0), c.col.deck, 0.06);
    c.add(rodGeo(V(x - 0.1, f + 0.4, 0.15), V(x - 0.1, f + 0.75, 0.15), 0.035), COLORS.black);
    c.add(torusAt(V(x + 0.38, f + 0.65, 0), 0.14, [0, Math.PI / 2, 0.4]), COLORS.woodDark);
  },
  wheelhouse(c, p) {
    const x = p.x * c.L;
    const len = p.length * c.L;
    const y0 = c.S.deckY(x) - 0.05;
    const h = p.height;
    const w = c.S.hw(x) * 1.5;
    const hull = c.col.deck;
    c.add(boxGeo(len, h, w, x, y0 + h / 2, 0), hull);
    // Fensterband
    c.add(boxGeo(len * 0.86, h * 0.32, w + 0.02, x - 0.02, y0 + h * 0.68, 0), COLORS.navy);
    c.add(boxGeo(0.04, h * 0.34, w * 0.86, x + len / 2 + 0.01, y0 + h * 0.68, 0, [0, 0, -0.15]), null, 0, glassMat);
    // Dach mit Überstand, hinten offen zum Arbeitsdeck
    c.add(boxGeo(len + 0.18, 0.06, w + 0.08, x - 0.04, y0 + h + 0.03, 0), c.col.trim);
    c.add(boxGeo(len * 0.5, 0.02, w * 0.6, x - len * 0.25, y0 + h - 0.05, 0), COLORS.black);
    c.add(rodGeo(V(x, y0 + h + 0.06, 0), V(x - 0.1, y0 + h + 0.55, 0), 0.015), COLORS.white);
    c.add(boxGeo(0.12, 0.08, 0.08, x - 0.1, y0 + h + 0.6, 0), COLORS.white);
  },
  bowRail(c) {
    const S = c.S;
    const xs = [];
    for (let i = 0; i <= 6; i++) xs.push(c.L * 0.12 + (c.L * 0.5 - 0.15 - c.L * 0.12) * i / 6);
    const h = 0.32;
    const top = (x, s) => V(x, S.deckY(x) + h, s * Math.max(0.02, S.hw(x) - 0.06));
    for (const s of [1, -1]) {
      for (let i = 0; i < xs.length - 1; i++) c.add(rodGeo(top(xs[i], s), top(xs[i + 1], s), 0.012, 4), COLORS.chrome);
      for (let i = 0; i < xs.length - 1; i += 2) c.add(rodGeo(V(xs[i], S.deckY(xs[i]), s * (S.hw(xs[i]) - 0.06)), top(xs[i], s), 0.012, 4), COLORS.chrome);
    }
  },
  leaningPost(c, p) {
    const x = p.x * c.L;
    const f = c.S.floorY;
    c.add(boxGeo(0.35, 0.6, 0.6, x, f + 0.3, 0), c.col.deck);
    c.add(boxGeo(0.25, 0.25, 0.6, x + 0.05, f + 0.75, 0), c.col.canvas);
  },
  cleats(c) {
    for (const x of [c.L / 2 - 0.35, -c.L / 2 + 0.25]) for (const s of [1, -1]) {
      c.add(boxGeo(0.15, 0.04, 0.04, x, c.S.deckY(x) + 0.02, s * (c.S.hw(x) - 0.05)), COLORS.chrome);
    }
  },
  chromeFittings(c) {
    PARTS.cleats(c);
    const x = c.L / 2 - 0.12;
    c.add(boxGeo(0.12, 0.08, 0.06, x, c.S.deckY(x) + 0.04, 0), COLORS.chrome);
    // Scheuerleiste aus Chrom
    PARTS.rubStrake(c, { color: 'chrome' });
  },
  flagStaff(c) {
    const x = -c.L / 2 + 0.08;
    const y = c.S.deckY(x);
    c.add(rodGeo(V(x, y, 0), V(x - 0.1, y + 0.75, 0), 0.012), COLORS.woodDark);
    const flag = new THREE.Group();
    flag.name = 'flag';
    flag.position.set(x - 0.1, y + 0.72, 0);
    const b = new Bucket();
    b.add(boxGeo(0.32, 0.2, 0.01, -0.16, -0.1, 0), material(COLORS.red));
    b.add(boxGeo(0.32, 0.06, 0.012, -0.16, -0.1, 0), material(COLORS.white));
    b.flush(flag, { shadow: false });
    c.anim.add(flag);
  },
  inboardProp() {},
  hinges(c) {
    for (const x of [-c.L * 0.2, c.L * 0.15]) for (const s of [1, -1]) {
      const y = c.S.sheer(x);
      c.add(boxGeo(0.04, y + 0.02, 0.012, x, y / 2, s * (c.S.hw(x) + 0.004)), c.col.trim);
    }
  },
};

function deckSurfaceY(c, x, z) {
  const crown = c.hull.crown ?? 0.02;
  const w = c.S.hw(x);
  const f = Math.min(1, Math.abs(z) / Math.max(0.01, w));
  return c.S.sheer(x) + crown * (1 - f);
}

function torusAt(p, r, rot) {
  const g = new THREE.TorusGeometry(r, 0.018, 4, 10);
  g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot)));
  g.translate(p.x, p.y, p.z);
  return g;
}

function oarGeo(bucket, a, b, col) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const bladeStart = a.clone().addScaledVector(dir, 0.75);
  bucket.add(rodGeo(a, bladeStart, 0.022, 5), material(COLORS.woodLight));
  const len = dir.length() * 0.25;
  const blade = new THREE.BoxGeometry(len, 0.012, 0.13);
  blade.translate(len / 2, 0, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(V(1, 0, 0), dir.clone().normalize());
  blade.applyQuaternion(q);
  blade.translate(bladeStart.x, bladeStart.y, bladeStart.z);
  bucket.add(blade, material(COLORS.woodLight, 0.05));
  const tip = blade.clone();
  bucket.add(tip.scale(1, 1, 1), material(COLORS.woodLight, 0.05));
}

function paddleGeo(bucket, a, b, blades, col) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const n = dir.clone().normalize();
  const bl = 0.42;
  const shaftA = blades === 2 ? a.clone().addScaledVector(n, bl) : a.clone();
  const shaftB = b.clone().addScaledVector(n, -bl);
  bucket.add(rodGeo(shaftA, shaftB, 0.016, 5), material(COLORS.black));
  const q = new THREE.Quaternion().setFromUnitVectors(V(1, 0, 0), n);
  const bladeAt = (start) => {
    const g = new THREE.BoxGeometry(bl, 0.012, 0.17);
    g.translate(bl / 2, 0, 0);
    g.applyQuaternion(q);
    g.translate(start.x, start.y, start.z);
    bucket.add(g, material(col.accent === 'chrome' ? COLORS.navy : col.trim));
  };
  bladeAt(shaftB);
  if (blades === 2) bladeAt(a);
  void len;
}

const texCache = new Map();
function numberTexture(text) {
  if (texCache.has(text)) return texCache.get(text);
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 42;
  const g = cv.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 64, 42);
  g.fillStyle = COLORS.navy;
  g.font = 'bold 34px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 32, 23);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  texCache.set(text, tex);
  return tex;
}

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// ---------------------------------------------------------------- Rigg

function buildRig(c, rig) {
  const L = c.L;
  const xm = rig.mast * L;
  const deckM = c.S.deckY(xm);
  const top = rig.height;
  const boomY = deckM + (rig.type === 'sprit' ? 0.35 : 0.8);
  const boomLen = rig.boom * L;
  const mastCol = rig.type === 'gaff' ? COLORS.woodLight : COLORS.alu;
  const sailCol = [COLORS.sail, COLORS.sailTan].includes(c.col.canvas) ? c.col.canvas : COLORS.sail;
  c.add(rodGeo(V(xm, c.S.floorY ?? 0.05, 0), V(xm, top, 0), rig.type === 'sprit' ? 0.025 : 0.04, 6, rig.type === 'gaff' ? 0.03 : 0.035), mastCol);
  if (rig.type === 'gaff') c.add(boxGeo(0.1, 0.08, 0.1, xm, top + 0.04, 0), mastCol);

  // Bugspriet
  let tackX = L / 2 - 0.1;
  let tackY = c.S.deckY(L / 2 - 0.1) + 0.05;
  if (rig.bowsprit) {
    const a = V(L / 2 - 0.4, c.S.deckY(L / 2 - 0.4) + 0.05, 0);
    const b = V(L / 2 + rig.bowsprit, c.S.deckY(L / 2) + 0.12, 0);
    c.add(rodGeo(a, b, 0.03), COLORS.woodLight);
    tackX = b.x; tackY = b.y;
  }

  // Stagen und Wanten
  const hounds = V(xm, rig.type === 'cat' ? top : top * 0.82, 0);
  if (rig.type !== 'cat' && rig.type !== 'sprit') {
    c.lines.push(V(tackX, tackY, 0), hounds);
    for (const s of [1, -1]) c.lines.push(hounds, V(xm - 0.12, c.S.sheer(xm), s * c.S.hw(xm - 0.12)));
  }
  if (rig.trapeze) {
    for (const s of [1, -1]) c.lines.push(hounds, V(xm - 0.05, deckM + 1.0, s * 0.25));
    for (const s of [1, -1]) c.add(new THREE.TorusGeometry(0.04, 0.008, 3, 6).translate(xm - 0.05, deckM + 0.97, s * 0.25), COLORS.chrome);
  }

  // Baum mit Drehpunkt am Mast: enthält gesetztes Großsegel und geborgenes Segelkleid
  const boom = new THREE.Group();
  boom.name = 'boom';
  boom.position.set(xm, boomY, 0);
  const bb = new Bucket();
  bb.add(rodGeo(V(0, 0, 0), V(-boomLen, 0, 0), rig.type === 'sprit' ? 0.02 : 0.035, 5), material(mastCol));
  bb.flush(boom);
  c.anim.add(boom);

  const set = new THREE.Group();
  set.name = 'sailsSet';
  const furled = new THREE.Group();
  furled.name = 'sailsFurled';
  c.root.add(set);
  c.root.add(furled);

  // Großsegel: lokaler Ursprung am Hals (Fuß am Mast), Höhe entlang +y
  const mainH = top - boomY - 0.12;
  const main = new THREE.Group();
  main.name = 'sail-main';
  const mb = new Bucket();
  const belly = 0.06;
  let outline;
  if (rig.type === 'sprit') {
    outline = [V(0, 0, 0), V(0, mainH * 0.9, 0), V(-boomLen * 0.95, mainH + 0.1, 0), V(-boomLen, 0.02, 0)];
  } else if (rig.type === 'gaff') {
    outline = [V(0, 0, 0), V(0, mainH * 0.72, 0), V(-boomLen * 0.9, mainH, 0), V(-boomLen, 0.02, 0)];
  } else {
    outline = [V(0, 0, 0), V(0, mainH, 0), V(-boomLen * 0.15, mainH - 0.1, 0), V(-boomLen, 0.02, 0)];
  }
  sailGeo(mb, outline, belly, sailCol);
  mb.flush(main, { shadow: true });
  if (rig.type === 'sprit') {
    const sb = new Bucket();
    sb.add(rodGeo(V(0, mainH * 0.15, 0.03), V(-boomLen * 0.95, mainH + 0.1, 0.03), 0.015), material(COLORS.woodLight));
    sb.flush(main);
  }
  if (rig.type === 'gaff') {
    const gb = new Bucket();
    gb.add(rodGeo(V(0, mainH * 0.72, 0), V(-boomLen * 0.92, mainH + 0.03, 0), 0.03), material(mastCol));
    gb.flush(main);
  }
  main.userData.setIn = 'boom';
  boom.add(main);
  // gesetzt: Großsegel hängt am Baum, beim Bergen blenden wir es aus
  main.userData.group = 'sailsSet';

  // Fock: Ursprung am Hals, Fuß zum Schothorn
  if (rig.jib) {
    const jib = new THREE.Group();
    jib.name = 'sail-jib';
    jib.position.set(tackX - 0.05, tackY + 0.05, 0);
    jib.userData.furl = 'x';
    const jb = new Bucket();
    const head = V(hounds.x - jib.position.x + 0.05, hounds.y - jib.position.y - 0.1, 0);
    const clewX = xm - 0.35 - jib.position.x;
    sailGeo(jb, [V(0, 0, 0), head, head, V(clewX, deckM + 0.15 - jib.position.y, 0.15)], belly, sailCol, true);
    jb.flush(jib);
    set.add(jib);
  }

  // Geborgen: Segelkleid auf dem Baum, Fock um das Vorstag gerollt
  const fb = new Bucket();
  if (rig.type === 'sprit') {
    fb.add(rodGeo(V(xm, boomY + 0.1, 0), V(xm, top * 0.85, 0), 0.06, 6, 0.04), material(sailCol));
  } else {
    const coverCol = c.extras.some((e) => e.part === 'tent') ? c.col.canvas : COLORS.navy;
    void coverCol;
  }
  fb.flush(furled);
  if (rig.type !== 'sprit') {
    const cover = new THREE.Group();
    cover.name = 'cover-boom';
    const cb = new Bucket();
    const cc = c.col.canvas === COLORS.sail || c.col.canvas === COLORS.sailTan ? COLORS.navy : c.col.canvas;
    cb.add(rodGeo(V(-0.05, 0.08, 0), V(-boomLen * 0.9, 0.06, 0), 0.09, 6, 0.05), material(cc));
    if (rig.type === 'gaff') cb.add(rodGeo(V(-0.05, 0.2, 0), V(-boomLen * 0.85, 0.16, 0), 0.03), material(mastCol));
    cb.flush(cover);
    cover.position.copy(boom.position);
    furled.add(cover);
  }
  if (rig.jib) {
    const jf = new Bucket();
    jf.add(rodGeo(V(tackX, tackY + 0.1, 0), hounds.clone().add(V(0.03, -0.2, 0)), 0.035, 5, 0.02), material(sailCol));
    jf.flush(furled);
  }

  // Persenning als Zelt über dem Baum (Wanderjolle)
  const tent = c.extras.find((e) => e.part === 'tent');
  if (tent) {
    const t = new THREE.Group();
    t.name = 'cover-tent';
    const tb = new Bucket();
    const x1 = tent.from * L, x2 = tent.to * L;
    const ridge = boomY + 0.05;
    const tris = [];
    const pa = (x, s) => V(x, c.S.sheer(x) + 0.02, s * (c.S.hw(x) + 0.02));
    const ra = (x) => V(x, ridge - (xm - x) * 0.02, 0);
    const steps = 4;
    for (let i = 0; i < steps; i++) {
      const xa = x1 + (x2 - x1) * i / steps, xb = x1 + (x2 - x1) * (i + 1) / steps;
      for (const s of [1, -1]) tris.push([pa(xa, s), pa(xb, s), ra(xb)], [pa(xa, s), ra(xb), ra(xa)]);
    }
    for (const x of [x1, x2]) tris.push([pa(x, 1), pa(x, -1), ra(x)]);
    tb.add(trisGeo(tris), material(c.col.canvas));
    tb.flush(t);
    furled.add(t);
  }

  c.rig = { boom, main, set, furled, boomY, mastX: xm };
}

// Segel als leicht gewölbte Fläche aus wenigen Facetten
function sailGeo(bucket, [a, b, cc, d], belly, colr) {
  const mid = (p, q, f = 0.5) => p.clone().lerp(q, f);
  const center = a.clone().add(b).add(cc).add(d).multiplyScalar(0.25);
  center.z += belly * 2;
  const ab = mid(a, b); ab.z += belly;
  const cd = mid(cc, d); cd.z += belly * 0.6;
  const bc = mid(b, cc);
  const da = mid(d, a); da.z += belly * 0.8;
  const tris = [
    [a, ab, center], [ab, b, center], [b, bc, center], [bc, cc, center],
    [cc, cd, center], [cd, d, center], [d, da, center], [da, a, center],
  ];
  bucket.add(trisGeo(tris), material(colr));
}

// ---------------------------------------------------------------- Kielwasser

function buildWake(c) {
  const wake = new THREE.Group();
  wake.name = 'wake';
  const mat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const L = c.L, B = c.B;
  const tris = [];
  const y = 0.02;
  for (const s of [1, -1]) {
    // Heckwelle
    tris.push([V(-L / 2, y, s * B * 0.3), V(-L / 2 - L * 0.7, y, s * B * 0.85), V(-L / 2 - L * 0.7, y, s * B * 0.7)]);
    // Bugwelle
    tris.push([V(L / 2 - 0.1, y, 0), V(L * 0.1, y, s * (B / 2 + 0.25)), V(L * 0.15, y, s * (B / 2 + 0.1))]);
  }
  tris.push([V(-L / 2, y, B * 0.2), V(-L / 2 - L * 0.5, y, 0.03), V(-L / 2, y, -B * 0.2)]);
  const mesh = new THREE.Mesh(trisGeo(tris), mat);
  mesh.renderOrder = 1;
  wake.add(mesh);
  wake.userData.material = mat;
  wake.visible = false;
  return wake;
}

// ---------------------------------------------------------------- Aufbau

function resolvePalette(model, index) {
  const pal = model.palettes[((index % model.palettes.length) + model.palettes.length) % model.palettes.length];
  const col = {};
  for (const [k, v] of Object.entries(pal)) col[k] = COLORS[v] || v;
  col.accentKey = pal.accent;
  return col;
}

const KIND = { S1: 'row', S2: 'pedal', S3: 'motor', S4: 'sail', S5: 'motor' };

export function buildBoat(modelOrId, opts = {}) {
  const model = typeof modelOrId === 'string' ? getModel(modelOrId) : modelOrId;
  if (!model) throw new Error(`Unbekanntes Boot: ${modelOrId}`);
  const { palette = 0 } = opts;
  const col = resolvePalette(model, palette);
  const L = model.length, B = model.beam;
  const h = model.parts.hull;
  const deck = model.parts.deck;

  const root = new THREE.Group();
  root.name = `boat-${model.id}`;
  const statics = new Bucket();
  const lines = [];
  const anim = new THREE.Group();
  anim.name = 'parts';

  // Rumpf je nach Bauart
  let S;
  let tubes = null;
  let tubeY = 0;
  if (h.form === 'twin') {
    const fbw = h.floatBeam;
    const off = B / 2 - fbw / 2;
    for (const s of [1, -1]) S = buildMonoHull(statics, L, fbw, h, { type: 'closed' }, col, s * off);
    // Form für Anbauten: ganze Breite, Deck auf Schwimmerhöhe
    S = makeHullShape(L, B, { ...h, bow: 'box', stern: 'box' });
    S.deckY = () => h.freeboard + 0.05;
    S.floorY = h.freeboard + 0.05;
    S.inW = () => B / 2 - 0.1;
    S.open = null;
  } else if (h.form === 'inflatable' || h.form === 'rib') {
    const r = h.tube;
    const innerB = B - r * (h.form === 'rib' ? 1.4 : 1.6);
    S = buildMonoHull(statics, L - r * 0.4, innerB, h, deck, col);
    tubeY = h.form === 'rib' ? h.freeboard + r * 0.35 : r * 0.85;
    const outer = makeHullShape(L, B, h);
    tubes = buildTubes(statics, outer, r, tubeY, h.tubeTail ?? 0.15, col.deck, h.sheerBow || 0);
    S.inW = (x) => Math.max(0.1, outer.hw(x) - r * 1.6);
    if (h.form === 'inflatable') S.deckY = (x) => tubeY + r * 0.6 + 0 * x;
  } else {
    S = buildMonoHull(statics, L, B, h, deck, col);
  }

  const ctx = {
    model, opts, col, L, B, hull: h, S, tubes, tubeY, lines, anim, root,
    extras: model.parts.extras,
    colKey: (k) => col[k] || COLORS[k] || k,
    add(geo, colr, shade = 0, mat = null) {
      statics.add(geo, mat || material(colr, shade));
    },
  };

  if (model.parts.rig) buildRig(ctx, model.parts.rig);
  for (const e of model.parts.extras) {
    const fn = PARTS[e.part];
    if (!fn) { console.warn('Boot S: unbekanntes Teil', e.part); continue; }
    fn(ctx, e);
  }

  // Festmacherpunkte und Fender
  const bowX = L / 2 - 0.25, sternX = -L / 2 + 0.2;
  for (const [name, x] of [['cleat-bow', bowX], ['cleat-stern', sternX]]) {
    const o = new THREE.Object3D();
    o.name = name;
    o.position.set(x, S.deckY(x) + 0.03, 0);
    root.add(o);
  }
  if (h.form !== 'inflatable' && h.form !== 'rib' && !(model.typeId === 'S2' && h.form !== 'twin')) {
    for (const s of [1, -1]) {
      const fender = new THREE.Group();
      fender.name = `fender-${s > 0 ? 'stbd' : 'port'}`;
      const fbk = new Bucket();
      for (const x of [L * 0.2, -L * 0.2]) {
        const g = new THREE.CylinderGeometry(0.06, 0.06, 0.26, 6);
        const z = s * (S.hw(x) + 0.065);
        g.translate(x, Math.max(0.16, S.sheer(x) - 0.2), z);
        fbk.add(g, material(COLORS.white));
        lines.push(V(x, S.sheer(x), s * S.hw(x)), V(x, S.sheer(x) - 0.09, z));
      }
      fbk.flush(fender);
      fender.visible = false;
      root.add(fender);
    }
  }

  statics.flush(root);
  if (lines.length) {
    const g = new THREE.BufferGeometry().setFromPoints(lines);
    const ls = new THREE.LineSegments(g, lineMat);
    ls.name = 'rigging';
    root.add(ls);
  }
  // bewegliche Teile direkt an die Wurzel hängen, damit sie per Name auffindbar sind
  while (anim.children.length) root.add(anim.children[0]);
  const wake = buildWake(ctx);
  root.add(wake);

  const type = getType(model.typeId);
  root.userData = {
    id: model.id,
    modelId: model.id,
    size: SIZE,
    length: L,
    beam: B,
    draft: model.draft,
    airDraft: model.airDraft,
    iconHeight: Math.max(1.0, model.airDraft > 3 ? 2.2 : model.airDraft + 0.4),
    boat: { size: SIZE, length: L, beam: B, draft: model.draft, kind: KIND[model.typeId] },
    propulsion: type?.propulsion,
    anim: ['boom', 'sail-main', 'sail-jib', 'sailsSet', 'sailsFurled', 'flag', 'prop', 'paddle-wheel', 'oar-port', 'oar-stbd', 'outboard', 'wake']
      .filter((n) => root.getObjectByName(n)),
    phase: (hash(model.id) % 1000) / 1000 * Math.PI * 2,
  };
  // antippbar über game.pick (id wie in sim.js)
  if (opts.id != null) root.userData.pick = { type: 'boat', id: opts.id };
  setSails(root, !!(opts.sails === true || opts.sails === 'up'));
  return root;
}

// Segel setzen (true) oder bergen (false)
export function setSails(group, on) {
  const main = group.getObjectByName('sail-main');
  const set = group.getObjectByName('sailsSet');
  const furled = group.getObjectByName('sailsFurled');
  if (main) { main.visible = on; main.scale.y = 1; }
  if (set) set.visible = on;
  if (furled) furled.visible = !on;
  const jib = group.getObjectByName('sail-jib');
  if (jib) jib.scale.set(1, 1, 1);
  group.userData.sailsUp = on;
}

// Teil-Animationen dieses Moduls. Schaukeln, Wege und Anlegen macht boat-anim.js.
// state.speed in m/s, state.moored true/false. Gibt nichts zurück.
export function animateBoat(group, time, state = {}) {
  const ud = group.userData;
  const speed = state.speed ?? 0;
  const moving = speed > 0.05;
  const dt = ud._lastTime == null ? 0 : Math.min(0.1, Math.max(0, time - ud._lastTime));
  ud._lastTime = time;
  const ph = ud.phase || 0;

  // Riemen: ausbringen bei Fahrt, Schlag im Takt der Geschwindigkeit
  const oarP = group.getObjectByName('oar-port');
  const oarS = group.getObjectByName('oar-stbd');
  const stowed = group.getObjectByName('oars-stowed');
  if (oarP && oarS) {
    oarP.visible = oarS.visible = moving;
    if (stowed) stowed.visible = !moving;
    if (moving) {
      const w = time * (2.2 + speed) + ph;
      const sweep = Math.sin(w) * 0.5;
      const lift = Math.max(0, Math.cos(w)) * 0.18;
      oarS.rotation.set(-lift, sweep, 0);
      oarP.rotation.set(lift, -sweep, 0);
    }
  }
  // Paddel
  group.traverse((o) => {
    if (o.name === 'kayak-paddle') {
      o.visible = moving;
      if (moving) o.rotation.set(Math.sin(time * 2.4 + ph) * 0.6, Math.sin(time * 2.4 + ph) * 0.35, 0);
    } else if (o.name.startsWith('canoe-paddle')) {
      o.visible = moving;
      if (moving) o.rotation.set(0, 0, -0.6 + Math.sin(time * 2 + ph) * 0.6);
    } else if (o.name === 'paddle-stowed') {
      o.visible = !moving;
    }
  });
  // Schaufelrad und Schraube
  const wheel = group.getObjectByName('paddle-wheel');
  if (wheel) wheel.rotateX(-dt * speed * 4);
  const prop = group.getObjectByName('prop');
  if (prop) prop.rotateX(dt * speed * 25);
  // Außenborder: liegend hochgekippt, in Fahrt herunter
  const ob = group.getObjectByName('outboard');
  if (ob) {
    const target = state.moored ? -0.9 : 0;
    ob.rotation.z += (target - ob.rotation.z) * Math.min(1, dt * 2);
  }
  // Fender nur beim Liegen
  for (const n of ['fender-stbd', 'fender-port']) {
    const f = group.getObjectByName(n);
    if (f) f.visible = !!state.moored;
  }
  // Baum pendelt leicht, Segel killt im Stand
  const boom = group.getObjectByName('boom');
  if (boom) {
    const target = ud.sailsUp && moving ? 0.35 : Math.sin(time * 0.7 + ph) * 0.03;
    boom.rotation.y += (target - boom.rotation.y) * Math.min(1, dt * 1.5);
    const main = group.getObjectByName('sail-main');
    if (main && ud.sailsUp && !moving) main.rotation.y = Math.sin(time * 6 + ph) * 0.04;
  }
  const flag = group.getObjectByName('flag');
  if (flag) flag.rotation.y = Math.sin(time * 5 + ph) * 0.35;
  // Heck- und Bugwelle
  const wake = group.getObjectByName('wake');
  if (wake) {
    const op = Math.min(0.45, speed * 0.2);
    wake.visible = op > 0.02;
    wake.userData.material.opacity = op;
  }
}

// ---------------------------------------------------------------- Einhängen ins Spiel

export function init(game) {
  game.boatTypes = game.boatTypes || {};
  const entry = { size: SIZE, TYPES, MODELS, buildBoat, setSails, animateBoat };
  game.boatTypes.s = entry;
  game.boatTypes.S = entry; // Alias, Schreibweise ist klein (docs/grundgeruest.md)
  game.emit?.('boats:registered', { size: SIZE });
  // Zum Ansehen im Spiel: index.html?demo=boote-s stellt die S-Boote an die Plätze der Stufe 1
  if (typeof location !== 'undefined' && /[?&]demo=boote-s\b/.test(location.search)) placeDemo(game);
}

async function placeDemo(game) {
  try {
    const { HAFEN } = await import('../../data/harbor.js');
    const U = HAFEN.einheiten.meterProEinheit;
    const plaetze = HAFEN.plaetze.filter((p) => p.klasse === 'S' && p.lage && p.lage[1]).slice(0, 6);
    const pick = ['S1-1', 'S1-2', 'S2-4', 'S3-1', 'S4-1', 'S5-1'];
    const boats = [];
    plaetze.forEach((p, i) => {
      const [x, y, dir] = p.lage[1];
      const g = buildBoat(pick[i % pick.length], { palette: i, id: `demo-s-${i}` });
      g.position.set(x * U, 0, -y * U);
      g.rotation.y = THREE.MathUtils.degToRad(dir);
      game.scene.add(g);
      boats.push(g);
    });
    game.onTick(() => boats.forEach((b) => animateBoat(b, game.time, { moored: true })));
  } catch (err) {
    console.warn('Demo Boote S:', err);
  }
}
