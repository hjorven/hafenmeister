# Meldungs-Ordnung

Im Bild steht höchstens **eine** schwebende Meldung zugleich. Wichtigere Meldungen gehen vor. Die anderen
warten ausgeblendet, ihre Zeit läuft solange nicht ab, und sie kommen danach. Die Regeln stehen in
`web/js/ui/meldungen.js`, die Prüfungen in `tests/meldungen.test.mjs` und `tests/specs/meldungen.spec.mjs`.

## Vorrang (höher geht vor)

| Vorrang | Meldung | Modul |
|---|---|---|
| 100 | Feier beim Aufstieg (`#hm-feier`) | `features/aufstieg.js`, zählt von selbst, solange sichtbar |
| 90 | Kartenwahl der Tagesziele (`.tz-wahl`) | `features/tagesziele.js`, zählt von selbst |
| 80 | Karte des Tagesabschlusses (`#hm-tagesabschluss`) | `ui/tagesabschluss.js`, zählt von selbst |
| 75 | Winterpause am ersten Wintertag und Gruß zum Saisonbeginn (`#hm-winter`) | `features/winter.js` |
| 70 | Morgen-Zettel (`#hm-ta-zettel`) | `ui/tagesabschluss.js` |
| 65 | Dauerlieger früher zurück (hat eine Frist bis zum Abend) | `features/dauerlieger.js` |
| 57 | Anmeldung per Funk: Box freihalten? (`#hm-funk-anmeldung`) | `ui/funk-anmeldung.js` |
| 60 | Sturm und Regatta vorbereiten (`#ev-vorbereiten`), Ergebnis am Abend des letzten Ereignistags | `events/vorbereiten-ui.js` |
| 50 | Schritte des Einstiegs | `features/einstieg.js` |
| 45 | Tipps beim ersten Mal | `features/einstieg.js` |
| 40 | Andere Dauerplatz-Meldungen | `features/dauerlieger.js` |
| 20 | Bewertung eines Boots außerhalb des Bildes (`#hm-gb-meldungen`, die Blasen über Booten im Bild zählen nicht) | `ui/gaestebuch.js` |

Bei gleichem Vorrang bleibt, wer zuerst da war.

## Eine neue Meldung anschließen

```js
import { VORRANG } from '../ui/meldungen.js';
game.meldungen?.wunsch('meine-id', VORRANG.dauer);   // Meldung möchte stehen
game.meldungen?.darf('meine-id');                    // im eigenen Takt fragen: sichtbar oder zurück
game.meldungen?.fertig('meine-id');                  // Meldung ist weg
game.on('meldungen:wechsel', () => { /* sofort neu fragen */ });
```

Wo die Meldung steht, entscheidet ihr Modul selbst: nie über Knöpfen (Zeit, Kassieren, Bauen, oben rechts)
und nie über der linken Spalte (Wetter, Tagesziel, Ausbau). Ein neuer Vorrang kommt in `VORRANG` und in diese Tabelle.

Fenster aus `FENSTER` (Feier, Kartenwahl, Tagesabschluss) blendet die Ordnung selbst aus, solange ein
wichtigeres steht: `body` trägt dafür `data-hm-meldung` mit der stehenden Meldung, das CSS kommt aus
`ui/meldungen.js`. So wartet eine offene Kartenwahl unsichtbar hinter der Feier und kommt danach wieder.
Bewertungsblasen und Gästebuch-Meldungen (`ui/gaestebuch.js`) sind während der Feier aus, ihre Zeit steht.

Passt eine Meldung nirgends hin, ohne Knöpfe zu verdecken (Handy hochkant mit aufgeklappter
Tagesziel-Tafel), wartet sie ausgeblendet, bis Platz ist. Nur ein Schritt des Einstiegs und ein wartender
Dauerlieger mit Frist legen sich dann über die linke Spalte, nie über Zeit, Kassieren oder Bauen.
