#!/usr/bin/env bash
# Kopiuje skille z repozytorium do ~/.claude/skills (nadpisuje istniejące wersje).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p ~/.claude/skills
for s in skille/*/; do
  n=$(basename "$s")
  rsync -a --delete "$s" ~/.claude/skills/"$n"/
  echo "zainstalowano: ~/.claude/skills/$n"
done
