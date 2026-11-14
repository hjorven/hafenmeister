// Einstieg für neue Spieler: Hinweis-Kreise statt Tutorial. Keine Story, keine Figuren.
// Ein leuchtender Kreis zeigt auf die Stelle, um die es geht, daneben ein kurzer Satz.
// Jeder Schritt endet durch das, was der Spieler wirklich tut (Boot anlegen, Münzen einstreichen),
// nur die reinen Hinweise haben einen Knopf "Weiter". "Einstieg beenden" geht immer.
//
// Schritte (am ersten Tag, Reihenfolge folgt dem Spiel, nicht der Uhr):
//   1. willkommen  Boote warten an den Bojen (Kreis um eine Boje)   fertig: mind. 6 s gelesen und ein Boot wartet im Bild
//   2. anlegen     Boot auf einen Platz ziehen oder Einfahren       fertig: sim:moored
//   3. muenzen     Liegegeld gleich nach dem Anlegen einstreichen   fertig: sim:collected
//   4. tempo       Vorspulen (Zeitsteuerung unten links)            fertig: vorgespult oder Weiter
//   5. bauen       Mit dem Geld den Hafen ausbauen                  fertig: Bauen gedrückt oder Weiter
//   6. ziele       Tagesziele                                       fertig: Los geht's
// Ein Boot, das in der Sim schon wartet, aber in 3D noch von draußen anfährt, zählt erst, wenn es im Bild ist.
//
// Spielstand: state.modules.einstieg = { fertig, erledigt: [id, ...] }. Ein neues Spiel hat keinen
// Eintrag, also beginnt der Einstieg dort wieder. Mit ?einstieg=1 in der Adresse startet er neu.
// Schnittstelle: game.einstieg = { start(), beenden(), schritt() }; meldet 'einstieg:schritt' { schritt } bei jedem Wechsel und 'einstieg:ende' am Ende

import { regelnBereit } from './regeln-bereit.js';
import { VORRANG } from '../ui/meldungen.js';
import { rulesFromEconomy } from '../sim.js';
import { ECONOMY } from '../data/economy.js';

// Welchen Anteil der Rundgang am Abend von liegen gelassenen Münzen holt (Balancing, nicht fest im Text)
const REGELN = rulesFromEconomy(ECONOMY);
export function anteilText(a) {
  const namen = { 0.5: 'die Hälfte', 0.25: 'ein Viertel', 0.75: 'drei Viertel', 0.8: 'vier Fünftel', 0.6: 'drei Fünftel', 0.4: 'zwei Fünftel' };
  return namen[a] ?? `${Math.round(a * 100)} Prozent`;
}
const ANTEIL = anteilText(REGELN.roundShare ?? REGELN.uncollectedShare ?? 0.5);

const CSS = `
.hm-ring { position: absolute; left: 0; top: 0; z-index: 30; pointer-events: none; border-radius: 50%;
  border: 3px solid #fff6d8; box-shadow: 0 0 0 3px rgba(242,193,78,.85), 0 0 22px 6px rgba(242,193,78,.55);
  transform-origin: center; animation: hm-ring-puls 1.6s ease-in-out infinite; }
.hm-ring[hidden] { display: none; }
@keyframes hm-ring-puls { 0%,100% { scale: 1; opacity: .95; } 50% { scale: 1.1; opacity: .7; } }
.hm-tipp { position: absolute; z-index: 31; left: calc(12px + env(safe-area-inset-left, 0px));
  width: min(360px, calc(100% - 24px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)));
  box-sizing: border-box; padding: 12px 14px 10px; border-radius: 0;
  background: var(--hm-papier, #fffaf0); color: var(--hm-tinte, #24364a);
  font-family: var(--hm-pixel); font-size: var(--hm-s, 15px); line-height: 1.4;
  pointer-events: none; animation: hm-tipp-rein .35s ease-out; }
.hm-tipp button { pointer-events: auto; }
.hm-tipp[hidden] { display: none; }
@keyframes hm-tipp-rein { from { opacity: 0; translate: 0 8px; } to { opacity: 1; translate: 0 0; } }
.hm-tipp .zaehler { font-size: calc(var(--hm-s, 15px) - 3px); color: var(--hm-tinte-2, #5a6a7c); margin-bottom: 4px; }
.hm-tipp .titel { font-weight: 600; font-size: calc(var(--hm-s, 15px) + 2px); margin: 0 0 4px; }
.hm-tipp p { margin: 0; }
.hm-tipp .kurz { display: none; }
.hm-tipp.eng .lang, .hm-tipp.eng .zaehler { display: none; }
.hm-tipp.eng .kurz { display: block; }
.hm-tipp.eng { padding: 8px 12px 6px; font-size: calc(var(--hm-s, 15px) - 1px); }
.hm-tipp.eng .titel { font-size: var(--hm-s, 15px); margin-bottom: 2px; }
.hm-tipp.eng .knoepfe { margin-top: 4px; }
.hm-tipp.eng button { min-height: 36px; }
.hm-tipp .knoepfe { display: flex; gap: 8px; justify-content: flex-end; align-items: center; margin-top: 10px; }
.hm-tipp button { min-height: 40px; padding: 0 16px; border: 0; border-radius: 0; cursor: pointer;
  font-family: var(--hm-pixel); font-size: var(--hm-s, 15px); }
.hm-tipp .weiter { background: var(--hm-meer, #23897d); color: #fff; box-shadow: inset 0 -4px 0 rgba(0,0,0,.2); }
.hm-tipp .beenden { background: transparent; color: var(--hm-tinte-2, #5a6a7c); padding: 0 8px; }
.hm-tipp .weiter:focus-visible, .hm-tipp .beenden:focus-visible { outline: 3px solid var(--hm-gold, #f2c14e); outline-offset: 2px; }
body.hm.foto .hm-tipp, body.hm.foto .hm-ring { display: none; }
/* Ein Tipp beim ersten Mal steht neben der linken Spalte, die bleibt sichtbar (ui-phone.css blendet sie sonst aus) */
@media (max-height: 499px) and (orientation: landscape) { .hm-neu:has(.hm-tipp.hinweis:not([hidden])) #hm-seite { visibility: visible; } }
@media (max-height: 499px) { .hm-tipp { font-size: calc(var(--hm-s, 15px) - 1px); padding: 10px 14px 8px; width: min(340px, 46%); } }
`;

// Wie ui-phone.css: flaches Querformat, dort blendet die Oberfläche die Seitenleiste unter der Blase aus
const QUER = typeof matchMedia === 'function' ? matchMedia('(max-height: 499px) and (orientation: landscape)') : { matches: false };
const TOUCH = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

/** Texte je Schritt, für Finger und Maus getrennt, wo es einen Unterschied macht. */
export const TEXTE = {
  willkommen: {
    titel: 'Willkommen im Hafen',
    text: 'Boote, die einen Liegeplatz suchen, kommen übers Wasser und warten an den gelben Bojen. Das erste ist schon unterwegs.',
    kurz: 'Boote warten an den gelben Bojen. Das erste ist unterwegs.',
  },
  anlegen: {
    titel: 'Ein Boot wartet',
    text: TOUCH
      ? 'Zieh es mit dem Finger auf einen leuchtenden Platz (grünes Schild heißt frei). Oder tipp es an und lass es einfahren.'
      : 'Zieh es mit der Maus auf einen leuchtenden Platz (grünes Schild heißt frei). Oder klick es an und lass es einfahren.',
    kurz: TOUCH ? 'Boot auf einen leuchtenden Platz ziehen oder antippen und einfahren lassen.' : 'Boot auf einen leuchtenden Platz ziehen oder anklicken und einfahren lassen.',
  },
  muenzen: {
    titel: 'Liegegeld beim Anlegen',
    text: TOUCH
      ? `Angelegt. Das Boot zahlt gleich: Tipp auf die Münze am Boot, mehrere streichst du in einem Zug ein. Bezahlt zeigt einen Wimpel am Bug. Was liegen bleibt, holt abends der Hafenmeister, aber nur ${ANTEIL}.`
      : `Angelegt. Das Boot zahlt gleich: Klick auf die Münze am Boot, mehrere fährst du mit gedrückter Maustaste in einem Zug ab. Bezahlt zeigt einen Wimpel am Bug. Was liegen bleibt, holt abends der Hafenmeister, aber nur ${ANTEIL}.`,
    kurz: TOUCH ? `Tipp auf die Münze am Boot. Liegen gelassen gibt es abends nur ${ANTEIL}.` : `Klick auf die Münze am Boot. Liegen gelassen gibt es abends nur ${ANTEIL}.`,
  },
  tempo: {
    titel: 'Der Tag läuft',
    text: TOUCH
      ? 'Bis zum Abend kommen weitere Boote. Wer länger wartet, fährt selbst ein, aber nur von Hand kannst du Wünsche erfüllen, und die bringen mehr. Unten links hältst du die Zeit an oder spulst vor: 1x, 3x oder 8x.'
      : 'Bis zum Abend kommen weitere Boote. Wer länger wartet, fährt selbst ein, aber nur von Hand kannst du Wünsche erfüllen, und die bringen mehr. Unten links hältst du die Zeit an oder spulst vor: 1x, 3x oder 8x. Taste F schaltet 3x ein und aus.',
    kurz: 'Weitere Boote kommen. Vorspulen geht unten links mit dem Doppelpfeil.',
  },
  bauen: {
    titel: 'Hafen ausbauen',
    text: TOUCH
      ? 'Mit dem Geld baust du neue Liegeplätze und Anlagen. Tipp auf „Bauen“: Die Zeit hält an, und du siehst erst eine Vorschau. Gekauft wird erst mit „Bauen für …“. Mit dem Ruf deiner Gäste wächst der Hafen.'
      : 'Mit dem Geld baust du neue Liegeplätze und Anlagen. Klick auf „Bauen“: Die Zeit hält an, und du siehst erst eine Vorschau. Gekauft wird erst mit „Bauen für …“. Mit dem Ruf deiner Gäste wächst der Hafen.',
    kurz: 'Mit dem Geld baust du aus. Erst Vorschau, gekauft wird mit „Bauen für …“.',
  },
  ziele: {
    titel: 'Tagesziele',
    text: 'Jeden Morgen liegen hier drei Ziele zur Wahl, leicht, mittel und schwer. Nimm eins, es zählt nur, was du selbst tust. Das war es schon. Viel Freude im Hafen.',
    kurz: 'Jeden Morgen ein Ziel zur Wahl, es zählt nur, was du selbst tust. Viel Freude im Hafen.',
  },
};

/**
 * Hinweise beim ersten Mal (nach dem Einstieg, je einmal pro Spielstand). Sturm und Winter erklärt
 * schon das Ereignisschild (events/banner.js) bei jedem Auftreten, darum stehen sie hier nicht.
 */
export const HINWEISE = {
  geduld: {
    titel: 'Ein Boot ist weitergefahren',
    text: 'Es hat zu lange an der Boje gewartet. Weise wartende Boote schneller zu oder bau mehr passende Plätze.',
    kurz: 'Es hat zu lange gewartet. Schneller zuweisen oder mehr Plätze bauen.',
  },
  voll: {
    titel: 'Kein Platz an den Bojen',
    text: 'Alle Wartebojen waren besetzt, darum ist ein Boot gleich weitergefahren. Mehr Liegeplätze machen die Bojen schneller frei.',
    kurz: 'Alle Bojen waren besetzt. Mehr Liegeplätze helfen.',
  },
  stufe: {
    titel: 'Der Hafen kann wachsen',
    text: 'Das Ziel dieser Stufe ist geschafft. Unter „Bauen“, Reiter „Hafen“, baust du die nächste Ausbaustufe, sobald das Geld reicht.',
    kurz: 'Ziel geschafft. Unter „Bauen“, Reiter „Hafen“, geht es zur nächsten Stufe.',
  },
  stammgast: {
    titel: 'Ein neuer Stammgast',
    text: 'Ein Gast war sehr zufrieden und kommt wieder: gleiches Boot, gleicher Name, gleiche Wünsche. Ab dem fünften Besuch kannst du ihn als Dauerlieger behalten.',
    kurz: 'Ein zufriedener Gast kommt wieder. Ab dem fünften Besuch kann er Dauerlieger werden.',
  },
};

/** Ereignis aus der Simulation -> Hinweis (oder null). */
export function hinweisFuer(name, d = {}) {
  if (name === 'sim:turnedAway') return d.reason === 'patience' ? 'geduld' : d.reason === 'queueFull' ? 'voll' : null;
  if (name === 'sim:stageReady') return 'stufe';
  if (name === 'stammgast:neu') return 'stammgast';
  return null;
}

/** Merkt einen Hinweis vor, wenn er in diesem Spielstand noch nicht kam. true = neu. */
export function merkeHinweis(e, id, offen) {
  e.hinweise ||= [];
  if (!id || e.hinweise.includes(id) || offen.includes(id)) return false;
  offen.push(id);
  return true;
}

export const REIHENFOLGE = ['willkommen', 'anlegen', 'muenzen', 'tempo', 'bauen', 'ziele'];

/** So lange bleibt "Willkommen" mindestens stehen, auch wenn das erste Boot schon da ist. */
export const WILLKOMMEN_SEK = 6;

export function einstiegState(state) {
  state.modules ||= {};
  state.modules.einstieg ||= { fertig: false, erledigt: [] };
  // Spielstände mit dem alten ersten Schritt "sonne" (Willkommen) übernehmen
  const e = state.modules.einstieg;
  if (!e.v2) {
    const alt = e.erledigt || [];
    e.erledigt = alt.filter((id) => ['anlegen', 'muenzen', 'bauen', 'ziele'].includes(id));
    if (alt.includes('sonne')) e.erledigt.push('willkommen');
    // Wer früher "Bauen" gesehen hat, kennt auch das Vorspulen schon
    if (alt.includes('bauen')) e.erledigt.push('tempo');
    e.v2 = true;
    e.v3 = true;
  }
  // v2 hieß der Vorspul-Schritt noch "sonne"
  if (!e.v3) {
    e.erledigt = (e.erledigt || []).map((id) => (id === 'sonne' ? 'tempo' : id));
    e.v3 = true;
  }
  return e;
}

/**
 * Welcher Schritt jetzt zu zeigen ist (ohne Browser testbar).
 * lage: { tag, bootImBild, willkommenSek, abend, muenzen, bauenSichtbar, tafelSichtbar, ohneZiele, karteOffen }
 *   bootImBild: ein wartendes Boot liegt sichtbar im Bild (nicht nur in der Sim, noch auf der Anfahrt)
 *   willkommenSek: wie lange "Willkommen" schon zu sehen ist
 * Gibt die id zurück oder null. Erledigt Schritte, die der Spieler schon hinter sich hat.
 */
export function naechsterSchritt(e, lage) {
  if (e.fertig) return null;
  // Nach einem ganzen Spieltag schließt der Einstieg von selbst, damit kein Hinweis Tage später noch über dem Hafen liegt
  if (lage.tag != null) {
    e.startTag ??= lage.tag;
    if (lage.tag > e.startTag) { e.fertig = true; return null; }
  }
  const done = new Set(e.erledigt);
  // Handy quer: Die Seitenleiste mit der Tafel tritt hinter die Blase zurück (ui-phone.css),
  // der Hinweis auf die Tagesziele hätte also kein Ziel. Er entfällt dort.
  if (lage.ohneZiele && done.has('bauen')) done.add('ziele');
  // Willkommen ist vorbei, wenn man es lesen konnte und das erste Boot im Bild wartet, oder schon eines lag
  if (!done.has('willkommen') && ((lage.bootImBild && lage.willkommenSek >= WILLKOMMEN_SEK) || done.has('anlegen'))) done.add('willkommen');
  const ruhig = !lage.karteOffen;
  const bereit = {
    willkommen: () => !lage.abend,
    anlegen: () => lage.bootImBild && !lage.abend,
    muenzen: () => lage.muenzen,
    tempo: () => done.has('muenzen') && !lage.abend && ruhig,
    bauen: () => done.has('tempo') && lage.bauenSichtbar && ruhig,
    ziele: () => done.has('bauen') && lage.tafelSichtbar && ruhig,
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
  // Die Schnittstelle gibt es sofort: Wer beenden() oder start() ruft, bevor die Regeln bereit sind
  // (Tests, Speicherplatzwahl), wird gemerkt und gleich nach dem Aufbau ausgeführt.
  let vorher = null;
  const schnittstelle = game.einstieg = {
    start() { vorher = 'start'; },
    beenden() { vorher = 'beenden'; },
    schritt: () => null,
  };
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
  const tipp = document.createElement('div');
  tipp.className = 'hm-tipp';
  tipp.hidden = true;
  tipp.setAttribute('role', 'status');
  tipp.setAttribute('aria-live', 'polite');
  host.append(ring, tipp);

  if (/[?&]einstieg=1\b/.test(location.search)) {
    st().modules ||= {};
    st().modules.einstieg = { fertig: false, erledigt: [] };
  } else if (st()?.testmodus) {
    // Testmodus ?stufe=n speichert nie: der Einstieg käme sonst nach jedem Neuladen wieder
    st().modules ||= {};
    st().modules.einstieg = { ...(st().modules.einstieg || {}), fertig: true, erledigt: [...REIHENFOLGE] };
  }

  let aktuell = null;     // id des gezeigten Schritts
  let ziehen = false;     // während der Schleppleine keinen Text über den Finger legen

  const sichtbar = (el) => {
    if (!el || el.hidden) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  };

  // ---------------------------------------------------------------- Ziele auf dem Bildschirm
  const _v = new THREE.Vector3();
  function aufBildschirm(obj) {
    return punktAufBildschirm(obj.getWorldPosition(_v));
  }
  function punktAufBildschirm(pos) {
    _v.copy(pos).project(game.camera.camera);
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
    return { x: r.left + r.width / 2 - h.left, y: r.top + r.height / 2 - h.top, w, h: hh, rund: 2 };   // eckig wie die Pixel-Knöpfe
  }
  const muenzen = () => objekte('coin', (pk, o) => !o.userData.eingestrichen);
  const bootNr = (pk) => Number(String(pk.id).replace(/^b/, ''));
  // Liegende Boote, deren Liegegeld noch offen ist (deren Münze gleich erscheint)
  function zahlendeIds() {
    const boats = st()?.boats ?? {};
    return new Set(Object.values(boats).filter((b) => b.status === 'moored' && b.pendingFee > 0).map((b) => b.id));
  }
  function zahlendesBoot() {
    const ids = zahlendeIds();
    return ids.size ? objekte('boat', (pk) => ids.has(bootNr(pk)))[0] ?? null : null;
  }

  // Freie Spielfläche ohne Leisten und Knopfspalten, mit etwas Rand: nur dort gilt ein Boot als "im Bild"
  let letztesDeck = [];
  function freieFlaeche(rand = 28) {
    const h0 = host.getBoundingClientRect();
    let l = 0, t = 0, r = h0.width, u = h0.height;
    const top = document.getElementById('hud-top');
    if (sichtbar(top)) t = top.getBoundingClientRect().bottom - h0.top;
    const hb = document.getElementById('hud-bottom');
    if (sichtbar(hb)) {
      const hr = hb.getBoundingClientRect();
      if (hr.height > h0.height * 0.5 && hr.left - h0.left > h0.width * 0.5) r = hr.left - h0.left;
      else if (hr.height > h0.height * 0.5 && hr.right - h0.left < h0.width * 0.5) l = hr.right - h0.left;
      else if (hr.width > h0.width * 0.5) u = hr.top - h0.top;
    }
    // Knopfspalte am rechten Rand (Handy hochkant)
    for (const el of document.querySelectorAll('#hud-top button, #hud-top .hud-btn')) {
      if (!sichtbar(el)) continue;
      const br = el.getBoundingClientRect();
      if (br.left - h0.left > h0.width * 0.6 && br.top - h0.top > 40) r = Math.min(r, br.left - h0.left);
    }
    // Schilder und Knöpfe im Bild (links die Seitenleiste, unten Zeit und Bauen): Was darunter liegt,
    // sieht man nicht; ein Kreis darauf säße auf dem Schild (iPhone: erste Boje unter „Ausbau“)
    const deck = [];
    for (const el of document.querySelectorAll('#hm-seite > *, #hm-zeit, #btn-build, #btn-collect, .hm-banner')) {
      if (!sichtbar(el)) continue;
      const q = el.getBoundingClientRect();
      // 30 px Abstand: ein Tipp auf den Kreis eines fahrenden Bootes trifft sonst das Schild daneben
      deck.push({ l: q.left - h0.left - 30, t: q.top - h0.top - 30, r: q.right - h0.left + 30, u: q.bottom - h0.top + 30 });
    }
    letztesDeck = deck;
    return { l: l + rand, t: t + rand, r: r - rand, u: u - rand, deck };
  }
  const imBild = (p, f) => p && p.x >= f.l && p.x <= f.r && p.y >= f.t && p.y <= f.u
    && !(f.deck ?? []).some((d) => p.x > d.l && p.x < d.r && p.y > d.t && p.y < d.u);

  // Das erste wartende Boot, das wirklich im Bild liegt (nicht eines, das noch von draußen anfährt)
  function sichtbaresBoot() {
    const f = freieFlaeche();
    const w = new Set(api.waitingBoats().map((b) => b.id));
    for (const o of objekte('boat', (pk) => w.has(Number(String(pk.id).replace(/^b/, ''))))) {
      const p = aufBildschirm(o);
      if (imBild(p, f)) return { ...p, obj: o };
    }
    return null;
  }

  function ziel(id) {
    switch (id) {
      case 'willkommen': {
        // Kreis um die erste Warteboje, die im Bild liegt
        const f = freieFlaeche(0);
        const bojen = game.landscape?.warteplaetze?.bojen ?? [];
        const anzahl = api.waitSpotCount?.() ?? bojen.length;
        for (const b of bojen.slice(0, anzahl)) {
          const punkt = new THREE.Vector3(b.x, 0.4, b.z);
          const p = punktAufBildschirm(punkt);
          if (imBild(p, f)) return { ...p, w: 60, h: 60, punkt };
        }
        return null;
      }
      case 'anlegen': {
        const p = sichtbaresBoot();
        return p ? { ...p, w: 76, h: 76 } : null;
      }
      case 'muenzen': {
        // Die Münze im Bild, die am nächsten zur Bildmitte liegt
        const f = freieFlaeche(0);
        const c = { x: (f.l + f.r) / 2, y: (f.t + f.u) / 2 };
        let best = null;
        for (const m of muenzen()) {
          const p = aufBildschirm(m);
          if (imBild(p, f) && (!best || Math.hypot(p.x - c.x, p.y - c.y) < Math.hypot(best.x - c.x, best.y - c.y))) best = { ...p, obj: m };
        }
        if (best) return { ...best, w: 64, h: 64 };
        // Noch keine Münze: Das Boot fährt von der Boje in die Box, die Münze kommt, wenn es fest ist.
        // Bis dahin zeigt der Kreis auf das anlegende Boot, sonst (mit Hafenbüro) auf „Kassieren“.
        const boot = zahlendesBoot();
        if (boot) {
          const p = aufBildschirm(boot);
          if (imBild(p, f)) return { ...p, w: 76, h: 76, obj: boot };
        }
        return domKreis(document.getElementById('btn-collect'), 6);
      }
      // Vorspulen: Zeitsteuerung unten links (Doppelpfeil)
      case 'tempo': return domKreis(document.querySelector('.hm-tempo-knopf[data-tempo="tempo2"]'), 6);
      case 'bauen': return domKreis(document.getElementById('btn-build'), 6);
      case 'ziele': return domKreis(document.querySelector('.hm-tafel > button'), 6);
      default: return null;
    }
  }

  let willkommenSeit = 0;
  function lage() {
    const s = st();
    return {
      tag: s.day,
      // Nur suchen, solange es gebraucht wird: die Suche geht über die ganze Szene
      bootImBild: einstiegState(s).erledigt.includes('anlegen') ? false : !!sichtbaresBoot(),
      willkommenSek: aktuell === 'willkommen' ? (performance.now() - willkommenSeit) / 1000 : 0,
      abend: s.phase === 'evening',
      muenzen: Object.values(s.boats).some((b) => b.status === 'moored' && b.pendingFee > 0),
      bauenSichtbar: sichtbar(document.getElementById('btn-build')),
      tafelSichtbar: sichtbar(document.querySelector('.hm-tafel > button')),
      ohneZiele: QUER.matches,
      // Karte oder Baumodus offen: keine neuen Hinweise darüberlegen
      karteOffen: document.body.classList.contains('card-open') || document.body.classList.contains('building'),
    };
  }

  // ---------------------------------------------------------------- Sprechblase
  function zeige(id) {
    const vorher = aktuell;
    aktuell = id;
    // Andere Hinweise (z. B. "Als Nächstes" beim Bauen) warten auf das Ende des Einstiegs: Bescheid geben
    if (vorher !== id) {
      game.emit('einstieg:schritt', { schritt: id });
      game.emit('sim:change', { reason: 'einstieg' });
    }
    if (id === 'willkommen') willkommenSeit = performance.now();
    // Meldungs-Ordnung (ui/meldungen.js): Zettel, Kartenwahl, Feier und Dauerplatz-Meldungen gehen vor
    if (!id) { game.meldungen?.fertig('einstieg'); tipp.hidden = true; ring.hidden = true; return; }
    game.meldungen?.wunsch('einstieg', id.startsWith('hinweis:') ? VORRANG.tipp : VORRANG.einstieg);
    const t = TEXTE[id];
    const nr = REIHENFOLGE.indexOf(id) + 1;
    const info = id === 'tempo' || id === 'bauen' || id === 'ziele';
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
    p.className = 'lang';
    const pk = document.createElement('p'); pk.className = 'kurz'; pk.textContent = t.kurz ?? t.text;
    tipp.append(z, h, p, pk, k);
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
    // Tipps beim ersten Mal lassen die linke Spalte (Wetter, Tagesziel, Ausbau) frei: daneben stellen,
    // wenn dort genug Platz ist (Querformat, Tablet, PC), sonst wie die Schritte darunter
    const istHinweis = !!aktuell?.startsWith('hinweis:');
    tipp.classList.toggle('hinweis', istHinweis);   // zuerst: im Querformat bleibt die Spalte dann sichtbar
    let rechts = h.width - 12;
    for (const el of document.querySelectorAll('#hud-top button, #hud-top .hud-btn')) {
      if (!sichtbar(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.left - h.left > h.width * 0.6 && r.top - h.top > 40) rechts = Math.min(rechts, r.left - h.left - 8);
    }
    let seite = 0;
    if (istHinweis) {
      for (const el of document.querySelectorAll('#hm-seite > *')) {
        if (!sichtbar(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.left - h.left < h.width * 0.4) seite = Math.max(seite, r.right - h.left);
      }
    }
    const nebenSeite = seite > 0 && rechts - seite - 20 >= 220;
    const oben = Math.max(unterkante('#hud-top'), nebenSeite ? 0 : Math.max(unterkante('#weather-chip'), unterkante('.hm-tafel > button'), unterkante('#hm-seite')), 8) + 10;
    let unten = h.height - 12;
    for (const sel of ['#btn-build', '#btn-collect', '#hud-bottom', '#hm-zeit', '#card', '.hm-banner']) {
      const el = document.querySelector(sel);
      if (sichtbar(el)) unten = Math.min(unten, el.getBoundingClientRect().top - h.top - 12);
    }
    // Querformat (flaches Handy): liegt das Ziel links, steht die Blase rechts, sonst links
    const rechtsStehen = h.height < 500 && k && k.x < h.width * 0.6;
    let breite = rechtsStehen ? Math.min(300, rechts - 12) : Math.min(360, rechts - 12);
    let links = rechtsStehen ? rechts - breite : null;
    if (nebenSeite) {
      links = seite + 10;
      breite = Math.min(rechtsStehen ? 300 : 360, rechts - links - 10);
    }
    tipp.style.width = `${Math.round(breite)}px`;
    tipp.style.left = links != null ? `${Math.round(links)}px` : '';
    // Handy: immer die Kurzfassung, damit der Hafen frei bleibt
    tipp.classList.toggle('eng', h.width < 600 || h.height < 560);
    let hoehe = tipp.offsetHeight;
    const lx = links ?? 12;
    const trifft = (y) => k && k.y + k.h / 2 > y - 6 && k.y - k.h / 2 < y + hoehe + 6 && k.x + k.w / 2 > lx && k.x - k.w / 2 < lx + tipp.offsetWidth;
    const deckung = (y) => (k ? Math.max(0, Math.min(k.y + k.h / 2, y + hoehe) - Math.max(k.y - k.h / 2, y)) : 0);
    const yUnten = Math.max(oben, unten - hoehe);
    let y = oben;
    if (trifft(oben) && deckung(yUnten) < deckung(oben)) y = yUnten;
    // Verdeckt die Blase oben wie unten das Ziel (kleines Handy), reicht die Kurzfassung
    if (trifft(y)) {
      tipp.classList.add('eng');
      hoehe = tipp.offsetHeight;
      const yU = Math.max(oben, unten - hoehe);
      y = !trifft(oben) ? oben : !trifft(yU) ? yU : (deckung(yU) < deckung(oben) ? yU : oben);
    }
    tipp.style.top = `${Math.round(y)}px`;
  }

  // ---------------------------------------------------------------- Ablauf
  function schritt(id) {
    const e = einstiegState(st());
    erledige(e, id);
    if (id === aktuell) zeige(null);
    if (e.fertig) game.emit('einstieg:ende', {});
  }
  function beenden() {
    const e = einstiegState(st());
    e.fertig = true;
    zeige(null);
    game.emit('einstieg:ende', {});
  }

  // Während Willkommen und Anlegen fahren wartende Boote nicht von selbst ein (sim.selfEnter),
  // damit der Spieler das erste Boot wirklich selbst einweisen kann. Danach wieder freigeben.
  const gehalten = new Set();
  function halte(an) {
    if (!api.holdBoat) return;
    if (an) {
      for (const b of api.waitingBoats()) if (!b.held) { api.holdBoat(b.id, true); gehalten.add(b.id); }
    } else if (gehalten.size) {
      for (const id of gehalten) if (id !== api.selected) api.holdBoat(id, false);
      gehalten.clear();
    }
  }

  // Entscheiden (Schritt, Ziel, Lage der Blase) fünfmal pro Sekunde; in jedem Bild nur den Kreis
  // einem bewegten 3D-Ziel nachführen. So kostet der Einstieg auch auf langsamen Geräten kaum Zeit.
  const TAKT_MS = 200;
  let naechsteEntscheidung = 0;
  let k = null;
  let zuletztZiehen = false;

  // Liegt das wartende Boot außerhalb des Bildes (Handy quer, PC), fährt die Kamera einmal hin,
  // damit Schritt 2 beginnen kann. Höchstens dreimal, damit sie dem Spieler nicht hinterherzieht.
  let fluege = 0;
  let letzterFlug = -Infinity;
  function zumBoot(ids) {
    // Bei angehaltener Zeit schaut der Spieler selbst: die Kamera nicht wegziehen
    if (ziehen || game.paused || fluege >= 3 || !game.camera?.flyTo || !ids.size) return;
    const jetzt = performance.now();
    if (jetzt - letzterFlug < 5000) return;
    const o = objekte('boat', (pk) => ids.has(bootNr(pk)))[0];
    if (!o) return;
    const pos = o.getWorldPosition(new THREE.Vector3());
    game.camera.flyTo(pos.x, pos.z);
    fluege += 1;
    letzterFlug = jetzt;
  }

  // Schritt 2: Boot und ein freier Platz sollen beide im Bild sein (Handy quer liegt der Steg sonst
  // unter dem Rand). Einmal pro Schritt: liegt der nächste freie Platz außerhalb, fährt die Kamera
  // auf die Mitte zwischen beiden.
  let gerahmt = false;
  function rahmeBootUndPlatz() {
    const boot = sichtbaresBoot();
    if (!boot || ziehen || game.paused || !game.camera?.flyTo) return;
    gerahmt = true;
    const bp = boot.obj.getWorldPosition(new THREE.Vector3());
    let best = null;
    const frei = [];
    game.scene.traverseVisible((o) => {
      const pk = o.userData?.pick;
      if (pk?.type !== 'berth' || api.platzZustand?.(pk.id) !== 'frei') return;
      const w = o.getWorldPosition(new THREE.Vector3());
      const d = Math.hypot(w.x - bp.x, w.z - bp.z);
      frei.push(w);
      if (!best || d < best.d) best = { d, w, o };
    });
    if (!best) return;
    // Mitte der freien Plätze in der Nähe des nächsten (ein Steg), nicht nur der eine Platz
    const nah = frei.filter((w) => Math.hypot(w.x - best.w.x, w.z - best.w.z) < 30);
    const mx = nah.reduce((a, w) => a + w.x, 0) / nah.length;
    const mz = nah.reduce((a, w) => a + w.z, 0) / nah.length;
    // Flaches Querformat: immer mittig rahmen, der Steg liegt dort sonst knapp über dem Rand
    const f = freieFlaeche(60);
    if (!QUER.matches && imBild(punktAufBildschirm(best.w), f)) return;
    game.camera.flyTo((bp.x + mx) / 2, (bp.z + mz) / 2);
  }

  function setzeKreis() {
    ring.style.width = `${Math.round(k.w)}px`;
    ring.style.height = `${Math.round(k.h)}px`;
    ring.style.borderRadius = k.rund ? `${Math.round(k.rund)}px` : '50%';
    // left/top statt transform: die Puls-Animation (scale) würde sonst den Versatz mit vergrößern
    ring.style.left = `${Math.round(k.x - k.w / 2)}px`;
    ring.style.top = `${Math.round(k.y - k.h / 2)}px`;
  }

  // ------------------------------------------------------------ Hinweise beim ersten Mal (J6)
  const offeneHinweise = [];
  let hinweisBis = 0;
  for (const name of ['sim:turnedAway', 'sim:stageReady', 'stammgast:neu']) {
    game.on(name, (d) => { const e = st() && einstiegState(st()); if (e) merkeHinweis(e, hinweisFuer(name, d), offeneHinweise); });
  }
  function schliesseHinweis() {
    if (!aktuell?.startsWith('hinweis:')) return;
    zeige(null);
    game.emit('einstieg:ende', {});
  }
  const darf = () => !game.meldungen || game.meldungen.darf('einstieg');
  function hinweisTakt(e) {
    const ruhig = !document.body.classList.contains('card-open') && !document.body.classList.contains('building') && !document.body.classList.contains('foto') && !document.body.classList.contains('hm-feier-an');
    if (aktuell?.startsWith('hinweis:')) {
      if (performance.now() > hinweisBis) { schliesseHinweis(); return; }
      tipp.hidden = !ruhig || !darf();
      // Solange eine andere Meldung vorgeht, läuft die Zeit des Tipps nicht ab
      if (tipp.hidden) hinweisBis = Math.max(hinweisBis, performance.now() + 8000);
      const id = aktuell.slice(8);
      k = id === 'stufe' ? domKreis(document.getElementById('btn-build'), 6) : null;
      ring.hidden = !k || tipp.hidden;
      if (k) setzeKreis();
      if (!tipp.hidden) lege(k);
      return;
    }
    // Nacheinander statt gleichzeitig: erst anfangen, wenn keine wichtigere Meldung steht (ui/meldungen.js)
    const frei = !game.meldungen || game.meldungen.stand().vorrang < VORRANG.tipp;
    if (aktuell || !offeneHinweise.length || !ruhig || !frei) return;
    const id = offeneHinweise.shift();
    e.hinweise ||= [];
    e.hinweise.push(id);   // gilt als gesehen, auch wenn der Spieler gleich neu lädt
    zeigeHinweis(id);
    hinweisBis = performance.now() + 20000;
  }
  function zeigeHinweis(id) {
    const t = HINWEISE[id];
    aktuell = `hinweis:${id}`;
    game.meldungen?.wunsch('einstieg', VORRANG.tipp);
    game.emit('einstieg:schritt', { schritt: aktuell });
    tipp.replaceChildren();
    const z = document.createElement('div'); z.className = 'zaehler'; z.textContent = 'Tipp';
    const h = document.createElement('p'); h.className = 'titel'; h.textContent = t.titel;
    const p = document.createElement('p'); p.className = 'lang'; p.textContent = t.text;
    const pk = document.createElement('p'); pk.className = 'kurz'; pk.textContent = t.kurz;
    const kn = document.createElement('div'); kn.className = 'knoepfe';
    const w = document.createElement('button');
    w.type = 'button'; w.className = 'weiter'; w.textContent = 'Verstanden';
    w.addEventListener('click', schliesseHinweis);
    kn.append(w);
    tipp.append(z, h, p, pk, kn);
    tipp.hidden = false;
    try { game.audio?.sfx?.('hinweis'); } catch { /* Ton ist nicht wichtig */ }
  }

  function entscheide() {
    // Überblicksflug beim Laden (main.js, body.hm-ueberblick): nichts zeigen, Willkommen zählt erst danach
    if (document.body.classList.contains('hm-ueberblick')) {
      tipp.hidden = true; ring.hidden = true; k = null;
      willkommenSeit = performance.now();
      return;
    }
    const e = st() && einstiegState(st());
    if (!e || e.fertig) {
      halte(false);
      if (aktuell && !aktuell.startsWith('hinweis:')) { zeige(null); game.emit('einstieg:ende', {}); }   // auch beim Ende nach Tagesziele oder nach einem Spieltag
      k = null;
      if (e) hinweisTakt(e);
      return;
    }
    const l = lage();
    const id = naechsterSchritt(e, l);
    halte(!e.erledigt.includes('anlegen'));
    // Kein wartendes Boot frei im Bild (noch draußen oder hinter einem Schild): Kamera hinfahren
    const sucheBoot = (id === 'willkommen' && l.willkommenSek >= WILLKOMMEN_SEK)
      || (!id && e.erledigt.includes('willkommen') && !e.erledigt.includes('anlegen') && !l.abend);
    if (sucheBoot && !l.bootImBild) zumBoot(new Set(api.waitingBoats().map((b) => b.id)));
    // Wer schon vorspult, kennt die Zeitsteuerung: der Hinweis würde nur kurz aufblitzen
    if (id === 'tempo' && (game.speed || 1) > 1) { schritt('tempo'); return; }
    if (id !== aktuell) { zeige(id); fluege = 0; gerahmt = false; }
    if (id === 'anlegen' && !gerahmt) rahmeBootUndPlatz();
    k = id ? ziel(id) : null;
    if (!id) return;
    if (id === 'muenzen' && !k) zumBoot(zahlendeIds());
    // Ist die Bootskarte offen, sagt sie selbst, was zu tun ist; der Text würde nur die Stege verdecken
    tipp.hidden = ziehen || (id === 'anlegen' && document.body.classList.contains('card-open')) || !darf();
    ring.hidden = !k || ziehen || !darf();
    if (k) setzeKreis();
    if (!tipp.hidden) lege(k);
  }

  function frame(t) {
    requestAnimationFrame(frame);
    // Kommt eine wichtigere Meldung (Zettel, Kartenwahl, Feier), tritt die Blase sofort zurück, nicht erst beim nächsten Takt
    if (!tipp.hidden && !darf()) { tipp.hidden = true; ring.hidden = true; }
    if (t >= naechsteEntscheidung || ziehen !== zuletztZiehen) {
      naechsteEntscheidung = t + TAKT_MS;
      zuletztZiehen = ziehen;
      entscheide();
      return;
    }
    if (!k || ring.hidden || !(k.obj || k.punkt)) return;
    const p = k.obj ? aufBildschirm(k.obj) : punktAufBildschirm(k.punkt);
    if (!p) return;
    // Fährt das Boot unter ein Schild, verschwindet der Kreis bis zur nächsten Entscheidung
    if (letztesDeck.some((d) => p.x > d.l && p.x < d.r && p.y > d.t && p.y < d.u)) { ring.hidden = true; return; }
    k.x = p.x; k.y = p.y;
    setzeKreis();
  }

  game.on('meldungen:wechsel', () => { if (!tipp.hidden && !darf()) { tipp.hidden = true; ring.hidden = true; } });
  game.on('sim:moored', () => schritt('anlegen'));
  game.on('sim:collected', () => schritt('muenzen'));
  document.getElementById('btn-build')?.addEventListener('click', () => { if (aktuell === 'bauen') schritt('bauen'); });
  game.on('ui:tow', () => { ziehen = true; });
  game.on('ui:tow-end', () => { ziehen = false; });
  game.on('ui:vorspulen', ({ speed } = {}) => { if (speed > 1 && aktuell === 'tempo') schritt('tempo'); });
  window.addEventListener('pointerup', () => { ziehen = false; }, true);
  window.addEventListener('pointercancel', () => { ziehen = false; }, true);

  Object.assign(schnittstelle, {
    start() { st().modules ||= {}; const alt = st().modules.einstieg?.hinweise ?? []; st().modules.einstieg = { fertig: false, erledigt: [], hinweise: alt }; zeige(null); },
    beenden,
    schritt: () => aktuell,
  });
  game.einstieg = schnittstelle;
  if (vorher) schnittstelle[vorher]();
  requestAnimationFrame(frame);
}
