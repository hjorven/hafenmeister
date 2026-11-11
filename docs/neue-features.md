# Neue Features: Stammgäste, Dauerlieger, Wetterflagge, Fotomodus, Hafen schauen, Tagesziele

Stand: 11.11.2026. Von Jorven am 11.11.2026 freigegeben („Vorschläge finde ich gut, alle, baue sie ein“). Gebaut vom Thread „Spielschleife zusammenbauen und Vorschläge einbauen“, gegengeprüft vom Thread „Jedes neue Feature einzeln testen“. Es gilt [abnahme.md](abnahme.md): Ein Feature erscheint erst im Spiel, wenn es funktioniert.

Alle sechs bleiben im Rahmen des Plans: keine Story, keine Figuren mit Namen, keine neue Zahl neben Geld und Ruf, Symbole statt Text.

| Feature | Braucht | Stand |
|---|---|---|
| Fotomodus mit Rundflug | nur Grundgerüst | gebaut: `web/js/ui/fotomodus.js` |
| Hafen schauen | Fotomodus, Hafenbüro-Automatik aus `sim.js` | Rundflug fertig, Automatik wartet auf `sim.js` |
| Dauerlieger | `sim.js` (Liegeplätze, Tageslauf), Bootsmodelle, Animationen | beschrieben |
| Stammgäste | `sim.js` (Gäste, Bewertung), Logbuch | beschrieben |
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

Eine echte Marina hat nicht nur Gastplätze, sondern feste Plätze mit Dauerliegern, die tagsüber raussegeln und abends wiederkommen.

- Ab Stufe 2 kann man einen Liegeplatz auf der Infokarte zum **Dauerplatz** machen. Ein Dauerplatz bringt jeden Abend ein festes, kleineres Liegegeld (Startwert 60 Prozent des Grundpreises), ohne dass man etwas tun muss. Gastplätze bringen mehr, brauchen aber Zuweisen.
- Das ist die neue kleine Entscheidung: sichere Einnahme oder mehr Platz für Gäste.
- Am Dauerplatz steht ein kleines grün-rotes Schild: grün = Boot ist draußen, der Platz ist bis zum Abend frei für einen Gast mit einer Nacht. Rot = Boot ist da. Das ist das Rot-Grün-System echter Ostseehäfen.
- **Tageslauf:** morgens laufen einige Dauerlieger aus (Segel werden vor dem Hafen gesetzt), abends kommen sie zurück und legen an. Bei Sturm bleiben alle im Hafen.
- Wer einem Gast einen grünen Platz gibt, muss ihn bis zum Abend räumen: Der Gast reist am nächsten Morgen ab, bevor der Dauerlieger wieder raus will. Gäste mit mehr als einer Nacht passen nicht auf grüne Plätze (sie leuchten nicht auf).
- Daten in `sim.js`: Liegeplatz `{ dauer: true, dauerBootId, draussen: true/false }`, Ereignisse `dauer:auslaufen`, `dauer:einlaufen` für die Animationen.

## 4. Stammgäste

Jedes Boot hat einen Namen am Heck und einen Heimathafen. Gäste, die gut bewertet haben (4 oder 5 Anker), können wiederkommen.

- Wahrscheinlichkeit, dass ein neues Boot ein Stammgast ist: 15 Prozent, wenn es Stammgäste gibt.
- Ein Stammgast erscheint in der Warteschlange mit einem kleinen Anker-Symbol. Er bringt dieselben Wünsche mit wie beim letzten Mal, so dass man sich vorbereiten kann.
- Ab dem 5. Besuch kann man ihn zum Dauerlieger machen, wenn ein Dauerplatz frei ist.
- Das Logbuch merkt sich je Boot die Zahl der Besuche („zum 5. Mal zu Gast“). Keine Gesichter, keine Texte, nur Bootsname, Modell, Farbe.
- Namen kommen aus einer Liste typischer Bootsnamen (`web/js/data/bootsnamen.js`), Heimathäfen aus echten Ostsee- und Nordseehäfen.
- Daten in `sim.js`: Boot `{ name, heimathafen, stammId?, besuche }`, Spielstand speichert `stammgaeste: [{ stammId, name, modell, farbe, wuensche, besuche }]`, höchstens 40.

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
