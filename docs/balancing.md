# Balancing

Stand: 15.11.2026, nach Paket P17 Teil 2 (neuer Tagesablauf: Tag 270 s plus 30 s Abend, Saison 16 + 2 Tage, Kurzhalt). Gilt für die erste Region (deutsche Ostsee, Stufen 1 bis 6).

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

## Ergebnis (20 Läufe je Spielertyp, mit den echten Spielregeln)

`tools/balance.mjs` spielt mit `web/js/sim.js` (über `rulesFromEconomy(ECONOMY)` aus `data/rules.js`), dem Bootskatalog, den Bootsgeschichten, den Services (`web/js/services/rules.js`) und den Ereignissen (`web/js/events/scheduler.js`). Es rechnet die Zeit der 3D-Ansicht ein (Anfahrt zur Boje, Ablegen aus der Box, siehe [Rechnung und Spiel](#rechnung-und-spiel)). Ein Spieltag dauert bei 1x 5 Minuten (270 s Tag, 30 s Abend). „Mit Vorspulen“ nimmt an, dass die Hälfte der Zeit mit 4x läuft.

**Geschickter Spieler** (weist alle 5 Sekunden zu, nimmt immer den besten Platz, kauft jeden Tag)

| Stufe | Name | Spieltage | 10 % bis 90 % | davon Sparen | Leerlauf (Tage ohne Kauf) | Echtzeit 1x | mit Vorspulen |
|---|---|---|---|---|---|---|---|
| 1 | Bootssteg am See | 5 | 5 bis 6 | 1 | 2 | 25 min | 16 min |
| 2 | Dorfhafen am See | 11 | 9 bis 13 | 3 | 3 | 55 min | 34 min |
| 3 | Durchstich zur Ostsee | 21 | 19 bis 23 | 4 | 5 | 1 h 45 min | 1 h 06 min |
| 4 | Marina | 22 | 21 bis 23 | 2 | 4 | 1 h 50 min | 1 h 09 min |
| 5 | Küstenmarina | 25 | 24 bis 26 | 0 | 8 | 2 h 05 min | 1 h 18 min |
| 6 | Seehafen bis zum Abschluss | 14 | 12 bis 16 | | 7 | 1 h 10 min | 44 min |
| | **Gesamt** | **99** | 97 bis 103 | | | **8 h 15 min** | **5 h 06 min** |

**Gemütlicher Spieler** (schaut nur alle 20 Sekunden auf die Einfahrt, nimmt jedes vierte Mal irgendeinen passenden Platz, kauft jeden zweiten Tag und lässt ein Drittel der Gelegenheiten aus): 5 / 14 / 20 / 22 / 28 / 20 Tage, zusammen 113 Tage, rund 9 h 25 min bei 1x.

**Wie der Bot im Zeitraffer** (`--spieler zeitraffer`: weist nie zu, kauft jeden Tag das Billigste zuerst): 5 / 12 / 20 / 22 / 25 / 16 Tage, zusammen 103.

**Leerlauf:** Mit den langen Tagen gibt es fast jeden Tag etwas zu kaufen (2 bis 8 Tage ohne Kauf je Stufe, vorher 7 bis 34). Die längste Pause ohne Kauf liegt bei 7 Tagen (vorher 17).

**Verlauf von P17:** Vor P17 (90-s-Tag, Saison 30 + 3): geschickt 233, gemütlich 252 Spieltage, rund 7,5 bis 8,5 h. Teil 1 (PR 318, Ü16): 222 und 233 Tage. Mit dem neuen Tagesablauf ohne Anpassung (PR 319): 233 und 251 Tage, also 19 bis 21 h. Teil 2: 99 und 113 Tage, 8 bis 9,5 h, die Echtzeit wie vorher.

**Untätiger Spieler** zum Vergleich (weist nie zu, kassiert nie, kauft nichts, 20 Läufe): Nichtstun ruiniert nichts, bringt aber nur einen Bruchteil (`node tools/balance.mjs` meldet die Einnahmen bis Tag 30).


**Einnahmen pro Tag** (Median, geschickter Spieler, mit Services und Ereignissen): Stufe 1 rund 50 €, Stufe 2 rund 160 €, Stufe 3 rund 1.000 €, Stufe 4 rund 2.000 €, Stufe 5 rund 3.500 €, Stufe 6 rund 6.300 €. Das Liegegeld kommt beim Anlegen, der Bot streicht es sofort ein.

## Die wichtigsten Zahlen

**Größenmischung nach Plätzen (A10):** Boote einer Größe kommen seltener, wenn der Hafen für sie wenige Plätze hat, so wie ein Skipper vorher funkt und hört, dass für 12 m alles voll ist. Faktor je Größe = gebaute Plätze, an die die kleinste Bootsart der Größe passt, geteilt durch den Bedarf (Ankünfte am Tag mal Anteil mal mittlere Nächte, mal Zuschläge wie Ruf-Lockung und Winterarbeiten); höchstens 1, mindestens 0,3 (`ECONOMY.platzMix`). Ist eine Stufe ausgebaut, liegt er überall bei 1. Gemessen (12 Läufe, geschickt): weitergefahrene L-Boote in Stufe 3 von 1,4 auf 0,6 je Tag, in Stufe 4 von 0,7 auf 0,5; XL in Stufe 5 von 0,45 auf 0,08, in Stufe 6 von 0,5 auf 0,06. Spielzeit (40 Läufe): geschickt 227 statt 225 Tage, gemütlich 245 statt 239.

**Liegegeld nach Länge (B10):** Wie in echten Häfen zahlt ein Gast je angefangenem Meter Bootslänge: S 2,50 €, M 2,70 €, L 3,70 €, XL 4,20 € je Meter und Nacht. Ein 4-m-Ruderboot zahlt 10 €, eine 12-m-Yacht 44 €, ein 30-m-Großsegler 126 €. Im Schnitt der Klasse ergibt das die Grundpreise S 11 €, M 22 €, L 45 €, XL 120 € (sie gelten noch für Boote ohne Länge und für Schätzungen). Dazu kommt der Faktor der Bootsart (`feeFactor`, P19, zum Beispiel Katamaran 1,5). Jeder erfüllte Wunsch +25 %. Auch Dauerlieger-Pacht und Bojengeld richten sich nach der Länge. Gemessen auf P19 (40 Läufe): geschickt 225 statt 233 Spieltage, gemütlich 239 statt 254 (Stufe 2: 36 statt 50 Tage), Einnahmen bis Tag 30 3.322 € statt 2.609 € (kleine Boote zahlen im Schnitt etwas mehr). Mehrrumpfboote brauchen einen Stirnplatz, Behördenboote zahlen die Hälfte und geben einen Anker extra.

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
| 1 Bootssteg am See | 8 (nur S) | 20 Gäste, Ruf 2,5 | Dorfhafen am See | 140 € |
| 2 Dorfhafen am See | 18 | 90 Gäste, Ruf 3,0 | Durchstich zur Ostsee | 2.200 € |
| 3 Durchstich zur Ostsee | 25 | 360 Gäste, Ruf 3,5 | Schwimmsteg D | 9.000 € |
| 4 Marina | 29 | 560 Gäste, Ruf 3,8 | Außenhafen mit Kai | 19.000 € |
| 5 Küstenmarina | 31 | 840 Gäste, Ruf 4,2 | Pier für Großschiffe (P01, MA01, MA02, SK01) | 31.500 € |
| 6 Seehafen | 31 (Yachtsteg als letzte Gastplätze) | Abschluss: 6 Besuche großer Schiffe, Ruf 4,5, alle Plätze gebaut | | |

Das Abschlussziel benutzt nur Dinge, die der Spieler im Hafen sieht: Geld, Ruf und die großen Schiffe, die einlaufen. Eine eigene Zahl für Tagesgäste gibt es nicht (Entscheidung Jorven, 11.11.2026). Gezählt werden Besuche von Kreuzfahrtschiffen und Flottenbesuche in Stufe 6.

**Einfahren und Warten** (`ECONOMY.warten`): Ein ankommendes Boot gibt dem Spieler `selbstEinfahrenNach` = 8 Sekunden zum Lenken. Lenkt er es nicht, fährt es selbst in eine passende freie Box; bei vollen Bojen fährt es gleich ohne Boje hinein (Spielregeln, PR 113). Wer selbst zuweist, kann eine Box mit erfüllten Wünschen wählen und bekommt dafür die bessere Bewertung. Passt keine freie Box, wartet das Boot bis zu 30 Sekunden (`geduld`), etwa drei bis vier Stunden auf der Spieluhr. Wer abends noch an der Boje liegt, bleibt über Nacht dort und fährt morgens weiter, ohne schlechte Bewertung (`ueberNacht`). Warteplätze je Stufe: 3, 6, 5, 7, 8, 8, so viele, wie die Landschaft Bojen zeichnet. Dreht ein Boot ab, weil alle Bojen belegt sind, gibt es keine schlechte Bewertung.

**Tagesrhythmus** (`ECONOMY.zeit`, Anteile des 90-Sekunden-Tags): Gäste legen zwischen 0,07 und 0,3 ab (etwa 7:30 bis 11:00), neue kommen zwischen 0,2 und 0,95 (etwa 9:30 bis 19:30, seit PR zu T9 mit mindestens 3 Sekunden Abstand, `ankunftAbstand`), die meisten um 0,62 (Nachmittag, etwa 15:30). Die breite Verteilung und 32 Ankünfte in Stufe 5 und 6 halten die Warteschlange ruhig: Ohne dass jemand zuweist, drehen in Stufe 5 und 6 nur 1 bis 2 Boote am Tag ab, weil der Hafen voll ist (gemessen mit allen Plätzen und Ruf 5).

**Hafenbüro** (`ECONOMY.hafenbuero`), vor allem Komfort; Einnahmen bringen nur Trinkgeld (Stufe 2) und Nebenkosten (Stufe 3):

| Stufe | Name | Ab Ausbaustufe | Kosten | Schaltet frei |
|---|---|---|---|---|
| 1 | Hafenmeister mit Funk | 2 | 600 € | Knopf „Kassieren“ (alle Münzen auf einmal), Vorschau der nächsten Boote (`vorschau`; die Anzeige und ihr Text im Bauen-Menü kommen mit P11); vorher streicht man jede Münze selbst |
| 2 | Kassenautomat | 2 | 1.800 € | Liegegeld von S und M kommt beim Anlegen von selbst in die Kasse (`klassen`); L, XL, XXL zahlen persönlich und geben beim Abholen 15 % Trinkgeld (`trinkgeld`) |
| 3 | Hafenbüro | 3 | 3.800 € | Vorschlag: Das Büro zeigt für jedes Boot die beste Box (goldene Raute, nach Wünschen, Komfort und knappem Platz), „Vorschlag annehmen“ fährt hin. Ohne Büro nimmt „Einfahren lassen“ die Box, die sich das Boot selbst suchen würde (nur nach Wünschen und Weg, seit PR 176). Nebenkosten: Das Büro rechnet Strom, Wasser und Duschen ab, auf jedes kassierte Liegegeld kommen 10 % (`nebenkosten.anteil`), nicht beim Rundgang und nicht für liegengebliebene Münzen |
| 4 | Hafenleitstelle | 4 | 9.500 € | volle Automatik: wartende Standardboote bekommen sofort die Box mit den meisten erfüllten Wünschen, je Größe S, M, L abschaltbar (Bauen, Reiter Hafen); Sonderfälle bleiben beim Spieler |

Von Hand eingewiesene Gäste (Ziehen, Ring, „Einfahren lassen“, „Vorschlag annehmen“) bewerten um `vonHandBonus` = 0,25 Anker besser; selbst eingefahrene und von der Leitstelle zugewiesene nicht.

**Sonderfälle** (`ECONOMY.hafenbuero.sonderfaelle`, Roadmap P02): Mehrrumpfboote, Schiffe der Klassen XL und XXL, Sondergäste und Boote, für die nur noch genau eine Box frei ist, weist die Automatik nicht zu. Mehrrumpf, Größe und Sondergast hängen am Boot; „nur eine Box“ wird bei jeder Prüfung neu bewertet (ist die Box belegt, gibt es nichts zu entscheiden; werden mehr frei, weist die Leitstelle zu). Entscheidung 13.11. (Koordinator, nach Prüfung von PR 193): „nur eine Box“ gilt nur, wenn kein anderes wartendes Boot in dieselbe Box passt. Warten mehrere darauf, gibt die Leitstelle sie dem, der am längsten wartet; die anderen bleiben ohne Raute an der Boje. Eine freie Box bleibt so nie leer, während passende Boote warten. Sie tragen eine orange Raute und fahren erst nach 25 s an der Boje selbst ein (statt 8 s), dann in die Box, die sie sich selbst suchen. Der Bot weist sie mit Leitstelle selbst zu. Ergebnis nach PR 176 mit Nebenkosten (`node tools/balance.mjs`): geschickt 246, gemütlich 261 Spieltage (ohne Nebenkosten 251 und 266) bis zum Abschluss, im Korridor 200 bis 360.

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

## Startwerte und frühe Stufen (P17)

| Was | Wert | Wo |
|---|---|---|
| Startgeld | 0 € | `start.geld` |
| Startplätze | A03 bis A06 (alter Steg, 4 Boxen für S) | `start.plaetze` |
| Erstes Bauwerk | Toilettenhäuschen 35 €, beim ersten Öffnen von Bauen geschenkt (Ü15, PR 237) | `bauwerke.wc`, [bauen.md](bauen.md) |
| Startruf | 3 Anker aus 5 Startbewertungen | `ruf.start`, `ruf.startBewertungen` |
| Erstes Boot | nach 3 Sekunden | `zeit.erstesBootNach` |
| Ausbau zur Stufe 2 | Dorfhafen am See 140 € (Teil 1: 300 €, davor 400 €) | `stufen[0].ausbau.kosten` |
| Ziel Stufe 2 | 90 Gäste, Ruf 3,0 (vorher 120) | `stufen[1].ziel` |
| Steg B (die ersten M-Boxen) | 200 € (Teil 1: 450 €, davor 700 €) | `stegprojekte` `b-steg` |

Entscheidungen (P17, 14.11.2026, Thread „Aufstieg ausbalancieren“): Kein Startgeld, weil das geschenkte Toilettenhäuschen den Start schon weich macht (Ü15). Stufe 2 war lang, weil die Hälfte der Boote (Größe M) anfangs keinen Platz findet und abdreht, bis Steg B gebaut ist; darum wird Steg B billiger und das Gästeziel kleiner. Spätere Stufen bleiben, wie sie sind: Sie liegen im Rahmen, ihr Abstand zum echten Spiel kommt aus dem Ablegen (unten).

### Teil 2: neuer Tagesablauf (15.11.2026)

Ein Tag dauert seit PR 319 rund 5 statt 2 Minuten, es kommen 2,5-mal so viele Boote (viele davon Kurzhalter ohne Nacht). Ziel war dieselbe Echtzeit bis zum Abschluss wie vorher (8 bis 9 h), also rund 100 Spieltage. Entscheidungen:

| Was | Wert | Warum |
|---|---|---|
| Alle Baukosten (Ausbau, Stege, Bauwerke, Hafenbüro, Services, Winterarbeiten, Doppelbox, Rückbau) | x0,45, gerundet | Ein Liegeplatz bringt pro Nacht so viel wie vorher; eine Nacht dauert aber 2,5-mal so lange. Kosten senken ist der eine Hebel, der alles gleich verschiebt; höhere Liegegelder wären unecht (je Meter wie in echten Häfen). |
| Saison / Winter | 16 / 2 Tage, Frühling 1 bis 4, Sommer 5 bis 12, Herbst 13 bis 16 | eine Saison dauert etwa 1,5 h statt 1 h |
| Ereignisse | Abstände und Saisontage auf 16 Tage umgerechnet; Regatta und Holzboot-Treffen 1 Tag, Heringstage 1 Tag (Saisontag 3), Mittsommer Saisontag 7, Hanse-Woche 2 Tage mit 5 Tagen Ankündigung, ein ruhiger Tag dazwischen | Mit 2 Tagen Dauer und 2 Ruhetagen passte die Regatta nicht mehr zwischen die festen Feste (kam kaum noch vor). Jetzt knapp 8 Ereignisse je Saison, Regatta etwa zweimal |
| Besuche großer Schiffe (`besuch.alleTage`) | x16/30 | gleich viele Besuche je Saison |
| Ruf | über 2 statt 3 Tage, Auszeichnung nach 2 Abenden | ein Tag ist länger, der Ruf reagiert weiter spürbar |
| Versorgung (`versorgt`) | x2 | mehr Gäste am Tag |
| Wochenziele | 4 Tage, Gäste 0,6, zufrieden 0,35, Segler 0,2 | nicht in zwei Tagen zu schaffen |
| Dauerlieger | Bewerber warten 5 Tage, Törns 1 bis 2 Tage | Saison kürzer |
| Endlosspiel | Gästeziel 450 (+30, höchstens 650), Belohnung 2.300 / 4.500 €, mindestens 4 Resttage | 16-Tage-Saison, Kosten x0,45 |
| Gästeziele der Stufen | unverändert 20 / 90 / 360 / 560 / 840 | Die Stufen dauern jetzt etwa so lange wie geplant; mehr Gäste am Tag gleichen die kürzere Stufe aus |

## Rechnung und Spiel

Seit P17 wird die Rechnung regelmäßig mit dem echten Spiel im Browser verglichen. Der Bot im Zeitraffer (`tools/zeitraffer/lauf.cjs`) misst dabei je Stufe, wie lange Boote zur Boje fahren, an der Boje warten und beim Ablegen ihre Box halten (Feld `messung` in `ergebnis-<gerät>.json`, Spielsekunden am Tag). `tools/balance.mjs` übernimmt das in `ANSICHT`:

| Messung | Stufe 1 | Stufe 2 | Stufe 3 | Stufe 4 | Stufe 5 | Stufe 6 |
|---|---|---|---|---|---|---|
| 14.11. (5 Läufe, alter Tag): Box beim Ablegen gehalten (s) | 40 bis 47 | 56 bis 74 | 101 bis 126 | 101 bis 154 | 104 bis 154 | 106 bis 154 |
| 15.11. nach PR 327 (3 Läufe, Küste 1, 3, 5): Box beim Ablegen gehalten (s) | 30 bis 36 | 36 bis 39 | 33 bis 43 | 8 bis 48 | 12 bis 30 | 23 bis 45 |
| 15.11.: Anfahrt bis zur Boje (s) | 30 bis 31 | 35 bis 43 | 34 bis 40 | 50 bis 84 | 166 bis 251 | 151 bis 609 |

Der Fehler beim Ablegen (Box blieb bis zu 300 s belegt) ist mit PR 327 behoben. `ANSICHT` in `tools/balance.mjs` rechnet jetzt mit Anfahrt 35 s und Ablegen 35 s.

**Schlussmessung (15.11., P17 Teil 2):** Zeitraffer im Browser mit den neuen Zahlen, Bot wie `--spieler zeitraffer`:

| | Aufstieg Stufe 2 / 3 / 4 / 5 / 6 an Tag | Ende der Region |
|---|---|---|
| Spiel, Küste 1 (Seed 11) | 6 / 20 / 41 / 63 / 89 | 100 |
| Spiel, Küste 3 (Seed 5) | 6 / 20 / 41 / 62 / 87 | 99 |
| Spiel, Küste 5 (Seed 7) | 7 / 22 / 42 / 65 / 92 | 102 |
| Rechnung `--spieler zeitraffer` (20 Läufe, Median) | 6 / 18 / 38 / 60 / 85 | 103 |

Abweichung beim Ende: Rechnung 103, Spiel im Mittel 100,3 Tage, also 2,7 %, innerhalb des Ziels von 5 %. Die Aufstiege in der Mitte liegen in der Rechnung 2 bis 4 Tage früher.

**Auffällig (an den Boote-Thread):** Ab Stufe 4 brauchen Boote bis zur Warteboje im Mittel 50 bis 600 s, in Stufe 6 oft bis zur Notbremse `anfahrtMaxAnsicht` (600 s). Auf den Aufstieg wirkt sich das kaum aus (die Box wird beim Selbst-Einfahren schon vorher vergeben), im Bild sind es aber lange Anfahrten.

```bash
node tools/balance.mjs --spieler zeitraffer
node tools/balance.mjs --ohne-ansicht
node tools/zeitraffer/lauf.cjs --geraet pc --minuten 115 --bild 9999 --gelaende 1 --seed 11 --out /tmp/zeitraffer
```

## Regeln im Spiel, die sonst nirgends stehen

Stand `main` nach PR 160 (P06), nachgeprüft im Code. Die Pakete in der rechten Spalte ändern die Regel noch; dann wird auch diese Tabelle angepasst ([Roadmap](roadmap.md), Abschnitt 9).

| Regel | Wert heute | Wo im Code | Paket |
|---|---|---|---|
| Start | 0 € (`start.geld`), der alte Steg mit A03 bis A06, fünf Startbewertungen mit 3 Ankern, Ruf ist der Schnitt der letzten drei Tage, mindestens der letzten 10 Bewertungen (P19, [ruf.md](ruf.md)) | `economy.js` (`start`, `ruf.start`), `data/rules.js` (`startMoney`, `startSamples`), `state.js` | P17 (erledigt) |
| Dauerlieger | zahlen pauschal 15 € pro Abend (`fischer.pachtProTag`), Dauerplätze kosten nichts und haben keine Obergrenze | `sim.js` (`startEvening`, `rulesFromEconomy`), `features/dauerlieger.js` | P01 |
| Abweisen von Hand | kostet nichts und bringt keine Bewertung | `sim.js` (`dismiss`) | P10 |
| Note aus Wünschen | keiner erfüllt 2,5 (wie ein Abgewiesener), alle erfüllt 4,5, ohne Wünsche 4,5; die volle Note nur mit gutem Platz (P19 C4) | `economy.js` (`ruf.wunschNote`, `ruf.ohneWunsch`), `sim.js` (`ratingParts`) | P14, P19 |
| Wegfahren ohne Platz | mit 25 % Wahrscheinlichkeit eine Bewertung von 2,5 (`ruf.abgewiesen`); dreht ein Boot ab, weil alle Wartebojen belegt sind, gibt es keine Bewertung | `sim.js` (`turnAway`) | P10 |
| Hafenmeister-Rundgang | startet bei 68 % des Tages (`RUNDGANG_AB`), etwa 8 Sekunden vor dem Abend | `data/people.js` | P12 |
| Mindestruf für Service-Stufen | Segelclub Stufe 3 (Regattaverein) 3,8; Travellift Stufe 3 (Werfthalle) 3,8; Fahrgastanleger Stufe 2 4,0; Museumshafen 4,0 und 4,2; Kreuzfahrtterminal 4,0 und 4,5; Marineanleger 4,0 und 4,6 | `economy.js` (`services[id].stufen[n].ruf`) | P06 (erledigt) |
| Deckel der Services | Sturmschutz höchstens 0,8 (`STURMSCHUTZ_MAX`); der Ruf-Bonus der Services zählt seit P19 nicht mehr für die Note, Gäste wünschen sich Angebote (`angebotWunsch`) | `data/services.js`, `economy.js` | P06, P19 |
| Marineanleger Stufe 2 (Stützpunkt) | Flottenbesuch alle 6 statt alle 10 Tage (je 2 Tage), dazu Tag der offenen Tür | `economy.js` (`services.marineanleger`) | P04 (erledigt) |
| Stufennamen der Services | Travellift heißt in Stufe 1 "Bootsschuppen mit Werkstatt", Stufe 2 "Travellift", Stufe 3 "Werfthalle mit Slipwagen"; die Namen in [services.md](services.md) folgen `data/services.js` | `data/services.js` | P04, P06 (erledigt) |

## Was die Simulation abdeckt

- Ankünfte, Bootsarten mit Maßen und Passregel, Wünsche, Warteschlange, Abweisen, Ruf, Kassieren, Stufenziele und Stegprojekte kommen aus `sim.js`.
- Services bringen Tageseinnahmen, Kunden, Besuche großer Schiffe und Winter-Einnahmen über `services/rules.js`, ihre Wirkung auf Ankünfte und erfüllte Wünsche geht über einen Modifikator in `sim.js` ein (`offers`, P19).
- Ereignisse kommen aus `events/scheduler.js` mit demselben Startwert wie das Spiel. Sturm kostet Ankünfte, Regatta und Hafenfest bringen mehr, das Wetter geht in die Services ein.
- Der Bot kassiert immer alles sofort, auch ohne Hafenbüro.
- Mit Hafenbüro-Automatik weist der Bot nur noch die Sonderfälle selbst zu (`sim.officeSpecialCase`).
- Das Abschlussziel von Stufe 6 prüft im Spiel `sim.regionGoal()` (Meldung `sim:regionDone`), im Werkzeug `tools/balance.mjs` mit denselben Zahlen.

## Was noch auffällt

- **Sparphasen am Ende jeder Stufe:** Die längste Zeit ohne Kauf liegt bei 12 bis 23 Spieltagen, jeweils während man auf das große Bauprojekt spart. Ereignisse füllen diese Zeit, trotzdem empfehle ich für die Oberfläche einen Sparbalken am Bauprojekt, der sich sichtbar füllt. Dann fühlt sich Sparen wie Fortschritt an.
- **Ruf (seit P19):** Ein geschickter Spieler liegt je nach Stufe bei 4,1 bis 4,8 Sternen, ein gemütlicher bei 4,1 bis 4,7 (vorher 4,9 bis 5). Die Ziele 4,2 (Stufe 5) und 4,5 (Abschluss) verlangen jetzt gute Plätze und Angebote. Einzelheiten in [ruf.md](ruf.md).
- **Stufe 6 ist die längste Stufe** (rund 69 Tage), weil man auf die teuren Großschiff-Services spart. Dafür passiert dort am meisten: Kreuzfahrtschiffe und Flottenbesuche laufen ein.
- **Nach dem Abschluss** bleiben einige Services übrig (große Winterhalle, Museumshafen und andere). Sie sind Inhalt für den Endlosmodus.
