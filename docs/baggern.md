# Baggern (P29)

Paket P29 aus der [Roadmap](roadmap.md), Feature F7 (Wassertiefe je Steg als Bauprojekt). Zahlen stehen in `web/js/data/economy.js` unter `baggern` und in [zahlen.md](zahlen.md).

## Was der Spieler merkt

- **Bauen-Menü, Reiter Stege:** Ab Stufe 2 steht je Steg mit flachen Plätzen ein Eintrag „Steg B ausbaggern“ mit Preis, Zieltiefe („2,0 m tief“) und wie viele Plätze tiefer werden. Die Vorschau sagt, welche Bootstypen danach zusätzlich passen, ob die nächste Ausbaustufe den Steg ohnehin tiefer macht („Mit Ausbaustufe 4 wird es hier ohnehin so tief.“) und wie viele Boote zuletzt deswegen weitergefahren sind. Auf dem Wasser zeigt eine blaue Fläche, welche Plätze ausgebaggert werden.
- **„Als Nächstes“** schlägt das Baggern vor, sobald mindestens drei Boote mit zu viel Tiefgang weitergefahren sind (oder zwei, wenn das Geld schon reicht).
- **Beim Bauen:** Ein Stelzenponton mit Bagger und Schute legt sich in die flachste freie Box, die Schaufel holt Schlick hoch und kippt ihn in die Schute, braune Wolken treiben im Wasser, dazu ein Platschen. Danach bleibt das Wasser über den ausgebaggerten Plätzen sichtbar dunkler.
- **Boot ziehen auf eine zu flache Box:** Die Meldung nennt den Grund und, wenn Baggern hilft, den Eintrag im Bauen-Menü.
- **Niedrigwasser:** Bei starkem Wind aus West, Südwest oder Nordwest drückt der Wind das Wasser aus der Ostsee hinaus. Morgens kommt ein Banner („Niedrigwasser: 45 cm unter Mittel“). An diesem Tag passen Boote mit viel Tiefgang nur an tiefe Plätze, und wer schon knapp liegt, sitzt mit dem Kiel im Schlick: ein brauner Fleck unter dem Boot, ein Satz auf der Bootskarte, im Gästebuch „bei Niedrigwasser im Schlick −0,3“.
- **Weggeschickte und weitergefahrene Boote**, die an einem flachen Steg einen freien Platz gehabt hätten, zählen für den Hinweis mit.

## Regeln

**Tiefe eines Platzes.** `sim.berthDepth(berth, stage)` ist das Größere aus der natürlichen Tiefe (`naturalDepth`, wie bisher aus `harbor.js` je Stufe) und `berth.gebaggert`. Die Passregel bleibt unverändert: Tiefgang plus 0,3 m Wasser unter dem Kiel muss in die Tiefe passen (`whyNotFit` gibt `draft`).

**Ausgebaggert** ist ein Steg, wenn `state.buildings['bagger:<Steg>']` gesetzt ist. Damit gehört Baggern zu den Bauwerken: Rückgängig im Bauen-Menü, Speichern und Laden laufen ohne eigenen Code. `sim.syncDredge(state, ctx)` schreibt daraus `berth.gebaggert` (Zieltiefe nach Platzgröße, nur Platzarten `box`, `stirn`, `finger`, nie reservierte Plätze oder Päckchen). Es läuft am Anfang von `tick`, `advanceStage`, `stageUpPreview` und `repairBerths`, damit beim Laden kein Boot aus einer ausgebaggerten Box geworfen wird. Neue Plätze, die ein Stufenausbau später am selben Steg anlegt, sind gleich mit tief.

**Kosten** je Steg: Grundpreis plus je flachem Platz der Meter, die er tiefer wird, mal Preis nach Platzgröße, auf 10 € gerundet. Steg B in Stufe 2 bis 3 kostet so 340 bis 480 €, die Stirnplätze von Steg C in Stufe 4 bis 5 rund 200 €.

**Wann es sich lohnt.** Ohne Niedrigwasser band die Tiefe fast nie: In 6 Testspielen fuhr kein einziges Boot wegen zu viel Tiefgang weiter, die tiefen Plätze außen reichten, abgewiesen wurde wegen voller Stege. Deshalb (bewusste Abweichung vom Plan, der nur die Bauaufgabe nannte) kam das Niedrigwasser dazu, wie es die westliche Ostsee bei Westwind wirklich kennt.

**Niedrigwasser.** `features/baggern.js wasserstand(wetter)`: in Stufe 2 bis 5 (`abStufe` bis `bisStufe`), Wind aus `richtungen` ab Stärke `ab` (Sturm zählt als 1) senkt den Pegel zwischen `tiefe[0]` und `tiefe[1]` Metern, je nach Windstärke. Der Pegel steht in `state.modules.baggern.pegel` und in `ctx.waterLevel`.
- Hook `fit` (Grund `niedrigwasser`): Neue Zuweisungen brauchen Tiefgang plus 0,3 m plus Pegelsenkung. Das steht bewusst nicht in `whyNotFit`, damit `repairBerths` keine liegenden Boote vertreibt.
- Hook `tick`: Wer schon liegt und jetzt zu tief geht, bekommt einmal am Tag `boat.aufGrund` und das Ereignis `aufGrund`. Lag er an einem nicht ausgebaggerten Steg, den Baggern tief genug machen würde, zählt das für den Hinweis.
- Hook `rating`: `anker` weniger beim Ablegen. Im Gästebuch eigener Grund `schlick`.

**Zähler für den Hinweis.** `state.modules.baggern.flach = { Steg: { n, seit } }`. `sim.turnAway` und `sim.dismiss` tragen `zuFlach` (Stege, an denen ein freier Platz nur an der Tiefe scheiterte), `features/baggern.js merken` zählt. Kauf löscht den Zähler des Stegs.

## Prüfen

- `node --test tests/baggern.test.mjs` (Zahlen, Angebot je Stufe und Stegbild, Kauf, Geld, Rückgängig, Laden mit frischem Kontext, Stufenaufstieg, reservierte Plätze, Niedrigwasser, Schlick, Gästebuch, Zähler, „Als Nächstes“)
- Im Spiel: `?stufe=3` und Bauen, Reiter Stege; `?niedrigwasser=jetzt` setzt für den heutigen Tag starken Westwind.
- Balancing: Die Bots in `tools/balance.mjs` und im Zeitraffer kaufen Baggern, sobald mindestens zwei Boote wegen der Tiefe weitergefahren sind.

## Messung

`node tools/balance.mjs --laeufe 40` und `--spieler zeitraffer`, je 40 Läufe, gegen `main` vor P29 (Median Spieltage bis Abschluss Stufe 6):

| Spieler | main | mit P29 |
|---|---|---|
| geschickt | 103 | 102 |
| zeitraffer | 107 | 108 |
| gemütlich | 123 | 128 |

Die Bots kaufen Steg B für 340 bis 480 € um Tag 22 bis 34. Gemütlich erreicht Stufe 6 gleich schnell (Median Tag 108 in beiden), die 5 Tage entstehen allein in Stufe 6, auch wenn Niedrigwasser dort und in Stufe 5 ganz fehlt. Je Spiel schwankt die Dauer von Stufe 6 bei gemütlich um bis zu 38 Tage in beide Richtungen, sobald sich irgendetwas am Verlauf ändert (6 Großschiffe und Ruf 4,5 zum selben Zeitpunkt). Das ist ein Befund für das Balancing, kein Effekt des Baggerns.

## Zusammenspiel

| Mit | Was passiert | Stand |
|---|---|---|
| P34 Wind | Richtung und Stärke kommen aus `events.weather(tag)` (wie der Wind-Thread). Ändert sich dort die Richtung als Grad, ändert sich hier `wasserstand` mit. | geprüft |
| Winterarbeit | Hieß „Hafenbecken ausbaggern“ und klang wie dieses Paket; heißt jetzt „Fahrrinne ausbaggern“ (Wirkung unverändert: mehr L-Boote). | umbenannt |
| Ausbaustufe 4 | Steg B wird natürlich 2,6 m tief, Baggern dort lohnt nur vorher. Die Vorschau sagt das. | Absicht |
| Laden alter Stände | `syncDredge` vor `repairBerths`, sonst flögen Boote aus ausgebaggerten Boxen. | Test |
| Dauerlieger | Grund `niedrigwasser` hat einen eigenen Text, wenn der Platz am Morgen nicht passt. | geprüft |
| P36 Bojenfeld | Beide ändern `economy.js`; Bojen sind keine Platzart für Baggern. | beim Merge |
| Stegbilder | Alle Stegbilder in Stufe 2 bis 6 geben gültige Angebote (Test). | Test |

## Dateien

| Datei | Inhalt |
|---|---|
| `web/js/features/baggern.js` | Regeln ohne Browser (Angebote, Kauf, Niedrigwasser, Hooks) und Modul im Spiel (Vorschau, Bagger, Flächen, Schlick, Banner) |
| `web/js/sim.js` | `berthDepth`, `naturalDepth`, `dredgeTarget`, `syncDredge`, `dredgeWouldHelp`, `zuFlach` bei Abweisen |
| `web/js/data/rules.js` | `rules.dredge` |
| `web/js/ui/bauen.js`, `ui/bauen-rat.js` | Eintrag im Bauen-Menü, „Als Nächstes“ |
| `web/js/ui/hud.js` | Hinweis beim Ziehen, Satz auf der Bootskarte |
| `web/js/ui/gaestebuch-daten.js` | Grund `schlick` |
