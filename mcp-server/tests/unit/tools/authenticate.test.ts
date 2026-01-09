/**
 * Unit tests for authentication initialization
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { initializeAuthentication } from '../../../src/tools/authenticate.js';
import { HarborClient } from '../../../src/services/harbor-client.js';
import { session } from '../../../src/state/session.js';
import { AuthenticationError } from '../../../src/utils/errors.js';

describe('initializeAuthentication', () => {
  let mockClient: HarborClient;

  beforeEach(() => {
    // Clear session
    session.clear();

    // Create mock client
    mockClient = {
      validateApiKey: jest.fn(),
      getUser: jest.fn(),
      getAgentsForUser: jest.fn(),
      setAgentId: jest.fn(),
    } as any;
  });

  it('should authenticate successfully with valid API key', async () => {
    // Mock successful responses
    (mockClient.validateApiKey as any).mockResolvedValue({
      valid: true,
      userId: 'user-123',
    });

    (mockClient.getUser as any).mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
    });

    (mockClient.getAgentsForUser as any).mockResolvedValue([
      {
        id: 'agent-456',
        name: 'Test Agent',
        reputation: 4.5,
      },
    ]);

    await initializeAuthentication(mockClient, 'test-key');

    // Verify session was initialized
    const sessionState = session.getState();
    expect(sessionState.userId).toBe('user-123');
    expect(sessionState.agentId).toBe('agent-456');
    expect(sessionState.apiKey).toBe('test-key');
  });

  it('should fail with invalid API key', async () => {
    (mockClient.validateApiKey as any).mockResolvedValue({
      valid: false,
    });

    await expect(
      initializeAuthentication(mockClient, 'invalid-key')
    ).rejects.toThrow(AuthenticationError);
  });

  it('should fail when user has no agents', async () => {
    (mockClient.validateApiKey as any).mockResolvedValue({
      valid: true,
      userId: 'user-123',
    });

    (mockClient.getUser as any).mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
    });

    (mockClient.getAgentsForUser as any).mockResolvedValue([]);

    await expect(
      initializeAuthentication(mockClient, 'test-key')
    ).rejects.toThrow(AuthenticationError);
  });

  it('should handle API errors gracefully', async () => {
    (mockClient.validateApiKey as any).mockRejectedValue(
      new Error('Network error')
    );

    await expect(
      initializeAuthentication(mockClient, 'test-key')
    ).rejects.toThrow(AuthenticationError);
  });
});
