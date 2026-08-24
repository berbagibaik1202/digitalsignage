@echo off
REM ============================================================
REM Digital Signage Player - Electron App
REM Usage: Double-click kiosk.bat
REM ============================================================

echo.
echo ==========================================
echo  Digital Signage Player
echo ==========================================
echo.
echo  URL: https://display.rizki-tech.com/player
echo ==========================================
echo.

pushd "%~dp0"

REM --- Cek Node.js ---
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js tidak ditemukan!
    echo Install dari: https://nodejs.org
    pause
    exit /b 1
)

REM --- Cek apakah node_modules sudah ada ---
if not exist "node_modules" (
    echo Install dependencies...
    call npm install
    if errorlevel 1 (
        echo [ERROR] Gagal install!
        pause
        exit /b 1
    )
)

echo Menjalankan Player...
echo.

REM --- Jalankan Electron ---
npx electron .
popd
