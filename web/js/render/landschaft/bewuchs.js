// Bewuchs und Bauten an Land: Wälder, Knicks, Einzelbäume, Dünengras, Heide, Schilf, Findlinge,
// dazu das Dorf (Häuser, Kirche, Windmühle) und Einzelhöfe. Wo was steht, sagt vielfalt.js.
//
// Leistung: Alles Wiederholte wird beim Bau zu wenigen festen Netzen gebacken (wie in terrain.js),
// kein InstancedMesh. Laub und Felder färben sich mit der Jahreszeit um, ohne Neubau:
// nur die Farbwerte im Puffer werden neu geschrieben.
import * as THREE from 'three';
import { punkt, BEREICH, PLAN_M, hafenAbstand, suedufer, seeNord } from './gelaende.js';
import { festePunkte } from './karte.js';
import { verschmelze } from './terrain.js';
import { aktuellesBild, feldZeile, knickAn, dorfPlan, hoefe, freiAbstand, soelle, zufallAus, JAHRESZEIT_FARBEN } from './vielfalt.js';

const U = PLAN_M;
const FELDARTEN = new Set(['raps', 'korn', 'acker', 'weide', 'wiese', 'gras']);

// ------------------------------------------------------------------ Backen

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();

/**
 * Backt viele Kopien einer Geometrie zu einem Netz mit Farbe je Ecke.
 * liste: [{ x, y, z, s, sx?, sy?, sz?, rot?, kx?, kz?, farbe }]
 * Das Netz merkt sich die Liste, damit faerbeNeu() die Farben später tauschen kann.
 */
export function backe(geo, mat, liste, name) {
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
  mesh.userData.liste = liste;
  mesh.userData.ecken = nv;
  return mesh;
}

/**
 * Wie backe(), aber in Kacheln (Weltmeter) geteilt: eine Gruppe mit einem Netz je Kachel.
 * So wirft Three.js alles außerhalb des Bildes weg (Frustum Culling) und das Handy zeichnet
 * in der Startansicht nur die Bäume, die man sieht. Kleine Listen bleiben ein Netz.
 */
export function backeKacheln(machGeo, mat, liste, name, kachel = 180) {
  if (liste.length < 400) return backe(machGeo(), mat, liste, name);
  const toepfe = new Map();
  for (const it of liste) {
    const key = `${Math.floor(it.x / kachel)},${Math.floor(it.z / kachel)}`;
    if (!toepfe.has(key)) toepfe.set(key, []);
    toepfe.get(key).push(it);
  }
  const gruppe = new THREE.Group();
  gruppe.name = name;
  for (const teil of toepfe.values()) gruppe.add(backe(machGeo(), mat, teil, name));
  gruppe.userData.anzahl = liste.length;
  gruppe.userData.kacheln = true;
  return gruppe;
}

/** Schreibt die Farben eines gebackenen Netzes (oder aller Kacheln) neu. farbeVon(item) -> sRGB-Hex. */
function faerbeNeu(mesh, farbeVon) {
  if (mesh.userData.kacheln) { for (const k of mesh.children) faerbeNeu(k, farbeVon); return; }
  const { liste, ecken } = mesh.userData;
  const col = mesh.geometry.attributes.color;
  const c = new THREE.Color();
  liste.forEach((it, k) => {
    c.set(farbeVon(it));
    for (let i = 0; i < ecken; i++) col.setXYZ(k * ecken + i, c.r, c.g, c.b);
  });
  col.needsUpdate = true;
}

// ------------------------------------------------------------------ Formen

function kronenKiefer() {
  const a = new THREE.ConeGeometry(1, 1.25, 6, 1, true); a.translate(0, 1.0, 0);
  const b = new THREE.ConeGeometry(0.72, 1.0, 6, 1, true); b.translate(0, 1.7, 0);
  return verschmelze([a, b]);
}
function kronenLaub() {
  const g = new THREE.IcosahedronGeometry(1, 0);
  g.translate(0, 1.55, 0);
  return verschmelze([g]);
}
function busch() {
  // Knick-Busch: flacher Klumpen, 8 Dreiecke
  const g = new THREE.OctahedronGeometry(1, 0);
  g.translate(0, 0.6, 0);
  return verschmelze([g]);
}
function stamm() {
  const g = new THREE.CylinderGeometry(0.12, 0.16, 1, 3, 1, true);
  g.translate(0, 0.5, 0);
  return verschmelze([g]);
}
const stein = () => verschmelze([new THREE.DodecahedronGeometry(1, 0)]);

/** Würfel mit Boden bei y = 0 (Wände). */
function wandKoerper() {
  const g = new THREE.BoxGeometry(1, 1, 1);
  g.translate(0, 0.5, 0);
  return verschmelze([g]);
}

/** Satteldach: Dreiecksprisma, First entlang z, Traufe bei y = 0, First bei y = 1. */
function satteldach() {
  const v = [
    -0.5, 0, -0.5, 0.5, 0, -0.5, 0, 1, -0.5,
    -0.5, 0, 0.5, 0.5, 0, 0.5, 0, 1, 0.5,
  ];
  const i = [
    0, 2, 1, 3, 4, 5,          // Giebel
    0, 3, 5, 0, 5, 2,          // Dachfläche West
    1, 2, 5, 1, 5, 4,          // Dachfläche Ost
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setIndex(i);
  return verschmelze([g]);
}

/** Pyramide (Turmspitze, Mühlenkappe), Grundfläche 1 x 1. */
function pyramide() {
  const g = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1, true, Math.PI / 4);
  g.translate(0, 0.5, 0);
  return verschmelze([g]);
}

// ------------------------------------------------------------------ Farben

const HAUS = {
  reet: { wand: ['#f2ede2', '#ece4d4'], dach: ['#8f8068', '#9a8a70', '#857660'], dachHoehe: 1.05 },
  backstein: { wand: ['#c0715a', '#b56650', '#c97e62'], dach: ['#5d6570', '#c0614a', '#6a6f78'], dachHoehe: 0.75 },
  weiss: { wand: ['#f6f3ec', '#efe9dc'], dach: ['#c25a44', '#b8523e', '#d06a50'], dachHoehe: 0.75 },
  scheune: { wand: ['#a8604c', '#8f6a52', '#b9a58a'], dach: ['#6c6a68', '#7a7064'], dachHoehe: 0.6 },
};

/** Laubfarben je Baumart und Jahreszeit. */
const LAUB_JAHR = {
  herbst: { buche: ['#d99a4e', '#c9823e', '#e2b05a'], birke: ['#e8cc5c', '#efd56a'], eiche: ['#b9944e', '#a8884a'], knick: ['#c99a52', '#b8a050', '#d4a85a'] },
  winter: { buche: ['#b4a08c'], birke: ['#c4b8a4'], eiche: ['#a8957f'], knick: ['#a99886', '#9d8e7e'] },
};

// ------------------------------------------------------------------ Bewuchs setzen

/**
 * Setzt Pflanzen, Dorf und Höfe für Stufe und Revier und hängt sie an die Gruppe.
 * @returns {{ baeume: object[], faerbe: (jahreszeit: string) => void, aktualisiere: (dt: number) => void }}
 */
export function setzeBewuchs(region, stufe, q, gruppe, schatten) {
  const pf = region.pflanzen;
  const bild = aktuellesBild();
  const rnd = zufallAus(4711 + stufe * 31 + bild.seed);
  const kiefern = [], laub = [], staemme = [], buesche = [], gras = [], heide = [], schilf = [], felsen = [];
  const menge = q.pflanzen;
  const wahl = (liste) => liste[Math.floor(rnd() * liste.length)];
  const nordsee = !!region.gelaende.deich;

  // fern: weit draußen ohne Stamm und ohne flachen Schatten (sieht man dort nicht, spart Dreiecke)
  const baum = (px, py, p, { gross = 1, kiefer = pf.kiefer, fern = false } = {}) => {
    const x = px * U, z = -py * U, s = (2.2 + rnd() * 1.6) * gross;
    const y = p.h - 0.1;
    const st = fern ? [] : staemme;
    if (rnd() < kiefer) {
      kiefern.push({ x, y, z, s, sy: s * (1.1 + rnd() * 0.5), rot: rnd() * 6.3, farbe: wahl(region.baumfarben), fern });
      st.push({ x, y, z, s: s * 0.9, sy: s * 0.9, farbe: '#8a6a54' });
      return;
    }
    if (pf.pappel && rnd() < pf.pappel) {
      laub.push({ x, y: y + s * 0.4, z, s: s * 0.45, sy: s * 1.6, rot: rnd() * 6.3, farbe: wahl(region.laubfarben), art: 'eiche', fern });
      st.push({ x, y, z, s: s * 0.7, sy: s * 1.0, farbe: '#7c6656' });
      return;
    }
    const birke = rnd() < (pf.birke || 0);
    const schief = pf.windschief ? { kz: -0.35, sy: s * 0.6 } : {};
    laub.push({ x, y, z, s: s * 0.95, sy: s * (0.85 + rnd() * 0.3), rot: pf.windschief ? 0 : rnd() * 6.3, farbe: wahl(region.laubfarben), art: birke ? 'birke' : 'buche', fern, ...schief });
    st.push({ x, y, z, s: s * 0.9, sy: s * 1.2, farbe: birke ? '#efece4' : '#8a6a54', ...(pf.windschief ? { kz: -0.25 } : {}) });
  };

  // ---- Bäume: dicht im Wald, vereinzelt auf Wiesen und Weiden, nie auf Feldern, Wegen, Hafenflächen
  const zelle = 6.8 / Math.sqrt(menge * pf.dichte + 0.01);
  const baumBereich = (x0, x1, y0, y1, weite, gross, fern = false) => {
    for (let gy = y0; gy < y1; gy += weite) {
      for (let gx = x0; gx < x1; gx += weite) {
        const px = gx + rnd() * weite, py = gy + rnd() * weite;
        if (hafenAbstand(px, py) < 6 || freiAbstand(px, py, stufe) < 3) continue;
        const p = punkt(px, py, stufe, region);
        if (p.h < 0.3) continue;
        let chance = 0;
        if (p.typ === 'waldboden') chance = 0.92;
        else if (p.typ === 'gras') chance = 0.05;
        else if (p.typ === 'weide' || p.typ === 'wiese') chance = 0.025;
        else if (p.typ === 'dorf') chance = 0.025;
        else if (p.typ === 'duenengras') chance = 0.03;
        if (rnd() > chance) continue;
        const nahSee = py > -30 || p.typ === 'waldboden' && py > 150;
        baum(px, py, p, { gross, fern, kiefer: nahSee ? Math.max(pf.kiefer, bild.wald.kiefer + 0.2) : (pf.kiefer ? bild.wald.kiefer : 0) });
      }
    }
  };
  baumBereich(BEREICH.x0, BEREICH.x1, BEREICH.y0, BEREICH.y1, zelle, 1);
  // Äußerer Ring dünner, damit der Horizont nicht leer ist
  const weit = zelle * (2.4 / Math.max(0.3, menge));
  for (const [x0, x1, y0, y1] of [[-1500, BEREICH.x0, -1500, 470], [BEREICH.x1, 1500, -1500, 470], [BEREICH.x0, BEREICH.x1, -1500, BEREICH.y0]]) {
    baumBereich(x0, x1, y0, y1, weit, 1.15, true);
  }

  // ---- Knicks: Wallhecken an den Feldgrenzen, Büsche mit einzelnen Überhältern (Eichen)
  if (pf.knicks) {
    const f = bild.feld, c = Math.cos(f.dreh), s = Math.sin(f.dreh);
    const abstand = 3.2 / Math.sqrt(Math.max(0.35, menge));
    const passt = (px, py) => {
      if (px < BEREICH.x0 || px > BEREICH.x1 || py < BEREICH.y0 || py > 40) return null;
      if (hafenAbstand(px, py) < 10 || freiAbstand(px, py, stufe) < 4) return null;
      const p = punkt(px, py, stufe, region);
      return p.h >= 0.3 && FELDARTEN.has(p.typ) ? p : null;
    };
    const welt = (a, b) => [a * c - b * s, a * s + b * c];
    for (let zeile = -30; zeile <= 30; zeile++) {
      const { versatz, laenge } = feldZeile(zeile);
      const b0 = zeile * f.breite;
      for (let spalte = -30; spalte <= 30; spalte++) {
        const a0 = spalte * laenge - versatz;
        if (Math.abs(a0) > 760) continue;
        // Längsknick am unteren Rand des Feldes (Grenze zur Reihe darunter)
        if (knickAn(zeile, spalte, false) && rnd() < pf.knicks) {
          for (let t = rnd() * abstand; t < laenge; t += abstand) {
            const [px, py] = welt(a0 + t, b0 + 0.4);
            const p = passt(px, py);
            if (p) setzeKnick(px, py, p);
          }
        }
        // Querknick am Anfang des Feldes
        if (knickAn(zeile, spalte, true) && rnd() < pf.knicks) {
          for (let t = rnd() * abstand; t < f.breite; t += abstand) {
            const [px, py] = welt(a0 + 0.4, b0 + t);
            const p = passt(px, py);
            if (p) setzeKnick(px, py, p);
          }
        }
      }
    }
  }
  function setzeKnick(px, py, p) {
    const x = px * U, z = -py * U;
    if (rnd() < 0.07 && !nordsee) {
      // Überhälter: einzelne große Eiche im Knick
      const s = 3 + rnd() * 1.4;
      laub.push({ x, y: p.h - 0.1, z, s, sy: s * (0.9 + rnd() * 0.2), rot: rnd() * 6.3, farbe: wahl(['#6aa86e', '#78b878']), art: 'eiche' });
      staemme.push({ x, y: p.h - 0.1, z, s: s * 0.9, sy: s * 1.2, farbe: '#7a6250' });
      return;
    }
    const s = 1.1 + rnd() * 0.7;
    buesche.push({ x: x + (rnd() - 0.5), y: p.h - 0.15, z: z + (rnd() - 0.5), s, sy: s * (0.8 + rnd() * 0.5), rot: rnd() * 6.3, farbe: wahl(['#6f9f68', '#7aa86c', '#86b072', '#6a9862']), art: 'knick' });
  }

  // ---- Dünengras, Salzwiese, Heide
  const nGras = Math.round(1400 * menge * pf.duenengras);
  for (let k = 0; k < nGras; k++) {
    const px = BEREICH.x0 + rnd() * (BEREICH.x1 - BEREICH.x0);
    const py = 150 + rnd() * 100;
    const p = punkt(px, py, stufe, region);
    if (!(p.typ === 'duene' || p.typ === 'duenengras' || p.typ === 'salzwiese') || p.h < 0.15) continue;
    const s = 0.5 + rnd() * 0.5;
    gras.push({ x: px * U, y: p.h - 0.05, z: -py * U, s, sy: s * (1.2 + rnd()), rot: rnd() * 6.3, farbe: rnd() < 0.5 ? '#d2dca6' : '#c4d49a' });
  }
  // Heide: niedrige Polster mit Besenheide, auf Nehrung und an der Küste
  const nHeide = Math.round(900 * menge);
  for (let k = 0; k < nHeide; k++) {
    const px = BEREICH.x0 + rnd() * (BEREICH.x1 - BEREICH.x0);
    const py = BEREICH.y0 + rnd() * (300 - BEREICH.y0);
    const p = punkt(px, py, stufe, region);
    if (p.typ !== 'heide' || p.h < 0.2) continue;
    const s = 0.6 + rnd() * 0.5;
    heide.push({ x: px * U, y: p.h - 0.1, z: -py * U, s, sy: s * 0.45, rot: rnd() * 6.3, farbe: wahl(['#a98aa8', '#b897b2', '#8f8a6a', '#9c7f9a']), art: 'heide' });
  }

  // ---- Schilf am Binnensee und an den Söllen
  const nSchilf = Math.round(1800 * menge * pf.schilf);
  const eng = festePunkte(stufe).engpass;
  const hafenFrei = (px) => !(stufe >= 2 && px > -170 && px < 225) && !(stufe >= 1 && px > -125 && px < -80);
  for (let k = 0; k < nSchilf; k++) {
    const px = BEREICH.x0 + rnd() * (BEREICH.x1 - BEREICH.x0);
    const nord = rnd() < 0.5;
    const py = nord ? seeNord(px) - rnd() * 14 : suedufer(px) + rnd() * 14;
    if (rauschenSchilf(px, py) < 0.48) continue;
    if (!nord && !hafenFrei(px)) continue;
    if (px > eng.x0 - 12 && px < eng.x1 + 12) continue;   // Engpass frei lassen (Grundform)
    const p = punkt(px, py, stufe, region);
    if (p.see > 0.5 || p.h > 0.25 || p.h < -0.7) continue;
    schilf.push(schilfHalm(px, py, p));
  }
  for (const so of soelle()) {
    const n = Math.round(40 * menge * pf.schilf);
    for (let k = 0; k < n; k++) {
      const w = rnd() * Math.PI * 2, r = so.r + (rnd() - 0.3) * 4;
      const px = so.px + Math.cos(w) * r, py = so.py + Math.sin(w) * r;
      const p = punkt(px, py, stufe, region);
      if (p.typ !== 'schilfrand' && !(p.typ === 'wasser' && p.h > -0.7)) continue;
      schilf.push(schilfHalm(px, py, p));
    }
  }
  function schilfHalm(px, py, p) {
    const s = 0.35 + rnd() * 0.25;
    return { x: px * U, y: Math.min(0, p.h), z: -py * U, s, sy: s * (3.4 + rnd() * 1.6), rot: rnd() * 6.3, kx: (rnd() - 0.5) * 0.2, farbe: rnd() < 0.3 ? '#c8bc78' : rnd() < 0.5 ? '#8eb46e' : '#a2c07a' };
  }

  // ---- Findlinge: am Ufer, am Fuß der Steilküste und einzeln auf Feldrainen
  const nFels = Math.round(500 * menge * pf.findlinge);
  for (let k = 0; k < nFels; k++) {
    const px = BEREICH.x0 + rnd() * (BEREICH.x1 - BEREICH.x0);
    const py = BEREICH.y0 + rnd() * (300 - BEREICH.y0);
    const p = punkt(px, py, stufe, region);
    const amUfer = p.h > -0.6 && p.h < 0.8 && p.typ !== 'pflaster' && p.typ !== 'mole' && p.typ !== 'steinschuettung';
    const kliff = p.typ === 'kliff';
    if (!((amUfer && rnd() < 0.25) || (kliff && rnd() < 0.5) || (p.typ === 'gras' && rnd() < 0.02))) continue;
    if (hafenAbstand(px, py) < 0 && stufe >= 2) continue;
    if (freiAbstand(px, py, stufe) < 3) continue;
    const s = 0.4 + rnd() * (kliff ? 1.4 : 0.8);
    felsen.push({ x: px * U, y: p.h - s * 0.25, z: -py * U, s, sy: s * (0.5 + rnd() * 0.3), rot: rnd() * 6.3, kx: rnd() * 0.4, farbe: rnd() < 0.5 ? region.farben.fels : '#b0bcc4' });
  }

  // ---- Dorf und Höfe
  const waende = [], daecher = [], spitzen = [];
  let fluegel = null;
  const plan = pf.dorf ? dorfPlan() : null;
  const steht = (px, py, rx, ry, dreh) => {
    // Alle vier Ecken und die Mitte auf Land, nicht auf Wegen, Hafen- oder Bauflächen
    const c = Math.cos(dreh), s = Math.sin(dreh);
    let min = Infinity, max = -Infinity;
    for (const [u, v] of [[0, 0], [-rx, -ry], [rx, -ry], [-rx, ry], [rx, ry]]) {
      const qx = px + u * c + v * s, qy = py - u * s + v * c;
      if (hafenAbstand(qx, qy) < 4 || freiAbstand(qx, qy, stufe) < 2) return null;
      const p = punkt(qx, qy, stufe, region);
      if (p.h < 0.4 || p.typ === 'feldweg' || p.typ === 'weg' || p.typ === 'wasser' || p.typ === 'sand' || p.typ === 'kliff') return null;
      min = Math.min(min, p.h); max = Math.max(max, p.h);
    }
    if (max - min > 2.2) return null;
    return { min, max };
  };
  const belegt = [];   // [px, py, r] schon gestellter Häuser (Planeinheiten)
  const frei = (px, py, r) => belegt.every(([x, y, rr]) => Math.hypot(px - x, py - y) > r + rr + 1.5);
  const haus = (px, py, dreh, art, breite, laenge, wandHoehe = 3.2) => {
    const bx = breite * 0.5, by = laenge * 0.5;
    const r = Math.hypot(bx, by) / U;
    if (!frei(px, py, r)) return false;
    const lage = steht(px, py, bx / U, by / U, dreh);
    if (!lage) return false;
    const st = HAUS[art];
    const x = px * U, z = -py * U, y = lage.min - 0.3;
    const hw = wandHoehe + (lage.max - lage.min) + 0.3;
    belegt.push([px, py, r]);
    waende.push({ x, y, z, s: 1, sx: breite, sy: hw, sz: laenge, rot: dreh, farbe: wahl(st.wand) });
    daecher.push({ x, y: y + hw - 0.05, z, s: 1, sx: breite * 1.12, sy: breite * 0.5 * st.dachHoehe + (art === 'reet' ? 0.6 : 0), sz: laenge * 1.04, rot: dreh, farbe: wahl(st.dach) });
    return true;
  };
  if (plan) {
    // Backsteinkirche mit Turm
    const k = plan.kirche;
    const kx = k.px, ky = k.py;
    if (steht(kx, ky, 7, 14, k.dreh) && frei(kx, ky, 15)) {
      belegt.push([kx, ky, 15]);
      const p = punkt(kx, ky, stufe, region);
      const x = kx * U, z = -ky * U, y = p.h - 0.3;
      waende.push({ x, y, z, s: 1, sx: 7, sy: 5.5, sz: 13, rot: k.dreh, farbe: '#b8644e' });
      daecher.push({ x, y: y + 5.45, z, s: 1, sx: 7.6, sy: 3.6, sz: 13.4, rot: k.dreh, farbe: '#5f6670' });
      // Turm am Westende
      const tx = x - Math.sin(k.dreh) * 8, tz = z - Math.cos(k.dreh) * 8;
      waende.push({ x: tx, y, z: tz, s: 1, sx: 3.8, sy: 11, sz: 3.8, rot: k.dreh, farbe: '#ad5c48' });
      spitzen.push({ x: tx, y: y + 10.95, z: tz, s: 1, sx: 4, sy: 5.5, sz: 4, rot: k.dreh, farbe: '#5d7d76' });
    }
    // Galerieholländer-Windmühle am Dorfrand, die Flügel drehen sich
    const m = plan.muehle;
    if (!nordsee || true) {
      const lage = frei(m.px, m.py, 7) ? steht(m.px, m.py, 5, 5, 0) : null;
      if (lage) {
        belegt.push([m.px, m.py, 7]);
        const x = m.px * U, z = -m.py * U, y = lage.min - 0.2;
        waende.push({ x, y, z, s: 1, sx: 5.2, sy: 3, sz: 5.2, farbe: '#b8644e' });                       // Sockel
        spitzen.push({ x, y: y + 2.95, z, s: 1, sx: 4.8, sy: 9, sz: 4.8, rot: Math.PI / 8, farbe: '#7c6a58' });   // achteckiger Rumpf, als Pyramide gekürzt
        daecher.push({ x, y: y + 9.6, z, s: 1, sx: 2.8, sy: 1.4, sz: 3.2, farbe: '#5a5048' });           // Kappe
        fluegel = baueFluegel(x, y + 10.1, z, -Math.PI / 2 + (m.px < 20 ? 0.6 : -0.6));
      }
    }
    for (const h of plan.haeuser) {
      haus(h.px, h.py, h.dreh, h.art, h.breite * U, h.laenge * U);
      // Gartenbaum hinter dem Haus
      if (rnd() < 0.6) {
        const w = h.dreh + Math.PI / 2 * (rnd() < 0.5 ? 1 : -1);
        const qx = h.px + Math.sin(w) * 11, qy = h.py + Math.cos(w) * 11;
        const p = punkt(qx, qy, stufe, region);
        if (p.typ === 'dorf' && p.h > 0.3 && freiAbstand(qx, qy, stufe) > 3) baum(qx, qy, p, { kiefer: 0 });
      }
    }
  }
  // ---- Allee an der Landstraße hinter dem Hafen (südliche Seite, die nördliche ist Baufläche).
  // Liegt am unteren Rand der Startansicht und zeigt dort schon, dass dahinter Land mit Bäumen beginnt.
  if (pf.knicks || plan) {
    const ALLEE_Y = -97;
    for (let px = -326 + rnd() * 4; px < 338; px += 7.5 + rnd() * 1.5) {
      if (rnd() < 0.08) continue;   // Lücken wie in echten Alleen
      const py = ALLEE_Y + (rnd() - 0.5) * 1.2;
      if (punkt(px, -89, stufe, region).typ !== 'weg') continue;   // nur wo die Straße wirklich liegt
      if (hafenAbstand(px, py) < 4 || freiAbstand(px, py, stufe) < 3 || !frei(px, py, 2.5)) continue;
      const p = punkt(px, py, stufe, region);
      if (p.h < 0.3 || ['weg', 'feldweg', 'wasser', 'sand', 'strand'].includes(p.typ)) continue;
      belegt.push([px, py, 2.5]);
      baum(px, py, p, { kiefer: 0, gross: 1.15 });
    }
  }
  for (const hof of hoefe()) {
    const ok = haus(hof.px, hof.py, hof.dreh, hof.art, 9, 15);
    if (!ok) continue;
    const c = Math.cos(hof.dreh), s = Math.sin(hof.dreh);
    haus(hof.px + c * 14, hof.py - s * 14, hof.dreh + Math.PI / 2, 'scheune', 10, 17, 3.6);
    for (let i = 0; i < 3; i++) {
      const qx = hof.px - c * 12 + (rnd() - 0.5) * 10, qy = hof.py + s * 12 + (rnd() - 0.5) * 10;
      const p = punkt(qx, qy, stufe, region);
      if (p.h > 0.3 && freiAbstand(qx, qy, stufe) > 3) baum(qx, qy, p, { kiefer: 0, gross: 1.2 });
    }
  }

  // ---- Netze bauen
  const flach = { flatShading: true };
  const mKrone = new THREE.MeshLambertMaterial(flach);
  const teile = [
    backeKacheln(kronenKiefer, mKrone, kiefern, 'kiefern'),
    backeKacheln(kronenLaub, new THREE.MeshLambertMaterial(flach), laub, 'laubbaeume'),
    backeKacheln(busch, new THREE.MeshLambertMaterial(flach), buesche, 'knicks'),
    backeKacheln(stamm, new THREE.MeshLambertMaterial(flach), staemme, 'staemme'),
    backeKacheln(() => verschmelze([new THREE.ConeGeometry(0.5, 1, 4, 1, true).translate(0, 0.5, 0)]), new THREE.MeshLambertMaterial(flach), gras, 'duenengras'),
    backeKacheln(busch, new THREE.MeshLambertMaterial(flach), heide, 'heide'),
    backeKacheln(() => verschmelze([new THREE.ConeGeometry(0.12, 1, 3, 1, true).translate(0, 0.5, 0)]), new THREE.MeshLambertMaterial(flach), schilf, 'schilf'),
    backe(stein(), new THREE.MeshLambertMaterial(flach), felsen, 'felsen'),
  ];
  if (waende.length) teile.push(backeKacheln(wandKoerper, new THREE.MeshLambertMaterial(flach), waende, 'dorf-waende'));
  if (daecher.length) teile.push(backeKacheln(satteldach, new THREE.MeshLambertMaterial({ ...flach, side: THREE.DoubleSide }), daecher, 'dorf-daecher'));
  if (spitzen.length) teile.push(backeKacheln(pyramide, new THREE.MeshLambertMaterial(flach), spitzen, 'dorf-spitzen'));
  for (const t of teile) {
    if (!t.userData.anzahl) { t.geometry?.dispose(); continue; }
    const wirft = schatten && !['schilf', 'duenengras', 'heide'].includes(t.name);
    t.traverse((o) => { if (o.isMesh) { o.castShadow = wirft; o.receiveShadow = false; } });
    gruppe.add(t);
  }
  if (fluegel) gruppe.add(fluegel);

  const laubNetz = teile[1], knickNetz = teile[2], heideNetz = teile[5];
  return {
    baeume: [...kiefern, ...laub],
    gebaeude: waende.length,
    faerbe(jahreszeit) {
      const tabelle = LAUB_JAHR[jahreszeit];
      const r = zufallAus(99);
      const neu = (it) => {
        if (!it.grund) it.grund = it.farbe;
        const liste = tabelle?.[it.art];
        return liste ? liste[Math.floor(r() * liste.length)] : it.grund;
      };
      if (laubNetz.userData.anzahl) faerbeNeu(laubNetz, neu);
      if (knickNetz.userData.anzahl) faerbeNeu(knickNetz, neu);
      if (heideNetz.userData.anzahl) {
        // Besenheide blüht im Spätsommer lila, sonst eher braungrün
        faerbeNeu(heideNetz, (it) => { if (!it.grund) it.grund = it.farbe; return jahreszeit === 'sommer' ? it.grund : JAHRESZEIT_FARBEN[jahreszeit]?.heide || it.grund; });
      }
    },
    aktualisiere(dt) {
      if (fluegel) fluegel.userData.rad.rotation.z += dt * 0.6;
    },
  };
}

function rauschenSchilf(px, py) {
  // gleiche Gruppen wie früher (rauschen aus gelaende.js mit Seed 55), hier vereinfacht
  const ix = Math.floor(px / 14), iy = Math.floor(py / 14);
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(55, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** Vier Mühlenflügel als ein Netz, das sich um die Achse dreht. */
function baueFluegel(x, y, z, richtung) {
  const halter = new THREE.Group();
  halter.name = 'muehle-fluegel';
  halter.position.set(x, y, z);
  halter.rotation.y = richtung;
  const rad = new THREE.Group();
  rad.position.set(0, 0, 1.8);
  const mat = new THREE.MeshLambertMaterial({ color: '#efe8da', flatShading: true });
  const geos = [];
  for (let i = 0; i < 4; i++) {
    const g = new THREE.BoxGeometry(1.1, 6.2, 0.12);
    g.translate(0.45, 3.4, 0);
    g.rotateZ(i * Math.PI / 2);
    geos.push(g);
  }
  const netz = new THREE.Mesh(verschmelze(geos), mat);
  geos.forEach((g) => g.dispose());
  rad.add(netz);
  halter.add(rad);
  halter.userData.rad = rad;
  return halter;
}
