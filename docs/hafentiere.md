# Hafentiere (Paket P51)

Stand: 22.11.2026. Status: gebaut (Roadmap F38, P51).

Im Hafen wohnen drei Tiere: die Hafenkatze, der Hafenhund und ein Graureiher. Anders als die seltenen Besucher aus P40 ([besucher.md](besucher.md)) sind sie jeden Tag da. Man muss sie nur finden: Sie sind klein, man sieht sie erst, wenn man heranzoomt. Sie ändern nichts an Geld, Bewertung oder Regeln; sie machen den Hafen lebendig und sind Fotomotive für das Logbuch.

## Im Spiel

- **Hafenkatze** (ab Stufe 1): wohnt an der Tür des Hafenbüros (in Stufe 1 an der Wurzel der Stege). Morgens geht sie über die Stege zu einem Boot, das dort liegt, und sitzt davor. Mittags schläft sie zusammengerollt in der Sonne, zwischendurch putzt sie sich oder streift herum. Nachts ist sie unterwegs, ihre Augen leuchten. Läuft der Hund auf sie zu, rennt sie mit dickem Schwanz weg und putzt sich danach beleidigt. Jedes Spiel hat seine eigene Katze (rot getigert, schwarz-weiß oder grau).
- **Hafenhund** (ab Stufe 2, mit dem Hafenbüro): schnüffelt am Ufer und auf den Stegen herum. Macht ein Boot fest, rennt er meistens hin, setzt sich vor den Platz und wedelt. Ab und zu läuft er zur Katze. Abends geht er mit dem Hafenmeister über die Stege, immer ein paar Schritte hinter ihm, und setzt sich, wenn der Hafenmeister an einem Boot anhält. Danach und mittags schläft er neben dem Büro. Fell je Spiel verschieden.
- **Graureiher** (ab Stufe 1): steht reglos im flachen Wasser am Ufer oder auf einer Mole, schreitet ein paar Schritte, stößt nach Fischen (manchmal mit Fang). Kommt ein Boot, ein Mensch oder der Hund zu nah, fliegt er mit langsamen Flügelschlägen auf und landet woanders. Abends fliegt er landeinwärts zum Schlafen, morgens kommt er wieder.
- **Regen:** Katze und Hund gehen ins Haus und kommen hinterher an der Tür wieder heraus. Der Reiher bleibt.
- **Antippen:** Die Katze miaut und setzt sich hin, ein kleines Pixelherz steigt auf. Der Hund bellt zweimal, springt und wedelt. Der Reiher fliegt krächzend auf. Das Antippen tut zusätzlich zu dem, was der Tipp sonst tut (wie die Möwen aus P26).
- **Entdecken:** Ein Hafentier gilt als gesehen, sobald man so nah ist, dass man es erkennt (Motivkreis mindestens 16 Pixel Radius, etwa 120 m Bildbreite am PC, 35 m am Handy). Beim ersten Mal steht eine Zeile in der Hafenchronik, im Logbuch kommt „neu“ dazu.
- **Foto:** Im Fotomodus (P) nutzt der goldene Knopf aus P40 auch die Hafentiere. Ist keines im Bild, heißt er „Zur Hafenkatze“ (Handy: „Suchen“): die Kamera fliegt hin und zoomt heran, Katze oder Hund setzen sich und halten ein paar Sekunden still. Seltene Besucher gehen beim Suchen vor, danach Hafentiere ohne Foto; ein Hafentier mit Foto, das nicht im Bild ist, braucht keinen Knopf.
- **Logbuch:** Im Reiter „Besucher“ steht oben die Gruppe „Hafentiere“ (danach „Seltene Schiffe“ und „Seltene Tiere“), mit Pixelbild, Foto oder Schattenriss mit Hinweis, wo man sie findet. Der Steckbrief nennt den ersten Tag und an wie vielen Tagen man sie gesehen hat.
- **Erfolg:** „Hafenfreunde“ (Wimpel): Hafenkatze, Hafenhund und Graureiher fotografiert. Das „Fotoalbum“ aus P40 bleibt bei den sechs seltenen Besuchern.

## Zum Ausprobieren

`?hafentiere=katze`, `hund` oder `reiher` fährt die Kamera zum Tier, zum Beispiel `https://hjorven.github.io/hafenmeister/?stufe=3&hafentiere=hund`.

## Technik

- Bild und Verhalten: `web/js/render/hafentiere.js`, gestartet von `features/besucher.js` (keine eigene `MODULES`-Zeile). Echte Zeit mal Spieltempo, in der Pause steht alles. Kein Spielzufall, keine Regeln.
- Wege an Land kommen aus dem Wegenetz der Menschen (`game.people.netz`, [menschen-wege.md](menschen-wege.md)): Katze und Hund laufen nur über Wege, Wiesen, Stege, Kais und Molen der Fläche um das Hafenbüro, nie durchs Wasser oder durch Häuser. Neues Netz (Bauen, Stufe, Laden): sie werden auf den nächsten Knoten gesetzt.
- Reiherplätze: flaches Wasser (0,08 bis 0,7 m) mit Ufer in höchstens 5 m, mindestens 16 m von jedem Liegeplatz, dazu Molen. Gibt es keinen solchen Platz, kommt kein Reiher. Steht das Schilf der Naturecke (P52, [naturecke.md](naturecke.md)), fischt er in sechs von zehn Fällen an dessen Rand. Aufscheuchen: Boot näher als halbe Bootslänge plus 10 m, Mensch 6 m, Hund 8 m.
- Leistung am Handy: rund 55 kleine Meshes. Ist ein Tier kleiner als 2,5 Pixel im Bild (weit herausgezoomt), wird es nicht gezeichnet.
- Spielstand: in `state.modules.besucher` wie die seltenen Besucher (`gesehen[art]` mit `zuletzt` für „einmal je Tag“, `fotos[art]`). `saeubern` kennt die Hafentiere (`ALLE_MOTIVE`), darum kein neuer `SAVE_VERSION`; ältere Stände laden unverändert.
- Texte: `HAFENTIER_TEXTE` in `web/js/data/besucher.js`. Regeln ohne Browser: `hafentierGesehen`, `fotoMerken`, `fortschritt` (`hafentiere`, `hafentierFotos`, `hafentiereGesamt`) in `features/besucher-regeln.js`.
- Töne: `miau`, `wuff`, `reiher` in `web/js/audio/audio.js`.
- Schnittstelle: `game.hafentiere = { motive(), tier(art), tippe(art), scheuche(art), begruesse(platz), halte(art, sek) }`, Ereignisse `hafentiere:tipp { art }`, `hafentiere:begruesst`.
- Tests: `tests/hafentiere.test.mjs` (Texte, gesehen je Tag, Fotos, Erfolg, Speichern), `tests/specs/hafentiere.spec.mjs` (im Browser: Tiere da, an Land, Antippen, Reiher fliegt vor Booten auf, Foto ins Logbuch, Regen, Stufe 1 ohne Hund).

## Wo es mit anderen kollidieren kann

- **P40 Seltene Besucher:** teilt Fotoknopf, Logbuch-Reiter und Spielstand. Der Fotoknopf zieht seltene Besucher beim Suchen vor; `fortschritt().gesamt` bleibt 6, damit das Fotoalbum nicht schwerer wird.
- **P26 Möwen und Fernglas:** Antippen wirkt zusätzlich, nicht anstelle; ein Tipp auf ein Boot öffnet weiter die Bootskarte.
- **P48 Leinen annehmen:** Der Hund kommt nach dem Festmachen (`boat:moored`), nicht während der Festmacher die Leine nimmt.
- **Menschen (people.js):** Der Hund liest `game.people.rundgang.agent` und `game.people._agenten` (Reiher). Ändert sich dort der Aufbau, laufen Hund und Reiher nur noch ohne diese Bezüge.
- **P52 Naturecke am Schilf:** kann eigene Vögel am Schilf bringen. Reiherplätze sind flaches Ufer; wenn P52 Schilfgürtel ins Wasser setzt, sollte der Reiher dort bevorzugt stehen (`reiherSpots` erweitern) statt einen zweiten Reiher zu bauen.
- **P53 Spätankömmling in der Nacht:** Die Katze ist nachts unterwegs; ein nächtlicher Anleger bekommt (wie jedes Boot) den Hund nur, wenn er nicht schläft. Nachts schläft er, das ist gewollt.
- **P60 Hafen verschönern:** neue Deko kommt über `game.buildings.group` ins Wegenetz und wird damit automatisch Hindernis für Katze und Hund.

## Entscheidungen

- Hafentiere sind immer da, nicht selten: Das unterscheidet sie von P40 und macht sie zu einem Teil des Hafenlebens. Das Suchen ist das Spiel (heranzoomen), nicht das Warten.
- Keine Wirkung auf Geld oder Ruf: Belebung soll sich gut anfühlen, nicht optimiert werden.
- Der Hund kommt erst in Stufe 2: Am Badesteg gibt es noch kein Büro, zu dem er gehört.
- Keine Meldung im Meldeplatz: drei Tiere, die jeden Tag da sind, würden den Meldeplatz füllen. Die Chronikzeile beim ersten Entdecken reicht.
