# Wie viel vom Hafen verdecken die Menüs?

Stand: 14.11.2026. Status: gepflegt. Anlass: Die Tagesziel-Wahl verdeckte am iPhone fast den halben Bildschirm.

## Messung

Jedes Menü wird in einem frisch geladenen Spiel (`?stufe=3&seed=7`) geöffnet, auch in typischen Kombinationen.
Dann wird der Bildschirm im Raster von 6 px abgetastet: Ein Punkt gilt als verdeckt, wenn dort nicht die
Spielfläche liegt (`document.elementFromPoint`). Die Zahl ist der verdeckte Anteil in Prozent und enthält die
immer sichtbaren Teile (Kasse, Knöpfe, Zeitsteuerung, Bauen). Hinweise wie "Als Nächstes" kommen und gehen je nach
Moment, deshalb schwanken einzelne Werte um einige Punkte, ohne dass sich etwas geändert hat.

Geräte: Handy hoch (iPhone 13, 390 x 664), Handy quer (iPhone 13 quer), Tablet hoch und quer (Galaxy Tab S4), PC (1440 x 900).

## Ergebnis (verdeckt in Prozent, vorher → **nachher**)

| Menü | Handy hoch | Handy quer | Tablet hoch | Tablet quer | PC |
|---|---|---|---|---|---|
| Grundansicht (nichts offen) | 37 → **32** | 35 → **30** | 14 | 10 → **14** | 7 |
| Dauerplatz-Hinweis | 37 → **28** | 35 → **30** | 14 | 14 | 7 |
| Tagesziel wählen (drei Karten) | 63 → **51** | 53 → **51** | 27 → **24** | 24 | 14 |
| Tagesziel offen (nach der Wahl) | 68 → **55** | 45 → **40** | 24 → **22** | 22 → **24** | 14 |
| Ausbau-Ziel offen | 69 → **57** | 46 → **41** | 26 | 26 | 14 |
| Wetter offen | 66 → **49** | 39 → **31** | 23 | 23 | 13 |
| Menü | 66 → **61** | 57 | 26 | 26 | 15 |
| Einstellungen | 88 | 61 | 45 | 36 | 23 |
| Spielstand | 100 | 100 | 100 | 100 | 100 |
| Hilfe | 91 | 84 | 65 | 60 | 38 |
| Maus und Tastatur | 100 | 100 | 100 | 100 | 100 |
| Gästebuch | 100 | 100 | 100 | 100 | 100 |
| Tagesabschluss | 60 → **55** | 58 → **54** | 24 | 22 | 14 |
| Baumenü | 72 → **69** | 62 | 55 | 40 → **38** | 27 → **24** |
| Bootskarte | 52 → **36** | 62 | 25 | 26 → **28** | 14 |
| Aufstieg (Feier) | 100 | 100 | 100 | 100 | 100 |
| Winterpause | 26 → **32** | 24 | 10 | 10 | 5 |
| Kombi: Kartenwahl + Bootskarte | 52 → **39** | 67 → **63** | 24 → **27** | 40 | 25 → **23** |
| Kombi: Tagesziel offen + Bootskarte | 52 → **45** | 73 → **60** | 27 | 36 → **39** | 19 → **21** |
| Kombi: Ausbau offen + Bootskarte | 52 → **45** | 73 | 25 | 38 → **42** | 21 |
| Kombi: Tagesziel offen + Baumenü | 78 → **69** | 58 → **46** | 58 | 41 → **38** | 27 |

Anteil der einzelnen Tafel allein am Handy hochkant (ohne die feste Oberfläche):

| Tafel | vorher | nachher |
|---|---|---|
| Tagesziel wählen | 41 % | 29 % |
| Bootskarte | 46 % | 30 % |
| Tagesziel offen | 30 % | 22 % |
| Ausbau-Ziel offen | 32 % | 25 % |
| Wetter offen | 28 % | 17 % |
| Baumenü | 62 % | 52 % |
| "Als Nächstes" (immer da) | 11 % | 6 % |

## Was geändert wurde

- **Tagesziel wählen:** drei Karten nebeneinander auf allen Geräten, die ganze Karte ist der Knopf ("Nehmen" steht unten auf der Karte), kurze Belohnung auf der Karte (voller Text im Titel), Wochenziel in einer Zeile.
- **Bootskarte (Handy):** kleinere Schilder und Überschrift, der Satz "Zieh das Boot hin oder lass es einfahren" entfällt (der Einstieg erklärt das). Handy quer: Karte nur so hoch wie der Inhalt, die Knöpfe bleiben beim Scrollen unten sichtbar (vorher abgeschnitten).
- **Tafeln links (Handy):** Wetter als Raster zwei mal zwei, engere Zeilen in Tagesziel und Ausbau-Ziel.
- **Baumenü (Handy):** Kreuz oben statt Zeile "Schließen" unten, hochkant höchstens 52 % der Höhe.
- **"Als Nächstes":** schmaler und kleiner.

Bewusst groß bleiben Spielstand, Gästebuch, Tastenhilfe und die Aufstiegsfeier (sie halten das Spiel an und
brauchen den ganzen Bildschirm) sowie Hilfe und Einstellungen. Nächste Kandidaten: Einstellungen und Hilfe am Handy
(88 und 91 %), Tagesabschluss am Handy (55 %).

## Selbst messen

```bash
bash tools/build-pages.sh
(cd tests && node server.mjs 4180 &)
node tools/verdeckung/messen.cjs nachher
```

Nur einzelne Geräte oder Menüs: `node tools/verdeckung/messen.cjs nachher handy,pc tagesziel-wahl,bootskarte`.
Bildschirmfotos und `messung.json` landen im angegebenen Ordner. Tabelle aus zwei Ordnern `vorher/` und `nachher/`:
`python3 tools/verdeckung/tabelle.py` (im Ordner, der beide enthält).
