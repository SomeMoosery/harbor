import type { Temporal } from 'temporal-polyfill';

export type TransactionType =
  | 'DEPOSIT'
  | 'WITHDRAWAL'
  | 'TRANSFER'
  | 'FEE'
  | 'ESCROW_LOCK'
  | 'ESCROW_RELEASE'
  | 'MINT';

export type TransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export interface Transaction {
  id: string;
  type: TransactionType;
  fromWalletId?: string;
  toWalletId?: string;
  amount: number;
  currency: string;
  status: TransactionStatus;
  externalId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Temporal.ZonedDateTime;
  updatedAt: Temporal.ZonedDateTime;
}
