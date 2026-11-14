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

  // Angekündigtes oder laufendes Ereignis aus dem Planer (events/events.js). Das große Ereignis
  // (Hanse-Woche) hat einen eigenen Platz: geplantGross().
  const geplant = () => {
    const p = game.events?.planned;
    return p ? { id: p.id, startDay: p.startDay, endDay: p.endDay } : null;
  };
  const geplantGross = () => {
    const p = game.events?.gross;
    return p ? { id: p.id, startDay: p.startDay, endDay: p.endDay } : null;
  };
  const serviceName = (id) => game.services?.katalog?.find?.((x) => x.id === id)?.name ?? id;
  const bauStufe = (id) => game.events?.bauStufe?.(id) ?? 0;
  const laufend = () => {
    const c = game.events?.current;
    return c ? { id: c.id, startDay: c.startDay, endDay: c.endDay } : null;
  };
  const outer = () => game.events?.modifiers?.()?.satisfaction?.outer ?? 0;
  V.haengeEin(api.addHook, { laufend, geplant, outer, bauStufe });

  // Bauten zum Ereignis (G7): was gebaut ist und was es bringt, sonst der beste fehlende Bau als Tipp
  function bauZeile(eventId) {
    const bauten = V.BAUTEN[eventId];
    if (!bauten) return '';
    const da = Object.keys(bauten).filter((id) => bauStufe(id) > 0);
    if (da.length) {
      const summe = da.reduce((a, id) => a + V.bauGeld(eventId, id, bauStufe(id)), 0);
      const wer = da.length === 1 ? bauten[da[0]].text : da.slice(0, 3).map(serviceName).join(da.length === 2 ? ' und ' : ', ');
      return `${wer}: +${summe.toLocaleString('de-DE')} € am Tag.`;
    }
    const s = st();
    // Nur Bauten, die man in dieser Stufe schon bauen kann (Katalog der Services)
    const kann = Object.keys(bauten).filter((id) => {
      const k = game.services?.katalog?.find?.((x) => x.id === id);
      return !k || (k.abStufe ?? 1) <= (s?.stage ?? 1);
    });
    return kann.length ? `Mit ${serviceName(kann[0])}: ${bauten[kann[0]].text.split(': ').pop()}.` : '';
  }

  // ------------------------------------------------------------ Was kann man gerade vorbereiten?
  // { art: 'sturm' | 'regatta', plan, erledigt, text, knopf, zurueck? } oder null
  function angebot() {
    const s = st();
    if (!s) return null;
    const p = geplant();
    if (p?.id === 'sturm' && s.stage >= 3 && V.hatOffenePlaetze(s, ctx)) {
      const v = s.modules?.vorbereitung?.sturm;
      const klar = !!(v?.klar && v.startDay === p.startDay);
      const liste = V.draussen(s, ctx);
      const n = liste.length;
      const wann = p.startDay - s.day <= 1 ? 'Morgen' : 'Bald';
      if (klar) {
        const weg = liste.filter((b) => b.trip?.away).length;
        const voll = n - weg;
        const teile = [];
        if (voll > 0) teile.push(`${voll === 1 ? 'Ein Gast bleibt' : `${voll} Gäste bleiben`} draußen: innen ist nichts Passendes frei.`);
        if (weg > 0) teile.push(`${weg === 1 ? 'Ein Gast ist' : `${weg} Gäste sind`} auf Tagestörn.`);
        return { art: 'sturm', plan: p, erledigt: true, titel: 'Hafen ist sturmklar',
          text: teile.length ? teile.join(' ') : 'Offene Plätze bleiben bis nach dem Sturm leer.',
          knopf: voll > 0 && liste.some((b) => !b.trip?.away && V.innenZiel(s, ctx, b.id)) ? 'Noch einmal verholen' : null, zurueck: 'Offene Plätze freigeben' };
      }
      return { art: 'sturm', plan: p, erledigt: false, titel: `${wann} Sturm`,
        text: n > 0
          ? `${n === 1 ? 'Ein Gast liegt' : `${n} Gäste liegen`} offen am Stegkopf. Nach innen verholen?`
          : 'Offene Plätze am Stegkopf bis nach dem Sturm sperren?',
        knopf: 'Sturmklar machen' };
    }
    const r = p?.id === 'regatta' ? p : (laufend()?.id === 'regatta' ? laufend() : null);
    const g = geplantGross()?.id === 'hansewoche' ? geplantGross() : (laufend()?.id === 'hansewoche' ? laufend() : null);
    if (!r && g && s.stage >= 5) {
      // Hanse-Woche: lange vorher angekündigt; große Plätze freihalten erst ab zwei Tagen vorher
      const v = s.modules?.vorbereitung?.hansewoche;
      const haben = v && v.startDay === g.startDay ? v.plaetze.length : 0;
      const n = V.freihaltenAnzahl('hansewoche', s.stage);
      const tage = g.startDay - s.day;
      if (haben > 0) {
        const mehr = haben < n && V.freihaltenKandidaten('hansewoche', s, ctx).length > 0;
        return { art: 'hansewoche', plan: g, erledigt: true, titel: `${haben} große ${haben === 1 ? 'Platz' : 'Plätze'} freigehalten`,
          text: 'Ab dem Start nur für große Schiffe, jedes zahlt Festgeld.',
          knopf: mehr ? 'Mehr freihalten' : null, zurueck: 'Plätze freigeben' };
      }
      const wann = tage <= 0 ? 'Heute' : tage === 1 ? 'Morgen' : tage === 2 ? 'Übermorgen' : `In ${tage} Tagen`;
      if (tage > 2) {
        return { art: 'hansewoche', plan: g, erledigt: false, nurInfo: true, titel: `${wann}: Hanse-Woche`,
          text: 'Vier Tage Fest mit Traditionsseglern. Zwei Tage vorher große Plätze freihalten.' };
      }
      if (n <= 0) return null;
      if (!V.freihaltenKandidaten('hansewoche', s, ctx).length) {
        return { art: 'hansewoche', plan: g, erledigt: false, nurInfo: true, titel: `${wann}: Hanse-Woche`,
          text: 'Alle großen Plätze sind belegt. Wird einer frei, kannst du ihn im Wetterbericht freihalten.' };
      }
      return { art: 'hansewoche', plan: g, erledigt: false, titel: `${wann}: Hanse-Woche`,
        text: `${n} große Plätze freihalten? Jedes große Schiff darauf zahlt Festgeld.`,
        knopf: 'Plätze freihalten' };
    }
    if (r && s.stage >= 3) {
      const v = s.modules?.vorbereitung?.regatta;
      const haben = v && v.startDay === r.startDay ? v.plaetze.length : 0;
      const n = V.regattaAnzahl(s.stage);
      if (haben > 0) {
        const mehr = haben < n && V.regattaKandidaten(s, ctx).length > 0;
        return { art: 'regatta', plan: r, erledigt: true, titel: `${haben} ${haben === 1 ? 'Platz' : 'Plätze'} freigehalten`,
          text: 'Ab dem Start nur für Segelboote, jedes zahlt Startgeld.',
          knopf: mehr ? 'Mehr freihalten' : null, zurueck: 'Plätze freigeben' };
      }
      const tage = r.startDay - s.day;
      const wann = tage <= 0 ? 'Heute' : tage === 1 ? 'Morgen' : 'Übermorgen';
      if (!V.regattaKandidaten(s, ctx).length) {
        return { art: 'regatta', plan: r, erledigt: false, nurInfo: true, titel: `${wann} Regatta`,
          text: 'Alle Plätze für Segler sind belegt. Wird einer frei, kannst du ihn im Wetterbericht freihalten.' };
      }
      return { art: 'regatta', plan: r, erledigt: false, titel: `${wann} Regatta`,
        text: `${n} Plätze für Segler freihalten? Jedes Regattaboot darauf zahlt Startgeld.`,
        knopf: 'Plätze freihalten' };
    }
    return null;
  }

  function handle(art, zurueck = false) {
    const s = st();
    const a = angebot();
    if (!s || !a || a.art !== art) return;
    let r;
    if (a.nurInfo) return;
    if (art === 'sturm') r = zurueck ? V.sturmklarAufheben(s) : V.sturmklar(s, ctx, a.plan);
    else r = zurueck ? V.freigeben(art, s) : V.freihalten(art, s, ctx, a.plan);
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
  // Gemeinsamer Meldeplatz (ui/meldungen.js), sobald es ihn gibt: er übernimmt Lage und Breite
  game.meldungen?.anmelden?.('#ev-vorbereiten', 'ereignis');

  // Die Karte geht nach einer Weile von selbst. Wartet sie hinter einer wichtigeren Meldung, steht ihre Uhr.
  let timer = 0;
  let bisSchluss = 0;       // echte Zeit (ms), wann die Karte von selbst geht (solange die Uhr läuft)
  let rest = 0;             // verbleibende Zeit (ms), solange die Uhr steht
  let gezeigt = null;       // 'angebot' | 'ergebnis'

  let danach = null;         // Karte, die wartet, bis die stehende geht (Nachspiel, dann Ankündigung)
  function schliesse() {
    karte.hidden = true;
    gezeigt = null;
    if (danach) { const f = danach; danach = null; setTimeout(f, 0); }
    clearTimeout(timer);
    timer = 0;
    clearInterval(nachsehen);
    nachsehen = 0;
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

  let kartenTitel = null;
  let kartenText = null;
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
    kartenTitel = t;
    kartenText = p;
    karte.append(kopf);
    if (knoepfe.length) {
      const reihe = document.createElement('div');
      reihe.className = 'evv-knoepfe';
      reihe.append(...knoepfe);
      karte.append(reihe);
    }
  }

  // Welche Ankündigung gerade steht (Meldeplatz: immer nur eine; die Ordnung entscheidet ui/meldungen.js)
  let gezeigtTag = null;     // Spieltag, an dem die Karte kam
  function zeige(sekunden) {
    gezeigtTag = st()?.day ?? null;
    clearTimeout(timer);
    timer = 0;
    rest = sekunden * 1000;
    karte.hidden = false;
    game.meldungen?.wunsch('ereignis', VORRANG.ereignis);
    ordne();
  }

  const SYMBOL = { sturm: 'sturm', regatta: 'regatta', hansewoche: 'kogge', mittsommer: 'feuer', heringstage: 'fisch', holzboote: 'holzboot', hafenfest: 'fest' };
  function zeigeAngebot() {
    const a = angebot();
    if (!a) return false;
    const knoepfe = [];
    if (a.knopf) knoepfe.push(knopf(a.knopf, true, () => { handle(a.art); zeigeAngebotNach(); }));
    knoepfe.push(knopf(a.erledigt || a.nurInfo ? 'Gut' : 'Später', false, schliesse));
    fuelle(SYMBOL[a.art], a.titel, a.text, knoepfe);
    gezeigt = 'angebot';
    zeige(STEHT_SEKUNDEN);
    return true;
  }
  // Nach dem Knopf: kurz den neuen Stand zeigen
  function zeigeAngebotNach() {
    const a = angebot();
    if (!a) { schliesse(); return; }
    fuelle(SYMBOL[a.art], a.titel, a.text, [knopf('Gut', false, schliesse)]);
    zeige(5);
  }

  // Ankündigung eines Ereignisses mit Bauten (G7): was die eigenen Bauten daraus machen
  function zeigeBauAnkuendigung(event, startDay) {
    const zeile = bauZeile(event.id);
    if (!zeile) return false;
    const s = st();
    const tage = startDay - (s?.day ?? startDay);
    const wann = tage <= 0 ? 'Heute' : tage === 1 ? 'Morgen' : tage === 2 ? 'Übermorgen' : `In ${tage} Tagen`;
    fuelle(SYMBOL[event.id] ?? 'fest', `${wann}: ${event.title}`, zeile, [knopf('Gut', false, schliesse)]);
    gezeigt = 'angebot';
    zeige(10);
    return true;
  }

  // Nachspiel (G3): am Morgen nach dem Ereignis
  function zeigeNachspiel(event) {
    const n = event?.nachspiel;
    if (!n?.title) return;
    const bonus = n.modsVorbereitet && st()?.modules?.vorbereitung?.nachspiel?.[event.id] != null;
    const text = bonus ? `${n.text} Gut vorbereitet: Gäste bewerten besser.` : n.text;
    fuelle(SYMBOL[event.id] ?? 'fest', n.title, text, [knopf('Gut', false, schliesse)]);
    gezeigt = 'nachspiel';
    zeige(8);
  }

  function zeigeErgebnis(e) {
    const t = V.ergebnisText(e, serviceName);
    fuelle(t.symbol, t.titel, t.text, [knopf('Gut', false, schliesse)]);
    gezeigt = 'ergebnis';
    zeige(ERGEBNIS_SEKUNDEN);
  }

  // Platz der Karte: oben rechts neben der linken Spalte (Wetter, Tagesziel, Ausbau), auf dem PC mittig.
  // Reicht der Platz daneben nicht (Handy hochkant), steht sie unten über Zeit und Bauen, in
  // Daumenreichweite. Liegt sie auch dort über der linken Spalte (zum Beispiel eine aufgeklappte
  // Tafel), wartet sie. Gibt true zurück, wenn die Karte frei steht.
  const rechteck = (e) => e.getBoundingClientRect();
  const sichtbar = (e) => !e.hidden && !e.closest('[hidden]') && getComputedStyle(e).display !== 'none' && rechteck(e).width > 0;
  const ueber = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  function platziere() {
    const h = host.getBoundingClientRect();
    const seite = [...document.querySelectorAll('#hm-seite > *')].filter(sichtbar).map(rechteck);
    const rechts = Math.max(h.left, ...seite.map((r) => r.right)) - h.left;
    const rand = 12;
    const mitte = (h.width - Math.min(420, h.width - 32)) / 2;
    const links = Math.max(mitte, rechts + rand);
    const breit = Math.min(420, h.width - links - 16);
    if (breit >= 260) {
      Object.assign(karte.style, { left: `${Math.round(links)}px`, width: `${Math.round(breit)}px`, transform: 'none', top: '', bottom: '' });
    } else {
      const unten = [...document.querySelectorAll('#hm-zeit, #btn-build, #hud-bottom')].filter(sichtbar).map((e) => rechteck(e).top);
      const grenze = unten.length ? Math.min(...unten) : h.bottom - 16;
      Object.assign(karte.style, { left: '', width: '', transform: '', top: 'auto', bottom: `${Math.round(h.bottom - grenze + 10)}px` });
    }
    const k = rechteck(karte);
    const hinder = [...seite, ...[...document.querySelectorAll('#hm-zeit, #btn-collect, #btn-build')].filter(sichtbar).map(rechteck)];
    return !hinder.some((r) => ueber(k, r)) && k.top >= h.top;
  }

  // Meldungs-Ordnung: steht etwas Wichtigeres, wartet die Karte ausgeblendet (ihre Uhr steht).
  // Ebenso, solange kein freier Platz da ist.
  let nachsehen = 0;
  function ordne() {
    if (karte.hidden) { clearInterval(nachsehen); nachsehen = 0; return; }
    // Zahlen auf der Karte live halten (zum Beispiel: inzwischen liegt ein dritter Gast offen)
    if (gezeigt === 'angebot' && kartenTitel) {
      const a = angebot();
      if (a && a.titel && a.text) {
        if (kartenTitel.textContent !== a.titel) kartenTitel.textContent = a.titel;
        if (kartenText.textContent !== a.text) kartenText.textContent = a.text;
      }
    }
    karte.classList.remove('zurueck');
    const frei = game.meldungen?.imPlatz?.(karte) ? true : platziere();
    const darf = game.meldungen ? game.meldungen.darf('ereignis') : true;
    const zurueck = !darf || !frei || document.body.classList.contains('card-open');
    karte.classList.toggle('zurueck', zurueck);
    // Die linke Spalte klappt ohne Ereignis auf und zu: solange die Karte steht, regelmäßig nachsehen
    if (!nachsehen) nachsehen = setInterval(ordne, 400);
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
  game.on('resize', ordne);
  new MutationObserver(ordne).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  // Ankündigung: Karte mit Knopf statt des Ereignisschilds
  game.vorbereitung = {
    angebot,
    handle,
    /** banner.js fragt: übernimmt die Karte diese Ankündigung? */
    uebernimmt: (event) => {
      const a = angebot();
      return (!!a && a.art === event?.id) || !!bauZeile(event?.id);
    },
    bauZeile,
  };
  game.on('event:announce', ({ event, startDay }) => {
    // Erst nach dem Morgen der Spielregeln (Planer und Sim sind dann auf demselben Tag)
    const zeigen = () => {
      if (angebot()?.art === event?.id) zeigeAngebot();
      else zeigeBauAnkuendigung(event, startDay);
    };
    // Steht gerade das Nachspiel, kommt die Ankündigung danach
    setTimeout(() => { if (gezeigt === 'nachspiel' && !karte.hidden) danach = zeigen; else zeigen(); }, 0);
  });
  game.on('event:nachspiel', ({ event }) => setTimeout(() => zeigeNachspiel(event), 0));
  // Hanse-Woche: zwei Tage vorher erinnern (dann kann man Plätze freihalten)
  game.on('sim:dayStart', () => {
    const g = geplantGross();
    const s = st();
    if (g?.id === 'hansewoche' && s && g.startDay - s.day === 2) setTimeout(() => { if (gezeigt !== 'nachspiel') zeigeAngebot(); }, 0);
  });
  // Am Abend vor dem Sturm oder der Regatta noch einmal erinnern, wenn nichts vorbereitet ist
  game.on('sim:evening', () => {
    const a = angebot();
    const s = st();
    if (!a || a.erledigt || !s || a.plan.startDay !== s.day + 1) return;
    if (a.art === 'sturm' && V.draussen(s, ctx).length === 0) return;
    if (a.nurInfo) return;
    zeigeAngebot();
  });
  game.on('sim:ereignisErgebnis', (e) => zeigeErgebnis(e));
  // Neuer Tag: alte Karten (auch das Ergebnis vom Vorabend, falls es noch wartet) gehen
  game.on('sim:dayStart', () => { if (gezeigt && gezeigtTag !== st()?.day) schliesse(); });
  game.on('spielstand-geladen', () => { danach = null; schliesse(); });
  game.on('foto', () => { danach = null; schliesse(); });

  // Wetterbericht: Knopf unter dem Ereignis (banner.js ruft zeile(entry) auf)
  game.vorbereitung.zeile = (entry) => {
    const a = angebot();
    const bau = entry?.event ? bauZeile(entry.event.id) : '';
    const passt = a && entry?.event && entry.event.id === a.art && entry.day === a.plan.startDay;
    if (!passt && !bau) return null;
    const box = document.createElement('div');
    box.className = 'evv-zeile';
    if (bau) { const b = document.createElement('small'); b.textContent = bau; box.append(b); }
    if (!passt) return box;
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
    @media (max-width: 599px) {
      #ev-vorbereiten { padding: 8px 10px; }
      #ev-vorbereiten .evv-knoepfe { padding-left: 0; margin-top: 6px; }
      #ev-vorbereiten .evv-knoepfe .hm-knopf { min-height: 44px; font-size: var(--hm-s, 16px); }
    }
    #weather-panel .evv-zeile { grid-column: 1 / -1; padding: 2px 4px 8px; text-align: left; }
    #weather-panel .evv-zeile small { display: block; }
    #weather-panel .evv-zeile .hm-knopf { min-height: 44px; }
    /* Steht die Karte, ruht "Als Nächstes" (ui/bauen.js) */
    .hm-neu:has(#ev-vorbereiten:not([hidden]):not(.zurueck)) .bau-tipp { display: none; }
  `;
  document.head.appendChild(stil);
}
