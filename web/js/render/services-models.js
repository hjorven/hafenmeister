// 3D-Modelle der Services und Sonderanlagen im Flat-Stil: einfache Koerper, flache Farben, keine Texturen.
// Jedes Modell ist eine Funktion (stufe) => { group, update(dt, t) }.
// Lokale Achsen in Metern: x nach Osten, z nach Sueden, y nach oben. Die Wasserseite ist -z (Norden),
// der Ursprung liegt am Ankerpunkt aus js/data/services.js (lage). Land liegt bei y = LAND_Y.
// Vorbilder (docs/vorbilder.md): Kreuzfahrtkai mit langer weisser Halle (Warnemuende, Skagen),
// Marine mit breiten Betonpiers und Backsteinbau (Kiel), Museumshafen vor Speichern (Ebeltoft),
// Werft mit grosser Halle am Becken (Heiligenhafen, Marstal), Seenotretter am eigenen Steg (Laboe).
import * as THREE from 'three';
import { HAFEN } from '../data/harbor.js';

export const LAND_Y = 0.3;
const U = 0.62;                       // Meter je Planeinheit

// Farben wie in skripte/konzeptbilder/hafen_von_oben.py
export const FARBE = {
  wood: '#e2b67e', wood2: '#c49866', white: '#fffcf6', navy: '#2e4868', red: '#ee6454', yellow: '#fad060',
  green: '#509e80', coral: '#f2745c', grey: '#52647a', glass: '#3e5e7a', teak: '#d6aa78', orange: '#f0883e',
  ink: '#283648', pave: '#eeeae0', road: '#e2ded6', rock: '#92a4b0', pile: '#5c5460', pont: '#d6dee6',
  brick: '#b8604c', rosa: '#f2a7b4', mint: '#9ed8c4', creme: '#f6e6c4', brot: '#c98a4a', steel: '#8a98a8', navyGrey: '#7c8894', blue: '#4878c0', sail: '#f6f2ea', smoke: '#e8e4de',
};

// ------------------------------------------------------------------ Bausteine
const matCache = new Map();
export function mat(c) {
  if (!matCache.has(c)) matCache.set(c, new THREE.MeshLambertMaterial({ color: c, flatShading: true }));
  return matCache.get(c);
}

// Planeinheiten relativ zum Anker -> lokale Meter [x, z]
const P = (dx, dy) => [dx * U, -dy * U];

function add(parent, geo, c, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat(c));
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

// Quader, y = Unterkante
export function box(g, w, h, d, c, x = 0, y = 0, z = 0, ry = 0) {
  const m = add(g, new THREE.BoxGeometry(w, h, d), c, x, y + h / 2, z);
  m.rotation.y = ry;
  return m;
}

// Satteldach: First entlang x, Breite d, Hoehe h, Laenge w, y = Traufe
function gable(g, w, h, d, c, x = 0, y = 0, z = 0, ry = 0) {
  const s = new THREE.Shape([new THREE.Vector2(-d / 2 - 0.25, 0), new THREE.Vector2(d / 2 + 0.25, 0), new THREE.Vector2(0, h)]);
  const geo = new THREE.ExtrudeGeometry(s, { depth: w + 0.4, bevelEnabled: false });
  geo.translate(0, 0, -(w + 0.4) / 2);
  geo.rotateY(Math.PI / 2);
  const m = add(g, geo, c, x, y, z);
  m.rotation.y = ry;
  return m;
}

// Haus mit Satteldach
function haus(g, w, h, d, wand, dach, x = 0, z = 0, ry = 0, dachH = null) {
  const o = new THREE.Group();
  o.position.set(x, LAND_Y, z);
  o.rotation.y = ry;
  box(o, w, h, d, wand);
  gable(o, w, dachH ?? d * 0.45, d, dach, 0, h, 0);
  // Fensterband zur Wasserseite
  const n = Math.max(1, Math.floor(w / 2.2));
  for (let i = 0; i < n; i++) box(o, 0.9, 0.9, 0.06, FARBE.glass, -w / 2 + (i + 0.5) * (w / n), h * 0.45, -d / 2 - 0.03);
  // Tuer zur Landseite (Sueden, Weg und Strasse)
  box(o, 1.1, Math.min(2.1, h * 0.75), 0.08, FARBE.ink, 0, 0, d / 2 + 0.04);
  g.add(o);
  return o;
}

export function zyl(g, r, h, c, x = 0, y = 0, z = 0, seg = 8, r2 = r) {
  return add(g, new THREE.CylinderGeometry(r, r2, h, seg), c, x, y + h / 2, z);
}

function pfahl(g, x, z, h = 2.2, c = FARBE.pile) {
  return zyl(g, 0.16, h, c, x, -1.2, z, 6);
}

// Flagge an einem Mast, gibt die Flagge zurueck (fuer das Wehen)
export function flagge(g, x, z, h, c, y0 = LAND_Y) {
  zyl(g, 0.07, h, FARBE.white, x, y0, z, 5);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1.6, -0.4, 0, 0, -0.8, 0], 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide }));
  m.position.set(x, y0 + h, z);
  g.add(m);
  return m;
}

// Kleiner Bootsrumpf, Bug nach +x, y = Wasserlinie
export function rumpf(g, len, breite, hoehe, c, x = 0, y = 0, z = 0, ry = 0, deck = FARBE.white) {
  const o = new THREE.Group();
  const s = new THREE.Shape();
  s.moveTo(-len / 2, -breite / 2);
  s.lineTo(len * 0.18, -breite / 2);
  s.quadraticCurveTo(len * 0.45, -breite * 0.4, len / 2, 0);
  s.quadraticCurveTo(len * 0.45, breite * 0.4, len * 0.18, breite / 2);
  s.lineTo(-len / 2, breite / 2);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: hoehe, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  add(o, geo, c, 0, -hoehe * 0.35, 0);
  const geo2 = new THREE.ShapeGeometry(s);
  geo2.rotateX(-Math.PI / 2);
  geo2.scale(0.86, 1, 0.8);
  add(o, geo2, deck, 0, hoehe * 0.65 + 0.01, 0);
  o.position.set(x, y, z);
  o.rotation.y = ry;
  g.add(o);
  return o;
}

// Ebene Flaeche auf dem Boden (Pflaster, Beton), y knapp ueber Land
function flaeche(g, w, d, c, x = 0, z = 0, y = LAND_Y + 0.02) {
  return box(g, w, 0.04, d, c, x, y - 0.02, z);
}

// Steg auf Pfaehlen, von (x0,z0) nach (x1,z1)
function steg(g, x0, z0, x1, z1, breite, c = FARBE.wood, hoehe = 0.6) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const o = new THREE.Group();
  o.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
  o.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
  box(o, len, 0.3, breite, c, 0, hoehe - 0.15, 0);
  const n = Math.max(2, Math.round(len / 4));
  for (let i = 0; i <= n; i++) for (const s of [-1, 1]) pfahl(o, -len / 2 + (i * len) / n, s * (breite / 2 - 0.1), hoehe + 1.2);
  g.add(o);
  return o;
}

function poller(g, x, z, y = LAND_Y) {
  zyl(g, 0.22, 0.5, FARBE.ink, x, y, z, 8, 0.28);
}

function baum(g, x, z, r = 2.2) {
  zyl(g, 0.2, 1.4, FARBE.wood2, x, LAND_Y, z, 5);
  const k = add(g, new THREE.IcosahedronGeometry(r, 0), FARBE.green, x, LAND_Y + 1.4 + r * 0.8, z);
  k.scale.y = 0.85;
}

// Rauch, der aufsteigt und vergeht
function rauch(g, x, y, z, menge = 5) {
  const teile = [];
  const huelle = new THREE.Group();
  huelle.userData.land = true;           // wird mit dem Haus auf den Boden gehoben
  g.add(huelle);
  for (let i = 0; i < menge; i++) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 0),
      new THREE.MeshLambertMaterial({ color: FARBE.smoke, transparent: true, opacity: 0.8 }));
    huelle.add(m);
    teile.push(m);
  }
  return (t) => {
    teile.forEach((m, i) => {
      const p = (t * 0.25 + i / menge) % 1;
      m.position.set(x + p * 1.6 + Math.sin(t + i) * 0.2, y + p * 5, z - p * 0.6);
      m.scale.setScalar(0.5 + p * 1.8);
      m.material.opacity = 0.75 * (1 - p);
    });
  };
}

const wehen = (fl, t, k = 0) => { if (fl) fl.rotation.y = Math.sin(t * 2.2 + k) * 0.35; };

// ------------------------------------------------------------------ Modelle

function bootsverleih(stufe, { ufer = 14 } = {}) {
  const see = -(ufer + 12);            // Mitte der Kreise auf dem See
  const g = new THREE.Group();
  haus(g, 4.2, 2.6, 3, FARBE.wood, FARBE.coral);
  box(g, 2.6, 1.1, 0.5, FARBE.white, 0, LAND_Y, -1.8);             // Tresen
  const fl = flagge(g, 2.8, -1.2, 4.5, FARBE.red);
  const farben = [FARBE.yellow, FARBE.red, FARBE.green, FARBE.white];
  // Ruderboote am Strand, Bug zum Wasser
  for (let i = 0; i < 3; i++) rumpf(g, 3.2, 1.3, 0.5, farben[i], -3 + i * 2.2, LAND_Y + 0.2, -4.5, Math.PI / 2, FARBE.wood);
  const leih = [];
  if (stufe >= 2) {
    // Tretboote auf dem Wasser
    for (let i = 0; i < 2; i++) leih.push(rumpf(g, 2.4, 1.6, 0.6, farben[i + 1], 0, 0, see, 0, FARBE.white));
  }
  if (stufe >= 3) {
    // Jolle mit Segel
    const j = rumpf(g, 4.2, 1.6, 0.5, FARBE.white, 0, 0, see - 4);
    zyl(j, 0.06, 5, FARBE.white, 0.6, 0.3, 0, 4);
    const s = new THREE.Shape([new THREE.Vector2(0, 0.5), new THREE.Vector2(-2.2, 0.5), new THREE.Vector2(0, 5)]);
    const sm = add(j, new THREE.ShapeGeometry(s), FARBE.sail, 0.6, 0.3, 0);
    sm.material = new THREE.MeshLambertMaterial({ color: FARBE.sail, side: THREE.DoubleSide });
    leih.push(j);
  }
  return {
    group: g,
    update(dt, t) {
      wehen(fl, t);
      leih.forEach((b, i) => {
        const r = 7 + i * 4, w = 0.12 / (1 + i * 0.3), a = t * w + i * 2;
        b.position.set(Math.cos(a) * r, Math.sin(t * 1.3 + i) * 0.05, see - i * 3 + Math.sin(a) * r * 0.5);
        b.rotation.y = -a - Math.PI / 2;
      });
    },
  };
}

function slip(stufe, { boden = LAND_Y } = {}) {
  const g = new THREE.Group();
  // Die Rampe selbst gehoert zur Landschaft (js/render/landschaft/gelaende.js, Slipanlage bei x -127).
  // Hier stehen Trailer, Winde und ab Stufe 2 der Trailerparkplatz.
  const oben = Math.max(LAND_Y, Math.min(boden, 3));
  // Trailer mit Boot
  const tr = new THREE.Group();
  box(tr, 0.15, 0.15, 5, FARBE.steel, -0.7, 0.45, 0);
  box(tr, 0.15, 0.15, 5, FARBE.steel, 0.7, 0.45, 0);
  for (const s of [-0.9, 0.9]) { const w = zyl(tr, 0.35, 0.25, FARBE.ink, s, 0.35, 0.8, 10); w.rotation.z = Math.PI / 2; }
  rumpf(tr, 5, 2, 0.8, FARBE.navy, 0, 0.9, 0, Math.PI / 2);
  tr.position.set(0, oben, 7);
  tr.userData.fest = true;
  g.add(tr);
  zyl(g, 0.2, 1.2, FARBE.yellow, 2.8, LAND_Y, 4, 6);                 // Winde
  if (stufe >= 2) {
    flaeche(g, 14, 10, FARBE.road, 10, 10);
    for (let i = 0; i < 4; i++) box(g, 0.1, 0.02, 4.5, FARBE.white, 4 + i * 3.4, LAND_Y + 0.02, 10);
    rumpf(g, 4.5, 1.8, 0.8, FARBE.white, 5.7, LAND_Y + 0.9, 10, Math.PI / 2);
    rumpf(g, 4, 1.7, 0.8, FARBE.red, 12.5, LAND_Y + 0.9, 10, Math.PI / 2);
  }
  let k = 0;
  return {
    group: g,
    update(dt, t) {
      // Der Trailer rollt langsam hinunter und wieder hoch
      k = (Math.sin(t * 0.25) + 1) / 2;
      tr.position.z = 7 - k * 1.5;
    },
  };
}

function raeucherei(stufe) {
  const g = new THREE.Group();
  haus(g, 5, 2.6, 4, FARBE.brick, FARBE.ink);
  box(g, 0.9, 2.2, 0.9, FARBE.brick, 1.6, LAND_Y + 3.6, 0.6);        // Schornstein
  const r = rauch(g, 1.6, LAND_Y + 6, 0.6);
  // Fischbude mit Markise
  box(g, 2.6, 1.1, 1.4, FARBE.white, -4, LAND_Y, -1.2);
  for (let i = 0; i < 4; i++) box(g, 0.65, 0.12, 1.6, i % 2 ? FARBE.white : FARBE.navy, -4.98 + i * 0.65, LAND_Y + 2.1, -1.3);
  zyl(g, 0.05, 2.1, FARBE.white, -5.2, LAND_Y, -2, 4);
  zyl(g, 0.05, 2.1, FARBE.white, -2.8, LAND_Y, -2, 4);
  // Biertischgarnitur
  box(g, 2, 0.75, 0.7, FARBE.wood, 0, LAND_Y, -4.2);
  if (stufe >= 2) {
    haus(g, 4, 2.4, 3.5, FARBE.white, FARBE.navy, 6, 0.4);
    box(g, 2, 0.75, 0.7, FARBE.wood, 3, LAND_Y, -4.6);
    box(g, 2, 0.75, 0.7, FARBE.wood, -3, LAND_Y, -5);
  }
  return { group: g, update: (dt, t) => r(t) };
}

function fischhalle(stufe) {
  const g = new THREE.Group();
  // Lange Halle, Wasserseite zum Fischereikai (dreh 180 setzt -z nach Sueden)
  haus(g, 12, 4, 7, FARBE.white, FARBE.grey);
  box(g, 3, 2.6, 0.1, FARBE.navy, -3, LAND_Y, -3.55);                // Tor
  box(g, 3, 2.6, 0.1, FARBE.navy, 3, LAND_Y, -3.55);
  // Fisch als Schild auf dem Dach
  const f = new THREE.Shape();
  f.moveTo(-1.2, 0); f.quadraticCurveTo(0, 0.7, 1, 0); f.quadraticCurveTo(0, -0.7, -1.2, 0);
  f.moveTo(1, 0); f.lineTo(1.6, 0.5); f.lineTo(1.6, -0.5); f.lineTo(1, 0);
  const sch = add(g, new THREE.ShapeGeometry(f), FARBE.orange, 0, LAND_Y + 7.6, -0.2);
  sch.material = new THREE.MeshLambertMaterial({ color: FARBE.orange, side: THREE.DoubleSide });
  // Fischkisten
  for (let i = 0; i < 5; i++) box(g, 1, 0.45, 0.7, i % 2 ? FARBE.blue : FARBE.red, -5 + i * 1.3, LAND_Y + (i === 2 ? 0.45 : 0), -5);
  if (stufe >= 2) {
    // Marktstaende mit gestreiften Daechern
    for (let k = 0; k < 3; k++) {
      const x = -6 + k * 6;
      box(g, 2.6, 0.9, 1.4, FARBE.white, x, LAND_Y, -8);
      for (let i = 0; i < 4; i++) box(g, 0.66, 0.1, 1.6, i % 2 ? FARBE.white : [FARBE.red, FARBE.blue, FARBE.green][k], x - 0.99 + i * 0.66, LAND_Y + 2.1, -8);
      zyl(g, 0.05, 2.1, FARBE.white, x - 1.2, LAND_Y, -8.7, 4);
      zyl(g, 0.05, 2.1, FARBE.white, x + 1.2, LAND_Y, -8.7, 4);
    }
  }
  return { group: g, update: (dt, t) => { sch.rotation.y = Math.sin(t * 0.8) * 0.4; } };
}

function segelclub(stufe, { ufer = 6 } = {}) {
  const g = new THREE.Group();
  haus(g, 13.6, 3.2, 6.8, FARBE.white, FARBE.coral);
  box(g, 13.6, 0.15, 2.5, FARBE.wood, 0, LAND_Y + 0.2, -4.6);        // Terrasse
  const flaggen = [flagge(g, -7.8, -5.4, 7, FARBE.navy), flagge(g, -6.6, -5.4, 6, FARBE.yellow)];
  // Jollen auf Slipwagen vor dem Haus
  const farben = [FARBE.white, FARBE.red, FARBE.yellow, FARBE.navy, FARBE.white];
  for (let i = 0; i < 5; i++) rumpf(g, 2.4, 1.15, 0.4, farben[i], -9 + i * 2, LAND_Y + 0.35, -9, Math.PI / 2);
  // Jollensteg
  steg(g, 4, -6, 4, -(ufer + 16), 1.4);
  const optis = [];
  if (stufe >= 2) {
    // Optimisten der Segelschule im Kreis
    for (let i = 0; i < 6; i++) {
      const o = rumpf(g, 2.3, 1.1, 0.4, FARBE.white, 0, 0, 0);
      zyl(o, 0.04, 2.6, FARBE.white, 0.5, 0.3, 0, 4);
      const s = add(o, new THREE.PlaneGeometry(1.6, 1.6), FARBE.sail, -0.2, 1.8, 0);
      s.material = new THREE.MeshLambertMaterial({ color: i === 0 ? FARBE.red : FARBE.sail, side: THREE.DoubleSide });
      s.rotation.z = 0.5;
      optis.push(o);
    }
    // Motorboot des Trainers
    optis.push(rumpf(g, 4.5, 1.9, 0.6, FARBE.grey, 0, 0, 0));
  }
  if (stufe >= 3) {
    // Startturm mit Signalflaggen
    box(g, 2.4, 4.5, 2.4, FARBE.wood, 9, LAND_Y, -2);
    box(g, 3, 0.2, 3, FARBE.wood2, 9, LAND_Y + 4.5, -2);
    zyl(g, 0.07, 5, FARBE.white, 9, LAND_Y + 4.7, -2, 4);
    for (let i = 0; i < 4; i++) box(g, 0.05, 0.6, 0.9, [FARBE.red, FARBE.yellow, FARBE.blue, FARBE.white][i], 9.3, LAND_Y + 6 + i * 0.85, -2);
    flaggen.push(flagge(g, 11, -3.5, 6, FARBE.green));
  }
  return {
    group: g,
    update(dt, t) {
      flaggen.forEach((f, i) => wehen(f, t, i));
      optis.forEach((o, i) => {
        const trainer = i === 6;
        const a = t * 0.08 + (i / 6) * Math.PI * 2;
        const rx = trainer ? 10 : 14, rz = trainer ? 5 : 7;
        o.position.set(Math.cos(a) * rx, Math.sin(t * 1.5 + i) * 0.05, -(ufer + 26) + Math.sin(a) * rz);
        o.rotation.y = -a - Math.PI / 2;
      });
    },
  };
}

function mastenkran() {
  const g = new THREE.Group();
  box(g, 3, 0.5, 3, FARBE.road, 0, LAND_Y, 0);
  zyl(g, 0.35, 10, FARBE.yellow, 0, LAND_Y + 0.5, 0, 8);
  const arm = new THREE.Group();
  arm.position.set(0, LAND_Y + 10.2, 0);
  arm.userData.land = true;
  const ausleger = box(arm, 0.4, 0.4, 7, FARBE.yellow, 0, 0, -3);
  ausleger.rotation.x = -0.12;
  box(arm, 0.8, 0.8, 1.2, FARBE.ink, 0, -0.1, 1.2);                  // Gegengewicht
  const seil = box(arm, 0.04, 5, 0.04, FARBE.ink, 0, -5, -6.2);
  box(arm, 0.3, 0.4, 0.3, FARBE.red, 0, -5.4, -6.2);                // Haken
  g.add(arm);
  // Mast, der gerade gestellt wird
  const mast = box(arm, 0.18, 9, 0.18, FARBE.white, 0, -14.4, -6.2);
  for (let i = 0; i < 4; i++) poller(g, -1.5 + i, -2.4);
  return {
    group: g,
    update(dt, t) {
      arm.rotation.y = Math.sin(t * 0.18) * 0.6;
      const h = (Math.sin(t * 0.3) + 1) * 0.8;
      seil.scale.y = 1 - h * 0.15;
      seil.position.y = -5 + h * 0.4;
      mast.position.y = -14.4 + h * 0.8;
    },
  };
}

function ausruester(stufe) {
  const g = new THREE.Group();
  haus(g, 7.4, 3, 5, FARBE.white, FARBE.navy);
  // Markise in Blau-Weiss
  for (let i = 0; i < 8; i++) {
    const m = box(g, 0.92, 0.1, 1.6, i % 2 ? FARBE.white : FARBE.blue, -3.22 + i * 0.92, LAND_Y + 2.3, -3.2);
    m.rotation.x = 0.25;
  }
  // Auslage: Fender, Tonnen, Anker
  for (let i = 0; i < 4; i++) zyl(g, 0.25, 0.9, [FARBE.blue, FARBE.white, FARBE.red, FARBE.yellow][i], -2.5 + i * 0.7, LAND_Y, -4.4, 8);
  const tonne = zyl(g, 0.45, 1.2, FARBE.red, 2.5, LAND_Y, -4.4, 8, 0.6);
  const ring = add(g, new THREE.TorusGeometry(0.45, 0.12, 6, 12), FARBE.orange, 1.2, LAND_Y + 1.1, -4.6);
  box(g, 0.15, 1.6, 0.15, FARBE.ink, 3.6, LAND_Y, -4.2);
  box(g, 1, 0.15, 0.15, FARBE.ink, 3.6, LAND_Y + 0.2, -4.2);
  if (stufe >= 2) {
    haus(g, 5, 3.4, 5, FARBE.grey, FARBE.ink, 7, 0);
    box(g, 2.6, 2.6, 0.1, FARBE.steel, 7, LAND_Y, -2.55);
    zyl(g, 0.4, 0.7, FARBE.ink, 7, LAND_Y, -3.6, 6);                 // Motor auf Bock
  }
  return { group: g, update: (dt, t) => { ring.rotation.y = Math.sin(t) * 0.3; tonne.rotation.y = t * 0.2; } };
}

function travellift(stufe) {
  const g = new THREE.Group();
  // Bootsschuppen mit offenem Tor zum Becken
  haus(g, 9, 5, 6, FARBE.steel, FARBE.grey, -7, 2);
  box(g, 4, 3.6, 0.1, FARBE.ink, -7, LAND_Y, -1.05);
  rumpf(g, 7, 2.6, 1.4, FARBE.white, 3, LAND_Y + 1.6, 4, 0, FARBE.teak);   // Boot auf Boecken
  for (const x of [1, 5]) box(g, 0.4, 1.6, 2.2, FARBE.yellow, x, LAND_Y, 4);
  const teile = [];
  if (stufe >= 2) {
    // Travellift-Becken (Plan 147,5..164,5 / 3..27) und blauer Portalkran darueber
    const [bx, bz] = P(156 - 156, 15 - -6);
    for (const s of [-1, 1]) steg(g, bx + s * 5.6, bz + 7.5, bx + s * 5.6, bz - 7.5, 1.6, FARBE.road, 0.7);
    const lift = new THREE.Group();
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(lift, 0.5, 7.5, 0.5, FARBE.blue, sx * 5.6, 0.7, sz * 3);
    for (const sx of [-1, 1]) box(lift, 0.6, 0.8, 6.6, FARBE.blue, sx * 5.6, 8.2, 0);
    for (const sz of [-1, 1]) box(lift, 11.8, 0.6, 0.6, FARBE.blue, 0, 8.2, sz * 3);
    box(lift, 1.2, 1.2, 1.2, FARBE.yellow, 5.6, 6.4, -3.6);            // Fuehrerstand
    const boot = new THREE.Group();
    rumpf(boot, 10, 3.4, 1.6, FARBE.navy, 0, 0, 0, Math.PI / 2);
    zyl(boot, 0.1, 9, FARBE.white, 0, 1, 0.5, 4);
    for (const sz of [-1.5, 1.5]) box(boot, 3.8, 0.08, 0.3, FARBE.ink, 0, -0.6, sz);   // Gurte
    lift.add(boot);
    lift.position.set(bx, 0, bz);
    g.add(lift);
    teile.push({ lift, boot, z0: bz });
  }
  if (stufe >= 3) {
    // Grosse Werfthalle mit Slipwagen am Becken
    haus(g, 20, 8, 12, FARBE.white, FARBE.grey, 22, 10, 0, 3);
    box(g, 7, 6.5, 0.1, FARBE.steel, 22, LAND_Y, 3.95);
    flaeche(g, 6, 12, FARBE.road, 22, -2);
    for (const s of [-1.2, 1.2]) box(g, 0.2, 0.15, 12, FARBE.steel, 22 + s, LAND_Y, -2);
  }
  return {
    group: g,
    update(dt, t) {
      for (const p of teile) {
        // Boot wird gehoben, Lift faehrt an Land, setzt ab und faehrt zurueck: Zyklus 40 s
        const c = (t % 40) / 40;
        const heben = c < 0.2 ? c / 0.2 : c < 0.6 ? 1 : c < 0.8 ? 1 - (c - 0.6) / 0.2 : 0;
        const fahren = c < 0.2 ? 0 : c < 0.4 ? (c - 0.2) / 0.2 : c < 0.8 ? 1 : 1 - (c - 0.8) / 0.2;
        p.boot.position.y = 0.2 + heben * 3.2;
        p.lift.position.z = p.z0 + fahren * 7;
      }
    },
  };
}

function winterlager(stufe) {
  const g = new THREE.Group();
  flaeche(g, 30, 18, FARBE.road, 0, 0);
  // Boote auf Boecken unter Planen
  const farben = [FARBE.white, FARBE.navy, FARBE.white, FARBE.red, FARBE.white, FARBE.green];
  const n = stufe >= 2 ? 3 : 6;
  for (let i = 0; i < n; i++) {
    const x = -12 + (i % 6) * 4.8, z = stufe >= 2 ? -6.5 : -4 + Math.floor(i / 6) * 8;
    for (const s of [-1.5, 1.5]) box(g, 0.3, 1.4, 1.6, FARBE.wood2, x, LAND_Y, z + s);
    rumpf(g, 7, 2.4, 1.3, farben[i], x, LAND_Y + 1.6, z, Math.PI / 2);
    const plane = box(g, 2, 0.6, 6, FARBE.blue, x, LAND_Y + 2.8, z);
    plane.scale.x = 0.9;
  }
  if (stufe >= 2) {
    // Halle mit Tonnendach
    const h = new THREE.Group();
    h.position.set(0, LAND_Y, 4);
    box(h, 28, 5, 12, FARBE.white);
    const dach = add(h, new THREE.CylinderGeometry(6.2, 6.2, 28.4, 12, 1, false, 0, Math.PI), FARBE.steel, 0, 5, 0);
    dach.rotation.z = Math.PI / 2;
    dach.rotation.x = Math.PI / 2;
    dach.scale.set(1, 1, 0.45);
    for (let i = 0; i < 3; i++) box(h, 5, 4.4, 0.1, FARBE.grey, -9 + i * 9, 0, -6.05);
    g.add(h);
  }
  return { group: g, update: null };
}

function segelmacher(stufe) {
  const g = new THREE.Group();
  haus(g, 9.9, 3.6, 5.6, FARBE.white, FARBE.coral);
  // Geflicktes Segel auf einem Gestell
  zyl(g, 0.08, 7, FARBE.wood2, -6.5, LAND_Y, -2, 4);
  const s = new THREE.Shape([new THREE.Vector2(0, 0.6), new THREE.Vector2(3.4, 0.6), new THREE.Vector2(0, 6.8)]);
  const segel = add(g, new THREE.ShapeGeometry(s), FARBE.sail, -6.5, LAND_Y, -2);
  segel.material = new THREE.MeshLambertMaterial({ color: FARBE.sail, side: THREE.DoubleSide });
  box(g, 0.6, 0.6, 0.02, FARBE.red, -5.9, LAND_Y + 2, -2.01);        // Flicken
  // Segelsack-Stapel
  for (let i = 0; i < 3; i++) zyl(g, 0.35, 1.2, [FARBE.navy, FARBE.blue, FARBE.white][i], 3 + i * 0.8, LAND_Y, -3.6, 8).rotation.z = Math.PI / 2;
  let loft = null;
  if (stufe >= 2) {
    // Segelloft: lange Halle mit Dachfenstern
    loft = haus(g, 14, 4.5, 7, FARBE.sail, FARBE.navy, 0, 7.5, 0, 2.6);
    for (let i = 0; i < 4; i++) box(g, 1.6, 0.2, 1.2, FARBE.glass, -5 + i * 3.3, LAND_Y + 6, 6.2);
  }
  return { group: g, update: (dt, t) => { segel.rotation.y = Math.sin(t * 0.9) * 0.25; } };
}

// Liegeplatz des Rettungsboots in Planeinheiten: Stufe 1 der Dienstplatz aus harbor.js (dienste, art
// 'seenotretter', an der Innenseite der Ostmole), der Kreuzer liegt an SK01 an der Westmole.
export function seenotPlatz(gross) {
  if (gross) {
    const l = HAFEN.plaetze?.find((q) => q.id === 'SK01')?.lage?.[6];
    return l ? { x: l[0], y: l[1], dreh: l[2] } : { x: 57, y: 302.6, dreh: 6 };
  }
  const d = (HAFEN.stufen?.[4]?.dienste ?? []).find((q) => q.art === 'seenotretter');
  return d ? { x: d.x, y: d.y, dreh: d.richtung ?? 85 } : { x: 202, y: 243, dreh: 85 };
}
// Weg zum Einsatz (Planeinheiten), vom Liegeplatz durch die Hafeneinfahrt nach See
export function seenotEinsatzWeg(gross) {
  const p = seenotPlatz(gross);
  return gross
    ? [[p.x, p.y], [110, 298], [140, 330], [146, 420]]
    : [[p.x, p.y], [p.x - 4, p.y + 40], [176, 300], [146, 330], [146, 420]];
}

function seenotretter(stufe, { lage = { x: 224, y: 211 } } = {}) {
  const g = new THREE.Group();
  // Stationsgebaeude mit Ausguck
  haus(g, 8, 3.2, 6, FARBE.white, FARBE.red);
  box(g, 2.4, 6, 2.4, FARBE.white, 5.2, LAND_Y, 0.5);
  box(g, 3, 1.4, 3, FARBE.glass, 5.2, LAND_Y + 6, 0.5);
  box(g, 3.2, 0.3, 3.2, FARBE.red, 5.2, LAND_Y + 7.4, 0.5);
  const fl = flagge(g, -5, -3.6, 7, FARBE.orange);
  const gross = stufe >= 2;
  const platz = seenotPlatz(gross);
  const [dx, dz] = P(platz.x - lage.x, platz.y - lage.y);
  const boot = new THREE.Group();
  const L = gross ? 20 : 10.5, B = gross ? 5 : 3.6;
  rumpf(boot, L, B, gross ? 2.6 : 1.6, FARBE.white, 0, 0, 0, 0, FARBE.white);
  box(boot, L * 0.32, gross ? 2.6 : 1.8, B * 0.62, FARBE.orange, L * 0.05, gross ? 1.8 : 1, 0);
  box(boot, L * 0.12, 0.6, B * 0.6, FARBE.glass, L * 0.2, gross ? 3.6 : 2.2, 0);
  box(boot, L * 0.9, 0.25, 0.1, FARBE.orange, -L * 0.05, gross ? 0.9 : 0.6, B / 2 + 0.02);
  box(boot, L * 0.9, 0.25, 0.1, FARBE.orange, -L * 0.05, gross ? 0.9 : 0.6, -B / 2 - 0.02);
  if (gross) {
    zyl(boot, 0.18, 7, FARBE.white, L * 0.05, 4.4, 0, 6);
    rumpf(boot, 7, 2.4, 1.2, FARBE.orange, -L * 0.35, 1.8, 0);          // Tochterboot in der Heckwanne
  }
  boot.userData.fest = true;
  const ruhe = { x: dx, z: dz, ry: (platz.dreh * Math.PI) / 180 };
  boot.position.set(ruhe.x, 0, ruhe.z);
  boot.rotation.y = ruhe.ry;
  g.add(boot);
  // Einsatzweg in lokalen Metern (relativ zum Anker)
  const weg = seenotEinsatzWeg(gross).map(([x, y]) => new THREE.Vector3(...((q) => [q[0], 0, q[1]])(P(x - lage.x, y - lage.y))));
  const laengen = [0];
  for (let i = 1; i < weg.length; i++) laengen.push(laengen[i - 1] + weg[i].distanceTo(weg[i - 1]));
  const gesamt = laengen[laengen.length - 1];
  const _p = new THREE.Vector3();
  function aufWeg(s) {
    for (let i = 1; i < weg.length; i++) {
      if (s <= laengen[i] || i === weg.length - 1) {
        const k = Math.min(1, Math.max(0, (s - laengen[i - 1]) / Math.max(1e-6, laengen[i] - laengen[i - 1])));
        _p.copy(weg[i - 1]).lerp(weg[i], k);
        return Math.atan2(-(weg[i].z - weg[i - 1].z), weg[i].x - weg[i - 1].x);
      }
    }
    return ruhe.ry;
  }
  let einsatz = -1;                       // Spielzeit, zu der der Einsatz begann
  let kurs = ruhe.ry;
  return {
    group: g,
    boot,
    // Bei Sturm (Ereignis 'sturm') laeuft das Rettungsboot aus und kommt zurueck
    einsatz(t) { einsatz = t; },
    update(dt, t) {
      wehen(fl, t);
      let p = 0, raus = true;
      if (einsatz >= 0) {
        const e = (t - einsatz) / 40;
        if (e >= 1) einsatz = -1; else { p = Math.sin(e * Math.PI); raus = e < 0.5; }
      }
      if (p > 0.001) {
        const r = aufWeg(p * gesamt);
        const soll = raus ? r : r + Math.PI;
        let d = ((soll - kurs + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
        kurs += d * Math.min(1, dt * 2);
        boot.position.set(_p.x, 0, _p.z);
      } else {
        boot.position.set(ruhe.x, 0, ruhe.z);
        kurs = ruhe.ry;
      }
      boot.position.y = Math.sin(t * 1.4) * 0.06 * (1 + p * 4);
      boot.rotation.y = kurs + Math.sin(t * 0.9) * 0.02;
      boot.rotation.z = Math.sin(t * 1.7) * 0.02 * (1 + p * 5);
    },
  };
}

function fahrgastanleger(stufe) {
  const g = new THREE.Group();
  // Fahrkartenbude und Wartebank an der Kaikante (Kai bei Plan-y 229)
  haus(g, 4.4, 2.6, 3, FARBE.white, FARBE.blue);
  box(g, 4, 0.5, 0.6, FARBE.wood, -5, LAND_Y, -2);
  const fl = flagge(g, 3.4, -2, 5.5, FARBE.blue);
  // Gangway an der Kaikante (Kai bei Plan-y 229); das Ausflugsschiff liegt am Kai davor
  const [, kz] = P(0, 229 - 216);
  box(g, 1.6, 3.2, 1.6, FARBE.steel, 0, LAND_Y, kz + 1.6);
  const gw = box(g, 1.4, 0.15, 3.2, FARBE.white, 0, LAND_Y + 2.9, kz - 0.3);
  gw.rotation.x = 0.18;
  // Schild "Ausflugsfahrten": gelbe Tafel
  box(g, 0.1, 1.6, 2.4, FARBE.yellow, -2.4, LAND_Y + 1, kz + 2);
  if (stufe >= 2) {
    haus(g, 6, 2.8, 3.4, FARBE.white, FARBE.blue, 8, 0);
    for (let i = 0; i < 3; i++) box(g, 3, 0.5, 0.6, FARBE.wood, -9 + i * 3.5, LAND_Y, -5);
  }
  return { group: g, update: (dt, t) => wehen(fl, t) };
}

function museumshafen(stufe) {
  const g = new THREE.Group();
  // Alter Speicher in Backstein mit Luke und Ladebalken
  haus(g, 8.7, 7, 5, FARBE.brick, FARBE.ink, 0, 0, 0, 3.5);
  for (let i = 0; i < 3; i++) box(g, 1.2, 1.2, 0.1, FARBE.wood2, 0, LAND_Y + 1 + i * 2.1, -2.55);
  box(g, 0.25, 0.25, 1.4, FARBE.wood2, 0, LAND_Y + 7.4, -3.2);
  // Kopfsteinpflaster an der Kaimauer (Kai bei Plan-y 229)
  const [, kz] = P(0, 229 - 212);
  flaeche(g, 22, 7, FARBE.rock, 0, kz + 3.5);
  for (let i = 0; i < 5; i++) poller(g, -10 + i * 5, kz + 0.5);
  // Alter Holzkran an der Kante
  const kran = new THREE.Group();
  kran.position.set(8, LAND_Y, kz + 1.4);
  box(kran, 1.6, 2, 1.6, FARBE.wood2);
  zyl(kran, 0.3, 6, FARBE.wood, 0, 2, 0, 6);
  const arm = box(kran, 0.3, 0.3, 5, FARBE.wood, 0, 7.2, -2);
  arm.rotation.x = 0.35;
  g.add(kran);
  // Anker und Laternen
  box(g, 0.2, 1.8, 0.2, FARBE.ink, -9, LAND_Y, kz + 4);
  box(g, 1.4, 0.2, 0.2, FARBE.ink, -9, LAND_Y + 0.3, kz + 4);
  for (let i = 0; i < 3; i++) {
    zyl(g, 0.06, 3, FARBE.ink, -8 + i * 7, LAND_Y, kz + 5.6, 4);
    box(g, 0.4, 0.5, 0.4, FARBE.yellow, -8 + i * 7, LAND_Y + 3, kz + 5.6);
  }
  if (stufe >= 2) {
    haus(g, 7, 6, 5, FARBE.yellow, FARBE.ink, 0, 7.5, 0, 3.2);
    // Wimpelkette
    for (let i = 0; i < 9; i++) {
      const c = [FARBE.red, FARBE.yellow, FARBE.blue, FARBE.green][i % 4];
      const w = box(g, 0.05, 0.5, 0.5, c, -9 + i * 2.2, LAND_Y + 4 - Math.sin((i / 8) * Math.PI) * 0.8, kz + 2.5);
      w.rotation.x = Math.PI / 4;
    }
  }
  const wehen = [];
  if (stufe >= 3) {
    // Windjammertreffen: Flaggenreihe an der Kaikante und zwei weisse Marktzelte auf dem Pflaster
    const farben = [FARBE.red, FARBE.blue, FARBE.yellow, FARBE.green, FARBE.coral, FARBE.navy];
    for (let i = 0; i < 6; i++) wehen.push(flagge(g, -12 + i * 4.8, kz + 1.2, 6.5, farben[i]));
    for (const x of [-21, -15]) {
      box(g, 3.6, 2, 3, FARBE.white, x, LAND_Y, kz + 5);
      const dach = add(g, new THREE.ConeGeometry(2.7, 1.4, 4), FARBE.white, x, LAND_Y + 2.7, kz + 5);
      dach.rotation.y = Math.PI / 4;
      box(g, 3.4, 0.4, 0.06, x < 0 ? FARBE.red : FARBE.blue, x, LAND_Y + 1.5, kz + 3.48);
    }
  }
  return { group: g, update: (dt, t) => {
    kran.rotation.y = Math.sin(t * 0.12) * 0.5;
    wehen.forEach((f, i) => { f.rotation.y = Math.sin(t * 2.1 + i) * 0.4; });
  } };
}

// Barkasse fuer Hafenrundfahrten: Fahrkartenbude am Ufer, Gangway und Ponton. Die Barkasse selbst
// faehrt in js/render/services-besuch.js und liegt am Objekt 'liegeplatz' (Bug nach +x).
function barkasse(stufe, { ufer = 6 } = {}) {
  const g = new THREE.Group();
  // Bude mit rot-weissem Schild "Hafenrundfahrt"
  box(g, 3.2, 2.4, 2.4, FARBE.white, 0, LAND_Y, 1.2);
  box(g, 3.6, 0.2, 2.8, FARBE.red, 0, LAND_Y + 2.4, 1.2);
  box(g, 1.4, 0.8, 0.06, FARBE.glass, 0, LAND_Y + 1.2, -0.03);
  for (let i = 0; i < 4; i++) box(g, 0.8, 0.5, 0.08, i % 2 ? FARBE.white : FARBE.red, -1.2 + i * 0.8, LAND_Y + 2.7, -0.05);
  const fl = flagge(g, 2.4, -0.6, 5, FARBE.red);
  box(g, 2.4, 0.45, 0.5, FARBE.wood, -3.4, LAND_Y, -0.6);            // Wartebank
  // Gangway zum Ponton, Ponton parallel zum Ufer
  const pz = -(ufer + 3.2);
  steg(g, 0, -0.4, 0, pz + 1.3, 1.4);
  const ponton = new THREE.Group();
  ponton.position.set(0, 0, pz);
  box(ponton, 12, 0.5, 2.6, FARBE.pont, 0, 0.05, 0);
  for (const x of [-5, 0, 5]) poller(ponton, x, -1.1, 0.55);
  ponton.userData.fest = true;
  g.add(ponton);
  const liege = new THREE.Object3D();
  liege.name = 'liegeplatz';
  liege.position.set(0, 0, pz - 3.6);
  g.add(liege);
  return { group: g, update: (dt, t) => { fl.rotation.y = Math.sin(t * 2.3) * 0.35; } };
}

// Die Barkasse: langer niedriger Rumpf, Kajuete mit Fensterband, offenes Achterdeck unter rotem Sonnendach
export function barkasseBoot() {
  const g = new THREE.Group();
  rumpf(g, 16, 4.2, 1.8, FARBE.ink, 0, 0, 0, 0, FARBE.wood);
  box(g, 15, 0.25, 4.25, FARBE.red, -0.4, 0.55, 0);                  // roter Streifen
  box(g, 7.5, 1.4, 3.2, FARBE.white, 0.6, 0.8, 0);                  // Kajuete
  for (const z of [-1.62, 1.62]) box(g, 6.6, 0.55, 0.06, FARBE.glass, 0.6, 1.5, z);
  box(g, 7.7, 0.12, 3.4, FARBE.wood2, 0.6, 2.2, 0);                  // Kajuetdach
  box(g, 1.8, 1.3, 2.4, FARBE.white, 5, 0.8, 0);                     // Steuerstand vorn
  box(g, 0.06, 0.5, 2, FARBE.glass, 5.92, 1.6, 0);
  box(g, 2, 0.1, 2.6, FARBE.red, 5, 2.1, 0);
  // Achterdeck mit Baenken und Sonnendach
  for (const z of [-1.3, 1.3]) box(g, 4, 0.4, 0.6, FARBE.wood, -5, 0.8, z);
  for (const [x, z] of [[-7, -1.5], [-7, 1.5], [-3.2, -1.5], [-3.2, 1.5]]) zyl(g, 0.05, 1.6, FARBE.white, x, 0.8, z, 4);
  box(g, 4.2, 0.1, 3.4, FARBE.red, -5.1, 2.4, 0);
  // Fahrgaeste
  const farben = [FARBE.yellow, FARBE.navy, FARBE.coral, FARBE.green, FARBE.blue, FARBE.white];
  for (let i = 0; i < 6; i++) zyl(g, 0.22, 0.8, farben[i], -6.4 + (i % 3) * 1.4, 1.1, i < 3 ? -1.3 : 1.3, 6);
  const fl = flagge(g, -7.8, 0, 1.8, FARBE.red, 0.8);
  return { group: g, laenge: 16, breite: 4.2, fl };
}

// Pierlinien der Stufe 6 aus harbor.js (bauart 'pier'), steg 'P' Kreuzfahrt, 'MA' Marine
function pierLinien(steg) {
  return (HAFEN.stufen?.[6]?.stege ?? []).filter((l) => l.bauart === 'pier' && l.steg === steg).map((l) => l.punkte);
}
// Wurzel (Landende) einer Pier: Punkt mit kleinstem y
function pierWurzel(steg, rueck) {
  let best = null;
  for (const l of pierLinien(steg)) for (const q of l) if (!best || q[1] < best[1]) best = q;
  return best ?? rueck;
}

function kreuzfahrtterminal(stufe, { lage = { x: -140, y: 210 } } = {}) {
  const g = new THREE.Group();
  // Lange weisse Terminalhalle mit Glasband und geschwungenem Dach (Vorbild Warnemuende), quer ueber der
  // Wurzel der Kreuzfahrtpier: Die Gaeste gehen nach Norden auf die Pier, nach Sueden zu den Bussen.
  const lang = stufe >= 2 ? 34 : 18;
  const tief = 8;
  box(g, lang, 6, tief, FARBE.white, 0, LAND_Y, 0);
  box(g, lang - 1, 1.6, 0.1, FARBE.glass, 0, LAND_Y + 2.6, -tief / 2 - 0.05);
  box(g, lang - 1, 1.6, 0.1, FARBE.glass, 0, LAND_Y + 2.6, tief / 2 + 0.05);
  const dach = add(g, new THREE.CylinderGeometry(tief / 2 + 0.6, tief / 2 + 0.6, lang + 1, 16, 1, false, 0, Math.PI), FARBE.pont, 0, LAND_Y + 6, 0);
  dach.rotation.z = Math.PI / 2;
  dach.rotation.x = Math.PI / 2;
  dach.scale.set(1, 1, 0.25);
  // Ausgang zur Pier (Nordseite) und Eingang zum Busplatz (Suedseite): Vordaecher
  const [wx] = P(pierWurzel('P', [-140, 219])[0] - lage.x, 0);
  box(g, 4, 0.25, 3, FARBE.blue, wx, LAND_Y + 3.2, -tief / 2 - 1.5);
  box(g, 6, 0.25, 3, FARBE.blue, 0, LAND_Y + 3.2, tief / 2 + 1.5);
  // Busplatz zwischen Halle und Nehrungsstrasse, Busse laengs zur Strasse
  flaeche(g, lang + 8, 6.5, FARBE.road, 0, tief / 2 + 3.6);
  const busse = stufe >= 2 ? 3 : 1;
  for (let i = 0; i < busse; i++) box(g, 11, 3, 2.5, [FARBE.blue, FARBE.yellow, FARBE.white][i], -lang / 2 + 6 + i * 12, LAND_Y, tief / 2 + 4.2);
  const fl = [flagge(g, -lang / 2 - 1.2, -tief / 2 - 1, 9, FARBE.blue), flagge(g, -lang / 2 + 1, -tief / 2 - 1, 9, FARBE.red)];
  // Gangway-Tuerme an der Aussenseite des Pierkopfs (P01 liegt noerdlich davor)
  const p01 = HAFEN.plaetze?.find((q) => q.id === 'P01')?.lage?.[6] ?? [-142, 358];
  const kopf = pierLinien('P').find((l) => Math.abs(l[0][1] - l[l.length - 1][1]) < 1);
  const kopfY = kopf ? kopf[0][1] : 330;
  const tuerme = stufe >= 2 ? [-24, 24] : [0];
  for (const off of tuerme) {
    const [px, pz] = P(p01[0] - lage.x, kopfY - lage.y);
    const turm = new THREE.Group();
    turm.position.set(px + off, 1.3, pz - 1.2);
    box(turm, 2, 9, 2, FARBE.steel);
    box(turm, 1.4, 1.4, 4, FARBE.white, 0, 7, -2.6);
    turm.userData.fest = true;
    g.add(turm);
  }
  return { group: g, update: (dt, t) => fl.forEach((f, i) => wehen(f, t, i)) };
}

function marineanleger(stufe, { lage = { x: -336, y: 210 } } = {}) {
  const g = new THREE.Group();
  // Eingezaeunter Stuetzpunkt an der Wurzel der eigenen Marinepier (Steg MA). Zwei Zugaenge: das Tor mit
  // Wache an der Nehrungsstrasse (Sueden) und die Pier nach Norden; dazwischen der Exerzierplatz.
  const X0 = -21, X1 = 21, Z0 = -9, Z1 = 8;   // Zaun in lokalen Metern (Norden = -z)
  const [wx] = P(pierWurzel('MA', [-330, 220])[0] - lage.x, 0);
  const torX = 6, torB = 6;                   // Tor in der Suedseite (Mitte, Breite)
  flaeche(g, X1 - X0, Z1 - Z0, FARBE.pave, (X0 + X1) / 2, (Z0 + Z1) / 2);
  // Zaun aus Feldern, mit Luecken fuer Tor (Sueden) und Pier (Norden)
  const feld = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 2.5));
    for (let i = 0; i < n; i++) {
      const k = (i + 0.5) / n;
      box(g, len / n - 0.15, 2, 0.08, FARBE.steel, x0 + (x1 - x0) * k, LAND_Y, z0 + (z1 - z0) * k, Math.atan2(-(z1 - z0), x1 - x0));
    }
  };
  feld(X0, Z1, torX - torB / 2, Z1); feld(torX + torB / 2, Z1, X1, Z1);
  feld(X0, Z0, wx - 3, Z0); feld(wx + 3, Z0, X1, Z0);
  feld(X0, Z0, X0, Z1); feld(X1, Z0, X1, Z1);
  // Wache und Schranke am Tor
  box(g, 3, 2.6, 3, FARBE.navyGrey, torX - torB / 2 - 2, LAND_Y, Z1 - 2);
  box(g, 3.4, 0.3, 3.4, FARBE.ink, torX - torB / 2 - 2, LAND_Y + 2.6, Z1 - 2);
  const schranke = new THREE.Group();
  schranke.position.set(torX - torB / 2, LAND_Y + 1, Z1 + 0.3);
  box(schranke, torB, 0.15, 0.15, FARBE.red, torB / 2, 0, 0);
  g.add(schranke);
  // Torposten an der Pier
  box(g, 1.2, 2.2, 1.2, FARBE.navyGrey, wx - 3.6, LAND_Y, Z0 + 0.8);
  // Stabsgebaeude in Backstein mit Fahnenmast
  haus(g, 14, 6, 7, FARBE.brick, FARBE.ink, -12, 2);
  const fl = flagge(g, wx + 4, Z0 + 2, 10, FARBE.navy);
  // Radarmast mit drehender Antenne
  zyl(g, 0.3, 12, FARBE.steel, X0 + 2, LAND_Y, Z0 + 2, 6);
  const radar = box(g, 3, 0.3, 0.4, FARBE.white, X0 + 2, LAND_Y + 12.2, Z0 + 2);
  if (stufe >= 2) {
    haus(g, 9, 5, 5, FARBE.brick, FARBE.ink, 15, -4.5);              // Unterkunft
    haus(g, 9, 6, 6, FARBE.navyGrey, FARBE.grey, -12, -5.5);         // Werkstatthalle
    const heli = new THREE.Group();
    heli.position.set(16, LAND_Y + 0.03, 3.5);
    add(heli, new THREE.CircleGeometry(3.4, 24).rotateX(-Math.PI / 2), FARBE.grey);
    box(heli, 0.5, 0.02, 2.6, FARBE.white, -0.8, 0.01, 0);
    box(heli, 0.5, 0.02, 2.6, FARBE.white, 0.8, 0.01, 0);
    box(heli, 1.6, 0.02, 0.5, FARBE.white, 0, 0.01, 0);
    g.add(heli);
  }
  return {
    group: g,
    update(dt, t) {
      radar.rotation.y = t * 1.2;
      wehen(fl, t);
      schranke.rotation.z = Math.max(0, Math.sin(t * 0.2)) * 1.2;
    },
  };
}

// T-Pier fuer Grossschiffe (Stufe 6): Betonpier mit Pollern, Deck 1,3 m wie der Kai.
// linien: Linienzuege in Planeinheiten (HAFEN.stufen[6].stege mit steg 'P').
export function tPier(linien, breite = 5) {
  const g = new THREE.Group();
  g.name = 'pier-grossschiffe';
  for (const l of linien) {
    for (let i = 1; i < l.length; i++) {
      const a = new THREE.Vector3(l[i - 1][0] * U, 0, -l[i - 1][1] * U);
      const b = new THREE.Vector3(l[i][0] * U, 0, -l[i][1] * U);
      steg(g, a.x, a.z, b.x, b.z, breite, FARBE.road, 1.3);
      const len = a.distanceTo(b), n = Math.floor(len / 12);
      const d = b.clone().sub(a).normalize(), q = new THREE.Vector3(-d.z, 0, d.x);
      for (let k = 1; k < n; k++) for (const s of [-1, 1]) {
        const p = a.clone().addScaledVector(d, (k * len) / n).addScaledVector(q, s * (breite / 2 - 0.4));
        poller(g, p.x, p.z, 1.3);
      }
    }
  }
  return g;
}

// ------------------------------------------------------------------ Angebote an Land
// opts.uhr(): Anteil des Spieltags 0..1 (0,75 = Abend). Offen oder zu sieht man am Modell.
const offen = (uhr, von, bis) => { const u = uhr?.() ?? 0.5; return u >= von && u < bis; };
// weich auf Ziel zugehen (fuer Klappen, Schirme)
const hin = (ist, soll, dt, k = 3) => ist + (soll - ist) * Math.min(1, dt * k);

// Sonnenschirm: Mast und Schirm, der Schirm klappt ueber scale.y auf und zu
function schirm(g, x, z, c, r = 1.3) {
  zyl(g, 0.05, 2.1, FARBE.white, x, LAND_Y, z, 4);
  const dach = add(g, new THREE.ConeGeometry(r, 0.55, 8), c, x, LAND_Y + 2.3, z);
  return dach;
}
// Tisch mit zwei Hockern
function tisch(g, x, z, c = FARBE.white) {
  zyl(g, 0.45, 0.75, c, x, LAND_Y, z, 8, 0.15);
  zyl(g, 0.18, 0.45, FARBE.wood, x - 0.8, LAND_Y, z, 6);
  zyl(g, 0.18, 0.45, FARBE.wood, x + 0.8, LAND_Y, z, 6);
}
// Fahrrad, Rahmen entlang x
function fahrrad(g, x, z, c) {
  const f = new THREE.Group();
  f.position.set(x, LAND_Y, z);
  for (const dx of [-0.55, 0.55]) {
    const r = add(f, new THREE.TorusGeometry(0.33, 0.05, 4, 10), FARBE.ink, dx, 0.35, 0);
    r.rotation.y = 0;
  }
  box(f, 1.1, 0.08, 0.08, c, 0, 0.55, 0);
  box(f, 0.08, 0.4, 0.08, c, -0.15, 0.55, 0);
  box(f, 0.3, 0.06, 0.12, FARBE.ink, -0.15, 0.95, 0);          // Sattel
  box(f, 0.08, 0.08, 0.5, FARBE.ink, 0.45, 0.95, 0);           // Lenker
  g.add(f);
  return f;
}

function baecker(stufe, { uhr } = {}) {
  const g = new THREE.Group();
  let klappe, rauchen = null, brezel;
  if (stufe <= 1) {
    // Brötchenwagen mit Klappe zur Wasserseite
    box(g, 3, 2, 1.8, FARBE.creme, 0, LAND_Y + 0.3, 0);
    for (const dx of [-1, 1]) add(g, new THREE.CylinderGeometry(0.3, 0.3, 0.2, 10), FARBE.ink, dx, LAND_Y + 0.3, 1).rotation.x = Math.PI / 2;
    box(g, 3, 0.12, 0.7, FARBE.wood, 0, LAND_Y + 1.25, -1.2);                 // Theke
    for (let i = 0; i < 6; i++) {
      const b = add(g, new THREE.SphereGeometry(0.17, 6, 4), FARBE.brot, -1.1 + i * 0.44, LAND_Y + 1.45, -1.2);
      b.scale.set(1.3, 0.7, 0.9);
    }
    klappe = new THREE.Group();
    klappe.position.set(0, LAND_Y + 2.3, -0.9);
    box(klappe, 3, 0.08, 1.2, FARBE.brot, 0, 0, -0.6);
    g.add(klappe);
    flagge(g, 1.9, -0.6, 3.2, FARBE.yellow);
  } else {
    haus(g, 6, 3, 5, FARBE.creme, FARBE.brot);
    box(g, 0.8, 1.6, 0.8, FARBE.brick, 1.8, LAND_Y + 4, 0.6);
    const vor = g.children.length;
    rauchen = rauch(g, 1.8, LAND_Y + 5.8, 0.6, 4);
    rauchen.huelle = g.children[vor];
    // Markise und Auslage
    for (let i = 0; i < 6; i++) box(g, 0.98, 0.1, 1.4, i % 2 ? FARBE.white : FARBE.brot, -2.45 + i * 0.98, LAND_Y + 2.3, -3.1).rotation.x = 0.25;
    box(g, 2.4, 0.9, 0.6, FARBE.wood, -1.2, LAND_Y, -3);
    klappe = new THREE.Group();
    klappe.position.set(-1.2, LAND_Y + 0.9, -3);
    for (let i = 0; i < 4; i++) add(klappe, new THREE.SphereGeometry(0.2, 6, 4), FARBE.brot, -0.8 + i * 0.5, 0.12, 0).scale.set(1.3, 0.7, 0.9);
    g.add(klappe);
    box(g, 1.6, 0.45, 0.5, FARBE.wood, 2, LAND_Y, -3.6);                     // Bank
    // Brezel am Ausleger
    box(g, 0.08, 0.08, 1.2, FARBE.ink, 2.6, LAND_Y + 2.6, -3);
    brezel = add(g, new THREE.TorusGeometry(0.42, 0.12, 5, 12), FARBE.brot, 2.6, LAND_Y + 2.05, -3.5);
  }
  return {
    group: g,
    update(dt, t) {
      const auf = offen(uhr, 0, 0.32);
      if (stufe <= 1) klappe.rotation.x = hin(klappe.rotation.x, auf ? -1.2 : 0, dt);
      else klappe.visible = auf;
      if (rauchen) { rauchen(t); rauchen.huelle.visible = offen(uhr, 0, 0.4); }
      if (brezel) brezel.rotation.y = Math.sin(t * 1.3) * 0.25;
    },
  };
}

function hafencafe(stufe, { uhr } = {}) {
  const g = new THREE.Group();
  haus(g, stufe >= 2 ? 7 : 5, 2.8, 4.4, FARBE.white, FARBE.green);
  box(g, 0.1, 0.9, 1.4, FARBE.ink, (stufe >= 2 ? 3.6 : 2.6), LAND_Y + 0.4, -2.4);   // Kreidetafel
  const schirme = [];
  const farben = [FARBE.coral, FARBE.mint, FARBE.yellow, FARBE.coral];
  const plaetze = stufe >= 2 ? [[-4.5, -5], [-1.5, -5.6], [1.5, -5.6], [4.5, -5]] : [[-1.5, -4.2], [1.6, -4.2]];
  if (stufe >= 2) {
    flaeche(g, 12, 5, FARBE.teak, 0, -5.2);                                         // Holzterrasse
    // Lichterkette
    for (let i = 0; i < 9; i++) add(g, new THREE.SphereGeometry(0.1, 5, 3), FARBE.yellow, -5.6 + i * 1.4, LAND_Y + 2.6 - Math.sin((i / 8) * Math.PI) * 0.4, -7.6);
    box(g, 0.08, 2.7, 0.08, FARBE.wood2, -5.8, LAND_Y, -7.6);
    box(g, 0.08, 2.7, 0.08, FARBE.wood2, 5.8, LAND_Y, -7.6);
  }
  plaetze.forEach(([x, z], i) => { tisch(g, x, z); schirme.push(schirm(g, x, z, farben[i % farben.length])); });
  const fl = flagge(g, stufe >= 2 ? -3.9 : -2.9, 1.6, 4.2, FARBE.mint);
  return {
    group: g,
    update(dt, t) {
      const auf = offen(uhr, 0.25, 0.8) ? 1 : 0.15;
      for (const s of schirme) { s.scale.x = s.scale.z = hin(s.scale.x, auf, dt, 2); s.scale.y = 1; }
      wehen(fl, t);
    },
  };
}

function grillplatz(stufe, { uhr } = {}) {
  const g = new THREE.Group();
  flaeche(g, 9, 7, FARBE.pave, 0, -1);
  // gemauerter Grill
  box(g, 1.8, 0.9, 1.1, FARBE.rock, 0, LAND_Y, 0.6);
  box(g, 1.6, 0.06, 0.9, FARBE.ink, 0, LAND_Y + 0.92, 0.6);
  const glut = add(g, new THREE.ConeGeometry(0.45, 0.7, 5), FARBE.orange, 0, LAND_Y + 1.3, 0.6);
  const vor = g.children.length;
  const r = rauch(g, 0, LAND_Y + 1.6, 0.6, 4);
  const huelle = g.children[vor];
  // Picknicktische mit Bänken
  for (const [x, z] of [[-2.6, -2.2], [2.6, -2.2]]) {
    box(g, 2, 0.75, 0.8, FARBE.wood, x, LAND_Y, z);
    box(g, 2, 0.45, 0.3, FARBE.wood2, x, LAND_Y, z - 0.75);
    box(g, 2, 0.45, 0.3, FARBE.wood2, x, LAND_Y, z + 0.75);
  }
  baum(g, -4, 2.2, 2);
  baum(g, 4.2, 1.6, 1.6);
  return {
    group: g,
    update(dt, t) {
      const an = offen(uhr, 0.68, 1.01);
      glut.visible = an;
      huelle.visible = an;
      if (an) { r(t); glut.scale.y = 0.8 + Math.sin(t * 9) * 0.2; }
    },
  };
}

function fahrradverleih(stufe, { uhr } = {}) {
  const g = new THREE.Group();
  haus(g, 4.4, 2.6, 3.2, FARBE.blue, FARBE.ink, 2.4, 0.4);
  // Ständer mit sechs Rädern, tagsüber sind die meisten unterwegs
  // Ständer quer zum Haus, die Räder stehen im Profil zur Promenade
  box(g, 0.1, 0.1, 5.4, FARBE.steel, -1.4, LAND_Y + 0.5, -1.2);
  const farben = [FARBE.red, FARBE.yellow, FARBE.green, FARBE.coral, FARBE.blue, FARBE.mint];
  const raeder = farben.map((c, i) => fahrrad(g, -1.4, -3.6 + i * 0.95, c));
  const fl = flagge(g, 4.8, -1.4, 3.4, FARBE.yellow);
  return {
    group: g,
    update(dt, t) {
      const u = uhr?.() ?? 0.5;
      // morgens alle da, zwischen 0,2 und 0,6 nach und nach weg, abends wieder zurück
      const weg = u < 0.15 || u > 0.7 ? 0 : u < 0.35 ? Math.round((u - 0.15) / 0.2 * 4) : u < 0.55 ? 4 : Math.round((0.7 - u) / 0.15 * 4);
      raeder.forEach((r, i) => { r.visible = i >= weg; });
      wehen(fl, t);
    },
  };
}

function eisdiele(stufe, { uhr } = {}) {
  const g = new THREE.Group();
  haus(g, 4.6, 2.8, 3.6, FARBE.rosa, FARBE.white);
  for (let i = 0; i < 6; i++) box(g, 0.8, 0.1, 1.3, i % 2 ? FARBE.white : FARBE.rosa, -2 + i * 0.8, LAND_Y + 2.2, -2.4).rotation.x = 0.25;
  // großes Eis als Schild
  const eis = new THREE.Group();
  eis.position.set(-2.8, LAND_Y, -2.2);
  zyl(eis, 0.06, 2.4, FARBE.white, 0, 0, 0, 4);
  const tuete = add(eis, new THREE.ConeGeometry(0.42, 1.1, 8), FARBE.brot, 0, 2.6, 0);
  tuete.rotation.x = Math.PI;
  add(eis, new THREE.SphereGeometry(0.42, 8, 6), FARBE.rosa, 0, 3.3, 0);
  add(eis, new THREE.SphereGeometry(0.36, 8, 6), FARBE.mint, 0, 3.8, 0);
  g.add(eis);
  const schirme = [];
  for (const [x, z, c] of [[0.2, -4.4, FARBE.mint], [2.8, -4.4, FARBE.rosa]]) { tisch(g, x, z); schirme.push(schirm(g, x, z, c, 1.1)); }
  return {
    group: g,
    update(dt, t) {
      eis.rotation.y = t * 0.6;
      const auf = offen(uhr, 0.3, 0.78) ? 1 : 0.15;
      for (const s of schirme) s.scale.x = s.scale.z = hin(s.scale.x, auf, dt, 2);
    },
  };
}

// ------------------------------------------------------------------ Tankstelle
// Versorgung "diesel" der Spielregeln (sim.js facilities): Stufe 1 eine Zapfsäule, Stufe 2 zwei
// Säulen unter einem Dach mit Tankwarthäuschen. Steht auf dem Dienststeg aus harbor.js
// (Schwimmsteg, Deck 0,46 m), Wasserseite = lokal -z. Alle Teile sind fest (nicht aufs Gelände heben).
export function tankstelle(stufe) {
  const g = new THREE.Group();
  const DECK = 0.46;
  const lichter = [], schlaeuche = [];
  const saeule = (x) => {
    box(g, 0.7, 1.5, 0.5, FARBE.red, x, DECK, -0.5);
    box(g, 0.74, 0.25, 0.54, FARBE.white, x, DECK + 1.5, -0.5);
    box(g, 0.5, 0.4, 0.04, FARBE.yellow, x, DECK + 0.9, -0.77);              // Schild "D"
    const l = add(g, new THREE.SphereGeometry(0.09, 6, 4), FARBE.green, x + 0.25, DECK + 1.82, -0.5);
    l.material = new THREE.MeshBasicMaterial({ color: '#6fe08a' });
    lichter.push(l);
    // Schlauch: hängt in einem Bogen zur Wasserkante und pendelt leicht
    const s = new THREE.Group();
    s.position.set(x - 0.3, DECK + 1.2, -0.75);
    const bogen = add(s, new THREE.TorusGeometry(0.42, 0.05, 4, 10, Math.PI), FARBE.ink, 0, -0.42, 0);
    bogen.rotation.z = Math.PI;
    g.add(s);
    schlaeuche.push(s);
  };
  saeule(-1.6);
  // Ölfass und Rettungsring
  zyl(g, 0.3, 0.8, FARBE.blue, 2.6, DECK, 0.2, 8);
  add(g, new THREE.TorusGeometry(0.32, 0.09, 6, 12), FARBE.orange, 3.4, DECK + 0.9, 0.55);
  // Schild "DIESEL" am Mast
  zyl(g, 0.06, 3.4, FARBE.white, -3.6, DECK, 0.3, 5);
  box(g, 1.6, 0.6, 0.08, FARBE.yellow, -3.6, DECK + 2.9, 0.3);
  box(g, 1.2, 0.18, 0.1, FARBE.red, -3.6, DECK + 3.1, 0.3);
  if (stufe >= 2) {
    saeule(0.2);
    // Dach über den Säulen
    for (const [x, z] of [[-2.4, -1], [1, -1], [-2.4, 0.8], [1, 0.8]]) box(g, 0.12, 2.6, 0.12, FARBE.white, x, DECK, z);
    box(g, 4, 0.25, 2.3, FARBE.red, -0.7, DECK + 2.6, -0.1);
    box(g, 4.1, 0.12, 2.4, FARBE.white, -0.7, DECK + 2.85, -0.1);
    // Tankwarthäuschen
    box(g, 1.8, 2.1, 1.5, FARBE.white, 3.4, DECK, 0.35);
    box(g, 2, 0.2, 1.7, FARBE.red, 3.4, DECK + 2.1, 0.35);
    box(g, 0.9, 0.7, 0.04, FARBE.glass, 3.4, DECK + 1.1, -0.42);
  }
  g.traverse((o) => { if (o !== g) o.userData.fest = true; });
  return {
    group: g,
    update(dt, t) {
      lichter.forEach((l, i) => { l.visible = Math.sin(t * 2.4 + i * 1.7) > -0.3; });
      schlaeuche.forEach((s, i) => { s.rotation.x = Math.sin(t * 0.9 + i) * 0.12; });
    },
  };
}

export const MODELLE = {
  bootsverleih, slip, raeucherei, fischhalle, segelclub, mastenkran, ausruester, travellift, winterlager,
  segelmacher, seenotretter, fahrgastanleger, museumshafen, kreuzfahrtterminal, marineanleger,
  baecker, hafencafe, grillplatz, fahrradverleih, eisdiele, barkasse,
};

// Baut ein Modell. Unbekannte ids bekommen ein schlichtes Haus, damit nichts unsichtbar bleibt.
// opts.boden: Bodenhoehe am Ankerpunkt in Metern (fuer Teile vom Ufer ins Wasser, z. B. die Sliprampe)
export function baueModell(id, stufe = 1, opts = {}) {
  const f = MODELLE[id];
  if (f) return f(stufe, opts);
  const g = new THREE.Group();
  haus(g, 6, 3, 5, FARBE.white, FARBE.coral);
  return { group: g, update: null };
}
