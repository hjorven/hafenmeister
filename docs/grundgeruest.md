# Grundgerüst: Schnittstellen für alle Module

Stand: 11.11.2026. Das Spiel liegt in `web/` und wird ohne Build-Schritt auf GitHub Pages veröffentlicht.

## Wem gehört welche Datei

| Datei | Gehört |
|---|---|
| `web/index.html`, `web/js/main.js`, `web/js/core/*`, `web/css/base.css` | Grundgerüst |
| `web/css/ui-pc.css`, `web/css/ui-tablet.css`, `web/css/ui-phone.css` | je ein UI-Thread (Platzhalter komplett ersetzen) |
| `web/js/render/placeholder.js` | Platzhalter, wird durch `web/js/render/landscape.js` ersetzt |

## Neue Module einhängen

`main.js` lädt beim Start diese Dateien, falls es sie gibt. Fehlende Dateien werden übersprungen.

```
web/js/render/landscape.js
web/js/render/services.js
web/js/render/boats/s.js
web/js/render/boats/m.js
web/js/render/boats/l.js
web/js/render/boats/xl.js
web/js/ui/input-pc.js
web/js/ui/input-touch.js
web/js/ui/hud.js
web/js/audio/audio.js
web/js/state.js
web/js/save/index.js
```

Jede Datei exportiert `init(game)` (oder `default`, oder eine Funktion, deren Name mit `init` beginnt). Wer eine weitere Datei braucht, meldet sie beim Grundgerüst an, damit sie in die Liste `MODULES` in `main.js` kommt.

## Das Spielobjekt `game`

| Feld | Bedeutung |
|---|---|
| `game.THREE` | Three.js 0.187.0 |
| `game.scene`, `game.renderer`, `game.canvas` | Szene, Renderer, `#stage` |
| `game.camera.zoomAt(faktor, x, y)` | um einen Bildschirmpunkt zoomen, Faktor über 1 zoomt hinein |
| `game.camera.panBy(dx, dy)` | um Bildschirm-Pixel verschieben |
| `game.camera.reset()` | zurück zur Startansicht (Knopf „Übersicht“) |
| `game.camera.setHome(x, z, breite)` | Startansicht ändern, z. B. beim Erweitern des Hafens |
| `game.camera.screenToWorld(x, y)` | Bildschirmpunkt auf die Wasserfläche projizieren |
| `game.camera.camera` | die `THREE.OrthographicCamera` |
| `game.onTick(fn)` | `fn(dt, game)` jedes Bild, `dt` in Sekunden, 0 während der Pause |
| `game.on(name, fn)`, `game.emit(name, daten)` | Ereignisse |
| `game.setPaused(true/false)`, `game.paused`, `game.speed`, `game.time` | Pause, Vorspulen, Spielzeit |

**Ereignisse vom Grundgerüst:** `tap` mit `{ x, y, world }`, `pause`, `resize`, `ready` (alle Module geladen).

## Koordinaten

Welt in Metern. `x` nach Osten, `z` nach Süden (Norden ist `-z`), `y` nach oben, Wasserfläche bei `y = 0`. Umrechnung aus `skripte/konzeptbilder/hafen_von_oben.py`: `x_welt = x_plan * 0.62`, `z_welt = -y_plan * 0.62`.

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
