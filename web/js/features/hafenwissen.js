// Hafenwissen und Lexikon der Signalflaggen (Roadmap P49, F33, F34, docs/signalflaggen.md).
//
// 1. Sammeln: Was im eigenen Hafen vorkommt, wandert ins Hafenwissen: jede Signalflagge, die ein Gast
//    setzt (render/signalflaggen.js), Seezeichen (Warteboje, Pricke, Muringboje, Regattatonne), Feuer und
//    Lichter (Molenfeuer, Leuchtfeuer, Ankerlicht, Positionslichter) und Knoten (Klampenschlag, Palstek,
//    Webeleinstek, Achtknoten, Rundtörn). Daten und Texte: data/hafenwissen.js, data/signalflaggen.js.
// 2. Lexikon: Reiter "Wissen" im Logbuch mit Bildern, Schattenrissen und Hinweis, wo es vorkommt.
//    Antippen öffnet den Eintrag (bei Flaggen: echte Bedeutung im Signalbuch und Bedeutung im Hafen).
// 3. Meldung "Neu im Hafenwissen" im Meldeplatz (Vorrang 21), antippen öffnet den Eintrag; neue Seezeichen,
//    Lichter und Knoten stehen in der Chronik des Tages.
// 4. Karte eines wartenden Boots: neben jedem Wunsch steht seine Flagge (ui/hud.js über flaggeBild()).
//
// Spielstand: state.modules.hafenwissen = { gesehen: { id: { tag, stufe } }, neu: [id] }
// Schnittstelle: game.hafenwissen = { sammeln(id), gesammelt(id), fortschritt(), oeffnen(id?), flaggeBild(wunsch, px) }
import {
  ALLES, GRUPPEN, PALETTE, eintrag, wissenState, sammeln, gesammelt, fortschritt,
} from '../data/hafenwissen.js';
import { flaggenSvg, flaggeFuer } from '../data/signalflaggen.js';
import { wunschKurz } from '../data/wuensche-texte.js';
import { isRaftBerth } from '../sim.js';
import { VORRANG } from '../ui/meldungen.js';

const MELDUNG_ID = 'hafenwissen';
const MELDUNG_DAUER = 3800;
const NACHT = 0.35;

const svgUrl = (svg) => `data:image/svg+xml,${encodeURIComponent(svg)}`;
function rasterSvg(raster) {
  let s = '';
  raster.forEach((zeile, y) => [...zeile].forEach((c, x) => {
    if (c !== '.' && PALETTE[c]) s += `<rect x="${x}" y="${y}" width="1" height="1" fill="${PALETTE[c]}"/>`;
  }));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" shape-rendering="crispEdges">${s}</svg>`;
}
function schattenSvg(raster) {
  return rasterSvg(raster.map((z) => z.replace(/[^.]/g, 'k')));
}
const bildCache = new Map();
function bildUrl(e, schatten) {
  const key = `${e.id}|${schatten ? 1 : 0}`;
  if (bildCache.has(key)) return bildCache.get(key);
  let svg;
  if (e.buchstabe) {
    svg = flaggenSvg(e.buchstabe);
    if (schatten) svg = svg.replace(/fill="#[0-9a-f]{6}"/gi, 'fill="#24364a"');
  } else svg = schatten ? schattenSvg(e.bild) : rasterSvg(e.bild);
  const u = svgUrl(svg);
  bildCache.set(key, u);
  return u;
}

const CSS = `
.hm-hw-raster { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(112px, 1fr)); gap: 6px; }
.hm-hw-raster .hm-lb-karte { min-height: 100%; align-content: start; }
.hm-hw-bild { width: 64px; height: 64px; image-rendering: pixelated; }
.hm-hw-bild.flagge { width: 68px; height: 48px; margin: 8px 0; }
.hm-hw-bild.schatten { opacity: 0.4; }
.hm-hw-bild.gross { width: 128px; height: 128px; }
.hm-hw-bild.flagge.gross { width: 170px; height: 120px; margin: 4px 0; }
.hm-hw-sb p { max-width: 46ch; }
.hm-hw-sb .hm-hw-echt { padding: 6px 8px; background: var(--hm-mulde, #e9dfca); }
.hm-hw-sb .hm-hw-hier { padding: 6px 8px; background: #f7e3a6; }
.hm-hw-meldung-bild { width: 44px; height: 44px; image-rendering: pixelated; flex: none; }
.hm-hw-meldung-bild.flagge { width: 51px; height: 36px; }
.hm-hw-karte-flagge { display: inline-block; width: 20px; height: 14px; margin-right: 5px; vertical-align: -2px; image-rendering: pixelated; }
@media (max-width: 599px) and (orientation: portrait) {
  .hm-hw-raster { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; }
  .hm-hw-bild { width: 48px; height: 48px; }
  .hm-hw-bild.flagge { width: 51px; height: 36px; margin: 6px 0; }
  .hm-hw-raster .hm-lb-name { font-size: calc(var(--hm-schrift, 15px) - 2px); }
}
`;

export function init(game) {
  if (typeof document === 'undefined') return;
  document.head.append(Object.assign(document.createElement('style'), { id: 'hm-hafenwissen-css', textContent: CSS }));

  const st = () => game.sim?.state ?? null;
  const nacht = () => game.landscape?.licht?.zustand?.nacht ?? 0;

  function el(tag, attrs = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v;
      else if (k === 'onclick') e.addEventListener('click', v);
      else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) e.append(c);
    return e;
  }
  function bildEl(e, { schatten = false, gross = false } = {}) {
    return el('img', {
      class: `hm-hw-bild${e.buchstabe ? ' flagge' : ''}${schatten ? ' schatten' : ''}${gross ? ' gross' : ''}`,
      alt: '', src: bildUrl(e, schatten), decoding: 'async', draggable: 'false',
    });
  }

  // ---------------------------------------------------------------- Sammeln
  function neu(id) {
    const s = st();
    if (!s || !sammeln(s, id)) return false;
    const e = eintrag(id);
    game.emit?.('hafenwissen:neu', { id });
    if (e && !e.buchstabe) game.logbuch?.merken?.({ a: 'text', art: 'wissen', text: `Hafenwissen: ${e.name}` });
    meldeNeu(id);
    game.logbuch?.neuZeichnen?.({ nurZahl: !lexikonOffen() });
    return true;
  }
  const lexikonOffen = () => !!game.logbuch?.offen && document.querySelector('#hm-lb-tab-wissen[aria-selected="true"]');

  game.on('signalflagge:gesetzt', (e) => { if (e?.buchstabe) neu(`flagge-${e.buchstabe}`); });
  game.on('sim:atBuoy', () => {
    neu('warteboje');
    if (prickenDa()) neu('pricke');
  });
  game.on('sim:moored', (e) => {
    const s = st();
    const b = s?.boats?.[e?.boatId];
    if (!b || b.stationed) return;
    const platz = String(e.berthId ?? '');
    if (platz.startsWith('BF')) { neu('muringboje'); neu('palstek'); }
    else if (isRaftBerth(platz)) neu('webeleinstek');
    else neu('klampenschlag');
  });
  game.on('havarie:leine', () => neu('rundtoern'));

  function prickenDa() {
    const p = game.scene?.getObjectByName?.('pricken');
    return !!(p && p.visible !== false && p.geometry?.attributes?.position?.count);
  }
  function regattaDa() {
    const g = game.scene?.getObjectByName?.('regattabahn');
    return !!(g && g.visible !== false && g.children.length);
  }
  // Was man nur sieht (Lichter, Regattabahn, Optis): jede Sekunde nachsehen
  setInterval(() => {
    const s = st();
    if (!s || document.hidden) return;
    const n = nacht();
    if (n > NACHT) {
      if ((game.buildings?.items ?? []).some((it) => it.art === 'molenfeuer' && it.mesh?.parent)) neu('molenfeuer');
      if (game.scene?.getObjectByName?.('leuchtturm')) neu('leuchtfeuer');
      if ((game.boatView?.boote ?? []).some(({ anim }) => anim?.moored && anim.berth?.kind === 'buoy')) neu('ankerlicht');
    }
    if ((game.boatView?.boote ?? []).some(({ id }) => game.signalflaggen?.lichter?.(id))) neu('positionslichter');
    if (regattaDa()) neu('regattatonne');
    if ((game.jugendBild?.boote?.() ?? []).some((b) => b.sichtbar)) neu('achtknoten');
  }, 1000);

  // ---------------------------------------------------------------- Meldung "Neu im Hafenwissen"
  const leiste = el('div', { id: 'hm-hw-meldung', role: 'status', 'aria-live': 'polite', hidden: true });
  (document.getElementById('game') || document.body).append(leiste);
  game.meldungen?.anmelden?.('#hm-hw-meldung', MELDUNG_ID);
  const offen = [];
  let jetzt = null;
  let letzter = 0;
  let rafAn = false;
  function meldeNeu(id) {
    offen.push(id);
    if (offen.length > 8) offen.splice(0, offen.length - 8);
    game.meldungen?.wunsch(MELDUNG_ID, VORRANG.wissen ?? 21);
    if (!rafAn) { rafAn = true; letzter = performance.now(); requestAnimationFrame(takt); }
  }
  function darf() {
    const cl = document.body.classList;
    if (game.logbuch?.offen || cl.contains('foto') || cl.contains('hm-feier-an')) return false;
    return game.meldungen ? game.meldungen.darf(MELDUNG_ID) : true;
  }
  function zeige() {
    // Seezeichen, Lichter und Knoten zuerst nennen, Flaggen danach
    const liste = offen.splice(0).map(eintrag).filter(Boolean);
    if (!liste.length) return;
    liste.sort((a, b) => !!a.buchstabe - !!b.buchstabe);
    const erstes = liste[0];
    const kopf = liste.length > 1 ? `${liste.length} neu im Hafenwissen` : erstes.buchstabe ? 'Neue Signalflagge' : 'Neu im Hafenwissen';
    const name = liste.length > 1 ? `${erstes.name} und ${liste.length - 1} weitere` : erstes.name;
    const img = el('img', { class: `hm-hw-meldung-bild${erstes.buchstabe ? ' flagge' : ''}`, alt: '', src: bildUrl(erstes, false) });
    const knopf = el('button', {
      type: 'button', class: 'hm-lb-meldung', title: 'Hafenwissen im Logbuch öffnen',
      'aria-label': `${kopf}: ${name}. Logbuch öffnen`,
      onclick: () => { schliesse(); oeffnen(erstes.id); },
    }, img, el('span', { class: 'hm-lb-meldung-text' }, el('b', {}, kopf), el('span', {}, name)));
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
      if (!frei) { jetzt.t0 += dt; leiste.hidden = true; }
      else {
        leiste.hidden = false;
        if (t - jetzt.t0 > MELDUNG_DAUER) schliesse();
      }
    } else if (offen.length && frei) zeige();
    if (jetzt || offen.length) requestAnimationFrame(takt);
    else { rafAn = false; game.meldungen?.fertig(MELDUNG_ID); }
  }
  game.on('meldungen:wechsel', () => { if ((jetzt || offen.length) && !rafAn) { rafAn = true; letzter = performance.now(); requestAnimationFrame(takt); } });
  game.on('spielstand-geladen', () => { offen.length = 0; schliesse(); });
  game.on('sim:change', (d) => {
    if (d?.reason === 'load' || d?.reason === 'new') { offen.length = 0; schliesse(); const s = st(); if (s) wissenState(s); }
  });

  // ---------------------------------------------------------------- Reiter "Wissen" im Logbuch
  let steckbrief = null;
  function oeffnen(id = null) {
    steckbrief = id && eintrag(id) ? id : null;
    const merk = steckbrief;
    game.logbuch?.oeffnen?.('wissen');
    // oeffnen() zeichnet die Liste; den Eintrag danach zeigen
    if (merk) { steckbrief = merk; game.logbuch?.neuZeichnen?.(); }
  }

  function steckbriefTeil(s, zeichneNeu) {
    const e = eintrag(steckbrief);
    const da = gesammelt(s, e.id);
    const g = s.modules?.hafenwissen?.gesehen?.[e.id];
    const gruppe = GRUPPEN.find((x) => x.id === e.gruppe);
    const reihe = ALLES.filter((x) => x.gruppe === e.gruppe && gesammelt(s, x.id));
    const i = reihe.findIndex((x) => x.id === e.id);
    const blaettern = (d) => { if (reihe.length > 1 && i >= 0) { steckbrief = reihe[(i + d + reihe.length) % reihe.length].id; zeichneNeu(); } };
    const teile = [el('div', { class: 'hm-lb-sb-leiste' },
      el('button', { type: 'button', class: 'hm-lb-zurueck', onclick: () => { steckbrief = null; zeichneNeu(); } }, 'Alles Hafenwissen'),
      el('span', { class: 'hm-lb-klein' }, gruppe?.name ?? ''))];
    teile.push(el('div', { class: 'hm-lb-sb-bild' },
      da && reihe.length > 1 ? el('button', { type: 'button', class: 'hm-lb-pfeil links', 'aria-label': 'Voriger Eintrag', onclick: () => blaettern(-1) }, '<') : null,
      bildEl(e, { schatten: !da, gross: true }),
      da && reihe.length > 1 ? el('button', { type: 'button', class: 'hm-lb-pfeil rechts', 'aria-label': 'Nächster Eintrag', onclick: () => blaettern(1) }, '>') : null));
    teile.push(el('h3', {}, da ? e.name : '???'));
    if (!da) {
      teile.push(el('p', {}, e.wo));
    } else if (e.buchstabe) {
      teile.push(el('p', { class: 'hm-hw-hier' }, el('b', {}, 'Im Hafen: '), e.hier));
      teile.push(el('p', {}, el('b', {}, 'Merkhilfe: '), e.merk));
      teile.push(el('p', { class: 'hm-hw-echt' }, el('b', {}, 'Im Signalbuch: '), e.echt));
    } else {
      teile.push(el('p', {}, e.text));
      teile.push(el('p', { class: 'hm-lb-klein' }, e.wo));
    }
    if (da && g?.tag != null) teile.push(el('p', { class: 'hm-lb-klein' }, `Zuerst gesehen am Tag ${g.tag}${g.stufe ? ` (Stufe ${g.stufe})` : ''}.`));
    return [el('div', { class: 'hm-lb-steckbrief hm-hw-sb' }, ...teile)];
  }

  function teil(s, opt = {}) {
    const zeichneNeu = () => (opt.zeichne ? opt.zeichne() : game.logbuch?.neuZeichnen?.());
    wissenState(s);
    if (steckbrief && eintrag(steckbrief)) {
      const m = s.modules.hafenwissen;
      if (m.neu.includes(steckbrief)) setTimeout(() => { m.neu = m.neu.filter((x) => x !== steckbrief); game.logbuch?.neuZeichnen?.({ nurZahl: true }); }, 0);
      return steckbriefTeil(s, zeichneNeu);
    }
    const m = s.modules.hafenwissen;
    const f = fortschritt(s);
    const teile = [el('div', { class: 'hm-lb-stand' },
      el('div', { class: 'hm-lb-stand-text' }, el('b', {}, `${f.gesehen} von ${f.gesamt}`), el('span', {}, ' Einträgen gesammelt')),
      el('div', { class: 'hm-lb-balken', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(f.gesamt), 'aria-valuenow': String(f.gesehen), 'aria-label': 'Gesammeltes Hafenwissen' },
        el('i', { style: `width: ${Math.round((f.gesehen / f.gesamt) * 1000) / 10}%` })))];
    const angesehen = [];
    for (const g of GRUPPEN) {
      const raster = el('ul', { class: 'hm-hw-raster' });
      for (const e of ALLES.filter((x) => x.gruppe === g.id)) {
        const da = gesammelt(s, e.id);
        const istNeu = m.neu.includes(e.id);
        if (istNeu) angesehen.push(e.id);
        const name = da ? (e.buchstabe ? e.buchstabe : e.name) : '???';
        const klein = da ? (e.buchstabe ? (e.wunsch ? wunschKurz(e.wunsch) : 'Auslaufen') : '') : e.buchstabe ? `ab Stufe ${e.ab}` : '';
        raster.append(el('li', {}, el('button', {
          type: 'button', class: `hm-lb-karte${da ? '' : ' fehlt'}${istNeu ? ' neu' : ''}`, 'data-wissen': e.id,
          title: da ? e.name : e.wo,
          onclick: () => { steckbrief = e.id; zeichneNeu(); },
        }, bildEl(e, { schatten: !da }),
        el('span', { class: 'hm-lb-name' }, name),
        klein ? el('span', { class: 'hm-lb-klein' }, klein) : null,
        istNeu ? el('span', { class: 'hm-lb-neu' }, 'neu') : null)));
      }
      const j = f.je[g.id];
      teile.push(el('section', { class: 'hm-lb-art' }, el('h3', {}, el('span', {}, g.name), el('span', { class: 'hm-lb-zahl' }, `${j.gesehen}/${j.gesamt}`)), raster));
    }
    teile.push(el('p', { class: 'hm-lb-klein hm-lb-fuss' }, 'Gäste setzen für jeden Wunsch eine Signalflagge an Steuerbord. Ist der Wunsch erfüllt, holen sie die Flagge ein. Vor dem Auslaufen weht der Blaue Peter, nach Sonnenuntergang kommen alle Flaggen herunter.'));
    if (angesehen.length) setTimeout(() => { m.neu = m.neu.filter((x) => !angesehen.includes(x)); game.logbuch?.neuZeichnen?.({ nurZahl: true }); }, 0);
    return teile;
  }

  function reiterAnmelden() {
    if (!game.logbuch?.reiter) return false;
    game.logbuch.reiter({ id: 'wissen', name: 'Wissen', teil, zahl: () => { const s = st(); return s ? wissenState(s).neu.length : 0; } });
    return true;
  }
  if (!reiterAnmelden()) game.on('ready', reiterAnmelden);

  // ---------------------------------------------------------------- Schnittstelle
  const flaggenBildCache = new Map();
  game.hafenwissen = {
    sammeln: (id) => neu(id),
    gesammelt: (id) => gesammelt(st(), id),
    fortschritt: () => (st() ? fortschritt(st()) : null),
    oeffnen,
    // kleines Flaggenbild für einen Wunsch (Karte eines wartenden Boots), sonst null
    flaggeBild(wunsch) {
      const b = flaggeFuer(wunsch);
      if (!b) return null;
      if (!flaggenBildCache.has(b)) flaggenBildCache.set(b, svgUrl(flaggenSvg(b)));
      return el('img', { class: 'hm-hw-karte-flagge', alt: '', src: flaggenBildCache.get(b), title: `Signalflagge ${b}` });
    },
  };
}

export default init;
