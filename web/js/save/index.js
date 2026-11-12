// Einstieg für den Modul-Lader in js/main.js (Eintrag './save/index.js').
// Startet Service Worker und Installation und hängt game.spielstand an.
//
// Andere Module nutzen:
//   game.spielstand.speichern(zustand)  -> true/false
//   game.spielstand.laden()             -> { game, savedAt, ausSicherung } oder null
//   game.spielstand.oeffnen()           -> Fenster "Spielstand" (für einen Menüknopf)
//   game.spielstand.loeschen()          -> neues Spiel
//
// Der aktuelle Spielzustand wird aus game.state gelesen (setzt js/state.js).
// Nach einem Import wird game.state ersetzt und das Ereignis 'spielstand-geladen'
// mit dem neuen Zustand gesendet, damit state.js und die Oberfläche neu aufbauen.

import { saveGame, loadGame, clearSave, hasSave, requestPersistentStorage } from './storage.js';
import { startPwa } from './pwa.js';
import { openSavePanel, showExportReminderIfDue, showUpdateBanner } from './save-panel.js';

// Für den Fall, dass index.html die Zeilen noch nicht hat. Doppelt schadet nicht.
function ensureHeadLinks() {
  const add = (sel, tag, attrs) => {
    if (document.head.querySelector(sel)) return;
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    document.head.appendChild(e);
  };
  add('link[rel="manifest"]', 'link', { rel: 'manifest', href: 'manifest.webmanifest' });
  add('link[rel="apple-touch-icon"]', 'link', { rel: 'apple-touch-icon', href: 'icons/apple-touch-icon.png' });
  add('link[rel="icon"]', 'link', { rel: 'icon', href: 'icons/icon.svg', type: 'image/svg+xml' });
  add('meta[name="apple-mobile-web-app-title"]', 'meta', { name: 'apple-mobile-web-app-title', content: 'Hafenmeister' });
}

export function init(game) {
  ensureHeadLinks();

  const aktuell = () => game.state;
  // Testmodus ?stufe=n (state.testmodus, js/bridge.js) überschreibt den echten Spielstand nicht
  const speichern = (zustand = aktuell()) => (zustand && !zustand.testmodus ? saveGame(zustand) : false);

  game.spielstand = {
    speichern,
    laden: loadGame,
    vorhanden: hasSave,
    loeschen: clearSave,
    oeffnen: () => openSavePanel({
      getGame: aktuell,
      onImport: (zustand) => {
        game.state = zustand;
        game.emit('spielstand-geladen', zustand);
      },
    }),
  };

  // Beim Verlassen oder Sperren des Handys sichern, falls es schon einen Zustand gibt.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') speichern();
  });
  window.addEventListener('pagehide', () => speichern());

  startPwa({
    onUpdate: (apply) => showUpdateBanner(() => { speichern(); apply(); }),
  });
  requestPersistentStorage();

  // Erinnerung erst zeigen, wenn alles geladen ist.
  game.on('ready', () => {
    if (aktuell()) showExportReminderIfDue({ getGame: aktuell });
  });
}
