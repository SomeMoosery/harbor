import { z } from 'zod';
import { agentTypeValues } from '../../public/model/agentType.js';

export const createAgentSchema = z.object({
  name: z.string().min(1).max(200),
  capabilities: z.record(z.unknown()),
  type: z.enum(agentTypeValues),
});

export const completeOnboardingSchema = z.object({
  userId: z.string().uuid(),
  userType: z.enum(['HUMAN', 'AGENT']),
  subType: z.enum(['BUSINESS', 'PERSONAL']).optional(),
});

export const changeUserTypeSchema = z.object({
  userType: z.enum(['HUMAN', 'AGENT']),
  subType: z.enum(['BUSINESS', 'PERSONAL']).optional(),
});

export const createSessionSchema = z.object({
  googleId: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1),
});

export const validateSessionSchema = z.object({
  sessionToken: z.string().uuid(),
});

export const logoutSchema = z.object({
  sessionToken: z.string().uuid(),
});
