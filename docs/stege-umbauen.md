# Stege umbauen (P59)

Stand: 15.11.2026. Status: gepflegt. Teil 1 Doppelboxen (PR 321), Teil 2 Yachtsteg in Stufe 6. Roadmap D5, D6, D9, Paket P59.
Code: `web/js/data/doppelboxen.js` (Paare in den Hafendaten), `web/js/features/umbauen.js` (Regeln, Baumenü-Schnittstelle), Zahlen `ECONOMY.doppelbox`, Tests `tests/umbauen.test.mjs` und `tests/yachtsteg.test.mjs`.

## Was der Spieler sieht

Ab Stufe 4 steht im Baumenü unter **Stege** je Steg mit großen Boxen:

- **Doppelbox an Hauptsteg C** (2.200 €): Zwei Boxen nebeneinander werden eine breite Box. Darin passt ein Mehrrumpfboot (bis 7,5 m breit), das sonst nur an einen Stirnplatz passt. Dafür fällt eine Box weg. Die Karte sagt, wie viele Doppelboxen an diesem Steg schon stehen und wie viele möglich sind.
- **Doppelbox an Hauptsteg C zurückbauen** (500 €): Die breite Box wird wieder zu zwei Boxen.

Vorschau wie bei allem Bauen: Die Kamera fährt hin, die zwei Boxen leuchten gelb, die breite Box liegt als Umriss darüber. Umgebaut wird nur, wenn beide Boxen frei sind (niemand liegt dort, legt gerade ab, hat sie über Funk reserviert oder fest gepachtet; ein Dauerplatz bleibt auch dann stehen, wenn sein Boot gerade auf Törn oder im Winterlager ist), zurückgebaut nur, wenn die Doppelbox frei und kein Dauerplatz ist. So muss nie ein Boot umziehen. Ist alles belegt, steht der Eintrag gesperrt mit "Alle Boxen belegt". Rückgängig im Baumenü gilt auch hier.

Damit das Baumenü nicht dauerhaft zwei Einträge je Steg zeigt (Zusammenspiel-Fund K5, 20.11.):

- **Doppelbox** steht nur im Menü, solange an diesem Steg keine Doppelbox frei ist. Eine freie Doppelbox reicht für den nächsten Katamaran; erst wenn sie belegt ist, erscheint der nächste Umbau.
- **Zurückbauen** steht nur im Menü, wenn eine Doppelbox frei ist und zugleich alle schmalen Boxen des Stegs belegt sind. Nur dann fehlt gerade eine schmale Box.

Jeder Umbau und Rückbau kostet, weil am Steg wirklich gebaut wird (Dalben setzen oder ziehen).

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

## Teil 2: Yachtsteg in Stufe 6 (D9)

Im Seehafen (Stufe 6) steht im Baumenü unter **Stege** der **Yachtsteg** (30.000 €): ein Schwimmsteg im tiefen Wasser vor der Westmole, von der Fischhalle nach Norden. An seiner Westseite liegen zwei Plätze längsseits für große Yachten und Traditionssegler (Klasse XL, bis 40 m). Bisher gab es für XL nur die drei Plätze am Kai. Mehr XL-Plätze bringen nach A10 auch mehr XL-Gäste. Das Hafenziel "alle Plätze" der Stufe 6 zählt den Yachtsteg mit; "Als Nächstes" zeigt dann "Noch 2 Plätze bauen".

Lage und Gründe:

- Gezeichnet in `skripte/konzeptbilder/hafen_von_oben.py` (Stufe 6, `YACHT_X`, `YACHT_Y`), exportiert mit `python3 skripte/liegeplaetze_export.py` nach `harbor.js` (Steg `Y`, Plätze `Y01`, `Y02`, Art `stirn`, Klasse XL). Stegbilder ändern ihn nicht, er liegt in jedem Spiel gleich.
- Das Wasser dort ist die ausgebaggerte Liegewanne der Großschiffspier (8,5 m), es gibt also kein neues Gelände. Die Wurzel liegt auf der Fläche der Fischhalle und dem Wellenbrecher, auf allen zehn Küsten an Land.
- Nur die Westseite hat Plätze: Zum Anlegen längsseits braucht eine große Yacht neben dem Platz rund 20 m freies Wasser. Zwischen Steg und Kreuzfahrtschiff ist das da, zwischen Steg und Westmole nicht. Mit vier Plätzen (beide Seiten) fand der Fahrwasser-Test für die Ostseite keinen Weg.
- Die Seebrücke am Badestrand (render/landschaft/strand.js) meidet in Stufe 6 das Rechteck um den Yachtsteg (`yachtstegRechteck()`); vorher kreuzte sie ihn auf manchen Küsten vom Typ Nehrung. Findet sie dort keine andere Stelle, fehlt sie (5 von 106 geprüften Küsten).
- Die kleine Seebahn der Vorbeifahrer biegt in Stufe 6 etwas weiter nördlich um den Stegkopf (`data/verkehr.js`).
- Geprüft: Fahrwasser über alle 13 Stegbilder und 10 Geländeformen, Seebahnen, Kaufregel aller Stegprojekte jetzt bis Stufe 6.

## Berührungspunkte

- P33 Umlegen: Umbau nur bei freien Boxen, kein Boot muss weichen.
- Wegsuche ("Staus an Bojen und Ankerfeld auflösen"): Doppelboxen sind normale Boxen mit doppelter Breite; Anfahrt über die Gasse wie bei Boxen.
- P17 Balancing: Preise in `ECONOMY.doppelbox` und `stegprojekte` (yachtsteg). A10 (Größenmischung) zählt eine Doppelbox als einen L-Platz, der Yachtsteg bringt zwei XL-Plätze.
- Stufe 6 Hafenziel "alle Plätze": braucht jetzt auch den Yachtsteg.
- P30 Fingerstege gelten für die Doppelbox wie für jede Box des Stegs.
