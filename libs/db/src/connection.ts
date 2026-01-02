import postgres from 'postgres';
import type { Logger } from '@harbor/logger';
import type { ConnectionPoolConfig, DatabaseConnection } from './types.js';

/**
 * Create a PostgreSQL database connection using postgres.js
 *
 * Benefits:
 * - Simple, direct SQL queries
 * - Excellent TypeScript support
 * - Fast and lightweight
 * - Tagged template literals for safety
 * - Automatic prepared statements
 *
 * @param connectionString - PostgreSQL connection string
 * @param logger - Logger instance
 * @param config - Optional connection pool configuration
 * @returns Database connection object with sql instance and close function
 */
export function createDatabaseConnection(
  connectionString: string,
  logger: Logger,
  config: ConnectionPoolConfig = {}
): DatabaseConnection {
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

  const sql = postgres(connectionString, {
    max,
    idle_timeout,
    connect_timeout,
  });

  const close = async () => {
    logger.info('Closing database connection');
    await sql.end();
  };

  logger.info('Database connection established');

  return { sql, close };
}
