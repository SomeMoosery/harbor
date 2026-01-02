import type { Sql } from 'postgres';
import type { Logger } from '@harbor/logger';
import { NotFoundError } from '@harbor/errors';
import { User } from '../../public/model/user.js';
import { UserRecord } from '../records/userRecord.js';
import { UserType } from '../../public/model/userType.js';
import { Temporal } from 'temporal-polyfill';

/**
 * Database row type for users table
 * Uses snake_case to match database column names
 */
interface UserRow {
  id: string;
  name: string;
  type: string;
  email: string;
  phone: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export class UserResource {
  constructor(
    private readonly sql: Sql,
    private readonly logger: Logger
  ) {}

  async create(data: {
    name: string;
    type: UserType;
    email: string;
    phone: string;
  }): Promise<User> {
    this.logger.info({ data }, 'Creating user');

    const [userRow] = await this.sql<UserRow[]>`
      INSERT INTO users (name, type, email, phone)
      VALUES (${data.name}, ${data.type}, ${data.email}, ${data.phone})
      RETURNING *
    `;

    if (!userRow) {
      throw new Error('Failed to create user');
    }

    const record = this.rowToRecord(userRow);
    return this.recordToUser(record);
  }

  async findById(id: string): Promise<User> {
    const [userRow] = await this.sql<UserRow[]>`
      SELECT * FROM users
      WHERE id = ${id} AND deleted_at IS NULL
    `;

    if (!userRow) {
      throw new NotFoundError('User', id);
    }

    const record = this.rowToRecord(userRow);
    return this.recordToUser(record);
  }

  async exists(id: string): Promise<boolean> {
    const [result] = await this.sql<{ exists: boolean }[]>`
      SELECT EXISTS(
        SELECT 1 FROM users
        WHERE id = ${id} AND deleted_at IS NULL
      ) as exists
    `;

    return result?.exists ?? false;
  }

  async softDelete(id: string): Promise<void> {
    this.logger.info({ userId: id }, 'Soft deleting user');

    const now = new Date();
    const [userRow] = await this.sql<UserRow[]>`
      UPDATE users
      SET deleted_at = ${now}, updated_at = ${now}
      WHERE id = ${id} AND deleted_at IS NULL
      RETURNING *
    `;

    if (!userRow) {
      throw new NotFoundError('User', id);
    }
  }

  /**
   * Convert database row to UserRecord
   * postgres.js returns Date objects for TIMESTAMPTZ, convert to Temporal
   */
  private rowToRecord(row: UserRow): UserRecord {
    return {
      id: row.id,
      name: row.name,
      type: row.type as UserType,
      email: row.email,
      phone: row.phone,
      createdAt: Temporal.Instant.fromEpochMilliseconds(row.created_at.getTime()).toZonedDateTimeISO('UTC'),
      updatedAt: Temporal.Instant.fromEpochMilliseconds(row.updated_at.getTime()).toZonedDateTimeISO('UTC'),
      deletedAt: row.deleted_at
        ? Temporal.Instant.fromEpochMilliseconds(row.deleted_at.getTime()).toZonedDateTimeISO('UTC')
        : null,
    };
  }

  private recordToUser(record: UserRecord): User {
    return {
      id: record.id,
      name: record.name,
      type: record.type,
      email: record.email,
      phone: record.phone,
    };
  }
}
