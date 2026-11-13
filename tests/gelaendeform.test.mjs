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
    // Pricken nur, wo die Natur flaches Wasser hat; in tiefem, offenem Wasser gibt es keine
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
  assert.ok(seeAbstandM(0, -50) > 60);
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
      // Westlich der Einfahrt trägt Land oder ein Wellenbrecher die Anlagen der Stufe 6
      for (let x = -360; x <= -90; x += 30) assert.ok(punkt(x, 212, 6, reg).h > 0, `Form ${F.nr} ${R}: westlich der Einfahrt bei x ${x} weder Land noch Wellenbrecher`);
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

test('Menschenwege (Nehrung, Strand, Badestellen) liegen in jeder Geländeform an Land', async () => {
  const { baueNetz } = await import('../web/js/people/netz.js');
  try {
    for (const F of FORMEN) {
      formSetzen(F.nr);
      for (const st of [1, 3, 5]) {
        const reg = REGIONEN.ostsee;
        const istLand = (x, y) => punkt(x, y, st, reg).h > 0.05;
        const netz = baueNetz({ hafen: HAFEN, stufe: st, gebaeude: [], istLand });
        for (const i of netz.duenen) {
          const n = netz.nodes[i];
          assert.ok(istLand(n.x, n.y), `Form ${F.nr} Stufe ${st}: Dünenweg bei (${n.x}, ${n.y}) im Wasser`);
        }
        for (const z of netz.ziele.filter((z) => z.art === 'strand')) {
          const n = netz.nodes[z.node];
          assert.ok(istLand(n.x, n.y), `Form ${F.nr} Stufe ${st}: Strandplatz bei (${n.x.toFixed(0)}, ${n.y.toFixed(0)}) im Wasser`);
        }
      }
    }
  } finally { formSetzen(1); }
});

test('Viele Seeds je Küstentyp: Fahrwasser, Wartebojen, Liegeplätze und Leuchttürme passen', () => {
  // Jeder Seed muss spielbar sein. Im Test ein paar Seeds je Typ, tools/seeds-pruefen.mjs prüft Tausende.
  const reg = REGIONEN.ostsee;
  try {
    for (const F of FORMEN) for (const seed of [2, 3, 17, 4242]) {
      formSetzen(F.nr, seed);
      for (const st of [1, 3, 5, 6]) {
        for (const [px, py] of festePunkte(st).fahrwasser) assert.ok(-punkt(px, py, st, reg).h >= (st <= 2 ? 1.6 : 3), `Typ ${F.nr} Seed ${seed} Stufe ${st}: Fahrwasser flach bei ${px},${py}`);
        for (const b of warteplaetze(st).bojen) assert.ok(-punkt(b.px, b.py, st, reg).h > 1.2, `Typ ${F.nr} Seed ${seed} Stufe ${st}: Boje ${b.id} zu flach`);
      }
      for (const p of HAFEN.plaetze) for (const [st, l] of Object.entries(p.lage)) {
        const soll = p.tiefe?.[st];
        if (soll == null) continue;
        assert.ok(-punkt(l[0], l[1], Number(st), reg).h >= soll - 0.4, `Typ ${F.nr} Seed ${seed}: ${p.id} Stufe ${st} zu flach`);
      }
      for (const [x, y] of leuchttuerme()) assert.ok(punkt(x, y, 3, reg).h > 0.3, `Typ ${F.nr} Seed ${seed}: Leuchtturm bei ${x},${y} im Wasser`);
    }
  } finally { formSetzen(1); }
});

test('Strandkörbe stehen nur auf ebenem, trockenem Sand, die Seebrücke führt vom Sandufer ins freie Wasser', async () => {
  const { strandStelle } = await import('../web/js/render/landschaft/natur.js');
  const { natur } = await import('../web/js/render/landschaft/formen.js');
  const NASS = ['wasser', 'watt', 'fels', 'kliff', 'schilfrand', 'salzwiese', 'mole', 'pflaster', 'weg', 'steinschuettung', 'waldboden'];
  let koerbe = 0, bruecken = 0;
  try {
    for (const f of FORMEN) {
      for (const seed of [1, 7, 99]) {
        formSetzen(f.nr, seed);
        const N = natur();
        for (const stufe of [1, 3]) {
          const boden = (x, y) => punkt(x, y, stufe, REGIONEN.ostsee);
          const wo = `Form ${f.nr} Seed ${seed} Stufe ${stufe}`;
          const sb = strandStelle(N, -170, 216, { seebruecke: true, laenge: 85, boden, stufe });
          const kb = strandStelle(N, -14, -8, { meiden: sb ? [sb] : [], boden, stufe });
          if (kb) {
            koerbe++;
            const hs = [[0, 0], [14, 0], [0, -6], [14, -6], [7, -3]].map(([dx, dy]) => boden(kb[0] + dx, kb[1] + dy));
            for (const q of hs) assert.ok(!NASS.includes(q.typ) && q.h >= 0.2, `${wo}: Strandkorb auf ${q.typ} (${q.h.toFixed(2)} m)`);
            assert.equal(boden(kb[0], kb[1]).typ, 'sand', `${wo}: Strandkörbe nicht auf Sand`);
            assert.ok(Math.max(...hs.map((q) => q.h)) - Math.min(...hs.map((q) => q.h)) < 0.8, `${wo}: Strandkörbe am Hang`);
            assert.ok(!['fels', 'kliff', 'wald'].includes(N.stil.ufer), `${wo}: Strandkörbe an einer Küste ohne Strand (${N.stil.ufer})`);
          }
          if (sb) {
            bruecken++;
            const [x, y, w] = sb, ex = -Math.sin(w), ey = Math.cos(w);
            assert.equal(boden(x, y).typ, 'sand', `${wo}: Seebrücke beginnt nicht auf Sand`);
            for (let t = 8; t <= 85; t += 5) {
              const q = boden(x + ex * t, y + ey * t);
              assert.ok((q.typ === 'wasser' || q.typ === 'watt') && q.h < 0, `${wo}: Seebrücke kreuzt ${q.typ} nach ${t} Einheiten`);
            }
          }
        }
      }
    }
  } finally { formSetzen(1, 1); }
  assert.ok(koerbe >= 4 && bruecken >= 4, `zu wenige Strände gefunden (${koerbe} Körbe, ${bruecken} Brücken)`);
});

test('Am Hafen ist der Küstentyp zu sehen: neben den Stegen und in der Nähe unterscheidet sich die Natur', async () => {
  const { bauen, TYPEN } = await import('../web/js/render/landschaft/natur.js');
  // Muster aus Land, Watt und Wasser im Ausschnitt der Startansicht (x -330..330, y -120..260), je Typ und Seed
  const muster = (N) => {
    let s = '';
    for (let y = -120; y <= 260; y += 20) {
      for (let x = -330; x <= 330; x += 20) {
        const q = N.probe(x, y);
        s += q.L > 0 ? '1' : q.stil.watt && -q.d < q.stil.watt * 0.6 ? 'w' : '0';
      }
    }
    return s;
  };
  const verschieden = (a, b) => [...a].filter((c, i) => c !== b[i]).length / a.length;
  for (const seed of [1, 99]) {
    const m = TYPEN.map((t) => muster(bauen(t.nr, seed)));
    for (let i = 0; i < m.length; i++) for (let j = i + 1; j < m.length; j++) {
      assert.ok(verschieden(m[i], m[j]) > 0.04, `Seed ${seed}: Typ ${i + 1} und ${j + 1} sehen am Hafen fast gleich aus`);
    }
  }
  // Inselhafen: hinter dem Ort liegt Wasser (Sund)
  for (const seed of [1, 7, 99, 4242]) {
    const N = bauen(10, seed);
    let sund = false;
    for (let y = -130; y >= -500 && !sund; y -= 10) sund = N.landig(0, y) < 0;
    assert.ok(sund, `Inselhafen Seed ${seed}: kein Wasser hinter dem Ort`);
  }
});
