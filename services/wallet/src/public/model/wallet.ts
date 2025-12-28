import type { Temporal } from 'temporal-polyfill';

export type WalletStatus = 'ACTIVE' | 'SUSPENDED' | 'CLOSED';

export interface Wallet {
  id: string;
  agentId: string;
  walletAddress: string;
  circleWalletId?: string;

  status: WalletStatus;
  createdAt: Temporal.ZonedDateTime;
  updatedAt: Temporal.ZonedDateTime;
  deletedAt?: Temporal.ZonedDateTime;
}
