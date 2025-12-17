import type { Logger } from '@harbor/logger';
import type { WalletProvider } from './walletProvider.js';
import type { Money } from '../../public/model/money.js';

/**
 * Mock wallet provider for local testing
 * Simulates wallet operations without calling external APIs
 */
export class MockWalletProvider implements WalletProvider {
  private wallets = new Map<string, { balance: number }>();

  constructor(private logger: Logger) {}

  async createWallet(agentId: string): Promise<string> {
    const walletId = `mock-wallet-${agentId}`;
    this.wallets.set(walletId, { balance: 0 });
    this.logger.info({ agentId, walletId }, 'Mock wallet created');
    return walletId;
  }

  async getBalance(walletId: string): Promise<Money> {
    const wallet = this.wallets.get(walletId);
    if (!wallet) {
      throw new Error(`Wallet ${walletId} not found`);
    }
    return {
      amount: wallet.balance,
      currency: 'USDC',
    };
  }

  async transfer(fromWalletId: string, toWalletId: string, amount: Money): Promise<string> {
    const fromWallet = this.wallets.get(fromWalletId);
    const toWallet = this.wallets.get(toWalletId);

    if (!fromWallet || !toWallet) {
      throw new Error('Wallet not found');
    }

    if (fromWallet.balance < amount.amount) {
      throw new Error('Insufficient funds');
    }

    fromWallet.balance -= amount.amount;
    toWallet.balance += amount.amount;

    const transactionId = `mock-tx-${Date.now()}`;
    this.logger.info({ fromWalletId, toWalletId, amount, transactionId }, 'Mock transfer completed');
    return transactionId;
  }

  async getWallet(walletId: string): Promise<{ id: string; balance: Money; status: string }> {
    const wallet = this.wallets.get(walletId);
    if (!wallet) {
      throw new Error(`Wallet ${walletId} not found`);
    }

    return {
      id: walletId,
      balance: { amount: wallet.balance, currency: 'USDC' },
      status: 'ACTIVE',
    };
  }
}
