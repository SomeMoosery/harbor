import { z } from 'zod';

export const createAskSnapshotSchema = z.object({
  ownerType: z.string(),
  ownerId: z.string(),
  askText: z.string().min(1),
  derivedConstraints: z.record(z.any()).optional(),
  buyerContext: z.record(z.any()).optional(),
  attachments: z.array(z.any()).optional(),
});
