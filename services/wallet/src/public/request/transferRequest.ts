import type { Money } from '../model/money.js';

/**
 * Request to transfer funds between wallets
 */
export interface TransferRequest {
  fromWalletId: string;
  toWalletId: string;
  amount: Money;
  description?: string;
}
