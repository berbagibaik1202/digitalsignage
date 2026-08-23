import { logger } from '../utils/logger';
import { config } from '../config';

export async function startWorkers(): Promise<void> {
  // Only start workers in production or if explicitly enabled
  const workersEnabled = config.nodeEnv === 'production' || process.env.WORKERS_ENABLED === 'true';

  if (!workersEnabled) {
    logger.info('⚠️  Workers disabled (set WORKERS_ENABLED=true to enable)');
    return;
  }

  try {
    // Dynamic import to avoid loading BullMQ when not needed
    const { mediaWorker } = await import('./media.worker');
    logger.info('🔄 Media processing worker started');
  } catch (err) {
    logger.error('Failed to start media worker:', err);
    // Don't crash — workers are optional
  }
}

export async function stopWorkers(): Promise<void> {
  try {
    const { stopMediaWorker } = await import('./media.worker');
    await stopMediaWorker();
  } catch {
    // Ignore
  }
}
