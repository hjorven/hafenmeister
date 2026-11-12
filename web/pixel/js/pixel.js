// Haengt den Pixel-Art-Zeichner an das laufende Spiel, ohne eine Spieldatei zu aendern.
// Wird nur von pixel/index.html geladen. Das Spiel selbst (Regeln, Stufen, Speichern) bleibt dasselbe.
//
// Adresszusaetze:  ?px=3        feste Pixelgroesse in CSS-Pixeln (Standard: passend zum Geraet)
//                  ?umriss=0    ohne Umrisse
//                  ?schiffe=filter  Schiffe wie bisher gefiltert statt gezeichnet
//                  ?stil=filter     alles wie bisher gefiltert (Vergleich)
// Tasten (PC):     F8 Pixel an/aus zum Vergleichen
import { createPixelPass } from './pixel-pass.js';
import { installiereSchiffSprites } from './schiff-sprites.js';
import { installiereGezeichnet } from './gezeichnet.js';

function warteAufSpiel() {
  return new Promise((resolve) => {
    const sieh = () => (window.hafenmeister?.renderer ? resolve(window.hafenmeister) : requestAnimationFrame(sieh));
    sieh();
  });
}

const game = await warteAufSpiel();
const q = new URLSearchParams(location.search);
const pass = createPixelPass(game.THREE, game.renderer, {
  pixel: q.get('px') || 'auto',
  outline: q.get('umriss') !== '0',
  gezeichnet: q.get('stil') !== 'filter',
});
game.renderer.render = (scene, camera) => pass.render(scene, camera);
game.pixel = pass;
// Schiffe gezeichnet statt gefiltert (?schiffe=filter zeigt zum Vergleich den alten Weg)
pass.schiffe = installiereSchiffSprites(game, pass);
if (q.get('schiffe') === 'filter' || q.get('stil') === 'filter') pass.schiffe.aus = true;
// Alles andere live gezeichnet (?stil=filter zeigt zum Vergleich den alten Filter-Weg)
const gez = installiereGezeichnet(game, pass, { an: pass.state.gezeichnet });
document.documentElement.classList.add('pixel');
document.body.classList.add('pixel');

window.addEventListener('keydown', (e) => {
  if (e.key === 'F8') {
    pass.state.enabled = !pass.state.enabled;
    gez.uPxAn.value = pass.state.enabled && pass.state.gezeichnet ? 1 : 0;
    e.preventDefault();
  }
});

// ---- Kamera ----
// Die Pixel-Fassung zeichnet orthografisch (ohne Fluchtpunkt), damit Pixel auf dem Raster bleiben.
// Neigen und Drehen gehen wie im Spiel frei (core/camera.js, docs/kamera.md): zwei Finger gemeinsam
// hoch/runter, rechte Maustaste ziehen, Alt + Mausrad, Tasten R/V und Bild auf/ab; der Kompass
// oben rechts richtet wieder aus. Darum gibt es keinen eigenen Hoehen-Knopf mehr.
// ?hoehe=30 startet mit dieser Neigung (Grad); Uebersicht und Kompass kehren dorthin zurueck.
const rig = game.camera;
rig.setProjektion?.('ortho');
rig.reset?.();
const qHoehe = Number(q.get('hoehe'));
if (qHoehe >= 20 && qHoehe <= 86 && 'pitchStandard' in rig) {
  rig.pitchStandard = qHoehe * Math.PI / 180;
  rig.setPitch(qHoehe, { sofort: true });
}
