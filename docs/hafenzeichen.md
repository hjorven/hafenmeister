# Versteckte Regeln sichtbar machen (Paket P55)

Stand: 14.11.2026. Status: gemergt (PR 269, L2 im Folge-PR). Roadmap-Punkte A4, B1, C7, L2, Bed P1 (Rest), Bed P3, Bed P10 (für wartende Boote).

Drei Regeln hat das Spiel schon lange gerechnet, aber nie gezeigt: wie lange ein Boot an der Boje wartet, wie viele Boote eine Dusche am Tag versorgt, und dass draußen vor dem Bild Boote warten. Jetzt sieht man alle drei im Hafen selbst, ohne neue Tafel.

## 1. Geduldsring über dem wartenden Boot (A4)

- Ganz links in der Reihe der Wunschsymbole über jedem wartenden Boot steht ein kleiner Pixel-Ring (24 px, aus der Ferne 12 px). Er läuft wie eine Uhr rückwärts ab, oben beginnend, im Uhrzeigersinn.
- Farbe nach Dritteln der Geduld (`ECONOMY.warten.geduld`, heute 30 s): grün, gelb, rot. Im letzten Drittel blinkt das Feld hinter dem Ring (bei "Weniger Bewegung" steht es rosa statt zu blinken).
- Beim Wechsel ins letzte Drittel tutet das Boot einmal kurz (Schiffshorn nach Bootsgröße), höchstens ein Tuten alle 6 s, nicht bei Pause.
- Die Geduld ruht abends und nach einer Nacht an der Boje bis zum Ende der Abreisen am Vormittag. Dann steht der Ring grau-blau und blinkt nicht. Vorher zeigte `game.sim.geduld()` abends eine ablaufende Zahl, obwohl niemand wegfuhr; das ist in `sim.patienceLeft` behoben (Abends gilt der Stand bei Tagesende).
- Auf der Anfahrt zur Boje ist der Ring voll und grün: Die Geduld zählt erst an der Boje.
- Auch Boote ohne Wünsche haben jetzt eine Reihe (nur mit dem Ring).

Dateien: `web/js/ui/geduldsring.js` (Rechnung und Bild), `web/js/ui/vorschau.js` (Reihe über dem Boot).

## 2. Auslastung an den Versorgungsgebäuden (B1, C7)

- Über Toilette bzw. Sanitärgebäude, Dusche, Kiosk bzw. Restaurant und Tankstelle steht ein Schild mit Wunschsymbol und "versorgt/höchstens" für heute, darunter ein Balken. Es gibt immer nur ein Schild je Versorgung, am höchsten gebauten Gebäude.
- Knapp (höchstens ein Fünftel übrig, mindestens ein Platz): Schild orange, blinkt beim Wechsel sechsmal. Voll: Schild rot. Am Morgen zählt es neu (`state.served`).
- Normale Schilder nur aus der Nähe (Bildbreite bis 420 m, ab 160 m klein), knappe und volle auch aus der Ferne.
- Liegt ein Schild unter einem Knopf oder einer Tafel, bleibt es weg.
- Beim ersten Vollwerden einer Versorgung im Spielstand erklärt ein Tipp das Schild (Hinweis `versorgung` im Einstieg, über die Meldungs-Ordnung).
- Strom ist ein Platz-Wunsch ohne Tageskapazität und hat kein Schild.

Schnittstelle: `game.sim.auslastung()` liefert `{ wc: { versorgt, kapazitaet }, ... }` für gebaute Versorgung (`sim.facilityLoad`).

## 3. Zeiger am Bildrand (Bed P3, Bed P10)

- Wartet ein Boot an der Boje außerhalb des Bildes, steht am Rand ein Zeiger: sein Geduldsring mit einem Pfeil in die Richtung des Boots. Nah beieinander liegende Zeiger werden einer mit Zahl, der Ring zeigt dann das eiligste Boot.
- Antippen fährt die Kamera zu diesem Boot (wählt es nicht aus, damit es weiter selbst einfahren kann).
- Zeiger rutschen am Rand entlang, bis sie keinen Knopf und keine Tafel verdecken. Steht eine große Meldung (Winter, Tagesabschluss, Kartenwahl, Feier), im Fotomodus, beim Bauen und beim Überblicksflug gibt es keine Zeiger.
- Boote auf der Anfahrt bekommen keinen Zeiger, erst an der Boje.

Datei: `web/js/ui/hafenzeichen.js` (Schilder, Zeiger, Tuten). Schnittstelle `game.hafenzeichen = { zeiger(), schilder(), ring(id), aktualisieren() }`.

## 4. Schlange vor der Versorgung (L2)

- Ist eine Versorgung heute knapp oder voll, gehen Gäste, die zu Toilette, Sanitärgebäude, Dusche, Kiosk oder Restaurant laufen, nicht gleich hinein: Sie stellen sich an. Die Erste steht an der Tür, die anderen reihen sich an der Hauswand entlang auf und rücken nach.
- Anstehen dauert bei knapp 6 bis 14 s, bei voll 14 bis 26 s Spielzeit, dann geht es wie sonst weiter. Höchstens sechs stehen an, abends niemand.
- Reine Anzeige: Die Schlange ändert keine Regel und kein Geld.

Datei: `web/js/render/people.js` (Zustand `schlange`, `schlangenOrdnen`).

## Nicht in diesem Paket

- Zeiger für andere Aufgaben am Rand (liegen gebliebene Münzen, Dauerlieger): bewusst nicht, damit der Rand ruhig bleibt. Münzen holt abends der Rundgang.

## Geprüft

- `node --test tests/hafenzeichen.test.mjs`: Ring (Drittel, nie leer, ruht), Ringbild, Auslastung (frei, knapp, voll), Randpunkte und Weg am Rand, Bündeln über die Ecke, Geduld ruht abends, nach der Nacht und auf der Anfahrt, Auslastung aus den Regeln.
- Browser-Eigenprüfung über Stufen 1 bis 6 auf Handy, Handy quer, Tablet, Tablet quer und PC: je Lauf 60 s bei 8x und 25 s voller Hafen, alle 300 ms geprüft (Zeiger nur zu wartenden Booten außerhalb des Bildes, nie über Knöpfen, Schildtext gleich der Regel, abends graue Ringe und niemand fährt aus Ungeduld weg), dazu Antippen, Fotomodus, Bauen, Laden.

## Wo es mit anderen Paketen zusammenstößt

- `ui/vorschau.js` (P11): Die Reihe über dem Boot hat den Ring als erstes Feld. Wer die Reihe ändert, lässt `.hm-geduld` vorne.
- Meldungs-Ordnung (`ui/meldungen.js`): Zeiger verschwinden ab Vorrang `winter` (75). Neue große Fenster bitte in `FENSTER` eintragen, dann gilt das auch für sie.
- P66 und Stegbilder: Zeiger und Ringe hängen an `game.boatView.boot(id).model`, nicht an festen Bojenlagen.
- P23 (Services mit eigener Wirkung) und Balancing (P17): Ändern sich Kapazitäten oder kommen neue Versorgungen dazu, erscheinen sie von selbst, sobald `rules.facilities` sie kennt. Ein neues Gebäude braucht einen Eintrag in `KAUF` (`render/buildings.js`) oder ein Objekt mit Namen, sonst hat es kein Schild.
- P67 (große Häfen, Welle 6): baut auf den Zeigern auf (Sprung zu Stegen).
