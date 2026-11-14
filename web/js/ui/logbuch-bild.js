// Bilder für das Logbuch (P21): jedes Bootsmodell als kleines Pixelbild, aus dem echten 3D-Modell
// gerendert (game.boatTypes.<größe>.buildBoat), schräg von der Seite, Bug nach rechts. Fehlende Modelle
// zeigen denselben Umriss als Schattenriss. Ohne WebGL gibt es den Umriss von oben aus ui/vorschau.js.
//
// bildMaler(game) -> { bild(modell, { schatten }) -> Promise<{ src, w, h }>, leeren() }
// Gerendert wird in einen kleinen Zwischenspeicher (W x H Pixel, ohne Kantenglättung), danach bekommt das
// Bild einen Tintenrand wie die Pixel-Symbole. Je Bild ein paar Millisekunden, verteilt auf mehrere Bilder.

import * as THREE from 'three';
import { umrissRaster, bootArt } from './vorschau.js';

export const BILD = { w: 84, h: 44 };

const TINTE = [36, 54, 74];            // --hm-tinte
const SCHATTEN = [88, 104, 122];       // Schattenriss: etwas heller als die Tinte
const WASSER = [[86, 170, 196], [52, 132, 166]];

export function bildMaler(game) {
  const cache = new Map();             // `${id}|hell` / `${id}|schatten` -> { src, w, h }
  const roh = new Map();               // id -> ImageData (Farbe mit Alpha, vor dem Rand)
  const warteschlange = [];
  let laeuft = false;
  let szene = null, kamera = null, ziel = null, puffer = null, leinwand = null;

  function bereit() {
    const r = game.renderer;
    if (!r || typeof document === 'undefined') return false;
    if (szene) return true;
    szene = new THREE.Scene();
    szene.add(new THREE.HemisphereLight(0xffffff, 0x8a9aa8, 2.2));
    const sonne = new THREE.DirectionalLight(0xffffff, 2.4);
    sonne.position.set(4, 8, 6);
    szene.add(sonne);
    kamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 2000);
    ziel = new THREE.WebGLRenderTarget(BILD.w, BILD.h, { depthBuffer: true });
    ziel.texture.colorSpace = THREE.SRGBColorSpace;
    puffer = new Uint8Array(BILD.w * BILD.h * 4);
    leinwand = document.createElement('canvas');
    return true;
  }

  // Sichtbare Teile des Modells (Heckwelle und ausgeblendete Teile zählen nicht)
  function huelle(gruppe) {
    const box = new THREE.Box3();
    const tmp = new THREE.Box3();
    gruppe.updateMatrixWorld(true);
    gruppe.traverse((o) => {
      if (!o.isMesh && !o.isLine) return;
      for (let p = o; p; p = p.parent) if (!p.visible) return;
      if (!o.geometry) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
      box.union(tmp);
    });
    return box;
  }

  function baue(mo) {
    const t = game.boatTypes?.[String(mo.size).toLowerCase()];
    if (!t?.buildBoat) return null;
    const entry = t.MODELS?.find?.((m) => m.id === mo.id) ?? mo.id;
    try {
      return t.buildBoat(entry, { palette: 0, id: `logbuch-${mo.id}`, sails: false });
    } catch {
      return null;
    }
  }

  function rendere(mo) {
    const g = baue(mo);
    if (!g) return null;
    const wake = g.getObjectByName?.('wake');
    if (wake) wake.visible = false;
    szene.add(g);
    // Blick schräg von Steuerbord und von oben (Masten werden kürzer, der Rumpf größer): Bug zeigt nach rechts
    const blick = new THREE.Vector3(0.5, 0.75, 1).normalize();
    const box = huelle(g);
    box.min.y = Math.max(box.min.y, -0.02);          // unter Wasser schneiden wir ab
    const mitte = box.getCenter(new THREE.Vector3());
    const groesse = box.getSize(new THREE.Vector3()).length();
    kamera.position.copy(mitte).addScaledVector(blick, groesse * 2 + 10);
    kamera.up.set(0, 1, 0);
    kamera.lookAt(mitte);
    kamera.updateMatrixWorld(true);
    // Ecken der Hülle in Kamerarichtung: so eng wie möglich einrahmen, Seitenverhältnis halten
    const inv = kamera.matrixWorldInverse;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < 8; i++) {
      const v = new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).applyMatrix4(inv);
      x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
    }
    const rand = 1;                                    // Pixel frei für den Tintenrand
    const unten = 3;                                   // Pixel für das Wasser
    const sx = (x1 - x0) / (BILD.w - 2 * rand);
    const sy = (y1 - y0) / (BILD.h - 2 * rand - unten);
    const s = Math.max(sx, sy);
    const cx = (x0 + x1) / 2;
    const unterkante = y0 - (unten + rand) * s;         // Wasser unten, Boot steht darauf
    kamera.left = cx - (BILD.w / 2) * s;
    kamera.right = cx + (BILD.w / 2) * s;
    kamera.bottom = unterkante;
    kamera.top = unterkante + BILD.h * s;
    kamera.near = 0.1;
    kamera.far = groesse * 4 + 40;
    kamera.updateProjectionMatrix();

    const r = game.renderer;
    const vorherZiel = r.getRenderTarget();
    const vorherFarbe = r.getClearColor(new THREE.Color());
    const vorherAlpha = r.getClearAlpha();
    const vorherEbenen = r.clippingPlanes;
    const vorherToneMapping = r.toneMapping;
    try {
      r.setRenderTarget(ziel);
      r.setClearColor(0x000000, 0);
      r.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.02)];
      r.toneMapping = THREE.NoToneMapping;
      r.clear(true, true, true);
      r.render(szene, kamera);
      r.readRenderTargetPixels(ziel, 0, 0, BILD.w, BILD.h, puffer);
    } finally {
      r.setRenderTarget(vorherZiel);
      r.setClearColor(vorherFarbe, vorherAlpha);
      r.clippingPlanes = vorherEbenen;
      r.toneMapping = vorherToneMapping;
      szene.remove(g);
    }
    // Zeilen kommen von unten nach oben; harte Kante (Pixel ganz oder gar nicht)
    const d = new ImageData(BILD.w, BILD.h);
    for (let y = 0; y < BILD.h; y++) {
      for (let x = 0; x < BILD.w; x++) {
        const q = ((BILD.h - 1 - y) * BILD.w + x) * 4;
        const z = (y * BILD.w + x) * 4;
        if (puffer[q + 3] < 110) continue;
        d.data[z] = puffer[q]; d.data[z + 1] = puffer[q + 1]; d.data[z + 2] = puffer[q + 2]; d.data[z + 3] = 255;
      }
    }
    return d;
  }

  // Ersatz ohne WebGL: Umriss von oben (wie der Funk der Vorschau)
  function ersatz(mo) {
    const raster = umrissRaster(bootArt({ kind: mo.kind }, { sail: mo.sail, kind: mo.kind }), mo.length, mo.beam);
    const h = raster.length, w = raster[0].length;
    const farbe = { k: TINTE, w: [255, 250, 240], d: [201, 185, 148], m: TINTE };
    const d = new ImageData(w, h);
    raster.forEach((zeile, y) => [...zeile].forEach((c, x) => {
      if (c === '.' || c === 'k') return;
      const z = (y * w + x) * 4;
      const f = farbe[c] ?? TINTE;
      d.data[z] = f[0]; d.data[z + 1] = f[1]; d.data[z + 2] = f[2]; d.data[z + 3] = 255;
    }));
    return d;
  }

  // Tintenrand um das Boot, Wasserstrich darunter; als Schattenriss alles in einer Farbe
  function fertig(d, schatten, mitWasser) {
    const { width: w, height: h } = d;
    const out = new ImageData(w, h);
    const voll = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d.data[(y * w + x) * 4 + 3] > 0;
    let tiefste = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (voll(x, y)) tiefste = Math.max(tiefste, y);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const z = (y * w + x) * 4;
        let f = null;
        if (voll(x, y)) f = schatten ? SCHATTEN : [d.data[z], d.data[z + 1], d.data[z + 2]];
        else if (voll(x - 1, y) || voll(x + 1, y) || voll(x, y - 1) || voll(x, y + 1)) f = schatten ? null : TINTE;
        if (!f && mitWasser && !schatten && tiefste >= 0 && (y === tiefste + 1 || y === tiefste + 2)) {
          // Wasserlinie unter dem Rumpf, nur so breit wie das Boot (plus zwei Pixel)
          let breit = false;
          for (let dx = -2; dx <= 2 && !breit; dx++) breit = voll(x + dx, tiefste) || voll(x + dx, tiefste - 1);
          if (breit) f = WASSER[y - tiefste - 1];
        }
        if (!f) continue;
        out.data[z] = f[0]; out.data[z + 1] = f[1]; out.data[z + 2] = f[2]; out.data[z + 3] = 255;
      }
    }
    leinwand.width = w;
    leinwand.height = h;
    const c = leinwand.getContext('2d');
    c.putImageData(out, 0, 0);
    return { src: leinwand.toDataURL('image/png'), w, h };
  }

  function arbeite() {
    const start = performance.now();
    while (warteschlange.length && performance.now() - start < 12) {
      const { mo, schatten, fertigDann } = warteschlange.shift();
      const schl = `${mo.id}|${schatten ? 's' : 'h'}`;
      if (cache.has(schl)) { fertigDann(cache.get(schl)); continue; }
      let d = roh.get(mo.id);
      let echt = true;
      if (!d) {
        d = (bereit() && rendere(mo)) || null;
        if (!d) { d = ersatz(mo); echt = false; }
        else if (![...d.data].some((v, i) => i % 4 === 3 && v)) { d = ersatz(mo); echt = false; }
        roh.set(mo.id, d);
      } else echt = d.width === BILD.w;
      if (!leinwand) leinwand = document.createElement('canvas');
      const b = fertig(d, schatten, echt);
      cache.set(schl, b);
      fertigDann(b);
    }
    if (warteschlange.length) requestAnimationFrame(arbeite);
    else laeuft = false;
  }

  /** Bild eines Modells (aus logbuch-daten katalog()). Gibt ein Promise auf { src, w, h }. */
  function bild(mo, { schatten = false } = {}) {
    const schl = `${mo.id}|${schatten ? 's' : 'h'}`;
    if (cache.has(schl)) return Promise.resolve(cache.get(schl));
    return new Promise((fertigDann) => {
      warteschlange.push({ mo, schatten, fertigDann });
      if (!laeuft) { laeuft = true; requestAnimationFrame(arbeite); }
    });
  }

  /** Sofort, falls schon gemalt (sonst null). */
  function schonDa(mo, { schatten = false } = {}) {
    return cache.get(`${mo.id}|${schatten ? 's' : 'h'}`) ?? null;
  }

  return { bild, schonDa, leeren: () => { cache.clear(); roh.clear(); } };
}
