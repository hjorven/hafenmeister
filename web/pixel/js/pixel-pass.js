// Pixel-Art-Zeichner fuer die 3D-Szene.
// Die Szene wird in niedriger Aufloesung gerendert, auf die feste Hafen-Palette gebracht,
// bekommt farbige Umrisse (dunklere Stufe der eigenen Farbe) und wird pixelgenau hochskaliert.
// Die Kamera rastet auf das Pixelraster ein, damit beim Verschieben nichts flimmert; der Rest
// wird beim Hochskalieren ausgeglichen, darum gleitet das Bild trotzdem weich.
//
// Benutzung:
//   const pass = createPixelPass(THREE, renderer, { pixel: 3 });
//   pass.render(scene, camera);          // statt renderer.render(scene, camera)
import { PALETTE, buildLut, LUT_SIZE } from './palette.js';

const VERT = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// Schritt 1: Farbe auf Palette, Umrisse aus Tiefenspruengen
const FRAG_PALETTE = /* glsl */`
  precision highp float;
  precision highp sampler3D;
  uniform sampler2D tColor;
  uniform sampler2D tDepth;
  uniform sampler3D tLut;
  uniform vec2 uSize;          // Groesse des kleinen Bildes in Pixeln
  uniform float uNear;
  uniform float uFar;
  uniform float uTexel;        // Weltmeter je Pixel
  uniform float uOutline;      // 0 = aus, 1 = an
  uniform float uDither;       // Staerke der geordneten Rasterung
  uniform vec2 uOrigin;        // Rasterursprung, damit die Rasterung mit der Kamera mitwandert
  uniform float uAlpha;        // 1 = Hintergrund durchsichtig lassen (Spritebogen), 0 = immer deckend
  varying vec2 vUv;

  float lin(vec2 uv) {
    float d = texture2D(tDepth, uv).x;
    return uNear + d * (uFar - uNear);     // orthografisch: Tiefe ist linear
  }
  vec3 toSrgb(vec3 c) {
    c = clamp(c, 0.0, 1.0);
    return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
  }
  float bayer4(vec2 p) {
    vec2 q = mod(floor(p), 4.0);
    float i = q.x + q.y * 4.0;
    // 4x4-Bayer-Matrix, Werte 0..15
    float m[16];
    m[0]=0.0; m[1]=8.0; m[2]=2.0; m[3]=10.0; m[4]=12.0; m[5]=4.0; m[6]=14.0; m[7]=6.0;
    m[8]=3.0; m[9]=11.0; m[10]=1.0; m[11]=9.0; m[12]=15.0; m[13]=7.0; m[14]=13.0; m[15]=5.0;
    float v = 0.0;
    for (int k = 0; k < 16; k++) if (float(k) == i) v = m[k];
    return v / 16.0 - 0.46875;
  }
  void main() {
    vec2 px = 1.0 / uSize;
    vec4 roh = texture2D(tColor, vUv);
    vec3 c = toSrgb(roh.rgb / max(roh.a, 0.001) * mix(roh.a, 1.0, 1.0 - uAlpha));
    float d = lin(vUv);
    float dl = lin(vUv - vec2(px.x, 0.0));
    float dr = lin(vUv + vec2(px.x, 0.0));
    float du = lin(vUv + vec2(0.0, px.y));
    float dd = lin(vUv - vec2(0.0, px.y));
    // Dieses Pixel ist Rand eines Objekts, wenn ein Nachbar deutlich weiter weg ist
    float schwelle = uTexel * 2.6 + 0.12;
    float weiter = max(max(dl - d, dr - d), max(du - d, dd - d));
    float rand = step(schwelle, weiter) * uOutline;
    // Innenkanten (Knick zwischen zwei Flaechen): zweite Ableitung der Tiefe
    float knick = abs(dl + dr - 2.0 * d) + abs(du + dd - 2.0 * d);
    float innen = step(uTexel * 1.6 + 0.05, knick) * (1.0 - rand) * uOutline;
    c *= mix(1.0, 0.5, rand);
    c *= mix(1.0, 0.86, innen);
    // Himmel/Hintergrund (Tiefe = far) bekommt keinen Rand
    c += bayer4(gl_FragCoord.xy + uOrigin) * uDither;
    c = clamp(c, 0.0, 1.0);
    float s = float(${LUT_SIZE});
    vec3 l = (c * (s - 1.0) + 0.5) / s;
    float a = mix(1.0, step(0.5, roh.a), uAlpha);
    gl_FragColor = vec4(texture(tLut, l).rgb, a);
  }
`;

// Schritt 2: pixelgenau hochskalieren, mit Ausgleich des Rasterversatzes
const FRAG_UPSCALE = /* glsl */`
  precision highp float;
  uniform sampler2D tPix;
  uniform sampler2D tOver;   // durchsichtige Markierungen, nicht auf die Palette gebracht
  uniform vec2 uSize;        // kleines Bild inkl. Rand
  uniform vec2 uScreen;      // Ausgabe in Geraetepixeln
  uniform float uScale;      // Geraetepixel je Kunstpixel
  uniform vec2 uShift;       // Versatz in Kunstpixeln
  varying vec2 vUv;
  void main() {
    vec2 p = vec2(gl_FragCoord.x, uScreen.y - gl_FragCoord.y) / uScale;  // von oben links
    p += vec2(1.0) + uShift;                                             // 1 Pixel Rand
    vec2 uv = vec2(floor(p.x) + 0.5, uSize.y - floor(p.y) - 0.5) / uSize;
    vec3 c = texture2D(tPix, uv).rgb;
    vec4 o = texture2D(tOver, uv);
    if (o.a > 0.002) {
      vec3 oc = clamp(o.rgb / o.a, 0.0, 1.0);
      oc = mix(oc * 12.92, 1.055 * pow(oc, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, oc));
      c = mix(c, oc, clamp(o.a, 0.0, 1.0));
    }
    gl_FragColor = vec4(c, 1.0);
  }
`;

export function createPixelPass(THREE, renderer, opts = {}) {
  const state = {
    pixel: opts.pixel ?? 'auto',   // CSS-Pixel je Kunstpixel oder 'auto'
    outline: opts.outline ?? true,
    dither: opts.dither ?? 0,
    enabled: true,
  };

  const lut = buildLut(PALETTE);
  const lutTex = new THREE.Data3DTexture(lut, LUT_SIZE, LUT_SIZE, LUT_SIZE);
  lutTex.format = THREE.RGBAFormat;
  lutTex.type = THREE.UnsignedByteType;
  lutTex.minFilter = THREE.NearestFilter;
  lutTex.magFilter = THREE.NearestFilter;
  lutTex.unpackAlignment = 1;
  lutTex.needsUpdate = true;

  let sceneRT = null;
  let pixRT = null;
  const makeTargets = (w, h) => {
    sceneRT?.dispose(); pixRT?.dispose();
    sceneRT = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType,
      minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
      depthTexture: new THREE.DepthTexture(w, h),
    });
    sceneRT.depthTexture.minFilter = THREE.NearestFilter;
    sceneRT.depthTexture.magFilter = THREE.NearestFilter;
    pixRT = new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false });
    overRT?.dispose();
    overRT = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType,
      minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
      depthTexture: sceneRT.depthTexture,   // dieselbe Tiefe: Markierungen verschwinden hinter Booten
    });
  };
  let overRT = null;

  // Durchsichtige Flaechen ohne Tiefenschreiben (Ankerfeld, Box-Leuchten, Bauplaetze, Schatten)
  // wuerden auf der Palette verschwinden. Sie kommen auf eine eigene Ebene und werden danach
  // pixelgenau, aber mit ihrer echten Farbe und Deckkraft darueber gelegt.
  const OVERLAY_LAYER = 29;
  const overlays = [];
  function sammleOverlays(scene) {
    overlays.length = 0;
    scene.traverseVisible((o) => {
      if (!o.material || !(o.isMesh || o.isLine || o.isSprite || o.isPoints)) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (m && m.transparent && !m.depthWrite) overlays.push(o);
    });
  }

  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quadGeo = new THREE.PlaneGeometry(2, 2);
  const palMat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG_PALETTE,
    uniforms: {
      tColor: { value: null }, tDepth: { value: null }, tLut: { value: lutTex },
      uSize: { value: new THREE.Vector2() }, uNear: { value: 1 }, uFar: { value: 2000 },
      uTexel: { value: 0.1 }, uOutline: { value: 1 }, uDither: { value: state.dither },
      uOrigin: { value: new THREE.Vector2() }, uAlpha: { value: 0 },
    },
    depthTest: false, depthWrite: false,
  });
  const upMat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG_UPSCALE,
    uniforms: {
      tPix: { value: null }, tOver: { value: null }, uSize: { value: new THREE.Vector2() }, uScreen: { value: new THREE.Vector2() },
      uScale: { value: 3 }, uShift: { value: new THREE.Vector2() },
    },
    depthTest: false, depthWrite: false,
  });
  const palScene = new THREE.Scene(); palScene.add(new THREE.Mesh(quadGeo, palMat));
  const upScene = new THREE.Scene(); upScene.add(new THREE.Mesh(quadGeo, upMat));

  const original = renderer.render.bind(renderer);
  const _right = new THREE.Vector3();
  const _up = new THREE.Vector3();
  const _pos = new THREE.Vector3();
  const _size = new THREE.Vector2();

  function pixelSize(cssW, cssH) {
    if (state.pixel !== 'auto') return Number(state.pixel) || 3;
    // Kurze Seite soll ca. 220 bis 300 Kunstpixel haben
    const kurz = Math.min(cssW, cssH);
    return Math.max(2, Math.min(4, Math.round(kurz / 260)));
  }

  function render(scene, camera) {
    if (!state.enabled || !camera.isOrthographicCamera || renderer.getRenderTarget() !== null) {
      return original(scene, camera);
    }
    renderer.getSize(_size);                       // CSS-Pixel
    const cssW = _size.x, cssH = _size.y;
    const dpr = renderer.getPixelRatio();
    const px = pixelSize(cssW, cssH);
    const w = Math.ceil(cssW / px) + 2;
    const h = Math.ceil(cssH / px) + 2;
    if (!sceneRT || sceneRT.width !== w || sceneRT.height !== h) makeTargets(w, h);

    // Weltgroesse eines Kunstpixels
    const save = { l: camera.left, r: camera.right, t: camera.top, b: camera.bottom };
    const texel = (camera.right - camera.left) / camera.zoom / cssW * px;

    // Kamera auf das Raster einrasten
    camera.updateMatrixWorld();
    _right.setFromMatrixColumn(camera.matrixWorld, 0);
    _up.setFromMatrixColumn(camera.matrixWorld, 1);
    _pos.copy(camera.position);
    const pr = _pos.dot(_right) / texel;
    const pu = _pos.dot(_up) / texel;
    const fr = pr - Math.round(pr);
    const fu = pu - Math.round(pu);
    camera.position.addScaledVector(_right, -fr * texel).addScaledVector(_up, -fu * texel);

    // Ausschnitt: links oben am Bildschirm plus ein Pixel Rand, auf ganze Pixel erweitert
    camera.left = save.l - texel;
    camera.right = camera.left + w * texel;
    camera.top = save.t + texel;
    camera.bottom = camera.top - h * texel;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    sammleOverlays(scene);
    const masken = overlays.map((o) => o.layers.mask);
    for (const o of overlays) o.layers.set(OVERLAY_LAYER);
    const camMaske = camera.layers.mask;
    renderer.setRenderTarget(sceneRT);
    original(scene, camera);

    // Markierungen auf eigener Ebene, gegen die Tiefe der Szene
    const autoClear = renderer.autoClear;
    const clear = renderer.getClearColor(new THREE.Color());
    const clearA = renderer.getClearAlpha();
    const bg = scene.background;
    renderer.setRenderTarget(overRT);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, false, false);
    if (overlays.length) {
      renderer.autoClear = false;
      scene.background = null;
      camera.layers.set(OVERLAY_LAYER);
      original(scene, camera);
      scene.background = bg;
      renderer.autoClear = autoClear;
    }
    renderer.setClearColor(clear, clearA);
    camera.layers.mask = camMaske;
    overlays.forEach((o, i) => { o.layers.mask = masken[i]; });

    // Kamera wiederherstellen (Antippen und Verschieben rechnen mit der echten Lage)
    camera.position.copy(_pos);
    camera.left = save.l; camera.right = save.r; camera.top = save.t; camera.bottom = save.b;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    const u = palMat.uniforms;
    u.tColor.value = sceneRT.texture;
    u.tDepth.value = sceneRT.depthTexture;
    u.uSize.value.set(w, h);
    u.uNear.value = camera.near; u.uFar.value = camera.far;
    u.uTexel.value = texel;
    u.uOutline.value = state.outline ? 1 : 0;
    u.uDither.value = state.dither;
    u.uOrigin.value.set(Math.round(pr) % 4096, Math.round(pu) % 4096);
    u.uAlpha.value = 0;
    renderer.setRenderTarget(pixRT);
    original(palScene, quadCam);

    renderer.setRenderTarget(null);
    const uu = upMat.uniforms;
    uu.tPix.value = pixRT.texture;
    uu.tOver.value = overRT.texture;
    uu.uSize.value.set(w, h);
    uu.uScreen.value.set(cssW * dpr, cssH * dpr);
    uu.uScale.value = px * dpr;
    // Das Bild wurde um (-fr, -fu) Pixel verschoben gerendert; beim Hochskalieren zurueckschieben
    uu.uShift.value.set(fr, -fu);
    original(upScene, quadCam);
  }

  // Ein einzelnes kleines Bild ohne Hochskalieren (Werkstatt, Spritebogen)
  function renderSmall(scene, camera, w, h, target) {
    if (!sceneRT || sceneRT.width !== w || sceneRT.height !== h) makeTargets(w, h);
    renderer.setRenderTarget(sceneRT);
    original(scene, camera);
    const u = palMat.uniforms;
    u.tColor.value = sceneRT.texture;
    u.tDepth.value = sceneRT.depthTexture;
    u.uSize.value.set(w, h);
    u.uNear.value = camera.near; u.uFar.value = camera.far;
    u.uTexel.value = (camera.right - camera.left) / camera.zoom / w;
    u.uOutline.value = state.outline ? 1 : 0;
    u.uDither.value = state.dither;
    u.uOrigin.value.set(0, 0);
    u.uAlpha.value = 1;
    renderer.setRenderTarget(target ?? pixRT);
    original(palScene, quadCam);
    renderer.setRenderTarget(null);
    return target ?? pixRT;
  }

  return { state, render, renderSmall, original, palette: PALETTE };
}
