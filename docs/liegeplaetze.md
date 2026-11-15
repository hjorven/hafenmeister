# Liegeplätze passgenau

Stand: 15.11.2026. Status: gepflegt.

Wo genau ein Boot an seinem Platz liegt, rechnet `web/js/data/liegelage.js` für Spielregeln, Bootsanimation und Prüfung gleich. Anlass waren Funde aus dem Härtetest (docs/extremtest.md): L-Boote ragten an Stegköpfen auf den Steg, ein 38-m-Segler an K01 lag halb auf der Mole und auf dem Fischerboot an FK01, die Korvette streifte eine Sandbank.

## Regeln

- **Box und Finger:** Bug 0,3 m vor dem stegseitigen Ende der Box. Ist das Boot länger als die Box, ragt es achtern über die Heckpfähle hinaus, nie vorn in den Steg.
- **Längsseits** (Stirnplatz, Kai, Fischer, Yachtsteg): Bordwand mit 0,3 m Fender an der Stegkante (an Kai und Pier wie das gezeichnete Boot, weil die Kaikante der Zeichnung nicht überall genau an der Mauer liegt). Ein breites Boot liegt weiter draußen.
- **Abschnitt am Steg:** Jeder Längsseitsplatz hat sein Stück bis zur Mitte zum Nachbarn am selben Steg (1 m Abstand zwischen den Booten), an einem freien Stegende bis 4 m darüber hinaus, an Kai und Pier 1 m vor dem Ende, an der Wurzel am Ufer 5 m davor. Darin liegt das Boot so nah an der gezeichneten Mitte wie möglich.
- **Länger als der Abschnitt** (nur am Kai und am Yachtsteg): Das Boot nimmt Platz vom Nachbarn. Die Passregel lässt es nur zu, wenn das Boot am Nachbarplatz (auch eines, das gerade ablegt) nicht im Weg ist, Grund `nachbar` (sim.js `hookWhyNotFit`). Am Kai heißt das zum Beispiel: Liegt an K01 ein 38-m-Segler, ist K02 zu, K03 bleibt frei.
- **Steg im Weg:** Stößt das größte erlaubte Boot trotzdem an einen Steg, Pfahl, Dienstplatz oder festes Gerät, kürzt `platzGrenzen` die Höchstlänge in dieser Stufe (`berth.maxLengthAt`, sim.js `berthMaxLength`). Im Grundbild und allen Stegbildern betrifft das zurzeit keinen Gastplatz.

Geändert an den Daten (skripte/konzeptbilder/hafen_von_oben.py, neu exportiert): Die drei Boxen C20 bis C22 auf der Ostseite des Knicks von Steg C liegen 3 Einheiten weiter südlich (C22 ragte sonst in den Stegkopf), die Fischerplätze FK01 und FK02 liegen weiter nördlich am Fischereikai (FK01 lag sonst dort, wo das Schiff an K01 liegt). Das Hafenbecken ab Stufe 3 reicht im Westen bis x -156 statt -150 (Stegbilder legen Steg A teils bis an den Rand, bei Fels am Beckenrand lag das Heck sonst an Land).

Besuchsschiffe (Korvette auf Küste 4): Der Weg vom Kartenrand weiter hinaus auf See (render/boat-view.js `hinaus`) prüft die ganze Rumpfbreite statt nur die Mittellinie und folgt dem tiefen Wasser bis 60 Grad schräg zum Rand, so kommen die Schiffe im Bodden durch das schräge Seegatt bis aus dem Bild. `seeWeg` nimmt den Ausgang, hinter dem das Schiff frei aus dem Bild kommt, sonst den, hinter dem es am weitesten hinaus kommt. In render/services-besuch.js sucht `wege` den freien Startpunkt nur noch innerhalb der Fahrwasserkarte (außerhalb gilt alles als frei, auch Land: das Kreuzfahrtschiff sprang im Bodden quer über das Ufer).

## Prüfen

```bash
node tools/liegeplaetze/pruefen.mjs
node tools/liegeplaetze/pruefen.mjs --stegbild 5 --form 4 --seed 53
node --test tests/liegeplaetze.test.mjs
```

Das Werkzeug legt an jeden Platz das größte Boot, das die Spielregeln dort zulassen (Länge und Breite getrennt, also eher zu streng), und meldet jeden Schnitt mit Steg, Heckpfahl, Dienstplatz, festem Gerät, Seebrücke, Land (Rumpf 0,3 m schmaler, Bug und Heck laufen spitz zu) oder dem Boot an einem anderen Platz. Der Test prüft alle Stegbilder auf Küste 1 und alle Küstenformen mit drei Seeds.
