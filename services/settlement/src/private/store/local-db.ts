import { drizzle } from 'drizzle-orm/node-postgres';
import { DataType, newDb } from 'pg-mem';
import type { Logger } from '@harbor/logger';
import { applyIntegrationsToPool } from 'drizzle-pgmem';
import { Temporal } from 'temporal-polyfill';
import { randomUUID } from 'node:crypto';
import * as schema from './schema.js';

let localDbInstance: ReturnType<typeof drizzle> | null = null;

export function createLocalDb(logger: Logger) {
  // Always reset to ensure fresh database on restart
  // This prevents stale data when tsx watch hot-reloads
  if (localDbInstance) {
    logger.info('Resetting in-memory database for fresh start');
    localDbInstance = null;
  }

  logger.info('Creating in-memory PostgreSQL database (pg-mem)');

  const mem = newDb({
    autoCreateForeignKeyIndices: true,
  });

  mem.public.registerFunction({
    name: 'current_database',
    returns: DataType.text,
    implementation: () => 'harbor_settlement_local',
  });

  mem.public.registerFunction({
    name: 'version',
    returns: DataType.text,
    implementation: () => 'PostgreSQL 14.0 (pg-mem simulation)',
  });

  mem.public.registerFunction({
    name: 'gen_random_uuid',
    returns: DataType.uuid,
    implementation: () => randomUUID(),
    impure: true, // Mark as non-deterministic to prevent caching
  });

  mem.public.registerFunction({
    name: 'now',
    returns: DataType.timestamptz,
    implementation: () => {
      const now = Temporal.Now.zonedDateTimeISO();
      return new Date(now.epochMilliseconds);
    },
  });

  const { Pool: PgMemPool } = mem.adapters.createPg();
  const pool = new PgMemPool();

  applyIntegrationsToPool(pool);

  localDbInstance = drizzle(pool, { schema });

  logger.info('In-memory database created successfully');

  return localDbInstance;
}

export function resetLocalDb() {
  localDbInstance = null;
}
