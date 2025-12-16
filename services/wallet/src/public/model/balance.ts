import type { Money } from './money.js';

/**
 * Wallet balance information
 */
export interface Balance {
  walletId: string;
  available: Money;
  pending?: Money;
  total: Money;
}
