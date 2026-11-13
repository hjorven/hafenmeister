# Landschaft, Wasser und Licht

Stand: 12.11.2026. Status: gebaut (Ostsee Stufe 1 bis 6; Nordsee nur als Bild, siehe [regionen.md](regionen.md)). Code: `web/js/render/landscape.js` (Einstieg, wird von `main.js` geladen) und `web/js/render/landschaft/`.

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

Jedes neue Spiel bekommt eine von zehn Geländeformen (`web/js/render/landschaft/formen.js`). Die Formen sind frei nach Landschaften an Ost- und Nordsee gebaut und fürs Spiel geformt (breite Durchfahrten, freies Wasser, lesbare Einfahrt); keine bildet einen echten Ort ab.

| Nr. | Name | Was anders ist |
|---|---|---|
| 1 | Nehrung | Grundform: Nehrung mit Dünen und Salzwiesen |
| 2 | Lotseninsel | flacher Priel trennt östlich des Engpasses eine Insel mit Leuchtturm ab |
| 3 | Sandbank | im Osten nur Sandbank knapp über Wasser, Riff vor dem Weststrand, Leuchtturm an der Nehrungsspitze |
| 4 | Bodden | Nehrung endet im Osten, flaches Boddenwasser mit drei Inseln |
| 5 | Inselkette | Nehrung zerfällt östlich in kleine Inseln, hohe Dünen, Leuchtturm |
| 6 | Offene Küste | niedrige, schmale Nehrung mit Haken im Osten |
| 7 | Steilküste | hohe Steilufer mit Felsbändern am Festland, kleine Waldinsel im Westen |
| 8 | Watt | breites Watt vor dem Strand, nur der Priel vor der Einfahrt bleibt tief, Leuchtturm |
| 9 | Dünenspitze | hohe Dünen, breite Nehrung, Spitze mit Leuchtturm und Haken |
| 10 | Doppelinsel | bewaldete Insel im See westlich des Hafens, Insel mit Leuchtturm östlich des Engpasses |

In jeder Form gleich: Festlandufer und Becken am Hafen, Engpass bei x 178 mit Molen und Fahrwasser, westliche Nehrung (Anlagen der Stufe 6), Wartebojen, Ankerfelder und offenes Wasser im Norden. Darum passen Liegeplätze, Stegbilder, Bauen und Spielstände in jeder Form. `tests/gelaendeform.test.mjs` prüft das für alle Formen.

Welche Form gilt: `?gelaende=N` in der Adresse (nur ansehen), sonst die im Spielstand (`modules.gelaende.nr`), in Tests und ohne Browser Form 1, in einem neuen Spiel eine zufällige. Im Spiel: `game.gelaende.aktuell()`, `game.gelaende.formen`. Eine Form entfernen: ihren Eintrag aus `FORMEN` löschen; Spielstände mit dieser Nummer bekommen Form 1.

### Rand der Karte und Watt

- `KERN` (x -420..430, y -200..470) ist fein gerechnet und dicht bepflanzt; `karteRaster` deckt genau diesen Bereich ab.
- `BEREICH` (x -640..660, y -440..640) ist der Rand mit halber Auflösung, damit bei größter Kamerabreite keine harte Kante zum groben Außenring zu sehen ist. Die Tiefentextur rechnet dort nur jedes zweite Texel.
- Watt (Nordsee und Form 8): Sandplaten knapp über Wasser, dazwischen Priele über 0,9 m tief. Kein flacher Dauersaum, der im Wasser-Shader überall schäumt. Ab Stufe 5 vor dem Außenhafen und ab Stufe 6 in der Liegewanne weggebaggert.

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
