# Zusammenspiel nach Welle 0 (P85)

Jorvens Auftrag vom 14.11.2026: Prüfen, ob alles im Zusammenspiel funktioniert, ob alle Features noch da sind, ob neue Features im Spiel wirklich genutzt werden, ob alles aus Welle 1 wirklich gefixt ist und ob etwas übersehen wurde. Drei Threads, je Bereich ein Abschnitt in dieser Datei ([Arbeitsplan Abschnitt 3a](arbeitsplan.md)).

## Oberfläche und Geräte (Zusammenspiel 2)

Stand 20.11.2026, Thread "Zusammenspiel prüfen: Oberfläche und Geräte". Geprüft auf `main` nach PR 345, im laufenden Spiel (`?stufe=3&seed=7`, Ostsee, Tag 1) auf fünf Geräten: iPhone 13 hochkant (390 x 664) und quer (750 x 342), Galaxy Tab S4 hochkant (712 x 1138) und quer, PC 1440 x 900.

### Wie geprüft wurde

| Prüfung | Werkzeug | Umfang |
|---|---|---|
| Jede Taste drücken, bis drei Ebenen tief (Taste, was sie öffnet, was darin steht), je Weg ein Bild | `node tools/zusammenspiel/oberflaeche.cjs <ordner> <gerät>` | Handy hoch 86 Wege, Handy quer 86, Tablet hoch 81, PC 70. Gleichartige Tasten (Listenzeilen, Bauplätze) zweimal je Art. Gesperrt: alles, was den Spielstand löscht oder die Seite verlässt |
| Bei jedem Weg: Taste verdeckt (3 von 5 Punkten unter etwas anderem), ragt aus dem Bild, am Touchgerät kleiner als 40 px, Schrift nicht Pixelify Sans, Text unter 11 px | dasselbe Werkzeug, `bericht.json` | alle sichtbaren Tasten und Texte |
| Jede Taste aus der PC-Tastenhilfe (`?`) einmal drücken und prüfen, ob passiert, was dort steht | `node tools/zusammenspiel/tasten.cjs` | 40 Tasten |
| Verdeckte Spielfläche je Gerät und Lage | `node tools/zusammenspiel/bilder.cjs <ordner>` (Raster aus `tools/verdeckung/`) | 7 Lagen x 5 Geräte, Bilder in doppelter Auflösung |
| Texte in Hilfe, Einstieg, Bauen-Rat und Tastenhilfe gegen den Code | von Hand | alle Sätze, die eine Taste, ein Tempo oder eine Regel versprechen |

Server für alle Werkzeuge: `bash tools/build-pages.sh && (cd tests && node server.mjs 4180)`.

### Ergebnis

- **Schrift:** Kein einziger sichtbarer Text auf keinem Gerät ist nicht Pixelify Sans, auch nicht Ziffern und Euro. Keine Texte unter 11 px (nur unsichtbare Vorlesetexte mit 0 px).
- **PC-Tasten:** Alle 40 Tasten der Tastenhilfe wirken wie beschrieben (F, G, Leertaste, B, N, J, T, M, P, L, ?, F1, Esc, Q, E, R, V, Bild auf/ab, +, -, W A S D, Pfeile, 0, Pos1, 1 bis 9, Tab, Enter). W und Pfeil links bewegen am Kartenrand nichts, weil die Kamera dort schon an der Grenze steht; das ist gewollt.
- **Verdeckt:** Wichtige Tasten werden nur von Tafeln verdeckt, die der Spieler selbst geöffnet hat und die ein Schließen-Kreuz haben (Logbuch, Gästebuch, Hilfe, Einstellungen, Statistik). Keine schwebende Meldung liegt über Zeit, Bauen, Geld oder Menü.
- **Kein Text zu etwas, das es nicht gibt:** Zwei Sätze in der Hilfe stimmten nicht mehr (Funde 1 und 2), sonst passt jeder geprüfte Satz zu dem, was im Spiel passiert.
- **Alle Oberflächen-Features noch da:** Meldeplatz, Einstieg (6 Schritte), Hilfe, Einstellungen (5 Schalter), Tempo (Pause, 1x, 3x, 8x), Bauen mit Reitern, Vorschau, Bestätigung und Rückgängig, Logbuch mit Booten, Chronik, Erfolgen, Geschichten, Gästebuch über den Ruf, Fotomodus mit "Bild sichern" und "Rundflug", Ton-Fenster mit vier Reglern, Spielstand, Statistik, Tagesabschluss mit Blättern, Tagesziele mit drei Karten, Stufenziel mit "Im Baumenü ansehen", Wetter mit Vorhersage. Jedes öffnet sich auf jedem Gerät und lässt sich wieder schließen.
- **Offline-Start:** abgedeckt durch die bestehenden Tests `tests/offline.test.mjs` und `tests/specs/offline.spec.mjs` (laufen in `bash tests/pruefen.sh`).

### Funde und was damit passiert ist

| Nr | Fund | Gerät | Behoben |
|---|---|---|---|
| 1 | Hilfe "Zeit": "Kommt ein Boot an die Boje, schaltet 8x von selbst zurück." Seit Jorvens Entscheidung vom 14.11. bremst nichts mehr automatisch | alle | Text sagt jetzt: Das Tempo bleibt, bis du selbst ein anderes wählst; nur Bauen und Spielstand halten die Zeit kurz an. Am PC zusätzlich G für 8x und die Leertaste (`features/hilfe.js`) |
| 2 | Hilfe "Tagesziele": "Links stehen drei kleine Ziele, die etwas Geld bringen". Tatsächlich wählt man eins von drei, und die Belohnung ist Geld, Bau-Gutschein, Deko oder Ruf | alle | Text an das Spiel angepasst |
| 3 | Logbuch: Die vier Reiter (Boote, Chronik, Erfolge, Geschichten) passen hochkant nicht in eine Zeile; der vierte war halb unter dem Schließen-Kreuz, ohne Hinweis, dass man seitlich schieben kann | Handy hoch | Reiter brechen hochkant in eine zweite Zeile um (`css/logbuch.css`) |
| 4 | Baumenü am Tablet hochkant fast bildschirmhoch (bis 927 von 1138 px): Bauplätze und Preisschilder waren nicht zu sehen | Tablet hoch | höchstens halbe Bildhöhe wie am Handy; Hafen und Schilder bleiben darüber sichtbar (`css/oberflaeche.css`) |
| 5 | Ruf (öffnet das Gästebuch) nur 25 px hoch | Handy, Tablet | Trefferfläche reicht am Touchgerät über das ganze Statusschild (`css/gaestebuch.css`) |
| 6 | Bauplätze als Punkt (wenn für ein Schild kein Platz ist) nur 22 x 22 px | Handy, Tablet | sieht gleich aus, nimmt den Finger aber auf 40 px an (`css/oberflaeche.css`, `ui/bauen.js`) |
| 7 | Tagesabschluss: Blättern-Pfeile 34 x 34 px | Handy hoch und quer, Tablet 36 px | 40 x 40 (`css/tagesabschluss.css`) |
| 8 | Einstellungen "Boote fahren selbst ein": Normal, Langsam, Nie 36 px hoch | Handy | 40 px (`css/oberflaeche.css`) |
| 9 | Baumenü: Reiter 38 px, "Rückgängig (10 s)" 32 px, Zeilen quer 36 px | Handy, Tablet, quer | Reiter 40, Rückgängig 40 (man hat nur 10 s), Zeilen quer 40 (`ui/bauen.js`, `css/ui-phone.css`) |
| 10 | Statistik am ersten Tag: zwei große leere gelbe Kästen ohne Erklärung | alle | Ein Satz, bis die ersten Boote zahlen (`ui/statistik.js`) |
| 11 | Tagesziel-Karten trennen kurze Wörter ("Wunsch Es-sen") | Handy | Silbentrennung erst ab Wörtern mit 8 Buchstaben (`features/tagesziele.js`) |
| 12 | Doku `ui/oberflaeche.md`: Menü-Liste ohne Tagesabschluss, Statistik, Hilfe, Einstellungen, Gästebuch, Logbuch; Tastenliste ohne G, K, N, J, T, R, V; Satz "Ziffern bleiben in der Systemschrift" (seit PR 282 falsch) | Doku | nachgezogen |

Bewusst so gelassen (kein Fund):

- Reiter im Baumenü quer 36 px und Knöpfe im Einstiegs-Tipp quer 36 px: Am Handy quer sind nur 342 px Höhe; 40 px würden die Liste um eine Zeile kürzen. Beide sind breit genug (über 60 px), der Finger trifft sie.
- Säulen der Statistik und Zeilen der Tagesabschluss-Chronik (22 bis 29 px hoch): Listen, die über die ganze Breite gehen; man tippt sie nur zum Nachlesen.
- Ein Boot im Einstieg wartet anfangs noch draußen, bevor es an der Boje ist; der Kreis folgt ihm. Der Einstieg selbst ist mit `tests/specs/einstieg.spec.mjs` abgedeckt (jedes Hinweisziel existiert, kein Text zu Gelöschtem).

Gemeldet statt selbst behoben: nichts. Zu Booten und Wegen ist bei dieser Prüfung nichts aufgefallen, was nicht schon P66 oder P84 ist.

### Verdeckte Spielfläche je Gerät

Anteil der Bildfläche in Prozent, an dem nicht der Hafen zu sehen ist (Raster 6 px, wie [ui/verdeckung.md](ui/verdeckung.md)), nach den Fixes:

| Lage | Handy hoch | Handy quer | Tablet hoch | Tablet quer | PC |
|---|---|---|---|---|---|
| Grundansicht | 29,6 | 27,9 | 12,2 | 12,2 | 6,3 |
| Menü offen | 65,8 | 65,3 | 27,6 | 27,6 | 16,2 |
| Bauen | 67,2 | 62,6 | 51,4 | 39,3 | 31,3 |
| Logbuch (Vollbild-Tafel mit Abdunklung) | 100 | 100 | 100 | 100 | 100 |
| Hilfe | 79 | 65,4 | 72,5 | 57,3 | 43,3 |
| Einstellungen | 80 | 72,6 | 42,7 | 38,3 | 22 |
| Tagesziel-Wahl | 50,4 | 53,1 | 24,3 | 25 | 13,7 |

Die Grundansicht liegt am Handy bei 30 und 28 %, wie nach PR 261 und 282 (32 und 30 %). Bauen am Tablet hochkant fiel durch Fund 4 von fast ganz bedeckt auf 51 %. Logbuch, Hilfe und Einstellungen sind Tafeln, die man selbst öffnet und mit einem Tipp schließt; sie dürfen viel verdecken.

### Bilder

Alle Bilder liegen in den Projektdateien unter `zusammenspiel/oberflaeche/`: je Gerät Grundansicht, Menü, Bauen, Logbuch, Hilfe, Einstellungen, Tagesziel-Wahl (`<gerät>-<lage>.png`), dazu die Bilder aller gedrückten Wege (`wege/<gerät>/`, Liste in `wege/<gerät>/bericht.json`).
