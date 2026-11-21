# Schichttest: das Spiel von Grund auf prüfen

Stand: 15.11.2026. Gepflegt vom Thread "Spiel Schicht für Schicht von Grund auf testen".

## Wozu

Die anderen Prüf-Threads schauen auf einzelne Merges ("Jedes neue Feature einzeln testen") oder auf ganze Partien im Zeitraffer ("Ganzes Spiel im Zeitraffer durchtesten"). Der Schichttest prüft das **Zusammenspiel**: Er beginnt mit dem nackten Kern (Laden, Kamera, ein Boot kommt, Ziehen, Anlegen, Kassieren, Tag und Nacht, Speichern). Erst wenn eine Schicht stabil ist, kommt die nächste Funktion dazu, und danach laufen **alle bisherigen Schichten im selben Spiel noch einmal**. So fällt auf, wenn eine neue Funktion eine alte stört.

Gespielt wird wie ein Mensch, über die echte Oberfläche:

- Knöpfe werden angeklickt (PC) oder angetippt (Handy, Tablet).
- Boote werden mit Maus oder Finger an der Leine auf die Box gezogen, Münzen mit einem Strich eingesammelt, die Karte mit Ziehen verschoben und mit Mausrad oder zwei Fingern gezoomt.
- Zeit vergeht über die Tempo-Knöpfe (Pause, 1x, 3x, 8x).
- Der Test liest den Spielzustand nur, um zu prüfen, ob die Handlung gewirkt hat. Er setzt nie Geld, Stufe oder Boote von Hand.

Ausnahmen, die im Bericht stehen: Ausgangslagen über Testadressen (`?gelaende=`, `?seed=`, `?stegbild=`, später `?stufe=n`) und das Warten auf Spielzeit.

## Aufruf

Einmal vorher (Playwright liegt in `tests/`):

```bash
cd tests && npm ci && cd ..
```

Ein Gerät, alle Schichten:

```bash
node tools/schichttest/lauf.cjs --geraet pc --out /tmp/schichttest
```

Alle fünf Geräte nacheinander gegen eine eingefrorene Kopie des Spiels (Merges während des Laufs ändern dann nichts):

```bash
rm -rf /tmp/st-web && cp -r web /tmp/st-web && for g in pc handy handyquer tablet tabletquer; do node tools/schichttest/lauf.cjs --geraet "$g" --web /tmp/st-web --out /tmp/schichttest; done
```

| Option | Standard | Bedeutung |
|---|---|---|
| `--geraet` | `pc` | `pc` (1440 x 900, Maus), `handy` (Pixel 7), `handyquer`, `tablet` (Galaxy Tab S4), `tabletquer`; alle außer `pc` mit Touch |
| `--bis n` | alle | letzte Schicht |
| `--nur a,b` | - | nur diese Schichten, ohne Wiederholung der früheren (zum Nachprüfen eines Funds) |
| `--wieder k` | alle | nach jeder Schicht nur den Kern (1 bis 7) und die k letzten Schichten wiederholen; mit allen 23 Schichten dauert ein voller Lauf am Handy über zwei Stunden, `--wieder 4` hält ihn unter zwei |
| `--gelaende n`, `--seed s`, `--stegbild n` | Spielstart wie ein neuer Spieler | Ausgangslage über die Adresse |
| `--web dir` | `web/` | Ordner mit dem Spiel |
| `--out dir` | `/tmp/schichttest` | Ausgabe: `bilder/`, `ergebnis-<gerät>.json`, `bericht-<gerät>.md` |

Ein Lauf endet nach der ersten Schicht mit einem Fund der Schwere A (die Schicht ist nicht stabil, darauf aufzubauen ergibt keinen Sinn). Schwere A = Grundfunktion geht nicht, B = stört sichtbar, C = Feinschliff.

Hinweis zur Testumgebung: Chromium rechnet die Grafik hier in Software. Das Spiel läuft dadurch langsamer als auf einem echten Gerät; Zeiten werden deshalb in Spielsekunden gemessen, nicht in echter Zeit. Ohne Adresse startet Playwright immer mit Geländeform 1, Seed 1 und Stegbild 0 (das Spiel erkennt den Testbrowser), echte neue Spieler bekommen eine zufällige Küste.

## Dateien

| Datei | Inhalt |
|---|---|
| `tools/schichttest/lauf.cjs` | Ablauf: Gerät, Server, Schichten nacheinander, nach jeder neuen Schicht alle früheren noch einmal |
| `tools/schichttest/spieler.cjs` | Spieler mit Maus oder Finger (tippen, ziehen, zoomen, Knopf) und Hilfen im Browser (`window.__st`: Bildschirmlage von Boot, Box, Münze, verdeckt oder frei) |
| `tools/schichttest/schichten.cjs` | Schicht 1 bis 7 (Kern) und der Wächter für Bootslagen |
| `tools/schichttest/ausbau.cjs` | Schicht 8 und folgende |
| `tools/schichttest/bericht.cjs` | Bericht als Markdown aus dem Ergebnis |

## Schichten

Reihenfolge abgeleitet aus [roadmap.md](roadmap.md), [arbeitsplan.md](arbeitsplan.md) und der Bestandsaufnahme: erst was jedes Spiel in den ersten Minuten braucht, dann was jeden Tag passiert, dann was über Tage und Stufen wirkt.

| Nr | Schicht | Paket | Was geprüft wird | Status |
|---|---|---|---|---|
| 1 | Laden und Oberfläche | Grundgerüst, P61 | lädt ohne Fehler, Einstieg lässt sich beenden, alle Knöpfe ganz im Bild, Spielfläche nicht leer | gebaut |
| 2 | Kamera | P01, PR 137 | Verschieben durch Ziehen, Zoomen (Mausrad, zwei Finger), "Übersicht" stellt die Startansicht her | gebaut |
| 3 | Boot kommt an die Boje | P02, P66 | erstes Boot nach wenigen Sekunden, wartendes Boot in der Übersicht sichtbar und nicht verdeckt | gebaut |
| 4 | Ziehen und Anlegen | P02, P03 | Leine vom Boot auf eine leuchtende Box ziehen, Boot fährt hinein und macht fest; Wächter: keine Boote übereinander, über Land oder im Steg | gebaut |
| 5 | Kassieren | P12 | Münze erscheint nach dem Festmachen, ein Strich sammelt sie ein, Geld und Anzeige steigen | gebaut |
| 6 | Tag und Nacht | P05, P20 | Abend kommt und ist dunkler, neuer Tag beginnt, Anzeige zählt mit | gebaut |
| 7 | Speichern und Laden | P09 | Seite neu laden: Stufe, Tag, Geld, Bauten, liegende Boote bleiben, Boote liegen sichtbar in ihrer Box, Einstieg kommt nicht wieder | gebaut |
| 8 | Einfahren ohne Ziehen | P02, P10 | Antippen zeigt "Einfahren" am Boot; ein unberührtes Boot fährt nach der Regelzeit selbst ein | gebaut |
| 9 | Tempo | P07, PR 278 | 3x und 8x laufen 3- und 8-mal so schnell, 8x läuft durch ohne Bremse; PC: Leertaste, Taste F | gebaut |
| 10 | Bauen | P18, J4 | Bauliste, Vorschau, Bestätigen bezahlt genau den Preis, Zeit steht im Baumodus, Spiel läuft danach weiter | gebaut |
| 11 | Tagesziele | P13 | Tafel mit drei Karten, Wahl wirkt | gebaut |
| 12 | Tagesabschluss | P15 | Karte oder Zettel nach dem Tag, Summe stimmt, verdeckt Zeit und Bauen nicht, "Weiter" schließt | gebaut |
| 13 | Menü | Abnahme, P50 | jeder Menüeintrag öffnet oder schaltet etwas sichtbar und lässt sich wieder schließen; Menü passt ins Bild | gebaut |
| 14 | Wartebojen und Ankerfeld | P66 | bei 8x zwölf Stichproben: wartende Boote überlappen nicht, liegen nicht auf Land oder Steg, keine Boje doppelt belegt | gebaut |
| 15 | Bewertung und Gästebuch | P14 | Gästebuch öffnet über die Ruf-Anzeige, zeigt Einträge, schließt wieder | gebaut |
| 16 | Aufstieg | P16, P18 | Ausbau "Hafen" über Bauen, nach dem Umbau Stufe +1, alle früheren Schichten danach noch einmal | gebaut |
| 17 | Hafenbüro und Funk | P02, P28 | Büro bauen, abends "Alle kassieren" sammelt die Münzen ein | gebaut |
| 18 | Dauerlieger | P01 | ab Stufe 2 auf eine Anfrage warten, freie Box antippen, Bewerber wählen: Platz wird Dauerplatz; danach liegt dort kein Gast | gebaut |
| 19 | Logbuch | P21 | über das Menü öffnen, jeden Reiter antippen (Inhalt nicht leer), gesehene Bootsarten stehen drin, schließt wieder | gebaut |
| 20 | Winter | P20 | bei 8x bis zum Winter: Winterpause-Karte, keine Gastboote, "Winter überspringen" führt in den Frühling | gebaut |
| 21 | Ruf und Wünsche | P19 | Stern oben zeigt den Ruf aus den Regeln, ein Spieltag bringt neue Bewertungen, die Bootskarte nennt die Wünsche des Boots | gebaut |
| 22 | Ereignisse und Wetter | P24, P20 | Wetterbericht öffnet und schließt, bei 8x bis zu einem Ereignis: angekündigt per Schild oder Wetterknopf, "Vorbereiten" wirkt (ab Stufe 3) | gebaut |
| 23 | Angebote (Services) | P23 | über Bauen, Reiter "Angebote" das günstigste freie Angebot bauen; bleibt gebaut | gebaut |

## Ergebnisse

Neueste Läufe oben. Bilder und vollständige Berichte liegen im Projektordner unter `schichttest/<datum>-<commit>/`.

| Datum | Stand | Gerät | Schichten | Prüfpunkte | Funde | Bemerkung |
|---|---|---|---|---|---|---|
| 21.11. | `b1d5251` | pc, handy, tabletquer (Serie 10) | 1 bis 23 | 455 bis 971 | F5, F6 | Handy erstmals durch alle 23 Schichten (118 min, Abbruch erst beim Zeitlimit); Tablet quer bis 20, PC bis 16 (Knopf verschwand beim Klicken, offen). Testfehler behoben: Leertaste auf zuletzt geklicktem Knopf, Knöpfe in rollbarer Winterbilanz, Zettel hinter der Winterbilanz, Winter mitten in Schicht 22 |
| 21.11. | `7aa2476` | handy, pc, handyquer, tablet (Serie 12, `--wieder 4`) | 1 bis 23 | 685 bis 698 | F5, F8 | Erste Serie nach dem Pulk-Fix (PR 372): alle vier Geräte durch alle 23 Schichten, 0 Konsolenfehler. Überlappende Boote nur noch einmal (Tablet), F7 nicht mehr aufgetreten; geteilte Wartebojen weiter in Schicht 16 bis 18. Testfehler behoben: Winterbilanz verdeckte die Kamera-Wiederholung, Auszeichnung erschien beim Schließen des Tagesabschlusses |
| 21.11. | `b1d5251` | pc, handyquer, tablet (Serie 11, `--wieder 4`) | 1 bis 23 | 159 bis 707 | F5, F7 | PC (95 min) und Handy quer (79 min) durch alle 23 Schichten (Abbruch von PC in Schicht 16 aus Serie 10 nicht wieder aufgetreten); Tablet brach mit drei Läufen parallel in Schicht 10 ab (5 Bilder pro Sekunde, Testumgebung); allein wiederholt kam es durch alle 23 Schichten (704 Prüfpunkte, 80 min). Handy quer: Funk-Anmeldung lag über Boot und Box nach Verschieben der Karte (wie F4) |
| 20.11. | `64cbe84` | handy, tablet, tabletquer (Serie 8) | 1 bis 19 | 193 bis 653 | F4, F5 | Handy und Tablet quer bis Schicht 19; Logbuch-Reiter brach als Testfehler ab (Logbuch baut sich beim Reiterwechsel neu auf, behoben). Tablet hielt in Schicht 10 an einem kurz verdeckten "Verstanden" (Werkzeug fasst jetzt einmal nach) |
| 15.11. | `b5baa80` | pc, handy, tablet (Serie 6) | 1 bis 17 | 86 bis 579 | F2, F3 | Handy und Tablet laufen durch alle 17 Schichten, PC hält an F3 und Tagesende ohne Ankünfte (Testfehler, behoben) |
| 15.11. | `b5baa80` | alle fünf (Serie 5) | 1 bis 15 | 22 bis 473 | F2, F3 | F2 hält "Einfahren lassen" auf Handy und Tablet an; F1 nicht mehr aufgetreten (PR 320) |
| 15.11. | `af90cb9` | alle fünf | 1 bis 13 | 84 bis 300 | siehe Funde | Serie 1: Kern auf allen Geräten stabil; Funde in 8 bis 13 großteils Testfehler (behoben), F1 echt |
| 14.11. | `af90cb9` | pc, handy, handyquer, tablet, tabletquer | 1 bis 7 | 62 bis 72 | 0 | Kern stabil (nach Testkorrekturen) |

## Funde

| Nr | Schicht | Gerät | Fund | Schwere | Bild | Zuständig | Stand |
|---|---|---|---|---|---|---|---|
| F1 | 12 mit 3, 8 | pc, tablet | Die Karte "Tag n geschafft" liegt oben in der Mitte über Wartebojen und Stegkopf, bis zu 14 s, während das Spiel läuft; wartende Boote und Ziel-Boxen sind verdeckt | C bis B | `schichttest/2026-11-15-af90cb9/f1-pc-tagesabschluss-ueber-bojen.jpg` | an Koordinator gemeldet | offen |
| F2 | 8, 5 | handy, handyquer, tablet, tabletquer | Kurzhalter werden abgerechnet und fahren weg, bevor sie sichtbar festgemacht haben: die Ablegezeit (`leaveClock`, sim.js) zählt ab Zuweisung, mindestens 5 s; wer spät am Tag oder von weit draußen zugewiesen wird, ist noch beim Anfahren. Gemessen bei 3x: 5 von 19 Kurzhaltern (Handy), 2 von 13 (PC); keine Münze zum Streichen | B | `schichttest/2026-11-15-kurzhalt/` | "Längere Tage und Bootsgeschichten einbauen" (PR 319) | erledigt (PR 332) |
| F3 | 3 | pc, tabletquer, handy | Erstes Boot wird nach 4 bis 5 s gemeldet, liegt aber erst nach 51 bis 60 s Spielzeit an der Boje (lange Anreise von außerhalb der Karte, Regel 14.11.); Regel "Erstes Boot nach wenigen Sekunden" damit verfehlt | C | - | Koordinator (Regelkonflikt) | gemeldet 15.11. |
| F4 | 17 mit 8, 13 mit 5 | tabletquer | Die Funk-Liste rechts (Anmeldungen) liegt über den Wartebojen am rechten Kartenrand; ein wartendes Boot ist in der Übersicht nicht frei antippbar (verdeckt von `#hm-funk`) | C | `schichttest/2026-11-20-64cbe84/f4-tabletquer-funk-ueber-bojen.jpg` | Koordinator (Funk-Anmeldung) | gemeldet 20.11. |
| F5 | 18 mit 4, 14 | handy, pc, tabletquer | Zwei Gastboote überlappen beim Anlegen oder Ablegen, und zwei wartende Boote teilen sich kurz eine Boje (in jeder Serie mehrfach); bekannt aus P66 | C | `schichttest/2026-11-20-64cbe84/f5-handy-boote-uebereinander.jpg` | "Staus an Bojen und Ankerfeld auflösen" (P66) | bekannt |
| F6 | 21 mit 1 | handy | Die Funk-Anmeldung unten verdeckt die Zeitleiste (Pause und Tempo halb dahinter), und der Knopf "Einfahren" am Boot ragt am rechten Rand aus dem Bild, wenn das Boot am Rand wartet | C | `schichttest/2026-11-21-b1d5251/f6-handy-funk-ueber-zeitleiste-einfahren-rand.jpg` | Koordinator (Funk-Anmeldung, Bootskarte) | erledigt (PR 367) |
| F7 | 20 mit 4 | handyquer | Im Winter fährt ein ablegendes Gastboot (`leaving`) durch einen Steg und über ein liegendes Boot | C | - | "Staus an Bojen und Ankerfeld auflösen" (Ausweichen) | erledigt (PR 372) |
| F8 | 20 mit 5 | handyquer | Die Funk-Anmeldung liegt quer mitten im Bild über dem Hafen und verdeckt eine Münze zum Streichen (wie F4, aber in der Mitte) | C | `schichttest/2026-11-21-7aa2476/f8-handyquer-funk-ueber-muenze.jpg` | Schichttest-Thread (Funk-Anmeldung flacher bei niedriger Höhe, Karte 135 auf 95 px, Fläche 22,5 auf 14,5 %) | erledigt |
