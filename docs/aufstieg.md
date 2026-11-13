# Aufstieg feiern und Endlosspiel

Stand: 13.11.2026. Paket P16 der [Roadmap](roadmap.md) (Ü23, D10, I8, I9). Code: `web/js/features/aufstieg.js`, Aussehen: `web/css/aufstieg.css`, Zahlen: `ECONOMY.endlos` in `web/js/data/economy.js`, Tests: `tests/aufstieg.test.mjs`.

## Was der Spieler sieht

| Anlass | Was passiert |
|---|---|
| Aufstieg zur nächsten Stufe | Das Spiel pausiert, die Kamera fährt auf den ganzen Hafen und kreist langsam. Eine Karte zeigt die neue Stufe, die Zahlen der alten Stufe (Tage, Gäste, Einnahmen, bester Tag, Ruf), "Neu im Hafen" und das nächste Ziel. "Weiter" (oder Enter, Escape) schließt, die Kamera fährt zurück, das Spiel läuft im alten Tempo weiter. |
| Region fertig ausgebaut (`sim:regionDone`) | Größere Feier mit Wimpeln und Feuerwerk, Titel "Hafenmeister der Ostsee", Zahlen der ganzen Region, Chronik aller Stufen, Knopf "Weiterspielen". |
| Endlosspiel | Das Ziel-Schild links zeigt "Saison n" mit vier Saisonzielen, Rang und Sternen. |
| Saisonende im Endlosspiel | Saisonbilanz: jedes Ziel mit Haken oder Kreuz, Belohnung, Sterne, neuer Rang. |

"Hafen ansehen" macht die Karte klein, damit man die Kamerafahrt sieht. Greift der Spieler selbst zur Kamera (Ziehen, Mausrad), endet die Fahrt und er behält seine Ansicht. Bei "Bewegung reduzieren" springt die Kamera ohne Fahrt.

"Neu im Hafen" kommt nur aus den Spielzahlen: Plätze des Ausbaus, Stegprojekte der neuen Stufe, neue Bootsgrößen im Ankunftsmix, Bauwerke, Services und Hafenbüro mit `abStufe` gleich der neuen Stufe. Nichts wird versprochen, was es nicht gibt.

## Saisonziele

Nach dem Abschluss der Region bekommt jede Saison vier Ziele:

| Ziel | Wert in Saison 1 | je weitere Saison | höchstens |
|---|---|---|---|
| Gäste in dieser Saison | 900 | +60 | 1.300 |
| Ruf am Saisonende | 4,4 | +0,05 | 4,8 |
| Besuche großer Schiffe | 5 | +1 | 9 |
| Einnahmen (ungerade Saisons) | 150.000 € | +10.000 € | 230.000 € |
| Gäste der Größe XL (gerade Saisons) | 40 | +5 | 80 |

Gemessen mit `node tools/balance.mjs --verlauf 1`: In Stufe 6 kommen etwa 45 Gäste und 8.000 € am Tag. Beginnt das Endlosspiel mitten in der Saison, gelten die Zählziele anteilig; bei weniger als 8 Resttagen beginnen die Ziele mit der nächsten Saison. Gewertet wird in der Nacht des letzten Saisontags, die nächste Saison beginnt nach dem Winter.

Belohnung: 5.000 € je erreichtem Ziel, 10.000 € dazu, wenn alle vier erreicht sind. Jedes erreichte Ziel gibt einen Stern. Ränge: Hafenmeister (0), Leitender Hafenmeister (4), Hafenkapitän (10), Hafendirektor (18), Ehrenhafenmeister (28 Sterne).

## Schnittstellen

- Hooks: `night` (XL-Gäste zählen, besten Tag merken, Saison werten und beginnen), `stageUp` (Zahlen der alten Stufe festhalten).
- Ereignisse: `sim:seasonEnd` `{ jahr, saison, ziele, erreicht, sterne, belohnung, rang, neuerRang }`, `sim:seasonStart` `{ jahr, saison, ziele }`, `feier:auf` und `feier:zu` `{ art: 'stufe' | 'region' | 'saison' }`.
- `game.aufstieg`: `zielDaten()` (für das Ziel-Schild in `ui/oberflaeche.js`), `saisonStand()`, `offen`, zum Ausprobieren `zeigeStufe(n)` und `zeigeRegion()` (ohne Wirkung auf den Spielstand).
- Spielstand: `state.modules.aufstieg` = `{ chronik, stufen, xl, endlos }`, übersteht Speichern und Laden. Ein alter Stand ohne Chronik zählt die laufende Stufe ab dem Laden.
- Spielstandwechsel: Über das Spielstand-Menü lädt die Seite neu, eine offene Feier verschwindet damit. Ein neues Spiel ohne Neuladen (`game.sim.newGame`, meldet `sim:change` mit `reason: 'load'`) schließt eine offene Feier und leert die Warteschlange (Browsertest `tests/specs/aufstieg.spec.mjs`).
- Kamerafahrt: setzt `target`, `viewWidth`, `yaw`, `pitch` des Kamera-Rigs und ruft `_apply()`, wie `ui/bauen.js`. Die Startansicht kommt aus `rig.reset()`.

## Entscheidungen (P16-Thread, 13.11.2026, Jorven schlief)

- Keine Nordsee-Taste in der Abschlussfeier: Die Nordsee ist noch nicht spielbar (P57), nur "Weiterspielen".
- Das Spiel pausiert während jeder Feier, damit nichts verpasst wird.
- Am Handy sitzt die Karte im unteren Teil (höchstens 54 % der Höhe), quer rechts; Kopf und Knöpfe bleiben immer sichtbar, nur die Zahlen dazwischen scrollen.
