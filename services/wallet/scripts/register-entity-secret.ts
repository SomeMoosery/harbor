#!/usr/bin/env tsx
/**
 * Register Entity Secret Script
 *
 * This script generates a new entity secret, registers it with Circle,
 * and saves the recovery file.
 *
 * Usage: tsx scripts/register-entity-secret.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { generateEntitySecret, registerEntitySecretCiphertext } from '@circle-fin/developer-controlled-wallets';

async function main() {
  console.log('🔐 Circle Entity Secret Registration\n');

  // Get API key from environment
  const apiKey = process.env.CIRCLE_API_KEY;
  if (!apiKey) {
    console.error('❌ ERROR: CIRCLE_API_KEY not found in environment');
    console.error('Set CIRCLE_API_KEY in your .env file');
    process.exit(1);
  }

  console.log('Step 1: Generating new entity secret...');

  // Generate new entity secret
  // Note: This function prints to console but doesn't return the value
  // We need to generate it ourselves
  const crypto = await import('crypto');
  const entitySecret = crypto.randomBytes(32).toString('hex');

  console.log('✅ Entity secret generated');
  console.log('\n⚠️  IMPORTANT: Save this entity secret securely!');
  console.log('Entity Secret:', entitySecret);
  console.log('\n');

  console.log('Step 2: Registering entity secret with Circle...');

  try {
    const response = await registerEntitySecretCiphertext({
      apiKey,
      entitySecret,
      baseUrl: 'https://api.circle.com',
    });

    console.log('✅ Entity secret registered successfully!');

    // Save recovery file
    if (response.data?.recoveryFile) {
      const recoveryFilePath = path.join(process.cwd(), 'recovery_file.dat');
      fs.writeFileSync(recoveryFilePath, response.data.recoveryFile);
      console.log('✅ Recovery file saved to:', recoveryFilePath);
    }

    console.log('\n📝 Next Steps:');
    console.log('1. Update your .env file with the entity secret:');
    console.log(`   CIRCLE_ENTITY_SECRET=${entitySecret}`);
    console.log('\n2. Store the recovery file (recovery_file.dat) in a secure location');
    console.log('3. Add recovery_file.dat to your .gitignore');
    console.log('\n🎉 Setup complete! You can now create wallets.');

  } catch (error: any) {
    console.error('\n❌ Failed to register entity secret:');
    console.error('Error:', error.message);

    if (error.response?.data) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }

    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Tip: Check that you can reach Circle API');
    }

    throw error;
  }
}

main()
  .then(() => {
    console.log('\n✨ Registration complete!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Registration failed\n');
    process.exit(1);
  });
