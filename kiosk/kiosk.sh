#!/bin/bash
# ============================================================
# Digital Signage Player - Launch Electron App
# Usage: chmod +x kiosk.sh && ./kiosk.sh
# ============================================================

echo ""
echo "=========================================="
echo " Digital Signage Player"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# --- Cek apakah player sudah di-install ---
if [ -f "release/Digital Signage Player" ]; then
    echo "Menjalankan Electron Player..."
    ./release/"Digital Signage Player"
    exit 0
fi

if [ -f "node_modules/.bin/electron" ]; then
    echo "Menjalankan Electron Player (dev mode)..."
    npx electron .
    exit 0
fi

# --- Fallback: install dulu ---
echo "Player belum di-install."
echo "Menjalankan npm install..."
npm install

if [ $? -ne 0 ]; then
    echo ""
    echo "[ERROR] Gagal install dependencies!"
    exit 1
fi

echo ""
echo "Menjalankan Player..."
npx electron .
