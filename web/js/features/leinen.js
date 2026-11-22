// Leinen annehmen (Paket P48, Roadmap F32, docs/leinen.md).
//
// Fährt ein Gast an seinen Platz am Steg oder Kai, steht dort, wo er festmacht, ein kleines
// Leinen-Symbol (aufgeschossenes Tau). Wer es antippt, nimmt die Leinen an: Ein Festmacher steht am
// Steg, die Crew wirft ihm die erste Leine zu, er fängt sie mit einem kleinen Hüpfer, und jede Leine,
// die fest wird, klingt einen Ton höher. Ist das Boot fest, klingt ein Akkord, die Crew gibt
// Trinkgeld (ECONOMY.leinen.trinkgeld je Klasse), der Betrag steigt über dem Festmacher auf.
// Ohne Hilfe springt nach einem kurzen Moment (warteSek, nur bis Tempo 3x) jemand von der Crew selbst
// an Land, wie bisher. Kein Abzug, kein Druck: das Symbol ist ein Angebot.
//
// Nicht an Bojen, im Ankerfeld, im Bojenfeld und im Päckchen (dort nimmt die Crew des inneren Boots
// die Leinen). Nur für Gäste der Spielregeln (game.sim.state.boats), nur wenn der Platz im Bild ist,
// höchstens ECONOMY.leinen.gleichzeitig Symbole zugleich, keine neuen beim Vorspulen mit 8x, nicht
// während des Einstiegs, nicht beim Bauen, im Fotomodus, in der Übersicht und während einer Schleppleine.
//
// Bucht über game.sim.addIncome(betrag, 'liegegeld', 'leinen') (Tagesabschluss: eigene Zeile).
// Meldet 'leinen:angeboten' { boot, platz }, 'leinen:angenommen' { boot, platz } und
// 'leinen:trinkgeld' { boot, platz, betrag, groesse } (wenn das Boot fest ist).
// Schnittstelle (auch für Tests): game.leinen = { angebote(), annehmen(bootId), get angenommen }.
// Zum Ausprobieren: ein Boot an einen Steg ziehen und das Tau-Symbol am Steg antippen.
import { ECONOMY } from '../data/economy.js';
import { FARBE } from '../ui/pixel-symbole.js';

// Aufgeschossenes Tau mit losem Ende, 12 x 12, Farben aus pixel-symbole.js (k Tinte, L/H Holz)
export const LEINE_RASTER = [
  '....kkkk....',
  '..kkLLLLkk..',
  '.kLLHHHHLLk.',
  '.kLHkkkkHLk.',
  'kLHk....kHLk',
  'kLHk....kHLk',
  'kLHk....kHLk',
  'kLHk....kHLk',
  '.kLHkkkkHLk.',
  '.kLLHHHHLLkk',
  '..kkLLLLkLLk',
  '....kkkk.kkk',
];

/** Trinkgeld fürs Leinenannehmen (ganze Euro) für eine Bootsklasse. */
export function leinenTrinkgeld(groesse, eco = ECONOMY.leinen) {
  const v = Number(eco?.trinkgeld?.[groesse]);
  return Number.isFinite(v) && v > 0 ? Math.round(v) : 0;
}

/** Kann an diesem Liegeplatz jemand die Leinen annehmen? (Steg, Box, Kai, Pier; keine Boje, kein Päckchen) */
export function leinenPlatz(berth) {
  if (!berth || berth.id == null) return false;
  const id = String(berth.id);
  if (berth.kind === 'buoy' || berth.kind === 'paeckchen' || berth.paeckchen) return false;
  if (/^(boje-|anker-|BF\d)/.test(id)) return false;
  return true;
}

/** Gehört das animierte Boot zu einem Gast, der gerade an genau diesen Platz fährt? */
export function gastFuerPlatz(simBoot, berthId) {
  if (!simBoot || simBoot.berthId == null || berthId == null) return false;
  return String(simBoot.berthId).startsWith(String(berthId));
}

/** Ton der n-ten festen Leine (1, 2, ...): steigt auf der Pentatonik (Münzklang mit combo). */
export const leinenTon = (n) => Math.max(1, Math.min(10, Math.round(n) || 1));

const svgUrl = (raster) => {
  let r = '';
  raster.forEach((zeile, y) => [...zeile].forEach((c, x) => {
    if (c === '.' || c === ' ') return;
    r += `<rect x='${x}' y='${y}' width='1.02' height='1.02' fill='${FARBE[c] ?? '#000'}'/>`;
  }));
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${raster[0].length} ${raster.length}' shape-rendering='crispEdges'>${r}</svg>`)}")`;
};

const CSS = `
#hm-leinen-ebene { position: absolute; inset: 0; pointer-events: none; z-index: 7; overflow: hidden; }
body.foto #hm-leinen-ebene, body.building #hm-leinen-ebene, body.hm-ueberblick #hm-leinen-ebene, body.hm-leine #hm-leinen-ebene { display: none !important; }
.hm-festmacher { position: absolute; left: 0; top: 0; width: 44px; height: 44px; margin: -22px 0 0 -22px; padding: 0; border: 0;
  background: none; pointer-events: auto; cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent;
  font-family: 'Pixelify Sans', monospace; opacity: 0; transition: opacity .18s; }
.hm-festmacher.da { opacity: 1; }
.hm-festmacher[hidden] { display: none; }
.hm-festmacher .hm-fm-knopf { position: absolute; inset: 6px; background: #f4efe2 var(--px-leine) center / 75% 75% no-repeat;
  box-shadow: 0 0 0 2px #24364a, 2px 3px 0 2px rgba(20,32,48,.3); image-rendering: pixelated;
  animation: hm-fm-wippen 1.1s steps(4, jump-none) infinite; }
.hm-festmacher .hm-fm-puls { position: absolute; inset: 2px; box-shadow: 0 0 0 2px #f2c14e; opacity: 0;
  animation: hm-fm-puls 1.1s steps(5, jump-none) infinite; pointer-events: none; }
.hm-festmacher .hm-fm-text { position: absolute; left: 50%; top: 44px; transform: translateX(-50%); white-space: nowrap;
  padding: 1px 5px 2px; font-size: 12px; line-height: 14px; color: #24364a; background: #f4efe2; box-shadow: 0 0 0 2px #24364a; }
.hm-festmacher .hm-fm-text:empty { display: none; }
.hm-festmacher:hover .hm-fm-knopf, .hm-festmacher:focus-visible .hm-fm-knopf { background-color: #fde49a; }
.hm-festmacher:focus-visible { outline: 3px dashed #f2c14e; outline-offset: 2px; }
@keyframes hm-fm-wippen { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
@keyframes hm-fm-puls { 0% { opacity: .9; transform: scale(.8); } 100% { opacity: 0; transform: scale(1.35); } }
.hm-fm-betrag { position: absolute; left: 0; top: 0; pointer-events: none; white-space: nowrap; transform: translate(-50%, -50%);
  font: 14px/16px 'Pixelify Sans', monospace; color: #24364a; background: #fde49a; padding: 1px 5px 2px 21px;
  box-shadow: 0 0 0 2px #24364a, 2px 3px 0 2px rgba(20,32,48,.3);
  background-image: var(--px-muenze); background-repeat: no-repeat; background-position: 3px 50%; background-size: 14px 14px;
  image-rendering: pixelated; animation: hm-fm-steigen 1.6s steps(16, jump-none) forwards; }
@keyframes hm-fm-steigen { 0% { opacity: 0; margin-top: 4px; } 12% { opacity: 1; margin-top: 0; } 75% { opacity: 1; margin-top: -26px; } 100% { opacity: 0; margin-top: -34px; } }
@media (prefers-reduced-motion: reduce) { .hm-festmacher .hm-fm-knopf, .hm-festmacher .hm-fm-puls { animation: none; } }
body.hm-ruhig .hm-festmacher .hm-fm-knopf, body.hm-ruhig .hm-festmacher .hm-fm-puls { animation: none; }
`;

const MUENZE = ['...oooooo...', '..ohhhhhhoo.', '.ohhggggggdo', '.ohggoooggdo', 'ohggoggggggo', 'ohgoooooggdo', 'ohggoggggggo', 'ohgoooooggdo', '.ohggoooggdo', '.oggggggggdo', '..oddddddoo.', '...oooooo...'];
const HINWEIS_KEY = 'hafenmeister:leinen-hinweis';
const HINWEIS_MAL = 3;           // so oft angenommen, dann steht nur noch das Symbol da
const ZWISCHEN_MS = 250;         // so oft nach neuen Booten und Verdeckung sehen (echte Zeit)

const klemme = (v, a, b) => Math.min(b, Math.max(a, v));
const speicher = {
  lesen() { try { return Number(localStorage.getItem(HINWEIS_KEY)) || 0; } catch { return HINWEIS_MAL; } },
  schreiben(n) { try { localStorage.setItem(HINWEIS_KEY, String(n)); } catch { /* ohne Speicher weiter */ } },
};

export function init(game) {
  if (typeof document === 'undefined' || !game?.THREE || !game.scene) return;
  const { THREE } = game;
  const eco = () => ECONOMY.leinen ?? {};
  const root = document.getElementById('game') || document.body;
  const sfx = (name, opts) => { try { game.audio?.sfx?.(name, opts); } catch { /* ohne Ton weiter */ } };
  const haptic = (ms) => { try { navigator.vibrate?.(ms); } catch { /* egal */ } };

  const style = document.createElement('style');
  style.id = 'hm-leinen-stil';
  style.textContent = CSS + `\n:root { --px-leine: ${svgUrl(LEINE_RASTER)}; --px-muenze: ${svgUrl(MUENZE)}; }`;
  document.head.append(style);
  const ebene = document.createElement('div');
  ebene.id = 'hm-leinen-ebene';
  root.append(ebene);

  // ---------------------------------------------------------------- Festmacher (3D-Figur)
  // Wie die Menschen im Hafen (render/people.js): Rumpf, Kopf, dazu Mütze. Ölzeug-Gelb, damit man ihn
  // zwischen den Gästen erkennt. Vorne ist lokal +x.
  const geo = {
    koerper: new THREE.CylinderGeometry(0.3, 0.24, 1.4, 7).translate(0, 0.7, 0),
    kopf: new THREE.SphereGeometry(0.25, 8, 6).translate(0, 1.62, 0),
    muetze: new THREE.CylinderGeometry(0.27, 0.27, 0.14, 8).translate(0, 1.82, 0),
    schirm: new THREE.BoxGeometry(0.2, 0.04, 0.3).translate(0.24, 1.78, 0),
  };
  const mat = {
    koerper: new THREE.MeshLambertMaterial({ color: '#f2c14e', flatShading: true }),
    kopf: new THREE.MeshLambertMaterial({ color: '#e8bf98', flatShading: true }),
    muetze: new THREE.MeshLambertMaterial({ color: '#24364a', flatShading: true }),
  };
  function neueFigur() {
    const g = new THREE.Group();
    g.name = 'festmacher';
    const innen = new THREE.Group();     // kippt beim Ziehen, g dreht zum Boot
    innen.add(new THREE.Mesh(geo.koerper, mat.koerper), new THREE.Mesh(geo.kopf, mat.kopf),
      new THREE.Mesh(geo.muetze, mat.muetze), new THREE.Mesh(geo.schirm, mat.muetze));
    g.add(innen);
    g.userData.innen = innen;
    g.scale.setScalar(0.001);
    game.scene.add(g);
    return g;
  }

  // ---------------------------------------------------------------- Zustand
  const angebote = new Map();    // bootId -> Angebot
  const erledigt = new Map();    // bootId -> Platz-id, für den es schon ein Angebot gab (nur einmal je Anfahrt)
  let angenommenZahl = 0;
  let hinweis = speicher.lesen();
  let pruefT = 0;

  const st = () => game.sim?.state ?? null;
  const boote = () => game.boatAnim?.boats ?? [];
  const einstiegLaeuft = () => {
    const s = game.einstieg?.schritt?.();
    return !!s && !String(s).startsWith('hinweis:');
  };
  const verborgen = () => {
    const c = document.body.classList;
    return c.contains('building') || c.contains('foto') || c.contains('hm-ueberblick') || c.contains('hm-leine');
  };

  /** Wo der Festmacher steht: Mitte der ersten beiden Festmacherpunkte, 0,7 m vom Boot weg auf den Steg. */
  function landPunkt(anim, berth) {
    let lines;
    try { lines = anim.linienFuer?.(berth) ?? []; } catch { lines = []; }
    if (!lines.length) return null;
    const a = lines[0].to, b = (lines[1] ?? lines[0]).to;
    const x = (a.x + b.x) / 2, z = (a.z + b.z) / 2, y = Math.max(a.y, b.y);
    let f = null;
    try { f = anim.finalPose?.(berth); } catch { f = null; }
    const cx = f?.x ?? berth.x, cz = f?.z ?? berth.z;
    let dx = x - cx, dz = z - cz;
    const d = Math.hypot(dx, dz) || 1;
    dx /= d; dz /= d;
    return { x: x + dx * 0.7, y, z: z + dz * 0.7, blick: Math.atan2(dz, -dx) };
  }

  function anbieten(anim) {
    const berth = anim.berth;
    const p = landPunkt(anim, berth);
    if (!p) return null;
    const knopf = document.createElement('button');
    knopf.type = 'button';
    knopf.className = 'hm-festmacher';
    const betrag = leinenTrinkgeld(anim.info?.size);
    knopf.title = `Leine annehmen: Trinkgeld ${betrag} €`;
    knopf.setAttribute('aria-label', `Leine annehmen, die Crew gibt ${betrag} Euro Trinkgeld`);
    const puls = document.createElement('i'); puls.className = 'hm-fm-puls';
    const bild = document.createElement('i'); bild.className = 'hm-fm-knopf';
    const text = document.createElement('b'); text.className = 'hm-fm-text';
    if (hinweis < HINWEIS_MAL) text.textContent = 'Leine annehmen';
    knopf.append(puls, bild, text);
    knopf.hidden = true;
    // Der Finger gehört dem Knopf: nichts darunter (Karte verschieben, Boot greifen) fängt an
    for (const ev of ['pointerdown', 'pointerup', 'touchstart', 'mousedown']) knopf.addEventListener(ev, (e) => e.stopPropagation());
    knopf.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); annehmen(anim.id); });
    ebene.append(knopf);
    const a = { anim, id: anim.id, platz: berth.id, groesse: anim.info?.size ?? 'M', betrag, punkt: p, knopf,
      angenommen: false, fest: false, figur: null, t0: 0, leinen: 0, sichtbar: false, verdeckt: false, haltAb: 0, wegAb: 0 };
    angebote.set(anim.id, a);
    erledigt.set(anim.id, berth.id);
    // Vor der ersten Leine wartet die Crew einen Moment, ob jemand annimmt (boat-anim.js LinesTask)
    anim.leinenHalten = () => {
      if (a.angenommen || !a.sichtbar || a.verdeckt || verborgen()) return false;
      if ((game.speed ?? 1) > (eco().warteBisTempo ?? 3)) return false;
      const jetzt = performance.now();
      a.haltAb ||= jetzt;
      return jetzt - a.haltAb < (eco().warteSek ?? 1.2) * 1000;
    };
    game.emit('leinen:angeboten', { boot: anim.id, platz: berth.id });
    return a;
  }

  function annehmen(id) {
    const a = angebote.get(id);
    if (!a || a.angenommen || a.fest) return false;
    a.angenommen = true;
    a.anim.leinenHelfer = true;
    a.t0 = performance.now();
    a.figur = neueFigur();
    a.figur.position.set(a.punkt.x, a.punkt.y, a.punkt.z);
    a.figur.rotation.y = a.punkt.blick;
    a.knopf.classList.remove('da');
    a.knopf.disabled = true;
    setTimeout(() => a.knopf.remove(), 200);
    angenommenZahl++;
    if (hinweis < HINWEIS_MAL) { hinweis++; speicher.schreiben(hinweis); }
    sfx('leine-greifen', { volume: 0.9 });
    haptic(8);
    // Liegt das Boot schon fest (angenommen im letzten Augenblick), gleich abschließen
    if (a.anim.moored) fertig(a);
    game.emit('leinen:angenommen', { boot: id, platz: a.platz });
    return true;
  }

  function entfernen(a, sofort = false) {
    angebote.delete(a.id);
    if (a.anim.leinenHalten) delete a.anim.leinenHalten;
    if (a.anim.leinenHelfer) delete a.anim.leinenHelfer;
    if (a.knopf.isConnected) { a.knopf.classList.remove('da'); setTimeout(() => a.knopf.remove(), sofort ? 0 : 200); }
    if (a.figur) {
      if (sofort) { game.scene.remove(a.figur); a.figur = null; } else { a.wegAb = performance.now(); figurenWeg.add(a); }
    }
  }

  // Boot ist fest: mit Hilfe Akkord und Trinkgeld, ohne Hilfe verschwindet das Symbol still
  function fertig(a) {
    if (a.fest) return;
    a.fest = true;
    if (!a.angenommen) { entfernen(a); return; }
    const n = Math.max(1, a.anim.lines?.length || a.leinen || 1);
    sfx('muenze', { combo: leinenTon(n), volume: 0.5 });
    sfx('strich-ende', { anzahl: n + 2, volume: 0.75, delay: 0.12 });
    haptic(14);
    if (a.betrag > 0) {
      game.sim?.addIncome?.(a.betrag, 'liegegeld', 'leinen');
      betragZeigen(a);
    }
    game.emit('leinen:trinkgeld', { boot: a.id, platz: a.platz, betrag: a.betrag, groesse: a.groesse });
    a.festAb = performance.now();
    a.huepf = performance.now();
    // Der Festmacher bleibt noch kurz stehen, dann geht er (siehe Bild-Schleife)
    angebote.delete(a.id);
    delete a.anim.leinenHalten;
    delete a.anim.leinenHelfer;
    figurenWeg.add(a);
    a.wegAb = performance.now() + 1700;
  }

  const figurenWeg = new Set();    // Festmacher, die nach getaner Arbeit noch stehen und dann gehen

  function betragZeigen(a) {
    const s = aufSchirm(a.punkt.x, a.punkt.y + 2.4, a.punkt.z);
    if (!s) return;
    const el = document.createElement('div');
    el.className = 'hm-fm-betrag';
    el.textContent = `+${a.betrag} € Trinkgeld`;
    el.style.left = `${Math.round(s.x)}px`;
    el.style.top = `${Math.round(s.y)}px`;
    ebene.append(el);
    setTimeout(() => el.remove(), 1700);
  }

  // Jede Leine, die mit Helfer fest wird, klingt einen Ton höher (die erste fängt er mit einem Hüpfer)
  game.on('boat:line', (d) => {
    const a = d?.id != null ? angebote.get(d.id) : null;
    if (!a || !a.angenommen || !d.on) return;
    a.leinen++;
    a.zug = performance.now();
    if (a.leinen === 1) { a.huepf = performance.now(); sfx('leine-greifen', { volume: 0.6 }); }
    else sfx('muenze', { combo: leinenTon(a.leinen - 1), volume: 0.45 });
  });
  game.on('boat:moored', (d) => {
    const a = d?.id != null ? angebote.get(d.id) : null;
    if (a) fertig(a);
  });
  // Neues Spiel, Spielstand geladen: alles weg (Boote werden ohne Anlegen neu gesetzt)
  const aufraeumen = () => {
    for (const a of [...angebote.values()]) entfernen(a, true);
    for (const a of figurenWeg) if (a.figur) game.scene.remove(a.figur);
    figurenWeg.clear();
    erledigt.clear();
  };
  game.on('spielstand-geladen', aufraeumen);
  game.on('sim:change', (d) => { if (d?.reason === 'load' || d?.reason === 'new') aufraeumen(); });

  // ---------------------------------------------------------------- Bildschirm
  const _v = new THREE.Vector3();
  let rc = null, rr = null;
  function aufSchirm(x, y, z) {
    const cam = game.camera?.camera;
    const canvas = game.renderer?.domElement;
    if (!cam || !canvas) return null;
    rc ||= canvas.getBoundingClientRect();
    rr ||= ebene.getBoundingClientRect();
    _v.set(x, y, z).project(cam);
    if (_v.z > 1 || _v.z < -1) return null;
    return { x: rc.left - rr.left + (_v.x + 1) / 2 * rc.width, y: rc.top - rr.top + (1 - _v.y) / 2 * rc.height };
  }
  // Pixel je Meter am Punkt: zu weit weg (Übersicht) zeigt kein Symbol
  function pxProMeter(p) {
    const a = aufSchirm(p.x, p.y, p.z), b = aufSchirm(p.x + 1, p.y, p.z);
    return a && b ? Math.hypot(b.x - a.x, b.y - a.y) : 0;
  }
  function bedienelement(x, y) {
    const r = rr ?? ebene.getBoundingClientRect();
    const e = document.elementFromPoint(r.left + x, r.top + y);
    if (!e || e === document.body || e === document.documentElement || e.id === 'stage' || e === game.renderer?.domElement) return false;
    if (e.closest('#hm-leinen-ebene')) return false;
    // Durchsichtige Ebenen (Wunschsymbole, Zeiger, Auslastung) zählen nicht
    return getComputedStyle(e).pointerEvents !== 'none' && !!e.closest('button, [role="dialog"], .hm-panel, .panel, #hud, nav, header, footer, aside');
  }

  function neueSuchen() {
    const e = eco();
    const s = st();
    // Beim schnellen Vorspulen (8x) kommen keine neuen Symbole: niemand tippt, sie blitzten nur auf
    if (!s || einstiegLaeuft() || verborgen() || (game.speed ?? 1) > (e.warteBisTempo ?? 3)) return;
    const max = e.gleichzeitig ?? 2;
    for (const anim of boote()) {
      if (angebote.size >= max) return;
      if (angebote.has(anim.id) || anim.state !== 'docking' || anim.moored || anim.versteckt) continue;
      const berth = anim.berth;
      if (!leinenPlatz(berth) || erledigt.get(anim.id) === berth.id) continue;
      if (!gastFuerPlatz(s.boats?.[anim.id], berth.id)) continue;
      if (anim.model?.visible === false) continue;
      if (Math.hypot(anim.x - berth.x, anim.z - berth.z) > (e.abstandM ?? 60)) continue;
      if (!game.boatAnim?.imBild?.(berth.x, berth.z, 2)) continue;
      if (leinenTrinkgeld(anim.info?.size) <= 0) continue;
      anbieten(anim);
    }
  }

  game.onTick(() => {
    const jetzt = performance.now();
    rc = null; rr = null;
    const pruefen = jetzt - pruefT > ZWISCHEN_MS;
    if (pruefen) { pruefT = jetzt; neueSuchen(); }
    const alle = new Set(boote());
    for (const a of [...angebote.values()]) {
      const anim = a.anim;
      // Abgebrochen: anderer Platz, Boot fort, legt wieder ab
      if (!alle.has(anim) || anim.berth?.id !== a.platz || (anim.state !== 'docking' && !anim.moored)) { entfernen(a); continue; }
      if (anim.moored) { fertig(a); continue; }
      if (a.angenommen) { figurBewegen(a, jetzt); continue; }
      // Symbol über dem Platz am Steg
      const s = aufSchirm(a.punkt.x, a.punkt.y + 1.3, a.punkt.z);
      const gross = pxProMeter(a.punkt) >= 2;
      const drin = !!s && s.x > 8 && s.y > 8 && s.x < (rr?.width ?? 0) - 8 && s.y < (rr?.height ?? 0) - 8;
      if (pruefen) a.verdeckt = drin && (bedienelement(s.x, s.y) || bedienelement(s.x, s.y - 18) || bedienelement(s.x, s.y + 18));
      const zeigen = drin && gross && !a.verdeckt && !verborgen();
      a.sichtbar = zeigen;
      if (zeigen) {
        a.knopf.style.transform = `translate(${Math.round(s.x)}px, ${Math.round(s.y)}px)`;
        if (a.knopf.hidden) { a.knopf.hidden = false; requestAnimationFrame(() => a.knopf.classList.add('da')); }
      } else if (!a.knopf.hidden) { a.knopf.hidden = true; a.knopf.classList.remove('da'); }
    }
    for (const a of [...figurenWeg]) {
      if (!a.figur) { figurenWeg.delete(a); continue; }
      figurBewegen(a, jetzt);
    }
  });

  // Festmacher: taucht mit kleinem Federn auf, hüpft beim Fangen, lehnt sich bei jeder Leine zurück,
  // hüpft am Ende noch einmal und schrumpft dann weg. Alles in echter Zeit (auch bei 8x sichtbar).
  function figurBewegen(a, jetzt) {
    const g = a.figur;
    if (!g) return;
    const innen = g.userData.innen;
    const t = (jetzt - a.t0) / 1000;
    let s = t < 0.28 ? 1 + Math.sin(klemme(t / 0.28, 0, 1) * Math.PI) * 0.18 : 1;
    s *= klemme(t / 0.12, 0.05, 1);
    let y = 0;
    if (a.huepf) {
      const h = (jetzt - a.huepf) / 1000;
      if (h < 0.32) y = Math.sin((h / 0.32) * Math.PI) * 0.35;
    }
    let kipp = 0;
    if (a.zug) {
      const z = (jetzt - a.zug) / 1000;
      // erst vor zum Boot (Leine greifen), dann zurück (Leine dichtholen)
      if (z < 0.12) kipp = -0.25 * (z / 0.12);
      else if (z < 0.42) kipp = -0.25 + 0.45 * ((z - 0.12) / 0.3);
      else if (z < 0.7) kipp = 0.2 * (1 - (z - 0.42) / 0.28);
    }
    if (a.wegAb && jetzt > a.wegAb) {
      const w = (jetzt - a.wegAb) / 300;
      s *= klemme(1 - w, 0, 1);
      if (w >= 1) {
        game.scene.remove(g);
        a.figur = null;
        figurenWeg.delete(a);
        return;
      }
    }
    g.scale.setScalar(Math.max(0.001, s));
    g.position.y = a.punkt.y + y;
    // vorne ist +x: Kippen um z, negativ = zum Boot hin
    innen.rotation.z = kipp;
  }

  game.leinen = {
    /** Offene Angebote: [{ boot, platz, angenommen, sichtbar, betrag }] */
    angebote: () => [...angebote.values()].map((a) => ({ boot: a.id, platz: a.platz, angenommen: a.angenommen, sichtbar: a.sichtbar, verdeckt: a.verdeckt, betrag: a.betrag, groesse: a.groesse })),
    annehmen,
    get angenommen() { return angenommenZahl; },
  };
}
