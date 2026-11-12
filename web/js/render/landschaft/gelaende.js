// Gelände des Hafens als reine Rechenfunktionen, ohne Three.js.
//
// Die Form folgt den Zeichnungen in docs/hafen (skripte/konzeptbilder/hafen_von_oben.py):
// von Süden nach Norden Festland, Binnensee, Nehrung, offene See.
// Intern wird in Planeinheiten gerechnet (1 Planeinheit = 0,62 m, y zeigt nach Norden),
// nach außen gibt das Modul Meter in Weltkoordinaten zurück:
//   x = Osten, z = Süden (Norden ist -z), y = oben, Wasserspiegel bei y = 0.
//
// Weil das Modul kein Three.js kennt, kann auch die Spiellogik es nutzen,
// zum Beispiel für die Regel "Wassertiefe mindestens 0,3 m größer als der Tiefgang".

export const PLAN_M = 0.62;

/** Bereich, für den das Gelände fein berechnet wird (Planeinheiten). */
export const BEREICH = { x0: -420, x1: 430, y0: -200, y1: 470 };

/** Planeinheiten -> Weltmeter. */
export function ausPlan(px, py) {
  return { x: px * PLAN_M, z: -py * PLAN_M };
}

/** Weltmeter -> Planeinheiten. */
export function inPlan(x, z) {
  return { px: x / PLAN_M, py: -z / PLAN_M };
}

// ------------------------------------------------------------------ Rauschen

function hash2(ix, iy, seed) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** Wertrauschen 0..1, weich interpoliert. */
export function rauschen(x, y, seed = 1) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function fbm(x, y, seed) {
  return 0.55 * rauschen(x, y, seed) + 0.3 * rauschen(x * 2.03, y * 2.03, seed + 7) + 0.15 * rauschen(x * 4.1, y * 4.1, seed + 13);
}

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ------------------------------------------------------------------ Uferlinien (aus hafen_von_oben.py)

const kueste = (x) => 5 * Math.sin(x / 70) + 3 * Math.sin(x / 31 + 1);
/** Südufer des Sees (Festland). Im Westen und Osten schließt sich der See. */
export const suedufer = (x) => kueste(x) + 0.02 * Math.max(0, -235 - x) ** 2 + 0.02 * Math.max(0, x - 345) ** 2;
/** Nordufer des Sees (Innenseite der Nehrung). */
export const seeNord = (x) => 186 + 4 * Math.sin(x / 55 + 2) + 2.5 * Math.sin(x / 23);
/** Strand der Nehrung zur offenen See. */
export const meerSued = (x) => 224 + 4 * Math.sin(x / 80 + 1) + 2 * Math.sin(x / 27);

/** Durchstich durch die Nehrung, x von bis. */
export const DURCHSTICH = [152, 182];

/** Molen je Stufe als Linienzüge in Planeinheiten, mit Breite. */
export function molen(stufe) {
  if (stufe >= 5) {
    return [
      { name: 'Westmole', punkte: [[-2, 224], [-10, 282], [18, 312], [96, 320]], breite: 9 },
      { name: 'Ostmole', punkte: [[184, 222], [194, 278], [170, 304]], breite: 9 },
    ];
  }
  if (stufe >= 3) {
    return [
      { name: 'Westmole', punkte: [[150, 222], [149, 268]], breite: 7 },
      { name: 'Ostmole', punkte: [[184, 222], [187, 258]], breite: 7 },
    ];
  }
  return [];
}

const _wege = new Map();
function wegeCache(stufe) {
  if (!_wege.has(stufe)) _wege.set(stufe, wegePlan(stufe));
  return _wege.get(stufe);
}

const _molen = new Map();
function molenCache(stufe) {
  if (!_molen.has(stufe)) _molen.set(stufe, molen(stufe));
  return _molen.get(stufe);
}

/**
 * Buhnen am Seestrand der Nehrung, etwa alle 50 m (80 Planeinheiten).
 * Je Buhne ein Linienzug in Planeinheiten vom Strand ins Wasser.
 */
export function buhnen(stufe) {
  const out = [];
  for (let x = -380; x <= 400; x += 80) {
    if (x > 120 && x < 215) continue;                       // Durchstich und Einfahrt
    if (stufe >= 5 && x > -40 && x < 215) continue;         // Außenhafen
    const y0 = meerSued(x) - 5;
    out.push([[x, y0], [x + 2, y0 + 30]]);
  }
  return out;
}

/**
 * Wege an Land in Planeinheiten: Straße hinter dem Hafen, Zugänge zum Ufer, Promenade.
 * Die Landschaft zeichnet sie als helle Wege; wegeNetz() gibt sie in Metern heraus.
 */
export function wegePlan(stufe) {
  const w = [{ id: 'strasse', typ: 'strasse', punkte: [[-330, -88], [340, -88]], breite: 9 }];
  if (stufe <= 2) {
    w.push({ id: 'zugang-a', typ: 'weg', punkte: [[-105, -88], [-104, -40], [-105, suedufer(-105) - 3]], breite: 3 });
    if (stufe === 2) w.push({ id: 'zugang-b', typ: 'weg', punkte: [[-55, -88], [-55, suedufer(-55) - 3]], breite: 3 });
  } else {
    w.push({ id: 'promenade', typ: 'promenade', punkte: [[-150, -3], [202, -3]], breite: 19 });
    for (const x of [-120, 20, 160]) w.push({ id: `zugang-${x}`, typ: 'weg', punkte: [[x, -88], [x, -13]], breite: 3.5 });
  }
  if (stufe >= 5) w.push({ id: 'kai-aussenhafen', typ: 'promenade', punkte: [[2, 222], [150, 222]], breite: 13 });
  return w;
}

/** Slipanlage am Südufer, x von bis (Planeinheiten). */
export const SLIP = { x0: -131, x1: -123 };

/** Bereich hinter dem Ufer, den der Hafen bebaut. Dort bleibt das Gelände eben und baumfrei. */
export const HAFENFLAECHE = { x0: -165, x1: 215, y0: -92 };

/** Abstand außerhalb der Hafenfläche in Planeinheiten (0 oder negativ = innerhalb). */
export function hafenAbstand(px, py) {
  return Math.max(HAFENFLAECHE.x0 - px, px - HAFENFLAECHE.x1, HAFENFLAECHE.y0 - py);
}

function inPoly(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Vorzeichenbehafteter Abstand zu einem Polygon: negativ innen, positiv außen. */
function polyAbstand(px, py, poly) {
  let d = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[j], [bx, by] = poly[i];
    const dx = bx - ax, dy = by - ay;
    const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1);
    d = Math.min(d, Math.hypot(px - ax - t * dx, py - ay - t * dy));
  }
  return inPoly(px, py, poly) ? -d : d;
}

/** Baggert weich aus: Ziel-Tiefe innen, sanfte Böschung über `rand` Planeinheiten nach außen. */
function baggern(h, px, py, poly, tiefe, rand = 10) {
  if (h >= 0) return h;
  const k = smooth(rand, 0, polyAbstand(px, py, poly));
  return k > 0 ? Math.min(h, h + (-tiefe - h) * k) : h;
}

function abstandZuLinie(px, py, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const dx = bx - ax, dy = by - ay;
    const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1);
    best = Math.min(best, Math.hypot(px - ax - t * dx, py - ay - t * dy));
  }
  return best;
}

// Graben zur Ostsee vor dem Durchstich (Stufe 1 und 2), Mittellinie als x über y.
function grabenX(py) {
  const k = [[180, 166], [196, 169], [212, 164], [232, 169]];
  if (py <= k[0][0]) return k[0][1];
  for (let i = 0; i < k.length - 1; i++) {
    if (py <= k[i + 1][0]) {
      const t = (py - k[i][0]) / (k[i + 1][0] - k[i][0]);
      return k[i][1] + (k[i + 1][1] - k[i][1]) * (t * t * (3 - 2 * t));
    }
  }
  return k[k.length - 1][1];
}

const BECKEN3 = [[-12, 6], [150, 6], [190, 120], [186, 176], [148, 176], [112, 128], [40, 112], [-12, 96]];
const BECKEN4 = [[-22, 6], [202, 6], [204, 96], [186, 176], [148, 176], [118, 150], [20, 152], [-22, 120]];
const BECKEN4_WEST = [[-84, 6], [-22, 6], [-22, 124], [-84, 112]];
const RINNE34 = [[152, 236], [182, 236], [212, 356], [176, 356]];
const AUSSENHAFEN = [[0, 226], [186, 226], [194, 278], [170, 304], [96, 320], [18, 312], [-8, 282]];
const RINNE5 = [[108, 300], [160, 300], [184, 356], [132, 356]];
// Stufe 6: Liegewanne an der Grossschiffspier westlich der Westmole (wie skripte/konzeptbilder/hafen_von_oben.py)
const PIERWANNE6 = [[-417, 228], [-27, 228], [-17, 370], [-417, 370]];

// ------------------------------------------------------------------ Punktabfrage

/**
 * Gelände an einem Punkt in Planeinheiten.
 * Rückgabe: h = Höhe in Metern (negativ = Wassertiefe), typ = Oberfläche, see = 0 Binnensee bis 1 offene See.
 * @param {number} px
 * @param {number} py
 * @param {number} stufe 1..6
 * @param {object} region Eintrag aus regionen.js (gelaende-Teil)
 */
export function punkt(px, py, stufe, region) {
  const g = region.gelaende;
  const wob = rauschen(px / 80, py / 60, 12) - 0.5;
  const ausgebaut = stufe >= 3 && px >= -150 && px <= 202;
  const ufer = ausgebaut ? 6 : suedufer(px);
  const ln = seeNord(px), ms = meerSued(px);
  const see = clamp((py - (ln + ms) / 2) / 8 + 0.5, 0, 1);
  let h, typ;

  if (py <= ufer) {
    // ---------------- Festland
    const d = ufer - py;
    const sandBreite = g.strandBreite + 4 * Math.sin(px / 23);
    if (ausgebaut && py > -92) {
      h = 1.2; typ = 'pflaster';
      if (py < -13) typ = 'gras';
    } else {
      h = d < sandBreite ? 0.12 + d * 0.045 : 0.12 + sandBreite * 0.045 + Math.min(d - sandBreite, 8) * 0.06;
      typ = d < sandBreite ? 'sand' : 'gras';
    }
    // Hügel und Felsen im Hinterland, nicht auf der Hafenfläche
    const land = smooth(10, 40, d) * smooth(0, 30, hafenAbstand(px, py));
    if (g.huegel) h += g.huegel * land * fbm(px / 140, py / 110, 3);
    if (g.felsen) {
      // Schärenfelsen nur am Rand der Karte, weit weg vom Hafen
      const r = fbm(px / 45, py / 45, 9);
      const f = g.felsen * land * smooth(0.58, 0.9, r) * smooth(200, 340, Math.abs(px - 20));
      h += f;
      if (f > 2.2) typ = 'fels';
    }
    if (g.deich) {
      // Grüner Deich hinter der Straße, dahinter flacher Polder
      const dy = py - g.deich.y;
      const k = Math.max(0, 1 - Math.abs(dy) / g.deich.breite);
      const deich = g.deich.hoehe * Math.min(1, k * 1.8);
      if (deich > h) { h = deich; typ = k > 0.85 ? 'deichkrone' : 'deich'; }
      if (dy < -g.deich.breite) h = Math.min(h, 0.9);
    }
    // Straße und Wege (Promenade ist schon Pflaster)
    if (py < 0 && py > -100) {
      for (const w of wegeCache(stufe)) {
        if (w.typ === 'promenade') continue;
        if (abstandZuLinie(px, py, w.punkte) < w.breite / 2) {
          typ = 'weg';
          h = Math.min(h, (ausgebaut ? 1.2 : h));
          break;
        }
      }
    }
  } else if (py < ln) {
    // ---------------- Binnensee
    const dist = Math.min(py - ufer, ln - py);
    h = -Math.max(0.2, 2.5 * (1 - Math.exp(-Math.max(0, dist) / 26)) + 0.5 * wob);
    // Reviere mit Gezeiten: Hafenbecken ist ausgebaggert, damit es bei Ebbe nicht trockenfällt
    if (g.gezeiten) h -= g.gezeiten * smooth(0, 8, dist);
    typ = 'wasser';
  } else if (py < ms) {
    // ---------------- Nehrung
    const t = (py - ln) / (ms - ln);
    const profil = Math.pow(Math.sin(Math.PI * clamp(t, 0, 1)), 0.7);
    {
      const welle = 0.6 + 0.4 * fbm(px / 30, py / 12, 17);
      h = 0.25 + profil * g.duenenHoehe * welle;
      typ = t < 0.08 || t > 0.86 ? 'sand' : t < 0.45 ? 'duenengras' : 'duene';
      // Salzwiesen und kleine Lagunen auf der Seeseite des Binnensees (wie am Graswarder)
      const lag = fbm(px / 22, py / 9, 31);
      const frei = (px < 110 || px > 225) && !(stufe >= 5 && px > -30 && px < 200);
      if (frei && t < 0.5 && lag > 0.56) {
        typ = 'salzwiese';
        h = Math.min(h, 0.15 + (0.7 - lag) * 2);
        if (t > 0.1 && t < 0.4 && lag > 0.69) { h = -0.7; typ = 'wasser'; }
      }
    }
  } else {
    // ---------------- Offene See
    const dist = py - ms;
    // Watt vor der Küste, aber ein tiefer Priel vor der Einfahrt und der Reede (um x = 230)
    const watt = (g.wattBreite || 0) * smooth(95, 135, Math.abs(px - 230));
    h = -Math.max(0.2, 5 * (1 - Math.exp(-Math.max(0, dist - watt) / 42)) + 0.6 * wob + (watt ? 0.25 : 0));
    // Der Priel vor der Einfahrt ist auch bei Ebbe befahrbar
    if (g.gezeiten) h -= g.gezeiten * (1 - smooth(70, 110, Math.abs(px - 230))) * smooth(0, 25, dist);
    typ = 'wasser';
  }

  // ---------------- Bauprojekte, die Wasser und Land verändern
  if (stufe >= 3) {
    if (h < 0) {
      h = baggern(h, px, py, stufe >= 4 ? BECKEN4 : BECKEN3, 3.5 + 0.4 * wob, 14);
      if (stufe >= 4) h = baggern(h, px, py, BECKEN4_WEST, 2.6, 12);
      if (stufe < 5) h = baggern(h, px, py, RINNE34, 4.4, 6);
    }
    if (px > DURCHSTICH[0] && px < DURCHSTICH[1] && py > ln - 3 && py < 236) {
      h = -3.8; typ = 'wasser';
    } else if (px > DURCHSTICH[0] - 3 && px < DURCHSTICH[1] + 3 && py > ln - 4 && py < 226) {
      h = 1.0; typ = 'steinschuettung';
    }
    if (stufe >= 5) {
      if (py > 229) h = baggern(h, px, py, AUSSENHAFEN, 5.0, 6);
      h = baggern(h, px, py, RINNE5, 4.6, 6);
      if (px > 2 && px < 150 && py > 214 && py <= 229) { h = 1.3; typ = 'pflaster'; }
    }
    if (stufe >= 6) h = baggern(h, px, py, PIERWANNE6, 8.5, 10);
  } else if (py > ln - 2 && py < ms + 8) {
    // Flacher Graben durch die Nehrung, nur für Ruderboote
    if (Math.abs(px - grabenX(py)) < 3) { h = -0.5; typ = 'wasser'; }
  }
  for (const m of molenCache(stufe)) {
    if (abstandZuLinie(px, py, m.punkte) < m.breite / 2) { h = 1.4; typ = 'mole'; }
  }
  if (stufe >= 2 && px > SLIP.x0 && px < SLIP.x1) {
    // Slipanlage: Rampe vom Land bis 0,6 m unter Wasser, ab Stufe 3 durch die Kaimauer hindurch
    const y0 = stufe >= 3 ? -13 : suedufer(-128) - 10;
    const y1 = stufe >= 3 ? 16 : suedufer(-128) + 9;
    if (py > y0 && py < y1) {
      const oben = stufe >= 3 ? 1.2 : 0.6;
      h = oben - ((py - y0) / (y1 - y0)) * (oben + 0.6);
      typ = 'pflaster';
    }
  }
  // Reviere mit Gezeiten: Bauwerke und Hinterland liegen höher, der flache Strand nicht
  const basis = g.landPlus || 0;
  if (basis) {
    if (typ === 'pflaster' || typ === 'mole' || typ === 'steinschuettung') h += basis;
    else if (h > 0) h += basis * smooth(0.1, 1.0, h);
  }
  return { h, typ, see };
}

/**
 * Erzeugt Abfragefunktionen in Weltmetern für eine Stufe und Region.
 * hoeheBei: Bodenhöhe in Metern (unter Wasser negativ).
 * tiefeBei: Wassertiefe in Metern (0 an Land).
 */
export function gelaendeAbfrage(stufe, region) {
  const p = (x, z) => punkt(x / PLAN_M, -z / PLAN_M, stufe, region);
  return {
    hoeheBei: (x, z) => p(x, z).h,
    tiefeBei: (x, z) => Math.max(0, -p(x, z).h),
    istWasser: (x, z) => p(x, z).h < 0,
    punkt: p,
  };
}

// ------------------------------------------------------------------ Warteplätze vor dem Hafen

/**
 * Wo ankommende Boote warten, bis der Spieler ihnen einen Platz gibt (Planeinheiten).
 * Stufe 1 und 2: im Binnensee vor den Stegen, weil es noch keine Zufahrt von See gibt.
 * Ab Stufe 3: draußen vor der Einfahrt, östlich der Fahrrinne, wie auf echten Revieren.
 * Ab Stufe 5 zusätzlich eine Reede für große Schiffe weiter draußen.
 * bojen: feste Warteboje je Boot. ankerbereiche: Kreis, in dem frei geankert wird.
 * groesse: größte Bootsgröße, die dort warten kann.
 */
export function warteplaetze(stufe) {
  const bojen = [], ankerbereiche = [];
  const reihe = (id, x0, y0, dx, dy, n, groesse) => {
    for (let i = 0; i < n; i++) bojen.push({ id: `${id}${i + 1}`, px: x0 + dx * i, py: y0 + dy * i, groesse });
  };
  if (stufe <= 2) {
    // Nahe vor Steg A, damit die wartenden Boote in der Startansicht zu sehen sind.
    // Boote liegen mit dem Bug an der Boje, nach Osten bleibt gut 4 m Platz.
    const lagen = stufe === 1
      ? [[-100, 56], [-86, 53], [-72, 50]]
      : [[-112, 86], [-94, 90], [-76, 88], [-58, 92], [-40, 89], [-22, 92]];
    lagen.forEach(([px, py], i) => bojen.push({ id: `see-${i + 1}`, px, py, groesse: 'M' }));
    ankerbereiche.push({ id: 'see-anker', px: stufe === 1 ? -20 : 20, py: stufe === 1 ? 70 : 112, radius: 16, groesse: 'M' });
  } else if (stufe <= 4) {
    reihe('reede-', 228, 262, 14, 9, stufe === 3 ? 5 : 7, 'L');
    ankerbereiche.push({ id: 'reede-anker', px: 300, py: 330, radius: 30, groesse: 'L' });
  } else {
    reihe('reede-', 232, 300, 14, 9, 8, 'L');
    ankerbereiche.push({ id: 'reede-anker', px: 300, py: 380, radius: 32, groesse: 'L' });
    ankerbereiche.push({ id: 'reede-gross', px: 60, py: 420, radius: 40, groesse: 'XL' });
  }
  const welt = (o) => ({ ...o, x: o.px * PLAN_M, z: -o.py * PLAN_M, ...(o.radius ? { radiusM: o.radius * PLAN_M } : {}) });
  return { bojen: bojen.map(welt), ankerbereiche: ankerbereiche.map(welt) };
}

/**
 * Begehbare Wege in Weltmetern für Menschen und Fahrzeuge: Straße, Zugänge, Promenade, Kai, Molenwege.
 * Stege kommen nicht von hier, sondern aus web/js/data/harbor.js.
 * Jeder Weg: { id, typ, breite (m), punkte: [{x, y, z}] } mit y = Bodenhöhe.
 */
export function wegeNetz(stufe, region) {
  const plus = region.gelaende.landPlus || 0;
  const alle = wegePlan(stufe).map((w) => ({ ...w }));
  for (const m of molen(stufe)) alle.push({ id: `mole-${m.name.toLowerCase()}`, typ: 'mole', punkte: m.punkte, breite: m.breite * 0.36, hoehe: 1.45 + plus });
  return alle.map((w) => ({
    id: w.id,
    typ: w.typ,
    breite: +(w.breite * PLAN_M).toFixed(2),
    punkte: w.punkte.map(([px, py]) => {
      const h = w.hoehe ?? Math.max(0, punkt(px, py, stufe, region).h);
      return { x: +(px * PLAN_M).toFixed(2), y: +h.toFixed(2), z: +(-py * PLAN_M).toFixed(2) };
    }),
  }));
}
