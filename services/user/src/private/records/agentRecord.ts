import { Temporal } from 'temporal-polyfill';
import { AgentType } from '../../public/model/agentType.js';

/**
 * Database record for Agent - includes all database fields including timestamps
 */
export interface AgentRecord {
  id: string;
  userId: string;
  name: string;
  capabilities: Record<string, unknown>;
  type: AgentType;
  createdAt: Temporal.ZonedDateTime;
  updatedAt: Temporal.ZonedDateTime;
  deletedAt: Temporal.ZonedDateTime | null;
}
