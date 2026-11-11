# Schiffe der Größe XL

Stand: 11.11.2026. 3 Arten mit je 5 Modellen, je 3 Farbvarianten, als 3D-Modelle im Flat-Vector-Stil. Ab Stufe 5, Liegeplatz Kai im Außenhafen.

| Datei | Inhalt |
|---|---|
| `web/js/data/boats/xl.js` | Arten, Modelle, Maße, Menschen an Bord (`crew`), Farben, Passregel `fitsBerth` |
| `web/js/render/boats/xl.js` | Bauanleitungen der 15 Modelle, vorbeifahrende Schiffe auf der Ostsee, `init(game)` |
| `web/js/render/boats/xl-kit.js` | Baukasten: Rumpf aus Spanten, Aufbauten, Takelage, Radar, Kran, Schaufelrad, Schnittstelle |
| `tools/vorschau-xl.html` | Vorschau aller Modelle, nicht Teil des Spiels |
| `tests/boote-xl.test.mjs` | Prüft Maße, Bereiche, Kai-Passung und `crew` |

## Was im Spiel zu sehen ist

Draußen auf der Ostsee, nördlich der Nehrung, ziehen ab dem Spielstart XL-Schiffe vorbei: höchstens zwei gleichzeitig, auf zwei Bahnen in beide Richtungen, Segler mit gesetzten Segeln, Motorschiffe mit Rauch, drehendem Radar und Schaufelrädern. Sie sind Kulisse und zeigen, was später in den Außenhafen kommt. Sie sind nicht antippbar, weil sie noch keine Gäste sind. Sobald die Spielregeln XL-Gäste schicken, bauen sie die Schiffe über `game.boatTypes.xl.buildBoat`.

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
