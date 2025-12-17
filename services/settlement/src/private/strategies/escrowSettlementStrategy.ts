import type { Logger } from '@harbor/logger';
import type { Config } from '@harbor/config';
import { InsufficientFundsError } from '@harbor/errors';
import { WalletClient } from '@harbor/wallet/client';
import { EscrowLockResource } from '../resources/escrowLock.resource.js';
import { SettlementResource } from '../resources/settlement.resource.js';
import type { SettlementStrategy } from './settlementStrategy.js';
import type { EscrowLock } from '../../public/model/escrowLock.js';
import type { Settlement } from '../../public/model/settlement.js';

/**
 * Escrow settlement strategy implementation
 * Uses a platform-controlled escrow wallet to hold funds until delivery
 */
export class EscrowSettlementStrategy implements SettlementStrategy {
  private walletClient: WalletClient;

  constructor(
    private readonly escrowLockResource: EscrowLockResource,
    private readonly settlementResource: SettlementResource,
    private readonly config: Config,
    private readonly logger: Logger
  ) {
    this.walletClient = new WalletClient();
  }

  async lockFunds(params: {
    askId: string;
    bidId: string;
    buyerAgentId: string;
    amount: number;
    currency: string;
  }): Promise<EscrowLock> {
    this.logger.info({ params }, 'Locking funds in escrow');

    // Calculate fees
    const buyerFeePercentage = this.config.fees.buyerPercentage;
    const baseAmount = params.amount;
    const buyerFee = baseAmount * buyerFeePercentage;
    const totalAmount = baseAmount + buyerFee;

    // Get buyer's wallet
    const buyerWallet = await this.walletClient.getWalletByAgentId(params.buyerAgentId);

    // Check buyer has sufficient funds
    const balance = await this.walletClient.getBalance(buyerWallet.id);
    if (balance.available.amount < totalAmount) {
      throw new InsufficientFundsError(totalAmount, balance.available.amount);
    }

    // TODO: In production, actually transfer funds to escrow wallet here
    // For now, we'll just record the lock in the database
    // The wallet transfer would happen via WalletClient.transfer()

    // Create escrow lock record
    const escrowLock = await this.escrowLockResource.create({
      askId: params.askId,
      bidId: params.bidId,
      buyerWalletId: buyerWallet.id,
      buyerAgentId: params.buyerAgentId,
      totalAmount,
      baseAmount,
      buyerFee,
      currency: params.currency,
      metadata: {
        lockedAt: new Date().toISOString(),
      },
    });

    this.logger.info(
      {
        escrowLockId: escrowLock.id,
        totalAmount,
        baseAmount,
        buyerFee,
      },
      'Funds locked in escrow successfully'
    );

    return escrowLock;
  }

  async releaseFunds(params: {
    escrowLockId: string;
    sellerAgentId: string;
    deliveryProof?: Record<string, unknown>;
  }): Promise<Settlement> {
    this.logger.info({ params }, 'Releasing funds from escrow');

    // Get escrow lock
    const escrowLock = await this.escrowLockResource.findById(params.escrowLockId);

    if (escrowLock.status !== 'LOCKED') {
      throw new Error(`Escrow lock is not in LOCKED status. Current status: ${escrowLock.status}`);
    }

    // Get seller's wallet
    const sellerWallet = await this.walletClient.getWalletByAgentId(params.sellerAgentId);

    // Calculate seller payout and fees
    const sellerFeePercentage = this.config.fees.sellerPercentage;
    const sellerFee = escrowLock.baseAmount * sellerFeePercentage;
    const payoutAmount = escrowLock.baseAmount - sellerFee;
    const platformRevenue = escrowLock.buyerFee + sellerFee;

    // TODO: In production, transfer funds from escrow wallet to seller wallet
    // and to platform revenue wallet
    // For now, we'll just record the settlement

    // Create settlement record
    const settlement = await this.settlementResource.create({
      escrowLockId: params.escrowLockId,
      sellerWalletId: sellerWallet.id,
      sellerAgentId: params.sellerAgentId,
      payoutAmount,
      sellerFee,
      platformRevenue,
      currency: escrowLock.currency,
      metadata: {
        deliveryProof: params.deliveryProof,
        releasedAt: new Date().toISOString(),
      },
    });

    // Update escrow lock status
    await this.escrowLockResource.updateStatus(params.escrowLockId, 'RELEASED');

    // Update settlement status to completed
    await this.settlementResource.updateStatus(settlement.id, 'COMPLETED');

    this.logger.info(
      {
        settlementId: settlement.id,
        payoutAmount,
        sellerFee,
        platformRevenue,
      },
      'Funds released from escrow successfully'
    );

    return settlement;
  }
}
