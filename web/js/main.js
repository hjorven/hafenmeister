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
  './render/landschaft/formen.js',      // Geländeform des Spiels (Thread Geländeform), vor der Landschaft
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

// Startansicht in zwei Teilen:
// 1. Kern: alle Liegeplaetze der Stufe mit 12 m Rand (Stufe ohne eigene Plaetze nimmt die davor).
// 2. Extras: Wartebojen (8 m Rand, die Boote liegen bis 6 m oestlich im Wind) und sichtbare
//    Bauplaetze (6 m Rand). Sie kommen nacheinander dazu, die naechsten zuerst, solange der
//    Ausschnitt dadurch nicht zu weit herausgezoomt werden muss (siehe startRect).
// Ankerfelder zaehlen nicht: gross, nur Ausweichplatz.
function homeRect(stufe) {
  try {
    let s = stufe;
    let pts = [];
    for (; s >= 1 && !pts.length; s--) pts = plaetzeInStufe(s).map((p) => platzInWelt(p, s));
    if (!pts.length) throw new Error('keine Plaetze');
    // Ab 20 Plaetzen bleiben die aeussersten 10 % je Richtung draussen (z. B. die Grossschiffpier
    // weit im Westen), sonst waere der Hafen am Handy hochkant nur ein schmaler Streifen.
    const schnitt = (werte) => {
      const v = [...werte].sort((a, b) => a - b);
      const k = v.length >= 20 ? Math.floor(v.length * 0.1) : 0;
      return [v[k], v[v.length - 1 - k]];
    };
    const [x0, x1] = schnitt(pts.map((p) => p.x));
    const [z0, z1] = schnitt(pts.map((p) => p.z));
    return { minX: x0 - 12, maxX: x1 + 12, minZ: z0 - 12, maxZ: z1 + 10 };
  } catch (err) {
    console.warn('Startansicht aus harbor.js nicht ableitbar, nehme festen Wert', err);
    return { minX: -76, maxX: -44, minZ: -45, maxZ: 6 };
  }
}

const bauplatzMass = new Map();

function extras(game, stufe) {
  const liste = [];
  try {
    for (const b of warteplaetze(stufe).bojen) {
      liste.push({ minX: b.x - 8, maxX: b.x + 8, minZ: b.z - 8, maxZ: b.z + 8 });
    }
  } catch (err) { console.warn('Wartebojen nicht lesbar', err); }
  // Bauplaetze pulsieren: jede Flaeche wird einmal gemessen und auf ganze Meter gerundet gemerkt,
  // damit reset() immer genau denselben Ausschnitt liefert.
  const teil = new game.THREE.Box3();
  game.scene.traverseVisible((o) => {
    const pick = o.userData?.pick;
    if (pick?.type !== 'buildsite') return;
    const key = `${pick.id}|${o.uuid}`;
    let e = bauplatzMass.get(key);
    if (!e) {
      teil.setFromObject(o);
      if (teil.isEmpty()) return;
      e = { minX: Math.floor(teil.min.x) - 6, maxX: Math.ceil(teil.max.x) + 6,
            minZ: Math.floor(teil.min.z) - 6, maxZ: Math.ceil(teil.max.z) + 6 };
      bauplatzMass.set(key, e);
    }
    liste.push(e);
  });
  return liste;
}

const vereinige = (a, b) => ({
  minX: Math.min(a.minX, b.minX), maxX: Math.max(a.maxX, b.maxX),
  minZ: Math.min(a.minZ, b.minZ), maxZ: Math.max(a.maxZ, b.maxZ),
});

// Noetige Bildbreite in Metern, damit das Rechteck in den freien Bereich passt
// (Schraegsicht 50 Grad: Tiefe erscheint um sin 50 verkuerzt).
function breiteFuer(r, cam) {
  const ins = cam.insets || { top: 0, bottom: 0 };
  const w = Math.max(1, cam.screenW - (cam.insetRight || 0));
  const h = Math.max(1, cam.screenH - ins.top - ins.bottom);
  return Math.max(r.maxX - r.minX, (r.maxZ - r.minZ) * Math.sin(50 * Math.PI / 180) * (w / h));
}

// Der Hafen soll gross im Bild sein: Extras kommen nur dazu, solange die Breite hoechstens
// 1,5-mal so gross wird wie fuer die Liegeplaetze allein (mindestens 50 m).
function startRect(game, stufe) {
  const cam = game.camera;
  try { if (cam.insetsFn) { const [top, bottom] = cam.insetsFn(); cam.insets = { top, bottom }; } } catch (err) { /* alte Werte */ }
  let r = homeRect(stufe);
  const grenze = Math.max(breiteFuer(r, cam) * 1.5, 50);
  const mx = (r.minX + r.maxX) / 2;
  const mz = (r.minZ + r.maxZ) / 2;
  const abstand = (e) => Math.hypot((e.minX + e.maxX) / 2 - mx, (e.minZ + e.maxZ) / 2 - mz);
  for (const e of extras(game, stufe).sort((a, b) => abstand(a) - abstand(b))) {
    const neu = vereinige(r, e);
    if (breiteFuer(neu, cam) <= grenze) r = neu;
  }
  // Bleibt Tiefe uebrig (Hochformat), legt die Kamera das Suedufer an den unteren Rand und zeigt
  // oben viel leeres Wasser. Der Ueberschuss kommt je zur Haelfte nach Norden und Sueden dazu:
  // der Hafen steht dann mittig im freien Bereich.
  const ins = cam.insets || { top: 0, bottom: 0 };
  const w = Math.max(1, cam.screenW - (cam.insetRight || 0));
  const h = Math.max(1, cam.screenH - ins.top - ins.bottom);
  const sichtbar = breiteFuer(r, cam) / Math.sin(50 * Math.PI / 180) * (h / w);
  const rest = sichtbar - (r.maxZ - r.minZ);
  if (rest > 0) r = { ...r, minZ: r.minZ - rest / 2, maxZ: r.maxZ + rest / 2 };
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
