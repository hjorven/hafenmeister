# Tagesabschluss

Stand: 12.11.2026, Paket P15 (Ü22, Svc F4). Status: in Arbeit, wartet auf Freigabe nach der Gelände-Überarbeitung.

## Was der Spieler sieht

- Am Ende jedes Tages erscheint oben in der Mitte eine kleine Karte "Tag n geschafft" mit der Tagessumme.
- Einnahmen je Quelle: Liegegeld (aufgeteilt in selbst eingestrichen, beim Rundgang halb, über Nacht halb), Pacht, Gastronomie, Services (die drei stärksten Anlagen mit Namen), Tagesziele (erfüllt von gesamt), Sonstiges.
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
