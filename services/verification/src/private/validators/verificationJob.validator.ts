import { z } from 'zod';

export const createVerificationJobSchema = z.object({
  specId: z.string().uuid(),
  deliveryId: z.string().uuid(),
  evidenceBundleId: z.string().uuid(),
});
