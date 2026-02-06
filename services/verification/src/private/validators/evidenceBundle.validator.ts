import { z } from 'zod';

export const createEvidenceBundleSchema = z.object({
  specId: z.string().uuid(),
  deliveryId: z.string().uuid(),
  items: z
    .array(
      z.object({
        type: z.enum(['url_snapshot', 'file']),
        uri: z.string(),
        contentHash: z.string().optional(),
        observedAt: z.string().datetime().nullable().optional(),
        metadata: z.record(z.any()).optional(),
      })
    )
    .optional(),
});
