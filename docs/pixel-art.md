# Pixel-Art-Fassung

Stand: 12.11.2026. Thread "Spiel als Pixel-Art zeichnen". Status: gebaut als eigene Seite `pixel/`; ob sie das Hauptspiel wird, ist Frage 9 der [Roadmap](roadmap.md#offene-fragen-an-jorven).

Die Pixel-Fassung ist dasselbe Spiel in Pixel-Art. Sie liegt ganz in `web/pixel/` und ändert keine andere Datei.

- Spielen: `pixel/` neben dem Spiel, online https://hjorven.github.io/hafenmeister/pixel/
- Werkstatt (Spritebögen): `pixel/werkstatt.html`

## Wie es funktioniert

Seit 12.11.2026 (Jorvens Wahl "alles gezeichnet") wird nichts mehr gefiltert. Statt ein fertig beleuchtetes 3D-Bild auf eine Palette zu runden, werden die Pixel nach festen Regeln gesetzt, wie man sie von Hand setzen würde. Die 3D-Modelle liefern dafür nur Form, Modellfarbe und Licht. Damit gibt es **jede Drehrichtung und jede Kamerahöhe für jedes Objekt**, und neue Modelle anderer Threads sind sofort dabei.

Gemeinsame Regeln (`web/pixel/js/gezeichnet.js`, `sprite-zeichner.js`):

- Jede Modellfarbe bekommt eine eigene Rampe mit vier Tönen: Umriss, Schatten (dunkler, kühler), Grund, Licht (heller, wärmer). Gleiche Farbe ergibt überall dieselbe Rampe.
- Licht kommt in genau drei Stufen an, ohne Verläufe. Schlagschatten werden zu harten Flächen.
- Außen ein geschlossener 1-Pixel-Umriss in der dunkelsten Farbe des Teils, innen eine leichte Kante, wo ein Teil vor einem anderen liegt.
- Einzelpixel werden entfernt, Flächen bleiben ruhig.
- Leuchtende Teile (Fenster nachts) behalten ihr Leuchten. Nachts färbt das Licht der Tageszeit alles ein.

**Schiffe** (`schiff-sprites.js`): Für jedes Boot entsteht bei Bedarf ein gezeichnetes Sprite für die aktuelle Blickrichtung (32 Richtungen), Kameraneigung (5-Grad-Stufen) und Zoomstufe, mit Masten als sauberen Linien und einem Schatten auf dem Wasser. Das Sprite ersetzt im Bild das 3D-Boot, jedes Sprite-Pixel trägt seine eigene Tiefe, darum verdecken Stege und andere Boote richtig. Höchstens drei neue Sprites je Bild; bis eines fertig ist, steht dort das live gezeichnete 3D-Boot.

**Alles andere** (Stege, Gebäude, Services, Menschen, Landschaft): Die beleuchteten Materialien bekommen im Pixel-Spiel einen anderen Shader-Abschluss, der statt weicher Beleuchtung die Rampenfarbe der Lichtstufe ausgibt. Das läuft live, also auch bei jeder Drehung, Höhe und Tageszeit.

Ablauf je Bild (`pixel-pass.js`):

1. Szene in niedriger Auflösung rendern (kurze Bildschirmseite etwa 200 bis 300 Kunstpixel, ein Kunstpixel sind 2 bis 4 CSS-Pixel), Kamera rastet aufs Pixelraster, der Rest wird beim Hochskalieren ausgeglichen (kein Flimmern beim Verschieben).
2. Umrisse aus Tiefensprüngen, Einzelpixel aufräumen.
3. Schiff-Sprites und durchsichtige Markierungen (Ankerfeld, Box-Leuchten, Bauplätze) kommen pixelgenau auf eine eigene Ebene darüber.
4. Pixelgenau auf den Bildschirm vergrößern.

Zum Vergleich gibt es den alten Filter-Weg weiter: `?stil=filter` (feste Palette `palette.js`, 84 Farben).

## Kamerahöhe

Das normale Spiel schaut immer mit 50 Grad Neigung. In der Pixel-Fassung gibt es drei Höhen: flach 30°, Spiel 50°, hoch 70°.

- Knopf "50°" oben rechts neben dem Menü schaltet reihum
- Tasten: Bild auf, Bild ab
- Adresse: `?hoehe=30`, `?hoehe=50`, `?hoehe=70`

Drehen geht wie im Spiel (8 Rastrichtungen, frei beim Ziehen). Boote drehen sich ohnehin frei, also sieht man sie in jeder Richtung.

## Adresszusätze und Tasten

| Zusatz / Taste | Wirkung |
|---|---|
| `?px=3` | feste Pixelgröße in CSS-Pixeln (Standard: passend zum Gerät, 2 bis 4) |
| `?umriss=0` | ohne Umrisse |
| `?hoehe=70` | Kamerahöhe beim Start |
| `?stil=filter` | alles wie früher gefiltert (Vergleich) |
| `?schiffe=filter` | nur die Schiffe gefiltert |
| F8 | Pixel-Zeichner an/aus zum Vergleichen |

Alle Zusätze des Spiels gelten weiter, zum Beispiel `pixel/?stufe=6&services=alle&uhrzeit=19.5`.

## Leisten und Karten

`web/pixel/css/pixel.css` gibt der Oberfläche den Pixel-Look: Schrift Pixelify Sans (Google Fonts, mit Umlauten; ohne Netz Systemschrift), harte Kanten, Knöpfe mit Pixelschatten. Die Regeln gelten nur unter `html.pixel`, also nie im normalen Spiel.

## Alle Boote nebeneinander

`pixel/boote.html` zeigt jedes Bootsmodell (S, M, L, XL) als 3D-Bild und daneben das gezeichnete Sprite weit, mittel und nah, in Bildschirmgröße wie im Spiel. Wählbar sind Größe, Kamerahöhe, Richtung und Segel, auch per Adresse: `boote.html?groesse=M&hoehe=50&richtung=8&segel=0`.

Zeichenregeln, die dabei nachgeschärft wurden (12.11.2026):

- Eigenschatten: Was aus Sicht der Sonne verdeckt ist (Deck hinter dem Aufbau, Rumpf unter dem Segel), bekommt die Schattenstufe.
- Innenräume: Flächen zwischen höheren Kanten (Ruderboot, Cockpit) bekommen eine Stufe weniger Licht, Duchten und Bänke heben sich ab.
- Innenkanten schon ab etwa 10 cm Höhenunterschied; zwischen gleich hellen Teilen (Segel vor weißem Rumpf) eine echte Umrisslinie.
- Weiß hat eine eigene, nach unten verschobene Rampe, damit Licht, Grund und Schatten unterscheidbar bleiben.
- Wanten und Leinen werfen keinen Schatten mehr aufs Wasser.

## Werkstatt und Spritebögen

`pixel/werkstatt.html` zeichnet ein Boot (Stil gezeichnet oder Filter) in 8, 16 oder 32 Richtungen und den drei Höhen. Mit "Wasser" sieht man es wie im Spiel, ohne Wasser entsteht ein Bogen mit durchsichtigem Hintergrund, der sich als PNG speichern lässt (zum Beispiel zum Nachzeichnen von Hand). Adresse: `werkstatt.html?groesse=M&modell=M2-5&richtungen=16&wasser=0`.

## Wie die Pixel-Fassung lädt

`pixel/index.html` holt die normale Spielseite `../index.html`, setzt `<base>` auf den Spielordner und hängt nur `pixel/js/pixel.js` und `pixel/css/pixel.css` an. Dadurch bleibt die Pixel-Fassung automatisch auf dem Stand des Spiels, egal was andere Threads an `index.html` ändern. Spielstand und Einstellungen teilt sie mit dem normalen Spiel.

`pixel.js` ersetzt `game.renderer.render` durch den Pixel-Zeichner und setzt die Kameraneigung über `rig.pitch`. Die Oberfläche des Spiels (seit PR 119 selbst im Pixel-Stil) bleibt unverändert, `pixel.css` gilt nur für die alte Oberfläche. Im normalen Spiel passiert davon nichts.

## Grenzen

- Sehr dünne Teile (Leinen, Wanten) können je nach Zoom einzelne Pixel verlieren. Das ist bei Pixel-Art so gewollt.
- Die HTML-Oberfläche selbst bleibt scharf gezeichnet, nur ihr Aussehen ist angepasst.
