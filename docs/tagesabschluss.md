# Tagesabschluss

Stand: 13.11.2026, Paket P15 (Ü22, Svc F4). Status: erledigt (PR 159).

## Was der Spieler sieht

- Am Ende jedes Tages erscheint oben in der Mitte eine kleine Karte "Tag n geschafft" mit der Tagessumme.
- Einnahmen je Quelle: Liegegeld (aufgeteilt in selbst eingestrichen, beim Rundgang, über Nacht, Trinkgeld für den Kassierstrich), Pacht, Gastronomie, Services (die drei stärksten Anlagen mit Namen), Tagesziele (erfüllt von gesamt), Sonstiges.
- Ausgaben des Tages (Bauen, Ausbau) und der Saldo der Kasse.
- Boote: angelegt, abgereist mit Schnitt der Bewertung, weitergefahren mit Grund (Wartebojen voll, zu lange gewartet, abends ohne Platz, weggeschickt). Ruf vorher und nachher.
- Die letzten sieben Tage als Säulen, der beste Tag in Gold. "Rekord", wenn der Tag den besten bisher schlägt.
- Ein Hinweis, was morgen mehr bringt (liegen gebliebenes Liegegeld, fehlende Plätze, zu langes Warten, schlechte Bewertungen, Tagesziele).
- Die Karte schließt nach 14 Sekunden echter Zeit von selbst, solange man sie nicht anfasst. Häkchen "Jeden Abend zeigen" aus: dann nur ein kleiner Zettel mit der Summe, Antippen öffnet die Karte. Während des Einstiegs kommt immer nur der Zettel.
- Menü, "Tagesabschluss": öffnet den letzten Abschluss, mit den Pfeilen blättert man durch die letzten 30 Tage und bis zum laufenden Tag ("bis jetzt").
- Münzen über Gebäuden: Rechnen die Services zu Beginn des Abends ab, steigt über jeder Anlage eine Münze mit dem Betrag auf.

## Technik

- `web/js/sim.js`: `addIncome(state, betrag, quelle, detail)` und `spend(state, betrag, zweck)` buchen in `state.stats.heute`. Quellen: `sim.QUELLEN`. Nachts baut `sim.tagesbericht(state, ctx)` den Bericht, er kommt mit dem Ereignis `dayEnd` (`e.bericht`) und landet in `state.stats.verlauf` (höchstens `VERLAUF_TAGE` = 30). Bester Tag: `state.stats.besterTag { tag, summe }`.
- `web/js/bridge.js`: `game.sim.addIncome(betrag, quelle, detail)`, `game.sim.spend(betrag, zweck)`, `game.sim.tagesbericht()`, `game.sim.verlauf()`. Services werden je Anlage gebucht (`services:abrechnung`).
- Andere Module geben beim Gutschreiben ihre Quelle an, zum Beispiel `game.sim.addIncome(50, 'pacht')`. Ohne Angabe landet der Betrag unter "Sonstiges".
- `web/js/ui/tagesabschluss.js`, `web/css/tagesabschluss.css`: Karte, Zettel, Münzen. Schnittstelle `game.tagesabschluss = { zeige(tag), schliesse(), offen() }`.
- Test: `tests/tagesabschluss.test.mjs`.

## Entscheidungen (Thread, Jorven schlief, 13.11.2026)

- Die Karte kommt am Ende der Nacht, wenn alles abgerechnet ist (auch der Rundgang und die Nachtkasse), nicht schon zu Beginn des Abends. Sonst wären die Zahlen unvollständig.
- Das Spiel läuft weiter, die Karte hält es nicht an. Bei 2 Minuten je Spieltag wäre ein Halt jeden Tag lästig. Wer sie nicht will, schaltet sie ab.
- "Rekord" erst ab Tag 2, wenn es einen Tag davor zu schlagen gab.
- Dauerlieger (P01): Saisonpacht im Voraus bucht `'pacht'` mit detail `'saison'`, die Rückzahlung beim Kündigen als Ausgabe `'pacht'`.
- Kassieren (P12): Nachtkasse bucht `'liegegeld'`/`'nacht'`, Rundgang `'rundgang'`, Trinkgeld `'strichtrinkgeld'`. Der Anteil beim Rundgang kommt aus `rules.uncollectedShare`, darum steht "halb" nicht mehr im Text.

## Handy (Nachbesserung nach dem Feature-Test, 13.11.2026)

- Am Handy (Breite unter 600 px oder Höhe unter 500 px) kommt von selbst nur der Zettel mit der Tagessumme. Die Karte öffnet sich erst auf Tippen und schließt nicht von selbst. So verdeckt sie nie Zeit, Kassieren oder Bauen, während das Spiel läuft.
- Der Zettel sitzt unter Statusleiste und Ereignis-Banner.
- Die Karte misst beim Öffnen den freien Platz: hochkant zwischen Statusleiste und Zeit/Kassieren/Bauen, quer zwischen Kasse/Zeit links, Bauen rechts und Kassieren unten. Die Schilder links (Wetter, Tagesziele, Ausbau) darf die offene Karte überdecken, sie zeigen nur etwas an.
- Reicht die Höhe nicht, wird die Karte kompakter (Klasse `eng`, dann `sehr-eng` ohne Säulen und Unterzeilen, zuletzt `ohne-tipp`), statt innen zu rollen.
- Blätterpfeile kommen aus `ui/pixel-symbole.js` (`pfeil`).

## Reihenfolge am Morgen (mit den Tageszielen, P13)

- `game.tagesabschluss.beschaeftigt()` ist true, solange Karte oder Zettel zu sehen sind. Sind beide weg, kommt `'tagesabschluss:fertig'`.
- Die Kartenwahl der Tagesziele wartet darauf: erst der Abschluss, dann die Wahl. `game.tagesabschluss.schliesse()` schließt Karte und Zettel, etwa wenn der Spieler vorher auf die Tafel tippt.
