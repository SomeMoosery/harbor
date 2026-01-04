/**
 * Configuration loading for MCP server
 * Loads from environment variables
 */

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

  const baseUrl = process.env.HARBOR_BASE_URL || 'http://localhost:3000';
  const logLevel = process.env.LOG_LEVEL || 'info';

  return {
    harborApiKey: apiKey,
    harborBaseUrl: baseUrl,
    logLevel,
  };
}
