import mysql from 'mysql2/promise';
import { config } from '../config';

export const db = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,

  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
});

export async function testConnection(): Promise<void> {
  const conn = await db.getConnection();
  try {
    await conn.ping();
    console.log('✅ MySQL connected');
  } finally {
    conn.release();
  }
}
