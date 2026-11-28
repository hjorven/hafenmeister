// Hafentiere (Paket P51, Roadmap F38, docs/hafentiere.md): Hafenkatze, Hafenhund und Graureiher.
// Sie wohnen im Hafen und sind jeden Tag da. Reine Belebung und Fotomotiv, keine Spielregeln, kein Geld.
//
// Hafenkatze (ab Stufe 1): wohnt am Hafenbüro. Morgens geht sie über die Stege zu den Booten und sitzt
//   davor, mittags schläft sie zusammengerollt in der Sonne, zwischendurch putzt sie sich. Nachts streift
//   sie herum, ihre Augen leuchten. Kommt der Hund zu nah, läuft sie weg.
// Hafenhund (ab Stufe 2): schnüffelt am Ufer herum, läuft zu jedem Boot, das festmacht, und begrüßt es
//   mit dem Schwanz wedelnd. Abends geht er mit dem Hafenmeister über die Stege und schläft danach vor
//   dem Büro.
// Graureiher (ab Stufe 1, wenn es flaches Wasser am Ufer oder eine Mole gibt): steht reglos, schreitet
//   langsam, stößt nach Fischen. Kommt ein Boot, ein Mensch oder der Hund zu nah, fliegt er auf und landet
//   woanders. Abends fliegt er zum Schlafen weg, morgens kommt er wieder.
// Bei Regen gehen Katze und Hund ins Haus.
// Antippen: Katze miaut (Herz steigt auf), Hund bellt und springt, Reiher fliegt auf.
//
// Wege an Land kommen aus dem Wegenetz der Menschen (game.people.netz, people/netz.js), darum laufen die
// Tiere nie durchs Wasser oder durch Häuser. Zeit: echte Zeit mal Spieltempo, in der Pause steht alles.
//
// Schnittstelle: game.hafentiere = {
//   motive()        [{ art, x, y, z, r, nahBreite }] gerade sichtbare Tiere (Fotomodus, Logbuch)
//   tier(art)       Zustand zum Prüfen { art, x, y, z, zustand, pose, sichtbar, ... } oder null
//   tippe(art)      wie Antippen
//   scheuche(art)   Reiher fliegt auf (Prüfen)
//   begruesse(platz) Hund läuft zum Platz (Prüfen)
//   halte(art, sek) Katze oder Hund setzt sich und hält still (Fotomodus)
// }
// Sendet: 'hafentiere:tipp' { art }.
// Zum Ausprobieren: ?hafentiere=katze|hund|reiher stellt die Kamera nah an das Tier.

import * as THREE from 'three';
import { HAFEN } from '../data/harbor.js';
import { HAFENTIER_TEXTE } from '../data/besucher.js';

const U = HAFEN.einheiten?.meterProEinheit ?? 0.62;
const R_FOTO = 1.5;            // Radius des Motivs im Fotomodus (Meter): das Tier mit etwas Umgebung
const NAH_BREITE = 22;         // so nah fliegt die Kamera im Fotomodus heran (Meter Bildbreite)
const TEMPO = { katze: 0.9, katzeFlucht: 3.4, hund: 1.3, hundRennt: 3.0, reiherFlug: 6.5, reiherSchritt: 0.25 };
const LAUFBAR = new Set(['land', 'sand', 'holz', 'schwimmsteg', 'kai', 'pier', 'mole', 'bruecke']);
const STEG = new Set(['holz', 'schwimmsteg', 'kai', 'pier']);
const NAH_BOOT = 10;           // Reiher: Abstand zu Booten (Meter, zusätzlich zur halben Bootslänge)
const NAH_MENSCH = 6;          // Reiher: Abstand zu Menschen
const NAH_HUND = 8;            // Reiher: Abstand zum Hund
const KATZE_HUND = 3.2;
const MIN_PX = 2.5;            // kleiner als so viele Pixel (0,9 m Tier) wird nichts gezeichnet        // Katze läuft weg, wenn der Hund so nah ist

const zuf = (a, b) => a + Math.random() * (b - a);
const wahl = (arr) => arr[Math.floor(Math.random() * arr.length)];
const winkelDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

const MATS = new Map();
function mat(c) {
  if (!MATS.has(c)) MATS.set(c, new THREE.MeshLambertMaterial({ color: c, flatShading: true }));
  return MATS.get(c);
}
const KUGEL = new THREE.SphereGeometry(0.5, 8, 6);
function kugel(farbe, sx, sy, sz, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(KUGEL, mat(farbe));
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  return m;
}
/** Kasten, Drehpunkt oben (für Beine) */
function bein(farbe, w, h, x, y, z) {
  const g = new THREE.BoxGeometry(w, h, w);
  g.translate(0, -h / 2, 0);
  const m = new THREE.Mesh(g, mat(farbe));
  m.position.set(x, y, z);
  return m;
}

// ------------------------------------------------------------------ Modelle (+x ist vorn)
// Etwas größer als echt (Spielzeugstil wie die Menschen), sonst sieht man sie aus der Hafenansicht nie.

const KATZEN_FELL = [
  { fell: 0xd9893a, dunkel: 0xb06a28, hell: 0xf6e7cf },    // rot getigert
  { fell: 0x2d2a2a, dunkel: 0x1c1a1a, hell: 0xf4f1ea },    // schwarz mit weißer Brust
  { fell: 0x8d8f96, dunkel: 0x6c6e75, hell: 0xe6e6e6 },    // grau
];
const HUNDE_FELL = [
  { fell: 0xf3eee3, fleck: 0x8a5a33, nase: 0x222222 },     // weiß mit braunen Flecken
  { fell: 0xc89a5a, fleck: 0x9b7240, nase: 0x2a2220 },     // blond
  { fell: 0x2a2826, fleck: 0x3a3632, nase: 0x111111 },     // schwarz
];

function baueKatze(f) {
  const g = new THREE.Group();
  const k = new THREE.Group();            // Körper (für Sitzen und Liegen gekippt), Drehpunkt hinten
  k.position.set(-0.3, 0, 0);
  g.add(k);
  const rumpf = kugel(f.fell, 0.72, 0.27, 0.25, 0.3, 0.36, 0);
  const brust = kugel(f.hell, 0.22, 0.2, 0.2, 0.6, 0.36, 0);
  k.add(rumpf, brust);
  const kopf = new THREE.Group();
  kopf.position.set(0.68, 0.5, 0);
  kopf.add(kugel(f.fell, 0.25, 0.22, 0.25));
  kopf.add(kugel(f.hell, 0.1, 0.08, 0.12, 0.11, -0.04, 0));
  for (const s of [-1, 1]) {
    const ohr = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.11, 4), mat(f.dunkel));
    ohr.position.set(-0.01, 0.13, s * 0.075);
    kopf.add(ohr);
  }
  const augen = [];
  for (const s of [-1, 1]) {
    const a = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 4), new THREE.MeshBasicMaterial({ color: 0xd9ff70 }));
    a.position.set(0.115, 0.03, s * 0.055);
    a.visible = false;
    kopf.add(a);
    augen.push(a);
  }
  k.add(kopf);
  const beine = [];
  for (const [x, z] of [[0.52, 0.07], [0.52, -0.07], [0.08, 0.08], [0.08, -0.08]]) {
    const b = bein(x > 0.3 ? f.hell : f.fell, 0.07, 0.25, x, 0.27, z);
    k.add(b);
    beine.push(b);
  }
  const schwanz = new THREE.Group();
  schwanz.position.set(-0.02, 0.42, 0);
  const sg = new THREE.CylinderGeometry(0.03, 0.04, 0.44, 5);
  sg.translate(0, 0.22, 0);
  const sm = new THREE.Mesh(sg, mat(f.dunkel));
  schwanz.add(sm);
  k.add(schwanz);
  g.userData = { k, kopf, beine, schwanz, augen };
  return g;
}

function baueHund(f) {
  const g = new THREE.Group();
  const k = new THREE.Group();
  k.position.set(-0.42, 0, 0);
  g.add(k);
  k.add(kugel(f.fell, 1.0, 0.38, 0.34, 0.42, 0.58, 0));
  k.add(kugel(f.fleck, 0.36, 0.3, 0.3, 0.2, 0.66, 0.06));
  const kopf = new THREE.Group();
  kopf.position.set(0.92, 0.82, 0);
  kopf.add(kugel(f.fell, 0.3, 0.28, 0.27));
  const schnauze = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.13, 0.15), mat(f.fell));
  schnauze.position.set(0.18, -0.05, 0);
  kopf.add(schnauze);
  kopf.add(kugel(f.nase, 0.06, 0.05, 0.06, 0.29, -0.01, 0));
  for (const s of [-1, 1]) {
    const ohr = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.04), mat(f.fleck));
    ohr.position.set(-0.03, 0.04, s * 0.15);
    ohr.rotation.x = s * 0.3;
    kopf.add(ohr);
  }
  k.add(kopf);
  const beine = [];
  for (const [x, z] of [[0.72, 0.1], [0.72, -0.1], [0.12, 0.1], [0.12, -0.1]]) {
    const b = bein(f.fell, 0.09, 0.42, x, 0.44, z);
    k.add(b);
    beine.push(b);
  }
  const schwanz = new THREE.Group();
  schwanz.position.set(-0.06, 0.68, 0);
  const sg = new THREE.CylinderGeometry(0.035, 0.05, 0.34, 5);
  sg.translate(0, 0.17, 0);
  schwanz.add(new THREE.Mesh(sg, mat(f.fell)));
  schwanz.rotation.z = 0.7;
  k.add(schwanz);
  g.userData = { k, kopf, beine, schwanz };
  return g;
}

function baueReiher() {
  const g = new THREE.Group();
  const grau = 0x9aa3ad, hell = 0xe9ecef, dunkel = 0x3d434b, gelb = 0xe3b23c;
  const k = new THREE.Group();
  k.position.y = 1.0;
  g.add(k);
  const rumpf = kugel(grau, 0.74, 0.36, 0.32, 0, 0, 0);
  rumpf.rotation.z = 0.35;
  k.add(rumpf);
  // Hals: zwei Stücke, Drehpunkt am Rumpf; Kopf am Ende
  const hals = new THREE.Group();
  hals.position.set(0.24, 0.12, 0);
  const h1g = new THREE.CylinderGeometry(0.05, 0.07, 0.42, 5);
  h1g.translate(0, 0.21, 0);
  const h1 = new THREE.Mesh(h1g, mat(hell));
  h1.rotation.z = -0.35;
  hals.add(h1);
  const oben = new THREE.Group();
  oben.position.set(0.14, 0.39, 0);
  const h2g = new THREE.CylinderGeometry(0.045, 0.05, 0.34, 5);
  h2g.translate(0, 0.17, 0);
  const h2 = new THREE.Mesh(h2g, mat(hell));
  oben.add(h2);
  const kopf = new THREE.Group();
  kopf.position.set(0, 0.36, 0);
  kopf.add(kugel(hell, 0.15, 0.12, 0.12));
  const schopf = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.025, 0.03), mat(dunkel));
  schopf.position.set(-0.13, 0.04, 0);
  schopf.rotation.z = 0.25;
  kopf.add(schopf);
  const schnabel = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.32, 4), mat(gelb));
  schnabel.rotation.z = -Math.PI / 2;
  schnabel.position.set(0.22, -0.01, 0);
  kopf.add(schnabel);
  const fisch = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.03), mat(0xcfd8de));
  fisch.position.set(0.3, -0.04, 0);
  fisch.visible = false;
  kopf.add(fisch);
  oben.add(kopf);
  hals.add(oben);
  k.add(hals);
  // Flügel: angelegt sind sie im Rumpf versteckt, im Flug breiten sie sich aus
  const fluegel = [];
  for (const s of [-1, 1]) {
    const f = new THREE.Group();
    f.position.set(0, 0.06, s * 0.12);
    const fg = new THREE.BoxGeometry(0.62, 0.03, 0.95);
    fg.translate(-0.05, 0, s * 0.47);
    const fm = new THREE.Mesh(fg, mat(grau));
    f.add(fm);
    const spitze = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.032, 0.4), mat(dunkel));
    spitze.position.set(-0.1, 0, s * 0.85);
    f.add(spitze);
    f.visible = false;
    k.add(f);
    fluegel.push(f);
  }
  const beine = [];
  for (const s of [-1, 1]) {
    const b = bein(dunkel, 0.035, 0.95, -0.02, 0, s * 0.07);
    k.add(b);
    beine.push(b);
  }
  g.userData = { k, hals, oben, kopf, fluegel, beine, fisch };
  return g;
}

/** Kleines Pixelherz als Sprite (Katze antippen). */
function baueHerz() {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 16;
  const x = c.getContext('2d');
  const muster = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
  x.fillStyle = '#e2504a';
  muster.forEach((z, j) => [...z].forEach((ch, i) => { if (ch === '#') x.fillRect(1 + i * 2, 2 + j * 2, 2, 2); }));
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  s.scale.set(0.6, 0.6, 1);
  s.visible = false;
  s.renderOrder = 10;
  return s;
}

// ------------------------------------------------------------------ Modul

export function init(game) {
  if (typeof document === 'undefined' || !game.scene) return null;
  const wurzel = new THREE.Group();
  wurzel.name = 'hafentiere';
  game.scene.add(wurzel);
  const herz = baueHerz();
  wurzel.add(herz);
  let herzZeit = -1;

  // Fell nach dem Seed des Spiels: jedes Spiel hat seine eigene Katze und seinen eigenen Hund
  const seed = () => (game.sim?.state?.seed ?? game.state?.seed ?? 1) >>> 0;
  let fellSeed = null;

  const tiere = {
    katze: { art: 'katze', gruppe: null, x: 0, y: 0, z: 0, dir: 0, zustand: 'weg', pose: 'sitzt', timer: 0, pfad: null, node: null, sichtbar: false },
    hund: { art: 'hund', gruppe: null, x: 0, y: 0, z: 0, dir: 0, zustand: 'weg', pose: 'steht', timer: 0, pfad: null, node: null, sichtbar: false, wedeln: 0, ruhe: 0 },
    reiher: { art: 'reiher', gruppe: null, x: 0, y: 0, z: 0, dir: 0, zustand: 'weg', pose: 'steht', timer: 0, flug: null, spot: null, sichtbar: false, pruef: 0 },
  };

  function modelleBauen() {
    const s = seed();
    if (fellSeed === s && tiere.katze.gruppe) return;
    fellSeed = s;
    for (const t of Object.values(tiere)) if (t.gruppe) wurzel.remove(t.gruppe);
    tiere.katze.gruppe = baueKatze(KATZEN_FELL[s % KATZEN_FELL.length]);
    tiere.hund.gruppe = baueHund(HUNDE_FELL[Math.floor(s / 7) % HUNDE_FELL.length]);
    tiere.reiher.gruppe = baueReiher();
    for (const t of Object.values(tiere)) {
      t.gruppe.name = t.art;
      t.gruppe.visible = false;
      wurzel.add(t.gruppe);
    }
  }

  // ---------------------------------------------------------------- Umgebung
  const netz = () => game.people?.netz ?? null;
  const stufe = () => game.sim?.state?.stage ?? game.state?.stage ?? 1;
  const tagesAnteil = () => {
    const r = game.sim?.ctx?.rules, st = game.sim?.state;
    if (!r?.dayLength || !st) return 0.4;
    const c = st.clock ?? 0, abend = r.eveningLength || 1;
    return c < r.dayLength ? 0.75 * (c / r.dayLength) : Math.min(1, 0.75 + 0.25 * ((c - r.dayLength) / abend));
  };
  const nacht = () => (game.landscape?.licht?.zustand?.nacht ?? 0) > 0.55 || tagesAnteil() > 0.93;
  let regen = false;
  game.on('weather', (w) => { regen = (w?.rain ?? 0) >= 0.3 || (w?.snow ?? 0) > 0.5; });
  const ls = () => game.landscape;
  const istWasser = (x, z) => (ls()?.istWasser ? ls().istWasser(x, z) : false);
  const tiefe = (x, z) => (ls()?.tiefeBei ? ls().tiefeBei(x, z) : 0);
  const hoeheLand = (x, z) => {
    const h = ls()?.hoeheBei?.(x, z) ?? game.landschaft?.hoeheBei?.(x, z);
    return Number.isFinite(h) ? h : 0.3;
  };
  const deck = (bauart, standard) => {
    const h = game.stege?.deckHoehe?.(bauart);
    return Number.isFinite(h) ? h : standard;
  };
  /** Knoten des Wegenetzes in Weltkoordinaten (wie render/people.js) */
  function welt(n, i) {
    const k = n.nodes[i];
    const x = k.x * U, z = -k.y * U;
    let y;
    switch (k.art) {
      case 'holz': y = deck('holz', 0.86); break;
      case 'schwimmsteg': y = deck('schwimmsteg', 0.46); break;
      case 'kai': y = deck('kai', 1.3); break;
      case 'pier': y = deck('pier', 1.6); break;
      case 'mole': y = Math.max(1.4, hoeheLand(x, z)); break;
      case 'bruecke': y = 1.9; break;
      default: y = hoeheLand(x, z);
    }
    return { x, y, z, i };
  }
  const knotenBei = (n, x, z, komp) => n.naechster(x / U, -z / U, komp);

  // Orte je Netz (neu, sobald game.people.netz ein anderes ist)
  let orte = null;
  function orteVon(n) {
    if (orte?.netz === n) return orte;
    let heim = null;
    for (const art of ['hafenmeister', 'hafenbuero']) {
      const z = n.ziele.find((t) => t.art === art && n.komp[t.node] === n.flaechen.festland);
      if (z) { heim = z.node; break; }
    }
    if (heim == null) heim = n.naechster(n.zentrum.x, n.zentrum.y - 10, n.flaechen.festland);
    const komp = n.komp[heim];
    const h = n.nodes[heim];
    const nah = (i, max) => Math.hypot(n.nodes[i].x - h.x, n.nodes[i].y - h.y) <= max;
    const land = [], steg = [], mole = [];
    for (let i = 0; i < n.nodes.length; i++) {
      const k = n.nodes[i];
      if (n.komp[i] !== komp || !LAUFBAR.has(k.art)) continue;
      if (STEG.has(k.art) && nah(i, 160)) steg.push(i);
      else if (k.art === 'mole') mole.push(i);
      else if ((k.art === 'land' || k.art === 'sand') && nah(i, 110)) land.push(i);
    }
    // Ein zweiter Platz neben der Tür für den Hund
    // Der Hund liegt ein paar Meter neben der Tür (nicht auf der Katze)
    const neben = land.filter((i) => { const d = Math.hypot(n.nodes[i].x - h.x, n.nodes[i].y - h.y); return d >= 8 && d <= 16; });
    orte = { netz: n, heim, heimHund: neben[0] ?? (n.adj[heim] || []).find((i) => LAUFBAR.has(n.nodes[i].art)) ?? heim, komp, land, steg, mole, reiherSpots: null };
    return orte;
  }

  /** Belegte Plätze mit ihrem Einstieg im Netz: [{ platz, node, x, y }] */
  function belegte(n) {
    const out = [];
    const berths = game.sim?.state?.berths ?? game.state?.berths ?? {};
    for (const [platz, boot] of Object.entries(berths)) {
      if (boot == null) continue;
      const p = n.plaetze?.get?.(platz);
      if (p?.einstieg != null && n.komp[p.einstieg] === orte?.komp) out.push({ platz, node: p.einstieg, x: p.x, y: p.y });
    }
    return out;
  }

  function bootePos() {
    const out = [];
    for (const b of game.boatView?.boote ?? []) {
      const m = b.anim?.model ?? b.anim?.group;
      const p = m?.position;
      if (p) out.push({ x: p.x, z: p.z, r: Math.max(2, (m.userData?.length ?? 8) * 0.5), faehrt: b.zustand !== 'moored' && b.zustand !== 'idle' });
    }
    return out;
  }
  function menschenPos() {
    const out = [];
    for (const a of game.people?._agenten ?? []) {
      if (a.zustand === 'entfernt' || a.zustand === 'drinnen' || a.zustand === 'anbord') continue;
      out.push(a);
    }
    return out;
  }

  // ---------------------------------------------------------------- Laufen an Land
  function setzeAuf(t, n, i) {
    const w = welt(n, i);
    t.x = w.x; t.y = w.y; t.z = w.z; t.node = i;
  }
  /** Weg über das Netz zum Knoten ziel. Gibt false zurück, wenn es keinen gibt. */
  function geheZu(t, n, ziel, tempo, danach) {
    if (ziel == null) return false;
    const von = t.node != null && t.node < n.nodes.length ? t.node : knotenBei(n, t.x, t.z, orte.komp);
    if (von == null || von < 0) return false;
    const p = von === ziel ? [ziel] : n.weg(von, ziel);
    if (!p?.length) return false;
    const pfad = [{ x: t.x, y: t.y, z: t.z }, ...p.map((i) => welt(n, i))];
    t.pfad = pfad; t.pi = 0; t.tempo = tempo; t.danach = danach; t.zielNode = ziel;
    t.zustand = 'geht';
    return true;
  }
  /** Ein Stück laufen. Gibt true zurück, wenn das Ziel erreicht ist. */
  function laufe(t, dt) {
    if (!t.pfad) return true;
    let rest = t.tempo * dt;
    while (rest > 0 && t.pi < t.pfad.length - 1) {
      const b = t.pfad[t.pi + 1];
      const dx = b.x - t.x, dz = b.z - t.z;
      const d = Math.hypot(dx, dz);
      if (d < 1e-3) { t.pi++; t.y = b.y; continue; }
      const s = Math.min(rest, d);
      const a = t.pfad[t.pi];
      t.x += (dx / d) * s; t.z += (dz / d) * s;
      const ges = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      const u = 1 - Math.hypot(b.x - t.x, b.z - t.z) / ges;
      t.y = a.y + (b.y - a.y) * Math.max(0, Math.min(1, u));
      t.zielDir = Math.atan2(dz, dx);
      rest -= s;
      if (s >= d - 1e-6) { t.pi++; t.x = b.x; t.z = b.z; t.y = b.y; if (b.i != null) t.node = b.i; }
    }
    if (t.pi >= t.pfad.length - 1) {
      const e = t.pfad[t.pfad.length - 1];
      if (e.i != null) t.node = e.i;
      t.pfad = null;
      return true;
    }
    return false;
  }
  function drehe(t, dt, tempo = 5) {
    if (t.zielDir == null) return;
    t.dir += winkelDiff(t.dir, t.zielDir) * Math.min(1, dt * tempo);
  }
  const schaueZu = (t, x, z) => { t.zielDir = Math.atan2(z - t.z, x - t.x); };
  const zufallsKnoten = (liste, n, um, maxEinheiten) => {
    const k = n.nodes[um];
    const nah = maxEinheiten ? liste.filter((i) => Math.hypot(n.nodes[i].x - k.x, n.nodes[i].y - k.y) <= maxEinheiten) : liste;
    return nah.length ? wahl(nah) : liste.length ? wahl(liste) : null;
  };

  // ---------------------------------------------------------------- Katze
  function katzeNeu(t, n, o, dt) {
    const u = tagesAnteil();
    const hund = tiere.hund;
    if (t.zustand === 'drinnen') return;
    t.fluchtPause = Math.max(0, (t.fluchtPause || 0) - dt);
    // Hund zu nah: weglaufen, Schwanz dick
    const dHund = Math.hypot(hund.x - t.x, hund.z - t.z);
    // Weg läuft sie, wenn der Hund auf sie zukommt oder an ihr vorbeirennt (nicht, wenn er nur vorbeigeht)
    if (!t.fluchtPause && hund.sichtbar && t.zustand !== 'flieht' && ((hund.jagt && dHund < KATZE_HUND + 1) || (hund.pose === 'rennt' && dHund < KATZE_HUND - 0.8))) {
      t.fluchtPause = 3;
      const weg = o.land.concat(o.steg).filter((i) => {
        const w = n.nodes[i];
        const d = Math.hypot(w.x * U - hund.x, -w.y * U - hund.z);
        return d > 12 && d < 30;
      });
      if (weg.length && geheZu(t, n, wahl(weg), TEMPO.katzeFlucht, 'putzt')) { t.zustand = 'flieht'; t.pose = 'rennt'; return; }
    }
    if (t.zustand === 'geht' || t.zustand === 'flieht') {
      if (laufe(t, dt)) { t.zustand = t.danach || 'sitzt'; t.timer = t.zustand === 'liegt' ? zuf(40, 110) : zuf(10, 30); t.danach = null; if (t.blickZiel) { schaueZu(t, t.blickZiel.x, t.blickZiel.z); t.blickZiel = null; } }
      t.pose = t.zustand === 'flieht' ? 'rennt' : t.zustand === 'geht' ? 'geht' : t.zustand;
      return;
    }
    if (t.zustand === 'zuhause') {
      // Regen: im Haus; danach kommt sie an der Tür heraus
      if (!regen) { setzeAuf(t, n, o.heim); t.zustand = 'sitzt'; t.timer = zuf(4, 10); }
      return;
    }
    t.timer -= dt;
    t.pose = t.zustand;
    if (regen) { if (!geheZu(t, n, o.heim, TEMPO.katze * 1.6, 'drinnen')) t.zustand = 'drinnen'; return; }
    if (t.timer > 0) return;
    // Nächste Tätigkeit nach Tageszeit
    const r = Math.random();
    const boote = belegte(n);
    if (nacht()) {
      // Nachts streift sie über Stege und Ufer
      const ziel = r < 0.5 && o.steg.length ? zufallsKnoten(o.steg, n, o.heim, 120) : r < 0.85 ? zufallsKnoten(o.land, n, o.heim, 70) : o.heim;
      if (!geheZu(t, n, ziel, TEMPO.katze, r < 0.6 ? 'sitzt' : 'putzt')) t.timer = 6;
    } else if (u < 0.3 && boote.length && r < 0.65) {
      // Morgens: zu einem Boot, davor sitzen (vielleicht fällt ein Fisch ab)
      const b = wahl(boote);
      t.blickZiel = { x: b.x * U, z: -b.y * U };
      if (!geheZu(t, n, b.node, TEMPO.katze, 'sitzt')) t.timer = 6;
    } else if (u >= 0.3 && u < 0.62 && r < 0.6) {
      // Mittags: in der Sonne schlafen
      if (!geheZu(t, n, zufallsKnoten(o.land, n, o.heim, 45), TEMPO.katze, 'liegt')) t.timer = 6;
    } else if (r < 0.75) {
      if (!geheZu(t, n, zufallsKnoten(r < 0.35 && o.steg.length ? o.steg : o.land, n, o.heim, 80), TEMPO.katze, r < 0.5 ? 'putzt' : 'sitzt')) t.timer = 6;
    } else if (!geheZu(t, n, o.heim, TEMPO.katze, u > 0.75 ? 'liegt' : 'sitzt')) t.timer = 6;
  }

  // ---------------------------------------------------------------- Hund
  let begruessen = null;          // Platz, an dem gerade ein Boot festgemacht hat
  let spur = [];                  // Spur des Hafenmeisters beim Rundgang (Weltpunkte)
  function rundgangAgent() {
    const a = game.people?.rundgang?.agent;
    return a && (a.zustand === 'geht' || a.zustand === 'verweilt' || a.zustand === 'steht') ? a : null;
  }
  function hundNeu(t, n, o, dt) {
    const u = tagesAnteil();
    t.ruhe = Math.max(0, t.ruhe - dt);
    t.wedeln = Math.max(0, t.wedeln - dt);
    if (t.zustand === 'zuhause') {
      if (!regen) { setzeAuf(t, n, o.heimHund); t.zustand = 'steht'; t.timer = zuf(3, 8); }
      return;
    }
    if (regen && t.zustand !== 'drinnen' && t.zustand !== 'geht') {
      if (!geheZu(t, n, o.heim, TEMPO.hundRennt, 'drinnen')) t.zustand = 'drinnen';
      return;
    }
    // Abends: mit dem Hafenmeister über die Stege
    const hm = !regen ? rundgangAgent() : null;
    t.meisterPause = Math.max(0, (t.meisterPause || 0) - dt);
    if (hm && t.zustand !== 'folgt' && t.zustand !== 'zumMeister' && !t.meisterPause) {
      spur = [];
      t.meisterPause = 5;
      if (geheZu(t, n, knotenBei(n, hm.x, hm.z, o.komp), TEMPO.hundRennt, 'folgt')) { t.jagt = false; t.zustand = 'zumMeister'; t.pose = 'rennt'; return; }
    }
    if (t.zustand === 'zumMeister') {
      if (!hm) { t.zustand = 'steht'; t.pfad = null; t.timer = 1; return; }
      t.pose = 'rennt';
      if (laufe(t, dt) || Math.hypot(hm.x - t.x, hm.z - t.z) < 2.5) { t.zustand = 'folgt'; t.pfad = null; spur = [{ x: t.x, y: t.y, z: t.z }]; }
      return;
    }
    if (t.zustand === 'folgt') {
      if (!hm) {
        // Feierabend: vor dem Büro schlafen
        if (!geheZu(t, n, o.heimHund, TEMPO.hund, 'liegt')) { t.zustand = 'liegt'; t.timer = 60; }
        return;
      }
      const letzte = spur[spur.length - 1];
      if (!letzte || Math.hypot(hm.x - letzte.x, hm.z - letzte.z) > 0.4) spur.push({ x: hm.x, y: hm.y, z: hm.z });
      // Abstand entlang der Spur bis zum Hafenmeister
      let rest = 0;
      for (let i = spur.length - 1; i > 0; i--) rest += Math.hypot(spur[i].x - spur[i - 1].x, spur[i].z - spur[i - 1].z);
      rest += spur.length ? Math.hypot(spur[0].x - t.x, spur[0].z - t.z) : 0;
      if (rest > 1.8 && spur.length) {
        const tempo = rest > 5 ? TEMPO.hundRennt : TEMPO.hund * 1.1;
        let s = tempo * dt;
        while (s > 0 && spur.length > 1) {
          const p = spur[0];
          const d = Math.hypot(p.x - t.x, p.z - t.z);
          if (d <= s) { t.x = p.x; t.y = p.y; t.z = p.z; s -= d; spur.shift(); continue; }
          t.x += ((p.x - t.x) / d) * s; t.z += ((p.z - t.z) / d) * s; t.y += (p.y - t.y) * Math.min(1, s / d);
          t.zielDir = Math.atan2(p.z - t.z, p.x - t.x);
          s = 0;
        }
        t.pose = tempo > TEMPO.hund * 1.2 ? 'rennt' : 'geht';
      } else {
        t.pose = 'sitzt';
        schaueZu(t, hm.x, hm.z);
        t.wedeln = 1;
      }
      return;
    }
    // Ein Boot hat festgemacht: hinlaufen und begrüßen
    t.posiert = Math.max(0, (t.posiert || 0) - dt);
    if (begruessen && t.zustand !== 'geht' && t.zustand !== 'drinnen' && !t.ruhe && !t.posiert) {
      const p = n.plaetze?.get?.(begruessen);
      begruessen = null;
      if (p?.einstieg != null && n.komp[p.einstieg] === o.komp) {
        t.blickZiel = { x: p.x * U, z: -p.y * U };
        if (geheZu(t, n, p.einstieg, TEMPO.hundRennt, 'begruesst')) { t.ruhe = 25; t.begruesst = true; }
      }
    }
    if (t.zustand === 'geht') {
      t.pose = t.tempo > TEMPO.hund * 1.2 ? 'rennt' : 'geht';
      if (laufe(t, dt)) {
        t.jagt = false;
        t.zustand = t.danach || 'steht';
        t.danach = null;
        t.timer = t.zustand === 'liegt' ? zuf(40, 120) : t.zustand === 'begruesst' ? zuf(8, 14) : zuf(3, 9);
        if (t.blickZiel) { schaueZu(t, t.blickZiel.x, t.blickZiel.z); t.blickZiel = null; }
        if (t.zustand === 'begruesst') { t.wedeln = t.timer; t.besuche = (t.besuche || 0) + 1; game.emit('hafentiere:begruesst', {}); }
      }
      return;
    }
    if (t.zustand === 'drinnen') return;
    t.timer -= dt;
    t.pose = t.zustand === 'begruesst' ? 'sitzt' : t.zustand;
    if (t.timer > 0) return;
    const r = Math.random();
    if (nacht() || u > 0.85) {
      if (!geheZu(t, n, o.heimHund, TEMPO.hund, 'liegt')) { t.zustand = 'liegt'; t.timer = 30; }
    } else if (u > 0.35 && u < 0.55 && r < 0.4) {
      if (!geheZu(t, n, o.heimHund, TEMPO.hund, 'liegt')) t.timer = 5;
    } else if (r < 0.12 && tiere.katze.sichtbar && tiere.katze.zustand !== 'drinnen') {
      // Neugierig: zur Katze (die läuft dann weg)
      const k = knotenBei(n, tiere.katze.x, tiere.katze.z, o.komp);
      if (!geheZu(t, n, k, TEMPO.hundRennt, 'schnueffelt')) t.timer = 4;
      else t.jagt = true;
    } else if (!geheZu(t, n, zufallsKnoten(r < 0.3 && o.steg.length ? o.steg : o.land, n, o.heim, 120), TEMPO.hund, 'schnueffelt')) t.timer = 4;
  }

  // ---------------------------------------------------------------- Reiher
  /** Plätze für den Reiher: flaches Wasser dicht am Ufer, nicht bei den Liegeplätzen; dazu Molenköpfe. */
  function reiherSpots(n, o) {
    if (o.reiherSpots) return o.reiherSpots;
    const r = game.gelaende?.startRect?.();
    const mx = r ? (r.minX + r.maxX) / 2 : n.zentrum.x * U, mz = r ? (r.minZ + r.maxZ) / 2 : -n.zentrum.y * U;
    const w = r ? Math.max(r.maxX - r.minX, r.maxZ - r.minZ) : 200;
    const plaetze = [...(n.plaetze?.values?.() ?? [])].map((p) => ({ x: p.x * U, z: -p.y * U }));
    const spots = [];
    // Naturecke (P52): am Rand des Schilfgürtels steht der Reiher am liebsten
    for (const p of game.naturecke?.reiherPlaetze?.() ?? []) spots.push({ x: p.x, y: -0.22, z: p.z, blick: p.blick, art: 'schilf' });
    const frei = (x, z) => plaetze.every((p) => Math.hypot(p.x - x, p.z - z) > 16) && spots.every((s) => Math.hypot(s.x - x, s.z - z) > 10);
    for (let k = 0; k < 2400 && spots.length < 14; k++) {
      const a = (k * 2.399963) % (Math.PI * 2);
      const d = Math.sqrt((k + 0.5) / 2400) * (w * 0.75 + 40);
      const x = mx + Math.cos(a) * d, z = mz + Math.sin(a) * d;
      if (!istWasser(x, z)) continue;
      const t = tiefe(x, z);
      if (!(t > 0.08 && t < 0.7)) continue;
      // Ufer in der Nähe: ein Landpunkt in höchstens 5 m
      let ufer = null;
      for (let j = 0; j < 8 && !ufer; j++) {
        const b = (j / 8) * Math.PI * 2;
        for (const s of [2.5, 5]) if (!istWasser(x + Math.cos(b) * s, z + Math.sin(b) * s)) { ufer = { x: x + Math.cos(b) * s, z: z + Math.sin(b) * s }; break; }
      }
      if (!ufer || !frei(x, z)) continue;
      spots.push({ x, y: -0.22, z, blick: Math.atan2(ufer.z - z, ufer.x - x) + Math.PI, art: 'wasser' });
    }
    // Molen: das äußere Ende jeder Mole (Reiher stehen gern auf Steinen)
    for (const i of o.mole.filter((_, j) => j % 5 === 0).slice(0, 8)) {
      const p = welt(n, i);
      if (frei(p.x, p.z)) spots.push({ x: p.x, y: p.y, z: p.z, blick: Math.random() * Math.PI * 2, art: 'mole' });
    }
    o.reiherSpots = spots;
    return spots;
  }
  function bedroht(t, x, z) {
    for (const b of bootePos()) if (Math.hypot(b.x - x, b.z - z) < b.r + NAH_BOOT) return true;
    for (const a of menschenPos()) if (Math.hypot(a.x - x, a.z - z) < NAH_MENSCH) return true;
    const h = tiere.hund;
    if (h.sichtbar && Math.hypot(h.x - x, h.z - z) < NAH_HUND) return true;
    return false;
  }
  function fliege(t, ziel, { weg = false } = {}) {
    const d = Math.hypot(ziel.x - t.x, ziel.z - t.z);
    const hoch = weg ? 30 : Math.max(5, Math.min(18, d * 0.18));
    t.flug = { a: { x: t.x, y: t.y, z: t.z }, b: ziel, s: 0, dauer: Math.max(2.2, d / TEMPO.reiherFlug), hoch, weg };
    t.zustand = 'fliegt';
    t.pose = 'fliegt';
    t.spot = weg ? null : ziel;
    t.zielDir = Math.atan2(ziel.z - t.z, ziel.x - t.x);
    t.dir = t.zielDir;
  }
  function neuerSpot(t, spots, weg = false) {
    const kand = spots.filter((s) => s !== t.spot && !bedroht(t, s.x, s.z));
    if (!kand.length) return null;
    // Lieber nicht zu weit, aber auch nicht gleich nebenan
    kand.sort((a, b) => Math.abs(Math.hypot(a.x - t.x, a.z - t.z) - 60) - Math.abs(Math.hypot(b.x - t.x, b.z - t.z) - 60));
    // Am Schilf der Naturecke (P52) lieber als anderswo, wenn er nicht gerade von dort kommt
    const schilf = kand.filter((s) => s.art === 'schilf');
    if (!weg && schilf.length && t.spot?.art !== 'schilf' && Math.random() < 0.6) return wahl(schilf);
    return weg ? kand[0] : wahl(kand.slice(0, 4));
  }
  function schlafplatz(n) {
    const r = game.gelaende?.startRect?.();
    const mx = r ? (r.minX + r.maxX) / 2 : n.zentrum.x * U, mz = r ? (r.minZ + r.maxZ) / 2 : -n.zentrum.y * U;
    const w = r ? Math.max(r.maxX - r.minX, r.maxZ - r.minZ) : 200;
    // Landeinwärts (vom Hafen zum Dorf), weit hinter dem Bild
    const h = n.nodes[orte.heim];
    const dx = h.x * U - mx, dz = -h.y * U - mz;
    const l = Math.hypot(dx, dz) || 1;
    return { x: mx + (dx / l) * (w * 0.6 + 90) + zuf(-40, 40), y: 30, z: mz + (dz / l) * (w * 0.6 + 90) + zuf(-40, 40) };
  }
  function reiherNeu(t, n, o, dt) {
    const spots = reiherSpots(n, o);
    const u = tagesAnteil();
    const schlafen = nacht() || u > 0.86;
    if (t.zustand === 'fliegt') {
      const f = t.flug;
      f.s += dt / f.dauer;
      const s = Math.min(1, f.s);
      const e = s * s * (3 - 2 * s);
      t.x = f.a.x + (f.b.x - f.a.x) * e;
      t.z = f.a.z + (f.b.z - f.a.z) * e;
      const bogen = Math.sin(Math.PI * s) * f.hoch;
      t.y = f.a.y + (f.b.y - f.a.y) * s + bogen;
      if (s >= 1) {
        t.flug = null;
        if (f.weg) { t.zustand = 'weg'; t.timer = 0; return; }
        t.zustand = 'steht'; t.pose = 'steht'; t.timer = zuf(15, 45);
        t.zielDir = f.b.blick ?? t.dir;
      }
      return;
    }
    if (t.zustand === 'weg') {
      // Tagsüber kommt er wieder (von weit her angeflogen). Beim Laden des Spiels steht er gleich da.
      if (!schlafen && spots.length && u < 0.8) {
        const z = neuerSpot(t, spots);
        if (z && !t.warDa) { t.x = z.x; t.y = z.y; t.z = z.z; t.spot = z; t.dir = t.zielDir = z.blick; t.zustand = 'steht'; t.pose = 'steht'; t.timer = zuf(5, 20); }
        else if (z) { const s = schlafplatz(n); t.x = s.x; t.y = s.y; t.z = s.z; fliege(t, z); }
        t.warDa = true;
      }
      return;
    }
    if (schlafen) { fliege(t, schlafplatz(n), { weg: true }); return; }
    // Bedrohung prüfen (zweimal je Sekunde reicht)
    t.pruef -= dt;
    if (t.pruef <= 0) {
      t.pruef = 0.5;
      if (bedroht(t, t.x, t.z)) {
        const z = neuerSpot(t, spots);
        if (z) { fliege(t, z); t.aufgeflogen = (t.aufgeflogen || 0) + 1; return; }
        fliege(t, schlafplatz(n), { weg: true });
        return;
      }
    }
    t.timer -= dt;
    if (t.zustand === 'schreitet') {
      const d = Math.hypot(t.schritt.x - t.x, t.schritt.z - t.z);
      const s = TEMPO.reiherSchritt * dt;
      if (d <= s) { t.zustand = 'steht'; t.pose = 'steht'; t.timer = zuf(8, 25); return; }
      t.x += ((t.schritt.x - t.x) / d) * s; t.z += ((t.schritt.z - t.z) / d) * s;
      t.pose = 'schreitet';
      return;
    }
    if (t.zustand === 'stoesst') {
      t.pose = 'stoesst';
      if (t.timer <= 0) { t.zustand = 'steht'; t.pose = 'steht'; t.timer = zuf(6, 20); t.fang = 0; }
      return;
    }
    t.pose = 'steht';
    if (t.timer > 0) return;
    const r = Math.random();
    if (r < 0.45) {
      t.zustand = 'stoesst'; t.timer = 2.2; t.stossStart = 2.2;
      t.fang = Math.random() < 0.4 ? 1 : 0;
      if (t.fang) t.faenge = (t.faenge || 0) + 1;
    } else if (r < 0.8 && t.spot?.art === 'wasser') {
      // Ein paar Schritte im flachen Wasser
      for (let k = 0; k < 6; k++) {
        const b = t.dir + zuf(-1.2, 1.2), d = zuf(1, 2.5);
        const x = t.x + Math.cos(b) * d, z = t.z + Math.sin(b) * d;
        const tf = tiefe(x, z);
        if (istWasser(x, z) && tf > 0.05 && tf < 0.75) { t.schritt = { x, z }; t.zustand = 'schreitet'; t.zielDir = b; break; }
      }
      if (t.zustand !== 'schreitet') t.timer = zuf(5, 15);
    } else if (r < 0.9 && spots.length > 1) {
      const z = neuerSpot(t, spots);
      if (z) fliege(t, z); else t.timer = 10;
    } else {
      t.zielDir = t.dir + zuf(-1, 1);
      t.timer = zuf(8, 20);
    }
  }

  // ---------------------------------------------------------------- Posen zeichnen
  function zeichneKatze(t, uhr, dt) {
    const g = t.gruppe, d = g.userData;
    g.position.set(t.x, t.y, t.z);
    g.rotation.y = -t.dir;
    const p = t.pose;
    const lauf = p === 'geht' || p === 'rennt';
    const f = p === 'rennt' ? 14 : 8;
    d.k.rotation.z = p === 'sitzt' || p === 'putzt' || p === 'schnurrt' ? 0.62 : 0;
    d.k.position.y = p === 'liegt' ? -0.2 : 0;
    d.k.scale.set(1, p === 'liegt' ? 0.85 + Math.sin(uhr * 1.6) * 0.03 : 1, p === 'liegt' ? 1.15 : 1);
    d.beine.forEach((b, i) => {
      b.visible = p !== 'liegt';
      const sitzt = d.k.rotation.z > 0;
      if (lauf) b.rotation.z = Math.sin(uhr * f + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * 0.55;
      else b.rotation.z = sitzt ? (i < 2 ? -0.62 : 1.0) : 0;
    });
    if (p === 'liegt') {
      d.kopf.position.set(0.62, 0.42, 0.16);
      d.kopf.rotation.set(0, 0.6, -0.2);
      d.schwanz.rotation.set(1.2, 0, 1.7);
    } else {
      d.kopf.position.set(0.68, 0.5, 0);
      const putzen = p === 'putzt' ? Math.sin(uhr * 5) * 0.25 - 0.45 : 0;
      d.kopf.rotation.set(p === 'putzt' ? 0.4 : 0, p === 'putzt' ? 0.5 : Math.sin(uhr * 0.4 + 1) * 0.15, (d.k.rotation.z ? -0.62 : 0) + putzen);
      // Schwanz: beim Laufen hoch, sitzend um die Pfoten, auf der Flucht dick und gerade
      if (p === 'rennt') d.schwanz.rotation.set(0, 0, 0.9);
      else if (lauf || p === 'schnurrt') d.schwanz.rotation.set(Math.sin(uhr * 3) * 0.15, 0, 0.15);
      else d.schwanz.rotation.set(1.3, 0, 1.2 + Math.sin(uhr * 1.3) * 0.15);
    }
    d.schwanz.scale.setScalar(p === 'rennt' ? 1.5 : 1);
    if (lauf) g.position.y += Math.abs(Math.sin(uhr * f)) * 0.03;
    const augen = nacht() && p !== 'liegt';
    for (const a of d.augen) a.visible = augen;
  }

  function zeichneHund(t, uhr) {
    const g = t.gruppe, d = g.userData;
    g.position.set(t.x, t.y, t.z);
    g.rotation.y = -t.dir;
    const p = t.pose;
    const lauf = p === 'geht' || p === 'rennt';
    const f = p === 'rennt' ? 13 : 7;
    const sitzt = p === 'sitzt' || p === 'begruesst';
    d.k.rotation.z = sitzt ? 0.5 : 0;
    d.k.position.y = p === 'liegt' ? -0.34 : 0;
    d.beine.forEach((b, i) => {
      if (lauf) b.rotation.z = Math.sin(uhr * f + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * (p === 'rennt' ? 0.7 : 0.45);
      else if (p === 'liegt') b.rotation.z = i < 2 ? -1.45 : 1.45;
      else b.rotation.z = sitzt ? (i < 2 ? -0.5 : 1.3) : 0;
    });
    // Kopf: beim Schnüffeln zum Boden, sonst leicht wippend
    const schnueffelt = p === 'schnueffelt';
    d.kopf.rotation.set(0, schnueffelt ? Math.sin(uhr * 2) * 0.3 : Math.sin(uhr * 0.5) * 0.12, schnueffelt ? -0.9 + Math.sin(uhr * 9) * 0.05 : sitzt ? -0.5 : p === 'liegt' ? -0.35 : 0);
    d.kopf.position.y = p === 'liegt' ? 0.62 : 0.82;
    const wedelt = t.wedeln > 0 || lauf || p === 'springt';
    d.schwanz.rotation.set(wedelt ? Math.sin(uhr * (t.wedeln > 0 ? 18 : 9)) * 0.6 : 0, 0, p === 'liegt' ? 1.8 : wedelt ? 0.5 : 0.9);
    if (lauf) g.position.y += Math.abs(Math.sin(uhr * f)) * 0.04;
    if (p === 'springt') g.position.y += Math.abs(Math.sin(uhr * 9)) * 0.35;
  }

  function zeichneReiher(t, uhr) {
    const g = t.gruppe, d = g.userData;
    g.position.set(t.x, t.y, t.z);
    g.rotation.y = -t.dir;
    const p = t.pose;
    const fliegt = p === 'fliegt';
    for (const fl of d.fluegel) fl.visible = fliegt;
    if (fliegt) {
      // Langsamer, tiefer Flügelschlag; Hals eingezogen, Beine nach hinten
      const schlag = Math.sin(uhr * 4.2);
      d.fluegel[0].rotation.x = -schlag * 0.7;
      d.fluegel[1].rotation.x = schlag * 0.7;
      d.k.rotation.z = 0;
      d.hals.rotation.z = 0.9;
      d.oben.rotation.z = -1.9;
      d.kopf.rotation.z = 1.0;
      for (const b of d.beine) b.rotation.z = -1.35;
      d.k.position.y = 0.6;
    } else {
      d.k.rotation.z = 0;
      d.k.position.y = 1.0;
      for (const b of d.beine) b.rotation.z = 0;
      // Stehen: Hals S-förmig, ab und zu den Kopf drehen. Stoßen: Hals schnellt nach vorn und unten.
      let hz = 0.35, oz = -0.75, kz = 0.4;
      if (p === 'stoesst') {
        const s = 1 - Math.max(0, t.timer) / (t.stossStart || 2.2);
        const zuck = s < 0.25 ? s / 0.25 : s < 0.45 ? 1 : Math.max(0, 1 - (s - 0.45) / 0.35);
        hz = 0.35 - zuck * 1.5; oz = -0.75 + zuck * 0.55; kz = 0.4 - zuck * 0.5;
        d.fisch.visible = !!t.fang && s > 0.4 && s < 0.9;
      } else d.fisch.visible = false;
      if (p === 'schreitet') {
        d.beine[0].rotation.z = Math.sin(uhr * 2.4) * 0.35;
        d.beine[1].rotation.z = -Math.sin(uhr * 2.4) * 0.35;
        hz = 0.1; oz = -0.4;
      }
      d.hals.rotation.z = hz;
      d.oben.rotation.z = oz;
      d.kopf.rotation.z = kz;
      d.kopf.rotation.y = p === 'steht' ? Math.sin(uhr * 0.3) * 0.25 : 0;
    }
  }

  // ---------------------------------------------------------------- Takt
  const DABEI = { katze: () => stufe() >= HAFENTIER_TEXTE.katze.stufe, hund: () => stufe() >= HAFENTIER_TEXTE.hund.stufe, reiher: () => stufe() >= HAFENTIER_TEXTE.reiher.stufe };
  let letzte = performance.now();
  let netzAlt = null;
  function takt() {
    const jetzt = performance.now();
    const echt = Math.min(0.25, (jetzt - letzte) / 1000);
    letzte = jetzt;
    const n = netz();
    if (!n || !game.sim?.state) { for (const t of Object.values(tiere)) if (t.gruppe) t.gruppe.visible = false; return; }
    modelleBauen();
    const o = orteVon(n);
    const tempo = game.paused ? 0 : (game.speed ?? 1);
    const dt = echt * tempo;
    const uhr = jetzt / 1000;
    // Neues Netz (Stufe, Bauen, Laden): Tiere auf den nächsten Knoten setzen, laufende Wege neu
    if (n !== netzAlt) {
      netzAlt = n;
      for (const t of [tiere.katze, tiere.hund]) {
        if (t.zustand === 'weg') continue;
        const k = knotenBei(n, t.x, t.z, o.komp);
        if (k == null || k < 0) { t.zustand = 'weg'; continue; }
        setzeAuf(t, n, k);
        t.pfad = null;
        if (t.zustand === 'geht' || t.zustand === 'flieht' || t.zustand === 'zumMeister' || t.zustand === 'folgt') { t.zustand = 'steht'; t.timer = 1; }
      }
      if (tiere.reiher.zustand !== 'fliegt' && tiere.reiher.zustand !== 'weg') { tiere.reiher.zustand = 'weg'; }
    }
    const cam = game.camera;
    const winzig = cam?.viewWidth > 0 && (0.9 * (cam.screenW ?? innerWidth)) / cam.viewWidth < MIN_PX;
    for (const t of Object.values(tiere)) {
      if (!DABEI[t.art]()) { t.zustand = 'weg'; t.sichtbar = false; t.gruppe.visible = false; continue; }
      if (t.art !== 'reiher' && t.zustand === 'weg') {
        // Erscheinen: an der Tür des Büros
        setzeAuf(t, n, t.art === 'hund' ? o.heimHund : o.heim);
        t.zustand = regen ? 'drinnen' : 'steht'; t.timer = zuf(1, 5);
        if (t.art === 'katze') t.zustand = regen ? 'drinnen' : 'sitzt';
      }
      if (t.art !== 'reiher' && t.zustand === 'drinnen' && !regen) t.zustand = 'zuhause';
      if (dt > 0) {
        if (t.art === 'katze') katzeNeu(t, n, o, dt);
        else if (t.art === 'hund') hundNeu(t, n, o, dt);
        else reiherNeu(t, n, o, dt);
        if (t.reaktion > 0) t.reaktion -= dt;
      }
      t.sichtbar = t.zustand !== 'weg' && t.zustand !== 'drinnen';
      if (t.art !== 'reiher' && t.reaktion > 0) t.pose = t.art === 'hund' ? 'springt' : 'schnurrt';
      // Aus der Ferne wären sie nur ein, zwei Pixel: dann gar nicht zeichnen (spart Zeichenaufrufe am Handy)
      t.gruppe.visible = t.sichtbar && !winzig;
      if (!t.gruppe.visible) continue;
      if (t.art !== 'reiher' || t.zustand !== 'fliegt') drehe(t, dt, t.art === 'reiher' ? 1.5 : 6);
      if (t.art === 'katze') zeichneKatze(t, uhr, dt);
      else if (t.art === 'hund') zeichneHund(t, uhr);
      else zeichneReiher(t, uhr);
    }
    // Herz über der Katze
    if (herzZeit >= 0) {
      herzZeit += echt;
      const k = tiere.katze;
      herz.visible = herzZeit < 1.4 && k.sichtbar;
      herz.position.set(k.x, k.y + 0.9 + herzZeit * 1.1, k.z);
      herz.material.opacity = Math.max(0, 1 - herzZeit / 1.4);
      if (herzZeit >= 1.4) herzZeit = -1;
    }
  }
  game.onTick?.(takt);

  // Ein Boot hat festgemacht (Schiffsanimation): der Hund läuft hin
  game.on('boat:moored', (info) => {
    const platz = info?.berth ?? info?.platz;
    if (platz && Math.random() < 0.8) begruessen = String(platz);
  });
  // Stufe gewechselt oder Spiel geladen: Orte neu bestimmen
  for (const ev of ['stufe', 'build', 'stege', 'landschaft:geaendert', 'naturecke:lage', 'naturecke:wahl']) game.on(ev, () => { if (orte) orte.reiherSpots = null; });
  game.on('sim:change', (e) => {
    if (e?.reason === 'load' || e?.reason === 'new') { for (const t of Object.values(tiere)) { t.zustand = 'weg'; t.pfad = null; t.flug = null; t.warDa = false; } fellSeed = null; }
  });

  // ---------------------------------------------------------------- Antippen
  function aufSchirm(t) {
    const cam = game.camera?.camera;
    if (!cam) return null;
    const v = new THREE.Vector3(t.x, t.y + (t.art === 'reiher' ? 0.9 : 0.35), t.z).project(cam);
    if (v.z > 1 || v.z < -1) return null;
    const W = game.camera.screenW ?? innerWidth, H = game.camera.screenH ?? innerHeight;
    return { x: ((v.x + 1) / 2) * W, y: ((1 - v.y) / 2) * H };
  }
  function tippe(art) {
    const t = tiere[art];
    if (!t?.sichtbar) return false;
    if (art === 'katze') {
      t.reaktion = 3.5;
      herzZeit = 0;
      game.audio?.sfx?.('miau');
      if (t.zustand === 'geht') { t.pfad = null; t.zustand = 'sitzt'; t.timer = 4; }
      else t.timer = Math.max(t.timer, 4);
    } else if (art === 'hund') {
      t.reaktion = 1.6;
      t.wedeln = 4;
      game.audio?.sfx?.('wuff', { anzahl: 2 });
    } else if (art === 'reiher') {
      scheuche('reiher', { ton: true });
    }
    game.emit('hafentiere:tipp', { art });
    return true;
  }
  function scheuche(art = 'reiher', { ton = false } = {}) {
    const t = tiere.reiher;
    const n = netz();
    if (art !== 'reiher' || !n || !t.sichtbar || t.zustand === 'fliegt') return false;
    const z = neuerSpot(t, reiherSpots(n, orteVon(n)));
    if (z) fliege(t, z); else fliege(t, schlafplatz(n), { weg: true });
    if (ton) game.audio?.sfx?.('reiher');
    return true;
  }
  game.on('tap', (e = {}) => {
    if (document.body.classList.contains('building')) return;
    let best = null;
    for (const t of Object.values(tiere)) {
      if (!t.sichtbar || !t.gruppe?.visible) continue;
      const s = aufSchirm(t);
      if (!s) continue;
      const d = Math.hypot(s.x - e.x, s.y - e.y);
      if (d < 30 && (!best || d < best.d)) best = { t, d };
    }
    if (best) tippe(best.t.art);
  });

  // ---------------------------------------------------------------- Schnittstelle
  function motive() {
    const out = [];
    for (const t of Object.values(tiere)) {
      if (!t.sichtbar) continue;
      // Hoch in der Luft zählt der Reiher nicht (dann ist er nur ein Punkt)
      if (t.art === 'reiher' && t.zustand === 'fliegt' && t.y > 12) continue;
      out.push({ art: t.art, x: t.x, y: t.y + (t.art === 'reiher' ? 0.9 : 0.35), z: t.z, r: R_FOTO, nahBreite: NAH_BREITE });
    }
    return out;
  }
  function begruesse(platz) { begruessen = String(platz); tiere.hund.ruhe = 0; }
  /** Fürs Foto still halten: Katze oder Hund bleibt stehen und setzt sich (Fotomodus, "Suchen"). */
  function halte(art, sek = 8) {
    const t = tiere[art];
    if (!t?.sichtbar || art === 'reiher') return false;
    if (t.zustand === 'folgt' || t.zustand === 'zumMeister' || t.zustand === 'flieht') return false;
    if (t.zustand === 'geht') {
      t.pfad = null;
      t.danach = null;
      t.zustand = 'sitzt';
      // Kein Ziel mehr: danach von hier aus weiter (nächster Knoten)
      const n = netz();
      if (n && orte) t.node = knotenBei(n, t.x, t.z, orte.komp);
    }
    if (t.zustand !== 'liegt') t.zustand = 'sitzt';
    t.timer = Math.max(t.timer || 0, sek);
    t.posiert = sek;
    t.blickZiel = null;
    const cam = game.camera?.camera;
    if (cam) schaueZu(t, cam.position.x, cam.position.z);
    return true;
  }

  game.hafentiere = {
    motive,
    tier: (art) => {
      const t = tiere[art];
      return t ? { art, x: t.x, y: t.y, z: t.z, zustand: t.zustand, pose: t.pose, sichtbar: t.sichtbar, faenge: t.faenge || 0, aufgeflogen: t.aufgeflogen || 0, besuche: t.besuche || 0 } : null;
    },
    tippe,
    scheuche,
    begruesse,
    halte,
    _tiere: tiere,
    _regen: () => regen,
    _spots: () => (netz() ? reiherSpots(netz(), orteVon(netz())) : []),
  };

  // Zum Ausprobieren: ?hafentiere=katze|hund|reiher fährt die Kamera zum Tier
  const wunsch = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('hafentiere') : null;
  if (wunsch && tiere[wunsch]) {
    const t0 = Date.now();
    const v = setInterval(() => {
      const t = tiere[wunsch];
      if (Date.now() - t0 > 30000) { clearInterval(v); return; }
      if (!t.sichtbar || !game.camera?.flyTo) return;
      clearInterval(v);
      game.camera.flyTo(t.x, t.z);
      if (game.camera.zoomAt && game.camera.viewWidth > NAH_BREITE) game.camera.zoomAt(game.camera.viewWidth / NAH_BREITE);
    }, 300);
  }
  return game.hafentiere;
}

export default init;
