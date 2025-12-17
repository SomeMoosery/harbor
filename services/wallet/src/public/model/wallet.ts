import type { Temporal } from 'temporal-polyfill';

export type WalletStatus = 'ACTIVE' | 'SUSPENDED' | 'CLOSED';

export interface Wallet {
  id: string;
  agentId: string;
  circleWalletId?: string;
  status: WalletStatus;
  createdAt: Temporal.ZonedDateTime;
  updatedAt: Temporal.ZonedDateTime;
  deletedAt?: Temporal.ZonedDateTime;
}
