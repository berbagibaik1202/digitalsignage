# ============================================================
# Digital Signage — Environment Setup (PowerShell)
# Usage: .\scripts\setup-env.ps1
# ============================================================

$ErrorActionPreference = "Stop"

$EnvFile = Join-Path $PSScriptRoot ".." ".env"

Write-Host ""
Write-Host "🔧 Digital Signage — Environment Setup" -ForegroundColor Cyan
Write-Host "========================================"
Write-Host ""

# Check if .env exists
if (Test-Path $EnvFile) {
    Write-Host "⚠️  File .env sudah ada!" -ForegroundColor Yellow
    $overwrite = Read-Host "Overwrite? (y/N)"
    if ($overwrite -ne "y" -and $overwrite -ne "Y") {
        Write-Host "❌ Dibatalkan." -ForegroundColor Red
        exit 0
    }
    $backup = "$EnvFile.backup.$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    Copy-Item $EnvFile $backup
    Write-Host "📦 Backup: $backup" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Generating secure credentials..." -ForegroundColor Green

# Generate random strings
function Generate-Random($length) {
    $bytes = [System.Security.Cryptography.RandomNumberGenerator]::new().GetBytes([byte[]]::new($length))
    return [Convert]::ToBase64String($bytes).Replace('+','a').Replace('/','b').Substring(0, $length)
}

$mysqlRootPassword = Generate-Random 24
$dbPassword = Generate-Random 24
$jwtSecret = Generate-Random 64
$minioAccessKey = "admin" + (Generate-Random 8)
$minioSecretKey = Generate-Random 32

# Write .env
@"
# ============================================================
# Digital Signage — Environment Configuration
# Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
# ============================================================

# Server
NODE_ENV=production
PORT=3000
FRONTEND_URL=http://localhost:5173

# MySQL
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=signage
DB_PASSWORD=$dbPassword
DB_NAME=digital_signage
MYSQL_ROOT_PASSWORD=$mysqlRootPassword

# Redis (BullMQ Queue)
REDIS_URL=redis://127.0.0.1:6379

# JWT Authentication
JWT_SECRET=$jwtSecret
JWT_EXPIRES_IN=7d

# MinIO (Object Storage)
MINIO_ENDPOINT=127.0.0.1
MINIO_PORT=9000
MINIO_CONSOLE_PORT=9001
MINIO_ACCESS_KEY=$minioAccessKey
MINIO_SECRET_KEY=$minioSecretKey
MINIO_BUCKET=digital-signage
MINIO_USE_SSL=false

# Workers
WORKERS_ENABLED=true

# Frontend
FRONTEND_PORT=5173
"@ | Out-File -FilePath $EnvFile -Encoding utf8

Write-Host ""
Write-Host "✅ File .env berhasil dibuat!" -ForegroundColor Green
Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "📋 Credential Summary (simpan ini!)" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  MySQL Root Password : $mysqlRootPassword" -ForegroundColor Yellow
Write-Host "  MySQL DB Password   : $dbPassword" -ForegroundColor Yellow
Write-Host "  JWT Secret          : $($jwtSecret.Substring(0,20))..." -ForegroundColor Yellow
Write-Host "  MinIO Access Key    : $minioAccessKey" -ForegroundColor Yellow
Write-Host "  MinIO Secret Key    : $($minioSecretKey.Substring(0,20))..." -ForegroundColor Yellow
Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "🚀 Next Steps:" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Development (tanpa Docker):"
Write-Host "    cd backend && npm run migrate && npm run dev"
Write-Host "    cd frontend && npm run dev"
Write-Host ""
Write-Host "  Production (Docker):"
Write-Host "    docker compose up -d"
Write-Host "    docker compose exec backend npm run migrate"
Write-Host ""
