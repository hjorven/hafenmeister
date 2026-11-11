# Hafenregionen

Stand: 11.11.2026. Ergänzt Abschnitt 9 im [Spielplan](plan.md). Dieses Dokument beschreibt die zwei Reviere des Spiels, Ostsee und Nordsee: was sie im Aussehen und im Spielgefühl unterscheidet, wie man sie freischaltet und wie sie als Daten beschrieben sind. Die Daten liegen in `web/js/data/regions.js`, die Rechenfunktionen (Wasserstand, Tidenfenster) in `web/js/world/region.js`.

**Entscheidung Jorven (11.11.2026):** nur zwei Regionen, keine länderspezifischen. Gebäude und Stimmung sind ein Mix aus deutschen, dänischen und schwedischen Häfen, weil sich die Hafenkulturen nicht stark genug unterscheiden, um eigene Regionen zu tragen.

## 1. Die Idee

Jedes Revier ist ein eigener Hafen, den man vom Badesteg bis zur großen Marina ausbaut. Die sechs Ausbaustufen aus dem [Spielplan](plan.md#4-ausbaustufen) bleiben in beiden Revieren gleich, damit Spielregeln, Schiffe und Oberfläche nur einmal gebaut werden müssen. Die Reviere unterscheiden sich in Aussehen, Küste, Spielgefühl und einer großen Besonderheit: Die Nordsee hat Ebbe und Flut.

| Revier | Vorbilder | Küste | Besonderheit |
|---|---|---|---|
| Ostsee (Dünenhafen) | Burgtiefe, Heiligenhafen, Marstal, Svendborg, Smögen, Sandhamn | Binnensee hinter Nehrung, Dünen, Strand, Schärenfelsen am Rand | Start, ruhiges Wasser, Mix aus drei Hafenkulturen |
| Nordsee (Sielhafen) | Neuharlingersiel, Greetsiel, Büsum | Deich, Watt, Priele, Sielhafen | Ebbe und Flut, Boote kommen nur im Tidenfenster |

Die Vorbilder sind Anregungen. Die Häfen im Spiel bekommen erfundene Namen.

## 2. Die Reviere im Einzelnen

### Ostsee: Dünenhafen

- **Küste:** Festland, Binnensee, Nehrung mit Dünen und Strandhafer, dahinter die offene Ostsee. Genau die Karte aus [Hafen und Schiffe](hafen-und-schiffe.md). Am Rand glatt geschliffene Schärenfelsen.
- **Farben:** helles Türkis, cremiger Sand, sattes Wiesengrün. Viel Sonne, wenig Nebel.
- **Bauweise als Mix:** weiße Bäderarchitektur und Backstein mit roten Ziegeln (Deutschland), gelbes Fachwerk und Reetdächer (Dänemark), falunrote Holzhäuser mit weißen Ecken und Bootsschuppen in Reihe an einer Holzpromenade (Schweden). Strandkörbe in Blau-Weiß und Grün-Weiß.
- **Natur:** Kiefern, Birken und Buchen, Kartoffelrosen, Heckenrosen, Heidekraut, Möwen, Schwäne, Eiderenten.
- **Spielgefühl:** gemütlicher Einstieg mit vielen kleinen Booten. Holzklassiker und Traditionssegler sind etwas häufiger. Liegeplätze am Fels mit Heckanker und ein Bojenfeld sind günstige Erweiterungen.
- **Besondere Dienste:** Strandkorbvermietung, Eisdiele, Fischbrötchen, Räucherei, Fahrradverleih, Sauna-Floß.
- **Ereignisse:** Segelwoche (Regatta), Hafenfest, Holzbootfestival, Mittsommerfest, Sommergewitter, Kreuzfahrttag.

### Nordsee: Sielhafen

- **Küste:** grüner Deich mit Schafen, davor Salzwiesen und Watt, ein Priel als Fahrrinne, der Hafen liegt hinter dem Siel im Deich.
- **Farben:** graublaues Wasser, braungraues Watt bei Ebbe, weiter Himmel, häufiger Dunst.
- **Bauweise:** dunkelroter Klinker, Giebelhäuser, rot-weißer Leuchtturm, Krabbenkutter in Grün und Blau.
- **Natur:** Salzwiesen, Strandflieder, Schafe am Deich, Austernfischer.
- **Spielgefühl:** Ebbe und Flut, siehe Abschnitt 3. Krabbenkutter und Seenotretter gehören von Anfang an dazu, Inselfähren kommen ab Stufe 5. Mehr Wind und öfter Sturm.
- **Besondere Dienste:** Fischbrötchen, Krabbenverkauf, Wattführung, Inselfähre, Schleuse als großes Bauprojekt.
- **Ereignisse:** Sturmflut, Kutterkorso, Krabbenfest, Kreuzfahrttag.

## 3. Ebbe und Flut in der Nordsee

Nur die Nordsee hat einen spürbaren Tidenhub. In der Ostsee schwankt der Wasserstand so wenig, dass das Spiel ihn ignoriert.

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

Man beginnt an der Ostsee. Sobald der Ostseehafen Stufe 5 (Küstenmarina) erreicht, wird die Nordsee frei. Stufe 6 bleibt damit freiwillig. Beide Häfen bleiben spielbar, jeder hat seinen eigenen Spielstand. Der Ruf des Ostseehafens gibt an der Nordsee ein kleines Startgeld.

## 5. Datenformat

Jedes Revier ist ein Objekt in `REVIERE` (`web/js/data/regions.js`). Alle Felder sind Pflicht, außer es steht „optional“ dabei. Farben sind Hex-Strings, die Three.js direkt versteht.

| Feld | Inhalt |
|---|---|
| `id` | kurzer Name, z. B. `ostsee`, wird im Spielstand gespeichert und steht als `region` in den Hafendaten |
| `name`, `hafenname` | Anzeige: Reviername und erfundener Hafenname |
| `vorbilder` | echte Häfen als Anregung |
| `freischalten` | `{ start: true }` oder `{ nach, stufe }`: das Revier `nach` muss diese Stufe erreicht haben |
| `karte` | `id` der Hafendaten. Bis es eigene Karten gibt, nutzen alle `nehrung` aus `harbor.js` |
| `kueste` | `typ` (`nehrung` oder `deich-watt`) und Kurzbeschreibung |
| `farben` | `wasserTief`, `wasserFlach`, `strand`, `wiese`, `fels`, `watt` (optional), `himmel`, `dunst` |
| `licht` | je Tagesphase `tag` und `abend`: `himmel`, `sonne`, `boden`, `staerke`, `dunst` (Sichtweite in Metern, optional) |
| `bauweise` | `waende` (Liste), `daecher` (Liste), `dachformen`, `holz`, `akzent`, `fensterAbend`, `fahne` |
| `natur` | `baeume`, `pflanzen`, `tiere`, `deko`: Namen für Modelle, die die Landschaft oder Gebäude bauen |
| `wasser` | `wellen` (0 bis 1), `farbeSchaum`, `tide` (`null` oder `{ hub, periodeTage, springNippTage, springFaktor, phase }`) |
| `wetter` | `windMittel` (Beaufort), `sturm`, `nebel`, `regen`: Wahrscheinlichkeit je Spieltag |
| `schiffe` | `haeufigkeit`: Faktor je Schiffsart (`S1` bis `XL3`, XXL mit Namen, fehlt = 1), `abStufe`: Abweichungen vom Katalog |
| `spiel` | `hafengeld` und `ankuenfte` (Faktor), `naechte` ([min, max]), `abendAnteil` (Anteil des Abends am Spieltag), `startgeld` |
| `platzarten` | zusätzliche Platzarten dieses Reviers (Ostsee `fels`, `boje`; Nordsee `trockenfallen`) |
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
| `game.region.setzen(id)` | Revier wechseln, sendet das Ereignis `region` mit der id |
| `game.region.wasserstand()` | Wasserstand jetzt in Metern über mittlerem Niedrigwasser, ohne Tide immer 0 |
| `game.region.tiefeJetzt(tiefe)` | Kartentiefe plus Wasserstand |
| `game.region.passt(tiefgang, tiefe)` | passt das Boot gerade an diesen Platz |
| `game.region.naechstesFenster(tiefgang, tiefe)` | in wie vielen Spieltagen genug Wasser da ist (0 = jetzt, `Infinity` = nie) |
| `game.region.licht(phase)` | Lichtfarben für `tag` oder `abend` |

Ereignisse: `region` mit der id als Text beim Start und beim Wechsel (wie in [grundgeruest.md](grundgeruest.md)), `pegel` mit Metern um die Wasserlinie für die Landschaft, `wasserstand` mit `{ hoehe, steigt }` etwa zweimal pro Sekunde, wenn das Revier eine Tide hat.

Wechselt ein anderes Modul das Revier mit `game.emit('region', id)`, geht `game.region` mit. Beim Start gilt `game.state.region` aus dem Spielstand, falls vorhanden.

Zum Ausprobieren: `index.html?revier=nordsee` startet in der Nordsee. Erlaubt sind `ostsee` und `nordsee`, statt `revier` geht auch `region`.

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
