# Signalflaggen und Hafenwissen (P49)

Stand: 22.11.2026. Status: gebaut. Roadmap F33 (Signalflaggen als Wunschanzeige, Lexikon im Logbuch) und F34 (Hafenwissen zum Sammeln), Paket P49. Tests: `tests/signalflaggen.test.mjs`, `tests/specs/signalflaggen.spec.mjs`.

## Was der Spieler sieht

**Signalflaggen an den Booten.** Jeder Gast setzt für jeden Wunsch eine echte Buchstabenflagge des Internationalen Signalbuchs, untereinander an einer kleinen Rah an Steuerbord (Segelboote unter der Saling auf halber Masthöhe, Motorboote am Radarmast, kleine Boote an einem Flaggenstock). Die Flaggen wehen mit dem Tageswind nach Lee.

| Zustand | Was weht |
|---|---|
| Anfahren und Warten an Boje oder Anker | eine Flagge je Wunsch (höchstens drei) |
| In der Box | nur, was noch fehlt; erfüllte Wünsche holt die Crew ein (die Flagge gleitet die Leine hinab) |
| Gerade gebaut | Platz- und Angebotswünsche (Strom, Wasserhahn, Café ...) kommen sofort herunter, Versorgung (WC, Dusche, WLAN ...) sobald sie für alle liegenden Gäste mit diesem Wunsch reicht |
| Vor dem Auslaufen | nur der Blaue Peter (P), bis das Boot abgelegt hat; Kurzhalter setzen ihn kurz vor dem Ablegen |
| Nach Sonnenuntergang | alle Flaggen unten (Flaggenparade), morgens gehen sie wieder hoch |
| Dauerlieger, Fischer, Behörden | keine |

So sieht man auf einen Blick, wer im Hafen was vermisst, und welche Boxen morgen frei werden.

**Hafen-Code.** Jeder Wunsch hat genau eine Flagge, mit Merkhilfe. Wo es passt, stimmt die echte Bedeutung:

| Flagge | Wunsch | Merkhilfe |
|---|---|---|
| W Whiskey | WC | W wie WC |
| D Delta | Dusche | D wie Dusche |
| E Echo | Essen | E wie Essen |
| Q Quebec | Frischwasser | Q wie Quelle |
| S Sierra | Strom | S wie Strom |
| K Kilo | WLAN | echt: "Ich möchte Verbindung aufnehmen" |
| B Bravo | Diesel | echt: Treibstoff an Bord |
| L Lima | Waschmaschine | L wie Leine |
| T Tango | Absaugstation | T wie Tank |
| R Romeo | Ehrenplatz | R wie roter Teppich |
| O Oscar | Brötchen | O wie ofenfrisch |
| C Charlie | Café | C wie Café |
| G Golf | Grillplatz | G wie Grill |
| F Foxtrot | Räucherfisch | F wie Fisch |
| J Juliett | Segelclub | J wie Jollen |
| Z Zulu | Fahrräder | Z wie Zweirad |
| A Alfa | Ausrüster | A wie Ausrüster |
| M Mike | Mastenkran | M wie Mast |
| I India | Eis | I wie "Ich will Eis" |
| V Victor | Werft | echt: "Ich benötige Hilfe" |
| Y Yankee | Segelmacher | Y wie Yachtsegel |
| H Hotel | Hafenrundfahrt | H wie Hafenrundfahrt |
| P Papa | (Auslaufen) | echt: der Blaue Peter |

**Karte eines wartenden Boots.** Neben jedem Wunsch steht seine Flagge, so lernt man den Code nebenbei.

**Positionslichter.** Boote, die in der Dämmerung oder nachts fahren, zeigen Rot an Backbord, Grün an Steuerbord, ein weißes Hecklicht und (Motorboote) ein weißes Topplicht. Das Ankerlicht an der Boje gab es schon.

**Hafenwissen (Logbuch, Reiter "Wissen").** 36 Einträge in vier Gruppen, gesammelt, sobald es im eigenen Hafen vorkommt. Fehlende stehen als Schattenriss mit Hinweis darin.

| Gruppe | Einträge und wann sie dazukommen |
|---|---|
| Signalflaggen (23) | sobald ein Gast die Flagge zum ersten Mal setzt; fehlende zeigen "ab Stufe N" |
| Seezeichen und Bojen | Warteboje (erstes Boot an der Boje), Pricke (an Küsten mit flacher Rinne, Stufe 1 und 2, rund 5 von 15 Küstentypen), Muringboje (erstes Boot im Bojenfeld), Regattatonne (Regatta läuft) |
| Feuer und Lichter | Molenfeuer (nachts, ab Stufe 3), Leuchtfeuer (nachts an Küsten mit Leuchtturm), Ankerlicht (nachts, Boot an einer Boje), Positionslichter (Boot fährt in der Dämmerung) |
| Knoten | Klampenschlag (erstes Boot in einer Box), Palstek (Muringboje), Webeleinstek (Päckchen), Achtknoten (Jugendtraining), Rundtörn mit zwei halben Schlägen (Havarist an der Schleppleine) |

Antippen öffnet den Eintrag: bei Flaggen die Bedeutung im Hafen, Merkhilfe und die echte Bedeutung im Signalbuch, sonst ein, zwei Sätze, was es ist. Pfeile blättern durch die gesammelten Einträge der Gruppe.

**Meldung "Neu im Hafenwissen".** Im Meldeplatz, Vorrang 21 (nach dem Logbuch), mehrere zugleich werden zusammengefasst; antippen öffnet den Eintrag. Neue Seezeichen, Lichter und Knoten stehen außerdem in der Chronik des Tages.

## Technik

| Datei | Inhalt |
|---|---|
| `web/js/data/signalflaggen.js` | Flaggen als Raster 15 x 10 (`flaggenRaster`, `flaggenSvg`), Signalbuch, `WUNSCH_FLAGGE`, `flaggeFuer(wunsch)` |
| `web/js/data/hafenwissen.js` | Einträge mit 16-x-16-Bildern, `wissenState`, `sammeln`, `gesammelt`, `fortschritt` (ohne Browser) |
| `web/js/render/signalflaggen.js` | Flaggen und Positionslichter an den Booten, `game.signalflaggen = { flaggen(id), soll(id), lichter(id), anzahl(), masse(id) }`, Ereignis `signalflagge:gesetzt` |
| `web/js/features/hafenwissen.js` | Erkennen, Reiter "Wissen", Meldung, `game.hafenwissen = { sammeln(id), gesammelt(id), fortschritt(), oeffnen(id?), flaggeBild(wunsch) }` |
| `web/js/sim.js` | `checkWishes` merkt sich `boat.erfuellt` (was beim letzten Prüfen erfüllt war) |
| `web/js/ui/hud.js` | Flagge vor jedem Wunsch in der Bootskarte |

- Spielstand: `state.modules.hafenwissen = { gesehen: { id: { tag, stufe } }, neu: [id] }`. Beim Lesen gesäubert (nur bekannte IDs). Alte Spielstände laden ohne Migration, das Wissen beginnt dann leer. `boat.erfuellt` fehlt in alten Ständen; bis zum nächsten Morgen zählt dann nur die Prüfung "jetzt".
- Zeichenaufwand: Aus großer Höhe (Bildbreite über 220 m) werden die Flaggen nicht gezeichnet; man könnte sie dort ohnehin nicht erkennen.
- Keine Zahlen in `economy.js`: Das Paket ändert keine Regeln, kein Geld, keinen Ruf.

## Entscheidungen (ohne Rückfrage, 22.11.2026)

- **Echte Flaggen, eigener Code.** Wunschanzeigen gibt es im echten Hafen nicht. Die Flaggen sind echt, die Zuordnung ist ein Hafen-Code mit Merkhilfe; das Lexikon nennt beide Bedeutungen. Nur P (Blauer Peter) bedeutet im Spiel dasselbe wie in echt.
- **Fehlendes statt Gewünschtes in der Box.** Eine Flagge für etwas, das der Gast schon hat, sagt dem Spieler nichts. Darum holt die Crew erfüllte ein, und die Flaggen zeigen, was gebaut werden sollte.
- **Flaggenparade.** Wie im echten Hafen kommen die Flaggen bei Sonnenuntergang herunter; nachts sind die Lichter dran.
- **Keine Fahrwassertonnen nachgebaut.** Rote und grüne Tonnen gibt es im Spiel nicht; ein Eintrag dafür würde nichts zeigen. Die Seezeichen-Gruppe nimmt, was es gibt (Warteboje, Pricke, Muringboje, Regattatonne). Tonnen entlang der Fahrrinne wären ein eigenes Paket (Fahrwasser, Ausweichen).
- **Kein Erfolg.** Ein Erfolg "alles gesammelt" würde die Erreichbarkeitsprüfung der Erfolge (Spiel ohne Oberfläche) brechen, weil das Hafenwissen im Bild erkannt wird. Kann P22 später nachziehen.

## Wo es mit anderen kollidieren kann

- **P48 Leinen annehmen:** Klampenschlag wird beim Festmachen gesammelt (`sim:moored`), unabhängig davon, wer die Leine nimmt. Keine gemeinsamen Dateien.
- **P44 Hafenflagge:** eigene Flagge am Hafenmast, keine Berührung. Gefunden beim Zusammenführen: `hafenflagge.spec.mjs` zählte alle `img` der Seite; die Meldung "Neu im Hafenwissen" bringt ein data:-Bild mit, das kommt und geht. Der Test zählt jetzt nur Skripte und Bilder ohne data:-Adresse. Der Treuewimpel (P25) hängt am Heck, die Signalflaggen mittschiffs an Steuerbord.
- **Logbuch:** sechster Reiter "Wissen"; am Handy hochkant brechen die Reiter in zwei Zeilen um (wie vorher bei fünf). P43 (Fotoaufträge) bringt eventuell einen weiteren Reiter.
- **Meldeplatz:** neuer Vorrang `wissen: 21` in `ui/meldungen.js`.
- **Wünsche:** Ein neuer Wunsch braucht eine Flagge in `WUNSCH_FLAGGE`, sonst zeigt das Boot für ihn keine; der Test prüft das.
- **Höhe der Modelle:** Andere Module messen die Höhe eines Boots mit `Box3.setFromObject` (Raute, Ankerlicht). Die Rah liegt höchstens 0,15 m über dem Radarmast, bei kleinen Booten auf 1,5 m über Deck; die Mindesthöhe der Raute (2,4 m) liegt darüber.
