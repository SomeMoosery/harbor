import { jest } from '@jest/globals';
import type { WalletClient } from '@harbor/wallet/client';

/**
 * Create a mock wallet client for testing
 */
export function createMockWalletClient(): jest.Mocked<WalletClient> {
  return {
    createWallet: jest.fn().mockResolvedValue({ id: 'wallet-123' }),
  } as unknown as jest.Mocked<WalletClient>;
}
