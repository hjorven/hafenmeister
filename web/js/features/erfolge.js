// Erfolge (Roadmap P22, I6 Erfolge als Dinge im Hafen, I7 Meilensteine mit Ton und Bild). Beschreibung: docs/erfolge.md.
// Daten und Prüfung: features/erfolge-daten.js (ohne Browser). Dinge im Hafen: features/erfolge-dinge.js (Three.js,
// nachgeladen, platziert über features/ziel-deko.js).
//
// - Zählt mit (Ereignisse der Spielregeln, Tages- und Wochenziele, Sturm) und prüft nach jeder Änderung alle
//   offenen Erfolge.
// - Neuer Erfolg: kurze Meldung rechts oben (Meldungs-Ordnung, Vorrang 30), Ton, Zeile in der Chronik des
//   Logbuchs, das Ding im Hafen (Wimpel an der Erfolgsleine, Pokal im Schaukasten, Schild an der Ehrentafel)
//   hüpft. Antippen der Meldung öffnet den Reiter "Erfolge" im Logbuch.
// - Logbuch, Reiter "Erfolge": alle Erfolge nach Gruppen, erreichte mit Tag, offene mit Fortschritt.
// - Alte Spielstände ohne Erfolge: was schon erreicht ist, wird beim Laden still nachgetragen (keine Meldungsflut).
//
// Schnittstelle: game.erfolge = { ansicht(), dinge(), erreicht(id), oeffnen(), pruefen(), aufbauen() }
// Ereignis: 'erfolg:neu' { id, titel, ding, gruppe }

import * as sim from '../sim.js';
import {
  ERFOLGE, ERFOLG_BY_ID, GRUPPEN, erfolgeState, pruefen, zaehle, zaehleExtra, hilfsdaten, ansicht, dinge, ausgebuchtJetzt,
} from './erfolge-daten.js';
import { VORRANG } from '../ui/meldungen.js';

// ------------------------------------------------------------------ Pixel-Symbole (12 x 12)
export const SYMBOLE = {
  wimpel: ['............', '.#..........', '.####.......', '.#######....', '.##########.', '.#######....', '.####.......', '.#..........', '.#..........', '.#..........', '.#..........', '.##.........'],
  pokal: ['............', '.##########.', '##.######.##', '#..######..#', '##.######.##', '..########..', '...######...', '....####....', '.....##.....', '.....##.....', '...######...', '..########..'],
  schild: ['............', '.##########.', '.#........#.', '.#.######.#.', '.#........#.', '.#.####...#.', '.#........#.', '.##########.', '..#......#..', '..#......#..', '..#......#..', '.###....###.'],
  schloss: ['............', '....####....', '...#....#...', '...#....#...', '...#....#...', '..########..', '..###..###..', '..###..###..', '..####.###..', '..########..', '..########..', '............'],
};
function pixelSvg(raster) {
  let r = '';
  raster.forEach((zeile, y) => [...zeile].forEach((c, x) => {
    if (c === '#') r += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="black"/>`;
  }));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" shape-rendering="crispEdges">${r}</svg>`;
}
const url = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

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

const MELDUNG_ID = 'erfolg';
const MELDUNG_DAUER = 4200;
export const FARBE_POKAL = '#e3b23c';
export const FARBE_SCHILD = '#b08d57';
export const farbeVon = (e) => (e.ding === 'pokal' ? FARBE_POKAL : e.ding === 'schild' ? FARBE_SCHILD : GRUPPEN[e.gruppe]?.farbe ?? '#2f6db3');
const tagText = (r) => (r?.tag ? `Tag ${r.tag}` : 'vor den Erfolgen');
const anzahl = (n, eins, viele) => `${n} ${n === 1 ? eins : viele}`;
const zahlText = (n) => (n >= 10000 ? n.toLocaleString('de-DE') : String(n));

export function init(game) {
  const st = () => game.sim?.state ?? null;
  const ctx = () => game.sim?.ctx ?? null;

  // ---------------------------------------------------------------- Prüfen
  let ruhig = true;                        // erste Prüfung nach Laden/Neustart: still nachtragen
  const h = () => {
    const s = st();
    const c = ctx();
    let ruf = null;
    try { ruf = game.sim?.reputation?.() ?? sim.reputation(s); } catch { ruf = null; }
    return {
      ...hilfsdaten(s, { types: c?.types?.length ? c.types : null, ruf }),
      voll: () => (c ? ausgebuchtJetzt(s, c) : false),
      abend: () => s?.phase === 'evening',
    };
  };

  function pruefeJetzt() {
    const s = st();
    if (!s || !ctx()) return [];
    const still = ruhig;
    ruhig = false;
    const neu = pruefen(s, h());
    if (!neu.length) return neu;
    if (still) {
      // nachgetragen: nicht als neu melden, nur im Logbuch "neu" markieren, wenn es wenige sind
      const m = erfolgeState(s);
      for (const e of neu) m.erreicht[e.id].nach = true;
      m.neu = m.neu.filter((id) => !neu.some((e) => e.id === id));
    } else {
      for (const e of neu) verkuende(e);
    }
    game.logbuch?.neuZeichnen?.();
    dingeNeu(neu, still);
    return neu;
  }

  // Ereignisse der Spielregeln sammeln wie das Logbuch: am Ende des Ticks (Mikrotask) zusammen verarbeiten
  const puffer = [];
  let geplant = false;
  function abarbeiten() {
    geplant = false;
    const s = st();
    const liste = puffer.splice(0);
    if (!s) return;
    if (liste.length) zaehle(s, liste, h());
    pruefeJetzt();
  }
  const bald = () => { if (!geplant) { geplant = true; queueMicrotask(abarbeiten); } };
  for (const typ of ['moored', 'departed', 'dayEnd', 'dayStart', 'evening', 'regionDone']) {
    game.on(`sim:${typ}`, (e) => { puffer.push({ ...e, type: typ }); bald(); });
  }
  // Alles andere, was einen Erfolg bringen kann (Geld, Stufe, Bauen, Logbuch, Stammgäste), meldet sim:change
  game.on('sim:change', (d) => {
    if (d?.reason === 'load' || d?.reason === 'new') { ruhig = true; dingeAufbauen(); }
    bald();
  });
  const extra = (art) => { const s = st(); if (s) { zaehleExtra(s, art); bald(); } };
  game.on('ziel:erreicht', () => extra('ziel'));
  game.on('wochenziel:erreicht', () => extra('woche'));
  game.on('event:end', (e) => { const ev = e?.event; if ((typeof ev === 'object' ? ev?.id : ev) === 'sturm') extra('sturm'); });
  for (const n of ['logbuch:neu', 'stammgast:neu', 'bauen:gebaut', 'services:gebaut', 'stufe']) game.on(n, bald);
  game.on('spielstand-geladen', () => { ruhig = true; offeneMeldungen.length = 0; schliesseMeldung(); bald(); dingeAufbauen(); });

  function verkuende(e) {
    game.logbuch?.merken?.({ a: 'text', art: 'erfolg', text: `Erfolg: ${e.titel}.` });
    game.emit('erfolg:neu', { id: e.id, titel: e.titel, ding: e.ding, gruppe: e.gruppe });
    // Stufenschilder kommen mit der Feier des Aufstiegs: dort steht es schon groß, keine eigene Meldung
    if (e.ding === 'schild') return;
    meldeNeu(e);
  }

  // ---------------------------------------------------------------- Dinge im Hafen
  let dingeMod = null;
  function dingeAufbauen() { dingeMod?.aufbauen?.(); }
  function dingeNeu(neu, still) {
    dingeMod?.aufbauen?.();
    if (!still) for (const e of neu) dingeMod?.huepfen?.(e);
  }
  if (typeof window !== 'undefined' && game.scene) {
    import('./erfolge-dinge.js').then((m) => { dingeMod = m.init(game, { dinge: () => (st() ? dinge(st()) : null) }); })
      .catch((err) => console.error('Erfolge im Hafen', err));
  }

  if (typeof document === 'undefined') {
    game.erfolge = { ansicht: () => ansicht(st(), h()), dinge: () => dinge(st()), erreicht: (id) => !!erfolgeState(st()).erreicht[id], pruefen: pruefeJetzt, oeffnen() {} };
    return;
  }

  // ---------------------------------------------------------------- Aussehen
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('../../css/erfolge.css', import.meta.url).href;
  document.head.append(link);
  const vars = Object.entries(SYMBOLE).map(([k, v]) => `--px-ef-${k}: ${url(pixelSvg(v))};`).join('\n  ');
  document.head.append(el('style', { id: 'hm-erfolge-grafik' }, `:root {\n  ${vars}\n}`));
  const sym = (e, erreicht = true) => el('i', {
    class: `hm-ef-sym ${e.ding}${erreicht ? '' : ' offen'}`, 'aria-hidden': 'true',
    style: `--ef-sym: var(--px-ef-${e.ding}); --ef-farbe: ${farbeVon(e)}`,
  });

  // ---------------------------------------------------------------- Meldung
  const leiste = el('div', { id: 'hm-ef-meldung', role: 'status', 'aria-live': 'polite', hidden: true });
  (document.getElementById('game') || document.body).append(leiste);
  game.meldungen?.anmelden?.('#hm-ef-meldung', MELDUNG_ID);
  const offeneMeldungen = [];
  let jetzt = null;
  let letzterTakt = 0;
  let rafAn = false;
  function meldeNeu(e) {
    offeneMeldungen.push(e);
    game.meldungen?.wunsch(MELDUNG_ID, VORRANG.erfolg ?? 30);
    if (!rafAn) { rafAn = true; letzterTakt = performance.now(); requestAnimationFrame(takt); }
  }
  function darf() {
    const b = document.body.classList;
    if (game.logbuch?.offen || b.contains('foto') || b.contains('hm-feier-an')) return false;
    return game.meldungen ? game.meldungen.darf(MELDUNG_ID) : true;
  }
  function zeigeMeldung() {
    const liste = offeneMeldungen.splice(0);
    // Mehrere zugleich (Vorspulen): eine Meldung, der wichtigste (Pokal) vorn
    const erstes = liste.find((x) => x.ding === 'pokal') ?? liste[0];
    const kopf = liste.length > 1 ? `${liste.length} neue Erfolge` : erstes.titel;
    const zeile = liste.length > 1 ? `${erstes.titel} und ${liste.length - 1} weitere` : erstes.text;
    const knopf = el('button', {
      type: 'button', class: `hm-ef-meldung ${erstes.ding}`, title: 'Erfolge im Logbuch ansehen',
      'aria-label': `Erfolg: ${kopf}. ${zeile} Erfolge ansehen`,
      onclick: () => { schliesseMeldung(); oeffnen(); },
    }, el('span', { class: 'hm-ef-feld' }, sym(erstes)), el('span', { class: 'hm-ef-meldung-text' }, el('small', {}, liste.length > 1 ? 'Erfolge' : erstes.ding === 'pokal' ? 'Pokal' : 'Erfolg'), el('b', {}, kopf), el('span', {}, zeile)));
    leiste.replaceChildren(knopf);
    leiste.hidden = false;
    jetzt = { t0: performance.now() };
    game.audio?.sfx?.('erfolg', { gross: liste.some((x) => x.ding === 'pokal') });
  }
  function schliesseMeldung() {
    leiste.hidden = true;
    leiste.replaceChildren();
    jetzt = null;
    if (!offeneMeldungen.length) game.meldungen?.fertig(MELDUNG_ID);
  }
  function takt() {
    const t = performance.now();
    const dt = t - letzterTakt;
    letzterTakt = t;
    const frei = darf();
    if (jetzt) {
      if (!frei) { jetzt.t0 += dt; leiste.hidden = true; }
      else {
        leiste.hidden = false;
        if (t - jetzt.t0 > MELDUNG_DAUER) schliesseMeldung();
      }
    } else if (offeneMeldungen.length && frei) zeigeMeldung();
    if (jetzt || offeneMeldungen.length) requestAnimationFrame(takt);
    else { rafAn = false; game.meldungen?.fertig(MELDUNG_ID); }
  }
  game.on('meldungen:wechsel', () => { if ((jetzt || offeneMeldungen.length) && !rafAn) { rafAn = true; letzterTakt = performance.now(); requestAnimationFrame(takt); } });

  // ---------------------------------------------------------------- Reiter "Erfolge" im Logbuch
  function teil(s) {
    const m = erfolgeState(s);
    const gruppen = ansicht(s, h());
    const alle = ERFOLGE.length;
    const da = Object.keys(m.erreicht).filter((id) => ERFOLG_BY_ID[id]).length;
    const d = dinge(s);
    const oben = el('div', { class: 'hm-lb-stand' },
      el('div', { class: 'hm-lb-stand-text' }, el('b', {}, `${da} von ${alle}`), el('span', {}, ` Erfolgen · im Hafen: ${anzahl(d.wimpel.length, 'Wimpel', 'Wimpel')}, ${anzahl(d.pokale.length, 'Pokal', 'Pokale')}, ${anzahl(d.schilder.length, 'Schild', 'Schilder')}`)),
      el('div', { class: 'hm-lb-balken', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(alle), 'aria-valuenow': String(da), 'aria-label': 'Erreichte Erfolge' },
        el('i', { style: `width: ${Math.round((da / alle) * 1000) / 10}%` })));
    const teile = [oben];
    const gesehen = [];
    for (const g of gruppen) {
      const liste = el('ul', { class: 'hm-ef-liste' });
      const n = g.erfolge.filter((e) => e.erreicht).length;
      // erreichte zuerst (neueste oben), dann offene nach Fortschritt
      const sortiert = [...g.erfolge].sort((a, b) => (!!b.erreicht - !!a.erreicht)
        || ((b.erreicht?.tag ?? 0) - (a.erreicht?.tag ?? 0))
        || (b.stand.ist / b.stand.soll - a.stand.ist / a.stand.soll));
      for (const e of sortiert) {
        if (e.neu) gesehen.push(e.id);
        const anteil = Math.max(0, Math.min(1, e.stand.ist / e.stand.soll));
        liste.append(el('li', { class: `hm-ef-karte${e.erreicht ? ' da' : ''}${e.neu ? ' neu' : ''}`, 'data-erfolg': e.id },
          sym(e, !!e.erreicht),
          el('span', { class: 'hm-ef-text' },
            el('b', {}, e.titel),
            el('span', {}, e.text),
            e.erreicht
              ? el('span', { class: 'hm-lb-klein' }, `${tagText(e.erreicht)}${e.erreicht.stufe ? ` · Stufe ${e.erreicht.stufe}` : ''}`)
              : e.stand.soll > 1
                ? el('span', { class: 'hm-ef-fortschritt' },
                  el('span', { class: 'hm-lb-balken klein', 'aria-hidden': 'true' }, el('i', { style: `width: ${Math.round(anteil * 1000) / 10}%` })),
                  el('span', { class: 'hm-lb-klein' }, `${zahlText(e.stand.ist)} / ${zahlText(e.stand.soll)}`))
                : null),
          e.neu ? el('span', { class: 'hm-lb-neu' }, 'neu') : null));
      }
      teile.push(el('section', { class: 'hm-lb-art hm-ef-gruppe' },
        el('h3', {}, el('span', {}, g.name), el('span', { class: 'hm-lb-zahl' }, `${n}/${g.erfolge.length}`)), liste));
    }
    // Was jetzt zu sehen war, ist nicht mehr neu (Markierung bleibt bis zum nächsten Öffnen)
    if (gesehen.length) setTimeout(() => { m.neu = m.neu.filter((id) => !gesehen.includes(id)); game.logbuch?.neuZeichnen?.({ nurZahl: true }); }, 0);
    return teile;
  }
  function anmelden() {
    if (!game.logbuch?.reiter) return false;
    game.logbuch.reiter({ id: 'erfolge', name: 'Erfolge', teil, zahl: () => (st() ? erfolgeState(st()).neu.length : 0) });
    return true;
  }
  if (!anmelden()) game.on('ready', anmelden);

  function oeffnen() { game.logbuch?.oeffnen?.('erfolge'); }

  game.erfolge = {
    ansicht: () => (st() ? ansicht(st(), h()) : []),
    dinge: () => (st() ? dinge(st()) : null),
    erreicht: (id) => !!(st() && erfolgeState(st()).erreicht[id]),
    pruefen: pruefeJetzt,
    oeffnen,
    aufbauen: dingeAufbauen,   // Dinge im Hafen neu aufstellen (Tests, Fotomodus)
  };
}

export default init;
