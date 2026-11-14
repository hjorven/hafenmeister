# Schiffsanimationen und Boote im Spiel

Stand: 12.11.2026. Status: gebaut; offen sind C4 bis C6 aus [echter-hafen.md](echter-hafen.md) und P54. Zwei Dateien:

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

Dann `http://localhost:8000` öffnen. Nach einigen Sekunden kommt das erste Boot an die Boje. Boot antippen oder mit dem Finger zu Steg A ziehen, es legt an. Mit den Tempo-Knöpfen unten links (3x, 8x) vorspulen bis zum Abend, Münzen einstreichen. Die Vorführung aller Größen: `http://localhost:8000/?demo=boote`.

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

- **Abstand halten:** Wer hinter einem anderen Boot in dieselbe Richtung fährt, bremst und hält Abstand. Liegt etwas im Weg (entgegenkommend, querend, an der Boje), weicht das Boot seitlich aus, entgegenkommende Boote beide nach Steuerbord. Stehen sich zwei Boote gegenseitig im Weg, fährt das, das näher am Ziel ist. Kurz vor dem Liegeplatz wird nicht mehr ausgewichen, nur gewartet. Nur bei echter gegenseitiger Blockade (A wartet auf B wartet auf A) fährt ein Boot nach 12 s Stillstand kurz ohne Regeln weiter; wer nur in einer Schlange steht, wartet (`traffic()` und `festgefahren()` in `boat-anim.js`).
- **Start:** Neue Boote beginnen außerhalb des Bildes am Rand des befahrbaren Wassers, verteilt auf mehrere Richtungen (siehe Fahrwasser), an einer Stelle, an der gerade kein anderes Boot ist (`freierStart`). Danach rückt der Start auf dem Weg vor bis kurz vor den Bildrand (`naeherStart`, höchstens bis 40 m vor die Boje): Was niemand sieht, fährt das Boot nicht, die Anfahrt dauert bei jeder Kamera etwa gleich lang. Kommen mehrere zugleich, laufen sie im Abstand von 3 bis 9 s los; bis dahin ist das Boot unsichtbar und taucht erst auf, wenn am Startpunkt kein anderes Boot ist (`dock` mit `einfahrt`, `EinfahrtWarten`). Gäste abends und Dauerlieger morgens legen gestaffelt ab, 6 bis 12 s Spielzeit Abstand; wird die Schlange länger als 90 s, rückt der Takt auf ein Viertel zusammen, nie fahren zwei zugleich (`undock` mit `verzoegerung`, `abfahrtVerzoegerung`). An Boje und Ankerplatz kommt das Boot gegen den Wind, liegt der Anlauf dann über Land, aus der nächsten freien Richtung (`bojenKurs`).
- **Eine Boje, ein Boot:** Ist die Boje der Spielregeln noch belegt, nimmt das Boot die nächste freie; sind alle belegt, ankert es luvseitig vor der Bojenreihe (`warteplatz`). Boote liegen quer zur Bojenreihe nebeneinander und schwojen nur so weit, wie Platz zur Nachbarboje ist.
- **Box frei:** Ein zugewiesenes Boot bleibt an der Boje, bis das vorige Boot die Box verlassen hat (`dock(berth, { waitFor })`).
- **Anlegen:** Kleine Boote brauchen von der Boje zur Box etwa 8 s, beschleunigen zügig und bremsen kräftig ab. Beim Ankommen taucht der Bug kurz ein, jede Leine klickt (`sound` `leine-einrasten`), die Box blitzt einmal hell auf (0,9 s in echter Zeit, damit man ihn auch bei 3x und 8x sieht).
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

## Fahrwasser: Wege aus der Karte des Geländes

Seit dem Gelände-Umbau (Thread "Boote ums Gelände herum führen") gibt es keine festen Wegpunkte mehr. Jede Fahrt wird beim Losfahren aus einer Karte berechnet (`web/js/world/fahrwasser.js`, reine Rechnung ohne Three.js):

- **Karte:** Raster mit 1,5 m Zellen über x -430,5..320, z -361..140 (Weltmeter, damit jede Seebrücke drinliegt). Je Zelle Wassertiefe aus `game.landscape.tiefeBei` und Abstand zum nächsten Hindernis. Hindernisse sind Land, Strand, Molen, Inseln und Felsen der Geländeform (aus der Tiefe), alle Steglinien der Stufe mit Breite und Pfählen, alle Liegeplätze als Rechtecke (aus `HAFEN`, also mit Stegbild), die Seebrücke dort, wo das Gelände sie hinlegt (`seebrueckeStrecke` aus `landschaft/strand.js`, gedreht oder gar nicht), und ab Stufe 6 die Liegewannen der Großschiffe (`GROSSE_GAESTE` in `data/verkehr.js`). Wartebojen und Ankerplätze sind weiche Zonen, die Wege nach Möglichkeit meiden. Außerhalb des Rasters gilt offenes Wasser.
- **Neu bauen:** bei `stufe`, `stege` (Steg gekauft), `stegbild`, `landschaft:geaendert` und anderer Geländeform, sofort. Laufende Fahrten planen dann ab ihrer Position neu.
- **Weg:** A* für das jeweilige Boot. Abstand `r` = halbe Breite + Rand + 15 % der Länge (Bug und Heck schwenken in Kurven aus), Tiefe = Tiefgang + 0,3 m. Nur am Anfang und Ende (Gasse vor der Box, beim Ablegen) darf es bis auf Rumpf + 0,35 m eng werden, das kostet viel. Danach geglättet (jede Gerade prüft jede Zelle, die sie berührt) und, wo Platz ist, bis 3 m nach Steuerbord versetzt. Gibt es keinen Weg mit vollem Tiefgang, fährt das Boot lieber flach als über Land (`flach: true`).
- **Anlegen:** Der Drehpunkt vor der Box (`approachPoints`) wird nur auf freiem, tiefem Wasser gewählt (`game.boatAnim.setFrei`), von dem die Gerade bis vor die Box frei ist (`setSicht`), weit draußen und seitlich, sonst näher an der Box.
- **Bojenwechsel:** `boot:boje` { id, boje } (Stufenausbau mit weniger Bojen) lässt das Boot per Wegsuche an die neue Boje verholen.
- **Engstellen:** Wo zwei Boote nicht aneinander vorbeipassen, erkennt die Karte eine Engstelle mit Achse. Davor fragt das Boot eine Einbahn-Freigabe an (`boat-channel.js`, aus Jorvens Engpass-Patch): bis drei Boote gleicher Richtung als Konvoi, Gegenverkehr wartet in Reihenfolge davor. Die Freigabe gilt nur in der Engstelle; gewartet wird eine Bootslänge plus 6 m davor, damit der Gegenverkehr herauskommt. Wer nicht mehr fragt, fällt nach 20 Bildern aus der Schlange; nach 120 s Warten fährt das Boot trotzdem. Hält ein Boot die Engstelle und wartet sein Hindernis genau davor, gilt das als Blockade (`festgefahren`). Ein Boot gibt seine Engstellen frei, sobald es festgemacht hat.
- **Still liegende Boote:** Boote an Boje und Anker und wartende Boote gehen beim Planen als Zusatzkosten in den Weg ein (`route` mit `boote`): Wege führen um sie herum, nicht durch das Ankerfeld hindurch.
- **Richtungen:** Ankünfte und Abfahrten verteilen sich auf die Abschnitte des Kartenrands, die das Boot erreichen kann (Westen, Nordwesten, Norden, Nordosten, Osten), ohne zweimal hintereinander denselben. Trägt `boot-kommt` ein Feld `herkunft` (0 = Westen bis 1 = Osten, aus den Spielregeln), gilt das. Ist der See für die Größe nicht mit dem Meer verbunden, kommen die Boote von den entfernten Enden des Sees.
- **Tagestörn:** Die Runde liegt auf dem freiesten Wasser in der Nähe des alten Punkts, der Kreis nur so groß, wie dort Platz ist.
- **Für andere Module:** `game.fahrwasser.weg(von, nach, { breiteM, tiefgangM })` → `{ ok, punkte }`, `game.fahrwasser.befahrbar(x, z, radiusM, tiefgangM)`, `game.fahrwasser.karte`.

### Prüfen

- `node --test tests/fahrwasser.test.mjs`: jeder Liegeplatz in Stufe 1 bis 6, allen 13 Stegbildern und allen 10 Geländeformen ist von der Warteboje erreichbar, der Kartenrand ist von der Boje erreichbar, Bahnen und Binnensee-Runde der Vorbeifahrer liegen in jeder Form auf Wasser, kein Weg kommt Land, Steg oder Liegeplatz näher als Rumpf + 0,35 m, Bojen und Ankerplätze liegen frei, Engstellen und Freigabe. Plätze, die nur über zu flaches Wasser erreichbar sind, stehen als Hinweis in der Ausgabe.
- `node tools/fahrwasser-pruefen.cjs --stufen 1-6 --stegbilder 0-12 (oder 0,7,12) --sekunden 40 [--geraet handy] [--bilder ordner]`: spielt jede Kombination mit Tempo 8x und vollem Hafen und zählt in jedem Bild Rümpfe auf Land, auf Stegplanken, Rumpf in Rumpf und Notfall-Durchlässe (Vorbeifahrer getrennt). Braucht `cd tests && npm ci`.

## Offen

- Vorbeifahrer auf See (`render/boats/verkehr.js`) fahren auf `game.fahrwasser.vorbeiWeg(info)`: von einem Randabschnitt der Karte zu einem anderen, mindestens 25 m + 0,3 Länge von jedem Liegeplatz, große Schiffe mit höchstens 4,5 m Tiefgang (die See ist am Rand 5 bis 7 m tief). Die festen Bahnen in `data/verkehr.js` gelten nur noch ohne Karte (Testseiten). Die Binnensee-Runde weicht Inseln aus (`rundeImWasser`).
- Besuchsschiffe (`render/services-besuch.js`): Der Teil im Hafen kommt aus `data/besuchswege.js`, der Teil draußen aus `game.fahrwasser.seeWeg(von, { breiteM, laengeM, tiefgangM, groesse, nahBei })` bis hinter den Kartenrand, Ausgang nahe dem alten Seepunkt. Achteraus (`raus: 'rueckwaerts'`) nur im Hafenteil, draußen Bug voraus. Neue Karte: Wege neu, sobald das Schiff am Platz oder draußen ist. Zum Prüfen: `game.besuchsWege()`.
- Die Kartensignatur enthält Geländeform und Seed (`game.gelaende.aktuell()`), keine festen Punkte auf See.
- Restliche Berührungen beim Anlegen in Stufe 4 (Stege C und B, Handy) und vereinzelt Rumpf an Rumpf in vollen Gassen.

## Dauerlieger

Bei `dauer:auslaufen` `{ id, platzId, tage }` legt der Dauerlieger ab und fährt (ab Stufe 3 durch den Durchstich) aufs Revier. Bei `tage = 0` dreht er dort unter Segeln oder Motor Runden, bei mehrtägigen Törns fährt er aus dem Bild. Bei `dauer:einlaufen` `{ id, platzId }` kommt er zurück (oder vom Rand herein) und legt wieder an seinem Platz an.

## Bezahlt-Wimpel

Hat ein Gast sein Liegegeld bezahlt (`game.sim.istBezahlt(id)`), weht am Bug ein Wimpel (gut ein Viertel der Bootslänge, weiß umrandet, über Persenning und Kajüte) an einem Stab, wie das Band oder der Aufkleber, den man im echten Hafen nach dem Bezahlen an den Bugkorb hängt. Die Farbe wechselt jeden Spieltag (Gelb, Blau, Rosa, Orange, Lila, Türkis, Zitronengelb), so sieht man auf einen Blick, wer für heute bezahlt hat. Rot und Grün sind ausgespart, die gehören den Platzschildern. Dauerlieger und Boote an der Boje bekommen keinen Wimpel. Der Wimpel springt beim Bezahlen kurz auf und flattert im Wind (`boat-view.js`, Gruppe `bezahlt-band` am Bootsmodell). Er erscheint im selben Bild wie das Kassieren. Gäste, die nachts abgerechnet wurden, liegen bis zum Ablegen am Vormittag noch in der Box und tragen den Wimpel bis dahin: Abgerechnet heißt bezahlt, was offen war, holt nachts der Hafenmeister. Die Regel steht in `render/wimpel-regel.js` (Test `tests/wimpel.test.mjs`).

## Fremde Schiffe als Hindernis

Schiffe, die ein anderes Modul bewegt (Besuchsschiffe der Services), melden sich mit `game.boatAnim.hindernis(group, { laenge, breite })` an. Der Aufruf gibt eine Funktion zum Abmelden zurück.

- boat-anim liest jedes Bild die Weltlage und `rotation.y` der Gruppe. Der Bug liegt lokal bei +x, Länge und Breite sind in Metern. Fehlen sie, misst boat-anim das Modell selbst.
- Eine Gruppe mit `visible === false` (auch über einen Elternknoten) oder ohne Elternknoten zählt nicht.
- Boote weichen dem Schiff aus, halten Abstand und warten davor. Sie fahren nie hinein, auch nicht im Notfall-Durchlass nach langem Stillstand.
