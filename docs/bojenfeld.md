# Bojenfeld im See (P36, F10)

Stand: 22.11.2026. Status: gebaut. Paket P36 aus der [Roadmap](roadmap.md), Welle 3.

Ab Ausbaustufe 2 kannst du im See vor den Stegen Muringbojen auslegen. Sie sind billig, bringen schnell Plätze für kleine Boote und eignen sich für volle Tage, an denen keine Box mehr frei ist. Dafür gibt es dort weder Strom noch Wasser, Gäste zahlen weniger und liegen offen im Wind.

## So spielt es sich

- **Bauen:** Im Baumenü, Reiter "Stege", steht "Bojenfeld im See" (6 Bojen, 240 €, ab Stufe 2). Ab Stufe 4 folgt "Bojenfeld erweitern" (6 Bojen mehr, 900 €). Der nächste Abschnitt steht schon eine Stufe vorher gesperrt da. Die Vorschau zeigt jede Boje mit ihrem Schwoikreis (gelb) und fährt die Kamera hin. Rückgängig im Baumenü deckt den Kauf ab.
- **Im Spiel:** weiße Muringbojen mit blauem Band schaukeln im See. Ein Boot fährt mit dem Bug an die Boje, macht mit einer Leine fest und dreht sich mit dem Wind (wie an den Wartebojen).
- **Zuweisen:** Ein wartendes Boot auf eine Boje ziehen oder erst das Boot und dann die Boje antippen, wie bei einer Box. Passende Bojen leuchten dabei wie Boxen. Ein Grün-Rot-Schild gibt es an Bojen nicht (kein Steg, an dem es stehen könnte).
- **Wer passt:** Boote der Größen S und M bis 9 m Länge und 3,4 m Breite. Wünsche am Platz (Strom, Wasser, Lage am Steg) bleiben an der Boje unerfüllt; Wünsche an Land (Dusche, Essen) erfüllt der Hafen wie sonst. Gäste ohne Wünsche sind dort also so zufrieden wie in einer Box, Gäste mit Platz-Wünschen bewerten schlechter.
- **Geld:** An der Boje zahlt der Gast 60 % des Hafengelds derselben Nacht (wirkt auch auf Kurzhalter, Wunschbonus und Preisstufe).
- **Wetter:** Bojen liegen offen (`exposed`): bei Sturm und Starkwind gilt der Malus für offene Plätze wie am Außensteg.
- **Automatik:** Hafenbüro, "Einfahren lassen" und Boote, die nach 8 s selbst einfahren, nehmen eine Boje erst, wenn keine passende Box frei ist (`letzteWahl`). Das Feld füllt sich so nur an vollen Tagen von selbst.
- **Kein Dauerplatz:** Eine Boje kann nicht als Dauerplatz vermietet werden, und ein Stammgast an der Boje wird dort nicht zum Dauerlieger.
- **Ausbauziel:** Das Bojenfeld ist freiwillig. Ungebaute Bojen zählen nicht als fehlende Plätze im Ziel der Region.

## Wo die Bojen liegen

`web/js/render/landschaft/bojenfeld-lage.js` sucht je Küste, Seed, Revier und Stegbild einen Block im Raster (22 Planeinheiten, rund 14 m, sonst 19). Der erste Abschnitt liegt so nah wie möglich an den Stegen der Stufe 2, der zweite schließt an den ersten an. Jede Boje muss:

- in jeder Stufe 2 bis 6 tief genug sein, im ganzen Schwoikreis (10 m) und bei Niedrigwasser (1,6 m plus 0,2 m Reserve),
- Abstand halten zu Stegen, Diensten und Molen aller Stufen (30), zu jedem Liegeplatz (24), zum Weg von den Stegen zum Seegatt (`natur().route`, 14 neben der Fahrrinne) und zum Schwimmwellenbrecher ab Stufe 4 (Schwoikreis plus 2 m),
- weg sein von Wartebojen (30), Ankerfeld (20 über den Rand), Pricken, dem Uferstreifen des Paddlers und der Runde der Freizeitboote der Stufe 2 sowie von der Einfahrt ab Stufe 3,
- südlich von y 205 liegen (nie im Außenhafen oder an der Großschiffspier).

Findet sich so kein Feld, sucht es mit kleineren Abständen noch einmal (`lockern`, zwei Stufen). Hat eine Küste nur für einen Abschnitt Platz, gibt es dort nur den ersten; hat sie keinen, steht das Bojenfeld nicht im Baumenü.

Gemessen (15 Küsten mit je 10 Seeds): Ostsee überall mindestens 6 Bojen, in 132 von 150 Fällen alle 12; nur 6 vor allem auf Schären (6 von 10 Seeds), Steilküste und Watt (je 3). Nordsee: 93 von 150 mit 12, 42 mit 6, 15 ohne Bojenfeld (Küste 14 bei allen Seeds, Schären bei 5), weil dort bei Niedrigwasser zu wenig Wasser bleibt. Die Nordsee kommt erst mit P57 ins Spiel; dann lohnt ein zweiter Blick. Die Suche dauert je Küste rund 0,2 bis 1 s und wird zwischengespeichert.

Die Wartebojen und Ankerfelder der Stufen 3 bis 6 liegen auf allen 15 Küsten (Seeds 1 bis 3, beide Reviere) mindestens 20 Planeinheiten vom Bojenfeld entfernt (`tests/bojenfeld.test.mjs` prüft Stufe 2 bis 6).

## Zusammenspiel

- **Verkehr:** Die Fahrwasser-Karte (`render/boat-view.js`) macht jede Boje zu einer weichen Zone (Radius 12 m), Boote fahren lieber außen herum. Die Freizeitrunde (`render/boats/verkehr.js`), das Jugendtraining (`render/jugend-bild.js`) und der Seeweg der großen Schiffe meiden die Bojen.
- **Menschen, Stegnetz, Liegelage:** Bojen haben keinen Steg; `people/netz.js`, `data/liegelage.js`, `data/verkehr.js` (Uferstrecke) und `world/fahrwasser.js` überspringen sie.
- **Flottillen:** Das Bojenfeld zählt für Flottillen wie ein eigener Steg "BF". Weil Bojen die letzte Wahl sind, schlägt der Funk es nur vor, wenn an keinem Steg Platz für die ganze Gruppe ist.
- **Bauen-Rat:** "Als Nächstes" schlägt das Bojenfeld nur vor, wenn kein Stegprojekt mehr offen ist.

## Gefunden, nicht in diesem Paket

- Der Schwimmwellenbrecher ab Stufe 4 (`SCHWIMMWELLENBRECHER` in `render/landschaft/gelaende.js`, gezeichnet von `render/buildings.js`) steht seit dem 27.11. als hartes Hindernis in der Fahrwasser-Karte der Boote (`render/boat-view.js`, dieselbe Kurve wie das Modell). Er endet westlich von Steg B und C, damit vor deren Kopfplätzen Fahrwasser bleibt. Das Bojenfeld hält weiter Abstand zu ihm.

## Zum Ausprobieren

`?stufe=2&bojenfeld=1` legt im Testmodus den ersten Abschnitt gleich an, `?stufe=4&bojenfeld=2` beide. Mit `&gelaende=n&seed=s` auf einer festen Küste.

## Dateien und Zahlen

| Was | Wo |
|---|---|
| Zahlen | `ECONOMY.bojenfeld` in `web/js/data/economy.js` |
| Plätze BF01 bis BF12 | `web/js/data/bojenfeld.js` (läuft am Ende von `stegbildSetzen`) |
| Lage im Gelände | `web/js/render/landschaft/bojenfeld-lage.js` |
| Baumenü, Kauf, Vorschau | `web/js/features/bojenfeld.js`, `web/js/ui/bauen.js` |
| Regeln | `web/js/data/rules.js` (`berthKinds.boje`, `buoyField`), `web/js/sim.js` |
| Zeichnen | `web/js/render/stege.js` (`muringboje`) |
| Tests | `tests/bojenfeld.test.mjs` |

Schnittstelle: `game.bojenfeld = { angebote(), kaufen(id), geist(id), ort(id), abschnitte(), bojen() }`, Ereignisse `'build'` und `'bojenfeld:fertig' { id, bojen, kosten }`. Spielstand: `state.buildings['bojenfeld-1']`, `state.buildings['bojenfeld-2']`.
