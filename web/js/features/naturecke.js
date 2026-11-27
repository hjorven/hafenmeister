// Naturecke am Schilf (Roadmap P52, F39): Schilfgürtel neben dem Hafen, schützen oder bebauen. docs/naturecke.md.
//
// Bild: Ein dichter Schilfgürtel steht im flachen Wasser neben den Stegen (Lage: render/landschaft/naturecke-lage.js,
// je Küste, Seed und Stegbild). Das Schilf wiegt sich im Wind, im Herbst wird es gelb und im Winter braun.
// Blässhühner schwimmen am Rand entlang, tagsüber singt der Teichrohrsänger, abends quaken die Frösche.
// Ab Ausbaustufe 2 fragt die Gemeinde, was aus dem Ufer werden soll. Im Baumenü (Reiter Hafen) stehen zwei
// Einträge, und wer einen wählt, kann nicht mehr zurück (kein Rückgängig):
// - Schilfgürtel schützen: Ein Bohlenweg führt vom Ufer ins Schilf zu einer Beobachtungshütte, ein Schild
//   steht am Ufer, ein Haubentaucher-Paar zieht ein, tagsüber gehen Spaziergänger mit Fernglas zur Hütte.
//   Gäste, die einen Abend im Hafen lagen, bewerten besser (Regeln: features/naturecke-regeln.js).
// - Ufer bebauen: Das Schilf verschwindet, das Ufer wird aufgeschüttet und mit Spundwand gefasst, darauf ein
//   Park- und Trailerplatz, der jede Stufe voller wird. Jeden Abend bringt er Geld (Tagesabschluss, Sonstiges).
//
// Schnittstelle: game.naturecke = {
//   lage()            Lage in Planeinheiten (naturLage) oder null
//   wahl()            'schutz' | 'bebaut' | null
//   angebote()        Einträge fürs Baumenü [{ id, wahl, kosten, gesperrt }]
//   entscheiden(id)   'schuetzen' oder 'bebauen' kaufen: { ok, grund?, geldFehlt? }
//   geist(id)         Geisterbild für die Vorschau
//   ort()             { x, z, breite } für die Kamera
//   imSchilf(x, z, randM)  Weltpunkt im Schilf? (Jugendtraining, Boote)
//   reiherPlaetze()   Stellen am Schilfrand für den Graureiher (render/hafentiere.js)
//   voegel()          Zustand der Vögel zum Prüfen
// }
// Ereignisse: 'naturecke:wahl' { wahl, kosten }, 'naturecke:lage' { lage }.
// Zum Ausprobieren: ?naturecke=zeigen fährt die Kamera hin, ?naturecke=schutz oder ?naturecke=bebaut entscheidet
// im Testmodus (?stufe=n) gleich.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ECONOMY } from '../data/economy.js';
import { HAFEN } from '../data/harbor.js';
import { naturLage, naturLageSpaeter, imSchilf as imSchilfLage, inWelt } from '../render/landschaft/naturecke-lage.js';
import { gelaendeform } from '../render/landschaft/formen.js';
import { regelnBereit } from './regeln-bereit.js';
import { REGELN, wahl as wahlVon, angebote as angeboteVon, entscheiden as entscheidenVon, haengeEin, nState } from './naturecke-regeln.js';

const U = HAFEN.einheiten?.meterProEinheit ?? 0.62;
const FARBE = {
  halm: { fruehling: [0x8fbf5e, 0x7fb055, 0xa0c86a], sommer: [0x6fa24c, 0x7fb055, 0x5f9444], herbst: [0xc9b25a, 0xb89a48, 0xd8c070], winter: [0xb39a72, 0xa58b66, 0xc4ad85] },
  kolben: 0x6b4a2e, holz: 0x9b7a52, holzDunkel: 0x6f553a, dach: 0x5d4a3a, schild: 0x2f6b3f, schildRand: 0xe8e2d2,
  asphalt: 0x72777d, spundwand: 0x3d4248, linie: 0xf2f2ee, blaess: 0x1f1f22, blaessSchnabel: 0xf4f1ea,
  taucher: 0x5d4a3c, taucherBauch: 0xf1ece2, taucherHaube: 0xa8552c, trailer: 0x55595f,
  autos: [0xc0392b, 0x2e5f9e, 0xf2f2f2, 0x2b2b2b, 0x7f8c8d, 0x2e8b57, 0xd4a017, 0x8e44ad, 0x34495e, 0xe67e22],
  rumpf: [0xf4f4f0, 0xe9e2cf, 0x2d4f7c, 0xb03a2e],
};

// Fester Zufall aus Zahlen (Bild soll bei jedem Laden gleich aussehen)
function hash(a, b, c = 0) {
  let h = Math.imul(Math.round(a * 37) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(Math.round(b * 53) + c * 7919, 0xc2b2ae35);
  h ^= h >>> 13; h = Math.imul(h, 0x27d4eb2d); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
const zuf = (a, b) => a + Math.random() * (b - a);

const MATS = new Map();
function mat(c, opt = {}) {
  const k = `${c}|${JSON.stringify(opt)}`;
  if (!MATS.has(k)) MATS.set(k, new THREE.MeshLambertMaterial({ color: c, flatShading: true, ...opt }));
  return MATS.get(k);
}
/**
 * Alle Teile einer fertigen Gruppe je Material zu einem Mesh zusammenfassen (weniger Zeichenaufrufe, Handy).
 * Die Gruppe selbst bleibt (Lage, Drehung, Bauanimation über position.y).
 */
function buendeln(g) {
  g.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
  const je = new Map();
  g.traverse((o) => {
    if (!o.isMesh || o === g) return;
    let v = o.visible;
    for (let p = o.parent; p && p !== g; p = p.parent) v &&= p.visible;
    if (!v) return;
    const geo = o.geometry.clone();
    geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    if (!je.has(o.material)) je.set(o.material, []);
    je.get(o.material).push(geo);
  });
  for (const c of [...g.children]) { g.remove(c); c.traverse((o) => o.geometry?.dispose?.()); }
  for (const [m, geos] of je) {
    const geo = mergeGeometries(geos, false);
    geos.forEach((x) => x.dispose());
    if (geo) g.add(new THREE.Mesh(geo, m));
  }
  g.userData.gebuendelt = true;
  return g;
}
function kasten(farbe, w, h, d, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(farbe));
  m.position.set(x, y, z);
  return m;
}
function kugel(farbe, sx, sy, sz, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), mat(farbe));
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  return m;
}

export async function init(game) {
  const api = game.naturecke = {
    lage: () => null, wahl: () => null, angebote: () => [], entscheiden: () => ({ ok: false }),
    geist: () => null, ort: () => null, imSchilf: () => false, reiherPlaetze: () => [], voegel: () => [],
  };
  if (!REGELN) return api;
  const sim = await regelnBereit(game);
  const st = () => sim.state;
  haengeEin(sim.addHook, st);

  const url = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
  const regionId = () => game.landschaft?.region ?? game.state?.region ?? 'ostsee';

  // ---------------------------------------------------------------- Lage (einmal je Spielstand gerechnet)
  // Die Suche dauert am PC 0,2 bis 2 s. Sie läuft kurz nach dem Start (nicht beim Laden der Seite) und das
  // Ergebnis kommt in den Spielstand, damit ein geladener Hafen es nicht noch einmal rechnet.
  const schluessel = () => { const f = gelaendeform(); return `${f.nr}|${f.seed}|${regionId()}|${HAFEN.stegbild?.nr ?? 0}`; };
  let lage = null, lageFuer = null, rechenMs = 0;
  function holeLage(rechnen = true) {
    const s = st();
    if (!s) return null;
    const k = schluessel();
    if (lageFuer === k && lage !== undefined) return lage;
    const gespeichert = s.modules?.naturecke?.lage;
    if (gespeichert && gespeichert.key === k) {
      lage = gespeichert.wert;
    } else {
      if (!rechnen) return null;
      const t0 = performance.now();
      lage = naturLage(regionId());
      rechenMs = Math.round(performance.now() - t0);
      nState(s).lage = { key: k, wert: lage };
    }
    lageFuer = k;
    game.emit('naturecke:lage', { lage });
    return lage;
  }
  const lageJetzt = () => (lageFuer === schluessel() ? lage : null);
  // Beim Start in kleinen Stücken rechnen (je 8 ms, dann ein Bild Pause), damit das Spiel nicht hakt.
  // Wer vorher fragt (Baumenü), bekommt sie über holeLage am Stück.
  function holeLageSpaeter(dann) {
    const s = st();
    const k = schluessel();
    if (!s || (lageFuer === k) || s.modules?.naturecke?.lage?.key === k) { holeLage(); dann(); return; }
    const t0 = performance.now();
    naturLageSpaeter(regionId()).then(() => {
      if (schluessel() !== k) return;   // inzwischen anderer Hafen: neuLegen kümmert sich
      if (lageFuer !== k) {
        lage = naturLage(regionId());   // aus dem Zwischenspeicher
        rechenMs = Math.round(performance.now() - t0);
        nState(s).lage = { key: k, wert: lage };
        lageFuer = k;
        game.emit('naturecke:lage', { lage });
      }
      dann();
    });
  }

  // ---------------------------------------------------------------- Bild
  const root = new THREE.Group();
  root.name = 'naturecke';
  game.scene.add(root);
  let teile = null;   // { schilf, rand, voegel: [], weg, park } der aktuellen Lage
  let jahreszeit = game.landschaft?.jahreszeit ?? 'sommer';
  const zeit = { value: 0 };
  const halmMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
  halmMat.onBeforeCompile = (sh) => {
    sh.uniforms.uZeit = zeit;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uZeit;\nattribute float aBiege;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float w = sin(uZeit * 1.7 + position.x * 0.35 + position.z * 0.22) + 0.4 * sin(uZeit * 3.1 + position.z * 0.6);
        transformed.x += w * aBiege * 0.16;
        transformed.z += w * aBiege * 0.07;`);
  };

  function wellenhoehe() { return game.landschaft?.pegel ?? 0; }

  // Schilf aus der Lage: je Punkt mehrere Halme (fester Zufall), dazwischen Rohrkolben.
  function baueSchilf(l) {
    const pos = [], col = [], biege = [], idx = [];
    const c = new THREE.Color();
    const farben = FARBE.halm[jahreszeit] ?? FARBE.halm.sommer;
    const r = 2.5 * U;
    let n = 0;
    const halm = (x, z, h, breite, farbe, neig) => {
      // dünnes Blatt aus zwei Dreiecken, oben spitz, leicht geneigt
      const a = hash(x, z, 9) * Math.PI;
      const dx = Math.cos(a) * breite, dz = Math.sin(a) * breite;
      const tx = Math.cos(neig) * h * 0.12, tz = Math.sin(neig) * h * 0.12;
      const b = n;
      pos.push(x - dx, -0.3, z - dz, x + dx, -0.3, z + dz, x + tx, h, z + tz);
      c.set(farbe);
      const dunkel = c.clone().multiplyScalar(0.7);
      col.push(dunkel.r, dunkel.g, dunkel.b, dunkel.r, dunkel.g, dunkel.b, c.r, c.g, c.b);
      biege.push(0, 0, h / 2.4);
      idx.push(b, b + 1, b + 2);
      n += 3;
    };
    for (const [px, py, tiefe] of l.schilf) {
      const { x, z } = inWelt([px, py]);
      const k = 9;
      for (let i = 0; i < k; i++) {
        const hx = x + (hash(px, py, i) - 0.5) * r * 1.5, hz = z + (hash(py, px, i + 3) - 0.5) * r * 1.5;
        // Außen (tiefer) etwas niedriger, am Ufer hoch
        const h = 1.9 + hash(hx, hz, 2) * 1.1 - Math.max(0, tiefe - 0.6) * 0.7;
        halm(hx, hz, h, 0.11 + hash(hx, hz, 4) * 0.08, farben[Math.floor(hash(hx, hz, 5) * farben.length)], hash(hx, hz, 6) * 6.28);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('aBiege', new THREE.Float32BufferAttribute(biege, 1));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, halmMat);
    m.name = 'naturecke-schilf';
    m.frustumCulled = true;
    g.computeBoundingSphere();
    // Rohrkolben: braune Kolben auf einigen Halmen
    const kolben = new THREE.Group();
    const kg = new THREE.CylinderGeometry(0.06, 0.06, 0.32, 5);
    const km = new THREE.InstancedMesh(kg, mat(FARBE.kolben), Math.ceil(l.schilf.length / 3));
    let ki = 0;
    const d = new THREE.Object3D();
    for (const [px, py] of l.schilf) {
      if (hash(px, py, 11) > 0.33 || ki >= km.count) continue;
      const { x, z } = inWelt([px, py]);
      d.position.set(x + (hash(px, py, 12) - 0.5) * r, 2.1 + hash(px, py, 13) * 0.5, z + (hash(px, py, 14) - 0.5) * r);
      d.updateMatrix();
      km.setMatrixAt(ki++, d.matrix);
    }
    km.count = ki;
    kolben.add(km);
    const gr = new THREE.Group();
    gr.add(m, kolben);
    return gr;
  }

  // Weg der Vögel außen am Schilf: am äußeren Rand entlang, ein Stück im freien Wasser
  function randWeg(l, abstand) {
    const { ufer, richtung } = l;
    const achse = [-richtung[1], richtung[0]];
    const faecher = new Map();
    for (const [px, py] of l.schilf) {
      const u = (px - ufer[0]) * achse[0] + (py - ufer[1]) * achse[1];
      const v = (px - ufer[0]) * richtung[0] + (py - ufer[1]) * richtung[1];
      const k = Math.round(u / 5);
      faecher.set(k, Math.max(faecher.get(k) ?? -Infinity, v));
    }
    const ks = [...faecher.keys()].sort((a, b) => a - b);
    const pkte = [];
    for (const k of ks) {
      const u = k * 5, v = faecher.get(k) + abstand / U;
      const px = ufer[0] + achse[0] * u + richtung[0] * v, py = ufer[1] + achse[1] * u + richtung[1] * v;
      const w = inWelt([px, py]);
      if (game.landschaft?.istWasser?.(w.x, w.z) === false) continue;
      pkte.push(w);
    }
    return pkte;
  }

  // ---- Vögel
  function baueBlaesshuhn() {
    const g = new THREE.Group();
    g.add(kugel(FARBE.blaess, 0.36, 0.2, 0.22, 0, 0.1, 0));
    const kopf = kugel(FARBE.blaess, 0.13, 0.13, 0.12, 0.17, 0.26, 0);
    g.add(kopf);
    g.add(kugel(FARBE.blaessSchnabel, 0.07, 0.07, 0.05, 0.25, 0.27, 0));   // weißes Stirnschild
    g.scale.setScalar(2.2);   // etwas größer als echt, sonst sieht man sie nicht
    return g;
  }
  function baueTaucher() {
    const g = new THREE.Group();
    g.add(kugel(FARBE.taucher, 0.42, 0.18, 0.2, 0, 0.08, 0));
    g.add(kugel(FARBE.taucherBauch, 0.3, 0.1, 0.16, 0.06, 0.02, 0));
    const hals = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.32, 6), mat(FARBE.taucherBauch));
    hals.position.set(0.18, 0.28, 0); hals.rotation.z = -0.25;
    g.add(hals);
    g.add(kugel(FARBE.taucher, 0.12, 0.1, 0.1, 0.24, 0.45, 0));
    g.add(kugel(FARBE.taucherHaube, 0.16, 0.08, 0.15, 0.22, 0.43, 0));
    const schnabel = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.14, 4), mat(0xc9a27a));
    schnabel.rotation.z = -Math.PI / 2; schnabel.position.set(0.36, 0.45, 0);
    g.add(schnabel);
    g.scale.setScalar(2.2);
    return g;
  }

  // ---- Bohlenweg mit Beobachtungshütte (geschützt)
  function baueWeg(l, geist = false) {
    const g = new THREE.Group();
    const [a, b] = l.weg.map(inWelt);
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
    const w = Math.atan2(-dz, dx);
    const deck = 0.55;
    const bretter = Math.max(4, Math.round(len / 0.8));
    const holz = geist ? null : FARBE.holz;
    const planken = [];
    for (let i = 0; i < bretter; i++) {
      const t = (i + 0.5) / bretter;
      const p = kasten(holz ?? 0xffffff, len / bretter * 0.92, 0.08, 1.5, 0, 0, 0);
      p.position.set(a.x + dx * t, deck, a.z + dz * t);
      p.rotation.y = w;
      g.add(p);
      planken.push(p);
      if (i % 3 === 0) for (const s of [-1, 1]) {
        const pf = kasten(FARBE.holzDunkel, 0.12, 1.4, 0.12);
        pf.position.set(a.x + dx * t + Math.sin(w) * 0.7 * s, deck - 0.6, a.z + dz * t + Math.cos(w) * 0.7 * s);
        g.add(pf);
      }
    }
    // Geländer: zwei Holme
    for (const s of [-1, 1]) {
      const h = kasten(FARBE.holzDunkel, len, 0.06, 0.06);
      h.position.set(a.x + dx / 2 + Math.sin(w) * 0.72 * s, deck + 0.55, a.z + dz / 2 + Math.cos(w) * 0.72 * s);
      h.rotation.y = w;
      g.add(h);
    }
    // Hütte am Ende: auf Stelzen, Sehschlitz zum Wasser, Pultdach
    const huette = new THREE.Group();
    huette.position.set(b.x + Math.cos(w) * 1.4, deck, b.z - Math.sin(w) * 1.4);
    huette.rotation.y = w;
    huette.add(kasten(FARBE.holz, 3.2, 0.1, 3, 0, 0, 0));
    huette.add(kasten(FARBE.holz, 3, 1.9, 0.12, 0, 1, -1.4));
    huette.add(kasten(FARBE.holz, 3, 1.9, 0.12, 0, 1, 1.4));
    huette.add(kasten(FARBE.holz, 0.12, 1.9, 2.8, -1.45, 1, 0));
    huette.add(kasten(FARBE.holz, 0.12, 0.9, 2.8, 1.45, 0.5, 0));     // vorn halbhoch: Sehschlitz
    huette.add(kasten(FARBE.holz, 0.12, 0.45, 2.8, 1.45, 1.75, 0));
    const dach = kasten(FARBE.dach, 3.6, 0.12, 3.4, 0, 2.1, 0);
    dach.rotation.z = -0.12;
    huette.add(dach);
    for (const [x, z] of [[-1.4, -1.3], [-1.4, 1.3], [1.4, -1.3], [1.4, 1.3]]) huette.add(kasten(FARBE.holzDunkel, 0.16, 1.6, 0.16, x, -0.75, z));
    g.add(huette);
    // Schild am Ufer
    const schild = new THREE.Group();
    const back = Math.atan2(-(a.z - b.z), a.x - b.x);
    schild.position.set(a.x + Math.sin(w) * 1.6, 0, a.z + Math.cos(w) * 1.6);
    schild.rotation.y = back + Math.PI / 2;
    schild.add(kasten(FARBE.holzDunkel, 0.1, 1.6, 0.1, -0.5, 0.8, 0), kasten(FARBE.holzDunkel, 0.1, 1.6, 0.1, 0.5, 0.8, 0));
    schild.add(kasten(FARBE.schildRand, 1.4, 0.8, 0.06, 0, 1.4, 0));
    schild.add(kasten(FARBE.schild, 1.25, 0.65, 0.08, 0, 1.4, 0));
    // weißer Vogel auf dem Schild (zwei Striche)
    schild.add(kasten(0xffffff, 0.5, 0.06, 0.09, -0.08, 1.45, 0), kasten(0xffffff, 0.22, 0.06, 0.09, 0.2, 1.52, 0));
    const hb = game.landschaft?.hoeheBei?.(schild.position.x, schild.position.z);
    schild.position.y = Number.isFinite(hb) ? Math.max(0, hb) : 0.3;
    g.add(schild);
    g.userData = { planken, huette, a, b, deck, w };
    if (geist) g.traverse((o) => { if (o.isMesh) { o.material = geistMat; o.renderOrder = 12; } });
    return g;
  }

  // ---- Park- und Trailerplatz (bebaut)
  function parkRechteck(l) {
    const f = l.flaeche;
    const m = inWelt(f.mitte);
    const w = Math.atan2(f.achse[1], f.achse[0]);   // Winkel der Achse in Planeinheiten
    return { x: m.x, z: m.z, laenge: f.laenge * U, breite: f.breite * U, dreh: w };
  }
  function baueParkplatz(l, stufe, geist = false) {
    const g = new THREE.Group();
    const r = parkRechteck(l);
    g.position.set(r.x, 0, r.z);
    g.rotation.y = r.dreh;    // lokale x = entlang des Ufers, lokale z = vom Wasser (+z) zum Ufer (-z)?
    const hoehe = 0.75;
    const platte = new THREE.Mesh(new THREE.BoxGeometry(r.laenge, hoehe + 1.2, r.breite), geist ? geistMat : mat(FARBE.asphalt));
    platte.position.y = hoehe - (hoehe + 1.2) / 2;
    if (geist) platte.renderOrder = 12;
    g.add(platte);
    if (geist) { g.userData = { r }; return g; }
    // Spundwand außen herum (dunkler Rand, etwas höher)
    for (const [w, d, x, z] of [[r.laenge + 0.3, 0.25, 0, r.breite / 2], [r.laenge + 0.3, 0.25, 0, -r.breite / 2], [0.25, r.breite, r.laenge / 2, 0], [0.25, r.breite, -r.laenge / 2, 0]]) {
      g.add(kasten(FARBE.spundwand, w, hoehe + 1.4, d, x, hoehe - (hoehe + 1.4) / 2 + 0.12, z));
    }
    // Stellplätze in zwei Reihen quer zur Achse, Autos und Trailer je nach Stufe
    const plaetze = [];
    const breiteStell = 2.7, tiefe = 5;
    const reihen = r.breite >= 13 ? [-r.breite / 2 + tiefe / 2 + 0.8, r.breite / 2 - tiefe / 2 - 0.8] : [0];
    for (const zr of reihen) {
      const n = Math.floor((r.laenge - 2) / breiteStell);
      for (let i = 0; i < n; i++) {
        const x = -r.laenge / 2 + 1 + breiteStell * (i + 0.5);
        plaetze.push({ x, z: zr });
        const li = kasten(FARBE.linie, 0.1, 0.02, tiefe * 0.9, x - breiteStell / 2, hoehe + 0.01, zr);
        g.add(li);
      }
    }
    const lr = l.schilf.length;
    const autos = Math.min(plaetze.length, 3 + 2 * stufe);
    const trailer = Math.min(Math.max(0, stufe - 1), Math.floor(plaetze.length / 4));
    plaetze.forEach((p, i) => {
      const h = hash(p.x + lr, p.z, i);
      if (i < trailer) g.add(baueTrailer(p.x, hoehe, p.z, h));
      else if (i < trailer + autos && h < 0.92) g.add(baueAuto(p.x, hoehe, p.z, h));
    });
    // Parkscheinautomat
    g.add(kasten(0x2b5fa8, 0.4, 1.3, 0.3, r.laenge / 2 - 1, hoehe + 0.65, 0));
    g.userData = { r, hoehe };
    return g;
  }
  function baueAuto(x, y, z, h) {
    const a = new THREE.Group();
    const farbe = FARBE.autos[Math.floor(h * FARBE.autos.length)];
    a.add(kasten(farbe, 1.8, 0.6, 4.2, 0, 0.55, 0));
    a.add(kasten(farbe, 1.6, 0.55, 2.2, 0, 1.1, -0.2));
    a.add(kasten(0x9fc3d9, 1.62, 0.4, 2.0, 0, 1.12, -0.2));
    for (const [sx, sz] of [[-0.85, 1.3], [0.85, 1.3], [-0.85, -1.3], [0.85, -1.3]]) a.add(kasten(0x1d1d1d, 0.25, 0.6, 0.6, sx, 0.3, sz));
    a.position.set(x, y, z);
    a.rotation.y = h > 0.5 ? Math.PI : 0;
    return a;
  }
  function baueTrailer(x, y, z, h) {
    // Bootstrailer mit kleinem Motorboot: spitzer Bug, weißer Rumpf mit Farbstreifen, kleine Konsole
    const t = new THREE.Group();
    t.add(kasten(FARBE.trailer, 0.12, 0.12, 5.2, -0.55, 0.42, 0), kasten(FARBE.trailer, 0.12, 0.12, 5.2, 0.55, 0.42, 0));
    t.add(kasten(FARBE.trailer, 0.1, 0.1, 1.2, 0, 0.42, 3.1));   // Deichsel
    for (const s of [-1, 1]) t.add(kasten(0x1d1d1d, 0.22, 0.55, 0.55, s * 0.8, 0.28, -0.4));
    const boot = new THREE.Group();
    boot.position.set(0, 0.62, -0.2);
    const farbe = FARBE.rumpf[1 + Math.floor(h * (FARBE.rumpf.length - 1))];
    boot.add(kasten(0xf4f4f0, 1.6, 0.6, 3.4, 0, 0.3, -0.5));
    boot.add(kasten(farbe, 1.62, 0.16, 3.4, 0, 0.42, -0.5));
    const bug = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.6, 4, 1), mat(0xf4f4f0));
    bug.rotation.set(Math.PI / 2, Math.PI / 4, 0);
    bug.scale.set(1, 1, 0.55);
    bug.position.set(0, 0.36, 2.0);
    boot.add(bug);
    boot.add(kasten(0x3c4650, 0.7, 0.5, 0.6, 0, 0.85, -0.3));   // Steuerkonsole
    boot.add(kasten(0x9fc3d9, 0.66, 0.25, 0.08, 0, 1.0, 0.02));  // Scheibe
    boot.add(kasten(0x2a2a2a, 0.35, 0.6, 0.35, 0, 0.5, -2.35)); // Außenborder
    t.add(boot);
    t.position.set(x, y, z);
    t.rotation.y = h > 0.5 ? Math.PI : 0;
    return t;
  }

  const geistMat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.55, depthWrite: false, depthTest: false });

  // Natürliches Schilf der Landschaft (bewuchs.js) unter dem Parkplatz verschwinden lassen: die Halme in den
  // gebackenen Netzen liegen dort nach unten weg (kein Neubau der Landschaft)
  function landschaftsSchilfWeg(l) {
    const gr = game.landschaft?.gruppe;
    if (!gr || !l) return 0;
    const r = parkRechteck(l);
    const c = Math.cos(r.dreh), s = Math.sin(r.dreh);
    const drin = (x, z) => {
      const dx = x - r.x, dz = z - r.z;
      // lokale Koordinaten (Drehung um y um r.dreh)
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      return Math.abs(lx) <= r.laenge / 2 + 1 && Math.abs(lz) <= r.breite / 2 + 1;
    };
    let n = 0;
    gr.traverse((o) => {
      if (!o.isMesh || o.name !== 'schilf' || !o.userData?.liste) return;
      const { liste, ecken } = o.userData;
      const p = o.geometry.attributes.position;
      let geaendert = false;
      liste.forEach((it, k) => {
        if (!drin(it.x, it.z)) return;
        for (let i = 0; i < ecken; i++) p.setY(k * ecken + i, -60);
        geaendert = true; n++;
      });
      if (geaendert) { p.needsUpdate = true; o.geometry.computeBoundingSphere(); }
    });
    return n;
  }

  function entsorge(g) {
    if (!g) return;
    root.remove(g);
    g.traverse((o) => { if (o.geometry && !o.userData?.geteilt) o.geometry.dispose?.(); });
  }

  // Alles zur aktuellen Lage und Wahl neu aufbauen
  let gebautFuer = null;
  function zeichne(erzwingen = false) {
    const s = st();
    const l = lageJetzt();
    const w = wahlVon(s);
    const stufe = s?.stage ?? 1;
    const k = `${lageFuer}|${w}|${stufe}|${jahreszeit}|${l ? 1 : 0}`;
    if (!erzwingen && k === gebautFuer) return;
    gebautFuer = k;
    if (teile) { for (const t of [teile.schilf, teile.weg, teile.park, ...teile.voegel.map((v) => v.g)]) entsorge(t); }
    teile = null;
    if (!l) return;
    teile = { schilf: null, weg: null, park: null, voegel: [] };
    if (w !== 'bebaut') {
      teile.schilf = baueSchilf(l);
      teile.schilf.position.y = wellenhoehe();
      root.add(teile.schilf);
      // Blässhühner (immer, solange es Schilf gibt), Haubentaucher nur im Schutzgebiet
      const randNah = randWeg(l, 1.6), randWeit = randWeg(l, 6);
      const nB = w === 'schutz' ? 4 : 3;
      if (randNah.length >= 2) for (let i = 0; i < nB; i++) teile.voegel.push(neuerVogel('blaess', randNah, i / nB));
      if (w === 'schutz' && randWeit.length >= 2) for (let i = 0; i < 2; i++) teile.voegel.push(neuerVogel('taucher', randWeit, 0.3 + i * 0.06));
      for (const v of teile.voegel) root.add(v.g);
    }
    if (w === 'schutz') { teile.weg = baueWeg(l); root.add(teile.weg); }
    if (w === 'bebaut') {
      teile.park = baueParkplatz(l, stufe);
      root.add(teile.park);
      landschaftsSchilfWeg(l);
    }
  }

  function neuerVogel(art, weg, t0) {
    const g = art === 'blaess' ? baueBlaesshuhn() : baueTaucher();
    const laenge = weg.reduce((s, p, i) => s + (i ? Math.hypot(p.x - weg[i - 1].x, p.z - weg[i - 1].z) : 0), 0);
    return { art, g, weg, laenge, s: t0 * laenge, dir: Math.random() < 0.5 ? 1 : -1, tempo: art === 'blaess' ? zuf(0.25, 0.4) : zuf(0.15, 0.25),
      pause: 0, taucht: 0, getaucht: 0, x: weg[0].x, z: weg[0].z, kurs: 0 };
  }
  function aufWeg(weg, s) {
    let rest = s;
    for (let i = 1; i < weg.length; i++) {
      const a = weg[i - 1], b = weg[i];
      const d = Math.hypot(b.x - a.x, b.z - a.z);
      if (rest <= d || i === weg.length - 1) {
        const k = d > 0 ? Math.min(1, rest / d) : 0;
        return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, kurs: Math.atan2(-(b.z - a.z), b.x - a.x) };
      }
      rest -= d;
    }
    return { x: weg[0].x, z: weg[0].z, kurs: 0 };
  }

  // ---- Spaziergänger auf dem Bohlenweg (tagsüber, ohne Regen)
  let gaenger = null;
  function baueGaenger() {
    const g = new THREE.Group();
    const farbe = FARBE.autos[Math.floor(Math.random() * FARBE.autos.length)];
    g.add(kasten(0x3a4a5a, 0.3, 0.8, 0.22, 0, 0.4, 0));
    g.add(kasten(farbe, 0.42, 0.7, 0.3, 0, 1.15, 0));
    g.add(kugel(0xe8c4a0, 0.26, 0.26, 0.26, 0, 1.65, 0));
    g.add(kasten(0x222222, 0.12, 0.1, 0.22, 0.16, 1.62, 0));   // Fernglas
    return g;
  }

  // ---------------------------------------------------------------- Takt
  let regen = false;
  game.on('weather', (w) => { regen = (w?.rain ?? 0) >= 0.3 || (w?.snow ?? 0) > 0.5; });
  const tagesAnteil = () => {
    const r = sim.ctx?.rules, s = st();
    if (!r?.dayLength || !s) return 0.4;
    const c = s.clock ?? 0, abend = r.eveningLength || 1;
    return c < r.dayLength ? 0.75 * (c / r.dayLength) : Math.min(1, 0.75 + 0.25 * ((c - r.dayLength) / abend));
  };
  const nacht = () => (game.landscape?.licht?.zustand?.nacht ?? 0) > 0.55 || tagesAnteil() > 0.93;
  let bauAnim = null;   // { art, t }
  let letzte = performance.now();
  let tonIn = 6;
  function takt() {
    const jetzt = performance.now();
    const echt = Math.min(0.25, (jetzt - letzte) / 1000);
    letzte = jetzt;
    zeit.value = jetzt / 1000;
    if (!teile) return;
    const dt = echt * (game.paused ? 0 : game.speed ?? 1);
    const pegel = wellenhoehe();
    if (teile.schilf) teile.schilf.position.y = pegel;
    const winter = jahreszeit === 'winter';
    for (const v of teile.voegel) {
      // Im Winter ziehen die Taucher weg, Blässhühner bleiben (wie echt)
      v.g.visible = !(winter && v.art === 'taucher') && !nacht();
      if (!v.g.visible) continue;
      if (dt > 0) {
        if (v.taucht > 0) {
          v.taucht -= dt;
          if (v.taucht <= 0) { v.s = Math.max(0, Math.min(v.laenge, v.s + v.dir * zuf(4, 9))); v.getaucht = 0; }
        } else if (v.pause > 0) v.pause -= dt;
        else {
          v.s += v.dir * v.tempo * dt;
          if (v.s <= 0 || v.s >= v.laenge) { v.dir *= -1; v.s = Math.max(0, Math.min(v.laenge, v.s)); v.pause = zuf(1, 4); }
          if (Math.random() < dt * 0.05) v.pause = zuf(2, 6);
          if (v.art === 'taucher' && Math.random() < dt * 0.06) { v.taucht = zuf(3.5, 6); v.getaucht++; if (sichtbarNah()) game.audio?.sfx?.('plaetschern', { staerke: 0.4 }); }
        }
      }
      const p = aufWeg(v.weg, v.s);
      v.x = p.x; v.z = p.z;
      const ziel = v.dir > 0 ? p.kurs : p.kurs + Math.PI;
      v.kurs += Math.atan2(Math.sin(ziel - v.kurs), Math.cos(ziel - v.kurs)) * Math.min(1, echt * 3);
      const unter = v.taucht > 0;
      v.g.position.set(v.x, pegel + (unter ? -0.8 : 0) + Math.sin(zeit.value * 2 + v.x) * 0.03, v.z);
      v.g.rotation.y = v.kurs;
      v.g.rotation.z = v.taucht > 0 ? 0 : Math.sin(zeit.value * 3 + v.z) * 0.04;
    }
    // Spaziergänger: geht zur Hütte, schaut, geht zurück
    if (teile.weg && dt > 0) {
      const d = teile.weg.userData;
      const darf = !regen && !nacht() && !winter && tagesAnteil() > 0.08 && tagesAnteil() < 0.8;
      if (!gaenger && darf && Math.random() < dt * 0.02) {
        gaenger = { g: baueGaenger(), t: 0, phase: 'hin', warte: 0 };
        root.add(gaenger.g);
      }
      if (gaenger) {
        const len = Math.hypot(d.b.x - d.a.x, d.b.z - d.a.z);
        const v = 1.1 / Math.max(1, len);
        if (gaenger.phase === 'hin') { gaenger.t += v * dt; if (gaenger.t >= 1) { gaenger.t = 1; gaenger.phase = 'schaut'; gaenger.warte = zuf(6, 14); } }
        else if (gaenger.phase === 'schaut') { gaenger.warte -= dt; if (gaenger.warte <= 0) gaenger.phase = 'zurueck'; }
        else { gaenger.t -= v * dt; if (gaenger.t <= 0) { root.remove(gaenger.g); gaenger = null; } }
        if (gaenger) {
          const x = d.a.x + (d.b.x - d.a.x) * gaenger.t, z = d.a.z + (d.b.z - d.a.z) * gaenger.t;
          gaenger.g.position.set(x, d.deck + 0.05 + (gaenger.phase === 'schaut' ? 0 : Math.abs(Math.sin(zeit.value * 7)) * 0.04), z);
          gaenger.g.rotation.y = gaenger.phase === 'zurueck' ? d.w + Math.PI : d.w;
        }
      }
    } else if (gaenger && !teile.weg) { root.remove(gaenger.g); gaenger = null; }
    // Bauen: Bohlenweg Brett für Brett, Parkplatz hebt sich aus dem Wasser
    if (bauAnim) {
      bauAnim.t += echt;
      const k = Math.min(1, bauAnim.t / 2.4);
      if (teile.weg) {
        const pl = teile.weg.userData.planken;
        pl.forEach((p, i) => { p.visible = i / pl.length <= k; });
        teile.weg.userData.huette.scale.setScalar(Math.max(0.01, (k - 0.7) / 0.3));
      }
      if (teile.park) teile.park.position.y = -1.6 * (1 - k);
      if (k >= 1) {
        if (teile.weg) teile.weg.userData.huette.scale.setScalar(1);
        bauAnim = null;
      }
    }
    // Fertig gebaut: Teile zusammenfassen (das Bauen braucht die Bretter einzeln)
    if (!bauAnim) for (const t of [teile.weg, teile.park]) if (t && !t.userData.gebuendelt) buendeln(t);
    // Töne: Rohrsänger tagsüber, Frösche abends, nur in Frühling und Sommer und wenn das Schilf im Bild ist
    tonIn -= echt;
    if (tonIn <= 0) {
      tonIn = zuf(9, 22);
      const j = jahreszeit === 'fruehling' || jahreszeit === 'sommer';
      if (teile.schilf && j && !regen && !game.paused && sichtbarNah()) {
        const u = tagesAnteil();
        if (u > 0.72 && u < 0.95) game.audio?.sfx?.('froesche');
        else if (u > 0.05 && u < 0.7) game.audio?.sfx?.('rohrsaenger');
      }
    }
  }
  function sichtbarNah() {
    const l = lageJetzt();
    if (!l) return false;
    const m = inWelt(l.mitte);
    const breit = game.camera?.viewWidth ?? 999;
    return breit < 260 && (game.boatAnim?.imBild?.(m.x, m.z, 15) ?? false);
  }
  game.onTick?.(takt);

  // ---------------------------------------------------------------- Ereignisse
  const neuLegen = () => { lageFuer = null; lage = null; gebautFuer = null; setTimeout(() => holeLageSpaeter(() => { zeichne(true); frage(); }), 900); };
  // 'ready' kann schon vorbei sein, wenn die Spielregeln da sind: dann gleich (kurz verzögert) starten
  let gestartet = false;
  const start = () => { if (gestartet) return; gestartet = true; setTimeout(() => holeLageSpaeter(() => { zeichne(); testParameter(); frage(); }), 1200); };
  game.on('ready', start);
  if (game.landschaft) start();
  game.on('sim:change', (e) => {
    if (e?.reason === 'load' || e?.reason === 'new') { neuLegen(); return; }
    zeichne();
  });
  game.on('spielstand-geladen', neuLegen);
  game.on('stufe', () => { setTimeout(() => { zeichne(); frage(); }, 200); });
  game.on('stege', () => { if (lageFuer && lageFuer !== schluessel()) neuLegen(); });
  // Nach jedem Neubau der Landschaft (Stufe, Jahreszeit nicht) liegt deren Schilf wieder da
  game.on('landschaft:geaendert', () => { if (wahlVon(st()) === 'bebaut') landschaftsSchilfWeg(lageJetzt()); });
  game.on('season', (s) => {
    const j = typeof s === 'object' ? s?.part : s;
    if (j && j !== jahreszeit) { jahreszeit = j; zeichne(); }
  });

  // Ab Stufe 2: einmal fragen (Schild unter der oberen Leiste), wo man entscheidet
  function frage() {
    const s = st();
    if (!s || s.testmodus && !url.has('naturecke')) return;
    if (!lageJetzt() || wahlVon(s) || (s.stage ?? 1) < (REGELN.abStufe ?? 2)) return;
    const n = nState(s);
    if (n.gefragt) return;
    n.gefragt = true;
    game.banner?.zeige?.('wolke', 'Was wird aus dem Schilf am Ufer?',
      'Schützen oder bebauen? Entscheide im Baumenü unter Hafen.', 9);
  }

  // ---------------------------------------------------------------- Schnittstelle
  function ort() {
    const l = lageJetzt() ?? holeLage();
    if (!l) return null;
    const m = inWelt(l.mitte);
    const y = Math.max(0, game.landschaft?.hoeheBei?.(m.x, m.z) ?? 0);
    return { x: m.x, z: m.z, y, breite: 42 };
  }
  function geist(id) {
    const l = lageJetzt() ?? holeLage();
    if (!l) return null;
    if (id === 'schuetzen') return baueWeg(l, true);
    if (id === 'bebauen') return baueParkplatz(l, st()?.stage ?? 2, true);
    return null;
  }
  function entscheiden(id) {
    const l = lageJetzt() ?? holeLage();
    const r = entscheidenVon(st(), id, (k) => sim.spend(k, 'bau'), !!l);
    if (r.ok) {
      zeichne(true);
      bauAnim = { t: 0 };
      if (teile?.park) teile.park.position.y = -1.6;
      game.emit('naturecke:wahl', { wahl: r.wahl, kosten: r.kosten });
      game.emit('sim:change', { reason: 'naturecke' });
      game.audio?.sfx?.(r.wahl === 'schutz' ? 'rohrsaenger' : 'bauen');
    }
    return { ...r, geldFehlt: r.grund === 'geld' };
  }
  function reiherPlaetze() {
    const l = lageJetzt();
    if (!l || wahlVon(st()) === 'bebaut') return [];
    // Vor dem Rand des Schilfs, wo das Wasser noch flach ist (bis 0,7 m): dort steht der Reiher gern
    const out = [];
    const blick = Math.atan2(l.richtung[1], -l.richtung[0]);
    for (const w of randWeg(l, 1.2)) {
      const t = game.landschaft?.tiefeBei?.(w.x, w.z) ?? 0.5;
      if (!(t > 0.05 && t < 0.7)) continue;
      if (out.every((o) => Math.hypot(o.x - w.x, o.z - w.z) > 8)) out.push({ x: w.x, z: w.z, blick });
      if (out.length >= 3) break;
    }
    return out;
  }

  Object.assign(api, {
    lage: () => lageJetzt() ?? holeLage(),
    wahl: () => wahlVon(st()),
    angebote: () => (st() ? angeboteVon(st(), !!(lageJetzt() ?? holeLage())) : []),
    entscheiden,
    geist,
    ort,
    imSchilf: (x, z, randM = 0) => imSchilfLage(lageJetzt(), x, z, randM),
    reiherPlaetze,
    voegel: () => (teile?.voegel ?? []).map((v) => ({ art: v.art, x: v.x, z: v.z, sichtbar: v.g.visible, taucht: v.taucht > 0, getaucht: v.getaucht })),
    _teile: () => teile,
    _rechenMs: () => rechenMs,
    _gaenger: () => gaenger,
  });

  // ?naturecke=zeigen|schutz|bebaut
  function testParameter() {
    const p = url.get('naturecke');
    if (!p) return;
    const s = st();
    if ((p === 'schutz' || p === 'bebaut') && s?.testmodus && !wahlVon(s)) {
      s.money = Math.max(s.money, 5000);
      entscheiden(p === 'schutz' ? 'schuetzen' : 'bebauen');
    }
    const o = ort();
    if (o && game.camera?.flyTo) {
      game.camera.flyTo(o.x, o.z);
      if (game.camera.zoomAt && game.camera.viewWidth > 70) game.camera.zoomAt(game.camera.viewWidth / 70);
    }
  }
  return api;
}

export default init;
