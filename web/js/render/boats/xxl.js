// Schiffe der Größe XXL (Kreuzfahrtschiff, Marineschiff, Seenotrettungskreuzer), ab Stufe 6.
// Daten: web/js/data/boats/xxl.js. Baukasten und Schnittstelle: xl-kit.js.
//
// init(game) trägt die Größe in game.boatTypes.xxl ein:
//   { TYPES, MODELS, buildBoat, setSails, animateBoat }
// buildBoat(model, { palette = 0, sails = false, id }) -> THREE.Group

import * as THREE from 'three';
import { TYPES, MODELS } from '../../data/boats/xxl.js';
import {
  hull, gaffSail, headsail, squareRig, mast, shrouds, dinghy, radar, funnel,
  latticeMast, windowRow, makeBoatApi,
} from './xl-kit.js';

const BUILDERS = {
  // ======================================== XXL1 Kreuzfahrtschiff

  'XXL1-1'(k, p) { // Expeditions-Kreuzfahrtschiff, 110 m
    const h = hull(k.fixed, { L: 110, B: 18, fb: 7, bow: 'spitz', bowLen: 0.3, overBow: 4, overStern: 2, sheerBow: 3.0, sheerStern: 0, stern: 'spiegel', transom: 0.8, stripeH: 2.0, bootH: 1.2, bottom: 0.45 }, p);
    windowRow(k.fixed, h, p.glass, -44, 36, 3.4, 1.0, 1.4, { height: 0.9 });
    const y = h.deckY(0);
    const decks = [[-46, 32, 0.8], [-40, 31, 1.3], [-32, 28, 1.8], [-22, 24, 2.6], [-8, 20, 3.6]];
    decks.forEach(([a, b, inset], i) => {
      const yy = y + i * 3;
      k.fixed.slab(p.house, h.outline(a, b, inset, 12), yy, 3);
      k.fixed.slab(p.glass, h.outline(a + 0.4, b - 0.4, inset - 0.05, 12), yy + 1.0, 1.4);
    });
    k.fixed.profile(p.glass, [[17, y + 12.4], [21.5, y + 12.4], [20.5, y + 14.6], [17, y + 14.6]], 9, 0);
    k.fixed.slab(p.trim, h.outline(-9, 21, 3.4, 10), y + 15, 0.4);
    // Schornstein, Mast, Radar
    funnel(k, p, -14, y + 12, 5, 3.0, 2.4, { color: p.accent, band: false, top: p.trim, rake: 1.2 });
    k.fixed.cyl(p.house, 0.4, 0.6, 7, 12, y + 15.4, 0, { seg: 6, body: false });
    k.fixed.box(p.house, 0.6, 0.4, 6, 12, y + 19, 0, { body: false });
    radar(k, p, 12, y + 22.4, 4);
    k.fixed.bodyTop = y + 16;
    // Zodiacs auf dem Achterdeck
    for (let i = 0; i < 4; i++) for (const s of [1, -1]) dinghy(k.fixed, -50 + i * 1.6, h.deckY(-50), s * (3 + i * 0.4), 5, p, { color: 0x2e3c4e, rot: Math.PI / 2 });
  },

  'XXL1-2'(k, p) { // Flusskreuzer-Format, 110 m, lang, schmal und niedrig
    const h = hull(k.fixed, { L: 110, B: 11.4, fb: 2.4, bow: 'spitz', bowLen: 0.08, overBow: 1.0, overStern: 0.4, sheerBow: 0.4, sheerStern: 0, stern: 'rund', sternLen: 0.05, stripeH: 0.6, bootH: 0.5, bottom: 0.8 }, p);
    windowRow(k.fixed, h, p.glass, -48, 44, 1.0, 1.2, 1.0, { height: 0.6 });
    const y = h.deckY(0);
    // zwei Kabinendecks mit durchgehenden Fensterbändern
    for (let i = 0; i < 2; i++) {
      const yy = y + i * 2.8;
      k.fixed.slab(p.house, h.outline(-50, 47, 0.4, 16), yy, 2.8);
      k.fixed.slab(p.glass, h.outline(-49.6, 46.6, 0.36, 16), yy + 0.9, 1.4);
    }
    // Restaurant mit Panoramafenstern vorn
    k.fixed.profile(p.glass, [[44, y + 0.9], [48.3, y + 0.9], [47.6, y + 5.0], [44, y + 5.0]], h.halfW(46) * 2 - 0.8, 0);
    // Sonnendeck: Liegen, Sonnensegel, Pool, Steuerhaus versenkbar
    const sd = y + 5.6;
    k.fixed.slab(p.deck, h.outline(-50, 47, 0.4, 16), sd, 0.15);
    k.fixed.rail(0xfff8ea, h.outline(-49.5, 46.5, 0.5, 16), sd + 0.15, 0.9, { closed: true, posts: 4 });
    for (let x = -40; x < 30; x += 2.6) for (const s of [1, -1]) k.fixed.box(0xfff8ea, 1.8, 0.25, 0.7, x, sd + 0.15, s * 3.8);
    k.fixed.box(0x5ab4d0, 6, 0.1, 3.4, -44, sd + 0.15, 0);
    for (const x of [-30, -10, 10]) {
      k.fixed.box(p.accent, 8, 0.12, 6, x, sd + 2.6, 0);
      for (const s of [1, -1]) for (const dx of [-3.8, 3.8]) k.fixed.spar(p.trim, [x + dx, sd + 0.15, s * 2.8], [x + dx, sd + 2.6, s * 2.8], 0.05, { seg: 3 });
    }
    k.fixed.house(p.house, p.glass, 4, 2.0, 7, 38, sd + 0.15, 0, { band: 0.45, at: 0.4 });
    k.fixed.box(p.trim, 4.3, 0.15, 7.3, 38, sd + 2.15, 0);
    radar(k, p, 37, sd + 2.3, 1.8);
    k.fixed.bodyTop = sd + 2.8;
  },

  'XXL1-3'(k, p) { // Mittleres Kreuzfahrtschiff, 180 m
    const h = hull(k.fixed, { L: 180, B: 26, fb: 9, bow: 'spitz', bowLen: 0.26, overBow: 7, overStern: 2, sheerBow: 2.0, sheerStern: 0, stern: 'spiegel', transom: 0.82, stripeH: 3.0, bootH: 1.6, bottom: 0.5 }, p);
    windowRow(k.fixed, h, p.glass, -84, 70, 4.2, 1.1, 1.3, { height: 0.9 });
    const y = h.deckY(0);
    // Balkondecks: weiß mit dunklen Glasbändern
    const nDecks = 9;
    for (let i = 0; i < nDecks; i++) {
      const yy = y + i * 3;
      const a = -82 + i * 1.5, b = 72 - i * (i > 5 ? 4 : 1.6);
      k.fixed.slab(p.house, h.outline(a, b, 0.5 + (i > 6 ? 1.2 : 0), 14), yy, 3);
      k.fixed.slab(p.glass, h.outline(a + 0.5, b - 0.5, 0.45 + (i > 6 ? 1.2 : 0), 14), yy + 1.2, 1.3);
    }
    const top = y + nDecks * 3;
    // Pooldeck mit Pools und Liegen
    k.fixed.slab(p.trim, h.outline(-70, 40, 1.5, 12), top, 0.3);
    k.fixed.box(0x5ab4d0, 14, 0.1, 10, -10, top + 0.3, 0);
    k.fixed.box(0x5ab4d0, 9, 0.1, 7, -42, top + 0.3, 0);
    for (let x = -60; x < 30; x += 3) for (const s of [1, -1]) k.fixed.box(0xfff8ea, 1.8, 0.25, 0.7, x, top + 0.3, s * 9.5);
    // Brücke vorn, breiter als das Schiff (Brückennocken)
    k.fixed.slab(p.house, [[50, -14], [56, -14], [56, 14], [50, 14]], y + 6 * 3, 3);
    k.fixed.box(p.glass, 0.1, 1.2, 27, 56.05, y + 19, 0);
    // großer Schornstein achtern
    funnel(k, p, -50, top + 0.3, 10, 6, 4, { color: p.accent, band: false, top: p.trim, rake: 2.5 });
    k.fixed.cyl(p.house, 0.5, 0.8, 9, 44, top + 0.3, 0, { seg: 6, body: false });
    radar(k, p, 44, top + 7.0, 5);
    k.fixed.bodyTop = top + 1;
    // Rettungsboote an beiden Seiten
    for (let x = -60; x < 40; x += 8) for (const s of [1, -1]) {
      const z = s * (h.halfW(x) + 0.6);
      k.fixed.slab(0xf08a3c, [[x - 3.5, z - 1.4], [x + 3.5, z - 1.4], [x + 3.9, z], [x + 3.5, z + 1.4], [x - 3.5, z + 1.4]], y + 4.5, 2.2);
      k.fixed.box(0xfff8ea, 6.8, 0.5, 2.6, x, y + 6.7, z);
    }
  },



  // ======================================== XXL2 Marineschiff

  'XXL2-1'(k, p) { // Minenjagdboot, 55 m
    const h = hull(k.fixed, { L: 55, B: 9.2, fb: 3.4, bow: 'spitz', bowLen: 0.35, overBow: 3, overStern: 0, sheerBow: 1.5, sheerStern: 0, stern: 'spiegel', transom: 0.88, bootH: 0.8, bottom: 0.45 }, p);
    const y = h.deckY(0);
    k.fixed.slab(p.house, h.outline(-12, 14, 0.4, 10), y, 2.8);
    k.fixed.slab(p.house, h.outline(-2, 12, 1.4, 8), y + 2.8, 2.6);
    k.fixed.profile(p.glass, [[9.8, y + 3.6], [12.2, y + 3.6], [11.9, y + 4.8], [9.8, y + 4.8]], (h.halfW(11) - 1.4) * 2 - 0.3, 0);
    k.fixed.slab(p.trim, h.outline(-2.4, 12.4, 1.2, 8), y + 5.4, 0.2);
    funnel(k, p, -6, y + 2.8, 3.0, 1.4, 1.3, { color: p.house, band: false, top: 0x2a2f38, rake: 0.8 });
    latticeMast(k.fixed, p, 4, y + 5.6, 9.0, 1.6, p.house);
    radar(k, p, 4, y + 14.6, 3);
    k.fixed.bodyTop = y + 6;
    // Geschütz klein vorn
    const gx = 19, gy = h.deckY(gx);
    k.fixed.cyl(p.house, 0.9, 1.1, 1.3, gx, gy, 0, { seg: 8 });
    k.fixed.spar(p.house, [gx + 0.6, gy + 0.9, 0], [gx + 3.6, gy + 1.1, 0], 0.1, { body: true });
    // Kabeltrommel und Ausrüstung auf dem Achterdeck
    const dy = h.deckY(-20);
    const drum = new THREE.CylinderGeometry(1.2, 1.2, 3.0, 10);
    drum.rotateX(Math.PI / 2);
    drum.translate(-19, dy + 1.4, 0);
    k.fixed.add(p.accent === 0xfff8ea ? 0xfad060 : p.accent, drum);
    k.fixed.box(p.trim, 1.0, 1.4, 4.0, -19, dy, 0);
    k.fixed.slab(0xfad060, [[-26.5, -1], [-23, -1], [-22.5, 0], [-23, 1], [-26.5, 1]], dy, 0.9);
    for (const s of [1, -1]) k.fixed.box(p.accent, 3, 1.3, 0.08, 18, 1.6, s * (h.halfW(19) + 0.03));
  },

  'XXL2-2'(k, p) { // Korvette, 90 m
    const h = hull(k.fixed, { L: 90, B: 13, fb: 5, bow: 'spitz', bowLen: 0.4, overBow: 6, overStern: 0, sheerBow: 1.8, sheerStern: 0, stern: 'spiegel', transom: 0.85, bootH: 1.0, bottom: 0.4 }, p);
    const y = h.deckY(0);
    // facettierter Aufbau: Seitenprofile mit schrägen Wänden
    const sup = (a, b, y0, ht, inset) => {
      k.fixed.slab(p.house, h.outline(a, b, inset, 8), y0, ht);
      k.fixed.profile(p.house, [[b, y0], [b + 3, y0], [b, y0 + ht]], (h.halfW(b) - inset) * 2, 0);
    };
    sup(-22, 16, y, 4.5, 1.0);
    sup(-6, 12, y + 4.5, 3.5, 2.4);
    k.fixed.profile(p.glass, [[12.2, y + 5.0], [14.0, y + 5.0], [12.2, y + 7.3]], (h.halfW(12) - 2.4) * 2 - 0.4, 0);
    // Pyramidenmast
    k.fixed.profile(p.house, [[-2, y + 8], [8, y + 8], [4, y + 20], [2, y + 20]], 3.5, 0);
    k.fixed.box(p.trim, 1.0, 4, 1.0, 3, y + 20, 0, { body: false });
    radar(k, p, 3, y + 24, 3.2);
    k.fixed.bodyTop = y + 9;
    // Schornstein-Block
    k.fixed.profile(p.house, [[-14, y + 4.5], [-6, y + 4.5], [-8, y + 8], [-13, y + 8]], 5, 0);
    // Geschütz vorn
    const gx = 26, gy = h.deckY(gx);
    k.fixed.profile(p.house, [[gx - 2, gy], [gx + 2.2, gy], [gx + 1.5, gy + 1.8], [gx - 2, gy + 2.0]], 3.4, 0);
    k.fixed.spar(p.house, [gx + 1.5, gy + 1.2, 0], [gx + 7, gy + 1.6, 0], 0.15, { body: true });
    // Hubschrauberdeck mit Markierung
    const hy = h.deckY(-34);
    k.fixed.box(p.accent, 0.3, 0.02, 10, -34, hy + 0.02, 0);
    k.fixed.box(p.accent, 6, 0.02, 0.3, -34, hy + 0.02, 0);
    k.fixed.box(p.accent, 0.3, 0.02, 6, -37, hy + 0.02, 0);
    k.fixed.box(p.accent, 0.3, 0.02, 6, -31, hy + 0.02, 0);
    // Beiboote seitlich in Nischen
    for (const s of [1, -1]) dinghy(k.fixed, -16, y + 1.0, s * (h.halfW(-16) - 1.5), 7, p, { color: 0x2e3c4e });
    // Rumpfnummer als Fläche
    for (const s of [1, -1]) k.fixed.box(p.accent, 4, 1.6, 0.08, 34, 2.6, s * (h.halfW(36) + 0.03));
  },

  'XXL2-3'(k, p) { // Segelschulschiff (Bark), 90 m mit Bugspriet, drei Masten
    const h = hull(k.fixed, { L: 76, B: 12, fb: 4.2, x0: -5, bow: 'spitz', bowLen: 0.3, overBow: 7, overStern: 4, sheerBow: 2.2, sheerStern: 1.2, stern: 'spiegel', transom: 0.6, stripeH: 1.0, bootH: 0.8, bottom: 0.4 }, p);
    const bs = h.bowX;
    // Galionsfigur als einfache Form und Bugspriet mit Klüverbaum
    k.fixed.spar(p.spar, [bs - 2, h.deckY(bs) + 0.5, 0], [bs + 14, h.deckY(bs) + 4.5, 0], 0.35);
    k.fixed.profile(p.accent, [[bs - 1.2, h.deckY(bs) - 1.2], [bs + 0.8, h.deckY(bs) - 0.4], [bs + 0.4, h.deckY(bs) + 0.4], [bs - 1.5, h.deckY(bs) - 0.2]], 0.8, 0);
    // Back, Kartenhaus und Poop
    k.fixed.slab(p.house, h.outline(bs - 12, bs - 4, 0.1, 6), h.deckY(bs - 8), 1.6);
    k.fixed.slab(p.house, h.outline(h.sternX + 0.5, h.sternX + 16, 0.1, 6), h.deckY(h.sternX + 8), 1.6);
    k.fixed.house(p.house, p.glass, 6, 2.2, 5, -18, h.deckY(-18), 0, { band: 0.35, at: 0.45 });
    k.fixed.box(p.trim, 6.3, 0.15, 5.3, -18, h.deckY(-18) + 2.2, 0);
    // Fockmast und Großmast mit Rahen, Besan mit Gaffel
    const fx = 18, gx = -2, bx = -26;
    const yardsF = [{ y: 13, w: 24 }, { y: 20, w: 20 }, { y: 26, w: 16 }, { y: 32, w: 13 }, { y: 37, w: 10 }, { y: 41, w: 7 }];
    const yardsG = yardsF.map((v) => ({ y: v.y + 1.5, w: v.w + 0.6 }));
    squareRig(k, p, fx, h.deckY(fx), 44, yardsF, { r: 0.55 });
    squareRig(k, p, gx, h.deckY(gx), 46, yardsG, { r: 0.6 });
    for (const [x, ht] of [[fx, 44], [gx, 46]]) {
      const d = h.deckY(x);
      k.fixed.box(p.spar, 3.6, 0.3, 3.6, x, d + ht * 0.38, 0, { body: false });
      k.fixed.box(p.spar, 2.4, 0.2, 2.4, x, d + ht * 0.68, 0, { body: false });
      for (const f of [0.38, 0.68, 0.93]) shrouds(k.fixed, h, x, d + ht * f, 4, 1.2);
    }
    mast(k, h, p, bx, 38, { r: 0.5, shroudCount: 3, spread: 1.2 });
    gaffSail(k, h, p, { x: bx, deck: h.deckY(bx), foot: 3.5, throat: 22, peak: 30, boom: 14, gaff: 11 });
    k.fixed.line([gx, h.deckY(gx) + 46, 0], [fx, h.deckY(fx) + 44, 0]);
    k.fixed.line([bx, h.deckY(bx) + 38, 0], [gx, h.deckY(gx) + 46, 0]);
    for (const [t, c] of [[34, 0.55], [28, 0.5], [22, 0.45]]) headsail(k, p, [fx, h.deckY(fx) + t], [bs + 14 * c * 1.6, h.deckY(bs) + 0.5 + 4 * c * 1.6], 0.5);
    k.fixed.line([bs + 14, h.deckY(bs) + 4.5, 0], [bs + 1, -0.3, 0]);
    // Beiboote in Davits an beiden Seiten
    for (const x of [-10, 4]) for (const s of [1, -1]) dinghy(k.fixed, x, h.deckY(x) + 1.2, s * (h.halfW(x) + 0.6), 7, p);
  },



  // ======================================== XXL3 Seenotrettungskreuzer

  'XXL3-1'(k, p) { // Seenotrettungskreuzer der 20-m-Klasse
    const h = hull(k.fixed, { L: 20, B: 5.2, fb: 2.0, bow: 'spitz', bowLen: 0.38, overBow: 1.2, overStern: 0, sheerBow: 0.9, sheerStern: 0.1, stern: 'spiegel', transom: 0.85, stripeH: 0.5, bootH: 0.45, bottom: 0.45 }, p);
    const y = h.deckY(1.5);
    k.fixed.slab(p.house, h.outline(-4, 6, 0.35, 8), y, 2.0);
    k.fixed.slab(p.glass, h.outline(-3.7, 5.7, 0.31, 8), y + 0.8, 0.6);
    k.fixed.slab(p.house, h.outline(-0.5, 4.2, 0.8, 6), y + 2.0, 2.0);
    k.fixed.slab(p.glass, h.outline(-0.2, 3.9, 0.76, 6), y + 2.8, 0.9);
    k.fixed.slab(p.trim, h.outline(-0.7, 4.4, 0.6, 6), y + 4.0, 0.15);
    latticeMast(k.fixed, p, 1.2, y + 4.15, 4.6, 0.9);
    k.fixed.box(0xfff8ea, 0.25, 0.18, 2.2, 1.2, y + 6.4, 0, { body: false });
    radar(k, p, 1.2, y + 8.75, 1.8);
    k.fixed.bodyTop = y + 4.2;
    const wx0 = h.sternX, wx1 = h.sternX + 6.2, wy = h.deckY(-8);
    k.fixed.box(0x2a2f38, 6.2, 0.05, 2.4, (wx0 + wx1) / 2, wy + 0.01, 0);
    k.fixed.box(0x2a2f38, 0.06, wy - 0.3, 2.4, wx0 - 0.02, 0.3, 0);
    dinghy(k.fixed, (wx0 + wx1) / 2 + 0.2, wy - 0.35, 0, 5.4, p, { color: p.hull });
  },

  'XXL3-2'(k, p) { // Seenotrettungskreuzer der 28-m-Klasse
    const h = hull(k.fixed, { L: 28, B: 6.6, fb: 2.4, bow: 'spitz', bowLen: 0.36, overBow: 1.6, overStern: 0, sheerBow: 1.2, sheerStern: 0.1, stern: 'spiegel', transom: 0.85, stripeH: 0.6, bootH: 0.5, bottom: 0.45 }, p);
    const y = h.deckY(2);
    k.fixed.slab(p.house, h.outline(-6, 8, 0.4, 8), y, 2.3);
    k.fixed.slab(p.glass, h.outline(-5.6, 7.7, 0.36, 8), y + 0.9, 0.7);
    // erhöhtes Steuerhaus mit Rundumverglasung
    k.fixed.slab(p.house, h.outline(-1, 5.6, 0.9, 6), y + 2.3, 2.4);
    k.fixed.slab(p.glass, h.outline(-0.7, 5.3, 0.86, 6), y + 3.3, 1.0);
    k.fixed.slab(p.trim, h.outline(-1.2, 5.8, 0.7, 6), y + 4.7, 0.2);
    // hoher Gittermast mit Radar und Suchscheinwerfer
    latticeMast(k.fixed, p, 1.5, y + 4.9, 6.2, 1.2);
    k.fixed.bodyTop = Math.max(k.fixed.bodyTop, y + 5.2);
    k.fixed.box(0xfff8ea, 0.3, 0.2, 3.0, 1.5, y + 8.0, 0, { body: false });
    k.fixed.cyl(0xfad060, 0.25, 0.25, 0.4, 3.6, y + 4.9, 1.6, { seg: 6 });
    radar(k, p, 1.5, y + 11.1, 2.4);
    k.fixed.bodyTop = y + 5.2;
    // Heckwanne mit Tochterboot
    const wx0 = h.sternX, wx1 = h.sternX + 8.5, wy = h.deckY(-10);
    k.fixed.box(0x2a2f38, 8.5, 0.05, 3.0, (wx0 + wx1) / 2, wy + 0.01, 0);
    k.fixed.box(0x2a2f38, 0.06, wy - 0.3, 3.0, wx0 - 0.02, 0.3, 0);
    dinghy(k.fixed, (wx0 + wx1) / 2 + 0.3, wy - 0.4, 0, 7.2, p, { color: p.hull });
    k.fixed.box(p.house, 1.4, 1.0, 1.2, (wx0 + wx1) / 2 + 1.2, wy + 0.4, 0);
  },

  'XXL3-3'(k, p) { // Seenotrettungskreuzer der 46-m-Klasse
    const h = hull(k.fixed, { L: 46, B: 10.8, fb: 3.4, bow: 'spitz', bowLen: 0.38, overBow: 2.6, overStern: 0, sheerBow: 1.6, sheerStern: 0.1, stern: 'spiegel', transom: 0.85, stripeH: 0.8, bootH: 0.7, bottom: 0.45 }, p);
    const y = h.deckY(3);
    k.fixed.slab(p.house, h.outline(-8, 14, 0.5, 10), y, 2.8);
    k.fixed.slab(p.glass, h.outline(-7.6, 13.6, 0.46, 10), y + 1.0, 0.8);
    k.fixed.slab(p.house, h.outline(-3, 11, 1.2, 8), y + 2.8, 2.6);
    k.fixed.slab(p.glass, h.outline(-2.6, 10.6, 1.16, 8), y + 3.6, 0.8);
    k.fixed.slab(p.house, h.outline(1, 9, 2.0, 8), y + 5.4, 2.4);
    k.fixed.slab(p.glass, h.outline(1.3, 8.7, 1.96, 8), y + 6.3, 1.1);
    k.fixed.slab(p.trim, h.outline(0.6, 9.4, 1.8, 8), y + 7.8, 0.25);
    latticeMast(k.fixed, p, 4.5, y + 8.05, 7.0, 1.6);
    k.fixed.box(0xfff8ea, 0.3, 0.2, 4.0, 4.5, y + 11.5, 0, { body: false });
    radar(k, p, 4.5, y + 15.1, 3);
    k.fixed.bodyTop = y + 8.1;
    // Löschmonitor und Suchscheinwerfer
    k.fixed.cyl(p.accent, 0.3, 0.4, 0.9, 8, y + 8.05, 2.2, { seg: 6 });
    k.fixed.spar(p.accent, [8, y + 8.8, 2.2], [9.6, y + 9.3, 2.2], 0.12, { body: true });
    k.fixed.cyl(0xfad060, 0.3, 0.3, 0.45, 8, y + 8.05, -2.2, { seg: 6 });
    // Heckwanne mit Tochterboot
    const wx0 = h.sternX, wx1 = h.sternX + 12, wy = h.deckY(-15);
    k.fixed.box(0x2a2f38, 12, 0.05, 4.2, (wx0 + wx1) / 2, wy + 0.01, 0);
    k.fixed.box(0x2a2f38, 0.06, wy - 0.3, 4.2, wx0 - 0.02, 0.3, 0);
    dinghy(k.fixed, (wx0 + wx1) / 2 + 0.3, wy - 0.6, 0, 10, p, { color: p.hull });
    k.fixed.house(p.house, p.glass, 2.0, 1.4, 1.8, (wx0 + wx1) / 2 + 2, wy + 0.3, 0, { band: 0.4, at: 0.4 });
  },
};

function kindOf(model) {
  if (model.propulsion === 'sail') return 'sail';
  return 'ship';
}

export const { buildBoat, setSails, animateBoat } = makeBoatApi('XXL', BUILDERS, kindOf);
export { TYPES, MODELS };

// Vorbeifahrende Großschiffe weit draußen auf der Ostsee, ab Stufe 5 als Vorschau auf den
// Seehafen. Nicht antippbar, sie sind Kulisse. Als Gäste kommen sie über die Spielregeln
// (Stufe 6, Kreuzfahrtterminal und Marineanleger) und render/boat-view.js.
const LANE_Z = -246;        // weiter draußen als die XL-Bahnen (-203 und -184)
const X_FAR = 330;

export function startTraffic(game) {
  const root = new THREE.Group();
  root.name = 'xxl-traffic';
  game.scene.add(root);
  const guests = MODELS.filter((m) => m.typeId !== 'XXL3');
  let ship = null;
  let next = 20;
  const stufe = () => game.state?.stage ?? game.state?.stufe ?? 1;
  game.onTick((dt) => {
    if (!dt) return;
    if (ship) {
      ship.group.position.x += ship.dir * ship.speed * dt;
      ship.group.rotation.z = Math.sin(game.time * 0.4) * 0.004;
      animateBoat(ship.group, game.time, { speed: ship.speed });
      if (Math.abs(ship.group.position.x) > X_FAR + 5) {
        root.remove(ship.group);
        ship.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
        ship = null;
        next = 60 + Math.random() * 60;
      }
      return;
    }
    if (stufe() < 5) return;
    next -= dt;
    if (next > 0) return;
    const model = guests[Math.floor(Math.random() * guests.length)];
    const dir = Math.random() < 0.5 ? 1 : -1;
    const group = buildBoat(model, { palette: Math.floor(Math.random() * 3), sails: model.propulsion === 'sail' });
    group.position.set(-dir * X_FAR, 0, LANE_Z);
    group.rotation.y = dir > 0 ? 0 : Math.PI;
    root.add(group);
    ship = { group, dir, speed: 5 };
  });
  return root;
}

export function init(game) {
  game.boatTypes ??= {};
  game.boatTypes.xxl = { size: 'XXL', TYPES, MODELS, buildBoat, setSails, animateBoat };
  game.boatTypes.XXL = game.boatTypes.xxl;   // Alias, Schreibweise ist klein
  startTraffic(game);
}
