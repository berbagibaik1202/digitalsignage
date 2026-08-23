#!/bin/bash
# ============================================================
# Digital Signage Player (Kiosk Mode) - Linux
# Usage: chmod +x kiosk.sh && ./kiosk.sh
# ============================================================

PLATFORM_URL="https://display.rizki-tech.com/player"

echo ""
echo "=========================================="
echo " Digital Signage Player (Kiosk Mode)"
echo "=========================================="
echo " URL: $PLATFORM_URL"
echo "=========================================="
echo ""
echo "Tekan Ctrl+C untuk keluar dari kiosk mode"
echo ""

# --- Cari browser ---
BROWSER=""

if command -v google-chrome &> /dev/null; then
    BROWSER="google-chrome"
elif command -v google-chrome-stable &> /dev/null; then
    BROWSER="google-chrome-stable"
elif command -v chromium-browser &> /dev/null; then
    BROWSER="chromium-browser"
elif command -v chromium &> /dev/null; then
    BROWSER="chromium"
elif command -v firefox &> /dev/null; then
    BROWSER="firefox"
elif command -v microsoft-edge &> /dev/null; then
    BROWSER="microsoft-edge"
fi

if [ -z "$BROWSER" ]; then
    echo "[ERROR] Tidak ditemukan browser!"
    echo "Install Chrome, Chromium, atau Firefox."
    exit 1
fi

echo "Browser: $BROWSER"
echo ""

# --- Jalankan kiosk mode ---
if [[ "$BROWSER" == *"chrome"* ]] || [[ "$BROWSER" == *"chromium"* ]]; then
    "$BROWSER" --kiosk --no-first-run --disable-session-crashed-bubble --disable-infobars --disable-extensions --disable-translate --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-renderer-backgrounding "$PLATFORM_URL"
elif [[ "$BROWSER" == *"firefox"* ]]; then
    "$BROWSER" --kiosk "$PLATFORM_URL"
else
    "$BROWSER" --kiosk "$PLATFORM_URL"
fi
