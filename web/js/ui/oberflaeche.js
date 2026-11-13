// Oberfläche: von Grund auf neu, ein Pixel-Stil für PC, Tablet und Handy.
// Aussehen: web/css/oberflaeche.css. Konzept und Begründung: docs/ui/oberflaeche.md.
//
// Anordnung nach Daumenzonen (Recherche in docs/ui/oberflaeche.md):
//   oben links    .hm-status    Kasse und Ruf (nur ansehen)
//   oben rechts   .hm-werkzeuge Übersicht, Menü (selten gebraucht)
//   links         #hm-seite     Wetter, Tagesziele, Ziel der nächsten Stufe (aufklappbar)
//   unten links   #hm-zeit      Tag, Tagesbalken mit Sonne/Mond als Anzeige, Tempo: Pause, 1x, 3x, 8x (linker Daumen), Taste F = 3x
//   unten Mitte   #btn-collect  Kassieren (abends)
//   unten rechts  #btn-build    Bauen (rechter Daumen, Hauptaktion)
//
// Die Knöpfe anderer Module (Foto, Ton, Spielstand, Tastenhilfe, Wetter, Tagesziele) werden in
// diese Bereiche eingeräumt, ihre IDs bleiben. Die alte Sonne aus ui/gesten.js gibt es nicht mehr;
// das Tempo setzt dieses Modul (game.speed, Ereignis 'ui:vorspulen', wie bisher).

// ------------------------------------------------------------------ Pixel-Grafik
// Symbole (Raster, Farben, SVG) stehen in ui/pixel-symbole.js, damit alle Schilder denselben Satz nutzen.
import { PIXEL, pixelSvg } from './pixel-symbole.js';

// Rahmen als 9-Teile-Bild: Umriss, Licht oben, Schatten unten, Pixel-Ecken, harter Schlagschatten.
// 8 breit, 9 hoch; in CSS border-image-slice 3 3 4 3.
function rahmenSvg(fuell, licht, schatten, umriss = '#24364a') {
  const R = ['.kkkkkk.', 'kllllllk', 'kffffffk', 'kffffffk', 'kffffffk', 'kffffffk', 'kssssssk', '.kkkkkk.', '..xxxx..'];
  const F = { k: umriss, l: licht, f: fuell, s: schatten, x: 'rgba(20,32,48,0.3)' };
  let r = '';
  R.forEach((z, y) => [...z].forEach((c, x) => {
    if (c !== '.') r += `<rect x="${x}" y="${y}" width="1" height="1" fill="${F[c]}"/>`;
  }));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="9" viewBox="0 0 8 9" shape-rendering="crispEdges">${r}</svg>`;
}
const RAHMEN = {
  papier: rahmenSvg('#fffaf0', '#ffffff', '#e6dcc6'),
  mulde: rahmenSvg('#e9dfca', '#ddd0b6', '#f3ebdb'),
  koralle: rahmenSvg('#ee6454', '#f79486', '#c4483a'),
  gold: rahmenSvg('#f2c14e', '#fbdc88', '#cf9a2c'),
  meer: rahmenSvg('#23897d', '#3fae9f', '#186a61'),
  tinte: rahmenSvg('#2e4560', '#47627f', '#1c2c3e'),
  hell: rahmenSvg('#fdecea', '#fff6f4', '#f0cfca'),
};

const url = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
const num1 = (n) => n.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const ganz = (n) => Math.round(n).toLocaleString('de-DE');
const euro = (n) => `${ganz(n)} €`;

import { initEinstellungen, SCHALTER, WAHLEN } from './einstellungen.js';

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

// Tempo: Pause, normal, schnell, sehr schnell (vorher: Sonne ziehen bis 8-fach)
const TEMPO = [
  { id: 'pause', label: 'Pause', speed: 0 },
  { id: 'tempo1', label: 'Normale Geschwindigkeit', speed: 1 },
  { id: 'tempo2', label: 'Dreifach vorspulen', speed: 3 },
  { id: 'tempo3', label: 'Achtfach vorspulen bis zum nächsten Boot', speed: 8 },
];

export function init(game) {
  const $ = (id) => document.getElementById(id);
  const top = $('hud-top');
  const bottom = $('hud-bottom');
  const root = $('game') || document.body;
  if (!top || !bottom) return;

  // Grafiken als CSS-Variablen
  const vars = [
    ...Object.entries(PIXEL).map(([k, v]) => `--px-${k}: ${url(pixelSvg(v))};`),
    ...Object.entries(RAHMEN).map(([k, v]) => `--rahmen-${k}: ${url(v)};`),
  ].join('\n  ');
  document.head.append(el('style', { id: 'hm-oberflaeche-grafik' }, `:root {\n  ${vars}\n}`));
  document.body.classList.add('hm-neu');

  // Symbol vor den Text eines Knopfs setzen (Text bleibt für Bildschirmleser und PC-Beschriftung)
  const symbol = (knopf, name) => {
    if (!knopf || knopf.querySelector(':scope > .hm-sym')) return;
    knopf.prepend(el('i', { class: 'hm-sym', 'aria-hidden': 'true', style: `--sym: var(--px-${name})` }));
  };

  // ---------------------------------------------------------------- Gerüst
  const status = el('div', { class: 'hm-status hm-px', role: 'group', 'aria-label': 'Kasse und Ruf' });
  const werkzeuge = el('div', { class: 'hm-werkzeuge' });
  top.prepend(status);
  top.append(werkzeuge);
  const menueBtn = el('button', {
    type: 'button', class: 'hm-px hm-rund', id: 'btn-menu', 'aria-label': 'Menü', title: 'Menü',
    'aria-haspopup': 'true', 'aria-expanded': 'false', 'aria-controls': 'hm-menue',
  });
  symbol(menueBtn, 'menue');
  werkzeuge.append(menueBtn);
  const menue = el('div', { id: 'hm-menue', class: 'hm-px hm-tafel-px', role: 'menu', hidden: true });
  const seite = el('div', { id: 'hm-seite', class: 'hm-seite' });
  root.append(seite, menue);

  // ---------------------------------------------------------------- Zeit: Tag, Balken, Tempo
  const zeit = el('div', { id: 'hm-zeit', class: 'hm-px' });
  const day = $('day');
  const gestirn = el('i', { class: 'hm-gestirn' });
  const abendteil = el('i', { class: 'hm-abendteil' });
  const himmel = el('div', { class: 'hm-himmel', 'aria-hidden': 'true' }, abendteil, gestirn);
  const tempoLeiste = el('div', { class: 'hm-tempo', role: 'group', 'aria-label': 'Zeit' });
  const tempoKnopf = {};
  for (const t of TEMPO) {
    const alt = t.id === 'pause' ? $('btn-pause') : null;
    const b = alt ?? el('button', { type: 'button' });
    b.className = 'hm-tempo-knopf';
    b.dataset.tempo = t.id;
    b.setAttribute('aria-label', t.label);
    b.title = t.id === 'tempo2' ? `${t.label} (Taste F)` : t.id === 'tempo3' ? `${t.label} (Taste G)` : t.label;
    b.hidden = false;
    b.textContent = '';
    symbol(b, t.id);
    // Unsichtbare Beschriftung: Bildschirmleser und Tests lesen "Pause" / "Weiter" am Knopf
    if (t.id === 'pause') b.append(el('span', { class: 'hm-leise' }, game.paused ? 'Weiter' : 'Pause'));
    // Pause: main.js schaltet bei Klick auf #btn-pause schon um; die anderen setzen das Tempo
    if (t.id !== 'pause') b.addEventListener('click', () => waehleTempo(t.speed));
    else if (!alt) b.addEventListener('click', () => game.setPaused?.(!game.paused));
    tempoKnopf[t.id] = b;
    tempoLeiste.append(b);
  }
  zeit.append(el('div', { class: 'hm-zeit-kopf' }, day ?? el('span'), himmel), tempoLeiste);
  bottom.prepend(zeit);

  function waehleTempo(speed) {
    if (game.paused) game.setPaused?.(false);
    const vorher = game.speed || 1;
    game.speed = speed;
    document.body.classList.toggle('vorspulen', speed > 1);
    if (speed > 1 && vorher <= 1) game.audio?.sfx?.('vorspulen-start');
    if (speed <= 1 && vorher > 1) game.audio?.sfx?.('vorspulen-ende');
    game.emit('ui:vorspulen', { speed });
    zeigeTempo();
  }
  // Tempo, das mitdenkt (roadmap Bed P4): Bei einem Sonderfall geht es zurück auf 1x, damit man ihn nicht verpasst.
  // 8x läuft nur bis zum nächsten Boot an der Boje.
  const zurueck = () => { if ((game.speed || 1) > 1 && !game.paused) waehleTempo(1); };
  for (const ereignis of ['event:announce', 'event:start', 'sim:stageReady', 'sim:regionDone']) game.on(ereignis, zurueck);
  game.on('sim:atBuoy', () => { if ((game.speed || 1) >= 8) zurueck(); });

  function zeigeTempo() {
    const s = game.speed || 1;
    for (const t of TEMPO) {
      const an = t.id === 'pause' ? !!game.paused : !game.paused && (s === t.speed || (t.speed === 3 && s > 1 && s < 8));
      tempoKnopf[t.id].setAttribute('aria-pressed', String(an));
    }
  }
  game.on('ui:vorspulen', zeigeTempo);
  game.on('pause', (p) => {
    const l = tempoKnopf.pause.querySelector('.hm-leise');
    if (l) l.textContent = p ? 'Weiter' : 'Pause';
    zeigeTempo();
  });

  // Tagesbalken: Sonne wandert, abends färbt sich der Himmel und der Mond kommt
  let letzterAnteil = -1;
  let warPause = null;
  game.onTick?.(() => {
    if (warPause !== !!game.paused) { warPause = !!game.paused; zeigeTempo(); }
    const sim = game.sim;
    if (!sim?.ctx || !sim.state) return;
    const r = sim.ctx.rules;
    const ganzerTag = (r.dayLength || 1) + (r.eveningLength || 0);
    const a = Math.min(1, Math.max(0, sim.tagesAnteil?.() ?? sim.state.clock / ganzerTag));
    if (Math.abs(a - letzterAnteil) < 0.002) return;
    letzterAnteil = a;
    const abendAb = (r.dayLength || 1) / ganzerTag;
    himmel.style.setProperty('--anteil', a.toFixed(4));
    abendteil.style.left = `${(abendAb * 100).toFixed(2)}%`;
    const abend = a >= abendAb;
    gestirn.classList.toggle('mond', abend);
    himmel.classList.toggle('abend', abend);
  });

  // ---------------------------------------------------------------- Ziel der nächsten Stufe
  const zielKnopf = el('button', { type: 'button', class: 'hm-px hm-chip hm-ziel-knopf', 'aria-expanded': 'false' });
  const zielPanel = el('div', { class: 'hm-px hm-tafel-px hm-ziel-panel', hidden: true });
  const ziel = el('div', { id: 'hm-ziel', class: 'hm-ziel', hidden: true }, zielKnopf, zielPanel);

  function zielDaten() {
    const sim = game.sim;
    if (!sim?.state) return null;
    // Nach dem Abschluss der Region: Saisonziele des Endlosspiels (features/aufstieg.js, P16)
    const endlos = sim.state.regionDone ? game.aufstieg?.zielDaten?.() : null;
    if (endlos) return endlos;
    const rg = sim.regionGoal?.();
    if (rg?.active) {
      const g = rg.goal;
      const zeilen = [
        { name: 'Große Schiffe zu Besuch', ist: Math.min(rg.visits, g.bigVisits), soll: g.bigVisits, text: `${Math.min(rg.visits, g.bigVisits)} von ${g.bigVisits}` },
        { name: 'Ruf', ist: rg.reputation, soll: g.reputation, text: `${num1(rg.reputation)} von ${num1(g.reputation)}` },
      ];
      if (g.allBerths) zeilen.push({ name: 'Alle Plätze gebaut', ist: rg.openBerths ? 0 : 1, soll: 1, text: rg.openBerths ? `noch ${rg.openBerths}` : 'fertig' });
      const fertig = rg.done || rg.ok;
      return { titel: fertig ? 'Geschafft' : 'Hafenziel', kopf: fertig ? 'Dein Seehafen ist fertig ausgebaut.' : 'Letztes Ziel der Region', zeilen, fertig, aktion: null };
    }
    const adv = sim.canAdvanceStage?.();
    if (!adv?.goal) return null;
    const g = adv.goal;
    const geld = sim.state.money;
    const zeilen = [
      { name: 'Gäste', ist: Math.min(adv.guests, g.guests), soll: g.guests, text: `${ganz(Math.min(adv.guests, g.guests))} von ${ganz(g.guests)}` },
      { name: 'Ruf', ist: Math.min(adv.reputation, g.reputation), soll: g.reputation, text: `${num1(adv.reputation)} von ${num1(g.reputation)}` },
      { name: 'Kasse', ist: Math.min(geld, g.cost), soll: g.cost, text: `${euro(Math.min(geld, g.cost))} von ${euro(g.cost)}` },
    ];
    return {
      titel: 'Ausbau',   // "Stufe 2" in Stufe 1 las sich wie die aktuelle Stufe
      kopf: `Nächster Ausbau: ${g.name ?? 'Hafen erweitern'}`,
      zeilen, fertig: adv.ok,
      aktion: game.bauen?.oeffnen ? { text: adv.ok ? 'Jetzt ausbauen' : 'Im Baumenü ansehen', tun: () => game.bauen.oeffnen('hafen') } : null,
    };
  }

  let zielSchluessel = '';
  function zeichneZiel() {
    const d = zielDaten();
    ziel.hidden = !d;
    if (!d) return;
    const erfuellt = d.zeilen.filter((z) => z.ist >= z.soll).length;
    const schluessel = JSON.stringify([d.titel, d.kopf, d.zahl, d.fertig, d.zeilen.map((z) => z.text), zielPanel.hidden]);
    if (schluessel === zielSchluessel) return;
    zielSchluessel = schluessel;
    ziel.classList.toggle('fertig', d.fertig);
    zielKnopf.replaceChildren(
      el('i', { class: 'hm-sym', 'aria-hidden': 'true', style: '--sym: var(--px-flagge)' }),
      el('span', { class: 'hm-chip-text' }, d.titel),
      el('span', { class: 'hm-chip-zahl' }, d.zahl ?? (d.fertig ? 'bereit' : `${erfuellt}/${d.zeilen.length}`)),
    );
    zielKnopf.setAttribute('aria-label', `${d.kopf}. ${erfuellt} von ${d.zeilen.length} erfüllt.`);
    if (zielPanel.hidden) return;
    zielPanel.replaceChildren(
      el('p', { class: 'hm-klapp-kopf' }, d.kopf),
      ...d.zeilen.map((z) => {
        const anteil = z.soll > 0 ? Math.max(0, Math.min(1, z.ist / z.soll)) : 1;
        return el('div', { class: `hm-balken-zeile${anteil >= 1 ? ' ok' : ''}` },
          el('span', { class: 'hm-balken-name' }, z.name),
          el('span', { class: 'hm-balken-wert' }, z.text),
          el('span', { class: 'hm-balken' }, el('i', { style: `width:${Math.round(anteil * 100)}%` })));
      }),
      // replaceChildren schreibt null als Text "null" (Stufe 6 hat keine Aktion): leere Liste statt null
      ...(d.aktion ? [el('button', { type: 'button', class: 'hm-px hm-knopf hm-primaer', onclick: () => { klappeZu(); d.aktion.tun(); } }, d.aktion.text)] : []),
    );
  }
  zielKnopf.addEventListener('click', (e) => {
    e.stopPropagation();
    const auf = zielPanel.hidden;
    klappeAndereZu('ziel');
    zielPanel.hidden = !auf;
    zielKnopf.setAttribute('aria-expanded', String(auf));
    zielSchluessel = '';
    zeichneZiel();
  });

  // ---------------------------------------------------------------- Menü
  const MENUE = [
    ['btn-tagesabschluss', 'Tagesabschluss', 'abschluss'],   // ui/tagesabschluss.js
    ['btn-foto', 'Fotomodus', 'foto'],
    ['btn-sound', null, 'ton'],      // Text setzt das Ton-Modul (Ton / Stumm)
    ['btn-save', 'Spielstand', 'spielstand'],
    ['btn-hilfe', 'Hilfe', 'hilfe'],
    ['btn-help', 'Maus und Tastatur', 'tasten'],
    ['btn-einstellungen', 'Einstellungen', 'zahnrad'],
  ];

  // ---------------------------------------------------------------- Einstellungen (P50)
  const einst = initEinstellungen(game);
  const einstBtn = el('button', { type: 'button', id: 'btn-einstellungen', 'aria-haspopup': 'dialog', 'aria-controls': 'hm-einstellungen' }, 'Einstellungen');
  top.append(einstBtn);
  const einstTafel = el('div', { id: 'hm-einstellungen', class: 'hm-px hm-tafel-px', role: 'dialog', 'aria-label': 'Einstellungen', hidden: true });
  const einstZu = el('button', { type: 'button', class: 'hm-zu', 'aria-label': 'Einstellungen schließen', onclick: () => einstAuf(false) });
  const touch = globalThis.matchMedia?.('(pointer: coarse)').matches ?? false;
  const schalterKnopf = {};
  einstTafel.append(el('div', { class: 'hm-karte-kopf' }, el('p', { class: 'hm-klapp-kopf' }, 'Einstellungen'), einstZu));
  for (const sch of SCHALTER) {
    if (sch.nurTouch && !touch) continue;
    const k = el('button', {
      type: 'button', role: 'switch', class: 'hm-schalter', 'aria-checked': String(einst.wert(sch.name)),
      onclick: () => einst.setze(sch.name, !einst.wert(sch.name)),
    }, el('span', { class: 'hm-schalter-text' }, el('strong', {}, sch.titel), el('span', {}, sch.text)), el('i', { class: 'hm-schalter-griff', 'aria-hidden': 'true' }));
    schalterKnopf[sch.name] = k;
    einstTafel.append(k);
  }
  const wahlKnoepfe = [];
  for (const w of WAHLEN) {
    const gruppe = el('div', { class: 'hm-wahl-stufen', role: 'radiogroup', 'aria-label': w.titel });
    for (const [id, name] of w.stufen) {
      const k = el('button', { type: 'button', role: 'radio', 'aria-checked': String(einst.wert(w.name) === id), onclick: () => einst.setze(w.name, id) }, name);
      wahlKnoepfe.push([w.name, id, k]);
      gruppe.append(k);
    }
    einstTafel.append(el('div', { class: 'hm-wahl' }, el('span', { class: 'hm-schalter-text' }, el('strong', {}, w.titel), el('span', {}, w.text)), gruppe));
  }
  // Ton und Musik haben eigene Regler im Ton-Fenster (audio.js): von hier aus dorthin
  const tonKnopf = el('button', { type: 'button', class: 'hud-btn hm-knopf', onclick: (e) => { e.stopPropagation(); einstAuf(false); $('btn-sound')?.click(); } }, 'Ton und Musik einstellen');
  // Gleich unter die Überschrift: am Handy hochkant passt die Tafel nicht ganz auf den Bildschirm, der Knopf läge sonst unter dem Rand
  einstTafel.firstElementChild.after(tonKnopf);
  root.append(einstTafel);
  game.on('einstellungen', () => {
    for (const [n, k] of Object.entries(schalterKnopf)) k.setAttribute('aria-checked', String(einst.wert(n)));
    for (const [n, id, k] of wahlKnoepfe) k.setAttribute('aria-checked', String(einst.wert(n) === id));
  });
  function einstAuf(auf) {
    einstTafel.hidden = !auf;
    einstBtn.setAttribute('aria-expanded', String(auf));
    if (auf) einstTafel.querySelector('.hm-schalter')?.focus({ preventScroll: true });
  }
  einstBtn.addEventListener('click', (e) => { e.stopPropagation(); klappeAndereZu('einstellungen'); einstAuf(einstTafel.hidden); });
  function menueAuf(auf) {
    menue.hidden = !auf;
    menueBtn.setAttribute('aria-expanded', String(auf));
  }
  menueBtn.addEventListener('click', (e) => { e.stopPropagation(); const auf = menue.hidden; klappeAndereZu('menue'); menueAuf(auf); });
  // Capture: Knöpfe anderer Module (Ton) stoppen ihren Klick, das Menü soll trotzdem zuklappen und nichts verdecken
  menue.addEventListener('click', (e) => { if (e.target.closest('button')) setTimeout(() => menueAuf(false), 0); }, true);

  // Immer nur ein Aufklapper offen: Menü, Wetter, Tagesziele, Ziel
  function klappeAndereZu(ausser) {
    if (ausser !== 'menue') menueAuf(false);
    if (ausser !== 'einstellungen') einstAuf(false);
    if (ausser !== 'ziel') { zielPanel.hidden = true; zielKnopf.setAttribute('aria-expanded', 'false'); }
    const liste = document.querySelector('.hm-tafel ul');
    if (ausser !== 'tafel' && liste && !liste.hidden) { liste.hidden = true; liste.parentNode.querySelector('button')?.setAttribute('aria-expanded', 'false'); }
    const w = $('weather-chip');
    if (ausser !== 'wetter' && w?.getAttribute('aria-expanded') === 'true') w.click();
  }
  const klappeZu = () => klappeAndereZu(null);
  document.addEventListener('pointerdown', (e) => {
    if (e.target.closest?.('#hm-menue, #btn-menu, #hm-seite, #hm-audio-popover, .hm-save-backdrop, #hm-einstellungen')) return;
    menueAuf(false);
    einstAuf(false);
    zielPanel.hidden = true;
    zielKnopf.setAttribute('aria-expanded', 'false');
  }, true);
  seite.addEventListener('click', (e) => {
    const b = e.target.closest('#weather-chip, .hm-tafel > button');
    if (b) setTimeout(() => klappeAndereZu(b.id === 'weather-chip' ? 'wetter' : 'tafel'), 0);
  }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') klappeZu(); });

  // ---------------------------------------------------------------- Einräumen
  function ordnen() {
    for (const id of ['money', 'rep']) {
      const x = $(id);
      if (x && x.parentNode !== status) status.append(x);
    }
    const ov = $('btn-overview');
    if (ov && ov.parentNode !== werkzeuge) werkzeuge.prepend(ov);
    if (ov && !ov.classList.contains('hm-rund')) { ov.className = 'hm-px hm-rund'; symbol(ov, 'uebersicht'); }
    if (werkzeuge.lastElementChild !== menueBtn) werkzeuge.append(menueBtn);
    // Kompass aus ui/kamera.js (nur sichtbar, wenn die Kamera gedreht oder geneigt ist)
    const kompass = $('btn-kompass');
    if (kompass && kompass.nextElementSibling !== menueBtn) werkzeuge.insertBefore(kompass, menueBtn);
    if (kompass && !kompass.classList.contains('hm-px')) kompass.classList.add('hm-px', 'hm-rund');
    for (const [id, text, sym] of MENUE) {
      const x = $(id);
      if (!x) continue;
      if (x.parentNode !== menue) {
        menue.append(x);
        x.classList.remove('hud-btn', 'hm-audio-btn');
        x.classList.add('hm-zeile');
        x.setAttribute('role', 'menuitem');
        if (text) x.textContent = text;
      }
      // Das Ton-Modul schreibt seinen Text neu (Ton / Stumm) und löscht dabei das Symbol
      const name = id === 'btn-sound' && x.classList.contains('hm-audio-off') ? 'stumm' : sym;
      const da = x.querySelector(':scope > .hm-sym');
      if (da && da.dataset.sym !== name) da.remove();
      if (!x.querySelector(':scope > .hm-sym')) { symbol(x, name); x.querySelector(':scope > .hm-sym').dataset.sym = name; }
      if (id === 'btn-sound' && !x.dataset.hmBeobachtet) { x.dataset.hmBeobachtet = '1'; beobachter.observe(x, { childList: true, attributes: true, attributeFilter: ['class'] }); }
    }
    const soll = MENUE.map(([id]) => $(id)).filter((x) => x && x.parentNode === menue);
    if (soll.some((x, i) => menue.children[i] !== x)) soll.forEach((x) => menue.append(x));
    const leer = !menue.querySelector('button:not([hidden])');
    if (menueBtn.hidden !== leer) menueBtn.hidden = leer;

    const wetter = $('weather-chip');
    const wetterPanel = $('weather-panel');
    const tafel = document.querySelector('.hm-tafel');
    const reihe = [wetter, wetterPanel, tafel, ziel].filter(Boolean);
    if (reihe.some((x, i) => seite.children[i] !== x)) reihe.forEach((x) => seite.append(x));
    if (wetter && !wetter.classList.contains('hm-chip')) wetter.classList.add('hm-px', 'hm-chip');
    if (wetterPanel && !wetterPanel.classList.contains('hm-tafel-px')) wetterPanel.classList.add('hm-px', 'hm-tafel-px');
    const tk = tafel?.querySelector(':scope > button');
    if (tk && !tk.classList.contains('hm-chip')) tk.classList.add('hm-px', 'hm-chip', 'hm-tafel-knopf');
    const tl = tafel?.querySelector('ul');
    if (tl && !tl.classList.contains('hm-tafel-px')) tl.classList.add('hm-px', 'hm-tafel-px');

    // Kassieren und Bauen: Pixel-Knöpfe
    const kassieren = $('btn-collect');
    if (kassieren && !kassieren.classList.contains('hm-px')) { kassieren.classList.add('hm-px'); kassieren.classList.remove('hud-btn'); }
    const bauen = $('btn-build');
    if (bauen && !bauen.classList.contains('hm-px')) { bauen.classList.add('hm-px'); bauen.classList.remove('hud-btn'); }
    if (bauen && !bauen.querySelector(':scope > .hm-sym')) symbol(bauen, 'bauen');
    if (bottom.firstElementChild !== zeit) bottom.prepend(zeit);
  }
  let wartet = false;
  const beobachter = new MutationObserver(() => {
    if (wartet) return;
    wartet = true;
    queueMicrotask(() => { wartet = false; ordnen(); });
  });
  beobachter.observe(top, { childList: true });
  beobachter.observe(bottom, { childList: true });
  beobachter.observe(root, { childList: true });
  ordnen();

  // ---------------------------------------------------------------- Laufend
  let geplant = false;
  const plane = () => {
    if (geplant) return;
    geplant = true;
    requestAnimationFrame(() => { geplant = false; zeichneZiel(); });
  };
  game.on('sim:change', plane);
  game.on('sim:stageUp', () => { zielSchluessel = ''; plane(); });
  game.on('sim:regionDone', () => { zielSchluessel = ''; plane(); });
  game.on('sim:seasonEnd', () => { zielSchluessel = ''; plane(); });
  game.on('sim:seasonStart', () => { zielSchluessel = ''; plane(); });
  game.on('spielstand-geladen', plane);
  game.on('ready', () => { ordnen(); plane(); zeigeTempo(); setTimeout(ordnen, 600); });
  game.on('tap', () => klappeZu());
  plane();
  zeigeTempo();

  game.oberflaeche = { ordnen, klappeZu, tempo: waehleTempo, menue: (auf) => menueAuf(auf !== false) };
}
