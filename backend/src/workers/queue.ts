import { Queue } from 'bullmq';
import { config } from '../config';
import { logger } from '../utils/logger';

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

let mediaQueue: Queue | null = null;

export function getMediaQueue(): Queue {
  if (!mediaQueue) {
    mediaQueue = new Queue('media-processing', {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    });

    logger.info('📋 Media processing queue initialized');
  }
  return mediaQueue;
}

export async function closeQueue(): Promise<void> {
  if (mediaQueue) {
    await mediaQueue.close();
    mediaQueue = null;
    logger.info('📋 Media processing queue closed');
  }
}
