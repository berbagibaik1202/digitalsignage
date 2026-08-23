import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development',

  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'signage',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'digital_signage',
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'change-me-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  storage: {
    endpoint: process.env.MINIO_ENDPOINT || process.env.STORAGE_ENDPOINT || '127.0.0.1',
    port: Number(process.env.MINIO_PORT || process.env.STORAGE_PORT || 9000),
    accessKey: process.env.MINIO_ACCESS_KEY || process.env.STORAGE_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || process.env.STORAGE_SECRET_KEY || 'minioadmin',
    bucket: process.env.MINIO_BUCKET || process.env.STORAGE_BUCKET || 'signage-media',
    useSsl: (process.env.MINIO_USE_SSL || process.env.STORAGE_USE_SSL) === 'true',
    // Browser-facing base URL for MinIO; internal MINIO_ENDPOINT is a Docker-only hostname
    publicUrl: process.env.MINIO_PUBLIC_URL || process.env.STORAGE_PUBLIC_URL || '',
  },
} as const;
