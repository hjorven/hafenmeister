#!/usr/bin/env bash
# Tests ohne Browser (node --test). Im Hauptordner des Repos:
#
#   bash tests/node-tests.sh                 # alle tests/*.test.mjs
#   bash tests/node-tests.sh --ohne-langsame # ohne die langen Simulationen (für reine Doku-Änderungen)
#
# Die langen Simulationen (Stand 14.11.2026, 4 Kerne) prüfen nur Spielcode in web/, keine Doku.
# fahrwasser.test.mjs allein braucht rund 4,5 Minuten.
set -euo pipefail
cd "$(dirname "$0")/.."

LANGSAM="fahrwasser zonen gelaendeform gelaende-vielfalt besuchswege balance"

shopt -s nullglob
dateien=(tests/*.test.mjs)
if [ "${1:-}" = "--ohne-langsame" ]; then
  auswahl=()
  for d in "${dateien[@]}"; do
    name=$(basename "$d" .test.mjs)
    case " $LANGSAM " in *" $name "*) ;; *) auswahl+=("$d") ;; esac
  done
  dateien=("${auswahl[@]}")
  echo "Ohne die langen Simulationen ($LANGSAM)."
fi
if [ ${#dateien[@]} -eq 0 ]; then echo "Keine tests/*.test.mjs vorhanden."; exit 0; fi
node --test "${dateien[@]}"
