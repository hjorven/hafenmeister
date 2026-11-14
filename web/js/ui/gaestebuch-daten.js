// Gästebuch: Daten und Texte ohne Browser (Oberfläche in ui/gaestebuch.js, Beschreibung docs/gaestebuch.md).
//
// Jede Bewertung, die in den Ruf eingeht, landet hier als Eintrag: Abreise ('departed', auch beim
// Umbau) und abgewiesene Boote, die eine Note geben ('turnedAway' mit rated). Dazu der Ruf am Ende
// jedes Tages ('dayEnd') für den Verlauf.
//
// Spielstand: state.modules.gaestebuch = {
//   eintraege: [{ id, tag, note, art, platz, boot: { name, bootsname, heimathafen, size, typeId, besuche },
//                 gruende: [{ key, n }], plus: [{ key, wert }], gezeigt }],   neueste zuerst, höchstens MAX_EINTRAEGE
//   verlauf: [{ tag, ruf }],                                                    älteste zuerst, höchstens MAX_VERLAUF
// }
//
// Die Logik läuft ohne Browser (tests/gaestebuch.test.mjs).

import * as sim from '../sim.js';
import { RULES } from '../data/rules.js';
import { ANGEBOT_TEXTE } from '../data/wuensche-texte.js';

export const GAESTEBUCH = {
  maxEintraege: 20,     // so viele Bewertungen zeigt das Gästebuch (der Ruf zählt die letzten Tage, economy.js ruf.tage)
  maxVerlauf: 30,       // Tage im Ruf-Verlauf
  zufriedenAb: 4,       // ab dieser Note zufrieden (wie Stammgäste, features/stammgaeste.js)
  topGruende: 3,
};

/** Gründe für Abzüge, mit Text fürs Gästebuch und Symbolname (ui/gaestebuch.js). */
export const GRUND = {
  wc:         { text: 'kein WC',                    lang: 'Kein WC in der Nähe',                        sym: 'wc' },
  dusche:     { text: 'keine Dusche',               lang: 'Keine Dusche frei',                          sym: 'dusche' },
  essen:      { text: 'nichts zu essen',            lang: 'Nichts zu essen im Hafen',                   sym: 'essen' },
  strom:      { text: 'kein Strom am Platz',        lang: 'Kein Strom am Liegeplatz',                   sym: 'strom' },
  diesel:     { text: 'kein Diesel',                lang: 'Kein Diesel zu bekommen',                    sym: 'diesel' },
  sturm:      { text: 'ungeschützt bei Sturm',      lang: 'Platz ohne Schutz bei Sturm',               sym: 'sturm' },
  stimmung:   { text: 'schlechte Stimmung',         lang: 'Schlechte Stimmung im Hafen',               sym: 'sturm' },
  umbau:      { text: 'musste wegen Umbau weg',     lang: 'Musste wegen Umbau früher ablegen',         sym: 'umbau' },
  warten:     { text: 'zu lange gewartet',          lang: 'Zu lange an der Boje gewartet',             sym: 'warten' },
  abends:     { text: 'abends kein Platz',          lang: 'Abends noch immer ohne Liegeplatz',         sym: 'warten' },
  weggeschickt: { text: 'weggeschickt',            lang: 'Vom Hafenmeister weggeschickt',             sym: 'warten' },
  abgewiesen: { text: 'keinen Platz bekommen',      lang: 'Keinen Liegeplatz bekommen',                sym: 'warten' },
};

// Wünsche an Angebote an Land (P19 C3): Texte aus data/wuensche-texte.js, Symbol wie der Wunsch
for (const [k, t] of Object.entries(ANGEBOT_TEXTE)) GRUND[k] = { text: t.fehlt, lang: t.lang, sym: k };

/** Was die Note hebt. */
export const PLUS = {
  wuensche: 'alle Wünsche erfüllt',
  ohne:     'keine besonderen Wünsche',
  komfort:  'bequemer Liegeplatz',
  sonder:   'besonderer Gast',
  passgenau: 'Box passt genau',
  vonHand:  'vom Hafenmeister eingewiesen',
  bonus:    'Fest im Hafen',
};

const WUNSCH_KEYS = ['wc', 'dusche', 'essen', 'strom', 'diesel', ...Object.keys(ANGEBOT_TEXTE)];

export function buchState(state) {
  state.modules ||= {};
  const b = (state.modules.gaestebuch ||= {});
  if (!Array.isArray(b.eintraege)) b.eintraege = [];
  if (!Array.isArray(b.verlauf)) b.verlauf = [];
  return b;
}

const r1 = (x) => Math.round(x * 10) / 10;
const r2 = (x) => Math.round(x * 100) / 100;

/** Gründe und Pluspunkte aus einer Abreise ('departed' mit parts). */
export function gruendeAusAbreise(e) {
  const p = e.parts;
  const gruende = [];
  const plus = [];
  if (p) {
    // Wünsche: je Wunsch die Nächte, in denen er fehlte (meiste zuerst)
    const missed = Object.entries(p.missed || {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
    for (const [key, n] of missed) gruende.push({ key, n });
    if (p.penalty > 0.001) gruende.push({ key: 'sturm', n: r2(p.penalty) });
    if (p.bonus < -0.001) gruende.push({ key: 'stimmung', n: r2(-p.bonus) });
    if (p.wishesTotal > 0 && !missed.length) plus.push({ key: 'wuensche', wert: 0 });
    if (!p.wishes?.length) plus.push({ key: 'ohne', wert: 0 });
    if (p.comfort > 0.001) plus.push({ key: 'komfort', wert: r2(p.comfort) });
    if (p.special > 0.001) plus.push({ key: 'sonder', wert: r2(p.special) });
    if (p.snug > 0.001) plus.push({ key: 'passgenau', wert: r2(p.snug) });
    if (p.byHand > 0.001) plus.push({ key: 'vonHand', wert: r2(p.byHand) });
    if (p.bonus > 0.001) plus.push({ key: 'bonus', wert: r2(p.bonus) });
  }
  if (e.reason === 'rebuild') gruende.push({ key: 'umbau', n: 1 });
  return { gruende, plus };
}

const ABGEWIESEN = { patience: 'warten', evening: 'abends', dismissed: 'weggeschickt' };

/** Ein Ereignis der Spielregeln eintragen. Gibt den neuen Eintrag zurück (oder null). */
export function eintragen(state, e) {
  if (!e) return null;
  const buch = buchState(state);
  if (e.type === 'dayEnd') {
    const tag = e.day ?? state.day;
    const ruf = r1(sim.reputation(state));
    const letzter = buch.verlauf[buch.verlauf.length - 1];
    if (letzter && letzter.tag === tag) letzter.ruf = ruf;
    else buch.verlauf.push({ tag, ruf });
    while (buch.verlauf.length > GAESTEBUCH.maxVerlauf) buch.verlauf.shift();
    return null;
  }
  let eintrag = null;
  if (e.type === 'departed' && typeof e.rating === 'number') {
    const { gruende, plus } = gruendeAusAbreise(e);
    eintrag = { art: e.reason === 'rebuild' ? 'umbau' : 'abreise', platz: e.berthId ?? null, gruende, plus };
  } else if ((e.type === 'turnedAway' || e.type === 'dismissed') && e.rated && typeof e.rating === 'number') {
    eintrag = { art: 'abgewiesen', platz: null, gruende: [{ key: ABGEWIESEN[e.type === 'dismissed' ? 'dismissed' : e.reason] ?? 'abgewiesen', n: 1 }], plus: [] };
  }
  if (!eintrag) return null;
  const g = e.guest || {};
  eintrag = {
    id: e.boatId,
    tag: e.day ?? state.day,
    note: e.rating,
    ...eintrag,
    boot: {
      name: g.name ?? '', bootsname: g.bootsname ?? null, heimathafen: g.heimathafen ?? null,
      size: g.size ?? null, typeId: g.typeId ?? e.typeId ?? null, besuche: g.besuche ?? 1,
    },
    gezeigt: false,
  };
  // Ältere Spielregeln ohne e.day: nächtliche Abreisen zählen zum Tag, der gerade zu Ende ging
  if (e.day == null && e.type === 'departed' && e.reason !== 'rebuild') eintrag.tag = Math.max(1, state.day - 1);
  buch.eintraege.unshift(eintrag);
  if (buch.eintraege.length > GAESTEBUCH.maxEintraege) buch.eintraege.length = GAESTEBUCH.maxEintraege;
  return eintrag;
}

/** Alle Ereignisse einer Liste eintragen (Tests, Vorspulen). */
export function verarbeite(state, events) {
  const neu = [];
  for (const e of events || []) {
    const x = eintragen(state, e);
    if (x) neu.push(x);
  }
  return neu;
}

export const zufrieden = (eintrag) => eintrag.note >= GAESTEBUCH.zufriedenAb;

/** Der wichtigste Grund einer Note (für das Symbol über dem Boot), nur bei unzufriedenen Gästen. */
export function hauptgrund(eintrag) {
  if (!eintrag || zufrieden(eintrag) || !eintrag.gruende?.length) return null;
  if (eintrag.art === 'umbau') return 'umbau';
  if (eintrag.art === 'abgewiesen') return eintrag.gruende[0].key;
  // Fehlende Wünsche zuerst (die kann der Spieler bauen), dann der Rest
  const w = eintrag.gruende.find((g) => WUNSCH_KEYS.includes(g.key));
  return (w ?? eintrag.gruende[0]).key;
}

/** Die häufigsten Gründe für Noten unter zufriedenAb in den Einträgen: [{ key, gaeste }]. */
export function topGruende(state, n = GAESTEBUCH.topGruende) {
  const zaehl = {};
  for (const e of buchState(state).eintraege) {
    if (zufrieden(e)) continue;
    for (const key of new Set(e.gruende.map((g) => g.key))) zaehl[key] = (zaehl[key] || 0) + 1;
  }
  return Object.entries(zaehl)
    .map(([key, gaeste]) => ({ key, gaeste }))
    .sort((a, b) => b.gaeste - a.gaeste || a.key.localeCompare(b.key))
    .slice(0, n);
}

/** Schnitt der Noten im Gästebuch und Anzahl zufriedener Gäste. */
export function zusammenfassung(state) {
  const liste = buchState(state).eintraege;
  const schnitt = liste.length ? r1(liste.reduce((a, e) => a + e.note, 0) / liste.length) : null;
  return { anzahl: liste.length, zufrieden: liste.filter(zufrieden).length, schnitt };
}

/** Satz unter dem Gästebuch: woraus der Ruf besteht (economy.js ruf.tage, ruf.mindestens). */
export function rufErklaerung(state) {
  const { days, minCount } = RULES.reputation;
  const n = sim.reputationRatings(state).length;
  const tage = days === 1 ? 'von heute' : `der letzten ${days} Tage`;
  return `Dein Ruf ist der Schnitt aller Bewertungen ${tage}, mindestens der letzten ${minCount} (gerade ${n}). `
    + 'Ab 4 Sternen kommen Gäste als Stammgast wieder, ein guter Ruf lockt mehr und größere Boote an.';
}

/** Ruf-Verlauf mit dem heutigen Stand am Ende: [{ tag, ruf, heute? }]. */
export function verlauf(state) {
  const v = [...buchState(state).verlauf];
  const heute = r1(sim.reputation(state));
  if (!v.length || v[v.length - 1].tag < state.day) v.push({ tag: state.day, ruf: heute, heute: true });
  return v.slice(-GAESTEBUCH.maxVerlauf);
}

// ------------------------------------------------------------------ Texte

// Fester Zufall aus der Boots-id und dem Tag: gleiche Seite, gleicher Text (kein Würfel der Spielregeln)
function wahl(liste, eintrag, salz = 0) {
  let h = 2166136261 ^ salz;
  for (const c of `${eintrag.id}:${eintrag.tag}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return liste[Math.abs(h) % liste.length];
}

const SATZ = {
  wc: ['Ein WC in der Nähe hätte uns gereicht.', 'Wo ist hier das Klo?', 'Leider kein WC gefunden.'],
  dusche: ['Eine warme Dusche hätte gutgetan.', 'Die Dusche war immer besetzt.', 'Nach drei Tagen auf See: keine Dusche.'],
  essen: ['Wir hatten Hunger, aber nichts zu essen.', 'Ein Fischbrötchen hätte gereicht.', 'Kein Imbiss, kein Café, schade.'],
  strom: ['Kein Strom am Platz, das Bier wurde warm.', 'Ohne Landstrom ging der Akku leer.', 'Strom am Steg wäre schön gewesen.'],
  diesel: ['Nirgends Diesel, wir mussten weiter.', 'Tank leer und keine Zapfsäule.', 'Diesel gab es nicht.'],
  sturm: ['Beim Sturm lagen wir ganz ungeschützt.', 'Unruhige Nacht, das Boot hat ordentlich gerissen.', 'Draußen am Steg bei Sturm: nie wieder.'],
  stimmung: ['Die Stimmung im Hafen war gedrückt.', 'Irgendwie war nichts los.'],
  umbau: ['Wegen der Baustelle mussten wir früher los.', 'Baulärm, und dann hieß es: Platz räumen.'],
  warten: ['Ewig an der Boje gewartet, dann sind wir weiter.', 'Niemand hat uns einen Platz gegeben.'],
  abends: ['Abends immer noch kein Platz, wir sind weitergefahren.', 'Es wurde dunkel, und wir hingen noch an der Boje.'],
  abgewiesen: ['Kein Platz für uns.', 'Voll. Vielleicht nächstes Mal.'],
  weggeschickt: ['Einfach weggeschickt worden. Unfreundlich.', 'Wir durften nicht mal fragen, schon hieß es: weiter.'],
  sehrGut: ['Rundum zufrieden, wir kommen wieder!', 'Alles da, was man braucht. Danke!', 'Schönster Hafen an der Küste.', 'Freundlich, sauber, ruhig. Perfekt.'],
  gut: ['Netter Hafen, gerne wieder.', 'Ruhige Nacht, guter Platz.', 'Hat gepasst.', 'Schöner Liegeplatz.'],
  mittel: ['Ganz in Ordnung.', 'Geht so.', 'Für eine Nacht reicht es.'],
  komfort: ['Toller Liegeplatz am Fingersteg.', 'Der Platz war richtig bequem.'],
  stamm: (n) => `Schon unser ${n}. Besuch hier.`,
};
for (const [k, t] of Object.entries(ANGEBOT_TEXTE)) SATZ[k] = t.saetze;


/** Ein Satz im Gästebuch, zum Beispiel "Eine warme Dusche hätte gutgetan." */
export function satz(eintrag) {
  // Umbau und Abweisen: der Anlass zählt mehr als ein fehlender Wunsch
  const haupt = eintrag.art === 'umbau' ? 'umbau' : eintrag.art === 'abgewiesen' ? eintrag.gruende[0]?.key : hauptgrund(eintrag);
  let text;
  if (haupt && SATZ[haupt]) text = wahl(SATZ[haupt], eintrag);
  else if (eintrag.note >= 4.5) text = wahl(SATZ.sehrGut, eintrag);
  else if (eintrag.plus?.some((p) => p.key === 'komfort') && eintrag.note >= 4) text = wahl(SATZ.komfort, eintrag);
  else if (eintrag.note >= 4) text = wahl(SATZ.gut, eintrag);
  else if (eintrag.gruende[0] && SATZ[eintrag.gruende[0].key]) text = wahl(SATZ[eintrag.gruende[0].key], eintrag);
  else text = wahl(SATZ.mittel, eintrag);
  if ((eintrag.boot?.besuche ?? 1) > 1 && eintrag.art === 'abreise') text += ` ${SATZ.stamm(eintrag.boot.besuche)}`;
  return text;
}

/** Name für die Zeile, zum Beispiel „Möwe“ aus Kappeln. */
export function absender(eintrag) {
  const b = eintrag.boot || {};
  if (b.bootsname) return b.heimathafen ? `„${b.bootsname}“ aus ${b.heimathafen}` : `„${b.bootsname}“`;
  return b.name ? `Gäste mit ${b.name}` : 'Ein Gast';
}

/** Kurzer Text, warum die Note so ist, zum Beispiel "kein WC (2 Nächte) · bequemer Liegeplatz +0,5". */
export function erklaerung(eintrag) {
  const teile = [];
  const komma = (x) => String(x).replace('.', ',');
  for (const g of eintrag.gruende) {
    const def = GRUND[g.key];
    if (!def) continue;
    if (WUNSCH_KEYS.includes(g.key)) teile.push(g.n > 1 ? `${def.text} (${g.n} Nächte)` : def.text);
    else if (g.key === 'sturm' || g.key === 'stimmung') teile.push(`${def.text} −${komma(g.n)}`);
    else teile.push(def.text);
  }
  for (const p of eintrag.plus || []) teile.push(p.wert ? `${PLUS[p.key]} +${komma(p.wert)}` : PLUS[p.key]);
  return teile.join(' · ');
}
