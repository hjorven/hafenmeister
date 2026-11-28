# Winter

Stand: 15.11.2026 (Roadmap-Paket P20: G4, G5, F14, F15, H5, I10, Ü19; P20 ist fertig). Code: `web/js/features/winter.js`, Aussehen: `web/css/winter.css`, Zahlen: `ECONOMY.winterarbeiten` in `web/js/data/economy.js`, Tests: `tests/winter.test.mjs`, `tests/specs/winter.spec.mjs`.

Eine Saison hat 16 Spieltage, danach kommen 2 Wintertage ohne Gäste (P17). Bisher hat man den Winter nur vorgespult. Jetzt ist er die Zeit zum Planen, und die Jahreszeiten davor fühlen sich verschieden an.

## Winterpause

Am ersten Wintertag kommt von selbst die Karte „Winterpause, Jahr N“ (nach dem Tagesabschluss, siehe [Meldungs-Ordnung](meldungen.md), Vorrang 75). Im Winter steht links der Knopf „Winterpause“, der sie wieder öffnet.

| Teil | Inhalt |
|---|---|
| Saison N | Einnahmen (ohne Geschenke), Vergleich zur Saison davor in Prozent, ein Streifen mit den Einnahmen nach Quelle und Legende, Ausgaben, Gäste angelegt, Belegung im Schnitt mit vollen Nächten, Bewertung im Schnitt, weitergefahrene Boote, Ruf vorher und nachher, bester Tag, Knopf „Statistik der letzten 30 Tage“. Die Bilanz wird in der Nacht des letzten Saisontags gemerkt (`state.modules.statistik.saisons`, P41, siehe [Statistik](statistik.md)), damit sie auch am zweiten und dritten Wintertag vollständig ist; fehlt sie (alter Spielstand), wird sie aus `state.stats.verlauf` gerechnet. |
| Winterarbeiten | Zwei oder drei Aufträge zur Wahl, je mit Preis und Wirkung. „Beauftragen für …“ bucht die Ausgabe sofort (im Tagesabschluss „Winterarbeiten“). Jeder Auftrag geht einmal pro Winter. |
| Nächste Saison | Nächster Ausbau, Dauerlieger mit Vertrag, welcher Wintertag ist. |
| Knöpfe | „Winter überspringen“ spult bis zum ersten Frühlingsmorgen vor (Ü19). Die Nächte laufen ganz normal, Winterlager und Werft verdienen, nur der Tagesabschluss bleibt für die Wintertage still. „Hafen ansehen“ schließt die Karte. |

## Winterarbeiten

Alle wirken die ganze nächste Saison (die Frühjahrswerbung nur im Frühling) und laufen über die Hooks der Spielregeln, also auch in Simulationen.

| Auftrag | Wann angeboten | Wirkung | Hook |
|---|---|---|---|
| Steg überholen | immer (Steg mit Gastplätzen; wechselt jährlich zwischen den zwei größten) | Gäste an diesem Steg bewerten 0,3 Anker besser | `rating` (zählt zur Platzart, `comfort`) |
| Frühjahrswerbung in Segelvereinen | immer | Saisontag 1 bis 8: 25 % mehr Boote | `modifiers.arrivalFactor` |
| Sanitär winterfest machen | wenn Toilette oder Dusche steht; ab Stufe 3 im Wechsel mit Baggern (ungerade Jahre) | Gäste mit Wunsch Toilette oder Dusche bewerten 0,2 Anker besser | `rating` |
| Fahrrinne ausbaggern | ab Stufe 3 (gerade Jahre) | Boote der Größe L und XL kommen 25 % öfter | `modifiers.sizeFactor` |

Preise je Ausbaustufe in `ECONOMY.winterarbeiten` (Stufe 1: 40 bis 60 €, Stufe 6: 3.600 bis 6.800 €). Am ersten Saisontag zeigt eine kleine Karte „Winterarbeiten fertig“, was jetzt wirkt (20 s, gezählt nur, solange sie zu sehen ist; die Kartenwahl der Tagesziele geht vor).

Neuer Hook in `sim.js`: `rating` fn({ ctx, boat }) gibt Anker zurück, die zur Platzart einer Bewertung dazukommen. Er wirkt auch in der Vorschau beim Zuweisen.

## Krantage

Am Saisonende gehen die Dauerlieger ins Winterlager (F15, H5): In der Nacht zum ersten Wintertag verlassen alle, die nicht gekündigt haben, ihre Box. Morgens legen sie nacheinander ab (gemeinsamer Ablegetakt der Boote) und fahren hinaus; die Box bleibt ihre. In der Nacht vor dem ersten Saisontag kommen sie zurück und legen morgens wieder an, noch bevor die ersten Gäste kommen. Wer gerade auf Törn ist, bleibt gleich bis zum Frühling weg. Gekündigte verlassen den Hafen wie bisher ganz.

- Regeln in `features/dauerlieger.js` (Hook `night`): Platz bekommt `winterlager: true`, das Boot steht wie bei einem Törn in `p.boot`, `rueckNacht` ist der letzte Wintertag. Ereignisse `dauerAuslaufen`/`dauerEinlaufen` tragen `winterlager: true`.
- Die Winterpause nennt, wie viele Boote im Winterlager liegen.
- Wer im Winter einen Dauerplatz vermietet, dessen Boot bleibt bis zum Frühling im Hafen.
- Ein gebautes Winterlager zeigt Boote auf Böcken unter Planen, der Travellift hebt Boote (beides aus `render/services-models.js`).

## Spielstand

`state.modules.winter = { auftraege: [{ id, steg?, fuer, kosten, name }], gesehen, fruehling }`. `fuer` ist die Saison (Jahr), in der ein Auftrag wirkt; der Frühling räumt ältere weg. `gesehen` und `fruehling` merken, für welches Jahr die Karten schon kamen. Ältere Spielstände ohne Eintrag brauchen keine Umstellung. Wer einen Spielstand mitten im Winter lädt, bekommt die Karte einmal.

## Schnittstelle

`game.winter = { oeffnen(), schliessen(), offen(), springt, angebote(), auftraege() }`. `springt` ist wahr, solange „Winter überspringen“ läuft (der Tagesabschluss fragt danach). Ereignisse: `winter:auftrag { id, kosten }`, `winter:uebersprungen { jahr }`.

## Randfälle

- Tagesabschluss, Feier und Kartenwahl gehen vor; die Winterkarte wartet ausgeblendet.
- Die Karte endet über Zeit, Kassieren und Bauen und beginnt unter den Knöpfen oben (Übersicht, Menü; beides wird gemessen). Im flachen Querformat steht sie rechts und lässt die linke Spalte frei.
- Ist sie höher als der Platz, bleiben „Winter überspringen“ und „Hafen ansehen“ unten stehen; darüber steht „Weiter unten mehr“ (am Handy „nach oben wischen“, mit Maus „bitte scrollen“), bis ganz nach unten gescrollt ist. Im flachen Querformat genauso, die Knöpfe kompakt in einer Zeile.
- Im Winter stehen an den Gastboxen keine Grün-Rot-Schilder (`features/platzschilder.js`). Das Ereignis-Banner zeigt für Winter und Frühling nichts, das macht die Winterkarte.
- Im Baumodus und Fotomodus ist sie ausgeblendet.
- Ein Ausbau im Winter ändert die Preise der noch offenen Aufträge, beauftragte bleiben, wie sie sind.
- Liegt die Zeit still (Pause), kommt die Karte trotzdem, sobald der Winter da ist.

## Jahreszeiten (G5)

Frühling (Saisontag 1 bis 4), Sommer (5 bis 12) und Herbst (13 bis 16) wirken auf die Ankünfte wie ein Modifikator, bevor Ereignisse und Services dazukommen (`sim.seasonEffect`, Zahlen in `ECONOMY.zeit.jahreszeitWirkung`):

| Jahreszeit | Ankünfte | Bootsmischung | Wind im Alltagswetter |
|---|---|---|---|
| Frühling | 0,8 | weniger Jollen (0,6) | +0,15 |
| Sommer | 1,2 | mehr kleine Boote (S 1,25) | +0 |
| Herbst | 0,9 | weniger kleine Boote (S 0,8), weniger Jollen (0,5), mehr Segelyachten (1,5): die letzten Fahrtensegler | +0,3 |

Im Mittel über die Saison kommen etwa so viele Boote wie vorher (1,025); weil im Sommer nicht jedes Boot einen Platz findet, dauert der Aufstieg in der Rechnung 105 statt 103 Spieltage (`node tools/balance.mjs --spieler zeitraffer`). Beim Wechsel in den Sommer sagt das Banner „Hochsaison“, beim Wechsel in den Herbst „Herbst: mehr Wind, weniger Boote“ (nicht beim Laden). Wind, Wolken und Laub folgen der Jahreszeit schon länger (`events/scheduler.js`, `render/landschaft/`). Der Wetterbericht zählt „Tag n von 16“.

## Dauerlieger nutzen den Hafen (H5)

Dauerlieger bringen den Services Arbeit (Zahlen als `dauerlieger` in `ECONOMY.services`, Regeln in `services/rules.js`):

- **Krantage** (erster und letzter Saisontag): Am Mastenkran stellt bzw. legt jeder segelnde Dauerlieger seinen Mast (45 €), der Travellift holt jedes Boot heraus bzw. setzt es ein (60 €, Werfthalle 70 €). Wer gekündigt hat, geht im Herbst nicht ins Winterlager. Abends sagt ein Banner „Krantag: n Dauerlieger sind wieder im Wasser“ bzw. „gehen an Land“ mit dem Betrag.
- **Segelmacher**: Jeder segelnde Dauerlieger im Hafen bringt mit Anteil 0,1 (Segelloft 0,12) am Tag einen Auftrag (90 bzw. 120 €).
- **Winterlager**: je Dauerlieger an Land und Wintertag 50 € (Halle 80 €), zusätzlich zum festen Wintergeschäft.

Die Service-Karte zeigt die Aufträge im Abschnitt „Zuletzt“ (zum Beispiel „Krantag: 6 Dauerlieger“). Die Tagesdaten bekommen dafür `dauerlieger: [{ klasse, antrieb, imHafen, winterlager, kuendigung }]`, `saisonTag` und `saisonTage` (`render/services.js`). Tests: `tests/jahreszeiten.test.mjs`.
