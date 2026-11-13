// Installierbare Web-App: Service Worker anmelden, Updates melden,
// Installation anbieten und den Export-Hinweis für Safari steuern.
//
// Einbindung in js/main.js (Grundgerüst):
//   import { startPwa } from './save/pwa.js';
//   startPwa({ onUpdate: (apply) => zeigeHinweis('Neue Version da', apply) });

import { daysSinceExport, hasSave } from './storage.js';

/** true, wenn das Spiel als App vom Home-Bildschirm läuft. */
export function isStandalone() {
  try {
    if (globalThis.matchMedia && globalThis.matchMedia('(display-mode: standalone)').matches) return true;
  } catch { /* weiter */ }
  return globalThis.navigator ? navigator.standalone === true : false;
}

/** true auf iPhone und iPad (auch iPad mit Desktop-Kennung). */
export function isIOS() {
  if (!globalThis.navigator) return false;
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

/**
 * Wann der Export-Hinweis erscheinen soll.
 * Nur im Safari-Tab auf iOS (nicht als App), sobald ein Spielstand existiert
 * und der letzte Export mindestens `nachTagen` her ist oder nie war.
 * Safari löscht nach 7 Tagen ohne Besuch, darum Standard 5 Tage.
 */
export function exportReminderDue({ nachTagen = 5, now = new Date() } = {}) {
  if (!isIOS() || isStandalone() || !hasSave()) return false;
  const tage = daysSinceExport(now);
  return tage === null || tage >= nachTagen;
}

// ---------------------------------------------------------------------------
// Installation

let deferredPrompt = null;
const installListeners = new Set();

function notifyInstall() {
  const state = installState();
  for (const fn of installListeners) fn(state);
}

/**
 * Was der Installieren-Knopf zeigen soll:
 *  'installiert'  läuft schon als App
 *  'bereit'       Browser bietet Installation an (Chrome, Edge, Android)
 *  'ios-anleitung' iPhone/iPad: Teilen > Zum Home-Bildschirm
 *  'nicht-moeglich' Browser kann es nicht oder hat es noch nicht angeboten
 */
export function installState() {
  if (isStandalone()) return 'installiert';
  if (deferredPrompt) return 'bereit';
  if (isIOS()) return 'ios-anleitung';
  return 'nicht-moeglich';
}

/** Ruft fn(state) auf, sobald sich installState() ändert. Gibt eine Abmeldefunktion zurück. */
export function onInstallStateChange(fn) {
  installListeners.add(fn);
  return () => installListeners.delete(fn);
}

/** Zeigt den Installationsdialog des Browsers. Gibt 'angenommen' oder 'abgelehnt' zurück. */
export async function promptInstall() {
  if (!deferredPrompt) return 'abgelehnt';
  const p = deferredPrompt;
  deferredPrompt = null;
  p.prompt();
  const { outcome } = await p.userChoice;
  notifyInstall();
  return outcome === 'accepted' ? 'angenommen' : 'abgelehnt';
}

export const IOS_INSTALL_TEXT =
  'Im Safari unten auf Teilen tippen, dann "Zum Home-Bildschirm". ' +
  'Als App bleibt dein Spielstand erhalten, auch wenn du länger nicht spielst.';

// ---------------------------------------------------------------------------
// Service Worker

let started = false;

/**
 * Meldet den Service Worker an und hört auf Installation und Updates.
 * onUpdate(apply) wird aufgerufen, wenn eine neue Version bereitliegt.
 * apply() aktiviert sie und lädt die Seite neu. Erst aufrufen, wenn gespeichert ist.
 */
export function startPwa({ onUpdate = null, swUrl = 'sw.js' } = {}) {
  if (started || !globalThis.window) return;
  started = true;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    notifyInstall();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notifyInstall();
  });

  if (!('serviceWorker' in navigator)) return;
  // Kein Service Worker bei file:// oder unsicheren Seiten (außer localhost).
  if (!globalThis.isSecureContext) return;

  // Pfad relativ zur Seite, damit es unter /hafenmeister/ funktioniert.
  const url = new URL(swUrl, document.baseURI);
  const scope = new URL('./', url).pathname;

  const register = async () => {
    try {
      const reg = await navigator.serviceWorker.register(url.href, { scope });
      // Manche Umgebungen (gesperrte Service Worker, Tests) liefern keine Anmeldung zurück
      if (!reg) return;
      watchForUpdate(reg, onUpdate);
      // Bei längeren Sitzungen stündlich nach Updates sehen.
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    } catch (err) {
      console.warn('Service Worker nicht angemeldet:', err);
    }
  };

  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}

function watchForUpdate(reg, onUpdate) {
  const offer = (worker) => {
    if (!onUpdate || !worker || !navigator.serviceWorker.controller) return;
    onUpdate(() => {
      navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
      worker.postMessage({ typ: 'aktivieren' });
    });
  };

  if (reg.waiting) offer(reg.waiting);
  reg.addEventListener('updatefound', () => {
    const worker = reg.installing;
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed') offer(worker);
    });
  });
}
