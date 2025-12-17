import type { EscrowLock } from '../../public/model/escrowLock.js';
import type { Settlement } from '../../public/model/settlement.js';

/**
 * Settlement strategy abstraction
 * Allows different settlement mechanisms (escrow, credit, instant, etc.)
 */
export interface SettlementStrategy {
  /**
   * Lock funds in escrow
   */
  lockFunds(params: {
    askId: string;
    bidId: string;
    buyerAgentId: string;
    amount: number;
    currency: string;
  }): Promise<EscrowLock>;

  /**
   * Release funds from escrow to seller
   */
  releaseFunds(params: {
    escrowLockId: string;
    sellerAgentId: string;
    deliveryProof?: Record<string, unknown>;
  }): Promise<Settlement>;

  /**
   * Refund funds from escrow to buyer (not implemented yet)
   */
  refundFunds?(escrowLockId: string): Promise<void>;
}
