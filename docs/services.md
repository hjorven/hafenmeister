# Services und Sonderanlagen

Stand: 11.11.2026. Services sind Gebäude, die keinen Wunsch der Gäste erfüllen, sondern etwas Neues ins Spiel bringen (plan.md, Abschnitt 6). Jeder Service hat feste Bauplätze, 1 bis 3 Ausbaustufen, ein eigenes 3D-Modell im Flat-Stil und eine kleine Animation.

## So funktioniert es im Spiel

1. Sobald der Hafen die nötige Ausbaustufe hat, erscheint am Bauplatz ein Schild mit grünem Plus und einem pulsierenden Ring.
2. Schild antippen: Die Karte zeigt Name, Wirkung in einer Zeile und den Preis. „Bauen“ antippen.
3. Das Gebäude wächst mit einem kleinen Nachfedern aus dem Boden.
4. Gebautes antippen: Die Karte zeigt die Einnahmen bisher, den nächsten Ausbau mit Preis oder was dafür noch fehlt.

Bezahlt wird mit `game.sim.spend`, bei zu wenig Geld ist der Knopf gesperrt. Die Einnahmen kommen am Abend: Die Spielregeln senden `tag:ende`, dieses Modul rechnet ab und sendet `services:abrechnung`, die Spielregeln buchen die Summe gut. Der Zustand liegt im Spielstand unter `game.state.modules.services`.

## Die Services

| Service | Ab Stufe | Ausbaustufen | Wirkung | Animation |
|---|---|---|---|---|
| Bäcker | 1 | Brötchenservice, Hafenbäcker (ab 3) | Kunden am Morgen, Ruf | Klappe morgens offen, Rauch aus dem Schornstein, Brezel schwingt |
| Hafencafé | 2 | Hafencafé, Café mit Terrasse (ab 3) | Geld pro Tag und Kunden, bei Regen weniger, Ruf | Schirme tagsüber auf, abends zu; Lichterkette |
| Grillplatz | 2 | eine Stufe | Ruf | abends Feuer und Rauch, Crews sitzen dort |
| Fahrradverleih | 3 | eine Stufe | Geld pro Tag und Kunden | tagsüber ist der Ständer leer, abends kommen die Räder zurück |
| Eisdiele | 4 | eine Stufe | Geld pro Tag und Kunden, bei Regen kaum etwas | Eis-Schild dreht sich, Schirme am Nachmittag |
| Bootsverleih | 1 | Ruderboote, Tretboote und Kanus, SUP und Jollen | Geld pro Tag, bei Regen weniger | Leihboote fahren Kreise |
| Slipanlage | 2 | Slip, Slip mit Trailerparkplatz | Trailerboote ohne Liegeplatz | Trailer rollt zum Wasser |
| Räucherei | 2 | Räucherkate, mit Fischladen | Geld pro Tag und Kunden, Ruf | Rauch steigt auf |
| Segelclub | 3 | Segelclub, Segelschule, Regattaverein | mehr Jollen, Regatten möglich | Optimisten segeln im Kreis, Flaggen |
| Mastenkran | 3 | eine Stufe | Segler zahlen, mehr M-Gäste | Ausleger schwenkt, Mast wird gestellt |
| Bootsausrüster | 3 | Laden, mit Motorenwerkstatt | Kunden aus allen Booten | |
| Travellift und Werft | 4 | Bootsschuppen, Travellift, Werfthalle | Reparaturen, auch im Winter | Lift hebt ein Boot und fährt an Land |
| Winterlager | 4 | Freilager, Halle | Einnahmen im Winter | |
| Segelmacher | 4 | Segelmacherei, Segelloft | Segelyachten zahlen mehr Hafengeld | Segel weht am Gestell |
| Seenotretter-Station | 4 | Rettungsboot, Rettungskreuzer (Stufe 6) | weniger Sturmschaden, Ruf | Boot rückt bei Sturm aus |
| Fischhalle | 5 | Fischhalle, mit Fischmarkt | Besucher für Kiosk und Restaurant | Fisch-Schild dreht sich |
| Fahrgastanleger | 5 | Anleger, Ausflugsflotte | tägliche Ausflugsfahrt | Flagge |
| Museumshafen | 5 | Kai vor Speicher, zweiter Speicher | Traditionssegler kommen, Hafenfest größer | Holzkran schwenkt |

| Kreuzfahrtterminal | 6 | Terminal an der T-Pier, großes Terminal | Kreuzfahrtschiff alle 7, später alle 4 Tage | Schiff läuft morgens ein und abends aus |
| Marineanleger | 6 | Anleger, Stützpunkt | Flottenbesuch alle 10 Tage, später Tag der offenen Tür | Korvette und Minenjagdboot machen fest, Radar dreht |

**Angebote an Land** (Bäcker, Hafencafé, Grillplatz, Fahrradverleih, Eisdiele, dazu die Räucherei): Die Menschen im Hafen gehen zur passenden Tageszeit hin (`ZIELE` und `SERVICE_ZIELE` in `web/js/data/people.js`), morgens zum Bäcker, nachmittags ins Café und zur Eisdiele, abends an den Grill. Nach dem Bau baut `people.js` das Wegenetz mit dem neuen Ziel neu. Zahlen kommen vom Balancing (`ECONOMY.services`), Gruppe `an-land`.

**Tankstelle** (Versorgung `diesel` der Spielregeln, gekauft über „Bauen“): `services.js` stellt das Modell auf den Dienststeg aus `harbor.js` (Stufe 4 bis 6, Steg ohne Namen bei y 178). Stufe 1 eine Zapfsäule mit Dieselschild, Stufe 2 zwei Säulen unter einem Dach und ein Tankwarthäuschen. Das Licht an der Säule blinkt, der Schlauch pendelt.

**Großschiffpier** (Stufe 6): Die T-Pier westlich der Westmole kommt aus `harbor.js` (Stufe 6, steg `P`) und wird von `services.js` gezeichnet. Kreuzfahrtschiffe liegen außen am Pierkopf (P01), Marineschiffe innen (MA01, MA02), der Seenotrettungskreuzer an der Westmole (SK01).

**Besuchsschiffe** (`web/js/render/services-besuch.js`): Das Ausflugsschiff liegt morgens am Kai, fährt mittags durch die Molen hinaus und kommt nachmittags zurück. Kreuzfahrtschiff und Marineschiffe kommen nur an Besuchstagen. Am Vorabend kündigt das Schild unter der oberen Leiste den Besuch an. Bei Sturm bleibt der Besuch aus und kommt einen Tag später. Sobald der Schiffs-Thread XXL-Modelle anbietet (`game.boatTypes.xxl`, Kreuzfahrtschiff XXL1-3, Korvette XXL2-2, Minenjagdboot XXL2-1), werden diese genommen.

## Dateien

| Datei | Inhalt |
|---|---|
| `web/js/data/services.js` | Katalog: Lage, Preise, Wirkungen. Feldbeschreibung steht oben in der Datei. |
| `web/js/services/rules.js` | Regeln ohne Grafik: freischalten, bauen, Effekte, Tagesabrechnung, regelmäßige Besuche |
| `web/js/render/services-models.js` | 15 Modelle aus einfachen Körpern |
| `web/js/render/services-besuch.js` | Besuchsschiffe: Ausflugsschiff, Kreuzfahrtschiff, Marineschiffe mit Ein- und Auslaufen |
| `web/js/render/services.js` | Einstieg `init(game)`: Bauplätze, Karte, Modelle, Ereignisse, `game.services` |
| `tests/services.test.mjs` | Tests für die Regeln |

Zahlen aus dem Balancing (`web/js/data/economy.js`, `ECONOMY.services[id]`) überschreiben die Startwerte, sobald die Datei existiert.

## Schnittstelle für andere Module

| Aufruf oder Ereignis | Bedeutung |
|---|---|
| `game.services.effekte()` | Modifikatoren für die Spielregeln (`ratingBonus`, `sizeFactor`, `unlock`, `priceFactor`, `visitorFactor`) und dieselben Werte auf Deutsch für Ereignisse und Oberfläche (`ruf`, `gaeste`, `sturmschutz`, `regatta`, `hafenfest`, `hafengeld`, `freischalten`) |
| `tag:ende` mit `{ tag, boote: [{ klasse, antrieb }] }` | Tagesabrechnung, Antwort `services:abrechnung` mit `{ einnahmen, summe, besuche }`; Winter kommt aus `day:start`, Sturm aus `game.events.current` |
| `game.emit('sturm', { tag })` | Seenotretter rücken aus, Antwort `services:einsatz` |
| `services:gebaut`, `services:besuch-angekuendigt`, `services:besuch` | für Ton, Oberfläche und Schiffe |
| `game.services.grossschiffBesuche()` | Zahl der bisherigen Besuche großer Schiffe (Kreuzfahrt, Flottenbesuch, Tag der offenen Tür) für das Ziel von Stufe 6 (`ziel.grossschiffBesuche` in `economy.js`); `besucheJeArt()` zählt je Art |
| `game.services.liste()` | alle Services der aktuellen Stufe mit Preis und Sperrgründen, z. B. für den Knopf „Bauen“ |

Keine laufenden Kosten (plan.md, Leitlinien): Services bringen nur etwas ein.

## Ausprobieren

```bash
python3 -m http.server 8000 --directory web
```

Dann im Browser öffnen:

- `http://localhost:8000/`: normales Spiel. In Stufe 1 steht der Bauplatz des Bootsverleihs westlich von Steg A.
- `http://localhost:8000/?stufe=4`: Testmodus, Stufe 4 fest, Bauen kostenlos, Ruf zählt als 5. Bauplätze am Ufer erscheinen, Schild antippen, bauen, Gebautes noch einmal antippen.
- `http://localhost:8000/?stufe=6&services=alle`: alles voll ausgebaut, zum Ansehen der Modelle und Animationen. Das Ausflugsschiff fährt jeden Tag, Kreuzfahrtschiff und Marine kommen nach 2 bis 4 Spieltagen.
