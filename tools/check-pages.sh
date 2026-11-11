#!/usr/bin/env bash
# Prüft, ob die Seite unter https://hjorven.github.io/hafenmeister/ funktioniert:
# Die Seite liegt in einem Unterordner, darum brechen Pfade, die mit "/" beginnen.
# Aufruf: bash tools/check-pages.sh [Ordner]   (Standard: web)
set -euo pipefail
dir="${1:-web}"

if [ ! -d "$dir" ]; then
  echo "Ordner $dir gibt es nicht, nichts zu prüfen."
  exit 0
fi

fehler=0

# 1. Pflichtdatei
if [ ! -f "$dir/index.html" ]; then
  echo "FEHLER: $dir/index.html fehlt."
  fehler=1
fi

# 2. Absolute Pfade in HTML, CSS, JS und JSON
#    erfasst: src="/x", href="/x", url(/x), import ... "/x", fetch("/x"), "start_url": "/"
#    erlaubt: "//cdn..." und "https://..."
muster='(src|href|action|poster)=["'"'"']/[^/]|url\(["'"'"']?/[^/]|(from|import)[[:space:]]*\(?["'"'"']/[^/]|fetch\(["'"'"']/[^/]|"(start_url|scope)"[[:space:]]*:[[:space:]]*"/'
treffer=$(grep -RInE --include='*.html' --include='*.css' --include='*.js' --include='*.mjs' \
          --include='*.json' --include='*.webmanifest' "$muster" "$dir" || true)
if [ -n "$treffer" ]; then
  echo "FEHLER: Absolute Pfade gefunden. Auf GitHub Pages zeigen sie auf hjorven.github.io/ statt auf /hafenmeister/."
  echo "Bitte relativ schreiben, z.B. \"js/main.js\" oder \"./\" statt \"/js/main.js\" oder \"/\"."
  echo "$treffer"
  fehler=1
fi

# 3. Groß-/Kleinschreibung: Pages unterscheidet sie, Windows und macOS meist nicht.
#    Prüft lokale Verweise aus src/href, ob die Datei genau so existiert.
while IFS= read -r zeile; do
  datei="${zeile%%:*}"
  ziel="${zeile#*:}"
  ziel="${ziel#*=}"; ziel="${ziel#[\"\']}"; ziel="${ziel%[\"\']}"
  ziel="${ziel%%\?*}"; ziel="${ziel%%#*}"
  case "$ziel" in ''|/*|http*|//*|data:*|mailto:*|\#*|javascript:*) continue ;; esac
  basis="$(dirname "$datei")"
  if [ ! -e "$basis/$ziel" ]; then
    echo "FEHLER: $datei verweist auf \"$ziel\", die Datei gibt es nicht (Schreibweise prüfen)."
    fehler=1
  fi
done < <(grep -RHoE --include='*.html' '(src|href)="[^"]+"' "$dir" || true)

if [ "$fehler" -ne 0 ]; then
  exit 1
fi
echo "Pfade in $dir sind in Ordnung."
