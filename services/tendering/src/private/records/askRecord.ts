import { AskStatus } from '../../public/model/askStatus.js';

/**
 * Database record for Ask - includes all database fields including timestamps
 */
export interface AskRecord {
  id: string;
  title: string;
  description: string;
  requirements: Record<string, unknown>;
  minBudget: number;
  maxBudget: number;
  budgetFlexibilityAmount: number | null;
  createdBy: string;
  status: AskStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

