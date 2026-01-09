/**
 * Unit tests for HarborClient
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { HarborClient } from '../../../src/services/harbor-client.js';
import { AuthenticationError, NotFoundError, ApiError } from '../../../src/utils/errors.js';

// Mock fetch globally
global.fetch = jest.fn() as any;

describe('HarborClient', () => {
  let client: HarborClient;

  beforeEach(() => {
    client = new HarborClient('http://localhost:3000', 'test-api-key');
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('validateApiKey', () => {
    it('should validate API key successfully', async () => {
      const mockResponse = {
        valid: true,
        userId: 'user-123',
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.validateApiKey('test-key');

      expect(result.valid).toBe(true);
      expect(result.userId).toBe('user-123');
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api-keys/validate',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ apiKey: 'test-key' }),
        })
      );
    });

    it('should throw AuthenticationError on 401', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Invalid API key' }),
      });

      await expect(client.validateApiKey('invalid-key')).rejects.toThrow(
        AuthenticationError
      );
    });
  });

  describe('getUser', () => {
    it('should get user successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockUser,
      });

      const result = await client.getUser('user-123');

      expect(result.id).toBe('user-123');
      expect(result.email).toBe('test@example.com');
    });

    it('should throw NotFoundError on 404', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ message: 'User not found' }),
      });

      await expect(client.getUser('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('createAsk', () => {
    it('should create ask successfully', async () => {
      const mockAsk = {
        id: 'ask-123',
        agentId: 'agent-456',
        description: 'Test task',
        budget: 50,
        status: 'OPEN',
        bidWindowClosesAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockAsk,
      });

      const result = await client.createAsk({
        description: 'Test task',
        budget: 50,
        bidWindowHours: 2,
      });

      expect(result.id).toBe('ask-123');
      expect(result.description).toBe('Test task');
    });
  });

  describe('error handling', () => {
    it('should handle network errors', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      await expect(client.getUser('user-123')).rejects.toThrow(ApiError);
    });

    it('should handle 500 errors', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ message: 'Internal server error' }),
      });

      await expect(client.getUser('user-123')).rejects.toThrow(ApiError);
    });
  });
});
