# Der Hafen wächst sichtbar

Stand: 14.11.2026. Status: gepflegt. Wunsch von Jorven: Mit jeder Ausbaustufe soll man richtig sehen, wie alles wächst, auch bei den Häusern.

## Was sich je Stufe ändert

| Stufe | Hafengebäude | Ort |
|---|---|---|
| 1 Badesteg | Toilette, zwei Wohnhäuser am Ufer | Fischerdorf: alter Kern mit Kirche und Mühle (40 % der Dorfhäuser), keine Häuserzeile an der Landstraße |
| 2 | Hafenmeisterbude aus Holz mit Klappfenster, Schild und Flaggenmast; Kiosk, Bootsschuppen | Dorf 55 %, erste 4 Häuser an der Landstraße, einzelne Häuser mit zwei Geschossen |
| 3 | Hafenmeisterhaus mit Ausguck, Hafenbüro, Sanitärgebäude | Dorf 70 %, 9 Häuser an der Landstraße |
| 4 | Kiosk mit Holzterrasse und Schirmen, vierter Bootsschuppen, Wohnhäuser am Hafen aufgestockt (Gauben) | Dorf 82 %, 15 Häuser, nah am Hafen zweigeschossig |
| 5 | Hafenmeisterhaus mit Anbau und Antenne, Hafenbüro mit Seitenflügel, weitere Häuser aufgestockt | Dorf 93 %, 22 Häuser |
| 6 Seehafen | Hafenamt mit Lotsenturm und drehendem Radar, Restaurant mit Obergeschoss und Dachterrasse, Stadthäuser mit Läden und Markisen an der Hafenstraße | ganzes Dorf, durchgehende Häuserzeile (31 Plätze), innen dreigeschossig |

Wechselt ein Gebäude beim Aufstieg sein Modell, wächst das neue in knapp einer Sekunde aus dem Boden (wie nach dem Bauen). Jede Stufe zeigt alles aus der vorigen plus Neues; nichts verschwindet beim Aufstieg.

## Technik

- `web/js/render/buildings.js`: Ein Eintrag in `PLAN` kann `v: { stufe: { art?, opt? } }` haben, das Modell ab dieser Stufe. `item.mesh` ist eine Hülle, in der nur das aktive Modell (`item.modell.m`) hängt, damit Box3, Klicks und der Flaggenmast für den Wimpel (features/auszeichnung.js) zum sichtbaren Modell passen. `lage(id, n).mesh` liefert für die Bau-Vorschau das Modell der Stufe n. Lagen ändern sich nicht.
- `web/js/render/landschaft/vielfalt.js`: `dorfWachstum(plan, stufe)` wählt die Dorfhäuser vom Kern nach außen (`DORF_ANTEIL`) und gibt ihnen Geschosse; `hafenortZeile(stufe)` plant die Häuserzeile an der Südseite der Landstraße (y -107, außerhalb der Hafenfläche und aller Bauflächen), von der Hafenmitte nach außen (`HAFENORT_ANZAHL`). Ob ein Platz bebaubar ist (Land, kein Weg, kein Service-Bauplatz, kein Fluss), prüft `setzeBewuchs` in `bewuchs.js` wie bei den Dorfhäusern; die Allee lässt Platz für die Häuser.
- Leistung: Dorf und Häuserzeile sind gebackene Kacheln der Landschaft (wenige Zeichenaufrufe, auch mit 31 Häusern mehr). Die Gebäudemodelle werden je Modell gebündelt (`buendeln.js`), nur das aktive hängt in der Szene.
- Prüfung: `node --test tests/wachstum.test.mjs` (jede Stufe enthält die vorige, Häuserzeile nie auf Hafen- oder Bauflächen, genug Plätze an Land in allen zehn Küstenformen).

## Für Stufe 7 bis 20

Der Plan in [ausbau-stufe-7-20.md](ausbau-stufe-7-20.md) kann hier anknüpfen: `DORF_ANTEIL`, `HAFENORT_ANZAHL` und die `v`-Einträge sind Tabellen je Stufe. Stufe 7 (Hafenstadt) bekommt dann eine zweite Häuserzeile oder höhere Stadthäuser, ohne dass sich Stufe 1 bis 6 ändern (die Reihenfolge der Plätze ist fest).

## Abgrenzung

Stege und Molen wachsen schon über die Daten in `data/harbor.js` und gehören dem Bauen-Thread (Stege nachrüsten). Wimpelmast, Pokale und Ehrentafel gehören den Erfolgen (`features/erfolge-dinge.js`); der Wimpel der Auszeichnung hängt weiter am Flaggenmast des sichtbaren Hafenmeister-Modells.
