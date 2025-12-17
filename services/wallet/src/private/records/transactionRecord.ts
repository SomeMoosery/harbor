import type { Temporal } from 'temporal-polyfill';
import type { TransactionType, TransactionStatus } from '../../public/model/transaction.js';

export interface TransactionRecord {
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
