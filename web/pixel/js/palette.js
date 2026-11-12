// Die feste Hafen-Palette (71 Farben).
// Entstanden aus den Farben des 3D-Spiels (k-Means ueber Tag, Abend, Nacht, alle Stufen, beide Reviere),
// etwas kraeftiger gemacht und je Farbe um eine kuehlere Schattenstufe ergaenzt, dazu Umriss-Dunkel,
// Lichtspitzen, Fensterlicht und Signalfarben. Sortiert nach Farbton, innerhalb von dunkel nach hell.
// Wer Farben aendert: werkstatt.html zeigt sofort, wie alles damit aussieht.
export const PALETTE = [
  '#2b2329', '#343d42', '#4f5b5e', '#556762', '#6a7066', '#757873', '#7f8a88', '#cfcab9',
  '#d7d7ca', '#e2e5d8', '#fbf8f1', '#056568', '#2b6e73', '#327976', '#4c837b', '#609899',
  '#67a59d', '#80b4af', '#12212e', '#21343f', '#1a2948', '#2b3753', '#003d6d', '#2a4774',
  '#424c63', '#396395', '#426c93', '#5c6376', '#527499', '#657da2', '#120f1d', '#3a000a',
  '#5f0003', '#5b1b17', '#721408', '#912918', '#3e2a1c', '#ab492e', '#e23b2e', '#703e13',
  '#6a4e35', '#7a5d34', '#786552', '#b07541', '#bc9369', '#c7a26d', '#c8ad8e', '#ffb347',
  '#40402b', '#816505', '#535637', '#847a57', '#969166', '#d9ac2a', '#9ea270', '#bdbba6',
  '#c9c697', '#e0ce9d', '#ffd27a', '#56623b', '#066734', '#577246', '#6e876b', '#a1ac9c',
  '#a8bb81', '#aac691', '#305141', '#2e9d4a', '#3fad51', '#8dc5b6', '#a8d5c1',
];

// ---- Umrechnung nach OKLab, damit "naechste Farbe" so aussieht, wie das Auge es sieht ----
function srgbToLinear(v) {
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}
function oklab(r, g, b) {
  r = srgbToLinear(r); g = srgbToLinear(g); b = srgbToLinear(b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const LUT_SIZE = 32;

// Nachschlagetabelle LUT_SIZE^3: fuer jede sRGB-Farbe die naechste Palettenfarbe (RGBA, 8 Bit).
// Helligkeit zaehlt etwas staerker als Farbton, damit Licht und Schatten erhalten bleiben.
export function buildLut(palette, size = LUT_SIZE) {
  const pal = palette.map((h) => { const c = hexToRgb(h); return { c, lab: oklab(c[0] / 255, c[1] / 255, c[2] / 255) }; });
  const out = new Uint8Array(size * size * size * 4);
  let i = 0;
  for (let b = 0; b < size; b++) {
    for (let g = 0; g < size; g++) {
      for (let r = 0; r < size; r++) {
        const lab = oklab(r / (size - 1), g / (size - 1), b / (size - 1));
        let best = pal[0], bestD = Infinity;
        for (const p of pal) {
          const dl = (lab[0] - p.lab[0]) * 1.4;
          const da = lab[1] - p.lab[1];
          const db = lab[2] - p.lab[2];
          const d = dl * dl + da * da + db * db;
          if (d < bestD) { bestD = d; best = p; }
        }
        out[i++] = best.c[0]; out[i++] = best.c[1]; out[i++] = best.c[2]; out[i++] = 255;
      }
    }
  }
  return out;
}
