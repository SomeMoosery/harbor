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
    // Create wallets table
    logger.debug('Creating wallets table');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS wallets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id TEXT NOT NULL UNIQUE,
        circle_wallet_id TEXT,
        status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'CLOSED')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);

    // Create transactions table
    logger.debug('Creating transactions table');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        type TEXT NOT NULL CHECK (type IN ('DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'FEE', 'ESCROW_LOCK', 'ESCROW_RELEASE', 'MINT')),
        from_wallet_id UUID REFERENCES wallets(id),
        to_wallet_id UUID REFERENCES wallets(id),
        amount REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USDC',
        status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
        external_id TEXT,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Create ledger_entries table
    logger.debug('Creating ledger_entries table');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ledger_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        wallet_id UUID NOT NULL REFERENCES wallets(id),
        transaction_id UUID NOT NULL REFERENCES transactions(id),
        type TEXT NOT NULL CHECK (type IN ('DEBIT', 'CREDIT')),
        amount REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USDC',
        balance REAL NOT NULL,
        description TEXT NOT NULL,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Create indexes for better query performance
    logger.debug('Creating indexes');
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_wallets_agent_id ON wallets(agent_id)
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_transactions_from_wallet_id ON transactions(from_wallet_id)
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_transactions_to_wallet_id ON transactions(to_wallet_id)
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_transactions_external_id ON transactions(external_id)
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_ledger_entries_wallet_id ON ledger_entries(wallet_id)
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_ledger_entries_transaction_id ON ledger_entries(transaction_id)
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
