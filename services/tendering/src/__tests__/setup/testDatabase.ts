import { drizzle } from 'drizzle-orm/node-postgres';
import { DataType, newDb } from 'pg-mem';
import { applyIntegrationsToPool } from 'drizzle-pgmem';
import { Temporal } from 'temporal-polyfill';
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from '../../private/store/schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Create a fresh in-memory database for testing
 * Automatically discovers and runs all migration files to ensure schema stays in sync
 */
export function createTestDb() {
  const mem = newDb({
    autoCreateForeignKeyIndices: true,
  });

  // Register PostgreSQL functions
  mem.public.registerFunction({
    name: 'current_database',
    returns: DataType.text,
    implementation: () => 'test_db',
  });

  mem.public.registerFunction({
    name: 'version',
    returns: DataType.text,
    implementation: () => 'PostgreSQL 14.0 (pg-mem test)',
  });

  mem.public.registerFunction({
    name: 'gen_random_uuid',
    returns: DataType.uuid,
    implementation: () => randomUUID(),
    impure: true,
  });

  mem.public.registerFunction({
    name: 'now',
    returns: DataType.timestamptz,
    implementation: () => {
      const now = Temporal.Now.zonedDateTimeISO();
      return new Date(now.epochMilliseconds);
    },
  });

  const { Pool: PgMemPool } = mem.adapters.createPg();
  const pool = new PgMemPool();
  applyIntegrationsToPool(pool);

  const db = drizzle(pool, { schema });

  // Discover and run all migration files
  const migrationsDir = join(__dirname, '../../../drizzle');
  const migrationFiles = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort(); // Ensures migrations run in order (0000_, 0001_, etc.)

  migrationFiles.forEach(file => {
    const migrationPath = join(migrationsDir, file);
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    // Parse and execute migration
    // pg-mem doesn't support DO blocks, so we extract CREATE and ALTER statements
    const statements = migrationSQL
      .split('--> statement-breakpoint')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('DO $$'));

    statements.forEach(statement => {
      if (statement) {
        try {
          mem.public.none(statement);
        } catch (error) {
          // Skip if already exists (for reruns)
          if (!String(error).includes('already exists') && !String(error).includes('duplicate')) {
            throw error;
          }
        }
      }
    });

    // Handle foreign key constraints from DO blocks
    // Extract foreign key constraints and run them directly
    const doBlockMatch = migrationSQL.match(/ALTER TABLE[^;]+FOREIGN KEY[^;]+;/g);
    if (doBlockMatch) {
      doBlockMatch.forEach(fkStatement => {
        try {
          mem.public.none(fkStatement.trim());
        } catch (error) {
          // Skip if already exists
          if (!String(error).includes('already exists') && !String(error).includes('duplicate')) {
            throw error;
          }
        }
      });
    }
  });

  return db;
}
