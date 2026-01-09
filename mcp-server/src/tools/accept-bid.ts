/**
 * Accept Bid tool implementation
 */

import type { HarborClient } from '../services/harbor-client.js';
import type { AcceptBidInput, AcceptBidOutput } from '../types/mcp.js';
import { session } from '../state/session.js';
import { logger } from '../utils/logger.js';
import { AuthenticationError, ValidationError, NotFoundError } from '../utils/errors.js';

export async function acceptBid(
  client: HarborClient,
  input: AcceptBidInput
): Promise<AcceptBidOutput> {
  logger.info('Accepting bid', { bidId: input.bidId });

  // Check if authenticated
  if (!session.isAuthenticated()) {
    throw new AuthenticationError('Must authenticate first using authenticate_user tool');
  }

  try {
    // Accept the bid via Harbor API
    const response = await client.acceptBid(input.bidId);

    logger.info('Bid accepted successfully', {
      bidId: response.bid.id,
      askId: response.ask.id,
      askStatus: response.ask.status,
    });

    // Update active ask (in case it wasn't already set)
    session.setActiveAsk(response.ask.id);

    return {
      bidId: response.bid.id,
      askId: response.ask.id,
      askStatus: response.ask.status,
      message: `Bid accepted successfully! The job is now ${response.ask.status}. The seller has been notified and will begin work. Use get_delivery to monitor progress and retrieve the completed work.`,
    };
  } catch (error) {
    logger.error('Failed to accept bid', error);

    if (error instanceof NotFoundError) {
      throw new NotFoundError(`Bid ${input.bidId} not found`);
    }

    if (error instanceof AuthenticationError || error instanceof ValidationError) {
      throw error;
    }

    throw new ValidationError(
      `Failed to accept bid: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error
    );
  }
}
