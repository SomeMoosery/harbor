import { z } from 'zod';
import { getServiceUrl } from '@harbor/config/ports';
import type { CreateWalletRequest } from '../request/createWalletRequest.js';
import type { DepositRequest } from '../request/depositRequest.js';
import type { TransferRequest } from '../request/transferRequest.js';
import type { Wallet } from '../model/wallet.js';
import type { Transaction } from '../model/transaction.js';
import type { Balance } from '../model/balance.js';
import { walletSchema, transactionSchema, balanceSchema } from '../schemas/index.js';

/**
 * Type-safe HTTP client for Wallet service
 * Other services use this to communicate with the Wallet service
 */
export class WalletClient {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? getServiceUrl('wallet');
  }

  async createWallet(data: CreateWalletRequest): Promise<Wallet> {
    const response = await fetch(`${this.baseUrl}/wallets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create wallet: ${error}`);
    }

    const json = await response.json();
    return walletSchema.parse(json) as Wallet;
  }

  async getWallet(id: string): Promise<Wallet> {
    const response = await fetch(`${this.baseUrl}/wallets/${id}`);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get wallet: ${error}`);
    }

    const json = await response.json();
    return walletSchema.parse(json) as Wallet;
  }

  async getWalletByAgentId(agentId: string): Promise<Wallet> {
    const response = await fetch(`${this.baseUrl}/wallets/agent/${agentId}`);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get wallet for agent: ${error}`);
    }

    const json = await response.json();
    return walletSchema.parse(json) as Wallet;
  }

  async getBalance(walletId: string): Promise<Balance> {
    const response = await fetch(`${this.baseUrl}/wallets/${walletId}/balance`);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get balance: ${error}`);
    }

    const json = await response.json();
    return balanceSchema.parse(json) as Balance;
  }

  async deposit(data: DepositRequest): Promise<Transaction> {
    const response = await fetch(`${this.baseUrl}/deposit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to deposit: ${error}`);
    }

    const json = await response.json();
    return transactionSchema.parse(json) as Transaction;
  }

  async transfer(data: TransferRequest): Promise<Transaction> {
    const response = await fetch(`${this.baseUrl}/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to transfer: ${error}`);
    }

    const json = await response.json();
    return transactionSchema.parse(json) as Transaction;
  }

  async getTransactions(walletId: string, limit = 50): Promise<Transaction[]> {
    const response = await fetch(`${this.baseUrl}/wallets/${walletId}/transactions?limit=${limit}`);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get transactions: ${error}`);
    }

    const json = await response.json();
    return z.array(transactionSchema).parse(json) as Transaction[];
  }
}

// Export a singleton instance
export const walletClient = new WalletClient();
