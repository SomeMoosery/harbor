import { eq, and, isNull } from 'drizzle-orm';
import type { Logger } from '@harbor/logger';
import { NotFoundError } from '@harbor/errors';
import { getDb, users, type UserRow } from '../store/index.js';
import { User } from '../../public/model/user.js';
import { UserRecord } from '../records/userRecord.js';
import { UserType } from '../../public/model/userType.js';
import { Temporal } from 'temporal-polyfill';

export class UserResource {
  constructor(
    private readonly db: ReturnType<typeof getDb>,
    private readonly logger: Logger
  ) {}

  async create(data: {
    name: string;
    type: UserType;
    email: string;
    phone: string;
  }): Promise<User> {
    this.logger.info({ data }, 'Creating user');

    const [userRow] = await this.db
      .insert(users)
      .values(data)
      .returning();

    if (!userRow) {
      throw new Error('Failed to create user');
    }

    const record = this.rowToRecord(userRow);
    return this.recordToUser(record);
  }

  async findById(id: string): Promise<User> {
    const [userRow] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)));

    if (!userRow) {
      throw new NotFoundError('User', id);
    }

    const record = this.rowToRecord(userRow);
    return this.recordToUser(record);
  }

  async exists(id: string): Promise<boolean> {
    const [userRow] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)));

    return !!userRow;
  }

  async softDelete(id: string): Promise<void> {
    this.logger.info({ userId: id }, 'Soft deleting user');

    const [userRow] = await this.db
      .update(users)
      .set({
        deletedAt: Temporal.Now.zonedDateTimeISO(),
        updatedAt: Temporal.Now.zonedDateTimeISO(),
      })
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .returning();

    if (!userRow) {
      throw new NotFoundError('User', id);
    }
  }

  private rowToRecord(row: UserRow): UserRecord {
    return {
      id: row.id,
      name: row.name,
      type: row.type as UserType,
      email: row.email,
      phone: row.phone,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
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
