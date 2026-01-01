import { eq, and, isNull } from 'drizzle-orm';
import type { Logger } from '@harbor/logger';
import { NotFoundError } from '@harbor/errors';
import { getDb, apiKeys, type ApiKeyRow } from '../store/index.js';
import { ApiKey } from '../../public/model/apiKey.js';
import { ApiKeyRecord } from '../records/apiKeyRecord.js';
import { Temporal } from 'temporal-polyfill';
import { randomBytes } from 'node:crypto';

export class ApiKeyResource {
  constructor(
    private readonly db: ReturnType<typeof getDb>,
    private readonly logger: Logger
  ) {}

  /**
   * Generate a secure API key
   */
  private generateApiKey(): string {
    // Format: hbr_live_<32 random hex chars> or hbr_test_<32 random hex chars>
    const randomPart = randomBytes(16).toString('hex');
    return `hbr_live_${randomPart}`;
  }

  async create(data: {
    userId: string;
    name?: string;
  }): Promise<ApiKey> {
    this.logger.info({ userId: data.userId, name: data.name }, 'Creating API key');

    const key = this.generateApiKey();

    const [apiKeyRow] = await this.db
      .insert(apiKeys)
      .values({
        userId: data.userId,
        key,
        name: data.name,
      })
      .returning();

    if (!apiKeyRow) {
      throw new Error('Failed to create API key');
    }

    const record = this.rowToRecord(apiKeyRow);
    return this.recordToApiKey(record);
  }

  async findByKey(key: string): Promise<ApiKey | null> {
    const [apiKeyRow] = await this.db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.key, key), isNull(apiKeys.deletedAt)));

    if (!apiKeyRow) {
      return null;
    }

    const record = this.rowToRecord(apiKeyRow);
    return this.recordToApiKey(record);
  }

  async findByUserId(userId: string): Promise<ApiKey[]> {
    const apiKeyRows = await this.db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.userId, userId), isNull(apiKeys.deletedAt)));

    return apiKeyRows.map((row: ApiKeyRow) => {
      const record = this.rowToRecord(row);
      return this.recordToApiKey(record);
    });
  }

  async updateLastUsed(key: string): Promise<void> {
    await this.db
      .update(apiKeys)
      .set({ lastUsedAt: Temporal.Now.zonedDateTimeISO() })
      .where(eq(apiKeys.key, key));
  }

  async delete(id: string, userId: string): Promise<void> {
    this.logger.info({ id, userId }, 'Soft deleting API key');

    const result = await this.db
      .update(apiKeys)
      .set({ deletedAt: Temporal.Now.zonedDateTimeISO() })
      .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)))
      .returning();

    if (!result.length) {
      throw new NotFoundError('API Key', id);
    }
  }

  private rowToRecord(row: ApiKeyRow): ApiKeyRecord {
    return {
      id: row.id,
      userId: row.userId,
      key: row.key,
      name: row.name || undefined,
      lastUsedAt: row.lastUsedAt || undefined,
      createdAt: row.createdAt,
      deletedAt: row.deletedAt || undefined,
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
