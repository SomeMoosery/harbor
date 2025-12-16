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
