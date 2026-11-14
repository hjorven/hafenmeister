# Winter

Stand: 14.11.2026 (Roadmap-Paket P20, erster Teil: G4, F14, I10, Ü19). Code: `web/js/features/winter.js`, Aussehen: `web/css/winter.css`, Zahlen: `ECONOMY.winterarbeiten` in `web/js/data/economy.js`, Tests: `tests/winter.test.mjs`, `tests/specs/winter.spec.mjs`.

Eine Saison hat 30 Spieltage, danach kommen 3 Wintertage ohne Gäste. Bisher hat man den Winter nur vorgespult. Jetzt ist er die Zeit zum Planen.

## Winterpause

Am ersten Wintertag kommt von selbst die Karte „Winterpause, Jahr N“ (nach dem Tagesabschluss, siehe [Meldungs-Ordnung](meldungen.md), Vorrang 75). Im Winter steht links der Knopf „Winterpause“, der sie wieder öffnet.

| Teil | Inhalt |
|---|---|
| Saison N | Einnahmen (ohne Geschenke), Ausgaben, Gäste angelegt, Bewertung im Schnitt, weitergefahrene Boote, Ruf vorher und nachher, bester Tag. Aus `state.stats.verlauf` (die letzten 30 Tage, also genau eine Saison). |
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
| Hafenbecken ausbaggern | ab Stufe 3 (gerade Jahre) | Boote der Größe L und XL kommen 25 % öfter | `modifiers.sizeFactor` |

Preise je Ausbaustufe in `ECONOMY.winterarbeiten` (Stufe 1: 40 bis 60 €, Stufe 6: 3.600 bis 6.800 €). Am ersten Saisontag zeigt eine kleine Karte „Winterarbeiten fertig“, was jetzt wirkt (20 s, gezählt nur, solange sie zu sehen ist; die Kartenwahl der Tagesziele geht vor).

Neuer Hook in `sim.js`: `rating` fn({ ctx, boat }) gibt Anker zurück, die zur Platzart einer Bewertung dazukommen. Er wirkt auch in der Vorschau beim Zuweisen.

## Spielstand

`state.modules.winter = { auftraege: [{ id, steg?, fuer, kosten, name }], gesehen, fruehling }`. `fuer` ist die Saison (Jahr), in der ein Auftrag wirkt; der Frühling räumt ältere weg. `gesehen` und `fruehling` merken, für welches Jahr die Karten schon kamen. Ältere Spielstände ohne Eintrag brauchen keine Umstellung. Wer einen Spielstand mitten im Winter lädt, bekommt die Karte einmal.

## Schnittstelle

`game.winter = { oeffnen(), schliessen(), offen(), springt, angebote(), auftraege() }`. `springt` ist wahr, solange „Winter überspringen“ läuft (der Tagesabschluss fragt danach). Ereignisse: `winter:auftrag { id, kosten }`, `winter:uebersprungen { jahr }`.

## Randfälle

- Tagesabschluss, Feier und Kartenwahl gehen vor; die Winterkarte wartet ausgeblendet.
- Die Karte endet über Zeit, Kassieren und Bauen (Höhe wird gemessen); im flachen Querformat steht sie rechts und lässt die linke Spalte frei.
- Im Baumodus und Fotomodus ist sie ausgeblendet.
- Ein Ausbau im Winter ändert die Preise der noch offenen Aufträge, beauftragte bleiben, wie sie sind.
- Liegt die Zeit still (Pause), kommt die Karte trotzdem, sobald der Winter da ist.

## Noch offen in P20

- F15, H5: Krantage, Dauerlieger sichtbar ins Winterlager und zurück, im Winter an Land.
- G5: Jahreszeiten spürbar (Frühling ruhig, Sommer voll, Herbst Wind); das sind Zahlen und kommt mit dem Balancing nach dem Stau-Fix der Boote.
