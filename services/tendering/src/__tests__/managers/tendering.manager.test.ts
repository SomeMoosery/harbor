import { TenderingManager } from '../../private/managers/tendering.manager.js';
import { AskResource } from '../../private/resources/ask.resource.js';
import { BidResource } from '../../private/resources/bid.resource.js';
import { ConflictError, ForbiddenError, NotFoundError } from '@harbor/errors';
import { createTestDb, closeTestDb, cleanTestDb } from '../setup/testDatabase.js';
import { createMockLogger } from '../setup/mockLogger.js';
import { createMockUserClient } from '../setup/mockUserClient.js';
import { createMockSettlementClient } from '../setup/mockSettlementClient.js';
import type { Sql } from 'postgres';

describe('TenderingManager', () => {
  let sql: Sql;
  let tenderingManager: TenderingManager;
  let askResource: AskResource;
  let bidResource: BidResource;
  let mockLogger: ReturnType<typeof createMockLogger>;
  let mockUserClient: ReturnType<typeof createMockUserClient>;
  let mockSettlementClient: ReturnType<typeof createMockSettlementClient>;

  beforeAll(async () => {
    sql = await createTestDb();
  });

  beforeEach(async () => {
    await cleanTestDb();
    mockLogger = createMockLogger();
    mockUserClient = createMockUserClient();
    mockSettlementClient = createMockSettlementClient();

    askResource = new AskResource(sql, mockLogger);
    bidResource = new BidResource(sql, mockLogger);

    tenderingManager = new TenderingManager(
      askResource,
      bidResource,
      mockUserClient,
      mockLogger
    );

    // Override the settlement client with our mock
    (tenderingManager as any).settlementClient = mockSettlementClient;
  });

  describe('createAsk', () => {
    it('should create an ask successfully for BUYER agent', async () => {
      mockUserClient.getAgent.mockResolvedValue({
        id: 'buyer-agent-123',
        userId: 'user-123',
        name: 'Buyer Agent',
        capabilities: {},
        type: 'BUYER',
      });

      const askData = {
        title: 'Build a Website',
        description: 'Need an e-commerce website',
        requirements: { tech: 'React' },
        minBudget: 5000,
        maxBudget: 10000,
      };

      const ask = await tenderingManager.createAsk('buyer-agent-123', askData);

      expect(ask).toMatchObject({
        title: askData.title,
        description: askData.description,
        createdBy: 'buyer-agent-123',
        status: 'OPEN',
      });
      expect(mockUserClient.getAgent).toHaveBeenCalledWith('buyer-agent-123');
    });

    it('should create an ask for DUAL agent', async () => {
      mockUserClient.getAgent.mockResolvedValue({
        id: 'dual-agent-456',
        userId: 'user-456',
        name: 'Dual Agent',
        capabilities: {},
        type: 'DUAL',
      });

      const ask = await tenderingManager.createAsk('dual-agent-456', {
        title: 'Test Ask',
        description: 'Testing',
        requirements: {},
        minBudget: 100,
        maxBudget: 200,
      });

      expect(ask.createdBy).toBe('dual-agent-456');
    });

    it('should throw ForbiddenError when SELLER agent tries to create ask', async () => {
      mockUserClient.getAgent.mockResolvedValue({
        id: 'seller-agent-789',
        userId: 'user-789',
        name: 'Seller Agent',
        capabilities: {},
        type: 'SELLER',
      });

      await expect(
        tenderingManager.createAsk('seller-agent-789', {
          title: 'Invalid Ask',
          description: 'Should fail',
          requirements: {},
          minBudget: 100,
          maxBudget: 200,
        })
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('getAsk', () => {
    it('should retrieve an ask by id', async () => {
      mockUserClient.getAgent.mockResolvedValue({
        id: 'buyer-agent-123',
        userId: 'user-123',
        name: 'Buyer Agent',
        capabilities: {},
        type: 'BUYER',
      });

      const created = await tenderingManager.createAsk('buyer-agent-123', {
        title: 'Test Ask',
        description: 'For retrieval',
        requirements: {},
        minBudget: 100,
        maxBudget: 200,
      });

      const retrieved = await tenderingManager.getAsk(created.id);

      expect(retrieved).toMatchObject({
        id: created.id,
        title: created.title,
      });
    });
  });

  describe('listAsks', () => {
    beforeEach(async () => {
      mockUserClient.getAgent.mockResolvedValue({
        id: 'buyer-agent-123',
        userId: 'user-123',
        name: 'Buyer Agent',
        capabilities: {},
        type: 'BUYER',
      });

      await tenderingManager.createAsk('buyer-agent-123', {
        title: 'Ask 1',
        description: 'First',
        requirements: {},
        minBudget: 100,
        maxBudget: 200,
      });

      await tenderingManager.createAsk('buyer-agent-123', {
        title: 'Ask 2',
        description: 'Second',
        requirements: {},
        minBudget: 300,
        maxBudget: 400,
      });
    });

    it('should list all asks', async () => {
      const asks = await tenderingManager.listAsks();

      expect(asks).toHaveLength(2);
    });

    it('should filter asks by status', async () => {
      const openAsks = await tenderingManager.listAsks({ status: 'OPEN' });

      expect(openAsks.every(ask => ask.status === 'OPEN')).toBe(true);
    });
  });

  describe('createBid', () => {
    let testAskId: string;

    beforeEach(async () => {
      mockUserClient.getAgent.mockResolvedValue({
        id: 'buyer-agent-123',
        userId: 'user-123',
        name: 'Buyer Agent',
        capabilities: {},
        type: 'BUYER',
      });

      const ask = await tenderingManager.createAsk('buyer-agent-123', {
        title: 'Test Ask',
        description: 'For bidding',
        requirements: {},
        minBudget: 100,
        maxBudget: 200,
      });
      testAskId = ask.id;
    });

    it('should create a bid successfully for SELLER agent', async () => {
      mockUserClient.getAgent.mockResolvedValue({
        id: 'seller-agent-456',
        userId: 'user-456',
        name: 'Seller Agent',
        capabilities: {},
        type: 'SELLER',
      });

      const bidData = {
        askId: testAskId,
        proposedPrice: 150,
        estimatedDuration: 86400000,
        proposal: 'I can do it',
      };

      const bid = await tenderingManager.createBid('seller-agent-456', bidData);

      expect(bid).toMatchObject({
        askId: testAskId,
        agentId: 'seller-agent-456',
        proposedPrice: 150,
        status: 'PENDING',
      });
    });

    it('should create a bid for DUAL agent', async () => {
      mockUserClient.getAgent.mockResolvedValue({
        id: 'dual-agent-789',
        userId: 'user-789',
        name: 'Dual Agent',
        capabilities: {},
        type: 'DUAL',
      });

      const bid = await tenderingManager.createBid('dual-agent-789', {
        askId: testAskId,
        proposedPrice: 180,
        estimatedDuration: 172800000,
        proposal: 'Quick turnaround',
      });

      expect(bid.agentId).toBe('dual-agent-789');
    });

    it('should throw ForbiddenError when BUYER agent tries to create bid', async () => {
      mockUserClient.getAgent.mockResolvedValue({
        id: 'buyer-agent-999',
        userId: 'user-999',
        name: 'Another Buyer',
        capabilities: {},
        type: 'BUYER',
      });

      await expect(
        tenderingManager.createBid('buyer-agent-999', {
          askId: testAskId,
          proposedPrice: 150,
          estimatedDuration: 86400000,
          proposal: 'Should fail',
        })
      ).rejects.toThrow(ForbiddenError);
    });

    it('should throw ConflictError when ask is not OPEN', async () => {
      // Close the ask
      await askResource.updateStatus(testAskId, 'CANCELLED');

      mockUserClient.getAgent.mockResolvedValue({
        id: 'seller-agent-456',
        userId: 'user-456',
        name: 'Seller Agent',
        capabilities: {},
        type: 'SELLER',
      });

      await expect(
        tenderingManager.createBid('seller-agent-456', {
          askId: testAskId,
          proposedPrice: 150,
          estimatedDuration: 86400000,
          proposal: 'Should fail',
        })
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('getBidsForAsk', () => {
    let testAskId: string;

    beforeEach(async () => {
      mockUserClient.getAgent.mockResolvedValue({
        id: 'buyer-agent-123',
        userId: 'user-123',
        name: 'Buyer Agent',
        capabilities: {},
        type: 'BUYER',
      });

      const ask = await tenderingManager.createAsk('buyer-agent-123', {
        title: 'Test Ask',
        description: 'For bidding',
        requirements: {},
        minBudget: 100,
        maxBudget: 200,
      });
      testAskId = ask.id;

      // Create some bids
      mockUserClient.getAgent.mockResolvedValue({
        id: 'seller-agent-1',
        userId: 'user-1',
        name: 'Seller 1',
        capabilities: {},
        type: 'SELLER',
      });

      await tenderingManager.createBid('seller-agent-1', {
        askId: testAskId,
        proposedPrice: 150,
        estimatedDuration: 86400000,
        proposal: 'Bid 1',
      });

      mockUserClient.getAgent.mockResolvedValue({
        id: 'seller-agent-2',
        userId: 'user-2',
        name: 'Seller 2',
        capabilities: {},
        type: 'SELLER',
      });

      await tenderingManager.createBid('seller-agent-2', {
        askId: testAskId,
        proposedPrice: 180,
        estimatedDuration: 172800000,
        proposal: 'Bid 2',
      });
    });

    it('should retrieve all bids for an ask', async () => {
      const bids = await tenderingManager.getBidsForAsk(testAskId);

      expect(bids).toHaveLength(2);
      expect(bids.every(bid => bid.askId === testAskId)).toBe(true);
    });
  });

  describe('acceptBid', () => {
    let testAskId: string;
    let testBidId: string;
    const buyerAgentId = 'buyer-agent-123';
    const sellerAgentId = 'seller-agent-456';

    beforeEach(async () => {
      // Create ask
      mockUserClient.getAgent.mockResolvedValue({
        id: buyerAgentId,
        userId: 'user-123',
        name: 'Buyer Agent',
        capabilities: {},
        type: 'BUYER',
      });

      const ask = await tenderingManager.createAsk(buyerAgentId, {
        title: 'Test Ask',
        description: 'For accepting bids',
        requirements: {},
        minBudget: 100,
        maxBudget: 200,
      });
      testAskId = ask.id;

      // Create bid
      mockUserClient.getAgent.mockResolvedValue({
        id: sellerAgentId,
        userId: 'user-456',
        name: 'Seller Agent',
        capabilities: {},
        type: 'SELLER',
      });

      const bid = await tenderingManager.createBid(sellerAgentId, {
        askId: testAskId,
        proposedPrice: 150,
        estimatedDuration: 86400000,
        proposal: 'Good offer',
      });
      testBidId = bid.id;
    });

    it('should accept a bid successfully', async () => {
      const result = await tenderingManager.acceptBid(buyerAgentId, testBidId);

      expect(result.bid.status).toBe('ACCEPTED');
      expect(result.ask.status).toBe('IN_PROGRESS');
      expect(mockSettlementClient.lockEscrow).toHaveBeenCalledWith({
        askId: testAskId,
        bidId: testBidId,
        buyerAgentId,
        amount: 150,
        currency: 'USDC',
      });
    });

    it('should reject other bids when accepting one', async () => {
      // Create another bid
      const bid2 = await tenderingManager.createBid(sellerAgentId, {
        askId: testAskId,
        proposedPrice: 180,
        estimatedDuration: 172800000,
        proposal: 'Another offer',
      });

      await tenderingManager.acceptBid(buyerAgentId, testBidId);

      const rejectedBid = await bidResource.findById(bid2.id);
      expect(rejectedBid.status).toBe('REJECTED');
    });

    it('should throw ForbiddenError when non-owner tries to accept bid', async () => {
      const differentAgentId = 'different-agent-999';

      await expect(
        tenderingManager.acceptBid(differentAgentId, testBidId)
      ).rejects.toThrow(ForbiddenError);
    });

    it('should throw ConflictError when ask is not OPEN', async () => {
      await askResource.updateStatus(testAskId, 'CANCELLED');

      await expect(
        tenderingManager.acceptBid(buyerAgentId, testBidId)
      ).rejects.toThrow(ConflictError);
    });

    it('should throw ConflictError when bid is not PENDING', async () => {
      await bidResource.updateStatus(testBidId, 'REJECTED');

      await expect(
        tenderingManager.acceptBid(buyerAgentId, testBidId)
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('submitDelivery', () => {
    let testAskId: string;
    let testBidId: string;
    const buyerAgentId = 'buyer-agent-123';
    const sellerAgentId = 'seller-agent-456';

    beforeEach(async () => {
      // Create and accept a bid
      mockUserClient.getAgent.mockResolvedValue({
        id: buyerAgentId,
        userId: 'user-123',
        name: 'Buyer Agent',
        capabilities: {},
        type: 'BUYER',
      });

      const ask = await tenderingManager.createAsk(buyerAgentId, {
        title: 'Test Ask',
        description: 'For delivery',
        requirements: {},
        minBudget: 100,
        maxBudget: 200,
      });
      testAskId = ask.id;

      mockUserClient.getAgent.mockResolvedValue({
        id: sellerAgentId,
        userId: 'user-456',
        name: 'Seller Agent',
        capabilities: {},
        type: 'SELLER',
      });

      const bid = await tenderingManager.createBid(sellerAgentId, {
        askId: testAskId,
        proposedPrice: 150,
        estimatedDuration: 86400000,
        proposal: 'Will deliver',
      });
      testBidId = bid.id;

      await tenderingManager.acceptBid(buyerAgentId, testBidId);
    });

    it('should submit delivery successfully', async () => {
      const deliveryProof = { fileUrl: 'https://example.com/delivery.zip' };

      const result = await tenderingManager.submitDelivery(
        sellerAgentId,
        testBidId,
        deliveryProof
      );

      expect(result.ask.status).toBe('COMPLETED');
      expect(mockSettlementClient.releaseEscrow).toHaveBeenCalledWith({
        escrowLockId: 'escrow-123',
        sellerAgentId,
        deliveryProof,
      });
    });

    it('should throw ForbiddenError when non-seller tries to submit delivery', async () => {
      await expect(
        tenderingManager.submitDelivery(buyerAgentId, testBidId)
      ).rejects.toThrow(ForbiddenError);
    });

    it('should throw ConflictError when bid is not ACCEPTED', async () => {
      // Create a new ask and bid that hasn't been accepted yet
      mockUserClient.getAgent.mockResolvedValue({
        id: buyerAgentId,
        userId: 'user-123',
        name: 'Buyer Agent',
        capabilities: {},
        type: 'BUYER',
      });

      const newAsk = await tenderingManager.createAsk(buyerAgentId, {
        title: 'Another Ask',
        description: 'For pending bid test',
        requirements: {},
        minBudget: 100,
        maxBudget: 200,
      });

      mockUserClient.getAgent.mockResolvedValue({
        id: sellerAgentId,
        userId: 'user-456',
        name: 'Seller Agent',
        capabilities: {},
        type: 'SELLER',
      });

      const pendingBid = await tenderingManager.createBid(sellerAgentId, {
        askId: newAsk.id,
        proposedPrice: 180,
        estimatedDuration: 86400000,
        proposal: 'Pending bid',
      });

      await expect(
        tenderingManager.submitDelivery(sellerAgentId, pendingBid.id)
      ).rejects.toThrow(ConflictError);
    });
  });

  afterAll(async () => {
    await closeTestDb();
  });
});
