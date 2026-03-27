@echo off
cd /d %~dp0

set PORT=3000

:find_port
netstat -ano | findstr /r /c:":%PORT% " | findstr LISTENING >nul
if %errorlevel% equ 0 (
    echo Port %PORT% is busy, trying %PORT%+1...
    set /a PORT+=1
    goto find_port
)

echo Starting Node server on port %PORT%...
start cmd /k "set PORT=%PORT%&& npm start"

echo Waiting for server to start...
timeout /t 3 > nul

echo Opening browser at http://localhost:%PORT%...

exit