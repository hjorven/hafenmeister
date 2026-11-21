// Tests für die Menschen im Hafen: Wegenetz (web/js/people/netz.js) und Crew-Zahlen (web/js/people/crew.js).
// Ausführen im Repo-Ordner:  node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { baueNetz } from '../web/js/people/netz.js';
import { crewFuer, figurenFuer } from '../web/js/people/crew.js';
import { HAFEN } from '../web/js/data/harbor.js';
import { CREW_STANDARD, EINZELN_BIS, MAX_FIGUREN } from '../web/js/data/people.js';

import { FORMEN, formSetzen } from '../web/js/render/landschaft/formen.js';
import { punkt } from '../web/js/render/landschaft/gelaende.js';
import { REGIONEN } from '../web/js/render/landschaft/regionen.js';

// Gebäude wie in web/js/render/buildings.js (Planeinheiten), Auswahl, mit Grundriss
const GEB = [
  { id: 'toilette', art: 'toilette', x: -95, y: -32, box: [-99, -36, -91, -28] },
  { id: 'kiosk', art: 'kiosk', x: -36, y: -30, box: [-40, -34, -32, -26] },
  { id: 'restaurant', art: 'restaurant', x: 48, y: -34, halbBreite: 13, box: [36, -42, 60, -26] },
  { id: 'haus-1', art: 'wohnhaus', x: -150, y: -46, box: [-157, -51, -143, -41] },
  { id: 'seebruecke', art: 'seebruecke', x: -170, y: 216 },
];
const BODEN = new Set(['land', 'sand']);
const reg = REGIONEN.ostsee;

// Jede gerade Strecke zwischen zwei Bodenknoten: alle 1,5 Einheiten trockenes Land, nicht in einem Grundriss
function strecheFehler(netz, pfad, stufe, boxen) {
  for (let i = 1; i < pfad.length; i++) {
    const a = netz.nodes[pfad[i - 1]], b = netz.nodes[pfad[i]];
    if (!BODEN.has(a.art) || !BODEN.has(b.art)) continue;
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    for (let q = 0; q <= l; q += 1.5) {
      const x = a.x + (b.x - a.x) * q / l, y = a.y + (b.y - a.y) * q / l;
      if (punkt(x, y, stufe, reg).h < 0.05) return `Wasser bei (${x.toFixed(0)}, ${y.toFixed(0)})`;
      const im = boxen.find(([x0, y0, x1, y1]) => x > x0 && x < x1 && y > y0 && y < y1);
      if (im) return `durch ein Gebäude bei (${x.toFixed(0)}, ${y.toFixed(0)})`;
    }
  }
  return null;
}

for (const stufe of [1, 2, 3, 4, 5, 6]) {
  test(`Stufe ${stufe}: jeder Liegeplatz am Land hat einen Weg zu einem echten Ziel und zurück`, () => {
    formSetzen(1, 1);
    const netz = baueNetz({ hafen: HAFEN, stufe, gebaeude: GEB });
    const anzahl = HAFEN.plaetze.filter((p) => p.lage[String(stufe)]).length;
    assert.equal(netz.plaetze.size, anzahl);
    let mitWeg = 0;
    for (const [id, p] of netz.plaetze) {
      const ziele = netz.ziele.filter((z) => z.art !== 'aussicht' && netz.komp[z.node] === netz.komp[p.node]);
      if (netz.komp[p.einstieg] !== netz.flaechen.festland) continue;   // Seepiers der Stufe 6 ohne Land
      assert.ok(ziele.length > 0, `${id} erreicht kein Ziel`);
      const hin = netz.weg(p.node, ziele[0].node);
      const zurueck = netz.weg(ziele[0].node, p.node);
      assert.ok(hin && zurueck, `${id}: kein Weg`);
      // Boote anderer Plätze werden nicht als Abkürzung benutzt
      assert.ok(hin.slice(1).every((n) => netz.nodes[n].art !== 'boot'), `${id}: Weg über ein fremdes Boot`);
      mitWeg++;
    }
    assert.ok(mitWeg >= Math.min(anzahl, 6), `nur ${mitWeg} Plätze mit Weg an Land`);
    assert.ok(netz.zuhause.filter((z) => netz.komp[z] === netz.flaechen.festland).length >= 3, 'Spaziergänger ohne Zuhause');
  });
}

test('In jeder Küstenform: Wege nur über trockenes Land, nie durch Gebäude, Ziele erreichbar', () => {
  const boxen = GEB.filter((g) => g.box).map((g) => g.box);
  const fehler = [];
  try {
    for (const F of FORMEN) {
      formSetzen(F.nr, 1);
      for (const stufe of [1, 6]) {
        const netz = baueNetz({ hafen: HAFEN, stufe, gebaeude: GEB });
        const fest = netz.flaechen.festland;
        const ziele = netz.ziele.filter((z) => ['toilette', 'kiosk', 'restaurant'].includes(z.art) && netz.komp[z.node] === fest);
        if (!ziele.length) { fehler.push(`Form ${F.nr} Stufe ${stufe}: Toilette und Kiosk nicht erreichbar`); continue; }
        const starts = [...netz.plaetze.values()].filter((p) => netz.komp[p.node] === fest).filter((_, i) => i % 4 === 0).map((p) => p.node)
          .concat(netz.zuhause.filter((z) => netz.komp[z] === fest).slice(0, 4));
        if (starts.length < 3) fehler.push(`Form ${F.nr} Stufe ${stufe}: kaum Plätze am Land`);
        for (const s of starts) for (const z of ziele) {
          const w = netz.weg(s, z.node);
          if (!w) { fehler.push(`Form ${F.nr} Stufe ${stufe}: kein Weg zu ${z.art}`); continue; }
          const f = strecheFehler(netz, w, stufe, boxen);
          if (f) fehler.push(`Form ${F.nr} Stufe ${stufe} zu ${z.art}: ${f}`);
        }
        // Strand auf Sand an Land, Badestelle im flachen Wasser
        for (const z of netz.ziele) {
          const n = netz.nodes[z.node], h = punkt(n.x, n.y, stufe, reg).h;
          if (z.art === 'strand' && h < 0.05) fehler.push(`Form ${F.nr} Stufe ${stufe}: Strandplatz im Wasser`);
          if (z.art === 'baden' && (h > 0 || h < -1.8)) fehler.push(`Form ${F.nr} Stufe ${stufe}: Badestelle nicht im flachen Wasser (${h.toFixed(1)} m)`);
        }
        for (const d of netz.duenen) {
          const n = netz.nodes[d];
          if (punkt(n.x, n.y, stufe, reg).h < 0.05) fehler.push(`Form ${F.nr} Stufe ${stufe}: Strandzugang im Wasser`);
        }
      }
    }
  } finally { formSetzen(1, 1); }
  assert.deepEqual(fehler.slice(0, 12), []);
});

test('Einstieg liegt dicht am Boot (am eigenen Steg)', () => {
  formSetzen(1, 1);
  const netz = baueNetz({ hafen: HAFEN, stufe: 4, gebaeude: GEB });
  for (const [id, p] of netz.plaetze) {
    const e = netz.nodes[p.einstieg];
    const d = Math.hypot(e.x - p.x, e.y - p.y) * 0.62;
    assert.ok(d < 20, `${id}: Einstieg ${d.toFixed(1)} m vom Boot`);
  }
});

test('Nur gebaute Stege im Netz: ungebaute Stege und Plätze fehlen (gebaut aus game.stege.gebaut())', () => {
  formSetzen(1);
  const st = HAFEN.stufen['3'];
  // Steg C steht noch nicht, Steg B nur zur Hälfte
  const b = st.stege.find((l) => l.steg === 'B');
  const [bx0, by0] = b.punkte[0], [bx1, by1] = b.punkte[1];
  const halb = [(bx0 + bx1) / 2, (by0 + by1) / 2];
  const stege = [
    ...st.stege.filter((l) => l.steg && l.steg !== 'C' && l.steg !== 'B'),
    { ...b, punkte: [b.punkte[0], halb] },
  ];
  const plaetze = new Set(HAFEN.plaetze.filter((p) => p.lage['3'] && p.steg === 'A').map((p) => p.id));
  const alles = baueNetz({ hafen: HAFEN, stufe: 3, gebaeude: GEB });
  const netz = baueNetz({ hafen: HAFEN, stufe: 3, gebaeude: GEB, gebaut: { stege, plaetze } });
  const aufSteg = (n) => ['holz', 'schwimmsteg', 'kai', 'pier'].includes(n.art);
  const c = st.stege.filter((l) => l.steg === 'C').flatMap((l) => l.punkte);
  const cx0 = Math.min(...c.map((p) => p[0])) - 3, cx1 = Math.max(...c.map((p) => p[0])) + 3;
  const beiC = (n) => aufSteg(n) && n.x >= cx0 && n.x <= cx1 && n.y > 12;
  assert.ok(alles.nodes.some(beiC), 'ohne gebaut liegt Steg C im Netz');
  assert.equal(netz.nodes.filter(beiC).length, 0, 'Knoten auf dem ungebauten Steg C');
  // Steg B endet an der Hälfte: kein Knoten dahinter
  const hinterHalb = (n) => aufSteg(n) && Math.abs(n.x - bx0) < 3 && n.y > halb[1] + 1 && n.y <= by1 + 1;
  assert.ok(alles.nodes.some(hinterHalb), 'ohne gebaut reicht Steg B bis zum Ende');
  assert.equal(netz.nodes.filter(hinterHalb).length, 0, 'Knoten hinter dem gebauten Ende von Steg B');
  assert.deepEqual([...netz.plaetze.keys()].filter((id) => !plaetze.has(id)), [], 'nur gebaute Plätze');
  assert.ok(netz.plaetze.size > 0 && netz.plaetze.size < alles.plaetze.size);
  // Die Aussicht liegt am gebauten Ende, nicht am Kopf des geplanten Stegs
  for (const z of netz.ziele.filter((q) => q.art === 'aussicht')) assert.ok(!beiC(netz.nodes[z.node]) && !hinterHalb(netz.nodes[z.node]));
});

test('Wege werden gerade gezogen, bleiben aber auf dem Weg', () => {
  formSetzen(1, 1);
  const netz = baueNetz({ hafen: HAFEN, stufe: 3, gebaeude: GEB });
  const kiosk = netz.ziele.find((z) => z.art === 'kiosk');
  const toilette = netz.ziele.find((z) => z.art === 'toilette');
  const w = netz.weg(kiosk.node, toilette.node);
  assert.ok(w && w.length <= 6, `Weg Kiosk - Toilette hat ${w?.length} Knoten`);
});

test('Crew aus den Schiffsdaten, sonst Standard je Größe', () => {
  assert.deepEqual(crewFuer({ groesse: 'L', art: 'L1' }), [2, 6]);
  assert.deepEqual(crewFuer({ groesse: 'M', art: 'M3' }), [2, 5]);
  assert.deepEqual(crewFuer({ groesse: 'XXL' }), CREW_STANDARD.xxl);
  assert.deepEqual(crewFuer({ groesse: 'S', art: 'gibtsnicht' }), CREW_STANDARD.s);
});

test('große Schiffe werden gebündelt, nie mehr als die Höchstzahl', () => {
  assert.equal(figurenFuer(3), 3);
  assert.equal(figurenFuer(EINZELN_BIS), EINZELN_BIS);
  assert.ok(figurenFuer(200) < 60);
  assert.ok(MAX_FIGUREN <= 300);
});

for (const stufe of [1, 3, 5]) {
  test(`Stufe ${stufe}: Badegäste erreichen von den Strandzugängen Strand und Badestelle`, () => {
    formSetzen(1, 1);
    const netz = baueNetz({ hafen: HAFEN, stufe, gebaeude: GEB });
    assert.ok(netz.duenen.length > 5);
    const nehrung = netz.flaechen.nehrung;
    const strand = netz.ziele.filter((z) => z.art === 'strand' && netz.komp[z.node] === nehrung);
    const baden = netz.ziele.filter((z) => z.art === 'baden' && netz.komp[z.node] === nehrung);
    assert.ok(strand.length >= 8, `nur ${strand.length} Strandplätze`);
    assert.ok(baden.length >= 8);
    const zugang = netz.duenen.filter((d) => netz.komp[d] === nehrung);
    for (const z of [...strand, ...baden]) assert.ok(netz.weg(zugang[0], z.node), 'kein Weg zum Strand');
    // Wasserknoten sind Sackgassen: kein Weg führt durchs Wasser
    for (const z of strand.slice(0, 5)) {
      const w = netz.weg(zugang[Math.min(3, zugang.length - 1)], z.node);
      assert.ok(w.every((n) => netz.nodes[n].art !== 'wasser'));
    }
  });
}
