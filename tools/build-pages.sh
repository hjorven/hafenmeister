#!/usr/bin/env bash
# Stellt die Pages-Seite in _site/ zusammen.
# Liegt das Spiel in web/, wird web/ unverändert kopiert.
# Fehlt web/index.html noch, entsteht eine Platzhalterseite.
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf _site
mkdir -p _site

if [ -f web/index.html ]; then
  cp -R web/. _site/
else
  echo "web/index.html fehlt, es wird eine Platzhalterseite veröffentlicht."
  cat > _site/index.html <<'HTML'
<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Hafenmeister</title>
  <style>
    html, body { margin: 0; height: 100%; }
    body { display: grid; place-items: center; background: #dcebf2; color: #16324a;
           font: 18px/1.5 system-ui, sans-serif; text-align: center; padding: 16px; box-sizing: border-box; }
    h1 { margin: 0 0 8px; }
  </style>
</head>
<body>
  <main>
    <h1>Hafenmeister</h1>
    <p>Das Spiel ist im Bau. Bald legen hier die ersten Boote an.</p>
  </main>
</body>
</html>
HTML
fi

# Kein Jekyll: Dateien und Ordner mit Unterstrich bleiben erhalten.
touch _site/.nojekyll

# Stand der Veröffentlichung, hilfreich zum Prüfen im Browser (version.txt).
{
  echo "commit: $(git rev-parse --short HEAD 2>/dev/null || echo unbekannt)"
  echo "zeit: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
} > _site/version.txt

echo "Fertig: $(find _site -type f | wc -l) Dateien in _site/"
