#!/bin/sh
# Double-click me. Starts the game server and opens your browser.
cd "$(dirname "$0")" || exit 1

echo "Starting MARGIN CALL..."
if command -v node >/dev/null 2>&1; then
  exec node server.js
fi

# No Node? Fall back to Python, and open the browser ourselves.
PORT=8080
URL="http://localhost:$PORT"
( sleep 1
  if command -v open       >/dev/null 2>&1; then open "$URL"
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL" >/dev/null 2>&1
  fi ) &
echo "MARGIN CALL is running at $URL"
echo "Leave this window open while you play. Press Ctrl+C to stop."
if   command -v python3 >/dev/null 2>&1; then exec python3 -m http.server "$PORT"
elif command -v python  >/dev/null 2>&1; then exec python  -m http.server "$PORT"
else
  echo ""
  echo "Could not find Node or Python. Install Node from https://nodejs.org and run this again."
  read -r _
fi
