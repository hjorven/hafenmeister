# Oberfläche für alle Geräte

Stand: 12.11.2026 (zweite Runde: Pixel-Stil, neue Zeitsteuerung). Ersetzt die getrennten Leisten aus `pc.md`, `tablet.md` und `handy.md` (die Gesten dort gelten weiter).

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

## Regeln für andere Module

- Neue Knöpfe für oben nicht in `#hud-top` hängen, sondern als Eintrag ins Menü: Knopf mit `id` anlegen, Eintrag in `MENUE` in `oberflaeche.js`, Symbol als Raster in `PIXEL`.
- Neue Schilder links (wie Wetter, Tagesziele) in `#hm-seite` einhängen und die Klasse `hm-chip` geben, die Tafel dazu mit `hm-klapp`.
- In der Karte: Hauptaktion `hud-btn hm-primaer`, gefährliche Aktion `hud-btn hm-gefahr`, sonst `hud-btn`. Schließen oben rechts mit `hm-zu`.
- Keine Positionen für `#card`, `#btn-build`, `#hud-top`, `#hud-bottom` in Modul-Stilen festschreiben.
- Ein Rahmen im Pixel-Stil: Klasse `hm-px` geben.
