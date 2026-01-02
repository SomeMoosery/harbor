import postgres from 'postgres';
import type { Sql } from 'postgres';
import { runner } from 'node-pg-migrate';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Postgres admin connection (connects to 'postgres' database to create/drop test databases)
 */
const ADMIN_DB_URL = process.env.POSTGRES_URL || 'postgresql://harbor:harbor_dev_password@localhost:5432/postgres';

/**
 * Generate unique database name for this test run
 * Format: harbor_user_test_[timestamp]_[random]
 */
const TEST_DB_NAME = `harbor_user_test_${Date.now()}_${randomBytes(4).toString('hex')}`;
const TEST_DB_URL = ADMIN_DB_URL.replace(/\/[^/]+$/, `/${TEST_DB_NAME}`);

let sql: Sql | null = null;
let adminSql: Sql | null = null;

/**
 * Clean all data from test database between tests
 * Keeps schema intact, just deletes data
 */
export async function cleanTestDb(): Promise<void> {
  if (sql) {
    await sql`TRUNCATE TABLE api_keys, agents, users CASCADE`;
  }
}

/**
 * Create ephemeral test database
 * - Creates new database with unique name
 * - Enables uuid-ossp extension
 * - Runs migrations
 * - Returns connection to test database
 */
export async function createTestDb(): Promise<Sql> {
  if (sql) {
    return sql;
  }

  // Connect to admin database to create test database
  adminSql = postgres(ADMIN_DB_URL, {
    max: 1,
  });

  // Create test database
  await adminSql.unsafe(`CREATE DATABASE ${TEST_DB_NAME}`);

  // Enable uuid-ossp extension
  const tempSql = postgres(TEST_DB_URL, { max: 1 });
  await tempSql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
  await tempSql.end();

  // Connect to test database
  sql = postgres(TEST_DB_URL, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  // Run migrations
  const migrationsDir = join(__dirname, '../../../migrations');
  await runner({
    databaseUrl: TEST_DB_URL,
    dir: migrationsDir,
    direction: 'up',
    migrationsTable: 'pgmigrations',
    count: Infinity,
    verbose: false,
  });

  return sql;
}

/**
 * Close test database connection and drop the database
 * Call this in afterAll() hooks to clean up ephemeral database
 */
export async function closeTestDb(): Promise<void> {
  if (sql) {
    await sql.end();
    sql = null;
  }

  if (adminSql) {
    // Terminate all connections to the test database before dropping
    await adminSql.unsafe(`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = '${TEST_DB_NAME}'
        AND pid <> pg_backend_pid()
    `);

    // Drop the test database
    await adminSql.unsafe(`DROP DATABASE IF EXISTS ${TEST_DB_NAME}`);

    await adminSql.end();
    adminSql = null;
  }
}
