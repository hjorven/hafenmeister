// Spielstand speichern, laden, exportieren und importieren.
//
// Kennt die Spielregeln nicht: Der Spielzustand (aus js/state.js) wird als
// einfaches JSON-Objekt übergeben und unverändert wieder herausgegeben.
// Alle Pfade sind relativ, damit das Spiel unter /hafenmeister/ läuft.
//
// Hintergrund: Safari auf iPhone und iPad löscht localStorage von Seiten,
// die 7 Tage nicht besucht wurden. Als App auf dem Home-Bildschirm gilt das
// nicht. Darum gibt es zusätzlich Export und Import als Datei.

export const SAVE_FORMAT = 'hafenmeister-spielstand';
export const SAVE_VERSION = 1;

const KEY_SAVE = 'hafenmeister.spielstand';
const KEY_BACKUP = 'hafenmeister.spielstand.vorher';
const KEY_META = 'hafenmeister.meta';

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

// Umbauten alter Spielstände: MIGRATIONS[n] macht aus Version n die Version n+1.
// Wer das Format von state.js ändert, erhöht SAVE_VERSION und trägt hier ein,
// wie ein alter Stand umgebaut wird. Beispiel:
//   MIGRATIONS[1] = (game) => ({ ...game, ruf: game.ruf ?? 3 });
const MIGRATIONS = {};

export class SaveError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'SaveError';
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Speicher-Zugriff (austauschbar für Tests)

let store = null;

function defaultStore() {
  try {
    const s = globalThis.localStorage;
    const probe = '__hafenmeister_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null; // privater Modus, Speicher gesperrt oder kein Browser
  }
}

function getStore() {
  if (store === null) store = defaultStore();
  return store;
}

/** Nur für Tests: anderen Speicher mit getItem/setItem/removeItem setzen. */
export function _setStore(s) {
  store = s;
}

/** true, wenn der Browser überhaupt speichern darf. */
export function storageAvailable() {
  return getStore() !== null;
}

// ---------------------------------------------------------------------------
// Umschlag: Format, Version, Zeit, Spielzustand

export function wrap(game, now = new Date()) {
  if (game === null || typeof game !== 'object' || Array.isArray(game)) {
    throw new SaveError('ungueltig', 'Der Spielzustand muss ein Objekt sein.');
  }
  return {
    format: SAVE_FORMAT,
    version: SAVE_VERSION,
    gespeichert: now.toISOString(),
    spiel: game,
  };
}

/**
 * Prüft einen Umschlag, baut ältere Versionen um und gibt den Spielzustand zurück.
 * Wirft SaveError mit code 'ungueltig' oder 'zu-neu'.
 */
export function unwrap(data) {
  if (data === null || typeof data !== 'object') {
    throw new SaveError('ungueltig', 'Das ist kein Hafenmeister-Spielstand.');
  }
  if (data.format !== SAVE_FORMAT) {
    throw new SaveError('ungueltig', 'Das ist kein Hafenmeister-Spielstand.');
  }
  let version = data.version;
  if (!Number.isInteger(version) || version < 1) {
    throw new SaveError('ungueltig', 'Der Spielstand hat keine gültige Version.');
  }
  if (version > SAVE_VERSION) {
    throw new SaveError('zu-neu',
      'Dieser Spielstand stammt aus einer neueren Version des Spiels. Bitte die Seite neu laden.');
  }
  let game = data.spiel;
  if (game === null || typeof game !== 'object' || Array.isArray(game)) {
    throw new SaveError('ungueltig', 'Der Spielstand ist beschädigt.');
  }
  while (version < SAVE_VERSION) {
    const step = MIGRATIONS[version];
    if (typeof step !== 'function') {
      throw new SaveError('ungueltig', `Spielstand Version ${version} kann nicht umgebaut werden.`);
    }
    game = step(game);
    version += 1;
  }
  return { game, savedAt: typeof data.gespeichert === 'string' ? data.gespeichert : null };
}

function parse(text) {
  try {
    return JSON.parse(text);
  } catch {
    throw new SaveError('ungueltig', 'Die Datei ist kein gültiger Spielstand.');
  }
}

// ---------------------------------------------------------------------------
// Speichern und Laden im Browser

/**
 * Speichert den Spielzustand. Der vorige Stand bleibt als Sicherung erhalten.
 * Gibt true zurück, wenn gespeichert wurde, sonst false (Speicher voll oder gesperrt).
 */
export function saveGame(game) {
  const s = getStore();
  const text = JSON.stringify(wrap(game));
  if (!s) return false;
  try {
    const previous = s.getItem(KEY_SAVE);
    if (previous !== null) s.setItem(KEY_BACKUP, previous);
    s.setItem(KEY_SAVE, text);
    updateMeta({ zuletztGespeichert: new Date().toISOString() });
    return true;
  } catch {
    return false; // QuotaExceededError oder gesperrt
  }
}

/**
 * Lädt den letzten Spielstand. Ist er beschädigt, wird die Sicherung versucht.
 * Gibt { game, savedAt, ausSicherung } oder null zurück.
 */
export function loadGame() {
  const s = getStore();
  if (!s) return null;
  for (const [key, ausSicherung] of [[KEY_SAVE, false], [KEY_BACKUP, true]]) {
    let text = null;
    try { text = s.getItem(key); } catch { text = null; }
    if (text === null) continue;
    try {
      const { game, savedAt } = unwrap(parse(text));
      return { game, savedAt, ausSicherung };
    } catch {
      // beschädigt oder unbekannt: nächsten Versuch
    }
  }
  return null;
}

/** true, wenn ein Spielstand im Browser liegt. */
export function hasSave() {
  const s = getStore();
  if (!s) return false;
  try { return s.getItem(KEY_SAVE) !== null; } catch { return false; }
}

/** Löscht Spielstand und Sicherung (neues Spiel). */
export function clearSave() {
  const s = getStore();
  if (!s) return;
  try {
    s.removeItem(KEY_SAVE);
    s.removeItem(KEY_BACKUP);
  } catch { /* nichts zu tun */ }
}

// ---------------------------------------------------------------------------
// Zusatzdaten: wann zuletzt gespeichert und exportiert

export function readMeta() {
  const s = getStore();
  if (!s) return {};
  try {
    const m = JSON.parse(s.getItem(KEY_META) || '{}');
    return m && typeof m === 'object' ? m : {};
  } catch {
    return {};
  }
}

function updateMeta(patch) {
  const s = getStore();
  if (!s) return;
  try {
    s.setItem(KEY_META, JSON.stringify({ ...readMeta(), ...patch }));
  } catch { /* egal */ }
}

/** Ganze Tage seit dem letzten Export, oder null, wenn noch nie exportiert. */
export function daysSinceExport(now = new Date()) {
  const t = Date.parse(readMeta().zuletztExportiert || '');
  if (Number.isNaN(t)) return null;
  return Math.floor((now.getTime() - t) / 86400000);
}

// ---------------------------------------------------------------------------
// Export und Import als Datei

/** Dateiname wie hafenmeister-2026-11-11.json (lokales Datum). */
export function exportFileName(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `hafenmeister-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.json`;
}

/** Spielstand als Text, z.B. zum Kopieren. */
export function exportText(game) {
  return JSON.stringify(wrap(game), null, 1);
}

/** Text aus einer Datei oder Zwischenablage zurück in einen Spielzustand. */
export function importText(text) {
  if (typeof text !== 'string' || text.trim() === '') {
    throw new SaveError('ungueltig', 'Die Datei ist leer.');
  }
  if (text.length > MAX_IMPORT_BYTES) {
    throw new SaveError('ungueltig', 'Die Datei ist zu groß für einen Spielstand.');
  }
  return unwrap(parse(text.replace(/^﻿/, ''))).game;
}

/**
 * Bietet den Spielstand als Datei an.
 * Auf Handy und Tablet öffnet sich, wo möglich, das Teilen-Menü
 * (In Dateien sichern, per Nachricht schicken). Sonst normaler Download.
 * Gibt 'geteilt', 'heruntergeladen' oder 'abgebrochen' zurück.
 */
export async function exportGame(game, { preferShare = isTouchDevice() } = {}) {
  const name = exportFileName();
  const text = exportText(game);
  const blob = new Blob([text], { type: 'application/json' });

  if (preferShare && typeof File === 'function' && navigator.canShare) {
    const file = new File([blob], name, { type: 'application/json' });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Hafenmeister Spielstand' });
        updateMeta({ zuletztExportiert: new Date().toISOString() });
        return 'geteilt';
      } catch (err) {
        if (err && err.name === 'AbortError') return 'abgebrochen';
        // sonst unten per Download weiter
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  updateMeta({ zuletztExportiert: new Date().toISOString() });
  return 'heruntergeladen';
}

/** Liest eine gewählte Datei (File) und gibt den Spielzustand zurück. */
export async function importFile(file) {
  if (!file) throw new SaveError('abgebrochen', 'Keine Datei gewählt.');
  if (file.size > MAX_IMPORT_BYTES) {
    throw new SaveError('ungueltig', 'Die Datei ist zu groß für einen Spielstand.');
  }
  return importText(await file.text());
}

/**
 * Öffnet die Dateiauswahl und gibt den Spielzustand der gewählten Datei zurück.
 * Muss direkt aus einem Klick oder Tipp heraus aufgerufen werden.
 * Ohne accept-Filter, weil iOS .json-Dateien sonst teils ausgraut.
 */
export function pickAndImport() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.style.display = 'none';
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      input.remove();
      if (!file) {
        reject(new SaveError('abgebrochen', 'Keine Datei gewählt.'));
        return;
      }
      importFile(file).then(resolve, reject);
    }, { once: true });
    input.addEventListener('cancel', () => {
      input.remove();
      reject(new SaveError('abgebrochen', 'Keine Datei gewählt.'));
    }, { once: true });
    document.body.appendChild(input);
    input.click();
  });
}

// ---------------------------------------------------------------------------
// Dauerhaften Speicher anfragen

/**
 * Bittet den Browser, die Daten nicht automatisch zu löschen.
 * Chrome und Firefox entscheiden selbst, Safari ignoriert es meist.
 * Gibt true zurück, wenn der Speicher als dauerhaft gilt.
 */
export async function requestPersistentStorage() {
  try {
    if (!navigator.storage || !navigator.storage.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

function isTouchDevice() {
  try {
    return globalThis.matchMedia ? globalThis.matchMedia('(pointer: coarse)').matches : false;
  } catch {
    return false;
  }
}
