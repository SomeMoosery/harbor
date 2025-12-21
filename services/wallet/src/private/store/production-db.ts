import type { Logger } from '@harbor/logger';
import { createDatabaseConnection, type DatabaseConnection } from '@harbor/db';
import * as schema from './schema.js';

let connection: DatabaseConnection<typeof schema> | null = null;

/**
 * Create a connection to a real PostgreSQL database (Cloud SQL, RDS, etc.)
 * Uses shared database connection utility from @harbor/db
 */
export function createProductionDb(connectionString: string, logger: Logger) {
  if (connection) {
    return connection.db;
  }

  connection = createDatabaseConnection(connectionString, schema, logger, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  return connection.db;
}

/**
 * Close the database connection (for graceful shutdown)
 */
export async function closeProductionDb(_logger: Logger) {
  if (connection) {
    await connection.close();
    connection = null;
  }
}
