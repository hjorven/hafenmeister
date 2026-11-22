# Preisstufe am Hafenbüro (P35, F6)

Stand: 22.11.2026. Status: gebaut. Paket P35 aus der [Roadmap](roadmap.md), Welle 3.

Ab "Hafenmeister mit Funk" (Hafenbüro Stufe 1, ab Hafenstufe 2) legst du die Preise deines Hafens fest: günstig, normal oder gehoben. Die Wahl gilt für eine ganze Saison. Sie ist eine echte Entscheidung: Günstig füllt den Hafen und hebt die Noten, gehoben bringt viel mehr Geld, aber nur zufriedene Gäste zahlen es gern.

## So spielt es sich

- **Wo:** Am Hafenmeisterhaus steht ein Aufsteller "PREISE" mit einem Münzstapel (eine Münze auf grünem Feld = günstig, zwei auf blauem = normal, drei auf goldenem = gehoben). Antippen öffnet das Gästebuch bei der **Preistafel**, gleich unter der Pinnwand. Das Gästebuch öffnet sich auch über das Hafenmeisterhaus, den Ruf oben links, das Menü oder Taste N.
- **Preistafel:** drei Knöpfe mit Münzstapel und dem Preis einer Nacht für ein 10-m-Boot ohne Wünsche, darunter die Wirkung der gewählten Stufe mit Zahlen und wann du wieder wählen darfst.
- **Wann:** einmal je Saison. Im Winter gilt die Wahl für die kommende Saison. Am Tag der Wahl darfst du noch umentscheiden. Nach jedem Ausbau der Hafenstufe darfst du einmal neu wählen (neue Hafenstufe, neue Preisliste). Wählst du nicht, bleibt die alte Stufe.
- **Meldung:** Beim Freischalten ("Neu: Preistafel am Hafenbüro"), am ersten Wintertag ("Preise für Saison N") und nach einem Ausbau ("Neue Hafenstufe, neue Preise?") fragt eine kurze Meldung mit "Preistafel" und "Später", je Anlass einmal.
- **Gästebuch:** Bei gehobenen Preisen schreiben Gäste, denen etwas fehlte, "Für das Geld hätten wir mehr erwartet." (Grund "zu teuer für das Gebotene" mit Münze und Pfeil). Bei günstigen Preisen loben sie "Faire Preise, gerne wieder." (Pluspunkt "faire Preise").

## Wirkung

Zahlen in `ECONOMY.preisstufe` (`web/js/data/economy.js`), Übersicht in [zahlen.md](zahlen.md).

| Stufe | Liegegeld | Ankünfte | Bootsmischung | Bewertung |
|---|---|---|---|---|
| Günstig | −10 % | +20 % | mehr kleine Boote (S +15 %) | +0,25 Anker; fehlen Wünsche, sehen Gäste es nach (bis +0,5 Anker, wenn keiner erfüllt war) |
| Normal | wie bisher | wie bisher | wie bisher | wie bisher |
| Gehoben | +30 % | −15 % | mehr große Yachten (L +20 %), weniger kleine (S −20 %) | −0,25 Anker; fehlen Wünsche, bis −1 Anker mehr (wer viel zahlt, erwartet viel) |

- Das Liegegeld wirkt sofort auf jedes neue Liegegeld (wie `priceFactor` der Ereignisse, also auch auf Kurzhalter, Päckchen und den Wunschbonus). Ankünfte und Bootsmischung wirken ab dem nächsten Morgen, weil die Boote eines Tages morgens verteilt werden.
- Jedes Boot merkt sich bei der Ankunft die Preisstufe (`boat.preisstufe`) und bewertet danach. Wechselst du, gilt die neue Stufe für alle, die noch kommen oder an der Boje warten; wer schon fest liegt, hat beim Anlegen bezahlt und behält seine.
- **Nicht betroffen:** Dauerlieger (zahlen Pacht nach Vertrag), Bojengeld und Funk-Bonus (rechnen mit dem Grundpreis), Services an Land.

### Faustregel

Fehlt Ruf: günstig. Bis zur Marina günstig, solange für den Ausbau Gäste fehlen, sonst gehoben. Ab der Küstenmarina gehoben, denn der Seehafen (alle Plätze, Großschiffbesuche) braucht viel Geld. Gehoben lohnt sich nur, wenn die Gäste fast alles finden, was sie sich wünschen. So spielen auch die Bots der Rechnung und des Zeitraffers (`klugeWahl` in `features/preisstufe-regeln.js`).

## Balancing

Gemessen am 22.11.2026 mit `node tools/balance.mjs` (Median der Spieltage bis zum Regionsabschluss; Ziel rund 105, siehe [balancing.md](balancing.md)). Zeitraffer und geschickt wählen nach der Faustregel, gemütlich lässt die Preise auf normal.

| Spielertyp | vorher (P31, alles normal) | mit P35 (30 Läufe) | Stufe 1 bis 6 |
|---|---|---|---|
| zeitraffer (Faustregel) | 110 | 108 (105 bis 111) | 5, 15, 21, 23, 30, 14 |
| geschickt (Faustregel) | 105 | 104 (100 bis 107) | 6, 15, 20, 22, 29, 11 |
| gemütlich (bleibt normal) | 128 | 128 | unverändert |

Feste Wahl für die ganze Partie (16 Läufe, `--preis`), Spieltage je Stufe 1 bis 6 (zeitraffer):

| Wahl | Stufe 1 bis 6 | Gesamt zeitraffer / geschickt / gemütlich |
|---|---|---|
| normal | 5, 15, 21, 23, 27, 17 | 110 / 104 / 128 |
| immer günstig | 5, 15, 21, 23, 26, 21 | 111 / 107 / 123 |
| immer gehoben | 5, 13, 21, 25, 32, 11 | 107 / 109 / 131 |

Keine Stufe gewinnt immer. Günstig ist schneller, wo Gäste fehlen (Stufe 4 und 5) und für Spieler, die nicht alles bauen (gemütlich 123 statt 128). Gehoben ist schneller, wo nur Geld fehlt (Stufe 2 und der Seehafen), kostet aber bei offenen Wünschen Ruf und Gäste (gemütlich 131). Das Geld für den Seehafen wird in der Küstenmarina gespart, darum wählt die Faustregel dort schon gehoben. Mit P31 lag der Zeitraffer bei 110 Tagen; mit der Faustregel bei 108, innerhalb der 5 % um das Ziel 105.

Erster Entwurf (günstig −20 % Liegegeld, gehoben −10 % Ankünfte und −0,5 Anspruch) war zu einseitig: günstig verlor überall (zeitraffer 119), gehoben gewann fast überall. Darum günstig mit Nachsicht für fehlende Wünsche und nur −10 %, gehoben mit stärkerem Anspruch und −15 % Ankünften.

## Technik

| Datei | Inhalt |
|---|---|
| `web/js/features/preisstufe-regeln.js` | Regeln ohne DOM: Stand, Saison, `darfWaehlen`, `waehle`, Modifikator, Ankunft, `klugeWahl`, Texte |
| `web/js/features/preisstufe.js` | Modul (eine MODULES-Zeile): Preistafel im Gästebuch, Meldung `#hm-preis-karte` (Vorrang 56), Tippen auf den Aufsteller |
| `web/js/render/preistafel.js` | Aufsteller am Hafenmeisterhaus über `game.zielDeko.zusatz` (Pixelbild auf CanvasTexture) |
| `web/js/sim.js` | `priceRating(ctx, boat)`, Teil `preis` in `ratingParts` |
| `web/js/data/rules.js` | `rules.priceLevels` aus `ECONOMY.preisstufe` |
| `tests/preisstufe.test.mjs` | Tests |

- Stand: `state.modules.preisstufe` (`stufe`, `jahr`, `tag`, `ausbau`, `verlauf`, `gesehen`, `gesehenAusbau`). Alte Spielstände ohne das Feld spielen normal weiter, kein neuer `SAVE_VERSION`. Nach der Wahl wird sofort gespeichert.
- Sim-Ereignis: `sim:preisstufe` `{ stufe, vorher, jahr, day, umgestellt }` über `game.sim.dispatch`.
- Schnittstelle: `game.preisstufe = { stufe(), darf(), waehle(id), abschnitt(), oeffnen(), klug() }`. Gästebuch ruft `abschnitt()` auf (`ui/gaestebuch.js`).
- Pixel-Symbole `preis1`, `preis2`, `preis3` in `ui/pixel-symbole.js`, `teuer` im Gästebuch.
- Zeitraffer-Bot (`tools/zeitraffer/lauf.cjs`) wählt je Saison und nach jedem Ausbau nach der Faustregel, Eintrag als Kauf `preis` im Bericht. `tools/balance.mjs --preis normal|guenstig|gehoben|klug` legt die Wahl für alle Spielertypen fest.

## Zusammenspiel (geprüft)

- **Hafenfest, Regatta, Ereignisse:** `priceFactor` multipliziert sich mit dem der Ereignisse.
- **Wünsche (P31) und Nachrüsten:** der Anspruch bei gehoben zählt alle Wünsche gleich, auch Frischwasser und WLAN; weiter Weg (P19) zählt wie bisher nur in der Wunschnote.
- **Stammgäste (P25):** Stammgast wird, wer zweimal zufrieden war; gehoben mit offenen Wünschen macht das seltener, günstig häufiger. Gewollt.
- **Flottillen (P32):** behalten ihre Preisstufe beim Zurücksetzen der Gruppenfelder.
- **Päckchen (P27):** halbes Liegegeld mal Preisstufe.
- **Funk-Anmeldung (P28):** Bonus bleibt beim Grundpreis (bewusst, er belohnt das Freihalten, nicht den Preis).
- **Tagesziele mit Geld:** werden mit gehoben leichter, mit günstig schwerer. Nicht nachgestimmt.
- **Ziel-Deko:** der Aufsteller sucht sich wie die Deko-Stücke einen freien Platz; Stücke anderer Module, die nach ihm angemeldet werden, rücken eins weiter.

## Prüfen

```bash
node --test tests/preisstufe.test.mjs tests/gaestebuch.test.mjs tests/zahlen.test.mjs
```

Im Browser in der Konsole (Testmodus Stufe 3):

```js
hafenmeister.sim.state.office = 1; hafenmeister.preisstufe.oeffnen();
```
