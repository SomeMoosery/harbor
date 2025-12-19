import { sql } from 'drizzle-orm';
import type { Logger } from '@harbor/logger';

/**
 * Create settlement service schema for local in-memory database (pg-mem)
 * This is only used when env=local and useLocalPostgres=false
 *
 * For PostgreSQL environments, we use file-based migrations from drizzle/ folder
 */
export async function createSettlementSchema(db: any, logger: Logger): Promise<void> {
  logger.info('Creating settlement service schema for local environment');

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
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_escrow_locks_ask_id ON escrow_locks(ask_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_escrow_locks_bid_id ON escrow_locks(bid_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_settlements_escrow_lock_id ON settlements(escrow_lock_id)`);

    logger.info('Settlement schema created successfully');
  } catch (error) {
    logger.error({
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, 'Failed to create settlement schema');
    throw error;
  }
}
