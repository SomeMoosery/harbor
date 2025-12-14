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
  driverData: Date;
  notNull: false;
  default: false;
}>({
  dataType: () => 'timestamptz',

  /**
   * Convert from database (Date) to application (Temporal.ZonedDateTime)
   */
  fromDriver: (value: Date): Temporal.ZonedDateTime => {
    return Temporal.Instant
      .fromEpochMilliseconds(value.getTime())
      .toZonedDateTimeISO('UTC');
  },

  /**
   * Convert from application (Temporal.ZonedDateTime) to database (Date)
   */
  toDriver: (value: Temporal.ZonedDateTime): Date => {
    return new Date(value.epochMilliseconds);
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
  driverData: Date | null;
  notNull: false;
  default: false;
}>({
  dataType: () => 'timestamptz',

  fromDriver: (value: Date | null): Temporal.ZonedDateTime | null => {
    if (value === null) return null;
    return Temporal.Instant
      .fromEpochMilliseconds(value.getTime())
      .toZonedDateTimeISO('UTC');
  },

  toDriver: (value: Temporal.ZonedDateTime | null): Date | null => {
    if (value === null) return null;
    return new Date(value.epochMilliseconds);
  },
});
