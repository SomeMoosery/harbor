import { customType } from 'drizzle-orm/pg-core';
import { Temporal } from 'temporal-polyfill';

/**
 * Custom Drizzle column type for Temporal.ZonedDateTime
 *
 * This allows you to use Temporal objects throughout your application
 * while the database still stores standard PostgreSQL timestamps.
 *
 * Usage in schema:
 * ```typescript
 * import { temporalTimestamp } from '@harbor/db/temporal';
 *
 * export const myTable = pgTable('my_table', {
 *   createdAt: temporalTimestamp('created_at').notNull().default(sql`NOW()`),
 *   updatedAt: temporalTimestamp('updated_at').notNull(),
 * });
 * ```
 *
 * Usage in code:
 * ```typescript
 * await db.update(myTable).set({
 *   updatedAt: Temporal.Now.zonedDateTimeISO() // ✅ Just works!
 * });
 * ```
 */
export const temporalTimestamp = customType<{
  data: Temporal.ZonedDateTime;
  driverData: string;
  notNull: false;
  default: false;
}>({
  dataType: () => 'timestamptz',

  /**
   * Convert from database (Date or string) to application (Temporal.ZonedDateTime)
   */
  fromDriver: (value: Date | string): Temporal.ZonedDateTime => {
    // postgres-js returns timestamps as strings by default
    const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
    return Temporal.Instant
      .fromEpochMilliseconds(timestamp)
      .toZonedDateTimeISO('UTC');
  },

  /**
   * Convert from application (Temporal.ZonedDateTime) to database (ISO string)
   */
  toDriver: (value: Temporal.ZonedDateTime): string => {
    return new Date(value.epochMilliseconds).toISOString();
  },
});

/**
 * Custom Drizzle column type for nullable Temporal.ZonedDateTime
 *
 * Use this for optional timestamp fields like deletedAt.
 *
 * Usage:
 * ```typescript
 * export const myTable = pgTable('my_table', {
 *   deletedAt: temporalTimestampNullable('deleted_at'),
 * });
 * ```
 */
export const temporalTimestampNullable = customType<{
  data: Temporal.ZonedDateTime | null;
  driverData: string | null;
  notNull: false;
  default: false;
}>({
  dataType: () => 'timestamptz',

  fromDriver: (value: Date | string | null): Temporal.ZonedDateTime | null => {
    if (value === null) return null;
    // postgres-js returns timestamps as strings by default
    const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
    return Temporal.Instant
      .fromEpochMilliseconds(timestamp)
      .toZonedDateTimeISO('UTC');
  },

  toDriver: (value: Temporal.ZonedDateTime | null): string | null => {
    if (value === null) return null;
    return new Date(value.epochMilliseconds).toISOString();
  },
});
