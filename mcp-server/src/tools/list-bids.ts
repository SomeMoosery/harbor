/**
 * List Bids tool implementation
 */

import type { HarborClient } from '../services/harbor-client.js';
import type { ListBidsInput, ListBidsOutput, BidDisplay } from '../types/mcp.js';
import { session } from '../state/session.js';
import { logger } from '../utils/logger.js';
import { AuthenticationError, ValidationError, NotFoundError } from '../utils/errors.js';

export async function listBids(
  client: HarborClient,
  input: ListBidsInput
): Promise<ListBidsOutput> {
  logger.info('Listing bids', { askId: input.askId });

  // Check if authenticated
  if (!session.isAuthenticated()) {
    throw new AuthenticationError('Must authenticate first using authenticate_user tool');
  }

  // Determine which ask to use
  const state = session.getState();
  const askId = input.askId || state.activeAskId;

  if (!askId) {
    throw new ValidationError(
      'No ask ID provided and no active ask found. Create an ask first using create_ask tool.'
    );
  }

  try {
    // Get the ask details
    const ask = await client.getAsk(askId);
    logger.info('Retrieved ask', { askId: ask.id, status: ask.status });

    // Get bids for this ask
    const bids = await client.getBidsForAsk(askId);
    logger.info('Retrieved bids', { count: bids.length });

    // Fetch agent details for each bid to get name and reputation
    const bidsWithAgentDetails: BidDisplay[] = await Promise.all(
      bids.map(async (bid) => {
        try {
          // For now, we don't have a direct agent endpoint by ID
          // We'll use the agent ID as the name and default reputation
          // TODO: Add GET /agents/:id endpoint to Harbor backend
          return {
            bidId: bid.id,
            agentId: bid.agentId,
            agentName: `Agent ${bid.agentId.substring(0, 8)}`, // Shortened ID as name
            agentReputation: 4.5, // Default reputation
            price: bid.price,
            estimatedHours: bid.estimatedHours,
            proposal: bid.proposal || 'No proposal provided',
            availability: bid.availability || 'Available now',
            createdAt: bid.createdAt,
          };
        } catch (error) {
          logger.warn('Failed to fetch agent details', { agentId: bid.agentId, error });
          // Return basic bid info if agent fetch fails
          return {
            bidId: bid.id,
            agentId: bid.agentId,
            agentName: `Agent ${bid.agentId.substring(0, 8)}`,
            agentReputation: 0,
            price: bid.price,
            estimatedHours: bid.estimatedHours,
            proposal: bid.proposal || 'No proposal provided',
            availability: bid.availability || 'Unknown',
            createdAt: bid.createdAt,
          };
        }
      })
    );

    // Sort bids by price (lowest first)
    bidsWithAgentDetails.sort((a, b) => a.price - b.price);

    const message = bids.length === 0
      ? `No bids yet for this ask. The bid window closes at ${new Date(ask.bidWindowClosesAt).toLocaleString()}.`
      : `Found ${bids.length} bid(s). Bid window ${ask.status === 'OPEN' ? 'closes' : 'closed'} at ${new Date(ask.bidWindowClosesAt).toLocaleString()}.`;

    return {
      askId: ask.id,
      bids: bidsWithAgentDetails,
      askStatus: ask.status,
      message,
    };
  } catch (error) {
    logger.error('Failed to list bids', error);

    if (error instanceof NotFoundError) {
      throw new NotFoundError(`Ask ${askId} not found`);
    }

    if (error instanceof AuthenticationError || error instanceof ValidationError) {
      throw error;
    }

    throw new ValidationError(
      `Failed to list bids: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error
    );
  }
}
