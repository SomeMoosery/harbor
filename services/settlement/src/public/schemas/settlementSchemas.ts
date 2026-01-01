import { z } from 'zod';

export const lockEscrowSchema = z.object({
  askId: z.string(),
  bidId: z.string(),
  buyerAgentId: z.string(),
  amount: z.number().positive(),
  currency: z.string().optional(),
});

export const releaseEscrowSchema = z.object({
  escrowLockId: z.string().uuid(),
  sellerAgentId: z.string(),
  deliveryProof: z.record(z.unknown()).optional(),
});

export const escrowLockSchema = z.object({
  id: z.string(),
  askId: z.string(),
  bidId: z.string(),
  buyerWalletId: z.string(),
  buyerAgentId: z.string(),
  totalAmount: z.number(),
  baseAmount: z.number(),
  buyerFee: z.number(),
  currency: z.string(),
  status: z.enum(['LOCKED', 'RELEASED', 'REFUNDED']),
  lockTransactionId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.unknown(), // Temporal.ZonedDateTime
  updatedAt: z.unknown(), // Temporal.ZonedDateTime
});

export const settlementSchema = z.object({
  id: z.string(),
  escrowLockId: z.string(),
  sellerWalletId: z.string(),
  sellerAgentId: z.string(),
  payoutAmount: z.number(),
  sellerFee: z.number(),
  platformRevenue: z.number(),
  currency: z.string(),
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED']),
  releaseTransactionId: z.string().optional(),
  feeTransactionId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.unknown(), // Temporal.ZonedDateTime
  updatedAt: z.unknown(), // Temporal.ZonedDateTime
});
