// Logbuch und Hafenchronik (Roadmap P21: Logbuch mit Bild, F36 Chronik, I5 Sammelalbum mit Schattenrissen).
// Beschreibung: docs/logbuch.md. Daten und Texte: ui/logbuch-daten.js, Bilder: ui/logbuch-bild.js.
//
// 1. Boote: jedes Bootsmodell, das einmal angelegt hat, steht mit Pixelbild im Logbuch, fehlende als
//    Schattenriss. Nach Größe S bis XXL, je Bootsart, mit Steckbrief (Maße, Bauform, wann zuerst da).
// 2. Chronik: jeder Tag eine Zeile (was neu war, was gebaut wurde, Aufstieg, Ereignis), Kapitel je Stufe.
// 3. Neues Modell: kurze Meldung rechts oben mit Bild (Meldungs-Ordnung, ui/meldungen.js), antippen öffnet
//    den Steckbrief. Der Menüeintrag zeigt, wie viele Einträge neu sind.
//    Öffnen: Menü "Logbuch", Taste J.
//
// Schnittstelle: game.logbuch = { oeffnen(reiter?, modellId?), schliessen(), get offen, fortschritt(),
//   chronik(), tagesSatz(tag), merken(merk) }   merken: Merkmal für die heutige Chronik-Zeile (für P22 Erfolge:
//   game.logbuch.merken({ a: 'text', art: 'erfolg', text: 'Erfolg: ...' }))
// Ereignis: 'logbuch:neu' { key, typeId, modelId, art } für jedes neue Modell.

import {
  LOGBUCH, buchState, saeubern, katalog, fortschritt, gesehen, merken, verarbeite, saetze, zahlenText, tagTitel,
  chronikAnsicht, masse, erstText, fehltText, tagesSatz, offeneMerk,
} from './logbuch-daten.js';
import { bildMaler } from './logbuch-bild.js';
import { VORRANG } from './meldungen.js';

// ------------------------------------------------------------------ Pixel-Symbole (12 x 12, wie ui/oberflaeche.js)
const PIXEL = {
  logbuch: ['............', '.##########.', '.#........#.', '.#...##...#.', '.#..####..#.', '.#...##...#.', '.#...##...#.', '.#.#.##.#.#.', '.#..####..#.', '.#........#.', '.##########.', '............'],
  zu: ['............', '.##......##.', '.###....###.', '..###..###..', '...######...', '....####....', '....####....', '...######...', '..###..###..', '.###....###.', '.##......##.', '............'],
  zurueck: ['............', '....##......', '...##.......', '..##........', '.##########.', '.##########.', '..##........', '...##.......', '....##......', '............', '............', '............'],
};
function pixelSvg(raster) {
  const h = raster.length;
  const w = raster[0].length;
  let r = '';
  raster.forEach((zeile, y) => [...zeile].forEach((c, x) => {
    if (c === '#') r += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="black"/>`;
  }));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${r}</svg>`;
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
const sym = (name, cls = '') => el('i', { class: `hm-lb-sym ${cls}`.trim(), 'aria-hidden': 'true', style: `--lb-sym: var(--px-lb-${name})` });

const GROESSE_NAME = { S: 'Klein', M: 'Mittel', L: 'Groß', XL: 'Sehr groß', XXL: 'Schiffe' };
const MELDUNG_ID = 'logbuch';
const MELDUNG_DAUER = 3800;

export function init(game) {
  if (typeof document === 'undefined') return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('../../css/logbuch.css', import.meta.url).href;
  document.head.append(link);
  const vars = Object.entries(PIXEL).map(([k, v]) => `--px-lb-${k}: ${url(pixelSvg(v))};`).join('\n  ');
  document.head.append(el('style', { id: 'hm-logbuch-grafik' }, `:root {\n  ${vars}\n}`));

  const st = () => game.sim?.state ?? game.state;
  const maler = bildMaler(game);
  let kat = null;
  const kata = () => {
    const types = game.sim?.ctx?.types;
    if (!kat && types?.length) kat = katalog(types);
    return kat || [];
  };
  const modellInfo = (key) => {
    for (const g of kata()) for (const art of g.arten) for (const mo of art.modelle) if (mo.id === key) return { art, mo };
    return null;
  };
  const namen = (typeId, modelId) => {
    const t = game.sim?.ctx?.typeById?.[typeId];
    const mo = modelId ? t?.models?.find((m) => m.id === modelId) : null;
    return { typ: t?.name ?? typeId, modell: mo?.name ?? t?.name ?? modelId };
  };
  const istWinter = () => { try { return !!game.sim?.season?.()?.winter; } catch { return false; } };

  // ---------------------------------------------------------------- Mitschreiben
  const hilfe = { namen, boot: (id) => st()?.boats?.[id], winter: () => istWinter() };
  // Die Regeln melden die Ereignisse eines Ticks gleich hintereinander, state.day ist dann schon der Stand
  // danach. Darum sammeln: verarbeitet wird am Ende der Meldungen (Mikrotask) oder sofort beim Abend,
  // dann weiß verarbeite() aus der Reihenfolge, zu welchem Tag ein Ereignis gehört.
  const puffer = [];
  let geplant = false;
  function abarbeiten() {
    geplant = false;
    const s = st();
    const liste = puffer.splice(0);
    if (!s || !liste.length) return;
    const neu = verarbeite(s, liste, hilfe);
    for (const n of neu) {
      game.emit('logbuch:neu', n);
      meldeNeu(n);
    }
    menueZahl();
    if (offen) zeichne();
  }
  function nimm(e) {
    puffer.push(e);
    if (e.type === 'dayEnd') { abarbeiten(); return; }
    if (!geplant) { geplant = true; queueMicrotask(abarbeiten); }
  }
  for (const typ of ['logbookNew', 'stageUp', 'regionDone', 'stammgastNeu', 'dayEnd', 'dayStart']) {
    game.on(`sim:${typ}`, (e) => nimm({ ...e, type: typ }));
  }
  const merk = (m) => { const s = st(); if (s && merken(s, m)) { if (offen && reiter === 'chronik') zeichne(); } };
  game.on('bauen:gebaut', (e) => { if (e?.name) merk({ a: 'bau', name: e.name }); });
  game.on('services:gebaut', (e) => { if (e?.name) merk({ a: 'bau', name: e.name }); });
  game.on('event:start', (e) => {
    const ev = e?.event;
    const name = typeof ev === 'object' ? (ev.title || ev.name || ev.id) : ev;
    if (name) merk({ a: 'ereignis', name: String(name) });
  });
  game.on('ziel:erreicht', () => merk({ a: 'ziel' }));
  game.on('wochenziel:erreicht', () => merk({ a: 'woche' }));
  // Neues Spiel: Tag 1 beginnt mit der Eröffnung
  function start() {
    const s = st();
    if (!s) return;
    gestartet = true;
    saeubern(s);
    const m = buchState(s);
    if (s.day === 1 && !s.guests && !m.chronik.length) merken(s, { a: 'start' });
    kat = null;
    menueZahl();
    if (offen) zeichne();
  }
  // Die Spielregeln kommen eventuell erst nach 'ready' (bridge.js lädt die Bootsdaten): beim ersten
  // Lebenszeichen nachholen
  let gestartet = false;
  game.on('sim:change', (d) => {
    if (d?.reason === 'load' || d?.reason === 'new' || !gestartet) { gestartet = !!st(); start(); }
  });

  // ---------------------------------------------------------------- Meldung "Neu im Logbuch"
  const leiste = el('div', { id: 'hm-lb-meldung', role: 'status', 'aria-live': 'polite', hidden: true });
  (document.getElementById('game') || document.body).append(leiste);
  const offeneMeldungen = [];             // neue Einträge, die noch gemeldet werden
  let jetzt = null;                       // { el, t0, n }
  let letzterTakt = 0;
  let rafAn = false;
  function meldeNeu(n) {
    offeneMeldungen.push(n);
    if (offeneMeldungen.length > 6) offeneMeldungen.splice(0, offeneMeldungen.length - 6);
    game.meldungen?.wunsch(MELDUNG_ID, VORRANG.logbuch ?? 22);
    if (!rafAn) { rafAn = true; letzterTakt = performance.now(); requestAnimationFrame(takt); }
  }
  function darf() {
    if (offen || document.body.classList.contains('foto') || document.body.classList.contains('hm-feier-an')) return false;
    return game.meldungen ? game.meldungen.darf(MELDUNG_ID) : true;
  }
  function zeigeMeldung() {
    // Mehrere neue zugleich (Tempo 8x, Morgen): eine Meldung mit Anzahl, Bild des ersten
    const liste = offeneMeldungen.splice(0);
    const erstes = liste.find((x) => x.art) ?? liste[0];
    const info = modellInfo(erstes.key);
    const name = info ? info.mo.name : namen(erstes.typeId, erstes.modelId).modell;
    const kopf = liste.length > 1 ? `${liste.length} neu im Logbuch` : erstes.art ? 'Neue Bootsart' : 'Neu im Logbuch';
    const img = el('img', { class: 'hm-lb-meldung-bild', alt: '', width: 84, height: 44 });
    if (info) maler.bild(info.mo).then((b) => { img.src = b.src; });
    const knopf = el('button', {
      type: 'button', class: 'hm-lb-meldung', title: 'Logbuch öffnen',
      'aria-label': `${kopf}: ${name}. Logbuch öffnen`,
      onclick: () => { schliesseMeldung(); oeffnen('boote', erstes.key); },
    }, img, el('span', { class: 'hm-lb-meldung-text' }, el('b', {}, kopf), el('span', {}, liste.length > 1 ? `${name} und ${liste.length - 1} weitere` : name)));
    leiste.replaceChildren(knopf);
    leiste.hidden = false;
    jetzt = { el: knopf, t0: performance.now() };
    game.audio?.sfx?.('hinweis');
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
  game.on('spielstand-geladen', () => { offeneMeldungen.length = 0; schliesseMeldung(); });

  // ---------------------------------------------------------------- Logbuch-Fenster
  const backdrop = el('div', { class: 'hm-lb-backdrop', hidden: true });
  const panel = el('section', { id: 'hm-logbuch', class: 'hm-px hm-lb', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'hm-lb-titel' });
  backdrop.append(panel);
  (document.getElementById('game') || document.body).append(backdrop);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) schliessen(); });
  backdrop.addEventListener('pointerdown', (e) => e.stopPropagation());
  backdrop.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });

  let offen = false;
  let reiter = 'boote';                   // 'boote' | 'chronik'
  let groesse = 'S';
  let steckbrief = null;                  // Modell-ID oder null
  let chronikMehr = 1;                    // wie viele Kapitel gezeigt werden
  let fokusVorher = null;

  function oeffnen(r = null, key = null) {
    const s = st();
    if (!s) return;
    if (!offen) fokusVorher = document.activeElement;
    if (r === 'boote' || r === 'chronik') reiter = r;
    steckbrief = null;
    chronikMehr = 1;
    if (key) {
      const info = modellInfo(key);
      if (info) { reiter = 'boote'; groesse = info.mo.size; steckbrief = key; }
    } else if (reiter === 'boote' && !offen) {
      // Größe mit dem neuesten ungelesenen Eintrag, sonst die größte, in der schon etwas steht
      const ung = buchState(s).ungelesen;
      const info = ung.length ? modellInfo(ung[ung.length - 1]) : null;
      if (info) groesse = info.mo.size;
      else {
        const f = fortschritt(s, kata());
        const mit = kata().filter((g) => f.je[g.size]?.gesehen).map((g) => g.size);
        if (mit.length) groesse = mit[mit.length - 1];
      }
    }
    offen = true;
    schliesseMeldung();
    zeichne();
    backdrop.hidden = false;
    document.body.classList.add('hm-lb-offen');
    panel.querySelector('.hm-lb-zu')?.focus({ preventScroll: true });
    game.audio?.sfx?.('klick');
  }
  function schliessen() {
    if (!offen) return;
    offen = false;
    backdrop.hidden = true;
    document.body.classList.remove('hm-lb-offen');
    // Was angesehen wurde, ist nicht mehr neu
    menueZahl();
    if (fokusVorher?.focus) fokusVorher.focus({ preventScroll: true });
  }
  function gelesen(keys) {
    const s = st();
    if (!s) return;
    const m = buchState(s);
    const vorher = m.ungelesen.length;
    m.ungelesen = m.ungelesen.filter((k) => !keys.includes(k));
    if (m.ungelesen.length !== vorher) menueZahl();
  }

  function bildEl(mo, schatten, gross = false) {
    const img = el('img', { class: `hm-lb-bild${schatten ? ' schatten' : ''}${gross ? ' gross' : ''}`, alt: '', width: 84, height: 44, decoding: 'async' });
    const da = maler.schonDa(mo, { schatten });
    if (da) img.src = da.src;
    else maler.bild(mo, { schatten }).then((b) => { img.src = b.src; });
    return img;
  }

  function kopf() {
    const tab = (id, text) => el('button', {
      type: 'button', role: 'tab', class: 'hm-lb-reiter', 'aria-selected': String(reiter === id), id: `hm-lb-tab-${id}`,
      onclick: () => { if (reiter !== id) { reiter = id; steckbrief = null; chronikMehr = 1; zeichne(true); } },
    }, text);
    return el('header', { class: 'hm-lb-kopf' },
      sym('logbuch', 'kopf-sym'),
      el('h2', { id: 'hm-lb-titel' }, 'Logbuch'),
      el('div', { class: 'hm-lb-reiterleiste', role: 'tablist' }, tab('boote', 'Boote'), tab('chronik', 'Chronik')),
      el('button', { type: 'button', class: 'hm-lb-zu', 'aria-label': 'Logbuch schließen', title: 'Schließen (Esc)', onclick: schliessen }, sym('zu')),
    );
  }

  function boote(s) {
    const k = kata();
    const f = fortschritt(s, k);
    const m = buchState(s);
    const anteil = f.gesamt ? f.gesehen / f.gesamt : 0;
    const oben = el('div', { class: 'hm-lb-stand' },
      el('div', { class: 'hm-lb-stand-text' },
        el('b', {}, `${f.gesehen} von ${f.gesamt}`), el('span', {}, ` Bootsmodellen · ${f.arten} von ${f.artenGesamt} Arten`)),
      el('div', { class: 'hm-lb-balken', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(f.gesamt), 'aria-valuenow': String(f.gesehen), 'aria-label': 'Gesammelte Bootsmodelle' },
        el('i', { style: `width: ${Math.round(anteil * 1000) / 10}%` })),
    );
    const chips = el('div', { class: 'hm-lb-groessen', role: 'tablist', 'aria-label': 'Bootsgröße' },
      k.map((g) => {
        const j = f.je[g.size];
        const neu = m.ungelesen.some((key) => modellInfo(key)?.mo.size === g.size);
        return el('button', {
          type: 'button', role: 'tab', class: `hm-lb-groesse${neu ? ' neu' : ''}`, 'aria-selected': String(groesse === g.size),
          title: GROESSE_NAME[g.size], onclick: () => { groesse = g.size; zeichne(true); },
        }, el('b', {}, g.size), el('span', {}, `${j.gesehen}/${j.gesamt}`));
      }));
    const gr = k.find((g) => g.size === groesse) ?? k[0];
    const arten = el('div', { class: 'hm-lb-arten' });
    const angesehen = [];
    for (const art of gr?.arten ?? []) {
      const zahl = art.modelle.filter((mo) => gesehen(s, art.id, mo.id)).length;
      const keine = !zahl;
      const titel = keine && (art.minStage > s.stage || art.unlock) ? 'Unbekannte Bootsart' : art.name;
      const raster = el('ul', { class: 'hm-lb-raster' });
      for (const mo of art.modelle) {
        const da = gesehen(s, art.id, mo.id);
        const neu = m.ungelesen.includes(mo.id);
        if (neu) angesehen.push(mo.id);
        raster.append(el('li', {}, el('button', {
          type: 'button', class: `hm-lb-karte${da ? '' : ' fehlt'}${neu ? ' neu' : ''}`,
          'aria-label': da ? `${mo.name}, ${art.name}. Steckbrief öffnen` : `Noch nicht im Logbuch. ${fehltText(art, mo, s.stage)}`,
          onclick: () => { if (da) { steckbrief = mo.id; zeichne(); } else knappHinweis(mo.id, fehltText(art, mo, s.stage)); },
        },
        bildEl(mo, !da),
        el('span', { class: 'hm-lb-name' }, da ? mo.name : '???'),
        el('span', { class: 'hm-lb-klein', 'data-modell': mo.id }, da ? tagKurz(m.erst[mo.id]) : fehltText(art, mo, s.stage)),
        neu ? el('span', { class: 'hm-lb-neu' }, 'neu') : null)));
      }
      arten.append(el('section', { class: 'hm-lb-art' },
        el('h3', {}, el('span', {}, titel), el('span', { class: 'hm-lb-zahl' }, `${zahl}/${art.modelle.length}`)), raster));
    }
    // Was jetzt zu sehen war, ist gelesen (die Markierung bleibt bis zum nächsten Öffnen stehen)
    if (angesehen.length) setTimeout(() => gelesen(angesehen), 0);
    return [oben, chips, arten];
  }
  const tagKurz = (e) => (e?.tag ? `Tag ${e.tag}` : e ? 'vor dem Logbuch' : '');

  function knappHinweis(key, text) {
    const k = panel.querySelector(`.hm-lb-klein[data-modell="${CSS.escape(key)}"]`);
    if (!k) return;
    k.textContent = text;
    k.closest('.hm-lb-karte')?.classList.add('wackeln');
    setTimeout(() => k.closest('.hm-lb-karte')?.classList.remove('wackeln'), 400);
  }

  function steckbriefTeil(s) {
    const info = modellInfo(steckbrief);
    if (!info) { steckbrief = null; return boote(s); }
    const { art, mo } = info;
    const e = buchState(s).erst[mo.id];
    // Nachbarn zum Blättern (nur gesehene Modelle derselben Größe)
    const gr = kata().find((g) => g.size === mo.size);
    const reihe = gr.arten.flatMap((a) => a.modelle.filter((x) => gesehen(s, a.id, x.id)));
    const i = reihe.findIndex((x) => x.id === mo.id);
    const blaettern = (d) => { const n = reihe[(i + d + reihe.length) % reihe.length]; if (n) { steckbrief = n.id; zeichne(); } };
    return [el('div', { class: 'hm-lb-steckbrief' },
      el('div', { class: 'hm-lb-sb-leiste' },
        el('button', { type: 'button', class: 'hm-lb-zurueck', onclick: () => { steckbrief = null; zeichne(); } }, sym('zurueck'), 'Alle Boote'),
        reihe.length > 1 ? el('span', { class: 'hm-lb-klein' }, `${i + 1} von ${reihe.length}`) : null),
      el('div', { class: 'hm-lb-sb-bild' },
        reihe.length > 1 ? el('button', { type: 'button', class: 'hm-lb-pfeil links', 'aria-label': 'Voriges Boot', onclick: () => blaettern(-1) }, sym('zurueck')) : null,
        bildEl(mo, false, true),
        reihe.length > 1 ? el('button', { type: 'button', class: 'hm-lb-pfeil rechts', 'aria-label': 'Nächstes Boot', onclick: () => blaettern(1) }, sym('zurueck')) : null),
      el('h3', {}, mo.name),
      el('p', { class: 'hm-lb-art-name' }, `${art.name} · Größe ${mo.size}`),
      el('p', {}, masse(mo)),
      mo.shape ? el('p', { class: 'hm-lb-form' }, `${mo.shape[0].toUpperCase()}${mo.shape.slice(1)}.`) : null,
      el('p', { class: 'hm-lb-erst' }, erstText(e)),
    )];
  }

  function chronikTeil(s) {
    const m = buchState(s);
    const teile = [];
    // Der laufende Tag oben, solange er noch Merkmale sammelt
    const heute = offeneMerk(s, s.day);
    if (heute.length) {
      teile.push(el('div', { class: 'hm-lb-heute' }, el('b', {}, `Heute, Tag ${s.day}`), el('span', {}, saetze({ merk: heute, angelegt: 1 }).join(' '))));
    }
    const kapitel = chronikAnsicht(m.chronik);
    if (!kapitel.length) {
      teile.push(el('p', { class: 'hm-lb-klein' }, 'Jeden Abend schreibt der Hafenmeister hier eine Zeile über den Tag.'));
      return teile;
    }
    const zeige = kapitel.slice(0, chronikMehr);
    for (const k of zeige) {
      const ol = el('ol', { class: 'hm-lb-tage' });
      for (const z of k.zeilen) {
        const s2 = saetze(z);
        const zahlen = zahlenText(z);
        ol.append(el('li', { class: `${z.winter ? 'winter' : ''}${z.merk?.some((x) => x.a === 'stufe' || x.a === 'region' || x.a === 'start') ? ' wichtig' : ''}`.trim() },
          el('b', { class: 'hm-lb-tag' }, tagTitel(z)),
          el('span', { class: 'hm-lb-satz' }, s2.join(' ')),
          zahlen ? el('span', { class: 'hm-lb-klein' }, zahlen) : null));
      }
      teile.push(el('section', { class: 'hm-lb-kapitel' }, el('h3', {}, `Stufe ${k.stufe}`, el('span', { class: 'hm-lb-zahl' }, `ab Tag ${k.zeilen[k.zeilen.length - 1].tag}`)), ol));
    }
    if (kapitel.length > chronikMehr) {
      teile.push(el('button', { type: 'button', class: 'hm-lb-mehr', onclick: () => { chronikMehr += 2; zeichne(); } }, 'Frühere Kapitel zeigen'));
    }
    if (m.ab > 1) teile.push(el('p', { class: 'hm-lb-klein hm-lb-fuss' }, `Das Logbuch wird seit Tag ${m.ab} geführt; frühere Tage stehen nur zusammengefasst darin.`));
    return teile;
  }

  function zeichne(nachOben = false) {
    const s = st();
    if (!s) return;
    const koerperAlt = panel.querySelector('.hm-lb-koerper');
    const scroll = nachOben || steckbrief ? 0 : koerperAlt?.scrollTop ?? 0;
    const inhalt = reiter === 'chronik' ? chronikTeil(s) : steckbrief ? steckbriefTeil(s) : boote(s);
    const koerper = el('div', { class: 'hm-lb-koerper', role: 'tabpanel', 'aria-labelledby': `hm-lb-tab-${reiter}` }, ...inhalt);
    panel.replaceChildren(kopf(), koerper);
    koerper.scrollTop = scroll;
  }

  // ---------------------------------------------------------------- Menü
  const zahlEl = el('span', { class: 'hm-lb-menue-zahl', hidden: true });
  const menueZeile = el('button', { type: 'button', id: 'btn-logbuch', class: 'hm-zeile', role: 'menuitem', onclick: () => oeffnen() },
    el('i', { class: 'hm-sym', 'aria-hidden': 'true', style: '--sym: var(--px-lb-logbuch)' }), 'Logbuch', zahlEl);
  function menueZahl() {
    const s = st();
    const n = s ? buchState(s).ungelesen.length : 0;
    zahlEl.hidden = !n || offen;
    zahlEl.textContent = n ? `${n} neu` : '';
  }
  function menueEinhaengen() {
    const m = document.getElementById('hm-menue');
    if (!m || menueZeile.parentNode === m) return;
    // gleich hinter dem Gästebuch, sonst ans Ende
    const gb = document.getElementById('btn-gaestebuch');
    if (gb && gb.parentNode === m) gb.after(menueZeile); else m.append(menueZeile);
  }
  game.on('ready', () => { start(); menueEinhaengen(); setTimeout(menueEinhaengen, 0); });
  game.on('ui:cancel', schliessen);
  window.addEventListener('keydown', (e) => {
    if (e.target?.closest?.('input, textarea, select, [contenteditable]')) return;
    if (offen && e.key === 'Escape') { if (steckbrief) { steckbrief = null; zeichne(); } else schliessen(); e.preventDefault(); return; }
    if (offen && steckbrief && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      panel.querySelector(`.hm-lb-pfeil.${e.key === 'ArrowLeft' ? 'links' : 'rechts'}`)?.click();
      e.preventDefault();
      return;
    }
    if (e.code === 'KeyJ' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (offen) schliessen(); else oeffnen();
    }
  });

  game.logbuch = {
    oeffnen, schliessen, get offen() { return offen; },
    fortschritt: () => (st() ? fortschritt(st(), kata()) : null),
    chronik: () => (st() ? buchState(st()).chronik : []),
    // Was den Tag ausgemacht hat (nur Merkmale, keine Zahlen), für die Karte des Tagesabschlusses.
    // Die Karte baut sich am Abend vor der Chronik-Zeile auf: dann zählen die noch offenen Merkmale.
    tagesSatz: (tag) => {
      const s = st();
      if (!s) return '';
      abarbeiten();
      const m = buchState(s);
      const z = m.chronik.find((x) => x.tag === tag);
      const merk = z ? z.merk : m.offen.map(({ t, ...rest }) => rest);
      return merk?.length ? saetze({ merk, angelegt: 1 })[0] : '';
    },
    merken: (m) => merk(m),
    LOGBUCH,
  };
}

export default init;
