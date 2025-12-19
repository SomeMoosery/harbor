import type { Logger } from '@harbor/logger';
import type { Environment } from '@harbor/config';
import { runDatabaseMigrations } from '@harbor/db';
import { getDb } from './index.js';
import { createWalletSchema } from './schema-creator.js';

/**
 * Run database migrations for wallet service
 * Uses shared migration runner from @harbor/db
 */
export async function runMigrations(
  env: Environment,
  connectionString: string,
  useLocalPostgres: boolean,
  logger: Logger
): Promise<void> {
  const db = getDb(env, connectionString, useLocalPostgres, logger);

  await runDatabaseMigrations(db, logger, {
    env,
    useLocalPostgres,
    migrationsFolder: './drizzle',
    createLocalSchema: createWalletSchema,
  });
}
