import { Worker, Job } from 'bullmq';
import { config } from '../config';
import { logger } from '../utils/logger';
import { getFileStream, uploadFile, getPresignedUrl } from '../services/storage';
import { processImage, isProcessableImage, isVideo } from '../services/media-processor';
import { execute } from '../services/query';

interface MediaJobData {
  tenantId: number;
  mediaId: number;
  storageKey: string;
  mimeType: string;
  originalName: string;
}

// Create Redis connection options from URL
function getRedisConnection() {
  const url = config.redis.url;
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: Number(parsed.port) || 6379,
      password: parsed.password || undefined,
    };
  } catch {
    return { host: '127.0.0.1', port: 6379 };
  }
}

const redisConnection = getRedisConnection();

// Media processing worker
const mediaWorker = new Worker(
  'media-processing',
  async (job: Job<MediaJobData>) => {
    const { tenantId, mediaId, storageKey, mimeType, originalName } = job.data;

    logger.info(`🔄 Processing media: ${originalName} (job ${job.id})`);

    try {
      // Download file from MinIO
      const stream = await getFileStream(storageKey);
      const chunks: Buffer[] = [];

      await new Promise<void>((resolve, reject) => {
        stream.on('data', (chunk: Buffer | string) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        stream.on('end', resolve);
        stream.on('error', reject);
      });

      const buffer = Buffer.concat(chunks);

      if (isProcessableImage(mimeType)) {
        // Process image: generate thumbnail
        const { thumbnail, width, height } = await processImage(buffer);

        if (thumbnail.length > 0) {
          // Upload thumbnail to MinIO
          const thumbnailKey = storageKey.replace(/\.[^.]+$/, '_thumb.jpg');
          await uploadFile(thumbnailKey, thumbnail, 'image/jpeg');

          // Update media record with thumbnail and dimensions
          await execute(
            `UPDATE media SET
              thumbnail_key = ?,
              width = ?,
              height = ?
             WHERE id = ? AND tenant_id = ?`,
            [thumbnailKey, width, height, mediaId, tenantId]
          );

          logger.info(`✅ Thumbnail generated for media ${mediaId}: ${thumbnailKey}`);
        }
      } else if (isVideo(mimeType)) {
        // Future: FFmpeg processing for video thumbnails
        // For now, just update dimensions from metadata
        logger.info(`🎬 Video detected: ${originalName} (FFmpeg processing not yet implemented)`);
      }

      // Update status to READY
      await execute(
        `UPDATE media SET status = 'READY' WHERE id = ? AND tenant_id = ?`,
        [mediaId, tenantId]
      );

      // Generate a presigned URL and cache it
      const fileUrl = await getPresignedUrl(storageKey);
      await execute(
        `UPDATE media SET file_url_cache = ? WHERE id = ? AND tenant_id = ?`,
        [fileUrl, mediaId, tenantId]
      );

      return { success: true, mediaId };
    } catch (err) {
      logger.error(`❌ Media processing failed for ${originalName}:`, err);

      // Mark as failed
      await execute(
        `UPDATE media SET status = 'ERROR' WHERE id = ? AND tenant_id = ?`,
        [mediaId, tenantId]
      );

      throw err;
    }
  },
  {
    connection: redisConnection,
    concurrency: 3,
    limiter: {
      max: 10,
      duration: 1000,
    },
  }
);

// Event handlers
mediaWorker.on('completed', (job) => {
  logger.info(`✅ Media processing job ${job.id} completed`);
});

mediaWorker.on('failed', (job, err) => {
  logger.error(`❌ Media processing job ${job?.id} failed:`, err);
});

mediaWorker.on('error', (err) => {
  logger.error('❌ Media worker error:', err);
});

// Graceful shutdown
export async function stopMediaWorker(): Promise<void> {
  await mediaWorker.close();
  logger.info('🛑 Media worker stopped');
}

export { mediaWorker };
