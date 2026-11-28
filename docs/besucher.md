# Seltene Besucher (Paket P40)

Stand: 22.11.2026. Status: gebaut (Roadmap F16, P40).

Ab und zu kommt ein besonderes Schiff in den Hafen: ein Weltumsegler, ein Museumsdampfer, ein Forschungskutter oder die Königsyacht. Es meldet sich morgens per Funk an und wünscht sich einen Ehrenplatz. Dazu schwimmen an manchen Tagen Schwäne durch den Hafen und vor der Einfahrt taucht ein Schweinswal auf. Alle sechs sind Fotomotive für das Logbuch.

## Im Spiel

- **Wann:** ab Stufe 2 an rund 10 bis 12 Prozent der Tage (`economy.seltenerBesuch.anteil`), nie am ersten Tag, nie im Winter, mindestens 3 Tage Abstand, nie zwei zugleich. Ein Schiff, das man noch nie gesehen hat, kommt viermal so oft wie eines, das schon da war. Ankunft zwischen 30 und 70 Prozent des Tages.
- **Welche:** Weltumsegler ab Stufe 2 (3 Nächte), Museumsdampfer ab Stufe 3 (2 Nächte, Tagesgäste kommen an Bord), Forschungskutter ab Stufe 4 (2 Nächte), Königsyacht ab Stufe 5 (1 Nacht, 37,5 m, nur am Kai). Ein Schiff kommt nur, wenn es in den Hafen passt.
- **Anmeldung:** Morgens steht im Meldeplatz „Funk: Der Weltumsegler „Passatwind“ meldet sich an“ mit Herkunft, Zeit und Wunsch. „Ehrenplatz B17 freihalten“ hält ihn frei (wie die Funk-Anmeldung aus P28, mit Bonus beim Einlaufen), „Anderer“ zeigt den nächsten, „Später“ schließt die Meldung. Ist kein Ehrenplatz frei, bietet die Meldung eine normale Box an. Im Funk der Vorschauleiste steht das Schiff mit Markierung, Antippen öffnet die Meldung wieder.
- **Ehrenplatz:** längsseits am Stegkopf (Stirnplatz) oder am Kai. Der Ehrenplatz ist ein Platz-Wunsch der Regeln: Beim Ziehen leuchten diese Plätze gold, das Büro und das Selbst-Einfahren nehmen sie zuerst, die Bewertung zählt ihn wie jeden Wunsch. Ist der Ehrenplatz schon belegt, legt sich das Schiff anderswo hin und bewertet schlechter; wer ihn frei hält, bekommt ihn sicher.
- **Am Ehrenplatz:** Leute aus dem Ort kommen schauen (Menschen am Steg), „Ehrenplatz!“ steigt über dem Schiff auf, abends kaufen die Schaulustigen im Ort ein (30 € in Stufe 2 bis 260 € in Stufe 6 je Abend, Königsyacht doppelt, Museumsdampfer anderthalbfach). Eine Meldung bietet „Foto“ und „Ansehen“ an. Die Hafenchronik bekommt eine Zeile.
- **Tiere:** Die Schwanenfamilie (zwei Alte, drei bis vier graue Junge) schwimmt ab Stufe 1 im Frühling und Sommer durchs flache Hafenwasser und weicht Booten aus. Der Schweinswal taucht ab Stufe 3 draußen vor der Einfahrt alle paar Sekunden auf, manchmal mit Kalb. Beide bleiben ein paar Minuten und verschwinden, wenn sie aus dem Bild sind. Sie ändern nichts an den Regeln.
- **Foto:** Im Fotomodus (P) steht vorn in der Leiste ein Knopf. Ist ein Motiv groß genug und nicht am Rand im Bild, wird er gold: „Königsyacht ins Logbuch“ (auf dem Handy kurz „Logbuch“). Sonst heißt er „Zur Königsyacht“ (Handy: „Suchen“) und fliegt die Kamera hin und zoomt heran. Ein Druck blitzt, ein kleines Bild um das Motiv kommt ins Logbuch, das erste Foto jedes Motivs auch in die Chronik. Der Schweinswal muss dabei gerade aufgetaucht sein.
- **Logbuch:** Reiter „Besucher“ mit zwei Gruppen (Seltene Schiffe, Tiere). Fotografierte Motive zeigen das eigene Foto, gesehene das Bild des Modells, alle anderen einen Schattenriss mit Hinweis, wann und wo sie kommen. Antippen öffnet einen Steckbrief (erstes Mal, wie oft, Ehrenplatz, Foto). Neu gesehene tragen „neu“, die Zahl steht am Reiter und im Menü.
- **Erfolge:** „Hoher Besuch“ (ein Besucher lag am Ehrenplatz), „Seltene Gäste“ (alle vier Schiffe waren da), „Tierfreund“ (Schwäne und Schweinswal fotografiert), Pokal „Fotoalbum“ (alle sechs fotografiert).

## Zum Ausprobieren

`?besucher=weltumsegler`, `museumsschiff`, `forschungsschiff`, `koenigsyacht`, `schwaene` oder `schweinswal`, mit `&stufe=N` für die nötige Stufe. Beispiel: `https://hjorven.github.io/hafenmeister/?stufe=5&besucher=koenigsyacht`. Das nächste erwartete Boot wird zum Schiff und läuft gleich ein, ein Tier erscheint sofort.

## Technik

- Zahlen: `economy.seltenerBesuch` (Tabelle in [zahlen.md](zahlen.md)). Texte: `web/js/data/besucher.js`. Modelle: `web/js/data/boats/besucher.js` (Arten L5 und XL4 mit `unlock: 'besucher'`, darum nie im normalen Ankunftswürfel), Grafik `web/js/render/boats/besucher.js` (mit dem XL-Baukasten, hängt sich in `game.boatTypes.l` und `.xl` ein).
- Regeln ohne Browser: `web/js/features/besucher-regeln.js`, eingehängt mit `haengeEin(addHook, addService)` (Hooks `berthHas`, `arrivals`, `evening`). Auch in `tools/balance.mjs`, damit Zeitraffer und Rechnung sie enthalten. Zufall nur aus Seed und Tag (`zufall`), kein Spielzufall.
- Morgens (`arrivals`) wird eines der erwarteten Boote im Ankunftsfenster zum Schiff: Maße und Modell des Besuchers, Wünsche, Nächte, Name, `boat.besucher = art`, `boat.funk = { platz: null }`. Stammgäste, Flottillen, angemeldete Boote, Freunde aus der Gästepost und Havaristen werden nie verwandelt, Geschichte, Tagestörn und Dienste fallen weg.
- Spielstand `state.modules.besucher = { letzter, heute, gesehen, fotos, tiere, neu }` (Fotos als JPEG unter 60 KB je Motiv). `saeubern` räumt geladene Stände auf, darum kein neuer `SAVE_VERSION`.
- Oberfläche: `web/js/features/besucher.js` (eine Zeile in `MODULES`), Meldung `#hm-besucher` im Meldeplatz mit Vorrang `besucher: 58`. Tiere: `web/js/render/besucher-tiere.js`, `game.besucherTiere = { zeige, weg, aktiv, motiv }`.
- Schnittstelle: `game.besucher = { zeige(bootId), heute(), ausloesen(art), motive(), imBild(art), fotografiere(), fortschritt(), meldung() }`. Ereignisse `besucher:neu`, `besucher:foto`, Regel-Ereignis `sim:besucherZuschauer { boatId, art, berthId, geld }`.
- Tests: `tests/besucher.test.mjs` (Häufigkeit, Stufen, Abstand, Winter, Seed, Ehrenplatz, Freihalten, Schaulustige, kein Stammgast, Ausprobieren, Funk, Tiere, Erfolge, Speichern und kaputte Stände).

## Hafentiere (P51)

Hafenkatze, Hafenhund und Graureiher wohnen im Hafen und nutzen Fotoknopf, Logbuch-Reiter (Gruppe „Hafentiere“) und Spielstand dieses Pakets. Beschreibung: [hafentiere.md](hafentiere.md).

## Entscheidungen

- Der Ehrenplatz ist kein neues Gebäude, sondern die Plätze, die es schon gibt (Stegkopf, Kai). So passt er in jedes Stegbild und jede Küste, und die Entscheidung ist echt: den besten Platz für einen Tag freihalten oder belegen.
- Das Büro legt den Besucher automatisch an den Ehrenplatz, wenn er frei ist; freihalten muss der Spieler selbst. Ohne Freihalten ist der Ehrenplatz oft schon belegt (im Test bei gut der Hälfte der Besuche), dann liegt er anderswo.
- Die Schiffe kommen auch ohne Funkgerät im Büro per Funk (es sind besondere Gäste), der Bonus für die frei gehaltene Box ist der normale Funk-Bonus.
- Tiere ohne Regeln und ohne Geld: Sie sind Belebung und Fotomotiv. Gesehen zählt erst, wenn sie wirklich im Bild sind.
- Statt „Forschungsschiff“ (über 60 m) ein Forschungskutter, der an den Stegkopf passt: Große Schiffe liegen in diesem Spiel nur in Stufe 6 an der Pier.
