// Erfolge (Roadmap P22: Erfolge, I6 Erfolge als Dinge im Hafen, I7 Meilensteine mit Ton und Bild).
// Daten und Prüfung ohne Browser. Oberfläche und Dinge im Hafen: features/erfolge.js. Beschreibung: docs/erfolge.md.
// Tests: tests/erfolge.test.mjs (unter anderem: jeder Erfolg ist in einem simulierten Spiel erreichbar).
//
// Spielstand: state.modules.erfolge = {
//   erreicht: { [id]: { tag, stufe } },
//   z: { passgenau, ziele, wochen, sturm, serie, tiefst?, ausgebucht?, fuenfAnker?, region?, saison? }
//      Zähler und Merker, die nur hier gezählt werden (tiefst: schlechteste Bewertung des laufenden Abends)
//   neu: [id]   noch nicht im Logbuch angesehen
// }
// Schwellen: ECONOMY.erfolge (data/economy.js).
//
// Jeder Erfolg: id, titel, text (wofür), gruppe, ding ('wimpel' | 'pokal' | 'schild'),
// stand(state, h) -> { ist, soll } oder bool. h = Hilfsdaten: { fortschritt (Logbuch), ruf }.
// Die Prüfung läuft an festen Stellen (Ereignisse der Spielregeln, Ziele, Bauen); sie ist billig und
// prüft immer alle noch offenen Erfolge.

import { aktuellesRevier } from '../data/kuestennamen.js';
import * as sim from '../sim.js';
import { ECONOMY } from '../data/economy.js';
import { katalog as logbuchKatalog, fortschritt as logbuchFortschritt } from '../ui/logbuch-daten.js';
import { fortschritt as besucherFortschritt } from './besucher-regeln.js';
import { fortschritt as postkartenFortschritt } from './fotoauftraege-regeln.js';

const istObjekt = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Wimpelfarben je Gruppe (Rot und Grün gehören den Platzschildern, darum kräftige andere Töne)
export const GRUPPEN = {
  hafen: { name: 'Hafenbetrieb', farbe: '#2f6db3' },
  gaeste: { name: 'Gäste und Ruf', farbe: '#f2c14e' },
  geld: { name: 'Kasse', farbe: '#e0962a' },
  ausbau: { name: 'Ausbau', farbe: '#7a5aa6' },
  sammeln: { name: 'Logbuch', farbe: '#23897d' },
  jahr: { name: 'Jahreslauf', farbe: '#d65a8a' },
};

const zahl = (ist, soll) => ({ ist: Math.min(ist, soll), soll });
const Z = ECONOMY.erfolge;
const tsd = (n) => n.toLocaleString('de-DE');
// Stufe 3 und der Pokal heißen nach dem Revier des laufenden Spiels (P57 Teil 5)
const STUFEN_NAME = { 2: 'Dorfhafen', get 3() { return aktuellesRevier() === 'nordsee' ? 'Zur Nordsee' : 'Zur Ostsee'; }, 4: 'Marina', 5: 'Küstenmarina', 6: 'Seehafen' };

export const ERFOLGE = [
  // ---------------------------------------------------------------- Hafenbetrieb
  { id: 'erste-leine', gruppe: 'hafen', ding: 'wimpel', titel: 'Erste Leine fest', text: 'Das erste Gastboot hat festgemacht.',
    stand: (s) => (s.stats?.verlauf || []).some((v) => v.angelegt > 0) || (s.guests || 0) > 0 || Object.values(s.boats || {}).some((b) => b?.status === 'moored' && !b.stationed) },
  { id: 'massarbeit', gruppe: 'hafen', ding: 'wimpel', titel: 'Maßarbeit', text: `${Z.passgenau} Boote passgenau in ihre Box gebracht.`,
    stand: (s) => zahl(z(s).passgenau, Z.passgenau) },
  { id: 'ausgebucht', gruppe: 'hafen', ding: 'wimpel', titel: 'Ausgebucht', text: `An einem Abend war jede Gastbox belegt (mindestens ${Z.ausgebuchtAb}).`,
    stand: (s) => !!z(s).ausgebucht },
  { id: 'tagesziele', gruppe: 'hafen', ding: 'wimpel', titel: 'Zuverlässig', text: `${Z.tagesziele} Tagesziele geschafft.`,
    stand: (s) => zahl(z(s).ziele, Z.tagesziele) },
  { id: 'wochenziel', gruppe: 'hafen', ding: 'wimpel', titel: 'Gute Woche', text: Z.wochenziele > 1 ? `${Z.wochenziele} Wochenziele geschafft.` : 'Ein Wochenziel geschafft.',
    stand: (s) => zahl(z(s).wochen, Z.wochenziele) },
  // ---------------------------------------------------------------- Gäste und Ruf
  { id: 'gaeste-1', gruppe: 'gaeste', ding: 'wimpel', titel: 'Volles Gästebuch', text: `${tsd(Z.gaeste[0])} Gäste sind abgereist.`,
    stand: (s) => zahl(s.guests || 0, Z.gaeste[0]) },
  { id: 'gaeste-2', gruppe: 'gaeste', ding: 'pokal', titel: 'Beliebter Hafen', text: `${tsd(Z.gaeste[1])} Gäste sind abgereist.`,
    stand: (s) => zahl(s.guests || 0, Z.gaeste[1]) },
  { id: 'stammgast', gruppe: 'gaeste', ding: 'wimpel', titel: 'Kommt gern wieder', text: 'Der erste Stammgast.',
    stand: (s) => zahl(stammZahl(s), Z.stammgaeste[0]) },
  { id: 'stammgaeste', gruppe: 'gaeste', ding: 'wimpel', titel: 'Bekannte Gesichter', text: `${Z.stammgaeste[1]} Stammgäste.`,
    stand: (s) => zahl(stammZahl(s), Z.stammgaeste[1]) },
  { id: 'fuenf-anker', gruppe: 'gaeste', ding: 'pokal', titel: 'Ein Abend mit 5 Sternen', text: `Mindestens ${Z.fuenfAnkerAb} Gäste reisen an einem Abend ab, alle geben 5 Sterne.`,
    stand: (s) => !!z(s).fuenfAnker },
  { id: 'ruf', gruppe: 'gaeste', ding: 'wimpel', titel: 'Bester Ruf an der Küste', text: `Der Ruf steht bei ${String(Z.ruf).replace('.', ',')} Sternen oder mehr.`,
    stand: (s, h) => (h.ruf ?? 0) >= Z.ruf },
  { id: 'nur-lob', gruppe: 'gaeste', ding: 'wimpel', titel: 'Eine Woche nur Lob', text: `${Z.lob} Tage in Folge gibt jeder abreisende Gast ${Z.lobAb} Sterne oder mehr.`,
    stand: (s) => zahl(z(s).serie, Z.lob) },
  // ---------------------------------------------------------------- Kasse
  { id: 'tag-1', gruppe: 'geld', ding: 'wimpel', titel: 'Guter Tag', text: `An einem Tag ${tsd(Z.tag[0])} € eingenommen.`,
    stand: (s) => zahl(besterTag(s), Z.tag[0]) },
  { id: 'tag-2', gruppe: 'geld', ding: 'pokal', titel: 'Großer Zahltag', text: `An einem Tag ${tsd(Z.tag[1])} € eingenommen.`,
    stand: (s) => zahl(besterTag(s), Z.tag[1]) },
  { id: 'gesamt-1', gruppe: 'geld', ding: 'wimpel', titel: 'Gut gewirtschaftet', text: `Insgesamt ${tsd(Z.gesamt[0])} € eingenommen.`,
    stand: (s) => zahl(Math.round(s.stats?.totalIncome || 0), Z.gesamt[0]) },
  { id: 'gesamt-2', gruppe: 'geld', ding: 'pokal', titel: 'Hafenmillionär', text: `Insgesamt ${tsd(Z.gesamt[1])} € eingenommen.`,
    stand: (s) => zahl(Math.round(s.stats?.totalIncome || 0), Z.gesamt[1]) },
  // ---------------------------------------------------------------- Ausbau
  { id: 'grundstein', gruppe: 'ausbau', ding: 'wimpel', titel: 'Grundstein', text: 'Das erste Bauwerk steht.',
    stand: (s) => Object.values(s.facilities || {}).some((n) => n > 0) || Object.keys(s.buildings || {}).length > 0 || (s.office || 0) > 0 || (s.stage || 1) > 1 },
  ...[2, 3, 4, 5, 6].map((n) => ({
    id: `stufe-${n}`, gruppe: 'ausbau', ding: 'schild', stufeSchild: n, get titel() { return STUFEN_NAME[n]; }, text: `Ausbaustufe ${n} erreicht.`,
    stand: (s) => zahl(s.stage || 1, n),
  })),
  { id: 'region', gruppe: 'ausbau', ding: 'pokal', get titel() { return aktuellesRevier() === 'nordsee' ? 'Hafenmeister der Nordsee' : 'Hafenmeister der Ostsee'; }, text: 'Das Ziel der letzten Stufe geschafft.',
    stand: (s) => !!s.regionDone || !!z(s).region },
  // ---------------------------------------------------------------- Logbuch
  ...Z.logbuch.map((n, i) => ({
    id: `logbuch-${i + 1}`, gruppe: 'sammeln', ding: i === Z.logbuch.length - 1 ? 'pokal' : 'wimpel',
    titel: ['Bootskenner', 'Hafenkieker', 'Wandelndes Bootslexikon'][i] ?? `Logbuch ${n}`, text: `${n} Bootsmodelle im Logbuch.`,
    stand: (s, h) => zahl(h.fortschritt?.gesehen ?? 0, n),
  })),
  { id: 'alle-groessen', gruppe: 'sammeln', ding: 'wimpel', titel: 'Von klein bis groß', text: 'Je ein Boot der Größen S, M, L und XL im Logbuch.',
    stand: (s, h) => zahl(['S', 'M', 'L', 'XL'].filter((g) => (h.fortschritt?.je?.[g]?.gesehen ?? 0) > 0).length, 4) },
  // Seltene Besucher (P40, docs/besucher.md): state.modules.besucher, geschrieben von features/besucher.js
  { id: 'hoher-besuch', gruppe: 'sammeln', ding: 'wimpel', titel: 'Hoher Besuch', text: 'Ein seltener Besucher lag am Ehrenplatz.',
    stand: (s) => besucherFort(s).ehrenplatz > 0 },
  { id: 'seltene-schiffe', gruppe: 'sammeln', ding: 'wimpel', titel: 'Seltene Gäste', text: 'Alle vier besonderen Schiffe waren im Hafen.',
    stand: (s) => zahl(besucherFort(s).schiffe, besucherFort(s).schiffeGesamt) },
  { id: 'tierfreund', gruppe: 'sammeln', ding: 'wimpel', titel: 'Tierfreund', text: 'Schwäne und Schweinswal fürs Logbuch fotografiert.',
    stand: (s) => zahl(besucherFort(s).tierFotos, 2) },
  { id: 'fotoalbum', gruppe: 'sammeln', ding: 'pokal', titel: 'Fotoalbum', text: 'Alle sechs seltenen Besucher fürs Logbuch fotografiert.',
    stand: (s) => zahl(besucherFort(s).fotos, besucherFort(s).gesamt) },
  // Fotoaufträge (P43, docs/fotoauftraege.md): state.modules.fotoauftraege, geschrieben von features/fotoauftraege.js
  { id: 'postkarten', gruppe: 'sammeln', ding: 'wimpel', titel: 'Postkartenständer', text: 'Alle zwölf Postkarten für den Verlag fotografiert.',
    stand: (s) => { const f = postkartenFortschritt(s); return zahl(f.karten, f.gesamt); } },
  // Hafentiere (P51, docs/hafentiere.md)
  { id: 'hafenfreunde', gruppe: 'sammeln', ding: 'wimpel', titel: 'Hafenfreunde', text: 'Hafenkatze, Hafenhund und Graureiher fürs Logbuch fotografiert.',
    stand: (s) => zahl(besucherFort(s).hafentierFotos, besucherFort(s).hafentiereGesamt) },
  { id: 'traditionssegler', gruppe: 'sammeln', ding: 'wimpel', titel: 'Großer Bahnhof', text: `${Z.traditionssegler} Traditionssegler zugleich im Hafen.`,
    stand: (s) => zahl(Object.values(s.boats || {}).filter((b) => b?.typeId === 'XL1' && b.status === 'moored').length, Z.traditionssegler) },
  // ---------------------------------------------------------------- Jahreslauf
  { id: 'saison', gruppe: 'jahr', ding: 'wimpel', titel: 'Erste Saison', text: 'Die erste Saison ist geschafft, der Winter kommt.',
    stand: (s) => !!z(s).saison },
  { id: 'sturm', gruppe: 'jahr', ding: 'wimpel', titel: 'Sturmerprobt', text: 'Einen Sturm im Hafen überstanden.',
    stand: (s) => zahl(z(s).sturm, Z.sturm) },
];

export const ERFOLG_BY_ID = Object.fromEntries(ERFOLGE.map((e) => [e.id, e]));

// ------------------------------------------------------------------ Zustand

export function erfolgeState(state) {
  state.modules ||= {};
  let m = state.modules.erfolge;
  if (!istObjekt(m)) m = state.modules.erfolge = {};
  if (!istObjekt(m.erreicht)) m.erreicht = {};
  for (const [id, e] of Object.entries(m.erreicht)) {
    if (!ERFOLG_BY_ID[id] && !istObjekt(e)) delete m.erreicht[id];
    else if (!istObjekt(e)) m.erreicht[id] = { tag: null, stufe: null };
  }
  if (!istObjekt(m.z)) m.z = {};
  for (const k of ['passgenau', 'ziele', 'wochen', 'sturm', 'serie']) if (!Number.isFinite(m.z[k]) || m.z[k] < 0) m.z[k] = 0;
  if (!Array.isArray(m.neu)) m.neu = [];
  m.neu = m.neu.filter((id) => typeof id === 'string').slice(-ERFOLGE.length);
  return m;
}
const z = (s) => erfolgeState(s).z;
// Echte Stammgäste: wiedergekommen (features/stammgaeste.js, ab dem 2. Besuch), nicht jeder zufriedene Gast
const stammZahl = (s) => (Array.isArray(s.modules?.stamm?.liste) ? s.modules.stamm.liste.filter((g) => g.stamm ?? (g.besuche ?? 1) >= (ECONOMY.stammgaeste.stammAbBesuch ?? 2)).length : 0);
const besucherFort = (s) => besucherFortschritt(s);
const besterTag = (s) => Math.max(s.stats?.besterTag?.summe || 0, s.stats?.bestDayIncome || 0);

/** Fortschritt eines Erfolgs als { ist, soll, fertig }. */
export function stand(state, erfolg, h = {}) {
  const r = erfolg.stand(state, h);
  if (typeof r === 'boolean') return { ist: r ? 1 : 0, soll: 1, fertig: r };
  return { ...r, fertig: r.ist >= r.soll };
}

/** Hilfsdaten für die Prüfung: Logbuch-Fortschritt und Ruf. */
export function hilfsdaten(state, { types = null, ruf = null } = {}) {
  const kat = types ? logbuchKatalog(types) : null;
  return { fortschritt: kat ? logbuchFortschritt(state, kat) : null, ruf };
}

/** Alle offenen Erfolge prüfen, neu erreichte eintragen. Gibt die neuen Erfolge zurück (Liste der Definitionen). */
export function pruefen(state, h = {}) {
  const m = erfolgeState(state);
  const neu = [];
  for (const e of ERFOLGE) {
    if (m.erreicht[e.id]) continue;
    let fertig = false;
    try { fertig = stand(state, e, h).fertig; } catch { fertig = false; }
    if (!fertig) continue;
    m.erreicht[e.id] = { tag: state.day, stufe: state.stage };
    m.neu.push(e.id);
    neu.push(e);
  }
  return neu;
}

/**
 * Ereignisse der Spielregeln zählen (Liste aus sim.runDay oder gesammelt aus 'sim:<typ>').
 * h.voll(): true, wenn gerade jede Gastbox belegt ist (braucht ctx, kommt von außen).
 * h.abend(): true, wenn gerade Abend ist.
 */
export function zaehle(state, events, h = {}) {
  const m = erfolgeState(state);
  for (const e of events || []) {
    if (!e || typeof e.type !== 'string') continue;
    if (e.type === 'moored' && e.passgenau) m.z.passgenau++;
    else if (e.type === 'regionDone') m.z.region = 1;
    else if (e.type === 'dayStart' && e.winter) m.z.saison = 1;
    else if (e.type === 'departed' && Number.isFinite(e.rating)) {
      // schlechteste Bewertung des Tages (Abreisen kommen nachts vor 'dayEnd')
      m.z.tiefst = Math.min(Number.isFinite(m.z.tiefst) ? m.z.tiefst : 99, e.rating);
    } else if (e.type === 'dayEnd') {
      const b = e.bericht || {};
      const n = b.abgereist || 0;
      const tiefst = Number.isFinite(m.z.tiefst) ? m.z.tiefst : (b.bewertung ?? 0);
      if (n >= Z.fuenfAnkerAb && tiefst >= 5) m.z.fuenfAnker = 1;
      // Serie zufriedener Tage: jeder Abreisende lobAb Anker oder mehr. Tage ohne Abreise unterbrechen nicht.
      if (n > 0) m.z.serie = tiefst >= Z.lobAb ? m.z.serie + 1 : 0;
      delete m.z.tiefst;
    }
    if ((e.type === 'evening' || (e.type === 'moored' && h.abend?.())) && h.voll?.()) m.z.ausgebucht = 1;
  }
}

/** Ist gerade jede Gastbox belegt (fest vergebene zählen nicht)? Erst ab Z.ausgebuchtAb Gastboxen. */
export function ausgebuchtJetzt(state, ctx) {
  const gast = sim.availableBerths(state, ctx).filter((b) => !b.reserved);
  return gast.length >= Z.ausgebuchtAb && gast.every((b) => !sim.isFree(state, b.id));
}

/** Zähler aus Ereignissen der Oberfläche (Tagesziele, Wochenziele, Sturm vorbei). */
export function zaehleExtra(state, art) {
  const m = erfolgeState(state);
  if (art === 'ziel') m.z.ziele++;
  else if (art === 'woche') m.z.wochen++;
  else if (art === 'sturm') m.z.sturm++;
}

/** Erfolge zum Anzeigen: nach Gruppe, erreichte zuerst. */
export function ansicht(state, h = {}) {
  const m = erfolgeState(state);
  return Object.entries(GRUPPEN).map(([g, def]) => ({
    gruppe: g, name: def.name, farbe: def.farbe,
    erfolge: ERFOLGE.filter((e) => e.gruppe === g).map((e) => ({ ...e, erreicht: m.erreicht[e.id] ?? null, stand: stand(state, e, h), neu: m.neu.includes(e.id) })),
  }));
}

/** Was im Hafen steht: Wimpel (Farben), Pokale (ids), Schilder (Stufen). */
export function dinge(state) {
  const m = erfolgeState(state);
  const da = ERFOLGE.filter((e) => m.erreicht[e.id]);
  return {
    wimpel: da.filter((e) => e.ding === 'wimpel').map((e) => GRUPPEN[e.gruppe].farbe),
    pokale: da.filter((e) => e.ding === 'pokal').map((e) => e.id),
    schilder: da.filter((e) => e.ding === 'schild').map((e) => e.stufeSchild),
  };
}
