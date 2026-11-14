# Arbeitsplan

Stand: 14.11.2026, 08:30 UTC, abgeglichen mit `main` bei `b1cf180` (PR 262). Gepflegt vom Thread "Nächste Schritte laufend planen"; nach jedem größeren Merge nachgeführt.

**Wozu diese Datei:** [roadmap.md](roadmap.md) sagt, *was* insgesamt noch fehlt (Pakete P01 bis P82). Dieser Arbeitsplan sagt, *was jetzt gerade* läuft, welche Fehler zuerst weg müssen und welche Pakete als Nächstes starten. [plan.md](plan.md) bleibt der gültige Plan für Vision und Regeln.

**Regeln (Jorven):**

- Fertig heißt spielbar ([abnahme.md](abnahme.md)): Handy und PC, im laufenden Spiel geprüft, mit Randfällen.
- Erst Grundprobleme fixen, dann aufbauen. Neue Features werden mit den alten zusammen geprüft.
- Nichts wartet auf Jorvens Entscheidungen: Threads entscheiden selbst und schreiben die Entscheidung in ihren PR.
- Ein Paket je Thread, ein Branch je Thread, bis zu 20 Threads gleichzeitig. Threads mergen selbst, wenn `bash tests/pruefen.sh` mit "Alles grün." endet.

---

## 1. Was gerade überarbeitet wird

| Thema | Thread | Paket | Stand | PR |
|---|---|---|---|---|
| Boote: Wegsuche mit Korridoren, Anfahrt von außerhalb der Karte, Stau an Bojen und Ankerfeld | "Staus an Bojen und Ankerfeld auflösen" | P66 | läuft; Zonen und Seezugänge sind gemergt (PR 262) | als Nächstes |
| Gelände: Zonen, Seegatt für geschlossene Bodden, kleinere Pflicht-See | "Geländeform und Engpass neu bauen" | P62 | läuft; Zonen für die Wegsuche gemergt (PR 262) | als Nächstes |
| Menüs am Handy kompakter, Verdeckung gemessen | "Menüs am Handy kompakter machen" | P07 (Folge) | PR offen, ohne Konflikt | 261 |
| Leinen ohne Boot, Box-frei-Anzeige beim Ablegen | "Leinen ohne Boot an freien Plätzen beheben" | P66 (Folge) | gemergt (PR 258); Box-frei-Anzeige beim Ablegen noch zu prüfen | 258 |
| Feature-Test: jedes neue Feature einzeln | "Jedes neue Feature einzeln testen" | Prüfung | prüft jeden Merge | - |
| Zeitraffer-Test: ganzes Spiel, alle 10 Küstentypen | "Ganzes Spiel im Zeitraffer durchtesten" | Prüfung | PR offen (Pulk erkennen) | 251 |
| Roadmap-Seite und Bilder | "Roadmap interaktiv im Repo zeigen" | Pflege | läuft stündlich | - |
| Tests für alle Geräte | "Automatische Tests für alle Geräte einrichten" | Werkzeug | läuft | - |

**Offene PRs, die liegen bleiben (Stand 08:30 UTC):**

| PR | Inhalt | Zustand | Was zu tun ist |
|---|---|---|---|
| 244 | P19 Teil 1: Ruf schwerer, Wünsche je Bootsart | Konflikt mit `main`, 21 Commits zurück | Thread "Ruf schwerer machen (P19)" rebased, prüft, merged. Vor P17. |
| 252 | Liegegeld je angefangenem Meter (B10), Winterknöpfe quer | Konflikt mit `main` | eigener Thread rebased und merged; berührt `economy.js` wie 244, darum nacheinander (erst 244, dann 252) |
| 251 | Zeitraffer: Pulk erkennen | ohne Konflikt | Zeitraffer-Thread merged |
| 261 | Menüs am Handy kompakter | ohne Konflikt | Menü-Thread merged |
| 190 | Überblick hochkant schmal, Startansicht folgt der Stufe | veraltet (Tag alt, kein gemeinsamer Stand mit dem jetzigen `main`) | Thread prüft, ob es noch nötig ist; neu auf `main` aufbauen oder schließen |
| 91 | Nebel abgeschwächt | veraltet (zwei Tage alt, kein gemeinsamer Stand); Wetter wurde seitdem neu gebaut (P65) | Ereignisse-Thread prüft am Spiel, ob der Nebel heute noch zu stark ist; sonst schließen |

---

## 2. Bekannte Fehler und Grundprobleme

Priorität A = stört jedes Spiel, vor allem anderen. B = stört sichtbar, vor neuen Features. C = klein oder nur in Randfällen.

| Prio | Fehler | Beleg | Paket / Thread |
|---|---|---|---|
| A | Stau im Hafenbecken ab Stufe 3: je Lauf rund 300 Bootspaare ineinander fest und 430 hängende Boote, 90 % in Stufe 5 und 6 | Zeitraffer-Serie auf `5b00546`, alle 10 Küstentypen (`zeitraffer/2026-11-13-5b00546/vergleich.md` im Projektordner) | P66, Thread "Staus an Bojen und Ankerfeld auflösen" |
| A | Boote noch über Land (rund 21 je Lauf) und durch Stege (rund 17 je Lauf), vor allem Typ 3 und 8 (Flussmündung, Förde) | dieselbe Serie | P66 mit P62 (Zonen, Seegatt) |
| A | Aufstieg langsamer als gerechnet: Ziel Stufe 6 im Mittel an Tag 278 (neueste Messung) bis 296 (Serie `5b00546`) statt 258; Stufe 1 und 2 im Plan, die Lücke wächst gleichmäßig ab Stufe 3 | Zeitraffer-Serien, `tools/balance.mjs` | Balancing-Paket P17 (siehe 3) |
| A | Bewertung: unerfüllter Wunsch bringt weniger Ruf als Abweisen (1 + 4 x erfüllt/alle); Vorschlag 2 + 3 x Anteil. Falscher Anreiz in der Kernschleife | Befund aus P10/P14 | Balancing-Paket P17 (siehe 3), abgestimmt mit P19 |
| B | Dauerlieger-Hinweis am Handy quer vom Morgen-Zettel verdeckt | Befund nach PR 218 | Menü-Thread (PR 261) prüft es mit |
| B | `istWasser` und Bild stimmen am Durchstich nicht überall überein | Messlatte (`feature-tests/messlatte/README.md`) | P62 |
| B | ~~Erststart hängt an jsDelivr (Three.js vom CDN)~~ erledigt (PR 270) | Audit C06 | P61 |
| C | Winter: Rest von H5, G5 | roadmap.md P20 | P20-Rest mit P17 |

Erledigt und in der Roadmap nachgetragen (14.11.): P02, P04 (ein Zähler `state.bigVisits`), P12, P63, P65. Audit C07 (P08-Rest): Rechte je Job, Actions auf SHAs, Secret-Scan und Dependabot, siehe `docs/sicherheit.md`. Audit C05 (`innerHTML`) ist im Code erledigt: `render/services.js` und `ui/input-pc.js` bauen mit `textContent`; die übrigen `innerHTML` setzen nur feste Texte oder SVG. Pflicht bleibt für P44 (Hafenname) ein Test mit präparierten Namen.

---

## 3. Die nächsten Pakete, in dieser Reihenfolge

Leitlinie: Erst muss ein Spiel von Stufe 1 bis 6 ohne Stau und im erwarteten Tempo durchlaufen. Dann machen wir sichtbar, was die Regeln schon tun. Erst dann kommen neue Inhalte.

| Nr | Paket | Warum jetzt | Hängt ab von | Kann kollidieren mit |
|---|---|---|---|---|
| 1 | **P66 Stau im Hafenbecken** (läuft) | Prio A, jedes Spiel ab Stufe 3 betroffen | P62-Zonen (gemergt) | P62, Stegbilder, XXL-Besuche; Zeitraffer misst nach jedem Merge |
| 2 | **Offene PRs 244, 252, 190, 91 auflösen** (bestehende Threads) | liegende Arbeit veraltet weiter und blockiert `economy.js` | - | 244 und 252 beide `economy.js`, `docs/zahlen.md`: nacheinander |
| 3 | ~~**P61 Spiel komplett offline startbar**~~ erledigt (PR 270, Thread "Spiel offline startbar machen") | Grundproblem C06, unabhängig von allem anderen, klein | - | `web/index.html` Importmap (Grundgerüst), Tests leiten Three.js heute per `page.route` um, Pages-Workflow |
| 4 | **P08-Rest: Actions absichern** (erledigt 14.11., siehe `docs/sicherheit.md`) | Audit C07 und Abschnitt 6 des Audits | - | `.github/workflows/` mit Roadmap-Action und Pages |
| 5 | **Balancing-Paket: P17 Aufstieg angleichen und Bewertungsformel** (neu) | Prio A: 20 bis 38 Tage Lücke ab Stufe 3 zwischen Zeitraffer und `tools/balance.mjs`; Bewertung 2 + 3 x Anteil, damit Aufnehmen nie schlechter ist als Abweisen; Rechnung und Zeitraffer müssen danach auf höchstens 5 % übereinstimmen | nach 1 (Stau verfälscht die Messung) und 2 (244, 252 auf `main`) | `economy.js`, `tools/balance.mjs`, `docs/zahlen.md`, Einstieg (J5) |
| 6 | **P55 Versteckte Regeln sichtbar machen** (neu) | Welle 2: Geduldsring, Auslastung, Zeiger am Rand; macht das Spiel lesbar, bevor Inhalt dazukommt | nach 261 (Verdeckung) | `ui/vorschau.js`, `boat-view.js`, Meldungs-Ordnung, Platzschilder |
| 7 | **P21 Logbuch und Hafenchronik** (erledigt, docs/logbuch.md) | Welle 2; `state.logbook` wird gefüllt, aber nie gezeigt (tote Daten) | - | `state.js`, Speichern (`SAVE_VERSION`), Tagesabschluss-Tafel |
| 8 | **P22 Erfolge** (neu) | letztes offenes Welle-2-Paket außer P20-Rest | P21 (Chronik als Anzeigeort) | Aufstieg-Feier, Meldungs-Ordnung |
| 9 | **P24 Ereignisse zum Vorbereiten** (bestehend: Ereignisse-Thread) | erstes Extra aus Welle 3; der Thread kennt den Code | 2 (PR 91 geklärt), 1 | Wetterflagge/Flaggenmast, Tempo-Drossel, Meldungs-Ordnung |
| 10 | **P23 Services mit eigener Wirkung** (neu, der alte Services-Thread ist abgebrochen) | Welle 3, macht Stufe 4 bis 6 tiefer | 5 (Zahlen) | `render/services.js`, `data/services.js`, Besuchswege (P63) |

Danach geht es weiter wie in [Abschnitt 5](#5-alles-weitere-bis-zum-ende) beschrieben, bis Stufe 20 und Online.

**Gleichzeitig laufen höchstens:** die 8 aus Abschnitt 1, plus 3, 4, 6, 7 sofort. 5 und 8 starten, sobald ihre Abhängigkeit gemergt ist. So bleiben wir unter 20 Threads und es arbeiten nie zwei neue Threads an `economy.js` zugleich.

---

## 4. Berührungspunkte, auf die alle achten

- `web/js/data/economy.js`: P19 (244), Balancing (252), P17, P23. Immer nur einer zur Zeit, danach `node tools/zahlen.mjs --schreiben` und `docs/zahlen.md` mitcommitten.
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
| P55, P21, P22 | siehe Abschnitt 3 | F36 Hafenchronik |

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
| 14.11.2026, 10 Uhr | Abschnitt 5: alle offenen Vorschläge (F1 bis F42) und Stufe 7 bis 20 in Reihenfolge. |
| 14.11.2026 | Erste Fassung. Roadmap-Status P02, P04, P12, P63, P65 auf "erledigt" nachgetragen. |
