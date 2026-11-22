// Fenster "Name und Flagge" (P44, F23, F27) und der Flaggen-Baukasten, den auch "Neues Spiel"
// (save/save-panel.js) nutzt. Beschreibung: docs/hafenflagge.md.
//
// Alles wird mit DOM-Methoden gebaut, Texte nur über textContent bzw. Text-Knoten (Audit C05):
// ein Hafenname wie "<img src=x onerror=...>" erscheint als Text, nie als HTML.
//
// Schnittstelle: game.hafenflagge = { oeffnen(), schliessen(), offen() }.
// Speichern über game.spielstand.umbenennen(name) und game.spielstand.flaggeSetzen(flagge) (save/index.js).
import {
  FLAGGE_B, FLAGGE_H, FLAGGEN_FARBEN, FLAGGEN_MUSTER, FLAGGEN_ZEICHEN, NAME_MAX,
  flaggeZeichnen, flaggeSauber, flaggeAusSeed, flaggeBeschreibung, passendeZeichenFarbe, hafenNameSauber,
  gleicheFlagge, musterVon,
} from '../data/hafenflagge.js';

const CSS = `
.hm-fl{display:flex;flex-direction:column;gap:8px}
.hm-fl-vorschau{display:flex;align-items:center;gap:12px}
.hm-fl-vorschau canvas{flex:none;width:144px;height:96px;image-rendering:pixelated;image-rendering:crisp-edges;
  box-shadow:0 0 0 var(--sp-px,2px) var(--sp-tinte,#24364a);background:repeating-conic-gradient(#e9dfca 0 25%,#fffaf0 0 50%) 0 0/12px 12px}
.hm-fl-vorschau .hm-sp-k{flex:1}
.hm-fl-reiter{display:flex;gap:4px;flex-wrap:wrap}
.hm-fl-reiter .hm-sp-k{flex:1 1 84px;font-size:14px;padding:0 6px;white-space:nowrap}
.hm-neu .hm-sp .hm-fl-reiter .hm-sp-k[aria-selected=true]{border-image-source:var(--rahmen-tinte);color:var(--sp-papier)}
body:not(.hm-neu) .hm-fl-reiter .hm-sp-k[aria-selected=true]{background:var(--sp-tinte);color:#fff}
.hm-fl-raster{display:grid;grid-template-columns:repeat(auto-fill,minmax(60px,1fr));gap:6px}
.hm-fl-wahl{position:relative;display:grid;place-items:center;min-height:48px;padding:4px;border:0;background:#fff;
  box-shadow:inset 0 0 0 var(--sp-px,2px) rgba(36,54,74,.25);cursor:pointer}
.hm-fl-wahl canvas{width:48px;height:32px;image-rendering:pixelated;image-rendering:crisp-edges}
.hm-fl-wahl[aria-checked=true]{outline:calc(var(--sp-px,2px) * 2) solid var(--sp-tinte,#24364a);outline-offset:1px}
.hm-fl-wahl[aria-checked=true]::after{content:"";position:absolute;right:3px;bottom:3px;width:10px;height:10px;
  background:var(--hm-gold,#f2c14e);box-shadow:0 0 0 2px var(--sp-tinte,#24364a)}
.hm-fl-farben{display:grid;grid-template-columns:repeat(auto-fill,minmax(44px,1fr));gap:6px}
.hm-fl-farbe{position:relative;min-height:44px;border:0;cursor:pointer;
  box-shadow:inset 0 0 0 var(--sp-px,2px) rgba(36,54,74,.45)}
.hm-fl-farbe[aria-checked=true]{outline:calc(var(--sp-px,2px) * 2) solid var(--sp-tinte,#24364a);outline-offset:1px}
.hm-fl-farbe[aria-checked=true]::after{content:"";position:absolute;inset:14px;background:var(--hm-gold,#f2c14e);
  box-shadow:0 0 0 2px var(--sp-tinte,#24364a)}
.hm-fl-hinweis{margin:0;font-size:13px;color:var(--hm-tinte-2,#5a6a7c)}
.hm-fl-name-rest{font-size:12px;color:var(--hm-tinte-2,#5a6a7c);text-align:right;margin:2px 0 0}
`;

function stil() {
  if (document.getElementById('hm-flagge-style')) return;
  const s = document.createElement('style');
  s.id = 'hm-flagge-style';
  s.textContent = CSS;
  document.head.appendChild(s);
}

function el(tag, props = {}, ...kinder) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : String(v));
  }
  for (const k of kinder.flat()) if (k !== null && k !== undefined && k !== false) e.append(k);
  return e;
}
const knopf = (text, onclick, art = '') => el('button', { type: 'button', class: `hm-px hm-sp-k ${art}`.trim(), onclick }, text);

/** Canvas mit der Flagge als Pixelbild (massstab Pixel je Flaggenpixel). */
export function flaggenCanvas(flagge, massstab = 1) {
  const c = el('canvas', { width: FLAGGE_B * massstab, height: FLAGGE_H * massstab });
  const ctx = c.getContext('2d');
  if (ctx) flaggeZeichnen(ctx, flagge, { massstab });
  return c;
}
function neuMalen(c, flagge, massstab) {
  const ctx = c.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, c.width, c.height);
  flaggeZeichnen(ctx, flagge, { massstab });
}

/** Zeichen als kleines Bild (in Tinte auf weißem Feld). */
function zeichenCanvas(z) {
  const c = el('canvas', { width: 24, height: 16 });
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  if (!z.pixel) {
    ctx.fillStyle = '#24364a';
    for (let i = 0; i < 9; i++) ctx.fillRect(7 + i, 3 + i, 1, 1), ctx.fillRect(15 - i, 3 + i, 1, 1);
    return c;
  }
  ctx.fillStyle = '#24364a';
  z.pixel.forEach((zeile, j) => { for (let i = 0; i < zeile.length; i++) if (zeile[i] === '#') ctx.fillRect(7 + i, 3 + j, 1, 1); });
  return c;
}

/**
 * Flaggen-Baukasten: Vorschau, Würfeln, Reiter Muster / Farbe 1-3 / Zeichen.
 * @param {object} o
 * @param {object} o.flagge Startflagge
 * @param {(f: object) => void} [o.beiAenderung]
 * @param {() => number} [o.zufall] Zufall für "Würfeln" (Standard Math.random)
 * @returns {{ element: HTMLElement, wert: () => object, setzen: (f: object) => void }}
 */
export function flaggenBaukasten({ flagge, beiAenderung = () => {}, zufall = Math.random } = {}) {
  stil();
  let f = flaggeSauber(flagge);
  let reiter = 'muster';
  // Hat der Spieler die Zeichenfarbe selbst gewählt, bleibt sie; sonst passt sie sich den Feldern an
  let zeichenFarbeFest = false;

  const vorschau = flaggenCanvas(f, 6);
  vorschau.setAttribute('role', 'img');
  const wuerfel = knopf('Würfeln', () => {
    f = flaggeAusSeed(Math.floor(zufall() * 2 ** 32));
    zeichenFarbeFest = false;
    geaendert();
  });
  wuerfel.dataset.flagge = 'wuerfeln';
  const leiste = el('div', { class: 'hm-fl-reiter', role: 'tablist', 'aria-label': 'Teil der Flagge' });
  const feld = el('div', { class: 'hm-fl-feld' });
  const hinweis = el('p', { class: 'hm-fl-hinweis' });
  const element = el('div', { class: 'hm-fl' },
    el('div', { class: 'hm-fl-vorschau' }, vorschau, wuerfel), leiste, feld, hinweis);

  function geaendert() {
    if (!zeichenFarbeFest) f.zeichenFarbe = passendeZeichenFarbe(f);
    f = flaggeSauber(f);
    zeichne();
    beiAenderung({ ...f, farben: [...f.farben] });
  }

  function reiterListe() {
    const m = musterVon(f.muster);
    const out = [['muster', 'Muster']];
    for (let i = 0; i < (m?.felder ?? 1); i++) out.push([`farbe${i}`, m.felder === 1 ? 'Farbe' : `Farbe ${i + 1}`]);
    out.push(['zeichen', 'Zeichen']);
    if (f.zeichen !== 'keins') out.push(['zeichenfarbe', 'Zeichenfarbe']);
    return out;
  }

  function wahlKnopf(aktiv, label, inhalt, onclick, daten) {
    const b = el('button', { type: 'button', class: 'hm-fl-wahl', role: 'radio', 'aria-checked': String(aktiv), 'aria-label': label, title: label, onclick });
    for (const [k, v] of Object.entries(daten)) b.dataset[k] = v;
    b.append(inhalt);
    return b;
  }

  function farbKnoepfe(aktuell, setzen, art) {
    const r = el('div', { class: 'hm-fl-farben', role: 'radiogroup', 'aria-label': art });
    for (const fa of FLAGGEN_FARBEN) {
      const b = el('button', {
        type: 'button', class: 'hm-fl-farbe', role: 'radio', 'aria-checked': String(aktuell === fa.id),
        'aria-label': fa.name, title: fa.name, style: `background:${fa.hex}`,
        onclick: () => setzen(fa.id),
      });
      b.dataset.farbe = fa.id;
      r.append(b);
    }
    return r;
  }

  function zeichne() {
    neuMalen(vorschau, f, 6);
    vorschau.setAttribute('aria-label', `Flagge: ${flaggeBeschreibung(f)}`);
    const liste = reiterListe();
    if (!liste.some(([id]) => id === reiter)) reiter = 'muster';
    leiste.replaceChildren(...liste.map(([id, text]) => {
      const b = knopf(text, () => { reiter = id; zeichne(); });
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(reiter === id));
      b.dataset.reiter = id;
      return b;
    }));
    feld.replaceChildren();
    hinweis.textContent = '';
    if (reiter === 'muster') {
      const r = el('div', { class: 'hm-fl-raster', role: 'radiogroup', 'aria-label': 'Muster' });
      for (const m of FLAGGEN_MUSTER) {
        const probe = { ...f, muster: m.id, zeichen: 'keins' };
        r.append(wahlKnopf(f.muster === m.id, m.name, flaggenCanvas(probe, 2), () => { f.muster = m.id; geaendert(); }, { muster: m.id }));
      }
      feld.append(r);
      hinweis.textContent = musterVon(f.muster)?.name ?? '';
    } else if (reiter.startsWith('farbe')) {
      const i = Number(reiter.slice(5));
      feld.append(farbKnoepfe(f.farben[i], (id) => { f.farben[i] = id; geaendert(); }, `Farbe ${i + 1}`));
      hinweis.textContent = FLAGGEN_FARBEN.find((x) => x.id === f.farben[i])?.name ?? '';
    } else if (reiter === 'zeichen') {
      const r = el('div', { class: 'hm-fl-raster', role: 'radiogroup', 'aria-label': 'Zeichen' });
      for (const z of FLAGGEN_ZEICHEN) {
        r.append(wahlKnopf(f.zeichen === z.id, z.name, zeichenCanvas(z), () => { f.zeichen = z.id; geaendert(); }, { zeichen: z.id }));
      }
      feld.append(r);
      hinweis.textContent = FLAGGEN_ZEICHEN.find((x) => x.id === f.zeichen)?.name ?? '';
    } else if (reiter === 'zeichenfarbe') {
      feld.append(farbKnoepfe(f.zeichenFarbe, (id) => { f.zeichenFarbe = id; zeichenFarbeFest = true; geaendert(); }, 'Zeichenfarbe'));
      hinweis.textContent = FLAGGEN_FARBEN.find((x) => x.id === f.zeichenFarbe)?.name ?? '';
    }
  }
  zeichne();

  return {
    element,
    wert: () => ({ ...f, farben: [...f.farben] }),
    setzen: (neu) => { f = flaggeSauber(neu); zeichenFarbeFest = false; zeichne(); },
  };
}

/** Eingabefeld für den Hafennamen mit Zähler (Zeichen, nicht UTF-16-Einheiten). */
export function namensFeld({ wert, id = 'hm-hafen-name', beiAenderung = () => {} }) {
  stil();
  const input = el('input', { type: 'text', id, value: wert ?? '', maxlength: String(NAME_MAX * 2), autocomplete: 'off', spellcheck: 'false', enterkeyhint: 'done' });
  input.value = wert ?? '';
  const rest = el('p', { class: 'hm-fl-name-rest', 'aria-live': 'polite' });
  const zaehle = () => {
    const sauber = hafenNameSauber(input.value, '');
    const n = Array.from(sauber).length;
    rest.textContent = sauber !== input.value.replace(/\s+/g, ' ').trim() && input.value.trim()
      ? `Wird gespeichert als: ${sauber || '(leer)'}`
      : `${n} von ${NAME_MAX} Zeichen`;
  };
  input.addEventListener('input', () => { zaehle(); beiAenderung(input.value); });
  zaehle();
  return { input, rest, wert: () => input.value, setzen: (v) => { input.value = v; zaehle(); } };
}

export function init(game) {
  let schliessen = null;

  function oeffnen() {
    if (schliessen) return;
    const st = game.state;
    if (!st) return;
    // Stil des Spielstand-Fensters (hm-sp) mitnutzen
    game.spielstand?.stil?.();
    stil();
    const startName = st.harborName || game.spielstand?.platz?.()?.name || 'Mein Hafen';
    const startFlagge = flaggeSauber(st.flagge, st.seed);
    const backdrop = el('div', { class: 'hm-save-backdrop', 'data-art': 'hafenflagge' });
    const box = el('div', { class: 'hm-sp hm-px', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'hm-fl-titel', id: 'hm-hafenflagge' });
    const titel = el('h2', { id: 'hm-fl-titel' }, 'Name und Flagge');
    const zu = el('button', { type: 'button', class: 'hm-sp-zu', 'aria-label': 'Schließen', onclick: () => zumachen() });
    if (getComputedStyle(document.documentElement).getPropertyValue('--px-zu')) zu.dataset.sym = '1';
    const inhalt = el('div', { class: 'hm-sp-inhalt' });
    const msg = el('p', { class: 'hm-sp-msg', role: 'status' });
    box.append(el('div', { class: 'hm-sp-kopf' }, titel, zu), inhalt);
    backdrop.append(box);

    const name = namensFeld({ wert: startName, beiAenderung: () => pruefe() });
    const bk = flaggenBaukasten({ flagge: startFlagge, beiAenderung: () => pruefe() });
    const ok = knopf('Übernehmen', () => uebernehmen(), 'hm-primaer breit');
    ok.id = 'hm-fl-ok';
    inhalt.append(msg,
      el('h3', {}, el('label', { for: 'hm-hafen-name' }, 'Name des Hafens')), name.input, name.rest,
      el('h3', {}, 'Flagge'), bk.element,
      el('p', { class: 'hm-sp-info', style: 'margin-top:8px' }, 'Die Flagge weht am Mast beim Hafenmeister und am Schild an der Einfahrt.'),
      ok);
    function pruefe() {
      const n = hafenNameSauber(name.wert(), startName);
      ok.disabled = n === startName && gleicheFlagge(bk.wert(), startFlagge);
    }
    pruefe();

    function uebernehmen() {
      try {
        const n = hafenNameSauber(name.wert(), startName);
        if (n !== startName) game.spielstand?.umbenennen?.(n) ?? (st.harborName = n, game.emit('spielstand-name', n));
        const fl = bk.wert();
        if (!gleicheFlagge(fl, startFlagge)) {
          if (game.spielstand?.flaggeSetzen) game.spielstand.flaggeSetzen(fl);
          else { st.flagge = flaggeSauber(fl, st.seed); game.emit('hafenflagge', st.flagge); }
        }
        game.audio?.play?.('klick');
        zumachen();
      } catch (err) {
        msg.textContent = String(err?.message ?? 'Das hat nicht geklappt.');
        msg.classList.add('fehler');
      }
    }

    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); zumachen(); }
    };
    // Tasten im Fenster nicht ans Spiel geben (Leertaste, P, F ...)
    for (const t of ['keydown', 'keyup']) box.addEventListener(t, (e) => { if (e.key !== 'Escape') e.stopPropagation(); });
    document.addEventListener('keydown', onKey, true);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) zumachen(); });
    document.body.append(backdrop);
    zu.focus();
    function zumachen() {
      document.removeEventListener('keydown', onKey, true);
      backdrop.remove();
      schliessen = null;
    }
    schliessen = zumachen;
  }

  // Eintrag im Menü (ui/oberflaeche.js sortiert ihn ein)
  if (!document.getElementById('btn-hafenflagge')) {
    const b = el('button', { type: 'button', id: 'btn-hafenflagge', class: 'hud-btn', 'aria-label': 'Name und Flagge des Hafens' }, 'Name und Flagge');
    b.addEventListener('click', () => oeffnen());
    const save = document.getElementById('btn-save');
    if (save) save.after(b); else (document.getElementById('hud') ?? document.body).append(b);
    game.oberflaeche?.ordnen?.();
  }

  game.hafenflagge = { oeffnen, schliessen: () => schliessen?.(), offen: () => !!schliessen };
  return game.hafenflagge;
}
