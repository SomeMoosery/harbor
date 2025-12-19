import { sql } from 'drizzle-orm';
import type { Logger } from '@harbor/logger';

/**
 * Create tendering service schema for local in-memory database (pg-mem)
 * This is only used when env=local and useLocalPostgres=false
 *
 * For PostgreSQL environments, we use file-based migrations from drizzle/ folder
 */
export async function createTenderingSchema(db: any, logger: Logger): Promise<void> {
  logger.info('Creating tendering service schema for local environment');

  try {
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

    logger.debug('Creating indexes');
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_asks_status ON asks(status)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_asks_created_by ON asks(created_by)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bids_ask_id ON bids(ask_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bids_agent_id ON bids(agent_id)`);

    logger.info('Tendering schema created successfully');
  } catch (error) {
    logger.error({
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, 'Failed to create tendering schema');
    throw error;
  }
}
