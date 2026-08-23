#!/bin/bash
# ============================================================
# Digital Signage Player - Electron App
# Usage: chmod +x kiosk.sh && ./kiosk.sh
# ============================================================

echo ""
echo "=========================================="
echo " Digital Signage Player"
echo "=========================================="
echo ""
echo " URL: https://display.rizki-tech.com/player"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# --- Cek Node.js ---
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js tidak ditemukan!"
    echo "Install dari: https://nodejs.org"
    exit 1
fi

# --- Cek apakah node_modules sudah ada ---
if [ ! -d "node_modules" ]; then
    echo "Install dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "[ERROR] Gagal install!"
        exit 1
    fi
fi

echo "Menjalankan Player..."
echo ""

# --- Jalankan Electron ---
npx electron .
