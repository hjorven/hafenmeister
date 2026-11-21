# Wind im Hafen (P34)

Paket P34 aus der [Roadmap](roadmap.md), Features F5 (Windseite) und F35 (Wind beim Anlegen). Zahlen stehen in `web/js/data/economy.js` unter `wind` und in [zahlen.md](zahlen.md).

## Was der Spieler merkt

- **Wetterbericht:** Ab frischem Wind steht die Richtung dabei („Starkwind aus Nordwest“). An Starkwindtagen sagt der Bericht, was das heißt: offene Plätze werden unruhig, geschützte Boxen bringen Anker. Weil der Bericht drei Tage vorausschaut, kann man planen.
- **Ansage am Morgen:** Am ersten Starkwindtag einer Wetterlage (oder wenn der Wind um 45 Grad oder mehr dreht) kommt eine Ansage im Meldeplatz. An Folgetagen mit gleicher Lage nicht noch einmal.
- **Beim Ziehen eines Boots:** Über den passenden Boxen stehen kleine Pixel-Schilder. Schild = geschützt, Welle = offen und unruhig, Windlinien = für große Boote Wind von achtern. Die Bootskarte erklärt die Zeichen in einem Satz.
- **Im Bild:** Boote krängen und schwojen in Windrichtung (Bojen, Ankerfeld, Regattakurs), der Seegang wächst mit dem Wind, draußen schaukeln die Boote stärker als hinter Mole und Land. Die Wellenstriche im Wasser laufen mit dem Wind, der Windsack am Flaggenmast zeigt nach Lee.
- **Gästebuch:** „unruhig im Wind gelegen −0,5“, „Anleger mit Rückenwind −0,25“, „ruhig gelegen trotz Starkwind +0,5“, mit eigenen Sätzen der Gäste.

## Regeln

**Richtung.** `world/wind.js windRichtung(seed, tag)`: Grad, aus der der Wind kommt (0 Ost, 90 Nord, 180 West, 270 Süd, wie `boat-anim setWind`). Eine Wetterlage hält `wetterlageTage` Tage, jeder Tag dreht bis `streuung` Grad weg. Verteilung nach `richtungen` (meist West bis Südwest), Sturm kommt aus `sturmAus`. Die Stärke bleibt wie bisher das Wetter des Tages (`zeit.jahreszeitWirkung.wind`, Ereignisse). `events/scheduler.js weather()` trägt beides, auch für die Vorhersage.

**Starkwind** ab Windstärke `stark` (0,55). Im Sommer selten (nur an Ereignistagen wie Regatta), im Frühling etwa jeder dritte Tag, im Herbst die meisten Tage.

**Windlage eines Platzes (F5).** Wellenweg = Meter freies Wasser vom Platz gegen den Wind (Fächer aus fünf Strahlen ±20 Grad), bis Land, Mole, Wellenbrecher, Kai oder Pier kommen. Holz- und Schwimmstege halten Wellen nur zum Teil auf: jeder Steg dazwischen zählt den Rest nur noch zu `stegDaempfung`. Ab `offenAb` Metern liegt ein Platz offen, bis `geschuetztBis` geschützt, dazwischen normal. Die Lage hängt also von der Geländeform, der Stufe (Molen ab Stufe 3) und der Windrichtung des Tages ab: Bei Westwind ist eine andere Seite unruhig als bei Ostwind.

**Bewertung.** Bei Starkwind, ab Stufe `abStufe` (am Badesteg liegt sowieso alles offen) und nicht am Sturmtag (dort gilt das Sturm-Ereignis mit seinen festen offenen Plätzen): Jeder liegende Gast merkt sich seine Lage (`boat.windLage`). Die letzte Lage bei Starkwind zählt, wer aus dem offenen Platz verholt wird, liegt danach ruhig. Beim Ablegen gibt `offen` `unruhig` Anker weniger, `geschuetzt` `geschuetzt` Anker mehr (`sim.windRating`, Teil `wind` in `ratingParts`). Dauerlieger und Boote auf Tagestörn zählen nicht.

**Große Boote (F35).** Klassen `grosse` (L, XL). Macht ein solches Boot bei Starkwind mit dem Wind von achtern fest (Kosinus zwischen Bug und Windrichtung unter `rueckenwindAb`), legt es mit `anlegenTempo` an (langsamer, die letzten Meter mit Querstrahlruder ebenso) und gibt `rueckenwind` Anker weniger (`boat.windRuecken`). Mit dem Bug gegen den Wind (ab `gegenWindAb`) geht es leicht, dazwischen wird das Tempo stufenlos kleiner.

**Platzwahl.** Büro-Vorschlag, Leitstelle und „Einfahren lassen“ nutzen den Hook `score`: geschützt `wahl.geschuetzt`, offen `wahl.offen`, große Boote mit dem Bug gegen den Wind `wahl.gegenWind` (mit Wind von achtern ebenso viel weniger). Das liegt unter einem erfüllten Wunsch (1000) und in der Größenordnung des Komforts eines Fingerstegs (50).

## Dateien

| Datei | Inhalt |
|---|---|
| `web/js/world/wind.js` | reine Rechnung: Richtung je Tag, Raster, Wellenweg, Windlage, Bug zum Wind |
| `web/js/features/wind-regeln.js` | Regeln ohne Browser: Tick (Lage und Rückenwind merken), Platzwahl, Zeichen, Anlegetempo |
| `web/js/features/wind.js` | Modul im Spiel: Raster aus Gelände, Molen und Stegen, Wind in Bild und Wasser, Zeichen beim Ziehen, Ansage, `game.wind` |
| `web/js/sim.js` | `windRating`, Teil `wind` in `ratingParts` |
| `web/js/events/scheduler.js` | `weather().richtung` |
| `web/js/render/boat-anim.js` | `setAnlegeFaktor` (Tempo beim Anlegen) |
| `web/js/render/landschaft/wasser.js` | `setzeWindRichtung` (Wellenstriche) |
| `web/js/features/wetterflagge.js` | Windsack nach Lee |
| `web/js/events/banner.js` | Richtung und Satz im Wetterbericht, `game.banner.zeige` |
| `web/js/ui/gaestebuch-daten.js` | Gründe `unruhig`, `rueckenwind`, Plus `windgeschuetzt` |
| `tests/wind.test.mjs` | Richtung, Wellenweg, Regeln, Platzwahl, Gästebuch |

## Schnittstelle

`game.wind = { heute, stark(), lage(platzId) -> { weg, lage }, lagen(), bug(platzId), zeichen(bootId, platzId), zeichenImBild, kartenSatz(boot), berichtSatz(wx) }`

Spielstand: `boat.windLage`, `boat.windRuecken`, `boat.windBox` am Boot; `state.modules.wind.gesagt = { tag, richtung }` für die Ansage. Keine Migration nötig: alte Spielstände haben die Felder nicht, das heißt „nichts erlebt“.

## Zusammenspiel und Grenzen

- **Sturm-Ereignis:** nutzt weiter die festen offenen Platzarten (Stirn, Kai, `platzarten.offen`) mit `satisfaction.outer` und dem Sturmklar-Machen. Die Windlage zählt am Sturmtag nicht, damit es keinen doppelten Abzug gibt. Rückenwind beim Anlegen gilt auch im Sturm.
- **Päckchen:** Päckchenplätze haben keine eigene Windlage.
- **Balancing:** `tools/balance.mjs` rechnet ohne Gelände und damit ohne Windlage. Im Spiel gleichen sich Abzug und Bonus über die Küsten ungefähr aus (Schwellen über die Küsten 1 bis 10 in Stufe 2, 4 und 6 gemessen, gewichtet nach Windrichtung: im Mittel liegt je ein Viertel der Gastplätze offen und geschützt).
- **Seegang:** `setSea` und `setShelter` werden jetzt erstmals vom Spiel gesetzt (vorher fester Wert und Platzhalter-Schutz).
