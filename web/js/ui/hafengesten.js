// Überraschende Gesten (P26, docs/hafengesten.md): kleine Dinge, die den Hafen lebendig machen.
// Gilt für Handy, Tablet und PC gleich (Pointer Events), berührt keine Spielregel außer dem Kassieren
// über das Hafenhorn, das genau so viel darf wie der Knopf "Kassieren".
//
//   Hafenhorn   Hafenmeisterhaus oder Hafenbüro gedrückt halten (0,5 s, ein Ring füllt sich): das Horn
//               tönt, alle offenen Münzen fliegen hörbar zum Büro in die Kasse. Erst ab "Hafenmeister
//               mit Funk" (rules.office.collectAllButton), vorher steht das Haus noch nicht.
//   Fernglas    Doppeltipp (Doppelklick) auf ein Boot, das nicht an der Boje wartet: die Kamera fährt
//               heran und folgt ihm, dazu ein Steckbrief mit Bild, Art, Maßen, Heimathafen und was es
//               gerade tut. Jede eigene Bewegung der Karte, Esc oder "Fernglas ab" beendet es.
//               (Wartende Boote haben schon ihre Karte; Doppelklick lässt sie am PC weiter einfahren.)
//   Möwen       sitzen auf Dächern, Molenfeuern und im Wasser. Antippen scheucht sie auf, Taste H oder
//               Schütteln (Handy, Tablet) scheucht alle auf. Sie kreisen und landen wieder. Boote, die
//               zu nah kommen, das Hafenhorn und die Glocke scheuchen sie auch auf.
//   Wellenring  Lange aufs freie Wasser drücken: Wellenringe und leises Plätschern, solange man drückt.
//   Glocke      Hafenglocke neben dem Hafenmeisterhaus (später dem Hafenbüro) antippen: ein Schlag.
//               Abends, wenn die Schiffsglocke den Tag beendet, schwingt sie mit.
//
// Schnittstelle: game.hafengesten = { moewen(), aufscheuchen(), hafenhorn(), fernglas: { start(id), ende(),
//   get aktiv }, glocke(), wellenring(x, z) }. Ereignisse: 'gesten:hafenhorn' { muenzen, betrag },
//   'gesten:fernglas' { boot, an }, 'gesten:moewen' { anzahl }, 'gesten:glocke', 'gesten:wellenring' { x, z }.
// Klänge über game.audio.sfx: hafenhorn (über 'ui:collect' { horn: true }), muenze, kasse, moewen,
// plaetschern, glockenschlag, fernglas (web/js/audio/audio.js).

import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { bildMaler } from './logbuch-bild.js';

const BUERO = new Set(['hafenmeister', 'hafenbuero']);
const HALTEN_MS = 500;        // so lange auf das Büro drücken, bis das Horn tönt
const WASSER_MS = 450;        // so lange aufs Wasser drücken, bis der erste Ring kommt
const RING_TAKT = 0.65;       // s zwischen zwei Ringen, solange der Finger liegen bleibt
const SLOP = 10;              // px, ab hier ist es ein Ziehen und kein Halten
const MOEWE_TIPP = 'hafenmeister:moewen-tipp';
const SCHUETTELN = 'hafenmeister:schuetteln';

const zufall = (a, b) => a + Math.random() * (b - a);
const klemme = (v, a, b) => Math.min(b, Math.max(a, v));

export function init(game) {
  const { THREE } = game;
  if (!THREE || !game.scene || !game.canvas || !game.camera) return;
  const canvas = game.canvas;
  const cam = game.camera;
  const sfx = (name, opts) => { try { game.audio?.sfx?.(name, opts); } catch { /* ohne Ton weiter */ } };
  const haptic = (ms) => { try { navigator.vibrate?.(ms); } catch { /* egal */ } };
  const lokal = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const _v = new THREE.Vector3();
  const aufSchirm = (p) => {
    _v.copy(p).project(cam.camera);
    if (_v.z > 1) return null;
    return { x: (_v.x + 1) / 2 * cam.screenW, y: (1 - _v.y) / 2 * cam.screenH };
  };
  // Meter je Bildschirmpixel am Blickpunkt: hält kleine Dinge auf Handy und PC gleich gut sichtbar
  const meterProPx = () => cam.viewWidth / Math.max(1, cam.screenW);
  const sim = () => game.sim ?? null;
  const st = () => game.sim?.state ?? null;
  const baut = () => document.body.classList.contains('building');
  // Echte Zeit: Möwen und Ringe laufen in der Pause und bei 8x im normalen Tempo
  let jetzt = performance.now() / 1000;

  injectStyles();

  // ------------------------------------------------------------------ Gebäude des Hafenbüros
  let gebGruppe = null;
  const gebaeudeGruppe = () => (gebGruppe?.parent ? gebGruppe : (gebGruppe = game.scene.getObjectByName('gebaeude') ?? null));
  function gebaeude(id) {
    const gruppe = gebaeudeGruppe();
    if (!gruppe) return null;
    for (const m of gruppe.children) if (m.userData?.pick?.id === id && m.parent) return m;
    return null;
  }
  // Das Büro, das gerade steht: ab Bürostufe 3 das Hafenbüro, davor das Hafenmeisterhaus
  const buero = () => gebaeude('hafenbuero') ?? gebaeude('hafenmeister');
  const hornErlaubt = () => {
    const s = st();
    const r = sim()?.ctx?.rules?.office;
    return !!s && (s.office ?? 0) >= (r?.collectAllButton ?? 1);
  };

  // ------------------------------------------------------------------ Halten: Hafenhorn und Wellenring
  let halten = null;   // { id, start, art: 'horn'|'wasser', t0, timer, ring, welt, naechster }
  const finger = new Set();
  const hornRing = document.createElement('div');
  hornRing.className = 'hm-horn-ring';
  hornRing.hidden = true;
  hornRing.innerHTML = '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="16"/><circle class="voll" cx="20" cy="20" r="16"/></svg>';
  document.body.appendChild(hornRing);

  canvas.addEventListener('pointerdown', (e) => {
    finger.add(e.pointerId);
    abbrechenHalten();
    if (finger.size !== 1 || (e.pointerType === 'mouse' && e.button !== 0) || baut()) return;
    const p = lokal(e);
    const pk = game.pick?.(p.x, p.y);
    if (pk?.type === 'building' && BUERO.has(pk.id) && hornErlaubt()) {
      halten = { id: e.pointerId, start: p, art: 'horn', client: { x: e.clientX, y: e.clientY } };
      // Ring erst nach einem Moment zeigen, damit ein kurzer Tipp (Gästebuch) nicht flackert
      halten.zeigen = setTimeout(() => zeigeHornRing(halten?.client), 120);
      halten.timer = setTimeout(() => { if (halten?.art === 'horn') { versteckeHornRing(); halten = null; hafenhorn(); } }, HALTEN_MS);
      return;
    }
    if (pk) return;   // Boot, Steg, Münze, Boje ... gehören anderen Gesten
    const w = cam.screenToWorld(p.x, p.y);
    if (!w || !istWasser(w.x, w.z)) return;
    halten = { id: e.pointerId, start: p, art: 'wasser', welt: { x: w.x, z: w.z } };
    halten.timer = setTimeout(() => {
      if (halten?.art !== 'wasser') return;
      halten.aktiv = true;
      halten.naechster = jetzt + RING_TAKT;
      wellenring(halten.welt.x, halten.welt.z, 1);
    }, WASSER_MS);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!halten || halten.id !== e.pointerId) return;
    const p = lokal(e);
    if (Math.hypot(p.x - halten.start.x, p.y - halten.start.y) > SLOP) abbrechenHalten();
  });
  const los = (e) => {
    finger.delete(e.pointerId);
    if (halten && halten.id === e.pointerId) abbrechenHalten();
  };
  canvas.addEventListener('pointerup', los);
  canvas.addEventListener('pointercancel', los);
  canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') los(e); });

  function abbrechenHalten() {
    if (!halten) return;
    clearTimeout(halten.timer);
    clearTimeout(halten.zeigen);
    halten = null;
    versteckeHornRing();
  }
  function zeigeHornRing(c) {
    if (!c || !halten) return;
    hornRing.style.left = `${c.x}px`;
    hornRing.style.top = `${c.y}px`;
    hornRing.hidden = false;
    hornRing.classList.remove('laeuft');
    void hornRing.offsetWidth;   // Animation neu starten
    hornRing.style.setProperty('--hm-horn-ms', `${HALTEN_MS - 120}ms`);
    hornRing.classList.add('laeuft');
  }
  function versteckeHornRing() {
    hornRing.hidden = true;
    hornRing.classList.remove('laeuft');
  }

  function istWasser(x, z) {
    const L = game.landschaft;
    if (L?.istWasser) return !!L.istWasser(x, z);
    const h = L?.hoeheBei?.(x, z);
    return Number.isFinite(h) ? h < 0 : true;
  }

  // ------------------------------------------------------------------ Hafenhorn
  const fliegend = [];   // Münzen auf dem Weg zum Büro { m, p0, p1, t, dauer, nr }
  const muenzGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.12, 14).rotateX(Math.PI / 2);
  const muenzMat = new THREE.MeshLambertMaterial({ color: '#f5c542', emissive: '#6b4a00', flatShading: true });
  let wippen = null;     // { m, t } Büro hüpft kurz beim Horn

  function hafenhorn() {
    if (!hornErlaubt()) return false;
    const b = buero();
    if (!b) return false;
    // Offene Münzen vor dem Kassieren einsammeln: boat-view nimmt sie gleich danach weg
    const muenzen = [];
    game.scene.traverseVisible((o) => {
      const pk = o.userData?.pick;
      if (pk?.type === 'coin' && !o.userData.eingestrichen) muenzen.push(o.getWorldPosition(new THREE.Vector3()));
    });
    const vorher = st()?.money ?? 0;
    // Hafenhorn über die bestehende Schnittstelle: bridge.js kassiert alles, audio.js spielt das Horn
    game.emit('ui:collect', { horn: true });
    const betrag = Math.max(0, Math.round((st()?.money ?? 0) - vorher));
    haptic([30, 40, 60]);
    wippen = { m: b, t: 0, y0: b.scale.y };
    const box = new THREE.Box3().setFromObject(b);
    const ziel = new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y + 1.5, (box.min.z + box.max.z) / 2);
    muenzen.sort((a, c) => a.distanceToSquared(ziel) - c.distanceToSquared(ziel));
    const n = Math.min(muenzen.length, 40);
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(muenzGeo, muenzMat);
      m.position.copy(muenzen[i]);
      m.renderOrder = 4;
      game.scene.add(m);
      // Erst das Horn, dann eine Münze nach der anderen; viele Münzen rücken enger zusammen
      fliegend.push({ m, p0: muenzen[i].clone(), p1: ziel.clone(), t: -(0.55 + i * Math.max(0.05, 0.11 - n * 0.002)), dauer: 0.75, nr: i + 1, letzte: i === n - 1, betrag });
    }
    if (!n && betrag > 0) zeigeBetrag(ziel, betrag);
    // Schall: goldene Ringe laufen vom Dach weg
    wellenring(ziel.x, ziel.z, 0, { farbe: '#f2c14e', y: box.max.y + 0.5, still: true, gross: 1.6 });
    scheucheAuf(ziel, 70, { ton: true });
    game.emit('gesten:hafenhorn', { muenzen: n, betrag });
    return true;
  }

  function zeigeBetrag(pos, betrag) {
    const s = aufSchirm(pos);
    if (!s) return;
    const r = canvas.getBoundingClientRect();
    const t = document.createElement('div');
    t.className = 'hm-flugtext hm-px gold hm-horn-betrag';
    t.setAttribute('role', 'status');
    t.textContent = `+${betrag.toLocaleString('de-DE')} € in der Kasse`;
    t.style.left = `${Math.round(r.left + s.x)}px`;
    t.style.top = `${Math.round(r.top + s.y)}px`;
    document.body.append(t);
    setTimeout(() => t.remove(), 1900);
  }

  function tickMuenzen(dt) {
    for (let i = fliegend.length - 1; i >= 0; i--) {
      const f = fliegend[i];
      f.t += dt;
      if (f.t < 0) { f.m.visible = false; continue; }
      f.m.visible = true;
      const k = Math.min(1, f.t / f.dauer);
      const e = k * k * (3 - 2 * k);
      f.m.position.lerpVectors(f.p0, f.p1, e);
      f.m.position.y += Math.sin(k * Math.PI) * (6 + f.p0.distanceTo(f.p1) * 0.12);
      f.m.rotation.y += dt * 9;
      const s = klemme(18 * meterProPx(), 1.2, 10) * (1 - 0.45 * k);
      f.m.scale.setScalar(s);
      if (k >= 1) {
        f.m.parent?.remove(f.m);
        fliegend.splice(i, 1);
        sfx('muenze', { combo: f.nr });
        if (wippen) wippen.t = Math.min(wippen.t, 0.05);
        if (f.letzte) {
          sfx('kasse', { delay: 0.12 });
          if (f.betrag > 0) zeigeBetrag(f.p1, f.betrag);
        }
      }
    }
    if (wippen) {
      wippen.t += dt;
      const k = wippen.t / 0.35;
      const s = k < 1 ? 1 + Math.sin(k * Math.PI) * 0.07 : 1;
      wippen.m.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s));
      if (k >= 1 && !fliegend.length) { wippen.m.scale.set(1, 1, 1); wippen = null; }
    }
  }

  // ------------------------------------------------------------------ Wellenring
  const ringe = [];   // { m, t, dauer, r }
  const ringGeo = new THREE.RingGeometry(0.86, 1, 48).rotateX(-Math.PI / 2);
  const schallGeo = new THREE.RingGeometry(0.7, 1, 48).rotateX(-Math.PI / 2);
  function wellenring(x, z, staerke = 1, { farbe = '#f4fbff', y = 0.06, still = false, gross = 1 } = {}) {
    const r = klemme(cam.viewWidth * 0.025, 1.2, 9) * gross;
    for (let i = 0; i < 3; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: farbe, transparent: true, opacity: 0, depthWrite: false, depthTest: !still });
      const m = new THREE.Mesh(still ? schallGeo : ringGeo, mat);
      m.position.set(x, y, z);
      m.renderOrder = 2;
      game.scene.add(m);
      ringe.push({ m, t: -i * 0.22, dauer: 1.7, r: r * (1 - i * 0.12), hell: still ? 1 : 0.75 });
    }
    if (still) return;
    sfx('plaetschern', { staerke, pan: panVon(x, z) });
    haptic(8);
    scheucheAuf(new THREE.Vector3(x, 0, z), 14, { nurWasser: true });
    game.emit('gesten:wellenring', { x, z });
  }
  function tickRinge(dt) {
    if (halten?.aktiv && halten.art === 'wasser' && jetzt >= halten.naechster) {
      halten.naechster = jetzt + RING_TAKT;
      wellenring(halten.welt.x, halten.welt.z, 0.7);
    }
    for (let i = ringe.length - 1; i >= 0; i--) {
      const g = ringe[i];
      g.t += dt;
      const k = g.t / g.dauer;
      if (k < 0) { g.m.visible = false; continue; }
      g.m.visible = true;
      const e = 1 - Math.pow(1 - Math.min(1, k), 2);
      g.m.scale.setScalar(0.3 * g.r + e * g.r * 3.2);
      g.m.material.opacity = g.hell * (1 - Math.min(1, k)) * Math.min(1, k * 6);
      if (k >= 1) { g.m.parent?.remove(g.m); g.m.material.dispose(); ringe.splice(i, 1); }
    }
  }
  const panVon = (x, z) => {
    const s = aufSchirm(new THREE.Vector3(x, 0, z));
    return s ? klemme((s.x / Math.max(1, cam.screenW)) * 2 - 1, -1, 1) : 0;
  };

  // ------------------------------------------------------------------ Möwen
  // Je Möwe vier Zeichenaufrufe: Körper (Rumpf, Kopf, Schnabel, Schwanz in einem Netz mit Farben je Ecke),
  // zwei Flügel (mit schwarzer Spitze) und die Beine
  const farbig = (geo, farbe, x = 0, y = 0, z = 0) => {
    const g = geo.toNonIndexed ? geo.toNonIndexed() : geo;
    g.translate(x, y, z);
    const c = new THREE.Color(farbe);
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k);
    return g;
  };
  const MOEWE_MAT = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#2a2a28', flatShading: true });
  const G = {
    koerper: mergeGeometries([
      farbig(new THREE.SphereGeometry(0.12, 7, 5).scale(2.1, 0.95, 1), '#f7f6f0'),
      farbig(new THREE.SphereGeometry(0.075, 6, 5), '#f7f6f0', 0.24, 0.08, 0),
      farbig(new THREE.ConeGeometry(0.022, 0.09, 4).rotateZ(-Math.PI / 2), '#f2c14e', 0.34, 0.07, 0),
      farbig(new THREE.BoxGeometry(0.13, 0.025, 0.11), '#a5b0bb', -0.27, 0.03, 0),
    ]),
    fluegel: mergeGeometries([
      farbig(new THREE.BoxGeometry(0.17, 0.018, 0.34), '#a5b0bb', 0, 0, 0.17),
      farbig(new THREE.BoxGeometry(0.12, 0.016, 0.12), '#2b2f36', 0, 0, 0.4),
    ]),
    beine: mergeGeometries([
      farbig(new THREE.CylinderGeometry(0.008, 0.008, 0.1, 4), '#f2c14e', 0, -0.12, -0.04),
      farbig(new THREE.CylinderGeometry(0.008, 0.008, 0.1, 4), '#f2c14e', 0, -0.12, 0.04),
    ]),
  };
  function moewenModell() {
    const g = new THREE.Group();
    g.name = 'moewe';
    g.rotation.order = 'YZX';
    const koerper = new THREE.Mesh(G.koerper, MOEWE_MAT);
    const fluegel = [1, -1].map((seite) => {
      const f = new THREE.Mesh(G.fluegel, MOEWE_MAT);
      f.position.set(0.02, 0.06, 0.05 * seite);
      f.scale.z = seite;
      g.add(f);
      return f;
    });
    const beine = new THREE.Mesh(G.beine, MOEWE_MAT);
    g.add(koerper, beine);
    g.userData = { fluegel, beine };
    return g;
  }

  const moewenGruppe = new THREE.Group();
  moewenGruppe.name = 'moewen';
  game.scene.add(moewenGruppe);
  const moewen = [];       // { g, zustand, platz, pos, t, ... }
  const besetzt = new Set();

  // Sitzplätze: Dächer, Molenfeuer, Leuchttürme und freies Wasser im Hafen (keine Boote, kein Büro)
  let plaetzeCache = null;
  let plaetzeZeit = -99;
  function sitzplaetze() {
    if (plaetzeCache && jetzt - plaetzeZeit < 8) return plaetzeCache;
    const liste = [];
    const gruppe = gebaeudeGruppe();
    const box = new THREE.Box3();
    for (const m of gruppe?.children ?? []) {
      const id = m.userData?.pick?.id;
      if (!m.parent || !m.visible || BUERO.has(id) || id === 'wellenbrecher' || /^koerbe/.test(id ?? '')) continue;
      box.setFromObject(m);
      if (!Number.isFinite(box.max.y) || box.max.y < 1) continue;
      const c = box.getCenter(new THREE.Vector3());
      const lang = box.max.x - box.min.x > box.max.z - box.min.z;
      const span = (lang ? box.max.x - box.min.x : box.max.z - box.min.z) * 0.22;
      for (const k of [-1, 1]) {
        const x = c.x + (lang ? k * span : 0);
        const z = c.z + (lang ? 0 : k * span);
        // Höhe an dieser Stelle: Strahl von oben auf das Gebäude
        const y = dachHoehe(m, x, z, box.max.y);
        liste.push({ key: `${id}:${k}`, x, y, z, art: 'dach', obj: m });
      }
    }
    // Wasser: Punkte im Hafenrechteck der Stufe, weit genug weg von Plätzen und Bojen
    const rect = hafenRect();
    if (rect) {
      const plaetze = [];
      for (const p of game.sim?.ctx?.berths ?? []) {
        const w = game.stege?.platz?.(p.id);
        if (w) plaetze.push(w);
      }
      let bojen = [];
      try { bojen = game.boatView?.bojen?.() ?? []; } catch { bojen = []; }
      for (const b of Array.isArray(bojen) ? bojen : []) {
        if (Number.isFinite(b?.x) && Number.isFinite(b?.z)) plaetze.push(b);
      }
      let zaehler = 0;
      for (let i = 0; i < 80 && zaehler < 8; i++) {
        // fester Ablauf je Stufe, damit die Plätze nicht bei jedem Neuberechnen springen
        const u = frac(Math.sin((i + 1) * 12.9898 + (st()?.stage ?? 1) * 7.1) * 43758.5453);
        const v = frac(Math.sin((i + 1) * 78.233 + (st()?.stage ?? 1) * 3.7) * 12345.6789);
        const x = rect.minX + u * (rect.maxX - rect.minX);
        const z = rect.minZ + v * (rect.maxZ - rect.minZ);
        if (!istWasser(x, z) || !istWasser(x + 6, z) || !istWasser(x - 6, z) || !istWasser(x, z + 6) || !istWasser(x, z - 6)) continue;
        if (plaetze.some((p) => Math.hypot(p.x - x, p.z - z) < 18)) continue;
        liste.push({ key: `wasser:${i}`, x, y: 0.02, z, art: 'wasser' });
        zaehler++;
      }
    }
    plaetzeCache = liste;
    plaetzeZeit = jetzt;
    return liste;
  }
  const frac = (v) => v - Math.floor(v);
  const _ray = new THREE.Raycaster();
  function dachHoehe(m, x, z, oben) {
    _ray.set(new THREE.Vector3(x, oben + 5, z), new THREE.Vector3(0, -1, 0));
    const hit = _ray.intersectObject(m, true)[0];
    return hit ? hit.point.y : oben;
  }
  function hafenRect() {
    try {
      const r = game.gelaende?.startRect?.(st()?.stage ?? 1);
      if (r && Number.isFinite(r.minX)) {
        // nur der innere Teil: dort liegt der Hafen, nicht das offene Meer am Rand
        const cx = (r.minX + r.maxX) / 2, cz = (r.minZ + r.maxZ) / 2;
        const hx = (r.maxX - r.minX) * 0.32, hz = (r.maxZ - r.minZ) * 0.32;
        return { minX: cx - hx, maxX: cx + hx, minZ: cz - hz, maxZ: cz + hz };
      }
    } catch { /* ohne Gelände */ }
    return { minX: -120, maxX: 120, minZ: -150, maxZ: 10 };
  }

  function sollAnzahl() {
    const stufe = st()?.stage ?? game.state?.stufe ?? 1;
    return Math.min(16, 5 + 2 * stufe);
  }
  function freierPlatz(nah = null, ausser = null) {
    const liste = sitzplaetze().filter((p) => !besetzt.has(p.key) && p.key !== ausser && (p.art !== 'dach' || p.obj.parent));
    if (!liste.length) return null;
    if (nah) {
      liste.sort((a, b) => Math.hypot(a.x - nah.x, a.z - nah.z) - Math.hypot(b.x - nah.x, b.z - nah.z));
      return liste[Math.floor(Math.random() * Math.min(4, liste.length))];
    }
    return liste[Math.floor(Math.random() * liste.length)];
  }
  function setzeAuf(mw, platz) {
    if (mw.platz) besetzt.delete(mw.platz.key);
    mw.platz = platz;
    besetzt.add(platz.key);
  }
  function neueMoewe(platz) {
    const g = moewenModell();
    moewenGruppe.add(g);
    const mw = { g, zustand: 'sitzt', platz: null, pos: new THREE.Vector3(platz.x, platz.y, platz.z), t: 0, seed: Math.random() * 10, blick: Math.random() * Math.PI * 2 };
    setzeAuf(mw, platz);
    moewen.push(mw);
    return mw;
  }
  function abgleich() {
    const soll = sollAnzahl();
    // Möwen auf Dächern, die es nicht mehr gibt (Stufenwechsel), fliegen weg
    for (const mw of moewen) {
      if (mw.zustand === 'sitzt' && mw.platz?.art === 'dach' && !mw.platz.obj.parent) starte(mw, { scheu: false });
    }
    const da = moewen.filter((m) => m.zustand !== 'weg').length;
    for (let i = da; i < soll; i++) {
      const p = freierPlatz();
      if (!p) break;
      neueMoewe(p);
    }
  }

  // Auffliegen: Kreise um einen Punkt in der Nähe, danach auf einem (anderen) Platz landen
  function starte(mw, { scheu = true, mitte = null, dauer = null } = {}) {
    if (mw.zustand !== 'sitzt') return false;
    const von = mitte ?? mw.pos;
    let dx = mw.pos.x - von.x, dz = mw.pos.z - von.z;
    if (Math.hypot(dx, dz) < 0.5) { const a = Math.random() * Math.PI * 2; dx = Math.cos(a); dz = Math.sin(a); }
    const d = Math.hypot(dx, dz);
    mw.zustand = 'auf';
    mw.t = 0;
    mw.p0 = mw.pos.clone();
    mw.richtung = new THREE.Vector3(dx / d, 0, dz / d);
    // Kreise passend zum Ausschnitt: nah heran klein und tief, weit heraus groß und hoch, aber im Bild
    const vw = klemme(cam.viewWidth, 20, 400);
    const r = Math.max(6, zufall(0.07, 0.15) * vw);
    mw.kreis = {
      cx: mw.pos.x + mw.richtung.x * r * 0.9, cz: mw.pos.z + mw.richtung.z * r * 0.9, r,
      h: Math.max(mw.pos.y + 4, zufall(0.06, 0.12) * vw + 4), w: (Math.random() < 0.5 ? -1 : 1) * zufall(0.55, 0.85),
      a: 0,
    };
    mw.kreis.a = Math.atan2(mw.pos.z - mw.kreis.cz, mw.pos.x - mw.kreis.cx);
    mw.kreisBis = dauer ?? (scheu ? zufall(7, 13) : zufall(5, 9));
    if (mw.platz) { besetzt.delete(mw.platz.key); mw.altPlatz = mw.platz.key; mw.platz = null; }
    return true;
  }

  // Möwen im Umkreis aufscheuchen. mitte: Weltpunkt, umkreis in Metern (wird mit dem Zoom größer).
  function scheucheAuf(mitte, umkreis, { ton = false, nurWasser = false } = {}) {
    let n = 0;
    const r = umkreis * Math.max(1, groesse() * 0.4);
    for (const mw of moewen) {
      if (mw.zustand !== 'sitzt') continue;
      if (nurWasser && mw.platz?.art !== 'wasser') continue;
      if (mitte && Math.hypot(mw.pos.x - mitte.x, mw.pos.z - mitte.z) > r) continue;
      if (starte(mw, { mitte })) n++;
    }
    if (n && (ton || n >= 2)) sfx('moewen', { anzahl: n, pan: mitte ? panVon(mitte.x, mitte.z) : 0 });
    if (n) game.emit('gesten:moewen', { anzahl: n });
    return n;
  }

  // Alle auf: Taste H, Schütteln. Dazu ein Schwarm aus der Bildmitte, damit man es auch von weit oben sieht.
  function aufscheuchen() {
    const n = scheucheAuf(null, Infinity);
    const s = groesse();
    const mitte = cam.screenToWorld(cam.screenW / 2, cam.screenH / 2);
    let extra = 0;
    if (mitte) {
      for (let i = 0; i < 7; i++) {
        const a = Math.random() * Math.PI * 2;
        const vw = klemme(cam.viewWidth, 20, 400);
        const d = zufall(0.04, 0.2) * vw;
        const x = mitte.x + Math.cos(a) * d, z = mitte.z + Math.sin(a) * d;
        const g = moewenModell();
        moewenGruppe.add(g);
        const mw = { g, zustand: 'weg', pos: new THREE.Vector3(x, zufall(1, 4) * s, z), t: -i * 0.06, seed: Math.random() * 10 };
        mw.vel = new THREE.Vector3(Math.cos(a) * 0.09 * vw, zufall(0.03, 0.05) * vw, Math.sin(a) * 0.09 * vw);
        moewen.push(mw);
        extra++;
      }
    }
    sfx('moewen', { anzahl: Math.min(12, n + extra) });
    haptic(20);
    game.emit('gesten:moewen', { anzahl: n + extra });
    return n + extra;
  }

  // Möwen bleiben am Bildschirm gut sichtbar: weit herausgezoomt werden sie größer gezeichnet,
  // fliegend etwa 15 Pixel lang, sitzend etwas kleiner (sonst wirken sie auf den Dächern riesig)
  const groesse = () => klemme(30 * meterProPx(), 1.3, 12);

  let naechsterAusflug = jetzt + zufall(15, 30);
  let naechsterAbgleich = 0;
  let naechsterBootsblick = 0;
  function tickMoewen(dt) {
    if (jetzt >= naechsterAbgleich) { naechsterAbgleich = jetzt + 3; abgleich(); }
    const s = groesse();
    const nacht = (game.landschaft?.licht?.zustand?.nacht ?? game.landscape?.licht?.zustand?.nacht ?? 0) > 0.6;
    // Ab und zu fliegt eine Möwe von selbst ein Stück (nicht nachts)
    if (jetzt >= naechsterAusflug) {
      naechsterAusflug = jetzt + zufall(18, 45);
      const sitzend = moewen.filter((m) => m.zustand === 'sitzt');
      if (!nacht && sitzend.length) starte(sitzend[Math.floor(Math.random() * sitzend.length)], { scheu: false });
    }
    // Boote, die einer Möwe im Wasser zu nah kommen, scheuchen sie auf
    if (jetzt >= naechsterBootsblick) {
      naechsterBootsblick = jetzt + 0.4;
      const boote = game.boatView?.boote ? [...(typeof game.boatView.boote === 'function' ? game.boatView.boote() : game.boatView.boote)] : [];
      for (const mw of moewen) {
        if (mw.zustand !== 'sitzt' || mw.platz?.art !== 'wasser') continue;
        for (const b of boote) {
          const m = b?.model ?? b?.anim?.model ?? b;
          const p = m?.position;
          if (!p) continue;
          const L = b?.info?.length ?? b?.anim?.info?.length ?? 8;
          if (Math.hypot(p.x - mw.pos.x, p.z - mw.pos.z) < L * 0.6 + 7) { starte(mw); break; }
        }
      }
    }
    for (let i = moewen.length - 1; i >= 0; i--) {
      const mw = moewen[i];
      const g = mw.g;
      const f = g.userData.fluegel;
      mw.t += dt;
      g.scale.setScalar(mw.zustand === 'sitzt' ? Math.max(1.3, s * 0.7) : s);
      let schlag = 0;
      if (mw.zustand === 'sitzt') {
        const p = mw.platz;
        mw.pos.set(p.x, p.y + (p.art === 'wasser' ? Math.sin(jetzt * 1.7 + mw.seed) * 0.05 : 0) + 0.12 * s, p.z);
        // ab und zu den Kopf drehen
        if (Math.sin(jetzt * 0.3 + mw.seed * 3) > 0.97) mw.blick += dt * 2;
        g.rotation.set(0, mw.blick, 0);
        g.userData.beine.visible = p.art !== 'wasser';
        // eingeklappt: Flügel liegen nach hinten am Körper
        for (const w of f) { w.rotation.y = -1.35 * Math.sign(w.scale.z); w.rotation.x = 0; }
      } else if (mw.zustand === 'auf') {
        const k = Math.min(1, mw.t / 0.9);
        const K = mw.kreis;
        const start = new THREE.Vector3(K.cx + Math.cos(K.a) * K.r, K.h, K.cz + Math.sin(K.a) * K.r);
        const ziel = mw.p0.clone().lerp(start, k * k);
        ziel.y = mw.p0.y + (K.h - mw.p0.y) * (1 - Math.pow(1 - k, 2));
        richteAus(mw, ziel, dt);
        mw.pos.copy(ziel);
        schlag = 1;
        if (k >= 1) { mw.zustand = 'kreist'; mw.t = 0; }
      } else if (mw.zustand === 'kreist') {
        const K = mw.kreis;
        K.a += K.w * dt;
        const ziel = new THREE.Vector3(K.cx + Math.cos(K.a) * K.r, K.h + Math.sin(jetzt * 0.9 + mw.seed) * 1.2, K.cz + Math.sin(K.a) * K.r);
        richteAus(mw, ziel, dt, -Math.sign(K.w) * 0.45);
        mw.pos.copy(ziel);
        schlag = Math.max(0.15, Math.sin(jetzt * 0.8 + mw.seed * 2));
        if (mw.t > mw.kreisBis) {
          const platz = freierPlatz(mw.pos, mw.altPlatz);
          if (!platz) { mw.zustand = 'weg'; mw.vel = new THREE.Vector3(Math.cos(K.a + Math.PI / 2) * 9 * Math.sign(K.w), 3, Math.sin(K.a + Math.PI / 2) * 9 * Math.sign(K.w)); mw.t = 0; }
          else {
            setzeAuf(mw, platz);
            mw.zustand = 'landet';
            mw.t = 0;
            mw.p0 = mw.pos.clone();
            const p1 = new THREE.Vector3(platz.x, platz.y + 0.12 * s, platz.z);
            mw.p1 = p1;
            mw.ctl = mw.p0.clone().lerp(p1, 0.5);
            mw.ctl.y = Math.max(mw.p0.y, p1.y) + 6;
            mw.landeDauer = klemme(mw.p0.distanceTo(p1) / Math.max(8, 0.12 * klemme(cam.viewWidth, 20, 400)), 1.5, 6);
          }
        }
      } else if (mw.zustand === 'landet') {
        // Platz inzwischen weg (Stufenwechsel)? Dann neu suchen
        const k = Math.min(1, mw.t / mw.landeDauer);
        const a = 1 - k;
        const p1 = new THREE.Vector3(mw.platz.x, mw.platz.y + 0.12 * s, mw.platz.z);
        const ziel = new THREE.Vector3()
          .addScaledVector(mw.p0, a * a).addScaledVector(mw.ctl, 2 * a * k).addScaledVector(p1, k * k);
        richteAus(mw, ziel, dt);
        mw.pos.copy(ziel);
        schlag = k > 0.8 ? 1 : 0.4;
        if (k >= 1) { mw.zustand = 'sitzt'; mw.blick = g.rotation.y; mw.t = 0; }
      } else if (mw.zustand === 'weg') {
        if (mw.t < 0) { g.visible = false; continue; }
        g.visible = true;
        mw.vel.y = Math.max(1, mw.vel.y - dt * 1.5);
        const ziel = mw.pos.clone().addScaledVector(mw.vel, dt);
        richteAus(mw, ziel, dt);
        mw.pos.copy(ziel);
        schlag = 1;
        if (mw.t > 7) { g.parent?.remove(g); moewen.splice(i, 1); continue; }
      }
      if (mw.zustand !== 'sitzt') {
        g.userData.beine.visible = false;
        const flap = Math.sin(jetzt * 13 + mw.seed * 5) * 0.75 * schlag + 0.12;
        for (const w of f) { w.rotation.y = 0; w.rotation.x = flap * Math.sign(w.scale.z) * -1; }
      }
      g.position.copy(mw.pos);
    }
  }
  function richteAus(mw, ziel, dt, neigung = 0) {
    const dx = ziel.x - mw.pos.x, dz = ziel.z - mw.pos.z;
    if (Math.hypot(dx, dz) > 1e-4) {
      const soll = Math.atan2(-dz, dx);
      let d = soll - mw.g.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      mw.g.rotation.y += d * Math.min(1, dt * 8);
    }
    mw.g.rotation.x = neigung;
    mw.g.rotation.z = klemme((ziel.y - mw.pos.y) / Math.max(1e-3, dt) * 0.04, -0.5, 0.6);
  }

  // Tipp auf eine Möwe (Bildschirmabstand, damit auch kleine Möwen zu treffen sind)
  function moeweBei(x, y) {
    const r = Math.max(26, groesse() * 6);
    let best = null, bestD = r;
    for (const mw of moewen) {
      if (mw.zustand !== 'sitzt') continue;
      const s = aufSchirm(mw.pos);
      if (!s) continue;
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < bestD) { bestD = d; best = mw; }
    }
    return best;
  }

  // ------------------------------------------------------------------ Glocke am Hafenbüro
  const glocke = (() => {
    const g = new THREE.Group();
    g.name = 'hafenglocke';
    const holz = new THREE.MeshLambertMaterial({ color: '#7a5a3c', flatShading: true });
    const messing = new THREE.MeshLambertMaterial({ color: '#d4a640', emissive: '#4a3000', flatShading: true });
    const pfosten = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.3, 0.14), holz);
    pfosten.position.y = 1.15;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.1), holz);
    arm.position.set(0.3, 2.2, 0);
    const piv = new THREE.Group();
    piv.position.set(0.55, 2.15, 0);
    const bauch = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.2, 0.3, 10), messing);
    bauch.position.y = -0.2;
    const kopf = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), messing);
    kopf.position.y = -0.05;
    const kloeppel = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), holz);
    kloeppel.position.y = -0.38;
    piv.add(bauch, kopf, kloeppel);
    g.add(pfosten, arm, piv);
    g.userData.pick = { type: 'building', id: 'glocke' };
    g.userData.piv = piv;
    g.visible = false;
    game.scene.add(g);
    return g;
  })();
  let glockeAn = null;      // Gebäude, an dem die Glocke gerade steht
  let schwung = { a: 0, v: 0 };
  function glockeSetzen() {
    const b = buero();
    if (b === glockeAn && (!b || glocke.userData.pos?.equals(b.position))) return;
    glockeAn = b;
    if (!b) { glocke.visible = false; if (glocke.parent) game.scene.remove(glocke); return; }
    if (!glocke.parent) game.scene.add(glocke);
    // Ausdehnung des Gebäudes ohne Drehung messen, dann neben die Wasserseite stellen
    const rot = b.rotation.y;
    b.rotation.y = 0;
    b.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(b);
    b.rotation.y = rot;
    b.updateMatrixWorld(true);
    const hx = (box.max.x - box.min.x) / 2, hz = (box.max.z - box.min.z) / 2;
    const kandidaten = [[hx + 1.2, -hz + 0.6], [-hx - 1.2, -hz + 0.6], [hx + 1.2, hz - 0.6], [-hx - 1.2, hz - 0.6]];
    let ort = null;
    for (const [lx, lz] of kandidaten) {
      const x = b.position.x + lx * Math.cos(rot) + lz * Math.sin(rot);
      const z = b.position.z - lx * Math.sin(rot) + lz * Math.cos(rot);
      if (!istWasser(x, z)) { ort = { x, z }; break; }
    }
    if (!ort) ort = { x: b.position.x + hx + 1.2, z: b.position.z };
    const h = game.landschaft?.hoeheBei?.(ort.x, ort.z);
    glocke.position.set(ort.x, Number.isFinite(h) ? Math.max(0, h) : b.position.y, ort.z);
    glocke.rotation.y = rot;
    glocke.visible = true;
    glocke.userData.pos = b.position.clone();
  }
  function laeuten(staerke = 1, { still = false } = {}) {
    if (!glocke.visible) return false;
    schwung.v += 3.2 * staerke * (schwung.a >= 0 ? 1 : -1);
    if (!still) {
      sfx('glockenschlag', { staerke, pan: panVon(glocke.position.x, glocke.position.z) });
      haptic(12);
      scheucheAuf(glocke.position, 22);
      game.emit('gesten:glocke');
    }
    return true;
  }
  function tickGlocke(dt) {
    const piv = glocke.userData.piv;
    // gedämpftes Pendel
    schwung.v += -schwung.a * 26 * dt;
    schwung.v *= Math.exp(-dt * 1.6);
    schwung.a += schwung.v * dt;
    if (Math.abs(schwung.a) < 1e-4 && Math.abs(schwung.v) < 1e-3) { schwung.a = 0; schwung.v = 0; }
    piv.rotation.z = schwung.a * 0.5;
    glocke.scale.setScalar(klemme(13 * meterProPx(), 1, 2.5));
  }
  game.on('phase', (p) => { if (p === 'abend') laeuten(0.8, { still: true }); });
  const glockeBei = (x, y) => {
    if (!glocke.visible) return false;
    const s = aufSchirm(glocke.position.clone().add(new THREE.Vector3(0, 2 * glocke.scale.y, 0)));
    return !!s && Math.hypot(s.x - x, s.y - y) < 26;
  };

  // ------------------------------------------------------------------ Antippen
  game.on('tap', (t = {}) => {
    if (baut()) return;
    if (t.pick?.type === 'building' && t.pick.id === 'glocke') { laeuten(); return; }
    if (!t.pick && glockeBei(t.x, t.y)) { laeuten(); return; }
    // Möwen: zusätzlich zu dem, was der Tipp sonst tut (reine Freude, nimmt niemandem etwas weg)
    const mw = moeweBei(t.x, t.y);
    if (mw) {
      scheucheAuf(mw.pos, 10, { ton: true });
      moewenTipp();
    }
  });

  // ------------------------------------------------------------------ Taste H und Schütteln
  window.addEventListener('keydown', (e) => {
    const z = e.target;
    if (z?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    if (e.code === 'KeyH') { aufscheuchen(); e.preventDefault(); }
    else if (e.code === 'Escape' && fernglas.aktiv) fernglas.ende();
  });

  const iosFrage = typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function';
  let schuettelnAn = false;
  let spitzen = [];
  let ruhebis = 0;
  function schuettelnStarten() {
    if (schuettelnAn || typeof window === 'undefined' || !('DeviceMotionEvent' in window)) return;
    schuettelnAn = true;
    window.addEventListener('devicemotion', (e) => {
      const a = e.acceleration;
      let m;
      if (a && Number.isFinite(a.x)) m = Math.hypot(a.x, a.y, a.z);
      else {
        const g = e.accelerationIncludingGravity;
        if (!g || !Number.isFinite(g.x)) return;
        m = Math.abs(Math.hypot(g.x, g.y, g.z) - 9.81);
      }
      const t = performance.now();
      if (m < 13 || t < ruhebis) return;
      spitzen = spitzen.filter((s) => t - s < 800);
      if (spitzen.length && t - spitzen[spitzen.length - 1] < 120) return;
      spitzen.push(t);
      if (spitzen.length >= 2) { spitzen = []; ruhebis = t + 2500; aufscheuchen(); }
    });
  }
  function schuettelnErlauben() {
    if (!iosFrage) { schuettelnStarten(); return Promise.resolve(true); }
    return DeviceMotionEvent.requestPermission().then((r) => {
      const ok = r === 'granted';
      try { localStorage.setItem(SCHUETTELN, ok ? 'an' : 'aus'); } catch { /* egal */ }
      if (ok) schuettelnStarten();
      return ok;
    }).catch(() => false);
  }
  if (!iosFrage) schuettelnStarten();
  else {
    // Schon einmal erlaubt: beim ersten Antippen (Nutzergeste) wieder einschalten
    let gespeichert = null;
    try { gespeichert = localStorage.getItem(SCHUETTELN); } catch { /* egal */ }
    if (gespeichert === 'an') canvas.addEventListener('pointerup', () => { schuettelnErlauben(); }, { once: true });
  }

  // Einmal je Gerät nach der ersten aufgescheuchten Möwe: wie man alle auf einmal aufscheucht
  const tippEl = document.createElement('div');
  tippEl.className = 'hm-gesten-tipp hm-px';
  tippEl.hidden = true;
  tippEl.setAttribute('role', 'status');
  document.body.appendChild(tippEl);
  let tippTimer = null;
  function moewenTipp() {
    let schon = null;
    try { schon = localStorage.getItem(MOEWE_TIPP); } catch { /* egal */ }
    if (schon || !tippEl.hidden) return;
    // Nur wenn gerade keine andere Meldung steht, sonst beim nächsten Mal
    if (game.meldungen) {
      game.meldungen.wunsch('moewen-tipp', 21);
      if (!game.meldungen.darf('moewen-tipp')) { game.meldungen.fertig('moewen-tipp'); return; }
    }
    try { localStorage.setItem(MOEWE_TIPP, '1'); } catch { /* egal */ }
    const touch = matchMedia('(pointer: coarse)').matches;
    const text = document.createElement('span');
    const knoepfe = [];
    if (!touch) text.textContent = 'Möwen! Mit der Taste H fliegen alle auf einmal auf.';
    else if (iosFrage && !schuettelnAn) {
      text.textContent = 'Möwen! Schüttel das Gerät, dann fliegen alle auf. Dafür braucht das Spiel einmal deine Erlaubnis.';
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'hm-px';
      b.textContent = 'Schütteln erlauben';
      b.addEventListener('click', () => { schuettelnErlauben().then(() => tippZu()); });
      knoepfe.push(b);
    } else text.textContent = 'Möwen! Schüttel das Gerät kurz, dann fliegen alle auf einmal auf.';
    const zu = document.createElement('button');
    zu.type = 'button';
    zu.className = 'hm-px';
    zu.textContent = 'OK';
    zu.addEventListener('click', tippZu);
    tippEl.replaceChildren(text, ...knoepfe, zu);
    tippEl.hidden = false;
    clearTimeout(tippTimer);
    tippTimer = setTimeout(tippZu, knoepfe.length ? 12000 : 7000);
  }
  function tippZu() {
    clearTimeout(tippTimer);
    tippEl.hidden = true;
    game.meldungen?.fertig('moewen-tipp');
  }

  // ------------------------------------------------------------------ Fernglas
  const vignette = document.createElement('div');
  vignette.className = 'hm-fernglas-rand';
  vignette.setAttribute('aria-hidden', 'true');
  canvas.after(vignette);
  const karte = document.createElement('section');
  karte.className = 'hm-steckbrief hm-px';
  karte.setAttribute('role', 'dialog');
  karte.setAttribute('aria-label', 'Steckbrief durchs Fernglas');
  karte.hidden = true;
  document.body.appendChild(karte);
  let maler = null;
  let fg = null;   // { id, zoomen, statusT }

  const meter = (m) => (Number.isFinite(m) ? `${m.toLocaleString('de-DE', { maximumFractionDigits: 1 })} m` : '?');
  function bootDaten(id) {
    const s = st();
    const b = s?.boats?.[id] ?? s?.boats?.[Number(String(id).replace(/^b/, ''))] ?? null;
    return b;
  }
  function artName(b) {
    const t = sim()?.ctx?.types?.find?.((x) => x.id === b.typeId);
    return t?.name ?? null;
  }
  function statusText(b) {
    if (!b) return 'Unterwegs.';
    if (sim()?.aufAusflug?.(b.id)) return 'Ist draußen auf Törn und kommt abends zurück.';
    const nacht = (n) => `${n} ${n === 1 ? 'Nacht' : 'Nächte'}`;
    switch (b.status) {
      case 'expected': return 'Ist auf dem Weg in deinen Hafen.';
      case 'waiting': return b.atBuoy ? 'Wartet draußen auf einen Platz.' : 'Läuft die Warteplätze an.';
      case 'moored': {
        const platz = b.berthId ? `Liegt in Box ${b.berthId}` : 'Liegt fest';
        if (b.stationed) return `${platz}, fester Liegeplatz.`;
        const geld = b.pendingFee > 0 ? ' Liegegeld ist offen.' : b.paid ? ' Hat bezahlt.' : '';
        return `${platz}, ${b.nights > 0 ? `noch ${nacht(b.nights)}` : 'legt bald ab'}.${geld}`;
      }
      default: return 'Läuft aus und fährt weiter.';
    }
  }
  function zeichneKarte(id) {
    const b = bootDaten(id);
    const a = game.boatView?.boot?.(id);
    const info = a?.info ?? {};
    const name = b?.bootsname ? `„${b.bootsname}“` : b?.name ?? info.name ?? 'Boot';
    // Unterzeile: Modell und Art, ohne zu wiederholen, was schon im Titel steht
    const art = b ? [b.bootsname ? b.name : null, artName(b)].filter((x, i, l) => x && x !== name && l.indexOf(x) === i) : [];
    const unter = [art.join(', '), b?.heimathafen ? `aus ${b.heimathafen}` : null].filter(Boolean).join(' ');
    const groesseKl = b?.size ?? info.size ?? null;
    const laenge = b?.length ?? info.length, breite = b?.beam ?? info.beam;
    const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    const bild = el('img', 'hm-sb-bild');
    bild.alt = '';
    bild.width = 84; bild.height = 44;
    const modell = b?.modelId ?? b?.typeId;
    if (b && groesseKl && modell) {
      maler ??= bildMaler(game);
      try { maler.bild({ id: modell, size: groesseKl }).then((r) => { if (r?.src) bild.src = r.src; }).catch(() => {}); } catch { /* ohne Bild */ }
    }
    const kopf = el('div', 'hm-sb-kopf');
    const txt = el('div', 'hm-sb-text');
    txt.append(el('small', null, 'Fernglas'), el('b', null, name));
    if (unter) txt.append(el('span', null, unter));
    kopf.append(bild, txt);
    const fakten = el('ul', 'hm-sb-fakten');
    if (groesseKl) fakten.append(el('li', null, `Größe ${groesseKl}`));
    if (Number.isFinite(laenge)) fakten.append(el('li', null, `${meter(laenge)} × ${meter(breite)}`));
    if (Number.isFinite(b?.draft)) fakten.append(el('li', null, `Tiefgang ${meter(b.draft)}`));
    if (b?.besuche > 1) fakten.append(el('li', null, `Stammgast, ${b.besuche}. Besuch`));
    const status = el('p', 'hm-sb-status', statusText(b));
    const knoepfe = el('div', 'hm-sb-knoepfe');
    if (game.logbuch?.oeffnen && b) {
      const lb = el('button', 'hm-px', 'Im Logbuch');
      lb.type = 'button';
      lb.addEventListener('click', () => { const m = b.modelId ?? b.typeId; fernglas.ende(); game.logbuch.oeffnen('boote', m); });
      knoepfe.append(lb);
    }
    const ab = el('button', 'hm-px', 'Fernglas ab');
    ab.type = 'button';
    ab.addEventListener('click', () => fernglas.ende());
    knoepfe.append(ab);
    karte.replaceChildren(kopf, fakten, status, knoepfe);
    karte.dataset.boot = String(id);
  }
  function platziereKarte() {
    // PC und Tablet: links unter der Schilderspalte (dort ist frei bis zur Zeit). Handy quer: oben in der
    // Mitte zwischen Kasse und Menü. Handy hochkant: über der Zeit und Bauen.
    const breit = innerWidth >= 700 && innerHeight >= 600;
    const quer = innerWidth >= 700 && !breit;
    karte.classList.toggle('breit', breit);
    karte.classList.toggle('quer', quer);
    karte.style.top = karte.style.bottom = '';
    if (quer) return;
    if (breit) {
      const seite = document.getElementById('hm-seite');
      const r = seite && !seite.hidden ? seite.getBoundingClientRect() : null;
      karte.style.top = `${Math.round(r && r.height ? r.bottom + 12 : 220)}px`;
      return;
    }
    const zeit = document.getElementById('hm-zeit');
    const bau = document.getElementById('btn-build');
    const oben = Math.min(...[zeit, bau].filter((e) => e && !e.hidden && e.offsetParent).map((e) => e.getBoundingClientRect().top), innerHeight - 12);
    karte.style.bottom = `${Math.round(innerHeight - oben + 8)}px`;
  }

  const fernglas = {
    get aktiv() { return !!fg; },
    get boot() { return fg?.id ?? null; },
    /** Kann das Fernglas dieses Boot zeigen? Wartende Boote haben ihre eigene Karte. */
    kann(id) {
      if (game.foto?.rundflugAktiv) return false;   // "Hafen schauen" führt die Kamera selbst
      const a = game.boatView?.boot?.(id);
      if (!a?.model || a.model.visible === false || !a.model.parent) return false;
      const b = bootDaten(id);
      return !(b && b.status === 'waiting');
    },
    start(id) {
      if (!fernglas.kann(id)) return false;
      if (fg) fernglas.ende({ still: true });
      // Steht gerade etwas Wichtigeres (Feier, Tagesabschluss, Ereignis), bleibt es beim Hineinzoomen
      if (game.meldungen) {
        game.meldungen.wunsch('fernglas', 58);
        if (!game.meldungen.darf('fernglas')) { game.meldungen.fertig('fernglas'); return false; }
      }
      const a = game.boatView.boot(id);
      const L = a.info?.length ?? bootDaten(id)?.length ?? 8;
      fg = { id, zoomZiel: klemme(L * 4.5, (cam.minWidth ?? 15) * 1.1, 70), zoomen: true, statusT: 0 };
      cam.stop?.();
      cam.flyTo(a.model.position.x, a.model.position.z);
      if (cam.setPitch) cam.setPitch(Math.max(cam.pitchMin?.(fg.zoomZiel) * 180 / Math.PI || 0, 32));
      zeichneKarte(id);
      platziereKarte();
      karte.hidden = false;
      document.body.classList.add('hm-fernglas');
      sfx('fernglas');
      haptic(10);
      game.emit('gesten:fernglas', { boot: id, an: true });
      return true;
    },
    ende({ still = false } = {}) {
      if (!fg) return;
      const id = fg.id;
      fg = null;
      karte.hidden = true;
      document.body.classList.remove('hm-fernglas');
      game.meldungen?.fertig('fernglas');
      if (!still) game.emit('gesten:fernglas', { boot: id, an: false });
    },
  };
  // Doppeltipp (input-touch.js, auch Doppelklick mit der Maus): erledigt = kein Hineinzoomen
  game.on('doubletap', (d = {}) => {
    if (baut()) return;
    const pk = [d.pick, d.vorher].find((x) => x?.type === 'boat') ?? game.pick?.(d.x, d.y, { types: ['boat'] });
    if (pk?.type !== 'boat') return;
    if (fernglas.start(pk.id)) d.erledigt = true;
  });
  // Jede eigene Bewegung beendet das Folgen (Finger, Maustaste, Tasten zum Schieben, Übersicht)
  canvas.addEventListener('pointerdown', () => { if (fg) fernglas.ende(); }, true);
  window.addEventListener('keydown', (e) => {
    if (!fg || e.code === 'KeyH' || e.code === 'KeyP' || e.code === 'KeyM') return;
    if (/^(Key[WASDQERV]|Arrow|Digit0|Numpad0|Home|PageUp|PageDown)/.test(e.code)) fernglas.ende();
  });
  document.getElementById('btn-overview')?.addEventListener('click', () => fernglas.ende(), true);
  game.on('ui:cancel', () => fernglas.ende());
  game.on('resize', () => { if (fg) platziereKarte(); });

  // Weltversatz zwischen Blickpunkt und der Mitte des Bildteils, den der Steckbrief frei lässt
  function blickVersatz() {
    const W = cam.screenW, H = cam.screenH;
    const r = karte.getBoundingClientRect();
    const c = canvas.getBoundingClientRect();
    const k = { l: r.left - c.left, r: r.right - c.left, o: r.top - c.top, u: r.bottom - c.top };
    // vier Möglichkeiten: links, rechts, über, unter der Karte; die größte gewinnt
    const flaechen = [
      { x0: 0, x1: k.l, y0: 0, y1: H }, { x0: k.r, x1: W, y0: 0, y1: H },
      { x0: 0, x1: W, y0: 0, y1: k.o }, { x0: 0, x1: W, y0: k.u, y1: H },
    ].map((f) => ({ ...f, a: Math.max(0, f.x1 - f.x0) * Math.max(0, f.y1 - f.y0) }));
    const f = karte.hidden || !r.width ? { x0: 0, x1: W, y0: 0, y1: H } : flaechen.sort((p, q) => q.a - p.a)[0];
    const ziel = cam.screenToWorld((f.x0 + f.x1) / 2, (f.y0 + f.y1) / 2);
    if (!ziel) return { x: 0, z: 0 };
    return { x: ziel.x - cam.target.x, z: ziel.z - cam.target.z };
  }

  function tickFernglas(dt) {
    if (!fg) return;
    if (baut()) { fernglas.ende(); return; }
    const a = game.boatView?.boot?.(fg.id);
    if (!a?.model?.parent || a.model.visible === false) { fernglas.ende(); return; }
    if (game.foto?.rundflugAktiv) { fernglas.ende(); return; }
    // Das Boot soll in der Mitte des freien Bildes stehen, nicht hinter dem Steckbrief
    const d = blickVersatz();
    cam.flyTo(a.model.position.x - d.x, a.model.position.z - d.z);
    if (fg.zoomen) {
      const f = cam.viewWidth / fg.zoomZiel;
      if (Math.abs(Math.log(f)) < 0.01) fg.zoomen = false;
      else cam.zoomAt(Math.pow(f, Math.min(1, dt * 3)));
    }
    fg.statusT -= dt;
    if (fg.statusT <= 0) {
      fg.statusT = 0.3;
      // Eine wichtigere Meldung (Tagesabschluss, Feier, Ereignis) will stehen: Fernglas absetzen
      if (game.meldungen && !game.meldungen.darf('fernglas')) { fernglas.ende(); return; }
      const p = karte.querySelector('.hm-sb-status');
      const t = statusText(bootDaten(fg.id));
      if (p && p.textContent !== t) p.textContent = t;
    }
  }

  // ------------------------------------------------------------------ Jedes Bild
  let glockeTakt = 0;
  game.onTick(() => {
    const t = performance.now() / 1000;
    const dt = Math.min(0.1, t - jetzt) * api.zeitlupe;
    jetzt = t;
    tickMuenzen(dt);
    tickRinge(dt);
    tickMoewen(dt);
    if (t >= glockeTakt) { glockeTakt = t + 1; glockeSetzen(); }
    tickGlocke(dt);
    tickFernglas(dt);
  });
  game.on('stufe', () => { plaetzeCache = null; });

  const api = {
    moewen: () => moewen.map((m) => ({ zustand: m.zustand, x: m.pos.x, y: m.pos.y, z: m.pos.z, art: m.platz?.art ?? null })),
    aufscheuchen,
    hafenhorn,
    fernglas,
    glocke: () => laeuten(),
    glockeOrt: () => (glocke.visible ? glocke.position.clone() : null),
    wellenring: (x, z) => wellenring(x, z),
    hornErlaubt,
    zeitlupe: 1,   // nur für Tests und Vorschaubilder: 0.1 = zehnmal langsamer
    _halten: () => ({ finger: [...finger], halten: halten ? { art: halten.art, aktiv: !!halten.aktiv } : null }),
    _fliegend: () => fliegend.map((f) => ({ t: f.t, x: f.m.position.x, y: f.m.position.y, z: f.m.position.z, s: f.m.scale.x, v: f.m.visible })),
    sitzplaetze: () => sitzplaetze().map(({ key, x, y, z, art }) => ({ key, x, y, z, art })),
  };
  game.hafengesten = api;
  game.fernglas = fernglas;
  return api;
}

function injectStyles() {
  if (document.getElementById('hm-hafengesten-css')) return;
  const s = document.createElement('style');
  s.id = 'hm-hafengesten-css';
  s.textContent = `
.hm-horn-ring { position: fixed; z-index: 30; width: 64px; height: 64px; margin: -32px 0 0 -32px; pointer-events: none; }
.hm-horn-ring[hidden] { display: none; }
.hm-horn-ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.hm-horn-ring circle { fill: none; stroke: rgba(36, 54, 74, 0.35); stroke-width: 5; }
.hm-horn-ring circle.voll { stroke: #f2c14e; stroke-dasharray: 100.6; stroke-dashoffset: 100.6; stroke-linecap: butt; }
.hm-horn-ring.laeuft circle.voll { animation: hm-horn-fuellen var(--hm-horn-ms, 380ms) linear forwards; }
@keyframes hm-horn-fuellen { to { stroke-dashoffset: 0; } }
.hm-fernglas-rand { position: absolute; inset: 0; pointer-events: none; opacity: 0; transition: opacity .35s;
  background: radial-gradient(ellipse 72% 78% at 50% 48%, transparent 62%, rgba(14, 24, 34, 0.42) 100%); }
body.hm-fernglas .hm-fernglas-rand { opacity: 1; }
.hm-steckbrief { position: fixed; z-index: 24; box-sizing: border-box; display: grid; gap: 6px; padding: 8px 10px 10px;
  left: calc(var(--hm-links, 12px)); right: calc(var(--hm-rechts, 12px)); bottom: 120px; color: var(--hm-tinte, #24364a);
  font: 400 var(--hm-s, 14px)/1.35 var(--hm-pixel, system-ui); }
.hm-steckbrief[hidden] { display: none; }
.hm-steckbrief.breit { left: calc(var(--hm-links, 12px)); right: auto; bottom: auto; width: 320px; }
.hm-steckbrief.quer { left: 50%; right: auto; top: calc(var(--hm-oben, 12px)); bottom: auto; transform: translateX(-50%); width: 360px; }
.hm-steckbrief .hm-sb-kopf { display: flex; gap: 10px; align-items: center; }
.hm-steckbrief .hm-sb-bild { width: 84px; height: 44px; image-rendering: pixelated; flex: none; background: rgba(86, 170, 196, 0.18); }
.hm-steckbrief .hm-sb-text { display: grid; min-width: 0; }
.hm-steckbrief .hm-sb-text small { font-size: calc(var(--hm-s, 14px) - 3px); color: var(--hm-tinte-2, #5a6a7c); text-transform: uppercase; letter-spacing: .06em; }
.hm-steckbrief .hm-sb-text b { font-size: calc(var(--hm-s, 14px) + 2px); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hm-steckbrief .hm-sb-text span { font-size: calc(var(--hm-s, 14px) - 1px); }
.hm-steckbrief .hm-sb-fakten { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 4px; }
.hm-steckbrief .hm-sb-fakten li { padding: 1px 6px; background: var(--hm-mulde, #e9dfca); font-size: calc(var(--hm-s, 14px) - 2px); }
.hm-steckbrief .hm-sb-status { margin: 0; }
.hm-steckbrief .hm-sb-knoepfe { display: flex; gap: 6px; justify-content: flex-end; }
.hm-steckbrief .hm-sb-knoepfe button, .hm-gesten-tipp button { min-height: 36px; padding: 2px 10px; cursor: pointer; }
.hm-gesten-tipp { position: fixed; z-index: 25; left: 50%; transform: translateX(-50%); top: calc(var(--hm-oben, 12px) + 64px);
  width: min(420px, calc(100vw - 24px)); box-sizing: border-box; display: flex; flex-wrap: wrap; gap: 6px 8px; align-items: center;
  padding: 8px 10px; color: var(--hm-tinte, #24364a); font: 400 var(--hm-s, 14px)/1.35 var(--hm-pixel, system-ui); }
.hm-gesten-tipp[hidden] { display: none; }
.hm-gesten-tipp span { flex: 1 1 200px; }
`;
  document.head.appendChild(s);
}

export default init;
