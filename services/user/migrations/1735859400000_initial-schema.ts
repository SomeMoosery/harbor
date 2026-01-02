import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Create users table
  pgm.createTable('users', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    name: {
      type: 'text',
      notNull: true,
    },
    type: {
      type: 'text',
      notNull: true,
      check: "type IN ('BUSINESS', 'PERSONAL')",
    },
    email: {
      type: 'text',
      notNull: true,
      unique: true,
    },
    phone: {
      type: 'text',
      notNull: true,
      unique: true,
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

  // Create indexes for users
  pgm.createIndex('users', 'email');
  pgm.createIndex('users', 'phone');

  // Create agents table
  pgm.createTable('agents', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
    },
    name: {
      type: 'text',
      notNull: true,
    },
    capabilities: {
      type: 'jsonb',
      notNull: true,
    },
    type: {
      type: 'text',
      notNull: true,
      check: "type IN ('BUYER', 'SELLER', 'DUAL')",
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

  // Create indexes for agents
  pgm.createIndex('agents', 'user_id');
  pgm.createIndex('agents', ['user_id', 'name'], {
    unique: true,
    where: 'deleted_at IS NULL',
  });

  // Create api_keys table
  pgm.createTable('api_keys', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
    },
    key: {
      type: 'text',
      notNull: true,
      unique: true,
    },
    name: {
      type: 'text',
    },
    last_used_at: {
      type: 'timestamptz',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    deleted_at: {
      type: 'timestamptz',
    },
  });

  // Create indexes for api_keys
  pgm.createIndex('api_keys', 'user_id');
  pgm.createIndex('api_keys', 'key', {
    where: 'deleted_at IS NULL',
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('api_keys');
  pgm.dropTable('agents');
  pgm.dropTable('users');
}
