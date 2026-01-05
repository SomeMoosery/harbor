import type { Logger } from '@harbor/logger';
import type { WalletProvider } from './walletProvider.js';
import type { Money } from '../../public/model/money.js';
import { randomUUID } from 'crypto';

/**
 * Mock wallet provider for local testing
 * Simulates wallet operations without calling external APIs
 *
 * Note: This provider does NOT track balances or validate wallet existence.
 * All validation is done at the manager level using the database.
 * This just simulates successful responses from the external wallet service (Circle).
 */
export class MockWalletProvider implements WalletProvider {
  constructor(private logger: Logger) {}

  async createWallet(agentId: string): Promise<{ walletId: string; walletAddress: string }> {
    const walletId = `${randomUUID()}`;
    const walletAddress = `0x${Math.random().toString(16).substring(2, 42).padEnd(40, '0')}`;
    this.logger.info({ agentId, walletId, walletAddress }, 'Mock wallet created');
    return { walletId, walletAddress };
  }

  async getBalance(_walletId: string): Promise<Money> {
    // Mock provider doesn't track balances - they come from transactions in the DB
    // Return a placeholder that won't be used
    return {
      amount: 0,
      currency: 'USDC',
    };
  }

  async transfer(fromWalletId: string, toWalletId: string, amount: Money): Promise<string> {
    // Mock provider doesn't validate wallets or balances - that's done at the manager level
    // using the database. Just simulate a successful transfer.
    const transactionId = `${randomUUID()}`;
    this.logger.info({ fromWalletId, toWalletId, amount, transactionId }, 'Mock transfer completed');
    return transactionId;
  }

  async getWallet(walletId: string): Promise<{ id: string; balance: Money; status: string }> {
    // Mock provider always returns success - real validation is in the manager
    return {
      id: walletId,
      balance: { amount: 0, currency: 'USDC' }, // Placeholder - real balance comes from DB
      status: 'ACTIVE',
    };
  }

  async fundWallet(toWalletId: string, amount: Money): Promise<Money> {
    // Mock provider simulates funding
    this.logger.info({ toWalletId, amount }, 'Mock wallet funded');
    return amount;
  }
}
