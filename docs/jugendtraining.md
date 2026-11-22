# Jugendtraining am Segelclub

Stand: 22.11.2026. Status: gepflegt. Roadmap-Paket P39 (Funktion F13: "Jugendtraining: Opti-Gruppe mit Trainerboot, braucht Slip und Segelclub").

## Was der Spieler erlebt

Steht ein Segelclub und eine Slipanlage, trainiert die Jugend des Vereins an festen Tagen: jeden 4. Saisontag ab dem 3. (Saisontag 3, 7, 11, 15, 19, 23, 27).

1. **Morgens** meldet sich der Club im Meldeplatz: "Heute Jugendtraining. 6 Optis und 2 Jollen segeln am Vormittag aus dem Hafen. Das Trainerboot braucht für den Tag eine Box." Passende freie Boxen leuchten gold. Der Spieler tippt den Vorschlag (die knappste passende Box, damit große Boxen für Gäste bleiben), "Andere" oder eine leuchtende Box im Hafen an. "Absagen" kostet nichts. Ein blauer Balken zeigt, wie viel Zeit bis zum Auslaufen bleibt.
2. **Box gegeben:** Das Trainerboot (Festrumpf-Schlauchboot) kommt vom Slip und legt in der Box an. Die Box ist für den Tag reserviert, kein Gast fährt hinein. Mit "Immer diese Box" merkt sich der Hafen die Box: An den nächsten Trainingstagen liegt das Trainerboot von selbst dort, wenn sie frei ist, und die Meldung sagt das nur kurz ("Andere Box", "Absagen" bleiben möglich). Ist die feste Box belegt, kommt wieder die Frage.
3. **Auslaufen** (ein Viertel des Tages): Kurz vorher legt das Trainerboot ab und wartet neben dem Slip. Die Kinder rollen ihre Boote nacheinander über den Slip ins Wasser, die Gruppe sammelt sich, und dann segeln alle in einer Reihe hinaus, das Trainerboot seitlich hinter der Reihe.
4. **Freies Fahrwasser:** Solange die Gruppe zwischen Slip und Trainingsrevier unterwegs ist, fahren wartende Boote nicht von selbst ein. Sie warten geduldig an der Boje (ihre Geduld steht still). Von Hand zuweisen geht weiter; fahrende Boote weichen der Gruppe aus, und steht ein fahrendes Boot vor einem Opti, wartet die Reihe kurz.
5. **Training:** Im Revier vor den Stegen liegen drei gelbe Regattabojen. Die Gruppe segelt einen Dreieckskurs: gegen den Wind kreuzend zur Luvboje, dann raumschots und vor dem Wind zurück. Die Segel stehen nach dem Wind des Tages, die Boote krängen leicht. Das Trainerboot kreist in der Mitte.
6. **Zurück:** Die Reihe segelt zurück zum Slip, die Boote gehen an Land, Eltern kommen zum Segelclub. Der Verein zahlt für die Box (Tagesabschluss: Services, Segelclub), und jeder Gast, der dann im Hafen liegt, hat zugesehen: Bei seiner Abreise bewertet er +0,2 Anker ("Jugendtraining zugesehen" im Gästebuch). Das Trainerboot legt wieder in seiner Box an und fährt abends zum Slip und an Land.

Bei Sturm, Starkwind (Optis segeln nicht bei viel Wind) oder Regatta fällt das Training aus; bei Sturm und Wind sagt die Meldung das morgens kurz, am Regattatag segelt der Club ohnehin. Bekommt das Trainerboot bis zum Auslaufen keine Box, fällt das Training aus, ohne Abzug.

| Ausbau Segelclub | Gruppe | Beitrag |
|---|---|---|
| Segelclub | 5 Optis | 15 € |
| Segelschule | 6 Optis, 2 Jollen | 25 € |
| Regattaverein | 8 Optis, 3 Jollen | 40 € |

Zahlen: `ECONOMY.jugendtraining` in `web/js/data/economy.js`, Tabelle in [zahlen.md](zahlen.md). Das Bauen-Menü nennt beim Segelclub: "mit Slipanlage segelt jeden 4. Tag die Jugend mit 5 Booten aus dem Hafen" (Zahl `wirkung.jugend` je Ausbau, gleich Optis plus Jollen).

## Entscheidungen

- **Slip statt Jollensteg:** Die Roadmap sagt "braucht Slip und Segelclub". So ist es auch gebaut: Der Segelclub steht im Testhafen gut 30 m vom Wasser hinter der Kaimauer. Die Kinder rollen ihre Boote auf Slipwagen über die Slipanlage ins Wasser (wie die Trailerboote). Warten dort Trailerboote, wartet die Gruppe.
- **Optis auf der Wiese entfernt:** Das Modell des Segelclubs ließ ab der Segelschule sechs Optis und ein Trainerboot im Kreis fahren, in vielen Häfen über die Wiese. Sie sind weg; die Optis segeln jetzt wirklich (Jugendtraining). Der Jollensteg des Modells steht nur noch, wenn das Wasser höchstens 14 m vor dem Haus ist.
- **Trainingsrevier vor den Stegen statt weit draußen:** Erst lag das Revier vor der Einfahrt. Im Testhafen Stufe 3 waren das gut 1 km Weg, das passte nicht in einen Tag. Jetzt sucht das Bild freies Wasser auf dem Weg vom Slip zur Einfahrt (rund 160 m vom Slip, gern etwas neben dem Fahrwasser), mit Abstand zu Stegen, Wartebojen, Ankerfeld, den Seezugängen und den Wegen der Gäste von der Einfahrt zu den Stegen. Gibt es dort keinen Platz, dann draußen vor der Einfahrt, zuletzt das nächste freie Wasser.
- **Tempo nach dem Tag:** Die Gruppe segelt mindestens 2,6 m/s (Jollen 3), und so viel schneller (bis 4,5 m/s), dass alle bis 0,82 des Tages wieder am Slip sind.
- **Geduld steht still:** Wer wegen der Gruppe an der Boje warten muss, verliert keine Geduld. Sonst hätte das Training Gäste gekostet, die der Spieler nicht wegschicken wollte.
- **Kein Zufall:** Trainingstage stehen fest; die Regeln verbrauchen keinen Spielzufall (Zeitraffer und Rechnung bleiben gleich).
- **Ohne Spieler kein Training:** Ohne Box fällt es aus. Balancing-Bot und Zeitraffer geben keine Box (wie beim Hafenfest).

## Technik

| Datei | Inhalt |
|---|---|
| `web/js/features/jugendtraining.js` | Regeln ohne Browser (Hooks tick, evening, fit, stageUp), `game.jugendtraining`, eine MODULES-Zeile |
| `web/js/render/jugend-bild.js` | Bild: Slip, Revier, Kurs, Reihe, Trainerboot (boat-anim), Halten der Wartenden, `game.jugendBild` |
| `web/js/ui/jugend-meldung.js` | Meldung `#hm-jugend` im Meldeplatz, Vorrang 58 (`VORRANG.jugend`) |
| `web/js/sim.js` | nur `ratingParts(...).jugend` (Anker, wenn `boat.jugend`) |
| `tests/jugendtraining.test.mjs` | Regeln; `tests/specs/jugendtraining.spec.mjs` im Browser |

Spielstand: `state.modules.jugend = { stammbox, trainings, ausgefallen, heute: { tag, phase, platz, auto, grund, gruppe, seit } }`. Phasen: `angekuendigt` (Box fehlt), `bereit` (Box frei gehalten), `draussen`, `zurueck`, `ausgefallen` (`grund`: `wind`, `sturm`, `regatta`, `keineBox`, `abgesagt`). Ereignis der Regeln `sim:jugend` mit `phase`.

Mit Bild melden `jugend-bild.js` das Auslaufen (erstes Boot im Wasser) und das Zurückkommen (letztes Boot an Land). Bleibt das Bild hängen, greifen die Regeln: Auslaufen spätestens 0,12 Tag nach Beginn, zurück spätestens `notfall` (0,65 Tag) nach Beginn, sonst am Abend.

Ausprobieren: `?stufe=3&services=alle&jugend=jetzt` (Training sofort, Beginn nach wenigen Sekunden). In der Konsole: `hafenmeister.jugendtraining.ausloesen({ beginnIn: 55 })`, `hafenmeister.jugendBild.zustand()`, `.revier()`, `.trainer()`, `.probe()`.

## Zusammenspiel und mögliche Kollisionen

- **Andere reservierte Boxen** (Funk-Anmeldung, Havarist, Regatta, Dauerlieger auf Törn): Die Trainerbox nimmt nur Boxen, die `hookWhyNotFit` für das Trainerboot frei lässt, und sperrt ihre Box über denselben Hook `fit`. Gäste fahren nie hinein (geprüft in 5 Seeds über je 100 Tage).
- **Einstieg und Ziehen:** Die Gruppe hält nur Boote, die nicht schon jemand hält (`b.held`), und gibt nur ihre eigenen frei. Das gewählte Boot gibt sie nicht frei.
- **Ausweichen (P88):** Jedes Opti und jede Jolle ist für den Verkehr ein Hindernis (`game.boatAnim.hindernis`). Einzelne große Segler fuhren in frühen Läufen trotzdem durch die Reihe; deshalb wartet die Reihe, wenn ein fahrendes Boot vor einem ihrer Boote steht (höchstens 15 s). Größere Änderungen am Ausweichen gehören dem Thread "Staus an Bojen".
- **Trailerboote der Slipanlage** teilen sich die Rampe mit der Gruppe; die Gruppe wartet.
- **Tagesabschluss:** Beitrag unter Services mit Detail `segelclub`.
- **Logbuch:** eine Zeile "Jugendtraining: ... waren draußen". Das Trainerboot zählt nicht als Gast und nicht im Logbuch.
- **Hafenfest:** Am eigenen Festtag wird normal trainiert (es ist kein Regattatag).
