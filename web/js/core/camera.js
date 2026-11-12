// Kamera-Rig: frei dreh- und neigbare Kamera ueber dem Hafen.
// Welt-Koordinaten in Metern: x nach Osten, z nach Sueden (Norden ist -z), y nach oben.
//
// Die Kamera umkreist einen Blickpunkt (target) auf dem Wasser:
//   yaw        Drehung um den Blickpunkt, 0 = Norden oben (frei, kein Einrasten mehr)
//   pitch      Neigung: 90 Grad waere senkrecht von oben, flach bis knapp ueber das Wasser
//   viewWidth  sichtbare Breite in Metern am Blickpunkt (Zoom). Bei der Perspektive ergibt sich
//              daraus der Abstand der Kamera zum Blickpunkt, also wie nah sie am Grund ist.
//
// Projektion: 'perspektive' (Standard, mit Horizont bei flachem Blick) oder 'ortho'
// (orthografisch, nutzt die Pixel-Fassung unter pixel/). rig.camera liefert die aktive Kamera.
//
// Grenzen: Je weiter herausgezoomt, desto steiler muss der Blick sein (sonst sieht man den
// Rand der Landschaft). Die Kamera bleibt immer ueber Wasser und Gelaende (rig.boden).
// Bewegungen: Ziehen wirkt sofort, beim Loslassen laeuft die Bewegung weich aus.
import * as THREE from 'three';

const DEG = Math.PI / 180;
export const PITCH_STANDARD = 50 * DEG;   // Neigung der Startansicht
const PITCH_MAX = 86 * DEG;               // fast senkrecht von oben
const PITCH_MIN_NAH = 9 * DEG;            // ganz hineingezoomt: knapp ueber dem Wasser
const PITCH_MIN_FERN = 32 * DEG;          // ganz herausgezoomt: noch Ueberblick, kein Landschaftsrand
const PITCH_MIN_ORTHO = 20 * DEG;         // Pixel-Fassung (orthografisch)
const STEP = Math.PI / 4;                 // Tasten Q und E drehen um 45 Grad
const FOV = 34;                           // senkrechter Bildwinkel der Perspektive in Grad
const ORTHO_DISTANCE = 600;
const BODEN_ABSTAND = 2.5;                // Meter, die die Kamera mindestens ueber Grund bleibt
const TRAEGHEIT = 4.5;                    // wie schnell eine losgelassene Bewegung auslaeuft (1/s)

export class CameraRig {
  constructor({ bounds, minWidth = 15, maxWidth = 420 }) {
    this.perspektive = new THREE.PerspectiveCamera(FOV, 1, 1, 4000);
    this.ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 2000);
    this.projektion = 'perspektive';
    this.bounds = bounds;                     // { minX, maxX, minZ, maxZ } in Metern
    this.minWidth = minWidth;                 // kleinster sichtbarer Ausschnitt in Metern (ganz hineingezoomt)
    this.maxWidth = maxWidth;
    this.target = new THREE.Vector3();
    this.viewWidth = maxWidth;
    this.aspect = 1;
    this.screenW = 1;
    this.screenH = 1;
    this.home = { x: 0, z: 0, width: maxWidth };
    this._plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._ray = new THREE.Raycaster();
    this.yaw = 0;
    this.pitch = PITCH_STANDARD;
    this.pitchStandard = PITCH_STANDARD;
    this._yawTarget = null;
    this._pitchTarget = null;
    this._fly = null;
    this._schwung = { yaw: 0, pitch: 0, x: 0, y: 0 };   // Nachlauf nach dem Loslassen
    this._letzt = { yaw: 0, pitch: 0, t: 0 };
    this.boden = null;                        // (x, z) -> Bodenhoehe in Metern, setzt core/game.js
    this.onChange = null;
  }

  // Aktive Kamera fuer renderer.render, project() und Raycaster
  get camera() {
    return this.projektion === 'ortho' ? this.ortho : this.perspektive;
  }

  // 'perspektive' oder 'ortho' (Pixel-Fassung)
  setProjektion(art) {
    this.projektion = art === 'ortho' ? 'ortho' : 'perspektive';
    this._apply();
  }

  // Startansicht als Mittelpunkt und Breite in Metern (einfach) ...
  setHome(x, z, width) {
    this.home = { x, z, width };
  }

  // ... oder als Rechteck auf dem Wasser, das ganz zu sehen sein soll.
  // rect = { minX, maxX, minZ, maxZ } in Metern. Besser fuer Hoch- und Querformat.
  // rect darf auch eine Funktion sein, die das Rechteck erst beim reset() liefert
  // (z. B. damit Bauplaetze, die Module spaeter anlegen, mit ins Bild kommen).
  setHomeRect(rect) {
    this.home = typeof rect === 'function' ? { rectFn: rect } : { rect };
  }

  // Bildschirmraender in CSS-Pixeln, die von Leisten verdeckt sind (oben, unten).
  // Die Startansicht passt das Rechteck in den freien Bereich dazwischen.
  setInsets(top, bottom) {
    this.insets = { top, bottom };
  }

  // Rechter Rand in CSS-Pixeln, den eine Knopfspalte verdeckt (Handy hochkant, ui/input-touch.js).
  // Die Startansicht passt das Rechteck in den freien Bereich links davon.
  setInsetRight(px) {
    this.insetRight = Math.max(0, px || 0);
  }

  // ---- Drehen ----
  // rotateFree: sofort um rad drehen (Ziehen mit Maus oder zwei Fingern). Danach release().
  rotateFree(rad) {
    this._yawTarget = null;
    this._merke('yaw', rad);
    this.yaw += rad;
    this._apply();
  }

  // rotateBy: weich um rad drehen, ausgehend vom naechsten 45-Grad-Schritt (Tasten Q und E)
  rotateBy(rad) {
    this._schwung.yaw = 0;
    const base = this._yawTarget ?? Math.round(this.yaw / STEP) * STEP;
    this._yawTarget = base + rad;
  }

  // Frueher: auf 45 Grad einrasten. Die Kamera dreht jetzt frei, beim Loslassen laeuft sie weich aus.
  snapRotation() {
    this.release();
  }

  // ---- Neigen ----
  // tiltFree: sofort um rad neigen, positiv = steiler (mehr von oben), negativ = flacher
  tiltFree(rad) {
    this._pitchTarget = null;
    this._merke('pitch', rad);
    this.pitch += rad;
    this._apply();
  }

  // tiltBy: weich um rad neigen (Tasten, Knoepfe)
  tiltBy(rad) {
    this._schwung.pitch = 0;
    this._pitchTarget = THREE.MathUtils.clamp((this._pitchTarget ?? this.pitch) + rad, this.pitchMin(), PITCH_MAX);
  }

  // setPitch: Neigung in Grad setzen, weich (Standard) oder sofort
  setPitch(grad, { sofort = false } = {}) {
    const rad = THREE.MathUtils.clamp(grad * DEG, this.pitchMin(), PITCH_MAX);
    if (sofort) { this._pitchTarget = null; this.pitch = rad; this._apply(); } else this._pitchTarget = rad;
  }

  // Weich zurueck: Norden oben und Standardneigung, Ort und Zoom bleiben (Kompass-Knopf)
  ausrichten() {
    this.stop();
    const runde = Math.round(this.yaw / (2 * Math.PI)) * 2 * Math.PI;
    this._yawTarget = runde;
    this._pitchTarget = Math.max(this.pitchStandard, this.pitchMin());
  }

  get pitchGrad() { return this.pitch / DEG; }
  get yawGrad() { return this.yaw / DEG; }

  // Flachste erlaubte Neigung beim aktuellen (oder angegebenen) Zoom
  pitchMin(width = this.viewWidth) {
    if (this.projektion === 'ortho') return PITCH_MIN_ORTHO;   // ohne Horizont: feste Grenze
    const lo = Math.log(this.minWidth), hi = Math.log(this.maxWidth);
    const t = THREE.MathUtils.clamp((Math.log(Math.max(width, 1)) - lo) / (hi - lo), 0, 1);
    return PITCH_MIN_NAH + (PITCH_MIN_FERN - PITCH_MIN_NAH) * Math.pow(t, 1.5);
  }

  // Finger oder Maus losgelassen: Drehen und Neigen laufen mit dem letzten Schwung weich aus
  release() {
    const jetzt = performance.now();
    if (jetzt - this._letzt.t > 80) { this._schwung.yaw = 0; this._schwung.pitch = 0; return; }
    const max = 3;   // rad pro Sekunde
    this._schwung.yaw = THREE.MathUtils.clamp(this._letzt.yaw * 0.7, -max, max);
    this._schwung.pitch = THREE.MathUtils.clamp(this._letzt.pitch * 0.5, -max, max);
  }

  // Verschieben losgelassen: vx, vy in Bildschirm-Pixeln pro Sekunde (Wischen mit Schwung)
  fling(vx, vy) {
    const max = 2500;
    const v = Math.hypot(vx, vy);
    if (v < 120) return;
    const k = Math.min(1, max / v);
    this._schwung.x = vx * k;
    this._schwung.y = vy * k;
  }

  // Jede Bewegung von aussen (neuer Finger, Klick) haelt den Nachlauf an
  stop() {
    this._schwung.yaw = this._schwung.pitch = this._schwung.x = this._schwung.y = 0;
  }

  _merke(art, rad) {
    const jetzt = performance.now();
    const dt = Math.max(0.008, (jetzt - this._letzt.t) / 1000);
    const v = rad / dt;
    const andere = art === 'yaw' ? 'pitch' : 'yaw';
    if (jetzt - this._letzt.t > 80) this._letzt[andere] = 0;
    this._letzt[art] = this._letzt[art] * 0.4 + v * 0.6;
    this._letzt.t = jetzt;
    this._schwung.yaw = this._schwung.pitch = 0;
  }

  // flyTo: Blickpunkt weich zu (x, z) fahren
  flyTo(x, z) {
    this._fly = { x, z };
  }

  // Jedes Bild aus der Spielschleife, dt in Sekunden (laeuft auch in der Pause)
  update(dt) {
    const k = 1 - Math.exp(-dt * 10);
    let changed = false;
    if (this._yawTarget !== null) {
      const d = this._yawTarget - this.yaw;
      if (Math.abs(d) < 0.001) { this.yaw = this._yawTarget; this._yawTarget = null; }
      else this.yaw += d * k;
      changed = true;
    }
    if (this._pitchTarget !== null) {
      const d = this._pitchTarget - this.pitch;
      if (Math.abs(d) < 0.001) { this.pitch = this._pitchTarget; this._pitchTarget = null; }
      else this.pitch += d * k;
      changed = true;
    }
    if (this._fly) {
      const dx = this._fly.x - this.target.x;
      const dz = this._fly.z - this.target.z;
      if (Math.hypot(dx, dz) < 0.05) { this.target.x = this._fly.x; this.target.z = this._fly.z; this._fly = null; }
      else { this.target.x += dx * k; this.target.z += dz * k; }
      changed = true;
    }
    const s = this._schwung;
    const abkling = Math.exp(-dt * TRAEGHEIT);
    if (s.yaw || s.pitch) {
      this.yaw += s.yaw * dt;
      this.pitch += s.pitch * dt;
      s.yaw *= abkling; s.pitch *= abkling;
      if (Math.abs(s.yaw) < 0.01) s.yaw = 0;
      if (Math.abs(s.pitch) < 0.01) s.pitch = 0;
      changed = true;
    }
    if (s.x || s.y) {
      this._pan(s.x * dt, s.y * dt);
      s.x *= abkling; s.y *= abkling;
      if (Math.hypot(s.x, s.y) < 15) s.x = s.y = 0;
      changed = true;
    }
    if (changed) this._apply();
  }

  // Startansicht: Drehung 0, Standardneigung, Rechteck passend in den freien Bereich
  reset() {
    this._yawTarget = null;
    this._pitchTarget = null;
    this._fly = null;
    this.stop();
    this.yaw = 0;
    this.pitch = this.pitchStandard;
    const h = this.home;
    if (this.insetsFn) {
      try { const [top, bottom] = this.insetsFn(); this.insets = { top, bottom }; } catch (err) { /* alte Werte behalten */ }
    }
    const ins = this.insets || { top: 0, bottom: 0 };
    let rect = h.rect;
    if (h.rectFn) {
      try { rect = h.rectFn(); } catch (err) { console.warn('Startansicht nicht berechenbar', err); }
    }
    if (!rect) {
      this.target.set(h.x, 0, h.z);
      this.viewWidth = h.width;
      this._homeWidth = this.viewWidth;
      this._apply();
      const shift = (ins.top - ins.bottom) / 2;
      if (shift) this.panBy(0, shift);
      return;
    }
    this._passeEin(rect, {
      left: this.insetLeft || 0,   // Schilderspalte links (Handy quer), setzt main.js
      right: Math.max((this.insetLeft || 0) + 1, this.screenW - (this.insetRight || 0)),
      top: ins.top,
      bottom: Math.max(ins.top + 1, this.screenH - ins.bottom),
    });
  }

  // Rechteck (Weltmeter, y = 0) so einpassen, dass es ganz im Bildschirmbereich frei liegt.
  // Ist mehr Hoehe frei als noetig (Hochformat), liegt das Rechteck unten (Ufer unten,
  // darueber Wasser), damit nicht der halbe Bildschirm Land zeigt.
  _passeEin(r, frei) {
    const ecken = [[r.minX, r.minZ], [r.maxX, r.minZ], [r.minX, r.maxZ], [r.maxX, r.maxZ]].map(([x, z]) => new THREE.Vector3(x, 0, z));
    const availW = frei.right - frei.left;
    const availH = frei.bottom - frei.top;
    const maxW = this.maxWidth * 1.6;   // Handy quer: der ganze Hafen darf weiter heraus als maxWidth
    // Startwert wie bei der orthografischen Sicht
    const sinP = Math.sin(this.pitch);
    this.viewWidth = THREE.MathUtils.clamp(Math.max((r.maxX - r.minX) * this.screenW / availW, (r.maxZ - r.minZ) * sinP * this.screenW / availH), this.minWidth, maxW);
    this.target.set((r.minX + r.maxX) / 2, 0, (r.minZ + r.maxZ) / 2);
    const _v = new THREE.Vector3();
    for (let i = 0; i < 8; i++) {
      this._apply();
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const e of ecken) {
        _v.copy(e).project(this.camera);
        const sx = (_v.x + 1) / 2 * this.screenW, sy = (1 - _v.y) / 2 * this.screenH;
        x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
      }
      const s = Math.max((x1 - x0) / availW, (y1 - y0) / availH);
      // Bildmitte des Rechtecks auf die Mitte des freien Bereichs (bzw. unten anlegen)
      const zielX = (frei.left + frei.right) / 2;
      const rectH = (y1 - y0) / s;
      const zielY = rectH < availH - 1 ? frei.bottom - rectH / 2 : (frei.top + frei.bottom) / 2;
      const a = this.screenToWorld((x0 + x1) / 2, (y0 + y1) / 2);
      const b = this.screenToWorld(this.screenW / 2 + (zielX - this.screenW / 2) * s, this.screenH / 2 + (zielY - this.screenH / 2) * s);
      const c = this.screenToWorld(this.screenW / 2, this.screenH / 2);
      this.viewWidth = THREE.MathUtils.clamp(this.viewWidth * s, this.minWidth, maxW);
      if (a && b && c) {
        this.target.x += a.x - this.target.x - (b.x - c.x);
        this.target.z += a.z - this.target.z - (b.z - c.z);
      }
      if (Math.abs(s - 1) < 0.002 && i > 1) break;
    }
    this._homeWidth = this.viewWidth;
    this._apply();
  }

  resize(width, height) {
    this.screenW = Math.max(1, width);
    this.screenH = Math.max(1, height);
    this.aspect = this.screenW / this.screenH;
    this._apply();
  }

  // Bildschirmpunkt (CSS-Pixel) auf die Wasserflaeche y = 0 projizieren.
  // Liefert null, wenn der Punkt ueber dem Horizont liegt (Himmel).
  screenToWorld(sx, sy, out = new THREE.Vector3()) {
    const ndc = new THREE.Vector2((sx / this.screenW) * 2 - 1, -(sy / this.screenH) * 2 + 1);
    this._ray.setFromCamera(ndc, this.camera);
    return this._ray.ray.intersectPlane(this._plane, out);
  }

  // Um einen Bildschirmpunkt zoomen. factor > 1 zoomt hinein.
  zoomAt(factor, sx = this.screenW / 2, sy = this.screenH / 2) {
    let before = this.screenToWorld(sx, sy);
    if (!before) { sx = this.screenW / 2; sy = this.screenH / 2; before = this.screenToWorld(sx, sy); }
    this.viewWidth = THREE.MathUtils.clamp(this.viewWidth / factor, this.minWidth, Math.max(this.maxWidth, this._homeWidth || 0));
    this._apply();   // beim Herauszoomen wird die Kamera dabei steiler, wenn sie sonst zu flach waere
    const after = this.screenToWorld(sx, sy);
    if (before && after) {
      this.target.x += before.x - after.x;
      this.target.z += before.z - after.z;
    }
    this._apply();
  }

  // Um Bildschirm-Pixel verschieben (Finger zieht die Karte mit).
  panBy(dx, dy) {
    this._schwung.x = this._schwung.y = 0;
    this._pan(dx, dy);
  }

  _pan(dx, dy) {
    // Bezugspunkt ist der Blickpunkt (Bildmitte): so bleibt das Tempo auch bei flachem Blick,
    // wo Punkte am Horizont sonst unendlich weit weg waeren, gleichmaessig.
    const cx = this.screenW / 2, cy = this.screenH / 2;
    const a = this.screenToWorld(cx, cy);
    let b = this.screenToWorld(cx + dx, cy + dy);
    if (!a) return;
    if (!b) {
      // Ziel ueber dem Horizont: in der Bodenebene mit dem Massstab der Bildmitte rechnen
      const m = this._meterProPixel();
      const f = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));   // nach oben im Bild
      const r = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));    // nach rechts im Bild
      b = a.clone().addScaledVector(r, dx * m).addScaledVector(f, -dy * m / Math.max(0.2, Math.sin(this.pitch)));
    }
    this.target.x -= b.x - a.x;
    this.target.z -= b.z - a.z;
    this._apply();
  }

  _meterProPixel() {
    return this.viewWidth / this.screenW;
  }

  _clamp() {
    const b = this.bounds;
    this.target.x = THREE.MathUtils.clamp(this.target.x, b.minX, b.maxX);
    this.target.z = THREE.MathUtils.clamp(this.target.z, b.minZ, b.maxZ);
    this.pitch = Math.min(PITCH_MAX, Math.max(this.pitch, this.pitchMin()));
  }

  // Abstand der perspektivischen Kamera zum Blickpunkt, damit viewWidth am Blickpunkt passt
  get distance() {
    const tan = Math.tan(FOV * DEG / 2);
    return (this.viewWidth / 2) / (tan * this.aspect);
  }

  // Richtung vom Blickpunkt zur Kamera
  _richtung(out = new THREE.Vector3()) {
    return out.set(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch),
    );
  }

  // Bleibt die Sichtlinie vom Blickpunkt zur Kamera ueber dem Gelaende? Sonst steiler.
  _ueberGrund(dist) {
    if (typeof this.boden !== 'function') return;
    const dir = this._richtung();
    for (let n = 0; n < 12; n++) {
      let frei = true;
      for (const t of [0.15, 0.3, 0.5, 0.7, 1]) {
        const x = this.target.x + dir.x * dist * t;
        const z = this.target.z + dir.z * dist * t;
        let h = 0;
        try { h = this.boden(x, z) || 0; } catch { h = 0; }
        if (dir.y * dist * t < Math.max(0, h) + BODEN_ABSTAND * t) { frei = false; break; }
      }
      if (frei) return;
      this.pitch = Math.min(PITCH_MAX, this.pitch + 2 * DEG);
      this._richtung(dir);
    }
  }

  _apply() {
    this._clamp();
    const w = this.viewWidth;
    const halfW = w / 2;
    const halfH = halfW / this.aspect;
    if (this.projektion === 'ortho') {
      const cam = this.ortho;
      cam.left = -halfW; cam.right = halfW; cam.top = halfH; cam.bottom = -halfH;
      cam.position.copy(this.target).addScaledVector(this._richtung(), ORTHO_DISTANCE);
      cam.lookAt(this.target);
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld();   // sonst rechnen screenToWorld und panBy bis zum naechsten Bild mit der alten Lage
    } else {
      const cam = this.perspektive;
      const dist = this.distance;
      if (this.pitch < 40 * DEG) this._ueberGrund(dist);
      cam.fov = FOV;
      cam.aspect = this.aspect;
      // Nahe Ebene so weit weg wie moeglich (bessere Tiefengenauigkeit), ferne bis zum Horizont
      cam.near = Math.max(0.5, dist * 0.12);
      cam.far = Math.max(2500, dist * 8);
      cam.position.copy(this.target).addScaledVector(this._richtung(), dist);
      cam.lookAt(this.target);
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld();
    }
    if (this.onChange) this.onChange();
  }
}
