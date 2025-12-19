import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { Logger } from '@harbor/logger';
import * as schema from './schema.js';

let productionDbInstance: ReturnType<typeof drizzle> | null = null;
let client: ReturnType<typeof postgres> | null = null;

export function createProductionDb(connectionString: string, logger: Logger) {
  if (productionDbInstance) {
    return productionDbInstance;
  }

  if (!connectionString) {
    throw new Error('Database connection string is required for production/staging environments');
  }

  logger.info({
    host: new URL(connectionString).hostname,
    database: new URL(connectionString).pathname.slice(1),
  }, 'Connecting to PostgreSQL database');

  client = postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  productionDbInstance = drizzle(client, { schema });

  logger.info('Database connection established');

  return productionDbInstance;
}

export async function closeProductionDb(logger: Logger) {
  if (client) {
    logger.info('Closing database connection');
    await client.end();
    client = null;
    productionDbInstance = null;
  }
}
