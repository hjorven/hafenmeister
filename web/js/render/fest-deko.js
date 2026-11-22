// Das eigene Hafenfest im Hafen (Roadmap P38): Wimpelketten über den gebauten Stegen (Schmuck), eine
// Bühne (Musik) und Marktstände (Markt) beim Hafenmeisterhaus. Geladen von features/hafenfest.js, weil es
// Three.js braucht. Aufgebaut wird am Vorabend, abgebaut am Morgen nach dem Fest:
//   'hafenfest:aufbau' { teile }   und   'hafenfest:abbau'
// Bühne und Stände stehen über game.zielDeko.zusatz (features/ziel-deko.js) auf einem freien Platz an Land,
// nie auf Wegen, in Gebäuden oder im Wasser. Die Wimpelketten folgen game.stege.gebaut() (nur Gebautes).
// Prüfen: game.festDeko.stand() -> { teile, wimpel, masten, buehne, markt }
import * as THREE from 'three';

const U = 0.62;                    // Planeinheit in Metern (data/harbor.js)
const MAST_ABSTAND = 13;           // m zwischen zwei Masten der Wimpelkette
const MAST_HOEHE = 4.2;            // m über dem Deck
const DURCHHANG = 0.7;             // m in der Mitte zwischen zwei Masten
const WIMPEL_ABSTAND = 0.8;        // m
const MAX_WIMPEL = 1400;
const SEITE = 0.85;                // m neben der Mittellinie des Stegs
const FARBEN = ['#d8443a', '#f2c14e', '#2f6f8f', '#f4f1ea', '#4f8a4b', '#e47a3c'];

export function init(game) {
  if (!game.scene) return null;
  const gruppe = new THREE.Group();
  gruppe.name = 'fest-deko';
  gruppe.visible = false;
  game.scene.add(gruppe);

  const mat = (c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
  const M = {
    mast: mat('#e9e4d8'), holz: mat('#9a6b43'), holzHell: mat('#c99a62'), rot: mat('#c8453a'), weiss: mat('#f4f1ea'),
    blau: mat('#2f6f8f'), gelb: mat('#f2c14e'), dunkel: mat('#2b3038'), gruen: mat('#4f8a4b'), leine: mat('#5b5550'),
  };
  const box = (g, w, h, d, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y + h / 2, z); o.castShadow = true; g.add(o); return o; };
  const zyl = (g, r, h, m, x = 0, y = 0, z = 0, seg = 6) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m); o.position.set(x, y + h / 2, z); o.castShadow = true; g.add(o); return o; };

  // ------------------------------------------------------------ Wimpelketten über den Stegen
  // Ein Wimpel: Dreieck mit der Spitze nach unten (in der Ebene x-y, dreht sich zur Leine)
  const wimpelGeo = new THREE.BufferGeometry();
  wimpelGeo.setAttribute('position', new THREE.Float32BufferAttribute([-0.3, 0, 0, 0.3, 0, 0, 0, -0.65, 0], 3));
  wimpelGeo.computeVertexNormals();
  const wimpelMat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, flatShading: true });
  const wimpel = new THREE.InstancedMesh(wimpelGeo, wimpelMat, MAX_WIMPEL);
  wimpel.name = 'fest-wimpel';
  wimpel.count = 0;
  wimpel.frustumCulled = false;
  wimpel.raycast = () => {};
  const farbe = new THREE.Color();
  FARBEN.forEach((c, i) => wimpel.setColorAt(i, farbe.set(c)));
  const masten = new THREE.Group();
  masten.name = 'fest-masten';
  const leinen = new THREE.Group();
  const kette = new THREE.Group();
  kette.add(wimpel, masten, leinen);
  gruppe.add(kette);

  const mastGeo = new THREE.CylinderGeometry(0.06, 0.08, MAST_HOEHE, 5);
  const knaufGeo = new THREE.SphereGeometry(0.13, 6, 4);
  const leineMat = new THREE.LineBasicMaterial({ color: '#5b5550' });
  let ketteSig = null;
  let basis = [];        // je Wimpel: { pos, dreh } für das Flattern
  const _m = new THREE.Matrix4();
  const _q = new THREE.Quaternion();
  const _e = new THREE.Euler();
  const _s = new THREE.Vector3(1, 1, 1);

  function baueKette() {
    const g = game.stege?.gebaut?.();
    const sig = g?.sig ?? null;
    if (sig === ketteSig) return;
    ketteSig = sig;
    masten.clear();
    for (const l of leinen.children) l.geometry.dispose();
    leinen.clear();
    basis = [];
    if (!g) { wimpel.count = 0; return; }
    let n = 0;
    for (const linie of g.stege) {
      const p = linie.punkte.map(([x, y]) => new THREE.Vector2(x * U, -y * U));
      if (p.length < 2) continue;
      const deck = game.stege.deckHoehe?.(linie.bauart) ?? 0.8;
      // Länge und Masten entlang der Linie
      const segs = [];
      let laenge = 0;
      for (let i = 1; i < p.length; i++) { const d = p[i].distanceTo(p[i - 1]); segs.push({ a: p[i - 1], b: p[i], s0: laenge, d }); laenge += d; }
      if (laenge < 8) continue;
      const anzahl = Math.max(2, Math.round(laenge / MAST_ABSTAND) + 1);
      const punktBei = (s) => {
        const sg = segs.find((x) => s <= x.s0 + x.d) ?? segs[segs.length - 1];
        const k = sg.d > 0 ? Math.min(1, Math.max(0, (s - sg.s0) / sg.d)) : 0;
        const dir = new THREE.Vector2().subVectors(sg.b, sg.a).normalize();
        const pos = new THREE.Vector2().lerpVectors(sg.a, sg.b, k);
        // seitlich versetzt (links in Laufrichtung), Enden etwas eingerückt
        pos.add(new THREE.Vector2(-dir.y, dir.x).multiplyScalar(SEITE));
        return { pos, dir };
      };
      const rand = 1.2;
      const mastPunkte = [];
      for (let i = 0; i < anzahl; i++) mastPunkte.push(punktBei(rand + ((laenge - 2 * rand) * i) / (anzahl - 1)));
      for (const mp of mastPunkte) {
        const m = new THREE.Mesh(mastGeo, M.mast);
        m.position.set(mp.pos.x, deck + MAST_HOEHE / 2, mp.pos.y);
        m.castShadow = true;
        masten.add(m);
        const k = new THREE.Mesh(knaufGeo, M.gelb);
        k.position.set(mp.pos.x, deck + MAST_HOEHE + 0.05, mp.pos.y);
        masten.add(k);
      }
      // Leinen mit Durchhang, Wimpel daran
      for (let i = 1; i < mastPunkte.length; i++) {
        const a = mastPunkte[i - 1].pos, b = mastPunkte[i].pos;
        const d = a.distanceTo(b);
        const oben = deck + MAST_HOEHE - 0.15;
        const punkte = [];
        const schritte = 12;
        for (let j = 0; j <= schritte; j++) {
          const t = j / schritte;
          punkte.push(new THREE.Vector3(a.x + (b.x - a.x) * t, oben - Math.sin(t * Math.PI) * DURCHHANG, a.y + (b.y - a.y) * t));
        }
        leinen.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(punkte), leineMat));
        const dreh = Math.atan2(-(b.y - a.y), b.x - a.x);
        const w = Math.max(1, Math.floor(d / WIMPEL_ABSTAND));
        for (let j = 1; j < w && n < MAX_WIMPEL; j++) {
          const t = j / w;
          const pos = new THREE.Vector3(a.x + (b.x - a.x) * t, oben - Math.sin(t * Math.PI) * DURCHHANG, a.y + (b.y - a.y) * t);
          basis.push({ pos, dreh, phase: n * 0.7 });
          wimpel.setColorAt(n, farbe.set(FARBEN[n % FARBEN.length]));
          n++;
        }
      }
    }
    wimpel.count = n;
    setzeWimpel(0);
    if (wimpel.instanceColor) wimpel.instanceColor.needsUpdate = true;
  }

  function setzeWimpel(t) {
    for (let i = 0; i < basis.length; i++) {
      const b = basis[i];
      _e.set(Math.sin(t * 2.4 + b.phase) * 0.35, b.dreh, 0, 'YXZ');
      _q.setFromEuler(_e);
      _m.compose(b.pos, _q, _s);
      wimpel.setMatrixAt(i, _m);
    }
    wimpel.instanceMatrix.needsUpdate = true;
  }

  // ------------------------------------------------------------ Bühne (Musik)
  function buehne() {
    const g = new THREE.Group();
    box(g, 5.2, 0.8, 3.6, M.holz);                                     // Podest
    for (let i = 0; i < 5; i++) box(g, 1.0, 0.08, 3.6, i % 2 ? M.holzHell : M.holz, -2.1 + i * 1.05, 0.8, 0);
    for (const [x, z] of [[-2.45, -1.65], [2.45, -1.65], [-2.45, 1.65], [2.45, 1.65]]) zyl(g, 0.07, 2.8, M.weiss, x, 0.8, z);
    // Dach rot-weiß gestreift
    for (let i = 0; i < 6; i++) box(g, 0.9, 0.12, 3.9, i % 2 ? M.weiss : M.rot, -2.25 + i * 0.9, 3.6, 0);
    box(g, 5.2, 1.9, 0.1, M.blau, 0, 0.8, 1.7);                         // Rückwand (Landseite)
    // Lautsprecher, Trommel, Mikrofone, Notenständer
    for (const x of [-2.2, 2.2]) { box(g, 0.6, 1.1, 0.5, M.dunkel, x, 0.8, 1.2); box(g, 0.34, 0.34, 0.04, M.leine, x, 1.45, 0.94); }
    const tr = zyl(g, 0.35, 0.45, M.rot, -0.9, 0.8, 0.6, 10);
    tr.rotation.z = 0;
    zyl(g, 0.36, 0.05, M.weiss, -0.9, 1.25, 0.6, 10);
    for (const x of [0.3, 1.3]) { zyl(g, 0.025, 1.4, M.dunkel, x, 0.8, -0.6, 4); box(g, 0.08, 0.14, 0.08, M.dunkel, x, 2.2, -0.6); }
    // Fähnchen oben auf dem Dach
    for (const [x, c] of [[-2.4, M.gelb], [2.4, M.blau]]) {
      zyl(g, 0.03, 1.2, M.weiss, x, 3.72, 0, 4);
      box(g, 0.05, 0.4, 0.6, c, x, 4.4, 0.3);
    }
    // Treppe
    for (let i = 0; i < 3; i++) box(g, 1, 0.26, 0.4, M.holzHell, 2.0, i * 0.26, -2.0 + i * 0.12);
    return g;
  }

  // ------------------------------------------------------------ Marktstand (Markt)
  function stand(farbeDach, waren) {
    const g = new THREE.Group();
    for (const [x, z] of [[-1.3, -1.0], [1.3, -1.0], [-1.3, 1.0], [1.3, 1.0]]) zyl(g, 0.05, 2.2, M.weiss, x, 0, z, 4);
    for (let i = 0; i < 5; i++) box(g, 0.56, 0.1, 2.3, i % 2 ? M.weiss : farbeDach, -1.12 + i * 0.56, 2.2, 0);
    const dachV = box(g, 2.9, 0.1, 0.5, farbeDach, 0, 2.05, -1.25);    // Volant vorn
    dachV.rotation.x = 0.4;
    box(g, 2.5, 0.9, 0.7, M.holzHell, 0, 0, -0.6);                     // Tresen
    for (let i = 0; i < 4; i++) box(g, 0.45, 0.25, 0.4, waren[i % waren.length], -0.9 + i * 0.6, 0.9, -0.6);
    box(g, 2.5, 1.4, 0.06, M.weiss, 0, 0, 1.05);                       // Rückwand
    return g;
  }
  const markt = [stand(M.rot, [M.gelb, M.gruen]), stand(M.blau, [M.rot, M.holz]), stand(M.gruen, [M.weiss, M.gelb])];

  // ------------------------------------------------------------ Aufbau
  let teile = [];
  const an = (t) => teile.includes(t);
  const buehneObj = buehne();
  let angemeldet = false;
  function anmelden() {
    if (angemeldet) return true;
    const zd = game.zielDeko;
    if (!zd?.zusatz) return false;
    angemeldet = true;
    // Wunschlage relativ zum Hafenmeisterhaus (x Osten, z Süden = Landseite)
    // Bühne und Stände bilden einen Festplatz; ist dort kein Platz, sucht zielDeko den nächsten freien Fleck
    zd.zusatz('fest-buehne', { lage: { x: 13, z: 12, dreh: 180 }, radius: 3.6, objekt: buehneObj, da: () => an('musik') });
    zd.zusatz('fest-markt-1', { lage: { x: 5, z: 14, dreh: 200 }, radius: 2.1, objekt: markt[0], da: () => an('markt') });
    zd.zusatz('fest-markt-2', { lage: { x: 21, z: 14, dreh: 160 }, radius: 2.1, objekt: markt[1], da: () => an('markt') });
    zd.zusatz('fest-markt-3', { lage: { x: 13, z: 20, dreh: 180 }, radius: 2.1, objekt: markt[2], da: () => an('markt') });
    return true;
  }
  const warte = setInterval(() => { if (anmelden()) { clearInterval(warte); game.zielDeko.aufbauen(); } }, 500);

  function aufbau(neu) {
    teile = [...(neu ?? [])];
    kette.visible = an('schmuck');
    if (an('schmuck')) baueKette();
    gruppe.visible = kette.visible;
    if (anmelden()) game.zielDeko.aufbauen();
  }
  game.on('hafenfest:aufbau', (e) => aufbau(e?.teile));
  game.on('hafenfest:abbau', () => aufbau([]));
  game.on('stege', () => { if (an('schmuck')) baueKette(); });
  game.on('stufe', () => setTimeout(() => { if (an('schmuck')) baueKette(); }, 100));

  let zeit = 0;
  let takt = 0;
  game.onTick?.((dt) => {
    if (!kette.visible || !basis.length) return;
    zeit += Math.min(0.1, dt || 0);
    if (++takt % 3) return;      // jedes dritte Bild reicht fürs Flattern
    setzeWimpel(zeit);
  });

  game.festDeko = {
    gruppe,
    stand: () => ({
      teile: [...teile], wimpel: kette.visible ? wimpel.count : 0, masten: kette.visible ? masten.children.length / 2 : 0,
      buehne: !!buehneObj.visible && !!buehneObj.parent && an('musik'), markt: markt.filter((m) => m.visible && m.parent).length * (an('markt') ? 1 : 0),
      lagen: { buehne: buehneObj.visible ? buehneObj.position.toArray() : null, markt: markt.map((m) => (m.visible ? m.position.toArray() : null)) },
    }),
  };
  return game.festDeko;
}
