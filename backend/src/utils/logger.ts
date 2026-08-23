type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MIN_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[MIN_LEVEL];
}

function timestamp(): string {
  return new Date().toISOString();
}

export const logger = {
  info(message: string, ...args: unknown[]) {
    if (shouldLog('info')) console.log(`[${timestamp()}] INFO  ${message}`, ...args);
  },
  warn(message: string, ...args: unknown[]) {
    if (shouldLog('warn')) console.warn(`[${timestamp()}] WARN  ${message}`, ...args);
  },
  error(message: string, ...args: unknown[]) {
    if (shouldLog('error')) console.error(`[${timestamp()}] ERROR ${message}`, ...args);
  },
  debug(message: string, ...args: unknown[]) {
    if (shouldLog('debug')) console.log(`[${timestamp()}] DEBUG ${message}`, ...args);
  },
};
