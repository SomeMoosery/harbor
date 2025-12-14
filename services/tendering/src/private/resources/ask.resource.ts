import { eq, isNull, and } from 'drizzle-orm';
import type { Logger } from '@harbor/logger';
import { NotFoundError } from '@harbor/errors';
import { AskRow, asks, getDb } from '../store/index.js';
import { Ask } from '../../public/model/ask.js';
import { AskRecord } from '../records/askRecord.js';
import { AskStatus } from '../../public/model/askStatus.js';
import { Temporal } from 'temporal-polyfill';

export class AskResource {
  constructor(
    private readonly db: ReturnType<typeof getDb>,
    private readonly logger: Logger
  ) {}

  async create(data: {
    title: string;
    description: string;
    requirements: Record<string, unknown>;
    minBudget: number;
    maxBudget: number;
    budgetFlexibilityAmount?: number;
    createdBy: string;
  }): Promise<Ask> {
    this.logger.info({ data }, 'Creating ask');

    const [askRow] = await this.db
      .insert(asks)
      .values({
        ...data,
        budgetFlexibilityAmount: data.budgetFlexibilityAmount ?? null,
        status: 'OPEN',
      })
      .returning();

    if (!askRow) {
      throw new Error('Failed to create ask');
    }

    const record = this.rowToRecord(askRow);
    return this.recordToAsk(record);
  }

  async findById(id: string): Promise<Ask> {
    const [askRow] = await this.db
      .select()
      .from(asks)
      .where(eq(asks.id, id));

    if (!askRow) {
      throw new NotFoundError('Ask', id);
    }

    const record = this.rowToRecord(askRow);
    return this.recordToAsk(record);
  }

  async findAll(filters?: { status?: AskStatus; createdBy?: string }): Promise<Ask[]> {
    const conditions = [isNull(asks.deletedAt)];

    if (filters?.status) {
      conditions.push(eq(asks.status, filters.status));
    }

    if (filters?.createdBy) {
      conditions.push(eq(asks.createdBy, filters.createdBy));
    }

    const result = await this.db
      .select()
      .from(asks)
      .where(and(...conditions));

    return result.map((row) => {
      const record = this.rowToRecord(row);
      return this.recordToAsk(record);
    });
  }

  async updateStatus(id: string, status: AskStatus): Promise<Ask> {
    const [askRow] = await this.db
      .update(asks)
      .set({ status, updatedAt: Temporal.Now.zonedDateTimeISO() })
      .where(eq(asks.id, id))
      .returning();

    if (!askRow) {
      throw new NotFoundError('Ask', id);
    }

    const record = this.rowToRecord(askRow);
    return this.recordToAsk(record);
  }

  private rowToRecord(row: AskRow): AskRecord {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      requirements: row.requirements,
      minBudget: row.minBudget ?? 0,
      maxBudget: row.maxBudget ?? 0,
      budgetFlexibilityAmount: row.budgetFlexibilityAmount,
      createdBy: row.createdBy,
      status: row.status as AskStatus,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    };
  }

  private recordToAsk(record: AskRecord): Ask {
    return {
      id: record.id,
      title: record.title,
      description: record.description,
      requirements: record.requirements,
      minBudget: record.minBudget,
      maxBudget: record.maxBudget,
      budgetFlexibilityAmount: record.budgetFlexibilityAmount ?? undefined,
      createdBy: record.createdBy,
      status: record.status,
    };
  }

}
