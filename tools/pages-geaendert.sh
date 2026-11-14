#!/usr/bin/env bash
# Entscheidet für den Pages-Workflow, ob neu gebaut werden muss. Ausgabe: bauen=true oder bauen=false
#
#   bash tools/pages-geaendert.sh schedule            # Zeitplan: nur bei Änderungen
#   bash tools/pages-geaendert.sh workflow_dispatch   # Run workflow: immer bauen
#   git fetch origin main && bash tools/pages-geaendert.sh schedule origin/main   # lokal nachsehen
#
# Vergleicht den veröffentlichten Stand (commit in version.txt der Seite) mit HEAD, nur für die
# Dateien, aus denen die Seite entsteht. Ist version.txt nicht erreichbar oder der Commit
# unbekannt, wird sicherheitshalber gebaut. Braucht die ganze Historie (fetch-depth: 0).
set -euo pipefail
cd "$(dirname "$0")/.."

ereignis="${1:-schedule}"
kopf="${2:-HEAD}"
adresse="${HM_PAGES_URL:-https://hjorven.github.io/hafenmeister/version.txt}"
# Alles, was in _site/ landet (tools/build-pages.sh) oder den Bau steuert
pfade=(web docs/roadmap.md docs/roadmap-bilder.json tools/roadmap.mjs tools/build-pages.sh
       tools/offline-liste.mjs tools/check-pages.sh tools/pages-geaendert.sh .github/workflows/pages.yml)

if [ "$ereignis" = "workflow_dispatch" ]; then
  echo "Von Hand gestartet: es wird gebaut." >&2
  echo "bauen=true"; exit 0
fi

alt=$(curl -sSfL --max-time 20 "$adresse?t=$(date +%s)" 2>/dev/null | sed -n 's/^commit: *//p' | head -n1 || true)
if [ -z "$alt" ] || ! git cat-file -e "${alt}^{commit}" 2>/dev/null; then
  echo "Veröffentlichter Stand unbekannt (${alt:-keine version.txt}): es wird gebaut." >&2
  echo "bauen=true"; exit 0
fi

if git diff --quiet "$alt" "$kopf" -- "${pfade[@]}"; then
  echo "Seit $alt keine Änderung an der Seite: kein Bau." >&2
  echo "bauen=false"
else
  echo "Geändert seit $alt:" >&2
  git diff --stat "$alt" "$kopf" -- "${pfade[@]}" | tail -n 1 >&2
  echo "bauen=true"
fi
