# Balancing

Stand: 12.11.2026. Gilt für die erste Region (deutsche Ostsee, Stufen 1 bis 6, 94 Gastplätze plus die festen Plätze der Großschiffe in Stufe 6).

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

`tools/balance.mjs` spielt mit `web/js/sim.js` (über `sim.rulesFromEconomy(ECONOMY)`), dem Bootskatalog, den Services (`web/js/services/rules.js`) und den Ereignissen (`web/js/events/scheduler.js`: Sturm, Regatta, Hafenfest, Nebel, mit Wetter). Ein Spieltag dauert bei 1x 2 Minuten. „Mit Vorspulen“ nimmt an, dass die Hälfte der Zeit auf der höchsten Stufe läuft (2x, ab Hafenbüro 3x).

**Geschickter Spieler** (weist alle 5 Sekunden zu, nimmt immer den besten Platz, kauft jeden Tag)

| Stufe | Name | Spieltage | 10 % bis 90 % | davon Sparen auf den Ausbau | Echtzeit 1x | mit Vorspulen |
|---|---|---|---|---|---|---|
| 1 | Bootssteg am See | 14 | 12 bis 15 | 6 | 28 min | 21 min |
| 2 | Dorfhafen am See | 49 | 46 bis 70 | 11 | 1 h 38 min | 1 h 14 min |
| 3 | Durchstich zur Ostsee | 53 | 49 bis 57 | 16 | 1 h 46 min | 1 h 11 min |
| 4 | Marina | 55 | 51 bis 57 | 15 | 1 h 50 min | 1 h 13 min |
| 5 | Küstenmarina | 48 | 46 bis 50 | 10 | 1 h 36 min | 1 h 04 min |
| 6 | Seehafen bis zum Abschluss | 63 | 61 bis 65 | | 2 h 06 min | 1 h 24 min |
| | **Gesamt** | **281** | 276 bis 306 | | **9 h 22 min** | **6 h 27 min** |

**Gemütlicher Spieler** (schaut nur alle 20 Sekunden auf die Einfahrt, nimmt jedes vierte Mal irgendeinen passenden Platz, kauft jeden zweiten Tag und lässt ein Drittel der Gelegenheiten aus): 309 Tage, 10 h 18 min bei 1x, 7 h 02 min mit Vorspulen. Am meisten Zeit verliert er in Stufe 2, weil er dort spät in Versorgung investiert.

Ungeschicktes Spielen bremst nie stark und blockiert nie. Das passt zu „kein Scheitern“.

**Einnahmen pro Tag** (Median, geschickter Spieler, mit Services und Ereignissen): Stufe 1 rund 50 €, Stufe 2 rund 180 €, Stufe 3 rund 870 €, Stufe 4 rund 1.850 €, Stufe 5 rund 4.300 €, Stufe 6 rund 7.100 €.

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
| 5 Küstenmarina | 37 | 1.200 Gäste, Ruf 4,2 | Pier für Großschiffe (P01, MA01, MA02, SK01) | 70.000 € |
| 6 Seehafen | 42 | Abschluss: 8 Besuche großer Schiffe, Ruf 4,5, alle Plätze gebaut | | |

Das Abschlussziel benutzt nur Dinge, die der Spieler im Hafen sieht: Geld, Ruf und die großen Schiffe, die einlaufen. Eine eigene Zahl für Tagesgäste gibt es nicht (Entscheidung Jorven, 11.11.2026). Gezählt werden Besuche von Kreuzfahrtschiffen und Flottenbesuche in Stufe 6.

**Warten vor dem Hafen** (`ECONOMY.warten`): Ein Boot wartet bis zu 80 Sekunden an seiner Boje (vorher 50). Warteplätze je Stufe: 3, 6, 5, 7, 8, 8, so viele, wie die Landschaft Bojen zeichnet. Ab dem Hafenbüro (Stufe 3, 3.800 €) weist das Spiel wartende Boote selbst zu, sobald ein passender Platz frei wird, nicht nur bei der Ankunft. Dreht ein Boot ab, weil alle Bojen belegt sind, gibt es keine schlechte Bewertung; nur wer an der Boje warten musste, kann den Ruf senken.

Gemessen mit einem Spieler, der nur alle 20 Sekunden zuweist: Ohne Hafenbüro drehen in Stufe 5 rund 27 Boote am Tag ab, mit Hafenbüro nur noch die, für die der Hafen wirklich voll ist (rund 13 am Tag). Ab Stufe 3 ist das Hafenbüro deshalb der Weg aus der Hektik.

**Gekaufte Plätze bleiben erhalten.** Baut eine spätere Stufe einen Steg um, gehören die Ersatzplätze zum selben Stegprojekt. Beispiel: „Steg B“ bringt in Stufe 2 die Boxen B01 bis B08; in Stufe 3 fallen B01 und B02 weg, dafür gehören B19 und B20 dazu. Jedes Projekt hat in jeder späteren Stufe mindestens so viele Plätze wie beim Kauf, und wer es erst später kauft, bekommt gleich die neue Form. In Stufe 6 bleiben alle 94 Plätze aus Stufe 5 unverändert. `--pruefen` und `tests/economy-sim.test.mjs` stellen das sicher.

**Stegprojekte:** 16 Stück von 180 € (Haken an Steg A) bis 33.000 € (Kai verlängern). Jeder der 113 Plätze aus `harbor.js` gehört genau einem Projekt oder Ausbau.

**Versorgung:** Toilette, Dusche, Gastronomie je 4 Stufen, Tankstelle 2 Stufen, Stromsäulen an Steg B. Kapazitäten sind so gewählt, dass die größte Stufe einen vollen Hafen (91 Gastplätze) versorgt.

**Services:** 13 Services mit 1 bis 2 Stufen, Format mit dem Services-Thread abgestimmt (`ECONOMY.services[id].stufen[n].wirkung`). Kein Service hat laufende Kosten.

## Was die Simulation abdeckt

- Ankünfte, Bootsarten mit Maßen und Passregel, Wünsche, Warteschlange, Abweisen, Ruf, Kassieren, Stufenziele und Stegprojekte kommen aus `sim.js`.
- Services bringen Tageseinnahmen, Kunden, Besuche großer Schiffe und Winter-Einnahmen über `services/rules.js`, ihre Wirkung auf Ankünfte und Ruf geht über einen Modifikator in `sim.js` ein.
- Ereignisse kommen aus `events/scheduler.js` mit demselben Startwert wie das Spiel. Sturm kostet Ankünfte, Regatta und Hafenfest bringen mehr, das Wetter geht in die Services ein.
- Der Bot kassiert abends immer alles, auch ohne Hafenbüro.
- Das Abschlussziel von Stufe 6 prüft bisher nur `tools/balance.mjs`. Im Spiel endet Stufe 6 ohne Abschlussmeldung; dafür braucht `sim.js` eine Prüfung des Ziels.

## Was noch auffällt

- **Sparphasen am Ende jeder Stufe:** Die längste Zeit ohne Kauf liegt bei 12 bis 23 Spieltagen, jeweils während man auf das große Bauprojekt spart. Ereignisse füllen diese Zeit, trotzdem empfehle ich für die Oberfläche einen Sparbalken am Bauprojekt, der sich sichtbar füllt. Dann fühlt sich Sparen wie Fortschritt an.
- **Ruf ist für gute Spieler leicht:** Wer seine Versorgung ausbaut, liegt fast immer bei 4,9 bis 5 Ankern. Die Ruf-Ziele bremsen vor allem Spieler, die Versorgung vernachlässigen. Das ist gewollt (cozy).
- **Stufe 6 ist die längste Stufe**, weil man auf die teuren Großschiff-Services spart. Dafür passiert dort am meisten: Kreuzfahrtschiffe und Flottenbesuche laufen ein.
- **Nach dem Abschluss** bleiben einige Services übrig (große Winterhalle, Museumshafen und andere). Sie sind Inhalt für den Endlosmodus.
