# Leinen annehmen (P48, F32)

Stand: 22.11.2026. Status: gebaut. Paket P48 aus der [Roadmap](roadmap.md), Welle 4. Jorvens Wunsch: Anlegen und Zuweisen sollen sich gut anfühlen.

Fährt ein Gast an seinen Platz am Steg oder Kai, steht dort, wo er festmacht, ein kleines Tau-Symbol. Wer es antippt (am PC anklickt), nimmt die Leinen an. Das ist ein Angebot, keine Pflicht: Ohne Antippen macht die Crew selbst fest wie bisher, es kostet nichts.

## So spielt es sich

1. Ein Gast fährt in eine Box, längsseits an einen Kai oder an eine Pier. Ist er höchstens 60 m vor dem Platz und der Platz im Bild, wippt am Steg ein Tau-Symbol mit goldenem Puls. Die ersten drei Male steht "Leine annehmen" darunter.
2. Antippen: Ein Festmacher in gelbem Ölzeug steht am Steg vor dem Bug (längsseits: mittschiffs an der Kante), mit einem kleinen Federn.
3. Das Boot kommt an. Die Crew hält die erste Leine kurz bereit (1,4 Sekunden echte Zeit, nur bis Tempo 3x), wenn das Symbol im Bild steht und noch niemand sie angenommen hat. Mit Festmacher geht es zügiger: Er fängt die erste Leine mit einem Hüpfer, lehnt sich bei jeder Leine zurück, jede feste Leine klingt einen Ton höher.
4. Ist das Boot fest: Akkord, kurzes Vibrieren am Handy, über dem Festmacher steigt "+3 € Trinkgeld" auf. Der Festmacher hüpft noch einmal und geht.

## Zahlen

Alle in `web/js/data/economy.js`, Abschnitt `leinen`:

| Feld | Wert | Bedeutung |
|---|---|---|
| `trinkgeld` | S 2, M 3, L 6, XL 12, XXL 20 € | Trinkgeld je Bootsklasse, rund ein Zehntel einer Nacht oder weniger |
| `abstandM` | 60 | ab so vielen Metern vor dem Platz steht das Symbol |
| `gleichzeitig` | 2 | höchstens so viele Symbole zugleich |
| `warteSek` | 1,4 | so lange (echte Sekunden) hält die Crew die erste Leine bereit |
| `warteBisTempo` | 3 | darüber (8x) wartet niemand, und es kommen keine neuen Symbole |

Das Trinkgeld steht im Tagesabschluss als eigene Zeile "Trinkgeld (Leinen angenommen)" unter Liegegeld (`addIncome(betrag, 'liegegeld', 'leinen')`). Der Zeitraffer-Bot tippt nie, das Balancing bleibt gleich.

## Wo es nicht kommt

- An Wartebojen, im Ankerfeld, im Bojenfeld und im Päckchen (dort nimmt die Crew des inneren Boots die Leinen).
- Nur für Gäste der Spielregeln, die gerade an genau diesen Platz fahren; nicht beim Laden eines Spielstands, nicht für Besuchsschiffe der Services.
- Nicht während des Einstiegs, beim Bauen, im Fotomodus, in der Übersicht und während einer Schleppleine. Liegt das Symbol unter einem Knopf oder einer Tafel, bleibt es weg, und die Crew wartet dann auch nicht.
- Fährt das Boot doch woanders hin (umgelegt, umgeleitet, abgewiesen), gehen Symbol und Festmacher ohne Trinkgeld.

## Technik

- `web/js/features/leinen.js`: Symbol (DOM-Knopf in `#hm-leinen-ebene`, Raster `LEINE_RASTER` in den Farben aus `ui/pixel-symbole.js`), Festmacher (eigene kleine 3D-Figur wie die Menschen aus `render/people.js`), Töne über `game.audio.sfx` (`leine-greifen`, `muenze` mit `combo`, `strich-ende`), Trinkgeld.
- `web/js/render/boat-anim.js`: `linienFuer(berth)` liefert die Festmacher eines Platzes, ohne das Boot zu ändern (der Festmacher steht zwischen den ersten beiden Landpunkten). `LinesTask` fragt vor der ersten Leine `boot.leinenHalten()` (höchstens 20 s Spielzeit) und legt mit `boot.leinenHelfer` die Leinen in 0,32 statt 0,5 s.
- Ereignisse: `leinen:angeboten` { boot, platz }, `leinen:angenommen` { boot, platz }, `leinen:trinkgeld` { boot, platz, betrag, groesse }.
- Schnittstelle: `game.leinen = { angebote(), annehmen(bootId), angenommen }`.
- Tests: `tests/leinen-annehmen.test.mjs` (Regeln und Zahlen), `tests/specs/festmacher.spec.mjs` (Handy und PC: Antippen bringt Trinkgeld, ohne Antippen nichts, nie an Bojen).

## Ausprobieren

```bash
python3 -m http.server 8000 --directory web
```

`http://localhost:8000/?stufe=2` öffnen, auf 1x stellen, ein wartendes Boot in eine Box ziehen und nah heranzoomen. Am Steg erscheint das Tau, antippen.

## Zusammenspiel mit anderen Paketen

- **P46 Serien-Akkord:** Auch der Serien-Akkord klingt beim Festmachen. Wer ihn baut, sollte prüfen, dass beide Akkorde nicht gleichzeitig zu dicht klingen (der Leinen-Akkord ist `strich-ende` 0,12 s nach dem Festmachen).
- **Münze und Wunschergebnis:** Beim Festmachen erscheinen über dem Boot die Münze und die Wunschsymbole (`ui/vorschau.js`); der Trinkgeld-Betrag steht über dem Festmacher am Steg, also daneben, nicht darüber.
- **Staus vor den Stegen:** Steckt ein Boot lange im Verkehr fest, wartet der Festmacher so lange am Steg. Das Trinkgeld kommt, sobald das Boot fest ist.
- **Menschen im Hafen:** Die Crew geht nach dem Festmachen an Land und läuft dabei am Festmacher vorbei; er ist keine Figur aus `render/people.js` und nicht im Wegenetz.
- **Hafenmeister-Rundgang:** Der Festmacher trägt Gelb, der Hafenmeister Weiß mit Mütze, damit man beide auseinanderhält.
