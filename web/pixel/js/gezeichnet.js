// Live gezeichnet statt gefiltert: Stege, Gebaeude, Services, Menschen, Landschaft.
// Jedes beleuchtete Material (Lambert, Standard, Phong) bekommt im Pixel-Spiel einen anderen
// Abschluss im Shader: Statt der weichen Beleuchtung wird nur gemessen, wie viel Licht ankommt
// (Sonne, Himmel, Schatten), und daraus eine von drei Stufen gewaehlt. Die Farbe kommt aus der
// Rampe der Modellfarbe, genau wie bei den Schiff-Sprites (sprite-zeichner.js):
// Schatten dunkler und kuehler, Licht heller und waermer. Schlagschatten werden so zu harten Flaechen.
// Leuchtende Teile (Fenster nachts) behalten ihr Leuchten.

export const RAMPE_GLSL = /* glsl */`
  vec3 pxLin(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
  vec3 pxSrgb(vec3 c) { c = clamp(c, 0.0, 1.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
  vec3 pxOklab(vec3 lin) {
    float l = pow(max(0.4122214708 * lin.r + 0.5363325363 * lin.g + 0.0514459929 * lin.b, 0.0), 1.0 / 3.0);
    float m = pow(max(0.2119034982 * lin.r + 0.6806995451 * lin.g + 0.1073969566 * lin.b, 0.0), 1.0 / 3.0);
    float s = pow(max(0.0883024619 * lin.r + 0.2817188376 * lin.g + 0.6299787005 * lin.b, 0.0), 1.0 / 3.0);
    return vec3(0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
                1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
                0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s);
  }
  vec3 pxAusOklab(vec3 c) {
    float l = pow(c.x + 0.3963377774 * c.y + 0.2158037573 * c.z, 3.0);
    float m = pow(c.x - 0.1055613458 * c.y - 0.0638541728 * c.z, 3.0);
    float s = pow(c.x - 0.0894841775 * c.y - 1.291485548 * c.z, 3.0);
    return clamp(vec3(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
                     -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
                     -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s), 0.0, 1.0);
  }
  // stufe: 0 Umriss, 1 Schatten, 2 Grund, 3 Licht. Eingabe und Ausgabe linear.
  vec3 pxRampe(vec3 lin, int stufe) {
    vec3 k = pxOklab(lin);
    float sat = length(k.yz) > 0.02 ? 1.12 : 1.0;
    vec3 r;
    bool hell = k.x > 0.86;   // sehr helle Farben: Rampe nach unten verschieben (wie sprite-zeichner.js)
    if (stufe == 3) r = vec3(hell ? min(0.985, k.x + 0.02) : min(0.99, k.x + 0.085), k.y * sat * 0.95, k.z * sat * 0.95 + 0.012);
    else if (stufe == 2) r = vec3(hell ? k.x - 0.06 : k.x, k.y * sat, k.z * sat);
    else if (stufe == 1) r = vec3(max(0.16, k.x - (hell ? 0.2 : 0.13)), k.y * sat * 1.05 - 0.004, k.z * sat * 1.05 - 0.032);
    else r = vec3(max(0.13, min(0.27, k.x * 0.35)), k.y * 0.45 + 0.004, k.z * 0.45 - 0.03);
    return pxAusOklab(r);
  }
`;

const ABSCHLUSS = /* glsl */`
  {
    vec3 pxLum = vec3(0.2126, 0.7152, 0.0722);
    float pxBasis = max(dot(diffuseColor.rgb, pxLum), 1e-4);
    float pxLicht = dot(outgoingLight - totalEmissiveRadiance, pxLum) / pxBasis / max(uPxRef, 1e-3);
    int pxStufe = pxLicht < uPxSchatten ? 1 : (pxLicht < uPxHell ? 2 : 3);
    vec3 pxFarbe = pxRampe(diffuseColor.rgb, pxStufe) * uPxTint;
    float pxGlut = dot(totalEmissiveRadiance, pxLum);
    pxFarbe = mix(pxFarbe, outgoingLight, clamp(pxGlut * 3.0, 0.0, 1.0));
    gl_FragColor = vec4(pxFarbe, diffuseColor.a);
  }
`;

export function installiereGezeichnet(game, pass, { an = true } = {}) {
  const THREE = game.THREE;
  const U = {
    uPxRef: { value: 1 },
    uPxTint: { value: new THREE.Color(1, 1, 1) },
    uPxSchatten: { value: 0.62 },
    uPxHell: { value: 0.9 },
    uPxAn: { value: an ? 1 : 0 },
  };
  const gepatcht = new WeakSet();
  const LUM = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

  function patch(m) {
    if (gepatcht.has(m)) return;
    gepatcht.add(m);
    if (!(m.isMeshLambertMaterial || m.isMeshStandardMaterial || m.isMeshPhongMaterial)) return;
    if (m.transparent && m.depthWrite === false) return;   // Markierungen bleiben, wie sie sind
    const alt = m.onBeforeCompile;
    m.onBeforeCompile = (shader, r) => {
      alt?.call(m, shader, r);
      Object.assign(shader.uniforms, U);
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', `uniform float uPxRef; uniform vec3 uPxTint; uniform float uPxSchatten; uniform float uPxHell; uniform float uPxAn;\n${RAMPE_GLSL}\nvoid main() {`)
        .replace('#include <opaque_fragment>', `#include <opaque_fragment>\n if (uPxAn > 0.5) ${ABSCHLUSS}`);
    };
    const altKey = m.customProgramCacheKey?.bind(m);
    m.customProgramCacheKey = () => (altKey ? altKey() : '') + '|px-gezeichnet';
    m.needsUpdate = true;
  }

  pass.hooks.vorher.add(({ scene }) => {
    let sonne = null, himmel = null;
    scene.traverseVisible((o) => {
      if (o.isDirectionalLight && (!sonne || o.castShadow)) sonne = o;
      else if (o.isHemisphereLight) himmel = o;
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : null;
      if (mats) for (const m of mats) if (m && !gepatcht.has(m)) patch(m);
    });
    // Volles Sonnenlicht auf eine waagerechte Flaeche, so wie Lambert es rechnet (geteilt durch Pi)
    const s = sonne ? sonne.intensity * LUM(sonne.color) * Math.max(0.2, sonne.position.clone().sub(sonne.target.position).normalize().y) : 0;
    const h = himmel ? himmel.intensity * LUM(himmel.color) : 0.5;
    U.uPxRef.value = (s + h) / Math.PI;
    const tint = game.landscape?.licht?.zustand?.tint;
    if (tint) U.uPxTint.value.copy(tint); else U.uPxTint.value.setRGB(1, 1, 1);
    U.uPxAn.value = pass.state.gezeichnet === false ? 0 : 1;
  });

  return U;
}
