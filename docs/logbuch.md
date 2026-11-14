# Logbuch und Hafenchronik

Stand: 14.11.2026. Status: gebaut (Paket P21, Roadmap: Logbuch mit Bild, F36 Hafenchronik, I5 Sammelalbum mit Schattenrissen).

## Was der Spieler sieht

**Logbuch, Reiter "Boote".** Jedes Bootsmodell, das einmal im Hafen angelegt hat, steht mit einem Pixelbild im Logbuch. Oben steht der Stand ("32 von 89 Bootsmodellen, 10 von 19 Arten") mit Balken, darunter die Größen S, M, L, XL und XXL als Reiter mit Zählern. Je Bootsart ein Abschnitt mit ihren Modellen als Karten:

- gesehen: farbiges Bild, Name, Tag des ersten Besuchs; neu seit dem letzten Öffnen mit goldenem Schild "neu"
- noch nicht gesehen: Schattenriss, "???" und ein Hinweis ("Kommt ab Stufe 5", "Noch nicht gesehen", "Kommt mit einem eigenen Anleger", "Liegt ab Stufe 2 fest im Hafen"). Eine Art, die in der aktuellen Stufe noch gar nicht kommen kann und von der noch nichts gesehen wurde, heißt "Unbekannte Bootsart".
- Antippen einer gesehenen Karte öffnet den Steckbrief: großes Bild, Name, Bootsart und Größe, Maße, Bauform (falls in den Bootsdaten beschrieben), wann und mit welchem Boot es zuerst kam ("Zuerst am Tag 12 (Stufe 3): „Möwe“ aus Kappeln."). Mit Pfeilen (am PC auch Pfeiltasten) blättert man durch die gesehenen Boote derselben Größe.

**Logbuch, Reiter "Chronik".** Jeden Abend schreibt der Hafenmeister eine Zeile über den Tag: was neu im Logbuch ist, was gebaut wurde, Aufstieg, Ereignis (Sturm, Regatta ...), neue Stammgäste, geschaffte Tages- und Wochenziele, bester Tag. Darunter die Zahlen (angelegte Boote, Einnahmen, Ruf). Die Chronik ist nach Stufen in Kapitel geteilt, neueste oben; zuerst steht nur das laufende Kapitel, "Frühere Kapitel zeigen" holt ältere dazu. Ruhige Wintertage werden zu einer Zeile "Tag 91 bis 120 · Winterpause" zusammengefasst. Was der laufende Tag schon erlebt hat, steht oben als "Heute".

**Meldung "Neu im Logbuch".** Legt ein neues Modell an, erscheint rechts oben unter Übersicht und Menü eine kleine Meldung mit Bild ("Neue Bootsart" oder "Neu im Logbuch" und der Name). Kommen mehrere auf einmal (Morgen, 8x), fasst eine Meldung sie zusammen ("5 neu im Logbuch"). Sie folgt der Meldungs-Ordnung (Vorrang 22, nach Einführung, Tageszielwahl, Tagesabschluss und Dauerliegern) und wartet, bis sie dran ist. Antippen öffnet den Steckbrief.

**Tagesabschluss.** Die Karte am Abend zeigt den wichtigsten Satz des Tages aus der Chronik; antippen öffnet die Chronik.

**Öffnen.** Menü "Logbuch" (mit Zahl der neuen Einträge), Meldung antippen, Zeile im Tagesabschluss, am PC Taste `J`. Schließen: X, `Esc` (im Steckbrief erst zurück zur Liste), daneben tippen.

Am Handy hoch ist das Logbuch ein Blatt von unten (zwei Karten nebeneinander, Titel weg, damit die Reiter Platz haben); am Handy quer ein flaches Fenster mit kleineren Bildern.

## Bilder

`web/js/ui/logbuch-bild.js` rendert jedes Modell aus seinem echten 3D-Modell (`game.boatTypes.<größe>.buildBoat`, Farbsatz 0, Segel eingeholt) in einen kleinen Zwischenspeicher von 84 x 44 Pixeln ohne Kantenglättung: schräg von Steuerbord und von oben, Bug nach rechts, unter Wasser abgeschnitten, so eng wie möglich eingerahmt. Danach bekommt das Bild einen Tintenrand und einen Wasserstrich, wie die Pixel-Symbole. Der Schattenriss ist derselbe Umriss in einer Farbe. Gerendert wird erst, wenn eine Karte sichtbar wird, höchstens 12 ms je Bild, Ergebnis im Speicher. Ohne WebGL gibt es den Umriss von oben aus der Vorschau (`ui/vorschau.js`).

## Daten

Datei `web/js/ui/logbuch-daten.js` (ohne Browser, Tests `tests/logbuch.test.mjs`).

- `state.logbook` (schreibt `sim.js` beim Anlegen): Bootsart -> Liste der Modell-IDs. Ereignis `logbookNew { typeId, modelId, boatId }`.
- `state.modules.logbuch`:
  - `erst: { [modellId]: { tag, stufe, boot?, hafen? } }`
  - `chronik: [{ tag, stufe, angelegt, gaeste, summe, ruf, rekord?, winter?, merk: [...] }]`, höchstens 2.000 Tage
  - `offen: [{ t, ...merkmal }]` Merkmale, deren Tag noch keine Zeile hat
  - `ungelesen: [modellId]`, `ab`: Tag, ab dem die Chronik geführt wird
- Merkmale: `neu`, `stufe`, `region`, `bau`, `ereignis`, `stamm`, `ziel`, `woche`, `start`, `text` (freier Satz, siehe unten).

Zu welchem Tag ein Ereignis gehört: Die Spielregeln melden die Ereignisse eines Ticks gesammelt, `state.day` ist dann schon weiter. `verarbeite()` liest es aus der Reihenfolge (vor `dayEnd` Tag N: Tag N; vor `dayStart` Tag N: Tag N - 1; fest liegende Boote am Morgen: Tag N). Die Zeile eines Tages wird zu Beginn des Abends geschrieben (`dayEnd`); was abends noch geschieht, kommt in dieselbe Zeile. Die Oberfläche sammelt die Ereignisse eines Ticks und verarbeitet sie zusammen.

## Speichern

`SAVE_VERSION` 3 (`web/js/save/storage.js`). `MIGRATIONS[2]` legt `modules.logbuch` an: Was schon im Logbuch steht, bleibt (ohne Tag, im Steckbrief "Schon vor dem Logbuch im Hafen gewesen"). Die letzten 30 Tage aus `stats.verlauf` werden als Chronik nachgetragen, Aufstiege aus `modules.aufstieg.chronik` dazu; davor steht eine Zeile "Tag 1 bis N, vor dem Logbuch". `state.js` säubert beim Laden `logbook` (nur Listen aus Text), `saeubern()` den Rest.

## Schnittstelle (für P22 Erfolge und andere)

`game.logbuch = { oeffnen(reiter?, modellId?), schliessen(), offen, fortschritt(), chronik(), tagesSatz(tag), merken(merk) }`

- Ein Erfolg schreibt sich so in die Chronik des Tages: `game.logbuch.merken({ a: 'text', art: 'erfolg', text: 'Erfolg: Hundert Gäste' })`.
- `fortschritt()` liefert `{ gesehen, gesamt, arten, artenGesamt, je: { S: { gesehen, gesamt } ... } }`, zum Beispiel für einen Sammel-Erfolg.
- Ereignis `logbuch:neu { key, typeId, modelId, art }` für jedes neue Modell (art: ganze Bootsart neu).

## Wo es mit anderen kollidieren kann

- **Neue Bootsmodelle** (Schiffs-Threads, Welle 6) erscheinen von selbst, solange sie in `data/boats/*.js` stehen und über `sim.js` anlegen. Ein Modell, das nie über `moor()` anlegt (zum Beispiel ein Schiff, das nur als Kulisse fährt), bliebe für immer ein Schattenriss: Dann gehört es nicht in `MODELS`, oder es muss anlegen.
- **XXL** (Kreuzfahrt, Marine, Seenotkreuzer) kommen nur mit ihren Anlegern (`unlock`). Ob alle 9 XXL-Modelle wirklich anlegen, prüft am besten der Zeitraffer-Thread über eine ganze Partie.
- **Meldungen rechts oben**: Gästebuch (20) und Logbuch (22) stehen an derselben Stelle, die Meldungs-Ordnung zeigt immer nur eine.
- **Tasten**: `J` Logbuch, `N` Gästebuch (vorher `G`, das aber auch 8x schaltet; beides zugleich war ein Fehler).
- **Speicherversion**: Welle 6 (P73) plant jetzt Version 4 statt 3.
- `sim.runDay()` gibt jetzt auch die Ereignisse des Tagesbeginns zurück (fest liegende Boote, Logbuch); vorher fielen sie in Tests unter den Tisch.
