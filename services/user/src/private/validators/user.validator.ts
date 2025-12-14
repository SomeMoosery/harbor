import { z } from 'zod';
import { userTypeValues } from '../../public/model/userType.js';
import { agentTypeValues } from '../../public/model/agentType.js';

// Email validation - simple for now, can be enhanced
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Phone validation - simple pattern (digits, spaces, dashes, parentheses, plus)
const phoneRegex = /^[\d\s\-\(\)\+]+$/;

export const createUserSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(userTypeValues),
  email: z.string().email().regex(emailRegex, 'Invalid email format'),
  phone: z.string().min(10).max(20).regex(phoneRegex, 'Invalid phone format'),
});

export const createAgentSchema = z.object({
  name: z.string().min(1).max(200),
  capabilities: z.record(z.unknown()),
  type: z.enum(agentTypeValues),
});
