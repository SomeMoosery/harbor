import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Delete all existing users and related data (clean slate for OAuth)
  pgm.sql('DELETE FROM api_keys');
  pgm.sql('DELETE FROM agents');
  pgm.sql('DELETE FROM users');

  // Add google_id column for OAuth
  pgm.addColumn('users', {
    google_id: {
      type: 'text',
      unique: true,
    },
  });

  // Create index for google_id lookups
  pgm.createIndex('users', 'google_id', {
    unique: true,
    where: 'deleted_at IS NULL',
    name: 'idx_users_google_id',
  });

  // Rename existing 'type' column to 'sub_type' and update its constraint
  // First drop the old check constraint
  pgm.sql('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_type_check');

  // Rename type to sub_type
  pgm.renameColumn('users', 'type', 'sub_type');

  // Update sub_type to allow new values (BUSINESS, PERSONAL for humans, AUTONOMOUS for agents)
  pgm.sql(`
    ALTER TABLE users
    ADD CONSTRAINT users_sub_type_check
    CHECK (sub_type IN ('BUSINESS', 'PERSONAL', 'AUTONOMOUS'))
  `);

  // Add user_type column (HUMAN, AGENT, UNKNOWN)
  pgm.addColumn('users', {
    user_type: {
      type: 'text',
      notNull: true,
      default: "'UNKNOWN'",
      check: "user_type IN ('HUMAN', 'AGENT', 'UNKNOWN')",
    },
  });

  // Add onboarding_completed column
  pgm.addColumn('users', {
    onboarding_completed: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
  });

  // Make phone optional (drop NOT NULL constraint)
  pgm.alterColumn('users', 'phone', {
    notNull: false,
  });

  // Drop the unique constraint on phone (keep the index for lookups but allow NULLs)
  pgm.sql('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_phone_key');
  pgm.createIndex('users', 'phone', {
    unique: true,
    where: 'phone IS NOT NULL AND deleted_at IS NULL',
    name: 'idx_users_phone_unique',
  });

  // Create sessions table
  pgm.createTable('sessions', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    session_token: {
      type: 'text',
      notNull: true,
      unique: true,
    },
    expires_at: {
      type: 'timestamptz',
      notNull: true,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    last_accessed_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    ip_address: {
      type: 'inet',
    },
    user_agent: {
      type: 'text',
    },
  });

  // Create indexes for sessions
  pgm.createIndex('sessions', 'session_token', {
    name: 'idx_sessions_token',
  });
  pgm.createIndex('sessions', 'user_id', {
    name: 'idx_sessions_user',
  });
  pgm.createIndex('sessions', 'expires_at', {
    name: 'idx_sessions_expires',
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // Drop sessions table
  pgm.dropTable('sessions');

  // Remove onboarding_completed column
  pgm.dropColumn('users', 'onboarding_completed');

  // Remove user_type column
  pgm.dropColumn('users', 'user_type');

  // Rename sub_type back to type
  pgm.sql('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_sub_type_check');
  pgm.renameColumn('users', 'sub_type', 'type');
  pgm.sql(`
    ALTER TABLE users
    ADD CONSTRAINT users_type_check
    CHECK (type IN ('BUSINESS', 'PERSONAL'))
  `);

  // Make phone required again
  pgm.alterColumn('users', 'phone', {
    notNull: true,
  });

  // Drop the conditional unique index and restore original
  pgm.dropIndex('users', 'phone', { name: 'idx_users_phone_unique' });

  // Drop google_id
  pgm.dropIndex('users', 'google_id', { name: 'idx_users_google_id' });
  pgm.dropColumn('users', 'google_id');
}
