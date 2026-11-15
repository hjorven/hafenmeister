# Härtetest: Extremlagen im echten Spiel

Der Härtetest stellt im echten Spiel (Browser, Handy und PC) Lagen her, die beim normalen Spielen selten oder nie zusammenkommen: 60 Boote auf einmal, voller Hafen bei Sturm, alle legen gleichzeitig ab, Großschiffe in engem Gelände, alle Küstentypen und Stegbilder, Tempo 8x über lange Zeit, Speichern und Laden mitten im Gewusel, Bauen bei belegten Plätzen, Ereignisse übereinander, Winterwechsel, viele Menschen an der Versorgung, Geld 0 und sehr viel, alle Menüs am Handy, schwaches Gerät.

Jede Lage wird doppelt geprüft:

1. **Messregeln** im laufenden Spiel, alle paar Sekunden (Liste unten). Jeder Fund bekommt beim ersten Mal ein Nahbild mit rotem Kreis.
2. **Bilder**: eine Bildserie je Lage, daraus ein Bildbogen (alle Bilder auf einem Blatt) und ein kurzes Video. Die Bilder werden angesehen, nicht nur gezählt: Boote über Land oder ineinander, Leinen ohne Boot, Leute im Wasser, verdeckte Bedienung, Fehlermeldungen.

Wann laufen lassen: nicht bei jedem PR, sondern nach großen Änderungen (neues Gelände, Boote, Menschen, Oberfläche, Spielstand) und vor einer Abnahme. Für jeden PR gilt weiter `bash tests/pruefen.sh --schnell` (docs/tests.md). Der Zeitraffer (docs/zeitraffer.md) spielt das ganze Spiel normal durch; der Härtetest dagegen sucht die Ränder.

## Befehle

Einmalig (Playwright und Three.js für die Tests):

```bash
cd tests && npm ci && cd ..
```

Alles auf PC und Handy (rund 75 Minuten je Gerät, beide nacheinander):

```bash
node tests/extrem/lauf.cjs --out /tmp/extremtest
```

Kurzfassung (jede Lage etwa ein Drittel so lang, weniger Varianten, rund 25 Minuten je Gerät):

```bash
node tests/extrem/lauf.cjs --kurz --out /tmp/extremtest
```

Nur bestimmte Lagen oder Geräte, und die Liste aller Lagen:

```bash
node tests/extrem/lauf.cjs --geraet handy --lagen menues-alle,geld-extrem --out /tmp/extremtest
node tests/extrem/lauf.cjs --liste
```

PC und Handy gleichzeitig geht (zwei Befehle in zwei Ausgabeordnern), jeder Lauf wird dann langsamer.

Gegen den Stand von `main`, während man selbst am Spiel arbeitet:

```bash
rm -rf /tmp/ex-main && mkdir -p /tmp/ex-main && git archive origin/main web | tar -x -C /tmp/ex-main
node tests/extrem/lauf.cjs --web /tmp/ex-main/web --out /tmp/extremtest
```

Ergebnis: `<out>/bericht.md` (Übersicht, Funde je Lage, Messungen, Verdeckung der Menüs, Bildbogen, Video), `<out>/ergebnis.json` (alles maschinenlesbar), `<out>/bilder/`. Bricht ein Lauf ab, schreibt `node tests/extrem/bericht.cjs <out>` den Bericht aus dem, was schon da ist. Bilder für Jorven kommen nach `/mnt/project-files/extremtest/<datum>-<commit>/`.

## Optionen

| Option | Standard | Bedeutung |
|---|---|---|
| `--geraet` | `pc,handy` | Geräte, durch Komma getrennt: `pc` (1440 x 900), `handy` (Pixel 7), `handyquer`, `tablet` |
| `--lagen` | alle | ids aus `--liste`, durch Komma getrennt |
| `--kurz` | aus | jede Lage etwa ein Drittel so lang, Varianten gekürzt |
| `--testtempo` | `8` | Spielzeit je Echtzeit (`?testtempo=`, docs/zeitraffer.md), außer in `tempo8-lang` und `schwache-fps`, die die normale Bildschleife prüfen. 0 = aus |
| `--minuten8` | `8` (kurz `3`) | Echtzeit-Minuten der Lage `tempo8-lang` |
| `--web` | `web` | Ordner mit dem Spiel |
| `--out` | `/tmp/extremtest` | Ausgabeordner |
| `--kein-video` | aus | keine Videos (sonst mit `ffmpeg`, falls vorhanden; Bildbogen mit `montage` aus ImageMagick, falls vorhanden) |

## Die Lagen

| id | Lage | Was passiert |
|---|---|---|
| `bojen-erreichbar` | Erreichen Gäste sichtbar eine Boje? | Stufe 2 bis 6, normaler Spieltag ohne Eingriff: Anteil der Boote, die sichtbar an einer Boje liegen, bevor sie einfahren (nur dort kann man sie antippen). Fund unter der Hälfte |
| `viele-boote` | 60 Boote auf einmal | Stufe 6, 60 Gastboote kommen innerhalb von 40 Spielsekunden von See, dazu der normale Verkehr. Bojen voll, Selbst-Einfahren, Abweisen |
| `voll-sturm` | Voller Hafen bei Sturm | Stufe 6, alle Plätze belegt, Sturm, dazu 20 Ankömmlinge |
| `alle-einfahren` | Alle fahren gleichzeitig ein | Für jede freie Box ein Boot, alle bekommen im selben Augenblick ihren Platz |
| `alle-ablegen` | Alle legen gleichzeitig ab | Voller Hafen, am nächsten Morgen reisen alle Gäste in einem Fenster von wenigen Spielsekunden ab |
| `grossschiffe-eng` | Großschiffe in engem Gelände | Alle Services, alle Großschiff-Besuche am selben Tag, in Bodden, Schären, Förde und Inselhafen (Varianten je Küstentyp) |
| `gelaende-alle` | Alle Küstentypen und Stegbilder | Jeder Küstentyp (so viele, wie das Spiel gerade hat) mit eigenem Seed und wechselndem Stegbild, restliche Stegbilder auf Küste 1; Stufe 4 mit halbvollem Hafen und 30 Ankömmlingen |
| `tempo8-lang` | Tempo 8x lange | Neues Spiel ab Tag 1, Knopf "Achtfach vorspulen", ohne Testtempo: Tage, Abende, Rundgang, Tagesabschluss |
| `speichern-gewusel` | Speichern und Laden im Gewusel | Stufe 6 als echter Spielstand, dreimal mitten in der Bewegung speichern, neu laden, vergleichen und weiterspielen |
| `bauen-belegt` | Bauen bei belegten Plätzen | Stufe 4 und 5, voller Hafen, Boote in Fahrt: alle offenen Stegprojekte, Hafenbüro, Bauwerke und Services auf einmal. Abreißen gibt es im Spiel nicht, darum nicht getestet |
| `ereignisse-uebereinander` | Ereignisse übereinander | Sturm läuft, Regatta angekündigt, Hanse-Woche geplant, Nebel-Nachspiel offen, danach drei Tage |
| `winterwechsel` | Winterwechsel | Echter Spielstand Stufe 4, voller Hafen und Wartende am letzten Saisontag, Winter, "Winter überspringen", Frühling, Speichern und Laden |
| `versorgung-voll` | Viele Menschen an der Versorgung | Stufe 6, alle Services, voller Hafen, Tag und Abend mit Rundgang |
| `geld-extrem` | Geld 0 und sehr viel | Stufe 3: 0 €, 999.999.999 € und 10^12 €; Anzeige, Baumenü, Weiterspielen mit 0 € |
| `menues-alle` | Alle Menüs | Jede Tafel aus Menü und Leiste über echte Knöpfe öffnen (Bootskarte durch Antippen eines Boots), Verdeckung messen, mit Esc oder Schließen-Knopf schließen; dann vier Tafeln übereinander |
| `schwache-fps` | Schwaches Gerät | Stufe 6, 40 Boote, CPU auf ein Sechstel gedrosselt (Chrome DevTools), Tempo 8x: Spielzeit läuft, Boote springen nicht, Pause-Knopf reagiert in unter 3 s |

Neue Lage: einen Eintrag in `tests/extrem/lagen.cjs` (id, titel, was, adresse, lauf) anlegen; der Werkzeugkasten steht oben in der Datei. Braucht die Lage einen neuen Eingriff ins Spiel, kommt er als Helfer nach `tests/extrem/helfer.cjs`. Das Spiel selbst bekommt dafür keinen Code.

## Messregeln

| Art | Fund oder Hinweis | Wie |
|---|---|---|
| Konsole | Fund | Jede Fehlermeldung, jeder Skriptfehler, jede fehlende Datei |
| Boot über Land, durch Steg, ineinander fest, hängt, zu lange unterwegs, Spielregeln | Fund | Unverändert aus dem Zeitraffer (`tools/zeitraffer/lauf.cjs`, `PROBE`, docs/zeitraffer.md). Beim Fund "durch Steg" steht dabei, welches Teil der Strahl trifft |
| Liegende Boote überlappen | Fund | dito |
| Boote berühren sich kurz in Fahrt, Pulk | Hinweis | dito; in Extremlagen erwartbar, darf aber nicht überhandnehmen |
| Mensch im Wasser | Fund | Gezeichnete Figur steht mindestens 1 m vom Ufer im Wasser (`istWasser`), Füße unter 0,25 m, kein Steg, Kai, Gebäude oder Boot darunter. Zusammengefasst je 5-m-Feld |
| Leine ohne Boot | Fund | Sichtbare Festmacher, deren Boot unsichtbar ist, Leinen ohne Besitzer, Leinen, die weiter als 1,6 Bootslängen plus 8 m reichen |
| Großschiff über Land | Fund | Rumpf jedes sichtbaren Besuchsschiffs (Kreuzfahrt, Windjammer, Flotte) aus seiner Geometrie, 2 von 7 Punkten auf Land |
| Boje nicht erreicht | Fund | Wartendes Boot zählt laut Spielregeln über 20 Spielsekunden als "an der Boje" (Geduld läuft), liegt im Bild aber nicht an einer Boje (unsichtbar draußen oder noch unterwegs) |
| Spiel und Bild uneinig | Fund | Boot liegt laut Spielregeln, ist aber über 120 Spielsekunden nicht zu sehen |
| Spielstand widersprüchlich | Fund | Platz doppelt belegt, Platz zeigt auf fehlendes Boot, Warteschlange zeigt ins Leere, Geld, Tag, Stufe, Uhr keine Zahl |
| Kaputter Text | Fund | `NaN`, `undefined`, `Infinity`, `[object ...]`, `null €` irgendwo im sichtbaren Text |
| Bedienung | Fund | Geld, Übersicht, Bauen, Zeitsteuerung und Menü-Knopf im Bild und nicht verdeckt (`elementFromPoint`), keine sichtbare Tafel halb aus dem Bild. Während absichtlich Tafeln offen sind, misst die Lage `menues-alle` stattdessen die Verdeckung in Prozent (Raster 12 px) und ob jede Tafel wieder zugeht |
| Speichern und Laden | Fund | Stufe, Tag, Hafenbüro, Bauwerke, Services, Ereignis gleich; Geld nicht weniger; kein liegendes Boot verschwunden |

Während einer Prüfung steht das Spiel, damit das Nahbild den Fund noch zeigt (bei Testtempo 8 und 3x vergehen sonst 24 Spielsekunden je Sekunde).

## Wie die Lagen hergestellt werden

Alles über Schnittstellen, die das Spiel schon hat, im Browser per `page.evaluate` (`tests/extrem/helfer.cjs`): Boote würfelt `sim.rollBoat` und sie kommen über die normale Ankunft (`state.upcoming`), volle Häfen entstehen über `sim.assign` und den Abgleich der Ansicht wie nach dem Laden, Ereignisse über `game.events.load`, Großschiffe über `game.services.planeBesuch`, Testmodus `?stufe=n` wird für Speichern und Winter zu einem echten Spielstand. Für "alle legen ab" wird `rules.departWindow` während der Lage auf wenige Prozent des Tages gesetzt. Bedienung (Tempo-Knöpfe, Menüs, Bauen, Bootskarte, Winter überspringen) läuft über echte Klicks und Tipps.

## Grenzen

- Software-Grafik im Container: 5 bis 12 Bilder je Sekunde. Bildraten sagen wenig über echte Geräte, Vergleiche zwischen Lagen schon.
- Die Lagen würfeln Boote; zwei Läufe zeigen nicht dieselben Einzelfunde. Wiederkehrende Funde (gleiche Stelle, gleiche Art) zählen.
- Bei Testtempo rechnet das Spiel in großen Schritten. Lange Leinen beim Ablegen kamen im vollen Lauf am 15.11. nur so vor (81 Mal), mit `--testtempo 1` nie; sie stehen darum nur als Hinweis im Bericht. Verdächtiges immer mit `--testtempo 1 --lagen <id>` gegenprüfen.
- `istWasser` und das Bild können am Ufer leicht abweichen, darum gilt für Menschen ein Meter Abstand vom Ufer.

## Ergebnisse

Die Läufe stehen mit Bildern unter `/mnt/project-files/extremtest/`. Funde, die nicht im selben PR behoben wurden, stehen in docs/arbeitsplan.md.
