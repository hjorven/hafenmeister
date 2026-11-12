// Gelände als 3D-Netz im Flat-Vector-Stil: flache Dreiecke mit Pastellfarben,
// dazu Molen, Kaimauern, Buhnen und Pflanzen (Kiefern, Laubbäume, Dünengras, Schilf, Felsen).
// Alle wiederholten Dinge sind InstancedMesh, damit es auch auf schwachen Handys flüssig bleibt.
import * as THREE from 'three';
import { punkt, BEREICH, PLAN_M, molen, buhnen, rauschen, hafenAbstand, suedufer, DURCHSTICH } from './gelaende.js';

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

function baueNetz(region, stufe, x0, x1, y0, y1, schritt, loch, absenken, unterGrenze = -0.15) {
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
      T[j * (nx + 1) + i] = p.typ;
    }
  }
  const farben = {};
  for (const [k, v] of Object.entries(region.farben)) farben[k] = new THREE.Color(v);
  const pos = [], col = [];
  const c = new THREE.Color();
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i, b = a + 1, d = a + nx + 1, e = d + 1;
      const ha = H[a], hb = H[b], hd = H[d], he = H[e];
      if (Number.isNaN(ha) || Number.isNaN(hb) || Number.isNaN(hd) || Number.isNaN(he)) continue;
      if (Math.max(ha, hb, hd, he) < unterGrenze) continue;     // ganz unter Wasser: deckt die Wasserfläche ab
      const X = (q) => q * U;
      const verts = [
        [X(x0 + i * schritt), ha, -X(y0 + j * schritt)],
        [X(x0 + (i + 1) * schritt), hb, -X(y0 + j * schritt)],
        [X(x0 + i * schritt), hd, -X(y0 + (j + 1) * schritt)],
        [X(x0 + (i + 1) * schritt), he, -X(y0 + (j + 1) * schritt)],
      ];
      // Diagonale so wählen, dass Kanten an Ufern sauberer werden
      const tris = Math.abs(ha - he) < Math.abs(hb - hd) ? [[0, 1, 3], [0, 3, 2]] : [[0, 1, 2], [1, 3, 2]];
      const idx = [a, b, d, e];
      for (const t of tris) {
        for (const k of t) {
          pos.push(verts[k][0], verts[k][1] - absenken, verts[k][2]);
          const typ = T[idx[k]];
          c.copy(farben[typ === 'wasser' ? 'watt' : typ] || farben.sand);
          // leichte Farbstreuung, damit große Flächen nicht tot wirken
          c.multiplyScalar(0.97 + 0.05 * rauschen(verts[k][0] / 6, verts[k][2] / 6, 77));
          col.push(c.r, c.g, c.b);
        }
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

// ------------------------------------------------------------------ Hilfen für Instanzen

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();

function instanzen(geo, mat, liste, name) {
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, liste.length));
  mesh.name = name;
  mesh.count = liste.length;
  const c = new THREE.Color();
  liste.forEach((it, i) => {
    _e.set(it.kx || 0, it.rot || 0, it.kz || 0);
    _q.setFromEuler(_e);
    _p.set(it.x, it.y, it.z);
    _s.set(it.sx ?? it.s, it.sy ?? it.s, it.sz ?? it.s);
    _m.compose(_p, _q, _s);
    mesh.setMatrixAt(i, _m);
    if (it.farbe) mesh.setColorAt(i, c.set(it.farbe));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}

function verschmelze(geos) {
  // Kleine Eigenbau-Variante von mergeGeometries (ohne Index), damit keine Zusatzdatei nötig ist
  const pos = [], nor = [];
  for (const g0 of geos) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    pos.push(...g.attributes.position.array);
    nor.push(...g.attributes.normal.array);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return out;
}

function kronenKiefer() {
  const a = new THREE.ConeGeometry(1, 1.25, 6); a.translate(0, 1.0, 0);
  const b = new THREE.ConeGeometry(0.72, 1.0, 6); b.translate(0, 1.7, 0);
  return verschmelze([a, b]);
}
function kronenLaub() {
  const g = new THREE.IcosahedronGeometry(1, 0);
  g.translate(0, 1.55, 0);
  return g.toNonIndexed();
}
function stamm() {
  const g = new THREE.CylinderGeometry(0.12, 0.16, 1, 4, 1, true);
  g.translate(0, 0.5, 0);
  return g;
}

// ------------------------------------------------------------------ Pflanzen und Felsen setzen

function setzePflanzen(region, stufe, q, gruppe, schatten) {
  const pf = region.pflanzen;
  const rnd = zufall(4711 + stufe);
  const kiefern = [], laub = [], staemme = [], gras = [], schilf = [], felsen = [];
  const menge = q.pflanzen;
  const baumFarbe = () => region.baumfarben[Math.floor(rnd() * region.baumfarben.length)];
  const laubFarbe = () => region.laubfarben[Math.floor(rnd() * region.laubfarben.length)];

  const baum = (px, py, p, gross = 1) => {
    const x = px * U, z = -py * U, s = (2.2 + rnd() * 1.6) * gross;
    const y = p.h - 0.1;
    if (rnd() < pf.kiefer) {
      kiefern.push({ x, y, z, s, sy: s * (1.1 + rnd() * 0.5), rot: rnd() * 6.3, farbe: baumFarbe() });
      staemme.push({ x, y, z, s: s * 0.9, sy: s * 0.9, farbe: '#8a6a54' });
      return;
    }
    if (pf.pappel && rnd() < pf.pappel) {
      // Pappel: schmal und hoch
      laub.push({ x, y: y + s * 0.4, z, s: s * 0.45, sy: s * 1.6, rot: rnd() * 6.3, farbe: laubFarbe() });
      staemme.push({ x, y, z, s: s * 0.7, sy: s * 1.0, farbe: '#7c6656' });
      return;
    }
    const birke = rnd() < (pf.birke || 0);
    // Windschief: Krone vom Westwind nach Osten gedrückt
    const schief = pf.windschief ? { kz: -0.35, sy: s * 0.6 } : {};
    laub.push({ x, y, z, s: s * 0.95, sy: s * (0.85 + rnd() * 0.3), rot: pf.windschief ? 0 : rnd() * 6.3, farbe: laubFarbe(), ...schief });
    staemme.push({ x, y, z, s: s * 0.9, sy: s * 1.2, farbe: birke ? '#efece4' : '#8a6a54', ...(pf.windschief ? { kz: -0.25 } : {}) });
  };

  // Bäume: jitter-Raster auf dem Festland und (in Schweden) auf den Schären
  const zelle = 7 / Math.sqrt(menge * pf.dichte + 0.01);
  const baumBereich = (x0, x1, y0, y1, anteil) => {
    for (let gy = y0; gy < y1; gy += zelle) {
      for (let gx = x0; gx < x1; gx += zelle) {
        const px = gx + rnd() * zelle, py = gy + rnd() * zelle;
        const wald = rauschen(px / 70, py / 70, 41);
        if (rnd() > anteil * (wald > 0.5 ? 0.9 : 0.12)) continue;
        if (hafenAbstand(px, py) < 6) continue;
        const p = punkt(px, py, stufe, region);
        if (p.h < 0.3) continue;
        if (p.typ === 'gras' || (p.typ === 'fels' && rnd() < 0.3) || (p.typ === 'duenengras' && rnd() < 0.08)) baum(px, py, p);
      }
    }
  };
  baumBereich(BEREICH.x0, BEREICH.x1, BEREICH.y0, BEREICH.y1, 1);
  // Äußerer Ring nur dünn, damit der Horizont nicht leer ist
  const zelleAlt = zelle;
  const aussen = [[-1500, BEREICH.x0, -1500, 470], [BEREICH.x1, 1500, -1500, 470], [BEREICH.x0, BEREICH.x1, -1500, BEREICH.y0]];
  for (const [x0, x1, y0, y1] of aussen) {
    const weit = zelleAlt * (3.2 / Math.max(0.3, menge));
    for (let gy = y0; gy < y1; gy += weit) {
      for (let gx = x0; gx < x1; gx += weit) {
        const px = gx + rnd() * weit, py = gy + rnd() * weit;
        if (rauschen(px / 90, py / 90, 41) < 0.5 || rnd() > 0.8 * pf.dichte) continue;
        const p = punkt(px, py, stufe, region);
        if (p.h > 0.3 && (p.typ === 'gras' || p.typ === 'fels')) baum(px, py, p, 1.1);
      }
    }
  }

  // Dünengras, Salzwiese und Strandhafer als kleine Büschel
  const nGras = Math.round(1400 * menge * pf.duenengras);
  for (let k = 0; k < nGras; k++) {
    const px = BEREICH.x0 + rnd() * (BEREICH.x1 - BEREICH.x0);
    const py = 150 + rnd() * 100;
    const p = punkt(px, py, stufe, region);
    if (!(p.typ === 'duene' || p.typ === 'duenengras' || p.typ === 'salzwiese') || p.h < 0.15) continue;
    const s = 0.5 + rnd() * 0.5;
    gras.push({ x: px * U, y: p.h - 0.05, z: -py * U, s, sy: s * (1.2 + rnd()), rot: rnd() * 6.3, farbe: rnd() < 0.5 ? '#d2dca6' : '#c4d49a' });
  }

  // Schilf am Ufer des Binnensees, in Gruppen
  const nSchilf = Math.round(1800 * menge * pf.schilf);
  const hafenFrei = (px) => !(stufe >= 2 && px > -170 && px < 225) && !(stufe >= 1 && px > -125 && px < -80);
  for (let k = 0; k < nSchilf; k++) {
    const px = BEREICH.x0 + rnd() * (BEREICH.x1 - BEREICH.x0);
    const nord = rnd() < 0.5;
    const py = nord ? 186 - rnd() * 14 : suedufer(px) + rnd() * 14;
    if (rauschen(px / 14, py / 14, 55) < 0.48) continue;
    if (!nord && !hafenFrei(px)) continue;
    if (px > DURCHSTICH[0] - 12 && px < DURCHSTICH[1] + 12) continue;
    const p = punkt(px, py, stufe, region);
    if (p.see > 0.5 || p.h > 0.25 || p.h < -0.7) continue;
    const s = 0.35 + rnd() * 0.25;
    schilf.push({ x: px * U, y: Math.min(0, p.h), z: -py * U, s, sy: s * (3.4 + rnd() * 1.6), rot: rnd() * 6.3, kx: (rnd() - 0.5) * 0.2, farbe: rnd() < 0.3 ? '#c8bc78' : rnd() < 0.5 ? '#8eb46e' : '#a2c07a' });
  }

  // Felsen und Findlinge
  const nFels = Math.round(500 * menge * pf.findlinge);
  for (let k = 0; k < nFels; k++) {
    const px = BEREICH.x0 + rnd() * (BEREICH.x1 - BEREICH.x0);
    const py = BEREICH.y0 + rnd() * (300 - BEREICH.y0);
    const p = punkt(px, py, stufe, region);
    const amUfer = p.h > -0.6 && p.h < 0.8;
    if (!(p.typ === 'fels' || (amUfer && rnd() < 0.25))) continue;
    if (hafenAbstand(px, py) < 0 && stufe >= 2) continue;
    if (p.typ === 'pflaster' || p.typ === 'mole') continue;
    const s = 0.4 + rnd() * (p.typ === 'fels' ? 1.8 : 0.8);
    felsen.push({ x: px * U, y: p.h - s * 0.25, z: -py * U, s, sy: s * (0.5 + rnd() * 0.3), rot: rnd() * 6.3, kx: rnd() * 0.4, farbe: rnd() < 0.5 ? region.farben.fels : '#b0bcc4' });
  }

  const flach = { flatShading: true };
  const mKrone = new THREE.MeshLambertMaterial(flach);
  const mStamm = new THREE.MeshLambertMaterial(flach);
  const teile = [
    instanzen(kronenKiefer(), mKrone, kiefern, 'kiefern'),
    instanzen(kronenLaub(), mKrone, laub, 'laubbaeume'),
    instanzen(stamm(), mStamm, staemme, 'staemme'),
    instanzen(new THREE.ConeGeometry(0.5, 1, 4).translate(0, 0.5, 0), new THREE.MeshLambertMaterial(flach), gras, 'duenengras'),
    instanzen(new THREE.ConeGeometry(0.12, 1, 3).translate(0, 0.5, 0), new THREE.MeshLambertMaterial(flach), schilf, 'schilf'),
    instanzen(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshLambertMaterial(flach), felsen, 'felsen'),
  ];
  for (const t of teile) {
    t.castShadow = schatten && (t.name !== 'schilf' && t.name !== 'duenengras');
    t.receiveShadow = false;
    gruppe.add(t);
  }
  return { baeume: [...kiefern, ...laub], felsen };
}

// ------------------------------------------------------------------ Molen, Kaimauern, Buhnen

function baueMolen(region, stufe, gruppe, schatten) {
  const plus = region.gelaende.landPlus || 0;
  const rnd = zufall(99 + stufe);
  const steine = [];
  const krone = [];
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
      gruppe.add(mk);
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
      gruppe.add(gm);
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
    gruppe.add(km);
    const kw = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.42, w * 0.42, 0.1, 12), mWeg);
    kw.position.set(kopf.x, 1.42 + plus, kopf.z);
    krone.push(kw);
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2, r = w * (0.8 + rnd() * 0.15), s = 0.8 + rnd() * 0.6;
      steine.push({ x: kopf.x + Math.cos(a) * r, y: 0.2 + plus + rnd() * 0.4, z: kopf.z + Math.sin(a) * r, s, sy: s * 0.7, rot: rnd() * 6.3, farbe: region.farben.steinschuettung });
    }
  }
  for (const k of krone) gruppe.add(k);
  if (steine.length) {
    const st = instanzen(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ flatShading: true }), steine, 'molensteine');
    st.castShadow = schatten;
    gruppe.add(st);
  }
}

function baueKaimauern(region, stufe, gruppe, schatten) {
  const plus = region.gelaende.landPlus || 0;
  // Senkrechte Kanten, wo das Gelände sonst schräg ins Wasser liefe
  const mauern = [];
  if (stufe >= 3) {
    mauern.push({ x0: -150, x1: 202, y: 6, nach: 1, hoehe: 1.2 });                                   // Promenade am See
    mauern.push({ xKante: DURCHSTICH[0], y0: 186, y1: 230, nach: 1, hoehe: 1.0 });                    // Durchstich West
    mauern.push({ xKante: DURCHSTICH[1], y0: 186, y1: 230, nach: -1, hoehe: 1.0 });                   // Durchstich Ost
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
  if (!pfaehle.length) return;
  const geo = new THREE.CylinderGeometry(0.5, 0.5, 1, 5).translate(0, 0.5, 0);
  gruppe.add(instanzen(geo, new THREE.MeshLambertMaterial({ flatShading: true }), pfaehle, 'buhnen'));
}

// ------------------------------------------------------------------ Schatten ohne Schattenkarte

function baueFlachSchatten(liste) {
  const geo = new THREE.CircleGeometry(1, 7);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0.5, 0, 0);   // Schatten beginnt am Stamm und läuft in eine Richtung
  const mat = new THREE.MeshBasicMaterial({ color: '#1f3a4a', transparent: true, opacity: 0.16, depthWrite: false });
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, liste.length));
  mesh.count = liste.length;
  mesh.name = 'baumschatten';
  mesh.renderOrder = 1;
  mesh.frustumCulled = false;
  mesh.userData.aktualisiere = (richtung, laenge, nacht) => {
    const ang = Math.atan2(-richtung.y, richtung.x);
    liste.forEach((b, i) => {
      const h = (b.sy || b.s) * 2;
      _e.set(0, ang, 0); _q.setFromEuler(_e);
      _p.set(b.x, b.y + 0.15, b.z);
      _s.set(Math.max(b.s * 0.8, h * laenge * 0.55), 1, b.s * 0.75);
      _m.compose(_p, _q, _s);
      mesh.setMatrixAt(i, _m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mat.opacity = 0.16 * (1 - 0.75 * nacht);
  };
  return mesh;
}

// ------------------------------------------------------------------ Gesamtes Gelände

/**
 * Baut das Gelände für eine Stufe und Region.
 * @returns {{gruppe: THREE.Group, aktualisiereSchatten: Function, entsorge: Function}}
 */
export function baueGelaende(region, stufe, qualitaet, { tiefsterPegel = 0 } = {}) {
  const q = QUALITAET[qualitaet] || QUALITAET.mittel;
  const gruppe = new THREE.Group();
  gruppe.name = 'gelaende';

  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const innen = new THREE.Mesh(baueNetz(region, stufe, BEREICH.x0, BEREICH.x1, BEREICH.y0, BEREICH.y1, q.raster / U, null, 0, -0.15 + Math.min(0, tiefsterPegel)), mat);
  innen.name = 'gelaende-innen';
  innen.receiveShadow = q.schatten;
  gruppe.add(innen);
  const s2 = q.aussen / U;
  const aussen = new THREE.Mesh(baueNetz(region, stufe, -1600, 1600, -1600, 470, s2, BEREICH, 0.05, -0.15 + Math.min(0, tiefsterPegel)), mat);
  aussen.name = 'gelaende-aussen';
  gruppe.add(aussen);

  baueMolen(region, stufe, gruppe, q.schatten);
  baueKaimauern(region, stufe, gruppe, q.schatten);
  baueBuhnen(region, stufe, gruppe);
  const { baeume } = setzePflanzen(region, stufe, q, gruppe, q.schatten);

  let flach = null;
  if (!q.schatten) {
    flach = baueFlachSchatten(baeume);
    gruppe.add(flach);
  }

  return {
    gruppe,
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
