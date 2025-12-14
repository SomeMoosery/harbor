import { z } from 'zod';
import { askStatusValues } from '../model/askStatus';

/**
 * Zod schema for Ask model
 */
export const askSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  requirements: z.record(z.unknown()),
  minBudget: z.number(),
  maxBudget: z.number(),
  budgetFlexibilityAmount: z.number().optional(),
  createdBy: z.string(),
  status: z.enum(askStatusValues),
});

export type AskSchema = z.infer<typeof askSchema>;

