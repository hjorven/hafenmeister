#!/usr/bin/env bash
# Prueft, ob jede Datei aus der Liste MODULES in web/js/main.js existiert.
# Fehlende Dateien laedt der Browser mit 404. Aufruf im Repo-Ordner:
#   bash tools/check-modules.sh
set -euo pipefail
main="web/js/main.js"
fehler=0
while read -r m; do
  if [ ! -f "web/js/${m#./}" ]; then
    echo "FEHLER: $main laedt \"$m\", die Datei web/js/${m#./} gibt es nicht."
    fehler=1
  fi
done < <(sed -n '/^const MODULES = \[/,/^\];/p' "$main" | grep -o "'\./[^']*'" | tr -d "'")
if [ "$fehler" -eq 0 ]; then echo "Alle Module aus MODULES sind vorhanden."; fi
exit "$fehler"
