# Landschaft, Wasser und Licht

Stand: 13.11.2026. Status: gebaut (Ostsee Stufe 1 bis 6; Nordsee nur als Bild, siehe [regionen.md](regionen.md)). Code: `web/js/render/landscape.js` (Einstieg, wird von `main.js` geladen) und `web/js/render/landschaft/`.

## Was man sieht

- **Gelände in 3D** im Flat-Vector-Stil: Festland mit Strand, Wiese, Wald und Straße, Binnensee, Nehrung mit Dünen, Salzwiesen und kleinen Lagunen, offene See. Die Uferlinien stammen aus `skripte/konzeptbilder/hafen_von_oben.py`, die Wassertiefe an jedem Liegeplatz stimmt mit `web/js/data/harbor.js` überein (Test).
- **Ausbaustufen 1 bis 6** verändern die Landschaft: natürliches Seegatt mit Sandhaken und Pricken (Stufe 1 und 2), 35 m breiter Durchstich mit Kaimauern, Molen und ausgebaggertem Becken (Stufe 3), größeres Becken (Stufe 4), Außenhafen mit langen Molen und Kai (Stufe 5), dazu Liegewanne für Marine- und Kreuzfahrtpier und die Nehrungsstraße (Stufe 6). Einzelheiten im Abschnitt „Engpass und feste Punkte“.
- **Molen** als Steinschüttung mit unregelmäßigem Rand, Weg auf der Krone und breitem runden Kopf. Molenfeuer stellt `buildings.js`.
- **Buhnen** am Seestrand der Nehrung etwa alle 50 m.
- **Wasser**: klare Tiefenbänder wie auf der Seekarte (Grenzen bei 1, 2, 3 und 4 m), die Fahrrinne ist als dunkleres Band zu sehen, kurze weiße Wellenstriche wandern mit dem Wind, am Ufer atmet ein Brandungssaum.
- **Wartebereich vor der Einfahrt**: gelbe Wartebojen und ein gestrichelter Ankerkreis. Stufe 1 und 2 im Binnensee vor den Stegen, ab Stufe 3 draußen östlich der Fahrrinne, ab Stufe 5 zusätzlich eine Reede für große Schiffe.
- **Ankerfeld für die Nacht**: Im Ankerkreis liegen feste Ankerplätze (kleine helle Punkte) im Abstand des Schwoikreises, nicht auf den Bojen und nicht in der Fahrrinne. Boote, die abends keinen Platz bekommen, liegen dort über Nacht. Anzahl: Stufe 1: 13, Stufe 2: 19, Stufe 3 und 4: je 19, Stufe 5: 19 für L plus 7 für XL. Die Liste ist nach Nähe zur Einfahrt sortiert, also zuerst vorne belegen.
- **Tageslicht** folgt der Spielzeit: Morgen, Mittag, Abendrot, Dämmerung, Nacht. Schatten werden abends lang.
- **Zwei Reviere**: Ostsee (Hügelland mit Feldern, Knicks, Wald, Dorf und Steilufer, Schilf) und Nordsee (Deich, hohe Dünen, Watt mit Priel vor der Einfahrt, Pappeln und windschiefe Bäume, graueres Wasser, Gezeiten).

## Engpass und feste Punkte

Die Nehrung trennt Binnensee und offene See. Es gibt genau einen Weg hindurch, den Engpass bei Plan-x 178:

| Stufe | Engpass | nutzbare Breite | Tiefe | Molen |
|---|---|---|---|---|
| 1 und 2 | natürliches Seegatt, leichte S-Kurve, Sandhaken an beiden Enden, Pricken (Reisigbesen) an der Rinne | schmalste Stelle 25 m, davon gut 21 m mindestens 1,2 m tief | 2,2 m in der Mitte | keine |
| 3 und 4 | gerader Durchstich mit Kaimauern, x 150 bis 206, innen abgeschrägte Ecken | 35 m | 4,0 m, Rinne nach See 4,4 m | Köpfe 46 m auseinander |
| 5 und 6 | Durchstich wie oben, davor der Außenhafen | 35 m, Einfahrt Außenhafen etwa 61 m | 4,0 m, Außenhafen 5,0 m | Westmole bis (96, 320), Ostmole bis (196, 306) |

So passen auch zwei L-Yachten aneinander vorbei (Gegenverkehr braucht etwa 18 m), im Seegatt zwei M-Boote. In der Nordsee sind Seegatt und Durchstich um den Tidenhub tiefer, damit sie bei Niedrigwasser befahrbar bleiben.

`web/js/render/landschaft/karte.js` (ohne Three.js) beschreibt die Form für andere Module:

| Funktion | Rückgabe |
|---|---|
| `festePunkte(stufe)` | Planeinheiten: `engpass` `{ art: 'seegatt'\|'durchstich', x0, x1, y0, y1, achse, breite, breiteM, tiefeM }`, `einfahrt` `{ aussen, innen }`, `fahrwasser` (Mittellinie von See bis ins Becken), `fahrwasserBreiteM`, `molenkoepfe`, `bauflaechen` |
| `festePunkteWelt(stufe)` | dasselbe in Weltmetern (`{ x, z }`) |
| `art(px, py, stufe, region)` | `'land'`, `'strand'`, `'flach'` (unter 1 m) oder `'wasser'` |
| `karteRaster(stufe, region, schritt = 2)` | Raster mit `tiefe` (m), `art` (0 Land, 1 Strand, 2 flach, 3 Wasser), `ufer` (Meter zur Uferlinie, positiv an Land), `beiWelt(x, z)` |
| `engpassBreiteM(stufe, region, tiefeMin)` | schmalste befahrbare Breite, für Tests |

Im Spiel: `game.landscape.punkte` (feste Punkte der aktuellen Stufe in Metern), `game.landscape.karte()` (Raster, beim ersten Aufruf etwa 0,25 s), `game.landscape.uferAbstand(x, z)`. Nach jedem Neubau (Stufe oder Region) sendet die Landschaft `landschaft:geaendert` mit `{ stufe, region }`.

Haken für andere Threads, damit niemand in `gelaende.js` schreiben muss:

- `landschaft/vielfalt.js` (Abwechslung): `land(px, py, h, typ, d, kontext)` und `nehrung(px, py, h, typ, kontext)`, kontext `{ stufe, region, uferAbstandM, hafenAbstand, offeneSee, seeAbstandM }`.
- `data/anlagen-flaechen.js` (Anlagen): `anlagenFlaechen(stufe)` liefert Flächen, die das Gelände auf `hoehe` planiert (auch als Aufschüttung).

## Geländeformen

Jedes Spiel bekommt einen von zehn Küstentypen und dazu einen eigenen Zufallswert (Seed). Typ und Seed zusammen ergeben die ganze Landschaft rund um den Hafen: Küste, Buchten, Inseln, Nehrungen, Flüsse, Felsen, Watt und wo darin der Hafen liegt. Gleicher Typ, anderer Seed: andere Küste. Code: `web/js/render/landschaft/natur.js` (Typen, Aufbau, ohne Three.js) und `formen.js` (welche Form gilt). Die Typen sind frei nach Landschaften an Ost- und Nordsee gebaut, keiner bildet einen echten Ort ab.

| Nr. | Name | Idee |
|---|---|---|
| 1 | Nehrung | Lagune hinter einer gewundenen Nehrung mit Dünen, Seegatten und Salzwiesen |
| 2 | Offene Bucht | weite Bucht zwischen zwei bewaldeten Landzungen mit Steilufer, Felsen vor den Spitzen |
| 3 | Flussmündung | ein Fluss kommt in Schleifen aus dem Land und weitet sich zur Mündung, Schilfinseln, Sandbank davor |
| 4 | Bodden | verzweigtes Boddenwasser mit Wieken, Halbinseln und Inseln, ein schmaler Durchlass zur See |
| 5 | Schären | felsige, zerklüftete Küste mit Dutzenden kleiner Felsinseln |
| 6 | Steilküste | fast gerade Küste mit hohem Steilufer, Findlingen und einem Bachtal |
| 7 | Watt | flache Küste mit weitem Watt, Prielen und Halligen mit Warft |
| 8 | Förde | lange, gewundene Förde mit bewaldeten Hängen, der Hafen an ihrem inneren Ende |
| 9 | Strandhaken | eine Nehrung wächst um die Bucht herum und endet in einem Haken mit Leuchtturm |
| 10 | Inselhafen | der Hafen liegt auf einer Insel, über einen Sund sieht man das Festland |

**So entsteht eine Landschaft.** Jeder Typ beschreibt seine Natur in eigenen Koordinaten (See grob im Norden) aus wenigen Bausteinen: Küstenlinie, Bänder (Nehrung, Haken), Buchten und Inseln (Ellipsen mit rauem Rand), Wasserläufe (Fluss, Priel, Sund) und Platen. Der Seed verschiebt, biegt und verteilt sie. Dann legt `bauen()` den Hafen hinein: Der Typ nennt einen Ankerpunkt und einen Drehwinkel, `bauen()` sucht dort das echte Ufer und dreht und verschiebt die Natur so, dass der Hafen dort sitzt. Die Spielkoordinaten bleiben dabei, wie sie sind: Hafen bei (0, 0), See vorne in +y. Daraus entsteht die Landigkeit L (über 0 Land, darunter Wasser), dazu ein Raster mit Abstand zum Ufer, Abstand zur offenen See und Masken für Düne, Fels, Hallig, Wald, Platen und Wasserläufe (5 Planeinheiten, dazwischen weich interpoliert). Eine Landschaft zu bauen dauert etwa 0,2 bis 0,4 s, einmal je Spiel.

**Fest in jedem Typ** (`natur.js`, `BEDARF`), damit Stege, Liegeplätze, Bojen, Anlagen und Spielstände überall passen. Pflicht ist nur, was das Spiel wirklich braucht, alles daneben gehört dem Küstentyp:

- der Uferstreifen der Stege (x -150 bis -20), das Ufer folgt dort `stegUfer(px)`,
- Wasser vor den Stegen und für die Runde der Boote (Kästen und Kreise in `BEDARF.wasser`, Abstand mit `wasserBedarf(px, py)`),
- Land unter Gebäuden, Diensten, Straße und Stegzugängen der Stufen 1 und 2 (Kreise und Linien in `BEDARF.land`),
- die Zufahrt durch das Seegatt bei x 178,
- offenes, mindestens 4,6 m tiefes Wasser vor der Einfahrt (`SEE_NORD`, x -440 bis 480, y 245 bis 820): Reede, Ankerfelder, Piers. Dieser Bereich soll kleiner werden, seit Vorbeifahrer und Besuchsschiffe über die Fahrwasserkarte fahren.

Die Kaifläche (`KAIFLAECHE`, x -150 bis 202, y -92 bis 6) schüttet der Ausbau erst ab Stufe 3 auf. Alle Pflichtbereiche gehen weich in die Natur über (kein Kasten). Watt hält Abstand zu ihnen.

**Der Küstentyp direkt am Hafen.** Jeder Typ setzt mit `nah(q)` eigene Formen neben den Hafen (Bänder, Buchten, Inseln, Wasserläufe, Platen, Leuchttürme, in Spielkoordinaten) und nennt mit `stil.ufer` sein Ufer: Salzwiese (Nehrung), Sand (Offene Bucht, Strandhaken), Schilf (Flussmündung, Bodden), Fels (Schären), Kliff (Steilküste), Watt, Waldsaum (Förde), Steine (Inselhafen). `gelaende.js` (`uferArt`) macht daraus Boden und Höhe bis an die Stege, `bewuchs.js` setzt Schilf und Ufersteine entlang der echten Uferlinie. `game.gelaende.startRect(stufe)` nennt der Kamera den Ausschnitt, in dem man den Typ erkennt.

**Strandkörbe und Seebrücke** (`landschaft/strand.js`, ohne three.js): `strandLagen(stufe, region)` sucht von der Wunschlage aus die nächste passende Stelle und gibt je Teil `[x, y, dreh]` oder `null` zurück. Körbe stehen nur auf ebenem, trockenem Sand (alle Ecken, Höhenunterschied unter 0,8 m), nicht zwischen Gebäuden und nicht auf der Kaifläche. Die Seebrücke beginnt auf Sand, hat auf ganzer Länge und Breite Wasser vor sich, meidet Hafenwasser und ab Stufe 6 die Liegeplätze der großen Gäste; `seebrueckeStrecke(stufe)` liefert Fuß und Kopf. Was an der Stelle des größten Ausbaus stehen kann, steht schon vorher dort und zieht nicht um. An Küsten ohne Sand fehlen sie, `game.buildings.lage(id)` ist dann `null`.

**Der Hafen wächst ins Gelände.** Ab Stufe 3 gräbt der Ausbau Becken, Rinne, Außenhafen und Liegewanne aus, auch dort, wo vorher Land war (mit befestigter Kante statt langem Hang). Wo die Natur den Hafen nicht schützt, baut er ab Stufe 3 Wellenbrecher (`wellenbrecher(stufe)`, in `molen(stufe)` enthalten): von den Molenwurzeln bei y 212 nach Westen und Osten, über Inseln und Landzungen hinweg unterbrochen. Ab Stufe 5 trägt ein Kai zwischen Becken und Außenhafen (x -4 bis 150, y 196 bis 229) Seenotretter und Museumshafen, ab Stufe 6 reicht der westliche Wellenbrecher bis zu den Pieranlagen. Buhnen gibt es nur an offenen Sandstränden.

**Welche Form gilt:** `?gelaende=N&seed=S` in der Adresse (nur ansehen), sonst die im Spielstand (`modules.gelaende = { nr, seed }`), in Tests und ohne Browser Typ 1 mit Seed 1, in einem neuen Spiel Typ und Seed zufällig. Ältere Spielstände ohne Seed bekommen Seed 1. Im Spiel: `game.gelaende.aktuell()` (`{ nr, name, idee, seed, dreh, leuchttuerme, quelle }`), `game.gelaende.formen`. Einen Typ entfernen: seinen Eintrag aus `TYPEN` in `natur.js` löschen; Spielstände mit dieser Nummer bekommen Typ 1.

**Prüfung:** `tests/gelaendeform.test.mjs` prüft alle Typen in beiden Revieren und ein paar Seeds je Typ (Engpass, Fahrwasser, Bojen, Ankerplätze, Liegeplatztiefen, Leuchttürme an Land, Wellenbrecher, Menschenwege an Land). Für viele Seeds:

```bash
node tools/seeds-pruefen.mjs 200
```

Das prüft 200 Seeds je Typ in Ostsee und Nordsee und nennt jeden, der durchfällt.

**Rechtecke für die Kamera** (Weltmeter, `{ minX, maxX, minZ, maxZ }`):

| Funktion | Inhalt |
|---|---|
| `game.gelaende.weltRect()` | die ganze erzeugte Landschaft (`WELT`, Plan x -1300 bis 1300, y -800 bis 1300) |
| `game.gelaende.feinRect()` | fein gerechnetes Gelände (`BEREICH`) |
| `game.gelaende.aussenRect()` | Außenring bis zum Kartenrand (Plan x -1600 bis 1600, y -1600 bis 1400) |
| `game.gelaende.spielRect()` | Hafen, Einfahrt, Leuchttürme und nahe Inseln |
| `game.gelaende.blickRect({ maxBreiteM })` | kurzer Überblick beim Start, höchstens 420 m breit |

Molen: `punkt()` meldet sie so breit, wie sie gezeichnet sind (Linie bis 0,6 Breite, runder Kopf bis 0,95 Breite um den letzten Punkt).

### Rand der Karte und Watt

- `KERN` (x -420..430, y -200..470) ist fein gerechnet und dicht bepflanzt; `karteRaster` deckt genau diesen Bereich ab.
- `BEREICH` (x -900..900, y -560..900, in `natur.js`) ist der Rand mit halber Auflösung, damit bei größter Kamerabreite keine harte Kante zum groben Außenring zu sehen ist. Die Tiefentextur rechnet dort nur jedes zweite Texel.
- Watt (Nordsee vor offenen Küsten und Typ 7 überall): große, weiche Sandplaten knapp über Wasser, dazwischen Priele über 0,9 m tief. Ab Stufe 5 vor dem Außenhafen und ab Stufe 6 in der Liegewanne weggebaggert.

## Abwechslung an Land (Landbild)

Code: `landschaft/vielfalt.js` (reine Rechenfunktionen, Haken `land()` und `nehrung()` in `punkt()`) und `landschaft/bewuchs.js` (Bäume, Knicks, Dorf, Höfe als feste Netze). Die Grundform (Ufer, Fahrwasser, Bauflächen) bleibt unverändert, nur das Land dahinter wechselt.

- **Felder** in langen Schlägen mit Raps, Korn, Acker, Weide und Wiese, getrennt durch **Knicks** (Wallhecken mit einzelnen Eichen) und Feldwege. Felder liegen achsparallel, damit das Geländeraster keine Treppen zeigt. Außerhalb des fein gerechneten Bereichs nur weiche Flecken in ruhigen Grüntönen.
- **Wald** in Flecken (Buchen, Birken, Kiefern; nahe der See mehr Kiefern), auf der Nehrung stellenweise Kiefernwald und **Heide**.
- **Außen kontrastarm:** Außerhalb des fein gerechneten Kerns (`KERN` in `gelaende.js`) ist der Boden nur Gras und Wiese, zwei Grüntöne mit wenigen Prozent Unterschied. Wald zeigen dort nur die Bäume (`waldBei`), nicht die Bodenfarbe. Im Rand mit halber Auflösung (`BEREICH`) laufen die Felder ohne Wege weiter und dünnen nach außen Feld für Feld aus. So sieht man ganz herausgezoomt keine Rasterquadrate.
- **Allee** an der Landstraße direkt hinter dem Hafen (südliche Seite; die nördliche ist Baufläche). Sie ist der untere Rand der Startansicht.
- **Dorf** mit Dorfstraße zur Landstraße, Häusern (Reetdach, Backstein, weiß mit rotem Dach), Backsteinkirche mit Turm und einer **Windmühle**, deren Flügel sich drehen. Das Dorf liegt immer gleich hinter der Landstraße (Nordrand y -100), nur die Ost-West-Lage wechselt; Kirche und Mühle stehen vorn zur Straße hin, damit man sie vom Hafen aus sieht. Dazu zwei bis vier **Einzelhöfe** mit Scheune.
- **Sölle**: kleine Teiche mit Schilfrand in den Feldern, nur im Hinterland.
- **Steilufer** an der offenen See (nicht im Hafen, mindestens 40 m von Hafen und Einfahrt), mit Buchenwald auf der Kante und Findlingen am Fuß. Hat die Grundform an einer Stelle selbst Steilufer (`kontext.formSteilufer`), entfällt es.
- **Hügel** (Endmoräne) im freien Land, nie auf Hafen- und Bauflächen.
- **Jahreszeiten**: Raps blüht im Frühling gelb, Korn ist im Sommer golden, im Herbst färben sich Laub, Knicks und Felder, im Winter ist alles graubraun. Es werden nur Farben im Puffer getauscht, kein Neubau (`game.landscape.setzeJahreszeit(j)`, folgt dem Ereignis `season`).

**Landbild je Spiel:** Die Nummer kommt aus dem Seed des Spielstands (`bildAusSeed`). Sie bestimmt die Küstenart links und rechts (Steilufer, Wald, Heide, Felder), die Lage des Dorfes, Feldgrößen und Fruchtfolge, Waldanteil, Hügel, Sölle und Höfe. Zum Ansehen `?landbild=N` (nur Ansicht, wird nicht gespeichert). Automatische Tests bekommen das Grundbild 0. Die Grundform wählt unabhängig davon `?gelaende=N`.

**Frei bleiben** (eben, ohne Bäume, Häuser, Hügel): Hafenfläche, `karte.bauflaechen(stufe)`, Flächen aus `data/anlagen-flaechen.js` und ein Kreis mit `radius + 4 m` um jeden Service-Bauplatz aus `data/services.js`.

| Adresse | Was man sieht |
|---|---|
| `?landbild=0` | Grundbild: Steilufer im Westen, Dorf links hinter dem Hafen |
| `?landbild=7` | anderes Dorf, andere Felder und Küsten |
| `?stufe=3&landbild=12` | Stufe 3 mit Landbild 12 |

In der Konsole: `hafenmeister.landscape.setzeBild(25)`, `hafenmeister.landscape.bild`, `hafenmeister.emit('season', { part: 'herbst' })`.

## Ausprobieren

```bash
python3 -m http.server 8000 --directory web
```

Dann im Browser öffnen:

| Adresse | Was man sieht |
|---|---|
| `http://localhost:8000/` | Start in Stufe 1, Licht läuft mit der Spielzeit (ein Tag = 120 s) |
| `http://localhost:8000/?stufe=5&uhrzeit=13` | Küstenmarina mittags, mit „Übersicht“ und Rauszoomen ganz sehen |
| `http://localhost:8000/?stufe=3&uhrzeit=19.5` | Abendrot über dem Durchstich |
| `http://localhost:8000/?stufe=4&uhrzeit=22.5` | Nacht |
| `http://localhost:8000/?region=nordsee&stufe=5` | Nordsee mit Deich und Watt |
| `http://localhost:8000/?qualitaet=niedrig` | Handy-Qualität erzwingen (`hoch`, `mittel`, `niedrig`) |

Sobald die Spielregeln eine Stufe senden, gilt deren Stufe statt der aus der Adresse. In der Browser-Konsole geht es auch direkt:

```js
hafenmeister.landscape.setzeStufe(5)
hafenmeister.landscape.setzeRegion('nordsee')
hafenmeister.landscape.setzePegel(-1.6)
hafenmeister.emit('uhrzeit', 20)
hafenmeister.emit('wetter', { bewoelkung: 0.9, wind: 1 })
```

## Schnittstelle für andere Module

`game.landscape` (gleich `game.landschaft`):

| Feld | Bedeutung |
|---|---|
| `hoeheBei(x, z)` | Bodenhöhe in Metern, unter Wasser negativ (bezogen auf mittleren Wasserstand) |
| `tiefeBei(x, z)` | Wassertiefe in Metern beim aktuellen Pegel, 0 an Land |
| `istWasser(x, z)` | liegt der Punkt beim aktuellen Pegel im Wasser |
| `warteplaetze` | `{ bojen: [{ id, x, z, groesse }], ankerbereiche: [{ id, x, z, radiusM, groesse }], ankerplaetze: [{ id, bereich, x, z, groesse, schwoikreisM }] }` |
| `wege` | begehbare Wege an Land: `[{ id, typ, breite, punkte: [{ x, y, z }] }]`, Typen `strasse`, `weg`, `promenade`, `mole` |
| `licht.zustand` | `nacht` 0..1, `tint`, `schattenRichtung`, `schattenLaenge`, `sonnenHoehe` |
| `setzeStufe(n)`, `setzeRegion(id)`, `setzePegel(m)`, `setzeUhrzeit(h)`, `setzeWetter({ bewoelkung, wind })` | direkt steuern |

Ereignisse, auf die die Landschaft hört: `stufe`, `region`, `pegel`, `wetter`, `uhrzeit` (feste Uhrzeit, `null` gibt sie wieder frei). Sie sendet `licht` mit dem Lichtzustand, z. B. für Fensterlicht.

Antippbar: Wartebojen mit `userData.pick = { type: 'waitbuoy', id }`, Ankerbereiche mit `{ type: 'anchorage', id }`.

Für Molenfeuer und andere Lichtpunkte gibt es `erzeugeLeuchtfeuer({ farbe, kennung, periode })` aus `landschaft/tageslicht.js`. Der Punkt blinkt nach Kennung (`Fl`, `Oc`, `Iso`) und leuchtet nachts kräftiger; im eigenen Tick `sprite.userData.aktualisiere(zeit, nacht)` aufrufen.

Höhen für Bauten: Promenade 1,2 m, Kai Außenhafen 1,3 m, Molenkrone 1,4 m. In der Nordsee liegen Bauwerke 1,8 m höher, weil der Pegel bis etwa ±1,7 m schwankt.

## Leistung

| Qualität | Wann | Gelände-Raster | Schatten | Dreiecke (Stufe 3) |
|---|---|---|---|---|
| hoch | PC mit mehr als 4 Kernen | 2,0 m | echte Schattenkarte | etwa 167.000 |
| mittel | Tablet, kleinere PCs | 2,6 m | flache Schatten unter Bäumen | etwa 99.000 |
| niedrig | Handy | 3,2 m | flache Schatten unter Bäumen | etwa 54.000 |

So bleibt es schnell (Stand 12.11.2026):

- **Gelände** (`landschaft/netz.js`): Ebene Flächen gleicher Art werden zu großen Dreiecken zusammengefasst. Am Hafen weicht das Netz höchstens 3 cm vom Raster ab, nach außen wächst die Toleranz bis 1,2 m. Kein Riss zwischen groben und feinen Stücken, das prüft `tests/gelaendenetz.test.mjs`.
- **Bäume, Stämme, Gras, Schilf, Felsen, Molensteine und Buhnen** werden beim Bau einmal zu je einem festen Netz gebacken, statt Tausende Instanzen zu zeichnen. Ecken werden geteilt (Index), Böden von Kegeln, die man nie sieht, fehlen.
- **Bäume, Knicks, Heide, Gras, Schilf und Dorf** sind zusätzlich in Kacheln von 180 m geteilt (`backeKacheln` in `bewuchs.js`). Three.js lässt so alles außerhalb des Bildes weg; in der Startansicht zeichnet das Handy nur die Bäume, die man sieht. Bäume im groben Außenring haben keinen Stamm und keinen flachen Schatten. Startansicht Stufe 3 (Stand 13.11.2026): Handy etwa 64.000 statt 68.000 Dreiecke, PC 85.000 statt 111.000, Zeichenzeit gleich wie vor dem Landbild.
- **Baumschatten** sind ein festes Netz; Sonnenrichtung und Länge rechnet der Vertex-Shader, ein neuer Sonnenstand kostet also nichts.
- **Molen** sind zwei Netze (Schüttung und Weg) statt einzelner Teile je Abschnitt.
- **Wasser** ist eine einzige Fläche mit kurzem Shader ohne Spiegelung, Zufall ohne `sin()`, Tiefenbänder nur einmal gerechnet.

Gemessen mit Software-Grafik (relativ zu lesen), Stufe 6 mittags, nur Zeichnen: PC Weitansicht 256 auf 148 ms, Nahansicht 169 auf 82 ms; Handy Weitansicht 128 auf 67 ms, Nahansicht 78 auf 44 ms. Ein Stufenwechsel baut die Landschaft in etwa 0,2 s neu (PC).

## Tests

```bash
node --test tests/landschaft.test.mjs
```

```bash
node --test tests/gelaendenetz.test.mjs
```

```bash
node --test tests/gelaende-vielfalt.test.mjs
```

Prüft unter anderem: Wassertiefe an allen Liegeplätzen passt zu den Hafendaten, Wartebojen liegen in jedem Revier auch bei Niedrigwasser tief genug, Wege liegen an Land, die Uhrzeit läuft über den Spieltag ohne Sprung zurück, das vereinfachte Geländenetz hat keine Risse und deckt die ganze Fläche.
