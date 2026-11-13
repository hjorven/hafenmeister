# Grundgerüst: Schnittstellen für alle Module

Stand: 12.11.2026, abgeglichen mit `main` nach PR 144. Status: gebaut. Das Spiel liegt in `web/` und wird ohne Build-Schritt auf GitHub Pages veröffentlicht.

## Wem gehört welche Datei

| Datei | Gehört |
|---|---|
| `web/index.html`, `web/js/main.js`, `web/js/core/*`, `web/css/base.css` | Grundgerüst |
| `web/css/oberflaeche.css`, `web/css/ui-*.css`, `web/js/ui/oberflaeche.js`, `input-pc.js`, `input-touch.js` | Oberfläche ([ui/oberflaeche.md](ui/oberflaeche.md)) |
| `web/js/ui/hud.js`, `web/js/sim.js`, `web/js/state.js`, `web/js/bridge.js` | Spielregeln ([spielregeln.md](spielregeln.md)) |
| `web/js/ui/bauen.js`, `bauen-rat.js` | Bauen ([bauen.md](bauen.md)) |
| `web/js/ui/gesten.js` | Gesten |
| `web/js/core/camera.js` (Drehen, Neigen) | gemeinsam mit dem Kamera-Thread |
| `web/js/data/harbor.js`, `stegbild.js`, `stegbilder.js` | Liegeplätze und Stegbilder ([stegbilder.md](stegbilder.md)) |
| `web/js/data/economy.js` | Balancing ([balancing.md](balancing.md)), einzige Quelle für Zahlen |
| `web/js/data/boats/<größe>.js`, `web/js/render/boats/<größe>.js` | je Schiffsgröße ein Thread |
| `web/js/render/boat-anim.js`, `boat-view.js` | Schiffsanimationen ([schiffsanimationen.md](schiffsanimationen.md)) |
| `web/js/render/landscape.js`, `render/landschaft/*` | Landschaft ([landschaft.md](landschaft.md)) |
| `web/js/render/services.js`, `data/services.js`, `services/rules.js` | Services ([services.md](services.md)) |
| `web/js/render/buildings.js` | Gebäude nach echten Vorbildern ([vorbilder.md](vorbilder.md)) |
| `web/js/render/people.js`, `data/people.js`, `people/*` | Menschen |
| `web/js/events/*`, `data/events.js` | Ereignisse ([ereignisse.md](ereignisse.md)) |
| `web/js/features/*` | je Feature ein Thread ([neue-features.md](neue-features.md), [einstieg.md](einstieg.md)) |
| `web/js/save/*` | Speichern ([speichern.md](speichern.md)) |
| `web/js/audio/audio.js` | Ton |
| `web/pixel/*` | Pixel-Fassung ([pixel-art.md](pixel-art.md)) |

Seit der Roadmap ([roadmap.md](roadmap.md), Abschnitt "Pakete und Reihenfolge") steht bei jedem Paket, welche Dateien es ändert; das geht dieser Tabelle vor.
| `web/js/render/placeholder.js` | Platzhalter. Nach dem Laden entfernt `main.js` die Bänder und Lichter, sobald es `game.landscape` gibt, und den Steg bei `game.stege`. Ein Platzhalter-Boot gibt es nicht mehr. Die Module setzen diese Felder in `init(game)` |

## Neue Module einhängen

`main.js` lädt beim Start diese Dateien (Liste `MODULES`, Stand nach PR 144), falls es sie gibt. Fehlende Dateien werden übersprungen.

```
web/js/data/stegbild.js
web/js/world/region.js
web/js/render/landscape.js
web/js/render/stege.js
web/js/render/services.js
web/js/render/buildings.js
web/js/render/boats/s.js
web/js/render/boats/m.js
web/js/render/boats/l.js
web/js/render/boats/xl.js
web/js/render/boats/xxl.js
web/js/render/boats/verkehr.js
web/js/render/boat-anim.js
web/js/render/boat-view.js
web/js/render/people.js
web/js/ui/input-pc.js
web/js/ui/input-touch.js
web/js/ui/gesten.js
web/js/ui/hud.js
web/js/ui/bauen.js
web/js/ui/fotomodus.js
web/js/audio/audio.js
web/js/state.js
web/js/events/events.js
web/js/features/dauerlieger.js
web/js/features/platzschilder.js
web/js/features/stammgaeste.js
web/js/features/tagesziele.js
web/js/features/wetterflagge.js
web/js/features/hafen-schauen.js
web/js/features/einstieg.js
web/js/save/index.js
web/js/ui/oberflaeche.js
```

Die Module werden parallel geladen, `init(game)` wird aber in der Reihenfolge der Liste aufgerufen. Jede Datei exportiert `init(game)` (oder `default`, oder eine Funktion, deren Name mit `init` beginnt). Wer ein neues Modul baut, trägt es **im selben PR** wie die Datei selbst in die Liste `MODULES` in `main.js` ein (seit 12.11.2026, damit die vielen Roadmap-Pakete nicht aufeinander warten). Nur diese eine Zeile in `main.js` ändern, an der Stelle, die zur Reihenfolge passt, und in `index.html` nichts. Ein Eintrag ohne Datei auf `main` ist verboten, weil der Browser sie mit 404 lädt und `check-modules.sh` scheitert. Prüfen:

```bash
bash tools/check-modules.sh
```

## Das Spielobjekt `game`

| Feld | Bedeutung |
|---|---|
| `game.THREE` | Three.js 0.187.0 |
| `game.scene`, `game.renderer`, `game.canvas` | Szene, Renderer, `#stage` |
| `game.camera.zoomAt(faktor, x, y)` | um einen Bildschirmpunkt zoomen, Faktor über 1 zoomt hinein |
| `game.camera.panBy(dx, dy)` | um Bildschirm-Pixel verschieben |
| `game.camera.reset()` | zurück zur Startansicht (Knopf „Übersicht“) |
| `game.camera.setHomeRect(rect)` | Startansicht als Rechteck `{ minX, maxX, minZ, maxZ }` oder als Funktion, die es bei jedem `reset()` neu liefert. Passt sich Hoch- und Querformat an und lässt die Schilder oben und unten frei (`insetsFn`, `insetRight`, `insetLeft`) |
| `game.camera.setHome(x, z, breite)` | Startansicht als Mittelpunkt und Breite |
| `game.camera.screenToWorld(x, y)` | Bildschirmpunkt auf die Wasserfläche projizieren |
| `game.camera.rotateBy(rad)` | weich um `rad` drehen, ab dem nächsten 45-Grad-Rastpunkt (Tasten Q und E) |
| `game.camera.rotateFree(rad)` | sofort drehen (Ziehen), danach `snapRotation()` |
| `game.camera.snapRotation()` | weich auf den nächsten 45-Grad-Schritt einrasten |
| `game.camera.flyTo(x, z)` | Blickpunkt weich verschieben |
| `game.camera.yaw` | aktuelle Drehung in Radiant, 0 = Norden oben. `reset()` dreht zurück auf 0 |
| `game.camera.camera` | die Three.js-Kamera (heute orthografisch; der Kamera-Thread stellt auf perspektivisch um, Beschreibung in `docs/kamera.md`, sobald PR 137 gemergt ist) |
| `game.pick(x, y, { tolerance, types })` | was liegt unter einem Bildschirmpunkt, liefert `{ type, id, object, point }` oder `null` |
| `game.boatTypes[größe]` | von den Schiffs-Modulen: `{ TYPES, MODELS, buildBoat, setSails, animateBoat }` je Größe `s`, `m`, `l`, `xl`, `xxl` |
| `game.onTick(fn)` | `fn(dt, game)` jedes Bild, `dt` in Sekunden, 0 während der Pause |
| `game.on(name, fn)`, `game.emit(name, daten)` | Ereignisse |
| `game.setPaused(true/false)`, `game.paused`, `game.speed`, `game.time` | Pause, Vorspulen, Spielzeit |

**Startansicht:** `main.js` setzt `setHomeRect(() => startRect(game, stufe))`. Kern sind die Liegeplätze der aktuellen Stufe, ab 20 Plätzen ohne die äußersten 10 % je Richtung; dazu Wartebojen, Bauplätze und die Landmarken der Geländeform (`game.gelaende.aktuell()`: `leuchttuerme`, `seeInseln`), solange die Ansicht dadurch höchstens anderthalbmal so breit wird. Freie Höhe geht zu 70 % nach Norden (Wasser) und zu 30 % nach Süden. Im Querformat zählt die linke Schilderspalte (`#hm-seite`, `#hm-zeit`) als `camera.insetLeft`.

**Überblick beim Laden:** Nach dem Laden zeigt die Kamera 2,5 s lang die ganze Geländeform (`game.gelaende.blickRect()`, eingepasst wie die Startansicht) und fährt dann in 1,5 s auf die Startansicht. Tippen springt sofort dorthin; Ziehen, Mausrad, Tasten oder `'kamera:ausrichten'` beenden den Flug an Ort und Stelle. Während des Flugs trägt `body` die Klasse `hm-ueberblick` (der Einstieg wartet darauf), am Ende kommt `'ueberblick:ende' { abgebrochen }`. Nicht in Tests und nicht in der Pixel-Fassung, außer mit `?ueberblick=1`; `?ueberblick=0` schaltet ihn ab. Der Knopf „Übersicht“ fliegt nie. Die Schilder misst `hudInsets()` in `core/game.js`: Es zählen nur sichtbare Teile von `#hud-top` und `#hud-bottom`, die mindestens 30 % der Breite einnehmen oder über die Mitte reichen, höchstens ein Viertel der Höhe je Seite.

**Ereignisse vom Grundgerüst:** `tap` mit `{ x, y, world, pick }`, `pause`, `resize`, `ready` (alle Module geladen).

**Spielereignisse** (gesendet von den Spielregeln, `state.js` und `sim.js`):

| Ereignis | Daten | Bedeutung |
|---|---|---|
| `stufe` | Zahl 1 bis 6 | Ausbaustufe hat sich geändert, auch einmal direkt nach dem Laden |
| `region` | `'ostsee'` oder `'nordsee'` | Hafenregion, gesendet von `world/region.js` bei `ready` und beim Wechsel (siehe [regionen.md](regionen.md)) |
| `pegel` | Meter um die Wasserlinie | Wasserstand, nur in der Nordsee (Gezeiten), von `world/region.js` |
| `phase` | `'tag'` oder `'abend'` | Tageszeit, setzt auch `body[data-phase]` |
| `uhrzeit` | Spielzeit des Tages | von den Spielregeln |
| `wetter` | Wetterzustand | von den Ereignissen |
| `licht` | `{ nacht: 0 bis 1, … }` | von `render/landscape.js`, für Fenster, Molenfeuer, Gebäude |

Der aktuelle Stand steht in `game.state.stufe` und `game.state.region` (Besitzer: Spielregeln-Thread), die Regionsdaten in `game.region` (Besitzer: Regionen-Thread). Module, die nach dem Laden starten, lesen diese Felder statt auf das Ereignis zu warten.

**Absichten aus den Eingabe-Modulen** (`input-pc.js`, `input-touch.js`). Sie werden per `game.emit` gesendet, `js/ui/hud.js` und die Spielregeln hören darauf:

| Ereignis | Bedeutung |
|---|---|
| `ui:cancel` | Auswahl aufheben, Karte schließen |
| `ui:collect` | abends kassieren (Hafenhorn, Münzen wischen) |
| `ui:tow` | Schleppleine: Boot wird zu einem Ziel gezogen |
| `ui:tow-end` | Schleppleine losgelassen |
| `ui:mute` | Ton an oder aus |
| `ui:auto-einfahren` | wartendes Boot soll selbst den besten Platz nehmen (`{ boot }`), aus `gesten.js` |
| `ui:vorspulen` | Tempo gewählt (`{ speed }`: 1, 3 oder 8), `ui/oberflaeche.js` setzt dabei `game.speed`; Knöpfe unten links oder Taste F |
| `hover` | Zeiger liegt über einem Objekt (nur PC), Daten wie bei `pick` |

## Antippbare Objekte

Jedes Modul, das etwas Antippbares in die Szene legt, setzt am obersten Objekt dieser Sache:

```js
mesh.userData.pick = { type: 'boat', id: 'b17' };
```

Erlaubte Werte für `type`: `boat`, `berth`, `jetty`, `coin`, `building`, `buildsite`, `waitbuoy` (Warteboje vor der Einfahrt), `anchorage` (Ankerbereich). Die `id` ist dieselbe wie in den Spielregeln (`sim.js`). Kinder-Objekte brauchen nichts, `game.pick` sucht vom getroffenen Teil nach oben. Ausgeblendete Objekte (`visible = false` am Objekt oder an einem Elternteil) werden nie getroffen. Trifft der Strahl nichts, nimmt `game.pick` das nächste antippbare Objekt innerhalb von 22 Pixeln auf dem Bildschirm, damit Finger auch kleine Boote treffen. Mit `types: ['boat']` lässt sich die Suche einschränken.

## Koordinaten

Welt in Metern. `x` nach Osten, `z` nach Süden (Norden ist `-z`), `y` nach oben, Wasserfläche bei `y = 0`. Umrechnung aus `skripte/konzeptbilder/hafen_von_oben.py`: `x_welt = x_plan * 0.62`, `z_welt = -y_plan * 0.62`.

## Knöpfe, die erst später erscheinen

`#btn-pause` und `#btn-build` sind in `index.html` mit `hidden` versteckt (Regel „Fertig heißt spielbar“, `docs/abnahme.md`). Das Modul, das sie mit Leben füllt, nimmt `hidden` weg: Pause der Spielregeln-Thread, sobald die Spielschleife läuft, Bauen der Bau-Thread.

## Steuerung im Grundgerüst

`web/js/core/input.js` deckt Maus, Touch und Stift mit Pointer Events ab: ein Finger zieht die Karte, zwei Finger zoomen und drehen (ab etwa 10 Grad, rastet beim Loslassen auf 45 Grad ein), Mausrad zoomt, kurzes Antippen sendet `tap`. Gerätespezifische Module (`input-pc.js`, `input-touch.js`) können das ergänzen.

## Lokal testen

```bash
python3 -m http.server 8000 --directory web
```

Danach `http://localhost:8000` öffnen. Vor dem Merge (siehe [tests.md](tests.md)):

```bash
bash tests/pruefen.sh && bash tools/check-modules.sh && bash tools/check-pages.sh web
```
