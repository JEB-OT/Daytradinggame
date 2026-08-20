@echo off
REM Double-click me. Starts the game server and opens your browser.
cd /d "%~dp0"

echo Starting MARGIN CALL...
where node >nul 2>nul
if %errorlevel%==0 (
  node server.js
  goto :eof
)

set PORT=8080
echo MARGIN CALL is running at http://localhost:%PORT%
echo Leave this window open while you play. Press Ctrl+C to stop.
start "" http://localhost:%PORT%
py -3 -m http.server %PORT% 2>nul && goto :eof
python -m http.server %PORT% 2>nul && goto :eof
echo.
echo Could not find Node or Python. Install Node from https://nodejs.org and run this again.
pause
