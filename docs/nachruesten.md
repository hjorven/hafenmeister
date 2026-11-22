# Stege nachrüsten (P30)

Stand: 14.11.2026. Status: gepflegt. Roadmap F8, Paket P30. Code: `web/js/features/nachruesten.js`, Zahlen: `ECONOMY.nachruesten` in `web/js/data/economy.js`, Tests: `tests/nachruesten.test.mjs`.

## Was der Spieler sieht

Im Baumenü unter **Stege** stehen neben neuen Stegen auch Verbesserungen für Stege, die schon da sind:

| Nachrüstung | Ab Stufe | Wo | Wirkung | Im Hafen |
|---|---|---|---|---|
| **Fingerstege** | 3 | Stege mit Heckpfahl-Boxen (A, B, Hauptsteg C, Stichsteg) | Gäste in den Boxen dieses Stegs bewerten um 0,5 Anker besser, so viel wie an einem Schwimmsteg mit Fingern | ein schmaler Laufsteg an jeder Box, mit Pfahl am Ende |
| **Steglaternen** | 2 | jeder Steg mit Gastplätzen | Gäste an diesem Steg bewerten um 0,2 Anker besser | Laterne an jedem zweiten Platz, nachts mit Lichtkegel auf dem Steg |

Ablauf wie bei allem anderen Bauen: Eintrag antippen, die Kamera fährt hin, die betroffenen Plätze leuchten gelb und Finger oder Laternen stehen als Geisterbild da. Die Karte sagt, was es bringt und wie viele Gäste dort gerade liegen. Erst "Bauen für ..." kauft, zehn Sekunden lang lässt sich der Kauf zurücknehmen.

Damit der Hafen nicht voller Preisschilder steht, bekommen Nachrüstungen kein eigenes Schild am Steg, außer sie sind gerade der empfohlene nächste Schritt. "Als Nächstes" schlägt sie vor, wenn für die nächste Ausbaustufe nur noch Ruf fehlt, kein Wunsch offen ist und das Geld reicht. Als "mehr Plätze" zählen sie nie.

Beim Ziehen eines Boots auf eine Box steht auf dem Schild "Fingersteg" und "Licht", wenn der Steg nachgerüstet ist. Im Gästebuch zählt der Bonus als "bequemer Liegeplatz".

**Stromsäulen** sind jetzt am Steg zu sehen: weiße Säulen mit blauem Deckel an jedem zweiten Platz, überall wo Strom liegt (Hauptsteg C, Stichsteg, Schwimmsteg D, und Steg B, sobald die Versorgung "Stromsäulen an Steg B" gebaut ist). Die Vorschau dieser Versorgung zeigt die Säulen als Geisterbild.

## Preis

`kosten = grund + jePlatz[Klasse]` für jeden betroffenen Gastplatz, der gerade am Steg liegt, auf 10 € gerundet. Boxen, die eine spätere Ausbaustufe an diesem Steg dazubringt, bekommen Finger oder Laterne gleich mit (der Kauf gilt für den Steg).

Beispiele mit allen Stegprojekten gebaut (`node` mit `angebote()`):

| Stufe | Fingerstege | Laternen |
|---|---|---|
| 3 | A 1.930 €, B 3.200 €, C 2.800 € | A 490 €, B 700 €, C 570 € |
| 4 | dazu Stichsteg 960 €, C 4.200 € | dazu D 480 €, Stichsteg 250 € |
| 5 | B 4.040 € | dazu Kai 270 € |

Wer früh kauft, zahlt weniger und bekommt spätere Boxen umsonst. Das ist gewollt: Es lohnt sich, einen Steg zu pflegen, der lange bleibt.

## Entscheidungen

- **Strom für Steg A** gibt es nicht: An Steg A liegen nur Boote der Größe S, und Strom wünschen sich nur M, L und XL (`wuensche.strom.klassen`). Säulen dort würden nichts tun. Strom bleibt für Steg B in der Versorgung, die Säulen sind jetzt sichtbar.
- **Wasser am Steg** (seit P31, [gaestewuensche.md](gaestewuensche.md)): Nachrüstung **Wasserhähne** ab Stufe 2 an jedem Gaststeg (90 € plus 10 bis 30 € je Platz). Sie erfüllt den Gästewunsch Frischwasser über die Platz-Eigenschaft `water` (Hook `berthHas` der Spielregeln), kein Anker-Bonus. Am Steg steht eine grüne Zapfstelle mit Schlauch an jedem zweiten Platz, die Platzwahl (Gold, Büro, Selbst-Einfahren) zieht diese Plätze für Gäste mit Wasserwunsch vor.
- Die Boni laufen über den Hook `rating` der Spielregeln, nicht über `berth.comfort`. Die Platzwahl des Hafenbüros (`berthScore`) bevorzugt nachgerüstete Boxen darum nicht von selbst; die erwartete Note im Ziehschild (`berthValue`) enthält den Bonus.

## Spielstand

`state.modules.nachruesten = { finger: ['A', ...], licht: ['B', ...] }`. Alte Spielstände ohne Eintrag haben nichts nachgerüstet, eine Migration ist nicht nötig.

## Berührungspunkte

- Balancing (P17): Die Boni heben Bewertungen und damit den Ruf. Bei 0,5 + 0,2 Anker an einem Steg ist das spürbar; P17 kann `anker` und Preise in `ECONOMY.nachruesten` stimmen.
- Winterarbeit "Steg überholen" (+0,3 für eine Saison) wirkt zusätzlich.
- Stegbilder und Geländeformen: Finger, Laternen und Säulen werden aus `game.stege.platz(id)` gebaut und nach jedem Neuaufbau der Stege (Ereignis `stege`) neu gesetzt.
- P59 (Stege umbauen): Wird aus Boxen eine andere Platzart, fallen die Finger dort weg (sie gelten nur für `box`).
