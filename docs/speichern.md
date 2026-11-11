# Spielstand und Web-App

Stand: 11.11.2026

## Warum

Safari auf iPhone und iPad löscht alles, was eine Seite im Browser gespeichert hat, wenn sie 7 Tage nicht besucht wurde. Ein Spielstand nur in `localStorage` wäre nach einer Woche Pause weg. Zwei Wege dagegen:

1. **Als App installieren** (Home-Bildschirm). Für installierte Web-Apps gilt die 7-Tage-Regel nicht. Dazu braucht das Spiel ein Manifest und einen Service Worker. Nebenbei startet es dann auch ohne Netz.
2. **Spielstand als Datei sichern** (Export und Import). Hilft auch beim Umzug auf ein anderes Gerät, bis es einen Online-Spielstand gibt.

## Dateien

| Datei | Aufgabe |
|---|---|
| `web/manifest.webmanifest` | Name, Farben, Icons, `start_url` und `scope` relativ (`./`) |
| `web/sw.js` | Service Worker: eigene Dateien zuerst aus dem Netz, ohne Netz aus dem Cache. CDN-Bibliotheken mit fester Version zuerst aus dem Cache. Supabase und Ähnliches wird nicht angefasst. |
| `web/icons/` | `icon.svg` (Vorlage), PNG in 192 und 512, `icon-maskable-512.png` für Android, `apple-touch-icon.png` (180) für iOS |
| `web/js/save/storage.js` | Speichern, Laden, Sicherung des vorigen Stands, Export und Import, Versionsnummer und Umbau alter Stände |
| `web/js/save/pwa.js` | Service Worker anmelden, Update melden, Installation anbieten, Erkennung iOS und App-Modus |
| `web/js/save/save-panel.js` | Fertiges Fenster "Spielstand" (Sichern, Laden, Installieren) und Erinnerung für Safari |
| `tests/speichern.test.mjs` | Tests für `storage.js` |

## Einbindung (für das Grundgerüst)

In `web/index.html` im `<head>`:

```html
<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#1f5f8b">
<link rel="icon" href="icons/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Hafenmeister">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
```

In `web/js/main.js`:

```js
import { startPwa } from './save/pwa.js';
import { saveGame, loadGame, requestPersistentStorage } from './save/storage.js';
import { openSavePanel, showExportReminderIfDue } from './save/save-panel.js';

// Laden: geladen.game ist genau das Objekt, das vorher an saveGame ging.
const geladen = loadGame();            // null, wenn es noch keinen Stand gibt
let state = geladen ? geladen.game : neuesSpiel();

// Nach jedem Abend (und beim Verlassen der Seite) speichern:
saveGame(state);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveGame(state);
});

// Service Worker und Updates. apply() lädt neu, darum vorher speichern.
startPwa({
  onUpdate: (apply) => zeigeHinweis('Neue Version verfügbar', () => { saveGame(state); apply(); }),
});
requestPersistentStorage();

// Menüpunkt "Spielstand":
menuSpielstand.onclick = () => openSavePanel({
  getGame: () => state,
  onImport: (game) => { state = game; neuZeichnen(); },
});

// Einmal nach dem Start: Erinnerung im Safari-Tab, wenn 5 Tage nicht gesichert.
showExportReminderIfDue({ getGame: () => state });
```

`neuesSpiel`, `zeigeHinweis`, `menuSpielstand` und `neuZeichnen` sind Platzhalter für das, was Grundgerüst und Oberfläche bereitstellen.

## Regeln für den Spielzustand

- `saveGame(state)` erwartet ein einfaches Objekt, das sich mit `JSON.stringify` speichern lässt (keine Klassen, keine `Map`, keine Verweise auf Three.js).
- Ändert sich das Format von `state.js` so, dass alte Stände nicht mehr passen, `SAVE_VERSION` in `storage.js` erhöhen und in `MIGRATIONS` eintragen, wie ein alter Stand umgebaut wird. Dann gehen weder gespeicherte noch exportierte Stände verloren.
- Stände aus einer neueren Spielversion werden abgelehnt (`SaveError` mit `code: 'zu-neu'`), statt sie falsch zu lesen.

## Format der Datei

```json
{
  "format": "hafenmeister-spielstand",
  "version": 1,
  "gespeichert": "2026-11-11T20:00:00.000Z",
  "spiel": { }
}
```

Dateiname: `hafenmeister-JJJJ-MM-TT.json`. Auf Handy und Tablet öffnet "Sichern" das Teilen-Menü (In Dateien sichern, per Nachricht schicken), am PC wird die Datei heruntergeladen.

## Service Worker und Updates

- Bei jeder Änderung an `web/sw.js` die Zeile `const VERSION = 'v1';` hochzählen. Für Spielcode ist das nicht nötig: Eigene Dateien kommen immer zuerst frisch aus dem Netz.
- Beim ersten Besuch wird der Service Worker sofort aktiv. Spätere Versionen warten, bis das Spiel `apply()` aufruft, damit kein laufendes Spiel mitten im Abend neu lädt.
- Neue Bibliotheken vom CDN nur mit fester Version einbinden (`three@0.187.0`), sonst werden sie nicht offline gespeichert.

## Testen

Tests für das Speichermodul (Node 22 oder neuer, im Repo-Ordner):

```bash
node --test tests/speichern.test.mjs
```

Im Browser unter dem Unterpfad wie auf GitHub Pages (Anleitung in `docs/veroeffentlichen.md`, sobald der Pages-Branch gemergt ist):

```bash
rm -rf /tmp/pages-test && mkdir -p /tmp/pages-test && cp -R web /tmp/pages-test/hafenmeister
python3 -m http.server 8000 --directory /tmp/pages-test
```

Dann `http://localhost:8000/hafenmeister/` öffnen. In den Entwicklertools unter **Application** zeigen **Manifest** und **Service workers**, ob alles erkannt wird. Ein Service Worker läuft nur über `https://` oder `localhost`, nicht über eine IP-Adresse im WLAN. Auf dem Handy lässt sich die Installation darum erst auf GitHub Pages testen.
