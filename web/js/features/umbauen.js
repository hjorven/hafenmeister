// Stege umbauen (Roadmap P59, D5 und D6): zwei Boxen zu einer Doppelbox zusammenlegen und zurück.
// Beschreibung: docs/stege-umbauen.md. Die möglichen Paare legt data/doppelboxen.js an.
//
// Im Baumenü (Reiter "Stege") steht je Steg mit Doppelbox-Paaren:
// - "Doppelbox an <Steg>": das nächste Paar freier Boxen wird eine breite Box. Darin finden Boote Platz,
//   die in keine einzelne Box passen (Mehrrumpfboote). Dafür fällt eine Box weg.
// - "Doppelbox an <Steg> zurückbauen": eine freie Doppelbox wird wieder zu zwei Boxen.
// Umgebaut wird nur, wenn die betroffenen Boxen frei sind (niemand liegt dort, legt gerade ab, hat sie
// reserviert oder fest gepachtet). So muss kein Boot umziehen.
//
// Spielstand: state.buildings['doppel:C01-02'] = 1 (wie Stegprojekte; Rückgängig im Baumenü deckt es mit ab).
// Die Logik (alles außer init) läuft ohne Browser und ist in tests/umbauen.test.mjs getestet.
// Schnittstelle: game.umbauen = { angebote(), umbauen(steg), rueckbauen(steg), geist(ids) }
// Ereignisse: umbauen:fertig { art: 'umbau'|'rueckbau', steg, platz, kosten }, dazu 'build' für die Stege.

import * as sim from '../sim.js';
import { ECONOMY } from '../data/economy.js';
import { HAFEN } from '../data/harbor.js';
import { regelnBereit } from './regeln-bereit.js';

export const REGELN = ECONOMY.doppelbox ?? null;

export const stegName = (id) => HAFEN.stege?.[id] ?? `Steg ${id}`;
const frei = (state, ctx, id) => sim.berthState(state, ctx, id) === 'frei';
// Zum Umbauen frei: Ein Dauerplatz ist es nie, auch wenn sein Boot gerade auf Törn oder im Winterlager ist
// (dann meldet berthState 'frei', weil Gäste dort kurz liegen dürfen; das Boot kommt aber an diese Box zurück).
const umbaubar = (state, ctx, id) => frei(state, ctx, id) && !state.modules?.dauer?.plaetze?.[id];
const inStufe = (state, b) => (b.stages ? b.stages.includes(state.stage) : b.stage <= state.stage);

/** Doppelboxen der aktuellen Stufe, deren Einzelboxen es gibt: [{ platz, teile: [a, b], gebaut }] */
export function paare(state, ctx) {
  const out = [];
  for (const d of ctx.berths) {
    if (!d.doppel || !inStufe(state, d)) continue;
    const teile = d.doppel.map((id) => ctx.berthById[id]);
    if (teile.some((t) => !t)) continue;
    const gebaut = !!state.buildings[d.requires];
    // Die Einzelboxen müssen gebaut sein (Stegprojekt), sonst gibt es nichts umzubauen
    if (!gebaut && !teile.every((t) => sim.berthAvailable(state, t))) continue;
    out.push({ platz: d, teile, gebaut });
  }
  return out;
}

/** Bootsarten, die in die Doppelbox passen, aber in keine der Einzelboxen (für den Nutzen-Text). */
export function neuePassende(state, ctx, d) {
  const teile = d.doppel.map((id) => ctx.berthById[id]);
  const typen = Object.values(ctx.typeById ?? {});
  return typen.filter((t) => {
    if ((t.minStage ?? 1) > Math.max(state.stage, REGELN?.abStufe ?? 1)) return false;
    const gross = { length: t.length?.[0] ?? 0, beam: t.beam?.[1] ?? 0, draft: t.draft?.[0] ?? 0, size: t.size };
    return sim.fits(gross, d, ctx.rules, state.stage) && !teile.some((b) => sim.fits(gross, b, ctx.rules, state.stage));
  });
}

/**
 * Was gerade sinnvoll ist, je Steg höchstens ein Umbau und ein Rückbau:
 * { art: 'umbau'|'rueckbau', steg, platz (Doppelbox-id), teile: [ids], kosten, gesperrt, gebaut, moeglich }
 * gesperrt: 'ab Ausbaustufe n', 'alle Boxen belegt' oder null.
 * Damit das Baumenü nicht dauerhaft zwei Einträge je Steg zeigt (Zusammenspiel K5):
 * - Umbau nur, solange an diesem Steg keine Doppelbox frei ist (eine freie reicht für den nächsten Katamaran).
 * - Rückbau nur, wenn eine Doppelbox frei ist und zugleich alle schmalen Boxen des Stegs belegt sind
 *   (dann fehlen gerade schmale Boxen).
 */
export function angebote(state, ctx) {
  if (!REGELN) return [];
  const je = {};
  for (const p of paare(state, ctx)) (je[p.platz.jetty] ||= []).push(p);
  const klassen = REGELN.klassen ?? ['L'];
  const out = [];
  for (const [steg, liste] of Object.entries(je)) {
    const gebaut = liste.filter((p) => p.gebaut);
    const offen = liste.filter((p) => !p.gebaut);
    const stufe = state.stage < REGELN.abStufe ? `ab Ausbaustufe ${REGELN.abStufe}` : null;
    if (state.stage + 1 < REGELN.abStufe) continue;
    const freieDoppel = gebaut.filter((p) => frei(state, ctx, p.platz.id));
    const rueckbaubar = freieDoppel.filter((p) => umbaubar(state, ctx, p.platz.id));
    if (offen.length && !freieDoppel.length) {
      // Von außen nach innen: das letzte Paar zuerst, das erste mit zwei freien Boxen
      const wahl = [...offen].reverse().find((p) => p.teile.every((t) => umbaubar(state, ctx, t.id)));
      const p = wahl ?? offen[offen.length - 1];
      out.push({ art: 'umbau', steg, platz: p.platz.id, teile: p.teile.map((t) => t.id), kosten: REGELN.kosten,
        gesperrt: stufe ?? (wahl ? null : 'alle Boxen belegt'), gebaut: gebaut.length, moeglich: liste.length });
    }
    const schmalFrei = ctx.berths.some((b) => b.jetty === steg && b.kind === 'box' && !b.doppel && klassen.includes(b.size)
      && sim.berthAvailable(state, b) && frei(state, ctx, b.id));
    if (rueckbaubar.length && !schmalFrei) {
      const p = rueckbaubar[0];
      out.push({ art: 'rueckbau', steg, platz: p.platz.id, teile: p.teile.map((t) => t.id), kosten: REGELN.rueckbau,
        gesperrt: null, gebaut: gebaut.length, moeglich: liste.length });
    }
  }
  return out;
}

/**
 * Umbau oder Rückbau an einem Steg. bezahle(kosten) bucht die Ausgabe.
 * Gibt { ok, grund?, angebot?, events } zurück: grund 'unbekannt', 'stufe', 'belegt', 'geld'.
 */
export function bauen(state, ctx, art, steg, bezahle = (k) => sim.spend(state, k, 'bau')) {
  const a = angebote(state, ctx).find((x) => x.art === art && x.steg === steg);
  if (!a) return { ok: false, grund: 'unbekannt', events: [] };
  if (a.gesperrt) return { ok: false, grund: a.gesperrt.startsWith('ab ') ? 'stufe' : 'belegt', events: [] };
  if (state.money < a.kosten || !bezahle(a.kosten)) return { ok: false, grund: 'geld', events: [] };
  const key = ctx.berthById[a.platz].requires;
  if (art === 'umbau') state.buildings[key] = 1;
  else delete state.buildings[key];
  return { ok: true, angebot: a, events: [{ type: 'built', id: key, level: art === 'umbau' ? 1 : 0, cost: a.kosten }] };
}

// ---------------------------------------------------------------------------
// Im Browser

export async function init(game) {
  const schnittstelle = game.umbauen = { angebote: () => [], umbauen: () => ({ ok: false }), rueckbauen: () => ({ ok: false }), geist: () => null, neuePassende: () => [] };
  const api = await regelnBereit(game);
  const st = () => api.state;
  const ctx = () => api.ctx;
  const THREE = game.THREE;

  function machen(art, steg) {
    const r = bauen(st(), ctx(), art, steg, (k) => api.spend(k, 'bau'));
    if (r.ok) {
      game.emit('build', { id: ctx().berthById[r.angebot.platz].requires, level: art === 'umbau' ? 1 : 0 });
      game.emit('sim:change', { reason: 'umbauen' });
      game.emit('umbauen:fertig', { art, steg, platz: r.angebot.platz, kosten: r.angebot.kosten });
    }
    return { ...r, geldFehlt: r.grund === 'geld' };
  }

  // Geisterbild: Umriss der breiten Box (Umbau) oder der zwei Boxen (Rückbau) auf dem Wasser
  const geistMat = THREE ? new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.35, depthWrite: false }) : null;
  const randMat = THREE ? new THREE.LineBasicMaterial({ color: '#ffffff' }) : null;
  function geist(ids) {
    if (!THREE) return null;
    const g = new THREE.Group();
    const U = HAFEN.einheiten?.meterProEinheit ?? 0.62;
    for (const id of ids) {
      const p = HAFEN.plaetze.find((q) => q.id === id);
      const l = p?.lage?.[String(st().stage)];
      if (!l) continue;
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(p.laenge * U * 0.94, p.breite * U * 0.9), geistMat);
      fl.rotation.x = -Math.PI / 2;
      fl.rotation.z = (l[2] * Math.PI) / 180;
      fl.position.set(l[0] * U, 0.12, -l[1] * U);
      fl.renderOrder = 12;
      fl.add(new THREE.LineSegments(new THREE.EdgesGeometry(fl.geometry), randMat));
      g.add(fl);
    }
    return g.children.length ? g : null;
  }

  Object.assign(schnittstelle, {
    angebote: () => (st() ? angebote(st(), ctx()) : []),
    umbauen: (steg) => machen('umbau', steg),
    rueckbauen: (steg) => machen('rueckbau', steg),
    geist,
    neuePassende: (platzId) => (st() && ctx().berthById[platzId] ? neuePassende(st(), ctx(), ctx().berthById[platzId]) : []),
  });
}

export default init;
