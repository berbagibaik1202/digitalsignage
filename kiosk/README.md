# Digital Signage Kiosk Browser

Aplikasi untuk menjalankan display player dalam mode kiosk (fullscreen tanpa UI browser).

## Cara Pakai

### Opsi 1: Script Batch (Windows) — Paling Cepat

1. Double-click `kiosk.bat`
2. Browser otomatis buka dalam kiosk mode

### Opsi 2: Script Bash (Linux)

```bash
chmod +x kiosk.sh
./kiosk.sh
```

### Opsi 3: Electron App (Recommended untuk Production)

```bash
# Install
npm install

# Jalankan
npm start

# Build installer
npm run build:win    # Windows
npm run build:linux  # Linux
```

### Opsi 4: Chrome Kiosk Manual

```bash
# Windows
"C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk https://display.rizki-tech.com

# Linux
google-chrome --kiosk https://display.rizki-tech.com
```

## Konfigurasi

### Ganti URL

Edit file `kiosk.bat` atau `kiosk.sh`, ubah baris:

```
PLATFORM_URL=https://display.rizki-tech.com
```

Atau set environment variable:

```bash
# Windows
set PLATFORM_URL=https://your-domain.com
kiosk.bat

# Linux
PLATFORM_URL=https://your-domain.com ./kiosk.sh
```

### Auto-Start saat Boot

**Windows:**
1. Copy `kiosk.bat` ke folder Startup:
   ```
   %APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
   ```

**Linux (systemd):**
```bash
sudo tee /etc/systemd/system/signage-kiosk.service << 'EOF'
[Unit]
Description=Digital Signage Kiosk Browser
After=graphical.target

[Service]
Type=simple
ExecStart=/usr/bin/google-chrome --kiosk --no-first-run https://display.rizki-tech.com
Restart=always
RestartSec=5
User=your-username
Environment=DISPLAY=:0

[Install]
WantedBy=graphical.target
EOF

sudo systemctl enable signage-kiosk
sudo systemctl start signage-kiosk
```

**Raspberry Pi (autostart):**
```bash
# Add to ~/.config/lxsession/LXDE/autostart
@xset s off
@xset -dpms
@xset s noblank
@chromium-browser --kiosk --no-first-run https://display.rizki-tech.com
```

## Fitur

- ✅ Fullscreen kiosk mode
- ✅ Hide cursor
- ✅ No taskbar/panel
- ✅ Auto-restart on crash
- ✅ Auto-retry on connection error
- ✅ Prevent new windows/tabs
- ✅ Black background (no flash)
- ✅ Cross-platform (Windows/Linux/Mac)
