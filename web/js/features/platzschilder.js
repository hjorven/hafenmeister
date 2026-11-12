// Grün-Rot-Schilder an den Gastboxen, wie in echten Häfen an Ost- und Nordsee.
// Grün: Platz ist frei, ein Gast darf festmachen (auch ein Dauerplatz, dessen Boot auf mehrtägigem Törn ist).
// Rot: belegt, ein Boot ist auf dem Weg dorthin, fest vergeben, oder das Dauerboot ist nur auf Tagesausflug.
//
// Schilder gibt es nur an Plätzen, die es in der Stufe gibt und die gekauft sind (sim.availableBerths),
// und nur an Boxen (Platzart box und finger), nicht an Kai, Stirn, Fischer- oder Großschiffplätzen.
// Die Tafel dreht sich mit der Kamera, damit man sie auch beim Drehen des Hafens sieht.
//
// Lesen: game.platzschilder.farbe(platzId) -> 'gruen' | 'rot' | null

import * as sim from '../sim.js';
import { regelnBereit } from './regeln-bereit.js';

export const BOX_ARTEN = new Set(['box', 'finger']);

/**
 * Farbe eines Platzes nach den Regeln: 'gruen', 'rot', oder null (kein Schild).
 * Zustand aus sim.berthState ('frei' | 'belegt' | 'ausflug' | 'reserviert' | 'aus'), im Spiel game.sim.platzZustand.
 */
export function farbe(state, ctx, berth) {
  if (!berth || !BOX_ARTEN.has(berth.kind)) return null;
  const z = sim.berthState(state, ctx, berth.id);
  if (z === 'aus') return null;
  return z === 'frei' ? 'gruen' : 'rot';
}

/**
 * Kopf der Box: das Ende, das am Steg liegt (Planeinheiten). Von den beiden Enden der Box in
 * Längsrichtung nimmt es das, das näher an der Mittellinie des eigenen Stegs liegt, und rückt
 * ein kleines Stück zum Steg hin, damit das Schild auf der Stegkante steht.
 */
export function kopfDerBox(platz, stege, stufe) {
  const l = platz.lage?.[String(stufe)];
  if (!l) return null;
  const r = (l[2] * Math.PI) / 180;
  const dx = Math.cos(r), dy = Math.sin(r);
  const halb = platz.laenge / 2;
  const enden = [
    { x: l[0] + dx * halb, y: l[1] + dy * halb, s: -1 },
    { x: l[0] - dx * halb, y: l[1] - dy * halb, s: 1 },
  ];
  const eigene = stege.filter((st) => st.steg === platz.steg);
  const linien = eigene.length ? eigene : stege;
  if (!linien.length) return null;
  const abstand = (p) => Math.min(...linien.map((st) => abstandZuLinie(p, st.punkte)));
  const kopf = abstand(enden[0]) <= abstand(enden[1]) ? enden[0] : enden[1];
  const rein = -0.5;   // ein Stück über das Boxende hinaus, auf die Stegkante
  return { x: kopf.x + kopf.s * dx * rein, y: kopf.y + kopf.s * dy * rein };
}

function abstandZuLinie(p, punkte) {
  let best = Infinity;
  for (let i = 0; i + 1 < punkte.length; i++) {
    const [ax, ay] = punkte[i], [bx, by] = punkte[i + 1];
    const vx = bx - ax, vy = by - ay;
    const t = Math.max(0, Math.min(1, ((p.x - ax) * vx + (p.y - ay) * vy) / (vx * vx + vy * vy || 1)));
    best = Math.min(best, Math.hypot(p.x - (ax + t * vx), p.y - (ay + t * vy)));
  }
  return best;
}

const GRUEN = '#2fb24c';
const ROT = '#e0453a';

export async function init(game) {
  const api = await regelnBereit(game);
  const THREE = game.THREE;
  const { HAFEN, inWelt } = await import('../data/harbor.js');
  const platzDaten = Object.fromEntries(HAFEN.plaetze.map((p) => [p.id, p]));

  const gruppe = new THREE.Group();
  gruppe.name = 'platzschilder';
  game.scene.add(gruppe);

  const pfahlGeo = new THREE.CylinderGeometry(0.07, 0.07, 1.5, 6);
  const tafelGeo = new THREE.BoxGeometry(1.1, 0.8, 0.06);
  const pfahlMat = new THREE.MeshLambertMaterial({ color: '#eee8dc' });
  // Unbeleuchtet, damit die Farbe auch abends und bei Regen klar bleibt
  const mats = { gruen: new THREE.MeshBasicMaterial({ color: GRUEN }), rot: new THREE.MeshBasicMaterial({ color: ROT }) };
  const schilder = new Map();
  let stufe = null;

  function baue(berth) {
    const daten = platzDaten[berth.id];
    const stufe = api.state.stage;
    const ende = daten && kopfDerBox(daten, HAFEN.stufen?.[String(stufe)]?.stege || [], stufe);
    if (!ende) return null;
    const w = inWelt(ende.x, ende.y);
    const s = new THREE.Group();
    const pfahl = new THREE.Mesh(pfahlGeo, pfahlMat);
    pfahl.position.y = 0.75;
    const tafel = new THREE.Mesh(tafelGeo, mats.rot);
    tafel.position.y = 1.7;
    s.add(pfahl, tafel);
    s.userData.tafel = tafel;
    s.userData.pick = { type: 'berth', id: berth.id };
    s.position.set(w.x, 0, w.z);
    s.rotation.y = game.camera?.yaw ?? 0;
    gruppe.add(s);
    return s;
  }

  function alleWeg() {
    for (const s of schilder.values()) gruppe.remove(s);
    schilder.clear();
  }

  function zeichne() {
    const st = api.state;
    if (!st) return;
    if (stufe !== st.stage) { alleWeg(); stufe = st.stage; }
    const da = new Set();
    for (const berth of api.ctx.berths) {
      const f = farbe(st, api.ctx, berth);
      if (!f) continue;
      da.add(berth.id);
      let s = schilder.get(berth.id);
      if (!s) { s = baue(berth); if (!s) continue; schilder.set(berth.id, s); }
      s.userData.tafel.material = mats[f];
      s.userData.farbe = f;
    }
    for (const [id, s] of schilder) if (!da.has(id)) { gruppe.remove(s); schilder.delete(id); }
  }

  game.on('sim:berthState', zeichne);
  game.on('sim:change', zeichne);
  game.on('stufe', zeichne);
  game.on('spielstand-geladen', () => { alleWeg(); stufe = null; zeichne(); });

  // Tafeln zur Kamera drehen
  let letzteYaw = null;
  game.onTick(() => {
    const yaw = game.camera?.yaw ?? 0;
    if (yaw === letzteYaw) return;
    letzteYaw = yaw;
    for (const s of schilder.values()) s.rotation.y = yaw;
  });

  zeichne();
  game.platzschilder = {
    gruppe,
    farbe: (id) => schilder.get(id)?.userData.farbe ?? null,
  };
}
