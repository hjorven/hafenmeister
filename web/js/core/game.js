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
  rig.setHome(home.x, home.z, home.width);

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
