#!/usr/bin/env node
// ============================================================
// Auto-generate .env file with secure random credentials
// Works on Windows, macOS, and Linux
// Usage: node scripts/setup-env.js
// ============================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');

const ENV_FILE = path.resolve(__dirname, '..', '.env');

function generateRandom(length = 32) {
  return crypto.randomBytes(length).toString('base64url').slice(0, length);
}

function generateKey(length = 20) {
  return 'admin' + crypto.randomBytes(length).toString('base64url').slice(0, length);
}

function getHostIp() {
  // Default to 127.0.0.1 for local development
  // In Docker, containers use service names instead
  return '127.0.0.1';
}

async function main() {
  console.log('');
  console.log('🔧 Digital Signage — Environment Setup');
  console.log('========================================');
  console.log('');

  // Check if .env already exists
  if (fs.existsSync(ENV_FILE)) {
    console.log('⚠️  File .env sudah ada!');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    const answer = await new Promise(resolve => {
      rl.question('Overwrite? (y/N): ', resolve);
    });
    rl.close();

    if (answer.toLowerCase() !== 'y') {
      console.log('❌ Dibatalkan.');
      process.exit(0);
    }

    // Backup
    const backupName = `.env.backup.${new Date().toISOString().replace(/[:.]/g, '-')}`;
    fs.copyFileSync(ENV_FILE, path.join(path.dirname(ENV_FILE), backupName));
    console.log(`📦 Backup: ${backupName}`);
  }

  console.log('');
  console.log('Generating secure credentials...');

  // Generate credentials
  const mysqlRootPassword = generateRandom(24);
  const dbPassword = generateRandom(24);
  const jwtSecret = generateRandom(64);
  const minioAccessKey = generateKey(16);
  const minioSecretKey = generateRandom(32);
  const hostIp = getHostIp();

  // Write .env
  const envContent = `# ============================================================
# Digital Signage — Environment Configuration
# Generated: ${new Date().toISOString()}
# ============================================================

# ─── Server ─────────────────────────────────────────────────
NODE_ENV=production
PORT=3000
FRONTEND_URL=http://localhost:5173

# ─── MySQL ──────────────────────────────────────────────────
DB_HOST=${hostIp}
DB_PORT=3306
DB_USER=signage
DB_PASSWORD=${dbPassword}
DB_NAME=digital_signage
MYSQL_ROOT_PASSWORD=${mysqlRootPassword}

# ─── Redis (BullMQ Queue) ──────────────────────────────────
REDIS_URL=redis://${hostIp}:6379

# ─── JWT Authentication ─────────────────────────────────────
JWT_SECRET=${jwtSecret}
JWT_EXPIRES_IN=7d

# ─── MinIO (Object Storage) ────────────────────────────────
MINIO_ENDPOINT=${hostIp}
MINIO_PORT=9000
MINIO_CONSOLE_PORT=9001
MINIO_ACCESS_KEY=${minioAccessKey}
MINIO_SECRET_KEY=${minioSecretKey}
MINIO_BUCKET=digital-signage
MINIO_USE_SSL=false
# Set this to your public domain/IP so uploaded media is viewable in the browser,
# e.g. https://storage.your-domain.com or http://YOUR_VPS_IP:9000
MINIO_PUBLIC_URL=https://md.display.rizki-tech.com

# ─── Workers ────────────────────────────────────────────────
# Set to 'true' to enable BullMQ media processing workers
WORKERS_ENABLED=true

# ─── Frontend ───────────────────────────────────────────────
FRONTEND_PORT=5173
`;

  fs.writeFileSync(ENV_FILE, envContent);

  console.log('');
  console.log('✅ File .env berhasil dibuat!');
  console.log('');
  console.log('=========================================');
  console.log('📋 Credential Summary (simpan ini!)');
  console.log('=========================================');
  console.log('');
  console.log(`  MySQL Root Password : ${mysqlRootPassword}`);
  console.log(`  MySQL DB Password   : ${dbPassword}`);
  console.log(`  JWT Secret          : ${jwtSecret.slice(0, 20)}...`);
  console.log(`  MinIO Access Key    : ${minioAccessKey}`);
  console.log(`  MinIO Secret Key    : ${minioSecretKey.slice(0, 20)}...`);
  console.log('');
  console.log('=========================================');
  console.log('🚀 Next Steps:');
  console.log('=========================================');
  console.log('');
  console.log('  Development (tanpa Docker):');
  console.log('    cd backend && npm run migrate && npm run dev');
  console.log('    cd frontend && npm run dev');
  console.log('');
  console.log('  Production (Docker):');
  console.log('    docker compose up -d');
  console.log('    docker compose exec backend npm run migrate');
  console.log('');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
