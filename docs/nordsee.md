# Nordsee mit Ebbe und Flut (P57)

Stand: 28.11.2026. Status: **Teil 1 bis 3 gebaut** (Gezeiten in den Spielregeln, Revierfaktoren, Tide sichtbar, Trockenfallplätze). Die übrigen Teile sind in Arbeit, siehe Abschnitt 7. Die Nordsee ist für Spieler noch nicht zu erreichen (nur `?revier=nordsee&stufe=n` zum Ausprobieren), bis Teil 5 (Freischalten und Seekarte) gemergt ist.

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

## 3. Was man sieht (Teil 2)

| Was | Wo im Code |
|---|---|
| Das Wasser steigt und fällt, Platen im Watt fallen trocken | Landschaft (`game.landscape.setzePegel`), Pegel aus `features/gezeiten.js` |
| Boote, Bojen, Schwäne und Besucherschiffe schwimmen mit dem Pegel | `render/boat-anim.js`, `render/stege.js`, `render/boat-view.js`, `render/besucher-tiere.js`, `render/services-besuch.js` |
| Stege und Kai stehen um 1,8 m höher (über Springhochwasser), ihre Pfähle reichen bis unter Niedrigwasser; Liegeplatzflächen und Fingerstege schwimmen | `render/stege.js` (`hoch()`, `schwimmend`) |
| Pegellatte (rot-weiß je halber Meter, dunkler Strich je Meter) neben der Wurzel von Steg A, Null bei Seekartennull | `render/stege.js` (`pegellatte`) |
| Im Wetterknopf der Pegel: "Flut 2,4 m" (steigt) oder "Ebbe 0,8 m" (fällt), Meter über Seekartennull | `events/banner.js`, `game.gezeiten.chipText()` |
| Im Wetterbericht oben "Gezeiten heute": Tageskurve mit Strich bei jetzt, Hoch- und Niedrigwasser bei Tageslicht, "Zufahrt jetzt bis 1,9 m Tiefgang" | `game.gezeiten.berichtZeile()` |
| Wartet ein Boot auf die Flut, steht der Geduldsring grau-blau (ruht), sein Titel sagt, ab wann es einläuft | `ui/vorschau.js`, `bridge.js` (`geduldRuht`) |
| Bootskarte: "Ebbe: Mit 1,9 m Tiefgang kommt es erst ab etwa 18:10 Uhr durch die Zufahrt. Bis dahin wartet es ohne Eile." Statt "kein passender Platz frei": "Sobald die Flut reicht, leuchten hier die passenden Plätze." | `ui/hud.js`, `game.gezeiten.kartenSatz()` |
| Einmal je Spielstand erklärt eine Meldung die Tide, wenn das erste Boot auf die Flut wartet | `features/gezeiten.js` (`state.modules.gezeiten.erklaert`) |

Vorschaubilder: `nordsee/teil2-*.png` in den Projektdateien.

## 4. Trockenfallplätze (Teil 3)

An der Nordsee liegt das Bojenfeld (P36, [bojenfeld.md](bojenfeld.md)) auf einer Plate im Watt: Im Baumenü heißt es "Trockenfallplätze im Watt" (später "Trockenfallplätze erweitern"), Preise und Bauabschnitte wie das Bojenfeld.

| Regel | Was passiert |
|---|---|
| Wer darf dort liegen? | Nur Boote ohne tiefen Kiel: Ruder- und Paddelboote, Beiboote, Jollen, Motorboote, Kutter (`nordsee.trockenfallen.arten`). Kielyachten bekommen beim Ziehen den Grund `kiel`. Wie im Bojenfeld nur Klassen S und M. |
| Wann hin und weg? | Nur, wenn über der Plate genug Wasser steht: Wasserstand minus Höhe der Plate über Seekartennull mindestens Tiefgang plus 0,3 m (Grund `platte`). Ablegen wird ins Fenster gelegt (Hook `departAt`), wie bei der Zufahrt. |
| Bewertung | Kutter +0,3 Anker, Motorboote +0,1 Anker, wenn sie auf der Plate lagen (`nordsee.trockenfallen.bonus`). |
| Liegegeld, letzte Wahl, offen bei Sturm | wie im Bojenfeld |

Im Bild: Unter dem Bojenfeld liegt eine Schlickplate (`render/stege.js`, `platen`), auch wo noch keine Boje liegt. Bei Ebbe fällt sie trocken, die Bojen liegen auf dem Schlick, die Boote liegen leicht schräg darauf und schwojen nicht (`render/boat-anim.js`). Bei Flut steht Wasser darüber. Lage: `render/landschaft/bojenfeld-lage.js` sucht an der Nordsee Wasser mit mindestens `suche` Metern (sonst wie im Bojenfeld), die Plate liegt immer auf Höhe `platte`, damit Regeln und Bild dieselbe Höhe haben.

Ausprobieren: `?revier=nordsee&stufe=4&bojenfeld=2`. Vorschaubilder: `nordsee/teil3-*.png`.

## 5. Schleuse (Teil 4)

Jeder Nordsee-Hafen bekommt mit dem Ausbau zu Stufe 3 eine Schleuse. Auf Küsten mit Durchstich heißt der Ausbau "Durchstich mit Schleuse" und die Stufe danach "Hafen mit Schleuse"; an offenen Küsten "Seeschleuse zwischen den Molen" und "Hafen mit Seeschleuse". Die Namen stehen in `nordsee.schleuse.namen`, `data/kuestennamen.js` wählt sie (`setzeRevier`).

| Regel | Was passiert |
|---|---|
| Takt | Das Tor steht alle `takt` (16) Sekunden Spielzeit `offen` (7) Sekunden offen. Dazwischen wird geschleust. |
| Ankommende | Ist die Zufahrt tief genug, das Tor aber zu, bekommt das Boot beim Ziehen den Grund `schleuse` ("Die Schleuse ist gerade zu. Mit der nächsten Schleusung um etwa ... Uhr läuft es ein."). Es wartet an der Boje (Hook `hold`), ohne Geduld zu verlieren, und läuft mit der nächsten Schleusung selbst ein. |
| Ablegen, Tagestörn, Dauerlieger | Ablegen fällt auf die nächste Schleusung (Hook `departAt`), Dauerlieger kommen nur bei offenem Tor zurück. |
| Ausgenommen | Großschiffe (XXL), Havarist im Schlepp, Optis über den Slip: eigene Abläufe wie bei der Zufahrt. |
| Wozu die Schleuse? | Sie hält das Hafenbecken und macht die tiefere Fahrrinne ab Stufe 3 möglich (`nordsee.zufahrt`): Ab Stufe 3 kommen auch Kielyachten den größten Teil der Tide hinein (1,4 m statt 0,5 m bei Niedrigwasser), nur eben im Takt der Schleuse. |

Im Bild (`render/schleuse.js`): zwei Schiebetore quer im Durchstich oder, an offenen Küsten, zwischen den Molen mit eigenen Kammerwänden aus Beton (ab Stufe 5 liegen die Molen weiter außen, dann steht die Kammer im Vorhafen), die in Torkammern neben der Ostmauer rollen, je Haupt ein Signalmast mit Rot und Grün, ein Schleusenwärterhaus. Stemmtore wurden verworfen: Bei der lichten Weite des Durchstichs (rund 34 m) ragten die offenen Flügel aus der kurzen Kammer heraus, und große Seeschleusen der Nordseeküste haben ohnehin Schiebetore. Die Tore öffnen zur Schleusung und bleiben offen, solange ein Boot in der Kammer oder kurz davor ist. In der Konsole: `hafenmeister.schleuse.offen()`, `hafenmeister.schleuse.naechste()`.

Ausprobieren: `?revier=nordsee&stufe=3`. Vorschaubilder: `nordsee/teil4-*.png`.

## 6. Freischalten und Revierwahl (Teil 5)

| Was | Wie |
|---|---|
| Freischalten (K6) | Die Nordsee wird frei, sobald einer deiner Häfen an der Ostsee Stufe 5 erreicht (`nordsee.start.abStufe`). Das gilt für das ganze Gerät: Der beste Ostsee-Stand (Stufe und Ruf) steht unter `hafenmeister.reviere` im Browser und bleibt, auch wenn der Hafen gelöscht wird. Spielstände aus der Zeit davor zählen über das Verzeichnis der Plätze sofort. Nordsee-Häfen, Testmodus und Probe-Kopien schalten nichts frei. |
| Meldung | Beim ersten Mal kommt ein Hinweis "Die Nordsee ist frei" mit dem Weg dorthin (Spielstände, Neues Spiel). |
| Seekarte | Im Fenster "Neues Spiel" steht oben eine kleine Pixelkarte mit Nord- und Ostsee. Antippen wählt das Revier; die gesperrte Nordsee sagt, ab wann sie frei ist und welche Stufe du bisher hast. |
| Spielstand je Revier | Jeder Hafen merkt sich sein Revier (`state.region`), die Liste der Spielstände zeigt "Nordsee" vor der Stufe. Wechseln zwischen den Revieren heißt: anderen Hafen spielen. |
| Startgeld (K5) | Ein neuer Nordsee-Hafen bekommt Startgeld aus dem Ruf des besten Ostsee-Hafens: je Anker 300 €, auf Hundert gerundet, 600 bis 1.500 € (`nordsee.start`). Bei 4,2 Ankern sind es 1.300 €. |
| Namen | Stufe 3 heißt an der Nordsee "Hafen mit Schleuse" (offene Küste "Hafen mit Seeschleuse"), der Erfolg der Stufe "Zur Nordsee", der Pokal "Hafenmeister der Nordsee". Texte, die nur an der Ostsee stimmten, sind allgemein. |

Code: `save/reviere.js` (ohne Browser testbar, `tests/reviere.test.mjs`), Seekarte in `save/save-panel.js`, Anlegen in `save/index.js`. Vorschaubilder: `nordsee/teil5-*.png`.

## 6b. Nordsee-Küsten (Teil 6)

Ein neuer Nordsee-Hafen wählt nur aus Küsten, die es an der deutschen Nordsee gibt (`REVIERE.nordsee.kuesten` in `data/regions.js`): Watt (7, Halligen, Priele, Deich), Flussmündung (3, Sielhafen an Ems, Weser oder Elbe), Nehrung (1, Barriereinseln wie die Ostfriesischen Inseln), Inselhafen (10) und Strandhaken (9, wie der Ellenbogen auf Sylt). Schären, Förde, Bodden, Steilküste und die echten Karten 11 bis 15 gibt es nur an der Ostsee. Im Fenster "Neues Spiel" zeigt die Reihe "Küste" nach der Wahl auf der Seekarte nur die Küsten dieses Reviers; "Zufall" würfelt nur unter ihnen. An der Ostsee bleibt alles wie bisher (alle Küsten).

Gemessen (je Küste 10 Seeds): Auf allen fünf Küsten findet das Watt Platz für mindestens 6 Trockenfallplätze, auf 46 von 50 für alle 12. Die Schleuse gibt es auf allen, im Durchstich auf 11 von 50, sonst zwischen den Molen. Test: `tests/regionen.test.mjs`.

## 7. Ausprobieren

```
http://localhost:8000/?revier=nordsee&stufe=2
```

Im Testmodus (`?stufe=n`) gilt `?revier=nordsee` jetzt auch für die Spielregeln. In der Browser-Konsole: `hafenmeister.gezeiten.scheitel()` (Hoch- und Niedrigwasser heute), `hafenmeister.gezeiten.wasserstand()`.

Balancing:

```bash
node tools/balance.mjs --laeufe 10 --revier nordsee
```

Messung 28.11.2026 (10 Läufe, geschickt): Nordsee 101 Tage bis zum Abschluss, Ostsee 103. Nach Teil 6 (Schleuse an allen Küsten): Nordsee 102 Tage geschickt, 122 gemütlich. Einnahmen bis Tag 30 höher (Hafengeld mal 1,15), der Aufstieg gleich lang.

## 8. Entscheidungen (P57, selbst getroffen und notiert)

| Frage | Entscheidung | Warum |
|---|---|---|
| Was ist die Kernregel der Tide (K2)? | Die Zufahrt, nicht der Liegeplatz. Liegeplätze behalten ihre Tiefe bei Niedrigwasser, Kielyachten liegen also nie trocken. | Wie im echten Sielhafen hängt alles an der Barre im Priel. So bleibt die Passregel der Box gleich, und man sieht die Tide an den wartenden Booten. |
| Ein oder zwei Hochwasser je Tag? | Echte Tide mit 12,42 Stunden auf die Uhrzeit im Spiel | Bei 12,5 Stunden Tageslicht gibt es jeden Tag mindestens ein Hochwasser, das jeden Tag später kommt. |
| Wer wartet, verliert Geduld? | Nein, solange die Zufahrt zu ist. | Der Spieler kann nichts tun, Warten auf die Flut ist normal. |
| Tidenzahlen in `regions.js` oder `economy.js`? | Nur in `economy.js` (`nordsee.gezeiten`), `regions.js` sagt nur noch, dass die Nordsee eine Tide hat (`REVIER_FORMAT` 2). Die zweite Gezeitenrechnung in `world/region.js` ist entfernt. | Eine Zahlendatei (Regel aus P06). |
| Trockenfallplätze als eigene Platzart oder als Bojenfeld im Watt (K4)? | Das Bojenfeld liegt an der Nordsee auf einer Plate. | So wie in echten Wattenhäfen (Muringbojen, die trockenfallen). Bau, Lage, Liegegeld, Bauvorschau und Antippen gibt es schon; neu sind nur die Regeln für Kiel und Wasserstand und das Bild. Mehrrumpfboote (Klasse L) passen nicht auf die kleinen Bojenplätze, darum liegen dort Kutter und kleine Boote. |
| Plate aus dem Gelände oder eigene Fläche? | Eigene Schlickfläche auf fester Höhe unter dem Bojenfeld. | Das Gelände hat an kaum einer Küste ein ebenes Watt in passender Höhe nahe den Stegen. Mit fester Höhe stimmen Regeln (Node, ohne Gelände) und Bild überein. |
| Schleuse als Wartezeit oder als Gewinn? | Beides: Die Schleuse ist der Grund für die tiefere Fahrrinne ab Stufe 3 (mehr Boote kommen bei jeder Tide hinein), kostet dafür kurze Wartezeiten im Takt. | Echte Sielhäfen mit Schleuse sind tideunabhängiger. Der Takt ist kurz (höchstens 9 s Wartezeit), damit es nicht nervt. |
| Seekarte als eigenes Fenster oder im Fenster "Neues Spiel"? | Im Fenster "Neues Spiel", dazu "Nordsee" in der Liste der Spielstände. | Ein Revier wechselt man, indem man einen anderen Hafen spielt; ein eigenes Fenster hätte nur dieselben Häfen noch einmal gezeigt. |
| Freischalten je Spielstand oder je Gerät? | Je Gerät, nur besser, nie schlechter. | Wer einmal Stufe 5 erreicht hat, soll die Nordsee nicht verlieren, wenn er den Hafen löscht. |
| Schleuse nur im Durchstich? | An allen Nordsee-Küsten; an offenen Küsten zwischen den Molen. | Nur 11 von 50 Nordsee-Häfen hätten sonst eine Schleuse gehabt; Seeschleusen in der Hafeneinfahrt sind an der Nordsee üblich. |
| Eigene Nordsee-Küsten neu bauen oder auswählen? | Aus den zehn freien Küstentypen die fünf auswählen, die es an der Nordsee gibt. | Jede Küste ist mit allen Features erprobt (Stegbilder, Wege, Großschiffe); eine neue hätte all das neu gebraucht. Farben, Deich und Watt kommen ohnehin aus dem Revier. |
| `economy.js` für andere Pakete frei? | Alle Nordsee-Zahlen stehen im eigenen Block `ECONOMY.nordsee`; P57 ändert nichts außerhalb davon. | P45 und Welle 6 können parallel an `economy.js` arbeiten. |

## 9. Teile

| Teil | Inhalt | Stand |
|---|---|---|
| 1 | Gezeiten in den Spielregeln, Zufahrt, Warten auf Flut, Abreise im Tidenfenster, Revierfaktoren, Balancing `--revier nordsee`, Reviertest im normalen Testlauf | gebaut |
| 2 | Tide sichtbar: Boote und Schwimmstege heben und senken sich, Pegellatte, Pegel im Wetterknopf, Gezeiten im Wetterbericht, Bootskarte "ab etwa ... Uhr" | gebaut |
| 3 | Trockenfallplätze (K4): das Bojenfeld liegt an der Nordsee auf einer Plate im Watt, nur für Boote ohne tiefen Kiel, Kutter liegen dort gern | gebaut |
| 4 | Schleuse als Ausbau zu Stufe 3: Tor im Takt, Warten auf die Schleusung, Schiebetore im Bild, Namen an der Nordsee | gebaut |
| 5 | Freischalten ab Ostsee Stufe 5 (K6), Seekarte im Fenster "Neues Spiel", eigener Spielstand je Revier, Startgeld aus dem Ruf (K5), Namen und Texte je Revier | gebaut |
| 6 | Nordsee-Küsten: eigene Auswahl an Küstentypen für die Nordsee, Schleuse an allen Küsten, Revierdaten aufgeräumt | gebaut |
