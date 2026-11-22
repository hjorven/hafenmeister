# Stammgäste mit Wirkung und Gästepost (Paket P25)

Grundlage: Stammgäste aus [neue-features.md](neue-features.md), Abschnitt 4 (Namen, Heimathafen,
Wiederkehr). P25 gibt ihnen eine Wirkung im Spiel. Zahlen stehen in `web/js/data/economy.js` unter
`ECONOMY.stammgaeste`, nirgends sonst.

## Wer ist Stammgast?

- Wer mit 4 oder 5 Ankern abreist, merkt sich den Hafen und kann wiederkommen (15 Prozent der neuen Boote
  sind Wiederkehrer).
- Stammgast ist erst, wer wiederkommt und wieder zufrieden abreist (ab dem 2. Besuch, PR 361).
- Auf der Bootskarte steht „kommt wieder, 2. Besuch“ oder „Stammgast, 5. Besuch“.

## Was Stammgäste bewirken

| Kürzel | Was | Wie es im Spiel aussieht | Zahl |
|---|---|---|---|
| C8 | Bewertung zählt beim Ruf doppelt | Ein zufriedener Stammgast hebt den Ruf stärker, ein verärgerter drückt ihn stärker | `rufGewicht: 2` |
| plan 9a, H6 | Lieblingsplatz: die Box des letzten zufriedenen Besuchs | Bootskarte „Lieblingsplatz: Box B05 ist frei (+0,5 Anker)“, dunkelblauer Stander über der Box, beim Einrasten „Lieblingsplatz“ im Platzwert; Büro und „Einfahren lassen“ nehmen sie bei sonst gleich guten Boxen | `platzBonus: 0.5`, `platzVorliebe: 500` |
| H7 | Treuewimpel: ein Doppelstander am Heck je fünf Besuche | weht beim Anfahren, an der Boje, in der Box und beim Ablegen; in der Wunschreihe über wartenden Booten ein kleiner Stander | `wimpelJe: 5` |
| H8 | Stammgäste wachsen mit | ab dem 3. Besuch manchmal ein größeres Modell (oder die nächste Größe derselben Bootsart, wenn sie in den Hafen passt), sonst ein Wunsch mehr; Bootskarte „Kommt diesmal mit größerem Boot (vorher Folkeboot)“ | `wachsen: { abBesuch: 3, chance: 0.25, maxWuensche: 4 }` |
| F37 | Gästepost an der Pinnwand im Hafenbüro | siehe unten | `post` |
| H9 | Leere Box während eines Tagestörns für einen Tagesgast | siehe unten | keine neue Zahl |

Der Lieblingsplatz ist ein Angebot, keine Pflicht: Fehlt dort ein Platz-Wunsch (Strom), kann eine andere
Box mehr Anker bringen. Der Platzwert beim Einrasten zeigt beides.

## Gästepost

Ein Stammgast, der zufrieden abreist, schreibt mit 20 Prozent Wahrscheinlichkeit eine Karte (höchstens eine
offene je Gast). Sie kommt 1 bis 3 Tage später morgens an:

- **Ankündigung** (60 Prozent): „Moin aus Kappeln! Wir kommen übermorgen wieder, gern wieder in Box B05.
  Wir brauchen wieder Strom am Platz.“ An dem Tag kommt er sicher, mit genau diesen Wünschen. Fällt der Tag
  in den Winter, kommt er zum Saisonbeginn. Ist er nicht mehr auf der Liste oder passt nicht mehr in den
  Hafen, steht „kommt nicht“ an der Karte.
- **Empfehlung** (40 Prozent): „Wir haben unseren Freunden von der „Seehund“ von euch erzählt. Sie kommen
  morgen.“ An dem Tag kommt ein Boot mehr, möglichst aus demselben Heimathafen. Seine Bootskarte sagt,
  wer es geschickt hat.

Wo man sie sieht:

- Kommt Post an, steht kurz „Post von „Möwe““ im Meldeplatz (Vorrang 24, `docs/meldungen.md`).
  Antippen öffnet die Pinnwand.
- Ein kleiner Brief neben dem Ruf oben links zeigt ungelesene Post, die Menüzeile „Gästebuch“ zählt die Briefe.
- Die Pinnwand ist der oberste Teil des Gästebuchs (Hafenbüro oder Hafenmeister-Haus antippen, Ruf oben links,
  Menü, Taste N): Karten mit Text und Stand („kommt morgen“, „ist da“), darunter die Stammgäste mit
  Treuewimpeln, Besuchen und Lieblingsplatz.

## Tagesgast in der Box eines Tagestörns (H9)

Fährt ein Dauerlieger morgens zu einer Runde hinaus (Tagestörn, `dauerlieger.tagestoernChance`), ist seine
Box bis zum Abend frei, aber nur für einen **kurzen Halt** (Boote ohne Übernachtung, `sim.isShortStay`):

- Das Schild bleibt rot, ein Gast über Nacht passt nicht hinein. Zieht man ihn trotzdem hin, steht
  „Der Dauerlieger ist nur auf Tagestörn. Bis zum Abend darf hier nur ein Boot für einen kurzen Halt liegen.“
- Ein kurzer Halt rastet ein wie in jeder freien Box, auch Büro und „Einfahren lassen“ nehmen die Box.
  Die Platzkarte sagt: „Auf Tagestörn, abends zurück. Bis dahin darf ein Boot für einen kurzen Halt hier festmachen.“
- Kurze Halte legen am Nachmittag ab. Abends legt der Dauerlieger an. Legt der Gast gerade noch ab, wartet
  das Boot und kommt in der Nacht, ohne Kündigung. Bleibt jemand über Nacht (Sturm), wird aus dem Tagestörn
  ein Törn bis zur nächsten Nacht.

Entschieden (Thread): H9 gilt nur für Dauerlieger. Gäste auf Tagestörn haben ihre Box für die Nacht bezahlt
und kommen in dieselbe Box zurück (echter-hafen.md), die bleibt reserviert.

Technik: Der Tagestörn löst das Boot nachts aus den Regeln wie ein mehrtägiger Törn (`p.boot`,
`p.rueckNacht` = Vortag, `p.tagestoern`); `fitHook` gibt dann `dauerTag` für alle außer kurzen Halten,
`abendHook` legt an. `aufTagestoern(state, platzId)`; `draussenBis` zählt nur mehrtägige Törns.
Alte Spielstände mit Tagestörn ohne gelöstes Boot laufen weiter wie vorher.

## Technik

| Datei | Inhalt |
|---|---|
| `web/js/features/stammgaeste.js` | Liste, Wiederkehr, `alsStammgast`, `wachsen`, `platzHook` (Hook 'score'), `treuewimpel`, `hinweise` für die Bootskarte |
| `web/js/features/gaestepost.js` | Regeln der Gästepost, ohne Browser: Hooks 'night', 'arrival', 'arrivals' |
| `web/js/ui/gaestepost.js` | Meldung, Brief am Ruf, Pinnwand im Gästebuch (`game.gaestepost.abschnitt()`) |
| `web/js/render/stammgast-zeichen.js` | Treuewimpel am Heck, Stander über dem Lieblingsplatz |
| `web/js/sim.js` | `pushRating` zählt `boat.stamm` doppelt, `ratingParts().stammPlatz`, `berthValue().lieblingsplatz` |

Spielstand: Boot `{ stamm, lieblingsplatz, gewachsen, angekuendigt, freundVon }`, Liste
`state.modules.stamm.liste[].lieblingsplatz`, Post `state.modules.post = { naechsteId, karten, unterwegs }`.
Alles kommt dazu, nichts ändert ein altes Feld: alte Spielstände laden ohne Umbau (kein neuer SAVE_VERSION).
Würfel nur über `random(state)`, Texte mit festem Zufall aus der Karten-id.

Tests: `tests/stammgaeste.test.mjs`, `tests/gaestepost.test.mjs`. `tools/balance.mjs` hängt beide Module ein
wie das Spiel.

## Zusammenspiel (Kollisionen, notiert)

- **Bootsgeschichten** hängen nach den Stammgästen ein und können einem zufällig wiederkehrenden Stammgast
  einen Wunsch dazugeben oder ihn zum kurzen Halt machen. Angekündigte Gäste (Gästepost) laufen danach:
  ihr Anlass ist die Karte, Wünsche und Übernachtung gelten wie angekündigt.
- **Kurzhalter** (kurzer Halt) werden abends nicht gemerkt und können darum nie Stammgast werden.
- **Tagesziel „seltener Gast“** lässt Stammgäste in Ruhe; die Freunde aus einer Empfehlung können zum seltenen Gast werden.
- **Stufenausbau und Umbau**: Gibt es den Lieblingsplatz nicht mehr oder passt das Boot nicht mehr hinein,
  zeigt die Karte nichts, es gibt keinen Abzug.
- **Päckchen** zählen nie als Lieblingsplatz.
- **Flottillen (P32)**: Boote einer Flottille werden nie zum Stammgast und lösen keine angekündigte Karte
  ein; sie bekommen nur Bootsnamen. Art, Maße, Wünsche und Nächte gehören der Gruppe.
- **Gästebuch-Test**: zählt seit C8 mit Gewicht 1 (eine Bewertung je Gast).
- **H9 und Winter**: Liegt abends vor dem Winter noch ein kurzer Halt in der Box, geht das Boot direkt
  ins Winterlager, der Tagestörn endet dort.
- **H9 und Umlegen (P33)**: Ein Gast über Nacht kann nicht in die Box eines Tagestörns umgelegt werden
  (gleiche Passregel).
