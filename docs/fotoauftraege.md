# Fotoaufträge und Postkarten (P43, F22/L6)

Stand: 22.11.2026. Status: gebaut. Code: `web/js/features/fotoauftraege.js` (Oberfläche),
`web/js/features/fotoauftraege-regeln.js` (Regeln ohne Browser), Texte `web/js/data/fotoauftraege.js`,
Zahlen `ECONOMY.fotoauftraege` in `web/js/data/economy.js`. Tests `tests/fotoauftraege.test.mjs` und
`tests/specs/fotoauftraege.spec.mjs`.

Der Fotomodus (Taste P) bekommt ein Ziel: Ein Postkartenverlag bestellt ab und zu ein Foto vom Hafen. Passt das
Bild, wird es zur Postkarte, der Verlag zahlt einmal ein Honorar, und die Karte kommt ins Logbuch.

## So spielt es sich

1. **Auftrag am Morgen.** Ab Tag 2 steht im Meldeplatz zum Beispiel „Fotoauftrag: Sonnenuntergang“ mit dem Wunsch
   des Verlags, dem Honorar und der Frist („Bis Tag 7“). „Zum Foto“ öffnet den Fotomodus und holt das Motiv ins
   Bild, wenn es eins gibt; „Später“ schließt die Meldung. Ein Auftrag gilt drei Tage. Danach (erledigt oder
   verfallen) ist einen Tag Pause.
2. **Fotomodus.** Oben steht ein schmaler Zettel: Auftrag, Honorar und was gerade fehlt („Noch nicht die richtige
   Uhrzeit: 18:30 bis 21:30 Uhr“, „Zu wenige Boote im Bild: mindestens 3 Boote“, „Näher heran“). Vorn in der
   Leiste steht ein Knopf „Postkarte: Sonnenuntergang“ (Handy: „Postkarte“). Passt das Bild, werden Zettel und
   Knopf gold, die Leiste bleibt dann gut zu sehen.
3. **Suchen.** Passt das Bild nicht, aber das Motiv ist irgendwo (ein Boot legt gerade an, ein voller Steg, das
   Kreuzfahrtschiff), heißt der Knopf „Anleger suchen“ (Handy: „Suchen“) und fährt die Kamera hin und heran,
   wie bei den seltenen Besuchern (P40). Keine eigene Kamerafahrt.
4. **Postkarte.** Ein Druck blitzt, die Postkarte springt kurz ins Bild („Grüße aus Dünenhafen“, Briefmarke mit
   dem Symbol des Motivs, „+45 €“) und fliegt dann weg. Münzklang, beim ersten Motiv dazu der Erfolgston.
5. **Logbuch, Reiter „Postkarten“.** Oben der Stand („3 von 12 Postkarten · 290 € Honorar“) und die offenen
   Aufträge mit „Zum Foto“. Darunter zwölf Fächer: aufgenommene Karten mit Bild und Tag, offene mit Symbol und
   Hinweis, wann das Motiv kommt. Antippen zeigt die Karte groß, mit „Postkarte sichern“ (Handy: Teilen-Menü, PC:
   Download als JPEG mit Rand, Gruß und Briefmarke).

## Die zwölf Motive

| Motiv | Art | Wann es passt |
|---|---|---|
| Sonnenuntergang | wechselnd | 18:30 bis 21:30 Uhr, mindestens 3 Boote im Bild |
| Morgenstimmung | wechselnd | 6:30 bis 8:30 Uhr, mindestens 3 Boote im Bild |
| Anleger | wechselnd | ein Boot auf den letzten 50 m vor seiner Box oder seinem Platz (nicht an Bojen), groß und mittig im Bild |
| Voller Steg | wechselnd | ein Steg mit mindestens 4 Plätzen, alle belegt, ganz im Bild und groß genug |
| Der ganze Hafen | wechselnd | mindestens 85 % der Liegeplätze im Bild, mindestens 4 Boote im Hafen |
| Hafen im Schnee | wechselnd, nur Winter | in den zwei Wintertagen, 60 % der Plätze im Bild |
| Hoher Besuch | Sonder, ab Stufe 2 | ein seltener Besucher (P40) groß und mittig im Bild |
| Großes Schiff | Sonder, Stufe 6 | Kreuzfahrtschiff, Flottenbesuch oder Großsegler groß und mittig im Bild |
| Hafen im Nebel | Sonder | am Nebeltag, mindestens 3 Boote im Bild |
| Sommertag | Sonder | am Sommertag, mindestens 4 Boote im Bild |
| Regatta | Sonder, ab Stufe 3 | am Regattatag zwei gelbe Tonnen der Bahn und 2 Boote im Bild |
| Festtag | Sonder, ab Stufe 2 | Hafenfest, Mittsommer, Heringstage, Holzboot-Treffen oder Hanse-Woche, mindestens 4 Boote im Bild |

- **Wechselnde Aufträge** kommen nacheinander, nie zweimal dasselbe Motiv hintereinander. Motive ohne Postkarte
  kommen viermal so oft. Im Winter gibt es nur „Hafen im Schnee“; wechselt die Jahreszeit, endet der alte Auftrag
  und der neue kommt sofort (der Winter ist nur zwei Tage lang).
- **Sonderaufträge** kommen am besonderen Tag dazu, auch mitten am Tag (das Kreuzfahrtschiff läuft ein, der
  Besucher meldet sich an), nur für Motive, die noch keine Postkarte haben, und gelten nur heute. Höchstens einer
  am Tag. Im Fotomodus geht der Sonderauftrag vor, wenn beide gerade nicht passen; passt einer, gilt der.
- **Gezählt wird, was zu sehen ist:** Boote im Bild aus der 3D-Ansicht, nicht aus den Spielregeln. Nach dem
  Vorspulen liegen Boote in den Regeln schon fest, fahren im Bild aber noch an: dann fehlen sie noch.
- **Mittig:** Ein Motiv muss mindestens 10 % der halben Bildbreite vom Rand weg sein (`foto.rand`, nicht unter Zettel
  und Leiste) und mindestens 7 % der kürzeren Bildseite groß sein (`foto.mindestGroesse`).

## Zahlen

`ECONOMY.fotoauftraege` (Prüfung mit `node tools/zahlen.mjs --pruefen`):

| Feld | Wert | Bedeutung |
|---|---|---|
| `abTag` | 2 | erster Auftrag frühestens an diesem Spieltag |
| `dauerTage` | 3 | so lange gilt ein wechselnder Auftrag |
| `pauseTage` | 1 | danach so viele Tage ohne neuen |
| `honorar` | 25, 45, 80, 120, 170, 240 € (Stufe 1 bis 6) | etwa ein gutes mittleres Tagesziel |
| `sonderFaktor` | 1,5 | Sonderauftrag |
| `nachdruckFaktor` | 0,5 | Motiv hat schon eine Postkarte (neues Bild ersetzt das alte) |
| `foto` | Rand 0,1, Mindestgröße 0,07 | siehe oben |
| `abend`, `morgen` | 18,5 bis 21,5 und 6,5 bis 8,5 Uhr | Lichtfenster |
| `mindestBoote`, `vollerSteg`, `ganzerHafen`, `anlegen` | 3; 4 Plätze; 85 %, 4 Boote; 50 m | siehe Tabelle der Motive |

Das Honorar steht im Tagesabschluss unter „Sonstiges“ als „Honorar für Postkarten“
(`addIncome(betrag, 'sonstiges', 'postkarte')`). Der Zeitraffer-Bot fotografiert nie, das Balancing bleibt gleich.

## Erfolg

„Postkartenständer“ (Wimpel, Gruppe Sammeln): alle zwölf Postkarten. Damit hängen 23 von 24 Wimpeln am Mast.

## Technik

- Spielstand `state.modules.fotoauftraege = { tag, auftrag, sonder, frei, letztes, sonderTag, karten, erledigt, summe, neu }`,
  Postkarten als JPEG 480 x 320 unter 48.000 Zeichen je Motiv (rund 36 KB, zwölf Karten zusammen unter 450 KB).
  `saeubern()` räumt geladene Stände auf (fremde Motive, kaputte Einträge, zu große oder fremde Bilder), darum keine
  neue `SAVE_VERSION`.
- Regeln ohne Browser: `pruefen(state, lage)` läuft einmal je Sekunde und ist wiederholbar (Morgen einmal je Tag,
  Sonderauftrag sobald der Anlass da ist). `lage = { stufe, winter, ereignis, besucher, grossschiff }`
  kommt aus der Oberfläche: `game.events.current` (nur zwischen `startDay` und `endDay`), `game.besucher.heute()`
  und `game.besucher.motive()`, `'besuch:einlaufen'` (P47). Zufall nur aus Seed und Tag.
- Oberfläche: eine Zeile in `MODULES` (nach `grosse-ankunft.js`), Meldung `#hm-fotoauftrag` im Meldeplatz mit
  Vorrang `fotoauftrag: 26` (über Gästepost 24, unter Erfolg 30), Zettel `#hm-fa-zettel` nur im Fotomodus, Knopf
  `.hm-fa-foto` in `game.foto.leiste`, Logbuch-Reiter `postkarten`.
- Schnittstelle: `game.fotoauftraege = { offen(), pruefeBild(motiv?), aufnehmen(), setze(motiv), suchen(motiv?),
  fortschritt(), lage(), stunde(), meldung(), sichern(motiv) }`. Ereignisse `postkarte:neu { motiv, honorar,
  erstes, sonder }`, `fotoauftrag:neu`, `fotoauftrag:verfallen`. Chronik-Zeile „Neue Postkarte: ...“ über
  `game.logbuch.merken`.

## Ausprobieren

`?fotoauftrag=abendrot` (auch `morgen`, `anlegen`, `voller-steg`, `ganzer-hafen`, `winter`, `besucher`,
`grossschiff`, `nebel`, `sommertag`, `regatta`, `fest`) setzt den Auftrag sofort. Das Motiv selbst muss im Spiel da
sein, zum Beispiel:

- `https://hjorven.github.io/hafenmeister/?stufe=2&fotoauftrag=abendrot`: auf 8x stellen, bis abends Boote liegen, dann P.
- `?stufe=5&besucher=koenigsyacht&fotoauftrag=besucher`
- `?stufe=6&services=alle&ankunft=kreuzfahrt&fotoauftrag=grossschiff`

## Entscheidungen (ohne Rückfrage, Jorven soll nicht gefragt werden)

- Auftraggeber ist ein Postkartenverlag ohne Namen und ohne Figur (Vision: keine Charaktere, keine Story).
- Nur Motive, die es im Spiel wirklich gibt und die sich am Bild prüfen lassen. Verworfen: „Segelboot unter Segeln“
  (Segel sind im Revier fast immer schon geborgen), „Festmacher bei der Arbeit“ (P48 bietet die Leine im Fotomodus
  nicht an), „Sturm“ (kein eigenes Bild für Sturm im Hafen).
- Geld nur einmal je Auftrag, kein laufender Postkartenverkauf am Kiosk: das hätte das Balancing verschoben,
  und der Bot fotografiert nicht.
- Die Postkarte zeigt die Bildmitte (3:2), nicht nur das Motiv; der goldene Knopf kommt erst, wenn das Motiv
  mittig genug ist, damit es auch auf der Karte ist.

## Zusammenspiel und mögliche Kollisionen

- **P40 Seltene Besucher:** Beim Auftrag „Hoher Besuch“ stehen zwei goldene Knöpfe in der Leiste („Postkarte“ und
  „Königsyacht ins Logbuch“). Ein Druck auf „Postkarte“ macht beides, das Foto kommt auch in den Reiter
  „Besucher“. Gezählt wird mit eigenem, strengerem Rand und zusätzlich mit `game.besucher.imBild()`.
- **P47 Große Ankünfte:** nutzt `'besuch:einlaufen'` für die Lage der Schiffe und `'ankunft:angesagt'` als Anstoß
  für den Sonderauftrag; keine zweite Kamerafahrt. Fährt gerade die Ankunft-Kamera, kann „Suchen“ sie ablösen
  (die zuletzt gesetzte Fahrt gewinnt, wie in grosse-ankuenfte.md beschrieben).
- **Fotomodus und Hafen schauen:** Knopf und Zettel ruhen während „Hafen schauen“. Die Leiste hat einen Knopf mehr;
  auf dem Handy bricht sie in zwei Zeilen um (Regel aus P40).
- **Logbuch:** sechster Reiter (Boote, Chronik, Erfolge, Geschichten, Besucher, Postkarten). Am PC scrollt die Reiterleiste, auf dem Handy bricht sie in drei Zeilen um; ein weiterer Reiter (P49 Wissen) macht es noch enger.
- **Meldeplatz:** Vorrang 26, die Meldung wartet hinter Einstieg und Tipps. Am ersten Spieltag kommt nie ein Auftrag.
- **Erfolge:** ein neuer Wimpel, 23 von 24 Plätzen am Mast. Ein weiteres Paket mit Wimpel (z. B. P49 oder P51)
  muss prüfen, ob noch Platz ist (Test „Erfolgsmast hat 24 Plätze“).
- **P44 Hafenname:** Der Gruß auf der Postkarte nimmt `game.hafenname.name`, `game.hafenName`,
  `state.hafen.name` oder `state.modules.hafenname.name`, sonst den Hafennamen der Region. Wenn P44 einen anderen
  Ort wählt, hier eine Zeile in `hafenName()` ergänzen.
- **Speicher:** Postkarten und Besucherfotos (P40) liegen zusammen unter 1 MB je Spielstand.
