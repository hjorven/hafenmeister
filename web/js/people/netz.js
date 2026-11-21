// Wegenetz fuer die Menschen im Hafen, abgeleitet aus dem echten Gelaende des Spiels (Kuestentyp und Seed,
// render/landschaft/natur.js und gelaende.js), den Stegen aus web/js/data/harbor.js und den Gebaeuden.
// Kennt kein Three.js, damit es sich mit node --test pruefen laesst.
// Gehoert dem Thread "Menschen auf das Gelaende stellen" (frueher "Menschen im Hafen herumlaufen lassen").
//
// Aufbau:
//   1. Bodenraster (3 Planeinheiten, 1,9 m) ueber den Kernbereich aus punkt(): Hoehe und Bodenart. Begehbar ist
//      trockenes Land; Schilf, Steinschuettung, Watt und Wasser nicht. Wege und Pflaster kosten wenig, Felder,
//      Wald und Duenen mehr, damit die Leute auf Wegen bleiben. Das Raster wird je Stufe und Gelaende gemerkt.
//   2. Hindernisse: Gebaeude, Dienste und Anlagen (Grundriss), Dorfhaeuser, Kirche, Muehle und Hoefe.
//   3. Laufnetz: ein Knoten je 6 Planeinheiten auf freiem Boden, Kanten zu den 8 Nachbarn nur bei freier Sicht
//      ueber begehbare Zellen und ohne Steilhang. Dazu Stege, Kais, Piers, Molen und die Seebruecke als Linien.
//   4. Ziele: Gebaeudetueren, Stegkoepfe und Molenkoepfe (Aussicht), Seebrueckenkopf, Strandplaetze auf Sand mit
//      einer Badestelle im flachen Wasser davor (nicht im Hafenbecken).
//   netz.weg(a, b) sucht mit A* und zieht den Weg danach gerade (nur ueber gleich guten oder besseren Boden).
//
// Alle Koordinaten in Planeinheiten wie in web/js/data/harbor.js (x nach Osten, y nach Norden, 1 Einheit = 0,62 m).
//
//   const netz = baueNetz({ hafen, stufe, region, gebaeude, hindernisse, boden, istLand })
//   gebaeude     [{ id, art, x, y, tuer?: {x, y}, box?: [x0, y0, x1, y1] }] stehende Gebaeude (Ziele und Hindernisse)
//   hindernisse  [{ box: [x0, y0, x1, y1] } | { kreis: [x, y, r] } | { haus: { px, py, dreh, breite, laenge } }] weitere
//   boden(x, y)  optional { h, typ } statt punkt(); istLand(x, y) optional zusaetzlicher Filter (Tests)
//   gebaut       optional { stege: [{ steg, bauart, punkte }], plaetze: Set } aus game.stege.gebaut(): nur diese
//                Stegstuecke und Plaetze kommen ins Netz (ungebaute Stege und Bauplaetze betritt niemand).
//                Ohne gebaut gelten alle Stege und Plaetze der Stufe (Testansicht ?stufe=n, Tests).
//   netz.nodes[i]        { x, y, art }  art: land, sand, wasser, holz, schwimmsteg, kai, pier, mole, bruecke, boot
//   netz.komp[i]         Nummer der zusammenhaengenden Flaeche
//   netz.weg(a, b)       Liste von Knoten-Indizes von a nach b (A*, gerade gezogen), oder null
//   netz.plaetze         Map Platz-id -> { x, y, node, einstieg } (Boot und Einstieg am Steg)
//   netz.ziele           [{ node, art, id }] Ziele zum Hingehen
//   netz.zuhause         [node] Haustueren, Dorf und Strassenenden am Kartenrand: hier kommen Spaziergaenger her
//   netz.duenen          [node] Zugaenge hinter den Straenden: hier kommen Badegaeste her
//   netz.flaechen        { festland, nehrung } Flaeche des Hafens und Flaeche mit den meisten Strandplaetzen
//   netz.zentrum         { x, y } Mitte der Stegwurzeln, dort ist am meisten los
//   netz.naechster(x, y, komp)  naechster Knoten (optional nur in einer Flaeche)
//   netz.strecken()      [[ax, ay, bx, by]] feste Wege (Stege, Molen, Anschluesse) fuer Deko, die frei bleiben soll
//   netz.frei(x, y)      ist der Punkt begehbarer Boden (fuer Pruefungen)
import { punkt, molen as molenVon, hafenAbstand } from '../render/landschaft/gelaende.js';
import { REGIONEN } from '../render/landschaft/regionen.js';
import { natur } from '../render/landschaft/formen.js';
import { seebrueckeStrecke } from '../render/landschaft/strand.js';
import * as vielfalt from '../render/landschaft/vielfalt.js';

/** Bereich des Laufnetzes (Planeinheiten): Kernbereich des Gelaendes bis hinter die Seepiers der Stufe 6. */
export const LAUFBEREICH = { x0: -420, x1: 430, y0: -200, y1: 520 };
const FEIN = 3;              // Bodenraster
const GROB = 2;              // Knoten je GROB x GROB Bodenzellen (6 Planeinheiten, 3,7 m)
const TROCKEN = 0.2;         // Meter ueber dem Wasser, ab hier begehbar (darunter nasse Wiese und Pfuetzen)
const STEIL = 0.55;          // Hoehe je Meter Weg, steiler geht niemand
const ANSCHLUSS = 11;        // so weit darf ein Steg- oder Tuerende vom naechsten Laufknoten weg sein
const RAND = 0.9;            // Abstand der Leute zu Hauswaenden (Meter)

// Bodenarten: Kosten je Laufmeter (Infinity = nicht begehbar)
const KOSTEN = {
  weg: 0.55, pflaster: 0.55, feldweg: 0.65, dorf: 0.75, mole: 0.7, promenade: 0.55,
  gras: 1, wiese: 1, weide: 1.2, sand: 1.1, salzwiese: 1.3, duenengras: 1.3, duene: 1.5, fels: 1.6,
  waldboden: 1.8, korn: 2.4, raps: 2.4, acker: 2.2, kliff: 2,
  wasser: Infinity, schilfrand: Infinity, steinschuettung: Infinity, watt: Infinity,
};
const kostenVon = (typ) => KOSTEN[typ] ?? 1.2;
const U = 0.62;

const stufeVon = (s) => Math.max(1, Math.min(6, Math.round(Number(s) || 1)));
const regionVon = (r) => (r && typeof r === 'object' ? r : REGIONEN[r] ?? REGIONEN.ostsee);

function naechsterAufStrecke(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy || 1e-9;
  let t = ((px - ax) * dx + (py - ay) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  const x = ax + dx * t, y = ay + dy * t;
  return { t, x, y, d: Math.hypot(px - x, py - y) };
}

// ------------------------------------------------------------------ Bodenraster (gemerkt)
const _boden = new Map();
let _bodenNatur = null;

/** Bodenraster einer Stufe: { x0, y0, nx, ny, s, h: Float32Array, kosten: Float32Array, sand: Uint8Array } */
export function bodenRaster(stufe, region = 'ostsee', boden = null) {
  let N = null;
  try { N = natur(); } catch { N = null; }
  if (N !== _bodenNatur) { _boden.clear(); _bodenNatur = N; }
  const reg = regionVon(region);
  const key = `${stufe}|${reg.name ?? region}`;
  if (!boden && _boden.has(key)) return _boden.get(key);
  const b = boden ?? ((x, y) => punkt(x, y, stufe, reg));
  const x0 = LAUFBEREICH.x0, y0 = LAUFBEREICH.y0;
  const nx = Math.floor((LAUFBEREICH.x1 - x0) / FEIN) + 1, ny = Math.floor((LAUFBEREICH.y1 - y0) / FEIN) + 1;
  const h = new Float32Array(nx * ny), kosten = new Float32Array(nx * ny), sand = new Uint8Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i;
    const p = b(x0 + i * FEIN, y0 + j * FEIN);
    h[k] = p.h;
    kosten[k] = p.h < TROCKEN ? Infinity : kostenVon(p.typ);
    sand[k] = p.typ === 'sand' ? 1 : 0;
  }
  // Abstand zum Wasser: Zellen direkt am Ufer (eine Zelle, 1,9 m) betritt niemand, sonst tritt man
  // mit dem seitlichen Versatz beim Gehen oder an einer Kaikante ins Wasser
  const nass = (k) => h[k] < TROCKEN;
  const ufer = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i;
    if (!Number.isFinite(kosten[k])) continue;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ii = i + di, jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
      if (nass(jj * nx + ii)) { ufer.push(k); dj = di = 2; }
    }
  }
  for (const k of ufer) kosten[k] = Infinity;
  const r = { x0, y0, nx, ny, s: FEIN, h, kosten, sand };
  if (!boden) _boden.set(key, r);
  return r;
}

// ------------------------------------------------------------------ Netz
export function baueNetz({ hafen, stufe, region = 'ostsee', gebaeude = [], hindernisse = [], boden = null, istLand = null, gebaut = null }) {
  stufe = stufeVon(stufe);
  const reg = regionVon(region);
  const B = bodenRaster(stufe, reg, boden);
  const { x0, y0, nx, ny, s } = B;
  const n = nx * ny;
  // Kosten je Zelle mit Hindernissen (Kopie, das gemerkte Raster bleibt unveraendert)
  const kost = Float32Array.from(B.kosten);
  if (istLand) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if (!istLand(x0 + i * s, y0 + j * s)) kost[j * nx + i] = Infinity;
  const zelle = (x, y) => {
    const i = Math.round((x - x0) / s), j = Math.round((y - y0) / s);
    return i < 0 || j < 0 || i >= nx || j >= ny ? -1 : j * nx + i;
  };
  const kostenBei = (x, y) => { const k = zelle(x, y); return k < 0 ? Infinity : kost[k]; };
  const hoeheBei = (x, y) => { const k = zelle(x, y); return k < 0 ? 0 : B.h[k]; };
  const rand = RAND / U;
  const sperren = (bx0, by0, bx1, by1, test) => {
    const i0 = Math.max(0, Math.floor((bx0 - rand - x0) / s)), i1 = Math.min(nx - 1, Math.ceil((bx1 + rand - x0) / s));
    const j0 = Math.max(0, Math.floor((by0 - rand - y0) / s)), j1 = Math.min(ny - 1, Math.ceil((by1 + rand - y0) / s));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (!test || test(x0 + i * s, y0 + j * s)) kost[j * nx + i] = Infinity;
  };
  const hindernis = (o) => {
    if (o.box) { const [a, b, c, d] = o.box; sperren(a, b, c, d); }
    else if (o.kreis) {
      const [cx, cy, r] = o.kreis;
      sperren(cx - r, cy - r, cx + r, cy + r, (x, y) => Math.hypot(x - cx, y - cy) <= r + rand);
    } else if (o.haus) {
      // Dorfhaus wie in bewuchs.js: Breite quer, Laenge laengs, um dreh um die Hochachse gedreht (Welt z = -y)
      const { px, py, dreh, breite, laenge } = o.haus;
      const c = Math.cos(dreh), sn = Math.sin(dreh), hb = breite / 2 + rand, hl = laenge / 2 + rand, r = Math.hypot(hb, hl);
      sperren(px - r, py - r, px + r, py + r, (x, y) => {
        const wx = x - px, wz = -(y - py);
        return Math.abs(wx * c - wz * sn) <= hb && Math.abs(wx * sn + wz * c) <= hl;
      });
    }
  };
  for (const g of gebaeude) {
    if (g.art === 'seebruecke' || g.art === 'strandkoerbe') continue;
    if (g.box) hindernis({ box: g.box });
    else if (g.halbBreite) hindernis({ kreis: [g.x, g.y, g.halbBreite * 0.8] });
  }
  for (const o of hindernisse) hindernis(o);
  for (const o of dorfHindernisse(stufe)) hindernis(o);

  // ---------------------------------------------------------------- Linien (Stege, Kais, Piers, Molen, Seebruecke)
  const st = hafen.stufen[String(stufe)] ?? hafen.stufen[String(Math.min(5, stufe))];
  const linien = [];         // { pts, art, steg, att: [{ seg, t, h }] }
  const haken = [];          // Handle -> Knoten (nach dem Zusammenbau)
  const paare = [];          // [Handle, Handle] spaeter verbinden
  const anLand = [];         // [Handle] mit dem Laufnetz verbinden
  const aussicht = [];       // Handles fuer Steg- und Molenkoepfe
  const linie = (pts, art, steg = null) => { const l = { pts, art, steg, att: [] }; linien.push(l); return l; };
  function anschlussEnde(l, i) {
    const hd = haken.length;
    haken.push(null);
    if (i === 0) l.att.push({ seg: 0, t: 0, h: hd });
    else l.att.push({ seg: i - 1, t: 1, h: hd });
    return hd;
  }
  const anschluss = (x, y, filter) => {
    let best = null;
    for (const l of linien) {
      if (!filter(l)) continue;
      for (let i = 0; i < l.pts.length - 1; i++) {
        const [ax, ay] = l.pts[i], [bx, by] = l.pts[i + 1];
        const q = naechsterAufStrecke(x, y, ax, ay, bx, by);
        if (!best || q.d < best.d) best = { ...q, l, seg: i };
      }
    }
    if (!best) return null;
    const hd = haken.length;
    haken.push(null);
    best.l.att.push({ seg: best.seg, t: best.t, h: hd });
    return { h: hd, d: best.d };
  };

  for (const l of gebaut?.stege ?? st?.stege ?? []) {
    if (!l.steg || !(l.punkte?.length >= 2)) continue;   // Dienststege (Tankstelle, Seenotretter, Travellift)
    const art = ['holz', 'schwimmsteg', 'kai', 'pier'].includes(l.bauart) ? l.bauart : 'holz';
    linie(l.punkte.map((p) => [p[0], p[1]]), art, l.steg);
  }
  const stegLinien = linien.slice();
  for (const m of molenVon(stufe)) {
    // Nur echte Molen mit begehbarer Krone; Wellenbrecher aus Steinschuettung betritt niemand
    if (!/mole/i.test(m.name)) continue;
    linie(m.punkte.map((p) => [p[0], p[1]]), 'mole');
  }
  if (gebaeude.some((g) => g.art === 'seebruecke')) {
    const sb = seebrueckeStrecke(stufe, reg.name ?? 'ostsee');
    if (sb) linie([sb.fuss, sb.kopf], 'bruecke');
  }

  // Enden anschliessen: an Land ans Laufnetz, sonst an einen anderen Steg, sonst Aussichtspunkt
  for (const l of linien) {
    const letzte = l.pts.length - 1;
    l.pts.forEach(([x, y], i) => {
      const ende = i === 0 || i === letzte;
      if (!ende && l.art !== 'kai' && l.art !== 'mole') return;
      const amLand = landNah(x, y);
      if (amLand) { anLand.push(anschlussEnde2(l, i)); return; }
      if (!ende) return;
      if (l.steg != null) {
        const h = anschluss(x, y, (o) => o !== l && o.steg != null);
        if (h && h.d < 8) { paare.push([anschlussEnde2(l, i), h.h]); return; }
      }
      if (i === letzte || l.art === 'bruecke') aussicht.push(anschlussEnde2(l, i));
    });
  }
  // Ein Zwischenpunkt eines Linienzugs braucht einen Haken auf dem Punkt selbst (t = 1 des Segments davor)
  function anschlussEnde2(l, i) {
    if (i === 0) return anschlussEnde(l, 0);
    const hd = haken.length;
    haken.push(null);
    l.att.push({ seg: i - 1, t: 1, h: hd });
    return hd;
  }
  function landNah(x, y) {
    const r = Math.ceil(ANSCHLUSS / s);
    const i0 = Math.round((x - x0) / s), j0 = Math.round((y - y0) / s);
    for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      const i = i0 + di, j = j0 + dj;
      if (i < 0 || j < 0 || i >= nx || j >= ny) continue;
      if (Number.isFinite(kost[j * nx + i]) && Math.hypot(di * s, dj * s) <= ANSCHLUSS) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- Liegeplaetze
  const plaetzeRoh = [];
  for (const p of hafen.plaetze) {
    if (gebaut?.plaetze && !gebaut.plaetze.has(p.id)) continue;
    const lage = p.lage[String(stufe)];
    if (!lage) continue;
    const [x, y, richtung] = lage;
    let h = anschluss(x, y, (l) => l.steg != null && l.steg === p.steg);
    if (!h || h.d > 40) h = anschluss(x, y, (l) => l.steg != null);
    if (h) plaetzeRoh.push({ id: p.id, x, y, richtung, h: h.h, klasse: p.klasse });
  }

  // ---------------------------------------------------------------- Knoten bauen
  const nodes = [];
  const adj = [];
  const kostKante = [];      // parallel zu adj: Kostenfaktor der Kante
  const add = (x, y, art) => { nodes.push({ x, y, art }); adj.push([]); kostKante.push([]); return nodes.length - 1; };
  const link = (a, b, f = 1) => {
    if (a == null || b == null || a < 0 || b < 0 || a === b || adj[a].includes(b)) return;
    adj[a].push(b); adj[b].push(a);
    kostKante[a].push(f); kostKante[b].push(f);
  };
  const feste = [];          // feste Strecken fuer strecken()

  // Laufnetz auf dem Boden: ein Knoten je GROB x GROB Zellen, auf der begehbaren Zelle naechst der Blockmitte
  const gnx = Math.ceil(nx / GROB), gny = Math.ceil(ny / GROB);
  const gitter = new Int32Array(gnx * gny).fill(-1);
  for (let gj = 0; gj < gny; gj++) for (let gi = 0; gi < gnx; gi++) {
    let best = -1, bd = Infinity;
    for (let dj = 0; dj < GROB; dj++) for (let di = 0; di < GROB; di++) {
      const i = gi * GROB + di, j = gj * GROB + dj;
      if (i >= nx || j >= ny) continue;
      const k = j * nx + i;
      if (!Number.isFinite(kost[k])) continue;
      // Knoten nur, wo auch die Nachbarzellen frei sind (nicht direkt an Wasser oder Hauswand), sonst die beste Zelle
      let frei = 0;
      for (const q of [k - 1, k + 1, k - nx, k + nx]) if (q >= 0 && q < n && Number.isFinite(kost[q])) frei++;
      const d = Math.hypot(di - (GROB - 1) / 2, dj - (GROB - 1) / 2) + (4 - frei) * 2;
      if (d < bd) { bd = d; best = k; }
    }
    if (best < 0) continue;
    const i = best % nx, j = (best - i) / nx;
    gitter[gj * gnx + gi] = add(x0 + i * s, y0 + j * s, B.sand[best] ? 'sand' : 'land');
  }
  const istBoden = (i) => nodes[i].art === 'land' || nodes[i].art === 'sand';

  // Freie Sicht ueber begehbare Zellen; liefert den hoechsten Kostenwert unterwegs (Infinity = versperrt) und
  // prueft die Steigung
  function sicht(ax, ay, bx, by) {
    const l = Math.hypot(bx - ax, by - ay);
    const schritte = Math.max(1, Math.ceil(l / (s * 0.5)));
    let max = 0, hv = hoeheBei(ax, ay);
    for (let q = 0; q <= schritte; q++) {
      const x = ax + (bx - ax) * q / schritte, y = ay + (by - ay) * q / schritte;
      const c = kostenBei(x, y);
      if (!Number.isFinite(c)) return Infinity;
      if (c > max) max = c;
      if (q > 0) {
        const hh = hoeheBei(x, y);
        if (Math.abs(hh - hv) / (l / schritte * U) > STEIL) return Infinity;
        hv = hh;
      }
    }
    // Alle Zellen, die die Linie beruehrt (nicht nur die Proben): sonst schluepft eine schraege Linie
    // zwischen zwei gesperrten Zellen hindurch (schmaler Graben, Hausecke)
    let u = (ax - x0) / s + 0.5, v = (ay - y0) / s + 0.5;
    const ue = (bx - x0) / s + 0.5, ve = (by - y0) / s + 0.5;
    let ci = Math.floor(u), cj = Math.floor(v);
    const ei = Math.floor(ue), ej = Math.floor(ve);
    const du = ue - u, dv = ve - v;
    const si = Math.sign(du), sj = Math.sign(dv);
    const tdu = si ? Math.abs(1 / du) : Infinity, tdv = sj ? Math.abs(1 / dv) : Infinity;
    let tu = si > 0 ? (ci + 1 - u) * tdu : si < 0 ? (u - ci) * tdu : Infinity;
    let tv = sj > 0 ? (cj + 1 - v) * tdv : sj < 0 ? (v - cj) * tdv : Infinity;
    for (let n = 0; n < 400; n++) {
      if (ci < 0 || cj < 0 || ci >= nx || cj >= ny || !Number.isFinite(kost[cj * nx + ci])) return Infinity;
      if (ci === ei && cj === ej) break;
      if (Math.abs(tu - tv) < 1e-9) {
        // genau durch eine Ecke: beide Nachbarn muessen frei sein
        if (ci + si >= 0 && ci + si < nx && !Number.isFinite(kost[cj * nx + ci + si])) return Infinity;
        if (cj + sj >= 0 && cj + sj < ny && !Number.isFinite(kost[(cj + sj) * nx + ci])) return Infinity;
        ci += si; cj += sj; tu += tdu; tv += tdv;
      } else if (tu < tv) { ci += si; tu += tdu; } else { cj += sj; tv += tdv; }
      if (tu > 1 + 1e-9 && tv > 1 + 1e-9 && !(ci === ei && cj === ej)) break;
    }
    return max;
  }
  for (let gj = 0; gj < gny; gj++) for (let gi = 0; gi < gnx; gi++) {
    const a = gitter[gj * gnx + gi];
    if (a < 0) continue;
    for (const [di, dj] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) {
      const ni = gi + di, nj = gj + dj;
      if (ni < 0 || nj < 0 || ni >= gnx || nj >= gny) continue;
      const b = gitter[nj * gnx + ni];
      if (b < 0) continue;
      const c = sicht(nodes[a].x, nodes[a].y, nodes[b].x, nodes[b].y);
      if (!Number.isFinite(c)) continue;
      const ka = kostenBei(nodes[a].x, nodes[a].y), kb = kostenBei(nodes[b].x, nodes[b].y);
      link(a, b, (ka + kb + c) / 3);
    }
  }
  // naechster Laufknoten (Boden) mit freier Sicht
  function bodenKnoten(x, y, r = ANSCHLUSS, mitSicht = false) {
    const gi0 = Math.round((x - x0) / (s * GROB)), gj0 = Math.round((y - y0) / (s * GROB));
    const R = Math.ceil(r / (s * GROB)) + 1;
    let best = -1, bd = Infinity;
    for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) {
      const gi = gi0 + di, gj = gj0 + dj;
      if (gi < 0 || gj < 0 || gi >= gnx || gj >= gny) continue;
      const k = gitter[gj * gnx + gi];
      if (k < 0) continue;
      const d = Math.hypot(nodes[k].x - x, nodes[k].y - y);
      if (d > r || d >= bd) continue;
      if (mitSicht && !Number.isFinite(sicht(x, y, nodes[k].x, nodes[k].y))) continue;
      bd = d; best = k;
    }
    return best;
  }

  for (const l of linien) {
    const vert = l.pts.map(([x, y]) => add(x, y, l.art));
    for (let i = 0; i < l.pts.length - 1; i++) {
      const atts = l.att.filter((a) => a.seg === i).sort((a, b) => a.t - b.t);
      let prev = vert[i];
      for (const a of atts) {
        let nd;
        if (a.t < 1e-3) nd = vert[i];
        else if (a.t > 1 - 1e-3) nd = vert[i + 1];
        else {
          const [ax, ay] = l.pts[i], [bx, by] = l.pts[i + 1];
          nd = add(ax + (bx - ax) * a.t, ay + (by - ay) * a.t, l.art);
        }
        haken[a.h] = nd;
        link(prev, nd, 0.6);
        prev = nd;
      }
      link(prev, vert[i + 1], 0.6);
      feste.push([l.pts[i][0], l.pts[i][1], l.pts[i + 1][0], l.pts[i + 1][1]]);
    }
  }
  for (const [a, b] of paare) link(haken[a], haken[b], 0.6);
  for (const hd of anLand) {
    const nd = haken[hd];
    const g = bodenKnoten(nodes[nd].x, nodes[nd].y);
    if (g >= 0) { link(nd, g, 0.8); feste.push([nodes[nd].x, nodes[nd].y, nodes[g].x, nodes[g].y]); }
  }

  const plaetze = new Map();
  for (const p of plaetzeRoh) {
    const nd = add(p.x, p.y, 'boot');
    link(nd, haken[p.h], 1);
    plaetze.set(p.id, { id: p.id, x: p.x, y: p.y, richtung: p.richtung, node: nd, einstieg: haken[p.h] });
  }

  // ---------------------------------------------------------------- Gebaeude
  const ziele = [];
  const zuhause = [];
  for (const g of gebaeude) {
    if (g.art === 'seebruecke') continue;
    const tuer = g.tuer ?? { x: g.x, y: g.art === 'wohnhaus' ? g.y - 6 : g.art === 'strandkoerbe' ? g.y - 3 : g.y + 6 };
    // Tuer auf freiem Boden suchen (vor dem Grundriss), sonst den naechsten Laufknoten nehmen
    let gk = bodenKnoten(tuer.x, tuer.y, ANSCHLUSS, true);
    if (gk < 0) gk = bodenKnoten(tuer.x, tuer.y, ANSCHLUSS * 1.6);
    if (gk < 0) continue;
    const nd = Number.isFinite(kostenBei(tuer.x, tuer.y)) ? add(tuer.x, tuer.y, 'land') : gk;
    if (nd !== gk) link(nd, gk, 1);
    if (g.art === 'wohnhaus') zuhause.push(nd);
    else ziele.push({ node: nd, art: g.art, id: g.id });
  }
  for (const hd of aussicht) ziele.push({ node: haken[hd], art: nodes[haken[hd]].art === 'bruecke' ? 'seebruecke' : 'aussicht', id: nodes[haken[hd]].art === 'bruecke' ? 'seebruecke' : null });

  // ---------------------------------------------------------------- Strand und Badestellen
  // Sand am Wasser, ausserhalb des Hafens und weg von Stegen und Molen; davor flaches Wasser zum Baden
  const stegNah = (x, y, r) => linien.some((l) => l.pts.some((p, i) => i > 0 && naechsterAufStrecke(x, y, l.pts[i - 1][0], l.pts[i - 1][1], p[0], p[1]).d < r));
  const plaetzeNah = (x, y, r) => plaetzeRoh.some((p) => Math.hypot(p.x - x, p.y - y) < r);
  const spots = [];
  const richtungen = Array.from({ length: 16 }, (_, k) => [Math.cos(k * Math.PI / 8), Math.sin(k * Math.PI / 8)]);
  for (let gi = 0; gi < gnx; gi++) for (let gj = 0; gj < gny; gj++) {
    const g = gitter[gj * gnx + gi];
    if (g < 0 || nodes[g].art !== 'sand') continue;
    const { x, y } = nodes[g];
    if (hafenAbstand(x, y, stufe) < 12) continue;
    if (spots.some((p) => Math.hypot(p.x - x, p.y - y) < 20)) continue;
    // Wasser in einer Richtung: die Uferlinie hoechstens 10 Einheiten weit, die Badestelle 3 bis 5 Einheiten
    // dahinter im flachen Wasser, und dahinter offenes Wasser (kein Bach, kein Graben)
    let bad = null;
    for (const [dx, dy] of richtungen) {
      let d0 = 0;
      for (let d = 2; d <= 10; d++) if (hoeheBei(x + dx * d, y + dy * d) < 0) { d0 = d; break; }
      if (!d0) continue;
      const ok = [d0 + 1, d0 + 3, d0 + 5].every((d) => { const hh = hoeheBei(x + dx * d, y + dy * d); return hh < 0 && hh > -1.6; }) &&
        [d0 + 15, d0 + 27, d0 + 40].every((d) => hoeheBei(x + dx * d, y + dy * d) < -0.3);
      if (!ok) continue;
      const bx = x + dx * (d0 + 4), by = y + dy * (d0 + 4);
      if (stegNah(bx, by, 26) || plaetzeNah(bx, by, 40)) continue;
      bad = { x: bx, y: by };
      break;
    }
    if (!bad) continue;
    spots.push({ x, y, g, bad });
    if (spots.length >= 60) break;
  }
  for (const sp of spots) {
    ziele.push({ node: sp.g, art: 'strand', id: null });
    const b = add(sp.bad.x, sp.bad.y, 'wasser');
    link(b, sp.g, 1);
    ziele.push({ node: b, art: 'baden', id: null });
  }

  // Aussichtspunkte am Ufer ausserhalb des Hafens (Fels, Wiese, Kliffkante): auch Kuesten ohne Sandstrand
  // haben Stellen, an denen man stehen bleibt und aufs Wasser schaut
  const ufer = [];
  const mitte = stegLinien.length ? stegLinien[0].pts[0] : [-80, 0];
  for (let gi = 0; gi < gnx && ufer.length < 10; gi += 2) for (let gj = 0; gj < gny && ufer.length < 10; gj += 2) {
    const g = gitter[gj * gnx + gi];
    if (g < 0 || nodes[g].art !== 'land') continue;
    const { x, y } = nodes[g];
    if (Math.hypot(x - mitte[0], y - mitte[1]) > 260 || hafenAbstand(x, y, stufe) < 12) continue;
    if (ufer.some((p) => Math.hypot(p[0] - x, p[1] - y) < 40) || spots.some((p) => Math.hypot(p.x - x, p.y - y) < 30)) continue;
    const blick = richtungen.some(([dx, dy]) => hoeheBei(x + dx * 6, y + dy * 6) < 0 && [18, 30, 45].every((d) => hoeheBei(x + dx * d, y + dy * d) < -0.3));
    if (!blick) continue;
    ufer.push([x, y]);
    ziele.push({ node: g, art: 'aussicht', id: null });
  }

  // ---------------------------------------------------------------- Flaechen
  const komp = new Array(nodes.length).fill(-1);
  let kn = 0;
  for (let i = 0; i < nodes.length; i++) {
    if (komp[i] !== -1) continue;
    const stapel = [i];
    komp[i] = kn;
    while (stapel.length) {
      const a = stapel.pop();
      for (const b of adj[a]) if (komp[b] === -1) { komp[b] = kn; stapel.push(b); }
    }
    kn++;
  }

  // Mitte des Hafens (Wurzeln der Stege): Spaziergaenger halten sich gern in der Naehe auf
  const wurzeln = stegLinien.filter((l) => l.art !== 'kai' && l.art !== 'pier' && landNah(l.pts[0][0], l.pts[0][1])).map((l) => l.pts[0]);
  const zentrum = wurzeln.length
    ? { x: wurzeln.reduce((a, p) => a + p[0], 0) / wurzeln.length, y: wurzeln.reduce((a, p) => a + p[1], 0) / wurzeln.length }
    : { x: -80, y: -10 };

  function naechster(x, y, nurKomp = null) {
    // erst im Gitter suchen, dann alle Knoten (Stege, Tueren)
    let best = -1, bd = Infinity;
    for (let r = 12; r <= 200 && best < 0; r *= 2) {
      const g = bodenKnoten(x, y, r);
      if (g >= 0 && (nurKomp == null || komp[g] === nurKomp)) { best = g; bd = Math.hypot(nodes[g].x - x, nodes[g].y - y); }
    }
    for (let i = 0; i < nodes.length; i++) {
      const nd = nodes[i];
      if (nd.art === 'boot' || (nurKomp != null && komp[i] !== nurKomp)) continue;
      if (istBoden(i) && best >= 0) continue;
      const d = Math.hypot(nd.x - x, nd.y - y);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  const festKnoten = naechster(zentrum.x, zentrum.y - 12);
  const festland = festKnoten >= 0 ? komp[festKnoten] : 0;

  // Dorf und Strassenenden: hier kommen Spaziergaenger her (je Flaeche nur Knoten, die dazugehoeren)
  for (const h of dorfTueren(stufe)) {
    const g = bodenKnoten(h[0], h[1], 20);
    if (g >= 0) zuhause.push(g);
  }
  for (const [x, y] of [[LAUFBEREICH.x0 + 6, -88], [LAUFBEREICH.x1 - 6, -88], [LAUFBEREICH.x0 + 6, -140], [LAUFBEREICH.x1 - 6, -140], [-40, LAUFBEREICH.y0 + 6]]) {
    const g = bodenKnoten(x, y, 40);
    if (g >= 0) zuhause.push(g);
  }
  // Nichts gefunden (Inselhafen ohne Dorf): Rand der Hafenflaeche
  if (!zuhause.some((z) => komp[z] === festland) && festKnoten >= 0) {
    let fern = festKnoten, fd = 0;
    for (let i = 0; i < nodes.length; i++) {
      if (komp[i] !== festland || !istBoden(i)) continue;
      const d = Math.hypot(nodes[i].x - zentrum.x, nodes[i].y - zentrum.y);
      if (d > fd && d < 160) { fd = d; fern = i; }
    }
    zuhause.push(fern);
  }

  // Flaeche mit den meisten Strandplaetzen (oft Nehrung oder Landzunge, sonst das Festland)
  const proKomp = new Map();
  for (const sp of spots) proKomp.set(komp[sp.g], (proKomp.get(komp[sp.g]) ?? 0) + 1);
  let nehrung = festland, meist = -1;
  for (const [k, c] of proKomp) if (c > meist || (c === meist && k === festland)) { meist = c; nehrung = k; }

  // Zugaenge zum Strand: Boden 14 bis 34 Einheiten landeinwaerts hinter den Strandplaetzen (nicht Sand)
  const duenen = [];
  for (const sp of spots) {
    if (komp[sp.g] !== nehrung) continue;
    let best = -1, bw = -Infinity;
    for (let dj = -6; dj <= 6; dj++) for (let di = -6; di <= 6; di++) {
      const gi = Math.round((sp.x - x0) / (s * GROB)) + di, gj = Math.round((sp.y - y0) / (s * GROB)) + dj;
      if (gi < 0 || gj < 0 || gi >= gnx || gj >= gny) continue;
      const k = gitter[gj * gnx + gi];
      if (k < 0 || komp[k] !== nehrung || nodes[k].art === 'sand') continue;
      const d = Math.hypot(nodes[k].x - sp.x, nodes[k].y - sp.y);
      if (d < 14 || d > 34) continue;
      const w = Math.hypot(nodes[k].x - sp.bad.x, nodes[k].y - sp.bad.y) - d * 0.5;
      if (w > bw) { bw = w; best = k; }
    }
    if (best >= 0 && !duenen.includes(best)) duenen.push(best);
  }
  // Keine Wiese hinter dem Strand (schmale Nehrung, Sandhaken): Badegaeste kommen vom Strand selbst
  if (!duenen.length) for (const sp of spots) if (komp[sp.g] === nehrung) duenen.push(sp.g);

  const dist = (a, b) => Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y);

  // A* mit Binaerhaufen. Boot- und Wasserknoten sind Sackgassen: man geht nur hinein, wenn es das Ziel ist.
  function roherWeg(start, ziel) {
    if (start === ziel) return [start];
    if (start == null || ziel == null || start < 0 || ziel < 0 || komp[start] !== komp[ziel]) return null;
    const g = new Map([[start, 0]]);
    const von = new Map();
    const zu = new Set();
    const haufen = [[dist(start, ziel) * 0.5, start]];
    const rein = (f, v) => {
      haufen.push([f, v]);
      let i = haufen.length - 1;
      while (i > 0) { const p = (i - 1) >> 1; if (haufen[p][0] <= haufen[i][0]) break; [haufen[p], haufen[i]] = [haufen[i], haufen[p]]; i = p; }
    };
    const raus = () => {
      const top = haufen[0], last = haufen.pop();
      if (haufen.length) {
        haufen[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1;
          let m = i;
          if (l < haufen.length && haufen[l][0] < haufen[m][0]) m = l;
          if (r < haufen.length && haufen[r][0] < haufen[m][0]) m = r;
          if (m === i) break;
          [haufen[m], haufen[i]] = [haufen[i], haufen[m]];
          i = m;
        }
      }
      return top;
    };
    while (haufen.length) {
      const [, a] = raus();
      if (zu.has(a)) continue;
      if (a === ziel) {
        const pfad = [a];
        let c = a;
        while (von.has(c)) { c = von.get(c); pfad.push(c); }
        return pfad.reverse();
      }
      zu.add(a);
      const ga = g.get(a);
      for (let q = 0; q < adj[a].length; q++) {
        const b = adj[a][q];
        if (zu.has(b)) continue;
        if ((nodes[b].art === 'boot' || nodes[b].art === 'wasser') && b !== ziel) continue;
        const ng = ga + dist(a, b) * kostKante[a][q];
        if (ng < (g.get(b) ?? Infinity)) {
          von.set(b, a);
          g.set(b, ng);
          rein(ng + dist(b, ziel) * 0.5, b);
        }
      }
    }
    return null;
  }

  // Gerade ziehen: Bodenknoten ueberspringen, solange die Sichtlinie frei ist und nicht ueber schlechteren
  // Boden fuehrt als der Weg selbst (so bleibt man auf dem Weg und laeuft nicht quer uebers Feld)
  function geradeZiehen(p) {
    if (p.length < 3) return p;
    const out = [p[0]];
    let i = 0;
    while (i < p.length - 1) {
      let j = i + 1;
      if (istBoden(p[i])) {
        let max = Math.max(kostenBei(nodes[p[i]].x, nodes[p[i]].y), kostenBei(nodes[p[j]].x, nodes[p[j]].y));
        for (let k = i + 2; k < p.length && istBoden(p[k]) && k - i <= 40; k++) {
          max = Math.max(max, kostenBei(nodes[p[k]].x, nodes[p[k]].y), kostenBei(nodes[p[k - 1]].x, nodes[p[k - 1]].y));
          const c = sicht(nodes[p[i]].x, nodes[p[i]].y, nodes[p[k]].x, nodes[p[k]].y);
          if (!Number.isFinite(c) || c > max + 1e-6) break;
          j = k;
        }
      }
      out.push(p[j]);
      i = j;
    }
    return out;
  }

  const weg = (a, b) => { const p = roherWeg(a, b); return p ? geradeZiehen(p) : null; };

  const flaechen = { festland, nehrung };
  const frei = (x, y) => Number.isFinite(kostenBei(x, y));
  const strecken = () => feste.slice();

  return {
    stufe, nodes, adj, komp, weg, naechster, plaetze, ziele, duenen, flaechen, zentrum, frei, strecken,
    zuhause: [...new Set(zuhause.filter((z) => z >= 0))],
  };
}

// ------------------------------------------------------------------ Dorf (render/landschaft/vielfalt.js)
function dorfHaeuser(stufe) {
  try {
    const plan = vielfalt.dorfPlan?.();
    if (!plan) return { plan: null, haeuser: [] };
    const haeuser = typeof vielfalt.dorfWachstum === 'function' ? vielfalt.dorfWachstum(plan, stufe) : plan.haeuser;
    const zeile = typeof vielfalt.hafenortZeile === 'function' ? vielfalt.hafenortZeile(stufe) : [];
    return { plan, haeuser: [...haeuser, ...zeile] };
  } catch { return { plan: null, haeuser: [] }; }
}

function dorfHindernisse(stufe) {
  const { plan, haeuser } = dorfHaeuser(stufe);
  const out = haeuser.map((h) => ({ haus: h }));
  if (plan?.kirche) out.push({ kreis: [plan.kirche.px, plan.kirche.py, 12] });
  if (plan?.muehle) out.push({ kreis: [plan.muehle.px, plan.muehle.py, 6] });
  try { for (const h of vielfalt.hoefe?.() ?? []) out.push({ kreis: [h.px, h.py, 9] }); } catch { /* ohne Hoefe */ }
  return out;
}

/** Punkte vor den Dorfhaeusern (Planeinheiten), dort kommen Spaziergaenger aus dem Haus. */
function dorfTueren(stufe) {
  const { haeuser } = dorfHaeuser(stufe);
  // jedes dritte Haus reicht, sonst wird es ein Gewimmel
  return haeuser.filter((_, i) => i % 3 === 0).map((h) => [h.px, h.py]);
}
