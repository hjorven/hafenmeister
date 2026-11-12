// Erzeugt Stegbilder (Varianten der Stege A, B, C mit Stichsteg CS und D) und schreibt sie nach
// web/js/data/stegbilder.js. Beschreibung: docs/stegbilder.md
//
//   node tools/stegbilder/erzeugen.mjs            # Varianten suchen, pruefen, Datei schreiben
//   node tools/stegbilder/erzeugen.mjs --pruefen  # nur pruefen, ob die Datei zu Generator und Gelaende passt
//
// Ablauf je Variante (fester Startwert, also immer gleiches Ergebnis):
//   1. Jeder Steg waechst Segment fuer Segment vom Ufer aus. Nach jedem Segment wird gezaehlt, wie
//      viele Boxen links und rechts passen, ohne etwas zu beruehren (Plaetze, Gassen, Stege, Land,
//      feste Hindernisse). Passt nichts, wird ein anderer Knick, eine andere Laenge oder Seite probiert.
//   2. Welche Knicke schon benutzt wurden, merkt sich die Variante. Geradeaus nach geradeaus und der
//      gleiche Knick mehrmals hintereinander werden seltener gewaehlt, damit es nicht eintoenig wird.
//   3. Jede Stufe nimmt so viele Plaetze vom Ufer aus, wie das Grundbild in dieser Stufe hat. Die ids
//      kommen in derselben Reihenfolge vom Ufer nach aussen wie im Grundbild, damit Stegprojekte,
//      Balancing und gekaufte Plaetze unveraendert gelten.
//   4. Am Ende prueft tools/stegbilder/pruefen.mjs die ganze Variante in allen Stufen. Nur bestandene
//      Varianten kommen in die Datei, und von denen die, die sich am staerksten unterscheiden.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HAFEN } from '../../web/js/data/harbor.js';
import { punkt, suedufer } from '../../web/js/render/landschaft/gelaende.js';
import { region } from '../../web/js/render/landschaft/regionen.js';
import { K, schneiden, aufLinie, linienLaenge, zufall, streckenFlaeche } from './geometrie.mjs';
import { pruefeStegbild, platzFlaechen, festeHindernisse, zusammenfassen, gassenTiefe, stichproben, PFAHL, MIN_TIEFE } from './pruefen.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ZIEL = path.join(HIER, '..', '..', 'web', 'js', 'data', 'stegbilder.js');

export const VARIIERT = ['A', 'B', 'C', 'CS', 'D'];
const STUFEN = [1, 2, 3, 4, 5];
const ANZAHL = 12;            // so viele Varianten kommen ins Spiel
const KANDIDATEN = 1500;       // so viele Startwerte werden versucht

// Box: Laenge, Breite (Planeinheiten) wie hafen_von_oben.SIZE
const BOX = { S: { bl: 5.5 * K, bw: 3.0 * K }, M: { bl: 8.5 * K, bw: 3.9 * K }, L: { bl: 12.5 * K, bw: 5.0 * K } };

// Stegarten. kurs in Grad: 0 = Norden, positiv nach Osten. band: wo die Stegwurzel am Ufer liegen darf.
const STEG = {
  A: { maxY: 110, klasse: 'S', art: 'box', breite: 2.4, bauart: 'holz', band: [-114, -102], kurs: [-16, 0], ende: 'haken',
    knickRegel: { knicke: [-20, -12, 0, 12], mitte: -10, grenze: 14 } },
  B: { maxY: 125, geradeBis: 16, klasse: 'M', art: 'box', breite: 2.4, bauart: 'holz', band: [-58, -44], kurs: [-8, 10], ende: 'tkopf',
    knickRegel: { mitte: 0, grenze: 24 } },
  C: { maxY: 166, seitenGewicht: [0.9, 0.05, 0.05], klasse: 'L', art: 'box', breite: 2.8, bauart: 'holz', band: [0, 26], kurs: [-8, 14], ende: 'tkopf',
    knickRegel: { knicke: [-20, -12, 0, 12, 20], maxKnicke: 1, mitte: 3, grenze: 22 } },
  CS: { klasse: 'M', art: 'box', breite: 2.4, bauart: 'holz' },
  D: { maxY: 135, klasse: 'L', art: 'finger', breite: 3.0, bauart: 'schwimmsteg', band: [98, 122], kurs: [-12, 12], ende: 'tkopf',
    knickRegel: { mitte: 0, grenze: 24 } },
};
const KNICKE = [-30, -20, -12, 0, 12, 20, 30];

const r1 = (v) => Math.round(v * 10) / 10 + 0;
const dirV = (kurs) => [Math.sin(kurs * Math.PI / 180), Math.cos(kurs * Math.PI / 180)];
const linksV = (t) => [-t[1], t[0]];
const plus = (a, b, f = 1) => [a[0] + b[0] * f, a[1] + b[1] * f];
const grad = (v) => ((Math.round(Math.atan2(v[1], v[0]) * 180 / Math.PI) % 360) + 360) % 360;
const kopie = (o) => JSON.parse(JSON.stringify(o));
const uferY = (x, stufe) => (stufe >= 3 && x >= -150 && x <= 202 ? 6 : suedufer(x));
const wurzelY = (x, stufe) => uferY(x, stufe) - 4;
const tiefe = (x, y, stufe) => -punkt(x, y, stufe, region('ostsee')).h;

// ------------------------------------------------------------------ Grundbild lesen

/** Reihenfolge der Plaetze je Stufe und Steg im Grundbild (vom Ufer nach aussen). */
export function grundReihenfolge(hafen) {
  const out = {};
  for (const n of STUFEN) {
    const st = hafen.stufen[String(n)];
    out[n] = {};
    for (const s of VARIIERT) {
      const linien = st.stege.filter((l) => l.steg === s);
      const key = (p) => {
        const [x, y] = p.lage[String(n)];
        let best = null;
        linien.forEach((l, i) => {
          const a = aufLinie(l.punkte, x, y);
          if (!best || a.d < best.d - 1e-6) best = { ...a, li: i };
        });
        return best ? [best.li, best.s, -best.seite] : [0, 0, 0];
      };
      const cmp = (a, b) => { const ka = key(a), kb = key(b); return ka[0] - kb[0] || ka[1] - kb[1] || ka[2] - kb[2]; };
      const ps = hafen.plaetze.filter((p) => p.steg === s && p.lage[String(n)]);
      out[n][s] = {
        reihe: ps.filter((p) => p.art === 'box' || p.art === 'finger').sort(cmp).map((p) => p.id),
        stirn: ps.filter((p) => p.art === 'stirn').sort(cmp).map((p) => p.id),
      };
    }
  }
  return out;
}

// ------------------------------------------------------------------ Bausteine

/**
 * Slots (Boxpositionen) entlang eines Pfads ab Bogenlaenge start.
 * segs: [{ a, b, t, seiten: 'beide'|'links'|'rechts' }], knick zwischen den Segmenten in Grad.
 * Liefert sortiert nach Bogenlaenge: { s, seite, c, bug, segIdx }.
 */
function slotsAuf(segs, start, cfg, mitEnde = false) {
  const { bl, bw } = BOX[cfg.klasse];
  const jw = cfg.breite * K;
  const tiefeInnen = jw / 2 + bl + PFAHL + gassenTiefe(cfg.klasse);
  const out = [];
  let acc = 0;
  segs.forEach((g, i) => {
    const L = Math.hypot(g.b[0] - g.a[0], g.b[1] - g.a[1]);
    const vor = i > 0 ? segs[i - 1].knick ?? 0 : 0;   // Knick am Anfang dieses Segments
    const nach = i + 1 < segs.length ? g.knick ?? 0 : 0;
    for (const seite of [1, -1]) {
      if (g.seiten === 'links' && seite !== 1) continue;
      if (g.seiten === 'rechts' && seite !== -1) continue;
      const rand = (kn) => {
        if (!kn) return 0.6;
        const innen = Math.sign(kn) === -seite;   // Knick positiv = nach rechts (Osten), dann ist rechts innen
        return innen ? tiefeInnen * Math.tan(Math.abs(kn) * Math.PI / 360) + 1.2 : jw / 2 * Math.tan(Math.abs(kn) * Math.PI / 360) + 1.2;
      };
      let a0 = Math.max(acc + rand(vor), start) - acc;
      const a1 = L - (mitEnde && i === segs.length - 1 ? 0 : rand(nach));
      const n = new Array(0);
      for (let a = a0; a + bw <= a1 + 1e-6; a += bw) n.push(a);
      for (const a of n) {
        const m = a + bw / 2;
        const base = plus(g.a, g.t, m);
        const nv = linksV(g.t);
        const c = plus(base, nv, seite * (jw / 2 + bl / 2));
        out.push({ s: acc + m, seite, c, bug: [-nv[0] * seite, -nv[1] * seite], segIdx: i });
      }
    }
    acc += L;
  });
  out.sort((x, y) => x.s - y.s || y.seite - x.seite);
  return out;
}

/** Punkt bei Bogenlaenge s auf Segmentliste; dazu die Pfadpunkte bis dorthin. */
function schneidePfad(segs, s) {
  const pts = [segs[0].a];
  let acc = 0;
  for (const g of segs) {
    const L = Math.hypot(g.b[0] - g.a[0], g.b[1] - g.a[1]);
    if (acc + L >= s - 1e-9) {
      pts.push(plus(g.a, g.t, s - acc));
      return { punkte: pts, ende: pts.at(-1), t: g.t };
    }
    pts.push(g.b);
    acc += L;
  }
  const g = segs.at(-1);
  return { punkte: pts, ende: g.b, t: g.t };
}

/** Teil des Pfads zwischen Bogenlaenge s0 und s1 als Punktliste. */
function teilPfad(segs, s0, s1) {
  const pts = [];
  let acc = 0;
  for (const g of segs) {
    const L = Math.hypot(g.b[0] - g.a[0], g.b[1] - g.a[1]);
    const a = Math.max(s0, acc), b = Math.min(s1, acc + L);
    if (b > a + 1e-9) {
      const p0 = plus(g.a, g.t, a - acc), p1 = plus(g.a, g.t, b - acc);
      if (!pts.length) pts.push(p0);
      pts.push(p1);
    }
    acc += L;
  }
  return pts;
}

/** Pfadpunkt, an dem der Pfad die Linie y = yGrenze kreuzt (Bogenlaenge). */
function bogenBeiY(segs, yGrenze) {
  let acc = 0;
  for (const g of segs) {
    const L = Math.hypot(g.b[0] - g.a[0], g.b[1] - g.a[1]);
    if ((g.a[1] - yGrenze) * (g.b[1] - yGrenze) <= 0 && g.b[1] !== g.a[1]) {
      return acc + L * (yGrenze - g.a[1]) / (g.b[1] - g.a[1]);
    }
    acc += L;
  }
  return 0;
}

function platzObjekt(id, klasse, art, c, bug, laenge, breite) {
  return { id, klasse, art, laenge, breite, lage: { x: [c[0], c[1], grad(bug)] } };
}

// ------------------------------------------------------------------ Variante bauen

export class Bauplatz {
  constructor(seed) {
    this.seed = seed;
    this.rnd = zufall(seed * 7919 + 17);
    this.hafen = kopie(HAFEN);
    this.reihen = grundReihenfolge(HAFEN);
    this.benutzt = new Map();      // Knick -> wie oft in dieser Variante
    this.merkmale = {};
    // alle variierten Stege aus dem Arbeitsstand nehmen
    for (const p of this.hafen.plaetze) if (VARIIERT.includes(p.steg)) p.lage = {};
    for (const n of STUFEN) {
      const st = this.hafen.stufen[String(n)];
      st.stege = st.stege.filter((l) => !VARIIERT.includes(l.steg));
    }
    this.hindernisse = {};
    for (const n of STUFEN) this.hindernisse[n] = this.feste(n);
  }

  zahl(a, b) { return a + (b - a) * this.rnd(); }
  waehle(liste, gewichte) {
    const sum = gewichte.reduce((x, y) => x + y, 0);
    let r = this.rnd() * sum;
    for (let i = 0; i < liste.length; i++) { r -= gewichte[i]; if (r <= 0) return liste[i]; }
    return liste.at(-1);
  }

  feste(n) {
    const st = this.hafen.stufen[String(n)];
    const polys = festeHindernisse(n).map((h) => ({ poly: h.poly, gasse: h.gasse, name: h.name }));
    for (const p of this.hafen.plaetze) {
      if (VARIIERT.includes(p.steg) || !p.lage[String(n)]) continue;
      polys.push({ poly: platzFlaechen(p, n, this.hafen).platz, gasse: true, name: p.id });
    }
    for (const l of st.stege) {
      for (let i = 0; i + 1 < l.punkte.length; i++) polys.push({ poly: streckenFlaeche(l.punkte[i], l.punkte[i + 1], Math.max(0.6, (l.breite || 2.4) * K / 2)), gasse: true, name: l.steg ?? 'Dienststeg' });
    }
    return { polys, gassen: [] };
  }

  /** Passt ein Platz (Flaechen f) in Stufe n zu allem, was schon steht? */
  frei(f, n, mitGasse = true) {
    const h = this.hindernisse[n];
    for (const o of h.polys) {
      if (schneiden(f.platz, o.poly)) return false;
      if (mitGasse && f.gasse && o.gasse && schneiden(f.gasse, o.poly)) return false;
    }
    for (const g of h.gassen) if (schneiden(f.platz, g)) return false;
    for (const [x, y] of stichproben(f.platz)) if (tiefe(x, y, n) < MIN_TIEFE + 0.05) return false;
    if (mitGasse && f.gasse) for (const [x, y] of stichproben(f.gasse)) if (tiefe(x, y, n) < 0.45) return false;
    return true;
  }

  /** Fehlersuche: warum ist eine Flaeche nicht frei? */
  grund(f, n) {
    const h = this.hindernisse[n];
    for (const o of h.polys) {
      if (schneiden(f.platz, o.poly)) return 'platz:' + (o.name ?? '?');
      if (f.gasse && o.gasse && schneiden(f.gasse, o.poly)) return 'gasse:' + (o.name ?? '?');
    }
    for (const g of h.gassen) if (schneiden(f.platz, g)) return 'fremde gasse';
    for (const [x, y] of stichproben(f.platz)) if (tiefe(x, y, n) < MIN_TIEFE + 0.05) return 'flach ' + Math.round(x) + ',' + Math.round(y);
    return 'gasse flach';
  }

  linieFrei(punkte, breite, n, eigene = []) {
    const hb = breite * K / 2;
    for (let i = 0; i + 1 < punkte.length; i++) {
      const poly = streckenFlaeche(punkte[i], punkte[i + 1], hb);
      for (const o of this.hindernisse[n].polys) if (schneiden(poly, o.poly)) return false;
      for (const e of eigene) if (schneiden(poly, e)) return false;
    }
    return true;
  }

  flaechen(klasse, art, c, bug, laenge, breite, n) {
    const p = platzObjekt('?', klasse, art, c, bug, laenge, breite);
    p.lage = { [String(n)]: p.lage.x };
    return platzFlaechen(p, n, this.hafen);
  }

  eintragen(steg, n, linien, plaetze) {
    const st = this.hafen.stufen[String(n)];
    st.stege.push(...linien);
    for (const [id, lage] of Object.entries(plaetze)) {
      const p = this.hafen.plaetze.find((q) => q.id === id);
      p.lage[String(n)] = lage;
    }
    // Hindernisse fuer die naechsten Stege
    const h = this.hindernisse[n];
    for (const l of linien) {
      for (let i = 0; i + 1 < l.punkte.length; i++) h.polys.push({ poly: streckenFlaeche(l.punkte[i], l.punkte[i + 1], Math.max(0.6, l.breite * K / 2)), gasse: true, name: l.steg });
    }
    for (const id of Object.keys(plaetze)) {
      const p = this.hafen.plaetze.find((q) => q.id === id);
      const f = platzFlaechen(p, n, this.hafen);
      h.polys.push({ poly: f.platz, gasse: true, name: id });
      h.gassen.push(f.gasse);
    }
  }

  /** Waechst einen Pfad Segment fuer Segment, bis genug Slots da sind. */
  /**
   * Waechst einen Steg Segment fuer Segment vom Ufer aus. Nach jedem Segment wird gezaehlt, wie viele
   * Boxen auf jeder Seite passen. Die Seite wird an der ersten Box gekappt, die etwas beruehren
   * wuerde; passt auf keiner Seite etwas, wird ein anderer Knick probiert.
   * anzahl: { stufe: Plaetze am Stamm } bestimmt, gegen welche Stufen eine Box geprueft wird.
   */
  wachsePfad(steg, cfg, anzahl, wurzelX, kurs0, luecke, opts = {}) {
    const { bw, bl } = BOX[cfg.klasse];
    const stufenMit = Object.keys(anzahl).map(Number);
    const bedarf = Math.max(...Object.values(anzahl));
    const y0 = wurzelY(wurzelX, Math.min(...stufenMit)) - 10;
    const yUfer = uferY(wurzelX, Math.min(...stufenMit));
    let startBei = 0;
    let segs = [];
    let kurs = kurs0;
    let letzterKnick = null;
    let fehlversuche = 0;
    // Stufe n beginnt am Ufer dieser Stufe (ab Stufe 3 an der Kaimauer). Eine Box wird nur gegen die
    // Stufen geprueft, in denen der Steg sie wirklich traegt.
    let startJe = {};
    // am Ufer uebersprungene Slots (eine Seite beginnt spaeter); zaehlen nirgends mit
    let weg = new Set();
    const schl = (x) => `${x.seite}:${x.s.toFixed(2)}`;
    const pruefeSlot = (sl, alle) => {
      for (const n of stufenMit) {
        if (sl.s < startJe[n] - 1e-6) continue;
        const idx = alle.filter((x) => !weg.has(schl(x)) && x.s >= startJe[n] - 1e-6 && x.s < sl.s - 1e-6).length;
        if (idx >= anzahl[n] + 1) continue;     // so weit reicht der Steg in dieser Stufe nicht
        const f = this.flaechen(cfg.klasse, cfg.art, sl.c, sl.bug, bl, bw, n);
        if (!this.frei(f, n)) {
          if (process.env.STEG_GRUND) console.log('slot', steg, 'stufe', n, 'idx', idx, 'c', sl.c.map(Math.round), this.grund(f, n));
          return false;
        }
      }
      return true;
    };
    while (fehlversuche < 24) {
      const istErstes = segs.length === 0;
      if (istErstes) weg = new Set();
      const a = istErstes ? [wurzelX, y0] : segs.at(-1).b;
      // Bis die Plaetze der ersten Stufe stehen, bleibt der Steg bei Bedarf gerade und zweiseitig
      const bisher = segs.length ? slotsAuf(segs, startBei, cfg, true).length : 0;
      const gerade = bisher < (cfg.geradeBis ?? 0);
      const knick = istErstes || gerade ? 0 : this.waehleKnick(letzterKnick, kurs, { ...opts, knickeBisher: segs.filter((g) => g.knick).length, ...cfg.knickRegel });
      const k = gerade ? Math.ceil((cfg.geradeBis - bisher) / 2) + 1 : Math.ceil(this.zahl(1.5, 5));
      const seiten = gerade ? 'beide' : opts.seiten ?? this.waehle(['beide', 'links', 'rechts'], cfg.seitenGewicht ?? [0.62, 0.19, 0.19]);
      const neuKurs = kurs + knick;
      const t = dirV(neuKurs);
      if (istErstes) {
        const nMin = Math.min(...stufenMit);
        startBei = (yUfer - y0) / Math.max(0.5, t[1]) + luecke(nMin);
        startJe = Object.fromEntries(stufenMit.map((n) => [n, (uferY(wurzelX, n) - y0) / Math.max(0.5, t[1]) + luecke(n)]));
      }
      const vorlauf = istErstes ? startBei : (knick ? 12 : 1.2);
      const L = vorlauf + k * bw + 1.2;
      const kandidat = segs.map((g) => ({ ...g }));
      if (kandidat.length) kandidat[kandidat.length - 1].knick = knick;
      kandidat.push({ a, b: plus(a, t, L), t, seiten, kurs: neuKurs, knick: 0 });
      const anfang = istErstes ? plus(a, t, startBei - luecke(Math.min(...stufenMit)) + 2) : a;
      if (kandidat.at(-1).b[1] > cfg.maxY) { fehlversuche++; continue; }
      if (!this.linieFrei([anfang, kandidat.at(-1).b], cfg.breite, Math.max(...stufenMit))) { fehlversuche++; continue; }
      // alle Slots in Reihenfolge pruefen; am neuen Segment je Seite bis zur ersten Kollision
      const slots = slotsAuf(kandidat, startBei, cfg, true);
      const letzterSeg = kandidat.length - 1;
      const neueOk = { 1: [], '-1': [] }, gesperrt = { 1: false, '-1': false };
      slots.forEach((sl) => {
        if (sl.segIdx !== letzterSeg) return;      // aeltere Segmente sind schon geprueft
        if (gesperrt[sl.seite]) return;
        if (pruefeSlot(sl, slots)) neueOk[sl.seite].push(sl);
        // am ersten Segment darf eine Seite erst etwas weiter draussen anfangen (flaches Wasser am Ufer)
        else if (istErstes && neueOk[sl.seite].length === 0) weg.add(schl(sl));
        else gesperrt[sl.seite] = true;
      });
      const nL = neueOk[1].length, nR = neueOk[-1].length;
      if (nL === 0 && nR === 0) { fehlversuche++; continue; }
      // Segment kuerzen: endet hinter der letzten passenden Box der laengeren Seite
      let behalten = seiten;
      if (seiten === 'beide' && (nL === 0 || nR === 0)) behalten = nL ? 'links' : 'rechts';
      const acc = linienLaenge(kandidat.slice(0, -1).flatMap((g, i) => (i === 0 ? [g.a, g.b] : [g.b])));
      const enden = [];
      if (behalten !== 'rechts' && nL) enden.push(neueOk[1].at(-1).s);
      if (behalten !== 'links' && nR) enden.push(neueOk[-1].at(-1).s);
      const sEnde = Math.max(...enden) + bw / 2 + 1.2;
      const neuL = sEnde - (kandidat.length > 1 ? acc : 0);
      const seg = kandidat.at(-1);
      seg.seiten = behalten;
      seg.b = plus(seg.a, seg.t, neuL);
      segs = kandidat;
      kurs = neuKurs; letzterKnick = knick;
      this.benutzt.set(knick, (this.benutzt.get(knick) ?? 0) + 1);
      // fertig, wenn jede Stufe ab ihrem eigenen Ufer genug Plaetze hat
      const alleSlots = slotsAuf(segs, startBei, cfg, true).filter((x) => !weg.has(schl(x)));
      if (stufenMit.every((n) => alleSlots.filter((x) => x.s >= startJe[n] - 1e-6).length >= anzahl[n] + (opts.extra ?? 0))) return segs;
    }
    if (process.env.STEG_DEBUG) console.log('pfad', steg, 'x', Math.round(wurzelX), 'kurs', Math.round(kurs0), 'segs', segs.length, 'slots', segs.length ? slotsAuf(segs, startBei, cfg, true).length : 0, 'von', bedarf + (opts.extra ?? 0), 'ende', segs.length ? segs.at(-1).b.map(Math.round) : '-');
    return null;
  }

  waehleKnick(letzter, kurs, opts) {
    const grenze = opts.grenze ?? 34;
    let moegl = (opts.knicke ?? KNICKE).filter((k) => Math.abs(kurs + k - (opts.mitte ?? 0)) <= grenze);
    if ((opts.knickeBisher ?? 0) >= (opts.maxKnicke ?? 9)) moegl = [0];
    const gew = moegl.map((k) => {
      if (moegl.length === 1) return 1;
      let w = k === 0 ? 1.4 : 1;
      if (letzter === 0 && k === 0) w *= 0.35;          // nicht nur geradeaus
      if (letzter !== null && k === letzter && k !== 0) w *= 0.3;   // kein Zickzack mit gleichem Knick
      w /= 1 + 0.25 * (this.benutzt.get(k) ?? 0);      // was oft benutzt wurde, kommt seltener
      return w;
    });
    return this.waehle(moegl, gew);
  }

  /** Laengsseitsplaetze an einer Linie (T-Kopf, Gabelarm): fuellt ab start auf Seite seite. */
  stirnAn(punkte, seite, ids, breiteM, start = 1.5, gap = 4) {
    const [a, b] = punkte;
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const t = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], nv = linksV(t);
    const out = {};
    let s = start;
    for (const id of ids) {
      const p = this.hafen.plaetze.find((q) => q.id === id);
      const c = plus(plus(a, t, s + p.laenge / 2), nv, seite * (breiteM * K / 2 + 0.8 + p.breite / 2));
      out[id] = { c, bug: t, p };
      s += p.laenge + gap;
    }
    return { plaetze: out, laenge: s - gap + start };
  }

  stirnFrei(st, n) {
    for (const { c, bug, p } of Object.values(st.plaetze)) {
      const f = this.flaechen(p.klasse, 'stirn-frei', c, bug, p.laenge, p.breite, n);
      if (!f || !this.frei(f, n, false)) return false;
    }
    return true;
  }

  // ---------------------------------------------------------------- einzelne Stege

  /** Steg mit Boxreihe und T-Kopf oder Haken. ast: Abzweig (Stichsteg) ab Stufe 4. */
  baueSteg(steg) {
    const cfg = STEG[steg];
    const stufenMit = STUFEN.filter((n) => this.reihen[n][steg].reihe.length);
    // D traegt in Stufe 5 nur so viele Plaetze am Stamm wie in Stufe 4, der Rest kommt an die Gabel
    const amStamm = (n) => (steg === 'D' && n >= 5 ? this.reihen[4].D.reihe.length : this.reihen[n][steg].reihe.length);
    const bedarf = Math.max(...stufenMit.map(amStamm));
    const wx = this.zahl(...cfg.band);
    const kurs0 = this.zahl(...cfg.kurs);
    const lueckeBasis = this.zahl(5, 9);
    // Abstand vom Ufer bis zur ersten Box; vor der Kaimauer (ab Stufe 3) ist es flacher, dort weiter draussen
    const luecke = (n) => lueckeBasis + (n >= 3 ? 4 : 0);
    const istC = steg === 'C';
    const astSeite = this.rnd() < 0.5 ? 1 : -1;
    const astPlatz = this.zahl(0.3, 0.8);
    const astWinkel = this.zahl(72, 95);
    const csb = (STEG.CS.breite * K / 2 + BOX.M.bl + PFAHL) / Math.sin(astWinkel * Math.PI / 180) + BOX.L.bw / 2 + 1;
    const extra = istC ? Math.ceil((2 * csb) / BOX.L.bw) + 1 : 0;   // Slots, die der Stichsteg belegt
    void bedarf;
    const segs = this.wachsePfad(steg, cfg, Object.fromEntries(stufenMit.map((n) => [n, amStamm(n)])), wx, kurs0, luecke, { extra });
    if (!segs) return 'pfad';

    const plan = {};
    for (const n of stufenMit) {
      const sWurzel = bogenBeiY(segs, wurzelY(wx, n));
      const sUfer = bogenBeiY(segs, uferY(wx, n));
      // nur Slots, die in dieser Stufe wirklich frei sind (am Ufer kann eine Seite spaeter anfangen)
      const begonnen = { 1: false, '-1': false };
      let slots = slotsAuf(segs, sUfer + luecke(n), cfg).filter((sl) => {
        if (begonnen[sl.seite]) return true;
        const fl = this.flaechen(cfg.klasse, cfg.art, sl.c, sl.bug, BOX[cfg.klasse].bl, BOX[cfg.klasse].bw, n);
        begonnen[sl.seite] = this.frei(fl, n);
        if (!begonnen[sl.seite] && process.env.STEG_GRUND) console.log('vorne weg', steg, n, sl.c.map(Math.round), this.grund(fl, n));
        return begonnen[sl.seite];
      });
      const anzahl = amStamm(n);
      let ast = null;
      if (istC && n >= 4) {
        // Abzweig des Stichstegs: Slots dieser Seite rund um den Abzweig bleiben frei
        const seite = slots.filter((x) => x.seite === astSeite);
        const k = Math.max(1, Math.min(seite.length - 2, Math.round(astPlatz * (anzahl / 2))));
        ast = seite[k]?.s;
        if (ast === undefined) return 'zu-kurz';
        slots = slots.filter((x) => !(x.seite === astSeite && Math.abs(x.s - ast) < csb));
      }
      if (slots.length < anzahl) return 'zu-kurz';
      // Einzelne Boxen ohne Nachbarn auf derselben Seite sehen verloren aus: weglassen, solange genug bleiben
      const allein = (x) => !slots.some((y) => y !== x && y.seite === x.seite && Math.abs(y.s - x.s) < BOX[cfg.klasse].bw * 1.6);
      let ohneAllein = slots.filter((x) => !allein(x));
      if (ohneAllein.length >= anzahl && process.env.OHNE_FILTER !== "1") slots = ohneAllein;
      const genutzt = slots.slice(0, anzahl);
      const sEnde = Math.max(genutzt.at(-1).s + BOX[cfg.klasse].bw / 2 + (cfg.ende === 'tkopf' ? 4 : 1.5), ast !== null ? ast + 3 : 0);
      const stamm = teilPfad(segs, sWurzel, sEnde);
      const cut = schneidePfad(segs, sEnde);
      plan[n] = { genutzt, ids: this.reihen[n][steg].reihe.slice(0, anzahl), stamm, ende: cut.ende, t: cut.t, ast };
    }

    // Kopf je Stufe: T-Kopf mit Laengsseitsplaetzen, Haken bei A, Gabel bei D ab Stufe 5
    const kopfF = this.zahl(0.3, 0.7);
    const hakenSeite = this.rnd() < 0.5 ? 1 : -1;
    const hakenKnick = this.zahl(65, 95);
    const hakenL = this.zahl(11, 17);
    const gabel = { w: this.zahl(16, 46), w2: this.zahl(16, 46), teil: this.zahl(0.3, 0.7), seiten: this.rnd() < 0.4 ? 'beide' : 'eine',
      lage: [this.rnd() < 0.5 ? 'innen' : 'aussen', this.rnd() < 0.5 ? 'innen' : 'aussen'] };
    const ergebnis = {};
    for (const n of stufenMit) {
      if (steg === 'D' && n >= 5) continue;
      const pl = plan[n];
      const linien = [];
      const lagen = {};
      pl.genutzt.forEach((sl, i) => { lagen[pl.ids[i]] = [r1(sl.c[0]), r1(sl.c[1]), grad(sl.bug)]; });
      const stirnIds = this.reihen[n][steg].stirn;
      const stammPunkte = pl.stamm.map(([x, y]) => [r1(x), r1(y)]);
      if (steg === 'A') {
        const tk = dirV(Math.atan2(pl.t[0], pl.t[1]) * 180 / Math.PI + hakenSeite * hakenKnick);
        const h = plus(pl.ende, tk, hakenL);
        stammPunkte.push([r1(h[0]), r1(h[1])]);
        if (!this.linieFrei([plus(pl.ende, tk, 2), h], cfg.breite, n)) return 'haken';
      }
      linien.push({ steg, bauart: cfg.bauart, breite: n === 1 && steg === 'A' ? 2.2 : cfg.breite, punkte: stammPunkte });
      if (stirnIds.length) {
        // T-Kopf quer zum Stegende. Die Linie laeuft von links nach rechts (in Stegrichtung gesehen),
        // ihre linke Seite ist also die Aussenseite, dort liegen die Laengsseitsplaetze.
        const nv = linksV(pl.t);
        const L = this.stirnAn([[0, 0], [1, 0]], 1, stirnIds, cfg.breite).laenge + 2;
        const kopf = [plus(pl.ende, nv, L * kopfF), plus(pl.ende, nv, -(L - L * kopfF))];
        const st = this.stirnAn(kopf, 1, stirnIds, cfg.breite, 1.5);
        if (!this.stirnFrei(st, n)) return 'kopf';
        if (!this.linieFrei(kopf, cfg.breite, n)) return 'kopf';
        linien.push({ steg, bauart: cfg.bauart, breite: cfg.breite, punkte: kopf.map(([x, y]) => [r1(x), r1(y)]) });
        for (const [id, s] of Object.entries(st.plaetze)) lagen[id] = [r1(s.c[0]), r1(s.c[1]), grad(s.bug)];
      }
      ergebnis[n] = { linien, lagen };
    }

    // Stichsteg CS am Hauptsteg C
    if (istC) {
      const csCfg = STEG.CS;
      const astKnick = astWinkel * -astSeite;   // Knick positiv = nach rechts, Seite +1 = links
      const astKurs = Math.atan2(plan[4].t[0], plan[4].t[1]) * 180 / Math.PI;
      for (const n of [4, 5]) {
        const pl = plan[n];
        const cut = schneidePfad(segs, pl.ast);
        const t = dirV(Math.atan2(cut.t[0], cut.t[1]) * 180 / Math.PI + astKnick);
        void astKurs;
        const startCS = STEG.C.breite * K / 2 + BOX.L.bl + PFAHL + 2.5;
        const ids = this.reihen[n].CS.reihe;
        const segsCS = [{ a: cut.ende, b: plus(cut.ende, t, startCS + Math.ceil(ids.length / 2) * BOX.M.bw + 3), t, seiten: 'beide', knick: 0 }];
        const slots = slotsAuf(segsCS, startCS, csCfg, true);
        if (slots.length < ids.length) return 'ast';
        const lagen = {};
        for (let i = 0; i < ids.length; i++) {
          const sl = slots[i];
          const f = this.flaechen('M', 'box', sl.c, sl.bug, BOX.M.bl, BOX.M.bw, n);
          if (!this.frei(f, n)) return 'ast';
          lagen[ids[i]] = [r1(sl.c[0]), r1(sl.c[1]), grad(sl.bug)];
        }
        const endeCS = plus(cut.ende, t, slots[ids.length - 1].s + BOX.M.bw / 2 + 1.5);
        if (!this.linieFrei([plus(cut.ende, t, 3), endeCS], csCfg.breite, n)) return 'ast';
        ergebnis[n].cs = { linien: [{ steg: 'CS', bauart: 'holz', breite: csCfg.breite, punkte: [[r1(cut.ende[0]), r1(cut.ende[1])], [r1(endeCS[0]), r1(endeCS[1])]] }], lagen };
      }
    }

    // Gabel an D in Stufe 5: zwei Arme vom Stegende, Fingerplaetze auf den Aussenseiten
    if (steg === 'D') {
      const n = 5, pl = plan[5];
      void pl;
      const nStamm = this.reihen[4].D.reihe.length;
      const alle = this.reihen[5].D.reihe;
      const stammIds = alle.slice(0, nStamm);
      const armIds = alle.slice(nStamm);
      const plan4 = plan[4];
      const lagen = {};
      plan4.genutzt.forEach((sl, i) => { lagen[stammIds[i]] = [r1(sl.c[0]), r1(sl.c[1]), grad(sl.bug)]; });
      const kurs = Math.atan2(plan4.t[0], plan4.t[1]) * 180 / Math.PI;
      const armBreite = 2.8;
      const arme = [];
      let rest = [...armIds];
      const teilung = Math.max(2, Math.min(armIds.length - 2, Math.round(armIds.length * gabel.teil)));
      for (const [nr, w] of [[0, -gabel.w], [1, gabel.w2]]) {
        const t = dirV(kurs + w);
        const anzahl = nr === 0 ? teilung : rest.length;
        // Finger immer aussen (zur Seite, zu der der Arm abknickt). Zwischen den Armen laeuft das Wasser
        // zur Gabel hin spitz zu, dort legt keine echte Marina Plaetze an (keine Gasse zum Eindrehen).
        const aussen = w < 0 ? 'links' : 'rechts', innenS = w < 0 ? 'rechts' : 'links';
        const seiten = aussen;
        const proSeite = seiten === 'beide' ? Math.ceil(anzahl / 2) : anzahl;
        // Finger auf der Seite, zu der der Arm abknickt, brauchen Abstand zu den Boxen am Stamm
        const tiefeInnen = STEG.D.breite * K / 2 + BOX.L.bl + PFAHL + gassenTiefe('L');
        const startArm = seiten === innenS ? 6 + this.zahl(0, 10) : 4.5 + 2 * tiefeInnen * Math.tan(Math.abs(w) * Math.PI / 360);
        const L = startArm + proSeite * BOX.L.bw + 1.5;
        const seg = [{ a: plan4.ende, b: plus(plan4.ende, t, L), t, seiten, knick: 0 }];
        const slots = slotsAuf(seg, startArm, { klasse: 'L', breite: armBreite }, true).slice(0, anzahl);
        if (slots.length < anzahl) return 'gabel';
        for (let i = 0; i < anzahl; i++) {
          const sl = slots[i];
          const f = this.flaechen('L', 'finger', sl.c, sl.bug, BOX.L.bl, BOX.L.bw, n);
          if (!this.frei(f, n)) return 'gabel';
          lagen[rest[i]] = [r1(sl.c[0]), r1(sl.c[1]), grad(sl.bug)];
        }
        rest = rest.slice(anzahl);
        const ende = plus(plan4.ende, t, slots.at(-1).s + BOX.L.bw / 2 + 1.5);
        arme.push({ t, punkte: [plan4.ende, ende], w, seiten, fingerSeite: seiten === 'links' ? 1 : -1 });
      }
      // Laengsseitsplatz am Ende des zweiten Arms, auf der Seite ohne Finger
      const arm = arme[1];
      const stirnIds = this.reihen[5].D.stirn;
      const p = this.hafen.plaetze.find((q) => q.id === stirnIds[0]);
      const verl = p.laenge + 4;
      const armEnde = plus(arm.punkte[1], arm.t, verl);
      arm.punkte[1] = armEnde;
      const st = this.stirnAn([plus(armEnde, arm.t, -verl), armEnde], -arm.fingerSeite, stirnIds, armBreite, 1.5);
      if (arm.seiten === 'beide' || !this.stirnFrei(st, n)) return 'gabel';
      for (const [id, s] of Object.entries(st.plaetze)) lagen[id] = [r1(s.c[0]), r1(s.c[1]), grad(s.bug)];
      for (const a of arme) if (!this.linieFrei([plus(a.punkte[0], a.t, 3), a.punkte[1]], armBreite, n)) return 'gabel';
      const stamm = plan4.stamm.map(([x, y]) => [r1(x), r1(y)]);
      ergebnis[5] = {
        linien: [
          { steg: 'D', bauart: 'schwimmsteg', breite: STEG.D.breite, punkte: stamm },
          ...arme.map((a) => ({ steg: 'D', bauart: 'schwimmsteg', breite: armBreite, punkte: a.punkte.map(([x, y]) => [r1(x), r1(y)]) })),
        ],
        lagen,
      };
      this.merkmale.gabel = [gabel.w, gabel.w2, teilung, 0, 0];
    }

    // Eintragen und den Steg allein pruefen (ohne Einfahrt, die kommt am Ende fuer alles)
    for (const n of stufenMit) {
      this.eintragen(steg, n, ergebnis[n].linien, ergebnis[n].lagen);
      if (ergebnis[n].cs) this.eintragen('CS', n, ergebnis[n].cs.linien, ergebnis[n].cs.lagen);
    }
    const geprueft = istC ? ['C', 'CS'] : [steg];
    const fehler = pruefeStegbild(this.hafen, { stege: geprueft, stufen: stufenMit, einfahrt: false });
    this.merkmale[steg] = { x: wx, kurs: kurs0, knicke: segs.map((g) => g.knick ?? 0), seiten: segs.map((g) => g.seiten), kopf: kopfF, haken: hakenSeite };
    if (fehler.length) return { fehler };
    return null;
  }
}

/** Eine Variante zu einem Startwert. Liefert { hafen, merkmale } oder { grund }. */
export function variante(seed, { protokoll = false } = {}) {
  let bau = new Bauplatz(seed);
  let teil = null;
  for (const steg of ['A', 'B', 'C', 'D']) {
    let ok = false, letzter = null;
    for (let versuch = 0; versuch < 40; versuch++) {
      const sicher = kopie({ hafen: bau.hafen });
      const hind = bau.hindernisse;
      const sichHind = Object.fromEntries(Object.entries(hind).map(([k, v]) => [k, { polys: [...v.polys], gassen: [...v.gassen] }]));
      const r = bau.baueSteg(steg);
      if (r === null) { ok = true; break; }
      letzter = r;
      if (typeof r !== 'string') teil = bau.hafen;
      if (process.env.STEG_DEBUG) console.log(steg, typeof r === "string" ? r : zusammenfassen(r.fehler, 3));
      bau.hafen = sicher.hafen;
      bau.hindernisse = sichHind;
    }
    if (!ok) {
      if (protokoll) console.log(`Startwert ${seed}: Steg ${steg} passt nicht`, typeof letzter === 'string' ? letzter : zusammenfassen(letzter.fehler, 5));
      return { grund: `Steg ${steg}`, teil };
    }
  }
  return { hafen: bau.hafen, merkmale: bau.merkmale };
}

// ------------------------------------------------------------------ Daten fuer das Spiel

/** Aus einem fertigen Arbeitsstand die Daten fuer web/js/data/stegbilder.js ziehen. */
export function alsDaten(hafen, nr, seed, merkmale) {
  const stufen = {};
  const grund = Object.fromEntries(HAFEN.plaetze.map((p) => [p.id, p]));
  const zuFlach = [];
  for (const n of STUFEN) {
    const st = hafen.stufen[String(n)];
    const lage = {}, tiefen = {};
    for (const p of hafen.plaetze) {
      if (!VARIIERT.includes(p.steg) || !p.lage[String(n)]) continue;
      lage[p.id] = p.lage[String(n)];
      const t = tiefeFuer(p, n, lage[p.id], grund);
      tiefen[p.id] = t.tiefe;
      if (t.zuFlach) zuFlach.push(`${p.id} Stufe ${n}`);
    }
    stufen[String(n)] = { stege: st.stege.filter((l) => VARIIERT.includes(l.steg)), lage, tiefe: tiefen };
  }
  return { nr, seed, merkmale: kurzMerkmale(merkmale), stufen, zuFlach };
}

// Tiefe: kleinster Wert auf der Mittellinie im Gelaende des Spiels, begrenzt auf den Bereich der Plaetze
// gleicher Klasse am selben Steg im Grundbild (Balancing bleibt gleich). Die Zeichnung des Grundbilds
// rechnet Tiefen etwas anders als das Gelaende; tests/landschaft.test.mjs erlaubt deshalb 0,4 m.
// zuFlach: mehr als 0,35 m flacher als der flachste gleiche Platz im Grundbild, dann wird verworfen.
function tiefeFuer(p, n, [x, y, r], grund) {
  const u = dirV(90 - r);
  const vals = [-0.35, 0, 0.35].map((f) => tiefe(x + u[0] * p.laenge * f, y + u[1] * p.laenge * f, n));
  const t = Math.floor(Math.min(...vals) * 10) / 10;
  const gleiche = Object.values(grund).filter((q) => q.steg === p.steg && q.klasse === p.klasse && q.tiefe[String(n)] !== undefined).map((q) => q.tiefe[String(n)]);
  const lo = Math.min(...gleiche), hi = Math.max(...gleiche);
  return { tiefe: r1(Math.max(lo, Math.min(hi, t))), zuFlach: t < lo - 0.35 };
}

function kurzMerkmale(m) {
  const o = {};
  for (const [k, v] of Object.entries(m ?? {})) {
    if (Array.isArray(v)) { o[k] = v.map((x) => r1(x)); continue; }
    o[k] = { x: r1(v.x), kurs: r1(v.kurs), knicke: v.knicke, seiten: v.seiten.map((s) => s[0]) };
  }
  return o;
}

/** Abstand zweier Varianten (wie verschieden sehen sie von oben aus?). */
function abstand(a, b) {
  let d = 0;
  for (const s of ['A', 'B', 'C', 'D']) {
    const x = a.merkmale[s], y = b.merkmale[s];
    if (!x || !y) continue;
    d += Math.abs(x.x - y.x) / 8 + Math.abs(x.kurs - y.kurs) / 8;
    const kx = x.knicke.join(','), ky = y.knicke.join(',');
    if (kx !== ky) d += 1.5;
    if (x.seiten.join('') !== y.seiten.join('')) d += 0.7;
  }
  const g = a.merkmale.gabel, h = b.merkmale.gabel;
  if (g && h) d += Math.abs(g[0] - h[0]) / 10 + Math.abs(g[1] - h[1]) / 10 + Math.abs(g[2] - h[2]) / 2 + (g[3] !== h[3]) + (g[4] !== h[4]);
  return d;
}

export const KOPF = `// Hafenmeister: Stegbilder, also Varianten von Steg A, B, C (mit Stichsteg CS) und D.
// ERZEUGT von tools/stegbilder/erzeugen.mjs, nicht von Hand aendern. Beschreibung: docs/stegbilder.md
//
// Jede Variante hat dieselben Liegeplaetze wie das Grundbild in web/js/data/harbor.js (gleiche ids,
// Klassen, Platzarten und Stufen), nur Lage und Steglinien sind anders. Jede Variante hat alle
// Pruefungen aus tools/stegbilder/pruefen.mjs bestanden (keine Ueberlappung, Gasse vor jeder Box
// mindestens 1,5 Bootslaengen, genug Wassertiefe, jede Box von der Einfahrt erreichbar).
//   varianten[i].stufen[n].stege  Steglinien der variierten Stege in Stufe n (Form wie harbor.js)
//   varianten[i].stufen[n].lage   { id: [x, y, richtung] } wie harbor.js
//   varianten[i].stufen[n].tiefe  { id: Meter }
// Hoehere Stufen als 5 uebernehmen die Stege aus Stufe 5.
`;

function alsModul(daten) {
  return `${KOPF}\nexport const STEGBILDER = ${JSON.stringify(daten)};\n\nexport default STEGBILDER;\n`;
}

export function erzeugeAlle({ protokoll = false } = {}) {
  const gut = [];
  for (let seed = 1; seed <= KANDIDATEN; seed++) {
    const v = variante(seed, { protokoll });
    if (!v.hafen) continue;
    const fehler = pruefeStegbild(v.hafen, { stege: VARIIERT, stufen: STUFEN });
    if (fehler.length) {
      if (protokoll) console.log(`Startwert ${seed}: Endpruefung`, zusammenfassen(fehler, 4));
      continue;
    }
    const probe = alsDaten(v.hafen, 0, seed, v.merkmale);
    if (probe.zuFlach.length) {
      if (protokoll) console.log(`Startwert ${seed}: zu flach`, probe.zuFlach.slice(0, 4).join(', '));
      continue;
    }
    gut.push({ seed, hafen: v.hafen, merkmale: v.merkmale });
    if (protokoll) console.log(`Startwert ${seed}: bestanden (${gut.length})`);
    if (gut.length >= ANZAHL * 3) break;
  }
  // die verschiedensten auswaehlen (weitester Punkt zuerst)
  const wahl = [];
  if (gut.length) wahl.push(gut[0]);
  while (wahl.length < Math.min(ANZAHL, gut.length)) {
    let best = null, bd = -1;
    for (const g of gut) {
      if (wahl.includes(g)) continue;
      const d = Math.min(...wahl.map((w) => abstand(w, g)));
      if (d > bd) { bd = d; best = g; }
    }
    wahl.push(best);
  }
  wahl.sort((a, b) => a.seed - b.seed);
  return {
    format: 1,
    grundbild: HAFEN.id,
    stege: VARIIERT,
    varianten: wahl.map((g, i) => { const d = alsDaten(g.hafen, i + 1, g.seed, g.merkmale); delete d.zuFlach; return d; }),
    kandidaten: gut.length,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const protokoll = process.argv.includes('--protokoll');
  const daten = erzeugeAlle({ protokoll });
  const text = alsModul(daten);
  if (process.argv.includes('--pruefen')) {
    const alt = fs.existsSync(ZIEL) ? fs.readFileSync(ZIEL, 'utf8') : '';
    if (alt !== text) { console.log('web/js/data/stegbilder.js ist veraltet. Neu erzeugen mit: node tools/stegbilder/erzeugen.mjs'); process.exit(1); }
    console.log('web/js/data/stegbilder.js ist aktuell.');
  } else {
    fs.writeFileSync(ZIEL, text);
    console.log(`web/js/data/stegbilder.js geschrieben: ${daten.varianten.length} Varianten aus ${daten.kandidaten} bestandenen Kandidaten.`);
  }
}
