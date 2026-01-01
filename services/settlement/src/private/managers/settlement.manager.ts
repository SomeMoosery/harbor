import type { Logger } from '@harbor/logger';
import type { Config } from '@harbor/config';
import { EscrowLockResource } from '../resources/escrowLock.resource.js';
import { SettlementResource } from '../resources/settlement.resource.js';
import { EscrowSettlementStrategy } from '../strategies/escrowSettlementStrategy.js';
import type { SettlementStrategy } from '../strategies/settlementStrategy.js';
import type { EscrowLock } from '../../public/model/escrowLock.js';
import type { Settlement } from '../../public/model/settlement.js';

/**
 * SettlementManager orchestrates settlement operations
 */
export class SettlementManager {
  private strategy: SettlementStrategy;

  constructor(
    private readonly escrowLockResource: EscrowLockResource,
    private readonly settlementResource: SettlementResource,
    config: Config,
    private readonly logger: Logger
  ) {
    // Use escrow strategy by default
    // In the future, this could be swapped for other strategies (credit, instant, etc.)
    this.strategy = new EscrowSettlementStrategy(
      escrowLockResource,
      settlementResource,
      config,
      logger
    );
  }

  /**
   * Lock funds in escrow when bid is accepted
   */
  async lockEscrow(data: {
    askId: string;
    bidId: string;
    buyerAgentId: string;
    amount: number;
    currency?: string;
  }): Promise<EscrowLock> {
    this.logger.info({ data }, 'Locking escrow');

    return this.strategy.lockFunds({
      askId: data.askId,
      bidId: data.bidId,
      buyerAgentId: data.buyerAgentId,
      amount: data.amount,
      currency: data.currency || 'USDC',
    });
  }

  /**
   * Release funds from escrow when work is delivered
   */
  async releaseEscrow(data: {
    escrowLockId: string;
    sellerAgentId: string;
    deliveryProof?: Record<string, unknown>;
  }): Promise<Settlement> {
    this.logger.info({ data }, 'Releasing escrow');

    return this.strategy.releaseFunds({
      escrowLockId: data.escrowLockId,
      sellerAgentId: data.sellerAgentId,
      deliveryProof: data.deliveryProof,
    });
  }

  /**
   * Get escrow lock by ID
   */
  async getEscrowLock(id: string): Promise<EscrowLock> {
    return this.escrowLockResource.findById(id);
  }

  /**
   * Get escrow lock by bid ID
   */
  async getEscrowLockByBidId(bidId: string): Promise<EscrowLock | null> {
    return this.escrowLockResource.findByBidId(bidId);
  }

  /**
   * Get settlement by ID
   */
  async getSettlement(id: string): Promise<Settlement> {
    return this.settlementResource.findById(id);
  }
}
