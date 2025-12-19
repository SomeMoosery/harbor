import type { Logger } from '@harbor/logger';
import { ConflictError, ForbiddenError } from '@harbor/errors';
import { UserClient } from '@harbor/user/client';
import { SettlementClient } from '@harbor/settlement/client';
import { AskResource } from '../resources/ask.resource.js';
import { BidResource } from '../resources/bid.resource.js';
import { CreateAskRequest } from '../../public/request/createAskRequest.js';
import { Ask } from '../../public/model/ask.js';
import { CreateBidRequest } from '../../public/request/createBidRequest.js';
import { Bid } from '../../public/model/bid.js';
import { AskStatus } from '../../public/model/askStatus.js';
import { EventPublisher } from '../utils/eventPublisher.js';

/**
 * TenderingManager orchestrates business logic across asks and bids
 */
export class TenderingManager {
  private readonly settlementClient: SettlementClient;
  private readonly eventPublisher: EventPublisher;

  constructor(
    private readonly askResource: AskResource,
    private readonly bidResource: BidResource,
    private readonly userClient: UserClient,
    private readonly logger: Logger
  ) {
    this.settlementClient = new SettlementClient();
    this.eventPublisher = new EventPublisher(logger);
  }

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

    const ask = await this.askResource.create({
      ...data,
      createdBy: agentId,
    });

    // Publish ask_created event
    await this.eventPublisher.publishAskCreated({
      askId: ask.id,
      agentId: ask.createdBy,
      description: ask.description,
      maxPrice: ask.maxBudget,
      currency: 'USDC', // TODO: Add currency to Ask model
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // TODO: Add expiresAt to Ask model
    });

    return ask;
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

    const bid = await this.bidResource.create({
      askId: data.askId,
      proposedPrice: data.proposedPrice,
      estimatedDuration: data.estimatedDuration,
      proposal: data.proposal,
      agentId,
    });

    // Publish bid_created event
    await this.eventPublisher.publishBidCreated({
      bidId: bid.id,
      askId: bid.askId,
      agentId: bid.agentId,
      price: bid.proposedPrice,
      currency: 'USDC', // TODO: Add currency to Bid model
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // TODO: Add expiresAt to Bid model
    });

    return bid;
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
    // TODO "updateStatus" and "rejectOtherBids" and the next "updateStatus" should all be transactional
    const acceptedBid = await this.bidResource.updateStatus(bidId, 'ACCEPTED');

    // Reject all other bids for this ask
    await this.bidResource.rejectOtherBids(bid.askId, bidId);

    // Update ask status to in_progress
    const updatedAsk = await this.askResource.updateStatus(bid.askId, 'IN_PROGRESS');

    // Lock escrow funds
    // TODO this should somehow be abstracted away to "move funds" once we have a clearer picture of
    //  how the credit systems will take place (eg does the Buyer extend credit? Third party?)
    let contractId: string;
    try {
      const escrowLock = await this.settlementClient.lockEscrow({
        askId: ask.id,
        bidId: bid.id,
        buyerAgentId: ask.createdBy,
        amount: bid.proposedPrice,
        currency: 'USDC',
      });

      contractId = escrowLock.id; // Use escrow lock ID as contract ID
      this.logger.info({ bidId, askId: ask.id, contractId }, 'Escrow funds locked successfully');
    } catch (error) {
      this.logger.error({ error, bidId, askId: ask.id }, 'Failed to lock escrow funds');
      throw error;
    }

    // Publish bid_accepted event
    await this.eventPublisher.publishBidAccepted({
      bidId: acceptedBid.id,
      askId: updatedAsk.id,
      contractId,
    });

    return {
      bid: acceptedBid,
      ask: updatedAsk,
    };
  }

  async submitDelivery(
    agentId: string,
    bidId: string,
    deliveryProof?: Record<string, unknown>
  ): Promise<{ bid: Bid; ask: Ask }> {
    this.logger.info({ agentId, bidId }, 'Submitting delivery');

    // Get the bid
    const bid = await this.bidResource.findById(bidId);

    // Verify the agent is the bid creator (seller)
    if (bid.agentId !== agentId) {
      throw new ForbiddenError('Only bid creator can submit delivery');
    }

    if (bid.status !== 'ACCEPTED') {
      throw new ConflictError('Bid must be accepted before delivery can be submitted');
    }

    // Get the ask
    const ask = await this.askResource.findById(bid.askId);

    if (ask.status !== 'IN_PROGRESS') {
      throw new ConflictError('Ask must be in progress');
    }

    // Get escrow lock for this bid
    const escrowLock = await this.settlementClient.getEscrowLockByBidId(bidId);

    if (!escrowLock) {
      throw new Error('No escrow lock found for this bid');
    }

    // Release escrow funds to seller
    try {
      await this.settlementClient.releaseEscrow({
        escrowLockId: escrowLock.id,
        sellerAgentId: agentId,
        deliveryProof,
      });

      this.logger.info({ bidId, escrowLockId: escrowLock.id }, 'Escrow funds released successfully');
    } catch (error) {
      this.logger.error({ error, bidId }, 'Failed to release escrow funds');
      throw error;
    }

    // Update ask status to completed
    const updatedAsk = await this.askResource.updateStatus(ask.id, 'COMPLETED');

    // Publish delivery_submitted event
    await this.eventPublisher.publishDeliverySubmitted({
      contractId: escrowLock.id,
      deliveryData: deliveryProof,
    });

    return {
      bid,
      ask: updatedAsk,
    };
  }
}
