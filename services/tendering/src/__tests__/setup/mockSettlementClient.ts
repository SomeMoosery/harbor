import { jest } from '@jest/globals';
import type { SettlementClient } from '@harbor/settlement/client';
import type { EscrowLock, Settlement } from '@harbor/settlement/types';

/**
 * Create a mock settlement client for testing
 */
export function createMockSettlementClient(): jest.Mocked<SettlementClient> {
  return {
    lockEscrow: jest.fn<() => Promise<EscrowLock>>().mockResolvedValue({
      id: 'escrow-123',
      askId: 'ask-123',
      bidId: 'bid-123',
      buyerAgentId: 'buyer-agent-123',
      amount: 1000,
      currency: 'USDC',
      status: 'LOCKED',
    }),
    releaseEscrow: jest.fn<() => Promise<Settlement>>().mockResolvedValue({
      id: 'settlement-123',
      escrowLockId: 'escrow-123',
      sellerAgentId: 'seller-agent-123',
      amount: 1000,
      currency: 'USDC',
      status: 'COMPLETED',
    }),
    getEscrowLock: jest.fn(),
    getEscrowLockByBidId: jest.fn<() => Promise<EscrowLock>>().mockResolvedValue({
      id: 'escrow-123',
      askId: 'ask-123',
      bidId: 'bid-123',
      buyerAgentId: 'buyer-agent-123',
      amount: 1000,
      currency: 'USDC',
      status: 'LOCKED',
    }),
    getSettlement: jest.fn(),
  } as unknown as jest.Mocked<SettlementClient>;
}
