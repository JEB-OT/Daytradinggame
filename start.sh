#!/bin/sh
# Double-click me. Starts a local server and opens the game.
cd "$(dirname "$0")" || exit 1
PORT=8080
URL="http://localhost:$PORT"

open_browser() {
  sleep 1
  if command -v open        >/dev/null 2>&1; then open "$URL"
  elif command -v xdg-open  >/dev/null 2>&1; then xdg-open "$URL" >/dev/null 2>&1
  else echo "Open $URL in your browser."
  fi
}
open_browser &

echo "MARGIN CALL is running at $URL"
echo "Leave this window open while you play. Press Ctrl+C to stop."
if   command -v python3 >/dev/null 2>&1; then exec python3 -m http.server "$PORT"
elif command -v python  >/dev/null 2>&1; then exec python  -m http.server "$PORT"
elif command -v npx     >/dev/null 2>&1; then exec npx --yes serve -l "$PORT"
else
  echo "Could not find python3 or npx. Install either one, or run any static file server in this folder."
  read -r _
fi
