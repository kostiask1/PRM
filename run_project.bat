@echo off
cd /d %~dp0

REM Перевірка наявності папки node_modules
IF NOT EXIST node_modules (
    echo Папку node_modules не знайдено. Запускаємо npm install...
    call npm i
    IF %ERRORLEVEL% NEQ 0 (
        echo npm install завершився з помилкою. Вихід.
        pause
        exit /b 1
    )
)

start cmd /k "npm start"

echo Waiting for server to start...
timeout /t 3 > nul

echo Opening browser at http://localhost:%PORT%...

exit