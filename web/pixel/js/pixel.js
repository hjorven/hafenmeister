// Haengt den Pixel-Art-Zeichner an das laufende Spiel, ohne eine Spieldatei zu aendern.
// Wird nur von pixel/index.html geladen. Das Spiel selbst (Regeln, Stufen, Speichern) bleibt dasselbe.
//
// Adresszusaetze:  ?px=3        feste Pixelgroesse in CSS-Pixeln (Standard: passend zum Geraet)
//                  ?umriss=0    ohne Umrisse
// Tasten (PC):     F8 Pixel an/aus zum Vergleichen
import { createPixelPass } from './pixel-pass.js';

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
});
game.renderer.render = (scene, camera) => pass.render(scene, camera);
game.pixel = pass;
document.documentElement.classList.add('pixel');
document.body.classList.add('pixel');

window.addEventListener('keydown', (e) => {
  if (e.key === 'F8') { pass.state.enabled = !pass.state.enabled; e.preventDefault(); }
});
