import { z } from 'zod';

export const createWalletSchema = z.object({
  agentId: z.string().uuid(),
});

export const depositSchema = z.object({
  walletId: z.string().uuid(),
  amount: z.object({
    amount: z.number().positive(),
    currency: z.string(),
  }),
  paymentMethodId: z.string(),
});

export const transferSchema = z.object({
  fromWalletId: z.string().uuid(),
  toWalletId: z.string().uuid(),
  amount: z.object({
    amount: z.number().positive(),
    currency: z.string(),
  }),
  description: z.string().optional(),
});
