import { z } from 'zod';
import { userTypeValues } from '../model/userType.js';

/**
 * Zod schema for User model
 */
export const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: z.enum(userTypeValues),
  email: z.string(),
  phone: z.string(),
});

export type UserSchema = z.infer<typeof userSchema>;
