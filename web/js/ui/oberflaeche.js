// Oberfläche: ordnet alle Bedienelemente einheitlich für PC, Tablet und Handy.
// Das Aussehen steht in web/css/oberflaeche.css, die Geräte-Dateien (ui-pc/-tablet/-phone.css)
// passen nur noch Größen an. Konzept: docs/ui/oberflaeche.md.
//
// Bereiche (gleich auf allen Geräten):
//   oben links   .hm-status       Geld, Ruf, Tag mit Sonne (Ziehen spult vor)
//   oben rechts  .hm-werkzeuge    Übersicht, Pause, Menü (#btn-menu)
//   Menü         #hm-menue        Foto, Ton, Spielstand, Maus und Tastatur (PC)
//   links        #hm-seite        Wetter, Tagesziele, Ausbauziel (#hm-ziel), jeweils aufklappbar
//   unten rechts #hud-bottom      Kassieren, Bauen
//   #card                         rechts als Seitenkarte (breit) oder unten als Blatt (schmal)
//
// Andere Module hängen ihre Knöpfe weiter dort ein, wo sie es immer getan haben (#hud-top, #game).
// Dieses Modul räumt sie danach an ihren Platz; IDs und Klassen bleiben unverändert.

// Symbole: 24er Raster, 2 px Strich, runde Enden. Einfarbig (Maske) außer Münze und Stern.
const S = (inner, extra = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${extra}>${inner}</svg>`;
const ICON = {
  pause: S('<rect x="6.5" y="5" width="3.6" height="14" rx="1.2" fill="black" stroke="none"/><rect x="13.9" y="5" width="3.6" height="14" rx="1.2" fill="black" stroke="none"/>'),
  weiter: S('<path d="M8.5 5.8v12.4a1 1 0 0 0 1.53.85l9.6-6.2a1 1 0 0 0 0-1.7l-9.6-6.2A1 1 0 0 0 8.5 5.8z" fill="black" stroke="none"/>'),
  uebersicht: S('<path d="M4 9V6.5A2.5 2.5 0 0 1 6.5 4H9M15 4h2.5A2.5 2.5 0 0 1 20 6.5V9M20 15v2.5a2.5 2.5 0 0 1-2.5 2.5H15M9 20H6.5A2.5 2.5 0 0 1 4 17.5V15"/><circle cx="12" cy="12" r="2.2" fill="black" stroke="none"/>'),
  menue: S('<path d="M5 7h14M5 12h14M5 17h14"/>'),
  foto: S('<path d="M4 9a2 2 0 0 1 2-2h1.8l1.4-2h5.6l1.4 2H18a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.3"/>'),
  ton: S('<path d="M4.5 9.5v5h3.2l4.8 4v-13l-4.8 4z" fill="black"/><path d="M16 9.2a4 4 0 0 1 0 5.6M18.6 6.6a7.6 7.6 0 0 1 0 10.8"/>'),
  stumm: S('<path d="M4.5 9.5v5h3.2l4.8 4v-13l-4.8 4z" fill="black"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>'),
  spielstand: S('<path d="M5 4h11.2L20 7.8V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1z"/><path d="M8 4v4.5h7V4M8 20v-5.5h8V20"/>'),
  tasten: S('<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>'),
  bauen: S('<path d="M13.2 3.6l7.2 7.2-2.6 2.6-7.2-7.2z" fill="black"/><path d="M11.9 9.3L4.2 17a2 2 0 0 0 2.8 2.8l7.7-7.7"/>'),
  ziele: S('<path d="M9 6h11M9 12h11M9 18h11"/><path d="M3.5 6l1.2 1.2L7 4.8M3.5 12l1.2 1.2L7 10.8M3.5 18l1.2 1.2L7 16.8"/>'),
  flagge: S('<path d="M5 21V4"/><path d="M5 4.5c4-2 7 2 13 0v9c-6 2-9-2-13 0z" fill="black"/>'),
  zu: S('<path d="M6 6l12 12M18 6L6 18"/>'),
  muenze: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.5" fill="#f2c14e"/><circle cx="12" cy="12" r="9.5" fill="none" stroke="#c9952a" stroke-width="1.6"/><circle cx="12" cy="12" r="6.2" fill="none" stroke="#e0ab3a" stroke-width="1.2"/><path d="M14.6 9.2a3.4 3.4 0 1 0 0 5.6M8 11h5M8 13h5" fill="none" stroke="#8a5f12" stroke-width="1.5" stroke-linecap="round"/></svg>',
  stern: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z" fill="#f2c14e" stroke="#c9952a" stroke-width="1.4" stroke-linejoin="round"/></svg>',
};

const url = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

const num1 = (n) => n.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const ganz = (n) => Math.round(n).toLocaleString('de-DE');
const euro = (n) => `${ganz(n)} €`;

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

export function init(game) {
  const $ = (id) => document.getElementById(id);
  const top = $('hud-top');
  const root = $('game') || document.body;
  if (!top) return;

  // Symbole als CSS-Variablen, damit oberflaeche.css sie per Maske einfärben kann
  const vars = Object.entries(ICON).map(([k, v]) => `--i-${k}: ${url(v)};`).join('\n  ');
  document.head.append(el('style', { id: 'hm-oberflaeche-symbole' }, `:root {\n  ${vars}\n}`));
  document.body.classList.add('hm-neu');

  // ---------------------------------------------------------------- Gerüst
  const status = el('div', { class: 'hm-status', role: 'group', 'aria-label': 'Hafenkasse und Tag' });
  const werkzeuge = el('div', { class: 'hm-werkzeuge' });
  const menueBtn = el('button', {
    type: 'button', class: 'hud-btn hm-rund', id: 'btn-menu', 'aria-label': 'Menü', title: 'Menü',
    'aria-haspopup': 'true', 'aria-expanded': 'false', 'aria-controls': 'hm-menue',
  }, 'Menü');
  const menue = el('div', { id: 'hm-menue', class: 'hm-menue', role: 'menu', hidden: true });
  const seite = el('div', { id: 'hm-seite', class: 'hm-seite' });
  top.prepend(status);
  top.append(werkzeuge);
  root.append(seite, menue);

  // ---------------------------------------------------------------- Ausbauziel
  // Zeigt, was bis zur nächsten Ausbaustufe fehlt; in der letzten Stufe das Abschlussziel der Region.
  const zielKnopf = el('button', { type: 'button', class: 'hm-chip hm-ziel-knopf', 'aria-expanded': 'false' });
  const zielPanel = el('div', { class: 'hm-klapp hm-ziel-panel', hidden: true });
  const ziel = el('div', { id: 'hm-ziel', class: 'hm-ziel', hidden: true }, zielKnopf, zielPanel);

  function zielDaten() {
    const sim = game.sim;
    if (!sim?.state) return null;
    const rg = sim.regionGoal?.();
    if (rg?.active) {
      const g = rg.goal;
      const zeilen = [
        { name: 'Besuche großer Schiffe', ist: Math.min(rg.visits, g.bigVisits), soll: g.bigVisits, text: `${Math.min(rg.visits, g.bigVisits)} von ${g.bigVisits}` },
        { name: 'Ruf', ist: rg.reputation, soll: g.reputation, text: `${num1(rg.reputation)} von ${num1(g.reputation)}` },
      ];
      if (g.allBerths) zeilen.push({ name: 'Alle Plätze gebaut', ist: rg.openBerths ? 0 : 1, soll: 1, text: rg.openBerths ? `noch ${rg.openBerths}` : 'fertig' });
      const fertig = rg.done || rg.ok;
      return { titel: fertig ? 'Seehafen fertig' : 'Hafenziel', kopf: fertig ? 'Region geschafft: Dein Seehafen ist fertig ausgebaut.' : 'Abschlussziel der Region', zeilen, fertig, aktion: null };
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
      titel: `Ziel Stufe ${sim.state.stage + 1}`,
      kopf: `Nächste Ausbaustufe: ${g.name ?? 'Hafen erweitern'}`,
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
    const schluessel = JSON.stringify([d.titel, d.fertig, d.zeilen.map((z) => z.text), zielPanel.hidden]);
    if (schluessel === zielSchluessel) return;
    zielSchluessel = schluessel;
    ziel.classList.toggle('fertig', d.fertig);
    zielKnopf.replaceChildren(
      el('span', { class: 'hm-chip-text' }, d.titel),
      el('span', { class: 'hm-chip-zahl' }, d.fertig ? 'bereit' : `${erfuellt}/${d.zeilen.length}`),
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
      d.aktion ? el('button', { type: 'button', class: 'hud-btn hm-primaer', onclick: () => { klappeZu(); d.aktion.tun(); } }, d.aktion.text) : null,
    );
  }
  zielKnopf.addEventListener('click', (e) => {
    e.stopPropagation();
    const auf = zielPanel.hidden;
    klappeZu();
    zielPanel.hidden = !auf;
    zielKnopf.setAttribute('aria-expanded', String(auf));
    zielSchluessel = '';
    zeichneZiel();
  });

  // ---------------------------------------------------------------- Menü
  const MENUE = [
    ['btn-foto', 'Fotomodus'],
    ['btn-sound', null],     // Text setzt das Ton-Modul (Ton / Stumm)
    ['btn-save', 'Spielstand'],
    ['btn-help', 'Maus und Tastatur'],
  ];
  function menueAuf(auf) {
    menue.hidden = !auf;
    menueBtn.setAttribute('aria-expanded', String(auf));
    document.body.classList.toggle('hm-menue-offen', auf);
  }
  menueBtn.addEventListener('click', (e) => { e.stopPropagation(); const auf = menue.hidden; klappeZu(); menueAuf(auf); });
  menue.addEventListener('click', (e) => {
    // Ein Eintrag öffnet sein eigenes Fenster, das Menü klappt danach zu
    if (e.target.closest('button')) setTimeout(() => menueAuf(false), 0);
  });

  // Alle Aufklapper (Menü, Wetter, Tagesziele, Ausbauziel): immer nur einer offen
  function klappeZu() {
    menueAuf(false);
    zielPanel.hidden = true;
    zielKnopf.setAttribute('aria-expanded', 'false');
    const tafel = document.querySelector('.hm-tafel');
    const liste = tafel?.querySelector('ul');
    if (liste && !liste.hidden) { liste.hidden = true; tafel.querySelector('button')?.setAttribute('aria-expanded', 'false'); }
    const wetter = $('weather-chip');
    if (wetter?.getAttribute('aria-expanded') === 'true') wetter.click();
  }
  document.addEventListener('pointerdown', (e) => {
    if (e.target.closest?.('#hm-menue, #btn-menu, #hm-seite, #hm-audio-popover, .hm-save-backdrop')) return;
    if (!menue.hidden || !zielPanel.hidden) { menueAuf(false); zielPanel.hidden = true; zielKnopf.setAttribute('aria-expanded', 'false'); }
  }, true);
  // Öffnet der Spieler einen Aufklapper der anderen Module, gehen die übrigen zu
  seite.addEventListener('click', (e) => {
    const b = e.target.closest('#weather-chip, .hm-tafel > button');
    if (!b) return;
    menueAuf(false);
    zielPanel.hidden = true;
    zielKnopf.setAttribute('aria-expanded', 'false');
    const tafel = document.querySelector('.hm-tafel');
    if (b.id === 'weather-chip') {
      const liste = tafel?.querySelector('ul');
      if (liste && !liste.hidden) { liste.hidden = true; tafel.querySelector('button')?.setAttribute('aria-expanded', 'false'); }
    } else {
      const w = $('weather-chip');
      if (w?.getAttribute('aria-expanded') === 'true' && b !== w) setTimeout(() => { if (b.getAttribute('aria-expanded') === 'true') w.click(); }, 0);
    }
  }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') klappeZu(); });

  // ---------------------------------------------------------------- Einräumen
  let ordnet = false;
  function ordnen() {
    if (ordnet) return;
    ordnet = true;
    try {
      for (const id of ['money', 'rep', 'day']) {
        const x = $(id);
        if (x && x.parentNode !== status) status.append(x);
      }
      for (const id of ['btn-overview', 'btn-pause']) {
        const x = $(id);
        if (x && x.parentNode !== werkzeuge) werkzeuge.append(x);
        x?.classList.add('hm-rund');
      }
      if (menueBtn.parentNode !== werkzeuge || werkzeuge.lastElementChild !== menueBtn) werkzeuge.append(menueBtn);
      for (const [id, text] of MENUE) {
        const x = $(id);
        if (!x) continue;
        if (x.parentNode !== menue) {
          menue.append(x);
          x.classList.add('hm-zeile');
          x.setAttribute('role', 'menuitem');
          if (text) x.textContent = text;
        }
      }
      // Reihenfolge im Menü fest, egal wann die Module ihre Knöpfe anlegen
      const soll = MENUE.map(([id]) => $(id)).filter((x) => x && x.parentNode === menue);
      if (soll.some((x, i) => menue.children[i] !== x)) soll.forEach((x) => menue.append(x));
      const wetter = $('weather-chip');
      const wetterPanel = $('weather-panel');
      const tafel = document.querySelector('.hm-tafel');
      const reihe = [wetter, wetterPanel, tafel, ziel].filter(Boolean);
      if (reihe.some((x, i) => seite.children[i] !== x)) reihe.forEach((x) => seite.append(x));
      wetter?.classList.add('hm-chip');
      wetterPanel?.classList.add('hm-klapp');
      tafel?.querySelector('button')?.classList.add('hm-chip', 'hm-tafel-knopf');
      tafel?.querySelector('ul')?.classList.add('hm-klapp');
      // Leere Leisten-Teile bleiben unsichtbar
      const leer = !menue.querySelector('button:not([hidden])');
      if (menueBtn.hidden !== leer) menueBtn.hidden = leer;
    } finally {
      ordnet = false;
    }
  }
  ordnen();
  const beobachter = new MutationObserver(() => { if (!ordnet) queueMicrotask(ordnen); });
  beobachter.observe(top, { childList: true });
  beobachter.observe(root, { childList: true });
  beobachter.observe(menue, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });

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
  game.on('spielstand-geladen', plane);
  game.on('ready', () => { ordnen(); plane(); setTimeout(ordnen, 600); });
  game.on('tap', () => { klappeZu(); });
  plane();

  game.oberflaeche = { ordnen, klappeZu, menue: (auf) => menueAuf(auf !== false) };
}
