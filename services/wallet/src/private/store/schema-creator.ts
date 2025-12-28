import { sql } from 'drizzle-orm';
import type { Logger } from '@harbor/logger';

/**
 * Create wallet service schema for local in-memory database (pg-mem)
 * This is only used when env=local and useLocalPostgres=false
 *
 * For PostgreSQL environments, we use file-based migrations from drizzle/ folder
 */
export async function createWalletSchema(db: any, logger: Logger): Promise<void> {
  logger.info('Creating wallet service schema for local environment');

  try {
    // Create wallets table
    logger.debug('Creating wallets table');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS wallets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id TEXT NOT NULL UNIQUE,
        circle_wallet_id TEXT,
        wallet_address TEXT,
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
        agent_id TEXT NOT NULL,
        wallet_id UUID NOT NULL REFERENCES wallets(id),
        type TEXT NOT NULL CHECK (type IN ('ONRAMP', 'OFFRAMP', 'INTERNAL_TRANSFER')),
        status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'EXTERNAL_COMPLETED', 'INTERNAL_COMPLETED', 'RECONCILED', 'FAILED', 'REQUIRES_MANUAL_REVIEW')),
        external_provider TEXT,
        external_transaction_id TEXT,
        external_amount REAL,
        external_currency TEXT,
        external_status TEXT,
        external_completed_at TIMESTAMPTZ,
        internal_transaction_id UUID REFERENCES transactions(id),
        internal_amount REAL NOT NULL,
        internal_currency TEXT NOT NULL DEFAULT 'USDC',
        internal_status TEXT,
        internal_completed_at TIMESTAMPTZ,
        reconciled_at TIMESTAMPTZ,
        reconciliation_notes TEXT,
        platform_fee REAL DEFAULT 0,
        external_provider_fee REAL DEFAULT 0,
        description TEXT NOT NULL,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Create indexes for better query performance
    logger.debug('Creating indexes');
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_wallets_agent_id ON wallets(agent_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_transactions_from_wallet_id ON transactions(from_wallet_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_transactions_to_wallet_id ON transactions(to_wallet_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_transactions_external_id ON transactions(external_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ledger_entries_agent_id ON ledger_entries(agent_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ledger_entries_wallet_id ON ledger_entries(wallet_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ledger_entries_internal_transaction_id ON ledger_entries(internal_transaction_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ledger_entries_external_transaction_id ON ledger_entries(external_transaction_id)`);

    logger.info('Wallet schema created successfully');
  } catch (error) {
    logger.error({
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, 'Failed to create wallet schema');
    throw error;
  }
}
