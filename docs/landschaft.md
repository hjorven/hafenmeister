# Landschaft, Wasser und Licht

Stand: 11.11.2026. Code: `web/js/render/landscape.js` (Einstieg, wird von `main.js` geladen) und `web/js/render/landschaft/`.

## Was man sieht

- **Gelände in 3D** im Flat-Vector-Stil: Festland mit Strand, Wiese, Wald und Straße, Binnensee, Nehrung mit Dünen, Salzwiesen und kleinen Lagunen, offene See. Die Uferlinien stammen aus `skripte/konzeptbilder/hafen_von_oben.py`, die Wassertiefe an jedem Liegeplatz stimmt mit `web/js/data/harbor.js` überein (Test).
- **Ausbaustufen 1 bis 5** verändern die Landschaft: Graben (Stufe 1 und 2), Durchstich mit Kaimauern, kurzen Molen und ausgebaggertem Becken (Stufe 3), größeres Becken (Stufe 4), Außenhafen mit langen Molen und Kai (Stufe 5). Stufe 6 sieht aus wie Stufe 5.
- **Molen** als Steinschüttung mit unregelmäßigem Rand, Weg auf der Krone und breitem runden Kopf. Molenfeuer stellt `buildings.js`.
- **Buhnen** am Seestrand der Nehrung etwa alle 50 m.
- **Wasser**: klare Tiefenbänder wie auf der Seekarte (Grenzen bei 1, 2, 3 und 4 m), die Fahrrinne ist als dunkleres Band zu sehen, kurze weiße Wellenstriche wandern mit dem Wind, am Ufer atmet ein Brandungssaum.
- **Wartebereich vor der Einfahrt**: gelbe Wartebojen und ein gestrichelter Ankerkreis. Stufe 1 und 2 im Binnensee vor den Stegen, ab Stufe 3 draußen östlich der Fahrrinne, ab Stufe 5 zusätzlich eine Reede für große Schiffe.
- **Ankerfeld für die Nacht**: Im Ankerkreis liegen feste Ankerplätze (kleine helle Punkte) im Abstand des Schwoikreises, nicht auf den Bojen und nicht in der Fahrrinne. Boote, die abends keinen Platz bekommen, liegen dort über Nacht. Anzahl: Stufe 1: 13, Stufe 2: 19, Stufe 3 und 4: je 19, Stufe 5: 19 für L plus 7 für XL. Die Liste ist nach Nähe zur Einfahrt sortiert, also zuerst vorne belegen.
- **Tageslicht** folgt der Spielzeit: Morgen, Mittag, Abendrot, Dämmerung, Nacht. Schatten werden abends lang.
- **Zwei Reviere**: Ostsee (Kiefern, Birken, Buchen, Schilf, Schärenfelsen am Kartenrand) und Nordsee (Deich, hohe Dünen, Watt mit Priel vor der Einfahrt, Pappeln und windschiefe Bäume, graueres Wasser, Gezeiten).

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
| hoch | PC mit mehr als 4 Kernen | 2,0 m | echte Schattenkarte | etwa 200.000 |
| mittel | Tablet, kleinere PCs | 2,6 m | flache Schatten unter Bäumen | etwa 150.000 |
| niedrig | Handy | 3,2 m | flache Schatten unter Bäumen | etwa 76.000 |

Das Wasser ist eine einzige Fläche mit einem kurzen Shader ohne Spiegelung. Bäume, Gras, Schilf, Steine und Buhnen sind Instanzen, also wenige Zeichenaufrufe. Ein Stufenwechsel baut das Gelände in etwa 0,2 s neu (PC).

## Tests

```bash
node --test tests/landschaft.test.mjs
```

Prüft unter anderem: Wassertiefe an allen Liegeplätzen passt zu den Hafendaten, Wartebojen liegen in jedem Revier auch bei Niedrigwasser tief genug, Wege liegen an Land, die Uhrzeit läuft über den Spieltag ohne Sprung zurück.
