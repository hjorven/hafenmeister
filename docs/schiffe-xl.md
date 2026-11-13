# Schiffe der Größe XL

Stand: 11.11.2026. 3 Arten mit je 5 Modellen, je 3 Farbvarianten, als 3D-Modelle im Flat-Vector-Stil. Status: gebaut, dazu XXL und Vorbeifahrer (PR 81). Ab Stufe 5, Liegeplatz Kai im Außenhafen.

| Datei | Inhalt |
|---|---|
| `web/js/data/boats/xl.js` | Arten, Modelle, Maße, Menschen an Bord (`crew`), Farben, Passregel `fitsBerth` |
| `web/js/render/boats/xl.js` | Bauanleitungen der 15 Modelle, `init(game)` |
| `web/js/render/boats/xl-kit.js` | Baukasten: Rumpf aus Spanten, Aufbauten, Takelage, Radar, Kran, Schaufelrad, Schnittstelle |
| `tools/vorschau-xl.html` | Vorschau aller Modelle, nicht Teil des Spiels |
| `tests/boote-xl.test.mjs` | Prüft Maße, Bereiche, Kai-Passung und `crew` |

## Was im Spiel zu sehen ist

XL-Gäste legen in Stufe 5 an den langen Kajen K01 bis K03 an (Spielregeln über `game.boatTypes.xl.buildBoat`). Vorher ziehen XL-Schiffe ab Stufe 4 draußen auf der Ostsee vorbei, siehe "Vorbeifahrende Boote" unten.

## Modelle

| Nr | Modell | Länge | Breite | Tiefgang | Menschen |
|---|---|---|---|---|---|
| XL1-1 | Gaffelschoner | 36 m | 6,8 m | 2,8 m | 10 bis 30 |
| XL1-2 | Brigg | 38 m | 7,6 m | 3,3 m | 16 bis 40 |
| XL1-3 | Haikutter | 25 m | 6,2 m | 2,5 m | 8 bis 20 |
| XL1-4 | Kogge | 26 m | 7,6 m | 2,3 m | 10 bis 30 |
| XL1-5 | Plattbodenschiff | 23 m | 7,4 m | 1,2 m | 8 bis 24 |
| XL2-1 | Moderne Motoryacht | 32 m | 7,2 m | 2,1 m | 8 bis 16 |
| XL2-2 | Große Segelyacht | 34 m | 7,4 m | 3,5 m | 6 bis 12 |
| XL2-3 | Explorer-Yacht | 30 m | 7,4 m | 2,4 m | 8 bis 14 |
| XL2-4 | Klassische Motoryacht | 28 m | 5,6 m | 2,2 m | 6 bis 10 |
| XL2-5 | Maxi-Racer | 30 m | 6,2 m | 3,5 m | 10 bis 16 |
| XL3-1 | Ausflugsschiff | 32 m | 7,2 m | 1,6 m | 20 bis 40 |
| XL3-2 | Seitenraddampfer | 33 m | 8,0 m | 1,3 m | 20 bis 40 |
| XL3-3 | Personenfähre | 28 m | 7,8 m | 1,8 m | 10 bis 40 |
| XL3-4 | Tonnenleger | 33 m | 7,8 m | 2,5 m | 6 bis 10 |
| XL3-5 | Hafenschlepper | 26 m | 7,6 m | 2,5 m | 6 bis 8 |

**Abweichungen vom Katalog** (`docs/hafen-und-schiffe.md`)

- XL3-5 ist ein Hafenschlepper statt des Seenotrettungskreuzers. Die Seenotrettungskreuzer gehören laut Plan zur Größe XXL. Der Schlepper kann später den Großschiffen beim Anlegen helfen.
- Das Plattbodenschiff hat 1,2 m Tiefgang wie echte Plattbodenschiffe, der Bereich von XL1 beginnt deshalb bei 1,2 m.
- Die Rahen von Brigg und Kogge ragen wie bei echten Rahseglern seitlich über den Rumpf hinaus. `beam` ist die Rumpfbreite.

## Schnittstelle

Abgestimmt mit den Threads für S, M, L und den Schiffsanimationen. 1 Einheit = 1 m, Bug nach lokal +X, Steuerbord +Z, Ursprung Wasserlinie mittschiffs.

```js
const { MODELS, buildBoat, setSails, animateBoat } = game.boatTypes.xl;
const ship = buildBoat(MODELS[0], { palette: 1, sails: false, id: 'b17' });
ship.position.set(x, 0, z);
ship.rotation.y = winkel;          // aus platzInWelt(platz, 5) in web/js/data/harbor.js
game.scene.add(ship);
game.onTick(() => animateBoat(ship, game.time, { speed: 0 }));
setSails(ship, true);              // Segel setzen
```

`ship.userData`: `id`, `modelId`, `length`, `beam`, `draft`, `airDraft`, `iconHeight` (Höhe für Wunsch-Symbole), `boat` (`{ size, length, beam, draft, kind }`), `pick` (wenn `id` übergeben).

Benannte Teile für `web/js/render/boat-anim.js`: `sail-1` ... (Ursprung am Fuß, Rahsegel an der Rah mit `userData.furl = 'up'`), `sailsSet`, `sailsFurled`, `radar`, `crane`, `paddlewheel`, `flag-stern`, `fender` (unsichtbar bis zum Anlegen), `smoke`, `cleat-bow`, `cleat-stern`. Das Modell schaukelt nicht selbst.

## Vorschau

```bash
python3 -m http.server 8000
```

Im Repo-Ordner starten, dann `http://localhost:8000/tools/vorschau-xl.html` öffnen. Einzelnes Modell: `http://localhost:8000/tools/vorschau-xl.html?model=XL1-2&sails=1&palette=2`.

XXL-Schiffe: `http://localhost:8000/tools/vorschau-xl.html?size=xxl`, einzeln mit `&model=XXL1-3`.

# Schiffe der Größe XXL (Stufe 6)

| Datei | Inhalt |
|---|---|
| `web/js/data/boats/xxl.js` | Arten, Modelle, Liegeplatzarten `pier`, `marine`, `station` |
| `web/js/render/boats/xxl.js` | 3D-Modelle (nutzt `xl-kit.js`) |
| `tests/boote-xxl.test.mjs` | Maße, Menschen an Bord, Liegeplatz, Spielregeln lesen die Arten |

## Was im Spiel zu sehen ist

- Ab Stufe 5 fahren Kreuzfahrt- und Marineschiffe auf der äußersten Seebahn vorbei (siehe unten). Nicht anklickbar, nur Vorgeschmack.
- `game.boatTypes.xxl` ist registriert, die Spielregeln lesen die drei Arten über `web/js/bridge.js` mit `minStage` 6.
- Anlegen in Stufe 6 an P01 (`pier`), MA01/MA02 (`marine`) und SK01 (`seenotretter`): Diese Plätze sind reserviert, die Schiffe kommen über die Services-Besuche (`render/services.js`), nicht als normale Ankünfte der Simulation. Deshalb ist XXL3 nicht `stationed`.

## Arten

| Art | Name | Freischaltung | Menschen an Bord | Liegeplatz |
|---|---|---|---|---|
| XXL1 | Kreuzfahrtschiff | `kreuzfahrt` | 80 bis 200 | Pier 200 x 30 m, 8,5 m tief |
| XXL2 | Marineschiff | `marine` | 20 bis 60 | Marineanleger 100 x 16 m, 6,0 m tief |
| XXL3 | Seenotrettungskreuzer | `seenotkreuzer`, stationiert | 4 bis 10 | Station 50 x 12 m, 4,0 m tief |

## Modelle

| Id | Name | L x B x T (m) |
|---|---|---|
| XXL1-1 | Expeditionsschiff | 110 x 18 x 5,2 |
| XXL1-2 | Flusskreuzer-Format | 110 x 11,4 x 1,6 |
| XXL1-3 | Mittleres Kreuzfahrtschiff | 180 x 29 x 7,2 |
| XXL2-1 | Minenjagdboot | 55 x 9,2 x 2,8 |
| XXL2-2 | Korvette | 90 x 13 x 4,0 |
| XXL2-3 | Segelschulschiff | 90 x 12 x 5,0 |
| XXL3-1 | 20-m-Klasse | 20 x 5,2 x 1,5 |
| XXL3-2 | 28-m-Klasse | 28 x 6,6 x 1,9 |
| XXL3-3 | 46-m-Klasse | 46 x 10,8 x 2,8 |

Abweichung vom Plan: Die Seenotrettungskreuzer sind kleiner als 50 m und stehen trotzdem bei XXL, weil sie erst in Stufe 6 mit eigener Station kommen und fest stationiert sind.

# Vorbeifahrende Boote

`web/js/render/boats/verkehr.js` (Bahnen und Flotte in `web/js/data/verkehr.js`) lässt Boote aller Größen als Kulisse fahren, damit der Hafen von Anfang an belebt ist. Nicht antippbar, nicht in den Spielregeln. Bewegung, Kielwasser und Segel kommen aus `render/boat-anim.js`.

| Wo | Stufe | Boote |
|---|---|---|
| Am Ufer östlich der Stege, hin und her | 1, 2 | ein Kanu, Kajak oder Ruderboot (in der Startansicht zu sehen) |
| Runden auf dem Binnensee | 1, 2 | drei Jollen, Kanus, Tuckerboot, Jollenkreuzer |
| Ostsee, Bahnen "klein" | alle | Motorboote, Folkeboot, Kutter; ab Stufe 2 Kajütkreuzer; ab 3 Yachten |
| Ostsee, Bahnen "gross" | alle | Kutter und Yachten; ab Stufe 2 und 3 mehr L; ab 4 XL; ab 5 XXL auf der äußersten Bahn |

Regeln:

- Die Bahnen liegen im Wasser und halten Abstand zu Wartebojen, Ankerflächen, Molen, Buhnen und Liegeplätzen. `tests/verkehr.test.mjs` prüft das für Stufe 1 bis 6 und alle Stegbilder (0 bis 12). Die Strecke des Paddlers rechnet `uferStrecke()` aus den Stegen des aktuellen Stegbilds.
- Ab Stufe 3 biegen die kleinen Bahnen vor der Einfahrt nach Norden ab, damit Reede und Fahrrinne frei bleiben und die Boote trotzdem in der Startansicht zu sehen sind.
- Liegt ein anderes Boot vor dem Bug (zum Beispiel ein Gast auf dem Weg zur Boje), hält das vorbeifahrende Boot an, höchstens 45 Sekunden.
- Große Gäste der Services (Kreuzfahrtschiff an P01, Traditionssegler vor Anker beim Windjammertreffen) melden sich bei `game.boatAnim.hindernis` an. Sie stehen damit in `game.boatAnim.boats`, und die Vorbeifahrer halten auch vor ihnen an. In Stufe 5 und 6 kommen die kleinen Bahnen im Westen außerdem erst nördlich von Plan-y 410 herein, der Test prüft mindestens 10 m Abstand zu den Flächen in `GROSSE_GAESTE` (`data/verkehr.js`).
- Die Seebahnen beginnen und enden bei y 760 auf freiem Wasser, weit außerhalb jeder Ansicht: Die Boote kommen längs der West- und Ostküste von Norden. Der Test prüft das.
- Abwechslung: Jedes Boot fährt mit eigenem Tempo (plus/minus 18 Prozent) und eigenem seitlichem Versatz zur Bahn, Bootstyp, Bahn und Zeitpunkt werden ausgewürfelt. Auf dem See wechselt jede Runde Abstand und Tempo, der Drehsinn ist je Spiel zufällig, ab und zu treibt ein Boot eine Weile.
- Mit `?stufe=3` in der Adresse zeigt der Verkehr dieselbe Stufe wie die Landschaft.
- In der Konsole: `hafenmeister.verkehr.boote` listet die Boote mit Lage und Tempo.
