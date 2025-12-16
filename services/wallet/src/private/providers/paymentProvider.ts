import type { Money } from '../../public/model/money.js';

/**
 * Payment provider abstraction for onramp/offramp
 * Allows us to swap out Stripe for other payment providers
 */
export interface PaymentProvider {
  /**
   * Process a deposit (onramp: fiat -> crypto)
   * Returns the payment transaction ID
   */
  processDeposit(
    paymentMethodId: string,
    amount: Money,
    metadata?: Record<string, unknown>
  ): Promise<{
    transactionId: string;
    status: 'pending' | 'completed' | 'failed';
    amount: Money;
  }>;

  /**
   * Process a withdrawal (offramp: crypto -> fiat)
   * Returns the payout transaction ID
   */
  processWithdrawal(
    destinationId: string,
    amount: Money,
    metadata?: Record<string, unknown>
  ): Promise<{
    transactionId: string;
    status: 'pending' | 'completed' | 'failed';
    amount: Money;
  }>;

  /**
   * Get payment status
   */
  getPaymentStatus(transactionId: string): Promise<{
    status: 'pending' | 'completed' | 'failed';
    amount: Money;
  }>;
}
