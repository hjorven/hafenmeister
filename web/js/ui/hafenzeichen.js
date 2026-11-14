// Versteckte Regeln sichtbar machen (Paket P55, docs/hafenzeichen.md).
//
// 1. Geduldsring (Roadmap A4): Jedes wartende Boot trägt über sich einen kleinen Pixel-Ring, der mit
//    seiner Geduld abläuft (game.sim.geduld). Grün, im mittleren Drittel gelb, im letzten Drittel rot
//    und blinkend; beim Wechsel ins letzte Drittel tutet das Boot einmal kurz. Abends und vor dem
//    Morgen nach einer Nacht an der Boje läuft keine Geduld ab: Der Ring steht dann grau-blau.
//    Gezeichnet wird der Ring in der Reihe der Wunschsymbole (ui/vorschau.js, ganz links), die
//    Bilder kommen von hier (ringZustand, ringBild).
// 2. Auslastung der Versorgung (B1, C7): Über WC, Dusche, Kiosk/Restaurant und Tankstelle steht ein
//    Schild "14/20" (heute versorgte Boote von höchstens so vielen). Wird es knapp, wird das Schild
//    orange und blinkt; ist die Versorgung für heute voll, wird es rot. Neu an jedem Morgen.
// 3. Zeiger am Bildrand (Bed P3, Bed P10): Wartet ein Boot außerhalb des Bildes, zeigt ein Pfeil am
//    Rand dorthin, mit seinem Geduldsring. Nahe beieinander liegende Zeiger werden einer mit Zahl.
//    Antippen fährt die Kamera zum Boot, das am wenigsten Geduld hat. Zeiger meiden Knöpfe und Tafeln.
//
// Liest nur (game.sim, game.boatView, game.buildings, game.camera), schreibt nichts in den Spielstand.
// Meldet 'hafenzeichen:voll' { key } beim ersten Vollwerden einer Versorgung am Tag (Hinweis beim
// ersten Mal über den Einstieg und die Meldungs-Ordnung) und 'horn' für das kurze Tuten.
// Schnittstelle: game.hafenzeichen = { zeiger(), schilder(), aktualisieren() }.
import { SCHILD_VOLL_BIS, SCHILD_KLEIN_BIS, wunschName } from './vorschau.js';
import { VORRANG } from './meldungen.js';
import { ringZustand, ringBild } from './geduldsring.js';

// ------------------------------------------------------------------ Reine Regeln (auch für Node-Tests)

/**
 * Auslastung einer Versorgung: 'frei' | 'knapp' | 'voll'.
 * Knapp, wenn höchstens ein Fünftel (mindestens ein Platz) übrig ist.
 */
export function auslastungStufe(versorgt, kapazitaet) {
  if (!(kapazitaet > 0)) return 'frei';
  const rest = kapazitaet - versorgt;
  if (rest <= 0) return 'voll';
  if (rest <= Math.max(1, Math.ceil(kapazitaet * 0.2))) return 'knapp';
  return 'frei';
}

/** Kurzer Text für das Schild und den Titel. */
export function auslastungText(key, versorgt, kapazitaet) {
  const n = Math.min(versorgt, kapazitaet);
  const name = key === 'essen' ? 'Essen' : wunschName(key);
  const stufe = auslastungStufe(versorgt, kapazitaet);
  const satz = stufe === 'voll' ? 'für heute voll, weitere Gäste bekommen das nicht mehr'
    : stufe === 'knapp' ? 'fast voll' : 'noch Platz';
  return { kurz: `${n}/${kapazitaet}`, titel: `${name}: heute ${n} von ${kapazitaet} Booten versorgt, ${satz}. Morgen zählt es neu.` };
}

/**
 * Punkt am Rand eines Rechtecks in Richtung eines Bildpunkts (vom Mittelpunkt aus).
 * p = { x, y } in Pixeln (darf außerhalb liegen), r = { l, t, r, b }.
 * -> { x, y, winkel (Grad, 0 = rechts, im Uhrzeigersinn), s (Weg entlang des Rands ab links oben) }
 */
export function randPunkt(p, r) {
  const cx = (r.l + r.r) / 2, cy = (r.t + r.b) / 2;
  let dx = p.x - cx, dy = p.y - cy;
  if (!dx && !dy) dy = -1;
  const hw = (r.r - r.l) / 2, hh = (r.b - r.t) / 2;
  const f = Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity);
  const x = cx + dx * f, y = cy + dy * f;
  return { x, y, winkel: (Math.atan2(dy, dx) * 180) / Math.PI, s: randWeg(x, y, r) };
}

/** Weg entlang des Rands (im Uhrzeigersinn ab links oben) für einen Randpunkt. */
export function randWeg(x, y, r) {
  const w = r.r - r.l, h = r.b - r.t;
  const e = 0.5;
  if (Math.abs(y - r.t) < e) return x - r.l;
  if (Math.abs(x - r.r) < e) return w + (y - r.t);
  if (Math.abs(y - r.b) < e) return w + h + (r.r - x);
  return 2 * w + h + (r.b - y);
}

/** Randpunkt aus dem Weg s (Gegenstück zu randWeg). */
export function punktAmRand(s, r) {
  const w = r.r - r.l, h = r.b - r.t, U = 2 * (w + h);
  s = ((s % U) + U) % U;
  if (s <= w) return { x: r.l + s, y: r.t };
  if (s <= w + h) return { x: r.r, y: r.t + (s - w) };
  if (s <= 2 * w + h) return { x: r.r - (s - w - h), y: r.b };
  return { x: r.l, y: r.b - (s - 2 * w - h) };
}

/**
 * Zeiger, die am Rand nah beieinander stehen, zu einem zusammenfassen.
 * liste: [{ s, ... }] -> [[...], ...] Gruppen, sortiert nach s. umfang = Randlänge (Rand ist ringförmig).
 */
export function buendeln(liste, abstand, umfang = Infinity) {
  const sortiert = [...liste].sort((a, b) => a.s - b.s);
  const gruppen = [];
  for (const z of sortiert) {
    const g = gruppen[gruppen.length - 1];
    if (g && z.s - g[g.length - 1].s < abstand) g.push(z);
    else gruppen.push([z]);
  }
  // über die Ecke links oben hinweg (Anfang und Ende des Rands)
  if (gruppen.length > 1 && Number.isFinite(umfang)) {
    const erste = gruppen[0], letzte = gruppen[gruppen.length - 1];
    // die hinteren bekommen s - umfang, damit die Mitte der Gruppe an der Ecke liegt (punktAmRand rechnet ringsum)
    if (erste[0].s + umfang - letzte[letzte.length - 1].s < abstand) {
      gruppen.pop();
      gruppen[0] = [...letzte.map((z) => ({ ...z, s: z.s - umfang })), ...erste];
    }
  }
  return gruppen;
}

// ------------------------------------------------------------------ Aussehen
const CSS = `
#hm-auslastung-ebene { position: absolute; inset: 0; pointer-events: none; z-index: 6; overflow: hidden; }
body.foto #hm-auslastung-ebene { display: none !important; }
.hm-ausl { position: absolute; left: 0; top: 0; display: flex; align-items: center; gap: 4px; padding: 2px 5px 2px 2px;
  background: #f4efe2; box-shadow: 0 0 0 2px #24364a, 2px 3px 0 2px rgba(20,32,48,.3); will-change: transform;
  font: 600 13px/1 var(--hm-pixel); color: #24364a; white-space: nowrap; }
.hm-ausl .hm-wunsch { --hm-wunsch: 12px; box-shadow: none; }
.hm-ausl .hm-ausl-balken { position: absolute; left: 2px; right: 2px; bottom: -6px; height: 3px; background: #c9c0ab; box-shadow: 0 0 0 1px #24364a; }
.hm-ausl .hm-ausl-balken > i { display: block; height: 100%; width: var(--anteil, 0%); background: #3b9a4a; }
.hm-ausl.knapp { background: #f6b25a; }
.hm-ausl.knapp .hm-ausl-balken > i { background: #c8452f; }
.hm-ausl.knapp.blinkt { animation: hm-ausl-blink .8s steps(2, jump-none) 6; }
@keyframes hm-ausl-blink { 0% { background: #f6b25a; } 100% { background: #e0812c; color: #fff; } }
.hm-ausl.voll { background: #c8452f; color: #fff; }
.hm-ausl.voll .hm-ausl-balken > i { background: #c8452f; }
.hm-ausl.klein { font-size: 11px; padding: 1px 3px 1px 1px; box-shadow: 0 0 0 1px #24364a, 1px 2px 0 1px rgba(20,32,48,.3); }
.hm-ausl.klein .hm-ausl-balken { bottom: -5px; height: 2px; }
@media (prefers-reduced-motion: reduce) { .hm-ausl.knapp.blinkt { animation: none; } }
body.hm-ruhig .hm-ausl.knapp.blinkt { animation: none; }

#hm-zeiger-ebene { position: absolute; inset: 0; pointer-events: none; z-index: 13; overflow: hidden; }
body.foto #hm-zeiger-ebene, body.building #hm-zeiger-ebene, body.hm-ueberblick #hm-zeiger-ebene { display: none !important; }
.hm-zeiger { position: absolute; left: 0; top: 0; width: 34px; height: 34px; margin: -17px 0 0 -17px; padding: 0; border: 0;
  background: none; pointer-events: auto; cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent;
  transition: transform .12s linear, opacity .2s; }
.hm-zeiger[hidden] { display: none; }
.hm-zeiger .hm-zeiger-pfeil { position: absolute; left: 50%; top: 50%; width: 58px; height: 14px; margin: -7px 0 0 -29px;
  transform: rotate(var(--w, 0deg)); pointer-events: none; }
.hm-zeiger .hm-zeiger-pfeil::after { content: ""; position: absolute; right: 0; top: 0; width: 10px; height: 14px;
  background: var(--px-zeigerpfeil) center / 100% 100% no-repeat; image-rendering: pixelated; }
.hm-zeiger .hm-zeiger-ring { position: absolute; inset: 5px; background: #f4efe2 var(--ring) center / 100% 100% no-repeat;
  box-shadow: 0 0 0 2px #24364a, 2px 3px 0 2px rgba(20,32,48,.3); image-rendering: pixelated; }
.hm-zeiger.eilig .hm-zeiger-ring { animation: hm-geduld-blink 1s steps(2, jump-none) infinite; }
.hm-zeiger .hm-zeiger-zahl { position: absolute; right: -6px; top: -6px; min-width: 14px; height: 14px; padding: 0 2px;
  background: #24364a; color: #fff; font: 600 11px/14px var(--hm-pixel); text-align: center; }
.hm-zeiger .hm-zeiger-zahl:empty { display: none; }
.hm-zeiger:focus-visible { outline: 3px dashed var(--hm-gold, #f2c14e); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .hm-zeiger { transition: none; } .hm-zeiger.eilig .hm-zeiger-ring { animation: none; } }
body.hm-ruhig .hm-zeiger { transition: none; }
body.hm-ruhig .hm-zeiger.eilig .hm-zeiger-ring { animation: none; }
`;
// Pfeilspitze 4 x 6 (nach rechts), doppelt gezeichnet
// Pfeilspitze 5 x 7 (nach rechts): dunkler Rand 'k', helle Füllung 'w', doppelt gezeichnet
const PFEIL = ['k....', 'kk...', 'kwk..', 'kwwk.', 'kwk..', 'kk...', 'k....'];
function pfeilSvg() {
  let r = '';
  const farbe = { k: '#24364a', w: '#f2c14e' };
  PFEIL.forEach((z, y) => [...z].forEach((c, x) => { if (farbe[c]) r += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${farbe[c]}"/>`; }));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="5" height="7" viewBox="0 0 5 7" shape-rendering="crispEdges">${r}</svg>`;
}

// Gebäude zu einer Versorgung: Gebäude-ids aus render/buildings.js (KAUF) über game.buildings.fuerKauf,
// die Tankstelle aus render/services.js
const TANKSTELLE = 'service-tankstelle';

// Abstand der Zeiger vom Bildrand und voneinander (Pixel)
const RAND = 36;
const ZEIGER_ABSTAND = 44;

export function init(game) {
  if (typeof document === 'undefined') return;
  const root = document.getElementById('game') || document.body;
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

  const style = el('style');
  style.id = 'hm-hafenzeichen-stil';
  style.textContent = CSS + `\n:root { --px-zeigerpfeil: url("data:image/svg+xml,${encodeURIComponent(pfeilSvg())}"); }`;
  document.head.append(style);

  const sim = () => game.sim;
  const st = () => game.sim?.state;
  const voll = () => game.sim?.ctx?.rules?.queue?.patience ?? 30;

  /** Ringzustand eines wartenden Boots (null, wenn es nicht wartet). */
  function ringFuer(id) {
    const b = st()?.boats?.[id];
    if (!b || b.status !== 'waiting') return null;
    const rest = sim().geduld?.(id) ?? voll();
    const laeuft = !sim().geduldRuht?.(id);
    return ringZustand(rest, voll(), laeuft);
  }

  // ================================================================ Kurzes Tuten im letzten Drittel
  const getutet = new Set();
  let letztesTuten = -Infinity;
  function tutenPruefen() {
    const s = st();
    if (!s || !(game.speed > 0)) return;
    for (const id of s.queue ?? []) {
      if (getutet.has(id)) continue;
      const z = ringFuer(id);
      if (!z?.eilig) continue;
      getutet.add(id);
      // höchstens ein Tuten alle 6 s, sonst wird es bei vollem Hafen zur Hupe
      const jetzt = performance.now();
      if (jetzt - letztesTuten < 6000) continue;
      letztesTuten = jetzt;
      const groesse = String(s.boats[id]?.size ?? 'M').toUpperCase();
      game.emit?.('horn', { groesse, stoesse: 1, kurz: true });
    }
    for (const id of [...getutet]) if (!s.boats?.[id] || s.boats[id].status !== 'waiting') getutet.delete(id);
  }

  // ================================================================ Auslastung an den Gebäuden
  const auslEbene = el('div');
  auslEbene.id = 'hm-auslastung-ebene';
  auslEbene.setAttribute('aria-hidden', 'true');
  root.append(auslEbene);
  const schilder = new Map();   // key -> { node, zahl, balken, ziel, hoehe, stufe }
  const vollGemeldet = new Set();
  let vollTag = null;

  function zielFuer(key) {
    if (key === 'diesel') return game.scene?.getObjectByName?.(TANKSTELLE) ?? null;
    const B = game.buildings;
    if (!B?.fuerKauf || !B.items) return null;
    // das höchste stehende Gebäude dieser Versorgung (Sanitärgebäude vor Toilette, Restaurant vor Kiosk)
    for (let n = 6; n >= 1; n--) {
      for (const id of B.fuerKauf(key, n)) {
        const it = B.items.find((i) => i.id === id);
        if (it?.mesh?.parent) return it.mesh;
      }
    }
    return null;
  }
  function hoeheVon(obj) {
    if (!game.THREE || !obj) return 4;
    const box = new game.THREE.Box3().setFromObject(obj);
    return Number.isFinite(box.max.y) ? box.max.y - obj.position.y + 1.2 : 4;
  }
  function schildFuer(key) {
    let s = schilder.get(key);
    if (s) return s;
    const node = el('div', 'hm-ausl');
    const sym = el('i', 'hm-wunsch');
    sym.dataset.w = key;
    const zahl = el('span', 'hm-ausl-zahl');
    const balken = el('b', 'hm-ausl-balken');
    balken.append(el('i'));
    node.append(sym, zahl, balken);
    node.style.visibility = 'hidden';
    auslEbene.append(node);
    s = { node, zahl, balken, ziel: null, hoehe: 4, stufe: null, text: null };
    schilder.set(key, s);
    return s;
  }
  function schilderAbgleichen() {
    const s = st();
    const last = s && sim()?.auslastung ? sim().auslastung() : {};
    if (s && vollTag !== s.day) { vollTag = s.day; vollGemeldet.clear(); }
    for (const [key, sch] of [...schilder]) if (!last[key]) { sch.node.remove(); schilder.delete(key); }
    for (const [key, { versorgt, kapazitaet }] of Object.entries(last)) {
      const sch = schildFuer(key);
      const ziel = zielFuer(key);
      if (ziel !== sch.ziel) { sch.ziel = ziel; sch.hoehe = hoeheVon(ziel); }
      const t = auslastungText(key, versorgt, kapazitaet);
      if (t.kurz !== sch.text) {
        sch.text = t.kurz;
        sch.zahl.textContent = t.kurz;
        sch.node.title = t.titel;
        sch.balken.firstChild.style.setProperty('--anteil', `${Math.round(100 * Math.min(1, versorgt / kapazitaet))}%`);
      }
      const stufe = auslastungStufe(versorgt, kapazitaet);
      if (stufe !== sch.stufe) {
        const vorher = sch.stufe;
        sch.stufe = stufe;
        sch.node.classList.toggle('knapp', stufe === 'knapp');
        sch.node.classList.toggle('voll', stufe === 'voll');
        // Warnen, bevor es Anker kostet: beim Wechsel auf knapp blinkt das Schild ein paar Mal
        sch.node.classList.remove('blinkt');
        if (stufe === 'knapp' && vorher != null) { void sch.node.offsetWidth; sch.node.classList.add('blinkt'); }
        if (stufe === 'voll' && vorher != null && !vollGemeldet.has(key)) {
          vollGemeldet.add(key);
          game.emit?.('hafenzeichen:voll', { key });
        }
      }
    }
  }

  // ================================================================ Zeiger am Bildrand
  const zeigerEbene = el('div');
  zeigerEbene.id = 'hm-zeiger-ebene';
  root.append(zeigerEbene);
  const zeigerKnoten = [];   // wiederverwendete Knöpfe
  let zeigerDaten = [];      // je sichtbarem Zeiger: { ids, ziel }

  function zeigerKnopf(i) {
    let k = zeigerKnoten[i];
    if (k) return k;
    const node = el('button', 'hm-zeiger');
    node.type = 'button';
    const pfeil = el('i', 'hm-zeiger-pfeil');
    const ring = el('i', 'hm-zeiger-ring');
    const zahl = el('b', 'hm-zeiger-zahl');
    node.append(pfeil, ring, zahl);
    node.hidden = true;
    node.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const d = zeigerDaten[i];
      const a = d && game.boatView?.boot?.(d.ziel);
      const m = a?.model;
      if (m && game.camera?.flyTo) game.camera.flyTo(m.position.x, m.position.z);
    });
    // Ziehen am Zeiger soll die Kamera nicht schieben
    node.addEventListener('pointerdown', (ev) => ev.stopPropagation());
    zeigerEbene.append(node);
    k = { node, pfeil, ring, zahl, pos: null, bild: null, w: null };
    zeigerKnoten[i] = k;
    return k;
  }

  // Liegt an diesem Bildpunkt etwas Bedienbares (Knopf, Tafel)? Spielfläche und eigene Ebenen zählen nicht.
  function belegt(x, y, stage, canvas) {
    const e = document.elementFromPoint(x, y);
    if (!e || e === stage || e === canvas || e === document.body || e === document.documentElement || e === root) return false;
    if (e.closest('#hm-zeiger-ebene')) return false;
    return true;
  }
  function frei(x, y, stage, canvas) {
    const h = 26;   // Zeiger samt Pfeil und etwas Luft zu Knöpfen
    return !belegt(x, y, stage, canvas) && !belegt(x - h, y - h, stage, canvas) && !belegt(x + h, y - h, stage, canvas)
      && !belegt(x - h, y + h, stage, canvas) && !belegt(x + h, y + h, stage, canvas);
  }

  function zeigerVerbergen() {
    for (const k of zeigerKnoten) if (!k.node.hidden) k.node.hidden = true;
    zeigerDaten = [];
  }

  const _v = { x: 0, y: 0, z: 0 };
  function zeigerAbgleichen() {
    const s = st();
    const cam = game.camera?.camera;
    const canvas = game.renderer?.domElement;
    if (!s || !cam || !canvas || !(s.queue?.length)) return zeigerVerbergen();
    // Große Fenster (Feier, Kartenwahl, Tagesabschluss, Winter) stehen: keine Zeiger
    const stand = game.meldungen?.stand?.();
    if (stand && stand.vorrang >= VORRANG.winter) return zeigerVerbergen();
    const rc = canvas.getBoundingClientRect();
    const rr = zeigerEbene.getBoundingClientRect();
    if (!rc.width || !rc.height) return zeigerVerbergen();
    const stage = document.getElementById('stage');
    const r = { l: rc.left + RAND, t: rc.top + RAND, r: rc.right - RAND, b: rc.bottom - RAND };
    const umfang = 2 * ((r.r - r.l) + (r.b - r.t));
    const liste = [];
    for (const id of s.queue) {
      // nur Boote, die schon an der Boje warten (nicht jedes Boot auf der Anfahrt)
      if (!s.boats?.[id]?.atBuoy) continue;
      const a = game.boatView?.boot?.(id);
      const m = a?.model;
      if (!m) continue;
      const v = m.position.clone();
      v.y += 1;
      v.project(cam);
      _v.x = v.x; _v.y = v.y; _v.z = v.z;
      const hinten = _v.z > 1;
      let px = rc.left + (_v.x + 1) / 2 * rc.width;
      let py = rc.top + (1 - _v.y) / 2 * rc.height;
      if (hinten) { px = 2 * (rc.left + rc.width / 2) - px; py = 2 * (rc.top + rc.height / 2) - py; }
      const drin = !hinten && px >= rc.left && px <= rc.right && py >= rc.top && py <= rc.bottom;
      if (drin) continue;
      const z = ringFuer(id);
      if (!z) continue;
      const rp = randPunkt({ x: px, y: py }, r);
      liste.push({ id, s: rp.s, winkel: rp.winkel, ring: z });
    }
    const gruppen = buendeln(liste, ZEIGER_ABSTAND, umfang);
    const genutzt = [];
    let i = 0;
    for (const g of gruppen) {
      // das eiligste Boot der Gruppe bestimmt Ring und Ziel
      const ziel = g.reduce((a, b) => (b.ring.anteil < a.ring.anteil ? b : a));
      const sMitte = g.reduce((t, z) => t + z.s, 0) / g.length;
      // Platz suchen: entlang des Rands abwechselnd vor und zurück, bis nichts Bedienbares darunter liegt
      let pos = null;
      for (let k = 0; k <= 40 && !pos; k++) {
        for (const vz of k ? [1, -1] : [1]) {
          const p = punktAmRand(sMitte + vz * k * 12, r);
          if (genutzt.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < ZEIGER_ABSTAND - 4)) continue;
          if (frei(p.x, p.y, stage, canvas)) { pos = p; break; }
        }
      }
      if (!pos) continue;
      genutzt.push(pos);
      const kn = zeigerKnopf(i);
      zeigerDaten[i] = { ids: g.map((z) => z.id), ziel: ziel.id };
      const winkel = Math.round(ziel.winkel);
      const tr = `translate(${Math.round(pos.x - rr.left)}px, ${Math.round(pos.y - rr.top)}px)`;
      if (kn.pos !== tr) { kn.node.style.transform = tr; kn.pos = tr; }
      if (kn.w !== winkel) { kn.pfeil.style.setProperty('--w', `${winkel}deg`); kn.w = winkel; }
      const bild = ringBild(ziel.ring);
      if (kn.bild !== bild) { kn.ring.style.setProperty('--ring', bild); kn.bild = bild; }
      kn.node.classList.toggle('eilig', ziel.ring.eilig);
      kn.zahl.textContent = g.length > 1 ? String(g.length) : '';
      const name = s.boats[ziel.id]?.name;
      const label = g.length > 1 ? `${g.length} Boote warten dort, zum eiligsten fahren` : `${name ? `${name} wartet` : 'Ein Boot wartet'} dort, hinfahren`;
      if (kn.node.getAttribute('aria-label') !== label) { kn.node.setAttribute('aria-label', label); kn.node.title = label; }
      if (kn.node.hidden) kn.node.hidden = false;
      i++;
    }
    for (let j = i; j < zeigerKnoten.length; j++) if (!zeigerKnoten[j].node.hidden) zeigerKnoten[j].node.hidden = true;
    zeigerDaten.length = i;
  }

  // ================================================================ Takt
  let takt = 0, zeigerTakt = 0;
  game.onTick?.((dt) => {
    takt += dt || 0.016;
    zeigerTakt += dt || 0.016;
    if (takt > 0.25 || dt === 0) { takt = 0; schilderAbgleichen(); tutenPruefen(); verdeckungPruefen(); }
    if (zeigerTakt > 0.1 || dt === 0) { zeigerTakt = 0; zeigerAbgleichen(); }
    schilderSetzen();
  });

  // Steht ein Schild unter Bedienelementen? Mitte und beide Seiten des Schilds prüfen.
  function verdeckungPruefen() {
    const stage = document.getElementById('stage');
    const canvas = game.renderer?.domElement;
    for (const sch of schilder.values()) {
      if (!sch.sollXY) { sch.verdeckt = false; continue; }
      const [x, y] = sch.sollXY;
      const w = (sch.node.offsetWidth || 60) / 2;
      const h = sch.node.offsetHeight || 20;
      sch.verdeckt = belegt(x, y - h / 2, stage, canvas) || belegt(x - w, y - h / 2, stage, canvas) || belegt(x + w, y - h / 2, stage, canvas)
        || belegt(x, y - h, stage, canvas) || belegt(x, y + 6, stage, canvas);
    }
  }

  function schilderSetzen() {
    if (!schilder.size) return;
    const cam = game.camera?.camera;
    const canvas = game.renderer?.domElement;
    if (!cam || !canvas) return;
    const rc = canvas.getBoundingClientRect();
    const rr = auslEbene.getBoundingClientRect();
    const breiteM = game.camera?.viewWidth ?? 100;
    const klein = breiteM > SCHILD_VOLL_BIS;
    for (const sch of schilder.values()) {
      const ziel = sch.ziel;
      // Normale Schilder nur aus der Nähe, Warnungen (knapp, voll) auch aus der Ferne
      let sichtbar = !!ziel && (breiteM <= SCHILD_KLEIN_BIS || sch.stufe !== 'frei');
      let x = 0, y = 0;
      if (sichtbar) {
        const v = ziel.position.clone();
        v.y += sch.hoehe;
        v.project(cam);
        sichtbar = v.z <= 1 && v.z >= -1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
        x = Math.round(rc.left - rr.left + (v.x + 1) / 2 * rc.width);
        y = Math.round(rc.top - rr.top + (1 - v.y) / 2 * rc.height);
      }
      // Unter einem Knopf oder einer Tafel bleibt das Schild weg (geprüft im langsamen Takt)
      if (sichtbar && sch.verdeckt) sichtbar = false;
      if (sch.klein !== klein) { sch.klein = klein; sch.node.classList.toggle('klein', klein); }
      sch.node.style.visibility = sichtbar ? '' : 'hidden';
      sch.xy = sichtbar ? [x + rr.left, y + rr.top] : null;
      sch.sollXY = [x + rr.left, y + rr.top];
      if (!sichtbar) continue;
      const tr = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
      if (sch.pos !== tr) { sch.node.style.transform = tr; sch.pos = tr; }
    }
  }

  // Ein Boot legt an, fährt weg oder wird weggeschickt: Zeiger und Schilder gleich nachziehen, nicht erst im Takt
  for (const ev of ['sim:moored', 'sim:selfEntered', 'sim:turnedAway', 'sim:dismissed', 'sim:feeReady', 'sim:atBuoy', 'sim:change']) {
    game.on?.(ev, () => { takt = 1; zeigerTakt = 1; });
  }

  const neu = () => { for (const sch of schilder.values()) sch.ziel = undefined; getutet.clear(); };
  game.on?.('build', () => queueMicrotask(neu));
  game.on?.('stufe', () => setTimeout(neu, 0));
  game.on?.('ready', neu);
  game.on?.('sim:change', (d) => { if (d?.reason === 'load' || d?.reason === 'new') neu(); });

  game.hafenzeichen = {
    /** Sichtbare Zeiger: [{ ids, ziel }] */
    zeiger: () => zeigerDaten.map((d) => ({ ...d, ids: [...d.ids] })),
    /** Schilder der Versorgung: { key: { text, stufe, sichtbar } } */
    schilder: () => Object.fromEntries([...schilder].map(([k, s]) => [k, { text: s.text, stufe: s.stufe, sichtbar: s.node.style.visibility !== 'hidden' }])),
    ring: ringFuer,
    aktualisieren() { schilderAbgleichen(); zeigerAbgleichen(); schilderSetzen(); },
  };
}

export default init;
