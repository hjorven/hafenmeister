# Bewertungen und Gästebuch

Roadmap-Paket P14 (Ü21, F18, C1, C9). Code: `web/js/ui/gaestebuch.js` (Oberfläche), `web/js/ui/gaestebuch-daten.js` (Daten und Texte, ohne Browser), `web/css/gaestebuch.css`. Tests: `tests/gaestebuch.test.mjs`.

## Was der Spieler sieht

**Blase beim Ablegen.** Legt ein Gast ab, steht über seinem Boot für etwa vier Sekunden ein Pixel-Schild mit Stern und Note, zum Beispiel `4,5`. Zufriedene Gäste (ab 4 Sternen) haben einen goldenen Rahmen. Unzufriedene einen hellroten, und daneben steht das Symbol dessen, was gefehlt hat, mit rotem Schrägstrich: WC, Dusche, Essen, Strom, Diesel, Sturm, Umbau oder Warten. Dazu klingt der Ton „Bewertung“ (höchstens einmal je 0,7 s).

- Legen viele Boote zugleich ab (morgens, Tempo 8x), erscheinen die Blasen nacheinander (alle 0,26 s eine) und weichen sich nach oben aus, statt sich zu überdecken.
- Ist das Boot nicht im Bild, kommt rechts oben unter Übersicht und Menü eine kleine Meldung mit Note, Symbol und Bootsname (höchstens drei, je 3,6 s). Antippen öffnet das Gästebuch.
- Abgewiesene oder weggeschickte Boote, die eine Note abgeben, zeigen sie genauso.
- Im Fotomodus und bei offenem Gästebuch sind Blasen und Meldungen aus.

**Gästebuch.** Öffnen: Ruf oben links antippen, Menü „Gästebuch“, Hafenmeister-Haus oder Hafenbüro antippen, am PC Taste `G`. Schließen: X, `Esc`, daneben tippen.

- Ruf groß mit Stern, daneben der Verlauf der letzten 30 Tage als Säulen (grün ab 4, gelb ab 3, rot darunter, gestrichelte Linie bei 4).
- „Was Gästen gefehlt hat“: die drei häufigsten Gründe der unzufriedenen Gäste unter den letzten 20, jeweils „n von 20“ und ein Knopf, der das passende Bauwerk im Baumenü zeigt (`game.bauen.vorschau('versorgung:<wunsch>')`), oder ab welcher Stufe es das gibt.
- Die letzten 20 Bewertungen, also genau die, aus denen der Ruf besteht: Note, Bootsname und Heimathafen, Tag, Platz, ein Satz des Gastes und darunter, warum (zum Beispiel „keine Dusche (2 Nächte) · bequemer Liegeplatz +0,5“).

Am Handy hochkant kommt das Gästebuch als Blatt von unten, quer und am PC als Tafel in der Mitte.

## Wie eine Note entsteht

In `sim.js`, `ratingParts(ctx, boat, ratingBonus)` (dieselbe Rechnung wie `rateBoat`):

| Teil | Wert | Zahl in `economy.js` |
|---|---|---|
| Wünsche | keiner erfüllt 2,5, alle erfüllt 5, dazwischen linear nach erfüllten Wunsch-Nächten; ohne Wünsche 4 | `ruf.wunschNote`, `ruf.ohneWunsch` |
| Platz | Komfort der Platzart (Fingersteg +0,5) | `platzarten.*.rufBonus` |
| passgenau | +0,25 | `passgenau.ruf` |
| von Hand eingewiesen | +0,25 | `hafenbuero.vonHandBonus` |
| Sondergast | +1 | `ruf.sondergastBonus` |
| Services, Ereignisse | `ratingBonus` der Modifikatoren | `services`, `events` |
| Sturm an ungeschütztem Platz | Abzug | `events` |

Begrenzt auf 1 bis 5, auf eine Stelle gerundet.

**Entscheidung (P14, Befund aus P10):** Vorher galt `1 + 4 × Anteil`. Ein Gast mit Platz, aber ohne seinen einen Wunsch, gab dann 1 Stern, also weniger als ein abgewiesener Gast (2,5). Jetzt liegt „keiner erfüllt“ genau bei der Note des Abgewiesenen: Wer einen Platz bekam, ist nie unzufriedener als wer weggeschickt wurde. Fehlende Wünsche drücken weiter deutlich (halb erfüllt 3,75 statt 5), Sturm und Abzüge können unter 2,5 führen.

## Schnittstelle

- Ereignisse der Regeln: `sim:departed` trägt `parts` (siehe oben, mit `missed: { wunsch: Nächte ohne }`), `guest` (`typeId, modelId, name, size, kind`, dazu `bootsname, heimathafen, stammId, besuche`, falls gesetzt) und `day`. `sim:turnedAway` und `sim:dismissed` tragen bei `rated` auch `rating`, `guest` und `day`.
- `boat.missed` zählt je Wunsch die Nächte ohne (in `chargeFee`).
- Spielstand: `state.modules.gaestebuch = { eintraege: [...], verlauf: [{ tag, ruf }] }`, neueste Einträge zuerst, höchstens 20 (wie `ruf.fenster`), Verlauf höchstens 30 Tage.
- `game.gaestebuch = { oeffnen(), schliessen(), offen, eintraege(), topGruende() }`.
- Ereignis `gaestebuch:bewertung { id, note, grund, zufrieden, imBild }`, sobald eine Blase oder Meldung erscheint (für den Einstieg, Schritt „erste Bewertung erklären“).

## Grenzen

- Die fünf Startbewertungen zählen zum Ruf, stehen aber nicht im Gästebuch: In den ersten Tagen hat das Gästebuch weniger als 20 Einträge.
- Sätze wählt ein fester Zufall aus Boots-id und Tag, nicht der Würfel der Spielregeln: Spielstände bleiben gleich, ob das Gästebuch offen ist oder nicht.
