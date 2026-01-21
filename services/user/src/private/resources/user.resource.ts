import type { Sql } from 'postgres';
import type { Logger } from '@harbor/logger';
import { NotFoundError } from '@harbor/errors';
import { User } from '../../public/model/user.js';
import { UserRecord } from '../records/userRecord.js';
import { UserType, SubType } from '../../public/model/userType.js';
import { Temporal } from 'temporal-polyfill';

/**
 * Database row type for users table
 * Uses snake_case to match database column names
 */
interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  user_type: string;
  sub_type: string;
  google_id: string | null;
  onboarding_completed: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export class UserResource {
  constructor(
    private readonly sql: Sql,
    private readonly logger: Logger
  ) {}

  /**
   * Create a new user from OAuth login
   */
  async createFromOAuth(data: {
    name: string;
    email: string;
    googleId: string;
  }): Promise<User> {
    this.logger.info({ email: data.email }, 'Creating user from OAuth');

    const [userRow] = await this.sql<UserRow[]>`
      INSERT INTO users (name, email, google_id, user_type, sub_type, onboarding_completed)
      VALUES (${data.name}, ${data.email}, ${data.googleId}, 'UNKNOWN', 'PERSONAL', false)
      RETURNING *
    `;

    if (!userRow) {
      throw new Error('Failed to create user');
    }

    const record = this.rowToRecord(userRow);
    return this.recordToUser(record);
  }

  /**
   * Find user by Google ID
   */
  async findByGoogleId(googleId: string): Promise<User | null> {
    const [userRow] = await this.sql<UserRow[]>`
      SELECT * FROM users
      WHERE google_id = ${googleId} AND deleted_at IS NULL
    `;

    if (!userRow) {
      return null;
    }

    const record = this.rowToRecord(userRow);
    return this.recordToUser(record);
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    const [userRow] = await this.sql<UserRow[]>`
      SELECT * FROM users
      WHERE email = ${email} AND deleted_at IS NULL
    `;

    if (!userRow) {
      return null;
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

  /**
   * Update user type and sub-type (onboarding completion)
   */
  async updateUserType(
    id: string,
    userType: UserType,
    subType: SubType
  ): Promise<User> {
    this.logger.info({ userId: id, userType, subType }, 'Updating user type');

    const now = new Date();
    const [userRow] = await this.sql<UserRow[]>`
      UPDATE users
      SET user_type = ${userType},
          sub_type = ${subType},
          onboarding_completed = true,
          updated_at = ${now}
      WHERE id = ${id} AND deleted_at IS NULL
      RETURNING *
    `;

    if (!userRow) {
      throw new NotFoundError('User', id);
    }

    const record = this.rowToRecord(userRow);
    return this.recordToUser(record);
  }

  /**
   * Count agents for a user (used to check if user can switch to AGENT type)
   */
  async countAgents(userId: string): Promise<number> {
    const [result] = await this.sql<{ count: string }[]>`
      SELECT COUNT(*) as count FROM agents
      WHERE user_id = ${userId} AND deleted_at IS NULL
    `;

    return parseInt(result?.count ?? '0', 10);
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
      email: row.email,
      phone: row.phone,
      userType: row.user_type as UserType,
      subType: row.sub_type as SubType,
      googleId: row.google_id,
      onboardingCompleted: row.onboarding_completed,
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
      email: record.email,
      phone: record.phone,
      userType: record.userType,
      subType: record.subType,
      googleId: record.googleId,
      onboardingCompleted: record.onboardingCompleted,
    };
  }
}
