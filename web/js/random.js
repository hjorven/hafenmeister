// Zufall mit Seed (mulberry32). Der Zustand liegt in state.rng, damit Spielstände reproduzierbar sind.

/** Gleichverteilte Zufallszahl in [0, 1). Schreibt den Zustand des Zufalls in den Spielstand (mulberry32). */
export function random(state) {
  state.rng = (state.rng + 0x6d2b79f5) >>> 0;
  let t = state.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Ganze Zahl von min bis max (beide eingeschlossen). */
export function randomInt(state, min, max) {
  return min + Math.floor(random(state) * (max - min + 1));
}

/** Zahl von min bis max, auf eine Nachkommastelle gerundet. */
export function randomRange(state, min, max) {
  return Math.round((min + random(state) * (max - min)) * 10) / 10;
}

/** Wählt einen Eintrag aus { schlüssel: gewicht }. */
export function randomWeighted(state, weights) {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  const total = entries.reduce((a, [, w]) => a + w, 0);
  let r = random(state) * total;
  for (const [key, w] of entries) {
    r -= w;
    if (r < 0) return key;
  }
  return entries.length ? entries[entries.length - 1][0] : undefined;
}

/** Wählt ein Element aus einer Liste. */
export function randomPick(state, list) {
  return list[Math.floor(random(state) * list.length)];
}

/**
 * Eigener Zufall mit Startwert für Module ohne Spielstand (Services-Abrechnung, Ereignis-Planer,
 * Balancing). Gleicher Startwert, gleiche Folge. Liefert eine Funktion wie Math.random.
 * Regel: Alles, was Geld, Gäste oder Ruf ändert, nimmt random(state) oder zufallAus(seed),
 * nie Math.random (das bleibt der Optik vorbehalten: Menschen, Wellen, Funken).
 */
export function zufallAus(seed) {
  const st = { rng: seed >>> 0 };
  return () => random(st);
}
