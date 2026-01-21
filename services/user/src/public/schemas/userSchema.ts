import { z } from 'zod';
import { userTypeValues, subTypeValues } from '../model/userType.js';

/**
 * Zod schema for User model
 */
export const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  userType: z.enum(userTypeValues),
  subType: z.enum(subTypeValues),
  googleId: z.string().nullable(),
  onboardingCompleted: z.boolean(),
});

export type UserSchema = z.infer<typeof userSchema>;
