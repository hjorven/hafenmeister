# Balancing

Stand: 11.11.2026. Gilt für die erste Region (deutsche Ostsee, Stufen 1 bis 5, 94 Liegeplätze). Stufe 6, XXL und weitere Regionen sind zurückgestellt.

## Wo die Zahlen liegen

| Datei | Inhalt | Gehört |
|---|---|---|
| `web/js/data/economy.js` | alle Spielzahlen: Grundpreise, Wünsche, Ruf, Stufen und Ziele, Stegprojekte mit Platz-ids, Bauwerke, Hafenbüro, Services, Ereignisse | Balancing |
| `tools/balance.mjs` | spielt die Regeln ohne Grafik viele Male durch und meldet die Spielzeit | Balancing |
| `tests/balance.test.mjs` | prüft, dass die Daten zu `harbor.js` passen und die Spielzeit im Zielkorridor bleibt | Balancing |

`web/js/sim.js` (Spielregeln) und die Services lesen ihre Zahlen nur aus `ECONOMY`. Wer eine Zahl braucht, die noch fehlt, trägt sie in `economy.js` ein, statt sie im Code festzulegen.

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

`--pruefen` meldet jeden Liegeplatz aus `harbor.js`, der keinem Projekt gehört oder doppelt vergeben ist. `--verlauf` zeigt Tag für Tag, was ein Spieler kauft und wie Geld und Ruf laufen.

## Ergebnis (100 Läufe je Spielertyp, mit den echten Spielregeln)

`tools/balance.mjs` spielt mit `web/js/sim.js` (über `sim.rulesFromEconomy(ECONOMY)`), dem Bootskatalog und den Services (`web/js/services/rules.js`). Ein Spieltag dauert bei 1x 2 Minuten. „Mit Vorspulen“ nimmt an, dass die Hälfte der Zeit auf der höchsten Stufe läuft (2x, ab Hafenbüro 3x).

**Geschickter Spieler** (weist alle 5 Sekunden zu, nimmt immer den besten Platz, kauft jeden Tag)

| Stufe | Name | Spieltage | 10 % bis 90 % | davon Sparen auf den Ausbau | Echtzeit 1x | mit Vorspulen |
|---|---|---|---|---|---|---|
| 1 | Bootssteg am See | 14 | 13 bis 14 | 6 | 28 min | 21 min |
| 2 | Dorfhafen am See | 50 | 47 bis 56 | 11 | 1 h 40 min | 1 h 15 min |
| 3 | Durchstich zur Ostsee | 52 | 50 bis 56 | 14 | 1 h 44 min | 1 h 09 min |
| 4 | Marina | 55 | 53 bis 58 | 15 | 1 h 50 min | 1 h 13 min |
| 5 | Küstenmarina bis zum Abschluss | 69 | 58 bis 78 | | 2 h 18 min | 1 h 32 min |
| | **Gesamt** | **242** | 230 bis 251 | | **8 h 04 min** | **5 h 31 min** |

**Gemütlicher Spieler** (schaut nur alle 20 Sekunden auf die Einfahrt, nimmt jedes vierte Mal irgendeinen passenden Platz, kauft jeden zweiten Tag und lässt ein Drittel der Gelegenheiten aus): 231 Tage, 7 h 42 min bei 1x, 5 h 16 min mit Vorspulen. Er ist sogar etwas schneller fertig, weil er weniger Services kauft und sein Geld eher in Stege steckt.

Damit liegt die erste Region im Ziel aus dem Plan (6 bis 8 Stunden). Ungeschicktes Spielen bremst nie stark und blockiert nie. Das passt zu „kein Scheitern“.

**Einnahmen pro Tag** (Median, geschickter Spieler): Stufe 1 rund 50 €, Stufe 2 rund 200 €, Stufe 3 rund 940 €, Stufe 4 rund 2.100 €, Stufe 5 rund 5.300 €.

## Die wichtigsten Zahlen

**Grundpreise pro Nacht:** S 10 €, M 22 €, L 45 €, XL 120 €. Jeder erfüllte Wunsch +25 %. Mehrrumpfboote brauchen einen Stirnplatz, Behördenboote zahlen die Hälfte und geben einen Anker extra.

**Ausbaustufen**

| Stufe | Boote pro Tag bei Ruf 3 | Ziel für die nächste Stufe | Großes Bauprojekt | Kosten |
|---|---|---|---|---|
| 1 Bootssteg am See | 4 (nur S) | 20 Gäste, Ruf 2,5 | Dorfhafen am See | 400 € |
| 2 Dorfhafen am See | 13 | 160 Gäste, Ruf 3,0 | Durchstich zur Ostsee | 5.000 € |
| 3 Durchstich zur Ostsee | 22 | 550 Gäste, Ruf 3,5 | Schwimmsteg D | 20.000 € |
| 4 Marina | 30 | 900 Gäste, Ruf 3,8 | Außenhafen mit Kai | 42.000 € |
| 5 Küstenmarina | 37 | Abschluss: 1.900 Gäste, Ruf 4,3, alle 94 Plätze gebaut | | |

**Gekaufte Plätze bleiben erhalten.** Baut eine spätere Stufe einen Steg um, gehören die Ersatzplätze zum selben Stegprojekt. Beispiel: „Steg B“ bringt in Stufe 2 die Boxen B01 bis B08; in Stufe 3 fallen B01 und B02 weg, dafür gehören B19 und B20 dazu. Jedes Projekt hat in jeder späteren Stufe mindestens so viele Plätze wie beim Kauf, und wer es erst später kauft, bekommt gleich die neue Form. `--pruefen` und `tests/economy-sim.test.mjs` stellen das sicher. Betroffen sind Haken an Steg A, Steg B, Steg B verlängern, T-Kopf an Steg B (Stufe 2, 3 und 5 jeweils neu geformt), Hauptsteg C verlängern, T-Kopf an Steg C und Stirnplatz an D.

**Stegprojekte:** 16 Stück von 180 € (Haken an Steg A) bis 33.000 € (Kai verlängern). Jeder der 109 Plätze aus `harbor.js` gehört genau einem Projekt.

**Versorgung:** Toilette, Dusche, Gastronomie je 4 Stufen, Tankstelle 2 Stufen, Stromsäulen an Steg B. Kapazitäten sind so gewählt, dass die größte Stufe einen vollen Hafen (91 Gastplätze) versorgt.

**Services:** 13 Services mit 1 bis 2 Stufen, Format mit dem Services-Thread abgestimmt (`ECONOMY.services[id].stufen[n].wirkung`). Kein Service hat laufende Kosten.

## Was die Simulation abdeckt

- Ankünfte, Bootsarten mit Maßen und Passregel, Wünsche, Warteschlange, Abweisen, Ruf, Kassieren, Stufenziele und Stegprojekte kommen aus `sim.js`.
- Services bringen Tageseinnahmen, Kunden und Winter-Einnahmen über `services/rules.js` (Wetter immer Sonne), ihre Wirkung auf Ankünfte und Ruf geht über einen Modifikator in `sim.js` ein.
- Ereignisse (Sturm, Regatta, Hafenfest, Nebel) sind nicht eingerechnet. Sie gleichen sich grob aus: Sturm kostet Ankünfte, Regatta und Hafenfest bringen mehr.
- Der Bot kassiert abends immer alles, auch ohne Hafenbüro.

## Was noch auffällt

- **Sparphasen am Ende jeder Stufe:** Die längste Zeit ohne Kauf liegt bei 12 bis 22 Spieltagen, jeweils während man auf das große Bauprojekt spart. Ereignisse füllen diese Zeit, trotzdem empfehle ich für die Oberfläche einen Sparbalken am Bauprojekt, der sich sichtbar füllt (Geld wird automatisch zurückgelegt). Dann fühlt sich Sparen wie Fortschritt an.
- **Ruf ist für gute Spieler leicht:** Wer seine Versorgung ausbaut, liegt fast immer bei 4,9 bis 5 Ankern. Die Ruf-Ziele bremsen vor allem Spieler, die Versorgung vernachlässigen. Das ist gewollt (cozy).
- **Nach dem Abschluss** bleiben einige Services übrig (große Winterhalle, Museumshafen und andere). Sie sind Inhalt für den Endlosmodus.
