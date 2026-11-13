# Neue Features: Stammgäste, Dauerlieger, Wetterflagge, Fotomodus, Hafen schauen, Tagesziele

Stand: 11.11.2026. Status: alle sechs gebaut; Ausbau in den Paketen P01, P13 und P25 der [Roadmap](roadmap.md). Von Jorven am 11.11.2026 freigegeben („Vorschläge finde ich gut, alle, baue sie ein“). Gebaut vom Thread „Spielschleife zusammenbauen und Vorschläge einbauen“, gegengeprüft vom Thread „Jedes neue Feature einzeln testen“. Es gilt [abnahme.md](abnahme.md): Ein Feature erscheint erst im Spiel, wenn es funktioniert.

Alle sechs bleiben im Rahmen des Plans: keine Story, keine Figuren mit Namen, keine neue Zahl neben Geld und Ruf, Symbole statt Text.

| Feature | Braucht | Stand |
|---|---|---|
| Fotomodus mit Rundflug | nur Grundgerüst | gebaut: `web/js/ui/fotomodus.js` |
| Hafen schauen | Fotomodus, Hafenbüro Stufe 3 | gebaut: `web/js/features/hafen-schauen.js` |
| Dauerlieger | `sim.js`, Animationen für Aus- und Einlaufen | gebaut: `web/js/features/dauerlieger.js` |
| Stammgäste | `sim.js` (Gäste, Bewertung) | gebaut: `web/js/features/stammgaeste.js` |
| Wetter an der Flagge | `events/events.js` | gebaut: `web/js/features/wetterflagge.js` |
| Tagesziele an der Tafel | `sim.js` | gebaut: `web/js/features/tagesziele.js`, `ziel-deko.js` |

## 1. Fotomodus mit Rundflug

Knopf „Foto“ oben (Taste `P`, `F` ist Vorspulen). Die Leisten verschwinden, unten bleibt eine kleine Leiste mit drei Knöpfen, die nach 3 Sekunden ohne Bewegung fast unsichtbar wird.

- **Bild sichern:** speichert genau das Bild auf dem Schirm als PNG (`hafenmeister-JJJJ-MM-TT-HHMM.png`), kurzer weißer Blitz, auf dem Handy ein kurzes Vibrieren.
- **Rundflug:** Die Kamera gleitet langsam seitlich über den Hafen und zoomt sanft ein und aus. Jede Berührung oder das Mausrad hält ihn an. Läuft auch in der Pause.
- **Zurück** oder `Escape`: alles wie vorher.

Ereignisse für andere Module: `foto:an`, `foto:aus`, `foto:bild` (Ton-Thread: Auslöser-Klick). Schnittstelle: `game.foto.an()`, `game.foto.aus()`, `game.foto.bildSichern()`, `game.foto.aktiv`.

Später, wenn die Kamera drehen kann (Plan Abschnitt 8): Drehen auch im Fotomodus.

## 2. Hafen schauen

Gebaut: `web/js/features/hafen-schauen.js`, Test in `tests/hafen-schauen.test.mjs`.

Ein Ruhemodus für ein Tablet auf dem Tisch. Im Fotomodus erscheint der Knopf „Hafen schauen“, sobald das Hafenbüro selbst zuweist (Büro Stufe 3, `rules.office.autoAssign`). Vorher gibt es den Knopf nicht.

- Die Kamera gleitet (Rundflug), das Büro weist alle zwei Sekunden alle wartenden Boote zu und kassiert. Musik und Geräusche laufen weiter, die Pause wird aufgehoben.
- Der Bildschirm bleibt an (Wake Lock, wo der Browser es kann).
- Antippen der Karte, Mausrad, Escape oder „Zurück“ beendet den Modus. Das Spiel läuft normal weiter.
- Ereignisse `schauen:an`, `schauen:aus`. Schnittstelle `game.hafenSchauen.an()` und `.aus()`. Der Fotomodus bietet dafür `game.foto.rundflug(an)` und `game.foto.leiste`.

## 3. Dauerlieger

Gebaut: `web/js/features/dauerlieger.js`, Zahlen in `ECONOMY.dauerlieger` (`web/js/data/economy.js`), Tests in `tests/dauerlieger.test.mjs`.

Eine echte Marina hat nicht nur Gastplätze, sondern feste Plätze mit Dauerliegern, die für die ganze Saison bezahlen, tagsüber raussegeln und abends wiederkommen. Im Spiel ist das eine echte Entscheidung: **sicheres Geld sofort** gegen **Gäste, Ruf und Fortschritt**.

| | Gastbox | Dauerplatz |
|---|---|---|
| Geld | Liegegeld je Nacht, mit Wunschbonus, nur wenn ein Gast kommt | Saisonpacht im Voraus: 50 % des Gastpreises je Saisontag, sicher, auch bei Sturm |
| Arbeit | zuweisen, kassieren | keine, außer einen Gast umlegen, wenn der Dauerlieger früher zurückkommt |
| Ruf und Stufenziel | jeder abgereiste Gast bewertet und zählt fürs Stufenziel | keine Bewertung, zählt nicht fürs Stufenziel |
| Grenze | | höchstens ein Viertel der Gastboxen (fest vergebene Fischerplätze zählen nicht) |

- **Bewerber:** Ab Stufe 2 fragen Einheimische mit eigenem Boot nach einem festen Platz (zwei gleich zu Beginn, danach in manchen Nächten ein neuer, höchstens drei offen, jeder wartet zehn Tage). Meist (85 %) passt das Boot eines neuen Bewerbers in eine gerade freie Gastbox. Ein Hinweis oben meldet neue Anfragen.
- **Vermieten:** Eine freie Box antippen (ohne ausgewähltes Boot). Die Box leuchtet gelb, die Karte zeigt die Bewerber, deren Boot hineinpasst, mit Namen, Größe und Pacht. Ein Tipp auf einen Bewerber vermietet die Box, die Pacht für den Rest der Saison kommt sofort in die Kasse. Passt niemand oder ist die Grenze erreicht, sagt die Karte das.
- **Stammgast fragt an:** Ein Stammgast ab dem 5. Besuch, der gerade hier liegt, fragt selbst nach seinem Platz. Antippen seiner Box: „Als Dauerlieger behalten“, auch er zahlt die Saisonpacht im Voraus.
- **Neue Saison:** Am ersten Saisontag zahlen alle Dauerlieger die ganze Saison im Voraus (Hinweis „Neue Saison: Pacht bezahlt“). Wer im Winter vermietet, zahlt gleich die ganze nächste Saison.
- **Kündigen:** Zum Saisonende kostenlos (lässt sich zurücknehmen), das Boot verlässt den Hafen am ersten Wintertag. Sofort kündigen kostet die Pacht der restlichen Tage zurück plus 20 % einer Saisonpacht als Entschädigung. Vermieten und gleich wieder kündigen bringt also nichts ein.
- **Tagestörn:** An etwa 4 von 10 Tagen läuft das Boot morgens aus und kommt abends zurück. Der Platz bleibt in der Zeit belegt (rotes Schild).
- **Mehrtägiger Törn:** An etwa 1 von 8 Tagen geht es für 1 bis 3 Tage weg. Dann ist das Schild grün, und der Platz leuchtet für Gäste auf, die spätestens in der Nacht abreisen, in der das Boot zurückkommt. Bei Sturm und im Winter bleiben Dauerlieger im Hafen.
- **Früher zurück, Gast umlegen:** Etwa jeder dritte Törn endet schon am Nachmittag des letzten Tages. Ist die Box frei, legt das Boot gleich an. Liegt noch ein Gast darin, kreist der Dauerlieger auf freiem Wasser vor dem Hafen (auch nach dem Laden eines Spielstands), das Vorspulen springt auf normales Tempo zurück und ein Hinweis im Pixel-Rahmen bleibt stehen, bis alle wartenden Dauerlieger drin sind (bei mehreren nennt er alle Plätze; andere Meldungen kommen danach). Den Gast (oder den Hinweis, dann fliegt die Kamera zum Platz) antippen: Die freien passenden Boxen leuchten, ein Tipp auf eine davon legt den Gast um. Erst wenn er dort fest ist, fährt der Dauerlieger herein. Wer bis zum Abend nicht umlegt, verärgert den Dauerlieger: Er kündigt zum Saisonende und kommt nachts trotzdem an seinen Platz.
- Antippen eines Dauerplatzes zeigt Boot, bezahlte Pacht, Saisonende, Rot oder Grün mit Rückkehrtag und die Knöpfe zum Kündigen.
- Das Hafenbüro beachtet die Regel beim automatischen Zuweisen. Umlegen bleibt Sache des Spielers.
- Ohne Vorauskasse (`ECONOMY.dauerlieger.vorauskasse: false`) zahlt jeder Dauerlieger jeden Abend 50 % seines Gastpreises. Fischer zahlen immer die feste Pacht `ECONOMY.fischer.pachtProTag` (15 €).
- Schnittstelle: Hooks `fit`, `tick`, `evening`, `night` in `sim.js`, `game.sim.dispatch(events)` in `bridge.js`. Spielstand in `state.modules.dauer` (`plaetze`, `bewerber`). Ereignisse `sim:dauerNeu`, `sim:dauerPacht`, `sim:dauerBewerber`, `sim:dauerWartet`, `sim:dauerUmgelegt`, `sim:dauerKuendigung`, `sim:dauerAbfindung`, `sim:dauerAufgehoben`; für Animation und Ton `dauer:auslaufen { id, platzId, tage }` (tage 0 = Tagestörn), `dauer:einlaufen { id, platzId }` und `dauer:einlaufen { id, platzId, warten: true, info }` (kreist vor dem Hafen). `game.dauerlieger.karte(platzId)`, `.gastKarte(gastId)`, `.machDauerplatz(platzId)`, `.kuendige(platzId, an)`, `.umlege(gastId, zielId)`.

## 4. Stammgäste

Gebaut: `web/js/features/stammgaeste.js`, Namen in `web/js/data/bootsnamen.js`, Tests in `tests/stammgaeste.test.mjs`.

Jedes Gastboot hat einen Namen am Heck und einen Heimathafen (echte Häfen an Ostsee und Nordsee). Gäste, die mit 4 oder 5 Ankern bewerten, werden Stammgäste.

- Ein neues Boot ist mit 15 Prozent Wahrscheinlichkeit ein Stammgast: gleiche Art, gleiches Modell, gleicher Name und dieselben Wünsche wie beim letzten Mal, so dass man sich vorbereiten kann.
- In der Warteleiste steht „Stammgast“ am Boot, auf der Bootskarte „„Möwe“ aus Kappeln · Stammgast, 3. Besuch“.
- Wer zweimal unzufrieden abreist, kommt nicht mehr. Die Liste hat höchstens 40 Boote, die am längsten nicht mehr da waren, fallen raus.
- Ab dem 5. Besuch (und ab Stufe 2): den liegenden Stammgast antippen, „Als Dauerlieger behalten“. Er bleibt an seinem Platz.
- Keine Gesichter, keine Texte, nur Bootsname, Modell und Heimathafen.
- Daten: Boot `{ bootsname, heimathafen, stammId, besuche }`, Spielstand `state.modules.stamm`. Ereignis `stammgast:neu` (für Ton oder Logbuch).

## 5. Wetter an der Flagge

Gebaut: `web/js/features/wetterflagge.js`, Tests in `tests/wetterflagge.test.mjs`.

Neben der Wurzel von Steg A steht ein Flaggenmast mit Windsack. Er zeigt das Wetter, ohne Text:

| Lage | Zeichen am Mast |
|---|---|
| Wind heute | Windsack hängt bei Flaute, steht bei viel Wind waagerecht und zittert |
| Sturm morgen | zwei rote Sturmwimpel |
| Regatta heute oder morgen | bunte Signalflaggen-Leine vom Mast zum Boden |

- Antippen des Masts öffnet den Wetterbericht (Knopf `#weather-chip` aus `events/banner.js`), dort stehen die Einzelheiten.
- Daten aus `game.events.forecast()`. Ohne Ereignis-Modul erscheint kein Mast.
- Später möglich: den Mast ans Hafenbüro versetzen, sobald es als Gebäude steht.

## 6. Tagesziele an der Tafel

Gebaut: `web/js/features/tagesziele.js` (Regeln und Tafel), `web/js/features/ziel-deko.js` (Deko im Hafen, von `tagesziele.js` nachgeladen), Tests in `tests/tagesziele.test.mjs`, Zahlen in `ECONOMY.tagesziele` (`web/js/data/economy.js`). Roadmap P13 (Ü14, I1 bis I4).

**Ablauf.** Links unter dem Wetter steht morgens „Tagesziel wählen“ mit goldenem Rahmen. Antippen klappt drei Karten auf: leicht, mittel, schwer, jede mit Ziel und Belohnung. Der Spieler nimmt eine (Knopf „Nehmen“), das ist die Entscheidung des Tages. Danach zeigt der Knopf den Stand („Tagesziel 2/5“), die Tafel einen Balken. Was abends nicht geschafft ist, verfällt still. Fortschritt vor der Wahl zählt nicht.

**Nur eigene Handlungen zählen.** Boote, die der Spieler selbst an einen Platz legt (`moored` mit `hand: true`, gesetzt in `sim.assign`), und Münzen, die er selbst antippt oder mit einem Strich einsammelt (`collected` mit `hand: true`, `sim.collect(..., { hand: true })` aus `bridge.js`). Nicht zählen: selbst eingefahrene Boote, „Einfahren lassen“, das Hafenbüro, der Kassenautomat, der Knopf „Alle kassieren“, der Rundgang und „Hafen schauen“.

**Nur machbare Ziele.** Übernimmt das Hafenbüro das Zuweisen oder Kassieren (`sim.handAssignFor` / `sim.handCollectFor`, sobald P02 sie liefert, sonst die Bürostufe), kommen diese Ziele nicht. Bleibt nichts übrig, gibt es keine Tafel.

| Ziel | Schwere | Ab |
|---|---|---|
| N Boote von Hand einweisen | alle | Stufe 1 |
| N Boote passgenau einweisen (Box höchstens 20 % länger als das Boot) | alle | Stufe 2 |
| N Gäste mit Wunsch X versorgen (schwer: nur Segler) | alle | Wunsch erfüllbar |
| N Segelboote an Plätze mit Strom legen | mittel, schwer | Strom am Steg |
| Einem oder zwei Gästen alle Wünsche erfüllen (ab 2 Wünschen) | mittel, schwer | Stufe 2 |
| Ein oder zwei L- bzw. XL-Schiffe einweisen | mittel, schwer | Stufe 3 bzw. 5 |
| Einen Stammgast von Hand einweisen | leicht, mittel | Stammgäste vorhanden |
| Den letzten freien Platz selbst belegen | schwer | bis 12 Plätze |
| N € Liegegeld selbst einstreichen | alle | Stufe 1 |

Mengen richten sich nach den Booten, die der Spieler heute selbst einweisen kann, und dem Liegegeld mit allen Nächten (Zahlen in `ECONOMY.tagesziele.ziele`).

**Belohnungen.** Leicht bringt Geld (10, 25, 50, 80, 120, 150 € je Stufe). Mittel: doppeltes Geld, ein halber Anker oder ein Gutschein. Schwer: 3,5-faches Geld, ein halber Anker, ein seltener Gast oder ein Deko-Stück.

- **Halber Anker:** Alle Gäste, die gerade liegen, bewerten bei der Abreise einen halben Anker besser.
- **Gutschein:** 10 % zurück beim nächsten Bau (Stegprojekt, Versorgung, Hafenbüro, Anlage), höchstens das 15-fache des Grundgelds.
- **Seltener Gast:** Am nächsten Tag wird ein ankommendes Boot zu einer der seltensten Arten aus den zwei größten Klassen, die heute kommen können (`boat.selten`). Beim Einlaufen erscheint ein Hinweis.
- **Deko-Stück:** Blumenkübel, Bank am Wasser, Hafenlaterne, Rettungsring, Alter Anker, Fischkisten, Alte Tonne, Wimpelmast, in dieser Reihenfolge. Sie stehen auf der Wiese beim Hafenmeisterhaus und suchen sich selbst einen freien Platz: nie auf Wegen oder dem Wegenetz der Menschen, nie in Gebäuden (auch noch nicht gekauften) oder auf Bauplätzen von Anlagen, nie im Wasser oder am Hang. Neu verdiente Stücke hüpfen beim Aufstellen.

**Wochenziel.** Ein größeres Ziel über sieben Saisontage, oben in der Tafel: Gäste von Hand einweisen, Gäste mit 4 Ankern verabschieden, zufriedene Segler verabschieden oder Liegegeld selbst einstreichen. Belohnung: das 12-fache Grundgeld und das nächste Deko-Stück. Ziele mit 4 Ankern kommen nur, wenn alle Wünsche der Stufe erfüllbar sind. Im Winter ruht die Woche, Wintertage zählen nicht.

**Winter:** keine Tageskarten (Winterarbeiten bringt P20).

**Für andere Module:** `game.tagesziele` (`zustand()`, `karten()`, `gewaehlt()`, `woche()`, `waehle(i)`, `oeffnen()`), Ereignisse `ziel:gewaehlt`, `ziel:erreicht` { art, text, belohnung, belohnungText }, `wochenziel:erreicht`, `ziel:seltenerGast`, `ziel:gutschein`, `ziel:deko`. Ton: `auswahl` beim Nehmen, `fertig` beim Tagesziel, `stufe` beim Wochenziel.

**Spielstand:** `state.modules.ziele` (Version 2). Alte Spielstände mit drei festen Zielen bekommen am selben Tag neue Karten.
