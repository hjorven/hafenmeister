// Wettereffekte direkt in der 3D-Szene: Sturmtönung, Nebel mit ziehenden Schleiern, Regen,
// Schnee, Blitz und Feuerwerk am Abend des Hafenfests.
//
// Früher lag hier eine zweite 2D-Leinwand über dem Spiel, die jedes Bild neu gemalt und vom
// Browser über das 3D-Bild gelegt wurde. Das kostete auf allen Geräten spürbar Bildrate
// (docs/ereignisse.md, Abschnitt Leistung). Jetzt zeichnet ein einziges Dreieck über den ganzen
// Bildschirm alles in einem Shader-Durchgang, als letztes Objekt der Szene. Ist kein Effekt zu
// sehen, wird es gar nicht gezeichnet. Das Feuerwerk sind wenige Punkte im selben Durchgang.
//
// Alle Bewegungen laufen nach echter Uhr, nicht nach Spieltempo: Regen fällt bei 8x genauso
// wie bei 1x und läuft in der Pause weiter (wie das Wasser).

const MAX_FUNKEN = 384;

const VERTEX = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// Alle Größen in CSS-Pixeln (uPx = Bildpunkte je CSS-Pixel), damit Regen und Schnee auf jedem
// Gerät gleich groß aussehen.
const FRAGMENT = /* glsl */`
  precision highp float;
  varying vec2 vUv;
  uniform vec2 uGroesse;     // Zeichenfläche in CSS-Pixeln
  uniform float uZeit;
  uniform float uWind;
  uniform float uNebel;
  uniform float uRegen;
  uniform float uSchnee;
  uniform float uTruebe;
  uniform float uBlitz;

  float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
  float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float rauschen(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash2(i), b = hash2(i + vec2(1.0, 0.0)), c = hash2(i + vec2(0.0, 1.0)), d = hash2(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  // Eine Lage Regen: schräge Striche in Spalten, jede Spalte mit eigenem Versatz und Tempo
  float regenLage(vec2 px, float abstand, float laenge, float tempo, float dichte, float saat) {
    float neigung = uWind * 0.6;
    vec2 p = vec2(px.x - px.y * neigung, px.y);
    float spalte = floor(p.x / abstand);
    float h = hash(spalte + saat);
    if (h > dichte) return 0.0;
    float v = tempo * (0.8 + 0.4 * hash(spalte * 1.7 + saat));
    float periode = laenge * 6.0 + 120.0 * hash(spalte * 3.1 + saat);
    float y = mod(p.y - uZeit * v + h * 997.0, periode);
    float dx = abs(fract(p.x / abstand) - 0.5) * abstand;
    float strich = (1.0 - smoothstep(0.35, 0.9, dx)) * step(y, laenge);
    return strich * smoothstep(0.0, laenge * 0.5, y);
  }

  // Eine Lage Schnee: je Zelle eine Flocke, die fällt und seitlich pendelt
  float schneeLage(vec2 px, float zelle, float tempo, float r, float dichte, float saat) {
    vec2 p = px;
    p.y -= uZeit * tempo;
    p.x -= uZeit * uWind * 30.0;
    vec2 z = floor(p / zelle);
    float h = hash2(z + saat);
    if (h > dichte) return 0.0;
    vec2 mitte = (z + vec2(0.2 + 0.6 * hash2(z + saat + 3.1), 0.2 + 0.6 * h)) * zelle;
    mitte.x += sin(uZeit * (0.8 + h) + h * 6.28) * zelle * 0.18;
    float d = length(p - mitte);
    float rr = r * (0.6 + 0.8 * hash2(z + saat + 7.3));
    return 1.0 - smoothstep(rr - 0.6, rr + 0.6, d);
  }

  void main() {
    // Bildschirmpunkt in CSS-Pixeln, y nach unten wie im Browser
    vec2 px = vec2(vUv.x, 1.0 - vUv.y) * uGroesse;
    vec3 farbe = vec3(0.0);
    float alpha = 0.0;

    // Sturmtönung und trübes Licht
    if (uTruebe > 0.002) {
      vec3 c = vec3(0.157, 0.212, 0.282);
      farbe = c; alpha = uTruebe;
    }

    // Nebel: Stimmung statt Wand. Leichter Schleier über allem, dichter am Bildrand, die Mitte
    // (wo man spielt) bleibt klar, dazu zarte Schwaden, die langsam ziehen. Höchstwerte bewusst
    // klein, damit Stege, Boote und Bojen gut erkennbar bleiben (Werte aus PR 91).
    if (uNebel > 0.01) {
      float innen = min(uGroesse.x, uGroesse.y) * 0.32;
      float aussen = length(uGroesse) * 0.6;
      float rand = clamp((length(px - uGroesse * 0.5) - innen) / max(aussen - innen, 1.0), 0.0, 1.0);
      vec2 q = px / max(uGroesse.x, uGroesse.y) * 2.6;
      q.x -= uZeit * (0.02 + 0.04 * uWind);
      float n = rauschen(q) * 0.6 + rauschen(q * 2.1 + 4.7) * 0.4;
      float schwaden = smoothstep(0.4, 0.8, n);
      float a = 1.0 - (1.0 - 0.08 * uNebel) * (1.0 - 0.38 * uNebel * rand) * (1.0 - 0.1 * uNebel * schwaden);
      vec3 c = vec3(0.94, 0.96, 0.97);
      float neu = a + alpha * (1.0 - a);
      farbe = (c * a + farbe * alpha * (1.0 - a)) / max(neu, 1e-4);
      alpha = neu;
    }

    // Regen in zwei Lagen (nah: lang und kräftig, fern: kurz und blass)
    if (uRegen > 0.01) {
      float r = regenLage(px, 9.0, 18.0, 780.0, uRegen * 0.42, 1.0) * 0.55
              + regenLage(px + vec2(4.0, 0.0), 7.0, 10.0, 540.0, uRegen * 0.3, 9.0) * 0.3;
      vec3 c = vec3(0.86, 0.91, 0.94);
      float a = clamp(r, 0.0, 1.0);
      float neu = a + alpha * (1.0 - a);
      farbe = (c * a + farbe * alpha * (1.0 - a)) / max(neu, 1e-4);
      alpha = neu;
    }

    // Schnee in zwei Lagen
    if (uSchnee > 0.01) {
      float s = schneeLage(px, 34.0, 38.0, 2.4, uSchnee * 0.45, 2.0)
              + schneeLage(px, 24.0, 22.0, 1.4, uSchnee * 0.35, 5.0) * 0.7;
      float a = clamp(s, 0.0, 1.0) * 0.85;
      float neu = a + alpha * (1.0 - a);
      farbe = (vec3(1.0) * a + farbe * alpha * (1.0 - a)) / max(neu, 1e-4);
      alpha = neu;
    }

    // Blitz: kurzes Aufhellen
    if (uBlitz > 0.0) {
      float a = uBlitz * 0.35;
      float neu = a + alpha * (1.0 - a);
      farbe = (vec3(1.0, 1.0, 0.98) * a + farbe * alpha * (1.0 - a)) / max(neu, 1e-4);
      alpha = neu;
    }

    if (alpha < 0.002) discard;
    gl_FragColor = vec4(farbe, alpha);
  }
`;

const FUNKEN_VERTEX = /* glsl */`
  attribute float alter;
  attribute vec3 farbe;
  uniform float uPunkt;
  varying float vHell;
  varying vec3 vFarbe;
  void main() {
    vHell = alter;
    vFarbe = farbe;
    gl_Position = vec4(position.xy, 0.0, 1.0);
    gl_PointSize = alter > 0.0 ? uPunkt : 0.0;
  }
`;
const FUNKEN_FRAGMENT = /* glsl */`
  precision mediump float;
  varying float vHell;
  varying vec3 vFarbe;
  void main() {
    if (vHell <= 0.0) discard;
    gl_FragColor = vec4(vFarbe * vHell, 1.0);
  }
`;

/** Reine Hilfsfunktion (auch für Tests): sichtbare Stärken aus dem Wetter. */
export function effektStaerken(cur) {
  return {
    truebe: Math.max(0, cur.rain * 0.18 + (1 - cur.sun) * 0.08),
    nebel: cur.fog,
    regen: cur.rain,
    schnee: cur.snow,
  };
}

export function initEffects(game) {
  const THREE = game.THREE;
  const scene = game.scene;
  const renderer = game.renderer;
  if (!THREE || !scene || !renderer) return;

  const systemRuhig = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  // Einstellung "Weniger Bewegung" (ui/einstellungen.js) gilt sofort, ohne Neuladen
  let reduced = game.einstellungen ? game.einstellungen.wert('ruhig') : systemRuhig;
  game.on?.('einstellungen', ({ alle } = {}) => { if (alle) reduced = !!alle.ruhig; });

  // Zielwerte (aus 'weather') und aktuelle, weich überblendete Werte
  const target = { wind: 0.2, fog: 0, rain: 0, snow: 0, sun: 0.7 };
  const cur = { ...target };
  let fireworks = false;
  let flash = 0;
  let rocketTimer = 0;

  // Ein Dreieck, das den ganzen Bildschirm abdeckt (Ecken in Bildschirmkoordinaten -1..3)
  const dreieck = new THREE.BufferGeometry();
  dreieck.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const uniforms = {
    uGroesse: { value: new THREE.Vector2(1, 1) },
    uZeit: { value: 0 },
    uWind: { value: 0.2 },
    uNebel: { value: 0 },
    uRegen: { value: 0 },
    uSchnee: { value: 0 },
    uTruebe: { value: 0 },
    uBlitz: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });
  const schleier = new THREE.Mesh(dreieck, material);
  schleier.name = 'wetter-effekte';
  schleier.frustumCulled = false;
  schleier.renderOrder = 1e6;          // nach allem anderen, auch nach durchsichtigen Dingen
  schleier.matrixAutoUpdate = false;
  schleier.raycast = () => {};          // nie antippbar
  schleier.visible = false;
  scene.add(schleier);

  // Feuerwerk: feste Anzahl Punkte, nur die lebenden leuchten
  const fPos = new Float32Array(MAX_FUNKEN * 3);
  const fAlter = new Float32Array(MAX_FUNKEN);
  const fFarbe = new Float32Array(MAX_FUNKEN * 3);
  const funkenGeo = new THREE.BufferGeometry();
  funkenGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3).setUsage(THREE.DynamicDrawUsage));
  funkenGeo.setAttribute('alter', new THREE.BufferAttribute(fAlter, 1).setUsage(THREE.DynamicDrawUsage));
  funkenGeo.setAttribute('farbe', new THREE.BufferAttribute(fFarbe, 3).setUsage(THREE.DynamicDrawUsage));
  const funkenMat = new THREE.ShaderMaterial({
    vertexShader: FUNKEN_VERTEX,
    fragmentShader: FUNKEN_FRAGMENT,
    uniforms: { uPunkt: { value: 3 } },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const funken = new THREE.Points(funkenGeo, funkenMat);
  funken.name = 'wetter-feuerwerk';
  funken.frustumCulled = false;
  funken.renderOrder = 1e6 + 1;
  funken.matrixAutoUpdate = false;
  funken.raycast = () => {};
  funken.visible = false;
  scene.add(funken);
  // Funken in CSS-Pixeln: x, y, vx, vy, alter, leben
  const sparks = [];

  game.on('weather', (wx) => {
    if (!wx) return;
    for (const k of Object.keys(target)) target[k] = wx[k] ?? 0;
  });

  const updateFireworks = () => {
    const ev = game.events?.current?.event;
    fireworks = !!ev && ev.evening === 'feuerwerk' && game.events.phase === 'abend';
  };
  game.on('event:phase', updateFireworks);
  game.on('event:start', updateFireworks);
  game.on('event:end', () => { fireworks = false; });

  function groesse() {
    const c = renderer.domElement;
    return { w: c.clientWidth || c.width || 1, h: c.clientHeight || c.height || 1 };
  }

  const FARBEN = [8, 45, 190, 120, 320].map((h) => new THREE.Color().setHSL(h / 360, 0.9, 0.65));
  function spawnRocket() {
    const { w, h } = groesse();
    const x = w * (0.2 + Math.random() * 0.6);
    const y = h * (0.15 + Math.random() * 0.3);
    const farbe = FARBEN[Math.floor(Math.random() * FARBEN.length)];
    const n = reduced ? 24 : 48;
    for (let i = 0; i < n && sparks.length < MAX_FUNKEN; i++) {
      const a = (i / n) * Math.PI * 2;
      const sp = 60 + Math.random() * 60;
      sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1.4 + Math.random() * 0.5, age: 0, farbe });
    }
    game.emit('sound', { name: 'feuerwerk' });
  }

  // Echte Zeit statt Spieltempo
  let letzt = performance.now();
  let zeit = 0;
  game.onTick(() => {
    const jetzt = performance.now();
    const dt = Math.min(0.1, Math.max(0, (jetzt - letzt) / 1000));
    letzt = jetzt;
    zeit += dt;

    // Weich überblenden (etwa 3 Sekunden)
    const k = Math.min(1, dt * 0.35);
    for (const key of Object.keys(cur)) cur[key] += (target[key] - cur[key]) * k;

    // Blitz bei Sturm: kurzes, seltenes Aufhellen (nicht bei reduzierter Bewegung)
    if (!reduced && !game.paused && cur.rain > 0.8 && cur.wind > 0.8 && Math.random() < dt * 0.06) {
      flash = 1;
      game.emit('sound', { name: 'donner' });
    }
    if (flash > 0) flash = Math.max(0, flash - dt * 4);

    const s = effektStaerken(cur);
    const { w, h } = groesse();
    uniforms.uGroesse.value.set(w, h);
    // Zeit im Shader begrenzen, damit sin() und mod() auch nach Stunden genau bleiben
    uniforms.uZeit.value = zeit % 3600;
    uniforms.uWind.value = cur.wind;
    uniforms.uNebel.value = s.nebel > 0.02 ? s.nebel : 0;
    uniforms.uRegen.value = s.regen * (reduced ? 0.35 : 1);
    uniforms.uSchnee.value = s.schnee * (reduced ? 0.35 : 1);
    uniforms.uTruebe.value = s.truebe > 0.01 ? s.truebe : 0;
    uniforms.uBlitz.value = flash;
    schleier.visible = uniforms.uNebel.value > 0 || uniforms.uRegen.value > 0.01 || uniforms.uSchnee.value > 0.01
      || uniforms.uTruebe.value > 0 || flash > 0;

    // Feuerwerk
    if (fireworks && !game.paused) {
      rocketTimer -= dt;
      if (rocketTimer <= 0) { spawnRocket(); rocketTimer = 0.9 + Math.random() * 1.4; }
    }
    if (sparks.length) {
      for (let i = sparks.length - 1; i >= 0; i--) {
        const sp = sparks[i];
        sp.age += dt;
        if (sp.age >= sp.life) { sparks.splice(i, 1); continue; }
        sp.vy += 40 * dt; sp.vx *= 1 - dt * 0.8; sp.vy *= 1 - dt * 0.8;
        sp.x += sp.vx * dt; sp.y += sp.vy * dt;
      }
      for (let i = 0; i < MAX_FUNKEN; i++) {
        const sp = sparks[i];
        if (!sp) { fAlter[i] = 0; continue; }
        fPos[i * 3] = (sp.x / w) * 2 - 1;
        fPos[i * 3 + 1] = 1 - (sp.y / h) * 2;
        fAlter[i] = 1 - sp.age / sp.life;
        fFarbe[i * 3] = sp.farbe.r; fFarbe[i * 3 + 1] = sp.farbe.g; fFarbe[i * 3 + 2] = sp.farbe.b;
      }
      funkenMat.uniforms.uPunkt.value = 3 * renderer.getPixelRatio();
      funkenGeo.attributes.position.needsUpdate = true;
      funkenGeo.attributes.alter.needsUpdate = true;
      funkenGeo.attributes.farbe.needsUpdate = true;
      funken.visible = true;
    } else if (funken.visible) {
      funken.visible = false;
    }
  });

  game.wetterEffekte = {
    /** Aktuelle, überblendete Werte (zum Prüfen). */
    get stand() { return { ...cur, blitz: flash, funken: sparks.length, sichtbar: schleier.visible }; },
    /** Sofort auf das Ziel springen (Tests, Fotomodus). */
    sofort() { Object.assign(cur, target); },
  };
}
