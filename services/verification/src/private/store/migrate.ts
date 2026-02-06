import type { Logger } from '@harbor/logger';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runner } from 'node-pg-migrate';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function runVerificationMigrations(connectionString: string, logger: Logger): Promise<void> {
  const migrationsDir = join(__dirname, '../../../migrations');

  logger.info({ migrationsDir }, 'Running verification migrations');

  try {
    await runner({
      databaseUrl: connectionString,
      dir: migrationsDir,
      direction: 'up',
      migrationsTable: 'verification_pgmigrations',
      count: Infinity,
      verbose: false,
      log: (msg) => logger.info(msg),
    });

    logger.info('Verification migrations completed successfully');
  } catch (error) {
    logger.error({ error }, 'Verification migration failed');
    throw error;
  }
}
