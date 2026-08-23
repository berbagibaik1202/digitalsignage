# REVISI TECHNICAL BLUEPRINT

## Digital Signage SaaS — MySQL + Node.js/Go + Flexible Deployment

Bagian ini menggantikan rekomendasi stack sebelumnya pada PRD utama.

---

# 1. DATABASE

Database utama wajib menggunakan:

```text
MySQL 8.x
```

Recommended driver:

### Node.js

```text
mysql2
```

atau ORM:

```text
Prisma
Drizzle ORM
Sequelize
TypeORM
```

Rekomendasi utama:

```text
Node.js
+
TypeScript
+
mysql2/promise
```

atau:

```text
Node.js
+
TypeScript
+
Prisma
+
MySQL
```

Untuk kebutuhan kontrol SQL yang lebih besar, `mysql2/promise` sangat cocok.

---

# 2. DATABASE DESIGN

Semua tabel tetap menggunakan pola multi-tenant.

Contoh:

```text
tenants
users
devices
device_groups
media
playlists
playlist_items
layouts
layout_zones
schedules
schedule_targets
device_commands
device_heartbeats
playback_logs
screenshots
subscription_plans
subscriptions
audit_logs
```

Semua tabel customer-sensitive wajib mempunyai:

```text
tenant_id
```

Contoh tabel:

```sql
CREATE TABLE devices (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tenant_id BIGINT UNSIGNED NOT NULL,
    device_uuid VARCHAR(100) NOT NULL,
    name VARCHAR(150) NOT NULL,
    token_hash VARCHAR(255) NULL,

    group_id BIGINT UNSIGNED NULL,

    location VARCHAR(255) NULL,

    orientation ENUM(
        'LANDSCAPE',
        'PORTRAIT'
    ) DEFAULT 'LANDSCAPE',

    resolution_width INT NULL,
    resolution_height INT NULL,

    os VARCHAR(100) NULL,
    player_version VARCHAR(50) NULL,

    status ENUM(
        'ONLINE',
        'DEGRADED',
        'OFFLINE'
    ) DEFAULT 'OFFLINE',

    last_seen_at DATETIME NULL,
    last_sync_at DATETIME NULL,

    current_manifest_version BIGINT DEFAULT 0,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_device_uuid (device_uuid),
    INDEX idx_devices_tenant (tenant_id),
    INDEX idx_devices_last_seen (last_seen_at)
);
```

---

# 3. BACKEND OPTIONS

Backend boleh dikembangkan menggunakan:

```text
Node.js
```

atau:

```text
Go
```

Tetapi seluruh API contract harus tetap sama sehingga player dan frontend tidak tergantung pada bahasa backend.

---

# 4. RECOMMENDED BACKEND FOR MVP

Rekomendasi utama MVP:

```text
Node.js
+
TypeScript
+
Express
+
MySQL
```

Struktur:

```text
Backend

Node.js
Express
TypeScript

Database
MySQL 8

Realtime
WebSocket / Socket.IO

Queue
Redis + BullMQ

Media
FFmpeg

Storage
MinIO / S3 compatible
```

Keuntungannya:

* pengembangan cepat;
* library sangat banyak;
* mudah diintegrasikan dengan React;
* WebSocket mudah;
* API development cepat;
* cocok untuk AI coding agent;
* deployment sederhana;
* mudah menggunakan Docker;
* mudah dijalankan sebagai systemd service.

---

# 5. NODE.JS PROJECT STRUCTURE

Rekomendasi:

```text
backend/

src/
 ├── config/
 │
 ├── database/
 │   ├── mysql.ts
 │   └── migrations/
 │
 ├── middleware/
 │   ├── auth.middleware.ts
 │   ├── tenant.middleware.ts
 │   └── permission.middleware.ts
 │
 ├── modules/
 │   ├── auth/
 │   ├── tenants/
 │   ├── users/
 │   ├── devices/
 │   ├── device-groups/
 │   ├── media/
 │   ├── playlists/
 │   ├── schedules/
 │   ├── layouts/
 │   ├── commands/
 │   ├── monitoring/
 │   ├── subscriptions/
 │   └── admin/
 │
 ├── realtime/
 │   ├── websocket.ts
 │   └── device-gateway.ts
 │
 ├── services/
 │
 ├── workers/
 │
 ├── utils/
 │
 ├── app.ts
 └── server.ts

package.json
.env
tsconfig.json
```

---

# 6. MYSQL CONNECTION

Jika menggunakan `mysql2/promise`:

```typescript
import mysql from 'mysql2/promise';

export const db = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,

    waitForConnections: true,
    connectionLimit: 20,
    queueLimit: 0
});
```

Environment:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=signage
DB_PASSWORD=strong-password
DB_NAME=digital_signage
```

---

# 7. MIGRATION

Database schema tidak boleh dibuat manual satu-per-satu di production.

Project harus mempunyai migration system.

Contoh:

```text
database/migrations/

001_create_tenants.sql
002_create_users.sql
003_create_devices.sql
004_create_media.sql
005_create_playlists.sql
006_create_schedules.sql
```

AI agent harus dapat menjalankan:

```bash
npm run migrate
```

dan:

```bash
npm run migrate:status
```

---

# 8. GO BACKEND OPTION

Jika backend menggunakan Go:

```text
Go
+
Gin / Fiber / Echo
+
MySQL
```

Recommended:

```text
Go
+
Gin
+
MySQL
```

Database:

```text
database/sql
```

dengan driver:

```text
go-sql-driver/mysql
```

atau ORM:

```text
GORM
```

---

# 9. GO PROJECT STRUCTURE

```text
backend-go/

cmd/
 └── server/
     └── main.go

internal/
 ├── config/
 ├── database/
 ├── auth/
 ├── tenant/
 ├── users/
 ├── devices/
 ├── media/
 ├── playlists/
 ├── schedules/
 ├── commands/
 ├── realtime/
 └── middleware/

pkg/

migrations/

go.mod
.env
```

---

# 10. WHEN TO USE GO

Go cocok ketika:

```text
jumlah device sangat besar
```

misalnya:

```text
10,000+
display
```

dan backend menerima banyak:

```text
heartbeat
WebSocket
MQTT
playback events
device events
```

Contoh arsitektur masa depan:

```text
React Dashboard
       │
       ▼
Node.js Main API
       │
       ├──────────────┐
       │              │
       ▼              ▼
     MySQL        Redis
                      │
                      ▼
                 Go Device Gateway
                      │
             ┌────────┼────────┐
             ▼        ▼        ▼
          Player   Player   Player
```

Jadi tidak harus memilih satu bahasa untuk selamanya.

---

# 11. RECOMMENDED INITIAL ARCHITECTURE

Untuk MVP:

```text
Frontend
React + Vite + TypeScript

        │

Backend
Node.js + Express + TypeScript

        │

Database
MySQL 8

        │

Redis

        │

Object Storage
MinIO

        │

Player
Electron
```

---

# 12. FUTURE HYBRID ARCHITECTURE

Ketika platform berkembang:

```text
                  React Dashboard
                         │
                         ▼
                    Node.js API
                         │
              ┌──────────┼──────────┐
              │          │          │
              ▼          ▼          ▼
            MySQL      Redis      Storage
                                      │
                                      ▼
                                   MinIO/S3


                    Go Device Gateway
                           │
                           │
                   WebSocket / MQTT
                           │
             ┌─────────────┼─────────────┐
             ▼             ▼             ▼
          Display       Display       Display
```

Node.js menangani:

```text
Dashboard API
Authentication
Tenant
Media
Playlist
Schedule
Billing
Admin
```

Go dapat menangani:

```text
Device connection
Heartbeat
Realtime command
MQTT
WebSocket
High volume event ingestion
```

Tetapi Go **tidak wajib untuk MVP**.

---

# 13. DEPLOYMENT OPTION 1

## Node.js Project Biasa

Project harus dapat dijalankan tanpa Docker.

Contoh:

```bash
npm install
npm run build
npm start
```

Production:

```text
Ubuntu Server

├── Node.js
├── MySQL
├── Redis
├── MinIO
└── Nginx
```

Backend:

```bash
node dist/server.js
```

---

# 14. SYSTEMD DEPLOYMENT

Project Node.js dapat dijalankan menggunakan systemd.

Contoh:

```ini
[Unit]
Description=Digital Signage Backend
After=network.target mysql.service

[Service]
Type=simple

WorkingDirectory=/var/www/digital-signage/backend

ExecStart=/usr/bin/node dist/server.js

Restart=always
RestartSec=5

Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Sehingga backend otomatis hidup setelah VPS restart.

---

# 15. DEPLOYMENT OPTION 2

## Docker

Platform juga wajib mendukung Docker.

Contoh:

```text
docker-compose.yml

services:

frontend
backend
worker
mysql
redis
minio
```

Arsitektur:

```text
Docker Host

├── signage-frontend
├── signage-backend
├── signage-worker
├── signage-mysql
├── signage-redis
└── signage-minio
```

---

# 16. DOCKER EXAMPLE ARCHITECTURE

```yaml
services:

  mysql:
    image: mysql:8.4
    restart: unless-stopped

  redis:
    image: redis:7
    restart: unless-stopped

  minio:
    image: minio/minio
    restart: unless-stopped

  backend:
    build: ./backend
    restart: unless-stopped
    depends_on:
      - mysql
      - redis
      - minio

  frontend:
    build: ./frontend
    restart: unless-stopped
```

Credential tidak boleh ditulis langsung pada repository.

Gunakan:

```text
.env
```

atau Docker secrets.

---

# 17. DEPLOYMENT OPTION 3

## Go Binary

Jika backend Go digunakan:

```bash
go build -o signage-api ./cmd/server
```

Deployment:

```text
Ubuntu

/opt/signage/signage-api
```

Jalankan:

```bash
./signage-api
```

Tidak membutuhkan Node runtime.

Go juga bisa dijalankan melalui Docker.

---

# 18. DEPLOYMENT REQUIREMENT

Project harus mendukung minimal:

```text
MODE A

Node.js biasa
+
systemd
```

atau:

```text
MODE B

Docker Compose
```

Jika backend Go:

```text
MODE C

Go binary
+
systemd
```

atau:

```text
MODE D

Go Docker Container
```

---

# 19. REVERSE PROXY

Gunakan:

```text
Nginx
```

atau:

```text
Nginx Proxy Manager
```

Contoh domain:

```text
dashboard.signage.example.com
```

Frontend.

```text
api.signage.example.com
```

Backend API.

```text
media.signage.example.com
```

Media/object storage.

Optional:

```text
device.signage.example.com
```

Realtime Device Gateway.

---

# 20. API DESIGN

Backend implementation tidak boleh memengaruhi API contract.

Artinya API harus tetap:

```text
/api/v1/auth
/api/v1/devices
/api/v1/media
/api/v1/playlists
/api/v1/schedules
/api/v1/player
```

Jika hari ini:

```text
Node.js
```

dan suatu hari diganti:

```text
Go
```

Display Player tidak perlu diubah.

---

# 21. PLAYER COMMUNICATION

Player tidak boleh mengetahui teknologi backend.

Player hanya mengetahui:

```text
REST API
WebSocket
MQTT
```

Contoh:

```text
GET /api/v1/player/manifest
POST /api/v1/player/heartbeat
POST /api/v1/player/playback
```

Dengan demikian backend bebas:

```text
Node.js
```

atau:

```text
Go
```

---

# 22. RECOMMENDED MVP STACK

Rekomendasi final untuk versi pertama:

```text
FRONTEND
React
Vite
TypeScript
Tailwind
shadcn/ui

BACKEND
Node.js
Express
TypeScript

DATABASE
MySQL 8

DATABASE DRIVER
mysql2/promise

CACHE
Redis

QUEUE
BullMQ

MEDIA STORAGE
MinIO

MEDIA PROCESSING
FFmpeg

REALTIME
Socket.IO / WebSocket

PLAYER
Electron
React
TypeScript

REVERSE PROXY
Nginx / Nginx Proxy Manager

DEPLOYMENT
Node.js native
atau
Docker Compose
```

---

# 23. WHY NODE.JS FIRST

Untuk MVP, prioritaskan:

```text
Node.js
```

karena satu ecosystem dapat digunakan untuk:

```text
Frontend
Backend
Player
Shared Type
Validation
```

Contoh:

```text
TypeScript
    │
    ├── Dashboard
    ├── Backend
    └── Electron Player
```

Hal ini membuat AI coding agent lebih mudah menjaga konsistensi.

---

# 24. WHEN TO INTRODUCE GO

Jangan menggunakan Go hanya karena dianggap lebih cepat.

Tambahkan Go ketika ada kebutuhan nyata seperti:

```text
10,000+ persistent device connections
```

atau:

```text
high heartbeat volume
```

atau:

```text
high event ingestion
```

atau:

```text
CPU intensive backend service
```

Pada tahap tersebut:

```text
Node.js
```

tidak harus diganti.

Go cukup ditambahkan sebagai service khusus.

---

# 25. FINAL TECHNICAL DECISION

Untuk versi MVP:

```text
MySQL
    ↓
Node.js + TypeScript
    ↓
React Dashboard
    ↓
Electron Display Player
```

Deployment harus fleksibel:

```text
Development
npm run dev
```

```text
Production Option A
Node.js + systemd
```

```text
Production Option B
Docker Compose
```

Sedangkan Go disiapkan sebagai:

```text
alternative backend
```

atau:

```text
future high-performance service
```

tanpa mengubah API contract.

---

# 26. INSTRUCTION FOR AI AGENT

AI coding agent tidak boleh membuat ketergantungan aplikasi pada PostgreSQL.

Database yang digunakan:

```text
MySQL 8.x
```

Backend utama MVP:

```text
Node.js + TypeScript
```

Backend harus tetap dibuat modular sehingga service tertentu dapat dipindahkan atau dibuat ulang menggunakan:

```text
Go
```

di masa mendatang.

Project juga tidak boleh hanya dapat dijalankan melalui Docker.

Project harus dapat berjalan menggunakan:

```bash
npm install
npm run build
npm start
```

dan juga mendukung:

```bash
docker compose up -d
```

Tujuannya agar deployment dapat disesuaikan dengan environment customer atau server yang digunakan.

---

# 27. FINAL MVP ARCHITECTURE

```text
                      INTERNET
                         │
                    Nginx / NPM
                         │
              ┌──────────┴──────────┐
              │                     │
              ▼                     ▼
       React Dashboard          Node.js API
                                    │
                    ┌───────────────┼──────────────┐
                    │               │              │
                    ▼               ▼              ▼
                  MySQL           Redis          MinIO
                                    │
                                    ▼
                               BullMQ Worker
                                    │
                                  FFmpeg


                         Node.js API
                              │
                       WebSocket/REST
                              │
               ┌──────────────┼──────────────┐
               ▼              ▼              ▼
            Player 1       Player 2       Player N
```

Jika skala berkembang:

```text
Node.js API
     │
     ├── Dashboard / Business Logic
     │
     └── Go Device Gateway
             │
          MQTT/WS
             │
        Thousands of Displays
```

Dengan pendekatan ini, platform dapat dimulai sederhana menggunakan **Node.js + MySQL**, tetapi tetap mempunyai jalur pengembangan ke **Go** tanpa perlu membangun ulang keseluruhan aplikasi.
