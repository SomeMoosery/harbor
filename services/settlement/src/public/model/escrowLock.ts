import type { Temporal } from 'temporal-polyfill';

export type EscrowLockStatus = 'LOCKED' | 'RELEASED' | 'REFUNDED';

export interface EscrowLock {
  id: string;
  askId: string;
  bidId: string;
  buyerWalletId: string;
  buyerAgentId: string;
  totalAmount: number;
  baseAmount: number;
  buyerFee: number;
  currency: string;
  status: EscrowLockStatus;
  lockTransactionId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Temporal.ZonedDateTime;
  updatedAt: Temporal.ZonedDateTime;
}
