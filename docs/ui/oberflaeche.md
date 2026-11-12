# Oberfläche für alle Geräte

Stand: 12.11.2026 (zweite Runde: Pixel-Stil, neue Zeitsteuerung; Geräte-Dokumente eingearbeitet). Status: gebaut. Einziges Dokument zur Oberfläche: Die früheren `pc.md`, `tablet.md` und `handy.md` liegen in [archiv/ui/](../archiv/ui/), was davon noch gilt, steht unten unter [Bedienung je Gerät](#bedienung-je-gerät).

## Grundsatz

Eine Oberfläche, die auf PC, Tablet und Handy gleich aufgebaut ist und gleich aussieht. Nur die Größen ändern sich. Wer am PC spielt und dann am iPhone, findet jeden Knopf an derselben Stelle.

Aussehen: kleine Pixel-Schilder statt weißer Leisten. Jedes Element ist ein eigenes Schild mit Pixelrahmen und hartem Schatten, dazwischen bleibt das Spiel sichtbar.

## Woher die Anordnung kommt

| Quelle | Kernaussage | Umsetzung |
|---|---|---|
| Epic, Fortnite Mobile HUD (dev.epicgames.com) | Hauptaktionen in die unteren Ecken, Infos nach oben | Bauen unten rechts, Zeit unten links, Geld und Ruf oben |
| gamedeveloper.com, "Bigger phones require GUI redesign" | Oben-Mitte und obere Ecken erreicht der Daumen schlecht | Oben nur Anzeigen und seltene Knöpfe (Übersicht, Menü) |
| parachutedesign.ca, Thumb Zone | Natürliche Zone unten, Knöpfe mindestens 44 x 44 pt | Alle Knöpfe am Touchgerät mindestens 44 px, Tempo 46 px, Bauen 64 px |
| 80.lv, Dorfromantik minimalistisches UI | Wenig gleichzeitig zeigen, Spielfläche frei lassen | Höchstens sechs Bedienelemente gleichzeitig, Rest im Menü |

## Bereiche

| Bereich | Wo | Inhalt |
|---|---|---|
| Status `.hm-status` | oben links | Geld (Münze), Ruf (Stern) |
| Werkzeuge `.hm-werkzeuge` | oben rechts | Übersicht, Menü (`#btn-menu`) |
| Menü `#hm-menue` | klappt unter dem Menü-Knopf auf | Fotomodus, Ton, Spielstand, Maus und Tastatur (nur PC) |
| Seite `#hm-seite` | links unter dem Status | Wetter, Tagesziele, Ziel der nächsten Stufe (`#hm-ziel`); jedes Schild klappt eine Tafel auf, immer nur eine |
| Zeit `#hm-zeit` | unten links | Tag und Tageszeit, Himmelsbalken mit Sonne/Mond, Knöpfe Pause, 1x, 3x, 8x |
| Kassieren `#btn-collect` | unten Mitte (Handy hochkant: eigene Zeile darüber) | nur abends mit offenen Münzen |
| Bauen `#btn-build` | unten rechts | Baumodus |
| Karte `#card` | ab 900 x 500 px rechts unter den Werkzeugen, sonst Blatt von unten, Handy quer Seitenblatt rechts | Bootskarte, Bauen |

Linkshänder-Einstellung am Tablet (`hand-links`) tauscht Zeit und Bauen.

## Zeitsteuerung (ersetzt die Sonne)

Die alte Sonne zum Ziehen in `gesten.js` ist gelöscht. Was sie konnte und wo es jetzt ist:

| Funktion vorher | Jetzt |
|---|---|
| Tageszeit sehen (Sonne wandert) | Himmelsbalken in `#hm-zeit`, Sonne wird abends zum Mond, Abendteil orange |
| Vorspulen bis 8-fach durch Ziehen | Knöpfe 3x und 8x, ein Tipp statt Ziehen |
| Zurück auf normal beim Loslassen | Knopf 1x |
| Pause (eigener Knopf oben) | Knopf Pause, gleiche ID `#btn-pause`, Leertaste am PC |
| Ton beim Vorspulen, `body.vorspulen`, `'ui:vorspulen'` | unverändert |

Schnittstelle: `game.oberflaeche.tempo(speed)` (0 = Pause, 1, 3, 8); `game.gesten.setSpeed` leitet dorthin weiter.

## Bedienung je Gerät

Aus den früheren Geräte-Dokumenten (11.11.2026), auf den Stand vom 12.11.2026 gebracht. Kamera-Gesten (frei neigen und drehen) beschreibt der Kamera-Thread, sobald sein PR auf `main` ist.

**Welches Gerät gilt** (Media Queries in den drei Gerätedateien)

| Gerät | Bedingung | Datei |
|---|---|---|
| Handy | `(max-width: 599px)` oder `(max-height: 499px)` | `ui-phone.css` |
| Tablet | ab 600 px Breite und 500 px Höhe, wenn der Zeiger grob ist (Touch) oder die Breite unter 1024 px liegt | `ui-tablet.css` |
| PC | `(min-width: 1024px) and (pointer: fine)` | `ui-pc.css` |

Ein iPad mit Trackpad-Tastatur bekommt im Querformat das PC-Layout, das ist gewollt.

**Auf allen Geräten** (`web/js/ui/gesten.js`, `web/js/core/input.js`)

| Aktion | Geste | Weg ohne Geste |
|---|---|---|
| Karte verschieben | ein Finger oder linke Maustaste ziehen | Knopf Übersicht |
| Zoomen | zwei Finger, Mausrad, Doppeltipp | Knopf Übersicht |
| Boot zuweisen | Boot an der Boje greifen und an der Schleppleine auf einen leuchtenden Platz ziehen | Boot antippen, dann Platz antippen, oder "Automatisch einfahren" |
| Kassieren | abends auf einer Münze ansetzen und in einem Strich über alle streichen | Münze antippen |
| Tempo | Knöpfe Pause, 1x, 3x, 8x unten links | |
| Bauen | Knopf Bauen, Bauplatz wählen, Vorschau, bestätigen ([bauen.md](../bauen.md)) | |

Tipps zählen mit Fingertoleranz (22 bis 30 px), damit auch eine weit herausgezoomte Box zu treffen ist. Die Schleppleine endet 28 px über der Fingerspitze, damit der Finger das Ziel nicht verdeckt. Beginnt ein Finger auf einer Münze oder einem wartenden Boot, gehört er der Geste und verschiebt die Karte nicht.

**PC: Maus** (`web/js/ui/input-pc.js`)

| Eingabe | Wirkung |
|---|---|
| Doppelklick auf ein wartendes Boot | Boot fährt selbst in einen passenden Platz |
| Doppelklick auf Wasser oder Land | näher heran |
| Rechtsklick | Abbrechen |
| Rechte Taste ziehen, Umschalt + Mausrad | Hafen drehen |
| Mittlere Taste ziehen | Karte verschieben |
| Mausrad | Zoomen zum Mauszeiger (auch Trackpad-Pinch) |
| Zeiger und Tooltip | Greifhand über wartenden Booten, Name, Größe und Betrag unter dem Zeiger |

**PC: Tastatur** (Übersicht mit `?` oder `F1`, zeigt nur Kürzel, deren Funktion es gerade gibt)

| Taste | Wirkung |
|---|---|
| `1` bis `9`, `Tab` | wartendes Boot wählen, bei offener Karte deren Knopf |
| `Enter` | gewähltes Boot einfahren lassen |
| `F` | 3x an und aus |
| `Leertaste` | Pause |
| `B` | Bauen |
| `Esc` | Abbrechen |
| `W` `A` `S` `D`, Pfeiltasten | Karte verschieben |
| `+` `-` | Zoomen |
| `0`, `Pos1` | ganzer Hafen, Norden oben |
| `Q` `E` | um 45 Grad drehen |
| `M` | Ton aus und an |
| `P` | Fotomodus |
| `L` | Spielstand |

**Handy und Tablet** (`web/js/ui/input-touch.js`)

| Eingabe | Wirkung |
|---|---|
| Doppeltipp | doppelt so nah, ganz hineingezoomt zurück zur Übersicht |
| Boot im Hafen gedrückt halten | Boot hupt |
| Zwei Finger drehen | Hafen drehen |
| Vibration | kurz beim Einrasten der Leine und bei Münzen (nur Android, iOS kann das im Browser nicht) |

Gelöste Fälle aus den Handy-Tests, die beim Umbau erhalten bleiben müssen:

- Keine Kamerafahrt beim Ziehen, sonst rutscht das Ziel unter dem Finger weg.
- Ist ein Boot gewählt, rückt die Ansicht um die halbe Kartenhöhe nach oben, damit die leuchtenden Plätze antippbar bleiben.
- Kamerafahrten und die Startansicht rechnen die Schilder oben und unten heraus (`hudInsets` in `core/game.js`, [grundgeruest.md](../grundgeruest.md)).
- Der kleine Knopf "Einfahren" am Boot ist am Handy aus (`game.gesten.einfahrenAmBoot = false`), dort steht "Automatisch einfahren" in der Karte.
- Kein Seitenzoom, kein Gummiband, kein Pull-to-Refresh, keine Textauswahl, kein Kontextmenü bei langem Druck. Ränder von Notch und Home-Leiste über `env(safe-area-inset-*)`.

Ideen aus den alten Dokumenten (Fernglas, Hafenhorn, Wellenring, Möwen, Hupe und Glocke je Art, Abendrunde) sind Paket P26 und P46 bis P48 der [Roadmap](../roadmap.md). Noch nicht auf einem echten iPad mit Safari geprüft; Jorven testet am iPhone über die Pages-Seite.

## Farben

| Farbe | Wert | Bedeutung |
|---|---|---|
| Papier | `#fffcf6` | Schilder, Karten, Tafeln |
| Tinte | `#24364a` | Schrift, Rahmen, gewählter Zustand |
| Meer | `#23897d` | Hauptaktion: Einfahren lassen, Bauen bestätigen, erfüllte Ziele, aktives Tempo |
| Koralle | `#ee6454` | Bauen, Pause aktiv, Abweisen (hell) |
| Gold | `#f2c14e` | Geld, Kassieren, Hinweis-Punkt am Bauen-Knopf |

## Dateien

- `web/css/oberflaeche.css`: Aussehen und Anordnung für alle Geräte. Alle Regeln beginnen mit `.hm-neu` (Klasse am `body`), damit sie die Stile schlagen, die Module zur Laufzeit einfügen. Schrift Pixelify Sans liegt in `web/fonts/` (OFL).
- `web/css/ui-pc.css`, `ui-tablet.css`, `ui-phone.css`: nur Größen (`--hm-px`, `--hm-knopf`, `--hm-tempo`, `--hm-chip`, `--hm-bauen`, `--hm-schrift`, `--hm-rand`, `--hm-karte-breite`) und was ein Gerät anders braucht.
- `web/js/ui/oberflaeche.js`: zeichnet Pixelrahmen (`--rahmen-*`) und Pixelsymbole (`--px-*`) als SVG, baut das Gerüst und räumt die Knöpfe anderer Module ein (IDs bleiben).
- `web/js/ui/pixel-symbole.js`: der eine Symbolsatz (Raster, Farben, `pixelSvg`, `pixelBild`). Kein Eintrag in `MODULES`, wird importiert (Oberfläche, Wetter- und Ereignisschilder in `events/banner.js`). Vorschau: `node tools/pixel-symbole-vorschau.mjs bild.png`.

## Regeln für andere Module

- Neue Knöpfe für oben nicht in `#hud-top` hängen, sondern als Eintrag ins Menü: Knopf mit `id` anlegen, Eintrag in `MENUE` in `oberflaeche.js`, Symbol als Raster in `PIXEL` in `pixel-symbole.js`.
- Keine Zeichen als Symbole (✓ ○ ★ ← ! oder Emojis) und keine glatten SVG-Symbole: im CSS `var(--px-name)` als Maske, im JS `pixelBild(name)`.
- Neue Schilder links (wie Wetter, Tagesziele) in `#hm-seite` einhängen und die Klasse `hm-chip` geben, die Tafel dazu mit `hm-klapp`.
- In der Karte: Hauptaktion `hud-btn hm-primaer`, gefährliche Aktion `hud-btn hm-gefahr`, sonst `hud-btn`. Schließen oben rechts mit `hm-zu`.
- Keine Positionen für `#card`, `#btn-build`, `#hud-top`, `#hud-bottom` in Modul-Stilen festschreiben.
- Ein Rahmen im Pixel-Stil: Klasse `hm-px` geben.

## Einstellungen (P50)

Menü, Eintrag "Einstellungen" (`#btn-einstellungen`), Tafel `#hm-einstellungen`. Gilt je Gerät (`localStorage`, Schlüssel `hafenmeister:einstellungen`), nicht je Spielstand. Code: `web/js/ui/einstellungen.js`, Schnittstelle `game.einstellungen.wert(name)`, `game.einstellungen.setze(name, wert)`, Ereignis `'einstellungen'`.

| Einstellung | Klasse am `body` | Wirkung |
|---|---|---|
| Schilder mit Form | `hm-formen` | Rote Platzschilder bekommen einen weißen Querbalken; empfohlene Preisschilder einen Stern, Wetter-Neuigkeit ein Ausrufezeichen |
| Weniger Bewegung | `hm-ruhig` | Keine Animationen und Übergänge in der Oberfläche, weniger Regen, Schnee und Funken; Standard folgt `prefers-reduced-motion` |
| Größere Schrift | `hm-gross` | Schrift der Oberfläche mal 1,2 (`--hm-s`), `rem` mal 1,18 |
| Linkshänder (nur Touch) | `hand-links` | Bauen unten links, Zeit unten rechts |
| Boote fahren selbst ein | (keine) | Normal (8 s), Langsam (20 s), Nie; setzt `game.sim.ctx.rules.queue.selfEnterAfter` |

Dazu ein Knopf "Ton und Musik einstellen", der das Ton-Fenster mit getrennten Reglern öffnet.

## Tempo, das mitdenkt (P07, Bed P4 und P8)

- Bei Ankündigung oder Beginn eines Ereignisses, wenn ein Ausbau möglich wird und beim Abschluss der Region geht das Tempo zurück auf 1x.
- 8x läuft bis zum nächsten Boot an der Boje.
- PC: <kbd>F</kbd> 3x an und aus, <kbd>G</kbd> 8x an und aus, <kbd>K</kbd> Kassieren, <kbd>Leertaste</kbd> Pause.

Schrift: alles in Pixelify Sans, auch Fließtext und Modul-Stile (`.hm-neu *` mit `!important` in `oberflaeche.css`); Ziffern und Euro bleiben über `unicode-range` in der Systemschrift. Kleine Texte nicht unter etwa 13 px.

Schriftgrößen in Regeln immer als `var(--hm-s)` schreiben, nicht `var(--hm-schrift)`, sonst wirkt "Größere Schrift" nicht.

## Symbole (Runde 3)

Alle Symbole kommen aus einem Satz in `web/js/ui/pixel-symbole.js`, Vorschau `/mnt/project-files/oberflaeche/pixel-symbole.png`.

| Regel | Warum |
|---|---|
| 12 x 12 Pixel, gezeigt in 12, 24 oder 48 px | Ganze Vielfache bleiben scharf |
| Bedienknöpfe sind Masken (`#`), CSS färbt | Ein Symbol für hell, dunkel, gewählt, gesperrt |
| Anzeigen (Geld, Ruf, Wetter, Ereignisse) haben feste Farben mit Tintenumriss `#24364a` | Gleicher Umriss wie die Pixelrahmen |
| Striche mindestens 2 Pixel bei Knöpfen | Am Handy lesbar |
| Pfeile nur in 90-Grad-Schritten drehen, schräg hat ein eigenes Raster | Gedrehte Pixel werden unscharf |

Entscheidungen (Jorven schlief, Thread hat entschieden):

- Wetter und Ereignisse (bisher glatte SVG in `banner.js`) sind jetzt Pixelbilder; Regen hat ein eigenes Symbol statt der Wolke.
- Tagesziele zeigen Kreis und Haken als Pixelsymbol statt ○ ✓; Bau-Pfeile am Rand, Stern und Ausrufezeichen der Einstellung "Schilder mit Form" ebenso.
- Spielstand-Fenster, Erinnerung zum Sichern, Fotomodus-Leiste, Tastenhilfe und Mauszeiger-Hinweis am PC, Regler im Ton-Fenster haben Pixelrahmen und Pixelschrift.
- Handy quer: die Karte beginnt unter Übersicht und Menü, beide bleiben bei offener Karte erreichbar; das Spielstand-Fenster scrollt statt oben abgeschnitten zu werden.
