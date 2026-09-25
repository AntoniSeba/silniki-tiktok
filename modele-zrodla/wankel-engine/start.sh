#!/bin/bash
# Uruchamia lokalny serwer i otwiera model silnika Wankla 13B.
cd "$(dirname "$0")" || exit 1
PORT=8127
if ! curl -s -o /dev/null "http://localhost:$PORT/index.html"; then
  (python3 -m http.server "$PORT" >/dev/null 2>&1 &)
  sleep 1
fi
echo "Wankel 13B: http://localhost:$PORT/index.html"
open "http://localhost:$PORT/index.html"
