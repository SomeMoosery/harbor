import { z } from 'zod';
import { bidStatusValues } from '../model/bidStatus';

/**
 * Zod schema for Bid model
 */
export const bidSchema = z.object({
  id: z.string().uuid(),
  askId: z.string().uuid(),
  agentId: z.string(),
  proposedPrice: z.number(),
  estimatedDuration: z.number(),
  proposal: z.string(),
  status: z.enum(bidStatusValues),
});

export type BidSchema = z.infer<typeof bidSchema>;

