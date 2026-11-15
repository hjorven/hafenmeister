# Stegbilder: jede Marina sieht anders aus

Stand: 12.11.2026. Status: gebaut.

Damit der Hafen nicht in jedem Spiel gleich aussieht, gibt es neben dem Grundbild aus `web/js/data/harbor.js` zwölf Varianten der Stege A, B, C (mit Stichsteg CS) und D. Ein neues Spiel würfelt eine davon, der Spielstand merkt sie sich, und der Ausbau wächst innerhalb dieser Variante weiter.

## Was gleich bleibt und was sich ändert

| Gleich in jeder Variante | Anders je Variante |
|---|---|
| Liegeplatz-ids, Klassen, Platzarten, in welchen Stufen es sie gibt | Lage der Plätze und Verlauf der Stege |
| Stegprojekte und Balancing (`web/js/data/economy.js`) | Stegwurzel am Ufer, Richtung, Knicke |
| Fischersteg, Kai, Fischereikai, Dienststege, Stufe-6-Anlagen | Welche Seite eines Abschnitts Boxen hat |
| Gelände, Molen, Wartebojen, Ankerfeld | Lage des T-Kopfs, Abzweig des Stichstegs, Form der Gabel an D |

Die ids laufen in jeder Variante in derselben Reihenfolge vom Ufer nach außen wie im Grundbild. Ein Stegprojekt, das im Grundbild die äußeren Boxen von Steg B bringt, bringt deshalb auch in jeder Variante die äußeren Boxen.

## Wie die Varianten entstehen

`tools/stegbilder/erzeugen.mjs` baut je Startwert einen Hafen:

1. Jeder Steg wächst Segment für Segment vom Ufer aus. Nach jedem Segment wird gezählt, wie viele Boxen links und rechts passen, ohne etwas zu berühren. Die Seite endet an der ersten Box, die stören würde. Passt nichts, wird ein anderer Knick probiert.
2. Die Variante merkt sich, welche Knicke schon benutzt wurden. Geradeaus nach geradeaus und derselbe Knick zweimal hintereinander werden seltener gewählt.
3. Steg B bleibt gerade und zweiseitig, bis die Plätze der Stufe 2 stehen, weil davor die Wartebojen liegen.
4. An der Gabel von Steg D liegen die Finger immer außen an den Ästen. Zwischen den Ästen läuft das Wasser zur Gabel hin spitz zu, dort könnte kein Boot eindrehen.
5. Jede Stufe nimmt so viele Plätze vom Ufer aus, wie das Grundbild in dieser Stufe hat. Einzelne Boxen ohne Nachbarn werden übersprungen, solange genug Plätze bleiben.
6. Die fertige Variante muss alle Prüfungen in allen Stufen bestehen. Von den bestandenen kommen die zwölf in die Datei, die sich am stärksten unterscheiden.

## Prüfungen (tools/stegbilder/pruefen.mjs)

| Regel | Bedeutung |
|---|---|
| Überlappung | Box mit Heckpfählen oder Längsseitsplatz berührt keinen anderen Platz, keinen Steg und nichts Festes (Slip, Mastenkran, Travellift, Fahrwasser, Wartebojen, Ankerfeld). |
| Gasse | Vor jeder Box liegt freies Wasser, mindestens 1,5 Bootslängen tief und nie weniger als zwei Bootsbreiten plus Abstand. Echte Marinas planen die Gasse zwischen zwei Boxreihen 1,5 bis 2 Bootslängen breit, damit ein Boot eindrehen kann und zwei Boote sich begegnen können. Neben Längsseitsplätzen bleiben zwei Bootsbreiten frei. |
| Tiefe | Der Platz liegt ganz im Wasser, mindestens 0,5 m tief im Gelände des Spiels. |
| Einfahrt | Ein Boot der Platzgröße kommt vom offenen See bis vor den Platz, ohne näher als eine halbe Bootsbreite plus 0,6 Planeinheiten an Land, Stege, Boote oder Pfähle zu kommen (Rasterrechnung). |

Das Grundbild selbst hält die strenge Gassenregel an einigen Stellen nicht ein (zwischen B und C nur etwa 1,35 Bootslängen, Boxen an D zeigen auf den Travellift). Es bleibt für alte Spielstände unverändert, neue Spiele bekommen nur geprüfte Varianten.

## Welche Variante gilt

`web/js/data/harbor.js` ruft beim Laden `stegbildAnwenden(HAFEN)` aus `web/js/data/stegbild.js` auf. Alle Module, die HAFEN importieren, sehen dadurch schon die Variante. Reihenfolge der Regeln:

1. URL `?stegbild=N` (0 = Grundbild, 1 bis 12 = Variante). Nur zum Ansehen, wird nicht gespeichert.
2. Spielstand mit `modules.stegbild.nr`, auch aus einer importierten Datei.
3. Eintrag `hafenmeister.stegbild` im Browser, der zum Spielstand gehört.
4. Spielstand von vor den Stegbildern: Grundbild, damit nichts umzieht.
5. Automatische Tests (`navigator.webdriver`): Grundbild.
6. Neues Spiel: eine Variante zufällig.

Ohne Browser (Node, `tests/*.test.mjs`) bleibt immer das Grundbild. Höhere Stufen als 5 übernehmen die Stege der Stufe 5. Lädt jemand einen Spielstand mit anderem Stegbild, startet die Seite neu.

Für andere Module gilt: Positionen von Stegen und Plätzen immer aus `HAFEN` oder `game.stege.platz(id)` lesen, nie fest eintragen. `game.stegbild.aktuell()` sagt, welche Variante gilt.

## Befehle

Prüfen, ob jede Variante in `web/js/data/stegbilder.js` noch alle Regeln hält (rund 15 Sekunden), etwa nach einer Änderung am Gelände, an Bojen, am Ankerfeld oder an harbor.js. Geprüft werden Stufe 1 bis 5 und Stufe 6 mit dem Yachtsteg:

```bash
node tools/stegbilder/erzeugen.mjs --pruefen
```

Datei fortschreiben: Varianten, die alle Prüfungen bestehen, bleiben mit ihrer Nummer, nur durchgefallene werden durch neue, möglichst andere ersetzt (bis rund 3 Minuten, wenn etwas ersetzt wird):

```bash
node tools/stegbilder/erzeugen.mjs
```

Alle 12 Varianten neu suchen (rund 7 Minuten). Das ändert die Stege in laufenden Spielen, weil Spielstände nur die Nummer ihres Stegbilds kennen; nur nehmen, wenn es dafür einen Grund gibt:

```bash
node tools/stegbilder/erzeugen.mjs --alle-neu
```

Warum fortschreiben statt neu erzeugen: Derselbe Startwert ergibt nach jeder Änderung an Gelände oder Hindernissen ein etwas anderes Bild. Die Datei wird deshalb nicht mehr mit dem Generator verglichen, sondern nur mit den Regeln (P83, 15.11.2026). Doppelboxen (P59) zählt der Generator nicht mit, sie entstehen im Spiel aus den Boxen jedes Stegbilds.

Tests (Plätze gleich, alle Prüfungen in Stufe 1 bis 6, Tiefe, Generator findet neue Varianten, Wahl der Variante):

```bash
node --test tests/stegbilder.test.mjs
```

Eine Variante im Spiel ansehen, zum Beispiel Variante 4 in Stufe 5:

```
https://hjorven.github.io/hafenmeister/?stegbild=4&stufe=5
```
