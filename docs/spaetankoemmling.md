# Spätankömmling

Stand: 22.11.2026, Paket P53 (F40). Status: erledigt.

## Was der Spieler sieht

- An manchen Saisonabenden (etwa jeder dritte, ab Tag 3 und ab Stufe 2, nicht am letzten Tag vor dem Winter) kommt das letzte Boot des Tages erst nach Sonnenuntergang. Es ist kein zusätzliches Boot: Er ist eines der Boote des Tages und kommt nur später; der späte Nachmittag ist dann etwas ruhiger. In der Vorschau steht er ganz hinten mit einer Uhrzeit nach 19 Uhr.
- Er taucht kurz nach Beginn des Abends draußen auf und läuft im Dunkeln ein. Sobald er im Revier oder im Bild ist, steht eine kurze Meldung im Meldeplatz: "Spätankömmling. Kleinkreuzer „Gischt“ läuft im Dunkeln ein und sucht noch eine Box." Ein Glockenschlag dazu. "Zeigen" fährt die Kamera zu ihm.
- Am Bug leuchtet eine Taschenlampe: Ein warmer Lichtkegel schwenkt langsam über das Wasser, die Crew sucht die Einfahrt und die Box. Dazu Positionslichter, rot an Backbord, grün an Steuerbord, weiß am Heck (kommen aus den Signalflaggen, P49; ohne P49 zeichnet dieses Paket sie selbst).
- Zuweisen wie immer: an die Boje, in eine Box ziehen, oder er fährt nach 8 Sekunden an der Boje selbst in eine freie Box. An der Box, in die er fährt, liegt ein warmer Lichtschein auf dem Wasser (der Hafenmeister wartet mit der Lampe), bis das Boot fest ist.
- Liegt er fest, brennt in der Kajüte Licht, bis es hell wird.
- **Die Nacht wartet auf ihn.** Solange er noch unterwegs ist und eine passende Box frei ist, bleibt es kurz vor dem Morgen dunkel (etwa 23 Uhr): Die Spielzeit läuft weiter, nur der Morgen kommt später, höchstens 90 Sekunden Spielzeit (bei 3x also 30 Sekunden echte Zeit). Ist er fest, wird es in wenigen Sekunden hell.
- Bekommt er noch in der Nacht eine Box, gibt er einen Viertel Anker mehr; im Gästebuch steht "nachts noch aufgenommen" und ein Dank ("Spät in der Nacht noch eine Box bekommen. Danke!").
- Ist keine passende Box frei, wartet er wie jeder andere über Nacht an der Boje (Bojengeld) und bekommt morgens als Erster eine Box. Dann hält die Nacht nicht an.

## Entscheidungen (Jorven antwortet nicht, Thread entscheidet selbst)

| Frage | Entscheidung | Warum |
|---|---|---|
| Zusätzliches Boot oder eines des Tages? | eines des Tages (das letzte, wenn es ein passender Übernachter ist) | Aufstieg und Zeitraffer-Rechnung bleiben gleich, keine neue Stellschraube |
| Welche Boote? | Segelyachten, Motorboote, Motoryachten, Mehrrumpfboote | Kein Ruderboot, Tretboot oder Jolle im Dunkeln, kein großes Schiff. In Stufe 1 gibt es deshalb noch keinen Spätankömmling |
| Wie wird es Nacht genug? | Die Nacht hält an, solange er unterwegs ist | Der Abend dauert 30 s, die dunkle Zeit nur wenige Sekunden. Ohne Halt sähe man das Einlaufen nie |
| Was, wenn er nicht hineinkommt? | Höchstens 90 s Halt, ohne freie Box gar keiner | Nichts darf hängen bleiben, kein Warten auf etwas, das nie kommt |
| Belohnung | ein Viertel Anker, keine Geldprämie | Er zahlt Liegegeld wie jeder Gast, die Münze kann man nachts einstreichen. Die Nacht soll Stimmung sein, keine Pflicht |
| Auswahl | Hash aus Seed und Tag | Verbraucht keinen Spielzufall, Spielstände und Balancing bleiben gleich |

## Ausprobieren

- `https://hjorven.github.io/hafenmeister/?stufe=3&spaet=jetzt` plant für heute einen Spätankömmling (die übrigen Boote des Tages fallen dafür aus) und spult bis kurz vor den Abend.

## Technik

- Zahlen: `ECONOMY.spaetankoemmling` in `web/js/data/economy.js` (`abTag`, `anteil`, `ankunft`, `arten`, `rest`, `haltMax`, `anker`), Regeln als `rules.lateArrival`.
- Regeln in `web/js/sim.js`: `planLateArrival` (in `startDay`, nach den Modulen, vor der Herkunft) nimmt nur das letzte Boot der Liste (sonst entstünde eine Lücke im Tageslauf, Test "Kein Fließband" in `tests/spieltag.test.mjs` lässt am Ende dafür einen Abstand mehr zu) und setzt `boat.spaet = Tag` und `arriveAt` in den Abend. Am Tagesende bleiben Spätankömmlinge in `state.upcoming`; `lateArrivalStep` lässt sie abends einlaufen und verlängert den Abend über `state.nachtHalt`, solange `lateArrivalPending` gilt. `eveningEnd(state, ctx)` ist das Ende des Abends mit Halt, `displayClock(state)` die Uhr für Licht und Tagesbalken (steht im Halt still). `night()` setzt `nachtHalt` auf 0.
- Fest: Mit 3D-Ansicht setzt `moor()` `boat.spaetFest = false`; `bridge.js` meldet über `'boat:moored'` an `sim.lateDocked`. Nach dem Laden gilt er als fest (`settleWaiting`).
- Bewertung: `ratingParts().spaet` aus `boat.spaetDank` (in der Nacht festgemacht). Gästebuch: Pluspunkt `spaet`.
- Ereignisse: `'sim:lateArrival' { boatId }`, `'sim:nightHold' { boatId }` (erster Halt der Nacht), `'sim:moored'` mit `spaet: true`, `'spaet:gemeldet' { boatId }`.
- Bild und Meldung: `web/js/features/spaetankoemmling.js` (eine Zeile in `main.js`), Text in `features/spaetankoemmling-text.js`. Meldung `#hm-spaet`, Vorrang 52. Lampe, Positionslichter und Kajütlicht hängen am Bootsmodell (`userData.signal`, ohne Strahltest), der Schein an der Box liegt frei in der Szene.
- Schnittstelle: `game.sim.spaet()`, `game.sim.spaetUnterwegs()`, `game.sim.nachtHalt()`; `game.spaet = { boot(), unterwegs(), lampe(id), kajuete(id), schein(), meldung(), zeigen() }`.
- Tests: `tests/spaetankoemmling.test.mjs` (Regeln), `tests/specs/spaetankoemmling.spec.mjs` (im Browser).

## Zusammenspiel und mögliche Kollisionen

- **Ruhiger Abend (P46):** Lichterketten gehen erst an, wenn alle bezahlt haben und niemand wartet, für den eine Box frei ist. Kommt der Spätankömmling, nachdem sie schon brennen, bleiben sie an (so steht es in `stimmung.md`): Er läuft in den erleuchteten Hafen ein. Wartet er noch mit freier Box an der Boje, gehen sie erst an, wenn er liegt und die Münze eingestrichen ist.
- **Positionslichter (P49, PR 433):** P49 zeichnet Positionslichter an jedem fahrenden Boot in der Dunkelheit. Ist `game.signalflaggen` da, zeichnet dieses Paket keine eigenen, damit nichts doppelt leuchtet.
- **Tagesabschluss:** `'sim:dayEnd'` kommt erst nach dem Halt; der Tagesbericht zählt den Spätankömmling als angelegt. Wer den Abschluss abends sehen will, sieht ihn etwas später.
- **Uhr und Tageslicht:** `landscape.js`, `hud.js` und `game.sim.tagesAnteil()` rechnen mit der Uhr ohne Halt. `people.js` und `hafentiere.js` lesen `state.clock` direkt und sehen im Halt "Nacht" (Anteil 1), das passt.
- **Vorspulen (`fastForward`):** springt höchstens bis zum Ende des Abends mit Halt (`eveningEnd`).
- **Funk-Anmeldung (P28):** Der Spätankömmling kann sich morgens per Funk anmelden; seine frei gehaltene Box verfällt am Abend nicht, er fährt direkt hinein.
- **Hafenbüro mit Automatik:** weist ihn wie jedes Boot zu, dann geht es schneller.
- **Hafenhund (P51):** schläft nachts und begrüßt den Spätankömmling nicht, gewollt (`hafentiere.md`).
- **Zeitraffer:** Die Boote des Tages bleiben dieselben, nur einer kommt später. Ohne Spieler ist der Hafen abends oft voll; dann wartet er über Nacht an der Boje.
