# Veröffentlichen über GitHub Pages

Stand: 12.11.2026. Status: gebaut, läuft. Der veröffentlichte Stand steht unter https://hjorven.github.io/hafenmeister/version.txt .

Das Spiel liegt im Ordner `web/` und wird bei jedem Push auf `main` automatisch veröffentlicht unter:

**https://hjorven.github.io/hafenmeister/**

Solange es `web/index.html` noch nicht gibt, erscheint dort eine Platzhalterseite.

## Einmalig in GitHub einstellen

1. Im Repo auf **Settings** gehen, links **Pages** wählen.
2. Unter **Build and deployment** bei **Source** den Eintrag **GitHub Actions** auswählen (nicht "Deploy from a branch").
3. Fertig. Der nächste Push auf `main` veröffentlicht die Seite. Alternativ unter **Actions**, Workflow **GitHub Pages**, auf **Run workflow** klicken.

Direkter Link: https://github.com/hjorven/hafenmeister/settings/pages

Den Stand der veröffentlichten Seite zeigt `https://hjorven.github.io/hafenmeister/version.txt` (Commit und Zeit).

## Regeln für den Spielcode

Die Seite liegt in einem Unterordner (`/hafenmeister/`), nicht im Hauptverzeichnis der Domain. Deshalb:

| Richtig | Falsch | Warum |
|---|---|---|
| `src="js/main.js"` | `src="/js/main.js"` | `/` zeigt auf `hjorven.github.io/`, nicht auf das Spiel |
| `fetch("./data/boote.json")` | `fetch("/data/boote.json")` | wie oben |
| `"start_url": "./"`, `"scope": "./"` im Manifest | `"start_url": "/"` | sonst startet die installierte App ins Leere |
| Dateinamen genau so schreiben, wie sie heißen | `Main.js` statt `main.js` | Pages unterscheidet Groß- und Kleinschreibung, Windows nicht |

Bibliotheken liegen im Spiel selbst, nicht auf einem CDN (P61): Three.js steht in `web/vendor/three-<Version>/` und wird über die Import-Map mit `./vendor/...` eingebunden (Ziele in der Import-Map müssen mit `./` oder `../` beginnen). Aktualisieren: Version in `tests/package.json` ändern, `npm install` im Ordner `tests/`, dann `bash tools/three-holen.sh` und die Import-Maps nachziehen. `tests/offline.test.mjs` prüft das. Ein Build-Schritt für das Spiel ist nicht nötig; `tools/build-pages.sh` schreibt nur zusätzlich `offline-liste.json` (alle Spieldateien für den Offline-Start).

Der Workflow prüft das vor jeder Veröffentlichung mit `tools/check-pages.sh` und bricht bei Fehlern ab.

## Lokal testen

Prüfen, ob die Pfade stimmen:

```bash
bash tools/check-pages.sh web
```

Die Seite so starten, wie sie später auf GitHub Pages liegt (im Unterordner `/hafenmeister/`):

```bash
bash tools/build-pages.sh
rm -rf /tmp/pages-test && mkdir -p /tmp/pages-test && cp -R _site /tmp/pages-test/hafenmeister
python3 -m http.server 8000 --directory /tmp/pages-test
```

Danach im Browser `http://localhost:8000/hafenmeister/` öffnen. Beenden mit Strg+C.

Auf Handy oder Tablet im selben WLAN testen: statt `localhost` die IP-Adresse des Rechners eingeben, z.B. `http://192.168.178.20:8000/hafenmeister/`. Die IP zeigt unter Linux und macOS `hostname -I` bzw. `ipconfig getifaddr en0`, unter Windows `ipconfig`.

## Wie es funktioniert

- `.github/workflows/pages.yml`: läuft bei Push auf `main` oder per Hand, baut die Seite und veröffentlicht sie.
- `tools/build-pages.sh`: kopiert `web/` nach `_site/` (oder legt die Platzhalterseite an), ergänzt `.nojekyll` und `version.txt`.
- `tools/check-pages.sh`: sucht absolute Pfade und Verweise auf Dateien, die es nicht gibt.

Nur `web/` wird veröffentlicht. Konzepte (`docs/`) und Skripte (`skripte/`) bleiben im Repo, landen aber nicht auf der Seite.

## Wenn nichts veröffentlicht wird

- **Läufe stehen ewig auf "Queued", Jobs starten nicht:** Meist liegt es an der Abrechnung des Accounts, nicht am Repo. Unter https://github.com/settings/billing/budgets prüfen, ob ein Actions-Budget von 0 Dollar alles stoppt, und unter https://github.com/settings/billing/usage nachsehen, welches (private) Repo den Actions-Speicher füllt. Dort alte Artefakte und Caches löschen.
- **"pages build and deployment" bricht mit startup_failure ab:** Die Pages-Quelle steht noch auf "Deploy from a branch". Auf **GitHub Actions** umstellen (siehe oben).
- Der Workflow läuft nur, wenn sich `web/`, die beiden Skripte in `tools/` oder der Workflow selbst ändern. Bei vielen Merges kurz hintereinander wird nur der neueste Stand veröffentlicht, ältere Läufe werden abgebrochen.
