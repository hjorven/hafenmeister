// Prueft ein Stegbild (Liegeplaetze und Stege einer Hafenvariante) nach den Regeln aus
// docs/stegbilder.md. Arbeitet auf einem Objekt in der Form von HAFEN (web/js/data/harbor.js),
// damit dieselbe Pruefung fuer das Grundbild und jede Variante gilt.
//
//   pruefeStegbild(hafen, { stege: ['A', 'B', 'C', 'CS', 'D'], stufen: [1, 2, 3, 4, 5] })
//     -> Liste von Fehlern { stufe, steg, id, regel, text }; leer heisst bestanden.
//
// Regeln je Liegeplatz der geprueften Stege:
//   ueberlappung  Box (mit Heckpfaehlen) oder Laengsseitsplatz beruehrt keinen anderen Platz,
//                 keinen Steg und kein festes Hindernis (Slip, Travellift, Wartebojen ...).
//   gasse         Vor jeder Box liegt freies Wasser, mindestens 1,5 Bootslaengen tief (echte
//                 Marinas planen 1,5 bis 2 Bootslaengen zum Eindrehen) und nie weniger als zwei
//                 Bootsbreiten plus Abstand. Laengsseits: zwei Bootsbreiten frei neben dem Platz.
//   tiefe         Platz liegt ganz im Wasser, mindestens 0,5 m tief (Gelaende des Spiels).
//   einfahrt      Ein Boot der Platzgroesse kommt vom offenen See bis vor den Platz, ohne irgendwo
//                 naeher als eine halbe Breite plus Abstand an Land, Steg, Boot oder Pfahl zu kommen.
import { punkt, warteplaetze } from '../../web/js/render/landschaft/gelaende.js';
import { region } from '../../web/js/render/landschaft/regionen.js';
import {
  K, rechteck, streckenFlaeche, kreis, schneiden, begrenzung, punktInPolygon, richtungsVektor, aufLinie,
} from './geometrie.mjs';

export const GROESSE = {          // Bootsmasse je Klasse in Planeinheiten (wie hafen_von_oben.SIZE)
  S: { laenge: 5.5 * K, breite: 2.1 * K },
  M: { laenge: 8.5 * K, breite: 2.9 * K },
  L: { laenge: 12.5 * K, breite: 3.9 * K },
  XL: { laenge: 36 * K, breite: 7.6 * K },
};
export const PFAHL = 1.5;          // Heckpfaehle hinter der Box
export const MIN_TIEFE = 0.5;

/** Wie tief muss die Gasse vor einer Box mindestens sein (Planeinheiten)? */
export function gassenTiefe(klasse) {
  const g = GROESSE[klasse] ?? GROESSE.L;
  return Math.max(1.5 * g.laenge, 2 * g.breite + 2);
}

/** Feste Hindernisse einer Stufe, die kein Stegbild beruehren darf. */
export function festeHindernisse(stufe) {
  const h = [];
  const rand = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  if (stufe >= 2) h.push({ name: 'Slip', poly: rand(-133, -16, -121, 24), gasse: true });
  if (stufe <= 2) {
    for (const b of warteplaetze(stufe).bojen) h.push({ name: `Warteboje ${b.id}`, poly: kreis([b.px, b.py], 12), gasse: false });
    // Ankerfeld: jeder feste Ankerplatz mit seinem Schwoikreis (das Boot dreht sich um den Anker) plus Abstand
    for (const a of warteplaetze(stufe).ankerplaetze) h.push({ name: `Ankerplatz ${a.id}`, poly: kreis([a.px, a.py], a.schwoikreisM / 0.62 + 2), gasse: false });
  }
  if (stufe >= 3) {
    h.push({ name: 'Mastenkran', poly: rand(62, 4, 78, 22), gasse: false });
    const fw = stufe === 3 ? [[167, 184], [128, 162], [74, 128]] : [[167, 184], [128, 162], [70, 146]];
    for (let i = 0; i + 1 < fw.length; i++) h.push({ name: 'Fahrwasser', poly: streckenFlaeche(fw[i], fw[i + 1], 7), gasse: false });
  }
  if (stufe >= 4) h.push({ name: 'Travellift', poly: rand(143, 4, 169, 31), gasse: true });
  return h;
}

/** Flaechen eines Liegeplatzes in Stufe n: platz (Boot mit Pfaehlen) und gasse (freies Wasser davor). */
export function platzFlaechen(p, stufe, hafen) {
  const l = p.lage[String(stufe)];
  if (!l) return null;
  const c = [l[0], l[1]];
  const u = richtungsVektor(l[2]);
  if (p.art === 'box' || p.art === 'finger') {
    const hl = p.laenge / 2, hb = p.breite / 2 - 0.3;
    // Boot mit Heckpfaehlen: vom Steg (Bug) bis hinter die Pfaehle
    const platz = rechteck(add(c, u, -PFAHL / 2 + 0.15), u, hl + PFAHL / 2 - 0.15, hb);
    const gt = gassenTiefe(p.klasse);
    const heck = add(c, u, -hl - PFAHL);
    const gasse = rechteck(add(heck, u, -gt / 2), u, gt / 2, hb);
    const ziel = add(heck, u, -(GROESSE[p.klasse] ?? GROESSE.L).breite / 2 - 2);
    return { platz, gasse, ziel, c };
  }
  // laengsseits: die Gasse liegt auf der Seite, die vom Steg wegzeigt
  const st = hafen.stufen[String(stufe)];
  const n = [-u[1], u[0]];
  const dir = (() => {
    let q = null, bd = Infinity;
    for (const s of st.stege) {
      if (s.steg !== p.steg) continue;
      for (let i = 0; i + 1 < s.punkte.length; i++) {
        const [ax, ay] = s.punkte[i], [bx, by] = s.punkte[i + 1];
        const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-9;
        const t = Math.max(0, Math.min(1, ((c[0] - ax) * dx + (c[1] - ay) * dy) / l2));
        const qx = ax + dx * t, qy = ay + dy * t, d = Math.hypot(c[0] - qx, c[1] - qy);
        if (d < bd) { bd = d; q = [qx, qy]; }
      }
    }
    if (!q) return n;
    const w = [c[0] - q[0], c[1] - q[1]];
    return w[0] * n[0] + w[1] * n[1] >= 0 ? n : [-n[0], -n[1]];
  })();
  const hl = p.laenge / 2 - 0.2, hb = p.breite / 2;
  const platz = rechteck(c, u, hl, hb);
  const bw = p.breite;
  const gasse = rechteck(add(c, dir, hb + bw + 0.2), u, hl, bw);
  const ziel = add(c, dir, hb + bw);
  return { platz, gasse, ziel, c };
}

function add(a, b, f = 1) { return [a[0] + b[0] * f, a[1] + b[1] * f]; }

/** Flaechen der Steglinien einer Stufe (je Segment ein Rechteck). */
export function stegFlaechen(st) {
  const out = [];
  for (const s of st.stege) {
    if (s.bauart === 'kai') continue;
    const hb = Math.max(0.6, (s.breite || 2.4) * K / 2);
    for (let i = 0; i + 1 < s.punkte.length; i++) {
      out.push({ steg: s.steg, poly: streckenFlaeche(s.punkte[i], s.punkte[i + 1], hb), linie: s });
    }
  }
  return out;
}

const tiefeCache = new Map();
function tiefeBei(x, y, stufe, reg) {
  const key = `${stufe}|${reg}|${Math.round(x * 2)}|${Math.round(y * 2)}`;
  let v = tiefeCache.get(key);
  if (v === undefined) { v = -punkt(x, y, stufe, region(reg)).h; tiefeCache.set(key, v); }
  return v;
}

export function stichproben(poly) {
  const [a, b, c, d] = poly;
  const m = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
  const pts = [m];
  for (const q of poly) pts.push([q[0] * 0.8 + m[0] * 0.2, q[1] * 0.8 + m[1] * 0.2]);
  for (const [p, q] of [[a, b], [b, c], [c, d], [d, a]]) pts.push([(p[0] + q[0]) / 2 * 0.85 + m[0] * 0.15, (p[1] + q[1]) / 2 * 0.85 + m[1] * 0.15]);
  return pts;
}

// ------------------------------------------------------------------ Einfahrt (Raster)

const RASTER = { x0: -175, x1: 215, y0: -20, y1: 182, z: 1 };

/** Abstandsfeld: Entfernung jeder Rasterzelle zum naechsten Hindernis (Planeinheiten). */
function abstandsFeld(hindernisse, stufe, reg) {
  const { x0, x1, y0, y1, z } = RASTER;
  const W = Math.round((x1 - x0) / z), H = Math.round((y1 - y0) / z);
  const fest = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const x = x0 + (i + 0.5) * z, y = y0 + (j + 0.5) * z;
      if (tiefeBei(x, y, stufe, reg) < 0.4) fest[j * W + i] = 1;
    }
  }
  for (const poly of hindernisse) {
    const [bx0, by0, bx1, by1] = begrenzung(poly);
    const i0 = Math.max(0, Math.floor((bx0 - x0) / z)), i1 = Math.min(W - 1, Math.ceil((bx1 - x0) / z));
    const j0 = Math.max(0, Math.floor((by0 - y0) / z)), j1 = Math.min(H - 1, Math.ceil((by1 - y0) / z));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        if (punktInPolygon(x0 + (i + 0.5) * z, y0 + (j + 0.5) * z, poly)) fest[j * W + i] = 1;
      }
    }
  }
  // Chamfer-Abstand (3-4), danach in Planeinheiten
  const d = new Float32Array(W * H);
  const INF = 1e9;
  for (let k = 0; k < W * H; k++) d[k] = fest[k] ? 0 : INF;
  const a = 1, b = Math.SQRT2;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i; let v = d[k];
    if (i > 0) v = Math.min(v, d[k - 1] + a);
    if (j > 0) { v = Math.min(v, d[k - W] + a); if (i > 0) v = Math.min(v, d[k - W - 1] + b); if (i < W - 1) v = Math.min(v, d[k - W + 1] + b); }
    d[k] = v;
  }
  for (let j = H - 1; j >= 0; j--) for (let i = W - 1; i >= 0; i--) {
    const k = j * W + i; let v = d[k];
    if (i < W - 1) v = Math.min(v, d[k + 1] + a);
    if (j < H - 1) { v = Math.min(v, d[k + W] + a); if (i < W - 1) v = Math.min(v, d[k + W + 1] + b); if (i > 0) v = Math.min(v, d[k + W - 1] + b); }
    d[k] = v;
  }
  return { d, W, H };
}

function erreichbar(feld, radius, start) {
  const { d, W, H } = feld, { x0, y0, z } = RASTER;
  const frei = (k) => d[k] * z > radius;
  const seen = new Uint8Array(W * H);
  const si = Math.floor((start[0] - x0) / z), sj = Math.floor((start[1] - y0) / z);
  const k0 = sj * W + si;
  if (!frei(k0)) return null;
  const q = [k0]; seen[k0] = 1;
  while (q.length) {
    const k = q.pop(); const i = k % W, j = (k / W) | 0;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ii = i + di, jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue;
      const kk = jj * W + ii;
      if (!seen[kk] && frei(kk)) { seen[kk] = 1; q.push(kk); }
    }
  }
  return (p) => {
    const i = Math.floor((p[0] - x0) / z), j = Math.floor((p[1] - y0) / z);
    if (i < 0 || j < 0 || i >= W || j >= H) return false;
    // im Umkreis von 1,5 Zellen ein erreichbares Feld genuegt (Rasterung)
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ii = i + di, jj = j + dj;
      if (ii >= 0 && jj >= 0 && ii < W && jj < H && seen[jj * W + ii]) return true;
    }
    return false;
  };
}

/** Punkt im offenen See, von dem aus alle Boote kommen (Durchstich ab Stufe 3, sonst Seemitte). */
export const SEEPUNKT = [120, 150];

// ------------------------------------------------------------------ Pruefung

export function pruefeStegbild(hafen, { stege = ['A', 'B', 'C', 'CS', 'D'], stufen, region: reg = 'ostsee', einfahrt = true } = {}) {
  const fehler = [];
  const geprueft = new Set(stege);
  const alleStufen = stufen ?? Object.keys(hafen.stufen).map(Number).filter((n) => n <= 5);
  for (const stufe of alleStufen) {
    const st = hafen.stufen[String(stufe)];
    if (!st) continue;
    const plaetze = hafen.plaetze.filter((p) => p.lage[String(stufe)]).map((p) => ({ p, f: platzFlaechen(p, stufe, hafen) }));
    const linien = stegFlaechen(st);
    const fest = festeHindernisse(stufe);
    const melde = (p, regel, text) => fehler.push({ stufe, steg: p.steg, id: p.id, regel, text });

    for (const { p, f } of plaetze) {
      if (!geprueft.has(p.steg)) continue;
      // Ueberlappung mit anderen Plaetzen
      for (const o of plaetze) {
        if (o.p === p) continue;
        if (schneiden(f.platz, o.f.platz)) melde(p, 'ueberlappung', `beruehrt Platz ${o.p.id}`);
        if ((p.art === 'box' || p.art === 'finger') && schneiden(f.gasse, o.f.platz)) melde(p, 'gasse', `Gasse vor dem Platz versperrt durch ${o.p.id}`);
        if (p.art === 'stirn' && schneiden(f.gasse, o.f.platz)) melde(p, 'gasse', `kein Platz zum Anlegen neben ${o.p.id}`);
      }
      // Stege: Platz darf nur den eigenen Steg an der Bugseite beruehren
      for (const l of linien) {
        if (schneiden(shrink(f.platz, 0.35), l.poly)) melde(p, 'ueberlappung', `liegt auf Steg ${l.steg ?? 'Dienststeg'}`);
        if (schneiden(f.gasse, l.poly)) melde(p, 'gasse', `Gasse vor dem Platz kreuzt Steg ${l.steg ?? 'Dienststeg'}`);
      }
      for (const h of fest) {
        if (schneiden(f.platz, h.poly)) melde(p, 'ueberlappung', `liegt in ${h.name}`);
        if (h.gasse && schneiden(f.gasse, h.poly)) melde(p, 'gasse', `Gasse vor dem Platz liegt in ${h.name}`);
      }
      // Tiefe
      const flach = stichproben(f.platz).some(([x, y]) => tiefeBei(x, y, stufe, reg) < MIN_TIEFE);
      if (flach) melde(p, 'tiefe', 'liegt (teilweise) an Land oder zu flach');
      const gasseTrocken = stichproben(f.gasse).some(([x, y]) => tiefeBei(x, y, stufe, reg) < 0.4);
      if (gasseTrocken) melde(p, 'gasse', 'Gasse vor dem Platz laeuft auf Land oder Flachwasser');
    }
    // Stege der geprueften Stegbilder gegen feste Hindernisse und fremde Plaetze
    for (const l of linien) {
      if (!geprueft.has(l.steg)) continue;
      for (const h of fest) if (schneiden(l.poly, h.poly)) fehler.push({ stufe, steg: l.steg, id: null, regel: 'ueberlappung', text: `Steg ${l.steg} liegt in ${h.name}` });
      for (const o of plaetze) {
        if (geprueft.has(o.p.steg)) continue;
        if (schneiden(l.poly, o.f.platz)) fehler.push({ stufe, steg: l.steg, id: o.p.id, regel: 'ueberlappung', text: `Steg ${l.steg} liegt auf Platz ${o.p.id}` });
      }
      for (const m of linien) {
        if (m.steg === l.steg || m === l) continue;
        // Abzweig: ein Steg beginnt auf dem anderen (Stichsteg am Hauptsteg)
        const ab = (x, y) => aufLinie(y.linie.punkte, x.linie.punkte[0][0], x.linie.punkte[0][1]).d < 3;
        if (ab(l, m) || ab(m, l)) continue;
        if (schneiden(l.poly, m.poly)) fehler.push({ stufe, steg: l.steg, id: null, regel: 'ueberlappung', text: `Steg ${l.steg} kreuzt Steg ${m.steg ?? 'Dienststeg'}` });
      }
    }

    if (!einfahrt) continue;
    // Einfahrt: Abstandsfeld aus Land, allen Plaetzen, Stegen und festen Hindernissen
    const hind = [...plaetze.map((e) => e.f.platz), ...linien.map((l) => l.poly), ...fest.filter((h) => !h.name.startsWith('Fahrwasser') && !h.name.startsWith('Anker')).map((h) => h.poly)];
    const feld = abstandsFeld(hind, stufe, reg);
    const proKlasse = new Map();
    for (const { p, f } of plaetze) {
      if (!geprueft.has(p.steg)) continue;
      const g = GROESSE[p.klasse] ?? GROESSE.L;
      const r = g.breite / 2 + 0.6;
      if (!proKlasse.has(r)) proKlasse.set(r, erreichbar(feld, r, SEEPUNKT));
      const ok = proKlasse.get(r);
      if (!ok || !ok(f.ziel)) melde(p, 'einfahrt', `ein ${p.klasse}-Boot kommt nicht bis vor den Platz`);
    }
  }
  return fehler;
}

function shrink(poly, f) {
  // Rechteck an der Bugseite (Kante 0-3) um f kuerzen, damit der eigene Steg nicht zaehlt
  const [a, b, c, d] = poly;
  const u = [a[0] - b[0], a[1] - b[1]], L = Math.hypot(u[0], u[1]) || 1;
  const k = f / L;
  return [[a[0] - u[0] * k, a[1] - u[1] * k], b, c, [d[0] - u[0] * k, d[1] - u[1] * k]];
}

/** Fehler kurz zusammenfassen (fuer Konsole und Tests). */
export function zusammenfassen(fehler, max = 30) {
  const zeilen = fehler.slice(0, max).map((f) => `Stufe ${f.stufe} ${f.id ?? f.steg}: ${f.regel}, ${f.text}`);
  if (fehler.length > max) zeilen.push(`... und ${fehler.length - max} weitere`);
  return zeilen.join('\n');
}
