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

    // Get platform escrow wallet
    const escrowWallet = await this.walletClient.getWalletByAgentId(this.config.wallets.escrowAgentId);

    // Transfer funds from buyer wallet to escrow wallet
    this.logger.info(
      {
        fromWalletId: buyerWallet.id,
        toWalletId: escrowWallet.id,
        amount: totalAmount,
        currency: params.currency,
      },
      'Transferring funds to escrow wallet'
    );

    const lockTransaction = await this.walletClient.transfer({
      fromWalletId: buyerWallet.id,
      toWalletId: escrowWallet.id,
      amount: { amount: totalAmount, currency: params.currency },
      description: `Escrow lock for bid ${params.bidId}`,
    });

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
      lockTransactionId: lockTransaction.id,
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

    // Get platform wallets
    const escrowWallet = await this.walletClient.getWalletByAgentId(this.config.wallets.escrowAgentId);
    const revenueWallet = await this.walletClient.getWalletByAgentId(this.config.wallets.revenueAgentId);

    // Calculate seller payout and fees
    const sellerFeePercentage = this.config.fees.sellerPercentage;
    const sellerFee = escrowLock.baseAmount * sellerFeePercentage;
    const payoutAmount = escrowLock.baseAmount - sellerFee;
    const platformRevenue = escrowLock.buyerFee + sellerFee;

    // Transfer payout to seller
    this.logger.info(
      {
        fromWalletId: escrowWallet.id,
        toWalletId: sellerWallet.id,
        amount: payoutAmount,
        currency: escrowLock.currency,
      },
      'Transferring payout to seller wallet'
    );

    const releaseTransaction = await this.walletClient.transfer({
      fromWalletId: escrowWallet.id,
      toWalletId: sellerWallet.id,
      amount: { amount: payoutAmount, currency: escrowLock.currency },
      description: `Payout for escrow ${params.escrowLockId}`,
    });

    // Transfer platform revenue
    this.logger.info(
      {
        fromWalletId: escrowWallet.id,
        toWalletId: revenueWallet.id,
        amount: platformRevenue,
        currency: escrowLock.currency,
      },
      'Transferring fees to platform revenue wallet'
    );

    const feeTransaction = await this.walletClient.transfer({
      fromWalletId: escrowWallet.id,
      toWalletId: revenueWallet.id,
      amount: { amount: platformRevenue, currency: escrowLock.currency },
      description: `Platform fees for escrow ${params.escrowLockId}`,
    });

    // Create settlement record
    const settlement = await this.settlementResource.create({
      escrowLockId: params.escrowLockId,
      sellerWalletId: sellerWallet.id,
      sellerAgentId: params.sellerAgentId,
      payoutAmount,
      sellerFee,
      platformRevenue,
      currency: escrowLock.currency,
      releaseTransactionId: releaseTransaction.id,
      feeTransactionId: feeTransaction.id,
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
