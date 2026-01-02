#!/usr/bin/env tsx
/**
 * Standalone migration script
 * Runs database migrations against the configured DATABASE_URL
 *
 * Usage:
 *   pnpm migrate                    # Uses DATABASE_URL from environment
 *   DATABASE_URL=... pnpm migrate   # Override database URL
 */

import { createConfig, SERVICE_PORTS } from '@harbor/config';
import { createLogger } from '@harbor/logger';
import { runTenderingMigrations } from '../private/store/migrate.js';

const SERVICE_NAME = 'tendering';
const config = createConfig(SERVICE_NAME, SERVICE_PORTS.tendering);
const logger = createLogger({ service: SERVICE_NAME });

async function migrate() {
  if (!config.database.url) {
    logger.fatal('DATABASE_URL or DATABASE_URL_TENDERING must be set');
    process.exit(1);
  }

  logger.info({
    database: config.database.url.replace(/:[^:@]+@/, ':****@'), // Hide password in logs
  }, 'Running migrations');

  try {
    await runTenderingMigrations(config.database.url, logger);
    logger.info('Migrations completed successfully');
    process.exit(0);
  } catch (error) {
    logger.fatal({
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }, 'Migration failed');
    process.exit(1);
  }
}

migrate();
