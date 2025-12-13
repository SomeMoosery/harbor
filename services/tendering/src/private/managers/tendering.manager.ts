import type { Logger } from '@harbor/logger';
import { ConflictError, ForbiddenError } from '@harbor/errors';
import { AskResource } from '../resources/ask.resource.js';
import { BidResource } from '../resources/bid.resource.js';
import { CreateAskRequest } from '../../public/request/createAskRequest.js';
import { Ask } from '../../public/model/ask.js';
import { CreateBidRequest } from '../../public/request/createBidRequest.js';
import { Bid } from '../../public/model/bid.js';
import { BidStatus } from '../../public/model/bidStatus.js';
import { AskStatus } from '../../public/model/askStatus.js';

/**
 * TenderingManager orchestrates business logic across asks and bids
 */
export class TenderingManager {
  constructor(
    private readonly askResource: AskResource,
    private readonly bidResource: BidResource,
    private readonly logger: Logger
  ) {}

  async createAsk(userId: string, data: CreateAskRequest): Promise<Ask> {
    this.logger.info({ userId, data }, 'Creating ask');

    // In a real app, we might:
    // 1. Verify user exists (call UserClient)
    // 2. Check user has sufficient balance (call WalletClient)
    // 3. Lock escrow funds

    return this.askResource.create({
      ...data,
      createdBy: userId,
    });
  }

  async getAsk(id: string): Promise<Ask> {
    return this.askResource.findById(id);
  }

  async listAsks(filters?: { status?: string; createdBy?: string }): Promise<Ask[]> {
    return this.askResource.findAll(filters);
  }

  async createBid(agentId: string, data: CreateBidRequest): Promise<Bid> {
    this.logger.info({ agentId, data }, 'Creating bid');

    // Verify ask exists and is open
    const ask = await this.askResource.findById(data.askId);

    if (ask.status !== AskStatus.OPEN) {
      throw new ConflictError('Ask is not open for bidding');
    }

    // In a real app, verify agent exists (call AgentClient)

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

  async acceptBid(userId: string, bidId: string): Promise<{ bid: Bid; ask: Ask }> {
    this.logger.info({ userId, bidId }, 'Accepting bid');

    // Get the bid
    const bid = await this.bidResource.findById(bidId);

    // Get the ask and verify ownership
    const ask = await this.askResource.findById(bid.askId);

    if (ask.createdBy !== userId) {
      throw new ForbiddenError('Only ask creator can accept bids');
    }

    if (ask.status !== AskStatus.OPEN) {
      throw new ConflictError('Ask is not open');
    }

    if (bid.status !== BidStatus.PENDING) {
      throw new ConflictError('Bid is not pending');
    }

    // Accept the bid
    const acceptedBid = await this.bidResource.updateStatus(bidId, BidStatus.ACCEPTED);

    // Reject all other bids for this ask
    await this.bidResource.rejectOtherBids(bid.askId, bidId);

    // Update ask status to in_progress
    const updatedAsk = await this.askResource.updateStatus(bid.askId, AskStatus.IN_PROGRESS);

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
