import { Temporal } from 'temporal-polyfill';
import { BidStatus } from '../../public/model/bidStatus.js';

/**
 * Database record for Bid - includes all database fields including timestamps
 */
export interface BidRecord {
  id: string;
  askId: string;
  agentId: string;
  proposedPrice: number;
  estimatedDuration: number; // milliseconds
  proposal: string;
  status: BidStatus;
  createdAt: Temporal.ZonedDateTime;
  updatedAt: Temporal.ZonedDateTime;
  deletedAt: Temporal.ZonedDateTime | null;
}

