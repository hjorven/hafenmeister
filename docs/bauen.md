# Bauen mit Vorschau

Stand 12.11.2026. Code: `web/js/ui/bauen.js` (Oberfläche, 3D) und `web/js/ui/bauen-rat.js` (Rechenteile ohne Browser, getestet in `tests/bauen.test.mjs`).

## Ablauf im Spiel

1. **Bauen** öffnet den Baumodus. Die Spielzeit hält an, damit man in Ruhe plant. Am PC und Tablet zeigt die Kamera den ganzen Hafen neben der Karte, am Handy bleibt sie, wo sie ist.
2. Über jedem freien Bauplatz steht ein Schild mit Name und Preis. Stege sind die hellen Umrisse im Wasser (`render/stege.js`), Angebote die Schilder mit Plus an Land (`render/services.js`). Versorgung und Hafenbüro, deren Gebäude noch fehlt, bekommen im Baumodus einen hellen Grundriss an Land.
3. Die Bauliste hat vier Reiter: **Stege**, **Versorgung** (WC, Dusche, Essen, Diesel, Strom), **Angebote** (Services) und **Hafen** (Hafenbüro, nächste Ausbaustufe). Was erst in der nächsten Ausbaustufe geht, steht gestrichelt mit „Ab Ausbaustufe n“ darunter.
4. Eintrag, Schild oder Umriss antippen öffnet die **Vorschau**: Die Kamera fährt hin, das Bauwerk steht als Geisterbild im Hafen (Stege gelb, Gebäude türkis, Strom färbt die Plätze des Stegs), die Karte zeigt Nutzen, was die Gäste zuletzt vermisst haben, Preis und Kasse danach. Erst **Bauen für … €** kauft.
5. Nach dem Kauf wächst das Gebäude aus dem Boden bzw. der Steg steht da, eine Welle läuft über die Stelle, der Bauklang spielt und kurz steht „+8 Liegeplätze“ darüber. Die Karte bleibt klein mit **Weiter bauen** oder **Fertig**, damit das Neue zu sehen ist.

## Als Nächstes

Über dem Bauen-Knopf steht immer genau ein Hinweis, tippen öffnet die passende Vorschau. Der Knopf trägt einen gelben Punkt, wenn sich der Vorschlag gerade bezahlen lässt. Reihenfolge (`waehleSchritt` in `bauen-rat.js`):

1. Ausbaustufe bereit (Gäste, Ruf und Geld reichen).
2. Platzmangel: mindestens zwei Boote weitergefahren oder abends 85 % der Gastplätze belegt. Vorschlag ist der bezahlbare Steg mit den meisten Plätzen.
3. Offene Wünsche: mindestens zwei Gäste haben zuletzt etwas vermisst, dann die passende Versorgung.
4. Fehlende Grundversorgung (zum Beispiel noch gar kein WC).
5. Ziel der Ausbaustufe: wie viele Gäste, welcher Ruf oder wie viel Geld noch fehlt.
6. Etwas Neues, das sich bezahlen lässt.

Reicht das Geld nicht, sagt der Hinweis, wie viel noch fehlt. Während des Einstiegs und im Fotomodus ist er ausgeblendet.

Der Bedarf (weitergefahrene Boote, offene Wünsche, Belegung am Abend) wird aus den Ereignissen der Spielregeln mitgezählt und liegt im Spielstand unter `modules.bauen` (heute und gestern).

## Schnittstelle

```js
game.bauen.oeffnen('versorgung');      // Baumodus, optional mit Reiter
game.bauen.vorschau('steg:b-lang');    // Vorschau: steg:<projekt>, versorgung:<wc|dusche|essen|diesel|strom>,
                                       // angebot:<service>, hafen:buero, hafen:stufe
game.bauen.naechsterSchritt();         // { text, ziel, leistbar } oder null
game.bauen.bedarf();                   // { weg, offen: { dusche: 4 }, belegt, plaetze, abend }
game.bauen.schliessen();
```

Ereignisse: `bauen:offen`, `bauen:zu`, `bauen:vorschau { key }`, `bauen:gebaut { key, name, kosten }`.

Gekauft wird nur über `game.sim` (Stege, Versorgung, Hafenbüro, Ausbaustufe) und `game.services.bauen(id)`. Preise und Wirkungen kommen aus `web/js/data/economy.js`, dieses Modul rechnet keine eigenen Zahlen.

## Andockstellen in anderen Dateien

- `web/js/ui/hud.js`: Der Bauen-Knopf öffnet nicht mehr die alte Liste, sobald `game.bauen` da ist.
- `web/js/render/stege.js` und `web/js/render/services.js`: Ein Tipp auf einen freien Bauplatz öffnet die Vorschau. Ein Tipp auf ein gebautes Angebot öffnet weiter dessen eigene Karte.
- `web/js/render/buildings.js`: Toilette, Sanitärgebäude, Dusche, Kiosk, Restaurant, Hafenmeister und Hafenbüro stehen erst, wenn die passende Stufe gekauft ist (vorher standen sie ab der Ausbaustufe schon da, der Kauf änderte im Bild nichts). Mit `?stufe=n` (Ansicht ohne Kaufen) bleibt alles sichtbar. Neu: `game.buildings.lage(id)` und `game.buildings.fuerKauf(art, stufe)`.

## Ausprobieren

1. Spiel öffnen, ein paar Boote anlegen und kassieren.
2. **Bauen** drücken: Schilder über den Bauplätzen, Liste mit vier Reitern.
3. „Toilettenhäuschen“ antippen: Kamera fährt an Land, Geisterbild, Preis. **Bauen für 80 €**: Das Häuschen wächst aus dem Boden.
4. Baumodus schließen: Über dem Knopf steht der nächste Schritt, zum Beispiel „Noch 20 zufriedene Gäste bis zum Dorfhafen am See“.

## Offen

- Diesel (Tankstelle) hat noch kein eigenes Modell. Die Vorschau zeigt dann nur die Karte, der Kauf erfüllt die Wünsche trotzdem.
