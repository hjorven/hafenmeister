// Die feste Hafen-Palette (84 Farben).
// Entstanden aus den Farben des 3D-Spiels (k-Means ueber Tag, Abend, Nacht, alle Stufen, beide Reviere),
// etwas kraeftiger gemacht und je Farbe um eine kuehlere Schattenstufe ergaenzt, dazu Umriss-Dunkel,
// Lichtspitzen, Fensterlicht und Signalfarben. Sortiert nach Farbton, innerhalb von dunkel nach hell.
// Wer Farben aendert: werkstatt.html zeigt sofort, wie alles damit aussieht.
export const PALETTE = [
  '#2a2830', '#4a463f', '#4d5a5f', '#6c6f67', '#7a817f', '#7f8a89', '#8c949b', '#a3a0a7',
  '#cfc9b9', '#d8d7ca', '#e2e5d9', '#f2f0e6', '#fbf8f1', '#015554', '#38645e', '#516762',
  '#1c5a5f', '#006a71', '#327977', '#4d837b', '#679590', '#6aada9', '#7fb4b3', '#14253d',
  '#1f3341', '#2b3753', '#003d6d', '#3a4555', '#274776', '#396296', '#426c93', '#5c6376',
  '#527498', '#101322', '#637da3', '#340d14', '#5b0308', '#552724', '#760404', '#493426',
  '#63331c', '#743a07', '#67493f', '#8a3221', '#6f544b', '#af412a', '#e23b2e', '#754f29',
  '#7c5f46', '#9d6441', '#b5723a', '#aa836e', '#bd8e5c', '#b89480', '#847967', '#c7a26f',
  '#ccac8f', '#7e6308', '#ffb347', '#ffd27a', '#555732', '#58623a', '#989261', '#d5a92c',
  '#727755', '#88895d', '#a0a36e', '#597247', '#b0b3a1', '#c0bba7', '#a9bb82', '#c9c697',
  '#dfce9d', '#006832', '#42ac53', '#a8c894', '#164329', '#2e9d4a', '#849d8e', '#9dac9c',
  '#528c80', '#8dc5b7', '#a9d5c1', '#bfd9c7',
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
