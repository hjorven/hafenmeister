// Das Spielobjekt, das alle Module bekommen: Renderer, Szene, Kamera, Ereignisse, Spielschleife.
import * as THREE from 'three';
import { CameraRig } from './camera.js';
import { createEmitter } from './ereignisse.js';

export function createGame({ canvas, bounds, home }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  // Hoechstens 1,5 Bildpunkte je CSS-Pixel: Handys haben oft 3, das waeren 4-mal so viele
  // Pixel wie bei 1,5 fuer kaum sichtbaren Unterschied (die Oberflaeche ist HTML und bleibt scharf)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#62b4c2');
  // Dunst zum Horizont: bei flachem Blick verschwimmen Landschaftsrand und Wasserkante im Himmel.
  // Farbe folgt dem Himmel (scene.background), Abstand der Kamera (siehe dunst() unten).
  scene.fog = new THREE.Fog(scene.background.clone(), 1e5, 2e5);

  const rig = new CameraRig({ bounds });
  // Bodenhoehe fuer die Kamera: sie bleibt ueber Gelaende und Wasser (Landschaft setzt game.landschaft)
  rig.boden = (x, z) => game.landschaft?.hoeheBei?.(x, z) ?? 0;
  if (home.rect) rig.setHomeRect(home.rect); else rig.setHome(home.x, home.z, home.width);

  const ereignisse = createEmitter();
  const tickers = new Set();

  const game = {
    THREE,
    canvas,
    renderer,
    scene,
    camera: rig,              // zoomAt, panBy, reset, screenToWorld, rotateBy, rotateFree, snapRotation, flyTo
    paused: false,
    time: 0,                  // Spielzeit in Sekunden, laeuft nur ohne Pause
    speed: 1,

    // Ereignisse: ein Fehler in einem Zuhörer hält die anderen nicht auf (core/ereignisse.js)
    on: ereignisse.on,
    emit: ereignisse.emit,
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
    rig.setInsets(...hudInsets(canvas, w, h));
    game.emit('resize', { width: w, height: h });
  };
  new ResizeObserver(resize).observe(canvas);
  resize();
  // Leisten erscheinen oft erst, wenn ihre Module geladen sind: Startansicht misst sie jedes Mal neu
  rig.insetsFn = () => hudInsets(canvas, canvas.clientWidth, canvas.clientHeight);
  rig.reset();

  // Im Hintergrund pausieren (Tab gewechselt, Handy gesperrt)
  let pausedByVisibility = false;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !game.paused) { pausedByVisibility = true; game.setPaused(true); }
    else if (!document.hidden && pausedByVisibility) { pausedByVisibility = false; game.setPaused(false); }
  });

  // Nur für den Zeitraffer-Test (tools/zeitraffer, docs/zeitraffer.md): ?testtempo=500 läuft
  // 500-mal so schnell wie 1x. Die Spielzeit eines Bildes wird in Schritte von höchstens
  // TEST_SCHRITT Sekunden geteilt (so groß wie ein Bild bei 8x), damit Boote und Regeln
  // dasselbe sehen wie im normalen Spiel. Höchstens TEST_MAX Schritte je Bild, damit die Seite
  // bedienbar bleibt; reicht die Rechenzeit nicht, läuft das Spiel langsamer als verlangt.
  // Ohne Parameter ändert sich nichts.
  const testTempo = Math.min(2000, Math.max(0, Number(new URLSearchParams(location.search).get('testtempo')) || 0));
  const TEST_SCHRITT = 0.8;
  const TEST_MAX = 120;
  game.testTempo = testTempo;

  let nebelZiel = 0;
  game.on('weather', (w) => { if (w && typeof w === 'object') nebelZiel = Math.min(1, Math.max(0, Number(w.fog) || 0)); });

  // Zeit aus dem Zeitstempel der Bildschleife (THREE.Clock ist in Three.js 0.187 veraltet und warnt)
  let zuletzt = null;
  renderer.setAnimationLoop((zeit) => {
    const jetzt = Number.isFinite(zeit) ? zeit : performance.now();
    const delta = zuletzt === null ? 0 : Math.max(0, (jetzt - zuletzt) / 1000);
    zuletzt = jetzt;
    if (testTempo > 0) {
      const echt = Math.min(delta, 0.5);
      let rest = game.paused ? 0 : Math.min(echt * testTempo * game.speed, TEST_SCHRITT * TEST_MAX);
      const n = Math.max(1, Math.ceil(rest / TEST_SCHRITT));
      for (let i = 0; i < n; i++) {
        const dt = rest / (n - i);
        rest -= dt;
        game.time += dt;
        for (const fn of tickers) fn(dt, game);
      }
      rig.update(Math.min(echt, 0.1));
      dunst(scene, rig);
      renderer.render(scene, rig.camera);
      return;
    }
    // Langsame Geräte (unter 10 Bildern/s): die Spielzeit läuft trotzdem richtig, in Teilschritten
    // von höchstens 0,1 s echter Zeit, damit Boote und Regeln keine zu großen Sprünge machen.
    // Mehr als 0,25 s je Bild (Tab im Hintergrund, Hänger) holt das Spiel nicht nach (Feature-Test 14.11.).
    const raw = Math.min(delta, 0.1);
    const echt = game.paused ? 0 : Math.min(delta, 0.25);
    const schritte = Math.max(1, Math.ceil(echt / 0.1 - 1e-9));
    rig.update(raw);
    for (let i = 0; i < schritte; i++) {
      const dt = (echt / schritte) * game.speed;
      game.time += dt;
      for (const fn of tickers) fn(dt, game);
    }
    // Nebel aus dem Wetter zieht den Dunst weich heran
    rig.nebel += (nebelZiel - rig.nebel) * Math.min(1, raw * 0.8);
    dunst(scene, rig);
    renderer.render(scene, rig.camera);
  });

  return game;
}

// Dunst nur in der Perspektive und erst weit hinter dem Blickpunkt: von oben sieht man ihn nicht,
// bei flachem Blick blendet er den Rand der Landschaft und die Kante der Wasserflaeche aus.
function dunst(scene, rig) {
  const fog = scene.fog;
  if (!fog || !fog.isFog) return;
  if (scene.background?.isColor) fog.color.copy(scene.background);
  if (rig.projektion === 'ortho') { fog.near = 1e5; fog.far = 2e5; return; }
  const { nah, fern } = rig.dunst;
  fog.near = nah;
  fog.far = fern;
}

// Wie viel Bildschirm verdecken die Leisten oben und unten? Nur waagerechte Leisten zaehlen,
// seitliche (Handy quer) nicht. Hoechstens ein Viertel der Hoehe je Seite.
function hudInsets(canvas, w, h) {
  // Die Leisten sind heute durchsichtige Behaelter mit Knoepfen in den Ecken. Es zaehlt nur,
  // was wirklich ein grosses Stueck der Breite verdeckt: ein sichtbares Kind ab 30 % der Breite
  // oder eines ueber der Bildmitte. Kleine Eckknoepfe (Handy quer, PC) ueberdecken kaum etwas.
  const c = canvas.getBoundingClientRect();
  let top = 0;
  let bottom = 0;
  for (const id of ['hud-top', 'hud-bottom']) {
    const el = document.getElementById(id);
    if (!el || el.hidden) continue;
    const teile = el.children.length ? [...el.children] : [el];
    for (const k of teile) {
      const r = k.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      const mitte = r.left - c.left < w * 0.55 && r.right - c.left > w * 0.45;
      if (r.width < w * 0.3 && !mitte) continue;
      if (r.top - c.top < h / 2) top = Math.max(top, r.bottom - c.top);
      else bottom = Math.max(bottom, c.bottom - r.top);
    }
  }
  return [Math.min(top, h / 4), Math.min(bottom, h / 4)];
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

// Sichtbar nur, wenn das Objekt und alle Eltern sichtbar sind
function isShown(o) {
  for (; o; o = o.parent) if (!o.visible) return false;
  return true;
}

function pickAt(game, x, y, tolerance, types) {
  const rig = game.camera;
  _ndc.set((x / rig.screenW) * 2 - 1, -(y / rig.screenH) * 2 + 1);
  _ray.setFromCamera(_ndc, rig.camera);
  // 1. Genauer Treffer per Strahl
  for (const hit of _ray.intersectObjects(game.scene.children, true)) {
    if (!isShown(hit.object)) continue;
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
