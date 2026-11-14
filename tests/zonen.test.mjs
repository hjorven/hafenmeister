// Zonen des Geländes und Seezugänge (web/js/render/landschaft/zonen.js) für alle Küstentypen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { punkt, warteplaetze, PLAN_M, AUSSEN } from '../web/js/render/landschaft/gelaende.js';
import { festePunkte } from '../web/js/render/landschaft/karte.js';
import { REGIONEN } from '../web/js/render/landschaft/regionen.js';
import { FORMEN, formSetzen } from '../web/js/render/landschaft/formen.js';
import { zonenRaster, seezugaenge, ZONE, ZONE_NAME, STEG_ABSTAND_M } from '../web/js/render/landschaft/zonen.js';
import { HAFEN } from '../web/js/data/harbor.js';

const W = (px, py) => [px * PLAN_M, -py * PLAN_M];

test('Zonen: Stege, Liegeplätze, Bojen, Ankerfeld und Durchfahrt sind in jedem Küstentyp markiert', () => {
  try {
    for (const F of FORMEN) for (const seed of [1, 7]) {
      formSetzen(F.nr, seed);
      for (const st of [1, 3, 6]) {
        const z = zonenRaster(st, 'ostsee'), wo = `Typ ${F.nr} Seed ${seed} Stufe ${st}`;
        // Stege: Mittellinie und beide Ränder samt Sicherheitsabstand
        for (const l of HAFEN.stufen[st].stege) for (let q = 0; q < l.punkte.length - 1; q++) {
          const [ax, ay] = l.punkte[q], [bx, by] = l.punkte[q + 1], lang = Math.hypot(bx - ax, by - ay) || 1;
          const nx = -(by - ay) / lang, ny = (bx - ax) / lang, halb = (l.breite ?? 2) / 2 + (STEG_ABSTAND_M - 0.7) / PLAN_M;
          for (let t = 0; t <= 1; t += 0.25) for (const s of [-1, 0, 1]) {
            const px = ax + (bx - ax) * t + nx * halb * s, py = ay + (by - ay) * t + ny * halb * s;
            const c = z.bei(...W(px, py));
            assert.ok(c === ZONE.STEG || c === ZONE.LAND, `${wo}: Steg bei ${px.toFixed(0)},${py.toFixed(0)} ist ${ZONE_NAME[c]}`);
          }
        }
        // Liegeplätze: Mitte der Box ist Liegeplatz (oder Steg, wo ein Fingersteg sie schneidet)
        for (const p of HAFEN.plaetze) {
          const lage = p.lage?.[st];
          if (!lage) continue;
          const c = z.bei(...W(lage[0], lage[1]));
          assert.ok(c === ZONE.LIEGEPLATZ || c === ZONE.STEG, `${wo}: Liegeplatz ${p.id} ist ${ZONE_NAME[c]}`);
        }
        const w = warteplaetze(st);
        for (const b of w.bojen) assert.equal(ZONE_NAME[z.bei(b.x, b.z)], 'bojen', `${wo}: Boje ${b.id}`);
        for (const a of w.ankerplaetze) assert.ok(['anker', 'bojen'].includes(z.name(a.x, a.z)), `${wo}: Ankerplatz ${a.id} ist ${z.name(a.x, a.z)}`);
        const e = festePunkte(st).engpass;
        assert.equal(z.name(...W((e.x0 + e.x1) / 2, (e.y0 + e.y1) / 2)), 'durchfahrt', `${wo}: Mitte des Engpasses`);
        // jede Zelle hat genau eine gültige Zone, Wasserzonen sind mindestens 1 m tief
        for (let k = 0; k < z.zone.length; k += 7) {
          assert.ok(z.zone[k] < ZONE_NAME.length);
          if (z.zone[k] >= ZONE.BOJEN) assert.ok(z.tiefe[k] >= 1, `${wo}: ${ZONE_NAME[z.zone[k]]} mit ${z.tiefe[k].toFixed(2)} m`);
        }
        // außerhalb des Rasters nur Land oder See
        assert.ok([ZONE.LAND, ZONE.SEE].includes(z.bei(5000, 5000)));
      }
    }
  } finally { formSetzen(1); }
});

test('Seezugänge: außerhalb der Karte, aus vielen Richtungen, Weg nur über Wasser bis vor die Einfahrt', () => {
  const reg = REGIONEN.ostsee;
  try {
    for (const F of FORMEN) for (const seed of [1, 7, 4242]) {
      formSetzen(F.nr, seed);
      for (const st of [1, 3, 6]) {
        const liste = seezugaenge(st, 'ostsee'), wo = `Typ ${F.nr} Seed ${seed} Stufe ${st}`;
        // Ganz geschlossene Reviere (manche Bodden) haben keinen Weg zur See: dann Zugänge im Binnenwasser
        const binnen = liste.length > 0 && liste.every((q) => q.aufKarte);
        assert.ok(liste.length >= (binnen ? 1 : 8), `${wo}: nur ${liste.length} Seezugänge`);
        if (!binnen) assert.ok(new Set(liste.map((q) => q.richtung)).size >= 3, `${wo}: zu wenige Richtungen`);
        assert.ok(!binnen || F.nr === 4, `${wo}: kein Weg zur offenen See`);
        const ziel = festePunkte(st).einfahrt.aussen;
        for (const q of liste) {
          // außerhalb des Außenrings, den keine Zoomstufe zeigt
          assert.ok(q.aufKarte || q.px < AUSSEN.x0 || q.px > AUSSEN.x1 || q.py < AUSSEN.y0 || q.py > AUSSEN.y1, `${wo}: ${q.id} liegt auf der Karte`);
          const ende = q.weg.at(-1);
          assert.ok(Math.hypot(ende.x / PLAN_M - ziel[0], -ende.z / PLAN_M - ziel[1]) < 150, `${wo}: ${q.id} endet nicht vor der Einfahrt`);
          assert.ok(q.laengeM > 200 && q.tiefeM >= 1);
          // jede Strecke des Wegs alle 6 m: Wasser, mindestens so tief wie zugesagt (mit kleiner Toleranz am Rand)
          for (let s = 1; s < q.weg.length; s++) {
            const a = q.weg[s - 1], b = q.weg[s], lang = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(lang / 6));
            for (let t = 0; t <= n; t++) {
              const px = (a.x + (b.x - a.x) * t / n) / PLAN_M, py = -(a.z + (b.z - a.z) * t / n) / PLAN_M;
              if (px <= AUSSEN.x0 || px >= AUSSEN.x1 || py <= AUSSEN.y0 || py >= AUSSEN.y1) continue;
              const tief = -punkt(px, py, st, reg).h;
              assert.ok(tief >= q.tiefeM * 0.8, `${wo}: ${q.id} führt bei ${px.toFixed(0)},${py.toFixed(0)} über ${tief.toFixed(2)} m (zugesagt ${q.tiefeM})`);
            }
          }
        }
      }
    }
  } finally { formSetzen(1); }
});
