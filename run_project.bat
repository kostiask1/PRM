@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

set "APP_PORT=5000"
if not "%PORT%"=="" set "APP_PORT=%PORT%"

if not exist node_modules (
    echo Installing node modules...
    call npm install
    if errorlevel 1 (
        echo npm install failed. Exiting.
        pause
        exit /b 1
    )
)

set "NEEDS_BUILD=0"
if not exist dist\index.html (
    set "NEEDS_BUILD=1"
)

if "%NEEDS_BUILD%"=="0" (
    powershell -NoProfile -ExecutionPolicy Bypass ^
        "$buildTime = (Get-Item 'dist\index.html').LastWriteTimeUtc;" ^
        "$sources = @('src','server','database','data','scripts','public','index.html','package.json','package-lock.json','vite.config.js','.env');" ^
        "$newer = $false;" ^
        "foreach ($entry in $sources) {" ^
        "  if (-not (Test-Path $entry)) { continue }" ^
        "  $items = @(Get-Item $entry);" ^
        "  if ($items[0].PSIsContainer) { $items = Get-ChildItem $entry -Recurse -File -Force -ErrorAction SilentlyContinue }" ^
        "  foreach ($item in $items) {" ^
        "    if ($item.LastWriteTimeUtc -gt $buildTime) { $newer = $true; break }" ^
        "  }" ^
        "  if ($newer) { break }" ^
        "}" ^
        "if ($newer) { exit 10 } else { exit 0 }"
    if errorlevel 10 (
        set "NEEDS_BUILD=1"
    )
)

if "%NEEDS_BUILD%"=="1" (
    echo Building project...
    call npm run build
    if errorlevel 1 (
        echo Build failed. Exiting.
        pause
        exit /b 1
    )
) else (
    echo Using existing build from dist\
)

echo Starting production server...
start "PRM Production" cmd /k "cd /d ""%~dp0"" && npm run start:prod"

echo Waiting for server to start...
timeout /t 3 > nul

echo Opening browser at http://localhost:%APP_PORT%...
start "" "http://localhost:%APP_PORT%/"

endlocal
exit /b 0
