import { pgTable, text, jsonb, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { temporalTimestamp, temporalTimestampNullable } from '@harbor/db/temporal';
import { Temporal } from 'temporal-polyfill';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  type: text('type', { enum: ['BUSINESS', 'PERSONAL'] }).notNull(),
  email: text('email').notNull().unique(),
  phone: text('phone').notNull().unique(),
  createdAt: temporalTimestamp('created_at').notNull().default(Temporal.Now.zonedDateTimeISO()),
  updatedAt: temporalTimestamp('updated_at').notNull().default(Temporal.Now.zonedDateTimeISO()),
  deletedAt: temporalTimestampNullable('deleted_at'),
});

export const agents = pgTable('agents', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  name: text('name').notNull(),
  capabilities: jsonb('capabilities').notNull().$type<Record<string, unknown>>(),
  type: text('type', { enum: ['BUYER', 'SELLER', 'DUAL'] }).notNull(),
  createdAt: temporalTimestamp('created_at').notNull().default(Temporal.Now.zonedDateTimeISO()),
  updatedAt: temporalTimestamp('updated_at').notNull().default(Temporal.Now.zonedDateTimeISO()),
  deletedAt: temporalTimestampNullable('deleted_at'),
});

export type UserRow = typeof users.$inferSelect;
export type AgentRow = typeof agents.$inferSelect;
