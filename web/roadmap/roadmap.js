// Roadmap-Seite: liest daten.json (erzeugt von tools/roadmap.mjs aus docs/roadmap.md)
// und zeigt Pakete und Einzelpunkte mit Filter nach Welle, Status und Suche.
// Zustand steht in der Adresse (#welle=2&status=offen&q=winter&paket=P14&ansicht=punkte),
// damit Links aus der README direkt die richtige Stelle öffnen.
// Kein innerHTML mit Daten: alle Texte gehen über textContent.

const GRUPPEN = {
  alle: { name: 'Alle', status: null },
  offen: { name: 'Offen', status: ['offen', 'frage'] },
  angefangen: { name: 'Angefangen', status: ['teilweise', 'arbeit'] },
  erledigt: { name: 'Erledigt', status: ['erledigt', 'entfaellt'] },
};
const BALKEN = ['erledigt', 'teilweise', 'arbeit', 'frage', 'entfaellt'];

let D = null;
const zustand = { welle: null, status: 'alle', q: '', paket: null, ansicht: 'pakete' };

function h(tag, attrs = {}, ...kinder) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style') el.setAttribute('style', v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kind of kinder.flat()) {
    if (kind === null || kind === undefined || kind === false) continue;
    el.append(kind instanceof Node ? kind : document.createTextNode(String(kind)));
  }
  return el;
}

// Suchtreffer hervorheben, ohne HTML zu bauen
function markiert(text, q) {
  if (!q) return [text];
  const teile = [];
  const klein = text.toLowerCase();
  let pos = 0;
  for (;;) {
    const i = klein.indexOf(q, pos);
    if (i < 0) break;
    if (i > pos) teile.push(text.slice(pos, i));
    teile.push(h('mark', { text: text.slice(i, i + q.length) }));
    pos = i + q.length;
  }
  teile.push(text.slice(pos));
  return teile;
}

function marke(status) {
  if (!status) return h('span', { class: 'marke leer', text: 'ohne Angabe' });
  return h('span', { class: `marke ${status}`, text: D.status[status].name });
}

function balken(z, klasse) {
  const el = h('div', { class: klasse, role: 'img' });
  const basis = z.alle || 1;
  for (const k of BALKEN) {
    if (!z[k]) continue;
    el.append(h('i', { style: `width:${(z[k] / basis) * 100}%;background:${D.status[k].farbe}`, title: `${D.status[k].name}: ${z[k]}` }));
  }
  el.setAttribute('aria-label', `${z.erledigt} von ${z.alle} erledigt`);
  return el;
}

function welleName(w) {
  return w.nr === 99 ? w.titel : `Welle ${w.nr}`;
}

// ---------- Adresse ----------

function ausAdresse() {
  const p = new URLSearchParams(location.hash.slice(1));
  zustand.welle = p.has('welle') ? Number(p.get('welle')) : null;
  zustand.status = GRUPPEN[p.get('status')] ? p.get('status') : 'alle';
  zustand.q = p.get('q') || '';
  zustand.paket = p.get('paket');
  zustand.ansicht = p.get('ansicht') === 'punkte' ? 'punkte' : 'pakete';
  if (zustand.paket) {
    const pk = D.pakete.find((x) => x.id === zustand.paket);
    if (pk) zustand.welle = null;
  }
}

function inAdresse() {
  const p = new URLSearchParams();
  if (zustand.welle !== null) p.set('welle', zustand.welle);
  if (zustand.status !== 'alle') p.set('status', zustand.status);
  if (zustand.q) p.set('q', zustand.q);
  if (zustand.paket) p.set('paket', zustand.paket);
  if (zustand.ansicht !== 'pakete') p.set('ansicht', zustand.ansicht);
  const neu = p.toString();
  history.replaceState(null, '', neu ? `#${neu}` : location.pathname + location.search);
}

// ---------- Kopf ----------

function kopf() {
  const g = D.gesamt;
  const zaehlbar = g.alle - g.entfaellt;
  document.getElementById('stand').textContent =
    `${g.erledigt} von ${zaehlbar} Paketen erledigt, ${g.teilweise + g.arbeit} angefangen, ${g.offen + g.frage} offen` +
    (D.stand.datum ? `. Stand der Roadmap: ${D.stand.datum}` : '') + '.';
  document.getElementById('gesamt').replaceWith(Object.assign(balken(g, 'gesamt'), { id: 'gesamt' }));
  document.getElementById('quelle').href = D.quelle;

  const leg = document.getElementById('legende');
  leg.replaceChildren();
  for (const k of ['erledigt', 'teilweise', 'arbeit', 'offen', 'entfaellt']) {
    if (!g[k] && k !== 'offen') continue;
    leg.append(h('span', {}, h('i', { class: 'punkt', style: k === 'offen' ? 'background:var(--mulde);box-shadow:inset 0 0 0 1px var(--grau)' : `background:${D.status[k].farbe}` }), `${D.status[k].name} `, h('b', { text: g[k] })));
  }
}

function wellen() {
  const box = document.getElementById('wellen');
  box.replaceChildren();
  for (const w of D.wellen) {
    const z = w.zaehler;
    box.append(h('button', {
      type: 'button',
      class: `welle kasten${zustand.welle === w.nr ? ' an' : ''}`,
      'aria-pressed': zustand.welle === w.nr ? 'true' : 'false',
      onclick: () => {
        zustand.welle = zustand.welle === w.nr ? null : w.nr;
        zustand.paket = null;
        neu();
      },
    },
    h('div', { class: 'welle-nr' }, h('span', { text: welleName(w) }), h('span', { text: `${z.erledigt}/${z.alle - z.entfaellt}` })),
    h('div', { class: 'welle-titel', text: w.titel }),
    balken(z, 'mini')));
  }
}

function chips() {
  const box = document.getElementById('chips');
  box.replaceChildren();
  for (const [k, g] of Object.entries(GRUPPEN)) {
    const farbe = k === 'offen' ? D.status.offen.farbe : k === 'angefangen' ? D.status.teilweise.farbe : k === 'erledigt' ? D.status.erledigt.farbe : null;
    box.append(h('button', {
      type: 'button',
      class: zustand.status === k ? 'an' : '',
      'aria-pressed': zustand.status === k ? 'true' : 'false',
      onclick: () => { zustand.status = k; zustand.paket = null; neu(); },
    }, farbe ? h('i', { class: 'punkt', style: `background:${farbe}` }) : null, g.name));
  }
  document.querySelectorAll('.schalter button').forEach((b) => {
    b.classList.toggle('an', b.dataset.ansicht === zustand.ansicht);
    b.setAttribute('aria-selected', b.dataset.ansicht === zustand.ansicht ? 'true' : 'false');
  });
}

// ---------- Filter ----------

function passtStatus(status) {
  const g = GRUPPEN[zustand.status].status;
  return !g || g.includes(status || 'offen');
}

function passtSuche(...texte) {
  const q = zustand.q.trim().toLowerCase();
  if (!q) return true;
  return texte.some((t) => (t || '').toLowerCase().includes(q));
}

// ---------- Bilder und Neuigkeiten ----------

function bildKachel(b, mitPaket) {
  if (!b) return null;
  const unter = [mitPaket ? b.pakete.join(', ') : null, b.titel, b.pr ? `PR ${b.pr}` : null].filter(Boolean).join(' · ');
  return h('figure', { class: `bild ${b.geraet === 'handy' ? 'hoch' : ''}` },
    h('button', { type: 'button', class: 'bild-knopf', 'aria-label': `${b.titel || 'Bild'} groß zeigen`, onclick: () => gross(b, unter) },
      h('img', { src: `bilder/${b.datei}`, alt: b.titel || '', loading: 'lazy', decoding: 'async' })),
    h('figcaption', {},
      mitPaket && b.pakete[0] ? h('button', { type: 'button', class: 'paket-link', text: b.pakete.join(', '), onclick: () => zuPaket(b.pakete[0]) }) : null,
      ' ', [b.titel, b.pr ? `PR ${b.pr}` : null].filter(Boolean).join(' · ')));
}

function gross(b, text) {
  const dlg = document.getElementById('gross');
  document.getElementById('gross-bild').src = `bilder/${b.datei}`;
  document.getElementById('gross-bild').alt = b.titel || '';
  document.getElementById('gross-text').textContent = text;
  if (dlg.showModal) dlg.showModal(); else window.open(`bilder/${b.datei}`, '_blank', 'noopener');
}

function neuigkeiten() {
  const box = document.getElementById('neu');
  box.replaceChildren();
  const bilder = (D.neueBilder || []).map((nr) => D.bilder[nr]).filter(Boolean);
  const merges = (D.merges || []).slice(0, 8);
  if (!bilder.length && !merges.length) return;
  const kopf = h('h2', { class: 'gruppe-titel', text: 'Zuletzt im Spiel' });
  const leiste = bilder.length ? h('div', { class: 'leiste' }, bilder.map((b) => bildKachel(b, true))) : null;
  const liste = merges.length ? h('details', { class: 'merges kasten' },
    h('summary', {}, h('span', { text: `Letzte ${merges.length} Merges` })),
    h('ul', {}, merges.map((m) => h('li', {},
      h('span', { class: 'datum', text: m.datum.split('-').reverse().join('.') }),
      h('a', { href: `${D.repo}/pull/${m.pr}`, target: '_blank', rel: 'noopener', text: `#${m.pr}` }),
      h('span', { text: m.titel }),
      m.pakete.length ? h('span', { class: 'neben' }, m.pakete.map((id) => h('button', { type: 'button', class: 'paket-link', text: id, onclick: () => zuPaket(id) }))) : null)))) : null;
  box.append(kopf, leiste, liste);
}

// ---------- Pakete ----------

function paketKarte(p, q) {
  const punkte = D.punkte.filter((x) => x.pakete.includes(p.id));
  const welle = D.wellen.find((w) => w.pakete.includes(p.id));
  const det = h('details', { class: 'paket kasten', id: `paket-${p.id}`, open: zustand.paket === p.id },
    h('summary', {},
      h('span', { class: 'paket-id' }, ...markiert(p.id, q)),
      h('span', { class: 'paket-titel' }, ...markiert(p.titel, q)),
      marke(p.status),
      h('span', { class: 'paket-unter', text: `${welle ? welleName(welle) : ''}${punkte.length ? ` · ${punkte.length} ${punkte.length === 1 ? 'Punkt' : 'Punkte'}` : ''}${p.prs.length ? ` · ${p.prs.length} PR` : ''}${p.bilder && p.bilder.length ? ` · ${p.bilder.length} ${p.bilder.length === 1 ? 'Bild' : 'Bilder'}` : ''}` })),
    h('div', { class: 'paket-inhalt' },
      p.inhalt ? h('div', { class: 'zeile' }, h('span', { text: 'Inhalt' }), h('span', {}, ...markiert(p.inhalt, q))) : null,
      p.thread ? h('div', { class: 'zeile' }, h('span', { text: 'Thread, Stand' }), h('span', {}, ...markiert(p.thread, q))) : null,
      p.prs.length ? h('div', { class: 'zeile' }, h('span', { text: 'Pull Requests' }),
        h('span', { class: 'prs' }, p.prs.map((n) => h('a', { href: `${D.repo}/pull/${n}`, target: '_blank', rel: 'noopener', text: `#${n}` })))) : null,
      p.bilder && p.bilder.length ? h('div', { class: 'bilder' }, p.bilder.map((nr) => bildKachel(D.bilder[nr], false))) : null,
      punkte.length ? h('div', {}, h('ul', { class: 'punkte' }, punkte.map((x) => punktZeile(x, q, p.id)))) : null));
  det.addEventListener('toggle', () => {
    if (det.open) zustand.paket = p.id;
    else if (zustand.paket === p.id) zustand.paket = null;
    inAdresse();
  });
  return det;
}

function punktZeile(x, q, ohnePaket) {
  const andere = x.pakete.filter((id) => id !== ohnePaket);
  return h('li', {},
    h('span', { class: 'code' }, ...markiert(x.code, q)),
    h('span', { class: 'txt' }, ...markiert(x.text, q)),
    marke(x.status),
    (x.statusText && x.statusText.toLowerCase() !== 'offen' && x.statusText.toLowerCase() !== 'erledigt') || andere.length
      ? h('span', { class: 'neben' },
        andere.length ? andere.map((id) => h('button', { type: 'button', class: 'paket-link', text: id, onclick: () => zuPaket(id) })) : null,
        x.statusText && !['offen', 'erledigt'].includes(x.statusText.toLowerCase()) ? x.statusText : null)
      : null);
}

function zuPaket(id) {
  zustand.ansicht = 'pakete';
  zustand.paket = id;
  zustand.welle = null;
  zustand.status = 'alle';
  zustand.q = '';
  document.getElementById('suche').value = '';
  neu(true);
}

function liste(scroll) {
  const box = document.getElementById('liste');
  const info = document.getElementById('treffer');
  box.replaceChildren();
  const q = zustand.q.trim().toLowerCase();

  if (zustand.ansicht === 'pakete') {
    let anzahl = 0;
    for (const w of D.wellen) {
      if (zustand.welle !== null && zustand.welle !== w.nr) continue;
      const pakete = w.pakete.map((id) => D.pakete.find((p) => p.id === id)).filter((p) => {
        if (!passtStatus(p.status)) return false;
        const pt = D.punkte.filter((x) => x.pakete.includes(p.id));
        return passtSuche(p.id, p.titel, p.inhalt, p.thread, ...pt.map((x) => `${x.code} ${x.text}`));
      });
      if (!pakete.length) continue;
      anzahl += pakete.length;
      box.append(h('h2', { class: 'gruppe-titel', text: `${welleName(w)}${w.titel ? ': ' + w.titel : ''}` }));
      for (const p of pakete) box.append(paketKarte(p, q));
    }
    info.textContent = `${anzahl} ${anzahl === 1 ? 'Paket' : 'Pakete'}`;
    if (!anzahl) box.append(h('p', { class: 'leer-hinweis', text: 'Keine Pakete für diese Auswahl.' }));
  } else {
    const gruppen = new Map();
    for (const x of D.punkte) {
      if (!passtStatus(x.status)) continue;
      if (zustand.welle !== null && !x.pakete.some((id) => D.pakete.find((p) => p.id === id)?.welle === zustand.welle)) continue;
      if (!passtSuche(x.code, x.text, x.statusText, x.pakete.join(' '))) continue;
      if (!gruppen.has(x.abschnitt)) gruppen.set(x.abschnitt, []);
      gruppen.get(x.abschnitt).push(x);
    }
    let anzahl = 0;
    for (const [titel, punkte] of gruppen) {
      anzahl += punkte.length;
      box.append(h('h2', { class: 'gruppe-titel', text: titel }));
      box.append(h('div', { class: 'kasten', style: 'padding:8px' }, h('ul', { class: 'punkte' }, punkte.map((x) => punktZeile(x, q, null)))));
    }
    info.textContent = `${anzahl} ${anzahl === 1 ? 'Punkt' : 'Punkte'}`;
    if (!anzahl) box.append(h('p', { class: 'leer-hinweis', text: 'Keine Punkte für diese Auswahl.' }));
  }

  if (scroll && zustand.paket) {
    const el = document.getElementById(`paket-${zustand.paket}`);
    if (el) requestAnimationFrame(() => el.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  }
}

function neu(scroll = false) {
  inAdresse();
  wellen();
  chips();
  liste(scroll);
}

// ---------- Start ----------

async function start() {
  try {
    const antwort = await fetch('daten.json', { cache: 'no-cache' });
    if (!antwort.ok) throw new Error(antwort.status);
    D = await antwort.json();
  } catch (e) {
    document.getElementById('stand').textContent = 'Die Roadmap-Daten konnten nicht geladen werden. Bitte später neu laden.';
    return;
  }
  ausAdresse();
  document.getElementById('suche').value = zustand.q;
  kopf();
  neuigkeiten();
  document.getElementById('gross').addEventListener('click', (e) => { if (e.target.id === 'gross') e.target.close(); });

  let warte = 0;
  document.getElementById('suche').addEventListener('input', (e) => {
    clearTimeout(warte);
    warte = setTimeout(() => { zustand.q = e.target.value; zustand.paket = null; neu(); }, 120);
  });
  document.querySelectorAll('.schalter button').forEach((b) => b.addEventListener('click', () => {
    zustand.ansicht = b.dataset.ansicht;
    neu();
  }));
  window.addEventListener('hashchange', () => { ausAdresse(); neu(true); });
  neu(true);
}

start();
