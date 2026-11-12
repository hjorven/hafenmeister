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

// ---- Kamerahoehe ----
// Das Spiel schaut immer mit 50 Grad Neigung. In der Pixel-Fassung laesst sich die Hoehe in drei
// Stufen verstellen (flach 30, Spiel 50, hoch 70 Grad), weich uebergeblendet.
// Tasten: Bild auf / Bild ab. Knopf "Höhe" in der oberen Leiste schaltet reihum.
export const HOEHEN = [30, 50, 70];
const THREE = game.THREE;
const rig = game.camera;
const DISTANCE = 600;
let stufe = 1;
rig.pitch = THREE.MathUtils.degToRad(HOEHEN[stufe]);
let pitchZiel = rig.pitch;
const altesApply = rig._apply.bind(rig);
rig._apply = function apply() {
  altesApply();   // Ausschnitt, Grenzen, onChange wie gehabt
  const cam = this.camera;
  const dir = new THREE.Vector3(
    Math.sin(this.yaw) * Math.cos(this.pitch),
    Math.sin(this.pitch),
    Math.cos(this.yaw) * Math.cos(this.pitch),
  );
  cam.position.copy(this.target).addScaledVector(dir, DISTANCE);
  cam.lookAt(this.target);
  cam.updateMatrixWorld();
};
function setzeHoehe(n) {
  stufe = Math.max(0, Math.min(HOEHEN.length - 1, n));
  pitchZiel = THREE.MathUtils.degToRad(HOEHEN[stufe]);
  knopf.textContent = `${HOEHEN[stufe]}°`;
  knopf.title = `Kamerahöhe ${HOEHEN[stufe]}° (Bild auf, Bild ab)`;
  game.emit('pixel:hoehe', HOEHEN[stufe]);
}
game.onTick(() => {
  const d = pitchZiel - rig.pitch;
  if (Math.abs(d) < 0.0005) { if (d) { rig.pitch = pitchZiel; rig._apply(); } return; }
  rig.pitch += d * 0.18;
  rig._apply();
});

const knopf = document.createElement('button');
knopf.type = 'button';
knopf.className = 'hud-btn';
knopf.id = 'btn-hoehe';
knopf.setAttribute('aria-label', 'Kamerahöhe wechseln');
const leiste = document.getElementById('hud-top');
const vor = document.getElementById('btn-overview');
if (leiste && vor && vor.parentElement === leiste) leiste.insertBefore(knopf, vor);
else (leiste || document.getElementById('game') || document.body).appendChild(knopf);
knopf.addEventListener('click', () => setzeHoehe((stufe + 1) % HOEHEN.length));
window.addEventListener('keydown', (e) => {
  if (e.target?.closest?.('input, textarea, select')) return;
  if (e.code === 'PageUp') { setzeHoehe(stufe + 1); e.preventDefault(); }
  if (e.code === 'PageDown') { setzeHoehe(stufe - 1); e.preventDefault(); }
});
const qHoehe = Number(q.get('hoehe'));
setzeHoehe(HOEHEN.includes(qHoehe) ? HOEHEN.indexOf(qHoehe) : 1);
rig.pitch = pitchZiel;
rig._apply();
