import type { Logger } from '@harbor/logger';
import type { PaymentProvider } from './paymentProvider.js';
import type { Money } from '../../public/model/money.js';

/**
 * Stripe payment provider implementation
 *
 * This provider integrates with Stripe for fiat onramp/offramp.
 * Flow: User pays with card/bank -> Stripe processes -> We mint USDC via Circle
 *
 * Note: Stripe MCP server can be used here if available.
 */
export class StripePaymentProvider implements PaymentProvider {
  private apiKey: string;
  private baseUrl: string;

  constructor(
    private logger: Logger,
    config: {
      apiKey: string;
      isTest?: boolean;
    }
  ) {
    this.apiKey = config.apiKey;
    this.baseUrl = 'https://api.stripe.com';
  }

  async processDeposit(
    paymentMethodId: string,
    amount: Money,
    metadata?: Record<string, unknown>
  ): Promise<{
    transactionId: string;
    status: 'pending' | 'completed' | 'failed';
    amount: Money;
  }> {
    this.logger.info({ paymentMethodId, amount }, 'Processing Stripe deposit');

    try {
      // TODO: Integrate with Stripe MCP server if available

      // Create a payment intent
      const response = await fetch(`${this.baseUrl}/v1/payment_intents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: new URLSearchParams({
          amount: Math.round(amount.amount * 100).toString(), // Stripe uses cents
          currency: amount.currency.toLowerCase(),
          payment_method: paymentMethodId,
          confirm: 'true',
          'metadata[type]': 'deposit',
          ...Object.entries(metadata || {}).reduce((acc, [key, value]) => ({
            ...acc,
            [`metadata[${key}]`]: String(value),
          }), {}),
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to process Stripe deposit: ${error}`);
      }

      const data = await response.json();

      const status = this.mapStripeStatus(data.status);

      this.logger.info(
        { paymentIntentId: data.id, status },
        'Stripe deposit processed'
      );

      return {
        transactionId: data.id,
        status,
        amount,
      };
    } catch (error) {
      this.logger.error({ error, paymentMethodId }, 'Failed to process Stripe deposit');
      throw error;
    }
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
    this.logger.info({ destinationId, amount }, 'Processing Stripe withdrawal');

    try {
      // Create a payout to bank account
      const response = await fetch(`${this.baseUrl}/v1/payouts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: new URLSearchParams({
          amount: Math.round(amount.amount * 100).toString(),
          currency: amount.currency.toLowerCase(),
          destination: destinationId,
          ...Object.entries(metadata || {}).reduce((acc, [key, value]) => ({
            ...acc,
            [`metadata[${key}]`]: String(value),
          }), {}),
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to process Stripe withdrawal: ${error}`);
      }

      const data = await response.json();

      const status = data.status === 'paid' ? 'completed' : 'pending';

      this.logger.info(
        { payoutId: data.id, status },
        'Stripe withdrawal processed'
      );

      return {
        transactionId: data.id,
        status,
        amount,
      };
    } catch (error) {
      this.logger.error({ error, destinationId }, 'Failed to process Stripe withdrawal');
      throw error;
    }
  }

  async getPaymentStatus(transactionId: string): Promise<{
    status: 'pending' | 'completed' | 'failed';
    amount: Money;
  }> {
    this.logger.debug({ transactionId }, 'Getting Stripe payment status');

    try {
      // Try payment intent first
      let response = await fetch(`${this.baseUrl}/v1/payment_intents/${transactionId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        // Try payout if payment intent fails
        response = await fetch(`${this.baseUrl}/v1/payouts/${transactionId}`, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
        });
      }

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to get Stripe payment status: ${error}`);
      }

      const data = await response.json();

      return {
        status: this.mapStripeStatus(data.status),
        amount: {
          amount: data.amount / 100, // Convert from cents
          currency: data.currency.toUpperCase(),
        },
      };
    } catch (error) {
      this.logger.error({ error, transactionId }, 'Failed to get Stripe payment status');
      throw error;
    }
  }

  private mapStripeStatus(stripeStatus: string): 'pending' | 'completed' | 'failed' {
    switch (stripeStatus) {
      case 'succeeded':
      case 'paid':
        return 'completed';
      case 'processing':
      case 'requires_action':
      case 'requires_confirmation':
      case 'requires_payment_method':
        return 'pending';
      case 'canceled':
      case 'failed':
        return 'failed';
      default:
        return 'pending';
    }
  }
}
