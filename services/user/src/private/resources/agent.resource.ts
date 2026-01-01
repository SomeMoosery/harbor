import { eq, and, isNull } from 'drizzle-orm';
import type { Logger } from '@harbor/logger';
import { NotFoundError } from '@harbor/errors';
import { getDb, agents, type AgentRow } from '../store/index.js';
import { Agent } from '../../public/model/agent.js';
import { AgentRecord } from '../records/agentRecord.js';
import { AgentType } from '../../public/model/agentType.js';
import { Temporal } from 'temporal-polyfill';

export class AgentResource {
  constructor(
    private readonly db: ReturnType<typeof getDb>,
    private readonly logger: Logger
  ) {}

  async create(data: {
    userId: string;
    name: string;
    capabilities: Record<string, unknown>;
    type: AgentType;
  }): Promise<Agent> {
    this.logger.info({ data }, 'Creating agent');

    const [agentRow] = await this.db
      .insert(agents)
      .values(data)
      .returning();

    if (!agentRow) {
      throw new Error('Failed to create agent');
    }

    const record = this.rowToRecord(agentRow);
    return this.recordToAgent(record);
  }

  async findById(id: string): Promise<Agent> {
    const [agentRow] = await this.db
      .select()
      .from(agents)
      .where(and(eq(agents.id, id), isNull(agents.deletedAt)));

    if (!agentRow) {
      throw new NotFoundError('Agent', id);
    }

    const record = this.rowToRecord(agentRow);
    return this.recordToAgent(record);
  }

  async findByUserId(userId: string): Promise<Agent[]> {
    const result = await this.db
      .select()
      .from(agents)
      .where(and(eq(agents.userId, userId), isNull(agents.deletedAt)));

    return result.map((row: AgentRow) => {
      const record = this.rowToRecord(row);
      return this.recordToAgent(record);
    });
  }

  async updateType(id: string, type: AgentType): Promise<Agent> {
    this.logger.info({ agentId: id, type }, 'Updating agent type');

    const [agentRow] = await this.db
      .update(agents)
      .set({
        type,
        updatedAt: Temporal.Now.zonedDateTimeISO()
      })
      .where(and(eq(agents.id, id), isNull(agents.deletedAt)))
      .returning();

    if (!agentRow) {
      throw new NotFoundError('Agent', id);
    }

    const record = this.rowToRecord(agentRow);
    return this.recordToAgent(record);
  }

  async softDeleteByUserId(userId: string): Promise<void> {
    this.logger.info({ userId }, 'Soft deleting all agents for user');

    await this.db
      .update(agents)
      .set({
        deletedAt: Temporal.Now.zonedDateTimeISO(),
        updatedAt: Temporal.Now.zonedDateTimeISO(),
      })
      .where(and(eq(agents.userId, userId), isNull(agents.deletedAt)));
  }

  private rowToRecord(row: AgentRow): AgentRecord {
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      capabilities: row.capabilities,
      type: row.type as AgentType,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
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
