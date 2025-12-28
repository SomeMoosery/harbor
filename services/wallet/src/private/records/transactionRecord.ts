import type { Temporal } from 'temporal-polyfill';
import type { TransactionType, TransactionStatus } from '../../public/model/transaction.js';
import { Money } from '../../public/model/money.js';

export interface TransactionRecord {
  id: string;
  type: TransactionType;
  fromWalletId?: string;
  toWalletId?: string;
  amount: Money;
  currency: string;
  status: TransactionStatus;
  externalId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Temporal.ZonedDateTime;
  updatedAt: Temporal.ZonedDateTime;
}
