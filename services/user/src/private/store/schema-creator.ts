import { sql } from 'drizzle-orm';
import type { Logger } from '@harbor/logger';

/**
 * Create user service schema for local in-memory database (pg-mem)
 * This is only used when env=local and useLocalPostgres=false
 *
 * For PostgreSQL environments, we use file-based migrations from drizzle/ folder
 */
export async function createUserSchema(db: any, logger: Logger): Promise<void> {
  logger.info('Creating user service schema for local environment');

  try {
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

    logger.debug('Creating api_keys table');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS api_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        key TEXT NOT NULL UNIQUE,
        name TEXT,
        last_used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);

    logger.debug('Creating indexes');
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents(user_id)`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_user_id_name ON agents(user_id, name) WHERE deleted_at IS NULL`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(key) WHERE deleted_at IS NULL`);

    logger.info('User schema created successfully');
  } catch (error) {
    logger.error({
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, 'Failed to create user schema');
    throw error;
  }
}
