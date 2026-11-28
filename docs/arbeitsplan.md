# Arbeitsplan

Stand: 28.11.2026, 06:40 UTC, abgeglichen mit `main` bei `66a0d73` (PR 446), Statusangaben am Code geprüft. Gepflegt vom Thread "Nächste Schritte laufend planen"; nach jedem größeren Merge nachgeführt.

**Wozu diese Datei:** [roadmap.md](roadmap.md) sagt, *was* insgesamt noch fehlt (Pakete P01 bis P82). Dieser Arbeitsplan sagt, *was jetzt gerade* läuft, welche Fehler zuerst weg müssen und welche Pakete als Nächstes starten. [plan.md](plan.md) bleibt der gültige Plan für Vision und Regeln.

**Regeln (Jorven):**

- Fertig heißt spielbar ([abnahme.md](abnahme.md)): Handy und PC, im laufenden Spiel geprüft, mit Randfällen.
- Erst Grundprobleme fixen, dann aufbauen. Neue Features werden mit den alten zusammen geprüft.
- Nichts wartet auf Jorvens Entscheidungen: Threads entscheiden selbst und schreiben die Entscheidung in ihren PR.
- Ein Paket je Thread, ein Branch je Thread, bis zu 20 Threads gleichzeitig. Threads mergen selbst, wenn `bash tests/pruefen.sh --schnell` mit "Alles grün." endet und der PR-Check grün ist.

---

## 0. Welle 0 bis 2 sind fertig und abgenommen (21.11.2026)

Jorvens Auftrag vom 15.11. ("erst Welle 0 bis 2 fertig, das Grundgerüst") ist erfüllt. Die Abnahme-Serie auf `ae9e34f` (15 Küsten, PC Seed 11 und Handy Seed 22, 30 Läufe; Bericht `zeitraffer/2026-11-21-ae9e34f/abnahme.md` im Projektordner):

- Alle 30 Läufe erreichen das Ziel von Stufe 6, an Tag 102 bis 115, im Mittel Tag 108 (Rechnung 105).
- 0 Konsolenfehler, Speichern ohne Abweichung in 351 Prüfungen.
- Kein Boot fährt dauerhaft über Land oder durch einen Steg (jede Stelle höchstens 3 Prüfungen).
- Ineinander fest in Stufe 1 bis 4 fast überall 0; in Stufe 5 und 6 in 23 von 30 Läufen höchstens 8, kein Paar länger als 5 Prüfungen. Summe am PC Stufe 5 und 6: fest 203 statt 1081 vor P66, hängt 72 statt 1471.

Reste (kurz, nicht dauerhaft) gehen in das neue Paket **P88 Engstellen nach ihrer Länge regeln** (Prio B): Küste 14, 15, 3 vor der Einfahrt, Küste 4 im Seegatt, Großschiff-Vortritt.

Die Sperre für neue Pakete aus Welle 3 und später ist aufgehoben. Die Reihenfolge steht in Abschnitt 3.

---

## 1. Was gerade überarbeitet wird

Stand 28.11.2026, 06:40 UTC. Welle 4 ist bis auf P43, P45 und P42 gebaut: P44 (PR 429), P46 (PR 427), P47 (PR 428), P48 (PR 430), P49 (PR 433), P51 (PR 435), P52 (PR 440), P53 (PR 439), P60 (PR 441). P40-Fehler am Ehrenplatz behoben (PR 446).

| Thema | Thread | Paket | Stand |
|---|---|---|---|
| Abnahme Welle 4 | Zeitraffer | - | Serie auf `f7e42f9` fertig (30 Läufe, Bericht `zeitraffer/2026-11-28-f7e42f9/abnahme.md` im Projektordner): Ziel PC Tag 104 bis 120 (Mittel 111,3), Handy 102 bis 121 (Mittel 111,4), Rechnung 110. Fest-Paare Summe PC 7 in Stufe 1-4 und 26 in Stufe 5-6, Handy 61 und 33. Ein Konsolenfehler (Ehrenplatz, behoben in PR 446). Flottillen: 123 von 458 zusammen, nur 12 getrennt, 231 fahren als Ganzes weiter: Flottillen-Rest erledigt |
| Stau Handy Küste 3 und 14 | "Staus an Bojen und Ankerfeld auflösen" | P88-Nachlauf | erledigt (PR 456, Grenze mit PR 459 von 8 auf 11 Auslaufende zugleich im Revier, weil 8 Gäste und Zieltag kostete: Küste 14 jetzt Tag 111 statt 119 bis 123). Für die nächste Serie: Zieltag und Abgewiesen-Quote auf allen Küsten, PC Küste 15 am ersten Wintertag |
| P25 H9 | - | P25 | Roadmap sagt "H9 folgt"; nicht mehr in Arbeit, startet mit der nächsten Liste |
| Schichttest, Roadmap-Seite | Prüf- und Pflege-Threads | - | Schichten je neuem Paket |

---

## 2. Bekannte Fehler und Grundprobleme

Priorität A = stört jedes Spiel, vor allem anderen. B = stört sichtbar, vor neuen Features. C = klein oder nur in Randfällen.

| Prio | Fehler | Beleg | Paket / Thread |
|---|---|---|---|
| erledigt | ~~Flottillen ohne Spieler getrennt~~: Serie `f7e42f9` nur noch 12 von 458 getrennt, 231 fahren als Ganzes weiter (Entscheidung in flottillen.md) | Zeitraffer 28.11. | P32-Rest (PR 414) |
| B | Handy Küste 3 Stau vor der Molenöffnung Tag 64 bis 67 (fast alle 61 Fest-Paare am Handy in Stufe 1-4), Handy Küste 14 Bahnen stehen Tag 70 (hängt 17/33) | Serie `f7e42f9` | Boote-Thread |
| C | PC Küste 14 Stufe 6: 243 Paare idle/idle überlappen kurz (Boote von See), ohne festzustecken | Serie `73f388f` | Boote-Thread bei Gelegenheit |
| B | Reste aus P66: Offene Bucht Stufe 5 und 6 noch 19 bis 61 feste Paare vor der Einfahrt (80/-240, 80/-200); Mole beim Wechsel auf Stufe 5 kurz unter fahrenden Booten; Vorbeifahrer dicht an Großschiffen; Großschiff-Vortritt fehlt | Boote-Thread nach PR 381 und 384, Abnahme-Serie b331ce2 | nach der Abnahme als eigenes kleines Paket, wenn die Serie es bestätigt |
| B | Raddampfer (XL) an K01 fährt beim Einlaufen über die Westmole und beim Auslaufen über die Kaikante (Handy, mehrere Küsten) | Härtetest 15.11. nach P87, Nahbilder `handy-alle-einfahren-nah-land-1.jpg`, `handy-alle-ablegen-nah-land-1.jpg` in `/mnt/project-files/extremtest/2026-11-15-5dce72f-p87/handy/bilder/` | P84, erledigt 20.11. |
| B | Gäste liegen ab Stufe 4 kaum sichtbar an einer Warteboje (nachgemessen nach PR 327 bis 332: Stufe 4 und 6 am PC 0 an der Boje). Ursache jetzt: `selfEnter` in `sim.js` zählt als Andrang (mehr als die Hälfte der Bojen vergeben) auch Boote, die noch Minuten draußen auf See anfahren; darum fahren die ersten im Revier direkt aus der Anfahrt ein. Vorschlag: Andrang nur aus Booten im Revier oder an der Boje zählen | Härtetest 15.11. nach P87 (`bojen-erreichbar`, misst jetzt an Boje / direkt bei Andrang / unterwegs getrennt), docs/extremtest.md | P66, "Staus an Bojen" |
| B | ~~`tools/stegbilder/erzeugen.mjs` findet seit den Doppelboxen keine Variante mehr~~ erledigt: Generator zählt Doppelboxen nicht mehr mit, prüft Stufe 6 mit Yachtsteg, die 12 Stegbilder bleiben | Hinweis in PR 329 | P83 erledigt |
| erledigt | Rechnung und Bild des Geländes wichen an drei Stellen um mehr als eine Rasterzelle ab (Riss Stufe 6 bei Plan-y 196, Sandbank Küste 3, Landpunkt Küste 10). Behoben in der Geländeformel, dazu zwei weitere Stellen (Keil neben der Kaifläche Küste 5, Pfütze hinter der Nehrungsstraße Küste 1). Das Werkzeug meldet über 15 Küsten und Stufe 3 bis 6 keine Abweichung mehr; Entscheidung in docs/landschaft.md "Rechnung und Bild stimmen überein" | `node tools/zeitraffer/wasserbild.cjs --kuesten 1-15 --stufen 3-6` | Gelände-Thread |
| C | ~~Winter: Jahreszeiten steuern nur Ereignisse (G5); Dauerlieger nutzen Kran und Segelmacher nicht (H5-Rest)~~ erledigt 15.11. | Code: `jahreszeiten` nur in `data/events.js` | P20-Rest |

Erledigt seit 14.11.: Großschiffe berühren auf keiner Küste mehr Land (P84), Menschen auf festen Koordinaten (PR 316), L-Boote ragen auf den Steg, XL-Raddampfer an K01, Korvette auf Küste 4 (alle PR 329), XXL-Logbuch nie erreicht (PR 323), Aufstieg weicht von der Rechnung ab (P17, PR 331: Rechnung Tag 103, Zeitraffer 99 bis 102), Box bleibt bei Abreise unterwegs belegt (PR 327), Kurzhalter legen vor dem Festmachen ab (PR 332). Früher erledigt: Fehler aus Jorvens Feature-Test (PR 290), C05, C06 (P61), C07, P02, P04, P12, P63, P65.

---

## 3. Die nächsten Pakete, in dieser Reihenfolge

Stand 28.11.2026, 06:40 UTC. Welle 4 ist fast fertig (Abschnitt 5, C). Es bleiben drei Pakete und ein Rest. Danach kommt die Nordsee (P57), die als großes eigenes Paket schon jetzt starten kann, weil sie Gelände, Gezeiten und Schleuse betrifft und kaum die Welle-4-Pakete.

| Nr | Paket | Warum jetzt | Hängt ab von | Kann kollidieren mit |
|---|---|---|---|---|
| 1 | ~~**Stau Handy Küste 3 und 14** (Prio B)~~ erledigt (PR 456) | einzige auffällige Stellen der Serie `f7e42f9` | - | `boat-view.js`, `boat-anim.js` (Boote-Thread) |
| 2 | **P43 Fotoaufträge und Postkarten** (F22) | gibt dem Fotomodus ein Ziel; P47 und P40 liefern die Motive | - | Fotomodus, Logbuch, Meldeplatz |
| 3 | **P25 H9** | letzter Rest aus Welle 3 | - | `features/stammgaeste.js`, Gästepost |
| 4 | **P57 Nordsee mit Gezeiten** | nächste Welle, groß: Gezeiten, Schleuse, Trockenfallplätze, eigene Küsten | - | Gelände, Wasserstand, Liegeplätze, `economy.js` |
| 5 | **P45 Kreativmodus** | baut auf allen Bau- und Verschönern-Paketen auf (P60 fertig) | - | Speichern, Einstieg, Bauen, `economy.js` |
| 6 | **P42 Herausforderungen, Wochenhafen, Hafen als Code** | Abschluss Welle 4, braucht P45 und P44 (Name) | 5 | Speichern, Einstieg |

**Startregel:** Jetzt starten: 1, 2, 3, 4. 5 nach 4, sobald `economy.js` frei ist (P57 hält es zuerst), 6 nach 5. Nach P43 und P25 H9 kurze Zeitraffer-Stichprobe, nach P57 die ganze Serie auch mit Nordsee-Küsten. Welle 6 (Stufe 7 bis 20) startet mit P67, sobald P57 gemergt ist; Online (P58) zuletzt.

---

## 3a. Welle 0 abschließen und danach das Zusammenspiel prüfen

**Wann ist Welle 0 fertig?** P62, P63, P64 und P65 sind erledigt, PR 300 (fünf echte Küsten) ist gemergt, P66 hat PR 280, 327 und 332 gemergt. Offen sind (Stand 15.11., 09:30 UTC):

1. P66: Pulk und "ineinander fest" beim gleichzeitigen Ablegen.
2. ~~P84: Großschiffe kommen auf allen 15 Küsten ohne Uferberührung hinaus~~ erledigt 15.11. (PR 341) (15 Küsten x 5 Seeds, 0 Funde).
3. Abnahme laut Roadmap Abschnitt 14: Zeitraffer-Serie über alle 15 Küstentypen, PC und Handy, nach 1 und 2, mit den Werkzeugen aus P87. Grenze: kein Boot dauerhaft über Land oder durch Stege, keine Boote ineinander fest länger als ein paar Sekunden. Danach P66 und P84 in der Roadmap auf "erledigt".

Der Planungs-Thread meldet dem Koordinator, sobald alle drei Punkte erfüllt sind.

**Danach: Zusammenspiel-Prüfung (Jorven, 14.11. abends, Paket P85).** Drei Threads gleichzeitig, je Bereich einer. Ein einzelner Thread bräuchte für alles zu lange; drei getrennte Bereiche teilen kaum Dateien. Alle drei schreiben in eine gemeinsame Datei `docs/zusammenspiel.md` (je Bereich ein eigener Abschnitt, damit es keine Konflikte gibt). Grundlage sind die Ergebnisse der Threads "Spiel Schicht für Schicht von Grund auf testen" und "Ganzes Spiel im Zeitraffer durchtesten", damit nichts doppelt geprüft wird.

| Thread | Bereich | Was geprüft wird |
|---|---|---|
| Zusammenspiel 1: Kernschleife und Regeln | Ankunft, Warten, Zuweisen, Selbst-Einfahren, Funk-Anmeldung, Wünsche, Liegegeld, Kassieren, Ruf und Bewertung, Hafenbüro, Dauerlieger, Stammgäste, Tagesziele, Tagesabschluss, Aufstieg, Bauen, Winter, Speichern und Laden | Alle Punkte der Welle 1 (P01 bis P09, P54) und der Welle 2 (P10 bis P22) einzeln am laufenden Spiel nachweisen: Was die Roadmap als erledigt führt, muss im Spiel so passieren. Dazu: Stufe 1 bis 6 durchspielen und zählen, wie oft jede Regel greift. |
| Zusammenspiel 2: Oberfläche und Geräte | Handy hoch und quer, Tablet, PC; Meldeplatz, Einstieg, Hilfe, Einstellungen, Tempo, Bauen-Menü, Logbuch, Erfolge, Gästebuch, Fotomodus, Offline-Start | Jede Taste und jede Tafel auf jedem Gerät; nichts verdeckt etwas anderes; jeder Text stimmt mit dem, was passiert; nichts in Hilfe, Einstieg oder Doku, das es nicht gibt. |
| Zusammenspiel 3: Welt, Boote, Ereignisse | 10 Küstentypen, 12 Stegbilder, Bootswege, Großschiffe und Services-Besuche, Ereignisse (Sturm, Regatta, Hanse-Woche, Mittsommer, Heringstage), Wetter, Tag und Nacht, Leistung am Handy | Jede Kombination aus Küstentyp und Stegbild einmal; jedes Ereignis einmal ausgelöst und vorbereitet; Bildrate je Wetter. |

**Was jeder der drei Threads liefert:**

- **Alle Features noch da:** eine Liste aller Features aus `roadmap.md` (Abschnitte 7 bis 9, Status "erledigt"), `docs/aenderungen.md` und `plan.md`; je Feature: im Spiel gesehen ja oder nein, mit Bild.
- **Neue Features werden genutzt:** je Feature, ob es in einem normalen Spiel ohne Testadresse überhaupt vorkommt (zum Beispiel: Wie oft meldet sich ein Boot per Funk? Wird ein Erfolg in den ersten 30 Tagen erreicht? Kommt jedes Ereignis in einer Saison vor?). Ein Feature, das nie vorkommt, ist ein Fund.
- **Welle 1 wirklich gefixt:** je Punkt Ü1 bis Ü7, C01 bis C07 und T1 bis T13 ein Nachweis im Spiel.
- **Übersehen:** alles, was auffällt und in keiner Liste steht.
- Kleine Funde beheben die Threads selbst, je Fund ein PR. Größere Funde kommen mit Priorität in Abschnitt 2 dieses Plans.

## 4. Berührungspunkte, auf die alle achten

- `web/js/data/economy.js`: frei (P29, P36, P35, P31, P34, P17, P19, P20, P23, 252 und A10 sind gemergt). Immer nur einer zur Zeit, danach `node tools/zahlen.mjs --schreiben` und `docs/zahlen.md` mitcommitten.
- `web/js/sim.js`: kleine, getrennte Änderungen, vorher auf `main` rebasen, neue Regel mit eigenem Test.
- Meldungs-Ordnung (höchstens eine schwebende Meldung, Tipps nie über Zeit und Bauen): P55, P22, P24 melden sich dort an, statt eigene Ebenen zu bauen.
- `web/index.html`, `web/js/main.js`: nur eine `MODULES`-Zeile je neuem Modul; P61 ändert die Importmap und stimmt das im PR ab.
- Speichern: neue Felder mit `SAVE_VERSION` und Migration; P21 hat Version 3 genommen (Logbuch), Welle 6 plant Version 4 (P73).
- Liegeplätze: neue Plätze bekommen eine Lage in `data/liegelage.js` und müssen `node tools/liegeplaetze/pruefen.mjs` ohne Fund bestehen.
- Nach großen Änderungen den Härtetest laufen lassen ([extremtest.md](extremtest.md)).
- Nach jedem Merge, der Boote oder Gelände berührt: Zeitraffer-Serie und Messlatte erneut.

---

## 5. Alles Weitere bis zum Ende

Hier stehen alle Vorschläge Jorvens, die noch offen sind, in der Reihenfolge, in der sie drankommen. Einzelheiten zu jedem Paket stehen in der [Roadmap](roadmap.md), Stufe 7 bis 20 in [ausbau-stufe-7-20.md](ausbau-stufe-7-20.md). Ein Abschnitt startet, sobald Plätze frei sind; er muss nicht warten, bis der vorige ganz fertig ist. Grundprobleme, die unterwegs auftauchen, gehen immer vor.

### Abschnitt A: Kernschleife fertig (Welle 2, Rest)

| Paket | Inhalt | Vorschläge |
|---|---|---|
| P20-Rest | erledigt (G5, H5) | F14, F15, G5, H5 erledigt |
| P55, P21 | erledigt (PR 269, 275, 274) | F36 Hafenchronik |
| P22 | Erfolge, erledigt (PR 295) | - |

### Abschnitt B: Tiefe und Hafenleben (Welle 3)

Reihenfolge nach Wirkung auf die Kernschleife: erst was jede Ankunft und jedes Zuweisen spannender macht, dann Anlagen, dann seltene Höhepunkte.

| Reihenfolge | Paket | Inhalt | Vorschläge |
|---|---|---|---|
| 1 | P24 | erledigt (PR 281, 299) | F17 |
| 2 | P23 | erledigt (Services mit eigener Wirkung) | F2, F3, F5, F7, F9 |
| 3 | P28 | erledigt (PR 288) | F2 |
| 4 | P27 | erledigt (PR 330) | F1 |
| 5 | P33 | erledigt (PR 314) | F4 |
| 6 | P34 | erledigt (PR 392, [wind.md](wind.md)) | F5, F35 |
| 7 | P31 | erledigt (PR 406, [gaestewuensche.md](gaestewuensche.md)) | F9 |
| 8 | P30 | erledigt (PR 297; Wasser kommt mit P31) | F8 |
| 9 | P35 | erledigt (Preisstufe, [preisstufe.md](preisstufe.md)) | F6 |
| 10 | P32 | erledigt (Flottillen, [flottillen.md](flottillen.md)) | F3 |
| 11 | P25 | Teil 1 und 2 gemergt (PR 394), H9 läuft | F37 |
| 12 | P29 | erledigt (Baggern, [baggern.md](baggern.md)) | F7 |
| 13 | P36 | erledigt (Bojenfeld im See, [bojenfeld.md](bojenfeld.md)) | F10 |
| 14 | P59 | erledigt (Doppelboxen PR 321, Yachtsteg PR 326) | - |
| 15 | P26 | erledigt (PR 322) | - |
| 15a | P86 | erledigt (PR 342) | - |
| 16 | P37 | erledigt (PR 408) | F11 |
| 17 | P38 | erledigt (PR 405) | F12 |
| 18 | P39 | erledigt (PR 412) | F13 |
| 19 | P40 | erledigt (PR 416) | F16 |

### Abschnitt C: Langzeit, Spielgefühl, Welt (Welle 4)

| Paket | Inhalt | Vorschläge |
|---|---|---|
| P41 | erledigt (PR 315) | F19, F20 |
| P44 | erledigt (PR 429) | F23, F27 |
| P50 | erledigt (Einstellungen im Menü) | F25 |
| P47 | erledigt (PR 428) | F31 |
| P48 | erledigt (PR 430) | F32 |
| P46 | erledigt (PR 427) | F29, F30 |
| P43 | Fotoaufträge und Postkarten | F22 |
| P49 | erledigt (PR 433) | F33, F34 |
| P51, P52, P53 | erledigt (PR 435, 440, 439) | F38, F39, F40 |
| P60 | Hafen verschönern (erledigt, [verschoenern.md](verschoenern.md)) | D8 |
| P45 | Kreativmodus | F24 |
| P42 | Herausforderungen, Wochenhafen, Hafen als Code (nach P09, P45) | F21, F41, F42 |

### Abschnitt D: Nordsee (Welle 5)

| Paket | Inhalt |
|---|---|
| P57 | Nordsee mit Gezeiten, Schleuse, Trockenfallplätzen |

### Abschnitt E: Ausbau Stufe 7 bis 20 (Welle 6)

Nach Abschnitt C und P57. Plan: [ausbau-stufe-7-20.md](ausbau-stufe-7-20.md). Nichts davon erscheint im Spiel, bevor die Stufe spielbar ist.

| Reihenfolge | Paket | Inhalt |
|---|---|---|
| 1 | P67 | Stufe-6-Annahmen im Code lösen (unsichtbar) |
| 2 | P68, P69 | Leistung und Bedienung großer Häfen |
| 3 | P70, P71, P72 | Stufe 7 Hafenstadt, 8 Fährhafen, 9 Werfthafen |
| 4 | P73 | Stufe 10 Hafenverbund mit Hafenkarten |
| 5 | P74, P75, P76 | Stufe 11 Gästeweitergabe, 12 Hafenprofile, 13 Regattawoche |
| 6 | P77, P78 | Stufe 14 Nordseehafen, 15 Offshore-Hafen |
| 7 | P79, P80 | Stufe 16 Kreuzfahrthafen, 17 und 18 Marinehafen und Großseglertreffen |
| 8 | P81, P82 | Stufe 19 Kanalhafen, 20 Hafenimperium |

### Abschnitt F: Online (zuletzt)

| Paket | Inhalt |
|---|---|
| P58 | Online mit Supabase (Hafenname, Bestenliste, Gastboote), vorher Sicherheitsreview (Audit C08) |

Schon erledigt aus Jorvens Vorschlägen: F1 bis F20, F23, F25 bis F40 (F37 bis auf P25 H9). Offen: F21, F22, F24, F41, F42 (P42, P43, P45).

---

## 6. Verlauf

| Datum | Änderung |
|---|---|
| 28.11.2026, 12:45 Uhr | Abfahrtsgrenze 11 statt 8 (PR 459). |
| 28.11.2026, 10:50 Uhr | Stau Handy Küste 3/14 erledigt (PR 456). |
| 28.11.2026, 06:40 Uhr | Welle 4 bis auf P43, P45, P42 gebaut; Serie `f7e42f9` sauber (Mittel Tag 111), Flottillen-Rest erledigt. Starten: Stau Handy Küste 3/14, P43, P25 H9, P57 Nordsee. |
| 22.11.2026, 14:50 Uhr | Welle 3 gebaut (bis P25 H9), Serie `73f388f` sauber (Mittel Tag 109,4). Welle 4 startet mit P48, P47, P46, P44. Ganze Serie auf aktuellem `main`. |
| 22.11.2026, 05:05 Uhr | P31 (PR 406) und P38 (PR 405) gemergt. Starten: Flottillen-Rest, P35, P37, P39. Ganze Zeitraffer-Serie auf `73f388f`. |
| 22.11.2026, 05:00 Uhr | P88 erledigt (PR 407). Abnahme mit der ganzen Zeitraffer-Serie nach P31. |
| 22.11.2026, 03:50 Uhr | P88 Teil 2 gemergt (PR 400). Großschiff-Vortritt aus P88 gestrichen (drei Fassungen ohne Wirkung). |
| 22.11.2026, 03:40 Uhr | P34, P32, P25 Teil 1 und 2, P88 Teil 1 gemergt; P31 läuft. Flottillen-Quote als Prio B. Neu starten: P37, P38. Ganze Serie nach P31. |
| 21.11.2026, 23:30 Uhr | P88 Teil 1 gemergt (PR 390): getrennte Bahnen vor der Einfahrt, 14 von 15 Küsten gleich oder besser. Rest bleibt beim Boote-Thread. |
| 21.11.2026, 23:00 Uhr | Welle 0 bis 2 abgenommen (Serie `ae9e34f`, 30 Läufe). Reste als P88. Sperre aufgehoben, Welle 3 startet mit P34, P32, P25, P88. |
| 21.11.2026, 15:30 Uhr | P66 und P85 erledigt, Welle 0 bis 2 gebaut; nur die Abnahme-Serie läuft noch. P66-Reste als Prio B. |
| 21.11.2026, 01:45 Uhr | P84, P20-Rest, P85 Teil 1 und 2 erledigt; offen nur P66 Pulk beim Ablegen, P85 Teil 3 und die Welle-0-Abnahme. |
| 20.11.2026, 20:10 Uhr | Abgleich nach fünf Tagen Stillstand: P87 erledigt; P84 (PR 341), P20-Rest (PR 347) und Logbuch (PR 346) fertig, aber offen; P66 Pulk und P85 ohne Stand. Startliste: Threads wieder aufnehmen, P85 Teil 1 und 2 neu. |
| 15.11.2026, 11:00 Uhr | Jorven: erst Welle 0 bis 2 fertig. Neuer Abschnitt 0 mit den fünf offenen Paketen (P66, P84, P87, P85, P20-Rest); keine neuen Pakete aus Welle 3 und später; Zusammenspiel 1 und 2 starten sofort. |
| 15.11.2026, 09:30 Uhr | Ganzer Plan am Code abgeglichen (Thread "Roadmap, Plan und README nachziehen"): Abschnitte 1 bis 3 neu; P17, P27, P24 und viele andere erledigt; neue Pakete P83 Stegbild-Generator, P84 Großschiffwege, P85 Zusammenspiel, P86 Bootsgeschichten-Rest, P87 Prüfwerkzeuge; Startliste 2, 3, 4, 5, 7. |
| 15.11.2026 | P59 Teil 1 Doppelboxen gemergt (PR 321); Teil 2 Yachtsteg in Stufe 6 (D9) im PR. |
| 15.11.2026 | P59 übernommen vom Thread "Bauen mit Vorschau und Tiefe ausbauen": Teil 1 Doppelboxen (D5, D6), Teil 2 neue Gastplätze Stufe 6 (D9) danach. |
| 15.11.2026, 04:30 Uhr | "Längere Tage und Bootsgeschichten": Teil 1 bis 3 in PR 319 (lange Tage, Kurzhalt, 65 Geschichten, Regatta draußen). Stau in der Ausfahrt bei vielen gleichzeitigen Ausfahrten an "Staus an Bojen" gemeldet. |
| 15.11.2026, 02:30 Uhr | Neu: "Längere Tage und Bootsgeschichten einbauen" (Plan docs/bootsgeschichten.md): Tag 270 s, Kurzhalt ohne Nacht, Anlässe je Boot, echte Regatta; Zahlen mit P17. |
| 15.11.2026, 02:10 Uhr | Zwischenserie nach PR 280 (Typ 1, 2): Pulk bleibt Prio A, Welle 0 noch nicht abnahmefähig; Fund XXL-Logbucheinträge nie erreicht. |
| 14.11.2026, 22:10 Uhr | PR 280 gemergt, P62 und P64 erledigt; Welle-0-Abnahme über 15 Küsten nach Ankerfeld-Fix und PR 300; Menschen auf festen Koordinaten als Fund B. |
| 14.11.2026, 22:00 Uhr | P28, P24 Teil 2, ruhige Oberfläche gemergt; Abschnitt 3a: wann Welle 0 fertig ist und Zusammenspiel-Prüfung in drei Threads danach. |
| 14.11.2026, 21:15 Uhr | A10, Feature-Test-Fehler und P22 gemergt; P17 startet jetzt (Schlussmessung nach PR 280); neu: P41, P26; P28 wieder aufnehmen. |
| 14.11.2026, 11:45 Uhr | PR 252 und P24 Teil 1 gemergt; A10, P24 Teil 2, P28 und Schicht-Test laufen; P17 startet nach PR 280 und A10 und übernimmt Ü16. |
| 14.11.2026, 11:30 Uhr | P19, P55, P21, P61, C07 erledigt; P24 Teil 1, P22, ruhige Handy-Oberfläche und Feature-Test-Fehler laufen; Bewertungsbefund gestrichen (seit P14 behoben); neue Nr. 9 und 10: P28, P27. |
| 14.11.2026, 10:15 Uhr | PR 244 (P19 Teil 1) gemergt; P19 Teil 2 läuft; Befund Stufe 2 dauert 50 statt 38 Tage ins Balancing-Paket. |
| 14.11.2026, 10 Uhr | Abschnitt 5: alle offenen Vorschläge (F1 bis F42) und Stufe 7 bis 20 in Reihenfolge. |
| 14.11.2026 | Erste Fassung. Roadmap-Status P02, P04, P12, P63, P65 auf "erledigt" nachgetragen. |
