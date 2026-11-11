// Schiffe der Größe XL (Traditionssegler, Großyacht, Fahrgast- und Arbeitsschiff).
// Daten: web/js/data/boats/xl.js. Baukasten und Schnittstelle: xl-kit.js.
//
// init(game) trägt die Größe in game.boatTypes.xl ein:
//   { TYPES, MODELS, buildBoat, setSails, animateBoat }
// buildBoat(model, { palette = 0, sails = false, id }) -> THREE.Group

import * as THREE from 'three';
import { TYPES, MODELS } from '../../data/boats/xl.js';
import {
  hull, gaffSail, headsail, squareRig, mast, shrouds, dinghy, radar, buoyTonne, funnel,
  latticeMast, windowRow, paddleWheel, shade, Kit, makeBoatApi,
} from './xl-kit.js';

const BUILDERS = {
  // ======================================== XL1 Traditionssegler
  'XL1-1'(k, p) { // Gaffelschoner, 34 m mit Bugspriet
    const h = hull(k.fixed, { L: 27.5, B: 6.8, fb: 1.8, x0: -2.4, bow: 'spitz', bowLen: 0.4, overBow: 3.2, overStern: 2.4, sheerBow: 0.9, sheerStern: 0.3, stern: 'spiegel', transom: 0.55, stripeH: 0.45, bottom: 0.35 }, p);
    const bs = h.bowX;
    k.fixed.spar(p.spar, [bs - 1, h.deckY(bs) + 0.2, 0], [bs + 6.4, h.deckY(bs) + 1.2, 0], 0.17);
    k.fixed.house(p.house, p.glass, 5, 1.0, 2.8, -4, h.deckY(-4), 0, { band: 0.3 });
    k.fixed.house(p.house, p.glass, 2.6, 0.9, 2.2, 3.5, h.deckY(3.5), 0, { band: 0.3 });
    const fx = 4.5, ax = -4.2, fh = 22, ah = 26;
    for (const [x, ht] of [[fx, fh], [ax, ah]]) {
      k.fixed.cyl(p.spar, 0.14, 0.24, ht, x, h.deckY(x), 0, { seg: 6, body: false });
      shrouds(k.fixed, h, x, h.deckY(x) + ht * 0.82, 2, 1.0);
    }
    gaffSail(k, h, p, { x: fx, deck: h.deckY(fx), foot: 1.6, throat: 15, peak: 19.5, boom: 7.5, gaff: 6.2 });
    gaffSail(k, h, p, { x: ax, deck: h.deckY(ax), foot: 1.8, throat: 17, peak: 23, boom: 10.5, gaff: 7.5 });
    k.fixed.line([ax, h.deckY(ax) + ah, 0], [fx, h.deckY(fx) + fh, 0]);
    headsail(k, p, [fx, h.deckY(fx) + fh * 0.8], [bs + 6.2, h.deckY(bs) + 1.3]);
    headsail(k, p, [fx, h.deckY(fx) + fh * 0.66], [bs + 0.5, h.deckY(bs) + 0.5], 0.5);
    k.fixed.line([bs + 6.4, h.deckY(bs) + 1.2, 0], [bs + 0.2, -0.2, 0]);
    // Beiboot in Davits am Heck
    dinghy(k.fixed, h.sternX - 1.2, h.deckY(h.sternX) + 0.9, 0, 3.2, p, { rot: Math.PI / 2 });
    k.fixed.spar(p.spar, [h.sternX + 0.5, h.deckY(h.sternX), 1.4], [h.sternX - 1.6, h.deckY(h.sternX) + 1.6, 1.4], 0.08);
    k.fixed.spar(p.spar, [h.sternX + 0.5, h.deckY(h.sternX), -1.4], [h.sternX - 1.6, h.deckY(h.sternX) + 1.6, -1.4], 0.08);
  },

  'XL1-2'(k, p) { // Brigg, 38 m
    const h = hull(k.fixed, { L: 31, B: 7.6, fb: 2.4, x0: -2.6, bow: 'spitz', bowLen: 0.32, overBow: 2.0, overStern: 1.4, sheerBow: 1.2, sheerStern: 0.9, stern: 'spiegel', transom: 0.62, stripeH: 0.7, bottom: 0.4 }, p);
    const bs = h.bowX;
    // Stückpforten im Streifen
    for (let x = h.sternX + 3; x < bs - 4; x += 2.6) {
      const y = h.deckY(x) - 0.55;
      for (const s of [1, -1]) k.fixed.box(0x2a2f38, 0.55, 0.4, 0.08, x, y, s * (h.halfW(x) + 0.04));
    }
    k.fixed.spar(p.spar, [bs - 1, h.deckY(bs) + 0.3, 0], [bs + 7.0, h.deckY(bs) + 2.6, 0], 0.2);
    k.fixed.box(p.house, 4.5, 1.1, 3.6, -9, h.deckY(-9), 0);
    k.fixed.box(p.trim, 4.7, 0.15, 3.8, -9, h.deckY(-9) + 1.1, 0);
    k.fixed.box(p.house, 1.8, 0.8, 1.8, 2, h.deckY(2), 0);
    const fx = 6.5, mx = -4.5;
    const yardsF = [{ y: 8, w: 13 }, { y: 14, w: 10 }, { y: 19, w: 7.5 }, { y: 23, w: 5 }];
    const yardsM = [{ y: 8.5, w: 13.5 }, { y: 15, w: 10.5 }, { y: 20.5, w: 7.8 }, { y: 25, w: 5.2 }];
    squareRig(k, p, fx, h.deckY(fx), 25.5, yardsF);
    squareRig(k, p, mx, h.deckY(mx), 27.5, yardsM);
    for (const [x, ht] of [[fx, 25.5], [mx, 27.5]]) {
      const d = h.deckY(x);
      k.fixed.box(p.spar, 2.4, 0.2, 2.4, x, d + ht * 0.4, 0, { body: false });
      k.fixed.box(p.spar, 1.6, 0.15, 1.6, x, d + ht * 0.72, 0, { body: false });
      for (const f of [0.4, 0.72, 0.95]) shrouds(k.fixed, h, x, d + ht * f, 4, 0.7);
    }
    // Besan-Gaffel am Großmast
    gaffSail(k, h, p, { x: mx - 0.4, deck: h.deckY(mx), foot: 2.4, throat: 8, peak: 12, boom: 10.5, gaff: 6.5 });
    k.fixed.line([mx, h.deckY(mx) + 27.5, 0], [fx, h.deckY(fx) + 25.5, 0]);
    headsail(k, p, [fx, h.deckY(fx) + 19], [bs + 6.8, h.deckY(bs) + 2.6]);
    headsail(k, p, [fx, h.deckY(fx) + 14], [bs + 2.5, h.deckY(bs) + 1.1], 0.5);
    k.fixed.line([bs + 7, h.deckY(bs) + 2.6, 0], [bs + 0.4, -0.2, 0]);
  },

  'XL1-3'(k, p) { // Haikutter, 25 m
    const h = hull(k.fixed, { L: 20.5, B: 6.2, fb: 1.6, x0: -2.0, bow: 'spitz', bowLen: 0.3, overBow: 0.4, overStern: 1.0, sheerBow: 1.1, sheerStern: 0.6, stern: 'spitz', sternLen: 0.3, stripeH: 0.55, bottom: 0.55 }, p);
    const bs = h.bowX;
    k.fixed.spar(p.spar, [bs - 1, h.deckY(bs) + 0.3, 0], [bs + 4.4, h.deckY(bs) + 0.8, 0], 0.15);
    // Ruderhaus achtern, Luke mittig, Fischkisten
    k.fixed.house(p.house, p.glass, 2.4, 2.0, 2.4, -7.5, h.deckY(-7.5), 0, { band: 0.3, at: 0.55 });
    k.fixed.box(p.trim, 2.7, 0.15, 2.7, -7.5, h.deckY(-7.5) + 2.0, 0);
    k.fixed.box(p.house, 3.2, 0.6, 2.4, 0.5, h.deckY(0.5), 0);
    for (const [x, z] of [[-4, 1.6], [-4.6, 1.6], [-4.3, -1.7]]) k.fixed.box(0x6a8aa8, 0.5, 0.35, 0.7, x, h.deckY(x), z);
    const fx = 2.5, ax = -5.0, fh = 19, ah = 13;
    for (const [x, ht] of [[fx, fh], [ax, ah]]) {
      k.fixed.cyl(p.spar, 0.13, 0.22, ht, x, h.deckY(x), 0, { seg: 6, body: false });
      shrouds(k.fixed, h, x, h.deckY(x) + ht * 0.8, 2, 0.8);
    }
    gaffSail(k, h, p, { x: fx, deck: h.deckY(fx), foot: 1.5, throat: 12, peak: 17, boom: 7, gaff: 5.5 });
    gaffSail(k, h, p, { x: ax, deck: h.deckY(ax), foot: 2.5, throat: 9, peak: 12, boom: 5, gaff: 3.6 });
    headsail(k, p, [fx, h.deckY(fx) + fh * 0.8], [bs + 4.3, h.deckY(bs) + 0.8]);
    k.fixed.line([bs + 4.4, h.deckY(bs) + 0.8, 0], [bs, -0.1, 0]);
  },

  'XL1-4'(k, p) { // Kogge, 26 m
    const h = hull(k.fixed, { L: 26, B: 7.6, fb: 2.6, x0: 0, bow: 'spitz', bowLen: 0.28, overBow: 4.0, overStern: 3.5, sheerBow: 1.8, sheerStern: 1.8, stern: 'spitz', sternLen: 0.24, stripeH: 0.5, bottom: 0.45, klinker: 6 }, p);
    // Achterkastell: Plattform mit Brüstung
    const cx0 = h.sternX + 0.6, cx1 = -5.5;
    const cy = h.deckY(cx0) + 1.6;
    k.fixed.slab(p.house, h.outline(cx0, cx1, 0.1, 6), h.deckY(cx1), cy - h.deckY(cx1));
    k.fixed.slab(p.deck, h.outline(cx0 + 0.1, cx1 - 0.1, 0.2, 6), cy, 0.1);
    const outline = h.outline(cx0, cx1, 0.15, 6);
    const half = outline.slice(0, 7);
    for (const [x, z] of half) {
      k.fixed.box(p.trim, 0.25, 1.1, 0.25, x, cy, z);
      k.fixed.box(p.trim, 0.25, 1.1, 0.25, x, cy, -z);
    }
    k.fixed.slab(p.trim, [[cx0, -3.4], [cx1, -3.4], [cx1, -3.2], [cx0, -3.2]].map(([x, z]) => [x, z * h.halfW(x) / 3.4]), cy + 1.0, 0.18);
    k.fixed.slab(p.trim, [[cx0, 3.2], [cx1, 3.2], [cx1, 3.4], [cx0, 3.4]].map(([x, z]) => [x, z * h.halfW(x) / 3.4]), cy + 1.0, 0.18);
    k.fixed.box(p.trim, 0.2, 0.18, h.halfW(cx1) * 2, cx1, cy + 1.0, 0);
    // Ruder am Achtersteven
    k.fixed.profile(p.house, [[h.sternX + 2.6, -1.6], [h.sternX + 3.6, -1.6], [h.sternX + 0.4, h.deckY(h.sternX)], [h.sternX - 0.2, h.deckY(h.sternX) - 0.4]], 0.3, 0);
    // Mast mit Rah und Mastkorb
    const mx = 1.0, d = h.deckY(mx), mh = 21;
    squareRig(k, p, mx, d, mh, [{ y: 16, w: 14 }], { r: 0.4 });
    k.fixed.cyl(p.house, 0.9, 0.7, 1.2, mx, d + mh - 1.8, 0, { seg: 8, body: false });
    for (const f of [0, 1.3, 2.6]) {
      const x = mx - 1 - f;
      k.fixed.line([mx, d + mh - 2, 0], [x, h.deckY(x), h.halfW(x)]);
      k.fixed.line([mx, d + mh - 2, 0], [x, h.deckY(x), -h.halfW(x)]);
    }
    k.fixed.line([mx, d + mh - 2, 0], [h.bowX - 0.3, h.deckY(h.bowX), 0]);
    // Wimpel
    k.fixed.poly(p.accent, [[mx, d + mh + 0.2, 0], [mx, d + mh - 0.6, 0], [mx - 3.2, d + mh - 0.3, 0]]);
    k.fixed.cyl(p.spar, 0.06, 0.06, 0.8, mx, d + mh - 0.6, 0, { seg: 4, body: false });
  },

  'XL1-5'(k, p) { // Plattbodenschiff, 23 m, Rumpf 6,2 m + Seitenschwerter
    const h = hull(k.fixed, { L: 21, B: 6.2, fb: 1.3, x0: -0.8, bow: 'rund', bowLen: 0.18, stern: 'rund', sternLen: 0.12, overBow: 0.6, overStern: 0.4, sheerBow: 1.0, sheerStern: 0.4, stripeH: 0.4, bottom: 0.92, depth: 0.5 }, p);
    // Roef (Kajüte) achtern
    k.fixed.house(p.house, p.glass, 4, 1.2, 3.4, -6, h.deckY(-6), 0, { band: 0.3, at: 0.45 });
    k.fixed.box(p.trim, 4.2, 0.12, 3.6, -6, h.deckY(-6) + 1.2, 0);
    k.fixed.box(p.stripe, 3, 0.4, 2.6, 0, h.deckY(0), 0);
    // Seitenschwerter, birnenförmig, an beiden Seiten
    const sx = 1.5;
    for (const s of [1, -1]) {
      const z = s * (h.halfW(sx) + 0.3);
      const top = h.deckY(sx) + 0.1;
      k.fixed.poly(p.house, [[sx - 0.5, top, z], [sx + 0.5, top, z], [sx + 2.2, -1.8, z + s * 0.3], [sx + 0.8, -2.6, z + s * 0.3], [sx - 1.4, -2.0, z + s * 0.3]], { body: true });
    }
    // Blattruder
    k.fixed.profile(p.house, [[h.sternX + 0.2, h.deckY(h.sternX)], [h.sternX - 1.2, h.deckY(h.sternX) - 0.2], [h.sternX - 1.8, -1.0], [h.sternX + 0.2, -1.0]], 0.25, 0);
    // Mast weit vorn, kurze gebogene Gaffel
    const mx = 3.5, d = h.deckY(mx), mh = 19;
    k.fixed.cyl(p.spar, 0.13, 0.24, mh, mx, d, 0, { seg: 6, body: false });
    shrouds(k.fixed, h, mx, d + mh * 0.8, 2, 0.9);
    gaffSail(k, h, p, { x: mx, deck: d, foot: 1.6, throat: 12, peak: 15, boom: 9.5, gaff: 3.8 });
    headsail(k, p, [mx, d + mh * 0.75], [h.bowX + 0.3, h.deckY(h.bowX) + 0.2], 0.5);
    // Seitenschwerter zählen zur Breite: 7,4 m
  },

  // ======================================== XL2 Großyacht
  'XL2-1'(k, p) { // Moderne Motoryacht, 32 m, drei Decks
    const h = hull(k.fixed, { L: 31.4, B: 7.2, fb: 2.6, x0: 0.3, bow: 'spitz', bowLen: 0.38, overBow: 3.2, overStern: 0, sheerBow: 0.8, sheerStern: 0, stern: 'spiegel', transom: 0.9, bootH: 0.5, bottom: 0.45 }, p);
    windowRow(k.fixed, h, p.stripe, -10, 6, 1.1, 3.2, 0.6, { height: 0.7 });
    // Badeplattform und Garagentor
    k.fixed.box(p.deck, 1.8, 0.25, 6.2, h.sternX - 0.8, 0.45, 0);
    k.fixed.box(p.trim, 0.06, 1.3, 3.2, h.sternX - 0.02, 0.8, 0);
    // Deck 1
    k.fixed.slab(p.house, h.outline(-12, 8, 0.5, 8), h.deckY(0), 2.4);
    k.fixed.slab(p.glass, h.outline(-11.4, 7.6, 0.44, 8), h.deckY(0) + 0.8, 1.1);
    // Deck 2
    k.fixed.slab(p.house, h.outline(-8, 5, 0.9, 8), h.deckY(0) + 2.4, 2.3);
    k.fixed.slab(p.glass, h.outline(-7.6, 4.6, 0.84, 8), h.deckY(0) + 3.1, 1.0);
    // Deck 3 (Flybridge) mit Hardtop
    const y3 = h.deckY(0) + 4.7;
    k.fixed.slab(p.house, h.outline(-5, 2.5, 1.4, 6), y3, 1.1);
    k.fixed.slab(p.trim, h.outline(-4.4, 2.2, 1.6, 6), y3 + 2.6, 0.25);
    for (const [x, z] of [[-4, 1.5], [-4, -1.5], [1.6, 1.5], [1.6, -1.5]]) k.fixed.box(p.trim, 0.15, 1.5, 0.15, x, y3 + 1.1, z);
    // Radarmast mit Dom
    k.fixed.profile(p.house, [[-2.5, y3 + 2.85], [-0.6, y3 + 2.85], [-1.6, y3 + 4.1], [-2.5, y3 + 4.1]], 0.8, 0);
    k.fixed.sphere(0xfff8ea, 0.55, -2.1, y3 + 4.5, 0);
    radar(k, p, -1.6, y3 + 4.1, 2.0);
    // Beiboot auf dem Vordeck
    dinghy(k.fixed, 10, h.deckY(10), 0, 3.6, p, { color: 0x2e3c4e });
    k.fixed.rail(p.trim, h.outline(8, h.bowX - 0.6, 0.15, 6).slice(0, 7), h.deckY(10), 0.9);
  },

  'XL2-2'(k, p) { // Große Segelyacht, 34 m, Mast 44 m
    const h = hull(k.fixed, { L: 34, B: 7.4, fb: 1.7, bow: 'spitz', bowLen: 0.42, overBow: 2.4, overStern: 2.8, sheerBow: 0.4, sheerStern: 0.15, stern: 'spiegel', transom: 0.72, stripeH: 0.18, bottom: 0.32 }, p);
    // flacher Decksalon
    k.fixed.slab(p.house, h.outline(-3, 6, 1.1, 6), h.deckY(0), 1.0);
    k.fixed.slab(p.glass, h.outline(-2.6, 5.6, 1.06, 6), h.deckY(0) + 0.35, 0.4);
    // Cockpit und zwei Steuerräder
    k.fixed.slab(p.deck, h.outline(-12, -6, 1.3, 4), h.deckY(-9), 0.5);
    for (const z of [1.6, -1.6]) k.fixed.spar(p.trim, [-13.5, h.deckY(-13.5) + 1.4, z - 0.02], [-13.5, h.deckY(-13.5) + 1.4, z + 0.02], 0.65, { seg: 10, body: true });
    const mx = 5.5, d = h.deckY(mx), mh = 42.3;
    k.fixed.cyl(p.spar, 0.22, 0.4, mh, mx, d, 0, { seg: 6, body: false });
    for (const f of [0.35, 0.65]) k.fixed.spar(p.spar, [mx, d + mh * f, -2.4], [mx, d + mh * f, 2.4], 0.1);
    shrouds(k.fixed, h, mx, d + mh * 0.97, 2, 1.6);
    k.fixed.line([mx, d + mh, 0], [h.sternX + 0.3, h.deckY(h.sternX), 0]);
    // Baum mit Persenning, Segel gesetzt als großes Dreieck
    const boom = 15;
    k.fixed.spar(p.spar, [mx, d + 3, 0], [mx - boom, d + 3.3, 0], 0.22);
    k.furled.box(p.spar, boom - 0.5, 0.9, 0.9, mx - boom / 2 - 0.3, d + 3.1, 0, { body: false });
    k.sail(p.sail, [[mx - 0.3, d + 3.4, 0], [mx - boom + 0.4, d + 3.6, 0], [mx - 1.4, d + mh - 1, 0], [mx - 0.3, d + mh - 1, 0]]);
    headsail(k, p, [mx, d + mh * 0.92], [h.bowX - 0.3, h.deckY(h.bowX) + 0.3], 0.6);
    k.furled.spar(p.sail, [mx + 0.1, d + mh * 0.9, 0], [h.bowX - 0.4, h.deckY(h.bowX) + 0.8, 0], 0.18);
  },

  'XL2-3'(k, p) { // Explorer-Yacht, 30 m
    const h = hull(k.fixed, { L: 30, B: 7.4, fb: 2.8, bow: 'spitz', bowLen: 0.3, overBow: 0.6, sheerBow: 2.0, sheerStern: 0, stern: 'spiegel', transom: 0.85, stripeH: 0.35, bootH: 0.6, bottom: 0.5 }, p);
    windowRow(k.fixed, h, p.glass, 1, 7, 1.4, 0.5, 1.0);
    // Aufbau vorn, steile Front
    const y = h.deckY(4);
    k.fixed.slab(p.house, h.outline(-3, 9, 0.5, 8), y, 2.5);
    k.fixed.slab(p.glass, h.outline(-2.6, 8.7, 0.46, 8), y + 0.9, 1.1);
    k.fixed.slab(p.house, h.outline(-1, 8, 1.0, 8), y + 2.5, 2.3);
    k.fixed.profile(p.glass, [[5.5, y + 3.0], [8.2, y + 3.0], [7.6, y + 4.3], [5.5, y + 4.3]], h.halfW(7) * 2 - 1.9, 0);
    k.fixed.slab(p.trim, h.outline(-1.4, 8.3, 0.9, 8), y + 4.8, 0.25);
    // Radarmast
    k.fixed.cyl(p.trim, 0.2, 0.3, 4.5, 2.5, y + 5.05, 0, { seg: 6 });
    k.fixed.box(p.trim, 0.3, 0.2, 3.8, 2.5, y + 7.3, 0);
    radar(k, p, 2.5, y + 8.0, 2.6);
    // Arbeitsdeck achtern mit zwei Beibooten und Kran
    dinghy(k.fixed, -8.8, h.deckY(-9) + 0.1, 1.6, 4.4, p, { color: p.accent });
    dinghy(k.fixed, -8.8, h.deckY(-9) + 0.1, -1.6, 4.0, p, { color: 0x2e3c4e });
    const crane = new Kit();
    crane.cyl(p.accent, 0.35, 0.45, 2.6, 0, 0, 0, { seg: 6 });
    crane.spar(p.accent, [0, 2.4, 0], [-6.2, 3.6, 0], 0.22, { body: true });
    crane.box(p.accent, 0.8, 0.8, 0.8, 0, 1.8, 0);
    const cg = crane.toGroup('crane');
    cg.position.set(-4, h.deckY(-4), 2.4);
    k.addMoving(cg, { name: 'crane', type: 'swing', axis: 'y', speed: 0.25, amount: 0.6 });
    k.fixed.bodyTop = Math.max(k.fixed.bodyTop, h.deckY(-4) + 3.8);
  },

  'XL2-4'(k, p) { // Klassische Motoryacht, 28 m
    const h = hull(k.fixed, { L: 28, B: 5.6, fb: 1.7, bow: 'spitz', bowLen: 0.45, overBow: 4.0, overStern: 2.4, sheerBow: 0.9, sheerStern: 0.3, stern: 'rund', sternLen: 0.2, stripeH: 0.2, bottom: 0.4 }, p);
    // langer Holzaufbau mit Fensterband
    k.fixed.house(p.house, p.glass, 11, 1.7, 3.8, 1.5, h.deckY(1.5), 0, { band: 0.35, at: 0.42, back: true });
    k.fixed.box(p.trim, 11.4, 0.15, 4.2, 1.5, h.deckY(1.5) + 1.7, 0);
    k.fixed.house(p.house, p.glass, 2.6, 1.4, 2.8, 5.0, h.deckY(1.5) + 1.85, 0, { band: 0.45, at: 0.4 });
    k.fixed.box(p.trim, 2.9, 0.12, 3.0, 5.0, h.deckY(1.5) + 3.25, 0);
    // Schornstein
    funnel(k, p, 1.0, h.deckY(1.5) + 1.85, 2.4, 0.8, 0.65, { band: false, rake: 0.6 });
    // Flaggenmast vorn
    k.fixed.cyl(p.trim, 0.06, 0.12, 6.5, 3.5, h.deckY(1.5) + 3.37, 0, { seg: 5, body: false });
    // Sonnensegel über dem Achterdeck
    const sy = h.deckY(-8) + 2.2;
    k.fixed.slab(0xfff8ea, h.outline(-11.5, -5, 0.4, 5), sy, 0.12);
    for (const x of [-11, -8, -5.3]) for (const s of [1, -1]) k.fixed.spar(p.trim, [x, h.deckY(x), s * (h.halfW(x) - 0.45)], [x, sy, s * (h.halfW(x) - 0.45)], 0.05, { seg: 3 });
    // Beiboot in Davits
    dinghy(k.fixed, -2.5, h.deckY(1.5) + 1.85, 0, 3.2, p);
  },

  'XL2-5'(k, p) { // Maxi-Racer, 30 m, Mast 41 m
    const h = hull(k.fixed, { L: 28.2, B: 6.2, fb: 1.5, x0: -0.9, bow: 'spitz', bowLen: 0.45, overBow: 0, overStern: 0.6, sheerBow: 0.25, sheerStern: 0, stern: 'offen', transom: 0.92, stripeH: 0.15, bottom: 0.3 }, p);
    const bs = h.bowX;
    k.fixed.spar(p.spar, [bs - 1, h.deckY(bs) + 0.1, 0], [bs + 1.8, h.deckY(bs) + 0.3, 0], 0.12);
    // flache Kajütkappe
    k.fixed.slab(p.house, h.outline(-1, 4, 1.4, 4), h.deckY(0), 0.45);
    // zwei große Steuerräder
    for (const z of [1.7, -1.7]) k.fixed.spar(p.trim, [-11.5, h.deckY(-11.5) + 1.25, z - 0.02], [-11.5, h.deckY(-11.5) + 1.25, z + 0.02], 0.95, { seg: 12, body: true });
    const mx = 3.5, d = h.deckY(mx), mh = 39.5;
    k.fixed.cyl(p.spar, 0.2, 0.32, mh, mx, d, 0, { seg: 6, body: false });
    for (const f of [0.3, 0.55, 0.78]) k.fixed.spar(p.spar, [mx, d + mh * f, -2.2], [mx, d + mh * f, 2.2], 0.08);
    shrouds(k.fixed, h, mx, d + mh * 0.96, 2, 1.8);
    k.fixed.line([mx, d + mh, 0], [h.sternX + 0.6, h.deckY(h.sternX), 0]);
    const boom = 13;
    k.fixed.spar(p.spar, [mx, d + 2.2, 0], [mx - boom, d + 2.4, 0], 0.2);
    k.furled.box(p.sail, boom - 1, 0.7, 0.8, mx - boom / 2 - 0.2, d + 2.3, 0, { body: false });
    k.sail(p.sail, [[mx - 0.3, d + 2.5, 0], [mx - boom + 0.2, d + 2.7, 0], [mx - 3.5, d + mh - 1, 0], [mx - 0.3, d + mh - 0.5, 0]]);
    headsail(k, p, [mx, d + mh * 0.94], [bs + 1.7, h.deckY(bs) + 0.3], 0.62);
  },

  // ======================================== XL3 Fahrgast- und Arbeitsschiff
  'XL3-1'(k, p) { // Ausflugsschiff, 32 m
    const h = hull(k.fixed, { L: 32, B: 7.2, fb: 1.6, bow: 'spitz', bowLen: 0.3, overBow: 1.2, overStern: 0.6, sheerBow: 0.7, sheerStern: 0.1, stern: 'rund', sternLen: 0.12, stripeH: 0.45, bottom: 0.55 }, p);
    const y = h.deckY(0);
    // Salon mit großer Fensterfläche
    k.fixed.slab(p.house, h.outline(-13.5, 10, 0.45, 10), y, 2.5);
    k.fixed.slab(p.glass, h.outline(-13.1, 9.6, 0.41, 10), y + 0.9, 1.3);
    k.fixed.slab(p.trim, h.outline(-13.7, 10.2, 0.35, 10), y + 2.5, 0.15);
    // Sonnendeck: Bänke, Reling, Steuerhaus vorn
    const sd = y + 2.65;
    for (let x = -12; x < 4; x += 1.8) {
      const w = h.halfW(x) - 1.0;
      k.fixed.box(p.accent, 0.5, 0.45, w * 0.8, x, sd, w * 0.5);
      k.fixed.box(p.accent, 0.5, 0.45, w * 0.8, x, sd, -w * 0.5);
    }
    k.fixed.rail(0xfff8ea, h.outline(-13.4, 9.8, 0.5, 10), sd, 1.0, { closed: true, posts: 3 });
    k.fixed.house(p.house, p.glass, 4.0, 2.2, 3.6, 7.3, sd, 0, { band: 0.4, at: 0.45 });
    k.fixed.box(p.trim, 4.3, 0.15, 3.9, 7.3, sd + 2.2, 0);
    k.fixed.cyl(p.trim, 0.06, 0.1, 4.0, 7.3, sd + 2.35, 0, { seg: 5, body: false });
    // Rettungsringe am Salon
    for (const x of [-8, 0]) for (const s of [1, -1]) k.fixed.box(p.accent, 0.6, 0.6, 0.08, x, y + 0.25, s * (h.halfW(x) - 0.4));
  },

  'XL3-2'(k, p) { // Seitenraddampfer, 33 m, Rumpf 6 m + Radkästen = 8 m
    const h = hull(k.fixed, { L: 33, B: 5.8, fb: 1.4, bow: 'spitz', bowLen: 0.32, overBow: 1.5, overStern: 1.0, sheerBow: 0.8, sheerStern: 0.2, stern: 'rund', sternLen: 0.14, stripeH: 0.35, bottom: 0.6 }, p);
    const y = h.deckY(0);
    // Promenadendeck breiter als der Rumpf (Seitengänge über den Radkästen)
    k.fixed.slab(p.deck, h.outline(-13, 12, -0.2, 10), y, 0.2);
    k.fixed.slab(p.house, h.outline(-12, 7, 0.6, 10), y + 0.2, 2.3);
    k.fixed.slab(p.glass, h.outline(-11.6, 6.6, 0.56, 10), y + 1.0, 1.1);
    k.fixed.slab(p.trim, h.outline(-12.2, 7.2, 0.5, 10), y + 2.5, 0.15);
    k.fixed.rail(0xfff8ea, h.outline(-12, 7, 0.65, 10), y + 2.65, 0.9, { closed: true, posts: 3 });
    k.fixed.house(p.house, p.glass, 2.6, 1.8, 3.4, 5.0, y + 2.65, 0, { band: 0.45, at: 0.4 });
    k.fixed.box(p.trim, 2.9, 0.12, 3.7, 5.0, y + 4.45, 0);
    funnel(k, p, -0.5, y + 2.65, 6.5, 0.7, 0.7, { color: 0x2a2f38, band: true, top: p.accent });
    k.fixed.cyl(p.trim, 0.06, 0.1, 5.0, 9.5, y + 0.2, 0, { seg: 5, body: false });
    // Radkästen und Schaufelräder
    const wx = -1.0, wr = 2.6, half = h.halfW(wx);
    for (const s of [1, -1]) paddleWheel(k, p, wx, s * (half + 0.55), s, wr);
  },

  'XL3-3'(k, p) { // Personenfähre, 28 m, vorn und hinten gleich
    const h = hull(k.fixed, { L: 26, B: 7.8, fb: 1.6, bow: 'stumpf', bowLen: 0.18, stern: 'stumpf', sternLen: 0.18, overBow: 0.8, overStern: 0.8, sheerBow: 0.2, sheerStern: 0.2, stripeH: 0.4, bottom: 0.75 }, p);
    const y = h.deckY(0);
    // Rampen an beiden Enden
    for (const s of [1, -1]) {
      const x0 = s * 13, x1 = s * 14.2;
      k.fixed.poly(p.accent, [[x0, y + 0.05, -2.4], [x0, y + 0.05, 2.4], [x1, y + 0.9, 2.4], [x1, y + 0.9, -2.4]], { body: true });
      k.fixed.box(p.trim, 0.25, 2.2, 0.25, s * 12.2, y, 2.6);
      k.fixed.box(p.trim, 0.25, 2.2, 0.25, s * 12.2, y, -2.6);
    }
    // Fahrspur-Markierungen und Fahrräder
    for (const z of [-0.9, 0.9]) k.fixed.box(0xfad060, 22, 0.02, 0.12, 0, y + 0.01, z);
    for (let i = 0; i < 6; i++) {
      const x = -9 + i * 1.1, z = -2.2;
      k.fixed.box([0xee6454, 0x487ac0, 0x2a2f38][i % 3], 0.9, 0.55, 0.08, x, y + 0.35, z);
      k.fixed.cyl(0x2a2f38, 0.3, 0.3, 0.06, x - 0.35, y + 0.05, z, { seg: 8 });
    }
    // Fahrgastraum an einer Seite
    k.fixed.house(p.house, p.glass, 14, 2.4, 2.2, 0, y, 2.6, { band: 0.4, at: 0.45, front: true, back: true });
    k.fixed.box(p.trim, 14.2, 0.15, 2.4, 0, y + 2.4, 2.6);
    // Brücke mittig quer auf Stützen
    const by = y + 3.8;
    for (const z of [-3.0, 3.0]) for (const x of [-0.9, 0.9]) k.fixed.box(p.trim, 0.25, by - y, 0.25, x, y, z);
    k.fixed.box(p.house, 2.6, 0.3, 7.4, 0, by, 0);
    k.fixed.house(p.house, p.glass, 2.6, 2.0, 3.4, 0, by + 0.3, 0, { band: 0.45, at: 0.4, back: true });
    k.fixed.box(p.trim, 2.9, 0.15, 3.7, 0, by + 2.3, 0);
    k.fixed.cyl(p.trim, 0.06, 0.1, 2.4, 0, by + 2.45, 0, { seg: 5, body: false });
  },

  'XL3-4'(k, p) { // Tonnenleger, 33 m
    const h = hull(k.fixed, { L: 33, B: 7.8, fb: 2.3, bow: 'spitz', bowLen: 0.28, overBow: 1.0, overStern: 0, sheerBow: 1.4, sheerStern: 0, stern: 'spiegel', transom: 0.92, stripeH: 0.8, bottom: 0.55, deckDrop: 0.7 }, p);
    // Aufbau vorn, zweistöckig
    const y = h.deckY(9);
    k.fixed.slab(p.house, h.outline(5, 12.5, 0.3, 6), y, 2.4);
    k.fixed.slab(p.glass, h.outline(5.4, 12.1, 0.26, 6), y + 0.9, 0.8);
    k.fixed.slab(p.house, h.outline(6.5, 11.5, 0.9, 6), y + 2.4, 2.2);
    k.fixed.profile(p.glass, [[9.6, y + 3.0], [11.6, y + 3.0], [11.3, y + 4.2], [9.6, y + 4.2]], h.halfW(10.5) * 2 - 1.7, 0);
    k.fixed.slab(p.trim, h.outline(6.3, 11.8, 0.7, 6), y + 4.6, 0.2);
    k.fixed.cyl(p.trim, 0.2, 0.3, 4.5, 8.5, y + 4.8, 0, { seg: 6 });
    k.fixed.box(p.trim, 0.3, 0.2, 3.4, 8.5, y + 7.0, 0);
    radar(k, p, 8.5, y + 8.0, 2.4);
    // Tonnen auf dem Arbeitsdeck
    const dy = h.deckY(-6);
    buoyTonne(k.fixed, -10, dy, 2.0, 0xee5a4e, false);
    buoyTonne(k.fixed, -12.5, dy, 1.8, 0x509e80, true);
    buoyTonne(k.fixed, -10.5, dy, -2.0, 0x509e80, true);
    buoyTonne(k.fixed, -13, dy, -1.6, 0xfad060, false);
    for (let i = 0; i < 5; i++) k.fixed.box(0x5c6878, 0.5, 0.5, 0.9, -6 - i * 0.6, dy, -2.8);
    // Großer Kran mittschiffs
    const crane = new Kit();
    crane.cyl(p.accent, 0.6, 0.7, 4.0, 0, 0, 0, { seg: 8 });
    crane.box(p.accent, 1.8, 1.4, 1.6, -0.2, 3.4, 0);
    crane.spar(p.accent, [0, 4.2, 0], [-11, 7.6, 0], 0.32, { body: true });
    crane.line([-11, 7.6, 0], [-11, 2.0, 0]);
    crane.box(0x2a2f38, 0.5, 0.6, 0.5, -11, 1.6, 0);
    const cg = crane.toGroup('crane');
    cg.position.set(1.5, h.deckY(1.5), 0);
    k.addMoving(cg, { name: 'crane', type: 'swing', axis: 'y', speed: 0.18, amount: 0.5 });
    k.fixed.bodyTop = Math.max(k.fixed.bodyTop, h.deckY(1.5) + 6);
  },

  'XL3-5'(k, p) { // Hafenschlepper, 26 m
    const h = hull(k.fixed, { L: 25.4, B: 6.8, fb: 1.5, x0: -0.3, bow: 'spitz', bowLen: 0.4, overBow: 1.2, overStern: 0.8, sheerBow: 2.2, sheerStern: 0.1, stern: 'rund', sternLen: 0.2, stripeH: 0.45, bottom: 0.6 }, p);
    // umlaufender Gummifender
    const pts = h.outline(h.sternX + 0.2, h.bowX - 0.2, -0.25, 14);
    for (let i = 0; i < pts.length; i++) {
      const [x1, z1] = pts[i], [x2, z2] = pts[(i + 1) % pts.length];
      const y1 = h.deckY(x1) - 0.55, y2 = h.deckY(x2) - 0.55;
      k.fixed.spar(0x2a2f38, [x1, y1, z1], [x2, y2, z2], 0.35, { seg: 4, body: false });
    }
    // Aufbau mit Steuerhaus, Rundumsicht
    const y = h.deckY(3);
    k.fixed.slab(p.house, h.outline(-2, 8, 1.0, 6), y, 2.0);
    k.fixed.slab(p.house, h.outline(1, 6.5, 1.6, 6), y + 2.0, 2.2);
    k.fixed.slab(p.glass, h.outline(1.3, 6.2, 1.56, 6), y + 2.8, 1.0);
    k.fixed.slab(p.trim, h.outline(0.7, 6.8, 1.4, 6), y + 4.2, 0.2);
    funnel(k, p, -1.0, y + 2.0, 2.6, 0.9, 1.1, { color: p.accent, top: 0x2a2f38, band: true, rake: 0.5 });
    k.fixed.cyl(p.trim, 0.12, 0.18, 4.5, 4.5, y + 4.4, 0, { seg: 5, body: false });
    k.fixed.box(p.trim, 0.2, 0.15, 2.2, 4.5, y + 7.0, 0, { body: false });
    radar(k, p, 4.5, y + 8.9, 1.8);
    k.fixed.bodyTop = y + 4.4;
    // Schlepphaken, Winde und Schleppbogen achtern
    const ax = -8;
    k.fixed.box(0x5c6878, 1.6, 1.2, 2.4, -3.2, h.deckY(-3.2), 0);
    const drum = new THREE.CylinderGeometry(0.6, 0.6, 2.0, 10);
    drum.rotateX(Math.PI / 2);
    drum.translate(-3.2, h.deckY(-3.2) + 1.6, 0);
    k.fixed.add(p.accent, drum);
    const by = h.deckY(ax);
    for (const s of [1, -1]) k.fixed.spar(p.trim, [ax, by, s * (h.halfW(ax) - 0.4)], [ax - 0.6, by + 2.4, s * 1.2], 0.12);
    k.fixed.spar(p.trim, [ax - 0.6, by + 2.4, -1.2], [ax - 0.6, by + 2.4, 1.2], 0.12);
    k.fixed.box(0xfad060, 0.5, 0.6, 0.5, -4.6, by, 0);
  },
};

function kindOf(model) {
  return model.propulsion === 'sail' ? 'sail' : 'motor';
}

export const { buildBoat, setSails, animateBoat } = makeBoatApi('XL', BUILDERS, kindOf);
export { TYPES, MODELS };

/**
 * Vorbeifahrende XL-Schiffe auf der Ostsee, nördlich der Nehrung.
 * Sie sind Kulisse: Sie zeigen schon in den ersten Stufen, welche Schiffe später
 * in den Außenhafen kommen. Sie sind nicht antippbar, weil sie (noch) keine Gäste sind.
 * Sobald die Spielregeln XL-Gäste schicken, laufen diese über buildBoat und boat-anim.js.
 */
const LANES = [
  { z: -203, dir: 1 },   // ostwärts, weiter draußen
  { z: -184, dir: -1 },  // westwärts, näher an der Nehrung
];
const X_FAR = 230;       // Start und Ende außerhalb der Karte (Karte reicht etwa von -186 bis 190 m)

function disposeGroup(group) {
  group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
}

export function startTraffic(game, { maxShips = 2, firstAt = 0.35 } = {}) {
  const root = new game.THREE.Group();
  root.name = 'xl-traffic';
  game.scene.add(root);
  const ships = [];
  let next = 8;

  const spawn = (progress = 0) => {
    const used = new Set(ships.map((s) => s.lane));
    const free = LANES.map((l, i) => i).filter((i) => !used.has(i));
    if (!free.length) return;
    const lane = free[Math.floor(Math.random() * free.length)];
    const { z, dir } = LANES[lane];
    const model = MODELS[Math.floor(Math.random() * MODELS.length)];
    const sail = model.propulsion === 'sail';
    const group = buildBoat(model, { palette: Math.floor(Math.random() * 3), sails: sail });
    const speed = sail ? 3.2 : 4.2;                  // m/s, gemütlich
    const x0 = -dir * X_FAR;
    group.position.set(x0 + dir * 2 * X_FAR * progress, 0, z);
    group.rotation.y = dir > 0 ? 0 : Math.PI;
    root.add(group);
    ships.push({ group, lane, dir, speed, phase: Math.random() * 6 });
  };

  spawn(firstAt);
  game.onTick((dt) => {
    if (!dt) return;
    const t = game.time;
    for (let i = ships.length - 1; i >= 0; i--) {
      const s = ships[i];
      s.group.position.x += s.dir * s.speed * dt;
      // leichtes Stampfen und Rollen nur hier draußen, die Modelle selbst schaukeln nicht
      s.group.rotation.z = Math.sin(t * 0.7 + s.phase) * 0.012;
      s.group.rotation.x = Math.sin(t * 0.5 + s.phase) * 0.01;
      animateBoat(s.group, t, { speed: s.speed });
      if (Math.abs(s.group.position.x) > X_FAR + 5) {
        root.remove(s.group);
        disposeGroup(s.group);
        ships.splice(i, 1);
      }
    }
    next -= dt;
    if (next <= 0) {
      if (ships.length < maxShips) spawn(0);
      next = 25 + Math.random() * 35;
    }
  });
  return root;
}

export function init(game) {
  game.boatTypes ??= {};
  game.boatTypes.xl = { size: 'XL', TYPES, MODELS, buildBoat, setSails, animateBoat };
  game.boatTypes.XL = game.boatTypes.xl;   // Alias, Schreibweise ist klein
  startTraffic(game);
}
