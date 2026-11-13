// Mehrere Speicherplätze im Browser (ohne Server).
//
// Aufbau im localStorage:
//   'hafenmeister.plaetze'          Verzeichnis: { format, aktiv, naechste, plaetze: [Eintrag, ...] }
//   'hafenmeister.spielstand'       Spielstand des aktiven Platzes (storage.js, KEY_SAVE)
//   'hafenmeister.spielstand.vorher' Sicherung des vorigen Speicherns des aktiven Platzes
//   'hafenmeister.platz.<id>'       Spielstand jedes anderen Platzes (gleicher Umschlag wie KEY_SAVE)
//
// Der aktive Platz bleibt unter KEY_SAVE, weil data/stegbild.js dort schon vor dem Start liest,
// welches Stegbild gilt. Beim Wechsel wird zuerst kopiert und erst danach gelöscht, damit ein
// Abbruch mittendrin (Speicher voll, Seite zu) nie einen Spielstand kostet.
//
// Eintrag: { id, name, erstellt, gespielt, info: { stufe, tag, geld, region }, probeVon? }
// Papierkorb: verzeichnis.papierkorb = [Eintrag mit geloescht], Daten bleiben unter
// 'hafenmeister.platz.<id>', bis sie endgültig gelöscht werden oder Platz gebraucht wird.
// Vorschaubild je Platz: 'hafenmeister.bild.<id>' (kleines JPEG als data-URL).
//
// Ein Tab merkt sich beim Start, welcher Platz aktiv war. Wechselt ein anderer Tab den Platz,
// speichert dieser Tab nicht mehr (sonst würde er den anderen Hafen überschreiben).
//
// Kennt die Spielregeln nicht. Neue Spielstände legt der Aufrufer an (state.js createState).

import {
  speicher, wrap, unwrap, loadGame, saveGame, altenStandLesen, KEY_SAVE, KEY_BACKUP, SaveError,
} from './storage.js';

export const KEY_INDEX = 'hafenmeister.plaetze';
export const KEY_ALT = 'hafenmeister.save'; // alter zweiter Speicherweg aus state.js
export const MAX_PLAETZE = 8;
export const NAME_MAX = 32;
export const PAPIERKORB_MAX = 5;
export const KEY_KAPUTT = 'hafenmeister.kaputt'; // beschädigter Stand, bis der Spieler ihn sichert oder verwirft
const platzKey = (id) => `hafenmeister.platz.${id}`;
const bildKey = (id) => `hafenmeister.bild.${id}`;

let meinPlatz = null;  // welcher Platz in diesem Tab läuft
let gesperrt = false;  // nach einem Wechsel bis zum Neuladen nichts mehr speichern

/** Nur für Tests: Tab-Zustand zurücksetzen. */
export function _reset() {
  meinPlatz = null;
  gesperrt = false;
  kaputtImTab = null;
}

// ---------------------------------------------------------------------------
// Hilfen

function lesenText(key) {
  try { return speicher()?.getItem(key) ?? null; } catch { return null; }
}

function schreiben(key, text) {
  const s = speicher();
  if (!s) throw new SaveError('kein-speicher', 'Der Browser erlaubt hier kein Speichern.');
  for (;;) {
    try {
      s.setItem(key, text);
      return;
    } catch {
      // Speicher voll: zuerst Vorschaubilder, dann den ältesten Eintrag im Papierkorb opfern
      if (!platzSchaffen(key)) {
        throw new SaveError('voll', 'Der Speicher im Browser ist voll. Lösche einen Hafen oder sichere ihn als Datei.');
      }
    }
  }
}

/** Gibt Speicher frei, den kein Spielstand braucht. false, wenn nichts mehr geht. */
function platzSchaffen(ausser) {
  const v = verzeichnisLesen();
  const korb = v?.papierkorb ?? [];
  if (korb.length) {
    const alt = korb.reduce((a, b) => ((a.geloescht ?? '') <= (b.geloescht ?? '') ? a : b));
    v.papierkorb = korb.filter((p) => p !== alt);
    geopfert.add(alt.id);
    entfernen(platzKey(alt.id));
    entfernen(bildKey(alt.id));
    try { speicher().setItem(KEY_INDEX, JSON.stringify(v)); } catch { /* egal */ }
    return true;
  }
  const s = speicher();
  if (!s || typeof s.key !== 'function') return false;
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i);
    if (k && k !== ausser && k.startsWith('hafenmeister.bild.')) { entfernen(k); return true; }
  }
  // Zuletzt die Kopie eines beschädigten Stands: das laufende Spiel geht vor (im Tab bleibt sie erhalten)
  if (ausser !== KEY_KAPUTT && lesenText(KEY_KAPUTT) !== null) { entfernen(KEY_KAPUTT); return true; }
  return false;
}

function entfernen(key) {
  try { speicher()?.removeItem(key); } catch { /* egal */ }
}

/** Kurzinfo für die Liste aus einem Spielzustand. */
export function infoAus(game) {
  const zahl = (v) => (Number.isFinite(v) ? v : 0);
  return {
    stufe: zahl(game?.stage) || 1,
    tag: zahl(game?.day) || 1,
    geld: Math.round(zahl(game?.money)),
    region: typeof game?.region === 'string' ? game.region : 'ostsee',
  };
}

export function nameSauber(name, ersatz = 'Mein Hafen') {
  const n = String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
  return n || ersatz;
}

/** Name, der noch nicht vergeben ist: "Möwenhafen", sonst "Möwenhafen 2" ... */
function freierName(index, wunsch) {
  const namen = new Set(index.plaetze.map((p) => p.name));
  if (!namen.has(wunsch)) return wunsch;
  for (let i = 2; ; i++) {
    const n = `${wunsch.slice(0, NAME_MAX - 3)} ${i}`;
    if (!namen.has(n)) return n;
  }
}

function leeresVerzeichnis() {
  return { format: 1, aktiv: null, naechste: 1, plaetze: [], papierkorb: [] };
}

function verzeichnisLesen() {
  const t = lesenText(KEY_INDEX);
  if (!t) return null;
  try {
    const v = JSON.parse(t);
    if (!v || typeof v !== 'object' || !Array.isArray(v.plaetze)) return null;
    v.plaetze = v.plaetze.filter((p) => p && typeof p.id === 'string');
    v.papierkorb = Array.isArray(v.papierkorb) ? v.papierkorb.filter((p) => p && typeof p.id === 'string') : [];
    if (!Number.isInteger(v.naechste) || v.naechste < 1) v.naechste = v.plaetze.length + 1;
    if (!v.plaetze.some((p) => p.id === v.aktiv)) v.aktiv = v.plaetze[0]?.id ?? null;
    return v;
  } catch {
    return null;
  }
}

// Papierkorb-Einträge, deren Daten platzSchaffen() schon freigegeben hat. Ein Verzeichnis, das
// ein Aufrufer vorher gelesen hat, darf sie beim Zurückschreiben nicht wieder einführen.
const geopfert = new Set();

function verzeichnisSchreiben(v) {
  if (v.papierkorb && geopfert.size) v.papierkorb = v.papierkorb.filter((p) => !geopfert.has(p.id));
  schreiben(KEY_INDEX, JSON.stringify(v));
}

function neueId(v) {
  let id;
  do { id = `p${v.naechste++}`; } while ([...v.plaetze, ...(v.papierkorb ?? [])].some((p) => p.id === id));
  return id;
}

function eintrag(v, id) {
  return v.plaetze.find((p) => p.id === id) ?? null;
}

const jetzt = () => new Date().toISOString();

// ---------------------------------------------------------------------------
// Einrichten und Übernahme alter Stände

/**
 * Liest das Verzeichnis und legt es beim ersten Start an. Übernimmt dabei
 *  - den bisherigen Spielstand (KEY_SAVE) als ersten Platz,
 *  - einen Stand aus dem alten Speicherweg 'hafenmeister.save' (als aktiven Platz, wenn es
 *    sonst keinen gibt, sonst als eigenen Platz "Älterer Hafen", falls es ein anderes Spiel ist).
 * Gibt das Verzeichnis zurück. Merkt sich den aktiven Platz für diesen Tab.
 */
export function einrichten({ namensVorschlag = () => 'Mein Hafen' } = {}) {
  let v = verzeichnisLesen();
  const neu = !v;
  if (!v) v = leeresVerzeichnis();
  if (neu) verwaisteAufnehmen(v);

  // Aktiver Platz fehlt (erster Start oder Verzeichnis beschädigt): bisherigen Stand übernehmen
  if (!v.aktiv) {
    const r = loadGame();
    const id = neueId(v);
    v.plaetze.push({
      id,
      name: nameSauber(r?.game?.harborName, r ? 'Mein Hafen' : namensVorschlag()),
      erstellt: r?.savedAt ?? jetzt(),
      gespielt: r?.savedAt ?? null,
      info: r ? infoAus(r.game) : null,
    });
    v.aktiv = id;
  }

  // Alter zweiter Speicherweg: einmal übernehmen, danach löschen
  const altText = lesenText(KEY_ALT);
  if (altText !== null) {
    let alt = null;
    try { alt = altenStandLesen(JSON.parse(altText)); } catch { alt = null; }
    if (alt) {
      const live = loadGame();
      try {
        if (!live) {
          schreiben(KEY_SAVE, JSON.stringify(wrap(alt)));
          const e = eintrag(v, v.aktiv);
          e.info = infoAus(alt);
          e.gespielt = jetzt();
          if (alt.harborName) e.name = nameSauber(alt.harborName);
        } else if (live.game?.seed !== alt.seed && v.plaetze.length < MAX_PLAETZE) {
          const id = neueId(v);
          schreiben(platzKey(id), JSON.stringify(wrap(alt)));
          v.plaetze.push({
            id, name: freierName(v, nameSauber(alt.harborName, 'Älterer Hafen')),
            erstellt: jetzt(), gespielt: null, info: infoAus(alt),
          });
        }
        verzeichnisSchreiben(v);
        entfernen(KEY_ALT);
      } catch {
        // Speicher voll: alten Stand liegen lassen, beim nächsten Start neuer Versuch
      }
    } else {
      entfernen(KEY_ALT); // unlesbar, kann nie wieder gelesen werden
    }
  }

  if (neu || !lesenText(KEY_INDEX)) {
    try { verzeichnisSchreiben(v); } catch { /* ohne Speicher: nur für diese Sitzung */ }
  }
  meinPlatz = v.aktiv;
  return v;
}

/**
 * Ist das Verzeichnis verloren oder beschädigt, liegen die anderen Plätze trotzdem noch im
 * Speicher. Sie werden wieder in die Liste aufgenommen.
 */
function verwaisteAufnehmen(v) {
  const s = speicher();
  if (!s || typeof s.key !== 'function') return;
  const ids = [];
  try {
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      const m = /^hafenmeister\.platz\.(p\d+)$/.exec(k ?? '');
      if (m) ids.push(m[1]);
    }
  } catch { return; }
  for (const id of ids.sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))) {
    let r = null;
    try { r = unwrap(JSON.parse(lesenText(platzKey(id)))); } catch { r = null; }
    if (!r) continue;
    v.plaetze.push({
      id, name: freierName(v, nameSauber(r.game?.harborName)), erstellt: r.savedAt ?? jetzt(),
      gespielt: r.savedAt, info: infoAus(r.game),
    });
    v.naechste = Math.max(v.naechste, Number(id.slice(1)) + 1);
  }
}

/** Verzeichnis lesen (richtet es bei Bedarf ein). */
export function verzeichnis() {
  return verzeichnisLesen() ?? einrichten();
}

/** Eintrag des Platzes, der in diesem Tab läuft. */
export function aktiverPlatz() {
  const v = verzeichnis();
  return eintrag(v, meinPlatz ?? v.aktiv);
}

/** false, wenn ein anderer Tab inzwischen einen anderen Platz geöffnet hat. */
export function diesesTabAktiv() {
  const v = verzeichnisLesen();
  return !gesperrt && (!v || !meinPlatz || v.aktiv === meinPlatz);
}

// ---------------------------------------------------------------------------
// Speichern des laufenden Spiels

/**
 * Speichert den laufenden Spielstand auf den aktiven Platz und trägt Name und Kurzinfo ein.
 * Gibt true/false zurück wie saveGame.
 */
export function speichernAktiv(game) {
  if (!game || typeof game !== 'object') return false;
  if (!diesesTabAktiv()) return false;
  const v = verzeichnisLesen();
  const e = v ? eintrag(v, v.aktiv) : null;
  if (e && game.harborName !== e.name) game.harborName = e.name;
  let ok = saveGame(game);
  // Speicher voll: Papierkorb, Vorschaubilder, aufgehobene Kopie opfern und noch einmal versuchen
  while (!ok && speicher() && platzSchaffen(KEY_SAVE)) ok = saveGame(game);
  if (!ok) return false;
  if (e) {
    e.info = infoAus(game);
    e.gespielt = jetzt();
    try { verzeichnisSchreiben(v); } catch { /* Kurzinfo ist nicht wichtig */ }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Lesen eines Platzes

/** Spielstand eines Platzes: { game, savedAt } oder null. */
export function platzLesen(id) {
  const v = verzeichnis();
  if (!eintrag(v, id)) return null;
  if (id === v.aktiv) {
    const r = loadGame();
    return r ? { game: r.game, savedAt: r.savedAt } : null;
  }
  const t = lesenText(platzKey(id));
  if (!t) return null;
  try { return unwrap(JSON.parse(t)); } catch { return null; }
}

function platzText(v, id) {
  return id === v.aktiv ? lesenText(KEY_SAVE) : lesenText(platzKey(id));
}

// ---------------------------------------------------------------------------
// Ändern

function platzFrei(v) {
  if (v.plaetze.length >= MAX_PLAETZE) {
    throw new SaveError('voll', `Alle ${MAX_PLAETZE} Plätze sind belegt. Lösche zuerst einen.`);
  }
}

/**
 * Legt einen neuen Platz mit dem gegebenen Spielzustand an (nicht aktiv).
 * Gibt die id zurück.
 */
export function platzAnlegen(game, { name, probeVon = null } = {}) {
  const v = verzeichnis();
  platzFrei(v);
  const id = neueId(v);
  const n = freierName(v, nameSauber(name ?? game?.harborName));
  const kopie = { ...game, harborName: n };
  schreiben(platzKey(id), JSON.stringify(wrap(kopie)));
  v.plaetze.push({
    id, name: n, erstellt: jetzt(), gespielt: null, info: infoAus(kopie),
    ...(probeVon ? { probeVon } : {}),
  });
  try {
    verzeichnisSchreiben(v);
  } catch (err) {
    entfernen(platzKey(id));
    throw err;
  }
  return id;
}

/** Kopie eines Platzes als neuer Platz. Für den aktiven Platz vorher speichern. */
export function kopieren(id, { name, probe = false } = {}) {
  const v = verzeichnis();
  const e = eintrag(v, id);
  const r = platzLesen(id);
  if (!e || !r) throw new SaveError('ungueltig', 'Dieser Platz ist leer oder beschädigt.');
  const wunsch = name ?? (probe ? `Probe: ${e.name}` : `${e.name} (Kopie)`);
  return platzAnlegen(r.game, { name: wunsch, probeVon: probe ? id : null });
}

/** Neuer Name für einen Platz. Gibt den gespeicherten Namen zurück. */
export function umbenennen(id, name) {
  const v = verzeichnis();
  const e = eintrag(v, id);
  if (!e) throw new SaveError('ungueltig', 'Diesen Platz gibt es nicht mehr.');
  const andere = { ...v, plaetze: v.plaetze.filter((p) => p.id !== id) };
  const n = freierName(andere, nameSauber(name, e.name));
  e.name = n;
  // Name auch im Spielstand selbst, damit er in einer exportierten Datei steht
  if (id !== v.aktiv) {
    const t = lesenText(platzKey(id));
    if (t) {
      try {
        const u = JSON.parse(t);
        if (u?.spiel) { u.spiel.harborName = n; schreiben(platzKey(id), JSON.stringify(u)); }
      } catch { /* Name steht dann nur im Verzeichnis */ }
    }
  }
  verzeichnisSchreiben(v);
  return n;
}

function inPapierkorb(v, e) {
  v.papierkorb = [{ ...e, geloescht: jetzt() }, ...(v.papierkorb ?? [])];
  while (v.papierkorb.length > PAPIERKORB_MAX) {
    const alt = v.papierkorb.pop();
    entfernen(platzKey(alt.id));
    entfernen(bildKey(alt.id));
  }
}

/** Legt einen Platz, der nicht aktiv ist, in den Papierkorb. */
export function loeschen(id) {
  const v = verzeichnis();
  if (id === v.aktiv) throw new SaveError('aktiv', 'Der laufende Hafen kann nicht gelöscht werden. Wechsle zuerst zu einem anderen.');
  const e = eintrag(v, id);
  if (!e) return;
  v.plaetze = v.plaetze.filter((p) => p.id !== id);
  for (const p of v.plaetze) if (p.probeVon === id) delete p.probeVon;
  const { probeVon, ...rest } = e;
  inPapierkorb(v, rest);
  verzeichnisSchreiben(v);
}

/** Holt einen Hafen aus dem Papierkorb zurück in die Liste. */
export function wiederherstellen(id) {
  const v = verzeichnis();
  const e = (v.papierkorb ?? []).find((p) => p.id === id);
  if (!e) throw new SaveError('ungueltig', 'Dieser Hafen ist nicht mehr im Papierkorb.');
  platzFrei(v);
  if (!lesenText(platzKey(id))) throw new SaveError('ungueltig', 'Die Daten dieses Hafens sind nicht mehr da.');
  const { geloescht, ...rest } = e;
  v.papierkorb = v.papierkorb.filter((p) => p.id !== id);
  rest.name = freierName(v, rest.name);
  v.plaetze.push(rest);
  verzeichnisSchreiben(v);
  return rest.name;
}

/** Löscht einen Hafen aus dem Papierkorb endgültig. */
export function endgueltigLoeschen(id) {
  const v = verzeichnis();
  v.papierkorb = (v.papierkorb ?? []).filter((p) => p.id !== id);
  verzeichnisSchreiben(v);
  entfernen(platzKey(id));
  entfernen(bildKey(id));
}

// ---------------------------------------------------------------------------
// Vorschaubild

export function bildLesen(id) {
  return lesenText(bildKey(id));
}

/** Speichert ein kleines Bild (data-URL) zum Platz. Scheitert still, Bilder sind Beiwerk. */
export function bildSpeichern(id, dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/') || dataUrl.length > 60000) return false;
  try { speicher()?.setItem(bildKey(id), dataUrl); return true; } catch { return false; }
}

// ---------------------------------------------------------------------------
// Alles zusammen als eine Datei

/** Alle Häfen (ohne Papierkorb) als Liste { name, spiel } für den Gesamt-Export. */
export function alleStaende() {
  const v = verzeichnis();
  return v.plaetze.map((p) => ({ name: p.name, spiel: platzLesen(p.id)?.game })).filter((x) => x.spiel);
}

/** Ungefährer Speicherbedarf aller Spielstände in Byte (localStorage zählt meist 2 Byte je Zeichen). */
export function belegt() {
  const s = speicher();
  if (!s || typeof s.key !== 'function') return null;
  let n = 0;
  try {
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k?.startsWith('hafenmeister.')) n += (k.length + (s.getItem(k)?.length ?? 0)) * 2;
    }
  } catch { return null; }
  return n;
}

/** Schreibt einen Spielzustand auf einen anderen Platz (überschreiben). */
export function ueberschreiben(id, game) {
  const v = verzeichnis();
  const e = eintrag(v, id);
  if (!e) throw new SaveError('ungueltig', 'Diesen Platz gibt es nicht mehr.');
  if (id === v.aktiv) throw new SaveError('aktiv', 'Das ist der laufende Hafen.');
  const n = freierName({ ...v, plaetze: v.plaetze.filter((p) => p.id !== id) }, nameSauber(game?.harborName));
  // Der bisherige Stand kommt in den Papierkorb, falls man sich vertan hat
  const altText = lesenText(platzKey(id));
  if (altText) {
    const altId = neueId(v);
    try {
      schreiben(platzKey(altId), altText);
      const { probeVon, ...rest } = e;
      inPapierkorb(v, { ...rest, id: altId, name: `${e.name} (überschrieben)` });
      const bild = bildLesen(id);
      if (bild) bildSpeichern(altId, bild);
    } catch { /* kein Platz für die Sicherung: trotzdem überschreiben, wie gewünscht */ }
  }
  schreiben(platzKey(id), JSON.stringify(wrap({ ...game, harborName: n })));
  entfernen(bildKey(id));
  e.name = n;
  e.info = infoAus(game);
  e.gespielt = jetzt();
  delete e.probeVon;
  verzeichnisSchreiben(v);
}

/**
 * Macht einen anderen Platz zum aktiven. laufend = aktueller Spielzustand (wird vorher
 * gespeichert), null im Testmodus. Danach speichert dieser Tab nichts mehr: der Aufrufer
 * lädt die Seite neu.
 */
export function wechseln(ziel, laufend = null) {
  if (laufend && diesesTabAktiv()) speichernAktiv(laufend);
  const v = verzeichnis();
  if (!eintrag(v, ziel)) throw new SaveError('ungueltig', 'Diesen Platz gibt es nicht mehr.');
  if (!diesesTabAktiv()) throw new SaveError('anderer-tab', 'Das Spiel ist in einem anderen Fenster offen. Bitte diese Seite neu laden.');
  if (ziel === v.aktiv) { gesperrt = true; return; }
  const zielText = lesenText(platzKey(ziel));
  try { unwrap(JSON.parse(zielText)); } catch {
    throw new SaveError('ungueltig', 'Dieser Platz ist beschädigt und kann nicht geladen werden.');
  }
  const alt = v.aktiv;
  const altText = lesenText(KEY_SAVE);
  // 1. laufenden Stand auf seinen eigenen Platz kopieren
  if (altText !== null) schreiben(platzKey(alt), altText);
  // 2. Ziel in den aktiven Stand kopieren
  try {
    schreiben(KEY_SAVE, zielText);
  } catch (err) {
    if (altText !== null) entfernen(platzKey(alt));
    throw err;
  }
  // 3. Verzeichnis umstellen
  v.aktiv = ziel;
  const e = eintrag(v, ziel);
  e.gespielt = jetzt();
  try {
    verzeichnisSchreiben(v);
  } catch (err) {
    if (altText !== null) { try { schreiben(KEY_SAVE, altText); } catch { /* bleibt auf dem Platz */ } }
    throw err;
  }
  gesperrt = true;
  // 4. aufräumen: Ziel liegt jetzt unter KEY_SAVE, Sicherung gehört zum alten Platz
  entfernen(platzKey(ziel));
  try { speicher()?.setItem(KEY_BACKUP, zielText); } catch { entfernen(KEY_BACKUP); }
  meinPlatz = ziel;
}

/**
 * Probe übernehmen: Der laufende Probe-Hafen ersetzt sein Original. Das Original bekommt
 * den Stand der Probe, die Probe verschwindet aus der Liste. Kein Neuladen nötig.
 * Gibt den Namen zurück, unter dem weitergespielt wird.
 */
export function probeUebernehmen(laufend) {
  const v = verzeichnis();
  const probe = eintrag(v, v.aktiv);
  if (!probe?.probeVon) throw new SaveError('ungueltig', 'Das ist keine Probe-Kopie.');
  const original = eintrag(v, probe.probeVon);
  if (!original) {
    delete probe.probeVon;
    probe.name = nameSauber(probe.name.replace(/^Probe: /, ''));
    verzeichnisSchreiben(v);
    if (laufend) { laufend.harborName = probe.name; speichernAktiv(laufend); }
    return probe.name;
  }
  // Probe-Eintrag übernimmt id und Namen des Originals, damit die Reihenfolge bleibt
  original.info = probe.info;
  original.gespielt = jetzt();
  v.plaetze = v.plaetze.filter((p) => p.id !== probe.id);
  v.aktiv = original.id;
  verzeichnisSchreiben(v);
  entfernen(platzKey(original.id));
  meinPlatz = original.id;
  if (laufend) { laufend.harborName = original.name; speichernAktiv(laufend); }
  return original.name;
}

/**
 * Probe verwerfen: zurück zum Original (Neuladen nötig), die Probe wird gelöscht.
 * Gibt die id des Originals zurück.
 */
export function probeVerwerfen() {
  const v = verzeichnis();
  const probe = eintrag(v, v.aktiv);
  if (!probe?.probeVon || !eintrag(v, probe.probeVon)) {
    throw new SaveError('ungueltig', 'Das Original dieser Probe gibt es nicht mehr.');
  }
  const ziel = probe.probeVon;
  wechseln(ziel, null);
  loeschen(probe.id);
  return ziel;
}

/** Spielstand aus einer Datei als neuer Platz. Gibt die id zurück. */
export function importieren(game, name = game?.harborName) {
  return platzAnlegen(game, { name: nameSauber(name, 'Geladener Hafen') });
}

// ---------------------------------------------------------------------------
// Beschädigter Spielstand

let kaputtImTab = null; // falls der Browser die Kopie nicht speichern kann

/**
 * Hebt den Text eines Spielstands auf, der sich nicht laden ließ, damit ihn das nächste
 * Speichern nicht überschreibt. Der Spieler kann ihn als Datei sichern (Fenster "Spielstände").
 */
export function kaputtMerken(text, name) {
  if (typeof text !== 'string' || !text) return null;
  const k = { zeit: jetzt(), name: name ? nameSauber(name) : null, text };
  kaputtImTab = k;
  try { speicher()?.setItem(KEY_KAPUTT, JSON.stringify(k)); } catch { /* bleibt nur in diesem Tab */ }
  return k;
}

/** Der aufgehobene beschädigte Stand { zeit, name, text } oder null. */
export function kaputtLesen() {
  const t = lesenText(KEY_KAPUTT);
  if (t !== null) {
    try {
      const k = JSON.parse(t);
      if (k && typeof k.text === 'string') return k;
    } catch { /* unten */ }
  }
  return kaputtImTab;
}

/** Aufgehobenen beschädigten Stand wegwerfen. */
export function kaputtVerwerfen() {
  kaputtImTab = null;
  entfernen(KEY_KAPUTT);
}

/** Umschlag-Text eines Platzes (für Tests und Export). */
export function _platzText(id) {
  return platzText(verzeichnis(), id);
}
