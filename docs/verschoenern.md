# Hafen verschönern (P60, D8)

Stand: 22.11.2026. Status: gebaut. Paket P60 aus der [Roadmap](roadmap.md), Welle 4.

Im Baumenü gibt es einen fünften Reiter **Deko**. Dort kauft man Bänke, Blumenkübel, Bäume, Laternen und einen Anstrich für die Hafenhäuser. Jede Verschönerung hebt die Bewertung aller Gäste ein wenig, und man sieht sie im Hafen: Leute setzen sich auf die Bänke, die Laternen gehen abends an, die Bäume wachsen und tragen Laub je Jahreszeit.

## So spielt es sich

| Art | Abschnitte (Stück, ab Stufe, Preis) | Wo sie stehen | Was man sieht |
|---|---|---|---|
| Bänke am Wasser | 2 ab 1 (40 €), 3 ab 3 (650 €), 3 ab 5 (3.400 €) | 1,5 bis 12 m vom Wasser, ab Stufe 3 am Rand der Promenade, mit Blick aufs Wasser | Leute aus dem Ort und Crews setzen sich darauf (Ziel `bank` der Menschen) |
| Blumenkübel | 3 ab 1 (30 €), 4 ab 3 (480 €), 4 ab 5 (2.700 €) | dicht an Hafengebäuden und Wegen | Holzkübel mit bunten Blüten, im Winter Tannengrün |
| Bäume | 3 ab 2 (180 €), 4 ab 4 (1.600 €), 4 ab 6 (4.800 €) | 1 bis 7 m neben Wegen, mindestens 6 m vom Wasser, nie auf der Promenade | wachsen in 3 Spieltagen zur vollen Größe, Laub hellgrün, grün, orange, im Winter kahl |
| Laternen am Weg | 3 ab 2 (240 €), 4 ab 4 (1.900 €), 4 ab 6 (5.200 €) | dicht neben Wegen und der Promenade, 14 m auseinander, Lampe zum Weg | leuchten abends und nachts, warmer Lichtkreis am Boden |
| Hafenhäuser streichen | einmal je Saison, ab Stufe 2 (60 bis 4.500 € je Stufe) | alle Hafengebäude (nicht Wohnhäuser, Speicher, Molenfeuer) | fünf Farben: Schwedenrot, Friesenblau, Kalkweiß, Ockergelb, Salbeigrün |

- **Vorschau:** Eintrag antippen. Die Kamera fährt hin, die neuen Stücke stehen gelb als Geisterbild an ihrem Platz, über jedem schwebt eine gelbe Raute (kleine Stücke sieht man von oben sonst kaum). Beim Anstrich wählt man die Farbe in der Karte, die Häuser zeigen sie sofort; „Zurück“ stellt die alte Farbe wieder her.
- **Bestätigen:** „Bauen für …“ kauft. Die Stücke hüpfen an ihren Platz, „Rückgängig (10 s)“ nimmt den Kauf zurück wie bei allem im Baumenü.
- **Der nächste Abschnitt** steht schon eine Stufe vorher gesperrt da („ab Ausbaustufe 3“).
- **Als Nächstes:** Fehlt für die Ausbaustufe nur noch Ruf, schlägt der Hinweis auch Deko vor („Blumenkübel heben die Bewertungen“, wie die Steglaternen). Einen neuen Anstrich schlägt er nie vor.

## Wirkung auf den Ruf

- Jeder gebaute Abschnitt hebt die Bewertung jedes Gastes um **0,03 Anker** (`ECONOMY.verschoenern.anker`), der erste Anstrich um **0,04** (`anstrich.anker`). Alles gebaut: 12 Abschnitte und Anstrich, zusammen 0,4 Anker.
- Ein neuer Anstrich in einer anderen Farbe wirkt nicht noch einmal, er ändert nur das Bild. Darum geht er nur einmal je Saison.
- Die Wirkung ist ein eigener Teil der Bewertung (`ratingParts().schoen`, Hook `schoen` der Spielregeln) und steht im Gästebuch als „schöner Hafen“. Ab 0,15 Anker schreiben zufriedene Gäste auch mal „Ein richtig hübscher Hafen …“.
- Warum klein und für alle Gäste: Gäste bewerten den Gesamteindruck. Der Platz (Fingersteg +0,5, passgenau +0,25, von Hand eingewiesen +0,25) bleibt wichtiger als Deko, aber wer Geld übrig hat, kann damit den Ruf über die letzte Marke heben.

## Wo die Stücke stehen

`web/js/render/verschoenern-bild.js` sucht in einem 1,5-m-Raster auf der Hafenfläche (`HAFENFLAECHE`) nahe an dem, was steht: Stegwurzeln und Hafengebäude, im Umkreis 34 m (Stufe 1) bis 110 m (Stufe 6). Jedes Stück braucht trockenen, ebenen Boden und Abstand zu Gebäuden (auch noch nicht gekauften der Stufe), Bauplätzen der Angebote, Wegen, Stegen, Molen und den festen Laufwegen der Menschen. Promenade und Kai sind Plätze: Ihr Rand ist frei für Bänke, Kübel und Laternen, nur die Mitte bleibt zum Gehen.

Gesucht wird für alle Stücke, die die Stufe erlaubt, in fester Reihenfolge (Bänke, Laternen, Kübel, Bäume). Was schon gekauft ist, ändert also nie, wo die anderen stehen, und der nächste Abschnitt steht genau dort, wo die Vorschau ihn zeigt. Nach einem Stufenausbau (neue Wege, Promenade, Gebäude) wird neu gesucht; die Stücke ziehen dann mit um.

Gemessen auf allen 15 Küsten (Seed 1 und 2, Stufe 1 bis 6): Jede Küste hat für jedes Stück, das die Stufe erlaubt, einen Platz (siehe „Geprüft“).

## Zusammenspiel

- **Menschen:** Bänke sind Ziele (`ZIELE.bank`, sitzen auf 0,5 m Höhe mit Blick aufs Wasser, tagsüber). Bäume, Kübel und Laternen sind Hindernisse im Laufnetz (`render/people.js hindernisListe`). Nach jedem Kauf wird das Netz neu gebaut, ohne dass jemand springt (`game.people.netzErneuern`).
- **Deko der Tagesziele und Erfolge** (`features/ziel-deko.js`, Hafenmast aus P44): sucht ihren Platz nach der Verschönerung und weicht ihr aus.
- **Hafentiere** (P51): Bäume und Kübel stehen über das Laufnetz automatisch im Weg von Katze und Hund.
- **Lichterketten** (P46) hängen an den Stegen, die Steglaternen (P30) stehen auf den Stegen, die Laternen hier an Land. Keine Doppelung.
- **Mast:** Den Flaggenmast gibt es schon (P44 Hafenmast mit eigener Flagge, Wimpelmast der Tagesziele). P60 baut keinen weiteren.
- **Zeitraffer:** Der Spieler-Bot (`tools/zusammenspiel/kernschleife.cjs`) kauft auch Deko, aber zuletzt (Rang nach Hafen, Stegen, Versorgung, Angeboten).

## Gefunden, nicht in diesem Paket

- Kreativmodus (P45) kann hier anknüpfen: freie Plätze für einzelne Stücke statt der automatischen Suche.

## Zum Ausprobieren

`?stufe=3&verschoenern=alle` baut im Testmodus alles, was die Stufe erlaubt, `?verschoenern=1` je Art den ersten Abschnitt, `&anstrich=friesenblau` streicht gleich (ab Stufe 2). Mit `&gelaende=n&seed=s` auf einer festen Küste.

## Dateien und Zahlen

| Was | Wo |
|---|---|
| Zahlen | `ECONOMY.verschoenern` in `web/js/data/economy.js` |
| Regeln, Kauf, Spielstand (`state.modules.verschoenern`) | `web/js/features/verschoenern.js` |
| Modelle, Plätze, Geisterbild, Licht, Jahreszeit | `web/js/render/verschoenern-bild.js` |
| Anstrich der Gebäude | `web/js/render/buildings.js` (`anstrich`, `anstrichFuer`) |
| Baumenü, Reiter Deko, Farbwahl | `web/js/ui/bauen.js` |
| Bewertung | `web/js/sim.js` (`ratingParts().schoen`, Hook `schoen`) |
| Gästebuch | `web/js/ui/gaestebuch-daten.js` (`PLUS.schoen`, `SATZ.schoen`) |
| Bank als Ziel | `web/js/data/people.js` (`ZIELE.bank`), `web/js/render/people.js`, `web/js/people/netz.js` (`blick`) |
| Tests | `tests/verschoenern.test.mjs`, `tests/specs/verschoenern.spec.mjs` |

## Geprüft

- Platzsuche auf allen 15 Küsten, Seed 1 und Seed 2, jeweils Stufe 1 bis 6 mit `?verschoenern=alle`: 180 Fälle, jedes Stück, das die Stufe erlaubt, hat einen Platz an Land, jede Bank ist ein Ziel der Menschen, keine Fehler auf der Seite.
- Im Spiel auf Handy (iPhone 13) und PC angesehen: Reiter passen aufs Handy, Vorschau mit Geisterbild und Raute, Kauf, Rückgängig, Farbwahl, Bank mit sitzender Person, Laub im Herbst, kahle Bäume im Winter, Laternen nachts.
- `node --test tests/verschoenern.test.mjs` (9 Tests), `tests/specs/verschoenern.spec.mjs` auf PC und Handy, `bash tests/pruefen.sh --schnell`.
