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
import { fromMinorUnits, type Money } from '../../public/model/money.js';

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
  ) { }

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
    // TODO we need to make this provider-agnostic
    const { walletId: circleWalletId, walletAddress } = await this.walletProvider.createWallet(agentId);

    // Store in database
    const wallet = await this.walletResource.create({
      agentId,
      circleWalletId,
      walletAddress,
      status: 'ACTIVE',
    });

    this.logger.info({ agentId, walletId: wallet.id, circleWalletId, walletAddress }, 'Wallet created successfully');
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
    const wallet = await this.walletResource.findById(walletId);

    // TODO we should get it from the database instead of provider always
    if (wallet.circleWalletId) {
      this.logger.info({ walletId }, 'Getting Circle wallet balance');
      const balance = await this.walletProvider.getBalance(wallet.circleWalletId);
      return {
        walletId,
        available: {
          amount: balance.amount,
          currency: 'USDC',
        },
        total: {
          amount: balance.amount,
          currency: 'USDC',
        },
      };
    }

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

    // Process Stripe payment
    const paymentResult = await this.paymentProvider.processDeposit(
      paymentMethodId,
      amount,
      { walletId, agentId: wallet.agentId }
    );

    if (paymentResult.status === 'failed') {
      throw new Error('Payment failed');
    }

    // Create ledger entry for external→internal reconciliation tracking
    const ledgerEntry = await this.ledgerEntryResource.createOnrampEntry({
      agentId: wallet.agentId,
      walletId: walletId,
      externalProvider: 'stripe',
      externalTransactionId: paymentResult.transactionId,
      externalAmount: amount,
      externalCurrency: amount.currency,
      internalAmount: amount,
      internalCurrency: 'USDC',
      description: `Deposit via Stripe for agent ${wallet.agentId}`,
      metadata: {
        paymentMethodId,
      },
    });

    // Update ledger entry with external completion status
    if (paymentResult.status === 'completed') {
      await this.ledgerEntryResource.updateExternalStatus(
        ledgerEntry.id,
        paymentResult.status
      );
    }

    // Create transaction record for internal wallet
    const transaction = await this.transactionResource.create({
      type: 'MINT',
      toWalletId: walletId,
      amount: amount,
      currency: 'USDC',
      status: paymentResult.status === 'completed' ? 'COMPLETED' : 'PENDING',
      externalId: paymentResult.transactionId,
      metadata: {
        paymentMethodId,
        stripeTransactionId: paymentResult.transactionId,
        ledgerEntryId: ledgerEntry.id,
      },
    });

    // Update ledger entry with internal transaction details
    if (paymentResult.status === 'completed') {
      await this.ledgerEntryResource.updateInternalStatus(
        ledgerEntry.id,
        transaction.id,
        'completed'
      );

      // Mark as reconciled since both sides completed
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
      amount: amount,
      currency: amount.currency,
      status: 'PENDING',
    });

    try {
      // Execute transfer via provider (Circle)
      const fromWallet = await this.walletResource.findById(fromWalletId);
      const toWallet = await this.walletResource.findById(toWalletId);

      if (!fromWallet.id || !toWallet.id) {
        throw new Error('Wallet ID not found');
      }

      const externalTxId = await this.walletProvider.transfer(
        fromWallet.id,
        toWallet.id,
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

  /**
   * Create a Stripe Checkout session for funding an agent's wallet
   * Returns the checkout URL for the user to complete payment
   */
  async createFundingCheckoutSession(params: {
    agentId: string;
    amount: Money;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ sessionId: string; url: string; walletId: string }> {
    this.logger.info({ agentId: params.agentId, amount: params.amount }, 'Creating funding checkout session');

    // Get or create wallet for the agent
    let wallet = await this.walletResource.findByAgentId(params.agentId);
    if (!wallet) {
      this.logger.info({ agentId: params.agentId }, 'Wallet not found, creating new wallet');
      wallet = await this.createWallet(params.agentId);
    }

    // Create checkout session via payment provider
    const session = await this.paymentProvider.createCheckoutSession({
      agentId: params.agentId,
      amount: params.amount,
      successUrl: params.successUrl,
      cancelUrl: params.cancelUrl,
    });

    this.logger.info(
      { agentId: params.agentId, sessionId: session.sessionId, walletId: wallet.id },
      'Funding checkout session created'
    );

    return {
      ...session,
      walletId: wallet.id,
    };
  }

  /**
   * Handle Stripe webhook for checkout session completion
   * This is called when a payment is successfully completed
   * Implements atomic deposit: Stripe payment -> USDC wallet credit
   */
  async handleStripeWebhook(event: any): Promise<{ success: boolean; transactionId?: string }> {
    this.logger.info({ eventType: event.type }, 'Processing Stripe webhook');

    // Only handle checkout.session.completed events
    if (event.type !== 'checkout.session.completed') {
      this.logger.debug({ eventType: event.type }, 'Ignoring non-checkout event');
      return { success: true };
    }

    const session = event.data.object;
    const agentId = session.metadata?.agentId;
    // Stripe payments come in in cents, so we want to convert to dollars
    const amount: Money = fromMinorUnits(parseFloat(session.metadata?.amount || '0'));
    const currency = session.metadata?.currency || 'USDC';

    if (!agentId || !amount) {
      this.logger.error({ session }, 'Invalid webhook payload: missing agentId or amount');
      throw new Error('Invalid webhook payload');
    }

    this.logger.info({ agentId, amount, currency, sessionId: session.id }, 'Processing successful checkout');

    // Get wallet for agent
    const wallet = await this.walletResource.findByAgentId(agentId);
    if (!wallet) {
      this.logger.error({ agentId }, 'Wallet not found for agent in webhook');
      throw new NotFoundError('Wallet', agentId);
    }

    this.logger.info(`Got wallet for agent that funds were purchased for: ${wallet}`);

    // Check if we already processed this session (idempotency)
    // TODO better idempotency - need an idempotency key
    const existingTransaction = await this.transactionResource.findByExternalId(session.id);
    if (existingTransaction) {
      this.logger.info(
        { sessionId: session.id, transactionId: existingTransaction.id },
        'Webhook already processed (idempotent)'
      );
      return { success: true, transactionId: existingTransaction.id };
    }

    try {
      // Atomic deposit flow:
      // Create ledger entry for external→internal reconciliation tracking
      const ledgerEntry = await this.ledgerEntryResource.createOnrampEntry({
        agentId: wallet.agentId,
        walletId: wallet.id,
        externalProvider: 'stripe',
        externalTransactionId: session.id,
        externalAmount: amount,
        externalCurrency: currency,
        internalAmount: amount, // 1:1 conversion USD -> USDC
        internalCurrency: 'USDC',
        description: `Stripe Checkout funding for agent ${wallet.agentId}`,
        metadata: {
          sessionId: session.id,
          paymentIntentId: session.payment_intent,
        },
      });

      // Mark external payment as completed
      await this.ledgerEntryResource.updateExternalStatus(ledgerEntry.id, 'completed');

      // Mint funds to the wallet
      // TODO if we switch to using Bridge vs Stripe, we might need to change this ordering a bit
      this.walletProvider.fundWallet(wallet.id, amount);

      // Create transaction record to credit the wallet
      const transaction = await this.transactionResource.create({
        type: 'MINT',
        toWalletId: wallet.id,
        amount,
        currency: 'USDC',
        status: 'COMPLETED',
        externalId: session.id,
        metadata: {
          stripeSessionId: session.id,
          paymentIntentId: session.payment_intent,
          ledgerEntryId: ledgerEntry.id,
        },
      });

      // Update ledger entry with internal transaction details
      await this.ledgerEntryResource.updateInternalStatus(
        ledgerEntry.id,
        transaction.id,
        'completed'
      );

      // Mark as reconciled since both sides completed
      await this.ledgerEntryResource.reconcile(
        ledgerEntry.id,
        'Auto-reconciled: Stripe checkout payment completed and USDC credited'
      );

      this.logger.info(
        {
          agentId,
          walletId: wallet.id,
          transactionId: transaction.id,
          ledgerEntryId: ledgerEntry.id,
          sessionId: session.id,
        },
        'Stripe webhook processed successfully - funds credited'
      );

      return { success: true, transactionId: transaction.id };
    } catch (error) {
      this.logger.error({ error, agentId, sessionId: session.id }, 'Failed to process Stripe webhook');
      throw error;
    }
  }
}
