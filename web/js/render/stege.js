// Stege und Liegeplaetze in 3D, gebaut aus web/js/data/harbor.js.
// Gehoert dem Thread "Haefen mit echten Satellitenbildern vergleichen". Vorbilder: docs/vorbilder.md
//
// Holzstege stehen auf Pfaehlen (Steg A, B, C, Stichsteg, Fischersteg), Schwimmstege liegen
// flach auf Schwimmkoerpern mit Fuehrungspfaehlen (Steg D, Dienststege), der Kai bekommt eine
// Betonkante mit Pollern. Boxen haben zwei Heckpfaehle (Dalben) am seeseitigen Ende,
// Fingerplaetze je zwei Boote zwischen zwei Fingerstegen.
//
// Schnittstelle:
//   game.stege.setStage(n)            baut die Stege der Stufe n (1 bis 5, hoehere wie 5)
//   game.stege.highlight(ids, farbe)  Liegeplaetze einfaerben, z. B. passende Plaetze fuer ein Boot.
//                                     ids = Liste von Platz-ids (A01, D07 ...), [] oder null loescht
//   game.stege.deckHoehe(bauart)     Hoehe der Laufflaeche: holz 0,86 m, schwimmsteg 0,46 m, kai 1,3 m
//   game.stege.platz(id)              { id, x, z, richtung, mesh } in Weltkoordinaten der aktuellen Stufe
//   Antippen: Steg-Teile tragen userData.pick = { type: 'jetty', id: 'A' }, Liegeplaetze
//   userData.pick = { type: 'berth', id: 'A01' } (ids wie in harbor.js).
//   Ereignis 'stufe' (Zahl) baut neu, beim Start gilt game.state.stufe oder ?stufe=n.
import * as THREE from 'three';
import { HAFEN } from '../data/harbor.js';

const U = HAFEN.einheiten?.meterProEinheit ?? 0.62;
const W = (x, y) => new THREE.Vector3(x * U, 0, -y * U);

const FARBE = {
  planke: '#d9b27c', planke2: '#c79d68', pfahl: '#4f4852', kappe: '#f4f1ea',
  schwimm: '#e3e0d8', schwimmer: '#8d939a', beton: '#c9c4ba', kante: '#f2c94c',
  poller: '#3a3f46', markierung: '#ffd23f',
};

function mat(c) { return new THREE.MeshLambertMaterial({ color: c, flatShading: true }); }

export function init(game) {
  const M = Object.fromEntries(Object.entries(FARBE).map(([k, c]) => [k, mat(c)]));
  const root = new THREE.Group();
  root.name = 'stege';
  game.scene.add(root);

  // Gemeinsame Geometrien
  const pfahlGeo = new THREE.CylinderGeometry(0.16, 0.16, 2.6, 6);
  const dalbeGeo = new THREE.CylinderGeometry(0.18, 0.2, 3.2, 6);
  const kappeGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.18, 6);
  const pollerGeo = new THREE.CylinderGeometry(0.22, 0.28, 0.6, 8);

  let stufe = 0;
  let plaetze = new Map();
  let gruppe = null;

  // ---------------------------------------------------------------- Stegteile
  function segment(a, b, breite, hoehe, dicke, material) {
    const len = a.distanceTo(b);
    const m = new THREE.Mesh(new THREE.BoxGeometry(len + breite * 0.5, dicke, breite), material);
    m.position.set((a.x + b.x) / 2, hoehe, (a.z + b.z) / 2);
    m.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
    return m;
  }

  function holzsteg(linie, g) {
    const b = Math.max(1.2, linie.breite * U);
    const pts = linie.punkte.map(([x, y]) => W(x, y));
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], e = pts[i + 1];
      g.add(segment(a, e, b, 0.75, 0.22, M.planke));
      // Pfaehle alle 3,5 m an beiden Seiten, Laengsbalken als dunklere Kante
      const len = a.distanceTo(e);
      const dir = e.clone().sub(a).normalize();
      const quer = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(b / 2 - 0.1);
      const n = Math.max(1, Math.round(len / 3.5));
      for (let k = 0; k <= n; k++) {
        const p = a.clone().addScaledVector(dir, (len * k) / n);
        for (const s of [1, -1]) {
          const pf = new THREE.Mesh(pfahlGeo, M.pfahl);
          pf.position.set(p.x + quer.x * s, -0.3, p.z + quer.z * s);
          g.add(pf);
        }
      }
      const kante = segment(a, e, b + 0.12, 0.6, 0.14, M.planke2);
      g.add(kante);
    }
  }

  function schwimmsteg(linie, g) {
    const b = Math.max(0.9, linie.breite * U);
    const pts = linie.punkte.map(([x, y]) => W(x, y));
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], e = pts[i + 1];
      g.add(segment(a, e, b, 0.38, 0.16, M.schwimm));
      g.add(segment(a, e, b * 0.9, 0.12, 0.3, M.schwimmer));
      const len = a.distanceTo(e);
      const dir = e.clone().sub(a).normalize();
      const quer = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(b / 2 + 0.25);
      const n = Math.max(1, Math.round(len / 12));
      for (let k = 0; k <= n; k++) {
        const p = a.clone().addScaledVector(dir, (len * k) / n);
        const pf = new THREE.Mesh(dalbeGeo, M.pfahl);
        pf.position.set(p.x + quer.x, 0.1 + 1.6 - 0.6, p.z + quer.z);
        g.add(pf);
      }
    }
  }

  function kai(linie, g) {
    const pts = linie.punkte.map(([x, y]) => W(x, y));
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], e = pts[i + 1];
      const len = a.distanceTo(e);
      const dir = e.clone().sub(a).normalize();
      // Kante liegt auf der Linie, die Kaiflaeche selbst gehoert zur Landschaft
      g.add(segment(a, e, 0.5, 1.15, 0.3, M.kante));
      const n = Math.max(1, Math.round(len / 9));
      for (let k = 0; k <= n; k++) {
        const p = a.clone().addScaledVector(dir, (len * k) / n);
        const po = new THREE.Mesh(pollerGeo, M.poller);
        po.position.set(p.x, 1.45, p.z);
        g.add(po);
      }
    }
  }

  // ---------------------------------------------------------------- Liegeplaetze
  function liegeplatz(p, g, nr) {
    const [x, y, richtung] = p.lage[stufe];
    const c = W(x, y);
    const rad = THREE.MathUtils.degToRad(richtung);
    const bug = new THREE.Vector3(Math.cos(rad), 0, -Math.sin(rad));   // zeigt zum Steg
    const seite = new THREE.Vector3(-bug.z, 0, bug.x);
    const L = p.laenge * U, B = p.breite * U;

    // Flaeche zum Antippen und Einfaerben
    const flMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false });
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(L * 0.96, B * 0.92), flMat);
    fl.rotation.x = -Math.PI / 2;
    fl.rotation.z = rad;
    fl.position.set(c.x, 0.06, c.z);
    fl.userData.pick = { type: 'berth', id: p.id };
    fl.renderOrder = 2;
    g.add(fl);

    if (p.art === 'box') {
      // Heckpfaehle am seeseitigen Ende, links und rechts der Box
      const heck = c.clone().addScaledVector(bug, -L / 2 + 0.3);
      for (const s of [0.5, -0.5]) {
        const d = new THREE.Mesh(dalbeGeo, M.pfahl);
        d.position.copy(heck).addScaledVector(seite, B * s);
        d.position.y = 0.6;
        g.add(d);
        const k = new THREE.Mesh(kappeGeo, M.kappe);
        k.position.copy(d.position);
        k.position.y = 2.25;
        g.add(k);
      }
    } else if (p.art === 'finger') {
      // Je zwei Boote zwischen zwei Fingerstegen: Finger an jeder zweiten Grenze
      const s = nr % 2 === 0 ? 0.5 : -0.5;
      const fl2 = L * 0.62;
      const mitte = c.clone().addScaledVector(bug, L / 2 - fl2 / 2).addScaledVector(seite, B * s);
      const f = new THREE.Mesh(new THREE.BoxGeometry(fl2, 0.14, 0.7), M.schwimm);
      f.position.set(mitte.x, 0.36, mitte.z);
      f.rotation.y = rad;
      g.add(f);
      const pf = new THREE.Mesh(dalbeGeo, M.pfahl);
      pf.position.copy(c).addScaledVector(bug, L / 2 - fl2).addScaledVector(seite, B * s);
      pf.position.y = 0.6;
      g.add(pf);
    }
    plaetze.set(p.id, { id: p.id, x: c.x, z: c.z, richtung, laenge: L, breite: B, art: p.art, mesh: fl });
  }

  // ---------------------------------------------------------------- Aufbau je Stufe
  function setStage(n) {
    const s = String(Math.max(1, Math.min(5, Math.round(Number(n) || 1))));
    if (s === String(stufe) && gruppe) return;
    stufe = s;
    if (gruppe) {
      root.remove(gruppe);
      gruppe.traverse((o) => { if (o.geometry && ![pfahlGeo, dalbeGeo, kappeGeo, pollerGeo].includes(o.geometry)) o.geometry.dispose(); });
    }
    gruppe = new THREE.Group();
    plaetze = new Map();
    const daten = HAFEN.stufen[stufe];
    for (const linie of daten.stege) {
      const g = new THREE.Group();
      if (linie.bauart === 'holz') holzsteg(linie, g);
      else if (linie.bauart === 'schwimmsteg') schwimmsteg(linie, g);
      else if (linie.bauart === 'kai') kai(linie, g);
      if (linie.steg) g.userData.pick = { type: 'jetty', id: linie.steg };
      gruppe.add(g);
    }
    let nr = 0;
    let letzterSteg = null;
    for (const p of HAFEN.plaetze) {
      if (!p.lage[stufe]) continue;
      if (p.steg !== letzterSteg) { nr = 0; letzterSteg = p.steg; }
      liegeplatz(p, gruppe, nr++);
    }
    root.add(gruppe);
    api.stage = Number(stufe);
    game.emit('stege', { stufe: Number(stufe), plaetze: plaetze.size });
  }

  function highlight(ids, farbe = '#ffd23f') {
    const set = new Set(ids ?? []);
    for (const p of plaetze.values()) {
      const an = set.has(p.id);
      p.mesh.material.opacity = an ? 0.45 : 0;
      if (an) p.mesh.material.color.set(farbe);
    }
  }

  // Hoehe der Laufoberflaeche ueber dem Wasser in Metern, z. B. fuer Fussgaenger
  const DECK = { holz: 0.86, schwimmsteg: 0.46, kai: 1.3 };
  const deckHoehe = (bauart) => DECK[bauart] ?? DECK.holz;

  const api = { group: root, setStage, highlight, deckHoehe, platz: (id) => plaetze.get(id) ?? null, stage: 0 };
  game.stege = api;
  game.on('stufe', (n) => setStage(typeof n === 'object' ? n?.stufe : n));

  const start = new URLSearchParams(location.search).get('stufe');
  setStage(start ?? game.state?.stufe ?? 1);
  return api;
}

export default init;
