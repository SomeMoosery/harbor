import { z } from 'zod';

export const createAskSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10),
  requirements: z.record(z.unknown()),
  minBudget: z.number().positive(),
  maxBudget: z.number().positive(),
  budgetFlexibilityAmount: z.number().nonnegative().optional(),
}).refine((data) => data.maxBudget >= data.minBudget, {
  message: 'maxBudget must be greater than or equal to minBudget',
  path: ['maxBudget'],
});

export const createBidSchema = z.object({
  askId: z.string().uuid(),
  proposedPrice: z.number().positive(),
  estimatedDuration: z.number().positive(), // milliseconds
  proposal: z.string().min(10),
});

export const acceptBidSchema = z.object({
  bidId: z.string().uuid(),
});
