#!/usr/bin/env tsx
/**
 * Database check script - verifies connection and shows current state
 * Usage: tsx scripts/check-db.ts
 */

import postgres from 'postgres';
import { createConfig, SERVICE_PORTS } from '@harbor/config';

const config = createConfig('wallet', SERVICE_PORTS.wallet);
const DATABASE_URL = config.database.url;

console.log('🔍 Database Configuration Check\n');
console.log('Configuration:');
console.log('  DATABASE_URL:', DATABASE_URL ? '✅ Set' : '❌ Not set');
console.log('  USE_LOCAL_POSTGRES:', config.database.useLocalPostgres);
console.log('  AUTO_MIGRATE:', config.database.autoMigrate);
console.log('  ENVIRONMENT:', config.env);

if (!DATABASE_URL) {
  console.error('\n❌ ERROR: No DATABASE_URL found!');
  console.error('Set DATABASE_URL or DATABASE_URL_WALLET in your .env file');
  process.exit(1);
}

console.log('\n📍 Database URL:', DATABASE_URL.replace(/:[^:@]+@/, ':***@'));

async function checkDatabase() {
  const sql = postgres(DATABASE_URL, { max: 1 });

  try {
    console.log('\n⏳ Connecting to database...');

    // Test connection
    const versionResult = await sql`SELECT version()`;
    console.log('✅ Connected to PostgreSQL');
    console.log('   Version:', versionResult[0].version.split(' ')[0], versionResult[0].version.split(' ')[1]);

    // Check if __drizzle_migrations table exists (in drizzle schema)
    console.log('\n📋 Checking migration status...');
    const migrationsTableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'drizzle'
        AND table_name = '__drizzle_migrations'
      )
    `;

    if (migrationsTableExists[0].exists) {
      console.log('✅ Migrations table exists');

      const migrations = await sql`
        SELECT * FROM drizzle.__drizzle_migrations
        ORDER BY created_at
      `;

      console.log(`\n📝 Applied migrations (${migrations.length}):`);
      migrations.forEach((m: any, i: number) => {
        console.log(`  ${i + 1}. Hash: ${m.hash}`);
        console.log(`     Created: ${m.created_at ? m.created_at.toString() : 'N/A'}`);
      });
    } else {
      console.log('⚠️  No migrations table found - migrations have never run');
    }

    // Check if wallets table exists
    console.log('\n📋 Checking wallets table...');
    const walletsTableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'wallets'
      )
    `;

    if (walletsTableExists[0].exists) {
      console.log('✅ Wallets table exists');

      const columns = await sql`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'wallets'
        ORDER BY ordinal_position
      `;

      console.log('\n📋 Wallets table columns:');
      columns.forEach((col: any) => {
        const nullable = col.is_nullable === 'YES' ? '(nullable)' : '(required)';
        const highlight = col.column_name === 'wallet_address' ? ' ← NEW!' : '';
        console.log(`  - ${col.column_name}: ${col.data_type} ${nullable}${highlight}`);
      });

      const hasWalletAddress = columns.some((col: any) => col.column_name === 'wallet_address');
      if (hasWalletAddress) {
        console.log('\n✅ wallet_address column EXISTS');
      } else {
        console.log('\n❌ wallet_address column MISSING - migration has not been applied');
      }
    } else {
      console.log('❌ Wallets table does not exist');
    }

    // List all tables
    console.log('\n📋 All tables in database:');
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;

    if (tables.length === 0) {
      console.log('  (no tables found)');
    } else {
      tables.forEach((t: any) => {
        console.log(`  - ${t.table_name}`);
      });
    }

  } catch (error: any) {
    console.error('\n❌ Database check failed:');
    console.error('   Error:', error.message);

    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Tip: PostgreSQL might not be running. Start it with:');
      console.error('   brew services start postgresql');
    } else if (error.code === '3D000') {
      console.error('\n💡 Tip: Database does not exist. Create it with:');
      console.error('   createdb harbor_dev');
    }

    throw error;
  } finally {
    await sql.end();
  }
}

checkDatabase()
  .then(() => {
    console.log('\n🎉 Database check complete!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Check failed\n');
    process.exit(1);
  });
