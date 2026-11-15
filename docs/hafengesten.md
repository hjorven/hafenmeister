# Überraschende Gesten (P26)

Stand: 14.11.2026. Status: gebaut. Code: `web/js/ui/hafengesten.js`, Klänge in `web/js/audio/audio.js`, Test `tests/specs/hafengesten.spec.mjs` (Handy und PC).

Kleine Dinge, die den Hafen lebendig machen. Bis auf das Hafenhorn ändern sie keine Spielregel und nichts in `data/economy.js`.

## Was es gibt

| Geste | Handy, Tablet | PC | Was passiert |
|---|---|---|---|
| Hafenhorn | Hafenmeisterhaus 0,5 s gedrückt halten | Maus auf dem Haus gedrückt halten | Ein Ring füllt sich am Finger, das Horn tönt, das Haus wippt. Alle offenen Münzen fliegen im Bogen aufs Dach, jede einen Ton höher, dann die Kasse und "+X € in der Kasse". Goldene Schallringe gehen vom Dach aus, Möwen in der Nähe fliegen auf. |
| Fernglas | Doppeltipp auf ein Boot im Hafen | Doppelklick | Fernglas-Rand und Klicken, die Kamera fährt heran und folgt dem Boot. Steckbrief mit Pixelbild, Name, Modell, Heimathafen, Größe, Länge mal Breite, Tiefgang, Stammgast und was das Boot gerade tut. Knöpfe "Im Logbuch" und "Fernglas ab". |
| Möwen | Möwe antippen, Handy schütteln | Taste `H`, Möwe anklicken | Möwen sitzen auf Dächern und im freien Wasser. Aufgescheucht kreisen sie und landen wieder. Boote, die zu nah kommen, scheuchen Möwen im Wasser auf. |
| Wellenring | Freies Wasser gedrückt halten | Maus auf dem Wasser gedrückt halten | Drei Ringe und leises Plätschern, alle 0,65 s neu, solange der Finger liegt. |
| Glocke | Glocke antippen | anklicken | Die Glocke neben dem Hafenmeisterhaus schwingt und schlägt. Abends schwingt sie leise mit, wenn die Schiffsglocke den Tag beendet. |

## Entscheidungen

- **Hafenhorn erst ab Hafenbüro 1**, genau wie der Knopf "Alle kassieren" (`rules.office.collectAllButton`). Vorher steht das Haus nicht. Es nutzt dieselbe Schnittstelle (`ui:collect` mit `{ horn: true }`), damit Ton und Abrechnung nicht doppelt gebaut sind. Kurzes Antippen öffnet weiter das Gästebuch, Halten öffnet es nicht.
- **Fernglas nur für Boote im Hafen und unterwegs**, nicht für wartende Boote an der Boje: Die haben ihre eigene Karte, und am PC fährt Doppelklick sie weiter ein. Das Fernglas endet bei jeder eigenen Kamerabewegung, bei `Esc`, Bauen, Übersicht, Fotorundflug, wenn das Boot verschwindet oder eine wichtigere Meldung kommt (Vorrang 58 im Meldeplatz).
- **Glocke am Hafenmeisterhaus statt am Steg:** Am Steg stünde sie zwischen den Booten im Weg. Sie wandert mit, wenn aus dem Haus das Hafenbüro wird.
- **Schütteln am iPhone** braucht eine Erlaubnis, die Safari nur nach einem Antippen fragt. Darum zeigt der einmalige Möwen-Tipp (nach der ersten angetippten Möwe) auf iOS einen Knopf "Schütteln erlauben".
- **Größen nach Bildschirm:** Münzen, Möwen und Glocke wachsen beim Herauszoomen mit (Meter je Pixel), damit man sie am Handy sieht und trifft. Die Möwen sind dafür größer als echte.
- **Kein Eingriff in Regeln:** Möwen und Ringe nutzen `Math.random` nur für das Aussehen. Nichts davon wird gespeichert, außer ob der Möwen-Tipp schon kam.
- **Rücksicht:** Im Baumodus reagiert keine Geste. Ein zweiter Finger oder eine Bewegung über 10 Pixel bricht das Halten ab (Zoomen und Verschieben gehen vor). Alle Animationen laufen in Echtzeit, also auch in der Pause und unabhängig von 3x und 8x. Nachts fliegen keine Möwen von selbst.

## Schnittstelle

```js
game.hafengesten.moewen()          // [{ zustand: 'sitzt'|'auf'|'kreist'|'landet'|'weg', x, y, z }]
game.hafengesten.aufscheuchen()    // alle Möwen auf (Taste H, Schütteln)
game.hafengesten.hafenhorn()       // wie langes Drücken aufs Haus
game.hafengesten.hornErlaubt()
game.hafengesten.wellenring(x, z)
game.hafengesten.glocke()          // ein Schlag
game.hafengesten.glockeOrt()       // { x, y, z } oder null
game.fernglas.start(bootId), game.fernglas.ende(), game.fernglas.aktiv, game.fernglas.kann(bootId)
```

Ereignisse: `gesten:hafenhorn` `{ muenzen, betrag }`, `gesten:fernglas` `{ boot, an }`, `gesten:moewen` `{ anzahl }`, `gesten:glocke`, `gesten:wellenring` `{ x, z }`.

`ui/input-touch.js` sendet `doubletap` jetzt mit einem Feld `erledigt`: Setzt ein Zuhörer es auf `true` (das Fernglas), zoomt der Doppeltipp nicht.

## Wo es mit anderem zusammenstoßen kann

- **Doppeltipp:** Zoom (input-touch), Einfahren wartender Boote (input-pc Doppelklick). Gelöst über `erledigt` und das Auslassen wartender Boote.
- **Langes Drücken:** Boot gedrückt halten hupt (input-touch `longpress`), Leine ziehen, Münzstrich. Das Wasser-Halten startet nur, wenn unter dem Finger nichts liegt, das Horn nur auf dem Haus.
- **Meldeplatz:** Steckbrief und Möwen-Tipp melden sich dort an und weichen wichtigeren Meldungen.
- **Kamera:** Aufstiegs-Kamerafahrt und Übersicht beenden das Fernglas, nicht umgekehrt.
