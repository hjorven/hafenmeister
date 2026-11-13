# PC-Bedienung

**Archiv (12.11.2026):** ersetzt durch [docs/ui/oberflaeche.md](../../ui/oberflaeche.md). Was hier noch gilt (Gesten, Maus, Tastatur, Touch-Lösungen), steht dort im Abschnitt "Bedienung je Gerät". Die Sonne zum Ziehen und die alten Leisten gibt es nicht mehr.

Stand: 11.11.2026. Gilt für Geräte mit Maus oder Trackpad ab 1024 px Breite. Tablet und Handy haben eigene Dokumente.

**Ausprobieren:**

```bash
python3 -m http.server 8000 --directory web
```

Danach `http://localhost:8000` öffnen, `?` drücken zeigt alle Kürzel. Beenden mit Strg+C.

## Leitidee

Am PC hat man Maus, Tastatur und viel Platz. Das Spiel soll sich dort nicht wie eine vergrößerte Handy-App anfühlen. Jede Handlung bleibt mit höchstens zwei Klicks machbar, dazu gibt es Abkürzungen, die man von selbst entdeckt.

## Wer macht was

| Datei | Aufgabe | Geräte |
|---|---|---|
| `web/js/core/input.js` | Linke Taste ziehen verschiebt die Karte, Tippen | alle |
| `web/js/ui/gesten.js` | Schleppleine von der Warteboje, Knopf „Einfahren“, Kassierstrich über die Münzen | alle |
| `web/js/ui/input-pc.js` | alles, was nur Maus und Tastatur können (unten) | PC |
| `web/css/ui-pc.css` | Layout für große Bildschirme | PC |

Die Gesten aus `gesten.js` gelten am PC genauso: wartendes Boot mit der Maus von der Boje ziehen, Maustaste gedrückt halten und über die Münzen streichen, vorspulen mit den Tempo-Knöpfen unten links (`ui/oberflaeche.js`). `input-pc.js` baut sie nicht nach, sondern ergänzt sie.

## Was input-pc.js ergänzt

### Maus

| Eingabe | Wirkung |
|---|---|
| Doppelklick auf ein wartendes Boot | Boot fährt selbst in den besten Platz (`ui:auto-einfahren`) |
| Doppelklick auf Wasser oder Land | Näher heran |
| Rechtsklick | Abbrechen (`ui:cancel`) |
| Rechte Taste ziehen, Umschalt + Mausrad | Hafen drehen, rastet beim Loslassen in 45-Grad-Schritten ein |
| Mittlere Taste ziehen | Karte verschieben |
| Mausrad | Zoomen zum Mauszeiger. Firefox liefert Zeilen statt Pixel, Trackpad-Pinch kommt als Rad mit Strg. Beides wird umgerechnet, sonst zoomt es dort kaum |
| Mauszeiger | Greifhand über wartenden Booten, Kopierpfeil über Münzen, Zeigefinger über allem anderen Antippbaren |
| Tooltip | Kurzer Text unter dem Zeiger: Name, Größe, Länge, „Ziehen oder doppelklicken“ bei wartenden Booten, Restnächte bei liegenden, Betrag bei Münzen. Eigene Texte über `game.describe(treffer)` |

### Tastatur

| Taste | Wirkung |
|---|---|
| `1` bis `9` | Wartendes Boot wählen (Reihenfolge wie in der Einfahrt), bei offener Karte deren Knopf |
| `Tab`, Umschalt + `Tab` | Nächstes, voriges wartendes Boot |
| `Enter` | Gewähltes Boot einfahren lassen, bei offener Karte deren erster Knopf |
| `F` | Vorspulen an und aus (3-fach, wie der Knopf 3x) |
| `Leertaste` | Pause |
| `B` | Bauen, sobald der Knopf sichtbar ist |
| `Esc` | Abbrechen |
| `W` `A` `S` `D`, Pfeiltasten | Karte verschieben, auch in der Pause |
| `+` `-` | Zoomen |
| `0`, `Pos1` | Ganzer Hafen, Norden wieder oben |
| `Q` `E` | Um 45 Grad drehen |
| `M` | Ton aus und an |
| `P` | Fotomodus an und aus (`ui/fotomodus.js`) |
| `L` | Spielstand sichern oder laden (`game.spielstand.oeffnen()`) |
| `?`, `F1`, Knopf „?“ | Übersicht aller Kürzel |

Die Übersicht zeigt nur Kürzel, deren Funktion es gerade gibt. Tastenschilder stehen klein an den Knöpfen „Übersicht“, „Pause“ und „Bauen“.

### Große Bildschirme (`ui-pc.css`)

- Die Leisten schweben als Panels mit fester Höchstbreite in der Mitte, statt über die ganze Breite zu laufen. So bleibt mehr Hafen sichtbar.
- Die Infokarte steht rechts oben und lässt die Hafenmitte frei.
- Die Sonne im Tagesbalken ist nur noch Anzeige; vorgespult wird mit den Tempo-Knöpfen (siehe `docs/ui/oberflaeche.md`).
- Eine leere untere Leiste wird ausgeblendet.
- Ab 1920 px und ab 2560 px wachsen Schrift und Knöpfe mit.
- Knöpfe reagieren auf Überfahren, der Tastaturfokus ist deutlich sichtbar.

## Ideen für später

Passen zum 3D-Hafen und bleiben bei höchstens zwei Klicks pro Aktion. Ein 3D-Prototyp mit Drehen, Hinfliegen und Wartebojen lag kurz unter `web/prototyp/pc/`, die Erkenntnisse stehen hier.

1. **Fernglas:** Maus auf ein Boot und Taste `Z` halten: weiche Vergrößerung mit runder Maske, Name, Heimathafen und Wünsche daneben. Loslassen, und die Kamera springt zurück.
2. **Hafenhorn:** Klick auf das Hafenmeisterhaus lässt das Horn tuten, alle wartenden Boote mit freiem Platz fahren nacheinander ein.
3. **Ausbau-Vorschau mit dem Mausrad:** Maus über ein Gebäude, Alt halten und scrollen: Die nächste Ausbaustufe erscheint durchsichtig, Preis und Wirkung daneben. Klick baut.
4. **Kräuselringe:** Auf freiem Wasser ziehen kleine Ringe hinter dem Mauszeiger her. Im Prototyp unauffällig und gemütlich.

## Schnittstelle

`input-pc.js` exportiert `init(game)` und wird vom Modul-Lader in `main.js` geladen. Es fängt nur die rechte und mittlere Maustaste und das Mausrad ab, linke Taste und Touch laufen unverändert über `core/input.js` und `gesten.js`.

| Was es nutzt | Pflicht |
|---|---|
| `game.canvas`, `game.camera.zoomAt/panBy/reset/screenToWorld`, `game.pick`, `game.on/emit`, `game.speed` | ja |
| `game.setPaused`, `game.sim.wartet/waitingBoats/select/selected/state`, `game.describe(treffer)`, `game.spielstand.oeffnen()`, `game.audio` | nein |
| `game.camera.rotateBy/rotateFree/snapRotation/flyTo` | nein |

| Was es sendet | Wann |
|---|---|
| `ui:cancel` | `Esc`, Rechtsklick |
| `ui:auto-einfahren { boot }` | Doppelklick auf wartendes Boot |
| `ui:vorspulen { speed }` | Taste `F` |
| `ui:mute` | Taste `M` |
| `hover { x, y, world, hit }` | Maus bewegt sich ohne gedrückte Taste |
