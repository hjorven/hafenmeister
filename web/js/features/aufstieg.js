// Aufstieg und Abschluss feiern, Endlosspiel mit Saisonzielen (Paket P16, docs/aufstieg.md).
//
// - Stufenaufstieg: Kamerafahrt über den Hafen, Titel der neuen Stufe, Zahlen der abgeschlossenen
//   Stufe (Tage, Gäste, Einnahmen, bester Tag, Ruf) und was neu ist (Plätze, Bootsgrößen, Bauten).
// - Abschluss der Region: größere Feier mit Titel "Hafenmeister der Ostsee", Zahlen der ganzen
//   Region, Chronik aller Stufen und "Weiterspielen".
// - Danach Endlosspiel: jede Saison vier Saisonziele (Gäste, Ruf, große Schiffe und abwechselnd
//   Einnahmen oder XL-Gäste). Am Saisonende Bilanz mit Sternen, Belohnung und Rang.
//
// Die Regeln (ohne init) laufen ohne Browser: tests/aufstieg.test.mjs.
// Spielstand: state.modules.aufstieg = {
//   chronik: { [stufe]: { abTag, gaeste, einnahmen, besterTag, besterRuf } }   Stand bei Stufenbeginn
//   stufen: [{ stufe, abTag, bisTag, gaeste, einnahmen, besterTag, ruf }]        abgeschlossene Stufen
//   xl: abgereiste XL-Gäste insgesamt
//   endlos: null | { saison, jahr, wartet, anteil, start, ziele: [{ art, soll }], sterne, bilanz: [] }
// }
// Ereignisse (über game.sim.dispatch, also als 'sim:<type>'):
//   'seasonEnd' { jahr, saison, ziele: [{ art, soll, ist, ok }], sterne, belohnung, rang, neuerRang }
//   'seasonStart' { jahr, saison, ziele }
// Zahlen: ECONOMY.endlos (web/js/data/economy.js).

import * as sim from '../sim.js';
import { ECONOMY } from '../data/economy.js';
import { SERVICES } from '../data/services.js';
import { regelnBereit } from './regeln-bereit.js';
import { pixelBild } from '../ui/pixel-symbole.js';

const E = () => ECONOMY.endlos || {};

export const ZIEL_NAMEN = {
  gaeste: 'Gäste in dieser Saison',
  ruf: 'Ruf am Saisonende',
  grossschiffe: 'Besuche großer Schiffe',
  einnahmen: 'Einnahmen in dieser Saison',
  xl: 'Gäste der Größe XL',
};

export const REGION_NAMEN = { ostsee: 'Ostsee', nordsee: 'Nordsee' };

export function aufstiegState(state) {
  state.modules ||= {};
  const m = (state.modules.aufstieg ||= {});
  m.chronik ||= {};
  m.stufen ||= [];
  m.xl ||= 0;
  if (m.endlos === undefined) m.endlos = null;
  return m;
}

function stand(state) {
  return {
    abTag: state.day,
    gaeste: state.guests || 0,
    einnahmen: state.stats?.totalIncome || 0,
    besterTag: 0,
    besterRuf: sim.reputation(state),
    // Einnahmen, die am ersten Tag der Stufe schon vor dem Aufstieg kamen: gehören zur alten Stufe
    tagSchon: state.stats?.dayIncome || 0,
  };
}

/** Einnahmen des laufenden Tages, die in die Stufe c fallen. */
function heuteInStufe(state, c) {
  const heute = state.stats?.dayIncome || 0;
  return Math.max(0, heute - (c && c.abTag === state.day ? c.tagSchon || 0 : 0));
}

/**
 * Stand zu Beginn der aktuellen Stufe sicherstellen. Ein neues Spiel beginnt Stufe 1 an Tag 1
 * bei null; wird ein alter Spielstand geladen, zählt die Stufe ab dem Laden (abTag sagt es).
 */
export function sichereChronik(state) {
  const m = aufstiegState(state);
  if (!m.chronik[state.stage]) {
    m.chronik[state.stage] = state.stage === 1 && state.day === 1 && !state.guests
      ? { abTag: 1, gaeste: 0, einnahmen: 0, besterTag: 0, besterRuf: sim.reputation(state) }
      : stand(state);
  }
  return m.chronik[state.stage];
}

/** Abend für Abend: bester Tag und bester Ruf der laufenden Stufe. */
export function merkeTag(state) {
  const c = sichereChronik(state);
  c.besterTag = Math.max(c.besterTag || 0, heuteInStufe(state, c));
  c.besterRuf = Math.max(c.besterRuf || 0, sim.reputation(state));
}

/**
 * Stufe abgeschlossen (Hook 'stageUp'): Zahlen der alten Stufe festhalten, neue Stufe beginnt.
 * Gibt den Eintrag der abgeschlossenen Stufe zurück.
 */
export function stufeAbschliessen(state, from, to) {
  const m = aufstiegState(state);
  const c = m.chronik[from] || (from === 1 ? { abTag: 1, gaeste: 0, einnahmen: 0, besterTag: 0, besterRuf: 0 } : null);
  const eintrag = {
    stufe: from,
    abTag: c?.abTag ?? null,
    bisTag: state.day,
    gaeste: c ? (state.guests || 0) - c.gaeste : null,
    einnahmen: c ? (state.stats?.totalIncome || 0) - c.einnahmen : null,
    besterTag: Math.max(c?.besterTag || 0, heuteInStufe(state, c)),
    ruf: sim.reputation(state),
  };
  m.stufen = m.stufen.filter((s) => s.stufe !== from);
  m.stufen.push(eintrag);
  m.stufen.sort((a, b) => a.stufe - b.stufe);
  m.chronik[to] = stand(state);
  return eintrag;
}

// ---------------------------------------------------------------------------- Endlosspiel

function zahlenAb(state) {
  const m = aufstiegState(state);
  return {
    gaeste: state.guests || 0,
    einnahmen: state.stats?.totalIncome || 0,
    grossschiffe: state.bigVisits || 0,
    xl: m.xl || 0,
  };
}

const rund = (x, auf) => Math.max(1, Math.ceil(x / auf) * auf);

/** Saisonziele für die n-te Saison des Endlosspiels (n ab 1), anteil < 1 bei spätem Beginn. */
export function zieleFuer(n, anteil = 1) {
  const z = E().ziele || {};
  const wert = (k) => {
    const d = z[k];
    if (!d) return null;
    return Math.min(d.max ?? Infinity, d.start + (d.jeSaison || 0) * (n - 1));
  };
  const liste = [];
  if (z.gaeste) liste.push({ art: 'gaeste', soll: rund(wert('gaeste') * anteil, 10) });
  if (z.ruf) liste.push({ art: 'ruf', soll: Math.round(wert('ruf') * 100) / 100 });
  if (z.grossschiffe) liste.push({ art: 'grossschiffe', soll: rund(wert('grossschiffe') * anteil, 1) });
  const vierte = n % 2 === 1 ? 'einnahmen' : 'xl';
  if (z[vierte]) liste.push({ art: vierte, soll: rund(wert(vierte) * anteil, vierte === 'einnahmen' ? 1000 : 5) });
  return liste;
}

/** Rang zu einer Zahl Sterne. */
export function rang(sterne) {
  const liste = E().raenge || [{ sterne: 0, titel: 'Hafenmeister' }];
  let r = liste[0];
  for (const x of liste) if (sterne >= x.sterne) r = x;
  const i = liste.indexOf(r);
  return { titel: r.titel, naechster: liste[i + 1] || null };
}

function beginneSaison(state, ctx, e, anteil, events) {
  e.saison = (e.saison || 0) + 1;
  e.jahr = sim.season(state, ctx).year + (e.wartet ? 1 : 0);
  e.wartet = false;
  e.anteil = anteil;
  e.start = zahlenAb(state);
  e.ziele = zieleFuer(e.saison, anteil);
  events?.push({ type: 'seasonStart', jahr: e.jahr, saison: e.saison, ziele: e.ziele.map((z) => ({ ...z })) });
}

/**
 * Region abgeschlossen: Endlosspiel beginnt. Mitten in der Saison gelten die Zählziele anteilig;
 * bleiben weniger als ECONOMY.endlos.mindestTage, beginnen sie mit der nächsten Saison.
 */
export function starteEndlos(state, ctx) {
  const m = aufstiegState(state);
  if (m.endlos) return m.endlos;
  const sea = sim.season(state, ctx);
  const tage = ctx.rules.seasonDays;
  const rest = sea.winter ? 0 : tage - sea.day + 1;
  const e = { saison: 0, jahr: sea.year, wartet: false, anteil: 1, start: null, ziele: [], sterne: 0, bilanz: [] };
  m.endlos = e;
  if (rest >= (E().mindestTage ?? 8)) beginneSaison(state, ctx, e, Math.min(1, rest / tage));
  else e.wartet = true;
  return e;
}

/** Stand der laufenden Saisonziele: { aktiv, wartet, ziele: [{ art, soll, ist, ok }], tageRest, ... } */
export function saisonStand(state, ctx) {
  const m = aufstiegState(state);
  const e = m.endlos;
  if (!e) return { aktiv: false };
  const sea = sim.season(state, ctx);
  const tage = ctx.rules.seasonDays;
  const winter = ctx.rules.winterDays || 0;
  const r = rang(e.sterne || 0);
  const basis = { aktiv: true, saison: e.saison, jahr: e.jahr, sterne: e.sterne || 0, rang: r.titel, naechsterRang: r.naechster, letzte: e.bilanz[e.bilanz.length - 1] || null };
  if (e.wartet || !e.start) {
    // Tage bis zum ersten Tag der nächsten Saison
    const bis = sea.winter ? tage + winter - sea.day + 1 : tage + winter - sea.day + 1;
    return { ...basis, wartet: true, ziele: [], tageBisStart: bis, winter: sea.winter };
  }
  const jetzt = zahlenAb(state);
  const ziele = e.ziele.map((z) => {
    const ist = z.art === 'ruf' ? sim.reputation(state) : jetzt[z.art] - (e.start[z.art] || 0);
    return { ...z, ist, ok: ist >= z.soll };
  });
  return { ...basis, wartet: false, winter: sea.winter, ziele, tageRest: sea.winter ? 0 : tage - sea.day + 1 };
}

/** Saisonende (Abend des letzten Saisontags): Ziele werten, Sterne und Belohnung geben. */
export function werteSaison(state, ctx, events = []) {
  const m = aufstiegState(state);
  const e = m.endlos;
  if (!e || e.wartet || !e.start) return null;
  const st = saisonStand(state, ctx);
  const erreicht = st.ziele.filter((z) => z.ok).length;
  const b = E().belohnung || {};
  const belohnung = erreicht * (b.jeZiel || 0) + (erreicht === st.ziele.length && erreicht > 0 ? (b.alleZiele || 0) : 0);
  const vorher = rang(e.sterne || 0).titel;
  e.sterne = (e.sterne || 0) + erreicht;
  const nachher = rang(e.sterne).titel;
  if (belohnung) state.money += belohnung;
  const eintrag = {
    type: 'seasonEnd', jahr: e.jahr, saison: e.saison, ziele: st.ziele, erreicht, sterne: e.sterne,
    belohnung, rang: nachher, neuerRang: nachher !== vorher ? nachher : null,
  };
  e.bilanz.push({ jahr: e.jahr, saison: e.saison, erreicht, von: st.ziele.length, belohnung });
  if (e.bilanz.length > 50) e.bilanz.shift();
  e.start = null;
  e.ziele = [];
  e.wartet = true;
  events.push(eintrag);
  return eintrag;
}

/**
 * Nacht-Hook: XL-Gäste zählen, besten Tag merken, am letzten Saisontag werten,
 * am letzten Wintertag die nächste Saison beginnen.
 */
export function nacht({ state, ctx, events }) {
  const m = aufstiegState(state);
  for (const ev of events) {
    if (ev.type !== 'departed' || ev.reason === 'rebuild') continue;
    if (ctx.typeById?.[ev.typeId]?.size === 'XL') m.xl++;
  }
  merkeTag(state);
  if (!m.endlos) {
    if (state.regionDone) starteEndlos(state, ctx);
    return;
  }
  const sea = sim.season(state, ctx);
  const tage = ctx.rules.seasonDays;
  const letzterTag = tage + (ctx.rules.winterDays || 0);
  if (sea.day === tage) werteSaison(state, ctx, events);
  if (sea.day === letzterTag && m.endlos.wartet) beginneSaison(state, ctx, m.endlos, 1, events);
}

// ---------------------------------------------------------------------------- Was ist neu

const GROESSE_TEXT = { S: 'kleine Boote (S)', M: 'mittlere Boote (M)', L: 'große Yachten (L)', XL: 'Traditionssegler und Großyachten (XL)', XXL: 'Großschiffe (XXL)' };

/** Was die neue Stufe bringt, aus den Spielzahlen abgeleitet (keine Versprechen, nur was es gibt). */
export function neuInStufe(ctx, from, to) {
  const r = ctx.rules;
  const neu = [];
  const ausbau = r.stageGoals?.[from];
  const plaetze = ausbau?.project ? (r.berthProjects?.[ausbau.project] || []).length : 0;
  if (plaetze) neu.push(`${plaetze} neue Liegeplätze mit dem Ausbau`);
  const stege = (r.jettyProjects || []).filter((p) => p.stage === to);
  if (stege.length) neu.push(`${stege.length} neue Stegprojekte im Baumenü`);
  const vorher = Object.keys(r.sizeMix?.[from] || {});
  for (const g of Object.keys(r.sizeMix?.[to] || {})) {
    if (!vorher.includes(g)) neu.push(`Ab jetzt kommen ${GROESSE_TEXT[g] || g}`);
  }
  const bauten = [];
  for (const [key, f] of Object.entries(r.facilities || {})) {
    for (const [lvl, ab] of Object.entries(f.fromStage || {})) {
      if (ab === to) bauten.push(f.names?.[lvl] || r.facilityNames?.[key] || key);
    }
  }
  for (const s of SERVICES) {
    (s.stufen || []).forEach((st, i) => {
      const ab = st.abStufe ?? s.abStufe;
      if (ab === to) bauten.push(i === 0 ? s.name : st.name);
    });
  }
  const buero = r.office;
  if (buero?.fromStage) {
    for (const [lvl, ab] of Object.entries(buero.fromStage)) if (ab === to && buero.names?.[lvl]) bauten.push(buero.names[lvl]);
  }
  const einzig = [...new Set(bauten)];
  if (einzig.length) neu.push(`Neu zu bauen: ${kurzListe(einzig, 4)}`);
  return neu;
}

function kurzListe(liste, n) {
  if (liste.length <= n) return liste.join(', ');
  return `${liste.slice(0, n).join(', ')} und ${liste.length - n} mehr`;
}

// ============================================================================ Oberfläche

const euro = (n) => `${Math.round(n).toLocaleString('de-DE')} €`;
const ganz = (n) => Math.round(n).toLocaleString('de-DE');
const num1 = (n) => (Math.round(n * 10) / 10).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const num2 = (n) => n.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 2 });

function el(tag, attrs = {}, ...kinder) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kinder.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k)));
  return e;
}

function zielText(z) {
  switch (z.art) {
    case 'ruf': return `${num1(Math.min(z.ist, 5))} von ${num2(z.soll)}`;
    case 'einnahmen': return `${euro(Math.min(z.ist, z.soll))} von ${euro(z.soll)}`;
    default: return `${ganz(Math.min(z.ist, z.soll))} von ${ganz(z.soll)}`;
  }
}

function sollText(z) {
  switch (z.art) {
    case 'gaeste': return `${ganz(z.soll)} Gäste`;
    case 'ruf': return `Ruf ${num2(z.soll)} am Saisonende`;
    case 'grossschiffe': return `${ganz(z.soll)} Besuche großer Schiffe`;
    case 'einnahmen': return `${euro(z.soll)} einnehmen`;
    case 'xl': return `${ganz(z.soll)} Gäste der Größe XL`;
    default: return String(z.soll);
  }
}

// Kamerafahrt: dreht langsam um den Hafen, solange die Feier offen ist, und fährt danach zurück.
// Steuert nur die öffentlichen Felder des Kamera-Rigs (target, viewWidth, yaw, pitch) wie ui/bauen.js.
function kamerafahrt(game, { dauer = 7, drehung = 0.7, zoom = 0.85 } = {}) {
  const rig = game.camera;
  if (!rig?.target) return { ende() {} };
  const ruhig = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hatPitch = typeof rig.pitch === 'number';
  const pose = () => ({ x: rig.target.x, z: rig.target.z, w: rig.viewWidth, yaw: rig.yaw || 0, pitch: hatPitch ? rig.pitch : null });
  const setze = (p) => {
    rig.target.x = p.x; rig.target.z = p.z; rig.viewWidth = p.w; rig.yaw = p.yaw;
    if (hatPitch && p.pitch != null) rig.pitch = p.pitch;
    rig._clamp?.();
    rig._apply?.();
  };
  rig.stop?.();
  const alt = pose();
  // Startansicht (ganzer Hafen) als Ziel: einmal ausrechnen lassen, dann zurück auf die alte Pose
  let heim = alt;
  try { rig.reset(); heim = pose(); } catch { /* alte Pose bleibt Ziel */ }
  setze(alt);
  if (ruhig) {
    setze(heim);
    return { ende() { setze(alt); } };
  }
  const deg = Math.PI / 180;
  const ziel = { ...heim, w: heim.w * 1.05 };
  if (hatPitch) ziel.pitch = Math.max(rig.pitchMin?.(ziel.w) ?? 30 * deg, 38 * deg);
  // kürzester Weg zur Drehung der Startansicht
  const zwei = 2 * Math.PI;
  ziel.yaw = alt.yaw + ((((heim.yaw - alt.yaw) % zwei) + zwei + Math.PI) % zwei - Math.PI);
  const sanft = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const mische = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, w: a.w + (b.w - a.w) * t, yaw: a.yaw + (b.yaw - a.yaw) * t, pitch: a.pitch == null ? null : a.pitch + (b.pitch - a.pitch) * t });
  let t0 = performance.now();
  let modus = 'hin';
  let von = alt;
  let laeuft = true;
  let rueck = null;
  const anfahrt = 1.6;
  const frame = (jetzt) => {
    if (!laeuft) return;
    const t = (jetzt - t0) / 1000;
    if (modus === 'hin') {
      const k = Math.min(1, t / anfahrt);
      setze(mische(von, ziel, sanft(k)));
      if (k >= 1) { modus = 'kreisen'; t0 = jetzt; }
    } else if (modus === 'kreisen') {
      // in der eigentlichen Fahrt dreht und zoomt die Kamera, danach treibt sie ganz langsam weiter
      const k = Math.min(1, t / dauer);
      const drift = Math.max(0, t - dauer) * 0.03;
      setze({ ...ziel, yaw: ziel.yaw + drehung * sanft(k) + drift, w: ziel.w * (1 + (zoom - 1) * sanft(k)) });
    } else if (modus === 'zurueck') {
      const k = Math.min(1, t / 1.2);
      setze(mische(rueck, alt, sanft(k)));
      if (k >= 1) { laeuft = false; return; }
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  // Greift der Spieler selbst zur Kamera, hört die Fahrt auf und er behält seine Ansicht
  const abbruch = () => { if (modus !== 'zurueck') { laeuft = false; } };
  game.canvas?.addEventListener('pointerdown', abbruch, { once: true });
  game.canvas?.addEventListener('wheel', abbruch, { once: true, passive: true });
  return {
    ende() {
      game.canvas?.removeEventListener('pointerdown', abbruch);
      game.canvas?.removeEventListener('wheel', abbruch);
      if (!laeuft) return;
      rueck = pose();
      modus = 'zurueck';
      t0 = performance.now();
    },
  };
}

function wimpelKette(anzahl = 18) {
  const farben = ['#ee6454', '#f2c14e', '#23897d', '#fffaf0', '#2e4560'];
  const kette = el('div', { class: 'hm-feier-wimpel', 'aria-hidden': 'true' });
  for (let i = 0; i < anzahl; i++) {
    kette.append(el('i', { style: `--f:${farben[i % farben.length]};--i:${i}` }));
  }
  return kette;
}

function feuerwerk(anzahl = 5) {
  const box = el('div', { class: 'hm-feier-feuerwerk', 'aria-hidden': 'true' });
  const farben = ['#f2c14e', '#ee6454', '#3fae9f', '#fffaf0'];
  for (let i = 0; i < anzahl; i++) {
    const b = el('span', { class: 'hm-funke', style: `--x:${10 + ((i * 37) % 80)}%;--y:${12 + ((i * 23) % 30)}%;--f:${farben[i % farben.length]};--d:${(i * 0.7).toFixed(1)}s` });
    for (let k = 0; k < 8; k++) b.append(el('i', { style: `--k:${k}` }));
    box.append(b);
  }
  return box;
}

export async function init(game) {
  if (typeof document === 'undefined') return null;
  await regelnBereit(game);
  if (!document.getElementById('hm-aufstieg-css')) {
    const link = document.createElement('link');
    link.id = 'hm-aufstieg-css';
    link.rel = 'stylesheet';
    link.href = new URL('../../css/aufstieg.css', import.meta.url).href;
    document.head.append(link);
  }

  const st = () => game.sim.state;
  const ctx = () => game.sim.ctx;

  // Regeln einhängen
  game.sim.addHook('night', nacht);
  game.sim.addHook('stageUp', ({ state, from, to }) => {
    const e = stufeAbschliessen(state, from, to);
    letzterAbschluss = { eintrag: e, from, to };
  });
  let letzterAbschluss = null;
  sichereChronik(st());
  if (st().regionDone) starteEndlos(st(), ctx());
  game.on('spielstand-geladen', () => { sichereChronik(st()); if (st().regionDone) starteEndlos(st(), ctx()); });
  game.on('sim:change', (e) => { if (e?.reason === 'load') sichereChronik(st()); });

  // ------------------------------------------------------------------ Feier-Fenster
  const schicht = el('div', { id: 'hm-feier', class: 'hm-feier', hidden: true, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'hm-feier-titel' });
  document.body.append(schicht);
  const warteschlange = [];
  let offen = null;
  let schliesse = null;
  // Anderer Spielstand geladen: offene Feier gehört zum alten Stand
  game.on('spielstand-geladen', () => { warteschlange.length = 0; schliesse?.(); });

  function zeige(feier) {
    if (offen) { warteschlange.push(feier); return; }
    offen = feier;
    zahlNr = 0;
    game.bauen?.offen && game.bauen.schliessen?.();
    game.emit('ui:cancel');
    const warPause = !!game.paused;
    if (!warPause) game.setPaused?.(true);
    const fahrt = feier.fahrt ? kamerafahrt(game, feier.fahrt) : null;
    document.body.classList.add('hm-feier-an');
    const knopf = el('button', { type: 'button', class: 'hm-px hm-knopf hm-primaer hm-feier-weiter' }, feier.knopf || 'Weiter');
    // Kopf und Knopf bleiben immer sichtbar, nur der Inhalt dazwischen scrollt (Handy quer)
    const inhalt = el('div', { class: 'hm-feier-inhalt' }, feier.inhalt);
    const karte = el('div', { class: `hm-px hm-feier-karte ${feier.art}` },
      el('div', { class: 'hm-feier-kopfteil' },
        el('p', { class: 'hm-feier-ober' }, feier.ober),
        el('h2', { id: 'hm-feier-titel', class: 'hm-feier-titel' }, feier.titel),
        feier.unter ? el('p', { class: 'hm-feier-unter' }, feier.unter) : null),
      inhalt);
    // "Hafen ansehen": Karte klein machen, damit man die Kamerafahrt in Ruhe sieht
    const ansehen = feier.fahrt ? el('button', { type: 'button', class: 'hm-px hm-knopf hm-feier-ansehen', 'aria-pressed': 'false' }, 'Hafen ansehen') : null;
    ansehen?.addEventListener('click', () => {
      const klein = !karte.classList.contains('klein');
      karte.classList.toggle('klein', klein);
      ansehen.setAttribute('aria-pressed', String(klein));
      ansehen.textContent = klein ? 'Zahlen zeigen' : 'Hafen ansehen';
    });
    karte.append(el('div', { class: 'hm-feier-fuss' }, ansehen, knopf));
    schicht.replaceChildren(...[
      feier.art !== 'saison' ? wimpelKette() : null,
      feier.art === 'region' ? feuerwerk(6) : null,
      karte].filter(Boolean));
    schicht.dataset.art = feier.art;
    schicht.hidden = false;
    game.emit('feier:auf', { art: feier.art });
    const zu = () => {
      if (offen !== feier) return;
      document.removeEventListener('keydown', taste, true);
      schicht.classList.add('zu');
      fahrt?.ende();
      setTimeout(() => {
        schicht.hidden = true;
        schicht.classList.remove('zu');
        schicht.replaceChildren();
        document.body.classList.remove('hm-feier-an');
        offen = null;
        schliesse = null;
        if (!warPause) game.setPaused?.(false);
        game.emit('feier:zu', { art: feier.art });
        feier.danach?.();
        if (warteschlange.length) zeige(warteschlange.shift());
      }, 260);
    };
    const taste = (e) => {
      if (e.key === 'Escape' || ((e.key === 'Enter' || e.key === ' ') && document.activeElement !== ansehen)) { e.preventDefault(); e.stopPropagation(); zu(); }
    };
    schliesse = zu;
    knopf.addEventListener('click', zu);
    document.addEventListener('keydown', taste, true);
    setTimeout(() => knopf.focus({ preventScroll: true }), 50);
  }

  let zahlNr = 0;
  function zahl(name, wert) {
    return el('div', { class: 'hm-feier-zahl', style: `--n:${zahlNr++ % 8}` }, el('b', {}, wert), el('span', {}, name));
  }

  function stufenName(n) {
    return ECONOMY.stufen?.find((s) => s.stufe === n)?.name || `Stufe ${n}`;
  }

  function naechstesZiel(to) {
    const r = ctx().rules;
    const g = r.stageGoals?.[to];
    if (g) return `Nächstes Ziel: ${ganz(g.guests)} Gäste in dieser Stufe, Ruf ${num1(g.reputation)}, dann ${g.name} für ${euro(g.cost)}.`;
    const rg = r.regionGoal;
    if (rg && to >= r.maxStage) {
      const teile = [];
      if (rg.bigVisits) teile.push(`${rg.bigVisits} Besuche großer Schiffe`);
      if (rg.reputation) teile.push(`Ruf ${num1(rg.reputation)}`);
      if (rg.allBerths) teile.push('alle Plätze gebaut');
      return `Letztes Ziel der Region: ${teile.join(', ')}.`;
    }
    return null;
  }

  // Stufenaufstieg
  game.on('sim:stageUp', ({ stage }) => {
    const ab = letzterAbschluss && letzterAbschluss.to === stage ? letzterAbschluss : null;
    letzterAbschluss = null;
    const from = ab?.from ?? stage - 1;
    const e = ab?.eintrag;
    const zahlen = el('div', { class: 'hm-feier-zahlen' });
    if (e) {
      const tage = e.abTag != null ? e.bisTag - e.abTag + 1 : null;
      if (tage != null) zahlen.append(zahl('Tage', ganz(tage)));
      if (e.gaeste != null) zahlen.append(zahl('Gäste', ganz(e.gaeste)));
      if (e.einnahmen != null) zahlen.append(zahl('Einnahmen', euro(e.einnahmen)));
      if (e.besterTag) zahlen.append(zahl('Bester Tag', euro(e.besterTag)));
      zahlen.append(zahl('Ruf', num1(e.ruf)));
    }
    const neu = neuInStufe(ctx(), from, stage);
    const ziel = naechstesZiel(stage);
    zeige({
      art: 'stufe',
      ober: `Stufe ${stage} erreicht`,
      titel: stufenName(stage),
      unter: e ? `So lief ${stufenName(from)}${e.abTag != null ? ` (Tag ${ganz(e.abTag)} bis ${ganz(e.bisTag)})` : ''}:` : null,
      inhalt: [
        e ? zahlen : null,
        neu.length ? el('div', { class: 'hm-feier-neu' }, el('p', { class: 'hm-feier-kopf' }, 'Neu im Hafen'), el('ul', {}, neu.map((t) => el('li', {}, t)))) : null,
        ziel ? el('p', { class: 'hm-feier-ziel' }, ziel) : null,
      ],
      knopf: 'Weiter',
      fahrt: { dauer: 7, drehung: 0.6, zoom: 0.9 },
    });
  });

  // Abschluss der Region
  game.on('sim:regionDone', (ev) => {
    const s = st();
    if (!ev?.vorschau) starteEndlos(s, ctx());
    merkeTag(s);
    const m = aufstiegState(s);
    const region = REGION_NAMEN[s.region] || 'Ostsee';
    const logbuch = Object.values(s.logbook || {}).reduce((n, l) => n + (Array.isArray(l) ? l.length : 0), 0);
    const plaetze = sim.availableBerths(s, ctx()).length;
    const zahlen = el('div', { class: 'hm-feier-zahlen' },
      zahl('Spieltage', ganz(s.day)),
      zahl('Gäste', ganz(s.guests || 0)),
      zahl('Einnahmen', euro(s.stats?.totalIncome || 0)),
      zahl('Große Schiffe', ganz(s.bigVisits || 0)),
      zahl('Liegeplätze', ganz(plaetze)),
      zahl('Ruf', num1(sim.reputation(s))),
      logbuch ? zahl('Bootsmodelle', ganz(logbuch)) : null,
    );
    const chronik = m.stufen.length ? el('div', { class: 'hm-feier-chronik' },
      el('p', { class: 'hm-feier-kopf' }, 'Chronik'),
      el('ol', {}, [...m.stufen, { stufe: s.stage, abTag: m.chronik[s.stage]?.abTag, bisTag: s.day, gaeste: (s.guests || 0) - (m.chronik[s.stage]?.gaeste ?? 0) }].map((x) =>
        el('li', {},
          el('span', { class: 'hm-feier-stufe' }, `${x.stufe}. ${stufenName(x.stufe)}`),
          el('span', { class: 'hm-feier-wert' }, x.abTag != null ? `Tag ${ganz(x.abTag)}` : ''),
          el('span', { class: 'hm-feier-wert' }, x.gaeste != null ? `${ganz(x.gaeste)} Gäste` : ''))))) : null;
    const endlos = saisonStand(s, ctx());
    const weiter = endlos.wartet
      ? 'Der Hafen läuft weiter. Mit der nächsten Saison beginnen die Saisonziele: Erreichte Ziele bringen Sterne, Geld und einen höheren Rang.'
      : `Der Hafen läuft weiter. Ab jetzt gibt es jede Saison neue Saisonziele (oben links unter "Saison ${endlos.saison}"). Erreichte Ziele bringen Sterne, Geld und einen höheren Rang.`;
    zeige({
      art: 'region',
      ober: `${stufenName(s.stage)} fertig ausgebaut`,
      titel: `Hafenmeister der ${region}`,
      unter: `Vom Badesteg zum Seehafen in ${ganz(s.day)} ${s.day === 1 ? 'Tag' : 'Tagen'}.`,
      inhalt: [zahlen, chronik, el('p', { class: 'hm-feier-ziel' }, weiter)],
      knopf: 'Weiterspielen',
      fahrt: { dauer: 12, drehung: 1.6, zoom: 0.8 },
    });
  });

  // Saisonende im Endlosspiel
  game.on('sim:seasonEnd', (ev) => {
    const liste = el('ul', { class: 'hm-feier-ziele' }, ev.ziele.map((z) =>
      el('li', { class: z.ok ? 'ok' : 'nein' },
        el('i', { class: 'hm-feier-haken', 'aria-hidden': 'true' }, pixelBild(z.ok ? 'haken' : 'zu', 12)),
        el('span', {}, ZIEL_NAMEN[z.art] || z.art),
        el('span', { class: 'hm-feier-wert' }, zielText(z)),
        el('span', { class: 'hm-leise' }, z.ok ? 'erreicht' : 'nicht erreicht'))));
    const neu = saisonStand(st(), ctx());
    zeige({
      art: 'saison',
      ober: `Saison ${ev.saison} vorbei`,
      titel: ev.neuerRang ? `Neuer Rang: ${ev.neuerRang}` : `${ev.erreicht} von ${ev.ziele.length} Zielen`,
      unter: ev.belohnung ? `Belohnung: ${euro(ev.belohnung)} · ${ev.erreicht === 1 ? 'ein Stern' : `${ev.erreicht} Sterne`} dazu, ${ev.sterne} insgesamt` : `Keine Sterne dazu, ${ev.sterne} insgesamt`,
      inhalt: [
        liste,
        el('p', { class: 'hm-feier-ziel' }, `Rang: ${ev.rang}.${neu.naechsterRang ? ` Nächster Rang "${neu.naechsterRang.titel}" ab ${neu.naechsterRang.sterne} Sternen.` : ''} Nach dem Winter beginnt die nächste Saison mit neuen Zielen.`),
      ],
      knopf: 'Weiter',
      fahrt: null,
    });
  });

  // ------------------------------------------------------------------ Ziel-Schild (#hm-ziel)
  // ui/oberflaeche.js fragt game.aufstieg.zielDaten(), sobald das Endlosspiel läuft.
  function zielDaten() {
    const s = saisonStand(st(), ctx());
    if (!s.aktiv) return null;
    const kopfRang = `Rang: ${s.rang} · ${s.sterne} Sterne`;
    if (s.wartet) {
      return {
        titel: 'Saisonziele', kopf: `${kopfRang}. Neue Saisonziele ab der nächsten Saison.`,
        zeilen: [{ name: s.winter ? 'Winter, nächste Saison' : 'Nächste Saison', ist: 0, soll: 1, text: `in ${s.tageBisStart} ${s.tageBisStart === 1 ? 'Tag' : 'Tagen'}` }],
        fertig: false, aktion: null, zahl: s.letzte ? `${s.letzte.erreicht}/${s.letzte.von}` : '–',
      };
    }
    return {
      titel: `Saison ${s.saison}`,
      kopf: `${kopfRang}. Noch ${s.tageRest} ${s.tageRest === 1 ? 'Tag' : 'Tage'} in dieser Saison.`,
      zeilen: s.ziele.map((z) => ({ name: ZIEL_NAMEN[z.art] || z.art, ist: z.art === 'ruf' ? z.ist : Math.min(z.ist, z.soll), soll: z.soll, text: zielText(z) })),
      fertig: s.ziele.every((z) => z.ok), aktion: null,
      zahl: s.ziele.every((z) => z.ok) ? 'alle' : undefined,
    };
  }

  const api = {
    zielDaten,
    saisonStand: () => saisonStand(st(), ctx()),
    get offen() { return !!offen; },
    // zum Ausprobieren: game.aufstieg.zeigeStufe(3), game.aufstieg.zeigeRegion()
    zeigeStufe: (n) => game.emit('sim:stageUp', { type: 'stageUp', stage: n ?? st().stage }),
    zeigeRegion: () => game.emit('sim:regionDone', { type: 'regionDone', region: st().region, day: st().day, vorschau: true }),
    sollTexte: (ziele) => ziele.map(sollText),
  };
  game.aufstieg = api;
  return api;
}

export default init;
