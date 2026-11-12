// Sprite-Zeichner: macht aus einem 3D-Modell ein gezeichnetes Pixel-Sprite, kein Filter.
// Statt das beleuchtete 3D-Bild auf die Palette zu runden, liest er je Pixel nur drei Dinge aus:
// welches Teil (Farbe des Modells), welche Flaechenrichtung und wie weit weg. Daraus setzt er
// die Pixel nach festen Regeln, wie man sie von Hand setzen wuerde:
//   - jede Modellfarbe bekommt eine eigene Rampe aus der Palette (Schatten, Grund, Licht, Umriss)
//   - Licht kommt fest von Suedwest oben; je Flaeche genau eine von drei Stufen, keine Verlaeufe
//   - Einzelpixel und Flecken werden entfernt, Flaechen bleiben ruhig
//   - aussen ein geschlossener 1-Pixel-Umriss in der dunkelsten Farbe des Teils
//   - innen eine Kante, wo ein Teil vor einem anderen liegt
//   - Masten, Leinen und duenne Teile bleiben 1 Pixel breit und deckend
import { hexToRgb, oklab } from './palette.js';

const LICHT = [-0.42, 0.78, 0.46];   // Richtung zur Sonne (Welt), wie im Spiel von Suedwest oben
const len = Math.hypot(...LICHT);
LICHT.forEach((v, i) => { LICHT[i] = v / len; });

// Rampe fuer eine Modellfarbe: [Umriss, Schatten, Grund, Licht] als [r, g, b].
// Wie von Hand: Schatten dunkler und kuehler (Richtung Blau), Licht heller und waermer,
// Umriss sehr dunkel und entsaettigt. Gleiche Modellfarbe ergibt ueberall dieselbe Rampe,
// darum passen alle Schiffe zusammen.
function zuRgb([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return lin.map((v) => {
    v = Math.max(0, Math.min(1, v));
    return Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055));
  });
}
const rampenCache = new Map();
export function rampe(r, g, b) {
  const key = (r << 16) | (g << 8) | b;
  if (rampenCache.has(key)) return rampenCache.get(key);
  const [L, A, B] = oklab(r / 255, g / 255, b / 255);
  const c = Math.hypot(A, B);
  const sat = c > 0.02 ? 1.12 : 1;     // Farbiges etwas kraeftiger, Grau bleibt grau
  const grund = [L, A * sat, B * sat];
  const licht = [Math.min(0.99, L + 0.085), A * sat * 0.95, B * sat * 0.95 + 0.012];
  const schatten = [Math.max(0.16, L - 0.13), A * sat * 1.05 - 0.004, B * sat * 1.05 - 0.032];
  const umriss = [Math.max(0.13, Math.min(0.27, L * 0.35)), A * 0.45 + 0.004, B * 0.45 - 0.03];
  const out = [umriss, schatten, grund, licht].map(zuRgb);
  rampenCache.set(key, out);
  return out;
}

const VERT = /* glsl */`
  varying vec3 vWelt;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWelt = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
// Teilnummer (bis 65535) in r/g, Linien-Kennung in b
const FRAG_ID = /* glsl */`
  uniform vec3 uId;
  void main() { gl_FragColor = vec4(uId, 1.0); }
`;
// Flaechenrichtung aus den Ableitungen (eine Richtung je Dreieck) und Tiefe
const FRAG_N = /* glsl */`
  varying vec3 vWelt;
  uniform float uLinie;
  void main() {
    vec3 n = normalize(cross(dFdx(vWelt), dFdy(vWelt)));
    if (uLinie > 0.5) n = vec3(0.0, 1.0, 0.0);
    if (!gl_FrontFacing) n = n;   // Richtung kommt aus den Ableitungen, Vorder-/Rueckseite egal
    gl_FragColor = vec4(n * 0.5 + 0.5, gl_FragCoord.z);
  }
`;

export function createSpriteZeichner(THREE, renderer) {
  let rtId = null, rtN = null;
  const ziele = (w, h) => {
    if (rtId && rtId.width === w && rtId.height === h) return;
    rtId?.dispose(); rtN?.dispose();
    rtId = new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    rtN = new THREE.WebGLRenderTarget(w, h, { type: THREE.FloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  };

  // Teile sammeln: jede Modellfarbe ist ein Teil
  function teile(obj) {
    const liste = [];
    const nachFarbe = new Map();
    obj.traverse((o) => {
      if (!(o.isMesh || o.isLine) || !o.visible) return;
      let p = o; let sichtbar = true;
      for (; p && p !== obj.parent; p = p.parent) if (!p.visible) { sichtbar = false; break; }
      if (!sichtbar) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const ids = mats.map((m) => {
        const c = m?.color ? '#' + m.color.getHexString(THREE.SRGBColorSpace) : '#888888';
        if (m && (m.opacity ?? 1) < 0.05) return null;   // unsichtbare Hilfsflaechen
        if (!nachFarbe.has(c)) { nachFarbe.set(c, nachFarbe.size + 1); }
        return nachFarbe.get(c);
      });
      liste.push({ o, mats, ids, linie: !!o.isLine });
    });
    const farben = [null, ...nachFarbe.keys()].map((h) => (h ? hexToRgb(h) : null));
    return { liste, farben };
  }

  function mitMaterial(liste, mache, fn) {
    const alt = liste.map((t) => t.o.material);
    const cache = new Map();
    for (const t of liste) {
      const neu = t.ids.map((id) => {
        const key = id + (t.linie ? 'L' : 'M');
        if (!cache.has(key)) cache.set(key, mache(id ?? 0, t.linie));
        return id == null ? hidden : cache.get(key);
      });
      t.o.material = Array.isArray(t.o.material) ? neu : neu[0];
    }
    try { fn(); } finally {
      liste.forEach((t, i) => { t.o.material = alt[i]; });
      for (const m of cache.values()) m.dispose();
    }
  }
  const hidden = new THREE.MeshBasicMaterial({ visible: false });

  const szene = new THREE.Scene();

  // obj: Gruppe (Boot), Bugrichtung schon gesetzt. kamera: OrthographicCamera, die das Bild genau abdeckt.
  function zeichne(obj, kamera, w, h, { mitSchatten = true } = {}) {
    ziele(w, h);
    const { liste, farben } = teile(obj);
    const elternteil = obj.parent;
    szene.add(obj);
    const clear = renderer.getClearColor(new THREE.Color());
    const clearA = renderer.getClearAlpha();
    renderer.setClearColor(0x000000, 0);
    const id = new Uint8Array(w * h * 4);
    const nd = new Float32Array(w * h * 4);
    mitMaterial(liste, (n, linie) => new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG_ID, side: THREE.DoubleSide,
      uniforms: { uId: { value: new THREE.Vector3((n & 255) / 255, (n >> 8) / 255, linie ? 1 : 0) } },
    }), () => {
      renderer.setRenderTarget(rtId);
      renderer.clear();
      renderer.render(szene, kamera);
      renderer.readRenderTargetPixels(rtId, 0, 0, w, h, id);
    });
    mitMaterial(liste, (n, linie) => new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG_N, side: THREE.DoubleSide,
      uniforms: { uLinie: { value: linie ? 1 : 0 } },
    }), () => {
      renderer.setRenderTarget(rtN);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      renderer.render(szene, kamera);
      renderer.readRenderTargetPixels(rtN, 0, 0, w, h, nd);
    });
    // Schatten auf dem Wasser: dasselbe Modell, entlang des Sonnenlichts flach aufs Wasser gedrueckt
    const schattenMaske = new Uint8Array(w * h * 4);
    if (mitSchatten) {
      const huelle = new THREE.Group();
      huelle.matrixAutoUpdate = false;
      huelle.matrix.set(
        1, -LICHT[0] / LICHT[1], 0, 0,
        0, 0, 0, 0.005,
        0, -LICHT[2] / LICHT[1], 1, 0,
        0, 0, 0, 1,
      );
      szene.add(huelle);
      huelle.add(obj);
      huelle.updateMatrixWorld(true);
      mitMaterial(liste, () => new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: FRAG_ID, side: THREE.DoubleSide,
        uniforms: { uId: { value: new THREE.Vector3(1, 1, 1) } },
      }), () => {
        renderer.setRenderTarget(rtId);
        renderer.clear();
        renderer.render(szene, kamera);
        renderer.readRenderTargetPixels(rtId, 0, 0, w, h, schattenMaske);
      });
      szene.remove(huelle);
      szene.add(obj);
      obj.updateMatrixWorld(true);
    }
    renderer.setRenderTarget(null);
    renderer.setClearColor(clear, clearA);
    if (elternteil) elternteil.add(obj); else szene.remove(obj);

    // Kamerablick (zum Umdrehen von Rueckseiten-Normalen)
    const blick = new THREE.Vector3();
    kamera.getWorldDirection(blick);

    const N = w * h;
    const teil = new Int32Array(N);     // 0 = leer
    const linie = new Uint8Array(N);
    const stufe = new Int8Array(N);     // 1 Schatten, 2 Grund, 3 Licht
    const tiefe = new Float32Array(N);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const src = (h - 1 - y) * w + x;     // WebGL zaehlt von unten
        const i = y * w + x;
        if (id[src * 4 + 3] === 0) continue;
        teil[i] = id[src * 4] | (id[src * 4 + 1] << 8);
        linie[i] = id[src * 4 + 2] > 127 ? 1 : 0;
        let nx = nd[src * 4] * 2 - 1, ny = nd[src * 4 + 1] * 2 - 1, nz = nd[src * 4 + 2] * 2 - 1;
        // Flaechen, die von der Kamera weg zeigen, sieht man von hinten: Richtung umdrehen
        if (nx * blick.x + ny * blick.y + nz * blick.z > 0) { nx = -nx; ny = -ny; nz = -nz; }
        tiefe[i] = nd[src * 4 + 3];
        const l = nx * LICHT[0] + ny * LICHT[1] + nz * LICHT[2];
        stufe[i] = linie[i] ? 2 : l > 0.72 ? 3 : l > 0.2 ? 2 : 1;
      }
    }

    // Aufraeumen: ein Pixel, dessen Stufe keiner seiner gleichen Teil-Nachbarn hat, uebernimmt die haeufigste
    for (let runde = 0; runde < 2; runde++) {
      const neu = stufe.slice();
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          if (!teil[i] || linie[i]) continue;
          const zaehl = [0, 0, 0, 0];
          let gleich = 0, nachbarn = 0;
          for (const j of [i - 1, i + 1, i - w, i + w]) {
            if (teil[j] !== teil[i]) continue;
            nachbarn++;
            zaehl[stufe[j]]++;
            if (stufe[j] === stufe[i]) gleich++;
          }
          if (nachbarn >= 2 && gleich === 0) neu[i] = zaehl.indexOf(Math.max(...zaehl));
        }
      }
      stufe.set(neu);
    }

    const out = new Uint8ClampedArray(N * 4);
    const setze = (i, c) => { out[i * 4] = c[0]; out[i * 4 + 1] = c[1]; out[i * 4 + 2] = c[2]; out[i * 4 + 3] = 255; };
    const schwelle = 0.0025;   // Tiefensprung fuer Innenkanten (Tiefenpuffer 0..1)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (teil[i]) {
          const r = rampe(...farben[teil[i]]);
          let s = stufe[i];
          // Innenkante: ein anderes Teil liegt direkt davor (naeher) -> dieses Pixel wird Kante
          let kante = false;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const xx = x + dx, yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
            const j = yy * w + xx;
            if (teil[j] && teil[j] !== teil[i] && tiefe[j] < tiefe[i] - schwelle && !linie[j]) kante = true;
          }
          setze(i, kante ? r[Math.max(0, s - 1)] : r[s]);
          continue;
        }
        // Aussenumriss: leeres Pixel neben einem Teil
        let best = 0, bt = Infinity;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const j = yy * w + xx;
          if (teil[j] && !linie[j] && tiefe[j] < bt) { bt = tiefe[j]; best = teil[j]; }
        }
        if (best) { setze(i, rampe(...farben[best])[0]); continue; }
        // Schatten: eine dunkle, halb durchsichtige Wasserfarbe, ohne Verlauf
        if (schattenMaske[((h - 1 - y) * w + x) * 4 + 3] > 0) {
          out[i * 4] = 18; out[i * 4 + 1] = 52; out[i * 4 + 2] = 66; out[i * 4 + 3] = 110;
        }
      }
    }
    return new ImageData(out, w, h);
  }

  return { zeichne };
}
