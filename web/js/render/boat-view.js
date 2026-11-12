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
    const i = Math.max(0, Math.min(list.length - 1, nr | 0));
    const p = list[i];
    let heading = windFrom(), abstand = Infinity;
    if (list.length > 1) {
      // Boote liegen quer zur Bojenreihe nebeneinander, nicht hintereinander, sonst stossen
      // laengere Boote an das Boot an der Nachbarboje. Von beiden Querrichtungen die luvseitige.
      const a = list[Math.max(0, i - 1)], c = list[Math.min(list.length - 1, i + 1)];
      const rx = c.x - a.x, rz = c.z - a.z;
      const reihe = Math.atan2(-rz, rx);
      const quer = [reihe + Math.PI / 2, reihe - Math.PI / 2];
      const w = windFrom();
      heading = Math.cos(quer[0] - w) >= Math.cos(quer[1] - w) ? quer[0] : quer[1];
      for (const q of list) if (q !== p) abstand = Math.min(abstand, Math.hypot(q.x - p.x, q.z - p.z));
    }
    return { id: `boje-${nr}`, x: p.x, z: p.z, heading, kind: 'buoy', abstand };
  }

  // Eine Boje nur fuer ein Boot. Ist die Boje der Spielregeln noch belegt (das vorige Boot legt
  // gerade ab) oder gibt es weniger Bojen als Warteplaetze, nimmt das Boot die naechste freie Boje,
  // sonst ankert es vor der Bojenreihe.
  function warteplatz(nr, selbst) {
    const list = bojenPos();
    const belegt = new Set(), anker = new Set();
    for (const o of game.boatAnim.boats) {
      if (o === selbst) continue;
      // berth: wo es liegt oder hinfaehrt; reserviert: gerade vergeben, Fahrt beginnt im naechsten Bild
      for (const id of [String(o.berth?.id ?? ''), String(o.reserviert ?? '')]) {
        if (id.startsWith('boje-')) belegt.add(Number(id.slice(5)));
        if (id.startsWith('anker-')) anker.add(Number(id.slice(6)));
      }
    }
    const reserviere = (b) => { if (selbst) selbst.reserviert = b.id; return b; };
    const w = Math.max(0, Math.min(list.length - 1, nr | 0));
    if (!belegt.has(w)) return reserviere(bojeBerth(w));
    let best = -1;
    for (let i = 0; i < list.length; i++) {
      if (belegt.has(i)) continue;
      if (best < 0 || Math.abs(i - w) < Math.abs(best - w)) best = i;
    }
    if (best >= 0) return reserviere(bojeBerth(best));
    // Ankerplatz im Ankerbereich der Landschaft (Kreis, ab Stufe 5 ein eigener fuer XL),
    // Raster mit 20 m Abstand, alle Boote liegen im selben Wind und damit parallel.
    let k = 0;
    while (anker.has(k)) k++;
    const b = bojeBerth(Math.floor(list.length / 2));
    // feste Ankerplaetze der Landschaft (PR 98), vorne zuerst, passend zur Bootsgroesse
    const RANG = { S: 0, M: 1, L: 2, XL: 3, XXL: 4 };
    const plaetze = game.landscape?.warteplaetze?.ankerplaetze;
    if (plaetze?.length) {
      const g = RANG[selbst?.info.size] ?? 1;
      const idx = plaetze.findIndex((q, i) => !anker.has(i) && (RANG[q.groesse] ?? 2) >= g);
      if (idx >= 0) {
        const q = plaetze[idx];
        return reserviere({ id: `anker-${idx}`, x: q.x, z: q.z, heading: b.heading, kind: 'buoy', abstand: (q.schwoikreisM ?? 10) * 2 });
      }
      k = Math.max(k, plaetze.length);
      while (anker.has(k)) k++;
    }
    const gross = selbst && (selbst.info.size === 'XL' || selbst.info.size === 'XXL');
    const bereiche = game.landscape?.warteplaetze?.ankerbereiche ?? [];
    const bereich = bereiche.find((q) => (q.groesse === 'XL') === !!gross) ?? bereiche[0];
    const mitte = bereich ? { x: bereich.x, z: bereich.z } : (() => {
      const fx = Math.cos(b.heading), fz = -Math.sin(b.heading);
      return { x: b.x + fx * 40, z: b.z + fz * 40 };
    })();
    const p = ankerSlot(k, gross ? 60 : 20);
    return reserviere({ id: `anker-${k}`, x: mitte.x + p.x, z: mitte.z + p.z, heading: b.heading, kind: 'buoy', abstand: gross ? 60 : 20 });
  }

  // k-ter Ankerplatz: Mitte, dann Ringe mit dem Abstand d (6, 12, 18 ... Plaetze je Ring)
  function ankerSlot(k, d) {
    if (k === 0) return { x: 0, z: 0 };
    let ring = 1, rest = k - 1;
    while (rest >= ring * 6) { rest -= ring * 6; ring++; }
    const a = (rest / (ring * 6)) * Math.PI * 2;
    return { x: Math.cos(a) * ring * d, z: Math.sin(a) * ring * d };
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

  // --- Ankerlicht: nachts brennt an Booten an Boje oder Anker ein weisses Licht oben am Mast --------
  const lichtGeo = new THREE.SphereGeometry(0.16, 8, 6);
  const lichtMat = new THREE.MeshBasicMaterial({ color: '#fff6d8' });
  const glanzMat = new THREE.MeshBasicMaterial({ color: '#fff3c4', transparent: true, opacity: 0.35, depthWrite: false });
  const glanzGeo = new THREE.SphereGeometry(0.5, 10, 8);
  function ankerlicht(e) {
    if (e.licht) return e.licht;
    const box = new THREE.Box3().setFromObject(e.group);
    const l = new THREE.Mesh(lichtGeo, lichtMat);
    l.add(new THREE.Mesh(glanzGeo, glanzMat));
    l.name = 'ankerlicht';
    // lokal ueber der Mitte (Mast), knapp unter der hoechsten Stelle
    l.position.set(0, Math.max(0.8, box.max.y - e.group.position.y - 0.1), 0);
    l.visible = false;
    e.group.add(l);
    e.licht = l;
    return l;
  }
  game.onTick(() => {
    const nacht = game.landscape?.licht?.zustand?.nacht ?? 0;
    for (const e of boats.values()) {
      const an = nacht > 0.35 && e.anim.moored && e.anim.berth?.kind === 'buoy';
      if (an) ankerlicht(e).visible = true;
      else if (e.licht) e.licht.visible = false;
    }
  });

  function entferne(id) {
    const e = boats.get(id);
    if (!e) return;
    boats.delete(id);
    e.anim.remove();
  }

  const rand = () => welt(bySt(REVIERRAND, stufe()));
  // Startpunkt am Revierrand, an dem gerade kein anderes Boot ist (mehrere kommen oft zugleich)
  function freierStart(laenge = 6) {
    const r = rand();
    for (const d of [0, 14, -14, 28, -28, 42, -42, 56]) {
      const p = { x: r.x + d, z: r.z + Math.abs(d) * 0.3 };
      const frei = game.boatAnim.boats.every((o) => Math.hypot(o.x - p.x, o.z - p.z) > laenge + o.info.length + 6);
      if (frei) return p;
    }
    return { x: r.x + (Math.random() - 0.5) * 80, z: r.z + Math.random() * 20 };
  }

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
    if (aSee && !bSee) return rechts([...innen, ...aussen]);
    if (!aSee && bSee) return rechts([...aussen.slice().reverse(), ...innen.slice().reverse()]);
    return [];                               // beide draussen
  }
  // Wie im echten Fahrwasser: rechts halten. Ein- und Ausfahrende begegnen sich so mit Abstand.
  function rechts(pts, d = 3.5) {
    return pts.map((p, i) => {
      const a = pts[Math.max(0, i - 1)], c = pts[Math.min(pts.length - 1, i + 1)];
      const dx = c.x - a.x, dz = c.z - a.z, l = Math.hypot(dx, dz) || 1;
      // Steuerbord zur Fahrtrichtung (dx, dz) ist (-dz, dx) in x/z
      return { x: p.x - (dz / l) * d, z: p.z + (dx / l) * d };
    });
  }

  // --- Ereignisse der Spielregeln -----------------------------------------------------------
  game.on('boot-kommt', (info) => {
    if (!info || info.id == null) return;
    if (bojenStufe !== stufe()) baueBojen();
    const e = erzeuge(info);
    const start = freierStart(e.anim.info.length);
    const ziel = warteplatz(info.boje ?? 0, e.anim);
    // Antippen und Ziehen erst, wenn das Boot an der Boje fest ist (siehe boat:moored unten)
    e.pick = e.anim.model.userData.pick;
    delete e.anim.model.userData.pick;
    e.anim.place(start.x, start.z, Math.atan2(-(ziel.z - start.z), ziel.x - start.x));
    if (e.anim.info.kind === 'sail') e.anim.setSails(true);
    // Segelboote bergen die Segel vor der Boje (dock() erledigt das), dann Leine an die Boje
    e.anim.dock(ziel);
  });

  game.on('boot-zugewiesen', ({ id, platz } = {}) => {
    const neu = !boats.has(id);
    const e = boats.get(id) ?? (sucheInfo(id) && erzeuge(sucheInfo(id)));
    if (!e) return;
    const b = platzBerth(platz);
    if (!b) return;
    if (neu) {
      // ohne vorheriges boot-kommt (z. B. Fischer nach dem Aufstieg, stationBoat): liegt gleich am Platz
      e.anim.moorAt(b);
      return;
    }
    if (!e.anim.moored && e.anim.state === 'idle') e.anim.moorAt(warteplatz(e.info.boje ?? 0, e.anim));
    if (e.pick) { e.anim.model.userData.pick = e.pick; e.pick = null; }
    // Ist die Box noch nicht frei und das Boot noch unterwegs zur Boje, faehrt es erst zur Boje
    // und wartet dort (nicht mitten im Fahrwasser, wo es anderen im Weg laege).
    if (!e.anim.moored && !platzFrei(platz, b, e.anim)) { e.spaeter = platz; return; }
    fahreZu(e, platz, b);
  });

  function fahreZu(e, platz, b) {
    e.spaeter = null;
    e.anim.reserviert = null;
    // ab Stufe 3 von der Reede durch Einfahrt und Durchstich in den See.
    // Liegt noch ein Boot in der Box (es faehrt heute ab), wartet das neue, bis die Box frei ist.
    e.anim.dock(b, { via: fahrweg({ x: e.anim.x, z: e.anim.z }, b), waitFor: () => platzFrei(platz, b, e.anim) });
  }

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
  // Liegegeld wird beim Anlegen faellig (PR 100): die Muenze erst zeigen, wenn das Boot in der Box fest ist
  const amPlatz = (a) => a.moored && a.berth && a.berth.kind !== 'buoy';
  game.on('sim:feeReady', (d) => {
    const e = boats.get(d?.boatId);
    if (!e) return;
    if (amPlatz(e.anim)) zeigeMuenze(d.boatId);
    else e.muenzeWartet = true;
  });
  game.on('boat:moored', (d) => {
    const e = boats.get(d?.id);
    if (e?.muenzeWartet && amPlatz(e.anim)) { e.muenzeWartet = false; zeigeMuenze(d.id); }
  });
  game.on('sim:collected', (d) => {
    if (d?.boatId != null) { entferneMuenze(d.boatId, 700); const e = boats.get(d.boatId); if (e) e.muenzeWartet = false; }
    else for (const id of [...muenzen.keys()]) entferneMuenze(id, 700);
  });
  game.on('sim:departed', (d) => {
    entferneMuenze(d?.boatId, 0);
    const e = boats.get(d?.boatId);
    if (e) e.abgerechnet = true;     // bleibt sichtbar, bis 'boot-faehrt' am Vormittag kommt
  });

  // Boot ist am Platz fest: die Box blitzt einmal hell auf (Form und Drehung der Box aus render/stege.js)
  const blitze = new Map();     // platzId -> Restzeit
  game.on('boat:moored', (d) => {
    const id = d?.berth;
    if (!id || String(id).startsWith('boje-') || !game.stege?.platz?.(id)?.mesh) return;
    blitze.set(id, 1);
  });
  game.onTick((dt) => {
    for (const [id, t] of blitze) {
      const mat = game.stege?.platz?.(id)?.mesh?.material;
      const r = t - dt / 0.9;
      if (!mat || r <= 0) {
        blitze.delete(id);
        if (mat) mat.opacity = 0;
        continue;
      }
      blitze.set(id, r);
      mat.color.set('#ffffff');
      mat.opacity = 0.55 * r * r;
    }
  });

  // Ablegendes Boot ist aus der Box heraus: die Spielregeln geben die Box frei (state.leaving, PR 93)
  game.on('boat:clear', (d) => {
    if (!d || !boats.has(d.id) || String(d.berth ?? '').startsWith('boje-') || String(d.berth ?? '').startsWith('anker-')) return;
    game.emit('boot:aus-box', { id: d.id });
  });

  // Boot ist sichtbar an der Boje fest: ab jetzt laeuft seine Geduld (Spielregeln)
  game.on('boat:moored', (d) => {
    const e = boats.get(d?.id);
    if (e) e.anim.reserviert = null;      // jetzt traegt berth den Platz
    if (e?.pick) { e.anim.model.userData.pick = e.pick; e.pick = null; }
    const art = String(d?.berth ?? '');
    if (!d || !e || !(art.startsWith('boje-') || art.startsWith('anker-'))) return;
    if (e.spaeter) {
      // unterwegs schon zugewiesen: jetzt von der Boje aus zum Platz
      const b = platzBerth(e.spaeter);
      if (b) fahreZu(e, e.spaeter, b);
      return;
    }
    // die Spielregeln kennen nur ihre eigene Bojennummer
    game.emit('boot:an-boje', { id: d.id, boje: e.info.boje ?? 0 });
  });

  // --- Dauerlieger: morgens eine Runde draussen, abends zurueck an denselben Platz ----------
  // Ereignisse aus features/dauerlieger.js: 'dauer:auslaufen' { id, platzId, tage } (tage 0 = Tagestoern),
  // 'dauer:einlaufen' { id, platzId }.
  const RUNDE = {
    1: [40, 120],      // Mitte des Binnensees
    2: [40, 120],
    3: [110, 300],     // Ostsee vor der Einfahrt
    5: [60, 380],      // Ostsee vor dem Aussenhafen
  };
  const rundenMitte = () => {
    const st = stufe();
    return welt(st >= 5 ? RUNDE[5] : st >= 3 ? RUNDE[3] : RUNDE[st <= 1 ? 1 : 2]);
  };

  game.on('dauer:auslaufen', ({ id, tage } = {}) => {
    const e = boats.get(id);
    if (!e) return;
    const ziel = tage > 0 ? rand() : rundenMitte();
    const segel = e.anim.info.kind === 'sail';
    const weg = [...fahrweg({ x: e.anim.x, z: e.anim.z }, ziel), ziel];
    e.draussen = true;
    entferneMuenze(id, 0);
    e.anim.undock(weg, { sails: segel }).then((ok) => {
      if (!ok || boats.get(id) !== e) return;
      if (tage > 0) {
        // mehrtaegiger Toern: aus dem Bild, kommt mit 'dauer:einlaufen' zurueck
        e.faehrt = true;
        entferne(id);
        return;
      }
      // Tagestoern: grosse, gemuetliche Kreise unter Segeln oder Motor
      // jedes Boot auf einem eigenen Kreis, damit sich die Runden nicht kreuzen
      const n = draussenZahl++ % 4;
      e.anim.hold(ziel, { radius: 18 + e.anim.info.length + n * 11, speed: e.anim.cfg.cruise * 0.7, sails: segel, state: 'sailing' });
    });
  });

  let draussenZahl = 0;
  game.on('dauer:einlaufen', ({ id, platzId } = {}) => {
    let e = boats.get(id);
    if (!e) {
      const info = sucheInfo(id);
      if (!info) return;
      e = erzeuge(info);
      const start = freierStart(e.anim.info.length);
      e.anim.place(start.x, start.z, 0);
    }
    e.draussen = false;
    e.faehrt = false;
    const b = platzBerth(platzId ?? e.info.platz);
    if (!b) return;
    e.anim.dock(b, { via: fahrweg({ x: e.anim.x, z: e.anim.z }, b), seconds: 30 });
  });

  /** Ist die Box frei? Kein anderes Boot hat sie als Platz, und keins steht noch in ihr. */
  function platzFrei(platzId, b, selbst) {
    for (const o of game.boatAnim.boats) {
      if (o === selbst) continue;
      if (o.berth?.id === platzId) return false;
      const r = Math.max(b.length, b.width) / 2 + o.info.length / 2;
      if (Math.hypot(o.x - b.x, o.z - b.z) < r) return false;
    }
    return true;
  }

  function sucheInfo(id) {
    return game.sim?.boote?.find?.((b) => b.id === id) ?? null;
  }

  // Alle Boote aus dem Spielstand sofort an ihre Plaetze legen (Start, Laden, neues Spiel)
  function abgleich(laden = false) {
    baueBojen();
    const liste = game.sim?.boote ?? [];
    const ids = new Set(liste.map((b) => b.id));
    // Boote, die gerade abfahren, fahren zu Ende (sie sind in den Regeln schon weg)
    // Nachts abgerechnete Gaeste (sim:departed) liegen bis zum Ablegen am Vormittag noch in der Box,
    // nach dem Laden eines Spielstands sind sie weg (PR 108).
    for (const [id, e] of [...boats]) if (!ids.has(id) && !e.faehrt && !e.draussen && (laden || !e.abgerechnet)) entferne(id);
    for (const info of liste) {
      const e = erzeuge(info);
      e.info = { ...e.info, ...info };
      e.faehrt = false;
      if (e.anim.state !== 'idle' && e.anim.state !== 'moored') continue;   // faehrt gerade
      if (e.draussen) continue;                                          // Dauerlieger auf Runde
      const b = info.platz ? platzBerth(info.platz) : warteplatz(info.boje ?? 0, e.anim);
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
  game.on('spielstand-geladen', () => setTimeout(() => abgleich(true), 0));
  game.on('sim:change', (d) => { if (d?.reason === 'load' || d?.reason === 'new') abgleich(true); });
  game.on('stufe', () => { if (bojenStufe) abgleich(); });

  game.boatView = {
    get boote() { return [...boats.values()].map((e) => ({ id: e.info.id, zustand: e.anim.state, anim: e.anim })); },
    boot: (id) => boats.get(id)?.anim ?? null,
    bojen: () => bojenPos(),
  };
}

export default init;
