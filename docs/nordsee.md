# Nordsee mit Ebbe und Flut (P57)

Stand: 28.11.2026. Status: **Teil 1 gebaut** (Gezeiten in den Spielregeln, Revierfaktoren). Die übrigen Teile sind in Arbeit, siehe Abschnitt 5. Die Nordsee ist für Spieler noch nicht zu erreichen (nur `?revier=nordsee&stufe=n` zum Ausprobieren), bis Teil 5 (Freischalten und Seekarte) gemergt ist.

Ergänzt [regionen.md](regionen.md) (Aussehen der Reviere) und Abschnitt 9 im [Spielplan](plan.md). Roadmap: P57, Punkte K2 bis K6.

## 1. Die Idee

Die Nordsee ist der zweite Durchgang: ein neuer Hafen vom Bootssteg bis zum Seehafen, aber mit Ebbe und Flut. Der Hafen liegt hinter einem Priel im Watt. Ob ein Boot hinein- oder hinauskommt, hängt vom Wasserstand ab. Man sieht das Wasser steigen und fallen, Boote warten vor der Zufahrt auf die Flut und laufen dann nacheinander ein. Rechnen muss niemand: Das Spiel sagt, ab wann ein Boot einlaufen kann.

## 2. Regeln (gebaut)

Code: `web/js/features/gezeiten-regeln.js` (ohne DOM, auch für Tests und Balancing), im Browser `web/js/features/gezeiten.js`. Zahlen: `ECONOMY.nordsee` in `web/js/data/economy.js`, Übersicht in [zahlen.md](zahlen.md). Alles wirkt nur in einem Hafen mit `state.region === 'nordsee'`; die Ostsee bleibt Zahl für Zahl gleich (Test in `tests/gezeiten.test.mjs`).

**Wasserstand.** Meter über Seekartennull (mittleres Niedrigwasser). Die Tiefen der Hafendaten gelten bei Niedrigwasser, wie auf einer Seekarte. Gerechnet wird aus der Uhrzeit im Spiel (Tag 6:30 bis 19:00, Abend bis 22:00, kurze Nacht):

```
w(h) = hub/2 + hub/2 * spring(h) * cos(2 * PI * (h - hochwasserTag1) / periodeStunden)
spring(h) = 1 + springFaktor * cos(2 * PI * (h / 24) / springNippTage)
```

`h` sind die Stunden seit Tag 1, 0:00 Uhr. Mit 12,42 Stunden kommt jedes Hochwasser rund 50 Minuten später als am Vortag, wie an der echten Küste. Jeder Spieltag hat mindestens ein Hoch- und ein Niedrigwasser bei Tageslicht. Bei Springtide fällt das Wasser etwas unter Seekartennull, bei Nipptide bleibt es darüber.

**Zufahrt.** Priel durchs Watt, ab Stufe 3 Fahrrinne und Schleuse. Ihre Tiefe bei Niedrigwasser steht je Stufe in `nordsee.zufahrt`. Ein Boot kommt hindurch, wenn

```
zufahrt + w >= Tiefgang + 0,3 m
```

| Fall | Was passiert |
|---|---|
| Ankommendes Boot, zu wenig Wasser | Grund `tide` beim Zuweisen ("Ebbe: ... läuft ab etwa 14:20 Uhr ein"), es wartet an der Boje. Seine Geduld läuft nicht ab, solange es auf die Flut wartet, und beginnt neu, sobald die Zufahrt offen ist. Dann fährt es wie immer nach kurzer Zeit selbst in eine freie Box, die Wartenden nacheinander. |
| Alle Bojen belegt | Wer auf die Flut wartet, ankert im Ankerfeld, statt abzudrehen (Hook `hold`). |
| Abreise am Vormittag | Ablegen erst, wenn genug Wasser da ist (Hook `departAt`). Die Box bleibt so lange belegt. Gibt es bis kurz vor Abend kein Fenster mehr, legt das Boot zum höchsten Wasser des Tages ab. |
| Kurzhalter | bleiben in der Box, bis sie hinauskommen (spätestens nachts wie immer). |
| Tagestörn | Hinaus und zurück im Tidenfenster, mindestens ein Viertel Tag draußen; passt das nicht, bleibt das Boot heute im Hafen. |
| Skipper planen | 75 % der Boote, deren Ankunft bei zu wenig Wasser läge, tauschen ihre Ankunftszeit mit einem Boot, das dann hindurch kann (`planen`). Der Tageslauf bleibt gleich dicht. |
| Liegende Boote, Umlegen, feste Plätze, Havarist, Optis, seltene Besucher, Großschiffe | betrifft die Zufahrt nicht (Havarist im Schlepp, Optis über den Slip, Besucher und Großschiffe haben eigene Abläufe). |

Das Grün-Rot-Schild einer Box bleibt bei Ebbe grün: Die Box ist frei, nur die Zufahrt ist zu.

**Revierfaktoren** (Hook `modifiers`): Hafengeld mal 1,15, Ankünfte mal 0,9, mehr Kutter und Mehrrumpfboote, weniger Kielyachten.

**Neue Hooks in `sim.js`** (allgemein, auch für andere Pakete): `hold` (ankommendes Boot wartet auf etwas, ankert bei vollen Bojen) und `departAt` (Ablegezeit verschieben). Beschreibung bei `addHook`.

## 3. Ausprobieren

```
http://localhost:8000/?revier=nordsee&stufe=2
```

Im Testmodus (`?stufe=n`) gilt `?revier=nordsee` jetzt auch für die Spielregeln. In der Browser-Konsole: `hafenmeister.gezeiten.scheitel()` (Hoch- und Niedrigwasser heute), `hafenmeister.gezeiten.wasserstand()`.

Balancing:

```bash
node tools/balance.mjs --laeufe 10 --revier nordsee
```

Messung 28.11.2026 (10 Läufe, geschickt): Nordsee 101 Tage bis zum Abschluss, Ostsee 103. Einnahmen bis Tag 30 höher (Hafengeld mal 1,15), der Aufstieg gleich lang.

## 4. Entscheidungen (P57, selbst getroffen und notiert)

| Frage | Entscheidung | Warum |
|---|---|---|
| Was ist die Kernregel der Tide (K2)? | Die Zufahrt, nicht der Liegeplatz. Liegeplätze behalten ihre Tiefe bei Niedrigwasser, Kielyachten liegen also nie trocken. | Wie im echten Sielhafen hängt alles an der Barre im Priel. So bleibt die Passregel der Box gleich, und man sieht die Tide an den wartenden Booten. |
| Ein oder zwei Hochwasser je Tag? | Echte Tide mit 12,42 Stunden auf die Uhrzeit im Spiel | Bei 12,5 Stunden Tageslicht gibt es jeden Tag mindestens ein Hochwasser, das jeden Tag später kommt. |
| Wer wartet, verliert Geduld? | Nein, solange die Zufahrt zu ist. | Der Spieler kann nichts tun, Warten auf die Flut ist normal. |
| Tidenzahlen in `regions.js` oder `economy.js`? | Nur in `economy.js` (`nordsee.gezeiten`), `regions.js` sagt nur noch, dass die Nordsee eine Tide hat (`REVIER_FORMAT` 2). Die zweite Gezeitenrechnung in `world/region.js` ist entfernt. | Eine Zahlendatei (Regel aus P06). |
| `economy.js` für andere Pakete frei? | Alle Nordsee-Zahlen stehen im eigenen Block `ECONOMY.nordsee`; P57 ändert nichts außerhalb davon. | P45 und Welle 6 können parallel an `economy.js` arbeiten. |

## 5. Teile

| Teil | Inhalt | Stand |
|---|---|---|
| 1 | Gezeiten in den Spielregeln, Zufahrt, Warten auf Flut, Abreise im Tidenfenster, Revierfaktoren, Balancing `--revier nordsee`, Reviertest im normalen Testlauf | gebaut |
| 2 | Tide sichtbar: Boote und Schwimmstege heben und senken sich, Pegel am Kai, Anzeige Hoch-/Niedrigwasser, Bootskarte "läuft ab ... ein" | in Arbeit |
| 3 | Trockenfallplätze (K4): billig, nur für Boote ohne Kiel, bringen Kuttern und Mehrrumpfbooten Zufriedenheit | in Arbeit |
| 4 | Schleuse als Ausbau zu Stufe 3 statt Durchstich | in Arbeit |
| 5 | Freischalten ab Ostsee Stufe 5 (K6), Seekarte zum Wechseln, eigener Spielstand je Revier, Startgeld aus dem Ruf (K5) | in Arbeit |
| 6 | Nordsee-Küsten: eigene Auswahl an Küstentypen für die Nordsee | in Arbeit |
