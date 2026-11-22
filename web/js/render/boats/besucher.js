// 3D-Modelle der seltenen Besucher (Paket P40, docs/besucher.md): Weltumsegler-Kutter, Museumsdampfer,
// Forschungskutter (Größe L) und Königsyacht (Größe XL). Daten: web/js/data/boats/besucher.js.
// Gebaut mit dem Baukasten der XL-Schiffe (xl-kit.js), der jede Länge kann.
//
// init(game) hängt die Modelle an game.boatTypes.l und game.boatTypes.xl an: MODELS bekommt die neuen
// Einträge, buildBoat baut sie (alle anderen Modelle baut wie bisher das Modul der Größe).
// Muss nach render/boats/l.js und xl.js laufen (features/besucher.js ruft es beim Start auf).

import * as THREE from 'three';
import { MODELS as DATEN } from '../../data/boats/besucher.js';
import { hull, mast, headsail, funnel, dinghy, radar, latticeMast, windowRow, Kit, makeBoatApi } from './xl-kit.js';

const zahl = (c) => (typeof c === 'string' ? parseInt(c.slice(1), 16) : c);
const GOLD = 0xd9b44a;
const MESSING = 0xc9a227;
const FLAGGEN = [0xee6454, 0xfad060, 0x487ac0, 0xfff8ea, 0x509e80, 0xf08a3c, 0x2e4868];

// Palette in der Schreibweise des Baukastens (hull, boot, stripe, deck, house, trim, glass, sail, spar, accent)
function palette(m) {
  const q = m.palettes?.[0] ?? {};
  return {
    hull: zahl(q.hull ?? '#fff8ea'), boot: zahl(q.boot ?? '#8a2f2f'), stripe: zahl(q.stripe ?? q.trim ?? '#2e4868'),
    deck: zahl(q.deck ?? '#d8a870'), house: zahl(q.house ?? '#fff8ea'), trim: zahl(q.trim ?? q.roof ?? '#2e4868'),
    glass: zahl(q.glass ?? '#3e5e7a'), sail: zahl(q.sail ?? '#fbf7ee'), spar: zahl(q.spar ?? '#9aa6b4'),
    accent: zahl(q.accent ?? q.canvas ?? '#ee6454'), canvas: zahl(q.canvas ?? '#9c3c46'), roof: zahl(q.roof ?? q.house ?? '#fff8ea'),
  };
}

/** Flaggenleine (über die Toppen geflaggt): kleine bunte Dreiecke entlang der Punkte. */
function flaggenleine(kit, punkte, abstand = 0.9, groesse = 0.42) {
  let n = 0;
  for (let i = 0; i < punkte.length - 1; i++) {
    const a = punkte[i], b = punkte[i + 1];
    kit.line(a, b);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const k = Math.max(1, Math.floor(len / abstand));
    for (let j = 1; j < k; j++) {
      const t = j / k;
      const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, z = a[2] + (b[2] - a[2]) * t;
      const c = FLAGGEN[n++ % FLAGGEN.length];
      // Wimpel hängt unter der Leine, quer zum Schiff sichtbar (beidseitig)
      kit.poly(c, [[x - groesse * 0.4, y, z], [x + groesse * 0.4, y, z], [x, y - groesse, z]]);
      kit.poly(c, [[x + groesse * 0.4, y, z], [x - groesse * 0.4, y, z], [x, y - groesse, z]]);
    }
  }
}

/** Flagge als eigene Gruppe (weht über boat-anim, Name beginnt mit 'flag'). */
function flagge(k, name, x, y, z, w, h, farben) {
  const f = new Kit();
  const streifen = farben.length;
  farben.forEach((c, i) => {
    const y0 = -(h * i) / streifen, y1 = -(h * (i + 1)) / streifen;
    f.poly(c, [[0, y0, 0], [-w, y0, 0], [-w, y1, 0], [0, y1, 0]]);
    f.poly(c, [[0, y0, 0], [0, y1, 0], [-w, y1, 0], [-w, y0, 0]]);
  });
  const g = f.toGroup(name);
  g.position.set(x, y, z);
  k.addPart(g);
}

/** Dreieckiges Großsegel am Mast, Baum nach achtern; geborgen als Persenning auf dem Baum. */
function grosssegel(k, p, x, deck, top, boom) {
  const y0 = deck + 1.3;
  k.fixed.spar(p.spar, [x, y0, 0], [x - boom, y0 + 0.15, 0], 0.07);
  k.sail(p.sail, [[x, y0 + 0.1, 0], [x - boom + 0.2, y0 + 0.25, 0], [x, top - 0.3, 0]]);
  k.furled.spar(p.canvas, [x - 0.1, y0 + 0.28, 0], [x - boom * 0.92, y0 + 0.3, 0], 0.2, { seg: 6 });
}

const BUILDERS = {
  // ------------------------------------------------ Weltumsegler-Kutter, 11,8 m, Spitzgatter aus Stahl
  'L5-1'(k, p) {
    const h = hull(k.fixed, { L: 11.0, B: 3.7, fb: 1.05, x0: -0.3, bow: 'spitz', bowLen: 0.38, stern: 'spitz', sternLen: 0.3, sheerBow: 0.35, sheerStern: 0.2, stripeH: 0.14, bottom: 0.4, depth: 0.5, bootH: 0.25 }, p);
    const bx = h.bowX, sx = h.sternX;
    const d = (x) => h.deckY(x);
    // Bugspriet für den Kutter
    k.fixed.spar(p.spar, [bx - 0.5, d(bx) + 0.15, 0], [bx + 0.9, d(bx) + 0.3, 0], 0.07);
    // Aufbau mit Fenstern und Sprayhood
    k.fixed.house(p.house, p.glass, 3.4, 0.62, 2.0, 0.2, d(0.2), 0, { band: 0.4, at: 0.35 });
    k.fixed.box(p.canvas, 1.0, 0.7, 2.0, -1.95, d(-1.95), 0, { body: false });
    // Mast mit Wanten, Großsegel und zwei Vorsegeln (Kutter)
    const mx = 1.2, top = d(mx) + 14.2;
    mast(k, h, p, mx, 14.2, { r: 0.12, shroudCount: 2, spread: 0.8 });
    grosssegel(k, p, mx, d(mx), top, 4.6);
    headsail(k, p, [mx, top], [bx + 0.85, d(bx) + 0.35], 0.6);
    headsail(k, p, [mx, top - 2.5], [bx - 0.6, d(bx) + 0.2], 0.5);
    k.furled.spar(p.canvas, [bx + 0.8, d(bx) + 0.5, 0], [mx + 0.1, top - 0.6, 0], 0.09, { seg: 5 });
    k.fixed.line([mx, top, 0], [sx + 0.2, d(sx) + 0.4, 0]);
    // Solarbügel und Windfahne am Heck
    const ax = sx + 1.2;
    for (const s of [1, -1]) k.fixed.spar(0xb8c2cc, [ax, d(ax), s * 1.1], [ax - 0.2, d(ax) + 2.0, s * 0.9], 0.05, { seg: 4 });
    k.fixed.box(0x2e4868, 1.1, 0.05, 2.0, ax - 0.35, d(ax) + 2.0, 0, { body: false });
    k.fixed.spar(0xb8c2cc, [sx + 0.2, d(sx) + 0.2, 0], [sx - 0.25, d(sx) + 1.5, 0], 0.05, { seg: 4 });
    k.fixed.box(0xfff8ea, 0.06, 0.8, 0.45, sx - 0.25, d(sx) + 1.5, 0, { body: false });
    // Beiboot kieloben vor dem Mast, Kanister an der Reling
    dinghy(k.fixed, 2.9, d(2.9) + 0.05, 0, 2.3, p, { color: 0x9aa8b4 });
    [0xfad060, 0xee6454, 0x487ac0, 0xfad060].forEach((c, i) => {
      const x = -0.6 + i * 0.45;
      for (const s of [1, -1]) k.fixed.box(c, 0.32, 0.42, 0.16, x, d(x), s * (h.halfW(x) - 0.12), { body: false });
    });
    // Gastlandflaggen: Leine vom Bugspriet über den Masttopp zum Heck, dazu unter der Saling
    flaggenleine(k.fixed, [[bx + 0.9, d(bx) + 0.35, 0], [mx, top, 0], [sx + 0.2, d(sx) + 0.5, 0]], 0.75, 0.38);
    flagge(k, 'flag-gast', mx, d(mx) + 9.4, h.halfW(mx) * 0.6, 0.6, 0.4, [0xee6454, 0xfff8ea, 0x487ac0]);
    k.fixed.bodyTop = d(0) + 0.8;
  },

  // ------------------------------------------------ Museumsdampfer, 13,8 m Dampfbarkasse von 1908
  'L5-2'(k, p) {
    const h = hull(k.fixed, { L: 13.6, B: 3.6, fb: 1.0, x0: 0, bow: 'spitz', bowLen: 0.28, stern: 'rund', sternLen: 0.22, sheerBow: 0.45, sheerStern: 0.25, stripeH: 0.16, bottom: 0.5, depth: 0.6, overStern: 0.6 }, p);
    const d = (x) => h.deckY(x);
    // Aufbau aus Mahagoni mit Fensterreihe und hellem Dach
    k.fixed.house(p.house, p.glass, 4.6, 1.05, 2.3, 0.6, d(0.6), 0, { band: 0.36, at: 0.42, back: true });
    k.fixed.box(p.roof, 5.0, 0.1, 2.6, 0.6, d(0.6) + 1.05, 0);
    // Hoher schwarzer Schornstein mit rotem Band, Messingpfeife; Dampf bei Fahrt (Name smoke)
    funnel(k, { ...p, accent: 0x2a2f38 }, 1.6, d(1.6) + 1.1, 3.2, 0.32, 0.32, { band: false, top: 0x2a2f38, color: 0x2a2f38 });
    k.fixed.profile(0xc0392b, [[1.28, d(1.6) + 3.0], [1.92, d(1.6) + 3.0], [1.92, d(1.6) + 3.45], [1.28, d(1.6) + 3.45]], 0.7, 0);
    k.fixed.cyl(MESSING, 0.06, 0.08, 0.5, 1.95, d(1.6) + 3.4, 0.0, { seg: 6, body: false });
    // Sonnendach achtern auf vier Stangen
    const ax = -3.6;
    for (const [dx, s] of [[-1.3, 1], [-1.3, -1], [1.1, 1], [1.1, -1]]) k.fixed.spar(MESSING, [ax + dx, d(ax + dx), s * (h.halfW(ax + dx) - 0.15)], [ax + dx, d(ax + dx) + 1.9, s * (h.halfW(ax + dx) - 0.15)], 0.04, { seg: 4 });
    k.fixed.box(p.canvas, 2.9, 0.08, 2.7, ax, d(ax) + 1.9, 0, { body: false });
    for (const s of [1, -1]) k.fixed.box(0xc0392b, 2.9, 0.18, 0.04, ax, d(ax) + 1.74, s * 1.36, { body: false });
    // Bänke, Glocke, Rettungsringe
    for (const s of [1, -1]) k.fixed.box(0xa5603a, 2.4, 0.35, 0.4, ax, d(ax), s * (h.halfW(ax) - 0.35));
    k.fixed.sphere(MESSING, 0.14, 3.4, d(3.4) + 0.5, 0, { body: false });
    for (const s of [1, -1]) k.fixed.cyl(0xfff8ea, 0.28, 0.28, 0.08, 0.6, d(0.6) + 0.55, s * 1.2, { seg: 10, body: false });
    // Flaggenstock am Bug mit Wimpel
    k.fixed.spar(0xa8744c, [h.bowX - 0.4, d(h.bowX), 0], [h.bowX - 0.3, d(h.bowX) + 1.4, 0], 0.03, { seg: 3 });
    flagge(k, 'flag-bug', h.bowX - 0.3, d(h.bowX) + 1.4, 0, 0.55, 0.3, [0x2e4868, 0xfff8ea]);
    // Über die Toppen geflaggt: vom Bug über den Schornstein zum Sonnendach
    flaggenleine(k.fixed, [[h.bowX - 0.3, d(h.bowX) + 1.35, 0], [1.6, d(1.6) + 4.2, 0], [ax - 1.3, d(ax) + 1.95, 0]], 0.7, 0.32);
    k.fixed.bodyTop = d(0) + 2.2;
  },

  // ------------------------------------------------ Forschungskutter, 13,9 m mit A-Rahmen
  'L5-3'(k, p) {
    const h = hull(k.fixed, { L: 13.9, B: 4.4, fb: 1.35, x0: 0, bow: 'spitz', bowLen: 0.36, stern: 'spiegel', transom: 0.86, sheerBow: 0.75, sheerStern: 0.05, stripeH: 0.32, bottom: 0.55, depth: 0.6 }, p);
    const d = (x) => h.deckY(x);
    // Steuerhaus vorn, zwei Stockwerke
    k.fixed.house(0xfff8ea, p.glass, 3.6, 1.7, 3.3, 2.4, d(2.4), 0, { band: 0.32, at: 0.55 });
    k.fixed.house(0xfff8ea, p.glass, 2.2, 1.0, 2.6, 2.6, d(2.4) + 1.7, 0, { band: 0.5, at: 0.35 });
    k.fixed.box(p.trim, 2.5, 0.1, 2.9, 2.6, d(2.4) + 2.7, 0);
    // Mast mit Radar, Antennen und Kuppel
    latticeMast(k.fixed, p, 2.6, d(2.4) + 2.8, 2.6, 0.6, 0xfff8ea);
    radar(k, p, 2.6, d(2.4) + 5.5, 1.6);
    k.fixed.sphere(0xfff8ea, 0.32, 1.8, d(2.4) + 3.1, 0, { body: false });
    for (const [dz, hh] of [[0.9, 2.2], [-0.9, 1.6], [0.5, 2.8]]) k.fixed.spar(0x9aa8b4, [3.2, d(2.4) + 2.8, dz], [3.2, d(2.4) + 2.8 + hh, dz], 0.025, { seg: 3 });
    // Laborcontainer und Winde auf dem Arbeitsdeck
    k.fixed.box(0xfff8ea, 2.4, 1.3, 2.2, -1.2, d(-1.2), 0.5);
    k.fixed.box(p.trim, 2.4, 0.12, 2.2, -1.2, d(-1.2) + 1.3, 0.5);
    const drum = new THREE.CylinderGeometry(0.42, 0.42, 1.2, 10);
    drum.rotateX(Math.PI / 2);
    drum.translate(-3.4, d(-3.4) + 0.55, -0.9);
    k.fixed.add(0x5c6878, drum);
    // A-Rahmen am Heck in Signalorange mit Messrosette
    const ax = h.sternX + 0.5;
    for (const s of [1, -1]) k.fixed.spar(p.accent, [ax + 0.6, d(ax), s * (h.halfW(ax) - 0.2)], [ax - 0.3, d(ax) + 3.4, s * 1.1], 0.12, { seg: 5 });
    k.fixed.spar(p.accent, [ax - 0.3, d(ax) + 3.4, -1.15], [ax - 0.3, d(ax) + 3.4, 1.15], 0.12, { seg: 5 });
    k.fixed.line([ax - 0.3, d(ax) + 3.4, 0], [ax - 0.3, d(ax) + 1.6, 0]);
    k.fixed.cyl(0x9aa8b4, 0.4, 0.4, 0.9, ax - 0.3, d(ax) + 0.7, 0, { seg: 8, body: false });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      k.fixed.cyl(0x5c6878, 0.07, 0.07, 0.7, ax - 0.3 + Math.cos(a) * 0.3, d(ax) + 0.8, Math.sin(a) * 0.3, { seg: 5, body: false });
    }
    // Reling ums Arbeitsdeck
    k.fixed.rail(0xfff8ea, h.outline(h.sternX + 0.3, 0.6, 0.15, 6), d(-2) + 0.0, 0.9, { posts: 1.6 });
    k.fixed.bodyTop = d(2.4) + 2.8;
  },

  // ------------------------------------------------ Königsyacht, 37,5 m klassische Dampfyacht
  'XL4-1'(k, p) {
    const h = hull(k.fixed, { L: 33, B: 7.2, fb: 2.5, x0: -0.6, bow: 'spitz', bowLen: 0.3, overBow: 3.0, stern: 'rund', sternLen: 0.18, overStern: 2.6, sheerBow: 1.0, sheerStern: 0.45, stripeH: 0.32, bottom: 0.4, depth: 0.7, bootH: 0.45 }, p);
    const d = (x) => h.deckY(x);
    const bx = h.bowX, sx = h.sternX;
    // Bullaugen im Rumpf, goldene Galionsverzierung, kurzer Bugspriet
    windowRow(k.fixed, h, MESSING, sx + 5, bx - 7, 1.25, 0.3, 1.6);
    k.fixed.spar(p.spar, [bx - 1.2, d(bx) + 0.2, 0], [bx + 2.6, d(bx) + 0.9, 0], 0.13);
    k.fixed.box(GOLD, 1.2, 0.5, 0.35, bx - 0.4, d(bx) - 0.7, 0, { body: false });
    // Aufbauten in Creme, zwei Decks, Brücke vorn
    const y1 = d(0);
    k.fixed.house(p.house, p.glass, 17, 2.3, 5.0, -1.5, y1, 0, { band: 0.36, at: 0.42, back: true });
    k.fixed.box(GOLD, 17.2, 0.14, 5.2, -1.5, y1 + 2.3, 0);
    k.fixed.house(p.house, p.glass, 9, 2.0, 4.0, 1.6, y1 + 2.44, 0, { band: 0.42, at: 0.4 });
    k.fixed.box(p.house, 3.2, 1.2, 4.6, 5.0, y1 + 4.44, 0);
    k.fixed.box(p.glass, 0.06, 0.55, 3.8, 6.62, y1 + 4.85, 0, { body: false });
    k.fixed.rail(0xfff8ea, [[-9.8, 2.5], [6.4, 2.5], [6.4, -2.5], [-9.8, -2.5]], y1 + 2.44, 0.9, { closed: true, posts: 2 });
    // Gelber Schornstein mit schwarzem Kopf
    funnel(k, p, -1.2, y1 + 4.44, 4.0, 1.05, 0.95, { band: false, top: 0x2a2f38, color: p.accent, rake: 0.8 });
    // Zwei Masten, Standarte am Großmast, Wimpel vorn
    const fx = 9.5, ax = -10.5, fh = 17, ah = 15;
    mast(k, h, p, fx, fh, { r: 0.2, shroudCount: 2, spread: 0.9 });
    mast(k, h, p, ax, ah, { r: 0.18, shroudCount: 2, spread: 0.9 });
    k.fixed.line([fx, d(fx) + fh, 0], [ax, d(ax) + ah, 0]);
    flagge(k, 'flag-standarte', ax, d(ax) + ah + 0.1, 0, 2.2, 1.5, [0xc0392b, GOLD, 0xc0392b]);
    flagge(k, 'flag-wimpel', fx, d(fx) + fh + 0.1, 0, 2.6, 0.5, [0x2e4868]);
    // Über die Toppen geflaggt
    flaggenleine(k.fixed, [[bx + 2.6, d(bx) + 0.9, 0], [fx, d(fx) + fh, 0], [ax, d(ax) + ah, 0], [sx + 0.6, d(sx) + 1.0, 0]], 1.3, 0.7);
    // Zwei weiße Beiboote in Davits auf dem Bootsdeck
    for (const s of [1, -1]) {
      dinghy(k.fixed, -6.5, y1 + 2.9, s * 2.0, 4.6, p, { color: 0xfff8ea });
      k.fixed.spar(0x9aa8b4, [-8.2, y1 + 2.44, s * 2.4], [-8.2, y1 + 4.0, s * 2.0], 0.06, { seg: 3 });
      k.fixed.spar(0x9aa8b4, [-4.8, y1 + 2.44, s * 2.4], [-4.8, y1 + 4.0, s * 2.0], 0.06, { seg: 3 });
    }
    // Reling achtern
    k.fixed.rail(0xfff8ea, h.outline(sx + 1.0, -10, 0.2, 6), d(sx + 3), 1.0, { posts: 2 });
    k.fixed.bodyTop = y1 + 5.6;
  },
};

const kindOf = (m) => (m.id === 'L5-1' ? 'sail' : 'motor');
const MODELLE = DATEN.map((m) => ({ ...m, palettes: [palette(m)] }));
const API = {
  L: makeBoatApi('L', BUILDERS, kindOf),
  XL: makeBoatApi('XL', BUILDERS, kindOf),
};
const MEINE = new Map(MODELLE.map((m) => [m.id, m]));
const GROESSE = { L5: 'L', XL4: 'XL' };

/** Baut ein Besucher-Modell (id oder Eintrag). Für Tests und das Logbuch auch ohne Spiel. */
export function buildBesucher(model, opts = {}) {
  const m = MEINE.get(typeof model === 'string' ? model : model?.id);
  if (!m) throw new Error(`Unbekanntes Besucher-Modell: ${model?.id ?? model}`);
  return API[GROESSE[m.typeId]].buildBoat(m, opts);
}

export const MODELS = MODELLE;

export function init(game) {
  game.boatTypes ??= {};
  for (const size of ['l', 'xl']) {
    const orig = game.boatTypes[size];
    if (!orig || orig.besucher) continue;
    const S = size.toUpperCase();
    const eigene = MODELLE.filter((m) => GROESSE[m.typeId] === S);
    const api = API[S];
    const istMein = (model) => MEINE.has(typeof model === 'string' ? model : model?.id);
    const neu = {
      ...orig,
      besucher: true,
      MODELS: [...(orig.MODELS || []), ...eigene],
      buildBoat: (model, opts) => (istMein(model) ? buildBesucher(model, opts) : orig.buildBoat(model, opts)),
      setSails: (group, on) => (istMein(group?.userData?.modelId) ? api.setSails(group, on) : orig.setSails?.(group, on)),
      // animateBoat bleibt, wie es war: L hat keins (boat-anim bewegt Schrauben und Rauch selbst), XL nutzt
      // denselben Baukasten wie diese Modelle
    };
    game.boatTypes[size] = neu;
    game.boatTypes[S] = neu;
  }
}
