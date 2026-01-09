/**
 * Create Ask tool implementation
 */

import type { HarborClient } from '../services/harbor-client.js';
import type { CreateAskInput, CreateAskOutput } from '../types/mcp.js';
import { session } from '../state/session.js';
import { logger } from '../utils/logger.js';
import { AuthenticationError, ValidationError } from '../utils/errors.js';

export async function createAsk(
  client: HarborClient,
  input: CreateAskInput
): Promise<CreateAskOutput> {
  logger.info('Creating ask', { description: input.description.substring(0, 50), budget: input.budget });

  // Check if authenticated
  if (!session.isAuthenticated()) {
    throw new AuthenticationError('Must authenticate first using authenticate_user tool');
  }

  const state = session.getState();

  if (!state.agentId) {
    throw new AuthenticationError('No agent ID found in session');
  }

  try {
    // Calculate bid window close time
    const bidWindowClosesAt = new Date();
    bidWindowClosesAt.setHours(bidWindowClosesAt.getHours() + input.bidWindowHours);

    // Create the ask
    const ask = await client.createAsk({
      description: input.description,
      budget: input.budget,
      bidWindowHours: input.bidWindowHours,
    });

    logger.info('Ask created successfully', { askId: ask.id, status: ask.status });

    // Set this as the active ask
    session.setActiveAsk(ask.id);

    return {
      askId: ask.id,
      bidWindowClosesAt: ask.bidWindowClosesAt,
      message: `Ask created successfully! Collecting bids for ${input.bidWindowHours} hour(s). Window closes at ${new Date(ask.bidWindowClosesAt).toLocaleString()}. I'll notify you when bids are ready to review.`,
    };
  } catch (error) {
    logger.error('Failed to create ask', error);

    if (error instanceof ValidationError || error instanceof AuthenticationError) {
      throw error;
    }

    throw new ValidationError(
      `Failed to create ask: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error
    );
  }
}
