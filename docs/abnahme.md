# Abnahme: Fertig heißt spielbar

Stand: 12.11.2026 (Ist-Stand neu nach PR 144). Status: gilt. Gilt für jeden Pull Request in diesem Repo. Grund: Jorven möchte lieber weniger Features, aber jedes eingebaute Feature muss wirklich funktionieren. Nichts darf im Spiel, in der Doku oder im Einstieg stehen, das am Ende nichts tut.

## Regeln

1. **Sichtbar im laufenden Spiel.** Was gemergt wird, tut auf `main` im Browser etwas, das man sieht oder hört. Ein Modul, das nur lädt und nirgends angeschlossen ist, bleibt auf dem Branch oder ist für Spieler unsichtbar.
2. **Kein totes Bedienelement.** Kein Knopf, keine Zahl, kein Symbol ohne Funktion. Was noch nicht geht, wird ausgeblendet (`hidden`), nicht deaktiviert angezeigt.
3. **Doku nur für Gebautes.** `docs/plan.md` und andere Dokumente beschreiben, was gebaut ist. Was noch nicht im Spiel ist, wird als „geplant“ mit seinem Roadmap-Paket markiert; Späteres steht im Plan unter „Nach 1.0“. Jedes Dokument beginnt mit einer Statuszeile (Stand, Status).
4. **Ausprobieren beschreiben.** Jeder PR nennt in der Beschreibung die Schritte, mit denen man die Änderung im Browser sieht.
5. **Prüfungen grün.** Vor dem Merge im Hauptordner, Ende mit `Alles grün.`:

```bash
bash tests/pruefen.sh
```

Dazu der Check „Spiel testen (Handy, Tablet, PC)“ im PR ([tests.md](tests.md)).
6. **Im Spiel angesehen.** Vor dem Merge die Änderung am Handy (hoch und quer) und am PC im laufenden Spiel ansehen, Formen, Kanten, Überdeckungen und Mittigkeit prüfen. Jorven testet selbst am iPhone über die Pages-Seite.
7. **Für Spieler notiert.** Was man im Spiel sieht oder hört, bekommt eine Zeile in [aenderungen.md](aenderungen.md).

## Lokal ausprobieren

```bash
python3 -m http.server 8000 --directory web
```

Danach `http://localhost:8000` öffnen, auf dem PC und mit den Geräte-Werkzeugen des Browsers als Handy (390 x 844) und Tablet (1024 x 768).

## Ist-Stand auf main (12.11.2026, nach PR 144)

| Feature | Stand |
|---|---|
| 3D-Szene, Zoom, Verschieben, Drehen, Übersicht, Startansicht je Gerät | funktioniert |
| Tempo Pause, 1x, 3x, 8x | funktioniert |
| Geld, Ruf, Tag, Ziel der nächsten Stufe | funktioniert |
| Boote kommen, warten an Boje oder im Ankerfeld, Zuweisen, Selbst-Einfahren | funktioniert |
| Liegegeld beim Festmachen, Kassieren, Rundgang, Wimpel | funktioniert; Knopf „Kassieren“ erscheint auch ohne Hafenbüro (Fehler, P02) |
| Bauen mit Vorschau, Stegprojekte, Versorgung, Hafenbüro, Services, Angebote an Land | funktioniert; Service-Zahlen aus zwei Quellen (P06) |
| Stufen 1 bis 6 Ostsee, Abschlussziel | funktioniert; zwei Zähler für Großschiffbesuche (P04, PR 139) |
| Dauerlieger | halb: zahlen pauschal 15 € statt Pacht, keine Entscheidung (P01) |
| Stammgäste, Wetterflagge, Fotomodus, Hafen schauen, Tagesziele | funktioniert |
| Einstieg | halb: verweist noch auf die gelöschte Sonne (P03, PR 112) |
| Ereignisse, Winter | funktioniert; Winterpause mit Bilanz, Winterarbeiten und „Winter überspringen“ (`docs/winter.md`); Krantage: Dauerlieger über den Winter im Winterlager |
| Menschen, Ton, Musik | funktioniert |
| Speichern, Export, Web-App | funktioniert; ein Speicherplatz, zweiter alter Speicherweg (P09) |
| Pixel-Fassung `pixel/` | funktioniert als eigene Seite |
| Nordsee | nur Landschaft zum Ansehen (`?revier=nordsee`), keine eigenen Regeln (P57) |
| Online | fehlt, kommt zuletzt (P58) |

Diese Tabelle pflegt das Doku-Paket (P08); jedes Paket ändert seine Zeile beim Merge.
