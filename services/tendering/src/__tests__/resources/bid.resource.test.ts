import { BidResource } from '../../private/resources/bid.resource.js';
import { AskResource } from '../../private/resources/ask.resource.js';
import type { BidStatus } from '../../public/model/bidStatus.js';
import { NotFoundError } from '@harbor/errors';
import { createTestDb } from '../setup/testDatabase.js';
import { createMockLogger } from '../setup/mockLogger.js';

describe('BidResource', () => {
  let db: ReturnType<typeof createTestDb>;
  let bidResource: BidResource;
  let askResource: AskResource;
  let mockLogger: ReturnType<typeof createMockLogger>;
  let testAskId: string;

  beforeEach(async () => {
    db = createTestDb();
    mockLogger = createMockLogger();
    bidResource = new BidResource(db, mockLogger);
    askResource = new AskResource(db, mockLogger);

    // Create a test ask to bid on
    const ask = await askResource.create({
      title: 'Test Ask',
      description: 'For testing bids',
      requirements: {},
      minBudget: 100,
      maxBudget: 200,
      createdBy: 'buyer-agent-123',
    });
    testAskId = ask.id;
  });

  describe('create', () => {
    it('should create a bid and return it', async () => {
      const bidData = {
        askId: testAskId,
        agentId: 'seller-agent-456',
        proposedPrice: 150,
        estimatedDuration: 86400000, // 1 day in ms
        proposal: 'I can complete this within one day',
      };

      const bid = await bidResource.create(bidData);

      expect(bid).toMatchObject({
        askId: bidData.askId,
        agentId: bidData.agentId,
        proposedPrice: bidData.proposedPrice,
        estimatedDuration: bidData.estimatedDuration,
        proposal: bidData.proposal,
        status: 'PENDING',
      });
      expect(bid.id).toBeDefined();
      expect(typeof bid.id).toBe('string');
    });

    it('should default status to PENDING', async () => {
      const bid = await bidResource.create({
        askId: testAskId,
        agentId: 'seller-agent-789',
        proposedPrice: 180,
        estimatedDuration: 172800000,
        proposal: 'Can do it in 2 days',
      });

      expect(bid.status).toBe('PENDING');
    });
  });

  describe('findById', () => {
    it('should find bid by id', async () => {
      const created = await bidResource.create({
        askId: testAskId,
        agentId: 'seller-agent-123',
        proposedPrice: 160,
        estimatedDuration: 86400000,
        proposal: 'Quick turnaround',
      });

      const found = await bidResource.findById(created.id);

      expect(found).toMatchObject({
        id: created.id,
        askId: created.askId,
        agentId: created.agentId,
        proposedPrice: created.proposedPrice,
      });
    });

    it('should throw NotFoundError when bid does not exist', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      await expect(bidResource.findById(fakeId)).rejects.toThrow(NotFoundError);
    });
  });

  describe('findByAskId', () => {
    it('should retrieve all bids for an ask', async () => {
      await bidResource.create({
        askId: testAskId,
        agentId: 'seller-1',
        proposedPrice: 150,
        estimatedDuration: 86400000,
        proposal: 'Bid 1',
      });

      await bidResource.create({
        askId: testAskId,
        agentId: 'seller-2',
        proposedPrice: 180,
        estimatedDuration: 172800000,
        proposal: 'Bid 2',
      });

      const bids = await bidResource.findByAskId(testAskId);

      expect(bids).toHaveLength(2);
      expect(bids.every(bid => bid.askId === testAskId)).toBe(true);
    });

    it('should return empty array when ask has no bids', async () => {
      const anotherAsk = await askResource.create({
        title: 'Another Ask',
        description: 'No bids yet',
        requirements: {},
        minBudget: 100,
        maxBudget: 200,
        createdBy: 'buyer-agent-789',
      });

      const bids = await bidResource.findByAskId(anotherAsk.id);

      expect(bids).toEqual([]);
    });
  });

  describe('findByAgentId', () => {
    it('should retrieve all bids by an agent', async () => {
      const agentId = 'seller-agent-123';

      await bidResource.create({
        askId: testAskId,
        agentId,
        proposedPrice: 150,
        estimatedDuration: 86400000,
        proposal: 'First bid',
      });

      // Create another ask and bid on it
      const ask2 = await askResource.create({
        title: 'Second Ask',
        description: 'Another opportunity',
        requirements: {},
        minBudget: 200,
        maxBudget: 300,
        createdBy: 'buyer-agent-456',
      });

      await bidResource.create({
        askId: ask2.id,
        agentId,
        proposedPrice: 250,
        estimatedDuration: 172800000,
        proposal: 'Second bid',
      });

      const bids = await bidResource.findByAgentId(agentId);

      expect(bids).toHaveLength(2);
      expect(bids.every(bid => bid.agentId === agentId)).toBe(true);
    });

    it('should return empty array when agent has no bids', async () => {
      const bids = await bidResource.findByAgentId('non-existent-agent');

      expect(bids).toEqual([]);
    });
  });

  describe('updateStatus', () => {
    it('should update bid status successfully', async () => {
      const bid = await bidResource.create({
        askId: testAskId,
        agentId: 'seller-agent-123',
        proposedPrice: 150,
        estimatedDuration: 86400000,
        proposal: 'Good deal',
      });

      const updated = await bidResource.updateStatus(bid.id, 'ACCEPTED');

      expect(updated.status).toBe('ACCEPTED');
      expect(updated.id).toBe(bid.id);
    });

    it('should update status to REJECTED', async () => {
      const bid = await bidResource.create({
        askId: testAskId,
        agentId: 'seller-agent-456',
        proposedPrice: 200,
        estimatedDuration: 86400000,
        proposal: 'Too expensive',
      });

      const updated = await bidResource.updateStatus(bid.id, 'REJECTED');

      expect(updated.status).toBe('REJECTED');
    });

    it('should throw NotFoundError for non-existent bid', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      await expect(
        bidResource.updateStatus(fakeId, 'ACCEPTED')
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('rejectOtherBids', () => {
    it('should reject all pending bids except the accepted one', async () => {
      const bid1 = await bidResource.create({
        askId: testAskId,
        agentId: 'seller-1',
        proposedPrice: 150,
        estimatedDuration: 86400000,
        proposal: 'Bid 1',
      });

      const bid2 = await bidResource.create({
        askId: testAskId,
        agentId: 'seller-2',
        proposedPrice: 160,
        estimatedDuration: 86400000,
        proposal: 'Bid 2',
      });

      const bid3 = await bidResource.create({
        askId: testAskId,
        agentId: 'seller-3',
        proposedPrice: 170,
        estimatedDuration: 86400000,
        proposal: 'Bid 3',
      });

      // Accept bid1
      await bidResource.updateStatus(bid1.id, 'ACCEPTED');
      await bidResource.rejectOtherBids(testAskId, bid1.id);

      // Check that bid1 is still accepted
      const acceptedBid = await bidResource.findById(bid1.id);
      expect(acceptedBid.status).toBe('ACCEPTED');

      // Check that other bids are rejected
      const rejectedBid2 = await bidResource.findById(bid2.id);
      const rejectedBid3 = await bidResource.findById(bid3.id);

      expect(rejectedBid2.status).toBe('REJECTED');
      expect(rejectedBid3.status).toBe('REJECTED');
    });

    it('should not affect bids from other asks', async () => {
      const bid1 = await bidResource.create({
        askId: testAskId,
        agentId: 'seller-1',
        proposedPrice: 150,
        estimatedDuration: 86400000,
        proposal: 'Bid 1',
      });

      // Create another ask and bid
      const ask2 = await askResource.create({
        title: 'Another Ask',
        description: 'Different ask',
        requirements: {},
        minBudget: 100,
        maxBudget: 200,
        createdBy: 'buyer-agent-999',
      });

      const bid2 = await bidResource.create({
        askId: ask2.id,
        agentId: 'seller-2',
        proposedPrice: 160,
        estimatedDuration: 86400000,
        proposal: 'Bid 2',
      });

      await bidResource.updateStatus(bid1.id, 'ACCEPTED');
      await bidResource.rejectOtherBids(testAskId, bid1.id);

      // Bid from other ask should remain pending
      const unaffectedBid = await bidResource.findById(bid2.id);
      expect(unaffectedBid.status).toBe('PENDING');
    });
  });
});
