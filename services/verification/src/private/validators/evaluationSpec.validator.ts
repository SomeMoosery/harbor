import { z } from 'zod';

const baseSpec = z.object({
  deliverableType: z.enum(['ranked_table', 'memo']).optional(),
  spec: z.record(z.any()).optional(),
  schemaVersion: z.string().default('1.0').optional(),
  status: z.enum(['DRAFT', 'REVIEW_REQUIRED', 'FROZEN']).optional(),
  translatorModelId: z.string(),
  translatorPromptHash: z.string(),
});

export const createEvaluationSpecSchema = baseSpec.extend({
  askSnapshotId: z.string().uuid(),
});

export const updateEvaluationSpecSchema = baseSpec.partial();
