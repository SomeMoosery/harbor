import type { Logger } from '@harbor/logger';
import type { PaymentProvider } from './paymentProvider.js';
import type { Money } from '../../public/model/money.js';

/**
 * Mock payment provider for local testing
 * Simulates Stripe/payment operations without calling external APIs
 *
 * By default, all operations succeed immediately.
 * Future: Add metadata fields to simulate failures for testing.
 */
export class MockPaymentProvider implements PaymentProvider {
  private payments = new Map<string, { status: 'pending' | 'completed' | 'failed'; amount: Money }>();

  constructor(private logger: Logger) {}

  async processDeposit(
    paymentMethodId: string,
    amount: Money,
    metadata?: Record<string, unknown>
  ): Promise<{
    transactionId: string;
    status: 'pending' | 'completed' | 'failed';
    amount: Money;
  }> {
    const transactionId = `mock-payment-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // For now, all deposits succeed immediately
    // Future: Check metadata for test scenarios like { simulateFailure: true }
    const status = 'completed';

    this.payments.set(transactionId, { status, amount });

    this.logger.info(
      {
        transactionId,
        paymentMethodId,
        amount,
        status,
        metadata
      },
      'Mock payment deposit processed'
    );

    return {
      transactionId,
      status,
      amount,
    };
  }

  async processWithdrawal(
    destinationId: string,
    amount: Money,
    metadata?: Record<string, unknown>
  ): Promise<{
    transactionId: string;
    status: 'pending' | 'completed' | 'failed';
    amount: Money;
  }> {
    const transactionId = `mock-payout-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // For now, all withdrawals succeed immediately
    const status = 'completed';

    this.payments.set(transactionId, { status, amount });

    this.logger.info(
      {
        transactionId,
        destinationId,
        amount,
        status,
        metadata
      },
      'Mock payment withdrawal processed'
    );

    return {
      transactionId,
      status,
      amount,
    };
  }

  async getPaymentStatus(transactionId: string): Promise<{
    status: 'pending' | 'completed' | 'failed';
    amount: Money;
  }> {
    const payment = this.payments.get(transactionId);

    if (!payment) {
      throw new Error(`Payment ${transactionId} not found`);
    }

    this.logger.debug({ transactionId, status: payment.status }, 'Mock payment status retrieved');

    return {
      status: payment.status,
      amount: payment.amount,
    };
  }
}
