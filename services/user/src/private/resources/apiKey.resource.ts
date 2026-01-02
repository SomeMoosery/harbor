import type { Sql } from 'postgres';
import type { Logger } from '@harbor/logger';
import { NotFoundError } from '@harbor/errors';
import { ApiKey } from '../../public/model/apiKey.js';
import { ApiKeyRecord } from '../records/apiKeyRecord.js';
import { Temporal } from 'temporal-polyfill';
import { randomBytes } from 'node:crypto';

/**
 * Database row type for api_keys table
 * Uses snake_case to match database column names
 */
interface ApiKeyRow {
  id: string;
  user_id: string;
  key: string;
  name: string | null;
  last_used_at: Date | null;
  created_at: Date;
  deleted_at: Date | null;
}

export class ApiKeyResource {
  constructor(
    private readonly sql: Sql,
    private readonly logger: Logger
  ) {}

  /**
   * Generate a secure API key
   */
  private generateApiKey(): string {
    // Format: hbr_live_<32 random hex chars>
    const randomPart = randomBytes(16).toString('hex');
    return `hbr_live_${randomPart}`;
  }

  async create(data: {
    userId: string;
    name?: string;
  }): Promise<ApiKey> {
    this.logger.info({ userId: data.userId, name: data.name }, 'Creating API key');

    const key = this.generateApiKey();

    const [apiKeyRow] = await this.sql<ApiKeyRow[]>`
      INSERT INTO api_keys (user_id, key, name)
      VALUES (${data.userId}, ${key}, ${data.name ?? null})
      RETURNING *
    `;

    if (!apiKeyRow) {
      throw new Error('Failed to create API key');
    }

    const record = this.rowToRecord(apiKeyRow);
    return this.recordToApiKey(record);
  }

  async findByKey(key: string): Promise<ApiKey | null> {
    const [apiKeyRow] = await this.sql<ApiKeyRow[]>`
      SELECT * FROM api_keys
      WHERE key = ${key} AND deleted_at IS NULL
    `;

    if (!apiKeyRow) {
      return null;
    }

    const record = this.rowToRecord(apiKeyRow);
    return this.recordToApiKey(record);
  }

  async findByUserId(userId: string): Promise<ApiKey[]> {
    const apiKeyRows = await this.sql<ApiKeyRow[]>`
      SELECT * FROM api_keys
      WHERE user_id = ${userId} AND deleted_at IS NULL
    `;

    return apiKeyRows.map(row => {
      const record = this.rowToRecord(row);
      return this.recordToApiKey(record);
    });
  }

  async updateLastUsed(key: string): Promise<void> {
    const now = new Date();
    await this.sql`
      UPDATE api_keys
      SET last_used_at = ${now}
      WHERE key = ${key}
    `;
  }

  async delete(id: string, userId: string): Promise<void> {
    this.logger.info({ id, userId }, 'Soft deleting API key');

    const now = new Date();
    const [result] = await this.sql<ApiKeyRow[]>`
      UPDATE api_keys
      SET deleted_at = ${now}
      WHERE id = ${id} AND user_id = ${userId}
      RETURNING *
    `;

    if (!result) {
      throw new NotFoundError('API Key', id);
    }
  }

  /**
   * Convert database row to ApiKeyRecord
   * postgres.js returns Date objects for TIMESTAMPTZ, convert to Temporal
   */
  private rowToRecord(row: ApiKeyRow): ApiKeyRecord {
    return {
      id: row.id,
      userId: row.user_id,
      key: row.key,
      name: row.name || undefined,
      lastUsedAt: row.last_used_at
        ? Temporal.Instant.fromEpochMilliseconds(row.last_used_at.getTime()).toZonedDateTimeISO('UTC')
        : undefined,
      createdAt: Temporal.Instant.fromEpochMilliseconds(row.created_at.getTime()).toZonedDateTimeISO('UTC'),
      deletedAt: row.deleted_at
        ? Temporal.Instant.fromEpochMilliseconds(row.deleted_at.getTime()).toZonedDateTimeISO('UTC')
        : undefined,
    };
  }

  private recordToApiKey(record: ApiKeyRecord): ApiKey {
    return {
      id: record.id,
      userId: record.userId,
      key: record.key,
      name: record.name,
      lastUsedAt: record.lastUsedAt,
      createdAt: record.createdAt,
    };
  }
}
