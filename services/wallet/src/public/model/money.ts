/**
 * Money type that supports multiple currencies
 * This abstraction allows us to handle USDC, USD, and other currencies
 */
export interface Money {
  amount: number;
  currency: string;
}

/**
 * Supported currencies
 */
export type Currency = 'USDC' | 'USD';

/**
 * Helper to create a Money object
 */
export function createMoney(amount: number, currency: Currency = 'USDC'): Money {
  return { amount, currency };
}
