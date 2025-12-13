import pino from 'pino';

export interface LoggerOptions {
  service: string;
  level?: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
}

/**
 * Create a structured logger for a service
 */
export function createLogger({ service, level = 'info' }: LoggerOptions) {
  const isDevelopment = process.env.NODE_ENV !== 'production';

  return pino({
    name: service,
    level: process.env.LOG_LEVEL ?? level,
    transport: isDevelopment
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
    formatters: {
      level: (label) => ({ level: label }),
    },
    base: {
      service,
    },
  });
}

export type Logger = ReturnType<typeof createLogger>;
