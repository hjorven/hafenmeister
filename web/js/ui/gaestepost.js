// Gästepost an der Pinnwand im Hafenbüro (Roadmap P25, F37, docs/stammgaeste.md).
//
// - Regeln in features/gaestepost.js (Karten schreiben, ankommen, angekündigter Besuch, Freunde).
// - Kommt Post an (Ereignis 'sim:postNeu'), steht im Meldeplatz kurz „Post von „Möwe“ aus Kappeln“;
//   antippen öffnet das Gästebuch bei der Pinnwand.
// - Die Pinnwand ist der oberste Teil des Gästebuchs (Hafenbüro oder Hafenmeister-Haus antippen, Ruf
//   oben links, Menü, Taste N): Karten mit Text und Stand, darunter die Stammgäste mit Besuchen,
//   Treuewimpeln und Lieblingsplatz. Ungelesene Post zeigt ein kleiner Brief am Ruf.
//
// Schnittstelle: game.gaestepost = { abschnitt(), ungelesen(), karten() }

import { regelnBereit } from '../features/regeln-bereit.js';
import { haengeEin, postState, ungelesen, allesGelesen, kartenText, kartenStand, POST } from '../features/gaestepost.js';
import { stammState, istStamm, treuewimpel } from '../features/stammgaeste.js';
import { VORRANG } from './meldungen.js';
import { WUNSCH_TEXTE } from '../data/wuensche-texte.js';

const MELDUNG_ID = 'post';
const MELDUNG_DAUER = 4200;

// Pixel-Symbole 12 x 12: Brief mit Stempel und Doppelstander (wie der Treuewimpel am Boot)
const BRIEF = ['............', '############', '##........##', '#.#......#.#', '#..#....#..#', '#...#..#...#', '#....##.....', '#..........#', '#..........#', '#..........#', '############', '............'];
const STANDER = ['............', '.#..........', '.#######....', '.#########..', '.##########.', '.########...', '.#######....', '.##########.', '.#########..', '.#######....', '.#..........', '.#..........'];

function svg(raster) {
  let r = '';
  raster.forEach((z, y) => [...z].forEach((c, x) => { if (c === '#') r += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="black"/>`; }));
  return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" shape-rendering="crispEdges">${r}</svg>`)}")`;
}

function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'onclick') e.addEventListener('click', v);
    else if (k === 'style') e.setAttribute('style', v);
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c);
  return e;
}
const sym = (name, cls = '') => el('i', { class: `hm-post-sym ${cls}`.trim(), 'aria-hidden': 'true', style: `--post-sym: var(--px-post-${name})` });
const wunschName = (w) => WUNSCH_TEXTE[w]?.mit ?? w;

export async function init(game) {
  if (typeof document === 'undefined') return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('../../css/gaestepost.css', import.meta.url).href;
  document.head.append(link);
  document.head.append(el('style', { id: 'hm-post-grafik' }, `:root { --px-post-brief: ${svg(BRIEF)}; --px-post-stander: ${svg(STANDER)}; }`));

  const st = () => game.sim?.state;

  // ---------------------------------------------------------------- Pinnwand (im Gästebuch)
  function abschnitt() {
    const s = st();
    if (!s || !POST) return null;
    const p = postState(s);
    const karten = p.karten;
    const teil = el('div', { class: 'hm-gb-post', id: 'hm-pinnwand' }, el('h3', {}, sym('brief'), 'Pinnwand im Hafenbüro'));
    if (karten.length) {
      const ul = el('ul', { class: 'hm-post-karten' });
      for (const k of karten) {
        ul.append(el('li', { class: `hm-post-karte ${k.gelesen ? '' : 'neu'} ${k.stand}`.trim() },
          el('div', { class: 'hm-post-kopf' },
            el('b', {}, `„${k.bootsname}“`), el('span', {}, ` aus ${k.heimathafen ?? 'der Ferne'} · Tag ${k.ankunft}`),
            el('span', { class: `hm-post-stand ${k.stand}` }, kartenStand(k, s.day))),
          el('q', {}, kartenText(k, s.day, wunschName))));
      }
      teil.append(ul);
    } else {
      teil.append(el('p', { class: 'hm-gb-klein' }, 'Stammgäste schreiben hierher, wenn es ihnen gefallen hat: wann sie wiederkommen oder welche Freunde sie schicken.'));
    }
    // Die Stammgäste: wer am öftesten da war zuerst
    const stamm = stammState(s).liste.filter(istStamm).sort((a, b) => b.besuche - a.besuche || b.zuletzt - a.zuletzt);
    if (stamm.length) {
      const ol = el('ul', { class: 'hm-post-stamm' });
      for (const g of stamm.slice(0, 8)) {
        const w = treuewimpel({ stammId: g.stammId, besuche: g.besuche });
        ol.append(el('li', {},
          el('span', { class: 'hm-post-wimpel', title: w ? `${w} Treuewimpel` : 'Stammgast' }, ...Array.from({ length: Math.max(1, w) }, () => sym('stander', w ? '' : 'leer'))),
          el('span', { class: 'hm-post-name' }, el('b', {}, `„${g.bootsname}“`), ` ${g.name ?? ''}`),
          el('span', { class: 'hm-post-zahl' }, `${g.besuche} Besuche${g.lieblingsplatz ? ` · Box ${g.lieblingsplatz}` : ''}`)));
      }
      teil.append(el('h3', { class: 'hm-post-unter' }, `Stammgäste (${stamm.length})`), ol);
      if (stamm.length > 8) teil.append(el('p', { class: 'hm-gb-klein' }, `und ${stamm.length - 8} weitere`));
    }
    // Angesehen: gelesen
    if (ungelesen(s)) { allesGelesen(s); setTimeout(briefZeichen, 0); }
    return teil;
  }

  // ---------------------------------------------------------------- Brief am Ruf und in der Menüzeile
  function briefZeichen() {
    const n = st() ? ungelesen(st()) : 0;
    // Neben dem Ruf (dessen Text schreibt die Leiste jedes Mal neu); antippen öffnet die Pinnwand
    const rep = document.getElementById('rep');
    if (rep?.parentElement) {
      let b = rep.parentElement.querySelector(':scope > .hm-post-brief');
      if (n && !b) {
        b = el('button', { type: 'button', class: 'hm-post-brief', title: 'Neue Post im Hafenbüro', 'aria-label': 'Neue Post im Hafenbüro, Pinnwand öffnen',
          onclick: (e) => { e.stopPropagation(); oeffnePinnwand(); } }, sym('brief'));
        rep.insertAdjacentElement('afterend', b);
      }
      if (!n && b) b.remove();
    }
    const zeile = document.getElementById('btn-gaestebuch');
    if (zeile) {
      let z = zeile.querySelector('.hm-post-zahl-menue');
      if (n && !z) { z = el('span', { class: 'hm-post-zahl-menue' }); zeile.append(z); }
      if (z) { z.textContent = n ? `${n} ${n === 1 ? 'Brief' : 'Briefe'}` : ''; z.hidden = !n; }
    }
  }

  // ---------------------------------------------------------------- Meldung „Post von ...“
  const leiste = el('div', { id: 'hm-post-meldung', role: 'status', 'aria-live': 'polite', hidden: true });
  (document.getElementById('game') || document.body).append(leiste);
  game.meldungen?.anmelden?.('#hm-post-meldung', MELDUNG_ID);
  const offen = [];
  let jetzt = null;
  let letzter = 0;
  let rafAn = false;

  function melde(e) {
    offen.push(e);
    if (offen.length > 4) offen.splice(0, offen.length - 4);
    game.meldungen?.wunsch(MELDUNG_ID, VORRANG.post ?? 24);
    if (!rafAn) { rafAn = true; letzter = performance.now(); requestAnimationFrame(takt); }
  }
  function darf() {
    if (game.gaestebuch?.offen || document.body.classList.contains('foto') || document.body.classList.contains('hm-feier-an')) return false;
    return game.meldungen ? game.meldungen.darf(MELDUNG_ID) : true;
  }
  function zeige() {
    const liste = offen.splice(0);
    const e = liste[0];
    const s = st();
    const k = s ? postState(s).karten.find((x) => x.id === e.karteId) : null;
    const kopf = liste.length > 1 ? `${liste.length} Briefe im Hafenbüro` : `Post von „${e.bootsname}“`;
    const unter = liste.length > 1 ? `von „${e.bootsname}“ und ${liste.length - 1} weiteren` : k ? kartenStand(k, s.day) : `aus ${e.heimathafen}`;
    const knopf = el('button', {
      type: 'button', class: 'hm-post-meldung', title: 'Pinnwand im Gästebuch öffnen',
      'aria-label': `${kopf}, ${unter}. Pinnwand öffnen`,
      onclick: () => { schliesse(); oeffnePinnwand(); },
    }, sym('brief', 'gross'), el('span', { class: 'hm-post-meldung-text' }, el('b', {}, kopf), el('span', {}, unter)));
    leiste.replaceChildren(knopf);
    leiste.hidden = false;
    jetzt = { t0: performance.now() };
    game.audio?.sfx?.('hinweis');
  }
  function schliesse() {
    leiste.hidden = true;
    leiste.replaceChildren();
    jetzt = null;
    if (!offen.length) game.meldungen?.fertig(MELDUNG_ID);
  }
  function takt() {
    const t = performance.now();
    const dt = t - letzter;
    letzter = t;
    const frei = darf();
    if (jetzt) {
      if (!frei) { jetzt.t0 += dt; leiste.hidden = true; } else {
        leiste.hidden = false;
        if (t - jetzt.t0 > MELDUNG_DAUER) schliesse();
      }
    } else if (offen.length && frei) zeige();
    if (jetzt || offen.length) requestAnimationFrame(takt);
    else { rafAn = false; game.meldungen?.fertig(MELDUNG_ID); }
  }
  game.on('meldungen:wechsel', () => { if ((jetzt || offen.length) && !rafAn) { rafAn = true; letzter = performance.now(); requestAnimationFrame(takt); } });
  game.on('spielstand-geladen', () => { offen.length = 0; schliesse(); briefZeichen(); });

  function oeffnePinnwand() {
    game.gaestebuch?.oeffnen?.();
    requestAnimationFrame(() => document.getElementById('hm-pinnwand')?.scrollIntoView?.({ block: 'start' }));
  }

  // ---------------------------------------------------------------- Regeln einhängen
  await regelnBereit(game);
  haengeEin(game.sim.addHook);
  game.on('sim:postNeu', (e) => { melde(e); briefZeichen(); });
  game.on('sim:change', (d) => { if (d?.reason === 'load' || d?.reason === 'new') briefZeichen(); });
  game.on('ready', () => setTimeout(briefZeichen, 0));
  briefZeichen();

  game.gaestepost = {
    abschnitt,
    ungelesen: () => (st() ? ungelesen(st()) : 0),
    karten: () => (st() ? postState(st()).karten : []),
    oeffnen: oeffnePinnwand,
  };
}
