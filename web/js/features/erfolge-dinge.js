// Erfolge als Dinge im Hafen (Roadmap I6). Nachgeladen von features/erfolge.js, weil es Three.js braucht.
// Drei Stücke beim Hafenmeisterhaus, platziert über features/ziel-deko.js (game.zielDeko.zusatz), also nach
// denselben Regeln wie die Deko der Tagesziele (nie auf Wegen, Bauplätzen, im Wasser oder am Hang):
//
// - Erfolgsmast: ein Mast mit Flaggenleinen, je erreichtem Wimpel-Erfolg ein Wimpel in der Farbe seiner Gruppe.
// - Pokaltreppe: ein Holzpodest mit drei Stufen, je Pokal-Erfolg ein goldener Pokal.
// - Ehrentafel: eine Tafel mit fünf Plätzen, je erreichter Ausbaustufe (2 bis 6) ein Messingschild.
//
// Jedes Stück erscheint erst mit seinem ersten Ding. Ein neuer Erfolg lässt sein Ding hüpfen.
import * as THREE from 'three';
import { ERFOLGE, GRUPPEN } from './erfolge-daten.js';

const LAGE = {
  'erfolg-mast': { x: 9.5, z: 12.5, dreh: 0 },
  'erfolg-pokale': { x: 2.0, z: 13.0, dreh: 180 },
  'erfolg-tafel': { x: -4.0, z: 13.0, dreh: 180 },
};
const RADIUS = { 'erfolg-mast': 2.8, 'erfolg-pokale': 2.0, 'erfolg-tafel': 2.0 };
// Pokale und Tafel etwas größer als echt, damit man sie von oben erkennt (wie die Deko der Tagesziele)
const GROESSE = { 'erfolg-pokale': 1.6, 'erfolg-tafel': 1.4 };
const MAST_HOEHE = 6;
const LEINE = 3.4;    // Abstand der Leinen-Enden vom Mast am Boden

export function init(game, { dinge }) {
  const mat = new Map();
  const M = (c) => { if (!mat.has(c)) mat.set(c, new THREE.MeshLambertMaterial({ color: c, flatShading: true })); return mat.get(c); };
  const box = (w, h, d, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; return o; };
  const zyl = (r1, r2, h, m, x = 0, y = 0, z = 0, seg = 8) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), m); o.position.set(x, y, z); o.castShadow = true; return o; };
  const HOLZ = M('#9a6b43'), HOLZ_HELL = M('#c99a62'), WEISS = M('#f4f1ea'), EISEN = M('#3b4048'), GOLD = M('#e3b23c'), MESSING = M('#b08d57'), DUNKEL = M('#5b4433');

  // Reihenfolgen fest nach der Liste, damit jedes Ding seinen festen Platz hat
  const WIMPEL = ERFOLGE.filter((e) => e.ding === 'wimpel');
  const POKALE = ERFOLGE.filter((e) => e.ding === 'pokal');

  // ---------------------------------------------------------------- Erfolgsmast
  const mast = new THREE.Group();
  mast.add(zyl(0.09, 0.13, MAST_HOEHE, WEISS, 0, MAST_HOEHE / 2, 0, 6));
  mast.add(box(0.5, 0.18, 0.5, DUNKEL, 0, 0.09, 0));
  mast.add(new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 4), GOLD).translateY(MAST_HOEHE + 0.1));
  const leinen = new THREE.Group();
  mast.add(leinen);
  const wimpelGruppe = new THREE.Group();
  mast.add(wimpelGruppe);
  // zwei Leinen vom Topp schräg zum Boden, links und rechts
  for (const s of [-1, 1]) {
    const a = new THREE.Vector3(0, MAST_HOEHE - 0.1, 0), b = new THREE.Vector3(s * LEINE, 0.25, 0);
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, a.distanceTo(b), 3), EISEN);
    l.position.copy(a).add(b).multiplyScalar(0.5);
    l.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    leinen.add(l);
    leinen.add(box(0.12, 0.25, 0.12, DUNKEL, s * LEINE, 0.12, 0));
  }
  const wimpelMesh = new Map();
  function wimpelPlatz(i) {
    // abwechselnd links und rechts, von oben nach unten; 12 Plätze je Leine
    const s = i % 2 ? 1 : -1;
    const k = Math.floor(i / 2);
    const t = 0.1 + (k / 12) * 0.85;
    return new THREE.Vector3(s * LEINE * t, (MAST_HOEHE - 0.1) + (0.25 - (MAST_HOEHE - 0.1)) * t - 0.22, 0);
  }

  // ---------------------------------------------------------------- Pokaltreppe
  const treppe = new THREE.Group();
  treppe.add(box(2.2, 0.3, 1.0, HOLZ, 0, 0.15, 0));
  treppe.add(box(1.5, 0.3, 0.8, HOLZ_HELL, 0, 0.45, -0.05));
  treppe.add(box(0.8, 0.3, 0.6, HOLZ, 0, 0.75, -0.1));
  const POKAL_PLATZ = [[0, 0.9, -0.1], [-0.5, 0.6, 0.05], [0.5, 0.6, 0.05], [-0.85, 0.3, 0.3], [0.85, 0.3, 0.3], [-0.3, 0.3, 0.32], [0.3, 0.3, 0.32]];
  const pokalMesh = new Map();
  function pokal(gross) {
    const g = new THREE.Group();
    const k = gross ? 1.25 : 1;
    g.add(box(0.26 * k, 0.06, 0.26 * k, DUNKEL, 0, 0.03, 0));
    g.add(zyl(0.04 * k, 0.06 * k, 0.16 * k, GOLD, 0, 0.14 * k, 0, 6));
    g.add(zyl(0.16 * k, 0.06 * k, 0.24 * k, GOLD, 0, 0.34 * k, 0, 8));
    for (const s of [-1, 1]) {
      const h = new THREE.Mesh(new THREE.TorusGeometry(0.06 * k, 0.018 * k, 4, 8, Math.PI), GOLD);
      h.position.set(s * 0.17 * k, 0.36 * k, 0);
      h.rotation.z = s > 0 ? -Math.PI / 2 : Math.PI / 2;
      g.add(h);
    }
    return g;
  }

  // ---------------------------------------------------------------- Ehrentafel
  const tafel = new THREE.Group();
  for (const dx of [-0.95, 0.95]) tafel.add(box(0.14, 1.9, 0.14, HOLZ, dx, 0.95, 0));
  tafel.add(box(2.1, 1.1, 0.1, HOLZ_HELL, 0, 1.3, 0));
  tafel.add(box(2.2, 0.1, 0.18, HOLZ, 0, 1.9, 0));
  const schildMesh = new Map();
  const SCHILD_PLATZ = (n) => { const i = n - 2; return [-0.6 + (i % 3) * 0.6, i < 3 ? 1.55 : 1.05, -0.06]; };
  for (let n = 2; n <= 6; n++) {
    const [x, y, z] = SCHILD_PLATZ(n);
    tafel.add(box(0.46, 0.3, 0.02, DUNKEL, n === 6 ? x + 0.3 : x, y, z + 0.02));   // leerer Platz (dunkel)
  }

  treppe.scale.setScalar(GROESSE['erfolg-pokale']);
  tafel.scale.setScalar(GROESSE['erfolg-tafel']);

  // ---------------------------------------------------------------- Aufbauen
  const zd = () => game.zielDeko;
  const stand = () => dinge() ?? { wimpel: [], pokale: [], schilder: [] };
  let angemeldet = false;
  function anmelden() {
    if (angemeldet) return true;
    if (!zd()?.zusatz) return false;
    angemeldet = true;
    zd().zusatz('erfolg-mast', { lage: LAGE['erfolg-mast'], radius: RADIUS['erfolg-mast'], objekt: mast, da: () => stand().wimpel.length > 0 });
    zd().zusatz('erfolg-pokale', { lage: LAGE['erfolg-pokale'], radius: RADIUS['erfolg-pokale'], objekt: treppe, da: () => stand().pokale.length > 0 });
    zd().zusatz('erfolg-tafel', { lage: LAGE['erfolg-tafel'], radius: RADIUS['erfolg-tafel'], objekt: tafel, da: () => stand().schilder.length > 0 });
    return true;
  }

  function teile() {
    const s = game.sim?.state;
    const erreicht = s?.modules?.erfolge?.erreicht ?? {};
    // Wimpel
    WIMPEL.forEach((e, i) => {
      let w = wimpelMesh.get(e.id);
      if (!erreicht[e.id]) { if (w) { wimpelGruppe.remove(w); wimpelMesh.delete(e.id); } return; }
      if (w) return;
      w = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.62, 3), M(GRUPPEN[e.gruppe].farbe));
      w.rotation.x = Math.PI;
      w.position.copy(wimpelPlatz(i));
      w.castShadow = true;
      w.userData.flattern = i;
      wimpelMesh.set(e.id, w);
      wimpelGruppe.add(w);
    });
    // Pokale
    POKALE.forEach((e, i) => {
      let p = pokalMesh.get(e.id);
      if (!erreicht[e.id]) { if (p) { treppe.remove(p); pokalMesh.delete(e.id); } return; }
      if (p) return;
      p = pokal(i === 0 && e.id === 'region');
      const [x, y, z] = POKAL_PLATZ[i % POKAL_PLATZ.length];
      p.position.set(x, y, z);
      pokalMesh.set(e.id, p);
      treppe.add(p);
    });
    // Schilder
    for (let n = 2; n <= 6; n++) {
      const id = `stufe-${n}`;
      let sc = schildMesh.get(id);
      if (!erreicht[id]) { if (sc) { tafel.remove(sc); schildMesh.delete(id); } continue; }
      if (sc) continue;
      const [x, y, z] = SCHILD_PLATZ(n);
      sc = new THREE.Group();
      sc.add(box(0.46, 0.3, 0.04, MESSING, 0, 0, 0));
      // eingravierte Striche für die Stufe (n Striche)
      for (let k = 0; k < n; k++) sc.add(box(0.03, 0.16, 0.01, DUNKEL, -0.15 + k * (0.3 / Math.max(1, n - 1)), 0, -0.025));
      sc.position.set(n === 6 ? x + 0.3 : x, y, z - 0.01);
      schildMesh.set(id, sc);
      tafel.add(sc);
    }
  }

  function aufbauen() {
    teile();
    if (!anmelden()) return;
    zd().aufbauen();
  }
  function huepfen(e) {
    const ding = e.ding === 'wimpel' ? wimpelMesh.get(e.id) : e.ding === 'pokal' ? pokalMesh.get(e.id) : schildMesh.get(e.id);
    zd()?.huepfen?.(ding);
  }

  let zeit = 0;
  game.onTick?.((dt) => {
    if (!mast.visible) return;
    zeit += dt;
    for (const w of wimpelGruppe.children) w.rotation.z = Math.sin(zeit * 3.2 + w.userData.flattern * 0.9) * 0.22;
  });

  // ziel-deko.js wird von tagesziele.js nachgeladen: warten, bis es da ist
  let versuche = 0;
  (function warte() {
    if (zd()?.zusatz) { aufbauen(); return; }
    if (++versuche < 120) setTimeout(warte, 250);
  }());
  game.on('ready', aufbauen);

  return { aufbauen, huepfen };
}
