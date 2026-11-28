# Hafenname und eigene Flagge (Paket P44)

Stand: 22.11.2026. Roadmap F23 (Hafenname und Flagge, sichtbar an Einfahrt und Mast) und F27 (Auswahl beim Start). Audit C05 (Namen nie als HTML).

## Was der Spieler sieht

- **Neues Spiel**: Unter dem Namen steht der Flaggen-Baukasten. Jedes neue Spiel startet mit einer gewürfelten Flagge, die man so lassen, neu würfeln oder selbst bauen kann.
- **Hafenmast** beim Hafenmeisterhaus: weißer Mast mit Goldknauf, oben weht die eigene Flagge. Sie zeigt in Lee und flattert so stark, wie der Wind weht (dieselben Werte wie der Windsack der Wetterflagge, `game.wetterflagge.zeichen()`). Bei Flaute hängt das Tuch durch. Am Fuß steht ein Schild mit kleiner Flagge und dem Hafennamen.
- **Willkommensschild an der Einfahrt**: "Willkommen in" und der Name, daneben ein kleiner Mast mit der Flagge. Es steht am Ufer dort, wo die Boote hereinkommen (siehe "Platz an der Einfahrt"). Beide Seiten sind bemalt: vom Spieler (Blick von Süden) und von einlaufenden Booten aus lesbar.
- **Fenster "Name und Flagge"**: über das Menü (Eintrag "Name und Flagge", Symbol Flagge) oder durch Antippen von Mast oder Schild. Name ändern, Flagge bauen, "Übernehmen". Der Knopf ist aus, solange nichts geändert ist. Am PC zeigt der Mauszeiger über Mast und Schild "Hafenflagge: anklicken für Name und Flagge".
- Umbenennen im Fenster "Spielstände" wirkt genauso: Schild und Fenstertitel zeigen sofort den neuen Namen.

## Flaggen-Baukasten

Pixelbild 24 x 16 (3:2), wie die übrige Pixel-Oberfläche.

| Teil | Auswahl |
|---|---|
| Muster (10) | Einfarbig, Zwei Streifen, Drei Streifen, Drei Bahnen, Nordisches Kreuz, Schräg geteilt, Geviertelt, Keil am Mast, Mit Rand, Stander (dreieckig) |
| Farben (11) | Weiß, Rot, Blau, Marineblau, Himmelblau, Gelb, Grün, Türkis, Orange, Bordeaux, Schwarz; je Feld des Musters eine (1 bis 3 Reiter) |
| Zeichen (10) | Ohne, Anker, Stern, Möwe, Fisch, Krone, Welle, Kompass, Herz, Leuchtturm |
| Zeichenfarbe | eine der 11 Farben; ohne eigene Wahl passt sie sich an (hebt sich vom Feld darunter ab) |

"Würfeln" baut eine stimmige Flagge (helle und dunkle Farbe im Wechsel, 60 % mit Zeichen).

## Speichern

- `game.state.flagge = { muster, farben: [3 IDs], zeichen, zeichenFarbe }`, nur IDs aus `web/js/data/hafenflagge.js`.
- Spielstand-Version 4 (`save/storage.js`): ältere Häfen bekommen beim Laden die Flagge zu ihrem Seed (`flaggeAusSeed(seed)`). So hat jeder alte Hafen eine eigene, immer dieselbe Flagge.
- `state.js` prüft beim Laden (`flaggeSauber`): unbekannte Muster, Farben oder Zeichen fallen auf die Flagge zum Seed zurück, ein kaputtes Feld bricht das Laden nicht ab.
- Der Name steht wie bisher im Verzeichnis der Speicherplätze und als `harborName` im Stand (docs/speichern.md).

## Sicherheit (Audit C05)

- Hafennamen sind Spielereingabe und reisen in Dateien mit. `hafenNameSauber()` (data/hafenflagge.js) gilt überall: Speicherplätze (`plaetze.nameSauber`), Laden (`state.js`), Verzeichnis beim Lesen, Fenster.
- Erlaubt sind Buchstaben (auch mit Akzenten, Unicode-Form NFC), Ziffern, Leerzeichen und `. , - ' ’ & ( ) ! ? / : + #`. Alles andere fällt weg: spitze Klammern, Anführungszeichen, Steuerzeichen, Richtungsumschalter (U+202E), unsichtbare Zeichen, Emoji. Leerraum wird zusammengefasst.
- Höchstens 32 Zeichen, gezählt nach Zeichen (nicht nach UTF-16-Einheiten): ein Zeichen wird nie halbiert.
- Gezeigt wird der Name nur über `textContent`, Text-Knoten oder Canvas `fillText`, nie über `innerHTML`.
- Flaggen-IDs werden über `Map` nachgeschlagen, damit `__proto__` oder `constructor` aus einem präparierten Stand nicht als gültig gelten.
- Test: `tests/hafenflagge.test.mjs` (18 präparierte Namen, präparierte Flaggen, Umbau alter Stände), Browser: `tests/specs/hafenflagge.spec.mjs`.

## Platz an der Einfahrt

`features/hafenflagge.js`, `einfahrtLage()`:

1. Ab Stufe 3 mit Molen: Land neben den Molenköpfen (`landschaft.punkte.molenkoepfe`).
2. Sonst entlang der Seezugänge (`game.gelaende.seezugaenge`, ohne Umwege), innerhalb des Kamerabereichs (`spielRect`): der Punkt, an dem der Weg dem Land am nächsten kommt (Seegatt, Engstelle), bei Gleichstand der nähere am Hafen.
3. Dort im Umkreis bis 48 m ein Platz an Land: eben, höchstens 20 m vom Wasser, nicht im Wald, nicht auf Wegen oder dem Laufnetz der Menschen (Molenwege), nicht auf Kai- und Bauflächen.

Findet sich nichts, fehlt das Schild (lieber kein Schild als eines im Wasser, am Hang oder im Wald). Prüflauf 22.11. über 15 Küsten und Stufen 1, 3, 5 (Seed 3): Mast überall, Schild in 41 von 45 Fällen; ohne Schild blieben Steilküste und Förde Stufe 1, Förde Stufe 3 und Küste 14 Stufe 3, wo die Einfahrt im Wald liegt. Rückfall ohne Engstelle (Watt): nächstes passendes Land am Ende der Seezugänge. Neu gesucht wird nach jeder Stufe und jedem Neubau der Landschaft.

Der Hafenmast nutzt die Platzsuche der Deko (`game.zielDeko.zusatz`, features/ziel-deko.js): nie auf Wegen, in Gebäuden, auf Bauplätzen oder im Wasser.

## Schnittstellen

| Was | Wo |
|---|---|
| `game.hafenflagge.oeffnen()`, `schliessen()`, `offen()` | ui/hafenflagge.js |
| `game.spielstand.umbenennen(name)` gibt den gespeicherten Namen zurück | save/index.js |
| `game.spielstand.flaggeSetzen(flagge)` | save/index.js |
| Ereignisse `'spielstand-name'` (name), `'hafenflagge'` (flagge) | |
| `game.hafenflaggeBild = { mast, einfahrt, neuMalen(), sucheEinfahrt(), einfahrtLage() }` | features/hafenflagge.js |
| `flaggenBaukasten({ flagge, beiAenderung })`, `namensFeld()`, `flaggenCanvas()` | ui/hafenflagge.js |
| `hafenNameSauber`, `flaggeSauber`, `flaggeAusSeed`, `flaggenPixel`, `flaggeZeichnen` | data/hafenflagge.js |

## Für später

- Online (P58): Name und Flagge sind schon reine Daten aus festen IDs, sie lassen sich ohne Prüfung von freiem Text oder Bildern übertragen.
- Fotoaufträge und Postkarte (P43) können `flaggeZeichnen` für einen Stempel nutzen.
- Ausbau Stufe 7 bis 20: Namen je Standort laufen durch `hafenNameSauber`.
