# 🖥️ Digital Signage SaaS Platform

Platform manajemen konten digital signage berbasis SaaS dengan arsitektur multi-tenant.

**Stack:** Node.js + TypeScript + Express + MySQL + Redis + MinIO + React + Tailwind

![License](https://img.shields.io/badge/license-MIT-blue)
![Node.js](https://img.shields.io/badge/node-%3E%3D20-green)
![TypeScript](https://img.shields.io/badge/typescript-5.9-blue)

---

## ✨ Fitur

- **Multi-Tenant** — Setiap tenant terisolasi (data, user, device)
- **Device Management** — Registrasi, monitoring, dan kontrol device dari dashboard
- **Media Library** — Upload, preview, dan manage file (image/video/audio)
- **Playlist Management** — Buat dan kelola urutan playback
- **Scheduling** — Jadwalkan konten berdasarkan waktu dan hari
- **Layout Management** — Atur tampilan zone di layar
- **Realtime Monitoring** — WebSocket untuk status device live
- **Command Queue** — Kirim command ke device (reboot, screenshot, reload)
- **Subscription Management** — Kelola plan dan limit tenant
- **Audit Logging** — Log semua operasi write untuk keamanan
- **Player API** — REST API lengkap untuk display player
- **Docker Ready** —部署 dengan satu command

---

## 📁 Struktur Project

```
digitalsignage/
├── docker-compose.yml          # Docker orchestration
├── package.json                # Root scripts
├── .env.example                # Environment template
├── scripts/
│   ├── setup-env.js            # Auto-generate credential
│   ├── setup-env.sh            # Bash version
│   └── setup-env.ps1           # PowerShell version
│
├── backend/                    # Node.js API Server
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── migrations/             # 21 SQL migration files
│   └── src/
│       ├── config/             # Environment config
│       ├── database/           # MySQL connection + migration runner
│       ├── middleware/          # Auth, tenant, permission, audit
│       ├── modules/            # 14 API modules
│       │   ├── auth/           # Register, login, refresh token
│       │   ├── tenants/        # Tenant CRUD
│       │   ├── users/          # User CRUD
│       │   ├── devices/        # Device management
│       │   ├── media/          # Media upload/download (MinIO)
│       │   ├── playlists/      # Playlist management
│       │   ├── schedules/      # Schedule management
│       │   ├── layouts/        # Layout + zone management
│       │   ├── commands/       # Command queue
│       │   ├── monitoring/     # Playback logs, screenshots, stats
│       │   ├── subscriptions/  # Plans + subscriptions
│       │   ├── player/         # Player API (register, manifest, heartbeat)
│       │   ├── admin/          # Super admin panel
│       │   └── health/         # Health check endpoint
│       ├── realtime/           # Socket.IO WebSocket
│       ├── services/           # Storage (MinIO), media processor
│       ├── workers/            # BullMQ worker (media processing)
│       └── utils/              # Logger
│
└── frontend/                   # React Dashboard
    ├── Dockerfile
    ├── nginx.conf              # Nginx config for production
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── components/         # DashboardLayout
        ├── lib/                # API client, WebSocket, utils
        └── pages/              # 13 pages
            ├── LoginPage.tsx
            ├── DashboardPage.tsx
            ├── DevicesPage.tsx
            ├── MediaPage.tsx
            ├── PlaylistsPage.tsx
            ├── LayoutsPage.tsx
            ├── SchedulesPage.tsx
            ├── MonitoringPage.tsx
            ├── SubscriptionsPage.tsx
            ├── CommandsPage.tsx
            ├── UsersPage.tsx
            ├── AdminPage.tsx
            └── SettingsPage.tsx
```

---

## 🚀 Instalasi

### Prasyarat

| Requirement | Version |
|---|---|
| Node.js | >= 20.x |
| MySQL | >= 8.x (atau MariaDB >= 10.x) |
| Redis | >= 7.x |
| MinIO | Latest |
| Docker & Docker Compose | Latest (opsional) |

---

### Opsi 1: Docker Compose (Recommended)

Cara tercepat untuk menjalankan seluruh stack.

#### 1. Install Docker & Docker Compose

```bash
# Install Docker
sudo apt update
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Verify
sudo docker --version
sudo docker compose version
```

#### 2. Clone Repository

```bash
cd /opt
sudo git clone https://github.com/berbagibaik1202/digitalsignage.git
sudo chown -R $USER:$USER /opt/digitalsignage
cd digitalsignage
```

#### 3. Generate Credential Otomatis

```bash
# Windows (PowerShell)
.\scripts\setup-env.ps1

# Windows/Linux/Mac (Node.js)
node scripts/setup-env.js

# Linux/Mac (Bash)
bash scripts/setup-env.sh
```

Script akan menghasilkan file `.env` dengan credential random yang aman.

#### 4. Jalankan Docker Compose

```bash
docker compose up -d
```

Ini akan menjalankan:
- **MySQL 8.4** — Database
- **Redis 7** — Cache & BullMQ queue
- **MinIO** — Object storage untuk media files
- **Backend** — Node.js API + WebSocket + BullMQ worker
- **Frontend** — React dashboard via Nginx

#### 5. Jalankan Database Migration

```bash
docker compose exec backend npm run migrate
```

#### 6. Selesai!

| Service | URL |
|---|---|
| **Dashboard** | http://localhost:5173 |
| **API** | http://localhost:3000/api/v1/health |
| **MinIO Console** | http://localhost:9001 |

Media uploaded through the dashboard is served from `http://localhost:9000` by default. For a VPS or custom domain, set `MINIO_PUBLIC_URL` in `.env` to the browser-accessible MinIO URL, for example `https://media.example.com`.

**Login Default:**
- Email: `admin@demo.com`
- Password: `password123`

---

### Update / Deploy Ulang

Jika ada perubahan kode, jalankan:

```bash
cd /opt/digitalsignage
git pull origin main
docker compose down
docker compose build --no-cache backend
docker compose up -d
docker compose exec backend npm run migrate
```

### Cek Status

```bash
# Lihat semua container
docker compose ps

# Lihat log backend
docker compose logs -f backend

# Lihat log frontend
docker compose logs -f frontend

# Restart semua service
docker compose restart

# Stop semua
docker compose down
```

---

### Opsi 2: Manual (Node.js + systemd)

Untuk VPS tanpa Docker.

#### 1. Install Dependencies di VPS

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y nodejs npm mysql-server redis-server nginx

# Install Node.js 20 (jika belum ada)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version   # >= 20.x
npm --version
mysql --version
redis-cli --version
```

#### 2. Install MinIO

```bash
# Download MinIO
wget https://dl.min.io/server/minio/release/linux-amd64/minio
chmod +x minio
sudo mv minio /usr/local/bin/

# Create data directory
sudo mkdir -p /opt/minio/data

# Create systemd service
sudo tee /etc/systemd/system/minio.service << 'EOF'
[Unit]
Description=MinIO
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/minio server /opt/minio/data --console-address ":9001"
Restart=always
Environment=MINIO_ROOT_USER=minioadmin MINIO_ROOT_PASSWORD=minioadmin

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable minio
sudo systemctl start minio
```

#### 3. Setup MySQL

```bash
sudo mysql -u root << 'EOF'
CREATE DATABASE digital_signage;
CREATE USER 'signage'@'localhost' IDENTIFIED BY 'your-strong-password';
GRANT ALL PRIVILEGES ON digital_signage.* TO 'signage'@'localhost';
FLUSH PRIVILEGES;
EOF
```

#### 4. Clone & Setup Project

```bash
cd /opt
git clone https://github.com/berbagibaik1202/digitalsignage.git
cd digitalsignage

# Generate .env
node scripts/setup-env.js

# Edit .env — pastikan DB_PASSWORD sesuai dengan yang dibuat di MySQL
nano .env
```

#### 5. Build & Start Backend

```bash
cd backend
npm install
npm run build
npm run migrate

# Test
npm start
# Server running on port 3000
```

#### 6. Setup Systemd Service

```bash
sudo tee /etc/systemd/system/signage-backend.service << 'EOF'
[Unit]
Description=Digital Signage Backend
After=network.target mysql.service redis.service

[Service]
Type=simple
WorkingDirectory=/opt/digitalsignage/backend
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable signage-backend
sudo systemctl start signage-backend
```

#### 7. Build & Deploy Frontend

```bash
cd /opt/digitalsignage/frontend
npm install
npm run build

# Copy build output ke Nginx
sudo cp -r dist/* /var/www/html/
```

#### 8. Setup Nginx

```bash
sudo tee /etc/nginx/sites-available/signage << 'EOF'
server {
    listen 80;
    server_name your-domain.com;

    # Frontend (React SPA)
    root /var/www/html;
    index index.html;

    # API Proxy
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # WebSocket Proxy
    location /ws/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # SPA Fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/signage /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

#### 9. Selesai!

Buka `http://your-domain.com` di browser.

---

### Opsi 3: Development Mode

Untuk pengembangan lokal.

#### Terminal 1 — Backend

```bash
cd backend
node ../scripts/setup-env.js    # generate .env (jika belum ada)
npm install
npm run migrate
npm run dev                      # hot reload
```

#### Terminal 2 — Frontend

```bash
cd frontend
npm install
npm run dev                      # Vite dev server di port 5173
```

Buka http://localhost:5173

---

## 🔧 Konfigurasi Environment

File `.env` di-generate otomatis oleh `scripts/setup-env.js`, atau bisa dibuat manual dengan copy `.env.example`:

```bash
cp .env.example .env
```

### Variable Penting

| Variable | Deskripsi | Default |
|---|---|---|
| `DB_HOST` | MySQL host | `127.0.0.1` |
| `DB_PORT` | MySQL port | `3306` |
| `DB_USER` | MySQL username | `signage` |
| `DB_PASSWORD` | MySQL password | - |
| `DB_NAME` | Database name | `digital_signage` |
| `REDIS_URL` | Redis connection | `redis://127.0.0.1:6379` |
| `JWT_SECRET` | Secret key JWT | - |
| `JWT_EXPIRES_IN` | Token expiry | `7d` |
| `MINIO_ENDPOINT` | MinIO host | `127.0.0.1` |
| `MINIO_PORT` | MinIO port | `9000` |
| `MINIO_ACCESS_KEY` | MinIO username | `minioadmin` |
| `MINIO_SECRET_KEY` | MinIO password | `minioadmin` |
| `MINIO_BUCKET` | Bucket name | `digital-signage` |
| `WORKERS_ENABLED` | Enable BullMQ worker | `true` |

---

## 📡 API Endpoints

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/auth/register` | Register user baru |
| POST | `/api/v1/auth/login` | Login, dapat JWT |
| POST | `/api/v1/auth/refresh` | Refresh token |
| GET | `/api/v1/auth/me` | Data user login |

### Devices

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/devices` | List semua device |
| POST | `/api/v1/devices/register` | Register device baru |
| POST | `/api/v1/devices/heartbeat` | Device heartbeat |
| PUT | `/api/v1/devices/:id` | Update device |
| DELETE | `/api/v1/devices/:id` | Hapus device |
| POST | `/api/v1/devices/:id/command` | Kirim command ke device |

### Media

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/media` | List media files |
| POST | `/api/v1/media/upload` | Upload file |
| GET | `/api/v1/media/:id` | Detail media |
| GET | `/api/v1/media/file/:id` | Stream/download file |
| DELETE | `/api/v1/media/:id` | Hapus media |

### Player API

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/player/register` | Register player |
| POST | `/api/v1/player/auth` | Auth player |
| POST | `/api/v1/player/manifest` | Dapatkan jadwal + playlist |
| POST | `/api/v1/player/heartbeat` | Heartbeat dari player |
| POST | `/api/v1/player/playback` | Laporkan playback event |
| GET | `/api/v1/player/commands` | Poll pending commands |

### Lainnya

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/health` | Health check |
| CRUD | `/api/v1/tenants` | Tenant management |
| CRUD | `/api/v1/users` | User management |
| CRUD | `/api/v1/playlists` | Playlist management |
| CRUD | `/api/v1/schedules` | Schedule management |
| CRUD | `/api/v1/layouts` | Layout management |
| CRUD | `/api/v1/device-groups` | Device group management |
| GET | `/api/v1/monitoring/*` | Monitoring & stats |
| CRUD | `/api/v1/subscription-plans` | Subscription plans |
| CRUD | `/api/v1/admin/*` | Super admin panel |

---

## 🐳 Docker Services

```bash
# Jalankan semua
docker compose up -d

# Lihat status
docker compose ps

# Lihat log
docker compose logs -f backend
docker compose logs -f frontend

# Stop semua
docker compose down

# Rebuild setelah perubahan kode
docker compose build --no-cache
docker compose up -d
```

### Service Ports

| Service | Port | Description |
|---|---|---|
| Frontend | 5173 | React dashboard |
| Backend | 3000 | API server |
| MySQL | 3306 | Database |
| Redis | 6379 | Cache/Queue |
| MinIO API | 9000 | Object storage |
| MinIO Console | 9001 | MinIO web UI |

---

## 📋 Database Migration

```bash
# Jalankan migration
docker compose exec backend npm run migrate

# Cek status migration
docker compose exec backend npm run migrate:status

# Tanpa Docker
cd backend
npm run migrate
```

---

## 🔒 Security Notes

- **JWT Secret** — Generate random string minimal 32 karakter
- **Database Password** — Gunakan password kuat di production
- **MinIO** — Ganti default credentials di production
- **HTTPS** — Gunakan Nginx + Let's Encrypt di production
- **CORS** — Konfigurasi `FRONTEND_URL` sesuai domain production

---

## 🛠️ Tech Stack

| Component | Technology |
|---|---|
| **Backend** | Node.js + TypeScript + Express |
| **Frontend** | React + Vite + TypeScript + Tailwind CSS |
| **Database** | MySQL 8.x / MariaDB 10.x |
| **Cache/Queue** | Redis 7 + BullMQ |
| **Object Storage** | MinIO (S3-compatible) |
| **WebSocket** | Socket.IO |
| **Media Processing** | Sharp (thumbnails) |
| **Container** | Docker + Docker Compose |
| **Web Server** | Nginx |

---

## 📄 License

MIT License — Silakan digunakan untuk keperluan apapun.

---

## 👥 Contributing

1. Fork repository
2. Create feature branch (`git checkout -b feature/fitur-baru`)
3. Commit changes (`git commit -m 'Add fitur baru'`)
4. Push to branch (`git push origin feature/fitur-baru`)
5. Open Pull Request

---

Built with ❤️ for Digital Signage
