// Jugendtraining im Bild (Paket P39, docs/jugendtraining.md).
//
// Am Trainingstag liegt das Trainerboot (Festrumpf-Schlauchboot) in der Box, die der Spieler ihm gegeben hat:
// Es kommt dafür vom Slip und legt dort an. Zur Beginnzeit rollen die Kinder ihre Optimisten (ab der
// Segelschule auch Jollen) nacheinander über den Slip ins Wasser, das Trainerboot legt ab und holt sie ab,
// dann segelt die Gruppe in einer Reihe aus dem Hafen. Draußen segeln sie einen Dreieckskurs um drei gelbe
// Bojen (gegen den Wind kreuzen sie), das Trainerboot bleibt in der Mitte. Danach geht es in einer Reihe
// zurück und über den Slip an Land, das Trainerboot legt wieder in seiner Box an. Abends fährt es zum Slip
// und wird aus dem Wasser geholt. Beim Zurückkommen gehen Eltern zum Segelclub.
//
// Freies Fahrwasser: Solange die Gruppe zwischen Slip und Trainingsrevier unterwegs ist, fahren wartende
// Boote nicht von selbst ein (game.sim.holdBoat). Ziehen von Hand geht weiter, die Boote weichen der Gruppe
// aus (jede Jolle ist für den Verkehr ein Hindernis, game.boatAnim.hindernis). Steht ein fahrendes Boot vor
// der Spitze, wartet die Gruppe kurz.
//
// Liest game.jugendtraining.heute() (features/jugendtraining.js) und meldet auslaufen() und zurueck(). Alle
// Wege über die Fahrwasserkarte (game.fahrwasser.weg), nie über Land. Alle Zeiten in Spielzeit.
// Zum Prüfen: game.jugendBild = { aktiv, zustand(), boote(), trainer(), revier(), strecke() }.
import * as THREE from 'three';
import { addBoat, berthFromPlatz } from './boat-anim.js';
import { HAFEN } from '../data/harbor.js';
import { FARBE, mat } from './services-models.js';
import { JT, TRAINER_ID } from '../features/jugendtraining.js';
import { availableBerths } from '../sim.js';

const TEMPO = { opti: 2.6, jolle: 3.0, slip: 0.9, max: 4.5 };   // m/s auf dem Wasser, am Slip (Wagen schieben), höchstens
const ABSTAND = { opti: 7, jolle: 9 };               // Abstand in der Reihe (Bugspitze zu Bugspitze, Meter)
const KURS_R = 22;            // Radius des Dreieckskurses um die Mitte des Reviers (Meter)
const RUNDEN = 1;             // so viele Runden um die Bojen
const TRAINER_SEITE = 6;      // so weit seitlich der Reihe fährt das Trainerboot
const WARTEN_MAX = 15;        // so lange wartet die Spitze höchstens vor einem fahrenden Boot (Sekunden)
const SAMMELN_MAX = 30;       // so lange wartet die Gruppe vor dem Slip höchstens auf das Trainerboot (Sekunden)
const RUECK_BIS = 0.82;       // Tagesanteil, bis zu dem alle wieder am Slip sein sollen (danach eilen sie)
const VORLAUF = 45;           // so viele Sekunden vor der Beginnzeit legt das Trainerboot ab und fährt zum Slip

// ------------------------------------------------------------------ Modelle
function segelFlaeche(punkte, farbe) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(punkte.flat(), 3));
  const idx = [];
  for (let i = 1; i < punkte.length - 1; i++) idx.push(0, i, i + 1);
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: farbe, side: THREE.DoubleSide, flatShading: true }));
}

/** Optimist: kastenförmiger Rumpf 2,3 m, Mast weit vorn, Sprietsegel. Bug nach +x, Wasserlinie y = 0. */
function optiModell(nr) {
  const g = new THREE.Group();
  const huelle = new THREE.Group();
  g.add(huelle);
  const rumpf = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.38, 1.1), mat(FARBE.white));
  rumpf.position.y = 0.08;
  huelle.add(rumpf);
  const bug = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.95), mat(FARBE.white));
  bug.position.set(1.18, 0.14, 0);
  huelle.add(bug);
  const innen = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.02, 0.85), mat(FARBE.wood));
  innen.position.y = 0.28;
  huelle.add(innen);
  // Kind mit Schwimmweste
  const kind = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.55, 0.3), mat([FARBE.orange, FARBE.red, FARBE.yellow][nr % 3]));
  kind.position.set(-0.6, 0.55, 0);
  huelle.add(kind);
  const kopf = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), mat(FARBE.creme));
  kopf.position.set(-0.6, 0.93, 0);
  huelle.add(kopf);
  // Mast und Segel an einem Drehpunkt (Baum schwenkt mit dem Wind)
  const mast = new THREE.Group();
  mast.position.set(0.75, 0.25, 0);
  huelle.add(mast);
  const stange = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.9, 5), mat(FARBE.white));
  stange.position.y = 1.45;
  mast.add(stange);
  const farbe = nr % 4 === 1 ? FARBE.red : FARBE.sail;
  mast.add(segelFlaeche([[0, 0.35, 0], [0, 2.8, 0], [-2.0, 3.1, 0], [-2.2, 0.4, 0]], farbe));
  g.userData.teile = { huelle, mast };
  g.userData.pick = { type: 'jugend', id: `opti-${nr}` };
  g.name = `jugend-opti-${nr}`;
  return g;
}

/** Jolle (Zweimannjolle wie ein 420er): 4,2 m, Großsegel und Fock, zwei Kinder. */
function jollenModell(nr) {
  const g = new THREE.Group();
  const huelle = new THREE.Group();
  g.add(huelle);
  const s = new THREE.Shape();
  const L = 4.2, B = 1.6;
  s.moveTo(-L / 2, -B / 2);
  s.lineTo(L * 0.1, -B / 2);
  s.quadraticCurveTo(L * 0.42, -B * 0.42, L / 2, 0);
  s.quadraticCurveTo(L * 0.42, B * 0.42, L * 0.1, B / 2);
  s.lineTo(-L / 2, B / 2);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.42, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  const rumpf = new THREE.Mesh(geo, mat([FARBE.white, FARBE.navy, FARBE.white][nr % 3]));
  rumpf.position.y = -0.12;
  huelle.add(rumpf);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.02, 1.1), mat(FARBE.pont));
  deck.position.set(-0.6, 0.31, 0);
  huelle.add(deck);
  for (const [x, z, c] of [[-1.3, 0.45, FARBE.red], [-0.5, 0.5, FARBE.orange]]) {
    const k = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.55, 0.3), mat(c));
    k.position.set(x, 0.55, z);
    huelle.add(k);
  }
  const mast = new THREE.Group();
  mast.position.set(0.55, 0.3, 0);
  huelle.add(mast);
  const stange = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 5.6, 5), mat(FARBE.steel));
  stange.position.y = 2.8;
  mast.add(stange);
  mast.add(segelFlaeche([[0, 0.5, 0], [0, 5.4, 0], [-2.2, 0.55, 0]], FARBE.sail));
  const fock = new THREE.Group();
  fock.position.set(1.95, 0.3, 0);
  huelle.add(fock);
  fock.add(segelFlaeche([[0, 0.1, 0], [-1.35, 3.9, 0], [-1.25, 0.35, 0]], FARBE.sail));
  g.userData.teile = { huelle, mast, fock };
  g.userData.pick = { type: 'jugend', id: `jolle-${nr}` };
  g.name = `jugend-jolle-${nr}`;
  return g;
}

/** Gelbe Kursboje */
function bojeModell() {
  const g = new THREE.Group();
  // aufblasbare Regattaboje (Zylinder), gut zu sehen
  const k = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 1.8, 10), mat(FARBE.yellow));
  k.position.y = 0.6;
  g.add(k);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.77, 0.77, 0.25, 10), mat(FARBE.white));
  band.position.y = 1.1;
  g.add(band);
  g.name = 'jugend-boje';
  return g;
}

// ------------------------------------------------------------------ Strecke (Polylinie mit Länge)
function strecke(punkte) {
  const p = punkte.filter((q, i) => i === 0 || Math.hypot(q.x - punkte[i - 1].x, q.z - punkte[i - 1].z) > 0.05);
  const s = [0];
  for (let i = 1; i < p.length; i++) s.push(s[i - 1] + Math.hypot(p[i].x - p[i - 1].x, p[i].z - p[i - 1].z));
  return { p, s, laenge: s[s.length - 1] ?? 0 };
}
function aufStrecke(st, d) {
  const { p, s } = st;
  if (!p.length) return null;
  if (d <= 0) {
    const b = p[1] ?? p[0];
    return { x: p[0].x, z: p[0].z, y: p[0].y ?? 0, kurs: Math.atan2(-(b.z - p[0].z), b.x - p[0].x), i: 0 };
  }
  let lo = 0, hi = s.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (s[m] <= d) lo = m; else hi = m; }
  const a = p[lo], b = p[hi] ?? a;
  const seg = (s[hi] ?? 0) - s[lo];
  const k = seg > 0 ? Math.min(1, (d - s[lo]) / seg) : 0;
  return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, y: (a.y ?? 0) + ((b.y ?? 0) - (a.y ?? 0)) * k, kurs: Math.atan2(-(b.z - a.z), b.x - a.x), i: lo };
}
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function initJugendBild(game) {
  if (!game.scene || !game.boatAnim) return;
  const jt = () => game.jugendtraining;
  const stufe = () => game.state?.stage ?? 1;
  const gruppe = new THREE.Group();
  gruppe.name = 'jugendtraining';
  game.scene.add(gruppe);

  const frei = (x, z, r, t) => {
    const f = game.fahrwasser?.befahrbar;
    return typeof f === 'function' ? f(x, z, r, t) : true;
  };
  const wegVon = (a, b, breite = 3) => {
    try { return game.fahrwasser?.weg?.(a, b, { breiteM: breite, tiefgangM: 0.6 }); } catch { return null; }
  };

  // ---------------------------------------------------------------- Slip
  function rampeSuchen() {
    const anlage = game.services?.gruppe?.getObjectByName?.('service-slip');
    if (!anlage) return null;
    anlage.updateMatrixWorld(true);
    const p = anlage.getWorldPosition(new THREE.Vector3());
    const ry = anlage.rotation.y;
    const dx = -Math.sin(ry), dz = -Math.cos(ry);
    const tief = (x, z) => game.landscape?.tiefeBei?.(x, z) ?? -(game.landschaft?.hoeheBei?.(x, z) ?? 1);
    let oben = null, unten = null;
    for (let d = 0; d <= 70; d += 0.5) {
      const x = p.x + dx * d, z = p.z + dz * d;
      const t = tief(x, z);
      if (oben == null && t > -0.2) oben = { x: p.x + dx * Math.max(0, d - 3), z: p.z + dz * Math.max(0, d - 3) };
      if (t > 1.1 && frei(x, z, 1.5, 0.4)) { unten = { x, z }; break; }
    }
    if (!oben || !unten) return null;
    // Sammelpunkt vor dem Slip: freies Wasser ein Stück hinaus
    let sammel = null;
    for (const d of [14, 10, 18, 7, 24]) {
      const q = { x: unten.x + dx * d, z: unten.z + dz * d };
      if (frei(q.x, q.z, 3, 0.6)) { sammel = q; break; }
    }
    sammel ??= unten;
    // Dort wartet das Trainerboot: neben dem Sammelpunkt, nicht im Weg der Boote vom Slip
    let warte = sammel;
    for (const d of [10, -10, 14, -14, 7, -7]) {
      const q = { x: sammel.x - dz * d, z: sammel.z + dx * d };
      if (frei(q.x, q.z, 3.5, 0.6)) { warte = q; break; }
    }
    return { oben, unten, sammel, warte, dx, dz };
  }

  // ---------------------------------------------------------------- Trainingsrevier draußen
  function abstandZuStrecke(p, a, b) {
    const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2));
    return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t);
  }
  /** Liegeplätze der aktuellen Stufe in Weltmetern (für den Abstand des Kurses zu den Stegen). */
  function stegPunkte() {
    const out = [];
    let liste = [];
    try { liste = availableBerths(game.sim.state, game.sim.ctx); } catch { liste = []; }
    for (const b of liste) {
      const p = game.stege?.platz?.(b.id);
      if (p?.x != null) out.push({ x: p.x, z: p.z });
    }
    return out;
  }
  /**
   * Trainingsrevier: freies Wasser vor den Stegen auf dem Weg zur Einfahrt, groß genug für den Kurs, weg von
   * Stegen, Wartebojen, Ankerfeld und dem Weg der Ankommenden von See. Gern etwas neben dem Weg (nicht
   * mitten im Fahrwasser) und rund 160 m vom Slip. Gibt es dort keinen Platz, dann draußen vor der Einfahrt.
   */
  function revierSuchen(von) {
    const k = game.fahrwasser?.karte;
    let zug = [];
    try { zug = (game.gelaende?.seezugaenge?.(stufe(), { tiefeM: 2 }) ?? []).filter((z) => !z.umweg && z.weg?.length >= 2); } catch { zug = []; }
    const w = game.landscape?.warteplaetze ?? {};
    const kreise = [...(w.bojen ?? []).map((o) => ({ x: o.x, z: o.z, r: 26 })), ...(w.ankerbereiche ?? []).map((o) => ({ x: o.x, z: o.z, r: (o.radiusM ?? 30) + 16 })),
      ...(game.landscape?.bojenfeld ?? []).map((o) => ({ x: o.x, z: o.z, r: 24 }))];   // Bojenfeld (P36)
    const wege = zug.map((z) => z.weg);
    const stege = stegPunkte();
    const R = KURS_R + 6;
    // Wege der Gäste im Hafen: von jedem Ende der Seezugänge zu einigen Liegeplätzen (verteilt über alle Stege).
    // Der Kurs liegt nicht darauf, sonst segeln die Optis den Einlaufenden vor den Bug.
    const innen = [];
    {
      const ziele = stege.filter((_, i) => i % Math.max(1, Math.floor(stege.length / 10)) === 0).slice(0, 12);
      const ends = zug.map((z) => z.weg[z.weg.length - 1]).filter((e, i, l) => l.findIndex((o) => Math.hypot(o.x - e.x, o.z - e.z) < 5) === i);
      for (const e of ends) for (const q of ziele) {
        const w = wegVon(e, q, 4);
        if (w?.ok && w.punkte?.length > 1) innen.push(w.punkte.map((pt) => ({ x: pt.x, z: pt.z })));
      }
    }
    wege.push(...innen);
    const kursFrei = (p) => {
      if (!frei(p.x, p.z, 6, 0.8)) return false;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        if (!frei(p.x + Math.cos(a) * KURS_R, p.z + Math.sin(a) * KURS_R, 4, 0.8)) return false;
      }
      return true;
    };
    const imKarte = (p) => !k || (p.x > k.x0 + R && p.x < k.x1 - R && p.z > k.z0 + R && p.z < k.z1 - R);
    const wegAbstand = (p) => {
      let nah = Infinity;
      for (const weg of wege) for (let j = 1; j < weg.length; j++) nah = Math.min(nah, abstandZuStrecke(p, weg[j - 1], weg[j]));
      return nah;
    };
    const passt = (p, abstandWeg = 12) => imKarte(p) && !kreise.some((o) => Math.hypot(o.x - p.x, o.z - p.z) < o.r + KURS_R)
      && !stege.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < KURS_R + 14) && wegAbstand(p) >= KURS_R + abstandWeg && kursFrei(p);
    // Enden der Seezugänge (vor der Einfahrt) und die Richtung zur See
    const proEnde = new Map();
    for (const z of zug) {
      const e = z.weg[z.weg.length - 1], s0 = z.weg[0];
      const l = Math.hypot(s0.x - e.x, s0.z - e.z) || 1;
      const key = `${Math.round(e.x)},${Math.round(e.z)}`;
      const m = proEnde.get(key) ?? { x: e.x, z: e.z, sx: 0, sz: 0 };
      m.sx += (s0.x - e.x) / l; m.sz += (s0.z - e.z) / l;
      proEnde.set(key, m);
    }
    const enden = [...proEnde.values()].map((m) => { const l = Math.hypot(m.sx, m.sz) || 1; return { ...m, sx: m.sx / l, sz: m.sz / l }; });
    // 1. Vor den Stegen, auf dem Weg vom Slip zur Einfahrt
    let best = null, bestWert = Infinity;
    if (von) {
      for (const e of enden.length ? enden : [{ x: von.x, z: von.z - 200 }]) {
        const weg = wegVon(von, e, 6);
        if (!weg?.ok || !weg.punkte?.length) continue;
        const st = strecke(weg.punkte.map((q) => ({ x: q.x, z: q.z })));
        for (let d = 50; d < st.laenge + 40; d += 10) {
          const q = aufStrecke(st, Math.min(d, st.laenge));
          const nx = -Math.sin(q.kurs), nz = -Math.cos(q.kurs);
          for (const quer of [0, 18, -18, 32, -32, 46, -46, 60, -60]) {
            const p = { x: q.x + nx * quer, z: q.z + nz * quer };
            if (!passt(p)) continue;
            const wert = Math.abs(d - 160) * 0.6 + Math.abs(Math.abs(quer) - 32) * 0.4 + (game.boatAnim.imBild?.(p.x, p.z, 2 * KURS_R) ? 0 : 40);
            if (wert < bestWert) { bestWert = wert; best = { ...p, weit: Math.round(d) }; }
          }
        }
      }
    }
    if (best) return { ...best, draussen: false };
    // 2. Draußen vor der Einfahrt
    for (const [kegel, abstand] of [[0.4, 24], [0.1, 16], [-1, 10]]) {
      for (const e of enden) {
        for (const ring of [45, 60, 75, 90, 110]) {
          for (let i = 0; i < 24; i++) {
            const a = (i / 24) * Math.PI * 2;
            const p = { x: e.x + Math.cos(a) * ring, z: e.z + Math.sin(a) * ring };
            if ((e.sx || e.sz) && Math.cos(a) * e.sx + Math.sin(a) * e.sz < kegel) continue;
            if (!passt(p, abstand)) continue;
            const wert = Math.abs(ring - 65) + (game.boatAnim.imBild?.(p.x, p.z, 2 * KURS_R) ? 0 : 30);
            if (wert < bestWert) { bestWert = wert; best = p; }
          }
        }
      }
      if (best) break;
    }
    if (best) return { ...best, draussen: true };
    // 3. Rückfall: das nächste freie Wasser zum Slip, nur Kurs frei
    if (k && von) {
      let p2 = null, w2 = -Infinity;
      for (let x = k.x0 + R; x < k.x1 - R; x += 12) {
        for (let z = k.z0 + R; z < k.z1 - R; z += 12) {
          const p = { x, z };
          if (!kursFrei(p) || stege.some((q) => Math.hypot(q.x - x, q.z - z) < KURS_R + 6)) continue;
          const wert = -Math.hypot(x - von.x, z - von.z);
          if (wert > w2) { w2 = wert; p2 = p; }
        }
      }
      if (p2) return { ...p2, draussen: false, notbehelf: true };
    }
    return null;
  }

  /** Dreieckskurs um die Mitte m: Luvboje gegen den Wind, kreuzen in Schlägen, dann raum und vor dem Wind. */
  function kursUm(m) {
    const von = ((game.boatAnim.wind?.fromDeg ?? 250) * Math.PI) / 180;
    const quelle = { x: Math.cos(von), z: -Math.sin(von) };
    const dreh = (v, a) => ({ x: v.x * Math.cos(a) - v.z * Math.sin(a), z: v.x * Math.sin(a) + v.z * Math.cos(a) });
    let r = KURS_R;
    let marken = null;
    for (; r >= 10; r -= 4) {
      const a = { x: m.x + quelle.x * r, z: m.z + quelle.z * r };
      const b = { x: m.x + dreh(quelle, (2 * Math.PI) / 3).x * r, z: m.z + dreh(quelle, (2 * Math.PI) / 3).z * r };
      const c = { x: m.x + dreh(quelle, -(2 * Math.PI) / 3).x * r, z: m.z + dreh(quelle, -(2 * Math.PI) / 3).z * r };
      if ([a, b, c].every((q) => frei(q.x, q.z, 3, 0.6))) { marken = { a, b, c }; break; }
    }
    if (!marken) return null;
    const { a, b, c } = marken;
    // Kreuzen von c nach a: Schläge 45 Grad zum Wind, abwechselnd links und rechts der Linie c-a
    const kreuz = [];
    const n = 4;
    const seit = dreh(quelle, Math.PI / 2);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const s = (i % 2 ? 1 : -1) * r * 0.32;
      kreuz.push({ x: c.x + (a.x - c.x) * t + seit.x * s, z: c.z + (a.z - c.z) * t + seit.z * s });
    }
    // Um die Bojen außen herum (ein Stück vorbei, nicht durch die Boje)
    const aussen = (q) => { const f = (r + 6) / r; return { x: m.x + (q.x - m.x) * f, z: m.z + (q.z - m.z) * f }; };
    const runde = [aussen(c), ...kreuz, aussen(a), aussen(b)];
    const punkte = [];
    for (let i = 0; i < RUNDEN; i++) punkte.push(...runde);
    punkte.push(aussen(c));
    return { marken, punkte, r };
  }

  // ---------------------------------------------------------------- Liegeplatz der Box
  function platzBerth(platzId) {
    const p = HAFEN.plaetze.find((q) => q.id === platzId);
    if (!p) return null;
    let b;
    try { b = berthFromPlatz(p, stufe(), HAFEN); } catch { return null; }
    const sp = game.stege?.platz?.(platzId);
    if (sp) {
      b.x = sp.x; b.z = sp.z;
      if (sp.richtung !== undefined) b.heading = (sp.richtung * Math.PI) / 180;
      if (sp.laenge) b.length = sp.laenge;
      if (sp.breite) b.width = sp.breite;
    }
    const bauart = p.art === 'kai' ? 'kai' : p.steg === 'D' ? 'schwimmsteg' : 'holz';
    const deck = game.stege?.deckHoehe?.(bauart);
    if (deck) b.deck = deck + 0.1;
    return b;
  }

  // ---------------------------------------------------------------- Trainerboot
  let trainer = null;   // { anim, platz, auftrag: 'box'|'sammeln'|'folgen'|'revier'|'zurueck'|'slip', ziel }
  function bauTrainer() {
    const t = JT?.trainerboot ?? {};
    const types = game.boatTypes?.s;
    let g = null;
    if (types?.buildBoat) {
      const entry = types.MODELS?.find?.((m) => m.id === (t.modell ?? 'S3-3'));
      try { g = entry ? types.buildBoat(entry, { palette: 0, id: TRAINER_ID }) : null; } catch { g = null; }
    }
    if (!g) {
      g = new THREE.Group();
      const m = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.6, 2), mat(FARBE.grey));
      m.position.y = 0.2;
      g.add(m);
      g.userData.boat = { size: 'S', length: 4.8, beam: 2, draft: 0.4, kind: 'motor' };
    }
    g.userData.pick = { type: 'jugend', id: 'trainer' };
    g.userData.bootName = 'Trainerboot';
    g.name = 'jugend-trainerboot';
    const anim = addBoat(game, g, { id: TRAINER_ID, animate: types?.animateBoat, sails: false });
    anim.emit = () => {};   // kein Gast: keine Ereignisse an die Spielregeln
    return anim;
  }
  function trainerWeg() {
    if (!trainer) return;
    trainer.anim.remove();
    trainer = null;
  }
  /** Trainerboot vom Slip in seine Box (morgens, sobald es eine hat). */
  function trainerInBox(platz, { sofort = false } = {}) {
    const b = platzBerth(platz);
    if (!b) return;
    if (!trainer) trainer = { anim: bauTrainer(), platz, auftrag: 'box' };
    trainer.platz = platz;
    trainer.auftrag = 'box';
    if (sofort || !rampe) { trainer.anim.moorAt(b); return; }
    if (!trainer.anim.moored && trainer.anim.state === 'idle' && Math.hypot(trainer.anim.x - rampe.unten.x, trainer.anim.z - rampe.unten.z) > 80) {
      trainer.anim.place(rampe.sammel.x, rampe.sammel.z, Math.atan2(-rampe.dz, rampe.dx));
    }
    trainer.anim.dock(b).catch?.(() => {});
  }
  function trainerZuPunkt(p, auftrag) {
    if (!trainer || !p) return;
    trainer.auftrag = auftrag;
    trainer.anim.sailTo([{ x: p.x, z: p.z }], { route: true, hold: true }).catch?.(() => {});
  }

  // ---------------------------------------------------------------- Gruppe
  let rampe = null;
  let revier = null;      // { x, z, draussen, kurs }
  let bojen = [];
  let lauf = null;        // { strecke, s, boote: [{ group, art, abstand, abmelden, sicht }], phase, warten, raus, rein, ende }
  let gehalten = new Set();

  function bojenZeigen(k) {
    for (const b of bojen) gruppe.remove(b);
    bojen = [];
    if (!k) return;
    for (const q of [k.marken.a, k.marken.b, k.marken.c]) {
      const b = bojeModell();
      b.position.set(q.x, 0, q.z);
      gruppe.add(b);
      bojen.push(b);
    }
  }

  /** Die ganze Fahrt: Slip hinunter, Sammeln, hinaus, Kurs, zurück, Slip hinauf. */
  function planeLauf(h) {
    rampe = rampeSuchen();
    if (!rampe) return null;
    revier = revierSuchen(rampe.sammel);
    if (!revier) return null;
    const kurs = kursUm(revier);
    if (!kurs) return null;
    revier.kurs = kurs;
    const start = kurs.punkte[0];
    const hin = wegVon(rampe.sammel, start);
    const ziel = kurs.punkte[kurs.punkte.length - 1];
    const her = wegVon(ziel, rampe.sammel);
    if (!hin?.ok || !her?.ok) return null;
    const pts = [];
    // An Land beginnt die Fahrt an der Slipkante (Wagen), y hebt das Boot auf dem Wagen
    pts.push({ ...rampe.oben, y: 0.55, slip: true });
    pts.push({ ...rampe.unten, y: 0, slip: true });
    const wasserAb = 1;
    pts.push(...hin.punkte.map((q) => ({ x: q.x, z: q.z })));
    const kursAb = pts.length;
    // Zwischenpunkte im Kurs: den Fahrweg zwischen den Bojen nicht prüfen (freies Wasser, geprüft beim Suchen)
    pts.push(...kurs.punkte.slice(1));
    const kursBis = pts.length;
    pts.push(...her.punkte.slice(1).map((q) => ({ x: q.x, z: q.z })));
    pts.push({ ...rampe.unten, y: 0, slip: true });
    pts.push({ ...rampe.oben, y: 0.55, slip: true });
    const st = strecke(pts);
    // Längen der Abschnitte
    const idxS = (i) => st.s[Math.min(i, st.s.length - 1)] ?? 0;
    const g = h.gruppe ?? { optis: 5, jollen: 0 };
    const boote = [];
    // Jollen zuerst (schneller), dann die Optis; Abstand je Art
    let versatz = 0;
    const liste = [...Array(g.jollen ?? 0).fill('jolle'), ...Array(g.optis ?? 0).fill('opti')];
    liste.forEach((art, i) => {
      const group = art === 'jolle' ? jollenModell(i) : optiModell(i);
      group.visible = false;
      gruppe.add(group);
      let abmelden = null;
      try { abmelden = game.boatAnim?.hindernis?.(group, art === 'jolle' ? { laenge: 4.2, breite: 1.6 } : { laenge: 2.3, breite: 1.1 }) ?? null; } catch { abmelden = null; }
      boote.push({ group, art, versatz, abmelden, kurs: 0, seite: ((i * 37) % 7 - 3) * 0.35 });
      versatz += ABSTAND[art];
    });
    return {
      strecke: st, s: 0, boote, laenge: versatz,
      wasser: idxS(wasserAb), kursAb: idxS(kursAb - 1), kursBis: idxS(kursBis - 1), slipEnde: st.laenge - (st.s[st.s.length - 1] - st.s[st.s.length - 2]),
      warten: 0, raus: false, rein: false, ende: false, zeit: 0,
      // Sammelpunkt: die Spitze ist ein Stück vom Slip draußen, alle Boote sind im Wasser
      sammelBis: idxS(wasserAb) + versatz + 12, gesammelt: false, sammelWarten: 0,
    };
  }

  function laufWeg() {
    if (!lauf) return;
    for (const b of lauf.boote) { b.abmelden?.(); gruppe.remove(b.group); }
    lauf = null;
    bojenZeigen(null);
    freigeben();
  }

  // Wartende Boote halten, solange die Gruppe im Fahrwasser ist
  function halten(an) {
    const api = game.sim;
    if (!api?.holdBoat || !api.waitingBoats) return;
    if (!an) { freigeben(); return; }
    for (const b of api.waitingBoats()) {
      if (b.held || gehalten.has(b.id)) continue;
      api.holdBoat(b.id, true);
      gehalten.add(b.id);
    }
  }
  // Wer für die Gruppe wartet, wartet geduldig: die Geduld an der Boje steht so lange still
  function geduldHalten(dt) {
    const st = game.sim?.state;
    if (!st || !gehalten.size || st.phase !== 'day') return;
    for (const id of gehalten) {
      const b = st.boats?.[id];
      if (b?.status === 'waiting' && b.atBuoy && b.atBuoySince != null) b.atBuoySince = Math.min(st.clock, b.atBuoySince + dt);
    }
  }
  function freigeben() {
    const api = game.sim;
    for (const id of gehalten) if (id !== api?.selected && api?.state?.boats?.[id]) api.holdBoat?.(id, false);
    gehalten = new Set();
  }

  /** Ist gerade ein Trailerboot der Slipanlage auf der Rampe oder direkt davor? (services-wirkung.js, Planeinheiten) */
  function trailerAmSlip() {
    let liste = [];
    try { liste = game.services?.wirkung?.trailer?.() ?? []; } catch { liste = []; }
    const U = 0.62;
    for (const t of liste) {
      if (!t.sichtbar) continue;
      const x = t.x * U, z = -t.y * U;
      if (abstandZuStrecke({ x, z }, rampe.oben, rampe.sammel) < 6) return true;
    }
    return false;
  }

  /** Steht ein fahrendes fremdes Boot vor der Spitze? */
  function blockiert(p, kurs, voraus = 14) {
    const vx = Math.cos(kurs), vz = -Math.sin(kurs);
    for (const o of game.boatAnim.boats) {
      if (trainer && o === trainer.anim) continue;
      if (o.moored || o.model?.visible === false || !(o.speed > 0.3)) continue;
      const dx = o.x - p.x, dz = o.z - p.z;
      const vor = dx * vx + dz * vz;
      const quer = Math.abs(-dx * vz + dz * vx);
      if (vor > -2 && vor < voraus + o.info.length / 2 && quer < 3 + o.info.beam) return true;
    }
    return false;
  }

  function segelStellen(b, kurs) {
    const t = b.group.userData.teile;
    if (!t) return;
    const von = ((game.boatAnim.wind?.fromDeg ?? 250) * Math.PI) / 180;
    const rel = wrap(von - kurs);
    const seite = rel >= 0 ? 1 : -1;
    const baum = Math.max(0.12, Math.min(1.4, (Math.abs(rel) - 0.6) * 0.62));
    const ziel = seite * baum;
    t.mast.rotation.y += (ziel - t.mast.rotation.y) * 0.08;
    if (t.fock) t.fock.rotation.y = t.mast.rotation.y * 0.8;
    const staerke = game.boatAnim.wind?.strength ?? 0.5;
    const kraengung = seite * (0.06 + 0.14 * staerke) * Math.min(1, Math.abs(Math.sin(rel)) * 1.4);
    t.huelle.rotation.x += (kraengung - t.huelle.rotation.x) * 0.05;
  }

  function laufTick(dt) {
    const h = jt()?.heute?.();
    const L = lauf;
    const st = L.strecke;
    const spitze = aufStrecke(st, L.s);
    // Tempo: am Slip langsam, im Kurs normal; abends oder wenn die Regeln schon "zurück" sagen: zügig heim
    const eilig = game.sim?.state?.phase !== 'day' || h?.phase === 'zurueck';
    let v = L.s < L.wasser ? TEMPO.slip : (L.boote[0]?.art === 'jolle' ? TEMPO.jolle : TEMPO.opti);
    // Rechtzeitig zurück: so zügig, dass die letzte Jolle bis RUECK_BIS des Tages am Slip ist
    if (L.s >= L.wasser) {
      const dayL = game.sim?.ctx?.rules?.dayLength ?? 270;
      const restZeit = RUECK_BIS * dayL - (game.sim?.state?.clock ?? 0);
      const restWeg = st.laenge + L.laenge - L.s;
      v = Math.max(v, Math.min(TEMPO.max, restWeg / Math.max(8, restZeit)));
    }
    if (eilig) v *= 2.5;
    // Am Slip: warten, solange ein Trailerboot der Slipanlage auf der Rampe ist (sie teilen sich den Slip)
    const amSlipNaechstes = L.boote.some((b) => { const s = L.s - b.versatz; return (s > -2 && s < L.wasser + 3) || (s > L.slipEnde - 3 && s < st.laenge + 1); });
    if (amSlipNaechstes && trailerAmSlip()) v = 0;
    // Die Spitze wartet vor dem Slip, bis das Trainerboot da ist (höchstens SAMMELN_MAX Sekunden)
    if (L.s > L.sammelBis && !L.gesammelt) {
      const t = trainer?.anim;
      const da = !t || Math.hypot(t.x - spitze.x, t.z - spitze.z) < 30;
      L.sammelWarten += dt;
      if (da || L.sammelWarten > SAMMELN_MAX || eilig) L.gesammelt = true;
      else v = 0;
    }
    // Vor einem fahrenden Boot kurz warten (nur auf dem Weg hinaus und herein, nicht im Kurs)
    const imKurs = L.s >= L.kursAb && L.s <= L.kursBis;
    if (!eilig && L.s > L.wasser && L.warten < WARTEN_MAX && L.boote.some((b) => b.group.visible && b.group.position.y < 0.2
      && blockiert({ x: b.group.position.x, z: b.group.position.z }, b.kurs, b.art === 'jolle' ? 8 : 6))) { L.warten += dt; v = 0; }
    else if (v > 0) L.warten = Math.max(0, L.warten - dt * 0.5);
    // Die Reihe rückt auf: ein Boot am Slip wartet, bis das vor ihm im Wasser ist (Gesamtlänge plus Slip)
    L.s = Math.min(st.laenge + L.laenge + 1, L.s + v * dt);
    L.zeit += dt;
    let imWasser = 0, anLand = 0, imFahrwasser = false;
    for (const b of L.boote) {
      const s = L.s - b.versatz;
      if (s <= 0 || s >= st.laenge) { b.group.visible = false; if (s >= st.laenge) anLand++; continue; }
      const q = aufStrecke(st, s);
      b.group.visible = true;
      const amSlip = s < L.wasser || s > st.laenge - (st.laenge - L.slipEnde) - 0.01 && q.y > 0.01;
      if (!amSlip) imWasser++;
      // Leicht versetzt in der Reihe (nicht wie auf Schienen), im Kurs etwas breiter
      const quer = amSlip ? 0 : b.seite * (s >= L.kursAb && s <= L.kursBis ? 2 : 1);
      const nx = -Math.sin(q.kurs), nz = -Math.cos(q.kurs);
      const x = q.x + nx * quer, z = q.z + nz * quer;
      b.kurs = amSlip ? Math.atan2(-(rampe.dz), rampe.dx) + Math.PI : b.kurs + wrap(q.kurs - b.kurs) * Math.min(1, dt * 2.2);
      const wippen = amSlip ? 0 : Math.sin(game.time * 1.7 + b.versatz) * 0.04;
      b.group.position.set(x, (q.y ?? 0) + wippen, z);
      b.group.rotation.y = b.kurs;
      if (!amSlip) segelStellen(b, b.kurs);
      if (!(s >= L.kursAb && s <= L.kursBis) && !amSlip) imFahrwasser = true;
    }
    // Wartende Boote halten, solange jemand im Fahrwasser ist (nicht während des Kurses draußen)
    halten(imFahrwasser);
    geduldHalten(dt);
    if (!L.raus && imWasser > 0) { L.raus = true; jt()?.auslaufen?.(); }
    if (!L.ende && anLand === L.boote.length) {
      L.ende = true;
      jt()?.zurueck?.();
      const n = h?.gruppe?.eltern ?? 0;
      if (n > 0) game.people?.besucher?.('segelclub', n, { abstand: 3 });
    }
    trainerTick(dt, L);
    if (L.ende && (!trainer || trainer.auftrag === 'box' || trainer.auftrag === 'slip')) laufWeg();
  }

  // Trainerboot während der Fahrt: am Sammelpunkt warten, neben dem Ende der Reihe fahren, im Kurs in der Mitte
  function trainerTick(dt, L) {
    if (!trainer) return;
    const a = trainer.anim;
    const st = L.strecke;
    const letzte = L.s - L.laenge + ABSTAND.opti;   // Bug des letzten Boots
    if (trainer.auftrag === 'box' && !L.trainerLos) {
      // Ablegen und zum Sammelpunkt vor dem Slip (wenn es nicht schon vorher losgefahren ist)
      L.trainerLos = true;
      trainerZuPunkt(rampe.warte, 'sammeln');
      return;
    }
    if (trainer.auftrag === 'sammeln') L.trainerLos = true;
    if (trainer.auftrag === 'sammeln') {
      if (letzte > L.wasser + 6 && (a.state === 'waiting' || a.state === 'idle')) { a.cancel(); trainer.auftrag = 'folgen'; }
      else return;
    }
    if (trainer.auftrag === 'folgen' || trainer.auftrag === 'heim') {
      const s = Math.max(L.wasser + 4, Math.min(st.laenge, letzte - 10));
      const q = aufStrecke(st, s);
      const imKurs = s >= L.kursAb && s <= L.kursBis;
      if (trainer.auftrag === 'folgen' && imKurs) { trainer.auftrag = 'revier'; return; }
      // neben der Reihe (in Fahrtrichtung rechts), am Ende vor dem Slip zurück in die Box
      const nx = -Math.sin(q.kurs), nz = -Math.cos(q.kurs);
      const zx = q.x + nx * -TRAINER_SEITE * 0.6, zz = q.z + nz * -TRAINER_SEITE * 0.6;
      if (trainer.auftrag === 'heim' && letzte > st.laenge - 3) {
        const h = jt()?.heute?.();
        if (h?.platz) trainerInBox(h.platz);
        else { trainer.auftrag = 'slip'; trainerZuPunkt(rampe.unten, 'slip'); }
        return;
      }
      fahreZu(a, frei(zx, zz, 2.5, 0.5) ? { x: zx, z: zz } : q, dt, L);
      return;
    }
    if (trainer.auftrag === 'revier') {
      // langsam in der Mitte des Kurses kreisen
      const m = revier;
      const w = game.time * 0.12;
      fahreZu(a, { x: m.x + Math.cos(w) * 5, z: m.z + Math.sin(w) * 5 }, dt, L, 1.2);
      if (letzte > L.kursBis + 4) trainer.auftrag = 'heim';
    }
  }
  // Direkt steuern (ohne Auftrag): weich zum Punkt, Bug in Fahrtrichtung
  function fahreZu(a, p, dt, L, vmax = 3.4) {
    if (a.task || a.tasks?.length) a.cancel();
    a.state = 'sailing';
    const dx = p.x - a.x, dz = p.z - a.z, d = Math.hypot(dx, dz);
    const eilig = game.sim?.state?.phase !== 'day';
    const v = Math.min((eilig ? 2.5 : 1) * vmax, d * 0.8);
    if (d > 0.2) {
      const soll = Math.atan2(-dz, dx);
      a.heading += wrap(soll - a.heading) * Math.min(1, dt * 1.5);
      const k = Math.max(0, Math.cos(wrap(soll - a.heading)));
      const nx = a.x + Math.cos(a.heading) * v * k * dt, nz = a.z - Math.sin(a.heading) * v * k * dt;
      if (frei(nx, nz, 1.5, 0.5)) { a.x = nx; a.z = nz; }
      a.speed = v * k;
    } else a.speed = 0;
  }

  // ---------------------------------------------------------------- Takt
  let zuletzt = null;     // Tag:Phase, für den die Ansicht zuletzt reagiert hat
  function takt(dt) {
    const api = game.sim;
    const h = jt()?.heute?.();
    const state = api?.state;
    // Kein Training heute (oder vorbei): aufräumen; abends fährt das Trainerboot zum Slip und geht an Land
    if (!h || h.phase === 'ausgefallen') {
      if (lauf) laufWeg();
      if (trainer && trainer.auftrag !== 'slip') { trainer.auftrag = 'slip'; if (rampe) trainerZuPunkt(rampe.unten, 'slip'); else trainerWeg(); }
    }
    if (trainer?.auftrag === 'slip' && rampe && (trainer.anim.state === 'waiting' || trainer.anim.state === 'idle')
      && Math.hypot(trainer.anim.x - rampe.unten.x, trainer.anim.z - rampe.unten.z) < 8) trainerWeg();
    if (!h) return;
    const sig = `${h.tag}:${h.phase}:${h.platz}`;
    if (sig !== zuletzt) {
      zuletzt = sig;
      if (h.phase === 'bereit' && h.platz) {
        if (!rampe) rampe = rampeSuchen();
        if (!trainer || trainer.platz !== h.platz || (trainer.auftrag !== 'box')) trainerInBox(h.platz, { sofort: !rampe });
      }
    }
    if (h.phase === 'zurueck' && !lauf && trainer && trainer.auftrag !== 'box' && trainer.auftrag !== 'slip' && h.platz) trainerInBox(h.platz);
    // Abends: das Trainerboot legt ab und geht über den Slip an Land
    if (state?.phase !== 'day' && trainer && !lauf && trainer.auftrag === 'box' && trainer.anim.moored) {
      trainer.auftrag = 'slip';
      if (!rampe) rampe = rampeSuchen();
      if (rampe) trainerZuPunkt(rampe.unten, 'slip'); else trainerWeg();
    }
    // Zur Beginnzeit (oder wenn die Regeln die Gruppe schon draußen sehen, etwa nach dem Laden) losfahren
    const beginn = h.beginnBei ?? (JT?.beginn ?? 0.3) * (api?.ctx?.rules?.dayLength ?? 270);
    // Kurz vorher legt das Trainerboot ab und fährt zum Slip
    if (h.phase === 'bereit' && !lauf && trainer?.auftrag === 'box' && state?.clock >= beginn - VORLAUF && state?.phase === 'day') {
      if (!rampe) rampe = rampeSuchen();
      if (rampe && trainer.anim.moored) trainerZuPunkt(rampe.warte, 'sammeln');
    }
    const los = (h.phase === 'bereit' && state?.clock >= beginn) || (h.phase === 'draussen' && !lauf);
    if (los && !lauf && state?.phase === 'day') {
      lauf = planeLauf(h);
      if (!lauf) { if (h.phase === 'bereit') jt()?.auslaufen?.(); return; }
      bojenZeigen(revier.kurs);
      if (!trainer && h.platz) trainerInBox(h.platz, { sofort: true });
      // nach dem Laden mitten im Training: gleich im Kurs beginnen
      if (h.phase === 'draussen') { lauf.s = lauf.kursAb + lauf.laenge; lauf.raus = true; if (trainer) { trainer.anim.place(revier.x, revier.z); trainer.auftrag = 'revier'; } }
    }
    if (lauf) laufTick(dt);
  }

  game.onTick((dt) => { if (dt > 0) takt(Math.min(dt, 0.5)); });
  const zuruecksetzen = () => { laufWeg(); trainerWeg(); zuletzt = null; };
  game.on('spielstand-geladen', zuruecksetzen);
  game.on('sim:change', (d) => { if (d?.reason === 'load' || d?.reason === 'new') zuruecksetzen(); });
  game.on('fahrwasser:karte', () => { if (!lauf) rampe = null; });
  game.on('services:gebaut', (e) => { if (e?.id === 'slip' && !lauf) rampe = null; });

  game.jugendBild = {
    aktiv: true,
    zustand: () => (lauf ? { s: Math.round(lauf.s), laenge: Math.round(lauf.strecke.laenge), reihe: lauf.laenge, wasser: Math.round(lauf.wasser), kursAb: Math.round(lauf.kursAb), kursBis: Math.round(lauf.kursBis), raus: lauf.raus, ende: lauf.ende, warten: Math.round(lauf.warten * 10) / 10, gesammelt: lauf.gesammelt } : null),
    boote: () => (lauf ? lauf.boote.map((b) => ({ art: b.art, sichtbar: b.group.visible, x: b.group.position.x, z: b.group.position.z })) : []),
    trainer: () => (trainer ? { x: trainer.anim.x, z: trainer.anim.z, auftrag: trainer.auftrag, fest: !!trainer.anim.moored, platz: trainer.platz } : null),
    revier: () => (revier ? { x: revier.x, z: revier.z, draussen: revier.draussen, r: revier.kurs?.r ?? null } : null),
    rampe: () => rampe ?? (rampe = rampeSuchen()),
    strecke: () => (lauf ? lauf.strecke.p.map((q) => ({ x: Math.round(q.x * 10) / 10, z: Math.round(q.z * 10) / 10 })) : null),
    gehalten: () => [...gehalten],
    // Zum Prüfen: Strecke ohne zu fahren planen ({ ok, laenge, draussen })
    probe: () => {
      const h = { gruppe: { optis: 1, jollen: 0 } };
      const l = planeLauf(h);
      if (!l) return { ok: false };
      const out = { ok: true, laenge: Math.round(l.strecke.laenge), hinaus: Math.round(l.kursAb), draussen: !!revier?.draussen };
      for (const b of l.boote) { b.abmelden?.(); gruppe.remove(b.group); }
      return out;
    },
  };
}

export default initJugendBild;
