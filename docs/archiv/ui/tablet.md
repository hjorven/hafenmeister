# Tablet-Oberfläche

**Archiv (12.11.2026):** ersetzt durch [docs/ui/oberflaeche.md](../../ui/oberflaeche.md). Was hier noch gilt (Gesten, Maus, Tastatur, Touch-Lösungen), steht dort im Abschnitt "Bedienung je Gerät". Die Sonne zum Ziehen und die alten Leisten gibt es nicht mehr.

Stand: 11.11.2026. Gilt für iPad und Android-Tablets im Hoch- und Querformat. PC und Handy haben eigene Dateien, die Aufteilung ist unten beschrieben.

**Dateien**

| Datei | Inhalt |
|---|---|
| `web/css/ui-tablet.css` | Layout für Tablets, wird nur per Media Query aktiv |
| `web/js/ui/gesten.js` | Schleppleine, Einfahren-Knopf, Kassierstrich, Sonne ziehen (alle Geräte) |
| `web/js/core/input.js` | Ziehen, Pinch und Tipp im Spiel (Grundgerüst) |
| `web/js/ui/input-touch.js` | Doppeltipp-Zoom, langes Drücken, Vibration (Handy-Thread) |
| `docs/ui/prototyp/tablet.html` | früher 2D-Prototyp, **nicht Teil des Spiels** und nicht veröffentlicht |

**Spiel lokal ansehen** (im Ordner `hafenmeister`)

```bash
python3 -m http.server 8000 --directory web
```

Danach im Browser `http://localhost:8000` öffnen.

**Alten Prototyp ansehen** (im Ordner `hafenmeister`)

```bash
python3 -m http.server 8000
```

Danach `http://localhost:8000/docs/ui/prototyp/tablet.html` öffnen, mit `#abend` am Ende startet er am Abend. Am PC in den Entwicklerwerkzeugen die Geräteansicht (iPad Air) einschalten, sonst greift das Tablet-Layout bei breitem Fenster mit Maus nicht.

---

## 1. Wann gilt das Tablet-Layout

| Gerät | Bedingung | Datei |
|---|---|---|
| Handy | `(max-width: 599px)` oder `(max-height: 499px)` | `ui-phone.css` |
| Tablet | ab 600 px Breite und 500 px Höhe, wenn der Zeiger grob ist (Touch) oder die Breite unter 1024 px liegt | `ui-tablet.css` |
| PC | `(min-width: 1024px) and (pointer: fine)` | `ui-pc.css` |

Ein iPad im Querformat ist 1024 bis 1366 px breit. Deshalb entscheidet ab 1024 px der Zeiger und nicht die Breite. Ein iPad mit Trackpad-Tastatur bekommt im Querformat das PC-Layout, das ist gewollt.

## 2. Aufbau

**Hochformat**

```
+--------------------------------------+
| 1.240 €  Ruf 3,5  Tag 12 ===o---  [||]|
|                                      |
|                                      |
|            Hafen (3D-Szene)          |
|                                      |
|        +------------------+          |
|        |  Infokarte       |          |
|        +------------------+          |
| [M][S][S][M][S] -> wischen   [Bauen] |
+--------------------------------------+
```

**Querformat**

```
+--------------------------------------------------+------+
| 1.240 €  Ruf 3,5  Tag 12 ======o--------   [||]  | [M]  |
|                                   +-----------+  | [S]  |
|                                   | Infokarte |  | [S]  |
|            Hafen (3D-Szene)       |           |  | [M]  |
|                                   +-----------+  |      |
|                                                  |[Bauen]|
+--------------------------------------------------+------+
```

- Leisten schweben als Karten über der Szene, die Szene läuft bis an den Rand.
- Im Querformat wandern die wartenden Boote in eine Seitenleiste. So bleibt die Höhe für den Hafen, und der Bauen-Knopf liegt unter dem rechten Daumen.
- Linkshänder können die Leiste in den Einstellungen (Pause) nach links legen. Klasse `hand-links` am `body`.
- Die Infokarte liegt im Hochformat über der unteren Leiste, im Querformat neben der Seitenleiste. Der Hafen bleibt dabei sichtbar.
- Kleinste Tippfläche 56 px, Boote in der Einfahrt 88 bis 104 px.
- Safe Areas (Home-Balken, abgerundete Ecken) über `env(safe-area-inset-*)`. Dafür braucht `index.html` `viewport-fit=cover`.
- Kein Gummiband-Scrollen, kein Doppeltipp-Zoom der Seite, kein Kontextmenü bei langem Druck.
- Wird das Tablet gedreht, rahmt die Kamera den Hafen neu ein.
- Fährt die Kamera zu Liegeplätzen, rechnet sie die Leisten heraus (`hudPadding()` im alten Prototyp), damit nichts unter einer Leiste verschwindet.

## 3. Bedienung

| Aktion | Geste |
|---|---|
| Karte verschieben | ein Finger ziehen |
| Zoomen | zwei Finger (Pinch), Doppeltipp |
| Boot zuweisen | Boot an der Boje auf einen Platz ziehen **oder** antippen und Einfahren wählen |
| Bauen | Bauen, Plus antippen, Bauwerk wählen |
| Kassieren | Münze antippen **oder** mit einem Finger über mehrere Münzen streichen |
| Vorspulen | Sonne im Tagesbalken nach rechts ziehen, loslassen = normal |

Tipps zählen mit Fingertoleranz: Auch wenn ein Liegeplatz bei herausgezoomter Karte nur wenige Pixel groß ist, trifft ein Tipp in 30 px Umkreis (`pickNearest`). Die Markierungen über der Karte haben immer dieselbe Größe auf dem Bildschirm, egal wie weit gezoomt ist.

## 4. Positiv überraschende Steuerung

Jorven wünscht sich ein cozy Tycoon in 3D mit Steuerung, die positiv überrascht. Die ersten drei Ideen hat Jorven am 11.11.2026 bestätigt, sie stecken im Spiel in `web/js/ui/gesten.js` und gelten auf allen Geräten. Der Rest ist für später gedacht.

**Im Spiel (bestätigt)**

1. **Schleppleine.** Ankommende Boote warten draußen vor dem Hafen an einer Warteboje oder im Ankerfeld, wie in echt. Das Boot mit dem Finger greifen (ab 10 px Bewegung) und auf einen leuchtenden Platz ziehen. Eine Leine hängt zwischen Boot und Finger, über einem passenden Platz rastet sie straff ein, es klickt und vibriert kurz. Am Bildschirmrand läuft die Karte mit, weil die Bojen weit von den Stegen entfernt liegen. Kurz antippen zeigt stattdessen den Knopf **Einfahren**: Das Boot sucht sich selbst den besten Platz.
2. **Kassierstrich.** Abends mit einem Finger in einem Zug über die Münzen streichen. Eine goldene Spur folgt dem Finger, jede Münze springt hoch und klingt einen Ton höher (Pentatonik), am Ende ein kleiner Akkord und „8 Münzen in einem Strich". Ein zweiter Finger bricht den Strich ab und zoomt.
3. **Sonne ziehen.** Die Sonne im Tagesbalken ist ein Regler. Nach rechts ziehen spult schneller (bis 8-fach), loslassen läuft normal weiter. Kein Menü, kein Extra-Knopf.

**Für später**

4. **Zwei Finger drehen dreht den Hafen.** Die Kamera kreist um die Hafenmitte und rastet in 45-Grad-Schritten ein, damit man nicht die Orientierung verliert. Zwei Finger gemeinsam nach oben oder unten schieben kippt die Kamera zwischen Draufsicht (gut zum Zuweisen) und Schrägsicht (schön zum Zuschauen).
5. **Fernglas.** Langer Druck auf die Einfahrt hebt die Kamera und zeigt, welche Boote draußen schon unterwegs sind. Das ersetzt die Vorschau der nächsten 3 Boote durch einen Blick aufs Wasser.
6. **Wasser zum Anfassen.** Tippen aufs freie Wasser macht eine kleine Welle, Möwen fliegen auf, ein Boot im Weg schaukelt. Keine Funktion, nur Freude.
7. **Hupe und Glocke.** Ein Boot gedrückt halten lässt es hupen (Motorboot) oder die Schiffsglocke läuten (Traditionssegler). Jede Art hat ihren Ton.
8. **Ablegen per Wisch.** Abreisende Boote kann man mit einem Wisch zur Hafeneinfahrt schicken, sie legen mit Bugwelle ab. Sonst fahren sie von selbst.
9. **Apple Pencil.** Mit dem Stift eine Linie über einen Steg ziehen markiert alle Plätze darauf, zum Beispiel „für Katamarane freihalten". Auf iPads mit Stift-Hover zeigt das Schweben über einem Platz seine Maße, ohne zu tippen.
10. **Neigen.** Wer möchte, schaltet in den Einstellungen das Neigen ein: Das Tablet leicht kippen bewegt Licht und Spiegelungen auf dem Wasser ein wenig mit. iOS fragt dafür einmal um Erlaubnis. Standardmäßig aus.
11. **Abendrunde.** Bei Sonnenuntergang zieht die Kamera einmal langsam über den Hafen, Fenster gehen an, Molenfeuer blinken. Ein Tipp beendet die Fahrt sofort.

Grenzen, damit es einfach bleibt: Jede Geste hat einen sichtbaren Weg per Tipp als Ersatz. Neue Gesten werden einzeln mit dem pulsierenden Kreis gezeigt, wenn sie gebraucht werden (Kassierstrich am ersten Abend, Drehen beim ersten Ausbau), nicht alle am Anfang.

## 5. Was das Grundgerüst liefern muss

Das meiste davon hat `web/index.html` schon (Stand Grundgerüst). Die Leisten-Inhalte füllt später `web/js/ui/hud.js`:

- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`
- `body.hm` mit `data-phase="tag"` oder `"abend"`, Klasse `card-open` bei offener Karte
- `#hud-top` mit `#money`, `#rep`, `#day` (darin `.day-bar > i`), `#btn-pause`
- `#stage` für die Szene, `#hud-bottom` mit `#queue` (Einträge `.boat`) und `#btn-build`
- `#card` mit Attribut `hidden`, darin `.card-close` und `.card-actions`
- Fortschritt des Tages als CSS-Variable `--day-progress` auf `#day` (z. B. `42%`)

## 6. Getestet

Mit Chromium (Playwright, Touch-Emulation) in diesen Größen: iPad Air hoch 820 x 1180 und quer 1180 x 820, iPad mini hoch 744 x 1133, iPad Pro 12,9 quer 1366 x 1024, Android-Tablet hoch 600 x 960. Geprüft: Boot antippen und Platz antippen, Boot ziehen, Bauplatz öffnen, Kassierstrich (8 Münzen in einem Zug). Keine Fehler in der Konsole.

Noch nicht getestet: echtes iPad mit Safari (Safe Areas, `gesturestart`, Haptik gibt es auf iOS im Browser nicht).
