// Vorbeifahrende Boote (web/js/render/boats/verkehr.js): Bahnen liegen im Wasser und halten Abstand
// zu Wartebojen, Ankerflächen, Molen, Buhnen und Liegeplätzen. Ohne Grafik.
// Ausführen im Repo-Ordner:  node --test tests/verkehr.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { SEEBAHNEN, SEE_RUNDE, UFER, FLOTTE } from '../web/js/render/boats/verkehr.js';
import { gelaendeAbfrage, warteplaetze, molen, buhnen, PLAN_M } from '../web/js/render/landschaft/gelaende.js';
import { region } from '../web/js/render/landschaft/regionen.js';
import { plaetzeInStufe, platzInWelt } from '../web/js/data/harbor.js';
import { MODELS as S } from '../web/js/data/boats/s.js';
import { MODELS as M } from '../web/js/data/boats/m.js';
import { MODELS as L } from '../web/js/data/boats/l.js';
import { MODELS as XL } from '../web/js/data/boats/xl.js';
import { MODELS as XXL } from '../web/js/data/boats/xxl.js';

const R = region('ostsee');
const segAbstand = (px, py, [ax, ay], [bx, by]) => {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
};
const bahnenVon = (st) => SEEBAHNEN[st >= 6 ? 6 : st >= 5 ? 5 : st >= 3 ? 3 : 1];
const superellipse = (r, inset, n = 240) => Array.from({ length: n }, (_, i) => {
  const a = (i / n) * 2 * Math.PI, f = (c) => Math.sign(c) * Math.abs(c) ** 0.5;
  return [r.cx + (r.rx - inset) * f(Math.cos(a)), r.cy + (r.ry - inset) * f(Math.sin(a))];
});
function punkteAuf(pts, schritt = 4) {
  const out = [];
  for (let k = 1; k < pts.length; k++) {
    const [ax, ay] = pts[k - 1], [bx, by] = pts[k];
    const n = Math.ceil(Math.hypot(bx - ax, by - ay) / schritt);
    for (let j = 0; j <= n; j++) out.push([ax + ((bx - ax) * j) / n, ay + ((by - ay) * j) / n]);
  }
  return out;
}
// Mindestabstände in Metern
function pruefe(st, punkte, name, { tiefe = 1, boje = 14, anker = 6, mole = 6, platz = 18 } = {}) {
  const g = gelaendeAbfrage(st, R);
  const w = warteplaetze(st);
  const plaetze = plaetzeInStufe(st).map((p) => platzInWelt(p, st));
  const linien = [...molen(st).map((m) => m.punkte), ...buhnen(st)];
  for (const [px, py] of punkte) {
    if (py > 640) continue;                           // weit draußen, außerhalb jeder Ansicht
    const x = px * PLAN_M, z = -py * PLAN_M;
    const wo = `${name} Stufe ${st} bei (${px.toFixed(0)}, ${py.toFixed(0)})`;
    assert.ok(g.tiefeBei(x, z) >= tiefe, `${wo}: zu flach`);
    for (const b of w.bojen) assert.ok(Math.hypot(b.x - x, b.z - z) >= boje, `${wo}: zu nah an Boje ${b.id}`);
    for (const a of w.ankerbereiche) assert.ok(Math.hypot(a.x - x, a.z - z) - a.radiusM >= anker, `${wo}: in Ankerfläche ${a.id}`);
    for (const l of linien) for (let i = 1; i < l.length; i++) assert.ok(segAbstand(px, py, l[i - 1], l[i]) * PLAN_M >= mole, `${wo}: zu nah an Mole oder Buhne`);
    for (const p of plaetze) assert.ok(Math.hypot(p.x - x, p.z - z) >= platz, `${wo}: zu nah an einem Liegeplatz`);
  }
}

test('Seebahnen liegen im Wasser und halten Abstand, Stufe 1 bis 6', () => {
  for (const st of [1, 2, 3, 4, 5, 6]) {
    bahnenVon(st).forEach((b, i) => pruefe(st, punkteAuf(b.pts), `Seebahn ${i} (${b.art})`, { tiefe: b.art === 'gross' ? 3 : 1.5 }));
  }
});

test('Runden auf dem Binnensee und Paddler am Ufer, Stufe 1 und 2', () => {
  for (const st of [1, 2]) {
    for (const inset of [0, 7, 14]) pruefe(st, superellipse(SEE_RUNDE[st], inset), `See-Runde ${inset}`, { tiefe: 0.8, platz: 25 });
    const u = UFER[st];
    pruefe(st, punkteAuf([[u.x0, u.y], [u.x1, u.y]]), 'Ufer', { tiefe: 0.6, boje: 14, platz: 6 });
  }
});

test('Alle Modelle der Flotte gibt es in den Bootsdaten', () => {
  const ids = new Set([...S, ...M, ...L, ...XL, ...XXL].map((m) => m.id));
  const alle = [...FLOTTE.ufer, ...FLOTTE.see, ...Object.values(FLOTTE.klein).flat(), ...Object.values(FLOTTE.gross).flat()];
  for (const id of alle) assert.ok(ids.has(id), `${id} fehlt`);
});
