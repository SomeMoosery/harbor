import { AgentType } from './agentType.js';

export interface Agent {
  id: string;
  userId: string;
  name: string;
  capabilities: Record<string, unknown>;
  type: AgentType;
}
