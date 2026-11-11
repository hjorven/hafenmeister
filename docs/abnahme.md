# Abnahme: Fertig heißt spielbar

Stand: 11.11.2026. Gilt für jeden Pull Request in diesem Repo. Grund: Jorven möchte lieber weniger Features, aber jedes eingebaute Feature muss wirklich funktionieren. Nichts darf im Spiel, in der Doku oder im Einstieg stehen, das am Ende nichts tut.

## Regeln

1. **Sichtbar im laufenden Spiel.** Was gemergt wird, tut auf `main` im Browser etwas, das man sieht oder hört. Ein Modul, das nur lädt und nirgends angeschlossen ist, bleibt auf dem Branch oder ist für Spieler unsichtbar.
2. **Kein totes Bedienelement.** Kein Knopf, keine Zahl, kein Symbol ohne Funktion. Was noch nicht geht, wird ausgeblendet (`hidden`), nicht deaktiviert angezeigt.
3. **Doku nur für Gebautes.** `docs/plan.md` und andere Dokumente beschreiben, was gebaut ist oder als Nächstes gebaut wird. Späteres steht im Plan unter „Nach 1.0“.
4. **Ausprobieren beschreiben.** Jeder PR nennt in der Beschreibung die Schritte, mit denen man die Änderung im Browser sieht.
5. **Prüfungen grün.** Vor dem Push:

```bash
bash tools/check-pages.sh web && node --test tests/*.test.mjs
```

Sobald der Rauchtest für die Spielschleife existiert (Boot kommt an, wird zugewiesen, abends steigt das Geld), muss auch er grün bleiben.

## Lokal ausprobieren

```bash
python3 -m http.server 8000 --directory web
```

Danach `http://localhost:8000` öffnen, auf dem PC und mit den Geräte-Werkzeugen des Browsers als Handy (390 x 844) und Tablet (1024 x 768).

## Ist-Stand auf main (11.11.2026)

| Feature | Stand |
|---|---|
| 3D-Szene, Zoom, Verschieben, Übersicht | funktioniert |
| Pause | Hülle: es läuft noch nichts, das anhält |
| Geld, Ruf, Tag | Hülle: feste Texte |
| Knopf „Bauen“ | Hülle: tut nichts |
| Spielstand, Export, Web-App | halb: Modul lädt, aber kein Knopf öffnet es, kein Spielzustand |
| Liegeplätze `web/js/data/harbor.js` | halb: Daten da, Szene zeigt noch den Platzhalter-Steg |
| Boote, Zuweisen, Kassieren, Bauen, Stufen, Ton | fehlt |

Diese Tabelle wird vom Thread „Fehlende Features und Qualität prüfen“ gepflegt.
