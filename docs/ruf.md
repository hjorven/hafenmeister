# Ruf und Bewertung

Stand: 14.11.2026. Status: gepflegt. Roadmap-Paket P19 ("Ruf schwerer machen mit Wünschen je Bootsart"), Punkte Ü17, B7, C2, C3, C4, C6, Svc F8. Teil 2 (C5 Auszeichnung, Kapazität sichtbar, B9 Wege) steht unten unter "Offen".

## Ziel

Vorher lag ein guter Spieler ab Stufe 2 fast immer bei 4,9 bis 5 Sternen, weil jede Bewertung mit allen erfüllten Wünschen schon 5 gab und die Services noch bis zu 0,75 auf jede Bewertung legten. Der Ruf hatte damit keine Aufgabe. Jetzt:

- Der Ruf reagiert auf das, was gerade im Hafen passiert (die letzten drei Tage).
- Die volle Note gibt es nur mit gutem Platz, nicht schon mit den Grundwünschen.
- Jede Bootsart will etwas anderes, und manche Gäste wünschen sich Angebote an Land.
- Ein guter Ruf bringt etwas, das man sieht: mehr und größere Boote, ab 4,5 seltene Modelle.

## Regeln

| Regel | Wert | Wo |
|---|---|---|
| Ruf | Schnitt aller Bewertungen der letzten 3 Tage (heute mitgezählt), mindestens der letzten 10; der Spielstand hebt höchstens 400 auf | `economy.js` `ruf.tage`, `ruf.mindestens`, `ruf.hoechstens`; `sim.js` `reputationRatings` |
| Tag jeder Bewertung | `state.ratingDays`, von hinten an `state.ratings` ausgerichtet; ältere Spielstände ohne Tage zählen nur zum Auffüllen | `sim.js` `pushRating`, `state.js` |
| Note aus Wünschen | keiner erfüllt 2,5, alle erfüllt 4,5, linear dazwischen | `ruf.wunschNote` |
| Gast ohne Wünsche | 4,5 (C4): der Platz entscheidet über den Rest | `ruf.ohneWunsch` |
| Platz | Fingersteg +0,5, Box passt genau +0,25, vom Hafenmeister eingewiesen +0,25, höchstens 5 | `platzarten.finger.rufBonus`, `passgenau.ruf`, `hafenbuero.vonHandBonus` |
| Ereignisse | Regatta und Hafenfest +0,25 auf jede Bewertung ("Fest im Hafen") | `ereignisse.*.wirkung.ratingBonus` |
| Services | kein Aufschlag mehr auf jede Bewertung (C3), statt dessen Wünsche an Angebote | `render/services.js` `fuerSpielregeln` |

### Wünsche je Bootsart (B7)

Jede Art in `web/js/data/boats/*.js` trägt ein Gästeprofil: `wishes` (welche Wünsche diese Art haben kann), `feeFactor` (Liegegeld = Grundpreis der Klasse mal Faktor) und `arrivalWeight` (wie oft sie unter den Booten ihrer Klasse kommt). Ein Boot würfelt seine Wünsche aus dem Schnitt von Stufe und Profil. Beispiele: Paddel- und Tretboote wollen nur WC und Essen und zahlen 0,6; Katamarane wollen Dusche, Essen und Strom und zahlen 1,5; Fahrgastschiffe wollen Strom und Diesel.

`data/boat-catalog.js` mischt die Datendateien in den Katalog der Regeln. Spiel, Tests und `tools/balance.mjs` rechnen damit mit denselben Arten, Modellen und Profilen (vorher sahen Tests und Balancing die Modelle und Profile nicht).

### Wünsche an Angebote an Land (C3)

Statt eines Ruf-Aufschlags je Service wünschen sich manche Gäste ein Angebot. Der Wunsch ist erfüllt, sobald der Service gebaut ist (irgendeine Stufe), sonst fehlt er wie eine Dusche: Note und Gästebuch zeigen es, das Bauen-Menü schlägt den Service vor.

| Wunsch | Service | ab Stufe | Klassen |
|---|---|---|---|
| Brötchen | Bäcker | 1 | alle |
| Café | Hafencafé | 2 | alle |
| Grillplatz | Grillplatz | 2 | S, M, L |
| Räucherfisch | Räucherei | 2 | M, L, XL |
| Segelclub | Segelclub | 3 | S, M, L, nur Segler |
| Fahrräder | Fahrradverleih | 3 | M, L, XL |
| Ausrüster | Bootsausrüster | 3 | M, L, XL |
| Mastenkran | Mastenkran | 3 | M, L, nur Segler |
| Eis | Eisdiele | 4 | S, M, L |
| Werft | Travellift | 4 | L, XL |
| Segelmacher | Segelmacher | 4 | M, L, XL, nur Segler |

Anteil der Boote mit einem solchen Wunsch (zusätzlich zu den eigenen): Stufe 1 10 %, 2 20 %, 3 35 %, 4 45 %, 5 und 6 50 % (`angebotWunsch.anteil`). Texte und Sätze stehen in `web/js/data/wuensche-texte.js`, die Pixelbilder (12 x 12) in `web/js/ui/wunsch-bilder.js`.

### Ruf lockt Gäste (C6)

Ab 4 Sternen kommen L-Boote 1,3-mal und XL-Boote 1,4-mal so oft (`ruf.lockt.grosse`). Ab 4,5 Sternen kommen auch die seltenen Modelle (`ruf.lockt.selten`): Holzjolle, Runabout aus Mahagoni, kleiner Trimaran, Gaffelkutter, Hausboot, Langfahrt-Ketsch, Regatta-Katamaran, klassische Holzmotoryacht, Kogge, klassische Motoryacht, Maxi-Racer. Wer sie im Logbuch sammeln will, braucht also einen sehr guten Ruf. Stammgäste mit einem seltenen Modell kommen auch darunter wieder.

### Mindestruf für Services (Svc F8)

Bleibt. Mit dem neuen Ruf hat er eine Aufgabe: Segelclub- und Werftausbau ab 3,8, Fahrgastanleger und Museumshafen ab 4,0, Kreuzfahrtterminal 4,0 und 4,5, Marineanleger 4,0 und 4,6. Das Bauen-Menü nennt den fehlenden Ruf ("braucht Ruf 4,5").

## Gemessen (tools/balance.mjs, 30 Läufe)

| | vorher | nachher |
|---|---|---|
| Ruf geschickt, Stufe 1 bis 6 | 4,7 bis 5,0 | 4,1, 4,2, 4,5, 4,7, 4,7, 4,8 |
| Ruf gemütlich, Stufe 1 bis 6 | 4,6 bis 5,0 | 4,1, 4,1, 4,2, 4,4, 4,7, 4,7 |
| Spieltage bis zum Abschluss, geschickt | 249 | 233 |
| Spieltage bis zum Abschluss, gemütlich | 259 | 254 |
| Einnahmen bis Tag 30, geschickt | 3.020 € | 2.609 € |
| untätiger Spieler, Ruf an Tag 30 | 3,0 | 3,1 |

Stufe 2 dauert für gemütliche Spieler länger (50 statt 38 Tage, vor allem Sparen), weil der Ruf nach dem Aufstieg kurz fällt, bis Dusche und Essen stehen, und mit ihm die Ankünfte. Das gehört zu P17 (Start und frühe Stufen straffen). Stufe 6 ist kürzer (37 statt 51 Tage), weil der gute Ruf große Boote lockt.

## Wo es kollidieren kann

- **Gästebuch (P14):** zeigt weiter die letzten 20 Bewertungen; der Ruf ist nicht mehr deren Schnitt. Der Satz unter dem Gästebuch erklärt, woraus der Ruf besteht (`rufErklaerung`).
- **Stammgäste:** gleiche Art und gleiches Modell wie beim letzten Besuch, auch ein seltenes Modell.
- **Hafenbüro-Vorschlag und Einweisen:** `sim.berthValue` zählt Angebotswünsche mit (erfüllt, wenn gebaut).
- **Tagesziele:** Ziele "mit Wunsch versorgen" wählen nur Versorgung und Strom, Namen kommen aus `wuensche-texte.js`.
- **P31 (neue Wünsche in späten Stufen):** neue Wünsche kommen in `economy.js` und `wuensche-texte.js`; die Oberfläche liest alle Namen von dort.
- **Services-Effekte:** `effekte().ruf` wird noch berechnet, zählt aber nicht mehr für die Note. `effekte().angebote` meldet die gebauten Services an die Regeln.

## Offen (Teil 2)

- C5: Ruf als Auszeichnung mit Namen und Zeichen im Hafen.
- Kapazität sichtbar: wie viele Gäste Toilette, Dusche, Essen und Diesel heute noch versorgen.
- B9: Wege zählen (weit vom Sanitärhaus zählt die Dusche halb).
