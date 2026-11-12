// Tests für das vereinfachte Geländenetz (web/js/render/landschaft/netz.js), ohne Browser.
// Ausführen im Repo-Ordner:  node --test tests/gelaendenetz.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { vereinfacheRaster } from '../web/js/render/landschaft/netz.js';

// Raster: links eben (Wiese), rechts Hügel, in der Mitte ein Streifen Strand
function raster(nx, ny) {
  const H = new Float32Array((nx + 1) * (ny + 1)), T = new Array(H.length);
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const k = j * (nx + 1) + i;
    H[k] = i < nx / 2 ? 1 : 1 + Math.sin(i * 0.7) * Math.cos(j * 0.5);
    T[k] = i === Math.floor(nx / 3) ? 'sand' : 'gras';
  }
  return { H, T };
}

test('ebene Flächen werden zu wenigen Dreiecken, Hügel bleiben fein', () => {
  const nx = 37, ny = 29;   // absichtlich keine Zweierpotenz
  const { H, T } = raster(nx, ny);
  const d = vereinfacheRaster(H, T, nx, ny, { unten: -0.15, toleranz: () => 0.03 });
  assert.equal(d.length % 3, 0);
  assert.ok(d.length / 3 < nx * ny * 2 * 0.75, `${d.length / 3} Dreiecke, voll wären ${nx * ny * 2}`);
});

test('keine Risse: jede innere Kante gehört zu genau zwei Dreiecken, gegenläufig', () => {
  const nx = 37, ny = 29;
  const { H, T } = raster(nx, ny);
  const d = vereinfacheRaster(H, T, nx, ny, { unten: -0.15, toleranz: () => 0.03 });
  const kanten = new Map();
  for (let k = 0; k < d.length; k += 3) {
    for (let e = 0; e < 3; e++) {
      const a = d[k + e], b = d[k + (e + 1) % 3];
      assert.notEqual(a, b, 'entartetes Dreieck');
      const s = `${a}>${b}`;
      kanten.set(s, (kanten.get(s) || 0) + 1);
    }
  }
  const W = nx + 1;
  const amRand = (p) => { const i = p % W, j = (p - i) / W; return i === 0 || j === 0 || i === nx || j === ny; };
  for (const [s, n] of kanten) {
    assert.equal(n, 1, `Kante ${s} doppelt`);
    const [a, b] = s.split('>').map(Number);
    if (!kanten.has(`${b}>${a}`)) assert.ok(amRand(a) && amRand(b), `offene Kante ${s} im Inneren`);
  }
});

test('Fläche bleibt gleich: vereinfachtes Netz deckt das ganze Raster ab', () => {
  const nx = 20, ny = 12;
  const { H, T } = raster(nx, ny);
  const d = vereinfacheRaster(H, T, nx, ny, { unten: -0.15, toleranz: () => 0.03 });
  const W = nx + 1;
  let flaeche = 0;
  for (let k = 0; k < d.length; k += 3) {
    const [a, b, c] = [d[k], d[k + 1], d[k + 2]].map((p) => [p % W, Math.floor(p / W)]);
    const f = ((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;
    assert.ok(f > 0, 'Dreieck falsch herum (muss von oben sichtbar sein)');
    flaeche += f;
  }
  assert.ok(Math.abs(flaeche - nx * ny) < 1e-9, `Fläche ${flaeche}, erwartet ${nx * ny}`);
});

test('Zellen ganz unter Wasser entfallen wie bisher', () => {
  const nx = 16, ny = 16;
  const H = new Float32Array(17 * 17).fill(-3), T = new Array(17 * 17).fill('watt');
  assert.equal(vereinfacheRaster(H, T, nx, ny, { unten: -0.15, toleranz: () => 0.03 }).length, 0);
});
