import * as Minio from 'minio';
import { config } from '../config';
import { logger } from '../utils/logger';

let minioClient: Minio.Client;

export function getMinioClient(): Minio.Client {
  if (!minioClient) {
    minioClient = new Minio.Client({
      endPoint: config.storage.endpoint,
      port: config.storage.port,
      useSSL: config.storage.useSsl,
      accessKey: config.storage.accessKey,
      secretKey: config.storage.secretKey,
    });
  }
  return minioClient;
}

// Ensure bucket exists, create if not
export async function ensureBucket(): Promise<void> {
  const client = getMinioClient();
  const bucket = config.storage.bucket;

  try {
    const exists = await client.bucketExists(bucket);
    if (!exists) {
      await client.makeBucket(bucket);
      // Set public read policy for media files
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${bucket}/*`],
          },
        ],
      };
      await client.setBucketPolicy(bucket, JSON.stringify(policy));
      logger.info(`📦 Created MinIO bucket: ${bucket}`);
    }
  } catch (err) {
    logger.error('Failed to ensure MinIO bucket:', err);
  }
}

// Upload file buffer to MinIO
export async function uploadFile(
  storageKey: string,
  buffer: Buffer,
  contentType: string
): Promise<{ bucket: string; key: string }> {
  const client = getMinioClient();
  const bucket = config.storage.bucket;

  await client.putObject(bucket, storageKey, buffer, buffer.length, {
    'Content-Type': contentType,
  });

  return { bucket, key: storageKey };
}

// Get presigned URL for download (valid for 7 days)
export async function getPresignedUrl(storageKey: string, expirySeconds = 7 * 24 * 60 * 60): Promise<string> {
  const client = getMinioClient();
  const bucket = config.storage.bucket;

  return client.presignedGetObject(bucket, storageKey, expirySeconds);
}

// Get presigned URL for upload (valid for 1 hour)
export async function getPresignedUploadUrl(
  storageKey: string,
  contentType: string,
  expirySeconds = 3600
): Promise<string> {
  const client = getMinioClient();
  const bucket = config.storage.bucket;

  return client.presignedPutObject(bucket, storageKey, expirySeconds);
}

// Get file stream from MinIO
export async function getFileStream(storageKey: string): Promise<NodeJS.ReadableStream> {
  const client = getMinioClient();
  const bucket = config.storage.bucket;

  return client.getObject(bucket, storageKey);
}

// Get file metadata
export async function getFileStat(storageKey: string) {
  const client = getMinioClient();
  const bucket = config.storage.bucket;

  return client.statObject(bucket, storageKey);
}

// Delete file from MinIO
export async function deleteFile(storageKey: string): Promise<void> {
  const client = getMinioClient();
  const bucket = config.storage.bucket;

  await client.removeObject(bucket, storageKey);
}

// Generate storage key for tenant media
export function generateStorageKey(tenantId: number, originalName: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const ext = originalName.split('.').pop() || 'bin';
  return `media/${tenantId}/${timestamp}-${random}.${ext}`;
}

// Generate thumbnail storage key
export function generateThumbnailKey(tenantId: number, originalKey: string): string {
  const ext = originalKey.split('.').pop() || 'jpg';
  const baseName = originalKey.replace(/\.[^.]+$/, '');
  return `${baseName}_thumb.${ext}`;
}
