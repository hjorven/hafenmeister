#!/usr/bin/env bash
# Alle Pruefungen mit einem Befehl, vor jedem Merge auszufuehren (im Hauptordner des Repos):
#
#   bash tests/pruefen.sh
#
# 1. Pfade fuer GitHub Pages (tools/check-pages.sh)
# 2. Tests ohne Browser (node --test tests/*.test.mjs)
# 3. Browser-Tests auf Handy, Tablet und PC (Playwright, tests/specs/)
#
# Weitere Argumente gehen an Playwright, z. B. nur ein Geraet:
#   bash tests/pruefen.sh --project=pc
# Nur die schnellen Pruefungen ohne Browser:
#   bash tests/pruefen.sh --ohne-browser
set -euo pipefail
cd "$(dirname "$0")/.."

ohne_browser=0
args=()
for a in "$@"; do
  if [ "$a" = "--ohne-browser" ]; then ohne_browser=1; else args+=("$a"); fi
done

echo "== 1/3 Pfade für GitHub Pages"
bash tools/check-pages.sh web

echo "== 2/3 Tests ohne Browser"
shopt -s nullglob
dateien=(tests/*.test.mjs)
if [ ${#dateien[@]} -gt 0 ]; then
  node --test "${dateien[@]}"
else
  echo "Keine tests/*.test.mjs vorhanden."
fi

if [ "$ohne_browser" = 1 ]; then
  echo "Browser-Tests übersprungen (--ohne-browser)."
  exit 0
fi

echo "== 3/3 Browser-Tests (Handy, Tablet, PC)"
cd tests
# Abhaengigkeiten nur installieren, wenn sie fehlen oder package-lock.json neuer ist
if [ ! -d node_modules ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  npm ci --no-audit --no-fund
fi
# Chromium nur laden, wenn Playwright keinen passenden findet (in Claude-Containern vorinstalliert)
if ! node -e "const { chromium } = require('@playwright/test'); require('fs').accessSync(chromium.executablePath())" 2>/dev/null; then
  npx playwright install chromium
fi
# Alten Testserver auf dem Standardport beenden (z. B. nach einem abgebrochenen Lauf)
pkill -f "node server.mjs 4173" 2>/dev/null || true
# Jedes Mal ein freier Port und ein frisch gebauter Server, nie ein alter Server mit altem Stand
HM_TEST_PORT=$(node -e "const s=require('net').createServer();s.listen(0,'127.0.0.1',()=>{console.log(s.address().port);s.close()})")
export HM_TEST_PORT
echo "Testserver auf Port $HM_TEST_PORT"
npx playwright test "${args[@]}"
echo "Alles grün. Bildschirmfotos: tests/bildschirmfotos/, Bericht: cd tests && npx playwright show-report bericht"
