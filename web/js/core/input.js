// Gemeinsame Zeiger-Steuerung fuer Maus, Touch und Stift (Pointer Events).
// Ein Finger ziehen: Karte verschieben. Zwei Finger: zoomen und verschieben. Mausrad: zoomen.
// Kurz antippen ohne Bewegung: game.emit('tap', { x, y, world }).
// Geraetespezifisches (Tastatur, Rechtsklick usw.) kommt in eigene Module, z. B. js/ui/input-pc.js.

const TAP_SLOP = 10;        // Pixel, ab denen aus einem Tipp ein Ziehen wird
const TAP_TIME = 350;       // ms

export function initInput(game) {
  const el = game.canvas;
  const cam = game.camera;
  const pointers = new Map();
  let pinchDist = 0;
  let pinchMid = null;
  let tapCandidate = null;

  const pos = (e) => {
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  el.addEventListener('pointerdown', (e) => {
    el.setPointerCapture(e.pointerId);
    const p = pos(e);
    pointers.set(e.pointerId, p);
    if (pointers.size === 1) {
      tapCandidate = { ...p, t: performance.now(), id: e.pointerId };
    } else {
      tapCandidate = null;
      const [a, b] = [...pointers.values()];
      pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      pinchMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
  });

  el.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId);
    const p = pos(e);
    pointers.set(e.pointerId, p);

    if (pointers.size === 1) {
      if (tapCandidate && Math.hypot(p.x - tapCandidate.x, p.y - tapCandidate.y) < TAP_SLOP) return;
      tapCandidate = null;
      cam.panBy(p.x - prev.x, p.y - prev.y);
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (pinchDist > 0) cam.zoomAt(dist / pinchDist, mid.x, mid.y);
      if (pinchMid) cam.panBy(mid.x - pinchMid.x, mid.y - pinchMid.y);
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
      game.emit('tap', { x: p.x, y: p.y, world: cam.screenToWorld(p.x, p.y) });
    }
    tapCandidate = null;
    if (pointers.size < 2) { pinchDist = 0; pinchMid = null; }
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
