// Tiere als seltene Besucher im Bild (Paket P40, docs/besucher.md): eine Schwanenfamilie im ruhigen
// Hafenwasser und ein Schweinswal draußen vor der Einfahrt. Reine Belebung und Fotomotiv, keine Regeln:
// Wann sie kommen, steht im Spielstand (features/besucher-regeln.js, tierePlanen); dieses Modul zeigt sie.
//
// Schwäne schwimmen langsam hintereinander (zwei Alte, drei bis vier graue Junge) über ruhiges Wasser
// (Zonen flach, Becken, Binnenwasser), weichen Booten aus und schwimmen am Ende aus dem Bild ans Ufer.
// Der Schweinswal taucht auf offener See alle paar Sekunden mit Rücken und Finne auf, manchmal mit Kalb.
//
// Schnittstelle: game.besucherTiere = { zeige(art, { seed, dauer }), weg(art), aktiv(), motiv(art) }
//   motiv(art) -> { x, z, r, sichtbar } für den Fotomodus (r: Radius in Metern), sonst null.

import * as THREE from 'three';

const SCHWAN_TEMPO = 0.45;        // m/s Spielzeit
const WAL_TEMPO = 1.6;            // m/s Spielzeit
const WAL_TAKT = 4.2;             // Sekunden zwischen zwei Atemzügen
const SCHWAN_ZONEN = new Set([1, 7, 8]);    // flach, Becken, Binnenwasser (render/landschaft/zonen.js)
const SEE_ZONEN = new Set([9]);             // offene See

// Fester Zufall (mulberry32) für Wege, damit dasselbe Spiel dasselbe Bild zeigt
function zufallAus(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MATS = new Map();
function mat(c) {
  if (!MATS.has(c)) MATS.set(c, new THREE.MeshLambertMaterial({ color: c, flatShading: true }));
  return MATS.get(c);
}

/** Ein Schwan aus wenigen Formen: Körper, Hals, Kopf mit orangem Schnabel. Länge etwa 1,5 m mal s. */
function baueSchwan(jung, s = 1) {
  const g = new THREE.Group();
  const weiss = jung ? 0x9a9690 : 0xfbf8f0;
  const koerper = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), mat(weiss));
  koerper.scale.set(1.5, 0.62, 0.9);
  koerper.position.y = 0.16;
  g.add(koerper);
  // hochgestellte Flügeldecken
  const fluegel = new THREE.Mesh(new THREE.SphereGeometry(0.42, 7, 5), mat(jung ? 0x8a867f : 0xf2eee4));
  fluegel.scale.set(1.3, 0.55, 0.95);
  fluegel.position.set(-0.18, 0.34, 0);
  g.add(fluegel);
  if (!jung) {
    // S-Hals aus drei Stücken
    const hals = [[0.55, 0.38, 0.12, 0.3], [0.66, 0.68, 0.1, -0.15], [0.62, 0.95, 0.09, 0.35]];
    for (const [x, y, r, rz] of hals) {
      const h = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r, 0.36, 6), mat(weiss));
      h.position.set(x, y, 0);
      h.rotation.z = rz;
      g.add(h);
    }
    const kopf = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 5), mat(weiss));
    kopf.scale.set(1.4, 1, 1);
    kopf.position.set(0.7, 1.12, 0);
    g.add(kopf);
    const schnabel = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 5), mat(0xf08a3c));
    schnabel.rotation.z = -Math.PI / 2 - 0.35;
    schnabel.position.set(0.86, 1.07, 0);
    g.add(schnabel);
  } else {
    const hals = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.4, 6), mat(weiss));
    hals.position.set(0.45, 0.42, 0);
    hals.rotation.z = -0.25;
    g.add(hals);
    const kopf = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), mat(weiss));
    kopf.position.set(0.52, 0.64, 0);
    g.add(kopf);
    const schnabel = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 5), mat(0x5c6878));
    schnabel.rotation.z = -Math.PI / 2;
    schnabel.position.set(0.63, 0.63, 0);
    g.add(schnabel);
  }
  g.scale.setScalar(s * (jung ? 0.6 : 1));
  return g;
}

/** Rücken mit Finne eines Schweinswals (etwa 1,7 m mal s), Ursprung auf der Längsachse. */
function baueWal(s = 1) {
  const g = new THREE.Group();
  const grau = 0x4a5562;
  const ruecken = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 6), mat(grau));
  ruecken.scale.set(1.75, 0.55, 0.62);
  g.add(ruecken);
  const bauch = new THREE.Mesh(new THREE.SphereGeometry(0.48, 8, 5), mat(0xc9ced4));
  bauch.scale.set(1.6, 0.4, 0.55);
  bauch.position.y = -0.12;
  g.add(bauch);
  // Dreieckige Finne
  const f = new THREE.Shape([new THREE.Vector2(-0.25, 0), new THREE.Vector2(0.18, 0), new THREE.Vector2(-0.05, 0.32)]);
  const finne = new THREE.Mesh(new THREE.ExtrudeGeometry(f, { depth: 0.06, bevelEnabled: false }).translate(0, 0, -0.03), mat(0x3b4450));
  finne.position.set(-0.1, 0.22, 0);
  g.add(finne);
  const fluke = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.04, 0.55), mat(grau));
  fluke.position.set(-0.85, 0, 0);
  g.add(fluke);
  g.scale.setScalar(s);
  return g;
}

/** Wellenring beim Auftauchen. */
function baueRing() {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.85, 20), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.05;
  return m;
}

export function init(game) {
  const wurzel = new THREE.Group();
  wurzel.name = 'besucher-tiere';
  game.scene?.add(wurzel);
  const tiere = new Map();       // art -> Zustand

  const ls = () => game.landscape;
  const wasser = (x, z) => (ls()?.istWasser ? ls().istWasser(x, z) : true);
  const zone = (x, z) => game.gelaende?.zone?.(x, z) ?? null;
  const tiefe = (x, z) => (ls()?.tiefeBei ? ls().tiefeBei(x, z) : 3);
  const imBild = (x, z, r) => (game.boatAnim?.imBild ? game.boatAnim.imBild(x, z, r) : true);

  // Boote in der Nähe (für Schwäne): Positionen aller Boote im Bild
  function bootePos() {
    const out = [];
    for (const b of game.boatView?.boote ?? []) {
      const m = b.anim?.model ?? b.anim?.group;
      const p = m?.position;
      if (p) out.push({ x: p.x, z: p.z, r: Math.max(3, (m.userData?.length ?? 8) * 0.6) });
    }
    return out;
  }

  /** Mitte des Hafens: der Mittelpunkt der Liegeplätze der aktuellen Stufe, sonst die Startansicht. */
  function hafenMitte() {
    const r = game.gelaende?.startRect?.();
    if (r) return { x: (r.minX + r.maxX) / 2, z: (r.minZ + r.maxZ) / 2, w: r.maxX - r.minX };
    return { x: 0, z: -60, w: 200 };
  }

  /** Punkte einer Zone in der Nähe suchen (Raster, ab der Mitte nach außen, nach Seed gemischt). */
  function sucheZone(zonen, rnd, { mitte, min = 0, max = 250, tiefeMin = 0.4, n = 40 } = {}) {
    const out = [];
    for (let i = 0; i < 1400 && out.length < n; i++) {
      const a = rnd() * Math.PI * 2;
      const d = min + Math.sqrt(rnd()) * (max - min);
      const x = mitte.x + Math.cos(a) * d, z = mitte.z + Math.sin(a) * d;
      const zo = zone(x, z);
      if (zo != null ? !zonen.has(zo) : !wasser(x, z)) continue;
      if (tiefe(x, z) < tiefeMin) continue;
      out.push({ x, z });
    }
    return out;
  }

  // Strecke ganz im passenden Wasser?
  function streckeFrei(a, b, zonen) {
    const n = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 3));
    for (let i = 0; i <= n; i++) {
      const x = a.x + ((b.x - a.x) * i) / n, z = a.z + ((b.z - a.z) * i) / n;
      const zo = zone(x, z);
      if (zo != null ? !zonen.has(zo) : !wasser(x, z)) return false;
    }
    return true;
  }

  /** Weg aus mehreren Stücken durch freies Wasser der Zonen, ab start. */
  function weg(start, zonen, rnd, laenge, schritt = [14, 32]) {
    const pts = [start];
    let rest = laenge, winkel = rnd() * Math.PI * 2;
    for (let k = 0; k < 40 && rest > 0; k++) {
      const p = pts[pts.length - 1];
      let ok = null;
      for (let v = 0; v < 14; v++) {
        const w = winkel + (rnd() - 0.5) * (0.8 + v * 0.35);
        const d = schritt[0] + rnd() * (schritt[1] - schritt[0]);
        const q = { x: p.x + Math.cos(w) * d, z: p.z + Math.sin(w) * d };
        if (streckeFrei(p, q, zonen)) { ok = q; winkel = w; break; }
      }
      if (!ok) break;
      pts.push(ok);
      rest -= Math.hypot(ok.x - p.x, ok.z - p.z);
    }
    return pts;
  }

  function entferne(art) {
    const t = tiere.get(art);
    if (!t) return;
    wurzel.remove(t.gruppe);
    tiere.delete(art);
  }

  function zeigeSchwaene({ seed = 1, dauer = 160 } = {}) {
    const rnd = zufallAus(seed);
    const mitte = hafenMitte();
    const pkte = sucheZone(SCHWAN_ZONEN, rnd, { mitte, max: Math.max(80, mitte.w * 0.45), tiefeMin: 0.3 });
    if (!pkte.length) return false;
    // Möglichst nah an der Mitte des Bildes beginnen, damit man sie sieht
    pkte.sort((a, b) => Math.hypot(a.x - mitte.x, a.z - mitte.z) - Math.hypot(b.x - mitte.x, b.z - mitte.z));
    const start = pkte[Math.floor(rnd() * Math.min(6, pkte.length))];
    const pfad = weg(start, SCHWAN_ZONEN, rnd, SCHWAN_TEMPO * dauer + 30);
    if (pfad.length < 2) return false;
    const gruppe = new THREE.Group();
    gruppe.name = 'schwaene';
    const n = 3 + Math.floor(rnd() * 2);
    const tiereListe = [{ obj: baueSchwan(false, 1.25), ab: 0 }];
    for (let i = 0; i < n; i++) tiereListe.push({ obj: baueSchwan(true, 1.25), ab: 1.9 + i * 1.3 });
    tiereListe.push({ obj: baueSchwan(false, 1.3), ab: 2.4 + n * 1.3 });
    for (const t of tiereListe) { t.phase = rnd() * 6; gruppe.add(t.obj); }
    wurzel.add(gruppe);
    entferne('schwaene');
    tiere.set('schwaene', { art: 'schwaene', gruppe, tiere: tiereListe, pfad, s: 0, dauer, zeit: 0, ausweich: { x: 0, z: 0 } });
    return true;
  }

  function zeigeWal({ seed = 1, dauer = 100 } = {}) {
    const rnd = zufallAus(seed);
    const mitte = hafenMitte();
    // Offene See nicht zu weit draußen: ab dem Rand des Hafens bis gut 250 m dahinter
    const pkte = sucheZone(SEE_ZONEN, rnd, { mitte, min: mitte.w * 0.25, max: mitte.w * 0.6 + 220, tiefeMin: 3, n: 30 });
    if (!pkte.length) return false;
    pkte.sort((a, b) => Math.hypot(a.x - mitte.x, a.z - mitte.z) - Math.hypot(b.x - mitte.x, b.z - mitte.z));
    const start = pkte[Math.floor(rnd() * Math.min(5, pkte.length))];
    const pfad = weg(start, SEE_ZONEN, rnd, WAL_TEMPO * dauer + 40, [30, 60]);
    if (pfad.length < 2) return false;
    const gruppe = new THREE.Group();
    gruppe.name = 'schweinswal';
    const liste = [{ obj: baueWal(1.4), ab: 0, seite: 0, versatz: 0 }];
    if (rnd() < 0.5) liste.push({ obj: baueWal(0.85), ab: 1.2, seite: 1.6, versatz: 0.5 });   // Kalb neben der Mutter
    for (const t of liste) { t.ring = baueRing(); gruppe.add(t.obj, t.ring); t.ring.visible = false; }
    wurzel.add(gruppe);
    entferne('schweinswal');
    tiere.set('schweinswal', { art: 'schweinswal', gruppe, tiere: liste, pfad, s: 0, dauer, zeit: 0 });
    return true;
  }

  // Lage auf dem Pfad nach Strecke s: Punkt und Richtung
  function aufPfad(pfad, s) {
    let rest = Math.max(0, s);
    for (let i = 0; i < pfad.length - 1; i++) {
      const a = pfad[i], b = pfad[i + 1];
      const l = Math.hypot(b.x - a.x, b.z - a.z);
      if (rest <= l || i === pfad.length - 2) {
        const t = l ? Math.min(1, rest / l) : 0;
        return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, dir: Math.atan2(b.z - a.z, b.x - a.x), ende: i === pfad.length - 2 && rest >= l };
      }
      rest -= l;
    }
    const p = pfad[pfad.length - 1];
    return { x: p.x, z: p.z, dir: 0, ende: true };
  }

  function tickSchwaene(t, dt, uhr) {
    // Boote in der Nähe: langsamer, zur Seite ausweichen
    const kopf = aufPfad(t.pfad, t.s);
    let druck = 0;
    for (const b of bootePos()) {
      const d = Math.hypot(b.x - kopf.x, b.z - kopf.z);
      if (d < b.r + 6) druck = Math.max(druck, 1 - d / (b.r + 6));
    }
    t.s += dt * SCHWAN_TEMPO * (1 - 0.6 * druck);
    for (const s of t.tiere) {
      const p = aufPfad(t.pfad, t.s - s.ab * 1.0);
      s.obj.position.set(p.x, 0.02 + Math.sin(uhr * 1.6 + s.phase) * 0.03 + (game.landscape?.pegel ?? 0), p.z);
      // Bug (+x im Modell) in Fahrtrichtung
      s.obj.rotation.y = -p.dir + Math.sin(uhr * 0.7 + s.phase) * 0.08;
    }
    return kopf.ende;
  }

  function tickWal(t, dt, uhr) {
    t.s += dt * WAL_TEMPO;
    let ende = false;
    for (const w of t.tiere) {
      const p = aufPfad(t.pfad, t.s - w.ab * 2);
      ende ||= p.ende;
      const nx = -Math.sin(p.dir), nz = Math.cos(p.dir);
      const x = p.x + nx * w.seite, z = p.z + nz * w.seite;
      // Atemzug: Rücken rollt in einem Bogen durch die Oberfläche
      const ph = ((t.zeit + w.versatz) % WAL_TAKT) / WAL_TAKT;
      const auf = ph < 0.32 ? Math.sin((ph / 0.32) * Math.PI) : 0;
      w.obj.visible = auf > 0.02;
      w.obj.position.set(x, -0.55 + auf * 0.62, z);
      w.obj.rotation.set(0, -p.dir, 0);
      w.obj.rotateZ(((ph / 0.32) - 0.5) * -0.9);
      // Ring breitet sich aus, sobald der Rücken auftaucht
      const rp = ph < 0.6 ? ph / 0.6 : 1;
      w.ring.visible = ph < 0.6;
      w.ring.position.set(x, 0.05, z);
      w.ring.scale.setScalar(0.8 + rp * 2.4);
      w.ring.material.opacity = 0.65 * (1 - rp);
    }
    return ende;
  }

  // Echte Zeit mal Spieltempo (PR 182: sichtbare Effekte nicht am Tick-dt takten), in der Pause steht alles
  let letzte = performance.now();
  game.onTick?.(() => {
    const jetzt = performance.now();
    const echt = Math.min(0.1, (jetzt - letzte) / 1000);
    letzte = jetzt;
    if (!tiere.size) return;
    const tempo = game.paused ? 0 : (game.speed ?? 1);
    const dt = echt * tempo;
    const uhr = jetzt / 1000;
    for (const t of [...tiere.values()]) {
      t.zeit += dt;
      const ende = t.art === 'schwaene' ? tickSchwaene(t, dt, uhr) : tickWal(t, dt, uhr);
      // Nach der Dauer verschwinden sie, sobald sie nicht mehr im Bild sind (oder am Ende des Wegs)
      const k = motiv(t.art);
      if ((t.zeit > t.dauer && !(k?.sichtbar)) || ende || t.zeit > t.dauer * 2.5) entferne(t.art);
    }
  });

  /** Lage eines Tiers für Fotomodus und Meldung (Mitte der Gruppe), sonst null. */
  function motiv(art) {
    const t = tiere.get(art);
    if (!t) return null;
    let x = 0, z = 0, n = 0, sichtbarAuf = false;
    for (const s of t.tiere) { x += s.obj.position.x; z += s.obj.position.z; n++; if (s.obj.visible) sichtbarAuf = true; }
    if (!n) return null;
    x /= n; z /= n;
    let r = 2;
    for (const s of t.tiere) r = Math.max(r, Math.hypot(s.obj.position.x - x, s.obj.position.z - z) + 1.5);
    // Der Schweinswal zählt als im Bild, solange er in den letzten Sekunden aufgetaucht ist
    const sichtbar = imBild(x, z, r) && (art !== 'schweinswal' || sichtbarAuf || (t.zeit % WAL_TAKT) / WAL_TAKT < 0.6);
    return { x, z, r, sichtbar };
  }

  game.besucherTiere = {
    zeige: (art, opt = {}) => (art === 'schwaene' ? zeigeSchwaene(opt) : art === 'schweinswal' ? zeigeWal(opt) : false),
    weg: entferne,
    aktiv: () => [...tiere.keys()],
    motiv,
    _tiere: tiere,
  };
}
