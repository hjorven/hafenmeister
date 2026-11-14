// Start des Spiels. Diese Datei gehoert dem Grundgeruest-Thread.
// Andere Module bekommen das Spielobjekt `game` (siehe js/core/game.js) und haengen sich daran.
import { createGame } from './core/game.js';
import { initInput } from './core/input.js';
import { addPlaceholderWorld } from './render/placeholder.js';
import { plaetzeInStufe, platzInWelt } from './data/harbor.js';
import { warteplaetze } from './render/landschaft/gelaende.js';

// Module der anderen Threads. Jedes exportiert eine Funktion init(game) (oder default),
// die das Spielobjekt bekommt. Fehlt eine Datei noch, wird sie still uebersprungen.
// Neue Module hier eintragen, dann muss niemand sonst main.js oder index.html anfassen.
const MODULES = [
  './data/stegbild.js',
  './render/landschaft/formen.js',      // Geländeform des Spiels (Thread Geländeform), vor der Landschaft
  './world/region.js',
  './render/landscape.js',
  './render/stege.js',
  './render/services.js',
  './render/buildings.js',
  './render/boats/s.js',
  './render/boats/m.js',
  './render/boats/l.js',
  './render/boats/xl.js',
  './render/boats/xxl.js',
  './render/boats/verkehr.js',
  './render/boat-anim.js',
  './render/boat-view.js',
  './render/people.js',
  './ui/input-pc.js',
  './ui/input-touch.js',
  './ui/gesten.js',
  './ui/kamera.js',
  './ui/hud.js',
  './ui/bauen.js',
  './ui/fotomodus.js',
  './ui/vorschau.js',
  './ui/meldungen.js',                 // Meldungs-Ordnung: höchstens eine schwebende Meldung zugleich
  './ui/hafenzeichen.js',              // P55: Auslastung an Gebäuden, Zeiger am Rand zu wartenden Booten
  './audio/audio.js',
  './state.js',
  './events/events.js',
  './features/dauerlieger.js',
  './features/winter.js',
  './features/platzschilder.js',
  './features/stammgaeste.js',
  './features/tagesziele.js',
  './features/wetterflagge.js',
  './features/hafen-schauen.js',
  './features/einstieg.js',
  './features/aufstieg.js',
  './features/hilfe.js',
  './save/index.js',
  './ui/tagesabschluss.js',
  './ui/gaestebuch.js',
  './ui/logbuch.js',                   // Logbuch und Hafenchronik (P21)
  './ui/oberflaeche.js',
];

async function loadModules(game) {
  const results = await Promise.allSettled(MODULES.map((path) => import(path)));
  results.forEach((r, i) => {
    if (r.status !== 'fulfilled') {
      console.info('Modul noch nicht vorhanden oder fehlerhaft:', MODULES[i], r.reason?.message ?? '');
      return;
    }
    const mod = r.value;
    const init = mod.init ?? mod.default ??
      Object.entries(mod).find(([k, v]) => k.startsWith('init') && typeof v === 'function')?.[1];
    if (typeof init !== 'function') return;
    try { init(game); } catch (err) { console.error('Fehler in', MODULES[i], err); }
  });
  weltAnForm(game);
  removePlaceholders(game);
  game.emit('ready');
}

// Platzhalter verschwinden, sobald die echten Module da sind
function removePlaceholders(game) {
  const ph = game.placeholder;
  if (!ph) return;
  if (game.stege) { ph.group.remove(ph.deck, ph.piles); }
  if (game.landscape) {
    ph.group.remove(ph.bands);
    for (const l of ph.lights) l.removeFromParent();
  }
}

const U = 0.62;   // Meter je Planeinheit aus hafen_von_oben.py

// Kartengrenzen in Metern, x nach Osten, z nach Sueden (Norden ist -z)
const WORLD = {
  minX: -420 * U, maxX: 306 * U, // West bis -420: Grossschiffpier und Marineanleger (Stufe 6)
  minZ: -352 * U, maxZ: 30 * U,
};
WORLD.width = WORLD.maxX - WORLD.minX;
WORLD.centerX = (WORLD.minX + WORLD.maxX) / 2;

// Spielbereich und weiteste Zoomstufe aus der Gelaendekarte (game.gelaende, render/landschaft/formen.js):
// - Blickpunkt bleibt in spielRect() (Hafen, Einfahrt, Leuchttuerme, nahe Inseln).
// - Ganz herausgezoomt sieht man den Kuestentyp: maxWidth so breit wie spielRect, 800 bis 1000 m.
// - rig.rand = aussenRect(): Die Kamera haelt den Blickpunkt so weit vom Rand der Landschaft weg,
//   dass deren Kante nie ins Bild kommt (core/camera.js _clamp).
// WORLD wird an Ort und Stelle geaendert, weil die Kamera es als rig.bounds haelt.
const SICHER = { minX: -340, maxX: 300, minZ: -270, maxZ: 60 };   // Fallback ohne Geländekarte
function weltAnForm(game) {
  const g = game.gelaende;
  const cam = game.camera;
  let r = null;
  try { r = g?.spielRect?.(); } catch (err) { console.warn('Spielbereich nicht lesbar', err); }
  if (!r || !Number.isFinite(r.minX + r.maxX + r.minZ + r.maxZ)) {
    r = { minX: -420 * U, maxX: 306 * U, minZ: -380 * U - 20, maxZ: 30 * U };
    r = { minX: Math.max(SICHER.minX, r.minX), maxX: Math.min(SICHER.maxX, r.maxX), minZ: Math.max(SICHER.minZ, r.minZ), maxZ: Math.min(SICHER.maxZ, r.maxZ) };
  } else {
    try { const rand = g.aussenRect?.(); if (rand && Number.isFinite(rand.minX + rand.maxX)) cam.rand = rand; } catch { /* ohne Rand */ }
    cam.maxWidth = Math.max(800, Math.min(1000, Math.round(r.maxX - r.minX)));
  }
  Object.assign(WORLD, r);
  WORLD.width = WORLD.maxX - WORLD.minX;
  WORLD.centerX = (WORLD.minX + WORLD.maxX) / 2;
}

// Startansicht in zwei Teilen:
// 1. Kern: alle Liegeplaetze der Stufe mit 12 m Rand (Stufe ohne eigene Plaetze nimmt die davor).
// 2. Extras: Wartebojen (8 m Rand, die Boote liegen bis 6 m oestlich im Wind) und sichtbare
//    Bauplaetze (6 m Rand). Sie kommen nacheinander dazu, die naechsten zuerst, solange der
//    Ausschnitt dadurch nicht zu weit herausgezoomt werden muss (siehe startRect).
// Ankerfelder zaehlen nicht: gross, nur Ausweichplatz.
function homeRect(stufe) {
  try {
    let s = stufe;
    let pts = [];
    for (; s >= 1 && !pts.length; s--) pts = plaetzeInStufe(s).map((p) => platzInWelt(p, s));
    if (!pts.length) throw new Error('keine Plaetze');
    // Ab 20 Plaetzen bleiben die aeussersten 10 % je Richtung draussen (z. B. die Grossschiffpier
    // weit im Westen), sonst waere der Hafen am Handy hochkant nur ein schmaler Streifen.
    const schnitt = (werte) => {
      const v = [...werte].sort((a, b) => a - b);
      const k = v.length >= 20 ? Math.floor(v.length * 0.1) : 0;
      return [v[k], v[v.length - 1 - k]];
    };
    const [x0, x1] = schnitt(pts.map((p) => p.x));
    const [z0, z1] = schnitt(pts.map((p) => p.z));
    return { minX: x0 - 12, maxX: x1 + 12, minZ: z0 - 12, maxZ: z1 + 10 };
  } catch (err) {
    console.warn('Startansicht aus harbor.js nicht ableitbar, nehme festen Wert', err);
    return { minX: -76, maxX: -44, minZ: -45, maxZ: 6 };
  }
}

const bauplatzMass = new Map();

function extras(game, stufe) {
  const liste = [];
  try {
    for (const b of warteplaetze(stufe).bojen) {
      liste.push({ minX: b.x - 8, maxX: b.x + 8, minZ: b.z - 8, maxZ: b.z + 8 });
    }
  } catch (err) { console.warn('Wartebojen nicht lesbar', err); }
  // Bauplaetze pulsieren: jede Flaeche wird einmal gemessen und auf ganze Meter gerundet gemerkt,
  // damit reset() immer genau denselben Ausschnitt liefert.
  const teil = new game.THREE.Box3();
  game.scene.traverseVisible((o) => {
    const pick = o.userData?.pick;
    if (pick?.type !== 'buildsite') return;
    const key = `${pick.id}|${o.uuid}`;
    let e = bauplatzMass.get(key);
    if (!e) {
      teil.setFromObject(o);
      if (teil.isEmpty()) return;
      e = { minX: Math.floor(teil.min.x) - 6, maxX: Math.ceil(teil.max.x) + 6,
            minZ: Math.floor(teil.min.z) - 6, maxZ: Math.ceil(teil.max.z) + 6 };
      bauplatzMass.set(key, e);
    }
    liste.push(e);
  });
  // Landmarken der Gelaendeform (Leuchttuerme, Inseln im See): nur, wenn sie nah genug liegen,
  // dass der Hafen trotzdem gross bleibt (gleiche Grenze wie Bojen und Bauplaetze).
  try {
    const form = game.gelaende?.aktuell?.();
    for (const [x, y] of form?.leuchttuerme || []) {
      liste.push({ minX: x * U - 10, maxX: x * U + 10, minZ: -y * U - 10, maxZ: -y * U + 10 });
    }
    for (const i of form?.seeInseln || []) {
      liste.push({ minX: (i.x - i.rx) * U, maxX: (i.x + i.rx) * U, minZ: -(i.y + i.ry) * U, maxZ: -(i.y - i.ry) * U });
    }
  } catch (err) { console.warn('Geländeform nicht lesbar', err); }
  return liste;
}

// Schilderspalte links (Wetter, Tagesziele, Ausbau, Zeit): Im Querformat deckt sie einen Streifen
// ueber die ganze Hoehe ab und zaehlt wie eine Leiste. Im Hochformat liegen die Schilder ueber dem
// Land oben, dort zaehlen sie nicht (sonst wird der Hafen zu schmal).
function linkeSpalte(cam) {
  if (cam.screenW <= cam.screenH) return 0;
  const ins = cam.insets || { top: 0, bottom: 0 };
  const canvas = document.getElementById('stage');
  const c = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
  let rechts = 0;
  for (const id of ['hm-seite', 'hm-zeit']) {
    const el = document.getElementById(id);
    if (!el || el.hidden) continue;
    for (const k of (el.children.length ? [el, ...el.children] : [el])) {
      const r = k.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      if (r.left - c.left > cam.screenW * 0.4) continue;
      // nur, was im freien Band zwischen den Leisten liegt
      if (r.bottom - c.top <= ins.top || r.top - c.top >= cam.screenH - ins.bottom) continue;
      rechts = Math.max(rechts, r.right - c.left);
    }
  }
  return Math.min(rechts + 8, cam.screenW * 0.3);
}

const vereinige = (a, b) => ({
  minX: Math.min(a.minX, b.minX), maxX: Math.max(a.maxX, b.maxX),
  minZ: Math.min(a.minZ, b.minZ), maxZ: Math.max(a.maxZ, b.maxZ),
});

// Noetige Bildbreite in Metern, damit das Rechteck in den freien Bereich passt
// (Schraegsicht 50 Grad: Tiefe erscheint um sin 50 verkuerzt).
function breiteFuer(r, cam) {
  const ins = cam.insets || { top: 0, bottom: 0 };
  const w = Math.max(1, cam.screenW - (cam.insetRight || 0) - (cam.insetLeft || 0));
  const h = Math.max(1, cam.screenH - ins.top - ins.bottom);
  return Math.max(r.maxX - r.minX, (r.maxZ - r.minZ) * Math.sin(50 * Math.PI / 180) * (w / h));
}

// Der Hafen soll gross im Bild sein: Extras kommen nur dazu, solange die Breite hoechstens
// 1,5-mal so gross wird wie fuer die Liegeplaetze allein (mindestens 50 m).
function raender(cam) {
  try { if (cam.insetsFn) { const [top, bottom] = cam.insetsFn(); cam.insets = { top, bottom }; } } catch (err) { /* alte Werte */ }
  try { cam.insetLeft = linkeSpalte(cam); } catch (err) { cam.insetLeft = 0; }
}

function startRect(game, stufe) {
  const cam = game.camera;
  raender(cam);
  let r = homeRect(stufe);
  const grenze = Math.max(breiteFuer(r, cam) * 1.5, 50);
  const mx = (r.minX + r.maxX) / 2;
  const mz = (r.minZ + r.maxZ) / 2;
  const abstand = (e) => Math.hypot((e.minX + e.maxX) / 2 - mx, (e.minZ + e.maxZ) / 2 - mz);
  for (const e of extras(game, stufe).sort((a, b) => abstand(a) - abstand(b))) {
    const neu = vereinige(r, e);
    if (breiteFuer(neu, cam) <= grenze) r = neu;
  }
  // Ufer links und rechts der Stege (game.gelaende.startRect, Gelaende-Thread): zeigt, an welcher
  // Kueste der Hafen liegt. Gekappt auf das 1,6-fache des Hafens, damit er am Handy gross bleibt.
  try {
    const u = game.gelaende?.startRect?.(stufe);
    if (u && Number.isFinite(u.minX + u.maxX + u.minZ + u.maxZ)) {
      const w = r.maxX - r.minX;
      const cx = (r.minX + r.maxX) / 2;
      r = vereinige(r, {
        minX: Math.max(u.minX, cx - 0.8 * w), maxX: Math.min(u.maxX, cx + 0.8 * w),
        // nur zur Seite: nach Sueden kaemen Baeume dicht vor die Kamera, nach Norden nur Wasser
        minZ: r.minZ, maxZ: r.maxZ,
      });
    }
  } catch (err) { console.warn('Ufer für die Startansicht nicht lesbar', err); }
  return polstern(cam, r);
}

// Bleibt Tiefe uebrig (Hochformat), legt die Kamera das Suedufer an den unteren Rand und zeigt
// oben viel leeres Wasser; mittig zeigt es unten viel Land. Der Ueberschuss kommt deshalb zu
// 70 % nach Norden (Wasser, Einfahrt, ankommende Boote) und zu 30 % nach Sueden (Ufer).
function polstern(cam, r) {
  const ins = cam.insets || { top: 0, bottom: 0 };
  const w = Math.max(1, cam.screenW - (cam.insetRight || 0) - (cam.insetLeft || 0));
  const h = Math.max(1, cam.screenH - ins.top - ins.bottom);
  const sichtbar = breiteFuer(r, cam) / Math.sin(50 * Math.PI / 180) * (h / w);
  const rest = sichtbar - (r.maxZ - r.minZ);
  return rest > 0 ? { ...r, minZ: r.minZ - rest * 0.7, maxZ: r.maxZ + rest * 0.3 } : r;
}

// Ueberblick beim Laden: Die Kamera zeigt zuerst die ganze Gelaendeform
// (game.gelaende.blickRect(): Hafen, Einfahrt, Landmarken) und faehrt dann weich auf die
// Startansicht. Tippen, Ziehen, Mausrad oder eine Taste beenden den Flug sofort: Nach kurzem
// Tippen springt die Kamera auf die Startansicht, sonst bleibt sie, wo der Spieler sie hinzieht.
// Waehrend des Flugs traegt body die Klasse hm-ueberblick, am Ende meldet game 'ueberblick:ende' { abgebrochen }.
// Nicht in Tests (navigator.webdriver) und nicht in der Pixel-Fassung, ausser mit ?ueberblick=1;
// ?ueberblick=0 schaltet ihn ab. Der Knopf "Uebersicht" fliegt nie.
// Fuer Tests: ?ueberblickhalten=30 haelt den Ueberblick 30 s, bevor der Flug beginnt.
const UEBERBLICK = { halten: 2.5, flug: 1.5 };   // Sekunden

// Hat der Spieler die Kamera seit der letzten Startansicht selbst bewegt? Solange nicht, folgt die
// Startansicht der Stufe, die erst nach dem Laden feststeht (Spielstand, Testmodus ?stufe=n).
let kameraFrei = true;
const imFenster = (ev) => !!ev?.target?.closest?.('.hm-save-backdrop, [aria-modal="true"]');

function ueberblick(game) {
  const cam = game.camera;
  const wahl = new URLSearchParams(location.search).get('ueberblick');
  if (wahl === '0') return;
  if (wahl !== '1' && (navigator.webdriver || /\/pixel\//.test(location.pathname))) return;
  const halten = Number(new URLSearchParams(location.search).get('ueberblickhalten'));
  if (Number.isFinite(halten) && halten > 0 && halten <= 120) UEBERBLICK.halten = halten;
  let blick = null;
  // Hochkant zeigt ein 420 m breiter Rahmen nur einen duennen Streifen: dann nur Einfahrt, Molen
  // und die naechsten Landmarken, hoechstens 200 m breit (Absprache Gelaende-Thread)
  const hoch = cam.screenH > cam.screenW;
  try { blick = game.gelaende?.blickRect?.(hoch ? { maxBreiteM: 200 } : undefined); } catch (err) { console.warn('Blick auf die Gelaendeform nicht lesbar', err); }
  if (!blick || !Number.isFinite(blick.minX + blick.maxX + blick.minZ + blick.maxZ)) return;

  // Beide Enden mit derselben Einpassung wie die Startansicht (Leisten, Schilderspalte, Schraegsicht)
  const lage = () => ({ x: cam.target.x, z: cam.target.z, w: cam.viewWidth });
  cam.reset();
  let ende = lage();   // vorlaeufig; die Stufe eines geladenen Spiels steht evtl. erst spaeter fest
  const home = cam.home;
  cam.setHomeRect(() => { raender(cam); return polstern(cam, { ...blick }); });
  cam.reset();
  const start = lage();
  cam.home = home;
  if (Math.abs(start.w - ende.w) < 1 && Math.hypot(start.x - ende.x, start.z - ende.z) < 1) { cam.reset(); return; }
  // Ein Startfenster ("Willkommen zurueck", Speicherplaetze) verdeckt das Bild: so lange halten,
  // der Flug beginnt erst, wenn es zu ist. Klicks und Tasten darin brechen nichts ab.
  const fenster = () => [...document.querySelectorAll('.hm-save-backdrop, [aria-modal="true"]')]
    .some((el) => !el.hidden && el.getClientRects().length > 0);   // versteckte Dialoge (Aufstieg) zaehlen nicht

  // _apply sofort, damit kein Bild mit altem Ausschnitt entsteht (mit PR 137 macht update() das ohnehin)
  const setze = (x, z, w) => { cam.target.x = x; cam.target.z = z; cam.viewWidth = w; cam._apply?.(); };
  setze(start.x, start.z, start.w);
  document.body.classList.add('hm-ueberblick');
  let t0 = performance.now();
  let laeuft = true;
  let fliegt = false;
  const ereignisse = ['pointerdown', 'wheel', 'keydown'];
  let tipp = null;
  const ab = (ev) => {
    if (fenster()) return;
    if (ev?.type === 'pointerdown') tipp = { x: ev.clientX, y: ev.clientY, t: performance.now() };
    fertig(true);
  };
  // Kurzes Tippen ohne Ziehen heisst "weiter": dann gleich auf die Startansicht. Wer zieht,
  // zoomt oder dreht, behaelt seinen Ausschnitt.
  const los = (ev) => {
    window.removeEventListener('pointerup', los, true);
    if (tipp && performance.now() - tipp.t < 300 && Math.hypot(ev.clientX - tipp.x, ev.clientY - tipp.y) < 10) { cam.reset(); kameraFrei = true; }
  };
  window.addEventListener('pointerup', los, true);
  const groesse = () => { if (laeuft) { fertig(true); cam.reset(); } };
  ereignisse.forEach((e) => window.addEventListener(e, ab, { capture: true, passive: true }));
  window.addEventListener('resize', groesse);
  const aus = game.on('kamera:ausrichten', ab);   // Neigen oder Drehen per Knopf (Kamera-Thread)

  function fertig(abgebrochen) {
    if (!laeuft) return;
    laeuft = false;
    ereignisse.forEach((e) => window.removeEventListener(e, ab, { capture: true }));
    window.removeEventListener('resize', groesse);
    aus();
    if (!abgebrochen) window.removeEventListener('pointerup', los, true);
    document.body.classList.remove('hm-ueberblick');
    game.emit('ueberblick:ende', { abgebrochen });
  }

  function schritt(jetzt) {
    if (!laeuft) return;
    if (fenster()) { t0 = jetzt; requestAnimationFrame(schritt); return; }
    if (!fliegt && (jetzt - t0) / 1000 >= UEBERBLICK.halten) {
      // Ziel erst jetzt festlegen: Stufe und Plaetze des geladenen Spiels stehen fest
      fliegt = true;
      cam.reset();
      ende = lage();
    }
    const s = Math.min(1, Math.max(0, ((jetzt - t0) / 1000 - UEBERBLICK.halten) / UEBERBLICK.flug));
    const e = s * s * (3 - 2 * s);   // weich an- und auslaufen
    // Breite geometrisch, damit das Hineinzoomen gleichmaessig wirkt
    setze(start.x + (ende.x - start.x) * e, start.z + (ende.z - start.z) * e, start.w * Math.pow(ende.w / start.w, e));
    if (s >= 1) { cam.reset(); fertig(false); return; }
    requestAnimationFrame(schritt);
  }
  requestAnimationFrame(schritt);
}

function boot() {
  const canvas = document.getElementById('stage');
  const game = createGame({
    canvas,
    bounds: WORLD,
    // Startansicht: Stufe 1, Steg A am Suedufer des Sees
    // Liegeplaetze der Stufe 1 aus harbor.js plus Rand, dazu die Wartebojen davor
    home: { rect: homeRect(1) },
  });
  window.hafenmeister = game;   // zum Ausprobieren in der Browser-Konsole

  game.placeholder = addPlaceholderWorld(game, WORLD);
  initInput(game);

  // Knopf "Übersicht" zeigt den ganzen Hafen der aktuellen Stufe samt Bojen und Bauplaetzen
  let stufe = 1;
  game.on('stufe', (n) => { const v = Number(typeof n === 'object' ? n?.stufe : n); if (v >= 1) stufe = v; });
  // Die Stufe der Spielregeln gilt vor dem Ereignis (geladener Spielstand, Testmodus)
  const aktuelleStufe = () => { const v = Number(game.sim?.state?.stage); return v >= 1 ? v : stufe; };
  game.camera.setHomeRect(() => startRect(game, aktuelleStufe()));
  for (const e of ['pointerdown', 'wheel', 'keydown']) {
    window.addEventListener(e, (ev) => { if (!imFenster(ev)) kameraFrei = false; }, { capture: true, passive: true });
  }
  let zuletzt = null;
  game.on('stufe', () => {
    const v = aktuelleStufe();
    if (v === zuletzt) return;
    zuletzt = v;
    if (kameraFrei && !document.body.classList.contains('hm-ueberblick')) game.camera.reset();
  });

  document.getElementById('btn-overview').addEventListener('click', () => { game.camera.reset(); kameraFrei = true; });
  const pauseBtn = document.getElementById('btn-pause');
  pauseBtn.addEventListener('click', () => game.setPaused(!game.paused));
  // Beschriftung nur für Bildschirmleser und Maus-Hinweis: das Symbol zeichnet ui/oberflaeche.js
  game.on('pause', (p) => { pauseBtn.setAttribute('aria-label', p ? 'Weiter' : 'Pause'); pauseBtn.title = p ? 'Weiter (Leertaste)' : 'Pause (Leertaste)'; });

  game.on('tap', ({ world }) => {
    if (world) console.debug('Tipp bei', world.x.toFixed(1), world.z.toFixed(1));
  });

  return game;
}

try {
  const game = boot();
  // Pixelschrift vor den Modulen laden: sie zeichnen Zahlen auch in Canvas (Münzen, Beträge), die
  // sonst einmal in der Systemschrift entstehen und so bleiben. Höchstens 2,5 s warten (offline, alter Browser).
  await Promise.race([
    Promise.all(['400', '600', '700'].map((w) => document.fonts?.load?.(`${w} 16px "Pixelify Sans"`, 'Tag 0123456789 €'))),
    new Promise((r) => setTimeout(r, 2500)),
  ]).catch(() => {});
  await loadModules(game);
  // Erst jetzt stehen Stege, Bauplaetze und die geladene Stufe fest
  game.camera.reset();
  document.getElementById('boot').classList.add('done');
  try { ueberblick(game); } catch (err) { console.warn('Ueberblick beim Start fehlgeschlagen', err); game.camera.reset(); }
} catch (err) {
  const el = document.getElementById('boot');
  el.classList.add('error');
  el.textContent = 'Das Spiel konnte nicht starten. Dein Browser unterstützt vermutlich kein WebGL.';
  console.error(err);
}
