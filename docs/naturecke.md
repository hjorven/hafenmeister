# Naturecke am Schilf (P52, F39)

Stand: 22.11.2026. Status: gebaut. Paket P52 aus der [Roadmap](roadmap.md), Welle 4.

Neben dem Hafen wächst ein Schilfgürtel im flachen Wasser, mit Rohrkolben, Blässhühnern und abends Fröschen. Ab Ausbaustufe 2 entscheidet der Spieler einmal, was daraus wird: schützen oder bebauen. Die Entscheidung ist endgültig (Regel F39). Wer nichts tut, behält das Schilf ohne Wirkung auf Geld oder Bewertung.

## So spielt es sich

- **Von Anfang an:** Der Schilfgürtel steht auf jeder Küste neben dem Hafen (Lage siehe unten). Die Halme wiegen im Wind und färben sich mit der Jahreszeit (frisch grün, sommergrün, goldbraun im Herbst, strohfahl im Winter). Drei Blässhühner schwimmen am Rand entlang. Im Frühling und Sommer singt tagsüber der Rohrsänger und abends quaken Frösche, aber nur, wenn das Schilf nah im Bild ist.
- **Die Frage:** Erreicht der Hafen Stufe 2, kommt einmal die Meldung "Was wird aus dem Schilf am Ufer?". In Stufe 1 stehen beide Angebote schon gesperrt im Baumenü ("ab Ausbaustufe 2").
- **Baumenü, Reiter Hafen:** "Schilfgürtel schützen" (300 €) und "Ufer am Schilf bebauen" (900 €). Die Vorschau fährt die Kamera hin und zeigt gelb, was entsteht. Ein roter Kasten sagt "Nicht umkehrbar". Der Knopf heißt "Schützen für 300 €" oder "Bebauen für 900 €". Anders als sonst im Baumenü gibt es danach kein Rückgängig. "Als Nächstes" schlägt die Naturecke nie vor, weil das eine Entscheidung des Spielers ist.
- **Schützen:** Brett für Brett entsteht ein Bohlenweg vom Ufer durchs Schilf zu einer Beobachtungshütte auf Stelzen, am Ufer steht ein Schild mit Vogel. Zwei Haubentaucher ziehen ein (sie tauchen ab und tauchen ein Stück weiter wieder auf, im Winter ziehen sie weg), ein viertes Blässhuhn kommt dazu. Tagsüber geht ab und zu jemand mit Fernglas zur Hütte, schaut eine Weile und geht zurück (nicht bei Regen, nachts und im Winter).
  - **Wirkung:** Jeder Gast, der einen Abend in der Saison im Hafen liegt, bewertet um 0,1 Anker besser. Im Gästebuch steht "Abend am Schilf" als Pluspunkt.
- **Bebauen:** Das Schilf verschwindet, eine Fläche mit Spundwand hebt sich aus dem Wasser. Darauf liegt ein Park- und Trailerplatz mit Autos, Bootstrailern mit kleinen Motorbooten und einem Parkscheinautomaten. Je höher die Ausbaustufe, desto voller der Platz. Vögel und Frösche ziehen weg.
  - **Wirkung:** Jeden Abend in der Saison bringt der Platz einen Grundbetrag je Stufe (Stufe 2: 20 €, Stufe 3: 50 €, 4: 90 €, 5: 140 €, 6: 200 €) plus 2 € je Gastboot im Hafen. Im Tagesabschluss steht er als "Parkplatz am Ufer". Im Winter bringt er nichts.
- **Hafentiere:** Der Graureiher aus P51 fischt am liebsten am Rand des Schilfs (sechs von zehn Plätzen), solange es steht.

Abwägung: Bebauen bringt Geld, in Stufe 2 an einem Abend mit zehn Gästen rund 40 €, in Stufe 6 mit vierzig Gästen rund 280 €. Schützen hebt jede Bewertung ein wenig und macht den Hafen lebendiger. Die Zahlen stehen in `ECONOMY.naturecke` (`web/js/data/economy.js`, Übersicht in [zahlen.md](zahlen.md)).

## Wo das Schilf wächst

`web/js/render/landschaft/naturecke-lage.js` sucht je Küste, Seed, Revier und Stegbild einen Platz. Ein Schilfpunkt (Raster 2,5 Planeinheiten, Gürtel bis 27 Einheiten um die Mitte) muss:

- in jeder Stufe 1 bis 6 zwischen 0,03 und 1,3 m tief sein und höchstens 10 Einheiten vom Ufer entfernt liegen,
- mindestens 8 Einheiten von der Hafenfläche weg sein,
- Abstand halten zu Stegen, Diensten, Molen und Liegeplätzen aller Stufen, zum Schwimmwellenbrecher, zum Weg von den Stegen zum Seegatt und zum Seeweg, zu Wartebojen, Ankerfeldern, Pricken, Bojenfeld, Seebrücke und Strandkörben, zur Einfahrt, zum Uferstreifen des Paddlers und zur Runde der Freizeitboote, und zu den Bauplätzen aller Angebote an Land.

Die Mitte liegt im Spielbereich (`spielRect`), denn nur dort kann die Kamera hinschauen. Gesucht wird von den Stegen der Stufe 2 nach außen. Mindestens 55 Punkte, sonst kommt der nächste Kandidat; findet sich nichts, sucht es mit kleineren Abständen noch einmal. Dazu gehören ein Ufer an Land für den Bohlenweg und eine Fläche für den Parkplatz.

Gemessen: Ostsee auf allen 15 Küsten mit Seeds 1 und 2 und mit allen 13 Stegbildern auf Küste 1 und 4 gibt es einen Gürtel mit 58 bis 208 Punkten. Der weiteste liegt auf dem Inselhafen (Küste 10, Seed 2) rund 290 m von den Stegen. Nordsee: höchstens 3 Küsten ohne Platz (die Nordsee kommt erst mit P57). Ohne Platz gibt es kein Schilf und keine Angebote im Baumenü.

Die Suche dauert am PC 0,3 bis 3 s. Im Spiel läuft sie 1,2 s nach dem Start in Stücken von 8 ms mit einem Bild Pause dazwischen (`naturLageSpaeter`); das längste Stück ist im Browser rund 0,2 s (einmalige Strand- und Bojenrechnung einer Stufe). Das Ergebnis kommt in den Spielstand, ein geladener Hafen rechnet nicht neu. Öffnet jemand vorher das Baumenü, rechnet `naturLage` am Stück.

## Zusammenspiel und Kollisionen

- **Landschaft:** Das Schilf aus `render/landschaft` (gebackene Meshes `schilf`) bleibt. Beim Bebauen versteckt die Naturecke die natürlichen Halme unter dem Parkplatz, sonst ragten sie durch den Asphalt.
- **Jugendtraining (P39):** Das Schilf ist flach genug für Optis. `render/jugend-bild.js` prüft darum `game.naturecke.imSchilf`, Bojen, Sammelplatz und Kurs liegen nie darin.
- **Boote:** Der Gürtel hält Abstand zu allen Wegen der Boote (Route, Seeweg, Front, Wartebojen, Ankerfeld, Bojenfeld, Paddler, Freizeitrunde). Die Fahrwasser-Karte kennt das Schilf nicht; mit 0,03 bis 1,3 m Wasser ist es für Gastboote ohnehin zu flach.
- **Strand (Seebrücke, Strandkörbe):** Ihre Lagen werden für die Stufen 2, 3, 4 und 6 gerechnet. Stufe 1 liegt auf allen Küsten (Seeds 1, 2) wie 2, 3 oder 6, Stufe 5 wie 4 (Messung 22.11.). Ändert P59 oder ein späteres Paket die Strandlagen je Stufe, `STRAND_STUFEN` prüfen.
- **Hafentiere (P51):** Reiherplätze aus `game.naturecke.reiherPlaetze()`; neu gesetzt bei `naturecke:lage` und `naturecke:wahl`.
- **Gästebuch, Bewertung:** Der Bonus läuft über den Hook `rating` und `ratingParts.natur` (`sim.js`). Im Gästebuch zieht `gaestebuch-daten.js` ihn vom "bequemen Platz" ab, damit er nicht doppelt zählt.
- **Bauen:** `ui/bauen.js` hat drei neue Felder für Einträge: `endgueltig` (kein Rückgängig, roter Hinweis), `knopf` (Text statt "Bauen") und `warnung`.
- **Zeitraffer-Bots:** Die Bots wählen nichts; die Naturecke bleibt im Zeitraffer neutral. Ein Bot, der schützt oder bebaut, ist ein mögliches Extra.
- **Leistung Handy:** Schilf als ein Mesh mit Wind im Shader, Vögel klein. Nach dem Bauen fasst die Naturecke Weg und Parkplatz je Material zu einem Mesh zusammen (Parkplatz rund 80 auf 16 Zeichenaufrufe).
- **Querformat Handy:** Die Vorschau-Karte ist wie bei Hafencafé und Hafenbüro etwas höher als der Platz; der Knopf ist mit einem kurzen Wisch erreichbar.

## Zum Ausprobieren

- `?naturecke=zeigen` fährt die Kamera zum Schilf.
- `?stufe=3&naturecke=schutz` oder `?stufe=3&naturecke=bebaut` entscheidet im Testmodus sofort und fährt hin.
- Mit `&gelaende=n&seed=s` auf einer festen Küste, zum Beispiel `https://hjorven.github.io/hafenmeister/?stufe=4&gelaende=7&seed=2&naturecke=schutz`.

## Spielstand

`state.modules.naturecke = { wahl: 'schutz' | 'bebaut' | null, tag, lage: { key, wert } }`. `lage` ist nur ein Zwischenspeicher (Küste, Seed, Revier, Stegbild im Schlüssel). Am Gast: `boat.natur = true`, wenn er einen Abend am geschützten Schilf lag. Alte Spielstände laden unverändert (kein neuer `SAVE_VERSION`).

## Dateien

| Was | Wo |
|---|---|
| Zahlen | `ECONOMY.naturecke` in `web/js/data/economy.js` |
| Regeln ohne Browser | `web/js/features/naturecke-regeln.js` |
| Lage im Gelände | `web/js/render/landschaft/naturecke-lage.js` |
| Bild, Vögel, Töne, Schnittstelle `game.naturecke` | `web/js/features/naturecke.js` |
| Baumenü | `web/js/ui/bauen.js` |
| Tagesabschluss, Gästebuch | `web/js/ui/tagesabschluss.js`, `web/js/ui/gaestebuch-daten.js` |
| Töne `rohrsaenger`, `froesche` | `web/js/audio/audio.js` |
| Tests | `tests/naturecke.test.mjs` |
