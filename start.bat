@echo off
REM Double-click me. Starts a local server and opens the game.
cd /d "%~dp0"
set PORT=8080
echo MARGIN CALL is running at http://localhost:%PORT%
echo Leave this window open while you play. Press Ctrl+C to stop.
start "" http://localhost:%PORT%
py -3 -m http.server %PORT% 2>nul
if errorlevel 1 python -m http.server %PORT% 2>nul
if errorlevel 1 npx --yes serve -l %PORT%
if errorlevel 1 (
  echo.
  echo Could not find Python or Node. Install either one, then run this again.
  pause
)
