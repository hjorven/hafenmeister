# Balancing

Stand: 12.11.2026, nach „Eine Quelle für alle Zahlen“ (Paket P06) und Stufe 6 mit Windjammertreffen und Barkasse (PR 139). Gilt für die erste Region (deutsche Ostsee, Stufen 1 bis 6, 94 Gastplätze plus die festen Plätze der Großschiffe in Stufe 6).

## Wo die Zahlen liegen

**Eine Quelle:** Jede Zahl, die das Spiel braucht, steht in `web/js/data/economy.js` (`ECONOMY`). Andere Dateien haben keine eigenen Zahlen mehr (Paket P06):

| Datei | Inhalt | Gehört |
|---|---|---|
| `web/js/data/economy.js` | alle Spielzahlen: Zeit, Preise, Wünsche, Ruf, Stufen und Ziele, Stegprojekte, Bauwerke, Hafenbüro, Services, Ereignisse, Warten, Tagestörn, Stammgäste, Dauerlieger, Tagesziele | Balancing |
| `web/js/data/rules.js` | `rulesFromEconomy(E)`: baut aus `ECONOMY` die Regeln für `sim.js`, ohne eigene Zahlen. `RULES = rulesFromEconomy(ECONOMY)` | Balancing |
| `web/js/data/services.js` | nur Namen, Texte und Lage der Services; `SERVICES` fügt sie mit `ECONOMY.services` zusammen | Services |
| `web/js/data/events.js` | nur Texte und Wetterbild der Ereignisse; `EVENTS`, `YEAR`, `SCHEDULE` kommen aus `ECONOMY.ereignisse` und `ECONOMY.zeit` | Ereignisse |
| `docs/zahlen.md` | Übersicht aller Zahlen, erzeugt mit `node tools/zahlen.mjs --schreiben` | erzeugt |
| `tools/zahlen.mjs` | prüft die Zahlen: Felder, die kein Spielcode liest, Ja/Nein statt Zahl, Ausbaustufen, die nicht teurer werden | Balancing |
| `tools/balance.mjs` | spielt die Regeln ohne Grafik viele Male durch und meldet die Spielzeit | Balancing |
| `tests/regeln.mjs` | gemeinsamer Aufbau für alle Regeltests: echter Hafen, `RULES` aus `ECONOMY`, Testboote | Balancing |
| `tests/balance.test.mjs`, `tests/zahlen.test.mjs`, `tests/spieltag.test.mjs` | Daten passen zu `harbor.js`, Spielzeit im Zielkorridor, `docs/zahlen.md` aktuell, ein ganzer Spieltag mit festem Startwert | Balancing |

Wer eine Zahl braucht, die noch fehlt, trägt sie in `economy.js` ein und liest sie über `rulesFromEconomy` (Spielregeln) oder direkt aus `ECONOMY` (Module), statt sie im Code festzulegen. Danach `node tools/zahlen.mjs --schreiben`. Die höchste Stufe im Spiel (`rules.maxStage`) ist die höchste Stufe in `ECONOMY.stufen`, derzeit 6.

**Feldnamen:** In `economy.js` deutsch (`kosten`, `abStufe`, `wirkung`), in `sim.js` englisch (`cost`, `fromStage`). Die Übersetzung steht an genau einer Stelle, in `data/rules.js`. Ausnahme: die Wirkung der Ereignisse (`arrivalFactor` und so weiter) heißt wie die Felder, die `sim.js` liest.

**Zufall:** Alles, was Geld, Gäste oder Ruf ändert, nimmt den Zufall aus `web/js/random.js` (`random(state)` im Spielstand oder `zufallAus(seed)`), nie `Math.random`. Gleicher Startwert, gleiches Spiel. `tests/zahlen.test.mjs` prüft das für die Regelmodule.

## Benutzen

```bash
node tools/balance.mjs --pruefen
node tools/balance.mjs
node tools/balance.mjs --laeufe 200
node tools/balance.mjs --verlauf 3
node tools/balance.mjs --verlauf 3 --gemuetlich
node tools/balance.mjs --json
node tools/zahlen.mjs --pruefen
node tools/zahlen.mjs --schreiben
node --test tests/*.test.mjs
```

`--pruefen` ruft auch `tools/zahlen.mjs` auf und meldet jeden Liegeplatz aus `harbor.js`, der keinem Projekt gehört oder doppelt vergeben ist, und jedes Projekt, das in einer späteren Stufe Plätze verlieren würde. `--verlauf` zeigt Tag für Tag, was ein Spieler kauft und wie Geld und Ruf laufen. Hat `economy.js` mehr Stufen als `harbor.js`, rechnet das Werkzeug trotzdem und meldet die fehlenden Platz-ids als Hinweis.

## Ergebnis (100 Läufe je Spielertyp, mit den echten Spielregeln)

`tools/balance.mjs` spielt mit `web/js/sim.js` (über `rulesFromEconomy(ECONOMY)` aus `data/rules.js`), dem Bootskatalog, den Services (`web/js/services/rules.js`) und den Ereignissen (`web/js/events/scheduler.js`: Sturm, Regatta, Hafenfest, Nebel, mit Wetter). Ein Spieltag dauert bei 1x 2 Minuten. „Mit Vorspulen“ nimmt an, dass die Hälfte der Zeit mit 4x läuft (Taste F am PC, Sonne ziehen am Handy).

**Geschickter Spieler** (weist alle 5 Sekunden zu, nimmt immer den besten Platz, kauft jeden Tag)

| Stufe | Name | Spieltage | 10 % bis 90 % | davon Sparen auf den Ausbau | Echtzeit 1x | mit Vorspulen |
|---|---|---|---|---|---|---|
| 1 | Bootssteg am See | 14 | 13 bis 15 | 5 | 28 min | 18 min |
| 2 | Dorfhafen am See | 38 | 35 bis 48 | 10 | 1 h 16 min | 48 min |
| 3 | Durchstich zur Ostsee | 43 | 41 bis 47 | 11 | 1 h 26 min | 54 min |
| 4 | Marina | 52 | 48 bis 53 | 13 | 1 h 44 min | 1 h 05 min |
| 5 | Küstenmarina | 62 | 60 bis 63 | 12 | 2 h 04 min | 1 h 18 min |
| 6 | Seehafen bis zum Abschluss | 56 | 51 bis 60 | | 1 h 52 min | 1 h 10 min |
| | **Gesamt** | **266** | 256 bis 278 | | **8 h 52 min** | **5 h 31 min** |

Stand mit unregelmäßigen Ankünften (Abstände 3 bis 8 s, höchstens 20 Boote je Tag): Ab Stufe 4 kommen an vollen Tagen etwas weniger Boote als vorher (bis 27), darum dauern Stufe 4 und 5 je etwa eine Woche länger.

**Gemütlicher Spieler** (schaut nur alle 20 Sekunden auf die Einfahrt, nimmt jedes vierte Mal irgendeinen passenden Platz, kauft jeden zweiten Tag und lässt ein Drittel der Gelegenheiten aus): 269 Tage, 8 h 58 min bei 1x, 5 h 34 min mit Vorspulen. Am meisten Zeit verliert er in Stufe 2, weil er dort spät in Versorgung investiert.

Ungeschicktes Spielen bremst nie stark und blockiert nie. Das passt zu „kein Scheitern“.

**Untätiger Spieler** zum Vergleich (weist nie zu, kassiert nie, kauft nichts, 20 Läufe): Bis Tag 30 kommen 510 € in die Kasse (nur die Kasse des Vertrauens), der Ruf fällt auf 1,9. Der geschickte Spieler hat bis dahin 2.127 € eingenommen. Spielen lohnt sich also deutlich, Nichtstun ruiniert aber auch nichts.

**Leerlauf** (Saisontage einer Stufe ohne Kauf, Median, geschickter Spieler): Stufe 1 10 von 13, Stufe 2 37 von 47, Stufe 3 27 von 41, Stufe 4 31 von 45, Stufe 5 35 von 46, Stufe 6 40 von 65. An rund drei von vier Tagen gibt es nichts zu kaufen, nur zuzuweisen und zu kassieren. Das ist der größte Hebel für Paket P17 und die Pakete mit neuen Aufgaben.

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

**Tagesrhythmus** (`ECONOMY.zeit`, Anteile des 90-Sekunden-Tags): Gäste legen zwischen 0,07 und 0,3 ab (etwa 7:30 bis 11:00), neue kommen zwischen 0,2 und 0,95 (etwa 9:30 bis 19:30, seit PR zu T9 mit mindestens 3 Sekunden Abstand, `ankunftAbstand`), die meisten um 0,62 (Nachmittag, etwa 15:30). Die breite Verteilung und 32 Ankünfte in Stufe 5 und 6 halten die Warteschlange ruhig: Ohne dass jemand zuweist, drehen in Stufe 5 und 6 nur 1 bis 2 Boote am Tag ab, weil der Hafen voll ist (gemessen mit allen Plätzen und Ruf 5).

**Hafenbüro** (`ECONOMY.hafenbuero`), vor allem Komfort; Einnahmen bringen nur Trinkgeld (Stufe 2) und Nebenkosten (Stufe 3):

| Stufe | Name | Ab Ausbaustufe | Kosten | Schaltet frei |
|---|---|---|---|---|
| 1 | Hafenmeister mit Funk | 2 | 600 € | Knopf „Kassieren“ (alle Münzen auf einmal), Vorschau der nächsten Boote (`vorschau`, Anzeige P11); vorher streicht man jede Münze selbst |
| 2 | Kassenautomat | 2 | 1.800 € | Liegegeld von S und M kommt beim Anlegen von selbst in die Kasse (`klassen`); L, XL, XXL zahlen persönlich und geben beim Abholen 15 % Trinkgeld (`trinkgeld`) |
| 3 | Hafenbüro | 3 | 3.800 € | Vorschlag: Das Büro zeigt für jedes Boot die beste Box (goldene Raute, nach Wünschen, Komfort und knappem Platz), „Vorschlag annehmen“ fährt hin. Ohne Büro nimmt „Einfahren lassen“ die Box, die sich das Boot selbst suchen würde (nur nach Wünschen und Weg, seit PR 176). Nebenkosten: Das Büro rechnet Strom, Wasser und Duschen ab, auf jedes kassierte Liegegeld kommen 10 % (`nebenkosten.anteil`), nicht beim Rundgang und nicht für liegengebliebene Münzen |
| 4 | Hafenleitstelle | 4 | 9.500 € | volle Automatik: wartende Standardboote bekommen sofort die Box mit den meisten erfüllten Wünschen, je Größe S, M, L abschaltbar (Bauen, Reiter Hafen); Sonderfälle bleiben beim Spieler |

Von Hand eingewiesene Gäste (Ziehen, Ring, „Einfahren lassen“, „Vorschlag annehmen“) bewerten um `vonHandBonus` = 0,25 Anker besser; selbst eingefahrene und von der Leitstelle zugewiesene nicht.

**Sonderfälle** (`ECONOMY.hafenbuero.sonderfaelle`, Roadmap P02): Mehrrumpfboote, Schiffe der Klassen XL und XXL, Sondergäste und Boote, für die nur noch genau eine Box frei ist, weist die Automatik nicht zu. Wer einmal Sonderfall ist, bleibt es (`boat.officeCase`). Sie tragen eine orange Raute und fahren erst nach 25 s an der Boje selbst ein (statt 8 s), dann in die Box, die sie sich selbst suchen. Der Bot weist sie mit Leitstelle selbst zu. Ergebnis nach PR 176 mit Nebenkosten (`node tools/balance.mjs`): geschickt 246, gemütlich 261 Spieltage (ohne Nebenkosten 251 und 266) bis zum Abschluss, im Korridor 200 bis 360.

**Tagestörn** (`ECONOMY.tagestoern`): Gäste mit zwei oder mehr Nächten fahren mit 35 % Wahrscheinlichkeit tagsüber hinaus (zwischen 12 % und 30 % des Tages) und kommen zwischen 60 % und 85 % des Tages in dieselbe Box zurück. Die Box bleibt reserviert.

**Gekaufte Plätze bleiben erhalten.** Baut eine spätere Stufe einen Steg um, gehören die Ersatzplätze zum selben Stegprojekt. Beispiel: „Steg B“ bringt in Stufe 2 die Boxen B01 bis B08; in Stufe 3 fallen B01 und B02 weg, dafür gehören B19 und B20 dazu. Jedes Projekt hat in jeder späteren Stufe mindestens so viele Plätze wie beim Kauf, und wer es erst später kauft, bekommt gleich die neue Form. In Stufe 6 bleiben alle 94 Plätze aus Stufe 5 unverändert. `--pruefen` und `tests/economy-sim.test.mjs` stellen das sicher.

**Stegprojekte:** 16 Stück von 180 € (Haken an Steg A) bis 33.000 € (Kai verlängern). Jeder der 113 Plätze aus `harbor.js` gehört genau einem Projekt oder Ausbau.

**Versorgung:** Toilette, Dusche, Gastronomie je 4 Stufen, Tankstelle 2 Stufen, Stromsäulen an Steg B. Kapazitäten sind so gewählt, dass die größte Stufe einen vollen Hafen (91 Gastplätze) versorgt.

**Services:** 21 Services mit 1 bis 3 Stufen, alle Zahlen in `ECONOMY.services[id].stufen[n]`, Namen in `data/services.js`. Kein Service hat laufende Kosten. Sturmschutz: Seenotretter-Station halbiert die Folgen eines Sturms, der Seenotkreuzer nimmt 80 % weg (Deckel 0,8). Das Windjammertreffen kostet 34.000 €, mehr als die Stufe davor.

**Angebote an Land** (echter-hafen.md C11, PR 111). Jedes hat sich nach rund 25 bis 45 Spieltagen bezahlt gemacht, also innerhalb seiner Stufe. Grillplatz und Brötchenservice sind fast nur Ruf und dafür billig.

| Angebot | Ab Stufe | Kosten | Wirkung |
|---|---|---|---|
| Brötchenservice, später Hafenbäcker | 1, Ausbau ab 3 | 80 €, 3.200 € | Kunden am Morgen, etwas Ruf |
| Hafencafé, später Café mit Terrasse | 2, Ausbau ab 3 | 800 €, 4.800 € | Tageseinnahme (bei Regen weniger), Kunden, Ruf |
| Grillplatz | 2 | 400 € | Ruf |
| Fahrradverleih | 3 | 2.000 € | Tageseinnahme bei gutem Wetter, Kunden |
| Eisdiele | 4 | 5.000 € | Tageseinnahme bei gutem Wetter, Kunden, etwas Ruf |

Mit den Angeboten wird die Region drei Spieltage schneller fertig, die Spielzeit bleibt im Korridor. Alle Zahlen im Überblick: `docs/zahlen.md`.

## Regeln im Spiel, die sonst nirgends stehen

Stand `main` nach PR 160 (P06), nachgeprüft im Code. Die Pakete in der rechten Spalte ändern die Regel noch; dann wird auch diese Tabelle angepasst ([Roadmap](roadmap.md), Abschnitt 9).

| Regel | Wert heute | Wo im Code | Paket |
|---|---|---|---|
| Start | 0 €, fünf Startbewertungen mit 3 Ankern, Ruf ist der Schnitt der letzten 20 | `state.js`, `economy.js` (`ruf.start`), `data/rules.js` (`startSamples`) | P17 |
| Dauerlieger | zahlen pauschal 15 € pro Abend (`fischer.pachtProTag`), Dauerplätze kosten nichts und haben keine Obergrenze | `sim.js` (`startEvening`, `rulesFromEconomy`), `features/dauerlieger.js` | P01 |
| Abweisen von Hand | kostet nichts und bringt keine Bewertung | `sim.js` (`dismiss`) | P10 |
| Wegfahren ohne Platz | mit 25 % Wahrscheinlichkeit eine Bewertung von 2,5 (`ruf.abgewiesen`); dreht ein Boot ab, weil alle Wartebojen belegt sind, gibt es keine Bewertung | `sim.js` (`turnAway`) | P10 |
| Hafenmeister-Rundgang | startet bei 68 % des Tages (`RUNDGANG_AB`), etwa 8 Sekunden vor dem Abend | `data/people.js` | P12 |
| Mindestruf für Service-Stufen | Segelclub Stufe 3 (Regattaverein) 3,8; Travellift Stufe 3 (Werfthalle) 3,8; Fahrgastanleger Stufe 2 4,0; Museumshafen 4,0 und 4,2; Kreuzfahrtterminal 4,0 und 4,5; Marineanleger 4,0 und 4,6 | `economy.js` (`services[id].stufen[n].ruf`) | P06 (erledigt) |
| Deckel der Services | Ruf-Bonus aller Services zusammen höchstens +0,75 (`RUF_BONUS_MAX`), Sturmschutz höchstens 0,8 (`STURMSCHUTZ_MAX`) | `data/services.js` | P06 (erledigt) |
| Marineanleger Stufe 2 (Stützpunkt) | Flottenbesuch alle 6 statt alle 10 Tage (je 2 Tage), dazu Tag der offenen Tür | `economy.js` (`services.marineanleger`) | P04 (erledigt) |
| Stufennamen der Services | Travellift heißt in Stufe 1 "Bootsschuppen mit Werkstatt", Stufe 2 "Travellift", Stufe 3 "Werfthalle mit Slipwagen"; die Namen in [services.md](services.md) folgen `data/services.js` | `data/services.js` | P04, P06 (erledigt) |

## Was die Simulation abdeckt

- Ankünfte, Bootsarten mit Maßen und Passregel, Wünsche, Warteschlange, Abweisen, Ruf, Kassieren, Stufenziele und Stegprojekte kommen aus `sim.js`.
- Services bringen Tageseinnahmen, Kunden, Besuche großer Schiffe und Winter-Einnahmen über `services/rules.js`, ihre Wirkung auf Ankünfte und Ruf geht über einen Modifikator in `sim.js` ein.
- Ereignisse kommen aus `events/scheduler.js` mit demselben Startwert wie das Spiel. Sturm kostet Ankünfte, Regatta und Hafenfest bringen mehr, das Wetter geht in die Services ein.
- Der Bot kassiert immer alles sofort, auch ohne Hafenbüro.
- Mit Hafenbüro-Automatik weist der Bot nur noch die Sonderfälle selbst zu (`sim.officeSpecialCase`).
- Das Abschlussziel von Stufe 6 prüft im Spiel `sim.regionGoal()` (Meldung `sim:regionDone`), im Werkzeug `tools/balance.mjs` mit denselben Zahlen.

## Was noch auffällt

- **Sparphasen am Ende jeder Stufe:** Die längste Zeit ohne Kauf liegt bei 12 bis 23 Spieltagen, jeweils während man auf das große Bauprojekt spart. Ereignisse füllen diese Zeit, trotzdem empfehle ich für die Oberfläche einen Sparbalken am Bauprojekt, der sich sichtbar füllt. Dann fühlt sich Sparen wie Fortschritt an.
- **Ruf ist für gute Spieler leicht:** Wer seine Versorgung ausbaut, liegt fast immer bei 4,9 bis 5 Ankern. Die Ruf-Ziele bremsen vor allem Spieler, die Versorgung vernachlässigen. Das ist gewollt (cozy).
- **Stufe 6 ist die längste Stufe** (rund 69 Tage), weil man auf die teuren Großschiff-Services spart. Dafür passiert dort am meisten: Kreuzfahrtschiffe und Flottenbesuche laufen ein.
- **Nach dem Abschluss** bleiben einige Services übrig (große Winterhalle, Museumshafen und andere). Sie sind Inhalt für den Endlosmodus.
