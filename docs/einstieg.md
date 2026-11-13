# Einstieg für neue Spieler

Stand: 12.11.2026 (Roadmap-Paket P03: Liegegeld beim Anlegen, Anteil beim Rundgang, Zeitsteuerung statt Sonne, Kamera zum wartenden Boot). Code: `web/js/features/einstieg.js`, Test: `tests/einstieg.test.mjs`.

Kein Tutorial mit Story, sondern Hinweis-Kreise: Ein leuchtender Kreis zeigt auf die Stelle, um die es geht, daneben steht ein kurzer Satz. Die Schritte folgen dem, was im Spiel gerade passiert, nicht einer festen Uhr.

| Nr. | Schritt | Kreis zeigt auf | Endet, wenn |
|---|---|---|---|
| 1 | Willkommen | eine Warteboje | mindestens 6 s zu sehen und ein wartendes Boot liegt im Bild |
| 2 | Ein Boot wartet | das wartende Boot | ein Boot angelegt hat |
| 3 | Liegegeld beim Anlegen | die Münze am Boot (gleich nach dem Anlegen) | eine Münze eingestrichen ist (Antippen oder Strich; den Knopf „Kassieren“ gibt es erst mit dem Hafenbüro). Der Text sagt auch: Was liegen bleibt, holt abends der Hafenmeister, aber nur einen Teil (heute die Hälfte; die Zahl kommt aus den Regeln, `roundShare` oder `uncollectedShare`). |
| 4 | Der Tag läuft | Vorspul-Knopf 3x der Zeitsteuerung unten links (Text nennt Pause, 1x, 3x, 8x, am PC Taste F) | vorgespult oder „Weiter“ |
| 5 | Hafen ausbauen | Knopf „Bauen“ | „Bauen“ gedrückt oder „Weiter“ |
| 6 | Tagesziele | Knopf „Tagesziele“ | „Los geht’s“ |

- Ein Boot, das in den Regeln schon wartet, in 3D aber noch von draußen anfährt, zählt erst, wenn es im Bild liegt.
- Liegt das wartende Boot nach den 6 s Willkommen außerhalb des Bildes (Handy quer, großer PC-Ausschnitt), fährt die Kamera weich zu ihm (`game.camera.flyTo`), höchstens dreimal, damit sie dem Spieler nicht hinterherzieht.
- Im flachen Querformat (Höhe unter 500 px) steht der Text rechts, wenn das Ziel links liegt, sonst links.
- Im flachen Querformat (Handy quer) tritt die Seitenleiste mit den Tagesziele-Tafel hinter die Blase zurück (`ui-phone.css`). Schritt 6 entfällt dort, der Einstieg endet nach Schritt 5.
- Schritt 3: Bis die Münze erscheint (das Boot fährt von der Boje in die Box, das dauert einige Sekunden), zeigt der Kreis auf das anlegende Boot, mit Hafenbüro sonst auf „Kassieren“. Liegt das Boot außerhalb des Bildes, fährt die Kamera hin.
- Schritt 4 entfällt, wenn schon vorgespult wird (wer 3x oder 8x drückt, kennt die Zeitsteuerung).
- Bis das erste Boot angelegt hat, hält der Einstieg wartende Boote mit `game.sim.holdBoat` an der Boje fest, damit sie nicht von selbst einfahren.
- Der Text lässt Tipps auf das Spiel durch, nur seine Knöpfe fangen sie ab. Ist die Bootskarte offen, ist der Text ausgeblendet.
- „Einstieg beenden“ beendet ihn jederzeit. Nach einem ganzen Spieltag schließt er von selbst.
- Während das Boot an der Leine gezogen wird, sind Kreis und Text ausgeblendet.
- Texte unterscheiden Finger (Handy, Tablet) und Maus (PC).
- Gespeichert in `state.modules.einstieg` (`{ fertig, erledigt, v2, v3, startTag }`; v3 hat den Vorspul-Schritt von `sonne` in `tempo` umbenannt). Ein neues Spiel beginnt den Einstieg wieder, ältere Spielstände ohne Eintrag bekommen ihn auch.
- Zum Ansehen neu starten: `?einstieg=1` an die Adresse hängen, zum Beispiel `https://hjorven.github.io/hafenmeister/?einstieg=1`.
