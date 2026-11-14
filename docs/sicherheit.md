# Sicherheit der GitHub Actions

Stand: 14.11.2026. Status: gebaut (Audit C07, Paket P08-Rest).

## Regeln für alle Workflows in `.github/workflows/`

1. **Keine Rechte auf Workflow-Ebene.** Jeder Workflow beginnt mit `permissions: {}`. Jeder Job nennt selbst, was er braucht:
   - `pages.yml`: Build nur `contents: read`; nur der Deploy-Job hat `pages: write` und `id-token: write`.
   - `roadmap.yml`: der eine Job hat `contents: write`, weil er die Übersicht auf `main` committet.
   - `tests.yml`, `secret-scan.yml`: nur `contents: read`; der Sammel-Check `spiel` hat gar keine Rechte.
2. **Actions auf Commit-SHAs gepinnt**, die Version steht als Kommentar dahinter, zum Beispiel
   `actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0`. Ein Tag wie `@v4` kann nachträglich umgehängt werden, ein SHA nicht.
3. **`persist-credentials: false`** beim Checkout überall, wo nicht gepusht wird. Nur `roadmap.yml` behält das Token, weil es pusht.
4. **`timeout-minutes`** an jedem Job.
5. **Keine `${{ ... }}`-Ausdrücke aus fremden Eingaben** (PR-Titel, Branch-Namen, Kommentare) direkt in `run:`. Heute stehen dort nur feste Matrix-Werte und Job-Ergebnisse.

## Neue Action oder neue Version einbinden

SHA zu einem Tag holen (bei annotierten Tags zeigt `^{}` auf den Commit):

```bash
git ls-remote https://github.com/actions/checkout 'refs/tags/v4.4.0' 'refs/tags/v4.4.0^{}'
```

Die letzte Zeile ist der Commit. Eintragen als `uses: <owner>/<name>@<SHA> # <Tag>`.

Dependabot (`.github/dependabot.yml`) schlägt einmal im Monat einen gesammelten PR mit neuen SHAs für Minor- und Patch-Versionen vor. Major-Sprünge (zum Beispiel `checkout` v4 auf v5) macht ein Thread bewusst von Hand und prüft danach Pages und Roadmap-Action.

## Secret-Scan

`secret-scan.yml` lädt `gitleaks` in fester Version, prüft die SHA-256-Summe und durchsucht die ganze Git-Historie: bei jedem Pull Request, bei jedem Push auf `main`, montags früh und per Hand. Gefundene Werte erscheinen im Log geschwärzt.

Bei einem Fund:

1. Echter Schlüssel: sofort beim Anbieter sperren und neu ausstellen. Aus der Historie löschen allein reicht nicht, der Wert ist schon öffentlich.
2. Falscher Alarm (zum Beispiel Testdaten): den `Fingerprint` aus dem Log als eigene Zeile in `.gitleaksignore` im Hauptordner eintragen.

gitleaks auf eine neue Version heben: Version und Summe aus `gitleaks_<version>_checksums.txt` des Releases in `GITLEAKS_VERSION` und `GITLEAKS_SHA256` eintragen.

## Nicht in diesem Paket

CSP und Sicherheits-Header der Seite, `SECURITY.md` mit Meldeweg (sobald das Spiel öffentlich genutzt wird) und das Sicherheitsreview vor dem Online-Start (C08, P58) bleiben offen, siehe [roadmap.md](roadmap.md).
