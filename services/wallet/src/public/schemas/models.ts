import { z } from 'zod';

// Temporal schema helper - for now we'll accept Date and convert
const temporalSchema = z.any(); // Will be Date from JSON

export const moneySchema = z.object({
  amount: z.number(),
  currency: z.string(),
});

export const walletSchema = z.object({
  id: z.string().uuid(),
  agentId: z.string(),
  circleWalletId: z.string().optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'CLOSED']),
  createdAt: temporalSchema,
  updatedAt: temporalSchema,
  deletedAt: temporalSchema.optional(),
});

export const transactionSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'FEE', 'ESCROW_LOCK', 'ESCROW_RELEASE', 'MINT']),
  fromWalletId: z.string().uuid().optional(),
  toWalletId: z.string().uuid().optional(),
  amount: z.number(),
  currency: z.string(),
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED']),
  externalId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: temporalSchema,
  updatedAt: temporalSchema,
});

export const balanceSchema = z.object({
  walletId: z.string().uuid(),
  available: moneySchema,
  pending: moneySchema.optional(),
  total: moneySchema,
});

export type WalletSchema = z.infer<typeof walletSchema>;
export type TransactionSchema = z.infer<typeof transactionSchema>;
export type BalanceSchema = z.infer<typeof balanceSchema>;
export type MoneySchema = z.infer<typeof moneySchema>;
