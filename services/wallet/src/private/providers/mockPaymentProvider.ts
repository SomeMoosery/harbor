import type { Logger } from '@harbor/logger';
import type { PaymentProvider } from './paymentProvider.js';
import type { Money } from '../../public/model/money.js';
import { randomUUID } from 'crypto';

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
    const transactionId = `${randomUUID()}`;

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
    const transactionId = `${randomUUID()}`;

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

  async createCheckoutSession(params: {
    agentId: string;
    amount: Money;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ sessionId: string; url: string }> {
    const sessionId = `${randomUUID()}`;

    this.logger.info(
      {
        sessionId,
        agentId: params.agentId,
        amount: params.amount,
      },
      'Mock checkout session created'
    );

    // Mock checkout URL - in reality this would be a Stripe-hosted page
    // For testing, we'll return a URL that points back to the success page
    return {
      sessionId,
      url: `${params.successUrl}?session_id=${sessionId}&mock=true`,
    };
  }

  verifyWebhook(payload: string, signature: string): any {
    // Mock webhook verification - always succeeds
    this.logger.debug({ signature }, 'Mock webhook verification (always succeeds)');

    try {
      return JSON.parse(payload);
    } catch (error) {
      throw new Error('Invalid webhook payload');
    }
  }
}
