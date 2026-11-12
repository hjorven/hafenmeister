# Handy-Oberfläche

Stand: 11.11.2026. Gilt für Handys im Hochformat (bis 599 px breit) und im Querformat (bis 499 px hoch). Tablet steht in [tablet.md](tablet.md).

## Dateien

| Datei | Inhalt |
|---|---|
| `web/css/ui-phone.css` | Layout fürs Handy, hoch und quer |
| `web/js/ui/input-touch.js` | Touch-Ergänzungen im Spiel: Doppeltipp-Zoom, Boot gedrückt halten lässt es hupen, Vibration |
| `web/js/ui/touch-view.js` | Kamera für 2D-Prototypen: Ziehen, Pinch, Drehen, Kamerafahrt, Fingertoleranz |
| `docs/ui/prototyp/handy.html` | klickbarer Prototyp mit Platzhalterdaten, nicht veröffentlicht |

Boot von der Boje ziehen, Münzen einstreichen und Sonne ziehen stehen geräteübergreifend in `web/js/ui/gesten.js`. Der Handy-Prototyp war die Vorlage dafür und zeigt das Gefühl auf dem kleinen Bildschirm ohne 3D.

## Prototyp ausprobieren

```bash
cd hafenmeister
python3 -m http.server 8000
```

Danach `http://localhost:8000/docs/ui/prototyp/handy.html` im Handy-Modus der Entwicklertools (z. B. 390 x 844) öffnen. Mit `http://localhost:8000/docs/ui/prototyp/handy.html?abend` startet er direkt am Abend mit Münzen. Vom Handy im selben WLAN geht es über die IP des Rechners, z. B. `http://192.168.178.20:8000/docs/ui/prototyp/handy.html`.

Das echte Spiel auf dem Handy:

```bash
cd hafenmeister
python3 -m http.server 8000 --directory web
```

Danach `http://localhost:8000` im Handy-Modus öffnen.

## Layout

**Hochformat**

```
+----------------------------------+
| (0 €) (Ruf 3,0) (  Tag 1 · Tag  )|   Zahlen, Sonne am Tagesbalken
|                             (II) |   Pause
|                             [  ] |   Übersicht
|     Reede: Boote an Bojen   (<)) |   Ton
|                             (H)  |   Spielstand
|     Hafen (3D)                   |
|                                  |
| [S Ruderboot][S Beiboot]  (Bauen)|   wartende Boote, abends Kassieren
+----------------------------------+
```

Drei Zahlen und vier Knöpfe passen nicht in eine Zeile von 390 px. Die Zahlen bekommen die ganze obere Zeile, die runden Knöpfe stehen rechts untereinander wie bei Karten-Apps. Die Knöpfe zeigen Symbole, der Text bleibt für Screenreader erhalten.

**Querformat:** Zahlen oben links, Leiste als Spalte rechts mit Bauen darunter. Die Karte behält die volle Höhe.

**Infokarte:** im Hochformat ein Bottom Sheet von unten, im Querformat ein Seitenblatt von rechts. Nach unten (bzw. rechts) wischen schließt sie. Solange sie offen ist, rutscht die untere Leiste weg.

**Regeln**

- Jede Tippfläche mindestens 48 px. Kleine Ziele auf der Karte (Bojen, Boote, Münzen) haben eine Fingertoleranz von 22 bis 30 px.
- Ränder von Notch und Home-Leiste über `--hm-safe-*`.
- Kein Seitenzoom, kein Gummiband, kein Pull-to-Refresh, keine Textauswahl.
- Auf sehr schmalen Handys (unter 360 px) fallen die Beschriftungen weg, nur Zahl und Symbol bleiben.

## Bedienung

Eine Box ist auf dem Handy bei ganz herausgezoomter Karte nur etwa 5 px breit. Deshalb wählt der Spieler nie eine Box, sondern einen Steg, und das Spiel nimmt die kleinste passende Box, bei Gleichstand die nächste zum Finger.

| Aktion | Geste | Weg ohne Geste |
|---|---|---|
| Karte verschieben | ein Finger | |
| Zoomen | zwei Finger, Doppeltipp | Knopf Übersicht |
| Boot zuweisen | Boot an der Boje greifen und an der Schleppleine auf einen Steg ziehen | Boot antippen, dann Steg antippen, oder „Automatisch einfahren“ |
| Kassieren | abends auf einer Münze ansetzen und in einem Strich über alle streichen | Münze antippen |
| Vorspulen | Sonne im Tagesbalken nach rechts ziehen, bis 8-fach, loslassen = normal | |
| Hupen | Boot im Hafen gedrückt halten | |
| Bauen | Bauen, Plus antippen, Bauwerk wählen | |

Was beim Testen auf dem Handy aufgefallen ist und so gelöst wurde:

- **Karte steht beim Strich still.** Beginnt der Finger auf einer Münze oder einem wartenden Boot, gehört er der Geste und verschiebt die Karte nicht. Sonst wandert die Karte mit und man trifft keine zweite Münze.
- **Keine Kamerafahrt beim Ziehen.** Wird ein Boot angetippt, fährt die Kamera zu den passenden Stegen. Beim Ziehen nicht, sonst rutscht das Ziel unter dem Finger weg.
- **Ziel über dem Finger.** Die Schleppleine endet 28 px über der Fingerspitze, damit der Finger den Steg nicht verdeckt.
- **Leisten herausrechnen.** Kamerafahrten lassen den Bereich unter den Leisten frei, auch im Querformat oben links.
- **Stege über der Bootskarte.** Ist ein Boot gewählt, wird die Karte knapp (Name, Hinweis, drei Knöpfe in einer Zeile) und die Ansicht rückt um die halbe Kartenhöhe nach oben. So bleiben die leuchtenden Ringe antippbar. Nach dem Zuweisen oder Schließen rückt die Ansicht zurück. Im Querformat liegt die Karte rechts unter der oberen Leiste.
- **Fünf Knöpfe im Hochformat.** Pause, Übersicht, Foto, Ton und Spielstand stehen rechts untereinander, das Wetter links unter den Zahlen. Die Maus-und-Tastatur-Hilfe ist auf dem Handy ausgeblendet.

## Ideen für die 3D-Fassung

Ziel ist ein cozy Tycoon, bei dem sich die Steuerung gut anfühlt. Jede Idee hat einen Weg per Tipp als Ersatz und wird erst gezeigt, wenn sie gebraucht wird.

1. **Schleppleine mit Gefühl.** Die Leine spannt sich, das Boot dreht sich hinter dem Finger her und hinterlässt eine kleine Bugwelle. Über einem passenden Steg rastet sie hörbar ein.
2. **Kassierstrich mit steigendem Ton.** Jede Münze in einem Strich klingt einen Halbton höher, am Ende ein kleiner Akkord. Auf Android vibriert jede Münze ganz kurz.
3. **Fernglas.** Langer Druck auf die Hafeneinfahrt hebt die Kamera und zeigt, welche Boote draußen schon unterwegs sind.
4. **Hafen drehen.** Zwei Finger drehen die Kamera um den Hafen, sie rastet in 45-Grad-Schritten ein. Ein Kompass oben rechts erscheint nur, wenn gedreht ist, und dreht per Tipp zurück nach Norden.
5. **Hupe und Glocke.** Ein Boot gedrückt halten lässt es hupen, Traditionssegler läuten die Glocke. Jede Art hat ihren Ton.
6. **Wasser zum Anfassen.** Tippen aufs freie Wasser macht eine kleine Welle, Möwen fliegen auf.

## Geprüft

Mit Chromium und Playwright (Touch-Emulation) auf iPhone 13 hoch und quer, iPhone SE und Pixel 7:

- Spiel (`web/index.html`): Layout hoch und quer, Infokarte als Bottom Sheet und Seitenblatt, Doppeltipp-Zoom, langes Drücken, keine Fehler in der Konsole.
- Spiel mit der echten Leiste aus `hud.js`: Zahlen und Knöpfe passen auf 390 und 320 px Breite, Boot in der Leiste antippen öffnet die Karte, Boot gedrückt halten löst das Horn aus.
- Prototyp: Boot an der Schleppleine auf einen Steg ziehen, Boot antippen und automatisch einfahren, Sonne ziehen (8-fach, beim Loslassen wieder 1-fach), Kassierstrich über 5 Münzen in einem Zug.
