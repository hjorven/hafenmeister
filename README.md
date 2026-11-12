# Hafenmeister

Ein gemütliches Aufbauspiel in 3D für den Browser: Du bist Hafenmeister, fängst mit einem Badesteg an einem Dünensee an und baust ihn Stufe für Stufe zum Seehafen aus, in dem Traditionssegler, Kreuzfahrt- und Marineschiffe festmachen. Boote laufen ein, du weist ihnen einen Liegeplatz zu und streichst das Liegegeld ein. Läuft auf PC, Tablet und Handy, hoch und quer.

**Spielen:** https://hjorven.github.io/hafenmeister/ (Pixel-Fassung: https://hjorven.github.io/hafenmeister/pixel/)

## Stand (12.11.2026)

Die Ostsee ist in allen sechs Stufen spielbar, vom Bootssteg bis zum Seehafen mit Abschlussziel. Gebaut sind Zuweisen und Selbst-Einfahren, Liegegeld beim Festmachen, Bauen mit Vorschau, 20 Services und Angebote an Land, Dauerlieger, Stammgäste, Tagesziele, Wetter, Ereignisse mit Winter, Menschen im Hafen, Ton und Musik, Fotomodus, Speichern und eine Pixel-Oberfläche für alle Geräte. Bis zum Abschluss der Ostsee dauert es etwa 8,5 Stunden.

Als Nächstes arbeiten die Pakete der [Roadmap](docs/roadmap.md) die Funde aus Jorvens Überblick ab. Danach kommen die Nordsee und, als letzter Schritt, ein kleiner Online-Teil. Was sich für Spieler geändert hat, steht in [docs/aenderungen.md](docs/aenderungen.md).

| Stufe | Name | Gastplätze |
|---|---|---|
| 1 | Bootssteg am See | 6 |
| 2 | Dorfhafen am See | 30 |
| 3 | Durchstich zur Ostsee | 54 |
| 4 | Marina | 76 |
| 5 | Küstenmarina | 94 |
| 6 | Seehafen | 94 plus Pier für Großschiffe |

## Wegweiser

| Dokument | Inhalt |
|---|---|
| [docs/plan.md](docs/plan.md) | Spielplan (gilt): Vision, Regeln, Stufen, Schiffe, Services, Steuerung, Technik, Stand und Entscheidungen |
| [docs/roadmap.md](docs/roadmap.md) | Arbeitsliste: was fehlt, was falsch ist, was weg soll, welches Paket es erledigt |
| [docs/aenderungen.md](docs/aenderungen.md) | Was ist neu im Spiel |
| [docs/ui/oberflaeche.md](docs/ui/oberflaeche.md) | Oberfläche und Bedienung auf allen Geräten |
| [docs/tests.md](docs/tests.md) | Tests vor jedem Merge, Testmodus und alle Adresszusätze |
| [docs/grundgeruest.md](docs/grundgeruest.md) | Technik: Spielobjekt, Module, Koordinaten, Dateibesitz |
| [docs/abnahme.md](docs/abnahme.md) | Regel "Fertig heißt spielbar" |
| [docs/hafen-und-schiffe.md](docs/hafen-und-schiffe.md) | Katalog: Hafen von oben, Liegeplätze, Einlaufen, Schiffsarten und Modelle |

Wo sich Dokumente widersprechen, gilt `docs/plan.md`. Alte Fassungen liegen in `docs/archiv/`.

## Ordner

| Ordner | Was drin ist |
|---|---|
| [web](web) | Das Spiel, wird auf GitHub Pages veröffentlicht (kein Build-Schritt) |
| [web/pixel](web/pixel) | Die Pixel-Fassung |
| [docs](docs) | Plan, Roadmap und Beschreibungen der Teile |
| [tests](tests) | Automatische Tests für Handy, Tablet und PC |
| [tools](tools) | Balancing-Simulation `balance.mjs`, Prüfskripte, Stegbilder erzeugen |
| [skripte](skripte) | Liegeplätze aus dem Hafenplan exportieren, Konzeptbilder |

## Lokal spielen und prüfen

```bash
python3 -m http.server 8000 --directory web
```

Danach `http://localhost:8000` öffnen. Vor jedem Merge im Hauptordner:

```bash
bash tests/pruefen.sh
```

Am Ende muss `Alles grün.` stehen. Einzelheiten in [docs/tests.md](docs/tests.md).

![Hafenentwicklung in fünf Stufen (Konzeptbild, nicht das Aussehen im Spiel)](docs/hafen/uebersicht.jpg)
