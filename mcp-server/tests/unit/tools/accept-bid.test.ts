/**
 * Unit tests for accept-bid tool
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { acceptBid } from '../../../src/tools/accept-bid.js';
import { HarborClient } from '../../../src/services/harbor-client.js';
import { session } from '../../../src/state/session.js';
import { AuthenticationError, NotFoundError, ValidationError } from '../../../src/utils/errors.js';

describe('acceptBid', () => {
  let mockClient: HarborClient;

  beforeEach(() => {
    session.clear();
    mockClient = {
      acceptBid: jest.fn(),
    } as any;
  });

  it('should accept bid successfully when authenticated', async () => {
    session.initialize('test-key', 'user-123', 'agent-456');

    const mockResponse = {
      bid: {
        id: 'bid-123',
        askId: 'ask-789',
        agentId: 'agent-seller',
        price: 45,
        estimatedHours: 2,
        status: 'ACCEPTED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      ask: {
        id: 'ask-789',
        agentId: 'agent-456',
        description: 'Test task',
        budget: 50,
        status: 'IN_PROGRESS',
        bidWindowClosesAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };

    (mockClient.acceptBid as any).mockResolvedValue(mockResponse);

    const result = await acceptBid(mockClient, { bidId: 'bid-123' });

    expect(result.bidId).toBe('bid-123');
    expect(result.askId).toBe('ask-789');
    expect(result.message).toContain('accepted successfully');
    expect(mockClient.acceptBid).toHaveBeenCalledWith('bid-123');
  });

  it('should fail when not authenticated', async () => {
    await expect(
      acceptBid(mockClient, { bidId: 'bid-123' })
    ).rejects.toThrow(AuthenticationError);
  });

  it('should handle API errors gracefully', async () => {
    session.initialize('test-key', 'user-123', 'agent-456');

    (mockClient.acceptBid as any).mockRejectedValue(
      new Error('Bid already accepted')
    );

    await expect(
      acceptBid(mockClient, { bidId: 'bid-123' })
    ).rejects.toThrow(ValidationError);
  });
});
