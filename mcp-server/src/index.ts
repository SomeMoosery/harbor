/**
 * Harbor MCP Server - Stdio Transport
 * Integrates Harbor marketplace into Claude Code via Model Context Protocol
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { logger } from './utils/logger.js';
import { initializeServerContext, createMcpServer } from './server.js';

export async function main() {
  logger.info('Starting Harbor MCP Server (stdio transport)');

  // Initialize server context (Harbor client + services)
  const context = await initializeServerContext();

  // Create MCP server with all handlers
  const server = createMcpServer(context);

  // Start server with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('Harbor MCP Server running on stdio');
}
