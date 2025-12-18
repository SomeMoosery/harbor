import { pgTable, text, jsonb, uuid, real } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { temporalTimestamp, temporalTimestampNullable } from '@harbor/db/temporal';
import { Temporal } from 'temporal-polyfill';

export const wallets = pgTable('wallets', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  agentId: text('agent_id').notNull().unique(), // One wallet per agent
  circleWalletId: text('circle_wallet_id'), // Circle wallet ID (nullable for testing)
  status: text('status', { enum: ['ACTIVE', 'SUSPENDED', 'CLOSED'] })
    .notNull()
    .default('ACTIVE'),
  createdAt: temporalTimestamp('created_at').notNull().default(Temporal.Now.zonedDateTimeISO()),
  updatedAt: temporalTimestamp('updated_at').notNull().default(Temporal.Now.zonedDateTimeISO()),
  deletedAt: temporalTimestampNullable('deleted_at'),
});

export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  type: text('type', {
    enum: ['DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'FEE', 'ESCROW_LOCK', 'ESCROW_RELEASE', 'MINT'],
  }).notNull(),
  fromWalletId: uuid('from_wallet_id').references(() => wallets.id),
  toWalletId: uuid('to_wallet_id').references(() => wallets.id),
  amount: real('amount').notNull(),
  currency: text('currency').notNull().default('USDC'),
  status: text('status', { enum: ['PENDING', 'COMPLETED', 'FAILED'] })
    .notNull()
    .default('PENDING'),
  externalId: text('external_id'), // Circle/Stripe transaction ID
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: temporalTimestamp('created_at').notNull().default(Temporal.Now.zonedDateTimeISO()),
  updatedAt: temporalTimestamp('updated_at').notNull().default(Temporal.Now.zonedDateTimeISO()),
});

export const ledgerEntries = pgTable('ledger_entries', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  agentId: text('agent_id').notNull(), // Agent this entry belongs to
  walletId: uuid('wallet_id')
    .notNull()
    .references(() => wallets.id),

  // Reconciliation tracking
  type: text('type', { enum: ['ONRAMP', 'OFFRAMP', 'INTERNAL_TRANSFER'] }).notNull(),
  status: text('status', {
    enum: ['PENDING', 'EXTERNAL_COMPLETED', 'INTERNAL_COMPLETED', 'RECONCILED', 'FAILED', 'REQUIRES_MANUAL_REVIEW']
  }).notNull().default('PENDING'),

  // External provider (Stripe, bank, etc.)
  externalProvider: text('external_provider'), // 'stripe', 'ach', 'wire', etc.
  externalTransactionId: text('external_transaction_id'), // Stripe payment intent ID, etc.
  externalAmount: real('external_amount'), // Fiat amount
  externalCurrency: text('external_currency'), // 'USD', 'EUR', etc.
  externalStatus: text('external_status'), // Provider-specific status
  externalCompletedAt: temporalTimestamp('external_completed_at'),

  // Internal wallet/Circle
  internalTransactionId: uuid('internal_transaction_id').references(() => transactions.id),
  internalAmount: real('internal_amount').notNull(), // USDC amount
  internalCurrency: text('internal_currency').notNull().default('USDC'),
  internalStatus: text('internal_status'), // 'pending', 'completed', 'failed'
  internalCompletedAt: temporalTimestamp('internal_completed_at'),

  // Reconciliation
  reconciledAt: temporalTimestamp('reconciled_at'),
  reconciliationNotes: text('reconciliation_notes'),

  // Fees and amounts
  platformFee: real('platform_fee').default(0),
  externalProviderFee: real('external_provider_fee').default(0),

  description: text('description').notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: temporalTimestamp('created_at').notNull().default(Temporal.Now.zonedDateTimeISO()),
  updatedAt: temporalTimestamp('updated_at').notNull().default(Temporal.Now.zonedDateTimeISO()),
});

export type WalletRow = typeof wallets.$inferSelect;
export type TransactionRow = typeof transactions.$inferSelect;
export type LedgerEntryRow = typeof ledgerEntries.$inferSelect;
