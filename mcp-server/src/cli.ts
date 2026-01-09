#!/usr/bin/env node

/**
 * CLI entry point for Harbor MCP Server
 * This file should be used as the entry point in package.json
 */

import { existsSync } from 'fs';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { main } from './index.js';

const envCandidates = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '..', '.env'),
];

for (const envPath of envCandidates) {
  if (existsSync(envPath)) {
    loadEnv({ path: envPath });
    break;
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
