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
const helleCache = new Map();
function helligkeit([r, g, b]) {
  const key = (r << 16) | (g << 8) | b;
  let L = helleCache.get(key);
  if (L === undefined) { L = oklab(r / 255, g / 255, b / 255)[0]; helleCache.set(key, L); }
  return L;
}

export function rampe(r, g, b) {
  const key = (r << 16) | (g << 8) | b;
  if (rampenCache.has(key)) return rampenCache.get(key);
  const [L, A, B] = oklab(r / 255, g / 255, b / 255);
  const c = Math.hypot(A, B);
  const sat = c > 0.02 ? 1.12 : 1;     // Farbiges etwas kraeftiger, Grau bleibt grau
  // Sehr helle Farben (Weiss, Segel) haben nach oben keinen Platz: Rampe nach unten verschieben,
  // damit Licht, Grund und Schatten trotzdem unterscheidbar bleiben (wie bei gemaltem Weiss)
  const hell = L > 0.86;
  const grund = [hell ? L - 0.06 : L, A * sat, B * sat];
  const licht = [hell ? Math.min(0.985, L + 0.02) : Math.min(0.99, L + 0.085), A * sat * 0.95, B * sat * 0.95 + 0.012];
  const schatten = [Math.max(0.16, L - (hell ? 0.2 : 0.13)), A * sat * 1.05 - 0.004, B * sat * 1.05 - 0.032];
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
  // Lichttiefe fuer Eigenschatten: etwa doppelte Sprite-Aufloesung, 128 bis 512
  let SCHATTEN_AUFL = 0, rtL = null, lichtTiefe = null;
  const lichtZiel = (w, h) => {
    const n = Math.min(512, Math.max(128, 2 ** Math.ceil(Math.log2(Math.max(w, h) * 2))));
    if (n === SCHATTEN_AUFL) return;
    rtL?.dispose();
    SCHATTEN_AUFL = n;
    rtL = new THREE.WebGLRenderTarget(n, n, { type: THREE.FloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    lichtTiefe = new Float32Array(n * n * 4);
  };
  const lichtKam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
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
        if (m && m.transparent && m.depthWrite === false) return null;   // Leuchtschein, Markierungen
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
      for (const m of cache.values()) if (m !== hidden) m.dispose();
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
      // Duenne Linien (Wanten, Leinen) werfen keinen Schatten: der Faecher waere nur Unruhe auf dem Wasser
      mitMaterial(liste, (n, linie) => (linie ? hidden : new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: FRAG_ID, side: THREE.DoubleSide,
        uniforms: { uId: { value: new THREE.Vector3(1, 1, 1) } },
      })), () => {
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

    // Eigenschatten: Tiefe aus Sicht der Sonne. Was dort verdeckt ist (Innenraum eines Ruderboots,
    // Deck hinter dem Aufbau, Rumpf unter dem Segel), bekommt die Schattenstufe, wie im 3D-Bild.
    lichtZiel(w, h);
    const kugel = new THREE.Box3().setFromObject(obj).getBoundingSphere(new THREE.Sphere());
    const rad = Math.max(0.5, kugel.radius) * 1.05;
    lichtKam.left = -rad; lichtKam.right = rad; lichtKam.top = rad; lichtKam.bottom = -rad;
    lichtKam.near = 0.1; lichtKam.far = rad * 4;
    lichtKam.position.set(kugel.center.x + LICHT[0] * rad * 2, kugel.center.y + LICHT[1] * rad * 2, kugel.center.z + LICHT[2] * rad * 2);
    lichtKam.up.set(0, 0, -1);
    lichtKam.lookAt(kugel.center);
    lichtKam.updateProjectionMatrix();
    lichtKam.updateMatrixWorld();
    mitMaterial(liste, (n, linie) => (linie ? hidden : new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG_N, side: THREE.DoubleSide,
      uniforms: { uLinie: { value: 0 } },
    })), () => {
      renderer.setRenderTarget(rtL);
      renderer.setClearColor(0xffffff, 1);
      renderer.clear();
      renderer.render(szene, lichtKam);
      renderer.readRenderTargetPixels(rtL, 0, 0, SCHATTEN_AUFL, SCHATTEN_AUFL, lichtTiefe);
      renderer.setClearColor(0x000000, 0);
    });
    renderer.setRenderTarget(null);
    const lichtMat = new THREE.Matrix4().multiplyMatrices(lichtKam.projectionMatrix, lichtKam.matrixWorldInverse);
    const lichtBias = 0.12 / (lichtKam.far - lichtKam.near);   // etwa 12 cm
    const KR = new THREE.Vector3().setFromMatrixColumn(kamera.matrixWorld, 0);
    const KU = new THREE.Vector3().setFromMatrixColumn(kamera.matrixWorld, 1);
    const ktx = (kamera.right - kamera.left) / w, kty = (kamera.top - kamera.bottom) / h;
    const _w = new THREE.Vector3();
    const imSchatten = (x, y, z) => {
      const d = kamera.near + z * (kamera.far - kamera.near);
      _w.copy(kamera.position)
        .addScaledVector(KR, kamera.left + (x + 0.5) * ktx)
        .addScaledVector(KU, kamera.top - (y + 0.5) * kty)
        .addScaledVector(blick, d)
        .applyMatrix4(lichtMat);
      const u = (_w.x * 0.5 + 0.5) * SCHATTEN_AUFL, v = (_w.y * 0.5 + 0.5) * SCHATTEN_AUFL;
      const zl = _w.z * 0.5 + 0.5;
      const ui = Math.floor(u), vi = Math.floor(v);
      // drei von vier Nachbarn muessen verdecken, sonst flimmern Kanten
      let verdeckt = 0;
      for (const [du, dv] of [[0, 0], [1, 0], [0, 1], [-1, 0]]) {
        const uu = ui + du, vv = vi + dv;
        if (uu < 0 || vv < 0 || uu >= SCHATTEN_AUFL || vv >= SCHATTEN_AUFL) continue;
        if (lichtTiefe[(vv * SCHATTEN_AUFL + uu) * 4 + 3] < zl - lichtBias) verdeckt++;
      }
      return verdeckt >= 3;
    };
    const weltY = (x, y, z) => kamera.position.y + KR.y * (kamera.left + (x + 0.5) * ktx)
      + KU.y * (kamera.top - (y + 0.5) * kty) + blick.y * (kamera.near + z * (kamera.far - kamera.near));

    const N = w * h;
    const teil = new Int32Array(N);     // 0 = leer
    const linie = new Uint8Array(N);
    const stufe = new Int8Array(N);     // 1 Schatten, 2 Grund, 3 Licht
    const tiefe = new Float32Array(N);
    const hoehe = new Float32Array(N);   // Welt-Hoehe je Pixel
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
        if (!linie[i] && stufe[i] > 1 && imSchatten(x, y, tiefe[i])) stufe[i] = 1;
        hoehe[i] = weltY(x, y, tiefe[i]);
      }
    }

    // Innenraeume (Ruderboot, Cockpit, Laderaum): Flaechen, die zwischen hoeheren Kanten liegen,
    // bekommen eine Stufe weniger Licht. So liest sich ein offenes Boot als Schale und nicht als Fladen.
    const reichweite = Math.max(2, Math.ceil(0.9 / ktx));
    const KANTE = 0.12;   // Meter, die eine Kante hoeher liegen muss
    const hoeherIn = (x, y, dx, dy, h0) => {
      for (let k = 1; k <= reichweite; k++) {
        const xx = x + dx * k, yy = y + dy * k;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) return false;
        const j = yy * w + xx;
        if (!teil[j]) return false;
        if (!linie[j] && hoehe[j] > h0 + KANTE) return true;
      }
      return false;
    };
    const innen = new Uint8Array(N);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!teil[i] || linie[i] || stufe[i] <= 1) continue;
        const h0 = hoehe[i];
        if ((hoeherIn(x, y, -1, 0, h0) && hoeherIn(x, y, 1, 0, h0)) || (hoeherIn(x, y, 0, -1, h0) && hoeherIn(x, y, 0, 1, h0))) innen[i] = 1;
      }
    }
    for (let i = 0; i < N; i++) if (innen[i]) stufe[i] = Math.max(1, stufe[i] - 1);

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
    const tiefeOut = new Float32Array(N).fill(2);   // 2 = leer
    // Wasserebene je Pixel (fuer Schattenpixel): Strahl der Ortho-Kamera mit y = 0 schneiden
    kamera.updateMatrixWorld();
    const R = new THREE.Vector3().setFromMatrixColumn(kamera.matrixWorld, 0);
    const U = new THREE.Vector3().setFromMatrixColumn(kamera.matrixWorld, 1);
    const tx = (kamera.right - kamera.left) / w, ty = (kamera.top - kamera.bottom) / h;
    const wasserTiefe = (x, y) => {
      const ox = kamera.position.x + R.x * (kamera.left + (x + 0.5) * tx) + U.x * (kamera.top - (y + 0.5) * ty);
      const oy = kamera.position.y + R.y * (kamera.left + (x + 0.5) * tx) + U.y * (kamera.top - (y + 0.5) * ty);
      void ox;
      const t = (0.005 - oy) / blick.y;
      return (t - kamera.near) / (kamera.far - kamera.near);
    };
    const setze = (i, c) => { out[i * 4] = c[0]; out[i * 4 + 1] = c[1]; out[i * 4 + 2] = c[2]; out[i * 4 + 3] = 255; };
    const schwelle = 0.00025;   // Tiefensprung fuer Innenkanten (Tiefenpuffer 0..1, etwa 10 cm): auch Duchten und flache Aufbauten
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (teil[i]) {
          const r = rampe(...farben[teil[i]]);
          let s = stufe[i];
          // Innenkante: ein anderes Teil liegt direkt davor (naeher) -> dieses Pixel wird Kante
          let kante = 0;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const xx = x + dx, yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
            const j = yy * w + xx;
            if (teil[j] && teil[j] !== teil[i] && tiefe[j] < tiefe[i] - schwelle && !linie[j]) {
              // Gleich helle Teile (Segel vor weissem Rumpf) brauchen eine echte Linie, sonst verschwimmen sie
              const lj = helligkeit(farben[teil[j]]), li = helligkeit(farben[teil[i]]);
              kante = Math.max(kante, Math.abs(lj - li) < 0.12 ? 2 : 1);
            }
          }
          setze(i, kante === 2 ? r[0] : kante === 1 ? r[Math.max(0, s - 1)] : r[s]);
          tiefeOut[i] = tiefe[i];
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
        if (best) { setze(i, rampe(...farben[best])[0]); tiefeOut[i] = bt; continue; }
        // Schatten: eine dunkle, halb durchsichtige Wasserfarbe, ohne Verlauf
        if (schattenMaske[((h - 1 - y) * w + x) * 4 + 3] > 0) {
          out[i * 4] = 18; out[i * 4 + 1] = 52; out[i * 4 + 2] = 66; out[i * 4 + 3] = 110;
          tiefeOut[i] = wasserTiefe(x, y);
        }
      }
    }
    const bild = new ImageData(out, w, h);
    bild.tiefe = tiefeOut;    // Tiefe 0..1 der Zeichenkamera je Pixel, 2 = leer
    return bild;
  }

  return { zeichne };
}
