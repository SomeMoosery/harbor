import type { Temporal } from 'temporal-polyfill';
import type { WalletStatus } from '../../public/model/wallet.js';

export interface WalletRecord {
  id: string;
  agentId: string;
  circleWalletId?: string;
  walletAddress?: string;
  status: WalletStatus;
  createdAt: Temporal.ZonedDateTime;
  updatedAt: Temporal.ZonedDateTime;
  deletedAt?: Temporal.ZonedDateTime;
}
