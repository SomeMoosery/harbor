import { pgTable, text, jsonb, uuid, real, integer } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { temporalTimestamp, temporalTimestampNullable } from '@harbor/db/temporal';
import { Temporal } from 'temporal-polyfill';

export const asks = pgTable('asks', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  title: text('title').notNull(),
  description: text('description').notNull(),
  requirements: jsonb('requirements').notNull().$type<Record<string, unknown>>(),
  minBudget: real('min_budget').notNull(),
  maxBudget: real('max_budget').notNull(),
  budgetFlexibilityAmount: real('budget_flexibility_amount'),
  createdBy: text('created_by').notNull(),
  status: text('status', { enum: ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] })
    .notNull()
    .default('OPEN'),
  createdAt: temporalTimestamp('created_at').notNull().default(Temporal.Now.zonedDateTimeISO()),
  updatedAt: temporalTimestamp('updated_at').notNull().default(Temporal.Now.zonedDateTimeISO()),
  deletedAt: temporalTimestampNullable('deleted_at'),
});

export const bids = pgTable('bids', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  askId: uuid('ask_id')
    .notNull()
    .references(() => asks.id),
  agentId: text('agent_id').notNull(),
  proposedPrice: real('proposed_price').notNull(),
  estimatedDuration: integer('estimated_duration').notNull(), // milliseconds
  proposal: text('proposal').notNull(),
  status: text('status', { enum: ['PENDING', 'ACCEPTED', 'REJECTED'] })
    .notNull()
    .default('PENDING'),
  createdAt: temporalTimestamp('created_at').notNull().default(Temporal.Now.zonedDateTimeISO()),
  updatedAt: temporalTimestamp('updated_at').notNull().default(Temporal.Now.zonedDateTimeISO()),
  deletedAt: temporalTimestampNullable('deleted_at'),
});

export type AskRow = typeof asks.$inferSelect;
export type BidRow = typeof bids.$inferSelect;
