// Start des Spiels. Diese Datei gehoert dem Grundgeruest-Thread.
// Andere Module bekommen das Spielobjekt `game` (siehe js/core/game.js) und haengen sich daran.
import { createGame } from './core/game.js';
import { initInput } from './core/input.js';
import { addPlaceholderWorld } from './render/placeholder.js';
import { plaetzeInStufe, platzInWelt } from './data/harbor.js';
import { warteplaetze } from './render/landschaft/gelaende.js';

// Module der anderen Threads. Jedes exportiert eine Funktion init(game) (oder default),
// die das Spielobjekt bekommt. Fehlt eine Datei noch, wird sie still uebersprungen.
// Neue Module hier eintragen, dann muss niemand sonst main.js oder index.html anfassen.
const MODULES = [
  './data/stegbild.js',
  './world/region.js',
  './render/landscape.js',
  './render/stege.js',
  './render/services.js',
  './render/buildings.js',
  './render/boats/s.js',
  './render/boats/m.js',
  './render/boats/l.js',
  './render/boats/xl.js',
  './render/boats/xxl.js',
  './render/boats/verkehr.js',
  './render/boat-anim.js',
  './render/boat-view.js',
  './render/people.js',
  './ui/input-pc.js',
  './ui/input-touch.js',
  './ui/gesten.js',
  './ui/hud.js',
  './ui/bauen.js',
  './ui/fotomodus.js',
  './audio/audio.js',
  './state.js',
  './events/events.js',
  './features/dauerlieger.js',
  './features/platzschilder.js',
  './features/stammgaeste.js',
  './features/tagesziele.js',
  './features/wetterflagge.js',
  './features/hafen-schauen.js',
  './features/einstieg.js',
  './save/index.js',
  './ui/oberflaeche.js',
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
  removePlaceholders(game);
  game.emit('ready');
}

// Platzhalter verschwinden, sobald die echten Module da sind
function removePlaceholders(game) {
  const ph = game.placeholder;
  if (!ph) return;
  if (game.stege) { ph.group.remove(ph.deck, ph.piles); }
  if (game.landscape) {
    ph.group.remove(ph.bands);
    for (const l of ph.lights) l.removeFromParent();
  }
}

const U = 0.62;   // Meter je Planeinheit aus hafen_von_oben.py

// Kartengrenzen in Metern, x nach Osten, z nach Sueden (Norden ist -z)
const WORLD = {
  minX: -420 * U, maxX: 306 * U, // West bis -420: Grossschiffpier und Marineanleger (Stufe 6)
  minZ: -352 * U, maxZ: 30 * U,
};
WORLD.width = WORLD.maxX - WORLD.minX;
WORLD.centerX = (WORLD.minX + WORLD.maxX) / 2;

// Startansicht: alle Liegeplaetze einer Stufe mit 12 m Rand, dazu die Wartebojen mit 8 m Rand
// (die wartenden Boote liegen bis 6 m oestlich der Boje im Wind).
// Hat eine Stufe keine eigenen Plaetze in harbor.js (Stufe 6), gelten die der Stufe davor.
function homeRect(stufe) {
  try {
    let s = stufe;
    let pts = [];
    for (; s >= 1 && !pts.length; s--) pts = plaetzeInStufe(s).map((p) => platzInWelt(p, s));
    if (!pts.length) throw new Error('keine Plaetze');
    const xs = pts.map((p) => p.x);
    const zs = pts.map((p) => p.z);
    const r = {
      minX: Math.min(...xs) - 12, maxX: Math.max(...xs) + 12,
      minZ: Math.min(...zs) - 12, maxZ: Math.max(Math.max(...zs) + 8, 6),
    };
    let wp = { bojen: [], ankerbereiche: [] };
    try { wp = warteplaetze(stufe); } catch (err) { console.warn('Wartebojen nicht lesbar', err); }
    const dazu = (x, z, rand) => {
      r.minX = Math.min(r.minX, x - rand);
      r.maxX = Math.max(r.maxX, x + rand);
      r.minZ = Math.min(r.minZ, z - rand);
      r.maxZ = Math.max(r.maxZ, z + rand);
    };
    for (const b of wp.bojen) dazu(b.x, b.z, 8);
    // Ankerfelder zaehlen nicht: sie sind gross, nur Ausweichplatz und zogen am Handy den Steg aus dem Bild.
    return r;
  } catch (err) {
    console.warn('Startansicht aus harbor.js nicht ableitbar, nehme festen Wert', err);
    return { minX: -76, maxX: -44, minZ: -45, maxZ: 6 };
  }
}

// Dazu alle sichtbaren Bauplaetze (Stegprojekte und Services, pick buildsite) mit 6 m Rand.
// Wird bei jedem reset() neu gerechnet, weil die Module Bauplaetze erst spaeter anlegen
// und gebaute Plaetze wieder verschwinden.
function startRect(game, stufe) {
  const r = homeRect(stufe);
  const box = new game.THREE.Box3();
  const teil = new game.THREE.Box3();
  game.scene.traverseVisible((o) => {
    if (o.userData?.pick?.type !== 'buildsite') return;
    teil.setFromObject(o);
    if (!teil.isEmpty()) box.union(teil);
  });
  if (!box.isEmpty()) {
    r.minX = Math.min(r.minX, box.min.x - 6);
    r.maxX = Math.max(r.maxX, box.max.x + 6);
    r.minZ = Math.min(r.minZ, box.min.z - 6);
    r.maxZ = Math.max(r.maxZ, box.max.z + 6);
  }
  return r;
}

function boot() {
  const canvas = document.getElementById('stage');
  const game = createGame({
    canvas,
    bounds: WORLD,
    // Startansicht: Stufe 1, Steg A am Suedufer des Sees
    // Liegeplaetze der Stufe 1 aus harbor.js plus Rand, dazu die Wartebojen davor
    home: { rect: homeRect(1) },
  });
  window.hafenmeister = game;   // zum Ausprobieren in der Browser-Konsole

  game.placeholder = addPlaceholderWorld(game, WORLD);
  initInput(game);

  // Knopf "Übersicht" zeigt den ganzen Hafen der aktuellen Stufe samt Bojen und Bauplaetzen
  let stufe = 1;
  game.on('stufe', (n) => { const v = Number(typeof n === 'object' ? n?.stufe : n); if (v >= 1) stufe = v; });
  game.camera.setHomeRect(() => startRect(game, stufe));

  document.getElementById('btn-overview').addEventListener('click', () => game.camera.reset());
  const pauseBtn = document.getElementById('btn-pause');
  pauseBtn.addEventListener('click', () => game.setPaused(!game.paused));
  // Beschriftung nur für Bildschirmleser und Maus-Hinweis: das Symbol zeichnet ui/oberflaeche.js
  game.on('pause', (p) => { pauseBtn.setAttribute('aria-label', p ? 'Weiter' : 'Pause'); pauseBtn.title = p ? 'Weiter (Leertaste)' : 'Pause (Leertaste)'; });

  game.on('tap', ({ world }) => {
    if (world) console.debug('Tipp bei', world.x.toFixed(1), world.z.toFixed(1));
  });

  return game;
}

try {
  const game = boot();
  await loadModules(game);
  // Erst jetzt stehen Stege, Bauplaetze und die geladene Stufe fest
  game.camera.reset();
  document.getElementById('boot').classList.add('done');
} catch (err) {
  const el = document.getElementById('boot');
  el.classList.add('error');
  el.textContent = 'Das Spiel konnte nicht starten. Dein Browser unterstützt vermutlich kein WebGL.';
  console.error(err);
}
