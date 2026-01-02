import type { Sql } from 'postgres';
import type { Logger } from '@harbor/logger';
import { NotFoundError } from '@harbor/errors';
import { Agent } from '../../public/model/agent.js';
import { AgentRecord } from '../records/agentRecord.js';
import { AgentType } from '../../public/model/agentType.js';
import { Temporal } from 'temporal-polyfill';

/**
 * Database row type for agents table
 * Uses snake_case to match database column names
 */
interface AgentRow {
  id: string;
  user_id: string;
  name: string;
  capabilities: Record<string, unknown>;
  type: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export class AgentResource {
  constructor(
    private readonly sql: Sql,
    private readonly logger: Logger
  ) {}

  async create(data: {
    userId: string;
    name: string;
    capabilities: Record<string, unknown>;
    type: AgentType;
  }): Promise<Agent> {
    this.logger.info({ data }, 'Creating agent');

    const [agentRow] = await this.sql<AgentRow[]>`
      INSERT INTO agents (user_id, name, capabilities, type)
      VALUES (${data.userId}, ${data.name}, ${data.capabilities as any}, ${data.type})
      RETURNING *
    `;

    if (!agentRow) {
      throw new Error('Failed to create agent');
    }

    const record = this.rowToRecord(agentRow);
    return this.recordToAgent(record);
  }

  async findById(id: string): Promise<Agent> {
    const [agentRow] = await this.sql<AgentRow[]>`
      SELECT * FROM agents
      WHERE id = ${id} AND deleted_at IS NULL
    `;

    if (!agentRow) {
      throw new NotFoundError('Agent', id);
    }

    const record = this.rowToRecord(agentRow);
    return this.recordToAgent(record);
  }

  async findByUserId(userId: string): Promise<Agent[]> {
    const agentRows = await this.sql<AgentRow[]>`
      SELECT * FROM agents
      WHERE user_id = ${userId} AND deleted_at IS NULL
    `;

    return agentRows.map(row => {
      const record = this.rowToRecord(row);
      return this.recordToAgent(record);
    });
  }

  async updateType(id: string, type: AgentType): Promise<Agent> {
    this.logger.info({ agentId: id, type }, 'Updating agent type');

    const now = new Date();
    const [agentRow] = await this.sql<AgentRow[]>`
      UPDATE agents
      SET type = ${type}, updated_at = ${now}
      WHERE id = ${id} AND deleted_at IS NULL
      RETURNING *
    `;

    if (!agentRow) {
      throw new NotFoundError('Agent', id);
    }

    const record = this.rowToRecord(agentRow);
    return this.recordToAgent(record);
  }

  async softDeleteByUserId(userId: string): Promise<void> {
    this.logger.info({ userId }, 'Soft deleting all agents for user');

    const now = new Date();
    await this.sql`
      UPDATE agents
      SET deleted_at = ${now}, updated_at = ${now}
      WHERE user_id = ${userId} AND deleted_at IS NULL
    `;
  }

  /**
   * Convert database row to AgentRecord
   * postgres.js returns Date objects for TIMESTAMPTZ, convert to Temporal
   */
  private rowToRecord(row: AgentRow): AgentRecord {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      capabilities: row.capabilities,
      type: row.type as AgentType,
      createdAt: Temporal.Instant.fromEpochMilliseconds(row.created_at.getTime()).toZonedDateTimeISO('UTC'),
      updatedAt: Temporal.Instant.fromEpochMilliseconds(row.updated_at.getTime()).toZonedDateTimeISO('UTC'),
      deletedAt: row.deleted_at
        ? Temporal.Instant.fromEpochMilliseconds(row.deleted_at.getTime()).toZonedDateTimeISO('UTC')
        : null,
    };
  }

  private recordToAgent(record: AgentRecord): Agent {
    return {
      id: record.id,
      userId: record.userId,
      name: record.name,
      capabilities: record.capabilities,
      type: record.type,
    };
  }
}
