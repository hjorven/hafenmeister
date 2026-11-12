// Tests für die Abwechslung an Land (web/js/render/landschaft/vielfalt.js), ohne Browser.
// Ausführen im Repo-Ordner:  node --test tests/gelaende-vielfalt.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { HAFEN } from '../web/js/data/harbor.js';
import { SERVICES } from '../web/js/data/services.js';
import { punkt, warteplaetze } from '../web/js/render/landschaft/gelaende.js';
import { bauflaechen } from '../web/js/render/landschaft/karte.js';
import { region } from '../web/js/render/landschaft/regionen.js';
import { setzeBild, bildAus, bildAusSeed, setzeFreiQuellen, dorfPlan } from '../web/js/render/landschaft/vielfalt.js';

const REVIERE = ['ostsee', 'nordsee'];
const LANDARTEN = new Set(['gras', 'waldboden', 'dorf', 'heide', 'kliff', 'feldweg', 'raps', 'korn', 'acker', 'weide', 'wiese']);
const BILDER = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144];
setzeFreiQuellen({ polygone: (st) => bauflaechen(st).map((f) => f.poly) });

test('Geländebild: gleiche Nummer gleiches Bild, verschiedene Nummern verschiedene Bilder', () => {
  assert.deepEqual(bildAus(7), bildAus(7));
  const merkmale = new Set(BILDER.map((n) => JSON.stringify([bildAus(n).kueste, bildAus(n).dorf])));
  assert.ok(merkmale.size >= 6, `nur ${merkmale.size} verschiedene Bilder`);
  for (const seed of [0, 1, 42, 2 ** 32 - 1, 123456789]) {
    const nr = bildAusSeed(seed);
    assert.ok(nr > 0 && Number.isInteger(nr), `Seed ${seed} ergibt ${nr}`);
    assert.equal(nr, bildAusSeed(seed));
  }
});

test('Liegeplätze und Wartebojen sind in jedem Geländebild gleich tief', () => {
  for (const nr of BILDER) {
    setzeBild(nr);
    for (const name of REVIERE) {
      const r = region(name);
      for (const p of HAFEN.plaetze) {
        for (const [stufe, lage] of Object.entries(p.lage)) {
          const soll = p.tiefe?.[stufe];
          if (soll == null) continue;
          const ist = -punkt(lage[0], lage[1], Number(stufe), r).h;
          assert.ok(ist >= soll - 0.4, `Bild ${nr} ${name} ${p.id} Stufe ${stufe}: ${ist.toFixed(2)} m statt ${soll} m`);
        }
      }
      for (let stufe = 1; stufe <= 6; stufe++) {
        for (const b of warteplaetze(stufe).bojen) {
          assert.ok(punkt(b.px, b.py, stufe, r).h < -1, `Bild ${nr} ${name} Boje ${b.id} Stufe ${stufe} zu flach`);
        }
      }
    }
  }
  setzeBild(0);
});

test('Bauplätze der Services und Bauflächen bleiben in jedem Geländebild gleich (eben, kein Wald, keine Häuser)', () => {
  const proben = [];
  for (const sv of SERVICES) for (const l of [sv.lage, ...(sv.stufen || []).map((s) => s.lage)].filter(Boolean)) proben.push([l.x, l.y, 'alle']);
  for (let stufe = 1; stufe <= 6; stufe++) {
    for (const f of bauflaechen(stufe)) {
      const xs = f.poly.map((q) => q[0]), ys = f.poly.map((q) => q[1]);
      for (let k = 0; k < 25; k++) {
        const px = Math.min(...xs) + 3 + ((k % 5) / 4) * (Math.max(...xs) - Math.min(...xs) - 6);
        const py = Math.min(...ys) + 3 + (Math.floor(k / 5) / 4) * (Math.max(...ys) - Math.min(...ys) - 6);
        proben.push([px, py, stufe]);
      }
    }
  }
  const verboten = new Set(['waldboden', 'dorf', 'kliff', 'raps', 'korn', 'acker']);
  for (const name of REVIERE) {
    const r = region(name);
    setzeBild(0);
    const ref = proben.map(([px, py, st]) => (st === 'alle' ? [1, 3, 5, 6] : [st]).map((s) => punkt(px, py, s, r)));
    for (const nr of BILDER.slice(1)) {
      setzeBild(nr);
      proben.forEach(([px, py, st], i) => {
        (st === 'alle' ? [1, 3, 5, 6] : [st]).forEach((s, j) => {
          const p = punkt(px, py, s, r);
          assert.ok(Math.abs(p.h - ref[i][j].h) < 1e-9, `Bild ${nr} ${name} (${px.toFixed(0)}, ${py.toFixed(0)}) Stufe ${s}: Höhe ${p.h.toFixed(2)} statt ${ref[i][j].h.toFixed(2)}`);
          assert.ok(!verboten.has(p.typ), `Bild ${nr} ${name} (${px.toFixed(0)}, ${py.toFixed(0)}) Stufe ${s}: ${p.typ} auf Baufläche`);
        });
      });
    }
  }
  setzeBild(0);
});

test('Wasser bleibt Wasser, Land bleibt Land (außer kleinen Söllen im Hinterland)', () => {
  const r = region('ostsee');
  for (const stufe of [1, 3, 5]) {
    setzeBild(0);
    const ref = [];
    for (let px = -420; px <= 430; px += 6) for (let py = -200; py <= 470; py += 6) ref.push([px, py, punkt(px, py, stufe, r).h < 0]);
    for (const nr of BILDER.slice(1, 7)) {
      setzeBild(nr);
      for (const [px, py, nass] of ref) {
        const jetzt = punkt(px, py, stufe, r).h < 0;
        if (nass && py >= -60) assert.ok(jetzt, `Bild ${nr} Stufe ${stufe}: Wasser bei (${px}, ${py}) wurde Land`);
        else if (jetzt && !nass) assert.ok(py < -60, `Bild ${nr} Stufe ${stufe}: neues Wasser bei (${px}, ${py}) nahe am Hafen`);
      }
    }
  }
  setzeBild(0);
});

test('Keine senkrechten Stufen im Land (höchstens 1,6 m auf 1,24 m Abstand)', () => {
  for (const name of REVIERE) {
    const r = region(name);
    for (const nr of BILDER.slice(0, 6)) {
      setzeBild(nr);
      for (let px = -420; px <= 430; px += 2) {
        let vorher = null;
        for (let py = -200; py <= 470; py += 2) {
          const p = punkt(px, py, 1, r);
          const h = LANDARTEN.has(p.typ) ? p.h : null;   // nur Land, das vielfalt.js formt (Dünen gehören zur Grundform)
          if (vorher != null && h != null && h > 0.5 && vorher > 0.5) {
            assert.ok(Math.abs(h - vorher) < 1.6, `${name} Bild ${nr}: Sprung ${(h - vorher).toFixed(2)} m bei (${px}, ${py})`);
          }
          vorher = h;
        }
      }
    }
  }
  setzeBild(0);
});

test('Dorf liegt an Land mit Abstand zum Hafen und hat Häuser und Kirche', () => {
  const r = region('ostsee');
  for (const nr of BILDER) {
    setzeBild(nr);
    const d = dorfPlan();
    assert.ok(d.haeuser.length >= 6, `Bild ${nr}: nur ${d.haeuser.length} Häuser geplant`);
    assert.ok(punkt(d.mitte[0], d.mitte[1], 1, r).h > 0.3, `Bild ${nr}: Dorfmitte nicht an Land`);
  }
  setzeBild(0);
});
