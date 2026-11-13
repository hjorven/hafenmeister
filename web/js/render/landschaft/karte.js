// Karte des Geländes für andere Module: wo ist befahrbares Wasser, wie tief, wo Land und Strand,
// und wo liegen die festen Punkte (Engpass, Einfahrt, Fahrwasser, Molenköpfe, Bauflächen).
// Reines JS ohne Three.js, damit Spielregeln, Fahrwege und Tests es nutzen können.
// Beschreibung: docs/landschaft.md, Abschnitt "Karte und feste Punkte".
//
// Planeinheiten wie web/js/data/harbor.js (1 = 0,62 m, x Osten, y Norden).
// Welt: x = px * 0,62, z = -py * 0,62.
import {
  punkt, PLAN_M, BEREICH, KERN, ENGPASS_X, DURCHSTICH, DURCHSTICH_TIEFE, SEEGATT_TIEFE,
  seegattAchse, seegattHalb, seeNord, meerSued, molen, HAFENFLAECHE,
} from './gelaende.js';
import { region as regionNach } from './regionen.js';

/** Arten im Raster: 0 Land, 1 Strand (Sand am Wasser), 2 flaches Wasser (< 1 m), 3 Wasser. */
export const ART = { LAND: 0, STRAND: 1, FLACH: 2, WASSER: 3 };
const ART_NAME = ['land', 'strand', 'flach', 'wasser'];

const regionVon = (r) => (typeof r === 'string' || r == null ? regionNach(r || 'ostsee') : r);

/** Art an einem Punkt (Planeinheiten): 'land' | 'strand' | 'flach' | 'wasser'. Mittlerer Wasserstand. */
export function art(px, py, stufe, region) {
  return ART_NAME[artNr(punkt(px, py, stufe, regionVon(region)))];
}

function artNr(p) {
  if (p.h < 0) return p.h > -1 ? ART.FLACH : ART.WASSER;
  return p.typ === 'sand' && p.h < 0.8 ? ART.STRAND : ART.LAND;
}

/**
 * Feste Punkte einer Stufe in Planeinheiten.
 * engpass:    die einzige Verbindung zwischen offener See und Binnensee
 *             { art: 'seegatt' | 'durchstich', x0, x1, y0, y1, achse: [[px,py],[px,py]], breite, breiteM, tiefeM }
 *             (x0/x1 an der schmalsten Stelle, breite in Planeinheiten)
 * einfahrt:   { aussen: [px,py] frei auf See vor der Einfahrt, innen: [px,py] im See/Becken hinter dem Engpass }
 * fahrwasser: Mittellinie von See bis ins Becken (Liste von [px,py]), fahrwasserBreiteM nutzbare Breite
 * molenkoepfe: [[px,py]] Enden der Molen (Molenfeuer)
 * bauflaechen: [{ id, poly: [[px,py]...], hoehe }] ebenes Land, auf dem gebaut werden darf
 */
export function festePunkte(stufe) {
  stufe = Math.max(1, Math.min(6, Math.round(stufe)));
  let engpass, einfahrt, fahrwasser, fahrwasserBreiteM;
  if (stufe <= 2) {
    const yMitte = 205;
    const hw = seegattHalb(yMitte);
    engpass = {
      art: 'seegatt',
      x0: +(seegattAchse(yMitte) - hw).toFixed(1), x1: +(seegattAchse(yMitte) + hw).toFixed(1),
      y0: 186, y1: 224,
      achse: [[+seegattAchse(176).toFixed(1), 176], [+seegattAchse(236).toFixed(1), 236]],
      breite: 2 * hw, breiteM: +(2 * hw * PLAN_M).toFixed(1), tiefeM: SEEGATT_TIEFE,
    };
    einfahrt = { aussen: [+seegattAchse(270).toFixed(1), 270], innen: [+seegattAchse(160).toFixed(1), 160] };
    fahrwasser = [280, 250, 224, 205, 186, 160, 140].map((y) => [+seegattAchse(y).toFixed(1), y]);
    // nutzbar: wo mindestens 1,2 m Wasser stehen (etwa 60 % der Breite an der schmalsten Stelle)
    fahrwasserBreiteM = +(2 * hw * 0.6 * PLAN_M).toFixed(1);
  } else {
    engpass = {
      art: 'durchstich', x0: DURCHSTICH[0], x1: DURCHSTICH[1], y0: 186, y1: 230,
      achse: [[ENGPASS_X, 176], [ENGPASS_X, 236]],
      breite: DURCHSTICH[1] - DURCHSTICH[0], breiteM: +((DURCHSTICH[1] - DURCHSTICH[0]) * PLAN_M).toFixed(1), tiefeM: DURCHSTICH_TIEFE,
    };
    if (stufe <= 4) {
      einfahrt = { aussen: [ENGPASS_X + 14, 300], innen: [ENGPASS_X, 160] };
      fahrwasser = [[ENGPASS_X + 30, 350], [ENGPASS_X + 14, 300], [ENGPASS_X, 250], [ENGPASS_X, 205], [ENGPASS_X, 176], [150, 150]];
    } else {
      einfahrt = { aussen: [150, 345], innen: [ENGPASS_X, 160] };
      fahrwasser = [[160, 380], [150, 345], [158, 300], [ENGPASS_X, 250], [ENGPASS_X, 205], [ENGPASS_X, 176], [150, 150]];
    }
    fahrwasserBreiteM = +((DURCHSTICH[1] - DURCHSTICH[0] - 8) * PLAN_M).toFixed(1);
  }
  const molenkoepfe = molen(stufe).map((m) => m.punkte[m.punkte.length - 1]);
  return { stufe, engpass, einfahrt, fahrwasser, fahrwasserBreiteM, molenkoepfe, bauflaechen: bauflaechen(stufe) };
}

/** Ebene Flächen, die Gebäude und Anlagen nutzen dürfen (Planeinheiten). */
export function bauflaechen(stufe) {
  const r = (id, x0, y0, x1, y1, hoehe) => ({ id, poly: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], hoehe });
  const out = [];
  if (stufe >= 3) out.push(r('hafen', HAFENFLAECHE.x0, HAFENFLAECHE.y0, HAFENFLAECHE.x1, -13, 1.2));
  else out.push(r('hafen', -165, -86, 60, -24, null));
  out.push(r('hinterland-west', -330, -84, -170, -20, null));
  out.push(r('hinterland-ost', 220, -84, 340, -20, null));
  if (stufe >= 5) out.push(r('aussenkai', 2, 214, 150, 229, 1.3));
  return out;
}

/** Wie festePunkte, aber in Weltmetern ({ x, z } statt [px, py]). */
export function festePunkteWelt(stufe) {
  const f = festePunkte(stufe);
  const w = ([px, py]) => ({ x: +(px * PLAN_M).toFixed(2), z: +(-py * PLAN_M).toFixed(2) });
  return {
    stufe: f.stufe,
    engpass: {
      ...f.engpass,
      x0: +(f.engpass.x0 * PLAN_M).toFixed(2), x1: +(f.engpass.x1 * PLAN_M).toFixed(2),
      z0: +(-f.engpass.y1 * PLAN_M).toFixed(2), z1: +(-f.engpass.y0 * PLAN_M).toFixed(2),
      achse: f.engpass.achse.map(w),
    },
    einfahrt: { aussen: w(f.einfahrt.aussen), innen: w(f.einfahrt.innen) },
    fahrwasser: f.fahrwasser.map(w),
    fahrwasserBreiteM: f.fahrwasserBreiteM,
    molenkoepfe: f.molenkoepfe.map(w),
    bauflaechen: f.bauflaechen.map((b) => ({ ...b, poly: b.poly.map(w) })),
  };
}

/**
 * Raster der ganzen Karte für Wegsuche und Platzierung.
 * Rückgabe { x0, y0, nx, ny, schritt (Planeinheiten), schrittM, tiefe, art, ufer, beiWelt(x, z) }:
 *   tiefe Float32Array  Wassertiefe in Metern bei mittlerem Wasserstand (0 an Land)
 *   art   Uint8Array    ART.*
 *   ufer  Float32Array  Abstand zur Uferlinie in Metern: positiv an Land, negativ im Wasser
 * Zelle (i, j) hat die Mitte px = x0 + i * schritt, py = y0 + j * schritt.
 */
export function karteRaster(stufe, region, schritt = 2) {
  const reg = regionVon(region);
  // Kernbereich (Hafen, Revier und Anfahrt); der breitere Rand von BEREICH ist nur Kulisse
  const x0 = KERN.x0, y0 = KERN.y0;
  const nx = Math.floor((KERN.x1 - x0) / schritt) + 1, ny = Math.floor((KERN.y1 - y0) / schritt) + 1;
  const n = nx * ny;
  const tiefe = new Float32Array(n), artA = new Uint8Array(n), ufer = new Float32Array(n);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const p = punkt(x0 + i * schritt, y0 + j * schritt, stufe, reg);
      const k = j * nx + i;
      tiefe[k] = p.h < 0 ? -p.h : 0;
      artA[k] = artNr(p);
    }
  }
  // Abstand zur Uferlinie: zwei Durchläufe (Chamfer 3-4) getrennt für Land und Wasser
  const INF = 1e9;
  const dLand = new Float32Array(n), dWasser = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const nass = artA[k] >= ART.FLACH;
    dLand[k] = nass ? 0 : INF;     // Abstand zum nächsten Wasser (für Landzellen)
    dWasser[k] = nass ? INF : 0;   // Abstand zum nächsten Land (für Wasserzellen)
  }
  for (const d of [dLand, dWasser]) {
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      let v = d[k];
      if (i > 0) v = Math.min(v, d[k - 1] + 1);
      if (j > 0) {
        v = Math.min(v, d[k - nx] + 1);
        if (i > 0) v = Math.min(v, d[k - nx - 1] + 1.4142);
        if (i < nx - 1) v = Math.min(v, d[k - nx + 1] + 1.4142);
      }
      d[k] = v;
    }
    for (let j = ny - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) {
      const k = j * nx + i;
      let v = d[k];
      if (i < nx - 1) v = Math.min(v, d[k + 1] + 1);
      if (j < ny - 1) {
        v = Math.min(v, d[k + nx] + 1);
        if (i < nx - 1) v = Math.min(v, d[k + nx + 1] + 1.4142);
        if (i > 0) v = Math.min(v, d[k + nx - 1] + 1.4142);
      }
      d[k] = v;
    }
  }
  const sM = schritt * PLAN_M;
  for (let k = 0; k < n; k++) ufer[k] = artA[k] >= ART.FLACH ? -(dWasser[k] - 0.5) * sM : (dLand[k] - 0.5) * sM;
  const zelle = (x, z) => {
    const i = Math.round((x / PLAN_M - x0) / schritt), j = Math.round((-z / PLAN_M - y0) / schritt);
    return i < 0 || j < 0 || i >= nx || j >= ny ? -1 : j * nx + i;
  };
  return {
    stufe, x0, y0, nx, ny, schritt, schrittM: sM, tiefe, art: artA, ufer,
    /** Werte der Zelle an einem Weltpunkt, außerhalb der Karte offene See. */
    beiWelt(x, z) {
      const k = zelle(x, z);
      if (k < 0) return { tiefe: 10, art: 'wasser', uferM: -50 };
      return { tiefe: tiefe[k], art: ART_NAME[artA[k]], uferM: ufer[k] };
    },
  };
}

/** Schmalste befahrbare Breite (Meter, mindestens tiefeMin tief) quer zum Engpass, zum Prüfen. */
export function engpassBreiteM(stufe, region, tiefeMin = 1.2) {
  const reg = regionVon(region);
  const f = festePunkte(stufe);
  let min = Infinity;
  for (let py = f.engpass.y0 + 2; py <= f.engpass.y1 - 2; py += 2) {
    const ax = stufe <= 2 ? seegattAchse(py) : ENGPASS_X;
    let w = 0;
    for (let dx = -60; dx <= 60; dx += 0.5) if (-punkt(ax + dx, py, stufe, reg).h >= tiefeMin) w += 0.5;
    min = Math.min(min, w);
  }
  return +(min * PLAN_M).toFixed(1);
}

export { seeNord, meerSued };
