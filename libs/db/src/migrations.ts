import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import type { Logger } from '@harbor/logger';
import type { Environment } from '@harbor/config';

export interface MigrationOptions {
  env: Environment;
  useLocalPostgres: boolean;
  migrationsFolder?: string;
  createLocalSchema?: (db: ReturnType<typeof drizzle>, logger: Logger) => Promise<void>;
}

/**
 * Run database migrations
 *
 * For PostgreSQL (local & deployed): Uses file-based migrations from drizzle folder
 * For pg-mem (local only): Uses provided schema creation function
 *
 * @param db - Drizzle database instance
 * @param logger - Logger instance
 * @param options - Migration configuration options
 */
export async function runDatabaseMigrations(
  db: ReturnType<typeof drizzle>,
  logger: Logger,
  options: MigrationOptions
): Promise<void> {
  const { env, useLocalPostgres, migrationsFolder = './drizzle', createLocalSchema } = options;

  logger.info({ env, useLocalPostgres }, 'Running database migrations');

  try {
    if (env === 'local' && !useLocalPostgres) {
      // For pg-mem: create schema directly since it doesn't support file-based migrations
      if (!createLocalSchema) {
        throw new Error('createLocalSchema function required for local pg-mem database');
      }
      await createLocalSchema(db, logger);
    } else {
      // For all PostgreSQL (local and deployed): use Drizzle file-based migrations
      await migrate(db as any, { migrationsFolder });
    }

    logger.info('Database migrations completed successfully');
  } catch (error) {
    logger.error({
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    }, 'Failed to run migrations');
    throw error;
  }
}
