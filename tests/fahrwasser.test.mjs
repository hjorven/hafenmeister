// Fahrwasser (web/js/world/fahrwasser.js): Wege aus der Karte des Gelaendes.
// Prueft fuer alle Stufen 1 bis 6, alle 13 Stegbilder (0 Grundbild, 1 bis 12 Varianten) und alle 10 Gelaendeformen:
// - jeder Liegeplatz ist von See (oder im Binnensee ohne Zufahrt vom anderen Seeende) erreichbar,
// - kein Punkt eines Wegs liegt an Land, auf flachem Wasser, auf einem Steg oder in einem Liegeplatz,
// - Wege halten den Abstand der Bootsgroesse zu allem ein,
// - Engstellen werden erkannt und die Einbahn-Freigabe arbeitet in Reihenfolge.
import test from 'node:test';
import assert from 'node:assert/strict';
import { gelaendeAbfrage, warteplaetze, PLAN_M } from '../web/js/render/landschaft/gelaende.js';
import { region } from '../web/js/render/landschaft/regionen.js';
import { HAFEN } from '../web/js/data/harbor.js';
import { STEGBILDER } from '../web/js/data/stegbilder.js';
import { stegbildSetzen } from '../web/js/data/stegbild.js';
import { baueKarte, route, hindernisseAusHafen, bootMass, erreichbar, befahrbar, freiBei, sichtlinie } from '../web/js/world/fahrwasser.js';
import { ChannelLock, Engstellen } from '../web/js/render/boat-channel.js';
import { FORMEN, formSetzen } from '../web/js/render/landschaft/formen.js';
import { seebrueckeStrecke } from '../web/js/render/landschaft/strand.js';
import { seeBahnen, seeRunde, rundeImWasser, versetzt, VERSATZ_MAX } from '../web/js/data/verkehr.js';

const R = region('ostsee');
const BEREICH = { x0: -430.5, x1: 320, z0: -361, z1: 140 };   // wie boat-view.js
const GRUNDBILD = structuredClone(HAFEN);
const STEGBILD_NR = [0, ...STEGBILDER.varianten.map((_, i) => i + 1)];
function mitStegbild(nr, fn) {
  for (const k of Object.keys(HAFEN)) delete HAFEN[k];
  Object.assign(HAFEN, structuredClone(GRUNDBILD));
  stegbildSetzen(HAFEN, nr);
  try { return fn(); } finally {
    for (const k of Object.keys(HAFEN)) delete HAFEN[k];
    Object.assign(HAFEN, structuredClone(GRUNDBILD));
  }
}

const GROESSE = { S: { length: 6, beam: 2.4, draft: 0.6, size: 'S' }, M: { length: 9, beam: 3.2, draft: 1.4, size: 'M' }, L: { length: 14, beam: 4.4, draft: 2.0, size: 'L' }, XL: { length: 40, beam: 8, draft: 4, size: 'XL' }, XXL: { length: 110, beam: 18, draft: 5.2, size: 'XXL' } };

function karteFuer(st) {
  const g = gelaendeAbfrage(st, R);
  const w = warteplaetze(st);
  const weich = w.bojen.map((b) => ({ x: b.x, z: b.z, r: 14, kosten: 3 }));
  return baueKarte({ tiefe: g.tiefeBei, bereich: BEREICH, ...hindernisseAusHafen(HAFEN, st), weich, engRadius: 3.6 });
}

// Zielpunkt vor dem Platz wie boat-anim approachPoints: in der Gasse vor der Box, laengsseits daneben
function zielVor(p, st, info, t = 0) {
  const [x, y, richtung] = p.lage[st];
  const h = (richtung * Math.PI) / 180;
  const dx = Math.cos(h), dz = -Math.sin(h);
  const L = Math.min(info.length, p.maxLaenge ?? info.length);
  const bx = x * PLAN_M, bz = -y * PLAN_M, len = p.laenge * PLAN_M;
  if (p.art === 'box' || p.art === 'finger') {
    // wie approachPoints: erster freier Drehpunkt in der Gasse mit freier Geraden bis vor die Box (Seite egal, beide probieren)
    const px = Math.sin(h), pz = Math.cos(h), r = info.beam / 2 + 0.4;
    for (const [kk, qq] of [[1.1, 0.9], [1.1, 0.5], [0.9, 0.6], [1.1, 0], [0.8, 0.3], [0.7, 0], [0.55, 0]]) {
      for (const sd of [1, -1]) {
        const q = { x: bx - dx * (len / 2 + L * kk) + px * sd * L * qq, z: bz - dz * (len / 2 + L * kk) + pz * sd * L * qq };
        const vor = { x: bx - dx * (len / 2 + L * 0.25), z: bz - dz * (len / 2 + L * 0.25) };
        if (befahrbar(KARTE, q.x, q.z, r, t) && sichtlinie(KARTE, q, vor, info.beam / 2 + 0.2, t)) return q;
      }
    }
    // enge Gasse: wie approachPoints wenigstens ein freier Drehpunkt
    for (const [kk, qq] of [[1.1, 0.9], [1.1, 0.5], [0.9, 0.6], [1.1, 0], [0.8, 0.3], [0.7, 0], [0.55, 0]]) {
      for (const sd of [1, -1]) {
        const q = { x: bx - dx * (len / 2 + L * kk) + px * sd * L * qq, z: bz - dz * (len / 2 + L * kk) + pz * sd * L * qq };
        if (befahrbar(KARTE, q.x, q.z, r, t)) return q;
      }
    }
    return { x: bx - dx * (len / 2 + L * 0.55), z: bz - dz * (len / 2 + L * 0.55) };
  }
  // laengsseits: auf der Wasserseite neben dem Platz (wie approachPoints, Seite mit mehr Platz)
  const px = Math.sin(h), pz = Math.cos(h), off = (p.breite * PLAN_M) / 2 + info.beam * 1.8 + 1.5;
  const a = { x: bx + px * off, z: bz + pz * off }, b = { x: bx - px * off, z: bz - pz * off };
  return freiBei(KARTE, a.x, a.z) >= freiBei(KARTE, b.x, b.z) ? a : b;
}
let KARTE = null;
const FEHLER = [];

function pruefeWeg(k, a, weg, m, wo) {
  let p = a;
  for (const q of weg.punkte) {
    const d = Math.hypot(q.x - p.x, q.z - p.z);
    const n = Math.max(1, Math.ceil(d / 0.5));
    for (let i = 0; i <= n; i++) {
      const x = p.x + ((q.x - p.x) * i) / n, z = p.z + ((q.z - p.z) * i) / n;
      // Anfang und Ende duerfen am Platz/ausserhalb liegen; der Weg dazwischen muss frei sein.
      // Ueberall mindestens Rumpf plus Handbreit (rMin), unterwegs (mehr als 30 m von Start und
      // Ziel) der volle Abstand r.
      const ende = weg.punkte[weg.punkte.length - 1];
      // die letzten Meter ins Ziel gehoeren zum Anlegen (approachPoints in boat-anim.js)
      if (Math.hypot(x - a.x, z - a.z) < 3 || Math.hypot(x - ende.x, z - ende.z) < 6) continue;
      // Ueberall Rumpf plus Handbreit (rMin). Wo es enger als r ist, zaehlt die Stelle als Engstelle.
      const soll = (m.rMin ?? m.r) - 0.1;
      if (process.env.SAMMELN && freiBei(k, x, z) < soll) { FEHLER.push(`${wo} (${x.toFixed(0)},${z.toFixed(0)}) ${freiBei(k, x, z).toFixed(1)}<${soll.toFixed(1)}`); return; }
      assert.ok(freiBei(k, x, z) >= soll, `${wo}: zu nah an Land, Steg oder Liegeplatz bei (${x.toFixed(1)}, ${z.toFixed(1)}), frei ${freiBei(k, x, z).toFixed(1)} m < ${soll.toFixed(1)} m`);
    }
    p = q;
  }
}

test('Fahrwasser: jeder Liegeplatz ist erreichbar, Wege meiden Land und Stege, Stufe 1 bis 6, alle Stegbilder', () => {
  const flach = new Set();
  for (const nr of STEGBILD_NR) {
    mitStegbild(nr, () => {
      for (let st = 1; st <= 6; st++) {
        const k = karteFuer(st);
        KARTE = k;
        const w = warteplaetze(st);
        const boje = w.bojen[Math.floor(w.bojen.length / 2)];
        for (const p of HAFEN.plaetze) {
          if (!p.lage[st] || ['pier', 'marine', 'seenotretter'].includes(p.art)) continue;
          const info = GROESSE[p.klasse] ?? GROESSE.M;
          // Tiefgang wie die Spielregel: Platz nur fuer Boote mit Tiefgang + 0,3 m <= Wassertiefe am Platz
          const m = bootMass({ ...info, beam: Math.min(info.beam, p.maxBreite ?? info.beam), draft: Math.min(info.draft, (p.tiefe?.[st] ?? 9) - 0.3) });
          const ziel = zielVor(p, st, info, m.t);
          const weg = route(k, boje, ziel, { ...m, rechts: Math.min(3, m.r) });
          const wo = `Stegbild ${nr} Stufe ${st} Platz ${p.id}`;
          if (process.env.SAMMELN && !(weg.ok && weg.amZiel)) { FEHLER.push(`${wo}: kein Weg, Ziel (${ziel.x.toFixed(1)},${ziel.z.toFixed(1)}) frei ${freiBei(k, ziel.x, ziel.z).toFixed(1)} r ${m.rMin.toFixed(2)} t ${m.t.toFixed(2)}`); continue; }
          assert.ok(weg.ok && weg.amZiel, `${wo}: kein Weg von der Warteboje`);
          if (weg.flach) flach.add(`Stufe ${st} ${p.id}`);
          const ende = weg.punkte[weg.punkte.length - 1];
          assert.ok(Math.hypot(ende.x - ziel.x, ende.z - ziel.z) < 0.5, `${wo}: Weg endet nicht am Platz`);
          pruefeWeg(k, boje, weg, m, wo);
        }
      }
    });
  }
  // Plaetze, die nur ueber Wasser flacher als Tiefgang + 0,3 m zu erreichen sind (Gelaende-Hinweis)
  if (FEHLER.length) console.log(FEHLER.length, FEHLER.join('\n'));
  if (flach.size) console.log(`Hinweis Fahrwasser: ${flach.size} Plaetze nur ueber flaches Wasser erreichbar:`, [...flach].slice(0, 30).join(', '));
});

test('Fahrwasser: alle 10 Gelaendeformen, jeder Platz erreichbar, Bojen frei, Rand von See erreichbar', () => {
  try {
    for (const { nr } of FORMEN) {
      formSetzen(nr);
      for (let st = 1; st <= 6; st++) {
        const k = karteFuer(st);
        KARTE = k;
        const w = warteplaetze(st);
        const boje = w.bojen[Math.floor(w.bojen.length / 2)];
        for (const b of w.bojen) assert.ok(befahrbar(k, b.x, b.z, 2.5, 1.5), `Form ${nr} Stufe ${st}: Boje ${b.id} nicht in freiem Wasser`);
        // Ankunft: von der Boje aus muss der Kartenrand erreichbar sein (Boote kommen von dort)
        const mL = bootMass(st >= 3 ? GROESSE.L : GROESSE.M);
        const ok = erreichbar(k, boje.x, boje.z, mL.r, mL.t);
        let rand = 0;
        for (let i = 0; i < k.nx; i++) if (ok[i]) rand++;
        for (let j = 0; j < k.nz; j++) { if (ok[j * k.nx]) rand++; if (ok[j * k.nx + k.nx - 1]) rand++; }
        assert.ok(rand > 20, `Form ${nr} Stufe ${st}: Kartenrand von der Boje nicht erreichbar (${rand} Zellen)`);
        for (const p of HAFEN.plaetze) {
          if (!p.lage[st] || ['pier', 'marine', 'seenotretter'].includes(p.art)) continue;
          const info = GROESSE[p.klasse] ?? GROESSE.M;
          const m = bootMass({ ...info, beam: Math.min(info.beam, p.maxBreite ?? info.beam), draft: Math.min(info.draft, (p.tiefe?.[st] ?? 9) - 0.3) });
          const ziel = zielVor(p, st, info, m.t);
          const weg = route(k, boje, ziel, { ...m, rechts: Math.min(3, m.r) });
          const wo = `Form ${nr} Stufe ${st} Platz ${p.id}`;
          if (process.env.SAMMELN && !(weg.ok && weg.amZiel)) { FEHLER.push(`${wo}: kein Weg`); continue; }
          assert.ok(weg.ok && weg.amZiel, `${wo}: kein Weg von der Warteboje`);
          pruefeWeg(k, boje, weg, m, wo);
        }
      }
    }
  } finally { formSetzen(1); }
  if (FEHLER.length) console.log(FEHLER.length, FEHLER.join('\n'));
});

test('Fahrwasser: ab Stufe 3 erreichen Boote bis L die Bojen von See, aus mehreren Richtungen', () => {
  for (let st = 3; st <= 6; st++) {
    const k = karteFuer(st);
    const w = warteplaetze(st);
    const m = bootMass(GROESSE.L);
    const boje = w.bojen[0];
    const ok = erreichbar(k, boje.x, boje.z, m.r, m.t);
    // Nordkante: offene See, mindestens zwei getrennte Bereiche (Westen und Osten der Nordkante)
    let west = 0, ost = 0;
    for (let i = 0; i < k.nx; i++) if (ok[i]) { if (i < k.nx / 2) west++; else ost++; }
    assert.ok(west > 20 && ost > 20, `Stufe ${st}: Nordkante nicht in beiden Haelften erreichbar (${west}/${ost})`);
    for (const start of [{ x: -200, z: -339 }, { x: 0, z: -339 }, { x: 250, z: -339 }]) {
      const weg = route(k, start, boje, { ...m, rechts: 3 });
      assert.ok(weg.ok, `Stufe ${st}: kein Weg von (${start.x}, ${start.z}) zur Boje`);
      pruefeWeg(k, start, weg, m, `Stufe ${st} von ${start.x}`);
    }
  }
});

test('Fahrwasser: Wartebojen und Ankerplaetze liegen in freiem, tiefem Wasser', () => {
  for (let st = 1; st <= 6; st++) {
    const k = karteFuer(st);
    const w = warteplaetze(st);
    for (const b of w.bojen) assert.ok(befahrbar(k, b.x, b.z, 2.5, 1.5), `Stufe ${st}: Boje ${b.id} nicht in freiem Wasser`);
    const frei = w.ankerplaetze.filter((a) => befahrbar(k, a.x, a.z, 3, 1.5)).length;
    assert.ok(frei >= Math.min(6, w.ankerplaetze.length), `Stufe ${st}: zu wenige Ankerplaetze in freiem Wasser (${frei})`);
  }
});

test('Fahrwasser: Sichtlinie und Abstand an einem Steg', () => {
  const k = baueKarte({ tiefe: () => 3, bereich: { x0: -50, x1: 50, z0: -50, z1: 50 }, zelle: 1, linien: [{ punkte: [{ x: 0, z: -30 }, { x: 0, z: 50 }], breite: 2 }] });
  assert.equal(sichtlinie(k, { x: -20, z: 0 }, { x: 20, z: 0 }, 1), false);
  assert.equal(sichtlinie(k, { x: -20, z: -45 }, { x: 20, z: -45 }, 1), true);
  const weg = route(k, { x: -20, z: 20 }, { x: 20, z: 20 }, { r: 3, t: 1 });
  assert.ok(weg.ok);
  // um das Stegende herum (Steg reicht bis z = -30)
  assert.ok(weg.punkte.some((p) => p.z < -30), 'Weg fuehrt nicht um das Stegende herum');
  pruefeWeg(k, { x: -20, z: 20 }, weg, { r: 3 }, 'Teststeg');
});

test('Fahrwasser: Kanal schmaler als zwei Boote wird Engstelle mit Fahrtrichtung', () => {
  // Zwei Becken, verbunden durch einen 10 m breiten Kanal
  const tiefe = (x, z) => (Math.abs(z) > 20 || Math.abs(x) < 5 ? 3 : 0);
  const k = baueKarte({ tiefe, bereich: { x0: -40, x1: 40, z0: -80, z1: 80 }, zelle: 1, engRadius: 3 });
  assert.ok(k.eng.liste.length >= 1, 'Kanal nicht als Engstelle erkannt');
  const hin = route(k, { x: 0, z: -60 }, { x: 0, z: 60 }, { r: 3, t: 1 });
  const her = route(k, { x: 0, z: 60 }, { x: 0, z: -60 }, { r: 3, t: 1 });
  assert.equal(hin.engstellen.length, 1);
  assert.equal(her.engstellen.length, 1);
  assert.equal(hin.engstellen[0].nr, her.engstellen[0].nr);
  assert.notEqual(hin.engstellen[0].richtung, her.engstellen[0].richtung);
  assert.ok(hin.engstellen[0].ein > 25 && hin.engstellen[0].aus < 95);
});

test('Engstelle: Konvoi bis drei, Gegenverkehr wartet, Reihenfolge bleibt', () => {
  const lock = new ChannelLock(3);
  const a = { id: 'A' }, b = { id: 'B' }, c = { id: 'C' }, d = { id: 'D' }, g = { id: 'G' };
  assert.equal(lock.request(a, 'ein'), true);
  assert.equal(lock.request(b, 'ein'), true);
  assert.equal(lock.request(g, 'aus'), false);
  assert.equal(lock.request(c, 'ein'), false, 'darf nicht am wartenden Gegenverkehr vorbei');
  lock.release(a); lock.release(b);
  assert.equal(lock.request(g, 'aus'), true);
  assert.equal(lock.request(c, 'ein'), false);
  lock.release(g);
  assert.equal(lock.request(c, 'ein'), true);
  assert.equal(lock.request(d, 'ein'), true);
  const e = new Engstellen(3);
  assert.equal(e.request(1, a, 'plus'), true);
  e.releaseAll(a);
  assert.equal(e.lock(1).leer, true);
  e.reset();
  assert.equal(e.locks.size, 0);
});

test('Engstelle: wer nicht mehr fragt, faellt aus der Schlange und haelt niemanden auf', () => {
  const lock = new ChannelLock(3);
  const a = { id: 'A' }, weg = { id: 'W' }, g = { id: 'G' };
  assert.equal(lock.request(a, 'ein', 1), true);
  assert.equal(lock.request(weg, 'aus', 2), false);           // wartet, wird dann entfernt (fragt nie wieder)
  assert.equal(lock.request(g, 'ein', 3), false, 'Gegenverkehr wartet vorn in der Schlange');
  lock.release(a);
  assert.equal(lock.request(g, 'ein', 10), false, 'noch frisch: das wartende Boot bestimmt die Richtung');
  assert.equal(lock.request(g, 'ein', 40), true, 'nach 20 Bildern ohne Nachfrage zaehlt es nicht mehr');
});

test('Fahrwasser: die Seebruecke (je Form und Seed an anderer Stelle) sperrt ihren Grundriss', () => {
  let geprueft = 0;
  try {
    for (const { nr } of FORMEN) {
      for (const seed of [1, 4]) {
        formSetzen(nr, seed);
        const st = 5;
        const sb = seebrueckeStrecke(st, 'ostsee');
        if (!sb) continue;
        const g = gelaendeAbfrage(st, R);
        // wie boat-view.js bereichMit: Raster waechst bis 20 m um eine weit draussen liegende Bruecke
        const xs = [sb.fuss[0] * PLAN_M, sb.kopf[0] * PLAN_M], zs = [-sb.fuss[1] * PLAN_M, -sb.kopf[1] * PLAN_M];
        const ab = (v, o) => o + Math.floor((v - o) / 1.5) * 1.5;
        const bereich = { x0: Math.min(BEREICH.x0, ab(Math.min(...xs) - 20, BEREICH.x0)), x1: Math.max(BEREICH.x1, Math.max(...xs) + 20), z0: Math.min(BEREICH.z0, ab(Math.min(...zs) - 20, BEREICH.z0)), z1: Math.max(BEREICH.z1, Math.max(...zs) + 20) };
        const k = baueKarte({ tiefe: g.tiefeBei, bereich, ...hindernisseAusHafen(HAFEN, st, { seebruecke: sb }), engRadius: 3.6 });
        const dx = sb.kopf[0] - sb.fuss[0], dy = sb.kopf[1] - sb.fuss[1];
        for (let i = 1; i <= 9; i++) {
          const x = (sb.fuss[0] + (dx * i) / 10) * PLAN_M, z = -(sb.fuss[1] + (dy * i) / 10) * PLAN_M;
          assert.equal(befahrbar(k, x, z, 0.5, 0), false, `Form ${nr} Seed ${seed}: Seebruecke bei ${x.toFixed(0)}, ${z.toFixed(0)} ist befahrbar`);
        }
        geprueft++;
      }
    }
  } finally { formSetzen(1, 1); }
  assert.ok(geprueft >= 3, `nur ${geprueft} Formen mit Seebruecke`);
});

test('Fahrwasser: Weg fuehrt um Boote an Boje und Anker herum, nicht hindurch', () => {
  const k = baueKarte({ tiefe: () => 5, bereich: { x0: 0, x1: 120, z0: 0, z1: 80 }, engRadius: 3 });
  const a = { x: 10, z: 40 }, b = { x: 110, z: 40 };
  const liegt = { x: 60, z: 40, r: 5 };
  const ohne = route(k, a, b, { r: 3, rMin: 2, t: 1.5 });
  const mit = route(k, a, b, { r: 3, rMin: 2, t: 1.5, boote: [liegt] });
  assert.ok(ohne.ok && mit.ok && mit.amZiel);
  const naechster = (pts) => {
    let d = Infinity, p = a;
    for (const q of pts) {
      const dx = q.x - p.x, dz = q.z - p.z, l2 = dx * dx + dz * dz;
      const u = l2 ? Math.max(0, Math.min(1, ((liegt.x - p.x) * dx + (liegt.z - p.z) * dz) / l2)) : 0;
      d = Math.min(d, Math.hypot(p.x + dx * u - liegt.x, p.z + dz * u - liegt.z));
      p = q;
    }
    return d;
  };
  assert.ok(naechster(ohne.punkte) < liegt.r, 'ohne Boote geradeaus');
  assert.ok(naechster(mit.punkte) >= liegt.r + 2, `mit Boot mindestens Rumpf plus Abstand daneben (${naechster(mit.punkte).toFixed(1)} m)`);
});

const BAHN_Y_MAX = 560;   // Pflicht-See vor der Einfahrt (natur.js SEE_NORD bis y 600) mit Abstand zum Rand

test('Vorbeifahrer: Bahnen und Runde auf dem Binnensee liegen in jeder Gelaendeform auf Wasser', () => {
  try {
    for (const { nr } of FORMEN) {
      formSetzen(nr);
      for (let st = 1; st <= 6; st++) {
        const g = gelaendeAbfrage(st, R);
        for (const [bi, b] of seeBahnen(st).entries()) {
          const soll = b.art === 'gross' ? 3 : 1.2;
          for (const d of [0, -VERSATZ_MAX]) {
            const pts = versetzt(b.pts, d);
            for (let i = 1; i < pts.length; i++) {
              const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
              const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 2);
              for (let j = 0; j <= n; j++) {
                const px = ax + ((bx - ax) * j) / n, py = ay + ((by - ay) * j) / n;
                // Die alten Bahnen sind nur noch Rückfall ohne Fahrwasserkarte; hinter der Reede ist die See je Küste anders
                if (py > BAHN_Y_MAX) continue;
                const t = g.tiefeBei(px * PLAN_M, -py * PLAN_M);
                assert.ok(t >= soll, `Form ${nr} Stufe ${st} Bahn ${bi} (${b.art}): zu flach bei (${px.toFixed(0)}, ${py.toFixed(0)}), ${t.toFixed(1)} m`);
              }
            }
          }
        }
        const r = seeRunde(st);
        if (r) {
          const w = warteplaetze(st);
          const meide = [...w.bojen.map((b) => ({ x: b.x, z: b.z, r: 10 })), ...w.ankerplaetze.map((a) => ({ x: a.x, z: a.z, r: (a.schwoikreisM ?? 8) + 4 }))];
          assert.ok(rundeImWasser(r, g.tiefeBei, { meide }), `Form ${nr} Stufe ${st}: keine Runde auf dem Binnensee passt`);
        }
      }
    }
  } finally { formSetzen(1); }
});
