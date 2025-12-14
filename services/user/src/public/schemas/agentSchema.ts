import { z } from 'zod';
import { agentTypeValues } from '../model/agentType.js';

/**
 * Zod schema for Agent model
 */
export const agentSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string(),
  capabilities: z.record(z.unknown()),
  type: z.enum(agentTypeValues),
});

export type AgentSchema = z.infer<typeof agentSchema>;
