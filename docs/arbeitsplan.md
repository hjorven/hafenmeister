# Arbeitsplan

Stand: 14.11.2026, 21:15 UTC, abgeglichen mit `main` bei `adc0086` (PR 295). Gepflegt vom Thread "Nächste Schritte laufend planen"; nach jedem größeren Merge nachgeführt.

**Wozu diese Datei:** [roadmap.md](roadmap.md) sagt, *was* insgesamt noch fehlt (Pakete P01 bis P82). Dieser Arbeitsplan sagt, *was jetzt gerade* läuft, welche Fehler zuerst weg müssen und welche Pakete als Nächstes starten. [plan.md](plan.md) bleibt der gültige Plan für Vision und Regeln.

**Regeln (Jorven):**

- Fertig heißt spielbar ([abnahme.md](abnahme.md)): Handy und PC, im laufenden Spiel geprüft, mit Randfällen.
- Erst Grundprobleme fixen, dann aufbauen. Neue Features werden mit den alten zusammen geprüft.
- Nichts wartet auf Jorvens Entscheidungen: Threads entscheiden selbst und schreiben die Entscheidung in ihren PR.
- Ein Paket je Thread, ein Branch je Thread, bis zu 20 Threads gleichzeitig. Threads mergen selbst, wenn `bash tests/pruefen.sh --schnell` mit "Alles grün." endet und der PR-Check grün ist.

---

## 1. Was gerade überarbeitet wird

Stand 14.11.2026, 21:15 UTC.

| Thema | Thread | Paket | Stand | PR |
|---|---|---|---|---|
| Boote: Wartebojen neben den Stegen, Anfahrt von weit draußen, Stau im Becken | "Staus an Bojen und Ankerfeld auflösen" | P66 | PR seit 11 Uhr offen, muss fertig werden | 280 |
| Gelände: Seewege, Seegatt für geschlossene Bodden | "Geländeform und Engpass neu bauen" | P62 | läuft | - |
| Längere Tage (5 min) und Bootsgeschichten (50 Alltag + 14 Ereignis-Anlässe), echte Regatta, Plan docs/bootsgeschichten.md | "Längere Tage und Bootsgeschichten einbauen" | neu (Jorven 14.11.) | PR 319: Tag 270 s, Kurzhalt, 65 Geschichten mit Logbuch-Reiter, Regatta mit Bahn und Tonnen. Offen: Startsignal, Siegerehrung, Gepäck, Tanksteg-Halt | - |
| Stege umbauen: Teil 2 Yachtsteg in Stufe 6 (D9), Teil 1 Doppelboxen gemergt (PR 321) | "Bauen mit Vorschau und Tiefe ausbauen" | P59 | Teil 2 im PR | 326 |
| Schicht-Test, Feature-Test, Zeitraffer, Roadmap-Seite, Kamera | Prüf- und Pflege-Threads | - | laufen | 251, 296 |

Seit 21:15 gemergt: ruhige Oberfläche mit einem Meldeplatz (PR 282), P28 Funk-Anmeldung (PR 288), P24 Teil 2 neue Ereignisse (PR 299), Zeitraffer-Pulk (PR 251), Pages gebündelt (PR 294), Folgefunde Einzeltest (PR 301).

Seit 11:30 gemergt: A10 große Boote nach Platzangebot (PR 287), Fehler aus Jorvens Feature-Test (PR 290), P22 Erfolge (PR 295), Offline-Folge (PR 292), Auszeichnung im Gästebuch (PR 291), README und Plan (PR 289).

---

## 2. Bekannte Fehler und Grundprobleme

Priorität A = stört jedes Spiel, vor allem anderen. B = stört sichtbar, vor neuen Features. C = klein oder nur in Randfällen.

| Prio | Fehler | Beleg | Paket / Thread |
|---|---|---|---|
| A | Pulk und Stau: nach PR 280 (Serie `c589ca5`, Typ 1 und 2) an rund 90 Tagen je Partie ein Pulk mit bis zu 100 Booten auf 45 m; ineinander fest 42 bis 470, hängend 92 bis 323, in Fahrt berührt 1800 bis 3500 je Partie; über Land fast weg (1 bis 6). Typ 2 PC schlechter als vorher | Zeitraffer-Zwischenserie 15.11. 02:00 UTC, Typ 3 bis 10 folgen | P66, Boote-Thread (Ankerfeld-Fix plus Pulk) |
| A | Boote noch über Land (rund 21 je Lauf) und durch Stege (rund 17 je Lauf), vor allem Typ 3 und 8 | dieselbe Serie | P66 mit P62 |
| A | Aufstieg weicht von der Rechnung ab; nach PR 252: geschickt 225, gemütlich 239 Tage, Stufe 2 gemütlich 36 Tage; A10 (PR 287) verschiebt um +2 bis +6 Tage | Zeitraffer-Serien, `tools/balance.mjs` | Balancing-Paket P17 |
| B | Menschen laufen auf festen Koordinaten (`people/netz.js`), nicht auf dem Seed-Gelände | Gelände-Thread, 14.11. | erledigt 15.11. (Thread "Menschen auf das Gelände stellen", docs/menschen-wege.md) |
| C | `tests/specs/leinen.spec.mjs` prüft nur Küstentyp 1 bis 10 | Gelände-Thread | Leinen- oder Test-Thread nach PR 300 |
| B | Logbuch: die 9 XXL-Einträge werden in keiner Partie erreicht (0/9), sonst 74 bis 76 von 89 | Zeitraffer-Zwischenserie | Logbuch-Thread prüft, ob XXL-Besuche im normalen Spiel vorkommen; sonst Einträge an echte Ereignisse binden |
| B | `istWasser` und Bild stimmen am Durchstich nicht überall überein | Messlatte (`feature-tests/messlatte/README.md`) | P62 |
| C | Winter: Rest von H5, G5 | roadmap.md P20 | P20-Rest nach P17 |

Erledigt: Fehler aus Jorvens Feature-Test vom 14.11. (PR 290), Bewertung "1 + 4 x erfüllt/alle" (seit P14), C05, C06 (P61), C07, P02, P04, P12, P63, P65.

---

## 3. Die nächsten Pakete, in dieser Reihenfolge

Leitlinie: Erst muss ein Spiel von Stufe 1 bis 6 ohne Stau und im erwarteten Tempo durchlaufen. Sichtbarkeit (P55), Logbuch (P21) und Erfolge (P22) sind fertig. Jetzt: Grundprobleme abschließen, dann Inhalte, die wenig Dateien teilen.

| Nr | Paket | Warum jetzt | Hängt ab von | Kann kollidieren mit |
|---|---|---|---|---|
| 1 | **P66 PR 280 fertig machen** (läuft) | Prio A; liegt seit 10 Stunden offen und blockiert P27 und die Schlussmessung von P17 | - | P62, Stegbilder, XXL; danach Zeitraffer-Serie neu |
| 2 | **P17 Balancing: Aufstieg angleichen, Ü15, Ü16** (neu, startet jetzt) | Prio A; A10 ist gemergt. Rechnung (`tools/balance.mjs`) und Regeln jetzt angleichen, Schlussmessung im Zeitraffer nach PR 280 | Schlussmessung nach 1 | `economy.js` (einziger Thread dort), `docs/zahlen.md`, Einstieg (J5) |
| 3 | **P28 Funk-Anmeldung** | erledigt (PR 288, `docs/funk-anmeldung.md`) | - | `ui/vorschau.js`, `sim.js`, Meldeplatz (PR 282) |
| 4 | **P41 Statistik und Saisonbilanz** (neu) | nutzt die vorhandenen Daten (`state.stats.verlauf`, Einnahmen nach Quelle); fast nur eigene Dateien | - | Tagesabschluss-Tafel, Winterkarte (Saisonbilanz dort ergänzen statt doppeln) |
| 5 | **P26 Überraschende Gesten** (erledigt, docs/hafengesten.md) | Hafenhorn, Fernglas mit Steckbrief, Möwen, Glocke: macht den Hafen lebendig, berührt kaum Regeln | - | `audio.js`, Gesten (`ui/gesten.js`), Fotomodus |
| 6 | **P24 Ereignisse Teil 2** (erledigt, PR 299) | neue Ereignisse F17 | - | Meldeplatz (PR 282) |
| 7 | **P27 Päckchen liegen** | voller Hafen wird zur Entscheidung | 1 | `sim.js`, `boat-view.js`, Wegsuche |
| 8 | **P20-Rest Winter** (H5, G5) | Kernschleife über das Jahr fertig | 2 | `winter.js`, `economy.js` |
| 9 | **P23 Services mit eigener Wirkung** | macht Stufe 4 bis 6 tiefer | 2 (Zahlen) | `render/services.js`, `data/services.js` |
| 10 | **P33 Liegende Boote umlegen** | eigene Entscheidung im vollen Hafen | 1 | `sim.js`, `boat-view.js` |

Danach geht es weiter wie in [Abschnitt 5](#5-alles-weitere-bis-zum-ende) beschrieben, bis Stufe 20 und Online.

**Startregel:** Jetzt starten: 2, 4, 5; 3 wieder aufnehmen; 1 zu Ende bringen. 7 und 10 nach 1, 8 und 9 nach 2. Nie zwei Threads gleichzeitig an `economy.js`. Alle neuen Meldungen gehen über den einen Meldeplatz aus PR 282.

---

## 3a. Welle 0 abschließen und danach das Zusammenspiel prüfen

**Wann ist Welle 0 fertig?** P62, P63, P64 und P65 sind erledigt, P66 hat PR 280 gemergt (Wartebojen, Anfahrt von weit draußen). Offen sind:

1. P66: Fix des Boote-Threads für den Ankerfeld-Rückfall (13 % der Seeds) und Restboote nach dem Winter.
2. PR 300 (fünf neue Küstentypen 11 bis 15, nicht Welle 0, aber danach würfelt jedes neue Spiel aus 15 Küsten).
3. Abnahme laut Roadmap Abschnitt 14: Zeitraffer-Serie über alle 15 Küstentypen, PC und Handy, nach 1 und 2. Grenze: kein Boot dauerhaft über Land oder durch Stege, keine Boote ineinander fest länger als ein paar Sekunden. Danach P66 in der Roadmap auf "erledigt".

Der Planungs-Thread meldet dem Koordinator, sobald alle drei Punkte erfüllt sind.

**Danach: Zusammenspiel-Prüfung (Jorven, 14.11. abends).** Drei Threads gleichzeitig, je Bereich einer. Ein einzelner Thread bräuchte für alles zu lange; drei getrennte Bereiche teilen kaum Dateien. Alle drei schreiben in eine gemeinsame Datei `docs/zusammenspiel.md` (je Bereich ein eigener Abschnitt, damit es keine Konflikte gibt). Grundlage sind die Ergebnisse der Threads "Spiel Schicht für Schicht von Grund auf testen" und "Ganzes Spiel im Zeitraffer durchtesten", damit nichts doppelt geprüft wird.

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

- `web/js/data/economy.js`: Reihenfolge P17 (mit Ü16), P20-Rest, P23 (P19, 252 und A10 sind gemergt). Immer nur einer zur Zeit, danach `node tools/zahlen.mjs --schreiben` und `docs/zahlen.md` mitcommitten.
- `web/js/sim.js`: kleine, getrennte Änderungen, vorher auf `main` rebasen, neue Regel mit eigenem Test.
- Meldungs-Ordnung (höchstens eine schwebende Meldung, Tipps nie über Zeit und Bauen): P55, P22, P24 melden sich dort an, statt eigene Ebenen zu bauen.
- `web/index.html`, `web/js/main.js`: nur eine `MODULES`-Zeile je neuem Modul; P61 ändert die Importmap und stimmt das im PR ab.
- Speichern: neue Felder (P21, P22) mit `SAVE_VERSION` und Migration; P21 hat Version 3 genommen (Logbuch), Welle 6 plant jetzt Version 4.
- Nach jedem Merge, der Boote oder Gelände berührt: Zeitraffer-Serie und Messlatte erneut.

---

## 5. Alles Weitere bis zum Ende

Hier stehen alle Vorschläge Jorvens, die noch offen sind, in der Reihenfolge, in der sie drankommen. Einzelheiten zu jedem Paket stehen in der [Roadmap](roadmap.md), Stufe 7 bis 20 in [ausbau-stufe-7-20.md](ausbau-stufe-7-20.md). Ein Abschnitt startet, sobald Plätze frei sind; er muss nicht warten, bis der vorige ganz fertig ist. Grundprobleme, die unterwegs auftauchen, gehen immer vor.

### Abschnitt A: Kernschleife fertig (Welle 2, Rest)

| Paket | Inhalt | Vorschläge |
|---|---|---|
| P20-Rest | Winter: Rest von H5 und G5 | F14, F15 erledigt |
| P55, P21 | erledigt (PR 269, 275, 274) | F36 Hafenchronik |
| P22 | Erfolge, erledigt (PR 295) | - |

### Abschnitt B: Tiefe und Hafenleben (Welle 3)

Reihenfolge nach Wirkung auf die Kernschleife: erst was jede Ankunft und jedes Zuweisen spannender macht, dann Anlagen, dann seltene Höhepunkte.

| Reihenfolge | Paket | Inhalt | Vorschläge |
|---|---|---|---|
| 1 | P24 | Ereignisse zum Vorbereiten, neue Ereignisse (Mittsommer, Holzboot-Treffen, Heringstage) | F17 |
| 2 | P23 | Services mit eigener Wirkung | - |
| 3 | P28 | Anmeldung per Funk, Platz freihalten | F2 |
| 4 | P27 | Päckchen liegen bei vollem Hafen | F1 |
| 5 | P33 | Liegende Boote umlegen (verholen) | F4 |
| 6 | P34 | Wind im Hafen spürbar, Windseite, Anlegen gegen den Wind | F5, F35 |
| 7 | P31 | Neue Gästewünsche (WLAN, Waschmaschine, Frischwasser, Absaugstation, Brötchen) | F9 |
| 8 | P30 | Stege nachrüsten (Wasser, Strom, Fingerstege, Licht) | F8 |
| 9 | P35 | Preisstufe am Hafenbüro | F6 |
| 10 | P32 | Flottillen | F3 |
| 11 | P25 | Stammgäste mit Wirkung, Gästepost | F37 |
| 12 | P29 | Baggern für tiefere Liegeplätze | F7 |
| 13 | P36 | Bojenfeld im See | F10 |
| 14 | P59 | Stege umbauen und Varianten wählen (Doppelboxen PR 321, Yachtsteg PR 326) | - |
| 15 | P26 | Überraschende Gesten (Hafenhorn, Fernglas, Möwen, Glocke) | - |
| 16 | P37 | Havarist einschleppen | F11 |
| 17 | P38 | Eigenes Hafenfest | F12 |
| 18 | P39 | Jugendtraining am Segelclub | F13 |
| 19 | P40 | Seltene Besucher (nach P21) | F16 |

### Abschnitt C: Langzeit, Spielgefühl, Welt (Welle 4)

| Paket | Inhalt | Vorschläge |
|---|---|---|
| P41 | Statistik und Saisonbilanz | F19, F20 |
| P44 | Hafenname und Flagge (mit Test gegen präparierte Namen, Audit C05) | F23, F27 |
| P50 | Einstellungen für Sicht und Bewegung | F25 |
| P47 | Große Ankünfte ankündigen | F31 |
| P48 | Leinen annehmen beim Anlegen | F32 |
| P46 | Ruhiger Abend, Serien-Akkord | F29, F30 |
| P43 | Fotoaufträge und Postkarten | F22 |
| P49 | Signalflaggen und Hafenwissen (nach P21) | F33, F34 |
| P51, P52, P53 | Hafentiere, Naturecke, Spätankömmling | F38, F39, F40 |
| P60 | Hafen verschönern | - |
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

Schon erledigt aus Jorvens Vorschlägen: F14, F15, F18, F26, F27 (Grundgerüst), F28.

---

## 6. Verlauf

| Datum | Änderung |
|---|---|
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
