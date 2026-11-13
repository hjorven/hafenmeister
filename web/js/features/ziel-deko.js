// Deko-Stücke für den Hafen, verdient mit Tagesziel und Wochenziel (features/tagesziele.js).
// Sie stehen als kleiner Platz auf der Wiese beim Hafenmeisterhaus (Landseite), in der Reihenfolge
// von DEKO, nie auf Wegen, in Gebäuden, auf Bauplätzen von Anlagen, im Wasser oder am Hang. Geladen von tagesziele.js, nicht aus main.js, weil es Three.js braucht.
//
// Liest state.modules.ziele.deko (Liste der ids). Ereignis 'ziel:deko' { id } stellt das Stück sofort auf,
// mit einem kurzen Hüpfer. Schnittstelle: game.zielDeko = { group, aufbauen(), lage(id) }.
import * as THREE from 'three';
import { DEKO } from './tagesziele.js';
import { SERVICES } from '../data/services.js';

// Wunschlage relativ zum Hafenmeisterhaus in Metern (x nach Osten, z nach Süden = Landseite), dreh in Grad.
// Ist die Stelle belegt (Gebäude, Anlage, Weg, Wasser, Hang), sucht platzSuche den nächsten freien Punkt.
const LAGE = {
  kuebel:       { x: -6.5, z: 6.0, dreh: 0 },
  bank:         { x: -2.5, z: 6.5, dreh: 180 },
  laterne:      { x: 1.0,  z: 6.0, dreh: 0 },
  rettungsring: { x: 4.5,  z: 6.0, dreh: 180 },
  anker:        { x: -1.0, z: 9.5, dreh: 30 },
  fischkisten:  { x: 4.0,  z: 9.5, dreh: -15 },
  tonne:        { x: -5.5, z: 9.5, dreh: 0 },
  wimpel:       { x: 8.0,  z: 8.0, dreh: 0 },
};
const RADIUS = { kuebel: 1.6, bank: 1.3, laterne: 0.6, rettungsring: 0.7, anker: 1.1, fischkisten: 1.3, tonne: 0.9, wimpel: 1.6 };
const U = 0.62;   // Planeinheit in Metern (data/harbor.js)

/** Abstand Punkt zu Strecke (2D). */
function abstandStrecke(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const l2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2));
  return Math.hypot(px - ax - t * dx, pz - az - t * dz);
}

const FARBE = {
  holz: '#9a6b43', holzHell: '#c99a62', eisen: '#3b4048', rost: '#8a4b2e', rot: '#c8453a', weiss: '#f4f1ea',
  ton: '#b5643c', erde: '#5b4433', gruen: '#4f8a4b', bluete: '#e7b23c', bluete2: '#d9607a', glas: '#ffe7a3',
  blau: '#2f6f8f', gelb: '#f2c14e',
};

export function init(game) {
  const M = Object.fromEntries(Object.entries(FARBE).map(([k, c]) => [k, new THREE.MeshLambertMaterial({ color: c, flatShading: true })]));
  const glas = M.glas;
  const box = (w, h, d, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; return o; };
  const zyl = (r1, r2, h, m, x = 0, y = 0, z = 0, seg = 8) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), m); o.position.set(x, y, z); o.castShadow = true; return o; };

  const BAU = {
    kuebel() {
      const g = new THREE.Group();
      for (const dx of [-0.9, 0.9]) {
        g.add(zyl(0.45, 0.35, 0.6, M.ton, dx, 0.3, 0));
        g.add(zyl(0.4, 0.4, 0.06, M.erde, dx, 0.6, 0));
        g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), M.gruen).translateX(dx).translateY(0.85));
        g.add(box(0.18, 0.18, 0.18, dx < 0 ? M.bluete : M.bluete2, dx + 0.15, 1.15, 0.1));
        g.add(box(0.16, 0.16, 0.16, dx < 0 ? M.bluete2 : M.bluete, dx - 0.18, 1.05, -0.12));
      }
      return g;
    },
    bank() {
      const g = new THREE.Group();
      g.add(box(2.0, 0.1, 0.5, M.holzHell, 0, 0.5, 0));
      g.add(box(2.0, 0.45, 0.08, M.holzHell, 0, 0.85, 0.24));
      for (const dx of [-0.85, 0.85]) g.add(box(0.1, 0.5, 0.5, M.eisen, dx, 0.25, 0));
      return g;
    },
    laterne() {
      const g = new THREE.Group();
      g.add(zyl(0.12, 0.16, 3.0, M.eisen, 0, 1.5, 0, 6));
      g.add(box(0.45, 0.5, 0.45, glas, 0, 3.2, 0));
      g.add(zyl(0.05, 0.38, 0.25, M.eisen, 0, 3.6, 0, 4));
      return g;
    },
    rettungsring() {
      const g = new THREE.Group();
      g.add(box(0.15, 1.8, 0.15, M.holz, 0, 0.9, 0));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.12, 6, 12), M.rot);
      ring.position.set(0, 1.25, -0.12);
      ring.castShadow = true;
      g.add(ring);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        g.add(box(0.14, 0.14, 0.26, M.weiss, Math.cos(a) * 0.42, 1.25 + Math.sin(a) * 0.42, -0.12));
      }
      return g;
    },
    anker() {
      const g = new THREE.Group();
      g.add(box(1.4, 0.2, 1.4, M.holz, 0, 0.1, 0));
      g.add(box(0.16, 1.7, 0.16, M.eisen, 0, 1.05, 0));
      g.add(box(0.9, 0.12, 0.12, M.eisen, 0, 1.75, 0));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.04, 4, 8), M.eisen);
      ring.position.set(0, 1.98, 0);
      g.add(ring);
      for (const s of [-1, 1]) {
        const arm = box(0.6, 0.14, 0.14, M.rost, s * 0.3, 0.42, 0);
        arm.rotation.z = s * 0.5;
        g.add(arm);
        g.add(box(0.2, 0.3, 0.16, M.rost, s * 0.58, 0.62, 0));
      }
      return g;
    },
    fischkisten() {
      const g = new THREE.Group();
      g.add(box(0.9, 0.4, 0.6, M.blau, 0, 0.2, 0));
      g.add(box(0.9, 0.4, 0.6, M.gelb, 0.15, 0.6, 0.05));
      g.add(box(0.9, 0.4, 0.6, M.blau, 1.0, 0.2, -0.1));
      g.add(box(0.75, 0.05, 0.45, M.weiss, 0.15, 0.82, 0.05));
      return g;
    },
    tonne() {
      const g = new THREE.Group();
      g.add(zyl(0.55, 0.7, 1.2, M.rot, 0, 0.6, 0, 10));
      g.add(zyl(0.56, 0.56, 0.2, M.weiss, 0, 0.75, 0, 10));
      g.add(new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.6, 10), M.rot).translateY(1.5));
      return g;
    },
    wimpel() {
      const g = new THREE.Group();
      g.add(zyl(0.07, 0.1, 5.5, M.weiss, 0, 2.75, 0, 6));
      const farben = [M.rot, M.gelb, M.blau, M.gruen, M.weiss, M.rot, M.gelb];
      farben.forEach((m, i) => {
        const t = i / (farben.length - 1);
        const w = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 3), m);
        w.rotation.x = Math.PI;
        w.position.set(0.25 + t * 2.4, 5.2 - t * 4.6 - 0.2, 0);
        w.userData.flattern = i;
        g.add(w);
      });
      return g;
    },
  };

  const group = new THREE.Group();
  group.name = 'ziel-deko';
  game.scene.add(group);
  const stuecke = new Map();
  const huepfer = [];

  function anker() {
    const stufe = game.buildings?.stage ?? game.sim?.state?.stage ?? 1;
    const l = game.buildings?.lage?.('hafenmeister', stufe);
    return l ? { x: l.x, z: l.z, stufe } : null;
  }

  // Was in dieser Stufe schon steht oder noch kommen kann: Gebäude (auch ungekaufte), Anlagen samt
  // Bauplätzen, Wege der Landschaft und das Wegenetz der Menschen.
  const _b = new THREE.Box3();
  function hindernisse(stufe) {
    const kasten = [];
    for (const it of game.buildings?.items ?? []) {
      if (stufe < (it.ab ?? 1) || (it.bis != null && stufe > it.bis)) continue;
      const l = it.p ? game.buildings.lage(it.id, stufe) : null;
      const m = it.mesh;
      if (!m) continue;
      const alt = m.position.clone();
      if (l) m.position.set(l.x, l.y, l.z);
      m.updateMatrixWorld(true);
      _b.setFromObject(m);
      if (l && !m.parent) m.position.copy(alt);
      if (!_b.isEmpty()) kasten.push({ x0: _b.min.x - 1.2, x1: _b.max.x + 1.2, z0: _b.min.z - 1.2, z1: _b.max.z + 1.2 });
    }
    const kreise = [];
    for (const sv of SERVICES) {
      if ((sv.abStufe ?? 1) > stufe) continue;
      const lagen = [sv.lage, ...(sv.stufen || []).map((st) => st.lage)].filter(Boolean);
      for (const l of lagen) kreise.push({ x: l.x * U, z: -l.y * U, r: (sv.radius ?? 8) + 2 });
    }
    const strecken = [];
    for (const w of game.landschaft?.wege ?? []) {
      for (let i = 1; i < w.punkte.length; i++) {
        const a = w.punkte[i - 1], b = w.punkte[i];
        strecken.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z, r: (w.breite || 2) / 2 + 1 });
      }
    }
    const netz = game.people?.netz;
    if (netz?.adj) {
      netz.adj.forEach((nb, i) => {
        for (const j of nb) {
          if (j < i) continue;
          const a = netz.nodes[i], b = netz.nodes[j];
          strecken.push({ ax: a.x * U, az: -a.y * U, bx: b.x * U, bz: -b.y * U, r: 1.3 });
        }
      });
    }
    return { kasten, kreise, strecken };
  }

  function frei(x, z, r, h, gesetzt) {
    const L = game.landschaft;
    const boden = L?.hoeheBei?.(x, z);
    if (!Number.isFinite(boden) || boden < 0.4 + (L?.pegel ?? 0)) return false;     // Wasser oder Strand am Wasser
    for (const [dx, dz] of [[r, 0], [-r, 0], [0, r], [0, -r]]) {
      const n = L.hoeheBei(x + dx, z + dz);
      if (!Number.isFinite(n) || Math.abs(n - boden) > 0.45) return false;           // Hang, Kante, Ufer
    }
    for (const k of h.kasten) if (x + r > k.x0 && x - r < k.x1 && z + r > k.z0 && z - r < k.z1) return false;
    for (const k of h.kreise) if (Math.hypot(x - k.x, z - k.z) < k.r + r) return false;
    for (const s of h.strecken) if (abstandStrecke(x, z, s.ax, s.az, s.bx, s.bz) < s.r + r) return false;
    for (const g of gesetzt) if (Math.hypot(x - g.x, z - g.z) < g.r + r + 0.6) return false;
    return true;
  }

  /** Freie Punkte für alle Stücke der Reihe nach, nahe an der Wunschlage (Spirale bis 30 m). */
  function platzSuche(ids) {
    const a = anker();
    if (!a) return new Map();
    const h = hindernisse(a.stufe);
    const gesetzt = [];
    const out = new Map();
    for (const id of ids) {
      const p = LAGE[id];
      const r = RADIUS[id] ?? 1;
      let fund = null;
      for (let ring = 0; ring <= 30 && !fund; ring += 1) {
        const n = ring === 0 ? 1 : Math.ceil(ring * 4);
        for (let k = 0; k < n && !fund; k++) {
          const w = (k / n) * Math.PI * 2;
          const x = a.x + p.x + Math.cos(w) * ring;
          const z = a.z + p.z + Math.sin(w) * ring;
          if (frei(x, z, r, h, gesetzt)) fund = { x, z };
        }
      }
      if (!fund) continue;
      gesetzt.push({ ...fund, r });
      out.set(id, { x: fund.x, z: fund.z, y: game.landschaft.hoeheBei(fund.x, fund.z), dreh: THREE.MathUtils.degToRad(p.dreh) });
    }
    return out;
  }

  let lagen = new Map();
  const lage = (id) => lagen.get(id) ?? null;

  function aufbauen() {
    const besitz = game.sim?.state?.modules?.ziele?.deko ?? [];
    lagen = platzSuche(DEKO.map((d) => d.id).filter((id) => besitz.includes(id)));
    for (const d of DEKO) {
      let o = stuecke.get(d.id);
      if (!besitz.includes(d.id)) { if (o) { group.remove(o); stuecke.delete(d.id); } continue; }
      if (!o) {
        o = BAU[d.id]();
        o.name = `deko-${d.id}`;
        stuecke.set(d.id, o);
        group.add(o);
      }
      const l = lagen.get(d.id);
      if (!l) { o.visible = false; continue; }
      o.visible = true;
      o.position.set(l.x, l.y, l.z);
      o.rotation.y = l.dreh;
    }
  }

  let zeit = 0;
  game.onTick?.((dt) => {
    zeit += dt;
    for (let i = huepfer.length - 1; i >= 0; i--) {
      const h = huepfer[i];
      h.t += dt;
      const k = Math.min(1, h.t / 0.6);
      h.o.scale.setScalar(k < 1 ? 0.2 + 0.8 * k + Math.sin(k * Math.PI) * 0.25 : 1);
      if (k >= 1) huepfer.splice(i, 1);
    }
    const w = stuecke.get('wimpel');
    if (w) for (const c of w.children) if (c.userData.flattern != null) c.rotation.z = Math.sin(zeit * 3 + c.userData.flattern) * 0.25;
  });

  game.on('ziel:deko', ({ id } = {}) => {
    aufbauen();
    const o = stuecke.get(id);
    if (o) huepfer.push({ o, t: 0 });
  });
  // Nach Stufe, Kauf (neues Gebäude) und Neubau der Landschaft neu suchen
  game.on('stufe', () => setTimeout(aufbauen, 50));
  game.on('build', () => setTimeout(aufbauen, 50));
  game.on('services:gebaut', () => setTimeout(aufbauen, 50));
  game.landschaft?.beiNeubau?.(() => setTimeout(aufbauen, 50));
  game.on('ready', aufbauen);
  game.on('spielstand-geladen', aufbauen);
  game.on('sim:change', (e) => { if (e?.reason === 'load') aufbauen(); });
  aufbauen();

  game.zielDeko = { group, aufbauen, lage };
  return game.zielDeko;
}
