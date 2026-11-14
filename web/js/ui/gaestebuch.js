// Bewertungen sichtbar machen (Roadmap P14: Ü21, F18, C1, C9). Beschreibung: docs/gaestebuch.md.
//
// 1. Beim Ablegen zeigt jedes Gastboot seine Note in einer Blase über dem Boot (Stern und Zahl).
//    Unzufriedene Gäste (unter 4 Sternen) zeigen dazu das Symbol, was ihnen gefehlt hat, durchgestrichen.
// 2. Gästebuch: die letzten 20 Bewertungen mit Satz und Grund (der Ruf ist der Schnitt der letzten drei Tage),
//    der Ruf-Verlauf der letzten 30 Tage und die drei häufigsten Gründe für schlechte Noten.
//    Öffnen: Ruf oben links antippen, Menü "Gästebuch", Hafenmeister-Haus oder Hafenbüro antippen, Taste N (G ist 8x).
//
// Daten und Texte: ui/gaestebuch-daten.js (ohne Browser, tests/gaestebuch.test.mjs).
// Schnittstelle: game.gaestebuch = { oeffnen(), schliessen(), get offen, eintraege(), topGruende() }
// Ereignis: 'gaestebuch:bewertung' { id, note, grund, zufrieden } sobald eine Blase erscheint.

import {
  GAESTEBUCH, GRUND, buchState, eintragen, hauptgrund, topGruende, zusammenfassung, verlauf, satz, absender,
  erklaerung, zufrieden, rufErklaerung,
} from './gaestebuch-daten.js';
import { VORRANG } from './meldungen.js';
import { ANGEBOT_BILDER } from './wunsch-bilder.js';
import { ANGEBOT_TEXTE } from '../data/wuensche-texte.js';

// ------------------------------------------------------------------ Pixel-Symbole (12 x 12, wie ui/oberflaeche.js)
const FARBE = { s: '#e0962a', y: '#ffd95a', o: '#7a5212' };
const PIXEL = {
  wc: ['............', '.##.....###.', '.##....#####', '....#..#####', '.####..#####', '.####...###.', '.####...###.', '.#..#..#####', '.#..#..#####', '.#..#...#.#.', '.#..#...#.#.', '............'],
  dusche: ['.######.....', '.#....#.....', '.#...####...', '.#..######..', '.#..........', '.#..#.#.#...', '.#.#.#.#....', '.#..#.#.#...', '.#.#.#.#....', '.#..#.#.#...', '.#..........', '###.........'],
  essen: ['............', '..#.#.#..##.', '..#.#.#.###.', '..#.#.#.###.', '..#####.###.', '...###..###.', '....#...###.', '....#....#..', '....#....#..', '....#....#..', '....#....#..', '............'],
  strom: ['......##....', '.....##.....', '....##......', '...##.......', '..########..', '.......##...', '......##....', '.....##.....', '....##......', '...##.......', '..##........', '............'],
  diesel: ['............', '.######.....', '.#....#.##..', '.#....#..#..', '.######..#..', '.######..#..', '.######..#..', '.######.##..', '.######.#...', '.######.....', '########....', '............'],
  sturm: ['............', '....####....', '..########..', '.##########.', '..########..', '............', '.#..#..#..#.', '#..#..#..#..', '............', '.##..##..##.', '#..##..##..#', '............'],
  umbau: ['............', '.#######....', '.#.....##...', '.#######.#..', '.....##..#..', '....##...#..', '...##....#..', '..##.....#..', '.##.....###.', '##......###.', '#.......###.', '............'],
  warten: ['............', '...######...', '..#......#..', '.#...#....#.', '.#...#....#.', '.#...#....#.', '.#...####.#.', '.#........#.', '.#........#.', '..#......#..', '...######...', '............'],
  buch: ['............', '.####..####.', '#....##....#', '#.##.##.##.#', '#....##....#', '#.##.##.##.#', '#....##....#', '#.##.##.##.#', '#....##....#', '#....##....#', '.####..####.', '............'],
  zu: ['............', '.##......##.', '.###....###.', '..###..###..', '...######...', '....####....', '....####....', '...######...', '..###..###..', '.###....###.', '.##......##.', '............'],
};

// Wünsche an Angebote an Land (P19): dieselben Bilder wie über dem Boot (ui/wunsch-bilder.js)
for (const [k, b] of Object.entries(ANGEBOT_BILDER)) PIXEL[k] = b.raster;

function pixelSvg(raster) {
  const h = raster.length;
  const w = Math.max(...raster.map((z) => z.length));
  let r = '';
  raster.forEach((zeile, y) => {
    [...zeile].forEach((c, x) => {
      if (c === '.' || c === ' ') return;
      r += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${c === '#' ? 'black' : FARBE[c] ?? 'black'}"/>`;
    });
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${r}</svg>`;
}
const url = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

const num1 = (n) => Number(n).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

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
const sym = (name, cls = '') => el('i', { class: `hm-gb-sym ${cls}`.trim(), 'aria-hidden': 'true', style: `--gb-sym: var(--px-gb-${name})` });

// Gebäude, an denen das Gästebuch liegt (render/buildings.js)
const BUERO = new Set(['hafenmeister', 'hafenbuero']);

export function init(game) {
  if (typeof document === 'undefined') return;

  // Aussehen
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('../../css/gaestebuch.css', import.meta.url).href;
  document.head.append(link);
  const vars = Object.entries(PIXEL).map(([k, v]) => `--px-gb-${k}: ${url(pixelSvg(v))};`).join('\n  ');
  document.head.append(el('style', { id: 'hm-gaestebuch-grafik' }, `:root {\n  ${vars}\n}`));

  const state = () => game.state;

  // ---------------------------------------------------------------- Bewertungen mitschreiben
  game.on('sim:departed', (e) => { if (state()) eintragen(state(), e); if (offen) zeichne(); });
  game.on('sim:turnedAway', (e) => { if (state() && e?.rated) eintragen(state(), e); if (offen) zeichne(); });
  game.on('sim:dismissed', (e) => { if (state() && e?.rated) eintragen(state(), e); if (offen) zeichne(); });
  game.on('sim:dayEnd', (e) => { if (state()) eintragen(state(), e); if (offen) zeichne(); });

  // ---------------------------------------------------------------- Blasen über ablegenden Booten
  const blasenEbene = el('div', { id: 'hm-gb-blasen', 'aria-hidden': 'true' });
  (document.getElementById('game') || document.body).append(blasenEbene);
  const blasen = new Map();            // bootId -> { el, t0, eintrag }
  const DAUER = 4200;                  // ms sichtbar (echte Zeit, auch beim Vorspulen lesbar)
  let letzterTon = 0;

  // Unzufriedene zeigen über dem Boot, was gefehlt hat: Symbol mit rotem Schrägstrich
  const fehltTeil = (grund) => (grund && GRUND[grund]
    ? el('span', { class: 'hm-gb-fehlt', title: GRUND[grund].lang }, sym(GRUND[grund].sym), el('i', { class: 'hm-gb-strich' }))
    : null);
  const blasenInhalt = (eintrag, grund) => [sym('stern', 'stern'), el('b', {}, num1(eintrag.note)), fehltTeil(grund)];

  // Legen viele Boote auf einmal ab (morgens, Tempo 8x), erscheinen die Blasen nacheinander
  const warteschlange = [];
  let naechsteAb = 0;
  const ABSTAND = 260;                 // ms zwischen zwei Blasen

  function zeigeBlase(id) {
    const st = state();
    if (!st) return;
    const eintrag = buchState(st).eintraege.find((x) => x.id === id && !x.gezeigt);
    if (!eintrag) return;
    eintrag.gezeigt = true;
    const grund = hauptgrund(eintrag);
    const gut = zufrieden(eintrag);
    const anim = game.boatView?.boot?.(id);
    const pos = anim?.model ? bildschirm(anim, 0) : null;
    if (pos?.sichtbar) warteschlange.push({ id, eintrag, grund, gut, anim, seit: performance.now() });
    else meldung(eintrag, grund, gut);       // Boot nicht im Bild: kurze Meldung am Rand
    const jetzt = performance.now();
    if (jetzt - letzterTon > 700) {
      letzterTon = jetzt;
      game.audio?.sfx?.('bewertung', { anker: eintrag.note });
    }
    game.emit('gaestebuch:bewertung', { id, note: eintrag.note, grund, zufrieden: gut, imBild: !!pos?.sichtbar });
    if (!rafLaeuft) { rafLaeuft = true; letztesBild = performance.now(); requestAnimationFrame(schritt); }
  }

  function starte(x) {
    const b = el('div', { class: `hm-gb-blase ${x.gut ? 'gut' : 'schlecht'}` }, ...blasenInhalt(x.eintrag, x.grund));
    blasenEbene.append(b);
    blasen.get(x.id)?.el.remove();
    blasen.set(x.id, { el: b, t0: performance.now(), anim: x.anim, versatz: 0 });
  }

  // Bildschirmlage über dem Boot (Pixel im Spielbereich)
  function bildschirm(anim, hoch) {
    const cam = game.camera?.camera;
    const m = anim?.model;
    if (!cam || !m || !m.parent) return null;
    const h = Math.max(2.4, (m.userData?.iconHeight ?? (anim.info?.length ?? 6) * 0.35) + 1.6);
    const v = m.position.clone();
    v.y += h;
    v.project(cam);
    const w = game.camera.screenW ?? window.innerWidth;
    const hh = game.camera.screenH ?? window.innerHeight;
    return {
      x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * hh - hoch,
      sichtbar: v.z < 1 && Math.abs(v.x) < 0.98 && v.y < 1.05 && v.y > -0.95,
    };
  }

  const HINDERNISSE = ['.hm-status', '.hm-werkzeuge', '#hm-seite > *', '#hm-zeit', '#btn-build', '#btn-collect', '.hm-gb-meldung', '.hm-tipp', '#card:not([hidden])'].join(', ');
  let gemessen = 0;
  let spiel = null;
  let hindernisse = [];
  let rafLaeuft = false;
  let letztesBild = performance.now();
  function schritt() {
    const jetzt = performance.now();
    // Während der Feier (features/aufstieg.js) sind Blasen und Meldungen ausgeblendet und ihre Zeit steht
    const seitBild = jetzt - letztesBild;
    letztesBild = jetzt;
    if (document.body.classList.contains('hm-feier-an')) {
      for (const x of blasen.values()) x.t0 += seitBild;
      for (const x of meldungen.values()) x.t0 += seitBild;
      for (const x of warteschlange) x.seit += seitBild;
      naechsteAb = Math.max(naechsteAb, jetzt + ABSTAND);
      letzterTakt = jetzt;   // die Leiste der Meldungen zählt die Feier nicht noch einmal
      if (blasen.size || warteschlange.length || meldungen.size) requestAnimationFrame(schritt);
      else rafLaeuft = false;
      return;
    }
    // höchstens fünf Blasen zugleich; wer wartet, verfällt nach einer Blasendauer (das Boot ist dann weit weg)
    while (warteschlange.length && warteschlange[0].seit < jetzt - DAUER) warteschlange.shift();
    while (warteschlange.length && jetzt >= naechsteAb && blasen.size < 5) { starte(warteschlange.shift()); naechsteAb = jetzt + ABSTAND; }
    // Lage jeder Blase, dann Überlappungen auflösen: jüngere weichen nach oben aus
    const belegt = [];
    // Feste Teile der Oberfläche (Status, Seite, Zeit, Bauen, Meldungen): Blasen darunter werden blass
    // Lagen der Oberfläche nur alle 300 ms neu messen (spart Layout-Arbeit in jedem Bild)
    if (jetzt - gemessen > 300 || !blasen.size) {
      gemessen = jetzt;
      spiel = blasenEbene.getBoundingClientRect();
      hindernisse = [];
      if (blasen.size) {
        for (const e of document.querySelectorAll(HINDERNISSE)) {
          const r = e.getBoundingClientRect();
          if (r.width && r.height) hindernisse.push(r);
        }
      }
    }
    for (const [id, x] of [...blasen].sort((a, b) => a[1].t0 - b[1].t0)) {
      const t = (jetzt - x.t0) / DAUER;
      const p = bildschirm(x.anim, Math.min(1, t * 4) * 14);
      if (!p || t >= 1) { x.el.remove(); blasen.delete(id); continue; }
      const bw = x.el.offsetWidth || 80;
      const bh = x.el.offsetHeight || 34;
      let links = p.x - bw / 2;
      let oben = p.y - bh;
      for (let i = 0; i < 8; i++) {
        const stoss = belegt.find((r) => links < r.rechts && r.links < links + bw && oben < r.unten && r.oben < oben + bh);
        if (!stoss) break;
        oben = stoss.oben - bh - 2;
      }
      // sanft zur neuen Lage gleiten statt springen
      x.versatz = x.versatz + ((p.y - bh - oben) - x.versatz) * 0.35;
      oben = p.y - bh - x.versatz;
      belegt.push({ links, rechts: links + bw, oben, unten: oben + bh });
      x.el.style.transform = `translate(${Math.round(links)}px, ${Math.round(oben)}px)`;
      const L = links + spiel.left, O = oben + spiel.top;
      const unter = hindernisse.some((r) => L < r.right && r.left < L + bw && O < r.bottom && r.top < O + bh);
      const deck = unter ? 0.2 : 1;
      x.el.style.opacity = p.sichtbar ? String(deck * (t < 0.8 ? 1 : Math.max(0, (1 - t) / 0.2))) : '0';
    }
    // Meldungs-Ordnung (ui/meldungen.js): Steht gerade Wichtigeres, wartet die Leiste ausgeblendet,
    // ihre Zeit läuft solange nicht ab
    const darf = leisteFrei();
    const dt = jetzt - (letzterTakt || jetzt);
    letzterTakt = jetzt;
    for (const [id, x] of meldungen) {
      if (!darf) { x.t0 += dt; continue; }
      if (jetzt - x.t0 > MELDUNG_DAUER) { x.el.remove(); meldungen.delete(id); }
    }
    if (!meldungen.size) leisteFertig();
    if (blasen.size || warteschlange.length || meldungen.size) requestAnimationFrame(schritt);
    else rafLaeuft = false;
  }

  // Boot außerhalb des Bildes: Meldung rechts oben unter den Knöpfen (höchstens drei, antippen öffnet das Gästebuch)
  const meldungsLeiste = el('div', { id: 'hm-gb-meldungen', role: 'status', 'aria-live': 'polite' });
  (document.getElementById('game') || document.body).append(meldungsLeiste);
  const meldungen = new Map();
  const MELDUNG_DAUER = 3600;
  let meldungNr = 0;
  let letzterTakt = 0;
  const MELDUNG_ID = 'gaestebuch';
  function leisteFrei() {
    if (!meldungen.size) return true;
    game.meldungen?.wunsch(MELDUNG_ID, VORRANG.gaestebuch);
    const darf = game.meldungen ? game.meldungen.darf(MELDUNG_ID) : true;
    meldungsLeiste.hidden = !darf;
    return darf;
  }
  function leisteFertig() { game.meldungen?.fertig(MELDUNG_ID); meldungsLeiste.hidden = false; letzterTakt = 0; }
  game.on('meldungen:wechsel', () => { if (meldungen.size) leisteFrei(); });
  function meldung(eintrag, grund, gut) {
    const name = eintrag.boot?.bootsname ? `„${eintrag.boot.bootsname}“` : (eintrag.boot?.name || 'Gast');
    const m = el('button', {
      type: 'button', class: `hm-gb-meldung ${gut ? 'gut' : 'schlecht'}`, title: 'Gästebuch öffnen',
      'aria-label': `${name} bewertet mit ${num1(eintrag.note)} Sternen. Gästebuch öffnen`,
      onclick: () => oeffnen(),
    }, ...blasenInhalt(eintrag, grund), el('span', { class: 'hm-gb-meldung-name' }, name));
    meldungsLeiste.prepend(m);
    const nr = ++meldungNr;
    meldungen.set(nr, { el: m, t0: performance.now() });
    leisteFrei();
    while (meldungen.size > 3) {
      const [alt] = meldungen.keys();
      meldungen.get(alt).el.remove();
      meldungen.delete(alt);
    }
  }

  // Die Spielregeln melden das Ablegen vor 'boot-faehrt'; dann ist das Boot noch da, auch wenn
  // render/boat-view.js es gleich danach wegräumt, weil es niemand sieht.
  game.on('sim:castOff', (e) => { if (e?.boatId != null) zeigeBlase(e.boatId); });
  game.on('sim:departed', (e) => { if (e?.boatId != null && !(e.leaveAt > 0)) zeigeBlase(e.boatId); });
  game.on('sim:turnedAway', (e) => { if (e?.rated) zeigeBlase(e.boatId); });
  game.on('sim:dismissed', (e) => { if (e?.rated) zeigeBlase(e.boatId); });
  game.on('boot-faehrt', ({ id } = {}) => { if (id != null) zeigeBlase(id); });
  game.on('spielstand-geladen', () => {
    for (const x of blasen.values()) x.el.remove();
    for (const x of meldungen.values()) x.el.remove();
    blasen.clear();
    meldungen.clear();
    leisteFertig();
    warteschlange.length = 0;
  });

  // ---------------------------------------------------------------- Gästebuch
  const backdrop = el('div', { class: 'hm-gb-backdrop', hidden: true });
  const panel = el('section', { id: 'hm-gaestebuch', class: 'hm-px hm-gb', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'hm-gb-titel' });
  backdrop.append(panel);
  (document.getElementById('game') || document.body).append(backdrop);
  let offen = false;
  let fokusVorher = null;

  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) schliessen(); });
  backdrop.addEventListener('pointerdown', (e) => e.stopPropagation());
  backdrop.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });

  function oeffnen() {
    if (!state()) return;
    fokusVorher = document.activeElement;
    offen = true;
    zeichne();
    backdrop.hidden = false;
    document.body.classList.add('hm-gb-offen');
    panel.querySelector('.hm-gb-zu')?.focus({ preventScroll: true });
    game.audio?.sfx?.('klick');
  }
  function schliessen() {
    if (!offen) return;
    offen = false;
    backdrop.hidden = true;
    document.body.classList.remove('hm-gb-offen');
    if (fokusVorher?.focus) fokusVorher.focus({ preventScroll: true });
  }

  function verlaufSvg(v) {
    // Säulen in Pixeln: Höhe = Ruf (1 bis 5), Linie bei 4 (zufrieden)
    const n = Math.max(v.length, 7);
    const W = n * 6;
    const H = 34;
    const y = (ruf) => Math.round(H - 2 - ((ruf - 1) / 4) * (H - 4));
    let r = '';
    v.forEach((p, i) => {
      const x = (n - v.length + i) * 6;
      const top = y(p.ruf);
      const farbe = p.ruf >= 4 ? '#23897d' : p.ruf >= 3 ? '#f2c14e' : '#ee6454';
      r += `<rect x="${x + 1}" y="${top}" width="4" height="${H - 2 - top}" fill="${farbe}"${p.heute ? ' opacity="0.6"' : ''}/>`;
    });
    const l4 = y(4);
    for (let x = 0; x < W; x += 3) r += `<rect x="${x}" y="${l4}" width="1" height="1" fill="#24364a" opacity="0.5"/>`;
    r += `<rect x="0" y="${H - 2}" width="${W}" height="1" fill="#24364a" opacity="0.6"/>`;
    return `<svg class="hm-gb-kurve" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" shape-rendering="crispEdges" role="img" aria-label="Ruf der letzten ${v.length} Tage">${r}</svg>`;
  }

  function bauKnopf(key) {
    // Versorgung baut das Bauwerk, ein Angebotswunsch den Service (P19)
    const ziel = { wc: 'versorgung:wc', dusche: 'versorgung:dusche', essen: 'versorgung:essen', diesel: 'versorgung:diesel', strom: 'versorgung:strom' }[key]
      ?? (ANGEBOT_TEXTE[key] ? `angebot:${ANGEBOT_TEXTE[key].service}` : null);
    if (!ziel || !game.bauen?.eintraege) return null;
    let e = null;
    try { e = game.bauen.eintraege().find((x) => x.key === ziel); } catch { e = null; }
    if (!e) return null;
    if (e.gesperrt) return el('span', { class: 'hm-gb-spaeter' }, e.gesperrt);
    return el('button', {
      type: 'button', class: 'hm-gb-bauen',
      onclick: () => { schliessen(); game.bauen.vorschau(e.key); },
    }, `${e.name} bauen`);
  }

  function zeichne() {
    const st = state();
    if (!st) return;
    const z = zusammenfassung(st);
    const ruf = game.sim?.reputation?.() ?? 3;
    const v = verlauf(st);
    const top = topGruende(st);
    const liste = buchState(st).eintraege;

    const kopf = el('header', { class: 'hm-gb-kopf' },
      sym('buch', 'kopf-sym'),
      el('h2', { id: 'hm-gb-titel' }, 'Gästebuch'),
      el('button', { type: 'button', class: 'hm-gb-zu', 'aria-label': 'Gästebuch schließen', title: 'Schließen (Esc)', onclick: schliessen }, sym('zu')),
    );

    const rufTeil = el('div', { class: 'hm-gb-ruf' },
      el('div', { class: 'hm-gb-ruf-zahl' }, sym('stern', 'stern'), el('b', {}, num1(ruf)), el('span', {}, 'Ruf')),
      el('div', { class: 'hm-gb-verlauf' }),
      el('p', { class: 'hm-gb-klein' },
        v.length > 1 ? `Ruf der letzten ${v.length} Tage. Linie: 4 Sterne, ab da sind Gäste zufrieden.` : 'Hier wächst der Verlauf deines Rufs, Tag für Tag.'),
    );
    rufTeil.querySelector('.hm-gb-verlauf').innerHTML = verlaufSvg(v);

    const gruendeTeil = el('div', { class: 'hm-gb-gruende' }, el('h3', {}, 'Was Gästen gefehlt hat'));
    if (top.length) {
      const ol = el('ol');
      for (const g of top) {
        const def = GRUND[g.key];
        ol.append(el('li', {},
          sym(def?.sym ?? 'warten'),
          el('span', { class: 'hm-gb-grund' }, def?.lang ?? g.key),
          el('span', { class: 'hm-gb-anzahl' }, `${g.gaeste} von ${z.anzahl}`),
          bauKnopf(g.key),
        ));
      }
      gruendeTeil.append(ol);
    } else {
      gruendeTeil.append(el('p', { class: 'hm-gb-klein' }, z.anzahl ? 'Niemand hatte etwas zu meckern.' : 'Noch keine Bewertungen. Die ersten Gäste schreiben, wenn sie ablegen.'));
    }

    const listeTeil = el('div', { class: 'hm-gb-liste' },
      el('h3', {}, z.anzahl ? `Letzte ${z.anzahl} Bewertungen · ${z.zufrieden} zufrieden` : 'Letzte Bewertungen'));
    const ul = el('ul');
    for (const e of liste) {
      const gut = zufrieden(e);
      const g = hauptgrund(e);
      ul.append(el('li', { class: gut ? 'gut' : 'schlecht' },
        el('div', { class: 'hm-gb-note' }, sym('stern', 'stern'), el('b', {}, num1(e.note))),
        el('div', { class: 'hm-gb-text' },
          el('div', { class: 'hm-gb-wer' }, el('b', {}, absender(e)), el('span', {}, ` · Tag ${e.tag}${e.platz ? ` · Platz ${e.platz}` : ''}`)),
          el('q', {}, satz(e)),
          erklaerung(e) ? el('div', { class: 'hm-gb-warum' }, g && GRUND[g] ? sym(GRUND[g].sym) : null, erklaerung(e)) : null,
        ),
      ));
    }
    if (liste.length) listeTeil.append(ul);

    const fuss = el('p', { class: 'hm-gb-klein hm-gb-fuss' },
      rufErklaerung(state()));

    const koerper = el('div', { class: 'hm-gb-koerper' }, rufTeil, gruendeTeil, listeTeil, fuss);
    const scroll = panel.querySelector('.hm-gb-koerper')?.scrollTop ?? 0;
    panel.replaceChildren(kopf, koerper);
    koerper.scrollTop = scroll;
  }

  // ---------------------------------------------------------------- Öffnen
  // Ruf oben links antippen
  function rufKnopf() {
    const rep = document.getElementById('rep');
    if (!rep || rep.dataset.gb) return;
    rep.dataset.gb = '1';
    rep.classList.add('hm-gb-auf');
    rep.setAttribute('role', 'button');
    rep.tabIndex = 0;
    rep.addEventListener('click', (e) => { e.stopPropagation(); oeffnen(); });
    rep.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); oeffnen(); } });
  }
  // Menüzeile (ui/oberflaeche.js räumt bekannte Knöpfe ein, diese hängt sich selbst an)
  const menueZeile = el('button', { type: 'button', id: 'btn-gaestebuch', class: 'hm-zeile', role: 'menuitem', onclick: () => oeffnen() },
    el('i', { class: 'hm-sym', 'aria-hidden': 'true', style: '--sym: var(--px-gb-buch)' }), 'Gästebuch');
  function menueEinhaengen() {
    const m = document.getElementById('hm-menue');
    if (m && menueZeile.parentNode !== m) m.append(menueZeile);
  }

  game.on('ready', () => { rufKnopf(); menueEinhaengen(); setTimeout(() => { rufKnopf(); menueEinhaengen(); }, 0); });
  game.on('tap', ({ pick } = {}) => { if (pick?.type === 'building' && BUERO.has(pick.id)) oeffnen(); });
  game.on('ui:cancel', schliessen);
  window.addEventListener('keydown', (e) => {
    if (e.target?.closest?.('input, textarea, select, [contenteditable]')) return;
    if (offen && e.key === 'Escape') { schliessen(); e.preventDefault(); return; }
    if (e.code === 'KeyN' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (offen) schliessen(); else oeffnen();
    }
  });
  game.on('sim:change', (d) => { if (d?.reason === 'load' || d?.reason === 'new') { if (offen) zeichne(); } });

  game.gaestebuch = {
    oeffnen, schliessen, get offen() { return offen; },
    eintraege: () => (state() ? buchState(state()).eintraege : []),
    topGruende: () => (state() ? topGruende(state()) : []),
  };
}

export default init;
