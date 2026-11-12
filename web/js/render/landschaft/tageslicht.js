// Tageslicht: Sonne, Himmel, Abendrot und Nacht, dazu Wetter und blinkende Leuchtfeuer.
// Alles ist von außen einstellbar (Uhrzeit, Wetter), damit Spielablauf und Ereignisse
// das Licht steuern können.
import * as THREE from 'three';
export { uhrzeitAusSpielzeit } from './zeit.js';

// Schlüsselbilder über 24 Stunden. Werte dazwischen werden weich gemischt.
// azimut: Himmelsrichtung der Sonne in Grad (0 Norden, 90 Osten, 180 Süden, 270 Westen)
// hoehe: Sonnenstand über dem Horizont in Grad
// tint: Färbung für Boden und Wasser (Shader ohne Licht), nacht: 0 Tag bis 1 Nacht
const SCHLUESSEL = [
  { h: 0,    himmel: '#1c2a44', hemiOben: '#7c8cc0', hemiUnten: '#3a4668', hemi: 1.25, sonne: '#a4b8e8', licht: 0.4,  azimut: 200, hoehe: 40, tint: '#6a78a8', nacht: 1 },
  { h: 4.5,  himmel: '#1f2e4a', hemiOben: '#8090c0', hemiUnten: '#3c486a', hemi: 1.25, sonne: '#a8bae8', licht: 0.4,  azimut: 240, hoehe: 30, tint: '#6e7caa', nacht: 1 },
  { h: 5.6,  himmel: '#e8b8a4', hemiOben: '#ffd4c0', hemiUnten: '#8c8ca4', hemi: 1.7,  sonne: '#ffae80', licht: 0.7,  azimut: 75,  hoehe: 5,  tint: '#ecc8bc', nacht: 0.3 },
  { h: 7.5,  himmel: '#cfe6ee', hemiOben: '#fff6ea', hemiUnten: '#a8bcc4', hemi: 2.1,  sonne: '#fff0d8', licht: 1.0,  azimut: 105, hoehe: 22, tint: '#fbf6ee', nacht: 0 },
  { h: 12.5, himmel: '#d4eef4', hemiOben: '#ffffff', hemiUnten: '#b0c4cc', hemi: 2.2,  sonne: '#ffffff', licht: 1.1,  azimut: 180, hoehe: 52, tint: '#ffffff', nacht: 0 },
  { h: 17,   himmel: '#d8ecf0', hemiOben: '#fffaf0', hemiUnten: '#acc0c8', hemi: 2.15, sonne: '#fff0d4', licht: 1.05, azimut: 240, hoehe: 30, tint: '#fffaf2', nacht: 0 },
  { h: 19,   himmel: '#f4c8a0', hemiOben: '#ffe2c8', hemiUnten: '#b0a4b0', hemi: 2.4,  sonne: '#ffa868', licht: 0.9,  azimut: 262, hoehe: 10, tint: '#ffe2c8', nacht: 0.05 },
  { h: 20.2, himmel: '#c48aa0', hemiOben: '#f0bcbc', hemiUnten: '#7c7498', hemi: 2.0,  sonne: '#ff7a58', licht: 0.55, azimut: 285, hoehe: 2,  tint: '#dcb4c0', nacht: 0.45 },
  { h: 21.3, himmel: '#3c4468', hemiOben: '#8c90c0', hemiUnten: '#464c72', hemi: 1.35, sonne: '#90a4dc', licht: 0.4,  azimut: 150, hoehe: 35, tint: '#8088b4', nacht: 0.9 },
  { h: 24,   himmel: '#1c2a44', hemiOben: '#7c8cc0', hemiUnten: '#3a4668', hemi: 1.25, sonne: '#a4b8e8', licht: 0.4,  azimut: 200, hoehe: 40, tint: '#6a78a8', nacht: 1 },
];

// Three.js rechnet Licht physikalisch. Mit diesem Faktor treffen beleuchtete Flächen am Mittag
// ungefähr die Pastellfarben aus regionen.js, statt auszubleichen.
const LICHT_FAKTOR = 1.0;

const FARBEN = ['himmel', 'hemiOben', 'hemiUnten', 'sonne', 'tint'];
const ZAHLEN = ['hemi', 'licht', 'hoehe', 'nacht'];
const SCHLUESSEL_C = SCHLUESSEL.map((k) => {
  const o = { ...k };
  for (const f of FARBEN) o[f] = new THREE.Color(k[f]);
  return o;
});

// Sturmhimmel, zu dem bei Bewölkung gemischt wird
const GRAU = { himmel: new THREE.Color('#8e9eaa'), tint: new THREE.Color('#b4bec4'), sonne: new THREE.Color('#d4dce0') };

function winkelMischen(a, b, t) {
  let d = ((b - a + 540) % 360) - 180;
  return a + d * t;
}

/**
 * Leuchtfeuer als leuchtender Punkt, der nach seiner Kennung blinkt.
 * kennung: 'Fl' Blitz, 'Oc' unterbrochen, 'Iso' gleich lang hell und dunkel, mit Periode in Sekunden.
 */
export function erzeugeLeuchtfeuer({ farbe = '#4ade80', kennung = 'Fl', periode = 4, groesse = 7 } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.18, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, color: farbe, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.setScalar(groesse);
  sprite.renderOrder = 10;
  const phase = Math.random() * periode;
  sprite.userData.aktualisiere = (zeit, nacht) => {
    const t = ((zeit + phase) % periode) / periode;
    let an;
    if (kennung === 'Oc') an = t < 0.75 ? 1 : 0;
    else if (kennung === 'Iso') an = t < 0.5 ? 1 : 0;
    else an = t < 0.15 ? 1 : 0;
    // Tagsüber nur schwach sichtbar, nachts kräftig
    mat.opacity = an * (0.25 + 0.75 * nacht);
    sprite.scale.setScalar(groesse * (0.6 + 0.6 * nacht));
  };
  return sprite;
}

/**
 * Erzeugt Licht und Himmel und hängt sie an die Szene.
 * @param {THREE.Scene} szene
 * @param {{schatten?: boolean, bereich?: number}} optionen bereich = halbe Kantenlänge des Schattenausschnitts in Metern
 */
export function erzeugeTageslicht(szene, { schatten = false, bereich = 170 } = {}) {
  const hemi = new THREE.HemisphereLight('#ffffff', '#90acb8', 2);
  hemi.name = 'landschaft-himmelslicht';
  const sonne = new THREE.DirectionalLight('#ffffff', 2.5);
  sonne.name = 'landschaft-sonne';
  const ziel = new THREE.Object3D();
  sonne.target = ziel;
  szene.add(hemi, sonne, ziel);
  if (!(szene.background instanceof THREE.Color)) szene.background = new THREE.Color();

  if (schatten) {
    sonne.castShadow = true;
    sonne.shadow.mapSize.set(2048, 2048);
    const cam = sonne.shadow.camera;
    cam.left = -bereich; cam.right = bereich; cam.top = bereich; cam.bottom = -bereich;
    cam.near = 1; cam.far = 900;
    sonne.shadow.bias = -0.0006;
    sonne.shadow.normalBias = 0.4;
  }

  const zustand = {
    uhrzeit: 12,
    nacht: 0,
    tint: new THREE.Color('#ffffff'),
    himmel: new THREE.Color('#d4eef4'),
    /** Richtung, in die Schatten fallen (Einheitsvektor auf dem Boden) */
    schattenRichtung: new THREE.Vector2(0, -1),
    /** Schattenlänge je Meter Objekthöhe */
    schattenLaenge: 1,
    sonnenHoehe: 50,
    wetter: { bewoelkung: 0, wind: 0.3 },
  };

  const tmp = {};
  for (const f of FARBEN) tmp[f] = new THREE.Color();
  const mitte = new THREE.Vector3();
  const listeners = new Set();

  function anwenden() {
    const h = ((zustand.uhrzeit % 24) + 24) % 24;
    let i = 0;
    while (i < SCHLUESSEL_C.length - 2 && SCHLUESSEL_C[i + 1].h <= h) i++;
    const a = SCHLUESSEL_C[i], b = SCHLUESSEL_C[i + 1];
    let t = (h - a.h) / (b.h - a.h);
    t = t * t * (3 - 2 * t);
    for (const f of FARBEN) tmp[f].copy(a[f]).lerp(b[f], t);
    const w = {};
    for (const z of ZAHLEN) w[z] = a[z] + (b[z] - a[z]) * t;
    const az = winkelMischen(a.azimut, b.azimut, t);

    // Wetter: Wolken dämpfen die Sonne und machen alles grauer
    const wolke = zustand.wetter.bewoelkung;
    tmp.himmel.lerp(GRAU.himmel, wolke * 0.75 * (1 - w.nacht * 0.6));
    tmp.tint.lerp(GRAU.tint, wolke * 0.45 * (1 - w.nacht));
    tmp.sonne.lerp(GRAU.sonne, wolke * 0.8);
    const sonnenKraft = 1 - wolke * 0.7;

    hemi.color.copy(tmp.hemiOben);
    hemi.groundColor.copy(tmp.hemiUnten);
    hemi.intensity = LICHT_FAKTOR * w.hemi * (1 + wolke * 0.15);
    sonne.color.copy(tmp.sonne);
    sonne.intensity = LICHT_FAKTOR * w.licht * sonnenKraft;
    szene.background.copy(tmp.himmel);

    const el = THREE.MathUtils.degToRad(Math.max(3, w.hoehe));
    const azR = THREE.MathUtils.degToRad(az);
    // Richtung zur Sonne in Weltkoordinaten (Norden = -z, Osten = +x)
    const dir = new THREE.Vector3(Math.sin(azR) * Math.cos(el), Math.sin(el), -Math.cos(azR) * Math.cos(el));
    sonne.position.copy(mitte).addScaledVector(dir, 400);
    ziel.position.copy(mitte);
    ziel.updateMatrixWorld();

    zustand.nacht = w.nacht;
    zustand.tint.copy(tmp.tint);
    zustand.himmel.copy(tmp.himmel);
    zustand.sonnenHoehe = w.hoehe;
    zustand.schattenRichtung.set(-dir.x, -dir.z).normalize();
    zustand.schattenLaenge = Math.min(6, 1 / Math.tan(el)) * sonnenKraft;
    for (const fn of listeners) fn(zustand);
  }

  const api = {
    hemi,
    sonne,
    zustand,
    /** Uhrzeit in Stunden (0..24, Kommazahlen erlaubt). */
    setzeUhrzeit(stunden) {
      zustand.uhrzeit = stunden;
      anwenden();
    },
    /** Wetter: bewoelkung 0..1, wind 0..1. */
    setzeWetter({ bewoelkung, wind } = {}) {
      if (bewoelkung != null) zustand.wetter.bewoelkung = THREE.MathUtils.clamp(bewoelkung, 0, 1);
      if (wind != null) zustand.wetter.wind = THREE.MathUtils.clamp(wind, 0, 1);
      anwenden();
    },
    /** Schattenausschnitt mitführen, z. B. auf die Kameramitte. */
    folge(x, z) {
      mitte.set(Math.round(x / 8) * 8, 0, Math.round(z / 8) * 8);
      anwenden();
    },
    /** fn(zustand) bei jeder Änderung von Licht oder Wetter. */
    beiAenderung(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    entsorge() {
      szene.remove(hemi, sonne, ziel);
      sonne.dispose?.();
      listeners.clear();
    },
  };
  anwenden();
  return api;
}
