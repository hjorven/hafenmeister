# Ruhige Oberfläche: eine Meldung zur Zeit

Stand 14.11.2026. Anlass: Jorvens iPhone-Bild von Tag 48. Gleichzeitig standen dort "Heute: Sommertag",
"Tag 47: + 640 €", "Ausbau 1/3", eine Bewertungsblase, Service-Symbole, ein großer Kassieren-Knopf,
"Weiter mit 8x", Zeitsteuerung und Bauen. Mehr als die Hälfte des Bildes war verdeckt, alles wollte
zugleich Aufmerksamkeit. Dazu standen Ziffern und Euro in der Systemschrift ("Rückgängig 8 s").

## Grundsätze

1. **Eine Meldung zur Zeit.** Kurze Meldungen stehen an einem einzigen Platz, nacheinander.
   Wer warten muss, wartet ausgeblendet; seine Zeit läuft erst, wenn er steht.
2. **Der Rest ist ein Zähler.** Ein kleiner roter Zähler (+2) an der stehenden Meldung zeigt, wie viele noch kommen.
3. **Die Mitte gehört dem Hafen.** Feste Knöpfe nur an den Rändern, Meldungen klein, höchstens zwei Zeilen.
4. **Daumen unten.** Der Meldeplatz steht unten bei den Knöpfen; am Handy hochkant Kassieren klein über Bauen.
5. **Eine Schrift.** Alles in Pixelify Sans, auch Ziffern und Euro; die Schrift wird vorab geladen.

## Anordnung Handy hochkant

```
+--------------------------------------+
| [Kasse | Ruf]          [Übers.][Menü] |
| [Wetter]                       [Funk] |  Funk zuerst zugeklappt
| [Tagesziel]                           |
| [Ausbau 1/3]                          |
|                                       |
|            Spielfläche frei           |
|                                       |
| +-------------------------------+ +2  |  Meldeplatz: eine Meldung
| | (Symbol) Heute: Sommertag     |     |
| +-------------------------------+     |
| [Tag 48 ----o---]          [€ 272]    |  Kassieren klein, rechter Daumen
| [II] [>] [>>] [>>>]        [Bauen]    |
+--------------------------------------+
```

PC, Tablet quer und Handy quer: der Meldeplatz steht unten in der Lücke zwischen Zeit, Kassieren und Bauen
(wie ein Untertitel), wenn sie mindestens 320 px breit ist; sonst über den Knöpfen wie am Handy hochkant.

Vorher und nachher (Handy, Morgen und Kassieren): `/mnt/project-files/handy-ui/ruhig/vergleich-handy.png`.

## Was im Meldeplatz steht (Vorrang, höher zuerst)

| Meldung | Modul | Vorrang |
|---|---|---|
| Morgen-Zettel "Tag 47: + 640 €" | ui/tagesabschluss.js | 70 |
| Dauerlieger wartet (Frist) | features/dauerlieger.js | 65 |
| Ankündigung "Heute: Sommertag", "Übermorgen: Regatta" | events/banner.js | 55 |
| Tipp beim ersten Mal (Einstieg) | features/einstieg.js | 45 |
| Dauerplatz-Meldungen | features/dauerlieger.js | 40 |
| Bewertung eines Boots außerhalb des Bildes | ui/gaestebuch.js | 20 |
| "Als Nächstes" (Bau-Rat) | ui/bauen.js | 10, zählt nicht im Zähler |

Fenster (Feier 100, Kartenwahl 90, Tagesabschluss 80, Winter 75) gehen allem vor; solange sie stehen,
wartet der Meldeplatz.

## Für Module: eine Meldung in den Meldeplatz hängen

```js
// einmal beim Start
game.meldungen.anmelden?.('#mein-schild', 'meine-id');
// zeigen wollen
game.meldungen.wunsch('meine-id', 30);
// in jedem Takt: nur sichtbar, wenn sie darf (Zeit nur dann herunterzählen)
schild.classList.toggle('zurueck', !game.meldungen.darf('meine-id'));
// fertig
game.meldungen.fertig('meine-id');
```

Lage und Breite setzt der Platz (`game.meldungen.imPlatz(el)` ist dann true, eigene Lage-Rechnung entfällt).
Inhalt: Symbol 24 px aus `ui/pixel-symbole.js`, eine fette Zeile, höchstens zwei Zeilen Text.

## Schrift

- `@font-face` ohne `unicode-range`: Ziffern und Euro kommen aus Pixelify (vorher absichtlich aus der Systemschrift).
- Das Pixelify-Euro sah klein wie eine 8 aus. `tools/schrift/euro.py` ersetzt es in den drei Schnitten durch ein
  offenes Pixel-Euro mit zwei Querbalken (Bild `/mnt/project-files/handy-ui/ruhig/pixel-euro.png`).
- `index.html` lädt die drei Schnitte mit `preload`, `font-display: block`, und `main.js` wartet höchstens 2,5 s
  auf die Schrift, bevor Module Zahlen in Canvas zeichnen (Münzen, Beträge). Offline liegen die Schnitte im
  Cache (tools/offline-liste.mjs, Ordner fonts).

## Weitere Ruhe

- Bewertungsblasen über Booten: höchstens zwei zugleich, unter Oberfläche und Meldeplatz ganz ausgeblendet statt blass.
- Funk (Hafenbüro) am Handy hochkant zuerst zugeklappt; aufgeklappt bleibt gemerkt.
- "Weiter mit 8x" entfällt (Thread "Zeitraffer ×3 springt nicht mehr zurück"), Tagesziel-Wahl nur als Punkt am
  Schild (Thread "Menüs am Handy kompakter machen").

## Mögliche Zusammenstöße

- Neue schwebende Schilder ohne `anmelden` erscheinen wieder neben dem Meldeplatz: jedes neue Schild bitte anmelden.
- Module, die eigene Lage per Inline-Stil setzen, werden im Platz per `!important` überstimmt; Animationen mit
  `transform` wirken dort nicht (der Platz nutzt `translate`).
- Tipps des Einstiegs mit Ring (zeigt auf einen Knopf) stehen am Handy ebenfalls unten; der Ring bleibt.
