// Landschaft und Wasser im Spiel: ersetzt den Platzhalter aus dem Grundgerüst.
// Details und Schnittstellen: docs/landschaft.md
//
// Von außen steuerbar über Ereignisse oder direkt über game.landschaft:
//   game.emit('stufe', 3)                         Ausbaustufe 1..5
//   game.emit('region', 'nordsee')                ostsee oder nordsee
//   game.emit('pegel', 1.2)                       Wasserstand in Metern (Gezeiten)
//   game.emit('wetter', { bewoelkung, wind })     je 0..1
//   game.emit('uhrzeit', 19.5)                    Stunden; null = wieder dem Spieltag folgen
// Meldet: game.emit('licht', zustand) bei jeder Lichtänderung (zustand.nacht 0..1 für Fensterlicht),
//         game.emit('landschaft:geaendert', { stufe, region }) nach jedem Neubau des Geländes.
import { erzeugeLandschaft, autoQualitaet } from './landschaft/index.js';
import { uhrzeitAusSpielzeit } from './landschaft/zeit.js';
import { bildAusSeed } from './landschaft/vielfalt.js';

/**
 * Landbild (Felder, Wald, Dorf) für dieses Spiel: aus der Adresse (?landbild=N, nur Ansicht), sonst aus dem Seed des Spielstands.
 * Automatische Tests (navigator.webdriver) bekommen das Grundbild 0, damit Bildschirmfotos gleich bleiben.
 */
function bildFuer(game, url) {
  if (url.landbild != null && Number.isFinite(url.landbild)) return url.landbild;
  if (globalThis.navigator?.webdriver === true) return 0;
  const seed = game.state?.seed;
  return seed == null ? 0 : bildAusSeed(seed);
}

function parameter() {
  const p = new URLSearchParams(location.search);
  return {
    qualitaet: p.get('qualitaet') || p.get('quality'),
    region: p.get('region'),
    stufe: p.get('stufe') ? Number(p.get('stufe')) : null,
    uhrzeit: p.get('uhrzeit') ? Number(p.get('uhrzeit')) : null,
    landbild: p.get('landbild') != null ? Number(p.get('landbild')) : null,
  };
}

export function init(game) {
  const { scene, renderer } = game;

  // Platzhalter des Grundgerüsts samt seiner Lichter entfernen
  // Den Platzhalter-Steg und das Platzhalter-Boot lassen wir stehen, bis die Stege kommen.
  const platzhalter = scene.getObjectByName('placeholder');
  if (platzhalter) {
    for (const o of [...platzhalter.children]) {
      if (o.geometry?.type === 'PlaneGeometry') platzhalter.remove(o);
    }
  }
  for (const o of [...scene.children]) {
    if (o.isLight && !o.name.startsWith('landschaft')) scene.remove(o);
  }

  const url = parameter();
  const qualitaet = url.qualitaet || autoQualitaet();
  const land = erzeugeLandschaft(scene, {
    region: url.region || game.state?.region || game.region?.id || 'ostsee',
    stufe: url.stufe || game.state?.stufe || 1,
    qualitaet,
    bild: bildFuer(game, url),
    jahreszeit: game.events?.season?.(game.state?.day ?? 1)?.part ?? null,
  });
  game.landschaft = land;
  game.landscape = land;   // Grundgerüst erkennt daran, dass die Platzhalter-Bänder weg können

  if (land.licht.sonne.castShadow) {
    renderer.shadowMap.enabled = true;
    scene.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; }); });
  }

  let feste = url.uhrzeit;   // feste Uhrzeit aus URL oder Ereignis, sonst Spielzeit
  // Vorschau-Parameter in der Adresse haben Vorrang vor dem Spielstand (nur Anzeige)
  game.on('stufe', (n) => { if (!url.stufe) land.setzeStufe(n); });
  game.on('region', (id) => { if (!url.region) land.setzeRegion(typeof id === 'string' ? id : id?.id); });
  game.on('pegel', (m) => land.setzePegel(Number(m) || 0));
  game.on('wetter', (w) => land.setzeWetter(w || {}));
  game.on('season', (s) => land.setzeJahreszeit(typeof s === 'object' ? s?.part : s));
  // Anderer Spielstand (Laden, Neues Spiel): eigenes Geländebild
  const neuesBild = () => { if (url.landbild == null) land.setzeBild(bildFuer(game, url)); };
  game.on('spielstand-geladen', () => queueMicrotask(neuesBild));
  game.on('sim:change', (e) => { if (e?.reason === 'load' || e?.reason === 'new') queueMicrotask(neuesBild); });
  game.on('ready', () => {
    neuesBild();
    const j = game.events?.season?.(game.state?.day ?? 1)?.part;
    if (j) land.setzeJahreszeit(j);
  });
  game.on('uhrzeit', (h) => { feste = h == null ? null : Number(h); if (feste != null) land.setzeUhrzeit(feste); });
  land.licht.beiAenderung((z) => game.emit('licht', z));
  // Nach jedem Neubau (Stufe oder Region): Fahrwege, Anlagen und Bewuchs können neu rechnen
  land.beiNeubau((info) => game.emit('landschaft:geaendert', info));

  let letzteUhr = -99, anzeigeUhr = 6.5, letzt = performance.now();
  let fx = Infinity, fz = Infinity;
  const kamera = game.camera.target;
  game.onTick(() => {
    const jetzt = performance.now();
    const dt = Math.min(0.1, (jetzt - letzt) / 1000);
    letzt = jetzt;
    land.aktualisiere(dt, jetzt / 1000);
    // Uhrzeit aus dem Spieltag der Spielregeln (tagesAnteil 0 Morgen bis 1 Nacht), sonst aus game.time
    const ziel = feste ?? (game.sim?.tagesAnteil ? uhrzeitAusSpielzeit(game.sim.tagesAnteil() * 119.9) : uhrzeitAusSpielzeit(game.time));
    // Weich nachführen, damit Vorspulen die Sonne sichtbar zieht statt zu springen
    let diff = ((ziel - anzeigeUhr + 36) % 24) - 12;
    anzeigeUhr = Math.abs(diff) > 6 || feste != null ? ziel : anzeigeUhr + diff * Math.min(1, dt * 6);
    anzeigeUhr = ((anzeigeUhr % 24) + 24) % 24;
    if (Math.abs(anzeigeUhr - letzteUhr) > 0.01) { letzteUhr = anzeigeUhr; land.setzeUhrzeit(anzeigeUhr); }
    if (kamera && (Math.abs(kamera.x - fx) > 25 || Math.abs(kamera.z - fz) > 25)) {
      fx = kamera.x; fz = kamera.z;
      land.licht.folge(fx, fz);
    }
  });
  if (feste != null) land.setzeUhrzeit(feste);
  return land;
}
