// Grundform des Geländes: Engpass (Seegatt, Durchstich), Fahrwasser, feste Punkte, Haken für andere Module.
// docs/landschaft.md, Abschnitt "Engpass und feste Punkte".
import test from 'node:test';
import assert from 'node:assert/strict';
import { punkt, warteplaetze, pricken, molen, PLAN_M, seeAbstandM } from '../web/js/render/landschaft/gelaende.js';
import { festePunkte, festePunkteWelt, karteRaster, engpassBreiteM, art, ART } from '../web/js/render/landschaft/karte.js';
import { REGIONEN } from '../web/js/render/landschaft/regionen.js';
import { anlagenFlaechen } from '../web/js/data/anlagen-flaechen.js';
import { FORMEN, formSetzen, formWaehlen } from '../web/js/render/landschaft/formen.js';
import { HAFEN } from '../web/js/data/harbor.js';
import { leuchttuerme } from '../web/js/render/landschaft/gelaende.js';

const STUFEN = [1, 2, 3, 4, 5, 6];

test('Engpass ist in jeder Stufe und jedem Revier breit genug, auch bei Niedrigwasser', () => {
  for (const name of Object.keys(REGIONEN)) {
    const ebbe = REGIONEN[name].gelaende.gezeiten || 0;
    for (const st of STUFEN) {
      // Stufe 1-2: S und M (bis 1,5 m Tiefgang) brauchen 1,2 m; ab Stufe 3 L mit bis zu 2,5 m
      const tiefe = (st <= 2 ? 1.2 : 2.5) + ebbe;
      const b = engpassBreiteM(st, name, tiefe);
      const min = st <= 2 ? 18 : 30;
      assert.ok(b >= min, `${name} Stufe ${st}: nur ${b} m mit ${tiefe} m Tiefe, mindestens ${min} m`);
    }
  }
});

test('Engpass: die ganze Breite ist Wasser, ohne Landstreifen an den Mündungen', () => {
  for (const name of Object.keys(REGIONEN)) {
    for (const st of STUFEN) {
      const e = festePunkte(st).engpass;
      const rand = st <= 2 ? 0.25 : 0.05;   // Seegatt: flache Ränder, Durchstich: Kaimauer
      for (let py = e.y0 - 12; py <= e.y1 + 6; py += 0.5) {
        for (let px = e.x0 + e.breite * rand; px <= e.x1 - e.breite * rand; px += 1) {
          const ax = st <= 2 ? px : px;
          const h = punkt(ax, py, st, REGIONEN[name]).h;
          assert.ok(h < -0.5, `${name} Stufe ${st}: Land oder Untiefe im Engpass bei (${px.toFixed(0)}, ${py}) h ${h.toFixed(2)}`);
        }
      }
    }
  }
});

test('Fahrwasser von See bis ins Becken ist durchgehend tief und frei von Land', () => {
  for (const st of STUFEN) {
    const f = festePunkte(st);
    const tiefe = st <= 2 ? 1.6 : 3.0;
    for (let i = 0; i + 1 < f.fahrwasser.length; i++) {
      const [ax, ay] = f.fahrwasser[i], [bx, by] = f.fahrwasser[i + 1];
      const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 2);
      for (let k = 0; k <= n; k++) {
        const px = ax + ((bx - ax) * k) / n, py = ay + ((by - ay) * k) / n;
        const h = punkt(px, py, st, REGIONEN.ostsee).h;
        assert.ok(-h >= tiefe, `Stufe ${st}: Fahrwasser bei (${px.toFixed(0)}, ${py.toFixed(0)}) nur ${(-h).toFixed(2)} m tief`);
      }
    }
    for (const p of [f.einfahrt.aussen, f.einfahrt.innen]) assert.equal(art(p[0], p[1], st, 'ostsee'), 'wasser', `Stufe ${st}: Einfahrtspunkt ${p} liegt nicht im Wasser`);
  }
});

test('Molen, Wartebojen und Ankerplätze halten Abstand zum Fahrwasser', () => {
  const abstand = (px, py, pts) => {
    let d = Infinity;
    for (let i = 0; i + 1 < pts.length; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      const dx = bx - ax, dy = by - ay;
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
      d = Math.min(d, Math.hypot(px - ax - t * dx, py - ay - t * dy));
    }
    return d;
  };
  for (const st of STUFEN) {
    const f = festePunkte(st);
    const frei = f.fahrwasserBreiteM / PLAN_M / 2;
    for (const m of molen(st)) for (const [px, py] of m.punkte) {
      assert.ok(abstand(px, py, f.fahrwasser) > frei, `Stufe ${st}: ${m.name} ragt ins Fahrwasser`);
    }
    const w = warteplaetze(st);
    for (const b of w.bojen) assert.ok(abstand(b.px, b.py, f.fahrwasser) > 12, `Stufe ${st}: Boje ${b.id} liegt im Fahrwasser`);
    for (const a of w.ankerplaetze) assert.ok(abstand(a.px, a.py, f.fahrwasser) > 12, `Stufe ${st}: Ankerplatz ${a.id} liegt im Fahrwasser`);
  }
});

test('Pricken stehen im Wasser am Rand der Rinne, nur in Stufe 1 und 2', () => {
  for (const st of STUFEN) {
    const p = pricken(st);
    if (st >= 3) { assert.equal(p.length, 0); continue; }
    assert.ok(p.length >= 10);
    for (const [px, py] of p) {
      const h = punkt(px, py, st, REGIONEN.ostsee).h;
      assert.ok(h < -0.2 && h > -3.0, `Pricke bei (${px.toFixed(0)}, ${py}) steht ${h.toFixed(2)} m`);
    }
  }
});

test('Karte: Raster passt zum Gelände, Uferabstand hat das richtige Vorzeichen', () => {
  const r = karteRaster(3, 'ostsee', 4);
  assert.equal(r.tiefe.length, r.nx * r.ny);
  let land = 0, wasser = 0;
  for (let k = 0; k < r.art.length; k += 37) {
    if (r.art[k] >= ART.FLACH) { wasser++; assert.ok(r.ufer[k] < 0); } else { land++; assert.ok(r.ufer[k] > 0); }
  }
  assert.ok(land > 100 && wasser > 100);
  const mitte = festePunkteWelt(3).engpass.achse[0];
  assert.equal(r.beiWelt(mitte.x, mitte.z).art, 'wasser');
  assert.ok(seeAbstandM(178, 300) === 0 && seeAbstandM(0, -50) > 80);
});

test('Bauflächen und Anlagenflächen liegen nicht im Engpass oder Fahrwasser', () => {
  for (const st of STUFEN) {
    const f = festePunkte(st);
    const flaechen = [...f.bauflaechen, ...anlagenFlaechen(st)];
    for (const fl of flaechen) {
      for (const [px, py] of f.fahrwasser) {
        const xs = fl.poly.map((q) => q[0]), ys = fl.poly.map((q) => q[1]);
        const drin = px > Math.min(...xs) - 8 && px < Math.max(...xs) + 8 && py > Math.min(...ys) - 8 && py < Math.max(...ys) + 8;
        assert.ok(!drin, `Stufe ${st}: Fläche ${fl.id} berührt das Fahrwasser bei (${px}, ${py})`);
      }
      const e = f.engpass;
      const xs = fl.poly.map((q) => q[0]), ys = fl.poly.map((q) => q[1]);
      const ueber = Math.min(...xs) < e.x1 && Math.max(...xs) > e.x0 && Math.min(...ys) < e.y1 && Math.max(...ys) > e.y0;
      assert.ok(!ueber, `Stufe ${st}: Fläche ${fl.id} liegt im Engpass`);
    }
  }
});

test('Alle Geländeformen: Engpass, Fahrwasser, Liegeplätze, Wartebojen und Leuchttürme passen', () => {
  try {
    for (const F of FORMEN) for (const R of ['ostsee', 'nordsee']) {
      formSetzen(F.nr);
      const reg = REGIONEN[R];
      for (const st of STUFEN) {
        assert.ok(engpassBreiteM(st, R, st <= 2 ? 1.2 : 2.5) >= (st <= 2 ? 18 : 30), `Form ${F.nr} ${R} Stufe ${st}: Engpass zu schmal`);
        const f = festePunkte(st);
        for (const [px, py] of f.fahrwasser) assert.ok(-punkt(px, py, st, reg).h >= (st <= 2 ? 1.6 : 3), `Form ${F.nr} ${R} Stufe ${st}: Fahrwasser flach bei ${px},${py}`);
        for (const b of warteplaetze(st).bojen) assert.ok(-punkt(b.px, b.py, st, reg).h > 1.2, `Form ${F.nr} ${R} Stufe ${st}: Boje ${b.id} zu flach`);
        for (const a of warteplaetze(st).ankerplaetze) assert.ok(-punkt(a.px, a.py, st, reg).h > 1.0, `Form ${F.nr} ${R} Stufe ${st}: Ankerplatz ${a.id} zu flach`);
      }
      for (const p of HAFEN.plaetze) for (const [st, l] of Object.entries(p.lage)) {
        const soll = p.tiefe?.[st];
        if (soll == null) continue;
        assert.ok(-punkt(l[0], l[1], Number(st), reg).h >= soll - 0.4, `Form ${F.nr} ${R}: ${p.id} Stufe ${st} zu flach`);
      }
      for (const [x, y] of leuchttuerme()) assert.ok(punkt(x, y, 3, reg).h > 0.3, `Form ${F.nr} ${R}: Leuchtturm bei ${x},${y} steht im Wasser`);
      // Westliche Nehrung bleibt Land (Anlagen der Stufe 6)
      for (let x = -360; x <= -90; x += 30) assert.ok(punkt(x, 210, 6, reg).h > 0, `Form ${F.nr} ${R}: westliche Nehrung bei x ${x} ist Wasser`);
    }
  } finally { formSetzen(1); }
});

test('Formwahl: URL, Spielstand, Tests und neues Spiel', () => {
  const s = (o) => ({ getItem: (k) => (o[k] ? JSON.stringify(o[k]) : null), setItem() {} });
  assert.equal(formWaehlen({ url: '?gelaende=4', s: s({}) }).nr, 4);
  assert.equal(formWaehlen({ url: '', s: s({ 'hafenmeister.spielstand': { modules: { gelaende: { nr: 7 } } } }) }).nr, 7);
  assert.equal(formWaehlen({ url: '', s: s({ 'hafenmeister.spielstand': { seed: 1 } }) }).nr, 1);
  assert.equal(formWaehlen({ url: '', s: s({}), webdriver: true }).nr, 1);
  assert.equal(formWaehlen({ url: '', s: s({}), zufall: () => 0.99 }).nr, FORMEN[FORMEN.length - 1].nr);
  assert.equal(formWaehlen({ url: '?gelaende=99', s: s({}), webdriver: true }).nr, 1);
});

test('Überblick je Form: enthält Hafen, Einfahrt und alle Landmarken, passt in die Kamera', async () => {
  const { blickRect } = await import('../web/js/render/landschaft/formen.js');
  for (const F of FORMEN) {
    const r = blickRect(F);
    const drin = (x, y) => x * 0.62 >= r.minX && x * 0.62 <= r.maxX && -y * 0.62 >= r.minZ && -y * 0.62 <= r.maxZ;
    assert.ok(drin(178, 268) && drin(-100, 0), `Form ${F.nr}: Einfahrt oder Hafen fehlt`);
    for (const [x, y] of F.leuchttuerme || []) assert.ok(drin(x, y), `Form ${F.nr}: Leuchtturm fehlt`);
    for (const i of [...(F.seeInseln || []), ...(F.seeAussen || [])]) assert.ok(drin(i.x, i.y), `Form ${F.nr}: Insel fehlt`);
    assert.ok(r.maxX - r.minX <= 420, `Form ${F.nr}: Überblick breiter als die Kamera erlaubt`);
  }
});

test('Schmaler Überblick (Handy hochkant): Einfahrt drin, nächste Landmarke wenn sie passt, Breite eingehalten', async () => {
  const { blickRect } = await import('../web/js/render/landschaft/formen.js');
  for (const F of FORMEN) {
    const r = blickRect(F, { maxBreiteM: 200 });
    assert.ok(r.maxX - r.minX <= 200 + 1e-6, `Form ${F.nr}: zu breit`);
    assert.ok(178 * 0.62 >= r.minX && 178 * 0.62 <= r.maxX && -268 * 0.62 >= r.minZ, `Form ${F.nr}: Einfahrt fehlt`);
  }
});
