// Gemeinsame Zeiger-Steuerung fuer Maus, Touch und Stift (Pointer Events).
// Ein Finger ziehen: Karte verschieben, beim Loslassen mit Schwung.
// Zwei Finger: Die ersten Millimeter entscheiden, was die Geste ist:
//   - beide Finger gemeinsam hoch oder runter: Kamera neigen (hoch = flacher, runter = steiler)
//   - sonst: spreizen zoomt, gemeinsam ziehen verschiebt, drehen dreht (frei, ab etwa 10 Grad)
// Mausrad: zoomen. Kurz antippen ohne Bewegung: game.emit('tap', { x, y, world, pick }).
// Geraetespezifisches (Tastatur, Rechtsklick usw.) kommt in eigene Module, z. B. js/ui/input-pc.js.

const TAP_SLOP = 10;        // Pixel, ab denen aus einem Tipp ein Ziehen wird
const TAP_TIME = 350;       // ms
const ROTATE_START = 0.18;  // rad, erst ab etwa 10 Grad drehen, sonst dreht jeder Pinch mit
const DECIDE_PX = 14;       // Pixel, nach denen eine Zwei-Finger-Geste festgelegt wird
const TILT_RAD_PER_PX = 0.0045;

export function initInput(game) {
  const el = game.canvas;
  const cam = game.camera;
  const pointers = new Map();
  let pinchDist = 0;
  let pinchMid = null;
  let pinchAngle = 0;
  let twist = 0;          // aufgelaufene Drehung, solange noch nicht gedreht wird
  let rotating = false;
  let tapCandidate = null;
  let mode = null;        // Zwei Finger: null (noch offen), 'tilt' oder 'pinch'
  let start2 = null;      // Lage beider Finger beim Aufsetzen des zweiten
  let velo = { x: 0, y: 0, t: 0 };   // Tempo beim Verschieben, fuer den Schwung

  const pos = (e) => {
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  el.addEventListener('pointerdown', (e) => {
    try { el.setPointerCapture(e.pointerId); } catch { /* z. B. synthetische Ereignisse */ }
    const p = pos(e);
    pointers.set(e.pointerId, p);
    cam.stop?.();
    velo = { x: 0, y: 0, t: performance.now() };
    if (pointers.size === 1) {
      tapCandidate = { ...p, t: performance.now(), id: e.pointerId };
    } else {
      tapCandidate = null;
      const [a, b] = [...pointers.values()];
      pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      pinchMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      pinchAngle = Math.atan2(b.y - a.y, b.x - a.x);
      twist = 0;
      rotating = false;
      mode = null;
      start2 = { a: { ...a }, b: { ...b }, dist: pinchDist, angle: pinchAngle };
    }
  });

  // Zwei Finger: Neigen, wenn beide etwa gleich weit senkrecht in dieselbe Richtung laufen
  function decide(a, b) {
    const s = start2;
    const ay = a.y - s.a.y, by = b.y - s.b.y;
    const ax = a.x - s.a.x, bx = b.x - s.b.x;
    const weg = Math.max(Math.hypot(ax, ay), Math.hypot(bx, by));
    if (weg < DECIDE_PX) return null;
    const my = (ay + by) / 2, mx = (ax + bx) / 2;
    const spread = Math.abs(Math.hypot(a.x - b.x, a.y - b.y) - s.dist);
    let turn = Math.atan2(b.y - a.y, b.x - a.x) - s.angle;
    if (turn > Math.PI) turn -= 2 * Math.PI;
    if (turn < -Math.PI) turn += 2 * Math.PI;
    const gleich = ay * by > 0 && Math.min(Math.abs(ay), Math.abs(by)) > Math.max(Math.abs(ay), Math.abs(by)) * 0.4;
    // Finger nebeneinander (eher waagerecht), sonst ist "gemeinsam senkrecht" ein Zoom
    const nebeneinander = Math.abs(s.b.x - s.a.x) > Math.abs(s.b.y - s.a.y) * 0.8;
    if (gleich && nebeneinander && Math.abs(my) > Math.abs(mx) * 1.6 && spread < Math.abs(my) * 0.6 && Math.abs(turn) < 0.12) return 'tilt';
    return 'pinch';
  }

  el.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId);
    const p = pos(e);
    pointers.set(e.pointerId, p);

    if (pointers.size === 1) {
      if (tapCandidate && Math.hypot(p.x - tapCandidate.x, p.y - tapCandidate.y) < TAP_SLOP) return;
      tapCandidate = null;
      const dx = p.x - prev.x, dy = p.y - prev.y;
      cam.panBy(dx, dy);
      // Tempo fuer den Schwung beim Loslassen (geglaettet)
      const now = performance.now();
      const dt = Math.max(8, now - velo.t) / 1000;
      velo = { x: velo.x * 0.3 + (dx / dt) * 0.7, y: velo.y * 0.3 + (dy / dt) * 0.7, t: now };
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (!mode && start2) mode = decide(a, b);
      if (mode === 'tilt') {
        // Finger nach oben: flacher (mehr Horizont), nach unten: steiler (mehr von oben)
        if (pinchMid && cam.tiltFree) cam.tiltFree((mid.y - pinchMid.y) * TILT_RAD_PER_PX);
        pinchDist = dist;
        pinchMid = mid;
        pinchAngle = Math.atan2(b.y - a.y, b.x - a.x);
        return;
      }
      if (!mode) {
        // Noch unentschieden: nichts bewegen, aber Bezugswerte nicht nachziehen,
        // damit der erste Zoom nach der Entscheidung den ganzen Weg mitnimmt
        return;
      }
      if (pinchDist > 0) cam.zoomAt(dist / pinchDist, mid.x, mid.y);
      if (pinchMid) cam.panBy(mid.x - pinchMid.x, mid.y - pinchMid.y);
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      let d = angle - pinchAngle;
      if (d > Math.PI) d -= 2 * Math.PI;
      if (d < -Math.PI) d += 2 * Math.PI;
      pinchAngle = angle;
      if (!rotating) {
        twist += d;
        if (Math.abs(twist) > ROTATE_START) { rotating = true; cam.rotateFree(twist); }
      } else {
        cam.rotateFree(d);     // Finger im Uhrzeigersinn dreht die Karte im Uhrzeigersinn
      }
      pinchDist = dist;
      pinchMid = mid;
    }
  });

  const end = (e) => {
    if (!pointers.has(e.pointerId)) return;
    const p = pos(e);
    pointers.delete(e.pointerId);
    if (e.type === 'pointerup' && tapCandidate && tapCandidate.id === e.pointerId &&
        performance.now() - tapCandidate.t < TAP_TIME) {
      game.emit('tap', { x: p.x, y: p.y, world: cam.screenToWorld(p.x, p.y), pick: game.pick(p.x, p.y) });
    }
    tapCandidate = null;
    if (pointers.size < 2) {
      if (rotating || mode === 'tilt') cam.release?.();
      // Letzter Finger hebt nach dem Verschieben ab: Karte gleitet mit Schwung weiter
      if (pointers.size === 0 && !start2 && performance.now() - velo.t < 60) cam.fling?.(velo.x, velo.y);
      pinchDist = 0;
      pinchMid = null;
      rotating = false;
      mode = null;
      velo = { x: 0, y: 0, t: 0 };
    }
    if (pointers.size === 0) start2 = null;
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);

  el.addEventListener('wheel', (e) => {
    e.preventDefault();
    const p = pos(e);
    cam.zoomAt(Math.exp(-e.deltaY * 0.0015), p.x, p.y);
  }, { passive: false });

  // iOS Safari: eigenes Zoomen per Geste unterbinden
  document.addEventListener('gesturestart', (e) => e.preventDefault());
}
