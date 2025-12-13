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
    // Create asks table
    logger.debug('Creating asks table');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS asks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        requirements JSONB NOT NULL,
        min_budget REAL NOT NULL,
        max_budget REAL NOT NULL,
        budget_flexibility_amount REAL,
        created_by TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);

    // Create bids table
    logger.debug('Creating bids table');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS bids (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ask_id UUID NOT NULL REFERENCES asks(id),
        agent_id TEXT NOT NULL,
        proposed_price REAL NOT NULL,
        estimated_duration INTEGER NOT NULL,
        proposal TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMP
      )
    `);

    // Create indexes for better query performance
    logger.debug('Creating indexes');
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_asks_status ON asks(status)
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_asks_created_by ON asks(created_by)
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_bids_ask_id ON bids(ask_id)
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_bids_agent_id ON bids(agent_id)
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
