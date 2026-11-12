// Einstieg für neue Spieler: Hinweis-Kreise statt Tutorial. Keine Story, keine Figuren.
// Ein leuchtender Kreis zeigt auf die Stelle, um die es geht, daneben ein kurzer Satz.
// Jeder Schritt endet durch das, was der Spieler wirklich tut (Boot anlegen, Münzen einstreichen),
// nur die reinen Hinweise haben einen Knopf "Weiter". "Einstieg beenden" geht immer.
//
// Schritte (am ersten Tag, Reihenfolge folgt dem Spiel, nicht der Uhr):
//   1. sonne     Boote kommen an die Bojen; Sonne ziehen spult vor        fertig: ein Boot wartet
//   2. anlegen   Boot auf einen leuchtenden Platz ziehen oder Einfahren   fertig: sim:moored
//   3. muenzen   Abends über die Münzen streichen (oder Kassieren)        fertig: sim:collected
//   4. bauen     Mit dem Geld den Hafen ausbauen                          fertig: Bauen gedrückt oder Weiter
//   5. ziele     Tagesziele                                               fertig: Weiter
//
// Spielstand: state.modules.einstieg = { fertig, erledigt: [id, ...] }. Ein neues Spiel hat keinen
// Eintrag, also beginnt der Einstieg dort wieder. Mit ?einstieg=1 in der Adresse startet er neu.
// Schnittstelle: game.einstieg = { start(), beenden(), schritt() }

import { regelnBereit } from './regeln-bereit.js';

const CSS = `
.hm-ring { position: absolute; left: 0; top: 0; z-index: 30; pointer-events: none; border-radius: 50%;
  border: 3px solid #fff6d8; box-shadow: 0 0 0 3px rgba(242,193,78,.85), 0 0 22px 6px rgba(242,193,78,.55);
  transform-origin: center; animation: hm-ring-puls 1.6s ease-in-out infinite; }
.hm-ring[hidden] { display: none; }
.hm-ring .pfeil { position: absolute; left: 50%; top: 50%; width: 0; height: 0; display: none;
  border-left: 9px solid transparent; border-right: 9px solid transparent; border-bottom: 14px solid #f2c14e;
  filter: drop-shadow(0 0 3px rgba(255,246,216,.9)); }
.hm-ring.aussen .pfeil { display: block; }
@keyframes hm-ring-puls { 0%,100% { scale: 1; opacity: .95; } 50% { scale: 1.1; opacity: .7; } }
.hm-tipp { position: absolute; z-index: 31; left: calc(12px + env(safe-area-inset-left, 0px));
  width: min(360px, calc(100% - 24px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)));
  box-sizing: border-box; padding: 14px 16px 12px; border-radius: 18px;
  background: rgba(255,252,246,.97); color: #283648; box-shadow: 0 6px 24px rgba(20,40,60,.22);
  font: 500 15px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif;
  pointer-events: auto; animation: hm-tipp-rein .35s ease-out; }
.hm-tipp[hidden] { display: none; }
@keyframes hm-tipp-rein { from { opacity: 0; translate: 0 8px; } to { opacity: 1; translate: 0 0; } }
.hm-tipp .zaehler { font-size: 12px; font-weight: 600; letter-spacing: .04em; color: #7a8796; margin-bottom: 4px; }
.hm-tipp .titel { font-weight: 700; font-size: 16px; margin: 0 0 4px; }
.hm-tipp p { margin: 0; }
.hm-tipp .knoepfe { display: flex; gap: 8px; justify-content: flex-end; align-items: center; margin-top: 10px; }
.hm-tipp button { min-height: 40px; padding: 0 16px; border: 0; border-radius: 20px; cursor: pointer;
  font: 600 14px system-ui, -apple-system, sans-serif; }
.hm-tipp .weiter { background: #2f6f8f; color: #fff; }
.hm-tipp .beenden { background: transparent; color: #5d6b7a; padding: 0 8px; }
.hm-tipp .weiter:focus-visible, .hm-tipp .beenden:focus-visible { outline: 3px solid #f2c14e; outline-offset: 2px; }
body.hm.foto .hm-tipp, body.hm.foto .hm-ring { display: none; }
@media (max-height: 499px) { .hm-tipp { font-size: 14px; padding: 10px 14px 8px; width: min(340px, 46%); } }
`;

const TOUCH = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

/** Texte je Schritt, für Finger und Maus getrennt, wo es einen Unterschied macht. */
export const TEXTE = {
  sonne: {
    titel: 'Willkommen im Hafen',
    text: TOUCH
      ? 'Boote, die einen Liegeplatz suchen, kommen über das Wasser und warten an den gelben Bojen. Zieh die Sonne nach rechts, dann kommt das erste schneller.'
      : 'Boote, die einen Liegeplatz suchen, kommen über das Wasser und warten an den gelben Bojen. Zieh die Sonne mit der Maus nach rechts, dann kommt das erste schneller.',
  },
  anlegen: {
    titel: 'Ein Boot wartet',
    text: TOUCH
      ? 'Zieh es mit dem Finger auf einen leuchtenden Platz am Steg. Oder tipp es an und wähl „Einfahren“, dann sucht es sich selbst einen Platz.'
      : 'Zieh es mit der Maus auf einen leuchtenden Platz am Steg. Oder klick es an und wähl „Einfahren“, dann sucht es sich selbst einen Platz.',
  },
  muenzen: {
    titel: 'Feierabend',
    text: TOUCH
      ? 'Die Boote zahlen ihr Hafengeld. Streich mit dem Finger in einem Zug über die Münzen. Oder unten „Kassieren“ drücken.'
      : 'Die Boote zahlen ihr Hafengeld. Fahr mit gedrückter Maustaste in einem Zug über die Münzen. Oder unten „Kassieren“ drücken.',
  },
  bauen: {
    titel: 'Hafen ausbauen',
    text: 'Mit dem Geld baust du neue Liegeplätze und Anlagen. Wer gut versorgt ist, gibt dir einen besseren Ruf, und mit dem Ruf wächst der Hafen.',
  },
  ziele: {
    titel: 'Tagesziele',
    text: 'Jeden Tag gibt es drei kleine Ziele. Wer sie schafft, bekommt etwas Geld dazu. Das war es schon. Viel Freude im Hafen.',
  },
};

export const REIHENFOLGE = ['sonne', 'anlegen', 'muenzen', 'bauen', 'ziele'];

export function einstiegState(state) {
  state.modules ||= {};
  state.modules.einstieg ||= { fertig: false, erledigt: [] };
  return state.modules.einstieg;
}

/**
 * Welcher Schritt jetzt zu zeigen ist (ohne Browser testbar).
 * lage: { wartet, abend, muenzen, bauenSichtbar, tafelSichtbar, karteOffen }
 * Gibt die id zurück oder null. Erledigt Schritte, die der Spieler schon hinter sich hat.
 */
export function naechsterSchritt(e, lage) {
  if (e.fertig) return null;
  const done = new Set(e.erledigt);
  // Der Willkommens-Hinweis ist vorbei, sobald ein Boot da ist oder schon eines lag
  if (!done.has('sonne') && (lage.wartet || done.has('anlegen'))) done.add('sonne');
  const bereit = {
    sonne: () => !lage.abend,
    anlegen: () => lage.wartet && !lage.abend,
    muenzen: () => lage.abend && lage.muenzen,
    bauen: () => done.has('muenzen') && lage.bauenSichtbar && !lage.karteOffen,
    ziele: () => done.has('bauen') && lage.tafelSichtbar && !lage.karteOffen,
  };
  e.erledigt = [...done];
  for (const id of REIHENFOLGE) {
    if (done.has(id)) continue;
    if (bereit[id]()) return id;
  }
  if (REIHENFOLGE.every((id) => done.has(id))) e.fertig = true;
  return null;
}

export function erledige(e, id) {
  if (!e.erledigt.includes(id)) e.erledigt.push(id);
  if (REIHENFOLGE.every((x) => e.erledigt.includes(x))) e.fertig = true;
}

// ---------------------------------------------------------------------------
// Im Browser

export async function init(game) {
  const api = await regelnBereit(game);
  const { THREE } = game;
  const st = () => api.state;
  const host = document.getElementById('game') || document.body;

  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const ring = document.createElement('div');
  ring.className = 'hm-ring';
  ring.hidden = true;
  ring.setAttribute('aria-hidden', 'true');
  const pfeil = document.createElement('span');
  pfeil.className = 'pfeil';
  ring.append(pfeil);
  const tipp = document.createElement('div');
  tipp.className = 'hm-tipp';
  tipp.hidden = true;
  tipp.setAttribute('role', 'status');
  tipp.setAttribute('aria-live', 'polite');
  host.append(ring, tipp);

  if (/[?&]einstieg=1\b/.test(location.search)) {
    st().modules ||= {};
    st().modules.einstieg = { fertig: false, erledigt: [] };
  }

  let aktuell = null;     // id des gezeigten Schritts
  let ziehen = false;     // während Schleppleine oder Sonne keinen Text über den Finger legen

  const sichtbar = (el) => {
    if (!el || el.hidden) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  };

  // ---------------------------------------------------------------- Ziele auf dem Bildschirm
  const _v = new THREE.Vector3();
  function aufBildschirm(obj) {
    obj.getWorldPosition(_v);
    _v.project(game.camera.camera);
    if (_v.z > 1) return null;
    const c = game.canvas.getBoundingClientRect();
    const h = host.getBoundingClientRect();
    return { x: (_v.x + 1) / 2 * c.width + c.left - h.left, y: (1 - _v.y) / 2 * c.height + c.top - h.top };
  }
  function objekte(typ, filter = () => true) {
    const list = [];
    game.scene.traverseVisible((o) => {
      const pk = o.userData?.pick;
      if (pk?.type === typ && filter(pk, o)) list.push(o);
    });
    return list;
  }
  function domKreis(el, rand = 8) {
    if (!sichtbar(el)) return null;
    const r = el.getBoundingClientRect();
    const h = host.getBoundingClientRect();
    const w = r.width + rand * 2, hh = r.height + rand * 2;
    return { x: r.left + r.width / 2 - h.left, y: r.top + r.height / 2 - h.top, w, h: hh, rund: Math.min(w, hh) / 2 };
  }
  const muenzen = () => objekte('coin', (pk, o) => !o.userData.eingestrichen);

  function ziel(id) {
    switch (id) {
      case 'sonne': return domKreis(document.querySelector('.hm-sonne'), 6);
      case 'anlegen': {
        const w = api.waitingBoats().map((b) => b.id);
        const boot = objekte('boat', (pk) => w.includes(Number(String(pk.id).replace(/^b/, ''))))[0];
        const p = boot && aufBildschirm(boot);
        return p ? { ...p, w: 76, h: 76 } : null;
      }
      case 'muenzen': {
        // Die Münze, die am nächsten zur Bildmitte liegt
        const c = { x: host.clientWidth / 2, y: host.clientHeight / 2 };
        let best = null;
        for (const m of muenzen()) {
          const p = aufBildschirm(m);
          if (p && (!best || Math.hypot(p.x - c.x, p.y - c.y) < Math.hypot(best.x - c.x, best.y - c.y))) best = p;
        }
        return best ? { ...best, w: 64, h: 64 } : null;
      }
      case 'bauen': return domKreis(document.getElementById('btn-build'), 6);
      case 'ziele': return domKreis(document.querySelector('.hm-tafel > button'), 6);
      default: return null;
    }
  }

  function lage() {
    const s = st();
    return {
      wartet: api.waitingBoats().length > 0,
      abend: s.phase === 'evening',
      muenzen: Object.values(s.boats).some((b) => b.pendingFee > 0),
      bauenSichtbar: sichtbar(document.getElementById('btn-build')),
      tafelSichtbar: sichtbar(document.querySelector('.hm-tafel > button')),
      karteOffen: document.body.classList.contains('card-open'),
    };
  }

  // ---------------------------------------------------------------- Sprechblase
  function zeige(id) {
    aktuell = id;
    if (!id) { tipp.hidden = true; ring.hidden = true; return; }
    const t = TEXTE[id];
    const nr = REIHENFOLGE.indexOf(id) + 1;
    const info = id === 'bauen' || id === 'ziele';
    tipp.replaceChildren();
    const z = document.createElement('div'); z.className = 'zaehler'; z.textContent = `Einstieg ${nr} von ${REIHENFOLGE.length}`;
    const h = document.createElement('p'); h.className = 'titel'; h.textContent = t.titel;
    const p = document.createElement('p'); p.textContent = t.text;
    const k = document.createElement('div'); k.className = 'knoepfe';
    if (id !== 'ziele') {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'beenden'; b.textContent = 'Einstieg beenden';
      b.addEventListener('click', beenden);
      k.append(b);
    }
    if (info) {
      const w = document.createElement('button');
      w.type = 'button'; w.className = 'weiter'; w.textContent = id === 'ziele' ? 'Los geht’s' : 'Weiter';
      w.addEventListener('click', () => schritt(id));
      k.append(w);
    }
    tipp.append(z, h, p, k);
    tipp.hidden = false;
    try { game.audio?.sfx?.('hinweis'); } catch { /* Ton ist nicht wichtig */ }
  }

  // Blase oben (unter Leiste und Chips) oder unten (über Bauen), je nachdem, wo sie den Kreis nicht verdeckt
  function lege(k) {
    const h = host.getBoundingClientRect();
    const unterkante = (sel) => {
      const el = document.querySelector(sel);
      if (!sichtbar(el)) return 0;
      const r = el.getBoundingClientRect();
      return r.left - h.left < 380 ? r.bottom - h.top : 0;
    };
    const oben = Math.max(unterkante('#hud-top'), unterkante('#weather-chip'), unterkante('.hm-tafel > button'), 8) + 10;
    let unten = h.height - 12;
    for (const sel of ['#btn-build', '#btn-collect', '#hud-bottom', '#card']) {
      const el = document.querySelector(sel);
      if (sichtbar(el)) unten = Math.min(unten, el.getBoundingClientRect().top - h.top - 12);
    }
    // Nicht unter die Knopfspalte rechts (Handy hochkant): Breite bis kurz vor die Knöpfe
    let rechts = h.width - 12;
    for (const el of document.querySelectorAll('#hud-top button, #hud-top .hud-btn')) {
      if (!sichtbar(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.left - h.left > h.width * 0.6 && r.top - h.top > 40) rechts = Math.min(rechts, r.left - h.left - 8);
    }
    tipp.style.width = `${Math.round(Math.min(360, rechts - 12))}px`;
    const hoehe = tipp.offsetHeight;
    const trifft = (y) => k && k.y + k.h / 2 > y - 6 && k.y - k.h / 2 < y + hoehe + 6 && k.x - k.w / 2 < 12 + tipp.offsetWidth;
    let y = oben;
    if (trifft(y) || oben + hoehe > unten) y = Math.max(oben, unten - hoehe);
    if (trifft(y)) y = oben;
    tipp.style.top = `${Math.round(y)}px`;
  }

  // ---------------------------------------------------------------- Ablauf
  function schritt(id) {
    const e = einstiegState(st());
    erledige(e, id);
    if (id === aktuell) zeige(null);
  }
  function beenden() {
    const e = einstiegState(st());
    e.fertig = true;
    zeige(null);
    game.emit('einstieg:ende', {});
  }

  function frame() {
    requestAnimationFrame(frame);
    const e = st() && einstiegState(st());
    if (!e || e.fertig) { if (aktuell) zeige(null); return; }
    const id = naechsterSchritt(e, lage());
    if (id !== aktuell) zeige(id);
    if (!id) return;
    const k = ziel(id);
    tipp.hidden = ziehen;
    ring.hidden = !k || ziehen;
    if (k) {
      // Liegt das Ziel außerhalb des Bildes (Boot kommt noch von draußen), steht der Kreis am Rand
      // und ein Pfeil zeigt in die Richtung.
      const rand = 34;
      const W = host.clientWidth, H = host.clientHeight;
      const hud = document.getElementById('hud-top')?.getBoundingClientRect();
      const top = hud && hud.height ? hud.bottom - host.getBoundingClientRect().top + rand : rand;
      // Freie Spielfläche: ohne Seitenleiste (Tablet) und ohne untere Leiste (PC)
      let l = 0, r = W, u = H;
      const hb = document.getElementById('hud-bottom');
      if (sichtbar(hb)) {
        const hr = hb.getBoundingClientRect(), h0 = host.getBoundingClientRect();
        if (hr.height > H * 0.5 && hr.left - h0.left > W * 0.5) r = hr.left - h0.left;
        else if (hr.height > H * 0.5 && hr.right - h0.left < W * 0.5) l = hr.right - h0.left;
        else if (hr.width > W * 0.5) u = hr.top - h0.top;
      }
      const cx = Math.min(r - rand, Math.max(l + rand, k.x)), cy = Math.min(u - rand, Math.max(top, k.y));
      const aussen = Math.hypot(cx - k.x, cy - k.y) > 4;
      ring.classList.toggle('aussen', aussen);
      if (aussen) {
        const winkel = Math.atan2(k.y - cy, k.x - cx);
        Object.assign(k, { x: cx, y: cy, w: 52, h: 52, rund: 0 });
        pfeil.style.transform = `translate(-50%, -50%) rotate(${winkel + Math.PI / 2}rad) translateY(-40px)`;
      }
      ring.style.width = `${Math.round(k.w)}px`;
      ring.style.height = `${Math.round(k.h)}px`;
      ring.style.borderRadius = k.rund ? `${Math.round(k.rund)}px` : '50%';
      ring.style.transform = `translate(${Math.round(k.x - k.w / 2)}px, ${Math.round(k.y - k.h / 2)}px)`;
    }
    if (!tipp.hidden) lege(k);
  }

  game.on('sim:moored', () => schritt('anlegen'));
  game.on('sim:collected', () => schritt('muenzen'));
  document.getElementById('btn-build')?.addEventListener('click', () => { if (aktuell === 'bauen') schritt('bauen'); });
  game.on('ui:tow', () => { ziehen = true; });
  game.on('ui:tow-end', () => { ziehen = false; });
  game.on('ui:vorspulen', ({ speed } = {}) => { ziehen = aktuell === 'sonne' ? false : speed > 1; });
  window.addEventListener('pointerup', () => { ziehen = false; }, true);
  window.addEventListener('pointercancel', () => { ziehen = false; }, true);

  game.einstieg = {
    start() { st().modules ||= {}; st().modules.einstieg = { fertig: false, erledigt: [] }; zeige(null); },
    beenden,
    schritt: () => aktuell,
  };
  requestAnimationFrame(frame);
}
