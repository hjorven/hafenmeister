# Neue Gästewünsche (P31)

Stand: 22.11.2026. Status: gepflegt. Roadmap F9 und B8, Paket P31. Zahlen: `ECONOMY.wuensche`, `ECONOMY.bauwerke`, `ECONOMY.nachruesten.wasser`, `ECONOMY.angebotWunsch` in `web/js/data/economy.js`. Tests: `tests/gaestewuensche.test.mjs`.

## Was neu ist

In jeder Ausbaustufe kommt mindestens ein Wunsch dazu (B8). Gewünscht wird etwas erst ab der Stufe, in der man es auch bauen kann.

| Stufe | Wunsch | Wer wünscht es | Was es erfüllt | Im Hafen |
|---|---|---|---|---|
| 1 | Brötchen (seit P19) | alle | Bäcker (Angebot) | Bäckerbude |
| 2 | **Frischwasser** | Kleinkreuzer, Holzklassiker, Kajütboote, Yachten, große Schiffe (M, L, XL) | **Wasserhähne** am Steg (Stege nachrüsten, je Steg) | grüne Zapfstelle mit Schlauch an jedem zweiten Platz |
| 3 | **WLAN** | Kajütmotorboote, Fahrten- und Motoryachten, Mehrrumpfboote, Großyachten | **WLAN am Hafenbüro**, später **WLAN-Antennen an den Stegen** | Gittermast mit Antennen und rotem Blinklicht neben dem Hafenbüro |
| 4 | **Waschmaschine** | Fahrtenyachten, Mehrrumpfboote, Traditionssegler, Großyachten, nur wer mindestens 3 Nächte bleibt | **Waschmaschine und Trockner**, später **Waschsalon** | Waschhaus mit Bullaugen und Wäscheleine, später ein zweites, größeres Haus |
| 5 | **Absaugstation** (Fäkalientank) | Kajütmotorboote, Fahrten- und Motoryachten, Großyachten, Arbeitsschiffe | **Absaugstation**, später **Zweite Absaugstation** | grüner Pumpenschrank mit Schlauchtrommel auf dem Dienststeg der Tankstelle |
| 6 | **Hafenrundfahrt** | M, L, XL | **Barkasse** (Angebot, braucht den Fahrgastanleger) | Barkasse |

Wie bei den alten Wünschen gilt: Ein erfüllter Wunsch bringt 25 % mehr Liegegeld und hebt die Note, ein fehlender senkt sie und steht im Gästebuch ("Kein Wasserhahn am Steg", "Kein WLAN im Hafen"). Über wartenden Booten stehen die Wünsche als Pixel-Schild, im Funk ebenso.

## Spielen

- **Frischwasser** ist ein Platz-Wunsch wie Strom: Er hängt am Steg, nicht an einem Gebäude. Im Baumenü unter Stege stehen "Wasserhähne an ..." für jeden Gaststeg (auch Steg A, dort liegen kurze Kleinkreuzer). Danach leuchten die Boxen dieses Stegs für Gäste mit Wasserwunsch gold, das Hafenbüro und Boote, die selbst einfahren, nehmen sie zuerst. Die Karte sagt, wie viele Gäste am Steg gerade Wasser wollen. Preis: 90 € plus 10 bis 30 € je Platz, spätere Plätze am Steg bekommen den Hahn gleich mit.
- **WLAN, Waschmaschine, Absaugstation** sind Versorgung wie WC und Dusche: Jede Stufe versorgt eine feste Zahl Gäste am Tag, die Auslastung steht am Gebäude ("9 von 12"). Die erste Stufe reicht für den Anfang, die zweite für den vollen Hafen (in der Rechnung höchstens rund 18 WLAN-, 17 Absaug- und 10 Wäsche-Gäste am Tag).
- **Waschmaschine** wünscht sich nur, wer länger bleibt: Bleibt ein Boot weniger als 3 Nächte (auch Kurzhalt), fällt der Wunsch weg (`rules.wishMinNights`, `sim.dropStayWishes`).
- **"Als Nächstes"** schlägt Wasserhähne vor, sobald mehrere Gäste Wasser vermisst haben, genauso wie WLAN, Waschmaschine und Absaugstation. Im Gästebuch führt der Knopf beim Grund direkt zum passenden Bau (bei Wasser zum Steg, an dem gerade die meisten Gäste liegen).
- Crews gehen mit ihrer Wäsche zum Waschhaus und stehen bei voller Wäscherei Schlange.

## Technik

- Wünsche: `ECONOMY.wuensche` hat neu `eigenschaft` (Platz-Eigenschaft für `durch: 'platz'`, `power` oder `water`) und `abNaechte`. `rules.berthWishes` und `rules.wishMinNights` kommen daraus (`data/rules.js`).
- Welche Bootsart welchen Wunsch haben kann, steht in `data/boats/*.js` (`wishes`). Jollen, kleine Motorboote und Ruderboote (S), Fischer und Behördenboote haben keine neuen Wünsche.
- Wasser am Platz: neuer Hook `berthHas` in `sim.js` (`fn({ state, ctx, berth, prop }) -> true`). `features/nachruesten.js` hängt ihn ein und meldet `water` für Stege mit Wasserhähnen (`state.modules.nachruesten.wasser`). Kein Anker-Bonus, die Wirkung läuft über den Wunsch.
- Gebäude: `render/buildings.js` (`wlan-mast`, `waschhaus`, `waschsalon` in `PLAN` und `KAUF`), Absaugstation in `render/services.js` neben der Tankstelle (`service-absaugstation`, `game.services.absaugOrt()` für die Bau-Vorschau). Auslastungsschilder (`ui/hafenzeichen.js`) und Bau-Vorschau finden sie wie die anderen.
- Texte: `data/wuensche-texte.js` (`VERSORGUNG_TEXTE` mit Sätzen fürs Gästebuch, `ANGEBOT_TEXTE.barkasse`). Bilder: `ui/wunsch-bilder.js` (`NEUE_BILDER`, `ANGEBOT_BILDER.barkasse`), genutzt von `ui/vorschau.js` und `ui/gaestebuch.js`.
- Spielstand: Neue Bauwerke stehen in `state.facilities`, Wasserhähne in `state.modules.nachruesten.wasser`. Alte Spielstände haben beides nicht und laden ohne Migration (fehlende Einträge zählen als 0 bzw. leer).

## Entscheidungen

- **Brötchen** gab es schon (P19, Bäcker, ab Stufe 1). Kein zweiter Brötchen-Wunsch.
- **Frischwasser über den Steg statt Gebäude**: so wie im echten Hafen hängt Wasser an der Versorgungssäule am Steg. Damit bekommt die Nachrüstung aus P30 ihren Sinn (dort war "Wasser folgt mit P31" vermerkt). Wasser gibt es an keinem Steg von Anfang an, auch nicht an den Stegen mit Strom: sonst wäre der Wunsch ab Stufe 3 fast immer schon erfüllt.
- **Absaugstation erst ab Stufe 5**, auf dem Dienststeg der Tankstelle (in Stufe 5 wird sie zur Bootstankstelle). Sie steht auch ohne Tankstelle dort.
- **Hafenrundfahrt in Stufe 6** als Angebotswunsch an die Barkasse, damit auch der Seehafen einen neuen Wunsch hat.
- **Ausbaustufen nach Bedarf**: erste Stufe knapp, zweite für den vollen Hafen. Größere Stufen hätten nichts getan.

## Balancing

Messung 22.11. mit `node tools/balance.mjs`, 40 Läufe je Spielertyp (Median Spieltage bis zum Abschluss):

| Spielertyp | vorher (main) | mit P31 |
|---|---|---|
| zeitraffer | 105 | 110 |
| geschickt | 101 | 104 |
| gemütlich | 119 | 123 |

Die neuen Wünsche kosten rund drei Spieltage: Bevor WLAN, Wäscherei und Absaugstation stehen, fehlen sie (schlechtere Noten), und der Bot im Zeitraffer kauft jede Stufe sofort. Der Zeitraffer endet damit knapp nach dem Winter nach Tag 108 statt knapp davor, darum springt der Median von 105 auf 110. Ohne die neuen Bauwerke läge er wieder bei 105, mit fast kostenlosen bei 107 (Versuch mit `kosten: 10`). P35 (Preisstufe) ändert die Einnahmen ohnehin und kann das mitstimmen.

## Kollisionen und Berührungspunkte

- **P35 Preisstufe** (danach, `economy.js`): Liegegeld und Wunschbonus wirken auf die neuen Wünsche genauso.
- **P25 Stammgäste**: Wer wiederkommt, kann einen Wunsch mehr haben (`stammgaeste.wachsen`), auch einen neuen. Die Waschmaschine fällt beim Wiederkommen nicht weg, wenn der Stammgast kürzer bleibt (Wachsen läuft nach `dropStayWishes`).
- **P32 Flottillen**: Die Gruppe teilt ihre Wünsche; bleibt sie kürzer als 3 Nächte, verliert jedes Boot den Wäschewunsch.
- **P27 Päckchen**: Ein Päckchenlieger außen bekommt das Wasser des Stegs mit (Schlauch über das Nachbarboot). Er bleibt nur eine Nacht, sein Wäschewunsch vom Ankommen bleibt trotzdem stehen.
- **Bootsgeschichten**: Geschichten können Nächte ändern (zum Beispiel "Etappe", eine Nacht). Der Wäschewunsch wird vor den Geschichten geprüft und kann dann stehen bleiben, obwohl die Crew nur eine Nacht bleibt. Selten und harmlos.
- **P59 Stege umbauen**: Wasserhähne gelten für alle Plätze des Stegs, auch für umgebaute Doppelboxen.
- **Befund nebenbei**: In vollen Häfen kam dieselbe Bootsgeschichte manchmal doppelt im selben Tagesabschnitt (Seed-abhängig, der Test lief nur zufällig grün). `doppelteNeuWaehlen` schließt jetzt die Geschichten aus, die im Abschnitt schon vorkommen. Bleibt keine passende übrig, darf eine doppelt bleiben (rund 1 von 2000 Booten), `docs/bootsgeschichten.md` sagt das jetzt.
