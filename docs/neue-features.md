# Neue Features: Stammgäste, Dauerlieger, Wetterflagge, Fotomodus, Hafen schauen, Tagesziele

Stand: 11.11.2026. Von Jorven am 11.11.2026 freigegeben („Vorschläge finde ich gut, alle, baue sie ein“). Gebaut vom Thread „Spielschleife zusammenbauen und Vorschläge einbauen“, gegengeprüft vom Thread „Jedes neue Feature einzeln testen“. Es gilt [abnahme.md](abnahme.md): Ein Feature erscheint erst im Spiel, wenn es funktioniert.

Alle sechs bleiben im Rahmen des Plans: keine Story, keine Figuren mit Namen, keine neue Zahl neben Geld und Ruf, Symbole statt Text.

| Feature | Braucht | Stand |
|---|---|---|
| Fotomodus mit Rundflug | nur Grundgerüst | gebaut: `web/js/ui/fotomodus.js` |
| Hafen schauen | Fotomodus, Hafenbüro-Automatik aus `sim.js` | Rundflug fertig, Automatik wartet auf `sim.js` |
| Dauerlieger | `sim.js`, Animationen für Aus- und Einlaufen | gebaut: `web/js/features/dauerlieger.js` |
| Stammgäste | `sim.js` (Gäste, Bewertung) | gebaut: `web/js/features/stammgaeste.js` |
| Wetter an der Flagge | `events/events.js` (Ankündigung am Vortag) | beschrieben |
| Tagesziele an der Tafel | `sim.js`, Hafenbüro als Gebäude | beschrieben |

## 1. Fotomodus mit Rundflug

Knopf „Foto“ oben (Taste `F`). Die Leisten verschwinden, unten bleibt eine kleine Leiste mit drei Knöpfen, die nach 3 Sekunden ohne Bewegung fast unsichtbar wird.

- **Bild sichern:** speichert genau das Bild auf dem Schirm als PNG (`hafenmeister-JJJJ-MM-TT-HHMM.png`), kurzer weißer Blitz, auf dem Handy ein kurzes Vibrieren.
- **Rundflug:** Die Kamera gleitet langsam seitlich über den Hafen und zoomt sanft ein und aus. Jede Berührung oder das Mausrad hält ihn an. Läuft auch in der Pause.
- **Zurück** oder `Escape`: alles wie vorher.

Ereignisse für andere Module: `foto:an`, `foto:aus`, `foto:bild` (Ton-Thread: Auslöser-Klick). Schnittstelle: `game.foto.an()`, `game.foto.aus()`, `game.foto.bildSichern()`, `game.foto.aktiv`.

Später, wenn die Kamera drehen kann (Plan Abschnitt 8): Drehen auch im Fotomodus.

## 2. Hafen schauen

Ein Ruhemodus für ein Tablet auf dem Tisch: Rundflug plus Hafenbüro weist alle Boote selbst zu, auch die Sonderfälle, und Musik läuft. Freigeschaltet mit dem Hafenbüro (Stufe 3), weil es die Automatik braucht.

- Einstieg: im Fotomodus ein vierter Knopf „Schauen“, erst sichtbar, wenn das Hafenbüro steht.
- Kein Geld geht verloren: Kassieren passiert automatisch, Bewertungen zählen normal.
- Schnittstelle an `sim.js`: `sim.setAutomatik('alle' | 'standard' | 'aus')`.

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

Ereignisse werden einen Tag vorher angekündigt. Statt Text zeigt das der Hafen selbst:

| Morgen | Zeichen am Hafen |
|---|---|
| Sturm | Windsack steht waagerecht, Flagge flattert schnell, Wolkenschatten werden dunkler |
| Regatta | Bunte Signalflaggen-Leine am Mast des Segelclubs |
| Ruhiger Tag | Flagge hängt locker, Windsack schlaff |

- Vor dem Hafenbüro (Stufe 1: ein Mast am Steg) steht ein Flaggenmast mit Windsack.
- Antippen zeigt auf der Infokarte ein Symbol für das Wetter von morgen.
- Hört auf `ereignis:angekuendigt` aus `events/events.js`.

## 6. Tagesziele an der Tafel

Am Hafenbüro (Stufe 1: ein Brett am Steg) hängt eine Tafel mit drei kleinen Zielen für den Tag, z. B. „Zwei Segelboote unterbringen“, „Ein Boot mit drei Wünschen ganz zufriedenstellen“, „Alle Plätze einmal belegt“.

- Ziele als Symbole plus Zahl, kein Fließtext.
- Belohnung: ein kleiner Geldbetrag und ein Häkchen mit Ton. Kein Druck: Nicht erreichte Ziele verfallen still am Abend.
- Die Ziele passen immer zur Stufe, nur Dinge, die man schon kann.
- Daten: `web/js/data/tagesziele.js` mit Vorlagen je Stufe, Auswertung in `sim.js` über die Ereignisse, die es ohnehin sendet.
