// Stege nachrüsten (Roadmap P30, F8). Beschreibung: docs/nachruesten.md.
//
// Ein Steg, der schon steht, lässt sich im Baumenü (Reiter "Stege") verbessern:
// - Fingerstege: Jede Heckpfahl-Box des Stegs bekommt einen schmalen Laufsteg an der Seite. Gäste
//   steigen bequem aus und bewerten so viel besser wie an einem Schwimmsteg mit Fingern (Platzart finger).
// - Steglaternen: Laternen entlang des Stegs, nachts leuchten sie. Gäste an diesem Steg bewerten besser.
// Strom gibt es weiter über die Versorgung (bauwerke.strom, Stromsäulen an Steg B). Die Säulen stehen jetzt
// sichtbar am Steg, an jedem Steg mit Strom. Steg A hat nur kleine Boote, die keinen Strom wünschen, darum
// keine Säulen dort. Wasser am Steg kommt mit dem Wunsch Frischwasser (P31), sonst täte es nichts.
//
// Die Logik (alles außer init) läuft ohne Browser und ist in tests/nachruesten.test.mjs getestet.
// Spielstand: state.modules.nachruesten = { finger: ['A', ...], licht: ['A', ...] }
// Zahlen: ECONOMY.nachruesten (data/economy.js). Wirkung über den Hook 'rating' der Spielregeln.
// Schnittstelle: game.nachruesten = { angebote(), kaufen(art, steg), hat(art, steg), geist(art, stege),
//   platzTeile(platzId) }
// Ereignisse: nachruesten:gebaut { art, steg, kosten }, nachruesten:neu (nach Laden oder Rückgängig)

import * as sim from '../sim.js';
import { ECONOMY } from '../data/economy.js';
import { HAFEN } from '../data/harbor.js';
import { regelnBereit } from './regeln-bereit.js';

export const ARTEN = ECONOMY.nachruesten ?? {};

export function nachruestState(state) {
  state.modules ||= {};
  const n = (state.modules.nachruesten ||= {});
  for (const art of Object.keys(ARTEN)) if (!Array.isArray(n[art])) n[art] = [];
  return n;
}

export function stegName(id) {
  return HAFEN.stege?.[id] ?? `Steg ${id}`;
}

/** Hat der Steg diese Nachrüstung? */
export function hat(state, art, steg) {
  return !!state?.modules?.nachruesten?.[art]?.includes(steg);
}

/** Gastplätze eines Stegs in der aktuellen Stufe, die eine Nachrüstung betrifft. */
export function betroffenePlaetze(state, ctx, art, steg) {
  const def = ARTEN[art];
  if (!def) return [];
  return ctx.berths.filter((b) => b.jetty === steg && !b.reserved && sim.berthAvailable(state, b)
    && (!def.nurArt || b.kind === def.nurArt));
}

/** Preis: grund + jePlatz je Größenklasse für jeden betroffenen Platz, auf 10 € gerundet. */
export function preis(def, plaetze) {
  const summe = (def.grund ?? 0) + plaetze.reduce((s, b) => s + (def.jePlatz?.[b.size] ?? 0), 0);
  return Math.round(summe / 10) * 10;
}

/**
 * Was sich gerade nachrüsten lässt: je Art und Steg ein Angebot, auch für die nächste Stufe (gesperrt).
 * { art, steg, name, kosten, plaetze: [ids], anker, gesperrt: null | 'ab Ausbaustufe n' }
 */
export function angebote(state, ctx) {
  const out = [];
  const stege = [...new Set(ctx.berths.map((b) => b.jetty).filter(Boolean))];
  for (const [art, def] of Object.entries(ARTEN)) {
    if (state.stage + 1 < (def.abStufe ?? 1)) continue;
    for (const steg of stege) {
      if (hat(state, art, steg)) continue;
      const plaetze = betroffenePlaetze(state, ctx, art, steg);
      if (!plaetze.length) continue;
      out.push({
        art, steg, name: `${def.name} an ${stegName(steg)}`, kosten: preis(def, plaetze),
        plaetze: plaetze.map((b) => b.id), anker: def.anker ?? 0,
        gesperrt: state.stage < (def.abStufe ?? 1) ? `ab Ausbaustufe ${def.abStufe}` : null,
      });
    }
  }
  return out;
}

/**
 * Nachrüsten. bezahle(kosten) bucht die Ausgabe (Browser: game.sim.spend(kosten, 'bau')).
 * Gibt { ok, grund?, angebot? } zurück: grund 'unbekannt', 'schon', 'stufe', 'geld'.
 */
export function kaufen(state, ctx, art, steg, bezahle = (k) => sim.spend(state, k, 'bau')) {
  if (hat(state, art, steg)) return { ok: false, grund: 'schon' };
  const a = angebote(state, ctx).find((x) => x.art === art && x.steg === steg);
  if (!a) return { ok: false, grund: 'unbekannt' };
  if (a.gesperrt) return { ok: false, grund: 'stufe' };
  if (state.money < a.kosten || !bezahle(a.kosten)) return { ok: false, grund: 'geld' };
  nachruestState(state)[art].push(steg);
  return { ok: true, angebot: a };
}

/** Nachrüstungen, die für diesen Platz wirken (Arten). */
export function platzArten(state, berth) {
  if (!berth?.jetty) return [];
  return Object.entries(ARTEN).filter(([art, def]) => hat(state, art, berth.jetty) && (!def.nurArt || berth.kind === def.nurArt)).map(([art]) => art);
}

/** Anker, die ein Gast an einem nachgerüsteten Steg mehr gibt (Hook 'rating'). */
export function ankerBonus(state, ctx, boat) {
  const berth = ctx.berthById[boat?.berthId];
  return platzArten(state, berth).reduce((s, art) => s + (ARTEN[art].anker ?? 0), 0);
}

/** Hooks in einen Regel-Kontext hängen (Browser über game.sim.addHook, Tests über sim.addHook). */
export function haengeEin(addHook, getState) {
  const ab = [addHook('rating', ({ ctx, boat }) => { const s = getState(); return s ? ankerBonus(s, ctx, boat) : 0; })];
  return () => ab.forEach((f) => f());
}

// ---------------------------------------------------------------------------
// Im Browser: Finger, Laternen und Stromsäulen am Steg, Geisterbild für die Vorschau

const FARBE = { finger: '#e3e0d8', fingerRand: '#b9b4a8', pfahl: '#4f4852', mast: '#2f3a44', glas: '#fff1c2', saeule: '#f2f0ea', strom: '#3d7fd9' };
const TEXT = { finger: 'Fingersteg', licht: 'Licht' };

export async function init(game) {
  const schnittstelle = game.nachruesten = {
    angebote: () => [], kaufen: () => ({ ok: false }), hat: () => false, geist: () => null, platzTeile: () => [],
  };
  const api = await regelnBereit(game);
  const st = () => api.state;
  const ctx = () => api.ctx;
  haengeEin(api.addHook, st);
  const THREE = game.THREE;
  if (!THREE || !game.scene) return;
  const { mergeGeometries } = await import('three/addons/utils/BufferGeometryUtils.js');

  const mat = (c, extra = {}) => new THREE.MeshLambertMaterial({ color: c, flatShading: true, ...extra });
  const M = {
    finger: mat(FARBE.finger), fingerRand: mat(FARBE.fingerRand), pfahl: mat(FARBE.pfahl), mast: mat(FARBE.mast),
    glas: mat(FARBE.glas, { emissive: new THREE.Color('#ffc65a'), emissiveIntensity: 0.15 }),
    saeule: mat(FARBE.saeule), strom: mat(FARBE.strom),
  };
  const schein = new THREE.MeshBasicMaterial({ color: '#ffd77a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const geistMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false });

  const root = new THREE.Group();
  root.name = 'nachruesten';
  game.scene.add(root);

  // Teile je Platz: Liste { geo, mat } in Weltkoordinaten (für Zusammenlegen und Geisterbild)
  function lage(id) {
    const p = game.stege?.platz?.(id);
    if (!p) return null;
    const rad = THREE.MathUtils.degToRad(p.richtung);
    const bug = new THREE.Vector3(Math.cos(rad), 0, -Math.sin(rad));   // zeigt zum Steg
    const seite = new THREE.Vector3(-bug.z, 0, bug.x);
    return { p, rad, bug, seite, c: new THREE.Vector3(p.x, 0, p.z) };
  }
  function teil(geo, m, pos, dreh = 0) {
    const g = geo.clone();
    if (dreh) g.rotateY(dreh);
    g.translate(pos.x, pos.y, pos.z);
    return { geo: g, mat: m };
  }
  const deck = () => game.stege?.deckHoehe?.('holz') ?? 0.86;

  // Fingersteg an der Seite einer Box: vom Steg aus 60 % der Boxlänge, mit Pfahl am Ende
  function fingerTeile(id) {
    const l = lage(id);
    if (!l) return [];
    const { p, rad, bug, seite, c } = l;
    const fl = p.laenge * 0.6;
    const mitte = c.clone().addScaledVector(bug, p.laenge / 2 - fl / 2).addScaledVector(seite, p.breite * 0.5);
    const out = [
      teil(new THREE.BoxGeometry(fl, 0.12, 0.6), M.finger, mitte.clone().setY(0.62), rad),
      teil(new THREE.BoxGeometry(fl, 0.14, 0.66), M.fingerRand, mitte.clone().setY(0.5), rad),
    ];
    const ende = c.clone().addScaledVector(bug, p.laenge / 2 - fl).addScaledVector(seite, p.breite * 0.5);
    out.push(teil(new THREE.CylinderGeometry(0.13, 0.13, 2.4, 6), M.pfahl, ende.setY(0.2)));
    return out;
  }
  // Laterne auf dem Steg am Kopf des Platzes
  function lichtTeile(id, mitSchein = true) {
    const l = lage(id);
    if (!l) return [];
    const { p, bug, seite, c } = l;
    const fuss = c.clone().addScaledVector(bug, p.laenge / 2 + 0.45).addScaledVector(seite, p.breite * 0.5);
    const d = deck();
    const out = [
      teil(new THREE.CylinderGeometry(0.05, 0.07, 1.5, 6), M.mast, fuss.clone().setY(d + 0.75)),
      teil(new THREE.BoxGeometry(0.26, 0.3, 0.26), M.glas, fuss.clone().setY(d + 1.62)),
      teil(new THREE.ConeGeometry(0.24, 0.16, 4).rotateY(Math.PI / 4), M.mast, fuss.clone().setY(d + 1.85)),
    ];
    if (mitSchein) out.push(teil(new THREE.CircleGeometry(1.6, 16).rotateX(-Math.PI / 2), schein, fuss.clone().setY(d + 0.05)));
    return out;
  }
  // Stromsäule auf dem Steg zwischen zwei Plätzen
  function stromTeile(id) {
    const l = lage(id);
    if (!l) return [];
    const { p, rad, bug, seite, c } = l;
    const fuss = c.clone().addScaledVector(bug, p.laenge / 2 + 0.4).addScaledVector(seite, -p.breite * 0.5);
    const d = deck();
    return [
      teil(new THREE.BoxGeometry(0.28, 0.75, 0.22), M.saeule, fuss.clone().setY(d + 0.37), rad),
      teil(new THREE.BoxGeometry(0.3, 0.12, 0.24), M.strom, fuss.clone().setY(d + 0.8), rad),
    ];
  }

  // Plätze eines Stegs in Reihenfolge der ids; Laternen und Säulen an jedem zweiten
  const jedeZweite = (ids) => [...ids].sort().filter((_, i) => i % 2 === 0);
  function teileFuer(art, ids, mitSchein = true) {
    if (art === 'finger') return ids.flatMap(fingerTeile);
    if (art === 'licht') return jedeZweite(ids).flatMap((id) => lichtTeile(id, mitSchein));
    if (art === 'strom') return jedeZweite(ids).flatMap(stromTeile);
    return [];
  }
  function gastPlaetze(steg, filter = () => true) {
    const s = st(), c = ctx();
    if (!s || !c) return [];
    return c.berths.filter((b) => b.jetty === steg && !b.reserved && sim.berthAvailable(s, b) && filter(b)).map((b) => b.id);
  }
  // Steg-Teil eines Platzes, der Strom hat (an Haus-Stegen von Anfang an, an B über die Stromsäulen)
  const stromStege = () => {
    const s = st(), c = ctx();
    const out = new Set();
    for (const b of c.berths) if (b.jetty && !b.reserved && b.kind !== 'kai' && sim.berthAvailable(s, b) && sim.berthHas(s, c, b, 'power')) out.add(b.jetty);
    return [...out];
  };

  let gruppe = null;
  let sig = '';
  function aufbauen(erzwingen = false) {
    const s = st();
    if (!s || !game.stege?.platz) return;
    const n = nachruestState(s);
    const strom = stromStege();
    const neu = [s.stage, game.stege.stage, JSON.stringify(n), strom.join(','), Object.keys(s.buildings).filter((k) => s.buildings[k]).sort().join(',')].join('|');
    if (!erzwingen && neu === sig && gruppe) return;
    sig = neu;
    if (gruppe) { root.remove(gruppe); gruppe.traverse((o) => o.geometry?.dispose()); }
    gruppe = new THREE.Group();
    const teile = [];
    for (const steg of n.finger ?? []) teile.push(...teileFuer('finger', gastPlaetze(steg, (b) => b.kind === (ARTEN.finger?.nurArt ?? 'box'))));
    for (const steg of n.licht ?? []) teile.push(...teileFuer('licht', gastPlaetze(steg)));
    for (const steg of strom) teile.push(...teileFuer('strom', gastPlaetze(steg, (b) => sim.berthHas(s, ctx(), b, 'power'))));
    // Je Material ein Mesh: hunderte Einzelteile kosten sonst Bildzeit
    const jeMat = new Map();
    for (const t of teile) { if (!jeMat.has(t.mat)) jeMat.set(t.mat, []); jeMat.get(t.mat).push(t.geo); }
    for (const [m, geos] of jeMat) {
      const g = mergeGeometries(geos.map((x) => x.index ? x.toNonIndexed() : x), false);
      geos.forEach((x) => x.dispose());
      if (!g) continue;
      const mesh = new THREE.Mesh(g, m);
      if (m === schein) { mesh.renderOrder = 4; mesh.castShadow = false; } else { mesh.castShadow = true; }
      gruppe.add(mesh);
    }
    root.add(gruppe);
    licht();
  }

  // Nachts leuchten die Laternen (zustand.nacht 0..1 aus der Landschaft)
  let nacht = 0;
  function licht(z) {
    if (z && Number.isFinite(z.nacht)) nacht = z.nacht;
    else nacht = (game.landschaft ?? game.landscape)?.licht?.zustand?.nacht ?? nacht;
    M.glas.emissiveIntensity = 0.15 + 1.6 * nacht;
    schein.opacity = 0.32 * nacht;
  }

  // Geisterbild für die Vorschau im Baumenü (ui/bauen.js): art 'finger', 'licht' oder 'strom'
  function geist(art, stege) {
    const liste = Array.isArray(stege) ? stege : [stege];
    const g = new THREE.Group();
    g.name = 'nachruesten-geist';
    const filter = art === 'finger' ? (b) => b.kind === (ARTEN.finger?.nurArt ?? 'box') : () => true;
    for (const steg of liste) {
      for (const t of teileFuer(art, gastPlaetze(steg, filter), false)) {
        const m = new THREE.Mesh(t.geo, geistMat);
        m.renderOrder = 12;
        g.add(m);
      }
    }
    return g.children.length ? g : null;
  }

  Object.assign(schnittstelle, {
    angebote: () => (st() ? angebote(st(), ctx()) : []),
    hat: (art, steg) => hat(st(), art, steg),
    kaufen(art, steg) {
      const r = kaufen(st(), ctx(), art, steg, (k) => api.spend(k, 'bau'));
      if (r.ok) {
        aufbauen(true);
        game.emit('nachruesten:gebaut', { art, steg, kosten: r.angebot.kosten });
      }
      return { ...r, geldFehlt: r.grund === 'geld' };
    },
    geist,
    platzTeile(platzId) {
      const b = ctx()?.berthById?.[platzId];
      return b ? platzArten(st(), b).map((a) => TEXT[a]).filter(Boolean) : [];
    },
    neuZeichnen: () => aufbauen(true),
  });

  game.on('stege', () => aufbauen(true));
  game.on('build', () => aufbauen());
  game.on('sim:change', () => aufbauen());
  game.on('nachruesten:neu', () => aufbauen(true));
  game.on('spielstand-geladen', () => aufbauen(true));
  game.on('licht', licht);
  aufbauen(true);
}

export default init;
