// Hafenmeister: Gesten, die Spaß machen sollen. Gilt für Handy, Tablet und PC gleich (Pointer Events).
//
//   1. Schleppleine: ein wartendes Boot (Boje oder Ankerplatz vor dem Hafen) mit dem Finger greifen
//      und auf einen leuchtenden Liegeplatz ziehen. Am Rand des Bildschirms läuft die Karte mit.
//      Kurz antippen zeigt den Knopf "Einfahren": das Boot sucht sich selbst den besten Platz.
//   1b. Umlegen (P33): ein liegendes Boot kurz gedrückt halten, bis der Ring um den Finger voll ist,
//      dann an der Leine in eine andere leuchtende Box ziehen. Wer gleich zieht, verschiebt die Karte.
//   2. Kassierstrich: abends mit einem Finger in einem Zug über die Münzen streichen.
//      Jede Münze klingt einen Ton höher, am Ende ein kleiner Akkord.
//   3. (entfallen) Vorspulen steuern jetzt die Tempo-Knöpfe in ui/oberflaeche.js,
//      (Pause, 1x, 3x, 8x).
//
// Dieses Modul entscheidet nichts über Spielregeln. Es sendet Absichten als Ereignisse
// (docs/grundgeruest.md) und fragt die Spielregeln über game.sim, falls vorhanden:
//   game.sim.wartet(bootId)            -> true, wenn das Boot vor dem Hafen wartet
//   game.sim.passendePlaetze(bootId)   -> [platzId, ...] freie Plätze, an die es passt
//   game.sim.wunschPlaetze(bootId)     -> [platzId, ...] davon die, die einen Platz-Wunsch erfüllen (gold)
//   game.sim.platzWert(bootId, platzId) -> { fee, wishesMet, anchors, snug } für das Schild beim Einrasten
//   game.sim.umlegbar(bootId)          -> true, wenn das liegende Boot umgelegt werden darf (P33)
//   game.sim.umlegeZiele(bootId)       -> [platzId, ...] freie Boxen, in die es umgelegt werden kann
// Gesendet werden:
//   ui:tow        { boot, x, z, platz }   während des Ziehens (platz = eingerasteter Platz oder null)
//   ui:tow-end    { boot, platz }         losgelassen, platz = null heißt abgebrochen
//   ui:auto-einfahren { boot }            Knopf "Einfahren"
//   ui:collect    { coin, combo }         eine Münze eingestrichen
//   ui:strich-ende { anzahl }             Strich zu Ende (Trinkgeld ab 3 Münzen, bridge.js)
//   ui:vorspulen  { speed }               (sendet jetzt ui/oberflaeche.js)
//   tap           wie core/input.js, wenn ein Boot nur angetippt wurde
// Klänge: game.audio.sfx(name, optionen), sonst ein kleiner eingebauter WebAudio-Ersatz.

import { HAFEN, platzInWelt } from '../data/harbor.js';
import { PIXEL, FARBE as PIXELFARBE } from './pixel-symbole.js';
import { wunschKurz } from '../data/wuensche-texte.js';

const TAP_SLOP = 10;          // px, ab hier wird aus einem Tipp ein Ziehen
const SNAP_PX = 56;           // so nah muss der Finger am Platz sein, damit die Leine einrastet
const EDGE_PX = 64;           // Randzone, in der die Karte beim Ziehen mitläuft
const EDGE_SPEED = 520;       // px pro Sekunde am äußersten Rand
const HOLD_MS = 420;          // so lange ein liegendes Boot halten, bis es an der Leine hängt (P33)
const HOLD_SHOW_MS = 120;     // erst danach zeigt sich der Ring um den Finger (kein Flackern beim Tippen)
// Farben beim Zuweisen: Türkis passt, Gold passt und erfüllt einen Wunsch (P10, Review Ü9)
export const FARBE = { passt: '#2a9d8f', wunsch: '#f2b01e', hell: '#c9fff6', wunschHell: '#ffe9a3', paeckchen: '#f4f1e6' };
const SCHRIFT = '"Pixelify Sans", system-ui, sans-serif';
const WUNSCH = new Proxy({}, { get: (_, k) => wunschKurz(k) });   // alle Wünsche, auch Angebote (P19)

export function init(game) {
  const { THREE } = game;
  const canvas = game.canvas;
  const host = canvas.parentElement || document.body;
  const sound = createSound(game);

  // ---------------------------------------------------------------- Overlay für Leine und Spur
  injectStyles();
  const overlay = document.createElement('canvas');
  overlay.className = 'hm-gesten';
  overlay.setAttribute('aria-hidden', 'true');
  canvas.after(overlay);
  const ctx = overlay.getContext('2d');
  const fitOverlay = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    overlay.width = Math.round(canvas.clientWidth * dpr);
    overlay.height = Math.round(canvas.clientHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  fitOverlay();
  game.on('resize', fitOverlay);

  const local = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const _v = new THREE.Vector3();
  const toScreen = (pos) => {
    _v.copy(pos).project(game.camera.camera);
    return { x: (_v.x + 1) / 2 * game.camera.screenW, y: (1 - _v.y) / 2 * game.camera.screenH };
  };
  const haptic = (ms) => { try { navigator.vibrate?.(ms); } catch { /* egal */ } };

  // ---------------------------------------------------------------- Liegeplätze als leuchtende Ringe
  const ringGroup = new THREE.Group();
  ringGroup.name = 'gesten-ringe';
  game.scene.add(ringGroup);
  // Ringgröße folgt der Platzbreite, damit sich Nachbarplätze nicht überlappen
  // (Box S ist 3 m breit -> Außenradius 1,35 m). Geometrien je Radius zwischenspeichern.
  const ringGeos = new Map();
  const ringGeo = (platz) => {
    const m = HAFEN.einheiten?.meterProEinheit ?? 0.62;
    const quer = Math.min(platz.breite ?? 5, platz.laenge ?? 5) * m;
    const r = Math.round(Math.min(2.4, Math.max(0.9, quer * 0.45)) * 20) / 20;
    if (!ringGeos.has(r)) {
      const g = new THREE.RingGeometry(r * 0.62, r, 40);
      g.rotateX(-Math.PI / 2);
      ringGeos.set(r, g);
    }
    return ringGeos.get(r);
  };
  const ringMat = new THREE.MeshBasicMaterial({ color: FARBE.passt, transparent: true, opacity: 0.85, depthTest: false });
  const ringMatGold = new THREE.MeshBasicMaterial({ color: FARBE.wunsch, transparent: true, opacity: 0.9, depthTest: false });
  const ringMatHot = new THREE.MeshBasicMaterial({ color: '#ee6454', transparent: true, opacity: 0.95, depthTest: false });
  // Päckchen (P27): Rahmen in Tauweiß neben dem Boot, an das man längsseits gehen kann
  const ringMatPaeckchen = new THREE.MeshBasicMaterial({ color: FARBE.paeckchen, transparent: true, opacity: 0.9, depthTest: false });
  let gold = new Set();          // Plätze, die einen Wunsch des gezogenen Boots erfüllen (P10)
  const istPaeckchen = (id) => !!game.sim?.istPaeckchen?.(id);
  const ringMatFuer = (id) => (istPaeckchen(id) ? ringMatPaeckchen : gold.has(id) ? ringMatGold : ringMat);
  // Rahmen um die Lage des Boots außen (Länge entlang x, Breite quer), 0,35 m breite Kante
  function paeckchenRahmen(l) {
    const a = l.length / 2 + 0.4, b = l.width / 2 + 0.4, k = 0.35;
    const form = new THREE.Shape([new THREE.Vector2(-a, -b), new THREE.Vector2(a, -b), new THREE.Vector2(a, b), new THREE.Vector2(-a, b)]);
    form.holes.push(new THREE.Path([new THREE.Vector2(-a + k, -b + k), new THREE.Vector2(-a + k, b - k), new THREE.Vector2(a - k, b - k), new THREE.Vector2(a - k, -b + k)]));
    const g = new THREE.ShapeGeometry(form);
    g.rotateX(-Math.PI / 2);
    return g;
  }

  // Mit Stegen in 3D leuchtet die Box selbst (render/stege.js, gleiche Form und Drehung wie der
  // Platz, nichts ragt darueber hinaus). Die Ringe bleiben unsichtbar als Fangpunkte zum Einrasten.
  const boxen = () => !!game.stege?.highlight;
  function faerbeBoxen() {
    if (!boxen()) return;
    const ids = ringGroup.children.map((m) => m.userData.platz).filter((id) => !istPaeckchen(id));
    game.stege.highlight(ids, FARBE.passt);
    for (const id of ids) {
      const mat = game.stege.platz?.(id)?.mesh?.material;
      if (!mat) continue;
      const hot = id === tow?.ziel;
      // Türkis = passt, Gold = passt und erfüllt einen Wunsch (Strom), eingerastet hell = "hier loslassen"
      mat.color.set(hot ? (gold.has(id) ? FARBE.wunschHell : FARBE.hell) : gold.has(id) ? FARBE.wunsch : FARBE.passt);
      mat.opacity = hot ? 0.8 : 0.45;
    }
  }
  function leereRinge() {
    for (const m of ringGroup.children) if (m.userData.paeckchen) m.geometry.dispose();
    ringGroup.clear();
  }
  function showRings(ids, boot = null) {
    leereRinge();
    const g = boot != null ? game.sim?.wunschPlaetze?.(boot) : null;
    gold = new Set(Array.isArray(g) ? g : []);
    const stufe = game.state?.stufe ?? game.sim?.state?.stage ?? 1;
    for (const id of ids) {
      if (istPaeckchen(id)) {
        const l = game.paeckchen?.lage?.(id, boot);
        if (!l) continue;
        const r = new THREE.Mesh(paeckchenRahmen(l), ringMatFuer(id));
        r.position.set(l.x, 0.12, l.z);
        r.rotation.y = l.heading;
        r.renderOrder = 10;
        r.userData.platz = id;
        r.userData.paeckchen = true;
        ringGroup.add(r);
        continue;
      }
      const platz = HAFEN.plaetze.find((p) => p.id === id);
      const w = platz && platzInWelt(platz, stufe);
      if (!w) continue;
      const m = new THREE.Mesh(ringGeo(platz), ringMatFuer(id));
      m.position.set(w.x, 0.08, w.z);
      m.renderOrder = 10;
      m.userData.platz = id;
      m.visible = !boxen();
      // genau in die Mitte der gezeichneten Box
      const sp = game.stege?.platz?.(id);
      if (sp) m.position.set(sp.x, 0.08, sp.z);
      ringGroup.add(m);
    }
    faerbeBoxen();
  }

  // ---------------------------------------------------------------- Zustand
  let tow = null;      // { pid, boot, object, start, finger, moved, ziel, ringe, umlegen }
  let halten = null;   // liegendes Boot gedrückt: { pid, boot, object, start, finger, t0 } (P33)
  let strich = null;   // { pid, pts, combo, done:Set }
  let chip = null;     // Knopf "Einfahren" { el, boot, object }
  const fliegend = []; // eingestrichene Münzen, die gerade wegfliegen
  const texte = [];    // kurze Texte über der Karte ("7 in einem Strich")

  const isWaiting = (pick) => {
    if (!pick || pick.type !== 'boat') return false;
    const s = game.sim?.wartet?.(pick.id);
    if (typeof s === 'boolean') return s;
    return pick.object?.userData?.wartet === true;
  };
  const fittingBerths = (boot) => {
    const ids = game.sim?.passendePlaetze?.(boot);
    return Array.isArray(ids) ? ids : [];
  };
  const umlegbar = (pick) => !!(pick && pick.type === 'boat' && game.sim?.umlegbar?.(pick.id));
  const umlegeZiele = (boot) => {
    const ids = game.sim?.umlegeZiele?.(boot);
    return Array.isArray(ids) ? ids : [];
  };

  // ---------------------------------------------------------------- Zeiger abfangen (vor core/input.js)
  // Capture-Listener am Elternelement laufen vor den Listenern am Canvas. Nur wenn ein Zeiger auf
  // einem wartenden Boot oder einer Münze startet, übernimmt dieses Modul ihn ganz.
  host.addEventListener('pointerdown', (e) => {
    if (e.target !== canvas) return;
    // Zweiter Finger: Leine oder Strich abbrechen und den ersten Finger an core/input.js
    // übergeben, damit Zoomen, Drehen und Neigen mit beiden Fingern sofort greifen
    if (tow) { const t = tow; endTow(false, true); game.input?.uebernehmen?.(t.pid, t.finger); return; }
    if (halten) { halten = null; return; }
    if (strich) { const s = strich; endStrich(); game.input?.uebernehmen?.(s.pid, s.pts[s.pts.length - 1]); return; }
    if (e.button !== undefined && e.button > 0) return;
    sound.unlock();
    const p = local(e);

    const coin = game.pick(p.x, p.y, { types: ['coin'], tolerance: 30 });
    if (coin && !coin.object.userData.eingestrichen) {
      grab(e);
      strich = { pid: e.pointerId, pts: [p], combo: 0, done: new Set(), muenzen: alleMuenzen() };
      collect(coin, p);
      return;
    }

    const boat = game.pick(p.x, p.y, { types: ['boat'], tolerance: 28 });
    if (isWaiting(boat)) {
      grab(e);
      tow = { pid: e.pointerId, boot: boat.id, object: boat.object, start: p, finger: p, moved: false, ziel: null, ringe: [] };
      return;
    }
    // Liegendes Boot: noch nichts übernehmen. Die Karte darf sich wie immer verschieben lassen; erst
    // wer still hält, nimmt das Boot an die Leine (onTick). Ein kurzer Tipp bleibt ein Tipp.
    if (umlegbar(boat)) halten = { pid: e.pointerId, boot: boat.id, object: boat.object, start: p, finger: p, t0: performance.now() };
  }, true);

  host.addEventListener('pointermove', (e) => {
    if (halten && e.pointerId === halten.pid) {
      halten.finger = local(e);
      if (Math.hypot(halten.finger.x - halten.start.x, halten.finger.y - halten.start.y) >= TAP_SLOP) halten = null;
      return;
    }
    if (tow && e.pointerId === tow.pid) { e.stopPropagation(); moveTow(local(e)); }
    else if (strich && e.pointerId === strich.pid) { e.stopPropagation(); moveStrich(local(e)); }
  }, true);

  const up = (e) => {
    if (halten && e.pointerId === halten.pid) { halten = null; return; }
    if (tow && e.pointerId === tow.pid) { e.stopPropagation(); endTow(e.type === 'pointerup'); }
    else if (strich && e.pointerId === strich.pid) { e.stopPropagation(); endStrich(); }
  };
  host.addEventListener('pointerup', up, true);
  host.addEventListener('pointercancel', up, true);

  function grab(e) {
    e.stopPropagation();
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch { /* egal */ }
  }

  // ---------------------------------------------------------------- 1. Schleppleine
  function moveTow(p) {
    tow.finger = p;
    if (!tow.moved && Math.hypot(p.x - tow.start.x, p.y - tow.start.y) < TAP_SLOP) return;
    if (!tow.moved) {
      tow.moved = true;
      hideChip();
      tow.ringe = tow.umlegen ? umlegeZiele(tow.boot) : fittingBerths(tow.boot);
      showRings(tow.ringe, tow.boot);
      sound.play('leine-greifen');
      haptic(10);
    }
    updateSnap();
  }

  // Liegendes Boot lange genug gehalten: jetzt hängt es an der Leine (P33)
  function greifeLiegendes() {
    const h = halten;
    halten = null;
    const ziele = umlegeZiele(h.boot);
    if (!ziele.length) {
      // Nichts frei: sagen statt still nichts tun. Der Finger verschiebt weiter die Karte.
      textAmBoot(h.boot, 'Keine passende Box frei', '#ffd76a');
      haptic(6);
      return;
    }
    game.input?.abgeben?.(h.pid);
    try { canvas.setPointerCapture(h.pid); } catch { /* egal */ }
    hideChip();
    tow = { pid: h.pid, boot: h.boot, object: h.object, start: h.start, finger: h.finger, moved: true, ziel: null, ringe: ziele, umlegen: true, griff: performance.now() };
    showRings(ziele, h.boot);
    sound.play('leine-greifen');
    haptic(18);
    updateSnap();
  }

  function updateSnap() {
    let best = null;
    let bestD = SNAP_PX;
    for (const m of ringGroup.children) {
      const s = toScreen(m.position);
      const d = Math.hypot(s.x - tow.finger.x, s.y - tow.finger.y);
      if (d < bestD) { bestD = d; best = m; }
    }
    const neu = best?.userData.platz ?? null;
    if (neu !== tow.ziel) {
      tow.ziel = neu;
      for (const m of ringGroup.children) m.material = m === best ? ringMatHot : ringMatFuer(m.userData.platz);
      faerbeBoxen();
      tow.wert = neu ? game.sim?.platzWert?.(tow.boot, neu) ?? null : null;
      // Nachgerüstete Stege (P30): Fingersteg, Licht stehen mit auf dem Schild
      if (tow.wert) tow.wert = { ...tow.wert, extras: game.nachruesten?.platzTeile?.(neu) ?? [] };
      if (neu) { sound.play('leine-einrasten'); haptic(8); }
    }
    const w = game.camera.screenToWorld(tow.finger.x, tow.finger.y);
    game.emit('ui:tow', { boot: tow.boot, x: w?.x, z: w?.z, platz: tow.ziel });
  }

  function endTow(ok, abbruch = false) {
    const t = tow;
    tow = null;
    leereRinge();
    gold = new Set();
    if (boxen()) game.stege.highlight([]);
    if (abbruch) {
      if (t.umlegen) { if (t.moved) game.emit('ui:tow-end', { boot: t.boot, platz: null, umlegen: true }); return; }
      // Zweiter Finger: Der Spieler will die Karte bewegen. Boot abwählen, sonst schiebt die
      // Bootskarte am Handy die Ansicht mitten in der Geste nach oben (ui/input-touch.js).
      if (game.sim?.selected === t.boot) game.sim.select?.(null);
      if (t.moved) game.emit('ui:tow-end', { boot: t.boot, platz: null });
      return;
    }
    if (!t.moved) {
      // Nur angetippt: wie ein normaler Tipp behandeln und den Knopf "Einfahren" zeigen
      const pick = game.pick(t.start.x, t.start.y);
      game.emit('tap', { x: t.start.x, y: t.start.y, world: game.camera.screenToWorld(t.start.x, t.start.y), pick });
      if (ok) showChip(t.boot, t.object);
      return;
    }
    const platz = ok ? t.ziel : null;
    game.emit('ui:tow-end', { boot: t.boot, platz, ...(t.umlegen ? { umlegen: true } : {}) });
    if (platz) { sound.play('anlegen'); haptic(18); }
  }

  // Knopf "Einfahren" am angetippten Boot
  function showChip(boot, object) {
    hideChip();
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'hm-einfahren';
    el.textContent = 'Einfahren';
    el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      game.emit('ui:auto-einfahren', { boot });
      sound.play('anlegen');
      haptic(12);
      hideChip();
    });
    host.appendChild(el);
    chip = { el, boot, object, bis: performance.now() + 6000 };
    placeChip();
  }
  function hideChip() { chip?.el.remove(); chip = null; }
  function placeChip() {
    if (!chip) return;
    const pos = chip.object.getWorldPosition(new THREE.Vector3());
    const s = toScreen(pos);
    chip.el.style.transform = `translate(${Math.round(s.x)}px, ${Math.round(s.y)}px) translate(-50%, -150%)`;
  }
  game.on('tap', (d) => { if (chip && d?.pick?.id !== chip.boot) hideChip(); });
  game.on('ui:cancel', hideChip);

  // ---------------------------------------------------------------- 2. Kassierstrich
  function moveStrich(p) {
    const last = strich.pts[strich.pts.length - 1];
    // Schnelle Wische: Zwischenpunkte prüfen, damit keine Münze übersprungen wird
    const steps = Math.max(1, Math.ceil(Math.hypot(p.x - last.x, p.y - last.y) / 12));
    for (let i = 1; i <= steps; i++) {
      const q = { x: last.x + (p.x - last.x) * i / steps, y: last.y + (p.y - last.y) * i / steps };
      const coin = muenzeBei(q);
      if (coin) collect(coin, q);
    }
    strich.pts.push(p);
    if (strich.pts.length > 60) strich.pts.shift();
  }

  // Münzen einmal pro Strich einsammeln und dann nur noch ihre Bildschirmlage prüfen.
  // Das ist viel billiger als game.pick bei jedem Zwischenpunkt.
  function alleMuenzen() {
    const list = [];
    game.scene.traverseVisible((o) => {
      const pk = o.userData?.pick;
      if (pk?.type === 'coin' && !o.userData.eingestrichen) list.push({ id: pk.id, type: 'coin', object: o });
    });
    return list;
  }
  const _w = new THREE.Vector3();
  function muenzeBei(q) {
    let best = null;
    let bestD = 26;
    for (const c of strich.muenzen) {
      if (strich.done.has(c.id)) continue;
      const s = toScreen(c.object.getWorldPosition(_w));
      const d = Math.hypot(s.x - q.x, s.y - q.y);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  function collect(coin, p) {
    const o = coin.object;
    if (strich.done.has(coin.id) || o.userData.eingestrichen) return;
    strich.done.add(coin.id);
    o.userData.eingestrichen = true;
    strich.combo++;
    game.emit('ui:collect', { coin: coin.id, combo: strich.combo });
    sound.play('muenze', { combo: strich.combo, pan: (p.x / Math.max(1, game.camera.screenW)) * 2 - 1 });
    haptic(6);
    fliegend.push({ o, t: 0, y0: o.position.y, s0: o.scale.x });
    if (strich.combo >= 2) texte.push({ text: `x${strich.combo}`, x: p.x, y: p.y - 34, t: 0, dauer: 0.6, klein: true });
  }

  // Trinkgeld für den langen Strich kommt von den Spielregeln (bridge.js, sim:strokeTip)
  let trinkgeld = 0;
  game.on('sim:strokeTip', (e) => { trinkgeld = e?.amount || 0; });
  function endStrich() {
    const s = strich;
    strich = null;
    const p = s.pts[s.pts.length - 1];
    trinkgeld = 0;
    game.emit('ui:strich-ende', { anzahl: s.combo });
    if (s.combo >= 2) sound.play('strich-ende', { anzahl: s.combo });
    if (s.combo >= 3) {
      texte.push({ text: `${s.combo} Münzen in einem Strich`, x: p.x, y: p.y - 60, t: 0, dauer: 1.6 });
      if (trinkgeld > 0) texte.push({ text: `+${trinkgeld} € Trinkgeld`, x: p.x, y: p.y - 30, t: 0, dauer: 1.8 });
      haptic(25);
    }
  }

  // 3. Vorspulen: früher die Sonne im Tagesbalken, jetzt die Tempo-Knöpfe in ui/oberflaeche.js
  const setSpeed = (speed) => game.oberflaeche?.tempo?.(speed);

  // ---------------------------------------------------------------- Jedes Bild
  let lastT = performance.now();
  game.onTick(() => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - lastT) / 1000);
    lastT = now;

    // Liegendes Boot lange genug gehalten: an die Leine nehmen (P33)
    if (halten && !tow && now - halten.t0 >= HOLD_MS) greifeLiegendes();

    // Während des Ziehens kann eine Box belegt werden (ein anderes Boot fährt selbst hinein):
    // zweimal je Sekunde neu fragen, belegte Boxen verlöschen, statt beim Loslassen zu scheitern
    if (tow?.moved && now - (tow.geprueft ?? 0) > 500) {
      tow.geprueft = now;
      const neu = tow.umlegen ? umlegeZiele(tow.boot) : fittingBerths(tow.boot);
      if (neu.length !== tow.ringe.length || neu.some((id, i) => id !== tow.ringe[i])) {
        tow.ringe = neu;
        const ziel = tow.ziel;
        showRings(neu, tow.boot);
        if (ziel && !neu.includes(ziel)) { tow.ziel = null; tow.wert = null; }
        for (const m of ringGroup.children) if (m.userData.platz === tow.ziel) m.material = ringMatHot;
        updateSnap();
      }
    }

    // Am Rand mitlaufen, solange eine Leine gezogen wird
    if (tow?.moved) {
      const f = tow.finger;
      const W = game.camera.screenW;
      const H = game.camera.screenH;
      const push = (d) => (d < EDGE_PX ? (1 - d / EDGE_PX) * EDGE_SPEED * dt : 0);
      const dx = push(W - f.x) - push(f.x);
      const dy = push(H - f.y) - push(f.y);
      if (dx || dy) { game.camera.panBy(-dx, -dy); updateSnap(); }
    }

    // Ringe pulsieren
    const puls = 1 + Math.sin(now / 180) * 0.08;
    for (const m of ringGroup.children) m.scale.setScalar(m.userData.platz === tow?.ziel ? 1.15 : puls);
    if (boxen() && ringGroup.children.length) {
      const o = 0.36 + Math.sin(now / 180) * 0.12;
      for (const m of ringGroup.children) {
        if (m.userData.platz === tow?.ziel) continue;
        const mat = game.stege.platz?.(m.userData.platz)?.mesh?.material;
        // Gold kräftiger als Türkis, damit es auf dem Wasser nicht blass wirkt
        if (mat) mat.opacity = gold.has(m.userData.platz) ? o + 0.3 : o;
      }
    }

    // Eingestrichene Münzen fliegen hoch und verschwinden
    for (let i = fliegend.length - 1; i >= 0; i--) {
      const f = fliegend[i];
      f.t += dt;
      const k = Math.min(1, f.t / 0.35);
      f.o.position.y = f.y0 + k * 4;
      f.o.scale.setScalar(f.s0 * (1 + k * 0.6) * (1 - k * 0.9));
      if (k >= 1) { f.o.visible = false; f.o.scale.setScalar(f.s0); f.o.position.y = f.y0; fliegend.splice(i, 1); }
    }


    if (chip) { if (now > chip.bis) hideChip(); else placeChip(); }
    draw(dt);
  });

  // Nur zeichnen, wenn etwas zu sehen ist oder gerade verschwindet: Eine Leinwand, die jedes Bild
  // geleert wird, muss der Browser jedes Bild neu über das Spiel legen (kostet spürbar Bildrate).
  let leer = true;
  function draw(dt) {
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    if (!tow && auswahlGold.size && game.sim?.selected == null) auswahlGold = new Set();
    const sterne = tow?.moved ? gold : auswahlGold;
    const haltK = halten ? (performance.now() - halten.t0 - HOLD_SHOW_MS) / (HOLD_MS - HOLD_SHOW_MS) : -1;
    const griffK = tow?.griff ? (performance.now() - tow.griff) / 250 : 1;
    const etwas = !!tow?.moved || haltK > 0 || (strich && strich.pts.length > 1) || texte.length > 0 || sterne.size > 0;
    if (!etwas && leer) return;
    ctx.clearRect(0, 0, W, H);
    leer = !etwas;

    // Kleiner Stern über jeder Box, die einen Wunsch erfüllt (Farbe nie allein, Review Bed P6)
    for (const id of sterne) {
      const sp = game.stege?.platz?.(id);
      if (!sp) continue;
      const s = toScreen(_stern.set(sp.x, 0.5, sp.z));
      // Größe folgt dem Zoom, damit sich die Sterne weit draußen nicht überdecken
      const s2 = toScreen(_stern.set(sp.x + 1, 0.5, sp.z));
      const k = Math.min(1.5, Math.max(0.6, Math.hypot(s2.x - s.x, s2.y - s.y) * 0.2));
      zeichnePixel(PIXEL.stern, s.x - 6 * k, s.y - 6 * k, k);
    }

    // Gedrückt halten: Ring um den Finger füllt sich (P33), in Pixelstufen wie die Oberfläche
    if (haltK > 0) {
      const f = halten.finger;
      const k = Math.min(1, haltK);
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(40,54,72,0.55)';
      ctx.beginPath(); ctx.arc(f.x, f.y, 30, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#fff4d6';
      const stufen = Math.ceil(k * 12) / 12;
      ctx.beginPath(); ctx.arc(f.x, f.y, 30, -Math.PI / 2, -Math.PI / 2 + stufen * Math.PI * 2); ctx.stroke();
    }
    // Gerade gegriffen: kurzer Ring, der aufgeht
    if (tow?.umlegen && griffK < 1) {
      const f = toScreen(tow.object.getWorldPosition(new THREE.Vector3()));
      ctx.globalAlpha = 1 - griffK;
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#fff4d6';
      ctx.beginPath(); ctx.arc(f.x, f.y, 20 + griffK * 40, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    if (tow?.moved) {
      const from = toScreen(tow.object.getWorldPosition(new THREE.Vector3()));
      let to = tow.finger;
      if (tow.ziel) {
        const ring = ringGroup.children.find((m) => m.userData.platz === tow.ziel);
        if (ring) to = toScreen(ring.position);
      }
      drawRope(from, to, !!tow.ziel);
      if (tow.ziel && tow.wert) drawWert(to, tow.wert, gold.has(tow.ziel));
      // Fingerpunkt
      ctx.beginPath();
      ctx.arc(tow.finger.x, tow.finger.y, 9, 0, Math.PI * 2);
      ctx.fillStyle = tow.ziel ? '#ee6454' : 'rgba(255,252,246,0.95)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#283648';
      ctx.stroke();
    }

    if (strich && strich.pts.length > 1) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const pts = strich.pts;
      for (let i = 1; i < pts.length; i++) {
        const k = i / pts.length;
        ctx.strokeStyle = `rgba(244, 197, 66, ${0.15 + 0.8 * k})`;
        ctx.lineWidth = 4 + 10 * k;
        ctx.beginPath();
        ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
        ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      }
    }

    for (let i = texte.length - 1; i >= 0; i--) {
      const t = texte[i];
      t.t += dt;
      const k = t.t / t.dauer;
      if (k >= 1) { texte.splice(i, 1); continue; }
      ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      ctx.font = `700 ${t.klein ? 20 : 26}px ${SCHRIFT}`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(40,54,72,0.85)';
      ctx.fillStyle = t.farbe ?? '#f4c542';
      // Auch wenn das Boot außerhalb des Bildes liegt: Text am Rand zeigen
      const y = Math.min(Math.max(70, t.y - k * 30), H - 110);
      // Am Rand nicht abschneiden: Text ganz im Bild halten
      const halb = ctx.measureText(t.text).width / 2 + 10;
      t.x = Math.min(Math.max(t.x, halb), Math.max(halb, W - halb));
      ctx.strokeText(t.text, t.x, y);
      ctx.fillText(t.text, t.x, y);
      ctx.globalAlpha = 1;
    }
  }

  // Platzwert beim Einrasten (Review A3): was die Box bringt, über der Box.
  // Erste Zeile Liegegeld und erwartete Anker, zweite Zeile erfüllte Wünsche und "passgenau".
  function drawWert(p, w, istGold) {
    const anker = `${String(w.anchors.toFixed(1)).replace('.', ',')} Anker`;
    // Umlegen (P33): Liegegeld bleibt, wie es ist; ab dem zweiten Mal kostet es Anker
    const z1 = w.relocate ? `Umlegen · ${anker}` : `${w.fee} € · ${anker}`;
    // weiter Weg zum WC oder zur Dusche (P19 B9): zählt nur halb, steht als "Dusche weit" da
    const weit = new Set(w.far || []);
    const teile = [...(w.wishesMet || []).map((k) => `${WUNSCH[k] ?? k}${weit.has(k) ? ' weit' : ''}`)];
    if (w.comfort) teile.push('Fingersteg');
    for (const t of w.extras || []) if (!teile.includes(t)) teile.push(t);
    if (w.snug) teile.push('passgenau');
    let z3 = w.relocate && w.malus > 0 ? `${w.mal}. Mal umgelegt: −${String(w.malus).replace('.', ',')} Anker` : null;
    // Päckchen (P27): längsseits an einem anderen Boot, halbes Liegegeld, beide Crews weniger Anker
    if (w.paeckchen) {
      teile.unshift('Päckchen · halbes Liegegeld');
      if (w.malus > 0) z3 = `Beide Crews −${String(w.malus).replace('.', ',')} Anker`;
    }
    const z2 = teile.join(' · ');
    ctx.font = `700 15px ${SCHRIFT}`;
    const breite = Math.max(ctx.measureText(z1).width, z2 ? ctx.measureText(z2).width : 0, z3 ? ctx.measureText(z3).width : 0) + 18;
    const hoehe = 26 + (z2 ? 18 : 0) + (z3 ? 18 : 0);
    const W = canvas.clientWidth;
    const x = Math.min(Math.max(p.x - breite / 2, 6), Math.max(6, W - breite - 6));
    const y = Math.max(6, p.y - hoehe - 22);
    ctx.fillStyle = 'rgba(40,54,72,0.92)';
    ctx.fillRect(x, y, breite, hoehe);
    ctx.fillStyle = istGold ? FARBE.wunsch : '#7fd8cc';
    ctx.fillRect(x, y, 4, hoehe);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#fffbea';
    ctx.fillText(z1, x + 10, y + 18);
    if (z2) {
      ctx.font = `600 13px ${SCHRIFT}`;
      ctx.fillStyle = istGold || w.snug ? '#ffd76a' : '#d9e2ea';
      ctx.fillText(z2, x + 10, y + 36);
    }
    if (z3) {
      ctx.font = `600 13px ${SCHRIFT}`;
      ctx.fillStyle = '#ff9a8a';
      ctx.fillText(z3, x + 10, y + (z2 ? 54 : 36));
    }
  }

  // Rückmeldung der Spielregeln an der Stelle des Boots: passgenau angelegt, verärgert abgefahren
  // nurImBild: Liegt das Boot außerhalb des Bildes (oder unter den Leisten), keinen Text zeigen,
  // statt ihn an den Rand zu kleben (Bojengeld: der Betrag steht ohnehin im Tagesabschluss)
  const textAmBoot = (id, text, farbe, { nurImBild = false } = {}) => {
    const a = game.boatView?.boot?.(id);
    if (!a?.model) return;
    const s = toScreen(a.model.getWorldPosition(new THREE.Vector3()));
    if (nurImBild) {
      const w = game.camera.screenW, h = game.camera.screenH;
      if (_v.z > 1 || s.x < 0 || s.x > w || s.y - 30 < 70 || s.y - 30 > h - 110) return;
    }
    texte.push({ text, x: s.x, y: s.y - 30, t: 0, dauer: 1.8, klein: true, farbe });
  };
  game.on('sim:moored', (e) => { if (e?.passgenau && e.hand) textAmBoot(e.boatId, 'Passgenau +¼ Anker', '#ffd76a'); });
  // Päckchen (P27): kurz sagen, was das bedeutet
  game.on('sim:moored', (e) => { if (e?.paeckchen) textAmBoot(e.boatId, 'Im Päckchen · halbes Liegegeld', '#f4f1e6'); });
  const aerger = (e) => { if (e?.rated) textAmBoot(e.boatId, `Verärgert: ${String(game.sim?.ctx?.rules?.turnAway?.rating ?? 2.5).replace('.', ',')} Anker`, '#ff9a8a', { nurImBild: true }); };
  game.on('sim:dismissed', aerger);
  // Bojengeld über Nacht (Review A9): kleiner Betrag über jedem Boot an der Boje
  game.on('sim:buoyFee', (e) => {
    for (const [id, betrag] of Object.entries(e?.perBoat || {})) if (betrag > 0) textAmBoot(Number(id), `Bojengeld +${betrag} €`, '#ffd76a', { nurImBild: true });
  });
  // Gold auch beim bloßen Antippen eines Boots (Bootskarte offen)
  let auswahlGold = new Set();
  game.on('sim:select', ({ boatId } = {}) => {
    const g = boatId != null ? game.sim?.wunschPlaetze?.(boatId) : null;
    auswahlGold = new Set(Array.isArray(g) ? g : []);
  });
  game.on('sim:moored', () => { if (game.sim?.selected == null) auswahlGold = new Set(); });
  const _stern = new THREE.Vector3();
  function zeichnePixel(raster, x, y, k) {
    raster.forEach((zeile, j) => [...zeile].forEach((c, i) => {
      if (c === '.' || c === ' ') return;
      ctx.fillStyle = PIXELFARBE[c] ?? '#24364a';
      ctx.fillRect(Math.round(x + i * k), Math.round(y + j * k), Math.ceil(k), Math.ceil(k));
    }));
  }
  game.on('sim:turnedAway', aerger);
  // Umgelegt (P33): kurz bestätigen, beim zweiten Mal sagen, was es kostet
  game.on('sim:relocated', (e) => {
    if (e?.grund !== 'hand') return;
    if (e.malus > 0) textAmBoot(e.boatId, `${e.mal}. Mal umgelegt: −${String(e.malus).replace('.', ',')} Anker`, '#ff9a8a');
    else if (e.passgenau) textAmBoot(e.boatId, 'Umgelegt, passgenau', '#ffd76a');
    else textAmBoot(e.boatId, 'Umgelegt', '#c9fff6');
  });
  game.on('sim:relocateFailed', (e) => textAmBoot(e?.boatId, 'Dort geht es nicht', '#ff9a8a'));
  // Das gehaltene Boot fährt gerade los (Tagestörn, Abreise): Leine los, nichts passiert
  const losfahren = (d = {}) => {
    const id = d.id ?? d.boatId;
    if (halten && String(halten.boot) === String(id)) halten = null;
    if (tow?.umlegen && String(tow.boot) === String(id)) {
      const t = tow;
      endTow(false, true);
      game.input?.uebernehmen?.(t.pid, t.finger);
    }
  };
  game.on('dauer:auslaufen', losfahren);
  game.on('boot-faehrt', losfahren);

  // Leine mit etwas Durchhang, eingerastet straff
  function drawRope(a, b, straff) {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const sag = straff ? 0 : Math.min(40, len * 0.18);
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2 + sag;
    ctx.lineCap = 'round';
    for (const [w, c] of [[7, 'rgba(40,54,72,0.55)'], [4, straff ? '#fff4d6' : '#e8d8b0']]) {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(mx, my, b.x, b.y);
      ctx.lineWidth = w;
      ctx.strokeStyle = c;
      ctx.setLineDash(straff || w === 7 ? [] : [10, 6]);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  game.gesten = { sound, setSpeed, einfahrenAmBoot: true };
}

export default init;

// ---------------------------------------------------------------- Klänge
// Bevorzugt game.audio.sfx(name, optionen) aus dem Ton-Modul. Sonst kleine WebAudio-Töne,
// damit die Gesten auch ohne Ton-Modul nach etwas klingen.
function createSound(game) {
  let ac = null;
  let muted = false;
  game.on('ui:mute', (m) => { muted = typeof m === 'boolean' ? m : !muted; });

  const PENTA = [0, 2, 4, 7, 9];   // Dur-Pentatonik, klingt in jeder Reihenfolge gut
  const note = (step) => 659.25 * Math.pow(2, (PENTA[step % 5] + 12 * Math.floor(step / 5)) / 12);

  function unlock() {
    if (game.audio || ac) { ac?.resume?.(); return; }
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { ac = null; }
  }

  function tone(freq, t0, dur, { type = 'sine', vol = 0.18, slide = 0 } = {}) {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(ac.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  function noise(t0, dur, { from = 400, to = 2000, vol = 0.12, q = 1.2 } = {}) {
    const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buf;
    const f = ac.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = q;
    f.frequency.setValueAtTime(from, t0);
    f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(ac.destination);
    src.start(t0);
  }

  function play(name, opt = {}) {
    if (muted) return;
    if (typeof game.audio?.sfx === 'function') { game.audio.sfx(name, opt); return; }
    if (!ac) return;
    const t = ac.currentTime + 0.005;
    switch (name) {
      case 'muenze': {
        const f = note(Math.min(opt.combo ?? 1, 15) - 1);
        tone(f, t, 0.16, { type: 'triangle', vol: 0.16 });
        tone(f * 2, t + 0.03, 0.12, { type: 'sine', vol: 0.07 });
        break;
      }
      case 'strich-ende': {
        const n = Math.min(opt.anzahl ?? 2, 12);
        const base = 523.25;
        [0, 4, 7, 12].slice(0, n >= 6 ? 4 : 3).forEach((s, i) =>
          tone(base * Math.pow(2, s / 12), t + 0.06 + i * 0.05, 0.5, { type: 'triangle', vol: 0.1 }));
        break;
      }
      case 'leine-greifen': tone(220, t, 0.12, { type: 'sine', vol: 0.15, slide: 1.6 }); break;
      case 'leine-einrasten': tone(1046, t, 0.05, { type: 'square', vol: 0.05 }); break;
      case 'anlegen':
        tone(160, t, 0.18, { type: 'sine', vol: 0.22, slide: 0.7 });
        noise(t, 0.12, { from: 300, to: 180, vol: 0.08 });
        break;
      case 'vorspulen-start': noise(t, 0.35, { from: 300, to: 2400, vol: 0.06 }); break;
      case 'vorspulen-ende': noise(t, 0.3, { from: 2000, to: 300, vol: 0.05 }); break;
      default: break;
    }
  }

  return { play, unlock, get muted() { return muted; } };
}

// ---------------------------------------------------------------- Aussehen
// Gilt auf allen Geräten, deshalb hier und nicht in einer ui-*.css.
function injectStyles() {
  if (document.getElementById('hm-gesten-css')) return;
  const s = document.createElement('style');
  s.id = 'hm-gesten-css';
  s.textContent = `
.hm-gesten { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 5; }
.hm .hm-einfahren, .hm-einfahren {
  position: absolute; left: 0; top: 0; z-index: 25;
  min-height: 44px; padding: 0 18px; border: 0; border-radius: 22px;
  background: #283648; color: #fffcf6; font: 700 16px system-ui, -apple-system, sans-serif;
  box-shadow: 0 4px 14px rgba(0,0,0,.25); touch-action: manipulation; cursor: pointer;
  animation: hm-pop .18s ease-out;
}
@keyframes hm-pop { from { opacity: 0; scale: .8; } to { opacity: 1; scale: 1; } }
@media (prefers-reduced-motion: reduce) { .hm-einfahren { animation: none; } }
`;
  document.head.appendChild(s);
}
