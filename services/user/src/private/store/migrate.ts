import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { sql } from 'drizzle-orm';
import type { Logger } from '@harbor/logger';
import type { Environment } from '@harbor/config';
import { getDb } from './index.js';

/**
 * Run database migrations
 *
 * This function:
 * 1. Creates tables from schema.ts
 * 2. Runs any pending migration files from drizzle/ directory
 *
 * Similar to Flyway's migration approach:
 * - Migration files are versioned (0001_initial.sql, 0002_add_column.sql)
 * - Each migration runs exactly once
 * - Migration history is tracked in __drizzle_migrations table
 */
export async function runMigrations(
  env: Environment,
  connectionString: string,
  logger: Logger
): Promise<void> {
  logger.info({ env }, 'Running database migrations');

  const db = getDb(env, connectionString, logger);

  try {
    if (env === 'local') {
      // For local in-memory database, we need to create the schema directly
      // since pg-mem doesn't support file-based migrations
      await createSchemaForLocalDb(db, logger);
    } else {
      // For staging/production, use Drizzle's migration system
      // This reads from the drizzle/ directory
      await migrate(db as any, { migrationsFolder: './drizzle' });
    }

    logger.info('Database migrations completed successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to run migrations');
    throw error;
  }
}

/**
 * Create schema directly for local in-memory database
 * This executes the SQL to create tables based on our Drizzle schema
 */
async function createSchemaForLocalDb(
  db: ReturnType<typeof drizzle>,
  logger: Logger
): Promise<void> {
  logger.info('Creating database schema for local environment');

  try {
    // Create users table
    logger.debug('Creating users table');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('BUSINESS', 'PERSONAL')),
        email TEXT NOT NULL UNIQUE,
        phone TEXT NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);

    // Create agents table
    logger.debug('Creating agents table');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS agents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        name TEXT NOT NULL,
        capabilities JSONB NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('BUYER', 'SELLER', 'DUAL')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);

    // Create indexes for better query performance
    logger.debug('Creating indexes');
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone)
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents(user_id)
    `);

    // Create unique index to prevent duplicate agent names per user
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_user_id_name ON agents(user_id, name) WHERE deleted_at IS NULL
    `);

    logger.info('Database schema created successfully');
  } catch (error) {
    logger.error({
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, 'Failed to create database schema');
    throw error;
  }
}
