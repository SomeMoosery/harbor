import type { Temporal } from 'temporal-polyfill';
import type { SettlementStatus } from '../../public/model/settlement.js';

export interface SettlementRecord {
  id: string;
  escrowLockId: string;
  sellerWalletId: string;
  sellerAgentId: string;
  payoutAmount: number;
  sellerFee: number;
  platformRevenue: number;
  currency: string;
  status: SettlementStatus;
  releaseTransactionId?: string;
  feeTransactionId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Temporal.ZonedDateTime;
  updatedAt: Temporal.ZonedDateTime;
}
