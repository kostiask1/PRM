@echo off
cd /d %~dp0

echo Starting Node server...
start cmd /k npm start

echo Waiting for server to start...
timeout /t 3 > nul

echo Opening browser...
start http://localhost:3000

exit