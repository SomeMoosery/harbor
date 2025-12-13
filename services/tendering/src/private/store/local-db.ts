import { drizzle } from 'drizzle-orm/node-postgres';
import { DataType, newDb } from 'pg-mem';
import type { Logger } from '@harbor/logger';
import { applyIntegrationsToPool } from 'drizzle-pgmem';
import { Temporal } from 'temporal-polyfill';
import * as schema from './schema.js';

let localDbInstance: ReturnType<typeof drizzle> | null = null;

/**
 * Create an in-memory PostgreSQL database for local development
 * This uses pg-mem to simulate a real PostgreSQL database entirely in memory
 */
export function createLocalDb(logger: Logger) {
  if (localDbInstance) {
    return localDbInstance;
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
    implementation: () => {
      // Generate a UUID v4
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    },
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
