import { drizzle } from 'drizzle-orm/node-postgres';
import { DataType, newDb } from 'pg-mem';
import type { Logger } from '@harbor/logger';
import { applyIntegrationsToPool } from 'drizzle-pgmem';
import { Temporal } from 'temporal-polyfill';
import { randomUUID } from 'node:crypto';
import * as schema from './schema.js';

let localDbInstance: ReturnType<typeof drizzle> | null = null;

/**
 * Create an in-memory PostgreSQL database for local development
 * This uses pg-mem to simulate a real PostgreSQL database entirely in memory
 */
export function createLocalDb(logger: Logger) {
  // Always reset to ensure fresh database on restart
  // This prevents stale data when tsx watch hot-reloads
  if (localDbInstance) {
    logger.info('Resetting in-memory database for fresh start');
    localDbInstance = null;
  }

  logger.info('Creating in-memory PostgreSQL database (pg-mem)');

  // Create in-memory PostgreSQL instance
  const mem = newDb({
    autoCreateForeignKeyIndices: true,
  });

  // Add PostgreSQL extensions and functions that we need
  mem.public.registerFunction({
    name: 'current_database',
    returns: DataType.text,
    implementation: () => 'harbor_tendering_local',
  });

  mem.public.registerFunction({
    name: 'version',
    returns: DataType.text,
    implementation: () => 'PostgreSQL 14.0 (pg-mem simulation)',
  });

  // Register gen_random_uuid() function
  mem.public.registerFunction({
    name: 'gen_random_uuid',
    returns: DataType.uuid,
    implementation: () => randomUUID(),
    impure: true, // Mark as non-deterministic to prevent caching
  });

  // Register NOW() function
  // Note: Database expects Date, but we use Temporal internally
  // Convert Temporal to Date for database compatibility
  mem.public.registerFunction({
    name: 'now',
    returns: DataType.timestamptz,
    implementation: () => {
      const now = Temporal.Now.zonedDateTimeISO();
      return new Date(now.epochMilliseconds);
    },
  });

  // Get a node-postgres Pool compatible adapter
  const { Pool: PgMemPool } = mem.adapters.createPg();
  const pool = new PgMemPool();
  
  // Apply drizzle-pgmem integrations to fix compatibility issues
  // This adds the getTypeParser shim and other necessary patches
  applyIntegrationsToPool(pool);

  // Create Drizzle instance
  localDbInstance = drizzle(pool, { schema });

  logger.info('In-memory database created successfully');

  return localDbInstance;
}

/**
 * Reset the local database (useful for testing)
 */
export function resetLocalDb() {
  localDbInstance = null;
}
