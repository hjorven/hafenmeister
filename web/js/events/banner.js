// Ankündigungen und Wetterbericht.
// - Ein Schild unter der oberen Leiste kündigt Ereignisse an und verschwindet nach ein paar Sekunden.
// - Der kleine Wetterknopf zeigt das Wetter von heute; Antippen klappt den Bericht für 3 Tage auf.

// Symbole im Pixel-Stil der Oberfläche (ui/pixel-symbole.js), keine Emojis
import { pixelBild } from '../ui/pixel-symbole.js';
import { richtungsName } from '../world/wind.js';
import { ECONOMY } from '../data/economy.js';

const EVENT_ICON = {
  nebel: 'nebel', sommertag: 'sonne', sturm: 'sturm', regatta: 'regatta',
  hafenfest: 'fest', kreuzfahrttag: 'schiff',
  mittsommer: 'feuer', heringstage: 'fisch', holzboote: 'holzboot', hansewoche: 'kogge',
};

const PART_NAME = { fruehling: 'Frühling', sommer: 'Sommer', herbst: 'Herbst', winter: 'Winter' };

function iconFor(entry) {
  if (entry.event) return EVENT_ICON[entry.event.id] ?? 'wolke';
  const wx = entry.weather;
  if (wx.snow > 0.5) return 'schnee';
  if (wx.rain > 0.3) return 'regen';
  if (wx.wind >= (ECONOMY.wind?.stark ?? 0.55)) return 'wind';
  return wx.sun > 0.6 ? 'sonne' : 'wolke';
}

function svgIcon(name) {
  return pixelBild(name, 24);
}

function dayLabel(offset) {
  return ['Heute', 'Morgen', 'Übermorgen'][offset] ?? `In ${offset} Tagen`;
}

export function initBanner(game) {
  const host = document.getElementById('game') ?? document.body;

  // Ankündigungsschild
  const banner = document.createElement('div');
  banner.id = 'event-banner';
  banner.setAttribute('role', 'status');
  banner.setAttribute('aria-live', 'polite');
  banner.hidden = true;
  host.appendChild(banner);

  // Ankündigungen stehen im gemeinsamen Meldeplatz (ui/meldungen.js): immer nur eine Meldung zugleich.
  // Mehrere Ankündigungen warten hier nacheinander; die Zeit einer Ankündigung läuft nur, solange sie steht.
  const ID = 'ankuendigung';
  const schlange = [];
  let steht = null;          // { iconName, title, text, seconds, rest }
  function show(iconName, title, text, seconds = 7) {
    if (steht?.title === title || schlange.some((m) => m.title === title)) return;
    schlange.push({ iconName, title, text, seconds, rest: seconds });
    if (schlange.length > 3) schlange.shift();
    if (!steht) naechste();
  }
  function naechste() {
    steht = schlange.shift() ?? null;
    banner.classList.remove('leaving');
    if (!steht) { banner.hidden = true; game.meldungen?.fertig(ID); return; }
    banner.replaceChildren();
    banner.append(svgIcon(steht.iconName));
    const body = document.createElement('div');
    const t = document.createElement('strong');
    t.textContent = steht.title;
    const p = document.createElement('span');
    p.textContent = steht.text;
    body.append(t, p);
    banner.append(body);
    // Schild und Wetterbericht nie gleichzeitig: das neue Schild klappt den Bericht zu
    if (!panel.hidden) toggle(false);
    banner.hidden = false;
    game.meldungen?.wunsch(ID, game.meldungen.VORRANG?.ankuendigung ?? 55);
  }
  let letzte = performance.now();
  setInterval(() => {
    const jetzt = performance.now();
    const dt = Math.min(1, (jetzt - letzte) / 1000);
    letzte = jetzt;
    if (!steht) return;
    const darf = !game.meldungen || game.meldungen.darf(ID);
    banner.classList.toggle('zurueck', !darf);
    if (!darf || document.hidden) return;
    steht.rest -= dt;
    if (steht.rest <= 0.4) banner.classList.add('leaving');
    if (steht.rest <= 0) naechste();
  }, 200);
  // Antippen: weg, die nächste kommt
  banner.addEventListener('click', () => naechste());

  // Wetterknopf mit aufklappbarem Bericht
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.id = 'weather-chip';
  chip.setAttribute('aria-expanded', 'false');
  chip.setAttribute('aria-label', 'Wetterbericht');
  host.appendChild(chip);

  const panel = document.createElement('div');
  panel.id = 'weather-panel';
  panel.hidden = true;
  host.appendChild(panel);

  function renderChip() {
    const fc = game.events?.forecast(2);
    if (!fc?.length) return;
    chip.replaceChildren(svgIcon(iconFor(fc[0])));
    const next = fc.slice(1).find((e) => e.event);
    const label = document.createElement('span');
    // Großes Ereignis (Hanse-Woche), lange vorher angekündigt: Tage bis dahin
    const gross = game.events?.gross;
    const grossIn = gross ? gross.startDay - fc[0].day : null;
    if (fc[0].event) label.textContent = fc[0].event.title;
    else if (next) label.textContent = `${dayLabel(next.day - fc[0].day)}: ${next.event.title}`;
    else if (gross && grossIn > 0) label.textContent = `${gross.event.title} in ${grossIn} ${grossIn === 1 ? 'Tag' : 'Tagen'}`;
    else label.textContent = PART_NAME[fc[0].season.part] ?? '';
    chip.append(label);
    chip.classList.toggle('has-news', !!next || !!fc[0].event || !!gross);
  }

  function renderPanel() {
    const fc = game.events?.forecast(3) ?? [];
    panel.replaceChildren();
    const head = document.createElement('div');
    head.className = 'wp-head';
    const s = fc[0]?.season;
    head.textContent = s ? (s.winter ? `Winter, Jahr ${s.year}` : `${PART_NAME[s.part]}, Tag ${s.seasonDay} von ${game.sim?.ctx?.rules?.seasonDays ?? 16}, Jahr ${s.year}`) : '';
    panel.append(head);
    fc.forEach((e, i) => {
      const row = document.createElement('div');
      row.className = 'wp-row' + (e.event ? ' event' : '');
      row.append(svgIcon(iconFor(e)));
      const txt = document.createElement('div');
      const t = document.createElement('strong');
      t.textContent = `${dayLabel(i)}: ${e.event ? e.event.title : (e.season.winter ? 'Winterruhe' : wxText(e.weather))}`;
      txt.append(t);
      // Starkwind (P34): was er im Hafen bedeutet
      const windSatz = !e.event && !e.season.winter ? game.wind?.berichtSatz?.(e.weather, e.day) : null;
      if (windSatz) {
        const p = document.createElement('span');
        p.textContent = windSatz;
        txt.append(p);
      }
      if (e.event) {
        const p = document.createElement('span');
        p.textContent = e.event.text;
        txt.append(p);
        // Vorbereiten (events/vorbereiten-ui.js): Sturmklar machen, Plätze für die Regatta freihalten
        const extra = game.vorbereitung?.zeile?.(e);
        if (extra) txt.append(extra);
      }
      row.append(txt);
      panel.append(row);
    });
    // Großes Ereignis weiter in der Zukunft (Hanse-Woche, zehn Tage vorher angekündigt)
    const gross = game.events?.gross;
    const letzter = fc.length ? fc[fc.length - 1].day : 0;
    if (gross?.event && gross.startDay > letzter) {
      const row = document.createElement('div');
      row.className = 'wp-row event';
      row.append(svgIcon(EVENT_ICON[gross.event.id] ?? 'fest'));
      const txt = document.createElement('div');
      const t = document.createElement('strong');
      t.textContent = `In ${gross.startDay - (fc[0]?.day ?? 0)} Tagen: ${gross.event.title}`;
      const p = document.createElement('span');
      p.textContent = gross.event.text;
      txt.append(t, p);
      const extra = game.vorbereitung?.zeile?.({ day: gross.startDay, event: gross.event });
      if (extra) txt.append(extra);
      row.append(txt);
      panel.append(row);
    }
  }

  function wxText(wx) {
    // Windrichtung (P34): ab frischem Wind mit Himmelsrichtung, damit man die Windseite planen kann,
    // auch an Regentagen (sonst stand dort nur „Schauer“ und die Richtung fehlte zum Starkwind-Satz)
    const stark = wx.wind >= (ECONOMY.wind?.stark ?? 0.55);
    if (wx.rain > 0.3) return stark ? `Schauer, Starkwind aus ${richtungsName(wx.richtung ?? 180)}` : 'Schauer';
    if (stark) return `Starkwind aus ${richtungsName(wx.richtung ?? 180)}`;
    if (wx.wind > 0.5) return `frischer Wind aus ${richtungsName(wx.richtung ?? 180)}`;
    if (wx.sun > 0.75) return 'sonnig';
    return 'heiter bis wolkig';
  }

  function toggle(open = panel.hidden) {
    panel.hidden = !open;
    chip.setAttribute('aria-expanded', String(open));
    if (open) {
      // Bericht geöffnet: Ankündigungen ausblenden, ihr Inhalt steht im Bericht
      schlange.length = 0;
      naechste();
      renderPanel();
    }
  }
  chip.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
  panel.addEventListener('click', () => toggle(false));
  game.on('tap', () => { if (!panel.hidden) toggle(false); });

  const refresh = () => { renderChip(); if (!panel.hidden) renderPanel(); };
  game.on('weather', refresh);
  // Für andere Module (Wind P34): Ankündigung im Meldeplatz, gleiche Form wie Ereignisse
  game.banner = { zeige: (icon, titel, text, sek) => show(icon, titel, text, sek) };
  game.on('event:loaded', refresh);

  game.on('event:announce', ({ event, startDay, day }) => {
    // Kann man sich vorbereiten, zeigt events/vorbereiten-ui.js eine Karte mit Knopf an dieser Stelle
    if (game.vorbereitung?.uebernimmt?.(event)) {
      chip.classList.remove('pulse'); void chip.offsetWidth; chip.classList.add('pulse');
      return;
    }
    show(EVENT_ICON[event.id] ?? 'wolke', event.teaser ?? `${dayLabel(startDay - day)}: ${event.title}`, event.text);
    chip.classList.remove('pulse'); void chip.offsetWidth; chip.classList.add('pulse');
  });
  // Krantag (P20 H5): am ersten und letzten Saisontag kranen die Dauerlieger (services/rules.js)
  game.on('services:abrechnung', (r) => {
    const k = r?.krantag;
    if (!k?.boote) return;
    const eins = k.boote === 1;
    const wer = eins ? 'Ein Dauerlieger' : `${k.boote} Dauerlieger`;
    const was = k.art === 'fruehling' ? (eins ? 'ist wieder im Wasser' : 'sind wieder im Wasser') : (eins ? 'geht an Land' : 'gehen an Land');
    show('muenze', 'Krantag', `${wer} ${was}: ${Math.round(k.betrag).toLocaleString('de-DE')} € für Kran und Werft.`, 6);
  });
  game.on('event:start', ({ event }) => {
    show(EVENT_ICON[event.id] ?? 'wolke', `Heute: ${event.title}`, event.text, 5);
  });
  let teilVorher = null;
  game.on('season', (s) => {
    // Jahreszeiten spürbar (P20 G5): Wechsel in Sommer und Herbst kurz ansagen (nicht beim Laden)
    const neu = teilVorher != null && teilVorher !== s.part;
    teilVorher = s.part;
    if (!neu && (s.part === 'sommer' || s.part === 'herbst')) return;
    if (s.part === 'sommer') { show('sonne', 'Hochsaison', 'Sommer: Es kommen mehr Boote, viele kleine. Die Stege werden voll.', 6); return; }
    if (s.part === 'herbst') { show('wolke', 'Herbst', 'Mehr Wind, weniger Boote. Jetzt kommen die letzten Fahrtensegler.', 6); return; }
    // Winterpause und Frühlingsgruß zeigt features/winter.js als eigene Karte
    if (game.winter) return;
    if (s.part === 'winter') show('schnee', 'Winter', 'Die Boote gehen ins Winterlager. Keine Gäste, Zeit zum Bauen und Planen.', 6);
    else if (s.part === 'fruehling' && s.year > 1) show('sonne', `Saison ${s.year} beginnt`, 'Die ersten Boote kommen aus dem Winterlager.', 6);
  });
}
