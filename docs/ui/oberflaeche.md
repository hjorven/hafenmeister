# Oberfläche für alle Geräte

Stand: 12.11.2026. Ersetzt die getrennten Leisten aus `pc.md`, `tablet.md` und `handy.md` (die Gesten dort gelten weiter).

## Grundsatz

Eine Oberfläche, die auf PC, Tablet und Handy gleich aufgebaut ist und gleich aussieht. Nur die Größen ändern sich. Wer am PC spielt und dann am iPhone, findet jeden Knopf an derselben Stelle.

## Bereiche

| Bereich | Wo | Inhalt |
|---|---|---|
| Statusleiste `.hm-status` | oben links | Geld (Münze), Ruf (Stern), Tag mit Sonne zum Vorspulen |
| Werkzeuge `.hm-werkzeuge` | oben rechts, Handy hochkant als Spalte darunter | Übersicht, Pause, Menü |
| Menü `#hm-menue` | klappt unter dem Menü-Knopf auf | Fotomodus, Ton, Spielstand, Maus und Tastatur (nur PC) |
| Seitenleiste `#hm-seite` | links unter der Statusleiste | Wetter, Tagesziele, Ziel der nächsten Stufe (`#hm-ziel`); jedes Schild klappt eine Tafel auf, immer nur eine |
| Aktionen `#hud-bottom` | unten rechts | Kassieren (gold, nur abends mit offenen Münzen), Bauen (koralle) |
| Karte `#card` | ab 900 x 500 px rechts unter den Werkzeugen, sonst Blatt von unten, Handy quer Seitenblatt rechts | Bootskarte, Bauen |

## Farben

| Farbe | Wert | Bedeutung |
|---|---|---|
| Papier | `#fffcf6` | Karten, Tafeln, Leisten (leicht durchsichtig) |
| Tinte | `#24364a` | Schrift, gewählter Zustand |
| Meer | `#23897d` | Hauptaktion: Einfahren lassen, Bauen bestätigen, erfüllte Ziele |
| Koralle | `#ee6454` | Bauen, Pause aktiv, Abweisen (hell) |
| Gold | `#f2c14e` | Geld, Kassieren, Hinweis-Punkt am Bauen-Knopf |

## Dateien

- `web/css/oberflaeche.css`: Aussehen und Anordnung für alle Geräte. Alle Regeln beginnen mit `.hm-neu` (Klasse am `body`), damit sie die Stile schlagen, die Module zur Laufzeit einfügen.
- `web/css/ui-pc.css`, `ui-tablet.css`, `ui-phone.css`: nur Größen (`--hm-knopf`, `--hm-chip`, `--hm-bauen`, `--hm-schrift`, `--hm-rand`, `--hm-spur`, `--hm-karte-breite`) und was ein Gerät anders braucht.
- `web/js/ui/oberflaeche.js`: baut das Gerüst und räumt die Knöpfe anderer Module ein (IDs bleiben): `#money #rep #day` in die Statusleiste, `#btn-overview #btn-pause #btn-menu` in die Werkzeuge, `#btn-foto #btn-sound #btn-save #btn-help` ins Menü, `#weather-chip #weather-panel .hm-tafel #hm-ziel` in die Seitenleiste. Symbole als CSS-Variablen `--i-<name>`.

## Regeln für andere Module

- Neue Knöpfe für die obere Leiste nicht mehr in `#hud-top` hängen, sondern als Eintrag ins Menü: Knopf mit `id` anlegen, Eintrag in `MENUE` in `oberflaeche.js`, Symbol in `ICON`.
- Neue Schilder links (wie Wetter, Tagesziele) in `#hm-seite` einhängen und die Klasse `hm-chip` geben, die Tafel dazu mit `hm-klapp`.
- In der Karte: Hauptaktion `hud-btn hm-primaer`, gefährliche Aktion `hud-btn hm-gefahr`, sonst `hud-btn`. Schließen oben rechts mit `hm-zu`.
- Keine Positionen für `#card`, `#btn-build`, `#hud-top` in Modul-Stilen festschreiben.
