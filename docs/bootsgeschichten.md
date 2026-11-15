# Längere Tage und Bootsgeschichten (Plan)

Auftrag Jorven, 14.11.2026 (22:18 und 22:19 UTC): Ein Spieltag dauert etwa fünf Minuten und ist voller
Treiben wie in einem echten Hafen. Jedes Boot, das in den Hafen kommt, hat einen Anlass aus sehr vielen
Möglichkeiten, sodass sich möglichst nichts wiederholt, und wenn doch, dann zu einer anderen Tageszeit.
Manche Boote sind nach einem Viertel oder halben Tag wieder weg (nur Toilette, Brötchen, Tanken), andere
übernachten oder bleiben Tage. Besondere Tage (Sturm, Regen, Regatta, Hanse-Woche, Mittsommer ...) haben
eigene Anlässe. Die Regatta wird echt: Boote laufen morgens aus, segeln draußen ein Feld mit Tonnen ab,
kommen abends wieder herein und übernachten. Neuentwurf und neues Balancing sind ausdrücklich erlaubt.

Projektregel bleibt: keine Dialoge, keine Figuren mit Namen. Eine Geschichte zeigt sich durch das, was
das Boot und seine Leute im Hafen tun, durch eine kurze Zeile auf der Bootskarte und einen Eintrag im
Logbuch.

Thread: "Längere Tage und Bootsgeschichten einbauen". Stand: Plan (Teil 0).

---

## 1. Was heute ist (Bestand, main am 15.11.)

| Bereich | Heute | Wo |
|---|---|---|
| Tageslänge | 90 s Tag + 30 s Abend, Saison 30 Tage, Winter 3 Tage | `economy.js` `zeit` |
| Ankünfte | 4/11/16/18/20/20 je Stufe, zufällige Abstände 3 bis 8 s, höchstens 20 am Tag | `sim.startDay`, `placeArrivals` |
| Aufenthalt | nur ganze Nächte (S 1-3, M 2-4, L 2-5, XL 1-3); abgerechnet nachts, abgelegt am nächsten Vormittag | `sim.night`, `departWindow` |
| Tagestörn | 35 % der Gäste mit 2+ Nächten fahren tagsüber raus, Box bleibt reserviert | `sim.planTrips`, `boat-view.js` |
| Ereignisse | Nebel, Sommertag, Sturm, Regatta, Hafenfest, Mittsommer, Heringstage, Holzboote, Hanse-Woche; wirken als Faktoren auf Ankünfte und Bootsarten | `events/*`, `economy.ereignisse` |
| Regatta | nur Faktoren (mehr Segler, Startgeld, freigehaltene Plätze), auf dem Wasser passiert nichts | `events/vorbereiten.js` |
| Menschen | Crews gehen an Land zu WC, Dusche, Kiosk, Restaurant, Strand; zufällige Ziele | `render/people.js` |
| Spieldauer | etwa 259 Spieltage, rund 8,5 h bei 1x; Stufe 1 etwa 14 Tage = 28 min | Messung P12/P17 |

Ergebnis: Ein Tag ist ein kurzer Takt, in dem Boote ankommen und am nächsten Morgen gehen. Innerhalb des
Tages passiert wenig, jedes Boot verhält sich gleich.

## 2. Ziel in einem Satz

Weniger Tage, die sich lohnen: ein Tag dauert fünf Minuten, hat einen erkennbaren Ablauf von Morgen bis
Abend, und jedes Boot bringt einen eigenen Anlass mit, der bestimmt, wann es kommt, wie lange es bleibt,
was seine Leute an Land tun und was es sich wünscht.

## 3. Umbau des Spielaufbaus

### 3.1 Tageslänge und Tagesablauf

- **Tag 270 s, Abend 30 s** (zusammen fünf Minuten). Die Uhr im Spiel läuft weiter von 7:00 bis 21:00,
  alles, was als Tagesanteil gerechnet ist (Ankunftsfenster, Abreise, Tagestörn), streckt sich von selbst.
- Was in echten Sekunden gerechnet ist, bleibt in Sekunden, weil es sich so anfühlen soll: Geduld an der
  Boje (30 s), Selbst-Einfahren (8 s), Anfahrt, Ablegen. Tempo 1x/3x/8x bleibt, nichts drosselt
  automatisch.
- Der Tag bekommt erkennbare Abschnitte (nur als Anteile, keine neue Oberfläche):

| Abschnitt | Uhrzeit | Was typisch passiert |
|---|---|---|
| Früh | 7:00 bis 9:00 | Angler und Regattaboote laufen aus, Übernachter legen ab, Brötchenholer |
| Vormittag | 9:00 bis 12:00 | Abreisen, erste Kurzhalte (WC, Tanken, Proviant), Crewwechsel |
| Mittag | 12:00 bis 14:00 | Mittagessen im Ort, Eis, Badepause, Tagestörns draußen |
| Nachmittag | 14:00 bis 18:00 | Hauptankunft der Übernachter, Tagestörns kommen zurück |
| Abend | 18:00 bis 21:00 | späte Ankünfte, Regatta kommt rein, Grill, Rundgang des Hafenmeisters |

### 3.2 Aufenthalt in Tagesanteilen (neu: Kurzhalt)

- Neben `nights` bekommt ein Boot `bleibt` (Tagesanteil, zu dem es wieder ablegt) für Aufenthalte ohne
  Nacht. Ein Kurzhalt dauert ein Achtel bis ein halber Tag (etwa 35 bis 135 s Spielzeit).
- Ablauf Kurzhalt in `sim.js`: anlegen wie heute, **Tagesliegegeld** beim Festmachen (Anteil vom
  Nachtpreis, Vorschlag 40 %), Bändchen wie heute, beim Erreichen von `bleibt` Bewertung, Gast zählt,
  Box wird über den bestehenden Weg `startLeaving` frei ('boot:ablegen', 'boot:aus-box').
- Neues Ereignis `kurzAb` (sim) bzw. dieselben Ereignisse wie die Abreise (`departed` mit `kurz: true`),
  damit Tagesbericht, Gästebuch, Ruf, Logbuch und Stammgäste ohne Sonderweg mitzählen.
- Kurzhalter, die bis zum Abend nicht dran waren (an der Boje gewartet), fahren weiter statt zu
  übernachten; das ist keine Abweisung mit schlechter Bewertung, sondern "nicht mehr gebraucht".

### 3.3 Ankünfte nach Anlass statt gleichmäßig

- Die Zahl der Boote am Tag steigt (Vorschlag unten), die Abstände bleiben unregelmäßig (Regeltests
  "Keine Wellen" und "Kein Fließband" bleiben grün).
- `placeArrivals` würfelt weiterhin die Zeitpunkte. Neu: Danach werden die Boote den Zeitpunkten nach
  ihrem Anlass zugeordnet. Jede Geschichte nennt ein bevorzugtes Fenster (Kurzhalt Vormittag/Mittag,
  Übernachter Nachmittag/Abend, Angler früh zurück). So bleibt der Takt gleichmäßig, aber der Tag hat
  einen Rhythmus.
- Der Abstand an den vollsten Tagen (`ankunftDichte`) sinkt nicht unter 4 s; im 243-s-Fenster passen
  bis zu 60 Boote.

### 3.4 Vorschlag Zahlen (wird mit "Aufstieg ausbalancieren" abgestimmt)

`data/economy.js` gehört dem Balancing-Thread (P17). Der Vorschlag hier ist der Ausgangspunkt, P17
richtet seine Schlussmessung (`tools/balance.mjs`) darauf aus und legt die endgültigen Werte fest.

| Größe | Heute | Vorschlag | Grund |
|---|---|---|---|
| `zeit.tagSekunden` | 90 | 270 | Wunsch Jorven: Tag etwa 5 min |
| `zeit.abendSekunden` | 30 | 30 | Kassieren bleibt kurz |
| Ankünfte je Stufe | 4/11/16/18/20/20 | 10/26/38/44/50/50 | etwa 2,5-fach; rund 40 % davon Kurzhalte |
| Tagesliegegeld (neu) | - | 0,4 x Nachtpreis | Kurzhalter zahlen weniger, sind aber häufig |
| Gast zählt für Stufenziel | bei Abreise | Kurzhalter zählt voll | einfach und sichtbar; Ziele steigen mit |
| Stufenziele Gäste | 20/120/360/560/840 | P17 misst (Richtwert etwa x1,1) | Zielzeit je Stufe in Echtzeit wie heute |
| Saison / Winter | 30 / 3 Tage | 16 / 2 Tage | eine Saison etwa 1,5 h Echtzeit statt 2,5 h |
| Ereignisabstände `alleTage`, `saison`, `amTag` | Tage in 30er-Saison | auf 16er-Saison umrechnen | Ereignisse ähnlich oft pro Stunde Spiel |
| Versorgungskapazität (WC, Dusche, Essen) | je Tag | etwa x2 | mehr Leute am Tag |
| Ruf über 3 Tage | 3 Tage = 6 min | 2 Tage = 10 min | reagiert weiterhin spürbar |
| Spieltage gesamt | etwa 259 | etwa 100 bis 110 | Gesamtdauer in Echtzeit etwa gleich (8 bis 9 h) |

Was damit gleich bleibt: die Echtzeit bis zum nächsten Ausbau. Was sich ändert: In dieser Zeit sieht
man deutlich mehr Boote mit mehr Verschiedenheit, und jeder Tag ist eine kleine Runde mit Ablauf.

Weitere Stellen, die an Tagen hängen und mit umgestellt werden: Tagesziele (Ziel pro Tag x2,5),
Stammgäste (Wiederkehr in Tagen), Dauerlieger-Törns, Bauzeiten in Nächten (bleiben, eine Nacht ist
jetzt einfach länger), Services-Besuche `alleTage`, Winterpause, Zeitraffer-Werkzeug.

### 3.5 Speicherstände

Neue Felder am Boot (`geschichte`, `bleibt`) sind optional; alte Stände laden ohne Migration, Boote ohne
Geschichte bekommen beim Laden eine einfache ("Etappe auf dem Törn"). Neue Zustände unter
`state.modules.geschichten`. Falls nötig `SAVE_VERSION` + Migration in `save/`.

## 4. Bootsgeschichten

### 4.1 Aufbau einer Geschichte

Jede Geschichte ist ein kleiner Ablaufplan aus Bausteinen, die es im Spiel sichtbar gibt:

| Baustein | Was man sieht | Technik |
|---|---|---|
| `kommt` | bevorzugtes Ankunftsfenster | Zuordnung nach `placeArrivals` |
| `bleibt` | Kurzhalt bis Tagesanteil x, oder n Nächte | `boat.bleibt` / `boat.nights` |
| `landgang` | Leute gehen zu bestimmten Zielen (WC, Bäcker, Ort, Tankstelle, Bushaltestelle) | `render/people.js` bekommt Ziele je Boot |
| `crew` | Leute steigen aus (mit Gepäck, zur Straße) oder neu zu | Figuren mit Tasche, Weg zum Parkplatz |
| `toern` | Boot fährt tagsüber raus und kommt in dieselbe Box zurück | bestehender Tagestörn |
| `tanken` | legt vor dem Platz am Tanksteg an (ab Stufe 4) | Zwischenhalt in der Anfahrt |
| `wunsch` | bestimmte Wünsche sind sicher (WC beim WC-Stopp, Strom bei Reparatur) | `rollWishes` mit Vorgabe |
| `wetter` | reagiert auf Regen/Sturm/Nebel (bleibt länger, kommt früher) | `mods` des Tages |
| `text` | eine Zeile auf der Bootskarte, ein Logbuchsatz | `data/geschichten.js` |

### 4.2 Gegen Wiederholung

- Rund 50 Alltagsgeschichten plus rund 14 Anlässe für besondere Tage.
- Jede Geschichte hat Varianten: Herkunfts- und Zielhafen (etwa 40 echte Häfen an Ostsee und Nordsee,
  passend zur Stufe; Stufe 1 und 2 nur Orte am See), Crew (allein, zu zweit, Familie, Gruppe, Verein),
  Detail (was genau gebraucht wird). Das ergibt mehrere tausend Kombinationen.
- Regeln (`state.modules.geschichten.zuletzt`):
  1. Dieselbe Geschichte höchstens einmal je Tagesabschnitt und Tag.
  2. Dieselbe Geschichte im selben Abschnitt frühestens wieder nach 3 Tagen; zu anderer Zeit früher.
  3. Dieselbe vollständige Kombination (Geschichte + Herkunft + Crew + Detail) nie zweimal im Spielstand
     (Merkliste der letzten 400, als kurze Schlüssel).
  4. Gewichte nach Stufe, Bootsart, Jahreszeit, Wetter und gebauten Angeboten (Tanken nur mit Tankstelle,
     Reparatur nur mit Ausrüster oder Werft, Fischbrötchen nur mit Räucherei). Was der Hafen nicht hat,
     kommt nicht vor, damit nichts verspricht, was nicht geht ("Fertig heißt spielbar").
- Alles über den Spielzufall (`random.js`), kein `Math.random` in den Regeln.

### 4.3 Katalog Alltag (50)

S = klein, M = mittel, L = groß, XL = sehr groß. "Kurz" = Kurzhalt ohne Nacht.

**Kurzhalt (bleibt 1/8 bis 1/2 Tag)**

| Nr | Anlass | Größen | Ab Stufe | Was passiert |
|---|---|---|---|---|
| 1 | Nur kurz aufs WC | S M | 1 | eine Person geht zum WC, gleich wieder weg |
| 2 | Brötchen holen | S M L | 1 (Bäcker) | früh, eine Person zum Bäcker, Rückkehr mit Tüte |
| 3 | Eis essen | S M | 1 | alle an Land zur Eisdiele/Kiosk, Mittag |
| 4 | Badepause | S | 1 | Leute gehen zum Strand, nach einer Weile zurück |
| 5 | Ruderer-Rast | S | 1 | Ruderboot, Leute setzen sich auf die Bank |
| 6 | Kaffeepause | S M | 2 | zum Hafencafé |
| 7 | Mittagessen im Ort | S M L | 2 | Gruppe läuft in den Ort, kommt nach Mittag zurück |
| 8 | Proviant für den Törn | M L | 2 | zwei Personen in den Ort, kommen mit Taschen zurück |
| 9 | Fischbrötchen | S M L | 2 (Räucherei) | zur Räucherei |
| 10 | Wasser bunkern | M L | 2 | Schlauch am Steg, bleibt kurz |
| 11 | Jemand steigt aus | M L | 2 | Person mit Gepäck geht zur Straße |
| 12 | Jemand steigt zu | M L | 2 | Person mit Gepäck kommt vom Ort, geht an Bord |
| 13 | Regenschauer abwarten | S M | 2 | nur bei Regen, bleibt bis der Schauer vorbei ist |
| 14 | Hafenstempel und Postkarte | M | 2 | zum Hafenbüro/Kiosk |
| 15 | Hund ausführen | S M | 2 | eine Person mit Hund am Uferweg |
| 16 | Wetterbericht holen | M L | 3 | zum Hafenbüro, legt ab, wenn draußen ruhig |
| 17 | Tanken | M L XL | 4 (Tankstelle) | legt am Tanksteg an, dann weiter |
| 18 | Ersatzteil kaufen | M L | 3 (Ausrüster) | zum Bootsausrüster, kommt mit Teil zurück |
| 19 | Fäkalientank absaugen | M L | 4 | kurz an der Absauganlage |
| 20 | Kurzer Landgang zum Strand | M L | 3 | Familie mit Taschen zum Strand |
| 21 | Fahrräder leihen für den Nachmittag | M L | 3 (Fahrradverleih) | Leute radeln los, kommen abends zurück, legen ab |
| 22 | Einkaufen im Supermarkt | M L | 3 | zwei Personen mit Rucksack in den Ort |

**Eine Nacht**

| Nr | Anlass | Größen | Ab Stufe | Was passiert |
|---|---|---|---|---|
| 23 | Etappe auf dem Törn | S M L | 1 | kommt nachmittags, früh weiter |
| 24 | Spät noch reingekommen | M L | 2 | kommt kurz vor Abend, alle gleich an Bord |
| 25 | Abendessen im Hafen | M L | 2 | abends Restaurant, morgens weiter |
| 26 | Grillabend | S M | 2 (Grillplatz) | Crew am Grillplatz am Abend |
| 27 | Feierabendsegler bleiben über Nacht | S M | 2 | spätes Kommen, früh weg (Wochenende häufiger) |
| 28 | Vereinsausfahrt | S M | 3 | mehrere kleine Boote derselben Art kommen nacheinander |
| 29 | Neues Boot auf Überführung | M L | 3 | kommt spät, legt sehr früh ab |
| 30 | Duschen und Wäsche | M L | 2 (Dusche) | Wunsch Dusche sicher, morgens Weg zum Sanitär |
| 31 | Erster Törn mit Charterboot | M | 3 | etwas schiefes Anlegen ist erlaubt, Wunsch Strom |
| 32 | Abwettern über Nacht | M L | 3 | bei Starkwind angekündigt, kommt früh |

**Mehrere Nächte**

| Nr | Anlass | Größen | Ab Stufe | Was passiert |
|---|---|---|---|---|
| 33 | Urlaubstörn mit Hafentagen | M L | 2 | 2 bis 4 Nächte, an manchen Tagen Tagestörn |
| 34 | Ort besuchen | S M L | 2 | jeden Tag in den Ort, abends zurück |
| 35 | Crewwechsel | M L | 3 | am zweiten Tag geht die alte Crew mit Gepäck, die neue kommt |
| 36 | Charterwechsel | M L | 3 | Samstags typisch: alle aus, Reinigung, neue Crew |
| 37 | Reparatur, wartet auf Ersatzteil | M L | 3 (Ausrüster) | bleibt, bis das Teil da ist, Wunsch Strom |
| 38 | Mast legen | M L | 3 (Mastenkran) | geht zum Kran und zurück |
| 39 | Segel zum Segelmacher | M L XL | 4 (Segelmacher) | Segel wird an Land getragen, Tage später zurück |
| 40 | Werftaufenthalt | L XL | 4 (Werft) | Boot kommt aus dem Wasser (Travellift), danach wieder rein |
| 41 | Wetterfenster abwarten | L | 3 | bleibt, bis der Wind dreht; bei Sturm länger |
| 42 | Einhand auf großer Fahrt | M L | 3 | lange unterwegs, ruht zwei Nächte, Wäsche, Proviant |
| 43 | Angeltörn | S M | 2 | jeden Morgen sehr früh raus, mittags zurück |
| 44 | Radtour-Basis | M L | 3 (Fahrradverleih) | morgens mit Rädern los, abends zurück |
| 45 | Vogelbeobachtung | S M | 3 | früh raus in den Bodden/aufs Watt, still zurück |
| 46 | Ausbildungstörn | M | 4 (Segelschule) | übt vor der Einfahrt Anlegen und Wenden |
| 47 | Hafentage mit Familie | M L | 2 | Strand, Eis, Spielplatz, Tagestörn |

**Größere Schiffe (L/XL)**

| Nr | Anlass | Größen | Ab Stufe | Was passiert |
|---|---|---|---|---|
| 48 | Tagesfahrt mit Gästen | XL | 5 | morgens steigen Gäste ein, abends aus |
| 49 | Motoryacht zum Restaurant | L XL | 4 | kommt mittags, legt am Abend ab |
| 50 | Klassiker auf Sommerreise | L XL | 4 | Leute schauen vom Steg, bleibt zwei Nächte |

### 4.4 Anlässe für besondere Tage (14)

Kommen nur an den Tagen der Ereignisse aus P24 (`game.events`), ersetzen dort einen Teil der
Alltagsgeschichten.

| Ereignis | Anlass | Was passiert |
|---|---|---|
| Sturm | Schutz suchen | kommt früh und schnell, bleibt bis der Sturm vorbei ist, doppelte Leinen |
| Sturm | Sturmschaden | kommt danach mit Schaden, Reparatur (braucht Ausrüster/Werft, sonst weiter) |
| Regen | Kneipentag | Crew bleibt im Restaurant, Boot bleibt eine Nacht länger |
| Regen | Nur kurz abwettern | Kurzhalt, solange es regnet |
| Nebel | Im Nebel rein | kommt langsam, wartet an der Boje, bis der Nebel lichter wird |
| Sommertag | Badegäste | viele kleine Boote mit Kurzhalt am Strand |
| Regatta | Teilnehmer | kommt am Vortag, läuft morgens aus, segelt das Feld, kommt abends, übernachtet |
| Regatta | Begleitboot | Motorboot fährt mit hinaus, liegt am Startschiff |
| Regatta | Zuschauer | kleines Boot fährt zur Bahn und schaut, kommt mittags zurück |
| Hafenfest | Festbesuch | kommt nachmittags, Leute gehen zum Fest, Nacht |
| Mittsommer | Feuer schauen | kommt abends, Crew zum Feuer, Nacht |
| Heringstage | Fischmarkt | Kurzhalt zur Räucherei, Taschen voll |
| Holzboote | Klassikertreffen | Holzboote liegen nebeneinander, Leute schauen |
| Hanse-Woche | Traditionssegler-Gäste | große Segler mit Gästen, Tagesausfahrten, Fest |

### 4.5 Sichtbar im Spiel

- **Bootskarte**: eine Zeile unter dem Namen, zum Beispiel "Aus Kappeln. Nur kurz aufs WC, will mittags
  weiter nach Schleimünde." Dazu ein kleiner Zeitstrich, wann das Boot wieder fährt (Kurzhalt) bzw. wie
  viele Nächte.
- **Im Hafen**: Leute gehen gezielt dorthin, wo die Geschichte sie hinschickt; Gepäck beim Crewwechsel;
  Boot fährt zum Tanksteg; Tagestörn; Angler früh raus.
- **Logbuch**: neue Seite "Geschichten": welche Anlässe man schon gesehen hat (x von 64). Das gibt
  Langzeitziel und Erfolge (über P22 einhängen).
- **Meldungen**: nur über `game.meldungen` und nur für Seltenes (erstmals gesehen), kein Dauerfeuer.
- **Tagesbericht**: Kurzhalter und Übernachter getrennt gezählt.

## 5. Echte Regatta

- **Regattafeld**: draußen auf See vor der Einfahrt (aus `game.gelaende.aussenRect` und den Seezugängen,
  nie über Land, frei vom Ein- und Ausfahrtskorridor): Startlinie zwischen Startschiff und Tonne, eine
  Luvtonne, eine Leetonne (gelbe Tonnen). Wird am Vorabend ausgelegt, nach dem Tag eingeholt.
- **Ablauf am Regattatag**:
  1. Vortag: Teilnehmer kommen (Anlass "Teilnehmer"), freigehaltene Plätze aus P24 werden genutzt.
  2. Früh (7:30 bis 9:00): Teilnehmer laufen nacheinander aus (Ausfahrende haben Vorrang), Boxen bleiben
     reserviert (Schild "Ausflug").
  3. Vormittag: Startsignal (Ton), Boote kreuzen zur Luvtonne, runden, laufen zur Leetonne, zwei Runden.
     Sichtbar mit Segeln und Kielwasser; Reihenfolge ergibt sich aus Bootslänge und etwas Zufall.
  4. Nachmittag: Zieleinlauf, Boote kommen über das normale Fahrwasser zurück in ihre Boxen.
  5. Abend: Siegerehrung am Segelclub (Leute versammeln sich), Ergebnis im Logbuch, alle übernachten.
- **Technik**: neues Modul `web/js/events/regatta-feld.js` (Tonnen, Bahn, Zeitplan) und Erweiterung des
  Tagestörns um eine Route mit Wegpunkten. Startgeld und Ergebnis bleiben in `events/vorbereiten.js`.
- **Abstimmung**: Wegsuche und Ablegen gehören "Staus an Bojen und Ankerfeld auflösen"; das Auslaufen
  vieler Boote zugleich wird mit dem Takt der Ausfahrt (`ablegeTakt`) gestaffelt, keine eigene Wegsuche.

## 6. Technik im Überblick

| Datei | Neu/geändert | Inhalt |
|---|---|---|
| `web/js/data/geschichten.js` | neu | Katalog: Ids, Bausteine, Texte, Häfen, Crew-Varianten (keine Zahlen) |
| `web/js/data/economy.js` | geändert (mit P17) | `zeit`, Ankünfte, `geschichten` (Gewichte, Tagesliegegeld), Ereignistage |
| `web/js/geschichten/regeln.js` | neu | reine Logik: Geschichte wählen, Wiederholschutz, Hook `arrival` |
| `web/js/sim.js` | geändert | Kurzhalt (`bleibt`), Tagesliegegeld, Zuordnung der Ankunftszeiten |
| `web/js/geschichten/ablauf.js` | neu, `init(game)` | Bausteine im Spiel auslösen (Landgang, Crew, Tanken) |
| `web/js/render/people.js` | geändert (kleine Schnittstelle) | Ziele je Boot, Gepäck |
| `web/js/events/regatta-feld.js` | neu | Regattafeld und Ablauf |
| Bootskarte, Logbuch | geändert | Geschichtszeile, Seite "Geschichten" |
| `tests/geschichten.test.mjs` | neu | Wiederholschutz, Kurzhalt, keine Wellen, Speicherstand |

## 7. Teil-PRs (Reihenfolge)

1. **Plan** (dieses Dokument, Arbeitsplan-Eintrag).
2. **Längere Tage und Kurzhalt**: Tageslänge, Kurzhalt-Mechanik, Tagesliegegeld, Ankünfte nach Fenster,
   Zahlen mit P17. Tests: Spieltag, Kassieren, Tagesziele, Zeitraffer.
3. **Geschichten Alltag**: Katalog 50, Wiederholschutz, Bootskarte, Logbuch-Seite, Menschenwege.
4. **Anlässe für besondere Tage**: 14 Ereignis-Anlässe an P24 angebunden.
5. **Echte Regatta**: Regattafeld, Auslaufen, Bahn, Rückkehr, Siegerehrung.
6. **Feinschliff**: im laufenden Spiel an Handy und PC ansehen, Bilder unter
   `/mnt/project-files/bootsgeschichten/`.

## 8. Entscheidungen dieses Threads (selbst getroffen, Jorven 12.11.: nicht warten)

- Tag 270 s + 30 s Abend, Gesamtspielzeit in Echtzeit bleibt etwa gleich, dafür weniger und vollere Tage.
- Kurzhalter zählen als Gast und zahlen ein Tagesliegegeld (40 % des Nachtpreises, P17 kann anpassen).
- Geschichten ohne Personen-Namen und ohne Dialoge; Herkunft und Ziel sind echte Häfen.
- Ein Anlass, der ein nicht gebautes Angebot braucht, kommt nicht vor.
- Saison 16 Tage + 2 Tage Winter (Vorschlag an P17), Ereignistage werden umgerechnet.

## 9. Kollisionen mit anderen Threads

| Thread | Berührung | Absprache |
|---|---|---|
| Aufstieg ausbalancieren (P17) | alle Zahlen in `economy.js`, Schlussmessung | Vorschlag 3.4, P17 legt fest |
| Staus an Bojen und Ankerfeld auflösen | Ablegen, Wegsuche, viele Ausfahrten am Regattamorgen | keine eigene Wegsuche, Takt nutzen |
| Ereignisse (P24, fertig) | Ereignistage, Vorbereiten, Startgeld | nur einhängen, nichts doppeln |
| Menschen (people.js) | Ziele je Boot, Gepäck | kleine Schnittstelle `game.people.ziele(bootId, liste)` |
| Logbuch und Erfolge | neue Seite, Erfolge | über deren Schnittstellen |
| Statistik und Saisonbilanz (P41) | Tagesbericht, Saisonlänge | Kurzhalter getrennt melden |
| Zeitraffer-Werkzeug | Tageslänge | liest `dayLength` aus den Regeln |
