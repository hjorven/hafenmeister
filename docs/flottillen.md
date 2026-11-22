# Flottillen (Paket P32)

Stand: 21.11.2026. Status: gebaut (Roadmap F3, M3b, P32).

Drei bis fünf Boote einer Art kommen zusammen und wollen am selben Steg liegen: ein Segelverein auf Geschwaderfahrt, eine Charterflottille, ein Klassikertreffen. Wer sie zusammenlegt, bekommt bessere Bewertungen; wer sie aufteilt oder ein Boot wegschickt, schlechtere.

## Im Spiel

- **Wann:** ab Stufe 3, an rund 15 bis 25 Prozent der Tage (je Stufe, `economy.flottillen.anteil`), nie am ersten Spieltag und nie im Winter. Höchstens eine Flottille am Tag.
- **Wer:** Bootsarten mit `group` bis mindestens 3 in `data/boats/*.js` (S2 Kanus, M1 Kleinkreuzer, M2 Holzboote, M3 Kajütboote, L1 Charteryachten, L3 Motoryachten). Anlass und Name stehen in `data/flottillen.js`. Charterflotten und Kanugruppen fahren dasselbe Modell, Vereine gemischte Boote derselben Art. Die Gruppe ist höchstens so groß, wie der beste Steg passende Boxen hat (mindestens 3).
- **Anfahrt:** alle aus derselben Richtung im Konvoi, 2,5 Sekunden Abstand in den Regeln (`abstand`), 2,4 Sekunden auf dem Wasser. Die Einbahn der Einfahrt (P66) lässt eine Flottille als Ganzes durch (bis 5 über `maxKonvoi`). Die Flottille ersetzt Boote des Tages, es kommen nicht mehr Gäste.
- **Anzeige:** Vorschauleiste eine Karte „Flottille ×N“, Bootskarte mit Anlass und Namen, Hinweis in Gold „N gold an Steg C“, Boxen am Wunschsteg leuchten gold beim Ziehen. Das Schild am Platz zeigt „Flottille zusammen +0,5“ oder rot „Flottille getrennt: −0,5 Anker“.
- **Funk:** Mit Hafenbüro meldet sich eine Flottille immer als Gruppe an: „Steg D frei halten (4 Boxen)?“ hält alle Boxen auf einmal, „Anderer“ wählt einen anderen Steg, „Nein“ lässt sie normal kommen. Frei gehaltene Boote fahren direkt in ihre Box und zahlen den Funk-Bonus je Boot.
- **Selbst einfahren und Büro:** Wer nach 8 Sekunden selbst fährt, sucht zuerst den Steg der Gruppe. Das Büro schlägt eine Box vor (Sonderfall „Flottille“), weist aber nicht selbst zu: die Entscheidung bleibt beim Spieler.
- **Bewertung:** Nachts merkt sich jede Crew, ob alle an einem Steg liegen: `zusammen` +0,5 Anker, `getrennt` −0,5 Anker auf ihre Bewertung. Wird ein Boot weggeschickt oder fährt ohne Platz weiter, gilt die Gruppe als zerrissen.
- **Volle Bojen:** Findet ein Boot der Flottille keine freie Warteboje, legt es sich an eine belegte Boje dazu statt abzudrehen.

## Schnittstellen

- Boot: `boat.flotte = { id, name, n, nr, art, palette, zusammen?, zerrissen? }` (nur am Boot, deshalb kein neuer `SAVE_VERSION`).
- `sim.js`: `flotillaState`, `flotillaMembers`, `flotillaIds`, `flotillaTargets`, `flotillaReservable`, `reserveFlotilla`, `releaseFlotilla`, `jettyOf`.
- Ereignisse: `sim:flotillaReserved`, `sim:flotillaComplete` `{ flotte, name, n, jetty, boatId }`, `sim:flotillaSplit`.
- `bridge.js`: `flottille(boatId)`, `flottillenArt`, `flottillenSteg`, `flottillenMitglieder`, `flotteFreihaltbar`, `flotteFreihalten`, `flotteFreigeben`.
- Zahlen: `economy.flottillen` (Tabelle in [zahlen.md](zahlen.md)).

## Entscheidungen

- Das Büro weist Flottillen nicht automatisch zu: die Gruppe zusammenzuhalten ist die Entscheidung des Spielers. Ein Vorschlag erscheint trotzdem.
- Keine Bootsgeschichte für Boote einer Flottille: die Gruppe ist ihre Geschichte. Ein Boot der Flottille kommt nie als Stammgast an (die Gruppe ist neu zusammengestellt); einzeln wiederkommen darf es später wie jeder zufriedene Gast.
- Im Konvoi rückt kein Boot vor (Vorrücken aus P66 bleibt für Einzelboote).
- Plusbeträge als Dezimalzahl (+0,5), weil „½“ in Pixelify wie „⅛“ aussieht.

## Wo es mit anderen kollidieren kann

| Bereich | Paket | Worauf achten |
|---|---|---|
| `economy.js`, Bewertung in `sim.js` (`ratingParts.flotte`) | P34 Wind | Wind-Abzug und Flottillen-Plus addieren sich; Außenplätze am Wunschsteg können bei Starkwind schlechter sein |
| Ankunfts-Hooks, Stammgäste | P25 | Flottillen-Boote haben keine `stammId`; Gästepost sollte sie als Gruppe zählen |
| `boat-view.js`, `boat-channel.js` | P88 | Konvoi nutzt `flottenAnfahrt` und die Ausnahme in `ChannelLock.request` (+5 für dieselbe Flottille) |
| Päckchen | P27 | Päckchen am Wunschsteg zählt als „am Steg“ (Platz-id `B27+`) |
| Funk | P28 | Eine Funk-Karte für die ganze Gruppe, Einzelboote unverändert |
| Bootsgeschichten | P86 | `zeitenEntzerren` lässt Flottillen aus, `doppelteNeuWaehlen` würfelt doppelte Geschichten neu |

Tests: `node --test tests/flottillen.test.mjs` (14 Fälle: Zahlen, Stufen, Winter, Konvoi, zusammen/getrennt, Wegschicken, Büro, Funk, Bojen voll, Speichern).
