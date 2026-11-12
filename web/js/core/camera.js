// Kamera-Rig: orthografische Schraegsicht von Sueden auf den Hafen.
// Welt-Koordinaten in Metern: x nach Osten, z nach Sueden (Norden ist -z), y nach oben.
import * as THREE from 'three';

const PITCH = THREE.MathUtils.degToRad(50);   // Neigung: 90 waere senkrecht von oben
const STEP = Math.PI / 4;                     // Drehen rastet in 45-Grad-Schritten ein
const DISTANCE = 600;

export class CameraRig {
  constructor({ bounds, minWidth = 15, maxWidth = 480 }) {
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 2000);
    this.bounds = bounds;                     // { minX, maxX, minZ, maxZ } in Metern
    this.minWidth = minWidth;                 // kleinster sichtbarer Ausschnitt in Metern (ganz hineingezoomt)
    this.maxWidth = maxWidth;
    this.target = new THREE.Vector3();
    this.viewWidth = maxWidth;
    this.aspect = 1;
    this.home = { x: 0, z: 0, width: maxWidth };
    this._plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._ray = new THREE.Raycaster();
    this.yaw = 0;                             // Drehung um den Blickpunkt, 0 = Norden oben
    this._yawTarget = null;
    this._fly = null;
    this.onChange = null;
  }

  // Startansicht als Mittelpunkt und Breite in Metern (einfach) ...
  setHome(x, z, width) {
    this.home = { x, z, width };
  }

  // ... oder als Rechteck auf dem Wasser, das in jeder Ausrichtung ganz zu sehen sein soll.
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
  // rotateFree: sofort um rad drehen (Ziehen mit Maus oder zwei Fingern), danach snapRotation()
  rotateFree(rad) {
    this._yawTarget = null;
    this.yaw += rad;
    this._apply();
  }

  // rotateBy: weich um rad drehen, ausgehend vom naechsten Rastpunkt (Tasten Q und E)
  rotateBy(rad) {
    const base = this._yawTarget ?? Math.round(this.yaw / STEP) * STEP;
    this._yawTarget = base + rad;
  }

  // snapRotation: weich auf den naechsten 45-Grad-Schritt einrasten
  snapRotation() {
    this._yawTarget = Math.round(this.yaw / STEP) * STEP;
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
    if (this._fly) {
      const dx = this._fly.x - this.target.x;
      const dz = this._fly.z - this.target.z;
      if (Math.hypot(dx, dz) < 0.05) { this.target.x = this._fly.x; this.target.z = this._fly.z; this._fly = null; }
      else { this.target.x += dx * k; this.target.z += dz * k; }
      changed = true;
    }
    if (changed) this._apply();
  }

  reset() {
    this._yawTarget = null;
    this._fly = null;
    this.yaw = 0;
    const h = this.home;
    if (this.insetsFn) {
      try { const [top, bottom] = this.insetsFn(); this.insets = { top, bottom }; } catch (err) { /* alte Werte behalten */ }
    }
    const ins = this.insets || { top: 0, bottom: 0 };
    let rect = h.rect;
    if (h.rectFn) {
      try { rect = h.rectFn(); } catch (err) { console.warn('Startansicht nicht berechenbar', err); }
    }
    const right = rect ? (this.insetRight || 0) : 0;
    if (rect) {
      const r = rect;
      const w = r.maxX - r.minX;
      const sinP = Math.sin(PITCH);
      const availH = Math.max(1, this.screenH - ins.top - ins.bottom);
      const availW = Math.max(1, this.screenW - right);
      const aspectAvail = this.screenW / availH;
      // Auf flachen Bildschirmen (Handy quer) darf die Uebersicht weiter heraus als maxWidth,
      // damit der ganze Hafen ins Bild passt; Herauszoomen reicht dann bis hierhin.
      this.viewWidth = THREE.MathUtils.clamp(Math.max(w * this.screenW / availW, (r.maxZ - r.minZ) * sinP * aspectAvail), this.minWidth, this.maxWidth * 1.6);
      this._homeWidth = this.viewWidth;
      let cz = (r.minZ + r.maxZ) / 2;
      // Ist mehr Tiefe frei als noetig (Hochformat), den Ausschnitt an die Suedkante (Ufer) legen,
      // damit nicht der halbe Bildschirm Land zeigt.
      const visibleDepth = (availH * this.viewWidth / this.screenW) / sinP;
      if (visibleDepth > r.maxZ - r.minZ) cz = r.maxZ - visibleDepth / 2;
      this.target.set((r.minX + r.maxX) / 2, 0, cz);
    } else {
      this.target.set(h.x, 0, h.z);
      this.viewWidth = h.width;
    }
    this._apply();
    // Mitte des freien Bereichs liegt um (oben - unten) / 2 tiefer als die Bildschirmmitte
    // und um rechts / 2 weiter links (Knopfspalte am Handy)
    const shift = (ins.top - ins.bottom) / 2;
    if (shift || right) this.panBy(-right / 2, shift);
  }

  resize(width, height) {
    this.screenW = width;
    this.screenH = height;
    this.aspect = width / Math.max(1, height);
    this._apply();
  }

  // Bildschirmpunkt (CSS-Pixel) auf die Wasserflaeche y = 0 projizieren.
  screenToWorld(sx, sy, out = new THREE.Vector3()) {
    const ndc = new THREE.Vector2((sx / this.screenW) * 2 - 1, -(sy / this.screenH) * 2 + 1);
    this._ray.setFromCamera(ndc, this.camera);
    return this._ray.ray.intersectPlane(this._plane, out);
  }

  // Um einen Bildschirmpunkt zoomen. factor > 1 zoomt hinein.
  zoomAt(factor, sx = this.screenW / 2, sy = this.screenH / 2) {
    const before = this.screenToWorld(sx, sy);
    this.viewWidth = THREE.MathUtils.clamp(this.viewWidth / factor, this.minWidth, Math.max(this.maxWidth, this._homeWidth || 0));
    this._apply();
    const after = this.screenToWorld(sx, sy);
    if (before && after) {
      this.target.x += before.x - after.x;
      this.target.z += before.z - after.z;
    }
    this._apply();
  }

  // Um Bildschirm-Pixel verschieben (Finger zieht die Karte mit).
  panBy(dx, dy) {
    const a = this.screenToWorld(0, 0);
    const b = this.screenToWorld(dx, dy);
    if (!a || !b) return;
    this.target.x -= b.x - a.x;
    this.target.z -= b.z - a.z;
    this._apply();
  }

  _clamp() {
    const b = this.bounds;
    this.target.x = THREE.MathUtils.clamp(this.target.x, b.minX, b.maxX);
    this.target.z = THREE.MathUtils.clamp(this.target.z, b.minZ, b.maxZ);
  }

  _apply() {
    this._clamp();
    const w = this.viewWidth;
    // Im Hochformat zaehlt die Breite, im Querformat soll die Hoehe nicht zu klein werden.
    const halfW = w / 2;
    const halfH = halfW / this.aspect;
    const cam = this.camera;
    cam.left = -halfW; cam.right = halfW; cam.top = halfH; cam.bottom = -halfH;
    const dir = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(PITCH),
      Math.sin(PITCH),
      Math.cos(this.yaw) * Math.cos(PITCH)
    );
    cam.position.copy(this.target).addScaledVector(dir, DISTANCE);
    cam.lookAt(this.target);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();   // sonst rechnen screenToWorld und panBy bis zum naechsten Bild mit der alten Lage
    if (this.onChange) this.onChange();
  }
}
