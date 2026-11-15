# Schichttest: das Spiel von Grund auf prüfen

Stand: 15.11.2026. Gepflegt vom Thread "Spiel Schicht für Schicht von Grund auf testen".

## Wozu

Die anderen Prüf-Threads schauen auf einzelne Merges ("Jedes neue Feature einzeln testen") oder auf ganze Partien im Zeitraffer ("Ganzes Spiel im Zeitraffer durchtesten"). Der Schichttest prüft das **Zusammenspiel**: Er beginnt mit dem nackten Kern (Laden, Kamera, ein Boot kommt, Ziehen, Anlegen, Kassieren, Tag und Nacht, Speichern). Erst wenn eine Schicht stabil ist, kommt die nächste Funktion dazu, und danach laufen **alle bisherigen Schichten im selben Spiel noch einmal**. So fällt auf, wenn eine neue Funktion eine alte stört.

Gespielt wird wie ein Mensch, über die echte Oberfläche:

- Knöpfe werden angeklickt (PC) oder angetippt (Handy, Tablet).
- Boote werden mit Maus oder Finger an der Leine auf die Box gezogen, Münzen mit einem Strich eingesammelt, die Karte mit Ziehen verschoben und mit Mausrad oder zwei Fingern gezoomt.
- Zeit vergeht über die Tempo-Knöpfe (Pause, 1x, 3x, 8x).
- Der Test liest den Spielzustand nur, um zu prüfen, ob die Handlung gewirkt hat. Er setzt nie Geld, Stufe oder Boote von Hand.

Ausnahmen, die im Bericht stehen: Ausgangslagen über Testadressen (`?gelaende=`, `?seed=`, `?stegbild=`, später `?stufe=n`) und das Warten auf Spielzeit.

## Aufruf

Einmal vorher (Playwright liegt in `tests/`):

```bash
cd tests && npm ci && cd ..
```

Ein Gerät, alle Schichten:

```bash
node tools/schichttest/lauf.cjs --geraet pc --out /tmp/schichttest
```

Alle fünf Geräte nacheinander gegen eine eingefrorene Kopie des Spiels (Merges während des Laufs ändern dann nichts):

```bash
rm -rf /tmp/st-web && cp -r web /tmp/st-web && for g in pc handy handyquer tablet tabletquer; do node tools/schichttest/lauf.cjs --geraet "$g" --web /tmp/st-web --out /tmp/schichttest; done
```

| Option | Standard | Bedeutung |
|---|---|---|
| `--geraet` | `pc` | `pc` (1440 x 900, Maus), `handy` (Pixel 7), `handyquer`, `tablet` (Galaxy Tab S4), `tabletquer`; alle außer `pc` mit Touch |
| `--bis n` | alle | letzte Schicht |
| `--nur a,b` | - | nur diese Schichten, ohne Wiederholung der früheren (zum Nachprüfen eines Funds) |
| `--gelaende n`, `--seed s`, `--stegbild n` | Spielstart wie ein neuer Spieler | Ausgangslage über die Adresse |
| `--web dir` | `web/` | Ordner mit dem Spiel |
| `--out dir` | `/tmp/schichttest` | Ausgabe: `bilder/`, `ergebnis-<gerät>.json`, `bericht-<gerät>.md` |

Ein Lauf endet nach der ersten Schicht mit einem Fund der Schwere A (die Schicht ist nicht stabil, darauf aufzubauen ergibt keinen Sinn). Schwere A = Grundfunktion geht nicht, B = stört sichtbar, C = Feinschliff.

Hinweis zur Testumgebung: Chromium rechnet die Grafik hier in Software. Das Spiel läuft dadurch langsamer als auf einem echten Gerät; Zeiten werden deshalb in Spielsekunden gemessen, nicht in echter Zeit. Ohne Adresse startet Playwright immer mit Geländeform 1, Seed 1 und Stegbild 0 (das Spiel erkennt den Testbrowser), echte neue Spieler bekommen eine zufällige Küste.

## Dateien

| Datei | Inhalt |
|---|---|
| `tools/schichttest/lauf.cjs` | Ablauf: Gerät, Server, Schichten nacheinander, nach jeder neuen Schicht alle früheren noch einmal |
| `tools/schichttest/spieler.cjs` | Spieler mit Maus oder Finger (tippen, ziehen, zoomen, Knopf) und Hilfen im Browser (`window.__st`: Bildschirmlage von Boot, Box, Münze, verdeckt oder frei) |
| `tools/schichttest/schichten.cjs` | Schicht 1 bis 7 (Kern) und der Wächter für Bootslagen |
| `tools/schichttest/ausbau.cjs` | Schicht 8 und folgende |
| `tools/schichttest/bericht.cjs` | Bericht als Markdown aus dem Ergebnis |

## Schichten

Reihenfolge abgeleitet aus [roadmap.md](roadmap.md), [arbeitsplan.md](arbeitsplan.md) und der Bestandsaufnahme: erst was jedes Spiel in den ersten Minuten braucht, dann was jeden Tag passiert, dann was über Tage und Stufen wirkt.

| Nr | Schicht | Paket | Was geprüft wird | Status |
|---|---|---|---|---|
| 1 | Laden und Oberfläche | Grundgerüst, P61 | lädt ohne Fehler, Einstieg lässt sich beenden, alle Knöpfe ganz im Bild, Spielfläche nicht leer | gebaut |
| 2 | Kamera | P01, PR 137 | Verschieben durch Ziehen, Zoomen (Mausrad, zwei Finger), "Übersicht" stellt die Startansicht her | gebaut |
| 3 | Boot kommt an die Boje | P02, P66 | erstes Boot nach wenigen Sekunden, wartendes Boot in der Übersicht sichtbar und nicht verdeckt | gebaut |
| 4 | Ziehen und Anlegen | P02, P03 | Leine vom Boot auf eine leuchtende Box ziehen, Boot fährt hinein und macht fest; Wächter: keine Boote übereinander, über Land oder im Steg | gebaut |
| 5 | Kassieren | P12 | Münze erscheint nach dem Festmachen, ein Strich sammelt sie ein, Geld und Anzeige steigen | gebaut |
| 6 | Tag und Nacht | P05, P20 | Abend kommt und ist dunkler, neuer Tag beginnt, Anzeige zählt mit | gebaut |
| 7 | Speichern und Laden | P09 | Seite neu laden: Stufe, Tag, Geld, Bauten, liegende Boote bleiben, Boote liegen sichtbar in ihrer Box, Einstieg kommt nicht wieder | gebaut |
| 8 | Einfahren ohne Ziehen | P02, P10 | Antippen zeigt "Einfahren" am Boot; ein unberührtes Boot fährt nach der Regelzeit selbst ein | gebaut |
| 9 | Tempo | P07, PR 278 | 3x und 8x laufen 3- und 8-mal so schnell, 8x läuft durch ohne Bremse; PC: Leertaste, Taste F | gebaut |
| 10 | Bauen | P18, J4 | Bauliste, Vorschau, Bestätigen bezahlt genau den Preis, Zeit steht im Baumodus, Spiel läuft danach weiter | gebaut |
| 11 | Tagesziele | P13 | Tafel mit drei Karten, Wahl wirkt | gebaut |
| 12 | Tagesabschluss | P15 | Karte oder Zettel nach dem Tag, Summe stimmt, verdeckt Zeit und Bauen nicht, "Weiter" schließt | gebaut |
| 13 | Menü | Abnahme, P50 | jeder Menüeintrag öffnet oder schaltet etwas sichtbar und lässt sich wieder schließen; Menü passt ins Bild | gebaut |
| 14 | Wartebojen und Ankerfeld | P66 | bei 8x zwölf Stichproben: wartende Boote überlappen nicht, liegen nicht auf Land oder Steg, keine Boje doppelt belegt | gebaut |
| 15 | Bewertung und Gästebuch | P14 | Gästebuch öffnet über die Ruf-Anzeige, zeigt Einträge, schließt wieder | gebaut |
| 16 | Aufstieg | P16, P18 | Ausbau "Hafen" über Bauen, nach dem Umbau Stufe +1, alle früheren Schichten danach noch einmal | gebaut |
| 17 | Hafenbüro und Funk | P02, P28 | Büro bauen, abends "Alle kassieren" sammelt die Münzen ein | gebaut |
| 18 | Ruf und Wünsche | P19 | Ruf steigt und fällt sichtbar, Wünsche über dem Boot | geplant |
| 19 | Dauerlieger | P01 | Dauerlieger aufnehmen, fährt tagsüber raus, abends zurück | geplant |
| 20 | Winter | P20 | Winter beginnt, Hafen ruht, Frühling kommt | geplant |
| 21 | Ereignisse | P24 | Sturm und Regatta angekündigt, Vorbereiten wirkt | geplant |
| 22 | Logbuch und Chronik | P21 | Einträge passen zu dem, was passiert ist | geplant |
| 23 | Services und Stufe 6 | P23, P04 | Anlagen bauen, Großschiffe, Abschlussziel | geplant |

## Ergebnisse

Neueste Läufe oben. Bilder und vollständige Berichte liegen im Projektordner unter `schichttest/<datum>-<commit>/`.

| Datum | Stand | Gerät | Schichten | Prüfpunkte | Funde | Bemerkung |
|---|---|---|---|---|---|---|
| 15.11. | `b5baa80` | pc, handy, tablet (Serie 6) | 1 bis 17 | 86 bis 579 | F2, F3 | Handy und Tablet laufen durch alle 17 Schichten, PC hält an F3 und Tagesende ohne Ankünfte (Testfehler, behoben) |
| 15.11. | `b5baa80` | alle fünf (Serie 5) | 1 bis 15 | 22 bis 473 | F2, F3 | F2 hält "Einfahren lassen" auf Handy und Tablet an; F1 nicht mehr aufgetreten (PR 320) |
| 15.11. | `af90cb9` | alle fünf | 1 bis 13 | 84 bis 300 | siehe Funde | Serie 1: Kern auf allen Geräten stabil; Funde in 8 bis 13 großteils Testfehler (behoben), F1 echt |
| 14.11. | `af90cb9` | pc, handy, handyquer, tablet, tabletquer | 1 bis 7 | 62 bis 72 | 0 | Kern stabil (nach Testkorrekturen) |

## Funde

| Nr | Schicht | Gerät | Fund | Schwere | Bild | Zuständig | Stand |
|---|---|---|---|---|---|---|---|
| F1 | 12 mit 3, 8 | pc, tablet | Die Karte "Tag n geschafft" liegt oben in der Mitte über Wartebojen und Stegkopf, bis zu 14 s, während das Spiel läuft; wartende Boote und Ziel-Boxen sind verdeckt | C bis B | `schichttest/2026-11-15-af90cb9/f1-pc-tagesabschluss-ueber-bojen.jpg` | an Koordinator gemeldet | offen |
| F2 | 8, 5 | handy, handyquer, tablet, tabletquer | Kurzhalter werden abgerechnet und fahren weg, bevor sie sichtbar festgemacht haben: die Ablegezeit (`leaveClock`, sim.js) zählt ab Zuweisung, mindestens 5 s; wer spät am Tag oder von weit draußen zugewiesen wird, ist noch beim Anfahren. Gemessen bei 3x: 5 von 19 Kurzhaltern (Handy), 2 von 13 (PC); keine Münze zum Streichen | B | `schichttest/2026-11-15-kurzhalt/` | "Längere Tage und Bootsgeschichten einbauen" (PR 319) | gemeldet 15.11. |
| F3 | 3 | pc, tabletquer, handy | Erstes Boot wird nach 4 bis 5 s gemeldet, liegt aber erst nach 51 bis 60 s Spielzeit an der Boje (lange Anreise von außerhalb der Karte, Regel 14.11.); Regel "Erstes Boot nach wenigen Sekunden" damit verfehlt | C | - | Koordinator (Regelkonflikt) | gemeldet 15.11. |

F1 ist mit PR 320 erledigt (Tagesabschluss erst als Zettel; die Karte öffnet nur, wenn man ihn antippt).

Keine Fehler, aber gut zu wissen (Hinweise):

- Am Handy und Tablet hochkant ersetzt die Bootskarte nach dem Antippen eines wartenden Boots die untere Leiste samt Bauen und Tempo (`f2-tablet-bootskarte-verdeckt-leisten.jpg`). Gewollt (`ui/input-touch.js`: genau ein Einfahren-Knopf, am Handy in der Karte), der Spieler schließt die Karte über das Kreuz.
- Am Abend kassiert der Rundgang des Hafenmeisters liegen gebliebene Münzen selbst ("7 € statt 9 €"). Bei 3x und 8x ist er oft schneller als der Spieler.
- Stufe 1 ist nach zwei bis drei Tagen voll (4 Boxen, 2 davon erst nach dem Ausbau). Dann warten Boote ohne freie Box; das ist Spielregel, kein Fehler.

Testfehler, die in Serie 1 auffielen und im Werkzeug behoben sind: Ereignisse mit Kreisbezügen, `boat:moored` an der Boje, Rundgang kassiert bei 3x vor dem Strich, Bootskarte statt Knopf am Boot, Logbuch-Fenster nicht erkannt, Tempo-Messung bei unter 10 Bildern je Sekunde.

## Wo es mit anderen kollidieren kann

- Neue Fenster oder Tipps, die sich über den Hafen legen ("Verstanden"), schließt der Test vor jeder Handlung und schreibt sie als Hinweis in den Bericht. Kommt ein neues Fenster ohne "Verstanden" oder "Weiter", bleibt der Test daran hängen: dann `fensterZu` in `schichten.cjs` ergänzen.
- Der Test findet Knöpfe über ihre Namen (`#btn-pause`, `#btn-overview`, `#btn-build`, "Normale Geschwindigkeit", "Dreifach vorspulen", "Achtfach vorspulen", "Einstieg beenden", `.hm-einfahren`, `#card .bau-ja`, `.tz-karte`, `#hm-tagesabschluss .hm-ta-weiter`). Wer sie umbenennt, passt `tools/schichttest/` im selben PR an.
- Ereignisnamen, auf die der Test hört: `boot:an-boje`, `boot-kommt`, `boat:moored` (mit `berth`), `sim:selfEntered`, `ui:tow-end`, `sim:dayEnd`, `ziel:gewaehlt`.
