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
import { baueKarte, route, hindernisseAusHafen, bootMass, erreichbar, befahrbar, sichtlinie, zellMitte } from '../world/fahrwasser.js';

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
      const k = karteJetzt();
      const idx = plaetze.findIndex((q, i) => !anker.has(i) && (RANG[q.groesse] ?? 2) >= g && befahrbar(k, q.x, q.z, mass.r * 0.8, mass.t));
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
    const p = ankerSlot(k, gross ? 60 : 20);
    return reserviere({ id: `anker-${k}`, x: mitte.x + p.x, z: mitte.z + p.z, heading: b.heading, kind: 'buoy', abstand: gross ? 60 : 20, kreis: gross ? 30 : 10 });
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

  // Abfahrende Boote, die aus dem Bild sind, sind fort: nicht erst bis zum Revierrand fahren.
  // So staut sich auch bei schnellem Vorspulen ueber viele Tage nichts vor der Einfahrt.
  let fortT = 0;
  game.onTick((dt) => {
    fortT += dt;
    if (fortT < 0.5) return;
    fortT = 0;
    for (const [id, e] of [...boats]) {
      if (!e.faehrt || e.anim.berth || e.anim.state !== 'leaving') continue;
      if (!game.boatAnim.imBild?.(e.anim.x, e.anim.z, e.anim.info.length)) entferne(id);
    }
  });

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
        // Nachts abgerechnete Gaeste sind nicht mehr in den Spielregeln, liegen aber bis zum Ablegen am
        // Vormittag in der Box: fuer sie gilt, ob sie zuletzt bezahlt hatten.
        if (sb) e.bezahlt = !!game.sim?.istBezahlt?.(id);
        const bezahlt = sb ? e.bezahlt : !!(e.abgerechnet && e.bezahlt);
        const an = !sb?.stationed && !e.faehrt && e.anim.berth?.kind !== 'buoy' &&
          (e.anim.moored || e.anim.state === 'casting-off') && bezahlt;
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
    e.anim.remove();
  }

  // --- Fahrwasser: Wege, Start- und Zielpunkte aus der Karte des Gelaendes (world/fahrwasser.js) ---
  // Kein Boot faehrt durch Land, Strand, Molen oder Stege: jede Fahrt sucht ihren Weg im Raster aus
  // Wassertiefe (game.landscape.tiefeBei) und Hindernissen (Stege und Liegeplaetze aus HAFEN).
  const BEREICH = { x0: -300, x1: 320, z0: -340, z1: 140 };
  let karte = null, karteSig = '', karteAlt = true;
  const flaechen = new Map();         // Groessenklasse -> { r, t, sektoren }
  function karteJetzt() {
    const st = stufe();
    const ls = game.landscape;
    const sig = `${st}|${ls?.stufe ?? ''}|${ls?.region ?? ''}|${game.stegbild?.aktuell?.()?.nr ?? HAFEN.stegbild?.nr ?? 0}|${game.gelaende?.aktuell?.()?.nr ?? 1}`;
    if (karte && !karteAlt && sig === karteSig) return karte;
    const tiefe = ls?.tiefeBei ? (x, z) => ls.tiefeBei(x, z) : () => 3;
    const w = ls?.warteplaetze ?? {};
    const weich = [];
    for (const bj of w.bojen ?? []) weich.push({ x: bj.x, z: bj.z, r: 14, kosten: 3 });
    for (const a of w.ankerplaetze ?? []) weich.push({ x: a.x, z: a.z, r: (a.schwoikreisM ?? 8) + 4, kosten: 2 });
    karte = baueKarte({ tiefe, bereich: BEREICH, ...hindernisseAusHafen(HAFEN, st), weich, engRadius: 3.6 });
    karteSig = sig;
    karteAlt = false;
    flaechen.clear();
    game.boatAnim.engstellenNeu?.();
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
        const q = { x: p.x + (Math.abs(p.z - BEREICH.z0) < 1e3 && p.z < BEREICH.z0 ? d * 20 : 0), z: p.z + (p.z >= BEREICH.z0 ? d * 20 : 0) };
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
    return route(k, { x: boot.x, z: boot.z }, ziel, { r, rMin, t, rechts });
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
  };

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

  // --- Ereignisse der Spielregeln -----------------------------------------------------------
  let ankunftT = -1e9;
  game.on('boot-kommt', (info) => {
    if (!info || info.id == null) return;
    if (bojenStufe !== stufe()) baueBojen();
    const e = erzeuge(info);
    const start = freierStart(e.anim.info, info.herkunft);
    const ziel = warteplatz(info.boje ?? 0, e.anim);
    // Antippen und Ziehen erst, wenn das Boot an der Boje fest ist (siehe boat:moored unten)
    e.pick = e.anim.model.userData.pick;
    delete e.anim.model.userData.pick;
    e.anim.place(start.x, start.z, Math.atan2(-(ziel.z - start.z), ziel.x - start.x));
    if (e.anim.info.kind === 'sail') e.anim.setSails(true);
    // Segelboote bergen die Segel vor der Boje (dock() erledigt das), dann Leine an die Boje.
    // Kommen mehrere im selben Augenblick, laufen sie nacheinander los (keine Wellen).
    const jetzt = game.time ?? 0;
    ankunftT = Math.max(jetzt, ankunftT + 3 + Math.random() * 6);
    e.anim.dock(ziel, { route: true, verzoegerung: ankunftT - jetzt });
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
    // Ein Boot ohne Auftrag (nach dem Laden) liegt an der Boje. Kam es gerade erst (boot-kommt im
    // selben Schritt, Spielregel 'direkt einfahren bei vollen Bojen'), hat es schon seine Anfahrt
    // und faehrt von See direkt in die Box.
    if (!e.anim.moored && e.anim.state === 'idle' && !e.anim.task && !e.anim.tasks.length) e.anim.moorAt(warteplatz(e.info.boje ?? 0, e.anim));
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
    e.anim.dock(b, { route: true, waitFor: () => platzFrei(platz, b, e.anim) });
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

  game.on('boot-faehrt', ({ id } = {}) => {
    const e = boats.get(id);
    if (!e) return;
    // niemand sieht es: gleich weg (spart Rueckstau beim schnellen Vorspulen)
    if (!game.boatAnim.imBild?.(e.anim.x, e.anim.z, e.anim.info.length)) { entferne(id); return; }
    const ziel = randPunkt(e.anim.info) ?? { x: e.anim.x, z: e.anim.z - 300 };
    const weg = [ziel];
    e.faehrt = true;
    entferneMuenze(id, 0);
    e.anim.undock(weg, { sails: e.anim.info.kind === 'sail', route: true }).then((ok) => {
      if (ok && boats.get(id) === e) entferne(id);
    });
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
    sp.userData.h = (window.innerWidth < 700 ? 0.05 : 0.036) * (hoch / 18);
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
    else h *= 2;
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
    } else if (w && w.base + w.bonus === d.amount && w.bonus > 0) {
      teile = [{ text: eur(w.base), farbe: '#ffd75e' }, { text: ` + ${eur(w.bonus)}`, farbe: '#8fe07a' }];
    } else teile = [{ text: eur(d.amount), farbe: '#ffd75e' }];
    if (!d.round && w?.nights > 1 && w.base + w.bonus === d.amount) unten = `${w.nights} Nächte`;
    const sp = textSprite(teile, unten);
    sp.position.copy(pos).add(new THREE.Vector3(0, 0.9, 0));
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
    if (e) e.abgerechnet = true;     // bleibt sichtbar, bis 'boot-faehrt' am Vormittag kommt
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
    3: [110, 300],     // Ostsee vor der Einfahrt
    5: [60, 380],      // Ostsee vor dem Aussenhafen
  };
  const rundenWunsch = () => {
    const st = stufe();
    return welt(st >= 5 ? RUNDE[5] : st >= 3 ? RUNDE[3] : RUNDE[1]);
  };

  game.on('dauer:auslaufen', ({ id, tage } = {}) => {
    const e = boats.get(id);
    if (!e) return;
    const n = draussenZahl++ % 4;
    const kreis = 18 + e.anim.info.length + n * 11;
    const runde = rundePunkt(e.anim.info, rundenWunsch(), kreis);
    const ziel = tage > 0 ? (randPunkt(e.anim.info) ?? runde) : runde;
    const segel = e.anim.info.kind === 'sail';
    const weg = [ziel];
    e.draussen = true;
    entferneMuenze(id, 0);
    e.anim.undock(weg, { sails: segel, route: true }).then((ok) => {
      if (!ok || boats.get(id) !== e) return;
      if (tage > 0) {
        // mehrtaegiger Toern: aus dem Bild, kommt mit 'dauer:einlaufen' zurueck
        e.faehrt = true;
        entferne(id);
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
  game.on('dauer:einlaufen', ({ id, platzId } = {}) => {
    let e = boats.get(id);
    if (!e) {
      const info = sucheInfo(id);
      if (!info) return;
      e = erzeuge(info);
      const start = freierStart(e.anim.info);
      e.anim.place(start.x, start.z, 0);
    }
    e.draussen = false;
    e.faehrt = false;
    const b = platzBerth(platzId ?? e.info.platz);
    if (!b) return;
    e.anim.dock(b, { route: true, seconds: 30 });
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
