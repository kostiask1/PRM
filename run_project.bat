@echo off
cd /d %~dp0

start cmd /k "npm start"

echo Waiting for server to start...
timeout /t 3 > nul

echo Opening browser at http://localhost:%PORT%...

exit