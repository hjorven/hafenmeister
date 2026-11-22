# Hafenmeister: Roadmap

Stand: 15.11.2026 vormittags, Status aller Pakete am Code geprüft und abgeglichen mit `main` bei Commit `c0d1d93` (PR 332). Der Status der Pakete wird laufend von den Threads und stündlich vom Thread "Roadmap interaktiv im Repo zeigen" nachgetragen. Erste Fassung vom 12.11.2026 abgeglichen bei `95aee94` (PR 138). Quelle: Jorvens Überblick "Hafenmeister: Spiel-Review und Vorschläge" vom 12.11.2026 (eigene Funde, Funde einer anderen KI, Vorschläge; Grundlage dort war Commit `1d37b64`, PR 132).

**Verhältnis zu [plan.md](plan.md):** `plan.md` bleibt der einzige gültige Plan für Vision, Regeln und Entscheidungen. Diese Roadmap ist die **Arbeitsliste**: Sie sagt, was noch fehlt, was falsch ist, was weg soll, und welches Paket (welcher Thread) es erledigt. Wo die Roadmap eine Entscheidung aus `plan.md` ändern würde, steht das unter [Offene Fragen an Jorven](#offene-fragen-an-jorven) und gilt erst nach seiner Antwort; danach wird `plan.md` im selben PR angepasst.

**Was gerade läuft und was als Nächstes startet:** [arbeitsplan.md](arbeitsplan.md) (laufend nachgeführt).

**Regeln für alle Pakete**

- "Fertig heißt spielbar" ([abnahme.md](abnahme.md)): Ein Punkt ist erst erledigt, wenn er im laufenden Spiel am Handy und am PC sichtbar funktioniert. Nichts in Doku, Einstieg oder Karte, das nichts tut.
- Jedes Paket aktualisiert beim Merge seine Zeilen hier (Status und PR-Nummer) und die betroffene Doku.
- Aus dieser Datei entstehen automatisch die Übersicht in der README und die Seite https://hjorven.github.io/hafenmeister/roadmap/ (`tools/roadmap.mjs`, Action "Roadmap-Übersicht"). Damit sie stimmen: Status in der Statusspalte mit den Wörtern `offen`, `in Arbeit (PR n)`, `erledigt (PR n)`, `teilweise`, `entfällt`; neue Pakete als Zeile `| Pnn | Titel | Inhalt | ... |` in einer Tabelle unter einer Überschrift `### Welle n: Thema`.
- Vorschaubilder je Paket stehen in `docs/roadmap-bilder.json`, die Dateien in `web/roadmap/bilder/` (JPEG, höchstens 1000 px). Der Thread "Roadmap interaktiv im Repo zeigen" sammelt neue Bilder aus dem Projektordner stündlich ein; wer selbst eins eintragen will, ergänzt dort eine Zeile mit `datei`, `pakete`, `titel`, `pr`, `geraet`, `datum`.
- Zahlen nur in `web/js/data/economy.js` (siehe Paket P06).
- Vor jedem Merge im Hauptordner:

```bash
bash tests/pruefen.sh --schnell
```

**Reihenfolge seit 12.11.2026 abends (Jorven):**

1. **Welle 0, Gelände:** Zuerst überarbeiten fünf Threads gemeinsam Gelände, Anlagen und Bootswege (Abschnitt 14, Pakete P62 bis P66). Stand 21.11.: P62 bis P66 erledigt, die Abnahme-Serie über alle 15 Küsten läuft. Seit Jorvens Auftrag vom 13.11. laufen Grundprobleme und neue Pakete parallel weiter, Welle 0 behält Vorrang.
2. **Grundprobleme:** Danach Welle 1 (Fehler und Fundament) und die Technik-Befunde aus Abschnitt 15.
3. **Kernschleife und Sichtbarkeit:** Welle 2.
4. **Extras:** Welle 3 bis 5 (neue Features, Nordsee, Online).
5. **Ausbau Stufe 7 bis 20:** Welle 6 nach Welle 4 und P57, geplant in [ausbau-stufe-7-20.md](ausbau-stufe-7-20.md); Online bleibt zuletzt.

**Selbstprüfung vor jedem Weiterbauen (Jorven, 12.11.2026):** Bevor ein Thread weiterbaut oder merged, prüft er sein eigenes Feature sehr oft im laufenden Spiel (Handy und PC, alle Stufen, mehrere Stegbilder, alle Wetter, Tag und Nacht, Vorspulen 8x) und mit Randfällen (voller Hafen, leere Bojen, Stufenwechsel mitten im Manöver, Laden eines alten Spielstands). Er schreibt in seinen PR unter **"Randfälle und Berührungspunkte"**, was er geprüft hat und wo sein Feature mit anderen kollidieren kann (Beispiel: neues Stegbild gegen Bootswege, Marinebasis gegen Einfahrt). Berührungspunkte trägt er zusätzlich in die Tabelle in Abschnitt 14 ein.

**Status:** `offen` · `in Arbeit (PR n)` · `erledigt (PR n)` · `Frage` (wartet auf Jorven) · `entfällt`

**Kürzel:** Ü1 bis Ü25 = "25 Vorschläge zur Überarbeitung", F1 bis F42 = "Vorschläge für neue Features" aus dem Überblick. P01 bis P82 = Pakete dieser Roadmap (siehe [Pakete und Reihenfolge](#pakete-und-reihenfolge)). A1 bis Q10 = Detailpunkte aus den Tabs "Mechaniken im Detail" und "Technik und Bedienung" des vollständigen Reviews (Abschnitt 13).

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

Offene PRs, die damals Punkte dieser Roadmap berührten: PR 81, 91, 112, 137, 139. Stand 15.11.2026 sind alle davon gemergt oder geschlossen; offene PRs stehen jetzt im [Arbeitsplan](arbeitsplan.md).

---

## 2. Fehler beheben (Ü1 bis Ü7)

| Nr | Punkt | Status | Paket |
|---|---|---|---|
| Ü1 | Dauerlieger-Pacht reparieren: Fischer 15 €, Dauerlieger 50 % ihres Gastpreises, wie die Karte verspricht | erledigt (PR 149) | P01 |
| Ü2 | Hafenbüro Stufe 1 einen Nutzen geben (Knopf "Kassieren" erst mit Stufe 1 oder andere Wirkung) | erledigt (PR 146): Knopf erst mit Bürostufe 1 | P02 |
| Ü3 | Einstieg neu abstimmen: Schritt 1 ohne Sonne, Schritt 3 "Liegegeld beim Anlegen" | erledigt (PR 112) | P03 |
| Ü4 | Ein Zähler für das Abschlussziel Stufe 6 (Tag der offenen Tür zählt mit) | erledigt (PR 139): eine Liste `GROSSSCHIFF_BESUCHE` in `data/services.js`, ein Zähler `state.bigVisits`; der Tag der offenen Tür gehört zum Flottenbesuch des Stützpunkts | P04 |
| Ü5 | Boote auf wegfallenden Plätzen beim Stufenausbau regeln (B01, B02 in Stufe 3, T-Kopf Steg B): Gäste reisen erst ab, Dauerlieger ziehen samt Dauerplatz um | erledigt (`sim.js` `advanceStage`, Hook `stageUp`, Test in `tests/dauerlieger.test.mjs`) | P05 |
| Ü6 | Regeltests gegen die echten Zahlen: gemeinsamer Helfer mit `rulesFromEconomy(ECONOMY)` | erledigt | P06 |
| Ü7 | Tempo und Hilfetexte vereinheitlichen (Knöpfe, Taste F, Plan, PC-Hilfe) | erledigt, Jorven bestätigt "Tempo so bleiben" (Taste F = 3x über die Tempo-Knöpfe, PC-Hilfe, Kommentare und Doku ohne Sonne, plan.md 3 und 14); Einstieg-Texte in P03 | P07 |

## 3. Kernschleife (Ü8 bis Ü14)

| Nr | Punkt | Status | Paket |
|---|---|---|---|
| Ü8 | Selbst-Einfahren weniger klug: die nächste oder eine der freien Boxen am Steg, auch eine zu große, damit Umlenken lohnt; Boote berühren sich dabei nie | Regel erledigt (`sim.js` `selfBerth`: nächste Box ab Warteboje, eins nach dem anderen); Abstand und Ausweichen bei den Schiffsanimationen offen | P10 |
| Ü9 | Wunschplätze beim Zuweisen in Gold zeigen (Strom, Fingersteg) | erledigt (PR 153: gold mit Stern, `game.sim.wunschPlaetze`) | P10 |
| Ü10 | Wünsche als Symbole über wartenden Booten, drei Umrisse für die nächsten Ankünfte (`sim.preview()`) | erledigt (PR 158, [vorschau.md](vorschau.md)) | P11 |
| Ü11 | Hafenbüro lässt Sonderfälle beim Spieler (Mehrrumpf, XL, Sondergäste, nur ein passender Platz), wie `plan.md` Abschnitt 3 und 14 | erledigt (PR 146) | P02 |
| Ü12 | Kassieren verständlich: Rundgang erst mit dem Abend, Einstieg erklärt die Hälfte, halbe Münze sieht anders aus | erledigt bis auf den Einstieg-Text (P03): Rundgang ab Abend, bringt vier Fünftel (B4), Münze wird dabei silbern mit „18 € statt 22 €“ | P12 |
| Ü13 | Abweisen von Hand und Wegfahren aus Ungeduld mit derselben Folge | erledigt (PR 153, `turnAwayRating`) | P10 |
| Ü14 | Tagesziele zählen nur eigene Handlungen, kombinierte Ziele, Ruf als Belohnung (`plan.md` 9a) | erledigt (PR 152) | P13 |

## 4. Balancing (Ü15 bis Ü20)

| Nr | Punkt | Status | Paket |
|---|---|---|---|
| Ü15 | Weicher Start: 100 € Startgeld oder geschenktes WC | erledigt (PR 237): geschenktes Toilettenhäuschen beim ersten Bauen | P17 |
| Ü16 | Stufe 1 und 2 straffen (Stufe 2 dauert heute 47 Spieltage), Gästeziele senken | erledigt (PR 318, 331): Ziel Stufe 2 90 Gäste; seit dem 5-Minuten-Tag (PR 319, 331) dauert Stufe 1 rund 5, Stufe 2 rund 11 bis 14 Spieltage, alles Bauen kostet etwa die Hälfte (Dorfhafen 140 €, Steg B 200 €) | P17 |
| Ü17 | Dem Ruf eine Aufgabe geben: Wünsche je Bootsart aus `data/boats`, spürbare Kapazität | erledigt (P19): Wünsche je Bootsart, Ruf über drei Tage, Angebote als Wünsche, Kapazität sichtbar (Schild am Gebäude aus P55, "heute voll" in der Bootskarte), [ruf.md](ruf.md) | P19 |
| Ü18 | Sparphasen füllen: Ausbau in zwei bis drei Bauabschnitte, einzeln bezahlt, sichtbar wachsend | erledigt (PR 232) | P18 |
| Ü19 | Winter nutzen: Zeitraffer vor Stufe 4 oder Winterarbeiten (F14) | erledigt (PR 245): Winterarbeiten und „Winter überspringen“ | P20 |
| Ü20 | Dauerlieger als Entscheidung: Spieler legt fest, welche Boxen Dauerplätze sind (höchstens ein Viertel der Gastboxen), Saisonpacht im Voraus, sichere Einnahme bei Sturm | erledigt (PR 149) | P01 |

## 5. Rückmeldung (Ü21 bis Ü23)

| Nr | Punkt | Status | Paket |
|---|---|---|---|
| Ü21 | Bewertung beim Ablegen über dem Boot zeigen, bei schlechter Note mit Symbol des fehlenden Wunsches | erledigt (PR 154) | P14 |
| Ü22 | Tagesabschluss am Abend: Liegegeld, Services, Pacht, Tagesziele, weggefahrene Boote, bester Tag | erledigt (PR 159): Karte am Tagesende, Verlauf 30 Tage, `docs/tagesabschluss.md` | P15 |
| Ü23 | Aufstieg und Regionsabschluss feiern: Kamerafahrt, Zahlen der Stufe, "Weiterspielen" | erledigt (PR 156) | P16 |

## 6. Aufräumen (Ü24, Ü25)

| Nr | Punkt | Status | Paket |
|---|---|---|---|
| Ü24 | Eine Quelle für alle Zahlen: alles nach `economy.js`, Rest löschen (`data/rules.js` alte Werte, `services.js`-Mischung, `events.js` gegen `ECONOMY.ereignisse`, Feature-Dateien). Fehler `sturmschutz: true` trifft auf Code, der eine Zahl erwartet | erledigt | P06 |
| Ü25 | Ein Speicherweg und "Neues Spiel" (`newGame()` gibt es), mehrere Speicherplätze | erledigt | P09 |

---

## 7. Mechaniken im Überblick

Note 1 bis 5 aus dem Überblick. "nein" heißt: bleibt, wie es ist.

| Mechanik | Note | Überarbeiten | Paket |
|---|---|---|---|
| Baumodus mit Vorschau und Rat | 5 | nein | (P18 baut darauf auf) |
| Tagesrhythmus | 4 | nein | |
| Passregel | 4 | nein | (P29 Baggern gibt ihr einen Hebel: ausgebaggerte Stege und Niedrigwasser) |
| Stegprojekte | 4 | teilweise | P05 |
| Tagestörn der Gäste | 4 | nein | |
| Grün-Rot-Schilder | 4 | nein | (P50 Form zusätzlich zur Farbe, erledigt) |
| Wetterflagge | 4 | nein | |
| Fotomodus und Hafen schauen | 4 | nein | |
| Menschen im Hafen | 4 | nein | |
| Speichern, Export, Web-App | 4 | erledigt | P09 |
| Ankunft und Selbst-Einfahren | 3 | ja | P10 |
| Wünsche und Versorgung | 3 | teilweise | P10, P11, P19 |
| Liegegeld und Kassieren | 3 | ja | P12 |
| Ausbaustufen und Ziele | 3 | teilweise | P16, P18 |
| Services (21 Stück, mit eigener Wirkung) | 4 | ja | P06, P23 (erledigt) |
| Ereignisse und Wetter | 3 | teilweise | P06, P24 |
| Stammgäste | 3 | ja | P25 (erledigt) |
| Einstieg | 3 | ja | P03 |
| Tempo und Vorspulen | 3 | ja | P07 |
| Tests | 3 | ja | P06 |
| Zuweisen von Hand | 2 | ja | P10 |
| Ruf und Bewertung | 2 | ja | P14, P19 |
| Hafenbüro (4 Stufen, PR 146) | 2 | ja | P02 |
| Jahreslauf und Winter | 3 | ja | P20 (erledigt) |
| Dauerlieger | 2 | ja | P01 |
| Tagesziele | 2 | ja | P13 |
| Abschlussziel Stufe 6 | 2 | ja | P04, P16 |
| Logbuch | 1 | ja | P21 (erledigt) |
| Nordsee und Gezeiten | 1 | ja | P57 |

P23 (Services) und P24 (Ereignisse) sind die Pakete "Services mit eigener Wirkung" und "Ereignisse zum Vorbereiten", siehe Paketliste.

---

## 8. Geplant oder dokumentiert, aber nicht im Spiel

Jeder Punkt wird gebaut (Paket) oder aus Plan und Doku genommen. Nichts bleibt als Versprechen stehen.

| Was | Wo es steht | Entscheidung | Paket |
|---|---|---|---|
| Vorschau der nächsten 3 Boote | plan.md 3 | erledigt (PR 158, Funk ab Hafenbüro 1) | P11 |
| Wünsche als Symbole über dem Boot | plan.md 3 | erledigt (PR 158) | P11 |
| Hafenbüro lässt Sonderfälle beim Spieler | plan.md 3 | gebaut (PR 146) | P02 |
| Vorspulen 2x, 3x erst mit Hafenbüro | plan.md 3, 14 | ersetzt durch Pause, 1x, 3x, 8x ab Start (Jorven bestätigt) | P07 |
| Hafenhorn gedrückt halten (Sammelkassieren) | plan.md 8, Ton fertig | erledigt (P26) | P26 |
| Fernglas mit Steckbrief (Doppeltipp) | plan.md 8 | erledigt (P26) | P26 |
| Möwen aufscheuchen, Wellenring, Glocke | plan.md 8 | erledigt (P26) | P26 |
| Logbuch mit Bild | plan.md 9 | erledigt (docs/logbuch.md) | P21 |
| Erfolge | plan.md 9 | bauen | P22 |
| Endlosmodus nach Abschluss | plan.md 9, 12 | gebaut: Saisonziele (PR 156, docs/aufstieg.md) | P16 |
| Bestenliste, Online mit Supabase | plan.md 12, README | bauen, als letzter Schritt | P58 |
| Nordsee mit Gezeiten, Schleuse, Trockenfallplätzen | plan.md 9, regionen.md | bauen, nach der Ostsee | P57 |
| Revierfaktoren in `regions.js` (Hafengeld, Ankünfte, Startgeld, Schiffshäufigkeit) | regions.js | mit Nordsee bauen | P57 |
| Bauzeit der Ausbauten, Winter-Bautempo (`bautage`, `winterBautempo`) | economy.js | erledigt (PR 232): `bautage` = Bauabschnitte, `winterBautempo` gelöscht | P18 |
| `ECONOMY.ereignisse` (Sturm alle 10 Tage, Hafenfest 1.500 €) | economy.js | eine Quelle, Rest löschen | P06 (erledigt) |
| Gruppen-Ankunft, Wünsche je Bootsart, `feeFactor`, `arrivalWeight` | data/boats/*.js | Wünsche, `feeFactor`, `arrivalWeight` erledigt (P19 Teil 1); Gruppen erledigt (P32) | P19, P32 (Gruppen) |
| Stammgast bringt Ruf am alten Platz | plan.md 9a | erledigt: Lieblingsplatz +0,5 Anker ([stammgaeste.md](stammgaeste.md)) | P25 |
| Dauerlieger zahlen pro Saison, Gast wird umgelegt | plan.md 9a | bauen | P01 |
| Tagesziel-Belohnung in Ruf, Ziele wie "Drei Segelboote mit Dusche" | plan.md 9a | gebaut (PR 152) | P13 |
| Tretboote und Kanus nur als Kulisse | plan.md 14 (im Spiel zahlender Gast S2, 6 €) | entfällt: bleiben in Stufe 1 Gäste, plan.md angepasst | |

## 9. Im Spiel, aber nicht dokumentiert

Alle Punkte gehen in die Doku (Paket P08), die ersten fünf ändern sich zusätzlich mit ihrem Paket. Stand PR 177: alle zwölf stehen jetzt in [balancing.md](balancing.md#regeln-im-spiel-die-sonst-nirgends-stehen) bzw. [tests.md](tests.md#testmodus-und-adresszusätze), die Übernahme des alten Rückfall-Speicherwegs steht seit P09 in [speichern.md](speichern.md#ein-speicherweg).

| Was im Spiel passiert | Wo im Code | Paket |
|---|---|---|
| Dauerlieger zahlen pauschal 15 € pro Abend | `sim.js` (`startEvening`, `rulesFromEconomy`) | P01 |
| Dauerplätze kosten nichts, keine Obergrenze, keine Gäste, keine Bewertungen | `features/dauerlieger.js` | P01 |
| Abweisen von Hand kostet nichts, Wegfahren aus Ungeduld kann eine 2,5 bringen (erledigt, PR 153) | `sim.js` (`dismiss`, `turnAway`) | P10 |
| Rundgang startet bei 68 % des Tages, 8 Sekunden vor dem Abend (erledigt: startet mit dem Abend, `RUNDGANG_AB` entfernt, steht in `spielregeln.md`) | `render/people.js` | P12 |
| Start mit 0 € und fünf Startbewertungen von 3 Ankern | `state.js`, `economy.js` (`ruf`) | P17 |
| Service-Werte als Mischung aus zwei Dateien | `services/rules.js` (`mische`) | P06 (erledigt) |
| Dritte Service-Stufen und abweichende Stufennamen (Travellift) | `data/services.js`, `economy.js` | P06 (erledigt: Stufenzahl und Namen aus einer Liste), dokumentiert in `balancing.md` (P08, PR 177) |
| Mindestruf je Service-Stufe (Regattaverein, Werfthalle 3,8; Museumshafen 4,0; Kreuzfahrtterminal 4,5; Marinestützpunkt 4,6) | `data/services.js` | P08, dokumentiert in `balancing.md` (P08, PR 177) |
| Deckel: Ruf-Bonus aller Services höchstens +0,75, Sturmschutz höchstens 0,8 | `data/services.js` | P08, dokumentiert in `balancing.md` (P08, PR 177) |
| Marinestützpunkt ersetzt Flottenbesuch (alle 10 Tage) durch Tag der offenen Tür (alle 14 Tage) | `data/services.js` | P04 (behoben: Stützpunkt bringt Flottenbesuch alle 6 Tage mit Tag der offenen Tür), dokumentiert in `balancing.md` (P08, PR 177) |
| Rückfall-Speichern unter `hafenmeister.save` neben `hafenmeister.spielstand` | `state.js`, `save/storage.js` | P09 (erledigt) |
| Adresszusätze `?stufe=`, `?services=alle`, `?uhrzeit=`, `?revier=nordsee`, `?einstieg=1`, `?demo=boote`, `?stegbild=` verstreut | mehrere Module | P08: Liste in `docs/tests.md`, erledigt (PR 177) |

## 10. Dokumente

| Datei | Stand laut Überblick | Paket |
|---|---|---|
| `README.md` | veraltet ("Meilenstein 0 ist fertig", Supabase, Balancing-Skript am falschen Ort) | P08, erledigt (PR 177) |
| `docs/plan.md` | teils veraltet (Meilensteine, Vorspulen, Hafenhorn, Fernglas, Vorschau, Pixel-Oberfläche fehlt) | P08, erledigt (PR 177) |
| `docs/abnahme.md` | Ist-Stand-Tabelle veraltet | P08, erledigt (PR 177) |
| `docs/einstieg.md` | erledigt (PR 112) | P03 |
| `docs/regionen.md` | beschreibt Ungebautes als fertig | P08 erledigt (PR 177) (als "geplant" gekennzeichnet), P57 später |
| `docs/echter-hafen.md` | Teil B und C überholt (C1, C2, C3, C9, C10, C11 behoben) | P08, erledigt (PR 177) |
| `docs/balancing.md` | "4x, Sonne ziehen", "18 Services" | P08, erledigt (PR 177) |
| `docs/neue-features.md` | Dauerlieger "50 Prozent" | P01 |
| `docs/spielregeln.md` | Pacht der Dauerlieger, Start des Rundgangs fehlen | P01, P12 |
| `docs/services.md` | Stufennamen, Zählung der Großschiffbesuche (Zählung erledigt, P04) | P04; P08 erledigt (PR 177) (Statuszeile, Mindestruf und Deckel in `balancing.md`) |
| `docs/ereignisse.md` | Winter "mit wenig Ankünften" | P20 |
| `docs/speichern.md` | Exportformat HM1 fehlt | P09 (erledigt: Abschnitte "Ein Speicherweg", "Speicherplätze", "Versionen") |
| `web/js/audio/README.md` | nennt Hafenhorn-Ereignis, das kein Modul sendet | P26, erledigt (`ui/hafengesten.js` sendet es) |
| `docs/schiffsanimationen.md` | "Mit der Sonne vorspulen" (erledigt, P07) | P07 |
| `docs/ui/pc.md`, `tablet.md`, `handy.md` | vom 11.11., teils durch `oberflaeche.md` ersetzt | P08, erledigt (PR 177): nach `docs/archiv/ui/` verschoben, Gültiges steht in `oberflaeche.md` |
| übrige (`grundgeruest.md`, `tests.md`, `veroeffentlichen.md`, `landschaft.md`, `stegbilder.md`, `pixel-art.md`, `schiffe-xl.md`, `schiffe/groesse-l.md`, `hafen-und-schiffe.md`, `vorbilder.md`) | geprüft, Statuszeilen ergänzt, `grundgeruest.md` auf den Stand gebracht | P08, erledigt (PR 177) |
| `docs/bauen.md`, `docs/ui/oberflaeche.md` | aktuell | |

---

## 11. Neue Features (F1 bis F42)

Jorven (12.11.2026): Jedes Feature wird komplett ausgebaut. Jedes bekommt ein eigenes Paket, eng verwandte teilen sich eins.

### Kernspiel

| Nr | Feature | Status | Paket |
|---|---|---|---|
| F1 | Päckchen liegen: bei vollem Hafen längsseits an ein gleich großes Boot, halbes Liegegeld, beide Crews einen halben Anker schlechter | erledigt (PR 330, [paeckchen.md](paeckchen.md)): ab Stufe 2 an Stegköpfen, Kai und Yachtsteg, eine Nacht, außen legt zuerst ab | P27 |
| F2 | Anmeldung per Funk: morgens melden sich ein bis zwei Boote an, Platz freihalten gibt Bonus | erledigt (PR 288, [funk-anmeldung.md](funk-anmeldung.md)) | P28 |
| F3 | Flottillen: drei bis fünf Boote wollen am selben Steg liegen (Feld `group`) | erledigt (P32, [flottillen.md](flottillen.md)) | P32 |
| F4 | Liegende Boote umlegen (verholen), zweimal dieselbe Crew senkt die Bewertung | erledigt (PR 314): halten und ziehen, ab dem zweiten Mal −0,5 Anker | P33 |
| F5 | Windseite: bei Starkwind Außenplätze unruhig, geschützte Plätze +0,5 Anker (Feld `exposed`) | erledigt (PR 392, [wind.md](wind.md)): Windlage je Platz aus Wellenweg gegen den Wind des Tages, ab Stufe 2, Zeichen beim Ziehen | P34 |
| F6 | Preisstufe am Hafenbüro: günstig, normal, gehoben, eine Entscheidung pro Saison | erledigt (P35, [preisstufe.md](preisstufe.md)): Preistafel im Gästebuch und Aufsteller am Hafenmeisterhaus, einmal je Saison und nach jedem Ausbau, Gäste schreiben über die Preise | P35 |
| F7 | Baggern: Wassertiefe je Steg als Bauprojekt | erledigt (P29, PR 420, [baggern.md](baggern.md)): je Steg ab Stufe 2 im Bauen-Menü, Bagger mit Schute, dazu Niedrigwasser bei starkem Westwind, an dem knapp liegende Boote im Schlick sitzen | P29 |
| F8 | Stege nachrüsten: Wasser, Strom für Steg A, Fingerstege, Beleuchtung, am Steg sichtbar | erledigt (PR 297): Fingerstege und Steglaternen je Steg, Stromsäulen sichtbar; Strom für A entfällt (nur S-Boote), Wasserhähne seit P31, [nachruesten.md](nachruesten.md) | P30 |
| F9 | Neue Wünsche: WLAN, Waschmaschine, Frischwasser, Absaugstation, Brötchen | erledigt (P31, [gaestewuensche.md](gaestewuensche.md)): Frischwasser über Wasserhähne am Steg (Stufe 2), WLAN (3), Waschmaschine ab 3 Nächten (4), Absaugstation (5), Hafenrundfahrt mit der Barkasse (6); Brötchen seit P19 | P31 |
| F10 | Bojenfeld: billige Muringbojen im See für kleine Boote ohne Wünsche | erledigt (P36, [bojenfeld.md](bojenfeld.md)): 6 Bojen ab Stufe 2, 6 weitere ab Stufe 4, Lage je Küste im tiefen Wasser, Boote S und M bis 9 m, 60 % Liegegeld, ohne Strom und Wasser, letzte Wahl für Büro und Selbst-Einfahren, kein Dauerplatz | P36 |

### Hafenleben

| Nr | Feature | Status | Paket |
|---|---|---|---|
| F11 | Havarist wird eingeschleppt, braucht sofort einen Platz, Ruf und neuer Stammgast | offen | P37 |
| F12 | Eigenes Hafenfest einmal pro Saison ansetzen | erledigt (P38, [hafenfest.md](hafenfest.md)): Tag wählen, Schmuck, Musik, Marktstände, Feuerwerk, Bilanz am Abend | P38 |
| F13 | Jugendtraining: Opti-Gruppe mit Trainerboot, braucht Slip und Segelclub | erledigt (P39, [jugendtraining.md](jugendtraining.md)): jeden 4. Saisontag Optis und Jollen über den Slip hinaus, Dreieckskurs vor den Stegen, Trainerboot braucht eine Box (feste Trainerbox möglich), wartende Boote halten das Fahrwasser frei, Beitrag und +0,2 Anker für zusehende Gäste | P39 |
| F14 | Winterarbeiten: drei kleine Aufträge, Komfortbonus für einen Steg | erledigt (PR 245) | P20 |
| F15 | Krantage: Dauerlieger sichtbar ins Winterlager und zurück | erledigt (PR 245) | P20 |
| F16 | Seltene Besucher: Weltumsegler, Schweinswal, Schwäne; Logbuch und Fotomotiv | erledigt (P40): vier Schiffe mit Ehrenplatz, Schwäne und Schweinswal, Fotos im Logbuch-Reiter „Besucher“, vier Erfolge, docs/besucher.md | P40 |
| F17 | Mehr Ereignisse: Mittsommer, Holzboot-Treffen, Heringstage | erledigt (PR 299), dazu Hanse-Woche ab Stufe 5 | P24 |

### Langzeit

| Nr | Feature | Status | Paket |
|---|---|---|---|
| F18 | Gästebuch: letzte 20 Bewertungen am Hafenbüro | erledigt (PR 154) | P14 |
| F19 | Statistikseite: Belegung und Einnahmen der letzten 30 Tage, Einnahmen nach Quelle | erledigt (P41, [Statistik](statistik.md)) | P41 |
| F20 | Saisonbilanz nach dem Winter | erledigt (P41, Winterpause mit Quellen, Belegung, Vergleich) | P41 |
| F21 | Herausforderungen mit Seed (nur Segler, kein Hafenbüro, doppelte Ankünfte) | offen | P42 |
| F22 | Fotoaufträge und Postkarte | offen | P43 |
| F23 | Hafenname und Flagge, sichtbar an Einfahrt und Mast | offen | P44 |
| F24 | Kreativmodus als eigener Spielstand | offen | P45 |
| F25 | Einstellungen: Schilder auch über die Form, weniger Bewegung, größere Schrift, Linkshänder am Handy | erledigt (Menü, Einstellungen; docs/ui/oberflaeche.md) | P50 |

### Spielstände

| Nr | Feature | Status | Paket |
|---|---|---|---|
| F26 | Mehrere Speicherplätze: wechseln, neu, überschreiben, kopieren, umbenennen, löschen, als Datei | erledigt (bis 8 Plätze, Papierkorb, Gesamtdatei) | P09 |
| F27 | Neues Spiel mit Auswahl: Hafenname, Stegbild, später Herausforderung oder Revier | erledigt für Name, Stegbild, Küste, Einführung; Herausforderung und Revier folgen | P09, P44 |
| F28 | Probe-Kopie für teure Ausbauten | erledigt | P09 |

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
| F35 | Wind beim Anlegen: große Boote brauchen länger, bevorzugen Plätze gegen den Wind | erledigt (PR 392, [wind.md](wind.md)): L und XL mit Rückenwind langsamer und −0,25 Anker, Büro wählt Bug gegen den Wind | P34 |

### Geschichten

| Nr | Feature | Status | Paket |
|---|---|---|---|
| F36 | Hafenchronik: jeder Tag eine Zeile | erledigt | P21 |
| F37 | Gästepost von Stammgästen, hängt im Hafenbüro | erledigt: Ankündigung und Empfehlung, Pinnwand im Gästebuch | P25 |
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
| Alte Ersatzregeln mit eigenen Zahlen | `web/js/data/rules.js` | P06 (erledigt) |
| Tote Zahlen `ECONOMY.ereignisse` oder die doppelten in `data/events.js` (eine Quelle bleibt) | `economy.js`, `data/events.js` | P06 (erledigt) |
| Zweiter Satz Service-Zahlen (Mischung `mische`) | `data/services.js`, `services/rules.js` | P06 (erledigt) |
| Alter Rückfall-Speicherweg `hafenmeister.save` mit eigenem Exportformat (alte Stände werden beim Laden einmal übernommen) | `state.js`, `save/storage.js` | P09 (erledigt) |
| Alle Texte zur Sonne als Vorspul-Griff | `features/einstieg.js` (erledigt, PR 112, P03), `ui/input-pc.js`, `ui/input-touch.js`, `ui/gesten.js`, Doku (erledigt, P07) | P03, P07 |
| Ungenutzte Felder `bautage`, `winterBautempo`, falls P18 sie nicht nutzt (erledigt, PR 232) | `economy.js` | P18 |
| Versprechen in Plan und Doku ohne Gegenstück im Spiel (Abschnitt 8) | `plan.md`, `regionen.md`, `README.md` | P08, erledigt (PR 177): als "geplant" mit Paket markiert |

---

## 13. Detailpunkte aus "Mechaniken im Detail" und "Technik und Bedienung" (A1 bis Q10)

Aus dem vollständigen Review (`Hafenmeister-Review-komplett.pdf`, 12.11.2026). Die Kürzel sind die des Reviews. Achtung Namensgleichheit: Services-Punkte heißen dort F1 bis F9 (hier "Svc F1"), Bedienpunkte P1 bis P10 (hier "Bed P1"). Pakete dieser Roadmap haben immer zwei Ziffern (P01).

### A Ankunft, Warten und Zuweisen

| Kürzel | Punkt | Status | Paket |
|---|---|---|---|
| A1 | Selbst einfahrende Gäste nehmen die nächste freie Box am Steg, auch zu große | erledigt (PR 147, PR 176 bevorzugt Wunschplätze) | P10 |
| A2 | "Einfahren" ohne Hafenbüro nimmt irgendeinen passenden Platz, den besten kennt erst das Büro | erledigt (PR 146) | P02 |
| A3 | Platzwert beim Ziehen: Liegegeld mit Wunschbonus, erwartete Anker, Wunschplätze gold | erledigt (PR 153, `game.sim.platzWert`) | P10 |
| A4 | Geduld sichtbar: Ring an der Boje, im letzten Drittel Flagge oder kurzes Tuten | erledigt (P55: Ring über dem Boot, rot und blinkend im letzten Drittel, kurzes Tuten, ruht abends; `docs/hafenzeichen.md`) | P55 |
| A5 | Vorschau: drei Bootsumrisse mit Größe und Uhrzeit, als "Funkgerät" Wirkung der ersten Bürostufe | Freischaltung erledigt (PR 146, `rules.office.preview`), Anzeige erledigt (PR 158) | P11, P02 |
| A6 | Passgenau belohnen: Bonus, wenn die Box höchstens ein Fünftel größer ist | erledigt (PR 153, `ECONOMY.passgenau`, ab Stufe 2) | P10 |
| A7 | Selbst-Einfahren einstellbar: schnell, langsam, aus | erledigt (Einstellungen: Normal 8 s, Langsam 20 s, Nie) | P50 |
| A8 | Abweisen und Wegfahren angleichen (= Ü13) | erledigt (PR 153) | P10 |
| A9 | Bojenlieger über Nacht zahlen wenig und werden morgens zuerst bedient | erledigt (PR 153, `ECONOMY.warten.bojengeld`) | P10 |
| A10 | Größenmischung je Stufe: an vollen Tagen ein bis zwei große Boote zu viel | erledigt (PR 287, `ECONOMY.platzMix`, `sim.sizeBerthFactors`) | P17 |

### B Wünsche, Versorgung, Liegegeld und Kassieren

| Kürzel | Punkt | Status | Paket |
|---|---|---|---|
| B1 | Auslastung an jedem Versorgungsgebäude ("14 von 20"), Schlange vor der Dusche | Schild erledigt (P55, `game.sim.auslastung()`), Schlange erledigt (L2) | P55 |
| B2 | Wunschsymbole über dem Boot, beim Anlegen Haken oder grau | erledigt (PR 158) | P11 |
| B3 | Münze nennt ihren Wert ("22 € + 11 €") | erledigt (`render/boat-view.js`, `feeReady` mit `base`, `bonus`) | P12 |
| B4 | Rundgang als Helfer: erst abends, nur vergessene Münzen, etwa vier Fünftel statt der Hälfte | erledigt (`ECONOMY.kassieren.rundgangAnteil` 0,8, gilt auch nachts) | P12 |
| B5 | Langen Kassierstrich mit Trinkgeld belohnen; Knopf "Kassieren" erst mit Hafenbüro | erledigt: Strich-Trinkgeld (PR 151, `sim:strokeTip`), Knopf (PR 146) | P12, P02 |
| B6 | Mehrere Nächte beim Anlegen auf einmal zahlen | erledigt (`ECONOMY.kassieren.vorausNaechte`, `boat.paidThrough`, größere Münze) | P12 |
| B7 | Wünsche je Bootsart aus den Bootsdaten nutzen | erledigt (P19 Teil 1, `type.wishes`) | P19 |
| B8 | Neue Wünsche in späten Stufen, je Stufe mindestens einer (= F9) | erledigt (P31): jede Stufe 1 bis 6 hat mindestens einen neuen Wunsch, Test in `tests/gaestewuensche.test.mjs` | P31 |
| B9 | Wege zählen: weit vom Sanitärhaus zählt die Dusche halb | erledigt (P19 Teil 2): über 120 m zählt WC oder Dusche halb, [ruf.md](ruf.md) | P19 |
| B10 | Liegegeld nach Länge statt fest je Größe | erledigt (PR 252, `ECONOMY.klassen.proMeter`, `sim.baseNightlyFee`) | P17 |
| B11 | Bezahlt-Zeichen am Bug | erledigt (PR 131) | |

### C Ruf und Bewertung

| Kürzel | Punkt | Status | Paket |
|---|---|---|---|
| C1 | Bewertung beim Ablegen zeigen (= Ü21) | erledigt (PR 154) | P14 |
| C2 | Ruf als Schnitt der letzten drei Tage statt 20 Bewertungen | erledigt (P19 Teil 1, mindestens 10 Bewertungen) | P19 |
| C3 | Service-Bonus als Extra-Wünsche statt Aufschlag auf jede Bewertung | erledigt (P19 Teil 1, `angebotWunsch`) | P19 |
| C4 | Gäste ohne Wünsche geben 4,5, der Platz entscheidet über den Rest | erledigt (P19 Teil 1, alle Wünsche ebenfalls 4,5) | P19 |
| C5 | Ruf als Auszeichnung mit Namen und Zeichen im Hafen | erledigt (P19 Teil 2): drei Stufen mit Namen, Wimpel am Hafenmeisterhaus | P19 |
| C6 | Ruf lockt andere Gäste (ab 4 große Yachten, ab 4,5 seltene Modelle) | erledigt (P19 Teil 1, `ruf.lockt`) | P19 |
| C7 | Warnen, bevor es Anker kostet (Gebäude blinkt bei fast ausgebuchter Dusche) | erledigt (P55: Schild knapp orange und blinkend, voll rot, Tipp beim ersten Mal) | P55 |
| C8 | Stammgäste zählen beim Ruf doppelt | erledigt (P25) | P25 |
| C9 | Ruf-Verlauf mit den drei häufigsten Gründen für schlechte Noten | erledigt (PR 154) | P14 |

### D Ausbaustufen, Stegprojekte und Baumodus

| Kürzel | Punkt | Status | Paket |
|---|---|---|---|
| D1 | Ausbau in Bauabschnitten (= Ü18) | erledigt (PR 232) | P18 |
| D2 | Über Nacht gebaut: abends Baustelle, morgens fertig | erledigt (PR 232, für die Bauabschnitte des Stufenausbaus) | P18 |
| D3 | Frühe Stufen kürzen (= Ü16) | erledigt (P17) | P17 |
| D4 | Wegfallende Plätze regeln (= Ü5), Hinweis im Baumenü | Regel erledigt (PR 143), Hinweis im Baumenü erledigt (PR 232) | P05, P18 |
| D5 | Zwei Varianten je Steg (viele schmale oder wenige breite Boxen) | erledigt (PR 321): je Paar wählbar über Doppelboxen, [stege-umbauen.md](stege-umbauen.md) | P59 |
| D6 | Boxen umbauen (zwei schmale zu einer breiten) | erledigt (PR 321): Doppelbox für Mehrrumpfboote ab Stufe 4, Rückbau möglich | P59 |
| D7 | Sparziel anheften, Balken neben dem Geld, Schild am Bauplatz | erledigt (PR 232) | P18 |
| D8 | Verschönern: Bäume, Bänke, Laternen, Kübel, Mast, Farbe | offen | P60 |
| D9 | Neue Gastplätze in Stufe 6 (Superyacht-Steg oder Stadtkai) | erledigt (PR 326): Yachtsteg vor der Westmole, zwei XL-Plätze | P59 |
| D10 | Stufenaufstieg feiern (= Ü23) | erledigt (PR 156) | P16 |

### E Hafenbüro und Automatik

| Kürzel | Punkt | Status | Paket |
|---|---|---|---|
| E1 | Stufe 1 wird das Funkgerät: Vorschau und Knopf "Kassieren" | erledigt (PR 146), Vorschau-Anzeige mit P11 | P02 |
| E2 | Kassenautomat nur für S und M, L und XL persönlich mit Trinkgeld | erledigt (PR 146) | P02 |
| E3 | Büro schlägt vor (gold), Spieler bestätigt; erst später volle Automatik | erledigt (PR 146) | P02 |
| E4 | Sonderfälle bleiben Handarbeit (= Ü11) | erledigt (PR 146) | P02 |
| E5 | Automatik je Größenklasse an oder aus | erledigt (PR 146) | P02 |
| E6 | Von Hand eingewiesene Gäste geben einen Viertelanker mehr | erledigt (PR 146) | P02 |
| E7 | Volle Automatik erst ab Hafenstufe 4 und teurer | erledigt (PR 146) | P02 |
| E8 | Neue Aufgaben für den Hafenmeister (Reservierungen, Havaristen, Feste) | teilweise: Reservierungen erledigt (P28, PR 288), eigene Feste erledigt (P38); Havaristen kommen mit P37 | P02 (verknüpft P28, P37, P38) |

### F Services und Angebote (hier "Svc")

| Kürzel | Punkt | Status | Paket |
|---|---|---|---|
| Svc F1 | Eine Liste, klare Stufennamen | erledigt | P06 |
| Svc F2 | Jeder Service ändert das Spiel (Slip, Mastenkran, Fahrradverleih, Räucherei, Werft) | erledigt (P23): Trailerboote am Slip, Mast legen und Radtour verlängern den Aufenthalt, Werft holt Reparaturboote, Räucherei bekommt Abendgäste; Havaristen folgen mit P37 | P23 |
| Svc F3 | Entweder-oder-Bauplätze (Café oder Eisdiele, Werfthalle oder Winterhalle) | erledigt (P23): drei Wahlplätze (dazu Kreuzfahrtterminal oder Marinestützpunkt), Umbau statt Sperre | P23 |
| Svc F4 | Einnahmen zeigen: Münzen über Gebäuden, Tagesabschluss je Quelle | erledigt (PR 159) | P15 |
| Svc F5 | Auslastung statt Festbetrag | erledigt (P23): Bäcker, Café, Eisdiele, Räucherei, Fahrradverleih verdienen an den Crews im Hafen, Regen wirkt jetzt auch im Spiel | P23 |
| Svc F6 | Abschlussziel reparieren, Stützpunkt bringt mehr Besuche (= Ü4) | erledigt (PR 139): ein Zähler; Stützpunkt Flottenbesuch alle 6 statt 10 Tage, mit Tag der offenen Tür | P04 |
| Svc F7 | Große Schiffe als Ereignis mit Tagesgästen | erledigt (P23): Gruppen gehen vom Kreuzfahrtschiff und der Marine in den Ort, sechs Angebote verdienen mit | P23 |
| Svc F8 | Mindestruf mit Sinn oder weg | erledigt (P19 Teil 1): bleibt, mit dem neuen Ruf ist er eine echte Hürde | P19 |
| Svc F9 | Service-Karte mit Bilanz (verdient, bezahlt sich in n Tagen) | erledigt (P23): Bilanz auf der Karte, Schätzung für den nächsten Ausbau auch im Baumenü | P23 |

### G Ereignisse, Wetter, Jahreslauf und Winter

| Kürzel | Punkt | Status | Paket |
|---|---|---|---|
| G1 | Vorbereiten: Ankündigungskarte, Boxen für das Ereignis sperren | erledigt (PR 281) | P24 |
| G2 | Sturm ab Stufe 3 spürbar, Boote vorher nach innen verholen | erledigt (PR 281) | P24 |
| G3 | Ereignisse mit Nachspiel | erledigt (PR 299) | P24 |
| G4 | Winter als Planungsbild (Bilanz, Winterarbeiten, Verträge) | erledigt (PR 245) | P20 |
| G5 | Jahreszeiten spürbar (Frühling ruhig, Sommer voll, Herbst Wind) | erledigt (P20-Rest): Ankünfte Frühling 0,8, Sommer 1,2 mit mehr kleinen Booten, Herbst 0,9 mit mehr Fahrtenseglern und mehr Wind; Banner beim Wechsel ([winter.md](winter.md#jahreszeiten-g5)) | P20 |
| G6 | Ergebnis eines Ereignisses am Abend zeigen | erledigt (PR 281) | P24 |
| G7 | Ereignisse an Bauten binden (Räucherei, Museumshafen, Strand) | erledigt (PR 299) | P24 |
| G8 | Eine Zahlenliste für Ereignisse | erledigt | P06 |
| G9 | Seltene große Tage, z. B. Hanse-Woche, zehn Tage vorher angekündigt | erledigt (PR 299): Hanse-Woche ab Stufe 5; seit der kürzeren Saison (PR 331) 5 Tage vorher angekündigt | P24 |

### H Dauerlieger, Stammgäste und Tagestörn

| Kürzel | Punkt | Status | Paket |
|---|---|---|---|
| H1 | Pacht nach Bootsgröße (= Ü1) | erledigt (PR 149) | P01 |
| H2 | Saisonvertrag im Voraus | erledigt (PR 149) | P01 |
| H3 | Bewerber statt Verwandlung: Stammgäste und Einheimische fragen an | erledigt (PR 149) | P01 |
| H4 | Obergrenze ein Viertel der Plätze | erledigt (PR 149) | P01 |
| H5 | Dauerlieger nutzen Kran, Winterlager, Segelmacher; im Winter an Land | erledigt (PR 245 und P20-Rest): im Winter im Winterlager (zahlen dort je Tag), Krantage an Mastenkran und Travellift, Segelmacher-Aufträge in der Saison | P20 |
| H6 | Lieblingsplatz eines Stammgasts | erledigt (P25): Box des letzten zufriedenen Besuchs, Stander über der Box | P25 |
| H7 | Sichtbare Treue: Wimpel je fünf Besuche | erledigt (P25): Doppelstander am Heck | P25 |
| H8 | Stammgäste wachsen mit (Wünsche, größeres Boot) | erledigt (P25) | P25 |
| H9 | Leere Box während eines Tagestörns für einen Tagesgast | offen | P25 |
| H10 | Dauerlieger vor Vertragsende kündigen kostet | erledigt (PR 149) | P01 |

### I Tagesziele, Logbuch, Abschluss und Endlosspiel

| Kürzel | Punkt | Status | Paket |
|---|---|---|---|
| I1 | Ziele verlangen eine Handlung (= Ü14) | erledigt (PR 152) | P13 |
| I2 | Eines aus dreien wählen | erledigt (PR 152) | P13 |
| I3 | Belohnungen mischen (Geld, Anker, seltener Gast, Rabatt, Deko) | erledigt (PR 152) | P13 |
| I4 | Wochenziel | erledigt (PR 152) | P13 |
| I5 | Logbuch als Sammelalbum mit Schattenrissen | erledigt | P21 |
| I6 | Erfolge als Dinge im Hafen (Pokal, Wimpel, Schild) | erledigt (Erfolgsmast, Pokaltreppe, Ehrentafel, docs/erfolge.md) | P22 |
| I7 | Meilensteine mit Ton und Bild | erledigt (Meldung mit Symbol, Ton "erfolg") | P22 |
| I8 | Richtiger Abschluss mit Kamerafahrt und Titel | erledigt (PR 156) | P16 |
| I9 | Endlosspiel mit Saisonzielen | erledigt (PR 156) | P16 |
| I10 | Ziele im Winter (Winterarbeiten) | erledigt (PR 245) | P20 |

### J Einstieg und Hilfe

| Kürzel | Punkt | Status | Paket |
|---|---|---|---|
| J1 | Schritt 1 zeigt auf "3x" statt auf die Sonne | erledigt (PR 112: Willkommen zeigt auf die Boje, Schritt 4 auf 3x) | P03 |
| J2 | Im Einstieg fährt das erste Boot nicht selbst ein | erledigt (PR 112, `holdBoat` bis zum ersten Anlegen; Kamera fährt zum Boot, wenn es außerhalb liegt) | P03 |
| J3 | Münze gleich nach dem Anlegen erklären, auch den halben Preis | erledigt (PR 112, Anteil aus den Regeln) | P03 |
| J4 | Erstes Bauen führen, Geld fürs WC geschenkt (= Ü15) | erledigt (PR 237) | P17, P03 |
| J5 | Ruf am ersten Abreisenden erklären | erledigt (PR 335, P03-Rest, 15.11.: Tipp mit Kreis um den Ruf bei der ersten Bewertung nach dem Einstieg) | P03 (nach P14) |
| J6 | Hinweise beim ersten Mal (kein Platz, Sturm, Winter, Stufenziel, Stammgast) | erledigt (kein Platz zweifach, Stufenziel, Stammgast; Sturm und Winter erklärt schon das Ereignisschild) | P03 |
| J7 | Hilfe-Seite für alle Geräte mit sechs Bildern | erledigt (Menü „Hilfe“, `features/hilfe.js`) | P03 |
| J8 | Einstieg im Menü wiederholen | erledigt (Knopf in der Hilfe) | P03 |

### K Reviere und Nordsee

| Kürzel | Punkt | Status | Paket |
|---|---|---|---|
| K1 | Nordsee nach der Ostsee, Doku entsprechend kennzeichnen | entschieden (Welle 5); Doku gekennzeichnet (PR 177) | P08, P57 |
| K2 | Gezeiten als Kernidee: Tiefgang nur bei Hochwasser | offen | P57 |
| K3 | Kleinster spielbarer Kern: eigene Karte, Pegel, Tiefgang-Fenster, Kutter | offen | P57 |
| K4 | Trockenfallen als Platzart | offen | P57 |
| K5 | Seekarte zum Wechseln, Spielstand und Ruf je Hafen | offen | P57 |
| K6 | Freischalten an einer Stelle festlegen | offen | P57 |
| K7 | Nordsee-Stimmung bis dahin als Farbthema im Kreativ- oder Fotomodus | offen | P45 |

### L Hafenleben, Ton und Fotomodus

| Kürzel | Punkt | Status | Paket |
|---|---|---|---|
| L1 | Ton für Bewertung, Tagesziel, Stammgast, neues Modell, Stufenziel | offen | P46 |
| L2 | Figuren als Anzeige (Schlange vor der Dusche, volle Tische) | erledigt (P55, Schlange vor WC, Dusche, Kiosk und Restaurant, wenn knapp oder voll; `render/people.js`) | P55 |
| L3 | Hafenhorn: langes Drücken aufs Hafenbüro kassiert alles | erledigt | P26 |
| L4 | Fernglas mit Steckbrief | erledigt | P26 |
| L5 | Möwen antippen, Glocke am Steg | erledigt (Glocke steht am Hafenmeisterhaus) | P26 |
| L6 | Fotoaufträge und Postkarte (= F22) | offen | P43 |

### M Zahlen und Daten

| Kürzel | Punkt | Status | Paket |
|---|---|---|---|
| M1 | Eine führende Zahlendatei | erledigt | P06 |
| M2 | Ersatzregeln abschaffen; prüfen, ob ein neues Spiel heute mit den Ersatzregeln startet | erledigt | P06 |
| M3 | Tote Daten anschließen (Wünsche je Art) oder löschen (Bauzeiten, Sonderboote, zweite Ereignisliste) | erledigt: Sonderboote, Antriebsanteile je Klasse und zweite Ereignisliste gelöscht, Bauzeiten sind die Bauabschnitte (P18), Wünsche je Art angeschlossen (P19) | P06, P19 |
| M3b | Gruppen-Ankunft (Feld `group` in den Bootsdaten) anschließen | erledigt (P32: Flottillen lesen `group`) | P32 |
| M4 | Zahlenübersicht aus den Daten erzeugen | erledigt | P06 |
| M5 | Prüfwerkzeug: ungelesene Felder, Ja/Nein statt Zahl, Stufe billiger als davor | erledigt | P06 |
| M6 | Eine Sprache für Feldnamen | teils erledigt: Regel in `docs/balancing.md` (Daten deutsch, `sim.js` englisch, Übersetzung nur in `data/rules.js`) | P06 (schrittweise) |
| M7 | Ein gemeinsamer Zufall mit Startwert für alle Module | erledigt | P06 |

### N Speichern und Web-App

| Kürzel | Punkt | Status | Paket |
|---|---|---|---|
| N1 bis N12 | Speicherplätze, Seite "Spielstände", Aktionen je Platz, Wechseln ohne Verlust, Papierkorb, Umzug des alten Stands, Start mit "Weiter", Kopie, Vorschaubild, Gesamt-Export, ehrliche Grenzen, Neues Spiel mit Auswahl | erledigt | P09 |
| N13 | Nach jedem Kauf und Stufenaufstieg sichern | erledigt | P09 |
| N14 | Rückfall-Speicherweg entfernen | erledigt | P09 |
| N15 | 3D-Bibliothek mitliefern statt von fremdem Server | erledigt (PR 270, `web/vendor/three-0.187.0/`, `tools/three-holen.sh`) | P61 |
| N16 | Alle Spieldateien vorab für offline speichern | erledigt (PR 270, `offline-liste.json` beim Deploy, Service Worker lädt vorab) | P61 |

### O Tests und Werkzeuge

| Kürzel | Punkt | Status | Paket |
|---|---|---|---|
| O1 | Gemeinsamer Aufbau für Regeltests (= Ü6) | erledigt | P06 |
| O2 | Ein Test je Fehler, vor der Reparatur | offen | jedes Fehler-Paket (P01 bis P05) |
| O3 | Ein ganzer Spieltag als Test mit festem Startwert | erledigt | P06 |
| O4 | Stufenwechsel als Test | erledigt (PR 143 und Test "voller Hafen über alle Stufen" in `tests/economy-sim.test.mjs`) | P05 |
| O5 | Dritter Spielertyp im Balancing (tut nichts) | erledigt | P06 |
| O6 | Balancing meldet Leerlauf je Stufe | erledigt | P06 |
| O7 | Test: jedes Hinweis-Ziel existiert, keine Texte zu Gelöschtem | erledigt (`tests/specs/einstieg.spec.mjs`) | P03 |
| O8 | Doku-Zahlen aus den Daten prüfen | erledigt | P06 |
| (Befund) | Prüfskript der Reviere läuft nicht im normalen Testlauf | offen | P57 |

### P Bedienung (hier "Bed")

| Kürzel | Punkt | Status | Paket |
|---|---|---|---|
| Bed P1 | Die fünf fehlenden Anzeigen (A4, B1, B2, B11, C1) | B11, B2, A4 und B1 erledigt (P55), C1 siehe P14 | P55, P11, P14 |
| Bed P2 | Bootskarte mit "zahlt etwa 33 € pro Nacht" und Zahl der Wunschplätze | erledigt (PR 153) | P10 |
| Bed P3 | Zeiger am Bildrand für wartende Boote | erledigt (PR 269: Zeiger mit Geduldsring, gebündelt, Antippen fährt hin) | P55 |
| Bed P4 | Tempo, das mitdenkt: zurück auf 1x bei Sonderfall oder Ereignis, Knopf "bis zum nächsten Boot" | geändert auf Jorvens Wunsch (14.11.): Tempo läuft durch, keine automatische Bremsung mehr | P07 |
| Bed P5 | Einstellungen-Seite (Ton und Musik getrennt, Selbst-Einfahren, Bewegung, Schrift, Linkshänder) | erledigt (Ton und Musik über Knopf ins Ton-Fenster mit getrennten Reglern) | P50 |
| Bed P6 | Farbe nie allein: Form zu Grün-Rot und Gold | erledigt mit Einstellung "Schilder mit Form" (Balken, Stern, Ausrufezeichen) | P50 |
| Bed P7 | Letzten Kauf zehn Sekunden lang zurücknehmen | erledigt (PR 232) | P18 |
| Bed P8 | PC-Tasten für Kassieren und drei Tempostufen, Hilfe zeigt genau die echten Tasten | erledigt (K, F, G, Leertaste; Hilfe angepasst) | P07 |
| Bed P9 | Stil im Plan festhalten; Rolle der Pixel-Fassung klären | Frage 9; Ist-Stand im Plan festgehalten (PR 177), Entscheidung offen | P08 |
| Bed P10 | Zeichen am Rand für "hier ist etwas zu tun" | erledigt für wartende Boote (P55); Münzen und Dauerlieger bewusst ohne Randzeichen | P55 |

### Q Doku

| Kürzel | Punkt | Status | Paket |
|---|---|---|---|
| Q1 | README als Startseite mit Stand | erledigt (PR 177) | P08 |
| Q2 | Plan dreiteilen: Gebaut, Als Nächstes, Nach 1.0 | erledigt (PR 177) | P08 |
| Q3 | Statuszeile in jedem Dokument | erledigt (PR 177) | P08 |
| Q4 | Zahlentabellen aus den Daten (M4) | erledigt | P06 |
| Q5 | Ist-Tabelle der Abnahme neu | erledigt (PR 177) | P08 |
| Q6 | Erledigtes in echter-hafen.md abhaken | erledigt (PR 177) | P08 |
| Q7 | Geräte-Dokumente in oberflaeche.md zusammenlegen | erledigt (PR 177) | P08 |
| Q8 | Ein Dokument für Testmodus und Adresszusätze | erledigt (PR 177) | P08 |
| Q9 | Änderungsprotokoll für Spieler | erledigt (PR 177) | P08 |
| Q10 | Entscheidungsliste pflegen (Tretboote, Tempo, Stil) | Tretboote und Tempo erledigt (PR 144), weitere Entscheidungen nachgetragen (PR 177), Stil offen (Frage 9) | P08 |

---

## 14. Gelände und Bootswege (Welle 0)

Jorven (12.11.2026, Spieltest am Gaming-PC): Das Gelände wird komplett überarbeitet, bevor irgendetwas anderes weitergeht. Fünf Threads arbeiten gleichzeitig und stimmen sich ab. Erst die Grundprobleme, dann die Extras.

### Funde aus Jorvens Spieltest

| Nr | Fund | Schon in der Roadmap? | Art | Paket |
|---|---|---|---|---|
| T1 | Jedes Wetter außer dem Standard ruckelt stark, auch am Gaming-PC | nein | Grundproblem | P65 |
| T2 | Boote fahren durch Stege | nein (P54 nennt nur Bojenlieger) | Grundproblem | P66 |
| T3 | Boote fahren am Anfang durch den Strand | nein | Grundproblem | P66, P62 |
| T4 | Boote kollidieren, bleiben ineinander stecken und zittern | ja, P54 (nur beim Ausfahren); jetzt allgemein | Grundproblem | P66 |
| T5 | Wasserspur (Heckwelle) nur auf der rechten Seite | nein | Grundproblem | P65 |
| T6 | Marinebasis hat auf einer Seite keinen Eingang | nein | Grundproblem | P63 |
| T7 | Marinebasis ist falsch platziert | nein | Grundproblem | P63 |
| T8 | Boote machen im Gelände fest (Liegeplatz oder Ankerplatz an Land) | nein | Grundproblem | P66, P62 |
| T9 | Ankünfte kommen in Wellen statt einzeln aus zufälligen Richtungen | teils: PR 81 würfelt nur die Vorbeifahrer; Regeln erledigt (Mindestabstand, breiteres Fenster, `herkunft` in `boot-kommt`), Ansicht offen | Grundproblem | P66 |
| T10 | Engpass durch die Dünen ist viel zu eng und unschön | nein | Grundproblem | P62 |
| T11 | Zu wenig Abwechslung im Gelände | nein | Extra (nach T1 bis T10) | P64 |
| T12 | Komische Effekte (Flackern, Artefakte) | nein | Grundproblem | P65 |
| T13 | Bauplätze und Anlagen müssen zum neuen Gelände passen (Stegbilder, Services, Großschiffpier) | nein | Grundproblem | P63 |

### Pakete der Welle 0

| Paket | Titel (Thread) | Inhalt | Dateien | Thread |
|---|---|---|---|---|
| P62 | Geländeform und Engpass neu bauen | T10, Form von Ufer, Strand und Dünen so, dass Wasser und Land klar getrennt sind (T3, T8 von der Geländeseite), Durchstich breit genug für Gegenverkehr; liefert die Wasserfläche als Daten für P66 | `web/js/render/landscape.js`, `web/js/render/landschaft/*.js`, `web/js/data/harbor.js` (nur Wasserkanten) | erledigt (PR 246, 262, 271, 300): zehn Küstentypen aus Seed, jede Küste mit Seeweg, geschlossene Bodden mit Seegatt, Zonen und Seezugänge für die Wegsuche (PR 262); fünf weitere Küsten 11 bis 15 nach echten Karten (PR 300), ein neues Spiel würfelt aus 15 |
| P63 | Marinebasis und Anlagen neu platzieren | T6, T7, T13: Marinebasis mit Zufahrt von See, Großschiffpier, Services und Bauplätze passend zum neuen Gelände, jede Anlage von Wasser oder Land erreichbar | `web/js/render/services.js`, `web/js/data/services.js`, `web/js/data/harbor.js` | erledigt (PR 167, 172): eigene Piers mit freien Wegen in jedem Stegbild |
| P64 | Gelände abwechslungsreicher gestalten | T11: Wald, Wiesen, Schilf, Felsen, Höhen, Dorfrand, je nach Stufe und Stegbild; erst nach P62-Grundform | `web/js/render/landschaft/*.js` | erledigt (PR 204, 211, 216): Umgebung und Ufer je Küstentyp |
| P65 | Wetter und Effekte flüssig machen | T1, T5, T12: Wetter (Regen, Nebel, Sturm, Schnee) ohne Ruckeln, Heckwelle auf beiden Seiten, Effekte ohne Artefakte; Messung je Wetter mit `feature-tests/leistung.cjs` | `web/js/render/landschaft/wasser.js`, Wetter- und Effektmodule, `web/js/render/boat-anim.js` (nur Heckwelle) | erledigt (PR 169): Wetter flüssig, Heckwelle auf beiden Seiten |
| P66 | Boote ums Gelände herum führen | T2, T3, T4, T8, T9 und P54: Bootswege nur über Wasser, um Stege und Land herum, kein Steckenbleiben und Zittern, Ankünfte einzeln und aus zufälligen Richtungen der offenen See, Engpass-Regel; Ausgangspunkt ist der Patch "hafenmeister-engpass-fix" (`boat-channel.js`, `boat-routes.js`, Tests `boot-engpass`, `boot-routen`) | `web/js/render/boat-view.js`, `boat-anim.js`, neue `boat-channel.js`, `boat-routes.js`, `web/js/world/fahrwege.js`, `tests/` | erledigt (PR 180, 181, 199, 228, 240, 254, 256, 258, 262, 280, 327, 332, 351, 372, 375, 378, 381): Ausweichen über freies Wasser, Fahrwasserkarte; Abendstau, Pulk am Eingang und Ablegetakt (PR 228); Vorrang für Auslaufende (PR 240); Wartebojen seitlich, Anfahrt von weit draußen aus verschiedenen Richtungen (PR 280); Geduld erst ab sichtbarer Boje, Box frei bei Abreise unterwegs, Ankerfeld seltener im Rückfall (PR 327); erstes Boot vom Bildrand (PR 332); Anfahrt kürzer, Boote sichtbar an der Boje, Einfahrt als Einbahn gegen den Pulk (PR 351); Vorbeifahrer sperren die Einfahrt nicht mehr dauerhaft, Winter-Sprung ohne Geisterboote (PR 372); Boote einigen sich bei Begegnungen und weichen früher aus (PR 375); Wartende halten sich rechts, eine Schlange vor der nächsten Engstelle gilt nicht mehr als Blockade (PR 378); Paddler am Ufer nur im Wasser (PR 381); Roadmap auf erledigt (PR 384). Messwert Küste 14 nach PR 378: 42 bis 90 feste Paare statt 182 bis 377. Übernimmt P54. Reste als Prio B ausgelagert, eigenes kleines Paket nach der Abnahme (Arbeitsplan Abschnitt 2): Offene Bucht Stufe 5 und 6 mit 19 bis 61 festen Paaren vor der Einfahrt in 12 Minuten Zeitraffer; neue Mole beim Wechsel auf Stufe 5 eine Probe lang unter fahrenden Booten; Vorbeifahrer im engen Fahrwasser gelegentlich dicht an Großschiffen (zwei Versuche gemessen und verworfen). Die Abnahme-Serie über alle 15 Küsten läuft. |

Abstimmung: P62 legt zuerst die Wasserfläche fest; P63 und P66 bauen darauf. P65 misst die Leistung nach jeder Geländeänderung neu. Welle 0 ist fertig, wenn alle Pakete der Welle (P62 bis P66 und P84) auf `main` sind und die Zeitraffer-Serie über alle 15 Küstentypen auf allen Stufen kein Boot dauerhaft über Land oder durch Stege und keine Boote länger als ein paar Sekunden ineinander fest zeigt (Ablauf in [arbeitsplan.md](arbeitsplan.md), Abschnitt 3a).

**Stand Welle 0 (21.11.2026):** P62 bis P66 und P84 erledigt. P66 abgeschlossen mit PR 372, 375, 378 und 381 (Pulk beim Ablegen weg, Boote einigen sich bei Begegnungen); bekannter Rest Offene Bucht siehe P66. Die Abnahme-Serie über 15 Küsten läuft (Thread "Ganzes Spiel im Zeitraffer durchtesten"). Gemeldet wird das Ende vom Planungs-Thread an den Koordinator.

### Berührungspunkte zwischen Paketen

Jeder Thread trägt hier ein, wo sein Paket mit anderen kollidieren kann (siehe "Selbstprüfung" oben).

| Paket | Berührt | Was passieren kann | Geprüft in PR |
|---|---|---|---|
| P62 | P63, P66, Stegbilder | Neue Uferlinie schneidet Stege, Bauplätze oder Bootswege | |
| P63 | P66, P04, P62, Stegbilder, Vorbeifahrer | Anlage ohne Zufahrt, Großschiffe kommen nicht an den Pier; Kreuzfahrtschiff braucht Liegewanne bis y 520; Stegköpfe nördlich y 160 sperren die Barkasse; Bahnen im Westen kreuzen Großschiffe. Alles in `tests/besuchswege.test.mjs` und `tests/verkehr.test.mjs` | P63-PR |
| P84 | P66, P63 (Pier, Liegewannen), Gelände (neue Küsten), Vorbeifahrer | Neue Küste oder Insel vor der Pier: ein Großschiff findet keinen Weg ohne Uferberührung; geänderte Pier oder Liegeplatz P01, MA01, MA02: Ablegelinie läuft in Land. Prüfen mit `node tools/grossschiffe/pruefen.cjs` (alle Küsten) und `tests/specs/grossschiffe.spec.mjs` | P84-PR |
| P66 | Stegbilder (12 Varianten), XXL und Vorbeifahrer (PR 81), P27 Päckchen, P33 Umlegen, Kurzhalter (PR 319) | Bootsweg durch eine Variante, Großschiff blockiert die Einfahrt; Päckchen sperrt den Anfahrweg eines Platzes (Grund `paeckchen`, PR 330); viele Kurzhalter legen gleichzeitig ab und bilden einen Pulk | PR 280, 327, 330 |

---

## 15. Technische Befunde aus dem Audit (12.11.2026)

Ein Audit von außerhalb (`AUDIT-ISTSTAND.md`, ZIP-Stand mit PR 143) hat die Roadmap bestätigt und Ergänzungen vorgeschlagen. Am Stand `937ca3c` nachgeprüft: Alle Befunde gelten noch. Sie gehören zu den Grundproblemen (nach Welle 0), außer C08.

| Nr | Befund | Am Stand geprüft | Paket |
|---|---|---|---|
| C01 | Dauerlieger-Gebühr übernimmt die Fischerpacht (= Ü1) | ja, `sim.js:1395`; behoben in PR 149 | P01 |
| C02 | Alter Speicherweg `hafenmeister.save` neben dem neuen; alter Weg nur noch für eine einmalige, getestete Übernahme lesen, dann Schreibpfad entfernen (= N14) | ja, `state.js:7` | P09 (erledigt) |
| C03 | Spielstand-Import prüft verschachtelte Daten kaum: ein Schema für den ganzen Spielstand, IDs gegen Boots- und Platzdaten, Zahlen begrenzen, unbekannte Felder kontrolliert behandeln, erst nach vollständiger Prüfung übernehmen, Tests mit falschen Typen und Extremwerten | ja, `state.js` `validate` | P09 (erledigt: `state.js` prüft Typen, Grenzen und Verweise; Import erst nach Prüfung aller Häfen) |
| C04 | Abnahmekriterium für P06: neue Spielstände, alle Regeltests und das Balancing nutzen dieselbe Regelkonfiguration | ja, `data/rules.js` besteht | P06 |
| C05 | HTML per `innerHTML` (`render/services.js`, `ui/input-pc.js`): heute nur interne Texte; sobald Boots-, Hafen- oder importierte Namen hineinkommen, `textContent` oder Escapen, dazu Test mit präparierten Namen | ja | P08 (Sicherheit), Pflicht für P44 (Hafenname) und P09 (Import) |
| C06 | Three.js kommt von jsDelivr, Erststart hängt am CDN (= N15, N16) | erledigt (PR 270) | P61 |
| C07 | GitHub Actions: Rechte je Job statt für den ganzen Workflow (`pages.yml` gibt `pages: write` und `id-token: write` auch dem Build), Actions auf Commit-SHAs pinnen, Dependabot prüfen | erledigt (P08-Rest, 14.11.): `permissions: {}` je Workflow, Rechte je Job, alle Actions auf SHAs, Dependabot für Actions, Regeln in [sicherheit.md](sicherheit.md) | P08 |
| C08 | Kein Supabase-Code vorhanden; vor dem Online-Start eigenes Sicherheitsreview (RLS je Tabelle, Rechte anonymer Nutzer, Rate Limits, serverseitige Prüfung) | ja | P58 |

Weitere Ergänzungen aus Abschnitt 6 des Audits, alle P08 (Release-Vorbereitung): Secret-Scan in CI (erledigt 14.11., `secret-scan.yml` mit gitleaks), CSP und Sicherheits-Header der veröffentlichten Seite prüfen, Browser-Tests in CI als Pflicht vor jedem Release nachweisen, `SECURITY.md` mit Meldeweg, sobald das Spiel öffentlich genutzt wird.

## 16. Neu seit dem Überblick

Nicht aus Jorvens Review, sondern aus späteren Aufträgen und Spieltests. Alles hier ist auf `main` und im Spiel (Stand `c0d1d93`), Reste stehen als Paket in der Tabelle "Pakete aus den Funden vom 15.11.2026".

| Was | Auftrag | Im Spiel | Rest |
|---|---|---|---|
| Längere Tage (5 statt 2 Minuten), Kurzhalter, 65 Bootsgeschichten, Regatta mit Bahn draußen | Jorven 14.11. | PR 312 (Plan), 319, 332 (Kurzhalter legen erst nach sichtbarem Festmachen ab, nach "spätestens" keine Einfahrt), [bootsgeschichten.md](bootsgeschichten.md) | P86 |
| Neuer Takt: Saison 16 plus 2 Wintertage, Bauen etwa halb so teuer, rund 100 Spieltage bis zum Abschluss der Ostsee | Folge der langen Tage | PR 331, [balancing.md](balancing.md), [zahlen.md](zahlen.md) | - |
| Hafen wächst sichtbar je Stufe (Gebäude, Dorf, Häuserzeile) | Jorven 14.11. | PR 303, [wachstum.md](wachstum.md) | - |
| Menschen laufen auf dem echten Gelände jeder Küste | Fund Gelände-Thread | PR 316, [menschen-wege.md](menschen-wege.md) | - |
| Liegeplätze passgenau (Boote frei von Steg, Kai, Land und Nachbarn), Großschiffe folgen tiefem Wasser | Härtetest 15.11. | PR 329, [liegeplaetze.md](liegeplaetze.md), Prüfung `node tools/liegeplaetze/pruefen.mjs` | P83, P84 |
| Fünf Küsten nach echten Karten (11 Marstrand, 12 Punat, 13 Shilshole Bay, 14 Kotor, 15 Porto Cervo) | Gelände-Thread | PR 300, [landschaft.md](landschaft.md) | P87 (Tests auf 15 Küsten) |
| Ruhige Oberfläche mit einem Meldeplatz, Pixelschrift für Zahlen | Jorven 14.11. | PR 282, [meldungen.md](meldungen.md) | - |
| Tagesende nur als Zettel, Bootskarte am Tablet hochkant | Feature-Test | PR 320, [tagesabschluss.md](tagesabschluss.md) | - |
| Logbuch: alle neun Großschiffe erreichbar, Fischkutter wechseln | Zeitraffer-Fund | PR 305, 323, [logbuch.md](logbuch.md) | - |
| Härtetest in Extremlagen (16 Lagen, PC und Handy) | Prüf-Thread | PR 324, [extremtest.md](extremtest.md) | P87 |
| Schichttest über die echte Oberfläche, Zeitraffer, Feature-Einzeltest | Jorven 12.11. | PR 251, 301, 309, 313, [schichttest.md](schichttest.md), [zeitraffer.md](zeitraffer.md) | P85 |

---

## Pakete und Reihenfolge

Je Paket ein Thread. "bestehend" heißt: der genannte laufende Thread übernimmt es, weil er die Dateien besitzt. Höchstens etwa 20 Threads arbeiten gleichzeitig; die Wellen geben die Reihenfolge. Eine Welle muss nicht ganz fertig sein, bevor die nächste startet; ein Paket der nächsten Welle startet, sobald ein Platz frei wird.

Viele Pakete ändern `web/js/sim.js`. Regel: kleine, getrennte Änderungen, vor dem Merge auf aktuellen `main` rebasen, neue Regeln mit eigenem Test in `tests/`.

### Welle 1: Fehler und Fundament (Grundprobleme, nach Welle 0)

| Paket | Titel (Thread) | Inhalt | Dateien | Thread |
|---|---|---|---|---|
| P01 | Dauerlieger zur echten Entscheidung machen | Ü1, Ü20, Doku Dauerlieger, Gast wird umgelegt (plan 9a) | `sim.js`, `features/dauerlieger.js`, `economy.js`, `tests/dauerlieger.test.mjs`, `docs/neue-features.md`, `docs/spielregeln.md` | erledigt (PR 149, 226) |
| P02 | Hafenbüro mit eigenen Aufgaben ausbauen | Ü2, Ü11, A2, E1 bis E7, erledigt (PR 146) | `ui/hud.js`, `sim.js` (Automatik), `economy.js`, `ui/bauen.js` (Texte) | erledigt (PR 146) |
| P03 | Einstieg an neue Oberfläche anpassen | Ü3, Teil von Ü12 (Hälfte beim Rundgang erklären), `docs/einstieg.md` | `features/einstieg.js`, `docs/einstieg.md` | bestehend: "Einstieg für neue Spieler bauen"; PR 112 erledigt Ü3, J1 bis J3, Anteil beim Rundgang, Doku; J6 bis J8 und O7 erledigt; Tipps neben der linken Spalte und nacheinander (PR 225); J4 mit P17 erledigt (PR 237); J5 erledigt (PR 335, 15.11.): P03 fertig |
| P04 | Abschlussziel Stufe 6 richtig zählen | Ü4 | `bridge.js`, `render/services.js`, `docs/services.md` | erledigt (PR 139): ein Zähler `state.bigVisits`, Liste `GROSSSCHIFF_BESUCHE` in `data/services.js` (Vorarbeit PR 113) |
| P05 | Boote auf wegfallenden Plätzen regeln | Ü5 | `sim.js` (Stufenausbau), `tests/` | erledigt (Ü5: `advanceStage`, Hook `stageUp`, Test in `tests/dauerlieger.test.mjs`); bestehend: "Spielregeln ohne Grafik umsetzen" |
| P06 | Eine Quelle für alle Zahlen und echte Regeltests (erledigt) | Ü6, Ü24 | `economy.js`, `data/rules.js`, `data/services.js`, `services/rules.js`, `data/events.js`, `tests/regeln.mjs` (statt `tests/helpers.mjs`, das ist der Browser-Helfer), alle Regeltests, `tools/zahlen.mjs`, `docs/zahlen.md`, `docs/balancing.md` | bestehend: "Balancing für 94 Liegeplätze ausarbeiten" |
| P07 | Tempo einheitlich regeln | Ü7, Hilfetexte, `docs/schiffsanimationen.md` | `ui/oberflaeche.js`, `ui/input-pc.js`, `ui/input-touch.js`, `ui/gesten.js`, `plan.md` 14 | erledigt (Ü7, Tempo bleibt mit PR 257, läuft ohne automatische Bremsung seit PR 278); bestehend: "Gesamte Oberfläche neu überarbeiten" |
| P08 | Doku auf den Stand bringen | Abschnitte 9 und 10, Liste aller Adresszusätze, `plan.md` Meilensteine und Pixel-Oberfläche | `README.md`, `docs/*.md` (außer den Paket-eigenen) | erledigt (PR 177); bestehend: "Bestandsaufnahme Repo und Plan erstellen" |
| P54 | Ausfahrende Boote weichen wartenden Booten aus (aufgegangen in P66) | Neuer Fehler (Jorven, 12.11.2026): Beim Rausfahren kollidieren Boote mit Booten an der Warteboje und zittern beide, als wollten sie aneinander vorbei. Ausweichen ohne Berührung und ohne Zittern, an Handy und PC prüfen | `render/boat-anim.js`, `render/boat-view.js`, `world/fahrwege.js` | bestehend: "Schiffsanimationen umsetzen" |
| P09 | Speicherplätze und Neues Spiel | Ü25, F26, F27 (Grundgerüst), F28, `docs/speichern.md` | `save/*.js`, `state.js`, `save/save-panel.js` | erledigt (PR 150) |

### Welle 2: Kernschleife und Rückmeldung (nach den Grundproblemen)

| Paket | Titel (Thread) | Inhalt | Dateien | Thread |
|---|---|---|---|---|
| P10 | Zuweisen wieder zur Entscheidung machen | Ü8, Ü9, Ü13 | `sim.js` (Selbst-Einfahren, `dismiss`, `turnAway`), `render/boat-view.js`, `features/platzschilder.js` | erledigt (PR 153; Ü8 kam mit PR 147) |
| P11 | Wünsche über dem Boot und Ankunftsvorschau | Ü10 | neues Modul `web/js/ui/vorschau.js` (`boat-view.js` blieb unverändert) | erledigt (PR 158, 227, 231) |
| P12 | Kassieren verständlich machen | Ü12 (Rundgang ab Abend, halbe Münze sichtbar), B3, B4, B5 (Trinkgeld), B6. Stand: erledigt (PR 151) | `data/people.js`, `render/people.js`, `render/boat-view.js`, `sim.js`, `bridge.js`, `ui/gesten.js`, `economy.js`, `tests/kassieren.test.mjs`, `docs/spielregeln.md` | erledigt (PR 151) |
| P13 | Tagesziele an eigene Handlungen binden | Ü14, I1 bis I4 | `features/tagesziele.js`, `features/ziel-deko.js`, `sim.js` (Ereignisse mit "von Hand"), `economy.js` (`tagesziele`) | erledigt (PR 152) |
| P14 | Bewertungen und Gästebuch zeigen | Ü21, F18, C1, C9; Note aus Wünschen 2,5 bis 5 (Befund P10) | `ui/gaestebuch.js`, `ui/gaestebuch-daten.js`, `css/gaestebuch.css`, `sim.js` (`ratingParts`), `docs/gaestebuch.md` (boat-view.js unverändert) | erledigt (PR 154, 233) |
| P15 | Tagesabschluss am Abend zeigen | Ü22 | neues Modul `web/js/ui/tagesabschluss.js`, `sim.js` (`sim:dayEnd`) | erledigt (PR 159, 239) |
| P16 | Aufstieg und Abschluss feiern, Endlosspiel | Ü23, Endlosmodus | `features/aufstieg.js` (Kamerafahrt über die öffentlichen Felder des Rigs, kein Eingriff in `core/camera.js`), `css/aufstieg.css`, `economy.js` (`endlos`), Andockstelle in `ui/oberflaeche.js` | erledigt (PR 156) |
| P17 | Start und frühe Stufen straffen | Ü15, Ü16, Startwerte dokumentieren | `economy.js`, `state.js`, `docs/balancing.md` | erledigt (PR 318 und Teil 2, PR 331: neuer Tagesablauf, rund 100 Spieltage, Rechnung und Zeitraffer 2,7 % auseinander; `docs/balancing.md`) |
| P18 | Ausbau in Bauabschnitten | Ü18, `bautage` nutzen oder löschen | `ui/bauen.js`, `economy.js`, `sim.js`, Stegdarstellung | bestehend: "Bauen mit Vorschau und Tiefe ausbauen"; Bauabschnitte, Baustelle über Nacht und Sparziel (PR 232), Nachbesserungen (PR 235) |
| P19 | Ruf schwerer machen mit Wünschen je Bootsart | Ü17, `feeFactor`, `arrivalWeight`, Kapazität sichtbar | `sim.js`, `data/boats/*.js`, `economy.js` | erledigt: Teil 1 (PR 244: B7, C2, C3, C4, C6, F8), Teil 2 (PR 279: C5, B9, "heute voll"), [ruf.md](ruf.md) |
| P20 | Winter mit Inhalt füllen | Ü19, F14, F15, `docs/ereignisse.md` | `sim.js` (Jahreslauf), neues Feature-Modul, Travellift/Winterlager in `render/services.js` | bestehend: "Bauen mit Vorschau und Tiefe ausbauen"; Winterpause, Winterarbeiten, Winter überspringen (PR 245, 249, `docs/winter.md`); Krantage (F15, Teil von H5) im selben PR; erledigt mit P20-Rest (PR 347): G5 Jahreszeiten, H5 Dauerlieger als Kunden ([winter.md](winter.md)) |
| P21 | Logbuch und Hafenchronik zeigen | Logbuch (Note 1), F36, `sim:logbookNew` | neues Modul `web/js/ui/logbuch.js`, `state.js` | erledigt (PR 274, docs/logbuch.md, SAVE_VERSION 3; Großschiffe und Fischkutter im Logbuch PR 305) |
| P22 | Erfolge einbauen | plan.md 9 | neues Feature-Modul | erledigt (PR 295: 30 Erfolge, Reiter im Logbuch, Dinge im Hafen, docs/erfolge.md) |

### Welle 3: Tiefe und Hafenleben (Extras)

| Paket | Titel (Thread) | Inhalt | Thread |
|---|---|---|---|
| P23 | Services mit eigener Wirkung | Services nicht nur "€ pro Tag" | erledigt (PR 340; F2, F3, F5, F7, F9; [services.md](services.md#eigene-wirkung-roadmap-p23)) |
| P24 | Ereignisse zum Vorbereiten und neue Ereignisse | Vorwarnung mit Handlungsmöglichkeit, F17 | erledigt (PR 281: Sturm sturmklar machen, Regatta-Plätze freihalten, Ergebnis am Abend; PR 299: Heringstage, Mittsommer, Holzboot-Treffen, Hanse-Woche, Nachspiel, Services an Ereignistagen; Regatta mit Bahn draußen PR 319), [ereignisse.md](ereignisse.md) |
| P25 | Stammgäste mit Wirkung und Gästepost | Ruf am alten Platz (plan 9a), F37 | teilweise: Teil 1 und 2 gebaut (PR 394, [stammgaeste.md](stammgaeste.md)), H9 folgt |
| P26 | Überraschende Gesten fertig bauen | Hafenhorn gedrückt halten, Fernglas mit Steckbrief, Möwen, Wellenring, Glocke (plan 8), `audio/README.md` | erledigt (PR 322, docs/hafengesten.md) |
| P27 | Päckchen liegen bei vollem Hafen | F1 | erledigt (PR 330, [paeckchen.md](paeckchen.md)) |
| P28 | Anmeldung per Funk | F2 (nutzt P11) | erledigt (PR 288, `docs/funk-anmeldung.md`) |
| P29 | Baggern für tiefere Liegeplätze | F7 | erledigt (PR 420, [baggern.md](baggern.md): Steg ausbaggern im Bauen-Menü, Niedrigwasser bei Westwind) |
| P30 | Stege nachrüsten | F8 | erledigt (PR 297, [nachruesten.md](nachruesten.md)) |
| P31 | Neue Gästewünsche | F9, B8 | erledigt ([gaestewuensche.md](gaestewuensche.md): Wasserhähne, WLAN, Waschmaschine, Absaugstation, Hafenrundfahrt) |
| P32 | Flottillen | F3, Gruppen-Ankunft | erledigt (PR 393: Konvoi, gemeinsamer Steg, Funk für die Gruppe, [flottillen.md](flottillen.md); beim Selbst-Einfahren zusammen (PR 414); Rest Prio B: Boxen frei halten, gemeinsam weiterfahren) |
| P33 | Liegende Boote umlegen | F4 | erledigt (PR 314, Ausbau und Dauerplätze nutzen dasselbe Umlegen) |
| P34 | Wind im Hafen spürbar machen | F5, F35 | erledigt (PR 392, [wind.md](wind.md)) |
| P35 | Preisstufe am Hafenbüro | F6 | erledigt (PR 413, [preisstufe.md](preisstufe.md): günstig, normal, gehoben; Faustregel für die Bots, Zeitraffer wieder nahe 105) |
| P36 | Bojenfeld im See | F10 | erledigt (PR 421, [bojenfeld.md](bojenfeld.md)) |
| P37 | Havarist einschleppen | F11 | neu |
| P38 | Eigenes Hafenfest ansetzen | F12 | erledigt (PR 405, [hafenfest.md](hafenfest.md)) |
| P39 | Jugendtraining am Segelclub | F13 | erledigt (PR 412, [jugendtraining.md](jugendtraining.md)) |
| P40 | Seltene Besucher | F16 (nach P21) | erledigt (PR 416, docs/besucher.md) |

### Welle 4: Langzeit, Spielgefühl, Welt (Extras)

| Paket | Titel (Thread) | Inhalt | Thread |
|---|---|---|---|
| P41 | Statistik und Saisonbilanz | F19, F20 | erledigt (PR 315, Thread "Statistik und Saisonbilanz zeigen") |
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

### Welle 5: Regionen und Online (Extras)

| Paket | Titel (Thread) | Inhalt | Thread |
|---|---|---|---|
| P57 | Nordsee mit Gezeiten spielbar machen | Revierfaktoren, Gezeiten, Schleuse, Trockenfallplätze, `docs/regionen.md` | bestehend: "Hafenregionen Ostsee und Nordsee gestalten" |
| P58 | Online mit Supabase | Hafenname, Bestenliste, Gastboote; erst wenn alles lokal fertig ist | neu, zuletzt |

### Welle 6: Ausbau Stufe 7 bis 20 (nach Welle 4 und P57)

Plan: [ausbau-stufe-7-20.md](ausbau-stufe-7-20.md) (13.11.2026). Der Heimathafen wächst bis Ausbaustufe 9, danach übernimmt der Spieler weitere Häfen und baut einen Hafenverbund bis Stufe 20 auf. Nur Planung: Keine dieser Stufen erscheint in Spiel, Einstieg oder Doku für Spieler, bevor ihr Paket gemergt und am Handy und PC spielbar ist. Online (P58) bleibt trotzdem der letzte Schritt.

| Paket | Titel (Thread) | Inhalt | Startet nach | Thread |
|---|---|---|---|---|
| P67 | Stufe-6-Annahmen lösen | `regionDone` an `verbund.abschlussStufe` statt `maxStage`, Grenzen in `vielfalt.js`, Schlüssel 7 bis 9 in `economy.js`, Tests mit Test-Stufe 7; nichts Sichtbares | Welle 2 | neu |
| P68 | Leistung für große Häfen | Detailstufen für liegende Boote, gesammeltes Zeichnen, Leistungsbudget je Szene (Abschnitt 6.6 des Plans) | P67 | neu (mit Kamera-Thread) |
| P69 | Bedienung großer Häfen | Zeiger zu wartenden Booten, Sprung zu Stegen | P55, P67 | neu |
| P70 | Stufe 7 Hafenstadt | Yachthafen Ost (Steg E), Promenade, Belegungsplan je Steg; `harbor.js` Stufe 7, Gelände und Seeds geprüft | P67, P68, P69, P83 | neu |
| P71 | Stufe 8 Fährhafen | Fähranleger, Inselfähre nach Fahrplan | P70, P66 | neu |
| P72 | Stufe 9 Werfthafen | Werft mit Schiffslift, großes Winterlager | P71, P20 | neu |
| P73 | Stufe 10 Hafenverbund und Hafenkarten | `modules.verbund`, `SAVE_VERSION` 4 mit Migration (3 ist seit P21 das Logbuch), Übernahme alter Häfen, Kurzrechnung mit Abgleichstest, Standortwechsel | P72, P09 | neu |
| P74 | Stufe 11 Gästeweitergabe und Törngäste | volle Häfen schicken weiter, Törngäste von Hafen zu Hafen | P73, P32 | neu |
| P75 | Stufe 12 Hafenprofile | Yacht-, Traditions-, Fischerei-, Familienhafen | P73 | neu |
| P76 | Stufe 13 Regattawoche | Regattawoche über den Verbund | P75, P24, P39 | neu |
| P77 | Stufe 14 Nordseehafen | Nordsee-Standort mit Tide aus P57 | P73, P57 | neu |
| P78 | Stufe 15 Offshore-Hafen | Windpark, Crew-Transfer-Katamarane, Serviceschiff | P77 | neu |
| P79 | Stufe 16 Kreuzfahrthafen | zweite Pier, Wechselhafen | P73 | neu |
| P80 | Stufe 17 und 18 Marinehafen und Großseglertreffen | Marinestützpunkt groß, jährliches Großseglertreffen | P79, P75 | neu |
| P81 | Stufe 19 Kanalhafen | Küstentyp 16 Kanal (11 bis 15 sind seit PR 300 echte Küsten), Schleuse, Kanalverkehr | P77, P80 | neu |
| P82 | Stufe 20 Hafenimperium | Abschlussfeier, Endlosspiel über den Verbund, Schlussabgleich `tools/balance.mjs --bis 20` | P81 | neu |

### Zusätzliche Pakete aus den Detailpunkten

| Paket | Titel (Thread) | Inhalt | Welle | Thread |
|---|---|---|---|---|
| P55 | Versteckte Regeln im Hafen sichtbar machen | A4 Geduldsring, B1 Auslastung, C7 Warnung, L2 Figuren als Anzeige, Bed P3 Zeiger am Rand, Bed P10 Zeichen "hier ist etwas zu tun" | 2 | erledigt (PR 269 und 275, `docs/hafenzeichen.md`) |
| P59 | Stege umbauen und Varianten wählen | D5, D6, D9 (neue Gastplätze in Stufe 6) | 3 | erledigt (PR 321 Doppelboxen, PR 326 Yachtsteg, [stege-umbauen.md](stege-umbauen.md)) |
| P60 | Hafen verschönern | D8 | 4 | neu |
| P61 | Spiel komplett offline startbar | N15, N16 | 2 | erledigt (PR 270), Thread "Spiel offline startbar machen" |

P56 bleibt frei.

### Pakete aus den Funden vom 15.11.2026

Lücken, die beim Abgleich der Doku mit dem Code (15.11.2026, `main` bei `c0d1d93`) und in den PRs 324 bis 332 aufgefallen sind. Einzelheiten und Reihenfolge im [Arbeitsplan](arbeitsplan.md).

| Paket | Titel (Thread) | Inhalt | Welle | Thread |
|---|---|---|---|---|
| P83 | Stegbild-Generator reparieren | `tools/stegbilder/erzeugen.mjs` findet seit den Doppelboxen (PR 321) keine Variante mehr ("Steg C passt nicht", Hinweis aus PR 329), `web/js/data/stegbilder.js` lässt sich nicht neu erzeugen. Generator an Doppelboxen, Liegelage (`data/liegelage.js`) und Yachtsteg anpassen, `--pruefen` in den Testlauf aufnehmen; Spiel und Speicherstände behalten ihre 12 Stegbilder | 1 | erledigt (PR 336) |
| P84 | Großschiffwege an allen 15 Küsten | Kreuzfahrtschiff streift im schrägen Seegatt von Küste 4 (Bodden) das Ufer (Rest aus PR 329). Rumpfprobe aus dem Härtetest (7 Punkte) als Test für alle Besuchsschiffe (Kreuzfahrt, Flotte, Windjammer, Seenotkreuzer) auf allen 15 Küsten und mehreren Seeds | 0 | erledigt (PR 341): vorher 34 Berührungen auf 9 von 15 Küsten, jetzt 0 auf 15 Küsten x 5 Seeds (`node tools/grossschiffe/pruefen.cjs`, `tests/specs/grossschiffe.spec.mjs`). Seeweg bis hinter den Außenring auf grobem Raster, Wendeplatz, Rumpf folgt dem Weg ([schiffsanimationen.md](schiffsanimationen.md), Großschiffwege). Der Seenotkreuzer fährt nur im Hafen (kein Seeweg). Teil 2 erledigt (20.11.): Kreuzfahrtschiff und Marine verholen mit Schleppern an einen freien Drehkreis (fremde Liegewannen zählen 20-fach), Raddampfer an K01 kommt von vorn und geht rückwärts an den Kai, legt geradeaus ab; Prüfwerkzeug zählt Stege, Plätze, Wannen und Bojen als Hinweis. Rest: 3 von 45 Läufen streift das Kreuzfahrtschiff die eigene Pier (zu enges Becken) |
| P85 | Zusammenspiel nach Welle 0 prüfen | Jorvens Auftrag vom 14.11.: alle Features weiter vorhanden, neue Features im normalen Spiel wirklich genutzt, Welle 1 wirklich gefixt, Übersehenes finden. Drei Threads (Kernschleife und Regeln; Oberfläche und Geräte; Welt, Boote, Ereignisse), gemeinsame Datei `docs/zusammenspiel.md` | 1 | erledigt: Teil 1 Kernschleife und Regeln erledigt (PR 354, Funde K1 bis K5), Teil 2 Oberfläche und Geräte erledigt (PR 352), beide in `docs/zusammenspiel.md`; Teil 3 Welt: Ausbauten je Küste geprüft (Abschnitt "Ausbauten je Küste", Fund W1 Durchstich nur auf Nehrungsküsten), Stegbilder je Küste, Ereignisse und Bildrate je Wetter geprüft (PR 366 und 373, Fund S1 behoben; Aufstiegsname nach Küste) |
| P86 | Bootsgeschichten fertig erzählen | Regatta: Startsignal mit Ton, Siegerehrung am Segelclub, Ergebnis im Logbuch; Gepäck beim Crewwechsel sichtbar, Halt am Tanksteg, Gang "in den Ort" ([bootsgeschichten.md](bootsgeschichten.md), Abschnitt 5) | 3 | erledigt (PR 342) |
| P87 | Prüfwerkzeuge auf 15 Küsten und den neuen Takt | Härtetest (`tests/extrem/`) nach PR 327 bis 332 neu laufen lassen und den Fund "Gäste erreichen ab Stufe 4 keine Boje" am Spiel bestätigen; `tests/specs/leinen.spec.mjs` auch für Küste 11 bis 15; `istWasser` und Bild am Durchstich angleichen (Messlatte); Zeitraffer-Grenzen auf den 5-Minuten-Tag | 1 | erledigt (PR 338: Tests über alle Küsten aus `formen.js`, `tools/zeitraffer/wasserbild.cjs` und `bildwasser.cjs`, Grenzen für den 5-Minuten-Tag, Härtetest neu gelaufen; Funde in docs/arbeitsplan.md) |
| P88 | Engstellen nach ihrer Länge regeln | Reste aus P66 (Abnahme Welle 0 auf `ae9e34f`, 21.11.): Auslaufende warten vor der Einfahrt gegenseitig auf Vorfahrt (PC Küste 14 126 feste Proben in Stufe 5 und 6, Handy Küste 15 88, Handy Küste 3 83, PC Küste 15 25), im langen Bodden-Seegatt (Küste 4) läuft die Wartegrenze von 120 s ab und Boote stecken Bug an Bug. Konvoigröße und Wartegrenze je Engstelle aus ihrer Länge ableiten, eine feste Wartegrenze für alle verschlechtert andere Küsten (240 s gemessen und verworfen). Der Großschiff-Vortritt ist gestrichen (siehe unten). Messung über alle 15 Küsten, PC und Handy. Teil 1 (22.11.): Der Knoten sitzt an der Hafeneinfahrt, die auf allen Küsten gleich lang ist (32 m, schon Konvoi 6 und 300 s), nicht in einer langen Engstelle; darum getrennte Bahnen für Ein- und Auslaufende in offenem Wasser (bis 24 m Abstand) statt längenabhängiger Werte, gemessen über alle 15 Küsten. Teil 2 (22.11.): Vorbeifahrer und Segler, die ein Hafenboot aufhalten, fahren sofort weiter (Küste 14 Stufe 6: Ankommende stapelten sich in 3 von 8 Läufen draußen auf See, danach in 0 von 4). Teil 3 (22.11.): Auch der Seeweg hat je Richtung eine eigene Bahn; vorher trafen sich An- und Abreisende eines Seezugangs im selben Übergabepunkt am Kartenrand (Küste 15 Stufe 5: fest 16 und 14 statt 116 und 32; Bodden 2 statt 33; Küste 14 Stufe 6: Ankommende ineinander 155 und 460 statt 630 bis 10600). Großschiff-Vortritt gestrichen (Koordinator 22.11.), drei Fassungen gemessen und verworfen: Größenregel Boot gegen Boot (Bodden-Seegatt fest 208 statt 14 bis 38), größerer Abstand der Vorbeifahrer zu fahrenden Großschiffen (Bodden 0 statt 4 nahe Vorbeifahrten, Nehrung 4 statt 1), Vortritt an der Einfahrt (Küste 14 Stufe 6: Großschiffe 86 und 92 lange Proben statt 14 und 6). Abnahme durch die nächste Zeitraffer-Serie | 3 | erledigt (PR 390, 400 und Teil 3) |

### Abgleich mit der Reihenfolge im Überblick

Der Überblick empfiehlt neun Pakete. Die genaue Zuordnung jedes Kürzels steht in Abschnitt 13, hier die grobe:

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

## Entscheidungen Jorvens zur Roadmap (12.11.2026)

1. Jorven hat das vollständige Review nachgereicht; die Detailpunkte stehen in Abschnitt 13.
2. Tempo bleibt, wie es ist: Pause, 1x, 3x, 8x von Anfang an, Taste F am PC. Nur Hilfetexte und Doku werden angeglichen (P07).
3. Paddel- und Tretboote bleiben in Stufe 1 zahlende Gäste.
4. Der Knopf "Alle kassieren" kommt erst mit Hafenbüro Stufe 1 (P02).
5. Selbst-Einfahren nach 8 Sekunden in die nächste oder eine der freien Boxen am Steg, nicht mehr in die knappste. Boote berühren sich dabei nie (P10).
6. Dauerlieger: Jorven überlässt die Regel dem Paket. Festgelegt (P01): Der Spieler bestimmt, welche Boxen Dauerplätze sind, indem er eine freie Box einem Bewerber gibt (Einheimische fragen an, Stammgäste ab dem 5. Besuch auch). Höchstens ein Viertel der Gastboxen. Saisonpacht im Voraus (50 % des Gastpreises je Saisontag), sicher auch bei Sturm, dafür kein Gast, kein Ruf, nichts fürs Stufenziel. Kündigen zum Saisonende kostenlos, sofort gegen Rückzahlung der restlichen Tage plus 20 %. Kommt ein Dauerlieger früher zurück und liegt ein Gast in seiner Box, legt der Spieler den Gast um, sonst kündigt der Dauerlieger. Einzelheiten in `docs/neue-features.md`, Abschnitt 3.
7. Alle 42 Feature-Vorschläge kommen.
8. Online kommt als letzter Schritt, erst wird alles lokal fertig.

Neu gemeldet: Ausfahrende Boote kollidieren mit Booten an der Warteboje und zittern (P54).

## Offene Fragen an Jorven

9. Stil und Pixel-Fassung (Bed P9): Die Oberfläche ist im Pixel-Stil, die Welt in Flat Vector, dazu gibt es die eigene Pixel-Seite. Vorschlag: Pixel-Oberfläche über 3D-Welt wird im Plan festgehalten; die Pixel-Seite bleibt als eigene Fassung, bis du entscheidest, ob sie Hauptspiel wird.
