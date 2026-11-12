# Automatische Tests

## Vor jedem Merge: ein Befehl

Im Hauptordner des Repos:

```bash
bash tests/pruefen.sh
```

Er prüft nacheinander die Pfade für GitHub Pages, alle Tests ohne Browser (`tests/*.test.mjs`) und alle Browser-Tests auf Handy, Tablet und PC. Am Ende steht `Alles grün.`, sonst bricht er mit dem Fehler ab. Beim ersten Lauf installiert er die Abhängigkeiten in `tests/` selbst. Dauer etwa 4 bis 5 Minuten.

Nur die schnellen Prüfungen ohne Browser (etwa 5 Sekunden):

```bash
bash tests/pruefen.sh --ohne-browser
```

Nur ein Gerät (alles nach dem Befehl geht an Playwright):

```bash
bash tests/pruefen.sh --project=pc
```

Solange GitHub Actions nicht läuft, gilt: lokal `bash tests/pruefen.sh` ausführen, nur bei `Alles grün.` mergen. Nicht auf Actions warten.

Stand: 11.11.2026. Bei jedem Pull Request und jedem Push auf `main` startet der Workflow **Tests** (`.github/workflows/tests.yml`). Er öffnet das Spiel in einem echten Browser (Chromium mit Software-WebGL) in fünf Gerätegrößen und prüft, ob es lädt und sich bedienen lässt.

## Was geprüft wird

| Gerät (Projekt) | Größe | Eingabe |
|---|---|---|
| `handy` | Pixel 7, 412 x 839 | Touch |
| `handy-quer` | Pixel 7 quer, 863 x 360 | Touch |
| `tablet` | Galaxy Tab S4, 712 x 1138 | Touch |
| `tablet-quer` | Galaxy Tab S4 quer, 1138 x 712 | Touch |
| `pc` | 1440 x 900 | Maus |

| Datei | Test |
|---|---|
| `tests/specs/start.spec.mjs` | Spiel startet ohne Skriptfehler, Konsolenfehler oder fehlende Dateien. Jedes Modul aus `MODULES` in `main.js`, das es als Datei gibt, lädt fehlerfrei. Die Spielfläche ist nicht leer oder schwarz. Bildschirmfotos (Startansicht und ganz herausgezoomt). |
| `tests/specs/steuerung.spec.mjs` | Pause hält die Spielzeit an, Karte verschieben (Finger oder Maus), Zoomen (zwei Finger oder Mausrad), Übersicht setzt die Kamera zurück, Antippen löst `tap` aus. |
| `tests/specs/spielschleife.spec.mjs` | Rauchtest der Spielschleife: Boot kommt an die Boje und erscheint unten in der Warteliste, Antippen öffnet die Karte, „Automatisch einfahren“ legt es an, abends erscheint „Kassieren“, danach steigt das Geld oben. Zeit wird mit `game.sim.fastForward` vorgespult, Seed 42. |
| `tests/specs/layout.spec.mjs` | Seite scrollt nicht, Spielfläche füllt den Bildschirm, Knöpfe `#btn-pause`, `#btn-overview`, `#btn-build` sind sichtbar, im Bild und auf Touch-Geräten mindestens 40 x 40 Pixel groß (Handy quer 36), die Leisten überlappen nicht, die Media Queries treffen das richtige Gerät. |

Zusätzlich läuft `tools/check-pages.sh web` (absolute Pfade, fehlende Dateien), denn der Pages-Workflow prüft das erst nach dem Merge.

Die Tests verwenden nur die gemeinsamen Namen aus dem Grundgerüst (`window.hafenmeister`, `#stage`, `#hud-top`, `#hud-bottom`, die drei Knöpfe). Wer eines davon umbenennt, muss den Test im selben PR anpassen.

Three.js wird in den Tests aus `tests/node_modules/three` geliefert statt vom CDN, damit ein CDN-Ausfall keinen Test rot macht. Ändert jemand die Three.js-Version in der Import-Map von `web/index.html`, bitte dieselbe Version in `tests/package.json` eintragen und `npm install` im Ordner `tests/` ausführen (sonst lädt der Test vom echten CDN).

## Regel für alle Threads

Vor dem Mergen eines PRs muss `bash tests/pruefen.sh` lokal grün sein. Sobald GitHub Actions läuft, zusätzlich der Check **Spiel testen (Handy, Tablet, PC)** im PR. Ist er rot, steht im Lauf unter **Annotations**, welcher Test auf welchem Gerät scheitert. Unter **Artifacts** liegen `bildschirmfotos` (alle Geräte) und `testbericht` (HTML-Bericht und Fotos der Fehlschläge).

Damit GitHub das auch erzwingt, einmal in GitHub einstellen (nur Jorven, erst wenn Actions wieder läuft, sonst kann niemand mergen):

1. https://github.com/hjorven/hafenmeister/settings/branches öffnen, **Add classic branch protection rule** (oder unter **Rules**, **Rulesets** eine neue Regel für `main`).
2. Branch name pattern: `main`.
3. **Require status checks to pass before merging** anhaken, im Suchfeld `Spiel testen (Handy, Tablet, PC)` auswählen.
4. **Require branches to be up to date before merging** anhaken (dann muss jeder PR vor dem Merge auf den neuesten `main` gebracht werden und die Tests laufen erneut).
5. Speichern.

## Bekannte Fehler

Ein Fehler, der auf `main` schon steckt und von einem anderen Thread behoben wird, steht in `tests/specs/layout.spec.mjs` in der Liste `BEKANNT`. Der Test läuft weiter, muss aber scheitern. Wer den Fehler behebt, sieht den Test rot mit „expected to fail“ und löscht den Eintrag im selben PR.

Aktuell: Tablet hochkant, obere Leiste zu voll (Pause liegt rechts außerhalb des Bildes, Sonne verdeckt „Tag“), `web/css/ui-tablet.css`.

## Einzelne Schritte von Hand

Einmalig (im Hauptordner des Repos):

```bash
cd tests && npm ci && npx playwright install --with-deps chromium && cd ..
```

Alle Tests auf allen Geräten:

```bash
cd tests && npx playwright test; cd ..
```

Nur ein Gerät, z. B. Handy (hochkant und quer), Tablet oder PC:

```bash
cd tests && npm run test:handy; cd ..
cd tests && npm run test:tablet; cd ..
cd tests && npm run test:pc; cd ..
```

Mit sichtbarem Browserfenster, um zuzusehen:

```bash
cd tests && npx playwright test --project=pc --headed; cd ..
```

Bericht mit Bildschirmfotos im Browser öffnen:

```bash
cd tests && npm run bericht; cd ..
```

Die Fotos liegen danach auch in `tests/bildschirmfotos/` (z. B. `handy-start.png`, `pc-weit.png`). Der Testserver baut vorher mit `tools/build-pages.sh` die Seite und liefert sie unter `http://localhost:4173/hafenmeister/` aus, genau wie GitHub Pages im Unterordner.

## Neue Tests schreiben

Eine neue Datei `tests/specs/<thema>.spec.mjs` anlegen, so beginnen:

```js
import { test, expect } from '../helpers.mjs';

test('Boot legt am Steg an', async ({ game }, testInfo) => {
  const { page } = game;   // Spiel ist geladen, window.hafenmeister bereit
  // ...
});
```

Die Fixture `game` öffnet das Spiel und wartet, bis alles geladen ist. Am Ende jedes Tests schlägt er fehl, wenn es Skriptfehler, Konsolenfehler oder fehlende Dateien gab. Hilfen in `tests/helpers.mjs`: `cameraState`, `stageCenter`, `touchGesture`, `lerpFrames`, `imageStats`, `isTouchProject`.

Keine Vergleiche mit gespeicherten Bildschirmfotos: Bei vielen parallelen Grafik-Änderungen wären die ständig rot. Die Fotos sind zum Anschauen gedacht.
