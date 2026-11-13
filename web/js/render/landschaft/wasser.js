// Wasser im Flat-Vector-Stil: klare Tiefenbänder wie auf einer Seekarte, kurze weiße
// Wellenstriche, die mit dem Wind wandern, und ein atmender Brandungssaum an jedem Ufer.
// Eine einzige große Fläche mit einem schlanken Shader, dazu eine kleine Tiefentextur.
// Kein Spiegeln, keine Brechung: läuft auch auf schwachen Handys.
import * as THREE from 'three';
import { punkt, BEREICH, KERN, PLAN_M } from './gelaende.js';

const U = PLAN_M;
const TIEFE_MAX = 8;   // Meter, die in der Textur abgebildet werden

/** Tiefentextur: R = Wassertiefe (0..8 m), G = 0 Binnensee bis 1 offene See. */
export function baueTiefentextur(region, stufe, schritt) {
  const nx = Math.ceil((BEREICH.x1 - BEREICH.x0) / schritt) + 1;
  const ny = Math.ceil((BEREICH.y1 - BEREICH.y0) / schritt) + 1;
  const daten = new Uint8Array(nx * ny * 4);
  // Außerhalb des Kerns nur jedes zweite Texel rechnen, die übrigen danach aus den Nachbarn mitteln
  const imKern = (px, py) => px >= KERN.x0 - schritt && px <= KERN.x1 + schritt && py >= KERN.y0 - schritt && py <= KERN.y1 + schritt;
  const offen = [];
  for (let j = 0; j < ny; j++) {
    // Zeile 0 liegt im Süden (kleines py), passend zu uv.y = (z0 - z) / Tiefe der Fläche
    const py = BEREICH.y0 + j * schritt;
    for (let i = 0; i < nx; i++) {
      const px = BEREICH.x0 + i * schritt;
      const k = (j * nx + i) * 4;
      daten[k + 3] = 255;
      if ((i & 1 || j & 1) && i < nx - 1 && j < ny - 1 && !imKern(px, py)) { offen.push(i, j); continue; }
      const p = punkt(px, py, stufe, region);
      // Im Binnensee zeigt die Farbe höchstens das Band unter 3 m: ausgebaggerte Becken und Rinnen
      // sollen nicht als dunkle Rechtecke quer über den See stehen (die echte Tiefe bleibt in punkt())
      const t = Math.max(0, Math.min(1, (p.see - 0.3) / 0.6));
      const deckel = 2.95 + 10 * t * t * (3 - 2 * t);
      daten[k] = Math.round(Math.min(1, Math.min(deckel, Math.max(0, -p.h)) / TIEFE_MAX) * 255);
      daten[k + 1] = Math.round(p.see * 255);
    }
  }
  for (let n = 0; n < offen.length; n += 2) {
    const i = offen[n], j = offen[n + 1];
    // gerade Nachbarn: links/rechts bzw. unten/oben bzw. die vier Ecken
    const i0 = i & 1 ? i - 1 : i, i1 = i & 1 ? i + 1 : i, j0 = j & 1 ? j - 1 : j, j1 = j & 1 ? j + 1 : j;
    const k = (j * nx + i) * 4;
    for (const c of [0, 1]) {
      daten[k + c] = (daten[(j0 * nx + i0) * 4 + c] + daten[(j0 * nx + i1) * 4 + c] + daten[(j1 * nx + i0) * 4 + c] + daten[(j1 * nx + i1) * 4 + c] + 2) >> 2;
    }
  }
  const tex = new THREE.DataTexture(daten, nx, ny, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

const VERTEX = /* glsl */ `
  varying vec3 vWelt;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWelt = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform sampler2D uTiefe;
  uniform vec4 uBereich;      // x0, zSued, 1/Breite, 1/Tiefe (Meter)
  uniform float uZeit;
  uniform float uPegel;
  uniform float uWind;
  uniform vec3 uSee[5];
  uniform vec3 uBinnen[5];
  uniform vec3 uSchaum;
  uniform vec3 uStrich;
  uniform vec3 uTint;
  uniform float uNacht;
  varying vec3 vWelt;

  // Hash ohne sin(): auf schwachen Grafikchips und in Software-Grafik deutlich billiger
  float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  vec3 hash3(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yxz + 33.33);
    return fract((p3.xxy + p3.yzz) * p3.zyx);
  }

  // Tiefenband: Binnensee- und Seefarbe erst mischen, dann nur einmal die Bänder rechnen
  vec3 band(float see, float d, float aa) {
    vec3 c = mix(uBinnen[0], uSee[0], see);
    c = mix(c, mix(uBinnen[1], uSee[1], see), smoothstep(1.0 - aa, 1.0 + aa, d));
    c = mix(c, mix(uBinnen[2], uSee[2], see), smoothstep(2.0 - aa, 2.0 + aa, d));
    c = mix(c, mix(uBinnen[3], uSee[3], see), smoothstep(3.0 - aa, 3.0 + aa, d));
    c = mix(c, mix(uBinnen[4], uSee[4], see), smoothstep(4.0 - aa, 4.0 + aa, d));
    return c;
  }

  void main() {
    vec2 uv = vec2((vWelt.x - uBereich.x) * uBereich.z, (uBereich.y - vWelt.z) * uBereich.w);
    vec4 t = texture2D(uTiefe, clamp(uv, 0.0, 1.0));
    float innen = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
    float d = t.r * ${TIEFE_MAX.toFixed(1)} + uPegel;
    float see = t.g;
    // Außerhalb des fein berechneten Bereichs: offenes, tiefes Wasser
    d = mix(max(d, 4.5), d, innen);

    float px = length(vec2(dFdx(vWelt.x), dFdy(vWelt.x))) + length(vec2(dFdx(vWelt.z), dFdy(vWelt.z)));
    float aa = max(fwidth(d) * 0.8, 0.002);
    vec3 col = band(see, d, aa);

    // Feine Tiefenlinie wie auf der Seekarte an der 2-m-Grenze
    float linie = 1.0 - smoothstep(0.0, aa * 1.6, abs(d - 2.0));
    col = mix(col, col * 0.9, linie * 0.5);

    // Wellenstriche: kurze Striche in versetzten Zellen, wandern mit dem Wind nach Osten
    float wind = uWind;
    vec2 p = vWelt.xz + vec2(uZeit * (0.5 + 1.6 * wind), 0.0);
    vec2 zelle = vec2(7.5, 2.8);
    float reihe = floor(p.y / zelle.y);
    p.x += hash(vec2(reihe, 3.1)) * zelle.x;
    vec2 id = floor(p / zelle);
    vec2 f = (fract(p / zelle) - 0.5) * zelle;
    vec3 h = hash3(id);
    float h1 = h.x, h2 = h.y, h3 = h.z;
    float halb = 0.7 + 1.2 * h2 + wind * 0.6;
    vec2 m = vec2(f.x - (h1 - 0.5) * 2.5, f.y - (h3 - 0.5) * 1.2);
    float dicke = max(0.14, px * 0.7);
    float abst = length(vec2(max(abs(m.x) - halb, 0.0), m.y)) - dicke;
    float strich = 1.0 - smoothstep(-px * 0.5, px * 0.5, abst);
    // Auf- und Abblenden als Dreieckswelle statt sin(), sieht nach smoothstep gleich aus
    float phase = fract(uZeit * (0.6 + h2 * 0.5) * 0.15915 + h1);
    float blink = smoothstep(0.35, 0.85, 1.0 - abs(phase * 2.0 - 1.0));
    float dichte = step(h3, 0.3 + 0.55 * wind) * mix(0.5, 1.0, see) * mix(1.0, 0.45, smoothstep(0.2, 0.55, px));
    float wellen = strich * blink * dichte * smoothstep(0.7, 1.6, d) * (1.0 - smoothstep(1.2, 3.0, px));
    col = mix(col, uStrich, wellen * (0.55 + 0.3 * wind));

    // Brandung: heller Saum am Ufer, der atmet, und eine zweite Linie, die anläuft
    float welle = sin(uZeit * 1.1 + (vWelt.x * 0.31 + vWelt.z * 0.17)) * 0.5 + 0.5;
    float saumBreite = 0.07 + 0.08 * welle + 0.2 * wind;
    float saum = 1.0 - smoothstep(saumBreite - aa, saumBreite + aa, d);
    float lauf = fract(uZeit * 0.22 + hash(floor(vWelt.xz / 24.0)) * 0.3);
    float ziel = 0.25 + 0.55 * (1.0 - lauf);
    float zweite = (1.0 - smoothstep(0.0, aa * 2.5 + 0.03, abs(d - ziel))) * sin(lauf * 3.1416) * 0.6;
    float schaum = max(saum * (0.35 + 0.45 * see), zweite * (0.2 + 0.6 * see)) * innen;
    col = mix(col, uSchaum, schaum);

    col *= uTint;
    // Nachts etwas Glanz auf dem Wasser, damit es nicht schwarz wirkt
    col += vec3(0.02, 0.03, 0.06) * uNacht;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

/**
 * Erzeugt die Wasserfläche.
 * @returns {{mesh: THREE.Mesh, setzeTiefe: Function, setzeRegion: Function, setzePegel: Function, setzeWind: Function, setzeLicht: Function, aktualisiere: Function, entsorge: Function}}
 */
export function erzeugeWasser(region) {
  const x0 = BEREICH.x0 * U, x1 = BEREICH.x1 * U;
  const zSued = -BEREICH.y0 * U, zNord = -BEREICH.y1 * U;
  const farben = (liste) => liste.map((c) => new THREE.Color(c));
  const uniforms = {
    uTiefe: { value: null },
    uBereich: { value: new THREE.Vector4(x0, zSued, 1 / (x1 - x0), 1 / (zSued - zNord)) },
    uZeit: { value: 0 },
    uPegel: { value: 0 },
    uWind: { value: 0.3 },
    uSee: { value: farben(region.wasser.see) },
    uBinnen: { value: farben(region.wasser.binnen) },
    uSchaum: { value: new THREE.Color(region.wasser.schaum) },
    uStrich: { value: new THREE.Color(region.wasser.striche) },
    uTint: { value: new THREE.Color('#ffffff') },
    uNacht: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: VERTEX, fragmentShader: FRAGMENT });
  mat.name = 'wasser';
  const geo = new THREE.PlaneGeometry(6000, 6000);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'wasser';
  mesh.position.set((x0 + x1) / 2, 0, (zSued + zNord) / 2);
  mesh.renderOrder = -1;

  return {
    mesh,
    uniforms,
    setzeTiefe(tex) {
      if (uniforms.uTiefe.value) uniforms.uTiefe.value.dispose();
      uniforms.uTiefe.value = tex;
    },
    setzeRegion(r) {
      r.wasser.see.forEach((c, i) => uniforms.uSee.value[i].set(c));
      r.wasser.binnen.forEach((c, i) => uniforms.uBinnen.value[i].set(c));
      uniforms.uSchaum.value.set(r.wasser.schaum);
      uniforms.uStrich.value.set(r.wasser.striche);
    },
    /** Wasserstand in Metern über Normal (Gezeiten, Sturmflut). Die Fläche hebt sich mit. */
    setzePegel(m) {
      uniforms.uPegel.value = m;
      mesh.position.y = m;
    },
    setzeWind(w) { uniforms.uWind.value = w; },
    setzeLicht(tint, nacht) {
      uniforms.uTint.value.copy(tint);
      uniforms.uNacht.value = nacht;
    },
    aktualisiere(dt) { uniforms.uZeit.value = (uniforms.uZeit.value + dt) % 3600; },
    entsorge() {
      geo.dispose();
      mat.dispose();
      uniforms.uTiefe.value?.dispose();
    },
  };
}
