// Das Spielobjekt, das alle Module bekommen: Renderer, Szene, Kamera, Ereignisse, Spielschleife.
import * as THREE from 'three';
import { CameraRig } from './camera.js';

export function createGame({ canvas, bounds, home }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#62b4c2');

  const rig = new CameraRig({ bounds });
  if (home.rect) rig.setHomeRect(home.rect); else rig.setHome(home.x, home.z, home.width);

  const listeners = new Map();
  const tickers = new Set();

  const game = {
    THREE,
    canvas,
    renderer,
    scene,
    camera: rig,              // zoomAt(factor, sx, sy), panBy(dx, dy), reset(), screenToWorld(sx, sy)
    paused: false,
    time: 0,                  // Spielzeit in Sekunden, laeuft nur ohne Pause
    speed: 1,

    on(name, fn) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(fn);
      return () => listeners.get(name).delete(fn);
    },
    emit(name, data) {
      const set = listeners.get(name);
      if (set) for (const fn of set) fn(data);
    },
    // fn(dt, game) wird jedes Bild aufgerufen. dt in Sekunden, 0 waehrend der Pause.
    onTick(fn) {
      tickers.add(fn);
      return () => tickers.delete(fn);
    },
    // Was liegt unter einem Bildschirmpunkt? Siehe docs/grundgeruest.md, Abschnitt "Antippbare Objekte".
    // Liefert { type, id, object, point } oder null. tolerance in CSS-Pixeln fuer Finger.
    pick(x, y, { tolerance = 22, types = null } = {}) {
      return pickAt(game, x, y, tolerance, types);
    },
    setPaused(p) {
      game.paused = p;
      document.body.classList.toggle('paused', p);
      game.emit('pause', p);
    },
  };

  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    rig.resize(w, h);
    const top = document.getElementById('hud-top');
    const bottom = document.getElementById('hud-bottom');
    rig.setInsets(top ? top.offsetHeight : 0, bottom ? bottom.offsetHeight : 0);
    game.emit('resize', { width: w, height: h });
  };
  new ResizeObserver(resize).observe(canvas);
  resize();
  rig.reset();

  // Im Hintergrund pausieren (Tab gewechselt, Handy gesperrt)
  let pausedByVisibility = false;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !game.paused) { pausedByVisibility = true; game.setPaused(true); }
    else if (!document.hidden && pausedByVisibility) { pausedByVisibility = false; game.setPaused(false); }
  });

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const raw = Math.min(clock.getDelta(), 0.1);
    const dt = game.paused ? 0 : raw * game.speed;
    game.time += dt;
    for (const fn of tickers) fn(dt, game);
    renderer.render(scene, rig.camera);
  });

  return game;
}

const _ndc = new THREE.Vector2();
const _ray = new THREE.Raycaster();
const _v = new THREE.Vector3();

function pickInfo(obj, types) {
  for (let o = obj; o; o = o.parent) {
    const p = o.userData && o.userData.pick;
    if (p && (!types || types.includes(p.type))) return { ...p, object: o };
  }
  return null;
}

function pickAt(game, x, y, tolerance, types) {
  const rig = game.camera;
  _ndc.set((x / rig.screenW) * 2 - 1, -(y / rig.screenH) * 2 + 1);
  _ray.setFromCamera(_ndc, rig.camera);
  // 1. Genauer Treffer per Strahl
  for (const hit of _ray.intersectObjects(game.scene.children, true)) {
    if (!hit.object.visible) continue;
    const info = pickInfo(hit.object, types);
    if (info) return { ...info, point: hit.point };
  }
  // 2. Fingertoleranz: naechstes antippbares Objekt in der Naehe auf dem Bildschirm
  let best = null;
  let bestD = tolerance;
  game.scene.traverseVisible((o) => {
    const p = o.userData && o.userData.pick;
    if (!p || (types && !types.includes(p.type))) return;
    o.getWorldPosition(_v).project(rig.camera);
    const sx = (_v.x + 1) / 2 * rig.screenW;
    const sy = (1 - _v.y) / 2 * rig.screenH;
    const d = Math.hypot(sx - x, sy - y);
    if (d < bestD) { bestD = d; best = { ...p, object: o, point: o.getWorldPosition(new THREE.Vector3()) }; }
  });
  return best;
}
