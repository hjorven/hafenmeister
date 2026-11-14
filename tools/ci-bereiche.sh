#!/usr/bin/env bash
# Entscheidet, welche Prüfungen ein Pull Request braucht. Ausgabe für $GITHUB_OUTPUT:
#   nur_doku=true   wenn nur Doku geändert wurde (docs/, *.md im Hauptordner, Dependabot, .gitleaksignore)
#   nur_doku=false  sonst (dann laufen alle Browser-Tests und alle Tests ohne Browser)
#
#   bash tools/ci-bereiche.sh <basis-commit> <pr-commit>
#   bash tools/ci-bereiche.sh origin/main HEAD     # lokal: was würde der PR prüfen?
#
# Im Zweifel (Commit unbekannt, keine Dateien) gilt nur_doku=false: lieber zu viel prüfen.
set -euo pipefail
cd "$(dirname "$0")/.."

basis="${1:-origin/main}"
kopf="${2:-HEAD}"

if ! dateien=$(git diff --name-only "$basis...$kopf" 2>/dev/null) || [ -z "$dateien" ]; then
  echo "Änderungen nicht bestimmbar: alles wird geprüft." >&2
  echo "nur_doku=false"; exit 0
fi

andere=$(printf '%s\n' "$dateien" | grep -Ev '^(docs/.*|[^/]+\.md|\.github/dependabot\.yml|\.gitleaksignore)$' || true)
if [ -z "$andere" ]; then
  echo "Nur Doku geändert ($(printf '%s\n' "$dateien" | wc -l) Dateien): keine Browser-Tests." >&2
  echo "nur_doku=true"
else
  echo "Spiel, Tests oder Werkzeuge geändert, z. B. $(printf '%s\n' "$andere" | head -n 3 | tr '\n' ' ')" >&2
  echo "nur_doku=false"
fi
