// Unbewegte Teile eines Modells zu wenigen Meshes zusammenfassen (je Material eines).
// Genutzt von services.js und buildings.js. Ein Service oder Gebaeude besteht aus vielen kleinen Koerpern (Poller, Fenster, Tische). Jeder ist ein eigener
// Zeichenaufruf; in Stufe 6 waren das rund 600. Hier wird gemessen, welche Teile sich bewegen:
// update() laeuft probeweise zu mehreren Zeiten und Tageszeiten, was sich dabei nicht aendert
// (Lage, Drehung, Groesse, Sichtbarkeit), wird verschmolzen. Bewegte Teile bleiben einzeln.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const PROBE_ZEITEN = [0.37, 1.9, 3.1, 4.4, 6.25, 7.7, 9.05, 11.7, 13.3, 17.9];
const PROBE_UHR = [0.05, 0.2, 0.35, 0.5, 0.62, 0.7, 0.8, 0.9, 0.97, 0.45];

function sichtbar(o, wurzel) {
  for (let p = o; p && p !== wurzel; p = p.parent) if (!p.visible) return false;
  return true;
}

// Liefert die Anzahl der Meshes vorher und nachher.
// setzeUhr(wert|null): Tageszeit, die die Modelle waehrend der Probe sehen.
// ausnehmen(obj): true fuer Objekte, die samt Inhalt einzeln bleiben (z. B. wehende Flaggen).
export function buendeln(gruppe, update, setzeUhr = () => {}, { ausnehmen = null } = {}) {
  const meshes = [];
  const frei = (o) => { for (let p = o; p && p !== gruppe; p = p.parent) if (ausnehmen?.(p)) return false; return true; };
  gruppe.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && !o.isSkinnedMesh && frei(o)) meshes.push(o); });
  if (meshes.length < 4) return { vorher: meshes.length, nachher: meshes.length };

  const inv = new THREE.Matrix4();
  const lokal = new THREE.Matrix4();
  const messen = () => {
    gruppe.updateMatrixWorld(true);
    inv.copy(gruppe.matrixWorld).invert();
    return meshes.map((m) => {
      lokal.multiplyMatrices(inv, m.matrixWorld);
      return { e: lokal.elements.slice(), v: sichtbar(m, gruppe), o: m.material?.opacity };
    });
  };
  const start = messen();
  const bewegt = new Array(meshes.length).fill(false);
  if (update) {
    try {
      PROBE_ZEITEN.forEach((t, i) => {
        setzeUhr(PROBE_UHR[i]);
        update(0.5, t);
        messen().forEach((s, k) => {
          const a = start[k];
          if (s.v !== a.v || s.o !== a.o || s.e.some((x, j) => Math.abs(x - a.e[j]) > 1e-4)) bewegt[k] = true;
        });
      });
    } finally {
      setzeUhr(null);
    }
  }

  // Unbewegte, sichtbare, undurchsichtige Teile nach Material sammeln
  gruppe.updateMatrixWorld(true);
  inv.copy(gruppe.matrixWorld).invert();
  const nachMaterial = new Map();
  meshes.forEach((m, k) => {
    if (bewegt[k] || !start[k].v || Array.isArray(m.material) || m.material?.transparent) return;
    const liste = nachMaterial.get(m.material) ?? [];
    liste.push(m);
    nachMaterial.set(m.material, liste);
  });

  let entfernt = 0, neu = 0;
  for (const [material, liste] of nachMaterial) {
    if (liste.length < 2) continue;
    const geos = liste.map((m) => {
      let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
      if (!g.attributes.normal) g.computeVertexNormals();
      lokal.multiplyMatrices(inv, m.matrixWorld);
      g.applyMatrix4(lokal);
      return g;
    });
    const zusammen = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!zusammen) continue;
    const mesh = new THREE.Mesh(zusammen, material);
    mesh.name = 'gebuendelt';
    mesh.userData.fest = true;
    mesh.castShadow = liste.some((m) => m.castShadow);
    mesh.receiveShadow = liste.some((m) => m.receiveShadow);
    for (const m of liste) {
      m.parent?.remove(m);
      m.geometry.dispose();
      entfernt++;
    }
    gruppe.add(mesh);
    neu++;
  }
  // Leer gewordene Gruppen ohne Funktion wegraeumen
  const leer = [];
  gruppe.traverse((o) => { if (o !== gruppe && o.isGroup && o.children.length === 0) leer.push(o); });
  for (const o of leer) o.parent?.remove(o);
  return { vorher: meshes.length, nachher: meshes.length - entfernt + neu };
}
