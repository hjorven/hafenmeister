# Balancing

Stand: 12.11.2026, nach „Boote fahren selbst ein“ (PR 103), „Tagesrhythmus“ (PR 108) und „Warteschlange entlasten“ (PR 113). Gilt für die erste Region (deutsche Ostsee, Stufen 1 bis 6, 94 Gastplätze plus die festen Plätze der Großschiffe in Stufe 6).

## Wo die Zahlen liegen

| Datei | Inhalt | Gehört |
|---|---|---|
| `web/js/data/economy.js` | alle Spielzahlen: Grundpreise, Wünsche, Ruf, Stufen und Ziele, Stegprojekte mit Platz-ids, Bauwerke, Hafenbüro, Services, Ereignisse | Balancing |
| `tools/balance.mjs` | spielt die Regeln ohne Grafik viele Male durch und meldet die Spielzeit | Balancing |
| `tests/balance.test.mjs` | prüft, dass die Daten zu `harbor.js` passen und die Spielzeit im Zielkorridor bleibt | Balancing |

`web/js/sim.js` (Spielregeln) und die Services lesen ihre Zahlen nur aus `ECONOMY`. Wer eine Zahl braucht, die noch fehlt, trägt sie in `economy.js` ein, statt sie im Code festzulegen. Die höchste Stufe im Spiel (`rules.maxStage`) ist die höchste Stufe in `ECONOMY.stufen`, derzeit 6.

## Benutzen

```bash
node tools/balance.mjs --pruefen
node tools/balance.mjs
node tools/balance.mjs --laeufe 200
node tools/balance.mjs --verlauf 3
node tools/balance.mjs --verlauf 3 --gemuetlich
node tools/balance.mjs --json
node --test tests/*.test.mjs
```

`--pruefen` meldet jeden Liegeplatz aus `harbor.js`, der keinem Projekt gehört oder doppelt vergeben ist, und jedes Projekt, das in einer späteren Stufe Plätze verlieren würde. `--verlauf` zeigt Tag für Tag, was ein Spieler kauft und wie Geld und Ruf laufen. Hat `economy.js` mehr Stufen als `harbor.js`, rechnet das Werkzeug trotzdem und meldet die fehlenden Platz-ids als Hinweis.

## Ergebnis (100 Läufe je Spielertyp, mit den echten Spielregeln)

`tools/balance.mjs` spielt mit `web/js/sim.js` (über `sim.rulesFromEconomy(ECONOMY)`), dem Bootskatalog, den Services (`web/js/services/rules.js`) und den Ereignissen (`web/js/events/scheduler.js`: Sturm, Regatta, Hafenfest, Nebel, mit Wetter). Ein Spieltag dauert bei 1x 2 Minuten. „Mit Vorspulen“ nimmt an, dass die Hälfte der Zeit mit 4x läuft (Taste F am PC, Sonne ziehen am Handy).

**Geschickter Spieler** (weist alle 5 Sekunden zu, nimmt immer den besten Platz, kauft jeden Tag)

| Stufe | Name | Spieltage | 10 % bis 90 % | davon Sparen auf den Ausbau | Echtzeit 1x | mit Vorspulen |
|---|---|---|---|---|---|---|
| 1 | Bootssteg am See | 13 | 12 bis 14 | 5 | 26 min | 16 min |
| 2 | Dorfhafen am See | 46 | 36 bis 50 | 20 | 1 h 32 min | 58 min |
| 3 | Durchstich zur Ostsee | 41 | 38 bis 43 | 13 | 1 h 22 min | 51 min |
| 4 | Marina | 46 | 44 bis 48 | 16 | 1 h 32 min | 58 min |
| 5 | Küstenmarina | 47 | 43 bis 51 | 13 | 1 h 34 min | 59 min |
| 6 | Seehafen bis zum Abschluss | 69 | 64 bis 73 | | 2 h 18 min | 1 h 26 min |
| | **Gesamt** | **259** | 251 bis 268 | | **8 h 38 min** | **5 h 28 min** |

**Gemütlicher Spieler** (schaut nur alle 20 Sekunden auf die Einfahrt, nimmt jedes vierte Mal irgendeinen passenden Platz, kauft jeden zweiten Tag und lässt ein Drittel der Gelegenheiten aus): 276 Tage, 9 h 12 min bei 1x, 5 h 45 min mit Vorspulen. Am meisten Zeit verliert er in Stufe 2, weil er dort spät in Versorgung investiert.

Ungeschicktes Spielen bremst nie stark und blockiert nie. Das passt zu „kein Scheitern“.

**Einnahmen pro Tag** (Median, geschickter Spieler, mit Services und Ereignissen): Stufe 1 rund 50 €, Stufe 2 rund 160 €, Stufe 3 rund 1.000 €, Stufe 4 rund 2.000 €, Stufe 5 rund 3.500 €, Stufe 6 rund 6.300 €. Das Liegegeld kommt beim Anlegen, der Bot streicht es sofort ein.

## Die wichtigsten Zahlen

**Grundpreise pro Nacht:** S 10 €, M 22 €, L 45 €, XL 120 €. Jeder erfüllte Wunsch +25 %. Mehrrumpfboote brauchen einen Stirnplatz, Behördenboote zahlen die Hälfte und geben einen Anker extra.

**XXL (Stufe 6):** Kreuzfahrtschiffe, Marineschiffe und der Seenotrettungskreuzer zahlen kein Liegegeld. Sie liegen an festen Plätzen (P01 Kreuzfahrtpier, MA01 und MA02 Marineanleger, SK01 Seenotkreuzer), auf die keine Gastboote gelegt werden. Geld bringen sie je Besuch über die Services:

| Service | Stufe | Kosten | Voraussetzung | Besuch |
|---|---|---|---|---|
| Kreuzfahrtterminal | Kreuzfahrtpier | 60.000 € | Fahrgastanleger | Kreuzfahrtschiff etwa alle 7 Tage |
| | Terminal mit Busplatz | 120.000 € | | etwa alle 4 Tage |
| Marineanleger | Anleger | 50.000 € | Seenotretter | Flottenbesuch etwa alle 10 Tage |
| | Stützpunkt | 100.000 € | | häufiger |
| Seenotretter | Seenotkreuzer | ab Stufe 6 | | stationiert, schützt bei Sturm |

**Ausbaustufen**

| Stufe | Boote pro Tag bei Ruf 3 | Ziel für die nächste Stufe | Großes Bauprojekt | Kosten |
|---|---|---|---|---|
| 1 Bootssteg am See | 4 (nur S) | 20 Gäste, Ruf 2,5 | Dorfhafen am See | 400 € |
| 2 Dorfhafen am See | 13 | 140 Gäste, Ruf 3,0 | Durchstich zur Ostsee | 5.000 € |
| 3 Durchstich zur Ostsee | 22 | 480 Gäste, Ruf 3,5 | Schwimmsteg D | 20.000 € |
| 4 Marina | 30 | 800 Gäste, Ruf 3,8 | Außenhafen mit Kai | 42.000 € |
| 5 Küstenmarina | 32 | 1.200 Gäste, Ruf 4,2 | Pier für Großschiffe (P01, MA01, MA02, SK01) | 70.000 € |
| 6 Seehafen | 32 (keine neuen Gastplätze) | Abschluss: 6 Besuche großer Schiffe, Ruf 4,5, alle Plätze gebaut | | |

Das Abschlussziel benutzt nur Dinge, die der Spieler im Hafen sieht: Geld, Ruf und die großen Schiffe, die einlaufen. Eine eigene Zahl für Tagesgäste gibt es nicht (Entscheidung Jorven, 11.11.2026). Gezählt werden Besuche von Kreuzfahrtschiffen und Flottenbesuche in Stufe 6.

**Einfahren und Warten** (`ECONOMY.warten`): Ein ankommendes Boot gibt dem Spieler `selbstEinfahrenNach` = 8 Sekunden zum Lenken. Lenkt er es nicht, fährt es selbst in eine passende freie Box; bei vollen Bojen fährt es gleich ohne Boje hinein (Spielregeln, PR 113). Wer selbst zuweist, kann eine Box mit erfüllten Wünschen wählen und bekommt dafür die bessere Bewertung. Passt keine freie Box, wartet das Boot bis zu 30 Sekunden (`geduld`), etwa drei bis vier Stunden auf der Spieluhr. Wer abends noch an der Boje liegt, bleibt über Nacht dort und fährt morgens weiter, ohne schlechte Bewertung (`ueberNacht`). Warteplätze je Stufe: 3, 6, 5, 7, 8, 8, so viele, wie die Landschaft Bojen zeichnet. Dreht ein Boot ab, weil alle Bojen belegt sind, gibt es keine schlechte Bewertung.

**Tagesrhythmus** (`ECONOMY.zeit`, Anteile des 90-Sekunden-Tags): Gäste legen zwischen 0,07 und 0,3 ab (etwa 7:30 bis 11:00), neue kommen zwischen 0,35 und 0,95 (etwa 11:00 bis 19:30), die meisten um 0,62 (Nachmittag, etwa 15:30). Die breite Verteilung und 32 Ankünfte in Stufe 5 und 6 halten die Warteschlange ruhig: Ohne dass jemand zuweist, drehen in Stufe 5 und 6 nur 1 bis 2 Boote am Tag ab, weil der Hafen voll ist (gemessen mit allen Plätzen und Ruf 5).

**Hafenbüro** (`ECONOMY.hafenbuero`), reiner Komfort, keine Einnahmen:

| Stufe | Name | Ab Ausbaustufe | Kosten | Schaltet frei |
|---|---|---|---|---|
| 1 | Hafenmeister | 2 | 600 € | Knopf „Alles kassieren“ |
| 2 | Kassenautomat | 2 | 1.800 € | Liegegeld kommt beim Anlegen von selbst in die Kasse |
| 3 | Hafenbüro | 3 | 3.800 € | wartende Boote bekommen sofort die Box mit den meisten erfüllten Wünschen |

**Tagestörn** (`ECONOMY.tagestoern`): Gäste mit zwei oder mehr Nächten fahren mit 35 % Wahrscheinlichkeit tagsüber hinaus (zwischen 12 % und 30 % des Tages) und kommen zwischen 60 % und 85 % des Tages in dieselbe Box zurück. Die Box bleibt reserviert.

**Gekaufte Plätze bleiben erhalten.** Baut eine spätere Stufe einen Steg um, gehören die Ersatzplätze zum selben Stegprojekt. Beispiel: „Steg B“ bringt in Stufe 2 die Boxen B01 bis B08; in Stufe 3 fallen B01 und B02 weg, dafür gehören B19 und B20 dazu. Jedes Projekt hat in jeder späteren Stufe mindestens so viele Plätze wie beim Kauf, und wer es erst später kauft, bekommt gleich die neue Form. In Stufe 6 bleiben alle 94 Plätze aus Stufe 5 unverändert. `--pruefen` und `tests/economy-sim.test.mjs` stellen das sicher.

**Stegprojekte:** 16 Stück von 180 € (Haken an Steg A) bis 33.000 € (Kai verlängern). Jeder der 113 Plätze aus `harbor.js` gehört genau einem Projekt oder Ausbau.

**Versorgung:** Toilette, Dusche, Gastronomie je 4 Stufen, Tankstelle 2 Stufen, Stromsäulen an Steg B. Kapazitäten sind so gewählt, dass die größte Stufe einen vollen Hafen (91 Gastplätze) versorgt.

**Services:** 13 Services mit 1 bis 2 Stufen, Format mit dem Services-Thread abgestimmt (`ECONOMY.services[id].stufen[n].wirkung`). Kein Service hat laufende Kosten.

## Was die Simulation abdeckt

- Ankünfte, Bootsarten mit Maßen und Passregel, Wünsche, Warteschlange, Abweisen, Ruf, Kassieren, Stufenziele und Stegprojekte kommen aus `sim.js`.
- Services bringen Tageseinnahmen, Kunden, Besuche großer Schiffe und Winter-Einnahmen über `services/rules.js`, ihre Wirkung auf Ankünfte und Ruf geht über einen Modifikator in `sim.js` ein.
- Ereignisse kommen aus `events/scheduler.js` mit demselben Startwert wie das Spiel. Sturm kostet Ankünfte, Regatta und Hafenfest bringen mehr, das Wetter geht in die Services ein.
- Der Bot kassiert immer alles sofort, auch ohne Hafenbüro.
- Das Abschlussziel von Stufe 6 prüft im Spiel `sim.regionGoal()` (Meldung `sim:regionDone`), im Werkzeug `tools/balance.mjs` mit denselben Zahlen.

## Was noch auffällt

- **Sparphasen am Ende jeder Stufe:** Die längste Zeit ohne Kauf liegt bei 12 bis 23 Spieltagen, jeweils während man auf das große Bauprojekt spart. Ereignisse füllen diese Zeit, trotzdem empfehle ich für die Oberfläche einen Sparbalken am Bauprojekt, der sich sichtbar füllt. Dann fühlt sich Sparen wie Fortschritt an.
- **Ruf ist für gute Spieler leicht:** Wer seine Versorgung ausbaut, liegt fast immer bei 4,9 bis 5 Ankern. Die Ruf-Ziele bremsen vor allem Spieler, die Versorgung vernachlässigen. Das ist gewollt (cozy).
- **Stufe 6 ist die längste Stufe** (rund 69 Tage), weil man auf die teuren Großschiff-Services spart. Dafür passiert dort am meisten: Kreuzfahrtschiffe und Flottenbesuche laufen ein.
- **Nach dem Abschluss** bleiben einige Services übrig (große Winterhalle, Museumshafen und andere). Sie sind Inhalt für den Endlosmodus.
