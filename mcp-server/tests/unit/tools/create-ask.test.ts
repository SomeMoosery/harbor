/**
 * Unit tests for create-ask tool
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { createAsk } from '../../../src/tools/create-ask.js';
import { HarborClient } from '../../../src/services/harbor-client.js';
import { session } from '../../../src/state/session.js';
import { AuthenticationError, ValidationError } from '../../../src/utils/errors.js';

describe('createAsk', () => {
  let mockClient: HarborClient;

  beforeEach(() => {
    session.clear();
    mockClient = {
      createAsk: jest.fn(),
    } as any;
  });

  it('should create ask successfully when authenticated', async () => {
    // Initialize session
    session.initialize('test-key', 'user-123', 'agent-456');

    const mockAsk = {
      id: 'ask-789',
      agentId: 'agent-456',
      description: 'Test task description',
      budget: 50,
      status: 'OPEN',
      bidWindowClosesAt: new Date(Date.now() + 3600000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    (mockClient.createAsk as any).mockResolvedValue(mockAsk);

    const result = await createAsk(mockClient, {
      description: 'Test task description',
      budget: 50,
      bidWindowHours: 1,
    });

    expect(result.askId).toBe('ask-789');
    expect(result.message).toContain('Ask created successfully');
    expect(session.getState().activeAskId).toBe('ask-789');
  });

  it('should fail when not authenticated', async () => {
    await expect(
      createAsk(mockClient, {
        description: 'Test task',
        budget: 50,
        bidWindowHours: 1,
      })
    ).rejects.toThrow(AuthenticationError);
  });

  it('should handle API errors', async () => {
    session.initialize('test-key', 'user-123', 'agent-456');

    (mockClient.createAsk as any).mockRejectedValue(
      new Error('API error')
    );

    await expect(
      createAsk(mockClient, {
        description: 'Test task',
        budget: 50,
        bidWindowHours: 1,
      })
    ).rejects.toThrow(ValidationError);
  });
});
