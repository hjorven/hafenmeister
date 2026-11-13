// Landschaft gesamt: Gelände, Wasser, Licht und Wartebereich in einem Objekt.
// Ohne Bezug zum Spielobjekt, damit es auch in Tests und Demos allein läuft.
import * as THREE from 'three';
import { region as regionNach, REGION_STANDARD } from './regionen.js';
import { gelaendeAbfrage, warteplaetze, wegeNetz } from './gelaende.js';
import { festePunkteWelt, karteRaster, bauflaechen } from './karte.js';
import { baueGelaende, QUALITAET } from './terrain.js';
import { erzeugeWasser, baueTiefentextur } from './wasser.js';
import { erzeugeTageslicht } from './tageslicht.js';
import { setzeBild, aktuellesBild, setzeFreiQuellen } from './vielfalt.js';

/** Schätzt die passende Qualitätsstufe für das Gerät. */
export function autoQualitaet() {
  const kurz = Math.min(screen.width, screen.height);
  const touch = matchMedia('(pointer: coarse)').matches;
  const kerne = navigator.hardwareConcurrency || 4;
  const speicher = navigator.deviceMemory || 4;
  if (touch && kurz < 600) return 'niedrig';
  if (touch || kerne <= 4 || speicher <= 4) return 'mittel';
  return 'hoch';
}

function baueWartebereich(stufe, region) {
  const gruppe = new THREE.Group();
  gruppe.name = 'wartebereich';
  const { bojen, ankerbereiche, ankerplaetze } = warteplaetze(stufe);
  const mBoje = new THREE.MeshLambertMaterial({ color: '#f6c445', flatShading: true });
  const mTopp = new THREE.MeshLambertMaterial({ color: '#f4f1ea', flatShading: true });
  // Gut sichtbare Warteboje: gelbe Kugel mit weißem Toppzeichen, etwas größer als echt
  const kugel = new THREE.SphereGeometry(0.95, 10, 7);
  const topp = new THREE.CylinderGeometry(0.12, 0.5, 0.9, 6).translate(0, 1.2, 0);
  for (const b of bojen) {
    const boje = new THREE.Group();
    boje.name = `warteboje-${b.id}`;
    const k = new THREE.Mesh(kugel, mBoje);
    const t = new THREE.Mesh(topp, mTopp);
    // Größere, unsichtbare Trefferfläche, damit man sie auch am Handy gut trifft
    const treffer = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 1.5, 8), new THREE.MeshBasicMaterial({ visible: false }));
    boje.add(k, t, treffer);
    boje.position.set(b.x, 0, b.z);
    boje.userData.pick = { type: 'waitbuoy', id: b.id, groesse: b.groesse };
    boje.userData.phase = Math.random() * 6.28;
    gruppe.add(boje);
  }
  for (const a of ankerbereiche) {
    // Gestrichelter Kreis auf dem Wasser und eine ganz leichte Fläche
    const n = Math.round(a.radiusM * 0.9);
    const strich = new THREE.BoxGeometry(1.0, 0.05, 0.22);
    const ring = new THREE.InstancedMesh(strich, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.75 }), n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const w = (i / n) * Math.PI * 2;
      p.set(a.x + Math.cos(w) * a.radiusM, 0.04, a.z + Math.sin(w) * a.radiusM);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -w + Math.PI / 2);
      ring.setMatrixAt(i, m.compose(p, q, s));
    }
    ring.name = `ankerbereich-${a.id}`;
    const flaeche = new THREE.Mesh(
      new THREE.CircleGeometry(a.radiusM, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.06, depthWrite: false }),
    );
    flaeche.position.set(a.x, 0.03, a.z);
    flaeche.name = `ankerflaeche-${a.id}`;
    flaeche.userData.pick = { type: 'anchorage', id: a.id, groesse: a.groesse };
    gruppe.add(flaeche, ring);
  }
  // Jeder feste Ankerplatz als kleiner heller Punkt, damit man sieht, wie viele Boote das Feld fasst
  if (ankerplaetze.length) {
    const punkt = new THREE.CircleGeometry(0.9, 10).rotateX(-Math.PI / 2);
    const marken = new THREE.InstancedMesh(punkt, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.45, depthWrite: false }), ankerplaetze.length);
    const m = new THREE.Matrix4();
    ankerplaetze.forEach((a, i) => marken.setMatrixAt(i, m.makeTranslation(a.x, 0.05, a.z)));
    marken.name = 'ankerplaetze';
    gruppe.add(marken);
  }
  return { gruppe, daten: { bojen, ankerbereiche, ankerplaetze } };
}

/**
 * Erzeugt die ganze Landschaft und hängt sie an die Szene.
 * @param {THREE.Scene} szene
 * @param {{region?: string, stufe?: number, qualitaet?: 'hoch'|'mittel'|'niedrig'}} optionen
 */
export function erzeugeLandschaft(szene, { region = REGION_STANDARD, stufe = 1, qualitaet = 'mittel', bild = 0, jahreszeit = null } = {}) {
  setzeBild(bild);
  // Bauflächen der Grundform bleiben eben und frei (Services und Anlagen liest vielfalt.js selbst)
  setzeFreiQuellen({ polygone: (st) => bauflaechen(st).map((f) => f.poly) });
  let aktJahreszeit = jahreszeit;
  const q = QUALITAET[qualitaet] ? qualitaet : 'mittel';
  const gruppe = new THREE.Group();
  gruppe.name = 'landschaft';
  szene.add(gruppe);

  const licht = erzeugeTageslicht(szene, { schatten: QUALITAET[q].schatten });
  let reg = regionNach(region);
  let regionName = region;
  const wasser = erzeugeWasser(reg);
  gruppe.add(wasser.mesh);

  let gelaende = null, warte = null, abfrage = null, wege = [], aktStufe = stufe, pegel = 0;
  let punkte = null, raster = null;
  const beiNeubau = [];

  function baue() {
    const t0 = performance.now();
    if (gelaende) { gruppe.remove(gelaende.gruppe); gelaende.entsorge(); }
    if (warte) gruppe.remove(warte.gruppe);
    gelaende = baueGelaende(reg, aktStufe, q, { tiefsterPegel: -(reg.gelaende.gezeiten || 0) });
    gruppe.add(gelaende.gruppe);
    wasser.setzeRegion(reg);
    wasser.setzeTiefe(baueTiefentextur(reg, aktStufe, QUALITAET[q].tiefeRaster));
    warte = baueWartebereich(aktStufe, reg);
    warte.gruppe.position.y = pegel;
    gruppe.add(warte.gruppe);
    abfrage = gelaendeAbfrage(aktStufe, reg);
    wege = wegeNetz(aktStufe, reg);
    punkte = festePunkteWelt(aktStufe);
    raster = null;
    const z = licht.zustand;
    gelaende.aktualisiereSchatten(z.schattenRichtung, z.schattenLaenge, z.nacht);
    if (aktJahreszeit) gelaende.setzeJahreszeit(aktJahreszeit);
    api.bauzeitMs = Math.round(performance.now() - t0);
    for (const f of beiNeubau) { try { f({ stufe: aktStufe, region: regionName }); } catch (err) { console.warn(err); } }
  }

  licht.beiAenderung((z) => {
    wasser.setzeLicht(z.tint, z.nacht);
    wasser.setzeWind(z.wetter.wind);
    gelaende?.aktualisiereSchatten(z.schattenRichtung, z.schattenLaenge, z.nacht);
  });

  const api = {
    gruppe,
    licht,
    wasser,
    bauzeitMs: 0,
    get stufe() { return aktStufe; },
    get region() { return regionName; },
    get qualitaet() { return q; },
    get pegel() { return pegel; },
    /** Geländebild dieses Spiels: { nr, kueste, dorf, ... } (vielfalt.js). */
    get bild() { return aktuellesBild(); },
    get jahreszeit() { return aktJahreszeit; },
    /** Anderes Geländebild (z. B. neues Spiel): baut das Land neu. */
    setzeBild(nr) {
      const alt = aktuellesBild().nr;
      if (setzeBild(nr).nr !== alt) baue();
    },
    /** Felder, Wiesen und Laub umfärben: 'fruehling' | 'sommer' | 'herbst' | 'winter'. Kein Neubau. */
    setzeJahreszeit(j) {
      if (!j || j === aktJahreszeit) return;
      aktJahreszeit = j;
      gelaende?.setzeJahreszeit(j);
    },
    /** Begehbare Wege an Land (Straße, Zugänge, Promenade, Kai, Molenwege) in Weltmetern. */
    get wege() { return wege; },
    /** Wartebojen und Ankerbereiche der aktuellen Stufe in Weltmetern. */
    get warteplaetze() { return warte.daten; },
    /** Bodenhöhe in Metern (unter Wasser negativ, bezogen auf mittleren Wasserstand). */
    /** Feste Punkte der aktuellen Stufe in Weltmetern: engpass, einfahrt, fahrwasser, molenkoepfe, bauflaechen (karte.js). */
    get punkte() { return punkte; },
    /** Raster der Karte (tiefe, art, ufer) der aktuellen Stufe, beim ersten Aufruf gerechnet (etwa 0,25 s). */
    karte() { return (raster ??= karteRaster(aktStufe, reg)); },
    /** Abstand zur Uferlinie in Metern: positiv an Land, negativ im Wasser (Raster 1,24 m). */
    uferAbstand: (x, z) => api.karte().beiWelt(x, z).uferM,
    /** Ruft f({ stufe, region }) nach jedem Neubau (Stufe oder Region) auf. */
    beiNeubau(f) { beiNeubau.push(f); },
    hoeheBei: (x, z) => abfrage.hoeheBei(x, z),
    /** Wassertiefe in Metern beim aktuellen Pegel (0 an Land oder trockengefallen). */
    tiefeBei: (x, z) => Math.max(0, abfrage.tiefeBei(x, z) + pegel),
    istWasser: (x, z) => abfrage.hoeheBei(x, z) < pegel,
    setzeStufe(n) {
      n = Math.max(1, Math.min(6, Math.round(n)));   // Stufe 6: wie 5, dazu die Liegewanne an der Grossschiffspier
      if (n === aktStufe) return;
      aktStufe = n;
      baue();
    },
    setzeRegion(name) {
      if (name === regionName) return;
      regionName = name;
      reg = regionNach(name);
      baue();
    },
    setzePegel(m) {
      pegel = m;
      wasser.setzePegel(m);
      if (warte) warte.gruppe.position.y = m;
    },
    setzeUhrzeit: (h) => licht.setzeUhrzeit(h),
    setzeWetter: (w) => licht.setzeWetter(w),
    /** Jedes Bild aufrufen. dt in Sekunden (echte Zeit, damit das Wasser auch in der Pause lebt). */
    aktualisiere(dt, zeit) {
      wasser.aktualisiere(dt);
      gelaende?.aktualisiereFeuer(zeit, licht.zustand.nacht ?? 0);
      gelaende?.aktualisiere(dt);
      if (warte) {
        for (const b of warte.gruppe.children) {
          if (b.userData.pick?.type !== 'waitbuoy') continue;
          b.position.y = Math.sin(zeit * 1.6 + b.userData.phase) * 0.06;
          b.rotation.z = Math.sin(zeit * 1.1 + b.userData.phase) * 0.08;
        }
      }
    },
    entsorge() {
      gelaende?.entsorge();
      wasser.entsorge();
      licht.entsorge();
      szene.remove(gruppe);
    },
  };
  baue();
  return api;
}
