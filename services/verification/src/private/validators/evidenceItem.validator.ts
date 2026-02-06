import { z } from 'zod';

export const createEvidenceItemSchema = z.object({
  bundleId: z.string().uuid(),
  type: z.enum(['url_snapshot', 'file']),
  uri: z.string(),
  contentHash: z.string().optional(),
  observedAt: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional(),
});
