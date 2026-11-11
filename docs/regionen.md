# Hafenregionen

Stand: 11.11.2026. Ergänzt Abschnitt 9 im [Spielplan](plan.md). Dieses Dokument beschreibt die vier Reviere des Spiels: was sie im Aussehen und im Spielgefühl unterscheidet, wie man sie freischaltet und wie sie als Daten beschrieben sind. Die Daten liegen in `web/js/data/regions.js`, die Rechenfunktionen (Wasserstand, Tidenfenster, Farben) in `web/js/world/region.js`.

## 1. Die Idee

Jedes Revier ist ein eigener Hafen, den man vom Badesteg bis zur großen Marina ausbaut. Die sechs Ausbaustufen aus dem [Spielplan](plan.md#4-ausbaustufen) bleiben überall gleich, damit Spielregeln, Schiffe und Oberfläche nur einmal gebaut werden müssen. Die Reviere unterscheiden sich in vier Dingen:

1. **Aussehen:** Farben von Wasser, Strand und Himmel, Bauweise der Häuser, Bäume und Kleinkram am Ufer.
2. **Küste:** Nehrung mit Dünen, flache Inselküste, Granitschären oder Deich mit Watt.
3. **Spielgefühl:** welche Boote häufig kommen, wie lange sie bleiben, was Gäste sich wünschen, welche Ereignisse es gibt.
4. **Eine Besonderheit je Revier**, die man spürt, ohne dass das Spiel kompliziert wird.

| Revier | Vorbilder | Küste | Besonderheit | Schwierigkeit |
|---|---|---|---|---|
| Deutsche Ostsee | Burgtiefe (Fehmarn), Kühlungsborn, Heiligenhafen | Binnensee hinter Nehrung, Dünen, Strand | Badegäste und Seebrücke, viele kleine Boote | leicht, Start |
| Dänemark | Svendborg, Faaborg, Marstal (Ærø), Mariager | Fjord mit grünen Hängen, Inseln davor, Lehmkliffs | viele Segler und kleine Fähren, Gäste bleiben oft nur eine Nacht; Traditionssegler schon ab Stufe 4 | leicht bis mittel |
| Schwedische Schären | Smögen, Marstrand, Sandhamn | rosa-grauer Granit, Kiefern, tiefes Wasser bis an den Fels | wenig Bauland, dafür tiefes Wasser: Kielyachten schon ab Stufe 2, Liegen an Felsen und Bojen | mittel |
| Nordsee | Neuharlingersiel, Greetsiel, Büsum | Deich, Watt, Priele, Sielhafen | Ebbe und Flut: Der Wasserstand steigt und fällt um bis zu 3 m, Boote kommen nur im Tidenfenster | anspruchsvoll, zuletzt |

Die Vorbilder sind Anregungen. Die Häfen im Spiel bekommen erfundene Namen, damit niemand einen echten Ort nachgebaut erwartet.

## 2. Die Reviere im Einzelnen

### Deutsche Ostsee: Dünenhafen

- **Küste:** Festland, Binnensee, Nehrung mit Dünen und Strandhafer, dahinter die offene Ostsee. Genau die Karte aus [Hafen und Schiffe](hafen-und-schiffe.md).
- **Farben:** helles Türkis, cremiger Sand, sattes Wiesengrün. Viel Sonne, wenig Nebel.
- **Bauweise:** weiße Bäderarchitektur mit Balkonen, Backsteinhäuser mit roten Ziegeln, Fischerkaten mit Reetdach. Strandkörbe in Blau-Weiß und Grün-Weiß.
- **Natur:** Kiefern auf der Nehrung, Kartoffelrosen, Strandhafer, Möwen.
- **Spielgefühl:** gemütlicher Einstieg. Viele Ruderboote, Jollen und kleine Motorboote, Badegäste wollen Kiosk und Toilette. Seebrücke als besonderer Bau.
- **Ereignisse:** Segelwoche (Regatta), Hafenfest mit Feuerwerk, Sommergewitter.

### Dänemark: Fjordhafen

- **Küste:** ein schmaler Fjord mit sanften grünen Hängen, Buchenwald, kurze Lehmkliffs, Steinmolen aus Findlingen, vor der Mündung kleine Inseln.
- **Farben:** etwas grünlicheres Wasser, helle Wiesen, Häuser in Gelb, Ocker und Rosa.
- **Bauweise:** gelbe und weiße Fachwerkhäuser, rote Dachziegel, schwarze Teerbuden am Hafen, Dannebrog-Fahnen an Masten.
- **Natur:** Heckenrosen, Holunder, Weiden mit Kühen in der Ferne, Schwäne.
- **Spielgefühl:** Viele Segler, die von Insel zu Insel fahren und meist nur eine Nacht bleiben. Mehr Ankünfte, weniger Hafengeld pro Boot. Holzklassiker und Traditionssegler sind häufig, Traditionssegler kommen schon ab Stufe 4 an den Stirnplatz. Eine kleine Inselfähre pendelt ab Stufe 3 (Kulisse und Tagesgäste).
- **Besondere Dienste:** Würstchenbude, Fahrradverleih, Räucherei.
- **Ereignisse:** Holzbootfestival, Mittsommer-Feuer am Strand.

### Schwedische Schären: Felsenhafen

- **Küste:** glatt geschliffener Granit in Rosa und Grau, kleine Buchten, Kiefern in Felsspalten, tiefes Wasser direkt am Ufer.
- **Farben:** tiefes Blau, dunkle Kiefern, roter Fels, lange goldene Abende.
- **Bauweise:** falunrote Holzhäuser mit weißen Ecken und Fensterrahmen, Bootshäuser auf Pfählen, gelb-blaue Fahnen.
- **Natur:** Kiefern, Birken, Wacholder, Moos auf Felsen.
- **Spielgefühl:** Bauland ist knapp, Stege werden an den Fels gebaut. Dafür ist das Wasser tief: Kielyachten können schon ab Stufe 2 anlegen. Neue Platzart „Felsplatz“ (Bug am Fels, Heckanker) und Bojenfeld als günstige Erweiterung. Der Abend ist länger als in den anderen Revieren (helle Nordsommernächte).
- **Besondere Dienste:** Sauna-Floß, Räucherei, Bootstankstelle auf einem Ponton.
- **Ereignisse:** Mittsommerfest, Regatta rund um die Schären, Nebel am Morgen.

### Nordsee: Sielhafen

- **Küste:** grüner Deich mit Schafen, davor Salzwiesen und Watt, ein Priel als Fahrrinne, der Hafen liegt hinter dem Siel im Deich.
- **Farben:** graublaues Wasser, braungraues Watt bei Ebbe, weiter Himmel, häufiger Dunst.
- **Bauweise:** dunkelroter Klinker, Giebelhäuser, rot-weißer Leuchtturm, Krabbenkutter in Grün und Blau.
- **Natur:** Salzwiesen, Strandflieder, Schafe am Deich, Austernfischer.
- **Spielgefühl:** Ebbe und Flut. Siehe Abschnitt 3. Krabbenkutter und Seenotretter gehören hier von Anfang an dazu, Inselfähren kommen ab Stufe 5.
- **Besondere Dienste:** Fischbrötchenbude, Wattführung, Schleuse als großes Bauprojekt.
- **Ereignisse:** Sturmflut, Kutterkorso, Krabbenfest.

## 3. Ebbe und Flut in der Nordsee

Nur die Nordsee hat einen spürbaren Tidenhub. In den Ostseerevieren schwankt der Wasserstand so wenig, dass das Spiel ihn ignoriert.

**Wasserstand:** Die Tiefen in den Hafendaten (`harbor.js` und später `web/js/data/harbors/<id>.js`) gelten wie auf einer Seekarte bei mittlerem Niedrigwasser. In der Nordsee kommt der aktuelle Wasserstand dazu, er liegt zwischen 0 (Niedrigwasser) und dem Tidenhub (Hochwasser):

```
wasserstand(t) = hub / 2 + hub / 2 * springNipp(t) * sin(2 * PI * (t / periode + phase))
springNipp(t)  = 1 + springFaktor * cos(2 * PI * t / springNippPeriode)
```

Bei Springtide fällt das Wasser etwas unter 0, bei Nipptide bleibt es darüber. In der Ostsee ist der Wasserstand immer 0. Ein Hafen kann den Tidenhub seines Reviers mit einem eigenen Feld `gezeiten: { tidenhub }` in seinen Hafendaten überschreiben.

`t` ist die Spielzeit in Spieltagen (ein Spieltag dauert 2 Minuten). Mit einer Periode von 1,035 Spieltagen kommt das Hochwasser jeden Tag etwas später, wie an der echten Küste.

**Regel:** Ein Boot passt an einen Platz, wenn `tiefe + wasserstand >= tiefgang + 0,3`. Das ist die bekannte Regel aus [Hafen und Schiffe](hafen-und-schiffe.md), nur mit dem Wasserstand dazu.

**Was der Spieler sieht und tut**

- Ein Pegel am Kai zeigt Hochwasser und Niedrigwasser. Bei Ebbe fallen Watt und Hafenboden sichtbar trocken, Boote mit flachem Boden setzen sich auf, Kielyachten legen sich nicht schief, weil sie gar nicht erst an solche Plätze dürfen.
- Boote warten vor dem Siel, bis genug Wasser da ist. Beim Antippen eines Bootes zeigt das Spiel, ab wann es einlaufen kann. Rechnen muss niemand.
- **Trockenfallplätze** sind billig zu bauen und bringen bei Plattbodenschiffen und Kuttern Zufriedenheit.
- **Großes Bauprojekt Schleuse:** Danach hält das Hafenbecken das Wasser, die Liegeplätze darin sind unabhängig von der Tide. Das ist das Nordsee-Gegenstück zum Durchstich der Ostsee.
- Die Tide wechselt alle 15 Spieltage zwischen Springtide (mehr Hub) und Nipptide (weniger Hub). Das sorgt für Abwechslung, ohne dass man es planen muss.

## 4. Freischalten

Man beginnt in der Deutschen Ostsee. Wie im Spielplan steht, startet nach dem Abschluss eines Hafens ein neuer Hafen in der nächsten Region. Als Abschluss zählt Stufe 5 (Küstenmarina), damit die teure Stufe 6 freiwillig bleibt. Fertige Häfen bleiben spielbar, man kann zwischen ihnen wechseln, jeder hat seinen eigenen Spielstand. Der Ruf aller Häfen zusammen gibt in einem neuen Hafen ein kleines Startgeld.

| Revier | Frei, wenn |
|---|---|
| Deutsche Ostsee | von Anfang an |
| Dänemark | Deutsche Ostsee erreicht Stufe 5 |
| Schwedische Schären | Dänemark erreicht Stufe 5 |
| Nordsee | Schweden erreicht Stufe 5 |

## 5. Datenformat

Jedes Revier ist ein Objekt in `REVIERE` (`web/js/data/regions.js`). Alle Felder sind Pflicht, außer es steht „optional“ dabei. Farben sind Hex-Strings, die Three.js direkt versteht.

| Feld | Inhalt |
|---|---|
| `id` | kurzer Name, z. B. `ostsee`, wird im Spielstand gespeichert und steht als `region` in den Hafendaten |
| `name`, `hafenname` | Anzeige: Reviername und erfundener Hafenname |
| `vorbilder` | echte Häfen als Anregung |
| `freischalten` | `{ start: true }` oder `{ nach, stufe }`: das Revier `nach` muss diese Stufe erreicht haben |
| `karte` | `id` der Hafendaten. Bis es eigene Karten gibt, nutzen alle `nehrung` aus `harbor.js` |
| `kueste` | `typ` (`nehrung`, `inselkueste`, `schaeren`, `deich-watt`) und Kurzbeschreibung |
| `farben` | `wasserTief`, `wasserFlach`, `strand`, `wiese`, `fels`, `watt` (optional), `himmel`, `dunst` |
| `licht` | je Tagesphase `tag` und `abend`: `himmel`, `sonne`, `boden`, `staerke`, `dunst` (Sichtweite in Metern, optional) |
| `bauweise` | `waende` (Liste), `daecher` (Liste), `dachformen`, `holz`, `akzent`, `fensterAbend`, `fahne` |
| `natur` | `baeume`, `pflanzen`, `tiere`, `deko`: Namen für Modelle, die die Landschaft oder Gebäude bauen |
| `wasser` | `wellen` (0 bis 1), `farbeSchaum`, `tide` (`null` oder `{ hub, periodeTage, springNippTage, springFaktor, phase }`) |
| `wetter` | `windMittel` (Beaufort), `sturm`, `nebel`, `regen`: Wahrscheinlichkeit je Spieltag |
| `schiffe` | `haeufigkeit`: Faktor je Schiffsart (`S1` bis `XL3`, XXL mit Namen, fehlt = 1), `abStufe`: Abweichungen vom Katalog |
| `spiel` | `hafengeld` und `ankuenfte` (Faktor), `naechte` ([min, max]), `abendAnteil` (Anteil des Abends am Spieltag), `startgeld` |
| `platzarten` | zusätzliche Platzarten dieses Reviers (z. B. `fels`, `boje`, `trockenfallen`) |
| `dienste` | besondere Dienste dieses Reviers (zusätzlich zu den allgemeinen) |
| `bauprojekte` | besondere große Bauten (z. B. `seebruecke`, `schleuse`) |
| `ereignisse` | Ereignisse, die es hier gibt |
| `musik` | Hinweis für den Ton: `stimmung`, `instrumente`, `geraeusche` |

**Erweitern:** Neue Felder nur anhängen. Wenn sich die Bedeutung eines Feldes ändert, zählt `REVIER_FORMAT` hoch.

## 6. Schnittstelle im Spiel

`web/js/world/region.js` exportiert `init(game)` und hängt `game.region` an:

| Aufruf | Bedeutung |
|---|---|
| `game.region.daten` | das aktuelle Revier aus `REVIERE` |
| `game.region.setzen(id)` | Revier wechseln, sendet das Ereignis `region` mit den Daten |
| `game.region.wasserstand()` | Wasserstand jetzt in Metern über mittlerem Niedrigwasser, ohne Tide immer 0 |
| `game.region.tiefeJetzt(tiefe)` | Kartentiefe plus Wasserstand |
| `game.region.passt(tiefgang, tiefe)` | passt das Boot gerade an diesen Platz |
| `game.region.naechstesFenster(tiefgang, tiefe)` | in wie vielen Spieltagen genug Wasser da ist (0 = jetzt, `Infinity` = nie) |
| `game.region.licht(phase)` | Lichtfarben für `tag` oder `abend` |

Ereignisse: `region` mit der id als Text beim Start und beim Wechsel (wie in [grundgeruest.md](grundgeruest.md)), `pegel` mit Metern um die Wasserlinie für die Landschaft, `wasserstand` mit `{ hoehe, steigt }` etwa zweimal pro Sekunde, wenn das Revier eine Tide hat.

Wechselt ein anderes Modul das Revier mit `game.emit('region', id)`, geht `game.region` mit. Beim Start gilt `game.state.region` aus dem Spielstand, falls vorhanden.

Zum Ausprobieren: `index.html?revier=nordsee` startet in der Nordsee. Erlaubt sind `ostsee`, `daenemark`, `schweden`, `nordsee`.

Die reinen Rechenfunktionen (`wasserstand(revier, tage)`, `passt(...)`, `naechstesFenster(...)`) sind auch einzeln exportiert, damit Spielregeln und Tests sie ohne 3D nutzen können:

```bash
node tools/test-regionen.mjs
```

## 7. Wer was davon nutzt

| Thread | nutzt |
|---|---|
| Landschaft und Wasser | `farben`, `licht`, `kueste`, `natur`, Wasserstand für die Höhe der Wasserfläche und das Trockenfallen des Watts |
| Häfen mit echten Satellitenbildern vergleichen | `vorbilder`, `bauweise` für Gebäude-Modelle |
| Spielregeln | `passt`, `naechstesFenster`, `schiffe`, `spiel` |
| Ereignisse | `wetter`, `ereignisse` |
| Ton und Musik | `musik` |
| Services | `dienste`, `bauprojekte` |
| Spielstand | `id` des aktuellen Reviers und je Revier ein eigener Hafen |
