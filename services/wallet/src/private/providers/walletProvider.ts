import type { Money } from '../../public/model/money.js';

/**
 * Wallet provider abstraction
 * Allows us to swap out Circle for other wallet providers in the future
 */
export interface WalletProvider {
  /**
   * Create a new wallet for an agent
   * Returns the provider's wallet ID and address
   */
  createWallet(agentId: string): Promise<{ walletId: string; walletAddress: string }>;

  /**
   * Get wallet balance
   */
  getBalance(walletId: string): Promise<Money>;

  /**
   * Transfer funds between wallets
   */
  transfer(fromWalletId: string, toWalletId: string, amount: Money): Promise<string>;

  /**
   * Get wallet by provider wallet ID
   */
  getWallet(walletId: string): Promise<{
    id: string;
    balance: Money;
    status: string;
  }>;

  /**
   * Mint funds
   */
  fundWallet(toWalletId: string, amount: Money): Promise<Money>;
}
