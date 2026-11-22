// Eigenes Hafenfest (Roadmap P38, F12): Planer, Meldungen und Festmusik. Regeln in features/hafenfest-regeln.js,
// das Fest im Hafen (Wimpelketten, Bühne, Marktstände) in render/fest-deko.js. Beschreibung: docs/hafenfest.md.
//
// So spielt es sich:
// - Ab Stufe 3 kann man einmal je Saison ein Hafenfest ansetzen. Zu Beginn der Saison (und beim ersten
//   Mal ab Stufe 3) fragt eine kurze Meldung, ob man eins planen will. Jederzeit geht es im Wetterbericht
//   (Wetterknopf oben links, unterste Zeile "Hafenfest planen").
// - Im Planer wählt man einen Tag (frühestens übermorgen, nicht neben anderen Ereignissen, Mittsommer und
//   der Hanse-Woche) und was dazugehört: Schmuck, Musik, Marktstände, Feuerwerk. Die Vorbereitung kostet
//   sofort Geld. Bis zum Vorabend kann man absagen und bekommt die Hälfte zurück.
// - Am Vorabend wird aufgebaut (Wimpelketten, Bühne, Stände), am Festtag kommen viel mehr Boote und
//   Besucher, die Kapelle spielt, abends gibt es Feuerwerk. Danach kommt die Bilanz.
//
// Schnittstelle: game.hafenfest = { oeffnen(), schliessen(), stand(), aufgebaut(), zeile(entry), berichtZeile(letzterTag) }
// Ereignisse: 'hafenfest:aufbau' { teile } wenn aufgebaut wird, 'hafenfest:abbau' danach (render/fest-deko.js).
import { regelnBereit } from './regeln-bereit.js';
import { pixelBild } from '../ui/pixel-symbole.js';
import * as F from './hafenfest-regeln.js';
import { seasonOf } from '../events/scheduler.js';

const MELDUNG_ID = 'hafenfest';
const MELDUNG_VORRANG = 58;           // zwischen Funk (57) und Ereignis (60), siehe ui/meldungen.js
const STEHT_SEKUNDEN = { angebot: 16, vorabend: 9, ergebnis: 12, info: 6 };
const euro = (n) => `${Math.round(n).toLocaleString('de-DE')} €`;
const PART_NAME = { fruehling: 'Frühling', sommer: 'Sommer', herbst: 'Herbst' };
const EVENT_ICON = { mittsommer: 'feuer', heringstage: 'fisch', hansewoche: 'kogge', sturm: 'sturm', regatta: 'regatta',
  nebel: 'nebel', sommertag: 'sonne', holzboote: 'holzboot', hafenfest: 'fest' };

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
const liste = (namen) => (namen.length <= 1 ? namen.join('') : `${namen.slice(0, -1).join(', ')} und ${namen[namen.length - 1]}`);
const teilNamen = (teile) => F.ordne(teile).map((t) => F.TEIL_TEXTE[t].name);
const wannText = (tage) => (tage <= 0 ? 'Heute' : tage === 1 ? 'Morgen' : tage === 2 ? 'Übermorgen' : `In ${tage} Tagen`);

export async function init(game) {
  if (typeof document === 'undefined') return;
  const api = await regelnBereit(game);
  // Der Ereignisplaner (events/events.js) ist ein Modul vor uns, steht aber erst nach dem Laden sicher
  const plan = () => game.events?.scheduler ?? null;
  F.haengeEin(api.addHook, { plan });
  const st = () => api.state;
  const stand = () => (st() && plan() ? F.stand(st(), plan()) : null);

  // ------------------------------------------------------------ Aufbau im Hafen (Vorabend bis Festende)
  // Liefert die gebuchten Teile, solange aufgebaut ist, sonst null.
  function aufgebaut() {
    const s = st();
    const p = plan();
    if (!s || !p) return null;
    const cur = p.current;
    if (F.heuteFest(cur, s.day)) return F.ordne(cur.teile);
    const e = p.eigen;
    if (e?.id === 'hafenfest' && e.startDay === s.day + 1 && s.phase === 'evening') return F.ordne(e.teile);
    return null;
  }
  let aufbauStand = null;
  function pruefeAufbau() {
    const t = aufgebaut();
    // Festmusik nur am Festtag und nur mit Musik
    const musik = !!(t && F.heuteFest(plan()?.current, st()?.day) && t.includes('musik'));
    const sig = t ? `${t.join(',') || '-'}|${musik}` : null;
    if (sig === aufbauStand) return;
    aufbauStand = sig;
    if (t) game.emit('hafenfest:aufbau', { teile: t });
    else game.emit('hafenfest:abbau', {});
    game.audio?.setFest?.(musik);
  }
  game.on('event:start', () => setTimeout(pruefeAufbau, 0));
  game.on('event:end', () => setTimeout(pruefeAufbau, 0));
  game.on('sim:evening', () => setTimeout(pruefeAufbau, 0));
  game.on('sim:dayStart', () => setTimeout(pruefeAufbau, 0));
  game.on('spielstand-geladen', () => setTimeout(pruefeAufbau, 50));
  game.on('sim:change', (e) => { if (e?.reason === 'load') setTimeout(pruefeAufbau, 50); });
  setInterval(pruefeAufbau, 1500);

  // ------------------------------------------------------------ Meldungskarte (Meldeplatz)
  const host = document.getElementById('game') ?? document.body;
  const karte = el('div', { id: 'hm-fest-karte', class: 'hm-px', role: 'status', 'aria-live': 'polite', hidden: true });
  host.append(karte);
  game.meldungen?.anmelden?.('#hm-fest-karte', MELDUNG_ID);
  let timer = 0;
  let rest = 0;
  let bisSchluss = 0;
  let gezeigt = null;
  let gezeigtTag = null;

  function karteZu() {
    karte.hidden = true;
    gezeigt = null;
    clearTimeout(timer);
    timer = 0;
    game.meldungen?.fertig(MELDUNG_ID);
  }
  function karteZeige(art, titel, text, knoepfe = []) {
    karte.replaceChildren(
      el('div', { class: 'hf-kopf' }, bild('fest', 24), el('div', {}, el('strong', { text: titel }), el('span', { text }))),
      el('div', { class: 'hf-knoepfe' }, ...knoepfe, el('button', { type: 'button', class: 'hm-knopf', onclick: karteZu, text: knoepfe.length ? 'Später' : 'Gut' })));
    gezeigt = art;
    gezeigtTag = st()?.day ?? null;
    clearTimeout(timer);
    timer = 0;
    rest = (STEHT_SEKUNDEN[art] ?? 8) * 1000;
    karte.hidden = false;
    game.meldungen?.wunsch(MELDUNG_ID, MELDUNG_VORRANG);
    ordne();
  }
  // Meldungs-Ordnung: steht etwas Wichtigeres, wartet die Karte (ihre Uhr steht)
  function ordne() {
    if (karte.hidden) return;
    const darf = game.meldungen ? game.meldungen.darf(MELDUNG_ID) : true;
    const zurueck = !darf || document.body.classList.contains('card-open') || !panel.hidden;
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
  game.on('sim:dayStart', () => { if (gezeigt && gezeigtTag !== st()?.day && gezeigt !== 'ergebnis') karteZu(); });
  game.on('foto', karteZu);

  const planenKnopf = () => el('button', { type: 'button', class: 'hm-knopf hm-primaer', onclick: () => { karteZu(); oeffnen(); }, text: 'Fest planen' });

  // Zu Beginn der Saison (ab Saisontag 2, damit der Frühlingsgruß Ruhe hat) und beim ersten Mal ab Stufe 3:
  // einmal je Saison fragen
  function vielleichtFragen() {
    const s = st();
    const k = stand();
    if (!s || !k?.frei || s.phase !== 'day') return;
    const f = F.fState(s);
    if (f.gesehen === k.jahr) return;
    const sz = seasonOf(s.day);
    if (sz.winter || sz.seasonDay < 2) return;
    f.gesehen = k.jahr;
    const erstes = !f.gefeiert;
    karteZeige('angebot', erstes ? 'Neu: Eigenes Hafenfest' : `Hafenfest in Saison ${k.jahr}`,
      erstes
        ? 'Einmal je Saison kannst du ein Fest ansetzen. Dann kommen Boote von überall und der Hafen wird voll.'
        : 'Such dir einen Tag aus: Schmuck, Musik, Stände und Feuerwerk. Der Hafen wird voll.',
      [planenKnopf()]);
  }
  game.on('sim:dayStart', () => setTimeout(vielleichtFragen, 2500));
  game.on('stufe', () => setTimeout(vielleichtFragen, 4000));

  game.on('sim:hafenfestVorabend', ({ teile = [] } = {}) => {
    const n = teilNamen(teile.filter((t) => t !== 'feuerwerk'));
    const auf = teile.includes('schmuck') || teile.includes('musik') || teile.includes('markt');
    const was = auf ? `${liste(n)}: der Hafen wird heute Abend geschmückt.` : 'Morgen kommen Boote von überall.';
    setTimeout(() => karteZeige('vorabend', 'Morgen ist dein Hafenfest', `${was} Halte Plätze frei, es wird voll.`), 0);
  });

  game.on('sim:hafenfestErgebnis', (e) => {
    const voll = Math.round((e.voll ?? 0) * 100);
    const sonst = e.sonst != null && e.sonst < e.boote ? ` (sonst rund ${e.sonst})` : '';
    const teile = [`${e.boote} ${e.boote === 1 ? 'Boot' : 'Boote'} im Hafen${sonst}, ${voll} % der Plätze belegt.`];
    if (e.besucher > 0) teile.push(`${e.besucher.toLocaleString('de-DE')} Besucher an Land.`);
    if (e.standgeld > 0) teile.push(`Standgeld ${euro(e.standgeld)}.`);
    if (e.kosten > 0) teile.push(`Die Vorbereitung kostete ${euro(e.kosten)}, was der Tag brachte, steht im Tagesabschluss.`);
    if (e.paeckchen > 0) teile.push(`${e.paeckchen === 1 ? 'Ein Boot lag' : `${e.paeckchen} Boote lagen`} im Päckchen, ohne Abzug: Am Festtag stört das niemanden.`);
    setTimeout(() => karteZeige('ergebnis', 'Hafenfest vorbei', teile.join(' ')), 0);
  });

  // ------------------------------------------------------------ Planer (#hm-fest)
  const panel = el('section', { id: 'hm-fest', class: 'hm-px', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'hm-fest-titel', hidden: true });
  host.append(panel);
  let wahlTag = null;
  let wahlTeile = new Set(['schmuck', 'musik']);
  let hinweis = '';
  let absagenFrage = false;

  function schliessen() {
    panel.hidden = true;
    hinweis = '';
    absagenFrage = false;
    game.emit('hafenfest:planer', { offen: false });
  }
  function oeffnen() {
    const s = st();
    if (!s) return;
    const k = stand();
    if (!k) return;
    const frei = F.festTage(s, plan()).filter((t) => t.frei);
    // Vorschlag: der erste freie Sommertag, sonst der erste freie Tag
    if (!frei.some((t) => t.tag === wahlTag)) wahlTag = (frei.find((t) => seasonOf(t.tag).part === 'sommer') ?? frei[0])?.tag ?? null;
    hinweis = '';
    absagenFrage = false;
    // Den Wetterbericht zuklappen, der Planer steht an seiner Stelle
    const wp = document.getElementById('weather-panel');
    if (wp && !wp.hidden) document.getElementById('weather-chip')?.click();
    panel.hidden = false;
    zeichne();
    game.emit('hafenfest:planer', { offen: true });
    game.audio?.sfx?.('klick');
  }

  function tagKachel(t, heute) {
    const s = seasonOf(t.tag);
    const fc = t.tag - heute <= 3 ? game.events?.forecast?.(3)?.find((e) => e.day === t.tag) : null;
    const ev = fc?.event ?? (t.grund === 'fest' || t.grund === 'gross' ? null : null);
    const icon = ev ? EVENT_ICON[ev.id] ?? 'wolke' : t.grund === 'gross' ? 'kogge' : t.grund === 'fest' ? 'feuer' : null;
    const knopf = el('button', {
      type: 'button',
      class: `hf-tag${t.frei ? '' : ' zu'}${t.tag === wahlTag ? ' an' : ''}${s.part === 'sommer' ? ' sommer' : ''}`,
      'aria-pressed': String(t.tag === wahlTag),
      'aria-label': `Saisontag ${t.saisonTag}${t.frei ? '' : `, ${F.GRUND_TEXTE[t.grund] ?? 'geht nicht'}`}`,
      'data-tag': String(t.tag),
      onclick: () => {
        if (!t.frei) { hinweis = `Tag ${t.saisonTag}: ${F.GRUND_TEXTE[t.grund] ?? 'geht nicht'}.`; zeichne(); return; }
        wahlTag = t.tag;
        hinweis = '';
        zeichne();
      },
    }, el('b', { text: String(t.saisonTag) }), icon ? bild(icon, 12) : el('i', { class: 'hf-leer' }));
    return knopf;
  }

  function wirkungsSatz(teile) {
    const w = F.FEST.wirkung;
    const x = F.wirkung([...teile]) ?? {};
    const besucher = (x.visitorFactor ?? w.visitorFactor);
    const t = [`Am Festtag ${String(w.arrivalFactor).replace('.', ',')}-mal so viele Boote, ${besucher.toFixed(1).replace('.', ',')}-mal so viele Besucher.`];
    if (teile.has('markt')) t.push(`Standgeld abends ${euro(F.standgeld(st().stage))}.`);
    return t.join(' ');
  }

  function zeichne() {
    const s = st();
    const p = plan();
    if (!s || !p || panel.hidden) return;
    const k = F.stand(s, p);
    const kopf = el('div', { class: 'hf-p-kopf' }, bild('fest', 24),
      el('h2', { id: 'hm-fest-titel', text: 'Eigenes Hafenfest' }),
      el('button', { type: 'button', class: 'hf-zu', 'aria-label': 'Schließen', onclick: schliessen, text: '×' }));
    const inhalt = [kopf];
    if (k.angesetzt || k.laeuft) {
      // Schon angesetzt: was kommt, und absagen
      const a = k.angesetzt;
      const tag = a?.tag ?? p.current?.startDay;
      const teile = a?.teile ?? F.ordne(p.current?.teile);
      const tage = tag - s.day;
      inhalt.push(el('p', { class: 'hf-leise', text: `${wannText(tage)}, Saisontag ${seasonOf(tag).seasonDay}: dein Hafenfest.` }));
      inhalt.push(el('p', { text: teile.length ? `Dabei: ${liste(teilNamen(teile))}.` : 'Ein schlichtes Fest ohne Schmuck und Musik.' }));
      if (a && tage >= 1) {
        const zurueck = F.erstattung(s);
        inhalt.push(el('div', { class: 'hf-knoepfe' },
          absagenFrage
            ? el('button', { type: 'button', class: 'hm-knopf hm-primaer', onclick: () => absagen(), text: `Ja, absagen (${euro(zurueck)} zurück)` })
            : el('button', { type: 'button', class: 'hm-knopf', onclick: () => { absagenFrage = true; zeichne(); }, text: 'Fest absagen' }),
          el('button', { type: 'button', class: 'hm-knopf', onclick: schliessen, text: 'Gut' })));
      } else {
        inhalt.push(el('div', { class: 'hf-knoepfe' }, el('button', { type: 'button', class: 'hm-knopf hm-primaer', onclick: schliessen, text: 'Gut' })));
      }
    } else if (!k.frei) {
      const text = {
        stufe: `Ein eigenes Hafenfest gibt es ab Stufe ${F.AB_STUFE}.`,
        winter: 'Im Winter gibt es keine Feste. Im Frühling geht es wieder.',
        gefeiert: 'Das Hafenfest dieser Saison ist gefeiert. In der nächsten Saison wieder.',
        spaet: 'In dieser Saison ist kein Tag mehr frei. In der nächsten Saison wieder.',
      }[k.grund] ?? 'Gerade kein Fest möglich.';
      inhalt.push(el('p', { text }));
      if (k.letztes) inhalt.push(el('p', { class: 'hf-leise', text: `Letztes Fest: ${k.letztes.boote} Boote, ${euro(k.letztes.einnahmen)} am Festtag.` }));
      inhalt.push(el('div', { class: 'hf-knoepfe' }, el('button', { type: 'button', class: 'hm-knopf hm-primaer', onclick: schliessen, text: 'Gut' })));
    } else {
      const sz = seasonOf(s.day);
      inhalt.push(el('p', { class: 'hf-leise', text: `Einmal je Saison. ${PART_NAME[sz.part] ?? ''}, heute Saisontag ${sz.seasonDay}. Im Sommer kommen die meisten Boote.` }));
      // Tage
      const tage = F.festTage(s, p).filter((t) => t.grund !== 'vorbei');
      inhalt.push(el('h3', { text: 'Tag wählen' }));
      inhalt.push(el('div', { class: 'hf-tage', role: 'group', 'aria-label': 'Festtag' }, tage.map((t) => tagKachel(t, s.day))));
      // Teile
      inhalt.push(el('h3', { text: 'Was gehört dazu?' }));
      const teileBox = el('div', { class: 'hf-teile' });
      for (const t of F.TEILE) {
        const an = wahlTeile.has(t);
        teileBox.append(el('button', {
          type: 'button', class: `hf-teil${an ? ' an' : ''}`, 'aria-pressed': String(an), 'data-teil': t,
          onclick: () => { if (wahlTeile.has(t)) wahlTeile.delete(t); else wahlTeile.add(t); hinweis = ''; zeichne(); },
        }, el('i', { class: 'hf-haken', 'aria-hidden': 'true' }),
        el('span', { class: 'hf-teil-text' }, el('b', { text: F.TEIL_TEXTE[t].name }), el('small', { text: F.TEIL_TEXTE[t].text })),
        el('em', { text: euro(F.teilKosten(s.stage, t)) })));
      }
      inhalt.push(teileBox);
      const k2 = F.kosten(s.stage, [...wahlTeile]);
      inhalt.push(el('p', { class: 'hf-leise', text: wirkungsSatz(wahlTeile) }));
      const teuer = s.money < k2.summe;
      const wt = wahlTag ? seasonOf(wahlTag).seasonDay : null;
      // Fuß mit Summe und Knöpfen bleibt beim Blättern unten stehen (Handy hochkant)
      inhalt.push(el('div', { class: 'hf-fuss' },
        el('div', { class: 'hf-summe' },
          el('span', { text: `Anmeldung und Werbung ${euro(k2.grund)}` }),
          el('b', { text: `Zusammen ${euro(k2.summe)}` })),
        hinweis ? el('p', { class: 'hf-hinweis', role: 'status', text: hinweis })
          : teuer ? el('p', { class: 'hf-hinweis', role: 'status', text: `In der Kasse sind ${euro(s.money)}. Lass etwas weg oder spar noch.` }) : null,
        el('div', { class: 'hf-knoepfe' },
          el('button', { type: 'button', class: 'hm-knopf hm-primaer', disabled: !wahlTag || teuer, onclick: () => ansetzen(),
            text: wahlTag ? `Fest an Tag ${wt} ansetzen` : 'Tag wählen' }),
          el('button', { type: 'button', class: 'hm-knopf', onclick: schliessen, text: 'Abbrechen' }))));
    }
    panel.replaceChildren(...inhalt);
  }

  function nachAenderung(events) {
    // Den Planer sofort in den Spielstand legen (events.js tut das sonst erst am nächsten Morgen): wer
    // jetzt speichert oder neu lädt, behält das Fest und das bezahlte Geld passt dazu.
    const s = st();
    if (s && plan()) { s.modules ??= {}; s.modules.events = plan().save(); }
    if (game.state && game.state !== s && plan()) { game.state.modules ??= {}; game.state.modules.events = plan().save(); }
    api.dispatch?.(events ?? []);
    game.emit('sim:change', { reason: 'hafenfest' });
    game.emit('event:loaded', {});      // Wetterknopf und Wetterbericht neu zeichnen (events/banner.js)
  }

  function ansetzen() {
    const s = st();
    const r = F.ansetzen(s, plan(), wahlTag, [...wahlTeile]);
    if (!r.ok) {
      hinweis = r.grund === 'geld' ? 'Dafür reicht das Geld nicht.' : `Das geht nicht: ${F.GRUND_TEXTE[r.grund] ?? r.grund}.`;
      game.audio?.sfx?.('fehler');
      zeichne();
      return;
    }
    game.audio?.sfx?.('kasse');
    nachAenderung(r.events);
    schliessen();
    const tage = wahlTag - s.day;
    karteZeige('info', `Hafenfest ${wannText(tage).toLowerCase()} angesetzt`,
      `Saisontag ${seasonOf(wahlTag).seasonDay}. Am Vorabend wird aufgebaut. Absagen geht im Wetterbericht bis zum Vorabend.`);
  }

  function absagen() {
    const r = F.absagen(st(), plan());
    if (!r.ok) return;
    game.audio?.sfx?.('abbrechen');
    nachAenderung(r.events);
    absagenFrage = false;
    zeichne();
  }

  game.on('sim:change', () => { if (!panel.hidden) zeichne(); });
  game.on('sim:dayStart', () => { if (!panel.hidden) zeichne(); });
  game.on('spielstand-geladen', schliessen);
  game.on('foto', schliessen);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) schliessen(); });
  panel.addEventListener('pointerdown', (e) => e.stopPropagation());
  panel.addEventListener('click', (e) => e.stopPropagation());

  // ------------------------------------------------------------ Wetterbericht (events/banner.js)
  // Zeile unter dem Fest, wenn es in den nächsten Tagen kommt: was dazugehört, Knopf zum Planer
  function zeile(entry) {
    if (entry?.event?.id !== 'hafenfest') return null;
    const p = plan();
    const e = p?.eigen?.startDay === entry.day ? p.eigen : (p?.current?.eigen && p.current.startDay === entry.day ? p.current : null);
    if (!e) return null;
    const box = el('div', { class: 'evv-zeile' });
    const teile = F.ordne(e.teile);
    box.append(el('small', { text: teile.length ? `Dabei: ${liste(teilNamen(teile))}.` : 'Ein schlichtes Fest.' }));
    if (p.eigen) box.append(el('div', { class: 'evv-knoepfe' }, el('button', { type: 'button', class: 'hm-knopf', onclick: () => oeffnen(), text: 'Fest ändern oder absagen' })));
    return box;
  }
  // Unterste Zeile des Wetterberichts: angesetztes Fest weiter weg, oder Knopf zum Planen
  function berichtZeile(letzter = 0) {
    const s = st();
    const k = stand();
    if (!s || !k || k.grund === 'stufe' || k.grund === 'winter') return null;
    const row = el('div', { class: 'wp-row event hf-wp' });
    row.append(bild('fest', 24));
    const txt = el('div');
    if (k.angesetzt) {
      if (k.angesetzt.tag <= letzter) return null;      // steht schon oben im Bericht
      txt.append(el('strong', { text: `In ${k.angesetzt.tag - s.day} Tagen: dein Hafenfest` }),
        el('span', { text: k.angesetzt.teile.length ? `Dabei: ${liste(teilNamen(k.angesetzt.teile))}.` : 'Ein schlichtes Fest.' }),
        el('div', { class: 'evv-knoepfe' }, el('button', { type: 'button', class: 'hm-knopf', onclick: () => oeffnen(), text: 'Fest ändern oder absagen' })));
    } else if (k.frei) {
      txt.append(el('strong', { text: 'Eigenes Hafenfest' }), el('span', { text: 'Einmal je Saison: Tag wählen, der Hafen wird voll.' }),
        el('div', { class: 'evv-knoepfe' }, el('button', { type: 'button', class: 'hm-knopf hm-primaer', onclick: () => oeffnen(), text: 'Fest planen' })));
    } else {
      return null;
    }
    row.append(txt);
    return row;
  }

  game.hafenfest = { oeffnen, schliessen, stand, aufgebaut, zeile, berichtZeile, get offen() { return !panel.hidden; } };

  // ------------------------------------------------------------ Aussehen
  const stil = document.createElement('style');
  stil.textContent = `
    #hm-fest-karte { position: absolute; left: 50%; transform: translateX(-50%); z-index: 26; width: min(420px, calc(100% - 32px));
      padding: 10px 12px; color: var(--hm-tinte, #283648); line-height: 1.35; }
    #hm-fest-karte[hidden], #hm-fest-karte.zurueck { display: none; }
    #hm-fest-karte .hf-kopf { display: flex; gap: 10px; align-items: flex-start; text-align: left; }
    #hm-fest-karte .hf-kopf svg, #hm-fest-karte .hf-kopf img { flex: none; width: 24px; height: 24px; image-rendering: pixelated; }
    #hm-fest-karte strong { display: block; font-weight: 600; font-family: var(--hm-pixel, inherit); }
    #hm-fest-karte span { display: block; font-size: max(13px, 0.875rem); }
    .hf-knoepfe { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    .hf-knoepfe .hm-knopf { flex: 1 1 120px; min-height: 44px; }
    #hm-fest-karte .hf-knoepfe { padding-left: 34px; }
    #hm-fest { position: absolute; z-index: 33; left: 50%; transform: translateX(-50%); box-sizing: border-box;
      top: calc(var(--hm-oben, 12px) + var(--hm-knopf, 48px) + 10px);
      width: min(440px, calc(100% - 2 * var(--hm-rand, 12px)));
      max-height: calc(100% - var(--hm-oben, 12px) - var(--hm-knopf, 48px) - var(--hm-unten, 12px) - 112px);
      overflow-y: auto; overscroll-behavior: contain; padding: 10px 14px 12px; color: var(--hm-tinte, #24364a);
      font-size: var(--hm-schrift, 15px); line-height: 1.35; pointer-events: auto; }
    #hm-fest:not(.hm-px) { background: #fffcf6; border: 2px solid #283648; }
    #hm-fest[hidden] { display: none !important; }
    #hm-fest p { margin: 4px 0; }
    .hf-p-kopf { display: flex; align-items: center; gap: 8px; }
    .hf-p-kopf svg, .hf-p-kopf img { width: 24px; height: 24px; image-rendering: pixelated; flex: none; }
    .hf-p-kopf h2 { flex: 1 1 auto; margin: 0; font-family: var(--hm-pixel); font-size: calc(var(--hm-schrift, 15px) + 3px); font-weight: 700; }
    .hf-zu { flex: none; width: 40px; height: 40px; padding: 0; border: 0; background: var(--hm-mulde, #e9dfca);
      color: var(--hm-tinte, #24364a); font-family: var(--hm-pixel); font-size: 24px; line-height: 1; cursor: pointer; }
    #hm-fest h3 { margin: 10px 0 4px; color: var(--hm-tinte-2, #5a6a7c); font-family: var(--hm-pixel); font-size: 13px;
      font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
    .hf-leise { color: var(--hm-tinte-2, #5a6a7c); font-size: 13.5px; }
    .hf-tage { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; }
    .hf-tag { display: grid; justify-items: center; align-content: center; gap: 1px; min-height: 44px; padding: 3px 0;
      border: 0; background: var(--hm-mulde, #e9dfca); color: inherit; font-family: var(--hm-pixel); cursor: pointer;
      box-shadow: inset 0 0 0 2px rgba(36, 54, 74, 0.18); }
    .hf-tag b { font-size: 16px; font-weight: 600; }
    .hf-tag svg, .hf-tag img, .hf-tag .hf-leer { width: 12px; height: 12px; image-rendering: pixelated; }
    .hf-tag.sommer:not(.zu) { background: #f6e7b8; }
    .hf-tag.zu { opacity: 0.45; cursor: default; box-shadow: none; text-decoration: line-through; }
    .hf-tag.an { background: var(--hm-tinte, #24364a) !important; color: #fffcf6; box-shadow: none; }
    .hf-tag.an svg { filter: invert(1); }
    .hf-teile { display: grid; gap: 4px; }
    .hf-teil { display: flex; align-items: center; gap: 8px; width: 100%; min-height: 48px; padding: 6px 8px; text-align: left;
      border: 0; background: transparent; color: inherit; font: inherit; cursor: pointer; box-shadow: inset 0 0 0 2px rgba(36, 54, 74, 0.18); }
    .hf-teil.an { background: #f6e7b8; box-shadow: inset 0 0 0 2px var(--hm-tinte, #24364a); }
    .hf-haken { flex: none; width: 16px; height: 16px; box-shadow: inset 0 0 0 2px var(--hm-tinte, #24364a); background: #fffcf6; }
    .hf-teil.an .hf-haken { background: var(--hm-tinte, #24364a); box-shadow: inset 0 0 0 4px #fffcf6, 0 0 0 2px var(--hm-tinte, #24364a); }
    .hf-teil-text { flex: 1 1 auto; display: grid; }
    .hf-teil-text b { font-family: var(--hm-pixel); font-weight: 600; }
    .hf-teil-text small { font-size: 12.5px; color: var(--hm-tinte-2, #5a6a7c); }
    .hf-teil em { flex: none; font-style: normal; font-family: var(--hm-pixel); font-variant-numeric: tabular-nums; }
    .hf-summe { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px 10px; margin-top: 6px; padding-top: 6px;
      border-top: 2px dotted var(--hm-mulde, #e9dfca); font-size: 13.5px; }
    .hf-summe b { font-family: var(--hm-pixel); font-size: 15px; }
    .hf-hinweis { padding: 4px 6px; background: #fbe3d9; font-size: 13.5px; }
    .hf-fuss { position: sticky; bottom: -12px; margin: 6px -14px -12px; padding: 0 14px 12px; background: var(--hm-papier, #fffcf6); }
    .hf-fuss .hf-summe { margin-top: 0; }
    @media (max-width: 599px) {
      #hm-fest-karte { padding: 8px 10px; }
      #hm-fest-karte .hf-knoepfe { padding-left: 0; margin-top: 6px; }
      #hm-fest { padding: 8px 10px 10px; }
      .hf-fuss { bottom: -10px; margin: 6px -10px -10px; padding: 0 10px 10px; }
      .hf-teil { min-height: 44px; padding: 4px 8px; }
      .hf-teil-text small { font-size: 12px; line-height: 1.25; }
      .hf-tag { min-height: 40px; }
      #hm-fest h3 { margin: 6px 0 3px; }
    }
    @media (max-height: 460px) {
      #hm-fest { max-height: calc(100% - var(--hm-oben, 12px) - 16px); top: var(--hm-oben, 12px); }
      .hf-fuss .hf-summe span { display: none; }
      .hf-fuss .hf-knoepfe { margin-top: 4px; }
    }
    #weather-panel .hf-wp .hm-knopf { min-height: 44px; }
  `;
  document.head.append(stil);

  // ------------------------------------------------------------ Fest im Hafen (3D)
  import('../render/fest-deko.js').then((m) => m.init(game)).catch((err) => console.info('Festschmuck nicht geladen:', err?.message ?? err));
  setTimeout(pruefeAufbau, 0);
}
