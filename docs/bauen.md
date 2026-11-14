# Bauen mit Vorschau

Stand 13.11.2026 (Roadmap P18). Status: gebaut. Code: `web/js/ui/bauen.js` (Oberfläche, 3D) und `web/js/ui/bauen-rat.js` (Rechenteile ohne Browser, getestet in `tests/bauen.test.mjs`).

## Ablauf im Spiel

1. **Bauen** öffnet den Baumodus. Die Spielzeit hält an, damit man in Ruhe plant. Am PC und Tablet zeigt die Kamera den ganzen Hafen neben der Karte, am Handy bleibt sie, wo sie ist.
2. Über jedem freien Bauplatz steht ein Schild mit Name und Preis. Stege sind die hellen Umrisse im Wasser (`render/stege.js`), Angebote die Schilder mit Plus an Land (`render/services.js`). Versorgung und Hafenbüro, deren Gebäude noch fehlt, bekommen im Baumodus einen hellen Grundriss an Land.
3. Die Bauliste hat vier Reiter: **Stege**, **Versorgung** (WC, Dusche, Essen, Diesel, Strom), **Angebote** (Services) und **Hafen** (Hafenbüro, nächste Ausbaustufe). Was erst in der nächsten Ausbaustufe geht, steht gestrichelt mit „Ab Ausbaustufe n“ darunter.
4. Eintrag, Schild oder Umriss antippen öffnet die **Vorschau**: Die Kamera fährt hin, das Bauwerk steht als Geisterbild im Hafen (Stege gelb, Gebäude türkis, Strom färbt die Plätze des Stegs), die Karte zeigt Nutzen, was die Gäste zuletzt vermisst haben, Preis und Kasse danach. Erst **Bauen für … €** kauft.
5. Nach dem Kauf wächst das Gebäude aus dem Boden bzw. der Steg steht da, eine Welle läuft über die Stelle, der Bauklang spielt und kurz steht „+8 Liegeplätze“ darüber. Die Karte bleibt klein mit **Weiter bauen** oder **Fertig**, damit das Neue zu sehen ist.

## Ausbau in Bauabschnitten

Der große Ausbau zur nächsten Stufe (`ECONOMY.stufen[].ausbau`) wird in so vielen Abschnitten gebaut, wie `bautage` sagt (höchstens drei; 0 oder 1 = in einem Stück wie bisher). Durchstich und Schwimmsteg D haben zwei, Außenhafen und Großschiffpier drei Abschnitte.

1. Sind Gäste und Ruf erreicht, kostet der erste Abschnitt nur seinen Anteil (Preis geteilt durch die Zahl der Abschnitte, auf 100 € gerundet). So muss man nicht die ganze Summe auf einmal ansparen.
2. Nach dem Bezahlen steht eine Baustelle im Hafen (Ponton, Kran, Baken) an der Stelle der neuen Plätze. Gebaut wird über Nacht.
3. Am nächsten Morgen ist der Abschnitt fertig: Für die neuen Plätze stehen schon die Dalben, eine Welle läuft, „Abschnitt 1 von 2 fertig“ steigt auf. Der nächste Abschnitt lässt sich dann bezahlen.
4. Ist der letzte Abschnitt am Morgen fertig, schließt `game.sim.advanceStage({ prepaid: true })` den Ausbau ab (ohne erneut zu bezahlen) und die Feier zum Aufstieg beginnt.

Der Stand liegt im Spielstand unter `modules.bauen.ausbau` (`{ stufe, fertig, imBau, bezahlt }`) und übersteht Laden und Neustart.

Vor dem Ausbau sagt die Vorschau, was mit Booten auf Plätzen passiert, die beim Umbau wegfallen (`game.sim.stageUpPreview()`): Gäste reisen ab und zahlen noch, feste Boote ziehen um.

## Erstes Bauwerk geschenkt

Weicher Start (Roadmap Ü15, J4): Öffnet man in Stufe 1 ohne Toilette das erste Mal „Bauen“, legt das Spiel den Preis des Toilettenhäuschens (80 €, aus `economy.js`) als Geschenk in die Kasse und öffnet gleich dessen Vorschau. Ein grüner Kasten sagt, dass das Geld geschenkt ist, der Knopf „Bauen für 80 €“ leuchtet. Gekauft wird wie immer erst mit dem Knopf; „Zurück“ führt zur Liste, das Geschenk bleibt in der Kasse.

- Einmal pro Spielstand (`state.modules.bauen.geschenk` = Betrag), auch wenn der Einstieg beendet wurde. Kein Geschenk, wenn schon eine Toilette steht oder der Hafen über Stufe 1 ist.
- Im Tagesabschluss steht es unter „Sonstiges“ mit „Geschenk fürs erste Bauwerk“. Es zählt nicht als verdientes Geld (`stats.dayIncome`, `stats.totalIncome`), also nicht für Aufstieg, besten Tag oder Tagesziele.
- Der Einstieg (Schritt 5) sagt „Das erste Bauwerk ist geschenkt“, solange das Geschenk noch aussteht.
- Ereignis `bauen:geschenk` { key, betrag }.

## Sparziel

In der Vorschau von allem, was gerade zu teuer ist, steht **Als Sparziel merken**. Dann:

- läuft unter dem Geld ein dünner Balken, der sich füllt,
- steht über dem Bauplatz ein Schild „Sparziel: … 900 € von 2.500 €“ (auch außerhalb des Baumodus, antippen öffnet die Vorschau),
- zeigt „Als Nächstes“ den Stand und, sobald es reicht, „Sparziel erreicht: … bauen“ mit einem kurzen Klang.

Gebaut oder nicht mehr im Bauplan: Das Sparziel fällt weg. Noch einmal tippen löst es. Gespeichert unter `modules.bauen.sparziel`.

## Kauf zurücknehmen

Nach jedem Kauf steht auf der Karte zehn Sekunden lang **Rückgängig (10 s)**. Weil im Baumodus die Zeit steht, ist in der Zeit nichts anderes passiert: Kasse, Ausgaben des Tages, Stege, Versorgung, Hafenbüro, Angebote und Bauabschnitte kommen genau auf den Stand vor dem Kauf zurück. Den Stufenausbau in einem Stück (Stufe 1 zu 2) kann man nicht zurücknehmen, weil dabei schon Boote umgezogen sind; Bauabschnitte schon.

## Zu wenig Platz für Preisschilder

Passen nicht alle Schilder ins Bild (Handy hochkant, viele Bauplätze), wird ein Schild erst kleiner (nur der Preis), dann zum Punkt mit Plus. Antippen öffnet in jedem Fall die Vorschau.

## Als Nächstes

Über dem Bauen-Knopf steht immer genau ein Hinweis, tippen öffnet die passende Vorschau. Der Knopf trägt einen gelben Punkt, wenn sich der Vorschlag gerade bezahlen lässt. Ein angeheftetes Sparziel geht allem vor. Sonst gilt die Reihenfolge (`waehleSchritt` in `bauen-rat.js`):

1. Ausbaustufe bereit (Gäste und Ruf erreicht, Geld reicht für die Stufe oder den nächsten Bauabschnitt).
2. Platzmangel: mindestens zwei Boote weitergefahren oder abends 85 % der Gastplätze belegt. Vorschlag ist der bezahlbare Steg mit den meisten Plätzen.
3. Offene Wünsche: mindestens zwei Gäste haben zuletzt etwas vermisst, dann die passende Versorgung.
4. Fehlende Grundversorgung (zum Beispiel noch gar kein WC).
5. Ziel der Ausbaustufe: wie viele Gäste, welcher Ruf oder wie viel Geld noch fehlt.
6. Etwas Neues, das sich bezahlen lässt.
7. In der letzten Stufe, wenn nichts mehr zu bauen ist: das Abschlussziel der Region (`regionsSchritt`).

Reicht das Geld nicht, sagt der Hinweis, wie viel noch fehlt. Während des Einstiegs und im Fotomodus ist er ausgeblendet.

Der Bedarf (weitergefahrene Boote, offene Wünsche, Belegung am Abend) wird aus den Ereignissen der Spielregeln mitgezählt und liegt im Spielstand unter `modules.bauen` (heute und gestern).

## Schnittstelle

```js
game.bauen.oeffnen('versorgung');      // Baumodus, optional mit Reiter
game.bauen.vorschau('steg:b-lang');    // Vorschau: steg:<projekt>, versorgung:<wc|dusche|essen|diesel|strom>,
                                       // angebot:<service>, hafen:buero, hafen:stufe
game.bauen.naechsterSchritt();         // { text, ziel, leistbar } oder null
game.bauen.bedarf();                   // { weg, offen: { dusche: 4 }, belegt, plaetze, abend }
game.bauen.ausbau();                   // { name, n, fertig, imBau, teile, preis } oder null
game.bauen.sparziel();                 // key oder null; game.bauen.setzeSparziel(key | null)
game.bauen.schliessen();
```

Ereignisse: `bauen:offen`, `bauen:zu`, `bauen:vorschau { key }`, `bauen:gebaut { key, name, kosten }`, `bauen:abschnitt { stufe, abschnitt, von, kosten }`, `bauen:abschnittFertig { stufe, abschnitt, von }`, `bauen:zurueck { key, kosten }`, `bauen:sparziel { key }`.

Gekauft wird nur über `game.sim` (Stege, Versorgung, Hafenbüro, Ausbaustufe) und `game.services.bauen(id)`. Preise und Wirkungen kommen aus `web/js/data/economy.js`, dieses Modul rechnet keine eigenen Zahlen.

## Andockstellen in anderen Dateien

- `web/js/ui/hud.js`: Der Bauen-Knopf öffnet nicht mehr die alte Liste, sobald `game.bauen` da ist.
- `web/js/render/stege.js` und `web/js/render/services.js`: Ein Tipp auf einen freien Bauplatz öffnet die Vorschau. Ein Tipp auf ein gebautes Angebot öffnet weiter dessen eigene Karte.
- `web/js/sim.js` und `web/js/bridge.js`: `advanceStage({ prepaid: true })` schließt einen abschnittsweise bezahlten Ausbau ab, ohne Ziel und Kasse erneut zu prüfen.
- `web/js/render/services.js`: `game.services.neuZeichnen()` nach dem Zurücknehmen eines Angebots.
- `web/js/render/buildings.js`: Toilette, Sanitärgebäude, Dusche, Kiosk, Restaurant, Hafenmeister und Hafenbüro stehen erst, wenn die passende Stufe gekauft ist (vorher standen sie ab der Ausbaustufe schon da, der Kauf änderte im Bild nichts). Mit `?stufe=n` (Ansicht ohne Kaufen) bleibt alles sichtbar. Neu: `game.buildings.lage(id)` und `game.buildings.fuerKauf(art, stufe)`.

## Ausprobieren

1. Spiel öffnen, ein paar Boote anlegen und kassieren.
2. **Bauen** drücken: Schilder über den Bauplätzen, Liste mit vier Reitern.
3. „Toilettenhäuschen“ antippen: Kamera fährt an Land, Geisterbild, Preis. **Bauen für 80 €**: Das Häuschen wächst aus dem Boden.
4. Baumodus schließen: Über dem Knopf steht der nächste Schritt, zum Beispiel „Noch 20 zufriedene Gäste bis zum Dorfhafen am See“.

## Offen

- Diesel (Tankstelle) hat noch kein eigenes Modell. Die Vorschau zeigt dann nur die Karte, der Kauf erfüllt die Wünsche trotzdem.
