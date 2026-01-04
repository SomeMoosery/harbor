/**
 * Unit tests for list-bids tool
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { listBids } from '../../../src/tools/list-bids.js';
import { HarborClient } from '../../../src/services/harbor-client.js';
import { session } from '../../../src/state/session.js';
import { AuthenticationError, ValidationError } from '../../../src/utils/errors.js';

describe('listBids', () => {
  let mockClient: HarborClient;

  beforeEach(() => {
    session.clear();
    mockClient = {
      getBidsForAsk: jest.fn(),
      getAsk: jest.fn(),
    } as any;
  });

  afterEach(() => {
    session.clear();
    jest.clearAllMocks();
  });

  it('should list bids successfully when authenticated with active ask', async () => {
    // Initialize session with active ask
    session.initialize('test-key', 'user-123', 'agent-456');
    session.setActiveAsk('ask-789');

    const mockAsk = {
      id: 'ask-789',
      agentId: 'agent-456',
      description: 'Test task',
      budget: 50,
      status: 'OPEN',
      bidWindowClosesAt: new Date(Date.now() + 3600000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const mockBids = [
      {
        id: 'bid-1',
        askId: 'ask-789',
        agentId: 'agent-111',
        price: 45,
        estimatedHours: 2,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'bid-2',
        askId: 'ask-789',
        agentId: 'agent-222',
        price: 50,
        estimatedHours: 3,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    (mockClient.getAsk as any).mockResolvedValue(mockAsk);
    (mockClient.getBidsForAsk as any).mockResolvedValue(mockBids);

    const result = await listBids(mockClient, {});

    expect(result.bids).toHaveLength(2);
    expect(result.bids[0]!.price).toBe(45);
    expect(result.bids[1]!.price).toBe(50);
    expect(result.message).toContain('Found 2 bid');
  });

  it('should list bids for specific askId when provided', async () => {
    session.initialize('test-key', 'user-123', 'agent-456');

    const mockAsk = {
      id: 'ask-custom',
      agentId: 'agent-456',
      description: 'Test task',
      budget: 50,
      status: 'OPEN',
      bidWindowClosesAt: new Date(Date.now() + 3600000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const mockBids = [
      {
        id: 'bid-1',
        askId: 'ask-custom',
        agentId: 'agent-111',
        price: 45,
        estimatedHours: 2,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    (mockClient.getAsk as any).mockResolvedValue(mockAsk);
    (mockClient.getBidsForAsk as any).mockResolvedValue(mockBids);

    const result = await listBids(mockClient, { askId: 'ask-custom' });

    expect(result.bids).toHaveLength(1);
    expect(mockClient.getBidsForAsk).toHaveBeenCalledWith('ask-custom');
  });

  it('should fail when not authenticated', async () => {
    await expect(listBids(mockClient, {})).rejects.toThrow(AuthenticationError);
  });

  it('should fail when no active ask and no askId provided', async () => {
    session.initialize('test-key', 'user-123', 'agent-456');

    await expect(listBids(mockClient, {})).rejects.toThrow(ValidationError);
  });

  it('should handle no bids gracefully', async () => {
    session.initialize('test-key', 'user-123', 'agent-456');
    session.setActiveAsk('ask-789');

    const mockAsk = {
      id: 'ask-789',
      agentId: 'agent-456',
      description: 'Test task',
      budget: 50,
      status: 'OPEN',
      bidWindowClosesAt: new Date(Date.now() + 3600000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    (mockClient.getAsk as any).mockResolvedValue(mockAsk);
    (mockClient.getBidsForAsk as any).mockResolvedValue([]);

    const result = await listBids(mockClient, {});

    expect(result.bids).toHaveLength(0);
    expect(result.message).toContain('No bids');
  });

  it('should sort bids by price ascending', async () => {
    session.initialize('test-key', 'user-123', 'agent-456');
    session.setActiveAsk('ask-789');

    const mockAsk = {
      id: 'ask-789',
      agentId: 'agent-456',
      description: 'Test task',
      budget: 50,
      status: 'OPEN',
      bidWindowClosesAt: new Date(Date.now() + 3600000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const mockBids = [
      {
        id: 'bid-1',
        askId: 'ask-789',
        agentId: 'agent-111',
        price: 50,
        estimatedHours: 3,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'bid-2',
        askId: 'ask-789',
        agentId: 'agent-222',
        price: 30,
        estimatedHours: 2,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'bid-3',
        askId: 'ask-789',
        agentId: 'agent-333',
        price: 40,
        estimatedHours: 2.5,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    (mockClient.getAsk as any).mockResolvedValue(mockAsk);
    (mockClient.getBidsForAsk as any).mockResolvedValue(mockBids);

    const result = await listBids(mockClient, {});

    expect(result.bids[0]!.price).toBe(30);
    expect(result.bids[1]!.price).toBe(40);
    expect(result.bids[2]!.price).toBe(50);
  });
});
