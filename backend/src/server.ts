import app from './app';
import { createServer } from 'http';
import { config } from './config';
import { testConnection } from './database/mysql';
import { logger } from './utils/logger';
import { initWebSocket } from './realtime/websocket';
import { ensureBucket } from './services/storage';
import { startWorkers, stopWorkers } from './workers';

async function main() {
  // Connect to MySQL
  await testConnection();

  // Ensure MinIO bucket exists
  try {
    await ensureBucket();
  } catch (err) {
    logger.warn('MinIO not available, file storage will be local only:', err);
  }

  // Start background workers (media processing)
  await startWorkers();

  // Create HTTP server
  const httpServer = createServer(app);

  // Initialize Socket.IO
  initWebSocket(httpServer);
  logger.info('🔌 WebSocket server initialized');

  // Start server
  httpServer.listen(config.port, () => {
    logger.info(`🚀 Server running on port ${config.port}`);
    logger.info(`📋 Environment: ${config.nodeEnv}`);
    logger.info(`🔗 Health check: http://localhost:${config.port}/api/v1/health`);
    logger.info(`🔌 WebSocket: ws://localhost:${config.port}/ws`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`\n${signal} received. Shutting down gracefully...`);
    httpServer.close(async () => {
      await stopWorkers();
      process.exit(0);
    });
    // Force close after 10s
    setTimeout(() => process.exit(1), 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});
