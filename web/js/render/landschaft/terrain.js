// Gelände als 3D-Netz im Flat-Vector-Stil: flache Dreiecke mit Pastellfarben,
// dazu Molen, Kaimauern, Buhnen und Pflanzen (Kiefern, Laubbäume, Dünengras, Schilf, Felsen).
// Alle wiederholten Dinge werden beim Bau zu wenigen festen Netzen gebacken, damit es auch auf schwachen Handys flüssig bleibt.
import * as THREE from 'three';
import { vereinfacheRaster } from './netz.js';
import { punkt, BEREICH, PLAN_M, molen, buhnen, rauschen, DURCHSTICH, SLIP, pricken, leuchttuerme } from './gelaende.js';
import { erzeugeLeuchtfeuer } from './tageslicht.js';
import { setzeBewuchs } from './bewuchs.js';
import { JAHRESZEIT_FARBEN, JAHRESZEIT_TYPEN } from './vielfalt.js';

const U = PLAN_M;

// Einfacher, reproduzierbarer Zufall
function zufall(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Qualitätsstufen: Rasterweite in Metern und Mengen. */
export const QUALITAET = {
  hoch:    { raster: 2.0, aussen: 10, tiefeRaster: 1.5, pflanzen: 1.0, schatten: true },
  mittel:  { raster: 2.6, aussen: 14, tiefeRaster: 2.0, pflanzen: 0.7, schatten: false },
  niedrig: { raster: 3.2, aussen: 20, tiefeRaster: 2.6, pflanzen: 0.45, schatten: false },
};

// ------------------------------------------------------------------ Geländenetz

function baueNetz(region, stufe, x0, x1, y0, y1, schritt, loch, absenken, unterGrenze = -0.15, toleranz = () => 0.03) {
  // schritt in Planeinheiten. loch: innerer Bereich, der ausgelassen wird (für den äußeren Ring).
  const nx = Math.ceil((x1 - x0) / schritt), ny = Math.ceil((y1 - y0) / schritt);
  const H = new Float32Array((nx + 1) * (ny + 1));
  const T = new Array((nx + 1) * (ny + 1));
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      const px = x0 + i * schritt, py = y0 + j * schritt;
      if (loch && px > loch.x0 + schritt && px < loch.x1 - schritt && py > loch.y0 + schritt && py < loch.y1 - schritt) {
        H[j * (nx + 1) + i] = NaN;
        continue;
      }
      const p = punkt(px, py, stufe, region);
      H[j * (nx + 1) + i] = p.h;
      T[j * (nx + 1) + i] = p.typ === 'wasser' ? 'watt' : p.typ;
    }
  }
  // Ebene Flächen gleicher Art zusammenfassen; die Toleranz wächst mit dem Abstand zum Hafen
  const dreiecke = vereinfacheRaster(H, T, nx, ny, {
    unten: unterGrenze,
    toleranz: (i, j, n) => toleranz(x0 + i * schritt, y0 + j * schritt, n * schritt),
  });
  const farben = {};
  for (const [k, v] of Object.entries(region.farben)) farben[k] = new THREE.Color(v);
  // Nur benutzte Rasterpunkte als Ecken, geteilt zwischen Dreiecken (flatShading braucht keine eigenen Normalen)
  const neu = new Int32Array(H.length).fill(-1);
  const pos = [], col = [], index = [], typen = [], streuung = [];
  const c = new THREE.Color();
  for (const k of dreiecke) {
    if (neu[k] < 0) {
      neu[k] = pos.length / 3;
      const i = k % (nx + 1), j = (k - i) / (nx + 1);
      const x = (x0 + i * schritt) * U, z = -(y0 + j * schritt) * U;
      pos.push(x, H[k] - absenken, z);
      c.copy(farben[T[k]] || farben.sand);
      // leichte Farbstreuung, damit große Flächen nicht tot wirken
      const streu = 0.97 + 0.05 * rauschen(x / 6, z / 6, 77);
      c.multiplyScalar(streu);
      col.push(c.r, c.g, c.b);
      typen.push(T[k]); streuung.push(streu);
    }
    index.push(neu[k]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  // Für die Jahreszeit: Bodenart und Streuung je Ecke (faerbeBoden)
  geo.userData.typen = typen;
  geo.userData.streuung = streuung;
  return geo;
}

/** Färbt die Ecken eines Geländenetzes für die Jahreszeit um (nur Felder, Wiesen, Wald, Heide, Dorf). */
function faerbeBoden(geo, region, jahreszeit) {
  const { typen, streuung } = geo.userData;
  if (!typen) return;
  const col = geo.attributes.color, c = new THREE.Color();
  const tab = JAHRESZEIT_FARBEN[jahreszeit] || {};
  const cache = {};
  let geaendert = false;
  for (let i = 0; i < typen.length; i++) {
    const t = typen[i];
    if (!JAHRESZEIT_TYPEN.has(t) || !(t in region.farben)) continue;
    const hex = tab[t] || region.farben[t];
    c.set(cache[t] ??= hex).multiplyScalar(streuung[i]);
    col.setXYZ(i, c.r, c.g, c.b);
    geaendert = true;
  }
  if (geaendert) col.needsUpdate = true;
}

// ------------------------------------------------------------------ Hilfen für Instanzen

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();

// Viele gleiche Dinge (Bäume, Steine, Pfähle) werden einmal beim Bau zu einem festen Netz
// gebacken. Das kostet etwas mehr Speicher als InstancedMesh, ist aber beim Zeichnen deutlich
// schneller: Tausende Instanzen waren der größte Posten der Bildzeit.
function instanzen(geo, mat, liste, name) {
  const P = geo.attributes.position, idx = geo.index.array, nv = P.count;
  const pos = new Float32Array(liste.length * nv * 3);
  const col = new Float32Array(liste.length * nv * 3);
  const ind = new (liste.length * nv > 65535 ? Uint32Array : Uint16Array)(liste.length * idx.length);
  const c = new THREE.Color(), v = new THREE.Vector3();
  liste.forEach((it, k) => {
    _e.set(it.kx || 0, it.rot || 0, it.kz || 0);
    _q.setFromEuler(_e);
    _p.set(it.x, it.y, it.z);
    _s.set(it.sx ?? it.s, it.sy ?? it.s, it.sz ?? it.s);
    _m.compose(_p, _q, _s);
    c.set(it.farbe || '#ffffff');
    for (let i = 0; i < nv; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(_m);
      const o = (k * nv + i) * 3;
      pos[o] = v.x; pos[o + 1] = v.y; pos[o + 2] = v.z;
      col[o] = c.r; col[o + 1] = c.g; col[o + 2] = c.b;
    }
    for (let i = 0; i < idx.length; i++) ind[k * idx.length + i] = idx[i] + k * nv;
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setIndex(new THREE.BufferAttribute(ind, 1));
  out.computeVertexNormals();
  out.computeBoundingSphere();
  geo.dispose();
  mat.vertexColors = true;
  const mesh = new THREE.Mesh(out, mat);
  mesh.name = name;
  mesh.userData.anzahl = liste.length;
  return mesh;
}

/**
 * Fasst Geometrien zu einer zusammen, mit Index und geteilten Ecken (gleiche Position = eine Ecke).
 * Bei flatShading kommt die Flächennormale aus dem Shader, also braucht keine Fläche eigene Ecken.
 * Spart bei Instanzen viel Arbeit: ein Dodekaeder hat 20 statt 108 Ecken.
 */
export function verschmelze(geos) {
  const pos = [], index = [], karte = new Map();
  const v = new THREE.Vector3();
  for (const g of geos) {
    const p = g.attributes.position;
    const n = g.index ? g.index.count : p.count;
    for (let k = 0; k < n; k++) {
      v.fromBufferAttribute(p, g.index ? g.index.getX(k) : k);
      const schluessel = `${Math.round(v.x * 1000)},${Math.round(v.y * 1000)},${Math.round(v.z * 1000)}`;
      let i = karte.get(schluessel);
      if (i === undefined) { i = pos.length / 3; karte.set(schluessel, i); pos.push(v.x, v.y, v.z); }
      index.push(i);
    }
  }
  // Dreiecke, die durch das Zusammenlegen keine Fläche mehr haben (Kegelspitzen), fallen weg
  const ohne = [];
  for (let k = 0; k < index.length; k += 3) {
    const [a, b, c] = [index[k], index[k + 1], index[k + 2]];
    if (a !== b && b !== c && a !== c) ohne.push(a, b, c);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setIndex(ohne);
  out.computeVertexNormals();
  return out;
}

const blockstein = () => verschmelze([new THREE.IcosahedronGeometry(1, 0)]);   // 20 statt 36 Dreiecke, für die vielen Molensteine

// Pflanzen, Felsen, Dorf und Höfe setzt bewuchs.js (setzeBewuchs).

// ------------------------------------------------------------------ Molen, Kaimauern, Buhnen

function baueMolen(region, stufe, gruppe, schatten) {
  const plus = region.gelaende.landPlus || 0;
  const rnd = zufall(99 + stufe);
  const steine = [];
  const krone = [], kerne = [];
  const mKern = new THREE.MeshLambertMaterial({ color: region.farben.mole, flatShading: true });
  const mWeg = new THREE.MeshLambertMaterial({ color: region.farben.pflaster, flatShading: true });
  for (const m of molen(stufe)) {
    const pts = m.punkte.map(([x, y]) => new THREE.Vector3(x * U, 0, -y * U));
    const w = m.breite * U;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const len = a.distanceTo(b);
      const ang = Math.atan2(b.x - a.x, b.z - a.z);
      // Kern: Schüttung mit schrägen Seiten (Trapez)
      // Vier Seiten mit 45 Grad Versatz: Halbbreite oben 0,32 w, unten 0,42 w
      const kern = new THREE.CylinderGeometry(w * 0.45, w * 0.6, 2.6 + 2 * plus, 4, 1, false, Math.PI / 4);
      kern.scale(1, 1, (len / 2 + w * 0.05) / (w * 0.32));
      const mk = new THREE.Mesh(kern, mKern);
      mk.position.set((a.x + b.x) / 2, 0.1, (a.z + b.z) / 2);
      mk.rotation.y = ang;
      mk.castShadow = schatten; mk.receiveShadow = schatten;
      kerne.push(mk);
      const weg = new THREE.Mesh(new THREE.BoxGeometry(w * 0.36, 0.1, len + w * 0.2), mWeg);
      weg.position.set((a.x + b.x) / 2, 1.42 + plus, (a.z + b.z) / 2);
      weg.rotation.y = ang;
      weg.receiveShadow = schatten;
      krone.push(weg);
      // Unregelmäßiger Rand aus einzelnen Blöcken auf beiden Seiten
      const n = Math.ceil(len / 1.3);
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        for (const seite of [-1, 1]) {
          const off = seite * (w * (0.42 + rnd() * 0.12));
          const s = 0.7 + rnd() * 0.7;
          steine.push({
            x: a.x + (b.x - a.x) * t + Math.cos(ang) * off,
            y: 0.2 + plus + rnd() * 0.5,
            z: a.z + (b.z - a.z) * t - Math.sin(ang) * off,
            s, sy: s * 0.7, rot: rnd() * 6.3, kx: rnd() * 0.5,
            farbe: rnd() < 0.5 ? region.farben.mole : region.farben.steinschuettung,
          });
        }
      }
    }
    // Gelenke an Knicken
    for (let i = 1; i < pts.length - 1; i++) {
      const gm = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.34, w * 0.45, 2.6 + 2 * plus, 8), mKern);
      gm.position.set(pts[i].x, 0.1, pts[i].z);
      kerne.push(gm);
      const gw = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.18, w * 0.18, 0.1, 8), mWeg);
      gw.position.set(pts[i].x, 1.42 + plus, pts[i].z);
      krone.push(gw);
    }
    // Breiter, runder Molenkopf
    const kopf = pts[pts.length - 1];
    const kg = new THREE.CylinderGeometry(w * 0.62, w * 0.85, 2.6 + 2 * plus, 9);
    const km = new THREE.Mesh(kg, mKern);
    km.position.set(kopf.x, 0.1, kopf.z);
    km.castShadow = schatten; km.receiveShadow = schatten;
    kerne.push(km);
    const kw = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.42, w * 0.42, 0.1, 12), mWeg);
    kw.position.set(kopf.x, 1.42 + plus, kopf.z);
    krone.push(kw);
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2, r = w * (0.8 + rnd() * 0.15), s = 0.8 + rnd() * 0.6;
      steine.push({ x: kopf.x + Math.cos(a) * r, y: 0.2 + plus + rnd() * 0.4, z: kopf.z + Math.sin(a) * r, s, sy: s * 0.7, rot: rnd() * 6.3, farbe: region.farben.steinschuettung });
    }
  }
  // Alle Teile zu je einem Netz backen: zwei Zeichenaufrufe statt mehrerer Dutzend
  const backe = (liste, mat, name) => {
    if (!liste.length) return;
    const geos = liste.map((o) => { o.updateMatrix(); return o.geometry.applyMatrix4(o.matrix); });
    const mesh = new THREE.Mesh(verschmelze(geos), mat);
    geos.forEach((g) => g.dispose());
    mesh.name = name;
    mesh.castShadow = schatten; mesh.receiveShadow = schatten;
    gruppe.add(mesh);
  };
  backe(kerne, mKern, 'molen');
  backe(krone, mWeg, 'molenwege');
  if (steine.length) {
    const st = instanzen(blockstein(), new THREE.MeshLambertMaterial({ flatShading: true }), steine, 'molensteine');
    st.castShadow = schatten;
    gruppe.add(st);
  }
}

function baueKaimauern(region, stufe, gruppe, schatten) {
  const plus = region.gelaende.landPlus || 0;
  // Senkrechte Kanten, wo das Gelände sonst schräg ins Wasser liefe
  const mauern = [];
  if (stufe >= 3) {
    // Promenade am See, mit Lücke für die Slipanlage
    mauern.push({ x0: -150, x1: SLIP.x0, y: 6, nach: 1, hoehe: 1.2 });
    mauern.push({ x0: SLIP.x1, x1: 202, y: 6, nach: 1, hoehe: 1.2 });
    mauern.push({ xKante: DURCHSTICH[0], y0: 196, y1: 228, nach: 1, hoehe: 1.0 });                    // Durchstich West
    mauern.push({ xKante: DURCHSTICH[1], y0: 196, y1: 228, nach: -1, hoehe: 1.0 });                   // Durchstich Ost
  }
  if (stufe >= 5) mauern.push({ x0: 2, x1: 150, y: 229, nach: 1, hoehe: 1.3 });                        // Kai im Außenhafen
  const mWand = new THREE.MeshLambertMaterial({ color: region.farben.steinschuettung, flatShading: true });
  const mTop = new THREE.MeshLambertMaterial({ color: region.farben.pflaster, flatShading: true });
  const tiefe = 3.0;   // Meter, so breit greift die Mauer unter das Land
  for (const m of mauern) {
    let geo, x, z;
    if (m.xKante != null) {
      const len = (m.y1 - m.y0) * U;
      geo = new THREE.BoxGeometry(tiefe, m.hoehe + 2.5 + plus, len);
      x = m.xKante * U - m.nach * tiefe / 2;
      z = -((m.y0 + m.y1) / 2) * U;
    } else {
      const len = (m.x1 - m.x0) * U;
      geo = new THREE.BoxGeometry(len, m.hoehe + 2.5 + plus, tiefe);
      x = ((m.x0 + m.x1) / 2) * U;
      z = -m.y * U + m.nach * tiefe / 2;
    }
    const mesh = new THREE.Mesh(geo, [mWand, mWand, mTop, mWand, mWand, mWand]);
    mesh.position.set(x, m.hoehe + plus + 0.02 - (m.hoehe + 2.5 + plus) / 2, z);
    mesh.receiveShadow = schatten;
    gruppe.add(mesh);
  }
}

// ------------------------------------------------------------------ Leuchttürme der Geländeform

function baueLeuchttuerme(region, stufe, gruppe, schatten) {
  const feuer = [];
  const mWeiss = new THREE.MeshLambertMaterial({ color: '#f4f1ea', flatShading: true });
  const mRot = new THREE.MeshLambertMaterial({ color: '#c8524a', flatShading: true });
  const mDunkel = new THREE.MeshLambertMaterial({ color: '#3e4a52', flatShading: true });
  const mGlas = new THREE.MeshBasicMaterial({ color: '#fff3c4' });
  for (const [px, py] of leuchttuerme()) {
    const boden = Math.max(0.3, punkt(px, py, stufe, region).h);
    const turm = new THREE.Group();
    turm.name = 'leuchtturm';
    // Sockel, Turm in roten und weißen Bändern, Galerie, Laterne, Haube
    const sockel = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.0, 1.2, 8), mWeiss);
    sockel.position.y = 0.2;
    turm.add(sockel);
    const hoehe = 14, baender = 5;
    for (let i = 0; i < baender; i++) {
      const r0 = 2.1 - (i / baender) * 0.7, r1 = 2.1 - ((i + 1) / baender) * 0.7;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, hoehe / baender, 10), i % 2 ? mWeiss : mRot);
      band.position.y = 0.8 + (i + 0.5) * (hoehe / baender);
      band.castShadow = schatten;
      turm.add(band);
    }
    const galerie = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 0.25, 10), mDunkel);
    galerie.position.y = 0.8 + hoehe + 0.1;
    const laterne = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.4, 8), mGlas);
    laterne.position.y = 0.8 + hoehe + 0.95;
    const haube = new THREE.Mesh(new THREE.ConeGeometry(1.15, 1.1, 8), mRot);
    haube.position.y = 0.8 + hoehe + 2.2;
    turm.add(galerie, laterne, haube);
    turm.position.set(px * U, boden - 0.3, -py * U);
    turm.userData.pick = { type: 'leuchtturm' };
    gruppe.add(turm);
    const licht = erzeugeLeuchtfeuer({ farbe: '#fff1b0', kennung: 'Fl', periode: 6, groesse: 10 });
    licht.position.set(px * U, boden - 0.3 + 0.8 + hoehe + 0.95, -py * U);
    gruppe.add(licht);
    feuer.push(licht);
  }
  return feuer;
}

function baueBuhnen(region, stufe, gruppe) {
  const pfaehle = [];
  const rnd = zufall(5);
  for (const linie of buhnen(stufe)) {
    const [[ax, ay], [bx, by]] = linie;
    const n = 22;
    for (let k = 0; k < n; k++) {
      const t = k / (n - 1);
      const px = ax + (bx - ax) * t, py = ay + (by - ay) * t;
      const p = punkt(px, py, stufe, region);
      const top = Math.max(p.h, 0) + 0.7 - t * 0.5 + rnd() * 0.15;
      pfaehle.push({ x: px * U, y: p.h - 0.3, z: -py * U, s: 1, sx: 0.32, sz: 0.32, sy: top - p.h + 0.3, farbe: '#9a8470' });
    }
  }
  // Pricken: Reisigbesen auf Stangen markieren die Rinne durch das Seegatt (Stufe 1 und 2)
  const besen = [];
  for (const [px, py] of pricken(stufe)) {
    const p = punkt(px, py, stufe, region);
    const top = 1.9 + rnd() * 0.3;
    pfaehle.push({ x: px * U, y: p.h - 0.2, z: -py * U, s: 1, sx: 0.16, sz: 0.16, sy: top - p.h + 0.2, farbe: '#6f5a46' });
    besen.push({ x: px * U, y: top - 0.15, z: -py * U, s: 1, sx: 0.7, sz: 0.7, sy: 0.9, rot: rnd() * 6.3, farbe: '#5e4a38' });
  }
  if (!pfaehle.length) return;
  const geo = new THREE.CylinderGeometry(0.5, 0.5, 1, 5).translate(0, 0.5, 0);
  gruppe.add(instanzen(geo, new THREE.MeshLambertMaterial({ flatShading: true }), pfaehle, 'buhnen'));
  if (besen.length) {
    const kegel = new THREE.ConeGeometry(0.5, 1, 5, 1, true).translate(0, 0.5, 0);
    gruppe.add(instanzen(kegel, new THREE.MeshLambertMaterial({ flatShading: true, side: THREE.DoubleSide }), besen, 'pricken'));
  }
}

// ------------------------------------------------------------------ Schatten ohne Schattenkarte

// Ein festes Netz für alle Baumschatten. Richtung und Länge kommen als Uniform in den
// Vertex-Shader, so kostet ein Sonnenstand-Wechsel nichts.
const SCHATTEN_VERTEX = /* glsl */ `
  attribute vec3 mitte;
  attribute vec2 groesse;   // Baumhöhe, Kronenbreite
  uniform vec2 uRichtung;   // cos, sin des Winkels um die Hochachse
  uniform float uLaenge;
  void main() {
    float sx = max(groesse.y * 0.8, groesse.x * uLaenge * 0.55);
    vec2 l = vec2(position.x * sx, position.z * groesse.y * 0.75);
    vec3 w = mitte + vec3(uRichtung.x * l.x + uRichtung.y * l.y, 0.0, -uRichtung.y * l.x + uRichtung.x * l.y);
    gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
  }
`;
const SCHATTEN_FRAGMENT = /* glsl */ `
  uniform vec3 uFarbe;
  uniform float uDeckung;
  void main() {
    gl_FragColor = vec4(uFarbe, uDeckung);
    #include <colorspace_fragment>
  }
`;

function baueFlachSchatten(liste) {
  const kreis = new THREE.CircleGeometry(1, 6);
  kreis.rotateX(-Math.PI / 2);
  kreis.translate(0.5, 0, 0);   // Schatten beginnt am Stamm und läuft in eine Richtung
  const P = kreis.attributes.position, idx = kreis.index.array, nv = P.count;
  const pos = new Float32Array(liste.length * nv * 3), mitte = new Float32Array(liste.length * nv * 3), gr = new Float32Array(liste.length * nv * 2);
  const ind = new Uint32Array(liste.length * idx.length);
  liste.forEach((b, k) => {
    const h = (b.sy || b.s) * 2;
    for (let i = 0; i < nv; i++) {
      const o = k * nv + i;
      pos[o * 3] = P.getX(i); pos[o * 3 + 1] = 0; pos[o * 3 + 2] = P.getZ(i);
      mitte[o * 3] = b.x; mitte[o * 3 + 1] = b.y + 0.15; mitte[o * 3 + 2] = b.z;
      gr[o * 2] = h; gr[o * 2 + 1] = b.s;
    }
    for (let i = 0; i < idx.length; i++) ind[k * idx.length + i] = idx[i] + k * nv;
  });
  kreis.dispose();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('mitte', new THREE.BufferAttribute(mitte, 3));
  geo.setAttribute('groesse', new THREE.BufferAttribute(gr, 2));
  geo.setIndex(new THREE.BufferAttribute(ind, 1));
  const uniforms = {
    uRichtung: { value: new THREE.Vector2(1, 0) },
    uLaenge: { value: 1 },
    uFarbe: { value: new THREE.Color('#1f3a4a') },
    uDeckung: { value: 0.16 },
  };
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: SCHATTEN_VERTEX, fragmentShader: SCHATTEN_FRAGMENT, transparent: true, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'baumschatten';
  mesh.renderOrder = 1;
  mesh.frustumCulled = false;
  mesh.userData.anzahl = liste.length;
  mesh.userData.aktualisiere = (richtung, laenge, nacht) => {
    const ang = Math.atan2(-richtung.y, richtung.x);
    uniforms.uRichtung.value.set(Math.cos(ang), Math.sin(ang));
    uniforms.uLaenge.value = laenge;
    uniforms.uDeckung.value = 0.16 * (1 - 0.75 * nacht);
  };
  return mesh;
}

// ------------------------------------------------------------------ Gesamtes Gelände

// Wie genau das Gelände sein muss: am Hafen fast exakt (3 cm), mit dem Abstand gröber.
// Hügel weit draußen sieht man nur klein, dort reichen große, flache Dreiecke.
const HAFEN_KERN = { x0: -170, x1: 230, y0: -60, y1: 320 };
function toleranzNach(px, py) {
  const d = Math.max(HAFEN_KERN.x0 - px, px - HAFEN_KERN.x1, HAFEN_KERN.y0 - py, py - HAFEN_KERN.y1, 0);
  return Math.min(1.2, 0.03 + 0.35 * Math.max(0, d - 30) / 100);
}

/**
 * Baut das Gelände für eine Stufe und Region.
 * @returns {{gruppe: THREE.Group, aktualisiereSchatten: Function, entsorge: Function}}
 */
export function baueGelaende(region, stufe, qualitaet, { tiefsterPegel = 0 } = {}) {
  const q = QUALITAET[qualitaet] || QUALITAET.mittel;
  const gruppe = new THREE.Group();
  gruppe.name = 'gelaende';

  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const innen = new THREE.Mesh(baueNetz(region, stufe, BEREICH.x0, BEREICH.x1, BEREICH.y0, BEREICH.y1, q.raster / U, null, 0, -0.15 + Math.min(0, tiefsterPegel), toleranzNach), mat);
  innen.name = 'gelaende-innen';
  innen.receiveShadow = q.schatten;
  gruppe.add(innen);
  const s2 = q.aussen / U;
  const aussen = new THREE.Mesh(baueNetz(region, stufe, -1600, 1600, -1600, 470, s2, BEREICH, 0.05, -0.15 + Math.min(0, tiefsterPegel), toleranzNach), mat);
  aussen.name = 'gelaende-aussen';
  gruppe.add(aussen);

  baueMolen(region, stufe, gruppe, q.schatten);
  baueKaimauern(region, stufe, gruppe, q.schatten);
  baueBuhnen(region, stufe, gruppe);
  const feuer = baueLeuchttuerme(region, stufe, gruppe, q.schatten);
  const bewuchs = setzeBewuchs(region, stufe, q, gruppe, q.schatten);
  const { baeume } = bewuchs;

  let flach = null;
  if (!q.schatten) {
    flach = baueFlachSchatten(baeume.filter((b) => !b.fern));
    gruppe.add(flach);
  }

  return {
    gruppe,
    /** Leuchtfeuer der Leuchttürme blinken lassen (jedes Bild). */
    aktualisiereFeuer(zeit, nacht) { for (const f of feuer) f.userData.aktualisiere(zeit, nacht); },
    /** Felder, Wiesen und Laub für die Jahreszeit färben ('fruehling' | 'sommer' | 'herbst' | 'winter'). */
    setzeJahreszeit(jahreszeit) {
      faerbeBoden(innen.geometry, region, jahreszeit);
      faerbeBoden(aussen.geometry, region, jahreszeit);
      bewuchs.faerbe(jahreszeit);
    },
    /** Jedes Bild: Mühlenflügel drehen. */
    aktualisiere(dt) { bewuchs.aktualisiere(dt); },
    aktualisiereSchatten(richtung, laenge, nacht) {
      if (flach) flach.userData.aktualisiere(richtung, laenge, nacht);
    },
    entsorge() {
      gruppe.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      });
    },
  };
}
