/**
 * Get Delivery tool implementation
 */

import type { HarborClient } from '../services/harbor-client.js';
import type { GetDeliveryInput, GetDeliveryOutput } from '../types/mcp.js';
import { session } from '../state/session.js';
import { logger } from '../utils/logger.js';
import { AuthenticationError, ValidationError, NotFoundError } from '../utils/errors.js';

export async function getDelivery(
  client: HarborClient,
  input: GetDeliveryInput
): Promise<GetDeliveryOutput> {
  logger.info('Getting delivery', { askId: input.askId });

  // Check if authenticated
  if (!session.isAuthenticated()) {
    throw new AuthenticationError('Must authenticate first using authenticate_user tool');
  }

  // Determine which ask to use
  const state = session.getState();
  const askId = input.askId || state.activeAskId;

  if (!askId) {
    throw new NotFoundError(
      'No ask ID provided and no active ask found. Accept a bid first using accept_bid tool.'
    );
  }

  try {
    // Get the ask details
    const ask = await client.getAsk(askId);

    logger.info('Retrieved ask for delivery check', {
      askId: ask.id,
      status: ask.status,
      hasDeliveryData: !!ask.deliveryData,
    });

    // Check if delivery is complete
    if (ask.status === 'COMPLETED' && ask.deliveryData) {
      logger.info('Delivery completed', {
        askId: ask.id,
        deliveryDataKeys: Object.keys(ask.deliveryData),
      });

      return {
        askId: ask.id,
        status: ask.status,
        deliveryData: ask.deliveryData,
        message: 'Delivery complete! The seller has submitted their work. Review the deliveryData below and integrate it into your workflow.',
      };
    }

    // Delivery not ready yet
    if (ask.status === 'IN_PROGRESS') {
      return {
        askId: ask.id,
        status: ask.status,
        message: 'Job is still in progress. The seller is working on your task. Check back later or wait for notification.',
      };
    }

    if (ask.status === 'OPEN') {
      return {
        askId: ask.id,
        status: ask.status,
        message: 'Ask is still open for bidding. Accept a bid first using accept_bid tool.',
      };
    }

    // Other statuses
    return {
      askId: ask.id,
      status: ask.status,
      message: `Ask status is ${ask.status}. No delivery available.`,
    };
  } catch (error) {
    logger.error('Failed to get delivery', error);

    if (error instanceof NotFoundError) {
      throw new NotFoundError(`Ask ${input.askId} not found`);
    }

    if (error instanceof AuthenticationError || error instanceof ValidationError) {
      throw error;
    }

    throw new ValidationError(
      `Failed to get delivery: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error
    );
  }
}
