# Wege der Menschen auf dem Gelände

Stand: 15.11.2026. Status: gepflegt. Fund B aus dem Arbeitsplan: Die Menschen liefen auf festen Koordinaten (alte Nehrung, Uferweg, Dorfstraße) und damit auf den neuen Küsten teils durch Wasser oder ins Leere.

## Wie das Wegenetz entsteht

Code: `web/js/people/netz.js` (ohne Three.js), aufgerufen von `web/js/render/people.js`.

1. **Bodenraster** über den Laufbereich (x -420 bis 430, y -200 bis 520, alle 3 Planeinheiten = 1,9 m) aus `punkt()` des Geländes: Höhe und Bodenart. Begehbar ist trockenes Land ab 0,2 m über dem Wasser (darunter nasse Wiese und Pfützen), nicht Schilf, Steinschüttung oder Watt. Die erste Zelle am Wasser bleibt frei (1,9 m Abstand), damit niemand an Kaikanten oder am Strand ins Wasser tritt. Das Raster wird je Stufe, Region und Küste gemerkt (erster Aufbau rund 0,3 bis 0,8 s, danach 50 bis 100 ms).
2. **Kosten je Boden:** Wege und Pflaster 0,55, Wiese 1, Sand 1,1, Dünen 1,5, Wald 1,8, Felder 2,2 bis 2,4. Die Leute bleiben so auf Wegen und laufen nicht quer durchs Rapsfeld.
3. **Hindernisse:** Grundrisse aller Gebäude, Services und Anlagen (jedes Bauteil über 1 m Höhe, mit 0,9 m Abstand), Deko-Stücke, die Dorfhäuser und die Häuserzeile aus `landschaft/vielfalt.js` (je Stufe, sobald `dorfWachstum` und `hafenortZeile` da sind), Kirche, Mühle und Höfe.
4. **Laufnetz:** ein Knoten je 6 Planeinheiten auf freiem Boden, Kanten zu den acht Nachbarn nur bei freier Sicht über begehbaren Boden und ohne Hang über 0,55 m je Meter. Dazu Stege, Kais und Piers aus `data/harbor.js` (je Stegbild), die Molen aus `gelaende.js` und die Seebrücke aus `landschaft/strand.js` als Linien; ihre Enden hängen am nächsten Laufknoten (höchstens 11 Einheiten weg).
5. **Ziele:** Türen der Gebäude, Steg- und Molenköpfe, Seebrückenkopf, Strandplätze auf Sand außerhalb des Hafens mit Badestelle im flachen Wasser davor (dahinter muss offenes Wasser liegen, kein Bach), dazu Aussichtspunkte am Ufer für Küsten ohne Sandstrand.
6. **Woher die Leute kommen:** Spaziergänger aus Dorfhäusern, Wohnhäusern und von den Straßenenden am Kartenrand; Badegäste von der Wiese hinter dem Strand.

`netz.weg(a, b)` sucht mit A* und zieht den Weg danach gerade, aber nur über gleich guten Boden. Auf dem Boden folgt die Figur beim Gehen der Geländehöhe.

## Prüfen

- `node --test tests/menschen.test.mjs`: alle Stufen, alle Küstenformen in Stufe 1 und 6: jeder Weg zu Toilette, Kiosk und Restaurant nur über trockenes Land und nie durch einen Grundriss, Strandplätze an Land, Badestellen im flachen Wasser.
- Im Spiel: `?stufe=4&leute=voll&gelaende=N&seed=S` belegt alle Plätze. Gemessen über alle zehn Küsten (Stufe 1, 3, 5, 6, mit Stegbild): keine Figur im Wasser.
- Vorschaubilder: `/mnt/project-files/menschen/gelaende/`.

## Bekannte Grenzen

- Die Seepiers der Stufe 6 (P, MA) beginnen auf manchen Küsten im Wasser. Crews dort bleiben auf dem Pier (Aussicht am Kopf), bis die Anlagen ein Stück Land an die Wurzel legen.
- Steilküste, Förde, Watt und Schären haben kaum oder keinen Sandstrand; dort gibt es keine Badegäste, nur Aussichtspunkte am Ufer.
