# Arbeitsplan

Stand: 14.11.2026, 11:30 UTC, abgeglichen mit `main` bei `dae7f97` (PR 279). Gepflegt vom Thread "Nächste Schritte laufend planen"; nach jedem größeren Merge nachgeführt.

**Wozu diese Datei:** [roadmap.md](roadmap.md) sagt, *was* insgesamt noch fehlt (Pakete P01 bis P82). Dieser Arbeitsplan sagt, *was jetzt gerade* läuft, welche Fehler zuerst weg müssen und welche Pakete als Nächstes starten. [plan.md](plan.md) bleibt der gültige Plan für Vision und Regeln.

**Regeln (Jorven):**

- Fertig heißt spielbar ([abnahme.md](abnahme.md)): Handy und PC, im laufenden Spiel geprüft, mit Randfällen.
- Erst Grundprobleme fixen, dann aufbauen. Neue Features werden mit den alten zusammen geprüft.
- Nichts wartet auf Jorvens Entscheidungen: Threads entscheiden selbst und schreiben die Entscheidung in ihren PR.
- Ein Paket je Thread, ein Branch je Thread, bis zu 20 Threads gleichzeitig. Threads mergen selbst, wenn `bash tests/pruefen.sh` mit "Alles grün." endet.

---

## 1. Was gerade überarbeitet wird

Stand 14.11.2026, 11:30 UTC.

| Thema | Thread | Paket | Stand | PR |
|---|---|---|---|---|
| Boote: Wartebojen neben den Stegen, Anfahrt von weit draußen, Stau im Becken | "Staus an Bojen und Ankerfeld auflösen" | P66 | PR offen | 280 |
| Gelände: Seewege, Seegatt für geschlossene Bodden | "Geländeform und Engpass neu bauen" | P62 | Fahrrinne in die offene See gemergt (PR 271), läuft weiter | - |
| Ereignisse: Teil 2 mit neuen Ereignissen (G3, F17) | "Ereignisse Sturm und Regatta einbauen" | P24 Teil 2 | Teil 1 gemergt (PR 281), Teil 2 läuft | - |
| Ruhige Handy-Oberfläche: ein Meldeplatz, eine Meldung zur Zeit | "Handy-Oberfläche neu und ruhig gestalten" | P07 (Folge) | PR offen | 282 |
| Fehler aus Jorvens Feature-Test | "Fehler aus Jorvens Feature-Test beheben" | Grundprobleme | läuft | - |
| Anmeldung per Funk | "Anmeldung per Funk einbauen" | P28 | läuft | - |
| Spiel Schicht für Schicht von Grund auf testen | eigener Thread | Prüfung | läuft | - |
| Erfolge | Logbuch-Thread | P22 | läuft (nach P21) | - |
| Große Boote nach Platzangebot (A10), danach Ü16 | Bauen-Thread | A10 | läuft; PR 252 (Liegegeld je Meter) gemergt | - |
| Feature-Test, Zeitraffer-Test, Tests, Roadmap-Seite | Prüf- und Pflege-Threads | - | laufen; Zeitraffer-PR offen | 251, 276 |

Seit dem Morgen gemergt: P19 komplett (PR 244, 279), P55 komplett (PR 269, 275), P21 Logbuch und Chronik (PR 274), P61 offline (PR 270), Audit C07 (PR 264), Menüs am Handy (PR 261, 267), Ablegen mit Box-belegt (PR 266), Tempo ohne automatische Bremsung (PR 278), Überblick hochkant (PR 190).

---

## 2. Bekannte Fehler und Grundprobleme

Priorität A = stört jedes Spiel, vor allem anderen. B = stört sichtbar, vor neuen Features. C = klein oder nur in Randfällen.

| Prio | Fehler | Beleg | Paket / Thread |
|---|---|---|---|
| A | Stau im Hafenbecken ab Stufe 3: je Lauf rund 300 Bootspaare ineinander fest und 430 hängende Boote, 90 % in Stufe 5 und 6 | Zeitraffer-Serie auf `5b00546` (`zeitraffer/2026-11-13-5b00546/vergleich.md` im Projektordner); nach PR 280 neu messen | P66, PR 280 |
| A | Boote noch über Land (rund 21 je Lauf) und durch Stege (rund 17 je Lauf), vor allem Typ 3 und 8 | dieselbe Serie | P66 mit P62 |
| A | Aufstieg langsamer als gerechnet: Ziel Stufe 6 im Mittel an Tag 278 bis 296 statt 258; seit P19 dauert Stufe 2 für gemütliche Spieler 50 statt 38 Tage | Zeitraffer-Serien, `tools/balance.mjs` | Balancing-Paket P17 |
| A/B | Fehler aus Jorvens Feature-Test | Jorvens Test | Thread "Fehler aus Jorvens Feature-Test beheben" |
| B | `istWasser` und Bild stimmen am Durchstich nicht überall überein | Messlatte (`feature-tests/messlatte/README.md`) | P62 |
| C | Winter: Rest von H5, G5 | roadmap.md P20 | P20-Rest mit P17 |

Erledigt: Bewertung "1 + 4 x erfüllt/alle" (seit P14 Untergrenze 2,5, Aufnehmen ist nie schlechter als Abweisen), C05, C06 (P61), C07, P02, P04, P12, P63, P65.

---

## 3. Die nächsten Pakete, in dieser Reihenfolge

Leitlinie: Erst muss ein Spiel von Stufe 1 bis 6 ohne Stau und im erwarteten Tempo durchlaufen. Dann machen wir sichtbar, was die Regeln schon tun (P55, P21 sind fertig). Erst dann kommen neue Inhalte.

| Nr | Paket | Warum jetzt | Hängt ab von | Kann kollidieren mit |
|---|---|---|---|---|
| 1 | **P66 Stau und Wartebojen** (PR 280 offen) | Prio A, jedes Spiel ab Stufe 3 | - | P62, Stegbilder, XXL; danach Zeitraffer-Serie neu |
| 2 | **Fehler aus Jorvens Feature-Test** (läuft) | Grundprobleme, die Jorven selbst gesehen hat | - | je nach Fehler; meldet Berührungspunkte im PR |
| 3 | **A10 große Boote nach Platzangebot** (Bauen-Thread, läuft; PR 252 gemergt) | ändert das Tempo des Aufstiegs um +2 bis +6 Tage, muss vor P17 stehen | - | `economy.js`, `sim.js` (Ankünfte) |
| 4 | **Balancing-Paket P17: Aufstieg angleichen, mit Ü15 und Ü16** (neu, startet nach PR 280 und A10) | Prio A: Rechnung und Zeitraffer auf höchstens 5 % zusammenbringen. Stand nach PR 252: geschickt 225 Tage, gemütlich 239 Tage, Stufe 2 gemütlich 36 Tage; danach mit A10 neu messen. Ü16 gehört zu P17, damit nur ein Thread an den Startwerten dreht | 1 (Stau verfälscht die Messung), 3 (A10) | `economy.js`, `tools/balance.mjs`, Einstieg (J5) |
| 5 | **P24 Ereignisse** (Teil 1 gemergt, PR 281; Teil 2 mit G3 und F17 läuft) | erstes Extra, Thread kennt den Code | - | Wetterflagge, Meldungs-Ordnung (PR 282) |
| 6 | **P22 Erfolge** (läuft) | letztes offenes Welle-2-Paket | P21 (erledigt) | Aufstieg-Feier, Meldungs-Ordnung (PR 282) |
| 7 | **P20-Rest Winter** (H5, G5) | Kernschleife über das Jahr fertig | 4 | `winter.js`, `economy.js` |
| 8 | **P23 Services mit eigener Wirkung** (neu) | Welle 3, macht Stufe 4 bis 6 tiefer | 4 (Zahlen) | `render/services.js`, `data/services.js`, Besuchswege |
| 9 | **P28 Anmeldung per Funk** (läuft) | Welle 3, macht jede Ankunft planbarer; baut auf P11-Vorschau | - | `ui/vorschau.js`, `sim.js` |
| 10 | **P27 Päckchen liegen** (neu) | Welle 3, voller Hafen wird zur Entscheidung | 1 (Liegeplätze und Wege stabil) | `sim.js`, `boat-view.js`, Wegsuche |

Danach geht es weiter wie in [Abschnitt 5](#5-alles-weitere-bis-zum-ende) beschrieben, bis Stufe 20 und Online.

**Startregel:** 1, 2, 3, 5, 6, 9 laufen. 4 (P17) startet, sobald PR 280 und A10 gemergt sind; Ü16 macht dann P17 statt des Bauen-Threads. 7 und 8 nach 4, 10 nach 1. Nie zwei Threads gleichzeitig an `economy.js`. Alle neuen Meldungen gehen über den einen Meldeplatz aus PR 282.

---

## 4. Berührungspunkte, auf die alle achten

- `web/js/data/economy.js`: Reihenfolge A10, P17 (mit Ü16), P20-Rest, P23 (P19 und 252 sind gemergt). Immer nur einer zur Zeit, danach `node tools/zahlen.mjs --schreiben` und `docs/zahlen.md` mitcommitten.
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
| P22 | Erfolge, läuft | - |

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
| 14 | P59 | Stege umbauen und Varianten wählen | - |
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
| 14.11.2026, 11:45 Uhr | PR 252 und P24 Teil 1 gemergt; A10, P24 Teil 2, P28 und Schicht-Test laufen; P17 startet nach PR 280 und A10 und übernimmt Ü16. |
| 14.11.2026, 11:30 Uhr | P19, P55, P21, P61, C07 erledigt; P24 Teil 1, P22, ruhige Handy-Oberfläche und Feature-Test-Fehler laufen; Bewertungsbefund gestrichen (seit P14 behoben); neue Nr. 9 und 10: P28, P27. |
| 14.11.2026, 10:15 Uhr | PR 244 (P19 Teil 1) gemergt; P19 Teil 2 läuft; Befund Stufe 2 dauert 50 statt 38 Tage ins Balancing-Paket. |
| 14.11.2026, 10 Uhr | Abschnitt 5: alle offenen Vorschläge (F1 bis F42) und Stufe 7 bis 20 in Reihenfolge. |
| 14.11.2026 | Erste Fassung. Roadmap-Status P02, P04, P12, P63, P65 auf "erledigt" nachgetragen. |
