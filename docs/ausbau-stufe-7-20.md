# Ausbau Stufe 7 bis 20: vom Seehafen zum Hafenverbund

Stand: 13.11.2026, abgeglichen mit `main` bei Commit `87c7016` (PR 218). Status: **Planung. Nichts davon ist im Spiel.** Auftrag von Jorven (13.11.2026): die Stufen nach Stufe 6 bis Stufe 20 vorausplanen, noch nichts bauen, aber so, dass alles zu Bestehendem und zu den geplanten Paketen passt und am Ende ein riesiges Hafen-Imperium möglich ist.

**Verhältnis zu den anderen Dokumenten:** [plan.md](plan.md) bleibt der gültige Plan für Vision, Regeln und Entscheidungen. Dieses Dokument beschreibt, wie es nach Stufe 6 weitergeht. Die Arbeitspakete dazu stehen als **Welle 6** in der [Roadmap](roadmap.md#welle-6-ausbau-stufe-7-bis-20-nach-welle-4-und-p57). Zahlen in diesem Dokument sind **Richtwerte**; was gilt, steht später nur in `web/js/data/economy.js` und wird mit `tools/balance.mjs` festgelegt.

**Regel für Doku und Spiel:** Einstieg, Hilfe, Karten, Baumodus, Aufstiegsfeier und [aenderungen.md](aenderungen.md) erwähnen eine Stufe ab 7 erst, wenn genau diese Stufe gebaut ist und am Handy und am PC spielbar ist ("Fertig heißt spielbar", [abnahme.md](abnahme.md)). Bis dahin endet das Spiel sichtbar mit Stufe 6 und dem Endlosspiel.

---

## 1. Die Idee in drei Sätzen

1. Ein einzelner Hafen wächst nicht endlos weiter: Ab Stufe 6 ist der Hafen voll (94 Gastplätze plus Großschiffpier), mehr Boote in einer Szene machen das iPhone langsam und die Bedienung unübersichtlich.
2. Deshalb wächst das Imperium so, wie echte Marinagruppen an der Ostsee wachsen: Der Heimathafen bekommt noch drei große Ausbauten (Stufe 7 bis 9), danach übernimmt der Spieler weitere Häfen an der Küste und baut sie zu einem **Hafenverbund** mit eigenen Spezialhäfen aus (Stufe 10 bis 20), bis hin zur Nordsee und einem Kanalhafen zwischen beiden Meeren.
3. Jeder Hafen im Verbund ist ein ganz normaler Hafen des heutigen Spiels (eigene Küste aus Typ und Seed, eigenes Stegbild, Ausbaustufen, Regeln, Services). Das Spiel zeigt immer nur einen Hafen in 3D; die anderen laufen mit der Hafenleitstelle von selbst weiter.

So bleibt alles, was heute gebaut ist, gültig und wiederverwendbar: Spielregeln (`sim.js`), Liegeplatzdaten (`harbor.js`), Gelände aus Seed (`natur.js`), Services, Hafenbüro mit Automatik, Speichern.

## 2. Leitlinien, die bleiben

| Leitlinie aus plan.md | Wie der Ausbau sie einhält |
|---|---|
| Cozy, kein Scheitern | Kein Standort kann verloren gehen, keine Schulden. Ein schlecht laufender Standort bringt nur weniger. |
| Keine laufenden Kosten, kein Personal | Übernahmen und Bauprojekte kosten einmal. Kein Unterhalt, keine Gehälter, auch nicht für Standorte. |
| Kein Logistik-Puzzle, keine Lieferketten | Fähren, Werft und Offshore-Versorger sind Besuche und Abfahrten mit Geld je Fahrt, wie heute Kreuzfahrt und Ausflugsschiff. Keine Waren, keine Ketten. |
| Eine Ansicht | Immer genau ein Hafen in 3D. Der Wechsel zu einem anderen Standort geht über **Hafenkarten** (Postkarten mit Vorschaubild, wie bei den Speicherplätzen), nicht über eine zweite Karte. Siehe Abschnitt 7. |
| Nur zwei Zahlen: Geld und Ruf | Eine gemeinsame Kasse für den Verbund. Ruf zeigt der Hafen, in dem man gerade ist. Ziele, die den Verbund betreffen, nennen den Ruf je Standort. |
| Feste Bauplätze | Auch neue Anlagen haben feste Plätze aus den Hafendaten. Standorte kommen als feste Angebote, nichts wird frei platziert. |
| Wenige neue Dinge je Stufe | Jede Stufe bringt **eine** neue Sache, die man sieht und tut (Tabelle in Abschnitt 3). |
| Nur Ostsee und Nordsee, keine Story, keine Figuren | Alle Standorte liegen an Ost- oder Nordsee, mit erfundenen Namen. Keine Personen mit Namen, auch kein "Hafenleiter" je Standort. |
| Keine Einnahmen bei geschlossenem Spiel | Andere Standorte rechnen nur, während das Spiel läuft (jede Nacht im Spiel), nie für die Zeit, in der es zu war. |
| Nah am echten Hafenleben | Vorbilder aus der Wirklichkeit, Abschnitt 4. |

## 3. Die Stufen 7 bis 20

Die Stufe, die der Spieler sieht, ist eine Zahl von 1 bis 20. Bis Stufe 6 ist sie die Ausbaustufe des Heimathafens, wie heute. Ab Stufe 7 heißt sie **Verbundstufe**: Jede Stufe wird mit einem großen Bauprojekt oder einer Übernahme gekauft, wenn ihr Ziel erreicht ist (wie heute `stufen[].ziel` und `ausbau`). Jeder Standort hat daneben seine eigene **Ausbaustufe** 1 bis 9 mit den heutigen Stegprojekten, Versorgung und Services.

| Stufe | Name | Wo | Was dazukommt (die eine neue Sache) | Großes Projekt | Kosten (Richtwert) | Ziel, um es zu kaufen (Richtwert) |
|---|---|---|---|---|---|---|
| 7 | Hafenstadt | Heimathafen, Ausbaustufe 7 | Yachthafen Ost mit Steg E (etwa 28 Finger- und Stirnplätze für L und XL) und Hafenpromenade mit Läden. Die Leitstelle bekommt den **Belegungsplan**: je Steg festlegen, wer dort liegt (nur Segler, nur Motorboote, nur L und XL, Dauerlieger). | Yachthafen Ost | 120.000 € | Abschlussziel Stufe 6 erreicht (Regionsabschluss) |
| 8 | Fährhafen | Heimathafen, Ausbaustufe 8 | Fähranleger mit Rampe: eine Inselfähre fährt nach Fahrplan (zwei Abfahrten am Tag), Fahrgäste gehen über die Promenade und füllen Läden und Gastronomie. Bei Sturm fällt die Fähre aus. | Fähranleger | 180.000 € | 600 Gäste in Stufe 7, Ruf 4,5 |
| 9 | Werfthafen | Heimathafen, Ausbaustufe 9 | Werft mit Schiffslift für XL und großes Winterlager: Traditionssegler und Großyachten kommen im Winter zum Überholen, im Frühjahr laufen sie frisch gestrichen aus. Gibt dem Winter (P20) Arbeit für große Schiffe. | Werft mit Schiffslift | 250.000 € | 40 Fährabfahrten, 700 Gäste in Stufe 8 |
| 10 | Zweiter Hafen | neuer Standort | **Hafenübernahme:** Drei Angebote alter Häfen an der Küste (Küstentyp und Seed fest gewürfelt, als Postkarte mit Bild). Der übernommene Hafen startet mit Ausbaustufe 3 oder 4, Stegen dieser Stufe, aber ohne Versorgung und Services. **Hafenkarten** zum Wechseln. Eine gemeinsame Kasse. | Übernahme | 300.000 € (200.000 bis 400.000 je nach Angebot) | Heimathafen Ausbaustufe 9 mit allen Plätzen, Ruf 4,6 |
| 11 | Hafengruppe | Verbund | **Gästeweitergabe und Törngäste:** Ist ein Hafen voll, schickt die Leitstelle ein wartendes Boot in einen Schwesterhafen, statt es abzuweisen. Törngäste fahren von Hafen zu Hafen und bewerten am Ende den ganzen Törn. Dritter Standort möglich. | Verbundbüro im Heimathafen | 350.000 € | zweiter Standort Ausbaustufe 5 |
| 12 | Spezialhäfen | Verbund | **Hafenprofil** je Standort: Yachthafen, Traditionshafen, Fischereihafen oder Familienhafen. Das Profil ändert Ankunftsmix, Wünsche und welche Services dort Sinn haben. | Profil für jeden Standort (einmal je Standort) | 60.000 € je Profil | drei Standorte, 300 Törngäste |
| 13 | Regattahafen | Verbund, ein Standort mit Segelclub | **Regattawoche** über alle Standorte: Regattabahn vor dem Hafen, Feld aus vielen Jollen und Yachten, Tagesetappen von Hafen zu Hafen. Einmal je Saison. | Regattazentrum | 500.000 € | ein Standort mit Profil Yachthafen Ausbaustufe 6 |
| 14 | Nordseehafen | neuer Standort an der Nordsee | Erster Sielhafen mit Ebbe und Flut im Verbund (Regeln aus P57: Tidenfenster, Trockenfallplätze, Schleuse). | Übernahme Nordsee | 550.000 € | Regattawoche ausgerichtet, Ruf aller Standorte mindestens 4,2 |
| 15 | Offshore-Hafen | Standort mit Kai (Nord- oder Ostsee) | Windpark am Horizont. **Versorger** (Crew-Transfer-Katamarane jeden Morgen hinaus, abends zurück; ein großes Serviceschiff alle paar Tage) bringen feste Einnahmen je Fahrt. Bei Sturm bleiben sie im Hafen. | Offshore-Basis | 750.000 € | Nordseehafen Ausbaustufe 5 |
| 16 | Kreuzfahrthafen | Heimathafen oder ein Standort mit Ausbaustufe 6 | Zweite Kreuzfahrtpier und **Wechselhafen**: Kreuzfahrten beginnen und enden hier, das Schiff bleibt bis zum Abend, Gäste reisen mit Bus und Bahn an (als Menschen sichtbar). | Kreuzfahrtterminal 2 | 900.000 € | 30 Kreuzfahrtbesuche im Verbund |
| 17 | Marinehafen | Standort mit Profil oder Heimathafen | Marinestützpunkt mit mehreren Liegeplätzen: internationale Flottenbesuche, Segelschulschiffe, Tag der offenen Tür. | Marinestützpunkt groß | 1.100.000 € | Offshore-Basis 60 Fahrten, Ruf 4,6 |
| 18 | Großseglertreffen | Verbund, Standort mit Traditionshafen | Jährliches **Großseglertreffen** über mehrere Tage: Einlaufparade, Großsegler liegen in allen Standorten, Feuerwerk am letzten Abend. | Festkai und Ankerplätze für Großsegler | 1.300.000 € | Traditionshafen Ausbaustufe 6, 3 Windjammertreffen |
| 19 | Kanalhafen | neuer Standort am Kanal zwischen Ost- und Nordsee | **Schleusenhafen** an einem erfundenen Kanal: Schiffe aller Größen schleusen durch, Lotsen gehen an Bord, Yachten machen im Kanalhafen Halt. Verbindet Ostsee- und Nordseestandorte für Törngäste. | Kanalschleuse | 1.600.000 € | Ostsee- und Nordseestandorte je Ausbaustufe 6 |
| 20 | Hafenimperium | Verbund | Kein neues Bauwerk: Abschlussfeier über alle Standorte (Kamerafahrt durch jeden Hafen), Titel, danach Endlosspiel über den ganzen Verbund. | keins | | alle Standorte voll ausgebaut, Ruf aller Standorte 4,5, 6 Großseglertreffen oder Regattawochen |

Höchstens **sechs Standorte** (Heimathafen plus fünf): genug für ein Imperium, überschaubar auf dem Handy, Speicher bleibt klein (Abschnitt 6). Die Standorte bis Stufe 19: Heimathafen, zweiter Hafen (10), dritter Hafen (11), Nordseehafen (14), Kanalhafen (19), ein sechster Platz frei für ein späteres Angebot oder eine zweite Übernahme.

**Spielzeit (Ziel für das Balancing):** Stufe 1 bis 6 dauern heute etwa 250 Spieltage (rund 8,5 Stunden bei 1x). Stufe 7 bis 20 sollen zusammen 450 bis 650 Spieltage dauern (rund 15 bis 22 Stunden bei 1x), jede Stufe 25 bis 50 Spieltage. Kein Abschnitt darf mehr als drei Viertel Leerlauf haben (`tools/balance.mjs`, Wert "Leerlauf" in [balancing.md](balancing.md)); jede Stufe bringt neben dem Bauprojekt Entscheidungen (welches Angebot, welches Profil, welcher Standort zuerst).

## 4. Vorbilder aus dem echten Hafenleben

Alle Namen im Spiel sind erfunden, die Vorbilder sind nur Anregung (wie in [vorbilder.md](vorbilder.md)).

| Im Spiel | Echtes Vorbild |
|---|---|
| Hafenverbund, Übernahme alter Häfen | Marinagruppen an der Ostsee, die verfallene Stadt- und Fischereihäfen übernehmen und zu Sportboothäfen umbauen |
| Belegungsplan je Steg | Hafenmeister teilen Stege nach Bootsart und Größe ein, Gastlieger und Dauerlieger getrennt |
| Gästeweitergabe, Törngäste | Hafenpässe mehrerer Häfen, Segeltörns von Hafen zu Hafen, Hafenmeister funken Nachbarhäfen an, wenn sie voll sind |
| Inselfähre | Fährverkehr zu Inseln in Ost- und Nordsee mit festem Fahrplan |
| Werft mit Schiffslift, Winterlager | Werften in Ostseehäfen, die Traditionsschiffe im Winter überholen |
| Regattawoche | große Segelwochen an der Ostsee mit Bahnen vor dem Hafen |
| Sielhafen mit Tide | Sielhäfen an der Nordseeküste ([regionen.md](regionen.md)) |
| Offshore-Hafen | Servicehäfen für Windparks in Ost- und Nordsee mit Crew-Transfer-Katamaranen |
| Kreuzfahrt-Wechselhafen | Kreuzfahrthäfen an der Ostsee, in denen Reisen beginnen und enden |
| Großseglertreffen | jährliche Treffen von Traditionsseglern mit Einlaufparade |
| Kanalhafen mit Schleuse | der Kanal zwischen Ost- und Nordsee mit Schleusen, Lotsen und Yachthäfen an der Strecke |

## 5. Neue Schiffe

Gebaut wie die heutigen Modelle aus dem [Baukasten](hafen-und-schiffe.md#5-baukasten-für-die-modelle). Je Art zuerst zwei Modelle, wie für Version 1.0.

| Art | Größe | Ab Stufe | Rolle |
|---|---|---|---|
| Inselfähre | XXL (60 bis 90 m) | 8 | fester Fahrplan, kein Gast, Geld je Abfahrt |
| Schiffe zum Überholen (Großyacht, Traditionssegler im Lift) | XL | 9 | liegen im Winter an Land in der Werft |
| Crew-Transfer-Katamaran | XL (20 bis 30 m) | 15 | fährt morgens zum Windpark, abends zurück |
| Offshore-Serviceschiff | XXL (80 bis 90 m) | 15 | liegt einige Tage, dann wieder draußen |
| Großes Kreuzfahrtschiff | XXL (bis 250 m) | 16 | Wechseltage, bleibt bis abends |
| Fregatte, Segelschulschiff | XXL | 17 | internationale Flottenbesuche |
| Großsegler (Vollschiff, Bark) | XXL | 18 | Großseglertreffen, Einlaufparade unter Segeln |
| Küstenmotorschiff, Lotsenboot, Schlepper | XL und XXL | 19 | Kanalverkehr, schleust durch, kein Gast |

Große Schiffe liegen nur an fest vergebenen Plätzen (wie heute `pier`, `marine`, `seenotretter`, `gast: false` in `economy.js`) und melden sich bei `game.boatAnim.hindernis` an, damit Gastboote ausweichen.

## 6. Technik: so bleibt es kompatibel

### 6.1 Erst die Stufe-6-Annahmen lösen (Paket P67, vor allem anderen)

Heute gilt an vielen Stellen "die letzte Stufe ist 6". Gefunden am Stand `87c7016`:

| Stelle | Annahme | Was sich ändern muss |
|---|---|---|
| `sim.js` (`regionGoal`, Besuch großer Schiffe, `regionDone`) | Abschlussziel gilt in `maxStage` (= Länge von `stufen`) | eigene Zahl `verbund.abschlussStufe: 6`; sonst wäre der Regionsabschluss mit einer Stufe 7 in den Daten nie mehr zu erreichen |
| `features/aufstieg.js` (Regionsfeier, Endlosspiel) | Region fertig = letzte Stufe | Regionsfeier bleibt bei Stufe 6 ("Hafenmeister der Ostsee"); neue Feier für Stufe 20 |
| `services/rules.js` | `stufen.length` als Ende | unverändert für Services, aber Tests mit Stufe 7 bis 9 |
| `render/landschaft/vielfalt.js` | Stufe auf 1 bis 6 begrenzt | Grenze aus den Daten |
| `render/landschaft/gelaende.js`, `terrain.js`, `strand.js`, `world/fahrwasser.js`, `data/verkehr.js` (`seeBahnen`) | `stufe >= 6` für Pier, Wellenbrecher, Straße, Bahnen | bleibt richtig für 7 bis 9 (größer gleich), wird aber mit Test für Stufe 7 bis 9 abgesichert |
| `economy.js` `warten.plaetze`, `tagesziele.geld` | Schlüssel 1 bis 6 | Einträge 7 bis 9 (ein fehlender Schlüssel darf nie `undefined` ergeben) |

P67 baut nichts Sichtbares. Es macht die Daten erweiterbar und prüft mit einer Test-Stufe 7 (nur in Tests), dass nichts bricht. Danach darf ein Spielstand mit Stufe 6 nie etwas von Stufe 7 sehen, solange Stufe 7 nicht gebaut ist.

### 6.2 Zahlen nur in economy.js

Alles Neue kommt in `web/js/data/economy.js`, gelesen über `data/rules.js` (`rulesFromEconomy`), danach `node tools/zahlen.mjs --schreiben` und `docs/zahlen.md` committen:

| Abschnitt | Inhalt |
|---|---|
| `stufen` | Einträge 7 bis 9 für die Ausbaustufen eines Hafens (Ankünfte, Mix, Ziel, Ausbau mit Platz-ids aus `harbor.js`) |
| `stegprojekte`, `bauwerke`, `services` | neue Projekte mit `stufe` bzw. `abStufe` 7 bis 9 |
| `verbund` (neu) | `abschlussStufe`, `stufen` 7 bis 20 (Name, Ziel, Projekt, Kosten), `maxStandorte`, `uebernahme` (Startstufe, Preise der Angebote), `kurzrechnung`, `weitergabe`, `toern` |
| `profile` (neu) | je Hafenprofil: Faktoren für Ankunftsmix, Wünsche, Services |
| `fahrplaene` (neu) | Fähre, Offshore-Versorger, Kanalverkehr: Abfahrten je Tag, Geld je Fahrt, Sturmregel |
| `endlos` | Saisonziele ab Stufe 10 über den ganzen Verbund |

Kein `Math.random` in Regeln. Alles Zufällige (Angebote, Kurzrechnung) kommt aus `seed`/`rng` mit Standort-id und Tag.

`tools/balance.mjs` bekommt `--bis 20` und spielt den ganzen Weg durch, damit Spielzeit und Leerlauf je Stufe gemessen werden.

### 6.3 Liegeplätze und Gelände bei wachsender Fläche

- **Liegeplätze:** Stufe 7 bis 9 kommen wie heute aus der Zeichnung (`skripte/konzeptbilder/hafen_von_oben.py`) nach `harbor.js` (`python3 skripte/liegeplaetze_export.py`). Bestehende Platz-ids bleiben, neue Stege bekommen neue Buchstaben (E und folgende). Positionen immer über `HAFEN` und `game.stege.platz(id)`, nie fest im Code.
- **Gelände:** Die Ausbauten graben sich wie ab Stufe 3 ins Land (`graben`, `wellenbrecher(stufe)` in `natur.js`). Sie dürfen den Bedarf der Stufen 1 bis 6 (`BEDARF`) **nicht** ändern, sonst sähen alte Spielstände mit ihrem Seed plötzlich anders aus. Was erst ab Stufe 7 nötig ist, kommt in eigene Bedarfsflächen, die nur ab dieser Stufe gelten.
- **Jeder Küstentyp muss jede Stufe schaffen:** `node tools/seeds-pruefen.mjs` und `tests/gelaendeform.test.mjs` prüfen zusätzlich Stufe 7 bis 9 in allen zehn Typen und beiden Revieren. Wo eine Lage nicht passt (Insel, enge Förde), nimmt der Typ eine Ausweichlage auf der anderen Hafenseite, die ebenfalls geprüft ist. Kein Spielstand darf beim Aufstieg ohne Platz dastehen.
- **Fahrwasser:** Fähre (etwa 5 m Tiefgang), großes Kreuzfahrtschiff und Offshore-Serviceschiff brauchen zusammenhängend tiefes Wasser bis zum Kartenrand. `node tools/fahrwasser-pruefen.cjs --gelaende 1-10` bekommt die neuen Tiefgänge.
- **Welt und Kamera:** Die Welt (`WELT`, etwa 1,6 mal 1,3 km Spielbereich) reicht für Stufe 7 bis 9; `spielRect()` wächst mit, `rig.maxWidth` bleibt bei höchstens 1000 m, damit das Handy schnell bleibt.
- **Neue Standorte** brauchen keine neue Geländetechnik: Jeder Standort hat eigenes `{ nr, seed }` und eigenes Stegbild. Nur der Kanalhafen (Stufe 19) braucht einen neuen Küstentyp 11 "Kanal" (Deiche, Schleuse, gerader Kanal), der wie die anderen zehn geprüft wird.

### 6.4 Spielstand und Migration

- **Eine Speicherdatei je Verbund.** Der heutige Spielstand bleibt der Stand des gerade aktiven Hafens. Neu ist `state.modules.verbund`:

```js
modules.verbund = {
  stufe: 12,                 // Verbundstufe 1..20, die der Spieler sieht
  aktiv: 'heimat',           // id des Standorts, der gerade in 3D läuft
  standorte: [
    { id: 'heimat', name: 'Hafen am Haken', region: 'ostsee', gelaende: { nr: 9, seed: 4711 },
      stegbild: 3, ausbau: 9, profil: null },                       // aktiv: Stand liegt in state
    { id: 's2', name: 'Alter Fischerhafen', region: 'ostsee', gelaende: { nr: 4, seed: 812 },
      stegbild: 7, ausbau: 5, profil: 'tradition', kurz: { /* siehe unten */ } },
  ],
}
```

- **Migration:** `SAVE_VERSION` 2 auf 3 in `web/js/save/storage.js`. `MIGRATIONS[2]` legt `modules.verbund` mit genau einem Standort an (dem bisherigen Hafen, `stufe` = `state.stage`). Test in `tests/speicherplaetze.test.mjs`: jeder Stand der Versionen 1 und 2 lädt und spielt weiter wie vorher.
- **Inaktive Standorte** speichern keine einzelnen Boote, nur die Kurzform `kurz`: gebaute Projekte, Bauwerke, Services, Dauerlieger, Ruf-Fenster, Belegung je Klasse, Tageszahlen der letzten Tage. Ziel: höchstens 30 KB je Standort, der ganze Verbund unter 250 KB, damit acht Speicherplätze weiter in den Browserspeicher passen ([speichern.md](speichern.md)).
- **Prüfung beim Laden** wie heute streng (`deserialize`, Audit C03): jeder Standort einzeln, Platz-ids gegen `harbor.js`, Zahlen begrenzt. Standortnamen werden nie per `innerHTML` gezeigt (Audit C05).
- **Eine Kasse:** `state.money` gehört dem Verbund. Beim Wechsel wandert das Geld mit.
- **Speicherplätze bleiben:** Ein Speicherplatz ist ein ganzer Verbund. Der Name im Verzeichnis ist der Name des Heimathafens, `info.stufe` die Verbundstufe.

### 6.5 Andere Standorte rechnen von selbst (Kurzrechnung)

- Nur der aktive Hafen läuft mit `sim.js` in Echtzeit und in 3D.
- Jeden Abend im Spiel rechnet jeder andere Standort seinen Tag in einem Schritt: Ankünfte nach Ausbaustufe, Ruf und Profil, Belegung bis zur Platzzahl, Liegegeld mit Wünschen nach gebauter Versorgung, Services, Dauerlieger, Ruf aus den Bewertungen. Die Hafenleitstelle gilt dort als gebaut; Sonderfälle nimmt sie nach der heutigen 25-Sekunden-Regel selbst.
- **Abgleich mit den echten Regeln:** Ein Test spielt einen Standort 30 Tage mit `sim.js` ohne Grafik (wie `tools/balance.mjs`, Spieler mit Leitstelle) und 30 Tage mit der Kurzrechnung. Einnahmen und Ruf dürfen höchstens 10 % abweichen. Sonst lohnt es sich, Standorte absichtlich nicht zu besuchen, oder es lohnt sich nie.
- **Wechsel:** Der verlassene Hafen wird zur Kurzform, der Zielhafen bekommt aus seiner Kurzform eine passende Belegung (Boote aus dem Katalog nach Klasse, mit `rng`). In der ersten Fassung wie der Wechsel der Speicherplätze: speichern, Seite neu laden. Ein Wechsel ohne Neuladen kommt erst, wenn die Messung (Abschnitt 6.6) zeigt, dass die alte Szene vollständig freigegeben wird.
- **Tagesabschluss** zeigt die Einnahmen je Standort als eigene Zeilen (Quelle `standort` in `sim.QUELLEN`, Tagesabschluss P15).

### 6.6 Leistung am iPhone

Messgrundlage wie in [landschaft.md](landschaft.md#leistung) (Qualität niedrig, Handy) und der Leistungstest des Kamera-Threads. Budget je Szene, gilt ab Stufe 7 als Abnahmebedingung:

| Größe | Grenze (Handy) |
|---|---|
| Bildzeit in der Startansicht | höchstens 10 % mehr als Stufe 6 am selben Gerät und Seed |
| Dreiecke in der Startansicht | etwa 80.000 |
| Gastplätze in einem Hafen | höchstens etwa 130 (heute 94) |
| Menschen gleichzeitig | so viele wie heute, nicht mehr |
| Andere Standorte | werden nie gezeichnet, nur ihr Vorschaubild |

Dafür nötig (Paket P68): Detailstufen für liegende Boote (nah volles Modell, mittel vereinfacht, fern ein Block mit Farbe), gleiche Modelle gesammelt zeichnen, liegende Boote schaukeln im Shader statt einzeln animiert, große Schiffe in der Ferne ohne Kleinteile. Jede Stufe ab 7 misst vor dem Merge auf Handy und PC und schreibt die Zahlen in ihren PR.

## 7. Bedienung bei sehr großen Häfen und vielen Standorten

| Problem | Lösung | Paket |
|---|---|---|
| Wo wartet ein Boot? | Zeiger am Bildrand zu wartenden Booten (wie P55 "Bed P3"), Tippen auf den Zeiger fährt die Kamera hin; ein zweites Tippen springt zum nächsten | P69 (baut auf P55) |
| Steg finden | Stegschilder antippen fährt hin; zweimal tippen zeigt den ganzen Steg mit freien Plätzen | P69 |
| Viele gleiche Entscheidungen | Belegungsplan je Steg (Stufe 7): die Leitstelle hält sich daran, der Spieler entscheidet nur noch Sonderfälle | P70 |
| Viele Münzen | Kassenautomat und Hafenhorn (P26) decken das ab, im Verbund kassiert die Leitstelle | vorhanden, P26 |
| Zwischen Häfen wechseln | **Hafenkarten:** Im Hafenbüro und über einen Knopf in Daumenreichweite eine Reihe Postkarten, je Standort Vorschaubild, Name, Ausbaustufe, Ruf, heutige Einnahmen. Tippen wechselt. Kein Pop-up, wenn anderswo etwas passiert, nur ein ruhiger Punkt an der Karte. | P73 |
| Überblick über alles | Tagesabschluss mit Zeilen je Standort, Saisonbilanz des Verbunds (P41) | P15, P41 |

Am Handy liegen alle neuen Knöpfe unten in Daumenreichweite, im Pixel-Stil mit Symbolen aus `ui/pixel-symbole.js` und Pixelify Sans, wie die ganze Oberfläche ([ui/oberflaeche.md](ui/oberflaeche.md)).

## 8. Zusammenspiel mit geplanten Paketen

| Paket | Wie es zum Ausbau passt |
|---|---|
| P16 Aufstieg und Endlosspiel | Regionsfeier bleibt bei Stufe 6. Danach erscheint das Projekt der Stufe 7 im Baumodus unter "Als Nächstes" (nur wenn gebaut). Saisonziele und Ränge laufen weiter; ab Stufe 10 zählen sie über den Verbund. Neue große Feier bei Stufe 20. |
| P18 Bauen in Bauabschnitten | Große Projekte ab Stufe 7 nutzen die Bauabschnitte (Baustelle sichtbar über mehrere Tage). |
| P20 Winter | Werft und Winterlager (Stufe 9) brauchen den Winter mit Inhalt; Stufe 9 startet erst nach P20. |
| P21 Logbuch, P22 Erfolge | Neue Schiffsarten und Standorte kommen ins Logbuch; Erfolge für Verbund-Meilensteine. |
| P24 Ereignisse, P39 Jugendtraining | Regattawoche (Stufe 13) baut auf den Regatta-Ereignissen und dem Segelclub auf. |
| P26 Hafenhorn | Sammelkassieren für große Häfen. |
| P32 Flottillen | Törngäste fahren oft als Flottille. |
| P41 Statistik und Saisonbilanz | Bilanz je Standort und für den Verbund. |
| P44 Hafenname | Namen für jeden Standort, sicher angezeigt (C05). |
| P55 Sichtbarkeit | Zeiger am Rand ist Voraussetzung für P69. |
| P57 Nordsee | Bleibt wie geplant ein eigener Durchgang mit eigenem Spielstand. Stufe 14 nutzt dieselben Tide-Regeln für einen Nordsee-Standort im Verbund; dafür muss die Tide am Stand hängen (`state.region`), nicht am Gerät. Stufe 14 startet erst nach P57. |
| P58 Online (zuletzt) | Bestenliste nach Verbundstufe und Sternen, Gastboote anderer Spieler können als Törngäste kommen. Sicherheitsreview C08 gilt auch hier. |
| P59 Stege umbauen | Gilt auch für Stege ab Stufe 7. |
| P66 Bootswege | Fähre, Kanalverkehr und Offshore-Versorger fahren über die Fahrwasserkarte, kein Durchfahren von Land oder Stegen. |

## 9. Reihenfolge

Der Ausbau ist ein Extra und startet erst, wenn Welle 0 bis 2 fertig sind und das Spiel bis Stufe 6 rund läuft. Die Pakete stehen als Welle 6 in der [Roadmap](roadmap.md#welle-6-ausbau-stufe-7-bis-20-nach-welle-4-und-p57). Kurz:

1. **Grundlage ohne sichtbare Änderung:** P67 (Stufe-6-Annahmen), P68 (Leistung), P69 (Bedienung).
2. **Heimathafen wächst:** P70 Stufe 7, P71 Stufe 8, P72 Stufe 9 (nach P20).
3. **Verbund:** P73 Standorte und Hafenkarten (Stufe 10), P74 Gästeweitergabe und Törngäste (11), P75 Hafenprofile (12), P76 Regattawoche (13).
4. **Weite Welt:** P77 Nordseehafen (14, nach P57), P78 Offshore (15), P79 Kreuzfahrthafen (16), P80 Marinehafen und Großseglertreffen (17, 18), P81 Kanalhafen (19), P82 Hafenimperium und Endlosspiel im Verbund (20).
5. **Balancing** läuft in jedem Paket mit (`tools/balance.mjs --bis 20`), Schlussabgleich in P82.

Online (P58) bleibt der letzte Schritt.

## 10. Entscheidungen dieses Plans (13.11.2026)

Jorven: "Nichts soll auf meine Entscheidungen warten." Deshalb hier festgelegt und begründet; Jorven kann jede davon ändern, dann wird dieses Dokument im selben PR angepasst.

| Frage | Entscheidung | Warum |
|---|---|---|
| Ein Riesenhafen oder mehrere Häfen? | Heimathafen bis Ausbaustufe 9, danach mehrere Häfen im Verbund | iPhone-Leistung und Übersicht; echte Marinagruppen wachsen genauso |
| Zweite Karte für den Verbund? | Nein, Hafenkarten (Postkarten) statt Karte | Leitlinie "Eine Ansicht" |
| Andere Häfen live in 3D? | Nein, Kurzrechnung jeden Abend | Leistung, Speicher |
| Geld je Hafen oder gemeinsam? | Eine Kasse | Leitlinie "nur zwei Zahlen" |
| Wie viele Standorte? | höchstens sechs | Übersicht am Handy, Speicher |
| Neue Häfen von Stufe 1 an? | Nein, Übernahme alter Häfen ab Ausbaustufe 3 oder 4 | Kein zweites Mal die Anfangsphase, nah am echten Vorbild |
| Nordsee | P57 bleibt eigener Durchgang; Stufe 14 bringt zusätzlich einen Nordsee-Standort in den Verbund | Kompatibel mit P57, keine Doppelarbeit |
| Kanal zwischen Ost- und Nordsee | ja, erfundener Kanal, Stufe 19 | verbindet beide Reviere, ohne eine dritte Region einzuführen |
| Laufende Kosten für Standorte | keine | Leitlinie "keine laufenden Kosten" |

## 11. Risiken

| Risiko | Gegenmaßnahme |
|---|---|
| Kurzrechnung und echte Regeln laufen auseinander | Abgleichstest (Abschnitt 6.5), bei jeder Regeländerung |
| Ein Küstentyp hat keinen Platz für Stufe 7 bis 9 | Ausweichlage je Typ, Prüfung über `tools/seeds-pruefen.mjs` mit den neuen Stufen vor jedem Merge |
| Alte Spielstände sehen nach einem Update anders aus | Bedarf der Stufen 1 bis 6 bleibt unverändert; neuer Bedarf nur ab der neuen Stufe |
| Spielstand wird zu groß | Kurzform ohne Boote, Grenze im Test |
| Zu viele Entscheidungen auf einmal | eine neue Sache je Stufe, Belegungsplan und Leitstelle nehmen Routine ab |
| Doku verspricht, was nicht geht | Regel oben: erst erwähnen, wenn die Stufe spielbar ist |
