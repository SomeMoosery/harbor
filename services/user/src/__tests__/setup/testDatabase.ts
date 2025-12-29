import { drizzle } from 'drizzle-orm/node-postgres';
import { DataType, newDb } from 'pg-mem';
import { applyIntegrationsToPool } from 'drizzle-pgmem';
import { Temporal } from 'temporal-polyfill';
import { randomUUID } from 'node:crypto';
import * as schema from '../../private/store/schema.js';

/**
 * Create a fresh in-memory database for testing
 */
export function createTestDb() {
  const mem = newDb({
    autoCreateForeignKeyIndices: true,
  });

  // Register PostgreSQL functions
  mem.public.registerFunction({
    name: 'current_database',
    returns: DataType.text,
    implementation: () => 'test_db',
  });

  mem.public.registerFunction({
    name: 'version',
    returns: DataType.text,
    implementation: () => 'PostgreSQL 14.0 (pg-mem test)',
  });

  mem.public.registerFunction({
    name: 'gen_random_uuid',
    returns: DataType.uuid,
    implementation: () => randomUUID(),
    impure: true,
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

  const db = drizzle(pool, { schema });

  // Run schema creation
  const schemaSQL = `
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('BUSINESS', 'PERSONAL')),
      email TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS agents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      capabilities JSONB NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('BUYER', 'SELLER', 'DUAL')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id),
      key TEXT NOT NULL UNIQUE,
      name TEXT,
      last_used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    );
  `;

  mem.public.none(schemaSQL);

  return db;
}
