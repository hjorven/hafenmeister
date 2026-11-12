# Schiffsanimationen und Boote im Spiel

Stand: 12.11.2026. Zwei Dateien:

| Datei | Aufgabe |
|---|---|
| `web/js/render/boat-anim.js` | gemeinsame Bewegung für alle Größen: Schaukeln, Kurs fahren, Segel bergen und setzen, Fender, Leinen werfen, Ablegen, Kielwasser, Warten an der Boje |
| `web/js/render/boat-view.js` | Brücke zu den Spielregeln: baut die Boote aus `game.boatTypes`, zeigt die Wartebojen, lässt die Boote einlaufen, anlegen und abfahren, zeigt abends die Münzen |
| `web/js/render/boat-anim-demo.js` | Vorführung mit `index.html?demo=boote`, wird nur dann geladen |

## Was man im Spiel sieht

1. Ein Boot kommt über den See und macht an einer gelben **Warteboje** fest (Bug zur Boje, liegt im Wind und schwojt langsam). Segelboote bergen die Segel vor der Boje.
2. Wird es zugewiesen (Schleppleine, Antippen oder „Automatisch einfahren“), wirft es die Leine los, fährt in die Gasse, dreht in die Box, Fender gehen raus, vier Leinen fliegen nacheinander an Steg und Heckpfähle.
3. Abends schwebt über jedem Boot mit offenem Hafengeld eine Münze (`userData.pick = { type: 'coin', id: bootId }`), die sich mit dem Kassierstrich einstreichen lässt.
4. Bei der Abreise holt das Boot die Leinen ein, setzt rückwärts aus der Box, dreht, setzt (Segelboot) die Segel und fährt aus dem Bild.

Sobald ein Boot an der Boje fest ist, sendet `boat-view.js` `boot:an-boje` `{ id, boje }`; ab dann zählen die Spielregeln seine Geduld.

Jedes Boot trägt `userData.pick = { type: 'boat', id }` mit der Boot-id aus `game.sim.boote`. `game.boatsVisible = true` blendet die Leiste der Wartenden im HUD aus.

## Ausprobieren

```bash
python3 -m http.server 8000 --directory web
```

Dann `http://localhost:8000` öffnen. Nach einigen Sekunden kommt das erste Boot an die Boje. Boot antippen oder mit dem Finger zu Steg A ziehen, es legt an. Mit der Sonne vorspulen bis zum Abend, Münzen einstreichen. Die Vorführung aller Größen: `http://localhost:8000/?demo=boote`.

## Schnittstelle für Bootsmodelle

- Modell = `THREE.Group`, Ursprung Mitte Boot auf der Wasserlinie, Bug nach lokal +x, Steuerbord = +z. `rotation.y` = `richtung` aus `harbor.js` in Bogenmaß.
- `group.userData.boat = { size, length, beam, draft, kind }` mit `kind` = `motor`, `sail`, `row`, `pedal` oder `ship`. Fehlt es, misst das Modul die Bounding Box.
- Benannte Teile (Präfix reicht, alle freiwillig):

| Name | Bewegung |
|---|---|
| `sail...` | beim Bergen auf lokal y gestaucht (Ursprung am Fuß), `userData.furl = 'x'` für Rollfock |
| `boom...` | Gruppe mit Drehpunkt am Mast, schwenkt nach Lee |
| `cover...` | Persenning, sichtbar am Liegeplatz mit geborgenen Segeln; `cover-jib` immer, wenn die Segel unten sind |
| `fender...` | nur beim Anlegen und Liegen sichtbar, bei Längsseitsplätzen nur auf der Stegseite |
| `flag...`, `radar...`, `smoke...` | flattert, dreht sich, nur bei Fahrt sichtbar |
| `prop...`, `paddle...`, `oar-port`, `oar-stbd` | drehen sich oder rudern, falls das Modell kein eigenes `animateBoat` hat |
| `cleat-bow`, `cleat-stern` (`-port`, `-stbd`, `cleat-mid`) | leere Punkte, an denen die Festmacher beginnen |
| `wake` | das Modell hat eigenes Kielwasser, dann zeichnet das Modul keins |

Liefert ein Schiffs-Modul `animateBoat(group, time, { speed, moored, sway })` und `setSails(group, on)`, ruft `boat-view.js` beide auf.

## `boat-anim.js` direkt benutzen

```js
import { addBoat, berthFromPlatz } from './render/boat-anim.js';
import { HAFEN } from './data/harbor.js';

const a = addBoat(game, gruppe, { id: 17 });
a.place(x, z, heading);                                    // sofort setzen
await a.sailTo([{ x: 10, z: -40 }, { x: -20, z: -30 }]);   // Kurs abfahren
await a.dock({ x, z, heading, kind: 'buoy' });              // an eine Boje
await a.dock(berthFromPlatz(platz, stufe, HAFEN));          // in eine Box oder längsseits
await a.undock([{ x: 0, z: -60 }], { sails: true, remove: true });
a.moorAt(berth);                                            // beim Laden sofort fest
```

Platzarten: `box`, `finger` (Bug zum Steg, rückwärts raus), `stirn`, `kai`, `fischer` (längsseits, `side` = +1 Steg an Steuerbord, -1 an Backbord, `berthFromPlatz` ermittelt das aus den Steglinien), `buoy`.

Seegang und Wind für Ereignisse: `game.boatAnim.setSea(0 bis 1)`, `game.boatAnim.setWind(ausGrad, stärke)`, geschützte Bereiche über `game.boatAnim.setShelter((x, z) => 0 bis 1)`. Hat die Landschaft `game.water.heightAt(x, z, t)`, schaukeln die Boote mit diesen Wellen.

**Ereignisse** (für Ton und Figuren): `boat:line` `{ on }`, `boat:sails` `{ up }`, `boat:moored` `{ berth }`, `boat:cast-off`, `boat:left`, `boat:horn` (XL, XXL), `boat:hold`. Alle mit `{ id, size, kind, x, z }`. Vor dem Loswerfen wartet das Boot auf `game.people.anBord(id)`, höchstens 20 s.

## Leistung

Ein einziger `onTick` für alle Boote, keine Speicheranforderungen pro Bild. Leinen liegender Boote werden auf Touch-Geräten nur jedes zweite Bild nachgeführt. Kielwasser und Schaum teilen sich Geometrie und Material.

## Offen

- Ab Stufe 3 fahren Boote von der Reede durch die Einfahrt (ab Stufe 5 um die Ostmole herum in den Außenhafen) und den Durchstich in den See und auf demselben Weg wieder hinaus (`fahrweg` in `boat-view.js`). Boote weichen einander noch nicht aus.
- Bootsnamen am Heck folgen im nächsten Schritt.

## Dauerlieger

Bei `dauer:auslaufen` `{ id, platzId, tage }` legt der Dauerlieger ab und fährt (ab Stufe 3 durch den Durchstich) aufs Revier. Bei `tage = 0` dreht er dort unter Segeln oder Motor Runden, bei mehrtägigen Törns fährt er aus dem Bild. Bei `dauer:einlaufen` `{ id, platzId }` kommt er zurück (oder vom Rand herein) und legt wieder an seinem Platz an.
