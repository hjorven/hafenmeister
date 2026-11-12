# Pixel-Art-Fassung

Stand: 12.11.2026. Thread "Spiel als Pixel-Art zeichnen".

Die Pixel-Fassung ist dasselbe Spiel in Pixel-Art. Sie liegt ganz in `web/pixel/` und ändert keine andere Datei.

- Spielen: `pixel/` neben dem Spiel, online https://hjorven.github.io/hafenmeister/pixel/
- Werkstatt (Spritebögen): `pixel/werkstatt.html`

## Wie es funktioniert

Statt jedes Objekt in jeder Drehung und Höhe von Hand zu zeichnen, zeichnet ein Pixel-Zeichner die vorhandenen 3D-Modelle in jedem Bild neu als Pixel-Art. Damit gibt es automatisch **jede Drehrichtung und jede Kamerahöhe für jedes Objekt**: Schiffe S bis XL (und XXL, sobald es auf main ist), Stege und Boxen aller Stufen und Stegbild-Varianten, Landschaft und Wasser, Gebäude und Services, Menschen, Bojen, Schilder, Wetter, Tag und Nacht. Neue Modelle anderer Threads sind sofort mit dabei.

Schritte je Bild (`web/pixel/js/pixel-pass.js`):

1. Die Szene wird in niedriger Auflösung gerendert (Kurze Bildschirmseite etwa 200 bis 300 Kunstpixel, ein Kunstpixel sind 2 bis 4 CSS-Pixel).
2. Die Kamera rastet dabei auf das Pixelraster ein. Der Rest der Verschiebung wird beim Hochskalieren ausgeglichen, darum flimmert beim Verschieben nichts und das Bild gleitet trotzdem weich.
3. Jede Farbe wird auf die feste Hafen-Palette gebracht (`web/pixel/js/palette.js`, 84 Farben, Nachschlagetabelle in OKLab).
4. Umrisse: Ein Pixel am Rand eines Objekts (Nachbar deutlich weiter weg) bekommt die dunklere Stufe seiner eigenen Farbe, Knicke zwischen Flächen eine leichte Abdunklung.
5. Durchsichtige Markierungen ohne Tiefenschreiben (Ankerfeld, Box-Leuchten, Bauplätze, Baumschatten) kommen auf eine eigene Ebene und werden danach pixelgenau, aber in ihrer echten Farbe und Deckkraft darübergelegt. Sonst würden sie auf der Palette verschwinden.
6. Das kleine Bild wird pixelgenau auf den Bildschirm vergrößert.

Weil weniger Pixel gerendert werden, ist die Pixel-Fassung eher schneller als das normale Spiel.

## Die Palette

Entstanden aus den Farben des 3D-Spiels: k-Means über Bilder von Tag, Abend, Nacht, Morgen, allen Stufen und beiden Revieren, etwas kräftiger gemacht und je Farbe um eine kühlere Schattenstufe ergänzt, dazu Umriss-Dunkel, Lichtspitzen, Fensterlicht und Signalfarben. Wer Farben ändert, sieht das Ergebnis sofort in der Werkstatt.

## Kamerahöhe

Das normale Spiel schaut immer mit 50 Grad Neigung. In der Pixel-Fassung gibt es drei Höhen: flach 30°, Spiel 50°, hoch 70°.

- Knopf "Höhe" in der oberen Leiste schaltet reihum
- Tasten: Bild auf, Bild ab
- Adresse: `?hoehe=30`, `?hoehe=50`, `?hoehe=70`

Drehen geht wie im Spiel (8 Rastrichtungen, frei beim Ziehen). Boote drehen sich ohnehin frei, also sieht man sie in jeder Richtung.

## Adresszusätze und Tasten

| Zusatz / Taste | Wirkung |
|---|---|
| `?px=3` | feste Pixelgröße in CSS-Pixeln (Standard: passend zum Gerät, 2 bis 4) |
| `?umriss=0` | ohne Umrisse |
| `?hoehe=70` | Kamerahöhe beim Start |
| F8 | Pixel-Zeichner an/aus zum Vergleichen |

Alle Zusätze des Spiels gelten weiter, zum Beispiel `pixel/?stufe=6&services=alle&uhrzeit=19.5`.

## Leisten und Karten

`web/pixel/css/pixel.css` gibt der Oberfläche den Pixel-Look: Schrift Pixelify Sans (Google Fonts, mit Umlauten; ohne Netz Systemschrift), harte Kanten, Knöpfe mit Pixelschatten. Die Regeln gelten nur unter `html.pixel`, also nie im normalen Spiel.

## Werkstatt und Spritebögen

`pixel/werkstatt.html` zeichnet ein Boot mit demselben Zeichner in 8, 16 oder 32 Richtungen und den drei Höhen. Mit "Wasser" sieht man es wie im Spiel, ohne Wasser entsteht ein Bogen mit durchsichtigem Hintergrund, der sich als PNG speichern lässt (zum Beispiel zum Nachzeichnen von Hand). Adresse: `werkstatt.html?groesse=M&modell=M2-5&richtungen=16&wasser=0`.

## Wie die Pixel-Fassung lädt

`pixel/index.html` holt die normale Spielseite `../index.html`, setzt `<base>` auf den Spielordner und hängt nur `pixel/js/pixel.js` und `pixel/css/pixel.css` an. Dadurch bleibt die Pixel-Fassung automatisch auf dem Stand des Spiels, egal was andere Threads an `index.html` ändern. Spielstand und Einstellungen teilt sie mit dem normalen Spiel.

`pixel.js` ersetzt `game.renderer.render` durch den Pixel-Zeichner und überschreibt am Kamera-Objekt nur `_apply` (für die Höhe). Im normalen Spiel passiert davon nichts.

## Grenzen

- Sehr dünne Teile (Leinen, Wanten) können je nach Zoom einzelne Pixel verlieren. Das ist bei Pixel-Art so gewollt.
- Die HTML-Oberfläche selbst bleibt scharf gezeichnet, nur ihr Aussehen ist angepasst.
