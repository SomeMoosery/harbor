import type { Money } from '../model/money.js';

/**
 * Request to deposit funds via Stripe (onramp)
 */
export interface DepositRequest {
  walletId: string;
  amount: Money;
  paymentMethodId: string; // Stripe payment method ID
}
