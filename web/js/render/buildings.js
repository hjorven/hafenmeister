// Hafengebaeude und Hafenzubehoer als 3D-Modelle im Flat-Stil.
// Gehoert dem Thread "Haefen mit echten Satellitenbildern vergleichen". Vorbilder: docs/vorbilder.md
//
// Enthalten: Toilette, Hafenmeister, Dusche, Kiosk, Hafenbuero, Sanitaergebaeude, Restaurant,
// Hafenspeicher, Fischbuden, Bootsschuppen-Reihe, Wohnhaeuser, Molenfeuer,
// Strandkoerbe, Seebruecke, Schwimmwellenbrecher.
// Nicht enthalten (Thread "Services und Sonderanlagen"): Bootsverleih, Slip, Segelclub, Mastenkran,
// Werft, Travellift, Winterlager, Fischhalle, Tankstelle, Seenotretter, Fahrgastanleger, Kreuzfahrt, Marine.
//
// Schnittstelle:
//   game.buildings.setStage(n)      Ausbaustufe 1 bis 6, zeigt und verschiebt die Gebaeude (6 wie 5)
//   game.buildings.setRegion(name)  'ostsee' | 'nordsee' (Gebaeude mischen DE, DK, SE)
//   game.buildings.group            THREE.Group mit allem
//   game.buildings.items            Liste { id, name, art, ab, bis, stil, mesh }
//   game.buildings.eingang(id)      { x, y, z, seite } 1 m vor der Tuer, null wenn nicht gebaut
//   Ereignisse: game.on('stufe', n) und game.on('region', name) wirken wie die beiden Funktionen.
//   Beim Start gelten game.state.stufe und game.state.region, falls vorhanden.
//   Antippen: jedes Gebaeude traegt userData.pick = { type: 'building', id } mit der id aus PLAN.
//   Zum Ausprobieren: index.html?stufe=5&region=nordsee
//
// Lagen stammen aus skripte/konzeptbilder/hafen_von_oben.py (Planeinheiten, y nach Norden).
// Welt: x = xPlan * 0.62, z = -yPlan * 0.62, y oben, Wasser bei 0.
import * as THREE from 'three';
import { buendeln } from './buendeln.js';
import { STRAND_PLAN, strandLagen } from './landschaft/strand.js';

const U = 0.62;
const W = (xp, yp) => [xp * U, -yp * U];

// ------------------------------------------------------------------ Bauweisen und Regionen
// Gebaeude mischen Vorbilder aus deutschen, daenischen und schwedischen Haefen (Plan: nur die
// Regionen Ostsee und Nordsee). Jedes Gebaeude hat einen Stil, die Region waehlt die Farben dazu.
// Rollen statt fester Farben: wand, wand2, dach, dach2, holz, schuppen, kante, tuer, sockel.
const STILE = {
  backstein: { wand: '#b4553f', wand2: '#f2ede3', dach: '#c2513b', dach2: '#55606e', holz: '#9a6a46', schuppen: '#8c3b2e', kante: '#ffffff', tuer: '#2f5d7c', sockel: '#8b8780' },
  falurot:   { wand: '#9a2f24', wand2: '#e9c46a', dach: '#4b4d55', dach2: '#3f4248', holz: '#9a2f24', schuppen: '#a8352a', kante: '#f7f3ea', tuer: '#2f4f6f', sockel: '#a39a90' },
  gelb:      { wand: '#f1cf63', wand2: '#f4f1ea', dach: '#bf4e36', dach2: '#2e2f33', holz: '#3a3a3e', schuppen: '#2c2c30', kante: '#ffffff', tuer: '#2f6a4f', sockel: '#a19c92' },
  reet:      { wand: '#f4f1ea', wand2: '#e7dccb', dach: '#8a7550', dach2: '#6d5f45', holz: '#6d5a48', schuppen: '#556b5a', kante: '#f4f1ea', tuer: '#2e5e3e', sockel: '#7d7a74' },
  weiss:     { wand: '#f2ede3', wand2: '#dfe6ea', dach: '#55606e', dach2: '#3d424a', holz: '#9a6a46', schuppen: '#4f7f9b', kante: '#ffffff', tuer: '#2f5d7c', sockel: '#8b8780' },
};
// Nordsee: Klinker, Reet und weisser Putz statt Holzhaeusern in Falunrot und gelb gekalkten Haeusern
const NORDSEE = {
  backstein: { wand: '#7d3b2f', dach: '#3d424a', schuppen: '#5a2e26' },
  falurot:   { wand: '#7d3b2f', wand2: '#f0ebe0', dach: '#8a7550', holz: '#6d5a48', schuppen: '#556b5a' },
  gelb:      { wand: '#f0ebe0', dach: '#3d424a', holz: '#556b5a', schuppen: '#556b5a' },
  reet:      {},
  weiss:     { dach: '#3d424a' },
};
export const REGIONEN = ['ostsee', 'nordsee'];
const STIL_FOLGE = ['backstein', 'falurot', 'gelb', 'reet', 'weiss'];

function farbenFuer(stil, region) {
  return region === 'nordsee' ? { ...STILE[stil], ...NORDSEE[stil] } : STILE[stil];
}

const FEST = {
  glas: '#8fc3d6', glasNacht: '#ffd98a', markise1: '#e45b4f', markise2: '#ffffff', beton: '#cfcac0',
  stein: '#9a958c', planke: '#d9b27c', pfahl: '#5c5460', gruen: '#2fae63', rot: '#e2453b', weiss: '#fbfaf6',
  laterne: '#30363d', korb: '#e8d6a8', schirm: '#f3efe6', kiste: '#4f86b5', schwimmer: '#e9e6df', flagge: '#d33a32',
};

function mats(farben) {
  const m = {};
  for (const [k, c] of Object.entries(farben)) {
    m[k] = new THREE.MeshLambertMaterial({ color: c, flatShading: true });
  }
  return m;
}

// ------------------------------------------------------------------ Bausteine
function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y + h / 2, z);
  return m;
}

function cyl(r, h, mat, x = 0, y = 0, z = 0, seg = 8, rTop = r) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, r, h, seg), mat);
  m.position.set(x, y + h / 2, z);
  return m;
}

// Satteldach als Prisma. First laeuft entlang x (laenge), Giebel zeigen nach +x und -x.
function satteldach(laenge, breite, hoehe, mat, ueber = 0.3) {
  const b = breite / 2 + ueber;
  const shape = new THREE.Shape();
  shape.moveTo(-b, 0); shape.lineTo(b, 0); shape.lineTo(0, hoehe); shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: laenge + ueber * 2, bevelEnabled: false });
  geo.translate(0, 0, -(laenge + ueber * 2) / 2);
  geo.rotateY(Math.PI / 2);
  return new THREE.Mesh(geo, mat);
}

// Pultdach: flache geneigte Platte
function pultdach(laenge, breite, neigung, mat, ueber = 0.3) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(laenge + ueber * 2, 0.18, breite + ueber * 2), mat);
  m.rotation.x = neigung;
  return m;
}

// Haus mit Satteldach. Giebel zeigen nach Osten und Westen, ausser giebelZumWasser (dann Norden).
function haus({ l, b, h, dachH, wand, dach, giebelZumWasser = false }, M) {
  const g = new THREE.Group();
  const [gl, gb] = giebelZumWasser ? [b, l] : [l, b];
  g.add(box(gl, h, gb, wand));
  const d = satteldach(gl, gb, dachH, dach);
  d.position.y = h;
  g.add(d);
  g.add(box(gl + 0.1, 0.25, gb + 0.1, M.sockel));
  return g;
}

function fenster(g, M, laenge, hoehe, z, n, y = 1.4, w = 0.8, h = 0.9) {
  for (let i = 0; i < n; i++) {
    const x = -laenge / 2 + (i + 0.5) * (laenge / n);
    g.add(box(w, h, 0.08, M.glas, x, y, z));
  }
}

function flaggenmast(M, h = 7) {
  const g = new THREE.Group();
  g.add(cyl(0.06, h, M.weiss, 0, 0, 0, 6));
  const f = box(1.1, 0.7, 0.04, M.flagge, 0.55, h - 0.9, 0);
  g.add(f);
  g.userData.flagge = f;
  return g;
}

function rettungsring(M) {
  const r = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.08, 6, 12), M.markise1);
  return r;
}

// ------------------------------------------------------------------ Gebaeude
// Jede Funktion baut in lokalen Koordinaten: Mitte am Boden, Wasserseite ist -z (Norden).
const BAU = {
  toilette(M) {
    const g = haus({ l: 3.2, b: 2.6, h: 2.3, dachH: 1.3, wand: M.holz, dach: M.dach2 }, M);
    g.add(box(0.8, 1.8, 0.08, M.kante, -0.6, 0.15, -1.33));
    g.add(box(0.8, 1.8, 0.08, M.kante, 0.6, 0.15, -1.33));
    return g;
  },

  // Hafenmeister: kleines Haus mit verglastem Ausguck auf dem Dach (Burgtiefe, Heiligenhafen)
  hafenmeister(M) {
    const g = haus({ l: 4.4, b: 3.4, h: 2.8, dachH: 1.5, wand: M.wand, dach: M.dach }, M);
    fenster(g, M, 4.4, 2.8, -1.72, 2);
    const aus = new THREE.Group();
    aus.add(box(1.8, 1.4, 1.8, M.glas));
    aus.add(box(2.2, 0.15, 2.2, M.dach2, 0, 1.4, 0));
    aus.add(box(1.9, 0.12, 1.9, M.kante, 0, -0.06, 0));
    aus.position.set(0.6, 3.6, 0);
    g.add(aus);
    const mast = flaggenmast(M, 7.5);
    mast.position.set(-2.8, 0, -1.8);
    g.add(mast);
    const ring = rettungsring(M);
    ring.position.set(-1.2, 1.6, -1.76);
    g.add(ring);
    return g;
  },

  dusche(M) {
    const g = new THREE.Group();
    g.add(box(5.6, 2.6, 3.7, M.holz));
    const d = pultdach(5.6, 3.7, 0.12, M.dach2);
    d.position.y = 2.75;
    g.add(d);
    for (let i = 0; i < 4; i++) g.add(box(0.8, 1.9, 0.08, M.kante, -2.1 + i * 1.4, 0.1, -1.88));
    return g;
  },

  // Kiosk oder Fischbude: Kasten mit Klappe und gestreifter Markise
  kiosk(M, { breit = 3.7, tief = 3.1 } = {}) {
    const g = new THREE.Group();
    g.add(box(breit, 2.5, tief, M.wand2));
    g.add(box(breit + 0.3, 0.25, tief + 0.3, M.dach2, 0, 2.5, 0));
    g.add(box(breit * 0.7, 0.9, 0.1, M.glas, 0, 1.2, -tief / 2 - 0.02));
    const streifen = 6;
    for (let i = 0; i < streifen; i++) {
      const s = box(breit / streifen, 0.08, 1.3, i % 2 ? M.markise2 : M.markise1, -breit / 2 + (i + 0.5) * breit / streifen, 2.1, -tief / 2 - 0.6);
      s.rotation.x = -0.35;
      g.add(s);
    }
    for (const x of [-breit * 0.3, breit * 0.3]) g.add(box(1.4, 0.45, 0.4, M.planke, x, 0, -tief / 2 - 2.0));
    return g;
  },

  // Hafenbuero: zweigeschossig, Glasfront zum Wasser, Ausguck, Uhr am Giebel
  hafenbuero(M) {
    const g = new THREE.Group();
    g.add(box(8.6, 5.4, 6.2, M.wand));
    const d = satteldach(8.6, 6.2, 2.2, M.dach);
    d.position.y = 5.4;
    g.add(d);
    g.add(box(8.7, 0.3, 6.3, M.sockel));
    g.add(box(6.0, 2.0, 0.1, M.glas, 0, 0.5, -3.12));
    fenster(g, M, 8.6, 5.4, -3.12, 4, 3.4);
    const aus = new THREE.Group();
    aus.add(box(2.4, 1.8, 2.4, M.glas));
    aus.add(new THREE.Mesh(new THREE.ConeGeometry(1.9, 1.0, 4), M.dach2));
    aus.children[1].position.y = 2.3;
    aus.children[1].rotation.y = Math.PI / 4;
    aus.position.set(0, 6.6, 0);
    g.add(aus);
    const uhr = new THREE.Mesh(new THREE.CircleGeometry(0.45, 12), M.kante);
    uhr.rotation.y = -Math.PI / 2;
    uhr.position.set(-4.32, 6.0, 0);
    g.add(uhr);
    const mast = flaggenmast(M, 9);
    mast.position.set(5.6, 0, -3.6);
    g.add(mast);
    return g;
  },

  // Sanitaergebaeude: langer flacher Riegel mit Pultdach und Tuerreihe
  sanitaer(M) {
    const g = new THREE.Group();
    g.add(box(16, 3.0, 6.2, M.wand2));
    const d = pultdach(16, 6.2, 0.1, M.dach2);
    d.position.y = 3.2;
    g.add(d);
    for (let i = 0; i < 9; i++) g.add(box(0.9, 2.0, 0.08, i === 4 ? M.tuer : M.holz, -7 + i * 1.75, 0.1, -3.12));
    return g;
  },

  // Restaurant: flach, Glasfront, Terrasse mit Sonnenschirmen zum Wasser
  restaurant(M) {
    const g = new THREE.Group();
    g.add(box(16, 3.6, 5.5, M.wand, 0, 0, 1.6));
    g.add(box(16.6, 0.35, 6.1, M.dach2, 0, 3.6, 1.6));
    g.add(box(14.5, 2.6, 0.1, M.glas, 0, 0.5, -1.17));
    g.add(box(16, 0.3, 3.0, M.planke, 0, 0, -2.6));
    for (let i = 0; i < 4; i++) {
      const x = -6 + i * 4;
      g.add(cyl(0.05, 2.3, M.weiss, x, 0.3, -2.6, 5));
      g.add(new THREE.Mesh(new THREE.ConeGeometry(1.4, 0.6, 8), M.schirm));
      g.children[g.children.length - 1].position.set(x, 2.8, -2.6);
      g.add(cyl(0.45, 0.7, M.holz, x, 0.3, -2.6, 8));
    }
    return g;
  },

  // Hafenspeicher: Backstein, steiles Dach, Ladeluken uebereinander, Kranbalken im Giebel
  speicher(M, { l = 9.6, b = 5.4 } = {}) {
    const g = haus({ l: b, b: l, h: 8, dachH: 3.2, wand: M.wand2, dach: M.dach2, giebelZumWasser: true }, M);
    for (let i = 0; i < 3; i++) g.add(box(1.1, 1.3, 0.1, M.holz, 0, 1 + i * 2.4, -l / 2 - 0.02));
    g.add(box(0.25, 0.25, 1.4, M.holz, 0, 9.0, -l / 2 - 0.5));
    for (const x of [-b / 2 + 0.9, b / 2 - 0.9]) for (let i = 0; i < 3; i++) g.add(box(0.6, 0.8, 0.1, M.glas, x, 1.2 + i * 2.4, -l / 2 - 0.02));
    return g;
  },

  // Bootsschuppen in Reihe, Giebel zum Wasser, grosses Tor (Smoegen, Sandhamn)
  bootsschuppen(M, { anzahl = 3 } = {}) {
    const g = new THREE.Group();
    for (let i = 0; i < anzahl; i++) {
      const s = haus({ l: 3.4, b: 5.0, h: 2.6, dachH: 1.8, wand: i === 1 ? M.wand : M.schuppen, dach: M.dach2, giebelZumWasser: true }, M);
      s.add(box(1.8, 2.0, 0.08, M.kante, 0, 0.2, -2.52));
      s.add(box(1.5, 1.7, 0.1, M.holz, 0, 0.3, -2.54));
      s.position.x = (i - (anzahl - 1) / 2) * 3.7;
      s.position.z = (i % 2) * 0.4;
      g.add(s);
    }
    return g;
  },

  wohnhaus(M, { l = 8, b = 6, h = 3.2, dachH = 3.0, wand = 'wand' } = {}) {
    const g = haus({ l, b, h, dachH, wand: M[wand], dach: M.dach }, M);
    fenster(g, M, l, h, -b / 2 - 0.02, 3, 1.3);
    g.add(box(1.0, 1.9, 0.1, M.tuer, l / 2 - 1.2, 0.1, b / 2 + 0.02));
    return g;
  },

  // Molenfeuer: runder Turm auf Steinsockel, Laterne oben. Gruen an Steuerbord der Einfahrt, Rot an Backbord.
  molenfeuer(M, { farbe = 'gruen' } = {}) {
    const g = new THREE.Group();
    const f = M[farbe];
    g.add(cyl(1.5, 1.0, M.stein, 0, 0, 0, 10));
    g.add(cyl(0.95, 3.0, f, 0, 1.0, 0, 12, 0.85));
    g.add(cyl(0.86, 0.8, M.weiss, 0, 4.0, 0, 12, 0.8));
    g.add(cyl(0.8, 1.6, f, 0, 4.8, 0, 12, 0.72));
    g.add(cyl(1.0, 0.12, M.laterne, 0, 6.4, 0, 12));
    const licht = new THREE.MeshBasicMaterial({ color: farbe === 'gruen' ? '#5cff9a' : '#ff5a4a' });
    const lat = cyl(0.5, 0.8, licht, 0, 6.5, 0, 10);
    lat.userData.blink = { mat: licht, an: licht.color.clone(), aus: new THREE.Color(farbe === 'gruen' ? '#2c6b46' : '#7a2d27'), periode: farbe === 'gruen' ? 4 : 5 };
    g.add(lat);
    const kappe = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.6, 10), M.laterne);
    kappe.position.y = 7.6;
    g.add(kappe);
    g.userData.licht = lat;
    return g;
  },

  // Strandkorb-Gruppe: Koerbe mit gestreiftem Bezug, Ruecken nach Westen in den Wind
  strandkoerbe(M, { anzahl = 6, seed = 1 } = {}) {
    const g = new THREE.Group();
    const r = rnd(seed);
    const bezug = [M.markise1, M.kiste, M.gruen, M.dach];
    for (let i = 0; i < anzahl; i++) {
      const k = new THREE.Group();
      k.add(box(1.25, 0.5, 0.85, M.korb));
      const haube = box(1.25, 1.0, 0.25, M.korb, 0, 0.5, 0.32);
      k.add(haube);
      k.add(box(1.27, 0.85, 0.08, bezug[i % bezug.length], 0, 0.6, 0.18));
      k.add(box(1.27, 0.12, 0.6, M.korb, 0, 1.45, 0.05));
      k.position.set((i % 4) * 2.2 + r() * 0.6, 0, Math.floor(i / 4) * 2.6 + r() * 0.6);
      k.rotation.y = Math.PI * 0.5 + (r() - 0.5) * 0.5;
      g.add(k);
    }
    return g;
  },

  // Seebruecke: Holzsteg auf Pfaehlen mit Pavillon am Kopf (Kuehlungsborn, Heiligenhafen)
  seebruecke(M, { laenge = 42 } = {}) {
    const g = new THREE.Group();
    g.add(box(3.2, 0.3, laenge, M.planke, 0, 1.6, -laenge / 2));
    for (let i = 0; i <= laenge; i += 4) {
      for (const x of [-1.4, 1.4]) g.add(cyl(0.16, 2.6, M.pfahl, x, -0.8, -i, 6));
      for (const x of [-1.55, 1.55]) g.add(box(0.08, 0.9, 4.0, M.weiss, x, 1.9, -i - 2).translateY(0));
    }
    g.add(box(9, 0.35, 7, M.planke, 0, 1.6, -laenge - 3.2));
    g.add(cyl(2.6, 2.6, M.wand2, 0, 1.9, -laenge - 3.2, 8));
    const d = new THREE.Mesh(new THREE.ConeGeometry(3.4, 1.6, 8), M.dach);
    d.position.set(0, 5.3, -laenge - 3.2);
    g.add(d);
    return g;
  },
};

// Schwimmwellenbrecher als Kette von Betonpontons entlang einer Linie (Burgtiefe, Hohe Duene)
function wellenbrecher(M, punkte) {
  const g = new THREE.Group();
  const kurve = new THREE.CatmullRomCurve3(punkte.map(([x, z]) => new THREE.Vector3(x, 0, z)));
  const n = Math.max(2, Math.round(kurve.getLength() / 6));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const p = kurve.getPointAt(t);
    const tan = kurve.getTangentAt(t);
    const s = box(5.6, 0.7, 2.6, M.beton, 0, -0.35, 0);
    s.position.set(p.x, 0, p.z);
    s.rotation.y = Math.atan2(-tan.z, tan.x);
    g.add(s);
    const kante = box(5.6, 0.05, 0.2, M.gruen, 0, 0.36, 1.2);
    kante.position.add(s.position);
    kante.rotation.copy(s.rotation);
    g.add(kante);
  }
  return g;
}

function rnd(seed) {
  let s = seed * 9301 + 49297;
  return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
}

// ------------------------------------------------------------------ Lagen je Stufe
// p: Lage in Planeinheiten, entweder fest [x, y] oder je Stufe { 1: [x, y], 3: [x, y] } (gilt ab dieser Stufe).
// dreh: Drehung um die Hochachse in Grad, 0 = Wasserseite nach Norden.
const PLAN = [
  { id: 'toilette',      name: 'Toilette',          art: 'toilette',      ab: 1, p: { 1: [-95, -24], 3: [-95, -32] }, stil: 'falurot' },
  { id: 'hafenmeister',  name: 'Hafenmeister',      art: 'hafenmeister',  ab: 2, p: { 2: [-72, -22], 3: [-72, -30] }, stil: 'weiss' },
  { id: 'dusche',        name: 'Dusche',            art: 'dusche',        ab: 2, p: [-118, -36], stil: 'falurot' },
  { id: 'kiosk',         name: 'Kiosk',             art: 'kiosk',         ab: 2, p: { 2: [-36, -24], 3: [-36, -30] }, stil: 'gelb' },
  { id: 'schuppen-w',    name: 'Bootsschuppen',     art: 'bootsschuppen', ab: 2, p: [-157, -22], opt: { anzahl: 3 }, stil: 'falurot' },
  { id: 'hafenbuero',    name: 'Hafenbüro',         art: 'hafenbuero',    ab: 3, p: [6, -32], stil: 'backstein' },
  { id: 'sanitaer',      name: 'Sanitärgebäude',    art: 'sanitaer',      ab: 3, p: [-60, -54], stil: 'falurot' },
  { id: 'restaurant',    name: 'Restaurant',        art: 'restaurant',    ab: 4, p: [48, -34], stil: 'reet' },
  { id: 'speicher',      name: 'Hafenspeicher',     art: 'speicher',      ab: 4, p: [112, -30], stil: 'backstein' },
  { id: 'speicher-kai',  name: 'Speicher am Kai',   art: 'speicher',      ab: 5, p: [56, 204], opt: { l: 8.6, b: 5.0 }, stil: 'backstein' },
  { id: 'fischbuden',    name: 'Fischbuden',        art: 'kiosk',         ab: 5, p: [108, 204], opt: { breit: 3.4, tief: 2.8 } },
  { id: 'fischbuden2',   name: 'Fischbuden',        art: 'kiosk',         ab: 5, p: [99, 204], opt: { breit: 3.4, tief: 2.8 } },
  // Dorf hinter dem Hafen: waechst mit den Stufen
  { id: 'haus-1', name: 'Wohnhaus', art: 'wohnhaus', ab: 1, p: [-150, -46], opt: { wand: 'wand' } },
  { id: 'haus-2', name: 'Wohnhaus', art: 'wohnhaus', ab: 1, p: [-168, -40], opt: { wand: 'wand2', l: 7, dachH: 2.6 } },
  { id: 'haus-3', name: 'Wohnhaus', art: 'wohnhaus', ab: 2, p: [-140, -62], opt: { wand: 'wand2' } },
  { id: 'haus-4', name: 'Wohnhaus', art: 'wohnhaus', ab: 2, p: [-96, -62], opt: { wand: 'wand', l: 9 } },
  { id: 'haus-5', name: 'Wohnhaus', art: 'wohnhaus', ab: 3, p: [-232, -40], opt: { wand: 'wand' } },
  { id: 'haus-6', name: 'Wohnhaus', art: 'wohnhaus', ab: 3, p: [-250, -56], opt: { wand: 'wand2', l: 7 } },
  { id: 'haus-7', name: 'Wohnhaus', art: 'wohnhaus', ab: 4, p: [86, -62], opt: { wand: 'wand2', l: 10, b: 7, h: 6, dachH: 3.2 } },
  { id: 'haus-8', name: 'Wohnhaus', art: 'wohnhaus', ab: 4, p: [64, -66], opt: { wand: 'wand', l: 10, b: 7, h: 6, dachH: 3.2 } },
  { id: 'haus-9', name: 'Wohnhaus', art: 'wohnhaus', ab: 5, p: [-270, -36], opt: { wand: 'wand' } },
  // Molenfeuer auf den Molenkoepfen: einlaufend Gruen rechts (Westmole), Rot links (Ostmole)
  { id: 'feuer-gruen', name: 'Molenfeuer Grün', art: 'molenfeuer', ab: 3, p: { 3: [142, 274], 5: [96, 320] }, opt: { farbe: 'gruen' }, mole: true },
  { id: 'feuer-rot',   name: 'Molenfeuer Rot',  art: 'molenfeuer', ab: 3, p: { 3: [216, 268], 5: [196, 306] }, opt: { farbe: 'rot' }, mole: true },
  // Strand: Strandkoerbe am Ostseestrand der Nehrung, Seebruecke ab Stufe 3. In Stufe 6 ruecken Koerbe und Seebruecke
  // zur Seite: Kreuzfahrtterminal (x -185..-115) und Marinebasis (x -352..-280) brauchen die Nehrung (data/anlagen-flaechen.js).
  { id: 'koerbe-1', name: 'Strandkörbe', art: 'strandkoerbe', ab: 2, p: { 2: [-210, 214], 6: [-224, 210] }, opt: { anzahl: 8, seed: 3 } },
  { id: 'koerbe-2', name: 'Strandkörbe', art: 'strandkoerbe', ab: 3, p: { 3: [-120, 218], 6: [-84, 212] }, opt: { anzahl: 6, seed: 7 } },
  { id: 'koerbe-3', name: 'Strandkörbe', art: 'strandkoerbe', ab: 3, p: [228, 218], opt: { anzahl: 7, seed: 11 } },
  { id: 'koerbe-4', name: 'Strandkörbe', art: 'strandkoerbe', ab: 1, p: [-14, -8], opt: { anzahl: 3, seed: 5 } },
  { id: 'seebruecke', name: 'Seebrücke', art: 'seebruecke', ab: 3, p: { 3: [-170, 216], 6: [-262, 214] }, opt: { laenge: 44 } },
];

// Schwimmwellenbrecher im See ab Stufe 4, Oeffnung nach Osten zum Fahrwasser
const WELLENBRECHER = [[-150, 136], [-95, 150], [-30, 154], [30, 148]];

// Strandkörbe und Seebrücke gehören an einen echten Strand: Ihre Lage kommt aus landschaft/strand.js (je Küste
// und Stufe gesucht, die Wunschlage steht dort), p in PLAN sagt hier nur, dass sie einen Platz brauchen.
const STRAND = new Set(Object.keys(STRAND_PLAN));
const strandLage = (id, stufe, region = 'ostsee') => strandLagen(stufe, region)[id] ?? null;

/** Lage in Planeinheiten in einer Stufe; Strandsachen am echten Strand, sonst null (dann fehlen sie). */
function stelle(it, stufe, region) {
  if (!it.p) return null;
  if (STRAND.has(it.id)) return strandLage(it.id, stufe, region);
  return lageInStufe(it.p, stufe);
}

function lageInStufe(p, stufe) {
  if (Array.isArray(p)) return p;
  let best = null;
  for (const [s, v] of Object.entries(p)) if (Number(s) <= stufe) best = v;
  return best ?? Object.values(p)[0];
}

// Gebaeude, die erst mit dem Kauf einer Versorgungsstufe (sim.js facilities, office) entstehen.
// Stufen und Namen aus data/economy.js: wc 1 Toilettenhaeuschen, 3 Sanitaergebaeude; dusche 1;
// essen 1 Kiosk, 3 Hafenrestaurant; Hafenbuero 1 Hafenmeister, 2 Hafenbuero.
const KAUF = {
  toilette: { art: 'wc', stufe: 1 },
  sanitaer: { art: 'wc', stufe: 3 },
  dusche: { art: 'dusche', stufe: 1 },
  kiosk: { art: 'essen', stufe: 1 },
  restaurant: { art: 'essen', stufe: 3 },
  hafenmeister: { art: 'office', stufe: 1 },
  hafenbuero: { art: 'office', stufe: 3 },
};

// ------------------------------------------------------------------ Modul
export function init(game) {
  const regionStart = new URLSearchParams(location.search).get('region');
  // Fruehere Namen (daenemark, schweden) zaehlen zur Ostsee
  const regionKey = (r) => (r === 'nordsee' ? 'nordsee' : r ? 'ostsee' : null);
  let regionName = regionKey(regionStart) ?? regionKey(game.state?.region) ?? 'ostsee';
  const F = mats(FEST);
  const SM = Object.fromEntries(Object.keys(STILE).map((st) => [st, { ...F, ...mats(farbenFuer(st, regionName)) }]));
  const M = SM.backstein;

  const group = new THREE.Group();
  group.name = 'gebaeude';
  game.scene.add(group);

  const hoehe = (x, z, fallback) => {
    const h = game.landschaft?.hoeheBei?.(x, z);
    return Number.isFinite(h) ? h : fallback;
  };

  const items = PLAN.map((e, i) => {
    const stil = e.stil ?? STIL_FOLGE[i % STIL_FOLGE.length];
    const mesh = BAU[e.art](SM[stil], e.opt ?? {});
    mesh.name = e.id;
    mesh.userData.pick = { type: 'building', id: e.id };
    return { ...e, stil, mesh };
  });

  const wb = wellenbrecher(M, WELLENBRECHER.map(([x, y]) => W(x, y)));
  wb.name = 'wellenbrecher';
  wb.userData.pick = { type: 'building', id: 'wellenbrecher' };
  items.push({ id: 'wellenbrecher', name: 'Schwimmwellenbrecher', art: 'wellenbrecher', ab: 4, mesh: wb });

  const lichter = [];
  const flaggen = [];
  for (const it of items) {
    it.mesh.traverse((o) => {
      if (o.userData.blink) lichter.push(o.userData.blink);
      if (o.userData.flagge) flaggen.push(o.userData.flagge);
    });
  }
  // Unbewegte Teile je Gebaeude und Material zu einem Mesh zusammenfassen (weniger Zeichenaufrufe).
  // Wehende Flaggen bleiben einzeln; Farben haengen am Material und wechseln weiter mit Region und Nacht.
  const wehend = new Set(flaggen);
  for (const it of items) buendeln(it.mesh, null, undefined, { ausnehmen: (o) => wehend.has(o) });

  // Versorgungsgebaeude stehen erst, wenn der Spieler sie gekauft hat (Bauen, ui/bauen.js).
  // Ansicht mit ?stufe=n (ohne Kaufen) zeigt alles, was zur Stufe gehoert.
  const ansicht = new URLSearchParams(location.search).has('stufe');
  function gekauft(it) {
    const k = KAUF[it.id];
    const st = game.sim?.state;
    if (!k || ansicht || !st) return true;
    const stand = k.art === 'office' ? st.office : st.facilities?.[k.art];
    return (stand || 0) >= k.stufe;
  }

  let stufe = 1;
  function setStage(n) {
    stufe = Math.max(1, Math.min(6, Math.round(Number(n) || 1)));
    for (const it of items) {
      const ort = stelle(it, stufe, regionName);
      const sichtbar = stufe >= it.ab && (it.bis == null || stufe <= it.bis) && gekauft(it) && (!it.p || !!ort);
      // Unsichtbares aus der Szene nehmen statt visible = false, damit game.pick es nicht trifft
      if (sichtbar && !it.mesh.parent) group.add(it.mesh);
      if (!sichtbar && it.mesh.parent) group.remove(it.mesh);
      if (!sichtbar || !it.p) continue;
      const [xp, yp] = ort;
      const [x, z] = W(xp, yp);
      const boden = it.mole ? hoehe(x, z, 1.4) : it.art === 'seebruecke' ? 0 : hoehe(x, z, 0.3);
      it.mesh.position.set(x, boden, z);
      it.mesh.rotation.y = ort[2] ?? THREE.MathUtils.degToRad(it.dreh ?? 0);
    }
    api.stage = stufe;
  }

  function setRegion(name) {
    const key = regionKey(name);
    if (!key) return false;
    regionName = key;
    for (const st of Object.keys(STILE)) {
      for (const [k, c] of Object.entries(farbenFuer(st, key))) SM[st][k].color.set(c);
    }
    api.region = key;
    return true;
  }

  // Molenfeuer blinken, Flaggen wehen, Fenster leuchten abends
  let zeit = 0;
  game.onTick((dt) => {
    zeit += dt;
    const nacht = game.landschaft?.licht?.zustand?.nacht ?? 0;
    for (const b of lichter) {
      const an = (zeit % b.periode) < 0.6;
      b.mat.color.copy(an ? b.an : b.aus);
    }
    for (const f of flaggen) f.rotation.y = Math.sin(zeit * 2.2 + f.id) * 0.25;
    F.glas.color.set(FEST.glas).lerp(new THREE.Color(FEST.glasNacht), nacht * 0.9);
  });

  // Eingang eines Gebaeudes als Weltpunkt 1 m vor der Tuer. Wohnhaeuser haben die Tuer nach Sueden
  // (Strassenseite), alle anderen zur Wasserseite nach Norden. Liefert null, wenn es nicht steht.
  const _box = new THREE.Box3();
  function eingang(id) {
    const it = items.find((i) => i.id === id);
    if (!it || !it.mesh.parent || !it.p) return null;
    _box.setFromObject(it.mesh);
    const sued = it.art === 'wohnhaus';
    return { x: it.mesh.position.x, y: it.mesh.position.y, z: sued ? _box.max.z + 1 : _box.min.z - 1, seite: sued ? 'sued' : 'nord' };
  }

  // Wo ein Gebaeude in einer Stufe steht (auch wenn es noch nicht gebaut ist), fuer die Bau-Vorschau
  function lage(id, n = stufe) {
    const it = items.find((i) => i.id === id);
    const ort = it && stelle(it, n, regionName);
    if (!ort) return null;
    const [xp, yp] = ort;
    const [x, z] = W(xp, yp);
    return { x, z, y: it.mole ? hoehe(x, z, 1.4) : hoehe(x, z, 0.3), dreh: ort[2] ?? THREE.MathUtils.degToRad(it.dreh ?? 0), mesh: it.mesh };
  }
  // Welches Gebaeude zu welcher gekauften Versorgung gehoert: { gebaeudeId: { art, stufe } }
  const fuerKauf = (art, n) => Object.entries(KAUF).filter(([, k]) => k.art === art && k.stufe === n).map(([id]) => id);

  const api = { group, items, eingang, setStage, setRegion, lage, fuerKauf, stage: stufe, region: regionName, regionen: REGIONEN };
  game.buildings = api;
  // Gekaufte Versorgung (Toilette, Dusche, Kiosk, Hafenbuero) erscheint sofort
  game.on('build', () => setStage(stufe));
  game.on('sim:change', (e) => { if (e?.reason === 'load') setStage(stufe); });
  game.on('stufe', (n) => setStage(typeof n === 'object' ? n?.stufe : n));
  game.on('region', (r) => setRegion(typeof r === 'object' ? r?.name ?? r?.region : r));
  // Gelaendehoehe steht erst fest, wenn alle Module geladen sind
  game.on('ready', () => setStage(stufe));

  const startStufe = new URLSearchParams(location.search).get('stufe');
  setStage(startStufe ?? game.state?.stufe ?? 1);
  return api;
}

export default init;
