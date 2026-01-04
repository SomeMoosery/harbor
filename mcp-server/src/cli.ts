#!/usr/bin/env node

/**
 * CLI entry point for Harbor MCP Server
 * This file should be used as the entry point in package.json
 */

import { main } from './index.js';

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
