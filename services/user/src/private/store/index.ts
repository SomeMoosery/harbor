import { drizzle } from 'drizzle-orm/postgres-js';
import type { Logger } from '@harbor/logger';
import type { Environment } from '@harbor/config';
import { createLocalDb } from './local-db.js';
import { createProductionDb, closeProductionDb } from './production-db.js';

let db: ReturnType<typeof drizzle> | null = null;

/**
 * Get database instance based on environment
 *
 * - local with useLocalPostgres=false: In-memory PostgreSQL (pg-mem)
 * - local with useLocalPostgres=true: Local PostgreSQL (Docker)
 * - staging/production: Real PostgreSQL (Cloud SQL, RDS, etc.)
 */
export function getDb(env: Environment, connectionString: string, useLocalPostgres: boolean, logger: Logger): ReturnType<typeof drizzle> {
  if (db) {
    return db;
  }

  if (env === 'local' && !useLocalPostgres) {
    db = createLocalDb(logger);
  } else {
    db = createProductionDb(connectionString, logger);
  }

  return db;
}

/**
 * Close database connection (for graceful shutdown)
 */
export async function closeDb(env: Environment, useLocalPostgres: boolean, logger: Logger) {
  if (env !== 'local' || useLocalPostgres) {
    await closeProductionDb(logger);
  }
  db = null;
}

export * from './schema.js';
