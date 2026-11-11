// Start des Spiels. Diese Datei gehoert dem Grundgeruest-Thread.
// Andere Module bekommen das Spielobjekt `game` (siehe js/core/game.js) und haengen sich daran.
import { createGame } from './core/game.js';
import { initInput } from './core/input.js';
import { addPlaceholderWorld } from './render/placeholder.js';

// Module der anderen Threads. Jedes exportiert eine Funktion init(game) (oder default),
// die das Spielobjekt bekommt. Fehlt eine Datei noch, wird sie still uebersprungen.
// Neue Module hier eintragen, dann muss niemand sonst main.js oder index.html anfassen.
const MODULES = [
  './render/landscape.js',
  './render/services.js',
  './render/boats/s.js',
  './render/boats/m.js',
  './render/boats/l.js',
  './render/boats/xl.js',
  './ui/input-pc.js',
  './ui/input-touch.js',
  './ui/hud.js',
  './audio/audio.js',
  './state.js',
];

async function loadModules(game) {
  const results = await Promise.allSettled(MODULES.map((path) => import(path)));
  results.forEach((r, i) => {
    if (r.status !== 'fulfilled') {
      console.info('Modul noch nicht vorhanden oder fehlerhaft:', MODULES[i], r.reason?.message ?? '');
      return;
    }
    const mod = r.value;
    const init = mod.init ?? mod.default ??
      Object.entries(mod).find(([k, v]) => k.startsWith('init') && typeof v === 'function')?.[1];
    if (typeof init !== 'function') return;
    try { init(game); } catch (err) { console.error('Fehler in', MODULES[i], err); }
  });
  game.emit('ready');
}

const U = 0.62;   // Meter je Planeinheit aus hafen_von_oben.py

// Kartengrenzen in Metern, x nach Osten, z nach Sueden (Norden ist -z)
const WORLD = {
  minX: -300 * U, maxX: 306 * U,
  minZ: -352 * U, maxZ: 30 * U,
};
WORLD.width = WORLD.maxX - WORLD.minX;
WORLD.centerX = (WORLD.minX + WORLD.maxX) / 2;

function boot() {
  const canvas = document.getElementById('stage');
  const game = createGame({
    canvas,
    bounds: WORLD,
    // Startansicht: Stufe 1, Steg A am Suedufer des Sees
    home: { x: -60 * U, z: -12, width: 70 },
  });
  window.hafenmeister = game;   // zum Ausprobieren in der Browser-Konsole

  addPlaceholderWorld(game, WORLD);
  initInput(game);

  document.getElementById('btn-overview').addEventListener('click', () => game.camera.reset());
  const pauseBtn = document.getElementById('btn-pause');
  pauseBtn.addEventListener('click', () => game.setPaused(!game.paused));
  game.on('pause', (p) => { pauseBtn.textContent = p ? 'Weiter' : 'Pause'; });

  game.on('tap', ({ world }) => {
    if (world) console.debug('Tipp bei', world.x.toFixed(1), world.z.toFixed(1));
  });

  return game;
}

try {
  const game = boot();
  await loadModules(game);
  document.getElementById('boot').classList.add('done');
} catch (err) {
  const el = document.getElementById('boot');
  el.classList.add('error');
  el.textContent = 'Das Spiel konnte nicht starten. Dein Browser unterstützt vermutlich kein WebGL.';
  console.error(err);
}
