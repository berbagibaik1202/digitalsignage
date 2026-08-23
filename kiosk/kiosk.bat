@echo off
REM ============================================================
REM Digital Signage Kiosk Browser - Windows
REM Usage: Double-click kiosk.bat atau jalankan dari CMD
REM ============================================================

set PLATFORM_URL=https://display.rizki-tech.com
set BROWSER=""
set FOUND=0

REM --- Cari Chrome ---
where chrome.exe >nul 2>&1 && (
    set "BROWSER=chrome.exe"
    set FOUND=1
)

if %FOUND%==0 (
    if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
        set "BROWSER=C:\Program Files\Google\Chrome\Application\chrome.exe"
        set FOUND=1
    )
)

if %FOUND%==0 (
    if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
        set "BROWSER=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
        set FOUND=1
    )
)

REM --- Cari Edge ---
if %FOUND%==0 (
    where msedge.exe >nul 2>&1 && (
        set "BROWSER=msedge.exe"
        set FOUND=1
    )
)

if %FOUND%==0 (
    if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
        set "BROWSER=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
        set FOUND=1
    )
)

REM --- Cari Firefox ---
if %FOUND%==0 (
    where firefox.exe >nul 2>&1 && (
        set "BROWSER=firefox.exe"
        set FOUND=1
    )
)

if %FOUND%==0 (
    echo.
    echo [ERROR] Tidak ditemukan browser!
    echo Install Chrome, Edge, atau Firefox terlebih dahulu.
    echo.
    pause
    exit /b 1
)

echo.
echo ==========================================
echo  Digital Signage Kiosk Browser
echo ==========================================
echo  URL    : %PLATFORM_URL%
echo  Browser: %BROWSER%
echo ==========================================
echo.
echo Tekan Ctrl+C untuk keluar dari kiosk mode
echo.

REM --- Jalankan dalam kiosk mode ---
if "%BROWSER%"=="chrome.exe" (
    "%BROWSER%" --kiosk --no-first-run --disable-session-crashed-bubble --disable-infobars --disable-extensions --disable-translate --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-renderer-backgrounding "%PLATFORM_URL%"
) else if "%BROWSER%"=="msedge.exe" (
    "%BROWSER%" --kiosk --no-first-run --disable-session-crashed-bubble --disable-infobars --disable-translate "%PLATFORM_URL%"
) else (
    "%BROWSER%" --kiosk "%PLATFORM_URL%"
)
