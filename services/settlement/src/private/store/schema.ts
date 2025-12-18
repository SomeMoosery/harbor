import { pgTable, text, jsonb, uuid, real } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { temporalTimestamp } from '@harbor/db/temporal';
import { Temporal } from 'temporal-polyfill';

export const escrowLocks = pgTable('escrow_locks', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  askId: text('ask_id').notNull(),
  bidId: text('bid_id').notNull(),
  buyerWalletId: text('buyer_wallet_id').notNull(),
  buyerAgentId: text('buyer_agent_id').notNull(),
  totalAmount: real('total_amount').notNull(), // Total amount including buyer fee
  baseAmount: real('base_amount').notNull(), // Bid amount without fees
  buyerFee: real('buyer_fee').notNull(),
  currency: text('currency').notNull().default('USDC'),
  status: text('status', { enum: ['LOCKED', 'RELEASED', 'REFUNDED'] })
    .notNull()
    .default('LOCKED'),
  lockTransactionId: text('lock_transaction_id'), // Wallet transaction ID for locking funds
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: temporalTimestamp('created_at').notNull().default(Temporal.Now.zonedDateTimeISO()),
  updatedAt: temporalTimestamp('updated_at').notNull().default(Temporal.Now.zonedDateTimeISO()),
});

export const settlements = pgTable('settlements', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  escrowLockId: uuid('escrow_lock_id')
    .notNull()
    .references(() => escrowLocks.id),
  sellerWalletId: text('seller_wallet_id').notNull(),
  sellerAgentId: text('seller_agent_id').notNull(),
  payoutAmount: real('payout_amount').notNull(), // Amount seller receives (base - seller fee)
  sellerFee: real('seller_fee').notNull(),
  platformRevenue: real('platform_revenue').notNull(), // Total fees collected (buyer + seller)
  currency: text('currency').notNull().default('USDC'),
  status: text('status', { enum: ['PENDING', 'COMPLETED', 'FAILED'] })
    .notNull()
    .default('PENDING'),
  releaseTransactionId: text('release_transaction_id'), // Wallet transaction ID for releasing to seller
  feeTransactionId: text('fee_transaction_id'), // Wallet transaction ID for platform fee
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: temporalTimestamp('created_at').notNull().default(Temporal.Now.zonedDateTimeISO()),
  updatedAt: temporalTimestamp('updated_at').notNull().default(Temporal.Now.zonedDateTimeISO()),
});

export type EscrowLockRow = typeof escrowLocks.$inferSelect;
export type SettlementRow = typeof settlements.$inferSelect;
