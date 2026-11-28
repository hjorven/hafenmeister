// Bild zu "Hafen verschönern" (P60, features/verschoenern.js, docs/verschoenern.md): Bänke, Blumenkübel,
// Bäume und Laternen an Land, Geisterbild für das Baumenü, Licht am Abend, Laub je Jahreszeit,
// Anstrich der Hafenhäuser (game.buildings.anstrich).
//
// Plätze: Jedes Stück sucht sich selbst einen Platz auf freiem, ebenem Land der Hafenfläche, nah an dem,
// was im Hafen steht (Stegwurzeln und Hafengebäude). Nie auf Wegen, Stegen, Molen, in Gebäuden (auch noch
// nicht gekauften), auf Bauplätzen von Angeboten, im Wasser oder am Hang.
// - Bänke 2 bis 6 m vom Wasser, mit Blick aufs Wasser.
// - Laternen dicht neben den Wegen, mindestens 14 m auseinander.
// - Bäume 2 bis 7 m neben den Wegen, mindestens 6 m vom Wasser, 9 m auseinander.
// - Blumenkübel dicht an Wegen und Hafengebäuden.
// Die Plätze werden für alle Stücke gesucht, die die Ausbaustufe erlaubt, in fester Reihenfolge. Was gebaut
// ist, ändert also nie, wo die anderen stehen; der nächste Abschnitt steht genau dort, wo die Vorschau ihn
// zeigt. Nach einem Stufenausbau werden die Plätze neu gesucht (neue Wege, neue Gebäude).
import * as THREE from 'three';
import { SERVICES } from '../data/services.js';
import { REGELN, ARTEN, stueckBis, abschnitteGebaut, baumWuchs, farbeVon, angebote } from '../features/verschoenern.js';

const U = 0.62;                       // Planeinheit in Metern
const ZELLE = 1.5;                    // Suchraster in Metern
// Hafenfläche (render/landschaft/gelaende.js HAFENFLAECHE, Planeinheiten), dort ist das Land eben und baumfrei
const FLAECHE = { x0: -165, x1: 215, y0: -92, y1: 600 };
// Suchradius um Stegwurzeln und Hafengebäude je Ausbaustufe (m)
const RADIUS = [34, 44, 62, 80, 95, 110];
const SZENE_GRUPPEN = ['landschaft', 'gebaeude', 'services', 'wetterflagge'];
const HAFEN_ARTEN = new Set(['toilette', 'hafenmeister', 'dusche', 'kiosk', 'hafenbuero', 'sanitaer', 'waschhaus', 'restaurant', 'speicher', 'bootsschuppen']);
const STUECK = {
  baenke:   { r: 1.2, abstand: 7 },
  kuebel:   { r: 0.7, abstand: 5 },
  laternen: { r: 0.45, abstand: 14 },
  baeume:   { r: 1.8, abstand: 9 },
};
// Reihenfolge der Suche: Bänke zuerst (brauchen das Ufer), Bäume zuletzt (brauchen am meisten Platz)
const FOLGE = ['baenke', 'laternen', 'kuebel', 'baeume'];

const FARBE = {
  holz: '#8d6440', holzHell: '#c3935d', eisen: '#2f3a35', laterne: '#2f4a3e', glas: '#fff0b8', stamm: '#6b4a32',
  kuebel: '#8a5a36', reifen: '#3b3f44', erde: '#4e3b2c', blatt: '#4f8a4b', tanne: '#2f5d3f',
  bluete: ['#e7b23c', '#d9607a', '#f4f1ea', '#9b6fd0', '#e8743b'],
};
const LAUB = { fruehling: '#8cc46a', sommer: '#4f8a4b', herbst: '#d08a3a', winter: '#8b7b68' };

function abstandStrecke(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const l2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2));
  return Math.hypot(px - ax - t * dx, pz - az - t * dz);
}

export function bildInit(game, { st, ctx, wahl }) {
  const mat = (c, extra = {}) => new THREE.MeshLambertMaterial({ color: c, flatShading: true, ...extra });
  const M = Object.fromEntries(Object.entries(FARBE).filter(([, c]) => typeof c === 'string').map(([k, c]) => [k, mat(c)]));
  M.glas = mat(FARBE.glas, { emissive: new THREE.Color('#ffc65a'), emissiveIntensity: 0.1 });
  M.bluete = FARBE.bluete.map((c) => mat(c));
  M.laub = mat(LAUB.sommer);
  M.laub2 = mat(LAUB.sommer);
  const schein = new THREE.MeshBasicMaterial({ color: '#ffd77a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const geistMat = new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.5, depthWrite: false });
  const rauteGeo = new THREE.OctahedronGeometry(0.55, 0);
  const rauteMat = new THREE.MeshBasicMaterial({ color: '#ffd23f', depthTest: false, transparent: true, opacity: 0.95 });
  const kreisGeo = new THREE.RingGeometry(1.3, 1.65, 24).rotateX(-Math.PI / 2);
  const kreisMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, depthWrite: false, depthTest: false });

  const box = (w, h, d, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; return o; };
  const zyl = (r1, r2, h, m, x = 0, y = 0, z = 0, seg = 8) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), m); o.position.set(x, y, z); o.castShadow = true; return o; };

  // ---------------------------------------------------------------- Modelle (Blick nach -z)
  const BAU = {
    baenke() {
      const g = new THREE.Group();
      for (const dz of [-0.16, 0, 0.16]) g.add(box(1.9, 0.07, 0.13, M.holzHell, 0, 0.5, dz));
      for (const dy of [0.72, 0.92]) g.add(box(1.9, 0.12, 0.06, M.holzHell, 0, dy, 0.27));
      for (const dx of [-0.8, 0.8]) {
        g.add(box(0.09, 0.5, 0.5, M.eisen, dx, 0.25, 0));
        g.add(box(0.09, 0.62, 0.08, M.eisen, dx, 0.8, 0.29));
        g.add(box(0.09, 0.06, 0.42, M.eisen, dx, 0.68, 0.03));
      }
      return g;
    },
    kuebel(i) {
      const g = new THREE.Group();
      g.add(zyl(0.5, 0.42, 0.62, M.kuebel, 0, 0.31, 0, 10));
      for (const y of [0.12, 0.5]) g.add(zyl(0.51, 0.47, 0.06, M.reifen, 0, y, 0, 10));
      g.add(zyl(0.45, 0.45, 0.05, M.erde, 0, 0.6, 0, 10));
      const busch = new THREE.Mesh(new THREE.IcosahedronGeometry(0.46, 0), M.blatt);
      busch.position.y = 0.86; busch.scale.set(1, 0.75, 1); busch.castShadow = true;
      busch.userData.busch = true;
      g.add(busch);
      const bl = new THREE.Group();
      bl.userData.blueten = true;
      const a = M.bluete[i % M.bluete.length], b = M.bluete[(i + 2) % M.bluete.length];
      for (let k = 0; k < 6; k++) {
        const w = (k / 6) * Math.PI * 2 + i;
        bl.add(box(0.15, 0.15, 0.15, k % 2 ? a : b, Math.cos(w) * 0.3, 1.02 + (k % 3) * 0.05, Math.sin(w) * 0.3));
      }
      g.add(bl);
      return g;
    },
    baeume(i) {
      const g = new THREE.Group();
      const krone = new THREE.Group();
      krone.userData.krone = true;
      g.add(zyl(0.16, 0.24, 2.6, M.stamm, 0, 1.3, 0, 6));
      const teile = [[0, 3.3, 0, 1.5], [0.7, 2.9, 0.3, 1.0], [-0.6, 3.0, -0.4, 1.05], [0.1, 4.1, 0.1, 1.0]];
      teile.forEach(([x, y, z, r], k) => {
        const c = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), (k + i) % 2 ? M.laub : M.laub2);
        c.position.set(x, y, z); c.castShadow = true;
        krone.add(c);
      });
      const aeste = new THREE.Group();
      aeste.userData.aeste = true;
      for (const [w, h] of [[0.6, 2.4], [-0.7, 2.7], [2.2, 2.9], [3.6, 2.5], [4.8, 3.1], [1.5, 3.4]]) {
        const a = zyl(0.05, 0.09, 1.8, M.stamm, Math.cos(w) * 0.45, h + 0.55, Math.sin(w) * 0.45, 5);
        a.rotation.z = Math.cos(w) * 0.6; a.rotation.x = -Math.sin(w) * 0.6;
        aeste.add(a);
      }
      aeste.visible = false;
      g.add(krone, aeste);
      g.rotation.y = i * 1.7;
      return g;
    },
    laternen() {
      const g = new THREE.Group();
      g.add(zyl(0.22, 0.26, 0.35, M.laterne, 0, 0.17, 0, 8));
      g.add(zyl(0.07, 0.1, 3.2, M.laterne, 0, 1.9, 0, 6));
      g.add(box(0.12, 0.12, 0.7, M.laterne, 0, 3.45, -0.25));
      const kopf = new THREE.Group();
      kopf.position.set(0, 3.1, -0.55);
      kopf.add(box(0.42, 0.5, 0.42, M.glas, 0, 0, 0));
      kopf.add(zyl(0.06, 0.36, 0.22, M.laterne, 0, 0.36, 0, 4).rotateY(Math.PI / 4));
      kopf.add(box(0.46, 0.06, 0.46, M.laterne, 0, -0.27, 0));
      g.add(kopf);
      const licht = new THREE.Mesh(new THREE.CircleGeometry(3.2, 20).rotateX(-Math.PI / 2), schein);
      licht.position.set(0, 0.06, -0.55);
      licht.userData.schein = true;
      g.add(licht);
      return g;
    },
  };

  const root = new THREE.Group();
  root.name = 'verschoenern';
  game.scene.add(root);
  const stuecke = new Map();   // `${art}-${i}` -> Object3D
  const huepfer = [];

  // ---------------------------------------------------------------- Plätze suchen
  function stufe() { return st()?.stage ?? game.buildings?.stage ?? 1; }

  // Was im Hafen steht: Hafengebäude und Stegwurzeln (Weltmeter)
  function anker() {
    const out = [];
    for (const it of game.buildings?.items ?? []) {
      if (!it.mesh?.parent || !HAFEN_ARTEN.has(it.art)) continue;
      out.push({ x: it.mesh.position.x, z: it.mesh.position.z, haus: true });
    }
    for (const s of game.stege?.gebaut?.()?.stege ?? []) {
      const p = s.punkte;
      if (!p?.length) continue;
      const w = p[0][1] <= p[p.length - 1][1] ? p[0] : p[p.length - 1];   // Wurzel: das südlichste Ende
      out.push({ x: w[0] * U, z: -w[1] * U, haus: false });
    }
    return out;
  }

  const _b = new THREE.Box3();
  function hindernisse(n, mitte) {
    const kasten = [];
    for (const it of game.buildings?.items ?? []) {
      if (n < (it.ab ?? 1) || (it.bis != null && n > it.bis)) continue;
      const l = it.p ? game.buildings.lage(it.id, n) : null;
      if (it.p && !l) continue;
      const m = it.mesh;
      if (!m) continue;
      const alt = m.position.clone();
      if (l) m.position.set(l.x, l.y, l.z);
      m.updateMatrixWorld(true);
      _b.setFromObject(m);
      if (l && !m.parent) m.position.copy(alt);
      if (!_b.isEmpty()) kasten.push({ x0: _b.min.x - 2.5, x1: _b.max.x + 2.5, z0: _b.min.z - 2.5, z1: _b.max.z + 2.5, haus: HAFEN_ARTEN.has(it.art) });
    }
    const kreise = [];
    for (const sv of SERVICES) {
      if ((sv.abStufe ?? 1) > n) continue;
      const lagen = [sv.lage, ...(sv.stufen || []).map((s) => s.lage)].filter(Boolean);
      for (const l of lagen) kreise.push({ x: l.x * U, z: -l.y * U, r: (sv.radius ?? 8) + 2 });
    }
    const strecken = [];
    for (const w of game.landschaft?.wege ?? []) {
      for (let i = 1; i < w.punkte.length; i++) {
        const a = w.punkte[i - 1], b = w.punkte[i];
        // Promenade und Kai sind Plätze: Bänke, Kübel und Laternen dürfen an ihren Rand, frei bleibt die Mitte
        const platz = w.typ === 'promenade';
        const rand = (w.breite || 2) / 2 + 0.6;
        strecken.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z, r: platz ? 3 : rand, rand, platz, weg: w.typ !== 'mole' });
      }
    }
    const netz = game.people?.netz;
    if (typeof netz?.strecken === 'function') {
      for (const [ax, ay, bx, by] of netz.strecken()) strecken.push({ ax: ax * U, az: -ay * U, bx: bx * U, bz: -by * U, r: 1.4, rand: 1.4, weg: false });
    }
    // Alles andere an Land: Dorf, Anlagen, Flaggenmast. Flaches und Riesiges zählt nicht.
    for (const name of SZENE_GRUPPEN) {
      const gr = game.scene?.getObjectByName(name);
      gr?.updateMatrixWorld(true);
      gr?.traverseVisible((o) => {
        if (!o.isMesh || o.isInstancedMesh || !o.geometry) return;
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        _b.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
        if (_b.isEmpty() || _b.max.y - _b.min.y < 0.3) return;
        if (_b.max.x - _b.min.x > 40 || _b.max.z - _b.min.z > 40) return;
        const cx = (_b.min.x + _b.max.x) / 2, cz = (_b.min.z + _b.max.z) / 2;
        if (cx < mitte.x0 - 10 || cx > mitte.x1 + 10 || cz < mitte.z0 - 10 || cz > mitte.z1 + 10) return;
        const m = 1 + Math.min(1.5, (_b.max.y - _b.min.y) * 0.3);
        kasten.push({ x0: _b.min.x - m, x1: _b.max.x + m, z0: _b.min.z - m, z1: _b.max.z + m });
      });
    }
    return { kasten, kreise, strecken };
  }

  /**
   * Plätze aller Stücke, die Stufe n erlaubt: Map art -> [{ x, y, z, dreh }]. Rein aus Gelände, Stegen,
   * Wegen und Gebäuden, nicht aus dem, was schon gekauft ist.
   */
  function sucheplaetze(n) {
    const L = game.landschaft;
    const out = new Map(ARTEN.map((a) => [a, []]));
    if (!L?.hoeheBei) return out;
    const A = anker();
    if (!A.length) return out;
    const R = RADIUS[Math.max(0, Math.min(5, n - 1))];
    const x0 = Math.max(FLAECHE.x0 * U, Math.min(...A.map((a) => a.x)) - R);
    const x1 = Math.min(FLAECHE.x1 * U, Math.max(...A.map((a) => a.x)) + R);
    const z0 = Math.max(-FLAECHE.y1 * U, Math.min(...A.map((a) => a.z)) - R);
    const z1 = Math.min(-FLAECHE.y0 * U, Math.max(...A.map((a) => a.z)) + R);
    const nx = Math.max(1, Math.ceil((x1 - x0) / ZELLE)), nz = Math.max(1, Math.ceil((z1 - z0) / ZELLE));
    const pegel = L.pegel ?? 0;
    // Höhe und Wasser je Zelle, Abstand zum Wasser (Mehrquellen-Suche, 8 Nachbarn)
    const hoehe = new Float32Array(nx * nz);
    const wasserAb = new Float32Array(nx * nz).fill(Infinity);
    const quelle = new Int32Array(nx * nz).fill(-1);
    const schlange = [];
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      const h = L.hoeheBei(x0 + (i + 0.5) * ZELLE, z0 + (j + 0.5) * ZELLE);
      hoehe[k] = Number.isFinite(h) ? h : -99;
      if (hoehe[k] < pegel + 0.05) { wasserAb[k] = 0; quelle[k] = k; schlange.push(k); }
    }
    for (let q = 0; q < schlange.length; q++) {
      const k = schlange[q];
      const i = k % nx, j = (k / nx) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
        const kk = jj * nx + ii;
        if (quelle[kk] >= 0) continue;   // schon erreicht (Breitensuche, Abstand zur Quelle ist nah genug)
        const s = quelle[k];
        wasserAb[kk] = Math.hypot((ii - (s % nx)) * ZELLE, (jj - ((s / nx) | 0)) * ZELLE);
        quelle[kk] = s;
        schlange.push(kk);
      }
    }
    const h = hindernisse(n, { x0, x1, z0, z1 });
    const gesetzt = [];
    const kandidat = [];
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      const x = x0 + (i + 0.5) * ZELLE, z = z0 + (j + 0.5) * ZELLE;
      if (hoehe[k] < pegel + 0.25) continue;   // nasser Strand, Schilf
      let dA = Infinity, dH = Infinity;
      for (const a of A) { const d = Math.hypot(x - a.x, z - a.z); if (d < dA) dA = d; if (a.haus && d < dH) dH = d; }
      if (dA > R) continue;
      // Abstand zum nächsten Weg (Rand), nur echte Wege an Land
      let dW = Infinity;
      let aufPlatz = false;
      for (const s of h.strecken) {
        if (!s.weg) continue;
        const d = abstandStrecke(x, z, s.ax, s.az, s.bx, s.bz);
        dW = Math.min(dW, Math.abs(d - s.rand));
        if (s.platz && d < s.rand) aufPlatz = true;
      }
      // Abstand zum Rand des nächsten Hafengebäudes (Kasten schon mit 2,5 m Rand)
      let dK = Infinity;
      for (const b of h.kasten) if (b.haus) dK = Math.min(dK, Math.max(b.x0 - x, x - b.x1, b.z0 - z, z - b.z1, 0) + (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 ? 0 : 0));
      kandidat.push({ k, x, z, dA, dH, dW, dK, aufPlatz, wasser: wasserAb[k], quelle: quelle[k] });
    }
    const frei = (c, r) => {
      const boden = hoehe[c.k];
      const L2 = game.landschaft;
      for (const [dx, dz] of [[r, 0], [-r, 0], [0, r], [0, -r]]) {
        const v = L2.hoeheBei(c.x + dx, c.z + dz);
        if (!Number.isFinite(v) || Math.abs(v - boden) > 0.45 || v < pegel + 0.2) return false;
      }
      for (const b of h.kasten) if (c.x + r > b.x0 && c.x - r < b.x1 && c.z + r > b.z0 && c.z - r < b.z1) return false;
      for (const b of h.kreise) if (Math.hypot(c.x - b.x, c.z - b.z) < b.r + r) return false;
      for (const s of h.strecken) if (abstandStrecke(c.x, c.z, s.ax, s.az, s.bx, s.bz) < s.r + r) return false;
      return true;
    };
    const netz = game.people?.netz;
    const laufbar = (c) => (typeof netz?.frei === 'function' ? netz.frei(c.x / U, -c.z / U) : true);
    const wert = {
      // Bänke nur, wo die Leute auch hinkommen (Laufnetz der Menschen, sonst säßen sie neben der Bank)
      baenke: (c) => (c.wasser >= 1.5 && c.wasser <= 12 && laufbar(c) ? c.dA + Math.max(0, c.wasser - 3) * 3 : null),
      laternen: (c) => (c.dW <= 2.2 && c.wasser >= 2 && hoehe[c.k] >= pegel + 0.4 ? c.dA * 0.5 + c.dW * 4 : null),
      kuebel: (c) => (hoehe[c.k] >= pegel + 0.4 && (c.dK <= 3 || c.dW <= 1.6) ? Math.min(c.dH, c.dA * 1.5) + Math.min(c.dK, c.dW) * 3 : null),
      baeume: (c) => (!c.aufPlatz && hoehe[c.k] >= pegel + 0.4 && c.wasser >= 6 && c.dW <= 7 && c.dW >= 1 ? c.dA * 0.8 + Math.abs(c.dW - 3.5) * 2 : null),
    };
    for (const art of FOLGE) {
      const def = STUECK[art];
      const anzahl = stueckBis(art, REGELN.arten[art].abschnitte.filter((a) => a.abStufe <= n).length);
      if (!anzahl) continue;
      const liste = kandidat.map((c) => ({ c, w: wert[art](c) })).filter((x) => x.w != null).sort((a, b) => a.w - b.w);
      for (const { c } of liste) {
        if (out.get(art).length >= anzahl) break;
        if (gesetzt.some((g) => Math.hypot(g.x - c.x, g.z - c.z) < g.r + def.r + 0.8 || (g.art === art && Math.hypot(g.x - c.x, g.z - c.z) < def.abstand))) continue;
        if (!frei(c, def.r)) continue;
        let dreh = 0;
        if (art === 'baenke') {
          // Blick aufs Wasser: in 32 Richtungen bis 16 m schauen, nahes Wasser zählt viel mehr (1/d³),
          // so steht die Bank quer zur Kante; Modell schaut nach -z
          let vx = 0, vz = 0;
          for (let k = 0; k < 32; k++) {
            const w = (k / 32) * Math.PI * 2;
            const dx = Math.sin(w), dz = Math.cos(w);
            for (let d = 0.5; d <= 16; d += 0.5) {
              if (L.hoeheBei(c.x + dx * d, c.z + dz * d) < pegel) { const g = 1 / (d * d * d); vx += dx * g; vz += dz * g; break; }
            }
          }
          // auf 15 Grad runden: ordentlich ausgerichtet wie am echten Kai
          const best = Math.hypot(vx, vz) > 0 ? { wert: 0, w: Math.round(Math.atan2(vx, vz) / (Math.PI / 12)) * (Math.PI / 12) } : null;
          if (best) best.dx = Math.sin(best.w), best.dz = Math.cos(best.w);
          if (best && best.wert >= 0) dreh = Math.atan2(-best.dx, -best.dz);
          else if (c.quelle >= 0) {
            const wx = x0 + ((c.quelle % nx) + 0.5) * ZELLE, wz = z0 + (((c.quelle / nx) | 0) + 0.5) * ZELLE;
            dreh = Math.atan2(-(wx - c.x), -(wz - c.z));
          }
        } else if (art === 'laternen') {
          // Lampe zum Weg hin
          let best = null, bd = Infinity;
          for (const s of h.strecken) {
            if (!s.weg) continue;
            const d = abstandStrecke(c.x, c.z, s.ax, s.az, s.bx, s.bz);
            if (d < bd) { bd = d; best = s; }
          }
          if (best) {
            const dx = best.bx - best.ax, dz = best.bz - best.az, l2 = dx * dx + dz * dz || 1;
            const t = Math.max(0, Math.min(1, ((c.x - best.ax) * dx + (c.z - best.az) * dz) / l2));
            dreh = Math.atan2(-(best.ax + t * dx - c.x), -(best.az + t * dz - c.z));
          }
        }
        gesetzt.push({ x: c.x, z: c.z, r: def.r, art });
        out.get(art).push({ x: c.x, y: hoehe[c.k], z: c.z, dreh });
      }
    }
    return out;
  }

  let plaetze = new Map(ARTEN.map((a) => [a, []]));
  let plaetzeStufe = 0;
  let signatur = '';
  // Signatur: Stufe, Region, Stege und Gebäude, die stehen (dann bleiben die Plätze, wo sie sind)
  function sig() {
    const g = (game.buildings?.items ?? []).filter((it) => it.mesh?.parent).map((it) => it.id).join(',');
    return `${stufe()}|${game.landschaft?.region?.id ?? game.landschaft?.region ?? ''}|${game.stege?.gebaut?.()?.sig ?? ''}|${g}|${(game.landschaft?.wege ?? []).length}`;
  }
  function neuSuchen(erzwingen = false) {
    const s = sig();
    if (!erzwingen && s === signatur) return false;
    signatur = s;
    plaetzeStufe = stufe();
    plaetze = sucheplaetze(plaetzeStufe);
    return true;
  }

  // ---------------------------------------------------------------- Aufstellen
  let jahreszeit = null;
  function abschnittVon(art, i) {
    let k = 0;
    for (const [n, a] of REGELN.arten[art].abschnitte.entries()) { k += a.stueck; if (i < k) return n; }
    return 0;
  }
  function aufbauen({ neu = null } = {}) {
    const s = st();
    if (!s) return;
    const geaendert = neuSuchen();
    for (const art of ARTEN) {
      const gebaut = stueckBis(art, abschnitteGebaut(s, art));
      const lagen = plaetze.get(art) ?? [];
      for (let i = 0; i < Math.max(gebaut, lagen.length, 12); i++) {
        const id = `${art}-${i}`;
        let o = stuecke.get(id);
        const l = i < gebaut ? lagen[i] : null;
        if (!l) { if (o) o.visible = false; continue; }
        if (!o) {
          o = BAU[art](i);
          o.name = `deko-${id}`;
          o.userData.art = art;
          o.userData.nr = i;
          stuecke.set(id, o);
          root.add(o);
          if (neu === art) huepfer.push({ o, t: -i * 0.08 });
        }
        o.visible = true;
        o.position.set(l.x, l.y, l.z);
        o.rotation.y = art === 'baeume' ? i * 1.7 : l.dreh;
        if (art === 'baeume') o.userData.wuchs = baumWuchs(s, abschnittVon(art, i));
      }
    }
    faerbe(true);
    wachse();
    if (geaendert || neu) game.people?.netzErneuern?.();
    return geaendert;
  }

  function wachse() {
    for (const o of stuecke.values()) {
      if (o.userData.art !== 'baeume' || huepfer.some((h) => h.o === o)) continue;
      const w = o.userData.wuchs ?? 1;
      o.scale.setScalar(w);
    }
  }

  // Jahreszeit: Laub, Blüten, Tannengrün im Winter
  function faerbe(erzwingen = false) {
    const j = game.landschaft?.jahreszeit ?? 'sommer';
    if (!erzwingen && j === jahreszeit) return;
    jahreszeit = j;
    M.laub.color.set(LAUB[j] ?? LAUB.sommer);
    M.laub2.color.set(LAUB[j] ?? LAUB.sommer).offsetHSL(0.01, 0, j === 'herbst' ? 0.06 : 0.04);
    M.blatt.color.set(j === 'winter' ? FARBE.tanne : FARBE.blatt);
    for (const o of stuecke.values()) {
      o.traverse((c) => {
        if (c.userData.blueten) c.visible = j !== 'winter';
        if (c.userData.krone) c.visible = j !== 'winter';
        if (c.userData.aeste) c.visible = j === 'winter';
      });
    }
  }

  // ---------------------------------------------------------------- Vorschau im Baumenü
  function neueLagen(art) {
    const s = st();
    if (!s) return [];
    neuSuchen();
    const a = angebote(s, ctx()).find((x) => x.art === art);
    if (!a || art === 'anstrich') return [];
    const von = stueckBis(art, abschnitteGebaut(s, art));
    return (plaetze.get(art) ?? []).slice(von, von + a.stueck);
  }
  function rahmen(pkte, extra = 10) {
    if (!pkte.length) return null;
    const xs = pkte.map((p) => p.x), zs = pkte.map((p) => p.z);
    return { x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2,
      breite: Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs), 14) + extra };
  }
  function hafenHaeuser() {
    return (game.buildings?.items ?? []).filter((it) => it.mesh?.parent && game.buildings.anstrichFuer?.(it.id)).map((it) => ({ x: it.mesh.position.x, z: it.mesh.position.z }));
  }
  function ort(art) {
    if (art === 'anstrich') {
      // Nah an das Hafenmeisterhaus (sonst das erste Hafenhaus), damit man die Wände sieht
      const it = (game.buildings?.items ?? []).find((i) => i.id === 'hafenmeister' && i.mesh?.parent)
        ?? (game.buildings?.items ?? []).find((i) => i.mesh?.parent && game.buildings.anstrichFuer?.(i.id));
      if (!it) return rahmen(hafenHaeuser(), 16);
      return { x: it.mesh.position.x, z: it.mesh.position.z, breite: 12, nah: true };
    }
    return rahmen(neueLagen(art));
  }
  function geist(art) {
    if (art === 'anstrich') {
      const f = farbeVon(wahl());
      game.buildings?.anstrich?.(f?.farbe ?? null);
      const g = new THREE.Group();
      g.userData.weg = () => setzeAnstrich();
      return g;
    }
    const g = new THREE.Group();
    neueLagen(art).forEach((l, k) => {
      const i = stueckBis(art, abschnitteGebaut(st(), art)) + k;
      const m = BAU[art](i);
      m.traverse((c) => { if (c.isMesh) { c.material = c.userData.schein ? schein : geistMat; c.castShadow = false; c.renderOrder = 12; } });
      if (art === 'baeume') m.scale.setScalar(0.85);
      m.position.set(l.x, l.y + 0.02, l.z);
      m.rotation.y = art === 'baeume' ? i * 1.7 : l.dreh;
      g.add(m);
      // Kleine Stücke sieht man von oben kaum: eine gelbe Raute schwebt darüber und ein Kreis liegt am Boden
      const raute = new THREE.Mesh(rauteGeo, rauteMat);
      raute.position.set(l.x, l.y + ({ baenke: 2.6, kuebel: 2.6, laternen: 5, baeume: 6 }[art] ?? 3), l.z);
      raute.renderOrder = 13;
      raute.userData.raute = true;
      g.add(raute);
      const kreis = new THREE.Mesh(kreisGeo, kreisMat);
      kreis.position.set(l.x, l.y + 0.08, l.z);
      kreis.renderOrder = 12;
      g.add(kreis);
    });
    return g.children.length ? g : null;
  }
  function setzeAnstrich() {
    const f = farbeVon(st()?.modules?.verschoenern?.anstrich);
    game.buildings?.anstrich?.(f?.farbe ?? null);
  }

  // Bänke als Ziel für die Menschen (render/people.js): sitzen mit Blick aufs Wasser
  function ziele() {
    const s = st();
    if (!s) return [];
    const n = stueckBis('baenke', abschnitteGebaut(s, 'baenke'));
    return (plaetze.get('baenke') ?? []).slice(0, n).map((l, i) => {
      const fx = -Math.sin(l.dreh), fz = -Math.cos(l.dreh);
      return { id: `bank-${i}`, art: 'bank', x: l.x / U, y: -l.z / U, halbBreite: 0, box: null,   // kein Hindernis im Laufnetz
        tuer: { x: (l.x + fx * 0.05) / U, y: -(l.z + fz * 0.05) / U }, blick: Math.atan2(-fz, fx), sitz: { x: l.x, z: l.z } };
    });
  }

  Object.assign(game.verschoenern, {
    ort, geist, ziele,
    /** Gebaute Stücke mit Lage (für Tests und Fotos): [{ art, x, z, dreh }] */
    stuecke: () => [...stuecke.values()].filter((o) => o.visible).map((o) => ({ art: o.userData.art, nr: o.userData.nr, x: o.position.x, z: o.position.z, dreh: o.rotation.y })),
    /** Alle gefundenen Plätze der Stufe (auch ungekaufte), für Tests: { art: [{ x, z }] } */
    plaetze: () => { neuSuchen(); return Object.fromEntries([...plaetze].map(([a, l]) => [a, l.map((p) => ({ x: p.x, z: p.z, dreh: p.dreh }))])); },
    gruppe: root,
    aufbauen: () => aufbauen(),
  });

  // ---------------------------------------------------------------- Ereignisse
  let zeit = 0;
  game.onTick?.((dt) => {
    zeit += dt;
    for (let i = huepfer.length - 1; i >= 0; i--) {
      const h = huepfer[i];
      h.t += dt;
      const k = Math.max(0, Math.min(1, h.t / 0.6));
      const ziel = h.o.userData.art === 'baeume' ? h.o.userData.wuchs ?? 1 : 1;
      h.o.scale.setScalar(ziel * (k < 1 ? 0.15 + 0.85 * k + Math.sin(k * Math.PI) * 0.22 : 1));
      if (h.t >= 0.6) huepfer.splice(i, 1);
    }
    rauteMat.opacity = 0.7 + 0.25 * Math.sin(zeit * 4);
    const nacht = game.landschaft?.licht?.zustand?.nacht ?? 0;
    const an = Math.max(0, Math.min(1, (nacht - 0.15) / 0.5));
    M.glas.emissiveIntensity = 0.1 + an * 1.3;
    schein.opacity = an * 0.3;
    faerbe();
  });

  const spaeter = (neu = null) => setTimeout(() => aufbauen({ neu }), 0);
  game.on('build', (e) => {
    const id = String(e?.id ?? '');
    spaeter(id.startsWith('deko:') && id !== 'deko:anstrich' && id !== 'deko:test' ? id.slice(5) : null);
    if (id === 'deko:anstrich' || id === 'deko:test') setzeAnstrich();
  });
  for (const ev of ['stufe', 'stege', 'region', 'spielstand-geladen', 'ready']) game.on(ev, () => { spaeter(); setTimeout(setzeAnstrich, 0); });
  game.on('sim:change', (e) => { if (e?.reason === 'load' || e?.reason === 'new' || e?.reason === 'undo') { spaeter(); setTimeout(setzeAnstrich, 0); } });
  game.on('verschoenern:neu', () => { spaeter(); setTimeout(setzeAnstrich, 0); });
  game.landschaft?.beiNeubau?.(() => { signatur = ''; spaeter(); });
  // Bäume wachsen über Nacht
  game.on('sim:change', (e) => {
    const s = st();
    if (!s || !e?.events?.some?.((x) => x.type === 'dayStart')) return;
    for (const o of stuecke.values()) if (o.userData.art === 'baeume') o.userData.wuchs = baumWuchs(s, abschnittVon('baeume', o.userData.nr));
    wachse();
  });
  aufbauen();
  setzeAnstrich();
}
