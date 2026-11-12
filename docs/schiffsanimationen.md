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

**Ereignisse** (für Ton und Figuren): `boat:line` `{ on }`, `boat:sails` `{ up }`, `boat:moored` `{ berth }`, `boat:cast-off`, `boat:left`, `boat:horn` (XL, XXL), `boat:hold`, `boat:clear` `{ berth }` (Boot ist aus seinem Platz heraus; `boat-view.js` meldet es den Spielregeln als `boot:aus-box` `{ id }`). Alle mit `{ id, size, kind, x, z }`. Vor dem Loswerfen wartet das Boot auf `game.people.anBord(id)`, höchstens 20 s.

## Verkehr und Warteplätze

- **Abstand halten:** Wer hinter einem anderen Boot in dieselbe Richtung fährt, bremst und hält Abstand. Liegt etwas im Weg (entgegenkommend, querend, an der Boje), weicht das Boot seitlich aus, entgegenkommende Boote beide nach Steuerbord. Stehen sich zwei Boote gegenseitig im Weg, fährt das, das näher am Ziel ist. Kurz vor dem Liegeplatz wird nicht mehr ausgewichen, nur gewartet. Nach 12 s Stillstand fährt ein Boot kurz ohne Regeln weiter, damit sich nichts festfährt (`traffic()` in `boat-anim.js`).
- **Start:** Neue Boote beginnen am Revierrand an einer Stelle, an der gerade kein anderes Boot ist (`freierStart`).
- **Eine Boje, ein Boot:** Ist die Boje der Spielregeln noch belegt, nimmt das Boot die nächste freie; sind alle belegt, ankert es luvseitig vor der Bojenreihe (`warteplatz`). Boote liegen quer zur Bojenreihe nebeneinander und schwojen nur so weit, wie Platz zur Nachbarboje ist.
- **Box frei:** Ein zugewiesenes Boot bleibt an der Boje, bis das vorige Boot die Box verlassen hat (`dock(berth, { waitFor })`).
- **Anlegen:** Kleine Boote brauchen von der Boje zur Box etwa 8 s, beschleunigen zügig und bremsen kräftig ab. Beim Ankommen taucht der Bug kurz ein, jede Leine klickt (`sound` `leine-einrasten`), die Box blitzt einmal hell auf.
- **Zuweisen:** Passende Plätze leuchten in der Form der Box selbst (`game.stege.highlight`), der eingerastete Platz sonnengelb. Boote lassen sich erst antippen und ziehen, wenn sie an der Boje fest sind.

## Von See und wieder hinaus

- Neue Boote beginnen außerhalb des Bildes (auch am Handy hochkant und in der Übersicht) und laufen sichtbar zur Boje ein.
- Abfahrende Boote verschwinden erst, wenn sie aus dem Bild sind; wer beim Ablegen gar nicht zu sehen ist, ist sofort fort.
- Zeitraffer: Außerhalb des Bildes fahren Boote auf freier Strecke viermal so schnell (`boat.zeitraffer`), damit An- und Abfahrt nicht Stunden der Spieluhr dauern.

## Nacht und Abreise

- Nachts brennt an Booten an Boje oder Anker ein weißes Ankerlicht oben am Mast (`game.landscape.licht.zustand.nacht` über 0,35).
- Nachts abgerechnete Gäste (`sim:departed`) bleiben sichtbar in der Box, bis am Vormittag `boot-faehrt` kommt. Nach dem Laden eines Spielstands sind sie weg.

## Leistung

Ein einziger `onTick` für alle Boote, keine Speicheranforderungen pro Bild. Leinen liegender Boote werden auf Touch-Geräten nur jedes zweite Bild nachgeführt. Kielwasser und Schaum teilen sich Geometrie und Material.

## Offen

- Ab Stufe 3 fahren Boote von der Reede durch die Einfahrt (ab Stufe 5 um die Ostmole herum in den Außenhafen) und den Durchstich in den See und auf demselben Weg wieder hinaus, im Fahrwasser rechts haltend (`fahrweg` in `boat-view.js`). Bei sehr vielen Booten gleichzeitig (Stufe 5 und 6 mit Vorspulen) kommt es unterwegs noch zu Überlappungen, weil die Wege quer über Stege führen können; feste Fahrgassen folgen.

## Dauerlieger

Bei `dauer:auslaufen` `{ id, platzId, tage }` legt der Dauerlieger ab und fährt (ab Stufe 3 durch den Durchstich) aufs Revier. Bei `tage = 0` dreht er dort unter Segeln oder Motor Runden, bei mehrtägigen Törns fährt er aus dem Bild. Bei `dauer:einlaufen` `{ id, platzId }` kommt er zurück (oder vom Rand herein) und legt wieder an seinem Platz an.

## Bezahlt-Wimpel

Hat ein Gast sein Liegegeld bezahlt (`game.sim.istBezahlt(id)`), weht am Bug ein kleiner Wimpel an einem Stab, wie das Band oder der Aufkleber, den man im echten Hafen nach dem Bezahlen an den Bugkorb hängt. Die Farbe wechselt jeden Spieltag (Gelb, Blau, Rosa, Orange, Lila, Türkis, Zitronengelb), so sieht man auf einen Blick, wer für heute bezahlt hat. Rot und Grün sind ausgespart, die gehören den Platzschildern. Dauerlieger und Boote an der Boje bekommen keinen Wimpel. Der Wimpel springt beim Bezahlen kurz auf und flattert im Wind (`boat-view.js`, Gruppe `bezahlt-band` am Bootsmodell).

## Fremde Schiffe als Hindernis

Schiffe, die ein anderes Modul bewegt (Besuchsschiffe der Services), melden sich mit `game.boatAnim.hindernis(group, { laenge, breite })` an. Der Aufruf gibt eine Funktion zum Abmelden zurück.

- boat-anim liest jedes Bild die Weltlage und `rotation.y` der Gruppe. Der Bug liegt lokal bei +x, Länge und Breite sind in Metern. Fehlen sie, misst boat-anim das Modell selbst.
- Eine Gruppe mit `visible === false` (auch über einen Elternknoten) oder ohne Elternknoten zählt nicht.
- Boote weichen dem Schiff aus, halten Abstand und warten davor. Sie fahren nie hinein, auch nicht im Notfall-Durchlass nach langem Stillstand.
