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
import { wimpelAn } from './wimpel-regel.js';
import { seebrueckeStrecke } from './landschaft/strand.js';
import { molen } from './landschaft/gelaende.js';
import { baueKarte, route, hindernisseAusHafen, bootMass, erreichbar, befahrbar, sichtlinie, zellMitte, freiBei, einfahrtAlsEinbahn } from '../world/fahrwasser.js';

const U = HAFEN.einheiten?.meterProEinheit ?? 0.62;

// Wartebojen je Stufe in Planeinheiten (x nach Osten, y nach Norden), wie harbor.js.
// Stufe 1 und 2: im See nordoestlich vor Steg A; ab Stufe 3 eine Reihe weiter draussen im See.
const BOJEN = {
  1: [[-100, 56], [-86, 53], [-72, 50]],
  2: [[-112, 86], [-94, 90], [-76, 88], [-58, 92]],
  3: [[-122, 104], [-102, 108], [-82, 105], [-62, 109], [-42, 106], [-22, 110], [-2, 107], [18, 111]],
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
      // Wer noch sichtbar an einer Boje liegt (gerade zugewiesen, legt erst ab), belegt sie weiter:
      // sonst steuert das naechste Boot dieselbe Boje an und liegt kurz auf ihm (Schichttest F5)
      // (nur Boote, die gerade losfahren: wer fest in seiner Box nahe einer Boje liegt, belegt sie nicht)
      if (o.model?.visible !== false && (o.speed ?? 0) < 0.5 && !o.moored && o.state !== 'idle' && o.state !== 'moored') {
        for (let i = 0; i < list.length; i++) if (Math.hypot(list[i].x - o.x, list[i].z - o.z) < o.info.length / 2 + 6) belegt.add(i);
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
      // nur Ankerplaetze in freiem, tiefem Wasser (nie im Gelaende oder an einem Steg)
      const mass = selbst ? bootMass(selbst.info) : { r: 3, t: 1 };
      const karteA = karteJetzt();
      const idx = plaetze.findIndex((q, i) => !anker.has(i) && (RANG[q.groesse] ?? 2) >= g && befahrbar(karteA, q.x, q.z, mass.r * 0.8, mass.t));
      if (idx >= 0) {
        const q = plaetze[idx];
        return reserviere({ id: `anker-${idx}`, x: q.x, z: q.z, heading: b.heading, kind: 'buoy', abstand: (q.schwoikreisM ?? 10) * 2, kreis: q.schwoikreisM ?? 10 });
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
    // Ausweichplatz in Ringen um die Mitte: nur in freiem, tiefem Wasser, nie an Land oder im Flachen
    const d = gross ? 60 : 20;
    const massA = selbst ? bootMass(selbst.info) : { r: 3, t: 1 };
    const karteB = karteJetzt();
    let p = ankerSlot(k, d);
    for (let n = 0, j = k; n < 240; n++, j++) {
      if (anker.has(j)) continue;
      const q = ankerSlot(j, d);
      // ausserhalb der Karte gilt befahrbar() als offenes Wasser: dort zusaetzlich die Wassertiefe des
      // Gelaendes pruefen (am Rand der Welt ist sie 0, das Boot laege sonst an Land)
      const ax = mitte.x + q.x, az = mitte.z + q.z, tiefe = game.landscape?.tiefeBei?.(ax, az) ?? 99;
      if (tiefe >= massA.t + 0.3 && befahrbar(karteB, ax, az, Math.max(massA.r, d * 0.4), massA.t)) { k = j; p = q; break; }
    }
    return reserviere({ id: `anker-${k}`, x: mitte.x + p.x, z: mitte.z + p.z, heading: b.heading, kind: 'buoy', abstand: d, kreis: gross ? 30 : 10 });
  }

  // k-ter Ankerplatz: Mitte, dann Ringe mit dem Abstand d (6, 12, 18 ... Plaetze je Ring)
  function ankerSlot(k, d) {
    if (k === 0) return { x: 0, z: 0 };
    let ring = 1, rest = k - 1;
    while (rest >= ring * 6) { rest -= ring * 6; ring++; }
    const a = (rest / (ring * 6)) * Math.PI * 2;
    return { x: Math.cos(a) * ring * d, z: Math.sin(a) * ring * d };
  }

  // info: das Boot, das an den Platz soll (nur fuer Paeckchenplaetze 'B27+' noetig, P27)
  function platzBerth(platzId, info = null) {
    if (game.sim?.istPaeckchen?.(platzId)) return game.paeckchen?.berth?.(platzId, info) ?? null;
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

  // Abfahrende Boote, die aus dem Bild sind, sind fort: nicht erst bis zum Revierrand fahren.
  // So staut sich auch bei schnellem Vorspulen ueber viele Tage nichts vor der Einfahrt.
  let fortT = 0;
  game.onTick((dt) => {
    fortT += dt;
    if (fortT < 0.5) return;
    fortT = 0;
    for (const [id, e] of [...boats]) {
      // Abreisendes Boot liegt noch in seiner Box: die Spielregeln halten sie belegt, bis es draussen
      // ist ('boat:clear' unten), sonst zeigte die Platzkarte "frei" mit Boot darin
      if (e.faehrt && inBox(e.anim)) {
        // Wer unterwegs (noch nicht fest) abreist, legt nicht ab und meldet kein 'boat:clear': die
        // Box ist frei, sobald das Boot sichtbar aus ihr heraus ist (sonst hielten die Spielregeln sie
        // bis zum Deckel von 300 s belegt, Befund Balancing P17)
        const b = e.anim.berth, L = e.anim.info.length ?? 8;
        if (!e.anim.moored && e.anim.state === 'leaving' && Math.hypot(e.anim.x - b.x, e.anim.z - b.z) > (b.length ?? L) / 2 + L * 0.8) {
          e.anim.berth = null;
          e.anim.lines.length = 0;     // halb gelegte Leinen bleiben nicht am Steg haengen
          game.emit('boot:aus-box', { id });
        } else game.emit('boot:noch-in-box', { id });
      }
      if (verwaist(id, e)) {
        // Boot ohne Auftrag, das die Spielregeln nicht mehr kennen (z. B. nach Vorspulen in den Winter
        // abgewiesen, waehrend es noch unterwegs war): beim zweiten Blick hinaus fahren lassen
        if (e.verwaist) { e.verwaist = false; faehrtWeg(id); } else e.verwaist = true;
        continue;
      }
      e.verwaist = false;
      if (!e.faehrt || e.anim.berth || e.anim.state !== 'leaving') continue;
      if (!game.boatAnim.imBild?.(e.anim.x, e.anim.z, e.anim.info.length)) entferne(id);
    }
  });
  function verwaist(id, e) {
    if (e.faehrt || e.draussen || e.anim.moored || e.anim.state !== 'idle' || e.anim.task || e.anim.tasks.length) return false;
    return !(game.sim?.boote ?? []).some((b) => b.id === id);
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

  // --- Bezahlt-Baendchen: wie im echten Hafen haengt nach dem Bezahlen ein farbiges Band am Bugkorb.
  // Die Farbe wechselt jeden Tag (so sieht der Hafenmeister auf dem Rundgang, wer fuer heute bezahlt hat).
  // Nur Gaeste; Dauerlieger haben ihren Platz fuer die Saison.
  // kein Rot und kein Gruen: die haben schon die Platzschilder (frei/belegt)
  const BAND_FARBEN = ['#ffbe0b', '#3a86ff', '#ff6fb5', '#fb8500', '#8338ec', '#00b4d8', '#f1fa3c'];
  const bandMats = BAND_FARBEN.map((c) => new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide, emissive: c, emissiveIntensity: 0.45 }));
  const stangeMat = new THREE.MeshLambertMaterial({ color: '#d9dde2' });
  const randWeiss = new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide });
  const _bv = new THREE.Vector3();
  function bandFarbe() {
    const st = game.sim?.state ?? game.state;
    const tag = st?.day ?? 1;
    return bandMats[((tag % bandMats.length) + bandMats.length) % bandMats.length];
  }
  // Hoehe des Decks am Bug: hoechster Punkt im vorderen Zehntel des Rumpfs (ohne Mast und Aufbau)
  function bugHoehe(group, L, von = 0.36, bis = 0.47, breit = 0.6, hoch = 3) {
    group.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
    let y = 0;
    group.traverse((o) => {
      const pos = o.geometry?.attributes?.position;
      if (!pos || !o.isMesh) return;
      const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
      for (let i = 0; i < pos.count; i += Math.max(1, pos.count >> 9)) {
        _bv.fromBufferAttribute(pos, i).applyMatrix4(m);
        if (_bv.x > L * von && _bv.x < L * bis && Math.abs(_bv.z) < breit && _bv.y < hoch) y = Math.max(y, _bv.y);
      }
    });
    return y || 0.8;
  }
  function baendchen(e) {
    if (e.band) return e.band;
    const L = e.anim.info.length, B = e.anim.info.beam;
    const g = new THREE.Group();
    g.name = 'bezahlt-band';
    // Gross genug fuer die normale Ansicht: Wimpel etwa ein Viertel der Bootslaenge, und hoeher als
    // alles auf dem Vorschiff (Persenning, Kajuete), damit nichts ihn verdeckt.
    const lang = clamp(L * 0.28, 1.6, 4);
    const deck = bugHoehe(e.group, L);
    const oben = Math.max(deck + 0.5, bugHoehe(e.group, L, 0.05, 0.5, B / 2, 4.5) + 0.35);
    const stab = oben - deck;
    const stange = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, stab, 5), stangeMat);
    stange.position.y = stab / 2;
    g.add(stange);
    // Wimpel: Dreieck, das vom Stab nach achtern weht, fast waagerecht, damit man es von oben sieht;
    // ein weisser Rand dahinter hebt ihn von Deck und Wasser ab
    const dreieck = (l, b) => {
      const wg = new THREE.BufferGeometry();
      wg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -b / 2, 0, 0, b / 2, -l, 0, 0], 3));
      wg.computeVertexNormals();
      return wg;
    };
    const band = new THREE.Mesh(dreieck(lang, lang * 0.45), bandFarbe());
    band.position.y = stab;
    band.rotation.x = 0.2;
    const rand = new THREE.Mesh(dreieck(lang * 1.12, lang * 0.6).translate(lang * 0.06, -0.03, 0), randWeiss);
    band.add(rand);
    g.add(band);
    g.userData.band = band;
    g.position.set(L * 0.42, deck, 0);
    g.visible = false;
    e.group.add(g);
    e.band = g;
    return g;
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  let bandT = 0;
  // Jede Aenderung in den Spielregeln (neuer Tag, Kassieren, Abrechnung) gleich im naechsten Bild pruefen.
  game.on('sim:change', () => { bandT = 1; });
  game.onTick((dt) => {
    const t = game.time;
    bandT += dt;
    const pruefen = bandT > 0.4;
    if (pruefen) bandT = 0;
    const st = game.sim?.state ?? game.state;
    for (const [id, e] of boats) {
      if (pruefen) {
        const sb = st?.boats?.[id];
        const an = wimpelAn({
          imSpiel: !!sb, dauerlieger: !!sb?.stationed, bezahlt: !!sb && !!game.sim?.istBezahlt?.(id),
          abgerechnet: !!e.abgerechnet, faehrt: !!e.faehrt, anBoje: e.anim.berth?.kind === 'buoy',
          fest: !!e.anim.moored, legtAb: e.anim.state === 'casting-off',
        });
        if (an) {
          const g = baendchen(e);
          if (!g.visible) { g.visible = true; g.userData.t0 = t; g.userData.band.material = bandFarbe(); }
        } else if (e.band) e.band.visible = false;
      }
      // im Wind flattern, beim Erscheinen kurz aufspringen
      const g = e.band;
      if (g?.visible) {
        const b = g.userData.band;
        b.rotation.y = Math.sin(t * 5 + id) * 0.25;
        b.rotation.z = -0.15 + Math.sin(t * 7.3 + id * 2) * 0.08;
        const k = Math.min(1, (t - (g.userData.t0 ?? 0)) * 4);
        g.scale.setScalar(Math.max(0.01, k * (1 + Math.max(0, 0.25 - (t - (g.userData.t0 ?? 0))) * 1.6)));
      }
    }
  });

  function entferne(id) {
    const e = boats.get(id);
    if (!e) return;
    boats.delete(id);
    // verschwindet ein Boot direkt aus seiner Box (abseits des Bildes, Laden): seine Box ist frei
    const box = inBox(e.anim);
    e.anim.remove();
    if (box) game.emit('boot:aus-box', { id });
  }
  // Liegt das Boot noch an (oder in) einer Box, nicht an Boje oder Anker?
  function inBox(anim) {
    const art = String(anim.berth?.id ?? '');
    return !!art && anim.berth.kind !== 'buoy' && !art.startsWith('boje-') && !art.startsWith('anker-');
  }

  // --- Fahrwasser: Wege, Start- und Zielpunkte aus der Karte des Gelaendes (world/fahrwasser.js) ---
  // Kein Boot faehrt durch Land, Strand, Molen oder Stege: jede Fahrt sucht ihren Weg im Raster aus
  // Wassertiefe (game.landscape.tiefeBei) und Hindernissen (Stege und Liegeplaetze aus HAFEN).
  // Grundbereich; liegt die Seebruecke (landschaft/strand.js) weiter draussen, waechst das Raster fuer
  // diese Karte bis 20 m um die Bruecke (ausserhalb gilt offenes Wasser, eine Bruecke dort waere unsichtbar).
  const BEREICH = { x0: -430.5, x1: 320, z0: -361, z1: 140 };
  function bereichMit(sb) {
    if (!sb) return BEREICH;
    const U = HAFEN.einheiten?.meterProEinheit ?? 0.62, xs = [sb.fuss[0] * U, sb.kopf[0] * U], zs = [-sb.fuss[1] * U, -sb.kopf[1] * U];
    // Zellen bleiben auf dem Gitter des Grundbereichs (sonst verschieben sich alle Abstaende leicht)
    const ab = (v, o) => o + Math.floor((v - o) / 1.5) * 1.5;
    return {
      x0: Math.min(BEREICH.x0, ab(Math.min(...xs) - 20, BEREICH.x0)), x1: Math.max(BEREICH.x1, Math.max(...xs) + 20),
      z0: Math.min(BEREICH.z0, ab(Math.min(...zs) - 20, BEREICH.z0)), z1: Math.max(BEREICH.z1, Math.max(...zs) + 20),
    };
  }
  // Einfahrt zwischen den Molen (Einbahn-Abschnitt): so viele Boote je Richtung zugleich
  const EINFAHRT_KONVOI = 6;
  // In offenem Wasser liegen die Bahnen der Ein- und der Auslaufenden so weit auseinander (Meter)
  const BAHN_ABSTAND_M = 24;
  let einfahrtNr = -1;
  let karte = null, karteSig = '', karteAlt = true, karteHindernisse = { linien: [], rechtecke: [] };
  const flaechen = new Map();         // Groessenklasse -> { r, t, sektoren }
  function karteJetzt() {
    const st = stufe();
    const ls = game.landscape;
    // Seebruecke: liegt je Form, Seed und Stufe anders und steht erst fest, wenn das Gelaende gebaut
    // ist (vorher null) - deshalb Teil der Signatur, sonst bliebe eine frueh gebaute Karte ohne Bruecke
    const sb = seebrueckeStrecke(st, (ls?.region?.id ?? ls?.region) === 'nordsee' ? 'nordsee' : 'ostsee');
    const sig = `${sb ? sb.fuss.map(Math.round).join(',') : '-'}|${st}|${ls?.stufe ?? ''}|${ls?.region ?? ''}|${game.stegbild?.aktuell?.()?.nr ?? HAFEN.stegbild?.nr ?? 0}|${game.gelaende?.aktuell?.()?.nr ?? 1}|${game.gelaende?.aktuell?.()?.seed ?? 1}`;
    if (karte && !karteAlt && sig === karteSig) return karte;
    const tiefe = ls?.tiefeBei ? (x, z) => ls.tiefeBei(x, z) : () => 3;
    const w = ls?.warteplaetze ?? {};
    const weich = [];
    for (const bj of w.bojen ?? []) weich.push({ x: bj.x, z: bj.z, r: 14, kosten: 8 });
    for (const a of w.ankerplaetze ?? []) weich.push({ x: a.x, z: a.z, r: (a.schwoikreisM ?? 8) + 4, kosten: 6 });
    // Molen samt Steinschuettung am Kopf (terrain.js: Steine bis 0,95 Breiten um den Kopf) sind hart,
    // auch wo das Gelaenderaster sie zwischen zwei Zellen verliert (Feature-Test: Bug im Molenkopf)
    const h = hindernisseAusHafen(HAFEN, st, { seebruecke: sb });
    const linien = [...(h.linien ?? [])];
    if (st >= 3) for (const m of molen(st)) {
      const pts = m.punkte.map(([px, py]) => ({ x: px * 0.62, z: -py * 0.62 }));
      const w = m.breite * 0.62;
      linien.push({ punkte: pts, breite: w * 0.9 });
      const k = pts[pts.length - 1];
      linien.push({ punkte: [k, { x: k.x + 0.01, z: k.z }], breite: 2 * (w * 0.95 + 0.9) });
    }
    karte = baueKarte({ tiefe, bereich: bereichMit(sb), ...h, linien, weich, engRadius: 5 });
    // Hafeneinfahrt zwischen den Koepfen von West- und Ostmole: Einbahn mit Konvois, Auslaufende zuerst
    einfahrtNr = -1;
    if (st >= 3) {
      const [west, ost] = molen(st);
      if (west && ost) {
        const kopf = (m) => { const [px, py] = m.punkte[m.punkte.length - 1]; return { x: px * 0.62, z: -py * 0.62 }; };
        einfahrtNr = einfahrtAlsEinbahn(karte, kopf(west), kopf(ost), 16);
      }
    }
    karteHindernisse = { linien, rechtecke: h.rechtecke ?? [] };
    karteSig = sig;
    karteAlt = false;
    flaechen.clear();
    game.boatAnim.engstellenNeu?.();
    if (einfahrtNr >= 0) game.boatAnim.engstellen?.konvoi?.set(einfahrtNr, EINFAHRT_KONVOI);
    game.emit('fahrwasser:karte', { stufe: st, engstellen: karte.eng.liste.length });
    return karte;
  }
  // Sofort neu bauen (nicht erst bei der naechsten Fahrt): laufende Fahrten planen dann neu
  let neuBauen = null;
  const karteVeraltet = () => {
    karteAlt = true;
    if (!neuBauen) neuBauen = setTimeout(() => { neuBauen = null; if (karteAlt && karte) karteJetzt(); }, 0);
  };
  game.on('stufe', karteVeraltet);
  game.on('stege', karteVeraltet);
  game.on('landschaft:geaendert', karteVeraltet);
  game.on('stegbild', karteVeraltet);

  const klasse = (info) => info.size ?? 'M';
  // Erreichbares Wasser je Bootsgroesse und die Stellen am Rand, an denen Boote ins Revier kommen
  // und es verlassen. Sektoren: Westen, Nordwesten, Norden, Nordosten, Osten (offene See am Kartenrand),
  // sonst die entfernten Enden des Binnensees.
  function flaeche(info) {
    const k = karteJetzt();
    const g = klasse(info);
    if (flaechen.has(g)) return flaechen.get(g);
    const { r, t } = bootMass(info);
    const bj = bojenPos();
    const m = bj.length ? bj[Math.floor(bj.length / 2)] : { x: 0, z: 0 };
    const ok = erreichbar(k, m.x, m.z, r, t);
    const sek = new Map();
    const add = (name, c, nx, nz) => {
      if (!sek.has(name)) sek.set(name, []);
      const p = zellMitte(k, c);
      sek.get(name).push({ x: p.x, z: p.z, nx, nz });
    };
    // Rand der Karte: dort geht das offene Wasser weiter
    for (let i = 0; i < k.nx; i++) {
      const c = i;                                     // Nordkante (j = 0)
      if (ok[c]) add(i < k.nx * 0.33 ? 'nordwest' : i < k.nx * 0.66 ? 'nord' : 'nordost', c, 0, -1);
    }
    for (let j = 0; j < k.nz; j++) {
      if (ok[j * k.nx]) add('west', j * k.nx, -1, 0);
      if (ok[j * k.nx + k.nx - 1]) add('ost', j * k.nx + k.nx - 1, 1, 0);
    }
    let see = sek.size > 0;
    if (!see) {
      // Binnensee ohne Zufahrt fuer diese Groesse: die entferntesten Ecken des erreichbaren Wassers
      const pts = [];
      for (let c = 0; c < ok.length; c += 3) if (ok[c] && k.frei[c] >= r + 2) pts.push(zellMitte(k, c));
      pts.sort((a, b) => Math.hypot(b.x - m.x, b.z - m.z) - Math.hypot(a.x - m.x, a.z - m.z));
      for (const p of pts.slice(0, Math.max(8, Math.floor(pts.length * 0.2)))) {
        const name = p.x < m.x ? 'see-west' : 'see-ost';
        if (!sek.has(name)) sek.set(name, []);
        sek.get(name).push({ x: p.x, z: p.z, nx: 0, nz: 0 });
      }
    }
    // Sektoren von Westen ueber Norden nach Osten ordnen (Herkunft 0 = Westen, 1 = Osten)
    const winkel = (l) => {
      let sx = 0, sz = 0;
      for (const p of l) { sx += p.x; sz += p.z; }
      return Math.atan2(-(sz / l.length - m.z), sx / l.length - m.x);
    };
    const sektoren = [...sek.entries()].filter(([, l]) => l.length >= 2)
      .map(([n, l]) => [n, l.sort((a, b) => (a.x - b.x) || (a.z - b.z)), winkel(l)])
      // Winkel: Osten 0, Norden pi/2, Westen pi; Suedwesten zaehlt als ganz westlich
      .map((e) => [e[0], e[1], e[2] < -Math.PI / 2 ? e[2] + 2 * Math.PI : e[2]])
      .sort((a, b) => b[2] - a[2])
      .map(([n, l]) => [n, l]);
    const f = { r, t, ok, see, sektoren };
    flaechen.set(g, f);
    return f;
  }

  // Zufaelliger Punkt am Revierrand ausserhalb des Bildes. Auf See wird vom Kartenrand weiter nach
  // aussen geschoben (dort ist nur offenes Wasser), im Binnensee eine Stelle gesucht, die man nicht sieht.
  let letzterSektor = '';
  function randPunkt(info, { meide, herkunft } = {}) {
    const f = flaeche(info);
    const L = info.length ?? 8;
    if (!f.sektoren.length) return null;
    let name, liste, anteil = null;
    if (Number.isFinite(herkunft)) {
      // Herkunft aus den Spielregeln (0 = Westen bis 1 = Osten, je Spiel anders verteilt)
      const h = Math.min(0.9999, Math.max(0, herkunft)) * f.sektoren.length;
      [name, liste] = f.sektoren[Math.floor(h)];
      anteil = h - Math.floor(h);
    } else {
      // Sektoren reihum zufaellig, nicht zweimal hintereinander derselbe
      const wahl = f.sektoren.filter(([n]) => n !== letzterSektor && n !== meide);
      [name, liste] = (wahl.length ? wahl : f.sektoren)[Math.floor(Math.random() * (wahl.length || f.sektoren.length))];
    }
    letzterSektor = name;
    for (let versuch = 0; versuch < 12; versuch++) {
      const p0 = liste[anteil != null && versuch === 0 ? Math.floor(anteil * liste.length) : Math.floor(Math.random() * liste.length)];
      const q = { x: p0.x, z: p0.z, sektor: name };
      if (p0.nx || p0.nz) {
        // hoechstens 120 m hinaus: weit herausgezoomt sieht man den Rand, dafuer kommt das Boot in vertretbarer Zeit an
        for (let i = 0; i < 8 && game.boatAnim.imBild?.(q.x, q.z, L + 6); i++) { q.x += p0.nx * 15; q.z += p0.nz * 15; }
        return q;
      }
      if (!game.boatAnim.imBild?.(q.x, q.z, L + 6)) return q;
    }
    const p0 = liste[0];
    return { x: p0.x, z: p0.z, sektor: name };
  }

  // Startpunkt, an dem gerade kein anderes Boot ist (mehrere kommen oft kurz nacheinander)
  function freierStart(info, herkunft) {
    const L = info.length ?? 8;
    const k = karteJetzt();
    const f = flaeche(info);
    const frei = (p) => game.boatAnim.boats.every((o) => Math.hypot(o.x - p.x, o.z - p.z) > (L + o.info.length) / 2 + 8);
    for (let n = 0; n < 6; n++) {
      const p = randPunkt(info, { herkunft: n === 0 ? herkunft : undefined });
      if (!p) break;
      // entlang des Rands ausweichen, nur auf befahrbares Wasser
      for (const d of [0, 1, -1, 2, -2, 3, -3]) {
        const q = { x: p.x + (Math.abs(p.z - k.z0) < 1e3 && p.z < k.z0 ? d * 20 : 0), z: p.z + (p.z >= k.z0 ? d * 20 : 0) };
        if (!befahrbar(k, q.x, q.z, f.r, f.t)) continue;
        if (frei(q)) return q;
      }
    }
    return randPunkt(info) ?? { x: 0, z: 0 };
  }

  // Weg fuer boat-anim: wird erst beim Losfahren berechnet (PathTask mit route)
  game.boatAnim.setFrei?.((x, z, r, t = 0) => befahrbar(karteJetzt(), x, z, r, t));
  game.boatAnim.setSicht?.((a, b, r, t = 0) => sichtlinie(karteJetzt(), a, b, r, t));
  game.boatAnim.setRouter?.((boot, ziel, opts) => {
    const k = karteJetzt();
    const { r, t } = bootMass(boot.info);
    const rechts = typeof opts === 'object' && opts.rechts != null ? opts.rechts : Math.min(3, r);
    const { rMin } = bootMass(boot.info);
    // Wer selbst an Boje oder Anker will, faehrt um die Boote herum, die dort schon liegen (und wer
    // dort wartet), statt durch das Ankerfeld hindurch. Nur fuer diese Fahrten: Ein- und Auslaufende
    // im Fahrwasser drueckte das an die Kanten und in den Gegenverkehr (Zeitraffer: doppelt so viele Staus).
    const boote = [];
    if (boot.state === 'docking' && boot.berth?.kind === 'buoy') for (const o of game.boatAnim.boats) {
      if (o === boot || o.model.visible === false) continue;
      const liegt = (o.moored && o.berth?.kind === 'buoy') || o.state === 'waiting';
      if (liegt) boote.push({ x: o.x, z: o.z, r: o.info.length / 2 + 1 });
    }
    return route(k, { x: boot.x, z: boot.z }, ziel, { r, rMin, t, rechts, rechtsWeit: BAHN_ABSTAND_M / 2, boote });
  });

  // Fuer andere Module (Besuchsschiffe der Services, Tests): Wege und freie Punkte in Weltmetern
  game.fahrwasser = {
    get karte() { return karteJetzt(); },
    weg: (von, nach, { breiteM = 6, tiefgangM = 2, rechtsM } = {}) => {
      const r = breiteM / 2 + 1.5;
      return route(karteJetzt(), von, nach, { r, rMin: breiteM / 2 + 0.4, t: tiefgangM + 0.3, rechts: rechtsM ?? Math.min(3, r) });
    },
    befahrbar: (x, z, radiusM = 2, tiefgangM = 0) => befahrbar(karteJetzt(), x, z, radiusM, tiefgangM),
    randPunkt: (info) => randPunkt(info),
    seeWeg: (von, o) => seeWeg(von, o),
    // Freies Wasser rund um (x, z) in Metern bei mindestens tiefgangM Tiefe: Stege, Molen und Ufer aus der
    // Karte, weiter draussen das Gelaende (grobes Raster). Fuer Wendeplaetze grosser Schiffe.
    freiRadius: (x, z, tiefgangM = 2) => freiRadius(x, z, tiefgangM),
    // Zum Pruefen: Stellen, an denen ein Rumpf L x B auf diesem Weg (Bug und Heck auf dem Weg) Land beruehrt
    rumpfAnLand: (weg, L, B, tiefgangM = 3) => { const g = grobRaster(); return rumpfAnLand(weg, L, B, g, grobAbstand(g, tiefgangM)); },
    vorbeiWeg: (info) => vorbeiWeg(info),
  };

  // --- Wege fuer Kulisse und Besuchsschiffe (render/boats/verkehr.js, render/services-besuch.js) ---
  // Alles aus der Karte: kein fester Punkt auf See, damit jede Gelaendeform (auch aus Seed) passt.
  // Masse: hart = Rumpf plus Rand (darf nie unterschritten werden), weich = Wunschabstand (bootMass).
  function masse(info) {
    const m = bootMass(info);
    const B = info.beam ?? (info.length ?? 6) * 0.33;
    return { r: m.r, hart: Math.min(m.r, B / 2 + ({ S: 1, M: 1.2, L: 1.5, XL: 2.5, XXL: 3.5 }[info.size] ?? 1.5)), t: m.t };
  }
  // Randzellen der Karte in einer befahrbaren Flaeche, mit Richtung nach draussen
  function randZellen(k, ok) {
    const out = [];
    for (let i = 0; i < k.nx; i += 2) {
      if (ok[i]) out.push({ c: i, nx: 0, nz: -1 });
      const u = (k.nz - 1) * k.nx + i;
      if (ok[u]) out.push({ c: u, nx: 0, nz: 1 });
    }
    for (let j = 0; j < k.nz; j += 2) {
      if (ok[j * k.nx]) out.push({ c: j * k.nx, nx: -1, nz: 0 });
      if (ok[j * k.nx + k.nx - 1]) out.push({ c: j * k.nx + k.nx - 1, nx: 1, nz: 0 });
    }
    return out.map((e) => ({ ...zellMitte(k, e.c), nx: e.nx, nz: e.nz }));
  }
  // Vom Kartenrand weiter hinaus, bis man es nicht mehr sieht (hoechstens 24 Schritte zu 15 m).
  // Nur ueber Wasser mit mindestens t Tiefe (ausserhalb der Karte kennt nur das Gelaende die Tiefe).
  // B: Rumpfbreite. Geprueft wird die ganze Breite (plus 1 m), nicht nur die Mittellinie: Ein 13 m
  // breites Schiff streifte sonst eine Sandbank neben seinem Kurs (Haertetest 15.11., Korvette).
  // Der Kurs folgt dem tiefen Wasser bis 60 Grad schraeg zum Rand (schraeges Seegatt im Bodden),
  // bleibt aber immer nach draussen gerichtet.
  // Ergebnis: Punkte nach p (ohne p); leer, wenn es von p aus nicht weitergeht.
  function hinaus(p, L, t = 1, B = 0) {
    const h = B > 0 ? B / 2 + 1 : 0;
    const tief1 = (x, z) => (game.landscape?.tiefeBei?.(x, z) ?? 99) >= t;
    const frei = (x, z, ux, uz) => tief1(x, z) && (!h || (tief1(x - uz * h, z + ux * h) && tief1(x + uz * h, z - ux * h)));
    if (!(p.nx || p.nz)) return [];
    const out = [];
    let q = { x: p.x, z: p.z }, ux = p.nx, uz = p.nz;
    for (let i = 0; i < 24 && game.boatAnim.imBild?.(q.x, q.z, L + 6); i++) {
      // Erst ein Kurs, auf dem auch der Bug (halbe Laenge voraus) im tiefen Wasser liegt, sonst kuerzer
      let kurs = null;
      for (const bug of [L / 2, L / 4, 0]) {
        for (const w of [0, 20, -20, 40, -40, 60, -60]) {
          const a = w * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
          const vx = ux * c - uz * s, vz = ux * s + uz * c;
          if (vx * p.nx + vz * p.nz < 0.45) continue;
          if (!frei(q.x + vx * 7.5, q.z + vz * 7.5, vx, vz)) continue;
          let ok = true;
          for (let d = 15; ok && d <= 15 + bug + 0.1; d += 8) ok = frei(q.x + vx * d, q.z + vz * d, vx, vz);
          if (ok) { kurs = [vx, vz]; break; }
        }
        if (kurs) break;
      }
      if (!kurs) break;
      [ux, uz] = kurs;
      q = { x: q.x + ux * 15, z: q.z + uz * 15 };
      out.push(q);
    }
    return out;
  }
  // Kuerzt den Weg ab Index ab: laesst Ecken aus, wo die gerade Linie samt Rumpfbreite (plus 1 m) im
  // tiefen Wasser liegt. Nur am Ende des Wegs (Kartenrand und draussen, weit weg von Stegen, die das
  // Gelaende nicht kennt). Sonst fuhr die Korvette im Bodden erst in die Ecke am Kartenrand und streifte
  // dort das Ufer, bevor sie ins Seegatt drehte.
  function eckenKappen(weg, ab, t, B) {
    const h = B / 2 + 1;
    const tief1 = (x, z) => (game.landscape?.tiefeBei?.(x, z) ?? 99) >= t;
    const linieFrei = (a, b) => {
      const d = Math.hypot(b.x - a.x, b.z - a.z);
      if (d < 1) return true;
      const ux = (b.x - a.x) / d, uz = (b.z - a.z) / d;
      for (let s = 0; s <= d; s += 4) {
        const x = a.x + ux * s, z = a.z + uz * s;
        if (!tief1(x, z) || !tief1(x - uz * h, z + ux * h) || !tief1(x + uz * h, z - ux * h)) return false;
      }
      return true;
    };
    const out = weg.slice(0, ab + 1);
    let i = ab;
    while (i < weg.length - 1) {
      let j = Math.min(weg.length - 1, i + 6);
      while (j > i + 1 && !linieFrei(weg[i], weg[j])) j--;
      out.push(weg[j]);
      i = j;
    }
    return out;
  }
  // Liegeplaetze der Stufe in Weltmetern (Vorbeifahrer bleiben davon weg)
  function plaetzeWelt() {
    const st = String(stufe());
    const U = HAFEN.einheiten?.meterProEinheit ?? 0.62;
    const out = [];
    for (const p of HAFEN.plaetze ?? []) {
      const l = p.lage?.[st];
      if (l) out.push({ x: l[0] * U, z: -l[1] * U });
    }
    return out;
  }

  /**
   * Weg von einem Punkt im Revier hinaus auf See, ausserhalb des Bildes.
   * o: { breiteM, laengeM, tiefgangM, groesse, nahBei: {x, z} (bevorzugter Ausgang, z. B. der alte Seepunkt) }
   * Ergebnis: Punkte ab von (ohne von) bis draussen, oder null, wenn kein Rand erreichbar ist.
   */
  const seeWegCache = new Map();
  function seeWeg(von, o = {}) {
    const k = karteJetzt();
    const info = { size: o.groesse ?? 'XL', beam: o.breiteM ?? 8, length: o.laengeM ?? 30, draft: o.tiefgangM ?? 2 };
    const key = `${karteSig}|${von.x.toFixed(1)}|${von.z.toFixed(1)}|${info.size}|${info.beam}|${info.length}|${info.draft}|${o.nahBei ? `${o.nahBei.x.toFixed(0)},${o.nahBei.z.toFixed(0)}` : ''}`;
    if (seeWegCache.has(key)) return seeWegCache.get(key)?.map((p) => ({ ...p })) ?? null;
    if (seeWegCache.size > 64) seeWegCache.clear();
    const m = masse(info);
    // Grosse Schiffe (Besuche der Services): ganzer Weg bis hinter den Aussenring ueber das grobe Raster,
    // unabhaengig von der Kamera. Der alte Weg (Kartenrand und ein Stueck hinaus) bleibt Rueckfall.
    let erg = grosserSeeweg(von, info, m);
    if (erg) { seeWegCache.set(key, erg); return erg.map((p) => ({ ...p })); }
    for (const t of [m.t, Math.min(m.t, 2.5)]) {
      const ok = erreichbar(k, von.x, von.z, m.hart, t);
      const rand = randZellen(k, ok);
      if (!rand.length) continue;
      const ziel = o.nahBei ?? von;
      rand.sort((a, b) => Math.hypot(a.x - ziel.x, a.z - ziel.z) - Math.hypot(b.x - ziel.x, b.z - ziel.z));
      // Lieber ein Ausgang, hinter dem das ganze Schiff frei aus dem Bild kommt; sonst der, hinter dem
      // es am weitesten im tiefen Wasser hinaus kommt (nicht am Kartenrand stehen bleiben)
      let notfall = null, notfallN = -1;
      // die naechsten Ausgaenge und dazu welche rundum verteilt (der alte Seepunkt kann in einer Bucht liegen)
      const weit = rand.slice(10);
      const wahl = [...rand.slice(0, 10), ...Array.from({ length: Math.min(10, weit.length) }, (_, i) => weit[Math.floor(i * weit.length / Math.min(10, weit.length))])];
      for (const p of wahl) {
        const w = route(k, von, p, { r: m.r, rMin: m.hart, t, rechts: 0, flachErlaubt: false });
        if (!w.ok || !w.amZiel) continue;
        const raus = hinaus(p, info.length, t, info.beam);
        const weg = eckenKappen([...w.punkte, ...raus], Math.max(0, w.punkte.length - 3), t, info.beam);
        const ende = weg[weg.length - 1];
        if (game.boatAnim.imBild?.(ende.x, ende.z, info.length + 6)) {
          if (raus.length > notfallN) { notfall = weg; notfallN = raus.length; }
          continue;
        }
        erg = weg;
        break;
      }
      erg ??= notfall;
      if (erg) break;
    }
    seeWegCache.set(key, erg);
    return erg?.map((p) => ({ ...p })) ?? null;
  }

  // --- Grosse Schiffe nach See (Paket P84) ---
  // Die Fahrwasserkarte endet kurz hinter dem Hafen. Dahinter kennt nur das Gelaende die Tiefe. Fuer
  // Kreuzfahrtschiff, Korvette, Minenjagdboot, Traditionssegler und Ausflugsschiff sucht ein grobes
  // Raster (8 m) ueber den ganzen Aussenring (game.gelaende.aussenRect) den Weg bis an dessen Rand,
  // also weit hinter jede Zoomstufe. Im Raster zaehlt der Abstand zum Ufer (Rumpfbreite plus Rand,
  // lieber ein Viertel der Laenge, damit ein 180 m Schiff nicht am Ufer entlang schrammt); innerhalb
  // der Fahrwasserkarte entscheidet wie bisher die Karte (Stege, Molen, Pier).
  // Vorher (Haertetest 15.11., P84): der Weg endete am Kartenrand, wo die Kamera gerade hinsah, das
  // Schiff drehte dort quer, streifte im Bodden-Seegatt das Ufer und verschwand mitten im Bild.
  let grob = null;
  function grobRaster() {
    const sig = `${karteSig}|${game.landscape?.stufe ?? ''}`;
    if (grob?.sig === sig) return grob;
    const r = game.gelaende?.aussenRect?.() ?? { minX: -992, maxX: 992, minZ: -868, maxZ: 992 };
    const G = 8, x0 = r.minX, z0 = r.minZ;
    const nx = Math.max(2, Math.floor((r.maxX - r.minX) / G) + 1), nz = Math.max(2, Math.floor((r.maxZ - r.minZ) / G) + 1);
    const tiefe = new Float32Array(nx * nz);
    const tb = game.landscape?.tiefeBei;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) tiefe[j * nx + i] = tb ? tb(x0 + i * G, z0 + j * G) : 99;
    // Kleine Sandinseln und Steine (Watt, Schaeren) fallen durch ein 8-m-Raster. Wo es in der Naehe
    // flacher als 8 m ist, darum vier Proben mehr je Zelle und die flachste zaehlt.
    if (tb) {
      const nah = new Uint8Array(nx * nz);
      for (let j = 1; j < nz - 1; j++) for (let i = 1; i < nx - 1; i++) {
        const c = j * nx + i;
        if (tiefe[c] < 8 || tiefe[c - 1] < 8 || tiefe[c + 1] < 8 || tiefe[c - nx] < 8 || tiefe[c + nx] < 8) nah[c] = 1;
      }
      const o = G / 3;
      for (let c = 0; c < nah.length; c++) {
        if (!nah[c] || tiefe[c] <= 0) continue;
        const x = x0 + (c % nx) * G, z = z0 + Math.floor(c / nx) * G;
        tiefe[c] = Math.min(tiefe[c], tb(x - o, z - o), tb(x + o, z - o), tb(x - o, z + o), tb(x + o, z + o));
      }
    }
    grob = { sig, G, x0, z0, nx, nz, tiefe, abst: new Map() };
    return grob;
  }
  // Abstand jeder Rasterzelle zur naechsten Stelle flacher als t, in Metern (Chamfer wie die Karte)
  function grobAbstand(g, t) {
    const key = t.toFixed(1);
    if (g.abst.has(key)) return g.abst.get(key);
    const { nx, nz } = g, d = new Float32Array(nx * nz), S = Math.SQRT2;
    for (let c = 0; c < d.length; c++) d[c] = g.tiefe[c] < t ? 0 : 1e9;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const c = j * nx + i; let v = d[c];
      if (!v) continue;
      if (i > 0) v = Math.min(v, d[c - 1] + 1);
      if (j > 0) { v = Math.min(v, d[c - nx] + 1); if (i > 0) v = Math.min(v, d[c - nx - 1] + S); if (i < nx - 1) v = Math.min(v, d[c - nx + 1] + S); }
      d[c] = v;
    }
    for (let j = nz - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) {
      const c = j * nx + i; let v = d[c];
      if (!v) continue;
      if (i < nx - 1) v = Math.min(v, d[c + 1] + 1);
      if (j < nz - 1) { v = Math.min(v, d[c + nx] + 1); if (i < nx - 1) v = Math.min(v, d[c + nx + 1] + S); if (i > 0) v = Math.min(v, d[c + nx - 1] + S); }
      d[c] = v;
    }
    // Rasterpunkt zu Uferkante: eine halbe Zelle abziehen (das Ufer liegt irgendwo zwischen zwei Punkten)
    for (let c = 0; c < d.length; c++) d[c] = d[c] >= 1e9 ? 999 : Math.max(0, (d[c] - 0.5) * g.G);
    g.abst.set(key, d);
    return d;
  }
  function freiRadius(x, z, t) {
    const g = grobRaster(), a = grobAbstand(g, t);
    const i = Math.round((x - g.x0) / g.G), j = Math.round((z - g.z0) / g.G);
    const grobR = i < 0 || j < 0 || i >= g.nx || j >= g.nz ? 999 : a[j * g.nx + i];
    return Math.min(grobR, freiBei(karteJetzt(), x, z));
  }
  function grosserSeeweg(von, info, m) {
    if (!game.landscape?.tiefeBei || !game.gelaende?.aussenRect) return null;
    const g = grobRaster();
    const B = info.beam ?? 8;
    const t = m.t;
    const abst = grobAbstand(g, t);
    // hart: Rumpf plus Rand (Rasterfehler eingerechnet); wunsch: so weit weg vom Ufer faehrt es lieber.
    // Erst mit vollem Rand, sonst knapper (enge Seegatts): lieber knapp als gar kein Weg
    // Danach den ganzen Rumpf entlang des Wegs nachrechnen (wie services-besuch.js ihn faehrt: Bug und
    // Heck auf dem Weg). Beruehrt er irgendwo Land, die Stelle sperren und neu suchen (hoechstens viermal),
    // sonst bleibt der Weg mit den wenigsten Beruehrungen.
    const L = info.length ?? 30;
    // Wartebojen und Ankerplaetze (dort liegen wartende Boote) umfahren, wie der Durchgangsverkehr in
    // verkehr.js; nur wenn es so gar keinen Weg gibt, ohne sie
    const wp = game.landscape?.warteplaetze ?? {};
    const warte = [
      ...(wp.bojen ?? []).map((b) => ({ x: b.x, z: b.z, r: 10 + B / 2 })),
      ...(wp.ankerplaetze ?? []).map((a) => ({ x: a.x, z: a.z, r: (a.schwoikreisM ?? 8) + 4 + B / 2 })),
    ].filter((q) => Math.hypot(q.x - von.x, q.z - von.z) > q.r + Math.max(24, B * 1.5));
    // Mit Wartebojen nur kurz suchen und nur einen Weg ohne Beruehrung nehmen (sonst kostet es im engen
    // Bodden viele Sekunden), danach wie bisher ohne sie
    for (const [rand, basis] of [[2 + g.G / 2, warte], [2, warte], [2 + g.G / 2, []], [2, []], [0.5, []]]) {
      const sperren = [...basis];
      const mitWarte = basis.length > 0;
      let best = null, bestN = Infinity;
      for (let versuch = 0; versuch < (mitWarte ? 2 : 5); versuch++) {
        const w = grosserSeewegMit(von, info, m, g, abst, t, B / 2 + rand, sperren);
        if (!w) break;
        const an = rumpfAnLand([{ x: von.x, z: von.z }, ...w], L, B, g, abst);
        if (an.length < bestN) { best = w; bestN = an.length; }
        if (!an.length) break;
        // Erst den Weg an diesen Stellen seitlich vom Land wegruecken (enge Durchfahrt zwischen zwei
        // Sandbaenken), sonst die Stelle sperren und einen anderen Weg suchen
        let w2 = [{ x: von.x, z: von.z }, ...w];
        for (let r = 0; r < 6; r++) {
          const an2 = rumpfAnLand(w2, L, B, g, abst);
          if (an2.length < bestN) { best = w2.slice(1); bestN = an2.length; }
          if (!an2.length) break;
          w2 = abruecken(w2, an2, L, B, g, abst, t);
        }
        if (!bestN) break;
        for (const p of an.slice(0, 6)) sperren.push({ x: p.x, z: p.z, r: 12 });
      }
      if (best && (!mitWarte || bestN === 0)) return best;
    }
    return null;
  }
  // Weg seitlich von Beruehrungsstellen wegruecken (weich ueber eine Schiffslaenge auslaufend); ein Punkt
  // rueckt nur dorthin, wo das Wasser tief genug ist
  function abruecken(weg, an, L, B, g, abst, t) {
    const lang = [0];
    for (let i = 1; i < weg.length; i++) lang.push(lang[i - 1] + Math.hypot(weg[i].x - weg[i - 1].x, weg[i].z - weg[i - 1].z));
    const schub = weg.map(() => ({ x: 0, z: 0, n: 0 }));
    for (const c of an) {
      const fehlt = B / 2 + 3 - Math.abs(c.v);
      if (fehlt <= 0) continue;
      const s = c.v > 0 ? -1 : 1;
      for (let i = 1; i < weg.length - 1; i++) {
        const d = Math.abs(lang[i] - c.m);
        if (d > L / 2) continue;
        const w = 0.5 * (1 + Math.cos(Math.PI * d / (L / 2)));
        const sx = c.nx * s * fehlt * w, sz = c.nz * s * fehlt * w;
        if (Math.hypot(sx, sz) > Math.hypot(schub[i].x, schub[i].z)) schub[i] = { x: sx, z: sz };
      }
    }
    return weg.map((p, i) => {
      const q = { x: p.x + schub[i].x, z: p.z + schub[i].z };
      if (q.x === p.x && q.z === p.z) return p;
      const ii = Math.round((q.x - g.x0) / g.G), jj = Math.round((q.z - g.z0) / g.G);
      const tief = game.landscape.tiefeBei(q.x, q.z) >= t && (ii < 0 || jj < 0 || ii >= g.nx || jj >= g.nz || abst[jj * g.nx + ii] > 0);
      return tief ? q : p;
    });
  }
  // Stellen, an denen ein Rumpf L x B, der mit Bug und Heck auf dem Weg faehrt, Land beruehrt
  function rumpfAnLand(weg, L, B, g, abst) {
    // Tiefe auf 1 m gerundet zwischenspeichern: die vielen Versuche eines Wegs fragen fast dieselben
    // Stellen (im Bodden dauerte ein Seeweg sonst rund 10 s, jetzt unter 1 s)
    const roh = game.landscape.tiefeBei, cache = (g.tiefeCache ||= new Map());
    const tb = (x, z) => {
      const xi = Math.round(x), zi = Math.round(z), key = (xi + 4096) * 8192 + (zi + 4096);
      let v = cache.get(key);
      if (v === undefined) { v = roh(xi, zi); cache.set(key, v); }
      return v;
    };
    const lang = [0];
    for (let i = 1; i < weg.length; i++) lang.push(lang[i - 1] + Math.hypot(weg[i].x - weg[i - 1].x, weg[i].z - weg[i - 1].z));
    const ges = lang[lang.length - 1];
    const bei = (m) => {
      m = Math.max(0, Math.min(ges, m));
      let i = 1;
      while (i < weg.length - 1 && lang[i] < m) i++;
      const d = lang[i] - lang[i - 1] || 1, k = (m - lang[i - 1]) / d;
      return { x: weg[i - 1].x + (weg[i].x - weg[i - 1].x) * k, z: weg[i - 1].z + (weg[i].z - weg[i - 1].z) * k };
    };
    const out = [];
    for (let m = 0; m <= ges; m += 4) {
      const a = bei(m - L / 2), b = bei(m + L / 2), p = bei(m);
      const d = Math.hypot(b.x - a.x, b.z - a.z) || 1, fx = (b.x - a.x) / d, fz = (b.z - a.z) / d;
      const f = Math.max(0, Math.min(1, (Math.min(m, ges - m) - L / 2) / (L / 2)));
      const cx = p.x + ((a.x + b.x) / 2 - p.x) * 0.5 * f, cz = p.z + ((a.z + b.z) / 2 - p.z) * 0.5 * f;
      // weit weg von allem Flachen: nichts zu pruefen (das spart fast alle Proben)
      const i = Math.round((cx - g.x0) / g.G), j = Math.round((cz - g.z0) / g.G);
      if (i >= 0 && j >= 0 && i < g.nx && j < g.nz && abst[j * g.nx + i] > L / 2 + B) continue;
      // Rumpf alle 3 m in beide Richtungen (kleine Sandinseln sind kaum groesser)
      const nu = Math.ceil(L / 3), nv = Math.max(1, Math.ceil(B / 3));
      let fund = null;
      for (let iu = 0; iu <= nu && !fund; iu++) for (let iv = 0; iv <= nv; iv++) {
        const u = (iu / nu - 0.5) * L, v = (iv / nv - 0.5) * B;
        const x = cx + fx * u - fz * v, z = cz + fz * u + fx * v;
        // nur dort genau nachsehen, wo das Raster flaches Wasser in der Naehe kennt
        const ii = Math.round((x - g.x0) / g.G), jj = Math.round((z - g.z0) / g.G);
        if (ii >= 0 && jj >= 0 && ii < g.nx && jj < g.nz && abst[jj * g.nx + ii] > 1.5 * g.G) continue;
        if (tb(x, z) < 0.5) { fund = { x, z }; break; }
      }
      if (fund) {
        // wie weit seitlich von der Rumpfmitte (positiv: links in Fahrtrichtung)
        const v = (fund.x - cx) * -fz + (fund.z - cz) * fx;
        out.push({ ...fund, m, v, nx: -fz, nz: fx });
      }
    }
    return out;
  }
  function grosserSeewegMit(von, info, m, g, abst, t, hartGrob, sperren = []) {
    const k = karteJetzt();
    const L = info.length ?? 30, B = info.beam ?? 8;
    const { nx, nz, G } = g;
    const hart = m.hart, wunsch = B / 2 + L / 4 + G;
    const inKarte = (x, z) => x > k.x0 + 2 && x < k.x1 - 2 && z > k.z0 + 2 && z < k.z1 - 2;
    const zelleX = (c) => g.x0 + (c % nx) * G, zelleZ = (c) => g.z0 + Math.floor(c / nx) * G;
    const frei = (x, z) => {
      if (inKarte(x, z)) return befahrbar(k, x, z, hart, t);
      const i = Math.round((x - g.x0) / G), j = Math.round((z - g.z0) / G);
      if (i < 0 || j < 0 || i >= nx || j >= nz) return true;
      return abst[j * nx + i] >= hartGrob;
    };
    const i0 = Math.round((von.x - g.x0) / G), j0 = Math.round((von.z - g.z0) / G);
    if (i0 < 1 || j0 < 1 || i0 >= nx - 1 || j0 >= nz - 1) return null;
    // Die ersten Meter vom Liegeplatz weg duerfen durch das eigene Schiff (Hindernis in der Karte), das
    // Wasser muss trotzdem tief genug sein
    const nahStart = (x, z) => Math.hypot(x - von.x, z - von.z) < Math.max(24, B * 1.5);
    const n = nx * nz;
    const ok = new Uint8Array(n);
    // Platz je Zelle fuer die Kosten: draussen Abstand zum Ufer, in der Karte auch zu Stegen, Molen, Pier
    const platz = new Float32Array(n);
    for (let c = 0; c < n; c++) {
      const x = zelleX(c), z = zelleZ(c);
      platz[c] = inKarte(x, z) ? Math.min(abst[c], freiBei(k, x, z)) : abst[c];
      if (nahStart(x, z)) ok[c] = g.tiefe[c] >= t ? 1 : 0;
      else ok[c] = frei(x, z) && !sperren.some((q) => Math.hypot(q.x - x, q.z - z) < q.r) ? 1 : 0;
    }
    // Dijkstra vom Start zum Rand des Rasters (dort ist offene See, weit hinter jeder Zoomstufe)
    const dist = new Float64Array(n).fill(Infinity), vor = new Int32Array(n).fill(-1);
    const halde = [];
    const push = (d, c) => { halde.push([d, c]); let i = halde.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (halde[p][0] <= halde[i][0]) break; [halde[p], halde[i]] = [halde[i], halde[p]]; i = p; } };
    const pop = () => { const top = halde[0], last = halde.pop(); if (halde.length) { halde[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let mm = i; if (l < halde.length && halde[l][0] < halde[mm][0]) mm = l; if (r < halde.length && halde[r][0] < halde[mm][0]) mm = r; if (mm === i) break; [halde[mm], halde[i]] = [halde[i], halde[mm]]; i = mm; } } return top; };
    const c0 = j0 * nx + i0;
    ok[c0] = 1; dist[c0] = 0; push(0, c0);
    const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
    let ziel = -1;
    while (halde.length) {
      const [d, c] = pop();
      if (d > dist[c]) continue;
      const i = c % nx, j = (c - i) / nx;
      if (i === 0 || j === 0 || i === nx - 1 || j === nz - 1) { ziel = c; break; }
      for (const [di, dj, w] of NB) {
        const q = (j + dj) * nx + i + di;
        if (!ok[q]) continue;
        // naeher am Ufer als gewuenscht kostet mehr: das Schiff haelt sich in der Mitte des Fahrwassers
        const nah = Math.max(0, wunsch - platz[q]) / wunsch;
        const dq = d + w * (1 + 30 * nah * nah);
        if (dq >= dist[q]) continue;
        dist[q] = dq; vor[q] = c; push(dq, q);
      }
    }
    if (ziel < 0) return null;
    const roh = [];
    for (let c = ziel; c >= 0 && c !== c0; c = vor[c]) roh.push({ x: zelleX(c), z: zelleZ(c) });
    roh.reverse();
    // Glaetten: Ein langes Schiff braucht einen Weg ohne Knicke. Bug und Heck liegen auf dem Weg
    // (services-besuch.js sehne), an einem Knick schwenkt die Mitte weit nach innen. Darum alle 4 m ein
    // Punkt und dann mehrmals gleitender Mittelwert ueber eine Schiffslaenge; wo ein Punkt dabei zu nah
    // an Ufer, Steg oder Mole kaeme, bleibt er, wo er war. Anfang (Liegeplatz) und Ende bleiben fest.
    const roh4 = [];
    const pts = [{ x: von.x, z: von.z }, ...roh];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.round(d / 4));
      for (let q = i === 1 ? 0 : 1; q <= n; q++) roh4.push({ x: a.x + (b.x - a.x) * q / n, z: a.z + (b.z - a.z) * q / n });
    }
    // in der Karte 2 m mehr Rand als beim Suchen: in der Kurve rueckt die Rumpfmitte nach innen
    const ok1 = (p) => nahStart(p.x, p.z) || (inKarte(p.x, p.z) ? befahrbar(k, p.x, p.z, hart + 2, t) : frei(p.x, p.z));
    const h = Math.max(3, Math.round(Math.max(L, 40) / 8));
    let glatt = roh4;
    // lange Schiffe oefter: ihre Kurven muessen weiter ausholen
    for (let runde = 0, n = 6 + Math.round(L / 30); runde < n; runde++) {
      const neu = glatt.map((p, i) => {
        if (i === 0 || i === glatt.length - 1) return p;
        const a = Math.max(0, i - h), b = Math.min(glatt.length - 1, i + h);
        let sx = 0, sz = 0;
        for (let j = a; j <= b; j++) { sx += glatt[j].x; sz += glatt[j].z; }
        const q = { x: sx / (b - a + 1), z: sz / (b - a + 1) };
        // geht der ganze Schritt nicht, dann ein Teil davon (sonst bleiben Stufen aus dem Raster stehen)
        for (const f of [1, 0.6, 0.3]) {
          const r = { x: p.x + (q.x - p.x) * f, z: p.z + (q.z - p.z) * f };
          if (ok1(r)) return r;
        }
        return p;
      });
      glatt = neu;
    }
    // Ausduennen: Punkte weglassen, die fast auf der Linie liegen (unter 0,3 m daneben)
    const out = [];
    let a = 0;
    while (a < glatt.length - 1) {
      let b = a + 1;
      while (b + 1 < glatt.length && b - a < 25) {
        const p = glatt[a], q = glatt[b + 1], d = Math.hypot(q.x - p.x, q.z - p.z) || 1;
        let ok = true;
        for (let j = a + 1; j <= b && ok; j++) ok = Math.abs((glatt[j].x - p.x) * (q.z - p.z) - (glatt[j].z - p.z) * (q.x - p.x)) / d < 0.3;
        if (!ok) break;
        b++;
      }
      out.push(glatt[b]);
      a = b;
    }
    // Zum Schluss noch eine Schiffslaenge geradeaus weiter hinaus (ganz aus dem Aussenring)
    if (out.length >= 2) {
      const p = out[out.length - 1], q = out[out.length - 2], d = Math.hypot(p.x - q.x, p.z - q.z) || 1;
      out.push({ x: p.x + (p.x - q.x) / d * L, z: p.z + (p.z - q.z) / d * L });
    }
    return out;
  }

  /**
   * Weg eines Vorbeifahrers: von einem Rand der Karte zu einem anderen, ueber offenes Wasser,
   * mit Abstand zu allen Liegeplaetzen. Ergebnis { start, punkte } oder null.
   */
  function vorbeiWeg(info) {
    const k = karteJetzt();
    // Randabschnitte, die mit dem Hafen verbunden sind (fuer ein kleines Boot); ob das grosse Schiff
    // durchpasst, entscheidet die Wegsuche mit seinem eigenen Mass
    const f = flaeche({ size: 'S', length: 7, beam: 2.5, draft: 1 });
    // Die See im Spiel ist am Kartenrand 5 bis 7 m tief: grosse Schiffe rechnen hoechstens mit 4,5 m
    const m0 = masse(info), m = { ...m0, t: Math.min(m0.t, 4.5) };
    const sek = f.sektoren.filter(([n]) => !n.startsWith('see-'));
    if (sek.length < 2) return null;
    const plaetze = plaetzeWelt();
    const nah = (p, d) => plaetze.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < d);
    const L = info.length ?? 8;
    for (let versuch = 0; versuch < 10; versuch++) {
      const i = Math.floor(Math.random() * sek.length);
      let j = Math.floor(Math.random() * (sek.length - 1));
      if (j >= i) j++;
      const a = sek[i][1][Math.floor(Math.random() * sek[i][1].length)];
      const b = sek[j][1][Math.floor(Math.random() * sek[j][1].length)];
      if (Math.hypot(a.x - b.x, a.z - b.z) < 150) continue;
      if (!befahrbar(k, a.x, a.z, m.hart, m.t) || !befahrbar(k, b.x, b.z, m.hart, m.t)) continue;
      const w = route(k, a, b, { r: m.r + 4, rMin: m.hart, t: m.t, rechts: Math.min(4, m.r), flachErlaubt: false });
      if (!w.ok || !w.amZiel) continue;
      // Abstand zu den Liegeplaetzen: Vorbeifahrer fahren nicht durch den Hafen
      const abstand = 25 + L * 0.3;
      if (w.punkte.some((p) => nah(p, abstand))) continue;
      const pts = [];
      for (let n = 1; n < w.punkte.length; n++) {
        const p = w.punkte[n - 1], q = w.punkte[n];
        const d = Math.hypot(q.x - p.x, q.z - p.z), st = Math.ceil(d / 6);
        for (let s = 1; s <= st; s++) pts.push({ x: p.x + (q.x - p.x) * s / st, z: p.z + (q.z - p.z) * s / st });
      }
      if (pts.some((p) => nah(p, abstand))) continue;
      const rein = hinaus(a, L, m.t, info.beam).reverse();
      const start = rein.shift() ?? { x: a.x + a.nx * 15, z: a.z + a.nz * 15 };
      const raus = hinaus(b, L, m.t, info.beam);
      const weg = { start, punkte: [...rein, { x: a.x, z: a.z }, ...w.punkte, ...(raus.length ? raus : [{ x: b.x + b.nx * 15, z: b.z + b.nz * 15 }])] };
      // Ausserhalb der Karte kennt die Wegsuche das Gelaende nicht (Kueste 4: das Stueck hinaus endete
      // auf einer Sandbank): den ganzen Weg alle 4 m gegen flaches Wasser pruefen
      if (game.landscape?.tiefeBei && !wegTief([weg.start, ...weg.punkte], Math.min(m.t, 1.5))) continue;
      return weg;
    }
    return info.size === 'XXL' || L > 40 ? vorbeiWegDraussen(info, m) : null;
  }

  function wegTief(pts, t) {
    const tb = game.landscape.tiefeBei;
    for (let j = 1; j < pts.length; j++) {
      const a = pts[j - 1], b = pts[j], n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 4));
      for (let q = 0; q < n; q++) if (tb(a.x + (b.x - a.x) * q / n, a.z + (b.z - a.z) * q / n) < t) return false;
    }
    return true;
  }
  // Grosse Vorbeifahrer, wenn die Karte keinen Weg hat (Bodden: das Seegatt ist zu eng, beide Raender
  // der Karte liegen im Bodden): draussen auf dem groben Raster von einem Rand des Aussenrings zu einem
  // anderen, nicht durch die Fahrwasserkarte (dort liegt der Hafen), mit Abstand zum Ufer. Vorher kam
  // auf Kueste 4 kein grosses Schiff vorbei, das Logbuch blieb bei 5 von 9 Schiffen (Abnahme 15.11.).
  function vorbeiWegDraussen(info, m) {
    if (!game.landscape?.tiefeBei || !game.gelaende?.aussenRect) return null;
    const k = karteJetzt(), g = grobRaster(), { nx, nz, G } = g;
    const L = info.length ?? 60, B = info.beam ?? 10;
    // Draussen am Aussenring ist die See nur 3 bis 7 m tief (Kueste 4: ein schmaler Ring um den Bodden)
    const abst = grobAbstand(g, Math.min(m.t, 3));
    const hart = B / 2 + G / 2, wunsch = B / 2 + L / 4 + G;
    const zx = (c) => g.x0 + (c % nx) * G, zz = (c) => g.z0 + Math.floor(c / nx) * G;
    const inKarte = (x, z) => x > k.x0 - 20 && x < k.x1 + 20 && z > k.z0 - 20 && z < k.z1 + 20;
    const ok = (c) => abst[c] >= hart && !inKarte(zx(c), zz(c));
    const rand = [];
    for (let i = 0; i < nx; i++) for (const j of [0, nz - 1]) if (abst[j * nx + i] >= hart + G) rand.push(j * nx + i);
    for (let j = 1; j < nz - 1; j++) for (const i of [0, nx - 1]) if (abst[j * nx + i] >= hart + G) rand.push(j * nx + i);
    if (rand.length < 2) return null;
    const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
    for (let versuch = 0; versuch < 6; versuch++) {
      const a = rand[Math.floor(Math.random() * rand.length)], b = rand[Math.floor(Math.random() * rand.length)];
      if (Math.hypot(zx(a) - zx(b), zz(a) - zz(b)) < 600) continue;
      const dist = new Float64Array(nx * nz).fill(Infinity), vor = new Int32Array(nx * nz).fill(-1);
      const halde = [[0, a]];
      dist[a] = 0;
      const push = (d, c) => { halde.push([d, c]); let i = halde.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (halde[p][0] <= halde[i][0]) break; [halde[p], halde[i]] = [halde[i], halde[p]]; i = p; } };
      const pop = () => { const top = halde[0], last = halde.pop(); if (halde.length) { halde[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let q = i; if (l < halde.length && halde[l][0] < halde[q][0]) q = l; if (r < halde.length && halde[r][0] < halde[q][0]) q = r; if (q === i) break; [halde[q], halde[i]] = [halde[i], halde[q]]; i = q; } } return top; };
      let gefunden = false;
      while (halde.length) {
        const [d, c] = pop();
        if (d > dist[c]) continue;
        if (c === b) { gefunden = true; break; }
        const i = c % nx, j = (c - i) / nx;
        for (const [di, dj, w] of NB) {
          const ii = i + di, jj = j + dj;
          if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
          const q = jj * nx + ii;
          if (!ok(q)) continue;
          const nah = Math.max(0, wunsch - abst[q]) / wunsch;
          const dq = d + w * (1 + 30 * nah * nah);
          if (dq < dist[q]) { dist[q] = dq; vor[q] = c; push(dq, q); }
        }
      }
      if (!gefunden) continue;
      let pts = [];
      for (let c = b; c >= 0; c = vor[c]) { pts.push({ x: zx(c), z: zz(c) }); if (c === a) break; }
      pts.reverse();
      // glaetten (gleitender Mittelwert), ein Punkt rueckt nur, wo das Wasser frei bleibt
      const h = Math.max(2, Math.round(L / 30));
      const frei = (p) => { const i = Math.round((p.x - g.x0) / G), j = Math.round((p.z - g.z0) / G); return i >= 0 && j >= 0 && i < nx && j < nz && ok(j * nx + i); };
      for (let r = 0; r < 6; r++) {
        pts = pts.map((p, i) => {
          if (!i || i === pts.length - 1) return p;
          let sx = 0, sz = 0, n = 0;
          for (let q = Math.max(0, i - h); q <= Math.min(pts.length - 1, i + h); q++) { sx += pts[q].x; sz += pts[q].z; n++; }
          const q = { x: sx / n, z: sz / n };
          return frei(q) ? q : p;
        });
      }
      return { start: pts[0], punkte: pts.slice(1) };
    }
    return null;
  }

  // Punkt fuer einen Tagestoern: freies, tiefes Wasser mit Platz fuer einen grossen Kreis
  function rundePunkt(info, wunsch, radius) {
    const k = karteJetzt();
    const f = flaeche(info);
    let best = null, bw = -Infinity;
    for (let c = 0; c < f.ok.length; c += 2) {
      if (!f.ok[c]) continue;
      const fr = k.frei[c];
      if (fr < f.r + 6) continue;
      const p = zellMitte(k, c);
      const w = Math.min(fr, radius + f.r + 4) * 3 - Math.hypot(p.x - wunsch.x, p.z - wunsch.z) * 0.15;
      if (w > bw) { bw = w; best = { x: p.x, z: p.z, frei: fr }; }
    }
    return best ?? { ...wunsch, frei: radius + f.r };
  }

  // Anfahrt kuerzen: Der Start am Kartenrand liegt oft weit ausserhalb des Bildes. Das Boot beginnt
  // stattdessen auf seinem Weg kurz bevor es ins Bild kommt; was niemand sieht, muss es nicht fahren.
  // So dauert die Anfahrt zur Boje bei jeder Kameraeinstellung etwa gleich lang.
  function naeherStart(info, start, ziel) {
    if (!game.boatAnim.imBild || !ziel) return start;
    const L = info.length ?? 8;
    const { r, t } = bootMass(info);
    const w = route(karteJetzt(), start, ziel, { r, rMin: (info.beam ?? 3) / 2 + 0.35, t });
    if (!w.ok) return start;
    const frei = (p) => game.boatAnim.boats.every((o) => Math.hypot(o.x - p.x, o.z - p.z) > (L + o.info.length) / 2 + 8);
    let vorher = start;
    let px = start.x, pz = start.z;
    for (const q of w.punkte) {
      const d = Math.hypot(q.x - px, q.z - pz), n = Math.max(1, Math.ceil(d / 5));
      for (let i = 1; i <= n; i++) {
        const p = { x: px + (q.x - px) * i / n, z: pz + (q.z - pz) * i / n };
        if (game.boatAnim.imBild(p.x, p.z, L + 6)) return vorher;
        // hoechstens bis 40 m vor das Ziel (dort soll man es noch heranfahren sehen)
        if (Math.hypot(ziel.x - p.x, ziel.z - p.z) < 40 + L) return vorher;
        // Kurs zum naechsten Wegpunkt mitgeben (wer schon faehrt, soll nicht erst wenden)
        if (frei(p) && befahrbar(karteJetzt(), p.x, p.z, r * 0.8, t)) vorher = { ...p, h: Math.atan2(-(q.z - pz), q.x - px) };
      }
      px = q.x; pz = q.z;
    }
    return vorher;
  }

  // --- Ereignisse der Spielregeln -----------------------------------------------------------
  let ankunftT = -1e9;
  // Gemeinsamer Ablegetakt (Gaeste abends, Dauerlieger und Tagesausfluege morgens, Wartende von Boje
  // und Anker zur Box): unmittelbar vor dem Leinenloswerfen fragt jedes Boot, ob es an der Reihe ist.
  // 6 bis 9 s Spielzeit Abstand, damit auch bei 8x und 'Alle einweisen' nie mehrere zugleich in die
  // Einfahrt fahren. Warten mehr als zehn Boote, rueckt der Takt auf 4 s (die Boxen muessen fuer die
  // naechsten Gaeste frei werden). Wer wartet, liegt noch fest. (Ein Takt je Steg liess ab Stufe 3 zu
  // viele zugleich hinaus: Pulk an der Ausfahrt, Zeitraffer 15.11.)
  const takt = { naechst: -1e9, fragt: new Map() };
  function ablegeTakt(anim) {
    const jetzt = game.time ?? 0;
    if (takt.naechst - jetzt > 30) takt.naechst = jetzt;     // Spielzeit neu (Laden, neues Spiel)
    takt.fragt.set(anim, jetzt);
    if (jetzt < takt.naechst) return false;
    takt.fragt.delete(anim);
    let wartend = 0;
    for (const [a, t] of takt.fragt) { if (jetzt - t > 2) takt.fragt.delete(a); else wartend++; }
    takt.naechst = jetzt + (wartend > 10 ? 4 : 6 + Math.random() * 3);
    return true;
  }
  // --- Seezugaenge: Boote kommen von weit draussen auf See (ausserhalb jeder Zoomstufe), aus
  // verschiedenen Richtungen, nie ueber Land (game.gelaende.seezugaenge, Gelaende-Thread). Ohne
  // Seezugaenge (aeltere Gelaende, Tests) bleibt der Start am Kartenrand.
  let letzterZugang = null;
  // Flottillen (P32): die Boote einer Gruppe kommen im Konvoi über denselben Seezugang, kurz hintereinander
  const KONVOI_ABSTAND = 2.4;
  const flottenAnfahrt = new Map();   // Flottillen-id -> { zugang, t }
  function zugaenge(info) {
    const f = game.gelaende?.seezugaenge;
    if (typeof f !== 'function') return [];
    const tiefeM = bootMass(info).t > 2.3 ? 4 : 2;
    let l = null;
    try { l = f(stufe(), { tiefeM }); } catch (err) { console.warn('Seezugaenge nicht lesbar', err); }
    return (l ?? []).filter((z) => !z.umweg && Array.isArray(z.weg) && z.weg.length >= 2);
  }
  // Seeweg eines Zugangs teilen: draussen die groben Punkte, ab dem ersten Punkt in der feinen Karte
  // (frei von Wartebojen und Ankerplaetzen) sucht die Karte den Weg. Rueckgabe { see, uebergabe }.
  function seeTeil(zugang) {
    const k = karteJetzt();
    const w = game.landscape?.warteplaetze ?? {};
    // Wartebereiche und alle, die dort gerade liegen (auch auf Ausweichplaetzen um das Ankerfeld)
    const kreise = [...(w.bojen ?? []).map((o) => ({ x: o.x, z: o.z, r: 30 })),
      ...(w.ankerbereiche ?? []).map((o) => ({ x: o.x, z: o.z, r: (o.radiusM ?? 30) + 20 }))];
    for (const o of game.boatAnim.boats) if (o.moored && (o.berth?.kind === 'buoy' || o.berth?.kind === 'anchor')) kreise.push({ x: o.x, z: o.z, r: 30 });
    const innen = (p) => p.x > k.x0 + 20 && p.x < k.x1 - 20 && p.z > k.z0 + 20 && p.z < k.z1 - 20;
    const frei = (p) => kreise.every((o) => Math.hypot(o.x - p.x, o.z - p.z) > o.r);
    const pts = [{ x: zugang.x, z: zugang.z }, ...zugang.weg.slice(1).map((p) => ({ x: p.x, z: p.z }))];
    // Uebergabe an die feine Karte: die erste Stelle des Seewegs (alle 4 m geprueft) in der Karte und
    // in befahrbarem Wasser, also meist am Kartenrand in Richtung des Zugangs. So verteilen sich An- und
    // Abfahrten rund um die Karte, statt alle am Endpunkt vor der Einfahrt zusammenzulaufen. Beruehrt
    // der Weg vorher einen Wartebereich, ist die Stelle davor die Uebergabe.
    const see = [];
    let vorher = pts[0];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], d = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      for (let t = 4; t <= d + 0.01; t += 4) {
        const q = { x: a.x + (b.x - a.x) * Math.min(1, t / d), z: a.z + (b.z - a.z) * Math.min(1, t / d) };
        // Wartebereiche zaehlen erst in der Karte: davor findet der Fahrweg keinen Weg und das Boot
        // fuhre gerade uebers Land (Zeitraffer Stufe 6: Treffer an Land weit draussen)
        const drin = innen(q) && befahrbar(k, q.x, q.z, 4, 2);
        if (!frei(q) && innen(vorher) && befahrbar(k, vorher.x, vorher.z, 4, 2)) { see.push(vorher); return { see, uebergabe: vorher }; }
        if (drin) { see.push(q); return { see, uebergabe: q }; }
        vorher = q;
        // dicht gesetzt (alle 12 m): die Kurve des Bootes bleibt so auf der geraden Strecke des Seewegs
        // und schneidet an Kuestenknicken kein Land
        if (t % 12 < 4 && t < d - 6) see.push(q);
      }
      see.push(b);
    }
    return { see: see.length ? see : [pts[0]], uebergabe: see[see.length - 1] ?? pts[0] };
  }
  // Seeweg in Fahrtrichtung nach Steuerbord versetzen (halber Bahnabstand), so weit dort tiefes Wasser
  // ist. An- und Abreisende desselben Seezugangs fahren so auf zwei Bahnen statt Bug auf Bug auf einer
  // Linie und treffen sich nicht mehr alle im selben Uebergabepunkt (Kueste 15: Knoten 100 m vor der Einfahrt).
  function seeBahn(pts) {
    if (!pts || pts.length < 2) return pts;
    const k = karteJetzt();
    const tief = (x, z) => (game.landscape?.tiefeBei?.(x, z) ?? 99) >= 2.5;
    const ok = (x, z) => {
      const drin = x > k.x0 + 20 && x < k.x1 - 20 && z > k.z0 + 20 && z < k.z1 - 20;
      return drin ? befahrbar(k, x, z, 4, 2) : tief(x, z);
    };
    return pts.map((q, i) => {
      const a = pts[Math.max(0, i - 1)], c = pts[Math.min(pts.length - 1, i + 1)];
      const dx = c.x - a.x, dz = c.z - a.z, l = Math.hypot(dx, dz);
      if (l < 0.5) return q;
      const sx = -dz / l, sz = dx / l;
      for (let off = BAHN_ABSTAND_M / 2; off > 1.5; off *= 0.6) {
        // auch ein Stueck weiter aussen muss Wasser sein (Abstand zum Ufer)
        if (ok(q.x + sx * off, q.z + sz * off) && ok(q.x + sx * (off + 6), q.z + sz * (off + 6))) return { ...q, x: q.x + sx * off, z: q.z + sz * off };
      }
      return q;
    });
  }
  function waehleZugang(info, herkunft) {
    const l = zugaenge(info);
    if (!l.length) return null;
    // Richtungen gleichmaessig: nach Himmelsrichtung ordnen, herkunft (0..1) waehlt die Richtung
    const nach = l.slice().sort((a, b) => (a.grad ?? 0) - (b.grad ?? 0));
    let z = Number.isFinite(herkunft) ? nach[Math.min(nach.length - 1, Math.floor(Math.max(0, herkunft) * nach.length))]
      : nach[Math.floor(Math.random() * nach.length)];
    if (z === letzterZugang && nach.length > 1) z = nach[(nach.indexOf(z) + 1 + Math.floor(Math.random() * (nach.length - 1))) % nach.length];
    letzterZugang = z;
    return z;
  }
  // Beim Laden einmal rechnen (erster Aufruf kostet bis 0,6 s), nicht erst beim ersten Boot
  setTimeout(() => { zugaenge({ length: 8, beam: 3, draft: 1.2 }); zugaenge({ length: 30, beam: 8, draft: 3.5, size: 'XL' }); }, 0);

  let erstesGezeigt = false;
  game.on('sim:change', (d) => { if (d?.reason === 'new') erstesGezeigt = false; });
  game.on('boot-kommt', (info) => {
    if (!info || info.id == null) return;
    if (bojenStufe !== stufe()) baueBojen();
    const e = erzeuge(info);
    const ziel = warteplatz(info.boje ?? 0, e.anim);
    // Erstes Boot eines neuen Spiels (Jorven: nach wenigen Sekunden da): startet kurz vor dem Bildrand
    // statt weit draussen am Seezugang. Alle anderen reisen von weit draussen an.
    const st = game.sim?.state;
    const erstes = !erstesGezeigt && st?.day === 1 && (st.clock ?? 0) < 30 && !(st.guests > 0);
    erstesGezeigt = true;
    const fl = info.flotte ?? null;
    e.anim.flotte = fl?.id ?? null;
    const vorige = fl ? flottenAnfahrt.get(fl.id) ?? null : null;
    const zugang = erstes ? null : vorige ? vorige.zugang : waehleZugang(e.anim.info, info.herkunft);
    if (fl && flottenAnfahrt.size > 20) flottenAnfahrt.clear();
    if (zugang) {
      const see = seeBahn(seeTeil(zugang).see);
      e.pick = e.anim.model.userData.pick;
      delete e.anim.model.userData.pick;
      e.anim.place(zugang.x, zugang.z, Math.atan2(-(see[0].z - zugang.z), see[0].x - zugang.x));
      if (e.anim.info.kind === 'sail') e.anim.setSails(true);
      const jetzt = game.time ?? 0;
      // Flottille: dicht hinter dem Boot davor, sonst mit eigenem Abstand
      ankunftT = vorige ? Math.max(jetzt, vorige.t + KONVOI_ABSTAND) : Math.max(jetzt, ankunftT + 3 + Math.random() * 6);
      if (fl) flottenAnfahrt.set(fl.id, { zugang, t: ankunftT });
      // Ab der Einfahrt springt das Boot, solange es niemand sieht, bis kurz vor den Bildrand (wie
      // ohne Seezugang): die Anfahrt im Revier dauert so bei jeder Kamera etwa gleich lang.
      // Eine Flottille springt nicht (sonst landeten alle an derselben Stelle und der Konvoi zerfiele).
      const vorruecken = fl ? undefined : (a) => (game.boatAnim.imBild?.(a.x, a.z, a.info.length + 6) ? null : naeherStart(a.info, { x: a.x, z: a.z }, ziel));
      e.anim.dock(ziel, { route: true, einfahrt: true, verzoegerung: ankunftT - jetzt, see, vorruecken });
      return;
    }
    const start = naeherStart(e.anim.info, freierStart(e.anim.info, info.herkunft), ziel);
    // Antippen und Ziehen erst, wenn das Boot an der Boje fest ist (siehe boat:moored unten)
    e.pick = e.anim.model.userData.pick;
    delete e.anim.model.userData.pick;
    e.anim.place(start.x, start.z, Math.atan2(-(ziel.z - start.z), ziel.x - start.x));
    if (e.anim.info.kind === 'sail') e.anim.setSails(true);
    // Segelboote bergen die Segel vor der Boje (dock() erledigt das), dann Leine an die Boje.
    // Kommen mehrere im selben Augenblick, laufen sie nacheinander los (keine Wellen).
    const jetzt = game.time ?? 0;
    ankunftT = erstes ? jetzt : vorige ? Math.max(jetzt, vorige.t + KONVOI_ABSTAND) : Math.max(jetzt, ankunftT + 3 + Math.random() * 6);
    if (fl) flottenAnfahrt.set(fl.id, { zugang: null, t: ankunftT });
    e.anim.dock(ziel, { route: true, einfahrt: true, verzoegerung: ankunftT - jetzt });
  });

  // Neue fest stationierte Boote, deren Platz noch vom Vorgaenger verlassen wird (siehe boot-zugewiesen)
  const spaeterZeigen = [];
  game.onTick(() => {
    for (let i = spaeterZeigen.length - 1; i >= 0; i--) {
      const w = spaeterZeigen[i];
      if (!boats.has(w.e.anim.id) || (game.time ?? 0) > w.bis || !w.imWeg()) {
        if (boats.has(w.e.anim.id) && w.e.anim.versteckt) w.e.anim.verstecken(false);
        spaeterZeigen.splice(i, 1);
      }
    }
  });
  game.on('boot-zugewiesen', ({ id, platz, sofort = false } = {}) => {
    const neu = !boats.has(id);
    const e = boats.get(id) ?? (sucheInfo(id) && erzeuge(sucheInfo(id)));
    if (!e) return;
    const b = platzBerth(platz, e.anim.info);
    if (!b) return;
    if (neu) {
      // ohne vorheriges boot-kommt (z. B. Fischer nach dem Aufstieg, stationBoat): liegt gleich am Platz
      e.anim.moorAt(b);
      // Liegt dort noch sichtbar ein anderes Boot, das gerade ablegt (Fischerwechsel zur neuen Saison),
      // erscheint das neue erst, wenn der Platz wirklich frei ist. Vorher lag es kurz auf dem alten.
      const imWeg = () => [...game.boatAnim.boats].some((o) => {
        if (o === e.anim || o.model.visible === false) return false;
        const d = Math.hypot(o.x - e.anim.x, o.z - e.anim.z);
        // derselbe Platz (liegt noch oder zieht gerade heraus), nicht der Nachbar in der Nebenbox
        return (String(o.berth?.id ?? '') === String(b.id) && d < (o.info.length + e.anim.info.length) / 2 + 1) || (!o.moored && d < 3);
      });
      if (imWeg()) { e.anim.verstecken(true); spaeterZeigen.push({ e, imWeg, bis: (game.time ?? 0) + 60 }); }
      return;
    }
    // Ein Boot ohne Auftrag (nach dem Laden) liegt an der Boje. Kam es gerade erst (boot-kommt im
    // selben Schritt, Spielregel 'direkt einfahren bei vollen Bojen'), hat es schon seine Anfahrt
    // und faehrt von See direkt in die Box.
    if (!e.anim.moored && e.anim.state === 'idle' && !e.anim.task && !e.anim.tasks.length) e.anim.moorAt(warteplatz(e.info.boje ?? 0, e.anim));
    if (e.pick) { e.anim.model.userData.pick = e.pick; e.pick = null; }
    // Ist die Box noch nicht frei und das Boot noch unterwegs zur Boje, faehrt es erst zur Boje
    // und wartet dort (nicht mitten im Fahrwasser, wo es anderen im Weg laege).
    if (!e.anim.moored && !platzFrei(platz, b, e.anim)) { e.spaeter = platz; return; }
    fahreZu(e, platz, b, sofort);
  });

  // Paeckchen (P27): Liegt aussen noch ein Boot an diesem, legt es erst ab, wenn das aeussere fort ist
  const paeckchenFrei = (anim) => !game.paeckchen?.blockiert?.(anim.id);

  // sofort: vom Spieler umgelegt (P33), das Boot legt ohne gemeinsamen Ablegetakt gleich ab
  function fahreZu(e, platz, b, sofort = false) {
    e.spaeter = null;
    e.anim.reserviert = null;
    // ab Stufe 3 von der Reede durch Einfahrt und Durchstich in den See.
    // Liegt noch ein Boot in der Box (es faehrt heute ab), wartet das neue, bis die Box frei ist.
    // von der Boje oder vom Anker los im gemeinsamen Ablegetakt (sonst bei 'Alle einweisen' ein Pulk)
    // Paeckchen (P27): erst los, wenn das Boot innen fest liegt (sonst laege das aeussere ihm im Weg)
    const frei = b.kind === 'paeckchen' ? () => platzFrei(platz, b, e.anim) && game.paeckchen?.innenFest?.(platz) !== false : () => platzFrei(platz, b, e.anim);
    e.anim.dock(b, { route: true, waitFor: frei, takt: sofort ? null : ablegeTakt, warte: paeckchenFrei });
  }

  // Stufenausbau mit weniger Bojen (Spielregel settleWaitSpots): ein wartendes Boot verholt an eine
  // andere Boje. Liegt es schon dort (abgleich nach 'stufe' hat es umgesetzt), bleibt es liegen.
  game.on('boot:boje', ({ id, boje } = {}) => {
    const e = boats.get(id);
    if (!e || boje == null) return;
    e.info = { ...e.info, boje };
    if (e.faehrt || e.anim.berth?.kind !== 'buoy' && e.anim.state !== 'idle') return;
    if (e.anim.berth?.id === `boje-${boje}`) return;
    if (bojenStufe !== stufe()) baueBojen();
    e.anim.dock(warteplatz(boje, e.anim), { route: true });
  });

  game.on('boot-faehrt', ({ id } = {}) => faehrtWeg(id));
  function faehrtWeg(id) {
    const e = boats.get(id);
    if (!e) return;
    // niemand sieht es: gleich weg (spart Rueckstau beim schnellen Vorspulen)
    if (!game.boatAnim.imBild?.(e.anim.x, e.anim.z, e.anim.info.length)) { entferne(id); return; }
    // hinaus bis vor die Einfahrt und weiter auf See zu einem Seezugang (dort verschwindet es)
    const zugang = waehleZugang(e.anim.info);
    const raus = zugang ? seeBahn([...seeTeil(zugang).see.reverse(), { x: zugang.x, z: zugang.z }]) : null;
    const ziel = raus ? raus[0] : (randPunkt(e.anim.info) ?? { x: e.anim.x, z: e.anim.z - 300 });
    const weg = [ziel];
    const see = raus ? raus.slice(1) : undefined;
    e.faehrt = true;
    entferneMuenze(id, 0);
    // Abends legen viele zugleich ab: gestaffelt, 3 bis 6 s Abstand, damit es wie geordneter
    // Verkehr aussieht und nicht wie ein Pulk an der Einfahrt (hoechstens 30 s Warten)
    // Bootsgeschichte "Tanken": erst an die Tankstelle, dort kurz fest, dann hinaus
    const tank = tankHalt(e, id);
    if (tank) {
      // längsseits an den Tanksteg, Leinen fest, tanken, dann wie alle hinaus
      e.anim.dock(tank, { route: true, takt: ablegeTakt, warte: paeckchenFrei }).then((ok) => {
        if (!ok || boats.get(id) !== e) return;
        nachSpielzeit(12, () => {
          if (boats.get(id) !== e) return;
          e.anim.undock(weg, { sails: e.anim.info.kind === 'sail', route: true, see }).then((ok2) => {
            if (ok2 && boats.get(id) === e) entferne(id);
          });
        });
      });
      return;
    }
    e.anim.undock(weg, { sails: e.anim.info.kind === 'sail', route: true, takt: ablegeTakt, see, warte: paeckchenFrei }).then((ok) => {
      if (ok && boats.get(id) === e) entferne(id);
    });
  }
  // Geschichte merken, solange das Boot in den Spielregeln steht (Kurzhalter sind beim Ablegen schon gelöscht)
  game.on('sim:moored', (d) => {
    const e = boats.get(d?.boatId);
    const g = game.geschichten?.geschichte?.(game.sim?.state?.boats?.[d?.boatId]);
    if (e && g) e.geschichte = g;
  });
  // Tankstelle als Zwischenhalt: nur für die Geschichte "Tanken", nur wenn der Platz erreichbar ist
  // und gerade kein anderes Boot dort liegt
  function tankHalt(e, id) {
    const g = game.geschichten?.geschichte?.(game.sim?.state?.boats?.[id]) ?? e.geschichte;
    if (g?.id !== 'tanken') return null;
    const p = game.services?.tankPunkt?.();
    if (!p) return null;
    const { r, t } = bootMass(e.anim.info);
    const beam = e.anim.info.beam ?? 3;
    const platz = { id: 'tankstelle', x: p.x, z: p.z + beam / 2, heading: 0, kind: 'kai', length: e.anim.info.length + 2, width: beam + 1, side: p.seite ?? 1 };
    // vor dem Steg muss tiefes Wasser sein (ein Stück weiter draußen als die Liegelage, die am Steg selbst liegt)
    if (!befahrbar(karteJetzt(), platz.x, platz.z + beam + 2, r, t)) return null;
    if (game.boatAnim.boats.some((o) => o !== e.anim && Math.hypot(o.x - platz.x, o.z - platz.z) < (o.info.length + e.anim.info.length) / 2 + 2)) return null;
    return platz;
  }
  // Rückruf nach Spielsekunden (läuft mit Zeitraffer und steht in der Pause)
  const spaeter = [];
  function nachSpielzeit(sek, fn) { spaeter.push({ bis: (game.time ?? 0) + sek, fn }); }
  game.onTick(() => {
    if (!spaeter.length) return;
    const t = game.time ?? 0;
    for (let i = spaeter.length - 1; i >= 0; i--) if (t >= spaeter[i].bis) spaeter.splice(i, 1)[0].fn();
  });

  // --- Muenzen ueber liegenden Booten (abends Hafengeld, eingestrichen ueber ui/gesten.js) ------
  const muenzen = new Map();          // bootId -> Mesh
  const muenzGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.12, 18).rotateX(Math.PI / 2);
  const muenzMat = new THREE.MeshLambertMaterial({ color: '#f5c542', emissive: '#6b4a00', flatShading: true });
  const randMat = new THREE.MeshLambertMaterial({ color: '#d99a1e', flatShading: true });
  const randGeo = new THREE.TorusGeometry(0.55, 0.06, 6, 18);

  // Wert jeder offenen Münze aus sim:feeReady: { base, bonus, nights } (P12, Review B3 und B6)
  const muenzWert = new Map();   // bootId -> { base, bonus, nights }
  // Wer mehrere Nächte im Voraus zahlt, hat eine größere Münze (bis 1,4-fach bei 4 Nächten)
  const groesse = (id) => 1 + Math.min(0.4, 0.13 * Math.max(0, (muenzWert.get(id)?.nights ?? 1) - 1));

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

  // --- Betrag beim Einstreichen: "22 € + 11 €" fliegt kurz hoch (Wunschbonus grün) -------------
  // Holt der Hafenmeister die Münze (Rundgang, Review B4), wird sie silbern und kleiner, und es
  // steht "18 € statt 22 €" daneben: so sieht man, dass Selbst-Einstreichen mehr bringt.
  const betraege = [];           // { sprite, t, dauer, y0 }
  const eur = (n) => `${Math.round(n).toLocaleString('de-DE')} €`;
  function textSprite(teile, unten) {
    const px = 2;                                   // Pixelstil: klein zeichnen, hart vergrößern
    const font = '700 13px "Pixelify Sans", system-ui, sans-serif';
    const cv = document.createElement('canvas');
    const c2 = cv.getContext('2d');
    c2.font = font;
    const oben = Math.ceil(teile.reduce((a, t) => a + c2.measureText(t.text).width, 0));
    c2.font = '600 10px "Pixelify Sans", system-ui, sans-serif';
    const breite = Math.max(oben, unten ? Math.ceil(c2.measureText(unten).width) : 0) + 10;
    c2.font = font;
    const hoch = unten ? 30 : 18;
    cv.width = breite * px; cv.height = hoch * px;
    c2.scale(px, px);
    c2.imageSmoothingEnabled = false;
    c2.font = font;
    c2.textBaseline = 'middle';
    c2.lineJoin = 'round';
    let x = (breite - oben) / 2;
    for (const t of teile) {
      c2.lineWidth = 3; c2.strokeStyle = '#1d2733'; c2.strokeText(t.text, x, 9);
      c2.fillStyle = t.farbe; c2.fillText(t.text, x, 9);
      x += c2.measureText(t.text).width;
    }
    if (unten) {
      c2.font = '600 10px "Pixelify Sans", system-ui, sans-serif';
      const w = c2.measureText(unten).width;
      c2.lineWidth = 3; c2.strokeText(unten, (breite - w) / 2, 23);
      c2.fillStyle = '#e8eef3'; c2.fillText(unten, (breite - w) / 2, 23);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, sizeAttenuation: false }));
    // feste Größe auf dem Bildschirm (Anteil der Bildhöhe), am Handy etwas größer; groesseText()
    // rechnet das jedes Bild in die Kamera um
    sp.userData.h = (window.innerWidth < 700 ? 0.04 : 0.036) * (hoch / 18);
    sp.userData.seiten = breite / hoch;
    groesseText(sp);
    sp.center.set(0.5, 0);
    sp.renderOrder = 6;
    return sp;
  }
  // Orthografische Kamera: Sprites messen in Welt-Metern, also Bildhöhe in Metern einrechnen.
  // Perspektive: sizeAttenuation false misst schon in Bildschirmanteilen.
  function groesseText(sp) {
    const cam = game.camera?.camera;
    let h = sp.userData.h;
    if (cam?.isOrthographicCamera) h *= (cam.top - cam.bottom) / (cam.zoom || 1);
    // Perspektive mit sizeAttenuation false: Bildhöhe (NDC 2) entspricht 2 / projectionMatrix[5]
    else if (cam) h *= 2 / (cam.projectionMatrix.elements[5] || 1);
    sp.scale.set(h * sp.userData.seiten, h, 1);
  }
  function zeigeBetrag(id, d) {
    const m = muenzen.get(id);
    if (!m) return;
    const pos = m.position.clone();
    const w = muenzWert.get(id);
    let teile, unten = null;
    if (d.round) {
      teile = [{ text: eur(d.amount), farbe: '#cfd8e0' }, { text: ` statt ${eur(d.full ?? d.amount)}`, farbe: '#9fb0bf' }];
      unten = 'Hafenmeister';
    } else {
      // Zuschläge des Hafenbüros (P02): Trinkgeld beim persönlichen Abholen, Nebenkosten; amount enthält sie
      const tip = d.tip || 0, extras = d.extras || 0;
      const kern = d.amount - tip - extras;
      const passt = w && w.base + w.bonus === kern;
      teile = passt && w.bonus > 0
        ? [{ text: eur(w.base), farbe: '#ffd75e' }, { text: ` + ${eur(w.bonus)}`, farbe: '#8fe07a' }]
        : [{ text: eur(kern), farbe: '#ffd75e' }];
      const zeile = [];
      if (passt && w.nights > 1) zeile.push(`${w.nights} Nächte`);
      if (tip > 0) zeile.push(`+${eur(tip)} Trinkgeld`);
      if (extras > 0) zeile.push(`+${eur(extras)} Nebenkosten`);
      if (zeile.length) unten = zeile.join(' · ');
    }
    const sp = textSprite(teile, unten);
    sp.position.copy(pos).add(new THREE.Vector3(0, 0.9, 0));
    // Nicht über einen anderen Betrag legen: so lange eine Zeile höher, bis auf dem Bildschirm Platz ist
    const cam = game.camera?.camera;
    if (cam) {
      // Lage und Größe in Bildschirmkoordinaten (-1 bis 1); Sprites sind unten mittig verankert
      const z = cam.zoom || 1, pm = cam.projectionMatrix.elements;
      const box = (b) => {
        const v = b.position.clone().project(cam);
        return cam.isOrthographicCamera
          ? { x: v.x, y: v.y, w: (b.scale.x * 2 * z) / (cam.right - cam.left), h: (b.scale.y * 2 * z) / (cam.top - cam.bottom) }
          : { x: v.x, y: v.y, w: b.scale.x * pm[0], h: b.scale.y * pm[5] };
      };
      for (let k = 0; k < 8; k++) {
        const a = box(sp);
        const stoss = betraege.some((o) => {
          const b = box(o.sprite);
          return Math.abs(a.x - b.x) < (a.w + b.w) / 2 && a.y < b.y + b.h && b.y < a.y + a.h;
        });
        if (!stoss) break;
        sp.position.y += sp.scale.y * 1.05;
      }
    }
    game.scene.add(sp);
    betraege.push({ sprite: sp, t: 0, dauer: d.round ? 2.2 : 1.6, y0: sp.position.y });
  }
  // Rundgang: Münze wird silbern, schrumpft auf vier Fünftel und steigt langsam auf
  const silberMat = new THREE.MeshLambertMaterial({ color: '#c9d2da', emissive: '#3a4450', flatShading: true });
  const silberRand = new THREE.MeshLambertMaterial({ color: '#9aa6b2', flatShading: true });
  const silbern = [];            // { m, t, s0, y0 }
  function versilbern(id, anteil) {
    const m = muenzen.get(id);
    if (!m) return false;
    muenzen.delete(id);
    m.userData.eingestrichen = true;
    m.userData.pick = null;
    m.material = silberMat;
    for (const k of m.children) k.material = silberRand;
    silbern.push({ m, t: 0, s0: m.scale.x * Math.sqrt(anteil), y0: m.position.y });
    return true;
  }
  game.onTick((dt) => {
    for (let i = betraege.length - 1; i >= 0; i--) {
      const b = betraege[i];
      b.t += dt;
      const k = b.t / b.dauer;
      groesseText(b.sprite);
      // steigt um etwa eine Texthöhe auf dem Bildschirm
      b.sprite.position.y = b.y0 + Math.min(1, k) * b.sprite.scale.y * 1.5;
      b.sprite.material.opacity = k < 0.7 ? 1 : Math.max(0, 1 - (k - 0.7) / 0.3);
      if (k >= 1) {
        b.sprite.parent?.remove(b.sprite);
        b.sprite.material.map.dispose();
        b.sprite.material.dispose();
        betraege.splice(i, 1);
      }
    }
    for (let i = silbern.length - 1; i >= 0; i--) {
      const s = silbern[i];
      s.t += dt;
      const k = Math.min(1, s.t / 1.2);
      s.m.scale.setScalar(Math.max(0.01, s.s0 * (k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25)));
      s.m.position.y = s.y0 + k * 1.5;
      s.m.rotation.y += dt * 4;
      if (k >= 1) { s.m.parent?.remove(s.m); silbern.splice(i, 1); }
    }
  });
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
      m.scale.setScalar(Math.max(0.01, k * groesse(id) * (1 + Math.max(0, 0.25 - (t - m.userData.t0)) * 2)));
    }
  });
  // Liegegeld wird beim Anlegen faellig (PR 100): die Muenze erst zeigen, wenn das Boot in der Box fest ist
  const amPlatz = (a) => a.moored && a.berth && a.berth.kind !== 'buoy';
  game.on('sim:feeReady', (d) => {
    const e = boats.get(d?.boatId);
    if (!e) return;
    // Wert merken (offen gebliebene Münzen vom Vortag werden zusammengezählt)
    const alt = muenzWert.get(d.boatId);
    const base = d.base ?? d.amount, bonus = d.bonus ?? 0, nights = d.nights ?? 1;
    muenzWert.set(d.boatId, alt && game.sim?.state?.boats?.[d.boatId]?.pendingFee > d.amount
      ? { base: alt.base + base, bonus: alt.bonus + bonus, nights: alt.nights + nights }
      : { base, bonus, nights });
    if (amPlatz(e.anim)) zeigeMuenze(d.boatId);
    else e.muenzeWartet = true;
  });
  game.on('boat:moored', (d) => {
    const e = boats.get(d?.id);
    if (e?.muenzeWartet && amPlatz(e.anim)) { e.muenzeWartet = false; zeigeMuenze(d.id); }
  });
  game.on('sim:collected', (d) => {
    bandT = 1;                         // Wimpel gleich beim Kassieren zeigen, nicht erst bei der naechsten Pruefung
    if (d?.boatId == null) { for (const id of [...muenzen.keys()]) entferneMuenze(id, 700); return; }
    const e = boats.get(d.boatId);
    if (e) e.muenzeWartet = false;
    // Nachts sieht es niemand: die Münze verschwindet einfach (Wert steht im Tagesabschluss)
    if (d.night) { entferneMuenze(d.boatId, 0); muenzWert.delete(d.boatId); return; }
    // nur wo eine Münze zu sehen war (der Kassenautomat kassiert still, bevor das Boot fest ist)
    if (muenzen.has(d.boatId)) zeigeBetrag(d.boatId, d);
    if (d.round && versilbern(d.boatId, (d.amount || 1) / (d.full || d.amount || 1))) { muenzWert.delete(d.boatId); return; }
    entferneMuenze(d.boatId, 700);
    muenzWert.delete(d.boatId);
  });
  game.on('sim:departed', (d) => {
    entferneMuenze(d?.boatId, 0);
    const e = boats.get(d?.boatId);
    if (e) e.abgerechnet = true;     // abgerechnet = bezahlt: Wimpel bleibt, bis 'boot-faehrt' am Vormittag kommt
  });

  // Boot ist am Platz fest: die Box blitzt einmal hell auf (Form und Drehung der Box aus render/stege.js)
  // Der Blitz laeuft in echter Zeit (0,9 s), auch bei 3x/8x und in der Pause, sonst ist er bei Zeitraffer weg.
  const blitze = new Map();     // platzId -> Startzeit (performance.now)
  game.on('boat:moored', (d) => {
    const id = d?.berth;
    if (!id || String(id).startsWith('boje-') || !game.stege?.platz?.(id)?.mesh) return;
    blitze.set(id, performance.now());
  });
  game.onTick(() => {
    const jetzt = performance.now();
    for (const [id, t0] of blitze) {
      const mat = game.stege?.platz?.(id)?.mesh?.material;
      const r = 1 - (jetzt - t0) / 900;
      if (!mat || r <= 0) {
        blitze.delete(id);
        if (mat) mat.opacity = 0;
        continue;
      }
      mat.color.set('#ffffff');
      mat.opacity = 0.55 * r * r;
    }
  });

  // Ablegendes Boot ist aus der Box heraus: die Spielregeln geben die Box frei (state.leaving, PR 93)
  game.on('boat:clear', (d) => {
    if (!d || !boats.has(d.id) || String(d.berth ?? '').startsWith('boje-') || String(d.berth ?? '').startsWith('anker-')) return;
    game.emit('boot:aus-box', { id: d.id });
  });

  // Ankommendes Boot ist von See her in der Karte: ab jetzt laesst es sich antippen und zuweisen
  // (bei Andrang faehrt es sonst nach kurzer Zeit selbst in eine Box, ohne je an der Boje zu liegen)
  game.on('boat:im-revier', (d) => {
    const e = boats.get(d?.id);
    if (e?.pick) { e.anim.model.userData.pick = e.pick; e.pick = null; }
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
    game.emit('boot:an-boje', { id: d.id, boje: e.info.boje ?? 0, platz: art });
  });

  // --- Dauerlieger: morgens eine Runde draussen, abends zurueck an denselben Platz ----------
  // Ereignisse aus features/dauerlieger.js: 'dauer:auslaufen' { id, platzId, tage } (tage 0 = Tagestoern),
  // 'dauer:einlaufen' { id, platzId }.
  const RUNDE = {
    1: [40, 120],      // Mitte des Binnensees
    3: [110, 300],     // Ostsee vor der Einfahrt
    5: [60, 380],      // Ostsee vor dem Aussenhafen
  };
  const rundenWunsch = () => {
    const st = stufe();
    return welt(st >= 5 ? RUNDE[5] : st >= 3 ? RUNDE[3] : RUNDE[1]);
  };

  // --- Regatta (docs/bootsgeschichten.md, Abschnitt 5): Bahn mit gelben Tonnen draussen vor dem
  // Hafen. Startlinie in Lee, Luvtonne gegen den Wind; die Boote kreuzen zur Luvtonne, laufen vor dem
  // Wind zurueck, zwei Runden, danach kreisen sie am Ziel, bis die Spielregeln sie heimschicken.
  const regattaGruppe = new THREE.Group();
  regattaGruppe.name = 'regattabahn';
  game.scene.add(regattaGruppe);
  const tonneGeo = new THREE.ConeGeometry(1.5, 3.4, 8).translate(0, 1.2, 0);
  const tonneMat = new THREE.MeshLambertMaterial({ color: '#f5b400', flatShading: true });
  const stangeGeo = new THREE.CylinderGeometry(0.07, 0.07, 3, 5).translate(0, 4.2, 0);
  const flaggeGeo = new THREE.PlaneGeometry(1.4, 0.9).translate(0.7, 5.2, 0);
  const flaggeMat = new THREE.MeshLambertMaterial({ color: '#d64541', side: THREE.DoubleSide });
  let bahn = null;
  const richtung = (a) => ({ x: Math.cos(a), z: -Math.sin(a) });
  function regattaHeute() {
    const st = game.sim?.state;
    if (!st) return false;
    const w = game.events?.weather?.(st.day);
    return (w?.event ?? game.events?.current?.id) === 'regatta';
  }
  // Bahn fuer heute: freies, tiefes Wasser (wie die Tagestoerns), Schenkel so lang, wie Platz ist
  function legeBahn() {
    const tag = game.sim?.state?.day ?? 0;
    if (bahn?.tag === tag && bahn.stufe === stufe()) return bahn;
    const info = { length: 11, beam: 3.6, draft: 2, size: 'L' };
    const k = karteJetzt();
    const { r, t } = bootMass(info);
    const mitte = rundePunkt(info, rundenWunsch(), 120);
    const w = windFrom(), luvR = richtung(w), quer = richtung(w + Math.PI / 2);
    const frei = (a, b) => {
      const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(d / 6));
      for (let i = 0; i <= n; i++) if (!befahrbar(k, a.x + (b.x - a.x) * i / n, a.z + (b.z - a.z) * i / n, r, t)) return false;
      return true;
    };
    let L = Math.max(30, Math.min(95, (mitte.frei ?? 60) * 0.9));
    let neu = null;
    for (let versuch = 0; versuch < 8 && !neu; versuch++, L *= 0.85) {
      const luv = { x: mitte.x + luvR.x * L / 2, z: mitte.z + luvR.z * L / 2 };
      const lee = { x: mitte.x - luvR.x * L / 2, z: mitte.z - luvR.z * L / 2 };
      const start = { x: lee.x - luvR.x * 10 + quer.x * 14, z: lee.z - luvR.z * 10 + quer.z * 14 };
      const schiff = { x: lee.x - luvR.x * 10 - quer.x * 14, z: lee.z - luvR.z * 10 - quer.z * 14 };
      if (frei(lee, luv) && frei(start, schiff) && frei(start, luv) && frei(schiff, luv)) neu = { luv, lee, start, schiff, L };
    }
    bahn = neu ? { ...neu, tag, stufe: stufe(), luvR, quer } : { tag, stufe: stufe(), leer: true };
    return bahn;
  }
  function zeigeBahn(an) {
    const b = an ? legeBahn() : null;
    const soll = b && !b.leer ? `${b.tag}|${b.stufe}` : '';
    if (regattaGruppe.userData.sig === soll) return;
    regattaGruppe.userData.sig = soll;
    regattaGruppe.clear();
    if (!soll) return;
    [b.luv, b.lee, b.start, b.schiff].forEach((p, i) => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(tonneGeo, tonneMat));
      // Startlinie: Flaggen an beiden Enden
      if (i >= 2) g.add(new THREE.Mesh(stangeGeo, topMat), new THREE.Mesh(flaggeGeo, flaggeMat));
      g.position.set(p.x, 0, p.z);
      g.userData.phase = i * 2.3;
      regattaGruppe.add(g);
    });
  }
  let bahnPruef = 0;
  game.onTick(() => {
    const t = game.time;
    if (t - bahnPruef > 1.5 || t < bahnPruef) { bahnPruef = t; zeigeBahn(regattaHeute()); }
    for (const g of regattaGruppe.children) {
      const ph = g.userData.phase;
      g.position.y = Math.sin(t * 1.4 + ph) * 0.08 - 0.1;
      g.rotation.x = Math.sin(t * 1.2 + ph) * 0.06;
      g.rotation.z = Math.cos(t * 1.0 + ph) * 0.06;
    }
  });
  // Kurs eines Teilnehmers: von der Startlinie im Zickzack (Kreuzen) zur Luvtonne, vor dem Wind zur
  // Leetonne, noch einmal hinauf und zurueck ins Ziel. Jedes Boot kreuzt etwas anders (nr).
  function regattaKurs(b, nr) {
    const k = karteJetzt();
    const seite = nr % 2 ? 1 : -1;
    const breite = b.L * (0.22 + (nr % 3) * 0.06);
    const um = (p, f) => ({ x: p.x + b.quer.x * f, z: p.z + b.quer.z * f });
    const kreuz = (von, nach) => {
      const pts = [];
      for (const [a, s2] of [[0.3, 1], [0.6, -1], [0.85, 1]]) {
        const q = um({ x: von.x + (nach.x - von.x) * a, z: von.z + (nach.z - von.z) * a }, seite * s2 * breite);
        if (befahrbar(k, q.x, q.z, 3, 2)) pts.push(q);
      }
      return pts;
    };
    // Tonne auf der richtigen Seite runden: etwas aussen herum
    const rundeLuv = [um(b.luv, -seite * 6), { x: b.luv.x + b.luvR.x * 7, z: b.luv.z + b.luvR.z * 7 }, um(b.luv, seite * 6)];
    const rundeLee = [um(b.lee, seite * 6), { x: b.lee.x - b.luvR.x * 7, z: b.lee.z - b.luvR.z * 7 }, um(b.lee, -seite * 6)];
    const linie = { x: (b.start.x + b.schiff.x) / 2 + b.quer.x * (nr % 5 - 2) * 4, z: (b.start.z + b.schiff.z) / 2 + b.quer.z * (nr % 5 - 2) * 4 };
    return [linie, ...kreuz(linie, b.luv), ...rundeLuv, ...rundeLee, ...kreuz(b.lee, b.luv), ...rundeLuv,
      { x: linie.x + b.luvR.x * 4, z: linie.z + b.luvR.z * 4 }];
  }
  let regattaNr = 0;
  const regattaImBild = (b) => !!game.boatAnim.imBild?.((b.luv.x + b.lee.x) / 2, (b.luv.z + b.lee.z) / 2, b.L);
  // Abends: Ergebnis ins Logbuch, Siegerehrung am Segelclub (oder am Hafenmeister), alle Crews kommen hin
  game.on('sim:evening', () => {
    const b = bahn;
    const st = game.sim?.state;
    if (!b || b.leer || !b.teilnehmer?.length || b.geehrt || b.tag !== st?.day) return;
    b.geehrt = true;
    const ziel = (b.ziel ?? []).filter((id) => st.boats[id]);
    const rest = b.teilnehmer.filter((id) => !ziel.includes(id) && st.boats[id]);
    const folge = [...ziel, ...rest];
    if (!folge.length) return;
    const name = (id) => { const x = st.boats[id]; return x?.bootsname ? `„${x.bootsname}“` : `die ${x?.name ?? 'Yacht'}`; };
    const text = folge.length === 1
      ? `Regatta: ${name(folge[0])} segelt allein die Bahn ab`
      : `Regatta mit ${folge.length} Booten: ${name(folge[0])} gewinnt vor ${name(folge[1])}`;
    game.logbuch?.merken?.({ a: 'text', text: text.charAt(0).toUpperCase() + text.slice(1) });
    game.emit('regatta:ergebnis', { reihenfolge: folge, tag: st.day });
    // Siegerehrung: am Segelclub, sonst vor dem Hafenmeister; Crews der Teilnehmer und Leute aus dem Ort
    const club = game.services?.gruppe?.children?.find((c) => c.name === 'service-segelclub' && c.visible);
    const hm = game.buildings?.items?.find((it) => it.art === 'hafenmeister' && it.mesh?.visible);
    const ort = club?.position ?? hm?.mesh?.position;
    // vor der Tür (Landseite, zur Kamera hin), nicht hinter dem Haus am Wasser
    if (ort) game.people?.versammeln?.({ x: ort.x, z: ort.z + 9, anzahl: 6 + Math.min(6, folge.length), dauer: 70, boote: folge });
  });
  // Start nacheinander: wer an der Linie wartet, startet zu seiner Spielzeit (kein Pulk an der Tonne)
  const startWarten = [];
  game.onTick(() => {
    const uhr = game.sim?.state?.clock;
    if (uhr == null || !startWarten.length) return;
    for (let i = startWarten.length - 1; i >= 0; i--) {
      const w = startWarten[i];
      if (uhr >= w.uhr || uhr < w.uhr - 600) { startWarten.splice(i, 1); w.los(); }
    }
  });
  // Warteplatz vor der Startlinie: Boote verteilt in zwei Reihen, weit genug auseinander
  function vorStartPunkt(b, nr, info) {
    const k = karteJetzt(), { r, t } = bootMass(info);
    for (let v = 0; v < 12; v++) {
      const i = nr + v;
      const p = { x: b.lee.x - b.luvR.x * (24 + (i % 2) * 16) + b.quer.x * ((i % 6) - 2.5) * 15,
        z: b.lee.z - b.luvR.z * (24 + (i % 2) * 16) + b.quer.z * ((i % 6) - 2.5) * 15 };
      if (befahrbar(k, p.x, p.z, r, t)) return p;
    }
    return { x: b.lee.x - b.luvR.x * 20, z: b.lee.z - b.luvR.z * 20 };
  }

  game.on('dauer:auslaufen', ({ id, tage } = {}) => {
    const e = boats.get(id);
    if (!e) return;
    const n = draussenZahl++ % 4;
    const kreis = 18 + e.anim.info.length + n * 11;
    const runde = rundePunkt(e.anim.info, rundenWunsch(), kreis);
    // Regattatag: Teilnehmer und Begleitboote fahren zur Bahn statt eine Runde zu drehen
    const regatta = !tage && game.sim?.state?.boats?.[id]?.trip?.regatta && regattaHeute() ? legeBahn() : null;
    const regattaOk = regatta && !regatta.leer;
    // mehrtaegiger Toern: hinaus auf See bis zu einem Seezugang wie die abreisenden Gaeste
    const zugang = tage > 0 ? waehleZugang(e.anim.info) : null;
    const raus = zugang ? seeBahn([...seeTeil(zugang).see.reverse(), { x: zugang.x, z: zugang.z }]) : null;
    const segel = e.anim.info.kind === 'sail';
    const nr = regattaOk ? regattaNr++ : 0;
    const vorStart = regattaOk ? vorStartPunkt(regatta, nr, e.anim.info) : null;
    const ziel = regattaOk ? vorStart : raus ? raus[0] : tage > 0 ? (randPunkt(e.anim.info) ?? runde) : runde;
    const weg = [ziel];
    e.draussen = true;
    entferneMuenze(id, 0);
    e.anim.undock(weg, { sails: segel, route: true, takt: ablegeTakt, see: raus ? raus.slice(1) : undefined, warte: paeckchenFrei }).then((ok) => {
      if (!ok || boats.get(id) !== e) return;
      if (tage > 0) {
        // mehrtaegiger Toern: aus dem Bild, kommt mit 'dauer:einlaufen' zurueck
        e.faehrt = true;
        entferne(id);
        return;
      }
      if (regattaOk) {
        if (!segel) {
          // Begleitboot: liegt am Startschiff und passt auf
          e.anim.hold(regatta.schiff, { radius: 10 + (nr % 3) * 4, speed: e.anim.cfg.cruise * 0.4, sails: false, state: 'sailing' });
          return;
        }
        // an der Linie kreuzen, bis das Boot dran ist; dann die Bahn abfahren
        e.anim.hold(vorStart, { radius: 6, speed: e.anim.cfg.cruise * 0.35, sails: true, state: 'sailing' });
        const uhr = game.sim?.state?.clock ?? 0;
        // Verfolgungsstart: das erste Boot startet mit dem Startschuss, die anderen in festen Abständen
        (regatta.teilnehmer ||= []).includes(id) || regatta.teilnehmer.push(id);
        startWarten.push({ uhr: uhr + 3 + (nr % 6) * 4, los: () => {
          if (boats.get(id) !== e || !e.draussen) return;
          if (!regatta.gestartet) {
            regatta.gestartet = true;
            if (regattaImBild(regatta)) game.emit('sound', { name: 'regatta' });
          }
          e.anim.sailTo(regattaKurs(regatta, nr), { sails: true, speed: e.anim.cfg.cruise * (1.05 + (nr % 3) * 0.06) }).then((fertig) => {
            if (!fertig || boats.get(id) !== e || !e.draussen) return;
            // Zieleinlauf: Reihenfolge für die Siegerehrung, der Erste bekommt ein Horn
            (regatta.ziel ||= []).includes(id) || regatta.ziel.push(id);
            if (regatta.ziel.length === 1 && regattaImBild(regatta)) game.emit('horn', { groesse: 'M', stoesse: 2 });
            // im Ziel: kreuzt gemuetlich hinter der Linie, bis es heimgeht
            e.anim.hold(vorStart, { radius: 10 + (nr % 4) * 5, speed: e.anim.cfg.cruise * 0.5, sails: true, state: 'sailing' });
          });
        } });
        return;
      }
      // Tagestoern: grosse, gemuetliche Kreise unter Segeln oder Motor
      // jedes Boot auf einem eigenen Kreis, damit sich die Runden nicht kreuzen
      // Kreis nur so gross, wie freies Wasser um den Punkt ist
      const rad = Math.max(8, Math.min(kreis, runde.frei - bootMass(e.anim.info).r - 2));
      e.anim.hold(ziel, { radius: rad, speed: e.anim.cfg.cruise * 0.7, sails: segel, state: 'sailing' });
    });
  });

  let draussenZahl = 0;
  // warten: Dauerlieger ist früher zurück, sein Platz ist noch belegt. Er kreist vor dem Hafen,
  // bis der Gast umgelegt ist (features/dauerlieger.js), und kommt dann mit einem zweiten
  // 'dauer:einlaufen' ohne warten herein. info: Bootsdaten, falls das Boot nicht in game.sim.boote steht.
  game.on('dauer:einlaufen', ({ id, platzId, warten, info: mitInfo } = {}) => {
    let e = boats.get(id), zurueck = null;
    if (!e) {
      const info = sucheInfo(id) ?? mitInfo;
      if (!info) return;
      e = erzeuge(info);
      // vom mehrtaegigen Toern zurueck: von weit draussen ueber einen Seezugang (nicht beim Warten,
      // dann kreist es gleich vor dem Hafen)
      zurueck = warten ? null : waehleZugang(e.anim.info);
      const start = zurueck ? { x: zurueck.x, z: zurueck.z } : freierStart(e.anim.info);
      e.anim.place(start.x, start.z, 0);
    }
    e.faehrt = false;
    if (warten) {
      // wartet wie die Tagestörns auf freiem Wasser (Punkt über die Fahrwege, Kreis so groß wie das freie Wasser)
      e.draussen = true;
      const n = draussenZahl++ % 4;
      const kreis = 14 + e.anim.info.length + n * 9;
      const ziel = rundePunkt(e.anim.info, rundenWunsch(), kreis);
      e.anim.undock([ziel], { sails: false, route: true }).then((ok) => {
        if (!ok || boats.get(id) !== e || !e.draussen) return;
        const rad = Math.max(8, Math.min(kreis, ziel.frei - bootMass(e.anim.info).r - 2));
        e.anim.hold(ziel, { radius: rad, speed: e.anim.cfg.cruise * 0.5, sails: false, state: 'waiting' });
      });
      return;
    }
    e.draussen = false;
    const b = platzBerth(platzId ?? e.info.platz);
    if (!b) return;
    // Liegt noch ein Gast in der Box (er wird gerade umgelegt oder legt morgens ab), erst warten
    e.anim.dock(b, { route: true, seconds: 30, waitFor: () => platzFrei(platzId ?? e.info.platz, b, e.anim), see: zurueck ? seeBahn(seeTeil(zurueck).see) : undefined });
  });

  /** Ist die Box frei? Kein anderes Boot hat sie als Platz, und keins steht noch in ihr. */
  function platzFrei(platzId, b, selbst) {
    const fx = Math.cos(b.heading), fz = -Math.sin(b.heading);
    for (const o of game.boatAnim.boats) {
      if (o === selbst) continue;
      if (o.berth?.id === platzId) return false;
      // fest an einem anderen Platz (Nachbarbox): stoert nicht
      if (o.moored && o.berth) continue;
      // nur Boote, deren Mitte im Rechteck der Box liegt (Boxachsen), mit etwas Rand fuer den Rumpf
      const rx = o.x - b.x, rz = o.z - b.z;
      const laengs = rx * fx + rz * fz, quer = rx * -fz + rz * fx;
      if (Math.abs(laengs) < b.length / 2 + o.info.length * 0.3 && Math.abs(quer) < b.width / 2) return false;
    }
    return true;
  }

  function sucheInfo(id) {
    return game.sim?.boote?.find?.((b) => b.id === id) ?? null;
  }

  // Alle Boote aus dem Spielstand sofort an ihre Plaetze legen (Start, Laden, neues Spiel)
  // sprung: die Spielzeit ist um Tage gesprungen (Winter ueberspringen): niemand faehrt mehr zu Ende,
  // sonst faehrt ein Boot von vor dem Winter durch den Steg und ueber den neuen Gast in seiner Box (F7)
  function abgleich(laden = false, sprung = false) {
    baueBojen();
    const liste = game.sim?.boote ?? [];
    const ids = new Set(liste.map((b) => b.id));
    // Boote, die gerade abfahren, fahren zu Ende (sie sind in den Regeln schon weg)
    // Nachts abgerechnete Gaeste (sim:departed) liegen bis zum Ablegen am Vormittag noch in der Box,
    // nach dem Laden eines Spielstands sind sie weg (PR 108).
    for (const [id, e] of [...boats]) if (!ids.has(id) && (sprung || (!e.faehrt && !e.draussen)) && (laden || !e.abgerechnet)) entferne(id);
    for (const info of liste) {
      const e = erzeuge(info);
      e.info = { ...e.info, ...info };
      e.faehrt = false;
      if (sprung && !e.draussen && e.anim.state !== 'idle' && e.anim.state !== 'moored') e.anim.cancel();
      else if (e.anim.state !== 'idle' && e.anim.state !== 'moored') continue;   // faehrt gerade
      if (e.draussen) continue;                                          // Dauerlieger auf Runde
      const b = info.platz ? platzBerth(info.platz, e.anim.info) : warteplatz(info.boje ?? 0, e.anim);
      if (!b) continue;
      // Stufenausbau (nicht Laden): liegt das Boot sichtbar woanders, faehrt es hin statt zu springen
      const weit = Math.hypot((b.x ?? e.anim.x) - e.anim.x, (b.z ?? e.anim.z) - e.anim.z) > 1.5;
      if (!laden && weit && e.anim.model.visible !== false && (e.anim.moored || e.anim.state === 'moored')) e.anim.dock(b, { route: true });
      else {
        e.anim.moorAt(b);
        // sofort an die Boje gelegt (Laden, Stufenwechsel): auch das ist "an der Boje" fuer die Spielregeln
        if (!info.platz) game.emit('boot:an-boje', { id: info.id, boje: info.boje ?? 0, platz: String(b.id ?? '') });
      }
    }
    for (const id of [...muenzen.keys()]) if (!boats.has(id)) entferneMuenze(id);
    const st = game.sim?.state ?? game.state;
    // Münzen nur über Booten, die schon in ihrer Box fest sind; wer noch hinfährt, bekommt sie beim Festmachen
    for (const [id, b] of Object.entries(st?.boats ?? {})) {
      if (!(b?.pendingFee > 0)) continue;
      const e = boats.get(Number(id));
      if (!e) continue;
      if (amPlatz(e.anim)) zeigeMuenze(Number(id));
      else e.muenzeWartet = true;
    }
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
  game.on('winter:uebersprungen', () => abgleich(true, true));

  game.boatView = {
    get boote() { return [...boats.values()].map((e) => ({ id: e.info.id, zustand: e.anim.state, anim: e.anim })); },
    boot: (id) => boats.get(id)?.anim ?? null,
    bojen: () => bojenPos(),
    // Liegeplatz in Weltkoordinaten wie beim Anlegen (Paeckchen, P27) und freies Wasser der Fahrwasser-Karte
    platzBerth: (id, info = null) => platzBerth(id, info),
    frei: (x, z, r, t = 0) => befahrbar(karteJetzt(), x, z, r, t),
    // Stege, Molen und Platzrechtecke der aktuellen Karte (Weltkoordinaten, world/fahrwasser.js)
    hindernisse: () => { karteJetzt(); return karteHindernisse; },
    paeckchenFrei,
  };
}

export default init;
