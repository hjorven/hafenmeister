# Neue Features: Stammgäste, Dauerlieger, Wetterflagge, Fotomodus, Hafen schauen, Tagesziele

Stand: 11.11.2026. Von Jorven am 11.11.2026 freigegeben („Vorschläge finde ich gut, alle, baue sie ein“). Gebaut vom Thread „Spielschleife zusammenbauen und Vorschläge einbauen“, gegengeprüft vom Thread „Jedes neue Feature einzeln testen“. Es gilt [abnahme.md](abnahme.md): Ein Feature erscheint erst im Spiel, wenn es funktioniert.

Alle sechs bleiben im Rahmen des Plans: keine Story, keine Figuren mit Namen, keine neue Zahl neben Geld und Ruf, Symbole statt Text.

| Feature | Braucht | Stand |
|---|---|---|
| Fotomodus mit Rundflug | nur Grundgerüst | gebaut: `web/js/ui/fotomodus.js` |
| Hafen schauen | Fotomodus, Hafenbüro Stufe 3 | gebaut: `web/js/features/hafen-schauen.js` |
| Dauerlieger | `sim.js`, Animationen für Aus- und Einlaufen | gebaut: `web/js/features/dauerlieger.js` |
| Stammgäste | `sim.js` (Gäste, Bewertung) | gebaut: `web/js/features/stammgaeste.js` |
| Wetter an der Flagge | `events/events.js` | gebaut: `web/js/features/wetterflagge.js` |
| Tagesziele an der Tafel | `sim.js` | gebaut: `web/js/features/tagesziele.js` |

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

Gebaut: `web/js/features/tagesziele.js`, Tests in `tests/tagesziele.test.mjs`.

Links unter der oberen Leiste steht „Tagesziele 0/3“. Antippen klappt die Tafel mit drei kleinen Zielen für den Tag auf, Antippen der Karte klappt sie wieder zu.

| Ziel | Ab Stufe |
|---|---|
| N Boote unterbringen (etwa 60 Prozent der erwarteten Ankünfte) | 1 |
| Alle Wünsche eines Boots erfüllen (ab 2 Wünschen) | 1 |
| N € Hafengeld kassieren (etwa 60 Prozent des erwarteten Hafengelds) | 1 |
| Alle Plätze gleichzeitig belegt (nur bis 12 Plätze) | 1 |
| Einen Stammgast unterbringen (nur wenn es Stammgäste gibt) | 1 |
| 2 oder 3 Segelboote unterbringen | 2 |
| Ein L- oder XL-Schiff unterbringen | 3 |

- Belohnung je Ziel: 10, 25, 50, 80, 120 € je nach Stufe, mit Haken, kurzem Hüpfen der Tafel, Vibration und Ereignis `ziel:erreicht` für den Ton.
- Kein Druck: Was abends nicht geschafft ist, verfällt still. Im Winter gibt es keine Ziele und keine Tafel.
- Spielstand in `state.modules.ziele`.
- Später möglich: die Tafel als 3D-Brett am Hafenbüro.
