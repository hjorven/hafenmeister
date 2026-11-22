// Preistafel am Hafenmeisterhaus (P35, features/preisstufe.js): ein Aufsteller mit der Preisliste in Pixeln.
// Steht ab "Hafenmeister mit Funk" über game.zielDeko.zusatz auf einem freien Platz an Land beim
// Hafenmeisterhaus (nie auf Wegen, in Gebäuden oder im Wasser). Zeigt die gewählte Stufe als Münzstapel
// (1 bis 3 Münzen) auf einem farbigen Feld: günstig grün, normal blau, gehoben gold. Antippen öffnet die
// Preistafel im Gästebuch (userData.pick = { type: 'preistafel' }).
//
// Schnittstelle: init(game, { stufe() -> id, frei() -> bool }) -> { objekt, aktualisiere() }
import * as THREE from 'three';
import { PIXEL, FARBE } from '../ui/pixel-symbole.js';

const MUENZEN = { guenstig: 'preis1', normal: 'preis2', gehoben: 'preis3' };
const FELD = { guenstig: '#4f8a4b', normal: '#3b6f8f', gehoben: '#c9962c' };
const W = 28;                   // Tafel in Pixeln (Breite, Höhe): grob wie die übrige Pixel-Art
const H = 22;

// Kleine Pixelschrift (3 x 5) nur für das Wort auf der Tafel
const SCHRIFT = {
  P: ['###', '#.#', '###', '#..', '#..'], R: ['##.', '#.#', '##.', '#.#', '#.#'], E: ['###', '#..', '##.', '#..', '###'],
  I: ['###', '.#.', '.#.', '.#.', '###'], S: ['###', '#..', '###', '..#', '###'],
};

function zeichne(ctx, stufe) {
  ctx.clearRect(0, 0, W, H);
  // Rahmen (Holz) und Papier
  ctx.fillStyle = FARBE.H; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = FARBE.p; ctx.fillRect(1, 1, W - 2, H - 2);
  // Kopf: PREISE
  ctx.fillStyle = FARBE.k;
  let x = 3;   // 6 Buchstaben, je 3 breit mit 1 Pixel Abstand
  for (const c of 'PREISE') {
    const g = SCHRIFT[c];
    g.forEach((z, yy) => [...z].forEach((p, xx) => { if (p === '#') ctx.fillRect(x + xx, 2 + yy, 1, 1); }));
    x += 4;
  }
  // Feld in der Farbe der Stufe mit Münzstapel
  ctx.fillStyle = FELD[stufe] ?? FELD.normal;
  ctx.fillRect(2, 8, W - 4, H - 10);
  const r = PIXEL[MUENZEN[stufe] ?? 'preis2'];
  const ox = Math.round((W - r[0].length) / 2);
  const oy = H - 2 - r.length;
  r.forEach((z, yy) => [...z].forEach((p, xx) => {
    if (p === '.' || p === ' ') return;
    ctx.fillStyle = FARBE[p] ?? '#000';
    ctx.fillRect(ox + xx, oy + yy, 1, 1);
  }));
}

export function init(game, { stufe, frei }) {
  const leinwand = document.createElement('canvas');
  leinwand.width = W; leinwand.height = H;
  const c2d = leinwand.getContext('2d');
  const tex = new THREE.CanvasTexture(leinwand);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;

  const holz = new THREE.MeshLambertMaterial({ color: '#9a6b43', flatShading: true });
  const dunkel = new THREE.MeshLambertMaterial({ color: '#5b4433', flatShading: true });
  const bildMat = new THREE.MeshLambertMaterial({ map: tex });

  // Aufsteller wie vor echten Hafenbüros: zwei Pfosten, schräges Brett, kleines Dach
  const g = new THREE.Group();
  g.name = 'preistafel';
  const breit = 1.8;
  const hoch = breit * (H / W);
  for (const dx of [-breit / 2 + 0.08, breit / 2 - 0.08]) {
    const pf = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.9, 0.12), dunkel);
    pf.position.set(dx, 0.95, 0);
    pf.castShadow = true;
    g.add(pf);
  }
  const brett = new THREE.Mesh(new THREE.BoxGeometry(breit, hoch, 0.08), holz);
  brett.position.set(0, 0.55 + hoch / 2, 0);
  brett.castShadow = true;
  g.add(brett);
  // Bild vorn und hinten, damit man es aus jeder Richtung lesen kann
  for (const seite of [1, -1]) {
    const bild = new THREE.Mesh(new THREE.PlaneGeometry(breit - 0.06, hoch - 0.06), bildMat);
    bild.position.set(0, 0.55 + hoch / 2, 0.045 * seite);
    if (seite < 0) bild.rotation.y = Math.PI;
    g.add(bild);
  }
  const dach = new THREE.Mesh(new THREE.BoxGeometry(breit + 0.2, 0.08, 0.32), dunkel);
  dach.position.set(0, 0.6 + hoch, 0);
  dach.castShadow = true;
  g.add(dach);
  // Antippen: unsichtbare, etwas größere Fläche (Fingertoleranz am Handy)
  const tipp = new THREE.Mesh(new THREE.BoxGeometry(breit + 0.6, hoch + 1.4, 0.8), new THREE.MeshBasicMaterial({ visible: false }));
  tipp.position.set(0, 0.55 + hoch / 2 - 0.3, 0);
  tipp.userData.pick = { type: 'preistafel', id: 'preistafel' };
  g.add(tipp);
  g.userData.pick = { type: 'preistafel', id: 'preistafel' };

  let gezeigt = null;
  function aktualisiere() {
    const s = stufe();
    if (s !== gezeigt) {
      gezeigt = s;
      zeichne(c2d, s);
      tex.needsUpdate = true;
    }
    game.zielDeko?.aufbauen?.();
  }

  // ziel-deko.js wird von features/tagesziele.js geladen, kann also nach uns kommen
  let versuche = 0;
  const anmelden = () => {
    if (game.zielDeko?.zusatz) {
      zeichne(c2d, (gezeigt = stufe()));
      tex.needsUpdate = true;
      game.zielDeko.zusatz('preistafel', { lage: { x: -4.5, z: 3.5, dreh: 15 }, radius: 1.0, objekt: g, da: () => !!frei() });
      return;
    }
    if (++versuche < 60) setTimeout(anmelden, 500);
  };
  anmelden();
  // Hafenbüro gekauft: die Tafel kommt dazu
  game.on('sim:built', (e) => { if (e?.id === 'office') setTimeout(aktualisiere, 100); });

  return { objekt: g, aktualisiere };
}
