/**
 * Unit tests for DeliveryPollingService
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { DeliveryPollingService } from '../../../src/services/delivery-polling.js';
import { HarborClient } from '../../../src/services/harbor-client.js';

describe('DeliveryPollingService', () => {
  let mockClient: HarborClient;
  let pollingService: DeliveryPollingService;

  beforeEach(() => {
    jest.useFakeTimers();
    mockClient = {
      getAsk: jest.fn(),
    } as any;
    pollingService = new DeliveryPollingService(mockClient);
  });

  afterEach(() => {
    pollingService.stopPolling();
    jest.clearAllTimers();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('should start polling and call callback when delivery received', async () => {
    const mockAsk = {
      id: 'ask-123',
      status: 'COMPLETED',
      deliveryData: {
        result: 'Task completed',
      },
      bidWindowClosesAt: new Date().toISOString(),
      agentId: 'agent-456',
      description: 'Test',
      budget: 50,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    (mockClient.getAsk as any).mockResolvedValue(mockAsk);

    const onDeliveryReceived = jest.fn();

    await pollingService.startPolling('ask-123', onDeliveryReceived);

    // Should call immediately when delivery is ready
    expect(onDeliveryReceived).toHaveBeenCalledWith(mockAsk, mockAsk.deliveryData);
    expect(pollingService.isPolling()).toBe(false);
  });

  it('should continue polling when delivery not ready', async () => {
    const mockAsk = {
      id: 'ask-123',
      status: 'IN_PROGRESS',
      bidWindowClosesAt: new Date().toISOString(),
      agentId: 'agent-456',
      description: 'Test',
      budget: 50,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    (mockClient.getAsk as any).mockResolvedValue(mockAsk);

    const onDeliveryReceived = jest.fn();

    await pollingService.startPolling('ask-123', onDeliveryReceived);

    // Should not call callback initially
    expect(onDeliveryReceived).not.toHaveBeenCalled();
    expect(pollingService.isPolling()).toBe(true);

    // Update mock to return completed ask
    const completedAsk = {
      ...mockAsk,
      status: 'COMPLETED',
      deliveryData: { result: 'Done' },
    };
    (mockClient.getAsk as any).mockResolvedValue(completedAsk);

    // Advance timer by 15 seconds and run pending timers
    await jest.advanceTimersByTimeAsync(15000);

    // Should call callback after polling detects completion
    expect(onDeliveryReceived).toHaveBeenCalledWith(completedAsk, completedAsk.deliveryData);
    expect(pollingService.isPolling()).toBe(false);
  });

  it('should handle polling errors gracefully', async () => {
    (mockClient.getAsk as any).mockRejectedValue(new Error('API error'));

    const onDeliveryReceived = jest.fn();

    await pollingService.startPolling('ask-123', onDeliveryReceived);

    // Should not throw, should continue polling
    expect(pollingService.isPolling()).toBe(true);

    pollingService.stopPolling();
  });

  it('should stop polling when manually stopped', async () => {
    const mockAsk = {
      id: 'ask-123',
      status: 'IN_PROGRESS',
      bidWindowClosesAt: new Date().toISOString(),
      agentId: 'agent-456',
      description: 'Test',
      budget: 50,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    (mockClient.getAsk as any).mockResolvedValue(mockAsk);

    const onDeliveryReceived = jest.fn();

    await pollingService.startPolling('ask-123', onDeliveryReceived);
    expect(pollingService.isPolling()).toBe(true);

    pollingService.stopPolling();
    expect(pollingService.isPolling()).toBe(false);
  });
});
