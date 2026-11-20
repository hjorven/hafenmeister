# Services und Sonderanlagen

Stand: 15.11.2026 (P23). Status: gebaut (21 Services mit eigener Wirkung, Entweder-oder-Plätze, Bilanz auf der Karte); Mindestruf je Stufe und Deckel der Wirkungen stehen in [balancing.md](balancing.md#regeln-im-spiel-die-sonst-nirgends-stehen). Services sind Gebäude, die keinen Wunsch der Gäste erfüllen, sondern etwas Neues ins Spiel bringen (plan.md, Abschnitt 6). Jeder Service hat feste Bauplätze, 1 bis 3 Ausbaustufen, ein eigenes 3D-Modell im Flat-Stil und eine kleine Animation.

## So funktioniert es im Spiel

1. Sobald der Hafen die nötige Ausbaustufe hat, erscheint am Bauplatz ein Schild mit grünem Plus und einem pulsierenden Ring.
2. Schild antippen: Die Karte zeigt Name, Wirkung in einer Zeile und den Preis. „Bauen“ antippen.
3. Das Gebäude wächst mit einem kleinen Nachfedern aus dem Boden.
4. Gebautes antippen: Die Karte zeigt die Bilanz (gebaut für, bisher verdient, im Schnitt am Tag, zuletzt, bezahlt sich in etwa n Saisontagen), den nächsten Ausbau mit Preis und Schätzung oder was dafür noch fehlt. Steht der Service auf einem Wahlplatz, bietet die Karte die andere Option als Umbau an.

Bezahlt wird mit `game.sim.spend`, bei zu wenig Geld ist der Knopf gesperrt. Die Einnahmen kommen am Abend: Die Spielregeln senden `tag:ende`, dieses Modul rechnet ab und sendet `services:abrechnung`, die Spielregeln buchen die Summe gut. Der Zustand liegt im Spielstand unter `game.state.modules.services`.

## Die Services

| Service | Ab Stufe | Ausbaustufen | Wirkung | Animation |
|---|---|---|---|---|
| Bäcker | 1 | Brötchenservice, Hafenbäcker (ab 3) | verdient nach Auslastung (Crews im Hafen), Tagesgäste großer Schiffe | Klappe morgens offen, Rauch aus dem Schornstein, Brezel schwingt |
| Hafencafé | 2 | Hafencafé, Café mit Terrasse (ab 3) | verdient nach Auslastung, bei Regen weniger; Wahlplatz mit der Eisdiele; Tagesgäste | Schirme tagsüber auf, abends zu; Lichterkette |
| Grillplatz | 2 | eine Stufe | Ruf | abends Feuer und Rauch, Crews sitzen dort |
| Fahrradverleih | 3 | eine Stufe | Crews leihen Räder; manche Gäste mit kurzem Aufenthalt hängen für eine Radtour eine Nacht an (Dienst) | tagsüber ist der Ständer leer, abends kommen die Räder zurück |
| Eisdiele | 4 | eine Stufe | verdient nach Auslastung, bei Regen kaum etwas, mehr kleine Boote; steht auf dem Platz des Cafés (Wahlplatz) | Eis-Schild dreht sich, Schirme am Nachmittag |
| Bootsverleih | 1 | Ruderboote, Tretboote und Kanus, SUP und Jollen | Geld pro Tag, bei Regen weniger | Leihboote fahren Kreise |
| Slipanlage | 2 | Slip, Slip mit Trailerparkplatz | Trailerboote kommen über Land, gehen am Slip ins Wasser, fahren eine Runde und werden aufgeslippt; Slipgebühr je Boot, kein Liegeplatz | Trailer rollt zum Wasser, Trailerboote fahren über den See |
| Räucherei | 2 | Räucherkate, mit Fischladen | verdient nach Auslastung; abends kommen Leute aus dem Ort | Rauch steigt auf, abends Gäste |
| Segelclub | 3 | Segelclub, Segelschule, Regattaverein | mehr Jollen, Regatten möglich | Optimisten segeln im Kreis, Flaggen |
| Mastenkran | 3 | eine Stufe | Segler (M, L) lassen den Mast legen und bleiben eine Nacht länger (Dienst), mehr M-Gäste | Ausleger schwenkt, Mast wird gestellt |
| Bootsausrüster | 3 | Laden, mit Motorenwerkstatt | Kunden aus allen Booten | |
| Travellift und Werft | 4 | Bootsschuppen, Travellift, Werfthalle | Boote mit Schaden kommen zur Reparatur und bleiben länger (Dienst), auch im Winter Arbeit; Werfthalle ist ein Wahlplatz mit der Winterlagerhalle | Lift hebt ein Boot und fährt an Land |
| Winterlager | 4 | Freilager, Halle | Einnahmen im Winter; die Halle ist ein Wahlplatz mit der Werfthalle | |
| Segelmacher | 4 | Segelmacherei, Segelloft | Segelyachten zahlen mehr Hafengeld | Segel weht am Gestell |
| Seenotretter-Station | 4 | Rettungsboot, Rettungskreuzer (Stufe 6) | weniger Sturmschaden, Ruf | Boot rückt bei Sturm aus |
| Fischhalle | 5 | Fischhalle, mit Fischmarkt | Besucher für Kiosk und Restaurant, Tagesgäste großer Schiffe | Fisch-Schild dreht sich |
| Fahrgastanleger | 5 | Anleger, Ausflugsflotte | tägliche Ausflugsfahrt | Flagge |
| Museumshafen | 5 | Kai vor Speicher, zweiter Speicher, Windjammertreffen (ab 6) | Traditionssegler kommen, Hafenfest größer; mit Treffen alle 12 Tage zwei Tage Windjammer | Holzkran schwenkt; zum Treffen Flaggenreihe und Marktzelte, drei Großsegler ankern vor der Pier |
| Barkasse | 6 | eine Stufe, braucht den Fahrgastanleger | Geld pro Tag (bei Regen die Hälfte, bei Sturm nichts), Ruf | Bude und Ponton am Ostufer des Sees; die Barkasse fährt zweimal am Tag eine Rundfahrt |

| Kreuzfahrtterminal | 6 | Kreuzfahrtpier, Kreuzfahrtterminal | Kreuzfahrtschiff alle 4, mit Terminal alle 2 Tage; Tagesgäste gehen in den Ort. Terminal ist ein Wahlplatz mit dem Marinestützpunkt | Schiff läuft morgens ein und abends aus, Gruppen gehen über die Pier |
| Marineanleger | 6 | Anleger, Stützpunkt | Flottenbesuch alle 5 Tage, mit Stützpunkt alle 3 Tage und Tag der offenen Tür; Zuschauer gehen in den Ort. Stützpunkt ist ein Wahlplatz mit dem Terminal | Korvette und Minenjagdboot machen fest, Radar dreht |

## Eigene Wirkung (Roadmap P23)

Jeder Service ändert etwas im Spiel, nicht nur die Kasse (Jorvens Überblick, Punkte F2, F3, F5, F7, F9). Zahlen in `web/js/data/economy.js`, Regeln in `web/js/services/rules.js`, Bilder in `web/js/render/services-wirkung.js`.

| Punkt | Was im Spiel passiert | Wo |
|---|---|---|
| F2 Dienste | Mastenkran, Fahrradverleih und Werft: Ein Teil der passenden Gäste will beim Ankommen den Dienst (Mast legen, Radtour, Reparatur). Er bleibt dafür eine Nacht länger (Werfthalle zwei), zahlt am ersten Abend im Hafen den Preis des Dienstes und die Bootskarte sagt es in einem Satz ("Lässt vorher am Mastenkran den Mast legen, bleibt dafür eine Nacht länger."). Die längere Liegezeit bringt auch mehr Liegegeld. | `wirkung.dienst`, `rules.dienstBeiAnkunft` (Haken `arrivals` der Spielregeln, `boat.dienste`), Karte in `ui/hud.js` |
| H5 Dauerlieger (P20) | Mastenkran und Travellift verdienen an den Krantagen (erster und letzter Saisontag) an jedem Dauerlieger, der Segelmacher bekommt Segel von segelnden Dauerliegern, das Winterlager je Dauerlieger und Wintertag. Abends nennt ein Banner den Krantag. Einzelheiten in [winter.md](winter.md#dauerlieger-nutzen-den-hafen-h5). | `wirkung.dauerlieger`, Tagesdaten `dauerlieger`, `saisonTag` aus `render/services.js` |
| F2 Slip | Trailerboote kommen über Land: Am Vormittag gehen sie nacheinander am Slip ins Wasser, fahren eine Runde über den See (Fahrwasserkarte, nie über Land) und werden am Nachmittag wieder aufgeslippt. Kein Liegeplatz. Abends zahlt jedes die Slipgebühr; die Zahl steht schon morgens fest (bei Regen weniger, bei Sturm keine). | `wirkung.trailer`, `rules.mengeHeute` |
| F2 Räucherei | Am Abend kommen Leute aus dem Ort zur Räucherei und gehen danach wieder heim. | `wirkung.abendgaeste`, `game.people.besucher` |
| F2 Werft | Siehe Dienste: Boote mit Schaden laufen gezielt ein. Havaristen, die eingeschleppt werden, kommen mit Paket P37 und bauen darauf auf. | `wirkung.dienst` |
| F3 Entweder-oder | Drei Wahlplätze: Café oder Eisdiele (derselbe Platz am Wasser), Werfthalle oder Winterlagerhalle (nur eine große Halle), Kreuzfahrtterminal oder Marinestützpunkt (nur ein großer Ausbau auf der Nehrung). Die andere Option steht als Umbau auf der Karte und im Baumenü; wer umbaut, baut die erste auf die Stufe davor zurück, ohne Erstattung. Bei Café und Eisdiele ist ein Gast, der sich das andere wünscht, trotzdem zufrieden. | `WAHLPLAETZE` in `data/services.js`, `rules.wahlKonflikt` |
| F5 Auslastung | Bäcker, Café, Eisdiele, Räucherei und Fahrradverleih haben keinen Festbetrag mehr: Sie verdienen an einem Anteil der Crews im Hafen, bei Regen weniger. Ein voller Hafen lohnt doppelt, ein leerer Tag ist ruhiger. Die Karte zeigt "Zuletzt: 18 Crews". | `kunden` mit `wetter` |
| F7 Großschiff-Tage | Liegt das Kreuzfahrtschiff oder die Marine fest, gehen Gruppen von Bord über die Pier in den Ort und kommen zum Auslaufen zurück. Café, Eisdiele, Fischhalle, Räucherei, Bäcker und Fahrradverleih verdienen an diesem Tag mit (Euro je 100 Tagesgäste). Die tägliche Ausflugsfahrt zählt nicht dazu. | `wirkung.tagesgaeste`, `TAGESGAESTE_BESUCHE` in `rules.js` |
| F9 Bilanz | Karte eines gebauten Service: gebaut für, bisher verdient, Schnitt der letzten sechs Saisontage, die letzte Abrechnung und "bezahlt sich in etwa n Saisontagen" oder "hat sich schon bezahlt gemacht". Für den nächsten Ausbau: "Bringt an einem Tag wie gestern etwa X € mehr, bezahlt sich in etwa n Tagen", auch im Baumenü. | `rules.bilanz`, `rules.schaetzung`, Zustand `bezahlt`, `verlauf`, `heute` |

Dazu behoben: Die Abrechnung im Spiel kannte nur Sonne und Sturm, Regen wirkte nie (das Balancing rechnete schon mit Regen). Jetzt nimmt sie das Wetter des Tages aus den Ereignissen wie `tools/balance.mjs`.

Wo es mit anderen Teilen kollidieren kann: Bootsgeschichten setzen die Nächte im Haken `arrival`, die Dienste kommen danach im Haken `arrivals` dazu (die Geschichte kann "morgen geht es weiter" sagen, die Dienstzeile sagt dann "vorher ..."). Päckchen kürzen die Nächte auf eine; der Dienst wird trotzdem bezahlt. In Stufe 6 sind oft alle 300 Figuren vergeben: Tagesgäste und Abendgäste schicken dann zuerst Spaziergänger nach Hause (`platzMachen` in `render/people.js`). P37 (Havaristen) soll den Dienst der Werft nutzen, nicht einen zweiten bauen.

**Angebote an Land** (Bäcker, Hafencafé, Grillplatz, Fahrradverleih, Eisdiele, dazu die Räucherei): Die Menschen im Hafen gehen zur passenden Tageszeit hin (`ZIELE` und `SERVICE_ZIELE` in `web/js/data/people.js`), morgens zum Bäcker, nachmittags ins Café und zur Eisdiele, abends an den Grill. Nach dem Bau baut `people.js` das Wegenetz mit dem neuen Ziel neu. Zahlen kommen vom Balancing (`ECONOMY.services`), Gruppe `an-land`.

**Tankstelle** (Versorgung `diesel` der Spielregeln, gekauft über „Bauen“): `services.js` stellt das Modell auf den Dienststeg aus `harbor.js` (Stufe 4 bis 6, Steg ohne Namen bei y 178). Stufe 1 eine Zapfsäule mit Dieselschild, Stufe 2 zwei Säulen unter einem Dach und ein Tankwarthäuschen. Das Licht an der Säule blinkt, der Schlauch pendelt.

**Großschiffpier** (Stufe 6): Die T-Pier westlich der Westmole kommt aus `harbor.js` (Stufe 6, steg `P`) und wird von `services.js` gezeichnet. Kreuzfahrtschiffe liegen außen am Pierkopf (P01), Marineschiffe innen (MA01, MA02), der Seenotrettungskreuzer an der Westmole (SK01).

**Besuchsschiffe** (`web/js/render/services-besuch.js`): Das Ausflugsschiff liegt morgens am Kai, fährt mittags durch die Molen hinaus und kommt nachmittags zurück. Kreuzfahrtschiff und Marineschiffe kommen nur an Besuchstagen. Am Vorabend kündigt das Schild unter der oberen Leiste den Besuch an. Bei Sturm bleibt der Besuch aus und kommt einen Tag später. Der Marinestützpunkt (zweite Stufe des Marineanlegers) bringt mehr Besuche als der Anleger: Flottenbesuch alle 3 statt alle 5 Tage, zwei Tage lang, am zweiten Tag mit Tag der offenen Tür. Jeder zählt für das Abschlussziel.

Mehrtägige Besuche (Windjammertreffen, Flottenbesuch) bleiben über Nacht liegen und laufen am letzten Tag abends aus; den letzten Tag merkt sich der Spielstand unter `laufend`.

**Windjammertreffen**: drei Traditionssegler (Modelle XL1-4 Kogge, XL1-2 Brigg, XL1-1 Gaffelschoner aus `game.boatTypes.xl`) laufen am ersten Besuchstag nacheinander unter Segeln von Norden ein und ankern in einer Reihe nördlich der Großschiffpier (Plan-y 330 bis 338, abseits vom Weg des Kreuzfahrtschiffs). Vor Anker sind die Segel geborgen.

**Barkasse**: liegt am Ponton am Ostufer des Sees (Plan 192/2). Rundfahrt 1 (Spieltag 0,3 bis 0,58) fährt nördlich am Schwimmwellenbrecher entlang durch den See, Rundfahrt 2 (0,64 bis 0,92) durch den Durchstich in den Außenhafen, am Museumshafen und an der Westmole vorbei. Die Zeiten liegen so, dass sie das Ausflugsschiff im Außenhafen nicht trifft. Im Winter und bei Sturm bleibt sie am Ponton.

Alle Besuchsschiffe und die Barkasse melden sich bei `game.boatAnim.hindernis(group, { laenge, breite })` an (Thread Schiffsanimationen), damit Gastboote ausweichen.

Sobald der Schiffs-Thread XXL-Modelle anbietet (`game.boatTypes.xxl`, Kreuzfahrtschiff XXL1-3, Korvette XXL2-2, Minenjagdboot XXL2-1), werden diese genommen.

## Dateien

| Datei | Inhalt |
|---|---|
| `web/js/data/services.js` | Katalog: Lage, Preise, Wirkungen. Feldbeschreibung steht oben in der Datei. |
| `web/js/services/rules.js` | Regeln ohne Grafik: freischalten, bauen, Effekte, Tagesabrechnung, regelmäßige Besuche |
| `web/js/render/services-models.js` | 15 Modelle aus einfachen Körpern |
| `web/js/render/services-besuch.js` | Besuchsschiffe: Ausflugsschiff, Kreuzfahrtschiff, Marineschiffe, Windjammer mit Ein- und Auslaufen; Barkasse mit zwei Rundfahrten |
| `web/js/render/services-wirkung.js` | Trailerboote am Slip, Abendgäste der Räucherei, Tagesgäste großer Schiffe (P23) |
| `tests/services-wirkung.test.mjs` | Tests für Dienste, Auslastung, Trailer, Tagesgäste, Wahlplätze und Bilanz |
| `web/js/render/services.js` | Einstieg `init(game)`: Bauplätze, Karte, Modelle, Ereignisse, `game.services` |
| `web/js/data/besuchswege.js` | Wege der Besuchsschiffe und der Barkasse (Planeinheiten), Liegeplatz, Liegekurs, Maße |
| `web/js/data/anlagen-flaechen.js` | Flächen, die das Gelände für Anlagen planiert (Kai, Terminal, Marinebasis, Seenotretter) |
| `tests/besuchswege.test.mjs` | Prüft alle Wege gegen Tiefe, Stege, belegte Liegeplätze und die Seebrücke in allen 13 Stegbildern |
| `tests/services.test.mjs` | Tests für die Regeln |

Zahlen aus dem Balancing (`web/js/data/economy.js`, `ECONOMY.services[id]`) überschreiben die Startwerte, sobald die Datei existiert.

## Lage der Anlagen (Stufe 6, Paket P63)

Wie in einem echten Seehafen liegen die großen Anlagen auf der Nehrung zwischen Binnensee und Ostsee, jede mit Zufahrt von Land (Nehrungsstraße bei y 192) und vom Wasser:

| Anlage | Lage (Plan) | Zufahrt vom Wasser |
|---|---|---|
| Marinestützpunkt | Fläche x -352..-280, eigene Pier MA bei x -310 (Nord-Süd) | Korvette (MA01, Ostseite) und Minenjagdboot (MA02, Westseite) laufen gerade von Norden ein und legen achteraus ab. Tor mit Wache im Süden zur Straße, Torposten an der Pierwurzel |
| Seebrücke | x -262, 51 m nach Norden | nur Fußgänger |
| Windjammertreffen | drei Segler vor Anker bei x -195, y 300/372/444 | eigene Fahrspur x -225 |
| Kreuzfahrtterminal | Fläche x -185..-115, Pier P bei x -150 bis y 500 | Schiff an P01 (x -122) läuft von Norden ein, legt achteraus mit Schleppern ab, ohne zu drehen |
| Seenotretter | Station an der Ostmole, Kreuzer ab Stufe 6 an SK01 | Einsatz durch die Einfahrt (`seenotEinsatzWeg`) |
| Ausflugsschiff | Kai K01, 18 m, liegt frei von FK01 und K02 | durch den Außenhafen |
| Barkasse | Ponton am Ostufer (216, -6) | Binnenrunde am Ostufer und vor dem Durchstich, Außenrunde durch den Durchstich. Westlich ist der See zu flach und die Stegköpfe reichen je nach Stegbild bis y 160 |

Vorbeifahrer meiden diese Rümpfe (`GROSSE_GAESTE` in `web/js/data/verkehr.js`, `tests/verkehr.test.mjs`). In Stufe 6 rücken Strandkörbe und Seebrücke zur Seite (`render/buildings.js`), die Kamera darf bis y 500 nach Norden.

Wo es mit anderen Teilen kollidieren kann: neue Geländeform ohne Liegewanne bis y 520 (Kreuzfahrtschiff auf Grund), neue Stegbilder mit Stegköpfen nördlich von y 160 oder östlich von x 205 (Barkasse), neue Vorbeifahrer-Bahnen zwischen x -340 und -88 nördlich von y 224, Bauten auf den Anlagenflächen. `tests/besuchswege.test.mjs` meldet jeden dieser Fälle.

## Schnittstelle für andere Module

| Aufruf oder Ereignis | Bedeutung |
|---|---|
| `game.services.effekte()` | Modifikatoren für die Spielregeln (`ratingBonus`, `sizeFactor`, `unlock`, `priceFactor`, `visitorFactor`) und dieselben Werte auf Deutsch für Ereignisse und Oberfläche (`ruf`, `gaeste`, `sturmschutz`, `regatta`, `hafenfest`, `hafengeld`, `freischalten`) |
| `tag:ende` mit `{ tag, boote: [{ klasse, antrieb }] }` | Tagesabrechnung, Antwort `services:abrechnung` mit `{ einnahmen, summe, besuche }`; Winter kommt aus `day:start`, Sturm aus `game.events.current` |
| `game.emit('sturm', { tag })` | Seenotretter rücken aus, Antwort `services:einsatz` |
| `services:gebaut` (mit `umbau`, wenn ein Wahlplatz gewechselt wurde), `services:umgebaut`, `services:besuch-angekuendigt`, `services:besuch` | für Ton, Oberfläche und Schiffe |
| `game.services.bilanz(id)`, `game.services.schaetzung(id)` | Bilanz eines gebauten Service, Schätzung für den nächsten Ausbau (P23 F9) |
| `game.services.dienstText(boot)` | Satz für die Bootskarte, wenn ein Gast einen Dienst will |
| `game.services.wirkung.trailer()`, `.tagesgaeste()` | Zum Prüfen: Trailerboote und Schiffe, deren Tagesgäste gerade an Land sind |
| `game.services.grossschiffBesuche()` | Zahl der Besuche großer Schiffe für das Ziel von Stufe 6 (`ziel.grossschiffBesuche` in `economy.js`). Es gibt nur einen Zähler: `state.bigVisits` in `sim.js`, den `bridge.js` bei `services:besuch` erhöht, wenn die Art in `GROSSSCHIFF_BESUCHE` (`web/js/data/services.js`) steht: Kreuzfahrt und Flottenbesuch (beim Marinestützpunkt mit Tag der offenen Tür). Windjammertreffen und Ausflugsfahrten zählen nicht. Gezählt wird erst in der letzten Stufe. `besucheJeArt()` ist nur Statistik über das ganze Spiel |
| `game.services.liste()` | alle Services der aktuellen Stufe mit Preis und Sperrgründen, z. B. für den Knopf „Bauen“ |

Keine laufenden Kosten (plan.md, Leitlinien): Services bringen nur etwas ein.

## Ausprobieren

```bash
python3 -m http.server 8000 --directory web
```

Dann im Browser öffnen:

- `http://localhost:8000/`: normales Spiel. In Stufe 1 steht der Bauplatz des Bootsverleihs westlich von Steg A.
- `http://localhost:8000/?stufe=4`: Testmodus, Stufe 4 fest, Bauen kostenlos, Ruf zählt als 5. Bauplätze am Ufer erscheinen, Schild antippen, bauen, Gebautes noch einmal antippen.
- `http://localhost:8000/?stufe=6&services=alle`: alles voll ausgebaut (auf Wahlplätzen die erste Option, mit `&wahl=2` die zweite), zum Ansehen der Modelle und Animationen. Das Ausflugsschiff fährt jeden Tag, Kreuzfahrtschiff und Marine kommen nach 2 bis 4 Spieltagen.
