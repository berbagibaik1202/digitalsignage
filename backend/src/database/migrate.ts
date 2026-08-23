import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import { config } from '../config';

const MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations');

async function createConnection() {
  return mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
  });
}

async function ensureMigrationsTable(conn: mysql.Connection) {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      version VARCHAR(20) NOT NULL,
      name VARCHAR(255) NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_migration_version (version)
    )
  `);
}

async function getAppliedMigrations(conn: mysql.Connection): Promise<string[]> {
  const [rows] = await conn.execute(
    'SELECT version FROM schema_migrations ORDER BY version ASC'
  );
  return (rows as any[]).map((r) => r.version);
}

function getMigrationFiles(): { version: string; name: string; filePath: string }[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return [];
  }

  return fs.readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => ({
      version: f.split('_')[0],
      name: f.replace('.sql', ''),
      filePath: path.join(MIGRATIONS_DIR, f),
    }));
}

async function runMigrations() {
  const conn = await createConnection();
  try {
    await ensureMigrationsTable(conn);
    const applied = await getAppliedMigrations(conn);
    const files = getMigrationFiles();

    const pending = files.filter((f) => !applied.includes(f.version));

    if (pending.length === 0) {
      console.log('✅ All migrations already applied');
      return;
    }

    for (const migration of pending) {
      console.log(`▶ Applying ${migration.name}...`);
      const sql = fs.readFileSync(migration.filePath, 'utf8');

      // Split on semicolons for multi-statement execution
      const statements = sql
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      await conn.beginTransaction();
      try {
        for (const stmt of statements) {
          await conn.execute(stmt);
        }
        await conn.execute(
          'INSERT INTO schema_migrations (version, name) VALUES (?, ?)',
          [migration.version, migration.name]
        );
        await conn.commit();
        console.log(`  ✅ ${migration.name}`);
      } catch (err) {
        await conn.rollback();
        console.error(`  ❌ ${migration.name} failed:`, err);
        throw err;
      }
    }

    console.log(`\n✅ Applied ${pending.length} migration(s)`);
  } finally {
    await conn.end();
  }
}

async function showStatus() {
  const conn = await createConnection();
  try {
    await ensureMigrationsTable(conn);
    const applied = await getAppliedMigrations(conn);
    const files = getMigrationFiles();

    console.log('\nMigration Status');
    console.log('─'.repeat(60));

    for (const f of files) {
      const status = applied.includes(f.version) ? '  ✅ applied' : '  ⏳ pending';
      console.log(`${f.version}  ${f.name}${status}`);
    }

    if (files.length === 0) {
      console.log('  (no migration files found)');
    }

    console.log('─'.repeat(60));
    console.log(`Total: ${files.length} | Applied: ${applied.length} | Pending: ${files.length - applied.length}\n`);
  } finally {
    await conn.end();
  }
}

// CLI entry point
const command = process.argv[2];

if (command === 'status') {
  showStatus().catch((err) => {
    console.error('Migration status failed:', err);
    process.exit(1);
  });
} else {
  runMigrations().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}
