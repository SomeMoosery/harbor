/**
 * Unit tests for BidPollingService
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { BidPollingService } from '../../../src/services/polling.js';
import { HarborClient } from '../../../src/services/harbor-client.js';

describe('BidPollingService', () => {
  let mockClient: HarborClient;
  let pollingService: BidPollingService;

  beforeEach(() => {
    jest.useFakeTimers();
    mockClient = {
      getAsk: jest.fn(),
      getBidsForAsk: jest.fn(),
    } as any;
    pollingService = new BidPollingService(mockClient);
  });

  afterEach(() => {
    pollingService.stopPolling();
    jest.clearAllTimers();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('should start polling and call callbacks', async () => {
    const mockAsk = {
      id: 'ask-123',
      status: 'OPEN',
      bidWindowClosesAt: new Date(Date.now() + 3600000).toISOString(),
      agentId: 'agent-456',
      description: 'Test',
      budget: 50,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const mockBids = [
      {
        id: 'bid-1',
        askId: 'ask-123',
        agentId: 'agent-789',
        price: 45,
        estimatedHours: 2,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    (mockClient.getAsk as any).mockResolvedValue(mockAsk);
    (mockClient.getBidsForAsk as any).mockResolvedValue(mockBids);

    const onBidsUpdate = jest.fn();
    const onWindowClosed = jest.fn();

    await pollingService.startPolling('ask-123', onBidsUpdate, onWindowClosed);

    // Should call immediately
    expect(onBidsUpdate).toHaveBeenCalledWith(mockBids, mockAsk);

    // Advance timer by 15 seconds and run pending timers
    await jest.advanceTimersByTimeAsync(15000);

    // Should call again after interval
    expect(onBidsUpdate).toHaveBeenCalledTimes(2);
  });

  it('should stop polling when bid window closes', async () => {
    const mockAsk = {
      id: 'ask-123',
      status: 'CLOSED',
      bidWindowClosesAt: new Date(Date.now() - 1000).toISOString(),
      agentId: 'agent-456',
      description: 'Test',
      budget: 50,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    (mockClient.getAsk as any).mockResolvedValue(mockAsk);
    (mockClient.getBidsForAsk as any).mockResolvedValue([]);

    const onBidsUpdate = jest.fn();
    const onWindowClosed = jest.fn();

    await pollingService.startPolling('ask-123', onBidsUpdate, onWindowClosed);

    expect(onWindowClosed).toHaveBeenCalled();
    expect(pollingService.isPolling()).toBe(false);
  });

  it('should handle polling errors gracefully', async () => {
    (mockClient.getAsk as any).mockRejectedValue(new Error('API error'));

    const onBidsUpdate = jest.fn();
    const onWindowClosed = jest.fn();

    await pollingService.startPolling('ask-123', onBidsUpdate, onWindowClosed);

    // Should not throw, should continue polling
    expect(pollingService.isPolling()).toBe(true);

    pollingService.stopPolling();
  });
});
