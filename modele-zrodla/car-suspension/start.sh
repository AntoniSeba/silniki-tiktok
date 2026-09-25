#!/bin/bash
# Uruchamia lokalny serwer i otwiera model zawieszenia w przeglądarce.
# Model jest modułowy (ES modules), więc musi iść przez HTTP, nie z pliku.
cd "$(dirname "$0")" || exit 1
PORT=8126
if ! curl -s -o /dev/null "http://localhost:$PORT/index.html"; then
  (python3 -m http.server "$PORT" >/dev/null 2>&1 &)
  sleep 1
fi
echo "Zawieszenie 3D: http://localhost:$PORT/index.html"
open "http://localhost:$PORT/index.html"
