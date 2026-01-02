import type { Logger } from '@harbor/logger';
import { createDatabaseConnection, type DatabaseConnection } from '@harbor/db';

let connection: DatabaseConnection | null = null;

/**
 * Get database connection
 *
 * Uses real PostgreSQL for all environments (local, staging, production)
 */
export function getDb(connectionString: string, logger: Logger): DatabaseConnection {
  if (connection) {
    return connection;
  }

  connection = createDatabaseConnection(connectionString, logger, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  return connection;
}

/**
 * Close database connection (for graceful shutdown)
 */
export async function closeDb(logger: Logger): Promise<void> {
  if (connection) {
    await connection.close();
    connection = null;
  } else {
    logger.warn('Attempted to close database connection, but no connection exists');
  }
}
