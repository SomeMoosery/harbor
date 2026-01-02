import type { Logger } from '@harbor/logger';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runner } from 'node-pg-migrate';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Run database migrations for tendering service
 * Uses node-pg-migrate for migration management
 */
export async function runTenderingMigrations(
  connectionString: string,
  logger: Logger
): Promise<void> {
  const migrationsDir = join(__dirname, '../../../migrations');

  logger.info({ migrationsDir }, 'Running database migrations');

  try {
    await runner({
      databaseUrl: connectionString,
      dir: migrationsDir,
      direction: 'up',
      migrationsTable: 'pgmigrations',
      count: Infinity, // Run all pending migrations
      verbose: false,
      log: (msg) => logger.info(msg),
    });

    logger.info('Database migrations completed successfully');
  } catch (error) {
    logger.error({ error }, 'Database migration failed');
    throw error;
  }
}
