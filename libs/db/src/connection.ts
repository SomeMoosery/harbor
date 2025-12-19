import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { Logger } from '@harbor/logger';
import type { ConnectionPoolConfig, DatabaseConnection } from './types.js';

/**
 * Create a PostgreSQL database connection with Drizzle ORM
 *
 * Benefits over module-level singletons:
 * - Easier to test (no shared state)
 * - Configurable connection pool settings
 * - Explicit cleanup via close()
 * - Type-safe schema
 *
 * @param connectionString - PostgreSQL connection string
 * @param schema - Drizzle schema object
 * @param logger - Logger instance
 * @param config - Optional connection pool configuration
 * @returns Database connection object with db instance and close function
 */
export function createDatabaseConnection<TSchema extends Record<string, unknown>>(
  connectionString: string,
  schema: TSchema,
  logger: Logger,
  config: ConnectionPoolConfig = {}
): DatabaseConnection<TSchema> {
  const {
    max = 10,
    idle_timeout = 20,
    connect_timeout = 10,
  } = config;

  if (!connectionString) {
    throw new Error('Database connection string is required');
  }

  logger.info({
    host: new URL(connectionString).hostname,
    database: new URL(connectionString).pathname.slice(1),
    poolSize: max,
  }, 'Creating database connection');

  const client = postgres(connectionString, {
    max,
    idle_timeout,
    connect_timeout,
  });

  const db = drizzle(client, { schema });

  const close = async () => {
    logger.info('Closing database connection');
    await client.end();
  };

  logger.info('Database connection established');

  return { db, close };
}
