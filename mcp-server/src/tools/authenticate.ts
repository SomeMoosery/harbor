/**
 * Authentication tool implementation
 */

import type { HarborClient } from '../services/harbor-client.js';
import type { AuthenticateInput, AuthenticateOutput } from '../types/mcp.js';
import { session } from '../state/session.js';
import { logger } from '../utils/logger.js';
import { AuthenticationError } from '../utils/errors.js';

export async function authenticateUser(
  client: HarborClient,
  input: AuthenticateInput
): Promise<AuthenticateOutput> {
  logger.info('Authenticating user');

  try {
    // Validate API key
    const validation = await client.validateApiKey(input.apiKey);

    if (!validation.valid || !validation.userId) {
      throw new AuthenticationError('Invalid API key');
    }

    const userId = validation.userId;

    // Get user details
    const user = await client.getUser(userId);
    logger.info('User authenticated', { userId: user.id });

    // Get user's agents (take the first one for now)
    const agents = await client.getAgentsForUser(userId);

    if (agents.length === 0) {
      return {
        success: false,
        userId: '',
        agentId: '',
        message: `No agents found for user ${userId}. Please create an agent at the Harbor dashboard before using the MCP server.`,
      };
    }

    const agent = agents[0]!;
    logger.info('Using agent', { agentId: agent.id, agentName: agent.name });

    // Initialize session
    session.initialize(input.apiKey, userId, agent.id);

    // Set the agent ID on the client for future requests
    client.setAgentId(agent.id);

    return {
      success: true,
      userId: user.id,
      agentId: agent.id,
      message: `Successfully authenticated as ${user.email || user.phone} with agent ${agent.name}`,
    };
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
