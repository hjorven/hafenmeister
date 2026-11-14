# Spielstand und Web-App

Stand: 13.11.2026. Status: gebaut, mit Speicherplätzen und Neuem Spiel (Paket P09).

## Warum

Safari auf iPhone und iPad löscht alles, was eine Seite im Browser gespeichert hat, wenn sie 7 Tage nicht besucht wurde. Ein Spielstand nur in `localStorage` wäre nach einer Woche Pause weg. Zwei Wege dagegen:

1. **Als App installieren** (Home-Bildschirm). Für installierte Web-Apps gilt die 7-Tage-Regel nicht. Dazu braucht das Spiel ein Manifest und einen Service Worker. Nebenbei startet es dann auch ohne Netz.
2. **Spielstand als Datei sichern** (Export und Import). Hilft auch beim Umzug auf ein anderes Gerät, bis es einen Online-Spielstand gibt.

## Dateien

| Datei | Aufgabe |
|---|---|
| `web/manifest.webmanifest` | Name, Farben, Icons, `start_url` und `scope` relativ (`./`) |
| `web/sw.js` | Service Worker: eigene Dateien zuerst aus dem Netz, ohne Netz aus dem Cache. Nach jedem Start legt er alle Dateien aus `offline-liste.json` (entsteht beim Deploy, `tools/offline-liste.mjs`) in den Cache, damit das Spiel danach ohne Netz startet; nur bei neuem Stand. Supabase und Ähnliches wird nicht angefasst. |
| `web/icons/` | `icon.svg` (Vorlage), PNG in 192 und 512, `icon-maskable-512.png` für Android, `apple-touch-icon.png` (180) für iOS |
| `web/js/save/storage.js` | Speichern, Laden, Sicherung des vorigen Stands, Export und Import, Versionsnummer und Umbau alter Stände |
| `web/js/save/pwa.js` | Service Worker anmelden, Update melden, Installation anbieten, Erkennung iOS und App-Modus |
| `web/js/save/index.js` | Einstieg für den Modul-Lader, `game.spielstand` |
| `web/js/save/save-panel.js` | Fertiges Fenster "Spielstand" (Sichern, Laden, Installieren) und Erinnerung für Safari |
| `tests/speichern.test.mjs` | Tests für `storage.js` |

## Ein Speicherweg

Gespeichert wird nur über `web/js/save/`. `state.js` legt Spielstände an und prüft sie (`createState`, `deserialize`), speichert aber nicht selbst. Der frühere zweite Weg (`hafenmeister.save` mit Kurztext `HM1:`) ist entfernt:

- Ein Stand unter `hafenmeister.save` wird beim ersten Start einmal übernommen (als aktiver Hafen, oder als eigener Platz "Älterer Hafen", wenn schon ein anderes Spiel läuft) und danach gelöscht. Er hat keine Version und wird wie Version 1 umgebaut (Geländeform 1, Stegbild 0), genau wie ein Kurztext `HM1:`.
- Ein alter Kurztext `HM1:...` (auch in einer Datei) lässt sich weiter über "Aus Datei laden" öffnen.

## Speicherplätze

Bis zu 8 Häfen liegen nebeneinander im Browser (`web/js/save/plaetze.js`, Fenster `save-panel.js`).

| Schlüssel im localStorage | Inhalt |
|---|---|
| `hafenmeister.plaetze` | Verzeichnis: `{ format, aktiv, naechste, plaetze: [...], papierkorb: [...] }` |
| `hafenmeister.spielstand` | Stand des aktiven Hafens (Umschlag wie unten). `data/stegbild.js` und `render/landschaft/formen.js` lesen hier schon vor dem Start. |
| `hafenmeister.spielstand.vorher` | Sicherung vor dem letzten Speichern des aktiven Hafens |
| `hafenmeister.platz.<id>` | Stand jedes anderen Hafens und der Häfen im Papierkorb |
| `hafenmeister.bild.<id>` | Vorschaubild (kleines JPEG), wird abends, beim Wechsel und beim Verlassen erneuert |
| `hafenmeister.kaputt` | Text eines Stands, der sich nicht laden ließ: `{ zeit, name, text }`, bis der Spieler ihn als Datei sichert oder wegwirft |

Eintrag im Verzeichnis: `{ id, name, erstellt, gespielt, info: { stufe, tag, geld, region }, probeVon? }`. Der Name steht zusätzlich im Spielstand als `harborName`, damit er in einer Datei mitreist.

Abläufe:

| Aktion | Was passiert |
|---|---|
| Wechseln, Neues Spiel, Probe-Kopie, Probe verwerfen | laufenden Stand speichern, auf seinen Platz kopieren, Ziel nach `hafenmeister.spielstand` kopieren, Verzeichnis umstellen, erst dann aufräumen; die Seite lädt neu (ohne Testzusätze in der Adresse) |
| Kopieren, Umbenennen, Als Datei sichern | ohne Neuladen |
| Überschreiben | der bisherige Stand des Ziels kommt in den Papierkorb |
| Löschen | in den Papierkorb (die letzten 5), dort zurückholen oder endgültig löschen; ist der Speicher voll, wird zuerst der älteste Eintrag im Papierkorb geopfert, nie ein Hafen |
| Probe übernehmen | die Probe ersetzt ihr Original (Name und Platz des Originals), ohne Neuladen |
| Alle als Datei sichern | eine Datei mit allen Häfen (Format `hafenmeister-sammlung`); "Aus Datei laden" legt jeden als eigenen Platz an |

Schutz: Ein Tab merkt sich beim Start seinen Platz. Hat ein anderer Tab inzwischen gewechselt, speichert er nicht mehr. Ist das Verzeichnis beschädigt, werden die Plätze aus den `hafenmeister.platz.*`-Schlüsseln wiedergefunden.

Neues Spiel: Name (Vorschlag), Stegbild (Zufall oder 1 bis 12), Küste (Zufall oder eine der 10 Geländeformen), Einführung ja oder nein. Die Auswahl steht in `modules.stegbild.nr`, `modules.gelaende.nr` und `modules.einstieg` des neuen Stands. Das Landbild (Felder, Wald, Dorf) folgt aus dem `seed`. Einstellungen (zum Beispiel "Boote fahren selbst ein") gelten je Gerät und bleiben nach einem neuen Spiel erhalten.

Start: Gibt es mehrere Häfen, fragt eine kleine Karte "Weiter" (pausiert bis dahin), "Anderer Hafen" oder "Neues Spiel". Mit nur einem Hafen startet das Spiel direkt.

Gesichert wird außerdem nach jedem Kauf, jedem Bau und jedem Stufenaufstieg, beim Verlassen der Seite und abends.

Beschädigter Stand: Geladen wird mit derselben strengen Prüfung wie `state.js` (`deserialize`). Lässt sich der Stand nicht laden, kommt die Sicherung `hafenmeister.spielstand.vorher` dran, sonst startet ein neues Spiel. In beiden Fällen wird der beschädigte Text unter `hafenmeister.kaputt` aufgehoben (das nächste Speichern überschreibt ihn nicht) und nach dem Start erscheint ein kleines Fenster mit "Als Datei sichern" und "Später". Es liegt über allem, auch über der Einführung, und hält das Spiel an, bis es geschlossen ist. Stammt der Stand aus einer neueren Version des Spiels (Version höher als `SAVE_VERSION`), sagt das Fenster das, und dieser Tab speichert bis zum Neuladen nichts, damit der neuere Stand erhalten bleibt. Im Fenster "Spielstände" bleibt er oben stehen, bis er gesichert und weggeworfen ist. Ist der Speicher voll, weicht diese Kopie als Letztes nach Papierkorb und Vorschaubildern.

Ohne Speicher (privates Fenster, gesperrt, voll): Lässt der Browser nichts speichern oder schlägt das Speichern fehl, sagt ein Fenster (wie oben, Spiel angehalten), dass beim Schließen der Hafen weg ist, mit "Als Datei sichern". Das Fenster "Spielstände" zeigt dann statt "Alles wird automatisch gespeichert" denselben Hinweis.

Prüfung beim Laden: `sim.repairBerths` legt Gäste um, die in einer Box liegen, die es in der aktuellen Stufe nicht gibt oder die zu flach, zu kurz oder zu schmal ist (alte Stände). Ohne freie passende Box reisen sie ohne Rechnung ab.

## Was andere Threads am Spielstandformat beachten müssen

1. Neues Feld in `game.state` oder in `state.modules.<name>`: Startwert in `createState` (oder das Modul setzt ihn beim Laden), alte Stände ohne Feld müssen weiter laden.
2. Ändert sich die Bedeutung eines Felds: `SAVE_VERSION` in `web/js/save/storage.js` erhöhen und in `MIGRATIONS` den Umbau eintragen, mit Test in `tests/speicherplaetze.test.mjs`.
3. Nichts im Spielstand, was sich nicht mit `JSON.stringify` speichern lässt; keine Zufallsquelle außerhalb von `seed`/`rng`.
4. Die Schlüssel `hafenmeister.spielstand` und `hafenmeister.plaetze` nicht umbenennen. Wer vor dem Start etwas aus dem Stand braucht (wie Stegbild und Geländeform), liest `hafenmeister.spielstand` und bekommt dort den aktiven Hafen.
5. Zustand je Gerät (Einstellungen) gehört nicht in den Spielstand, Zustand je Hafen schon.

## Versionen

| Version | Änderung |
|---|---|
| 1 | erster Stand |
| 2 | `modules.gelaende.nr` (Geländeform, alt: 1) und `modules.stegbild.nr` (Stegbild, alt: 0) stehen immer im Stand |
| 3 | `modules.logbuch` (Logbuch und Chronik, P21): altes Logbuch bleibt ohne Tag, die letzten Tage aus `stats.verlauf` kommen in die Chronik ([logbuch.md](logbuch.md)) |

## Einbindung (für das Grundgerüst)

`web/js/save/index.js` ist ein Modul für den Modul-Lader. In `web/js/main.js` kommt in die Liste `MODULES` eine Zeile:

```js
  './save/index.js',
```

Das reicht. `init(game)` meldet den Service Worker an, ergänzt fehlende Manifest- und Icon-Links im `<head>` und hängt `game.spielstand` an:

| Aufruf | Ergebnis |
|---|---|
| `game.spielstand.speichern(zustand)` | speichert, ohne Argument `game.state`; `true` oder `false` |
| `game.spielstand.laden()` | `{ game, savedAt, ausSicherung }` oder `null` |
| `game.spielstand.vorhanden()` | `true`, wenn ein Stand im Browser liegt |
| `game.spielstand.oeffnen()` | Fenster "Spielstände" (Menüknopf, Taste L) |
| `game.spielstand.neuesSpiel()` | Fenster direkt bei "Neues Spiel" |
| `game.spielstand.probeKopie()` | Probe-Kopie anlegen und dorthin wechseln (zum Beispiel vor einem teuren Ausbau) |
| `game.spielstand.platz()` | `{ id, name, probeVon? }` des laufenden Hafens |
| `game.spielstand.plaetze()` | Verzeichnis aller Plätze |

Ereignis `spielstand-geladen`: wird nicht mehr vom Speichermodul gesendet (ein geladener Hafen kommt als eigener Platz, ein Wechsel lädt die Seite neu). Module dürfen weiter darauf hören.

Automatisch gespeichert wird `game.state`, wenn die Seite verlassen oder das Handy gesperrt wird. Das Speichern nach jedem Abend ruft `state.js` selbst auf.

Empfohlen in `web/index.html` im `<head>`, damit iOS die Angaben schon beim ersten Laden sieht (sonst ergänzt `index.js` sie):

```html
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-title" content="Hafenmeister">
```

## Regeln für den Spielzustand

- `saveGame(state)` erwartet ein einfaches Objekt, das sich mit `JSON.stringify` speichern lässt (keine Klassen, keine `Map`, keine Verweise auf Three.js).
- Ändert sich das Format von `state.js` so, dass alte Stände nicht mehr passen, `SAVE_VERSION` in `storage.js` erhöhen und in `MIGRATIONS` eintragen, wie ein alter Stand umgebaut wird. Dann gehen weder gespeicherte noch exportierte Stände verloren.
- Stände aus einer neueren Spielversion werden abgelehnt (`SaveError` mit `code: 'zu-neu'`), statt sie falsch zu lesen.

## Format der Datei

```json
{
  "format": "hafenmeister-spielstand",
  "version": 2,
  "gespeichert": "2026-11-11T20:00:00.000Z",
  "spiel": { }
}
```

Dateiname: `hafenmeister-<hafenname>-JJJJ-MM-TT.json`, alle Häfen zusammen `hafenmeister-alle-haefen-JJJJ-MM-TT.json`. Auf Handy und Tablet öffnet "Sichern" das Teilen-Menü (In Dateien sichern, per Nachricht schicken), am PC wird die Datei heruntergeladen.

## Service Worker und Updates

- Bei jeder Änderung an `web/sw.js` die Zeile `const VERSION = 'v1';` hochzählen. Für Spielcode ist das nicht nötig: Eigene Dateien kommen immer zuerst frisch aus dem Netz.
- Beim ersten Besuch wird der Service Worker sofort aktiv. Spätere Versionen warten, bis das Spiel `apply()` aufruft, damit kein laufendes Spiel mitten im Abend neu lädt.
- Neue Bibliotheken nicht vom CDN laden, sondern nach `web/vendor/` legen (wie Three.js, siehe `tools/three-holen.sh`). Dateien in `css/`, `fonts/`, `icons/`, `js/` und `vendor/` landen automatisch im Offline-Vorrat; was woanders liegt, in `tools/offline-liste.mjs` ergänzen.

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
