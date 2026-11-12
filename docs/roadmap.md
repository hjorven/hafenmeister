# Hafenmeister: Roadmap

Stand: 12.11.2026, abgeglichen mit `main` bei Commit `95aee94` (PR 138). Quelle: Jorvens Überblick "Hafenmeister: Spiel-Review und Vorschläge" vom 12.11.2026 (eigene Funde, Funde einer anderen KI, Vorschläge; Grundlage dort war Commit `1d37b64`, PR 132).

**Verhältnis zu [plan.md](plan.md):** `plan.md` bleibt der einzige gültige Plan für Vision, Regeln und Entscheidungen. Diese Roadmap ist die **Arbeitsliste**: Sie sagt, was noch fehlt, was falsch ist, was weg soll, und welches Paket (welcher Thread) es erledigt. Wo die Roadmap eine Entscheidung aus `plan.md` ändern würde, steht das unter [Offene Fragen an Jorven](#offene-fragen-an-jorven) und gilt erst nach seiner Antwort; danach wird `plan.md` im selben PR angepasst.

**Regeln für alle Pakete**

- "Fertig heißt spielbar" ([abnahme.md](abnahme.md)): Ein Punkt ist erst erledigt, wenn er im laufenden Spiel am Handy und am PC sichtbar funktioniert. Nichts in Doku, Einstieg oder Karte, das nichts tut.
- Jedes Paket aktualisiert beim Merge seine Zeilen hier (Status und PR-Nummer) und die betroffene Doku.
- Zahlen nur in `web/js/data/economy.js` (siehe Paket P06).
- Vor jedem Merge im Hauptordner:

```bash
bash tests/pruefen.sh
```

**Status:** `offen` · `in Arbeit (PR n)` · `erledigt (PR n)` · `Frage` (wartet auf Jorven) · `entfällt`

**Kürzel:** Ü1 bis Ü25 = "25 Vorschläge zur Überarbeitung", F1 bis F42 = "Vorschläge für neue Features" aus dem Überblick. P01 bis P58 = Pakete dieser Roadmap (siehe [Pakete und Reihenfolge](#pakete-und-reihenfolge)). Die Kürzel A1, B1, C1, D3, E1, G1, H2, I1, J1, K1, L1, M1, N1, O1 im Abschnitt "Abgleich mit der Reihenfolge im Überblick" verweisen auf die Tabs "Mechaniken im Detail" und "Technik und Bedienung" des Überblicks. Diese Tabs sind im PDF nicht enthalten; ihre Punkte werden nachgetragen, sobald sie vorliegen (Frage 1).

---

## 1. Was seit dem Überblick passiert ist

Zwischen PR 132 und PR 138 kamen nur Grafik, Leistung und Oberfläche dazu (PR 130, 131, 133 bis 136, 138). `sim.js`, `state.js`, `bridge.js`, `economy.js`, `web/js/features/` und `tests/` sind seitdem unverändert. Alle Befunde des Überblicks zu Regeln und Tests gelten also weiter. Direkt im Code nachgeprüft (Stand `95aee94`):

| Befund | Fundstelle | Ergebnis |
|---|---|---|
| Dauerlieger zahlen 15 € statt 50 % | `web/js/sim.js:1333` setzt `r.stationedFee = E.fischer.pachtProTag`, `sim.js:854` nimmt dann immer diesen Wert | bestätigt |
| Knopf "Kassieren" ohne Hafenbüro | `web/js/ui/hud.js:132` zeigt ihn, sobald Münzen offen sind | bestätigt |
| Einstieg zeigt auf gelöschte Sonne | `web/js/features/einstieg.js:57` und `:191` (`.hm-sonne`) | bestätigt, PR 112 (offen) behebt nur einen Teil |
| Zwei Zähler für Großschiffbesuche | `bridge.js:373` zählt `kreuzfahrt`, `flottenbesuch`; `render/services.js:385` zusätzlich `offene-tuer` | bestätigt |
| Tests gegen alte Ersatzregeln | `tests/dauerlieger.test.mjs` ohne `rulesFromEconomy` | bestätigt |
| Tempo uneinheitlich | `ui/oberflaeche.js:98` 1x, 3x, 8x; `ui/input-pc.js:35` Taste F 4x; PC-Hilfe `input-pc.js:79` "Sonne im Tagesbalken ziehen" | bestätigt |
| Vorschau der nächsten Boote | `sim.preview()` und `game.sim.preview` vorhanden, keine Oberfläche ruft es auf | bestätigt |
| Logbuch | `state.logbook` wird gefüllt, keine Anzeige | bestätigt |
| Rundgang vor dem Abend | `web/js/data/people.js:88` `RUNDGANG_AB = 0.68` | bestätigt |

Offene PRs, die Punkte dieser Roadmap berühren: PR 81 (Vorbeifahrer, XXL), PR 91 (Nebel), PR 112 (Einstieg), PR 137 (Kamera), PR 139 (Windjammertreffen, Barkasse).

---

## 2. Fehler beheben (Ü1 bis Ü7)

| Nr | Punkt | Status | Paket |
|---|---|---|---|
| Ü1 | Dauerlieger-Pacht reparieren: Fischer 15 €, Dauerlieger 50 % ihres Gastpreises, wie die Karte verspricht | offen | P01 |
| Ü2 | Hafenbüro Stufe 1 einen Nutzen geben (Knopf "Kassieren" erst mit Stufe 1 oder andere Wirkung) | offen, Frage 4 | P02 |
| Ü3 | Einstieg neu abstimmen: Schritt 1 ohne Sonne, Schritt 3 "Liegegeld beim Anlegen" | in Arbeit (PR 112, Teil) | P03 |
| Ü4 | Ein Zähler für das Abschlussziel Stufe 6 (Tag der offenen Tür zählt mit) | offen | P04 |
| Ü5 | Boote auf wegfallenden Plätzen beim Stufenausbau regeln (B01, B02 in Stufe 3, T-Kopf Steg B): Gäste reisen erst ab, Dauerlieger ziehen samt Dauerplatz um | erledigt (`sim.js` `advanceStage`, Hook `stageUp`, Test in `tests/dauerlieger.test.mjs`) | P05 |
| Ü6 | Regeltests gegen die echten Zahlen: gemeinsamer Helfer mit `rulesFromEconomy(ECONOMY)` | offen | P06 |
| Ü7 | Tempo und Hilfetexte vereinheitlichen (Knöpfe, Taste F, Plan, PC-Hilfe) | offen, Frage 2 | P07 |

## 3. Kernschleife (Ü8 bis Ü14)

| Nr | Punkt | Status | Paket |
|---|---|---|---|
| Ü8 | Selbst-Einfahren weniger klug: nächste freie Box am Ufer, auch eine zu große, damit Umlenken lohnt | offen, Frage 5 | P10 |
| Ü9 | Wunschplätze beim Zuweisen in Gold zeigen (Strom, Fingersteg) | offen | P10 |
| Ü10 | Wünsche als Symbole über wartenden Booten, drei Umrisse für die nächsten Ankünfte (`sim.preview()`) | offen | P11 |
| Ü11 | Hafenbüro lässt Sonderfälle beim Spieler (Mehrrumpf, XL, Sondergäste, nur ein passender Platz), wie `plan.md` Abschnitt 3 und 14 | offen | P02 |
| Ü12 | Kassieren verständlich: Rundgang erst mit dem Abend, Einstieg erklärt die Hälfte, halbe Münze sieht anders aus | offen | P12 |
| Ü13 | Abweisen von Hand und Wegfahren aus Ungeduld mit derselben Folge | offen | P10 |
| Ü14 | Tagesziele zählen nur eigene Handlungen, kombinierte Ziele, Ruf als Belohnung (`plan.md` 9a) | offen | P13 |

## 4. Balancing (Ü15 bis Ü20)

| Nr | Punkt | Status | Paket |
|---|---|---|---|
| Ü15 | Weicher Start: 100 € Startgeld oder geschenktes WC | offen | P17 |
| Ü16 | Stufe 1 und 2 straffen (Stufe 2 dauert heute 47 Spieltage), Gästeziele senken | offen | P17 |
| Ü17 | Dem Ruf eine Aufgabe geben: Wünsche je Bootsart aus `data/boats`, spürbare Kapazität | offen | P19 |
| Ü18 | Sparphasen füllen: Ausbau in zwei bis drei Bauabschnitte, einzeln bezahlt, sichtbar wachsend | offen | P18 |
| Ü19 | Winter nutzen: Zeitraffer vor Stufe 4 oder Winterarbeiten (F14) | offen | P20 |
| Ü20 | Dauerlieger als Entscheidung: Saisonpacht im Voraus, höchstens ein Viertel der Plätze, sichere Einnahme bei Sturm | offen, Frage 6 | P01 |

## 5. Rückmeldung (Ü21 bis Ü23)

| Nr | Punkt | Status | Paket |
|---|---|---|---|
| Ü21 | Bewertung beim Ablegen über dem Boot zeigen, bei schlechter Note mit Symbol des fehlenden Wunsches | offen | P14 |
| Ü22 | Tagesabschluss am Abend: Liegegeld, Services, Pacht, Tagesziele, weggefahrene Boote, bester Tag | offen | P15 |
| Ü23 | Aufstieg und Regionsabschluss feiern: Kamerafahrt, Zahlen der Stufe, "Weiterspielen" | offen | P16 |

## 6. Aufräumen (Ü24, Ü25)

| Nr | Punkt | Status | Paket |
|---|---|---|---|
| Ü24 | Eine Quelle für alle Zahlen: alles nach `economy.js`, Rest löschen (`data/rules.js` alte Werte, `services.js`-Mischung, `events.js` gegen `ECONOMY.ereignisse`, Feature-Dateien). Fehler `sturmschutz: true` trifft auf Code, der eine Zahl erwartet | offen | P06 |
| Ü25 | Ein Speicherweg und "Neues Spiel" (`newGame()` gibt es), mehrere Speicherplätze | offen | P09 |

---

## 7. Mechaniken im Überblick

Note 1 bis 5 aus dem Überblick. "nein" heißt: bleibt, wie es ist.

| Mechanik | Note | Überarbeiten | Paket |
|---|---|---|---|
| Baumodus mit Vorschau und Rat | 5 | nein | (P18 baut darauf auf) |
| Tagesrhythmus | 4 | nein | |
| Passregel | 4 | nein | (P29 Baggern gibt ihr einen Hebel) |
| Stegprojekte | 4 | teilweise | P05 |
| Tagestörn der Gäste | 4 | nein | |
| Grün-Rot-Schilder | 4 | nein | (P50 Form zusätzlich zur Farbe) |
| Wetterflagge | 4 | nein | |
| Fotomodus und Hafen schauen | 4 | nein | |
| Menschen im Hafen | 4 | nein | |
| Speichern, Export, Web-App | 4 | teilweise | P09 |
| Ankunft und Selbst-Einfahren | 3 | ja | P10 |
| Wünsche und Versorgung | 3 | teilweise | P10, P11, P19 |
| Liegegeld und Kassieren | 3 | ja | P12 |
| Ausbaustufen und Ziele | 3 | teilweise | P16, P18 |
| Services (20 Stück) | 3 | ja | P06, P23 |
| Ereignisse und Wetter | 3 | teilweise | P06, P24 |
| Stammgäste | 3 | teilweise | P25 |
| Einstieg | 3 | ja | P03 |
| Tempo und Vorspulen | 3 | ja | P07 |
| Tests | 3 | ja | P06 |
| Zuweisen von Hand | 2 | ja | P10 |
| Ruf und Bewertung | 2 | ja | P14, P19 |
| Hafenbüro (3 Stufen) | 2 | ja | P02 |
| Jahreslauf und Winter | 2 | ja | P20 |
| Dauerlieger | 2 | ja | P01 |
| Tagesziele | 2 | ja | P13 |
| Abschlussziel Stufe 6 | 2 | ja | P04, P16 |
| Logbuch | 1 | ja | P21 |
| Nordsee und Gezeiten | 1 | ja | P57 |

P23 (Services) und P24 (Ereignisse) sind die Pakete "Services mit eigener Wirkung" und "Ereignisse zum Vorbereiten", siehe Paketliste.

---

## 8. Geplant oder dokumentiert, aber nicht im Spiel

Jeder Punkt wird gebaut (Paket) oder aus Plan und Doku genommen. Nichts bleibt als Versprechen stehen.

| Was | Wo es steht | Entscheidung | Paket |
|---|---|---|---|
| Vorschau der nächsten 3 Boote | plan.md 3 | bauen | P11 |
| Wünsche als Symbole über dem Boot | plan.md 3 | bauen | P11 |
| Hafenbüro lässt Sonderfälle beim Spieler | plan.md 3 | bauen | P02 |
| Vorspulen 2x, 3x erst mit Hafenbüro | plan.md 3, 14 | Frage 2 | P07 |
| Hafenhorn gedrückt halten (Sammelkassieren) | plan.md 8, Ton fertig | bauen | P26 |
| Fernglas mit Steckbrief (Doppeltipp) | plan.md 8 | bauen | P26 |
| Möwen aufscheuchen, Wellenring, Glocke | plan.md 8 | bauen | P26 |
| Logbuch mit Bild | plan.md 9 | bauen | P21 |
| Erfolge | plan.md 9 | bauen | P22 |
| Endlosmodus nach Abschluss | plan.md 9, 12 | bauen | P16 |
| Bestenliste, Online mit Supabase | plan.md 12, README | Frage 8, zuletzt | P58 |
| Nordsee mit Gezeiten, Schleuse, Trockenfallplätzen | plan.md 9, regionen.md | bauen, nach der Ostsee | P57 |
| Revierfaktoren in `regions.js` (Hafengeld, Ankünfte, Startgeld, Schiffshäufigkeit) | regions.js | mit Nordsee bauen | P57 |
| Bauzeit der Ausbauten, Winter-Bautempo (`bautage`, `winterBautempo`) | economy.js | in P18 nutzen oder löschen | P18 |
| `ECONOMY.ereignisse` (Sturm alle 10 Tage, Hafenfest 1.500 €) | economy.js | eine Quelle, Rest löschen | P06 |
| Gruppen-Ankunft, Wünsche je Bootsart, `feeFactor`, `arrivalWeight` | data/boats/*.js | in die Regeln holen | P19, P32 (Gruppen) |
| Stammgast bringt Ruf am alten Platz | plan.md 9a | bauen | P25 |
| Dauerlieger zahlen pro Saison, Gast wird umgelegt | plan.md 9a | bauen | P01 |
| Tagesziel-Belohnung in Ruf, Ziele wie "Drei Segelboote mit Dusche" | plan.md 9a | bauen | P13 |
| Tretboote und Kanus nur als Kulisse | plan.md 14 (im Spiel zahlender Gast S2, 6 €) | Frage 3 | P17 |

## 9. Im Spiel, aber nicht dokumentiert

Alle Punkte gehen in die Doku (Paket P08), die ersten fünf ändern sich zusätzlich mit ihrem Paket.

| Was im Spiel passiert | Wo im Code | Paket |
|---|---|---|
| Dauerlieger zahlen pauschal 15 € pro Abend | `sim.js` (`startEvening`, `rulesFromEconomy`) | P01 |
| Dauerplätze kosten nichts, keine Obergrenze, keine Gäste, keine Bewertungen | `features/dauerlieger.js` | P01 |
| Abweisen von Hand kostet nichts, Wegfahren aus Ungeduld kann eine 2,5 bringen | `sim.js` (`dismiss`, `turnAway`) | P10 |
| Rundgang startet bei 68 % des Tages, 8 Sekunden vor dem Abend | `data/people.js` (`RUNDGANG_AB`) | P12 |
| Start mit 0 € und fünf Startbewertungen von 3 Ankern | `state.js`, `economy.js` (`ruf`) | P17 |
| Service-Werte als Mischung aus zwei Dateien | `services/rules.js` (`mische`) | P06 |
| Dritte Service-Stufen und abweichende Stufennamen (Travellift) | `data/services.js`, `economy.js` | P06, P08 |
| Mindestruf je Service-Stufe (Regattaverein, Werfthalle 3,8; Museumshafen 4,0; Kreuzfahrtterminal 4,5; Marinestützpunkt 4,6) | `data/services.js` | P08 |
| Deckel: Ruf-Bonus aller Services höchstens +0,75, Sturmschutz höchstens 0,8 | `data/services.js` | P08 |
| Marinestützpunkt ersetzt Flottenbesuch (alle 10 Tage) durch Tag der offenen Tür (alle 14 Tage) | `data/services.js` | P04, P08 |
| Rückfall-Speichern unter `hafenmeister.save` neben `hafenmeister.spielstand` | `state.js`, `save/storage.js` | P09 |
| Adresszusätze `?stufe=`, `?services=alle`, `?uhrzeit=`, `?revier=nordsee`, `?einstieg=1`, `?demo=boote`, `?stegbild=` verstreut | mehrere Module | P08 (eine Liste in `docs/tests.md`) |

## 10. Dokumente

| Datei | Stand laut Überblick | Paket |
|---|---|---|
| `README.md` | veraltet ("Meilenstein 0 ist fertig", Supabase, Balancing-Skript am falschen Ort) | P08 |
| `docs/plan.md` | teils veraltet (Meilensteine, Vorspulen, Hafenhorn, Fernglas, Vorschau, Pixel-Oberfläche fehlt) | P08 |
| `docs/abnahme.md` | Ist-Stand-Tabelle veraltet | P08 |
| `docs/einstieg.md` | Schritt 1 "Sonne im Tagesbalken" | P03 |
| `docs/regionen.md` | beschreibt Ungebautes als fertig | P08 jetzt (als "geplant" kennzeichnen), P57 später |
| `docs/echter-hafen.md` | Teil B und C überholt (C1, C2, C3, C9, C10, C11 behoben) | P08 |
| `docs/balancing.md` | "4x, Sonne ziehen", "18 Services" | P08 |
| `docs/neue-features.md` | Dauerlieger "50 Prozent" | P01 |
| `docs/spielregeln.md` | Pacht der Dauerlieger, Start des Rundgangs fehlen | P01, P12 |
| `docs/services.md` | Stufennamen, Zählung der Großschiffbesuche | P04, P08 |
| `docs/ereignisse.md` | Winter "mit wenig Ankünften" | P20 |
| `docs/speichern.md` | Exportformat HM1 fehlt | P09 |
| `web/js/audio/README.md` | nennt Hafenhorn-Ereignis, das kein Modul sendet | P26 |
| `docs/schiffsanimationen.md` | "Mit der Sonne vorspulen" | P07 |
| `docs/ui/pc.md`, `tablet.md`, `handy.md` | vom 11.11., teils durch `oberflaeche.md` ersetzt | P08 |
| übrige (`grundgeruest.md`, `tests.md`, `veroeffentlichen.md`, `landschaft.md`, `stegbilder.md`, `pixel-art.md`, `schiffe-xl.md`, `schiffe/groesse-l.md`, `hafen-und-schiffe.md`, `vorbilder.md`) | nicht geprüft | P08 prüft sie |
| `docs/bauen.md`, `docs/ui/oberflaeche.md` | aktuell | |

---

## 11. Neue Features (F1 bis F42)

Jorven (12.11.2026): Jedes Feature wird komplett ausgebaut. Jedes bekommt ein eigenes Paket, eng verwandte teilen sich eins.

### Kernspiel

| Nr | Feature | Status | Paket |
|---|---|---|---|
| F1 | Päckchen liegen: bei vollem Hafen längsseits an ein gleich großes Boot, halbes Liegegeld, beide Crews einen halben Anker schlechter | offen | P27 |
| F2 | Anmeldung per Funk: morgens melden sich ein bis zwei Boote an, Platz freihalten gibt Bonus | offen | P28 |
| F3 | Flottillen: drei bis fünf Boote wollen am selben Steg liegen (Feld `group`) | offen | P32 |
| F4 | Liegende Boote umlegen (verholen), zweimal dieselbe Crew senkt die Bewertung | offen | P33 |
| F5 | Windseite: bei Starkwind Außenplätze unruhig, geschützte Plätze +0,5 Anker (Feld `exposed`) | offen | P34 |
| F6 | Preisstufe am Hafenbüro: günstig, normal, gehoben, eine Entscheidung pro Saison | offen | P35 |
| F7 | Baggern: Wassertiefe je Steg als Bauprojekt | offen | P29 |
| F8 | Stege nachrüsten: Wasser, Strom für Steg A, Fingerstege, Beleuchtung, am Steg sichtbar | offen | P30 |
| F9 | Neue Wünsche: WLAN, Waschmaschine, Frischwasser, Absaugstation, Brötchen | offen | P31 |
| F10 | Bojenfeld: billige Muringbojen im See für kleine Boote ohne Wünsche | offen | P36 |

### Hafenleben

| Nr | Feature | Status | Paket |
|---|---|---|---|
| F11 | Havarist wird eingeschleppt, braucht sofort einen Platz, Ruf und neuer Stammgast | offen | P37 |
| F12 | Eigenes Hafenfest einmal pro Saison ansetzen | offen | P38 |
| F13 | Jugendtraining: Opti-Gruppe mit Trainerboot, braucht Slip und Segelclub | offen | P39 |
| F14 | Winterarbeiten: drei kleine Aufträge, Komfortbonus für einen Steg | offen | P20 |
| F15 | Krantage: Dauerlieger sichtbar ins Winterlager und zurück | offen | P20 |
| F16 | Seltene Besucher: Weltumsegler, Schweinswal, Schwäne; Logbuch und Fotomotiv | offen | P40 |
| F17 | Mehr Ereignisse: Mittsommer, Holzboot-Treffen, Heringstage | offen | P24 |

### Langzeit

| Nr | Feature | Status | Paket |
|---|---|---|---|
| F18 | Gästebuch: letzte 20 Bewertungen am Hafenbüro | offen | P14 |
| F19 | Statistikseite: Belegung und Einnahmen der letzten 30 Tage, Einnahmen nach Quelle | offen | P41 |
| F20 | Saisonbilanz nach dem Winter | offen | P41 |
| F21 | Herausforderungen mit Seed (nur Segler, kein Hafenbüro, doppelte Ankünfte) | offen | P42 |
| F22 | Fotoaufträge und Postkarte | offen | P43 |
| F23 | Hafenname und Flagge, sichtbar an Einfahrt und Mast | offen | P44 |
| F24 | Kreativmodus als eigener Spielstand | offen | P45 |
| F25 | Einstellungen: Schilder auch über die Form, weniger Bewegung, größere Schrift, Linkshänder am Handy | offen | P50 |

### Spielstände

| Nr | Feature | Status | Paket |
|---|---|---|---|
| F26 | Mehrere Speicherplätze: wechseln, neu, überschreiben, kopieren, umbenennen, löschen, als Datei | offen | P09 |
| F27 | Neues Spiel mit Auswahl: Hafenname, Stegbild, später Herausforderung oder Revier | offen | P09, P44 |
| F28 | Probe-Kopie für teure Ausbauten | offen | P09 |

### Spielgefühl

| Nr | Feature | Status | Paket |
|---|---|---|---|
| F29 | Ruhiger Abend: alles kassiert und versorgt, Lichterketten an, Musik wärmer | offen | P46 |
| F30 | Serien ohne Druck: drei passgenaue Zuweisungen ergeben einen Akkord | offen | P46 |
| F31 | Große Ankünfte mit Horn, Kamera schwenkt auf Wunsch zur Einfahrt | offen | P47 |
| F32 | Leinen annehmen: Symbol am Steg, Antippen bringt Trinkgeld | offen | P48 |

### Seemannschaft

| Nr | Feature | Status | Paket |
|---|---|---|---|
| F33 | Signalflaggen als Wunschanzeige, Lexikon im Logbuch | offen | P49 |
| F34 | Hafenwissen zum Sammeln (Tonnen, Molenfeuer, Knoten, Lichter) | offen | P49 |
| F35 | Wind beim Anlegen: große Boote brauchen länger, bevorzugen Plätze gegen den Wind | offen | P34 |

### Geschichten

| Nr | Feature | Status | Paket |
|---|---|---|---|
| F36 | Hafenchronik: jeder Tag eine Zeile | offen | P21 |
| F37 | Gästepost von Stammgästen, hängt im Hafenbüro | offen | P25 |
| F38 | Hafentiere: Katze, Hund, Reiher, im Fotomodus festhalten | offen | P51 |

### Welt

| Nr | Feature | Status | Paket |
|---|---|---|---|
| F39 | Naturecke: Schilfgürtel erhalten oder bebauen, nicht umkehrbar | offen | P52 |
| F40 | Spätankömmling: nachts läuft ein Boot mit Lichtern ein | offen | P53 |

### Teilen ohne Server

| Nr | Feature | Status | Paket |
|---|---|---|---|
| F41 | Hafen als Code: Startwert, Stegbild, Ausbau als kurzer Code, Ansicht im Kreativmodus | offen | P42 |
| F42 | Wochenhafen: fester Startwert je Kalenderwoche, 30 Tage, Ergebniskarte als Bild | offen | P42 |

---

## 12. Was weg soll

| Was | Wo | Paket |
|---|---|---|
| Alte Ersatzregeln mit eigenen Zahlen | `web/js/data/rules.js` | P06 |
| Tote Zahlen `ECONOMY.ereignisse` oder die doppelten in `data/events.js` (eine Quelle bleibt) | `economy.js`, `data/events.js` | P06 |
| Zweiter Satz Service-Zahlen (Mischung `mische`) | `data/services.js`, `services/rules.js` | P06 |
| Alter Rückfall-Speicherweg `hafenmeister.save` mit eigenem Exportformat (alte Stände werden beim Laden einmal übernommen) | `state.js`, `save/storage.js` | P09 |
| Alle Texte zur Sonne als Vorspul-Griff | `features/einstieg.js`, `ui/input-pc.js`, `ui/input-touch.js`, `ui/gesten.js`, Doku | P03, P07 |
| Ungenutzte Felder `bautage`, `winterBautempo`, falls P18 sie nicht nutzt | `economy.js` | P18 |
| Versprechen in Plan und Doku ohne Gegenstück im Spiel (Abschnitt 8) | `plan.md`, `regionen.md`, `README.md` | P08 |
| Paddel- und Tretboot S2 als zahlender Gast, falls Jorven bei "nur Kulisse" bleibt | `data/boats/s.js` | P17, Frage 3 |

---

## Pakete und Reihenfolge

Je Paket ein Thread. "bestehend" heißt: der genannte laufende Thread übernimmt es, weil er die Dateien besitzt. Höchstens etwa 20 Threads arbeiten gleichzeitig; die Wellen geben die Reihenfolge. Eine Welle muss nicht ganz fertig sein, bevor die nächste startet; ein Paket der nächsten Welle startet, sobald ein Platz frei wird.

Viele Pakete ändern `web/js/sim.js`. Regel: kleine, getrennte Änderungen, vor dem Merge auf aktuellen `main` rebasen, neue Regeln mit eigenem Test in `tests/`.

### Welle 1: Fehler und Fundament (sofort)

| Paket | Titel (Thread) | Inhalt | Dateien | Thread |
|---|---|---|---|---|
| P01 | Dauerlieger zur echten Entscheidung machen | Ü1, Ü20, Doku Dauerlieger, Gast wird umgelegt (plan 9a) | `sim.js`, `features/dauerlieger.js`, `economy.js`, `tests/dauerlieger.test.mjs`, `docs/neue-features.md`, `docs/spielregeln.md` | neu |
| P02 | Hafenbüro mit eigenen Aufgaben ausbauen | Ü2, Ü11 | `ui/hud.js`, `sim.js` (Automatik), `economy.js`, `ui/bauen.js` (Texte) | neu |
| P03 | Einstieg an neue Oberfläche anpassen | Ü3, Teil von Ü12 (Hälfte beim Rundgang erklären), `docs/einstieg.md` | `features/einstieg.js`, `docs/einstieg.md` | bestehend: "Einstieg für neue Spieler bauen" (PR 112) |
| P04 | Abschlussziel Stufe 6 richtig zählen | Ü4 | `bridge.js`, `render/services.js`, `docs/services.md` | bestehend: "Services und Sonderanlagen einbauen" |
| P05 | Boote auf wegfallenden Plätzen regeln | Ü5 | `sim.js` (Stufenausbau), `tests/` | bestehend: "Spielregeln ohne Grafik umsetzen" |
| P06 | Eine Quelle für alle Zahlen und echte Regeltests | Ü6, Ü24 | `economy.js`, `data/rules.js`, `data/services.js`, `services/rules.js`, `data/events.js`, `tests/helpers.mjs`, alle Regeltests, `docs/balancing.md` | bestehend: "Balancing für 94 Liegeplätze ausarbeiten" |
| P07 | Tempo einheitlich regeln | Ü7, Hilfetexte, `docs/schiffsanimationen.md` | `ui/oberflaeche.js`, `ui/input-pc.js`, `ui/input-touch.js`, `ui/gesten.js`, `plan.md` 14 | bestehend: "Gesamte Oberfläche neu überarbeiten" |
| P08 | Doku auf den Stand bringen | Abschnitte 9 und 10, Liste aller Adresszusätze, `plan.md` Meilensteine und Pixel-Oberfläche | `README.md`, `docs/*.md` (außer den Paket-eigenen) | bestehend: "Bestandsaufnahme Repo und Plan erstellen" |
| P09 | Speicherplätze und Neues Spiel | Ü25, F26, F27 (Grundgerüst), F28, `docs/speichern.md` | `save/*.js`, `state.js`, `save/save-panel.js` | neu |

### Welle 2: Kernschleife und Rückmeldung

| Paket | Titel (Thread) | Inhalt | Dateien | Thread |
|---|---|---|---|---|
| P10 | Zuweisen wieder zur Entscheidung machen | Ü8, Ü9, Ü13 | `sim.js` (Selbst-Einfahren, `dismiss`, `turnAway`), `render/boat-view.js`, `features/platzschilder.js` | neu |
| P11 | Wünsche über dem Boot und Ankunftsvorschau | Ü10 | neues Modul `web/js/ui/vorschau.js`, `render/boat-view.js` | neu |
| P12 | Kassieren verständlich machen | Ü12 (Rundgang ab Abend, halbe Münze sichtbar) | `data/people.js`, `render/boat-view.js`, `docs/spielregeln.md` | neu |
| P13 | Tagesziele an eigene Handlungen binden | Ü14 | `features/tagesziele.js`, `sim.js` (Ereignisse mit "von Hand") | neu |
| P14 | Bewertungen und Gästebuch zeigen | Ü21, F18 | `render/boat-view.js`, neues Modul `web/js/ui/gaestebuch.js` | neu |
| P15 | Tagesabschluss am Abend zeigen | Ü22 | neues Modul `web/js/ui/tagesabschluss.js`, `sim.js` (`sim:dayEnd`) | neu |
| P16 | Aufstieg und Abschluss feiern, Endlosspiel | Ü23, Endlosmodus | `ui/oberflaeche.js`, `core/camera.js` (Kamerafahrt), `sim.js` | neu |
| P17 | Start und frühe Stufen straffen | Ü15, Ü16, Startwerte dokumentieren, Tretboot (Frage 3) | `economy.js`, `state.js`, `docs/balancing.md` | bestehend: "Balancing für 94 Liegeplätze ausarbeiten" (nach P06) |
| P18 | Ausbau in Bauabschnitten | Ü18, `bautage` nutzen oder löschen | `ui/bauen.js`, `economy.js`, `sim.js`, Stegdarstellung | bestehend: "Bauen mit Vorschau und Tiefe ausbauen" |
| P19 | Ruf schwerer machen mit Wünschen je Bootsart | Ü17, `feeFactor`, `arrivalWeight`, Kapazität sichtbar | `sim.js`, `data/boats/*.js`, `economy.js` | neu |
| P20 | Winter mit Inhalt füllen | Ü19, F14, F15, `docs/ereignisse.md` | `sim.js` (Jahreslauf), neues Feature-Modul, Travellift/Winterlager in `render/services.js` | neu |
| P21 | Logbuch und Hafenchronik zeigen | Logbuch (Note 1), F36, `sim:logbookNew` | neues Modul `web/js/ui/logbuch.js`, `state.js` | neu |
| P22 | Erfolge einbauen | plan.md 9 | neues Feature-Modul | neu |

### Welle 3: Tiefe und Hafenleben

| Paket | Titel (Thread) | Inhalt | Thread |
|---|---|---|---|
| P23 | Services mit eigener Wirkung | Services nicht nur "€ pro Tag" | bestehend: "Services und Sonderanlagen einbauen" |
| P24 | Ereignisse zum Vorbereiten und neue Ereignisse | Vorwarnung mit Handlungsmöglichkeit, F17 | bestehend: "Ereignisse Sturm und Regatta einbauen" |
| P25 | Stammgäste mit Wirkung und Gästepost | Ruf am alten Platz (plan 9a), F37 | neu |
| P26 | Überraschende Gesten fertig bauen | Hafenhorn gedrückt halten, Fernglas mit Steckbrief, Möwen, Wellenring, Glocke (plan 8), `audio/README.md` | neu |
| P27 | Päckchen liegen bei vollem Hafen | F1 | neu |
| P28 | Anmeldung per Funk | F2 (nutzt P11) | neu |
| P29 | Baggern für tiefere Liegeplätze | F7 | neu |
| P30 | Stege nachrüsten | F8 | neu |
| P31 | Neue Gästewünsche | F9 | neu |
| P32 | Flottillen | F3, Gruppen-Ankunft | neu |
| P33 | Liegende Boote umlegen | F4 | neu |
| P34 | Wind im Hafen spürbar machen | F5, F35 | neu |
| P35 | Preisstufe am Hafenbüro | F6 | neu |
| P36 | Bojenfeld im See | F10 | neu |
| P37 | Havarist einschleppen | F11 | neu |
| P38 | Eigenes Hafenfest ansetzen | F12 | neu |
| P39 | Jugendtraining am Segelclub | F13 | neu |
| P40 | Seltene Besucher | F16 (nach P21) | neu |

### Welle 4: Langzeit, Spielgefühl, Welt

| Paket | Titel (Thread) | Inhalt | Thread |
|---|---|---|---|
| P41 | Statistik und Saisonbilanz | F19, F20 | neu |
| P42 | Herausforderungen, Wochenhafen und Hafen als Code | F21, F41, F42 (nach P09, P45) | neu |
| P43 | Fotoaufträge und Postkarten | F22 | bestehend: "Spielschleife zusammenbauen und Vorschläge einbauen" (Fotomodus) |
| P44 | Hafenname und Flagge | F23, F27 (Auswahl beim Start) | neu |
| P45 | Kreativmodus | F24 | neu |
| P46 | Ruhiger Abend und Serien-Akkord | F29, F30 | bestehend: "Ton und Musik hinzufügen" |
| P47 | Große Ankünfte ankündigen | F31 | bestehend: "Kamera frei neigen und drehen" |
| P48 | Leinen annehmen beim Anlegen | F32 | bestehend: "Schiffsanimationen umsetzen" |
| P49 | Signalflaggen und Hafenwissen | F33, F34 (nach P21) | neu |
| P50 | Einstellungen für Sicht und Bewegung | F25 | bestehend: "Gesamte Oberfläche neu überarbeiten" |
| P51 | Hafentiere | F38 | bestehend: "Menschen im Hafen herumlaufen lassen" |
| P52 | Naturecke am Schilf | F39 | bestehend: "Landschaft und Wasser gestalten" |
| P53 | Spätankömmling in der Nacht | F40 | neu |

### Welle 5: Regionen und Online

| Paket | Titel (Thread) | Inhalt | Thread |
|---|---|---|---|
| P57 | Nordsee mit Gezeiten spielbar machen | Revierfaktoren, Gezeiten, Schleuse, Trockenfallplätze, `docs/regionen.md` | bestehend: "Hafenregionen Ostsee und Nordsee gestalten" |
| P58 | Online mit Supabase | Hafenname, Bestenliste, Gastboote (Frage 8) | neu, zuletzt |

P54 bis P56 sind frei für Punkte aus den fehlenden Tabs.

### Abgleich mit der Reihenfolge im Überblick

Der Überblick empfiehlt neun Pakete. Die Kürzel daraus (Tabs "Mechaniken" und "Technik") werden den Paketen oben zugeordnet, sobald die Tabs vorliegen (Frage 1). Bis dahin gilt diese Zuordnung:

| Überblick | Inhalt laut Überblick | Pakete hier |
|---|---|---|
| 1 Fehler und Texte | Ü1 bis Ü7, J1, J3 | P01 bis P07 |
| 2 Zahlen und Tests | M1 bis M3, O1, O2 | P06 |
| 3 Sichtbarkeit | A3, A4, B1 bis B3, B11, C1, L1, Ü22 | P11, P14, P15 |
| 4 Kernschleife | A1, A2, A5, A6, E1 bis E4, I1 | P10, P02, P13 |
| 5 Speicherplätze | N1 bis N7, N12 | P09 |
| 6 Erste halbe Stunde und Winter | Ü15, Ü16, D3, J4, G4 | P17, P03, P20 |
| 7 Langzeit | I5 bis I9, D7, D10, F18 bis F20 | P14, P16, P21, P22, P41 |
| 8 Tiefe | Tab-Kürzel F2, F3, G1 bis G3, H2 bis H6; Feature-Vorschläge F1 bis F4 | P19, P23, P27, P28, P32, P33 |
| 9 Nordsee | K1 bis K5 | P57 |

Achtung: Im Überblick heißen manche Tab-Kürzel ebenfalls F2, F3. Wo in dieser Roadmap "F" plus Zahl steht, ist immer ein Feature-Vorschlag gemeint.

---

## Offene Fragen an Jorven

1. Der Überblick verweist auf zwei weitere Tabs ("Mechaniken im Detail", "Technik und Bedienung") mit Kürzeln wie A1, M1, N1. Die stehen nicht im PDF. Kannst du sie auch exportieren?
2. Tempo: Heute gibt es Pause, 1x, 3x und 8x von Anfang an, Taste F macht 4x, der Plan sagt 2x und 3x erst mit Hafenbüro. Vorschlag: Knöpfe bleiben (1x, 3x, 8x ab Start), Taste F schaltet 3x, Plan wird angepasst.
3. Paddel- und Tretboote kommen heute als zahlende Gäste (6 €), der Plan sagt "nur Kulisse". Vorschlag: in Stufe 1 als Gäste lassen (gibt dem Anfang Leben), Plan anpassen.
4. Hafenbüro Stufe 1 (600 €): Vorschlag: Der Knopf "Kassieren alle" kommt erst mit dem Hafenbüro, vorher streicht man Münzen einzeln.
5. Selbst-Einfahren: Vorschlag aus dem Überblick: Boote nehmen nach 8 Sekunden die nächste freie Box am Ufer, auch eine zu große, statt der knappsten. Dann lohnt sich eigenes Zuweisen. Einverstanden?
6. Dauerlieger: Saisonpacht im Voraus, höchstens ein Viertel der Plätze, dafür sichere Einnahme auch bei Sturm. Einverstanden?
7. Alle 42 Feature-Vorschläge werden gebaut, wie gewünscht. Soll ein Feature ausdrücklich nicht kommen?
8. Online mit Supabase: weiter als letzter Schritt geplant, oder reicht "Teilen ohne Server" (F41, F42)?
