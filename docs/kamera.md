# Kamera

Die Kamera umkreist einen Blickpunkt auf dem Wasser und lässt sich frei drehen, neigen und zoomen,
wie in üblichen Aufbauspielen am Handy und PC. Code: `web/js/core/camera.js` (Rig),
`web/js/core/input.js` (Finger und linke Maustaste), `web/js/ui/input-pc.js` (rechte Maustaste, Rad,
Tasten), `web/js/ui/kamera.js` (Kompass).

## Bedienung

| | Handy und Tablet | PC |
|---|---|---|
| Verschieben | ein Finger ziehen, mit Schwung loslassen | linke Maustaste ziehen, `W` `A` `S` `D`, Pfeiltasten |
| Zoomen | zwei Finger spreizen | Mausrad, `+` `-` |
| Drehen | zwei Finger drehen (ab etwa 10 Grad) | rechte oder mittlere Maustaste nach links/rechts ziehen, Umschalt + Rad, `Q` `E` (45 Grad) |
| Neigen | zwei Finger nebeneinander gemeinsam hoch (flacher) oder runter (steiler) | rechte oder mittlere Maustaste nach oben/unten ziehen, Alt + Rad, `R` `V`, `Bild auf` `Bild ab` |
| Zurück | Kompass antippen (Norden oben, 50 Grad), Übersicht | Kompass, Übersicht, `0` |

Bei zwei Fingern entscheiden die ersten 14 Pixel, ob geneigt oder gezoomt/gedreht wird, damit
sich beides nicht vermischt. Schleppleine und Münzstrich fängt `ui/gesten.js` vorher ab, sie
starten nur auf einem wartenden Boot oder einer Münze.

## Grenzen

- Neigung von 86 Grad (fast senkrecht) bis knapp über das Wasser. Je weiter herausgezoomt, desto
  steiler muss der Blick sein: ganz nah 9 Grad, ganz fern 32 Grad. So bleibt der Rand der
  Landschaft außer Sicht, und weit hinten stehen nicht tausende Bäume im Bild.
- Die Sichtlinie zur Kamera bleibt über dem Gelände (`rig.boden` aus `game.landschaft.hoeheBei`),
  sonst wird sie steiler.
- Dunst zum Horizont (`scene.fog` in `core/game.js`, Farbe folgt dem Himmel): erst weit hinter dem
  Blickpunkt, von oben nicht zu sehen. Das Wasser rechnet ihn im Shader mit.
- Der Blickpunkt bleibt im Spielbereich (`rig.bounds`, `WORLD` in `js/main.js`). `weltAnForm` setzt
  ihn aus `game.gelaende.spielRect()`: Hafen, Einfahrt, Leuchttürme und nahe Inseln.
- Weiteste Zoomstufe `rig.maxWidth` = Breite von `spielRect()`, 800 bis 1000 m. Ganz herausgezoomt
  ist der Küstentyp zu erkennen; die Bildzeit am Handy ist dabei wie bei 420 m.
- `rig.rand` = `game.gelaende.aussenRect()`: Der Blickpunkt hält seitlich mindestens 0,55
  Ausschnittbreiten Abstand zum Rand der Landschaft, so kommt deren Kante nie ins Bild.

## Startansicht

Die Startansicht (`rig.reset()`, Rechteck aus `startRect` in `main.js`) zeigt die Liegeplätze der
Stufe, nahe Wartebojen, Bauplätze und Landmarken und links und rechts etwas Ufer. Übrige Tiefe
kommt zu 70 % nach Norden (Wasser, Einfahrt), zu 30 % nach Süden. Im Hochformat liegt der Hafen
unten im freien Bereich.

Am Handy quer (`rig.handyQuer`) ist die Höhe knapp und das Ufer vor der Kamera wächst in der
Schrägsicht stark an. Dort ist die Startansicht enger: Bauplätze an Land ziehen den Ausschnitt
höchstens 15 m (oder ein Fünftel der Hafentiefe) nach Süden, das Ufer zur Seite reicht nur bis
zur 1,2-fachen statt 1,6-fachen Hafenbreite, übrige Tiefe kommt zu 88 % nach Norden, und der
Hafen liegt mittig. Test: `kamera.spec.mjs` "Handy quer: Startansicht zeigt den Hafen gross und mittig".

## Schnittstelle für Module

```js
const rig = game.camera;
rig.camera            // aktive Three.js-Kamera (Perspektive, in der Pixel-Fassung orthografisch)
rig.yaw, rig.pitch    // Bogenmaß; rig.yawGrad, rig.pitchGrad in Grad
rig.viewWidth         // sichtbare Breite in Metern am Blickpunkt (Zoom); rig.distance Abstand der Kamera
rig.rotateFree(rad)   // sofort drehen;  rig.rotateBy(rad) weich
rig.tiltFree(rad)     // sofort neigen (positiv = steiler); rig.tiltBy(rad), rig.setPitch(grad) weich
rig.release()         // Ziehen beendet: Drehen und Neigen laufen mit Schwung aus
rig.fling(vx, vy)     // Verschieben mit Schwung (Pixel pro Sekunde); rig.stop() hält an
rig.ausrichten()      // weich zu Norden oben und 50 Grad, Ort und Zoom bleiben
rig.reset()           // Startansicht der Stufe
rig.handyQuer         // Handy im Querformat (breiter als hoch, unter 500 px hoch)
rig.setProjektion('ortho' | 'perspektive')
rig.screenToWorld(x, y)   // Punkt auf dem Wasser, null über dem Horizont
```

`rig.snapRotation()` gibt es noch, heißt jetzt aber nur "loslassen" (kein Einrasten mehr).
Wer `rig._apply` überschreibt, bricht die Neigung: Neigung immer über `rig.pitch` oder `rig.setPitch`.
