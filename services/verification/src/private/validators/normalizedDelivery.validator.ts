import { z } from 'zod';

export const createNormalizedDeliverySchema = z.object({
  specId: z.string().uuid(),
  deliveryRaw: z.record(z.any()),
  normalized: z.record(z.any()).optional(),
  schemaVersion: z.string().default('1.0'),
});
