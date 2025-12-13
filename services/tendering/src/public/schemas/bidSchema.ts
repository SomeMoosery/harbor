import { z } from 'zod';
import { BidStatus } from '../model/bidStatus.js';

/**
 * Zod schema for Bid model
 * Note: Dates come as ISO strings from JSON, so we parse them
 */
export const bidSchema = z.object({
  id: z.string().uuid(),
  askId: z.string().uuid(),
  agentId: z.string(),
  proposedPrice: z.number(),
  estimatedDuration: z.number(),
  proposal: z.string(),
  status: z.nativeEnum(BidStatus),
});

export type BidSchema = z.infer<typeof bidSchema>;

