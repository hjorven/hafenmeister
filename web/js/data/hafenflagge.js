// Hafenname und eigene Flagge (P44, F23, F27). Reine Daten und Regeln, ohne DOM und ohne Three.js,
// damit Spielstand-Prüfung (state.js), Speicherplätze (save/plaetze.js), Oberfläche und 3D-Bild
// dieselben Regeln nutzen. Beschreibung: docs/hafenflagge.md.
//
// Sicherheit (Audit C05): Ein Hafenname ist Spielereingabe und reist in Dateien mit. Er wird überall
// nur als Text gezeigt (textContent, Canvas-fillText), nie als HTML. hafenNameSauber() lässt dazu nur
// Buchstaben, Ziffern, Leerzeichen und wenige Satzzeichen durch, schneidet nach Zeichen (nicht nach
// UTF-16-Einheiten) und entfernt Steuer- und Richtungszeichen. Eine Flagge besteht nur aus IDs dieser
// Datei; alles andere fällt beim Laden auf die Flagge aus dem Seed zurück.

export const NAME_MAX = 32;

// Erlaubt: Buchstaben (mit Akzenten), Ziffern, Leerzeichen und . , - ' ’ & ( ) ! ? / : + #
const NICHT_ERLAUBT = /[^\p{L}\p{M}\p{N} .,\-'’&()!?/:+#]/gu;

/** Code-Punkte statt UTF-16-Einheiten: schneidet nie ein Zeichen in der Mitte durch. */
export function zeichenKuerzen(text, max) {
  const z = Array.from(String(text ?? ''));
  return z.length > max ? z.slice(0, max).join('').trimEnd() : z.join('');
}

/**
 * Sauberer Hafenname: höchstens NAME_MAX Zeichen, nur erlaubte Zeichen, Leerraum zusammengefasst.
 * Leer (oder nur Verbotenes) gibt den Ersatz zurück.
 */
export function hafenNameSauber(name, ersatz = 'Mein Hafen') {
  let n = String(name ?? '');
  try { n = n.normalize('NFC'); } catch { /* sehr alte Browser */ }
  n = n.replace(/\s+/gu, ' ').replace(NICHT_ERLAUBT, '').replace(/ {2,}/g, ' ').trim();
  n = zeichenKuerzen(n, NAME_MAX).trim();
  return n || ersatz;
}

// ---------------------------------------------------------------------------
// Flagge

/** Größe des Pixelbilds einer Flagge (Breite x Höhe, 3:2). */
export const FLAGGE_B = 24;
export const FLAGGE_H = 16;

/** Farben (Pixel-Palette, kräftig wie Flaggentuch). Reihenfolge = Reihenfolge der Auswahl. */
export const FLAGGEN_FARBEN = [
  { id: 'weiss', name: 'Weiß', hex: '#f6f3ec' },
  { id: 'rot', name: 'Rot', hex: '#d9443b' },
  { id: 'blau', name: 'Blau', hex: '#2f6db5' },
  { id: 'marine', name: 'Marineblau', hex: '#1f3555' },
  { id: 'himmel', name: 'Himmelblau', hex: '#6fb5e0' },
  { id: 'gelb', name: 'Gelb', hex: '#f2c14e' },
  { id: 'gruen', name: 'Grün', hex: '#3f8f55' },
  { id: 'tuerkis', name: 'Türkis', hex: '#23897d' },
  { id: 'orange', name: 'Orange', hex: '#f08a24' },
  { id: 'bordeaux', name: 'Bordeaux', hex: '#8c2a3c' },
  { id: 'schwarz', name: 'Schwarz', hex: '#283648' },
];
// Maps statt Objekte: "__proto__" oder "constructor" aus einem präparierten Stand sind keine IDs
const FARBE_MAP = new Map(FLAGGEN_FARBEN.map((f) => [f.id, f]));

// Muster: Funktion (x, y) -> Feld 0, 1, 2 (Farbe 1 bis 3) oder -1 (kein Tuch, nur beim Stander).
// x 0..23 (0 = am Mast), y 0..15 (0 = oben). zeichenAt: Mitte des Zeichens.
const B = FLAGGE_B, H = FLAGGE_H;
export const FLAGGEN_MUSTER = [
  { id: 'einfarbig', name: 'Einfarbig', felder: 1, feld: () => 0, zeichenAt: [12, 8] },
  { id: 'quer', name: 'Zwei Streifen', felder: 2, feld: (x, y) => (y < H / 2 ? 0 : 1), zeichenAt: [12, 8] },
  { id: 'drei', name: 'Drei Streifen', felder: 3, feld: (x, y) => (y < 5 ? 0 : y < 11 ? 1 : 2), zeichenAt: [12, 8] },
  { id: 'senkrecht', name: 'Drei Bahnen', felder: 3, feld: (x) => (x < 8 ? 0 : x < 16 ? 1 : 2), zeichenAt: [12, 8] },
  {
    id: 'kreuz', name: 'Nordisches Kreuz', felder: 3, zeichenAt: [4, 3],
    // Skandinavisches Kreuz, zum Mast hin versetzt; Feld 2 ist der schmale Innenstreifen
    feld: (x, y) => {
      const innen = (x >= 8 && x <= 9) || (y >= 7 && y <= 8);
      const aussen = (x >= 7 && x <= 10) || (y >= 6 && y <= 9);
      return innen ? 2 : aussen ? 1 : 0;
    },
  },
  { id: 'schraeg', name: 'Schräg geteilt', felder: 2, feld: (x, y) => (x * H < (H - 1 - y) * B ? 0 : 1), zeichenAt: [6, 4] },
  { id: 'viertel', name: 'Geviertelt', felder: 2, feld: (x, y) => ((x < B / 2) === (y < H / 2) ? 0 : 1), zeichenAt: [6, 4] },
  { id: 'keil', name: 'Keil am Mast', felder: 2, feld: (x, y) => (x <= 11 - Math.abs(y - 7.5) * 1.45 ? 1 : 0), zeichenAt: [4, 8] },
  {
    id: 'rand', name: 'Mit Rand', felder: 2, zeichenAt: [12, 8],
    feld: (x, y) => (x < 2 || y < 2 || x > B - 3 || y > H - 3 ? 1 : 0),
  },
  {
    id: 'stander', name: 'Stander', felder: 2, zeichenAt: [6, 8],
    // Dreieckiger Vereinsstander: außerhalb des Dreiecks kein Tuch, Feld 1 ist ein Streifen in der Mitte
    feld: (x, y) => {
      const halb = 7.9 * (1 - x / B);
      if (Math.abs(y - 7.5) > halb) return -1;
      return Math.abs(y - 7.5) < 1.6 && x > 9 ? 1 : 0;
    },
  },
];
const MUSTER_MAP = new Map(FLAGGEN_MUSTER.map((m) => [m.id, m]));

// Zeichen als 9 x 9 Pixel ('#' = Zeichenfarbe)
export const FLAGGEN_ZEICHEN = [
  { id: 'keins', name: 'Ohne', pixel: null },
  { id: 'anker', name: 'Anker', pixel: ['....#....', '...#.#...', '....#....', '..#####..', '....#....', '....#....', '#...#...#', '.#..#..#.', '..#####..'] },
  { id: 'stern', name: 'Stern', pixel: ['....#....', '....#....', '...###...', '#########', '.#######.', '..#####..', '..##.##..', '.##...##.', '.#.....#.'] },
  { id: 'moewe', name: 'Möwe', pixel: ['.........', '.........', '##.....##', '.##...##.', '..##.##..', '...###...', '....#....', '.........', '.........'] },
  { id: 'fisch', name: 'Fisch', pixel: ['.........', '..####...', '.######.#', '##.######', '########.', '.######.#', '..####...', '.........', '.........'] },
  { id: 'krone', name: 'Krone', pixel: ['.........', '#...#...#', '##.###.##', '#########', '#########', '#########', '.#######.', '.........', '.........'] },
  { id: 'welle', name: 'Welle', pixel: ['.........', '..###....', '.#...#..#', '#.....##.', '.........', '..###....', '.#...#..#', '#.....##.', '.........'] },
  { id: 'kompass', name: 'Kompass', pixel: ['....#....', '....#....', '...###...', '..#.#.#..', '#########', '..#.#.#..', '...###...', '....#....', '....#....'] },
  { id: 'herz', name: 'Herz', pixel: ['.........', '.##...##.', '####.####', '#########', '#########', '.#######.', '..#####..', '...###...', '....#....'] },
  { id: 'leuchtturm', name: 'Leuchtturm', pixel: ['...###...', '#..###..#', '...###...', '...#.#...', '..##.##..', '..#...#..', '..##.##..', '.#.....#.', '#########'] },
];
const ZEICHEN_MAP = new Map(FLAGGEN_ZEICHEN.map((z) => [z.id, z]));

/** Kleiner Zufall aus dem Seed (mulberry32), unabhängig vom Spielzufall. */
function zufallAus(seed) {
  let a = (Number(seed) >>> 0) ^ 0x5f3759df;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hell oder dunkel (für Kontrast zwischen Feldern und Zeichen). */
function hell(id) {
  const h = FARBE_MAP.get(id)?.hex ?? '#000000';
  const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}

/** Eine stimmige Flagge aus einem Seed: gleicher Seed, gleiche Flagge (für neue und alte Häfen). */
export function flaggeAusSeed(seed) {
  const z = zufallAus(seed);
  const pick = (liste) => liste[Math.floor(z() * liste.length)];
  // Klassische Paare: helle und dunkle Farbe abwechselnd
  const dunkel = ['rot', 'blau', 'marine', 'gruen', 'tuerkis', 'bordeaux', 'schwarz'];
  const hellF = ['weiss', 'gelb', 'himmel', 'orange'];
  const muster = pick(FLAGGEN_MUSTER.filter((m) => m.id !== 'einfarbig')).id;
  const a = pick(dunkel);
  const b = pick(hellF);
  const c = pick(dunkel.filter((x) => x !== a));
  const farben = z() < 0.5 ? [a, b, c] : [b, a, c];
  const zeichen = z() < 0.6 ? pick(FLAGGEN_ZEICHEN.filter((x) => x.pixel)).id : 'keins';
  return { muster, farben, zeichen, zeichenFarbe: passendeZeichenFarbe({ muster, farben }) };
}

/** Zeichenfarbe, die sich vom Feld unter dem Zeichen abhebt. */
export function passendeZeichenFarbe(flagge) {
  const m = MUSTER_MAP.get(flagge?.muster) ?? FLAGGEN_MUSTER[0];
  const [x, y] = m.zeichenAt;
  const feld = Math.max(0, m.feld(x, y));
  const unter = flagge?.farben?.[feld] ?? 'weiss';
  const andere = (flagge?.farben ?? []).find((f, i) => i < m.felder && f !== unter && hell(f) !== hell(unter));
  return andere ?? (hell(unter) ? 'marine' : 'weiss');
}

/**
 * Prüft eine Flagge aus Spielstand oder Eingabe. Nur bekannte IDs bleiben, Fehlendes kommt aus der
 * Flagge zum Seed. Gibt immer eine vollständige, neue Flagge zurück (nie das Original).
 */
export function flaggeSauber(roh, seed = 0) {
  const basis = flaggeAusSeed(seed);
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return basis;
  const muster = typeof roh.muster === 'string' && MUSTER_MAP.get(roh.muster) ? roh.muster : basis.muster;
  const farbenRoh = Array.isArray(roh.farben) ? roh.farben.slice(0, 3) : [];
  const farben = [0, 1, 2].map((i) => (typeof farbenRoh[i] === 'string' && FARBE_MAP.get(farbenRoh[i]) ? farbenRoh[i] : basis.farben[i]));
  const zeichen = typeof roh.zeichen === 'string' && ZEICHEN_MAP.get(roh.zeichen) ? roh.zeichen : basis.zeichen;
  const zeichenFarbe = typeof roh.zeichenFarbe === 'string' && FARBE_MAP.get(roh.zeichenFarbe)
    ? roh.zeichenFarbe : passendeZeichenFarbe({ muster, farben });
  return { muster, farben, zeichen, zeichenFarbe };
}

export function gleicheFlagge(a, b) {
  return !!a && !!b && a.muster === b.muster && a.zeichen === b.zeichen && a.zeichenFarbe === b.zeichenFarbe
    && [0, 1, 2].every((i) => a.farben?.[i] === b.farben?.[i]);
}

export const farbeHex = (id) => FARBE_MAP.get(id)?.hex ?? null;
export const musterVon = (id) => MUSTER_MAP.get(id) ?? null;
export const zeichenVon = (id) => ZEICHEN_MAP.get(id) ?? null;

/**
 * Pixelbild einer Flagge: Array der Länge FLAGGE_B * FLAGGE_H mit Hex-Farbe oder null (kein Tuch).
 * Zeile für Zeile, oben links beginnend, x = 0 am Mast.
 */
export function flaggenPixel(flagge) {
  const f = flaggeSauber(flagge);
  const m = MUSTER_MAP.get(f.muster);
  const out = new Array(B * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < B; x++) {
      const feld = m.feld(x, y);
      out[y * B + x] = feld < 0 ? null : FARBE_MAP.get(f.farben[Math.min(feld, m.felder - 1)]).hex;
    }
  }
  const z = ZEICHEN_MAP.get(f.zeichen)?.pixel;
  if (z) {
    const [cx, cy] = m.zeichenAt;
    const x0 = Math.round(cx - 4.5), y0 = Math.round(cy - 4.5);
    const hex = FARBE_MAP.get(f.zeichenFarbe).hex;
    z.forEach((zeile, j) => {
      for (let i = 0; i < zeile.length; i++) {
        if (zeile[i] !== '#') continue;
        const x = x0 + i, y = y0 + j;
        if (x < 0 || y < 0 || x >= B || y >= H || out[y * B + x] === null) continue;
        out[y * B + x] = hex;
      }
    });
  }
  return out;
}

/**
 * Zeichnet die Flagge in einen 2D-Kontext (Canvas). massstab: Pixel je Flaggenpixel.
 * Ohne Tuch bleibt der Hintergrund durchsichtig.
 */
export function flaggeZeichnen(ctx, flagge, { x = 0, y = 0, massstab = 1 } = {}) {
  const px = flaggenPixel(flagge);
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < B; i++) {
      const c = px[j * B + i];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x + i * massstab, y + j * massstab, massstab, massstab);
    }
  }
}

/** Kurzer Text für Vorleser (aria-label), zum Beispiel "Drei Streifen in Rot, Weiß, Blau mit Anker". */
export function flaggeBeschreibung(flagge) {
  const f = flaggeSauber(flagge);
  const m = MUSTER_MAP.get(f.muster);
  const farben = f.farben.slice(0, m.felder).map((id) => FARBE_MAP.get(id).name);
  const z = ZEICHEN_MAP.get(f.zeichen);
  return `${m.name} in ${farben.join(', ')}${z?.pixel ? ` mit ${z.name}` : ''}`;
}
