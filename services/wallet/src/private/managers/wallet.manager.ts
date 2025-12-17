import type { Logger } from '@harbor/logger';
import { NotFoundError, InsufficientFundsError, ConflictError } from '@harbor/errors';
import { WalletResource } from '../resources/wallet.resource.js';
import { TransactionResource } from '../resources/transaction.resource.js';
import { LedgerEntryResource } from '../resources/ledgerEntry.resource.js';
import type { WalletProvider } from '../providers/walletProvider.js';
import type { PaymentProvider } from '../providers/paymentProvider.js';
import { Wallet } from '../../public/model/wallet.js';
import { Transaction } from '../../public/model/transaction.js';
import { Balance } from '../../public/model/balance.js';
import type { Money } from '../../public/model/money.js';

/**
 * WalletManager orchestrates wallet operations and maintains double-entry ledger
 */
export class WalletManager {
  constructor(
    private readonly walletResource: WalletResource,
    private readonly transactionResource: TransactionResource,
    private readonly ledgerEntryResource: LedgerEntryResource,
    private readonly walletProvider: WalletProvider,
    private readonly paymentProvider: PaymentProvider,
    private readonly logger: Logger
  ) {}

  /**
   * Create a new wallet for an agent
   */
  async createWallet(agentId: string): Promise<Wallet> {
    this.logger.info({ agentId }, 'Creating wallet for agent');

    // Check if wallet already exists for this agent
    const existingWallet = await this.walletResource.findByAgentId(agentId);
    if (existingWallet) {
      throw new ConflictError(`Wallet already exists for agent ${agentId}`);
    }

    // Create wallet via provider (Circle)
    const circleWalletId = await this.walletProvider.createWallet(agentId);

    // Store in database
    const wallet = await this.walletResource.create({
      agentId,
      circleWalletId,
      status: 'ACTIVE',
    });

    this.logger.info({ agentId, walletId: wallet.id, circleWalletId }, 'Wallet created successfully');
    return wallet;
  }

  /**
   * Get wallet by ID
   */
  async getWallet(walletId: string): Promise<Wallet> {
    return this.walletResource.findById(walletId);
  }

  /**
   * Get wallet by agent ID
   */
  async getWalletByAgentId(agentId: string): Promise<Wallet> {
    const wallet = await this.walletResource.findByAgentId(agentId);
    if (!wallet) {
      throw new NotFoundError('Wallet', agentId);
    }
    return wallet;
  }

  /**
   * Get wallet balance
   */
  async getBalance(walletId: string): Promise<Balance> {
    // Verify wallet exists
    await this.walletResource.findById(walletId);

    // Calculate balance from transactions
    const transactions = await this.transactionResource.findByWalletId(walletId, 10000);

    let balance = 0;
    for (const tx of transactions) {
      if (tx.status !== 'COMPLETED') continue;

      if (tx.toWalletId === walletId) {
        balance += tx.amount;
      }
      if (tx.fromWalletId === walletId) {
        balance -= tx.amount;
      }
    }

    return {
      walletId,
      available: {
        amount: balance,
        currency: 'USDC',
      },
      total: {
        amount: balance,
        currency: 'USDC',
      },
    };
  }

  /**
   * Deposit funds via Stripe payment (fiat -> USDC)
   * Flow: Stripe payment -> Mint USDC via Circle -> Credit wallet
   * Creates ledger entry to track reconciliation between Stripe and Circle
   */
  async deposit(
    walletId: string,
    amount: Money,
    paymentMethodId: string
  ): Promise<Transaction> {
    this.logger.info({ walletId, amount, paymentMethodId }, 'Processing deposit');

    const wallet = await this.walletResource.findById(walletId);

    // 1. Process Stripe payment
    const paymentResult = await this.paymentProvider.processDeposit(
      paymentMethodId,
      amount,
      { walletId, agentId: wallet.agentId }
    );

    if (paymentResult.status === 'failed') {
      throw new Error('Payment failed');
    }

    // 2. Create ledger entry for external→internal reconciliation tracking
    const ledgerEntry = await this.ledgerEntryResource.createOnrampEntry({
      agentId: wallet.agentId,
      walletId: walletId,
      externalProvider: 'stripe',
      externalTransactionId: paymentResult.transactionId,
      externalAmount: amount.amount,
      externalCurrency: amount.currency,
      internalAmount: amount.amount, // Assuming 1:1 for USDC
      internalCurrency: 'USDC',
      description: `Deposit via Stripe for agent ${wallet.agentId}`,
      metadata: {
        paymentMethodId,
      },
    });

    // 3. Update ledger entry with external completion status
    if (paymentResult.status === 'completed') {
      await this.ledgerEntryResource.updateExternalStatus(
        ledgerEntry.id,
        paymentResult.status
      );
    }

    // 4. Create transaction record for internal wallet
    const transaction = await this.transactionResource.create({
      type: 'MINT',
      toWalletId: walletId,
      amount: amount.amount,
      currency: 'USDC',
      status: paymentResult.status === 'completed' ? 'COMPLETED' : 'PENDING',
      externalId: paymentResult.transactionId,
      metadata: {
        paymentMethodId,
        stripeTransactionId: paymentResult.transactionId,
        ledgerEntryId: ledgerEntry.id,
      },
    });

    // 5. Update ledger entry with internal transaction details
    if (paymentResult.status === 'completed') {
      await this.ledgerEntryResource.updateInternalStatus(
        ledgerEntry.id,
        transaction.id,
        'completed'
      );

      // 6. Mark as reconciled since both sides completed
      await this.ledgerEntryResource.reconcile(
        ledgerEntry.id,
        'Auto-reconciled: Both Stripe payment and USDC mint completed successfully'
      );
    }

    this.logger.info(
      { walletId, transactionId: transaction.id, ledgerEntryId: ledgerEntry.id },
      'Deposit processed and tracked in ledger'
    );
    return transaction;
  }

  /**
   * Transfer funds between wallets
   * Note: Internal transfers don't use the ledger (ledger is only for external↔internal reconciliation)
   */
  async transfer(
    fromWalletId: string,
    toWalletId: string,
    amount: Money
  ): Promise<Transaction> {
    this.logger.info({ fromWalletId, toWalletId, amount }, 'Processing transfer');

    // Check source wallet has sufficient funds
    const fromBalance = await this.getBalance(fromWalletId);
    if (fromBalance.available.amount < amount.amount) {
      throw new InsufficientFundsError(amount.amount, fromBalance.available.amount);
    }

    // Verify both wallets exist
    await this.walletResource.findById(fromWalletId);
    await this.walletResource.findById(toWalletId);

    // Create transaction
    const transaction = await this.transactionResource.create({
      type: 'TRANSFER',
      fromWalletId,
      toWalletId,
      amount: amount.amount,
      currency: amount.currency,
      status: 'PENDING',
    });

    try {
      // Execute transfer via provider (Circle)
      const fromWallet = await this.walletResource.findById(fromWalletId);
      const toWallet = await this.walletResource.findById(toWalletId);

      if (!fromWallet.circleWalletId || !toWallet.circleWalletId) {
        throw new Error('Circle wallet ID not found');
      }

      const externalTxId = await this.walletProvider.transfer(
        fromWallet.circleWalletId,
        toWallet.circleWalletId,
        amount
      );

      // Update transaction with external ID and mark as completed
      await this.transactionResource.updateStatus(transaction.id, 'COMPLETED');

      this.logger.info(
        { fromWalletId, toWalletId, transactionId: transaction.id, externalTxId },
        'Transfer completed'
      );

      return await this.transactionResource.findById(transaction.id);
    } catch (error) {
      // Mark transaction as failed
      await this.transactionResource.updateStatus(transaction.id, 'FAILED');
      throw error;
    }
  }

  /**
   * Get transaction history for a wallet
   */
  async getTransactions(walletId: string, limit = 50): Promise<Transaction[]> {
    await this.walletResource.findById(walletId); // Verify wallet exists
    return this.transactionResource.findByWalletId(walletId, limit);
  }
}
