// Statistik (Roadmap P41: F19, F20). Beschreibung: docs/statistik.md. Aussehen: web/css/statistik.css.
//
// Eine Karte über dem Hafen (kein Vollbild): Einnahmen der letzten 30 Tage nach Quelle als Säulen,
// Belegung jeder Nacht, Kennzahlen, ein Hinweis und die Bilanz der vergangenen Saisons.
// Antippen einer Säule zeigt den Tag; von dort geht es zum Tagesabschluss dieses Tages.
//
// Öffnen: Menü "Statistik", Taste T, die Säulen im Tagesabschluss, der Knopf in der Winterpause.
// Meldungs-Ordnung (ui/meldungen.js): Die Karte zählt als Fenster mit Vorrang 85. Solange sie steht,
// warten Tagesabschluss und Winterpause; Feier und Kartenwahl gehen vor.
//
// Daten und Rechnung: features/statistik-daten.js (ohne Browser, tests/statistik.test.mjs).
// Schnittstelle: game.statistik = { oeffnen(tag?), schliessen(), offen() }

import * as daten from '../features/statistik-daten.js';
import { regelnBereit } from '../features/regeln-bereit.js';

const ganz = (n) => Math.round(n).toLocaleString('de-DE');
const euro = (n) => `${ganz(n)} €`;
const prozent = (x) => `${Math.round(x * 100)} %`;
const num1 = (n) => n.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k);
  return e;
}

/** Ein Satz, was die Zahlen sagen (höchstens einer, der wichtigste zuerst). */
export function hinweis(z) {
  if (!z || z.tage < 3) return null;
  if (z.volleNaechte >= 5) return `In ${z.volleNaechte} Nächten war jeder Platz belegt. Mehr Plätze würden sich lohnen.`;
  if (z.weggefahren >= 5 && z.weggefahren >= z.angelegt * 0.2) return `${z.weggefahren} Boote sind weitergefahren. Wartebojen und schnelles Zuweisen halten sie im Hafen.`;
  if (z.belegung != null && z.belegung < 0.4) return 'Viele Plätze bleiben nachts leer. Ein besserer Ruf und passende Services locken mehr Gäste.';
  return null;
}

export async function init(game) {
  if (typeof document === 'undefined') return;
  const schnittstelle = game.statistik = { oeffnen() {}, schliessen() {}, offen: () => false };

  if (!document.getElementById('hm-statistik-css')) {
    document.head.append(el('link', { id: 'hm-statistik-css', rel: 'stylesheet', href: new URL('../../css/statistik.css', import.meta.url).href }));
  }
  const root = document.getElementById('game') || document.body;
  const karte = el('section', { id: 'hm-statistik', class: 'hm-st hm-px', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'hm-st-titel', hidden: true });
  // Ins Menü räumt ui/oberflaeche.js den Knopf ein (Liste MENUE)
  const menueKnopf = el('button', { type: 'button', id: 'btn-statistik', class: 'hm-zeile', hidden: true, onclick: () => (offen ? schliessen() : oeffnen()) }, 'Statistik');
  root.append(karte, menueKnopf);

  const api = await regelnBereit(game);
  const st = () => api.state;
  const ctx = () => api.ctx;
  daten.haengeEin(api.addHook);
  menueKnopf.hidden = false;
  schnittstelle.bereit = true;
  game.emit?.('sim:change', { reason: 'statistik' });   // Menü neu ordnen

  let offen = false;
  let gewaehlt = null;      // Tag der gewählten Säule (null = letzter)
  let fokusVorher = null;

  function oeffnen(tag = null) {
    if (!st()) return;
    if (!offen) fokusVorher = document.activeElement;
    offen = true;
    gewaehlt = Number.isInteger(tag) ? tag : null;
    game.tagesabschluss?.schliesse?.();
    game.oberflaeche?.klappeZu?.();
    zeichne();
    karte.hidden = false;
    karte.scrollTop = 0;
    platziere();
    requestAnimationFrame(platziere);
    karte.classList.remove('rein'); void karte.offsetWidth; karte.classList.add('rein');
    // Tastatur: Fokus aufs Kreuz (Esc und Enter schließen); am Touch-Gerät kein Fokusrahmen
    if (!globalThis.matchMedia?.('(pointer: coarse)').matches) karte.querySelector('.hm-st-zu')?.focus({ preventScroll: true });
    game.audio?.sfx?.('klick');
    game.emit('statistik:offen', { offen: true });
    game.emit('meldungen:wechsel', {});
  }
  function schliessen() {
    if (!offen) return;
    offen = false;
    karte.hidden = true;
    if (fokusVorher?.focus && document.contains(fokusVorher)) fokusVorher.focus({ preventScroll: true });
    game.emit('statistik:offen', { offen: false });
    game.emit('meldungen:wechsel', {});
  }

  // ------------------------------------------------------------ Zeichnen
  function liste() {
    return daten.tage(st(), ctx(), { heute: api.tagesbericht?.() ?? null });
  }

  function saeulen(tage, waehle) {
    const max = Math.max(1, ...tage.map((t) => t.summe));
    const best = daten.zusammenfassung(tage).besterTag?.tag;
    const reihen = tage.map((t, i) => {
      const neueSaison = i > 0 && tage[i - 1].jahr !== t.jahr;
      const teile = daten.QUELLEN.concat(Object.keys(t.quellen).filter((q) => !daten.QUELLEN.includes(q)))
        .filter((q) => t.quellen[q] > 0)
        .map((q) => el('i', { 'data-q': q, style: { height: `${(t.quellen[q] / max) * 100}%` } }));
      return el('button', {
        type: 'button',
        class: `hm-st-saeule${t.winter ? ' winter' : ''}${t.laufend ? ' laufend' : ''}${t.tag === waehle ? ' an' : ''}${t.tag === best ? ' best' : ''}${neueSaison ? ' neu' : ''}`,
        'data-tag': t.tag,
        'aria-label': `Tag ${t.tag}: ${euro(t.summe)}${t.laufend ? ' bis jetzt' : ''}`,
        'aria-pressed': String(t.tag === waehle),
        onclick: () => { gewaehlt = t.tag; zeichne(); },
      }, el('span', { class: 'hm-st-stapel' }, ...teile.reverse()));
    });
    return el('div', { class: 'hm-st-diagramm hm-st-geld', role: 'group', 'aria-label': 'Einnahmen je Tag' }, ...reihen);
  }

  function belegungSaeulen(tage, waehle) {
    return el('div', { class: 'hm-st-diagramm hm-st-belegung', role: 'group', 'aria-label': 'Belegung je Nacht' },
      ...tage.map((t) => {
        const b = t.belegung;
        const kids = b && b.plaetze ? [
          el('i', { class: 'dauer', style: { height: `${Math.min(1, b.dauer / b.plaetze) * 100}%` } }),
          el('i', { class: 'gast', style: { height: `${Math.min(1 - Math.min(1, b.dauer / b.plaetze), b.gaeste / b.plaetze) * 100}%` } }),
        ].reverse() : [];
        return el('button', {
          type: 'button', tabindex: '-1',
          class: `hm-st-saeule${t.winter ? ' winter' : ''}${t.laufend ? ' laufend' : ''}${t.tag === waehle ? ' an' : ''}${b && b.anteil >= daten.VOLL_AB ? ' voll' : ''}`,
          'data-tag': t.tag,
          'aria-label': b ? `Nacht ${t.tag}: ${prozent(b.anteil)} belegt` : `Nacht ${t.tag}`,
          onclick: () => { gewaehlt = t.tag; zeichne(); },
        }, el('span', { class: 'hm-st-stapel' }, ...kids));
      }));
  }

  function tagText(t) {
    const r = ctx().rules;
    const teile = daten.quellenSumme([t]).map((q) => `${q.name} ${euro(q.summe)}`);
    const b = t.belegung;
    const bel = b ? `${t.laufend ? 'Jetzt' : 'Nachts'} ${prozent(b.anteil)} belegt (${b.gaeste + b.dauer} von ${b.plaetze} Plätzen${b.dauer ? `, ${b.dauer} Dauerlieger` : ''})` : null;
    const wann = t.winter ? `Winter, Saison ${t.jahr}` : `Saison ${t.jahr}, Tag ${t.saisonTag} von ${r.seasonDays}`;
    return { kopf: `Tag ${t.tag}${t.laufend ? ' bis jetzt' : ''}`, wann, geld: t.summe > 0 ? `${euro(t.summe)}: ${teile.join(', ')}` : 'Kein Geld eingenommen.', bel,
      weg: t.weggefahren > 0 ? `${t.weggefahren} ${t.weggefahren === 1 ? 'Boot' : 'Boote'} weitergefahren` : null };
  }

  function kachel(wert, name, klasse = '') {
    return el('div', { class: `hm-st-kachel ${klasse}` }, el('b', {}, wert), el('span', {}, name));
  }

  function saisonTeil() {
    const alle = daten.saisons(st());
    if (!alle.length) return null;
    const zeilen = alle.slice(0, 5).map((s, i) => {
      const vor = alle[i + 1]?.jahr === s.jahr - 1 ? alle[i + 1] : null;
      const plus = daten.vergleich(s.einnahmen, vor?.einnahmen);
      return el('tr', {},
        el('td', {}, `Saison ${s.jahr}`),
        el('td', {}, euro(s.einnahmen), plus != null ? el('small', { class: plus > 0 ? 'auf' : plus < 0 ? 'ab' : '' }, ` ${plus > 0 ? '+' : plus < 0 ? '−' : '±'}${Math.abs(plus)} %`) : null),
        el('td', {}, s.belegung != null ? prozent(s.belegung) : '–'),
        el('td', {}, s.bewertung != null ? num1(s.bewertung) : '–'));
    });
    return el('div', { class: 'hm-st-block' },
      el('h3', {}, 'Saisons'),
      el('table', { class: 'hm-st-saisons' },
        el('thead', {}, el('tr', {}, el('th', {}, ''), el('th', {}, 'Einnahmen'), el('th', {}, 'Belegung'), el('th', {}, 'Anker'))),
        el('tbody', {}, ...zeilen)));
  }

  function zeichne() {
    if (!offen || !st()) return;
    const tage = liste();
    const z = daten.zusammenfassung(tage);
    const quellen = daten.quellenSumme(tage);
    const waehle = tage.some((t) => t.tag === gewaehlt) ? gewaehlt : tage.at(-1)?.tag ?? null;
    const t = tage.find((x) => x.tag === waehle);

    const kopf = el('header', { class: 'hm-st-kopf' },
      el('i', { class: 'hm-sym', 'aria-hidden': 'true', style: '--sym: var(--px-statistik)' }),
      el('div', { class: 'hm-st-kopftext' },
        el('h2', { id: 'hm-st-titel' }, 'Statistik'),
        el('p', {}, !tage.length ? 'Erster Tag' : tage.length === 1 ? (tage[0].laufend ? 'Heute' : `Tag ${tage[0].tag}`)
          : `Tag ${tage[0].tag} bis ${tage.at(-1).laufend ? `heute (Tag ${tage.at(-1).tag})` : tage.at(-1).tag}`)),
      el('button', { type: 'button', class: 'hm-zu hm-st-zu', 'aria-label': 'Statistik schließen', title: 'Schließen (Esc)', onclick: schliessen }));

    if (!tage.length) {
      karte.replaceChildren(kopf, el('p', { class: 'hm-st-leer' }, 'Die Statistik füllt sich ab dem ersten Abend.'));
      return;
    }

    const kacheln = el('div', { class: 'hm-st-kacheln' },
      kachel(euro(z.summe), `in ${tage.length} ${tage.length === 1 ? 'Tag' : 'Tagen'}`),
      kachel(euro(z.schnitt), 'je Saisontag'),
      kachel(z.belegung != null ? prozent(z.belegung) : '–', z.geschaetzt ? 'belegt, geschätzt' : 'nachts belegt'));

    const legende = el('p', { class: 'hm-st-legende' },
      ...quellen.map((q) => el('span', { 'data-q': q.id }, el('i', { 'aria-hidden': 'true' }), `${q.name} ${euro(q.summe)}`, el('small', {}, ` ${Math.round(q.anteil * 100)} %`))));

    const achse = el('div', { class: 'hm-st-achse', 'aria-hidden': 'true' },
      el('span', {}, `Tag ${tage[0].tag}`),
      z.winterTage ? el('span', { class: 'hm-st-winter-legende' }, el('i'), 'Winter') : null,
      el('span', {}, tage.at(-1).laufend ? 'heute' : `Tag ${tage.at(-1).tag}`));

    const info = t ? tagText(t) : null;
    const tagBlock = info ? el('div', { class: 'hm-st-tag', role: 'status' },
      el('p', { class: 'hm-st-tag-kopf' }, el('b', {}, info.kopf), el('span', {}, info.wann)),
      el('p', {}, info.geld),
      info.bel ? el('p', {}, info.bel) : null,
      info.weg ? el('p', { class: 'warn' }, info.weg) : null,
      !t.laufend && game.tagesabschluss?.zeige ? el('button', {
        type: 'button', class: 'hm-knopf hm-px hm-st-zum-tag',
        onclick: () => { schliessen(); game.tagesabschluss.zeige(t.tag); },
      }, 'Tagesabschluss dieses Tages') : null) : null;

    const satz = hinweis(z);
    // replaceChildren schreibt null als Text: leere Teile vorher weglassen
    karte.replaceChildren(...[
      kopf,
      kacheln,
      el('div', { class: 'hm-st-block' },
        el('h3', {}, 'Einnahmen nach Quelle'),
        saeulen(tage, waehle),
        legende),
      el('div', { class: 'hm-st-block' },
        el('h3', {}, 'Belegung der Liegeplätze'),
        belegungSaeulen(tage, waehle),
        el('p', { class: 'hm-st-legende' },
          el('span', { 'data-q': 'gast' }, el('i', { 'aria-hidden': 'true' }), 'Gäste'),
          el('span', { 'data-q': 'dauer' }, el('i', { 'aria-hidden': 'true' }), 'Dauerlieger'),
          z.volleNaechte ? el('span', {}, `${z.volleNaechte} ${z.volleNaechte === 1 ? 'Nacht' : 'Nächte'} voll`) : null),
        achse),
      tagBlock,
      satz ? el('p', { class: 'hm-st-hinweis' }, satz) : null,
      saisonTeil(),
    ].filter(Boolean));
  }

  // ------------------------------------------------------------ Lage: frei zwischen den Bedienknöpfen
  const handyMedia = globalThis.matchMedia?.('(max-width: 640px), (max-height: 500px)');
  const istHandy = () => !!handyMedia?.matches;
  function rechteck(sel) {
    const x = typeof sel === 'string' ? document.querySelector(sel) : sel;
    if (!x || x.hidden || x.offsetParent === null) return null;
    const r = x.getBoundingClientRect();
    return r.width > 0 && r.height > 0 ? r : null;
  }
  function platziere() {
    if (karte.hidden) return;
    const huelle = (karte.offsetParent ?? root).getBoundingClientRect();
    const W = huelle.width;
    const H = huelle.height;
    const rand = 8;
    const quer = W > H;
    let links = rand;
    let rechts = W - rand;
    let oben = rand;
    let unten = H - rand;
    const status = rechteck('.hm-status');
    const werkzeuge = rechteck('.hm-werkzeuge');
    if (quer && istHandy()) {
      // Neben Kasse und Zeit (links) und vor die Knöpfe rechts
      for (const r of [status, rechteck('#hm-zeit')]) if (r) links = Math.max(links, r.right - huelle.left + rand);
      for (const r of [werkzeuge, rechteck('#btn-build')]) if (r) rechts = Math.min(rechts, r.left - huelle.left - rand);
      const kassieren = rechteck('#btn-collect');
      if (kassieren && kassieren.right - huelle.left > links && kassieren.left - huelle.left < rechts) unten = Math.min(unten, kassieren.top - huelle.top - rand);
    } else {
      // Unter die Statusleiste und die Knöpfe oben, über Zeit, Kassieren und Bauen. Die linke Spalte
      // (Wetter, Tagesziele, Ausbau) zeigt nur etwas an und darf überdeckt werden: die Karte ist vom
      // Spieler geöffnet und schließt mit einem Tipp.
      for (const r of [status, werkzeuge]) if (r) oben = Math.max(oben, r.bottom - huelle.top + rand);
      for (const r of ['#hm-zeit', '#btn-collect', '#btn-build'].map(rechteck)) if (r) unten = Math.min(unten, r.top - huelle.top - rand);
    }
    // Am Handy hochkant höchstens die Hälfte der Höhe (der Rest scrollt), damit der Hafen sichtbar bleibt
    if (!quer && istHandy()) unten = Math.min(unten, oben + Math.round(H * 0.5));
    const breite = Math.max(240, Math.min(quer && istHandy() ? 380 : 460, rechts - links));
    karte.style.left = `${Math.round(links + (rechts - links - breite) / 2)}px`;
    karte.style.top = `${Math.round(oben)}px`;
    karte.style.width = `${Math.round(breite)}px`;
    karte.style.maxHeight = `${Math.max(160, Math.round(unten - oben))}px`;
    karte.classList.toggle('quer', quer && istHandy());
  }
  window.addEventListener('resize', () => platziere());
  game.on('resize', () => platziere());

  // Neu zeichnen, wenn ein Tag zu Ende geht oder Geld kommt (höchstens einmal je Bild)
  let geplant = false;
  const spaeter = () => {
    if (!offen || geplant) return;
    geplant = true;
    requestAnimationFrame(() => { geplant = false; const s = karte.scrollTop; zeichne(); karte.scrollTop = s; platziere(); });
  };
  game.on('sim:dayEnd', spaeter);
  game.on('sim:collected', spaeter);
  game.on('spielstand-geladen', schliessen);
  game.on('ui:cancel', schliessen);
  game.on('feier:auf', () => { if (offen) platziere(); });

  window.addEventListener('keydown', (e) => {
    if (e.target?.closest?.('input, textarea, select, [contenteditable]')) return;
    if (offen && e.key === 'Escape') { schliessen(); e.preventDefault(); return; }
    if (offen && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      const tage = liste();
      const i = tage.findIndex((t) => t.tag === (gewaehlt ?? tage.at(-1)?.tag));
      const n = tage[Math.max(0, Math.min(tage.length - 1, i + (e.key === 'ArrowLeft' ? -1 : 1)))];
      if (n) { gewaehlt = n.tag; zeichne(); }
      e.preventDefault();
      return;
    }
    if (e.code === 'KeyT' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat) {
      if (offen) schliessen(); else oeffnen();
    }
  });

  Object.assign(schnittstelle, {
    oeffnen: (tag) => oeffnen(tag),
    schliessen,
    offen: () => offen && !karte.hidden,
    bereit: true,
  });
}

export default init;
