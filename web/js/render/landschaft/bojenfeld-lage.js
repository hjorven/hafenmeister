// Bojenfeld (Roadmap P36, F10): wo die Muringbojen im See liegen. Beschreibung: docs/bojenfeld.md.
//
// bojenfeldLage(region) sucht je Küste, Seed und Stegbild einen Block aus Bojen in einem Raster
// (ECONOMY.bojenfeld.abstand Planeinheiten), der in allen Stufen ab abStufe passt:
// - tief genug für das größte erlaubte Boot im ganzen Schwoikreis (auch bei Niedrigwasser),
// - weit genug weg von Stegen, Liegeplätzen, Diensten, Molen und dem Schwimmwellenbrecher aller Stufen,
// - nicht im Korridor von den Stegen zum Seegatt (natur().route) und nicht in der Runde der Freizeitboote,
// - nicht auf den Wartebojen, im Ankerfeld oder am Uferstreifen des Paddlers der Stufe 2,
// - südlich der Nehrung (nie im Außenhafen oder an der Großschiffspier).
// Ein Block mit möglichst wenig Abstand zu den Stegen gewinnt. Die ersten Bojen (Ausbau 1) liegen auf
// der Seite des Blocks, die den Stegen am nächsten ist.
//
// Ergebnis: [[px, py], ...] in Planeinheiten (Länge ECONOMY.bojenfeld.bojen gesamt) oder [] ohne Platz.
// data/bojenfeld.js legt daraus die Liegeplätze BF01 ... an (Lage über bojenfeldQuelle).

import { punkt, warteplaetze, molen, pricken, PLAN_M, SCHWIMMWELLENBRECHER } from './gelaende.js';
import { gelaendeform, beiFormwechsel } from './formen.js';
import { region as regionNach } from './regionen.js';
import { SEE_RUNDE, UFER } from '../../data/verkehr.js';
import { HAFEN } from '../../data/harbor.js';
import { ECONOMY } from '../../data/economy.js';
import { bojenfeldQuelle, BOJENFELD } from '../../data/bojenfeld.js';

const R = ECONOMY.bojenfeld ?? null;
const STUFEN = [2, 3, 4, 5, 6];
const _cache = new Map();
beiFormwechsel(() => _cache.clear());

function abstandStrecke(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
function abstandLinie(px, py, punkte) {
  let d = Infinity;
  for (let i = 1; i < punkte.length; i++) d = Math.min(d, abstandStrecke(px, py, punkte[i - 1], punkte[i]));
  if (punkte.length === 1) d = Math.hypot(px - punkte[0][0], py - punkte[0][1]);
  return d;
}

/** Regeln, die je Planpunkt gelten (für Tests und Werkzeuge offen gelegt). */
export function hindernisse(region, lockern = {}) {
  const P = { ...R, ...lockern };
  const reg = typeof region === 'string' ? regionNach(region) : (region ?? regionNach('ostsee'));
  const ab = P.abStufe ?? 2;
  const stufen = STUFEN.filter((s) => s >= ab);
  const linien = [];      // { punkte, rand }
  for (const s of stufen) {
    const st = HAFEN.stufen[String(s)];
    for (const l of st?.stege ?? []) linien.push({ punkte: l.punkte, rand: (l.breite ?? 3) / 2 + P.stegAbstand });
    for (const d of st?.dienste ?? []) linien.push({ punkte: [[d.x, d.y]], rand: Math.max(d.laenge ?? 0, d.breite ?? 0) / 2 + P.stegAbstand });
    if (s >= 3) for (const m of molen(s)) linien.push({ punkte: m.punkte, rand: m.breite / 2 + P.stegAbstand });
  }
  // Schwimmwellenbrecher (ab Stufe 4, render/buildings.js): dort legt niemand an, darum reicht der
  // Schwoikreis plus 2 m (das Boot an der Boje stößt nie dagegen)
  if (stufen.some((s) => s >= SCHWIMMWELLENBRECHER.ab)) linien.push({ punkte: SCHWIMMWELLENBRECHER.punkte, rand: SCHWIMMWELLENBRECHER.breite / 2 + (P.schwoikreisM + 2) / PLAN_M });
  const gesehen = new Set();
  for (const p of HAFEN.plaetze) {
    if (p.art === 'boje') continue;
    for (const s of stufen) {
      const l = p.lage?.[String(s)];
      if (!l) continue;
      // Liegeplatz als Strecke entlang des Boots (Länge laenge), Rand halbe Breite plus Abstand
      const w = (l[2] * Math.PI) / 180, hl = (p.laenge ?? 10) / 2;
      const ux = Math.cos(w) * hl, uy = Math.sin(w) * hl;
      const key = `${l[0]}|${l[1]}|${l[2]}|${p.laenge}`;
      if (gesehen.has(key)) continue;
      gesehen.add(key);
      linien.push({ punkte: [[l[0] - ux, l[1] - uy], [l[0] + ux, l[1] + uy]], rand: (p.breite ?? 5) / 2 + P.platzAbstand });
    }
  }
  // Korridor von der Stegfront zur Durchfahrt (wie warteplaetze): Mitte vor den Stegen bis natur.route
  const route = gelaendeform().natur?.route;
  const front = [];
  for (const s of stufen) {
    const pts = (HAFEN.stufen[String(s)]?.stege ?? []).flatMap((l) => l.punkte).filter(([, y]) => y < 190);
    if (!pts.length) continue;
    const xs = pts.map(([x]) => x), ys = pts.map(([, y]) => y);
    front.push([(Math.min(...xs) + Math.max(...xs)) / 2, Math.max(...ys) + 8]);
  }
  const korridore = [];
  const rp = route?.punkte ?? [[40, 140], [150, 172], [178, 200]];
  korridore.push({ punkte: rp, rand: (route?.halb ?? 24) + P.korridorAbstand });
  for (const f of front) korridore.push({ punkte: [f, rp[0]], rand: (route?.halb ?? 24) + P.korridorAbstand });
  // Stufe 2: Wartebojen, Ankerfeld, Pricken der Rinne, Uferstreifen des Paddlers, Runde der Freizeitboote
  const kreise = [];
  if (ab <= 2) {
    const w = warteplaetze(2, reg);
    for (const b of w.bojen) kreise.push([b.px, b.py, 30]);
    for (const a of w.ankerbereiche) kreise.push([a.px, a.py, a.radius + 20]);
    for (const [x, y] of pricken(2)) kreise.push([x, y, 20]);
    const u = UFER[2];
    if (u) korridore.push({ punkte: [[u.x0 - 10, u.y], [u.x1 + 10, u.y]], rand: 18 });
  }
  // Ab Stufe 3 laufen die Boote von See durch die Einfahrt bei x 178 (Durchstich oder Molen) ein
  kreise.push([178, 215, 70]);
  const runden = ab <= 2 && SEE_RUNDE[2] ? [SEE_RUNDE[2]] : [];
  return { reg, stufen, linien, korridore, kreise, runden, P };
}

/** Nordsee (P57): Regeln für Trockenfallplätze (ECONOMY.nordsee.trockenfallen) oder null. */
export function trockenfallen(reg) {
  return reg?.id === 'nordsee' && reg?.gelaende?.gezeiten ? ECONOMY.nordsee?.trockenfallen ?? null : null;
}

function punktOk(px, py, h) {
  if (py > h.P.nordGrenze || py < -20) return false;
  for (const l of h.linien) {
    const b = l.bb ??= (() => { const xs = l.punkte.map(([x]) => x), ys = l.punkte.map(([, y]) => y); return [Math.min(...xs) - l.rand, Math.max(...xs) + l.rand, Math.min(...ys) - l.rand, Math.max(...ys) + l.rand]; })();
    if (px < b[0] || px > b[1] || py < b[2] || py > b[3]) continue;
    if (abstandLinie(px, py, l.punkte) < l.rand) return false;
  }
  for (const k of h.korridore) if (abstandLinie(px, py, k.punkte) < k.rand) return false;
  for (const [x, y, r] of h.kreise) if (Math.hypot(px - x, py - y) < r) return false;
  for (const sr of h.runden) {
    const dx = Math.max(sr.cx - sr.rx - px, 0, px - sr.cx - sr.rx), dy = Math.max(sr.cy - sr.ry - py, 0, py - sr.cy - sr.ry);
    if (Math.hypot(dx, dy) < 16) return false;
  }
  // tief genug im ganzen Schwoikreis, bei Niedrigwasser: Mitte in jeder Stufe, Kreis (8 Punkte) in der
  // ersten Stufe, beim Durchstich (3) und im Seehafen (6). Später kommt nur Land dazu (Molen, Kai) oder es
  // wird gebaggert; beides zeigen diese Stufen.
  // Nordsee (P57): Trockenfallplätze auf einer Plate im Watt. Das Feld braucht nur Wasser (suche), die Plate
  // auf Höhe platte legt render/trockenfallen.js darunter.
  const tf = trockenfallen(h.reg);
  const ebbe = h.reg?.gelaende?.gezeiten || 0;
  const soll = h.P.tiefe + h.P.tiefeReserve + ebbe;
  const passt = (t) => t >= (tf ? tf.suche : soll);
  for (const s of h.stufen) if (!passt(-punkt(px, py, s, h.reg).h)) return false;
  const r = (tf ? tf.kreisM ?? h.P.schwoikreisM : h.P.schwoikreisM) / PLAN_M;
  for (const s of h.stufen.filter((x) => x === h.stufen[0] || x === 3 || x === 6)) {
    for (let k = 0; k < 8; k++) {
      const w = (k / 8) * Math.PI * 2;
      if (!passt(-punkt(px + r * Math.cos(w), py + r * Math.sin(w), s, h.reg).h)) return false;
    }
  }
  return true;
}

// Bester Block aus n Bojen im Raster a (Planeinheiten), dessen Mitte ziel am nächsten liegt und der von
// den schon gesetzten Bojen (schon) mindestens a und höchstens 2 a Abstand hält. pruefe(i, j, schritt) -> Punkt erlaubt?
function block(n, a, ziel, schon, pruefe) {
  const formen = [];
  for (let sp = 1; sp <= n; sp++) if (n % sp === 0 && sp <= 3 * (n / sp) && n / sp <= 3 * sp) formen.push([sp, n / sp]);
  const schritt = a / 4;
  const nord = R.nordGrenze ?? 205;
  // Alle Lagen nach Abstand der Mitte zum Ziel, die erste, die passt, gewinnt (prüft nur Punkte nahe am Ziel)
  const kand = [];
  for (const [sp, ze] of formen) {
    for (let j0 = Math.ceil(-20 / schritt); j0 * schritt + (ze - 1) * a <= nord; j0++) {
      for (let i0 = Math.ceil(-320 / schritt); i0 * schritt + (sp - 1) * a <= 300; i0++) {
        const cx = i0 * schritt + (sp - 1) * a / 2, cy = j0 * schritt + (ze - 1) * a / 2;
        kand.push([Math.hypot(cx - ziel[0], cy - ziel[1]), sp, ze, i0, j0]);
      }
    }
  }
  kand.sort((p, q) => p[0] - q[0]);
  for (const [, sp, ze, i0, j0] of kand) {
    const pkte = [];
    let alle = true;
    for (let r = 0; alle && r < ze; r++) for (let c = 0; alle && c < sp; c++) {
      const px = i0 * schritt + c * a, py = j0 * schritt + r * a;
      alle = schon.every(([x, y]) => Math.hypot(x - px, y - py) >= a - 0.01) && pruefe(i0 + c * 4, j0 + r * 4, schritt);
      pkte.push([px, py]);
    }
    // ein Feld: der neue Abschnitt schließt an den vorigen an (höchstens zwei Abstände Lücke)
    if (alle && schon.length && !pkte.some(([px, py]) => schon.some(([x, y]) => Math.hypot(x - px, y - py) <= 2 * a + 0.01))) continue;
    if (alle) return pkte;
  }
  return null;
}

/**
 * Lage aller Bojen in Planeinheiten: [[px, py], ...] in der Reihenfolge der Bauabschnitte; [] ohne Platz.
 * Jeder Abschnitt ist ein kleiner Block im Raster. Der erste liegt so nah wie möglich an den Stegen der
 * Stufe abStufe, jeder weitere so nah wie möglich am vorigen (zusammen ein Feld, wo der See es hergibt).
 * Findet ein späterer Abschnitt keinen Platz, endet das Feld dort (die Liste ist dann kürzer).
 * @param {object|string} [region] Eintrag aus regionen.js oder id (ohne: Ostsee)
 */
export function bojenfeldLage(region) {
  if (!R) return [];
  const reg = typeof region === 'string' ? regionNach(region) : (region ?? regionNach('ostsee'));
  const f = gelaendeform();
  const key = `${f.nr}|${f.seed}|${reg?.id ?? reg?.name ?? ''}|${HAFEN.stegbild?.nr ?? 0}`;
  if (_cache.has(key)) return _cache.get(key);
  // Mitte der Stege der ersten Stufe mit Bojenfeld (dort schaut die Kamera hin)
  const stegPkte = (HAFEN.stufen[String(R.abStufe ?? 2)]?.stege ?? []).flatMap((l) => l.punkte);
  const mx = stegPkte.reduce((s, [x]) => s + x, 0) / (stegPkte.length || 1);
  const my = stegPkte.reduce((s, [, y]) => s + y, 0) / (stegPkte.length || 1);
  // Erst mit allen Abständen, sonst Stufe für Stufe lockerer (R.lockern): lieber knapper als gar kein Feld
  let out = [];
  for (const lockern of [{}, ...(R.lockern ?? [])]) {
    const h = hindernisse(reg, lockern);
    const gepr = new Map();
    const pruefe = (i, j, schritt) => {
      const k = `${schritt}|${i}|${j}`;
      if (!gepr.has(k)) gepr.set(k, punktOk(i * schritt, j * schritt, h));
      return gepr.get(k);
    };
    const neu = [];
    let ziel = [mx, my];
    for (const n of BOJENFELD.abschnitte) {
      let pkte = null;
      for (const a of h.P.abstaende ?? [h.P.abstand ?? 22]) {
        pkte = block(n, a, ziel, neu, pruefe);
        if (pkte) break;
      }
      if (!pkte) break;
      // innerhalb des Abschnitts: die stegnahen Bojen zuerst
      pkte.sort((p, q) => Math.hypot(p[0] - mx, p[1] - my) - Math.hypot(q[0] - mx, q[1] - my));
      neu.push(...pkte);
      ziel = [pkte.reduce((s, [x]) => s + x, 0) / pkte.length, pkte.reduce((s, [, y]) => s + y, 0) / pkte.length];
    }
    if (neu.length > out.length) out = neu;
    if (out.length >= BOJENFELD.anzahl) break;
  }
  _cache.set(key, out);
  return out;
}

/** Lage in Weltmetern: [{ id, px, py, x, z }] für die Bojen bis zur Anzahl n. */
export function bojenfeldWelt(region, n = Infinity) {
  return bojenfeldLage(region).slice(0, n).map(([px, py], i) => ({ id: BOJENFELD.ids[i], px, py, x: px * PLAN_M, z: -py * PLAN_M }));
}

// Lage für die Liegeplätze BF01 ... (data/bojenfeld.js): Region aus dem Spiel, sonst Ostsee
let aktRegion = null;
export function bojenfeldRegion(region) { aktRegion = region ?? null; }
bojenfeldQuelle(() => bojenfeldLage(aktRegion ?? undefined));
