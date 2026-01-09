/**
 * Authentication initialization for server startup
 */

import type { HarborClient } from '../services/harbor-client.js';
import { session } from '../state/session.js';
import { logger } from '../utils/logger.js';
import { AuthenticationError } from '../utils/errors.js';
import { writeFileSync } from 'fs';

/**
 * Initialize authentication using API key from environment
 * This is called automatically when the server starts
 */
export async function initializeAuthentication(
  client: HarborClient,
  apiKey: string
): Promise<void> {
  logger.info('Initializing authentication');

  try {
    // Validate API key
    logger.info('DEBUG: Validating API key', { apiKey: apiKey.substring(0, 15) + '...' });
    const validation = await client.validateApiKey(apiKey);

    if (!validation.valid || !validation.userId) {
      throw new AuthenticationError('Invalid API key');
    }

    const userId = validation.userId;
    logger.info('DEBUG: API key validated', { userId });

    // Get user details
    const user = await client.getUser(userId);
    logger.info('User authenticated', { userId: user.id });

    // Get user's agents (take the first one for now)
    const agents = await client.getAgentsForUser(userId);

    logger.info('DEBUG: All agents for user', {
      userId,
      agentCount: agents.length,
      agents: agents.map(a => ({ id: a.id, name: a.name })),
    });

    if (agents.length === 0) {
      throw new AuthenticationError(
        `No agents found for user ${userId}. Please create an agent at the Harbor dashboard before using the MCP server.`
      );
    }

    const agent = agents[0]!;
    logger.info('Using agent', { agentId: agent.id, agentName: agent.name });

    // Initialize session
    session.initialize(apiKey, userId, agent.id);
    logger.info('DEBUG: Session initialized', { apiKey: apiKey.substring(0, 15) + '...', userId, agentId: agent.id });

    // Set the agent ID on the client for future requests
    client.setAgentId(agent.id);
    logger.info('DEBUG: Agent ID set on client', { agentId: agent.id });

    // Write debug info to file
    try {
      const debugInfo = {
        timestamp: new Date().toISOString(),
        apiKey: apiKey.substring(0, 15) + '...',
        userId,
        agentId: agent.id,
        agentName: agent.name,
        allAgents: agents.map(a => ({ id: a.id, name: a.name })),
      };
      writeFileSync('/tmp/harbor-mcp-auth-debug.json', JSON.stringify(debugInfo, null, 2));
    } catch (e) {
      // Ignore debug file write errors
    }

    logger.info(
      `Successfully authenticated as ${user.email || user.phone} with agent ${agent.name}`
    );
  } catch (error) {
    logger.error('Authentication failed', error);

    if (error instanceof AuthenticationError) {
      throw error;
    }

    throw new AuthenticationError(
      `Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error
    );
  }
}
