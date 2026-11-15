# Päckchen liegen (P27, F1)

Stand: 15.11.2026. Status: umgesetzt.

Ist der Hafen voll, legen sich Boote im echten Hafen längsseits an ein anderes Boot, ins Päckchen ([echter-hafen.md](echter-hafen.md), Punkt 3). Im Spiel ist das eine Entscheidung des Spielers: Er kann ein wartendes Boot ins Päckchen legen, statt es an der Boje warten oder weiterfahren zu lassen.

## So spielt es sich

- Ist für ein wartendes Boot **keine passende Box frei**, leuchten beim Ziehen statt der Boxen **weiße Rahmen** neben liegenden Booten. Dorthin ziehen und loslassen, das Boot legt sich längsseits daneben.
- Antippen geht auch: Boot antippen (die Bootskarte sagt "Keine Box frei. Ins Päckchen: ..."), dann den weißen Rahmen oder das Boot daneben antippen.
- Das Schild beim Einrasten zeigt das Liegegeld (halb), die erwarteten Anker und "Beide Crews −0,5 Anker".
- Das Boot kommt von achtern parallel heran, bleibt querab stehen und wird seitlich herangeholt. Das innere Boot hängt auch zur Außenseite Fender aus, das äußere macht Vor-, Achterleine und Springs an Deck des inneren fest.
- Beim ersten Mal erklärt ein Hinweis das Päckchen (Hinweise beim ersten Mal, `features/einstieg.js`).

## Regeln (sim.js)

| Regel | Wert (economy.js `paeckchen`) |
| --- | --- |
| ab Ausbaustufe | 2 (`abStufe`) |
| an Platzarten | Stirnplatz am Stegkopf, Kai (`platzarten: ['stirn', 'kai']`), dazu der Yachtsteg (Art `stirn`) |
| nur wenn | für das Boot keine passende Box frei ist |
| Boot innen | liegt fest, Gast (kein Fischer, Retter oder Dauerlieger), kein Kurzhalter, heute kein Tagestörn, legt nicht gerade ab, liegt nicht selbst außen |
| Größe | Boot außen in gleicher oder kleinerer Klasse, höchstens `laengeMehr` (0,5 m) länger als das Boot innen |
| Liegegeld außen | Anteil `liegegeld` (0,5) |
| Aufenthalt außen | höchstens `naechteHoechstens` (1) Nacht |
| Bewertung | beide Crews `ruf` (0,5) Anker weniger; wird das äußere Boot in eine Box verholt, entfällt sein Abzug, und das zählt nicht als Umlegen |
| tiefer | nur ein Boot außen (keine Dreierpäckchen) |

- Der Platz außen heißt wie der innere mit `+` (`B27+`). Er steht in `ctx.berthById`, aber nicht in `ctx.berths`: Listen, Platzschilder, Auslastung und Statistik zählen ihn nicht.
- `sim.raftTargets(state, ctx, bootId)` liefert die Päckchenplätze, `sim.raftWhyNot(...)` den Grund dagegen: `boxFree`, `noInner`, `innerBusy`, `occupied`, `bigger`, `draft`, `fairway` (die Ansicht sieht das Boot im Fahrwasser), `funk` und Gründe aus dem Hook `fit`.
- **Inneres Boot festgelegt:** Solange außen ein Boot liegt oder ablegt (`sim.raftBlocked`), kann das innere nicht umgelegt werden und fährt keinen Tagestörn. Reisen beide am selben Morgen ab, legt das äußere zuerst ab, das innere mindestens 20 s danach (`raftDepartOrder`); die Ansicht wartet zusätzlich, bis das äußere fort ist. Reist das innere ab, reist das äußere mit ab.
- **Verholen (P33):** Das äußere Boot lässt sich wie jeder Gast umlegen (halten und ziehen). Wird eine Box frei, ist das der Weg aus dem Päckchen.
- **Stufenausbau, Laden, Sturm:** Äußere Boote verholen zuerst in eine freie Box oder reisen ab, bevor das innere umgelegt wird (`clearVanishedBerths`, `repairBerths`, `sturmklar`).
- **Zugeparkt:** Liegt ein Boot außen im Anfahrweg eines anderen, freien Platzes, ist dieser Platz bis zur Abreise gesperrt (Grund `paeckchen`, Hook über `ctx.berthBlocked`).

## Ansicht (render/paeckchen.js)

- `game.paeckchen.berth(platzId, info)` legt den Platz außen parallel neben das innere Boot, auf die Seite vom Steg weg, mit derselben Luft wie zwischen Rumpf und Stegkante.
- `game.paeckchen.pruefe(innen, boot)` ist die Prüfung "berührt nichts" (`ctx.raftFits`): Der Rumpf außen darf keinen Steg und keine Mole berühren (`steg`), in keinem anderen Platz liegen (`platz:<id>`), nicht auf Land oder im Flachen (`flach`), daneben muss eine freie Gasse von mindestens 6 m oder zwei Bootsbreiten bleiben (`gasse`), kein anderer Rumpf darf näher als 0,5 m sein (`boot:<id>`), und ein belegter Nachbarplatz muss weiter ablegen können (`ablegen:<id>`).
- Vorbeifahrende Boote weichen einem Boot im Päckchen aus (boat-anim `blockedBy`), ein Boot außen legt weiter seitlich ab, bevor es dreht.

## Gemessen

- Stufen 2 bis 6, Stegbilder 0, 3, 5 und 9: Je Stufe sind ein bis drei Päckchenplätze frei (meist ein Stegkopf von B, C und D; die Kai-Plätze sperren sich gegenseitig das Ablegen und bleiben ohne Päckchen).
- Ablauf im Spiel (Stufe 3, PC): Boot kommt von See, Ziehen auf den Rahmen, Anlegen, Nacht, Abreise außen vor innen: keine Rumpfberührung mit dem Päckchen.

## Mögliche Kollisionen mit anderen Paketen

- **Platzmaße ("Liegeplätze passgenau machen"):** Ändern sich Lage oder Größe der Stirnplätze, prüft `pruefe` neu; ragen Boote an Stegköpfen auf den Steg (Härtetest-Fund 3), liegt auch das äußere Boot entsprechend.
- **Staus und Wege (boat-view.js):** `platzBerth(id, info)` kennt Päckchenplätze, `fahreZu` wartet auf das innere Boot, Ablegen wartet auf `paeckchenFrei`.
- **Hafenbüro und Selbst-Einfahren:** nutzen keine Päckchen; die Entscheidung bleibt beim Spieler.
- **Flottillen (P32):** können Päckchen später als Liegeform nutzen.
