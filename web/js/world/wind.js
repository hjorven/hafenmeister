// Wind im Hafen (P34, F5 und F35): Richtung je Tag und Windlage je Liegeplatz.
//
// Reine Rechnung ohne Three.js und ohne game, damit Spielregeln, Oberfläche und node --test dasselbe
// rechnen. Weltmeter wie überall im Spiel: x = Osten, z = Süden (Norden ist -z).
//
// Richtung: Grad, aus der der Wind kommt, 0 = aus Osten, 90 = aus Norden, 180 = aus Westen, 270 = aus
// Süden (wie render/boat-anim.js setWind). An Ost- und Nordsee weht er meist aus West bis Südwest.
// Eine Wetterlage hält ein paar Tage (ECONOMY.wind.wetterlageTage), jeder Tag weicht etwas davon ab.
//
// Windlage eines Platzes: Wie weit läuft das Wasser vom Platz aus gegen den Wind, bis Land, Mole oder
// Kaimauer kommt (Wellenweg, englisch fetch)? Schwimmstege dazwischen dämpfen die Wellen nur etwas.
// Langer Wellenweg = 'offen' (bei Starkwind unruhig), kurzer = 'geschuetzt', dazwischen 'normal'.
//
//   windRichtung(seed, tag, cfg, ereignis)     Grad (0 bis 360)
//   richtungsName(grad)                        'West', 'Nordwest', ...
//   windRaster({ bereich, zelle, istLand, hart, stege })   Raster 0 Wasser, 1 hart, 2 Steg
//   wellenweg(raster, x, z, grad, cfg)         Meter (gedämpft)
//   windLage(weg, cfg)                         'offen' | 'normal' | 'geschuetzt'
//   bugGegenWind(bugGradPlan, windGrad)        Kosinus: 1 = Bug genau in den Wind, -1 = Wind von achtern

const RAD = Math.PI / 180;

function hash(seed, a, b = 0) {
  let h = ((seed | 0) ^ Math.imul(a + 1, 0x9e3779b1) ^ Math.imul(b + 7, 0x85ebca77)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Himmelsrichtungen als Grad (aus der der Wind kommt), wie in ECONOMY.wind.richtungen. */
export const RICHTUNG_GRAD = { ost: 0, nordost: 45, nord: 90, nordwest: 135, west: 180, suedwest: 225, sued: 270, suedost: 315 };
const NAMEN = ['Ost', 'Nordost', 'Nord', 'Nordwest', 'West', 'Südwest', 'Süd', 'Südost'];

/** Name der Himmelsrichtung, aus der der Wind kommt. */
export function richtungsName(grad) {
  const i = Math.round((((grad % 360) + 360) % 360) / 45) % 8;
  return NAMEN[i];
}

const norm = (g) => ((g % 360) + 360) % 360;

/**
 * Windrichtung eines Tages. cfg = ECONOMY.wind: { richtungen: { west: 0.24, ... }, wetterlageTage, streuung,
 * sturmAus: ['west', 'nordwest'] }. ereignis: id des Ereignisses an dem Tag (Sturm kommt aus sturmAus).
 */
export function windRichtung(seed, tag, cfg = {}, ereignis = null) {
  const lage = Math.max(1, cfg.wetterlageTage ?? 3);
  const periode = Math.floor(Math.max(0, (tag | 0) - 1) / lage);
  const gewichte = Object.entries(ereignis === 'sturm' && cfg.sturmAus?.length
    ? Object.fromEntries(cfg.sturmAus.map((k) => [k, 1]))
    : cfg.richtungen ?? { west: 1 });
  const summe = gewichte.reduce((s, [, w]) => s + w, 0) || 1;
  let r = hash(seed, periode, 11) * summe;
  let basis = 180;
  for (const [k, w] of gewichte) {
    if ((r -= w) < 0) { basis = RICHTUNG_GRAD[k] ?? 180; break; }
  }
  // innerhalb der Wetterlage dreht der Wind etwas, jeder Tag anders
  const streu = cfg.streuung ?? 20;
  const tagDreh = (hash(seed, tag | 0, 23) * 2 - 1) * streu;
  return Math.round(norm(basis + tagDreh));
}

/**
 * Raster für die Windlage. bereich { x0, x1, z0, z1 } in Weltmetern, istLand(x, z) -> true an Land,
 * hart: Linien [{ punkte: [{x,z}], breite }] (Molen, Kai, Pier), stege: dieselbe Form (Schwimm- und Holzstege).
 */
export function windRaster({ bereich, zelle = 2, istLand = () => false, hart = [], stege = [] }) {
  const { x0, x1, z0, z1 } = bereich;
  const nx = Math.ceil((x1 - x0) / zelle), nz = Math.ceil((z1 - z0) / zelle);
  const code = new Uint8Array(nx * nz);
  for (let j = 0; j < nz; j++) {
    const z = z0 + (j + 0.5) * zelle;
    for (let i = 0; i < nx; i++) if (istLand(x0 + (i + 0.5) * zelle, z)) code[j * nx + i] = 1;
  }
  const r = { zelle, nx, nz, x0, z0, x1: x0 + nx * zelle, z1: z0 + nz * zelle, code };
  for (const l of stege) linie(r, l.punkte, l.breite, 2);
  for (const l of hart) linie(r, l.punkte, l.breite, 1);
  return r;
}

function linie(r, pts, breite, wert) {
  const hb = Math.max(breite / 2, r.zelle * 0.5);
  for (let s = 1; s < pts.length; s++) {
    const a = pts[s - 1], b = pts[s];
    const dx = b.x - a.x, dz = b.z - a.z, ll = dx * dx + dz * dz || 1;
    const minx = Math.min(a.x, b.x) - hb, maxx = Math.max(a.x, b.x) + hb;
    const minz = Math.min(a.z, b.z) - hb, maxz = Math.max(a.z, b.z) + hb;
    for (let z = minz; z <= maxz + r.zelle; z += r.zelle) {
      for (let x = minx; x <= maxx + r.zelle; x += r.zelle) {
        const i = Math.floor((x - r.x0) / r.zelle), j = Math.floor((z - r.z0) / r.zelle);
        if (i < 0 || j < 0 || i >= r.nx || j >= r.nz) continue;
        const cx = r.x0 + (i + 0.5) * r.zelle, cz = r.z0 + (j + 0.5) * r.zelle;
        const t = Math.max(0, Math.min(1, ((cx - a.x) * dx + (cz - a.z) * dz) / ll));
        if (Math.hypot(cx - (a.x + t * dx), cz - (a.z + t * dz)) > hb) continue;
        const k = j * r.nx + i;
        if (wert === 1 || r.code[k] === 0) r.code[k] = wert;
      }
    }
  }
}

const zelleBei = (r, x, z) => {
  const i = Math.floor((x - r.x0) / r.zelle), j = Math.floor((z - r.z0) / r.zelle);
  if (i < 0 || j < 0 || i >= r.nx || j >= r.nz) return 0;   // außerhalb: offene See
  return r.code[j * r.nx + i];
};

/** Ein Strahl gegen den Wind: Meter Wasser bis zum ersten harten Hindernis, mit Dämpfung je Steg. */
function strahl(r, x, z, grad, cfg) {
  const max = cfg.wegMax ?? 300, schritt = cfg.schritt ?? 2, daempf = cfg.stegDaempfung ?? 0.6;
  // gegen den Wind = zur Richtung, aus der er kommt: (cos, -sin) in Weltmetern (z = Süden)
  const ux = Math.cos(grad * RAD), uz = -Math.sin(grad * RAD);
  let anteil = 1, weg = 0, imSteg = false, start = true;
  for (let d = schritt; d <= max; d += schritt) {
    const c = zelleBei(r, x + ux * d, z + uz * d);
    if (c === 1) {
      // Der Platz selbst liegt an Kai oder Mole: die ersten Meter darin zählen nicht als Schutz
      if (start && d <= (cfg.startFrei ?? 4)) continue;
      break;
    }
    start = false;
    if (c === 2) {
      if (!imSteg) anteil *= daempf;
      imSteg = true;
      continue;
    }
    imSteg = false;
    weg += schritt * anteil;
  }
  return weg;
}

/** Gedämpfter Wellenweg in Metern: Mittel aus mehreren Strahlen im Fächer um die Windrichtung. */
export function wellenweg(r, x, z, grad, cfg = {}) {
  const f = cfg.faecher ?? [-20, -10, 0, 10, 20];
  let s = 0;
  for (const d of f) s += strahl(r, x, z, grad + d, cfg);
  return s / f.length;
}

/** Windlage aus dem Wellenweg (cfg = ECONOMY.wind: offenAb, geschuetztBis in Metern). */
export function windLage(weg, cfg = {}) {
  if (weg >= (cfg.offenAb ?? 140)) return 'offen';
  if (weg <= (cfg.geschuetztBis ?? 45)) return 'geschuetzt';
  return 'normal';
}

/**
 * Wie sehr zeigt der Bug in den Wind? bugGradPlan: Bugrichtung des Platzes in Plan-Grad (harbor.js lage[2],
 * 0 = Osten, 90 = Norden), windGrad: Richtung, aus der der Wind kommt (gleiche Zählung).
 * 1 = Bug genau gegen den Wind, 0 = Wind von der Seite, -1 = Wind genau von achtern.
 */
export function bugGegenWind(bugGradPlan, windGrad) {
  return Math.cos((bugGradPlan - windGrad) * RAD);
}

/**
 * Lagen aller Plätze für eine Windrichtung. plaetze: [{ id, x, z }] in Weltmetern.
 * Gibt Map id -> { weg, lage } zurück.
 */
export function platzLagen(r, plaetze, grad, cfg = {}) {
  const out = new Map();
  for (const p of plaetze) {
    const weg = wellenweg(r, p.x, p.z, grad, cfg);
    out.set(p.id, { weg: Math.round(weg), lage: windLage(weg, cfg) });
  }
  return out;
}
