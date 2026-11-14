// Geduldsring wartender Boote (Paket P55, docs/hafenzeichen.md): reine Rechnung und Pixelbild.
// Gezeichnet wird er in der Wunschreihe über dem Boot (ui/vorschau.js) und in den Zeigern am
// Bildrand (ui/hafenzeichen.js). Ohne DOM, läuft auch unter Node (tests/hafenzeichen.test.mjs).

/** Schritte, in denen der Ring abläuft (je Schritt ein Bild). */
export const RING_SCHRITTE = 24;

export const RING_FARBE = {
  gruen: '#3b9a4a',
  gelb: '#d9a514',
  rot: '#c8452f',
  pause: '#6f8296',
};

/**
 * Zustand des Rings aus der restlichen Geduld.
 * rest, voll in Sekunden; laeuft = zählt die Geduld gerade?
 * -> { anteil 0..1, schritt 0..RING_SCHRITTE, farbe, eilig (letztes Drittel und läuft) }
 */
export function ringZustand(rest, voll, laeuft = true) {
  const anteil = voll > 0 ? Math.max(0, Math.min(1, rest / voll)) : 0;
  // aufrunden: Ein Boot mit ein wenig Geduld zeigt nie einen leeren Ring
  const schritt = anteil <= 0 ? 0 : Math.max(1, Math.ceil(anteil * RING_SCHRITTE - 1e-9));
  let farbe = anteil > 2 / 3 ? 'gruen' : anteil > 1 / 3 ? 'gelb' : 'rot';
  if (!laeuft) farbe = 'pause';
  return { anteil, schritt, farbe, eilig: laeuft && anteil <= 1 / 3 };
}

/**
 * Pixelbild des Rings, 12 x 12: '#' Geduld, '-' schon abgelaufen, '.' leer.
 * Der Ring läuft im Uhrzeigersinn ab und beginnt oben (wie eine Uhr, die rückwärts läuft).
 */
export function ringRaster(schritt, schritte = RING_SCHRITTE) {
  const zeilen = [];
  const grenze = (schritt / schritte) * Math.PI * 2;
  for (let y = 0; y < 12; y++) {
    let z = '';
    for (let x = 0; x < 12; x++) {
      const dx = x + 0.5 - 6, dy = y + 0.5 - 6;
      const r = Math.hypot(dx, dy);
      if (r < 3.3 || r > 5.6) { z += '.'; continue; }
      let a = Math.atan2(dx, -dy);
      if (a < 0) a += Math.PI * 2;
      z += a < grenze - 1e-9 ? '#' : '-';
    }
    zeilen.push(z);
  }
  return zeilen;
}

const SPUR = '#c9c0ab';
function ringSvg(schritt, farbe) {
  const raster = ringRaster(schritt);
  let r = '';
  raster.forEach((zeile, y) => [...zeile].forEach((c, x) => {
    if (c === '.') return;
    r += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${c === '#' ? farbe : SPUR}"/>`;
  }));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" shape-rendering="crispEdges">${r}</svg>`;
}
const bilder = new Map();
/** CSS-Bild (url(...)) des Rings in einem Zustand, zwischengespeichert. */
export function ringBild(z) {
  const key = `${z.schritt}|${z.farbe}`;
  let b = bilder.get(key);
  if (!b) {
    b = `url("data:image/svg+xml,${encodeURIComponent(ringSvg(z.schritt, RING_FARBE[z.farbe]))}")`;
    bilder.set(key, b);
  }
  return b;
}

