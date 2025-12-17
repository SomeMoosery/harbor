import type { Temporal } from 'temporal-polyfill';
import type { LedgerEntryType, LedgerEntryStatus } from '../../public/model/ledgerEntry.js';

export interface LedgerEntryRecord {
  id: string;
  agentId: string;
  walletId: string;

  // Type and status
  type: LedgerEntryType;
  status: LedgerEntryStatus;

  // External provider (e.g., Stripe)
  externalProvider: string | null;
  externalTransactionId: string | null;
  externalAmount: number | null;
  externalCurrency: string | null;
  externalStatus: string | null;
  externalCompletedAt: Temporal.ZonedDateTime | null;

  // Internal wallet (e.g., Circle)
  internalTransactionId: string | null;
  internalAmount: number;
  internalCurrency: string;
  internalStatus: string | null;
  internalCompletedAt: Temporal.ZonedDateTime | null;

  // Reconciliation
  reconciledAt: Temporal.ZonedDateTime | null;
  reconciliationNotes: string | null;

  // Fees
  platformFee: number;
  externalProviderFee: number;

  description: string;
  metadata?: Record<string, unknown>;
  createdAt: Temporal.ZonedDateTime;
  updatedAt: Temporal.ZonedDateTime;
}
