// Päckchen liegen (P27, F1): Lage, Prüfung und Zeichen für Boote, die längsseits an einem anderen
// Boot liegen. Die Spielregeln stehen in sim.js (raftTargets, raftWhyNot); dieses Modul liefert:
//
//   game.paeckchen.berth(platzId, info)   Liegeplatz außen ('B27+') für boat-anim: parallel zum Boot
//                                         innen, auf der Seite vom Steg weg, mit Fenderabstand
//   game.paeckchen.passt(innen, boot)     false, wenn das Boot außen Steg, Land, ein anderes Boot oder
//                                         das freie Fahrwasser daneben berühren würde (sim ctx.raftFits)
//   game.paeckchen.blockiert(bootId)      liegt außen an diesem Boot noch ein anderes (boat-view wartet)
//   game.paeckchen.lage(platzId, bootId)  Mitte und Maße des Platzes außen für die Ringe beim Ziehen
//
// Sichtbar: Das Boot innen hängt Fender auch zur Außenseite aus, sobald eines kommt (fenderBeide), das
// äußere legt Vor-, Achterleine und Springs zum Deck des inneren (boat-anim makeLines, Platzart
// 'paeckchen' mit Deckhöhe des inneren Boots).

// Luft zwischen den Rümpfen: dieselbe wie zwischen Rumpf und Stegkante (boat-anim makeLines)
const luft = (B) => Math.max(0.6, B * 0.15);
// Freies Wasser neben dem äußeren Boot, damit andere noch vorbeifahren (mindestens 6 m, sonst zwei
// Breiten des Boots) und Abstand zu anderen Rümpfen
const GASSE = (B) => Math.max(6, 2 * B);
const RUMPF_ABSTAND = 0.5;

export function init(game) {
  const sim = () => game.sim;

  // Boot innen: Platz aus der Ansicht, Lage des Rumpfs (liegt es schon, dort, sonst Platzmitte)
  function innen(innerId) {
    const b = game.boatView?.platzBerth?.(innerId);
    if (!b) return null;
    const st = sim()?.state;
    const bootId = st?.berths?.[innerId];
    const boat = bootId != null ? st?.boats?.[bootId] : null;
    const anim = bootId != null ? game.boatView?.boot?.(bootId) : null;
    let x = b.x, z = b.z;
    if (anim && anim.berth?.id === innerId && (anim.moored || anim.state === 'docking')) {
      const f = anim.finalPose?.(anim.berth);
      if (f) { x = f.x; z = f.z; }
    }
    return {
      b, x, z, anim, bootId,
      B: anim?.info?.beam ?? boat?.beam ?? 3,
      L: anim?.info?.length ?? boat?.length ?? 8,
      deck: anim?.info?.freeboard ?? null,
    };
  }

  // Lage des äußeren Boots (Länge L, Breite B) am Boot innen
  function aussen(i, L, B) {
    const h = i.b.heading ?? 0;
    const px = Math.sin(h), pz = Math.cos(h);           // Steuerbord
    const raus = -(i.b.side || 1);                       // vom Steg weg
    const d = i.B / 2 + luft(B) + B / 2;
    return { x: i.x + px * raus * d, z: i.z + pz * raus * d, h, px, pz, raus, dx: Math.cos(h), dz: -Math.sin(h) };
  }

  function berth(platzId, info) {
    const innerId = sim()?.paeckchenInnen?.(platzId);
    const i = innerId && innen(innerId);
    if (!i) return null;
    const L = info?.length ?? 8, B = info?.beam ?? 3;
    const a = aussen(i, L, B);
    return {
      id: platzId,
      x: a.x, z: a.z,
      heading: a.h,
      kind: 'paeckchen',
      length: L + 1,
      width: B + 1,
      side: i.b.side || 1,
      // Leinen enden an Deck des inneren Boots
      deck: Math.max(0.5, (i.deck ?? 0.9) - 0.05),
      paeckchen: innerId,
      innenBoot: i.bootId,
    };
  }

  // Rechteck eines Rumpfs: Mitte, Richtung, halbe Länge und Breite
  const rechteck = (x, z, h, L, B) => ({ x, z, dx: Math.cos(h), dz: -Math.sin(h), l: L / 2, b: B / 2 });
  // Überlappen zwei gedrehte Rechtecke (Trennachsen)?
  function ueberlappt(r, q, rand) {
    const achsen = [[r.dx, r.dz], [-r.dz, r.dx], [q.dx, q.dz], [-q.dz, q.dx]];
    const mx = q.x - r.x, mz = q.z - r.z;
    for (const [ax, az] of achsen) {
      const proj = (o) => Math.abs(o.dx * ax + o.dz * az) * o.l + Math.abs(-o.dz * ax + o.dx * az) * o.b;
      if (Math.abs(mx * ax + mz * az) > proj(r) + proj(q) + rand) return false;
    }
    return true;
  }

  /**
   * Läge das Boot außen frei? Rumpf im befahrbaren Wasser (keine Stege, Plätze, kein Land, tief genug),
   * daneben eine freie Gasse fürs Fahrwasser, und kein anderer Rumpf zu nah (liegend oder auf dem Weg
   * zu einem Platz). Ohne Fahrwasser-Karte (sehr früh beim Laden) gilt der Platz als frei.
   */
  function passt(innerId, boot) {
    return pruefe(innerId, boot) == null;
  }
  // Wege anderer Plätze, die ein Boot außen nicht zuparken darf (Rechtecke wie in world/fahrwasser.js:
  // x, z, h, l, b; art). Box: rückwärts hinaus und hinein. Längsseits: seitlich ab, dann voraus hinaus,
  // hinein von achtern (boat-anim approachPoints und pushUndock).
  const BOX = new Set(['box', 'finger']);
  function korridore(q) {
    const dx = Math.cos(q.h), dz = -Math.sin(q.h), px = Math.sin(q.h), pz = Math.cos(q.h);
    const mit = (laengs, quer, l, b) => ({ x: q.x + dx * laengs + px * quer, z: q.z + dz * laengs + pz * quer, dx, dz, l: l / 2, b: b / 2 });
    if (BOX.has(q.art)) {
      // Bug zum Steg: hinaus und hinein über das Wasser hinter der Box
      const r = mit(-q.l * 0.9, 0, q.l * 1.4, q.b);
      return { ablegen: r, anfahrt: r };
    }
    const side = game.boatView?.platzBerth?.(q.id)?.side || 1;
    const raus = -side;
    return {
      ablegen: mit(q.l * 0.45, raus * q.b, q.l * 1.9, q.b * 1.6),
      anfahrt: mit(-q.l * 1.1, raus * q.b, q.l * 3.2, q.b * 2),
    };
  }
  const belegt = (st, id) => st?.berths?.[id] != null || !!st?.leaving?.[id];

  // Abstand eines Punkts zu einer Strecke a-b
  function abstand(p, a, b) {
    const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1e-9;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2));
    return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t);
  }

  /**
   * Grund, warum das Boot außen nicht frei läge, oder null:
   * 'steg' (Rumpf auf einem Steg oder einer Mole), 'platz:<id>' (im Rechteck eines anderen Liegeplatzes),
   * 'flach' (Land oder zu flach), 'gasse' (daneben kein freies Fahrwasser), 'boot:<id>' (zu nah an
   * einem anderen Rumpf). Ohne Karte (sehr früh beim Laden) null.
   */
  function pruefe(innerId, boot) {
    const frei = game.boatView?.frei;
    const hin = game.boatView?.hindernisse?.();
    const i = innen(innerId);
    if (!i || typeof frei !== 'function' || !hin) return null;
    const L = boot?.length ?? 8, B = boot?.beam ?? 3, t = (boot?.draft ?? 1) + 0.2;
    const a = aussen(i, L, B);
    const punkt = (laengs, quer) => ({ x: a.x + a.dx * laengs + a.px * a.raus * quer, z: a.z + a.dz * laengs + a.pz * a.raus * quer });
    const RAND = 0.3;
    // Rumpf: Punkte alle 1 m entlang Mittellinie und beider Bordwände
    const n = Math.max(2, Math.ceil(L));
    const rumpf = [];
    for (let k = 0; k <= n; k++) {
      const l = -L / 2 + (L * k) / n;
      for (const q of [-B / 2, 0, B / 2]) rumpf.push(punkt(l, q));
    }
    for (const lin of hin.linien) {
      const pts = lin.punkte;
      for (let j = 0; j + 1 < pts.length; j++) {
        for (const p of rumpf) if (abstand(p, pts[j], pts[j + 1]) < lin.breite / 2 + RAND) return 'steg';
      }
    }
    const r = rechteck(a.x, a.z, a.h, L, B);
    const st = sim()?.state;
    for (const q of hin.rechtecke) {
      if (q.id === innerId) continue;
      if (ueberlappt(r, rechteck(q.x, q.z, q.h, q.l, q.b), RAND)) return `platz:${q.id}`;
      // Ein Boot liegt dort und muss heraus können (Plätze anderer Stufen zählen nicht, sie sind nicht da)
      if (q.art !== 'gast' && belegt(st, q.id) && ueberlappt(r, korridore(q).ablegen, RAND)) return `ablegen:${q.id}`;
    }
    const tiefe = game.landscape?.tiefeBei;
    if (typeof tiefe === 'function') for (const p of rumpf) if (!(tiefe(p.x, p.z) >= t)) return 'flach';
    // Gasse außen daneben: dort fahren andere Boote vorbei
    const g = GASSE(B);
    const m = Math.max(2, Math.ceil((L + 4) / 3));
    for (let k = 0; k <= m; k++) {
      const p = punkt(-(L + 4) / 2 + ((L + 4) * k) / m, B / 2 + 0.5 + g / 2);
      if (!frei(p.x, p.z, g / 2, 1)) return 'gasse';
    }
    // Andere Rümpfe: liegend, beim Anlegen oder schon unterwegs zu einem Platz
    for (const o of game.boatAnim?.boats ?? []) {
      if (o.id === i.bootId || o.id === boot?.id) continue;
      if (!o.berth || o.berth.kind === 'buoy' || String(o.berth.id).startsWith('anker-')) continue;
      const f = o.finalPose?.(o.berth) ?? { x: o.x, z: o.z };
      const q = rechteck(f.x, f.z, o.berth.heading ?? o.heading, o.info.length, o.info.beam);
      if (ueberlappt(r, q, RUMPF_ABSTAND)) return `boot:${o.id}`;
    }
    return null;
  }

  // Zugeparkt: Liegt ein Boot außen im Päckchen im Anfahrweg dieses (freien) Platzes? Dann wartet der
  // Platz, bis es fort ist (sim ctx.berthBlocked, 'paeckchen'). Zwischengespeichert, bis sich die
  // Päckchen ändern.
  let zpSig = '', zp = new Map();
  function zugeparkt(platzId) {
    const st = sim()?.state;
    if (!st) return false;
    const aussenIds = Object.keys(st.berths).filter((k) => k.endsWith('+'));
    const leer = Object.keys(st.leaving || {}).filter((k) => k.endsWith('+'));
    if (!aussenIds.length && !leer.length) return false;
    const sig = `${st.stage}|${aussenIds.map((k) => k + st.berths[k]).join(',')}|${leer.join(',')}`;
    if (sig !== zpSig) { zpSig = sig; zp = new Map(); }
    if (zp.has(platzId)) return zp.get(platzId);
    let ja = false;
    const q = game.boatView?.hindernisse?.()?.rechtecke?.find((x) => x.id === platzId);
    if (q) {
      const k = korridore(q).anfahrt;
      for (const id of [...aussenIds, ...leer]) {
        if (id === platzId + '+') continue;
        const o = game.boatView?.boot?.(st.berths[id] ?? st.leaving?.[id]?.boatId);
        if (!o) continue;
        const f = o.berth?.id === id ? o.finalPose?.(o.berth) ?? o : o;
        if (ueberlappt(rechteck(f.x, f.z, o.heading, o.info.length, o.info.beam), k, RUMPF_ABSTAND)) { ja = true; break; }
      }
    }
    zp.set(platzId, ja);
    return ja;
  }

  // Liegt das Boot innen schon fest an seinem Platz (sonst wartet das äußere an der Boje)?
  function innenFest(platzId) {
    const innerId = sim()?.paeckchenInnen?.(platzId);
    const bootId = innerId ? sim()?.state?.berths?.[innerId] : null;
    const anim = bootId != null ? game.boatView?.boot?.(bootId) : null;
    if (!anim) return true;
    return !!anim.moored && anim.berth?.id === innerId;
  }

  // Liegt an diesem Boot außen noch ein anderes (oder legt es dort gerade an)?
  function blockiert(bootId) {
    if (bootId == null) return false;
    for (const o of game.boatAnim?.boats ?? []) {
      if (o.id !== bootId && o.berth?.kind === 'paeckchen' && String(o.berth.innenBoot) === String(bootId)) return true;
    }
    return false;
  }

  // Für die Ringe beim Ziehen: Mitte und Maße des Platzes außen für dieses Boot
  function lage(platzId, bootId) {
    const st = sim()?.state;
    const boat = st?.boats?.[bootId];
    const b = berth(platzId, boat ? { length: boat.length, beam: boat.beam } : null);
    return b ? { x: b.x, z: b.z, heading: b.heading, length: boat?.length ?? 8, width: boat?.beam ?? 3 } : null;
  }

  // Fender: Das Boot innen hängt sie auch außen aus, solange ein Boot außen liegt oder anlegt
  let t = 0;
  game.onTick?.((dt) => {
    t += dt;
    if (t < 0.3) return;
    t = 0;
    const innenIds = new Set();
    for (const o of game.boatAnim?.boats ?? []) if (o.berth?.kind === 'paeckchen' && o.berth.innenBoot != null) innenIds.add(String(o.berth.innenBoot));
    for (const o of game.boatAnim?.boats ?? []) {
      const ja = innenIds.has(String(o.id));
      if (!!o.fenderBeide !== ja) o.fenderBeide = ja;
    }
  });

  // Boot angetippt (Bootskarte offen) und keine Box frei: Rahmen neben den Booten, an die es ins
  // Päckchen darf. Antippen eines Rahmens (pick 'berth') oder des Boots daneben legt es dorthin.
  const THREE = game.THREE;
  const rahmen = THREE && game.scene ? new THREE.Group() : null;
  const rahmenMat = THREE ? new THREE.MeshBasicMaterial({ color: '#f4f1e6', transparent: true, opacity: 0.85, depthTest: false }) : null;
  if (rahmen) { rahmen.name = 'paeckchen-rahmen'; game.scene.add(rahmen); }
  function rahmenGeo(l) {
    const a = l.length / 2 + 0.4, b = l.width / 2 + 0.4, k = 0.35;
    const form = new THREE.Shape([new THREE.Vector2(-a, -b), new THREE.Vector2(a, -b), new THREE.Vector2(a, b), new THREE.Vector2(-a, b)]);
    form.holes.push(new THREE.Path([new THREE.Vector2(-a + k, -b + k), new THREE.Vector2(-a + k, b - k), new THREE.Vector2(a - k, b - k), new THREE.Vector2(a - k, -b + k)]));
    const g = new THREE.ShapeGeometry(form);
    g.rotateX(-Math.PI / 2);
    return g;
  }
  function leeren() {
    if (!rahmen) return;
    for (const m of rahmen.children) m.geometry.dispose();
    rahmen.clear();
  }
  function zeige(bootId) {
    leeren();
    if (!rahmen || bootId == null) return;
    for (const id of sim()?.paeckchenZiele?.(bootId) ?? []) {
      const l = lage(id, bootId);
      if (!l) continue;
      const m = new THREE.Mesh(rahmenGeo(l), rahmenMat);
      m.position.set(l.x, 0.12, l.z);
      m.rotation.y = l.heading;
      m.renderOrder = 10;
      m.userData.pick = { type: 'berth', id };
      m.userData.platz = id;
      rahmen.add(m);
    }
  }
  game.on?.('sim:select', ({ boatId, berths } = {}) => zeige(berths?.length ? null : boatId));
  game.on?.('sim:moored', () => { if (sim()?.selected == null) leeren(); });
  game.on?.('ui:cancel', leeren);
  game.onTick?.(() => {
    if (!rahmen?.children.length) return;
    rahmenMat.opacity = 0.6 + 0.3 * Math.sin(performance.now() / 250);
  });

  // Hinweis beim ersten Mal (features/einstieg.js): ein Boot liegt sichtbar an der Boje, keine Box ist
  // frei, aber es dürfte ins Päckchen. Alle 2 s geprüft, gemeldet höchstens einmal je Boot.
  const gemeldet = new Set();
  let h = 0;
  game.onTick?.((dt) => {
    h += dt;
    if (h < 2) return;
    h = 0;
    const s = sim();
    if (!s?.state || s.state.phase !== 'day') return;
    for (const b of s.waitingBoats?.() ?? []) {
      if (!b.atBuoy || gemeldet.has(b.id)) continue;
      if (!(s.paeckchenZiele?.(b.id) ?? []).length) continue;
      gemeldet.add(b.id);
      game.emit('paeckchen:moeglich', { id: b.id });
      break;
    }
  });

  game.paeckchen = { berth, passt, pruefe, blockiert, innenFest, lage, zeige, zugeparkt };
}

export default init;
