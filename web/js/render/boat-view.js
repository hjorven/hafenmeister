// Bruecke zwischen den Spielregeln (sim.js ueber bridge.js) und den 3D-Booten.
//
// Hoert auf die Ereignisse aus docs/spielregeln.md und laesst die Boote sichtbar fahren:
//   'boot-kommt'      { id, groesse, art, modell, palette, name, boje }  Boot kommt ueber den See und
//                     macht an der Warteboje fest (boje = Nummer ab 0)
//   'boot-zugewiesen' { id, platz }   Boot legt von der Boje ab und laeuft in die Box ein
//   'boot-faehrt'     { id, platz }   Boot legt ab (oder verlaesst die Boje) und faehrt weg
// Sendet 'boot:an-boje' { id, boje }, sobald ein Boot sichtbar an der Warteboje fest ist.
// Beim Start und nach dem Laden eines Spielstands baut es alle Boote aus game.sim.boote auf.
//
// Modelle kommen aus game.boatTypes.<s|m|l|xl|xxl>.buildBoat, die Bewegung aus render/boat-anim.js.
// Die Wartebojen liegen hier (BOJEN), bis harbor.js eigene Positionen bekommt.
// Schnittstelle nach aussen: game.boatView = { boote, boot(id), bojen() }.
import * as THREE from 'three';
import { addBoat, berthFromPlatz } from './boat-anim.js';
import { HAFEN } from '../data/harbor.js';

const U = HAFEN.einheiten?.meterProEinheit ?? 0.62;

// Wartebojen je Stufe in Planeinheiten (x nach Osten, y nach Norden), wie harbor.js.
// Stufe 1 und 2: im See nordoestlich vor Steg A; ab Stufe 3 eine Reihe weiter draussen im See.
const BOJEN = {
  1: [[-100, 56], [-86, 53], [-72, 50]],
  2: [[-112, 86], [-94, 90], [-76, 88], [-58, 92]],
  3: [[-122, 104], [-102, 108], [-82, 105], [-62, 109], [-42, 106], [-22, 110], [-2, 107], [18, 111]],
};
// Hier kommen die Boote ins Bild und verschwinden wieder (ausserhalb der Startansicht)
const REVIERRAND = {
  1: [-58, 90],      // nordoestlich der Bojen, knapp ausserhalb der Startansicht
  2: [-30, 120],
  3: [330, 380],     // draussen auf der Ostsee
};

const bySt = (table, stufe) => table[Math.min(3, Math.max(1, stufe | 0))];
const welt = ([x, y]) => ({ x: x * U, z: -y * U });

export function init(game) {
  const boats = new Map();           // id -> { anim, info }
  const bojenGruppe = new THREE.Group();
  bojenGruppe.name = 'wartebojen';
  game.scene.add(bojenGruppe);
  let bojenStufe = 0;

  const stufe = () => game.state?.stage ?? game.state?.stufe ?? 1;
  const windFrom = () => ((game.boatAnim?.wind?.fromDeg ?? 250) * Math.PI) / 180;

  // Wartebojen der Landschaft (render/landschaft) haben Vorrang, dann zeichnet dieses Modul keine eigenen
  const landBojen = () => game.landscape?.warteplaetze?.bojen ?? null;

  function bojenPos() {
    const lb = landBojen();
    if (lb?.length) {
      const n = game.sim?.waitSpotCount?.() ?? lb.length;
      return lb.slice(0, Math.max(1, Math.min(n, lb.length))).map((b) => ({ x: b.x, z: b.z }));
    }
    const list = bySt(BOJEN, stufe());
    const n = game.sim?.waitSpotCount?.() ?? list.length;
    return list.slice(0, Math.max(1, Math.min(n, list.length))).map(welt);
  }

  // --- Wartebojen zeichnen ------------------------------------------------------------------
  const bojeGeo = new THREE.SphereGeometry(0.42, 10, 8);
  const topGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.7, 6);
  const ringGeo = new THREE.TorusGeometry(0.43, 0.07, 6, 14).rotateX(Math.PI / 2);
  const bojeMat = new THREE.MeshLambertMaterial({ color: '#f2c94c', flatShading: true });
  const ringMat = new THREE.MeshLambertMaterial({ color: '#d64541', flatShading: true });
  const topMat = new THREE.MeshLambertMaterial({ color: '#3a3f46' });

  function baueBojen() {
    bojenStufe = stufe();
    bojenGruppe.clear();
    if (landBojen()?.length) return;
    bojenPos().forEach((p, i) => {
      const b = new THREE.Group();
      b.name = `boje-${i}`;
      const ball = new THREE.Mesh(bojeGeo, bojeMat);
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = 0.05;
      const top = new THREE.Mesh(topGeo, topMat);
      top.position.y = 0.6;
      b.add(ball, ring, top);
      b.position.set(p.x, 0, p.z);
      b.userData.phase = i * 1.7;
      bojenGruppe.add(b);
    });
  }
  game.onTick(() => {
    const t = game.time;
    for (const b of bojenGruppe.children) {
      const ph = b.userData.phase;
      b.position.y = Math.sin(t * 1.6 + ph) * 0.06 - 0.05;
      b.rotation.x = Math.sin(t * 1.3 + ph) * 0.08;
      b.rotation.z = Math.cos(t * 1.1 + ph) * 0.08;
    }
  });

  // --- Liegeplaetze -------------------------------------------------------------------------
  function bojeBerth(nr) {
    const list = bojenPos();
    const p = list[Math.max(0, Math.min(list.length - 1, nr | 0))];
    return { id: `boje-${nr}`, x: p.x, z: p.z, heading: windFrom(), kind: 'buoy' };
  }

  function platzBerth(platzId) {
    const p = HAFEN.plaetze.find((q) => q.id === platzId);
    if (!p) return null;
    const st = stufe();
    let b;
    try { b = berthFromPlatz(p, st, HAFEN); } catch { return null; }
    // Was die Stege-Grafik tatsaechlich gezeichnet hat, gewinnt (gleiche Stufe, gleiche Lage)
    const sp = game.stege?.platz?.(platzId);
    if (sp) {
      b.x = sp.x; b.z = sp.z;
      if (sp.richtung !== undefined) b.heading = (sp.richtung * Math.PI) / 180;
      if (sp.laenge) b.length = sp.laenge;
      if (sp.breite) b.width = sp.breite;
    }
    const bauart = p.art === 'kai' ? 'kai' : p.steg === 'D' ? 'schwimmsteg' : 'holz';
    const deck = game.stege?.deckHoehe?.(bauart);
    if (deck) b.deck = deck + 0.1;
    return b;
  }

  // --- Boote bauen --------------------------------------------------------------------------
  function bauModell(info) {
    const size = String(info.groesse ?? 'S').toLowerCase();
    const types = game.boatTypes?.[size];
    if (types?.buildBoat) {
      const entry = types.MODELS?.find?.((m) => m.id === info.modell) ?? info.modell;
      try {
        const g = types.buildBoat(entry, { palette: info.palette ?? 0, id: info.id, sails: false });
        if (g) return { group: g, types };
      } catch (e) {
        console.warn('Bootsmodell nicht baubar:', info.modell, e);
      }
    }
    return { group: ersatzModell(size), types: null };
  }

  // Einfacher Rumpf, falls es fuer die Groesse noch keine Modelle gibt
  function ersatzModell(size) {
    const L = { s: 5, m: 8, l: 12, xl: 25, xxl: 60 }[size] ?? 6;
    const g = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(L, L * 0.12, L * 0.33), new THREE.MeshLambertMaterial({ color: '#fffcf6' }));
    hull.position.y = L * 0.04;
    g.add(hull);
    g.userData.boat = { size: size.toUpperCase(), length: L, beam: L * 0.33, draft: L * 0.1, kind: 'motor' };
    return g;
  }

  function erzeuge(info) {
    const vorhanden = boats.get(info.id);
    if (vorhanden) return vorhanden;
    const { group, types } = bauModell(info);
    group.userData.pick = { type: 'boat', id: info.id };
    group.userData.bootName = info.name;
    const anim = addBoat(game, group, {
      id: info.id,
      animate: types?.animateBoat,
      setSails: types?.setSails,
      sails: false,
    });
    const e = { anim, info, group };
    boats.set(info.id, e);
    return e;
  }

  function entferne(id) {
    const e = boats.get(id);
    if (!e) return;
    boats.delete(id);
    e.anim.remove();
  }

  const rand = () => welt(bySt(REVIERRAND, stufe()));

  // --- Fahrwege ab Stufe 3: See und Binnensee verbindet nur der Durchstich ------------------
  // Planeinheiten wie render/landschaft/gelaende.js (DURCHSTICH x 152 bis 182, Nehrung y 186 bis 224,
  // ab Stufe 5 Aussenhafen zwischen West- und Ostmole mit Einfahrt bei etwa x 133, y 315).
  const DURCH_X = 167;
  const imSee = (p) => -p.z / U < 200;                       // suedlich der Nehrung = Binnensee
  function seeTor() {
    return [{ x: DURCH_X * U, z: -176 * U }, { x: DURCH_X * U, z: -200 * U }, { x: DURCH_X * U, z: -238 * U }];
  }
  function aussenTor() {
    // ab Stufe 5 um die Ostmole herum durch die Einfahrt des Aussenhafens
    if (stufe() >= 5) return [{ x: 150 * U, z: -270 * U }, { x: 138 * U, z: -305 * U }, { x: 134 * U, z: -334 * U }];
    return [{ x: DURCH_X * U, z: -258 * U }];
  }
  /** Wegpunkte von a nach b (Welt), ohne a und b selbst. */
  function fahrweg(a, b) {
    if (stufe() < 3) return [];
    const aSee = imSee(a), bSee = imSee(b);
    if (aSee && bSee) return [];
    const innen = seeTor();                  // vom See zur Ostsee
    const aussen = aussenTor();
    if (aSee && !bSee) return [...innen, ...aussen];
    if (!aSee && bSee) return [...aussen.slice().reverse(), ...innen.slice().reverse()];
    return [];                               // beide draussen
  }

  // --- Ereignisse der Spielregeln -----------------------------------------------------------
  game.on('boot-kommt', (info) => {
    if (!info || info.id == null) return;
    if (bojenStufe !== stufe()) baueBojen();
    const e = erzeuge(info);
    const start = rand();
    const ziel = bojeBerth(info.boje ?? 0);
    e.anim.place(start.x, start.z, Math.atan2(-(ziel.z - start.z), ziel.x - start.x));
    if (e.anim.info.kind === 'sail') e.anim.setSails(true);
    // Segelboote bergen die Segel vor der Boje (dock() erledigt das), dann Leine an die Boje
    e.anim.dock(ziel);
  });

  game.on('boot-zugewiesen', ({ id, platz } = {}) => {
    const e = boats.get(id) ?? (sucheInfo(id) && erzeuge(sucheInfo(id)));
    if (!e) return;
    const b = platzBerth(platz);
    if (!b) return;
    if (!e.anim.moored && e.anim.state === 'idle') e.anim.moorAt(bojeBerth(e.info.boje ?? 0));
    // ab Stufe 3 von der Reede durch Einfahrt und Durchstich in den See
    e.anim.dock(b, { via: fahrweg({ x: e.anim.x, z: e.anim.z }, b) });
  });

  game.on('boot-faehrt', ({ id } = {}) => {
    const e = boats.get(id);
    if (!e) return;
    const ziel = rand();
    const weg = [];
    const von = { x: e.anim.x, z: e.anim.z };
    if (stufe() >= 3) {
      // durch Durchstich und Einfahrt hinaus, dann zum Revierrand auf See
      weg.push(...fahrweg(von, ziel));
    } else {
      // zuerst ein Stueck in den freien See, dann zum Revierrand
      const bojen = bojenPos();
      const mitte = bojen[Math.floor(bojen.length / 2)];
      if (mitte) weg.push({ x: mitte.x + 6, z: mitte.z + 4 });
    }
    weg.push(ziel);
    e.faehrt = true;
    entferneMuenze(id, 0);
    e.anim.undock(weg, { sails: e.anim.info.kind === 'sail' }).then((ok) => {
      if (ok && boats.get(id) === e) entferne(id);
    });
  });

  // --- Muenzen ueber liegenden Booten (abends Hafengeld, eingestrichen ueber ui/gesten.js) ------
  const muenzen = new Map();          // bootId -> Mesh
  const muenzGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.12, 18).rotateX(Math.PI / 2);
  const muenzMat = new THREE.MeshLambertMaterial({ color: '#f5c542', emissive: '#6b4a00', flatShading: true });
  const randMat = new THREE.MeshLambertMaterial({ color: '#d99a1e', flatShading: true });
  const randGeo = new THREE.TorusGeometry(0.55, 0.06, 6, 18);

  function zeigeMuenze(id) {
    if (muenzen.has(id) || !boats.has(id)) return;
    const m = new THREE.Mesh(muenzGeo, muenzMat);
    m.add(new THREE.Mesh(randGeo, randMat));
    m.name = `muenze-${id}`;
    m.userData.pick = { type: 'coin', id };
    m.userData.t0 = game.time;
    m.scale.setScalar(0.01);
    m.renderOrder = 3;
    game.scene.add(m);
    muenzen.set(id, m);
  }
  function entferneMuenze(id, spaet = 0) {
    const m = muenzen.get(id);
    if (!m) return;
    muenzen.delete(id);
    // ui/gesten.js laesst eingestrichene Muenzen noch zur Kasse fliegen
    setTimeout(() => m.parent?.remove(m), spaet);
  }
  game.onTick(() => {
    const t = game.time;
    for (const [id, m] of muenzen) {
      if (m.userData.eingestrichen) continue;
      const e = boats.get(id);
      if (!e) { entferneMuenze(id); continue; }
      const a = e.anim;
      const h = Math.max(2.2, (a.model.userData.iconHeight ?? a.info.length * 0.35) + 0.8);
      m.position.set(a.model.position.x, h + Math.sin(t * 2 + id) * 0.15, a.model.position.z);
      m.rotation.y = t * 2.2;
      const k = Math.min(1, (t - m.userData.t0) * 3);
      m.scale.setScalar(Math.max(0.01, k * (1 + Math.max(0, 0.25 - (t - m.userData.t0)) * 2)));
    }
  });
  game.on('sim:feeReady', (d) => { if (d?.boatId != null) zeigeMuenze(d.boatId); });
  game.on('sim:collected', (d) => {
    if (d?.boatId != null) entferneMuenze(d.boatId, 700);
    else for (const id of [...muenzen.keys()]) entferneMuenze(id, 700);
  });
  game.on('sim:departed', (d) => entferneMuenze(d?.boatId, 0));

  // Boot ist sichtbar an der Boje fest: ab jetzt laeuft seine Geduld (Spielregeln)
  game.on('boat:moored', (d) => {
    if (!d || !boats.has(d.id) || !String(d.berth ?? '').startsWith('boje-')) return;
    game.emit('boot:an-boje', { id: d.id, boje: Number(String(d.berth).slice(5)) });
  });

  function sucheInfo(id) {
    return game.sim?.boote?.find?.((b) => b.id === id) ?? null;
  }

  // Alle Boote aus dem Spielstand sofort an ihre Plaetze legen (Start, Laden, neues Spiel)
  function abgleich() {
    baueBojen();
    const liste = game.sim?.boote ?? [];
    const ids = new Set(liste.map((b) => b.id));
    // Boote, die gerade abfahren, fahren zu Ende (sie sind in den Regeln schon weg)
    for (const [id, e] of [...boats]) if (!ids.has(id) && !e.faehrt) entferne(id);
    for (const info of liste) {
      const e = erzeuge(info);
      e.info = { ...e.info, ...info };
      e.faehrt = false;
      if (e.anim.state !== 'idle' && e.anim.state !== 'moored') continue;   // faehrt gerade
      const b = info.platz ? platzBerth(info.platz) : bojeBerth(info.boje ?? 0);
      if (b) e.anim.moorAt(b);
    }
    for (const id of [...muenzen.keys()]) if (!boats.has(id)) entferneMuenze(id);
    const st = game.sim?.state ?? game.state;
    for (const [id, b] of Object.entries(st?.boats ?? {})) if (b?.pendingFee > 0) zeigeMuenze(Number(id));
  }

  game.on('ready', () => {
    abgleich();
    // Boote sind im Wasser zu sehen: das HUD blendet die Leiste der Wartenden aus
    game.boatsVisible = true;
    game.emit('sim:change', {});
  });
  game.on('spielstand-geladen', () => setTimeout(abgleich, 0));
  game.on('sim:change', (d) => { if (d?.reason === 'load' || d?.reason === 'new') abgleich(); });
  game.on('stufe', () => { if (bojenStufe) abgleich(); });

  game.boatView = {
    get boote() { return [...boats.values()].map((e) => ({ id: e.info.id, zustand: e.anim.state, anim: e.anim })); },
    boot: (id) => boats.get(id)?.anim ?? null,
    bojen: () => bojenPos(),
  };
}

export default init;
