# Services und Sonderanlagen

Stand: 11.11.2026. Services sind Gebäude, die keinen Wunsch der Gäste erfüllen, sondern etwas Neues ins Spiel bringen (plan.md, Abschnitt 6). Jeder Service hat feste Bauplätze, 1 bis 3 Ausbaustufen, ein eigenes 3D-Modell im Flat-Stil und eine kleine Animation.

## So funktioniert es im Spiel

1. Sobald der Hafen die nötige Ausbaustufe hat, erscheint am Bauplatz ein Schild mit grünem Plus und einem pulsierenden Ring.
2. Schild antippen: Die Karte zeigt Name, Wirkung in einer Zeile und den Preis. „Bauen“ antippen.
3. Das Gebäude wächst mit einem kleinen Nachfedern aus dem Boden.
4. Gebautes antippen: Die Karte zeigt die Einnahmen bisher, den nächsten Ausbau mit Preis oder was dafür noch fehlt.

Solange es noch keinen Spielzustand gibt (`js/state.js`), kostet Bauen nichts. Sobald `game.state.geld` existiert, wird der Preis abgezogen und der Knopf ist bei zu wenig Geld gesperrt.

## Die Services

| Service | Ab Stufe | Ausbaustufen | Wirkung | Animation |
|---|---|---|---|---|
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

Kreuzfahrtterminal und Marineanleger (Stufe 6) sind als Daten und Modelle fertig, aber zurückgestellt, bis der Umfang von Stufe 6 entschieden ist. Mit `?services=alle` sind sie zu sehen.

## Dateien

| Datei | Inhalt |
|---|---|
| `web/js/data/services.js` | Katalog: Lage, Preise, Wirkungen. Feldbeschreibung steht oben in der Datei. |
| `web/js/services/rules.js` | Regeln ohne Grafik: freischalten, bauen, Effekte, Tagesabrechnung, regelmäßige Besuche |
| `web/js/render/services-models.js` | 15 Modelle aus einfachen Körpern |
| `web/js/render/services.js` | Einstieg `init(game)`: Bauplätze, Karte, Modelle, Ereignisse, `game.services` |
| `tests/services.test.mjs` | Tests für die Regeln |

Zahlen aus dem Balancing (`web/js/data/economy.js`, `ECONOMY.services[id]`) überschreiben die Startwerte, sobald die Datei existiert.

## Schnittstelle für andere Module

| Aufruf oder Ereignis | Bedeutung |
|---|---|
| `game.services.effekte()` | `{ ruf, gaeste: { S, M, L, XL }, sturmschutz, regatta, hafenfest, hafengeld: { segel, motor }, besucherFuerVersorgung, freischalten: [...] }` |
| `game.emit('tag:ende', { tag, wetter, winter, boote: [{ klasse, antrieb }] })` | Tagesabrechnung, Antwort `services:abrechnung` mit `{ einnahmen, summe, besuche }` |
| `game.emit('sturm', { tag })` | Seenotretter rücken aus, Antwort `services:einsatz` |
| `services:gebaut`, `services:besuch-angekuendigt`, `services:besuch` | für Ton, Oberfläche und Schiffe |
| `game.services.liste()` | alle Services der aktuellen Stufe mit Preis und Sperrgründen, z. B. für den Knopf „Bauen“ |

Keine laufenden Kosten (plan.md, Leitlinien): Services bringen nur etwas ein.

## Ausprobieren

```bash
python3 -m http.server 8000 --directory web
```

Dann im Browser öffnen:

- `http://localhost:8000/?stufe=4`: Bauplätze am Ufer erscheinen, Schild antippen, bauen, Gebautes noch einmal antippen.
- `http://localhost:8000/?stufe=5&services=alle`: alles voll ausgebaut, zum Ansehen der Modelle und Animationen.
