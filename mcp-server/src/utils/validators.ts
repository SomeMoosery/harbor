/**
 * Zod schemas for input validation
 */

import { z } from 'zod';

export const authenticateSchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
});

export const createAskSchema = z.object({
  description: z.string().min(10, 'Description must be at least 10 characters'),
  budget: z.number().positive('Budget must be positive'),
  bidWindowHours: z.number().positive('Bid window must be positive').max(168, 'Bid window cannot exceed 7 days'),
});

export const listBidsSchema = z.object({
  askId: z.string().optional(),
});

export const acceptBidSchema = z.object({
  bidId: z.string().min(1, 'Bid ID is required'),
});

export const getDeliverySchema = z.object({
  askId: z.string().optional(),
});
