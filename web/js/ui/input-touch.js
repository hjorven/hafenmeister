// Touch-Ergaenzungen fuer Handy und Tablet. Wird von main.js geladen (init(game)).
//
// core/input.js macht schon das Grundlegende: ein Finger zieht, zwei Finger
// zoomen, kurzer Tipp sendet 'tap'. Dieses Modul legt nur obendrauf, was auf
// Touch-Geraeten fehlt, und sendet dafuer eigene Ereignisse. Spielregeln kennt
// es nicht, die Module, die auf die Ereignisse hoeren, entscheiden, was passiert.
//
// Ereignisse (game.on(name, fn), pick = Ergebnis von game.pick oder null):
//   'doubletap'    { x, y, world, pick }   zusaetzlich zoomt die Kamera weich hinein,
//                                          ganz hineingezoomt geht es zur Uebersicht
//   'longpress'    { x, y, world, pick }   Finger ruht 0,5 s; liegt er auf einem Boot,
//                                          hupt es (Ereignis 'horn' an das Ton-Modul)
//
// Boot von der Warteboje ziehen, Kassierstrich und Sonne ziehen stehen
// geraeteuebergreifend in js/ui/gesten.js (Tablet-Thread).
//
// Auf diese Spielereignisse gibt es ein kurzes Vibrieren (nur Android):
//   'boat-docked', 'coin', 'built', 'no-berth'

import { haptic } from './touch-view.js';

export { createTouchView, attachMapGestures, pickNearest, boundsOf, haptic } from './touch-view.js';

const DOUBLE_TAP_MS = 350;
const DOUBLE_TAP_PX = 30;
const LONG_PRESS_MS = 500;
const MOVE_SLOP_PX = 10;

const isTouchDevice = () => matchMedia('(pointer: coarse)').matches;
const isPhone = () => matchMedia('(max-width: 599px), (max-height: 499px)').matches;

export function init(game) {
  const el = game.canvas;
  const cam = game.camera;
  const local = (e) => {
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const pick = (p, types) => (typeof game.pick === 'function' ? game.pick(p.x, p.y, types ? { types } : {}) : null);
  const at = (p, types) => ({ x: p.x, y: p.y, world: cam.screenToWorld(p.x, p.y), pick: pick(p, types) });

  // ---------- Doppeltipp: weich hineinzoomen ----------
  let lastTap = null;
  game.on('tap', (t) => {
    const now = performance.now();
    if (lastTap && now - lastTap.t < DOUBLE_TAP_MS && Math.hypot(t.x - lastTap.x, t.y - lastTap.y) < DOUBLE_TAP_PX) {
      lastTap = null;
      game.emit('doubletap', { ...t, pick: t.pick ?? pick(t) });
      // ganz hineingezoomt: zurueck zur Uebersicht, sonst doppelt so nah
      if (cam.viewWidth !== undefined && cam.viewWidth <= cam.minWidth * 1.05) cam.reset();
      else smoothZoom(cam, 2, t.x, t.y);
      return;
    }
    lastTap = { t: now, x: t.x, y: t.y };
  });

  // ---------- Langes Druecken ----------
  const down = new Map();
  let press = null;
  el.addEventListener('pointerdown', (e) => {
    const p = local(e);
    down.set(e.pointerId, p);
    clearTimeout(press?.timer);
    press = null;
    if (down.size === 1) {
      press = { id: e.pointerId, start: p, timer: setTimeout(() => {
        if (!press) return;
        haptic(30);
        game.emit('longpress', at(press.start));
        press = null;
      }, LONG_PRESS_MS) };
    }
  });

  el.addEventListener('pointermove', (e) => {
    if (!down.has(e.pointerId)) return;
    const p = local(e);
    down.set(e.pointerId, p);
    if (press && press.id === e.pointerId && Math.hypot(p.x - press.start.x, p.y - press.start.y) > MOVE_SLOP_PX) {
      clearTimeout(press.timer);
      press = null;
    }
  });

  const up = (e) => {
    down.delete(e.pointerId);
    if (press && press.id === e.pointerId) { clearTimeout(press.timer); press = null; }
  };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  // Kein Kontextmenue bei langem Druecken (Android, Desktop-Touchscreens)
  el.addEventListener('contextmenu', (e) => { if (isTouchDevice()) e.preventDefault(); });

  // ---------- Knopfspalte rechts (Handy hochkant) ----------
  // Pause, Uebersicht, Foto, Ton und Spielstand stehen rechts untereinander.
  // Die Startansicht und der Knopf "Uebersicht" lassen diesen Streifen frei,
  // damit keine Warteboje unter einem Knopf liegt.
  const rightColumn = () => {
    if (!isPhone() || innerWidth > innerHeight) return 0;
    const btn = document.getElementById('btn-pause');
    if (!btn) return 0;
    // Aus den CSS-Werten statt aus dem Layout: beim Start ist die Leiste evtl. noch nicht gezeichnet
    const cs = getComputedStyle(btn);
    if (cs.position !== 'absolute') return 0;
    const px = (v) => parseFloat(v) || 0;
    return px(cs.right) + px(cs.width) + 4;
  };
  if (typeof cam.setInsetRight === 'function') {
    const update = () => cam.setInsetRight(rightColumn());
    // Erst wenn alle Module geladen sind, steht die Knopfspalte. Die Kamera zeigt
    // dann noch die Startansicht, also einmal neu einpassen.
    game.on('ready', () => requestAnimationFrame(() => {
      const before = cam.insetRight || 0;
      update();
      if ((cam.insetRight || 0) !== before) cam.reset();
    }));
    game.on('resize', update);
    addEventListener('orientationchange', () => setTimeout(update, 300));
  }

  // ---------- Boot gewaehlt: Stege frei halten (nur Handy) ----------
  // Die Bootskarte liegt unten ueber der Karte. Damit man die Stege darueber
  // antippen kann, wird die Karte knapp (CSS) und die Ansicht um die halbe
  // Kartenhoehe nach oben geschoben; beim Abwaehlen geht sie zurueck.
  // Waehrend einer Schleppleine (gesten.js: ui:tow ... ui:tow-end) bleibt die
  // Ansicht stehen und die Karte verborgen (Klasse hm-leine), sonst wandern die
  // Ringe unter dem Finger weg. Erst nach dem Loslassen geht es weiter.
  let shifted = 0;
  let towing = false;
  const release = () => {
    document.body.classList.remove('hm-boot-gewaehlt');
    if (shifted) { cam.panBy(0, shifted); shifted = 0; }
  };
  // Nach dem Zuweisen kommt kein sim:select mehr, die Karte schliesst sich aber
  const cardEl = document.getElementById('card');
  if (cardEl) new MutationObserver(() => { if (cardEl.hidden) release(); })
    .observe(cardEl, { attributes: true, attributeFilter: ['hidden'] });
  const onSelect = (boatId) => {
    if (towing) return;
    const on = boatId != null && isPhone();
    if (!on) { release(); return; }
    document.body.classList.add('hm-boot-gewaehlt');
    if (shifted) return;
    // Erst nach dem Rendern der Karte messen
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const card = document.getElementById('card');
      if (towing || !card || card.hidden || !document.body.classList.contains('hm-boot-gewaehlt')) return;
      const portrait = innerHeight >= innerWidth;
      if (!portrait) return;   // quer liegt die Karte rechts daneben
      shifted = Math.round(card.getBoundingClientRect().height / 2);
      cam.panBy(0, -shifted);
    }));
  };
  game.on('sim:select', ({ boatId } = {}) => onSelect(boatId));
  game.on('ui:tow', () => {
    if (towing) return;
    towing = true;
    document.body.classList.add('hm-leine');
  });
  game.on('ui:tow-end', () => {
    if (!towing) return;
    towing = false;
    document.body.classList.remove('hm-leine');
    // Zugewiesen: Auswahl ist leer. Abgebrochen: Boot bleibt gewaehlt, Karte kommt jetzt.
    onSelect(game.sim?.selected ?? null);
  });

  // Genau ein Einfahren-Knopf: Am Handy steht "Automatisch einfahren" gross in
  // der Bootskarte (hud.js), der kleine Knopf am Boot (gesten.js) ist per CSS aus.
  // hud.js fragt game.gesten.einfahrenAmBoot, das ist am Handy deshalb false.
  game.on('ready', () => {
    const g = game.gesten;
    if (!g) return;
    let amBoot = g.einfahrenAmBoot;
    Object.defineProperty(g, 'einfahrenAmBoot', {
      configurable: true,
      enumerable: true,
      get: () => (isPhone() ? false : amBoot),
      set: (v) => { amBoot = v; },
    });
  });

  // Boot im Hafen gedrueckt halten: es antwortet mit seinem Horn
  game.on('longpress', ({ pick: p }) => {
    if (p?.type !== 'boat' || !game.sim) return;
    const sim = game.sim;
    const all = [...(sim.mooredBoats?.() ?? []), ...(sim.waitingBoats?.() ?? [])];
    const boat = all.find((b) => String(b.id) === String(p.id));
    if (boat) game.emit('horn', { groesse: boat.size, stoesse: 1 });
  });

  // ---------- Fuehlbare Rueckmeldung ----------
  game.on('boat-docked', () => haptic(15));
  game.on('coin', () => haptic(6));
  game.on('built', () => haptic(20));
  game.on('no-berth', () => haptic([20, 40, 20]));
}

// Mehrere kleine Zoomschritte statt eines Sprungs. Laeuft auch in der Pause.
function smoothZoom(cam, factor, x, y, ms = 220) {
  const t0 = performance.now();
  let done = 0; // bereits angewendeter Anteil (logarithmisch)
  const step = (now) => {
    const k = Math.min(1, (now - t0) / ms);
    const e = 1 - Math.pow(1 - k, 3);
    cam.zoomAt(Math.pow(factor, e - done), x, y);
    done = e;
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
