// Ankündigungen und Wetterbericht.
// - Ein Schild unter der oberen Leiste kündigt Ereignisse an und verschwindet nach ein paar Sekunden.
// - Der kleine Wetterknopf zeigt das Wetter von heute; Antippen klappt den Bericht für 3 Tage auf.

const SVG = 'http://www.w3.org/2000/svg';

// Einfache, flache Symbole (keine Emojis), 24 x 24
const ICONS = {
  sonne: '<circle cx="12" cy="12" r="5" fill="#f6c343"/><g stroke="#f6c343" stroke-width="2" stroke-linecap="round"><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></g>',
  wolke: '<path d="M7 18h10a4 4 0 0 0 0-8 5 5 0 0 0-9.6-1.4A3.5 3.5 0 0 0 7 18z" fill="#c9d4dc"/>',
  nebel: '<g stroke="#9fb0bc" stroke-width="2.2" stroke-linecap="round"><path d="M3 8h14M6 12h15M3 16h13M8 20h10"/></g>',
  sturm: '<path d="M6 14h11a4 4 0 0 0 0-8 5 5 0 0 0-9.6-1.4A3.5 3.5 0 0 0 6 14z" fill="#7d8b99"/><path d="M12 13l-3 5h3l-2 5 6-7h-3l2-3z" fill="#f6c343"/>',
  regatta: '<path d="M11 3v15" stroke="#283648" stroke-width="1.6"/><path d="M11 4l7 11h-7z" fill="#fffcf6" stroke="#283648" stroke-width="1"/><path d="M10 6l-5 9h5z" fill="#ee6454"/><path d="M3 19h17l-2 2H5z" fill="#3b6f8f"/>',
  fest: '<path d="M3 6l18 0" stroke="#283648" stroke-width="1"/><path d="M4 6l2 4 2-4zM9 6l2 4 2-4zM14 6l2 4 2-4z" fill="#ee6454"/><circle cx="8" cy="17" r="2" fill="#f6c343"/><circle cx="16" cy="16" r="2.5" fill="#62b4c2"/><path d="M12 13v8M8.5 19l7-6" stroke="#ee6454" stroke-width="1.2" stroke-linecap="round"/>',
  schiff: '<path d="M3 15h18l-3 5H6z" fill="#fffcf6" stroke="#283648" stroke-width="1"/><rect x="7" y="10" width="10" height="5" fill="#fffcf6" stroke="#283648" stroke-width="1"/><rect x="11" y="6" width="3" height="4" fill="#ee6454"/>',
  schnee: '<g stroke="#8fb8d0" stroke-width="2" stroke-linecap="round"><path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/></g>',
};

const EVENT_ICON = {
  nebel: 'nebel', sommertag: 'sonne', sturm: 'sturm', regatta: 'regatta',
  hafenfest: 'fest', kreuzfahrttag: 'schiff',
};

const PART_NAME = { fruehling: 'Frühling', sommer: 'Sommer', herbst: 'Herbst', winter: 'Winter' };

function iconFor(entry) {
  if (entry.event) return EVENT_ICON[entry.event.id] ?? 'wolke';
  const wx = entry.weather;
  if (wx.snow > 0.5) return 'schnee';
  if (wx.rain > 0.3) return 'wolke';
  return wx.sun > 0.6 ? 'sonne' : 'wolke';
}

function svgIcon(name) {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '24');
  svg.setAttribute('height', '24');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = ICONS[name] ?? ICONS.wolke;
  return svg;
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

  let hideTimer = 0;
  function show(iconName, title, text, seconds = 7) {
    banner.replaceChildren();
    banner.append(svgIcon(iconName));
    const body = document.createElement('div');
    const t = document.createElement('strong');
    t.textContent = title;
    const p = document.createElement('span');
    p.textContent = text;
    body.append(t, p);
    banner.append(body);
    // Schild und Wetterbericht nie gleichzeitig: das neue Schild klappt den Bericht zu
    if (!panel.hidden) toggle(false);
    banner.hidden = false;
    banner.classList.remove('leaving');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      banner.classList.add('leaving');
      setTimeout(() => { banner.hidden = true; }, 400);
    }, seconds * 1000);
  }
  banner.addEventListener('click', () => { banner.hidden = true; });

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
    if (fc[0].event) label.textContent = fc[0].event.title;
    else if (next) label.textContent = `${dayLabel(next.day - fc[0].day)}: ${next.event.title}`;
    else label.textContent = PART_NAME[fc[0].season.part] ?? '';
    chip.append(label);
    chip.classList.toggle('has-news', !!next || !!fc[0].event);
  }

  function renderPanel() {
    const fc = game.events?.forecast(3) ?? [];
    panel.replaceChildren();
    const head = document.createElement('div');
    head.className = 'wp-head';
    const s = fc[0]?.season;
    head.textContent = s ? (s.winter ? `Winter, Jahr ${s.year}` : `${PART_NAME[s.part]}, Tag ${s.seasonDay} von 30, Jahr ${s.year}`) : '';
    panel.append(head);
    fc.forEach((e, i) => {
      const row = document.createElement('div');
      row.className = 'wp-row' + (e.event ? ' event' : '');
      row.append(svgIcon(iconFor(e)));
      const txt = document.createElement('div');
      const t = document.createElement('strong');
      t.textContent = `${dayLabel(i)}: ${e.event ? e.event.title : (e.season.winter ? 'Winterruhe' : wxText(e.weather))}`;
      txt.append(t);
      if (e.event) {
        const p = document.createElement('span');
        p.textContent = e.event.text;
        txt.append(p);
      }
      row.append(txt);
      panel.append(row);
    });
  }

  function wxText(wx) {
    if (wx.rain > 0.3) return 'Schauer';
    if (wx.wind > 0.5) return 'frischer Wind';
    if (wx.sun > 0.75) return 'sonnig';
    return 'heiter bis wolkig';
  }

  function toggle(open = panel.hidden) {
    panel.hidden = !open;
    chip.setAttribute('aria-expanded', String(open));
    if (open) {
      // Bericht geöffnet: Ankündigung ausblenden, ihr Inhalt steht im Bericht
      clearTimeout(hideTimer);
      banner.hidden = true;
      renderPanel();
    }
  }
  chip.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
  panel.addEventListener('click', () => toggle(false));
  game.on('tap', () => { if (!panel.hidden) toggle(false); });

  const refresh = () => { renderChip(); if (!panel.hidden) renderPanel(); };
  game.on('weather', refresh);
  game.on('event:loaded', refresh);

  game.on('event:announce', ({ event, startDay, day }) => {
    show(EVENT_ICON[event.id] ?? 'wolke', event.teaser ?? `${dayLabel(startDay - day)}: ${event.title}`, event.text);
    chip.classList.remove('pulse'); void chip.offsetWidth; chip.classList.add('pulse');
  });
  game.on('event:start', ({ event }) => {
    show(EVENT_ICON[event.id] ?? 'wolke', `Heute: ${event.title}`, event.text, 5);
  });
  game.on('season', (s) => {
    if (s.part === 'winter') show('schnee', 'Winter', 'Die Boote gehen ins Winterlager. Keine Gäste, Zeit zum Bauen und Planen.', 6);
    else if (s.part === 'fruehling' && s.year > 1) show('sonne', `Saison ${s.year} beginnt`, 'Die ersten Boote kommen aus dem Winterlager.', 6);
  });
}
