# Havarist einschleppen (P37, F11)

Stand: 22.11.2026. Status: erledigt mit P37.

An manchen Tagen ab Stufe 2 treibt ein Boot mit Schaden vor der Hafeneinfahrt. Der Spieler gibt ihm eine freie Box, ein Helfer schleppt es herein, die Crew verholt die letzten Meter selbst. Dafür gibt es Schlepplohn, einen Anker mehr auf der Bewertung, einen neuen Stammgast und, wenn gebaut, Arbeit für die Werft.

## Was man sieht

1. **Notruf.** Draußen vor der Einfahrt liegt ein Boot quer zum Wind und treibt langsam (höchstens 18 m). Über ihm steht ein rotes Ausrufezeichen, das man antippen kann.
2. **Meldung** im Meldeplatz (`#hm-havarie`, Vorrang 62): „Notruf: „Name“ treibt vor der Einfahrt“, Bootstyp, Länge, Schaden (Motorschaden, Leine in der Schraube, Ruderschaden, Mastbruch), Wünsche, wer schleppt und was es bringt. Knöpfe: „Box B03“ (beste passende Box), „Andere“ (nächste Box, Kamera fliegt hin), „Ablehnen“. Alle passenden freien Boxen leuchten gold, eine leuchtende Box antippen gibt sie ihm ebenso. Ein roter Balken zeigt die Frist.
3. **Schlepp.** Nach der Wahl fliegt die Kamera zum Havaristen. Der Helfer kommt (Seenotretter von ihrer Station, sonst ein Fischer oder das Arbeitsboot von See), gibt eine Leine über und schleppt ihn langsam bis vor die Box. Dort wird die Leine losgeworfen, der Helfer fährt heim, der Havarist verholt sich selbst in die Box.
4. **Fest.** Über dem Boot steigt „Eingeschleppt: +60 €“ auf, mit Werft auch „Die Werft repariert ihn“. Logbuch: „Havarist „Name“ eingeschleppt (Motorschaden)“. Beim Ablegen dankt die Crew im Gästebuch („in Not aufgenommen +1“). Im Tagesabschluss steht der Schlepplohn unter Sonstiges.
5. **Ablehnen oder Frist verpasst.** Ein Helfer aus dem Nachbarhafen holt ihn; ist das im Bild, sieht man, wie er hinausgeschleppt wird. Kein Abzug.

## Regeln (Zahlen in `data/economy.js` unter `havarie`)

| Feld | Wert | Bedeutung |
|---|---|---|
| `abStufe` | 2 | erst ab Stufe 2 (Stufe 1 hat weder Helfer noch Platz) |
| `anteil` | 0,10 bis 0,12 | Anteil der Tage mit Havarist je Stufe (nicht im Winter) |
| `pause` | 3 | mindestens so viele Tage zwischen zwei Havaristen |
| `fruehestens`, `spaetestens` | 0,12 / 0,55 | Zeitfenster im Tag (Anteil der Tageslänge) |
| `frist` | 45 | Sekunden sichtbare Zeit für die Entscheidung (Pause hält sie an) |
| `anker` | 1 | Anker mehr auf der Bewertung des geretteten Boots |
| `schlepplohn` | S 30, M 60, L 90 | Euro beim Festmachen, Quelle „sonstiges“, Detail „havarie“ |

- Ob und wann ein Havarist kommt, würfelt `zufall(seed, tag)` aus Spielstand-Seed und Tag. Kein `Math.random`, die Würfel des Spiels werden nicht verbraucht, alle anderen Abläufe bleiben gleich.
- Angeboten werden nur freie Boxen, in die das Boot passt (`passt` und alle `fit`-Hooks), keine Päckchenplätze. Sortiert nach erfüllten Wünschen, dann nach der knappsten Box.
- Die Box ist ab der Wahl reserviert (`platzZustand` „reserviert“), kein anderes Boot fährt hinein.
- Gerettetes Boot: Gast mit 1 Nacht, Liegegeld wie jedes Boot, sofort Stammgast (Ausnahme von „Stammgast ab dem 2. Besuch“, weil er dem Hafen etwas verdankt), `boat.havarie = { grund, helfer }`, `ratingParts.havarie = 1`.
- Werft gebaut: eine Nacht mehr und der Werft-Dienst offen (bezahlt am Abend wie jeder Werftauftrag).
- Rückfall der Regeln: Ohne Bild (Zeitraffer, Tests) oder nach 360 s Spielzeit ohne Festmachen macht `tickHook` ihn fest. Am Abend: Schlepp läuft noch, dann fest; treibt er noch, dann weg ohne Abzug.
- Ist zum Festmachen keine Box mehr frei (Ausbau hat sie entfernt), endet er als „weg, voll“.

## Helfer

| Fall | Helfer | Tempo Schlepp |
|---|---|---|
| Seenotretter-Station gebaut | Seenotkreuzer der Station (Kopie, das Boot an der Station ist solange weg) | 4 m/s × 1,25 |
| Stufe 2 und 3 | Fischer (Kutter M4-2) von See | 4 m/s |
| ab Stufe 4 | Arbeitsboot (L4-3) von See | 4 m/s |

## Schnittstellen

- Modul `features/havarie.js` (eine MODULES-Zeile) lädt `render/havarie-bild.js` und `ui/havarie-meldung.js` selbst.
- Zustand `state.modules.havarie = { letzter, gerettet, verpasst, heute }`, `heute.phase`: geplant, treibt, zugewiesen, fest, weg. Keine neue `SAVE_VERSION` (nur neue, freiwillige Felder). Nach dem Laden steht der Havarist wieder an seinem Ort, ein laufender Schlepp beginnt neu.
- Ereignis `sim:havarie` `{ phase, boatId, berthId, lohn, werft, helfer, grund, sichtbar, neu }`; dazu `stammgastNeu`.
- `game.havarie`: `heute()`, `plaetze()`, `helfer()`, `zuweisen(platz)`, `ablehnen(grund)`, `festmachen()`, `werft()`, `zahlen()`, `ausloesen()`.
- `game.havarieBild`: `havarist()`, `helfer()`, `leine()` (Anims für Tests).
- Zum Ausprobieren: `?havarie=jetzt` schickt sofort einen Havaristen, zum Beispiel `?stufe=3&havarie=jetzt` oder `?stufe=6&services=alle&havarie=jetzt` (Seenotretter).
- Kleine Eingriffe außerhalb: `sim.js` (Anker in `ratingParts`, `rollWishes` exportiert), `boat-anim.js` (Schlepper und Havarist blockieren sich nicht gegenseitig: `angehaengtAn`), `services.js` (`seenotBoot()`), `rules.js` (`r.havarie`).

## Entscheidungen (selbst getroffen, P37)

- Ab Stufe 2, rund jeder neunte Tag, mindestens 3 Tage Pause. Kein Sturmfaktor (Sturmtage sind schon voll, P24).
- Seenotretter schleppen, sobald die Station steht; sonst Fischer oder Arbeitsboot. Der Spieler wählt den Helfer nicht, er wählt die Box.
- Ablehnen und verpasste Frist kosten nichts. Der Havarist ist ein Angebot, keine Strafe.
- Sofort Stammgast, obwohl Stammgäste sonst erst beim zweiten Besuch zählen.
- Keine Päckchenplätze: Ein manövrierunfähiges Boot legt sich nicht längsseits an ein fremdes.

## Zusammenspiel

- **P31 Gästewünsche, P35 Preisstufe:** Havarist nutzt `rollWishes` und das normale Liegegeld; neue Wunscharten oder Preise gelten automatisch.
- **P38 Hafenfest:** Beide sind Meldungen mit Frist; Havarie (62) geht vor Funk (57), Fest-Meldungen ordnen sich über VORRANG ein.
- **P88 Engstellen:** Schlepper und Havarist fahren mit `route: true` durch die Einfahrt und folgen den normalen Ausweichregeln; untereinander blockieren sie sich nicht.
- **P28 Funk, P32 Flottillen:** Reservierte Box des Havaristen ist für Funk und Flottille belegt. Eine Flottille kann den Hafen so voll machen, dass keine Box frei ist; dann steht das in der Meldung.
- **P27 Päckchen:** ausgeschlossen (siehe oben).
- **P25 Stammgäste:** Eintrag mit `havarie: true` in der Liste, Gästepost wie jeder Stammgast.
- **Ausbau (P59) während des Schlepps:** Fällt die Box weg, endet der Einsatz, der Havarist bekommt beim Festmachen die nächste passende Box oder fährt weiter.

## Prüfungen

- `node --test tests/havarie.test.mjs` (Regeln, Zufall, Speichern, Ausbau, voller Hafen).
- Im Browser gespielt: Stufe 2, 3, 4, 6, Seenotretter, alle 15 Küsten (Ort, Weg, nie über Land), Nacht, voller Hafen, Handy hochkant und quer, PC.
