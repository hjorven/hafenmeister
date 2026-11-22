// Preisstufe am Hafenbüro (Roadmap P35, F6): Preistafel, Meldung zur Saison und Tafel im Hafen.
// Regeln in features/preisstufe-regeln.js, Beschreibung in docs/preisstufe.md.
//
// So spielt es sich:
// - Ab "Hafenmeister mit Funk" steht am Hafenmeisterhaus (später am Hafenbüro) eine Preistafel. Antippen
//   öffnet das Gästebuch bei der Preistafel (dort steht auch, wie die Gäste über die Preise schreiben).
// - Drei Stufen: günstig (mehr Boote, Gäste loben die Preise), normal, gehoben (mehr Liegegeld, mehr große
//   Yachten, wer viel zahlt, erwartet, dass alles da ist). Einmal je Saison, im Winter für die kommende.
//   Am Tag der Wahl darf man noch umentscheiden, nach jedem Ausbau darf man neu wählen.
// - Beim Freischalten und im Winter fragt eine kurze Meldung, ob man die Preise festlegen will.
//
// Schnittstelle: game.preisstufe = { stufe(), darf(), waehle(id), abschnitt(), oeffnen(), klug() }
// Ereignis: 'sim:preisstufe' { stufe, vorher, jahr, day, umgestellt } (über game.sim.dispatch)
import { regelnBereit } from './regeln-bereit.js';
import { pixelBild } from '../ui/pixel-symbole.js';
import * as P from './preisstufe-regeln.js';
import { seasonOf } from '../events/scheduler.js';
import { baseNightlyFee } from '../sim.js';

const MELDUNG_ID = 'preisstufe';
const MELDUNG_VORRANG = 56;            // zwischen Ankündigung (55) und Funk (57), siehe ui/meldungen.js
const STEHT_SEKUNDEN = { frage: 16, info: 6 };
const MUENZEN = { guenstig: 'preis1', normal: 'preis2', gehoben: 'preis3' };
const BEISPIEL_LAENGE = 10;            // Meter: Beispielboot für die Preise auf der Tafel
const euro = (n) => `${Math.round(n).toLocaleString('de-DE')} €`;

function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'onclick') e.addEventListener('click', (ev) => { ev.stopPropagation(); v(ev); });
    else if (k === 'style') e.setAttribute('style', v);
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c);
  return e;
}
const bild = (name, g = 24) => { try { return pixelBild(name, g); } catch { return null; } };

export async function init(game) {
  if (typeof document === 'undefined') return;
  const api = await regelnBereit(game);
  P.haengeEin(api.addHook);
  const st = () => api.state;
  const ctx = () => api.ctx;

  // ------------------------------------------------------------ Regeln für die Oberfläche
  const stufe = () => (st() ? P.stufe(st()) : P.START);
  const darf = () => (st() ? P.darfWaehlen(st(), ctx()) : { ok: false, grund: 'buero', jahr: 1 });
  function waehle(id) {
    const s = st();
    if (!s) return { ok: false, reason: 'state' };
    const r = P.waehle(s, ctx(), id);
    if (r.ok) {
      api.dispatch?.(r.events);
      game.audio?.sfx?.('kasse');
      // sofort sichern: die Wahl gilt für die Saison, Neuladen soll sie nicht zurückdrehen
      setTimeout(() => { try { game.spielstand?.speichern?.(); } catch { /* ohne Speicher weiter */ } }, 0);
    }
    return r;
  }

  // Beispielpreis: ein 10-m-Boot der mittleren Klasse, eine Nacht ohne Wünsche
  function beispiel() {
    try {
      const grund = baseNightlyFee(ctx(), { size: 'M', length: BEISPIEL_LAENGE, typeId: null });
      return grund > 0 ? P.beispielPreise(ctx(), grund) : null;
    } catch { return null; }
  }

  // Tage bis zur nächsten Saison (für "Nächste Wahl in ...")
  function tageBisWahl() {
    const s = st();
    if (!s) return null;
    const jetzt = P.saisonJahr(s.day);
    for (let t = 1; t < 60; t++) if (P.saisonJahr(s.day + t) > jetzt) return t;
    return null;
  }

  // ------------------------------------------------------------ Preistafel (Abschnitt im Gästebuch)
  let tafelOffen = false;
  function abschnitt() {
    const s = st();
    if (!s || !ctx()?.rules?.priceLevels) return null;
    const officeAb = ctx().rules.office?.fromStage?.[ctx().rules.priceLevels.fromOffice] ?? 2;
    // Vor Stufe 2 bleibt die Tafel weg (der Einstieg soll schlank sein)
    if ((s.stage ?? 1) < officeAb && !P.frei(s, ctx())) return null;
    const d = darf();
    const jetzt = stufe();
    const preise = beispiel();
    const knoepfe = P.STUFEN.map((id) => {
      const an = id === jetzt;
      const t = P.TEXTE[id] ?? { name: id, kurz: '' };
      return el('button', {
        type: 'button', class: `ps-stufe${an ? ' an' : ''}`, role: 'radio', 'aria-checked': an ? 'true' : 'false',
        'data-stufe': id, disabled: !d.ok && !an ? true : null,
        title: P.wirkungText(ctx(), id).join(' · '),
        onclick: () => {
          if (an || !darf().ok) return;
          waehle(id);
          zeichneAlle();
        },
      },
      bild(MUENZEN[id] ?? 'muenze', 24),
      el('b', { text: t.name }),
      preise ? el('small', { text: `${euro(preise[id])} / Nacht` }) : null);
    });
    let status;
    if (d.grund === 'buero') {
      const name = ctx().rules.office?.names?.[ctx().rules.priceLevels.fromOffice] ?? 'Hafenmeister mit Funk';
      status = `Kommt mit dem ${name} (Bauen).`;
    } else if (d.ausbau) {
      status = 'Neue Hafenstufe: Du darfst die Preise neu festlegen.';
    } else if (d.heuteNoch) {
      status = `Gilt ab sofort für Saison ${d.jahr}. Heute kannst du noch umentscheiden.`;
    } else if (d.ok) {
      const w = seasonOf(s.day).winter;
      status = w ? `Wähle die Preise für Saison ${d.jahr}. Einmal je Saison.` : `Wähle die Preise für diese Saison. Danach erst wieder in Saison ${d.jahr + 1}.`;
    } else {
      const t = tageBisWahl();
      status = `Für Saison ${d.jahr} entschieden. Nächste Wahl im Winter${t ? ` (in ${t} ${t === 1 ? 'Tag' : 'Tagen'})` : ''} oder nach dem nächsten Ausbau.`;
    }
    const wirkung = P.wirkungText(ctx(), jetzt);
    const teil = el('div', { class: 'hm-gb-preise', id: 'hm-preistafel' },
      el('h3', { text: 'Preistafel' }),
      el('div', { class: 'ps-wahl', role: 'radiogroup', 'aria-label': 'Preisstufe' }, ...knoepfe),
      el('p', { class: 'hm-gb-klein ps-wirkung' }, el('b', { text: `${P.TEXTE[jetzt]?.name ?? jetzt}: ` }), wirkung.join(' · ')),
      el('p', { class: 'hm-gb-klein ps-status', text: status }));
    if (preise) teil.querySelector('.ps-wahl').setAttribute('title', `Preise für ein ${BEISPIEL_LAENGE}-m-Boot ohne Wünsche`);
    return teil;
  }

  // Gästebuch neu zeichnen (dort steht der Abschnitt), ohne es zu öffnen
  function zeichneAlle() {
    if (game.gaestebuch?.offen) {
      game.gaestebuch.schliessen();
      game.gaestebuch.oeffnen();
      zurTafel(false);
    }
    tafel3d?.aktualisiere();
  }
  function zurTafel(blinken = true) {
    const t = document.getElementById('hm-preistafel');
    if (!t) return;
    t.scrollIntoView({ block: 'start', behavior: 'instant' });
    if (blinken) { t.classList.remove('ps-blink'); void t.offsetWidth; t.classList.add('ps-blink'); }
  }
  function oeffnen() {
    if (!game.gaestebuch) return;
    tafelOffen = true;
    game.gaestebuch.oeffnen();
    setTimeout(() => zurTafel(true), 0);
  }

  // ------------------------------------------------------------ Meldungskarte (Meldeplatz)
  const host = document.getElementById('game') ?? document.body;
  const karte = el('div', { id: 'hm-preis-karte', class: 'hm-px', role: 'status', 'aria-live': 'polite', hidden: true });
  host.append(karte);
  game.meldungen?.anmelden?.('#hm-preis-karte', MELDUNG_ID);
  let timer = 0;
  let rest = 0;
  let bisSchluss = 0;

  function karteZu() {
    karte.hidden = true;
    clearTimeout(timer);
    timer = 0;
    game.meldungen?.fertig(MELDUNG_ID);
  }
  function karteZeige(art, titel, text, knoepfe = []) {
    karte.replaceChildren(
      el('div', { class: 'ps-kopf' }, bild(MUENZEN[stufe()] ?? 'muenze', 24), el('div', {}, el('strong', { text: titel }), el('span', { text }))),
      el('div', { class: 'ps-knoepfe' }, ...knoepfe, el('button', { type: 'button', class: 'hm-knopf', onclick: karteZu, text: knoepfe.length ? 'Später' : 'Gut' })));
    clearTimeout(timer);
    timer = 0;
    rest = (STEHT_SEKUNDEN[art] ?? 8) * 1000;
    karte.hidden = false;
    game.meldungen?.wunsch(MELDUNG_ID, MELDUNG_VORRANG);
    ordne();
  }
  function ordne() {
    if (karte.hidden) return;
    const darfStehen = game.meldungen ? game.meldungen.darf(MELDUNG_ID) : true;
    const zurueck = !darfStehen || document.body.classList.contains('card-open') || !!game.gaestebuch?.offen;
    karte.classList.toggle('zurueck', zurueck);
    if (zurueck && timer) {
      clearTimeout(timer);
      timer = 0;
      rest = Math.max(0, bisSchluss - Date.now());
    } else if (!zurueck && !timer) {
      bisSchluss = Date.now() + rest;
      timer = setTimeout(karteZu, rest);
    }
  }
  game.on('meldungen:wechsel', ordne);
  game.on('card', ordne);
  setInterval(ordne, 500);
  game.on('foto', karteZu);

  // Fragen: wenn die Tafel frei wird und im Winter (für die kommende Saison), einmal je Saison
  function vielleichtFragen() {
    const s = st();
    if (!s || !P.frei(s, ctx())) return;
    const d = darf();
    const m = P.pState(s);
    if (!d.ok || d.heuteNoch) return;
    const sz = seasonOf(s.day);
    const erstes = !m.verlauf.length && m.gesehen == null;
    // Nach einem Ausbau einmal je Hafenstufe fragen
    if (d.ausbau) {
      if (m.gesehenAusbau === s.stage) return;
      m.gesehenAusbau = s.stage;
      karteZeige('frage', 'Neue Hafenstufe, neue Preise?', `Bis jetzt: ${P.TEXTE[stufe()]?.name ?? stufe()}. Nach dem Ausbau darfst du neu wählen.`,
        [el('button', { type: 'button', class: 'hm-knopf hm-primaer', onclick: () => { karteZu(); oeffnen(); }, text: 'Preistafel' })]);
      return;
    }
    if (m.gesehen === d.jahr) return;
    // Mitten in der Saison nur beim ersten Mal (Freischalten); sonst im Winter
    if (!sz.winter && !erstes) return;
    m.gesehen = d.jahr;
    const name = P.TEXTE[stufe()]?.name ?? stufe();
    karteZeige('frage', erstes ? 'Neu: Preistafel am Hafenbüro' : `Preise für Saison ${d.jahr}`,
      erstes
        ? 'Günstig lockt mehr Boote, gehoben bringt mehr Liegegeld. Du entscheidest einmal je Saison.'
        : `Bis jetzt: ${name}. Ohne neue Wahl bleibt es dabei.`,
      [el('button', { type: 'button', class: 'hm-knopf hm-primaer', onclick: () => { karteZu(); oeffnen(); }, text: 'Preistafel' })]);
  }
  game.on('sim:dayStart', () => setTimeout(vielleichtFragen, 3500));
  game.on('sim:built', (e) => { if (e?.id === 'office') setTimeout(vielleichtFragen, 2500); });
  game.on('stufe', () => setTimeout(vielleichtFragen, 6000));
  game.on('sim:preisstufe', () => { karteZu(); tafel3d?.aktualisiere(); });
  game.on('sim:change', (d) => { if (d?.reason === 'load' || d?.reason === 'new') { karteZu(); setTimeout(() => tafel3d?.aktualisiere(), 50); } });
  game.on('spielstand-geladen', () => setTimeout(() => tafel3d?.aktualisiere(), 50));

  // ------------------------------------------------------------ Tafel im Hafen (3D)
  let tafel3d = null;
  try {
    const m = await import('../render/preistafel.js');
    tafel3d = m.init(game, { stufe, frei: () => !!st() && P.frei(st(), ctx()) });
  } catch (err) {
    console.info('Preistafel im Hafen nicht geladen:', err?.message ?? err);
  }
  game.on('tap', ({ pick } = {}) => { if (pick?.type === 'preistafel') oeffnen(); });

  // klug(): Faustregel (preisstufe-regeln.js klugeWahl), danach wählt der Bot im Zeitraffer (tools/zeitraffer/lauf.cjs)
  game.preisstufe = { stufe, darf, waehle, abschnitt, oeffnen, klug: () => (st() ? P.klugeWahl(st(), ctx()) : 'normal'), get tafelOffen() { return tafelOffen; } };

  // ------------------------------------------------------------ Aussehen
  const stil = document.createElement('style');
  stil.textContent = `
    #hm-preis-karte { position: absolute; left: 50%; transform: translateX(-50%); z-index: 26; width: min(400px, calc(100% - 32px));
      padding: 10px 12px; color: var(--hm-tinte, #283648); line-height: 1.35; }
    #hm-preis-karte[hidden], #hm-preis-karte.zurueck { display: none; }
    #hm-preis-karte .ps-kopf { display: flex; gap: 10px; align-items: flex-start; text-align: left; }
    #hm-preis-karte .ps-kopf svg { flex: none; width: 24px; height: 24px; image-rendering: pixelated; }
    #hm-preis-karte strong { display: block; font-weight: 600; font-family: var(--hm-pixel, inherit); }
    #hm-preis-karte span { display: block; font-size: max(13px, 0.875rem); }
    #hm-preis-karte .ps-knoepfe { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; padding-left: 34px; }
    #hm-preis-karte .ps-knoepfe .hm-knopf { flex: 1 1 120px; min-height: 44px; }
    .hm-gb-preise { scroll-margin-top: 8px; }
    .hm-gb-preise .ps-wahl { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
    .hm-gb-preise .ps-stufe { display: grid; justify-items: center; align-content: center; gap: 2px; min-height: 76px; padding: 6px 4px;
      border: 0; background: var(--hm-mulde, #e9dfca); color: inherit; font: inherit; cursor: pointer;
      box-shadow: inset 0 0 0 2px rgba(36, 54, 74, 0.18); }
    .hm-gb-preise .ps-stufe svg { width: 24px; height: 24px; image-rendering: pixelated; }
    .hm-gb-preise .ps-stufe b { font-family: var(--hm-pixel, inherit); font-weight: 600; }
    .hm-gb-preise .ps-stufe small { font-size: 12.5px; font-variant-numeric: tabular-nums; color: var(--hm-tinte-2, #5a6a7c); }
    .hm-gb-preise .ps-stufe.an { background: #f6e7b8; box-shadow: inset 0 0 0 3px var(--hm-tinte, #24364a); cursor: default; }
    .hm-gb-preise .ps-stufe:disabled { opacity: 0.45; cursor: default; }
    .hm-gb-preise .ps-stufe:not(:disabled):not(.an):hover { box-shadow: inset 0 0 0 2px var(--hm-tinte, #24364a); }
    .hm-gb-preise .ps-wirkung, .hm-gb-preise .ps-status { margin: 6px 0 0; }
    .hm-gb-preise.ps-blink { animation: ps-blink 1.2s steps(4) 1; }
    @keyframes ps-blink { 0%, 50% { background: #f6e7b8; } 100% { background: transparent; } }
    @media (max-width: 599px) {
      #hm-preis-karte { padding: 8px 10px; }
      #hm-preis-karte .ps-knoepfe { padding-left: 0; margin-top: 6px; }
      .hm-gb-preise .ps-stufe { min-height: 64px; }
    }
  `;
  document.head.append(stil);
}

export default init;
