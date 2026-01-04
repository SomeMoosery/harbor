/**
 * Unit tests for get-delivery tool
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { getDelivery } from '../../../src/tools/get-delivery.js';
import { HarborClient } from '../../../src/services/harbor-client.js';
import { session } from '../../../src/state/session.js';
import { AuthenticationError, NotFoundError, ValidationError } from '../../../src/utils/errors.js';

describe('getDelivery', () => {
  let mockClient: HarborClient;

  beforeEach(() => {
    session.clear();
    mockClient = {
      getAsk: jest.fn(),
    } as any;
  });

  it('should get delivery successfully when ask is completed', async () => {
    session.initialize('test-key', 'user-123', 'agent-456');
    session.setActiveAsk('ask-789');

    const mockAsk = {
      id: 'ask-789',
      agentId: 'agent-456',
      description: 'Test task',
      budget: 50,
      status: 'COMPLETED',
      bidWindowClosesAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deliveryData: {
        result: 'Task completed successfully',
        files: ['output.txt'],
      },
    };

    (mockClient.getAsk as any).mockResolvedValue(mockAsk);

    const result = await getDelivery(mockClient, {});

    expect(result.status).toBe('COMPLETED');
    expect(result.deliveryData).toEqual(mockAsk.deliveryData);
    expect(result.message).toContain('Delivery complete');
  });

  it('should get delivery for specific askId when provided', async () => {
    session.initialize('test-key', 'user-123', 'agent-456');

    const mockAsk = {
      id: 'ask-custom',
      agentId: 'agent-456',
      description: 'Test task',
      budget: 50,
      status: 'COMPLETED',
      bidWindowClosesAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deliveryData: {
        result: 'Custom task completed',
      },
    };

    (mockClient.getAsk as any).mockResolvedValue(mockAsk);

    const result = await getDelivery(mockClient, { askId: 'ask-custom' });

    expect(result.status).toBe('COMPLETED');
    expect(mockClient.getAsk).toHaveBeenCalledWith('ask-custom');
  });

  it('should return in_progress when ask is not completed', async () => {
    session.initialize('test-key', 'user-123', 'agent-456');
    session.setActiveAsk('ask-789');

    const mockAsk = {
      id: 'ask-789',
      agentId: 'agent-456',
      description: 'Test task',
      budget: 50,
      status: 'IN_PROGRESS',
      bidWindowClosesAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    (mockClient.getAsk as any).mockResolvedValue(mockAsk);

    const result = await getDelivery(mockClient, {});

    expect(result.status).toBe('IN_PROGRESS');
    expect(result.deliveryData).toBeUndefined();
    expect(result.message).toContain('still in progress');
  });

  it('should fail when not authenticated', async () => {
    await expect(getDelivery(mockClient, {})).rejects.toThrow(AuthenticationError);
  });

  it('should fail when no active ask and no askId provided', async () => {
    session.initialize('test-key', 'user-123', 'agent-456');

    await expect(getDelivery(mockClient, {})).rejects.toThrow(NotFoundError);
  });

  it('should handle API errors gracefully', async () => {
    session.initialize('test-key', 'user-123', 'agent-456');
    session.setActiveAsk('ask-789');

    (mockClient.getAsk as any).mockRejectedValue(
      new Error('Ask not found')
    );

    await expect(getDelivery(mockClient, {})).rejects.toThrow(ValidationError);
  });
});
