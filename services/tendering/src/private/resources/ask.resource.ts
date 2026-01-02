import type { Logger } from '@harbor/logger';
import type { Sql } from 'postgres';
import { NotFoundError } from '@harbor/errors';
import { Ask } from '../../public/model/ask.js';
import { AskRecord } from '../records/askRecord.js';
import { AskStatus } from '../../public/model/askStatus.js';
import { Temporal } from 'temporal-polyfill';

interface AskRow {
  id: string;
  title: string;
  description: string;
  requirements: Record<string, unknown>;
  min_budget: number;
  max_budget: number;
  budget_flexibility_amount: number | null;
  created_by: string;
  status: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export class AskResource {
  constructor(
    private readonly sql: Sql,
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

    const [askRow] = await this.sql<AskRow[]>`
      INSERT INTO asks (
        title, description, requirements, min_budget, max_budget,
        budget_flexibility_amount, created_by, status
      )
      VALUES (
        ${data.title},
        ${data.description},
        ${data.requirements as any},
        ${data.minBudget},
        ${data.maxBudget},
        ${data.budgetFlexibilityAmount ?? null},
        ${data.createdBy},
        'OPEN'
      )
      RETURNING *
    `;

    if (!askRow) {
      throw new Error('Failed to create ask');
    }

    const record = this.rowToRecord(askRow);
    return this.recordToAsk(record);
  }

  async findById(id: string): Promise<Ask> {
    const [askRow] = await this.sql<AskRow[]>`
      SELECT * FROM asks
      WHERE id = ${id}
    `;

    if (!askRow) {
      throw new NotFoundError('Ask', id);
    }

    const record = this.rowToRecord(askRow);
    return this.recordToAsk(record);
  }

  async findAll(filters?: { status?: AskStatus; createdBy?: string }): Promise<Ask[]> {
    let query = this.sql<AskRow[]>`
      SELECT * FROM asks
      WHERE deleted_at IS NULL
    `;

    if (filters?.status && filters?.createdBy) {
      query = this.sql<AskRow[]>`
        SELECT * FROM asks
        WHERE deleted_at IS NULL
          AND status = ${filters.status}
          AND created_by = ${filters.createdBy}
      `;
    } else if (filters?.status) {
      query = this.sql<AskRow[]>`
        SELECT * FROM asks
        WHERE deleted_at IS NULL
          AND status = ${filters.status}
      `;
    } else if (filters?.createdBy) {
      query = this.sql<AskRow[]>`
        SELECT * FROM asks
        WHERE deleted_at IS NULL
          AND created_by = ${filters.createdBy}
      `;
    }

    const result = await query;

    return result.map((row) => {
      const record = this.rowToRecord(row);
      return this.recordToAsk(record);
    });
  }

  async updateStatus(id: string, status: AskStatus): Promise<Ask> {
    const [askRow] = await this.sql<AskRow[]>`
      UPDATE asks
      SET status = ${status},
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

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
      minBudget: row.min_budget ?? 0,
      maxBudget: row.max_budget ?? 0,
      budgetFlexibilityAmount: row.budget_flexibility_amount ?? undefined,
      createdBy: row.created_by,
      status: row.status as AskStatus,
      createdAt: Temporal.Instant.fromEpochMilliseconds(row.created_at.getTime()).toZonedDateTimeISO('UTC'),
      updatedAt: Temporal.Instant.fromEpochMilliseconds(row.updated_at.getTime()).toZonedDateTimeISO('UTC'),
      deletedAt: row.deleted_at
        ? Temporal.Instant.fromEpochMilliseconds(row.deleted_at.getTime()).toZonedDateTimeISO('UTC')
        : undefined,
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
