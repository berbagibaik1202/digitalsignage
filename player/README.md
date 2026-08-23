# Digital Signage Player

Display client untuk menampilkan konten digital signage di TV/Monitor.

## Fitur

- **Auto-register** device ke backend
- **Playlist playback** dengan loop
- **Heartbeat** untuk monitoring status device
- **Command handling** (reboot, reload, screenshot)
- **Fullscreen kiosk mode** (tanpa cursor, tanpa taskbar)
- **Setup screen** untuk konfigurasi pertama kali

## Cara Jalankan (Development)

```bash
cd player
npm install
npm run dev
```

Buka http://localhost:5174

## Cara Build (Electron)

```bash
cd player
npm install
npm run build
```

Output ada di folder `release/`

## Cara Build (Web Only)

```bash
cd player
npm install
npm run build:web
```

Output ada di folder `dist/` — bisa di-deploy ke web server biasa.

## Setup di TV/Monitor

### Opsi 1: Browser Mode (Paling Mudah)

1. Buka browser di TV/Monitor
2. Masukkan URL: `http://your-server.com/player.html`
3. Tekan F11 untuk fullscreen

### Opsi 2: Electron App

1. Install Electron app di TV/Monitor
2. Jalankan aplikasi
3. Masukkan Server URL dan Registration Token

### Opsi 3: Kiosk Mode (Chrome)

```bash
# Jalankan Chrome dalam kiosk mode
google-chrome --kiosk --no-first-run --disable-session-crashed-bubble http://your-server.com
```

## Registration Token

Registration token dapat dilihat di:
- Dashboard → Devices → Registration Token
- Atau buat baru via API: `POST /api/v1/tenants`

## Flow

```
1. Buka Player
   │
2. Setup Screen
   ├── Masukkan Server URL
   ├── Masukkan Registration Token
   └── Klik "Hubungkan"
   │
3. Auto Register → POST /player/register
   │
4. Auto Auth → POST /player/auth
   │
5. Playing Loop
   ├── GET /player/manifest (setiap 60 detik)
   ├── Play media
   ├── POST /player/playback (START/END)
   ├── POST /player/heartbeat (setiap 30 detik)
   └── GET /player/commands (setiap 10 detik)
```

## Keyboard Shortcuts

| Key | Fungsi |
|---|---|
| `I` | Toggle device info panel |
| `Esc` | Close info panel |
| `F11` | Toggle fullscreen (browser) |
