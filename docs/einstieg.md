# Einstieg für neue Spieler

Stand: 12.11.2026 (Liegegeld beim Anlegen, Selbst-Einfahren). Code: `web/js/features/einstieg.js`, Test: `tests/einstieg.test.mjs`.

Kein Tutorial mit Story, sondern Hinweis-Kreise: Ein leuchtender Kreis zeigt auf die Stelle, um die es geht, daneben steht ein kurzer Satz. Die Schritte folgen dem, was im Spiel gerade passiert, nicht einer festen Uhr.

| Nr. | Schritt | Kreis zeigt auf | Endet, wenn |
|---|---|---|---|
| 1 | Willkommen | eine Warteboje | mindestens 6 s zu sehen und ein wartendes Boot liegt im Bild |
| 2 | Ein Boot wartet | das wartende Boot | ein Boot angelegt hat |
| 3 | Liegegeld kassieren | die Münze am Boot (gleich nach dem Anlegen) | eine Münze eingestrichen ist (Antippen, Strich oder „Kassieren“) |
| 4 | Der Tag läuft | Sonne im Tagesbalken | Sonne gezogen oder „Weiter“ |
| 5 | Hafen ausbauen | Knopf „Bauen“ | „Bauen“ gedrückt oder „Weiter“ |
| 6 | Tagesziele | Knopf „Tagesziele“ | „Los geht’s“ |

- Ein Boot, das in den Regeln schon wartet, in 3D aber noch von draußen anfährt, zählt erst, wenn es im Bild liegt.
- Bis das erste Boot angelegt hat, hält der Einstieg wartende Boote mit `game.sim.holdBoat` an der Boje fest, damit sie nicht von selbst einfahren.
- Der Text lässt Tipps auf das Spiel durch, nur seine Knöpfe fangen sie ab. Ist die Bootskarte offen, ist der Text ausgeblendet.
- „Einstieg beenden“ beendet ihn jederzeit. Nach einem ganzen Spieltag schließt er von selbst.
- Während das Boot an der Leine gezogen wird, sind Kreis und Text ausgeblendet.
- Texte unterscheiden Finger (Handy, Tablet) und Maus (PC).
- Gespeichert in `state.modules.einstieg` (`{ fertig, erledigt }`). Ein neues Spiel beginnt den Einstieg wieder, ältere Spielstände ohne Eintrag bekommen ihn auch.
- Zum Ansehen neu starten: `?einstieg=1` an die Adresse hängen, zum Beispiel `https://hjorven.github.io/hafenmeister/?einstieg=1`.
