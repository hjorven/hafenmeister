# Einstieg für neue Spieler

Stand: 12.11.2026. Code: `web/js/features/einstieg.js`, Test: `tests/einstieg.test.mjs`.

Kein Tutorial mit Story, sondern Hinweis-Kreise: Ein leuchtender Kreis zeigt auf die Stelle, um die es geht, daneben steht ein kurzer Satz. Die Schritte folgen dem, was im Spiel gerade passiert, nicht einer festen Uhr.

| Nr. | Schritt | Kreis zeigt auf | Endet, wenn |
|---|---|---|---|
| 1 | Willkommen | Sonne im Tagesbalken | ein Boot wartet |
| 2 | Ein Boot wartet | das wartende Boot (ist es noch außerhalb des Bildes: Kreis mit Pfeil am Rand) | ein Boot angelegt hat |
| 3 | Feierabend | eine Münze | eine Münze eingestrichen ist (Strich, Antippen oder „Kassieren“) |
| 4 | Hafen ausbauen | Knopf „Bauen“ | „Bauen“ gedrückt oder „Weiter“ |
| 5 | Tagesziele | Knopf „Tagesziele“ | „Los geht’s“ |

- „Einstieg beenden“ beendet ihn jederzeit.
- Während das Boot an der Leine gezogen wird, sind Kreis und Text ausgeblendet.
- Texte unterscheiden Finger (Handy, Tablet) und Maus (PC).
- Gespeichert in `state.modules.einstieg` (`{ fertig, erledigt }`). Ein neues Spiel beginnt den Einstieg wieder, ältere Spielstände ohne Eintrag bekommen ihn auch.
- Zum Ansehen neu starten: `?einstieg=1` an die Adresse hängen, zum Beispiel `https://hjorven.github.io/hafenmeister/?einstieg=1`.
