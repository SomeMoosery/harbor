import { jest } from '@jest/globals';
import type { UserClient } from '@harbor/user/client';
import type { Agent } from '@harbor/user/types';

/**
 * Create a mock user client for testing
 */
export function createMockUserClient(): jest.Mocked<UserClient> {
  return {
    getAgent: jest.fn<() => Promise<Agent>>().mockResolvedValue({
      id: 'agent-123',
      userId: 'user-123',
      name: 'Test Agent',
      capabilities: {},
      type: 'BUYER',
    }),
    getUser: jest.fn(),
    createUser: jest.fn(),
    createAgent: jest.fn(),
    getAgentsForUser: jest.fn(),
  } as unknown as jest.Mocked<UserClient>;
}
