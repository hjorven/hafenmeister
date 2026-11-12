// Geometrie fuer Stegbilder: Rechtecke, Linienflaechen, Schnitttests (Planeinheiten, y nach Norden).
// Gemeinsam fuer den Generator (tools/stegbilder/erzeugen.mjs) und die Pruefung (pruefen.mjs).

export const K = 1.6;                        // Planeinheiten je Meter (wie hafen_von_oben.py)
export const RAD = Math.PI / 180;

export const richtungsVektor = (grad) => [Math.cos(grad * RAD), Math.sin(grad * RAD)];
export const add = (a, b, f = 1) => [a[0] + b[0] * f, a[1] + b[1] * f];
export const links = (t) => [-t[1], t[0]];

/** Rechteck als Polygon: Mitte c, Laengsachse u (Einheitsvektor), halbe Laenge hl, halbe Breite hb. */
export function rechteck(c, u, hl, hb) {
  const n = links(u);
  return [
    [c[0] + u[0] * hl + n[0] * hb, c[1] + u[1] * hl + n[1] * hb],
    [c[0] - u[0] * hl + n[0] * hb, c[1] - u[1] * hl + n[1] * hb],
    [c[0] - u[0] * hl - n[0] * hb, c[1] - u[1] * hl - n[1] * hb],
    [c[0] + u[0] * hl - n[0] * hb, c[1] + u[1] * hl - n[1] * hb],
  ];
}

/** Rechteck aus Strecke a-b mit halber Breite hb (Stegflaeche ohne Gelenke). */
export function streckenFlaeche(a, b, hb, verlaengern = 0) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-6;
  const u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
  return rechteck([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], u, L / 2 + verlaengern, hb);
}

export function kreis(c, r, n = 12) {
  const p = [];
  for (let i = 0; i < n; i++) p.push([c[0] + Math.cos((i / n) * 2 * Math.PI) * r, c[1] + Math.sin((i / n) * 2 * Math.PI) * r]);
  return p;
}

function projiziere(poly, ax) {
  let lo = Infinity, hi = -Infinity;
  for (const p of poly) { const v = p[0] * ax[0] + p[1] * ax[1]; if (v < lo) lo = v; if (v > hi) hi = v; }
  return [lo, hi];
}

/** Schneiden sich zwei konvexe Polygone? (Trennachsen-Test, Beruehren zaehlt nicht) */
export function schneiden(a, b) {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      const ax = [-(q[1] - p[1]), q[0] - p[0]];
      const [a0, a1] = projiziere(a, ax), [b0, b1] = projiziere(b, ax);
      if (a1 <= b0 + 1e-9 || b1 <= a0 + 1e-9) return false;
    }
  }
  return true;
}

export function begrenzung(poly) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of poly) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return [x0, y0, x1, y1];
}

export function punktInPolygon(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Naechster Punkt auf einer Polylinie: { d, s (Bogenlaenge), i (Segment), seite (+1 links, -1 rechts) } */
export function aufLinie(punkte, px, py) {
  let best = { d: Infinity, s: 0, i: 0, seite: 0 }, acc = 0;
  for (let i = 0; i + 1 < punkte.length; i++) {
    const [ax, ay] = punkte[i], [bx, by] = punkte[i + 1];
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-9, L = Math.sqrt(l2);
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
    const cx = ax + dx * t, cy = ay + dy * t, d = Math.hypot(px - cx, py - cy);
    if (d < best.d - 1e-9) {
      const kreuz = dx * (py - ay) - dy * (px - ax);
      best = { d, s: acc + t * L, i, seite: kreuz >= 0 ? 1 : -1 };
    }
    acc += L;
  }
  return best;
}

export function linienLaenge(punkte) {
  let L = 0;
  for (let i = 1; i < punkte.length; i++) L += Math.hypot(punkte[i][0] - punkte[i - 1][0], punkte[i][1] - punkte[i - 1][1]);
  return L;
}

/** Zufall mit festem Startwert (mulberry32). */
export function zufall(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
