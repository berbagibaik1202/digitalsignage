#!/bin/bash
# ============================================================
# Auto-generate .env file with secure random credentials
# Usage: bash scripts/setup-env.sh
# ============================================================

set -e

ENV_FILE=".env"
ENV_EXAMPLE=".env.example"

echo "🔧 Digital Signage — Environment Setup"
echo "========================================"
echo ""

# Check if .env already exists
if [ -f "$ENV_FILE" ]; then
  echo "⚠️  File .env sudah ada!"
  read -p "Overwrite? (y/N): " overwrite
  if [ "$overwrite" != "y" ] && [ "$overwrite" != "Y" ]; then
    echo "❌ Dibatalkan."
    exit 0
  fi
  # Backup old .env
  cp "$ENV_FILE" "${ENV_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
  echo "📦 Backup disimpan: ${ENV_FILE}.backup.*"
fi

echo ""
echo "Generating secure credentials..."

# ─── Generate Random Strings ────────────────────────────────
generate_random() {
  local length=${1:-32}
  # Use openssl if available, fallback to /dev/urandom
  if command -v openssl &> /dev/null; then
    openssl rand -base64 $length | tr -d '\n' | head -c $length
  elif [ -f /dev/urandom ]; then
    tr -dc 'a-zA-Z0-9' < /dev/urandom | head -c $length
  else
    # Fallback: less secure but works everywhere
    cat /proc/sys/kernel/random/uuid | tr -d '-' | head -c $length
  fi
}

MYSQL_ROOT_PASSWORD=$(generate_random 24)
DB_PASSWORD=$(generate_random 24)
JWT_SECRET=$(generate_random 64)
MINIO_ACCESS_KEY="admin$(generate_random 8)"
MINIO_SECRET_KEY=$(generate_random 32)

echo "✅ Credentials generated"
echo ""

# ─── Detect Host IP ─────────────────────────────────────────
# Try to get the host IP for MinIO/Redis connections
HOST_IP="127.0.0.1"
if command -v ip &> /dev/null; then
  HOST_IP=$(ip route get 1 2>/dev/null | awk '{print $7; exit}' || echo "127.0.0.1")
fi

# ─── Write .env File ────────────────────────────────────────
cat > "$ENV_FILE" << EOF
# ============================================================
# Digital Signage — Environment Configuration
# Generated: $(date '+%Y-%m-%d %H:%M:%S')
# ============================================================

# ─── Server ─────────────────────────────────────────────────
NODE_ENV=production
PORT=3000
FRONTEND_URL=http://localhost:5173

# ─── MySQL ──────────────────────────────────────────────────
DB_HOST=${HOST_IP}
DB_PORT=3306
DB_USER=signage
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=digital_signage
MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD}

# ─── Redis (BullMQ Queue) ──────────────────────────────────
REDIS_URL=redis://${HOST_IP}:6379

# ─── JWT Authentication ─────────────────────────────────────
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d

# ─── MinIO (Object Storage) ────────────────────────────────
MINIO_ENDPOINT=${HOST_IP}
MINIO_PORT=9000
MINIO_CONSOLE_PORT=9001
MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY}
MINIO_SECRET_KEY=${MINIO_SECRET_KEY}
MINIO_BUCKET=digital-signage
MINIO_USE_SSL=false
MINIO_PUBLIC_URL=https://md.display.rizki-tech.com

# ─── Workers ────────────────────────────────────────────────
# Set to 'true' to enable BullMQ media processing workers
WORKERS_ENABLED=true

# ─── Frontend ───────────────────────────────────────────────
FRONTEND_PORT=5173

# ─── Backward Compatibility ─────────────────────────────────
STORAGE_ENDPOINT=\${MINIO_ENDPOINT}
STORAGE_PORT=\${MINIO_PORT}
STORAGE_ACCESS_KEY=\${MINIO_ACCESS_KEY}
STORAGE_SECRET_KEY=\${MINIO_SECRET_KEY}
STORAGE_BUCKET=\${MINIO_BUCKET}
EOF

echo "✅ File .env berhasil dibuat!"
echo ""

# ─── Print Summary ──────────────────────────────────────────
echo "========================================="
echo "📋 Credential Summary (simpan ini!)"
echo "========================================="
echo ""
echo "  MySQL Root Password : ${MYSQL_ROOT_PASSWORD}"
echo "  MySQL DB Password   : ${DB_PASSWORD}"
echo "  JWT Secret          : ${JWT_SECRET:0:20}..."
echo "  MinIO Access Key    : ${MINIO_ACCESS_KEY}"
echo "  MinIO Secret Key    : ${MINIO_SECRET_KEY:0:20}..."
echo ""
echo "========================================="
echo "🚀 Next Steps:"
echo "========================================="
echo ""
echo "  Development (tanpa Docker):"
echo "    cd backend && npm run migrate && npm run dev"
echo "    cd frontend && npm run dev"
echo ""
echo "  Production (Docker):"
echo "    docker compose up -d"
echo "    docker compose exec backend npm run migrate"
echo ""
