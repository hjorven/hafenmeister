# Hafenmeister

Ein einfaches Aufbauspiel für den Browser: Du bist Hafenmeister, fängst mit einem kleinen Bootssteg an einem See an und baust ihn Stufe für Stufe zur Küstenmarina aus. Boote laufen ein, du weist ihnen einen Liegeplatz zu und kassierst abends das Hafengeld.

Geplant für GitHub Pages, der kleine Online-Teil läuft über Supabase.

**Stand:** Konzeptphase. Es gibt noch keinen Spielcode.

![Hafenentwicklung in fünf Stufen](docs/hafen/uebersicht.jpg)

## Inhalt

| Ordner | Was drin ist |
|---|---|
| [docs/plan.md](docs/plan.md) | Spielplan: Spielschleife, Wünsche, Bauwerke, Oberfläche, Technik, Meilensteine |
| [docs/hafen-und-schiffe.md](docs/hafen-und-schiffe.md) | Hafen von oben in fünf Stufen, Liegeplätze, Einlaufen, Schiffskatalog mit 16 Arten und 80 Modellen |
| [docs/stile](docs/stile/README.md) | Zehn Stile im Vergleich, je Stufe 1 und Maximalstufe |
| [skripte](skripte) | Zeichenskripte für die Vorschauen und den Hafen von oben, dazu eine grobe Balancing-Simulation |

Wo sich die beiden Dokumente widersprechen, gilt `docs/hafen-und-schiffe.md`. Es ist neuer.

## Die fünf Stufen

| Stufe | Name | Liegeplätze |
|---|---|---|
| 1 | Bootssteg am See | 6 |
| 2 | Dorfhafen am See | 30 |
| 3 | Durchstich zur Ostsee | 54 |
| 4 | Marina | 76 |
| 5 | Küstenmarina | 94 |

## Entscheidungen bisher

- Stil: Flat Vector
- Bedienung: ein Bildschirm, höchstens zwei Tipps pro Aktion
- Zwei Zahlen im Spiel: Geld und Ruf
- Der Hafen beginnt an einem Binnensee und wächst durch die Nehrung zur Ostsee
- Jeder Steg hat eine eigene Form (Knick, T-Kopf, Stichsteg, Gabelung)
- Molenfeuer und Fahrwassertonnen statt Leuchtturm
- Ein Boot passt nur, wenn Länge, Breite und Tiefgang zum Platz passen
- Schiffe: 4 Größen, 16 Arten, je Art 5 Modelle mit eigener Form

## Noch offen

- Preise, Ziele und Besucherzahlen neu durchrechnen. `skripte/balance.py` rechnet noch mit 54 statt 94 Liegeplätzen.
- Drei Fragen am Ende von [docs/hafen-und-schiffe.md](docs/hafen-und-schiffe.md#6-folgen-für-den-spielplan)
