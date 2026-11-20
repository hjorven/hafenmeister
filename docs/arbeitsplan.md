# Arbeitsplan

Stand: 20.11.2026, 20:10 UTC, abgeglichen mit `main` bei `0925b3e` (PR 348), Statusangaben am Code geprüft. Gepflegt vom Thread "Nächste Schritte laufend planen"; nach jedem größeren Merge nachgeführt.

**Wozu diese Datei:** [roadmap.md](roadmap.md) sagt, *was* insgesamt noch fehlt (Pakete P01 bis P82). Dieser Arbeitsplan sagt, *was jetzt gerade* läuft, welche Fehler zuerst weg müssen und welche Pakete als Nächstes starten. [plan.md](plan.md) bleibt der gültige Plan für Vision und Regeln.

**Regeln (Jorven):**

- Fertig heißt spielbar ([abnahme.md](abnahme.md)): Handy und PC, im laufenden Spiel geprüft, mit Randfällen.
- Erst Grundprobleme fixen, dann aufbauen. Neue Features werden mit den alten zusammen geprüft.
- Nichts wartet auf Jorvens Entscheidungen: Threads entscheiden selbst und schreiben die Entscheidung in ihren PR.
- Ein Paket je Thread, ein Branch je Thread, bis zu 20 Threads gleichzeitig. Threads mergen selbst, wenn `bash tests/pruefen.sh --schnell` mit "Alles grün." endet und der PR-Check grün ist.

---

## 0. Jetzt: Welle 0 bis 2 fertig machen (Jorven, 15.11.2026, 10:52)

Jorven: "Vielleicht sollte erstmal Welle 0-2 fertig gemacht werden" und "Halt so, dass das Grundgerüst fertig ist." Welle 0 bis 2 ist das Grundgerüst. Ab jetzt starten **keine neuen Pakete aus Welle 3 und später**. Was dort schon läuft (P86 Bootsgeschichten, P23-Nacharbeit, P26 Gesten), darf fertig werden, solange es Welle 0 bis 2 nicht blockiert.

Stand 20.11.2026: Welle 0 4 von 6, Welle 1 11 von 12 (P87 erledigt, P54 entfällt), Welle 2 14 von 15. Offen sind diese Pakete:

| Welle | Paket | Was konkret noch fehlt | Thread | Fertig, wenn |
|---|---|---|---|---|
| 0 | **P66 Boote ums Gelände herum führen** | Pulk und "ineinander fest" beim gleichzeitigen Ablegen ab Stufe 5: laut Abnahme-Serie (0f078c3, Typ 1 bis 4) in Stufe 5 und 6 260 bis 980 feste Paare und an 100 bis 155 Tagen ein Pulk, Stufe 1 bis 4 fast im Ziel. Plan des Threads: Einlaufende warten vor der Durchfahrt, solange Auslaufende anstehen (Einbahn-Freigabe nach Richtung). Seit 15.11. kein neuer Stand | "Staus an Bojen und Ankerfeld auflösen" (wieder aufnehmen) | Abnahme-Serie mit den Grenzen aus P87: keine Boote länger als ein paar Sekunden ineinander fest, kein Pulk über mehrere Minuten |
| 0 | **P84 Großschiffwege an allen 15 Küsten** | erledigt (PR 341 Teil 1, Teil 2 im PR dieses Threads): kein Ufer auf 15 Küsten x 3 Seeds; Kreuzfahrtschiff, Korvette, Minenjagdboot verholen mit Schleppern an einen freien Drehkreis; Raddampfer an K01 kommt von vorn, dreht auf freiem Wasser und geht rückwärts an den Kai, legt geradeaus ab (15 Küsten, Handy und PC, 0 Landpunkte). Rest: Kreuzfahrtschiff streift in 3 von 45 Läufen (Küste 4 Seed 1, Küste 7 und 9 Seed 3) beim Einlaufen die eigene Pier P, das Becken ist für 180 m zu eng | "Großschiffe sicher durch alle Küsten führen" | erledigt |
| 1 | **P87 Prüfwerkzeuge auf 15 Küsten und den neuen Takt** | erledigt (PR 338) | - | - |
| 1 | **P85 Zusammenspiel prüfen** | noch nicht gestartet (`docs/zusammenspiel.md` fehlt); Auftrag siehe Abschnitt 3a | drei neue Threads: Teil 1 und 2 sofort, Teil 3 nach P66 und P84 | `docs/zusammenspiel.md` vollständig, alle Funde behoben oder als Paket eingetragen |
| 2 | **P20 Winter mit Inhalt füllen (Rest)** | fertig gebaut in PR 347 (G5 Jahreszeiten, H5 Dauerlieger nutzen den Hafen), seit 15.11. offen mit Konflikt nur in `docs/arbeitsplan.md`; danach Balancing-Messung | Bauen-Thread (wieder aufnehmen) | PR 347 auf `main`, Rechnung und Zeitraffer weiter höchstens 5 % auseinander |

**P85 früher starten:** Die Bereiche Kernschleife und Oberfläche hängen nicht am Pulk. Darum starten "Zusammenspiel 1" und "Zusammenspiel 2" sofort. "Zusammenspiel 3: Welt, Boote, Ereignisse" startet, sobald P66 und P84 gemergt sind und die Abnahme-Serie läuft. Funde zu Booten und Wegen aus 1 und 2 gehen an den Boote-Thread statt selbst gefixt zu werden.

**Wenn alle fünf erledigt sind,** ist Welle 0 bis 2 fertig; dann geht es mit Abschnitt 3 und 5 weiter.

---

## 1. Was gerade überarbeitet wird

Stand 20.11.2026, 20:10 UTC. Seit dem 15.11. mittags ist nichts mehr gemergt worden außer P87 (PR 338), P86 (PR 342) und Testpflege (PR 344, 348); die Threads sind stehen geblieben. Drei fertige PRs warten:

| PR | Paket | Zustand | Was zu tun ist |
|---|---|---|---|
| 347 | P20-Rest (G5, H5) | Konflikt nur in `docs/arbeitsplan.md` | Bauen-Thread wieder aufnehmen: auf `main` bringen, prüfen, mergen, danach Balancing-Messung |
| 346 | Logbuch-Test unter Last, Meldungen im Meldeplatz | ohne Konflikt | Logbuch-Thread wieder aufnehmen: prüfen, mergen |

Ohne PR: P66 Pulk-Fix (Boote-Thread, letzter Stand 15.11. 05:34: Einbahn-Freigabe an der Durchfahrt geplant), Abnahme-Serie Welle 0 (Zeitraffer, Typ 1 bis 4 gemessen, Typ 5 bis 15 offen).

---

## 2. Bekannte Fehler und Grundprobleme

Priorität A = stört jedes Spiel, vor allem anderen. B = stört sichtbar, vor neuen Features. C = klein oder nur in Randfällen.

| Prio | Fehler | Beleg | Paket / Thread |
|---|---|---|---|
| A | Pulk und "ineinander fest" beim gleichzeitigen Ablegen, vor allem Stufe 5 (Offene Bucht, Seed 11); mit dem 5-Minuten-Tag legen mehr Kurzhalter gleichzeitig ab | PR 327 "Noch offen", Härtetest 15.11. (Hinweis), Zeitraffer-Zwischenserie | P66, "Staus an Bojen" |
| A | Welle-0-Abnahme fehlt: Zeitraffer-Serie über alle 15 Küsten nach dem Pulk-Fix | Abschnitt 3a | P66, Zeitraffer-Thread |
| B | Raddampfer (XL) an K01 fährt beim Einlaufen über die Westmole und beim Auslaufen über die Kaikante (Handy, mehrere Küsten) | Härtetest 15.11. nach P87, Nahbilder `handy-alle-einfahren-nah-land-1.jpg`, `handy-alle-ablegen-nah-land-1.jpg` in `/mnt/project-files/extremtest/2026-11-15-5dce72f-p87/handy/bilder/` | P84, erledigt 20.11. |
| B | Gäste liegen ab Stufe 4 kaum sichtbar an einer Warteboje (nachgemessen nach PR 327 bis 332: Stufe 4 und 6 am PC 0 an der Boje). Ursache jetzt: `selfEnter` in `sim.js` zählt als Andrang (mehr als die Hälfte der Bojen vergeben) auch Boote, die noch Minuten draußen auf See anfahren; darum fahren die ersten im Revier direkt aus der Anfahrt ein. Vorschlag: Andrang nur aus Booten im Revier oder an der Boje zählen | Härtetest 15.11. nach P87 (`bojen-erreichbar`, misst jetzt an Boje / direkt bei Andrang / unterwegs getrennt), docs/extremtest.md | P66, "Staus an Bojen" |
| B | ~~`tools/stegbilder/erzeugen.mjs` findet seit den Doppelboxen keine Variante mehr~~ erledigt: Generator zählt Doppelboxen nicht mehr mit, prüft Stufe 6 mit Yachtsteg, die 12 Stegbilder bleiben | Hinweis in PR 329 | P83 erledigt |
| erledigt | Rechnung und Bild des Geländes wichen an drei Stellen um mehr als eine Rasterzelle ab (Riss Stufe 6 bei Plan-y 196, Sandbank Küste 3, Landpunkt Küste 10). Behoben in der Geländeformel, dazu zwei weitere Stellen (Keil neben der Kaifläche Küste 5, Pfütze hinter der Nehrungsstraße Küste 1). Das Werkzeug meldet über 15 Küsten und Stufe 3 bis 6 keine Abweichung mehr; Entscheidung in docs/landschaft.md "Rechnung und Bild stimmen überein" | `node tools/zeitraffer/wasserbild.cjs --kuesten 1-15 --stufen 3-6` | Gelände-Thread |
| C | ~~Winter: Jahreszeiten steuern nur Ereignisse (G5); Dauerlieger nutzen Kran und Segelmacher nicht (H5-Rest)~~ erledigt 15.11. | Code: `jahreszeiten` nur in `data/events.js` | P20-Rest |

Erledigt seit 14.11.: Großschiffe berühren auf keiner Küste mehr Land (P84), Menschen auf festen Koordinaten (PR 316), L-Boote ragen auf den Steg, XL-Raddampfer an K01, Korvette auf Küste 4 (alle PR 329), XXL-Logbuch nie erreicht (PR 323), Aufstieg weicht von der Rechnung ab (P17, PR 331: Rechnung Tag 103, Zeitraffer 99 bis 102), Box bleibt bei Abreise unterwegs belegt (PR 327), Kurzhalter legen vor dem Festmachen ab (PR 332). Früher erledigt: Fehler aus Jorvens Feature-Test (PR 290), C05, C06 (P61), C07, P02, P04, P12, P63, P65.

---

## 3. Die nächsten Pakete, in dieser Reihenfolge

Leitlinie: Erst Welle 0 abschließen und die Prüfwerkzeuge auf den neuen Stand bringen, dann das Zusammenspiel prüfen. Daneben Pakete, die wenig Dateien teilen. `economy.js`: P23 und P20-Rest sind fertig, als Nächstes P34 oder P31.

| Nr | Paket | Warum jetzt | Hängt ab von | Kann kollidieren mit |
|---|---|---|---|---|
| 1 | **P66 Pulk beim Ablegen** (läuft) | Prio A, letzter Rest von Welle 0 | - | `render/boat-view.js`, `boat-anim.js`, Päckchen (Ablegereihenfolge), Kurzhalter |
| 2 | ~~P84 Großschiffwege an allen 15 Küsten~~ erledigt 20.11. (PR 341 und Teil 2) | Rest aus PR 329, gehört zu Welle 0 | - | `render/services-besuch.js`, `boat-view.js`, `boat-anim.js` |
| 3 | ~~**P87 Prüfwerkzeuge auf 15 Küsten und den neuen Takt**~~ erledigt (PR 338) | Welle-0-Abnahme braucht Tests, die alle Küsten kennen; Härtetest nach PR 327 bis 332 neu | - | nur `tests/`, `tools/zeitraffer/`, `feature-tests/` |
| 4 | ~~**P83 Stegbild-Generator reparieren**~~ (erledigt 15.11., PR 336) | ohne ihn keine neuen Stege (P70) und kein Neuerzeugen nach Platzänderungen | - | `tools/stegbilder/`, `data/stegbilder.js` (Ausgabe muss für bestehende Spielstände gleich bleiben), `data/liegelage.js` |
| 5 | ~~P23 Services mit eigener Wirkung~~ erledigt (15.11.) | Dienste, Trailerboote, Abendgäste, Tagesgäste, Wahlplätze, Bilanz; Rechnung weiter 103 Tage | - | `economy.js` ist frei für P20-Rest |
| 6 | **P86 Bootsgeschichten fertig erzählen** (Thread wartet) | kleine Lücken, die Jorven im Spiel sieht (Regatta ohne Startsignal und Sieger) | - | `geschichten/`, `render/boat-view.js` (Regattabahn), Logbuch, `audio.js` |
| 7 | **P03-Rest J5** (erledigt 15.11.) | Ruf am ersten Abreisenden erklären, Einstieg damit fertig | - | `features/einstieg.js`, Meldeplatz |
| 8 | ~~P20-Rest Winter (G5, H5)~~ erledigt (15.11.) | Jahreszeiten wirken auf Ankünfte und Wind, Dauerlieger als Kunden von Kran, Werft, Segelmacher, Winterlager; Rechnung 105 Tage | 5 | `economy.js` frei für P34 oder P31 |
| 9 | **P85 Zusammenspiel nach Welle 0 prüfen** (drei Threads) | Jorvens Auftrag vom 14.11. | 1, 2, 3 und Abnahme-Serie | `docs/zusammenspiel.md`, kleine Fixes je Fund |
| 10 | **P34 Wind im Hafen** oder **P31 Neue Gästewünsche** | nächste Tiefe für die Kernschleife | 5, 8 (`economy.js`) | `sim.js`, `economy.js`, Wünsche aus P19 |

Danach geht es weiter wie in [Abschnitt 5](#5-alles-weitere-bis-zum-ende) beschrieben, bis Stufe 20 und Online.

**Startregel (seit 15.11., 10:52):** Nur Welle 0 bis 2, siehe Abschnitt 0. 1, 2, 3, 8 laufen; 9 startet mit Zusammenspiel 1 und 2 sofort, Zusammenspiel 3 nach 1 und 2; 6 darf fertig werden; 10 und alles aus Abschnitt 5 erst, wenn Welle 0 bis 2 fertig ist. Nie zwei Threads gleichzeitig an `economy.js`. Alle neuen Meldungen gehen über den einen Meldeplatz aus PR 282.

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

- `web/js/data/economy.js`: als Nächstes P34 oder P31 (P17, P19, P20, P23, 252 und A10 sind gemergt). Immer nur einer zur Zeit, danach `node tools/zahlen.mjs --schreiben` und `docs/zahlen.md` mitcommitten.
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
| 6 | P34 | Wind im Hafen spürbar, Windseite, Anlegen gegen den Wind | F5, F35 |
| 7 | P31 | Neue Gästewünsche (WLAN, Waschmaschine, Frischwasser, Absaugstation, Brötchen) | F9 |
| 8 | P30 | erledigt (PR 297; Wasser kommt mit P31) | F8 |
| 9 | P35 | Preisstufe am Hafenbüro | F6 |
| 10 | P32 | Flottillen | F3 |
| 11 | P25 | Stammgäste mit Wirkung, Gästepost | F37 |
| 12 | P29 | Baggern für tiefere Liegeplätze | F7 |
| 13 | P36 | Bojenfeld im See | F10 |
| 14 | P59 | erledigt (Doppelboxen PR 321, Yachtsteg PR 326) | - |
| 15 | P26 | erledigt (PR 322) | - |
| 15a | P86 | Bootsgeschichten fertig erzählen (Regatta-Start und Sieger, Gepäck, Tanksteg) | - |
| 16 | P37 | Havarist einschleppen | F11 |
| 17 | P38 | Eigenes Hafenfest | F12 |
| 18 | P39 | Jugendtraining am Segelclub | F13 |
| 19 | P40 | Seltene Besucher (nach P21) | F16 |

### Abschnitt C: Langzeit, Spielgefühl, Welt (Welle 4)

| Paket | Inhalt | Vorschläge |
|---|---|---|
| P41 | erledigt (PR 315) | F19, F20 |
| P44 | Hafenname und Flagge (mit Test gegen präparierte Namen, Audit C05) | F23, F27 |
| P50 | erledigt (Einstellungen im Menü) | F25 |
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

Schon erledigt aus Jorvens Vorschlägen: F1, F2, F4, F8, F14, F15, F17, F18, F19, F20, F25, F26, F27 (Grundgerüst), F28, F36.

---

## 6. Verlauf

| Datum | Änderung |
|---|---|
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
