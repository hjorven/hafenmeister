#!/usr/bin/env bash
# Legt Three.js ins Spiel (web/vendor/three-<Version>/), damit das Spiel ohne fremden Server startet.
# Quelle ist tests/node_modules/three (Version aus tests/package.json, dort ändern zum Aktualisieren).
# Kopiert werden nur die Dateien, die das Spiel braucht: build/three.module.js, build/three.core.js
# und jedes Zusatzmodul, das irgendwo in web/ als 'three/addons/...' eingebunden ist.
#
# Aufruf (im Hauptordner des Repos):
#   bash tools/three-holen.sh
# Danach die Importmaps in web/**/*.html auf den neuen Ordner stellen (der Test
# tests/offline.test.mjs meldet jede Seite, die noch auf einen alten Ordner zeigt).
set -euo pipefail
cd "$(dirname "$0")/.."

quelle=tests/node_modules/three
if [ ! -f "$quelle/package.json" ]; then
  (cd tests && npm ci --no-audit --no-fund)
fi
version=$(node -p "require('./$quelle/package.json').version")
ziel="web/vendor/three-$version"

rm -rf web/vendor/three-*
mkdir -p "$ziel/build"
cp "$quelle/LICENSE" "$ziel/LICENSE"
cp "$quelle/build/three.module.js" "$quelle/build/three.core.js" "$ziel/build/"

# Zusatzmodule: alle 'three/addons/<pfad>' aus dem Spielcode
grep -RhoE --include='*.js' --include='*.html' "three/addons/[A-Za-z0-9_./-]+\.js" web \
  | sed 's|three/addons/||' | sort -u | while read -r rel; do
  [ -f "$quelle/examples/jsm/$rel" ] || { echo "FEHLER: three/addons/$rel gibt es in Three.js $version nicht."; exit 1; }
  mkdir -p "$ziel/examples/jsm/$(dirname "$rel")"
  cp "$quelle/examples/jsm/$rel" "$ziel/examples/jsm/$rel"
  # Zusatzmodule dürfen nur 'three' oder andere Zusatzmodule laden, die dann ebenfalls fehlen würden
  if grep -qE "from '\.\.?/" "$ziel/examples/jsm/$rel"; then
    echo "FEHLER: three/addons/$rel lädt weitere Zusatzdateien, bitte das Skript erweitern."; exit 1
  fi
done

echo "Three.js $version liegt in $ziel ($(du -sh "$ziel" | cut -f1))."
