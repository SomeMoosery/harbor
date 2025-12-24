#!/usr/bin/env tsx
/**
 * Standalone migration script
 * Usage: tsx scripts/run-migrations.ts
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { createConfig, SERVICE_PORTS } from '@harbor/config';

const config = createConfig('wallet', SERVICE_PORTS.wallet);
const DATABASE_URL = config.database.url;

if (!DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL or DATABASE_URL_WALLET environment variable is required');
  process.exit(1);
}

console.log('🔧 Starting manual migration...');
console.log('📍 Database URL:', DATABASE_URL.replace(/:[^:@]+@/, ':***@')); // Hide password
console.log('📁 Migrations folder:', './drizzle');

async function runMigrations() {
  const migrationClient = postgres(DATABASE_URL, { max: 1 });
  const db = drizzle(migrationClient);

  try {
    console.log('⏳ Running migrations...');
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('✅ Migrations completed successfully!');

    // Verify wallet_address column exists
    const result = await migrationClient`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'wallets'
      ORDER BY ordinal_position
    `;

    console.log('\n📋 Wallets table columns:');
    result.forEach((col: any) => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });

    const hasWalletAddress = result.some((col: any) => col.column_name === 'wallet_address');
    if (hasWalletAddress) {
      console.log('\n✅ wallet_address column exists!');
    } else {
      console.log('\n❌ wallet_address column NOT found!');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await migrationClient.end();
  }
}

runMigrations()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
