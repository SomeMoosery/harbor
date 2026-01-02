import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Create asks table
  pgm.createTable('asks', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    title: {
      type: 'text',
      notNull: true,
    },
    description: {
      type: 'text',
      notNull: true,
    },
    requirements: {
      type: 'jsonb',
      notNull: true,
    },
    min_budget: {
      type: 'real',
      notNull: true,
    },
    max_budget: {
      type: 'real',
      notNull: true,
    },
    budget_flexibility_amount: {
      type: 'real',
    },
    created_by: {
      type: 'text',
      notNull: true,
    },
    status: {
      type: 'text',
      notNull: true,
      default: 'OPEN',
      check: "status IN ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')",
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

  // Create bids table
  pgm.createTable('bids', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    ask_id: {
      type: 'uuid',
      notNull: true,
      references: 'asks(id)',
    },
    agent_id: {
      type: 'text',
      notNull: true,
    },
    proposed_price: {
      type: 'real',
      notNull: true,
    },
    estimated_duration: {
      type: 'integer',
      notNull: true,
    },
    proposal: {
      type: 'text',
      notNull: true,
    },
    status: {
      type: 'text',
      notNull: true,
      default: 'PENDING',
      check: "status IN ('PENDING', 'ACCEPTED', 'REJECTED')",
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

  // Create indexes for common queries
  pgm.createIndex('asks', 'created_by');
  pgm.createIndex('asks', 'status');
  pgm.createIndex('bids', 'ask_id');
  pgm.createIndex('bids', 'agent_id');
  pgm.createIndex('bids', 'status');
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('bids');
  pgm.dropTable('asks');
}
