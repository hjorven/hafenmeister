// Schiffe im Pixel-Spiel als gezeichnete Sprites statt gefiltert.
// Fuer jedes Boot wird bei Bedarf ein Sprite fuer die aktuelle Blickrichtung (32 Richtungen),
// Kameraneigung (5-Grad-Stufen) und Zoomstufe gezeichnet (sprite-zeichner.js) und zwischengespeichert.
// Im Bild ersetzt das Sprite das 3D-Boot. Jedes Sprite-Pixel hat seine eigene Tiefe, darum
// verdecken Stege und Pfaehle das Boot richtig und das Boot verdeckt, was dahinter liegt.
// Solange ein Sprite noch nicht fertig ist, bleibt das gefilterte 3D-Boot sichtbar.
import { createSpriteZeichner } from './sprite-zeichner.js';

const RICHTUNGEN = 32;
const NEIGUNG_STUFE = 5;          // Grad
const ZOOM_STUFEN_JE_VERDOPPLUNG = 8;
const JE_BILD = 3;                // hoechstens so viele neue Sprites je Bild (kein Ruckeln)
const BAKE_ABSTAND = 150;
const BAKE_NEAR = 1;
const BAKE_FAR = 400;

const VERT = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D tBild;
  uniform sampler2D tTiefe;
  uniform float uMitte;        // Tiefe der Bildmitte in der Zeichenkamera (0..1)
  uniform float uBakeWeite;    // far - near der Zeichenkamera
  uniform float uSpielWeite;   // far - near der Spielkamera
  uniform float uMassstab;     // Spiel-Pixelgroesse / Zeichen-Pixelgroesse
  uniform vec3 uTint;
  varying vec2 vUv;
  vec3 lin(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
  void main() {
    vec4 c = texture2D(tBild, vUv);
    if (c.a < 0.02) discard;
    float d = texture2D(tTiefe, vUv).r;
    float dz = (d - uMitte) * uBakeWeite * uMassstab;
    gl_FragDepth = clamp(gl_FragCoord.z + dz / uSpielWeite, 0.0, 1.0);
    gl_FragColor = vec4(lin(c.rgb) * uTint, c.a);
  }
`;

export function installiereSchiffSprites(game, pass) {
  const THREE = game.THREE;
  const renderer = game.renderer;
  const zeichner = createSpriteZeichner(THREE, renderer);
  const extra = new THREE.Scene();
  pass.hooks.extra = extra;

  const boote = new Map();          // root -> { radius, sprites: Map, quad }
  const versteckt = [];
  const quadGeo = new THREE.PlaneGeometry(1, 1);
  const _q = new THREE.Quaternion();
  const _e = new THREE.Euler();
  const _p = new THREE.Vector3();
  const _dir = new THREE.Vector3();
  const _R = new THREE.Vector3();
  const _U = new THREE.Vector3();
  const tint = new THREE.Color(1, 1, 1);
  let aus = false;

  function sichtbar(o) {
    for (; o; o = o.parent) if (!o.visible) return false;
    return true;
  }

  function zustand(root) {
    let n = 0;
    root.traverseVisible((o) => { if (o.isMesh || o.isLine) n++; });
    return n;
  }

  function bake(root, eintrag, richtung, neigung, texel) {
    const pos = root.position.clone();
    const quat = root.quaternion.clone();
    const eltern = root.parent;
    root.position.set(0, 0, 0);
    root.quaternion.setFromEuler(_e.set(0, (richtung / RICHTUNGEN) * Math.PI * 2, 0));
    root.updateMatrixWorld(true);
    if (!eintrag.radius) {
      const kugel = new THREE.Box3().setFromObject(root).getBoundingSphere(new THREE.Sphere());
      eintrag.radius = Math.max(0.5, kugel.radius);
    }
    const r = eintrag.radius;
    const groesse = Math.ceil((r * 2.1) / texel / 2) * 2 + 4;
    const p = THREE.MathUtils.degToRad(neigung);
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, BAKE_NEAR, BAKE_FAR);
    const halb = (groesse * texel) / 2;
    cam.left = -halb; cam.right = halb; cam.top = halb; cam.bottom = -halb;
    cam.position.set(0, Math.sin(p) * BAKE_ABSTAND + r * 0.25, Math.cos(p) * BAKE_ABSTAND);
    cam.lookAt(0, r * 0.25, 0);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    let bild;
    try {
      bild = zeichner.zeichne(root, cam, groesse, groesse);
    } finally {
      if (eltern && root.parent !== eltern) eltern.add(root);
      root.position.copy(pos);
      root.quaternion.copy(quat);
      root.updateMatrixWorld(true);
    }
    // Zeilen fuer WebGL umdrehen (Textur zaehlt von unten)
    const rgba = new Uint8Array(groesse * groesse * 4);
    const tiefe = new Float32Array(groesse * groesse);
    for (let y = 0; y < groesse; y++) {
      const ziel = (groesse - 1 - y) * groesse;
      rgba.set(bild.data.subarray(y * groesse * 4, (y + 1) * groesse * 4), ziel * 4);
      tiefe.set(bild.tiefe.subarray(y * groesse, (y + 1) * groesse), ziel);
    }
    const tBild = new THREE.DataTexture(rgba, groesse, groesse, THREE.RGBAFormat, THREE.UnsignedByteType);
    const tTiefe = new THREE.DataTexture(tiefe, groesse, groesse, THREE.RedFormat, THREE.FloatType);
    for (const t of [tBild, tTiefe]) {
      t.minFilter = THREE.NearestFilter; t.magFilter = THREE.NearestFilter;
      t.generateMipmaps = false; t.needsUpdate = true;
    }
    return { tBild, tTiefe, groesse, texel, mitte: (BAKE_ABSTAND - BAKE_NEAR) / (BAKE_FAR - BAKE_NEAR), r };
  }

  function quadFuer(eintrag) {
    if (eintrag.quad) return eintrag.quad;
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      uniforms: {
        tBild: { value: null }, tTiefe: { value: null },
        uMitte: { value: 0.5 }, uBakeWeite: { value: BAKE_FAR - BAKE_NEAR }, uSpielWeite: { value: 1999 },
        uMassstab: { value: 1 }, uTint: { value: tint },
      },
      transparent: true, depthTest: true, depthWrite: false,
    });
    eintrag.quad = new THREE.Mesh(quadGeo, mat);
    eintrag.quad.frustumCulled = false;
    return eintrag.quad;
  }

  pass.hooks.vorher.add(({ camera, texel, scene }) => {
    extra.clear();
    versteckt.length = 0;
    if (aus) return;
    const licht = game.landscape?.licht?.zustand?.tint;
    if (licht) tint.copy(licht); else tint.setRGB(1, 1, 1);

    camera.getWorldDirection(_dir);
    const camYaw = Math.atan2(-_dir.x, -_dir.z);
    const neigung = Math.round(THREE.MathUtils.radToDeg(Math.asin(-_dir.y)) / NEIGUNG_STUFE) * NEIGUNG_STUFE;
    const stufe = Math.round(Math.log2(texel) * ZOOM_STUFEN_JE_VERDOPPLUNG);
    const texelB = Math.pow(2, stufe / ZOOM_STUFEN_JE_VERDOPPLUNG);
    _R.setFromMatrixColumn(camera.matrixWorld, 0);
    _U.setFromMatrixColumn(camera.matrixWorld, 1);
    // Pixelraster der kleinen Bildflaeche (Kanten) in Kunstpixeln
    const eR = camera.position.dot(_R) / texel + camera.left / texel;
    const eU = camera.position.dot(_U) / texel + camera.top / texel;
    const frac = (v) => v - Math.floor(v);

    const wurzeln = [];
    scene.traverseVisible((o) => { if (o.userData?.pick?.type === 'boat') wurzeln.push(o); });
    let budget = JE_BILD;
    const lebend = new Set();
    for (const root of wurzeln) {
      if (!sichtbar(root)) continue;
      lebend.add(root);
      let eintrag = boote.get(root);
      if (!eintrag) { eintrag = { radius: 0, sprites: new Map() }; boote.set(root, eintrag); }
      root.getWorldQuaternion(_q);
      _e.setFromQuaternion(_q, 'YXZ');
      const rel = _e.y - camYaw;
      const richtung = ((Math.round(rel / (Math.PI * 2) * RICHTUNGEN) % RICHTUNGEN) + RICHTUNGEN) % RICHTUNGEN;
      const key = `${richtung}|${neigung}|${stufe}|${zustand(root)}`;
      let sprite = eintrag.sprites.get(key);
      if (!sprite) {
        if (budget <= 0) continue;          // naechstes Bild; bis dahin gefiltertes 3D-Boot
        budget--;
        try { sprite = bake(root, eintrag, richtung, neigung, texelB); } catch (err) { console.warn('Sprite nicht gezeichnet', err); continue; }
        // Speicher klein halten: je Boot hoechstens 96 Sprites
        if (eintrag.sprites.size > 96) {
          const [altKey, alt] = eintrag.sprites.entries().next().value;
          alt.tBild.dispose(); alt.tTiefe.dispose(); eintrag.sprites.delete(altKey);
        }
        eintrag.sprites.set(key, sprite);
      }
      const quad = quadFuer(eintrag);
      const u = quad.material.uniforms;
      u.tBild.value = sprite.tBild;
      u.tTiefe.value = sprite.tTiefe;
      u.uMitte.value = sprite.mitte;
      u.uSpielWeite.value = camera.far - camera.near;
      u.uMassstab.value = texel / sprite.texel;
      // 1 Sprite-Pixel = 1 Bildpixel, Mitte auf das Raster gelegt
      root.getWorldPosition(_p);
      _p.y += sprite.r * 0.25;
      const cr = _p.dot(_R) / texel;
      const cu = _p.dot(_U) / texel;
      const halb = sprite.groesse / 2;
      const sr = Math.round(cr - halb - frac(eR)) + frac(eR) + halb;
      const su = Math.round(cu - halb - frac(eU)) + frac(eU) + halb;
      _p.addScaledVector(_R, (sr - cr) * texel).addScaledVector(_U, (su - cu) * texel);
      quad.position.copy(_p);
      quad.quaternion.copy(camera.quaternion);
      quad.scale.set(sprite.groesse * texel, sprite.groesse * texel, 1);
      quad.updateMatrixWorld();
      extra.add(quad);
      root.visible = false;
      versteckt.push(root);
    }
    // Boote, die nicht mehr da sind, vergessen
    for (const [root, eintrag] of boote) {
      if (lebend.has(root) || root.parent) continue;
      for (const s of eintrag.sprites.values()) { s.tBild.dispose(); s.tTiefe.dispose(); }
      eintrag.quad?.material.dispose();
      boote.delete(root);
    }
  });

  pass.hooks.nachher.add(() => {
    for (const root of versteckt) root.visible = true;
    versteckt.length = 0;
  });

  return {
    set aus(v) { aus = !!v; extra.clear(); },
    get aus() { return aus; },
    anzahl: () => boote.size,
  };
}
