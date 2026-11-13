// Tagesabschluss: eine kleine Karte am Ende jedes Tages, was der Tag gebracht hat.
// Beschreibung: docs/tagesabschluss.md. Aussehen: web/css/tagesabschluss.css.
//
// - Daten liefern die Spielregeln: Ereignis 'sim:dayEnd' mit e.bericht (sim.tagesbericht), der
//   Verlauf der letzten 30 Tage steht in state.stats.verlauf, der laufende Tag in game.sim.tagesbericht().
// - Karte: Einnahmen je Quelle (Liegegeld, Pacht, Gastronomie, Services, Tagesziele), Ausgaben,
//   Boote (angelegt, abgereist mit Bewertung, weitergefahren), Ruf vorher und nachher, bester Tag,
//   die letzten sieben Tage als Balken und ein Hinweis, was morgen mehr bringt.
// - Sie erscheint von selbst und schließt nach einer Weile wieder, solange niemand sie anfasst.
//   Wer das nicht will, schaltet "Jeden Abend zeigen" aus; dann kommt nur ein kleiner Zettel mit der Summe.
// - Menü: "Tagesabschluss" öffnet die Karte jederzeit, mit Blättern durch die letzten Tage.
// - Münzen über Gebäuden: Bei der Abrechnung der Services steigt über jeder Anlage eine Münze mit dem Betrag auf.
//
// Schnittstelle: game.tagesabschluss = { zeige(tag?), schliesse(), offen() }

import { SERVICE_BY_ID } from '../data/services.js';

const QUELLE_NAME = {
  liegegeld: 'Liegegeld',
  pacht: 'Pacht',
  gastro: 'Gastronomie',
  services: 'Services',
  tagesziele: 'Tagesziele',
  sonstiges: 'Sonstiges',
};
const QUELLE_TEXT = {
  pacht: 'Dauerlieger und stationierte Boote',
  gastro: 'Tagesgäste der Fahrgastschiffe',
};
const REIHENFOLGE = ['liegegeld', 'pacht', 'gastro', 'services', 'tagesziele', 'sonstiges'];
// Beim Rundgang und über Nacht zahlen Gäste nur einen Anteil (rules.uncollectedShare); Trinkgeld kommt mit P12
const LIEGEGELD_TEXT = { kassiert: 'selbst eingestrichen', rundgang: 'beim Rundgang', nacht: 'über Nacht', strichtrinkgeld: 'Trinkgeld (Kassierstrich)', trinkgeld: 'Trinkgeld großer Boote', nebenkosten: 'Nebenkosten (Hafenbüro)' };
const AUSGABE_NAME = { bau: 'Bauen', ausbau: 'Ausbau des Hafens', services: 'Services', pacht: 'Pacht zurückgezahlt' };
// Pacht (features/dauerlieger.js): Saisonpacht im Voraus, sonst die abendliche Pacht der Fischer und Dienste
const PACHT_TEXT = { saison: 'Saisonpacht im Voraus' };
const WEG_TEXT = {
  queueFull: 'Wartebojen voll',
  patience: 'zu lange gewartet',
  evening: 'abends ohne Platz',
  weggeschickt: 'weggeschickt',
};

const AUTO_SCHLIESSEN = 14;          // Sekunden echter Zeit, bis die Karte von selbst geht
const ZETTEL_SEKUNDEN = 5;
const SPEICHER = 'hm-tagesabschluss-auto';

const ganz = (n) => Math.round(n).toLocaleString('de-DE');
const euro = (n) => `${ganz(n)} €`;
const num1 = (n) => n.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'onclick') e.addEventListener('click', v);
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c);
  return e;
}

function leseAuto() {
  try { return localStorage.getItem(SPEICHER) !== 'aus'; } catch { return true; }
}
function schreibeAuto(an) {
  try { localStorage.setItem(SPEICHER, an ? 'an' : 'aus'); } catch { /* privates Fenster */ }
}

/** Ein Hinweis, was morgen mehr bringt (oder null). Reihenfolge: was am meisten Geld kostet zuerst. */
export function hinweis(b, rules = {}) {
  const share = rules.uncollectedShare ?? 0.5;
  const d = b.details?.liegegeld ?? {};
  const halb = (d.rundgang || 0) + (d.nacht || 0);
  const voll = (b.weggefahren?.queueFull || 0) + (b.weggefahren?.evening || 0);
  if (halb > 0 && share > 0 && share < 1) {
    const entgangen = Math.round(halb / share - halb);
    return `${euro(entgangen)} Liegegeld sind liegen geblieben. Wer die Münzen am Tag selbst einstreicht, bekommt den vollen Betrag.`;
  }
  if (voll > 0) return `${voll === 1 ? 'Ein Boot ist' : `${voll} Boote sind`} weitergefahren, weil keine Box frei war. Mehr Liegeplätze bringen mehr Gäste.`;
  if (b.weggefahren?.patience > 0) {
    const n = b.weggefahren.patience;
    return `${n === 1 ? 'Ein Boot hat' : `${n} Boote haben`} zu lange an der Boje gewartet. Zieh wartende Boote früher in eine Box.`;
  }
  if (b.bewertung != null && b.bewertung < 3) return 'Die Gäste waren unzufrieden. Wünsche wie Strom und Wasser bringen bessere Bewertungen.';
  if (b.ziele?.gesamt > 0 && b.ziele.erledigt === 0) return 'Dein Tagesziel links an der Tafel bringt eine Belohnung, wenn du es schaffst.';
  return null;
}

export function init(game) {
  if (typeof document === 'undefined') return;
  const root = document.getElementById('game') || document.body;

  // Eigene Stile, relativ zu diesem Modul (Pages-Pfad /hafenmeister/ bleibt richtig)
  if (!document.getElementById('hm-tagesabschluss-css')) {
    document.head.append(el('link', { id: 'hm-tagesabschluss-css', rel: 'stylesheet', href: new URL('../../css/tagesabschluss.css', import.meta.url).href }));
  }

  const karte = el('section', { id: 'hm-tagesabschluss', class: 'hm-ta hm-px', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'hm-ta-titel', hidden: true });
  const zettel = el('button', { type: 'button', id: 'hm-ta-zettel', class: 'hm-ta-zettel hm-px', hidden: true });
  const menueKnopf = el('button', { type: 'button', id: 'btn-tagesabschluss', class: 'hm-zeile' }, 'Tagesabschluss');
  const muenzen = el('div', { class: 'hm-ta-muenzen', 'aria-hidden': 'true' });
  // Ins Menü räumt ui/oberflaeche.js den Knopf ein (Liste MENUE)
  root.append(karte, zettel, muenzen, menueKnopf);

  let gezeigt = null;           // Tag des gezeigten Berichts (null = laufender Tag)
  let restzeit = 0;             // Sekunden bis zum Schließen, 0 = bleibt offen
  let zettelZeit = 0;
  let angefasst = false;

  const sim = () => game.sim;
  const verlauf = () => sim()?.verlauf?.() ?? sim()?.state?.stats?.verlauf ?? [];

  // tag: Nummer eines abgeschlossenen Tages oder 'jetzt' für den laufenden Tag
  function berichtFuer(tag) {
    if (tag === 'jetzt') {
      const b = sim()?.tagesbericht?.();
      return b ? { ...b, laufend: true } : null;
    }
    return verlauf().find((b) => b.tag === tag) ?? null;
  }

  // ------------------------------------------------------------ Karte zeichnen
  function zeile(name, betrag, { klein = null, klasse = '', zusatz = null } = {}) {
    return el('div', { class: `hm-ta-zeile ${klasse}` },
      el('span', { class: 'hm-ta-name' }, name, klein ? el('small', {}, klein) : null),
      zusatz ? el('span', { class: 'hm-ta-zusatz' }, zusatz) : null,
      el('span', { class: 'hm-ta-betrag' }, betrag));
  }

  function balken(b) {
    const tage = verlauf().filter((x) => x.tag <= b.tag).slice(-7);
    if (b.laufend) tage.push(b);
    if (tage.length < 2) return null;
    const max = Math.max(1, ...tage.map((x) => x.summe));
    const bestTag = sim()?.state?.stats?.besterTag?.tag;
    return el('div', { class: 'hm-ta-balken', role: 'img', 'aria-label': `Einnahmen der letzten ${tage.length} Tage` },
      ...tage.map((x) => el('div', { class: `hm-ta-saeule${x.tag === b.tag ? ' heute' : ''}${x.tag === bestTag ? ' best' : ''}`, title: `Tag ${x.tag}: ${euro(x.summe)}` },
        el('i', { style: { height: `${Math.max(4, Math.round((x.summe / max) * 100))}%` } }),
        el('span', {}, String(x.tag)))));
  }

  function zeichne(b) {
    const rules = sim()?.ctx?.rules ?? {};
    const laufend = !!b.laufend;
    // Rekord erst, wenn es einen Tag davor zu schlagen gab
    const rekord = !laufend && b.rekord && b.besterTag?.summe > 0;
    const titel = laufend ? `Tag ${b.tag} bis jetzt` : `Tag ${b.tag} geschafft`;
    const alle = verlauf();
    const idx = laufend ? alle.length : alle.findIndex((x) => x.tag === b.tag);
    const vor = idx > 0 ? alle[idx - 1] : null;
    const nach = laufend ? null : idx >= 0 && idx < alle.length - 1 ? alle[idx + 1] : { tag: 'jetzt' };

    const kopf = el('header', { class: 'hm-ta-kopf' },
      el('button', { type: 'button', class: 'hm-ta-blaettern', 'aria-label': 'Tag davor', disabled: !vor, onclick: () => zeige(vor.tag) }, '‹'),
      el('div', { class: 'hm-ta-kopftext' },
        el('h2', { id: 'hm-ta-titel' }, titel),
        el('p', { class: 'hm-ta-summe' + (b.summe > 0 ? '' : ' null') },
          el('i', { class: 'hm-ta-muenze-sym', 'aria-hidden': 'true' }),
          `+ ${euro(b.summe)}`,
          rekord ? el('span', { class: 'hm-ta-rekord' }, 'Rekord') : null)),
      el('button', { type: 'button', class: 'hm-ta-blaettern', 'aria-label': 'Tag danach', disabled: !nach, onclick: () => zeige(nach.tag) }, '›'),
      el('button', { type: 'button', class: 'hm-zu', 'aria-label': 'Schließen', onclick: () => schliesse() }));

    // Einnahmen je Quelle
    const einnahmen = el('div', { class: 'hm-ta-block' });
    const quellen = REIHENFOLGE.filter((q) => (b.einnahmen?.[q] || 0) > 0);
    for (const q of Object.keys(b.einnahmen || {})) if (!quellen.includes(q) && b.einnahmen[q] > 0) quellen.push(q);
    if (!quellen.length) einnahmen.append(el('p', { class: 'hm-ta-leer' }, laufend ? 'Noch nichts eingenommen.' : 'Heute kam kein Geld herein.'));
    for (const q of quellen) {
      let klein = QUELLE_TEXT[q] ?? null;
      let zusatz = null;
      const d = b.details?.[q];
      if (q === 'liegegeld' && d) {
        const teile = Object.entries(LIEGEGELD_TEXT).filter(([k]) => d[k] > 0).map(([k, t]) => `${euro(d[k])} ${t}`);
        if (teile.length > 1 || (teile.length === 1 && !d.kassiert)) klein = teile.join(', ');
      }
      if (q === 'pacht' && d) {
        const teile = Object.entries(PACHT_TEXT).filter(([k]) => d[k] > 0).map(([k, t]) => `${t} ${euro(d[k])}`);
        if (teile.length) klein = teile.join(', ');
      }
      if (q === 'services' && d) {
        const top = Object.entries(d).sort((x, y) => y[1] - x[1]);
        const namen = top.slice(0, 3).map(([id, v]) => `${SERVICE_BY_ID[id]?.name ?? id} ${euro(v)}`);
        if (top.length > 3) namen.push(`${top.length - 3} weitere`);
        klein = namen.join(', ');
      }
      if (q === 'tagesziele' && b.ziele?.gesamt) zusatz = `${b.ziele.erledigt} von ${b.ziele.gesamt}`;
      einnahmen.append(zeile(QUELLE_NAME[q] ?? q, euro(b.einnahmen[q]), { klein, zusatz }));
    }
    if (!(b.einnahmen?.tagesziele > 0) && b.ziele?.gesamt) {
      einnahmen.append(zeile('Tagesziele', '0 €', { zusatz: `${b.ziele.erledigt} von ${b.ziele.gesamt}`, klasse: 'leise' }));
    }

    // Ausgaben
    const ausgaben = b.ausgabenSumme > 0
      ? el('div', { class: 'hm-ta-block hm-ta-aus' },
        ...Object.entries(b.ausgaben).filter(([, v]) => v > 0)
          .map(([k, v]) => zeile(AUSGABE_NAME[k] ?? k, `− ${euro(v)}`, { klasse: 'minus' })),
        zeile('Kasse heute', `${b.summe - b.ausgabenSumme >= 0 ? '+' : '−'} ${euro(Math.abs(b.summe - b.ausgabenSumme))}`, { klasse: 'saldo' }))
      : null;

    // Boote und Ruf
    const boote = [];
    boote.push(el('span', {}, el('b', {}, String(b.angelegt)), b.angelegt === 1 ? ' Boot angelegt' : ' Boote angelegt'));
    if (b.abgereist || !laufend) {
      boote.push(el('span', {}, el('b', {}, String(b.abgereist)), b.abgereist === 1 ? ' Gast abgereist' : ' Gäste abgereist',
        b.bewertung != null ? ` (Schnitt ${num1(b.bewertung)} Sterne)` : ''));
    }
    if (b.weggefahrenSumme > 0) {
      const gruende = Object.entries(b.weggefahren).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${WEG_TEXT[k] ?? k}`).join(', ');
      boote.push(el('span', { class: 'warn' }, el('b', {}, String(b.weggefahrenSumme)), ' weitergefahren', el('small', {}, gruende)));
    }
    // Unterschied aus den gezeigten (gerundeten) Werten, damit "2,2 auf 2,1" auch "(−0,1)" zeigt
    const r1 = (x) => Math.round((x ?? 0) * 10) / 10;
    const rufDiff = Math.round((r1(b.ruf?.nachher) - r1(b.ruf?.vorher)) * 10) / 10;
    const ruf = b.ruf
      ? el('span', { class: rufDiff > 0 ? 'auf' : rufDiff < 0 ? 'ab warn' : '' },
        'Ruf ', el('b', {}, num1(b.ruf.vorher)), ' auf ', el('b', {}, num1(b.ruf.nachher)),
        rufDiff ? ` (${rufDiff > 0 ? '+' : '−'}${num1(Math.abs(rufDiff))})` : '')
      : null;

    // Bester Tag
    let best = null;
    if (rekord) {
      best = `Neuer Rekord, ${euro(b.summe - b.besterTag.summe)} mehr als ${b.besterTag.tag ? `an Tag ${b.besterTag.tag}` : 'am besten Tag davor'}.`;
    } else if (b.rekord && !laufend) {
      best = null;
    } else if (b.besterTag?.summe > 0) best = b.besterTag.tag ? `Bester Tag bisher: Tag ${b.besterTag.tag} mit ${euro(b.besterTag.summe)}` : `Bester Tag bisher: ${euro(b.besterTag.summe)}`;

    const tipp = laufend ? null : hinweis(b, rules);
    const auto = leseAuto();
    const fuss = el('footer', { class: 'hm-ta-fuss' },
      el('label', { class: 'hm-ta-auto' },
        el('input', { type: 'checkbox', checked: auto, onclick: (e) => { schreibeAuto(e.target.checked); } }),
        ' Jeden Abend zeigen'),
      el('button', { type: 'button', class: 'hm-knopf hm-primaer hm-px hm-ta-weiter', onclick: () => schliesse() }, 'Weiter'));

    // Zwei Spalten (Handy quer): links das Geld, rechts Boote, Verlauf und Hinweis
    karte.replaceChildren(
      kopf,
      el('div', { class: 'hm-ta-spalten' },
        el('div', { class: 'hm-ta-links' },
          el('h3', { class: 'hm-ta-unter' }, 'Einnahmen'),
          einnahmen,
          ausgaben),
        el('div', { class: 'hm-ta-rechts' },
          el('div', { class: 'hm-ta-boote' }, ...boote, ruf),
          balken(b),
          best ? el('p', { class: 'hm-ta-best' + (rekord ? ' rekord' : '') }, best) : null,
          tipp ? el('p', { class: 'hm-ta-tipp' }, tipp) : null,
          fuss)),
      el('div', { class: 'hm-ta-uhr', 'aria-hidden': 'true' }, el('i')),
    );
    karte.dataset.tag = String(b.tag);
  }

  // ------------------------------------------------------------ Öffnen und Schließen
  // Ohne Angabe: der letzte abgeschlossene Tag, am ersten Tag der laufende
  function zeige(tag = null, { auto = false } = {}) {
    const b = berichtFuer(tag ?? verlauf().at(-1)?.tag ?? 'jetzt') ?? berichtFuer('jetzt');
    if (!b) return false;
    gezeigt = b.laufend ? null : b.tag;
    zeichne(b);
    zettel.hidden = true;
    karte.hidden = false;
    karte.classList.remove('rein'); void karte.offsetWidth; karte.classList.add('rein');
    angefasst = !auto;
    restzeit = auto ? AUTO_SCHLIESSEN : 0;
    karte.classList.toggle('laeuft', auto);
    karte.style.setProperty('--ta-dauer', `${AUTO_SCHLIESSEN}s`);
    document.body.classList.add('ta-offen');
    if (!auto) game.oberflaeche?.klappeZu?.();
    return true;
  }
  function schliesse() {
    if (karte.hidden) return;
    karte.hidden = true;
    restzeit = 0;
    document.body.classList.remove('ta-offen');
    game.emit('tagesabschluss:zu', { tag: gezeigt });
  }
  // Anfassen hält die Karte offen
  const festhalten = () => {
    if (angefasst) return;
    angefasst = true;
    restzeit = 0;
    karte.classList.remove('laeuft');
  };
  karte.addEventListener('pointerdown', festhalten);
  karte.addEventListener('keydown', (e) => { if (e.key === 'Escape') schliesse(); else festhalten(); });
  karte.addEventListener('wheel', festhalten, { passive: true });

  function zeigeZettel(b) {
    zettel.replaceChildren(
      el('i', { class: 'hm-ta-muenze-sym', 'aria-hidden': 'true' }),
      el('span', {}, `Tag ${b.tag}: + ${euro(b.summe)}`),
      b.rekord && b.besterTag?.summe > 0 ? el('span', { class: 'hm-ta-rekord' }, 'Rekord') : null);
    zettel.setAttribute('aria-label', `Tag ${b.tag}: ${euro(b.summe)} eingenommen. Tagesabschluss öffnen`);
    zettel.dataset.tag = String(b.tag);
    zettel.hidden = false;
    zettel.classList.remove('rein'); void zettel.offsetWidth; zettel.classList.add('rein');
    zettelZeit = ZETTEL_SEKUNDEN;
  }
  zettel.addEventListener('click', () => zeige(Number(zettel.dataset.tag)));
  menueKnopf.addEventListener('click', () => {
    if (!karte.hidden) { schliesse(); return; }
    zeige();
  });

  // Tagesende: Bericht kommt mit dem Ereignis der Spielregeln
  game.on('sim:dayEnd', (e) => {
    const b = e?.bericht;
    if (!b) return;
    const einstieg = game.einstieg?.schritt?.();
    const foto = document.body.classList.contains('foto');
    if (foto) return;
    if (leseAuto() && !einstieg) zeige(b.tag, { auto: true });
    else zeigeZettel(b);
    game.audio?.sfx?.(b.rekord && b.besterTag?.summe > 0 ? 'fertig' : 'kasse');
  });
  game.on('spielstand-geladen', () => { schliesse(); zettel.hidden = true; });
  game.on('foto', () => schliesse());

  // Uhr: echte Zeit, damit die Karte auch bei Pause und Vorspulen gleich lange bleibt
  let letzte = performance.now();
  function uhr(t) {
    const dt = Math.min(0.25, (t - letzte) / 1000);
    letzte = t;
    if (restzeit > 0 && !karte.hidden) {
      restzeit -= dt;
      if (restzeit <= 0) schliesse();
    }
    if (zettelZeit > 0) {
      zettelZeit -= dt;
      if (zettelZeit <= 0) zettel.hidden = true;
    }
    bewegeMuenzen(dt);
    requestAnimationFrame(uhr);
  }
  requestAnimationFrame(uhr);

  // ------------------------------------------------------------ Münzen über Gebäuden
  // Die Services rechnen zu Beginn des Abends ab (services:abrechnung). Über jeder Anlage, die etwas
  // eingebracht hat, steigt eine Münze mit dem Betrag auf. Liegt die Anlage außerhalb des Bildes, entfällt sie.
  const fliegend = [];
  const THREE = game.THREE;
  const v = THREE ? new THREE.Vector3() : null;
  const box = THREE ? new THREE.Box3() : null;
  game.on('services:abrechnung', (a = {}) => {
    if (!THREE || !game.services?.gruppe || document.body.classList.contains('foto')) return;
    const posten = (a.einnahmen || []).filter((x) => x.betrag > 0);
    posten.forEach((p, i) => {
      const obj = game.services.gruppe.getObjectByName(`service-${p.id}`);
      if (!obj) return;
      box.setFromObject(obj);
      if (box.isEmpty()) return;
      const welt = new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y + 1.5, (box.min.z + box.max.z) / 2);
      const m = el('div', { class: 'hm-ta-flug' }, el('i', { class: 'hm-ta-muenze-sym' }), `+${euro(p.betrag)}`);
      m.style.opacity = '0';
      muenzen.append(m);
      fliegend.push({ m, welt, t: -i * 0.18, dauer: 2.6 });
    });
  });
  function bewegeMuenzen(dt) {
    if (!fliegend.length) return;
    const cam = game.camera?.camera;
    const r = game.canvas?.getBoundingClientRect?.();
    for (let i = fliegend.length - 1; i >= 0; i--) {
      const f = fliegend[i];
      f.t += dt;
      if (f.t >= f.dauer || !cam || !r) { f.m.remove(); fliegend.splice(i, 1); continue; }
      if (f.t < 0) continue;
      v.copy(f.welt).project(cam);
      const x = (v.x + 1) / 2 * r.width + r.left;
      const y = (1 - v.y) / 2 * r.height + r.top;
      const sichtbar = v.z < 1 && x > -40 && y > -40 && x < r.width + 40 && y < r.height + 40;
      const k = f.t / f.dauer;
      f.m.style.transform = `translate(${Math.round(x)}px, ${Math.round(y - 46 * k)}px) translate(-50%, -100%)`;
      f.m.style.opacity = sichtbar ? String(k < 0.15 ? k / 0.15 : k > 0.7 ? (1 - k) / 0.3 : 1) : '0';
    }
  }

  game.tagesabschluss = { zeige: (tag) => zeige(tag ?? null), schliesse, offen: () => !karte.hidden };
}
