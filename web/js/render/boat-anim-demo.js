// Vorfuehrung der Schiffsanimationen mit einfachen Platzhalterbooten.
// Start: index.html?demo=boote (nur wenn render/boat-anim.js in main.js angemeldet ist).
// Die Boote hier sind absichtlich schlicht, sie zeigen nur die benannten Teile, die das
// Animationsmodul versteht (siehe docs/schiffsanimationen.md). Die echten Modelle bauen die
// Schiffs-Threads in render/boats/*.js.
import * as THREE from 'three';
import { addBoat } from './boat-anim.js';

const U = 0.62;
const STEG_X = -60 * U;        // Steg A der Platzhalter-Landschaft, Deck von z = 0 bis z = -18

const mat = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
const M = {
  white: mat('#fffcf6'), navy: mat('#2f4a6b'), red: mat('#c8553d'), wood: mat('#b98552'),
  dark: mat('#40404a'), sail: mat('#fbf6ea', { side: THREE.DoubleSide }),
  brown: mat('#9b5a3c', { side: THREE.DoubleSide }), cover: mat('#3f6e8c'),
  fender: mat('#2d5d8a'), flag: mat('#d64541', { side: THREE.DoubleSide }), smoke: mat('#e9eef2', { transparent: true, opacity: 0.8 }),
  deck: mat('#e6cfa5'), stone: mat('#b9b2a6'),
};

// Rumpf als Draufsicht-Umriss (Bug bei +x), nach unten extrudiert
function hull(L, B, fb, draft, color, bow = 0.62) {
  const s = new THREE.Shape();
  s.moveTo(-L / 2, -B * 0.42);
  s.lineTo(L * (bow - 0.5), -B / 2);
  s.quadraticCurveTo(L * 0.45, -B * 0.42, L / 2, 0);
  s.quadraticCurveTo(L * 0.45, B * 0.42, L * (bow - 0.5), B / 2);
  s.lineTo(-L / 2, B * 0.42);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: fb + draft, bevelEnabled: false, curveSegments: 6 });
  g.rotateX(Math.PI / 2);
  g.translate(0, fb, 0);
  const m = new THREE.Mesh(g, color);
  m.name = 'hull';
  const d = new THREE.Mesh(new THREE.ShapeGeometry(s, 6).rotateX(Math.PI / 2), M.deck);
  d.position.y = fb + 0.01;
  d.scale.set(0.92, 1, 0.85);
  const grp = new THREE.Group();
  grp.add(m, d);
  return grp;
}

function triangle(a, b, c, material) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c], 3));
  g.computeVertexNormals();
  return new THREE.Mesh(g, material);
}

// Mast mit Baum und Grosssegel. Gruppe 'boom' dreht um den Mast, Segel 'sail-...' wird nach unten geborgen.
function rig(group, x, h, boomLen, fb, material = M.sail, name = 'main', cover = true) {
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05 + h * 0.004, 0.06 + h * 0.005, h, 6), M.dark);
  mast.position.set(x, fb + h / 2, 0);
  group.add(mast);
  const boom = new THREE.Group();
  boom.name = `boom-${name}`;
  boom.position.set(x, fb + h * 0.1, 0);
  const spar = new THREE.Mesh(new THREE.BoxGeometry(boomLen, 0.08, 0.08), M.dark);
  spar.position.x = -boomLen / 2;
  boom.add(spar);
  const sail = triangle([0, 0.05, 0], [-boomLen, 0.05, 0], [0, h * 0.88, 0], material);
  sail.name = `sail-${name}`;
  boom.add(sail);
  if (cover) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(boomLen * 0.9, 0.22, 0.26), M.cover);
    c.name = `cover-${name}`;
    c.position.set(-boomLen * 0.47, 0.12, 0);
    boom.add(c);
  }
  group.add(boom);
  return mast;
}

function fenders(group, L, B, fb, n) {
  for (let i = 0; i < n; i++) {
    for (const s of [-1, 1]) {
      const f = new THREE.Group();
      f.name = `fender-${i}-${s > 0 ? 'stb' : 'bb'}`;
      f.position.set(-L * 0.3 + (i * L * 0.6) / Math.max(1, n - 1), fb, s * (B / 2 + 0.1));
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.1 + B * 0.02, 0.1 + B * 0.02, 0.5 + B * 0.05, 6), M.fender);
      body.position.y = -0.3;
      f.add(body);
      group.add(f);
    }
  }
}

function flag(group, x, y, size = 0.5) {
  const f = new THREE.Group();
  f.name = 'flag';
  f.position.set(x, y, 0);
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(size, size * 0.6), M.flag);
  cloth.position.x = -size / 2;
  f.add(cloth);
  group.add(f);
}

function boatGroup(id, data) {
  const g = new THREE.Group();
  g.name = id;
  g.userData.boat = data;
  g.userData.pick = { type: 'boat', id };
  return g;
}

function dinghy() {
  const L = 4.6, B = 1.7, fb = 0.4;
  const g = boatGroup('demo-jolle', { size: 'S', length: L, beam: B, draft: 0.2, kind: 'sail' });
  g.add(hull(L, B, fb, 0.2, M.white, 0.55));
  rig(g, L * 0.12, 5.4, 2.6, fb);
  fenders(g, L, B, fb, 2);
  return g;
}

function rowboat() {
  const L = 3.4, B = 1.3, fb = 0.35;
  const g = boatGroup('demo-ruderboot', { size: 'S', length: L, beam: B, draft: 0.15, kind: 'row' });
  g.add(hull(L, B, fb, 0.15, M.wood, 0.6));
  for (const s of [1, -1]) {
    const oar = new THREE.Group();
    oar.name = s > 0 ? 'oar-port' : 'oar-stbd';
    oar.position.set(0, fb + 0.05, -s * B * 0.45);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 2.2), M.wood);
    blade.position.z = -s * 1.0;
    blade.rotation.y = 0.15 * s;
    oar.add(blade);
    g.add(oar);
  }
  fenders(g, L, B, fb, 1);
  return g;
}

function motorboat() {
  const L = 7.2, B = 2.6, fb = 0.7;
  const g = boatGroup('demo-motorboot', { size: 'M', length: L, beam: B, draft: 0.6, kind: 'motor' });
  g.add(hull(L, B, fb, 0.6, M.white, 0.5));
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(L * 0.35, 0.8, B * 0.7), M.navy);
  cabin.position.set(L * 0.05, fb + 0.4, 0);
  g.add(cabin);
  flag(g, -L / 2 + 0.1, fb + 1.0, 0.45);
  fenders(g, L, B, fb, 2);
  return g;
}

function yacht() {
  const L = 12, B = 3.9, fb = 1.0;
  const g = boatGroup('demo-yacht', { size: 'L', length: L, beam: B, draft: 1.9, kind: 'sail' });
  g.add(hull(L, B, fb, 0.8, M.navy, 0.58));
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(L * 0.3, 0.5, B * 0.6), M.white);
  cabin.position.set(0, fb + 0.25, 0);
  g.add(cabin);
  rig(g, L * 0.08, 15, 4.6, fb);
  // Rollfock: Ursprung am Hals (vorne), wird nach vorne eingerollt
  const jib = triangle([0, 0, 0], [-L * 0.4, 0.4, 0], [-L * 0.38, 13.5, 0], M.sail);
  jib.name = 'sail-jib';
  jib.userData.furl = 'x';
  jib.position.set(L * 0.47, fb + 0.2, 0);
  g.add(jib);
  const radar = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.15, 0.25), M.white);
  radar.name = 'radar';
  radar.position.set(L * 0.08, fb + 6, 0);
  g.add(radar);
  flag(g, -L / 2 + 0.1, fb + 1.4, 0.6);
  fenders(g, L, B, fb, 3);
  return g;
}

function tallship() {
  const L = 32, B = 7, fb = 2.4;
  const g = boatGroup('demo-traditionssegler', { size: 'XL', length: L, beam: B, draft: 3.2, kind: 'sail' });
  g.add(hull(L, B, fb, 1.2, mat('#2b2b33'), 0.6));
  const house = new THREE.Mesh(new THREE.BoxGeometry(L * 0.2, 1.2, B * 0.5), M.wood);
  house.position.set(-L * 0.25, fb + 0.6, 0);
  g.add(house);
  rig(g, L * 0.2, 24, 9, fb, M.brown, 'fore', false);
  rig(g, -L * 0.12, 26, 11, fb, M.brown, 'main', false);
  flag(g, -L / 2 + 0.3, fb + 3, 1.6);
  fenders(g, L, B, fb, 4);
  return g;
}

function cruiseShip() {
  const L = 140, B = 22, fb = 9;
  const g = boatGroup('demo-kreuzfahrtschiff', { size: 'XXL', length: L, beam: B, draft: 6, kind: 'ship' });
  g.add(hull(L, B, fb, 4, M.white, 0.65));
  for (let i = 0; i < 4; i++) {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(L * (0.7 - i * 0.1), 2.6, B * 0.8), i % 2 ? M.navy : M.white);
    deck.position.set(-L * 0.05, fb + 1.3 + i * 2.6, 0);
    g.add(deck);
  }
  const funnel = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 6, 8), M.red);
  funnel.position.set(-L * 0.25, fb + 13, 0);
  g.add(funnel);
  const smoke = new THREE.Mesh(new THREE.SphereGeometry(2.5, 8, 6), M.smoke);
  smoke.name = 'smoke';
  smoke.position.set(-L * 0.27, fb + 18, 0);
  g.add(smoke);
  const radar = new THREE.Mesh(new THREE.BoxGeometry(3, 0.4, 0.6), M.dark);
  radar.name = 'radar';
  radar.position.set(L * 0.15, fb + 13, 0);
  g.add(radar);
  return g;
}

// Kulisse fuer die Vorfuehrung: Heckpfaehle der Boxen und ein Stueck Kai
function scenery(game) {
  const grp = new THREE.Group();
  grp.name = 'boat-anim-demo';
  const pile = new THREE.CylinderGeometry(0.14, 0.14, 2, 6);
  const addPile = (x, z) => { const p = new THREE.Mesh(pile, M.dark); p.position.set(x, 0, z); grp.add(p); };
  for (const z of [-3.5, -6.5]) { addPile(STEG_X + 0.8 + 5.5, z); }
  for (const z of [-1.5, -4.5]) { addPile(STEG_X - 0.8 - 6.2, z); }
  const kai = new THREE.Mesh(new THREE.BoxGeometry(46, 1.6, 6), M.stone);
  kai.position.set(STEG_X - 40, 0.75, -48);
  grp.add(kai);
  game.scene.add(grp);
}

function waitGame(game, sec) {
  return new Promise((res) => {
    let t = 0;
    const off = game.onTick((dt) => { t += dt; if (t >= sec) { off(); res(); } });
  });
}

async function cycle(game, a, { start, inbound, holdAt, berth, outbound, pause, sail }) {
  for (;;) {
    a.place(start.x, start.z, start.h);
    if (sail) a.setSails(true);
    await a.sailTo(inbound, { sails: sail || undefined });
    if (holdAt) { a.hold(holdAt); await waitGame(game, 5); }
    await a.dock(berth);
    await waitGame(game, pause);
    await a.undock(outbound, { sails: sail });
    await waitGame(game, 2);
  }
}

// Echte Modelle der Schiffs-Threads nehmen, wenn sie geladen sind, sonst die Platzhalter
function real(game, size, kind, fallback) {
  const t = game.boatTypes?.[size];
  if (!t?.buildBoat || !t.MODELS?.length) return fallback();
  for (const m of t.MODELS) {
    try {
      const g = t.buildBoat(m, { palette: 0, sails: kind === 'sail' });
      if ((g.userData.boat?.kind ?? 'motor') === kind) return g;
    } catch (e) { console.warn('Demo: Modell', m.id, e); }
  }
  return fallback();
}

export function startDemo(game) {
  scenery(game);
  game.camera.setHome?.(STEG_X - 4, -24, 90);
  game.camera.reset?.();

  const jolle = addBoat(game, dinghy());
  cycle(game, jolle, {
    start: { x: STEG_X + 40, z: -40, h: Math.PI * 0.8 }, sail: true,
    inbound: [{ x: STEG_X + 20, z: -28 }, { x: STEG_X + 14, z: -16 }],
    holdAt: { x: STEG_X + 14, z: -16 },
    berth: { x: STEG_X + 0.8 + 2.75, z: -5, heading: Math.PI, kind: 'box', length: 5.5, width: 3 },
    outbound: [{ x: STEG_X + 16, z: -20 }, { x: STEG_X + 45, z: -45 }], pause: 10,
  });

  const ruder = addBoat(game, rowboat());
  cycle(game, ruder, {
    start: { x: STEG_X - 40, z: -14, h: 0 },
    inbound: [{ x: STEG_X - 22, z: -12 }],
    berth: { x: STEG_X - 0.8 - 3.1, z: -3, heading: 0, kind: 'box', length: 6.2, width: 3 },
    outbound: [{ x: STEG_X - 20, z: -16 }, { x: STEG_X - 42, z: -18 }], pause: 7,
  });

  const motor = addBoat(game, real(game, 'm', 'motor', motorboat));
  setTimeout(() => cycle(game, motor, {
    start: { x: STEG_X + 50, z: -10, h: Math.PI },
    inbound: [{ x: STEG_X + 25, z: -10 }],
    berth: { x: STEG_X + 0.8 + 4.5, z: -11, heading: Math.PI, kind: 'box', length: 9, width: 3.9 },
    outbound: [{ x: STEG_X + 20, z: -4 }, { x: STEG_X + 55, z: -2 }], pause: 9,
  }), 3000);

  const yacht12 = addBoat(game, real(game, 'l', 'sail', yacht));
  setTimeout(() => cycle(game, yacht12, {
    start: { x: STEG_X - 10, z: -75, h: -Math.PI / 2 }, sail: true,
    inbound: [{ x: STEG_X - 8, z: -40 }, { x: STEG_X - 14, z: -32 }],
    berth: { x: STEG_X - 0.8 - 2.3, z: -12.5, heading: -Math.PI / 2, kind: 'stirn', length: 12, width: 4.4, side: -1 },
    outbound: [{ x: STEG_X - 6, z: -40 }, { x: STEG_X + 10, z: -80 }], pause: 12,
  }), 1500);

  const tall = addBoat(game, tallship());
  setTimeout(() => cycle(game, tall, {
    start: { x: STEG_X - 160, z: -20, h: 0 }, sail: true,
    inbound: [{ x: STEG_X - 110, z: -24 }],
    berth: { x: STEG_X - 40, z: -48 + 3 + 3.5 + 0.6, heading: 0, kind: 'kai', length: 32, width: 7, side: -1 },
    outbound: [{ x: STEG_X - 10, z: -30 }, { x: STEG_X + 30, z: -60 }, { x: STEG_X + 60, z: -160 }], pause: 14,
  }), 500);

  const cruise = addBoat(game, cruiseShip());
  (async () => {
    for (;;) {
      cruise.place(STEG_X - 400, -170, 0);
      await cruise.sailTo([{ x: STEG_X, z: -175 }, { x: STEG_X + 400, z: -170 }]);
    }
  })();

  // Ereignisse in der Konsole, damit man sieht, was der Ton-Thread bekommt
  for (const n of ['boat:line', 'boat:sails', 'boat:moored', 'boat:cast-off', 'boat:left', 'boat:horn', 'boat:hold']) {
    game.on(n, (d) => console.debug(n, d.id, d.on ?? d.up ?? d.reason ?? ''));
  }
}
