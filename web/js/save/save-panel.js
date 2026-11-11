// Kleines Fenster "Spielstand": Exportieren, Importieren, als App installieren.
// Eigenständig mit eigenem Stil, damit es vor der fertigen Oberfläche nutzbar ist.
// Die UI-Threads können es später in ihr Menü übernehmen oder neu gestalten.
//
// Einbindung:
//   import { openSavePanel, showExportReminderIfDue } from './save/save-panel.js';
//   openSavePanel({ getGame: () => state, onImport: (game) => { state = game; neuZeichnen(); } });
//   showExportReminderIfDue({ getGame: () => state });   // einmal nach dem Laden

import { exportGame, pickAndImport, saveGame, SaveError, daysSinceExport } from './storage.js';
import {
  installState, promptInstall, onInstallStateChange, exportReminderDue, IOS_INSTALL_TEXT,
} from './pwa.js';

const CSS = `
.hm-save-backdrop{position:fixed;inset:0;background:rgba(10,30,45,.45);display:flex;
  align-items:center;justify-content:center;padding:16px;z-index:1000;
  padding-bottom:max(16px,env(safe-area-inset-bottom))}
.hm-save{background:#fff;color:#16324a;border-radius:14px;max-width:420px;width:100%;
  padding:20px;box-shadow:0 10px 30px rgba(0,0,0,.25);font:16px/1.45 system-ui,sans-serif}
.hm-save h2{margin:0 0 6px;font-size:20px}
.hm-save p{margin:0 0 14px}
.hm-save .hm-info{font-size:14px;color:#4a6378}
.hm-save .hm-msg{min-height:1.4em;font-size:14px;margin:4px 0 12px}
.hm-save .hm-msg.fehler{color:#b3261e}
.hm-save button{display:block;width:100%;min-height:48px;margin:0 0 10px;border:0;border-radius:10px;
  font:600 16px system-ui,sans-serif;background:#1f5f8b;color:#fff;cursor:pointer}
.hm-save button.zweit{background:#e3eef5;color:#16324a}
.hm-save button:focus-visible{outline:3px solid #f2b705;outline-offset:2px}
.hm-banner{position:fixed;left:50%;transform:translateX(-50%);bottom:max(12px,env(safe-area-inset-bottom));
  width:calc(100% - 32px);max-width:520px;background:#16324a;color:#fff;border-radius:12px;padding:12px 14px;
  display:flex;gap:10px;align-items:center;z-index:999;font:15px/1.4 system-ui,sans-serif}
.hm-banner span{flex:1}
.hm-banner button{min-height:44px;border:0;border-radius:8px;padding:0 14px;font:600 15px system-ui,sans-serif;
  background:#f2b705;color:#16324a;cursor:pointer}
.hm-banner button.zu{background:transparent;color:#fff}
`;

function ensureStyle() {
  if (document.getElementById('hm-save-style')) return;
  const s = document.createElement('style');
  s.id = 'hm-save-style';
  s.textContent = CSS;
  document.head.appendChild(s);
}

function el(tag, props = {}, text = '') {
  const e = document.createElement(tag);
  Object.assign(e, props);
  if (text) e.textContent = text;
  return e;
}

function exportInfo() {
  const t = daysSinceExport();
  if (t === null) return 'Noch nie als Datei gesichert.';
  if (t === 0) return 'Zuletzt heute als Datei gesichert.';
  return t === 1 ? 'Zuletzt gestern als Datei gesichert.' : `Zuletzt vor ${t} Tagen als Datei gesichert.`;
}

/**
 * Öffnet das Fenster. getGame liefert den aktuellen Spielzustand,
 * onImport(game) übernimmt einen importierten Stand (vorher wird gefragt).
 * Gibt eine Funktion zum Schließen zurück.
 */
export function openSavePanel({ getGame, onImport }) {
  ensureStyle();
  const backdrop = el('div', { className: 'hm-save-backdrop' });
  const box = el('div', { className: 'hm-save', role: 'dialog' });
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-labelledby', 'hm-save-title');
  const msg = el('p', { className: 'hm-msg', role: 'status' });
  const info = el('p', { className: 'hm-info' }, exportInfo());

  const say = (text, fehler = false) => {
    msg.textContent = text;
    msg.classList.toggle('fehler', fehler);
  };

  const btnExport = el('button', { type: 'button' }, 'Spielstand als Datei sichern');
  btnExport.addEventListener('click', async () => {
    try {
      const r = await exportGame(getGame());
      if (r !== 'abgebrochen') {
        say('Gesichert. Die Datei kannst du auf jedem Gerät wieder laden.');
        info.textContent = exportInfo();
      }
    } catch (err) {
      say(err instanceof SaveError ? err.message : 'Sichern hat nicht geklappt.', true);
    }
  });

  const btnImport = el('button', { type: 'button', className: 'zweit' }, 'Spielstand aus Datei laden');
  btnImport.addEventListener('click', async () => {
    try {
      const game = await pickAndImport();
      if (!confirm('Der geladene Spielstand ersetzt dein aktuelles Spiel. Fortfahren?')) return;
      onImport(game);
      saveGame(game);
      say('Spielstand geladen.');
    } catch (err) {
      if (err instanceof SaveError && err.code === 'abgebrochen') return;
      say(err instanceof SaveError ? err.message : 'Die Datei konnte nicht gelesen werden.', true);
    }
  });

  const btnInstall = el('button', { type: 'button', className: 'zweit' }, 'Als App installieren');
  const installHint = el('p', { className: 'hm-info' });
  const renderInstall = (state) => {
    btnInstall.hidden = state !== 'bereit';
    installHint.hidden = state !== 'ios-anleitung';
    installHint.textContent = state === 'ios-anleitung' ? IOS_INSTALL_TEXT : '';
  };
  btnInstall.addEventListener('click', async () => {
    if (await promptInstall() === 'angenommen') say('Installiert. Du findest das Spiel jetzt bei deinen Apps.');
  });
  renderInstall(installState());
  const unsub = onInstallStateChange(renderInstall);

  const btnClose = el('button', { type: 'button', className: 'zweit' }, 'Schließen');

  box.append(
    el('h2', { id: 'hm-save-title' }, 'Spielstand'),
    el('p', {}, 'Dein Spiel wird automatisch im Browser gespeichert. Sichere es ab und zu als Datei, dann geht nichts verloren.'),
    info, msg, btnExport, btnImport, installHint, btnInstall, btnClose,
  );
  backdrop.appendChild(box);
  document.body.appendChild(backdrop);

  const onKey = (e) => { if (e.key === 'Escape') close(); };
  function close() {
    unsub();
    document.removeEventListener('keydown', onKey);
    backdrop.remove();
  }
  btnClose.addEventListener('click', close);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  document.addEventListener('keydown', onKey);
  btnExport.focus();
  return close;
}

/**
 * Zeigt auf iPhone/iPad im Safari-Tab einen Hinweis, wenn länger nicht als Datei
 * gesichert wurde. Safari löscht Daten nach 7 Tagen ohne Besuch.
 * Gibt true zurück, wenn der Hinweis angezeigt wird.
 */
export function showExportReminderIfDue({ getGame, nachTagen = 5 }) {
  if (!exportReminderDue({ nachTagen })) return false;
  ensureStyle();
  const bar = el('div', { className: 'hm-banner', role: 'status' });
  const text = el('span', {}, 'Safari löscht Spielstände nach 7 Tagen ohne Besuch. Jetzt als Datei sichern?');
  const ok = el('button', { type: 'button' }, 'Sichern');
  const zu = el('button', { type: 'button', className: 'zu', ariaLabel: 'Hinweis schließen' }, 'Später');
  ok.addEventListener('click', async () => {
    try {
      if (await exportGame(getGame()) !== 'abgebrochen') bar.remove();
    } catch { /* Fenster bleibt offen */ }
  });
  zu.addEventListener('click', () => bar.remove());
  bar.append(text, ok, zu);
  document.body.appendChild(bar);
  return true;
}
