/**
 * Configuration loading for MCP server
 * Loads from environment variables
 */

import { writeFileSync } from 'fs';

export interface Config {
  harborApiKey: string;
  harborBaseUrl: string;
  logLevel: string;
}

export function loadConfig(): Config {
  const apiKey = process.env.HARBOR_API_KEY;
  if (!apiKey) {
    throw new Error('HARBOR_API_KEY environment variable is required');
  }

  // DEBUG: Write environment variable to file
  try {
    writeFileSync('/tmp/harbor-mcp-env-debug.json', JSON.stringify({
      timestamp: new Date().toISOString(),
      HARBOR_API_KEY: apiKey.substring(0, 15) + '...',
      HARBOR_API_KEY_full: apiKey,
      HARBOR_BASE_URL: process.env.HARBOR_BASE_URL,
      LOG_LEVEL: process.env.LOG_LEVEL,
      allEnvVars: Object.keys(process.env).filter(k => k.includes('HARBOR') || k.includes('API')),
    }, null, 2));
  } catch (e) {
    // Ignore debug file write errors
  }

  const baseUrl = process.env.HARBOR_BASE_URL || 'http://localhost:3000';
  const logLevel = process.env.LOG_LEVEL || 'info';

  return {
    harborApiKey: apiKey,
    harborBaseUrl: baseUrl,
    logLevel,
  };
}
