import { z } from 'zod';
import { AskStatus } from '../model/askStatus.js';

/**
 * Zod schema for Ask model
 * Note: Dates come as ISO strings from JSON, so we parse them
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
  status: z.nativeEnum(AskStatus),
});

export type AskSchema = z.infer<typeof askSchema>;

