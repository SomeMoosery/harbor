import type { Logger } from '@harbor/logger';
import type { WalletProvider } from './walletProvider.js';
import type { Money } from '../../public/model/money.js';

/**
 * Mock wallet provider for local testing
 * Simulates wallet operations without calling external APIs
 *
 * Note: This provider does NOT track balances internally.
 * Balances are tracked via transactions in the database.
 * This just simulates the external wallet service (Circle).
 */
export class MockWalletProvider implements WalletProvider {
  private wallets = new Set<string>();

  constructor(private logger: Logger) {}

  async createWallet(agentId: string): Promise<string> {
    const walletId = `mock-wallet-${agentId}`;
    this.wallets.add(walletId);
    this.logger.info({ agentId, walletId }, 'Mock wallet created');
    return walletId;
  }

  async getBalance(walletId: string): Promise<Money> {
    if (!this.wallets.has(walletId)) {
      throw new Error(`Wallet ${walletId} not found`);
    }
    // Mock provider doesn't track balances - they come from transactions in the DB
    // Return a placeholder that won't be used
    return {
      amount: 0,
      currency: 'USDC',
    };
  }

  async transfer(fromWalletId: string, toWalletId: string, amount: Money): Promise<string> {
    if (!this.wallets.has(fromWalletId)) {
      throw new Error('Source wallet not found');
    }
    if (!this.wallets.has(toWalletId)) {
      throw new Error('Destination wallet not found');
    }

    // Mock provider doesn't validate balances - that's done at the manager level
    // using the transaction database. Just simulate a successful transfer.
    const transactionId = `mock-tx-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    this.logger.info({ fromWalletId, toWalletId, amount, transactionId }, 'Mock transfer completed');
    return transactionId;
  }

  async getWallet(walletId: string): Promise<{ id: string; balance: Money; status: string }> {
    if (!this.wallets.has(walletId)) {
      throw new Error(`Wallet ${walletId} not found`);
    }

    return {
      id: walletId,
      balance: { amount: 0, currency: 'USDC' }, // Placeholder - real balance comes from DB
      status: 'ACTIVE',
    };
  }
}
