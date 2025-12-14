import type { Logger } from '@harbor/logger';
import { ConflictError, ForbiddenError } from '@harbor/errors';
import { UserClient } from '@harbor/user/client';
import { AskResource } from '../resources/ask.resource.js';
import { BidResource } from '../resources/bid.resource.js';
import { CreateAskRequest } from '../../public/request/createAskRequest.js';
import { Ask } from '../../public/model/ask.js';
import { CreateBidRequest } from '../../public/request/createBidRequest.js';
import { Bid } from '../../public/model/bid.js';
import { AskStatus } from '../../public/model/askStatus.js';

/**
 * TenderingManager orchestrates business logic across asks and bids
 */
export class TenderingManager {
  constructor(
    private readonly askResource: AskResource,
    private readonly bidResource: BidResource,
    private readonly userClient: UserClient,
    private readonly logger: Logger
  ) {}

  async createAsk(agentId: string, data: CreateAskRequest): Promise<Ask> {
    this.logger.info({ agentId, data }, 'Creating ask');

    // Verify agent exists and has permission to create asks
    const agent = await this.userClient.getAgent(agentId);

    // Only BUYER or DUAL agents can create asks
    if (agent.type !== 'BUYER' && agent.type !== 'DUAL') {
      throw new ForbiddenError('Only BUYER or DUAL agents can create asks');
    }

    // In a real app, we might also:
    // 1. Check user has sufficient balance (call WalletClient)
    // 2. Lock escrow funds

    return this.askResource.create({
      ...data,
      createdBy: agentId,
    });
  }

  async getAsk(id: string): Promise<Ask> {
    return this.askResource.findById(id);
  }

  async listAsks(filters?: { status?: AskStatus; createdBy?: string }): Promise<Ask[]> {
    return this.askResource.findAll(filters);
  }

  async createBid(agentId: string, data: CreateBidRequest): Promise<Bid> {
    this.logger.info({ agentId, data }, 'Creating bid');

    // Verify ask exists and is open
    const ask = await this.askResource.findById(data.askId);

    if (ask.status !== 'OPEN') {
      throw new ConflictError('Ask is not open for bidding');
    }

    // Verify agent exists and has permission to create bids
    const agent = await this.userClient.getAgent(agentId);

    // Only SELLER or DUAL agents can create bids
    if (agent.type !== 'SELLER' && agent.type !== 'DUAL') {
      throw new ForbiddenError('Only SELLER or DUAL agents can create bids');
    }

    return this.bidResource.create({
      askId: data.askId,
      proposedPrice: data.proposedPrice,
      estimatedDuration: data.estimatedDuration,
      proposal: data.proposal,
      agentId,
    });
  }

  async getBidsForAsk(askId: string): Promise<Bid[]> {
    return this.bidResource.findByAskId(askId);
  }

  async acceptBid(agentId: string, bidId: string): Promise<{ bid: Bid; ask: Ask }> {
    this.logger.info({ agentId, bidId }, 'Accepting bid');

    // Get the bid
    const bid = await this.bidResource.findById(bidId);

    // Get the ask and verify ownership
    const ask = await this.askResource.findById(bid.askId);

    if (ask.createdBy !== agentId) {
      throw new ForbiddenError('Only ask creator can accept bids');
    }

    if (ask.status !== 'OPEN') {
      throw new ConflictError('Ask is not open');
    }

    if (bid.status !== 'PENDING') {
      throw new ConflictError('Bid is not pending');
    }

    // Accept the bid
    const acceptedBid = await this.bidResource.updateStatus(bidId, 'ACCEPTED');

    // Reject all other bids for this ask
    await this.bidResource.rejectOtherBids(bid.askId, bidId);

    // Update ask status to in_progress
    const updatedAsk = await this.askResource.updateStatus(bid.askId, 'IN_PROGRESS');

    // In a real app:
    // 1. Lock escrow funds (call EscrowClient)
    // 2. Create contract (call separate service)
    // 3. Notify agent via WebSocket

    return {
      bid: acceptedBid,
      ask: updatedAsk,
    };
  }
}
