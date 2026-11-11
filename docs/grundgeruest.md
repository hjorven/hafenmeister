# Grundgerüst: Schnittstellen für alle Module

Stand: 11.11.2026. Das Spiel liegt in `web/` und wird ohne Build-Schritt auf GitHub Pages veröffentlicht.

## Wem gehört welche Datei

| Datei | Gehört |
|---|---|
| `web/index.html`, `web/js/main.js`, `web/js/core/*`, `web/css/base.css` | Grundgerüst |
| `web/css/ui-pc.css`, `web/css/ui-tablet.css`, `web/css/ui-phone.css` | je ein UI-Thread (Platzhalter komplett ersetzen) |
| `web/js/render/placeholder.js` | Platzhalter. Nach dem Laden entfernt `main.js` die Bänder und Lichter, sobald es `game.landscape` gibt, den Steg bei `game.stege` und das Würfel-Boot bei `game.boatView` oder `game.boatAnim`. Die Module setzen diese Felder in `init(game)` |

## Neue Module einhängen

`main.js` lädt beim Start diese Dateien, falls es sie gibt. Fehlende Dateien werden übersprungen.

```
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
web/js/render/boat-anim.js
web/js/render/boat-view.js
web/js/render/people.js
web/js/ui/input-pc.js
web/js/ui/input-touch.js
web/js/ui/gesten.js
web/js/ui/hud.js
web/js/ui/fotomodus.js
web/js/audio/audio.js
web/js/state.js
web/js/events/events.js
web/js/save/index.js
```

Die Module werden parallel geladen, `init(game)` wird aber in der Reihenfolge der Liste aufgerufen. Jede Datei exportiert `init(game)` (oder `default`, oder eine Funktion, deren Name mit `init` beginnt). Wer eine weitere Datei braucht, meldet sie beim Grundgerüst an, damit sie in die Liste `MODULES` in `main.js` kommt.

## Das Spielobjekt `game`

| Feld | Bedeutung |
|---|---|
| `game.THREE` | Three.js 0.187.0 |
| `game.scene`, `game.renderer`, `game.canvas` | Szene, Renderer, `#stage` |
| `game.camera.zoomAt(faktor, x, y)` | um einen Bildschirmpunkt zoomen, Faktor über 1 zoomt hinein |
| `game.camera.panBy(dx, dy)` | um Bildschirm-Pixel verschieben |
| `game.camera.reset()` | zurück zur Startansicht (Knopf „Übersicht“) |
| `game.camera.setHomeRect({ minX, maxX, minZ, maxZ })` | Startansicht als Rechteck, passt sich Hoch- und Querformat an. Danach `reset()` |
| `game.camera.setHome(x, z, breite)` | Startansicht als Mittelpunkt und Breite |
| `game.camera.screenToWorld(x, y)` | Bildschirmpunkt auf die Wasserfläche projizieren |
| `game.camera.camera` | die `THREE.OrthographicCamera` |
| `game.pick(x, y, { tolerance, types })` | was liegt unter einem Bildschirmpunkt, liefert `{ type, id, object, point }` oder `null` |
| `game.boatTypes[größe]` | von den Schiffs-Modulen: `{ TYPES, MODELS, buildBoat, setSails, animateBoat }` je Größe `s`, `m`, `l`, `xl`, `xxl` |
| `game.onTick(fn)` | `fn(dt, game)` jedes Bild, `dt` in Sekunden, 0 während der Pause |
| `game.on(name, fn)`, `game.emit(name, daten)` | Ereignisse |
| `game.setPaused(true/false)`, `game.paused`, `game.speed`, `game.time` | Pause, Vorspulen, Spielzeit |

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
| `ui:vorspulen` | Sonne gezogen (`{ speed }`, 1 bis 8), `gesten.js` setzt dabei `game.speed` |
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

`web/js/core/input.js` deckt Maus, Touch und Stift mit Pointer Events ab: ein Finger zieht die Karte, zwei Finger zoomen, Mausrad zoomt, kurzes Antippen sendet `tap`. Gerätespezifische Module (`input-pc.js`, `input-touch.js`) können das ergänzen.

## Lokal testen

```bash
python3 -m http.server 8000 --directory web
```

Danach `http://localhost:8000` öffnen. Vor dem Push:

```bash
bash tools/check-pages.sh web
```
