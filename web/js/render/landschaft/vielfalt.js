// Abwechslung an Land: Wälder, Felder mit Knicks, Wiesen, Heide, Steilufer, ein Dorf, Hügel und Sölle.
// Reine Rechenfunktionen ohne Three.js, damit Spiellogik und Tests sie nutzen können.
//
// Die Grundform (Uferlinien, Strand, Fahrwasser, Hafenflächen) kommt aus gelaende.js.
// Dieses Modul ändert nur das Land dahinter: Art des Bodens und, mit Abstand zum Ufer und zum
// Hafen, die Höhe. Befahrbares Wasser, Strand, Wege und Bauflächen bleiben unverändert.
//
// Jedes Spiel hat ein eigenes "Landbild" (Nummer, aus dem Seed des Spielstands, zum Testen ?landbild=N).
// Nummer 0 ist das Grundbild für Tests. Das aktive Bild setzt die Landschaft mit setzeBild(nr).
// Unabhängig davon wählt die Grundform (formen.js, ?gelaende=N) Küste und Inseln.
//
// Planeinheiten wie in gelaende.js: 1 Einheit = 0,62 m, py zeigt nach Norden.

import { SERVICES } from '../../data/services.js';
import { anlagenFlaechen } from '../../data/anlagen-flaechen.js';
import { gelaendeform } from './formen.js';
// Nur innerhalb von Funktionen benutzt (gelaende.js importiert diese Datei, die Bindung ist dann schon gesetzt)
import { BEREICH } from './gelaende.js';

const PLAN_M = 0.62;

// ------------------------------------------------------------------ Zufall und Rauschen (eigene Kopie, damit kein Import-Kreis entsteht)

function hash2(ix, iy, seed) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function rauschen(x, y, seed) {
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

/** Reproduzierbarer Zufall 0..1 (mulberry32). */
export function zufallAus(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ------------------------------------------------------------------ Geländebild je Spiel

/** Feldfrüchte und ihr Anteil. Nordsee: mehr Weide (Marsch), Ostsee: Raps und Korn. */
const FRUECHTE = ['raps', 'korn', 'acker', 'weide', 'wiese'];

/** Mögliche Lagen des Dorfes im Hinterland (Planeinheiten), jede mit Abstand zum Hafen. */
// Das Dorf liegt direkt hinter dem Hafen, gleich südlich der Landstraße (y -88), damit man es
// in der Startansicht sieht. Nur die Ost-West-Lage wechselt; der Nordrand bleibt bei y -100,
// also hinter allen Bauflächen (karte.bauflaechen enden bei y -92).
const DORF_X = [-150, -60, 30, -200, 90];
const DORF_NORDRAND = -100;
const dorfLage = (x, radius) => ({ px: x, py: DORF_NORDRAND - radius });

/** Art der Küste links (Westen) und rechts (Osten) des Hafens, dort wo Land an die offene See grenzt. */
const KUESTEN = ['kliff', 'wald', 'heide', 'feld'];

/**
 * Baut die Merkmale eines Geländebilds aus seiner Nummer. Gleiche Nummer, gleiches Bild.
 * Nummer 0 ist fest gewählt (Grundbild für Tests und Vorschauen).
 */
export function bildAus(nr = 0) {
  nr = Math.abs(Math.round(Number(nr) || 0)) >>> 0;
  if (nr === 0) {
    return {
      nr: 0, seed: 101,
      kueste: { west: 'kliff', ost: 'wald' },
      kliffHoehe: 7.5,
      dorf: dorfLage(DORF_X[0], 58), dorfRadius: 58,
      feld: { dreh: 0, breite: 30, laenge: 46, mix: [0.26, 0.28, 0.14, 0.2, 0.12] },
      wald: { skala: 85, schwelle: 0.6, kiefer: 0.45 },
      huegel: { hoehe: 3.5, skala: 120 },
      soelle: 3, hoefe: 3,
      knickAnteil: 0.6,
    };
  }
  const r = zufallAus(nr * 2654435761 + 17);
  const wahl = (liste) => liste[Math.floor(r() * liste.length) % liste.length];
  const west = wahl(KUESTEN);
  let ost = wahl(KUESTEN);
  if (ost === west && r() < 0.6) ost = wahl(KUESTEN);
  const mix = FRUECHTE.map(() => 0.3 + r());
  const summe = mix.reduce((a, b) => a + b, 0);
  const b = {
    nr,
    seed: 200 + Math.floor(r() * 50000),
    kueste: { west, ost },
    kliffHoehe: 6 + r() * 4,
    dorfX: wahl(DORF_X),
    dorfRadius: 50 + r() * 18,
    // Felder achsparallel: schräge Kanten gäben im Geländeraster Treppen
    feld: { dreh: r() < 0.5 ? 0 : Math.PI / 2, breite: 24 + r() * 16, laenge: 36 + r() * 26, mix: mix.map((m) => m / summe) },
    wald: { skala: 65 + r() * 50, schwelle: 0.54 + r() * 0.1, kiefer: 0.2 + r() * 0.6 },
    huegel: { hoehe: 1.5 + r() * 3.5, skala: 90 + r() * 70 },
    soelle: Math.floor(r() * 5),
    hoefe: 2 + Math.floor(r() * 3),
    knickAnteil: 0.4 + r() * 0.4,
  };
  b.dorf = dorfLage(b.dorfX, b.dorfRadius);
  return b;
}

let bild = bildAus(0);
let version = 0;

/** Aktives Geländebild setzen (Nummer, z. B. aus dem Seed des Spielstands). Gibt die Merkmale zurück. */
export function setzeBild(nr) {
  const neu = bildAus(nr);
  if (neu.nr !== bild.nr) { bild = neu; version++; }
  return bild;
}

/** Merkmale des aktiven Geländebilds. */
export function aktuellesBild() { return bild; }

/** Zählt bei jedem Bildwechsel hoch; Zwischenspeicher anderer Module vergleichen damit. */
export function bildVersion() { return version; }

/** Geländebild-Nummer aus einem Spielstand-Seed (gleich verteilt, nie 0). */
export function bildAusSeed(seed) {
  const s = Number(seed);
  if (!Number.isFinite(s)) return 1;
  return ((Math.imul(s >>> 0, 2246822519) ^ 0x9e3779b9) >>> 0) % 999983 + 1;
}

// ------------------------------------------------------------------ Freizuhaltende Flächen

// Quellen der freizuhaltenden Flächen. Services und Anlagenflächen sind reine Daten und werden direkt gelesen,
// weitere Quellen (z. B. die Bauflächen aus karte.js) meldet index.js mit setzeFreiQuellen an.
let zusatzPolygone = () => [];
const _frei = new Map();   // stufe -> Fächer

/**
 * Weitere Flächen, die eben und frei bleiben (Planeinheiten): polygone(stufe) -> [[[px, py], ...]].
 * Services (radius + 4 m) und data/anlagen-flaechen.js sind immer dabei.
 */
export function setzeFreiQuellen({ polygone } = {}) {
  if (typeof polygone === 'function') zusatzPolygone = polygone;
  _frei.clear();
  version++;
}

/** Freiflächen aus den Services: um jeden Bauplatz ein Kreis mit radius + 4 m (radius in Metern). */
export function freiKreiseAusServices(services = SERVICES) {
  const out = [];
  for (const sv of services) {
    const lagen = [sv.lage, ...(sv.stufen || []).map((st) => st.lage)].filter(Boolean);
    for (const l of lagen) out.push({ px: l.x, py: l.y, r: ((sv.radius || 8) + 4) / PLAN_M });
  }
  return out;
}

const FACH = 32, FREI_WEIT = 60;
function faecherFuer(stufe) {
  stufe = Math.max(1, Math.min(6, Math.round(stufe || 1)));
  const form = gelaendeform();
  const schluessel = `${stufe}-${form?.nr ?? 1}`;
  if (_frei.has(schluessel)) return _frei.get(schluessel);
  const faecher = new Map();
  const add = (x0, x1, y0, y1, eintrag) => {
    for (let i = Math.floor((x0 - FREI_WEIT) / FACH); i <= Math.floor((x1 + FREI_WEIT) / FACH); i++) {
      for (let j = Math.floor((y0 - FREI_WEIT) / FACH); j <= Math.floor((y1 + FREI_WEIT) / FACH); j++) {
        const k = i * 100003 + j;
        if (!faecher.has(k)) faecher.set(k, []);
        faecher.get(k).push(eintrag);
      }
    }
  };
  for (const k of freiKreiseAusServices()) add(k.px - k.r, k.px + k.r, k.py - k.r, k.py + k.r, k);
  let polys = [];
  try { polys = (anlagenFlaechen(stufe) || []).map((f) => f.poly); } catch { /* Anlagen noch nicht da */ }
  try { polys = polys.concat(zusatzPolygone(stufe) || []); } catch { /* egal */ }
  for (const p of polys) {
    if (!Array.isArray(p) || p.length < 3) continue;
    const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]);
    add(Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys), { p });
  }
  // Leuchttürme der Geländeform: rundherum frei, keine Bäume am Turm
  for (const [x, y] of form?.leuchttuerme || []) add(x - 12, x + 12, y - 12, y + 12, { px: x, py: y, r: 12 });
  _frei.set(schluessel, faecher);
  return faecher;
}

function inPoly(px, py, poly) {
  let innen = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) innen = !innen;
  }
  return innen;
}

function polyAbstand(px, py, poly) {
  let d = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[j], [bx, by] = poly[i];
    const dx = bx - ax, dy = by - ay;
    const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    d = Math.min(d, Math.hypot(px - ax - t * dx, py - ay - t * dy));
  }
  return inPoly(px, py, poly) ? -d : d;
}

/**
 * Abstand zur nächsten freizuhaltenden Fläche in Planeinheiten (negativ = innen).
 * Weiter als 60 Einheiten von allen Flächen weg: Unendlich.
 */
export function freiAbstand(px, py, stufe = 1) {
  const liste = faecherFuer(stufe).get(Math.floor(px / FACH) * 100003 + Math.floor(py / FACH));
  if (!liste) return Infinity;
  let d = Infinity;
  for (const e of liste) d = Math.min(d, e.p ? polyAbstand(px, py, e.p) : Math.hypot(px - e.px, py - e.py) - e.r);
  return d;
}

// ------------------------------------------------------------------ Felder

function feldKoord(px, py) {
  const f = bild.feld, c = Math.cos(f.dreh), s = Math.sin(f.dreh);
  return { a: px * c + py * s, b: -px * s + py * c };
}

/** Versatz und Feldlänge einer Reihe (Planeinheiten). Feldgrenzen liegen bei a = spalte * laenge - versatz. */
export function feldZeile(zeile) {
  const f = bild.feld;
  return { versatz: hash2(zeile, 3, bild.seed) * f.laenge, laenge: f.laenge * (0.75 + 0.5 * hash2(zeile, 5, bild.seed)) };
}

/**
 * Feld an einem Punkt: Zeile, Spalte, Frucht und wie weit der Punkt vom Feldrand weg ist.
 * Felder sind lange Schläge in Reihen, jede Reihe gegen die nächste versetzt, wie in der Holsteinischen Schweiz.
 */
export function feldBei(px, py) {
  const f = bild.feld;
  const { a, b } = feldKoord(px, py);
  const zeile = Math.floor(b / f.breite);
  const { versatz, laenge } = feldZeile(zeile);
  const spalte = Math.floor((a + versatz) / laenge);
  const u = (a + versatz) / laenge - spalte, v = b / f.breite - zeile;
  const randA = Math.min(u, 1 - u) * laenge, randB = Math.min(v, 1 - v) * f.breite;
  const w = hash2(spalte, zeile, bild.seed + 3);
  let frucht = FRUECHTE[FRUECHTE.length - 1];
  for (let i = 0, s = 0; i < FRUECHTE.length; i++) { s += f.mix[i]; if (w < s) { frucht = FRUECHTE[i]; break; } }
  return { zeile, spalte, frucht, rand: Math.min(randA, randB), randA, randB, laenge };
}

/** Ob an der Feldgrenze ein Knick (Wallhecke) steht: je Grenze fest, Anteil aus dem Bild. */
export function knickAn(zeile, spalte, quer) {
  return hash2(zeile * 2 + (quer ? 1 : 0), spalte, bild.seed + 9) < bild.knickAnteil;
}

/** Feldwege laufen an manchen Reihengrenzen entlang. */
function feldwegBei(px, py) {
  const f = bild.feld;
  const { b } = feldKoord(px, py);
  const zeile = Math.round(b / f.breite);
  if (hash2(zeile, 11, bild.seed) > 0.34) return false;
  return Math.abs(b - zeile * f.breite) < 1.6;
}

// ------------------------------------------------------------------ Einzelne Zonen

function waldWert(px, py) {
  const w = bild.wald;
  return fbm(px / w.skala + 3.1, py / w.skala - 1.7, bild.seed + 41);
}

/** Liegt hier Wald? (Rauschen wie in land(); draußen im groben Netz nur noch für Bäume, nicht als Bodenfarbe) */
export function waldBei(px, py, nordsee = false) {
  return waldWert(px, py) > (nordsee ? bild.wald.schwelle + 0.12 : bild.wald.schwelle);
}

/** Sölle: kleine runde Teiche in den Feldern (Toteislöcher), feste Lagen je Bild. */
export function soelle() {
  const r = zufallAus(bild.seed + 5);
  const out = [];
  for (let i = 0; i < bild.soelle * 3 && out.length < bild.soelle; i++) {
    const px = -400 + r() * 820, py = -190 + r() * 80;
    const radius = 5 + r() * 6;
    out.push({ px, py, r: radius });
  }
  return out;
}

let _soelle = null, _soelleV = -1;
function soelleCache() {
  if (_soelleV !== version) { _soelle = soelle(); _soelleV = version; }
  return _soelle;
}

/** Im Dorf werden Hügel halbiert, damit Häuser gerade stehen. */
function dorfHoehe(h, dd) {
  return h;
}

const AUSSEN_FRUCHT = { raps: 'wiese', acker: 'weide', korn: 'wiese' };

/** Fein gerechneter Bereich (wie BEREICH in gelaende.js). 0 innen, 1 ab 40 Einheiten außerhalb. */
const FEIN = { x0: -420, x1: 430, y0: -200 };
function aussenAnteil(px, py) {
  const d = Math.max(FEIN.x0 - px, px - FEIN.x1, FEIN.y0 - py);
  return smooth(-10, 10, d);
}

/** Seite des Hafens: Westen links, Osten rechts der Einfahrt. */
const seite = (px) => (px < 20 ? 'west' : 'ost');

// ------------------------------------------------------------------ Dorf und Höfe

/** Die Landstraße hinter dem Hafen (wie wegePlan in gelaende.js), für den Anschluss des Dorfes. */
const LANDSTRASSE = [[-330, -88], [340, -88]];

function naechsterPunktAufStrecke(px, py, [[ax, ay], [bx, by]]) {
  const dx = bx - ax, dy = by - ay;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1);
  return [ax + t * dx, ay + t * dy];
}

function abstandStrecke(px, py, a, b) {
  const [qx, qy] = naechsterPunktAufStrecke(px, py, [a, b]);
  return Math.hypot(px - qx, py - qy);
}

/**
 * Wo das Dorf in dieser Landschaft wirklich liegt: an der Wunschstelle des Geländebilds, wenn dort Land ist,
 * sonst an der nächsten Stelle hinter dem Hafen mit genug festem Boden (Fluss, Bodden, Sund und Lagune
 * gehen vor). Findet sich keine, gibt es kein Dorf (weit weg), nur Höfe.
 */
let _ort = null, _ortK = 0, _ortV = -1, _ortF = null;
function dorfOrt() {
  const f = gelaendeform();
  if (_ortV === version && _ortF === f) return _ort;
  _ortV = version; _ortF = f; _ortK++;
  const R = bild.dorfRadius;
  const L = f.natur?.landig;
  const fest = (x, y) => !L || (L(x, y) > R * 0.6 + 12 && [0, 1, 2, 3, 4, 5, 6, 7].every((i) => L(x + R * Math.cos(i * Math.PI / 4), y + R * Math.sin(i * Math.PI / 4)) > 6));
  const wunsch = bild.dorf.px;
  const xs = [wunsch, ...DORF_X.filter((x) => x !== wunsch).sort((a, b) => Math.abs(a - wunsch) - Math.abs(b - wunsch))];
  _ort = { px: 1e6, py: 1e6, nordrand: DORF_NORDRAND };
  suche: for (const extra of [0, 50, 110]) {
    for (const x of xs) {
      const y = DORF_NORDRAND - extra - R;
      if (fest(x, y)) { _ort = { px: x, py: y, nordrand: DORF_NORDRAND - extra }; break suche; }
    }
  }
  return _ort;
}

let _dorf = null, _dorfV = -1;
/**
 * Plan des Dorfes: Dorfstraße zur Landstraße, Kirche am Anger, Häuser beidseits der Straße.
 * Alles in Planeinheiten; dreh in Bogenmaß (0 = Giebel zeigt nach Norden).
 * Ob ein Haus wirklich steht (Land, nicht auf Wegen), prüft bewuchs.js mit dem fertigen Gelände.
 */
export function dorfPlan() {
  const ort = dorfOrt();
  if (_dorfV === _ortK) return _dorf;
  const r = zufallAus(bild.seed + 77);
  const { px: cx, py: cy } = ort;
  const R = bild.dorfRadius;
  // Dorfstraße: von der Landstraße durch die Mitte des Dorfes hindurch
  const [qx, qy] = naechsterPunktAufStrecke(cx, cy, LANDSTRASSE);
  let dx = cx - qx, dy = cy - qy;
  let len = Math.hypot(dx, dy);
  if (len < 1) { dx = 0; dy = -1; len = 1; }
  dx /= len; dy /= len;
  const start = [qx, qy];
  const ende = [cx + dx * R * 0.95, cy + dy * R * 0.95];
  // Querstraße durch die Mitte
  const quer = [[cx - dy * R * 0.8, cy + dx * R * 0.8], [cx + dy * R * 0.8, cy - dx * R * 0.8]];
  const strassen = [[start, ende], quer];
  const winkel = Math.atan2(dx, dy);   // Richtung der Dorfstraße
  const haeuser = [];
  const arten = ['reet', 'reet', 'backstein', 'weiss', 'backstein', 'weiss'];
  // Häuser entlang beider Straßen, mit Abstand und etwas Unordnung
  for (const [[ax, ay], [bx, by]] of strassen) {
    const l = Math.hypot(bx - ax, by - ay);
    const ex = (bx - ax) / l, ey = (by - ay) / l;
    for (let t = 8; t < l - 4; t += 11 + r() * 4) {
      const mx = ax + ex * t, my = ay + ey * t;
      if (Math.hypot(mx - cx, my - cy) > R * 0.95) continue;
      for (const s of [-1, 1]) {
        if (r() < 0.12) continue;
        const ab = 10 + r() * 3;
        haeuser.push({
          px: mx - ey * ab * s, py: my + ex * ab * s,
          dreh: Math.atan2(ex, ey) + (r() < 0.5 ? 0 : Math.PI / 2) + (r() - 0.5) * 0.15,
          breite: 9 + r() * 3, laenge: 14 + r() * 6, art: arten[Math.floor(r() * arten.length)],
        });
      }
    }
  }
  // Kirche am Anger, etwas neben der Kreuzung
  // Kirche und Mühle stehen vorn an der Landstraße, damit man sie vom Hafen aus sieht
  // (Startansicht am PC reicht bis etwa y -110). Kirche geostet: lange Achse Ost-West, Turm im Westen.
  const seiteK = r() < 0.5 ? -1 : 1;
  const kirche = { px: cx + seiteK * 20, py: ort.nordrand - 9, dreh: Math.PI / 2 };
  const muehle = { px: cx - seiteK * R * 0.72, py: ort.nordrand - 10 };
  _dorf = { mitte: [cx, cy], radius: R, strassen, haeuser, kirche, muehle };
  _dorfV = _ortK;
  return _dorf;
}

let _hoefe = null, _hoefeV = -1;
/** Einzelhöfe in den Feldern: Wohnhaus, Scheune, ein paar Bäume. Planeinheiten. */
export function hoefe() {
  const ort = dorfOrt();
  if (_hoefeV === _ortK) return _hoefe;
  const r = zufallAus(bild.seed + 91);
  const L = gelaendeform().natur?.landig;
  const out = [];
  for (let i = 0; i < 60 && out.length < bild.hoefe; i++) {
    const px = -400 + r() * 800, py = -195 + r() * 90;
    if (Math.hypot(px - ort.px, py - ort.py) < bild.dorfRadius + 40) continue;
    if (L && L(px, py) < 24) continue;   // nicht am Wasser (Fluss, Bodden, Sund)
    if (out.some((h) => Math.hypot(h.px - px, h.py - py) < 90)) continue;
    if (abstandStrecke(px, py, ...LANDSTRASSE) < 14) continue;
    out.push({ px, py, dreh: bild.feld.dreh + (r() < 0.5 ? 0 : Math.PI / 2), art: r() < 0.5 ? 'reet' : 'backstein' });
  }
  _hoefe = out;
  _hoefeV = _ortK;
  return out;
}

// ------------------------------------------------------------------ Haken für gelaende.js

/**
 * Festland: Bodenart und Höhe abwandeln. Wird von gelaende.js für jeden Landpunkt aufgerufen.
 * @param {number} px Planeinheiten
 * @param {number} py
 * @param {number} h Höhe aus der Grundform (m)
 * @param {string} typ Bodenart aus der Grundform
 * @param {number} d Abstand zum Ufer in Planeinheiten (Ersatz, falls kontext.uferAbstandM fehlt)
 * @param {{ stufe?: number, region?: object, uferAbstandM?: number, hafenAbstand?: number, offeneSee?: boolean }} k
 * @returns {{ h: number, typ: string }}
 */
export function land(px, py, h, typ, d, k = {}) {
  // Strand, Wege, Pflaster, Felsen, Deich bleiben, wie die Grundform sie setzt
  if (typ !== 'gras') return { h, typ };
  const g = k.region?.gelaende || {};
  // Der Abstand zur offenen See kann kleiner sein als der Uferabstand der Grundform (Ecken der Karte)
  const uferM = Math.min(k.uferAbstandM ?? d * PLAN_M, k.seeAbstandM ?? Infinity);
  const hafen = k.hafenAbstand ?? 999;               // Planeinheiten außerhalb der Hafenfläche
  const frei = freiAbstand(px, py, k.stufe);
  if (hafen < 8 || frei < 4) return { h, typ };
  // 0 am Hafen, an Bauplätzen und direkt hinter dem Strand, 1 im freien Land
  const weg = smooth(8, 34, hafen) * smooth(4, 22, frei);
  const innen = weg * smooth(6, 24, uferM);
  if (innen <= 0.01) return { h, typ };

  const nordsee = !!g.deich;
  let art = 'feld';

  // Inseln (Grundform): keine Felder, kein Dorf, nur Heide, Gras und ein paar Kiefern
  if (k.insel) {
    const w = fbm(px / 40 + 2, py / 40, bild.seed + 71);
    return { h, typ: w > 0.62 && !nordsee ? 'waldboden' : w < 0.42 ? 'heide' : 'gras' };
  }

  // ---- Hügel (Endmoräne): sanft, nur im freien Land
  if (!nordsee) {
    const hu = bild.huegel;
    const n = fbm(px / hu.skala + 11, py / hu.skala + 5, bild.seed + 23);
    h += hu.hoehe * innen * Math.max(0, n - 0.32) * 1.6;
  }

  // ---- Steilufer: nur an der offenen See, mindestens 40 m vom Hafen und der Einfahrt.
  // Alles hängt stetig vom Abstand zur offenen See ab, damit nirgends eine Stufe im Land entsteht:
  // an der See eine steile Kante, zum Binnensee hin ein sanfter Hang, landeinwärts flacht es ab.
  const kSeite = bild.kueste[seite(px)];
  const hafenM = hafen * PLAN_M;
  const seeM = k.seeAbstandM ?? (k.offeneSee ? uferM : uferM + 300);
  if (!nordsee && kSeite === 'kliff' && seeM < 200 && !k.formSteilufer && !k.form?.steilufer) {
    const s = smooth(40, 75, hafenM) * smooth(10, 30, frei) * (1 - smooth(50, 110, seeM - uferM));
    if (s > 0) {
      const fuss = 9;                                  // m: Strand vor der Kante
      const breite = 10 + 30 * smooth(0, 15, seeM - uferM);
      const kante = smooth(fuss, fuss + breite, uferM);
      h += bild.kliffHoehe * s * kante * (1 - 0.7 * smooth(60, 160, seeM)) * (1 - smooth(150, 200, seeM));
      // Die Abbruchkante nur im fein gerechneten Bereich färben, im groben Netz gäbe sie breite braune Flecken
      if (s > 0.35 && breite < 15 && uferM > fuss - 0.5 && uferM < fuss + breite + 0.5) return { h, typ: aussenAnteil(px, py) > 0 ? 'gras' : 'kliff' };
      // Oben an der Kante ein Streifen Gras ohne Bäume, damit man die Abbruchkante sieht
      if (s > 0.35 && breite < 15 && uferM < fuss + breite + 7) return { h, typ: 'gras' };
    }
  }

  // ---- Küstenstreifen nach Art der Seite
  if (seeM < 70 && kSeite === 'heide' && !nordsee) art = 'heide';
  if (seeM < 60 && kSeite === 'wald') art = 'wald';
  if (seeM < 45 && kSeite === 'kliff') art = 'wald';   // Buchenwald auf der Kliffkante

  // ---- Dorf und Höfe (ebener Boden, Dorfstraßen als Weg)
  const ort = dorfOrt();
  const dd = Math.hypot(px - ort.px, py - ort.py);
  if (dd < bild.dorfRadius + 14) {
    const plan = dorfPlan();
    for (const [a, b] of plan.strassen) {
      if (abstandStrecke(px, py, a, b) < 2.6 && (dd < bild.dorfRadius || abstandStrecke(px, py, ...LANDSTRASSE) < 60)) return { h: dorfHoehe(h, dd), typ: 'feldweg' };
    }
    if (dd < bild.dorfRadius) return { h: dorfHoehe(h, dd), typ: 'dorf' };
  }
  for (const hof of hoefe()) {
    if (Math.hypot(px - hof.px, py - hof.py) < 13) return { h, typ: 'dorf' };
  }

  // ---- Wald (Flecken nach Rauschen)
  if (art === 'feld') {
    const w = waldWert(px, py);
    const schwelle = nordsee ? bild.wald.schwelle + 0.12 : bild.wald.schwelle;
    if (w > schwelle) art = 'wald';
  }

  // ---- Sölle in den Feldern
  if (art === 'feld') {
    for (const s of soelleCache()) {
      const ds = Math.hypot(px - s.px, py - s.py);
      if (ds < s.r + 4) {
        if (ds < s.r) return { h: Math.min(h, -0.4 - (1 - ds / s.r) * 0.8), typ: 'wasser' };
        return { h: Math.min(h, 0.25), typ: 'schilfrand' };
      }
    }
  }

  // Außerhalb des fein gerechneten Bereichs (FEIN = KERN in gelaende.js) ist das Netz grob.
  // Dort nur zwei Grüntöne mit wenigen Prozent Unterschied (gras, wiese), kein Wald-, Acker- oder
  // Kornboden: jeder Kontrast zeigt sonst die Rasterquadrate. Wald bleibt als Bäume (bewuchs.js, waldBei).
  const aussenD = Math.max(FEIN.x0 - px, px - FEIN.x1, FEIN.y0 - py);
  if (aussenD > 0 && (art === 'feld' || art === 'wald' || art === 'heide')) {
    // Im Rand mit halber Auflösung (BEREICH) laufen die achsparallelen Felder ohne Wege weiter und
    // dünnen Feld für Feld zur Außenkante hin aus, in ruhigen Farben (kein Raps, Korn, Acker).
    const randD = Math.min(px - BEREICH.x0, BEREICH.x1 - px, py - BEREICH.y0);
    if (art === 'feld' && randD > 0) {
      const f = feldBei(px, py);
      if (hash2(f.spalte, f.zeile, bild.seed + 13) < randD / (randD + aussenD) * 1.2 - 0.2) return { h, typ: AUSSEN_FRUCHT[f.frucht] || f.frucht };
    }
    const w = fbm(px / 220 + 4, py / 220 - 2, bild.seed + 29);
    return { h, typ: w > 0.52 ? 'wiese' : 'gras' };
  }
  if (art === 'feld') {
    if (feldwegBei(px, py)) return { h, typ: 'feldweg' };
    const f = feldBei(px, py);
    const frucht = nordsee && (f.frucht === 'raps' || f.frucht === 'acker') ? 'weide' : f.frucht;
    return { h, typ: frucht };
  }
  if (art === 'wald') return { h, typ: 'waldboden' };
  if (art === 'dorf') return { h, typ: 'dorf' };
  if (art === 'heide') return { h, typ: 'heide' };
  return { h, typ };
}

/**
 * Nehrung: nur die Bodenart, die Höhe bleibt bei der Grundform.
 * Auf der Binnenseite wachsen Kiefern, an manchen Stellen Heide.
 */
export function nehrung(px, py, h, typ, k = {}) {
  if (typ !== 'duenengras') return typ;
  const g = k.region?.gelaende || {};
  if (g.deich) return typ;                             // Nordsee: offene Dünen ohne Wald
  const hafen = k.hafenAbstand ?? 999;
  if (hafen < 20 || freiAbstand(px, py, k.stufe) < 6 || Math.abs(px - 178) < 55) return typ;   // nicht am Engpass
  if (px > -285 && px < -180) return typ;   // Badestrand mit Seebrücke und Strandkörben (Stufe 6) bleibt offen
  const w = fbm(px / 60 + 7, py / 30, bild.seed + 61);
  if (w > 0.6) return 'waldboden';
  if (w < 0.36) return 'heide';
  return typ;
}

// ------------------------------------------------------------------ Farben

/** Jahreszeitliche Farben der Felder und Wiesen. Fehlt ein Eintrag, gilt die Grundfarbe. */
export const JAHRESZEIT_FARBEN = {
  fruehling: { raps: '#f3df5a', korn: '#b8dc92', acker: '#c9ad8a', wiese: '#c8e6a4', heide: '#bfb6aa' },
  sommer: { raps: '#b9cf86', korn: '#ecd38a', acker: '#d4bd96', wiese: '#cfe0a0', heide: '#c7a9c8' },
  herbst: { raps: '#c7b48e', korn: '#d9c69c', acker: '#bc9c7c', weide: '#b6cf94', wiese: '#c4cf98', waldboden: '#a9b98a', heide: '#b49a8e' },
  winter: { raps: '#cbbfa6', korn: '#d2c4a8', acker: '#b6a08a', weide: '#bccaa8', wiese: '#c4ceb0', waldboden: '#9fb49a', heide: '#b4a6a4', dorf: '#c8d6bc' },
};

/** Farbe einer Bodenart für die Jahreszeit (sRGB-Hex), Grundfarbe aus regionen.js. */
export function bodenFarbe(typ, farben, jahreszeit = null) {
  return (jahreszeit && JAHRESZEIT_FARBEN[jahreszeit]?.[typ]) || farben[typ] || null;
}

/** Bodenarten, deren Farbe mit der Jahreszeit wechselt. */
export const JAHRESZEIT_TYPEN = new Set(Object.values(JAHRESZEIT_FARBEN).flatMap((o) => Object.keys(o)));
