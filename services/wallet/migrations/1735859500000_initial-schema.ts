import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Create wallets table
  pgm.createTable('wallets', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    agent_id: {
      type: 'text',
      notNull: true,
      unique: true,
    },
    circle_wallet_id: {
      type: 'text',
    },
    wallet_address: {
      type: 'text',
    },
    status: {
      type: 'text',
      notNull: true,
      default: 'ACTIVE',
      check: "status IN ('ACTIVE', 'SUSPENDED', 'CLOSED')",
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
    deleted_at: {
      type: 'timestamptz',
    },
  });

  // Create transactions table
  pgm.createTable('transactions', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    type: {
      type: 'text',
      notNull: true,
      check: "type IN ('DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'FEE', 'ESCROW_LOCK', 'ESCROW_RELEASE', 'MINT')",
    },
    from_wallet_id: {
      type: 'uuid',
      references: 'wallets(id)',
    },
    to_wallet_id: {
      type: 'uuid',
      references: 'wallets(id)',
    },
    amount: {
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
    external_id: {
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

  // Create ledger_entries table
  pgm.createTable('ledger_entries', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    agent_id: {
      type: 'text',
      notNull: true,
    },
    wallet_id: {
      type: 'uuid',
      notNull: true,
      references: 'wallets(id)',
    },
    type: {
      type: 'text',
      notNull: true,
      check: "type IN ('ONRAMP', 'OFFRAMP', 'INTERNAL_TRANSFER')",
    },
    status: {
      type: 'text',
      notNull: true,
      default: 'PENDING',
      check: "status IN ('PENDING', 'EXTERNAL_COMPLETED', 'INTERNAL_COMPLETED', 'RECONCILED', 'FAILED', 'REQUIRES_MANUAL_REVIEW')",
    },
    external_provider: {
      type: 'text',
    },
    external_transaction_id: {
      type: 'text',
    },
    external_amount: {
      type: 'real',
    },
    external_currency: {
      type: 'text',
    },
    external_status: {
      type: 'text',
    },
    external_completed_at: {
      type: 'timestamptz',
    },
    internal_transaction_id: {
      type: 'uuid',
      references: 'transactions(id)',
    },
    internal_amount: {
      type: 'real',
      notNull: true,
    },
    internal_currency: {
      type: 'text',
      notNull: true,
      default: 'USDC',
    },
    internal_status: {
      type: 'text',
    },
    internal_completed_at: {
      type: 'timestamptz',
    },
    reconciled_at: {
      type: 'timestamptz',
    },
    reconciliation_notes: {
      type: 'text',
    },
    platform_fee: {
      type: 'real',
      default: 0,
    },
    external_provider_fee: {
      type: 'real',
      default: 0,
    },
    description: {
      type: 'text',
      notNull: true,
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
  pgm.createIndex('wallets', 'agent_id');
  pgm.createIndex('transactions', 'from_wallet_id');
  pgm.createIndex('transactions', 'to_wallet_id');
  pgm.createIndex('transactions', 'status');
  pgm.createIndex('ledger_entries', 'wallet_id');
  pgm.createIndex('ledger_entries', 'agent_id');
  pgm.createIndex('ledger_entries', 'status');
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('ledger_entries');
  pgm.dropTable('transactions');
  pgm.dropTable('wallets');
}
