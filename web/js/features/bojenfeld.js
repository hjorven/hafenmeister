// Bojenfeld (Roadmap P36, F10): billige Muringbojen im See für kleine Boote.
// Beschreibung: docs/bojenfeld.md. Zahlen: ECONOMY.bojenfeld. Plätze: data/bojenfeld.js (BF01 ...),
// Lage im Gelände: render/landschaft/bojenfeld-lage.js.
//
// Im Baumenü (Reiter "Stege") steht ab ECONOMY.bojenfeld.abStufe der nächste Bauabschnitt:
// - "Bojenfeld im See" (6 Bojen), später "Bojenfeld erweitern" (6 Bojen mehr).
// Ein Abschnitt steht nur im Menü, wenn das Gelände für alle seine Bojen Platz hat (sonst gibt es ihn an
// dieser Küste nicht) und der vorige gebaut ist. Der Abschnitt der nächsten Ausbaustufe steht gesperrt da.
//
// Regeln (sim.js, data/rules.js berthKinds.boje): nur Boote der Klassen S und M bis maxLaenge/maxBreite,
// Wünsche am Steg bleiben an der Boje unerfüllt, Liegegeld mal liegegeld, Platz liegt offen (Sturm, Starkwind), und Büro,
// "Einfahren lassen" und Selbst-Einfahren nehmen eine Boje erst, wenn keine Box passt (letzteWahl).
//
// Spielstand: state.buildings['bojenfeld-1'] = 1 (wie Stegprojekte, Rückgängig im Baumenü deckt es ab).
// Schnittstelle: game.bojenfeld = { angebote(), kaufen(id), geist(id), ort(id), bojen() }
// Ereignisse: 'build' { id, level }, 'bojenfeld:fertig' { id, bojen, kosten }.

import * as sim from '../sim.js';
import { ECONOMY } from '../data/economy.js';
import { HAFEN } from '../data/harbor.js';
import { BOJENFELD, bojenLagen } from '../data/bojenfeld.js';
import { regelnBereit } from './regeln-bereit.js';

export const REGELN = ECONOMY.bojenfeld ?? null;

/** Bauabschnitte mit Bojen-ids: [{ id: 'bojenfeld-1', nr: 1, bojen: ['BF01', ...], abStufe, kosten }] */
export function abschnitte() {
  if (!REGELN) return [];
  let k = 0;
  return REGELN.abschnitte.map((a, i) => {
    const bojen = BOJENFELD.ids.slice(k, k + a.bojen);
    k += a.bojen;
    return { id: BOJENFELD.projekte[i], nr: i + 1, bojen, abStufe: a.abStufe ?? REGELN.abStufe ?? 2, kosten: a.kosten };
  });
}

/**
 * Was im Baumenü steht (höchstens ein Abschnitt): der erste noch nicht gebaute, wenn der vorige steht und
 * das Gelände Platz für alle seine Bojen hat. lagen = Anzahl Bojen mit Lage (bojenLagen().length).
 * { id, nr, bojen, kosten, abStufe, gesperrt ('ab Ausbaustufe n' | null), erweitern (true ab Abschnitt 2) }
 */
export function angebote(state, lagen = bojenLagen().length) {
  const out = [];
  for (const a of abschnitte()) {
    if (state.buildings[a.id]) continue;
    const ende = BOJENFELD.ids.indexOf(a.bojen[a.bojen.length - 1]) + 1;
    if (ende > lagen) break;                               // an dieser Küste kein Platz für diesen Abschnitt
    if (state.stage + 1 < a.abStufe) break;                // erst ab der übernächsten Stufe: noch nicht zeigen
    out.push({ ...a, gesperrt: state.stage < a.abStufe ? `ab Ausbaustufe ${a.abStufe}` : null, erweitern: a.nr > 1 });
    break;
  }
  return out;
}

/** Abschnitt bauen. bezahle(kosten) bucht die Ausgabe. { ok, grund?, angebot?, events } */
export function bauen(state, id, lagen = bojenLagen().length, bezahle = (k) => sim.spend(state, k, 'bau')) {
  const a = angebote(state, lagen).find((x) => x.id === id);
  if (!a) return { ok: false, grund: 'unbekannt', events: [] };
  if (a.gesperrt) return { ok: false, grund: 'stufe', events: [] };
  if (state.money < a.kosten || !bezahle(a.kosten)) return { ok: false, grund: 'geld', events: [] };
  state.buildings[a.id] = 1;
  return { ok: true, angebot: a, events: [{ type: 'built', id: a.id, level: 1, cost: a.kosten }] };
}

/** Passregel im Spiel: Bojen ohne Lage im Gelände gibt es nicht (Grund 'boje'). */
export function ohneLage(berth, lagen = bojenLagen().length) {
  return berth?.kind === 'boje' && BOJENFELD.ids.indexOf(berth.id) >= lagen ? 'boje' : null;
}

// ---------------------------------------------------------------------------
// Im Browser

export async function init(game) {
  const schnittstelle = game.bojenfeld = { angebote: () => [], kaufen: () => ({ ok: false }), geist: () => null, ort: () => null, bojen: () => [] };
  const api = await regelnBereit(game);
  const st = () => api.state;
  const ctx = () => api.ctx;
  const THREE = game.THREE;
  const U = HAFEN.einheiten?.meterProEinheit ?? 0.62;

  sim.addHook(ctx(), 'fit', ({ berth }) => ohneLage(berth));

  function kaufen(id) {
    const r = bauen(st(), id, bojenLagen().length, (k) => api.spend(k, 'bau'));
    if (r.ok) {
      game.emit('build', { id, level: 1 });
      game.emit('sim:change', { reason: 'bojenfeld' });
      game.emit('bojenfeld:fertig', { id, bojen: r.angebot.bojen.length, kosten: r.angebot.kosten });
    }
    return { ...r, geldFehlt: r.grund === 'geld' };
  }

  const lageVon = (bid) => {
    const i = BOJENFELD.ids.indexOf(bid);
    const q = bojenLagen()[i];
    return q ? { x: q[0] * U, z: -q[1] * U } : null;
  };

  /** Mitte und Ausdehnung der Bojen eines Abschnitts (für die Kamera im Baumenü). */
  function ort(id) {
    const a = abschnitte().find((x) => x.id === id);
    const pkte = (a?.bojen ?? []).map(lageVon).filter(Boolean);
    if (!pkte.length) return null;
    const xs = pkte.map((p) => p.x), zs = pkte.map((p) => p.z);
    return { x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2,
      breite: Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs), 20) + 12 };
  }

  // Geisterbild: je Boje ein gelber Kreis (Schwoikreis) mit weißem Rand und einer halb durchsichtigen Boje
  const geistMat = THREE ? new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.32, depthWrite: false }) : null;
  const randMat = THREE ? new THREE.LineBasicMaterial({ color: '#ffffff' }) : null;
  const bojeMat = THREE ? new THREE.MeshLambertMaterial({ color: '#f4f1ea', transparent: true, opacity: 0.75 }) : null;
  function geist(id) {
    if (!THREE) return null;
    const a = abschnitte().find((x) => x.id === id);
    const g = new THREE.Group();
    const kreis = new THREE.CircleGeometry(5.5, 28).rotateX(-Math.PI / 2);
    const rand = new THREE.EdgesGeometry(new THREE.RingGeometry(5.45, 5.5, 28).rotateX(-Math.PI / 2));
    const kugel = new THREE.SphereGeometry(0.55, 10, 8);
    for (const bid of a?.bojen ?? []) {
      const p = lageVon(bid);
      if (!p) continue;
      const fl = new THREE.Mesh(kreis, geistMat);
      fl.position.set(p.x, 0.12, p.z);
      fl.renderOrder = 12;
      fl.add(new THREE.LineSegments(rand, randMat));
      const b = new THREE.Mesh(kugel, bojeMat);
      b.position.y = 0.2;
      fl.add(b);
      g.add(fl);
    }
    return g.children.length ? g : null;
  }

  Object.assign(schnittstelle, {
    angebote: () => (st() ? angebote(st()) : []),
    kaufen,
    geist,
    ort,
    abschnitte,
    /** Gebaute Bojen der aktuellen Stufe in Weltmetern: [{ id, x, z }] */
    bojen: () => (st() ? ctx().berths.filter((b) => b.kind === 'boje' && sim.berthAvailable(st(), b)).map((b) => ({ id: b.id, ...lageVon(b.id) })).filter((b) => Number.isFinite(b.x)) : []),
  });

  // Zum Ausprobieren (docs/tests.md): ?bojenfeld=1 oder 2 legt im Testmodus (?stufe=n) so viele Abschnitte
  // gleich an, soweit Stufe und Gelände es erlauben
  const n = Number(new URLSearchParams(globalThis.location?.search ?? '').get('bojenfeld'));
  if (n > 0) {
    const legeAn = () => {
      const s = st();
      if (!s?.testmodus) return;
      let neu = false;
      for (const a of abschnitte().slice(0, n)) {
        const ende = BOJENFELD.ids.indexOf(a.bojen[a.bojen.length - 1]) + 1;
        if (s.buildings[a.id] || s.stage < a.abStufe || ende > bojenLagen().length) continue;
        s.buildings[a.id] = 1;
        neu = true;
      }
      if (neu) { game.emit('build', { id: 'bojenfeld' }); game.emit('sim:change', { reason: 'bojenfeld' }); }
    };
    legeAn();
    game.on('sim:change', (d) => { if (d?.reason === 'load' || d?.reason === 'new') setTimeout(legeAn, 0); });
  }
}

export default init;
