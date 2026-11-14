// Winter mit Inhalt (Roadmap P20: G4, F14, I10, Ü19). Beschreibung: docs/winter.md.
//
// Am ersten Wintertag kommt die Karte "Winterpause":
// - Bilanz der Saison: Einnahmen, Ausgaben, angelegte Gäste, Bewertungen, weitergefahrene Boote, Ruf, bester Tag.
// - Winterarbeiten: zwei bis drei Aufträge zur Wahl (ECONOMY.winterarbeiten). Jeder wirkt die ganze
//   nächste Saison: einen Steg überholen (Gäste dort bewerten besser), Frühjahrswerbung (mehr Boote im
//   Frühling), Sanitär winterfest (Gäste mit Wunsch Toilette oder Dusche bewerten besser), Hafenbecken
//   ausbaggern (mehr große Boote, ab Stufe 3).
// - Nächste Saison: Ausbauziel und Dauerlieger mit Vertrag.
// - "Winter überspringen" spult bis zum ersten Frühlingsmorgen vor (Winterlager verdient trotzdem).
// Im Winter steht links der Knopf "Winterpause", der die Karte wieder öffnet. Am ersten Saisontag
// sagt eine kleine Karte, welche Winterarbeiten jetzt wirken.
//
// Die Logik (alles außer init) läuft ohne Browser und ist in tests/winter.test.mjs getestet.
// Spielstand: state.modules.winter = { auftraege: [{ id, steg?, fuer, kosten }], gesehen: Jahr, fruehling: Jahr }
//   fuer = Saison (Jahr), in der der Auftrag wirkt. Ältere Aufträge räumt der Frühling weg.
// Wirkung über die Hooks der Spielregeln: 'modifiers' (Ankünfte, Größen) und 'rating' (Anker).
// Ereignisse: winter:auftrag { id, kosten }, winter:uebersprungen { jahr }.
// Schnittstelle: game.winter = { oeffnen(), schliessen(), offen(), springt, angebote(), auftraege() }

import * as sim from '../sim.js';
import { ECONOMY } from '../data/economy.js';
import { HAFEN } from '../data/harbor.js';
import { regelnBereit } from './regeln-bereit.js';
import { VORRANG } from '../ui/meldungen.js';

export const ARBEITEN = ECONOMY.winterarbeiten;

const euro = (n) => `${Math.round(n).toLocaleString('de-DE')} €`;
const anker = (n) => n.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function winterState(state) {
  state.modules ||= {};
  const w = (state.modules.winter ||= {});
  w.auftraege ||= [];
  return w;
}

function stegName(id) {
  return HAFEN.stege?.[id] ?? `Steg ${id}`;
}

/** Stege mit Gastplätzen in der aktuellen Stufe, die meisten Plätze zuerst. */
export function gastStege(state, ctx) {
  const zahl = {};
  for (const b of ctx.berths) {
    if (b.reserved || !b.jetty || !sim.berthAvailable(state, b)) continue;
    zahl[b.jetty] = (zahl[b.jetty] || 0) + 1;
  }
  return Object.entries(zahl).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([id, n]) => ({ id, name: stegName(id), plaetze: n }));
}

/**
 * Aufträge, die in diesem Winter zur Wahl liegen (für die Saison jahr + 1). Ohne Zufall: Der Steg wechselt
 * von Jahr zu Jahr zwischen den beiden größten, Sanitär und Ausbaggern wechseln sich ab Stufe 3 ab.
 */
export function angebote(state, ctx) {
  const sea = sim.season(state, ctx);
  const jahr = sea.year;
  const fuer = jahr + 1;
  const i = Math.max(0, Math.min(5, (state.stage || 1) - 1));
  const liste = [];
  const stege = gastStege(state, ctx);
  if (stege.length) {
    const s = stege[(jahr - 1) % Math.min(2, stege.length)];
    liste.push({ id: 'steg', steg: s.id, fuer, kosten: ARBEITEN.steg.kosten[i],
      name: `${s.name} überholen`,
      text: `Neue Bohlen, Leinen und Fender. Gäste an diesem Steg bewerten die ganze Saison ${anker(ARBEITEN.steg.bonus)} Anker besser (${s.plaetze} Plätze).` });
  }
  liste.push({ id: 'werbung', fuer, kosten: ARBEITEN.werbung.kosten[i],
    name: 'Frühjahrswerbung in Segelvereinen',
    text: `Im Frühling (Saisontag 1 bis ${ARBEITEN.werbung.bisTag}) kommen ${Math.round((ARBEITEN.werbung.faktor - 1) * 100)} % mehr Boote.` });
  const sanitaer = (state.facilities?.wc || 0) > 0 || (state.facilities?.dusche || 0) > 0;
  const baggern = (state.stage || 1) >= ARBEITEN.baggern.abStufe && ARBEITEN.baggern.kosten[i] > 0;
  const dritte = baggern && (!sanitaer || jahr % 2 === 0) ? 'baggern' : sanitaer ? 'sanitaer' : null;
  if (dritte === 'baggern') {
    liste.push({ id: 'baggern', fuer, kosten: ARBEITEN.baggern.kosten[i],
      name: 'Hafenbecken ausbaggern',
      text: `Mehr Wasser unter dem Kiel: Boote der Größe ${ARBEITEN.baggern.klassen.join(' und ')} kommen die ganze Saison ${Math.round((ARBEITEN.baggern.faktor - 1) * 100)} % öfter.` });
  } else if (dritte === 'sanitaer') {
    liste.push({ id: 'sanitaer', fuer, kosten: ARBEITEN.sanitaer.kosten[i],
      name: 'Sanitär winterfest machen',
      text: `Leitungen, Fliesen, warmes Wasser: Gäste, die Toilette oder Dusche wollen, bewerten die ganze Saison ${anker(ARBEITEN.sanitaer.bonus)} Anker besser.` });
  }
  return liste;
}

/** Kurzer Text, was ein Auftrag in der Saison bewirkt (für den Gruß zum Saisonbeginn). */
export function fertigText(a) {
  if (a.id === 'steg') return `${stegName(a.steg)} überholt: ${anker(ARBEITEN.steg.bonus)} Anker mehr für Gäste dort`;
  if (a.id === 'werbung') return `Frühjahrswerbung: mehr Boote bis Saisontag ${ARBEITEN.werbung.bisTag}`;
  if (a.id === 'sanitaer') return `Sanitär winterfest: ${anker(ARBEITEN.sanitaer.bonus)} Anker mehr für Gäste mit Wunsch Toilette oder Dusche`;
  if (a.id === 'baggern') return `Hafenbecken ausgebaggert: mehr Boote der Größe ${ARBEITEN.baggern.klassen.join(' und ')}`;
  return a.name ?? a.id;
}

export function beauftragt(state, a) {
  return winterState(state).auftraege.some((x) => x.id === a.id && x.fuer === a.fuer && (x.steg ?? null) === (a.steg ?? null));
}

/**
 * Auftrag erteilen. bezahle(kosten) bucht die Ausgabe (Browser: game.sim.spend(kosten, 'winter')).
 * Gibt { ok, grund? } zurück: grund 'sommer' (nur im Winter), 'schon', 'geld'.
 */
export function beauftrage(state, ctx, id, bezahle = (k) => sim.spend(state, k, 'winter')) {
  if (!sim.season(state, ctx).winter) return { ok: false, grund: 'sommer' };
  const a = angebote(state, ctx).find((x) => x.id === id);
  if (!a) return { ok: false, grund: 'unbekannt' };
  if (beauftragt(state, a)) return { ok: false, grund: 'schon' };
  if (state.money < a.kosten || !bezahle(a.kosten)) return { ok: false, grund: 'geld' };
  winterState(state).auftraege.push({ id: a.id, ...(a.steg ? { steg: a.steg } : {}), fuer: a.fuer, kosten: a.kosten, name: a.name });
  return { ok: true, auftrag: a };
}

/** Aufträge, die in der laufenden Saison wirken (im Winter keine). */
export function aktiveAuftraege(state, ctx) {
  const sea = sim.season(state, ctx);
  if (sea.winter) return [];
  return winterState(state).auftraege.filter((a) => a.fuer === sea.year);
}

/** Modifikator für die Spielregeln (Hook 'modifiers'). */
export function modifikator(state, ctx) {
  const sea = sim.season(state, ctx);
  if (sea.winter) return null;
  const m = {};
  for (const a of aktiveAuftraege(state, ctx)) {
    if (a.id === 'werbung' && sea.day <= ARBEITEN.werbung.bisTag) m.arrivalFactor = (m.arrivalFactor ?? 1) * ARBEITEN.werbung.faktor;
    if (a.id === 'baggern') {
      m.sizeFactor ||= {};
      for (const k of ARBEITEN.baggern.klassen) m.sizeFactor[k] = (m.sizeFactor[k] ?? 1) * ARBEITEN.baggern.faktor;
    }
  }
  return Object.keys(m).length ? m : null;
}

/** Anker dazu für eine Bewertung (Hook 'rating'). */
export function ankerBonus(state, ctx, boat) {
  let bonus = 0;
  for (const a of aktiveAuftraege(state, ctx)) {
    if (a.id === 'steg' && ctx.berthById[boat.berthId]?.jetty === a.steg) bonus += ARBEITEN.steg.bonus;
    if (a.id === 'sanitaer' && (boat.wishes || []).some((w) => ARBEITEN.sanitaer.wuensche.includes(w))) bonus += ARBEITEN.sanitaer.bonus;
  }
  return bonus;
}

/** Im Frühling: Aufträge vergangener Saisons wegräumen. */
export function aufraeumen(state, ctx) {
  const sea = sim.season(state, ctx);
  const w = winterState(state);
  w.auftraege = w.auftraege.filter((a) => a.fuer >= sea.year);
}

/**
 * Bilanz der Saison aus state.stats.verlauf (die letzten 30 Tage, also genau eine Saison).
 * jahr: die Saison; ohne Angabe die gerade zu Ende gegangene (im Winter) oder laufende.
 */
export function saisonBilanz(state, ctx, jahr = sim.season(state, ctx).year) {
  const { seasonDays, winterDays } = ctx.rules;
  const von = (jahr - 1) * (seasonDays + winterDays) + 1;
  const bis = von + seasonDays - 1;
  const tage = (state.stats?.verlauf || []).filter((t) => t && t.tag >= von && t.tag <= bis);
  const sum = (f) => tage.reduce((a, t) => a + (Number(f(t)) || 0), 0);
  const abgereist = sum((t) => t.abgereist);
  const bewertet = sum((t) => (t.bewertung != null ? t.bewertung * t.abgereist : 0));
  let best = null;
  for (const t of tage) if ((t.summe || 0) > 0 && (!best || t.summe > best.summe)) best = { tag: t.tag - von + 1, summe: t.summe };
  return {
    jahr, tage: tage.length,
    einnahmen: sum((t) => t.summe),
    ausgaben: sum((t) => t.ausgabenSumme),
    angelegt: sum((t) => t.angelegt),
    abgereist,
    bewertung: abgereist ? Math.round((bewertet / abgereist) * 10) / 10 : null,
    weggefahren: sum((t) => t.weggefahrenSumme),
    ruf: tage.length ? { vorher: tage[0].ruf?.vorher ?? null, nachher: tage[tage.length - 1].ruf?.nachher ?? null } : null,
    besterTag: best,
  };
}

/** Hooks in einen Regel-Kontext hängen (Browser über game.sim.addHook, Tests über sim.addHook). */
export function haengeEin(addHook, getState) {
  const ab = [
    addHook('modifiers', (state, ctx) => modifikator(state, ctx)),
    addHook('rating', ({ ctx, boat }) => { const s = getState(); return s ? ankerBonus(s, ctx, boat) : 0; }),
  ];
  return () => ab.forEach((f) => f());
}

// ---------------------------------------------------------------------------
// Im Browser

function el(tag, attrs = {}, ...kinder) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'text') e.textContent = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kinder.flat()) if (k != null && k !== false) e.append(k);
  return e;
}

export async function init(game) {
  const schnittstelle = game.winter = { oeffnen() {}, schliessen() {}, offen: () => false, springt: false, angebote: () => [], auftraege: () => [] };
  const api = await regelnBereit(game);
  const st = () => api.state;
  const ctx = () => api.ctx;
  haengeEin(api.addHook, st);

  if (!document.getElementById('hm-winter-css')) {
    document.head.append(el('link', { id: 'hm-winter-css', rel: 'stylesheet', href: new URL('../../css/winter.css', import.meta.url).href }));
  }
  const host = document.getElementById('game') ?? document.body;
  const karte = el('section', { id: 'hm-winter', class: 'hm-wi hm-px', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'hm-wi-titel', hidden: true });
  host.append(karte);
  const knopf = el('button', { type: 'button', class: 'hm-px hm-chip hm-winter-knopf', hidden: true, onclick: () => (offen ? schliessen() : oeffnen()) },
    el('i', { class: 'hm-sym', 'aria-hidden': 'true', style: '--sym: var(--px-schnee, var(--px-flagge))' }),
    el('span', { class: 'hm-chip-text', text: 'Winterpause' }));
  const haengeKnopf = () => {
    const seite = document.getElementById('hm-seite');
    if (seite && knopf.parentElement !== seite) seite.append(knopf);
  };

  let offen = false;      // Karte soll stehen (sichtbar, sobald die Meldungs-Ordnung es erlaubt)
  let art = 'winter';     // 'winter' oder 'fruehling'
  let meldung = '';
  let fruehlingRest = 0;
  let letzterTakt = performance.now();

  const winter = () => sim.season(st(), ctx()).winter;
  const jahr = () => sim.season(st(), ctx()).year;

  function oeffnen(was = winter() ? 'winter' : 'fruehling') {
    art = was;
    offen = true;
    meldung = '';
    game.meldungen?.wunsch('winter', VORRANG.winter ?? 75);
    zeichne();
    takt();
  }
  function schliessen() {
    if (!offen) return;
    offen = false;
    karte.hidden = true;
    game.meldungen?.fertig('winter');
  }

  function zeile(name, wert, klasse = '') {
    return el('div', { class: `hm-wi-zeile ${klasse}` }, el('span', { text: name }), el('b', { text: wert }));
  }

  function zeichne() {
    if (!offen) return;
    const s = st();
    const c = ctx();
    if (art === 'fruehling') {
      const aktiv = aktiveAuftraege(s, c);
      karte.replaceChildren(
        el('div', { class: 'hm-wi-kopf' }, el('h2', { id: 'hm-wi-titel', text: 'Winterarbeiten fertig' })),
        el('p', { class: 'hm-wi-leise', text: `Das wirkt jetzt in Saison ${jahr()}:` }),
        el('ul', { class: 'hm-wi-liste' }, aktiv.map((a) => el('li', { text: fertigText(a) }))),
        el('div', { class: 'hm-wi-knoepfe' }, el('button', { type: 'button', class: 'hm-knopf hm-primaer hm-px hm-wi-ja', onclick: schliessen, text: 'Los geht’s' })),
      );
      return;
    }
    const b = saisonBilanz(s, c);
    const liste = angebote(s, c);
    const geld = s.money;
    const ziel = api.canAdvanceStage?.();
    const dauer = Object.values(s.modules?.dauer?.plaetze || {});
    const vertraege = dauer.filter((p) => !p.kuendigung).length;
    const winterTag = sim.season(s, c).day - c.rules.seasonDays;
    const bilanz = b.tage ? el('div', { class: 'hm-wi-block' },
      el('h3', { text: `Saison ${b.jahr}` }),
      zeile('Einnahmen', euro(b.einnahmen)),
      b.ausgaben > 0 ? zeile('Ausgaben', `− ${euro(b.ausgaben)}`) : null,
      zeile('Gäste angelegt', String(b.angelegt)),
      b.bewertung != null ? zeile('Bewertung im Schnitt', `${anker(b.bewertung)} Anker`) : null,
      b.weggefahren > 0 ? zeile('Weitergefahren', `${b.weggefahren} Boote`, 'leise') : null,
      b.ruf?.vorher != null && b.ruf?.nachher != null ? zeile('Ruf', `${anker(b.ruf.vorher)} auf ${anker(b.ruf.nachher)}`) : null,
      b.besterTag ? zeile('Bester Tag', `Tag ${b.besterTag.tag}, ${euro(b.besterTag.summe)}`, 'leise') : null,
    ) : null;
    const arbeiten = el('div', { class: 'hm-wi-block' },
      el('h3', { text: 'Winterarbeiten' }),
      el('p', { class: 'hm-wi-leise', text: `Fertig zum Frühling, wirken in Saison ${jahr() + 1}. Kasse ${euro(geld)}.` }),
      liste.map((a) => {
        const schon = beauftragt(s, a);
        const teuer = !schon && a.kosten > geld;
        return el('div', { class: `hm-wi-auftrag${schon ? ' an' : ''}`, 'data-auftrag': a.id },
          el('div', { class: 'hm-wi-auftrag-kopf' }, el('b', { text: a.name }), el('span', { text: euro(a.kosten) })),
          el('p', { text: a.text }),
          el('button', { type: 'button', class: `hm-knopf hm-px hm-wi-auftrag-knopf${schon || teuer ? '' : ' hm-primaer'}`, disabled: schon || teuer,
            onclick: () => auftrag(a.id) }, schon ? 'Beauftragt' : teuer ? `Noch ${euro(a.kosten - geld)} sparen` : `Beauftragen für ${euro(a.kosten)}`));
      }),
      meldung ? el('p', { class: 'hm-wi-meldung', role: 'status', text: meldung }) : null,
    );
    const naechste = el('div', { class: 'hm-wi-block' },
      el('h3', { text: 'Nächste Saison' }),
      ziel?.goal ? zeile('Nächster Ausbau', ziel.goal.name ?? 'Hafen erweitern') : null,
      vertraege ? zeile('Dauerlieger mit Vertrag', String(vertraege)) : null,
      zeile('Winter', `Tag ${winterTag} von ${c.rules.winterDays}`, 'leise'),
    );
    karte.replaceChildren(
      el('div', { class: 'hm-wi-kopf' },
        el('h2', { id: 'hm-wi-titel', text: `Winterpause, Jahr ${jahr()}` }),
        el('button', { type: 'button', class: 'hm-wi-zu', 'aria-label': 'Schließen', onclick: schliessen, text: '×' })),
      el('p', { class: 'hm-wi-leise', text: 'Keine Gäste bis zum Frühling. Zeit, Bilanz zu ziehen und die nächste Saison vorzubereiten.' }),
      bilanz, arbeiten, naechste,
      el('div', { class: 'hm-wi-knoepfe' },
        el('button', { type: 'button', class: 'hm-knopf hm-primaer hm-px hm-wi-ja', onclick: ueberspringe, text: 'Winter überspringen' }),
        el('button', { type: 'button', class: 'hm-knopf hm-px', onclick: schliessen, text: 'Hafen ansehen' })),
    );
  }

  function auftrag(id) {
    const r = beauftrage(st(), ctx(), id, (k) => api.spend(k, 'winter'));
    if (r.ok) {
      meldung = `${r.auftrag.name}: beauftragt.`;
      game.audio?.sfx?.('bauen');
      game.emit('winter:auftrag', { id, kosten: r.auftrag.kosten });
      game.emit('sim:change', { reason: 'winter' });
    } else {
      meldung = r.grund === 'geld' ? 'Dafür reicht das Geld noch nicht.' : 'Das geht gerade nicht.';
      game.audio?.sfx?.('fehler');
    }
    zeichne();
  }

  // Ü19: Winter überspringen. Spult Tag für Tag bis zum ersten Frühlingsmorgen (die Nächte laufen ganz
  // normal, Winterlager und Werft verdienen). Der Tagesabschluss bleibt dabei still (game.winter.springt).
  function ueberspringe() {
    const vorher = jahr();
    schliessen();
    schnittstelle.springt = true;
    try {
      for (let i = 0; i < 4 * (ctx().rules.winterDays + 1) && winter(); i++) api.fastForward(1e6);
    } finally {
      schnittstelle.springt = false;
    }
    game.emit('winter:uebersprungen', { jahr: vorher });
    game.emit('sim:change', { reason: 'winter' });
  }

  // Die Karte endet über Zeit, Kassieren und Bauen (je nachdem, was unter ihr liegt)
  function passeHoeheAn() {
    const h = host.getBoundingClientRect();
    const k = karte.getBoundingClientRect();
    let unten = h.bottom - 8;
    for (const sel of ['#hm-zeit', '#btn-build', '#btn-collect', '#hud-bottom']) {
      const e = document.querySelector(sel);
      if (!e || e.offsetParent === null) continue;
      const r = e.getBoundingClientRect();
      if (r.width && r.right > k.left && r.left < k.right && r.top > k.top + 80) unten = Math.min(unten, r.top - 10);
    }
    const max = Math.max(160, Math.round(unten - k.top));
    if (karte.style.maxHeight !== `${max}px`) karte.style.maxHeight = `${max}px`;
  }

  function takt() {
    // Erster Blick auf diesen Winter (auch nach dem Laden oder wenn die Zeit steht): Karte von selbst
    if (winter() && !schnittstelle.springt) {
      const w = winterState(st());
      if (w.gesehen !== jahr()) { w.gesehen = jahr(); oeffnen('winter'); return; }
    }
    knopf.hidden = !winter();
    if (!knopf.hidden) haengeKnopf();
    knopf.setAttribute('aria-pressed', offen && art === 'winter' ? 'true' : 'false');
    if (!offen) { karte.hidden = true; return; }
    if (art === 'winter' && !winter()) { schliessen(); return; }
    const darf = !game.meldungen || game.meldungen.darf('winter');
    const ruhig = !document.body.classList.contains('foto') && !document.body.classList.contains('building');
    karte.hidden = !(darf && ruhig);
    if (!karte.hidden) passeHoeheAn();
    // Der Gruß zum Saisonbeginn steht 20 s, gezählt nur, solange er zu sehen ist
    const jetzt = performance.now();
    if (art === 'fruehling' && !karte.hidden) {
      fruehlingRest -= jetzt - letzterTakt;
      if (fruehlingRest <= 0) { letzterTakt = jetzt; schliessen(); return; }
    }
    letzterTakt = jetzt;
  }
  setInterval(takt, 250);
  game.on('meldungen:wechsel', takt);

  // Morgens: erster Wintertag zeigt die Karte von selbst (einmal pro Winter), erster Saisontag den Frühlingsgruß
  game.on('day:start', () => {
    const s = st();
    const sea = sim.season(s, ctx());
    const w = winterState(s);
    if (sea.winter && w.gesehen !== sea.year) {
      if (!schnittstelle.springt) { w.gesehen = sea.year; oeffnen('winter'); }
    } else if (!sea.winter) {
      if (art === 'winter') schliessen();
      if (sea.day === 1 && w.fruehling !== sea.year) {
        w.fruehling = sea.year;
        aufraeumen(s, ctx());
        if (aktiveAuftraege(s, ctx()).length) { fruehlingRest = 20000; oeffnen('fruehling'); }
      }
    }
    takt();
  });
  game.on('sim:change', () => { if (offen) zeichne(); });
  game.on('spielstand-geladen', () => { schliessen(); takt(); });

  Object.assign(schnittstelle, {
    oeffnen: () => oeffnen(),
    schliessen,
    offen: () => offen && !karte.hidden,
    angebote: () => angebote(st(), ctx()),
    auftraege: () => [...winterState(st()).auftraege],
  });
  takt();
}
