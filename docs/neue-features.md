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

Gebaut: `web/js/features/dauerlieger.js`, Tests in `tests/dauerlieger.test.mjs`.

Eine echte Marina hat nicht nur Gastplätze, sondern feste Plätze mit Dauerliegern, die tagsüber raussegeln und abends wiederkommen.

- Ab Stufe 2 einen freien Liegeplatz antippen (ohne ausgewähltes Boot). Die Infokarte bietet „Zum Dauerplatz machen“. Dort liegt dann ein eigenes Boot, am liebsten ein Segelboot.
- Ein Dauerplatz bringt jeden Abend einen festen Anteil des Gastpreises (`rules.stationedFeeShare`, heute 50 Prozent), ohne Zuweisen. Gastplätze bringen mehr, brauchen aber Arbeit. Das ist die neue kleine Entscheidung.
- **Tagestörn:** An etwa 4 von 10 Tagen läuft das Boot morgens aus und kommt abends zurück. Der Platz bleibt in der Zeit belegt (rotes Schild).
- **Mehrtägiger Törn:** An etwa 1 von 8 Tagen geht es für 1 bis 3 Tage weg. Dann ist das Schild grün, und der Platz leuchtet für Gäste auf, die spätestens in der Nacht abreisen, in der das Boot zurückkommt. Liegt dann noch ein Gast dort (zum Beispiel nach einem Sturm), wartet das Boot eine Nacht.
- Antippen eines Dauerplatzes zeigt Boot, Rot oder Grün, Rückkehrtag und den Knopf „Dauerplatz aufheben“.
- Das Hafenbüro beachtet die Regel beim automatischen Zuweisen.
- Schnittstelle: Hook `fit` in `sim.js` (zusätzliche Passregel), `game.sim.dispatch(events)` in `bridge.js`. Spielstand in `state.modules.dauer`. Ereignisse `dauer:auslaufen { id, platzId, tage }` (tage 0 = Tagestörn) und `dauer:einlaufen { id, platzId }` für Animation und Ton.

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

**Wochenziel.** Ein größeres Ziel über sieben Saisontage, oben in der Tafel: Gäste von Hand einweisen, Gäste mit 4 Ankern verabschieden, zufriedene Segler verabschieden oder Liegegeld selbst einstreichen. Belohnung: das 12-fache Grundgeld und das nächste Deko-Stück. Ziele mit 4 Ankern kommen nur, wenn alle Wünsche der Stufe erfüllbar sind. Im Winter ruht die Woche, Wintertage zählen nicht. Die Größe ist so bemessen, dass die Woche nicht in zwei Tagen zu schaffen ist (etwa die Hälfte aller Ankünfte der Woche von Hand einweisen).

**Morgens.** Erst kommt der Tagesabschluss, danach öffnet sich die Kartenwahl einmal von selbst (nicht während Einstieg, Bauen oder offener Karte; dann leuchtet nur das Schild). Solange der Abschluss offen ist, tritt die Tafel zurück und Meldungen warten. Am Handy quer liegen die drei Karten nebeneinander rechts neben der linken Spalte; die Tafel endet immer über Zeitsteuerung, Kassieren und Bauen.

**Deko-Plätze.** Die Stücke suchen ihren Platz relativ zum Hafenmeisterhaus und meiden alles, was an Land steht (Gebäude mit 3 m Abstand, Dorf, Anlagen, Flaggenmast, Wege). Sie hängen an keinen festen Koordinaten und passen sich jeder Hafenlage an.

**Winter:** keine Tageskarten (Winterarbeiten bringt P20).

**Für andere Module:** `game.tagesziele` (`zustand()`, `karten()`, `gewaehlt()`, `woche()`, `waehle(i)`, `oeffnen()`), Ereignisse `ziel:gewaehlt`, `ziel:erreicht` { art, text, belohnung, belohnungText }, `wochenziel:erreicht`, `ziel:seltenerGast`, `ziel:gutschein`, `ziel:deko`. Ton: `auswahl` beim Nehmen, `fertig` beim Tagesziel, `stufe` beim Wochenziel.

**Spielstand:** `state.modules.ziele` (Version 2). Alte Spielstände mit drei festen Zielen bekommen am selben Tag neue Karten.
