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

## Ergebnis (100 Läufe je Spielertyp)

Ein Spieltag dauert bei 1x 2 Minuten. „Mit Vorspulen“ nimmt an, dass die Hälfte der Zeit auf der höchsten Stufe läuft (2x, ab Hafenbüro 3x).

**Geschickter Spieler** (kauft sofort das Sinnvollste, weist immer optimal zu)

| Stufe | Name | Spieltage | 10 % bis 90 % | davon Sparen auf den Ausbau | Echtzeit 1x | mit Vorspulen |
|---|---|---|---|---|---|---|
| 1 | Bootssteg am See | 15 | 14 bis 16 | 5 | 30 min | 23 min |
| 2 | Dorfhafen am See | 43 | 41 bis 46 | 10 | 1 h 26 min | 1 h 05 min |
| 3 | Durchstich zur Ostsee | 55 | 52 bis 59 | 19 | 1 h 50 min | 1 h 13 min |
| 4 | Marina | 56 | 51 bis 60 | 17 | 1 h 52 min | 1 h 15 min |
| 5 | Küstenmarina bis zum Abschluss | 60 | 57 bis 63 | | 2 h 00 min | 1 h 20 min |
| | **Gesamt** | **228** | 222 bis 239 | | **7 h 36 min** | **5 h 15 min** |

**Gemütlicher Spieler** (schaut nur jeden zweiten Tag in den Bauplan, lässt ein Drittel der Käufe aus, weist jedes vierte Boot irgendwo hin): 238 Tage, 7 h 56 min bei 1x, 5 h 29 min mit Vorspulen.

Damit liegt die erste Region im Ziel aus dem Plan (6 bis 8 Stunden). Der Unterschied zwischen den Spielertypen ist klein: Ungeschicktes Spielen bremst etwas, blockiert aber nie. Das passt zu „kein Scheitern“.

**Einnahmen pro Tag** (Median): Stufe 1 rund 50 €, Stufe 2 rund 210 €, Stufe 3 rund 760 €, Stufe 4 rund 1.800 €, Stufe 5 rund 3.300 €.

## Die wichtigsten Zahlen

**Grundpreise pro Nacht:** S 10 €, M 22 €, L 45 €, XL 120 €. Jeder erfüllte Wunsch +25 %. Mehrrumpfboote brauchen einen Stirnplatz, Behördenboote zahlen die Hälfte und geben einen Anker extra.

**Ausbaustufen**

| Stufe | Boote pro Tag bei Ruf 3 | Ziel für die nächste Stufe | Großes Bauprojekt | Kosten |
|---|---|---|---|---|
| 1 Bootssteg am See | 4 (nur S) | 20 Gäste, Ruf 2,5 | Dorfhafen am See | 400 € |
| 2 Dorfhafen am See | 13 | 160 Gäste, Ruf 3,0 | Durchstich zur Ostsee | 5.000 € |
| 3 Durchstich zur Ostsee | 22 | 550 Gäste, Ruf 3,5 | Schwimmsteg D | 20.000 € |
| 4 Marina | 30 | 900 Gäste, Ruf 3,8 | Außenhafen mit Kai | 42.000 € |
| 5 Küstenmarina | 37 | Abschluss: 2.300 Gäste, Ruf 4,3, alle 94 Plätze gebaut | | |

Jedes große Bauprojekt enthält die Plätze, die beim Umbau wegfallen (zum Beispiel wird der Haken an Steg A in Stufe 3 durch neue Boxen ersetzt). Ein Ausbau kostet also nie Liegeplätze.

**Stegprojekte:** 17 Stück von 180 € (Haken an Steg A) bis 33.000 € (Kai verlängern). Jeder der 109 Plätze aus `harbor.js` gehört genau einem Projekt.

**Versorgung:** Toilette, Dusche, Gastronomie je 4 Stufen, Tankstelle 2 Stufen, Stromsäulen an Steg B. Kapazitäten sind so gewählt, dass die größte Stufe einen vollen Hafen (91 Gastplätze) versorgt.

**Services:** 13 Services mit 1 bis 2 Stufen, Format mit dem Services-Thread abgestimmt (`ECONOMY.services[id].stufen[n].wirkung`). Kein Service hat laufende Kosten.

## Annahmen im Modell

Solange `web/js/sim.js` fehlt, rechnet `tools/balance.mjs` mit einem eigenen, schlanken Modell der Regeln aus `docs/plan.md`:

- Boote kommen zufällig (Poisson) nach Stufe, Ruf und Services. Wünsche nach Klasse und Stufe.
- Passregel vereinfacht nach Klasse: ein Boot passt an jeden Platz seiner Klasse oder größer, XL nur an den Kai, Mehrrumpfboote nur an Stirnplätze. Länge, Breite und Tiefgang sind über die Klassen abgedeckt.
- Saison 30 Tage, Winter 3 Tage ohne Gäste.
- Sturm (ab Stufe 3) und Regatta (mit Segelclub) und Hafenfest (ab Stufe 4) sind eingerechnet.
- Abends wird alles kassiert, auch ohne Hafenbüro.

Sobald `sim.js` ohne Grafik läuft, ersetzt es dieses Modell; die Zahlen werden dann noch einmal nachgerechnet.

## Was noch auffällt

- **Sparphasen am Ende jeder Stufe:** Die längste Zeit ohne Kauf liegt bei 15 bis 25 Spieltagen, jeweils während man auf das große Bauprojekt spart. Ereignisse füllen diese Zeit, trotzdem empfehle ich für die Oberfläche einen Sparbalken am Bauprojekt, der sich sichtbar füllt (Geld wird automatisch zurückgelegt). Dann fühlt sich Sparen wie Fortschritt an.
- **Ruf ist für gute Spieler leicht:** Wer seine Versorgung ausbaut, liegt fast immer über 4,5 Anker. Die Ruf-Ziele bremsen vor allem Spieler, die Versorgung vernachlässigen. Das ist gewollt (cozy).
- **Nach dem Abschluss** bleiben einige Services übrig (große Winterhalle, Museumshafen und andere). Sie sind Inhalt für den Endlosmodus.
