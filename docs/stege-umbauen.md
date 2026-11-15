# Stege umbauen (P59)

Stand: 15.11.2026. Status: Teil 1 gepflegt (Doppelboxen), Teil 2 offen (neue Gastplätze in Stufe 6). Roadmap D5, D6, D9, Paket P59.
Code: `web/js/data/doppelboxen.js` (Paare in den Hafendaten), `web/js/features/umbauen.js` (Regeln, Baumenü-Schnittstelle), Zahlen `ECONOMY.doppelbox`, Tests `tests/umbauen.test.mjs`.

## Was der Spieler sieht

Ab Stufe 4 steht im Baumenü unter **Stege** je Steg mit großen Boxen:

- **Doppelbox an Hauptsteg C** (2.200 €): Zwei Boxen nebeneinander werden eine breite Box. Darin passt ein Mehrrumpfboot (bis 7,5 m breit), das sonst nur an einen Stirnplatz passt. Dafür fällt eine Box weg. Die Karte sagt, wie viele Doppelboxen an diesem Steg schon stehen und wie viele möglich sind.
- **Doppelbox an Hauptsteg C zurückbauen** (500 €): Die breite Box wird wieder zu zwei Boxen.

Vorschau wie bei allem Bauen: Die Kamera fährt hin, die zwei Boxen leuchten gelb, die breite Box liegt als Umriss darüber. Umgebaut wird nur, wenn beide Boxen frei sind (niemand liegt dort, legt gerade ab, hat sie über Funk reserviert oder fest gepachtet), zurückgebaut nur, wenn die Doppelbox frei ist. So muss nie ein Boot umziehen. Ist alles belegt, steht der Eintrag gesperrt mit "Alle Boxen belegt". Rückgängig im Baumenü gilt auch hier.

In Stufe 3 steht der Umbau schon gesperrt in der Liste ("ab Ausbaustufe 4"), weil Mehrrumpfboote ab Stufe 4 kommen.

D5 ("viele schmale oder wenige breite Boxen") ist damit je Steg frei wählbar: Jedes Paar lässt sich einzeln umbauen, von außen nach innen.

## Wie es gebaut ist

- `data/doppelboxen.js` sucht nach dem Stegbild (am Ende von `stegbildSetzen`) feste Paare: Boxen derselben Klasse (`ECONOMY.doppelbox.klassen`, jetzt nur L) am selben Steg, die in jeder Stufe Seite an Seite liegen. Jede Box gehört höchstens zu einem Paar. Für jedes Paar kommt ein Platz `C01-02` mit `doppel: ['C01', 'C02']` und `requires: 'doppel:C01-02'` in `HAFEN.plaetze`; die Einzelboxen bekommen `ohne: ['doppel:C01-02']`.
- `sim.berthAvailable` nimmt Plätze mit gebautem `ohne` heraus. Der Umbau steht in `state.buildings`, also im Spielstand, ohne Migration.
- `render/stege.js` zeichnet je nach Umbau die zwei Boxen oder die breite Box (auch in der Testansicht `?stufe=n`).
- Das Regionsziel "alle Plätze gebaut" zählt Doppelboxen und umgebaute Boxen nicht als fehlend.
- Prüfwerkzeuge (`tools/balance.mjs`, `tools/stegbilder/pruefen.mjs`, `tests/stegbilder.test.mjs`) lassen Doppelboxen bei Besitz und Überlappung aus. Der Fahrwasser-Test prüft sie mit: Jede Doppelbox ist in jedem Stegbild von See erreichbar.

## Entscheidungen

- Nur Klasse L: Breitere Boote, die in keine Box passen, gibt es nur bei L (Mehrrumpfboote L2). Für S und M brächte eine Doppelbox keinem Boot etwas, darum gibt es sie dort nicht (Regel "nichts, was nichts tut").
- Ein normales L-Boot darf auch in eine Doppelbox. Das Büro bevorzugt passgenaue Plätze, wer selbst zuweist, entscheidet selbst.
- Kein Umzug von Booten beim Umbau: Das hält P33 (Umlegen) frei von Sonderfällen.

## Teil 2 (offen): neue Gastplätze in Stufe 6 (D9)

Ein Superyacht-Steg oder Stadtkai für XL-Gäste braucht neue Lagen in allen 13 Stegbildern und 10 Geländeformen und eigene Fahrwasser-Prüfungen. Das kommt als eigener PR.

## Berührungspunkte

- P33 Umlegen: Umbau nur bei freien Boxen, kein Boot muss weichen.
- Wegsuche ("Staus an Bojen und Ankerfeld auflösen"): Doppelboxen sind normale Boxen mit doppelter Breite; Anfahrt über die Gasse wie bei Boxen.
- P17 Balancing: Preis in `ECONOMY.doppelbox`. A10 (Größenmischung) zählt eine Doppelbox als einen L-Platz.
- P30 Fingerstege gelten für die Doppelbox wie für jede Box des Stegs.
