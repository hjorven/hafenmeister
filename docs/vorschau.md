# Wünsche über dem Boot und Funk-Vorschau

Paket P11 der [Roadmap](roadmap.md) (Ü10, A5, B2). Modul: `web/js/ui/vorschau.js`, Test ohne Browser: `tests/vorschau.test.mjs`.

## Was der Spieler sieht

**Wünsche über wartenden Booten.** Jedes Boot, das an einer Warteboje oder im Ankerfeld wartet (oder dorthin unterwegs ist), trägt seine Wünsche als kleine Pixel-Schilder über dem Rumpf:

| Wunsch | Schild |
|---|---|
| WC | blau, Schrift "WC" |
| Dusche | grün, Brause mit Tropfen |
| Essen | orange, Gabel und Messer |
| Strom | gelb, Blitz |
| Diesel | rot, Zapfsäule |

Das gewählte Boot bekommt einen goldenen Rand um seine Schilder. Boote ohne Wünsche haben keine Schilder.

**Haken beim Anlegen.** Sobald ein Gast in seiner Box fest ist, steht die Reihe noch gut vier Sekunden über ihm: Jeder erfüllte Wunsch bekommt nacheinander einen grünen Haken, jeder unerfüllte wird grau. So sieht man ohne Text, was der Platz gebracht hat (Strom am Steg, genug Duschen, Kiosk). Morgens, wenn Bleibende neu zahlen, erscheint die Reihe nicht.

**Funk.** Ab der ersten Stufe des Hafenbüros ("Hafenmeister mit Funk", `rules.office.preview`) steht rechts unter den oberen Knöpfen der Funk: die nächsten drei Boote des Tages (`game.sim.preview()`, Anzahl `ECONOMY.warten.vorschau`). Jede Karte zeigt

- den Umriss des Boots von oben, maßstäblich nach Länge und Breite (Segler mit spitzem Bug und Mast, Motorboot mit Aufbau, Mehrrumpfboot mit zwei Rümpfen, Traditionssegler mit mehreren Masten),
- die ungefähre Uhrzeit der Ankunft auf zehn Minuten oder "gleich",
- die Länge in Metern und die Wünsche als kleine Schilder.

Antippen einer Karte zeigt einen Satz dazu ("Fahrtenyacht, 12 m lang, gegen 15:40, möchte Strom und Dusche"). Der Kopf "Funk" klappt die Liste ein und aus, das merkt sich das Gerät. Abends steht "Funk still", tagsüber ohne weitere Boote "Heute kommt niemand mehr". Im Winter ist der Funk aus.

Wozu: Man sieht, wer gleich kommt, und kann entscheiden, ob man die große Box mit Strom für die Yacht um 15:40 freihält.

## Wann es ausgeblendet ist

- Baumodus (`body.building`) und Fotomodus (`body.foto`): Schilder und Funk aus.
- Bootskarte offen (`body.card-open`): Funk aus, damit nichts unter der Karte hervorschaut.
- Nach der Bildbreite in Metern (auf jedem Gerät gleich, `SCHILD_VOLL_BIS`, `SCHILD_KLEIN_BIS`): bis 160 m volle Schilder, bis 420 m halb so große (12 px), weiter draußen keine. Die Startansicht am Handy und die übliche Spielansicht zeigen sie immer.
- Sonderfälle mit der orangen Raute der Leitstelle (ui/hud.js): Die Schilder stehen über der Raute.
- Ragt eine Funk-Karte in etwas unten rechts hinein ("Als Nächstes", Kassieren, Zeit, Bauen), fällt sie weg; der Funk zeigt dann nur die Karten, die frei Platz haben (am Handy quer oft nur eine).
- Der Dauerlieger-Hinweis (features/dauerlieger.js) legt sich nicht über Funk und linke Spalte: oben in die Lücke dazwischen, am Handy hochkant darunter. Solange eine Karte offen ist, ist er aus und seine Zeit läuft nicht ab.
- Würden sich die Schilder zweier Boote überdecken, bleibt nur die erste Reihe stehen; das gewählte Boot hat Vorrang.

## Schnittstelle

- Liest: `game.sim.state` (`queue`, `boats`, `office`, `clock`, `phase`), `game.sim.ctx.rules` (`office.preview`, `dayLength`, `eveningLength`), `game.sim.preview()`, `game.sim.season()`, `game.boatView.boot(id)` (Modell, `berth.kind`), `game.camera.camera`, `game.renderer`.
- Hört auf: `sim:moored`, `sim:feeReady` (Liste `wishesMet`), `boat:moored` (sichtbar fest), `sim:select`, `sim:turnedAway`, `sim:dismissed`, `sim:selfEntered`, `sim:arrived`, `sim:change`, `spielstand-geladen`.
- Schreibt nichts in den Spielstand.
- `game.vorschau = { wunschSymbole, funkAn(), aktualisieren() }`.
- Ein neuer Wunsch (Paket P31) bekommt sein Schild als Eintrag in `WUNSCH` (Name, Farbe, Raster 12 x 12, `#` ist die weiße Glyphe). Ohne Eintrag erscheint ein Fragezeichen.

## Prüfen

```bash
node --test tests/vorschau.test.mjs
```

Im Spiel: `?stufe=3`, im Baumenü unter "Hafen" das Hafenbüro Stufe 1 bauen, Zeit laufen lassen.
