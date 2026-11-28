// Schleuse im Durchstich (Nordsee, Roadmap P57 Teil 4, docs/nordsee.md). Nur das Bild: Die Regeln
// (Takt, Grund 'schleuse') stehen in features/gezeiten-regeln.js, die Zahlen in ECONOMY.nordsee.schleuse.
//
// Zwei Schiebetore (Binnenhaupt und Außenhaupt) quer im Durchstich, wie an den großen Seeschleusen der
// Nordseeküste: Die lichte Weite ist für Stemmtore zu breit (die Flügel ragten offen aus der Kammer). Jedes Tor
// rollt in eine Torkammer neben der Ostmauer. Je Haupt ein Signalmast mit Rot und Grün, ein kleines
// Schleusenwärterhaus auf der Ostmauer. Die Tore öffnen, wenn die Schleusung läuft (schleuseOffen) oder ein
// Boot gerade in der Schleuse oder kurz davor ist, und schließen danach langsam.
// Nur an der Nordsee ab Stufe 3 auf Küsten mit Durchstich (engpassArt 'durchstich').
import * as THREE from 'three';
import { HAFEN } from '../data/harbor.js';
import { ECONOMY } from '../data/economy.js';
import { engpassArt } from '../data/kuestennamen.js';
import { DURCHSTICH, ENGPASS_X, seeNord } from './landschaft/gelaende.js';
import * as G from '../features/gezeiten-regeln.js';
import { regelnBereit } from '../features/regeln-bereit.js';

const U = HAFEN.einheiten?.meterProEinheit ?? 0.62;
const SL = ECONOMY.nordsee?.schleuse ?? null;

function mat(c, extra = {}) { return new THREE.MeshLambertMaterial({ color: c, flatShading: true, ...extra }); }

export async function init(game) {
  game.schleuse = { aktiv: () => false, offen: () => true };
  if (!SL || !game.scene) return;
  const api = await regelnBereit(game);
  const st = () => api.state;

  const M = {
    tor: mat('#5b4b3c'), steg: mat('#d9b27c'), gelaender: mat('#e9e4da'), mast: mat('#3a3f46'),
    rot: mat('#d9443b', { emissive: '#000000' }), gruen: mat('#3fae5a', { emissive: '#000000' }),
    haus: mat('#f1ece2'), beton: mat('#b9b4aa'), dunkel: mat('#2b3138'), dach: mat('#a4453a'), fenster: mat('#2f4f6e'),
  };
  const root = new THREE.Group();
  root.name = 'schleuse';
  root.visible = false;
  game.scene.add(root);

  const xW = DURCHSTICH[0] + 1, xO = DURCHSTICH[1] - 1;             // Mauerkanten (Planeinheiten)
  const breite = (xO - xW) * U;                                       // lichte Weite in Metern
  const torB = 2.2;                                                   // Torkörper (Meter, quer zur Fahrt)
  const yBinnen = seeNord(ENGPASS_X) + 8, yAussen = 222;               // Häupter (Planeinheiten)
  const krone = () => (game.landscape?.region === 'nordsee' ? 1.0 + 1.8 : 1.0);   // Mauerkrone (landPlus 1,8)

  const haeupter = [];
  // Schiebetor: Kasten über die ganze Weite, oben ein Laufsteg mit Geländer. Liegt im Haupt-Group bei x = 0
  // (Westmauer) und rollt beim Öffnen um die lichte Weite nach Osten in die Torkammer.
  function tor() {
    const g = new THREE.Group();
    const hoehe = krone() + 5.5;
    const k = new THREE.Mesh(new THREE.BoxGeometry(breite + 1, hoehe, torB), M.tor);
    k.position.set(breite / 2, krone() - hoehe / 2 - 0.05, 0);
    const lauf = new THREE.Mesh(new THREE.BoxGeometry(breite + 1, 0.12, torB + 0.3), M.steg);
    lauf.position.set(breite / 2, krone() + 0.02, 0);
    const reling = new THREE.Mesh(new THREE.BoxGeometry(breite + 1, 0.08, 0.08), M.gelaender);
    reling.position.set(breite / 2, krone() + 1.0, torB / 2);
    const reling2 = reling.clone();
    reling2.position.z = -torB / 2;
    g.add(k, lauf, reling, reling2);
    return g;
  }
  // Torkammer: Betonkasten neben der Ostmauer, Krone bündig, oben offen (das Tor fährt hinein und verschwindet)
  function kammer() {
    const g = new THREE.Group();
    const lang = breite + 2, tief = krone() + 6, wand = 0.8;
    for (const dz of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(lang, tief, wand), M.beton);
      w.position.set(lang / 2, krone() - tief / 2 + 0.15, dz * (torB / 2 + wand / 2 + 0.1));
      g.add(w);
    }
    const ende = new THREE.Mesh(new THREE.BoxGeometry(wand, tief, torB + 2 * wand + 0.2), M.beton);
    ende.position.set(lang + wand / 2, krone() - tief / 2 + 0.15, 0);
    const boden = new THREE.Mesh(new THREE.BoxGeometry(lang, 0.2, torB + 0.2), M.dunkel);
    boden.position.set(lang / 2, krone() - 0.6, 0);
    g.add(ende, boden);
    return g;
  }
  function signal(x, z) {
    const g = new THREE.Group();
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4, 6), M.mast);
    mast.position.y = krone() + 2;
    const rot = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), M.rot.clone());
    rot.position.set(0, krone() + 3.8, 0);
    const gruen = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), M.gruen.clone());
    gruen.position.set(0, krone() + 3.1, 0);
    g.add(mast, rot, gruen);
    g.position.set(x, 0, z);
    g.userData = { rot, gruen };
    return g;
  }

  let gebaut = '';
  function aufbauen() {
    const s = st();
    const an = !!s && G.hatSchleuse(s) && game.landscape?.region === 'nordsee';
    const sig = an ? `an|${krone()}|${engpassArt()}` : 'aus';
    root.visible = an;
    if (sig === gebaut) return;
    gebaut = sig;
    root.clear();
    haeupter.length = 0;
    if (!an) return;
    for (const yp of [yBinnen, yAussen]) {
      const z = -yp * U;
      const t = tor();
      t.position.set(xW * U, 0, z);
      const k = kammer();
      k.position.set(xO * U, 0, z);
      const sig = signal(xO * U + 1.6, z + (yp === yBinnen ? 2.6 : -2.6));
      root.add(t, k, sig);
      haeupter.push({ tor: t, x0: xW * U, sig, z, auf: 0 });
    }
    // Schleusenwärterhaus auf der Ostmauer zwischen den Häuptern
    const haus = new THREE.Group();
    const korpus = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.6, 3.2), M.haus);
    korpus.position.y = krone() + 1.3;
    const dach = new THREE.Mesh(new THREE.ConeGeometry(2.7, 1.4, 4), M.dach);
    dach.position.y = krone() + 3.3;
    dach.rotation.y = Math.PI / 4;
    const fenster = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.8, 1.6), M.fenster);
    fenster.position.y = krone() + 1.7;
    haus.add(korpus, dach, fenster);
    haus.position.set(xO * U + 4.2, 0, -((yBinnen + yAussen) / 2) * U);
    root.add(haus);
  }

  // Boot in der Schleuse oder kurz davor: Tore bleiben offen, bis es durch ist
  const mitte = () => ({ x: ENGPASS_X * U, z: -((yBinnen + yAussen) / 2) * U });
  function bootNah() {
    const m = mitte();
    const lang = ((yAussen - yBinnen) * U) / 2 + 14;
    for (const b of game.boatView?.boote ?? []) {
      const a = b.anim;
      if (!a || a.moored) continue;
      if (Math.abs(a.x - m.x) < breite / 2 + 6 && Math.abs(a.z - m.z) < lang) return true;
    }
    return false;
  }

  game.onTick?.((dt) => {
    if (!root.visible || !haeupter.length) return;
    const s = st();
    const takt = G.schleuseOffen(s);
    const soll = takt || bootNah() ? 1 : 0;
    const schritt = Math.min(1, (dt || 0.016) / 3);
    for (const h of haeupter) {
      h.auf += Math.sign(soll - h.auf) * Math.min(Math.abs(soll - h.auf), schritt);
      // zu: Tor quer über die Weite; auf: ganz in der Torkammer östlich der Mauer (sanft an- und auslaufen)
      const e = h.auf * h.auf * (3 - 2 * h.auf);
      h.tor.position.x = h.x0 + e * (breite + 1);
      const gruen = h.auf > 0.95;
      h.sig.userData.gruen.material.emissive.set(gruen ? '#2f8a45' : '#000000');
      h.sig.userData.rot.material.emissive.set(gruen ? '#000000' : '#a02a22');
    }
  });

  for (const ev of ['stufe', 'region', 'ready', 'spielstand-geladen', 'landschaft:geaendert', 'sim:change']) game.on(ev, () => setTimeout(aufbauen, 0));
  aufbauen();

  game.schleuse = {
    aktiv: () => root.visible,
    offen: () => (st() ? G.schleuseOffen(st()) : true),
    naechste: () => (st() ? G.naechsteSchleusung(st()) : null),
  };
}

export default init;
