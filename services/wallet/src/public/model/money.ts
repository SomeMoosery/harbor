/**
 * Money type that supports multiple currencies
 *
 * Internal representation: amount is always in the major unit (dollars, not cents)
 * - 100 = $100.00
 * - 0.01 = $0.01
 * - 1.5 = $1.50
 * 
 * TODO - we'll want to also store whether we're using dollars or cents
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

/**
 * Convert major units to minor units (e.g., dollars to cents)
 * Used when external APIs expect amounts in smallest currency unit
 */
export function toMinorUnits(money: Money, decimals: number = 2): number {
  return Math.round(money.amount * Math.pow(10, decimals));
}

/**
 * Convert minor units to Money (e.g., cents to dollars)
 * Used when receiving amounts from external APIs in smallest currency unit
 */
export function fromMinorUnits(minorUnits: number, currency: Currency = 'USD', decimals: number = 2): Money {
  return {
    amount: minorUnits / Math.pow(10, decimals),
    currency,
  };
}

/**
 * Format Money as decimal string
 * Used when external APIs expect decimal string representation
 */
export function toDecimalString(money: Money, decimals: number = 2): string {
  return money.amount.toFixed(decimals);
}

/**
 * Parse decimal string to Money
 * Used when receiving decimal string amounts from external APIs
 */
export function fromDecimalString(decimalString: string, currency: Currency = 'USDC'): Money {
  return {
    amount: parseFloat(decimalString),
    currency,
  };
}
