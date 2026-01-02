import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Create escrow_locks table
  pgm.createTable('escrow_locks', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    ask_id: {
      type: 'text',
      notNull: true,
    },
    bid_id: {
      type: 'text',
      notNull: true,
    },
    buyer_wallet_id: {
      type: 'text',
      notNull: true,
    },
    buyer_agent_id: {
      type: 'text',
      notNull: true,
    },
    total_amount: {
      type: 'real',
      notNull: true,
    },
    base_amount: {
      type: 'real',
      notNull: true,
    },
    buyer_fee: {
      type: 'real',
      notNull: true,
    },
    currency: {
      type: 'text',
      notNull: true,
      default: 'USDC',
    },
    status: {
      type: 'text',
      notNull: true,
      default: 'LOCKED',
      check: "status IN ('LOCKED', 'RELEASED', 'REFUNDED')",
    },
    lock_transaction_id: {
      type: 'text',
    },
    metadata: {
      type: 'jsonb',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  // Create settlements table
  pgm.createTable('settlements', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    escrow_lock_id: {
      type: 'uuid',
      notNull: true,
      references: 'escrow_locks(id)',
    },
    seller_wallet_id: {
      type: 'text',
      notNull: true,
    },
    seller_agent_id: {
      type: 'text',
      notNull: true,
    },
    payout_amount: {
      type: 'real',
      notNull: true,
    },
    seller_fee: {
      type: 'real',
      notNull: true,
    },
    platform_revenue: {
      type: 'real',
      notNull: true,
    },
    currency: {
      type: 'text',
      notNull: true,
      default: 'USDC',
    },
    status: {
      type: 'text',
      notNull: true,
      default: 'PENDING',
      check: "status IN ('PENDING', 'COMPLETED', 'FAILED')",
    },
    release_transaction_id: {
      type: 'text',
    },
    fee_transaction_id: {
      type: 'text',
    },
    metadata: {
      type: 'jsonb',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  // Create indexes for common queries
  pgm.createIndex('escrow_locks', 'ask_id');
  pgm.createIndex('escrow_locks', 'bid_id');
  pgm.createIndex('escrow_locks', 'buyer_wallet_id');
  pgm.createIndex('escrow_locks', 'status');
  pgm.createIndex('settlements', 'escrow_lock_id');
  pgm.createIndex('settlements', 'seller_wallet_id');
  pgm.createIndex('settlements', 'status');
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('settlements');
  pgm.dropTable('escrow_locks');
}
