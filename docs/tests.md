# Automatische Tests

## Vor jedem Merge: ein Befehl

Im Hauptordner des Repos:

```bash
bash tests/pruefen.sh
```

Er prüft nacheinander die Pfade für GitHub Pages, alle Tests ohne Browser (`tests/*.test.mjs`) und alle Browser-Tests auf Handy, Tablet und PC. Am Ende steht `Alles grün.`, sonst bricht er mit dem Fehler ab. Beim ersten Lauf installiert er die Abhängigkeiten in `tests/` selbst. Dauer etwa 15 bis 20 Minuten.

Nur die schnellen Prüfungen ohne Browser (etwa 5 Sekunden):

```bash
bash tests/pruefen.sh --ohne-browser
```

Nur ein Gerät (alles nach dem Befehl geht an Playwright):

```bash
bash tests/pruefen.sh --project=pc
```

Stand: 12.11.2026. Status: gebaut. Bei jedem Pull Request und jedem Push auf `main` startet der Workflow **Tests** (`.github/workflows/tests.yml`). Er öffnet das Spiel in einem echten Browser (Chromium mit Software-WebGL) in fünf Gerätegrößen und prüft, ob es lädt und sich bedienen lässt.

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
| `tests/specs/spielschleife.spec.mjs` | Rauchtest der Spielschleife: Boot kommt an die Boje, wird in 3D angetippt (oder in der Warteliste, falls `game.boatsVisible` fehlt), die Karte geht auf, „Automatisch einfahren“ legt es an, abends erscheint „Kassieren“, danach steigt das Geld oben. Zeit wird mit `game.sim.fastForward` vorgespult, Seed 42. |
| `tests/specs/bauen.spec.mjs` | Bauen mit Vorschau (docs/bauen.md): Baumodus öffnet die Bauliste mit vier Reitern, die Vorschau kostet nichts, erst „Bauen für 80 €“ bezahlt, danach steht die Toilette im Hafen und der Hinweis „Als Nächstes“ erscheint. |
| `tests/specs/layout.spec.mjs` | Seite scrollt nicht, Spielfläche füllt den Bildschirm, Knöpfe `#btn-pause`, `#btn-overview`, `#btn-build` sind sichtbar, im Bild und auf Touch-Geräten mindestens 40 x 40 Pixel groß (Handy quer 36), die Leisten überlappen nicht, die Media Queries treffen das richtige Gerät. |

Zusätzlich läuft `tools/check-pages.sh web` (absolute Pfade, fehlende Dateien), denn der Pages-Workflow prüft das erst nach dem Merge.

Die Tests verwenden nur die gemeinsamen Namen aus dem Grundgerüst (`window.hafenmeister`, `#stage`, `#hud-top`, `#hud-bottom`, die drei Knöpfe). Wer eines davon umbenennt, muss den Test im selben PR anpassen.

Three.js wird in den Tests aus `tests/node_modules/three` geliefert statt vom CDN, damit ein CDN-Ausfall keinen Test rot macht. Ändert jemand die Three.js-Version in der Import-Map von `web/index.html`, bitte dieselbe Version in `tests/package.json` eintragen und `npm install` im Ordner `tests/` ausführen (sonst lädt der Test vom echten CDN).

## Regel für alle Threads

Vor dem Mergen eines PRs muss `bash tests/pruefen.sh` lokal grün sein, dazu der Check **Spiel testen (Handy, Tablet, PC)** im PR. Ist er rot, steht im Lauf unter **Annotations**, welcher Test auf welchem Gerät scheitert. Jedes Gerät läuft als eigener, paralleler Job (`Spiel testen (handy)` usw.), der Sammel-Check `Spiel testen (Handy, Tablet, PC)` ist grün, wenn alle Geräte und die Tests ohne Browser grün sind. Unter **Artifacts** liegen je Gerät `bildschirmfotos-<gerät>` und `testbericht-<gerät>` (HTML-Bericht und Fotos der Fehlschläge).

Damit GitHub das auch erzwingt, kann Jorven es einmal in GitHub einstellen (freiwillig):

1. https://github.com/hjorven/hafenmeister/settings/branches öffnen, **Add classic branch protection rule** (oder unter **Rules**, **Rulesets** eine neue Regel für `main`).
2. Branch name pattern: `main`.
3. **Require status checks to pass before merging** anhaken, im Suchfeld `Spiel testen (Handy, Tablet, PC)` auswählen.
4. **Require branches to be up to date before merging** anhaken (dann muss jeder PR vor dem Merge auf den neuesten `main` gebracht werden und die Tests laufen erneut).
5. Speichern.

## Bekannte Fehler

Ein Fehler, der auf `main` schon steckt und von einem anderen Thread behoben wird, steht in `tests/specs/layout.spec.mjs` in der Liste `BEKANNT`. Der Test läuft weiter, muss aber scheitern. Wer den Fehler behebt, sieht den Test rot mit „expected to fail“ und löscht den Eintrag im selben PR.

Aktuell: keine.

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

Die Fotos liegen danach auch in `tests/bildschirmfotos/` (z. B. `handy-start.png`, `pc-weit.png`). Der Testserver baut vorher mit `tools/build-pages.sh` die Seite und liefert sie unter `http://localhost:<Port>/hafenmeister/` aus, genau wie GitHub Pages im Unterordner. `bash tests/pruefen.sh` nimmt jedes Mal einen freien Port und startet den Server neu, damit nie ein alter Server mit altem Stand geprüft wird. Direkt mit `npx playwright test` ist der Port 4173; ist er belegt, bricht Playwright mit einer Meldung ab (dann `pkill -f server.mjs`).

## Testmodus und Adresszusätze

Alle Zusätze, die das Spiel versteht, an einer Stelle. Sie hängen an die Adresse, z. B. `https://hjorven.github.io/hafenmeister/?stufe=6&services=alle` oder lokal `http://localhost:8000/?stufe=3&uhrzeit=20`. Mehrere werden mit `&` verbunden. Für Spieler sind sie nicht gedacht; ein Zusatz, den es nicht gibt, wird still übergangen.

**Hauptspiel** (`web/index.html`)

| Zusatz | Werte | Wirkung | Modul |
|---|---|---|---|
| `?stufe=n` | 1 bis 6 | Testmodus: frischer Spielstand dieser Stufe, alles bis dahin gebaut, Stege, Landschaft und Gebäude dieser Stufe. Die Adresse setzt nur die Startstufe: Nach einem Ausbau folgen Stege, Gelände, Services, Menschen und Verkehr der neuen Stufe. Der gespeicherte Spielstand wird weder geladen noch überschrieben. Services: Bauen kostet nichts, der Ruf zählt als 5 | `bridge.js`, `render/landscape.js`, `render/stege.js`, `render/services.js`, `render/buildings.js`, `render/people.js`, `render/boats/verkehr.js` |
| `?services=alle` | `alle` | alle Services in ihrer höchsten Ausbaustufe gebaut (sinnvoll mit `?stufe=6`) | `render/services.js` |
| `?stegbild=n` | 0 bis 12 | festes Stegbild (0 = Grundbild, das auch die Tests nutzen), siehe [stegbilder.md](stegbilder.md) | `data/stegbild.js` |
| `?gelaende=n` | 1 bis 10 | feste Geländeform nach einem echten Hafen (1 Heiligenhafen bis 10 Wangerooge), sonst aus dem Spielstand oder zufällig; Tests nutzen 1 | `render/landschaft/formen.js` |
| `?landbild=n` | Zahl | festes Landbild (Felder, Wald, Dorf), sonst aus dem Seed des Spielstands; nur Ansicht | `render/landscape.js`, `render/landschaft/vielfalt.js` |
| `?ueberblick=1` | `1`, `0` | Überblicksflug über die Geländeform beim Laden auch in Tests und in der Pixel-Fassung erzwingen (`1`) oder abschalten (`0`) | `main.js` |
| `?uhrzeit=h` | Stunden, z. B. `6.5`, `19`, `22` | Licht und Himmel fest auf diese Uhrzeit, die Spielzeit läuft weiter | `render/landscape.js` |
| `?revier=nordsee` | `ostsee`, `nordsee` (statt `revier` geht auch `region`) | startet im Revier. Die Nordsee ist bisher nur Landschaft und Daten, siehe [regionen.md](regionen.md) | `world/region.js`, `render/landscape.js` |
| `?qualitaet=` | `hoch`, `mittel`, `niedrig` (auch `quality`) | Grafikstufe der Landschaft statt der automatischen Wahl | `render/landscape.js` |
| `?einstieg=1` | `1` | Einstieg für neue Spieler beginnt von vorn ([einstieg.md](einstieg.md)) | `features/einstieg.js` |
| `?demo=boote` | `boote` | Vorführung der Schiffsanimationen (Einlaufen, Anlegen, Ablegen) | `render/boat-anim.js` |
| `?demo=boote-s` | `boote-s` | alle S-Boote an den Plätzen der Stufe 1 | `render/boats/s.js` |
| `?leute=voll` | `voll` | jede Box der Stufe mit einer Crew belegen (Menschen-Test) | `render/people.js` |

**Pixel-Fassung** (`web/pixel/`, siehe [pixel-art.md](pixel-art.md))

| Zusatz | Seite | Wirkung |
|---|---|---|
| `?hoehe=` | `pixel/index.html` | Neigung der Kamera beim Start in Grad (heute 30, 50 oder 70; mit PR 137 frei von 20 bis 86) |
| `?px=` | `pixel/index.html` | Pixelgröße, Standard `auto` |
| `?umriss=0` | `pixel/index.html` | ohne Umrisslinien |
| `?stil=filter`, `?schiffe=filter` | `pixel/index.html` | alter Filter-Weg zum Vergleich |
| `?groesse=`, `?hoehe=`, `?richtung=`, `?segel=` | `pixel/boote.html` | Auswahl der Testseite vorbelegen |
| `?modell=`, `?groesse=`, `?wasser=0`, `?richtungen=`, `?stil=`, `?lupe=` | `pixel/werkstatt.html` | Auswahl der Werkstatt vorbelegen |

Die Pixel-Fassung versteht zusätzlich alle Zusätze des Hauptspiels.

**In der Konsole des Browsers** (Hilfen für Tests, Spielobjekt `window.hafenmeister`)

| Aufruf | Wirkung |
|---|---|
| `hafenmeister.sim.fastForward(sekunden)` | Spielzeit vorspulen |
| `hafenmeister.camera.reset()` | Startansicht |
| `hafenmeister.bauen.vorschau(key)` | Bauvorschau öffnen ([bauen.md](bauen.md)) |
| `hafenmeister.einstieg.start()` | Einstieg starten |

Wer einen neuen Zusatz einbaut, trägt ihn im selben PR hier ein.

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
