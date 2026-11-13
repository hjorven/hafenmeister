// Schiffsanimationen fuer alle Groessen: Schaukeln, Fahren auf einem Kurs, Segel bergen und setzen,
// Fender, Anlegen mit fliegenden Leinen, Ablegen (rueckwaerts aus der Box oder seitlich vom Kai),
// Warten vor den Stegen, Bugwelle und Kielwasser, Querstrahlruder-Schaum bei grossen Schiffen.
//
// Schnittstelle und Beispiele: docs/schiffsanimationen.md
//
// Kurz:
//   import { addBoat, berthFromPlatz } from '../boat-anim.js';
//   const a = addBoat(game, gruppe);              // gruppe: THREE.Group, Bug zeigt nach lokal +x
//   await a.sailTo([{ x, z }, ...]);              // Kurs abfahren
//   await a.dock(berthFromPlatz(platz, stufe));   // anlegen, Leinen fest
//   await a.undock([{ x, z }, ...], { remove: true });
//
// Das Modul rechnet ohne Speicheranforderungen pro Bild (wichtig fuer Handys) und haengt sich mit
// einem einzigen game.onTick an die Spielschleife.
import * as THREE from 'three';
import { Engstellen } from './boat-channel.js';

const U = 0.62;               // Meter je Planeinheit (wie main.js und harbor.js)
const TAU = Math.PI * 2;

// Fahrverhalten und Seegang je Groesse. Geschwindigkeiten in m/s Spielzeit.
export const SIZES = {
  S:   { cruise: 2.4, harbor: 1.5, accel: 0.8,  turn: 1.1,  heave: 0.10, roll: 0.10,  pitch: 0.05,  period: 2.4, trim: 0.06 },
  M:   { cruise: 2.8, harbor: 1.5, accel: 0.6,  turn: 0.75, heave: 0.09, roll: 0.065, pitch: 0.035, period: 3.0, trim: 0.05 },
  L:   { cruise: 3.2, harbor: 1.4, accel: 0.45, turn: 0.5,  heave: 0.08, roll: 0.045, pitch: 0.025, period: 3.8, trim: 0.03 },
  XL:  { cruise: 3.4, harbor: 1.2, accel: 0.25, turn: 0.25, heave: 0.06, roll: 0.02,  pitch: 0.012, period: 5.0, trim: 0.0 },
  XXL: { cruise: 3.8, harbor: 1.0, accel: 0.12, turn: 0.12, heave: 0.04, roll: 0.008, pitch: 0.005, period: 7.0, trim: 0.0 },
};

const BOX_KINDS = new Set(['box', 'finger']);

function sizeFor(length) {
  if (length <= 6) return 'S';
  if (length <= 9) return 'M';
  if (length <= 14) return 'L';
  if (length <= 40) return 'XL';
  return 'XXL';
}

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (t) => t * t * (3 - 2 * t);
const wrapAngle = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
const approach = (v, target, step) => (v < target ? Math.min(v + step, target) : Math.max(v - step, target));

// ---------------------------------------------------------------------------------------------
// Liegeplatz aus harbor.js umrechnen

/**
 * Wandelt einen Eintrag aus HAFEN.plaetze (web/js/data/harbor.js) in einen Liegeplatz fuer dock().
 * hafen (optional, das HAFEN-Objekt) bestimmt bei Laengsseits-Plaetzen, auf welcher Seite der Steg liegt.
 */
export function berthFromPlatz(platz, stufe, hafen) {
  const lagen = platz.lage ?? {};
  const lage = lagen[stufe] ?? lagen[String(stufe)] ?? Object.values(lagen).at(-1);
  if (!lage) throw new Error(`Liegeplatz ${platz.id} hat keine Lage`);
  const [px, py, deg] = lage;
  const heading = (deg * Math.PI) / 180;
  const berth = {
    id: platz.id,
    x: px * U,
    z: -py * U,
    heading,
    kind: platz.art ?? 'box',
    length: (platz.laenge ?? 10) * U,
    width: (platz.breite ?? 5) * U,
    side: 1,
  };
  if (hafen && !BOX_KINDS.has(berth.kind)) {
    const side = sideFromStege(hafen, stufe, platz.steg, px, py, heading);
    if (side) berth.side = side;
  }
  return berth;
}

// Naechster Punkt auf den Steglinien derselben Stufe: liegt er rechts vom Bug, ist side = +1 (Steuerbord).
function sideFromStege(hafen, stufe, steg, px, py, heading) {
  const st = hafen.stufen?.[stufe] ?? hafen.stufen?.[String(stufe)];
  if (!st?.stege) return 0;
  let best = Infinity, qx = 0, qy = 0;
  const lines = st.stege.filter((s) => s.steg === steg);
  for (const s of lines.length ? lines : st.stege) {
    const p = s.punkte ?? [];
    for (let i = 0; i + 1 < p.length; i++) {
      const [ax, ay] = p[i], [bx, by] = p[i + 1];
      const dx = bx - ax, dy = by - ay;
      const l2 = dx * dx + dy * dy || 1;
      const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
      const cx = ax + dx * t, cy = ay + dy * t;
      const d = (cx - px) ** 2 + (cy - py) ** 2;
      if (d < best) { best = d; qx = cx; qy = cy; }
    }
  }
  if (best === Infinity) return 0;
  // in Weltkoordinaten: x = x * U, z = -y * U; Steuerbord = (sin h, cos h)
  const wx = (qx - px) * U, wz = -(qy - py) * U;
  const dot = wx * Math.sin(heading) + wz * Math.cos(heading);
  return dot >= 0 ? 1 : -1;
}

function normBerth(b) {
  return {
    id: b.id,
    x: b.x, z: b.z,
    heading: b.heading ?? 0,
    kind: b.kind ?? 'box',
    length: b.length ?? 8,
    width: b.width ?? 4,
    side: b.side === -1 || b.side === 'port' ? -1 : 1,
    deck: b.deck ?? (b.kind === 'kai' || b.kind === 'pier' ? 1.5 : b.kind === 'buoy' ? 0.25 : 0.86),
    bollards: b.bollards,
    abstand: b.abstand,
    kreis: b.kreis,
  };
}

// ---------------------------------------------------------------------------------------------
// Benannte Teile im Modell

function collectParts(model) {
  const parts = {
    sails: [], booms: [], covers: [], fenders: [], flags: [], radars: [],
    spinners: [], oars: [], smoke: [], cleats: {}, ownWake: false,
  };
  const taken = new Map();
  const RE = /^(sail|boom|cover|fender|flag|radar|prop|paddle|oar|smoke)/;
  model.traverse((o) => {
    const n = (o.name || '').toLowerCase();
    if (!n || o === model) return;
    // Teil in einem gleichartigen Teil (z. B. Mesh 'fender' in Gruppe 'fenders') nicht doppelt bewegen;
    // Segel im Baum ('sail-main' in 'boom') werden dagegen beide erfasst
    const cat = n.match(RE)?.[1];
    for (let p = o.parent; cat && p && p !== model; p = p.parent) if (taken.get(p) === cat) return;
    if (cat) taken.set(o, cat);
    const rec = { o, s: o.scale.clone(), r: o.rotation.clone(), p: o.position.clone() };
    if (n.startsWith('sail')) parts.sails.push(rec);
    else if (n.startsWith('boom')) parts.booms.push(rec);
    else if (n.startsWith('cover')) parts.covers.push(rec);
    else if (n.startsWith('fender')) parts.fenders.push(rec);
    else if (n.startsWith('flag')) parts.flags.push(rec);
    else if (n.startsWith('radar')) parts.radars.push(rec);
    else if (n.startsWith('prop') || n.startsWith('paddle')) parts.spinners.push(rec);
    else if (n.startsWith('oar')) { rec.side = n.includes('stb') ? -1 : 1; parts.oars.push(rec); }
    else if (n.startsWith('smoke')) parts.smoke.push(rec);
    else if (n === 'wake' || n.startsWith('wake-')) parts.ownWake = true;
    else if (n.startsWith('cleat')) parts.cleats[n] = o;
  });
  return parts;
}

// ---------------------------------------------------------------------------------------------
// Gemeinsame Geometrien (einmal je Spiel)

function makeWakeGeometry() {
  // V-foermige Heckwelle: Spitze am Bug (0,0), Arme nach hinten bis x = -1, z = +-1.
  // Dazu ein Streifen Schraubenwasser in der Mitte. Vierte Farbkomponente = Deckkraft.
  const pos = [], col = [], idx = [];
  const add = (x, z, a) => { pos.push(x, 0, z); col.push(1, 1, 1, a); return pos.length / 3 - 1; };
  const arm = (s) => {
    const a0 = add(0.02, s * 0.05, 0.9), a1 = add(0.0, s * 0.16, 0.9);
    const b0 = add(-1.0, s * 0.92, 0.0), b1 = add(-1.0, s * 1.0, 0.0);
    // Dreiecke muessen von oben gesehen gegen den Uhrzeigersinn laufen (Vorderseite nach oben),
    // sonst schneidet die Grafik sie weg: der gespiegelte Backbord-Arm braucht die umgekehrte Reihenfolge.
    if (s > 0) idx.push(a0, b0, a1, a1, b0, b1);
    else idx.push(a0, a1, b0, a1, b1, b0);
  };
  arm(1); arm(-1);
  const c0 = add(-0.45, 0.12, 0.7), c1 = add(-0.45, -0.12, 0.7);
  const c2 = add(-1.05, 0.28, 0.0), c3 = add(-1.05, -0.28, 0.0);
  idx.push(c0, c1, c2, c1, c3, c2);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  g.setIndex(idx);
  return g;
}

function defaultShelter(x, z) {
  // Ostsee nordlich der Nehrung (Platzhalter-Landschaft): voller Seegang, Binnensee geschuetzt.
  return z < -186 * U ? 1 : 0.4;
}

// ---------------------------------------------------------------------------------------------
// Verwaltung je Spiel

class BoatAnimManager {
  constructor(game) {
    this.game = game;
    this.boats = new Set();
    this.hindernisse = new Set();                     // fremde Schiffe (Besuchsschiffe der Services)
    this.router = null;                               // (boat, ziel) => { punkte, engstellen }, setzt boat-view.js
    this.frei = null;                                 // (x, z, r) => true, wenn dort freies Wasser ist
    this.sicht = null;                                // (a, b, r, t) => true, wenn die Strecke a-b frei ist
    this.engstellen = new Engstellen(3);              // Einbahn-Freigabe in engen Durchfahrten
    this.sea = 0.25;                                  // 0 = glatt, 1 = Sturm
    this.wind = { from: (250 * Math.PI) / 180, strength: 0.5 };  // aus Westsuedwest
    this.shelter = defaultShelter;                    // (x, z) => 0..1, Landschaft darf ersetzen
    this.frame = 0;
    this.lowPower = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

    this.root = new THREE.Group();
    this.root.name = 'boat-anim';
    game.scene.add(this.root);

    this.lineMat = new THREE.LineBasicMaterial({ color: '#f1e7d0' });
    this.wakeGeo = makeWakeGeometry();
    this.wakeMat = new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.75, depthWrite: false,
    });
    this.foamGeo = new THREE.CircleGeometry(1, 14).rotateX(-Math.PI / 2);
    this.foamMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false });

    game.onTick((dt) => this.tick(dt));
  }

  // Sichtbarer Ausschnitt der Kamera, fuer Start und Ziel ausserhalb des Bildes und den Zeitraffer
  updateView() {
    const cam = this.game.camera?.camera;
    if (!cam) { this.view = null; return; }
    cam.updateMatrixWorld();
    _pm.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    (this.view ||= new THREE.Frustum()).setFromProjectionMatrix(_pm);
  }

  /** Liegt ein Kreis (x, z, r) ganz oder teilweise im Bild? Ohne Kamera immer true. */
  inView(x, z, r = 5) {
    if (!this.view) return true;
    _sph.center.set(x, 1, z);
    _sph.radius = r + 2;
    return this.view.intersectsSphere(_sph);
  }

  // Verkehr: Boote halten Abstand. Wer hinter einem anderen in dieselbe Richtung faehrt, bremst.
  // Liegt etwas im Weg (entgegenkommend, querend oder still), weicht das Boot seitlich aus
  // (entgegen: beide nach Steuerbord) und wird langsamer. Wer naeher am Ziel ist, hat Vorfahrt.
  traffic(dt) {
    const list = [];
    for (const b of this.boats) {
      if (b.model.visible === false) continue;
      list.push(b);
    }
    const andere = list.concat([...this.hindernisse].filter((h) => h.aktuell()));
    for (const b of list) {
      const mv = b.movingTask();
      if (!mv || b.ghost > 0) {
        b.yieldF = 1;
        b.laneWant = 0;
        b.room = Infinity;
        b.ghost = Math.max(0, b.ghost - dt);
        continue;
      }
      let y = 1, lane = 0, room = Infinity, hinderer = null, hGap = Infinity;
      for (const o of andere) {
        if (o === b) continue;
        const hit = b.blockedBy(o);
        if (!hit) continue;
        // nie in ein anderes Boot hineinfahren, auch mit Vorfahrt nicht (Platz bis zum anderen Rumpf)
        room = Math.min(room, hit.gap);
        if (hit.gap < hGap) { hGap = hit.gap; hinderer = o; }
        if (o.movingTask() && o.ghost <= 0 && o.blockedBy(b) && b.priorityOver(o)) {
          // beide stehen sich im Weg: wer Vorfahrt hat, faehrt und weicht dabei aus, das andere wartet
          if (hit.lane && Math.abs(hit.lane) > Math.abs(lane)) lane = hit.lane;
          continue;
        }
        y = Math.min(y, hit.y);
        if (hit.lane && Math.abs(hit.lane) > Math.abs(lane)) lane = hit.lane;
      }
      b.yieldF = y;
      b.laneWant = lane;
      b.room = room;
      b.hinderer = hinderer ?? (b.blocked ? b.hitsAt?.(b.x, b.z, b.heading) : null);
      // nie ewig blockieren: nach 12 s Stillstand kurz ohne Verkehrsregeln weiter, aber nur bei echter
      // gegenseitiger Blockade. Steht das Boot nur in einer Schlange hinter Booten, die selbst warten
      // (Engstelle, Box noch belegt) oder fahren, wartet es weiter und schiebt sich nie hinein.
      b.blockedFor = (y < 0.08 || room < 0.6 || b.blocked) && b.speed < 0.1 ? b.blockedFor + dt : 0;
      if (b.blockedFor > 12) {
        if (this.festgefahren(b)) { b.ghost = 4; b.durchlaesse = (b.durchlaesse ?? 0) + 1; }
        b.blockedFor = 0;
      }
    }
  }

  /** Haengt b in einem Kreis gegenseitiger Blockade fest (A wartet auf B wartet auf A)? */
  festgefahren(b) {
    let o = b.hinderer;
    for (let i = 0; i < 8 && o; i++) {
      if (o === b) return true;                       // Kreis: niemand kommt weiter
      if (o instanceof Hindernis) return false;       // fremdes Schiff faehrt weiter, warten
      if (!o.movingTask?.()) return !!(o.moored || o.state === 'waiting') && b.blockedFor > 30;   // liegt fest im Weg
      if ((o.blockedFor ?? 0) < 1) return false;      // vorn faehrt es oder wartet auf Freigabe: Schlange
      o = o.hinderer;
    }
    return false;
  }

  /** Boote und angemeldete Hindernisse, die gerade im Wasser sind */
  alle() {
    if (!this.hindernisse.size) return this.boats;
    return [...this.boats, ...[...this.hindernisse].filter((h) => h.aktuell())];
  }

  add(model, opts) {
    const b = new BoatAnim(this, model, opts);
    this.boats.add(b);
    return b;
  }

  /** Seegang 0 (glatt) bis 1 (Sturm). Fuer Ereignisse wie Sturm. */
  setSea(level) { this.sea = clamp(level, 0, 1); }

  /** Wind: Richtung, aus der er kommt, in Grad (0 = aus Osten, 90 = aus Norden), Staerke 0 bis 1. */
  setWind(fromDeg, strength = this.wind.strength) {
    this.wind.from = (fromDeg * Math.PI) / 180;
    this.wind.strength = clamp(strength, 0, 1);
  }

  tick(dt) {
    this.frame++;
    const t = this.game.time;
    this.updateView();
    if (dt > 0) this.traffic(dt);
    for (const b of this.boats) b.update(dt, t);

  }
}

const _pm = new THREE.Matrix4();
const _sph = new THREE.Sphere();
const managers = new WeakMap();
function manager(game) {
  let m = managers.get(game);
  if (!m) {
    m = new BoatAnimManager(game);
    managers.set(game, m);
    game.boatAnim = {
      add: (model, opts) => m.add(model, opts),
      setSea: (l) => m.setSea(l),
      setWind: (d, s) => m.setWind(d, s),
      setShelter: (fn) => { m.shelter = fn || defaultShelter; },
      berthFromPlatz,
      // Fremdes Schiff (z. B. Kreuzfahrtschiff der Services) als Hindernis anmelden: Boote weichen aus,
      // warten davor und fahren nie hinein. Gibt eine Funktion zum Abmelden zurueck.
      hindernis: (group, opts) => {
        const h = new Hindernis(m, group, opts);
        m.hindernisse.add(h);
        return () => m.hindernisse.delete(h);
      },
      imBild: (x, z, r) => m.inView(x, z, r),
      // Fahrwege aus der Karte: fn(boat, ziel, opts) => { punkte, engstellen }. Neue Karte: engstellenNeu().
      setRouter: (fn) => { m.router = fn || null; },
      setFrei: (fn) => { m.frei = fn || null; },
      setSicht: (fn) => { m.sicht = fn || null; },
      engstellenNeu: () => m.engstellen.reset(),
      get engstellen() { return m.engstellen; },
      get boats() { return [...m.boats]; },
      get sea() { return m.sea; },
      get wind() { return { fromDeg: (m.wind.from * 180) / Math.PI, strength: m.wind.strength }; },
    };
  }
  return m;
}

/** Wird von main.js aufgerufen, wenn das Modul angemeldet ist. Startet die Vorfuehrung mit ?demo=boote. */
export function init(game) {
  manager(game);
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
  if (q && q.get('demo') === 'boote') {
    import('./boat-anim-demo.js').then((m) => m.startDemo(game)).catch((e) => console.error(e));
  }
}

/** Ein Boot anmelden. model: THREE.Object3D, Bug nach lokal +x, Wasserlinie y = 0. */
export function addBoat(game, model, opts) {
  return manager(game).add(model, opts);
}

// ---------------------------------------------------------------------------------------------
// Aufgaben, die ein Boot nacheinander abarbeitet. step() gibt true zurueck, wenn fertig.

const _v = new THREE.Vector3();
const _t = new THREE.Vector3();

// Fremdes Schiff, das ein anderes Modul bewegt. Verhaelt sich fuer den Verkehr wie ein Boot ohne Auftrag.
let hindernisNr = 0;
const _hp = new THREE.Vector3();
const _hq = new THREE.Quaternion();
const _he = new THREE.Euler();
class Hindernis {
  constructor(mgr, group, opts = {}) {
    this.mgr = mgr;
    this.group = group;
    this.model = group;
    this.id = `hindernis-${++hindernisNr}`;
    let L = opts.laenge, B = opts.breite;
    if (!L || !B) {
      // Masse aus dem Modell (Bug nach lokal +x), ohne Drehung gemessen
      const r = group.rotation.y;
      group.rotation.y = 0;
      group.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(group);
      group.rotation.y = r;
      group.updateMatrixWorld(true);
      L ||= box.max.x - box.min.x;
      B ||= box.max.z - box.min.z;
    }
    this.info = { length: Math.max(1, L), beam: Math.max(0.5, B), size: 'XXL' };
    this.ghost = 0;
    this.reverse = false;
    this.berth = null;
    this.moored = false;
    this.speed = 0;
    this.x = 0; this.z = 0; this.heading = 0;
    this.frame = -1;
    this.t = 0;
  }
  /** sichtbar und im Wasser? Aktualisiert dabei Lage und Fahrt einmal je Bild. */
  aktuell() {
    let o = this.group;
    while (o) { if (o.visible === false) return false; o = o.parent; }
    if (!this.group.parent) return false;
    if (this.frame !== this.mgr.frame) {
      const now = performance.now();
      this.group.getWorldPosition(_hp);
      this.group.getWorldQuaternion(_hq);
      _he.setFromQuaternion(_hq, 'YXZ');
      const dt = this.t > 0 ? (now - this.t) / 1000 : 0;
      const d = Math.hypot(_hp.x - this.x, _hp.z - this.z);
      this.speed = dt > 0 && dt < 1 ? d / dt : 0;
      this.x = _hp.x; this.z = _hp.z; this.heading = _he.y;
      this.frame = this.mgr.frame;
      this.t = now;
    }
    return true;
  }
  pose() { return { x: this.x, z: this.z, h: this.heading }; }
  movingTask() { return null; }
}

// Abstand Bootsmitte zur Boje oder zum Anker. Auf einem Ankerplatz mit Schwoikreis bleibt der ganze
// Rumpf im Kreis, so beruehren sich Boote auf benachbarten Ankerplaetzen bei keinem Wind.
function bojenAbstand(b, L) {
  const frei = L / 2 + 1.5;
  if (!Number.isFinite(b?.kreis)) return frei;
  return clamp(b.kreis - L / 2 - 0.5, 0, frei);
}

function hull(x, z, h, L, B) {
  const fx = Math.cos(h), fz = -Math.sin(h), px = -fz, pz = fx, l = L / 2, w = B / 2;
  return [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([i, j]) => [x + fx * l * i + px * w * j, z + fz * l * i + pz * w * j]);
}
function sat(A, B) {
  for (const P of [A, B]) for (let i = 0; i < 4; i++) {
    const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % 4];
    const nx = y2 - y1, ny = x1 - x2;
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (const [x, y] of A) { const d = x * nx + y * ny; a0 = Math.min(a0, d); a1 = Math.max(a1, d); }
    for (const [x, y] of B) { const d = x * nx + y * ny; b0 = Math.min(b0, d); b1 = Math.max(b1, d); }
    if (a1 < b0 || b1 < a0) return false;
  }
  return true;
}

class PathTask {
  constructor(points, opts) { this.points = points; this.opts = opts; }
  start(b) {
    this.pivot = false;
    this.eng = null;
    // Fahrweg aus der Karte (world/fahrwasser.js): vom jetzigen Ort bis zum ersten festen Punkt,
    // erst jetzt berechnet, weil das Boot erst jetzt weiss, wo es nach dem Ablegen steht.
    if (this.opts.route && b.mgr.router && this.points.length) {
      if (!this.fest) this.fest = this.points.slice();
      this.routeEpoche = b.mgr.engstellen.epoche;
      const r = b.mgr.router(b, this.fest[0], this.opts.route);
      if (r?.punkte?.length) {
        const weg = r.punkte.slice();
        const last = weg[weg.length - 1];
        if (Math.hypot(last.x - this.fest[0].x, last.z - this.fest[0].z) < 0.5) weg.pop();
        this.points = [...weg, ...this.fest];
        // Engstellen erst ab einer Bootslaenge Weg (wer schon drin ist, faehrt hinaus)
        const L = b.info.length;
        this.eng = (r.engstellen ?? []).filter((e) => e.ein > L).map((e) => ({ ...e, frei: false, epoche: b.mgr.engstellen.epoche }));
        if (!this.eng.length) this.eng = null;
      }
    }
    const first = this.points[0];
    if (!first) { this.curve = null; return; }
    const dx = first.x - b.x, dz = first.z - b.z;
    const want = Math.atan2(-dz, dx);
    if (Math.hypot(dx, dz) > b.info.length * 0.5 && Math.abs(wrapAngle(want - b.heading)) > 1.7 && b.speed < 0.4) {
      this.pivot = true;          // erst auf der Stelle drehen, sonst faehrt das Boot eine Schleife
      this.pivotTo = want;
      return;
    }
    this.build(b);
  }
  build(b) {
    const pts = [new THREE.Vector3(b.x, 0, b.z)];
    const first = this.points[0];
    const d = Math.hypot(first.x - b.x, first.z - b.z);
    const lead = Math.min(b.info.length * 1.2, d * 0.4);
    if (lead > 0.3) pts.push(new THREE.Vector3(b.x + Math.cos(b.heading) * lead, 0, b.z - Math.sin(b.heading) * lead));
    for (const p of this.points) {
      const last = pts[pts.length - 1];
      if (Math.hypot(p.x - last.x, p.z - last.z) > 0.05) pts.push(new THREE.Vector3(p.x, 0, p.z));
    }
    if (pts.length < 2) { this.curve = null; return; }
    this.curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    this.curve.arcLengthDivisions = Math.min(400, 40 + pts.length * 30);
    this.len = this.curve.getLength();
    this.s = 0;
    // Weg der Kurve und Weg der Route unterscheiden sich am Anfang um den Vorlauf: s der Kurve gilt
    this.wartet = 0;
  }
  // Einbahn-Freigabe: vor einer Engstelle anfragen; ohne Freigabe davor anhalten. Gibt Hoechsttempo zurueck.
  engstelle(b, dt) {
    const mgr = b.mgr.engstellen;
    const L = b.info.length;
    let max = Infinity;
    for (const e of this.eng) {
      if (e.epoche !== mgr.epoche) continue;
      if (e.frei) {
        if (this.s > e.aus + L * 0.8) { mgr.release(e.nr, b); e.frei = false; e.fertig = true; }
        continue;
      }
      if (e.fertig) continue;
      const bis = e.ein - this.s;                          // Weg bis zur Engstelle
      if (bis > L * 2 + 10) continue;                      // noch weit weg: nicht anfragen
      const dir = e.richtung > 0 ? 'plus' : 'minus';
      if (mgr.request(e.nr, b, dir)) { e.frei = true; b.wartetVorEngstelle = false; continue; }
      // nach 45 s Warten trotzdem fahren (Fehlerfall, z. B. ein Boot wurde entfernt)
      this.wartet += dt;
      if (this.wartet > 45) { e.fertig = true; continue; }
      b.wartetVorEngstelle = true;
      const halt = Math.max(0, bis - L * 0.5 - 2);
      max = Math.min(max, Math.sqrt(2 * b.cfg.accel * 0.8 * halt));
    }
    return max;
  }
  step(b, dt) {
    const o = this.opts;
    // Neue Karte (Steg gekauft, neue Stufe, Gelaende umgebaut): Weg ab hier neu planen
    if (o.route && this.fest && this.routeEpoche !== b.mgr.engstellen.epoche && !this.pivot) {
      const rest = this.len - this.s;
      // die letzten Meter ins Ziel (Anlegen) nicht mehr umplanen
      if (rest > b.info.length * 2) { this.points = this.fest.slice(); this.start(b); return false; }
      this.routeEpoche = b.mgr.engstellen.epoche;
    }
    if (this.pivot) {
      // nicht in ein Nachbarboot hineindrehen: warten, bis es weg ist (hoechstens 8 s)
      this.pivotWait = (this.pivotWait ?? 0) + dt;
      if (this.pivotWait < 8 && b.sweepBlocked()) { b.setSpeed(0, dt); return false; }
      const diff = wrapAngle(this.pivotTo - b.heading);
      const h0 = b.heading, x0 = b.x, z0 = b.z;
      b.steer(this.pivotTo, dt, 1.4);
      // nicht in ein Nachbarboot hineindrehen (hoechstens weitere 8 s warten)
      const vorher = b.hitsAt(x0, z0, h0), nachher = b.hitsAt(b.x, b.z, b.heading);
      if (nachher && nachher !== vorher && this.pivotWait < 16) { b.heading = h0; b.setSpeed(0, dt); return false; }
      // fast auf der Stelle drehen, damit Bug und Heck nicht in die Nachbarboxen schwenken
      b.setSpeed(0.08 * b.cfg.harbor, dt);
      b.advance(b.speed * dt);
      if (Math.abs(diff) < 0.35) { this.pivot = false; this.build(b); }
      return false;
    }
    if (!this.curve) return true;
    const cruise = o.speed ?? (o.harbor ? b.cfg.harbor : b.cfg.cruise);
    const remaining = this.len - this.s;
    this.remaining = remaining;
    let target = cruise * b.yieldF;
    if (this.eng) target = Math.min(target, this.engstelle(b, dt));
    if (o.stop !== false) {
      const brake = Math.max(0.05, b.cfg.accel * 0.6 * (o.brake ?? 1));
      target = Math.min(target, Math.sqrt(2 * brake * remaining) + 0.12);
    }
    b.setSpeed(target, dt, o.brake);
    if (b.yieldF < 0.05) b.speed = approach(b.speed, 0, b.cfg.accel * 2.5 * dt);
    // Rumpf an Rumpf: nur so weit, wie vor dem Bug Platz ist (Seitenversatz darf weiterlaufen)
    let weg = b.speed * dt;
    const platz = (b.room ?? Infinity) - 0.4;
    if (weg > platz) { weg = Math.max(0, platz); b.speed = Math.min(b.speed, weg / Math.max(dt, 1e-3)); }
    const s0 = this.s;
    this.s = Math.min(this.len, this.s + weg);
    const u = this.len > 0 ? this.s / this.len : 1;
    this.curve.getPointAt(u, _v);
    this.curve.getTangentAt(u, _t);
    const hd = Math.atan2(-_t.z, _t.x);
    // Ausweichen: seitlicher Versatz zur Bahn, am Anfang und vor dem Ziel wieder null
    const L = b.info.length;
    const start = clamp(0.5 + this.s / L, 0, 1);
    const fade = o.stop === false ? start : clamp(remaining / (L * 2.5) - 0.2, 0, 1) * start;
    const lane0 = b.lane;
    b.lane = approach(b.lane, b.laneWant * fade, (0.8 + b.info.beam * 0.3) * dt);
    let nx = _v.x + Math.sin(hd) * b.lane, nz = _v.z + Math.cos(hd) * b.lane;
    // Ausweichen nur ueber freies Wasser: nie seitlich auf Land, Steg oder in einen Liegeplatz
    // (der Weg selbst ist frei, der Versatz nicht unbedingt). Sonst Versatz kleiner, notfalls null.
    const frei = b.mgr.frei;
    if (frei && Math.abs(b.lane) > 0.05) {
      const r = b.info.beam / 2 + 0.3, t = Math.min((b.info.draft ?? 1) + 0.2, 9);
      for (let i = 0; i < 4 && Math.abs(b.lane) > 0.05 && !frei(nx, nz, r, t); i++) {
        b.lane = Math.abs(lane0) < Math.abs(b.lane) && i === 0 ? lane0 : b.lane * 0.5;
        nx = _v.x + Math.sin(hd) * b.lane; nz = _v.z + Math.cos(hd) * b.lane;
      }
      if (!frei(nx, nz, r, t) && frei(_v.x, _v.z, r, t)) { b.lane = 0; nx = _v.x; nz = _v.z; }
    }
    // harte Regel: ein fahrendes Boot schiebt sich nie in ein anderes hinein (nicht im Notfall-Durchlass)
    if (this.s > s0 + 1e-4 || b.lane !== lane0) {
      const vorher = b.hitsAt(b.x, b.z, b.heading);
      const nachher = b.hitsAt(nx, nz, hd);
      if (nachher && nachher !== vorher) {
        b.lane = lane0;
        nx = _v.x + Math.sin(hd) * b.lane; nz = _v.z + Math.cos(hd) * b.lane;
        const n2 = b.hitsAt(nx, nz, hd);
        if (n2 && n2 !== vorher) {
          this.s = s0; b.speed = 0;
          this.curve.getPointAt(this.len > 0 ? this.s / this.len : 1, _v);
          b.blocked = true;
          return false;
        }
      }
    }
    b.blocked = false;
    b.x = nx;
    b.z = nz;
    b.steer(hd, dt, 6);
    b.thrusters = o.thrusters ? clamp(1 - remaining / (b.info.length * 1.2), 0, 1) : 0;
    if (remaining < 0.02) {
      if (o.stop !== false) b.speed = 0;
      b.thrusters = 0;
      b.lane = 0;
      return true;
    }
    return false;
  }
}

// Gerade Fahrt ohne Kursaenderung, auch rueckwaerts oder seitlich (Querstrahlruder).
class StraightTask {
  constructor(to, opts) { this.to = to; this.opts = opts; }
  start(b) {
    this.fx = b.x; this.fz = b.z;
    this.len = Math.hypot(this.to.x - b.x, this.to.z - b.z);
    this.s = 0; this.v = 0;
    b.reverse = !!this.opts.reverse;
  }
  step(b, dt) {
    const max = (this.opts.speed ?? b.cfg.harbor * 0.45) * (this.opts.sideways ? 1 : b.yieldF);
    const remaining = this.len - this.s;
    this.remaining = remaining;
    const target = Math.min(max, Math.sqrt(2 * b.cfg.accel * 0.4 * remaining) + 0.05);
    this.v = approach(this.v, target, b.cfg.accel * 0.6 * dt);
    const s0 = this.s;
    this.s = Math.min(this.len, this.s + this.v * dt);
    const u = this.len > 0 ? this.s / this.len : 1;
    const nx = this.fx + (this.to.x - this.fx) * u, nz = this.fz + (this.to.z - this.fz) * u;
    // nie in ein anderes Boot hineinschieben: anhalten, bis es weg ist
    if (this.s > s0) {
      const vorher = b.hitsAt(b.x, b.z, b.heading);
      const nachher = b.hitsAt(nx, nz, b.heading);
      this.halt = nachher && nachher !== vorher ? (this.halt ?? 0) + dt : 0;
      if (this.halt > 0 && this.halt < 10) { this.s = s0; this.v = 0; b.speed = 0; b.blocked = true; return false; }
    }
    b.blocked = false;
    b.x = nx;
    b.z = nz;
    b.speed = this.opts.sideways ? 0.15 : this.v;
    b.thrusters = this.opts.thrusters ? 1 : 0;
    if (this.opts.heading !== undefined) b.steer(this.opts.heading, dt, 1);
    if (remaining < 0.01) { b.speed = 0; b.reverse = false; b.thrusters = 0; return true; }
    return false;
  }
}

class WaitTask {
  constructor(sec) { this.sec = sec; }
  start() { this.t = 0; }
  step(b, dt) { b.setSpeed(0, dt); b.advance(b.speed * dt); this.t += dt; return this.t >= this.sec; }
}

// Auf ein Promise warten, hoechstens timeout Sekunden Spielzeit (z. B. game.people.anBord(id)).
class AwaitTask {
  constructor(make, timeout) { this.make = make; this.timeout = timeout; }
  start(b) {
    this.t = 0; this.done = false;
    try {
      const p = this.make(b);
      if (p && typeof p.then === 'function') p.then(() => { this.done = true; }, () => { this.done = true; });
      else this.done = true;
    } catch { this.done = true; }
  }
  step(b, dt) { this.t += dt; b.setSpeed(0, dt); return this.done || this.t >= this.timeout; }
}

// Warten, bis fn() true liefert (z. B. bis die Box frei ist), hoechstens timeout Sekunden.
class UntilTask {
  constructor(fn, timeout) { this.fn = fn; this.timeout = timeout; }
  start() { this.t = 0; }
  step(b, dt) {
    this.t += dt;
    b.setSpeed(0, dt);
    b.advance(b.speed * dt);
    let ok = true;
    try { ok = !!this.fn(b); } catch { ok = true; }
    return ok || this.t >= this.timeout;
  }
}

class CallTask {
  constructor(fn) { this.fn = fn; }
  start() {}
  step(b) { this.fn(b); return true; }
}

// Leinen werfen (on) oder loswerfen (off), eine nach der anderen.
class LinesTask {
  constructor(on) { this.on = on; }
  start(b) {
    this.i = 0; this.t = 0; this.told = -1;
    if (this.on) b.makeLines();
    this.n = b.lines.length;
    this.order = this.on ? b.lines.map((_, i) => i) : b.lines.map((_, i) => this.n - 1 - i);
  }
  step(b, dt) {
    if (this.i >= this.n) {
      if (!this.on) b.lines.length = 0;
      return true;
    }
    const dur = this.on ? 0.5 : 0.35;
    const line = b.lines[this.order[this.i]];
    if (this.told !== this.i) { this.told = this.i; b.emit('boat:line', { on: this.on, index: this.order[this.i] }); }
    this.t += dt;
    line.p = this.on ? clamp(this.t / dur, 0, 1) : clamp(1 - this.t / dur, 0, 1);
    if (this.t >= dur) {
      // Leine fest: Klick (Modul audio.js), nur beim Festmachen im Spiel, nicht beim Laden
      if (this.on && b.berth?.kind !== 'buoy') b.game.emit('sound', { name: 'leine-einrasten', volume: 0.6 });
      this.i++; this.t = 0;
    }
    b.setSpeed(0, dt);
    return false;
  }
}

// Vor den Stegen warten: langsame Kreise (kleine Boote) oder treiben (grosse Schiffe).
class HoldTask {
  constructor(center, radius, speed) { this.c = center; this.r = radius; this.v = speed; }
  start(b) {
    this.a = Math.atan2(b.z - this.c.z, b.x - this.c.x);
    this.dir = Math.random() < 0.5 ? 1 : -1;
    this.drift = !this.v && (b.info.size === 'XL' || b.info.size === 'XXL');
  }
  step(b, dt) {
    if (this.drift) {
      b.setSpeed(0, dt);
      b.advance(b.speed * dt);
      return false;
    }
    const v = this.v ?? Math.min(0.6, b.cfg.harbor * 0.5);
    b.setSpeed(v, dt);
    this.a += (this.dir * b.speed * dt) / this.r;
    const tx = this.c.x + Math.cos(this.a) * this.r;
    const tz = this.c.z + Math.sin(this.a) * this.r;
    // Richtung = Tangente an den Kreis, sanft auf die Kreisbahn ziehen
    b.x += (tx - b.x) * Math.min(1, dt * 0.8);
    b.z += (tz - b.z) * Math.min(1, dt * 0.8);
    const tang = this.a + (this.dir * Math.PI) / 2;
    b.steer(Math.atan2(-Math.sin(tang), Math.cos(tang)), dt, 1.5);
    return false;
  }
}

// ---------------------------------------------------------------------------------------------
// Ein animiertes Boot

const SEG = 8;                 // Liniensegmente je Festmacher
const MAX_LINES = 6;

class BoatAnim {
  constructor(mgr, model, opts = {}) {
    this.mgr = mgr;
    this.game = mgr.game;
    this.model = model;

    const info = { ...(model.userData.boat || {}), ...opts };
    if (!info.length || !info.beam) {
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      info.length ||= Math.max(1, size.x);
      info.beam ||= Math.max(0.6, size.z);
      info.height ||= size.y;
    }
    info.size = SIZES[info.size] ? info.size : sizeFor(info.length);
    this.parts = collectParts(model);
    info.kind ||= this.parts.sails.length ? 'sail' : this.parts.oars.length ? 'row' : 'motor';
    info.freeboard ??= clamp(info.length * 0.07, 0.35, 6);
    this.info = info;
    this.cfg = { ...SIZES[info.size], ...(opts.cfg || {}) };
    this.id = info.id ?? model.userData.pick?.id ?? model.userData.id ?? model.uuid;
    // Eigene Animation des Modells (z. B. S: Riemen, Schaufelrad, Aussenborder) und Segel-Umschalter
    this.animateFn = typeof opts.animate === 'function' ? opts.animate : null;
    this.setSailsFn = typeof opts.setSails === 'function' ? opts.setSails : null;
    this.sailsShown = null;

    model.rotation.order = 'YZX';
    if (!model.parent) this.game.scene.add(model);

    this.x = model.position.x;
    this.z = model.position.z;
    this.heading = model.rotation.y;
    this.speed = 0;
    this.prevSpeed = 0;
    this.turnRate = 0;
    this.reverse = false;
    this.thrusters = 0;
    this.yieldF = 1;          // Verkehr: 0 = anhalten, 1 = freie Fahrt
    this.lane = 0;            // seitlicher Versatz zur Bahn (m, + = Steuerbord)
    this.laneWant = 0;
    this.blockedFor = 0;
    this.ghost = 0;
    this.bump = 0;            // kleines Nicken beim Festmachen
    this.state = 'idle';
    this.tasks = [];
    this.task = null;
    this.berth = null;
    this.moored = false;
    this.lines = [];

    this.sail = opts.sails ?? model.userData.sailsUp ?? (info.kind === 'sail' && this.parts.sails.length ? 1 : 0);
    this.sail = this.sail ? 1 : 0;
    this.sailTarget = this.sail;
    this.fender = 0;
    this.fenderTarget = 0;
    this.boom = 0;
    this.spin = 0;
    this.rowPhase = 0;
    this.ph = [Math.random() * TAU, Math.random() * TAU, Math.random() * TAU, Math.random() * TAU];

    // Klampen im Modellraum, einmal bestimmen
    model.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(model.matrixWorld).invert();
    const local = (name, fallback) => {
      const o = this.parts.cleats[name];
      if (!o) return fallback;
      return o.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
    };
    const L = info.length, B = info.beam, fb = info.freeboard;
    this.cleat = {
      bow: local('cleat-bow', new THREE.Vector3(L * 0.46, fb, 0)),
      stern: local('cleat-stern', new THREE.Vector3(-L * 0.44, fb, 0)),
      sternPort: local('cleat-stern-port', null),
      sternStbd: local('cleat-stern-stbd', null),
      mid: local('cleat-mid', null),
      B,
    };

    // Kielwasser, Schaum und Leinen liegen flach im Wasser, nicht im schaukelnden Modell
    this.wake = new THREE.Mesh(mgr.wakeGeo, mgr.wakeMat);
    this.wake.name = 'wake';
    this.wake.renderOrder = 2;
    this.wake.visible = false;
    mgr.root.add(this.wake);
    this.foam = null;
    if (info.size === 'L' || info.size === 'XL' || info.size === 'XXL') {
      this.foam = [new THREE.Mesh(mgr.foamGeo, mgr.foamMat), new THREE.Mesh(mgr.foamGeo, mgr.foamMat)];
      for (const f of this.foam) { f.visible = false; f.renderOrder = 2; mgr.root.add(f); }
    }
    this.lineGeo = new THREE.BufferGeometry();
    this.linePos = new Float32Array(MAX_LINES * SEG * 2 * 3);
    this.lineGeo.setAttribute('position', new THREE.BufferAttribute(this.linePos, 3));
    this.lineObj = new THREE.LineSegments(this.lineGeo, mgr.lineMat);
    this.lineObj.frustumCulled = false;
    this.lineObj.visible = false;
    this.lineObj.name = 'mooring-lines';
    mgr.root.add(this.lineObj);

    this._resolve = null;
    this.apply(0, this.game.time);
  }

  // --- Befehle --------------------------------------------------------------------------------

  /** Sofort an eine Stelle setzen (z. B. beim Laden). heading in rad. */
  place(x, z, heading = this.heading) {
    this.cancel();
    this.x = x; this.z = z; this.heading = heading; this.speed = 0;
    this.state = 'idle';
    return this;
  }

  /** Sofort festgemacht an einen Liegeplatz setzen, mit Leinen, Fendern und Persenning (Laden eines Spielstands). */
  moorAt(berth) {
    this.cancel();
    const b = normBerth(berth);
    this.berth = b;
    const f = this.finalPose(b);
    this.x = f.x; this.z = f.z; this.heading = b.heading; this.speed = 0;
    this.sail = this.sailTarget = 0;
    this.fender = this.fenderTarget = b.kind === 'buoy' ? 0 : 1;
    this.makeLines();
    for (const l of this.lines) l.p = 1;
    this.moored = true;
    this.state = 'moored';
    return this;
  }

  /** Einen Kurs abfahren. points: [{ x, z }, ...] in Metern. opts: speed, harbor, sails (true/false), hold, stop. */
  sailTo(points, opts = {}) {
    const p = this.begin();
    if (this.moored) this.pushUndock(opts);
    if (opts.sails !== undefined) this.push(new CallTask((b) => b.setSails(opts.sails)));
    this.push(new CallTask((b) => { b.state = 'sailing'; }));
    this.push(new PathTask(points, { speed: opts.speed, harbor: opts.harbor, stop: opts.stop, route: opts.route }));
    const last = points[points.length - 1];
    this.push(new CallTask((b) => { b.emit('boat:arrive'); }));
    if (opts.hold && last) {
      this.push(new CallTask((b) => { b.state = 'waiting'; b.finish(true); }));
      this.push(new HoldTask(last, opts.radius ?? Math.max(3, this.info.length * 1.1)));
    } else {
      this.push(new CallTask((b) => { b.state = 'idle'; b.finish(true); }));
    }
    return p;
  }

  /** Vor den Stegen warten, bis ein Platz zugewiesen wird. */
  hold(point = { x: this.x, z: this.z }, opts = {}) {
    const p = this.begin();
    if (opts.sails !== undefined) this.push(new CallTask((b) => b.setSails(opts.sails)));
    this.push(new CallTask((b) => { b.state = opts.state ?? 'waiting'; b.emit('boat:hold'); b.finish(true); }));
    this.push(new HoldTask(point, opts.radius ?? Math.max(3, this.info.length * 1.1), opts.speed));
    return p;
  }

  /** Anlegen an einen Liegeplatz ({ x, z, heading, kind, length, width, side } oder berthFromPlatz()). */
  dock(berth, opts = {}) {
    const p = this.begin();
    // opts.waitFor: () => true, sobald der Platz frei ist (das vorige Boot hat ihn verlassen)
    if (opts.waitFor) this.push(new UntilTask(opts.waitFor, 120));
    // opts.verzoegerung: erst nach so vielen Sekunden losfahren (Ankuenfte nicht alle zugleich)
    if (opts.verzoegerung > 0) this.push(new WaitTask(opts.verzoegerung));
    if (this.moored) this.pushUndock({});
    const b = normBerth(berth);
    const big = this.info.size === 'XL' || this.info.size === 'XXL';
    this.push(new CallTask((bt) => {
      bt.state = 'docking';
      bt.berth = b;
      if (bt.sail > 0.01 || bt.sailTarget > 0) bt.setSails(false);
      bt.fenderTarget = b.kind === 'buoy' ? 0 : 1;
      if (bt.info.size === 'XXL') bt.emit('boat:horn', { reason: 'arrive' });
    }));
    const pts = this.approachPoints(b);
    if (opts.via) pts.unshift(...opts.via);
    const f = this.finalPose(b);
    // Marschfahrt, das Bremsen vor dem Ziel macht PathTask (wird von selbst Hafenfahrt).
    // Kleine Boote sollen nach dem Zuweisen in wenigen Sekunden am Platz sein: Tempo nach Weglaenge,
    // zuegig beschleunigen und kraeftig abbremsen.
    let speed = opts.speed, brake = 1;
    if (speed === undefined) {
      if (big) speed = this.cfg.harbor;
      else {
        let len = 0, px = this.x, pz = this.z;
        for (const q of pts) { len += Math.hypot(q.x - px, q.z - pz); px = q.x; pz = q.z; }
        speed = clamp(len / (opts.seconds ?? 8), this.cfg.cruise, this.cfg.cruise * 2.4);
        brake = 2.2;
      }
    }
    if (BOX_KINDS.has(b.kind) || b.kind === 'buoy' || !big) {
      this.push(new PathTask(pts, { speed, brake, route: opts.route, thrusters: b.kind !== 'buoy' && this.info.size !== 'S' && this.info.size !== 'M' }));
    } else {
      // Grosse Schiffe: parallel zur Kante stoppen, dann mit Querstrahlrudern seitlich heran
      this.push(new PathTask(pts, { harbor: true, route: opts.route }));
      this.push(new StraightTask(f, { sideways: true, thrusters: true, speed: 0.35, heading: b.heading }));
    }
    this.push(new CallTask((bt) => {
      bt.heading = wrapAngle(bt.heading);
      // Ankommen: Bug taucht kurz ein und wippt nach
      bt.bump = 1;
    }));
    this.push(new LinesTask(true));
    this.push(new CallTask((bt) => {
      bt.moored = true;
      bt.state = 'moored';
      bt.emit('boat:moored', { berth: b.id });
      bt.finish(true);
    }));
    return p;
  }

  /** Ablegen und einem Kurs folgen. opts: sails (Segel setzen, sobald frei), remove (am Ende entfernen). */
  undock(points = [], opts = {}) {
    const p = this.begin();
    if (this.moored) this.pushUndock(opts);
    if (points.length) {
      if (opts.sails) this.push(new CallTask((b) => b.setSails(true)));
      this.push(new CallTask((b) => { b.state = 'leaving'; }));
      this.push(new PathTask(points, { speed: opts.speed, harbor: opts.harbor, stop: opts.stop, route: opts.route }));
    }
    this.push(new CallTask((b) => {
      b.state = 'idle';
      b.emit('boat:left');
      b.finish(true);
      if (opts.remove) b.remove();
    }));
    return p;
  }

  setSails(up) {
    if (!this.parts.sails.length && this.info.kind !== 'sail') return;
    const t = up ? 1 : 0;
    if (t !== this.sailTarget) { this.sailTarget = t; this.emit('boat:sails', { up: !!up }); }
  }

  /** Aus der Szene nehmen und Speicher freigeben. */
  remove() {
    this.cancel();
    this.mgr.boats.delete(this);
    this.model.parent?.remove(this.model);
    this.mgr.root.remove(this.wake, this.lineObj);
    if (this.foam) this.mgr.root.remove(...this.foam);
    this.lineGeo.dispose();
  }

  cancel() {
    this.mgr.engstellen.releaseAll(this);
    this.wartetVorEngstelle = false;
    this.tasks.length = 0;
    this.task = null;
    this.thrusters = 0;
    this.reverse = false;
    this.finish(false);
  }

  // --- intern: Ablauf -------------------------------------------------------------------------

  begin() {
    this.mgr.engstellen.releaseAll(this);
    this.wartetVorEngstelle = false;
    this.tasks.length = 0;
    this.task = null;
    this.finish(false);
    return new Promise((res) => { this._resolve = res; });
  }
  finish(ok) { const r = this._resolve; this._resolve = null; if (r) r(ok); }
  push(task) { this.tasks.push(task); }

  pushUndock() {
    const b = this.berth;
    // Leute vom Steg erst wieder an Bord lassen (Modul render/people.js), dann Leinen los
    if (b && b.kind !== 'buoy') this.push(new AwaitTask((bt) => bt.game.people?.anBord?.(bt.id), 20));
    // erst ablegen, wenn kein anderes Boot direkt daneben unterwegs ist (wie im echten Hafen)
    this.push(new UntilTask((bt) => !bt.nachbarUnterwegs(), 25));
    this.push(new CallTask((bt) => {
      bt.state = 'casting-off';
      bt.emit('boat:cast-off', { berth: b?.id });
      if (b?.kind !== 'buoy' && (bt.info.size === 'XL' || bt.info.size === 'XXL')) bt.emit('boat:horn', { reason: 'leave' });
    }));
    this.push(new LinesTask(false));
    this.push(new CallTask((bt) => { bt.moored = false; bt.state = 'leaving'; }));
    if (!b) return;
    const L = this.info.length, B = this.info.beam;
    const dx = Math.cos(b.heading), dz = -Math.sin(b.heading);
    const px = Math.sin(b.heading), pz = Math.cos(b.heading);
    if (b.kind === 'buoy') {
      // Leine von der Boje los, das Boot treibt kurz zurueck
      this.push(new StraightTask({ x: this.x - dx * L * 0.25, z: this.z - dz * L * 0.25 }, { reverse: true, speed: 0.9 }));
    } else if (BOX_KINDS.has(b.kind)) {
      // rueckwaerts aus der Box
      // so weit zurueck, dass das Boot beim Drehen die Nachbarn nicht beruehrt
      // Mitte eine halbe Bootslaenge plus Luft vor dem Boxende: beim Drehen auf der Stelle
      // bleiben Bug und Heck vor den Nachbarboxen und vor der gegenueberliegenden Reihe
      const back = b.length / 2 + L * 0.5 + 0.7;
      this.push(new StraightTask({ x: b.x - dx * back, z: b.z - dz * back }, { reverse: true }));
    } else {
      // seitlich frei kommen, dann voraus
      const out = -b.side;
      const big = this.info.size === 'XL' || this.info.size === 'XXL';
      const off = big ? B * 1.2 : B * 0.6;
      this.push(new StraightTask(
        { x: this.x + px * out * off, z: this.z + pz * out * off },
        { sideways: true, thrusters: big, speed: big ? 0.35 : 0.3, heading: b.heading },
      ));
    }
    this.push(new CallTask((bt) => { bt.fenderTarget = 0; bt.berth = null; bt.emit('boat:clear', { berth: b.id }); }));
  }

  finalPose(b) {
    const L = this.info.length;
    const dx = Math.cos(b.heading), dz = -Math.sin(b.heading);
    if (b.kind === 'buoy') {
      // Bug zur Boje, Boot liegt im Wind dahinter
      const r = bojenAbstand(b, L);
      return { x: b.x - dx * r, z: b.z - dz * r };
    }
    if (BOX_KINDS.has(b.kind)) {
      // Bug zum Steg, mit etwas Abstand zur Stegkante
      const fwd = Math.max(0, b.length / 2 - L / 2 - 0.3);
      return { x: b.x + dx * fwd, z: b.z + dz * fwd };
    }
    return { x: b.x, z: b.z };
  }

  approachPoints(b) {
    const L = this.info.length, B = this.info.beam;
    const dx = Math.cos(b.heading), dz = -Math.sin(b.heading);
    const px = Math.sin(b.heading), pz = Math.cos(b.heading);
    const f = this.finalPose(b);
    if (b.kind === 'buoy') {
      // gegen den Wind langsam an die Boje
      return [
        { x: f.x - dx * L * 2.2, z: f.z - dz * L * 2.2 },
        { x: f.x - dx * L * 0.6, z: f.z - dz * L * 0.6 },
        f,
      ];
    }
    if (BOX_KINDS.has(b.kind)) {
      // aus der Gasse kommend in die Box drehen
      const side = Math.sign((this.x - b.x) * px + (this.z - b.z) * pz) || 1;
      const out = b.length / 2;
      // Drehpunkt in der Gasse: moeglichst weit draussen und seitlich, aber nur auf freiem Wasser
      // (die Gasse ist je nach Stegbild unterschiedlich breit; mgr.frei kommt aus der Fahrwasser-Karte)
      const frei = this.mgr.frei;
      let k = 1.1, q = 0.9;
      if (frei) {
        const r = B / 2 + 0.4;
        const t = Math.min((this.info.draft ?? 1) + 0.3, b.depth ?? 9);
        // Vom Drehpunkt muss die Gerade bis vor die Box frei sein (sonst schneidet der Rumpf einen
        // Nachbarsteg, der zwischen Box und Gasse liegt)
        const vor = { x: b.x - dx * (out + L * 0.25), z: b.z - dz * (out + L * 0.25) };
        const sicht = this.mgr.sicht;
        const ok = (kk, qq) => {
          const p = { x: b.x - dx * (out + L * kk) + px * side * L * qq, z: b.z - dz * (out + L * kk) + pz * side * L * qq };
          return frei(p.x, p.z, r, t) && (!sicht || sicht(p, vor, B / 2 + 0.2, t));
        };
        // erst die Seite, von der das Boot kommt, dann die andere
        let wahl = [[1.1, 0.9], [1.1, 0.5], [0.9, 0.6], [1.1, 0], [0.8, 0.3], [0.7, 0], [0.55, 0]].find(([kk, qq]) => ok(kk, qq));
        if (!wahl) wahl = [[1.1, -0.9], [1.1, -0.5], [0.9, -0.6]].find(([kk, qq]) => ok(kk, qq));
        // enge Gasse ohne freie Gerade: wenigstens ein freier Drehpunkt (wie vor der Sichtpruefung)
        const nurFrei = (kk, qq) => frei(b.x - dx * (out + L * kk) + px * side * L * qq, b.z - dz * (out + L * kk) + pz * side * L * qq, r, t);
        if (!wahl) wahl = [[1.1, 0.9], [1.1, 0.5], [0.9, 0.6], [1.1, 0], [0.8, 0.3], [0.7, 0], [0.55, 0], [1.1, -0.9], [1.1, -0.5], [0.9, -0.6]].find(([kk, qq]) => nurFrei(kk, qq));
        if (wahl) [k, q] = wahl;
      }
      return [
        { x: b.x - dx * (out + L * k) + px * side * L * q, z: b.z - dz * (out + L * k) + pz * side * L * q },
        { x: b.x - dx * (out + L * 0.25), z: b.z - dz * (out + L * 0.25) },
        f,
      ];
    }
    const out = -b.side;
    const big = this.info.size === 'XL' || this.info.size === 'XXL';
    if (big) {
      // parallel zur Kante in einer Schiffsbreite Abstand
      const off = B * 1.2;
      return [
        { x: f.x - dx * L * 1.4 + px * out * (off + B), z: f.z - dz * L * 1.4 + pz * out * (off + B) },
        { x: f.x - dx * L * 0.3 + px * out * off, z: f.z - dz * L * 0.3 + pz * out * off },
        { x: f.x + px * out * off, z: f.z + pz * out * off },
      ];
    }
    return [
      { x: f.x - dx * L * 2.2 + px * out * (B * 1.8 + 1.5), z: f.z - dz * L * 2.2 + pz * out * (B * 1.8 + 1.5) },
      { x: f.x - dx * L * 0.7 + px * out * B * 0.5, z: f.z - dz * L * 0.7 + pz * out * B * 0.5 },
      f,
    ];
  }

  // Festmacher je nach Platzart: Box = 2 Vorleinen zum Steg, 2 Achterleinen zu den Pfaehlen;
  // laengsseits = Vor- und Achterleine, ab 9 m dazu zwei Springs.
  makeLines() {
    const b = this.berth;
    this.lines.length = 0;
    if (!b) return;
    const L = this.info.length, B = this.info.beam, c = this.cleat;
    const f = this.finalPose(b);
    const dx = Math.cos(b.heading), dz = -Math.sin(b.heading);
    const px = Math.sin(b.heading), pz = Math.cos(b.heading);
    const at = (along, across, y) => new THREE.Vector3(b.x + dx * along + px * across, y, b.z + dz * along + pz * across);
    const atF = (along, across, y) => new THREE.Vector3(f.x + dx * along + px * across, y, f.z + dz * along + pz * across);
    const add = (from, to, slack = 1) => { if (this.lines.length < MAX_LINES) this.lines.push({ from, to, p: 0, slack }); };

    if (b.kind === 'buoy') {
      add(c.bow, new THREE.Vector3(b.x, b.deck, b.z), 1.2);
      return;
    }
    if (b.bollards?.length) {
      // eigene Poller vom Liegeplatz: abwechselnd Bug und Heck
      b.bollards.forEach((p, i) => add(i % 2 ? c.stern : c.bow, new THREE.Vector3(p.x, p.y ?? b.deck, p.z)));
      return;
    }
    if (BOX_KINDS.has(b.kind)) {
      const half = b.length / 2;
      const spread = Math.min(b.width * 0.3, B * 0.7);
      add(c.bow, at(half + 0.2, -spread, b.deck), 0.6);
      add(c.bow, at(half + 0.2, spread, b.deck), 0.6);
      const sternTo = b.kind === 'finger' ? half - 1.2 : half;
      add(c.sternPort ?? c.stern, at(-sternTo, -b.width / 2, b.kind === 'finger' ? b.deck : 1.0), 1.2);
      add(c.sternStbd ?? c.stern, at(-sternTo, b.width / 2, b.kind === 'finger' ? b.deck : 1.0), 1.2);
      return;
    }
    const s = b.side;
    const edge = s * (B / 2 + Math.max(0.6, B * 0.15));
    const sideCleat = (v) => (v.z === 0 ? new THREE.Vector3(v.x, v.y, s * B * 0.42) : v);
    add(sideCleat(c.bow), atF(L * 0.75, edge, b.deck), 1);
    add(sideCleat(c.stern), atF(-L * 0.75, edge, b.deck), 1);
    if (L >= 9) {
      const mid = c.mid ?? new THREE.Vector3(0, this.info.freeboard, s * B * 0.48);
      add(mid, atF(-L * 0.3, edge, b.deck), 0.5);
      add(mid, atF(L * 0.3, edge, b.deck), 0.5);
    }
  }

  emit(name, data = {}) {
    this.game.emit(name, { boat: this, id: this.id, size: this.info.size, kind: this.info.kind, x: this.x, z: this.z, ...data });
  }

  // --- intern: Bewegung -----------------------------------------------------------------------

  setSpeed(target, dt, boost = 1) {
    this.speed = approach(this.speed, target, this.cfg.accel * (boost || 1) * dt);
  }

  // --- intern: Verkehr --------------------------------------------------------------------------

  /** Faehrt das Boot gerade selbst (Kurs oder gerade Fahrt, nicht seitlich an die Kante)? */
  movingTask() {
    const t = this.task;
    if (t instanceof PathTask) return t.pivot ? null : t;
    if (t instanceof StraightTask && !t.opts.sideways) return t;
    return null;
  }

  /** Wo das Boot gerade wirklich liegt (an der Boje schwojt es um die Boje). */
  pose() {
    return this.moored && this.berth?.kind === 'buoy'
      ? { x: this.model.position.x, z: this.model.position.z, h: this.model.rotation.y }
      : { x: this.x, z: this.z, h: this.heading };
  }

  /** Steht o im Weg? Liefert { y: Tempofaktor, lane: Ausweichversatz } oder null. */
  blockedBy(o) {
    // fest an Steg, Kai oder in der Box: die Anfahrwege sind dafuer gebaut
    if (o.berth && o.berth.kind !== 'buoy' && (o.moored || o.state === 'casting-off')) return null;
    const dir = this.heading + (this.reverse ? Math.PI : 0);
    const fx = Math.cos(dir), fz = -Math.sin(dir);
    const p = o.pose();
    const rx = p.x - this.x, rz = p.z - this.z;
    const ahead = rx * fx + rz * fz;
    if (ahead <= 0) return null;
    const lat = rx * Math.sin(dir) + rz * Math.cos(dir);      // + = an Steuerbord
    const dh = p.h - this.heading;
    const oL = o.info.length / 2, oB = o.info.beam / 2;
    const oAhead = oL * Math.abs(Math.cos(dh)) + oB * Math.abs(Math.sin(dh));
    const oLat = oL * Math.abs(Math.sin(dh)) + oB * Math.abs(Math.cos(dh));
    const L = this.info.length / 2, B = this.info.beam / 2;
    const gap = ahead - oAhead - L;
    const look = 1.5 + this.speed * 1.6 + (this.speed * this.speed) / (2 * this.cfg.accel);
    if (gap > look) return null;
    const clear = B + oLat + 0.5;
    if (Math.abs(lat) > clear) return null;
    const oMoving = o.speed > 0.15 || !!o.movingTask();
    const oDir = p.h + (o.reverse ? Math.PI : 0);
    if (oMoving && Math.cos(oDir - dir) > 0.4) {
      // hinterherfahren: Abstand halten
      return { y: clamp((gap - 1.2) / (1.5 + this.info.length * 0.4), 0, 1), lane: 0, gap };
    }
    const need = clear - Math.abs(lat) + 0.3;
    // Seite einmal waehlen und dabei bleiben (sonst pendelt das Boot hin und her, sobald es die Mitte kreuzt)
    const side = oMoving ? 1 : Math.abs(this.lane) > 0.2 ? Math.sign(this.lane) : lat > 0 ? -1 : 1;
    // quer liegende Boote ragen weit in die Bahn: so weit ausweichen, wie noetig
    const cap = Math.max(this.info.beam + o.info.beam + 2, clear + 0.8);
    return { y: clamp(gap / (2 + this.info.length), 0, 1) * 0.8 + (gap > 0 ? 0.1 : 0), lane: clamp(this.lane + side * need, -cap, cap), gap };
  }

  /** Liegt ein anderes Boot im Kreis, den Bug und Heck beim Drehen auf der Stelle ueberstreichen? */
  /** Ueberlappt der Rumpf an (x, z, h) ein anderes sichtbares Boot? (gedrehte Rechtecke, leicht verkleinert) */
  hitsAt(x, z, h) {
    const A = hull(x, z, h, this.info.length * 0.92, this.info.beam * 0.92);
    for (const o of this.mgr.alle()) {
      if (o === this || o.model.visible === false || o.ghost > 0) continue;
      // im Notfall-Durchlass nur durch Boote, nie durch ein grosses fremdes Schiff
      if (this.ghost > 0 && !(o instanceof Hindernis)) continue;
      // in die eigene Box hinein: Nachbarn in ihren Boxen begrenzen die Box, nicht die Fahrt
      if (o.moored && o.berth && o.berth.kind !== 'buoy' && (this.task?.remaining ?? 1e9) < this.info.length * 1.5) continue;
      const p = o.pose();
      if (Math.hypot(p.x - x, p.z - z) > (this.info.length + o.info.length) / 2) continue;
      if (sat(A, hull(p.x, p.z, p.h, o.info.length * 0.92, o.info.beam * 0.92))) return o;
    }
    return null;
  }

  /** Ist ein anderes Boot nah bei diesem gerade in Fahrt (nicht fest)? */
  nachbarUnterwegs() {
    for (const o of this.mgr.alle()) {
      if (o === this || o.model.visible === false || o.moored) continue;
      if (!(o instanceof Hindernis) && !o.task && !o.tasks?.length) continue;
      const p = o.pose();
      if (Math.hypot(p.x - this.x, p.z - this.z) < (this.info.length + o.info.length) / 2 + 4) return true;
    }
    return false;
  }

  sweepBlocked() {
    const r = this.info.length / 2;
    for (const o of this.mgr.alle()) {
      if (o === this || o.model.visible === false) continue;
      if (o.berth && o.berth.kind !== 'buoy' && o.moored) continue;
      const p = o.pose();
      if (Math.hypot(p.x - this.x, p.z - this.z) < r + o.info.beam / 2 + 0.4) return true;
    }
    return false;
  }

  priorityOver(o) {
    const a = this.movingTask()?.remaining ?? 1e9, c = o.movingTask()?.remaining ?? 1e9;
    if (Math.abs(a - c) > 1) return a < c;
    return String(this.id) < String(o.id);
  }

  advance(dist) {
    const s = this.reverse ? -1 : 1;
    this.x += Math.cos(this.heading) * dist * s;
    this.z -= Math.sin(this.heading) * dist * s;
  }

  steer(want, dt, factor = 1) {
    const diff = wrapAngle(want - this.heading);
    const max = this.cfg.turn * factor * dt;
    const d = clamp(diff, -max, max);
    this.heading += d;
    this.turnRate = dt > 0 ? d / dt : 0;
  }

  update(dt, t) {
    this.prevSpeed = this.speed;
    this.turnRate *= 0.9;
    // Zeitraffer: ausserhalb des Bildes faehrt ein Boot auf freier Strecke viermal so schnell,
    // damit An- und Abfahrt auf der Spieluhr nicht Stunden dauern
    const offen = this.task instanceof PathTask && !this.task.pivot && !this.mgr.inView(this.x, this.z, this.info.length);
    this.zeitraffer = offen;
    if (offen) dt *= 4;
    if (dt > 0) {
      let guard = 8;
      while (guard-- > 0) {
        if (!this.task) {
          this.task = this.tasks.shift() || null;
          if (!this.task) break;
          this.task.start(this);
        }
        if (this.task.step(this, dt)) { this.task = null; dt = 0; continue; }
        break;
      }
      if (!this.task && !this.tasks.length && !this.moored) {
        this.setSpeed(0, dt);
        this.advance(this.speed * dt);
      }
    }
    this.apply(dt, t);
  }

  apply(dt, t) {
    const m = this.model, cfg = this.cfg, info = this.info, mgr = this.mgr;
    const step = dt > 0 ? dt : 0;

    // Segel und Fender
    if (this.sail !== this.sailTarget) this.sail = approach(this.sail, this.sailTarget, step / 2.5);
    if (this.fender !== this.fenderTarget) this.fender = approach(this.fender, this.fenderTarget, step / 1.2);

    // Seegang
    const water = this.game.water;
    const shelter = mgr.shelter(this.x, this.z);
    const amp = (0.3 + 1.7 * mgr.sea) * shelter * (this.moored ? 0.55 : 1);
    const w = TAU / cfg.period;
    let heave, roll, pitch;
    if (water && typeof water.heightAt === 'function') {
      const ch = Math.cos(this.heading), sh = Math.sin(this.heading);
      const hl = info.length * 0.4, hb = info.beam * 0.5;
      const h0 = water.heightAt(this.x, this.z, t);
      const hf = water.heightAt(this.x + ch * hl, this.z - sh * hl, t);
      const hs = water.heightAt(this.x + sh * hb, this.z + ch * hb, t);
      heave = h0;
      pitch = Math.atan2(hf - h0, hl) * 0.8;
      roll = Math.atan2(hs - h0, hb) * 0.6;
    } else {
      heave = cfg.heave * amp * (Math.sin(w * t + this.ph[0]) * 0.7 + Math.sin(w * 1.7 * t + this.ph[3]) * 0.3);
      roll = cfg.roll * amp * Math.sin(w * 0.8 * t + this.ph[1]);
      pitch = cfg.pitch * amp * Math.sin(w * 1.15 * t + this.ph[2]);
    }

    // Krängung durch Wind (Segel) und Kurven, Trimm beim Gasgeben
    const wind = mgr.wind;
    const rel = wind.from - this.heading;
    const lee = Math.sin(rel) >= 0 ? 1 : -1;       // +1 = Lee an Steuerbord
    const sailing = this.sail * clamp(this.speed / 1.2, 0, 1);
    roll += lee * sailing * wind.strength * 0.22 * Math.abs(Math.sin(rel));
    roll -= clamp(this.turnRate * this.speed * 0.08, -0.12, 0.12);
    const acc = step > 0 ? (this.speed - this.prevSpeed) / step : 0;
    if (info.kind === 'motor') pitch += cfg.trim * clamp(this.speed / cfg.cruise, 0, 1) + clamp(acc, -1, 1) * cfg.trim * 0.4;
    if (this.bump > 0) {
      // beim Ankommen: Bug taucht kurz ein und wippt nach
      this.bump = Math.max(0, this.bump - step / 1.4);
      const k = this.bump * this.bump;
      pitch -= Math.sin((1 - this.bump) * 14) * 0.05 * k * (info.size === 'S' ? 1.4 : 1);
      heave -= Math.sin((1 - this.bump) * 11) * 0.06 * k;
    }

    // kleines Einruecken an den Leinen, an der Boje langsames Schwojen um die Boje
    let sx = 0;
    let px = this.x, pz = this.z, yaw = this.heading;
    const bb = this.berth;
    if (this.moored && bb?.kind === 'buoy') {
      // Schwojen nur so weit, wie Platz zur Nachbarboje ist
      const swing = Number.isFinite(bb.abstand) ? clamp((bb.abstand - info.beam - 1.2) / (info.length + 3) - 0.1, 0.02, 0.25) : 0.25;
      yaw = bb.heading + Math.sin(t * 0.12 + this.ph[0]) * swing;
      const r = bojenAbstand(bb, this.info.length) + Math.sin(t * 0.3 + this.ph[1]) * 0.3;
      px = bb.x - Math.cos(yaw) * r;
      pz = bb.z + Math.sin(yaw) * r;
    } else if (this.moored) {
      sx = Math.sin(t * 0.4 + this.ph[0]) * 0.06 * shelter;
    }

    const ch = Math.cos(yaw), sh = Math.sin(yaw);
    m.position.set(px + ch * sx, heave, pz - sh * sx);
    m.rotation.set(roll, yaw, pitch);

    this.applyParts(step, t, lee, rel);
    this.applyWake(t, ch, sh);
    if (this.lines.length) {
      // auf Handys werden die Leinen liegender Boote nur jedes zweite Bild nachgefuehrt
      const busy = !this.moored || this.state !== 'moored';
      if (busy || !mgr.lowPower || ((mgr.frame + (this.ph[0] * 10 | 0)) & 1) === 0) this.applyLines();
      this.lineObj.visible = true;
    } else if (this.lineObj.visible) {
      this.lineObj.visible = false;
    }
  }

  applyParts(dt, t, lee, rel) {
    const P = this.parts;
    const e = ease(this.sail);
    // Segel-Umschalter des Modells: an, sobald gesetzt wird, aus, wenn ganz geborgen
    if (this.setSailsFn) {
      const on = this.sail > 0.001 || this.sailTarget > 0;
      if (on !== this.sailsShown) { this.sailsShown = on; this.setSailsFn(this.model, on); }
    }
    for (const r of P.sails) {
      const axis = r.o.userData.furl === 'x' ? 'x' : 'y';
      r.o.visible = this.sail > 0.01;
      r.o.scale[axis] = r.s[axis] * (0.03 + 0.97 * e);
      // beim Bergen und Setzen killt das Tuch ein wenig
      r.o.rotation.y = r.r.y + (this.sail > 0.02 && this.sail < 0.98 ? Math.sin(t * 9) * 0.06 : 0);
    }
    const boomTarget = this.sail > 0.5 && !this.moored ? lee * (0.25 + 0.55 * (1 + Math.cos(rel)) / 2) : 0;
    this.boom = approach(this.boom, boomTarget, dt * 0.6);
    for (const r of P.booms) r.o.rotation.y = r.r.y + this.boom;

    // Persenning nur am Liegeplatz; eingerollte Fock (cover-jib) immer, wenn die Segel unten sind
    const furled = this.sail < 0.05;
    for (const r of P.covers) r.o.visible = furled && (this.moored || r.o.name.toLowerCase().includes('jib'));

    const side = this.berth && !BOX_KINDS.has(this.berth.kind) ? this.berth.side : 0;
    for (const r of P.fenders) {
      const onSide = !side || Math.abs(r.p.z) < 0.01 || Math.sign(r.p.z) === side;
      const v = onSide ? this.fender : 0;
      r.o.visible = v > 0.02;
      r.o.scale.y = r.s.y * Math.max(0.02, v);
    }

    if (this.animateFn) {
      // das Modell bewegt Riemen, Schrauben und eigenes Kielwasser selbst
      this.animateFn(this.model, t, { speed: this.speed * (this.reverse ? -1 : 1), moored: this.moored, sway: 1 });
    } else {
      this.applyMovers(dt);
    }
    for (const r of P.radars) r.o.rotation.y += dt * 2.4;

    if (P.flags.length) {
      // Flagge weht nach Lee (Ruhestellung: Flagge zeigt nach achtern, -x)
      const ws = this.mgr.wind.strength;
      for (const r of P.flags) r.o.rotation.y = r.r.y + rel * 0.15 + Math.sin(t * (5 + ws * 6) + this.ph[1]) * (0.08 + ws * 0.12);
    }

    const smokeOn = this.speed > 0.05 || this.thrusters > 0 || this.state === 'casting-off';
    for (const r of P.smoke) {
      r.o.visible = smokeOn;
      if (smokeOn) r.o.scale.setScalar(r.s.x * (0.9 + Math.sin(t * 3 + this.ph[2]) * 0.12));
    }
  }

  // Riemen und Schrauben, falls das Modell sie nicht selbst bewegt
  applyMovers(dt) {
    const P = this.parts;
    const sgn = this.reverse ? -1 : 1;
    this.spin += dt * (this.speed * 14 + this.thrusters * 6) * sgn;
    for (const r of P.spinners) r.o.rotation.x = r.r.x + this.spin;
    if (P.oars.length) {
      if (this.speed > 0.05) this.rowPhase += dt * (1.6 + this.speed * 1.5);
      const a = this.speed > 0.05 ? 1 : 0;
      for (const r of P.oars) {
        r.o.rotation.y = r.r.y + Math.sin(this.rowPhase) * 0.5 * a * r.side;
        r.o.rotation.x = r.r.x + Math.cos(this.rowPhase) * 0.12 * a * r.side;
      }
    }
  }

  applyWake(t, ch, sh) {
    const v = this.speed;
    const L = this.info.length, B = this.info.beam;
    const show = v > 0.12 && !this.reverse && !this.parts.ownWake;
    this.wake.visible = show;
    if (show) {
      const k = clamp(v / this.cfg.cruise, 0, 1.4);
      const len = L * (0.9 + k * 1.6);
      const wid = B * 0.5 + len * 0.36;
      const bow = L * 0.48;
      this.wake.position.set(this.x + ch * bow, 0.04, this.z - sh * bow);
      this.wake.rotation.y = this.heading;
      this.wake.scale.set(len, 1, wid * (0.95 + Math.sin(t * 2.3 + this.ph[0]) * 0.05));
    }
    if (this.foam) {
      const on = this.thrusters > 0.05;
      for (let i = 0; i < 2; i++) {
        const f = this.foam[i];
        f.visible = on;
        if (!on) continue;
        const along = i === 0 ? L * 0.38 : -L * 0.4;
        const out = (this.berth ? -this.berth.side : 1) * this.info.beam * 0.8;
        f.position.set(this.x + ch * along + sh * out, 0.05, this.z - sh * along + ch * out);
        const r = this.info.beam * (0.45 + 0.25 * Math.sin(t * 5 + i * 2)) * this.thrusters;
        f.scale.set(r, 1, r);
      }
    }
  }

  applyLines() {
    const m = this.model;
    m.updateMatrix();
    const mat = m.parent && m.parent !== this.game.scene ? _m.multiplyMatrices(m.parent.matrixWorld, m.matrix) : m.matrix;
    const pos = this.linePos;
    let k = 0;
    for (const line of this.lines) {
      const a = _a.copy(line.from).applyMatrix4(mat);
      const p = ease(line.p);
      const bx = a.x + (line.to.x - a.x) * p;
      const by = a.y + (line.to.y - a.y) * p;
      const bz = a.z + (line.to.z - a.z) * p;
      const dist = Math.hypot(line.to.x - a.x, line.to.z - a.z);
      // im Flug ein Bogen nach oben, fest eine leichte Durchhaenge
      const bend = (1 - line.p) * dist * 0.3 - line.p * line.slack * dist * 0.08;
      let lx = a.x, ly = a.y, lz = a.z;
      for (let i = 1; i <= SEG; i++) {
        const u = i / SEG;
        const x = a.x + (bx - a.x) * u;
        const z = a.z + (bz - a.z) * u;
        const y = a.y + (by - a.y) * u + 4 * u * (1 - u) * bend;
        pos[k++] = lx; pos[k++] = ly; pos[k++] = lz;
        pos[k++] = x; pos[k++] = y; pos[k++] = z;
        lx = x; ly = y; lz = z;
      }
    }
    this.lineGeo.setDrawRange(0, k / 3);
    this.lineGeo.attributes.position.needsUpdate = true;
  }
}

const _a = new THREE.Vector3();
const _m = new THREE.Matrix4();

export default init;
