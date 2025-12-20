import { z } from 'zod';

export const createBidSchema = z.object({
    askId: z.string().uuid(),
    proposedPrice: z.number().positive(),
    estimatedDuration: z.number().positive(), // milliseconds
    proposal: z.string().min(10),
  });
  
  export const acceptBidSchema = z.object({
    bidId: z.string().uuid(),
  });