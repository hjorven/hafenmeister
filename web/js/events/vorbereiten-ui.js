// Ereignisse zum Vorbereiten: Karte zur Ankündigung, Knopf im Wetterbericht, Ergebnis am Abend.
// Regeln in events/vorbereiten.js. Die Karte steht an der Stelle des Ereignisschilds
// (events/banner.js) und hält sich an die Meldungs-Ordnung (ui/meldungen.js, Vorrang 'ereignis').
import { pixelBild } from '../ui/pixel-symbole.js';
import { VORRANG } from '../ui/meldungen.js';
import { regelnBereit } from '../features/regeln-bereit.js';
import * as V from './vorbereiten.js';

const STEHT_SEKUNDEN = 20;     // Ankündigung mit Knopf: so lange (echte Sekunden), danach steht der Knopf im Wetterbericht
const ERGEBNIS_SEKUNDEN = 9;

export async function initVorbereiten(game) {
  await regelnBereit(game);
  const api = game.sim;
  const ctx = api.ctx;
  const st = () => api.state;

  // Angekündigtes oder laufendes Ereignis aus dem Planer (events/events.js)
  const geplant = () => {
    const p = game.events?.planned;
    return p ? { id: p.id, startDay: p.startDay, endDay: p.endDay } : null;
  };
  const laufend = () => {
    const c = game.events?.current;
    return c ? { id: c.id, startDay: c.startDay, endDay: c.endDay } : null;
  };
  const outer = () => game.events?.modifiers?.()?.satisfaction?.outer ?? 0;
  V.haengeEin(api.addHook, { laufend, geplant, outer });

  // ------------------------------------------------------------ Was kann man gerade vorbereiten?
  // { art: 'sturm' | 'regatta', plan, erledigt, text, knopf, zurueck? } oder null
  function angebot() {
    const s = st();
    if (!s) return null;
    const p = geplant();
    if (p?.id === 'sturm' && s.stage >= 3 && V.hatOffenePlaetze(s, ctx)) {
      const v = s.modules?.vorbereitung?.sturm;
      const klar = !!(v?.klar && v.startDay === p.startDay);
      const n = V.draussen(s, ctx).length;
      const wann = p.startDay - s.day <= 1 ? 'Morgen' : 'Bald';
      if (klar) {
        return { art: 'sturm', plan: p, erledigt: true, titel: 'Hafen ist sturmklar',
          text: n > 0 ? `${n === 1 ? 'Ein Gast liegt' : `${n} Gäste liegen`} noch draußen: innen war kein Platz frei.` : 'Offene Plätze bleiben bis nach dem Sturm frei.',
          knopf: n > 0 ? 'Noch einmal verholen' : null, zurueck: 'Offene Plätze freigeben' };
      }
      return { art: 'sturm', plan: p, erledigt: false, titel: `${wann} Sturm`,
        text: n > 0
          ? `${n === 1 ? 'Ein Gast liegt' : `${n} Gäste liegen`} an offenen Plätzen am Stegkopf und würde${n === 1 ? '' : 'n'} beim Sturm schlechter bewerten. Nach innen verholen?`
          : 'Offene Plätze am Stegkopf trifft der Sturm. Für Gäste sperren, bis er vorbei ist?',
        knopf: 'Sturmklar machen' };
    }
    const r = p?.id === 'regatta' ? p : (laufend()?.id === 'regatta' ? laufend() : null);
    if (r && s.stage >= 3) {
      const v = s.modules?.vorbereitung?.regatta;
      const haben = v && v.startDay === r.startDay ? v.plaetze.length : 0;
      const n = V.regattaAnzahl(s.stage);
      if (haben > 0) {
        const mehr = haben < n && V.regattaKandidaten(s, ctx).length > 0;
        return { art: 'regatta', plan: r, erledigt: true, titel: `${haben} ${haben === 1 ? 'Platz' : 'Plätze'} für die Regatta`,
          text: `Sie bleiben bis zum Start frei, dann legen dort nur Segelboote an und zahlen Startgeld.`,
          knopf: mehr ? 'Mehr freihalten' : null, zurueck: 'Plätze freigeben' };
      }
      const tage = r.startDay - s.day;
      const wann = tage <= 0 ? 'Heute' : tage === 1 ? 'Morgen' : 'Übermorgen';
      return { art: 'regatta', plan: r, erledigt: false, titel: `${wann} Regatta`,
        text: `Halte ${n} Plätze für die Segler frei: jedes Regattaboot darauf zahlt einmal Startgeld.`,
        knopf: 'Plätze freihalten' };
    }
    return null;
  }

  function handle(art, zurueck = false) {
    const s = st();
    const a = angebot();
    if (!s || !a || a.art !== art) return;
    let r;
    if (art === 'sturm') r = zurueck ? V.sturmklarAufheben(s) : V.sturmklar(s, ctx, a.plan);
    else r = zurueck ? V.regattaFreigeben(s) : V.regattaFreihalten(s, ctx, a.plan);
    api.dispatch(r.events);
    // Grün-Rot-Schilder: gesperrte und freigehaltene Plätze zeigen 'reserviert'
    game.emit('sim:berthState', { plaetze: api.platzZustaende() });
    game.emit('sim:change', { reason: 'vorbereitung' });
    game.audio?.sfx?.(zurueck ? 'klick' : 'auswahl');
    return r;
  }

  // ------------------------------------------------------------ Karte
  const host = document.getElementById('game') ?? document.body;
  const karte = document.createElement('div');
  karte.id = 'ev-vorbereiten';
  karte.className = 'hm-px';
  karte.setAttribute('role', 'status');
  karte.setAttribute('aria-live', 'polite');
  karte.hidden = true;
  host.appendChild(karte);

  // Die Karte geht nach einer Weile von selbst. Wartet sie hinter einer wichtigeren Meldung, steht ihre Uhr.
  let timer = 0;
  let bisSchluss = 0;       // echte Zeit (ms), wann die Karte von selbst geht (solange die Uhr läuft)
  let rest = 0;             // verbleibende Zeit (ms), solange die Uhr steht
  let gezeigt = null;       // 'angebot' | 'ergebnis'

  function schliesse() {
    karte.hidden = true;
    gezeigt = null;
    clearTimeout(timer);
    timer = 0;
    game.meldungen?.fertig('ereignis');
  }

  function knopf(text, primaer, fn) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'hm-knopf' + (primaer ? ' hm-primaer' : '');
    b.textContent = text;
    b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
    return b;
  }

  function fuelle(symbol, titel, text, knoepfe = []) {
    karte.replaceChildren();
    const kopf = document.createElement('div');
    kopf.className = 'evv-kopf';
    try { const b = pixelBild(symbol, 24); if (b) kopf.append(b); } catch { /* ohne Symbol */ }
    const body = document.createElement('div');
    const t = document.createElement('strong');
    t.textContent = titel;
    const p = document.createElement('span');
    p.textContent = text;
    body.append(t, p);
    kopf.append(body);
    karte.append(kopf);
    if (knoepfe.length) {
      const reihe = document.createElement('div');
      reihe.className = 'evv-knoepfe';
      reihe.append(...knoepfe);
      karte.append(reihe);
    }
  }

  function zeige(sekunden) {
    // Das Ereignisschild hat denselben Platz: die Karte übernimmt
    const banner = document.getElementById('event-banner');
    if (banner) banner.hidden = true;
    clearTimeout(timer);
    timer = 0;
    rest = sekunden * 1000;
    karte.hidden = false;
    game.meldungen?.wunsch('ereignis', VORRANG.ereignis);
    ordne();
  }

  function zeigeAngebot() {
    const a = angebot();
    if (!a) return false;
    const knoepfe = [];
    if (a.knopf) knoepfe.push(knopf(a.knopf, true, () => { handle(a.art); zeigeAngebotNach(); }));
    knoepfe.push(knopf(a.erledigt ? 'Gut' : 'Später', false, schliesse));
    fuelle(a.art === 'sturm' ? 'sturm' : 'regatta', a.titel, a.text, knoepfe);
    gezeigt = 'angebot';
    zeige(STEHT_SEKUNDEN);
    return true;
  }
  // Nach dem Knopf: kurz den neuen Stand zeigen
  function zeigeAngebotNach() {
    const a = angebot();
    if (!a) { schliesse(); return; }
    fuelle(a.art === 'sturm' ? 'sturm' : 'regatta', a.titel, a.text, [knopf('Gut', false, schliesse)]);
    zeige(5);
  }

  function zeigeErgebnis(e) {
    const t = V.ergebnisText(e);
    fuelle(t.symbol, t.titel, t.text, [knopf('Gut', false, schliesse)]);
    gezeigt = 'ergebnis';
    zeige(ERGEBNIS_SEKUNDEN);
  }

  // Meldungs-Ordnung: steht etwas Wichtigeres, wartet die Karte ausgeblendet (ihre Zeit läuft weiter)
  function ordne() {
    if (karte.hidden) return;
    const darf = game.meldungen ? game.meldungen.darf('ereignis') : true;
    const zurueck = !darf || document.body.classList.contains('card-open');
    karte.classList.toggle('zurueck', zurueck);
    if (zurueck && timer) {
      clearTimeout(timer);
      timer = 0;
      rest = Math.max(0, bisSchluss - Date.now());
    } else if (!zurueck && !timer) {
      bisSchluss = Date.now() + rest;
      timer = setTimeout(schliesse, rest);
    }
  }
  game.on('meldungen:wechsel', ordne);
  game.on('card', ordne);
  new MutationObserver(ordne).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  // Ankündigung: Karte mit Knopf statt des Ereignisschilds
  game.vorbereitung = {
    angebot,
    handle,
    /** banner.js fragt: übernimmt die Karte diese Ankündigung? */
    uebernimmt: (event) => {
      const a = angebot();
      return !!a && a.art === event?.id;
    },
  };
  game.on('event:announce', ({ event }) => {
    // Erst nach dem Morgen der Spielregeln (Planer und Sim sind dann auf demselben Tag)
    setTimeout(() => { if (angebot()?.art === event?.id) zeigeAngebot(); }, 0);
  });
  // Am Abend vor dem Sturm oder der Regatta noch einmal erinnern, wenn nichts vorbereitet ist
  game.on('sim:evening', () => {
    const a = angebot();
    const s = st();
    if (!a || a.erledigt || !s || a.plan.startDay !== s.day + 1) return;
    if (a.art === 'sturm' && V.draussen(s, ctx).length === 0) return;
    zeigeAngebot();
  });
  game.on('sim:ereignisErgebnis', (e) => zeigeErgebnis(e));
  game.on('sim:dayStart', () => { if (gezeigt === 'angebot') schliesse(); });
  game.on('spielstand-geladen', schliesse);
  game.on('foto', schliesse);

  // Wetterbericht: Knopf unter dem Ereignis (banner.js ruft zeile(entry) auf)
  game.vorbereitung.zeile = (entry) => {
    const a = angebot();
    if (!a || !entry?.event || entry.event.id !== a.art || entry.day < a.plan.startDay || entry.day > a.plan.endDay) return null;
    if (entry.day !== a.plan.startDay) return null;
    const box = document.createElement('div');
    box.className = 'evv-zeile';
    const p = document.createElement('small');
    p.textContent = a.erledigt ? a.titel : a.text;
    box.append(p);
    const reihe = document.createElement('div');
    reihe.className = 'evv-knoepfe';
    const nach = () => { game.emit('event:loaded', {}); };
    if (a.knopf) reihe.append(knopf(a.knopf, true, () => { handle(a.art); nach(); }));
    if (a.zurueck) reihe.append(knopf(a.zurueck, false, () => { handle(a.art, true); nach(); }));
    if (reihe.childElementCount) box.append(reihe);
    return box;
  };

  const stil = document.createElement('style');
  stil.textContent = `
    #ev-vorbereiten { position: absolute; left: 50%; transform: translateX(-50%); z-index: 26;
      top: calc(var(--hm-oben, env(safe-area-inset-top, 0px)) + var(--hm-knopf, 44px) + 8px);
      width: min(420px, calc(100% - 32px)); padding: 10px 12px; color: var(--hm-tinte, #283648); line-height: 1.35; }
    #ev-vorbereiten:not(.hm-px) { background: #fffcf6; border: 2px solid #283648; }
    #ev-vorbereiten[hidden], #ev-vorbereiten.zurueck { display: none; }
    #ev-vorbereiten .evv-kopf { display: flex; gap: 10px; align-items: flex-start; text-align: left; }
    #ev-vorbereiten .evv-kopf img, #ev-vorbereiten .evv-kopf svg { flex: none; width: 24px; height: 24px; image-rendering: pixelated; }
    #ev-vorbereiten strong { display: block; font-weight: 600; font-family: var(--hm-pixel, inherit); }
    #ev-vorbereiten span { display: block; font-size: max(13px, 0.875rem); }
    .evv-knoepfe { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; pointer-events: auto; }
    .evv-knoepfe .hm-knopf { flex: 1 1 120px; }
    #ev-vorbereiten .evv-knoepfe { padding-left: 34px; }
    #weather-panel .evv-zeile { grid-column: 1 / -1; padding: 2px 4px 8px; text-align: left; }
    #weather-panel .evv-zeile small { display: block; }
    #weather-panel .evv-zeile .hm-knopf { min-height: 44px; }
    /* Steht die Karte, ruht "Als Nächstes" (ui/bauen.js) */
    .hm-neu:has(#ev-vorbereiten:not([hidden]):not(.zurueck)) .bau-tipp { display: none; }
  `;
  document.head.appendChild(stil);
}
