// Touch- und Zeigereingabe fuer die Hafenkarte.
//
// Geraeteneutral (Pointer Events), gedacht fuer Handy und Tablet, funktioniert
// aber auch mit Maus. Kennt weder Three.js noch die Spielregeln: Es verwaltet
// nur eine 2D-Ansicht (Mittelpunkt in Weltkoordinaten und Massstab) und meldet
// Tipps in Weltkoordinaten. Der Renderer liest die Ansicht ueber onChange aus,
// bei einer orthografischen Three.js-Kamera entspricht scale dem camera.zoom.
//
// Gesten
//   1 Finger ziehen      Karte verschieben
//   2 Finger             Pinch-Zoom und gleichzeitig verschieben
//   Tipp                 onTap(welt, bildschirm)
//   Doppeltipp           hineinzoomen, auf maximalem Zoom wieder heraus
//   Mausrad (PC)         zoomen um den Mauszeiger

const TAP_SLOP_PX = 10;        // so weit darf sich ein Finger bewegen und es bleibt ein Tipp
const TAP_MAX_MS = 350;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_DIST_PX = 30;

export function createTouchView(el, opts = {}) {
  const view = {
    x: opts.x ?? 0,          // Weltpunkt in der Bildschirmmitte
    y: opts.y ?? 0,
    scale: opts.scale ?? 1,  // Bildschirmpixel pro Welteinheit
  };
  let minScale = opts.minScale ?? 0.2;
  let maxScale = opts.maxScale ?? 8;
  let bounds = opts.bounds ?? null; // {x, y, w, h} in Weltkoordinaten
  const onTap = opts.onTap ?? (() => {});
  const onChange = opts.onChange ?? (() => {});
  const doubleTapZoom = opts.doubleTapZoom ?? true;

  const pointers = new Map(); // pointerId -> {x, y, startX, startY, t}
  let gesture = null;         // 'pan' | 'pinch' | null
  let pinchStart = null;
  let lastTap = null;
  let anim = null;

  el.style.touchAction = 'none';

  function rect() { return el.getBoundingClientRect(); }

  function local(e) {
    const r = rect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function screenToWorld(sx, sy) {
    const r = rect();
    return {
      x: view.x + (sx - r.width / 2) / view.scale,
      y: view.y + (sy - r.height / 2) / view.scale,
    };
  }

  function worldToScreen(wx, wy) {
    const r = rect();
    return {
      x: (wx - view.x) * view.scale + r.width / 2,
      y: (wy - view.y) * view.scale + r.height / 2,
    };
  }

  // Haelt die Ansicht innerhalb der Karte: Ist die Karte kleiner als der
  // Bildschirm, bleibt sie mittig, sonst darf man nicht ins Leere ziehen.
  function clamp() {
    view.scale = Math.min(maxScale, Math.max(minScale, view.scale));
    if (!bounds) return;
    const r = rect();
    const halfW = r.width / 2 / view.scale;
    const halfH = r.height / 2 / view.scale;
    const cx = bounds.x + bounds.w / 2;
    const cy = bounds.y + bounds.h / 2;
    view.x = bounds.w <= halfW * 2 ? cx
      : Math.min(bounds.x + bounds.w - halfW, Math.max(bounds.x + halfW, view.x));
    view.y = bounds.h <= halfH * 2 ? cy
      : Math.min(bounds.y + bounds.h - halfH, Math.max(bounds.y + halfH, view.y));
  }

  function emit() { clamp(); onChange(view); }

  function zoomAt(sx, sy, factor) {
    const before = screenToWorld(sx, sy);
    view.scale = Math.min(maxScale, Math.max(minScale, view.scale * factor));
    const after = screenToWorld(sx, sy);
    view.x += before.x - after.x;
    view.y += before.y - after.y;
    emit();
  }

  function stopAnim() { if (anim) { cancelAnimationFrame(anim); anim = null; } }

  // Weiche Kamerafahrt, z. B. wenn ein Boot gewaehlt wird und die passenden
  // Plaetze ins Bild sollen.
  function animateTo(target, ms = 280) {
    stopAnim();
    const from = { ...view };
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      view.x = from.x + (target.x - from.x) * e;
      view.y = from.y + (target.y - from.y) * e;
      view.scale = from.scale * Math.pow(target.scale / from.scale, e);
      emit();
      anim = k < 1 ? requestAnimationFrame(step) : null;
    };
    anim = requestAnimationFrame(step);
  }

  // Zeigt ein Rechteck in Weltkoordinaten ganz an. padding in Bildschirmpixeln,
  // als Zahl oder {top, right, bottom, left}, damit HUD-Leisten nichts verdecken.
  function fitRect(wr, padding = 24, { animate = true, maxZoom = maxScale } = {}) {
    const p = typeof padding === 'number'
      ? { top: padding, right: padding, bottom: padding, left: padding } : padding;
    const r = rect();
    const availW = Math.max(40, r.width - p.left - p.right);
    const availH = Math.max(40, r.height - p.top - p.bottom);
    const scale = Math.min(maxZoom, maxScale,
      Math.max(minScale, Math.min(availW / Math.max(wr.w, 1e-6), availH / Math.max(wr.h, 1e-6))));
    // Mittelpunkt so verschieben, dass das Rechteck im freien Bereich mittig liegt
    const offX = (p.left - p.right) / 2 / scale;
    const offY = (p.top - p.bottom) / 2 / scale;
    const target = { x: wr.x + wr.w / 2 - offX, y: wr.y + wr.h / 2 - offY, scale };
    if (animate) animateTo(target); else { Object.assign(view, target); emit(); }
  }

  function onDown(e) {
    stopAnim();
    el.setPointerCapture?.(e.pointerId);
    const p = local(e);
    pointers.set(e.pointerId, { ...p, startX: p.x, startY: p.y, t: performance.now() });
    if (pointers.size === 1) {
      gesture = null;
    } else if (pointers.size === 2) {
      gesture = 'pinch';
      const [a, b] = [...pointers.values()];
      pinchStart = {
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        scale: view.scale,
        world: screenToWorld((a.x + b.x) / 2, (a.y + b.y) / 2),
      };
    }
  }

  function onMove(e) {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const p = local(e);
    if (gesture === 'pinch' && pointers.size >= 2) {
      prev.x = p.x; prev.y = p.y;
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      view.scale = Math.min(maxScale, Math.max(minScale, pinchStart.scale * dist / pinchStart.dist));
      // Weltpunkt unter der Fingermitte bleibt unter der Fingermitte
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const r = rect();
      view.x = pinchStart.world.x - (mid.x - r.width / 2) / view.scale;
      view.y = pinchStart.world.y - (mid.y - r.height / 2) / view.scale;
      emit();
      return;
    }
    if (pointers.size !== 1) return;
    if (!gesture && Math.hypot(p.x - prev.startX, p.y - prev.startY) > TAP_SLOP_PX) gesture = 'pan';
    if (gesture === 'pan') {
      view.x -= (p.x - prev.x) / view.scale;
      view.y -= (p.y - prev.y) / view.scale;
      emit();
    }
    prev.x = p.x; prev.y = p.y;
  }

  function onUp(e) {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    pointers.delete(e.pointerId);
    const wasTap = !gesture && pointers.size === 0
      && performance.now() - prev.t < TAP_MAX_MS && e.type === 'pointerup';
    if (pointers.size === 1 && gesture === 'pinch') {
      // Nach dem Pinch nicht als Tipp werten, aber mit dem letzten Finger weiter ziehen
      gesture = 'pan';
      const [rest] = pointers.values();
      rest.startX = rest.x; rest.startY = rest.y;
    }
    if (pointers.size === 0) gesture = null;
    if (!wasTap) return;

    const now = performance.now();
    if (doubleTapZoom && lastTap && now - lastTap.t < DOUBLE_TAP_MS
        && Math.hypot(prev.x - lastTap.x, prev.y - lastTap.y) < DOUBLE_TAP_DIST_PX) {
      lastTap = null;
      const factor = view.scale >= maxScale * 0.95 ? minScale / view.scale : 2;
      const before = screenToWorld(prev.x, prev.y);
      const target = { x: 0, y: 0, scale: Math.min(maxScale, Math.max(minScale, view.scale * factor)) };
      const r = rect();
      target.x = before.x - (prev.x - r.width / 2) / target.scale;
      target.y = before.y - (prev.y - r.height / 2) / target.scale;
      animateTo(target, 220);
      return;
    }
    lastTap = { t: now, x: prev.x, y: prev.y };
    onTap(screenToWorld(prev.x, prev.y), { x: prev.x, y: prev.y });
  }

  function onWheel(e) {
    e.preventDefault();
    const p = local(e);
    zoomAt(p.x, p.y, Math.exp(-e.deltaY * 0.0015));
  }

  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);
  el.addEventListener('wheel', onWheel, { passive: false });
  // iOS Safari: Seitenzoom per Geste auf der Karte verhindern
  el.addEventListener('gesturestart', (e) => e.preventDefault());

  const ro = new ResizeObserver(() => emit());
  ro.observe(el);

  return {
    view,
    screenToWorld,
    worldToScreen,
    fitRect,
    animateTo,
    zoomAt,
    setBounds(b) { bounds = b; emit(); },
    setScaleLimits(min, max) { minScale = min; maxScale = max; emit(); },
    destroy() {
      stopAnim();
      ro.disconnect();
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('wheel', onWheel);
    },
  };
}

// Waehlt das naechste Ziel zum Tipp. Auf dem Handy sind Liegeplaetze bei
// herausgezoomter Karte oft nur wenige Pixel gross. Deshalb zaehlt nicht nur
// ein Treffer im Ziel, sondern alles im Umkreis von radiusPx Bildschirmpixeln.
// targets: [{x, y, w, h, ...}] in Weltkoordinaten (x, y = linke obere Ecke).
export function pickNearest(targets, world, scale, radiusPx = 22) {
  const maxDist = radiusPx / scale;
  let best = null;
  let bestD = Infinity;
  for (const t of targets) {
    const dx = Math.max(t.x - world.x, 0, world.x - (t.x + t.w));
    const dy = Math.max(t.y - world.y, 0, world.y - (t.y + t.h));
    const d = Math.hypot(dx, dy);
    if (d <= maxDist && d < bestD) { best = t; bestD = d; }
  }
  return best;
}

// Rechteck um mehrere Ziele, z. B. alle passenden freien Plaetze.
export function boundsOf(targets) {
  if (!targets.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const t of targets) {
    x0 = Math.min(x0, t.x); y0 = Math.min(y0, t.y);
    x1 = Math.max(x1, t.x + t.w); y1 = Math.max(y1, t.y + t.h);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

// Kurzes Antippen fuehlbar machen (nur Android, iOS ignoriert es).
export function haptic(ms = 12) {
  try { navigator.vibrate?.(ms); } catch { /* egal */ }
}

// Schmale Schnittstelle fuer den Tablet-Thread und hud.js.
// view.zoom entspricht view.scale (Bildschirmpixel pro Welteinheit).
export function attachMapGestures(el, { minZoom = 0.2, maxZoom = 8, onChange, onTap, bounds, start } = {}) {
  const startView = { x: start?.x ?? 0, y: start?.y ?? 0, scale: start?.zoom ?? 1 };
  const tv = createTouchView(el, {
    ...startView, minScale: minZoom, maxScale: maxZoom, bounds,
    onTap,
    onChange: (v) => onChange?.({ x: v.x, y: v.y, zoom: v.scale }),
  });
  return {
    reset() { tv.animateTo({ ...startView }); },
    setView({ x = tv.view.x, y = tv.view.y, zoom = tv.view.scale }) { tv.animateTo({ x, y, scale: zoom }); },
    fitRect: tv.fitRect,
    screenToWorld: tv.screenToWorld,
    worldToScreen: tv.worldToScreen,
    get view() { return { x: tv.view.x, y: tv.view.y, zoom: tv.view.scale }; },
    destroy: tv.destroy,
  };
}
