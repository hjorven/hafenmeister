# Hafenmeister

Ein gemütliches Aufbauspiel in 3D für den Browser: Du bist Hafenmeister, fängst mit einem Badesteg an einem Dünensee an und baust ihn Stufe für Stufe zum Seehafen aus, in dem Traditionssegler, Kreuzfahrt- und Marineschiffe festmachen. Boote laufen ein, du weist ihnen einen Liegeplatz zu und kassierst abends das Hafengeld. Läuft auf PC, Tablet und Handy.

**Spielen:** https://hjorven.github.io/hafenmeister/

Geplant für GitHub Pages, der kleine Online-Teil läuft über Supabase.

**Stand:** Meilenstein 0 (Grundgerüst) ist fertig, der Spielcode liegt in `web/`.

![Hafenentwicklung in fünf Stufen](docs/hafen/uebersicht.jpg)

## Inhalt

| Ordner | Was drin ist |
|---|---|
| [docs/plan.md](docs/plan.md) | Spielplan (gilt): Vision, Regeln, Stufen, Schiffe, Services, Steuerung, Technik, Meilensteine |
| [docs/grundgeruest.md](docs/grundgeruest.md) | Technik: Spielobjekt, Module, Koordinaten, Dateibesitz |
| [web](web) | Das Spiel, wird auf GitHub Pages veröffentlicht |
| [docs/hafen-und-schiffe.md](docs/hafen-und-schiffe.md) | Katalog: Hafen von oben in fünf Stufen, Liegeplätze, Einlaufen, 16 Schiffsarten mit 80 Modellen |
| [docs/vorbilder.md](docs/vorbilder.md) | Vergleich mit 15 echten Häfen an Ostsee und Nordsee anhand von Satellitenbildern, fehlende Elemente, Gebäudeformen |
| [docs/stile](docs/stile/README.md) | Zehn Stile im Vergleich, je Stufe 1 und Maximalstufe |
| [skripte](skripte) | Zeichenskripte für die Vorschauen und den Hafen von oben, dazu eine grobe Balancing-Simulation |

Wo sich Dokumente widersprechen, gilt `docs/plan.md`. Der alte Plan liegt in `docs/archiv/`.

## Die sechs Stufen

| Stufe | Name | Liegeplätze |
|---|---|---|
| 1 | Bootssteg am See | 6 |
| 2 | Dorfhafen am See | 30 |
| 3 | Durchstich zur Ostsee | 54 |
| 4 | Marina | 76 |
| 5 | Küstenmarina | 94 |
| 6 | Seehafen | 94 plus Pier für Großschiffe |

Entscheidungen und offene Fragen stehen in [docs/plan.md](docs/plan.md#14-entscheidungen).
