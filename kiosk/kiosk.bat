@echo off
REM ============================================================
REM Digital Signage Player - Launch Electron App
REM Usage: Double-click kiosk.bat
REM ============================================================

echo.
echo ==========================================
echo  Digital Signage Player
echo ==========================================
echo.

REM --- Cek apakah player sudah di-install ---
if exist "release\Digital Signage Player.exe" (
    echo Menjalankan Electron Player...
    start "" "release\Digital Signage Player.exe"
    exit /b 0
)

if exist "node_modules\.bin\electron" (
    echo Menjalankan Electron Player (dev mode)...
    npx electron .
    exit /b 0
)

REM --- Fallback: install dulu ---
echo Player belum di-install.
echo Menjalankan npm install...
call npm install

if errorlevel 1 (
    echo.
    echo [ERROR] Gagal install dependencies!
    echo.
    pause
    exit /b 1
)

echo.
echo Menjalankan Player...
npx electron .
