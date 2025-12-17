import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { sql } from 'drizzle-orm';
import type { Logger } from '@harbor/logger';
import type { Environment } from '@harbor/config';
import { getDb } from './index.js';

export async function runMigrations(
  env: Environment,
  connectionString: string,
  logger: Logger
): Promise<void> {
  logger.info({ env }, 'Running database migrations');

  const db = getDb(env, connectionString, logger);

  try {
    if (env === 'local') {
      await createSchemaForLocalDb(db, logger);
    } else {
      await migrate(db as any, { migrationsFolder: './drizzle' });
    }

    logger.info('Database migrations completed successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to run migrations');
    throw error;
  }
}

async function createSchemaForLocalDb(
  db: ReturnType<typeof drizzle>,
  logger: Logger
): Promise<void> {
  logger.info('Creating database schema for local environment');

  try {
    logger.debug('Creating escrow_locks table');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS escrow_locks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ask_id TEXT NOT NULL,
        bid_id TEXT NOT NULL,
        buyer_wallet_id TEXT NOT NULL,
        buyer_agent_id TEXT NOT NULL,
        total_amount REAL NOT NULL,
        base_amount REAL NOT NULL,
        buyer_fee REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USDC',
        status TEXT NOT NULL DEFAULT 'LOCKED' CHECK (status IN ('LOCKED', 'RELEASED', 'REFUNDED')),
        lock_transaction_id TEXT,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    logger.debug('Creating settlements table');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS settlements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        escrow_lock_id UUID NOT NULL REFERENCES escrow_locks(id),
        seller_wallet_id TEXT NOT NULL,
        seller_agent_id TEXT NOT NULL,
        payout_amount REAL NOT NULL,
        seller_fee REAL NOT NULL,
        platform_revenue REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USDC',
        status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
        release_transaction_id TEXT,
        fee_transaction_id TEXT,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    logger.debug('Creating indexes');
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_escrow_locks_ask_id ON escrow_locks(ask_id)
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_escrow_locks_bid_id ON escrow_locks(bid_id)
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_settlements_escrow_lock_id ON settlements(escrow_lock_id)
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
