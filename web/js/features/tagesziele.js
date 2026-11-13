// Tagesziele an der Tafel: jeden Tag drei kleine Ziele, die zur Stufe passen.
// Beschreibung in docs/neue-features.md, Abschnitt 6.
//
// - Ziele nur aus Dingen, die man in der Stufe schon kann. Kein Druck: Was abends nicht geschafft ist,
//   verfällt still. Geschaffte Ziele bringen einen kleinen Betrag, einen Haken und einen Ton.
// - Die Logik (ohne init) läuft ohne Browser: neueZiele(), werteAus() (tests/tagesziele.test.mjs).
// - Spielstand: state.modules.ziele = { tag, liste: [{ art, soll, ist, erledigt, belohnung, extra }] }
// - Ereignisse: 'ziel:erreicht' { art, text, belohnung } für Ton und Anzeige.

import * as sim from '../sim.js';
import { random } from '../random.js';
import { regelnBereit } from './regeln-bereit.js';
import { ECONOMY } from '../data/economy.js';

// Zahlen in data/economy.js (ECONOMY.tagesziele)
const T = ECONOMY.tagesziele;
export const BELOHNUNG = T.belohnung;

// Vorlagen: ab welcher Stufe, wie viel verlangt wird, und woran man es erkennt
export const VORLAGEN = {
  unterbringen: { abStufe: 1, soll: (st, ctx) => Math.max(T.unterbringenMin, Math.round((ctx.rules.arrivalsPerDay[st.stage] || 3) * T.unterbringenAnteil)) },
  segler: { abStufe: 2, soll: (st) => stufenWert(T.seglerSoll, st.stage) },
  zufrieden: { abStufe: 1, soll: () => 1 },
  kassieren: { abStufe: 1, soll: (st, ctx) => runde5(erwartetesGeld(st, ctx) * T.kassierenAnteil) },
  groesse: { abStufe: 3, soll: () => 1 },
  stammgast: { abStufe: 1, soll: () => 1, nur: (st) => (st.modules?.stamm?.liste?.length ?? 0) > 0 },
  voll: { abStufe: 1, soll: () => 1, nur: (st, ctx) => sim.availableBerths(st, ctx).length <= T.vollBisPlaetze },
};

const GROESSE_ZIEL = T.groesse;

/** Wert für eine Stufe aus { ab Stufe: Wert }: der Eintrag der höchsten erreichten Stufe. */
function stufenWert(tabelle, stufe) {
  let wert;
  for (const [ab, w] of Object.entries(tabelle)) if (stufe >= Number(ab)) wert = w;
  return wert;
}

function runde5(x) { return Math.max(5, Math.round(x / 5) * 5); }

function erwartetesGeld(state, ctx) {
  const mix = ctx.rules.sizeMix[state.stage] || { S: 1 };
  let schnitt = 0;
  for (const [g, w] of Object.entries(mix)) schnitt += w * (ctx.rules.baseFee[g] || 0);
  return (ctx.rules.arrivalsPerDay[state.stage] || 3) * schnitt;
}

export function zielState(state) {
  state.modules ||= {};
  state.modules.ziele ||= { tag: 0, liste: [] };
  return state.modules.ziele;
}

/** Kurzer Text für die Tafel. */
export function text(z) {
  switch (z.art) {
    case 'unterbringen': return `${z.soll} Boote unterbringen`;
    case 'segler': return `${z.soll} Segelboote unterbringen`;
    case 'zufrieden': return 'Alle Wünsche eines Boots erfüllen (ab 2 Wünschen)';
    case 'kassieren': return `${z.soll} € Hafengeld kassieren`;
    case 'groesse': return `Ein ${z.extra}-Schiff unterbringen`;
    case 'stammgast': return 'Einen Stammgast unterbringen';
    case 'voll': return 'Alle Plätze gleichzeitig belegt';
    default: return z.art;
  }
}

/** Drei neue Ziele für den aktuellen Tag. Im Winter (keine Gäste) keine Ziele. */
export function neueZiele(state, ctx) {
  const z = zielState(state);
  z.tag = state.day;
  z.liste = [];
  if (sim.season(state, ctx).winter) return z.liste;
  const arten = Object.entries(VORLAGEN)
    .filter(([, v]) => v.abStufe <= state.stage && (!v.nur || v.nur(state, ctx)))
    .map(([k]) => k);
  const belohnung = BELOHNUNG[state.stage] ?? BELOHNUNG[1];
  while (z.liste.length < 3 && arten.length) {
    const i = Math.floor(random(state) * arten.length);
    const art = arten.splice(i, 1)[0];
    const ziel = { art, soll: VORLAGEN[art].soll(state, ctx), ist: 0, erledigt: false, belohnung };
    if (art === 'groesse') ziel.extra = GROESSE_ZIEL[state.stage] || 'L';
    z.liste.push(ziel);
  }
  return z.liste;
}

/**
 * Ein Ereignis der Regeln auswerten (die Objekte aus sim.js, z. B. { type: 'moored', boatId, berthId }).
 * Gibt die Ziele zurück, die dadurch gerade erreicht wurden. Die Belohnung bucht der Aufrufer.
 */
export function werteAus(state, ctx, e) {
  const z = zielState(state);
  if (z.tag !== state.day) return [];
  const boot = e.boatId != null ? state.boats[e.boatId] : null;
  const fertig = [];
  for (const ziel of z.liste) {
    if (ziel.erledigt) continue;
    let plus = 0;
    if (e.type === 'moored' && boot && !boot.stationed) {
      if (ziel.art === 'unterbringen') plus = 1;
      if (ziel.art === 'segler' && ctx.typeById[boot.typeId]?.sail) plus = 1;
      if (ziel.art === 'groesse' && boot.size === ziel.extra) plus = 1;
      if (ziel.art === 'stammgast' && (boot.besuche ?? 1) > 1) plus = 1;
    }
    if (e.type === 'moored' && ziel.art === 'voll') {
      const frei = sim.availableBerths(state, ctx).filter((b) => sim.isFree(state, b.id) && !b.reserved);
      if (!frei.length) plus = 1;
    }
    if (e.type === 'feeReady' && ziel.art === 'zufrieden' && boot) {
      const met = Array.isArray(e.wishesMet) ? e.wishesMet.length : e.wishesMet;
      if (boot.wishes.length >= 2 && met === boot.wishes.length) plus = 1;
    }
    if (e.type === 'collected' && ziel.art === 'kassieren') plus = e.amount || 0;
    if (!plus) continue;
    ziel.ist = Math.min(ziel.soll, ziel.ist + plus);
    if (ziel.ist >= ziel.soll) { ziel.erledigt = true; fertig.push(ziel); }
  }
  return fertig;
}

// ---------------------------------------------------------------------------
// Im Browser: die Tafel als kleine Leiste unter der oberen Leiste

const CSS = `
.hm-tafel { position: absolute; left: calc(12px + env(safe-area-inset-left, 0px)); z-index: 5;
  top: var(--hm-tafel-top, 64px);
  font: 600 14px system-ui, sans-serif; color: #283648; }
.hm-tafel > button { min-height: 44px; padding: 0 14px; border: 0; border-radius: 22px; cursor: pointer;
  background: rgba(255,252,246,.92); color: #283648; font: inherit; box-shadow: 0 2px 8px rgba(0,0,0,.12); }
.hm-tafel ul { list-style: none; margin: 6px 0 0; padding: 8px 12px; border-radius: 12px; max-width: 300px;
  background: rgba(255,252,246,.95); box-shadow: 0 2px 8px rgba(0,0,0,.12); }
.hm-tafel li { display: flex; gap: 8px; align-items: baseline; padding: 4px 0; }
.hm-tafel li .haken { width: 18px; flex: none; text-align: center; }
.hm-tafel li.erledigt { color: #3f8f55; }
.hm-tafel li.erledigt .t { text-decoration: line-through; }
.hm-tafel .stand { margin-left: auto; font-variant-numeric: tabular-nums; opacity: .8; }
.hm-tafel.jubel > button { animation: hm-tafel-jubel .8s ease-out; }
@keyframes hm-tafel-jubel { 0% { transform: scale(1); } 30% { transform: scale(1.15); background: #f2c14e; } 100% { transform: scale(1); } }
body.hm.foto .hm-tafel { display: none; }
`;

export async function init(game) {
  const api = await regelnBereit(game);
  const st = () => api.state;

  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const tafel = document.createElement('div');
  tafel.className = 'hm-tafel';
  const knopf = document.createElement('button');
  knopf.type = 'button';
  knopf.setAttribute('aria-expanded', 'false');
  const liste = document.createElement('ul');
  liste.hidden = true;
  tafel.append(knopf, liste);
  (document.getElementById('game') || document.body).appendChild(tafel);

  // Unter die obere Leiste, und unter den Wetter-Knopf, falls der links auf derselben Höhe steht (Handy)
  function lage() {
    let unten = document.getElementById('hud-top')?.getBoundingClientRect().bottom ?? 56;
    const wetter = document.getElementById('weather-chip');
    if (wetter && !wetter.hidden) {
      const r = wetter.getBoundingClientRect();
      if (r.width && r.left < 320 && r.top < unten + 60) unten = Math.max(unten, r.bottom);
    }
    tafel.style.setProperty('--hm-tafel-top', `${Math.round(unten + 8)}px`);
  }
  game.on('resize', lage);
  window.addEventListener('resize', lage);
  lage();
  setTimeout(lage, 500);   // andere Module bauen ihre Knöpfe teils erst nach dem Start

  knopf.addEventListener('click', () => {
    liste.hidden = !liste.hidden;
    knopf.setAttribute('aria-expanded', String(!liste.hidden));
  });
  // Antippen der Karte klappt die Tafel wieder zu, damit sie keine Bojen verdeckt
  game.on('tap', () => { liste.hidden = true; knopf.setAttribute('aria-expanded', 'false'); });

  function zeichne() {
    const z = zielState(st());
    // Kein totes Element: ohne Ziele (Winter) keine Tafel
    tafel.hidden = !z.liste.length;
    const fertig = z.liste.filter((x) => x.erledigt).length;
    knopf.textContent = `Tagesziele ${fertig}/${z.liste.length}`;
    knopf.setAttribute('aria-label', `Tagesziele: ${fertig} von ${z.liste.length} geschafft`);
    liste.replaceChildren(...z.liste.map((x) => {
      const li = document.createElement('li');
      if (x.erledigt) li.className = 'erledigt';
      const h = document.createElement('span'); h.className = 'haken'; h.textContent = x.erledigt ? '✓' : '○';
      const t = document.createElement('span'); t.className = 't'; t.textContent = text(x);
      const s = document.createElement('span'); s.className = 'stand';
      s.textContent = x.erledigt ? `+${x.belohnung} €` : x.art === 'kassieren' ? `${x.ist}/${x.soll} €` : `${x.ist}/${x.soll}`;
      li.append(h, t, s);
      return li;
    }));
  }

  function pruefeTag() {
    const z = zielState(st());
    if (z.tag !== st().day) { neueZiele(st(), api.ctx); zeichne(); }
  }

  const ARTEN = ['moored', 'feeReady', 'collected'];
  for (const typ of ARTEN) {
    game.on(`sim:${typ}`, (e) => {
      pruefeTag();
      const fertig = werteAus(st(), api.ctx, e);
      for (const ziel of fertig) {
        api.addIncome(ziel.belohnung);
        game.emit('ziel:erreicht', { art: ziel.art, text: text(ziel), belohnung: ziel.belohnung });
        tafel.classList.remove('jubel'); void tafel.offsetWidth; tafel.classList.add('jubel');
        if (navigator.vibrate) navigator.vibrate([20, 40, 20]);
      }
      zeichne();
    });
  }
  game.on('sim:dayStart', () => { pruefeTag(); zeichne(); });
  game.on('spielstand-geladen', () => { pruefeTag(); zeichne(); });
  game.on('sim:change', () => { pruefeTag(); zeichne(); });
  pruefeTag();
  zeichne();

  game.tagesziele = { liste: () => zielState(st()).liste, text };
}
